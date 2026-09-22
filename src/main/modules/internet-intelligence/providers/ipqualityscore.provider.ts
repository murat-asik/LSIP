import { BaseIntelligenceProvider } from '../base-provider';
import { IndicatorType, IntelligenceObject, ProviderCapabilities, RiskLevel } from '../types';
import { httpClient } from '../http-client';

export class IPQualityScoreProvider extends BaseIntelligenceProvider {
  public readonly id = 'ipqualityscore';
  public readonly name = 'IPQualityScore';

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
    const url = `https://ipqualityscore.com/api/json/ip/${apiKey}/${encodeURIComponent(indicator)}`;

    const response = await httpClient.request(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      timeoutMs: this.config?.timeoutMs || 10000,
    });

    const data = response.data;
    if (!data || data.success === false) {
      throw new Error(data?.message || 'Invalid payload received from IPQualityScore API');
    }

    const fraudScore = data.fraud_score || 0;

    let risk: RiskLevel = 'none';
    if (fraudScore >= 90) risk = 'critical';
    else if (fraudScore >= 75) risk = 'high';
    else if (fraudScore >= 40) risk = 'medium';
    else if (fraudScore >= 1) risk = 'low';

    return {
      indicator,
      type,
      risk,
      confidence: fraudScore, // IPQS uses 0-100 fraud score
      source: this.id,
      providerName: this.name,
      isConfigured: true,
      timestamp: Date.now(),
      country: data.country_code,
      asn: data.ASN ? `AS${data.ASN}` : undefined,
      asnOwner: data.ISP,
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
