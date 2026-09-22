import { message } from "../../i18n";
import { CaseTools } from '../../components/common/CaseTools';
import { t as translateText } from "../../i18n";
import React, { useState } from 'react';
import { useCaseManagementStore, CaseItem } from '../../stores/case-management.store';
import { ShieldAlert, Briefcase, Plus, Tag, Clock, FileText, CheckCircle, AlertTriangle, Database } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const CaseManagementView: React.FC = () => {
  const { t } = useTranslation();
  const { cases, activeCaseId, setActiveCaseId, createCase, updateCase } = useCaseManagementStore();
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeverity, setNewSeverity] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [newTags, setNewTags] = useState('Incident, C2, Windows');

  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createCase({
      title: newTitle,
      description: newDesc,
      severity: newSeverity,
      status: 'Investigating',
      tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
      iocs: [],
      evidence: [],
      timeline: [],
      mitreMappings: [],
      aiNotes: [],
      analystNotes: '',
    });
    setNewTitle('');
    setNewDesc('');
    setShowNewModal(false);
  };

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
      {activeCase && <CaseTools item={activeCase} />}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Briefcase size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.caseManagement.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
              {t('v3.caseManagement.subtitle')}
            </p>
          </div>
        </div>

        <button className="fluent-button" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-primary)', color: 'white' }} onClick={() => setShowNewModal(true)}>
          <Plus size={16} /> {t('v3.caseManagement.newCase')}
        </button>
      </div>

      {/* Main Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', flex: 1 }}>
        {/* Case List Sidebar */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Database size={16} style={{ color: 'var(--accent-primary)' }} /> {t('v3.caseManagement.activeCases', { count: cases.length }) || `Active Cases (${cases.length})`}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
            {cases.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveCaseId(item.id)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: activeCase?.id === item.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                  background: activeCase?.id === item.id ? 'var(--bg-primary)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>{item.id}</span>
                  {getSeverityBadge(item.severity)}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {message(item.title)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={12} /> {new Date(item.updatedAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Case Workspace Details */}
        {activeCase ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Case Overview Card */}
            <div className="fluent-card" style={{ padding: '20px', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{activeCase.id}</span>
                    {getSeverityBadge(activeCase.severity)}
                    <span className="badge badge-blue">{message(activeCase.status)}</span>
                  </div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{message(activeCase.title)}</h2>
                </div>

                <select
                  value={activeCase.status}
                  onChange={(e) => updateCase(activeCase.id, { status: e.target.value as any })}
                  className="fluent-input"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  <option value="Open">{t('v3.caseManagement.statusOpen') || 'Status: Open'}</option>
                  <option value="Investigating">{t('v3.caseManagement.statusInvestigating') || 'Status: Investigating'}</option>
                  <option value="Resolved">{t('v3.caseManagement.statusResolved') || 'Status: Resolved'}</option>
                  <option value="Archived">{t('v3.caseManagement.statusArchived') || 'Status: Archived'}</option>
                </select>
              </div>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{message(activeCase.description)}</p>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '14px' }}>
                {activeCase.tags.map((tag, idx) => (
                  <span key={idx} style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Tag size={10} /> {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* IOC & Evidence Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Associated IOCs */}
              <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={16} style={{ color: 'var(--accent-danger)' }} /> {t('v3.caseManagement.caseIndicators', { count: activeCase.iocs.length }) || `Case Indicators (IOCs: ${activeCase.iocs.length})`}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeCase.iocs.map((ioc, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-primary)', marginRight: '8px' }}>{ioc.type}</span>
                        <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{ioc.value}</span>
                      </div>
                      <span className="badge badge-red">{ioc.riskScore}{translateText("interfaceText.message152")}</span>
                    </div>
                  ))}
                  {activeCase.iocs.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{t('v3.caseManagement.noIocsLinked') || 'No IOCs linked to this case yet.'}</div>
                  )}
                </div>
              </div>

              {/* MITRE ATT&CK Techniques */}
              <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} style={{ color: '#38bdf8' }} /> {t('v3.caseManagement.mitreMappings', { count: activeCase.mitreMappings.length }) || `MITRE ATT&CK Mappings (${activeCase.mitreMappings.length})`}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeCase.mitreMappings.map((m, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '6px' }}>{m.tactic}</span>
                        <strong style={{ fontSize: '0.82rem' }}>{m.techniqueId}: {m.techniqueName}</strong>
                      </div>
                      <span className="badge badge-blue">{m.confidence}{translateText("interfaceText.message153")}</span>
                    </div>
                  ))}
                  {activeCase.mitreMappings.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{t('v3.caseManagement.noMitreRecorded') || 'No MITRE mappings recorded.'}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Analyst & AI Investigation Notes */}
            <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} /> {t('v3.caseManagement.analystSynthesisNotes') || 'Analyst & Automated AI Synthesis Notes'}
              </div>

              <textarea
                className="fluent-input"
                rows={3}
                style={{ width: '100%', fontSize: '0.85rem', lineHeight: 1.4, marginBottom: '12px' }}
                value={activeCase.analystNotes}
                onChange={(e) => updateCase(activeCase.id, { analystNotes: e.target.value })}
                placeholder={t('v3.caseManagement.analystNotesPlaceholder') || "Enter investigation progress, forensic conclusions, and incident response notes..."}
              />

              {activeCase.aiNotes.map((note, idx) => (
                <div key={idx} style={{ fontSize: '0.8rem', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: '6px', borderLeft: '3px solid var(--accent-primary)', marginTop: '6px', color: 'var(--text-secondary)' }}>
                  🤖 {note}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>{t('v3.caseManagement.selectOrCreateCase') || 'Select or create an investigation case.'}</div>
        )}
      </div>

      {/* Create Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form className="fluent-card" onSubmit={handleCreate} style={{ width: '480px', padding: '24px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{t('v3.caseManagement.createModalTitle')}</h2>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('v3.caseManagement.caseTitleLabel') || 'Case Title'}</label>
              <input type="text" className="fluent-input" style={{ width: '100%', marginTop: '4px' }} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('v3.caseManagement.caseTitlePlaceholder') || "e.g. Ransomware Outbreak on Host-12"} required />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('v3.caseManagement.descriptionLabel') || 'Description'}</label>
              <textarea className="fluent-input" style={{ width: '100%', marginTop: '4px' }} rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('v3.caseManagement.descriptionPlaceholder') || "Brief summary of indicators and evidence..."} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('v3.caseManagement.severityLabel') || 'Severity'}</label>
                <select className="fluent-input" style={{ width: '100%', marginTop: '4px' }} value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as any)}>
                  <option value="Critical">{t('common.critical')}</option>
                  <option value="High">{t('common.high')}</option>
                  <option value="Medium">{t('common.medium')}</option>
                  <option value="Low">{t('common.low')}</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('v3.caseManagement.tagsLabel') || 'Tags (comma separated)'}</label>
                <input type="text" className="fluent-input" style={{ width: '100%', marginTop: '4px' }} value={newTags} onChange={(e) => setNewTags(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" className="fluent-button" onClick={() => setShowNewModal(false)}>{t('common.cancel')}</button>
              <button type="submit" className="fluent-button" style={{ background: 'var(--accent-primary)', color: 'white' }}>{t('v3.caseManagement.createCaseBtn') || 'Create Case'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
