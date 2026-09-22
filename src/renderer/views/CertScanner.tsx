import { t as translateText } from "../i18n";
import React, { useEffect, useState, useCallback } from 'react';
import { Award, RefreshCw, Search, AlertTriangle, Key, Clock } from 'lucide-react';
import { useTranslation } from '../i18n';

interface CertEntry { thumbprint: string; subject: string; issuer: string; storeName: string; storeLocation: string; notBefore: number; notAfter: number; hasPrivateKey: boolean; isSelfSigned: boolean; isExpired: boolean; algorithm: string; }
interface CertSummary { totalCerts: number; expiredCerts: number; selfSignedCerts: number; personalCerts: number; certificates: CertEntry[]; }

export const CertScanner: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<CertSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('certs:summary');
      if (res?.success) setSummary(res.data);
    } catch (err) { console.error('Certs fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = (summary?.certificates || []).filter(c =>
    !searchQuery || c.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.issuer.toLowerCase().includes(searchQuery.toLowerCase()) || c.storeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(202, 138, 4, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={22} style={{ color: '#eab308' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('certScannerView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('certScannerView.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input type="text" placeholder={t('certScannerView.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '200px', fontFamily: 'var(--font-sans)' }} />
          </div>
          <button className="fluent-button primary" onClick={fetchData}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('certScannerView.scan')}</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #eab308' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('certScannerView.totalCerts')}</span><Award size={16} style={{ color: '#eab308' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.totalCerts}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('certScannerView.expiredCerts')}</span><Clock size={16} style={{ color: 'var(--accent-danger)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.expiredCerts > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{summary.expiredCerts}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('certScannerView.selfSigned')}</span><AlertTriangle size={16} style={{ color: 'var(--accent-warning)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.selfSignedCerts}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('certScannerView.anomalies')}</span><AlertTriangle size={16} style={{ color: 'var(--accent-danger)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: (summary.certificates.filter(c => c.algorithm.includes('MD5') || c.algorithm.includes('SHA1')).length) > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
              {summary.certificates.filter(c => c.algorithm.includes('MD5') || c.algorithm.includes('SHA1')).length}
            </div>
          </div>
        </div>
      )}

      <div className="fluent-table-container" style={{ flex: 1, marginTop: '4px' }}>
        <table className="fluent-table">
          <thead><tr><th style={{ width: '60px' }}>{t('certScannerView.status')}</th><th>{t('certScannerView.subject')}</th><th>{t('certScannerView.issuer')}</th><th>{t('certScannerView.store')}</th><th>{t('certScannerView.expires')}</th><th>{t('certScannerView.algo')}</th><th style={{ textAlign: 'center' }}>{t('certScannerView.keys')}</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('certScannerView.scanningStore')}</p></div></td></tr>
            : filtered.length === 0 ? <tr><td colSpan={7}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><Award size={32}/><p>{t('certScannerView.noCertsMatch')}</p></div></td></tr>
            : filtered.map((c, i) => (
              <tr key={i}>
                <td>
                  {c.isExpired ? <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'rgba(220,38,38,0.12)', color: 'var(--accent-danger)' }}>{translateText("interfaceText.message039")}</span>
                  : (c.algorithm.includes('MD5') || c.algorithm.includes('SHA1')) ? <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'rgba(220,38,38,0.12)', color: 'var(--accent-danger)' }}>{translateText("interfaceText.message040")}</span>
                  : c.isSelfSigned ? <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--accent-warning)' }}>{translateText("interfaceText.message041")}</span>
                  : <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'rgba(16,185,129,0.12)', color: 'var(--accent-success)' }}>{translateText("interfaceText.message042")}</span>}
                </td>
                <td style={{ fontWeight: 500, fontSize: '0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.subject.replace(/^CN=/, '')}</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.issuer.replace(/^CN=/, '')}</td>
                <td><span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{c.storeName}</span></td>
                <td style={{ fontSize: '0.75rem', color: c.isExpired ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>{c.notAfter ? new Date(c.notAfter).toLocaleDateString() : '—'}</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{c.algorithm}</td>
                <td style={{ textAlign: 'center' }}>{c.hasPrivateKey ? <Key size={14} style={{ color: 'var(--accent-info)', margin: '0 auto' }} /> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
