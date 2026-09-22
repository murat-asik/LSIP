import { message } from "../../i18n";
import React, { useEffect, useState } from 'react';
import { Database, Plus, ShieldCheck, FileCheck, Hash, Layers } from 'lucide-react';
import { useTranslation } from '../../i18n';

declare global {
  interface Window {
    lsip: any;
  }
}

export const DfirEvidenceView: React.FC = () => {
  const { t } = useTranslation();
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [custodyLogs, setCustodyLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form state
  const [title, setTitle] = useState<string>('');
  const [type, setType] = useState<string>('DISK_IMAGE');
  const [sourcePath, setSourcePath] = useState<string>('');

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const res = await window.lsip.invoke('dfir:get-evidence');
      if (res.success) setEvidenceList(res.data || []);

      const cocRes = await window.lsip.invoke('dfir:get-chain-of-custody');
      if (cocRes.success) setCustodyLogs(cocRes.data || []);
    } catch (e) {
      console.error('Error fetching DFIR evidence:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    try {
      const result = await window.lsip.invoke('dfir:add-evidence', { title, type, sourcePath });
      if (!result?.success) throw new Error(result?.error || 'Delil kaydedilemedi');
      setTitle('');
      setSourcePath('');
      fetchEvidence();
    } catch (e) {
      console.error('Failed to add evidence:', e);
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database style={{ color: '#0284c7' }} /> {t('dfirView.title')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t('dfirView.subtitle')}
          </p>
        </div>
      </div>

      {/* Add Evidence Form */}
      <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} style={{ color: '#0284c7' }} /> {t('dfirView.acquireTitle')}
        </h3>
        <form onSubmit={handleAddEvidence} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 1fr 120px', gap: '12px' }}>
          <input
            type="text"
            className="fluent-input"
            placeholder={t('dfirView.evidenceTitlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <select className="fluent-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="DISK_IMAGE">{t('dfirView.types.DISK_IMAGE') || 'Disk Image'}</option>
            <option value="MEMORY_DUMP">{t('dfirView.types.MEMORY_DUMP') || 'Memory Dump'}</option>
            <option value="REGISTRY_HIVE">{t('dfirView.types.REGISTRY_HIVE') || 'Registry Hive'}</option>
            <option value="LOG_EXPORT">{t('dfirView.types.LOG_EXPORT') || 'Log Export'}</option>
            <option value="PCAP_FILE">{t('dfirView.types.PCAP_FILE') || 'Network PCAP'}</option>
          </select>
          <input
            type="text"
            className="fluent-input"
            placeholder={t('dfirView.sourcePathPlaceholder')}
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
          />
          <button type="submit" className="fluent-button" style={{ backgroundColor: '#0284c7', color: '#fff' }}>
            {t('dfirView.registerItem')}
          </button>
        </form>
      </div>

      {/* Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Registered Evidence Table */}
        <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck size={18} style={{ color: '#0284c7' }} /> {t('dfirView.forensicItems')} ({evidenceList.length})
          </h3>
          {loading ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>{t('common.loading')}</div>
          ) : evidenceList.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>{t('common.noData')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="fluent-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>{t('dfirView.id') || 'ID'}</th>
                    <th>{t('dfirView.titleCol') || 'Title'}</th>
                    <th>{t('dfirView.typeCol') || 'Type'}</th>
                    <th>{t('dfirView.hashCol') || 'SHA-256 Hash'}</th>
                    <th>{t('dfirView.statusCol') || 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceList.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: '#0284c7' }}>{item.id}</td>
                      <td>{message(item.title)}</td>
                      <td><span className="badge" style={{ background: 'rgba(2,132,199,0.15)', color: '#38bdf8' }}>{t(`dfirView.types.${item.type}`) || item.type}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {item.file_hash ? item.file_hash.substring(0, 16) + '...' : 'N/A'}
                      </td>
                      <td><span className="badge badge-success">{message(item.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Chain of Custody Audit Log */}
        <div className="fluent-card fluent-glass" style={{ padding: '18px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} style={{ color: '#22c55e' }} /> {t('dfirView.chainOfCustody')} ({custodyLogs.length})
          </h3>
          {custodyLogs.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>{t('common.noData')}</div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: '350px' }}>
              {custodyLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600, color: '#38bdf8' }}>{log.action}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{log.notes}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                    <span>{t('dfirView.operator') || 'Operator'}: {log.performed_by}</span>
                    <span>{t('dfirView.item') || 'Item'}: {log.evidence_id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
