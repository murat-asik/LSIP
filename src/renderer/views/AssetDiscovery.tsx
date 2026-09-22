import { message } from "../i18n";
import { t as translateText } from "../i18n";
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app.store';
import { useTranslation } from '../i18n';
import { Asset, NetworkInterfaceInfo } from '../../shared/types/asset.types';
import {
  Search,
  Network,
  Cpu,
  Server,
  Printer,
  HardDrive,
  Laptop,
  Play,
  Terminal,
} from 'lucide-react';

export const AssetDiscovery: React.FC = () => {
  const { t } = useTranslation();
  const { setIsScanning } = useAppStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPerformingScan, setIsPerformingScan] = useState(false);

  // Load interfaces and assets on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const ifaces = await window.lsip.invoke('assets:interfaces');
        const ifacesData = ifaces?.data || [];
        setInterfaces(ifacesData);
        if (ifacesData.length > 0) {
          setSelectedInterface(ifacesData[0].subnet);
        }

        const list = await window.lsip.invoke('assets:get-all');
        setAssets(list?.data || []);
      } catch (e) {
        console.error('Failed to load initial assets data', e);
      }
    };
    loadInitialData();
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    setIsPerformingScan(true);
    try {
      const list = await window.lsip.invoke('assets:scan', {
        subnetScope: selectedInterface,
      });
      setAssets(list?.data || []);
    } catch (e) {
      alert(message(`Scanning failed: ${e}`));
    } finally {
      setIsScanning(false);
      setIsPerformingScan(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const list = await window.lsip.invoke('assets:query', {
        query: searchQuery,
      });
      setAssets(list?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  const getDeviceIcon = (type: Asset['deviceType']) => {
    switch (type) {
      case 'server':
        return <Server size={14} style={{ color: 'var(--accent-primary-hover)' }} />;
      case 'printer':
        return <Printer size={14} style={{ color: 'var(--accent-warning)' }} />;
      case 'nas':
        return <HardDrive size={14} style={{ color: 'var(--accent-success)' }} />;
      case 'router':
        return <Network size={14} style={{ color: 'var(--accent-info)' }} />;
      case 'vm':
        return <Cpu size={14} style={{ color: 'var(--accent-primary-hover)' }} />;
      default:
        return <Laptop size={14} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        height: 'calc(100vh - var(--topbar-height) - var(--statusbar-height) - 40px)',
        padding: '20px',
        overflow: 'hidden',
      }}
    >
      {/* Network Interface Enumerate Section */}
      <div className="fluent-card" style={{ flexShrink: 0, padding: '16px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Network size={16} /> {t('assetDiscoveryView.nicDetails')}
        </h2>
        {interfaces.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.8rem' }}>
            {interfaces.filter(i => i.subnet === selectedInterface).map(iface => (
              <React.Fragment key={iface.subnet}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.adapter')}</span>
                  <span style={{ fontWeight: 500 }}>{iface.name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.status')}</span>
                  <span style={{ color: 'var(--accent-success)', fontWeight: 500 }}>{iface.status || 'Up'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.macAddress')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{iface.macAddress}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.ipv4')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{iface.ipAddress}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.ipv6')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{iface.ipv6Address || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.gateway')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{iface.gateway || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.dhcpServer')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{iface.dhcpServer || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.dnsServers')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{iface.dnsServers?.join(', ') || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.dnsDomain')}</span>
                  <span style={{ fontWeight: 500 }}>{iface.domain || 'N/A'}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.noInterfaces')}</div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedAssetId ? '1.5fr 1fr' : '1fr',
          gap: '16px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left Panel: Devices Table */}
        <div className="fluent-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Network size={18} /> {t('assetDiscoveryView.title')} ({assets.length})
              </h2>
              <form onSubmit={handleSearch} style={{ position: 'relative', width: '280px' }}>
                <input
                  type="text"
                  placeholder={t('assetDiscoveryView.searchPlaceholder')}
                  className="fluent-input"
                  style={{ width: '100%', paddingLeft: '32px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-secondary)' }} />
              </form>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                className="fluent-input"
                style={{ padding: '6px 12px' }}
                value={selectedInterface}
                onChange={(e) => setSelectedInterface(e.target.value)}
              >
                {interfaces.map((iface) => (
                  <option key={iface.subnet} value={iface.subnet}>
                    {iface.name} ({iface.subnet})
                  </option>
                ))}
                {interfaces.length === 0 && <option value="">{t('assetDiscoveryView.autoDetectSubnet')}</option>}
              </select>

              <button
                className="fluent-button primary"
                onClick={handleScan}
                disabled={isPerformingScan}
                style={{ whiteSpace: 'nowrap' }}
              >
                <Play size={14} /> {isPerformingScan ? t('assetDiscoveryView.scanning') : t('assetDiscoveryView.discoveryScan')}
              </button>
            </div>
          </div>

          {/* Assets Grid Table */}
          <div className="fluent-table-container">
            <table className="fluent-table">
              <thead>
                <tr>
                  <th>{t('assetDiscoveryView.ipAddress')}</th>
                  <th>{t('assetDiscoveryView.hostname')}</th>
                  <th>{t('assetDiscoveryView.macAddress')}</th>
                  <th>{t('assetDiscoveryView.vendor')}</th>
                  <th>{t('assetDiscoveryView.osGuess')}</th>
                  <th>{t('assetDiscoveryView.riskIndex')}</th>
                  <th>{t('assetDiscoveryView.type')}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const isSelected = selectedAssetId === a.id;
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedAssetId(a.id)}
                      style={{
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.12)' : undefined,
                        borderLeft: isSelected ? '3px solid var(--accent-primary)' : undefined,
                      }}
                    >
                      <td style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{a.ipAddress}</td>
                      <td style={{ color: a.hostname ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                        {a.hostname || t('assetDiscoveryView.unresolved')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{a.macAddress || 'N/A'}</td>
                      <td>{a.vendor}</td>
                      <td style={{ fontSize: '0.8rem' }}>{a.osGuess}</td>
                      <td>
                        <span className={`status-pill ${a.riskScore > 30 ? 'warning' : a.riskScore > 50 ? 'danger' : 'success'}`}>
                          {a.riskScore} / 100
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {getDeviceIcon(a.deviceType)} {a.deviceType.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {assets.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="fluent-empty-state">
                        <Network size={48} />
                        <h3>{t('assetDiscoveryView.noDevicesDiscovered')}</h3>
                        <p>{t('assetDiscoveryView.noDevicesDesc')}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel: Selected Asset Inspector */}
        {selectedAssetId && selectedAsset && (
          <div className="fluent-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
            {/* Header */}
            <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{t('assetDiscoveryView.deviceDetails')}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>IP: {selectedAsset.ipAddress}</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              {/* Meta details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('assetDiscoveryView.macAddress')}</span>
                  <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{selectedAsset.macAddress || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('assetDiscoveryView.manufacturer')}</span>
                  <span style={{ fontWeight: 500 }}>{selectedAsset.vendor || t('common.unknown')}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('assetDiscoveryView.guessedOs')}</span>
                  <span style={{ fontWeight: 500 }}>{selectedAsset.osGuess || t('common.unknown')}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('assetDiscoveryView.pingLatency')}</span>
                  <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                    {selectedAsset.pingLatencyMs !== undefined ? `${selectedAsset.pingLatencyMs} ms` : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Ports and Service list */}
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>{t('assetDiscoveryView.openPortsBanners')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedAsset.ports.map((port) => (
                    <div
                      key={port.port}
                      style={{
                        border: '1px solid var(--border-primary)',
                        borderRadius: '4px',
                        padding: '10px',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 500 }}>
                        <span style={{ color: 'var(--accent-primary-hover)' }}>{translateText("interfaceText.message038")} {port.port}</span>
                        <span style={{ color: 'var(--accent-success)', fontSize: '0.8rem' }}>
                          {port.service?.toUpperCase()}
                        </span>
                      </div>

                      {port.banner && (
                        <div
                          style={{
                            backgroundColor: '#05070c',
                            borderLeft: '2px solid var(--accent-info)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            padding: '6px',
                            color: '#34d399',
                            borderRadius: '2px',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '6px', color: 'var(--text-tertiary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '3px', marginBottom: '4px' }}>
                            <Terminal size={12} /> {t('assetDiscoveryView.bannerData')}
                          </div>
                          {port.banner}
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedAsset.ports.length === 0 && (
                    <div className="fluent-empty-state" style={{ minHeight: '120px' }}>
                      <Server size={24} />
                      <p>{t('assetDiscoveryView.noOpenPorts')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedAssetId(null)}
              className="fluent-button"
              style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
            >
              {t('assetDiscoveryView.closeInspector')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
