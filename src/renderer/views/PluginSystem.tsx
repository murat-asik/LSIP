import { message } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { Blocks, RefreshCw, Puzzle, CheckCircle, AlertTriangle, Code } from 'lucide-react';
import { useTranslation } from '../i18n';

interface PluginInfo { id: string; name: string; version: string; author: string; description: string; filePath: string; status: string; loadError?: string; }
interface PluginSummary { loadedPlugins: number; activePlugins: number; errorPlugins: number; plugins: PluginInfo[]; }

export const PluginSystem: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PluginSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('plugins:summary');
      if (res?.success) setSummary(res.data);
    } catch (err) { console.error('Plugins fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRescan = async () => {
    setScanning(true);
    try {
      await window.lsip.invoke('plugins:rescan');
      await fetchData();
    } catch (err) { console.error('Rescan error', err); }
    finally { setScanning(false); }
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(147, 51, 234, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Blocks size={22} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('pluginSystemView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('pluginSystemView.subtitle')}</p>
          </div>
        </div>
        <button className="fluent-button primary" onClick={handleRescan} disabled={scanning}>
          <RefreshCw size={14} className={scanning ? 'spin' : ''} /> {t('pluginSystemView.rescanDirectory')}
        </button>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '20px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #a855f7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('pluginSystemView.loadedPlugins')}</span><Blocks size={16} style={{ color: '#a855f7' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.loadedPlugins}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-success)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('pluginSystemView.active')}</span><CheckCircle size={16} style={{ color: 'var(--accent-success)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-success)' }}>{summary.activePlugins}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('pluginSystemView.failedToLoad')}</span><AlertTriangle size={16} style={{ color: 'var(--accent-danger)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.errorPlugins > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{summary.errorPlugins}</div>
          </div>
        </div>
      )}

      <div className="fluent-card" style={{ flex: 1, marginTop: '12px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '16px' }}>{t('pluginSystemView.installedExtensions')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          {loading ? (
             <div className="fluent-empty-state">
                <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }} />
                <h3>{t('pluginSystemView.loadingExtensions')}</h3>
             </div>
          ) : summary?.plugins.length === 0 ? (
             <div className="fluent-empty-state">
                <Puzzle size={48} />
                <h3>{t('pluginSystemView.noPluginsFound')}</h3>
                <p>{t('pluginSystemView.noPluginsDesc')}</p>
             </div>
          ) : (
            summary?.plugins.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-elevated)', border: `1px solid ${p.status === 'error' ? 'var(--accent-danger)' : 'var(--border-light)'}` }}>
                <div style={{ marginTop: '2px' }}>
                  {p.status === 'active' ? <CheckCircle size={20} style={{ color: 'var(--accent-success)' }} /> : <AlertTriangle size={20} style={{ color: 'var(--accent-danger)' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: p.status === 'error' ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{p.name} <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>v{p.version}</span></h4>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>{p.id}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{message(p.description)}</p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    <div><strong>{t('pluginSystemView.author')}</strong> {p.author}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Code size={12} /> {p.filePath}</div>
                  </div>

                  {p.loadError && (
                    <div style={{ marginTop: '12px', padding: '8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      <strong>{t('pluginSystemView.errorLoadingPlugin')}</strong><br/>{p.loadError}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
