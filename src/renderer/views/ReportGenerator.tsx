import { message } from "../i18n";
import React, { useState } from 'react';
import { FileText, FileJson, Download, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../i18n';

interface ReportConfig { includeSystemInfo: boolean; includeReputation: boolean; includeAnomalies: boolean; includeConnections: boolean; includeTimeline: boolean; format: 'json' | 'html' | 'csv' | 'pdf'; }

export const ReportGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ReportConfig>({
    includeSystemInfo: true,
    includeReputation: true,
    includeAnomalies: true,
    includeConnections: false,
    includeTimeline: false,
    format: 'html'
  });
  
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; filePath?: string; errorMessage?: string; sizeBytes?: number; } | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await window.lsip.invoke('reports:generate', config);
      if (res?.success) setResult(res.data);
      else setResult({ success: false, errorMessage: typeof res?.error === 'string' ? res.error : res?.error?.message || 'Unknown error' });
    } catch (err: any) {
      setResult({ success: false, errorMessage: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const toggleConfig = (key: keyof ReportConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={22} style={{ color: '#6366f1' }} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('reportGeneratorView.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('reportGeneratorView.subtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
        <div className="fluent-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>{t('reportGeneratorView.includeSections')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { key: 'includeSystemInfo', label: t('reportGeneratorView.systemMetadata'), desc: t('reportGeneratorView.systemMetadataDesc') },
                { key: 'includeReputation', label: t('reportGeneratorView.hostReputation'), desc: t('reportGeneratorView.hostReputationDesc') },
                { key: 'includeAnomalies', label: t('reportGeneratorView.securityAnomalies'), desc: t('reportGeneratorView.securityAnomaliesDesc') },
                { key: 'includeConnections', label: t('reportGeneratorView.activeConnections'), desc: t('reportGeneratorView.activeConnectionsDesc') },
                { key: 'includeTimeline', label: t('reportGeneratorView.recentEventsTimeline'), desc: t('reportGeneratorView.recentEventsTimelineDesc') },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '8px', backgroundColor: config[item.key as keyof ReportConfig] ? 'rgba(99, 102, 241, 0.1)' : 'transparent', border: `1px solid ${config[item.key as keyof ReportConfig] ? '#6366f1' : 'var(--border-light)'}` }}>
                  <input type="checkbox" checked={config[item.key as keyof ReportConfig] as boolean} onChange={() => toggleConfig(item.key as keyof ReportConfig)} style={{ marginTop: '3px' }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: config[item.key as keyof ReportConfig] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{message(item.label)}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>{t('reportGeneratorView.exportFormat')}</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['html', 'json', 'csv', 'pdf'].map(fmt => (
                <button key={fmt} onClick={() => setConfig(prev => ({ ...prev, format: fmt as any }))} style={{ flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${config.format === fmt ? '#6366f1' : 'var(--border-light)'}`, backgroundColor: config.format === fmt ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: config.format === fmt ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  {fmt === 'html' ? <FileText size={20} /> : fmt === 'json' ? <FileJson size={20} /> : <FileText size={20} />}
                  <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>{fmt}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="fluent-button primary" style={{ width: '100%', padding: '12px', fontSize: '0.9rem', justifyContent: 'center' }} onClick={handleGenerate} disabled={generating}>
            {generating ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
            {generating ? t('reportGeneratorView.generatingReport') : t('reportGeneratorView.generateSaveReport')}
          </button>
        </div>

        <div className="fluent-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
          {!result && !generating ? (
            <div className="fluent-empty-state">
              <FileText size={48} />
              <p style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 600 }}>{t('reportGeneratorView.readyToExport')}</p>
              <p>{t('reportGeneratorView.readyToExportDesc')}</p>
            </div>
          ) : generating ? (
            <div className="fluent-empty-state">
              <RefreshCw size={48} className="spin" style={{ color: 'var(--accent-primary)' }} />
              <p style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 600 }}>{t('reportGeneratorView.aggregatingData')}</p>
              <p>{t('reportGeneratorView.aggregatingDataDesc')}</p>
            </div>
          ) : result?.success ? (
            <div className="fluent-empty-state">
              <CheckCircle size={48} style={{ color: 'var(--accent-success)' }} />
              <p style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 600 }}>{t('reportGeneratorView.reportSavedSuccess')}</p>
              <p>{t('reportGeneratorView.file')} <span style={{ fontFamily: 'var(--font-mono)' }}>{result.filePath}</span><br/>{t('reportGeneratorView.size')} {((result.sizeBytes || 0) / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="fluent-empty-state">
              <AlertTriangle size={48} style={{ color: 'var(--accent-danger)' }} />
              <p style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 600 }}>{t('reportGeneratorView.generationFailed')}</p>
              <p style={{ color: 'var(--accent-danger)' }}>{result?.errorMessage}</p>
            </div>
          )}
        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
