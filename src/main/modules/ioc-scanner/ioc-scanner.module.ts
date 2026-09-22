import { BaseModule } from '../base-module';
import { isIP } from 'net';
import { domainToASCII } from 'url';
import { runDetection } from './detection-service';
import { initializeRuleLibrary, listRules, saveRule } from './rule-library';
import { text } from '../../core/security';
import { databaseManager } from '../../core/database-manager';
import { IocMatch, IocScanResult } from '../../../shared/types/ioc.types';

export class IocScannerModule extends BaseModule {
  public readonly name = 'ioc';
  public readonly displayName = 'IOC Scanner';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing IOC Scanner Module...');
    this.registerIpcHandler('evaluate-rule', runDetection);
    await initializeRuleLibrary();
    this.registerIpcHandler('rule-list', listRules);
    this.registerIpcHandler('rule-save', saveRule);

    this.registerIpcHandler<{ indicators: string[] }, IocScanResult>('scan', async (payload) => {
      if(!Array.isArray(payload?.indicators)||payload.indicators.length>1000)throw new Error('Supply at most 1000 indicators');
      payload.indicators.forEach(i=>text(i,'Indicator',2048));
      return this.scanIndicators(payload.indicators);
    });

    this.logger.info('IOC Scanner Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down IOC Scanner Module...');
    this.unregisterIpcHandlers();
  }

  private async scanIndicators(indicators: string[]): Promise<IocScanResult> {
    const startTime = Date.now();
    const matches: IocMatch[] = [];
    const validIndicators = indicators.map(i => i.trim()).filter(i => i.length > 0);

    if (validIndicators.length === 0) {
      return { scanId: `scan-${startTime}`, startTime, endTime: Date.now(), indicatorsSearched: 0, matchesFound: 0, matches: [] };
    }

    try {
      for (const indicator of validIndicators) {
        const type = this.determineType(indicator);

        if (type === 'ip') {
          // Check connections
          const connRows = await databaseManager.queryAll<any>('network', 'SELECT * FROM connections WHERE remote_address = ? OR local_address = ?', [indicator, indicator]);
          for (const row of connRows) {
            matches.push({ id: `conn-${row.id}`, indicator, type, source: 'Active Connections', timestamp: Date.now(), context: `Process: ${row.process_name} (PID: ${row.pid}) connecting to ${indicator}:${row.remote_port}`, severity: 'high' });
          }
          // Check DNS cache for IP resolution
          // Check DNS cache: look for records where response contains this IP
          const dnsRows = await databaseManager.queryAll<any>('network', 'SELECT * FROM dns_queries WHERE response = ?', [indicator]);
          for (const row of dnsRows) {
            matches.push({ id: `dns-${row.id}`, indicator, type, source: 'DNS Cache', timestamp: row.timestamp, context: `Domain ${row.query_name} resolved to ${indicator}`, severity: 'medium' });
          }
        } 
        else if (type === 'domain') {
          // Check DNS queries
          const domain = domainToASCII(indicator).toLowerCase().replace(/\.$/, '');
          const dnsRows = await databaseManager.queryAll<any>('network', "SELECT * FROM dns_queries WHERE lower(rtrim(query_name, '.')) = ? OR lower(rtrim(query_name, '.')) LIKE ?", [domain, `%\.${domain}`]);
          for (const row of dnsRows) {
            matches.push({ id: `dns-${row.id}`, indicator, type, source: 'DNS Cache', timestamp: row.timestamp, context: `Queried domain: ${row.query_name}`, severity: 'high' });
          }
        } 
        else if (type === 'hash') {
          // Check FIM baseline
          const fimRows = await databaseManager.queryAll<any>('ioc', 'SELECT * FROM fim_baseline WHERE lower(hash_sha256) = ?', [indicator.toLowerCase()]);
          for (const row of fimRows) {
            matches.push({ id: `fim-${row.file_path}`, indicator, type, source: 'File Integrity Monitor', timestamp: row.last_checked, context: `File with hash found at ${row.file_path}`, severity: 'critical' });
          }
        }
      }
    } catch (err: any) {
      this.logger.error('IOC scan failed', { error: err.message });
      throw err;
    }

    return {
      scanId: `scan-${startTime}`,
      startTime,
      endTime: Date.now(),
      indicatorsSearched: validIndicators.length,
      matchesFound: matches.length,
      matches,
    };
  }

  private determineType(indicator: string): 'hash' | 'ip' | 'domain' {
    if (isIP(indicator)) return 'ip';
    const isHash = /^[a-fA-F0-9]{64}$/.test(indicator);
    if (isHash) return 'hash';
    if (/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$/.test(indicator)) throw new Error('The file baseline stores SHA-256 hashes; MD5 and SHA-1 cannot be searched');
    const domain = domainToASCII(indicator).replace(/\.$/, '');
    if (!domain || domain.length > 253 || !domain.includes('.') || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) || /^[0-9.]+$/.test(domain)) throw new Error('Invalid IP address, domain or SHA-256 indicator');
    return 'domain';
  }
}
export default IocScannerModule;
