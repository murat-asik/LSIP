import { useCaseManagementStore } from '../../stores/case-management.store';
import { message } from "../../i18n";
import React from 'react';
import { ShieldCheck, Eye, Terminal, FileCode, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface PurpleCorrelationItem {
  id: string;
  technique: string;
  blueDetection: string;
  dfirArtifact: string;
  redRecon: string;
  status: 'Covered' | 'Gap' | 'Partial';
}

export const PurpleTeamMatrixView: React.FC = () => {
  const { t } = useTranslation();
  const {cases}=useCaseManagementStore();
  const items:PurpleCorrelationItem[]=cases.flatMap(item=>item.mitreMappings.map(mapping=>({
    id:item.id+mapping.techniqueId,technique:mapping.techniqueId+' — '+mapping.techniqueName,
    blueDetection:item.timeline.map(e=>e.source+': '+e.description).join(' · ')||t('common.noData'),
    dfirArtifact:item.evidence.map(e=>e.name+' ['+e.sha256+']').join(' · ')||t('common.noData'),
    redRecon:item.iocs.map(ioc=>ioc.type+': '+ioc.value).join(' · ')||t('common.noData'),
    status:item.timeline.length||item.evidence.length||item.iocs.length?'Partial':'Gap'
  })));

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      <p>{t("operational.purpleScope")}</p>{!items.length && <p>{t("common.noData")}</p>}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.purpleMatrix.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
            {t('v3.purpleMatrix.subtitle')}
          </p>
        </div>
      </div>

      {/* Correlation Matrix Table */}
      <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} style={{ color: 'var(--accent-primary)' }} /> {t('v3.purpleMatrix.matrixTitle', { count: items.length }) || `Üç Boyutlu Savunma Matrisi (${items.length})`}
        </div>

        <table style={{ width: '100%', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th>{t('v3.purpleMatrix.technique') || 'Teknik'}</th>
              <th>{t('v3.purpleMatrix.blueDetection') || 'Mavi Takım Tespiti'}</th>
              <th>{t('v3.purpleMatrix.dfirArtifact') || 'Adli Bilişim Kanıtı'}</th>
              <th>{t('v3.purpleMatrix.redRecon') || 'Kırmızı Takım Keşif Tabanı'}</th>
              <th>{t('v3.purpleMatrix.status') || 'Durum'}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{row.technique}</td>
                <td>{message(row.blueDetection)}</td>
                <td>{message(row.dfirArtifact)}</td>
                <td>{message(row.redRecon)}</td>
                <td>
                  {row.status === 'Covered' ? (
                    <span className="badge badge-green">{t('v3.purpleMatrix.covered') || 'TAM KAPSAMA'}</span>
                  ) : (
                    <span className="badge" style={{ background: '#fef9c3', color: '#854d0e' }}>{t('v3.purpleMatrix.partial') || 'KISMİ KAPSAMA'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
