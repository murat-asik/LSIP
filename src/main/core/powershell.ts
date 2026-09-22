import { execFile, ExecFileOptions } from 'child_process';
import path from 'path';

type Callback = (error: Error | null, stdout: string, stderr: string) => void;
/** Preserve PowerShell newlines and quoting, with no cmd.exe intermediary. */
export function runPowerShell(script: string, options: ExecFileOptions | Callback, callback?: Callback) {
  const cb = typeof options === 'function' ? options : callback!;
  const opts = typeof options === 'function' ? {} : options;
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const encoded = Buffer.from("$ProgressPreference = 'SilentlyContinue'\n[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\n" + script, 'utf16le').toString('base64');
  // PowerShell 7's inherited module path can load incompatible providers in 5.1.
  const modulePath = [path.join(path.dirname(executable),'Modules'), path.join(process.env.ProgramFiles || 'C:\\Program Files','WindowsPowerShell','Modules')].join(path.delimiter);
  return execFile(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    { ...opts, env:{...process.env,PSModulePath:modulePath}, encoding:'utf8', windowsHide:true, timeout:30000, maxBuffer:16*1024*1024 },
    (error, stdout, stderr) => cb(error, String(stdout), String(stderr)));
}
