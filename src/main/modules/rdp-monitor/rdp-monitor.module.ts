import { BaseModule } from '../base-module';
import { RdpCollector } from './rdp-collector';
import { RdpSession, RdpLoginEvent, RdpSummary } from '../../../shared/types/rdp.types';

export class RdpMonitorModule extends BaseModule {
  public readonly name = 'rdp';
  public readonly displayName = 'RDP Monitor';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing RDP Monitor Module...');

    this.registerIpcHandler<void, RdpSummary>('summary', async () => {
      const [sessions, events] = await Promise.all([
        RdpCollector.getActiveSessions(),
        RdpCollector.getRdpEvents(200),
      ]);

      const uniqueIps = new Set(events.filter(e => e.sourceIp).map(e => e.sourceIp));

      return {
        activeSessions: sessions.filter(s => s.state === 'Active').length,
        totalLoginEvents: events.length,
        failedAttempts: events.filter(e => e.eventType === 'failed').length,
        uniqueSourceIps: uniqueIps.size,
        recentEvents: events.slice(0, 50),
        sessions,
      };
    });

    this.registerIpcHandler<void, RdpSession[]>('sessions', async () => {
      return RdpCollector.getActiveSessions();
    });

    this.registerIpcHandler<{ limit?: number }, RdpLoginEvent[]>('events', async (payload) => {
      return RdpCollector.getRdpEvents(payload?.limit || 100);
    });

    this.logger.info('RDP Monitor Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down RDP Monitor Module...');
    this.unregisterIpcHandlers();
  }
}
export default RdpMonitorModule;
