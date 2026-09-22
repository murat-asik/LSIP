import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('dlls');
import path from 'path';
import { integer } from '../../core/security';
/**
 * DLL Collector — Enumerates loaded modules (DLLs) for processes.
 * Uses PowerShell to extract module information from running processes.
 */

const exec = trackedExec('dlls');
import { createModuleLogger } from '../../core/logger';
import { DllEntry } from '../../../shared/types/dll.types';

const log = createModuleLogger('dll-collector');

export class DllCollector {
  /**
   * Enumerate loaded DLLs for a specific process or all processes.
   */
  public static async getModules(pid?: number): Promise<DllEntry[]> {
    if (pid !== undefined) integer(pid, 'PID');
    return new Promise((resolve) => {
      const processFilter = pid ? `-Id ${pid}` : '';
      const limit = pid ? '' : '| Select-Object -First 500';
      
      const psCmd = [
        `$procs = Get-Process ${processFilter} -ErrorAction SilentlyContinue`,
        'foreach ($p in $procs) {',
        '  try {',
        '    if ($p.Modules) {',
        '      foreach ($m in $p.Modules) {',
        '        [PSCustomObject]@{',
        '          pid = $p.Id;',
        '          pname = $p.Name;',
        '          mname = $m.ModuleName;',
        '          path = $m.FileName;',
        '          base = if($m.BaseAddress){$m.BaseAddress.ToString("X")}else{""};',
        '          size = $m.ModuleMemorySize;',
        '          comp = $m.FileVersionInfo.CompanyName;',
        '          signed = ((Get-AuthenticodeSignature -LiteralPath $m.FileName -ErrorAction SilentlyContinue).Status -eq "Valid");',
        '          desc = $m.FileVersionInfo.FileDescription;',
        '        }',
        '      }',
        '    }',
        '  } catch {}',
        '}',
      ].join('\n');

      const fullCmd = `& { ${psCmd} } ${limit} | ConvertTo-Json -Compress`;

      runPowerShell(fullCmd,
        { maxBuffer: 1024 * 1024 * 16 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            if (pid) log.warn(`Failed to get DLLs for PID ${pid}`);
            return resolve([]);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];
            let idCounter = 1;

            const dlls: DllEntry[] = items
              .filter((m: any) => m && m.mname)
              .map((m: any) => {
                const systemRoot = path.resolve(process.env.SystemRoot || 'C:\\Windows').toLowerCase();
                const resolved = path.resolve(m.path || '').toLowerCase();
                const relative = path.relative(systemRoot, resolved);
                const isSystem = !!m.path && !relative.startsWith('..') && !path.isAbsolute(relative);
                const isSigned = m.signed === true;

                return {
                  id: `dll-${idCounter++}`,
                  processId: m.pid,
                  processName: m.pname,
                  moduleName: m.mname,
                  filePath: m.path || '',
                  baseAddress: m.base ? `0x${m.base}` : '',
                  size: m.size || 0,
                  company: m.comp || '',
                  description: m.desc || '',
                  isSigned,
                  isSystem,
                };
              });

            resolve(dlls);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }
}
