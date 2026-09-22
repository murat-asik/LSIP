import { message } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { Fingerprint, RefreshCw, Shield, AlertTriangle, FileText, FolderOpen, Hash, Play } from 'lucide-react';
import { useTranslation } from '../i18n';

interface FimEntry { id: number; filePath: string; fileName: string; directory: string; hashSha256: string; previousHash?: string; fileSize: number; lastModified: number; lastChecked: number; status: string; }
interface FimChangeEvent { id: number; timestamp: number; filePath: string; changeType: string; previousHash?: string; currentHash?: string; severity: string; }
interface FimWatchPath { path: string; recursive: boolean; patterns: string[]; label: string; }
interface FimSummary { limitedPaths?: string[]; lastError?: string; monitoredFiles: number; totalChanges: number; criticalChanges: number; watchPaths: FimWatchPath[]; recentChanges: FimChangeEvent[]; }

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  unchanged: { color: '#34d399', bg: 'rgba(5, 150, 105, 0.12)' },
  modified: { color: '#f87171', bg: 'rgba(220, 38, 38, 0.12)' },
  new: { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
  deleted: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
  error: { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.08)' },
};

export const FileIntegrity: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<FimSummary | null>(null);
  const [scanResults, setScanResults] = useState<FimEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('fim:summary');
      if (res?.success) { setSummary(res.data); setError(null); } else setError(res?.error?.message || String(res?.error));
    } catch (err) { console.error('FIM fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runBaseline = async () => {
    setIsScanning(true);
    try {
      const res = await window.lsip.invoke('fim:baseline');
      if (res?.success) setScanResults(res.data);
      else throw new Error(res?.error?.message || String(res?.error));
      await fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setIsScanning(false); }
  };

  const formatHash = (hash: string) => hash ? hash.substring(0, 16) + '...' : '—';

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Fingerprint size={22} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('fileIntegrityView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('fileIntegrityView.subtitle')}</p>
          </div>
        </div>
        <button className="fluent-button primary" onClick={runBaseline} disabled={isScanning}>
          {isScanning ? <RefreshCw size={14} className="spin" /> : <Play size={14} />}
          {isScanning ? t('fileIntegrityView.scanning') : t('fileIntegrityView.runBaselineScan')}
        </button>
      </div>

      {(error || summary?.lastError) && <div role="alert">{message(error || summary?.lastError || '')}</div>}
      {(summary?.limitedPaths?.length || 0) > 0 && <div role="status">{t('fileIntegrityView.limitedCoverage')} {summary!.limitedPaths!.join(', ')}</div>}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('fileIntegrityView.monitoredFiles')}</span><FileText size={16} style={{ color: '#10b981' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.monitoredFiles}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('fileIntegrityView.totalChanges')}</span><AlertTriangle size={16} style={{ color: 'var(--accent-warning)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.totalChanges > 0 ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{summary.totalChanges}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('fileIntegrityView.criticalChanges')}</span><Shield size={16} style={{ color: 'var(--accent-danger)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.criticalChanges > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{summary.criticalChanges}</div>
          </div>
        </div>
      )}

      {/* Watch Paths */}
      {summary && summary.watchPaths.length > 0 && (
        <div className="fluent-card" style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}><FolderOpen size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> {t('fileIntegrityView.monitoredPaths')}</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {summary.watchPaths.map((wp, i) => (
              <div key={i} style={{ padding: '6px 10px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', fontSize: '0.75rem' }}>
                <span style={{ fontWeight: 500 }}>{message(wp.label)}</span>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{wp.path}</span>
                <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: 'var(--accent-info)' }}>{wp.patterns.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan Results Table */}
      <div className="fluent-table-container" style={{ flex: 1 }}>
        <table className="fluent-table">
          <thead><tr><th style={{ width: '60px' }}>{t('fileIntegrityView.status')}</th><th>{t('fileIntegrityView.fileName')}</th><th>{t('fileIntegrityView.directory')}</th><th>{t('fileIntegrityView.sha256')}</th><th>{t('fileIntegrityView.size')}</th><th>{t('fileIntegrityView.lastModified')}</th></tr></thead>
          <tbody>
            {scanResults.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="fluent-empty-state" style={{ minHeight: '150px' }}>
                  <Fingerprint size={32} />
                  <p>{summary && summary.monitoredFiles > 0 ? `${summary.monitoredFiles} ${t('fileIntegrityView.filesInBaseline')}` : t('fileIntegrityView.noBaselineData')}</p>
                </div>
              </td></tr>
            ) : scanResults.map((f, i) => {
              const st = STATUS_STYLE[f.status] || STATUS_STYLE.unchanged;
              return (
                <tr key={i}>
                  <td><span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: st.bg, color: st.color, textTransform: 'uppercase', fontWeight: 600 }}>{message(f.status)}</span></td>
                  <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{f.fileName}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.directory}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent-info)' }}><Hash size={10} style={{ marginRight: '2px', verticalAlign: 'middle' }} />{formatHash(f.hashSha256)}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{(f.fileSize / 1024).toFixed(1)} KB</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(f.lastModified).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {summary && summary.recentChanges.length > 0 && (
        <div className="fluent-card" style={{ marginTop: '16px', overflow: 'auto' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>{t('fileIntegrityView.recentChanges')}</h3>
          <table className="fluent-table">
            <thead><tr><th style={{ width: '60px' }}>{t('fileIntegrityView.type')}</th><th>{t('fileIntegrityView.file')}</th><th>{t('fileIntegrityView.previousHash')}</th><th>{t('fileIntegrityView.currentHash')}</th><th style={{ width: '120px' }}>{t('fileIntegrityView.time')}</th></tr></thead>
            <tbody>
              {summary.recentChanges.map((c, i) => (
                <tr key={i}>
                  <td>
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: c.changeType === 'modified' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.15)', color: c.changeType === 'modified' ? 'var(--accent-warning)' : 'var(--accent-danger)', textTransform: 'uppercase' }}>
                      {c.changeType}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.filePath}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{formatHash(c.previousHash || '')}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent-info)' }}>{formatHash(c.currentHash || '')}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(c.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
