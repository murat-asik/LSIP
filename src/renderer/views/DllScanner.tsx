import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import React, { useEffect, useState, useCallback } from 'react';
import { Box, RefreshCw, Search, ShieldAlert, ShieldCheck, Cpu } from 'lucide-react';
import { useTranslation } from '../i18n';

interface DllEntry { id: string; processId: number; processName: string; moduleName: string; filePath: string; baseAddress: string; size: number; company?: string; description?: string; isSigned: boolean; isSystem: boolean; }
interface DllSummary { totalLoadedModules: number; uniqueDlls: number; unsignedDlls: number; modules: DllEntry[]; }

export const DllScanner: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<DllSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('dlls:summary');
      if (res?.success) setSummary(res.data);
    } catch (err) { console.error('DLL fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = createViewPolling('dlls', fetchData, 15000); return () => stopViewPolling(i); }, [fetchData]);

  const filtered = (summary?.modules || []).filter(m =>
    !searchQuery || m.processName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.moduleName.toLowerCase().includes(searchQuery.toLowerCase()) || String(m.processId) === searchQuery
  );

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box size={22} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('dllScannerView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('dllScannerView.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input type="text" placeholder={t('dllScannerView.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '220px', fontFamily: 'var(--font-sans)' }} />
          </div>
          <button className="fluent-button primary" onClick={fetchData}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('dllScannerView.refresh')}</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('dllScannerView.totalModules')}</span><Box size={16} style={{ color: '#10b981' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.totalLoadedModules}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-info)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('dllScannerView.uniqueDlls')}</span><Cpu size={16} style={{ color: 'var(--accent-info)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.uniqueDlls}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('dllScannerView.unsignedModules')}</span><ShieldAlert size={16} style={{ color: 'var(--accent-danger)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.unsignedDlls > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{summary.unsignedDlls}</div>
          </div>
        </div>
      )}

      <div className="fluent-table-container" style={{ flex: 1, marginTop: '4px' }}>
        <table className="fluent-table">
          <thead><tr><th style={{ width: '40px' }}>{t('dllScannerView.sign')}</th><th>{t('dllScannerView.process')}</th><th>{t('dllScannerView.pid')}</th><th>{t('dllScannerView.moduleName')}</th><th>{t('dllScannerView.path')}</th><th>{t('dllScannerView.company')}</th><th>{t('dllScannerView.size')}</th><th>{t('dllScannerView.baseAddr')}</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('dllScannerView.enumeratingModules')}</p></div></td></tr>
            : filtered.length === 0 ? <tr><td colSpan={8}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><Box size={32}/><p>{t('dllScannerView.noModulesMatch')}</p></div></td></tr>
            : filtered.map((m, i) => (
              <tr key={i}>
                <td>{m.isSigned ? <ShieldCheck size={14} style={{ color: 'var(--accent-success)' }} /> : m.isSystem ? <ShieldCheck size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ShieldAlert size={14} style={{ color: 'var(--accent-danger)' }} />}</td>
                <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{m.processName}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-info)' }}>{m.processId}</td>
                <td style={{ fontWeight: 500, fontSize: '0.8rem' }}>{m.moduleName}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.filePath}>{m.filePath}</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.company || '—'}</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{(m.size / 1024).toFixed(1)} KB</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{m.baseAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
