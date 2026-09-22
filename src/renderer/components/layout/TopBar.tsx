import { message } from "../../i18n";
import { t as translateText } from "../../i18n";
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/app.store';
import { useTranslation } from '../../i18n';
import { Search, Cpu, HardDrive, Bell, Wifi, WifiOff, Power, Sun, Moon, Languages } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { searchQuery, setSearchQuery, systemMetrics, connectivityStatus, isOnlineMode, setConnectivity, theme, setTheme, language, setLanguage } = useAppStore();
  const { t } = useTranslation();
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchConnectivity = async () => {
    try {
      const state = await window.lsip.invoke('connectivity:get-state');
      if (state) {
        setConnectivity(state.status, state.isOnlineMode);
      }
    } catch (err) {
      console.error('Failed to fetch connectivity state', err);
    }
  };

  useEffect(() => {
    fetchConnectivity();
  }, []);

  const handleToggleConnection = async () => {
    setIsConnecting(true);
    try {
      if (isOnlineMode) {
        const state = await window.lsip.invoke('connectivity:disconnect');
        if (state) setConnectivity(state.status, state.isOnlineMode);
      } else {
        const state = await window.lsip.invoke('connectivity:connect');
        if (state) setConnectivity(state.status, state.isOnlineMode);
      }
    } catch (err) {
      alert(message('Failed to toggle connection state'));
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusBadge = () => {
    switch (connectivityStatus) {
      case 'ONLINE':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', text: t('common.online'), icon: <Wifi size={12} /> };
      case 'LIMITED':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: t('common.limited'), icon: <Wifi size={12} /> };
      case 'NO INTERNET':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', text: t('common.noInternet'), icon: <WifiOff size={12} /> };
      case 'PROVIDER ERROR':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', text: 'PROVIDER ERROR', icon: <WifiOff size={12} /> };
      default:
        return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', text: t('common.offline'), icon: <WifiOff size={12} /> };
    }
  };

  const badge = getStatusBadge();

  return (
    <div
      style={{
        height: 'var(--topbar-height)',
        flexShrink: 0,
        backgroundColor: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 40,
      }}
    >
      {/* Global Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '340px' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            placeholder={t('common.searchPlaceholder')}
            className="fluent-input"
            style={{ width: '100%', paddingLeft: '34px', fontSize: '0.85rem' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '11px',
              color: 'var(--text-secondary)',
            }}
          />
        </div>
      </div>

      {/* Controls & Metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        
        {/* Connectivity Control Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              background: badge.bg,
              color: badge.color,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              letterSpacing: '0.5px'
            }}
          >
            {badge.icon} {message(badge.text)}
          </span>

          <button
            onClick={handleToggleConnection}
            disabled={isConnecting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              border: `1px solid ${isOnlineMode ? 'var(--accent-warning)' : 'var(--accent-success)'}`,
              background: isOnlineMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: isOnlineMode ? 'var(--accent-warning)' : 'var(--accent-success)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Power size={11} /> {isOnlineMode ? t('common.disconnect') : t('common.connect')}
          </button>
        </div>

        {/* System Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderLeft: '1px solid var(--border-primary)', paddingLeft: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
            <Cpu size={14} style={{ color: 'var(--accent-primary-hover)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{t('common.cpu')}:</span>
            <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{systemMetrics.cpu}%</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
            <HardDrive size={14} style={{ color: 'var(--accent-success)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>{t('common.ram')}:</span>
            <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{systemMetrics.ram}GB</span>
          </div>
        </div>

        {/* Theme & Language Switchers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-primary)', paddingLeft: '14px' }}>
          {/* Language Selector Button */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'tr' : 'en')}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title={translateText("interfaceText.message016")}
          >
            <Languages size={13} style={{ color: 'var(--accent-primary)' }} />
            <span>{language === 'en' ? '🇺🇸 EN' : '🇹🇷 TR'}</span>
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{
              padding: '5px',
              borderRadius: '4px',
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={theme === 'dark' ? t('common.themeLight') : t('common.themeDark')}
          >
            {theme === 'dark' ? <Sun size={15} style={{ color: '#facc15' }} /> : <Moon size={15} style={{ color: '#38bdf8' }} />}
          </button>
        </div>

      </div>
    </div>
  );
};
export default TopBar;
