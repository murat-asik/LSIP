import { message } from "../i18n";
import React, { useEffect, useState } from 'react';
import { Sparkles, Shield, AlertTriangle, CheckCircle, RefreshCw, Layers, ShieldCheck, HelpCircle } from 'lucide-react';
import { AiAnalystSummary } from '../../main/modules/ai-analyst/ai-analyst.module';
import { useTranslation } from '../i18n';

export const AiAnalystView: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<AiAnalystSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const res = await window.lsip.invoke('ai-analyst:analyze');
      if (!res?.success) throw new Error(res?.error || 'Analiz verisi alınamadı');
      setSummary(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analiz verisi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const getRiskBadgeClass = (level?: string) => {
    switch (level) {
      case 'CRITICAL': return 'badge-danger';
      case 'HIGH': return 'badge-danger';
      case 'MEDIUM': return 'badge-warning';
      case 'UNKNOWN': return 'badge-warning';
      default: return 'badge-success';
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles style={{ color: 'var(--accent-primary-hover)' }} /> {t('aiAnalyst.title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t('aiAnalyst.subtitle')}
          </p>
        </div>
        <button className="fluent-button" onClick={fetchAnalysis} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>{t('aiAnalyst.reAnalyze')}</span>
        </button>
      </div>

      {error && <div role="alert" className="fluent-card" style={{ padding: '18px', color: 'var(--accent-danger)' }}>{message(error)}</div>}
      {loading ? (
        <div className="fluent-card fluent-glass" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Sparkles size={32} className="spin" style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
          <div>{t('common.loading')}</div>
        </div>
      ) : summary ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Executive Overview Banner */}
          <div
            className="fluent-card fluent-glass"
            style={{
              padding: '24px',
              borderLeft: `4px solid ${summary.riskLevel === 'CRITICAL' || summary.riskLevel === 'HIGH' ? '#ef4444' : summary.riskLevel === 'MEDIUM' || summary.riskLevel === 'UNKNOWN' ? '#eab308' : '#22c55e'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{t('aiAnalyst.execRisk')}</h2>
                <span className={`badge ${getRiskBadgeClass(summary.riskLevel)}`} style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                  {summary.riskLevel === 'UNKNOWN' ? message('BİLİNMİYOR') : `${message(summary.riskLevel)} ${message('RISK')} (${summary.riskScore}/100)`}
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                {message(summary.executiveSummary)}
              </p>
            </div>
          </div>

          {/* Core Findings Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px', color: '#38bdf8' }}>{t('aiAnalyst.attackSurface')}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {message(summary.attackSurfaceOverview)}
              </p>
            </div>

            <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px', color: '#38bdf8' }}>{t('aiAnalyst.exposedServices')}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{message(summary.exposedServicesAnalysis)}</p>
            </div>

            <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px', color: '#38bdf8' }}>{t('aiAnalyst.certHealth')}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{message(summary.certificateHealthAnalysis)}</p>
            </div>

            <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px', color: '#38bdf8' }}>{t('aiAnalyst.webHeaders')}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{message(summary.securityHeadersAnalysis)}</p>
            </div>
          </div>

          {/* Actionable Defensive Mitigations */}
          <div className="fluent-card fluent-glass" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80' }}>
              <ShieldCheck size={20} /> {t('aiAnalyst.mitigations')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {summary.recommendedMitigations.map((rec, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.85rem',
                  }}
                >
                  <CheckCircle size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
                  <span>{message(rec)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
