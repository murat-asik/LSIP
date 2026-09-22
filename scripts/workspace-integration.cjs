// Real renderer bootstrap and saved-rule controls in an isolated local profile.
const fs=require('fs'),path=require('path'),net=require('net'),crypto=require('crypto'),assert=require('assert/strict'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'tmp','workspace-integration',crypto.randomUUID()),profile=path.join(scratch,'profile');
fs.mkdirSync(path.join(profile,'restore-state'),{recursive:true});
fs.writeFileSync(path.join(profile,'restore-state/storage.json'),JSON.stringify({lsip_language:'tr',lsip_theme:'dark',lsip_v3_cases:'[]',lsip_case_workspace_v1:null,lsip_v3_iocs:null,lsip_v3_evidence:null}));
(async()=>{
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))})});
 const env={...process.env,NODE_ENV:'production'};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(path.join(root,'node_modules/electron/dist/electron.exe'),[root,'--user-data-dir='+profile,'--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port],{cwd:root,env,windowsHide:true,stdio:'ignore'});
 let browser;
 try {
  const deadline=Date.now()+60000;let endpoint;
  while(Date.now()<deadline){try{endpoint=(await(await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;if(endpoint)break}catch{}await new Promise(r=>setTimeout(r,200))}
  assert(endpoint,'App startup timed out');browser=await(await import('puppeteer')).connect({browserWSEndpoint:endpoint});
  let page;while(Date.now()<deadline){page=(await browser.pages()).find(p=>p.url().includes('/dist/renderer/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100))}
  assert(page);await page.waitForSelector('[data-workspace="blue"]');
  assert.equal(await page.evaluate(()=>localStorage.getItem('lsip_language')),'tr');
  assert(!fs.existsSync(path.join(profile,'restore-state/storage.json')));assert(fs.existsSync(path.join(profile,'restore-state/storage.applied.json')));
  await page.$eval('[data-tab="v3-detection-lab"]',e=>e.click());
  const name='[data-view="v3-detection-lab"] input[aria-label="Kural veya tehdit avı adı"]';await page.waitForSelector(name);await page.type(name,'Çok satırlı test kuralı');
  const save=()=>page.$eval('[data-view="v3-detection-lab"]',v=>[...v.querySelectorAll('button')].find(b=>b.textContent==='Yeni sürüm kaydet').click());
  await save();await page.waitForFunction(()=>document.querySelector('[data-view="v3-detection-lab"] select')?.selectedOptions[0]?.textContent.endsWith('v1'));
  await save();await page.waitForFunction(()=>document.querySelector('[data-view="v3-detection-lab"] select')?.selectedOptions[0]?.textContent.endsWith('v2'));
  await page.reload();await page.waitForSelector('[data-tab="v3-detection-lab"]');await page.$eval('[data-tab="v3-detection-lab"]',e=>e.click());
  await page.waitForFunction(()=>document.querySelector('[data-view="v3-detection-lab"] select')?.options.length===3);
  const rules=await page.evaluate(()=>window.lsip.invoke('ioc:rule-list',{kind:'Sigma'}));assert.equal(rules.data.length,2);assert(rules.data[0].content.includes('\n'));
  const health=await page.evaluate(()=>window.lsip.invoke('app:collector-health'));assert(Array.isArray(health));
  const result={checkedAt:new Date().toISOString(),restoredBeforeAppLoad:true,restoreAcknowledged:true,multilineRuleSavedThroughUI:true,revisionPersistedAfterReload:true,healthIPC:true};
  fs.writeFileSync(path.join(root,'security-audit/workspace-integration.json'),JSON.stringify(result,null,2));console.log(result);
 }finally{if(browser)await browser.close().catch(()=>{});if(child.exitCode===null)child.kill()}
})().catch(error=>{console.error(error);process.exitCode=1});
