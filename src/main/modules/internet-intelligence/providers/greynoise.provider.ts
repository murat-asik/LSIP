import { BaseIntelligenceProvider } from '../base-provider';
import { IndicatorType, IntelligenceObject, ProviderCapabilities, RiskLevel } from '../types';
import { httpClient } from '../http-client';

export class GreyNoiseProvider extends BaseIntelligenceProvider {
  public readonly id = 'greynoise';
  public readonly name = 'GreyNoise';

  public readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['ip'],
    requiresApiKey: true,
    supportsBulk: false,
  };

  public async query(indicator: string, type: IndicatorType): Promise<IntelligenceObject> {
    if (!this.isSupported(type)) {
      throw new Error(`Indicator type ${type} is not supported by ${this.name}`);
    }
    this.checkApiKeyRequired();

    const apiKey = this.config!.apiKey!;
    const url = `https://api.greynoise.io/v2/noise/quick/${encodeURIComponent(indicator)}`;

    const response = await httpClient.request(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'key': apiKey,
      },
      timeoutMs: this.config?.timeoutMs || 10000,
    });

    const data = response.data;
    if (!data) {
      throw new Error('Invalid payload received from GreyNoise API');
    }

    const classification = data.classification || 'unknown';
    const isNoise = data.noise || false;
    const isRiot = data.riot || false;

    let risk: RiskLevel = 'none';
    if (classification === 'malicious') risk = 'high';
    else if (isNoise) risk = 'medium';
    else if (isRiot) risk = 'none';

    return {
      indicator,
      type,
      risk,
      confidence: classification === 'malicious' ? 85 : isNoise ? 50 : 10,
      source: this.id,
      providerName: this.name,
      isConfigured: true,
      timestamp: Date.now(),
      rawResponse: response.data,
      httpStatus: response.status,
      requestDurationMs: response.durationMs,
      metadata: data,
    };
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.config?.apiKey) return false;
    try {
      await this.query('8.8.8.8', 'ip');
      return true;
    } catch (err: any) {
      this.log.warn(`Health check failed for ${this.name}: ${err.message}`);
      return false;
    }
  }
}
