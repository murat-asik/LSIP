import { BaseModule } from '../base-module';
import { DnsCollector } from './dns-collector';
import { DnsQueryRecord, DnsSummary, DnsQueryFilter, DnsDomainStats } from '../../../shared/types/dns.types';
import { databaseManager } from '../../core/database-manager';

export class DnsIntelligenceModule extends BaseModule {
  public readonly name = 'dns';
  public readonly displayName = 'DNS Intelligence';
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  public async initialize(): Promise<void> {
    this.logger.info('Initializing DNS Intelligence Module...');

    // 1. Query DNS records from database
    this.registerIpcHandler<DnsQueryFilter, DnsQueryRecord[]>('query', async (filter) => {
      return this.queryDnsRecords(filter);
    });

    // 2. Get DNS summary stats
    this.registerIpcHandler<void, DnsSummary>('summary', async () => {
      return this.getDnsSummary();
    });

    // 3. Trigger manual DNS cache sync
    this.registerIpcHandler<void, boolean>('sync', async () => {
      await this.syncDnsCache();
      return true;
    });

    // 4. Get domain details (aggregated stats)
    this.registerIpcHandler<{ domain: string }, DnsDomainStats>('domain-detail', async (payload) => {
      return this.getDomainStats(payload.domain);
    });

    // 5. Analyze a single domain
    this.registerIpcHandler<{ domain: string }, any>('analyze', async (payload) => {
      return DnsCollector.analyzeDomain(payload.domain);
    });

    // Initial sync
    this.syncDnsCache().catch((err) => {
      this.logger.error('Initial DNS sync failed', { error: err.message });
    });

    // Auto-sync every 60 seconds
    this.syncTimer = this.registerInterval(60000, () => {
      this.syncDnsCache().catch((err) => {
        this.logger.error('DNS periodic sync failed', { error: err.message });
      });
    });

    this.logger.info('DNS Intelligence Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down DNS Intelligence Module...');
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.unregisterIpcHandlers();
  }

  /**
   * Sync local DNS cache into the network database dns_queries table.
   */
  private async syncDnsCache() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const records = await DnsCollector.fetchDnsCache();
      if (records.length === 0) {
        this.isSyncing = false;
        return;
      }

      let newCount = 0;
      for (const record of records) {
        // Check for duplicates by query name
        const existing = await databaseManager.queryGet<any>(
          'network',
          'SELECT id FROM dns_queries WHERE query_name = ? AND query_type = ? ORDER BY timestamp DESC LIMIT 1',
          [record.queryName, record.queryType]
        );

        if (existing) {
          // Update timestamp of existing record
          // Don't insert duplicates for the same domain
          continue;
        }

        await databaseManager.queryRun(
          'network',
          `INSERT INTO dns_queries (timestamp, query_name, query_type, response, source_ip, pid, process_name, is_rare)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.timestamp,
            record.queryName,
            record.queryType,
            record.response,
            record.sourceIp || null,
            record.pid || null,
            record.processName || null,
            record.isRare ? 1 : 0,
          ]
        );
        newCount++;
      }

      if (newCount > 0) {
        this.logger.info(`Synced ${newCount} new DNS records to database.`);
      }

      // Rotate old records (keep last 10000)
      const countRow = await databaseManager.queryGet<any>('network', 'SELECT COUNT(*) as cnt FROM dns_queries');
      if (countRow && countRow.cnt > 10000) {
        const excess = countRow.cnt - 10000;
        await databaseManager.queryRun(
          'network',
          `DELETE FROM dns_queries WHERE id IN (SELECT id FROM dns_queries ORDER BY timestamp ASC LIMIT ?)`,
          [excess]
        );
      }
    } catch (err: any) {
      this.logger.error('DNS sync error', { error: err.message });
    } finally {
      this.isSyncing = false;
    }
  }

  private async queryDnsRecords(filter: DnsQueryFilter): Promise<DnsQueryRecord[]> {
    let sql = 'SELECT * FROM dns_queries WHERE 1=1';
    const params: any[] = [];

    if (filter.searchQuery) {
      sql += ' AND (query_name LIKE ? OR response LIKE ?)';
      const like = `%${filter.searchQuery}%`;
      params.push(like, like);
    }

    if (filter.queryType) {
      sql += ' AND query_type = ?';
      params.push(filter.queryType);
    }

    if (filter.startTime) {
      sql += ' AND timestamp >= ?';
      params.push(filter.startTime);
    }

    if (filter.endTime) {
      sql += ' AND timestamp <= ?';
      params.push(filter.endTime);
    }

    if (filter.processName) {
      sql += ' AND process_name = ?';
      params.push(filter.processName);
    }

    sql += ' ORDER BY timestamp DESC';

    const limit = filter.limit || 500;
    sql += ' LIMIT ?';
    params.push(limit);

    try {
      const rows = await databaseManager.queryAll<any>('network', sql, params);
      return rows.map((r: any) => {
        const analysis = DnsCollector.analyzeDomain(r.query_name);
        return {
          id: r.id,
          timestamp: r.timestamp,
          queryName: r.query_name,
          queryType: r.query_type || 'A',
          response: r.response || '',
          ttl: undefined,
          sourceIp: r.source_ip || undefined,
          pid: r.pid || undefined,
          processName: r.process_name || undefined,
          isRare: r.is_rare === 1,
          riskLevel: analysis.riskLevel,
          tags: analysis.tags,
        };
      });
    } catch (err: any) {
      this.logger.error('Failed to query DNS records', { error: err.message });
      return [];
    }
  }

  private async getDnsSummary(): Promise<DnsSummary> {
    try {
      const totalRow = await databaseManager.queryGet<any>('network', 'SELECT COUNT(*) as cnt FROM dns_queries');
      const uniqueRow = await databaseManager.queryGet<any>('network', 'SELECT COUNT(DISTINCT query_name) as cnt FROM dns_queries');
      const rareRow = await databaseManager.queryGet<any>('network', 'SELECT COUNT(*) as cnt FROM dns_queries WHERE is_rare = 1');

      const topDomains = await databaseManager.queryAll<any>(
        'network',
        'SELECT query_name as domain, COUNT(*) as count FROM dns_queries GROUP BY query_name ORDER BY count DESC LIMIT 10'
      );

      const recentRows = await databaseManager.queryAll<any>(
        'network',
        'SELECT * FROM dns_queries ORDER BY timestamp DESC LIMIT 20'
      );

      const recentQueries = recentRows.map((r: any) => {
        const analysis = DnsCollector.analyzeDomain(r.query_name);
        return {
          id: r.id,
          timestamp: r.timestamp,
          queryName: r.query_name,
          queryType: r.query_type || 'A',
          response: r.response || '',
          isRare: r.is_rare === 1,
          riskLevel: analysis.riskLevel,
          tags: analysis.tags,
        };
      });

      return {
        totalQueries: totalRow?.cnt || 0,
        uniqueDomains: uniqueRow?.cnt || 0,
        suspiciousCount: rareRow?.cnt || 0,
        topDomains: topDomains.map((d: any) => ({ domain: d.domain, count: d.count })),
        recentQueries,
        anomaliesDetected: rareRow?.cnt || 0,
      };
    } catch (err: any) {
      this.logger.error('Failed to get DNS summary', { error: err.message });
      return {
        totalQueries: 0, uniqueDomains: 0, suspiciousCount: 0,
        topDomains: [], recentQueries: [], anomaliesDetected: 0,
      };
    }
  }

  private async getDomainStats(domain: string): Promise<DnsDomainStats> {
    try {
      const rows = await databaseManager.queryAll<any>(
        'network',
        'SELECT * FROM dns_queries WHERE query_name LIKE ? ORDER BY timestamp DESC',
        [`%${domain}%`]
      );

      const recordTypes = [...new Set(rows.map((r: any) => r.query_type))];
      const resolvedIps = [...new Set(rows.filter((r: any) => r.response).map((r: any) => r.response))];
      const processes = [...new Set(rows.filter((r: any) => r.process_name).map((r: any) => r.process_name))];
      const analysis = DnsCollector.analyzeDomain(domain);

      return {
        domain,
        queryCount: rows.length,
        uniqueSubdomains: new Set(rows.map((r: any) => r.query_name)).size,
        firstSeen: rows.length > 0 ? rows[rows.length - 1].timestamp : Date.now(),
        lastSeen: rows.length > 0 ? rows[0].timestamp : Date.now(),
        recordTypes,
        resolvedIps,
        associatedProcesses: processes,
        riskLevel: analysis.riskLevel,
        anomalyFlags: analysis.tags,
      };
    } catch (err: any) {
      this.logger.error('Failed to get domain stats', { error: err.message });
      return {
        domain, queryCount: 0, uniqueSubdomains: 0,
        firstSeen: 0, lastSeen: 0, recordTypes: [],
        resolvedIps: [], associatedProcesses: [],
        riskLevel: 'safe', anomalyFlags: [],
      };
    }
  }
}
export default DnsIntelligenceModule;
