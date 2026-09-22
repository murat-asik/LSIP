import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('connection');
const exec = trackedExec('connection');
import { ActiveConnection } from '../../../shared/types/network.types';
import { createModuleLogger } from '../../core/logger';

const log = createModuleLogger('connection-tracker');

export class ConnectionTracker {
  private static pidToNameMap = new Map<number, string>();

  /**
   * Fetch active TCP/UDP connections via netstat -ano.
   */
  public static getActiveConnections(): Promise<ActiveConnection[]> {
    return new Promise((resolve) => {
      // Fast process list query to map PIDs to Names
      const psCommand = `
        [System.Diagnostics.Process]::GetProcesses() | ForEach-Object {
          [PSCustomObject]@{
            pid = $_.Id
            name = $_.ProcessName
          }
        } | ConvertTo-Json -Compress
      `;

      runPowerShell(psCommand, (err, stdout) => {
        if (!err && stdout.trim()) {
          try {
            const list = JSON.parse(stdout);
            const procs = Array.isArray(list) ? list : [list];
            this.pidToNameMap.clear();
            for (const p of procs) {
              if (p && p.pid) {
                this.pidToNameMap.set(p.pid, p.name);
              }
            }
          } catch {}
        }

        // Now fetch netstat table
        exec('netstat -ano', (netstatErr, netstatStdout) => {
          if (netstatErr) {
            log.error('Failed to execute netstat -ano', { error: netstatErr.message });
            return resolve([]);
          }

          const lines = netstatStdout.split('\n');
          const connections: ActiveConnection[] = [];

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('Active') || trimmed.startsWith('Proto')) {
              continue;
            }

            // Split line by whitespace tokens
            const tokens = trimmed.split(/\s+/);
            if (tokens.length < 4) continue;

            const proto = tokens[0].toUpperCase();
            if (proto !== 'TCP' && proto !== 'UDP') continue;

            let localAddrStr = tokens[1];
            let remoteAddrStr = tokens[2];
            let state: string | undefined;
            let pidStr = '';

            if (proto === 'TCP') {
              state = tokens[3];
              pidStr = tokens[4];
            } else {
              // UDP doesn't have a state field
              pidStr = tokens[3];
            }

            const pid = parseInt(pidStr, 10);
            if (isNaN(pid)) continue;

            const local = this.parseAddress(localAddrStr);
            const remote = this.parseAddress(remoteAddrStr);

            connections.push({
              protocol: proto as 'TCP' | 'UDP',
              localAddress: local.address,
              localPort: local.port,
              remoteAddress: remote.address,
              remotePort: remote.port,
              state: state || undefined,
              pid,
              processName: this.pidToNameMap.get(pid) || 'Unknown',
            });
          }

          resolve(connections);
        });
      });
    });
  }

  /**
   * Helper to parse IPv4/IPv6 port strings: e.g. "127.0.0.1:443" or "[::1]:8080"
   */
  private static parseAddress(addrStr: string): { address: string; port: number } {
    if (!addrStr) return { address: 'Unknown', port: 0 };
    
    // IPv6 syntax check: e.g. [::1]:8080 or [::]:0
    if (addrStr.includes('[') && addrStr.includes(']')) {
      const parts = addrStr.split(']');
      const address = parts[0].replace('[', '');
      const port = parseInt(parts[1].replace(':', ''), 10);
      return { address, port: isNaN(port) ? 0 : port };
    }

    // Standard IPv4 syntax check: e.g. 192.168.1.1:80 or *:*
    const lastColon = addrStr.lastIndexOf(':');
    if (lastColon !== -1) {
      const address = addrStr.substring(0, lastColon);
      const portStr = addrStr.substring(lastColon + 1);
      const port = parseInt(portStr, 10);
      return { address, port: isNaN(port) ? 0 : port };
    }

    return { address: addrStr, port: 0 };
  }
}
