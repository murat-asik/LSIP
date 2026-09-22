import { lookupRegistration } from './rdap-service';
import { host as validateHost, integer } from '../../core/security';
import { ipcMain } from 'electron';
import { BaseModule } from '../base-module';
import { databaseManager } from '../../core/database-manager';
import net from 'net';
import tls from 'tls';
import dns from 'dns';
import http from 'http';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class RedTeamModule extends BaseModule {
  private scanRunning = false;
  public readonly name = 'redteam';
  public readonly displayName = 'Red Team Reconnaissance & Security Audit';
  public readonly version = '1.0.0';

  public async initialize(): Promise<void> {
    this.initLogger();
    this.registerIpcHandlers();
    this.logger.info('Red Team module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.unregisterIpcHandlers();
    this.logger.info('Red Team module shut down.');
  }

  private registerIpcHandlers() {
    // 1. Check Nmap Availability
    this.registerRawIpcHandler('redteam:check-nmap', async () => {
      try {
        const cmd = process.platform === 'win32' ? 'where nmap' : 'which nmap';
        await execAsync(cmd);
        return { available: true, message: 'Nmap sistemi üzerinde kurulu ve kullanılabilir.' };
      } catch {
        return { available: false, message: 'Nmap bulunamadı. Yerel Node.js tarama motoru aktif.' };
      }
    });

    // 2. Native Port Scanner & Service Enumerator & Banner Grabber
    this.registerRawIpcHandler('redteam:scan-ports', async (_event, { target, ports = [21, 22, 25, 53, 80, 110, 143, 443, 445, 1433, 3306, 3389, 5432, 6379, 8080, 27017] }: { target: string; ports?: number[] }) => {
      target = validateHost(target);
      if (!Array.isArray(ports) || ports.length > 1024) throw new Error('En fazla 1024 port girilebilir.');
      ports = [...new Set(ports.map(p => integer(p, 'Port', 65535)))];
      if (this.scanRunning) throw new Error('Önce mevcut port taramasının bitmesini bekleyin.');
      this.scanRunning = true;
      const scanId = 'SCAN-' + require('crypto').randomUUID();
      const results: any[] = [];

      try {
        await databaseManager.queryRun('redteam', `
          INSERT INTO redteam_scans (id, target, scan_type, status, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [scanId, target, 'PORT_SCAN', 'RUNNING', Date.now()]);

        const scanPort = (port: number) => new Promise<any>((resolve) => {
          const startTime = Date.now();
          const socket = new net.Socket();

          let connected = false;
          socket.setTimeout(2000);

          socket.on('connect', () => {
            connected = true;
            const latency = Date.now() - startTime;
            let service = this.detectServiceByPort(port);
            let banner = '';

            if (port === 80 || port === 8080) {
              socket.write('HEAD / HTTP/1.0\r\nHost: ' + target + '\r\n\r\n');
            } else {
              socket.write('\r\n');
            }

            socket.on('data', (data) => {
              banner = data.toString('utf8').trim().split('\r\n')[0].substring(0, 100);
              socket.destroy();
            });

            socket.on('close', async () => {
              const res = {
                scanId,
                ip: target,
                port,
                protocol: 'tcp',
                state: 'open',
                service,
                banner: banner || `TCP ${port} portunda servis dinleniyor`,
                latencyMs: latency,
              };
              resolve(res);
            });
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve({ scanId, ip: target, port, protocol: 'tcp', state: connected ? 'open' : 'filtered', service: this.detectServiceByPort(port), banner: '', latencyMs: 2000 });
          });

          socket.on('error', () => {
            socket.destroy();
            resolve({ scanId, ip: target, port, protocol: 'tcp', state: 'closed', service: this.detectServiceByPort(port), banner: '', latencyMs: 0 });
          });

          socket.connect(port, target);
        });
        const scannedPorts: any[] = [];
        let cursor = 0;
        await Promise.all(Array.from({ length: Math.min(16, ports.length) }, async () => {
          while (cursor < ports.length) {
            const port = ports[cursor++];
            scannedPorts.push(await scanPort(port));
          }
        }));

        for (const p of scannedPorts) {
          if (p.state === 'open') {
            await databaseManager.queryRun('redteam', `
              INSERT INTO redteam_ports (scan_id, ip, port, protocol, state, service, banner, latency_ms)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [scanId, p.ip, p.port, p.protocol, p.state, p.service, p.banner, p.latencyMs]);
            results.push(p);
          }
        }

        await databaseManager.queryRun('redteam', `
          UPDATE redteam_scans SET status = 'COMPLETED', completed_at = ?, summary = ? WHERE id = ?
        `, [Date.now(), `${target} üzerinde ${results.length} açık port bulundu`, scanId]);

        return { success: true, scanId, target, openPorts: results };
      } catch (err: any) {
        return { success: false, error: err.message };
      } finally { this.scanRunning = false; }
    });

    // 3. HTTP Security Analyzer
    this.registerRawIpcHandler('redteam:analyze-http', async (_event, { url }: { url: string }) => {
      try {
        if (typeof url !== 'string' || url.length > 4096) throw new Error('Geçersiz URL');
        const parsedUrl = new URL(url.startsWith('http') ? url : `http://${url}`);
        if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) throw new Error('Geçersiz HTTP adresi');
        const client = parsedUrl.protocol === 'https:' ? https : http;

        return new Promise((resolve) => {
          const req = client.request(parsedUrl, { method: 'GET', timeout: 5000 }, async (res) => {
            try {
            const headers = res.headers;
            const statusCode = res.statusCode || 0;
            const server = (headers['server'] as string) || 'Bilinmiyor';
            const poweredBy = (headers['x-powered-by'] as string) || 'Yok';
            const hsts = !!headers['strict-transport-security'];
            const csp = !!headers['content-security-policy'];
            const cors = (headers['access-control-allow-origin'] as string) || 'Yapılandırılmadı';
            const xfo = (headers['x-frame-options'] as string) || 'Yapılandırılmadı';

            const analysis = {
              url,
              statusCode,
              server,
              poweredBy,
              securityHeaders: {
                hsts,
                csp,
                xfo,
                cors,
                contentTypeOptions: !!headers['x-content-type-options'],
                referrerPolicy: headers['referrer-policy'] || 'Eksik',
              },
              headers,
            };

            res.destroy(); // Only headers are required; do not buffer an arbitrary body.
            const scanId = 'HTTP-' + require('crypto').randomUUID();
            await databaseManager.queryRun('redteam', `
              INSERT INTO redteam_http_analysis (scan_id, target_url, status_code, server, powered_by, hsts, csp, cors, xfo, headers_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [scanId, url, statusCode, server, poweredBy, hsts ? 1 : 0, csp ? 1 : 0, cors, xfo, JSON.stringify(headers)]);

            resolve({ success: true, data: analysis });
            } catch { res.destroy(); resolve({ success: false, error: 'HTTP analizi kaydedilemedi.' }); }
          });

          req.on('error', (err) => resolve({ success: false, error: err.message }));
          req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'HTTP İstek Zaman Aşımı' }); });
          req.end();
        });
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    // 4. SSL Inspector
    this.registerRawIpcHandler('redteam:inspect-ssl', async (_event, { host, port = 443 }: { host: string; port?: number }) => {
      host = validateHost(host); integer(port, 'Port', 65535);
      return new Promise((resolve) => {
        const socket = tls.connect(port, host, { rejectUnauthorized: false, servername: host }, async () => {
          try {
            const cert = socket.getPeerCertificate(true);
            const cipher = socket.getCipher();
            const protocol = socket.getProtocol();

            const validFrom = new Date(cert.valid_from).getTime();
            const validTo = new Date(cert.valid_to).getTime();
            const isExpired = Date.now() > validTo;

            const sslInfo = {
              host,
              issuer: cert.issuer ? cert.issuer.O || cert.issuer.CN : 'Bilinmiyor',
              subject: cert.subject ? cert.subject.CN : 'Bilinmiyor',
              sanList: cert.subjectaltname ? cert.subjectaltname.split(', ') : [],
              cipher: cipher.name,
              tlsVersion: protocol || 'Bilinmiyor',
              keySize: cert.bits || null,
              authorized: socket.authorized,
              authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
              validFrom,
              validTo,
              isExpired,
              fingerprint: cert.fingerprint256,
            };

            const scanId = `SSL-${Date.now()}`;
            await databaseManager.queryRun('redteam', `
              INSERT INTO redteam_ssl_inspection (scan_id, target_host, issuer, subject, san_list, cipher, tls_version, key_size, valid_from, valid_to, is_expired)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [scanId, host, sslInfo.issuer, sslInfo.subject, JSON.stringify(sslInfo.sanList), sslInfo.cipher, sslInfo.tlsVersion, sslInfo.keySize, validFrom, validTo, isExpired ? 1 : 0]);

            socket.destroy();
            resolve({ success: true, data: sslInfo });
          } catch (err: any) {
            socket.destroy();
            resolve({ success: false, error: err.message });
          }
        });

        socket.setTimeout(5000, () => { socket.destroy(); resolve({ success: false, error: 'TLS zaman aşımı' }); });
        socket.on('error', (err) => { socket.destroy(); resolve({ success: false, error: err.message }); });
      });
    });

    // 5. DNS Intelligence
    this.registerRawIpcHandler('redteam:get-dns-intelligence', async (_event, { domain }: { domain: string }) => {
      try {
        domain = validateHost(domain);
        if (net.isIP(domain)) throw new Error('A domain name is required');
        const resolver = new dns.promises.Resolver({ timeout: 3000, tries: 1 });
        const warnings: Record<string, string> = {};
        let answered = 0;
        const query = async (type: string, fn: () => Promise<any>, empty: any) => {
          try { const value = await fn(); answered++; return value; }
          catch (error: any) { warnings[type] = error.code || 'DNS_QUERY_FAILED'; return empty; }
        };
        const [a, aaaa, mx, txt, ns, caa, soa, dmarcTxt] = await Promise.all([
          query('A', () => resolver.resolve4(domain), []),
          query('AAAA', () => resolver.resolve6(domain), []),
          query('MX', () => resolver.resolveMx(domain), []),
          query('TXT', () => resolver.resolveTxt(domain), []),
          query('NS', () => resolver.resolveNs(domain), []),
          query('CAA', () => resolver.resolveCaa(domain), []),
          query('SOA', () => resolver.resolveSoa(domain), null),
          query('DMARC', () => resolver.resolveTxt(`_dmarc.${domain}`), []),
        ]);
        if (!answered) throw new Error('DNS lookup failed: ' + [...new Set(Object.values(warnings))].join(', '));
        const txtStrings = (txt as string[][]).map(t => t.join(''));
        const spf = txtStrings.find(t => t.startsWith('v=spf1')) || 'SPF kaydı bulunamadı';
        const dmarc = (dmarcTxt as string[][]).map(t => t.join('')).join('; ') || 'DMARC kaydı bulunamadı';
        let registration: any;
        try { registration = { success: true, ...await lookupRegistration(domain) }; }
        catch (error: any) { registration = { success: false, error: error.message }; }
        const dnsData = {
          domain, warnings, registration,
          records: {
            A: a,
            AAAA: aaaa,
            MX: mx,
            TXT: txtStrings,
            NS: ns,
            CAA: caa,
            SOA: soa,
            SPF: spf,
            DMARC: dmarc,
          }
        };

        return { success: true, data: dnsData };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    // 6. Attack Surface Graph & Misconfigurations & CVEs
    this.registerRawIpcHandler('redteam:get-attack-surface', async (_event, { target }: { target: string }) => {
      try {
        target = validateHost(target);
        const scan = await databaseManager.queryGet<any>('redteam', "SELECT id, completed_at FROM redteam_scans WHERE target = ? AND scan_type = 'PORT_SCAN' AND status = 'COMPLETED' ORDER BY created_at DESC LIMIT 1", [target]);
        const ports = scan ? await databaseManager.queryAll<any>('redteam', "SELECT * FROM redteam_ports WHERE scan_id = ? AND state = 'open'", [scan.id]) : [];
        const httpRows = await databaseManager.queryAll<any>('redteam', 'SELECT * FROM redteam_http_analysis ORDER BY rowid DESC LIMIT 500');
        const seen = new Set<string>();
        const relevant = httpRows.filter(row => {
          try {
            const u = new URL(row.target_url.startsWith('http') ? row.target_url : 'http://' + row.target_url);
            if (u.hostname.toLowerCase() !== target.toLowerCase() || seen.has(u.href)) return false;
            seen.add(u.href); return true;
          } catch { return false; }
        });
        const misconfigs: any[] = [];
        for (const row of relevant) {
          if (row.hsts === 0) misconfigs.push({ title: 'HSTS başlığı eksik', severity: 'medium', category: 'HTTP', description: row.target_url, recommendation: 'HTTPS kapsamını doğrulayıp HSTS politikasını değerlendirin.' });
          if (row.csp === 0) misconfigs.push({ title: 'CSP başlığı eksik', severity: 'medium', category: 'HTTP', description: row.target_url, recommendation: 'Uygulamaya uygun CSP belirleyin.' });
        }
        const attackSurface = {
          target, provenance: scan || relevant.length ? 'recorded-measurements' : 'unknown',
          measuredAt: scan?.completed_at || null,
          nodes: [{ id: target, type: 'IP', label: target, risk: 'unknown' }, ...ports.map(p => ({ id: target + ':' + p.port, type: 'Port', label: (p.service || 'TCP') + ' (' + p.port + ')', risk: 'unknown' }))],
          edges: ports.map(p => ({ source: target, target: target + ':' + p.port })),
          misconfigurations: misconfigs, cveMatches: [],
          coverage: 'Kayıtlı port ve HTTP ölçümleri kullanılır. CVE eşleştirme yapılmadı.'
        };
        return { success: true, data: attackSurface };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });
  }

  private detectServiceByPort(port: number): string {
    const services: Record<number, string> = {
      21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
      80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 445: 'SMB',
      1433: 'MSSQL', 1521: 'Oracle DB', 3306: 'MySQL', 3389: 'RDP',
      5432: 'PostgreSQL', 6379: 'Redis', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt',
      27017: 'MongoDB',
    };
    return services[port] || 'Bilinmeyen Servis';
  }
}
