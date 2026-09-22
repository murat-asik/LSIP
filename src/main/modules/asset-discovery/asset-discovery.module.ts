import crypto from 'crypto';
import { BaseModule } from '../base-module';
import { NetworkScanner } from './scanners/net-scanner';
import { lookupVendor } from './fingerprint/vendor-lookup';
import { Asset, NetworkInterfaceInfo } from '../../../shared/types/asset.types';
import { databaseManager } from '../../core/database-manager';
import { scopeContains } from './scanners/network-scope';
import { integer } from '../../core/security';

export class AssetDiscoveryModule extends BaseModule {
  public readonly name = 'assets';
  public readonly displayName = 'Asset Discovery';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Asset Discovery Module...');

    // 1. Get local network interfaces
    this.registerIpcHandler<void, NetworkInterfaceInfo[]>('interfaces', async () => {
      return NetworkScanner.getInterfaces();
    });

    // 2. Load all saved assets from database
    this.registerIpcHandler<void, Asset[]>('get-all', async () => {
      return this.loadAssetsFromDb();
    });

    // 3. Trigger network discovery scan
    this.registerIpcHandler<{ subnetScope?: string; targetPorts?: number[] }, Asset[]>(
      'scan',
      async (payload) => {
        const subnet = payload?.subnetScope || '';
        const defaultPorts = [22, 80, 443, 445, 3389];
        if(payload?.targetPorts!==undefined && (!Array.isArray(payload.targetPorts)||payload.targetPorts.length>128))throw new Error('Supply at most 128 ports');
        const ports = [...new Set(payload?.targetPorts?.length ? payload.targetPorts : defaultPorts)];
        ports.forEach(port=>integer(port,'Port',65535));
        if(typeof subnet!=='string')throw new Error('Invalid subnet scope');
        if(subnet)scopeContains(subnet,'127.0.0.1');

        this.logger.info(`Starting subnet scan: subnet='${subnet}', ports=[${ports.join(', ')}]`);

        // Get active hosts via ARP table parsing
        const hosts = (await NetworkScanner.getArpTable()).filter(host=>!subnet||scopeContains(subnet,host.ip)).slice(0,1024);
        this.logger.info(`Found ${hosts.length} candidate hosts in local ARP cache.`);

        const discoveredAssets: Asset[] = [];

        // Scan candidate hosts concurrently
        const scanHost = async (host: {ip:string;mac:string}) => {
          try {
            // Measure latency
            const latency = await NetworkScanner.pingHost(host.ip);
            
            // Perform port scan
            const portResults = await NetworkScanner.scanHostPorts(host.ip, ports);
            const openPorts = portResults.filter((p) => p.state === 'open');

            const now = Date.now();
            const hostId = host.mac || crypto.createHash('md5').update(host.ip).digest('hex');
            const vendor = lookupVendor(host.mac);
            const guessedOs = this.guessOS(openPorts, host.ip);
            const deviceType = this.classifyDevice(openPorts, guessedOs, vendor);

            const asset: Asset = {
              id: hostId,
              ipAddress: host.ip,
              macAddress: host.mac,
              hostname: await this.resolveHostname(host.ip),
              vendor,
              osGuess: guessedOs,
              deviceType,
              firstSeen: now,
              lastSeen: now,
              isOnline: latency !== null || portResults.some(port=>port.state!=='filtered'),
              pingLatencyMs: latency !== null ? latency : undefined,
              riskScore: this.calculateInitialRisk(openPorts),
              ports: openPorts,
            };

            discoveredAssets.push(asset);

            // Sync to database inside iteration
            await this.saveAssetToDb(asset);
          } catch (e: any) {
            this.logger.error(`Error scanning host ${host.ip}`, { error: e.message });
          }
        };

        // Await all host scans to complete
        let next=0;
        await Promise.all(Array.from({length:Math.min(8,hosts.length)},async()=>{while(next<hosts.length)await scanHost(hosts[next++]);}));
        this.logger.info(`Scan completed. Discovered ${discoveredAssets.length} active assets.`);

        return discoveredAssets;
      }
    );

    // 4. Shodan-like advanced search parser query handler
    this.registerIpcHandler<{ query: string }, Asset[]>('query', async (payload) => {
      const { query } = payload;
      if (!query || !query.trim()) {
        return this.loadAssetsFromDb();
      }
      return this.searchAssets(query);
    });

    this.logger.info('Asset Discovery Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Asset Discovery Module...');
    this.unregisterIpcHandlers();
  }

  /**
   * Loads assets and their open ports from SQL database.
   */
  private async loadAssetsFromDb(): Promise<Asset[]> {
    const assetsRows = await databaseManager.queryAll<any>('assets', 'SELECT * FROM assets');
    const result: Asset[] = [];

    for (const a of assetsRows) {
      const portRows = await databaseManager.queryAll<any>(
        'assets',
        'SELECT * FROM asset_ports WHERE asset_id = ? AND state = "open"',
        [a.id]
      );

      result.push({
        id: a.id,
        ipAddress: a.ip_address,
        macAddress: a.mac_address || undefined,
        hostname: a.hostname || undefined,
        vendor: a.vendor || undefined,
        osGuess: a.os_guess || undefined,
        deviceType: a.device_type as any,
        firstSeen: a.first_seen,
        lastSeen: a.last_seen,
        isOnline: a.is_online === 1,
        pingLatencyMs: a.ping_latency_ms || undefined,
        riskScore: a.risk_score || 0,
        ports: portRows.map((p) => ({
          port: p.port,
          protocol: p.protocol as any,
          state: p.state as any,
          service: p.service || undefined,
          banner: p.banner || undefined,
          tlsInfo: p.tls_info ? JSON.parse(p.tls_info) : undefined,
          lastSeen: p.last_seen,
        })),
        metadata: a.metadata ? JSON.parse(a.metadata) : undefined,
      });
    }
    return result;
  }

  /**
   * Save or update asset entry in database
   */
  private async saveAssetToDb(asset: Asset): Promise<void> {
    const db = databaseManager.getDb('assets');
    const now = Date.now();

    // Check if asset exists
    const existing = await databaseManager.queryGet<{ first_seen: number }>(
      'assets',
      'SELECT first_seen FROM assets WHERE id = ?',
      [asset.id]
    );

    const firstSeen = existing ? existing.first_seen : now;

    await databaseManager.queryRun(
      'assets',
      `INSERT INTO assets (
        id, ip_address, mac_address, hostname, vendor, os_guess, device_type, first_seen, last_seen, is_online, ping_latency_ms, risk_score, fingerprint, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        ip_address = ?,
        hostname = COALESCE(?, hostname),
        last_seen = ?,
        is_online = ?,
        ping_latency_ms = ?,
        risk_score = ?,
        metadata = ?`,
      [
        asset.id,
        asset.ipAddress,
        asset.macAddress || null,
        asset.hostname || null,
        asset.vendor || null,
        asset.osGuess || null,
        asset.deviceType,
        firstSeen,
        now,
        asset.isOnline ? 1 : 0,
        asset.pingLatencyMs ?? null,
        asset.riskScore,
        JSON.stringify(asset.ports),
        asset.metadata ? JSON.stringify(asset.metadata) : null,
        // Updates:
        asset.ipAddress,
        asset.hostname || null,
        now,
        asset.isOnline ? 1 : 0,
        asset.pingLatencyMs ?? null,
        asset.riskScore,
        asset.metadata ? JSON.stringify(asset.metadata) : null,
      ]
    );

    // Save ports. Remove old records first.
    await databaseManager.queryRun('assets', 'DELETE FROM asset_ports WHERE asset_id = ?', [asset.id]);

    for (const p of asset.ports) {
      await databaseManager.queryRun(
        'assets',
        `INSERT INTO asset_ports (asset_id, port, protocol, state, service, banner, tls_info, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          asset.id,
          p.port,
          p.protocol,
          p.state,
          p.service || null,
          p.banner || null,
          p.tlsInfo ? JSON.stringify(p.tlsInfo) : null,
          now,
        ]
      );
    }
  }

  /**
   * Shodan-like advanced search parser translating criteria to SQL queries.
   */
  private async searchAssets(searchQuery: string): Promise<Asset[]> {
    // Parse filters: e.g. "port:22 os:windows service:ssh cisco"
    const terms = searchQuery.split(/\s+/).filter((t) => t.trim().length > 0);
    
    const portFilters: number[] = [];
    let osFilter: string | null = null;
    let serviceFilter: string | null = null;
    let vendorFilter: string | null = null;
    const textFilters: string[] = [];

    for (const term of terms) {
      if (term.includes(':')) {
        const [key, val] = term.split(':');
        const value = val.toLowerCase().replace(/['"]/g, '');
        
        if (key === 'port') {
          const pNum = parseInt(value, 10);
          if (!isNaN(pNum)) portFilters.push(pNum);
        } else if (key === 'os') {
          osFilter = value;
        } else if (key === 'service') {
          serviceFilter = value;
        } else if (key === 'vendor') {
          vendorFilter = value;
        }
      } else {
        textFilters.push(term.toLowerCase());
      }
    }

    // Build SQLite Query
    let sql = `SELECT DISTINCT a.id FROM assets a 
               LEFT JOIN asset_ports p ON a.id = p.asset_id 
               WHERE 1=1`;
    const params: any[] = [];

    if (portFilters.length > 0) {
      const placeholders = portFilters.map(() => '?').join(',');
      sql += ` AND p.port IN (${placeholders}) AND p.state = 'open'`;
      params.push(...portFilters);
    }

    if (osFilter) {
      sql += ` AND LOWER(a.os_guess) LIKE ?`;
      params.push(`%${osFilter}%`);
    }

    if (serviceFilter) {
      sql += ` AND LOWER(p.service) LIKE ?`;
      params.push(`%${serviceFilter}%`);
    }

    if (vendorFilter) {
      sql += ` AND LOWER(a.vendor) LIKE ?`;
      params.push(`%${vendorFilter}%`);
    }

    // Text queries match hostname or IP address
    for (const text of textFilters) {
      sql += ` AND (LOWER(a.hostname) LIKE ? OR LOWER(a.ip_address) LIKE ? OR LOWER(a.vendor) LIKE ?)`;
      params.push(`%${text}%`, `%${text}%`, `%${text}%`);
    }

    try {
      const rows = await databaseManager.queryAll<{ id: string }>('assets', sql, params);
      const allAssets = await this.loadAssetsFromDb();
      // Filter list loaded in RAM by matched IDs
      const matchedIds = new Set(rows.map((r) => r.id));
      return allAssets.filter((a) => matchedIds.has(a.id));
    } catch (err: any) {
      this.logger.error('Search assets query failed', { error: err.message });
      return [];
    }
  }

  /**
   * Reverse lookup local hostname from local DNS / NetBIOS or default to empty.
   */
  private resolveHostname(ip: string): Promise<string> {
    return new Promise((resolve) => {
      const dns = require('dns');
      dns.reverse(ip, (err: any, hostnames: string[]) => {
        if (!err && hostnames && hostnames.length > 0) {
          resolve(hostnames[0]);
        } else {
          resolve('');
        }
      });
    });
  }

  private guessOS(openPorts: any[], ipAddress: string): string {
    const ports = openPorts.map((p) => p.port);
    if (ports.includes(445) || ports.includes(139) || ports.includes(135)) {
      return 'Windows OS (Guess)';
    }
    if (ports.includes(22)) {
      return 'Linux / Unix (Guess)';
    }
    if (ports.includes(80) || ports.includes(443)) {
      return 'Web Server OS';
    }
    return 'Unknown OS';
  }

  private classifyDevice(openPorts: any[], os: string, vendor: string): Asset['deviceType'] {
    const lowerVendor = vendor.toLowerCase();
    if (lowerVendor.includes('cisco') || lowerVendor.includes('ubiquiti') || lowerVendor.includes('netgear')) {
      return 'router';
    }
    if (lowerVendor.includes('synology')) {
      return 'nas';
    }
    if (lowerVendor.includes('vmware') || lowerVendor.includes('parallels')) {
      return 'vm';
    }
    const ports = openPorts.map((p) => p.port);
    if (ports.includes(9100) || ports.includes(631)) {
      return 'printer';
    }
    if (ports.includes(445) || ports.includes(3389) || os.includes('Windows')) {
      if (ports.includes(1433) || ports.includes(80) || ports.includes(443)) {
        return 'server';
      }
      return 'client';
    }
    return 'unknown';
  }

  private calculateInitialRisk(openPorts: any[]): number {
    let score = 5;
    const ports = openPorts.map((p) => p.port);
    if (ports.includes(23)) score += 30; // Telnet open
    if (ports.includes(21)) score += 20; // FTP open
    if (ports.includes(445)) score += 15; // SMB exposed
    if (ports.includes(3389)) score += 10; // RDP open
    return Math.min(score, 100);
  }
}
export default AssetDiscoveryModule;
