import { BaseModule } from '../base-module';
import { CertCollector } from './cert-collector';
import { CertEntry, CertSummary } from '../../../shared/types/cert.types';

export class CertScannerModule extends BaseModule {
  public readonly name = 'certs';
  public readonly displayName = 'Certificate Scanner';

  public async initialize(): Promise<void> {
    this.logger.info('Initializing Certificate Scanner Module...');

    this.registerIpcHandler<void, CertSummary>('summary', async () => {
      const certs = await CertCollector.getCertificates();
      
      const expired = certs.filter(c => c.isExpired);
      const selfSigned = certs.filter(c => c.isSelfSigned);
      const personal = certs.filter(c => c.storeName.toLowerCase() === 'my');

      return {
        totalCerts: certs.length,
        expiredCerts: expired.length,
        selfSignedCerts: selfSigned.length,
        personalCerts: personal.length,
        certificates: certs,
      };
    });

    this.registerIpcHandler<void, CertEntry[]>('list', async () => {
      return CertCollector.getCertificates();
    });

    this.logger.info('Certificate Scanner Module initialized.');
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down Certificate Scanner Module...');
    this.unregisterIpcHandlers();
  }
}
export default CertScannerModule;
