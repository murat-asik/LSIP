/**
 * Persistence Scanner shared types.
 * Registry run keys, scheduled tasks, services, and startup items.
 */

export type PersistenceCategory = 'registry' | 'scheduled_task' | 'service' | 'startup_folder' | 'wmi_subscription';

export interface PersistenceEntry {
  id: string;
  category: PersistenceCategory;
  name: string;
  location: string;        // Registry path, task path, service name
  value: string;           // Command line, executable path
  description?: string;
  publisher?: string;
  isSigned: boolean;
  isEnabled: boolean;
  createdAt?: number;
  modifiedAt?: number;
  riskLevel: 'safe' | 'review' | 'suspicious' | 'malicious';
  riskFactors: string[];
}

export interface PersistenceSummary {
  totalEntries: number;
  registryItems: number;
  scheduledTasks: number;
  services: number;
  startupItems: number;
  suspiciousCount: number;
  entries: PersistenceEntry[];
}
