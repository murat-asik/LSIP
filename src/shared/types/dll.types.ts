/**
 * DLL Dependency Scanner shared types.
 * Loaded modules and DLL tracking per process.
 */

export interface DllEntry {
  id: string;
  processId: number;
  processName: string;
  moduleName: string;
  filePath: string;
  baseAddress: string;
  size: number;
  company?: string;
  description?: string;
  isSigned: boolean;
  isSystem: boolean;
}

export interface DllSummary {
  totalLoadedModules: number;
  uniqueDlls: number;
  unsignedDlls: number;
  modules: DllEntry[];
}
