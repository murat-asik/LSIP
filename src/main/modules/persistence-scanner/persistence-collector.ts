import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('persistence');
/**
 * Persistence Collector — Enumerates persistence mechanisms on Windows.
 * Checks Registry run keys, Scheduled Tasks, Services, and Startup folders.
 * All operations are read-only and entirely offline.
 */

const exec = trackedExec('persistence');
import { createModuleLogger } from '../../core/logger';
import { PersistenceEntry } from '../../../shared/types/persistence.types';

const log = createModuleLogger('persistence-collector');

// Known suspicious paths/patterns
const SUSPICIOUS_PATHS = [
  'appdata\\local\\temp',
  'appdata\\roaming',
  'users\\public',
  'programdata',
  'downloads',
  'recycle',
  '\\temp\\',
];

const SUSPICIOUS_EXTENSIONS = ['.bat', '.cmd', '.vbs', '.js', '.ps1', '.wsf', '.hta', '.scr'];

export class PersistenceCollector {
  /**
   * Get Registry Run key entries (auto-start programs).
   */
  public static async getRegistryRunKeys(): Promise<PersistenceEntry[]> {
    const entries: PersistenceEntry[] = [];
    const regPaths = [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
    ];

    for (const regPath of regPaths) {
      try {
        const items = await this.queryRegKey(regPath);
        for (const item of items) {
          const riskAnalysis = this.analyzeRisk(item.value);
          entries.push({
            id: `reg-${regPath}-${item.name}`,
            category: 'registry',
            name: item.name,
            location: regPath,
            value: item.value,
            isSigned: false,
            isEnabled: true,
            riskLevel: riskAnalysis.level,
            riskFactors: riskAnalysis.factors,
          });
        }
      } catch {}
    }

    return entries;
  }

  /**
   * Get Scheduled Tasks.
   */
  public static async getScheduledTasks(): Promise<PersistenceEntry[]> {
    return new Promise((resolve) => {
      const psCmd = 'Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.State -ne "Disabled" } | Select-Object -First 100 | ForEach-Object { $a = $_.Actions | Select-Object -First 1; [PSCustomObject]@{ name = $_.TaskName; path = $_.TaskPath; state = $_.State.ToString(); author = $_.Author; cmd = if($a.Execute){$a.Execute}else{""} } } | ConvertTo-Json -Compress';

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 * 4, timeout: 15000 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            log.warn('Scheduled tasks query failed');
            return resolve([]);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];

            const entries: PersistenceEntry[] = items
              .filter((t: any) => t && t.name)
              .map((t: any) => {
                const riskAnalysis = this.analyzeRisk(t.cmd || '');
                return {
                  id: `task-${t.path}${t.name}`,
                  category: 'scheduled_task' as const,
                  name: t.name,
                  location: t.path || '\\',
                  value: t.cmd || '',
                  publisher: t.author || undefined,
                  isSigned: false,
                  isEnabled: t.state === 'Ready' || t.state === 'Running',
                  riskLevel: riskAnalysis.level,
                  riskFactors: riskAnalysis.factors,
                };
              });

            resolve(entries);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Get Windows Services.
   */
  public static async getServices(): Promise<PersistenceEntry[]> {
    return new Promise((resolve) => {
      const psCmd = 'Get-Service -ErrorAction SilentlyContinue | Select-Object -First 150 | ForEach-Object { $wmi = Get-WmiObject Win32_Service -Filter "Name=\'$($_.ServiceName)\'" -ErrorAction SilentlyContinue; [PSCustomObject]@{ name = $_.ServiceName; display = $_.DisplayName; status = $_.Status.ToString(); startup = $_.StartType.ToString(); path = if($wmi){$wmi.PathName}else{""} } } | ConvertTo-Json -Compress';

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 * 4, timeout: 20000 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            return this.getServicesFallback().then(resolve);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];

            const entries: PersistenceEntry[] = items
              .filter((s: any) => s && s.name)
              .map((s: any) => {
                const riskAnalysis = this.analyzeRisk(s.path || '');
                return {
                  id: `svc-${s.name}`,
                  category: 'service' as const,
                  name: s.name,
                  description: s.display || undefined,
                  location: `Services\\${s.name}`,
                  value: s.path || '',
                  isSigned: false,
                  isEnabled: s.startup !== 'Disabled',
                  riskLevel: riskAnalysis.level,
                  riskFactors: riskAnalysis.factors,
                };
              });

            resolve(entries);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  private static getServicesFallback(): Promise<PersistenceEntry[]> {
    return new Promise((resolve) => {
      exec('sc query type= service state= all', { maxBuffer: 1024 * 1024 * 2 }, (err, stdout) => {
        if (err || !stdout) return resolve([]);

        const entries: PersistenceEntry[] = [];
        const blocks = stdout.split(/\n\n/);

        for (const block of blocks) {
          const nameMatch = block.match(/SERVICE_NAME:\s*(\S+)/);
          const displayMatch = block.match(/DISPLAY_NAME:\s*(.+)/);
          if (nameMatch) {
            entries.push({
              id: `svc-${nameMatch[1]}`,
              category: 'service',
              name: nameMatch[1],
              description: displayMatch ? displayMatch[1].trim() : undefined,
              location: `Services\\${nameMatch[1]}`,
              value: '',
              isSigned: false,
              isEnabled: true,
              riskLevel: 'safe',
              riskFactors: [],
            });
          }
        }

        resolve(entries);
      });
    });
  }

  /**
   * Get Startup Folder shortcuts.
   */
  public static async getStartupFolders(): Promise<PersistenceEntry[]> {
    return new Promise((resolve) => {
      const psCmd = `
        $startupPaths = @(
          "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup",
          "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
        )
        $items = @()
        foreach ($path in $startupPaths) {
          if (Test-Path $path) {
            Get-ChildItem -Path $path -File -ErrorAction SilentlyContinue | ForEach-Object {
              $target = ""
              if ($_.Extension -eq ".lnk") {
                $shell = New-Object -ComObject WScript.Shell
                $target = $shell.CreateShortcut($_.FullName).TargetPath
              } else {
                $target = $_.FullName
              }
              $items += [PSCustomObject]@{
                name = $_.Name
                path = $_.DirectoryName
                target = $target
              }
            }
          }
        }
        $items | ConvertTo-Json -Compress
      `;

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 * 2, timeout: 15000 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            return resolve([]);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];

            const entries: PersistenceEntry[] = items
              .filter((i: any) => i && i.name)
              .map((i: any) => {
                const riskAnalysis = this.analyzeRisk(i.target || '');
                return {
                  id: 'startup-' + i.name,
                  category: 'startup_folder',
                  name: i.name,
                  location: i.path,
                  value: i.target || '',
                  isSigned: false,
                  isEnabled: true,
                  riskLevel: riskAnalysis.level,
                  riskFactors: riskAnalysis.factors,
                };
              });

            resolve(entries);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }

  // ── Registry Query Helper ───────────────────────────────────

  private static queryRegKey(keyPath: string): Promise<{ name: string; value: string }[]> {
    return new Promise((resolve) => {
      exec(`reg query "${keyPath}" 2>nul`, (err, stdout) => {
        if (err || !stdout) return resolve([]);

        const entries: { name: string; value: string }[] = [];
        const lines = stdout.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('HKEY_') || trimmed.startsWith('HKLM') || trimmed.startsWith('HKCU')) continue;

          const parts = trimmed.split(/\s{2,}REG_\w+\s{2,}/);
          if (parts.length >= 2) {
            entries.push({
              name: parts[0].trim(),
              value: parts[1].trim(),
            });
          }
        }

        resolve(entries);
      });
    });
  }

  // ── Risk Analysis ──────────────────────────────────────────

  private static analyzeRisk(value: string): { level: 'safe' | 'review' | 'suspicious' | 'malicious'; factors: string[] } {
    const factors: string[] = [];
    const lower = value.toLowerCase();
    let riskPoints = 0;

    // Check for suspicious paths
    for (const sp of SUSPICIOUS_PATHS) {
      if (lower.includes(sp)) {
        factors.push(`Executable in suspicious path: ${sp}`);
        riskPoints += 20;
      }
    }

    // Check for suspicious extensions
    for (const ext of SUSPICIOUS_EXTENSIONS) {
      if (lower.endsWith(ext) || lower.includes(ext + ' ') || lower.includes(ext + '"')) {
        factors.push(`Uses script extension: ${ext}`);
        riskPoints += 15;
      }
    }

    // Check for encoded commands
    if (lower.includes('-encodedcommand') || lower.includes('-enc ') || lower.includes('base64')) {
      factors.push('Contains encoded/obfuscated command');
      riskPoints += 30;
    }

    // Check for common LOLBins
    const lolbins = ['mshta', 'rundll32', 'regsvr32', 'certutil', 'bitsadmin', 'wscript', 'cscript', 'msiexec'];
    for (const lb of lolbins) {
      if (lower.includes(lb) && !lower.includes('system32\\' + lb)) {
        factors.push(`Uses Living-off-the-Land binary: ${lb}`);
        riskPoints += 25;
      }
    }

    // Check for network indicators
    if (lower.includes('http://') || lower.includes('https://') || lower.includes('ftp://')) {
      factors.push('References external URL');
      riskPoints += 20;
    }

    let level: 'safe' | 'review' | 'suspicious' | 'malicious' = 'safe';
    if (riskPoints >= 40) level = 'malicious';
    else if (riskPoints >= 20) level = 'suspicious';
    else if (riskPoints >= 10) level = 'review';

    return { level, factors };
  }
}
