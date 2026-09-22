import { BaseModule } from '../base-module';
import { correlationEngine } from './correlation-engine';
import { IndicatorType } from '../internet-intelligence/types';
import { createModuleLogger } from '../../core/logger';

const log = createModuleLogger('correlation-engine.module');

export class CorrelationEngineModule extends BaseModule {
  public readonly name = 'correlation';
  public readonly displayName = 'Correlation Engine Module';

  public async initialize(): Promise<void> {
    console.log('[Correlation] initialize() called');
    await correlationEngine.initialize();
    this.registerIpcHandlers();
    log.info('Correlation Engine Module initialized successfully.');
  }

  public async shutdown(): Promise<void> {
    log.info('Correlation Engine Module shut down.');
  }

  private registerIpcHandlers(): void {
    this.registerIpcHandler('investigate-ip', async ({ ipAddress }: { ipAddress: string }) => {
      return await correlationEngine.investigateIp(ipAddress);
    });

    this.registerIpcHandler('investigate-indicator', async (payload: { indicator: string; type: IndicatorType; forceRefresh?: boolean }) => {
      console.log('[MAIN IPC] INPUT OBJECT (From Preload):', JSON.stringify(payload, null, 2));
      
      const result = await correlationEngine.investigateIndicator(payload.indicator, payload.type, payload.forceRefresh);
      
      console.log('[MAIN IPC] OUTPUT OBJECT (From Correlation Engine, to Preload):', JSON.stringify(result, null, 2));
      return result;
    });

    this.registerIpcHandler('get-history', async (payload?: { searchQuery?: string; filterType?: string }) => {
      return await correlationEngine.getHistory(payload?.searchQuery, payload?.filterType);
    });

    this.registerIpcHandler('clear-history', async () => {
      await correlationEngine.clearHistory();
      return true;
    });
  }
}
