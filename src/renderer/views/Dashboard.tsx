import { t as translateText } from "../i18n";
import React, { useEffect } from 'react';
import { useAppStore } from '../stores/app.store';
import { useTranslation } from '../i18n';
import {
  ShieldAlert,
  Cpu,
  Network,
  CheckCircle,
  AlertTriangle,
  Play,
  Settings,
  Activity,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { systemMetrics, setSystemMetrics, setActiveTab } = useAppStore();
  const { t } = useTranslation();
  const [stats, setStats] = React.useState({ processes: 0, assets: 0, connections: 0, riskScore: null as number|null });
  const [isAdmin, setIsAdmin] = React.useState(false);

  // Fetch metrics updates
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const metricsRes = await window.lsip.invoke('dashboard:metrics');

        if (metricsRes?.success && metricsRes.data) {
          setSystemMetrics({
            cpu: metricsRes.data.cpu,
            ram: metricsRes.data.ram,
            totalRam: metricsRes.data.totalRam,
            disk: metricsRes.data.disk,
            totalDisk: metricsRes.data.totalDisk,
            uptime: metricsRes.data.uptime,
            hostname: metricsRes.data.hostname,
            osVersion: metricsRes.data.osVersion,
            connectedAdapters: metricsRes.data.connectedAdapters || 0,
          });
        }

        const statsRes = await window.lsip.invoke('dashboard:stats');
        if (statsRes?.success && statsRes.data) {
          setStats(statsRes.data);
        }
        const adminRes = await window.lsip.invoke('app:is-admin');
        if (adminRes !== undefined) {
          setIsAdmin(adminRes);
        }
      } catch (e) {
        console.error('Failed to fetch dashboard metrics:', e);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="view-container">
      {/* Welcome Banner */}
      <div
        className="fluent-card fluent-glass"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(12, 17, 30, 0.8) 100%)',
          borderColor: 'rgba(37, 99, 235, 0.3)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '6px' }}>
            {t('dashboard.title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span className="status-pill success">
            <CheckCircle size={12} /> {t('operational.applicationRunning')}
          </span>
          <span className="status-pill info"> {translateText("interfaceText.message044")} </span>
        </div>
      </div>

      {/* Grid Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Stat 1 */}
        <div className="fluent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
              {t('dashboard.monitoredProcesses')}
            </span>
            <Cpu size={18} style={{ color: 'var(--accent-primary-hover)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px' }}>
            {stats.processes}
          </div>
          <div style={{ color: 'var(--accent-success)', fontSize: '0.75rem', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-success)' }}></span>
            {t('common.active')}
          </div>
        </div>

        {/* Stat 2 */}
        <div className="fluent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
              {t('dashboard.discoveredAssets')}
            </span>
            <Network size={18} style={{ color: 'var(--accent-success)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px' }}>
            {stats.assets}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
            {t('dashboard.localEndpoints')}
          </div>
        </div>

        {/* Stat 3 */}
        <div className="fluent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
              {t('dashboard.activeConnections')}
            </span>
            <Activity size={18} style={{ color: 'var(--accent-info)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px' }}>
            {stats.connections}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
            {t('dashboard.networkFlows')}
          </div>
        </div>

        {/* Stat 4 */}
        <div className="fluent-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
              {t('dashboard.hostRiskScore')}
            </span>
            <ShieldAlert size={18} style={{ color: (stats.riskScore ?? 0) > 50 ? 'var(--accent-danger)' : 'var(--accent-success)' }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px', color: (stats.riskScore ?? 0) > 50 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
            {stats.riskScore === null ? t('common.unknown') : stats.riskScore + ' / 100'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
            {stats.riskScore === null ? t('common.noData') : (stats.riskScore > 50 ? t('dashboard.elevatedRisk') : t('dashboard.lowRisk'))}
          </div>
        </div>
      </div>

      {/* Host Telemetry Info Grid */}
      <div className="fluent-card fluent-glass" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px', color: '#38bdf8' }}>
          {t('dashboard.systemInfo')}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{t('dashboard.hostname')}: </span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{systemMetrics.hostname}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{t('dashboard.osVersion')}: </span>
            <strong>{systemMetrics.osVersion}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{t('dashboard.uptime')}: </span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{Math.floor(systemMetrics.uptime / 3600)}h {Math.floor((systemMetrics.uptime % 3600) / 60)}m</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
