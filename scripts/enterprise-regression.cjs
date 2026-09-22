const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { env } = require('./security-audit.cjs');
const results = [];
async function test(name, run) { try { await run(); results.push({name,pass:true}); } catch(e) { results.push({name,pass:false,error:e.stack}); } }
function store(seed={}, fail=false) {
 const data=new Map(Object.entries(seed));
 const code=ts.transpileModule(fs.readFileSync('src/renderer/stores/case-management.store.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require:()=>({create:init=>{let state;const get=()=>state;state=init(p=>{state={...state,...p}},get);return{getState:get}}}),crypto:require('node:crypto').webcrypto,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(fail)throw new Error('QuotaExceededError');data.set(k,v)}}});
 return {data,get:exports.useCaseManagementStore.getState};
}
const item={title:'Case',description:'',severity:'Low',status:'Open',tags:[],iocs:[],evidence:[],timeline:[],mitreMappings:[],aiNotes:[],analystNotes:''};
(async()=>{
 await test('Bozuk JSON özgün kayıtları korur ve yazmayı engeller',()=>{const e=store({lsip_v3_cases:'{broken'});assert.equal(e.get().storageError,'recovery');assert.throws(()=>e.get().createCase(item));assert.equal(e.data.get('lsip_v3_cases'),'{broken');});
 await test('Geçerli JSON null/yanlış şema açılışı çökertmez',()=>{for(const raw of ['null','{}','[{}]']){const e=store({lsip_v3_cases:raw});assert.equal(e.get().cases.length,0);assert.equal(e.get().storageError,'recovery');}});
 await test('Bozuk IOC koleksiyonu sağlam vakayı silmez',()=>{const e=store({lsip_v3_cases:JSON.stringify([{...item,id:'case',createdAt:1,updatedAt:1}]),lsip_v3_iocs:'null'});assert.equal(e.get().cases.length,1);assert.throws(()=>e.get().createCase(item));});
 await test('Vaka ve kanıt tek atomik kayıtta yeniden açılır',()=>{const e=store();const c=e.get().createCase(item);e.get().addEvidenceToCase(c.id,{type:'file',name:'x',source:'x',sha256:'abc',md5:'',collector:'test',custodyChain:[],integrityVerified:false});const next=store(Object.fromEntries(e.data));assert.equal(next.get().cases[0].evidence[0].id,next.get().globalEvidenceLocker[0].id);assert.equal(e.data.size,1);});
 await test('Kota hatası bellekte başarılı kayıt göstermiyor',()=>{const e=store({},true);assert.throws(()=>e.get().createCase(item));assert.equal(e.get().cases.length,0);assert.equal(e.get().storageError,'write');assert.equal(e.data.size,0);});
 await test('Var olmayan vakaya yetim kanıt eklenmez',()=>{const e=store();assert.throws(()=>e.get().addEvidenceToCase('missing',{}));assert.equal(e.data.size,0);});
 await test('Uyku aralıkları durdurur; eşzamanlı uyanma tek zamanlayıcı kurar; kapanış temizler',async()=>{
 const e=env({globals:{setInterval,clearInterval}});const {BaseModule}=e.load('src/main/modules/base-module.ts');let calls=0;
 class Mod extends BaseModule {name='fixture';displayName='fixture';async initialize(){this.registerInterval(10,()=>calls++)}async shutdown(){this.unregisterIpcHandlers()}}
 const m=new Mod();try{await m.initialize();m.setActive();await new Promise(r=>setTimeout(r,35));assert(calls>0);await m.sleep();const before=calls;await new Promise(r=>setTimeout(r,35));assert.equal(calls,before);await Promise.all([m.wake(),m.wake()]);assert.equal(m.timerCount,1);await m.shutdown();assert.equal(m.timerCount,0);}finally{await m.shutdown()}
 });
 await test('PID yeniden kullanımı gerçek SQLite üzerinde bilgileri ve başlangıç geçmişini yeniler',async()=>{
 const e=env();const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE processes(pid INTEGER PRIMARY KEY,ppid,name,path,command_line,user,integrity_level,token_elevation,is_signed,signature_status,first_seen,last_seen,is_running,creation_time); CREATE TABLE process_history(pid,ppid,name,action,timestamp,user,command_line)');
 const adapt=v=>v===undefined?null:v;
 e.db.queryAll=async(_n,sql,p=[])=>db.prepare(sql).all(...p.map(adapt));e.db.queryGet=async(_n,sql,p=[])=>db.prepare(sql).get(...p.map(adapt));e.db.queryRun=async(_n,sql,p=[])=>db.prepare(sql).run(...p.map(adapt));
 const {ProcessExplorerModule}=e.load('src/main/modules/process-explorer/process-explorer.module.ts');const m=new ProcessExplorerModule();
 const p={pid:123,ppid:1,name:'old',path:'old',commandLine:'old',user:'old',integrityLevel:'Unknown',isElevated:false,isSigned:false,signatureStatus:'Unknown',creationTime:100};
 await m.syncSnapshotToDb([p]);await m.syncSnapshotToDb([{...p,name:'new',path:'new',creationTime:200}]);assert.equal(db.prepare('SELECT name FROM processes').get().name,'new');assert.deepEqual(db.prepare('SELECT action FROM process_history').all().map(r=>r.action),['start','stop','start']);db.close();
 });
 await test('DNS toplam başarısızlık boş başarıya dönüşmez',async()=>{
 class Resolver{constructor(){for(const n of ['resolve4','resolve6','resolveMx','resolveTxt','resolveNs','resolveCaa','resolveSoa'])this[n]=async()=>{throw Object.assign(new Error('fail'),{code:'ETIMEOUT'})}}}
 const e=env({dns:{promises:{Resolver}},http:{},https:{},tls:{}});const {RedTeamModule}=e.load('src/main/modules/redteam/redteam.module.ts');const m=new RedTeamModule();await m.initialize();const r=await e.handlers.get('redteam:get-dns-intelligence')(e.event,{domain:'example.com'});assert.equal(r.success,false);assert.match(r.error,/ETIMEOUT/);await m.shutdown();
 });
 await test('Uzak IP yerel Windows olayları ve tüm süreçler nedeniyle suçlanmaz',async()=>{
 const e=env();e.db.queryGet=async(n,sql)=>{e.queries.push([n,sql]);return{cnt:1}};const {ReputationCalculator}=e.load('src/main/modules/reputation-engine/reputation-calculator.ts');const r=await ReputationCalculator.calculateHostReputation('203.0.113.42');assert.equal(r.riskScore,0);assert(!e.queries.some(([n])=>n==='events'||n==='process'));
 });
 await test('Telemetri yoksa risk sıfır olarak sunulmaz',async()=>{const e=env();const {ReputationCalculator}=e.load('src/main/modules/reputation-engine/reputation-calculator.ts');await assert.rejects(()=>ReputationCalculator.calculateHostReputation('203.0.113.42'),/telemetry/)});
 await test('RDAP yetkili hizmeti seçer ve başka alan adının yanıtını reddeder',async()=>{
  let wrong=false;const calls=[];const e=env({'../internet-intelligence/http-client':{httpClient:{request:async url=>{calls.push(url);return{data:url.includes('data.iana.org')?{services:[[['com'],['https://registry.example/rdap/']]]}:{objectClassName:'domain',ldhName:wrong?'other.com':'example.com'}}}}}});
  const {lookupRegistration}=e.load('src/main/modules/redteam/rdap-service.ts');assert.equal((await lookupRegistration('example.com')).data.ldhName,'example.com');assert.equal(calls[1],'https://registry.example/rdap/domain/example.com');wrong=true;await assert.rejects(()=>lookupRegistration('example.com'),/does not match/);
 });
 await test('RDAP HTTPS olmayan hizmete sorgu göndermez',async()=>{
  let calls=0;const e=env({'../internet-intelligence/http-client':{httpClient:{request:async()=>{calls++;return{data:{services:[[['com'],['http://registry.example/']]]}}}}}});const {lookupRegistration}=e.load('src/main/modules/redteam/rdap-service.ts');await assert.rejects(()=>lookupRegistration('example.com'),/No HTTPS/);assert.equal(calls,1);
 });
 fs.writeFileSync('security-audit/enterprise-regression.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));process.exitCode=results.some(r=>!r.pass)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
