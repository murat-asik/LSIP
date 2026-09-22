import React from 'react';
import { useAppStore } from '../../stores/app.store';
import { useTranslation } from '../../i18n';
import { ShieldCheck, HardDrive, Wifi, WifiOff } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { isScanning, connectivityStatus, isOnlineMode } = useAppStore();
  const { t } = useTranslation();

  return (
    <div
      style={{
        height: 'var(--statusbar-height)',
        flexShrink: 0,
        backgroundColor: 'var(--bg-tertiary)',
        borderTop: '1px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* System operational */}
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-success)' }}>
          <ShieldCheck size={12} />
          {t('statusBar.operational') || `${t('dashboard.secure')} - Operational`}
        </span>
        {isScanning && (
          <span style={{ color: 'var(--accent-primary-hover)' }}>
            ● {t('statusBar.scanRunning') || 'Network discovery scan running...'}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isOnlineMode ? 'var(--accent-info)' : 'var(--text-tertiary)' }}>
          {isOnlineMode ? <Wifi size={11} /> : <WifiOff size={11} />}
          {isOnlineMode ? `${t('statusBar.cloudConnected') || 'Cloud Connected'} (${connectivityStatus})` : t('common.offline')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <HardDrive size={11} /> {t('statusBar.dbSync') || 'DB: Synchronized'}
        </span>
      </div>
    </div>
  );
};
export default StatusBar;
