import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import React, { useEffect, useState, useCallback } from 'react';
import { Usb, RefreshCw, HardDrive, AlertTriangle, Plug, Unplug, Search } from 'lucide-react';
import { useTranslation } from '../i18n';

interface UsbDevice { instanceId: string; deviceName: string; manufacturer: string; vid: string; pid: string; serialNumber: string; deviceClass: string; isConnected: boolean; firstSeen: number; lastSeen: number; connectionCount: number; riskLevel: string; }
interface UsbSummary { connectedDevices: number; totalTracked: number; storageDevices: number; newDevicesToday: number; devices: UsbDevice[]; }

export const UsbMonitor: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<UsbSummary | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<UsbDevice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await window.lsip.invoke('usb:summary');
      if (res?.success) setSummary(res.data);
    } catch (err) { console.error('USB fetch error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = createViewPolling('usb', fetchData, 15000); return () => stopViewPolling(i); }, [fetchData]);

  const filtered = (summary?.devices || []).filter(d =>
    !searchQuery || d.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Usb size={22} style={{ color: '#06b6d4' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('usbMonitorView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('usbMonitorView.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="fluent-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
            <Search size={14} style={{ color: 'var(--text-secondary)' }} />
            <input type="text" placeholder={t('usbMonitorView.searchDevices')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', width: '160px', fontFamily: 'var(--font-sans)' }} />
          </div>
          <button className="fluent-button primary" onClick={fetchData}><RefreshCw size={14} /> {t('usbMonitorView.scan')}</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="fluent-card" style={{ borderLeft: '3px solid #06b6d4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('usbMonitorView.connected')}</span><Plug size={16} style={{ color: '#06b6d4' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.connectedDevices}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-info)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('usbMonitorView.totalTracked')}</span><HardDrive size={16} style={{ color: 'var(--accent-info)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{summary.totalTracked}</div>
          </div>
          <div className="fluent-card" style={{ borderLeft: '3px solid var(--accent-warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('usbMonitorView.newToday')}</span><AlertTriangle size={16} style={{ color: 'var(--accent-warning)' }} /></div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: summary.newDevicesToday > 0 ? 'var(--accent-warning)' : 'var(--text-primary)' }}>{summary.newDevicesToday}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        <div className="fluent-table-container" style={{ flex: 1 }}>
          <table className="fluent-table">
            <thead><tr><th style={{ width: '40px' }}></th><th>{t('usbMonitorView.deviceName')}</th><th>{t('usbMonitorView.manufacturer')}</th><th>{t('usbMonitorView.vidPid')}</th><th>{t('usbMonitorView.serial')}</th><th>{t('usbMonitorView.class')}</th><th>{t('usbMonitorView.connections')}</th><th>{t('usbMonitorView.lastSeen')}</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><RefreshCw size={32} className="spin" style={{ color: 'var(--accent-primary)' }}/><p>{t('usbMonitorView.scanningDevices')}</p></div></td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8}><div className="fluent-empty-state" style={{ minHeight: '150px' }}><Usb size={32}/><p>{t('usbMonitorView.noUsbDevices')}</p></div></td></tr>
              : filtered.map((d, i) => (
                <tr key={i} onClick={() => setSelectedDevice(d)} style={{ cursor: 'pointer', backgroundColor: selectedDevice?.instanceId === d.instanceId ? 'rgba(37,99,235,0.08)' : undefined }}>
                  <td>{d.isConnected ? <Plug size={14} style={{ color: 'var(--accent-success)' }} /> : <Unplug size={14} style={{ color: 'var(--text-tertiary)' }} />}</td>
                  <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{d.deviceName}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{d.manufacturer}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-info)' }}>{d.vid && d.pid ? `${d.vid}:${d.pid}` : '—'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.serialNumber || '—'}</td>
                  <td><span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{d.deviceClass}</span></td>
                  <td style={{ textAlign: 'center' }}>{d.connectionCount}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(d.lastSeen).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedDevice && (
          <div className="fluent-card" style={{ width: '320px', flexShrink: 0, overflow: 'auto', animation: 'slideInRight 0.2s ease' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>{selectedDevice.deviceName}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[[t('usbMonitorView.manufacturer'), selectedDevice.manufacturer], ['VID:PID', `${selectedDevice.vid}:${selectedDevice.pid}`], [t('usbMonitorView.serial'), selectedDevice.serialNumber], [t('usbMonitorView.class'), selectedDevice.deviceClass], [t('usbMonitorView.statusLabel'), selectedDevice.isConnected ? t('usbMonitorView.statusConnected') : t('usbMonitorView.statusDisconnected')], [t('usbMonitorView.firstSeenLabel'), new Date(selectedDevice.firstSeen).toLocaleString()], [t('usbMonitorView.lastSeenLabel'), new Date(selectedDevice.lastSeen).toLocaleString()], [t('usbMonitorView.connectionCountLabel'), String(selectedDevice.connectionCount)]].map(([label, val], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-primary)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{val || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes slideInRight { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
};
