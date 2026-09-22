import { message } from '../../i18n';
import { RuleLibrary } from '../../components/common/RuleLibrary';
import { t as translateText } from "../../i18n";
import React, { useState } from 'react';
import { Search, Filter, Terminal, Shield, Play, Table, Layers } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const ThreatHuntingView: React.FC = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState<string>('EventID=4688 AND CommandLine MATCHES ".*powershell.*"');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [error, setError] = useState('');
  const handleSearch = async () => {
    setIsSearching(true);setError('');setResults([]);
    try {
      const response = await window.lsip.invoke('ioc:evaluate-rule', {kind:'Hunt',content:query});
      if (!response?.success) throw new Error(response?.error?.message || response?.error || 'Rule evaluation failed');
      setResults(response.data.matchedEvents);
    } catch (e:any) { setError(e.message); }
    finally { setIsSearching(false); }
  };

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      <RuleLibrary kind="Hunt" content={query} onLoad={value => {setQuery(value); setResults([]); setError('')}} />
      {error && <div role="alert" style={{color:"var(--accent-danger)"}}>{message(error)}</div>}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Search size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.threatHunting.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
            {t('v3.threatHunting.subtitle')}
          </p>
        </div>
      </div>

      {/* Query Bar */}
      <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          className="fluent-input"
          style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.85rem', height: '42px' }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={translateText("interfaceText.message181")}
        />
        <button className="fluent-button" style={{ background: 'var(--accent-primary)', color: 'white', height: '42px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleSearch} disabled={isSearching}>
          <Play size={16} /> {translateText("interfaceText.message182")} </button>
      </div>

      {/* Query Results Table */}
      <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Table size={16} style={{ color: 'var(--accent-primary)' }} /> {translateText("interfaceText.message183")}{results.length})
        </div>

        {results.length > 0 ? (
          <table style={{ width: '100%', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>{translateText("interfaceText.message110")}</th>
                <th>{translateText("interfaceText.message184")}</th>
                <th>{translateText("interfaceText.message185")}</th>
                <th>{translateText("interfaceText.message186")}</th>
                <th>{translateText("interfaceText.message187")}</th>
                <th>{translateText("interfaceText.message188")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{row.timestamp}</td>
                  <td><span className="badge badge-blue">{row.eventId}</span></td>
                  <td>{row.host}</td>
                  <td>{row.user}</td>
                  <td style={{ fontWeight: 600 }}>{row.process}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-primary)' }}>{row.cmd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '30px' }}> {translateText("interfaceText.message189")} </div>
        )}
      </div>
    </div>
  );
};
