import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { message } from "../i18n";
import { t as translateText } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '../i18n';
import {
  ShieldAlert,
  Shield,
  ShieldX,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  X,
  ChevronRight,
  Activity,
  Server,
  Globe,
  Database,
  Cloud,
  Layers,
} from 'lucide-react';

interface RiskFactor {
  id?: string;
  category?: string;
  label: string;
  description: string;
  weight?: number;
  severity: string;
  evidence?: string;
  timestamp?: number;
}

interface HostReputation {
  hostId: string;
  ipAddress?: string;
  hostname?: string;
  riskScore: number;
  confidence: number;
  lastCalculated: number;
  factors: RiskFactor[];
  recommendations: string[];
  trend: 'rising' | 'stable' | 'declining';
  scoreHistory: { score: number; timestamp: number; delta: number }[];
}

interface ReputationSummary {
  totalHosts: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  averageScore: number;
  lastScanTime: number;
  topThreats: HostReputation[];
}

interface UnifiedCorrelation {
  indicator: string;
  unifiedRiskScore: number;
  riskLevel: string;
  provenanceBadges: Array<{ label: string; provenance: string; source: string }>;
  localIntelligence: {
    hostId: string;
    riskScore: number;
    factorsCount: number;
    associatedEventsCount: number;
    factors: RiskFactor[];
    recommendations: string[];
    provenance: string;
  };
  cloudIntelligence: Array<{
    providerId: string;
    providerName: string;
    risk: string;
    confidence: number;
    timestamp: number;
    provenance: string;
    details: Record<string, any>;
    country?: string;
    asn?: string;
    asnOwner?: string;
  }>;
}

export const ReputationEngine: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ReputationSummary | null>(null);
  const [hosts, setHosts] = useState<HostReputation[]>([]);
  const [selectedHost, setSelectedHost] = useState<HostReputation | null>(null);
  const [correlationData, setCorrelationData] = useState<UnifiedCorrelation | null>(null);
  const [isCorrelating, setIsCorrelating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, hostsRes] = await Promise.all([
        window.lsip.invoke('reputation:summary'),
        window.lsip.invoke('reputation:list', { searchQuery, limit: 200 }),
      ]);
      if (summaryRes?.success) setSummary(summaryRes.data);
      if (hostsRes?.success) setHosts(hostsRes.data);
    } catch (err) {
      console.error('Reputation fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
    const interval = createViewPolling('reputation', fetchData, 15000);
    return () => stopViewPolling(interval);
  }, [fetchData]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await window.lsip.invoke('reputation:recalculate');
      await fetchData();
    } catch (err) {
      console.error('Recalculation error:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleHostClick = async (host: HostReputation) => {
    setSelectedHost(host);
    setIsCorrelating(true);
    setCorrelationData(null);
    try {
      // Run unified correlation investigation (Local + Cloud AbuseIPDB)
      const res = await window.lsip.invoke('correlation:investigate-ip', { ipAddress: host.hostId });
      const data = res?.success ? res.data : res;
      if (data) {
        setCorrelationData(data);
      }
    } catch (err) {
      console.error('Correlation error:', err);
    } finally {
      setIsCorrelating(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'var(--accent-danger)';
    if (score >= 30) return 'var(--accent-warning)';
    return 'var(--accent-success)';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    if (score >= 10) return 'LOW';
    return 'SAFE';
  };

  const getRiskPillClass = (score: number) => {
    if (score >= 70) return 'danger';
    if (score >= 30) return 'warning';
    return 'success';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'rising') return <TrendingUp size={14} style={{ color: 'var(--accent-danger)' }} />;
    if (trend === 'declining') return <TrendingDown size={14} style={{ color: 'var(--accent-success)' }} />;
    return <Minus size={14} style={{ color: 'var(--text-secondary)' }} />;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ShieldX size={14} style={{ color: 'var(--accent-danger)' }} />;
      case 'high': return <AlertTriangle size={14} style={{ color: 'var(--accent-danger)' }} />;
      case 'medium': return <ShieldAlert size={14} style={{ color: 'var(--accent-warning)' }} />;
      default: return <Info size={14} style={{ color: 'var(--accent-info)' }} />;
    }
  };

  const renderBadge = (prov: string, label: string) => {
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
      icon = <Database size={11} />;
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
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2), rgba(37, 99, 235, 0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-red)',
          }}>
            <ShieldAlert size={22} style={{ color: 'var(--accent-danger)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('reputationEngine.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              {t('reputationEngine.subtitle')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder={t('reputationEngineView.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-primary)',
                fontSize: '0.85rem', outline: 'none', width: '180px',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
          <button
            className="fluent-button primary"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            style={{ gap: '6px' }}
          >
            <RefreshCw size={14} className={isRecalculating ? 'spin' : ''} />
            {isRecalculating ? t('reputationEngineView.calculating') : t('reputationEngineView.recalculate')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('reputationEngineView.monitoredHosts')}</span>
              <Server size={16} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.totalHosts}</div>
          </div>

          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('reputationEngineView.highRisk')}</span>
              <ShieldX size={16} style={{ color: 'var(--accent-danger)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-danger)' }}>{summary.highRiskCount}</div>
          </div>

          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('reputationEngineView.mediumRisk')}</span>
              <ShieldAlert size={16} style={{ color: 'var(--accent-warning)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-warning)' }}>{summary.mediumRiskCount}</div>
          </div>

          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-success)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('reputationEngineView.avgScore')}</span>
              <Activity size={16} style={{ color: 'var(--accent-success)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: getRiskColor(summary.averageScore) }}>
              {summary.averageScore}<span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>/100</span>
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Host List */}
        <div className="fluent-table-container" style={{ flex: selectedHost ? 1 : 1 }}>
          <table className="fluent-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>{t('reputationEngineView.score')}</th>
                <th>{t('reputationEngineView.hostIp')}</th>
                <th>{t('reputationEngineView.hostname')}</th>
                <th>{t('reputationEngineView.riskLevel')}</th>
                <th>{t('reputationEngineView.factors')}</th>
                <th>{t('reputationEngineView.trend')}</th>
                <th>{t('reputationEngineView.confidence')}</th>
                <th style={{ width: '140px' }}>{t('reputationEngineView.lastScan')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="fluent-empty-state" style={{ minHeight: '150px' }}>
                      <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
                      <p>{t('reputationEngineView.calculatingScores')}</p>
                    </div>
                  </td>
                </tr>
              ) : hosts.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="fluent-empty-state" style={{ minHeight: '150px' }}>
                      <Shield size={32} />
                      <p>{t('reputationEngineView.noHostsAnalyzed')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                hosts.map((host) => (
                  <tr
                    key={host.hostId}
                    onClick={() => handleHostClick(host)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedHost?.hostId === host.hostId ? 'rgba(37, 99, 235, 0.1)' : undefined,
                    }}
                  >
                    <td>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '8px',
                        background: `linear-gradient(135deg, ${getRiskColor(host.riskScore)}22, ${getRiskColor(host.riskScore)}44)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.85rem',
                        color: getRiskColor(host.riskScore),
                        border: `1px solid ${getRiskColor(host.riskScore)}44`,
                      }}>
                        {host.riskScore}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{host.hostId}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{host.hostname || '—'}</td>
                    <td><span className={`status-pill ${getRiskPillClass(host.riskScore)}`}>{getRiskLabel(host.riskScore)}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{host.factors?.length || 0}</td>
                    <td>{getTrendIcon(host.trend)}</td>
                    <td>
                      <div style={{
                        width: '60px', height: '4px', borderRadius: '2px',
                        backgroundColor: 'var(--bg-primary)', overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${Math.round(host.confidence * 100)}%`,
                          height: '100%', borderRadius: '2px',
                          backgroundColor: 'var(--accent-primary)',
                        }} />
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {host.lastCalculated ? new Date(host.lastCalculated).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Unified Investigation Detail Drawer */}
        {selectedHost && (
          <div
            className="fluent-card"
            style={{
              width: '420px', flexShrink: 0, display: 'flex', flexDirection: 'column',
              gap: '16px', overflow: 'auto', animation: 'slideInRight 0.2s ease',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={13} /> {translateText("interfaceText.message130")} </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 700 }}>
                  {selectedHost.hostId}
                </div>
              </div>
              <button
                onClick={() => { setSelectedHost(null); setCorrelationData(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Provenance Badges Container */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
              {renderBadge('LOCAL', 'LOCAL')}
              {renderBadge('OFFLINE VERIFIED', 'OFFLINE VERIFIED')}
              {correlationData?.cloudIntelligence.map(c => renderBadge(c.provenance, `${c.providerId.toUpperCase()} (${c.provenance})`))}
            </div>

            {/* Risk Summary */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px',
              padding: '16px',
              background: `linear-gradient(135deg, ${getRiskColor(correlationData?.unifiedRiskScore ?? selectedHost.riskScore)}08, ${getRiskColor(correlationData?.unifiedRiskScore ?? selectedHost.riskScore)}15)`,
              borderRadius: '8px',
              border: `1px solid ${getRiskColor(correlationData?.unifiedRiskScore ?? selectedHost.riskScore)}22`,
            }}>
              <div style={{
                width: '74px', height: '74px', borderRadius: '50%',
                border: `4px solid ${getRiskColor(correlationData?.unifiedRiskScore ?? selectedHost.riskScore)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
                boxShadow: `0 0 20px ${getRiskColor(correlationData?.unifiedRiskScore ?? selectedHost.riskScore)}33`,
              }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: getRiskColor(correlationData?.unifiedRiskScore ?? selectedHost.riskScore) }}>
                  {correlationData?.unifiedRiskScore ?? selectedHost.riskScore}
                </span>
              </div>
              <div>
                <div className={`status-pill ${getRiskPillClass(correlationData?.unifiedRiskScore ?? selectedHost.riskScore)}`} style={{ marginBottom: '6px' }}>
                  {getRiskLabel(correlationData?.unifiedRiskScore ?? selectedHost.riskScore)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}> {translateText("interfaceText.message131")} </div>
              </div>
            </div>

            {/* Cloud Intelligence Section (AbuseIPDB) */}
            {isCorrelating ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                <RefreshCw className="spin" size={14} /> {translateText("interfaceText.message132")} </div>
            ) : correlationData?.cloudIntelligence && correlationData.cloudIntelligence.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cloud size={14} /> {translateText("interfaceText.message133")} </div>

                {correlationData.cloudIntelligence.map((cloud, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{cloud.providerName}</span>
                      {renderBadge(cloud.provenance, cloud.provenance)}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}> {translateText("interfaceText.message134")} <span style={{ fontWeight: 600, color: getRiskColor(cloud.confidence) }}>{cloud.confidence}%</span>
                    </div>
                    {cloud.country && (
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}> {translateText("interfaceText.message135")} {cloud.country} {cloud.asn ? `(${cloud.asn})` : ''} {cloud.asnOwner ? `- ${cloud.asnOwner}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Local Risk Factors */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}> {translateText("interfaceText.message136")}{selectedHost.factors?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(selectedHost.factors || []).map((factor, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                    }}
                  >
                    {getSeverityIcon(factor.severity)}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: '2px' }}>{message(factor.label)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {message(factor.description)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {selectedHost.recommendations && selectedHost.recommendations.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}> {translateText("interfaceText.message137")} </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedHost.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(37, 99, 235, 0.06)',
                        border: '1px solid rgba(37, 99, 235, 0.15)',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start',
                      }}
                    >
                      <ChevronRight size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                      {message(rec)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
