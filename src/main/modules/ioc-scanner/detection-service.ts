import { Worker } from 'worker_threads';
import path from 'path';
import { databaseManager } from '../../core/database-manager';
import { scanYara } from './yara-service';

export async function runDetection(input: { kind: string; content: string; targetPath?: string }) {
  if(input?.kind==='YARA')return scanYara(input.content,input.targetPath || '');
  if(!input || !['Sigma','Hunt','IOC'].includes(input.kind) || typeof input.content!=='string' || !input.content.trim() || input.content.length>65536)throw new Error('Invalid detection request');
  const rows=await databaseManager.queryAll('events','SELECT * FROM events ORDER BY timestamp DESC LIMIT 10000');
  const records=rows.map(row=>{
    let fields:any={};try{fields=JSON.parse(row.parsed_data||'{}');}catch{}
    if(!fields||typeof fields!=='object'||Array.isArray(fields))fields={};
    const image=fields.Image||fields.NewProcessName||fields.ProcessName||'';
    const command=fields.CommandLine||fields.ProcessCommandLine||'';
    return {...fields,id:row.id,EventID:row.event_id,eventId:row.event_id,Provider:row.source,Image:image,CommandLine:command,Computer:row.computer,User:row.user_name,Message:row.message,host:row.computer,user:row.user_name,process:image,cmd:command,timestamp:new Date(row.timestamp).toISOString()};
  });
  return new Promise<any>((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'rule-worker.js'),{workerData:{...input,records},resourceLimits:{maxOldGenerationSizeMb:128}});
    const timer=setTimeout(()=>{void worker.terminate();reject(new Error('Rule exceeded the 5 second execution limit'));},5000);
    worker.once('message',result=>{clearTimeout(timer);void worker.terminate();result.success?resolve(result.data):reject(new Error(result.error));});
    worker.once('error',error=>{clearTimeout(timer);reject(error);});
    worker.once('exit',code=>{clearTimeout(timer);reject(new Error('Rule worker exited without a result: '+code));});
  });
}
