// Invalid synthetic evidence only. Positive reference-image acceptance remains separate.
const {app}=require('electron'),fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'tmp','forensic-negative',crypto.randomUUID());fs.mkdirSync(scratch,{recursive:true});app.setPath('userData',path.join(scratch,'profile'));app.setAppPath(root);
const timer=setTimeout(()=>app.exit(1),180000),results=[];
app.whenReady().then(async()=>{
 const db=require('../dist/main/core/database-manager').databaseManager;await db.ready;
 const module=new(require('../dist/main/modules/dfir/dfir.module').DfirModule)();await module.initialize();
 const {analyzeForensic}=require('../dist/main/modules/dfir/forensic-service');
 const invalid=path.join(scratch,'invalid-evidence.bin'),bytes=Buffer.from('LSIP: not a memory dump or disk image');fs.writeFileSync(invalid,bytes);
 for(const type of ['prefetch','amcache','shimcache','jumplists','srum','usn','recycle','registry','pslist','netscan','malfind']){
  const input=['pslist','netscan','malfind'].includes(type)?{type:'memory',memoryPlugin:type,source:invalid}:{type,source:invalid};
  try{await assert.rejects(()=>analyzeForensic(input));assert.deepEqual(fs.readFileSync(invalid),bytes);results.push({type,pass:true,invalidInputRejected:true,sourceUnchanged:true})}catch(error){results.push({type,pass:false,error:error.message})}
 }
 const rows=await db.queryGet('dfir','SELECT COUNT(*) n FROM dfir_analysis_runs');assert.equal(rows.n,0,'Invalid inputs must not persist successful analyses');await module.shutdown();await db.closeAll();clearTimeout(timer);
 const report={checkedAt:new Date().toISOString(),scope:'Invalid synthetic inputs; not positive reference-image coverage',results};fs.writeFileSync(path.join(root,'security-audit/forensic-negative-acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(results.some(r=>!r.pass)?1:0);
}).catch(error=>{console.error(error);clearTimeout(timer);app.exit(1)});
