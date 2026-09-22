import { eventIdentity } from './event-identity';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { createModuleLogger } from './logger';
import { databaseManager } from './database-manager';
import path from 'path';

const log = createModuleLogger('etw-consumer');

const MAX_RESTART_ATTEMPTS = 5;
const BASE_RESTART_DELAY_MS = 5_000;

export class EtwConsumer {
  private static psProcess: ChildProcessWithoutNullStreams | null = null;
  private static isRunning = false;
  private static restartAttempts = 0;
  private static restartTimer: NodeJS.Timeout | null = null;
  private static stopped = false;
  private static outputBuffer = '';

  public static start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stopped = false;
    this.outputBuffer = '';

    log.info('Starting ETW/EventLog Consumer...');

    const psScript = `
      [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
      $ProgressPreference = 'SilentlyContinue'
      $query = @"
      <QueryList>
        <Query Id="0" Path="Security">
          <Select Path="Security">*[System[(EventID=4688 or EventID=5156)]]</Select>
        </Query>
        <Query Id="1" Path="Microsoft-Windows-Sysmon/Operational">
          <Select Path="Microsoft-Windows-Sysmon/Operational">*[System[(EventID=1 or EventID=3)]]</Select>
        </Query>
      </QueryList>
"@

      try {
        $logQuery = New-Object System.Diagnostics.Eventing.Reader.EventLogQuery("Security", [System.Diagnostics.Eventing.Reader.PathType]::LogName, $query)
        $logQuery.TolerateQueryErrors = $true
        $watcher = New-Object System.Diagnostics.Eventing.Reader.EventLogWatcher $logQuery
        
        $action = {
          $event = $Event.SourceEventArgs.EventRecord
          if ($null -eq $event) { return }
          $xml = [xml]$event.ToXml()
          $fields = @{}
          foreach ($field in $xml.Event.EventData.Data) { if ($field.Name) { $fields[$field.Name] = $field.'#text' } }
          $json = [PSCustomObject]@{
            EventId = $event.Id
            ProviderName = $event.LogName
            RecordId = [string]$event.RecordId
            TimeCreated = $event.TimeCreated.ToUniversalTime().ToString('o')
            ParsedData = $fields
            Level = $event.Level
            MachineName = $event.MachineName
            Message = $event.FormatDescription()
          } | ConvertTo-Json -Compress -Depth 5
          
          Write-Host $json
        }

        Register-ObjectEvent -InputObject $watcher -EventName "EventRecordWritten" -SourceIdentifier "ETWConsumer" -Action $action | Out-Null
        $watcher.Enabled = $true
        
        while ($true) { Start-Sleep -Seconds 1 }
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

    try {
      const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
      this.psProcess = spawn(executable, ['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(psScript,'utf16le').toString('base64')],{windowsHide:true});
    } catch (err: any) {
      log.error('Failed to spawn PowerShell ETW consumer', { error: err.message });
      this.isRunning = false;
      this.scheduleRestart();
      return;
    }

    const stream = this.psProcess.stdout;
    stream.setEncoding('utf8');
    stream.on('data', async (data) => {
      stream.pause();
      try {
      this.outputBuffer += data.toString('utf8');
      if(this.outputBuffer.length>4*1024*1024){this.outputBuffer='';log.warn('Oversized event stream record discarded');return;}
      const lines = this.outputBuffer.split('\n');
      this.outputBuffer=lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const evt = JSON.parse(line.trim());
          this.restartAttempts=0;
          const now = Date.parse(evt.TimeCreated) || Date.now();

          await databaseManager.queryRun('events',
            `INSERT OR IGNORE INTO events (event_id, source, level, timestamp, message, computer, user_name, user_sid, parsed_data, event_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              evt.EventId,
              evt.ProviderName,
              evt.Level || 4,
              now,
              evt.Message || '',
              evt.MachineName || 'Unknown',
              'N/A',
              'N/A',
              JSON.stringify(evt.ParsedData || {}),
              eventIdentity(evt.MachineName || 'Unknown', evt.ProviderName, evt.RecordId, now, evt.EventId, evt.Message || ''),
            ]
          );

        } catch (error: any) {
          log.warn('Event stream record could not be persisted', { error: error.message });
        }
      }
      } finally { stream.resume(); }
    });

    this.psProcess.stderr.on('data', (data) => {
      log.warn('ETW Consumer Warn', { output: data.toString() });
    });
    this.psProcess.on('error',error=>{log.error('Event consumer process error',{error:error.message});this.isRunning=false;this.scheduleRestart();});

    this.psProcess.on('close', (code) => {
      log.warn(`ETW Consumer exited with code ${code}`);
      this.isRunning = false;
      this.psProcess = null;

      // Exponential backoff restart — max 5 attempts
      this.scheduleRestart();
    });

    // On successful start, reset attempt counter
    this.psProcess.once('spawn', () => {
      log.info('ETW Consumer spawned successfully.');
    });
  }

  private static scheduleRestart(): void {
    if (this.stopped) return;
    if (this.restartTimer) return; // Already scheduled

    if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      log.error(`ETW Consumer failed ${MAX_RESTART_ATTEMPTS} times. Giving up auto-restart.`);
      return;
    }

    this.restartAttempts++;
    const delay = BASE_RESTART_DELAY_MS * Math.pow(2, this.restartAttempts - 1); // 5s, 10s, 20s, 40s, 80s
    log.info(`ETW Consumer restart attempt ${this.restartAttempts}/${MAX_RESTART_ATTEMPTS} in ${delay}ms...`);

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start();
    }, delay);
  }

  public static stop() {
    this.stopped = true;
    // Cancel pending restart
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.psProcess) {
      this.psProcess.kill();
      this.psProcess = null;
    }

    this.isRunning = false;
    this.restartAttempts = MAX_RESTART_ATTEMPTS; // Prevent further auto-restart
    log.info('ETW Consumer stopped.');
  }
}
