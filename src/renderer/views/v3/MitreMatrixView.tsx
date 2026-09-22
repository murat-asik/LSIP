import { useCaseManagementStore } from '../../stores/case-management.store';
import React from 'react';
import { Layers, ShieldAlert, Cpu, Eye } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface MitreTactic {
  tactic: string;
  techniques: Array<{ id: string; name: string; hitCount: number; severity: 'high' | 'medium' | 'low' }>;
}

export const MitreMatrixView: React.FC = () => {
  const { t } = useTranslation();
  const { cases } = useCaseManagementStore();
  const tactics = new Map<string, MitreTactic>();
  for(const item of cases) for(const mapping of item.mitreMappings) {
    if(!tactics.has(mapping.tactic))tactics.set(mapping.tactic,{tactic:mapping.tactic,techniques:[]});
    const techniques=tactics.get(mapping.tactic)!.techniques;
    const existing=techniques.find(t=>t.id===mapping.techniqueId);
    if(existing)existing.hitCount++;else techniques.push({id:mapping.techniqueId,name:mapping.techniqueName,hitCount:1,severity:item.severity==='Critical'||item.severity==='High'?'high':item.severity==='Medium'?'medium':'low'});
  }
  const matrix=Array.from(tactics.values());

  const getHeatmapBg = (hits: number) => {
    if (hits >= 4) return '#fee2e2';
    if (hits >= 1) return '#ffedd5';
    return 'var(--bg-primary)';
  };

  const getHeatmapColor = (hits: number) => {
    if (hits >= 4) return '#991b1b';
    if (hits >= 1) return '#c2410c';
    return 'var(--text-secondary)';
  };

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      <p>{t("operational.caseMappings")}</p>{!matrix.length && <p>{t("common.noData")}</p>}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #0d9488, #0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Layers size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.mitreMatrix.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
            {t('v3.mitreMatrix.subtitle')}
          </p>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {matrix.map((tactic, idx) => (
          <div key={idx} className="fluent-card" style={{ padding: '14px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, borderBottom: '2px solid var(--accent-primary)', paddingBottom: '6px', color: 'var(--accent-primary)' }}>
              {tactic.tactic}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tactic.techniques.map((tech) => (
                <div
                  key={tech.id}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    background: getHeatmapBg(tech.hitCount),
                    border: '1px solid var(--border-primary)',
                    color: getHeatmapColor(tech.hitCount),
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{tech.id}</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '2px' }}>{tech.name}</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 700 }}>
                    {tech.hitCount > 0 ? `${tech.hitCount} Detection Hits` : 'No Activity Observed'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
