import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Transform, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { databaseManager } from '../../core/database-manager';
import { text } from '../../core/security';
const directory=()=>path.join(app.getPath('userData'),'evidence-vault');
let busy=false;
async function key():Promise<Buffer>{
  if(!safeStorage.isEncryptionAvailable())throw new Error('Windows key protection is unavailable');
  await fs.promises.mkdir(directory(),{recursive:true});
  const file=path.join(directory(),'vault.key');
  try{return Buffer.from(safeStorage.decryptString(await fs.promises.readFile(file)),'hex');}
  catch(e:any){if(e.code!=='ENOENT')throw e;}
  const generated=crypto.randomBytes(32);
  try{await fs.promises.writeFile(file,safeStorage.encryptString(generated.toString('hex')),{flag:'wx'});return generated;}
  catch(e:any){if(e.code==='EEXIST')return Buffer.from(safeStorage.decryptString(await fs.promises.readFile(file)),'hex');throw e;}
}
export async function acquireEvidence(input:{sourcePath:string;title:string}) {
  text(input?.sourcePath,'Evidence path');text(input?.title,'Evidence title',500);
  if(busy)throw new Error('An evidence acquisition is already running');busy=true;
  const id='EV-'+crypto.randomUUID(),destination=path.join(directory(),id+'.aes');
  let persisted=false,encryptionKey:Buffer|undefined;
  try{
    encryptionKey=await key();
    const handle=await fs.promises.open(path.resolve(input.sourcePath),'r');
    let hash='',size=0;const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey,iv);
    try{
      const before=await handle.stat();if(!before.isFile())throw new Error('Evidence must be a regular file');size=before.size;
      const digest=crypto.createHash('sha256');
      const source=handle.createReadStream({autoClose:false});
      const timer=setTimeout(()=>source.destroy(new Error('Evidence acquisition timed out')),300000);
      try{await pipeline(source,new Transform({transform(chunk,_encoding,cb){digest.update(chunk);cb(null,chunk);}}),cipher,fs.createWriteStream(destination,{flags:'wx'}));}
      finally{clearTimeout(timer);}
      const after=await handle.stat();if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw new Error('Source changed during acquisition');hash=digest.digest('hex');
    }finally{await handle.close();encryptionKey.fill(0);}
    const now=Date.now(),metadata={acquiredCopy:true,encryption:'AES-256-GCM',iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),blob:id+'.aes'};
    await databaseManager.queryRun('dfir','INSERT INTO dfir_evidence(id,title,type,source_path,file_hash,file_size,status,added_at,metadata) VALUES(?,?,?,?,?,?,?,?,?)',[id,input.title,'file',path.resolve(input.sourcePath),hash,size,'acquired',now,JSON.stringify(metadata)]);
    persisted=true;
    return {id,hash,size,title:input.title,sourcePath:path.resolve(input.sourcePath),collectedAt:now};
  }finally{encryptionKey?.fill(0);busy=false;if(!persisted)await fs.promises.unlink(destination).catch(()=>{});}
}
export async function verifyEvidence(input:{id:string}) {
  text(input?.id,'Evidence ID',80);
  const row=await databaseManager.queryGet('dfir','SELECT * FROM dfir_evidence WHERE id=?',[input.id]);
  if(!row)throw new Error('Evidence was not found');const metadata=JSON.parse(row.metadata||'{}');
  if(!metadata.acquiredCopy||metadata.blob!==row.id+'.aes'||!/^EV-[a-f0-9-]+$/i.test(row.id))throw new Error('This record has no acquired copy');
  const encryptionKey=await key();const digest=crypto.createHash('sha256');
  try{
    const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey,Buffer.from(metadata.iv,'hex'));decipher.setAuthTag(Buffer.from(metadata.tag,'hex'));
    const source=fs.createReadStream(path.join(directory(),metadata.blob));
    const timer=setTimeout(()=>source.destroy(new Error('Evidence verification timed out')),300000);
    try{await pipeline(source,decipher,new Writable({write(chunk,_encoding,cb){digest.update(chunk);cb();}}));}finally{clearTimeout(timer);}
  }catch(error:any){
    await databaseManager.queryRun('dfir','INSERT INTO dfir_chain_of_custody(id,evidence_id,action,performed_by,timestamp,notes,hash_verification) VALUES(?,?,?,?,?,?,?)',['COC-'+crypto.randomUUID(),row.id,'INTEGRITY_FAILED','Local analyst',Date.now(),'Stored copy authentication/read failed: '+String(error.message).slice(0,500),'']);
    throw error;
  }finally{encryptionKey.fill(0);}
  const hash=digest.digest('hex'),verified=hash===row.file_hash;
  await databaseManager.queryRun('dfir','INSERT INTO dfir_chain_of_custody(id,evidence_id,action,performed_by,timestamp,notes,hash_verification) VALUES(?,?,?,?,?,?,?)',['COC-'+crypto.randomUUID(),row.id,verified?'INTEGRITY_VERIFIED':'INTEGRITY_FAILED','Local analyst',Date.now(),'Stored encrypted copy verified',hash]);
  if(!verified)throw new Error('Stored evidence hash does not match');return {id:row.id,verified,hash};
}
