import { message } from "../../i18n";
import React, { useEffect, useState } from 'react';
import { Share2, AlertTriangle, ShieldCheck, Bug, Play, RefreshCw } from 'lucide-react';
import { RecursiveObjectViewer } from '../../components/common/RecursiveObjectViewer';
import { useTranslation } from '../../i18n';

export const RedTeamAttackSurfaceView: React.FC = () => {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string>('127.0.0.1');
  const [loading, setLoading] = useState<boolean>(false);
  const [surfaceData, setSurfaceData] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setLoading(true);
    setScanError(null);

    try {
      const res = await window.lsip.invoke('redteam:get-attack-surface', { target });
      if (res.success) {
        setSurfaceData(res.data);
      } else {
        setScanError(res.error || 'Saldırı yüzeyi değerlendirilemedi.');
      }
    } catch (err: any) {
      console.error('Attack surface error:', err);
      setScanError(err.message || 'Saldırı yüzeyi analizi sırasında hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.lsip.invoke('redteam:get-attack-surface', { target: '127.0.0.1' }).then((res: any) => {
      if (res.success) setSurfaceData(res.data);
    }).catch(() => {});
  }, []);

  return (
    <div className="view-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Share2 style={{ color: '#dc2626' }} /> {t('redTeamView.surfaceTitle')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {t('redTeamView.surfaceSubtitle')}
        </p>
      </div>

      <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
        {surfaceData?.coverage && <p>{message(surfaceData.coverage)}</p>}
        <form onSubmit={handleEvaluate} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="fluent-input"
            placeholder={t('redTeamView.surfacePlaceholder') || 'Hedef IP / Alt Ağ (Örn. 192.168.1.1)'}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={loading}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="fluent-button" disabled={loading} style={{ backgroundColor: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loading ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
            {loading ? t('common.loading') : t('redTeamView.evaluateSurface')}
          </button>
        </form>
      </div>

      {scanError && (
        <div className="fluent-card" style={{ padding: '14px 18px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={20} style={{ color: '#ef4444' }} />
          <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{message(scanError)}</span>
        </div>
      )}

      {surfaceData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Visual Graph Representation Card */}
          <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share2 size={18} style={{ color: '#38bdf8' }} /> {t('redTeamView.surfaceTopologyMap', { count: surfaceData.nodes.length }) || `Saldırı Yüzeyi Topoloji Haritası (${surfaceData.nodes.length} Düğüm)`}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
              {surfaceData.nodes.map((node: any) => (
                <div
                  key={node.id}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-primary)',
                    background: node.type === 'IP' ? 'rgba(56,189,248,0.15)' : (node.type === 'Service' || node.type === 'Servis') ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{node.type}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: node.risk === 'high' ? '#f87171' : '#fff' }}>{message(node.label)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Misconfiguration Findings */}
            <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#facc15' }} /> {t('redTeamView.misconfigurationsTitle', { count: surfaceData.misconfigurations.length }) || `Tespit Edilen Yapılandırma Hataları (${surfaceData.misconfigurations.length})`}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {surfaceData.misconfigurations.map((m: any, idx: number) => (
                  <div key={idx} style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '3px solid #facc15' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{message(m.title)}</span>
                      <span className="badge badge-warning">
                        {m.severity === 'medium' ? t('common.medium') : m.severity === 'low' ? t('common.low') : m.severity === 'high' ? t('common.high') : m.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0' }}>{message(m.description)}</p>
                    <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>{t('redTeamView.recommendation') || 'İyileştirme Önerisi:'} {message(m.recommendation)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Public CVE Correlation Matches */}
            <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bug size={18} style={{ color: '#dc2626' }} /> {t('redTeamView.cveCorrelationsTitle', { count: surfaceData.cveMatches.length }) || `Kamu NVD / CVE Korelasyonları (${surfaceData.cveMatches.length})`}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {surfaceData.cveMatches.map((cve: any, idx: number) => (
                  <div key={idx} style={{ padding: '10px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', borderLeft: '3px solid #dc2626' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#f87171' }}>{cve.cveId} ({cve.software} {cve.version})</span>
                      <span className="badge badge-danger">CVSS {cve.cvssScore}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{message(cve.summary)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
