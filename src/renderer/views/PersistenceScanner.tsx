import { message } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { Key, RefreshCw, Search, AlertTriangle, ShieldAlert, FileCode, Clock, Settings, List } from 'lucide-react';
import { useTranslation } from '../i18n';

interface PersistenceEntry { id: string; category: string; name: string; location: string; value: string; description?: string; publisher?: string; isSigned: boolean; isEnabled: boolean; riskLevel: string; riskFactors: string[]; }
interface PersistenceSummary { totalEntries: number; registryItems: number; scheduledTasks: number; services: number; startupItems: number; suspiciousCount: number; entries: PersistenceEntry[]; }

const CATEGORY_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  registry: { icon: Key, color: '#f59e0b', label: 'Registry' },
  scheduled_task: { icon: Clock, color: '#8b5cf6', label: 'Scheduled Task' },
  service: { icon: Settings, color: '#3b82f6', label: 'Service' },
  startup_folder: { icon: FileCode, color: '#10b981', label: 'Startup' },
};

const RISK_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  safe: { color: '#34d399', bg: 'rgba(5, 150, 105, 0.12)', border: 'rgba(5, 150, 105, 0.3)' },
  review: { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)' },
  suspicious: { color: '#fb923c', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)' },
  malicious: { color: '#f87171', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.3)' },
};

export const PersistenceScanner: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PersistenceSummary | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<PersistenceEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('persistence:summary');
      if (res?.success) setSummary(res.data);
    } catch (err) { console.error('Persistence fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = (summary?.entries || []).filter(e => {
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (riskFilter !== 'all' && e.riskLevel !== riskFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.value.toLowerCase().includes(q) || e.location.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2), rgba(249, 115, 22, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Key size={22} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('persistenceScannerView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('persistenceScannerView.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input type="text" placeholder={t('persistenceScannerView.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '150px', fontFamily: 'var(--font-sans)' }} />
          </div>
          <button className="fluent-button primary" onClick={fetchData} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? t('persistenceScannerView.scanning') : t('persistenceScannerView.fullScan')}</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {[
            { label: t('persistenceScannerView.registry'), count: summary.registryItems, color: '#f59e0b', icon: Key },
            { label: t('persistenceScannerView.tasks'), count: summary.scheduledTasks, color: '#8b5cf6', icon: Clock },
            { label: t('persistenceScannerView.services'), count: summary.services, color: '#3b82f6', icon: Settings },
            { label: t('persistenceScannerView.suspicious'), count: summary.suspiciousCount, color: '#ef4444', icon: ShieldAlert },
            { label: t('persistenceScannerView.total'), count: summary.totalEntries, color: 'var(--accent-primary)', icon: List },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="fluent-card" style={{ borderLeft: `3px solid ${s.color}`, cursor: 'pointer' }} onClick={() => setCategoryFilter(i < 3 ? ['registry', 'scheduled_task', 'service'][i] : 'all')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' }}>{message(s.label)}</span><Icon size={14} style={{ color: s.color }} /></div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: i === 3 && s.count > 0 ? s.color : 'var(--text-primary)' }}>{s.count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('persistenceScannerView.risk')}</span>
        {['all', 'safe', 'review', 'suspicious', 'malicious'].map(r => (
          <button key={r} onClick={() => setRiskFilter(r)} style={{
            padding: '3px 8px', borderRadius: '4px', border: '1px solid', cursor: 'pointer', fontSize: '0.72rem', textTransform: 'capitalize',
            borderColor: riskFilter === r ? (RISK_STYLE[r]?.border || 'var(--accent-primary)') : 'var(--border-primary)',
            backgroundColor: riskFilter === r ? (RISK_STYLE[r]?.bg || 'rgba(37,99,235,0.12)') : 'transparent',
            color: riskFilter === r ? (RISK_STYLE[r]?.color || 'var(--accent-primary)') : 'var(--text-tertiary)',
          }}>{r}</button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{filtered.length} {t('persistenceScannerView.entries')}</span>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        <div className="fluent-table-container" style={{ flex: 1 }}>
          <table className="fluent-table">
            <thead><tr><th style={{ width: '40px' }}></th><th>{t('persistenceScannerView.name')}</th><th>{t('persistenceScannerView.category')}</th><th>{t('persistenceScannerView.location')}</th><th>{t('persistenceScannerView.risk')}</th><th>{t('persistenceScannerView.factors')}</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('persistenceScannerView.scanningPersistence')}</p></div></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><Key size={32}/><p>{t('persistenceScannerView.noEntriesMatch')}</p></div></td></tr>
              : filtered.map((e, i) => {
                const cat = CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.registry;
                const risk = RISK_STYLE[e.riskLevel] || RISK_STYLE.safe;
                const CatIcon = cat.icon;
                return (
                  <tr key={i} onClick={() => setSelectedEntry(e)} style={{ cursor: 'pointer', backgroundColor: selectedEntry?.id === e.id ? 'rgba(37,99,235,0.08)' : undefined }}>
                    <td><div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: cat.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CatIcon size={14} style={{ color: cat.color }} /></div></td>
                    <td style={{ fontWeight: 500, fontSize: '0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</td>
                    <td><span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: cat.color + '15', color: cat.color }}>{message(cat.label)}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.location}</td>
                    <td><span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: risk.bg, color: risk.color, border: `1px solid ${risk.border}`, textTransform: 'uppercase' }}>{e.riskLevel}</span></td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{e.riskFactors.length || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selectedEntry && (
          <div className="fluent-card" style={{ width: '360px', flexShrink: 0, overflow: 'auto', animation: 'slideInRight 0.2s ease' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '8px' }}>{selectedEntry.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{t('persistenceScannerView.location')}</span><div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', wordBreak: 'break-all', marginTop: '2px' }}>{selectedEntry.location}</div></div>
              <div><span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{t('persistenceScannerView.commandValue')}</span><div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', wordBreak: 'break-all', marginTop: '2px', lineHeight: 1.5 }}>{selectedEntry.value || '—'}</div></div>
              {selectedEntry.description && <div><span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{t('persistenceScannerView.description')}</span><div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{message(selectedEntry.description)}</div></div>}
              {selectedEntry.riskFactors.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{t('persistenceScannerView.riskFactors')}</span>
                  {selectedEntry.riskFactors.map((f, i) => (
                    <div key={i} style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', fontSize: '0.75rem', color: '#fca5a5', marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <AlertTriangle size={12} style={{ color: '#f87171', flexShrink: 0, marginTop: '1px' }} />{f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes slideInRight { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
};
