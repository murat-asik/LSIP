const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'tmp','enterprise-integration',crypto.randomUUID());
fs.mkdirSync(scratch,{recursive:true});app.setAppPath(root);app.setPath('userData',path.join(scratch,'profile'));app.disableHardwareAcceleration();
const results=[];let db,window,plugins,fim;
const deadline=setTimeout(()=>app.exit(1),120000);
async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}}
app.whenReady().then(async()=>{
 db=require('../dist/main/core/database-manager').databaseManager;await db.ready;
 const fixture=path.join(scratch,'fixture.html');fs.writeFileSync(fixture,'<!doctype html><p>Enterprise integration</p>');
 window=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'dist/preload/index.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
 require('../dist/main/core/security').trustRenderer(window.webContents,pathToFileURL(fixture).href);await window.loadFile(fixture);
 const invoke=(channel,payload)=>window.webContents.executeJavaScript(`window.lsip.invoke(${JSON.stringify(channel)},${JSON.stringify(payload)})`);
 plugins=new(require('../dist/main/modules/plugin-system/plugin-system.module').PluginSystemModule)();await plugins.initialize();
 const folder=path.join(app.getPath('userData'),'plugins');
 await test('Eklenti klasörü sahte örnek üretmez',async()=>{assert.equal(fs.readdirSync(folder).length,0)});
 const marker=path.join(scratch,'should-not-exist');
 fs.writeFileSync(path.join(folder,'untrusted.js'),`require('fs').writeFileSync(${JSON.stringify(marker)},'bad');module.exports={};`);
 await test('Güvenilmeyen eklenti kodu çalıştırılmaz',async()=>{assert.equal((await invoke('plugins:rescan')).success,true);assert.equal(fs.existsSync(marker),false);const s=await invoke('plugins:summary');assert.equal(s.data.plugins[0].status,'disabled')});
 const stopped=path.join(scratch,'shutdown.txt');
 const good=`module.exports={id:'fixture',name:'Fixture',init:async()=>{},shutdown:async()=>require('fs').appendFileSync(${JSON.stringify(stopped)},'stopped')};`;
 fs.writeFileSync(path.join(folder,'good.js'),good);
 fs.writeFileSync(path.join(folder,'trusted-plugins.json'),JSON.stringify({'good.js':crypto.createHash('sha256').update(good).digest('hex')}));
 await test('Güvenilen eklenti başlar; yeniden tarama öncekini kapatır',async()=>{await invoke('plugins:rescan');assert.equal((await invoke('plugins:summary')).data.activePlugins,1);await invoke('plugins:rescan');assert(fs.readFileSync(stopped,'utf8').includes('stopped'));assert.equal((await invoke('plugins:summary')).data.activePlugins,1)});
 await test('Hash değişince daha önce güvenilen eklenti çalışmaz',async()=>{fs.appendFileSync(path.join(folder,'good.js'),'\n// modified');await invoke('plugins:rescan');assert.equal((await invoke('plugins:summary')).data.activePlugins,0)});
 const bad="module.exports={init:async()=>{throw new Error('fixture-rejection')}}";
 fs.writeFileSync(path.join(folder,'bad.js'),bad);fs.writeFileSync(path.join(folder,'trusted-plugins.json'),JSON.stringify({'bad.js':crypto.createHash('sha256').update(bad).digest('hex')}));
 await test('Asenkron eklenti başlangıç hatası başarı olarak görünmez',async()=>{await invoke('plugins:rescan');const s=await invoke('plugins:summary');assert.equal(s.data.errorPlugins,1);assert.equal(s.data.activePlugins,0)});
 fim=new(require('../dist/main/modules/fim/fim.module').FimModule)();await fim.initialize();
 const watched=path.join(scratch,'watched');fs.mkdirSync(watched);const file=path.join(watched,'evidence.txt');fs.writeFileSync(file,'first');
 await test('FIM değişikliği, silinmeyi ve yeniden oluşturmayı gerçek dosyada izler',async()=>{
  let r=await invoke('fim:scan',{path:watched,pattern:'*.txt'});assert.equal(r.success,true);assert.equal(r.data.length,1);
  fs.writeFileSync(file,'second');r=await invoke('fim:scan',{path:watched,pattern:'*.txt'});assert.equal(r.data[0].status,'modified');
  fs.unlinkSync(file);r=await invoke('fim:scan',{path:watched,pattern:'*.txt'});assert.equal(r.success,true);
  let changes=(await invoke('fim:changes')).data;assert.equal(changes.filter(c=>c.changeType==='deleted').length,1);
  await invoke('fim:scan',{path:watched,pattern:'*.txt'});changes=(await invoke('fim:changes')).data;assert.equal(changes.filter(c=>c.changeType==='deleted').length,1);
  fs.writeFileSync(file,'second');await invoke('fim:scan',{path:watched,pattern:'*.txt'});changes=(await invoke('fim:changes')).data;assert.equal(changes.filter(c=>c.changeType==='created').length,1);
 });
 await test('Olay kimliği kanallar arası zaman sırasından bağımsız, tekrarları engeller',async()=>{
  const {eventIdentity}=require('../dist/main/core/event-identity');
  const insert=async(channel,recordId,time)=>db.queryRun('events','INSERT OR IGNORE INTO events(event_id,source,level,timestamp,event_key) VALUES(?,?,?,?,?)',[1,channel,4,time,eventIdentity('host',channel,recordId,time,1,'')]);
  await insert('FixtureA','1',200);await insert('FixtureB','1',100);await insert('FixtureA','1',200);await insert('FixtureA','2',200);
  assert.equal((await db.queryGet('events',"SELECT COUNT(*) AS cnt FROM events WHERE source LIKE 'Fixture%' ")).cnt,3);
 });
 await fim.shutdown();await plugins.shutdown();await db.closeAll();window.destroy();clearTimeout(deadline);
 fs.writeFileSync(path.join(root,'security-audit/enterprise-integration.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));app.exit(results.some(r=>!r.pass)?1:0);
}).catch(e=>{console.error(e);clearTimeout(deadline);app.exit(1)});
