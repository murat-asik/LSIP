import { useModuleData } from '../../hooks/useModuleData';
import { DataStatus } from '../../components/common/DataStatus';
import { message } from "../../i18n";
import { t as translateText } from "../../i18n";
import React, { useState } from 'react';
import { Clock, Filter, AlertTriangle, ShieldCheck, Activity, Terminal, Globe, HardDrive } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface TimelineEvent {
  id: string;
  timestamp: number;
  category: 'Process' | 'Network' | 'DNS' | 'Registry' | 'USB' | 'FIM';
  source: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  actor: string;
}

export const ForensicTimelineView: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const snapshot = useModuleData<any[]>('timeline:query', {limit:1000}, []);
  const categories: Record<string,string> = {process:'Process',network:'Network',dns:'DNS',event_log:'Event',asset:'Asset',reputation:'Reputation'};
  const events = snapshot.data.map(e => ({...e, category: categories[e.source] || e.source, actor: e.entityId || '', severity:e.severity.charAt(0).toUpperCase()+e.severity.slice(1)}));

  const filtered = events.filter((e) => {
    const matchCat = selectedCategory === 'all' || e.category === selectedCategory;
    const matchSearch = !searchQuery || e.description.toLowerCase().includes(searchQuery.toLowerCase()) || e.actor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'Critical': return <span className="badge badge-red">{t('common.critical')}</span>;
      case 'High': return <span className="badge" style={{ background: '#ffedd5', color: '#c2410c' }}>{t('common.high')}</span>;
      case 'Medium': return <span className="badge" style={{ background: '#fef9c3', color: '#854d0e' }}>{t('common.medium')}</span>;
      default: return <span className="badge badge-blue">{t('common.low')}</span>;
    }
  };

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      <DataStatus {...snapshot} empty={!events.length} />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Clock size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.forensicTimeline.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
              {t('v3.forensicTimeline.subtitle')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="fluent-input"
            placeholder={t('v3.forensicTimeline.filterTimeline') || "Filter timeline events..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: '0.82rem', width: '220px' }}
          />

          <select className="fluent-input" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ fontSize: '0.82rem' }}>
            <option value="all">{t('common.all')}</option>
            <option value="Process">{t('v3.forensicTimeline.eventSource')}{translateText("interfaceText.message158")}</option>
            <option value="Network">{t('v3.forensicTimeline.eventSource')}{translateText("interfaceText.message159")}</option>
            <option value="DNS">{t('v3.forensicTimeline.eventSource')}: DNS</option>
            <option value="Registry">{t('v3.forensicTimeline.eventSource')}{translateText("interfaceText.message160")}</option>
            <option value="USB">{t('v3.forensicTimeline.eventSource')}: USB</option>
          </select>
        </div>
      </div>

      {/* Chronological Event Stream */}
      <div className="fluent-card" style={{ padding: '20px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filtered.map((item) => (
          <div key={item.id} style={{ display: 'flex', gap: '16px', borderLeft: '3px solid var(--accent-primary)', paddingLeft: '16px', paddingBottom: '12px' }}>
            <div style={{ minWidth: '140px', fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              <div>{new Date(item.timestamp).toLocaleDateString()}</div>
              <strong>{new Date(item.timestamp).toLocaleTimeString()}</strong>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-blue">{message(item.category)}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{item.source}</span>
                {getSeverityBadge(item.severity)}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{message(item.description)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{translateText("interfaceText.message161")} {item.actor}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
