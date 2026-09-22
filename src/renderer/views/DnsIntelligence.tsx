import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { message } from "../i18n";
import { t as translateText } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '../i18n';
import {
  Globe2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Hash,
  X,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface DnsQueryRecord {
  id: number;
  timestamp: number;
  queryName: string;
  queryType: string;
  response: string;
  pid?: number;
  processName?: string;
  isRare: boolean;
  riskLevel: 'safe' | 'suspicious' | 'malicious';
  tags: string[];
}

interface DnsSummary {
  totalQueries: number;
  uniqueDomains: number;
  suspiciousCount: number;
  topDomains: { domain: string; count: number }[];
  recentQueries: DnsQueryRecord[];
  anomaliesDetected: number;
}

interface DnsDomainStats {
  domain: string;
  queryCount: number;
  uniqueSubdomains: number;
  firstSeen: number;
  lastSeen: number;
  recordTypes: string[];
  resolvedIps: string[];
  associatedProcesses: string[];
  riskLevel: string;
  anomalyFlags: string[];
}

const RISK_STYLES: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  safe: { color: '#34d399', bg: 'rgba(5, 150, 105, 0.12)', border: 'rgba(5, 150, 105, 0.3)', icon: ShieldCheck },
  suspicious: { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', icon: ShieldAlert },
  malicious: { color: '#f87171', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.3)', icon: AlertTriangle },
};

export const DnsIntelligence: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DnsSummary | null>(null);
  const [records, setRecords] = useState<DnsQueryRecord[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<DnsDomainStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const filter: Record<string, unknown> = { limit: 500 };
      if (searchQuery) filter.searchQuery = searchQuery;

      const [summaryRes, recordsRes] = await Promise.all([
        window.lsip.invoke('dns:summary'),
        window.lsip.invoke('dns:query', filter),
      ]);

      if (summaryRes?.success) setSummary(summaryRes.data);
      if (recordsRes?.success) {
        let data = recordsRes.data;
        if (riskFilter !== 'all') {
          data = data.filter((r: DnsQueryRecord) => r.riskLevel === riskFilter);
        }
        setRecords(data);
      }
    } catch (err) {
      console.error('DNS fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, riskFilter]);

  useEffect(() => {
    fetchData();
    const interval = createViewPolling('dns', fetchData, 12000);
    return () => stopViewPolling(interval);
  }, [fetchData]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await window.lsip.invoke('dns:sync');
      await fetchData();
    } catch (err) {
      console.error('DNS sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDomainClick = async (domain: string) => {
    try {
      const [detailRes, analysisRes] = await Promise.all([
        window.lsip.invoke('dns:domain-detail', { domain }),
        window.lsip.invoke('dns:analyze', { domain }),
      ]);
      if (detailRes?.success) setSelectedDomain(detailRes.data);
      if (analysisRes?.success) setAnalyzeResult(analysisRes.data);
    } catch {
      setSelectedDomain(null);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-blue)',
          }}>
            <Globe2 size={22} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('dnsIntelligence.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              {t('dnsIntelligence.subtitle')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder={t('dnsIntelligenceView.searchDomains')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-primary)',
                fontSize: '0.85rem', outline: 'none', width: '180px',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          {/* Risk Filter */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-primary)' }}>
            {['all', 'safe', 'suspicious', 'malicious'].map(level => (
              <button
                key={level}
                onClick={() => setRiskFilter(level)}
                style={{
                  padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 500, textTransform: 'capitalize',
                  backgroundColor: riskFilter === level ? 'var(--accent-primary)' : 'transparent',
                  color: riskFilter === level ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {level}
              </button>
            ))}
          </div>

          <button
            className="fluent-button primary"
            onClick={handleSync}
            disabled={isSyncing}
            style={{ gap: '6px' }}
          >
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
            {isSyncing ? t('dnsIntelligenceView.syncing') : t('dnsIntelligenceView.syncCache')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dnsIntelligenceView.totalQueries')}</span>
              <Hash size={16} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{summary.totalQueries}</div>
          </div>

          <div className="fluent-card" style={{ borderLeft: '3px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dnsIntelligenceView.uniqueDomains')}</span>
              <Globe2 size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{summary.uniqueDomains}</div>
          </div>

          <div className="fluent-card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dnsIntelligenceView.suspicious')}</span>
              <ShieldAlert size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: summary.suspiciousCount > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
              {summary.suspiciousCount}
            </div>
          </div>

          <div className="fluent-card" style={{ borderLeft: '3px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dnsIntelligenceView.anomalies')}</span>
              <Zap size={16} style={{ color: '#ef4444' }} />
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: summary.anomaliesDetected > 0 ? '#ef4444' : 'var(--text-primary)' }}>
              {summary.anomaliesDetected}
            </div>
          </div>
        </div>
      )}

      {/* Main content: Top Domains + Records Table */}
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Top Domains + Records */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
          {/* Top Domains Bar */}
          {summary && summary.topDomains.length > 0 && (
            <div className="fluent-card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <BarChart3 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {t('dnsIntelligenceView.topQueriedDomains')}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {summary.topDomains.slice(0, 8).map((d, i) => (
                  <button
                    key={i}
                    onClick={() => handleDomainClick(d.domain)}
                    style={{
                      padding: '4px 10px', borderRadius: '4px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-primary)', cursor: 'pointer',
                      fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{d.domain}</span>
                    <span style={{
                      fontSize: '0.65rem', padding: '0px 4px', borderRadius: '3px',
                      backgroundColor: 'var(--accent-primary)', color: '#fff',
                      fontWeight: 600,
                    }}>
                      {d.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DNS Records Table */}
          <div className="fluent-table-container" style={{ flex: 1 }}>
            <table className="fluent-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>{t('dnsIntelligenceView.risk')}</th>
                  <th>{t('dnsIntelligenceView.domain')}</th>
                  <th>{t('dnsIntelligenceView.type')}</th>
                  <th>{t('dnsIntelligenceView.response')}</th>
                  <th>{t('dnsIntelligenceView.process')}</th>
                  <th>{t('dnsIntelligenceView.tags')}</th>
                  <th style={{ width: '90px' }}>{t('dnsIntelligenceView.time')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="fluent-empty-state" style={{ minHeight: '150px' }}>
                        <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
                        <p>{t('dnsIntelligenceView.loadingDnsCache')}</p>
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="fluent-empty-state" style={{ minHeight: '150px' }}>
                        <Globe2 size={32} />
                        <p>{t('dnsIntelligenceView.noDnsRecordsFound')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((record) => {
                    const riskStyle = RISK_STYLES[record.riskLevel] || RISK_STYLES.safe;
                    const RiskIcon = riskStyle.icon;

                    return (
                      <tr
                        key={record.id}
                        onClick={() => handleDomainClick(record.queryName)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedDomain?.domain === record.queryName ? 'rgba(37, 99, 235, 0.08)' : undefined,
                        }}
                      >
                        <td>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '6px',
                            backgroundColor: riskStyle.bg,
                            border: `1px solid ${riskStyle.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <RiskIcon size={14} style={{ color: riskStyle.color }} />
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{record.queryName}</span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px',
                            backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-info)',
                            fontWeight: 600,
                          }}>
                            {record.queryType}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {record.response || '—'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          {record.processName || '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                            {record.tags.slice(0, 2).map((tag, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: '0.62rem', padding: '1px 4px', borderRadius: '2px',
                                  backgroundColor: tag.includes('dga') || tag.includes('malicious') ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-elevated)',
                                  color: tag.includes('dga') || tag.includes('malicious') ? '#f87171' : 'var(--text-tertiary)',
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          {formatTime(record.timestamp)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Domain Detail Panel */}
        {selectedDomain && (
          <div
            className="fluent-card"
            style={{
              width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column',
              gap: '14px', overflow: 'auto', animation: 'slideInRight 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, marginBottom: '4px' }}>
                  {t('dnsIntelligenceView.domainAnalysis')}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600, wordBreak: 'break-all' }}>
                  {selectedDomain.domain}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    const res = await window.lsip.invoke('internet:query', { indicator: selectedDomain.domain, type: 'domain', forceRefresh: false });
                    if (res && res.success) {
                      alert(message(t('dnsIntelligenceView.osintStartedAlert')));
                    }
                  }}
                  className="fluent-button primary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto', gap: '4px' }}
                  title={translateText("interfaceText.message046")}
                >
                  <Globe2 size={12} /> {t('dnsIntelligenceView.analyzeOsint')}
                </button>
                <button
                  onClick={() => { setSelectedDomain(null); setAnalyzeResult(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Risk Assessment */}
            {(() => {
              const riskStyle = RISK_STYLES[selectedDomain.riskLevel] || RISK_STYLES.safe;
              const RiskIcon = riskStyle.icon;
              return (
                <div style={{
                  padding: '12px', borderRadius: '8px',
                  backgroundColor: riskStyle.bg,
                  border: `1px solid ${riskStyle.border}`,
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <RiskIcon size={24} style={{ color: riskStyle.color }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: riskStyle.color, textTransform: 'uppercase' }}>
                      {selectedDomain.riskLevel}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {analyzeResult ? `Shannon Entropy: ${analyzeResult.entropy?.toFixed(2) || 'N/A'}` : ''}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('dnsIntelligenceView.queries')}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedDomain.queryCount}</div>
              </div>
              <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('dnsIntelligenceView.subdomains')}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedDomain.uniqueSubdomains}</div>
              </div>
              <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('dnsIntelligenceView.firstSeen')}</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{new Date(selectedDomain.firstSeen).toLocaleDateString()}</div>
              </div>
              <div style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>{t('dnsIntelligenceView.lastSeen')}</div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{new Date(selectedDomain.lastSeen).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Record Types */}
            {selectedDomain.recordTypes.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  {t('dnsIntelligenceView.recordTypes')}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {selectedDomain.recordTypes.map((tItem, i) => (
                    <span key={i} style={{
                      fontSize: '0.7rem', padding: '2px 8px', borderRadius: '3px',
                      backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-info)',
                      border: '1px solid var(--border-primary)',
                    }}>
                      {tItem}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Resolved IPs */}
            {selectedDomain.resolvedIps.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  {t('dnsIntelligenceView.resolvedIps')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {selectedDomain.resolvedIps.map((ip, i) => (
                    <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ArrowRight size={10} style={{ color: 'var(--accent-primary)' }} />
                      {ip}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Associated Processes */}
            {selectedDomain.associatedProcesses.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  {t('dnsIntelligenceView.associatedProcesses')}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {selectedDomain.associatedProcesses.map((p, i) => (
                    <span key={i} style={{
                      fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px',
                      backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Anomaly Flags */}
            {selectedDomain.anomalyFlags.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  {t('dnsIntelligenceView.anomalyFlags')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selectedDomain.anomalyFlags.map((flag, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '6px 10px', borderRadius: '4px',
                        backgroundColor: 'rgba(220, 38, 38, 0.08)',
                        border: '1px solid rgba(220, 38, 38, 0.2)',
                        fontSize: '0.75rem', color: '#fca5a5',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <AlertTriangle size={12} style={{ color: '#f87171' }} />
                      {flag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
