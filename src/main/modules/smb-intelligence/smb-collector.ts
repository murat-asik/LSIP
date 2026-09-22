import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('smb');
/**
 * SMB Collector — Enumerates local SMB shares, sessions, and access patterns.
 * Uses PowerShell Get-SmbShare, Get-SmbSession, and net share commands.
 */

const exec = trackedExec('smb');
import { createModuleLogger } from '../../core/logger';
import { SmbShare, SmbSession } from '../../../shared/types/smb.types';

const log = createModuleLogger('smb-collector');

export class SmbCollector {
  /**
   * Enumerate local SMB shares using PowerShell Get-SmbShare or net share fallback.
   */
  public static async getShares(): Promise<SmbShare[]> {
    return new Promise((resolve) => {
      const psCmd = 'try { Get-SmbShare -ErrorAction Stop | Select-Object Name, Path, Description, ShareType, CurrentUsers, ConcurrentUserLimit | ConvertTo-Json -Compress } catch { @() | ConvertTo-Json }';

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            return this.getSharesFallback().then(resolve);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];

            const shares: SmbShare[] = items
              .filter((s: any) => s && s.Name)
              .map((s: any) => ({
                name: s.Name,
                path: s.Path || '',
                description: s.Description || '',
                shareType: this.mapShareType(s.ShareType),
                permissions: [],
                currentUsers: s.CurrentUsers || 0,
                maxUsers: s.ConcurrentUserLimit || 0,
                isHidden: s.Name.endsWith('$'),
              }));

            resolve(shares);
          } catch (parseErr: any) {
            log.error('Failed to parse SMB shares', { error: parseErr.message });
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Fallback: use net share command to list shares.
   */
  private static getSharesFallback(): Promise<SmbShare[]> {
    return new Promise((resolve) => {
      exec('net share', (err, stdout) => {
        if (err || !stdout) {
          log.error('net share failed', { error: err?.message });
          return resolve([]);
        }

        const shares: SmbShare[] = [];
        const lines = stdout.split('\n');
        let pastHeader = false;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('---')) {
            pastHeader = true;
            continue;
          }
          if (!pastHeader || !trimmed || trimmed.startsWith('The command')) continue;

          const parts = trimmed.split(/\s{2,}/);
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const resource = parts[1]?.trim() || '';
            const remark = parts[2]?.trim() || '';

            shares.push({
              name,
              path: resource,
              description: remark,
              shareType: name.endsWith('$') ? 'special' : 'disk',
              permissions: [],
              currentUsers: 0,
              maxUsers: 0,
              isHidden: name.endsWith('$'),
            });
          }
        }

        resolve(shares);
      });
    });
  }

  /**
   * Get active SMB sessions using PowerShell Get-SmbSession.
   */
  public static async getSessions(): Promise<SmbSession[]> {
    return new Promise((resolve) => {
      const psCmd = 'try { Get-SmbSession -ErrorAction Stop | Select-Object SessionId, ClientUserName, ClientComputerName, ConnectedTime, IdleTime, NumOpens | ConvertTo-Json -Compress } catch { @() | ConvertTo-Json }';

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            log.warn('Get-SmbSession unavailable (requires admin)');
            return resolve([]);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];
            const now = Date.now();

            const sessions: SmbSession[] = items
              .filter((s: any) => s && s.SessionId)
              .map((s: any) => ({
                id: s.SessionId,
                username: s.ClientUserName || 'Unknown',
                computerName: (s.ClientComputerName || '').replace(/\\\\/g, ''),
                clientIp: (s.ClientComputerName || '').replace(/\\\\/g, ''),
                connectedTime: s.ConnectedTime || 0,
                idleTime: s.IdleTime || 0,
                openFiles: s.NumOpens || 0,
                timestamp: now,
              }));

            resolve(sessions);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  private static mapShareType(typeValue: any): 'disk' | 'print' | 'ipc' | 'special' {
    const t = String(typeValue).toLowerCase();
    if (t.includes('print')) return 'print';
    if (t.includes('ipc') || t.includes('pipe')) return 'ipc';
    if (t.includes('special')) return 'special';
    return 'disk';
  }
}
