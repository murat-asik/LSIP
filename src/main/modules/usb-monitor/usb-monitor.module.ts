import { BaseModule } from '../base-module';
import { UsbCollector } from './usb-collector';
import { UsbDevice, UsbSummary } from '../../../shared/types/usb.types';
import { databaseManager } from '../../core/database-manager';

export class UsbMonitorModule extends BaseModule {
  public readonly name = 'usb';
  public readonly displayName = 'USB Monitor';
  private syncTimer: NodeJS.Timeout | null = null;
  private knownDevices = new Map<string, number>(); // instanceId -> firstSeen

  public async initialize(): Promise<void> {
    this.logger.info('Initializing USB Monitor Module...');

    // Ensure USB tracking table exists
    await this.ensureSchema();

    this.registerIpcHandler<void, UsbSummary>('summary', async () => {
      return this.getSummary();
    });

    this.registerIpcHandler<void, UsbDevice[]>('devices', async () => {
      return UsbCollector.getDevices();
    });

    this.registerIpcHandler<void, boolean>('scan', async () => {
      await this.syncDevices();
      return true;
    });

    // Initial device scan
    this.syncDevices().catch(err => {
      this.logger.error('Initial USB scan failed', { error: err.message });
    });

    // Poll every 30 seconds
    this.syncTimer = this.registerInterval(30000, () => {
      this.syncDevices().catch(err => {
        this.logger.error('USB poll failed', { error: err.message });
      });
    });

    this.logger.info('USB Monitor Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down USB Monitor Module...');
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.unregisterIpcHandlers();
  }

  private async ensureSchema(): Promise<void> {
    try {
      await databaseManager.queryExec('config', `
        CREATE TABLE IF NOT EXISTS usb_devices (
          instance_id TEXT PRIMARY KEY,
          device_name TEXT,
          manufacturer TEXT,
          vid TEXT,
          pid TEXT,
          serial_number TEXT,
          device_class TEXT,
          first_seen INTEGER,
          last_seen INTEGER,
          connection_count INTEGER DEFAULT 1,
          is_connected INTEGER DEFAULT 0
        )
      `);
    } catch (err: any) {
      this.logger.error('USB schema init failed', { error: err.message });
    }
  }

  private async syncDevices(): Promise<void> {
    try {
      const devices = await UsbCollector.getDevices();
      const now = Date.now();

      for (const device of devices) {
        const existing = await databaseManager.queryGet<any>(
          'config',
          'SELECT instance_id, first_seen, connection_count FROM usb_devices WHERE instance_id = ?',
          [device.instanceId]
        );

        if (existing) {
          const wasDisconnected = !this.knownDevices.has(device.instanceId);
          await databaseManager.queryRun(
            'config',
            'UPDATE usb_devices SET last_seen = ?, is_connected = 1, connection_count = ? WHERE instance_id = ?',
            [now, wasDisconnected ? existing.connection_count + 1 : existing.connection_count, device.instanceId]
          );
        } else {
          await databaseManager.queryRun(
            'config',
            'INSERT INTO usb_devices (instance_id, device_name, manufacturer, vid, pid, serial_number, device_class, first_seen, last_seen, is_connected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [device.instanceId, device.deviceName, device.manufacturer, device.vid, device.pid, device.serialNumber, device.deviceClass, now, now]
          );
        }

        this.knownDevices.set(device.instanceId, now);
      }

      // Mark disconnected devices
      const currentIds = new Set(devices.map(d => d.instanceId));
      for (const [id] of this.knownDevices) {
        if (!currentIds.has(id)) {
          await databaseManager.queryRun(
            'config',
            'UPDATE usb_devices SET is_connected = 0 WHERE instance_id = ?',
            [id]
          );
          this.knownDevices.delete(id);
        }
      }
    } catch (err: any) {
      this.logger.error('USB sync error', { error: err.message });
    }
  }

  private async getSummary(): Promise<UsbSummary> {
    try {
      const [devices, usbEvents] = await Promise.all([
        UsbCollector.getDevices(),
        UsbCollector.getUsbEvents(50)
      ]);
      
      const dbDevices = await databaseManager.queryAll<any>('config', 'SELECT * FROM usb_devices ORDER BY last_seen DESC');
      const today = Date.now() - 86400000;

      const enriched: UsbDevice[] = dbDevices.map((d: any) => ({
        instanceId: d.instance_id,
        deviceName: d.device_name || 'Unknown',
        manufacturer: d.manufacturer || 'Unknown',
        vid: d.vid || '',
        pid: d.pid || '',
        serialNumber: d.serial_number || '',
        deviceClass: d.device_class || 'USB',
        driveLetters: [],
        isConnected: d.is_connected === 1,
        firstSeen: d.first_seen,
        lastSeen: d.last_seen,
        connectionCount: d.connection_count,
        riskLevel: 'safe' as const,
      }));

      return {
        connectedDevices: devices.length,
        totalTracked: enriched.length,
        storageDevices: enriched.filter(d => d.deviceClass.toLowerCase().includes('storage') || d.deviceClass.toLowerCase().includes('disk')).length,
        newDevicesToday: enriched.filter(d => d.firstSeen > today).length,
        devices: enriched,
        recentEvents: usbEvents,
      };
    } catch (err: any) {
      this.logger.error('USB summary error', { error: err.message });
      return { connectedDevices: 0, totalTracked: 0, storageDevices: 0, newDevicesToday: 0, devices: [], recentEvents: [] };
    }
  }
}
export default UsbMonitorModule;
