import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import React, { useEffect, useState, useCallback } from 'react';
import { FolderLock, RefreshCw, Users, Eye, EyeOff, Lock, HardDrive } from 'lucide-react';
import { useTranslation } from '../i18n';

interface SmbShare { name: string; path: string; description: string; shareType: string; currentUsers: number; maxUsers: number; isHidden: boolean; }
interface SmbSession { id: number; username: string; computerName: string; clientIp: string; connectedTime: number; idleTime: number; openFiles: number; timestamp: number; }
interface SmbSummary { totalShares: number; hiddenShares: number; activeSessions: number; shares: SmbShare[]; }

export const SmbIntelligence: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SmbSummary | null>(null);
  const [sessions, setSessions] = useState<SmbSession[]>([]);
  const [selectedShare, setSelectedShare] = useState<SmbShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sumRes, sesRes] = await Promise.all([
        window.lsip.invoke('smb:summary'),
        window.lsip.invoke('smb:sessions'),
      ]);
      if (sumRes?.success) setSummary(sumRes.data);
      if (sesRes?.success) setSessions(sesRes.data);
    } catch (err) { console.error('SMB fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = createViewPolling('smb', fetchData, 15000); return () => stopViewPolling(i); }, [fetchData]);

  const filteredShares = summary?.shares?.filter(s => showHidden || !s.isHidden) || [];
  const getShareIcon = (s: SmbShare) => {
    if (s.shareType === 'ipc') return <Lock size={14} style={{ color: 'var(--accent-warning)' }} />;
    if (s.isHidden) return <EyeOff size={14} style={{ color: 'var(--text-tertiary)' }} />;
    return <HardDrive size={14} style={{ color: 'var(--accent-primary)' }} />;
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderLock size={22} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('smbIntelligenceView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('smbIntelligenceView.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`fluent-button ${showHidden ? 'primary' : ''}`} onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? <Eye size={14} /> : <EyeOff size={14} />} {showHidden ? t('smbIntelligenceView.hideHidden') : t('smbIntelligenceView.showHidden')}
          </button>
          <button className="fluent-button primary" onClick={fetchData}><RefreshCw size={14} /> {t('smbIntelligenceView.refresh')}</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('smbIntelligenceView.totalShares')}</span><FolderLock size={16} style={{ color: '#f59e0b' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.totalShares}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('smbIntelligenceView.hiddenShares')}</span><EyeOff size={16} style={{ color: 'var(--accent-warning)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.hiddenShares > 0 ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{summary.hiddenShares}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-info)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('smbIntelligenceView.activeSessions')}</span><Users size={16} style={{ color: 'var(--accent-info)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.activeSessions}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        <div className="fluent-table-container" style={{ flex: 1 }}>
          <table className="fluent-table">
            <thead><tr><th style={{ width: '40px' }}></th><th>{t('smbIntelligenceView.shareName')}</th><th>{t('smbIntelligenceView.path')}</th><th>{t('smbIntelligenceView.type')}</th><th>{t('smbIntelligenceView.description')}</th><th>{t('smbIntelligenceView.users')}</th></tr></thead>
            <tbody>
              {loading ? (<tr><td colSpan={6}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('smbIntelligenceView.enumeratingShares')}</p></div></td></tr>)
              : filteredShares.length === 0 ? (<tr><td colSpan={6}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><FolderLock size={32}/><p>{t('smbIntelligenceView.noSharesFound')}</p></div></td></tr>)
              : filteredShares.map((s, i) => (
                <tr key={i} onClick={() => setSelectedShare(s)} style={{ cursor: 'pointer', backgroundColor: selectedShare?.name === s.name ? 'rgba(37, 99, 235, 0.08)' : undefined }}>
                  <td>{getShareIcon(s)}</td>
                  <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: s.isHidden ? 400 : 500 }}>{s.name}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.path || '—'}</td>
                  <td><span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{s.shareType}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{s.description || '—'}</td>
                  <td>{s.currentUsers > 0 ? <span style={{ color: 'var(--accent-success)' }}>{s.currentUsers}</span> : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sessions.length > 0 && (
          <div className="fluent-card" style={{ width: '320px', flexShrink: 0, overflow: 'auto' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>{t('smbIntelligenceView.activeSessions')}</h3>
            {sessions.map((s, i) => (
              <div key={i} style={{ padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{s.username}</div>
                  {s.username.toLowerCase().includes('admin') || s.username.toLowerCase().includes('system') ? (
                    <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(220, 38, 38, 0.15)', color: '#ef4444', fontWeight: 600 }}>{t('smbIntelligenceView.lateralMovementRisk')}</span>
                  ) : null}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{s.clientIp || s.computerName}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                  <span>{t('smbIntelligenceView.openFiles')}: {s.openFiles}</span>
                  <span>{t('smbIntelligenceView.connected')}: {Math.floor(s.connectedTime / 60)}m</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
