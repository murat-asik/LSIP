import React, { useState } from 'react';
import { CaseItem, useCaseManagementStore } from '../../stores/case-management.store';
import { useTranslation } from '../../i18n';
export function CaseTools({item}:{item:CaseItem}) {
  const {t}=useTranslation();const {updateCase}=useCaseManagementStore();
  const [value,setValue]=useState(''),[type,setType]=useState('ip');
  const [tactic,setTactic]=useState(''),[technique,setTechnique]=useState(''),[name,setName]=useState('');
  const [observation,setObservation]=useState(''),[error,setError]=useState('');
  const act=(fn:()=>void)=>{try{setError('');fn();}catch(e:any){setError(e.message);}};
  const addIoc=()=>act(()=>{
    const indicator=value.trim();if(!indicator||indicator.length>2048||/[\x00-\x20]/.test(indicator))throw new Error(t('operational.inputError'));
    if(type==='hash'&&!/^(?:[a-f\d]{32}|[a-f\d]{40}|[a-f\d]{64})$/i.test(indicator))throw new Error(t('operational.inputError'));
    if(type==='url'&&!/^https?:\/\//i.test(indicator))throw new Error(t('operational.inputError'));
    if(!item.iocs.some(i=>i.type===type&&i.value===indicator))updateCase(item.id,{iocs:[...item.iocs,{type,value:indicator,confidence:0,riskScore:0}]});setValue('');
  });
  const addMapping=()=>act(()=>{
    if(!/^T\d{4}(?:\.\d{3})?$/.test(technique)||!name.trim()||!tactic.trim())throw new Error(t('operational.inputError'));
    if(!item.mitreMappings.some(m=>m.techniqueId===technique))updateCase(item.id,{mitreMappings:[...item.mitreMappings,{tactic:tactic.trim(),techniqueId:technique,techniqueName:name.trim(),confidence:0}]});setTechnique('');setName('');
  });
  return <div className="fluent-card" style={{padding:16,display:'flex',flexDirection:'column',gap:14}}>
    {error&&<p role="alert">{error}</p>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <select className="fluent-input" value={type} onChange={e=>setType(e.target.value)}>{['ip','domain','url','hash'].map(k=><option key={k}>{k}</option>)}</select>
      <input className="fluent-input" aria-label={t('common.value')} value={value} onChange={e=>setValue(e.target.value)} />
      <button className="fluent-button" onClick={addIoc}>{t('operational.addIoc')}</button>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <label>{t('operational.tactic')}<input className="fluent-input" value={tactic} onChange={e=>setTactic(e.target.value)}/></label>
      <label>{t('operational.technique')}<input className="fluent-input" value={technique} onChange={e=>setTechnique(e.target.value)}/></label>
      <label>{t('operational.techniqueName')}<input className="fluent-input" value={name} onChange={e=>setName(e.target.value)}/></label>
      <button className="fluent-button" onClick={addMapping}>{t('operational.addMapping')}</button>
    </div>
    <div style={{display:'flex',gap:8}}><input className="fluent-input" style={{flex:1}} aria-label={t('common.description')} value={observation} onChange={e=>setObservation(e.target.value)}/>
      <button className="fluent-button" disabled={!observation.trim()} onClick={()=>act(()=>{updateCase(item.id,{timeline:[...item.timeline,{id:crypto.randomUUID(),timestamp:Date.now(),category:'Analyst',description:observation.trim(),source:'Analyst',severity:'Info'}]});setObservation('');})}>{t('operational.addObservation')}</button>
    </div>
  </div>;
}
