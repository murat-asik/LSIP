const { env } = require('./security-audit.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const results=[];
async function test(name,fn) { try { await fn(); results.push({name,pass:true}); } catch(error) { results.push({name,pass:false,error:error.stack}); } }
async function run() {
  await test('Geçerli PID: gerçek handler execFile argümanlarını korur',async()=>{
    const e=env();const {ProcessExplorerModule}=e.load('src/main/modules/process-explorer/process-explorer.module.ts');
    await new ProcessExplorerModule().initialize();
    const res=await e.handlers.get('process:terminate')(e.event,{pid:42});
    assert.equal(res.success,true);assert.equal(res.data,true);assert.equal(e.commands.length,0);
    assert.deepEqual(Array.from(e.fileCommands[0].argv),['/F','/PID','42']);
    for(const pid of [null,{},[],0,-1,1.2,Infinity,'42','42 & echo x']) {
      const before=e.fileCommands.length;
      const bad=await e.handlers.get('process:terminate')(e.event,{pid});
      assert.equal(bad.success,false);assert.equal(e.fileCommands.length,before);
    }
  });
  await test('Güvenilir ana frame kabul; alt frame ve değişmiş URL ret',async()=>{
    const e=env();const guard=e.load('src/main/core/security.ts');
    guard.assertTrustedSender(e.event);
    assert.throws(()=>guard.assertTrustedSender({...e.event,senderFrame:{...e.event.senderFrame,parent:e.event.senderFrame}}));
    e.event.senderFrame.url='https://untrusted.invalid';assert.throws(()=>guard.assertTrustedSender(e.event));
  });
  await test('Anahtar şifreli saklanır, arka planda çözülür, public DTO gizlidir',async()=>{
    const e=env();const {secureConfigManager:m}=e.load('src/main/modules/internet-intelligence/secure-config.ts');
    m.saveProviderConfig({id:'fixture',apiKey:'SYNTHETIC-KEY',enabled:true});
    assert.equal(m.getProviderCredentials('fixture').apiKey,'SYNTHETIC-KEY');
    assert.equal(m.getProviderConfig('fixture').apiKey,undefined);assert.equal(m.getProviderConfig('fixture').configured,true);
    m.saveProviderConfig({id:'fixture',enabled:false});
    assert.equal(m.getProviderCredentials('fixture').enabled,false);assert.equal(m.getProviderCredentials('fixture').apiKey,'SYNTHETIC-KEY');
    assert(!JSON.stringify(e.config).includes('SYNTHETIC-KEY'));
    m.removeApiKey('fixture');assert.equal(m.getProviderConfig('fixture').configured,false);
  });
  await test('Şifreleme yoksa kaydetme başarısız, açık anahtar diske gitmez',async()=>{
    const e=env();e.electron.safeStorage.isEncryptionAvailable=()=>false;
    const {secureConfigManager:m}=e.load('src/main/modules/internet-intelligence/secure-config.ts');
    assert.throws(()=>m.saveProviderConfig({id:'fixture',apiKey:'SYNTHETIC-KEY',enabled:true}));
    assert(!JSON.stringify(e.config).includes('SYNTHETIC-KEY'));
  });
  await test('Eski açık anahtar güvenli depoya taşınır',async()=>{
    const e=env();e.config.providers.fixture={enabled:false,rawApiKey:'SYNTHETIC-LEGACY'};
    const {secureConfigManager:m}=e.load('src/main/modules/internet-intelligence/secure-config.ts');
    assert.equal(m.getProviderCredentials('fixture').apiKey,'SYNTHETIC-LEGACY');
    assert.equal(m.getProviderCredentials('fixture').enabled,false);
    assert(!JSON.stringify(e.config).includes('SYNTHETIC-LEGACY'));
  });
  await test('HTTP: normal JSON korunur, gövde sınırı uygulanır',async()=>{
    let huge=false;
    const e=env({globals:{fetch:async()=>huge ? new Response('x',{headers:{'content-length':String(9*1024*1024)}}) : new Response(JSON.stringify({result:42}),{headers:{'content-type':'application/json'}})}});
    const {httpClient}=e.load('src/main/modules/internet-intelligence/http-client.ts');
    assert.equal((await httpClient.request('https://fixture.invalid',{retries:0})).data.result,42);
    huge=true;await assert.rejects(httpClient.request('https://fixture.invalid',{retries:0}));
  });
  await test('HTTP: offline durumda fetch çağrılmaz',async()=>{
    let calls=0;const e=env({globals:{fetch:async()=>{calls++;return new Response('{}');}}});e.config.offlineMode=true;
    const {httpClient}=e.load('src/main/modules/internet-intelligence/http-client.ts');
    await assert.rejects(httpClient.request('https://fixture.invalid'));assert.equal(calls,0);
  });
  await test('HTTP: bağlantı kapatma devam eden isteği iptal eder',async()=>{
    let signal;const e=env({globals:{fetch:async(_u,o)=>{signal=o.signal;return new Promise(()=>{});}}});
    const {httpClient}=e.load('src/main/modules/internet-intelligence/http-client.ts');
    const pending=httpClient.request('https://fixture.invalid',{retries:0});
    e.bus.publish('connectivity:changed',{isOnlineMode:false});
    await assert.rejects(pending);assert.equal(signal.aborted,true);
  });
  await test('HTML/CSV normal metin korunur ve enjeksiyon metinleşir',async()=>{
    const e=env({'fs/promises':{}});const {ReportGeneratorModule}=e.load('src/main/modules/report-generator/report-generator.module.ts');const m=new ReportGeneratorModule();
    const html=m.generateHtml({metadata:{hostname:'Şirket & <sunucu>'}});
    assert(html.includes('Şirket &amp; &lt;sunucu&gt;'));assert(!html.includes('<script>'));
    for(const value of ['=1+1','+1','-1','@SUM(A1)','\t=1','\r=1']) {
      const csv=m.generateCsv({metadata:{},activeConnections:[{process_name:value}]});assert(csv.includes("'"+value));
    }
    assert(m.generateCsv({metadata:{hostname:'İstanbul'}}).includes('İstanbul'));
  });
  await test('Saldırı yüzeyi yalnız kayıtlı hedef verisini döndürür',async()=>{
    const e=env({net:{},tls:{},dns:{},http:{},https:{}});
    e.db.queryGet=async()=>({id:'scan-fixture',completed_at:123});
    e.db.queryAll=async(_db,sql)=>sql.includes('redteam_ports')?[{port:443,service:'HTTPS'}]:[{target_url:'https://fixture.invalid',hsts:0,csp:1},{target_url:'https://different.invalid',hsts:0,csp:0}];
    const {RedTeamModule}=e.load('src/main/modules/redteam/redteam.module.ts');await new RedTeamModule().initialize();
    const res=await e.handlers.get('redteam:get-attack-surface')(e.event,{target:'fixture.invalid'});
    assert.equal(res.success,true);assert.equal(res.data.nodes.length,2);assert.equal(res.data.misconfigurations.length,1);assert.equal(res.data.cveMatches.length,0);
  });
  await test('Preload çalışan tüm renderer çağrılarını ve main eylemlerini içerir',async()=>{
    let bridge;const e=env({electron:{contextBridge:{exposeInMainWorld:(_n,v)=>bridge=v},ipcRenderer:{invoke:async c=>c}}});
    e.load('src/preload/index.ts');
    function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(dir,d.name)):[path.join(dir,d.name)]); }
    const calls=new Set();for(const f of files(path.join(root,'src/renderer'))) for(const m of fs.readFileSync(f,'utf8').matchAll(/lsip\.invoke\('([^']+)'/g))calls.add(m[1]);
    for(const channel of calls) assert.equal(await bridge.invoke(channel),channel);
    await assert.rejects(bridge.invoke('process:new-unapproved-action'));
  });
  await test('Gerçek FIM: Türkçe, boşluk, tek tırnak ve alt ifade içeren literal yol',async()=>{
    const base=path.join(root,'security-audit','fixtures');fs.mkdirSync(base,{recursive:true});
    const dir=path.join(base,"Şirket ' $(Write-Output LSIP_LITERAL) dosyalar");fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,'örnek.txt');fs.writeFileSync(file,'Yalnızca sentetik test verisi.');
    const e=env({'fs/promises':require('node:fs/promises')});const {FimScanner}=e.load('src/main/modules/fim/fim-scanner.ts');
    const rows=await FimScanner.scanDirectory({path:dir,patterns:['*.txt'],recursive:false},10);
    assert.equal(rows.length,1);assert.equal(rows[0].filePath.toLowerCase(),file.toLowerCase());
    assert.equal(rows[0].hashSha256.toLowerCase(),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  });
  await test('Gerçek dosya: delil hash ve kayıt durumu',async()=>{
    const file=path.join(root,'security-audit','fixtures','evidence.txt');fs.writeFileSync(file,'sentetik delil');
    const e=env({fs});const {DfirModule}=e.load('src/main/modules/dfir/dfir.module.ts');await new DfirModule().initialize();
    const res=await e.handlers.get('dfir:add-evidence')(e.event,{title:'Test',type:'file',sourcePath:file});
    assert.equal(res.success,true);assert.equal(res.data.hash,crypto.createHash('sha256').update('sentetik delil').digest('hex'));
    assert.equal(e.queries.find(q=>q[1].includes('INSERT INTO dfir_evidence'))[2][6],'hashed');
  });
  await test('Ölçüm yoksa AI risk puanı üretmez ve UI gerçek özeti gösterir',async()=>{
    const e=env();const {AiAnalystModule}=e.load('src/main/modules/ai-analyst/ai-analyst.module.ts');await new AiAnalystModule().initialize();
    const res=await e.handlers.get('ai-analyst:analyze')(e.event);
    assert.equal(res.success,true);assert.equal(res.data.riskLevel,'UNKNOWN');assert.equal(res.data.riskScore,null);
    const ui=fs.readFileSync(path.join(root,'src/renderer/views/AiAnalystView.tsx'),'utf8');
    assert(ui.includes('{message(summary.executiveSummary)}'));assert(!ui.includes('totalExposedPorts: 5'));
  });
  await test('Her AI veri kaynağının hatası boş veya temiz sonuca dönüşmez',async()=>{
    for(let failed=0;failed<6;failed++) {
      const e=env();let query=0;e.db.queryAll=async()=>{if(query++===failed)throw new Error('synthetic database failure');return [];};
      const {AiAnalystModule}=e.load('src/main/modules/ai-analyst/ai-analyst.module.ts');await new AiAnalystModule().initialize();
      const res=await e.handlers.get('ai-analyst:analyze')(e.event);assert.equal(res.success,false);assert.equal(res.data,undefined);
    }
  });
  fs.writeFileSync(path.join(root,'security-audit','regression-results.json'),JSON.stringify({total:results.length,passed:results.filter(r=>r.pass).length,results},null,2));
  console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.pass))process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=2;});
