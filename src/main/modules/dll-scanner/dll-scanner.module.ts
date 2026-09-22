import { BaseModule } from '../base-module';
import { DllCollector } from './dll-collector';
import { DllEntry, DllSummary } from '../../../shared/types/dll.types';

export class DllScannerModule extends BaseModule {
  public readonly name = 'dlls';
  public readonly displayName = 'DLL Scanner';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing DLL Scanner Module...');

    this.registerIpcHandler<{ pid?: number }, DllSummary>('summary', async (payload) => {
      const dlls = await DllCollector.getModules(payload?.pid);
      
      const uniqueDlls = new Set(dlls.map(d => d.filePath.toLowerCase()));
      const unsigned = dlls.filter(d => !d.isSigned && !d.isSystem);

      return {
        totalLoadedModules: dlls.length,
        uniqueDlls: uniqueDlls.size,
        unsignedDlls: unsigned.length,
        modules: dlls,
      };
    });

    this.registerIpcHandler<{ pid?: number }, DllEntry[]>('list', async (payload) => {
      return DllCollector.getModules(payload?.pid);
    });

    this.logger.info('DLL Scanner Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down DLL Scanner Module...');
    this.unregisterIpcHandlers();
  }
}
export default DllScannerModule;
