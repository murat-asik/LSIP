import { trackedPowerShell, trackedExec } from '../../core/collector-health';
const runPowerShell = trackedPowerShell('usb');
/**
 * USB Collector — Tracks USB device connections via Registry and PowerShell.
 * Reads HKLM\SYSTEM\CurrentControlSet\Enum\USB and PnP device queries.
 */

const exec = trackedExec('usb');
import { createModuleLogger } from '../../core/logger';
import { UsbDevice } from '../../../shared/types/usb.types';

const log = createModuleLogger('usb-collector');

const USB_CLASS_MAP: Record<string, string> = {
  '08': 'Mass Storage',
  '03': 'HID (Keyboard/Mouse)',
  '01': 'Audio',
  '02': 'Communication',
  '06': 'Still Image',
  '07': 'Printer',
  '09': 'Hub',
  '0E': 'Video',
  '0A': 'CDC Data',
  'E0': 'Wireless Controller',
  'EF': 'Miscellaneous',
  'FF': 'Vendor Specific',
};

export class UsbCollector {
  /**
   * Enumerate USB devices using PowerShell Get-PnpDevice and registry queries.
   */
  public static async getDevices(): Promise<UsbDevice[]> {
    return new Promise((resolve) => {
      const psCmd = [
        "Get-PnpDevice -InstanceId 'USB\\*','USBSTOR\\*' -ErrorAction SilentlyContinue |",
        'Select-Object InstanceId, FriendlyName, Manufacturer, Status, Class, Present |',
        'ForEach-Object {',
        "  $vidMatch = $_.InstanceId -match 'VID_([0-9A-Fa-f]{4})'",
        "  $vid = if($vidMatch){$Matches[1]}else{''}",
        "  $pidMatch = $_.InstanceId -match 'PID_([0-9A-Fa-f]{4})'",
        "  $pid2 = if($pidMatch){$Matches[1]}else{''}",
        "  $snMatch = $_.InstanceId -match '\\\\([^\\\\]+)$'",
        "  $sn = if($snMatch){$Matches[1]}else{''}",
        '  [PSCustomObject]@{',
        '    instanceId = $_.InstanceId',
        '    name = if($_.FriendlyName){$_.FriendlyName}else{$_.Class}',
        "    manufacturer = if($_.Manufacturer){$_.Manufacturer}else{'Unknown'}",
        '    status = $_.Status',
        '    present = $_.Present',
        '    vid = $vid',
        '    pid = $pid2',
        '    sn = $sn',
        '    cls = $_.Class',
        '  }',
        '} | ConvertTo-Json -Compress',
      ].join('\n');

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 * 2 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            log.warn('Get-PnpDevice failed, using fallback');
            return this.getDevicesFallback().then(resolve);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];
            const now = Date.now();

            const devices: UsbDevice[] = items
              .filter((d: any) => d && d.instanceId)
              .map((d: any) => ({
                instanceId: d.instanceId,
                deviceName: d.name || 'Unknown Device',
                manufacturer: d.manufacturer || 'Unknown',
                vid: d.vid || '',
                pid: d.pid || '',
                serialNumber: d.sn || '',
                deviceClass: d.cls || 'USB',
                driveLetters: [],
                isConnected: d.present === true || d.status === 'OK',
                firstSeen: now,
                lastSeen: now,
                connectionCount: 1,
                riskLevel: 'safe' as const,
              }));

            resolve(devices);
          } catch (parseErr: any) {
            log.error('Failed to parse USB device data', { error: parseErr.message });
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * Fallback: query USB devices via WMIC.
   */
  private static getDevicesFallback(): Promise<UsbDevice[]> {
    return new Promise((resolve) => {
      exec(
        'wmic path Win32_USBControllerDevice get Dependent /format:csv 2>nul',
        { maxBuffer: 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout) return resolve([]);

          const devices: UsbDevice[] = [];
          const now = Date.now();
          const lines = stdout.split('\n');

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('Node')) continue;

            const parts = trimmed.split(',');
            const devPath = parts[parts.length - 1]?.trim() || '';

            if (devPath.includes('USB')) {
              const vidMatch = devPath.match(/VID_([0-9A-Fa-f]{4})/i);
              const pidMatch = devPath.match(/PID_([0-9A-Fa-f]{4})/i);

              devices.push({
                instanceId: devPath,
                deviceName: devPath.split('\\').pop() || 'USB Device',
                manufacturer: 'Unknown',
                vid: vidMatch ? vidMatch[1] : '',
                pid: pidMatch ? pidMatch[1] : '',
                serialNumber: '',
                deviceClass: 'USB',
                driveLetters: [],
                isConnected: true,
                firstSeen: now,
                lastSeen: now,
                connectionCount: 1,
                riskLevel: 'safe' as const,
              });
            }
          }

          resolve(devices);
        }
      );
    });
  }

  /**
   * Query USB connection/disconnection events from Windows Event Logs.
   */
  public static async getUsbEvents(maxEvents: number = 100): Promise<any[]> {
    return new Promise((resolve) => {
      // Query Microsoft-Windows-DriverFrameworks-UserMode/Operational (IDs 2003, 2100)
      const psCmd = `
        try {
          $events = Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-DriverFrameworks-UserMode/Operational';ID=2003,2100,2004} -MaxEvents ${maxEvents} -ErrorAction SilentlyContinue
          
          $events | Sort-Object TimeCreated -Descending | Select-Object -First ${maxEvents} | ForEach-Object {
            $xml = [xml]$_.ToXml()
            $instanceId = ""
            if ($xml.Event.UserData.UMDFHostDeviceRequest.InstanceId) {
              $instanceId = $xml.Event.UserData.UMDFHostDeviceRequest.InstanceId
            }
            
            [PSCustomObject]@{
              id = $_.Id
              time = $_.TimeCreated.ToString('o')
              instanceId = $instanceId
              type = switch($_.Id) { 2003 {"connected"} 2100 {"disconnected"} 2004 {"initialized"} default {"unknown"} }
            }
          } | ConvertTo-Json -Compress
        } catch { @() | ConvertTo-Json }
      `;

      runPowerShell(psCmd,
        { maxBuffer: 1024 * 1024 * 4 },
        (err, stdout) => {
          if (err || !stdout.trim()) {
            return resolve([]);
          }

          try {
            const raw = JSON.parse(stdout);
            const items = Array.isArray(raw) ? raw : [raw];

            const events = items
              .filter((e: any) => e && e.id)
              .map((e: any) => ({
                eventId: e.id,
                timestamp: new Date(e.time).getTime(),
                instanceId: e.instanceId,
                eventType: e.type,
              }));

            resolve(events);
          } catch {
            resolve([]);
          }
        }
      );
    });
  }
}
