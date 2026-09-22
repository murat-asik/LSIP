import { useTranslation } from '../../i18n';
import { message } from "../../i18n";
import { t as translateText } from "../../i18n";
import React, { useEffect, useState } from 'react';
import { Globe, RefreshCw, Key, Power, Play, Database, WifiOff, Clock, Trash2, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  configured?: boolean;
  timeoutMs: number;
  rateLimit: { requestsPerMinute?: number; requestsPerDay?: number };
  priority?: number;
}

interface GlobalConfig {
  enabled: boolean;
  offlineMode: boolean;
  cacheTtlSeconds: number;
}

interface HealthDetail {
  id: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  reachable: boolean;
  apiValid: boolean;
  status: string;
  latencyMs: number;
  cacheHits: number;
  cacheMisses: number;
  requests: number;
  failures: number;
}

export const InternetIntelligencePanel: React.FC = () => {
  useTranslation();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, HealthDetail>>({});
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    enabled: true,
    offlineMode: false,
    cacheTtlSeconds: 86400,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; status?: string }>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [validationStatus, setValidationStatus] = useState<Record<string, { validating: boolean; text: string; ok: boolean }>>({});

  const unwrap = (res: any) => {
    if (res && typeof res === 'object' && 'success' in res) {
      return res.success ? res.data : null;
    }
    return res;
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [providerConfigsRes, globalDataRes, healthRes] = await Promise.all([
        window.lsip.invoke('internet:get-configs'),
        window.lsip.invoke('internet:get-global-config'),
        window.lsip.invoke('internet:get-health'),
      ]);

      const providerConfigs = unwrap(providerConfigsRes);
      const globalData = unwrap(globalDataRes);
      const healthData = unwrap(healthRes);

      if (Array.isArray(providerConfigs)) {
        setProviders(providerConfigs);
      }
      if (globalData) setGlobalConfig(globalData);
      if (Array.isArray(healthData)) {
        const map: Record<string, HealthDetail> = {};
        healthData.forEach((h: HealthDetail) => { map[h.id] = h; });
        setHealthMap(map);
      }
    } catch (err) {
      console.error('Failed to load Internet Intelligence configuration', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGlobalToggle = async (key: keyof GlobalConfig, value: any) => {
    const updated = { ...globalConfig, [key]: value };
    setGlobalConfig(updated);
    try {
      const res = await window.lsip.invoke('internet:save-global-config', { [key]: value });
      if (res && 'success' in res && !res.success) {
        alert(message('Failed to update global Internet Intelligence configuration'));
      }
    } catch (err) {
      alert(message('Failed to update global Internet Intelligence configuration'));
    }
  };

  const handleProviderToggle = async (provider: ProviderConfig) => {
    const updated = { ...provider, enabled: !provider.enabled };
    try {
      await window.lsip.invoke('internet:save-config', updated);
      await loadData();
    } catch (err) {
      alert(message('Failed to save provider state'));
    }
  };

  const handleSaveApiKey = async (provider: ProviderConfig) => {
    const key = apiKeys[provider.id];
    if (key === undefined || !key.trim()) return;

    setValidationStatus(prev => ({ ...prev, [provider.id]: { validating: true, text: 'Validating API Key...', ok: false } }));

    try {
      const saved = await window.lsip.invoke('internet:save-config', { ...provider, enabled: true, apiKey: key });
      if (saved?.success === false) throw new Error(saved.error?.message || 'Anahtar kaydedilemedi');
      setApiKeys(prev => ({ ...prev, [provider.id]: '' }));

      // Run immediate key validation
      const testRes = await window.lsip.invoke('internet:test-connections');
      const testMap = unwrap(testRes) || {};
      const providerTest = testMap[provider.id];

      if (providerTest?.ok) {
        await window.lsip.invoke('internet:save-config', { ...provider, enabled: true, apiKey: key });
        setValidationStatus(prev => ({ ...prev, [provider.id]: { validating: false, text: '✓ Valid & Enabled', ok: true } }));
      } else if (providerTest?.status === 'Waiting For Connection') {
        setValidationStatus(prev => ({ ...prev, [provider.id]: { validating: false, text: 'Anahtar kaydedildi; doğrulama için bağlanın.', ok: true } }));
      } else {
        const msg = providerTest?.message || '';
        let errText = '✗ Invalid';
        if (msg.includes('401') || msg.includes('Unauthorized')) errText = '✗ Unauthorized (401)';
        else if (msg.includes('429') || msg.includes('Quota')) errText = '✗ Quota Exceeded (429)';
        else if (msg.includes('Timeout')) errText = '✗ Timeout';
        
        setValidationStatus(prev => ({ ...prev, [provider.id]: { validating: false, text: errText, ok: false } }));
      }

      await loadData();
    } catch (err: any) {
      setValidationStatus(prev => ({ ...prev, [provider.id]: { validating: false, text: `✗ Save Failed: ${err.message}`, ok: false } }));
    }
  };

  const runTest = async () => {
    setIsTesting(true);
    try {
      const resultsRes = await window.lsip.invoke('internet:test-connections');
      const results = unwrap(resultsRes);
      setTestResults(results || {});
      await loadData();
    } catch (err) {
      console.error(err);
      alert(message('Connection test failed'));
    } finally {
      setIsTesting(false);
    }
  };

  const clearCache = async () => {
    try {
      await window.lsip.invoke('internet:clear-cache');
      alert(message('Intelligence cache cleared successfully.'));
    } catch (err) {
      alert(message('Failed to clear intelligence cache.'));
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'Healthy': return 'success';
      case 'Waiting For Connection': return 'warning';
      case 'Disabled': return '';
      default: return 'danger';
    }
  };

  if (isLoading) {
    return (
      <div className="fluent-card" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <RefreshCw className="spin" size={18} style={{ color: 'var(--accent-primary)' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{translateText("interfaceText.message017")}</span>
      </div>
    );
  }

  return (
    <div className="fluent-card" style={{ gridColumn: '1 / -1' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{translateText("interfaceText.message018")}</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', margin: 0 }}>{translateText("interfaceText.message019")}</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="fluent-button" 
            onClick={clearCache} 
            style={{ fontSize: '0.8rem', padding: '6px 12px', gap: '6px' }}
          >
            <Trash2 size={14} /> {translateText("interfaceText.message020")} </button>
          <button 
            className="fluent-button primary" 
            onClick={runTest} 
            disabled={isTesting || !globalConfig.enabled} 
            style={{ fontSize: '0.8rem', padding: '6px 14px', gap: '6px' }}
          >
            {isTesting ? <RefreshCw className="spin" size={14} /> : <Play size={14} />} {translateText("interfaceText.message021")} </button>
        </div>
      </div>

      {/* Global Configuration Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px', background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
        
        {/* Enable Internet Intelligence */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Power size={14} style={{ color: globalConfig.enabled ? 'var(--accent-success)' : 'var(--text-tertiary)' }} /> {translateText("interfaceText.message022")} </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{translateText("interfaceText.message023")}</div>
          </div>
          <button
            onClick={() => handleGlobalToggle('enabled', !globalConfig.enabled)}
            style={{
              padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
              border: `1px solid ${globalConfig.enabled ? 'var(--accent-success)' : 'var(--border-primary)'}`,
              background: globalConfig.enabled ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: globalConfig.enabled ? 'var(--accent-success)' : 'var(--text-secondary)',
              fontSize: '0.75rem', fontWeight: 600
            }}
          >
            {globalConfig.enabled ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        {/* Offline Mode */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <WifiOff size={14} style={{ color: globalConfig.offlineMode ? 'var(--accent-warning)' : 'var(--text-tertiary)' }} /> {translateText("interfaceText.message024")} </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{translateText("interfaceText.message025")}</div>
          </div>
          <button
            onClick={() => handleGlobalToggle('offlineMode', !globalConfig.offlineMode)}
            style={{
              padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
              border: `1px solid ${globalConfig.offlineMode ? 'var(--accent-warning)' : 'var(--border-primary)'}`,
              background: globalConfig.offlineMode ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: globalConfig.offlineMode ? 'var(--accent-warning)' : 'var(--text-secondary)',
              fontSize: '0.75rem', fontWeight: 600
            }}
          >
            {globalConfig.offlineMode ? 'OFFLINE' : 'ONLINE'}
          </button>
        </div>

        {/* Cache TTL */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} style={{ color: 'var(--accent-info)' }} /> {translateText("interfaceText.message026")} </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{translateText("interfaceText.message027")}</div>
          </div>
          <select
            className="fluent-input"
            style={{ fontSize: '0.8rem', padding: '2px 6px', width: '100px' }}
            value={globalConfig.cacheTtlSeconds}
            onChange={(e) => handleGlobalToggle('cacheTtlSeconds', parseInt(e.target.value))}
          >
            <option value={3600}>{translateText("interfaceText.message028")}</option>
            <option value={21600}>{translateText("interfaceText.message029")}</option>
            <option value={86400}>{translateText("interfaceText.message030")}</option>
            <option value={604800}>{translateText("interfaceText.message031")}</option>
          </select>
        </div>

      </div>

      {/* Provider List */}
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Database size={16} /> {translateText("interfaceText.message032")} </h3>

      {providers.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>{translateText("interfaceText.message033")}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {providers.map((p) => {
            const testResult = testResults[p.id];
            const health = healthMap[p.id];
            const currentKeyInput = apiKeys[p.id] !== undefined ? apiKeys[p.id] : '';
            const vStatus = validationStatus[p.id];

            const currentStatus = health?.status || (p.configured ? 'Configured' : 'Invalid API Key');

            return (
              <div 
                key={p.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '10px', 
                  padding: '14px', 
                  background: 'var(--bg-primary)', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-primary)',
                  opacity: globalConfig.enabled ? 1 : 0.65
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  
                  {/* Provider Info & Status Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: p.enabled ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                          {p.name}
                        </span>
                        
                        {/* PART 10: Rich Provider Configuration Status */}
                        <span className={`status-pill ${getStatusBadgeClass(currentStatus)}`} style={{ fontSize: '0.68rem' }}>
                          {currentStatus}
                        </span>

                        <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}> {translateText("interfaceText.message034")} {p.priority ?? 10}
                        </span>
                      </div>
                      
                      {/* Warning Pill if API key exists but provider is disabled */}
                      {p.configured && !p.enabled && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '4px', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--accent-warning)' }}>
                          <AlertTriangle size={12} />
                          <span>{translateText("interfaceText.message035")}</span>
                          <button
                            onClick={() => handleProviderToggle(p)}
                            style={{ background: 'var(--accent-warning)', color: '#000', border: 'none', borderRadius: '3px', padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                          > {translateText("interfaceText.message036")} </button>
                        </div>
                      )}

                      {/* PART 9: Instant Key Validation Feedback */}
                      {vStatus && (
                        <div style={{ marginTop: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: vStatus.ok ? '#10b981' : '#ef4444' }}>
                          {vStatus.validating ? <RefreshCw size={12} className="spin" /> : vStatus.ok ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                          <span>{message(vStatus.text)}</span>
                        </div>
                      )}

                      {!vStatus && testResult && (
                        <div style={{ marginTop: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: testResult.ok ? '#10b981' : '#ef4444' }}>
                          {testResult.ok ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                          <span>{message(testResult.message)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & API Key Input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '3px 8px', background: 'var(--bg-secondary)' }}>
                      <Key size={13} style={{ color: 'var(--text-tertiary)' }} />
                      <input 
                        type="password" 
                        placeholder={p.configured ? "••••••••••••••••" : "Enter API Key"}
                        value={currentKeyInput}
                        onChange={(e) => setApiKeys({ ...apiKeys, [p.id]: e.target.value })}
                        style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.8rem', width: '160px' }}
                      />
                      {currentKeyInput && (
                        <button 
                          onClick={() => handleSaveApiKey(p)}
                          style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer' }}
                        > {translateText("interfaceText.message037")} </button>
                      )}
                    </div>

                    <button 
                      onClick={() => handleProviderToggle(p)}
                      disabled={!globalConfig.enabled}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
                        border: `1px solid ${p.enabled ? 'var(--accent-success)' : 'var(--border-primary)'}`,
                        background: p.enabled ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                        color: p.enabled ? 'var(--accent-success)' : 'var(--text-secondary)',
                        fontSize: '0.78rem', fontWeight: 600
                      }}
                    >
                      <Power size={13} /> {p.enabled ? message('Enabled') : message('Disabled')}
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
