import { exec, ExecOptions } from 'child_process';
import crypto from 'crypto';
import { runPowerShell as run, } from './powershell';
import type { ExecFileOptions } from 'child_process';
export interface CollectionHealth { source: string; operation: string; state: 'ok' | 'empty' | 'partial' | 'error'; checkedAt: number; detail: string; }
const states = new Map<string, CollectionHealth>();
export function recordCollection(source: string, command: string, error: Error | null, stdout: string, stderr: string) {
  const operation = crypto.createHash('sha256').update(command).digest('hex').slice(0, 12);
  const detail = String(stderr || error?.message || '').trim().slice(0, 1500);
  const empty = !stdout.trim() || ['[]','null'].includes(stdout.trim());
  const state = error ? 'error' : detail ? (empty ? 'error' : 'partial') : empty ? 'empty' : 'ok';
  states.set(source + ':' + operation, { source, operation, state, checkedAt: Date.now(), detail });
  if (states.size > 200) states.delete(states.keys().next().value!);
}
export function getCollectorHealth() { return [...states.values()]; }
export function trackedPowerShell(source: string) {
  type Callback = (error: Error | null, stdout: string, stderr: string) => void;
  return (script: string, options: ExecFileOptions | Callback, callback?: Callback) => {
    const cb = typeof options === 'function' ? options : callback!;
    const opts = typeof options === 'function' ? {} : options;
    // PowerShell retains non-terminating and caught errors in $Error as well.
    const observed = "$Error.Clear()\ntry {\n" + script + "\n} finally { if ($Error.Count -gt 0) { [Console]::Error.WriteLine(($Error | Select-Object -First 3 | ForEach-Object { $_.Exception.Message }) -join '; ') } }";
    return run(observed, opts, (error, stdout, stderr) => {
      let failure = error;
      if (!failure && stdout.trim()) { try { JSON.parse(stdout); } catch { failure = new Error('Collector returned invalid JSON'); } }
      recordCollection(source, script, failure, stdout, stderr);
      cb(failure, stdout, stderr);
    });
  };
}
export function trackedExec(source: string): typeof exec {
  return ((command: string, options: ExecOptions | Function, callback?: Function) => {
    const cb = typeof options === 'function' ? options : callback!;
    const opts = typeof options === 'function' ? {} : options;
    return exec(command, { ...opts, windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
      recordCollection(source, command, error, String(stdout), String(stderr));
      cb(error, stdout, stderr);
    });
  }) as typeof exec;
}
