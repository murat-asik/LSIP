import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { t as translateText } from "../i18n";
import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../stores/app.store';
import { useTranslation } from '../i18n';
import { ActiveConnection } from '../../shared/types/network.types';
import {
  Search,
  RefreshCw,
  Activity,
  Globe,
  Shuffle,
} from 'lucide-react';

export const ConnectionMap: React.FC = () => {
  const { t } = useTranslation();
  const { searchQuery } = useAppStore();
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(3000);
  const [localSearch, setLocalSearch] = useState('');
  
  // Custom filters
  const [hideListening, setHideListening] = useState(true);
  const [hideLocalhost, setHideLocalhost] = useState(false);

  const fetchConnections = async () => {
    setIsLoading(true);
    try {
      const list = await window.lsip.invoke('connection:active');
      setConnections(list?.data || []);
    } catch (e) {
      console.error('Failed to fetch active connections', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    if (refreshInterval > 0) {
      const timer = createViewPolling('connections', fetchConnections, refreshInterval);
      return () => stopViewPolling(timer);
    }
    return undefined;
  }, [refreshInterval]);

  const filteredConnections = useMemo(() => {
    const query = (localSearch || searchQuery || '').toLowerCase();
    
    return connections.filter((c) => {
      // 1. Hide listening ports
      if (hideListening && c.state === 'LISTENING') {
        return false;
      }

      // 2. Hide local loopbacks
      if (hideLocalhost) {
        const isLocal =
          c.remoteAddress === '127.0.0.1' ||
          c.remoteAddress === '0.0.0.0' ||
          c.remoteAddress === '::1' ||
          c.remoteAddress === '*' ||
          c.remoteAddress === '::' ||
          c.remoteAddress === '0.0.0.0' ||
          c.remoteAddress === '0.0.0.0:0';
        if (isLocal) return false;
      }

      // 3. Text query match
      return (
        c.processName?.toLowerCase().includes(query) ||
        c.pid.toString().includes(query) ||
        c.remoteAddress.toLowerCase().includes(query) ||
        c.remotePort.toString().includes(query) ||
        c.localAddress.toLowerCase().includes(query)
      );
    });
  }, [connections, localSearch, searchQuery, hideListening, hideLocalhost]);

  // Aggregate stats
  const stats = useMemo(() => {
    const established = connections.filter((c) => c.state === 'ESTABLISHED').length;
    const listening = connections.filter((c) => c.state === 'LISTENING').length;
    const external = connections.filter((c) => {
      const isLoopback =
        c.remoteAddress === '127.0.0.1' ||
        c.remoteAddress === '::1' ||
        c.remoteAddress === '0.0.0.0' ||
        c.remoteAddress === '*' ||
        c.remoteAddress === '::';
      return !isLoopback && c.state === 'ESTABLISHED';
    }).length;

    return { established, listening, external };
  }, [connections]);

  return (
    <div className="view-container">
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="fluent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <span>{t('connectionMapView.establishedLinks')}</span>
            <Activity size={16} style={{ color: 'var(--accent-primary-hover)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{stats.established}</div>
        </div>

        <div className="fluent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <span>{t('connectionMapView.externalConnections')}</span>
            <Globe size={16} style={{ color: 'var(--accent-success)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-success)' }}>{stats.external}</div>
        </div>

        <div className="fluent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <span>{t('connectionMapView.listeningServices')}</span>
            <Shuffle size={16} style={{ color: 'var(--accent-warning)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{stats.listening}</div>
        </div>
      </div>

      {/* Main Connection Table */}
      <div className="fluent-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} /> {t('connectionMap.title')} ({filteredConnections.length})
            </h2>
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                placeholder={t('connectionMapView.filterPlaceholder')}
                className="fluent-input"
                style={{ width: '100%', paddingLeft: '32px' }}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-secondary)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Hiding states */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hideListening}
                onChange={(e) => setHideListening(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              {t('connectionMapView.hideListening')}
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hideLocalhost}
                onChange={(e) => setHideLocalhost(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              {t('connectionMapView.hideLoopbacks')}
            </label>

            <select
              className="fluent-input"
              style={{ padding: '6px 12px' }}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={1000}>{t('connectionMapView.refreshInterval1s')}</option>
              <option value={3000}>{t('connectionMapView.refreshInterval3s')}</option>
              <option value={5000}>{t('connectionMapView.refreshInterval5s')}</option>
              <option value={0}>{t('connectionMapView.pauseRefresh')}</option>
            </select>

            <button className="fluent-button" onClick={fetchConnections} disabled={isLoading}>
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Connections Grid */}
        <div className="fluent-table-container">
          <table className="fluent-table">
            <thead>
              <tr>
                <th>{t('connectionMapView.protocol')}</th>
                <th>{t('connectionMapView.processName')}</th>
                <th>{t('connectionMapView.pid')}</th>
                <th>{t('connectionMapView.localSocket')}</th>
                <th>{t('connectionMapView.remoteSocket')}</th>
                <th>{t('connectionMapView.state')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredConnections.map((c, idx) => {
                const isListening = c.state === 'LISTENING';
                const isEstablished = c.state === 'ESTABLISHED';

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: c.protocol === 'TCP' ? 'var(--accent-primary-hover)' : 'var(--accent-success)' }}>
                      {c.protocol}
                    </td>
                    <td style={{ fontWeight: 500 }}>{c.processName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{c.pid}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{c.localAddress}:{c.localPort}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {c.remoteAddress === '0.0.0.0' || c.remoteAddress === '*' ? (
                        <span style={{ color: 'var(--text-tertiary)' }}>{translateText("interfaceText.message043")}</span>
                      ) : (
                        `${c.remoteAddress}:${c.remotePort}`
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${isEstablished ? 'success' : isListening ? 'info' : 'warning'}`}>
                        {c.state || 'N/A'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredConnections.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="fluent-empty-state">
                      <Activity size={48} />
                      <h3>{t('connectionMapView.noConnectionsFound')}</h3>
                      <p>{t('connectionMapView.noConnectionsDesc')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default ConnectionMap;
