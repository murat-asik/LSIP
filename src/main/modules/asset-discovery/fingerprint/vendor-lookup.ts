const COMMON_OUIS: Record<string, string> = {
  // VMware
  '00:05:69': 'VMware',
  '00:0c:29': 'VMware',
  '00:1c:14': 'VMware',
  '00:50:56': 'VMware',
  // Intel
  '00:03:47': 'Intel',
  '00:1b:21': 'Intel',
  '00:1c:42': 'Intel (Parallels)',
  '00:50:b6': 'Intel',
  // Realtek
  '00:e0:4c': 'Realtek',
  // Apple
  '00:03:93': 'Apple',
  '00:0a:27': 'Apple',
  '00:0d:93': 'Apple',
  '00:10:fa': 'Apple',
  '00:14:51': 'Apple',
  '00:1c:b3': 'Apple',
  '00:22:41': 'Apple',
  '00:23:12': 'Apple',
  '24:a2:e1': 'Apple',
  '34:15:9e': 'Apple',
  'b8:c7:5d': 'Apple',
  'fc:fc:48': 'Apple',
  // Cisco
  '00:00:0c': 'Cisco',
  '00:01:42': 'Cisco',
  '00:01:64': 'Cisco',
  '00:01:c7': 'Cisco',
  '00:02:16': 'Cisco',
  '00:02:4b': 'Cisco',
  '00:02:b9': 'Cisco',
  '00:03:31': 'Cisco',
  '00:03:e3': 'Cisco',
  // HP / Hewlett-Packard
  '00:01:e6': 'HP',
  '00:08:02': 'HP',
  '00:0f:20': 'HP',
  '00:10:83': 'HP',
  '00:11:0a': 'HP',
  '00:17:08': 'HP',
  '00:18:71': 'HP',
  '00:1f:29': 'HP',
  '3c:d9:2b': 'HP',
  // Dell
  '00:06:5b': 'Dell',
  '00:08:74': 'Dell',
  '00:0f:1f': 'Dell',
  '00:11:43': 'Dell',
  '00:13:72': 'Dell',
  '00:14:22': 'Dell',
  '00:15:c5': 'Dell',
  '00:18:8b': 'Dell',
  '14:18:77': 'Dell',
  '18:db:f2': 'Dell',
  'd4:85:64': 'Dell',
  // Microsoft
  '00:03:ff': 'Microsoft (Hyper-V)',
  '00:15:5d': 'Microsoft (Hyper-V)',
  '00:1d:d8': 'Microsoft',
  '00:50:f2': 'Microsoft',
  // Synology
  '00:11:32': 'Synology',
  // Ubiquiti
  '00:15:6d': 'Ubiquiti',
  '04:18:d6': 'Ubiquiti',
  '24:a4:3c': 'Ubiquiti',
  '44:d9:e7': 'Ubiquiti',
  '68:72:51': 'Ubiquiti',
  '78:8a:20': 'Ubiquiti',
  '80:2a:a8': 'Ubiquiti',
  'fc:ec:da': 'Ubiquiti',
  // Netgear
  '00:09:5b': 'Netgear',
  '00:0f:b5': 'Netgear',
  '00:14:6c': 'Netgear',
  '00:18:4d': 'Netgear',
  '00:1b:2f': 'Netgear',
  '00:1f:33': 'Netgear',
  // TP-Link
  '00:19:e3': 'TP-Link',
  '00:21:27': 'TP-Link',
  '00:23:cd': 'TP-Link',
  '14:cc:20': 'TP-Link',
  '30:b5:c2': 'TP-Link',
  '50:c7:bf': 'TP-Link',
  '70:4f:57': 'TP-Link',
  '74:da:da': 'TP-Link',
  'c0:4a:00': 'TP-Link',
  'c4:6e:1f': 'TP-Link',
  // Raspberry Pi Foundation
  'b8:27:eb': 'Raspberry Pi Foundation',
  'dc:a6:32': 'Raspberry Pi Foundation',
  'e4:5f:01': 'Raspberry Pi Foundation',
};

export function lookupVendor(macAddress: string): string {
  if (!macAddress) return 'Unknown Vendor';
  const cleanMac = macAddress.toUpperCase().replace(/[-.]/g, ':');
  const prefix = cleanMac.split(':').slice(0, 3).join(':');
  return COMMON_OUIS[prefix] || 'Unknown Vendor';
}
