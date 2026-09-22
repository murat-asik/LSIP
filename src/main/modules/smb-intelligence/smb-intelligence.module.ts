import { BaseModule } from '../base-module';
import { SmbCollector } from './smb-collector';
import { SmbShare, SmbSession, SmbSummary } from '../../../shared/types/smb.types';

export class SmbIntelligenceModule extends BaseModule {
  public readonly name = 'smb';
  public readonly displayName = 'SMB Intelligence';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing SMB Intelligence Module...');

    this.registerIpcHandler<void, SmbSummary>('summary', async () => {
      const [shares, sessions] = await Promise.all([
        SmbCollector.getShares(),
        SmbCollector.getSessions(),
      ]);

      return {
        totalShares: shares.length,
        hiddenShares: shares.filter(s => s.isHidden).length,
        activeSessions: sessions.length,
        recentAccessEvents: [],
        shares,
      };
    });

    this.registerIpcHandler<void, SmbShare[]>('shares', async () => {
      return SmbCollector.getShares();
    });

    this.registerIpcHandler<void, SmbSession[]>('sessions', async () => {
      return SmbCollector.getSessions();
    });

    this.logger.info('SMB Intelligence Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down SMB Intelligence Module...');
    this.unregisterIpcHandlers();
  }
}
export default SmbIntelligenceModule;
