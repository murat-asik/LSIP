import { trackedPowerShell, trackedExec, recordCollection } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('process');
import { integer } from '../../core/security';
const exec = trackedExec('process');
import { ProcessInfo, ThreadInfo, ModuleInfo, HandleInfo } from '../../../shared/types/process.types';
import { createModuleLogger } from '../../core/logger';
import { Win32Metrics } from '../../core/win32-ffi';
import os from 'os';

const log = createModuleLogger('process-collector');

interface ProcessCacheEntry {
  path?: string;
  commandLine: string;
  user: string;
  integrityLevel: 'Low' | 'Medium' | 'High' | 'System' | 'Unknown';
  isElevated: boolean;
  isSigned: boolean;
  signatureStatus: string;
  signerName?: string;
  companyName?: string;
  description?: string;
  handleCount: number;
}

export class ProcessCollector {
  private static cache = new Map<number, ProcessCacheEntry>();
  private static lastCpuSamples = new Map<number, { time: number; cpuTime: number }>();
  private static identities = new Map<number,string>();
  private static pendingSnapshot: Promise<ProcessInfo[]> | undefined;

  public static getProcessSnapshot(): Promise<ProcessInfo[]> {
    if(this.pendingSnapshot)return this.pendingSnapshot;
    this.pendingSnapshot=this.collectSnapshot().finally(()=>{this.pendingSnapshot=undefined;});
    return this.pendingSnapshot;
  }

  private static async collectSnapshot(): Promise<ProcessInfo[]> {
    try {
      const nativeProcs = Win32Metrics.getNativeProcessSnapshot();
      const now = Date.now();
      const snapshot: ProcessInfo[] = [];

      const newPids: number[] = [];
      for (const p of nativeProcs) {
        if (!p || !p.pid) continue;
        const identity=`${p.name}:${p.creationTime}`;
        if(this.identities.get(p.pid)!==identity){this.cache.delete(p.pid);this.lastCpuSamples.delete(p.pid);this.identities.set(p.pid,identity);}
        if (!this.cache.has(p.pid)) {
          newPids.push(p.pid);
        }
      }

      if (newPids.length > 0) {
        await this.fetchProcessDetails(newPids);
      }

      for (const p of nativeProcs) {
        if (!p || !p.pid) continue;
        const pid = p.pid;
        const cacheEntry = this.cache.get(pid) || {
          commandLine: '',
          user: 'N/A',
          integrityLevel: 'Unknown',
          isElevated: false,
          isSigned: false,
          signatureStatus: 'Unverified',
          handleCount: 0,
        };

        let cpuUsage = 0;
        const prevSample = this.lastCpuSamples.get(pid);
        if (prevSample) {
          const deltaReal = now - prevSample.time;
          const deltaCpu = p.cpuTime - prevSample.cpuTime;
          if (deltaReal > 0 && deltaCpu >= 0) {
            cpuUsage = parseFloat(((deltaCpu / deltaReal / Math.max(1,os.cpus().length)) * 100).toFixed(1));
          }
        }
        this.lastCpuSamples.set(pid, { time: now, cpuTime: p.cpuTime });

        snapshot.push({
          pid,
          ppid: p.ppid || 0,
          name: p.name,
          path: cacheEntry.path || '',
          commandLine: cacheEntry.commandLine,
          user: cacheEntry.user,
          integrityLevel: cacheEntry.integrityLevel,
          isElevated: cacheEntry.isElevated,
          cpuUsage: Math.min(cpuUsage, 100),
          memoryUsageBytes: p.memoryBytes || 0,
          threadCount: p.threads || 0,
          handleCount: cacheEntry.handleCount || 0, 
          isSigned: cacheEntry.isSigned,
          signatureStatus: cacheEntry.signatureStatus,
          signerName: cacheEntry.signerName,
          companyName: cacheEntry.companyName,
          description: cacheEntry.description,
          creationTime: p.creationTime,
        });
      }

      const activePids = new Set(nativeProcs.map(p => p?.pid).filter(Boolean));
      for (const cachedPid of this.cache.keys()) {
        if (!activePids.has(cachedPid)) {
          this.cache.delete(cachedPid);
          this.lastCpuSamples.delete(cachedPid);
          this.identities.delete(cachedPid);
        }
      }

      recordCollection('process', 'native-snapshot', null, JSON.stringify(snapshot), '');
      return snapshot;
    } catch (e: any) {
      log.error('Failed to parse native process snapshot', { error: e.message });
      recordCollection('process', 'native-snapshot', e, '', '');
      throw e;
    }
  }

  private static fetchProcessDetails(pids: number[]): Promise<void> {
    return new Promise((resolve) => {
      // Chunk PIDs to avoid long command line arguments
      const pidChunks = this.chunkArray(pids, 30);
      let pending = pidChunks.length;

      if (pending === 0) return resolve();

      for (const chunk of pidChunks) {
        const filter = chunk.map(pid => `ProcessId = ${pid}`).join(' or ');
        // Extended query: get command line, owner, and Authenticode signature status
        const psCommand = `
          $procs = Get-CimInstance Win32_Process -Filter "${filter}"
          $results = foreach ($p in $procs) {
            $owner = try { Invoke-CimMethod -InputObject $p -MethodName GetOwner -ErrorAction Stop } catch { $null }
            $user = if ($owner -and $owner.User) { "$($owner.Domain)\\$($owner.User)" } else { "N/A" }
            $exePath = $p.ExecutablePath
            $sigStatus = "Unknown"
            $isSigned = $false
            $signerName = ""
            if ($exePath -and (Test-Path $exePath -ErrorAction SilentlyContinue)) {
              $sig = Get-AuthenticodeSignature -FilePath $exePath -ErrorAction SilentlyContinue
              if ($sig) {
                $sigStatus = $sig.Status.ToString()
                $isSigned = ($sig.Status -eq "Valid")
                $signerName = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { "" }
              }
            }
            [PSCustomObject]@{
              pid = $p.ProcessId
              cmd = $p.CommandLine
              path = $exePath
              user = $user
              isSigned = $isSigned
              sigStatus = $sigStatus
              signerName = $signerName
              handleCount = $p.HandleCount
            }
          }
          $results | ConvertTo-Json -Compress
        `;

        runPowerShell(psCommand, (err, stdout) => {
          if (!err && stdout.trim()) {
            try {
              const details = JSON.parse(stdout);
              const detailsList = Array.isArray(details) ? details : [details];
              for (const det of detailsList) {
                if (det && det.pid) {
                  const isSystem = det.user && (det.user.includes('SYSTEM') || det.user.includes('LOCAL SERVICE') || det.user.includes('NETWORK SERVICE'));
                  const isAdmin = det.user && det.user.includes('Administrators');
                  this.cache.set(det.pid, {
                    commandLine: det.cmd || '',
                    path: det.path || '',
                    user: det.user || 'N/A',
                    integrityLevel: 'Unknown',
                    isElevated: false,
                    isSigned: det.isSigned === true,
                    signatureStatus: det.sigStatus || 'Unknown',
                    signerName: det.signerName || undefined,
                    handleCount: det.handleCount || 0,
                  });
                }
              }
            } catch (e: any) {
              log.warn('Failed to parse process details chunk', { error: e.message });
            }
          }

          // Fallback for PIDs that weren't returned or errored
          for (const pid of chunk) {
            if (!this.cache.has(pid)) {
              this.cache.set(pid, {
                commandLine: '',
                user: 'N/A',
                integrityLevel: 'Unknown',
                isElevated: false,
                isSigned: false,
                signatureStatus: 'Unknown',
                handleCount: 0,
              });
            }
          }

          pending--;
          if (pending === 0) {
            resolve();
          }
        });
      }
    });
  }

  public static getProcessThreads(pid: number): Promise<ThreadInfo[]> {
    integer(pid, 'pid', 0x7fffffff);
    return new Promise((resolve) => {
      const psCommand = `
        $p = [System.Diagnostics.Process]::GetProcessById(${pid})
        $p.Threads | ForEach-Object {
          [PSCustomObject]@{
            tid = $_.Id
            pid = ${pid}
            startAddress = $_.StartAddress.ToString("X")
            cpuTime = $_.TotalProcessorTime.TotalMilliseconds
            priority = $_.BasePriority
            state = $_.ThreadState.ToString()
            waitReason = try { $_.WaitReason.ToString() } catch { "" }
          }
        } | ConvertTo-Json -Compress
      `;

      runPowerShell(psCommand, (err, stdout) => {
        if (err || !stdout.trim()) {
          return resolve([]);
        }
        try {
          const rawThreads = JSON.parse(stdout);
          const threads = Array.isArray(rawThreads) ? rawThreads : [rawThreads];
          resolve(threads.map(t => ({
            threadId: t.tid,
            processId: t.pid,
            startAddress: `0x${t.startAddress}`,
            cpuTimeMs: t.cpuTime,
            priority: t.priority,
            state: t.state || 'Unknown',
            waitReason: t.waitReason || undefined,
          })));
        } catch {
          resolve([]);
        }
      });
    });
  }

  public static getProcessModules(pid: number): Promise<ModuleInfo[]> {
    integer(pid, 'pid', 0x7fffffff);
    return new Promise((resolve) => {
      const psCommand = `
        $p = [System.Diagnostics.Process]::GetProcessById(${pid})
        $p.Modules | ForEach-Object {
          [PSCustomObject]@{
            name = $_.ModuleName
            path = $_.FileName
            baseAddress = $_.BaseAddress.ToString("X")
            size = $_.ModuleMemorySize
          }
        } | ConvertTo-Json -Compress
      `;

      runPowerShell(psCommand, (err, stdout) => {
        if (err || !stdout.trim()) {
          return resolve([]);
        }
        try {
          const rawModules = JSON.parse(stdout);
          const modules = Array.isArray(rawModules) ? rawModules : [rawModules];
          resolve(modules.map(m => ({
            name: m.name,
            path: m.path,
            baseAddress: `0x${m.baseAddress}`,
            sizeBytes: m.size,
            isSigned: false, // will scan if needed
          })));
        } catch {
          resolve([]);
        }
      });
    });
  }

  private static chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
