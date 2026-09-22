export type IndicatorType = 'ip' | 'domain' | 'url' | 'hash' | 'certificate' | 'hostname' | 'asn';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export interface IntelligenceObject {
  /** The specific indicator that was queried (e.g. "8.8.8.8", "evil.com") */
  indicator: string;
  type: IndicatorType;
  
  /** Normalized risk level */
  risk: RiskLevel;
  
  /** Confidence score from 0 to 100 */
  confidence: number;
  
  /** Which provider supplied this intelligence */
  source: string;
  
  /** Timestamp of when this intelligence was generated or retrieved */
  timestamp: number;
  
  /** Raw/Additional metadata provided by the source */
  metadata: Record<string, any>;

  /** 
   * Rule #4 & #5: Preserve the ENTIRE live payload exactly as the provider returned it 
   */
  rawResponse?: any;
  
  /** Rule #6: Request Metadata */
  requestDurationMs?: number;
  httpStatus?: number;

  /** Provider human-readable display name */
  providerName?: string;

  /** Whether the provider has valid configuration / API key */
  isConfigured?: boolean;

  // Optional normalized fields based on type
  country?: string;
  asn?: string;
  asnOwner?: string;
  tags?: string[];
  malwareFamily?: string;
  provenance?: string;
}

export interface ProviderRateLimit {
  requestsPerMinute?: number;
  requestsPerDay?: number;
}

export interface ProviderCapabilities {
  supportedTypes: IndicatorType[];
  requiresApiKey: boolean;
  supportsBulk: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  configured?: boolean;
  timeoutMs: number;
  rateLimit: ProviderRateLimit;
  priority?: number;
}

export interface IIntelligenceProvider {
  /** The unique identifier of the provider (e.g. "abuseipdb", "virustotal") */
  readonly id: string;
  
  /** The display name of the provider */
  readonly name: string;
  
  /** What this provider is capable of querying */
  readonly capabilities: ProviderCapabilities;

  /** Initialize the provider with configuration */
  initialize(config: ProviderConfig): Promise<void>;

  /** 
   * Query a single indicator.
   * Throws an error if the type is unsupported or networking fails.
   */
  query(indicator: string, type: IndicatorType): Promise<IntelligenceObject>;

  /**
   * Performs a bulk query if supported by the provider.
   */
  queryBulk?(indicators: string[], type: IndicatorType): Promise<IntelligenceObject[]>;

  /**
   * Validates if the provider is currently reachable and API keys are valid.
   */
  healthCheck(): Promise<boolean>;
}

export interface GlobalInternetConfig {
  enabled: boolean;
  offlineMode: boolean;
  cacheTtlSeconds: number;
}
