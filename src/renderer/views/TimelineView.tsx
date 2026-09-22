import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { message } from "../i18n";
import { t as translateText } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from '../i18n';
import {
  Clock,
  RefreshCw,
  Search,
  Filter,
  Cpu,
  Network,
  FileSpreadsheet,
  Globe2,
  Server,
  Shield,
  X,
  Download,
} from 'lucide-react';

type TimelineEventSource = 'process' | 'network' | 'event_log' | 'asset' | 'dns' | 'reputation';
type TimelineSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

interface TimelineEvent {
  id: string;
  timestamp: number;
  source: TimelineEventSource;
  severity: TimelineSeverity;
  title: string;
  description: string;
  details: Record<string, unknown>;
  associatedPid?: number;
  associatedIp?: string;
  entityId?: string;
  entityType?: string;
  tags: string[];
  isBookmarked?: boolean;
}

interface TimelineStats {
  totalEvents: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  bySource: Record<string, number>;
}

const SOURCE_CONFIG: Record<TimelineEventSource, { icon: React.ComponentType<any>; color: string; label: string }> = {
  process: { icon: Cpu, color: '#8b5cf6', label: 'Process' },
  network: { icon: Network, color: '#06b6d4', label: 'Network' },
  event_log: { icon: FileSpreadsheet, color: '#f59e0b', label: 'Event Log' },
  asset: { icon: Server, color: '#10b981', label: 'Asset' },
  dns: { icon: Globe2, color: '#3b82f6', label: 'DNS' },
  reputation: { icon: Shield, color: '#ef4444', label: 'Reputation' },
};

const SEVERITY_CONFIG: Record<TimelineSeverity, { color: string; bg: string; border: string }> = {
  critical: { color: '#f87171', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.3)' },
  high: { color: '#fb923c', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)' },
  medium: { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' },
  low: { color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.2)' },
  info: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.06)', border: 'rgba(148, 163, 184, 0.15)' },
};

const TIME_RANGES = [
  { label: 'Last Hour', value: 3600000 },
  { label: 'Last 6h', value: 21600000 },
  { label: 'Last 24h', value: 86400000 },
  { label: 'Last 7d', value: 604800000 },
];

export const TimelineView: React.FC = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [stats, setStats] = useState<TimelineStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<Set<TimelineEventSource>>(new Set());
  const [selectedSeverities, setSelectedSeverities] = useState<Set<TimelineSeverity>>(new Set());
  const [timeRange, setTimeRange] = useState(86400000); // 24h default
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const now = Date.now();
      const filter = {
        startTime: now - timeRange,
        endTime: now,
        sources: selectedSources.size > 0 ? Array.from(selectedSources) : undefined,
        severities: selectedSeverities.size > 0 ? Array.from(selectedSeverities) : undefined,
        searchQuery: searchQuery || undefined,
        limit: 500,
      };

      const [eventsRes, statsRes] = await Promise.all([
        window.lsip.invoke('timeline:query', filter),
        window.lsip.invoke('timeline:stats', filter),
      ]);

      if (eventsRes?.success) setEvents(eventsRes.data);
      if (statsRes?.success) setStats(statsRes.data);
    } catch (err) {
      console.error('Timeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSources, selectedSeverities, timeRange]);

  useEffect(() => {
    fetchData();
    const interval = createViewPolling('timeline', fetchData, 10000);
    return () => stopViewPolling(interval);
  }, [fetchData]);

  const toggleSource = (src: TimelineEventSource) => {
    const next = new Set(selectedSources);
    if (next.has(src)) next.delete(src);
    else next.add(src);
    setSelectedSources(next);
  };

  const toggleSeverity = (sev: TimelineSeverity) => {
    const next = new Set(selectedSeverities);
    if (next.has(sev)) next.delete(sev);
    else next.add(sev);
    setSelectedSeverities(next);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;

    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group events by day for rendering
  const groupedEvents = events.reduce<Record<string, TimelineEvent[]>>((acc, evt) => {
    const dateKey = new Date(evt.timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(evt);
    return acc;
  }, {});

  const handleExport = () => {
    if (events.length === 0) return;
    const header = 'Timestamp,Source,Severity,Title,Description\n';
    const rows = events.map(e => {
      const ts = new Date(e.timestamp).toISOString();
      const title = `"${e.title.replace(/"/g, '""')}"`;
      const desc = `"${e.description.replace(/"/g, '""')}"`;
      return `${ts},${e.source},${e.severity},${title},${desc}`;
    }).join('\n');
    
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lsip_timeline_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(37, 99, 235, 0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-blue)',
          }}>
            <Clock size={22} style={{ color: 'var(--accent-info)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('timelineView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              {t('timelineView.subtitle')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Time Range Selector */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-primary)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-primary)' }}>
            {TIME_RANGES.map(tr => (
              <button
                key={tr.value}
                onClick={() => setTimeRange(tr.value)}
                style={{
                  padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', fontWeight: 500,
                  backgroundColor: timeRange === tr.value ? 'var(--accent-primary)' : 'transparent',
                  color: timeRange === tr.value ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                {message(tr.label)}
              </button>
            ))}
          </div>

          <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder={t('timelineView.searchEvents')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-primary)',
                fontSize: '0.85rem', outline: 'none', width: '160px',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          <button
            className={`fluent-button ${showFilters ? 'primary' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} /> {t('timelineView.filters')}
          </button>
          
          <button
            className="fluent-button"
            onClick={handleExport}
            title={translateText("interfaceText.message151")}
            disabled={events.length === 0}
          >
            <Download size={14} /> {t('timelineView.exportCsv')}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="fluent-card" style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '12px 16px', animation: 'slideDown 0.15s ease' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('timelineView.sources')}</span>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {(Object.entries(SOURCE_CONFIG) as [TimelineEventSource, typeof SOURCE_CONFIG[TimelineEventSource]][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const active = selectedSources.size === 0 || selectedSources.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleSource(key)}
                    style={{
                      padding: '4px 8px', borderRadius: '4px', border: '1px solid',
                      borderColor: active ? cfg.color + '44' : 'var(--border-primary)',
                      backgroundColor: active ? cfg.color + '15' : 'transparent',
                      color: active ? cfg.color : 'var(--text-tertiary)',
                      cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={12} /> {message(cfg.label)}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border-primary)' }} />
          <div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('timelineView.severity')}</span>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {(Object.entries(SEVERITY_CONFIG) as [TimelineSeverity, typeof SEVERITY_CONFIG[TimelineSeverity]][]).map(([key, cfg]) => {
                const active = selectedSeverities.size === 0 || selectedSeverities.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleSeverity(key)}
                    style={{
                      padding: '4px 8px', borderRadius: '4px', border: '1px solid',
                      borderColor: active ? cfg.border : 'var(--border-primary)',
                      backgroundColor: active ? cfg.bg : 'transparent',
                      color: active ? cfg.color : 'var(--text-tertiary)',
                      cursor: 'pointer', fontSize: '0.72rem', fontWeight: 500,
                      textTransform: 'capitalize', transition: 'all 0.15s ease',
                    }}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span><strong style={{ color: 'var(--text-primary)' }}>{stats.totalEvents}</strong> {t('timelineView.events')}</span>
          {stats.criticalCount > 0 && <span style={{ color: SEVERITY_CONFIG.critical.color }}>● {stats.criticalCount} {t('timelineView.critical')}</span>}
          {stats.highCount > 0 && <span style={{ color: SEVERITY_CONFIG.high.color }}>● {stats.highCount} {t('timelineView.high')}</span>}
          {stats.mediumCount > 0 && <span style={{ color: SEVERITY_CONFIG.medium.color }}>● {stats.mediumCount} {t('timelineView.medium')}</span>}
          <span style={{ color: SEVERITY_CONFIG.info.color }}>● {stats.infoCount} {t('timelineView.info')}</span>
        </div>
      )}

      {/* Timeline */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', gap: '16px', minHeight: 0 }}>
        {/* Event List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0px' }}>
          {loading ? (
            <div className="fluent-empty-state" style={{ minHeight: '200px' }}>
              <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
              <p>{t('timelineView.loadingTimeline')}</p>
            </div>
          ) : events.length === 0 ? (
            <div className="fluent-empty-state" style={{ minHeight: '200px' }}>
              <Clock size={48} />
              <h3>{t('timelineView.noEventsFound')}</h3>
              <p>{t('timelineView.noEventsDesc')}</p>
            </div>
          ) : (
            Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
              <div key={dateKey}>
                {/* Day Header */}
                <div style={{
                  padding: '8px 0', fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-primary)',
                  marginBottom: '4px', position: 'sticky', top: 0,
                  backgroundColor: 'var(--bg-secondary)', zIndex: 5,
                }}>
                  {dateKey}
                </div>

                {/* Events */}
                {dayEvents.map((evt) => {
                  const srcCfg = SOURCE_CONFIG[evt.source] || SOURCE_CONFIG.process;
                  const sevCfg = SEVERITY_CONFIG[evt.severity] || SEVERITY_CONFIG.info;
                  const SrcIcon = srcCfg.icon;

                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEvent(selectedEvent?.id === evt.id ? null : evt)}
                      style={{
                        display: 'flex', gap: '12px', padding: '10px 8px',
                        borderLeft: `3px solid ${sevCfg.color}`,
                        marginLeft: '12px', cursor: 'pointer',
                        backgroundColor: selectedEvent?.id === evt.id ? sevCfg.bg : 'transparent',
                        borderBottom: '1px solid var(--border-primary)',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {/* Timeline Node */}
                      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '6px',
                          backgroundColor: srcCfg.color + '18',
                          border: `1px solid ${srcCfg.color}33`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <SrcIcon size={14} style={{ color: srcCfg.color }} />
                        </div>
                      </div>

                      {/* Event Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {message(evt.title)}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {formatTime(evt.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {message(evt.description)}
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px',
                            backgroundColor: sevCfg.bg, color: sevCfg.color,
                            border: `1px solid ${sevCfg.border}`,
                          }}>
                            {evt.severity}
                          </span>
                          {evt.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px',
                                backgroundColor: 'var(--bg-elevated)', color: 'var(--text-tertiary)',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedEvent && (
          <div
            className="fluent-card"
            style={{
              width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column',
              gap: '14px', overflow: 'auto', animation: 'slideInRight 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                {t('timelineView.eventDetail')}
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>{message(selectedEvent.title)}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message(selectedEvent.description)}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(() => {
                const srcCfg = SOURCE_CONFIG[selectedEvent.source] || SOURCE_CONFIG.process;
                const SrcIcon = srcCfg.icon;
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px',
                    backgroundColor: srcCfg.color + '15',
                    color: srcCfg.color,
                    border: `1px solid ${srcCfg.color}33`,
                  }}>
                    <SrcIcon size={12} /> {message(srcCfg.label)}
                  </span>
                );
              })()}
              {(() => {
                const sevCfg = SEVERITY_CONFIG[selectedEvent.severity] || SEVERITY_CONFIG.info;
                return (
                  <span style={{
                    fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px',
                    backgroundColor: sevCfg.bg, color: sevCfg.color,
                    border: `1px solid ${sevCfg.border}`,
                  }}>
                    {selectedEvent.severity.toUpperCase()}
                  </span>
                );
              })()}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <div style={{ marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)' }}>
                {t('timelineView.timestamp')}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
            </div>

            {selectedEvent.entityId && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <div style={{ marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)' }}>
                  {t('timelineView.entity')}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {selectedEvent.entityType}: {selectedEvent.entityId}
                </span>
              </div>
            )}

            {/* Raw Details */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                {t('timelineView.rawDetails')}
              </div>
              <div style={{
                padding: '10px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                maxHeight: '200px',
                overflow: 'auto',
                lineHeight: 1.6,
              }}>
                {Object.entries(selectedEvent.details).map(([key, val]) => (
                  <div key={key}>
                    <span style={{ color: 'var(--accent-primary)' }}>{key}</span>:{' '}
                    <span style={{ color: 'var(--text-primary)' }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            {selectedEvent.tags.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  {t('timelineView.tags')}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {selectedEvent.tags.map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px',
                        backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-primary)',
                      }}
                    >
                      #{tag}
                    </span>
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
        @keyframes slideDown {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
