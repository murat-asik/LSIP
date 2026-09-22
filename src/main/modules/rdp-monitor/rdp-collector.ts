import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('rdp');
import { integer } from '../../core/security';
/**
 * RDP Collector — Monitors RDP sessions and login events.
 * Uses qwinsta for active sessions and PowerShell for event log queries.
 */

const exec = trackedExec('rdp');
import { createModuleLogger } from '../../core/logger';
import { RdpSession, RdpLoginEvent } from '../../../shared/types/rdp.types';

const log = createModuleLogger('rdp-collector');

// RDP-related Event IDs from Security and TerminalServices logs
const RDP_EVENT_MAP: Record<number, { type: 'success' | 'failed' | 'disconnect' | 'reconnect'; severity: 'info' | 'low' | 'medium' | 'high' | 'critical'; label: string }> = {
  4624: { type: 'success', severity: 'info', label: 'Successful RDP Logon (Type 10)' },
  4625: { type: 'failed', severity: 'high', label: 'Failed RDP Logon Attempt' },
  4634: { type: 'disconnect', severity: 'info', label: 'Logoff' },
  4778: { type: 'reconnect', severity: 'low', label: 'Session Reconnected' },
  4779: { type: 'disconnect', severity: 'info', label: 'Session Disconnected' },
  21: { type: 'success', severity: 'info', label: 'RDP Session Logon Succeeded' },
  24: { type: 'disconnect', severity: 'info', label: 'RDP Session Disconnected' },
  25: { type: 'reconnect', severity: 'low', label: 'RDP Session Reconnected' },
  1149: { type: 'success', severity: 'medium', label: 'RDP Network Connection Authentication' },
  1024: { type: 'info' as any, severity: 'info', label: 'RDP Terminal Services Started' },
};

export class RdpCollector {
  /**
   * Get active RDP/console sessions via qwinsta (query session).
   */
  public static async getActiveSessions(): Promise<RdpSession[]> {
    return new Promise((resolve) => {
      exec('qwinsta', (err, stdout) => {
        if (err || !stdout) {
          log.warn('qwinsta unavailable', { error: err?.message });
          return resolve([]);
        }

        const sessions: RdpSession[] = [];
        const lines = stdout.split('\n');
        const now = Date.now();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          // qwinsta output format varies, parse by position
          const sessionName = line.substring(1, 19).trim();
          const username = line.substring(19, 43).trim();
          const sessionId = parseInt(line.substring(43, 48).trim(), 10);
          const state = line.substring(48, 57).trim();
          const sessionType = line.substring(57, 69).trim();

          if (isNaN(sessionId)) continue;

          sessions.push({
            id: i,
            sessionId,
            username: username || 'SYSTEM',
            state: this.mapState(state),
            sourceIp: undefined,
            loginTime: now,
            idleTime: undefined,
            sessionType: sessionName || sessionType || 'Console',
          });
        }

        resolve(sessions);
      });
    });
  }

  /**
   * Query RDP-related events from Windows Event Logs.
   */
  public static async getRdpEvents(maxEvents: number = 100): Promise<RdpLoginEvent[]> {
    integer(maxEvents, 'maxEvents', 1000);
    return new Promise((resolve) => {
      // Query Security Log (4624, 4625, 4778, 4779) AND TerminalServices Logs (21, 24, 25, 1149, 1024)
      const psCmd = `
        try {
          $events = @()
          $events += Get-WinEvent -FilterHashtable @{LogName='Security';ID=4624,4625,4778,4779} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          $events += Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TerminalServices-LocalSessionManager/Operational';ID=21,24,25} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          $events += Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational';ID=1149,1024} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          
          $events | Sort-Object TimeCreated -Descending | Select-Object -First ${maxEvents} | ForEach-Object {
            $xml = [xml]$_.ToXml()
            $eventData = @{}
            if ($xml.Event.EventData.Data) {
              foreach ($data in $xml.Event.EventData.Data) {
                if ($data.Name) { $eventData[$data.Name] = $data.'#text' }
              }
            } elseif ($xml.Event.UserData) {
              $eventData['UserData'] = $xml.Event.UserData.OuterXml
            }
            
            [PSCustomObject]@{
              id = $_.Id
              time = $_.TimeCreated.ToString('o')
              msg = $_.Message.Substring(0, [Math]::Min(500, $_.Message.Length))
              parsed = $eventData | ConvertTo-Json -Compress
            }
          } | ConvertTo-Json -Compress -Depth 3
        } catch { @() | ConvertTo-Json }
      `;

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 * 4 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            log.warn('RDP event log query failed (may need admin)');
            return resolve([]);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];

            const events: RdpLoginEvent[] = items
              .filter((e: any) => e && e.id)
              .map((e: any, idx: number) => {
                const eventInfo = RDP_EVENT_MAP[e.id] || { type: 'success', severity: 'info', label: 'Unknown' };
                const msg = e.msg || '';

                // Parse structured data if available
                let parsed = {};
                try { if (e.parsed) parsed = JSON.parse(e.parsed); } catch {}

                // Extract source IP from message if available (or structured data for 1149)
                let ipMatch = msg.match(/Source Network Address:\s*([\d.]+)/i);
                if (!ipMatch) ipMatch = msg.match(/Source IP Address:\s*([\d.]+)/i);
                let sourceIp = ipMatch ? ipMatch[1] : '';
                if (!sourceIp && (parsed as any).Param3) sourceIp = (parsed as any).Param3; // 1149 Source IP

                let userMatch = msg.match(/Account Name:\s*(\S+)/i);
                if (!userMatch) userMatch = msg.match(/User:\s*(\S+)/i);
                let username = userMatch ? userMatch[1] : 'Unknown';
                if (username === 'Unknown' && (parsed as any).Param1) username = (parsed as any).Param1; // 1149 Username

                return {
                  id: idx,
                  timestamp: new Date(e.time).getTime(),
                  eventType: eventInfo.type,
                  username,
                  sourceIp,
                  eventId: e.id,
                  reason: eventInfo.label,
                  severity: eventInfo.severity,
                };
              })
              // Filter to only RDP-type logins (logon type 10) where possible
              .filter((e: RdpLoginEvent) => e.username !== '-' && e.username !== 'Unknown');

            resolve(events);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  private static mapState(state: string): 'Active' | 'Disconnected' | 'Connected' | 'Idle' | 'Listen' {
    const s = state.toLowerCase();
    if (s.includes('active') || s.includes('aktif')) return 'Active';
    if (s.includes('disc')) return 'Disconnected';
    if (s.includes('conn')) return 'Connected';
    if (s.includes('idle')) return 'Idle';
    if (s.includes('listen')) return 'Listen';
    return 'Active';
  }
}
