export interface AssetPortInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  service?: string;
  banner?: string;
  tlsInfo?: {
    subject?: string;
    issuer?: string;
    validTo?: string;
    algorithm?: string;
  };
  lastSeen: number;
}

export interface Asset {
  id: string; // MAC or UUID
  ipAddress: string;
  macAddress?: string;
  hostname?: string;
  vendor?: string;
  osGuess?: string;
  deviceType: 'server' | 'client' | 'router' | 'printer' | 'nas' | 'vm' | 'unknown';
  firstSeen: number;
  lastSeen: number;
  isOnline: boolean;
  pingLatencyMs?: number;
  riskScore: number;
  ports: AssetPortInfo[];
  metadata?: any;
}

export interface NetworkInterfaceInfo {
  name: string;
  ipAddress: string; // IPv4
  ipv6Address?: string; // IPv6
  netmask: string;
  macAddress: string;
  subnet: string; // e.g. "192.168.1.0/24"
  gateway?: string;
  dnsServers?: string[];
  dhcpServer?: string;
  domain?: string;
  status: 'Up' | 'Down';
}
