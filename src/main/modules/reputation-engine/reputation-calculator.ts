import os from 'os';
/**
 * Reputation Engine — Risk Scoring Calculator
 * 
 * Locally analyzes cross-module data to compute risk scores for network hosts.
 * Correlates data from process.db, network.db, events.db, and assets.db
 * entirely offline using heuristic rules.
 */

import { databaseManager } from '../../core/database-manager';
import { createModuleLogger } from '../../core/logger';
import { RiskFactor, HostReputation } from '../../../shared/types/reputation.types';

const log = createModuleLogger('reputation-engine');

// Risk weight constants for each heuristic category
const WEIGHTS = {
  UNSIGNED_PROCESS: 15,
  ELEVATED_PROCESS: 8,
  HIGH_PORT_COUNT: 12,
  DANGEROUS_PORTS: 20,
  FAILED_LOGINS: 18,
  FREQUENT_CONNECTIONS: 10,
  SUSPICIOUS_EVENTS: 15,
  NEW_ASSET: 5,
  RARE_DNS_QUERIES: 10,
};

export class ReputationCalculator {
  /**
   * Calculate risk score for a single host (by IP address).
   * Aggregates signals across all local databases.
   */
  public static async calculateHostReputation(ipAddress: string): Promise<HostReputation> {
    const factors: RiskFactor[] = [];
    const now = Date.now();

    try {
      // 1. Check open ports — dangerous services exposure
      await this.checkPortRisk(ipAddress, factors, now);

      // 2. Check network connection patterns
      await this.checkConnectionPatterns(ipAddress, factors, now);

      // 3. Check Windows Event anomalies
      const localHost = ['127.0.0.1', '::1', ...Object.values(os.networkInterfaces()).flat().map(i => i?.address)].includes(ipAddress);
      if (localHost) await this.checkEventAnomalies(ipAddress, factors, now);

      // 4. Check associated process integrity
      if (localHost) await this.checkProcessIntegrity(ipAddress, factors, now);

      // 5. Check if newly discovered (unknown asset)
      await this.checkAssetRecency(ipAddress, factors, now);

    } catch (err: any) {
      log.error(`Risk calculation error for ${ipAddress}`, { error: err.message });
      throw err;
    }

    // Compute final score (0–100) from all factors
    const rawScore = factors.reduce((sum, f) => sum + f.weight, 0);
    const riskScore = Math.min(100, Math.max(0, rawScore));
    // Coverage of observed sources, not the number of alarming findings.
    const observations = await Promise.all([
      databaseManager.queryGet<any>('assets', 'SELECT COUNT(*) AS cnt FROM assets WHERE ip_address = ?', [ipAddress]),
      databaseManager.queryGet<any>('network', 'SELECT COUNT(*) AS cnt FROM connections WHERE remote_address = ?', [ipAddress]),
    ]);
    const confidence = observations.filter(row => row?.cnt > 0).length / 2;
    if (!confidence) throw new Error('No observed telemetry is available for this host');

    // Get hostname from assets DB
    let hostname: string | undefined;
    try {
      const assetRow = await databaseManager.queryGet<any>(
        'assets', 'SELECT hostname FROM assets WHERE ip_address = ?', [ipAddress]
      );
      hostname = assetRow?.hostname || undefined;
    } catch {}

    // Determine trend from score history
    let trend: 'rising' | 'stable' | 'declining' = 'stable';
    try {
      const history = await databaseManager.queryAll<any>(
        'reputation',
        'SELECT score FROM score_history WHERE host_id = ? ORDER BY timestamp DESC LIMIT 5',
        [ipAddress]
      );
      if (history.length >= 2) {
        const avg = history.reduce((s: number, h: any) => s + h.score, 0) / history.length;
        if (riskScore > avg + 5) trend = 'rising';
        else if (riskScore < avg - 5) trend = 'declining';
      }
    } catch {}

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors);

    return {
      hostId: ipAddress,
      ipAddress,
      hostname,
      riskScore,
      confidence,
      lastCalculated: now,
      factors,
      recommendations,
      trend,
      scoreHistory: [],
    };
  }

  /**
   * Recalculate scores for ALL known hosts and persist to reputation.db.
   */
  public static async recalculateAll(): Promise<HostReputation[]> {
    const results: HostReputation[] = [];
    const now = Date.now();

    try {
      // Get all known assets
      const assets = await databaseManager.queryAll<any>(
        'assets', 'SELECT DISTINCT ip_address FROM assets'
      );

      // Get unique remote IPs from network connections
      const remoteIps = await databaseManager.queryAll<any>(
        'network',
        `SELECT DISTINCT remote_address FROM connections 
         WHERE remote_address != '127.0.0.1' 
         AND remote_address != '0.0.0.0' 
         AND remote_address != '::1' 
         AND remote_address != '*'`
      );

      const allIps = new Set<string>();
      for (const a of assets) allIps.add(a.ip_address);
      for (const r of remoteIps) allIps.add(r.remote_address);

      for (const ip of allIps) {
        const rep = await this.calculateHostReputation(ip);
        results.push(rep);

        // Persist to reputation.db
        await this.persistReputation(rep, now);
      }

      log.info(`Recalculated reputation for ${results.length} hosts.`);
    } catch (err: any) {
      log.error('Failed to recalculate all reputations', { error: err.message });
      throw err;
    }

    return results;
  }

  // ── Risk Check Functions ──────────────────────────────────────

  private static async checkPortRisk(ip: string, factors: RiskFactor[], now: number) {
    try {
      const ports = await databaseManager.queryAll<any>(
        'assets',
        'SELECT port, service, banner FROM asset_ports WHERE asset_id = (SELECT id FROM assets WHERE ip_address = ?)',
        [ip]
      );

      const dangerousPorts = [21, 23, 135, 139, 445, 1433, 3389, 5900, 5985, 5986];
      const exposedDangerous = ports.filter((p: any) => dangerousPorts.includes(p.port));

      if (exposedDangerous.length > 0) {
        factors.push({
          id: `port-dangerous-${ip}`,
          category: 'port',
          label: 'Dangerous Ports Exposed',
          description: `${exposedDangerous.length} high-risk ports open: ${exposedDangerous.map((p: any) => p.port).join(', ')}`,
          weight: Math.min(WEIGHTS.DANGEROUS_PORTS, exposedDangerous.length * 5),
          severity: exposedDangerous.length >= 3 ? 'critical' : 'high',
          evidence: JSON.stringify(exposedDangerous.map((p: any) => ({ port: p.port, service: p.service }))),
          timestamp: now,
        });
      }

      if (ports.length > 15) {
        factors.push({
          id: `port-count-${ip}`,
          category: 'port',
          label: 'High Port Count',
          description: `${ports.length} open ports detected — possible misconfiguration or scan target.`,
          weight: WEIGHTS.HIGH_PORT_COUNT,
          severity: 'medium',
          evidence: `Total: ${ports.length}`,
          timestamp: now,
        });
      }
    } catch (error) { throw error; }
  }

  private static async checkConnectionPatterns(ip: string, factors: RiskFactor[], now: number) {
    try {
      const connCount = await databaseManager.queryGet<any>(
        'network',
        'SELECT COUNT(*) as cnt FROM connections WHERE remote_address = ?',
        [ip]
      );

      if (connCount && connCount.cnt > 50) {
        factors.push({
          id: `conn-freq-${ip}`,
          category: 'network',
          label: 'Frequent Outbound Connections',
          description: `${connCount.cnt} connection records to this host detected.`,
          weight: WEIGHTS.FREQUENT_CONNECTIONS,
          severity: connCount.cnt > 200 ? 'high' : 'medium',
          evidence: `Total connections: ${connCount.cnt}`,
          timestamp: now,
        });
      }
    } catch (error) { throw error; }
  }

  private static async checkEventAnomalies(ip: string, factors: RiskFactor[], now: number) {
    try {
      // Check for failed logins targeting this computer
      const failedLogins = await databaseManager.queryGet<any>(
        'events',
        `SELECT COUNT(*) as cnt FROM events WHERE event_id = 4625 AND timestamp > ?`,
        [now - 86400000] // Last 24 hours
      );

      if (failedLogins && failedLogins.cnt > 5) {
        factors.push({
          id: `event-failed-login-${ip}`,
          category: 'event',
          label: 'Failed Login Attempts',
          description: `${failedLogins.cnt} failed authentication events in the last 24 hours.`,
          weight: Math.min(WEIGHTS.FAILED_LOGINS, failedLogins.cnt * 2),
          severity: failedLogins.cnt > 20 ? 'critical' : 'high',
          evidence: `Event ID 4625 count: ${failedLogins.cnt}`,
          timestamp: now,
        });
      }

      // Check for suspicious events (privilege escalation, new services)
      const suspEvents = await databaseManager.queryGet<any>(
        'events',
        `SELECT COUNT(*) as cnt FROM events WHERE event_id IN (4672, 4728, 7045, 1102) AND timestamp > ?`,
        [now - 86400000]
      );

      if (suspEvents && suspEvents.cnt > 0) {
        factors.push({
          id: `event-suspicious-${ip}`,
          category: 'event',
          label: 'Suspicious Security Events',
          description: `${suspEvents.cnt} privilege/service events (4672, 4728, 7045, 1102) in 24h.`,
          weight: Math.min(WEIGHTS.SUSPICIOUS_EVENTS, suspEvents.cnt * 3),
          severity: suspEvents.cnt > 5 ? 'high' : 'medium',
          evidence: `Event IDs: 4672, 4728, 7045, 1102. Count: ${suspEvents.cnt}`,
          timestamp: now,
        });
      }
    } catch (error) { throw error; }
  }

  private static async checkProcessIntegrity(ip: string, factors: RiskFactor[], now: number) {
    try {
      // Check for unsigned/elevated processes connecting to this IP
      const unsignedProcesses = await databaseManager.queryGet<any>(
        'process',
        "SELECT COUNT(*) as cnt FROM processes WHERE signature_status = 'NotSigned' AND is_running = 1"
      );

      if (unsignedProcesses && unsignedProcesses.cnt > 3) {
        factors.push({
          id: `proc-unsigned-${ip}`,
          category: 'process',
          label: 'Unsigned Active Processes',
          description: `${unsignedProcesses.cnt} unsigned processes currently running on this system.`,
          weight: Math.min(WEIGHTS.UNSIGNED_PROCESS, unsignedProcesses.cnt * 3),
          severity: unsignedProcesses.cnt > 10 ? 'high' : 'medium',
          evidence: `Unsigned count: ${unsignedProcesses.cnt}`,
          timestamp: now,
        });
      }

      const elevatedProcesses = await databaseManager.queryGet<any>(
        'process',
        'SELECT COUNT(*) as cnt FROM processes WHERE token_elevation = 1 AND is_running = 1'
      );

      if (elevatedProcesses && elevatedProcesses.cnt > 5) {
        factors.push({
          id: `proc-elevated-${ip}`,
          category: 'process',
          label: 'Elevated Processes',
          description: `${elevatedProcesses.cnt} elevated (admin) processes active.`,
          weight: WEIGHTS.ELEVATED_PROCESS,
          severity: 'low',
          evidence: `Elevated count: ${elevatedProcesses.cnt}`,
          timestamp: now,
        });
      }
    } catch (error) { throw error; }
  }

  private static async checkAssetRecency(ip: string, factors: RiskFactor[], now: number) {
    try {
      const asset = await databaseManager.queryGet<any>(
        'assets', 'SELECT first_seen FROM assets WHERE ip_address = ?', [ip]
      );

      if (asset && (now - asset.first_seen) < 3600000) {
        // Asset discovered less than 1 hour ago
        factors.push({
          id: `asset-new-${ip}`,
          category: 'behavioral',
          label: 'Newly Discovered Host',
          description: `This host was first seen less than 1 hour ago — not yet baselined.`,
          weight: WEIGHTS.NEW_ASSET,
          severity: 'low',
          evidence: `First seen: ${new Date(asset.first_seen).toISOString()}`,
          timestamp: now,
        });
      }
    } catch (error) { throw error; }
  }

  // ── Persistence ──────────────────────────────────────────────

  private static async persistReputation(rep: HostReputation, now: number) {
    try {
      // Upsert into host_reputation
      const existing = await databaseManager.queryGet<any>(
        'reputation', 'SELECT host_id FROM host_reputation WHERE host_id = ?', [rep.hostId]
      );

      if (existing) {
        await databaseManager.queryRun(
          'reputation',
          `UPDATE host_reputation SET risk_score = ?, confidence = ?, last_calculated = ?, factors = ?, recommendations = ? WHERE host_id = ?`,
          [rep.riskScore, rep.confidence, now, JSON.stringify(rep.factors), JSON.stringify(rep.recommendations), rep.hostId]
        );
      } else {
        await databaseManager.queryRun(
          'reputation',
          `INSERT INTO host_reputation (host_id, risk_score, confidence, last_calculated, factors, recommendations) VALUES (?, ?, ?, ?, ?, ?)`,
          [rep.hostId, rep.riskScore, rep.confidence, now, JSON.stringify(rep.factors), JSON.stringify(rep.recommendations)]
        );
      }

      // Append to score history
      const lastScore = await databaseManager.queryGet<any>(
        'reputation',
        'SELECT score FROM score_history WHERE host_id = ? ORDER BY timestamp DESC LIMIT 1',
        [rep.hostId]
      );
      const delta = lastScore ? rep.riskScore - lastScore.score : 0;

      await databaseManager.queryRun(
        'reputation',
        'INSERT INTO score_history (host_id, score, timestamp, delta) VALUES (?, ?, ?, ?)',
        [rep.hostId, rep.riskScore, now, delta]
      );
    } catch (err: any) {
      log.error(`Failed to persist reputation for ${rep.hostId}`, { error: err.message });
      throw err;
    }
  }

  // ── Recommendations ──────────────────────────────────────────

  private static generateRecommendations(factors: RiskFactor[]): string[] {
    const recs: string[] = [];

    for (const f of factors) {
      switch (f.category) {
        case 'port':
          if (f.label.includes('Dangerous')) {
            recs.push('Review firewall rules and close unnecessary high-risk ports (RDP, SMB, Telnet).');
          }
          if (f.label.includes('Count')) {
            recs.push('Audit exposed services — reduce attack surface by disabling unused listeners.');
          }
          break;
        case 'network':
          recs.push('Investigate frequent outbound connections to this host for potential data exfiltration.');
          break;
        case 'event':
          if (f.label.includes('Failed Login')) {
            recs.push('Enable account lockout policies to mitigate brute-force attacks.');
          }
          if (f.label.includes('Suspicious')) {
            recs.push('Review privilege escalation events and verify new service installations.');
          }
          break;
        case 'process':
          if (f.label.includes('Unsigned')) {
            recs.push('Validate unsigned binaries — apply application whitelisting or code signing enforcement.');
          }
          break;
        case 'behavioral':
          recs.push('Newly discovered hosts should be validated against authorized asset inventory.');
          break;
      }
    }

    return [...new Set(recs)]; // Deduplicate
  }
}
