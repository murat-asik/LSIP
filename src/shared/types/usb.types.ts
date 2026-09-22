/**
 * USB Monitor shared types.
 * USB device tracking, history, and policy enforcement.
 */

export interface UsbDevice {
  instanceId: string;
  deviceName: string;
  manufacturer: string;
  vid: string;           // Vendor ID
  pid: string;           // Product ID
  serialNumber: string;
  deviceClass: string;   // Mass Storage, HID, Audio, etc.
  driveLetters: string[];
  isConnected: boolean;
  firstSeen: number;
  lastSeen: number;
  connectionCount: number;
  riskLevel: 'safe' | 'review' | 'blocked';
}

export interface UsbEvent {
  id: number;
  timestamp: number;
  action: 'connected' | 'disconnected' | 'first-seen';
  deviceName: string;
  instanceId: string;
  serialNumber: string;
  deviceClass: string;
}

export interface UsbSummary {
  connectedDevices: number;
  totalTracked: number;
  storageDevices: number;
  newDevicesToday: number;
  devices: UsbDevice[];
  recentEvents: UsbEvent[];
}
