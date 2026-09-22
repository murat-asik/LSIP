import React, { useState } from 'react';
import { Binary, Search, RefreshCw, CheckCircle, FileText, Globe, Key } from 'lucide-react';
import { useTranslation } from '../i18n';

interface IocMatch { id: string; indicator: string; type: string; source: string; timestamp: number; context: string; severity: string; }
interface IocScanResult { scanId: string; startTime: number; endTime: number; indicatorsSearched: number; matchesFound: number; matches: IocMatch[]; }

export const IocScanner: React.FC = () => {
  const { t } = useTranslation();
  const [inputData, setInputData] = useState('');
  const [result, setResult] = useState<IocScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const runScan = async () => {
    if (!inputData.trim()) return;
    setIsScanning(true);
    try {
      const indicators = inputData.split(/[\n,;\s]+/).map(i => i.trim()).filter(i => i);
      const res = await window.lsip.invoke('ioc:scan', { indicators });
      if (res?.success) setResult(res.data);
    } catch (err) { console.error('IOC scan error:', err); }
    finally { setIsScanning(false); }
  };

  const getIcon = (type: string) => {
    if (type === 'ip') return <Globe size={14} style={{ color: 'var(--accent-info)' }} />;
    if (type === 'hash') return <FileText size={14} style={{ color: 'var(--accent-warning)' }} />;
    return <Key size={14} style={{ color: 'var(--text-secondary)' }} />;
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Binary size={22} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('iocScannerView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('iocScannerView.subtitle')}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Input Panel */}
        <div className="fluent-card" style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('iocScannerView.inputIndicators')}</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('iocScannerView.inputDesc')}</p>
          <textarea 
            className="fluent-input" 
            style={{ flex: 1, resize: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', padding: '10px' }}
            value={inputData}
            onChange={e => setInputData(e.target.value)}
            placeholder={"8.8.8.8\nmalicious-domain.com\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
          />
          <button className="fluent-button primary" onClick={runScan} disabled={isScanning || !inputData.trim()}>
            {isScanning ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
            {isScanning ? t('iocScannerView.scanning') : t('iocScannerView.scanNow')}
          </button>
        </div>

        {/* Results Panel */}
        <div className="fluent-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('iocScannerView.scanResults')}</h3>
            {result && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {t('iocScannerView.searched')}: <strong style={{ color: 'var(--text-primary)' }}>{result.indicatorsSearched}</strong> | 
                {t('iocScannerView.found')}: <strong style={{ color: result.matchesFound > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{result.matchesFound}</strong>
              </div>
            )}
          </div>

          <div className="fluent-table-container" style={{ flex: 1 }}>
            <table className="fluent-table">
              <thead><tr><th style={{ width: '40px' }}>{t('iocScannerView.type')}</th><th>{t('iocScannerView.indicator')}</th><th>{t('iocScannerView.source')}</th><th>{t('iocScannerView.context')}</th><th>{t('iocScannerView.time')}</th></tr></thead>
              <tbody>
                {!result && !isScanning ? <tr><td colSpan={5}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><Binary size={32}/><p>{t('iocScannerView.enterIndicators')}</p></div></td></tr>
                : isScanning ? <tr><td colSpan={5}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('iocScannerView.searchingDatabases')}</p></div></td></tr>
                : result?.matches.length === 0 ? <tr><td colSpan={5}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><CheckCircle size={32} style={{ color: 'var(--accent-success)' }}/><p>{t('iocScannerView.cleanNoMatches')}</p></div></td></tr>
                : result?.matches.map((m, i) => (
                  <tr key={i}>
                    <td><div style={{ padding: '4px', borderRadius: '4px', backgroundColor: 'var(--bg-elevated)', display: 'inline-flex' }}>{getIcon(m.type)}</div></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-danger)' }}>{m.indicator}</td>
                    <td><span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{m.source}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.context}</td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(m.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
