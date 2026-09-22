// Real installed builds and development code share only this isolated test profile.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),net=require('net'),assert=require('assert/strict'),{spawn}=require('child_process'),os=require('os');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'tmp','upgrade-acceptance',crypto.randomUUID()),profile=path.join(scratch,'profile');fs.mkdirSync(scratch,{recursive:true});
const caseItem={id:'upgrade-fixture',title:'UPGRADE_CANARY_Şirket',description:'Synthetic acceptance record',severity:'Low',status:'Open',tags:[],iocs:[],evidence:[],timeline:[],mitreMappings:[],aiNotes:[],analystNotes:'Preserve',createdAt:1,updatedAt:1};
const workspace=JSON.stringify({version:1,data:{cases:[caseItem],iocKnowledgeBase:{},globalEvidenceLocker:[]}}),results=[];
async function run(version,seed=false){
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
 const executable=version==='development'?path.join(root,'node_modules/electron/dist/electron.exe'):path.join(root,'release',version,'win-unpacked','LSIP v3.0.exe');assert(fs.existsSync(executable),'Required build absent: '+version);
 const args=[...(version==='development'?[root]:[]),'--user-data-dir='+profile,'--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port],env={...process.env,NODE_ENV:'production'};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(executable,args,{cwd:root,env,windowsHide:true,stdio:'ignore'});let browser;
 try{
  const deadline=Date.now()+60000;let endpoint;
  while(Date.now()<deadline){try{endpoint=(await(await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;if(endpoint)break}catch{}await new Promise(r=>setTimeout(r,200))}
  assert(endpoint,'Startup timed out: '+version);browser=await(await import('puppeteer')).connect({browserWSEndpoint:endpoint});let page;
  while(Date.now()<deadline){page=(await browser.pages()).find(p=>p.url().includes('/dist/renderer/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100))}assert(page);
  await page.waitForSelector('[data-workspace="blue"]');
  if(seed){await page.evaluate(value=>{localStorage.setItem('lsip_case_workspace_v1',value);localStorage.setItem('lsip_language','tr')},workspace);await page.reload();await page.waitForSelector('[data-workspace="blue"]')}
  assert.equal(await page.evaluate(()=>localStorage.getItem('lsip_case_workspace_v1')),workspace);assert.equal(await page.evaluate(()=>localStorage.getItem('lsip_language')),'tr');
  await page.$eval('[data-tab="v3-cases"]',e=>e.click());await page.waitForFunction(()=>document.querySelector('[data-view="v3-cases"]')?.innerText.includes('UPGRADE_CANARY_Şirket'));
  const config=await page.evaluate(()=>window.lsip.invoke('app:get-config'));
  if(seed){config.database.retentionDays=37;await page.evaluate(value=>window.lsip.invoke('app:save-config',value),config)}else assert.equal(config.database.retentionDays,37);
  const metrics=[];
  if(version==='development'){
   for(let i=0;i<12;i++){
    const tab=['process','dns','v3-cases'][i%3];await page.$eval(`[data-tab="${tab}"]`,e=>e.click());await new Promise(r=>setTimeout(r,5000));
    const snapshot=await page.evaluate(()=>window.lsip.invoke('perf:get-metrics'));assert(Number.isFinite(snapshot.mainProcess.rss));metrics.push({rss:snapshot.mainProcess.rss,heapUsed:snapshot.mainProcess.heapUsed,modules:snapshot.modules.details.map(m=>({name:m.name,timers:m.timerCount,ipc:m.ipcHandlerCount}))});
   }
  }
  results.push({version,casePreserved:true,settingsPreserved:true,languagePreserved:true,caseRendered:true,shortObservationSeconds:metrics.length*5,metrics});
 }finally{if(browser)await browser.close().catch(()=>{});if(child.exitCode===null)await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,10000))]);if(child.exitCode===null){child.kill();throw new Error('App failed graceful shutdown: '+version)}}
}
(async()=>{
 for(const [i,version]of ['3.0.1','3.0.2','development','3.0.1'].entries())await run(version,i===0);
 const report={checkedAt:new Date().toISOString(),os:os.release(),architecture:os.arch(),scope:'Existing host only; not clean Windows or endurance acceptance',results};fs.writeFileSync(path.join(root,'security-audit/upgrade-acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:results.map(({metrics,...r})=>r)}));
})().catch(error=>{console.error(error);process.exitCode=1});
