import { BackupPanel } from '../components/settings/BackupPanel';
import { message } from "../i18n";
import { t as translateText } from "../i18n";
import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Settings as SettingsIcon, Shield, Server, Database } from 'lucide-react';
import { InternetIntelligencePanel } from '../components/settings/InternetIntelligencePanel';

import { useTranslation } from '../i18n';

export const SettingsView: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = async () => {
    try {
      const result = await window.lsip.invoke('app:get-config');
      if (result) {
        setConfig(result);
      }
    } catch (err) {
      console.error('Failed to load config', err);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await window.lsip.invoke('app:save-config', config);
      alert(message('Settings saved successfully.'));
    } catch (err) {
      alert(message('Failed to save settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (section: string, key: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  if (!config) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <RefreshCw className="spin" size={24} style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return (
    <div className="view-container" style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary-hover)' }}>
            <SettingsIcon size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('settings.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('settings.subtitle')}</p>
          </div>
        </div>
        <button
          className="fluent-button primary"
          onClick={handleSave}
          disabled={isSaving}
          style={{ gap: '8px' }}
        >
          {isSaving ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
          {t('settings.saveConfig')}
        </button>
      </div>

      <BackupPanel />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        {/* Database Settings */}
        <div className="fluent-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
            <Database size={18} style={{ color: 'var(--accent-primary-hover)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{translateText("interfaceText.message138")}</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{translateText("interfaceText.message139")}</label>
              <input
                type="number"
                className="fluent-input"
                style={{ width: '100%' }}
                value={config.database.retentionDays}
                onChange={(e) => handleChange('database', 'retentionDays', parseInt(e.target.value))}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{translateText("interfaceText.message140")}</label>
              <input
                type="number"
                className="fluent-input"
                style={{ width: '100%' }}
                value={config.database.maxEventRows}
                onChange={(e) => handleChange('database', 'maxEventRows', parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Scanning Engine Settings */}
        <div className="fluent-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
            <Server size={18} style={{ color: 'var(--accent-info)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{translateText("interfaceText.message141")}</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{translateText("interfaceText.message142")}</label>
              <input
                type="text"
                className="fluent-input"
                placeholder={translateText("interfaceText.message143")}
                style={{ width: '100%' }}
                value={config.scanning.subnetScope}
                onChange={(e) => handleChange('scanning', 'subnetScope', e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{translateText("interfaceText.message144")}</label>
              <select
                className="fluent-input"
                style={{ width: '100%' }}
                value={config.scanning.scanSpeed}
                onChange={(e) => handleChange('scanning', 'scanSpeed', e.target.value)}
              >
                <option value="slow">{translateText("interfaceText.message145")}</option>
                <option value="medium">{translateText("interfaceText.message146")}</option>
                <option value="fast">{translateText("interfaceText.message147")}</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{translateText("interfaceText.message148")}</label>
              <input
                type="text"
                className="fluent-input"
                style={{ width: '100%' }}
                value={config.scanning.ports.join(', ')}
                onChange={(e) => {
                  const ports = e.target.value.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
                  handleChange('scanning', 'ports', ports);
                }}
              />
            </div>
          </div>
        </div>

        {/* UI & General Settings */}
        <div className="fluent-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '10px' }}>
            <Shield size={18} style={{ color: 'var(--accent-success)' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{translateText("interfaceText.message149")}</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{translateText("interfaceText.message150")}</label>
              <input
                type="number"
                className="fluent-input"
                style={{ width: '100%' }}
                value={config.ui.refreshIntervalMs}
                onChange={(e) => handleChange('ui', 'refreshIntervalMs', parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Internet Intelligence Module panel */}
        <InternetIntelligencePanel />
      </div>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SettingsView;
