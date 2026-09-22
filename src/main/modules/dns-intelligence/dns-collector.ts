import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('dns');
/**
 * DNS Collector — Local DNS cache & query monitoring.
 * 
 * Reads local DNS cache via ipconfig /displaydns and PowerShell
 * Get-DnsClientCache cmdlet. Analyzes domain patterns offline
 * for anomaly detection (DGA, long domains, rare TLDs, etc.)
 */

const exec = trackedExec('dns');
import { createModuleLogger } from '../../core/logger';
import { DnsQueryRecord } from '../../../shared/types/dns.types';

const log = createModuleLogger('dns-collector');

// Known safe top-level domains (common ones)
const COMMON_TLDS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'io', 'co', 'us', 'uk', 'de', 'fr',
  'ca', 'au', 'jp', 'ru', 'br', 'in', 'cn', 'nl', 'se', 'it', 'es', 'pl', 'tr',
  'me', 'dev', 'app', 'info', 'biz', 'cloud', 'tech', 'ai', 'xyz',
]);

// Suspicious TLDs often used in phishing
const SUSPICIOUS_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'buzz', 'work', 'icu', 'cam', 'click',
  'link', 'surf', 'live', 'monster', 'quest', 'rest',
]);

// PowerShell command stored as a single line to avoid template literal issues
const PS_DNS_COMMAND = 'try { Get-DnsClientCache -ErrorAction Stop | Select-Object Entry, RecordType, TimeToLive, Data, Status | ForEach-Object { [PSCustomObject]@{ name = $_.Entry; type = switch($_.RecordType) { 1 {\"A\"} 5 {\"CNAME\"} 28 {\"AAAA\"} 12 {\"PTR\"} 15 {\"MX\"} 33 {\"SRV\"} default {\"TYPE_\" + $_.RecordType} }; ttl = $_.TimeToLive; data = if($_.Data){$_.Data}else{\"\"}; status = $_.Status.ToString() } } | ConvertTo-Json -Compress -Depth 3 } catch { @() | ConvertTo-Json }';

export class DnsCollector {
  /**
   * Fetch DNS cache entries from the local system.
   * Uses PowerShell Get-DnsClientCache for structured data.
   */
  public static async fetchDnsCache(): Promise<DnsQueryRecord[]> {
    return new Promise((resolve) => {
      runPowerShell(PS_DNS_COMMAND,
        { maxBuffer: 1024 * 1024 * 4 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            log.warn('Get-DnsClientCache unavailable, falling back to ipconfig /displaydns');
            return this.fetchDnsCacheFallback().then(resolve);
          }

          try {
            const raw = JSON.parse(stdout);
            const entries = Array.isArray(raw) ? raw : [raw];
            const now = Date.now();

            const records: DnsQueryRecord[] = entries
              .filter((e: any) => e && e.name)
              .map((e: any, idx: number) => {
                const analysis = this.analyzeDomain(e.name);
                return {
                  id: idx,
                  timestamp: now,
                  queryName: e.name,
                  queryType: e.type || 'A',
                  response: e.data || '',
                  ttl: e.ttl || 0,
                  sourceIp: undefined,
                  pid: undefined,
                  processName: undefined,
                  isRare: analysis.isRare,
                  riskLevel: analysis.riskLevel,
                  tags: analysis.tags,
                };
              });

            resolve(records);
          } catch (parseErr: any) {
            log.error('Failed to parse DNS cache output', { error: parseErr.message });
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Fallback: parse ipconfig /displaydns output.
   */
  private static fetchDnsCacheFallback(): Promise<DnsQueryRecord[]> {
    return new Promise((resolve) => {
      exec('ipconfig /displaydns', { maxBuffer: 1024 * 1024 * 4 }, (err, stdout) => {
        if (err || !stdout) {
          log.error('ipconfig /displaydns failed', { error: err?.message });
          return resolve([]);
        }

        const records: DnsQueryRecord[] = [];
        const now = Date.now();
        const lines = stdout.split('\n');

        let currentName = '';
        let currentType = 'A';
        let currentData = '';
        let currentTtl = 0;
        let idx = 0;

        for (const line of lines) {
          const trimmed = line.trim();

          const nameMatch = trimmed.match(/Record Name[\s.]*:\s*(.+)/i);
          if (nameMatch) {
            currentName = nameMatch[1].trim();
          }

          const typeMatch = trimmed.match(/Record Type[\s.]*:\s*(\d+)/i);
          if (typeMatch) {
            const typeNum = parseInt(typeMatch[1], 10);
            if (typeNum === 1) currentType = 'A';
            else if (typeNum === 5) currentType = 'CNAME';
            else if (typeNum === 28) currentType = 'AAAA';
            else if (typeNum === 12) currentType = 'PTR';
            else currentType = 'TYPE_' + typeNum;
          }

          const ttlMatch = trimmed.match(/Time To Live[\s.]*:\s*(\d+)/i);
          if (ttlMatch) {
            currentTtl = parseInt(ttlMatch[1], 10);
          }

          // Match data lines like "A (Host) Record . . . : 1.2.3.4"
          const dataMatch = trimmed.match(/(?:A \(Host\)|AAAA|CNAME|PTR)\s+Record[\s.]*:\s*(.+)/i);
          if (dataMatch && currentName) {
            currentData = dataMatch[1].trim();
            const analysis = this.analyzeDomain(currentName);

            records.push({
              id: idx++,
              timestamp: now,
              queryName: currentName,
              queryType: currentType,
              response: currentData,
              ttl: currentTtl,
              sourceIp: undefined,
              pid: undefined,
              processName: undefined,
              isRare: analysis.isRare,
              riskLevel: analysis.riskLevel,
              tags: analysis.tags,
            });

            // Reset for next entry
            currentName = '';
            currentType = 'A';
            currentData = '';
            currentTtl = 0;
          }
        }

        resolve(records);
      });
    });
  }

  /**
   * Analyze a domain name for suspicious characteristics.
   * Entirely offline heuristic analysis.
   */
  public static analyzeDomain(domain: string): {
    isRare: boolean;
    riskLevel: 'safe' | 'suspicious' | 'malicious';
    tags: string[];
    entropy: number;
  } {
    const tags: string[] = [];
    let riskPoints = 0;

    // Strip trailing dot
    const d = domain.replace(/\.$/, '').toLowerCase();
    const parts = d.split('.');
    const tld = parts[parts.length - 1];
    const sld = parts.length >= 2 ? parts[parts.length - 2] : '';
    const subdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : '';

    // 1. Check TLD reputation
    if (SUSPICIOUS_TLDS.has(tld)) {
      riskPoints += 25;
      tags.push('suspicious-tld');
    } else if (!COMMON_TLDS.has(tld)) {
      riskPoints += 5;
      tags.push('uncommon-tld');
    }

    // 2. Check domain length (> 30 chars is unusual)
    if (d.length > 50) {
      riskPoints += 20;
      tags.push('very-long-domain');
    } else if (d.length > 30) {
      riskPoints += 10;
      tags.push('long-domain');
    }

    // 3. Shannon entropy check (high entropy = possible DGA)
    const entropy = this.shannonEntropy(sld);
    if (entropy > 4.0) {
      riskPoints += 30;
      tags.push('high-entropy');
    } else if (entropy > 3.5) {
      riskPoints += 15;
      tags.push('moderate-entropy');
    }

    // 4. Excessive subdomain depth
    if (parts.length > 5) {
      riskPoints += 15;
      tags.push('deep-subdomains');
    }

    // 5. Numeric domain pattern (e.g. 1234567890.com)
    if (/^\d+$/.test(sld)) {
      riskPoints += 20;
      tags.push('numeric-domain');
    }

    // 6. Excessive hyphens or numbers in subdomain
    if (subdomain) {
      const hyphenCount = (subdomain.match(/-/g) || []).length;
      if (hyphenCount > 3) {
        riskPoints += 10;
        tags.push('hyphen-heavy');
      }
    }

    // 7. Mixed alpha-numeric patterns (DGA-like)
    const consonantRatio = (sld.replace(/[aeiou\d\-_.]/gi, '').length) / Math.max(sld.length, 1);
    if (consonantRatio > 0.7 && sld.length > 8) {
      riskPoints += 20;
      tags.push('dga-pattern');
    }

    // Determine risk level
    let riskLevel: 'safe' | 'suspicious' | 'malicious' = 'safe';
    if (riskPoints >= 50) riskLevel = 'malicious';
    else if (riskPoints >= 20) riskLevel = 'suspicious';

    const isRare = riskPoints >= 15 || !COMMON_TLDS.has(tld);

    return { isRare, riskLevel, tags, entropy };
  }

  /**
   * Calculate Shannon entropy for a string.
   * Higher values indicate more randomness (potentially DGA-generated).
   */
  public static shannonEntropy(str: string): number {
    if (!str || str.length === 0) return 0;

    const freq = new Map<string, number>();
    for (const char of str) {
      freq.set(char, (freq.get(char) || 0) + 1);
    }

    let entropy = 0;
    for (const count of freq.values()) {
      const p = count / str.length;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }
}
