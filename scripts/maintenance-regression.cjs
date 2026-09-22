const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {DatabaseSync}=require('node:sqlite');const {env}=require('./security-audit.cjs');const results=[];
async function test(name,fn){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.stack})}}
(async()=>{
 await test('3500 olay iki tur ve yeniden başlatma boyunca kayıpsız toplanır',async()=>{
  const db=new DatabaseSync(':memory:');const schema=fs.readFileSync('src/main/core/database-manager.ts','utf8').match(/CREATE TABLE IF NOT EXISTS events \([\s\S]+?\);/)[0];db.exec(schema+'CREATE UNIQUE INDEX identity ON events(event_key);CREATE TABLE event_cursors(channel TEXT PRIMARY KEY,record_id TEXT,timestamp TEXT);');
  const pages={eventChannels:['System'],readEventPage:async(channel,cursor)=>{const after=Number(cursor?.record_id||0);const events=Array.from({length:Math.min(500,3500-after)},(_,i)=>({eventId:1,source:channel,recordId:String(after+i+1),timestamp:1000+after+i,computer:'fixture',message:'test',level:4}));const last=after+events.length;return{events,cursor:{record_id:String(last),timestamp:String(last)},more:events.length===500}}};
  const e=env({'./event-pages':pages});e.db.queryGet=async(_n,sql,p=[])=>db.prepare(sql).get(...p);e.db.queryRun=async(_n,sql,p=[])=>db.prepare(sql).run(...p);e.db.atomicBatch=async(_n,statements)=>{db.exec('BEGIN');try{for(const s of statements)db.prepare(s.sql).run(...s.params);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}};
  const {EventExplorerModule}=e.load('src/main/modules/event-explorer/event-explorer.module.ts');const first=new EventExplorerModule();first.rotateDatabase=async()=>{};await first.syncPages();assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,2000);
  const next=new EventExplorerModule();next.rotateDatabase=async()=>{};await next.syncPages();assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,3500);await next.syncPages();assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,3500);db.close();
 });
 await test('Başarısız toplama imleci ilerletmez ve kanal hatası görünür olur',async()=>{
  let writes=0;const e=env({'./event-pages':{eventChannels:['System'],readEventPage:async()=>{throw new Error('access denied')}}});e.db.atomicBatch=async()=>writes++;
  const {EventExplorerModule}=e.load('src/main/modules/event-explorer/event-explorer.module.ts');const m=new EventExplorerModule();await assert.rejects(()=>m.syncPages(),/No event channel/);assert.equal(writes,0);assert.equal(m.channelStatus.System.error,'access denied');
 });
 await test('PowerShell hata, kısmi veri, boş ve bozuk JSON durumları ayrılır',async()=>{
  for(const fixture of [{stdout:'[]',stderr:'',state:'empty'},{stdout:'[{"x":1}]',stderr:'access denied',state:'partial'},{stdout:'[]',stderr:'access denied',state:'error'},{stdout:'broken',stderr:'',state:'error'}]){
   const e=env({child_process:{execFile:(_file,_args,_options,cb)=>cb(null,fixture.stdout,fixture.stderr)}});const h=e.load('src/main/core/collector-health.ts');await new Promise(resolve=>h.trackedPowerShell('fixture')('test',()=>resolve()));assert.equal(h.getCollectorHealth()[0].state,fixture.state);
  }
 });
 await test('İşletim sistemi komut hatası boş sonuçtan ayrılır',async()=>{
  const e=env({child_process:{exec:(_command,_options,cb)=>cb(new Error('denied'),'','')}});const h=e.load('src/main/core/collector-health.ts');await new Promise(resolve=>h.trackedExec('fixture')('query',()=>resolve()));assert.equal(h.getCollectorHealth()[0].state,'error');
 });
 fs.writeFileSync('security-audit/maintenance-regression.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));process.exitCode=results.some(r=>!r.pass)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
