import { message } from '../../i18n';
import { useModuleData } from '../../hooks/useModuleData';
import { DataStatus } from '../../components/common/DataStatus';
import { t as translateText } from "../../i18n";
import React, { useState } from 'react';
import { useCaseManagementStore, EvidenceItem } from '../../stores/case-management.store';
import { Lock, ShieldCheck, FileCode, CheckCircle2, Clock, Key, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const EvidenceLockerView: React.FC = () => {
  const { t } = useTranslation();
  const { addEvidenceToCase, cases, activeCaseId } = useCaseManagementStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  const snapshot=useModuleData<any[]>('dfir:get-evidence',undefined,[]);
  const custody=useModuleData<any[]>('dfir:get-chain-of-custody',undefined,[]);
  const [sourcePath,setSourcePath]=useState(''),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [verifiedIds,setVerifiedIds]=useState<Set<string>>(new Set());
  const globalEvidenceLocker:EvidenceItem[]=snapshot.data.map(row=>({id:row.id,type:row.type,name:row.title,source:row.source_path,sha256:row.file_hash||'',md5:'',collectedAt:row.added_at,collector:'Local analyst',custodyChain:custody.data.filter(c=>c.evidence_id===row.id).map(c=>new Date(c.timestamp).toLocaleString()+' '+c.action),integrityVerified:verifiedIds.has(row.id),metadata:JSON.parse(row.metadata||'{}')}));
  const acquire=async()=>{setBusy(true);setError('');try{
    const res=await window.lsip.invoke('dfir:acquire-evidence',{sourcePath,title});if(!res?.success)throw new Error(res?.error?.message||'Acquisition failed');
    if(activeCaseId)addEvidenceToCase(activeCaseId,{type:'file',name:res.data.title,source:res.data.sourcePath,sha256:res.data.hash,md5:'',collector:'Local analyst',custodyChain:['ENCRYPTED_COPY_ACQUIRED'],integrityVerified:false,metadata:{evidenceId:res.data.id}});
    snapshot.refresh();custody.refresh();setSourcePath('');setTitle('');
  }catch(e:any){setError(e.message);}finally{setBusy(false);}};
  const verify=async()=>{if(!selectedEvidence)return;setBusy(true);setError('');try{const res=await window.lsip.invoke('dfir:verify-evidence',{id:selectedEvidence.id});if(!res?.success)throw new Error(res?.error?.message||'Verification failed');setVerifiedIds(old=>new Set([...old,selectedEvidence.id]));setSelectedEvidence({...selectedEvidence,integrityVerified:true});custody.refresh();}catch(e:any){setVerifiedIds(old=>{const next=new Set(old);next.delete(selectedEvidence.id);return next;});setSelectedEvidence({...selectedEvidence,integrityVerified:false});setError(e.message);custody.refresh();}finally{setBusy(false);}};
  const filtered = globalEvidenceLocker.filter((item) => filterType === 'all' || item.type === filterType);

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      <DataStatus {...snapshot} empty={!snapshot.data.length}/>
      <div className="fluent-card" style={{padding:16,display:'flex',gap:10,flexWrap:'wrap'}}>
        <label>{t('common.title')}<input className="fluent-input" value={title} onChange={e=>setTitle(e.target.value)} /></label>
        <label style={{flex:1}}>{t('operational.evidenceSource')}<input className="fluent-input" style={{width:'100%'}} value={sourcePath} onChange={e=>setSourcePath(e.target.value)} /></label>
        <button className="fluent-button" onClick={acquire} disabled={busy||!title.trim()||!sourcePath.trim()}>{t('operational.acquire')}</button>
      </div>
      {error&&<div role="alert" style={{color:'var(--accent-danger)'}}>{message(error)}</div>}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Lock size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.evidenceLocker.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
              {t('v3.evidenceLocker.subtitle')}
            </p>
          </div>
        </div>

        <select className="fluent-input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
          <option value="all">{t('v3.evidenceLocker.filterAll') || 'All Evidence Types'}</option>
          <option value="memory">{t('v3.evidenceLocker.filterMemory') || 'Memory Dumps'}</option>
          <option value="file">{t('v3.evidenceLocker.filterFile') || 'File Artifacts'}</option>
          <option value="registry">{t('v3.evidenceLocker.filterRegistry') || 'Registry Hives'}</option>
          <option value="process">{t('v3.evidenceLocker.filterProcess') || 'Process Telemetry'}</option>
          <option value="network">{t('v3.evidenceLocker.filterNetwork') || 'Network Captures'}</option>
        </select>
      </div>

      {/* Main Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', flex: 1 }}>
        {/* Evidence Table */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} style={{ color: 'var(--accent-success)' }} /> {t('v3.evidenceLocker.vaultedItems', { count: filtered.length }) || `Vaulted Evidence Items (${filtered.length})`}
          </div>

          <table style={{ width: '100%', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>{t('v3.evidenceLocker.colName') || 'Evidence Name'}</th>
                <th>{t('v3.evidenceLocker.colType') || 'Type'}</th>
                <th>{t('v3.evidenceLocker.colSource') || 'Source Location'}</th>
                <th>{t('v3.evidenceLocker.colHash') || 'SHA-256 Hash'}</th>
                <th>{t('v3.evidenceLocker.colIntegrity') || 'Integrity'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedEvidence(item)}
                  style={{
                    cursor: 'pointer',
                    background: selectedEvidence?.id === item.id ? 'var(--bg-primary)' : 'transparent',
                  }}
                >
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td><span className="badge badge-blue">{item.type}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{item.source}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{item.sha256.substring(0, 16)}...</td>
                  <td>
                    {item.integrityVerified ? (
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> {t('v3.evidenceLocker.verified') || 'VERIFIED'}
                      </span>
                    ) : (
                      <span className="badge badge-red">{t('v3.evidenceLocker.unverified') || 'UNVERIFIED'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selected Evidence Detail Inspector */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={16} style={{ color: 'var(--accent-primary)' }} /> {t('v3.evidenceLocker.chainOfCustodyAudit') || 'Chain of Custody & Hash Audit'}
          </div>

          {selectedEvidence && <button className="fluent-button" onClick={verify} disabled={busy || !selectedEvidence.metadata?.acquiredCopy}>{t("operational.verify")}</button>}
          {selectedEvidence ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>{selectedEvidence.id} • {selectedEvidence.type}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '4px 0' }}>{selectedEvidence.name}</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t('v3.evidenceLocker.collector') || 'Collector'}: {selectedEvidence.collector}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{translateText("interfaceText.message155")}</label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', padding: '8px', background: 'var(--bg-primary)', borderRadius: '6px', wordBreak: 'break-all', border: '1px solid var(--border-primary)', marginTop: '4px' }}>
                  {selectedEvidence.sha256}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{translateText("interfaceText.message156")}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {selectedEvidence.custodyChain.map((log, idx) => (
                    <div key={idx} style={{ fontSize: '0.78rem', padding: '6px 10px', background: 'var(--bg-primary)', borderRadius: '4px', borderLeft: '3px solid var(--accent-success)' }}>
                      🔒 {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}> {translateText("interfaceText.message157")} </div>
          )}
        </div>
      </div>
    </div>
  );
};
