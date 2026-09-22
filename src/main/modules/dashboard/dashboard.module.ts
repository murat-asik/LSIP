import { BaseModule } from '../base-module';
import { databaseManager } from '../../core/database-manager';
import { Win32Metrics } from '../../core/win32-ffi';
import os from 'os';

export class DashboardModule extends BaseModule {
  public readonly name = 'dashboard';
  public readonly displayName = 'Dashboard';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Dashboard Module...');

    this.registerIpcHandler('metrics', async () => {
      return this.getMetrics();
    });

    this.registerIpcHandler('stats', async () => {
      return this.getStats();
    });

    this.logger.info('Dashboard Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Dashboard Module...');
    this.unregisterIpcHandlers();
  }

  private getMetrics() {
    this.logger.info('[Dashboard Trace] getMetrics() called. Invoking Win32Metrics...');
    const cpuUsage = Win32Metrics.getCpuUsagePercent();
    this.logger.info(`[Dashboard Trace] CPU: ${cpuUsage}`);
    
    const memUsage = Win32Metrics.getMemoryUsage();
    this.logger.info(`[Dashboard Trace] RAM: ${JSON.stringify(memUsage)}`);
    
    const diskUsage = Win32Metrics.getDiskUsage();
    this.logger.info(`[Dashboard Trace] Disk: ${JSON.stringify(diskUsage)}`);

    // Zero-Assumption: Calculate live physical connected adapters
    const interfaces = os.networkInterfaces();
    let connectedAdapters = 0;
    for (const name of Object.keys(interfaces)) {
      const ifaces = interfaces[name];
      if (ifaces) {
        // Only count interfaces that are IPv4, non-internal, and not purely loopback
        if (ifaces.some(iface => !iface.internal && iface.family === 'IPv4' && iface.address !== '127.0.0.1')) {
          connectedAdapters++;
        }
      }
    }

    const data = {
      cpu: cpuUsage,
      ram: memUsage.usedRamGb,
      totalRam: memUsage.totalRamGb,
      disk: diskUsage.usedDiskGb,
      totalDisk: diskUsage.totalDiskGb,
      uptime: os.uptime(),
      hostname: os.hostname(),
      osVersion: `${os.type()} ${os.release()}`,
      connectedAdapters,
    };

    this.logger.info(`[Dashboard Trace] Returning payload: ${JSON.stringify(data)}`);
    return data;
  }

  private async getStats() {
    try {
      // Zero-Assumption: Bypass SQLite table cache if empty, read directly from OS
      const processSnapshot = Win32Metrics.getNativeProcessSnapshot();
      const processCount = processSnapshot.length > 0 ? processSnapshot.length : 0;
      
      const assets = await databaseManager.queryGet<{count: number}>('assets', 'SELECT COUNT(*) as count FROM assets');
      const connections = await databaseManager.queryGet<{count: number}>('network', "SELECT COUNT(*) as count FROM connections WHERE state = 'ESTABLISHED'");
      const risk = await databaseManager.queryGet<{score: number}>('reputation', 'SELECT AVG(risk_score) as score FROM host_reputation');

      return {
        processes: processCount,
        assets: assets?.count || 0,
        connections: connections?.count || 0,
        riskScore: risk?.score == null ? null : Math.round(risk.score),
      };
    } catch (e: any) {
      this.logger.error('Failed to get dashboard stats', { error: e.message });
      throw e;
    }
  }
}

export default DashboardModule;
