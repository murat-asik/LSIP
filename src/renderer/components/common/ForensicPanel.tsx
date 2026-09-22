import { message } from '../../i18n';
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { RecursiveObjectViewer } from './RecursiveObjectViewer';
export function ForensicPanel({type}:{type:string}) {
  const {t}=useTranslation();
  const [source,setSource]=useState(type==='memory'?'':'local');
  const [symbolsPath,setSymbolsPath]=useState('');
  const [memoryPlugin,setMemoryPlugin]=useState('pslist');
  const [result,setResult]=useState<any>(null);
  const [history,setHistory]=useState<any[]>([]);
  const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  const historyLoad=async()=>{const response=await window.lsip.invoke('dfir:analysis-history',{type});if(!response?.success)throw new Error(response?.error?.message||'History failed');setHistory(response.data||[]);};
  useEffect(()=>{historyLoad().catch((e:any)=>setError(e.message));},[type]);
  const analyze=async()=>{
    setLoading(true);setError('');setResult(null);
    try{const response=await window.lsip.invoke('dfir:analyze-artifact',{type,source,memoryPlugin,symbolsPath});if(!response?.success)throw new Error(response?.error?.message||response?.error||'Analysis failed');setResult(response.data);await historyLoad();}
    catch(e:any){setError(e.message);}finally{setLoading(false);}
  };
  const records=result?.records||[];
  const keys=Array.from(new Set<string>(records.slice(0,20).flatMap((r:any)=>Object.keys(r)))).filter(k=>!k.startsWith('_'));
  return <div className="fluent-card" style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>
    <p>{t(type==='memory'?'forensic.memoryHelp':'forensic.diskHelp')}</p>
    <label>{t('common.source')}<input className="fluent-input" style={{width:'100%'}} value={source} onChange={e=>setSource(e.target.value)} disabled={loading}/></label>
    {type==='memory'&&<>
      <label>{t('forensic.symbols')}<input className="fluent-input" style={{width:'100%'}} value={symbolsPath} onChange={e=>setSymbolsPath(e.target.value)}/></label>
      <select className="fluent-input" value={memoryPlugin} onChange={e=>setMemoryPlugin(e.target.value)}>
        <option value="pslist">{t('forensic.pslist')}</option><option value="netscan">{t('forensic.netscan')}</option><option value="malfind">{t('forensic.malfind')}</option>
      </select>
    </>}
    <button className="fluent-button" disabled={loading||!source.trim()} onClick={analyze}>{loading?t('common.loading'):t('forensic.analyze')}</button>
    {error&&<pre role="alert" style={{whiteSpace:'pre-wrap',color:'var(--accent-danger)'}}>{message(error)}</pre>}
    {history.length>0&&<label>{t('forensic.history')}<select className="fluent-input" defaultValue="" onChange={e=>{if(e.target.value)setResult(JSON.parse(history[Number(e.target.value)].result_json));}}><option value="">{t('common.none')}</option>{history.map((row,i)=><option key={row.source} value={i}>{row.source} — {new Date(row.collected_at).toLocaleString()}</option>)}</select></label>}
    {result&&<>
      <p>{result.engine} · {new Date(result.collectedAt).toLocaleString()} · {t('common.count')}: {records.length}</p>
      {result.limited&&<p role="status">{t('operational.forensicLimit')}</p>}
      {result.warnings&&<pre style={{whiteSpace:'pre-wrap'}}>{result.warnings}</pre>}
      {!records.length?<p>{t('common.noData')}</p>:<div style={{overflow:'auto',maxHeight:650}}><table className="fluent-table"><thead><tr>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{records.map((row:any,i:number)=><tr key={i}>{keys.map(k=><td key={k} style={{maxWidth:380,overflowWrap:'anywhere'}}>{typeof row[k]==='object'&&row[k]!==null?<RecursiveObjectViewer data={row[k]}/>:String(row[k]??'')}</td>)}</tr>)}</tbody></table></div>}
    </>}
  </div>;
}
