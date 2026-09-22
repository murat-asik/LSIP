import { BaseIntelligenceProvider } from '../base-provider';
import { IndicatorType, IntelligenceObject, ProviderCapabilities, RiskLevel } from '../types';
import { httpClient } from '../http-client';
import { isIP } from 'net';

export class OtxProvider extends BaseIntelligenceProvider {
  public readonly id = 'otx';
  public readonly name = 'AlienVault OTX';

  public readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['ip', 'domain', 'hash', 'url'],
    requiresApiKey: true,
    supportsBulk: false,
  };

  public async query(indicator: string, type: IndicatorType): Promise<IntelligenceObject> {
    if (!this.isSupported(type)) {
      throw new Error(`Indicator type ${type} is not supported by ${this.name}`);
    }
    this.checkApiKeyRequired();

    const apiKey = this.config!.apiKey!;
    let otxType = '';

    switch (type) {
      case 'ip': otxType = isIP(indicator) === 6 ? 'IPv6' : 'IPv4'; break;
      case 'domain': otxType = 'domain'; break;
      case 'hash': otxType = 'file'; break;
      case 'url': otxType = 'url'; break;
      default: throw new Error(`Unsupported indicator type ${type} for OTX`);
    }

    const url = `https://otx.alienvault.com/api/v1/indicators/${otxType}/${encodeURIComponent(indicator)}/general`;

    const response = await httpClient.request(url, {
      method: 'GET',
      headers: {
        'X-OTX-API-KEY': apiKey,
        'Accept': 'application/json',
      },
      timeoutMs: this.config?.timeoutMs || 10000,
    });

    const data = response.data;
    if (!data || data.indicator !== indicator) {
      throw new Error('Invalid payload received from AlienVault OTX API');
    }

    const pulseCount = data.pulse_info?.count || 0;
    
    let risk: RiskLevel = 'none';
    let confidence = 0;

    if (pulseCount >= 10) {
      risk = 'critical';
      confidence = 90;
    } else if (pulseCount >= 3) {
      risk = 'high';
      confidence = 80;
    } else if (pulseCount >= 1) {
      risk = 'medium';
      confidence = 70;
    } else {
      risk = 'unknown';
      confidence = 0;
    }

    return {
      indicator,
      type,
      risk,
      confidence,
      source: this.id,
      providerName: this.name,
      isConfigured: true,
      timestamp: Date.now(),
      country: data.base_indicator?.country_name,
      tags: data.pulse_info?.pulses?.flatMap((p: any) => p.tags) || [],
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
      throw err;
    }
  }
}
