/**
 * Thread Explorer shared types.
 * Process thread enumeration and analysis.
 */

export interface ThreadEntry {
  id: number;
  processId: number;
  threadId: number;
  processName: string;
  basePriority: number;
  currentPriority: number;
  threadState: string;
  waitReason: string;
  cpuTime: number; // in seconds
  startAddress: string;
}

export interface ThreadSummary {
  totalThreads: number;
  activeProcesses: number;
  highPriorityThreads: number;
  threads: ThreadEntry[];
}
