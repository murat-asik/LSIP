const {app}=require('electron');const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'tmp','backup-integration',crypto.randomUUID());fs.mkdirSync(scratch,{recursive:true});app.setPath('userData',path.join(scratch,'profile'));app.setAppPath(root);
let db;const results=[];const timeout=setTimeout(()=>app.exit(1),180000);
async function test(name,fn){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.stack})}}
app.whenReady().then(async()=>{
 db=require('../dist/main/core/database-manager').databaseManager;await db.ready;
 const {createBackup,stageRestore}=require('../dist/main/core/backup-service');const {applyPendingRestore}=require('../dist/main/core/restore-startup');
 const put=(n)=>db.queryRun('events','INSERT INTO events(event_id,source,level,timestamp,message) VALUES(?,?,?,?,?)',[n,'fixture',4,n,'BACKUP_CANARY_PRIVATE']);
 await test('Olay ve imleç atomik işlem hatasında birlikte geri alınır',async()=>{
  await assert.rejects(()=>db.atomicBatch('events',[{sql:'INSERT INTO events(event_id,source,level,timestamp) VALUES(?,?,?,?)',params:[1,'rollback',4,1]},{sql:'INSERT INTO table_that_does_not_exist VALUES(?)',params:[1]}]));
  assert.equal((await db.queryGet('events',"SELECT COUNT(*) n FROM events WHERE source='rollback'")).n,0);
 });
 await test('Yedek görüntüsü sırasında yeni yazma bekler, sonra devam eder',async()=>{
  let completed=false,pending;await db.snapshotTo(path.join(scratch,'snapshot'),async()=>{pending=put(1).then(()=>{completed=true});await new Promise(r=>setTimeout(r,30));assert.equal(completed,false)});await pending;assert.equal(completed,true);
 });
 const input=path.join(scratch,'evidence.txt');fs.writeFileSync(input,'BACKUP_CANARY_PRIVATE');const vault=require('../dist/main/modules/dfir/evidence-vault');const acquired=await vault.acquireEvidence({sourcePath:input,title:'Backup fixture'});
 const password='fixture-password-2026';let backup;
 const library=require('../dist/main/modules/ioc-scanner/rule-library');let savedRule;
 await test('Kural sürümleri kalıcıdır; eski sürüm üzerine yazma ve tür değişimi reddedilir',async()=>{
  await library.initializeRuleLibrary();savedRule=await library.saveRule({kind:'Hunt',title:'Fixture',content:'EventID=4688'});
  const second=await library.saveRule({...savedRule,expectedRevision:1,content:'EventID=4624'});assert.equal(second.revision,2);
  await assert.rejects(()=>library.saveRule({...savedRule,expectedRevision:1}),/revision changed/);
  await assert.rejects(()=>library.saveRule({...second,kind:'Sigma',expectedRevision:2}),/revision changed/);
  const rules=await library.listRules({kind:'Hunt'});assert.equal(rules.length,2);assert.equal(rules[1].content,'EventID=4688');
  const multiline='title: Test\ndetection:\n  selection:\n    EventID: 4688\n  condition: selection';
  await library.saveRule({kind:'Sigma',title:'Multiline fixture',content:multiline});assert.equal((await library.listRules({kind:'Sigma'}))[0].content,multiline);
 });
 await test('WAL, çalışma alanı ve kanıt kasası şifreli yedeğe girer',async()=>{
  backup=await createBackup(scratch,password,{lsip_v3_cases:'[]',lsip_language:'tr'});const manifest=JSON.parse(fs.readFileSync(path.join(backup.directory,'manifest.json')));
  assert(manifest.entries.some(e=>e.path===`evidence-vault/${acquired.id}.aes`));for(const entry of manifest.entries)assert(!fs.readFileSync(path.join(backup.directory,entry.blob)).includes(Buffer.from('BACKUP_CANARY_PRIVATE')));
 });
 await test('Yanlış parola ve değiştirilmiş içerik geri yüklenmez',async()=>{
  await assert.rejects(()=>stageRestore(backup.directory,'wrong-password-2026'));assert(!fs.existsSync(path.join(app.getPath('userData'),'pending-restore.json')));
  const manifest=JSON.parse(fs.readFileSync(path.join(backup.directory,'manifest.json'))),file=path.join(backup.directory,manifest.entries[0].blob),original=fs.readFileSync(file),broken=Buffer.from(original);broken[0]^=1;fs.writeFileSync(file,broken);
  try{await assert.rejects(()=>stageRestore(backup.directory,password),/corrupted/)}finally{fs.writeFileSync(file,original)}
 });
 await test('Yedek yol geçişi reddedilir',async()=>{const file=path.join(backup.directory,'manifest.json'),original=fs.readFileSync(file);const manifest=JSON.parse(original);manifest.entries[0].path='../outside.db';fs.writeFileSync(file,JSON.stringify(manifest));try{await assert.rejects(()=>stageRestore(backup.directory,password),/Invalid backup entry/)}finally{fs.writeFileSync(file,original)}});
 await test('Manifestten kanıt çıkarılması kimlik doğrulamasında reddedilir',async()=>{
  const file=path.join(backup.directory,'manifest.json'),original=fs.readFileSync(file),manifest=JSON.parse(original);manifest.entries=manifest.entries.filter(e=>!e.path.endsWith('.aes'));fs.writeFileSync(file,JSON.stringify(manifest));
  try{await assert.rejects(()=>stageRestore(backup.directory,password),/authentication failed/)}finally{fs.writeFileSync(file,original)}
 });
 await test('Geri yükleme WAL verisini, yerel çalışma alanını ve kanıt anahtarını geri getirir',async()=>{
  await put(2);await stageRestore(backup.directory,password);await db.closeAll();applyPendingRestore();await db.initializeAll();
  assert.equal((await db.queryGet('events',"SELECT COUNT(*) n FROM events WHERE source='fixture'")).n,1);
  const restored=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'restore-state/storage.json')));assert.equal(restored.lsip_language,'tr');assert.equal(restored.lsip_case_workspace_v1,null);
  assert.equal((await vault.verifyEvidence({id:acquired.id})).verified,true);
  assert.equal((await library.listRules({kind:'Hunt'})).length,2);
  assert(fs.readdirSync(path.join(app.getPath('userData'),'.restore-rollback')).length>0);
 });
 await test('Yarıda kesilen geri yükleme önceki verileri geri getirir',async()=>{
  await put(3);await stageRestore(backup.directory,password);await db.closeAll();const userData=app.getPath('userData'),marker=path.join(userData,'pending-restore.json'),job=JSON.parse(fs.readFileSync(marker));const rollback=path.join(userData,'.restore-rollback',job.id);fs.mkdirSync(rollback,{recursive:true});job.phase='applying';job.absent=[];fs.writeFileSync(marker,JSON.stringify(job));
  fs.renameSync(path.join(userData,'databases'),path.join(rollback,'databases'));fs.renameSync(path.join(userData,'.restore',job.id,'databases'),path.join(userData,'databases'));
  applyPendingRestore();await db.initializeAll();assert.equal((await db.queryGet('events',"SELECT COUNT(*) n FROM events WHERE source='fixture'")).n,2);
 });
 await db.closeAll();clearTimeout(timeout);fs.writeFileSync(path.join(root,'security-audit/backup-integration.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));app.exit(results.some(r=>!r.pass)?1:0);
}).catch(error=>{console.error(error);clearTimeout(timeout);app.exit(1)});
