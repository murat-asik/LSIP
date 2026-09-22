import { message } from "../../i18n";
import React, { useState } from 'react';
import { Terminal, Globe, Play, RefreshCw, Layers } from 'lucide-react';
import { RecursiveObjectViewer } from '../../components/common/RecursiveObjectViewer';
import { useTranslation } from '../../i18n';

export const RedTeamDnsWhoisView: React.FC = () => {
  const { t } = useTranslation();
  const [domain, setDomain] = useState<string>('google.com');
  const [loading, setLoading] = useState<boolean>(false);
  const [dnsResult, setDnsResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    setLoading(true);
    setDnsResult(null);
    setScanError(null);

    try {
      const res = await window.lsip.invoke('redteam:get-dns-intelligence', { domain });
      if (res.success) {
        setDnsResult(res.data);
      } else {
        setScanError(res.error || 'DNS kayıtları çözümlenemedi.');
      }
    } catch (err: any) {
      console.error('DNS Intelligence error:', err);
      setScanError(err.message || 'DNS sorgulama sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal style={{ color: '#dc2626' }} /> {t('redTeamView.dnsTitle')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {t('redTeamView.dnsSubtitle')}
        </p>
      </div>

      <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
        <form onSubmit={handleQuery} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="fluent-input"
            placeholder={t('redTeamView.dnsPlaceholder') || 'Alan Adı (Örn. example.com)'}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={loading}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="fluent-button" disabled={loading} style={{ backgroundColor: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loading ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
            {loading ? t('common.loading') : t('redTeamView.resolveDns')}
          </button>
        </form>
      </div>

      {scanError && (
        <div className="fluent-card" style={{ padding: '14px 18px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={20} style={{ color: '#ef4444' }} />
          <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{message(scanError)}</span>
        </div>
      )}

      {dnsResult?.registration && <div className="fluent-card">
        <h3>{t('redTeamView.registration')}</h3>
        {dnsResult.registration.success ? <RecursiveObjectViewer data={dnsResult.registration} /> : <p role="status">{message(dnsResult.registration.error)}</p>}
      </div>}
      {dnsResult && Object.keys(dnsResult.warnings || {}).length > 0 && <div role="status" className="fluent-card">
        <RecursiveObjectViewer data={dnsResult.warnings} />
      </div>}
      {dnsResult && (
        <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', color: '#38bdf8' }}>
            {t('redTeamView.dnsRecordsFor', { domain: dnsResult.domain }) || `${dnsResult.domain} için DNS Kayıtları`}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.85rem' }}>
            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '6px' }}>{t('redTeamView.ipv4Addresses') || 'IPv4 Adresleri (A)'}</h4>
              <RecursiveObjectViewer data={dnsResult.records.A} />
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '6px' }}>{t('redTeamView.mxServers') || 'E-posta Sunucuları (MX)'}</h4>
              <RecursiveObjectViewer data={dnsResult.records.MX} />
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '6px' }}>{t('redTeamView.nameServers') || 'İsim Sunucuları (NS)'}</h4>
              <RecursiveObjectViewer data={dnsResult.records.NS} />
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '6px' }}>{t('redTeamView.spfPolicy') || 'SPF Güvenlik Politikası'}</h4>
              <div style={{ fontFamily: 'monospace', color: '#facc15', fontSize: '0.78rem' }}>{message(dnsResult.records.SPF)}</div>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '6px' }}>{t('redTeamView.dmarcPolicy') || 'DMARC Politikası'}</h4>
              <div style={{ fontFamily: 'monospace', color: '#4ade80', fontSize: '0.78rem' }}>{message(dnsResult.records.DMARC)}</div>
            </div>

            <div>
              <h4 style={{ fontWeight: 600, marginBottom: '6px' }}>{t('redTeamView.txtRecords') || 'TXT Kayıtları'}</h4>
              <RecursiveObjectViewer data={dnsResult.records.TXT} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
