export interface SecurityEvent {
  id: number; // db row id
  eventId: number;
  recordId?: string;
  source: string; // 'Security' | 'System' | 'Application' | 'Sysmon'
  level: number; // 0-5
  timestamp: number;
  computer: string;
  userSid?: string;
  userName?: string;
  message: string;
  xmlData?: string;
  parsedData?: any;
  isBookmarked: boolean;
}

export interface EventQueryFilter {
  eventId?: number;
  source?: string;
  level?: number;
  startTime?: number;
  endTime?: number;
  searchQuery?: string;
  isBookmarked?: boolean;
  limit?: number;
}
