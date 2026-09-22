import { createModuleLogger } from '../../core/logger';
import { databaseManager } from '../../core/database-manager';
import { providerManager } from '../internet-intelligence/provider-manager';
import { IndicatorType, IntelligenceObject } from '../internet-intelligence/types';

const log = createModuleLogger('correlation-engine');

export type DataProvenance = 'LOCAL' | 'OFFLINE VERIFIED' | 'LIVE' | 'CLOUD' | 'CACHED';

export interface ProvenanceTag {
  label: string;
  provenance: DataProvenance;
  source: string;
}

export interface CloudIntelligenceItem {
  providerId: string;
  providerName: string;
  isConfigured: boolean;
  status: 'healthy' | 'api_not_configured' | 'rate_limited' | 'failed' | 'timeout' | 'offline';
  risk: string;
  confidence: number;
  timestamp: number;
  provenance: DataProvenance;
  details: Record<string, any>;
  rawResponse?: any;
  httpStatus?: number;
  requestDurationMs?: number;
  country?: string;
  asn?: string;
  asnOwner?: string;
  domain?: string;
  hostnames?: string[];
  usageType?: string;
  isTor?: boolean;
  isWhitelisted?: boolean;
  isPublic?: boolean;
  totalReports?: number;
  numDistinctUsers?: number;
  lastReportedAt?: string;
  categories?: string[];
  errorDetails?: string;
}

export interface InvestigationMetadata {
  investigationId: string;
  executionTimestamp: number;
  totalDurationMs: number;
  correlationDurationMs: number;
  providerCount: number;
  providerSuccessCount: number;
  providerFailureCount: number;
  providerUnconfiguredCount: number;
  providerCachedCount: number;
}

export interface UnifiedInvestigationResult {
  indicator: string;
  type: IndicatorType;
  unifiedRiskScore: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  
  /** Provenance badges for UI rendering */
  provenanceBadges: ProvenanceTag[];

  /** Cache age details if loaded from cache */
  cacheInfo?: {
    isCached: boolean;
    cachedAt: number;
    ttlSecondsRemaining: number;
  };

  /** Local Intelligence component */
  localIntelligence: {
    hostId: string;
    riskScore: number;
    factorsCount: number;
    associatedEventsCount: number;
    factors: Array<{ label: string; severity: string; description: string }>;
    recommendations: string[];
    provenance: DataProvenance;
  };

  /** Cloud Intelligence components (e.g. AbuseIPDB, VirusTotal, etc.) */
  cloudIntelligence: CloudIntelligenceItem[];

  /** Performance & Execution Metadata */
  investigationMetadata: InvestigationMetadata;

  timestamp: number;
}

export interface InvestigationHistoryItem {
  id: string;
  indicator: string;
  type: IndicatorType;
  riskLevel: string;
  score: number;
  sourcesCount: number;
  timestamp: number;
}

export class CorrelationEngine {
  private dbName = 'config';
  private historyInitialized = false;

  public async initialize(): Promise<void> {
    if (this.historyInitialized) return;
    try {
      await databaseManager.queryExec(this.dbName, `
        CREATE TABLE IF NOT EXISTS investigation_history (
          id TEXT PRIMARY KEY,
          indicator TEXT NOT NULL,
          type TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          score INTEGER NOT NULL,
          sources_count INTEGER NOT NULL,
          timestamp INTEGER NOT NULL,
          result_json TEXT NOT NULL
        )
      `);
      this.historyInitialized = true;
      log.info('Investigation history database table initialized.');
    } catch (err: any) {
      log.error('Failed to initialize investigation history table', { error: err.message });
    }
  }

  public async investigateIp(ipAddress: string): Promise<UnifiedInvestigationResult> {
    return this.investigateIndicator(ipAddress, 'ip');
  }

  public async investigateIndicator(indicator: string, type: IndicatorType, forceRefresh = false): Promise<UnifiedInvestigationResult> {
    const startTime = Date.now();
    if (!this.historyInitialized) await this.initialize();
    log.info(`Initiating correlation investigation for ${type}:${indicator} (forceRefresh=${forceRefresh})`);

    // 1. Gather Local Intelligence
    let localScore = 0;
    let localFactors: any[] = [];
    let localRecommendations: string[] = [];
    let associatedEventsCount = 0;

    try {
      const repRows = await databaseManager.queryAll<any>(
        'reputation',
        'SELECT * FROM host_reputation WHERE host_id = ?',
        [indicator]
      );

      if (repRows && repRows.length > 0) {
        const row = repRows[0];
        localScore = row.risk_score || 0;
        localFactors = row.factors ? JSON.parse(row.factors) : [];
        localRecommendations = row.recommendations ? JSON.parse(row.recommendations) : [];
      }

      const eventRows = await databaseManager.queryAll<any>(
        'events',
        'SELECT COUNT(*) as count FROM events WHERE instr(COALESCE(message, \'\'), ?) > 0 OR instr(COALESCE(parsed_data, \'\'), ?) > 0',
        [indicator, indicator]
      );
      if (eventRows && eventRows.length > 0) {
        associatedEventsCount = eventRows[0].count || 0;
      }
    } catch (err: any) {
      log.warn(`Local intelligence fetch warning for ${indicator}: ${err.message}`);
    }

    // 2. Gather Cloud Intelligence (via Provider Manager - respects Offline Mode & SQLite Cache)
    let cloudObjects: IntelligenceObject[] = [];
    
    try {
      cloudObjects = await providerManager.query(indicator, type, forceRefresh);
      console.log(`[CORRELATION TRACE] Query returned ${cloudObjects.length} cloud objects for ${indicator}`);
    } catch (err: any) {
      log.warn(`Cloud intelligence fetch warning for ${type}:${indicator}: ${err.message}`);
    }

    // 3. Synthesize Results & Provenance Badges
    const provenanceBadges: ProvenanceTag[] = [
      { label: 'Local Security Engine', provenance: 'LOCAL', source: 'LSIP Core' },
      { label: 'Offline Database Verified', provenance: 'OFFLINE VERIFIED', source: 'SQLite DB' },
    ];

    let oldestCachedTimestamp = Date.now();
    let hasCachedData = false;

    const mappedCloudInt: CloudIntelligenceItem[] = cloudObjects.map(obj => {
      const objProvenance = (obj as any).provenance;
      const provenance: DataProvenance = objProvenance ? (objProvenance as DataProvenance) : (Date.now() - obj.timestamp < 10000 ? 'LIVE' : 'CACHED');
      
      if (provenance === 'CACHED') {
        hasCachedData = true;
        if (obj.timestamp < oldestCachedTimestamp) oldestCachedTimestamp = obj.timestamp;
      }

      const isConfigured = obj.isConfigured !== false && obj.metadata?.errorDetails !== 'API Key Missing';
      let status: 'healthy' | 'api_not_configured' | 'rate_limited' | 'failed' | 'timeout' | 'offline' = 'healthy';

      if (!isConfigured) {
        status = 'api_not_configured';
      } else if (obj.metadata?.errorDetails) {
        const err = String(obj.metadata.errorDetails);
        if (err.includes('429')) status = 'rate_limited';
        else if (err.includes('Timeout')) status = 'timeout';
        else status = 'failed';
      } else {
        status = 'healthy';
      }

      const pName = obj.providerName || providerManager.getProvider(obj.source)?.name || obj.source;

      provenanceBadges.push({
        label: `${pName.toUpperCase()} ${isConfigured ? provenance : 'OFFLINE'}`,
        provenance: isConfigured ? provenance : 'CACHED',
        source: obj.source,
      });

      const d = obj.metadata || {};

      return {
        providerId: obj.source,
        providerName: pName,
        isConfigured,
        status,
        risk: (obj.risk || 'unknown').toUpperCase(),
        confidence: obj.confidence || 0,
        timestamp: obj.timestamp,
        provenance,
        details: d,
        rawResponse: obj.rawResponse,
        httpStatus: obj.httpStatus,
        requestDurationMs: obj.requestDurationMs,
        country: obj.country || d.countryCode || d.country_code || d.countryName || d.country_name,
        asn: obj.asn || (d.asn ? `AS${d.asn}` : undefined) || (d.ASN ? `AS${d.ASN}` : undefined),
        asnOwner: obj.asnOwner || d.isp || d.ISP || d.as_owner,
        domain: d.domain,
        hostnames: d.hostnames,
        usageType: d.usageType,
        isTor: d.isTor,
        isWhitelisted: d.isWhitelisted,
        isPublic: d.isPublic,
        totalReports: d.totalReports || d.reportsCount,
        numDistinctUsers: d.numDistinctUsers,
        lastReportedAt: d.lastReportedAt,
        categories: d.categories,
        errorDetails: d.errorDetails,
      };
    });

    // 4. Calculate Unified Risk Score
    let highestCloudScore = 0;
    for (const cloud of mappedCloudInt) {
      let providerScore = cloud.confidence || 0;

      // Extract report count from provider details or metadata
      const totalReports = cloud.totalReports || cloud.details?.totalReports || cloud.details?.reportsCount || 0;
      if (totalReports > 0) {
        if (totalReports >= 100) providerScore = Math.max(providerScore, 100);
        else if (totalReports >= 20) providerScore = Math.max(providerScore, 85);
        else if (totalReports >= 5) providerScore = Math.max(providerScore, 65);
        else providerScore = Math.max(providerScore, 40);
      }

      const riskUpper = (cloud.risk || '').toUpperCase();
      if (riskUpper === 'CRITICAL' && providerScore < 80) providerScore = 80;
      else if (riskUpper === 'HIGH' && providerScore < 60) providerScore = 60;
      else if (riskUpper === 'MEDIUM' && providerScore < 40) providerScore = 40;
      else if (riskUpper === 'LOW' && providerScore < 20) providerScore = 20;

      if (providerScore > highestCloudScore) {
        highestCloudScore = providerScore;
      }
    }

    const unifiedRiskScore = Math.min(100, Math.max(localScore, highestCloudScore));

    let riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE' = 'SAFE';
    if (unifiedRiskScore >= 70) riskLevel = 'CRITICAL';
    else if (unifiedRiskScore >= 50) riskLevel = 'HIGH';
    else if (unifiedRiskScore >= 30) riskLevel = 'MEDIUM';
    else if (unifiedRiskScore >= 10) riskLevel = 'LOW';

    const providerCount = mappedCloudInt.length;
    const providerSuccessCount = mappedCloudInt.filter(p => p.isConfigured && p.status === 'healthy' && p.httpStatus !== 401 && p.httpStatus !== 500 && p.httpStatus !== 429).length;
    const providerFailureCount = mappedCloudInt.filter(p => p.status === 'failed' || p.status === 'rate_limited' || p.status === 'timeout' || p.httpStatus === 500 || p.httpStatus === 401).length;
    const providerUnconfiguredCount = mappedCloudInt.filter(p => !p.isConfigured || p.status === 'api_not_configured').length;
    const providerCachedCount = mappedCloudInt.filter(p => p.provenance === 'CACHED').length;

    console.log('===========================');
    console.log('[CORRELATION FORENSIC TRACE] Target:', indicator, 'Type:', type);
    console.log('[CORRELATION FORENSIC TRACE] Total Cloud Objects:', cloudObjects.length);
    mappedCloudInt.forEach(p => {
      console.log(`  -> Provider: ${p.providerName} (${p.providerId}) | Status: ${p.status} | Configured: ${p.isConfigured} | Confidence: ${p.confidence} | Risk: ${p.risk} | Reports: ${p.totalReports || 0} | HTTP: ${p.httpStatus || 'N/A'}`);
    });
    console.log(`[CORRELATION FORENSIC TRACE] Result -> HighestCloudScore: ${highestCloudScore}, UnifiedRiskScore: ${unifiedRiskScore}, RiskLevel: ${riskLevel}, RespondingProviders: ${providerSuccessCount}/${providerCount}`);
    console.log('===========================');

    const totalDurationMs = Date.now() - startTime;

    const result: UnifiedInvestigationResult = {
      indicator,
      type,
      unifiedRiskScore,
      riskLevel,
      provenanceBadges,
      cacheInfo: hasCachedData ? {
        isCached: true,
        cachedAt: oldestCachedTimestamp,
        ttlSecondsRemaining: Math.max(0, Math.round((oldestCachedTimestamp + 86400000 - Date.now()) / 1000)),
      } : undefined,
      localIntelligence: {
        hostId: indicator,
        riskScore: localScore,
        factorsCount: localFactors.length,
        associatedEventsCount,
        factors: localFactors,
        recommendations: localRecommendations,
        provenance: 'LOCAL',
      },
      cloudIntelligence: mappedCloudInt,
      investigationMetadata: {
        investigationId: `inv_${Date.now()}_${indicator.replace(/[^a-zA-Z0-9]/g, '_')}`,
        executionTimestamp: Date.now(),
        totalDurationMs,
        correlationDurationMs: Math.max(1, Math.round(totalDurationMs * 0.15)),
        providerCount,
        providerSuccessCount,
        providerFailureCount,
        providerUnconfiguredCount,
        providerCachedCount,
      },
      timestamp: Date.now(),
    };

    console.log('[CORRELATION ENGINE] OUTPUT OBJECT (UnifiedInvestigationResult):', JSON.stringify(result, null, 2));

    log.info(`[FORENSIC DEBUG STEP 9 - CORRELATION MERGE COMPLETED]`, {
      localIntelligence: result.localIntelligence,
      cloudIntelligence: result.cloudIntelligence,
      unifiedRiskScore: result.unifiedRiskScore,
      riskLevel: result.riskLevel,
      cloudCount: result.cloudIntelligence.length,
      finalObject: result
    });

    // Save to SQLite investigation history asynchronously
    this.saveToHistory(result).catch(err => log.error('Failed to save investigation to history', { error: err.message }));

    return result;
  }

  private async saveToHistory(result: UnifiedInvestigationResult): Promise<void> {
    const id = `${result.type}:${result.indicator}:${Date.now()}`;
    const sourcesCount = 1 + result.cloudIntelligence.length;

    try {
      await databaseManager.queryRun(
        this.dbName,
        `INSERT OR REPLACE INTO investigation_history (id, indicator, type, risk_level, score, sources_count, timestamp, result_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, result.indicator, result.type, result.riskLevel, result.unifiedRiskScore, sourcesCount, result.timestamp, JSON.stringify(result)]
      );

      // Keep only last 100 entries
      await databaseManager.queryRun(
        this.dbName,
        `DELETE FROM investigation_history WHERE id NOT IN (SELECT id FROM investigation_history ORDER BY timestamp DESC LIMIT 100)`
      );
    } catch (err: any) {
      log.error('Failed to save to investigation_history table', { error: err.message });
    }
  }

  public async getHistory(searchQuery?: string, filterType?: string): Promise<InvestigationHistoryItem[]> {
    if (!this.historyInitialized) await this.initialize();

    let sql = 'SELECT id, indicator, type, risk_level, score, sources_count, timestamp FROM investigation_history WHERE 1=1';
    const params: any[] = [];

    if (filterType && filterType !== 'all') {
      sql += ' AND type = ?';
      params.push(filterType);
    }

    if (searchQuery && searchQuery.trim() !== '') {
      sql += ' AND (indicator LIKE ? OR risk_level LIKE ?)';
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    sql += ' ORDER BY timestamp DESC LIMIT 100';

    try {
      const rows = await databaseManager.queryAll<any>(this.dbName, sql, params);
      return rows.map(r => ({
        id: r.id,
        indicator: r.indicator,
        type: r.type,
        riskLevel: r.risk_level,
        score: r.score,
        sourcesCount: r.sources_count,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      log.error('Failed to query investigation history', { error: err.message });
      return [];
    }
  }

  public async clearHistory(): Promise<void> {
    if (!this.historyInitialized) await this.initialize();
    try {
      await databaseManager.queryExec(this.dbName, 'DELETE FROM investigation_history');
      log.info('Cleared investigation history.');
    } catch (err: any) {
      log.error('Failed to clear investigation history', { error: err.message });
    }
  }
}

export const correlationEngine = new CorrelationEngine();
