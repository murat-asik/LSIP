import koffi from 'koffi';
import { createModuleLogger } from './logger';
import os from 'os';

const log = createModuleLogger('win32-ffi');

let kernel32: any;
let psapi: any;

try {
  kernel32 = koffi.load('kernel32.dll');
  psapi = koffi.load('psapi.dll');
} catch (e) {
  log.error('Failed to load win32 dlls via koffi', { error: e });
}

// ---------------------------------------------------------
// Structs and Types
// ---------------------------------------------------------

const FILETIME = koffi.struct('FILETIME', {
  dwLowDateTime: 'uint32',
  dwHighDateTime: 'uint32'
});

const MEMORYSTATUSEX = koffi.struct('MEMORYSTATUSEX', {
  dwLength: 'uint32',
  dwMemoryLoad: 'uint32',
  ullTotalPhys: 'uint64',
  ullAvailPhys: 'uint64',
  ullTotalPageFile: 'uint64',
  ullAvailPageFile: 'uint64',
  ullTotalVirtual: 'uint64',
  ullAvailVirtual: 'uint64',
  ullAvailExtendedVirtual: 'uint64'
});

const TH32CS_SNAPPROCESS = 0x00000002;
const MAX_PATH = 260;
const PROCESS_QUERY_INFORMATION = 0x0400;
const PROCESS_VM_READ = 0x0010;

const PROCESSENTRY32 = koffi.struct('PROCESSENTRY32', {
  dwSize: 'uint32',
  cntUsage: 'uint32',
  th32ProcessID: 'uint32',
  th32DefaultHeapID: 'void*',
  th32ModuleID: 'uint32',
  cntThreads: 'uint32',
  th32ParentProcessID: 'uint32',
  pcPriClassBase: 'int32',
  dwFlags: 'uint32',
  szExeFile: koffi.array('char', MAX_PATH)
});

const PROCESS_MEMORY_COUNTERS = koffi.struct('PROCESS_MEMORY_COUNTERS', {
  cb: 'uint32',
  PageFaultCount: 'uint32',
  PeakWorkingSetSize: 'uint64', // SIZE_T
  WorkingSetSize: 'uint64', // SIZE_T
  QuotaPeakPagedPoolUsage: 'uint64', // SIZE_T
  QuotaPagedPoolUsage: 'uint64', // SIZE_T
  QuotaPeakNonPagedPoolUsage: 'uint64', // SIZE_T
  QuotaNonPagedPoolUsage: 'uint64', // SIZE_T
  PagefileUsage: 'uint64', // SIZE_T
  PeakPagefileUsage: 'uint64', // SIZE_T
});

// ---------------------------------------------------------
// Native Functions
// ---------------------------------------------------------

let GetSystemTimes: any;
let GlobalMemoryStatusEx: any;
let CreateToolhelp32Snapshot: any;
let Process32First: any;
let Process32Next: any;
let CloseHandle: any;
let OpenProcess: any;
let GetProcessTimes: any;
let GetDiskFreeSpaceExA: any;

if (kernel32) {
  GetSystemTimes = kernel32.func('GetSystemTimes', 'int', [
    koffi.out(koffi.pointer(FILETIME)),
    koffi.out(koffi.pointer(FILETIME)),
    koffi.out(koffi.pointer(FILETIME))
  ]);

  GlobalMemoryStatusEx = kernel32.func('GlobalMemoryStatusEx', 'int', [
    koffi.inout(koffi.pointer(MEMORYSTATUSEX))
  ]);

  CreateToolhelp32Snapshot = kernel32.func('CreateToolhelp32Snapshot', 'void*', ['uint32', 'uint32']);
  Process32First = kernel32.func('Process32First', 'int', ['void*', koffi.inout(koffi.pointer(PROCESSENTRY32))]);
  Process32Next = kernel32.func('Process32Next', 'int', ['void*', koffi.inout(koffi.pointer(PROCESSENTRY32))]);
  CloseHandle = kernel32.func('CloseHandle', 'int', ['void*']);
  
  // Process Details
  OpenProcess = kernel32.func('OpenProcess', 'void*', ['uint32', 'int', 'uint32']);
  GetProcessTimes = kernel32.func('GetProcessTimes', 'int', [
    'void*', 
    koffi.out(koffi.pointer(FILETIME)), 
    koffi.out(koffi.pointer(FILETIME)), 
    koffi.out(koffi.pointer(FILETIME)), 
    koffi.out(koffi.pointer(FILETIME))
  ]);

  GetDiskFreeSpaceExA = kernel32.func('GetDiskFreeSpaceExA', 'int', [
    'str',
    koffi.out(koffi.pointer('uint64')),
    koffi.out(koffi.pointer('uint64')),
    koffi.out(koffi.pointer('uint64'))
  ]);
}

let GetProcessMemoryInfo: any;
if (psapi) {
  GetProcessMemoryInfo = psapi.func('GetProcessMemoryInfo', 'int', [
    'void*', 
    koffi.out(koffi.pointer(PROCESS_MEMORY_COUNTERS)), 
    'uint32'
  ]);
}

// ---------------------------------------------------------
// Helper Logic
// ---------------------------------------------------------

let lastIdle = 0n;
let lastKernel = 0n;
let lastUser = 0n;

function filetimeToBigInt(ft: any): bigint {
  return (BigInt(ft.dwHighDateTime) << 32n) | BigInt(ft.dwLowDateTime);
}

export class Win32Metrics {
  /**
   * Retrieves accurate CPU load via native Win32 GetSystemTimes.
   * Calculates delta over time since last call.
   */
  public static getCpuUsagePercent(): number {
    if (!GetSystemTimes) {
      log.warn('GetSystemTimes not available, falling back to os.cpus()');
      return this.getCpuUsageFallback();
    }

    const lpIdleTime = {};
    const lpKernelTime = {};
    const lpUserTime = {};

    const res = GetSystemTimes(lpIdleTime, lpKernelTime, lpUserTime);
    if (!res) return 0;

    const currentIdle = filetimeToBigInt(lpIdleTime);
    const currentKernel = filetimeToBigInt(lpKernelTime);
    const currentUser = filetimeToBigInt(lpUserTime);

    const idleDelta = currentIdle - lastIdle;
    const kernelDelta = currentKernel - lastKernel;
    const userDelta = currentUser - lastUser;

    const sysDelta = kernelDelta + userDelta;
    let percent = 0;

    if (sysDelta > 0n) {
      percent = Number((sysDelta - idleDelta) * 1000n / sysDelta) / 10.0;
    }

    lastIdle = currentIdle;
    lastKernel = currentKernel;
    lastUser = currentUser;

    return Math.max(0, Math.min(100, percent));
  }

  /**
   * Retrieves accurate memory via GlobalMemoryStatusEx.
   */
  public static getMemoryUsage(): { totalRamGb: number; usedRamGb: number } {
    if (!GlobalMemoryStatusEx) {
      const total = os.totalmem();
      const free = os.freemem();
      return {
        totalRamGb: parseFloat((total / 1024 / 1024 / 1024).toFixed(2)),
        usedRamGb: parseFloat(((total - free) / 1024 / 1024 / 1024).toFixed(2))
      };
    }

    const memStatus = {
      dwLength: 64, // sizeof(MEMORYSTATUSEX)
      dwMemoryLoad: 0,
      ullTotalPhys: 0,
      ullAvailPhys: 0,
      ullTotalPageFile: 0,
      ullAvailPageFile: 0,
      ullTotalVirtual: 0,
      ullAvailVirtual: 0,
      ullAvailExtendedVirtual: 0
    };

    const res = GlobalMemoryStatusEx(memStatus);
    if (!res) return { totalRamGb: 0, usedRamGb: 0 };

    const total = Number(memStatus.ullTotalPhys);
    const avail = Number(memStatus.ullAvailPhys);
    const used = total - avail;

    return {
      totalRamGb: parseFloat((total / 1024 / 1024 / 1024).toFixed(2)),
      usedRamGb: parseFloat((used / 1024 / 1024 / 1024).toFixed(2))
    };
  }

  /**
   * Retrieves active processes natively via CreateToolhelp32Snapshot.
   */
  /**
   * Retrieves accurate disk usage for C:\ via GetDiskFreeSpaceExA
   */
  public static getDiskUsage(): { totalDiskGb: number; usedDiskGb: number; freeDiskGb: number } {
    if (!GetDiskFreeSpaceExA) {
      return { totalDiskGb: 0, usedDiskGb: 0, freeDiskGb: 0 };
    }

    const freeBytesAvailableToCaller = [0n];
    const totalNumberOfBytes = [0n];
    const totalNumberOfFreeBytes = [0n];

    const res = GetDiskFreeSpaceExA("C:\\", freeBytesAvailableToCaller, totalNumberOfBytes, totalNumberOfFreeBytes);
    if (!res) return { totalDiskGb: 0, usedDiskGb: 0, freeDiskGb: 0 };

    const total = Number(totalNumberOfBytes[0]);
    const free = Number(totalNumberOfFreeBytes[0]);
    const used = total - free;

    return {
      totalDiskGb: parseFloat((total / 1024 / 1024 / 1024).toFixed(2)),
      freeDiskGb: parseFloat((free / 1024 / 1024 / 1024).toFixed(2)),
      usedDiskGb: parseFloat((used / 1024 / 1024 / 1024).toFixed(2))
    };
  }

  public static getNativeProcessSnapshot(): Array<{ pid: number; ppid: number; name: string; threads: number; memoryBytes: number; cpuTime: number; creationTime:number }> {
    if (!CreateToolhelp32Snapshot) throw new Error('Windows process enumeration is unavailable');

    const hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (!hSnapshot || hSnapshot === koffi.address(null)) {
      throw new Error('Windows process snapshot failed');
    }

    const result = [];
    const pe32 = {
      dwSize: 568, 
      cntUsage: 0,
      th32ProcessID: 0,
      th32DefaultHeapID: null,
      th32ModuleID: 0,
      cntThreads: 0,
      th32ParentProcessID: 0,
      pcPriClassBase: 0,
      dwFlags: 0,
      szExeFile: new Uint8Array(MAX_PATH)
    };

    pe32.dwSize = koffi.sizeof(PROCESSENTRY32);

    if (Process32First(hSnapshot, pe32)) {
      do {
        const exeFileStr = Buffer.from(pe32.szExeFile).toString('utf-8').split('\0')[0];
        
        let memoryBytes = 0;
        let cpuTime = 0;
        let creationTime = 0;
        
        if (OpenProcess) {
          const hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pe32.th32ProcessID);
          if (hProcess && hProcess !== koffi.address(null)) {
            // Get Memory
            if (GetProcessMemoryInfo) {
              const pmc = { cb: 72, PageFaultCount: 0, PeakWorkingSetSize: 0, WorkingSetSize: 0, QuotaPeakPagedPoolUsage: 0, QuotaPagedPoolUsage: 0, QuotaPeakNonPagedPoolUsage: 0, QuotaNonPagedPoolUsage: 0, PagefileUsage: 0, PeakPagefileUsage: 0 };
              pmc.cb = koffi.sizeof(PROCESS_MEMORY_COUNTERS);
              if (GetProcessMemoryInfo(hProcess, pmc, pmc.cb)) {
                memoryBytes = Number(pmc.WorkingSetSize);
              }
            }
            
            // Get CPU Time
            if (GetProcessTimes) {
              const cTime = {}; const eTime = {}; const kTime = {}; const uTime = {};
              if (GetProcessTimes(hProcess, cTime, eTime, kTime, uTime)) {
                const k = filetimeToBigInt(kTime);
                const u = filetimeToBigInt(uTime);
                cpuTime = Number((k + u) / 10000n); // Convert 100-ns intervals to milliseconds
                creationTime = Number(filetimeToBigInt(cTime) / 10000n - 11644473600000n);
              }
            }
            CloseHandle(hProcess);
          }
        }

        result.push({
          pid: pe32.th32ProcessID,
          ppid: pe32.th32ParentProcessID,
          name: exeFileStr,
          threads: pe32.cntThreads,
          memoryBytes,
          cpuTime,
          creationTime
        });
      } while (Process32Next(hSnapshot, pe32));
    }

    CloseHandle(hSnapshot);
    if (!result.length) throw new Error('Windows process enumeration returned no records');
    return result;
  }

  private static lastFallbackCpus = os.cpus();
  private static getCpuUsageFallback(): number {
    const cpus = os.cpus();
    let idleDiff = 0;
    let totalDiff = 0;

    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      const lastCpu = this.lastFallbackCpus[i];
      for (const type in cpu.times) {
        totalDiff += cpu.times[type as keyof typeof cpu.times] - lastCpu.times[type as keyof typeof lastCpu.times];
      }
      idleDiff += cpu.times.idle - lastCpu.times.idle;
    }
    this.lastFallbackCpus = cpus;
    return totalDiff === 0 ? 0 : 100 - ~~(100 * idleDiff / totalDiff);
  }
}
