import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import React, { useEffect, useState, useCallback } from 'react';
import { GitFork, RefreshCw, Search, AlertTriangle, Layers } from 'lucide-react';
import { useTranslation } from '../i18n';

interface ThreadEntry { id: number; processId: number; threadId: number; processName: string; basePriority: number; currentPriority: number; threadState: string; waitReason: string; cpuTime: number; startAddress: string; }
interface ThreadSummary { totalThreads: number; activeProcesses: number; highPriorityThreads: number; threads: ThreadEntry[]; }

export const ThreadExplorer: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ThreadSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('threads:summary');
      if (res?.success) setSummary(res.data);
    } catch (err) { console.error('Threads fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = createViewPolling('threads', fetchData, 10000); return () => stopViewPolling(i); }, [fetchData]);

  const filtered = (summary?.threads || []).filter(t =>
    !searchQuery || t.processName.toLowerCase().includes(searchQuery.toLowerCase()) || String(t.processId) === searchQuery
  );

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GitFork size={22} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('threadExplorerView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('threadExplorerView.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input type="text" placeholder={t('threadExplorerView.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '200px', fontFamily: 'var(--font-sans)' }} />
          </div>
          <button className="fluent-button primary" onClick={fetchData}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('threadExplorerView.refresh')}</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('threadExplorerView.totalThreads')}</span><GitFork size={16} style={{ color: '#3b82f6' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.totalThreads}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-info)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('threadExplorerView.activeProcesses')}</span><Layers size={16} style={{ color: 'var(--accent-info)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.activeProcesses}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('threadExplorerView.highPriority')}</span><AlertTriangle size={16} style={{ color: 'var(--accent-warning)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.highPriorityThreads > 0 ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{summary.highPriorityThreads}</div>
          </div>
        </div>
      )}

      <div className="fluent-table-container" style={{ flex: 1, marginTop: '4px' }}>
        <table className="fluent-table">
          <thead><tr><th>{t('threadExplorerView.process')}</th><th>{t('threadExplorerView.pid')}</th><th>{t('threadExplorerView.tid')}</th><th>{t('threadExplorerView.basePri')}</th><th>{t('threadExplorerView.curPri')}</th><th>{t('threadExplorerView.state')}</th><th>{t('threadExplorerView.waitReason')}</th><th>{t('threadExplorerView.cpuSec')}</th><th>{t('threadExplorerView.startAddr')}</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('threadExplorerView.enumeratingThreads')}</p></div></td></tr>
            : filtered.length === 0 ? <tr><td colSpan={9}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><GitFork size={32}/><p>{t('threadExplorerView.noThreadsFound')}</p></div></td></tr>
            : filtered.map((t, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{t.processName}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-info)' }}>{t.processId}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{t.threadId}</td>
                <td style={{ textAlign: 'center' }}>{t.basePriority}</td>
                <td style={{ textAlign: 'center', color: t.currentPriority > 8 ? 'var(--accent-warning)' : 'inherit' }}>{t.currentPriority}</td>
                <td><span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{t.threadState}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t.waitReason || '—'}</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.cpuTime.toFixed(2)}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{t.startAddress || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
