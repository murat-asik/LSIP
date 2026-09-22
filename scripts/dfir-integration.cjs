// Uses an isolated profile and harmless fixture; never modifies original evidence.
const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'tmp','dfir-integration',crypto.randomUUID());
fs.mkdirSync(scratch,{recursive:true});app.setAppPath(root);app.setPath('userData',path.join(scratch,'profile'));app.disableHardwareAcceleration();
const results=[];let db,window,dfirModule;
const timer=setTimeout(()=>app.exit(1),180000);
app.whenReady().then(async()=>{
 db=require('../dist/main/core/database-manager').databaseManager;await db.ready;
 dfirModule=new(require('../dist/main/modules/dfir/dfir.module').DfirModule)();await dfirModule.initialize();
 const fixture=path.join(scratch,'fixture.html');fs.writeFileSync(fixture,'<!doctype html><p>DFIR integration</p>');
 window=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'dist/preload/index.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
 require('../dist/main/core/security').trustRenderer(window.webContents,pathToFileURL(fixture).href);await window.loadFile(fixture);
 const invoke=(channel,payload)=>window.webContents.executeJavaScript(`window.lsip.invoke(${JSON.stringify(channel)},${JSON.stringify(payload)})`);
 const dashboard=new(require('../dist/main/modules/dashboard/dashboard.module').DashboardModule)();await dashboard.initialize();
 assert.equal((await invoke('dashboard:stats',{})).data.riskScore,null);await dashboard.shutdown();results.push('Missing risk telemetry stays unknown');
 const source=path.join(scratch,'evidence.txt'),content=Buffer.from('LSIP_FIXTURE — Türkçe kanıt\n');fs.writeFileSync(source,content);
 const response=await invoke('dfir:acquire-evidence',{sourcePath:source,title:'Integration fixture'});assert.equal(response.success,true,JSON.stringify(response));
 const acquired=response.data;assert.equal(acquired.hash,crypto.createHash('sha256').update(content).digest('hex'));assert.deepEqual(fs.readFileSync(source),content);
 const blob=path.join(app.getPath('userData'),'evidence-vault',acquired.id+'.aes');assert.notDeepEqual(fs.readFileSync(blob),content);results.push('Encrypted acquisition and source preservation');
 assert.equal((await invoke('dfir:verify-evidence',{id:acquired.id})).data.verified,true);results.push('Stored copy SHA-256 verification');
 const chain=await db.queryAll('dfir','SELECT * FROM dfir_chain_of_custody WHERE evidence_id=?',[acquired.id]);assert.equal(chain.length,2);results.push('Acquisition and verification custody records');
 const bytes=fs.readFileSync(blob);bytes[0]^=1;fs.writeFileSync(blob,bytes);assert.equal((await invoke('dfir:verify-evidence',{id:acquired.id})).success,false);results.push('Tampered ciphertext rejected');
 const registry=await invoke('dfir:analyze-artifact',{type:'registry',source:'local'});assert.equal(registry.success,true,JSON.stringify(registry));assert.ok(Array.isArray(registry.data.records));results.push('Live registry: '+registry.data.records.length+' real values');
 assert.equal((await invoke('dfir:analysis-history',{type:'registry'})).data.length,1);results.push('Forensic history persisted');
 assert.equal((await invoke('dfir:analyze-artifact',{type:'registry',source:'local'})).success,true);assert.equal((await invoke('dfir:analysis-history',{type:'registry'})).data.length,2);results.push('Repeated analysis preserves previous source snapshot');
 const collection=path.join(scratch,'collection');fs.mkdirSync(path.join(collection,'Windows/System32/config'),{recursive:true});
 const recycle=path.join(collection,'$Recycle.Bin','S-1-5-21-123-456-789-1001');fs.mkdirSync(recycle,{recursive:true});
 const deletedPath='C:\\Users\\Fixture\\deleted.txt\0',header=Buffer.alloc(28+deletedPath.length*2);
 header.writeBigInt64LE(2n,0);header.writeBigInt64LE(123n,8);header.writeBigInt64LE(133801632000000000n,16);header.writeUInt32LE(deletedPath.length,24);header.write(deletedPath,28,'utf16le');fs.writeFileSync(path.join(recycle,'$ITEST01.txt'),header);
 const parsed=await invoke('dfir:analyze-artifact',{type:'recycle',source:collection});assert.equal(parsed.success,true,JSON.stringify(parsed));assert.equal(parsed.data.records.length,1);assert.equal(parsed.data.records[0].filesize,123);assert.equal(parsed.data.records[0].path,deletedPath.slice(0,-1));results.push('Dissect binary artifact parsed through IPC');
 const ioc=new(require('../dist/main/modules/ioc-scanner/ioc-scanner.module').IocScannerModule)();await ioc.initialize();
 await db.queryRun('events','INSERT INTO events(event_id,source,level,timestamp,message,parsed_data) VALUES(?,?,?,?,?,?)',[4688,'Security',4,Date.now(),'Harmless fixture',JSON.stringify({Image:'C:\\Windows\\powershell.exe',CommandLine:'powershell.exe -EncodedCommand harmless'})]);
 const sigma='logsource:\n  category: process_creation\n  product: windows\ndetection:\n  selection:\n    CommandLine|contains: harmless\n  condition: selection';
 assert.equal((await invoke('ioc:evaluate-rule',{kind:'Sigma',content:sigma})).data.matchesCount,1);
 assert.equal((await invoke('ioc:evaluate-rule',{kind:'Hunt',content:'EventID=4688 AND CommandLine CONTAINS "absent"'})).data.matchesCount,0);await ioc.shutdown();results.push('Sigma and Hunt worker execution through IPC');
 const {scanYara}=require('../dist/main/modules/ioc-scanner/yara-service');
 const rule='rule harmless_fixture { strings: $a="LSIP_FIXTURE" condition: $a }';
 assert.equal((await scanYara(rule,source)).matchesCount,1);assert.equal((await scanYara(rule.replace('LSIP_FIXTURE','ABSENT_STRING'),source)).matchesCount,0);
 await assert.rejects(()=>scanYara('not a rule',source));results.push('YARA-X positive, negative and malformed rule');
 const fim=new(require('../dist/main/modules/fim/fim.module').FimModule)();await fim.initialize();
 const fimDir=path.join(scratch,'fim');fs.mkdirSync(fimDir);const watched=path.join(fimDir,'watched.txt');fs.writeFileSync(watched,'before');
 assert.equal((await invoke('fim:scan',{path:fimDir,pattern:'*.txt'})).data.length,1);fs.writeFileSync(watched,'after');
 assert.equal((await invoke('fim:scan',{path:fimDir,pattern:'*.txt'})).data[0].status,'modified');
 assert.equal((await invoke('fim:changes',{})).data.length,1);await fim.shutdown();results.push('FIM baseline and actual file modification');
 const reports=new(require('../dist/main/modules/report-generator/report-generator.module').ReportGeneratorModule)();await reports.initialize();
 const {dialog}=require('electron'),savedDialog=dialog.showSaveDialog;
 try{
  for(const format of ['json','csv','html','pdf']){
   const destination=path.join(scratch,'report.'+format);dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});
   const response=await invoke('reports:generate',{format,includeSystemInfo:true,includeReputation:true,includeAnomalies:true,includeConnections:true,includeTimeline:true});assert.equal(response.data?.success,true,JSON.stringify(response));
   const bytes=fs.readFileSync(destination);assert.ok(bytes.length>100);if(format==='json')assert.ok(JSON.parse(bytes).systemInfo.logicalCpuCount>0);if(format==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  }
 }finally{dialog.showSaveDialog=savedDialog;await reports.shutdown();}
 results.push('JSON, CSV, HTML and real Chromium PDF reports');
 await dfirModule.shutdown();await dfirModule.initialize();assert.equal((await invoke('dfir:get-evidence',{})).success,true);results.push('DFIR shutdown and reactivation without duplicate handlers');
 fs.writeFileSync(path.join(root,'security-audit/dfir-integration.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify(results));
 await dfirModule.shutdown();await db.closeAll();window.destroy();clearTimeout(timer);app.exit(0);
}).catch(error=>{console.error(error);fs.writeFileSync(path.join(root,'security-audit/dfir-integration.json'),JSON.stringify({passed:false,results,error:error.stack},null,2));clearTimeout(timer);app.exit(1)});



