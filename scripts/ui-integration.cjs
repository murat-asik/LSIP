// Cold navigation through every real workspace; no outbound scan is launched.
const fs=require('fs'),path=require('path'),net=require('net'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'tmp','ui-integration');fs.mkdirSync(scratch,{recursive:true});
async function main(){
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
 const env={...process.env,NODE_ENV:'production'};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(path.join(root,'node_modules/electron/dist/electron.exe'),[root,'--user-data-dir='+path.join(scratch,'profile'),'--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const log=fs.createWriteStream(path.join(scratch,'launch.log'));child.stdout.pipe(log);child.stderr.pipe(log);
 let browser;const results=[],errors=[];
 try{
  const deadline=Date.now()+60000;let endpoint;
  while(Date.now()<deadline){try{endpoint=(await(await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;if(endpoint)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!endpoint)throw new Error('UI startup timeout');
  browser=await(await import('puppeteer')).connect({browserWSEndpoint:endpoint});
  let page;
  while(Date.now()<deadline){page=(await browser.pages()).find(p=>p.url().includes('/dist/renderer/index.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  if(!page)throw new Error('Renderer not found');
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',entry=>{if(entry.type()==='error')errors.push(entry.text());});
  await page.waitForSelector('[data-workspace="blue"]');
  for(const language of ['en','tr']){
   await page.evaluate(lang=>localStorage.setItem('lsip_language',lang),language);await page.reload();await page.waitForSelector('[data-workspace="blue"]');
   for(const workspace of ['blue','dfir','red']){
    await page.$eval(`[data-workspace="${workspace}"]`,e=>e.click());
    const tabs=await page.$$eval('[data-tab]',buttons=>buttons.map(button=>button.dataset.tab));
    for(const tab of tabs){
     const start=Date.now();await page.$eval(`[data-tab="${tab}"]`,e=>e.click());
     await page.waitForFunction(tab=>{const v=document.querySelector(`[data-view="${tab}"]`);return v&&v.getAttribute('aria-hidden')==='false'&&!v.querySelector('.lucide-loader-circle')&&v.innerText.trim().length>10;},{timeout:60000,polling:100},tab);
     await new Promise(r=>setTimeout(r,300));
     const state=await page.$eval(`[data-view="${tab}"]`,v=>({textLength:v.innerText.length,alerts:[...v.querySelectorAll('[role="alert"]')].map(e=>e.textContent)}));
     results.push({tab,language,...state,ms:Date.now()-start});console.log(language,tab,JSON.stringify(state));
    }
   }
  }
  await page.screenshot({path:path.join(scratch,'last-view.png')});
  fs.writeFileSync(path.join(root,'security-audit/ui-integration.json'),JSON.stringify({results,errors},null,2));
  if(errors.length||results.some(r=>r.alerts.length))throw new Error('UI errors found; inspect ui-integration.json');
 }finally{if(browser)await browser.close().catch(()=>{});await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,10000))]);if(child.exitCode===null)child.kill();log.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1});

