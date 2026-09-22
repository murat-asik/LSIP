export interface ActiveConnection {
  protocol: 'TCP' | 'UDP';
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  state?: string;
  pid: number;
  processName?: string;
  bytesSent?: number;
  bytesReceived?: number;
}

export interface BandwidthStats {
  bytesSentPerSec: number;
  bytesReceivedPerSec: number;
}
