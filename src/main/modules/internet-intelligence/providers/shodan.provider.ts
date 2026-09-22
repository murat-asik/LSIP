import { BaseIntelligenceProvider } from '../base-provider';
import { IndicatorType, IntelligenceObject, ProviderCapabilities, RiskLevel } from '../types';
import { httpClient } from '../http-client';

export class ShodanProvider extends BaseIntelligenceProvider {
  public readonly id = 'shodan';
  public readonly name = 'Shodan';

  public readonly capabilities: ProviderCapabilities = {
    supportedTypes: ['ip', 'domain'],
    requiresApiKey: true,
    supportsBulk: false,
  };

  public async query(indicator: string, type: IndicatorType): Promise<IntelligenceObject> {
    if (!this.isSupported(type)) {
      throw new Error(`Indicator type ${type} is not supported by ${this.name}`);
    }
    this.checkApiKeyRequired();

    const apiKey = this.config!.apiKey!;
    const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(indicator)}?key=${apiKey}`;

    const response = await httpClient.request(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      timeoutMs: this.config?.timeoutMs || 10000,
    });

    const data = response.data;
    if (!data) {
      throw new Error('Invalid payload received from Shodan API');
    }

    const openPortsCount = Array.isArray(data.ports) ? data.ports.length : 0;
    const vulnsCount = data.vulns ? Object.keys(data.vulns).length : 0;

    let risk: RiskLevel = 'none';
    if (vulnsCount >= 5) risk = 'critical';
    else if (vulnsCount > 0 || openPortsCount >= 10) risk = 'high';
    else if (openPortsCount >= 3) risk = 'medium';
    else if (openPortsCount > 0) risk = 'low';

    const confidence = Math.min(100, (vulnsCount * 15) + (openPortsCount * 5));

    return {
      indicator,
      type,
      risk,
      confidence,
      source: this.id,
      providerName: this.name,
      isConfigured: true,
      timestamp: Date.now(),
      country: data.country_code,
      asn: data.asn,
      asnOwner: data.org || data.isp,
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
