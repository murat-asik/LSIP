import { providerManager } from '../provider-manager';
import { AbuseIPDBProvider } from './abuseipdb.provider';
import { VirusTotalProvider } from './virustotal.provider';
import { UrlHausProvider } from './urlhaus.provider';
import { HybridAnalysisProvider } from './hybridanalysis.provider';
import { OtxProvider } from './otx.provider';
import { IPQualityScoreProvider } from './ipqualityscore.provider';
import { ShodanProvider } from './shodan.provider';
import { GreyNoiseProvider } from './greynoise.provider';
import { createModuleLogger } from '../../../core/logger';

const log = createModuleLogger('internet-providers-registry');

/**
 * Registers all built-in Internet Intelligence providers into the ProviderManager.
 * Future providers can be added here or dynamically registered without changing core logic.
 */
export function registerAllProviders(): void {
  const providers = [
    new AbuseIPDBProvider(),
    new VirusTotalProvider(),
    new UrlHausProvider(),
    new HybridAnalysisProvider(),
    new OtxProvider(),
    new IPQualityScoreProvider(),
    new ShodanProvider(),
    new GreyNoiseProvider(),
  ];

  for (const provider of providers) {
    try {
      providerManager.registerProvider(provider);
    } catch (err: any) {
      log.warn(`Provider ${provider.id} already registered or registration failed: ${err.message}`);
    }
  }

  log.info(`Successfully registered ${providers.length} Internet Intelligence Providers.`);
}
