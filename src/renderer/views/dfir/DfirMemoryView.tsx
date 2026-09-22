import { ForensicPanel } from '../../components/common/ForensicPanel';
import React, { useEffect, useState } from 'react';
import { Cpu, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const DfirMemoryView: React.FC = () => {
  const { t } = useTranslation();
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    window.lsip.invoke('dfir:get-memory-analysis').then((res: any) => {
      if (res?.success) setArtifacts(res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="view-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Cpu style={{ color: '#0284c7' }} /> {t('workspaces.memoryAnalysis')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {t('dfirMemory.subtitle')}
        </p>
      </div>

      <ForensicPanel type="memory" />
      <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
        {loading ? (
          <div style={{ padding: '20px' }}>{t('common.loading')}</div>
        ) : (
          <table className="fluent-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>{t('dfirMemory.pid') || 'PID'}</th>
                <th>{t('dfirMemory.processName') || 'Process Name'}</th>
                <th>{t('dfirMemory.workingSetMb') || 'Working Set (MB)'}</th>
                <th>{t('dfirMemory.kernelTimeMs') || 'Kernel Time (ms)'}</th>
                <th>{t('dfirMemory.handles') || 'Handles'}</th>
                <th>{t('dfirMemory.nonPagedPoolKb') || 'Non-Paged Pool (KB)'}</th>
                <th>{t('dfirMemory.anomalyStatus') || 'Anomaly Status'}</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((proc) => (
                <tr key={proc.pid}>
                  <td style={{ fontWeight: 600 }}>{proc.pid}</td>
                  <td style={{ color: '#38bdf8' }}>{proc.name}</td>
                  <td>{proc.sizeMb} MB</td>
                  <td>{proc.kernelTimeMs} ms</td>
                  <td>{proc.handleCount}</td>
                  <td>{proc.nonPagedPoolKb} KB</td>
                  <td>
                    {proc.suspicious ? (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> {proc.reason || t('dfirMemory.suspicious') || 'Suspicious'}
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldCheck size={12} /> {t('dfirMemory.normal') || 'Normal'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
