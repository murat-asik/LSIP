import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('certs');
/**
 * Certificate Collector — Enumerates Windows Certificate Store.
 * Uses PowerShell to query Cert:\LocalMachine and Cert:\CurrentUser.
 */

const exec = trackedExec('certs');
import { createModuleLogger } from '../../core/logger';
import { CertEntry } from '../../../shared/types/cert.types';

const log = createModuleLogger('cert-collector');

export class CertCollector {
  public static async getCertificates(): Promise<CertEntry[]> {
    return new Promise((resolve) => {
      const psCmd = [
        'Get-ChildItem -Path Cert:\\ -Recurse -ErrorAction SilentlyContinue |',
        'Where-Object { $_.Thumbprint -ne $null } |',
        'Select-Object -First 500 |',
        'ForEach-Object {',
        '  [PSCustomObject]@{',
        '    tp = $_.Thumbprint;',
        '    sub = $_.Subject;',
        '    iss = $_.Issuer;',
        '    loc = $_.PSParentPath;',
        '    nb = if($_.NotBefore){$_.NotBefore.ToString("o")}else{""};',
        '    na = if($_.NotAfter){$_.NotAfter.ToString("o")}else{""};',
        '    hasPk = $_.HasPrivateKey;',
        '    alg = if($_.SignatureAlgorithm){$_.SignatureAlgorithm.FriendlyName}else{""};',
        '  }',
        '} | ConvertTo-Json -Compress',
      ].join('\n');

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 * 8 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            log.warn('Failed to enumerate certificates');
            return resolve([]);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];
            const now = Date.now();

            const certs: CertEntry[] = items
              .filter((c: any) => c && c.tp)
              .map((c: any) => {
                const notAfter = c.na ? new Date(c.na).getTime() : 0;
                const notBefore = c.nb ? new Date(c.nb).getTime() : 0;
                const isSelfSigned = c.sub === c.iss;
                const isExpired = notAfter > 0 && notAfter < now;
                
                // Extract clean location (e.g., Microsoft.PowerShell.Security\Certificate::LocalMachine\My)
                let storeLoc = c.loc || '';
                const match = storeLoc.match(/::(.*)$/);
                if (match) storeLoc = match[1];

                return {
                  thumbprint: c.tp,
                  subject: c.sub || 'Unknown',
                  issuer: c.iss || 'Unknown',
                  storeName: storeLoc.split('\\').pop() || 'Unknown',
                  storeLocation: storeLoc,
                  notBefore,
                  notAfter,
                  hasPrivateKey: !!c.hasPk,
                  isSelfSigned,
                  isExpired,
                  algorithm: c.alg || 'Unknown',
                };
              });

            resolve(certs);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }
}
