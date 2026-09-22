import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { message } from "../i18n";
import { t as translateText } from "../i18n";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../stores/app.store';
import { useWorkspaceSessionStore } from '../stores/workspace-session.store';
import { useTranslation } from '../i18n';
import {
  Globe,
  Search,
  RefreshCw,
  Shield,
  Database,
  Cloud,
  Clock,
  Trash2,
  WifiOff,
  Wifi,
  Activity,
  Server,
  Filter,
  AlertTriangle,
  FileText,
  MapPin,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Terminal,
  ExternalLink,
  Zap,
  ChevronRight,
  ChevronDown,
  Info,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export type IndicatorType = 'ip' | 'domain' | 'url' | 'hash' | 'certificate' | 'hostname' | 'asn';
export type DataProvenance = 'LOCAL' | 'OFFLINE VERIFIED' | 'LIVE' | 'CLOUD' | 'CACHED';

export interface ProvenanceTag {
  label: string;
  provenance: DataProvenance;
  source: string;
}

export interface CloudIntelligenceItem {
  providerId: string;
  providerName: string;
  isConfigured: boolean;
  status: 'healthy' | 'api_not_configured' | 'rate_limited' | 'failed' | 'timeout' | 'offline';
  risk: string;
  confidence: number;
  timestamp: number;
  provenance: DataProvenance;
  details: Record<string, any>;
  rawResponse?: any;
  httpStatus?: number;
  requestDurationMs?: number;
  country?: string;
  asn?: string;
  asnOwner?: string;
  domain?: string;
  hostnames?: string[];
  usageType?: string;
  isTor?: boolean;
  isWhitelisted?: boolean;
  isPublic?: boolean;
  totalReports?: number;
  numDistinctUsers?: number;
  lastReportedAt?: string;
  categories?: string[];
  errorDetails?: string;
}

export interface InvestigationMetadata {
  investigationId: string;
  executionTimestamp: number;
  totalDurationMs: number;
  correlationDurationMs: number;
  providerCount: number;
  providerSuccessCount: number;
  providerFailureCount: number;
  providerUnconfiguredCount: number;
  providerCachedCount: number;
}

export interface UnifiedInvestigationResult {
  indicator: string;
  type: IndicatorType;
  unifiedRiskScore: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  provenanceBadges: ProvenanceTag[];
  cacheInfo?: {
    isCached: boolean;
    cachedAt: number;
    ttlSecondsRemaining: number;
  };
  localIntelligence: {
    hostId: string;
    riskScore: number;
    factorsCount: number;
    associatedEventsCount: number;
    factors: Array<{ label: string; severity: string; description: string }>;
    recommendations: string[];
    provenance: DataProvenance;
  };
  cloudIntelligence: CloudIntelligenceItem[];
  investigationMetadata: InvestigationMetadata;
  timestamp: number;
}

interface ProviderHealth {
  id: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  reachable: boolean;
  apiValid: boolean;
  status: string;
  latencyMs: number;
  cacheHits: number;
  cacheMisses: number;
  requests: number;
  failures: number;
}

interface HistoryItem {
  id: string;
  indicator: string;
  type: IndicatorType;
  riskLevel: string;
  score: number;
  sourcesCount: number;
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: RECURSIVE RAW INTELLIGENCE VIEWER (No depth limit, handles everything)
// ─────────────────────────────────────────────────────────────────────────────
const RecursiveDataViewer: React.FC<{
  data: any;
  defaultExpanded?: boolean;
  level?: number;
  keyName?: string;
}> = ({ data, defaultExpanded = false, level = 0, keyName }) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded || level < 2);

  if (data === null || data === undefined) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
        {keyName && <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{keyName}:</span>}
        <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>null</span>
      </div>
    );
  }

  if (typeof data !== 'object') {
    let color = '#e2e8f0';
    if (typeof data === 'boolean') color = data ? '#10b981' : '#ef4444';
    else if (typeof data === 'number') color = '#f59e0b';
    else if (typeof data === 'string' && (data.startsWith('http') || data.includes('T') && data.endsWith('Z'))) color = '#60a5fa';

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', wordBreak: 'break-all' }}>
        {keyName && <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{keyName}:</span>}
        <span style={{ color }}>{typeof data === 'string' ? `"${data}"` : String(data)}</span>
      </div>
    );
  }

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);

  if (keys.length === 0) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
        {keyName && <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{keyName}:</span>}
        <span style={{ color: 'var(--text-tertiary)' }}>{isArray ? '[]' : '{}'}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        marginLeft: level > 0 ? '12px' : '0px',
        borderLeft: level > 0 ? '1px dashed rgba(255, 255, 255, 0.15)' : 'none',
        paddingLeft: level > 0 ? '8px' : '0px',
        marginTop: '2px',
        marginBottom: '2px',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '0.78rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          userSelect: 'none',
          padding: '2px 4px',
          borderRadius: '4px',
          transition: 'background 0.15s',
        }}
        className="fluent-hover"
      >
        <span style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', fontSize: '0.65rem' }}>
          ▶
        </span>
        {keyName && <span style={{ color: '#38bdf8', fontWeight: 600 }}>{keyName}:</span>}
        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
          {isArray ? `Array [${keys.length}]` : `Object {${keys.length}}`}
        </span>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
          {keys.map((k) => (
            <RecursiveDataViewer key={k} data={data[k]} keyName={isArray ? undefined : k} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COUNTRY FLAG UTILITY (ISO Code to Emoji / Flag Badge)
// ─────────────────────────────────────────────────────────────────────────────
const getCountryFlag = (countryCode?: string) => {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const code = countryCode.toUpperCase();
  const offset = 127397;
  try {
    return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
  } catch {
    return '🌐';
  }
};

// Helper for relative timestamps
const formatRelativeTime = (timestamp?: number | string) => {
  if (!timestamp) return 'N/A';
  const timeMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  if (isNaN(timeMs) || timeMs <= 0) return String(timestamp);
  
  const diffSec = Math.floor((Date.now() - timeMs) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

export const InternetInvestigation: React.FC = () => {
  const { isOnlineMode } = useAppStore();
  const { t } = useTranslation();
  const { internetSession, setInternetSession } = useWorkspaceSessionStore();

  const inputQuery = internetSession.inputQuery;
  const setInputQuery = (q: string) => setInternetSession({ inputQuery: q });
  const investigationResult = internetSession.investigationResult;
  const setInvestigationResult = (res: any) => setInternetSession({ investigationResult: res });

  const [isSearching, setIsSearching] = useState(false);

  // Health and History state
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [rawViewerExpanded, setRawViewerExpanded] = useState(false);
  const [errorDiagnostics, setErrorDiagnostics] = useState<{
    message: string;
    code?: string;
    indicator?: string;
    timestamp?: number;
  } | null>(null);

  const unwrap = (res: any) => (res && typeof res === 'object' && 'success' in res ? (res.success ? res.data : null) : res);

  // Auto-detect indicator type using regex
  const detectedType = useMemo<IndicatorType>(() => {
    const q = inputQuery.trim();
    if (!q) return 'ip';

    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(q)) return 'ip';
    if (/^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/i.test(q) || /^fe80:/i.test(q) || /^::1$/.test(q)) return 'ip';
    if (/^[a-fA-F0-9]{32}$/.test(q) || /^[a-fA-F0-9]{40}$/.test(q) || /^[a-fA-F0-9]{64}$/.test(q)) return 'hash';
    if (/^(https?:\/\/|www\.)/i.test(q)) return 'url';
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(q)) return 'domain';

    return 'ip';
  }, [inputQuery]);

  const loadHealthAndHistory = useCallback(async () => {
    try {
      const [healthRes, historyRes] = await Promise.all([
        window.lsip.invoke('internet:get-health').catch(() => null),
        window.lsip.invoke('correlation:get-history', { searchQuery: historySearch, filterType: historyFilter }).catch(() => null),
      ]);

      const healthData = unwrap(healthRes);
      const historyData = unwrap(historyRes);

      if (Array.isArray(healthData)) setProviderHealth(healthData);
      if (Array.isArray(historyData)) setHistory(historyData);
    } catch (err) {
      console.error('Failed to fetch provider health or history', err);
    }
  }, [historySearch, historyFilter]);

  useEffect(() => {
    loadHealthAndHistory();
    const interval = createViewPolling('internet-investigation', loadHealthAndHistory, 10000);
    return () => stopViewPolling(interval);
  }, [loadHealthAndHistory]);

  const handleSearch = async (overrideIndicator?: string, overrideType?: IndicatorType, forceRefresh = false) => {
    const queryToUse = overrideIndicator || inputQuery.trim();
    const typeToUse = overrideType || detectedType;

    if (!queryToUse) return;

    setIsSearching(true);
    setErrorDiagnostics(null);

    try {
      const res = await window.lsip.invoke('correlation:investigate-indicator', {
        indicator: queryToUse,
        type: typeToUse,
        forceRefresh,
      });

      // Handle IPC response wrapper ({ success, data, error })
      if (res && typeof res === 'object' && 'success' in res && !res.success) {
        const errMsg = res.error?.message || 'IPC Handler Error';
        console.error('[INVESTIGATION IPC FAILURE]', res.error);

        // CLEAR PREVIOUS RESULTS TO PREVENT MISLEADING THE ANALYST
        setInvestigationResult(null);
        setErrorDiagnostics({
          message: errMsg,
          code: res.error?.code || 'IPC_ERROR',
          indicator: queryToUse,
          timestamp: Date.now(),
        });
        return;
      }

      const resultData = unwrap(res);
      if (resultData && resultData.indicator) {
        setInvestigationResult(resultData);
        setErrorDiagnostics(null);
        await loadHealthAndHistory();
      } else {
        // Clear previous results on empty return
        setInvestigationResult(null);
        setErrorDiagnostics({
          message: t('diagnostics.noDataReturned') || 'No telemetry data returned for this query.',
          indicator: queryToUse,
          timestamp: Date.now(),
        });
      }
    } catch (err: any) {
      console.error('[INVESTIGATION RENDERER EXCEPTION]', err);
      // Clear previous results on catch
      setInvestigationResult(null);
      setErrorDiagnostics({
        message: err?.message || 'Execution error during investigation pipeline.',
        indicator: queryToUse,
        timestamp: Date.now(),
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await window.lsip.invoke('correlation:clear-history');
      await loadHealthAndHistory();
    } catch (err) {
      alert(message('Failed to clear history'));
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return '#ef4444';
    if (score >= 40) return '#f59e0b';
    if (score >= 10) return '#3b82f6';
    return '#10b981';
  };

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION 4: DYNAMIC THREAT SUMMARY GENERATOR (From real provider data)
  // ───────────────────────────────────────────────────────────────────────────
  const dynamicThreatSummary = useMemo(() => {
    if (!investigationResult) return '';

    const res = investigationResult;
    const cloudInt = Array.isArray(res.cloudIntelligence) ? res.cloudIntelligence : [];
    const activeProviders = cloudInt.filter((c: CloudIntelligenceItem) => c && c.isConfigured && c.status === 'healthy');
    const totalReports = activeProviders.reduce((acc: number, curr: CloudIntelligenceItem) => acc + (curr?.totalReports || 0), 0);
    const distinctReporters = activeProviders.reduce((acc: number, curr: CloudIntelligenceItem) => acc + (curr?.numDistinctUsers || 0), 0);

    const locations = activeProviders
      .map((c: CloudIntelligenceItem) => (c?.country ? `${c.country} (${c.asnOwner || c.asn || 'ASN'})` : null))
      .filter(Boolean);

    const tags = Array.from(new Set(activeProviders.flatMap((c: CloudIntelligenceItem) => [c?.usageType, ...(Array.isArray(c?.categories) ? c.categories : [])]).filter(Boolean)));

    if ((res.unifiedRiskScore ?? 0) >= 70) {
      return t('internetInvestigation.summaryHigh', {
        indicator: res.indicator || '',
        type: (res.type || 'ip').toUpperCase(),
        score: res.unifiedRiskScore ?? 0,
        totalReports: totalReports.toLocaleString(),
        reporters: distinctReporters > 0 ? distinctReporters : 1,
        location: locations[0] || 'Unknown',
        tags: tags.join(', ') || 'N/A',
        providerCount: activeProviders.length,
      });
    } else if ((res.unifiedRiskScore ?? 0) >= 30) {
      return t('internetInvestigation.summaryModerate', {
        indicator: res.indicator || '',
        type: (res.type || 'ip').toUpperCase(),
        score: res.unifiedRiskScore ?? 0,
        count: activeProviders.length,
        totalReports,
      });
    } else {
      return t('internetInvestigation.summaryLow', {
        indicator: res.indicator || '',
        type: (res.type || 'ip').toUpperCase(),
        score: res.unifiedRiskScore ?? 0,
        count: activeProviders.length,
      });
    }
  }, [investigationResult, t]);

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION 5: DYNAMIC RISK EXPLANATION GENERATOR
  // ───────────────────────────────────────────────────────────────────────────
  const riskExplanationFactors = useMemo(() => {
    if (!investigationResult) return [];

    const factors: string[] = [];
    const res = investigationResult;

    if (res.localIntelligence && res.localIntelligence.riskScore > 0) {
      factors.push(t('internetInvestigation.factorLocal', {
        score: res.localIntelligence.riskScore,
        count: res.localIntelligence.associatedEventsCount ?? 0,
      }));
    }

    const cloudInt = Array.isArray(res.cloudIntelligence) ? res.cloudIntelligence : [];
    cloudInt.forEach((cloud: CloudIntelligenceItem) => {
      if (!cloud || !cloud.isConfigured) return;
      if (cloud.confidence > 0) {
        factors.push(t('internetInvestigation.factorConfidence', {
          providerName: cloud.providerName,
          confidence: cloud.confidence,
          risk: cloud.risk,
        }));
      }
      if (cloud.totalReports && cloud.totalReports > 0) {
        factors.push(t('internetInvestigation.factorReports', {
          providerName: cloud.providerName,
          totalReports: cloud.totalReports.toLocaleString(),
        }));
      }
      if (cloud.numDistinctUsers && cloud.numDistinctUsers > 0) {
        factors.push(t('internetInvestigation.factorReporters', {
          providerName: cloud.providerName,
          count: cloud.numDistinctUsers,
        }));
      }
      if (cloud.lastReportedAt) {
        factors.push(t('internetInvestigation.factorRecent', {
          providerName: cloud.providerName,
          time: `${new Date(cloud.lastReportedAt).toLocaleString()} (${formatRelativeTime(cloud.lastReportedAt)})`,
        }));
      }
      if (cloud.isTor) {
        factors.push(t('internetInvestigation.factorTor', {
          providerName: cloud.providerName,
        }));
      }
      if (cloud.usageType) {
        factors.push(t('internetInvestigation.factorUsage', {
          providerName: cloud.providerName,
          usageType: cloud.usageType,
        }));
      }
    });

    if (factors.length === 0) {
      factors.push(t('internetInvestigation.factorNone'));
    }

    return factors;
  }, [investigationResult, t]);

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION 7: GEOGRAPHICAL INTELLIGENCE DATA
  // ───────────────────────────────────────────────────────────────────────────
  const geoIntelligence = useMemo(() => {
    if (!investigationResult) return null;
    const cloudInt = Array.isArray(investigationResult.cloudIntelligence) ? investigationResult.cloudIntelligence : [];
    const active = cloudInt.find((c: CloudIntelligenceItem) => c && c.isConfigured && (c.country || c.asn || c.asnOwner));
    if (!active) return null;

    return {
      country: active.country || 'Unknown',
      flag: getCountryFlag(active.country),
      asn: active.asn || 'N/A',
      isp: active.asnOwner || 'N/A',
      domain: active.domain || 'N/A',
      hostnames: Array.isArray(active.hostnames) ? active.hostnames : [],
      usageType: active.usageType || 'N/A',
      isTor: active.isTor,
      isWhitelisted: active.isWhitelisted,
      isPublic: active.isPublic,
    };
  }, [investigationResult]);

  // ───────────────────────────────────────────────────────────────────────────
  // SECTION 9: EVIDENCE GENERATOR (From raw provider responses)
  // ───────────────────────────────────────────────────────────────────────────
  const evidenceList = useMemo(() => {
    if (!investigationResult) return [];
    const list: Array<{ providerName: string; reports: any[] }> = [];

    const cloudInt = Array.isArray(investigationResult.cloudIntelligence) ? investigationResult.cloudIntelligence : [];
    cloudInt.forEach((cloud: CloudIntelligenceItem) => {
      if (!cloud || !cloud.isConfigured || !cloud.rawResponse) return;
      const raw = cloud.rawResponse;
      if (Array.isArray(raw.reports) && raw.reports.length > 0) {
        list.push({ providerName: cloud.providerName || 'Provider', reports: raw.reports });
      } else if (Array.isArray(raw.urls) && raw.urls.length > 0) {
        list.push({ providerName: cloud.providerName || 'Provider', reports: raw.urls });
      } else if (Array.isArray(raw.pulses) && raw.pulses.length > 0) {
        list.push({ providerName: cloud.providerName || 'Provider', reports: raw.pulses });
      }
    });

    return list;
  }, [investigationResult]);

  const renderBadge = (prov: DataProvenance, label: string) => {
    let bg = 'rgba(16, 185, 129, 0.15)';
    let color = '#10b981';
    let icon = <Database size={11} />;

    if (prov === 'OFFLINE VERIFIED') {
      bg = 'rgba(20, 184, 166, 0.15)';
      color = '#14b8a6';
      icon = <Shield size={11} />;
    } else if (prov === 'LIVE') {
      bg = 'rgba(59, 130, 246, 0.15)';
      color = '#3b82f6';
      icon = <Globe size={11} />;
    } else if (prov === 'CLOUD') {
      bg = 'rgba(168, 85, 247, 0.15)';
      color = '#a855f7';
      icon = <Cloud size={11} />;
    } else if (prov === 'CACHED') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#f59e0b';
      icon = <Clock size={11} />;
    }

    return (
      <span
        key={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: bg,
          color,
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.5px',
        }}
      >
        {icon} {label}
      </span>
    );
  };

  return (
    <div className="view-container" style={{ padding: '24px', gap: '20px', overflowY: 'auto', height: '100%', backgroundColor: 'var(--bg-primary)' }}>
      
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.3), rgba(168, 85, 247, 0.3))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-primary-hover)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            <Globe size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
                {t('internetInvestigation.consoleTitle')}
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
              {t('internetInvestigation.consoleSubtitle')}
            </p>
          </div>
        </div>

        {/* Offline / Online Mode Banner Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px', borderRadius: '8px',
          border: `1px solid ${isOnlineMode ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          background: isOnlineMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          color: isOnlineMode ? '#3b82f6' : '#f59e0b',
          fontSize: '0.8rem', fontWeight: 600
        }}>
          {isOnlineMode ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>{isOnlineMode ? `${t('common.online')}` : `${t('common.offline')}`}</span>
        </div>
      </div>

      {/* ── SEARCH BAR ────────────────────────────────────────────────────── */}
      <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="fluent-input"
              placeholder={t('internetInvestigation.indicatorPlaceholder')}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ width: '100%', paddingLeft: '38px', paddingRight: '140px', fontSize: '0.9rem', height: '42px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-secondary)' }} />
            
            {/* Auto-Detected Indicator Type Badge */}
            {inputQuery.trim() && (
              <span style={{
                position: 'absolute', right: '12px', top: '9px',
                fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
                background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#3b82f6', textTransform: 'uppercase'
              }}>
                {t('common.detected')}: {detectedType}
              </span>
            )}
          </div>

          <button
            className="fluent-button primary"
            onClick={() => handleSearch()}
            disabled={isSearching || !inputQuery.trim()}
            style={{ padding: '0 24px', height: '42px', gap: '8px', fontSize: '0.88rem', fontWeight: 600 }}
          >
            {isSearching ? <RefreshCw className="spin" size={16} /> : <Search size={16} />}
            {t('internetInvestigation.queryProviders')}
          </button>
        </div>
      </div>

      {/* ── ERROR DIAGNOSTIC CARD (TASK 1: Meaningful Error Diagnostics) ──── */}
      {errorDiagnostics && (
        <div className="fluent-card" style={{
          padding: '20px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444' }}>
              <AlertTriangle size={22} />
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>
                  {t('diagnostics.title')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('diagnostics.subtitle')}
                </div>
              </div>
            </div>
            <button
              className="fluent-button"
              onClick={() => setErrorDiagnostics(null)}
              style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'transparent', border: '1px solid var(--border-primary)' }}
            >
              {t('diagnostics.clearError')}
            </button>
          </div>

          <div style={{
            background: 'var(--bg-primary)',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid var(--border-primary)',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-mono)',
            color: '#f87171',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            <div><strong>{translateText("interfaceText.message056")}</strong> {errorDiagnostics.indicator}</div>
            <div><strong>{translateText("interfaceText.message057")}</strong> {message(errorDiagnostics.message)}</div>
            {errorDiagnostics.code && <div><strong>{translateText("interfaceText.message058")}</strong> {errorDiagnostics.code}</div>}
            {errorDiagnostics.timestamp && <div><strong>{translateText("interfaceText.message059")}</strong> {new Date(errorDiagnostics.timestamp).toISOString()}</div>}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              className="fluent-button primary"
              onClick={() => handleSearch(errorDiagnostics.indicator, undefined, true)}
              style={{ fontSize: '0.8rem', padding: '6px 16px', gap: '6px' }}
            >
              <RefreshCw size={14} /> {t('common.refresh')}
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN INVESTIGATION REPORT ────────────────────────────────────── */}
      {investigationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease-in-out' }}>
          
          {/* SECTION 13: CACHE INFO BAR & FORCE LIVE REFRESH */}
          {investigationResult.cacheInfo && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px', borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
              fontSize: '0.8rem', color: '#f59e0b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} />
                <span>
                  {t('diagnostics.loadedFromCache', {
                    time: new Date(investigationResult.cacheInfo.cachedAt).toLocaleTimeString(),
                    hours: Math.round(investigationResult.cacheInfo.ttlSecondsRemaining / 3600),
                  })}
                </span>
              </div>
              <button
                className="fluent-button"
                onClick={() => handleSearch(investigationResult.indicator, investigationResult.type, true)}
                disabled={!isOnlineMode || isSearching}
                style={{ fontSize: '0.75rem', padding: '4px 12px', gap: '6px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}
              >
                <RefreshCw size={12} className={isSearching ? 'spin' : ''} /> {t('diagnostics.forceLiveRefresh')}
              </button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 1: GENERAL VERDICT HEADER CARD
          ───────────────────────────────────────────────────────────── */}
          <div className="fluent-card" style={{ padding: '20px', borderTop: `4px solid ${getRiskColor(investigationResult.unifiedRiskScore)}`, background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                    {t('diagnostics.generalVerdict')}
                  </span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.08)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {investigationResult.type}
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
                  {investigationResult.indicator}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`status-pill ${investigationResult.unifiedRiskScore >= 70 ? 'danger' : investigationResult.unifiedRiskScore >= 40 ? 'warning' : 'success'}`} style={{ fontSize: '0.9rem', padding: '6px 14px', fontWeight: 700 }}>
                  {investigationResult.riskLevel} {t('diagnostics.verdict')}
                </span>
              </div>
            </div>

            {/* General Verdict Key Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              
              {/* Overall Risk Score Circular Meter */}
              <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '58px', height: '58px', borderRadius: '50%',
                  border: `4px solid ${getRiskColor(investigationResult.unifiedRiskScore)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem', fontWeight: 700, color: getRiskColor(investigationResult.unifiedRiskScore),
                  flexShrink: 0
                }}>
                  {investigationResult.unifiedRiskScore}
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('internetInvestigation.overallRiskScore')}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{translateText("interfaceText.message060")}</div>
                </div>
              </div>

              {/* Provider Counts Stat */}
              <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('internetInvestigation.providersResponded')}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                  {investigationResult.investigationMetadata?.providerSuccessCount ?? 0} / {investigationResult.investigationMetadata?.providerCount ?? 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  {investigationResult.investigationMetadata?.providerUnconfiguredCount ?? 0} {translateText("interfaceText.message061")} {investigationResult.investigationMetadata?.providerFailureCount ?? 0} {translateText("interfaceText.message062")} </div>
              </div>

              {/* Cache Stats */}
              <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('internetInvestigation.cachedProviders')}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f59e0b', marginTop: '2px' }}>
                  {investigationResult.investigationMetadata?.providerCachedCount ?? 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}> {translateText("interfaceText.message063")} </div>
              </div>

              {/* Total Duration */}
              <div style={{ background: 'var(--bg-primary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('internetInvestigation.execDuration')}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#3b82f6', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                  {investigationResult.investigationMetadata?.totalDurationMs ?? 0} ms
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}> {translateText("interfaceText.message059")} {new Date(investigationResult.timestamp).toLocaleTimeString()}
                </div>
              </div>

            </div>

            {/* Badges List */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: '1px solid var(--border-primary)', paddingTop: '12px' }}>
              {(Array.isArray(investigationResult.provenanceTags) ? investigationResult.provenanceTags : []).map((b: ProvenanceTag) => renderBadge(b.provenance, `${b.label}`))}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 4 & 5: DYNAMIC THREAT SUMMARY & RISK EXPLANATION
          ───────────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
            
            {/* SECTION 4: Threat Summary Card */}
            <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <FileText size={16} style={{ color: 'var(--accent-primary)' }} /> {t('internetInvestigation.automatedSummary')}
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {dynamicThreatSummary}
              </p>
            </div>

            {/* SECTION 5: Risk Explanation Card */}
            <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', borderLeft: `4px solid ${getRiskColor(investigationResult.unifiedRiskScore)}` }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <AlertTriangle size={16} style={{ color: getRiskColor(investigationResult.unifiedRiskScore) }} /> {t('internetInvestigation.scoreExplanation')}
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(Array.isArray(riskExplanationFactors) ? riskExplanationFactors : []).map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>

          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 7: GEOGRAPHICAL INTELLIGENCE
          ───────────────────────────────────────────────────────────── */}
          {geoIntelligence && (
            <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={16} style={{ color: '#38bdf8' }} /> {t('internetInvestigation.geoIntelligenceTitle')}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', fontSize: '0.8rem' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', display: 'block' }}>{t('internetInvestigation.country')}</span>
                  <strong style={{ fontSize: '0.95rem' }}>{geoIntelligence.flag} {geoIntelligence.country}</strong>
                </div>

                <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', display: 'block' }}>ASN</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{geoIntelligence.asn}</strong>
                </div>

                <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', display: 'block' }}>{translateText("interfaceText.message064")}</span>
                  <strong>{geoIntelligence.isp}</strong>
                </div>

                <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', display: 'block' }}>{t('internetInvestigation.usageType')}</span>
                  <strong>{geoIntelligence.usageType}</strong>
                </div>

                {geoIntelligence.domain !== 'N/A' && (
                  <div style={{ background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', display: 'block' }}>{translateText("interfaceText.message065")}</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>{geoIntelligence.domain}</strong>
                  </div>
                )}
              </div>

              {Array.isArray(geoIntelligence.hostnames) && geoIntelligence.hostnames.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '0.78rem', background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{translateText("interfaceText.message066")} </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{geoIntelligence.hostnames.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 2 & 10 & 15: GENERIC PROVIDER CARDS GRID
              (ZERO provider-specific code or hardcoded checks!)
          ───────────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} style={{ color: 'var(--accent-primary)' }} /> {translateText("interfaceText.message067")}{(Array.isArray(investigationResult.cloudIntelligence) ? investigationResult.cloudIntelligence : []).length})
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
              {(Array.isArray(investigationResult.cloudIntelligence) ? investigationResult.cloudIntelligence : []).map((cloud: CloudIntelligenceItem) => (
                <div
                  key={cloud.providerId}
                  className="fluent-card"
                  style={{
                    padding: '16px',
                    borderTop: `4px solid ${!cloud.isConfigured ? 'rgba(255, 255, 255, 0.2)' : cloud.status === 'healthy' ? getRiskColor(cloud.confidence) : 'var(--accent-danger)'}`,
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* Provider Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Cloud size={18} style={{ color: cloud.isConfigured ? 'var(--accent-primary-hover)' : 'var(--text-tertiary)' }} />
                        {cloud.providerName}
                      </div>

                      {/* Status Badges */}
                      <div>
                        {!cloud.isConfigured ? (
                          <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}> {translateText("interfaceText.message068")} </span>
                        ) : (
                          renderBadge(cloud.provenance, cloud.provenance)
                        )}
                      </div>
                    </div>

                    {/* ── UNCONFIGURED PROVIDER DISPLAY (Strict Requirement) ── */}
                    {!cloud.isConfigured ? (
                      <div
                        style={{
                          padding: '24px 16px',
                          textAlign: 'center',
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '8px',
                          border: '1px dashed rgba(255, 255, 255, 0.15)',
                          margin: '12px 0',
                        }}
                      >
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}> {translateText("interfaceText.message069")} </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}> {translateText("interfaceText.message070")} </div>
                      </div>
                    ) : (
                      /* ── CONFIGURED PROVIDER LIVE DATA DISPLAY ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        
                        {/* Provider Telemetry Header */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-primary)' }}>
                          <div style={{ fontSize: '0.74rem', background: 'var(--bg-primary)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{translateText("interfaceText.message071")} </span>
                            <strong style={{ color: getRiskColor(cloud.confidence) }}>{cloud.risk}</strong>
                          </div>

                          <div style={{ fontSize: '0.74rem', background: 'var(--bg-primary)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{translateText("interfaceText.message072")} </span>
                            <strong style={{ color: getRiskColor(cloud.confidence) }}>{cloud.confidence}%</strong>
                          </div>

                          {cloud.httpStatus && (
                            <div style={{ fontSize: '0.74rem', background: 'var(--bg-primary)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{translateText("interfaceText.message073")} </span>
                              <strong style={{ color: cloud.httpStatus === 200 ? '#10b981' : '#ef4444' }}>{cloud.httpStatus}</strong>
                            </div>
                          )}

                          {cloud.requestDurationMs !== undefined && (
                            <div style={{ fontSize: '0.74rem', background: 'var(--bg-primary)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{translateText("interfaceText.message074")} </span>
                              <strong style={{ fontFamily: 'var(--font-mono)' }}>{cloud.requestDurationMs} ms</strong>
                            </div>
                          )}
                        </div>

                        {/* Returned Key Metrics & Metadata */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', fontSize: '0.78rem' }}>
                          {cloud.totalReports !== undefined && (
                            <div style={{ background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', display: 'block' }}>{translateText("interfaceText.message075")}</span>
                              <strong style={{ fontSize: '0.95rem', color: '#f59e0b' }}>{cloud.totalReports.toLocaleString()}</strong>
                            </div>
                          )}

                          {cloud.numDistinctUsers !== undefined && (
                            <div style={{ background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', display: 'block' }}>{translateText("interfaceText.message076")}</span>
                              <strong>{cloud.numDistinctUsers}</strong>
                            </div>
                          )}

                          {cloud.lastReportedAt && (
                            <div style={{ background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', display: 'block' }}>{translateText("interfaceText.message077")}</span>
                              <strong style={{ fontSize: '0.75rem' }}>{formatRelativeTime(cloud.lastReportedAt)}</strong>
                            </div>
                          )}

                          {cloud.country && (
                            <div style={{ background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', display: 'block' }}>{translateText("interfaceText.message078")}</span>
                              <strong>{getCountryFlag(cloud.country)} {cloud.country}</strong>
                            </div>
                          )}

                          {cloud.asn && (
                            <div style={{ background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', display: 'block' }}>ASN</span>
                              <strong style={{ fontFamily: 'var(--font-mono)' }}>{cloud.asn}</strong>
                            </div>
                          )}

                          {cloud.isTor !== undefined && (
                            <div style={{ background: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '4px' }}>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', display: 'block' }}>{translateText("interfaceText.message079")}</span>
                              <strong style={{ color: cloud.isTor ? '#ef4444' : '#10b981' }}>{cloud.isTor ? 'YES' : 'NO'}</strong>
                            </div>
                          )}
                        </div>

                        {/* SECTION 3: PER-PROVIDER RECURSIVE RAW VIEWER */}
                        <div style={{ marginTop: '8px' }}>
                          <details style={{ background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)', padding: '8px 12px' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}>
                              <Database size={12} /> {translateText("interfaceText.message080")} </summary>
                            <div style={{ marginTop: '10px', maxHeight: '350px', overflowY: 'auto', overflowX: 'auto', padding: '8px', background: '#090d16', borderRadius: '4px' }}>
                              <RecursiveDataViewer data={cloud.rawResponse || cloud.details} defaultExpanded={false} />
                            </div>
                          </details>
                        </div>

                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 9: RAW EVIDENCE DETAILS (If available)
          ───────────────────────────────────────────────────────────── */}
          {Array.isArray(evidenceList) && evidenceList.length > 0 && (
            <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={16} style={{ color: '#f59e0b' }} /> {translateText("interfaceText.message081")} </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(Array.isArray(evidenceList) ? evidenceList : []).map((ev, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-primary-hover)' }}>
                      {ev.providerName} {translateText("interfaceText.message082")}{(Array.isArray(ev.reports) ? ev.reports : []).length} {translateText("interfaceText.message083")} </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto' }}>
                      {(Array.isArray(ev.reports) ? ev.reports : []).slice(0, 10).map((r: any, rIdx: number) => (
                        <div key={rIdx} style={{ fontSize: '0.75rem', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {r.comment || r.url || r.name || `Report #${rIdx + 1}`}
                          </div>
                          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem', marginTop: '2px', display: 'flex', gap: '12px' }}>
                            {r.reportedAt && <span>{translateText("interfaceText.message084")} {new Date(r.reportedAt).toLocaleString()}</span>}
                            {r.reporterCountryName && <span>{translateText("interfaceText.message085")} {r.reporterCountryName}</span>}
                            {r.categories && <span>{translateText("interfaceText.message086")} {Array.isArray(r.categories) ? r.categories.join(', ') : String(r.categories)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              SECTION 14: INVESTIGATION METADATA PANEL
          ───────────────────────────────────────────────────────────── */}
          <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} style={{ color: '#a855f7' }} /> {translateText("interfaceText.message087")} </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.78rem' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>{translateText("interfaceText.message088")}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{investigationResult.investigationMetadata?.investigationId}</span>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>{translateText("interfaceText.message089")}</span>
                <span style={{ fontWeight: 600 }}>{new Date(investigationResult.investigationMetadata?.executionTimestamp || Date.now()).toLocaleString()}</span>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>{translateText("interfaceText.message090")}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{investigationResult.investigationMetadata?.correlationDurationMs} ms</span>
              </div>

              <div style={{ background: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>{translateText("interfaceText.message091")}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#3b82f6' }}>{investigationResult.investigationMetadata?.totalDurationMs} ms</span>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              SECTION 3: MASTER UNIFIED RAW JSON VIEWER
          ───────────────────────────────────────────────────────────── */}
          <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={16} style={{ color: '#10b981' }} /> {translateText("interfaceText.message092")} </div>
              <button
                className="fluent-button"
                onClick={() => setRawViewerExpanded(!rawViewerExpanded)}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              >
                {rawViewerExpanded ? 'Collapse All' : 'Expand View'}
              </button>
            </div>

            <div style={{ background: '#070a12', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-primary)', maxHeight: rawViewerExpanded ? '800px' : '300px', overflowY: 'auto', overflowX: 'auto' }}>
              <RecursiveDataViewer data={investigationResult} defaultExpanded={rawViewerExpanded} />
            </div>
          </div>

        </div>
      )}

      {/* ── SECTION 11: PROVIDER HEALTH & STATUS PANEL ────────────────────── */}
      <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
          <Activity size={18} style={{ color: 'var(--accent-success)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{translateText("interfaceText.message093")}</h2>
        </div>

        <div className="fluent-table-container">
          <table className="fluent-table">
            <thead>
              <tr>
                <th>{translateText("interfaceText.message094")}</th>
                <th>{translateText("interfaceText.message095")}</th>
                <th>{translateText("interfaceText.message096")}</th>
                <th>{translateText("interfaceText.message097")}</th>
                <th>{translateText("interfaceText.message098")}</th>
                <th>{translateText("interfaceText.message099")}</th>
                <th>{translateText("interfaceText.message100")}</th>
                <th>{translateText("interfaceText.message101")}</th>
                <th>{translateText("interfaceText.message102")}</th>
                <th>{translateText("interfaceText.message103")}</th>
              </tr>
            </thead>
            <tbody>
              {!Array.isArray(providerHealth) || providerHealth.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '16px' }}> {translateText("interfaceText.message104")} </td>
                </tr>
              ) : (
                providerHealth.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>
                      <span className={`status-pill ${p.status === 'Healthy' ? 'success' : p.status === 'Waiting For Connection' ? 'warning' : 'danger'}`}>
                        {message(p.status)}
                      </span>
                    </td>
                    <td>{p.enabled ? '✓' : '✗'}</td>
                    <td>{p.configured ? '✓' : '✗'}</td>
                    <td>{p.reachable ? '✓' : '✗'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.latencyMs} ms</td>
                    <td style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{p.cacheHits}</td>
                    <td style={{ color: 'var(--accent-warning)' }}>{p.cacheMisses}</td>
                    <td>{p.requests}</td>
                    <td style={{ color: p.failures > 0 ? 'var(--accent-danger)' : 'var(--text-tertiary)' }}>{p.failures}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 11 & HISTORICAL INVESTIGATIONS (SQLite Persistent) ──── */}
      <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: 'var(--accent-primary-hover)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{translateText("interfaceText.message105")}</h2>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} style={{ color: 'var(--text-tertiary)' }} />
              <select
                className="fluent-input"
                style={{ fontSize: '0.78rem', padding: '2px 8px' }}
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
              >
                <option value="all">{translateText("interfaceText.message106")}</option>
                <option value="ip">IP</option>
                <option value="domain">{translateText("interfaceText.message065")}</option>
                <option value="url">URL</option>
                <option value="hash">{translateText("interfaceText.message107")}</option>
              </select>
            </div>

            <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px' }}>
              <Search size={13} style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder={translateText("interfaceText.message108")}
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.78rem', width: '130px' }}
              />
            </div>

            <button className="fluent-button" onClick={handleClearHistory} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
              <Trash2 size={12} /> {translateText("interfaceText.message109")} </button>
          </div>
        </div>

        <div className="fluent-table-container" style={{ maxHeight: '220px', overflowY: 'auto' }}>
          <table className="fluent-table">
            <thead>
              <tr>
                <th>{translateText("interfaceText.message110")}</th>
                <th>{translateText("interfaceText.message111")}</th>
                <th>{translateText("interfaceText.message112")}</th>
                <th>{translateText("interfaceText.message113")}</th>
                <th>{translateText("interfaceText.message114")}</th>
                <th>{translateText("interfaceText.message115")}</th>
                <th>{translateText("interfaceText.message116")}</th>
              </tr>
            </thead>
            <tbody>
              {!Array.isArray(history) || history.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px' }}> {translateText("interfaceText.message117")} </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(item.timestamp).toLocaleString()}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>{item.type}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 500 }}>{item.indicator}</td>
                    <td>
                      <span className={`status-pill ${item.score >= 70 ? 'danger' : item.score >= 40 ? 'warning' : 'success'}`}>
                        {item.riskLevel}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: getRiskColor(item.score) }}>{item.score}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{item.sourcesCount}</td>
                    <td>
                      <button
                        className="fluent-button primary"
                        onClick={() => {
                          setInputQuery(item.indicator);
                          handleSearch(item.indicator, item.type);
                        }}
                        style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                      > {translateText("interfaceText.message118")} </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default InternetInvestigation;
