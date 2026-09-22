import { message } from "../../i18n";
import React, { useEffect, useState } from 'react';
import { Crosshair, Play, CheckCircle2, ShieldAlert, Cpu, Terminal, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const RedTeamPortScannerView: React.FC = () => {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string>('127.0.0.1');
  const [nmapStatus, setNmapStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    window.lsip.invoke('redteam:check-nmap').then((res: any) => {
      setNmapStatus(res);
    }).catch(() => {
      setNmapStatus({ available: false, message: 'Nmap bulunamadı. Yerel Node.js tarama motoru aktif.' });
    });
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setScanning(true);
    setScanResult(null);
    setScanError(null);

    try {
      const res = await window.lsip.invoke('redteam:scan-ports', { target });
      if (res.success) {
        setScanResult(res);
      } else {
        setScanError(res.error || 'Port taraması gerçekleştirilemedi.');
      }
    } catch (err: any) {
      console.error('Scan failed:', err);
      setScanError(err.message || 'Port taraması sırasında beklenmeyen bir hata oluştu.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Crosshair style={{ color: '#dc2626' }} /> {t('redTeamView.portScannerTitle')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {t('redTeamView.portScannerSubtitle')}
        </p>
      </div>

      {/* Engine Status Card */}
      <div className="fluent-card fluent-glass" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={18} style={{ color: '#dc2626' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            {nmapStatus ? message(nmapStatus.message) : t('redTeamView.checkingEngines')}
          </span>
        </div>
        <span className={`badge ${nmapStatus?.available ? 'badge-success' : 'badge-info'}`}>
          {nmapStatus?.available ? (t('redTeamView.nmapEngine') || 'Nmap Binary Engine') : (t('redTeamView.nodeEngine') || 'Native Node.js Engine')}
        </span>
      </div>

      {/* Input Form */}
      <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
        <form onSubmit={handleScan} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="fluent-input"
            placeholder={t('redTeamView.targetPlaceholder')}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={scanning}
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="fluent-button" disabled={scanning} style={{ backgroundColor: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {scanning ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
            {scanning ? t('common.loading') : t('redTeamView.startScan')}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {scanError && (
        <div className="fluent-card" style={{ padding: '14px 18px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={20} style={{ color: '#ef4444' }} />
          <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{message(scanError)}</span>
        </div>
      )}

      {/* Results */}
      {scanResult && (
        <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', color: '#dc2626' }}>
            {t('redTeamView.openPorts')} ({scanResult.openPorts?.length || 0})
          </h3>

          {scanResult.openPorts?.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>{t('common.noData')}</div>
          ) : (
            <table className="fluent-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>{t('redTeamView.colPort') || 'Port'}</th>
                  <th>{t('redTeamView.colProtocol') || 'Protocol'}</th>
                  <th>{t('redTeamView.colState') || 'State'}</th>
                  <th>{t('redTeamView.colService') || 'Service'}</th>
                  <th>{t('redTeamView.colLatency') || 'Latency'}</th>
                  <th>{t('redTeamView.colBanner') || 'Service Banner Info'}</th>
                </tr>
              </thead>
              <tbody>
                {scanResult.openPorts.map((p: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: '#f87171' }}>{p.port}</td>
                    <td>{p.protocol.toUpperCase()}</td>
                    <td><span className="badge badge-success">{p.state === 'open' ? (t('redTeamView.stateOpen') || 'Open') : p.state === 'closed' ? (t('redTeamView.stateClosed') || 'Closed') : (t('redTeamView.stateFiltered') || 'Filtered')}</span></td>
                    <td style={{ fontWeight: 600, color: '#38bdf8' }}>{message(p.service)}</td>
                    <td>{p.latencyMs} ms</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#facc15' }}>{p.banner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
