/**
 * Report Generator shared types.
 * Configuration and structure for generated SOC reports.
 */

export interface ReportConfig {
  includeSystemInfo: boolean;
  includeReputation: boolean;
  includeAnomalies: boolean;
  includeConnections: boolean;
  includeTimeline: boolean;
  format: 'json' | 'html' | 'csv' | 'pdf';
}

export interface ReportResult {
  success: boolean;
  filePath?: string;
  errorMessage?: string;
  sizeBytes?: number;
  generationTimeMs?: number;
}
