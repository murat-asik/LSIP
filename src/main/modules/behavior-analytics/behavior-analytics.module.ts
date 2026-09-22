import { BaseModule } from '../base-module';
import { databaseManager } from '../../core/database-manager';
import { UebaAnomaly, UebaSummary } from '../../../shared/types/ueba.types';

export class BehaviorAnalyticsModule extends BaseModule {
  public readonly name = 'behavior';
  public readonly displayName = 'Behavior Analytics (UEBA)';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing UEBA Module...');

    this.registerIpcHandler<void, UebaSummary>('summary', async () => {
      return this.analyzeBehaviors();
    });

    this.logger.info('UEBA Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down UEBA Module...');
    this.unregisterIpcHandlers();
  }

  private async analyzeBehaviors(): Promise<UebaSummary> {
    const anomalies: UebaAnomaly[] = [];
    let idCounter = 1;

    try {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // 1. Detect Login Spikes (RDP / Local failures)
      const failedLogins = await databaseManager.queryAll<any>('events', "SELECT id FROM events WHERE event_id = 4625 AND timestamp > ?", [oneHourAgo]);
      if (failedLogins.length > 5) {
        anomalies.push({
          id: `ueba-${idCounter++}`,
          timestamp: now,
          entityType: 'host',
          entityName: 'Local System',
          anomalyType: 'login_spike',
          description: `Detected ${failedLogins.length} failed login attempts in the past hour.`,
          score: Math.min(100, failedLogins.length * 10),
          confidence: 90,
        });
      }

      // 2. High Process Turnover (Rapid start/stops)
      const procHistory = await databaseManager.queryGet<any>('process', "SELECT COUNT(*) as cnt FROM process_history WHERE timestamp > ?", [oneHourAgo]);
      if (procHistory && procHistory.cnt > 500) {
        anomalies.push({
          id: `ueba-${idCounter++}`,
          timestamp: now,
          entityType: 'process',
          entityName: 'Multiple Processes',
          anomalyType: 'high_cpu',
          description: `Unusual process turnover rate: ${procHistory.cnt} processes spawned/killed in one hour.`,
          score: 60,
          confidence: 85,
        });
      }

      // 3. Port Scan / High Outbound connections from single process
      const outboundConns = await databaseManager.queryAll<any>('network', "SELECT process_name, pid, COUNT(*) as cnt FROM connections WHERE remote_address != '127.0.0.1' GROUP BY process_name HAVING cnt > 30");
      for (const conn of outboundConns) {
        anomalies.push({
          id: `ueba-${idCounter++}`,
          timestamp: now,
          entityType: 'process',
          entityName: conn.process_name || `PID ${conn.pid}`,
          anomalyType: 'port_scan',
          description: `Process is maintaining ${conn.cnt} concurrent outbound connections.`,
          score: 80,
          confidence: 95,
        });
      }

      // 4. Command Line Anomaly Detection (MITRE T1059.001 / T1027)
      const cmdAnomalies = await databaseManager.queryAll<any>('process', "SELECT pid, name, command_line FROM process_history WHERE timestamp > ?", [oneHourAgo]);
      for (const p of cmdAnomalies) {
        if (!p.command_line) continue;
        const cmd = p.command_line.toLowerCase();
        if (cmd.includes('-enc ') || cmd.includes('-encodedcommand ') || cmd.includes('base64') || cmd.includes('bypass') || cmd.includes('hidden')) {
          anomalies.push({
            id: `ueba-${idCounter++}`,
            timestamp: now,
            entityType: 'process',
            entityName: p.name || `PID ${p.pid}`,
            anomalyType: 'mitre_t1059',
            description: `Suspicious command line detected (obfuscation/bypass): ${p.command_line.substring(0, 100)}`,
            score: 85,
            confidence: 95,
          });
        }
      }

      // 5. Parent-Child Process Anomalies (MITRE T1055, T1204)
      // e.g. cmd.exe or powershell.exe spawned by winword.exe, excel.exe, acrobat.exe, spoolsv.exe
      const parentChildAnomalies = await databaseManager.queryAll<any>('process', "SELECT p.pid, p.name, parent.name as parent_name FROM process_history p JOIN process_history parent ON p.ppid = parent.pid WHERE p.timestamp > ?", [oneHourAgo]);
      const SUSPICIOUS_PARENTS = ['winword.exe', 'excel.exe', 'powerpnt.exe', 'acrobat.exe', 'spoolsv.exe', 'lsass.exe', 'services.exe'];
      const SUSPICIOUS_CHILDREN = ['cmd.exe', 'powershell.exe', 'wscript.exe', 'cscript.exe', 'regsvr32.exe', 'rundll32.exe'];

      for (const p of parentChildAnomalies) {
        if (!p.name || !p.parent_name) continue;
        const child = p.name.toLowerCase();
        const parent = p.parent_name.toLowerCase();

        if (SUSPICIOUS_PARENTS.includes(parent) && SUSPICIOUS_CHILDREN.includes(child)) {
          anomalies.push({
            id: `ueba-${idCounter++}`,
            timestamp: now,
            entityType: 'process',
            entityName: p.name,
            anomalyType: 'mitre_t1055',
            description: `Suspicious process hierarchy: ${parent} spawned ${child}`,
            score: 95,
            confidence: 90,
          });
        }
      }

    } catch (err: any) {
      this.logger.error('UEBA analysis failed', { error: err.message });
    }

    const criticalEntities = new Set(anomalies.filter(a => a.score > 70).map(a => a.entityName));

    return {
      activeAnomalies: anomalies.length,
      criticalEntities: criticalEntities.size,
      anomalies,
    };
  }
}
export default BehaviorAnalyticsModule;
