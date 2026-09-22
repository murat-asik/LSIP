import { runPowerShell } from '../../core/powershell';
import { exec } from 'child_process';
import { SecurityEvent } from '../../../shared/types/event.types';
import { createModuleLogger } from '../../core/logger';

const log = createModuleLogger('event-collector');

export class EventCollector {
  /**
   * Fetch recent event logs from Windows.
   * Handles errors gracefully (e.g. access denied on Security log or missing Sysmon log).
   */
  public static fetchRecentEvents(maxEvents = 100): Promise<SecurityEvent[]> {
    return new Promise((resolve, reject) => {
      // Optimized Powershell block querying different channels with limit and error ignoring
      const psCommand = `
        $events = @()
        
        # 1. Security Logs (Logon success/fail, Audit clear, Process Create)
        try {
          $sec = Get-WinEvent -FilterHashtable @{LogName='Security'; Id=@(4624, 4625, 4688, 1102, 4672, 4634)} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          if ($sec) { $events += $sec }
        } catch {}

        # 2. System Logs (Service Installed)
        try {
          $sys = Get-WinEvent -FilterHashtable @{LogName='System'; Id=@(7045, 7040, 7036, 104)} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          if ($sys) { $events += $sys }
        } catch {}

        # 3. Application Logs
        try {
          $app = Get-WinEvent -FilterHashtable @{LogName='Application'} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          if ($app) { $events += $app }
        } catch {}

        # 4. Setup Logs
        try {
          $setup = Get-WinEvent -FilterHashtable @{LogName='Setup'} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          if ($setup) { $events += $setup }
        } catch {}

        # 5. Sysmon Logs (Process Create, Network Connection)
        try {
          $sysmon = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Sysmon/Operational'; Id=@(1, 3)} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          if ($sysmon) { $events += $sysmon }
        } catch {}

        # Format output
        $results = foreach ($e in $events) {
          $xml = [xml]$e.ToXml()
          $eventData = @{}
          if ($xml.Event.EventData.Data) {
            foreach ($data in $xml.Event.EventData.Data) {
              $name = $data.Name
              if ($name) { $eventData[$name] = $data.'#text' }
            }
          }
          
          [PSCustomObject]@{
            eventId = $e.Id
            recordId = [string]$e.RecordId
            source = $e.LogName
            level = $e.Level
            timestamp = $e.TimeCreated.ToUniversalTime().ToString('o')
            computer = $e.MachineName
            userSid = $(try { $e.UserId.Value } catch { "" })
            userName = $(try { $xml.Event.System.Security.UserID } catch { "" })
            message = $e.Message
            xmlData = $e.ToXml()
            parsedData = $eventData | ConvertTo-Json -Compress
          }
        }
        $results | ConvertTo-Json -Compress
      `;

      runPowerShell(psCommand, (err, stdout) => {
        if (err) return reject(err);
        if (!stdout.trim()) {
          log.warn('No event logs fetched or access denied to primary log sources.');
          return resolve([]);
        }

        try {
          const parsed = JSON.parse(stdout);
          const rawEvents = Array.isArray(parsed) ? parsed : [parsed];
          
          const result: SecurityEvent[] = rawEvents
            .filter((e) => e && e.eventId)
            .map((e, idx) => {
              // Convert Windows FileTime to Unix epoch millisecond timestamp
              // FileTime is 100-nanosecond intervals since Jan 1, 1601.
              const unixMs = typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : Math.floor(Number(e.timestamp) / 10000 - 11644473600000);
              if (!Number.isFinite(unixMs)) throw new Error('Invalid event timestamp');

              let parsedData = {};
              try {
                if (e.parsedData) parsedData = JSON.parse(e.parsedData);
              } catch {}

              // Extract user name if missing from parsed data
              let userName = e.userName || 'N/A';
              if (parsedData && (parsedData as any).TargetUserName) {
                userName = (parsedData as any).TargetUserName;
              }

              return {
                id: idx + 1, // temporary ID
                eventId: e.eventId,
                recordId: e.recordId,
                source: e.source,
                level: e.level || 0,
                timestamp: unixMs,
                computer: e.computer,
                userSid: e.userSid || undefined,
                userName,
                message: e.message || '',
                xmlData: e.xmlData || undefined,
                parsedData,
                isBookmarked: false,
              };
            });

          resolve(result);
        } catch (e: any) {
          log.error('Failed to parse event logs JSON output', { error: e.message });
          reject(e);
        }
      });
    });
  }
}
