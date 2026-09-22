import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('threads');
/**
 * Thread Collector — Enumerates threads for processes.
 * Uses PowerShell to extract thread information from running processes.
 */

const exec = trackedExec('threads');
import { createModuleLogger } from '../../core/logger';
import { ThreadEntry } from '../../../shared/types/thread.types';

const log = createModuleLogger('thread-collector');

export class ThreadCollector {
  /**
   * Enumerate threads for a specific process or all processes.
   */
  public static async getThreads(pid?: number): Promise<ThreadEntry[]> {
    return new Promise((resolve) => {
      // If PID is provided, query that specific process, otherwise query all.
      // Limit to 500 threads max for performance if querying all.
      const processFilter = pid ? `-Id ${pid}` : '';
      const limit = pid ? '' : '| Select-Object -First 500';
      
      const psCmd = [
        `$procs = Get-Process ${processFilter} -ErrorAction SilentlyContinue`,
        'foreach ($p in $procs) {',
        '  if ($p.Threads) {',
        '    foreach ($t in $p.Threads) {',
        '      [PSCustomObject]@{',
        '        pid = $p.Id;',
        '        pname = $p.Name;',
        '        tid = $t.Id;',
        '        basePri = $t.BasePriority;',
        '        curPri = $t.CurrentPriority;',
        '        state = $t.ThreadState.ToString();',
        '        reason = if($t.WaitReason){$t.WaitReason.ToString()}else{""};',
        '        cpu = if($t.TotalProcessorTime){$t.TotalProcessorTime.TotalSeconds}else{0};',
        '        addr = if($t.StartAddress){$t.StartAddress.ToString("X")}else{""};',
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n');

      const fullCmd = `& { ${psCmd} } ${limit} | ConvertTo-Json -Compress`;

      runPowerShell(fullCmd,
        { maxBuffer: 1024 * 1024 * 8 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            if (pid) log.warn(`Failed to get threads for PID ${pid}`);
            return resolve([]);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];
            let idCounter = 1;

            const threads: ThreadEntry[] = items
              .filter((t: any) => t && t.tid)
              .map((t: any) => ({
                id: idCounter++,
                processId: t.pid,
                threadId: t.tid,
                processName: t.pname,
                basePriority: t.basePri || 0,
                currentPriority: t.curPri || 0,
                threadState: t.state || 'Unknown',
                waitReason: t.reason || '',
                cpuTime: t.cpu || 0,
                startAddress: t.addr ? `0x${t.addr}` : '',
              }));

            resolve(threads);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }
}
