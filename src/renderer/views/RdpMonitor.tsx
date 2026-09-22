import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { t as translateText } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { Monitor, RefreshCw, Users, ShieldAlert, ShieldCheck, Globe2, UserX, UserCheck, LogIn } from 'lucide-react';
import { useTranslation } from '../i18n';

interface RdpSession { id: number; sessionId: number; username: string; state: string; sourceIp?: string; loginTime: number; sessionType: string; }
interface RdpLoginEvent { id: number; timestamp: number; eventType: string; username: string; sourceIp: string; eventId: number; reason?: string; severity: string; }
interface RdpSummary { activeSessions: number; totalLoginEvents: number; failedAttempts: number; uniqueSourceIps: number; recentEvents: RdpLoginEvent[]; sessions: RdpSession[]; }

const EVENT_COLORS: Record<string, { color: string; bg: string; icon: React.ComponentType<any> }> = {
  success: { color: '#34d399', bg: 'rgba(5, 150, 105, 0.12)', icon: UserCheck },
  failed: { color: '#f87171', bg: 'rgba(220, 38, 38, 0.12)', icon: UserX },
  disconnect: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.08)', icon: LogIn },
  reconnect: { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', icon: LogIn },
};

export const RdpMonitor: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<RdpSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('rdp:summary');
      if (res?.success) setSummary(res.data);
    } catch (err) { console.error('RDP fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = createViewPolling('rdp', fetchData, 10000); return () => stopViewPolling(i); }, [fetchData]);

  const formatTime = (ts: number) => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const stateColor = (state: string) => {
    if (state === 'Active') return 'var(--accent-success)';
    if (state === 'Disconnected') return 'var(--accent-warning)';
    return 'var(--text-secondary)';
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(79, 70, 229, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={22} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('rdpMonitorView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('rdpMonitorView.subtitle')}</p>
          </div>
        </div>
        <button className="fluent-button primary" onClick={fetchData}><RefreshCw size={14} /> {t('rdpMonitorView.refresh')}</button>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('rdpMonitorView.activeSessions')}</span><Users size={16} style={{ color: '#8b5cf6' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.activeSessions}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('rdpMonitorView.failedAttempts')}</span><ShieldAlert size={16} style={{ color: 'var(--accent-danger)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.failedAttempts > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{summary.failedAttempts}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-info)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('rdpMonitorView.uniqueSourceIps')}</span><Globe2 size={16} style={{ color: 'var(--accent-info)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.uniqueSourceIps}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-success)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('rdpMonitorView.totalEvents')}</span><ShieldCheck size={16} style={{ color: 'var(--accent-success)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.totalLoginEvents}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Sessions */}
        <div className="fluent-card" style={{ flex: '0 0 320px', overflow: 'auto' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>{t('rdpMonitorView.activeSessions')}</h3>
          {loading ? <div className="fluent-empty-state" style={{ minHeight: '100px' }}><RefreshCw size={24} className="spin" style={{ color: 'var(--accent-primary)' }}/></div>
          : (summary?.sessions || []).length === 0 ? <div className="fluent-empty-state" style={{ minHeight: '100px' }}><p>{t('rdpMonitorView.noActiveSessions')}</p></div>
          : (summary?.sessions || []).map((s, i) => (
            <div key={i} style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{s.username || 'SYSTEM'}</span>
                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: stateColor(s.state) + '22', color: stateColor(s.state), border: `1px solid ${stateColor(s.state)}44` }}>{s.state}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}> {translateText("interfaceText.message129")}{s.sessionId} • {s.sessionType}
              </div>
            </div>
          ))}
        </div>

        {/* Events */}
        <div className="fluent-table-container" style={{ flex: 1 }}>
          <table className="fluent-table">
            <thead><tr><th style={{ width: '40px' }}></th><th>{t('rdpMonitorView.type')}</th><th>{t('rdpMonitorView.username')}</th><th>{t('rdpMonitorView.sourceIp')}</th><th>{t('rdpMonitorView.eventId')}</th><th>{t('rdpMonitorView.details')}</th><th>{t('rdpMonitorView.time')}</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('rdpMonitorView.queryingEvents')}</p></div></td></tr>
              : (summary?.recentEvents || []).length === 0 ? <tr><td colSpan={7}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><Monitor size={32}/><p>{t('rdpMonitorView.noEventsFound')}</p></div></td></tr>
              : (summary?.recentEvents || []).map((evt, i) => {
                const cfg = EVENT_COLORS[evt.eventType] || EVENT_COLORS.success;
                const EvtIcon = cfg.icon;
                return (
                  <tr key={i}>
                    <td><div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><EvtIcon size={14} style={{ color: cfg.color }} /></div></td>
                    <td><span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: cfg.bg, color: cfg.color, textTransform: 'capitalize' }}>{evt.eventType}</span></td>
                    <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{evt.username}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{evt.sourceIp || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{evt.eventId}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{evt.reason || '—'}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{formatTime(evt.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
