import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { message } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { Brain, RefreshCw, Activity, ShieldAlert, Cpu, Globe, User } from 'lucide-react';
import { useTranslation } from '../i18n';

interface UebaAnomaly { id: string; timestamp: number; entityType: string; entityName: string; anomalyType: string; description: string; score: number; confidence: number; }
interface UebaSummary { activeAnomalies: number; criticalEntities: number; anomalies: UebaAnomaly[]; }

export const BehaviorAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<UebaSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('behavior:summary');
      if (res?.success) setSummary(res.data);
    } catch (err) { console.error('UEBA fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = createViewPolling('behavior', fetchData, 30000); return () => stopViewPolling(i); }, [fetchData]);

  const getEntityIcon = (type: string) => {
    if (type === 'user') return <User size={14} />;
    if (type === 'process') return <Cpu size={14} />;
    return <Globe size={14} />;
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={22} style={{ color: '#ec4899' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('behaviorAnalyticsView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('behaviorAnalyticsView.subtitle')}</p>
          </div>
        </div>
        <button className="fluent-button primary" onClick={fetchData}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('behaviorAnalyticsView.runAnalysis')}</button>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #ec4899' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('behaviorAnalyticsView.activeAnomalies')}</span><Activity size={16} style={{ color: '#ec4899' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.activeAnomalies}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('behaviorAnalyticsView.criticalEntities')}</span><ShieldAlert size={16} style={{ color: 'var(--accent-danger)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.criticalEntities > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{summary.criticalEntities}</div>
          </div>
        </div>
      )}

      <div className="fluent-table-container" style={{ flex: 1, marginTop: '4px' }}>
        <table className="fluent-table">
          <thead><tr><th>{t('behaviorAnalyticsView.time')}</th><th>{t('behaviorAnalyticsView.entityType')}</th><th>{t('behaviorAnalyticsView.entityName')}</th><th>{t('behaviorAnalyticsView.anomalyType')}</th><th>{t('behaviorAnalyticsView.description')}</th><th style={{ textAlign: 'center' }}>{t('behaviorAnalyticsView.score')}</th><th style={{ textAlign: 'center' }}>{t('behaviorAnalyticsView.confidence')}</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('behaviorAnalyticsView.runningEngine')}</p></div></td></tr>
            : (summary?.anomalies || []).length === 0 ? <tr><td colSpan={7}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><Brain size={32} style={{ color: 'var(--accent-success)' }}/><p>{t('behaviorAnalyticsView.noAnomaliesDetected')}</p></div></td></tr>
            : summary?.anomalies.map((a, i) => (
              <tr key={i}>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(a.timestamp).toLocaleTimeString()}</td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{getEntityIcon(a.entityType)} {a.entityType}</div></td>
                <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.entityName}</td>
                <td><span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-info)', textTransform: 'uppercase' }}>{a.anomalyType.replace('_', ' ')}</span></td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{message(a.description)}</td>
                <td><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: a.score > 70 ? 'var(--accent-danger)' : 'var(--accent-warning)', fontWeight: 600 }}>{a.score}</div></td>
                <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{a.confidence}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
