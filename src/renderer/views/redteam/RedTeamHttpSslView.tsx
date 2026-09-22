import { message } from "../../i18n";
import React, { useState } from 'react';
import { Globe2, ShieldCheck, AlertCircle, Play, Award, Lock, RefreshCw } from 'lucide-react';
import { RecursiveObjectViewer } from '../../components/common/RecursiveObjectViewer';
import { useTranslation } from '../../i18n';

export const RedTeamHttpSslView: React.FC = () => {
  const { t, language } = useTranslation();
  const [url, setUrl] = useState<string>('https://google.com');
  const [loading, setLoading] = useState<boolean>(false);
  const [httpResult, setHttpResult] = useState<any>(null);
  const [sslResult, setSslResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setHttpResult(null);
    setSslResult(null);
    setScanError(null);

    try {
      const httpRes = await window.lsip.invoke('redteam:analyze-http', { url });
      if (httpRes.success) {
        setHttpResult(httpRes.data);
      } else {
        setScanError(httpRes.error || 'HTTP analizi başarısız oldu.');
      }

      const parsedHost = url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      const sslRes = await window.lsip.invoke('redteam:inspect-ssl', { host: parsedHost });
      if (sslRes.success) {
        setSslResult(sslRes.data);
      }
    } catch (err: any) {
      console.error('HTTP/SSL Analysis error:', err);
      setScanError(err.message || 'HTTP/SSL analizi sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe2 style={{ color: '#dc2626' }} /> {t('redTeamView.httpTitle')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {t('redTeamView.httpSubtitle')}
        </p>
      </div>

      <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
        <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="fluent-input"
            placeholder={t('redTeamView.httpPlaceholder') || 'Hedef URL / Domain (Örn. https://example.com)'}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="fluent-button" disabled={loading} style={{ backgroundColor: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loading ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
            {loading ? t('common.loading') : t('redTeamView.inspectWeb')}
          </button>
        </form>
      </div>

      {scanError && (
        <div className="fluent-card" style={{ padding: '14px 18px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} style={{ color: '#ef4444' }} />
          <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{message(scanError)}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* HTTP Headers Analysis */}
        <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe2 size={18} style={{ color: '#38bdf8' }} /> {t('redTeamView.httpHeadersTitle') || 'HTTP Güvenlik Başlıkları'}
          </h3>

          {httpResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span>{t('redTeamView.statusCode') || 'Durum Kodu:'} <strong style={{ color: '#4ade80' }}>{httpResult.statusCode}</strong></span>
                <span>{t('redTeamView.server') || 'Sunucu:'} <strong>{httpResult.server}</strong></span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="fluent-card" style={{ padding: '10px', fontSize: '0.8rem' }}>
                  <span>HSTS: </span>
                  <span className={`badge ${httpResult.securityHeaders.hsts ? 'badge-success' : 'badge-danger'}`}>
                    {httpResult.securityHeaders.hsts ? (t('common.enabled') || 'Etkin') : (t('common.disabled') || 'Eksik')}
                  </span>
                </div>
                <div className="fluent-card" style={{ padding: '10px', fontSize: '0.8rem' }}>
                  <span>CSP: </span>
                  <span className={`badge ${httpResult.securityHeaders.csp ? 'badge-success' : 'badge-warning'}`}>
                    {httpResult.securityHeaders.csp ? (t('common.enabled') || 'Etkin') : (t('common.disabled') || 'Eksik')}
                  </span>
                </div>
                <div className="fluent-card" style={{ padding: '10px', fontSize: '0.8rem' }}>
                  <span>X-Frame-Options: </span>
                  <strong style={{ color: '#facc15' }}>{httpResult.securityHeaders.xfo}</strong>
                </div>
                <div className="fluent-card" style={{ padding: '10px', fontSize: '0.8rem' }}>
                  <span>CORS: </span>
                  <strong style={{ color: '#facc15' }}>{httpResult.securityHeaders.cors}</strong>
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('redTeamView.allRawHeaders') || 'Tüm Ham Başlıklar:'}</span>
                <RecursiveObjectViewer data={httpResult.headers} />
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('common.noData')}</div>
          )}
        </div>

        {/* SSL Certificate Chain Inspection */}
        <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: '#facc15' }} /> {t('redTeamView.tlsDetailsTitle') || 'TLS Sertifika Detayları'}
          </h3>

          {sslResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
              <div>{t('redTeamView.issuer') || 'Yayımlayan (Issuer):'} <strong style={{ color: '#38bdf8' }}>{sslResult.issuer}</strong></div>
              <div>{t('redTeamView.subject') || 'Konu (Subject CN):'} <strong>{sslResult.subject}</strong></div>
              <div>{t('redTeamView.tlsVersion') || 'TLS Sürümü:'} <strong style={{ color: '#4ade80' }}>{sslResult.tlsVersion}</strong> ({sslResult.cipher})</div>
              <div>{t('redTeamView.keySize') || 'Anahtar Boyutu:'} <strong>{sslResult.keySize} bit</strong></div>
              <div>{t('redTeamView.validTo') || 'Son Kullanma Tarihi:'} <span>{new Date(sslResult.validTo).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}</span></div>

              <div style={{ marginTop: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('redTeamView.sanList') || 'Alternatif Konu İsimleri (SAN):'}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {sslResult.sanList.map((san: string, idx: number) => (
                    <span key={idx} className="badge" style={{ background: 'rgba(255,255,255,0.08)', fontSize: '0.72rem' }}>{san}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('common.noData')}</div>
          )}
        </div>
      </div>
    </div>
  );
};
