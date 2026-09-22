export interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  path: string;
  commandLine: string;
  user: string;
  integrityLevel: 'Low' | 'Medium' | 'High' | 'System' | 'Unknown';
  isElevated: boolean;
  cpuUsage: number;
  memoryUsageBytes: number;
  threadCount: number;
  handleCount: number;
  isSigned: boolean;
  signatureStatus: string;
  signerName?: string;
  companyName?: string;
  description?: string;
  creationTime: number;
}

export interface ThreadInfo {
  threadId: number;
  processId: number;
  startAddress: string;
  cpuTimeMs: number;
  priority: number;
  state: 'Initialized' | 'Ready' | 'Running' | 'Standby' | 'Terminated' | 'Wait' | 'Transition' | 'Unknown';
  waitReason?: string;
}

export interface ModuleInfo {
  name: string;
  path: string;
  baseAddress: string;
  sizeBytes: number;
  isSigned: boolean;
  signerName?: string;
  companyName?: string;
  description?: string;
}

export interface HandleInfo {
  handleValue: number;
  type: string;
  name: string;
}
