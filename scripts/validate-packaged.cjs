// Local distribution acceptance: isolated profile, loopback debugging, no scans.
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const releaseRoot = path.join(root, require('../package.json').build.directories.output);
const scratch = path.join(root, 'tmp', 'packaged-validation');
fs.mkdirSync(scratch, { recursive: true });
async function main() {
  const asar = await import('@electron/asar');
  const archive = path.join(releaseRoot, 'win-unpacked/resources/app.asar');
  const wanted = ['dist/main/core/backup-service.js','dist/main/core/restore-startup.js','dist/main/core/collector-health.js','dist/main/modules/event-explorer/event-pages.js','dist/main/modules/ioc-scanner/rule-library.js','dist/main/core/event-identity.js','dist/main/modules/base-module.js','dist/main/modules/plugin-system/plugin-worker.js','dist/main/modules/plugin-system/plugin-system.module.js','dist/main/modules/redteam/rdap-service.js','dist/main/core/security.js', 'dist/main/modules/fim/fim-scanner.js', 'dist/main/modules/dfir/forensic-service.js','dist/main/modules/dfir/evidence-vault.js','dist/main/modules/ioc-scanner/rule-worker.js','dist/main/modules/ai-analyst/ai-analyst.module.js', 'dist/preload/index.js'];
  for (const file of wanted) {
    if (!asar.extractFile(archive, path.normalize(file)).equals(fs.readFileSync(path.join(root, file)))) throw new Error('Packaged source mismatch: ' + file);
  }
  if (asar.listPackage(archive).some(file => /^\\(data|logs|tmp|security-audit)\\/.test(file))) throw new Error('Private runtime directories bundled');
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const env = { ...process.env, NODE_ENV: 'production' }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(path.join(releaseRoot, 'LSIP v3.0 '+require('../package.json').version+'.exe'), ['--user-data-dir=' + path.join(scratch, 'profile-'+Date.now()), '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + port], { cwd: scratch, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(path.join(scratch, 'launch.log')); child.stdout.pipe(log); child.stderr.pipe(log);
  let browser;
  try {
    const deadline = Date.now() + 240000;
    let endpoint;
    while (Date.now() < deadline) {
      try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); endpoint = (await r.json()).webSocketDebuggerUrl; if (endpoint) break; } catch {}
      if (child.exitCode !== null) throw new Error('Portable EXE exited before UI startup: ' + child.exitCode);
      await new Promise(r => setTimeout(r, 500));
    }
    if (!endpoint) throw new Error('Portable EXE did not expose a running window');
    const puppeteer = await import('puppeteer'); browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
    let page;
    while (Date.now() < deadline) { page = (await browser.pages()).find(p => p.url().includes('/dist/renderer/index.html')); if (page) break; await new Promise(r => setTimeout(r, 250)); }
    if (!page) throw new Error('Packaged renderer not loaded');
    console.log('Packaged renderer loaded');
    await page.waitForFunction(() => document.querySelector('#root')?.textContent.length > 100 && window.lsip, { timeout: 15000, polling: 100 });
    const result = await page.evaluate(async () => {
      const state = await window.lsip.invoke('connectivity:get-state');
      let unknownRejected = false; try { await window.lsip.invoke('app:not-a-real-action'); } catch { unknownRejected = true; }
      return { rendererLoaded: true, offlineStartup: state.isOnlineMode === false, unknownChannelRejected: unknownRejected, nodeHidden: typeof require === 'undefined', textLength: document.querySelector('#root').textContent.length };
    });
    if (!result.offlineStartup || !result.unknownChannelRejected || !result.nodeHidden) throw new Error('Runtime check failed');
    const en = require('../src/renderer/i18n/locales/en.json');
    const tr = require('../src/renderer/i18n/locales/tr.json');
    const clickText = async text => {
      await page.waitForFunction(text => Array.from(document.querySelectorAll('button')).some(b => b.innerText.trim() === text), {}, text);
      await page.evaluate(text => Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === text).click(), text);
    };
    const expectText = text => page.waitForFunction(text => document.body.innerText.includes(text), { timeout: 15000, polling: 100 }, text);
    // Reuse the running application's real renderer, real bridge and read-only result handlers.
    await page.setViewport({ width: 1280, height: 900 });
    if (await page.$('button[title="Dil Değiştir"]')) await page.$eval('button[title="Dil Değiştir"]', e => e.click());
    await page.$eval('button[title="Red Team Reconnaissance & Assessment"]', e => e.click());
    await clickText(en.workspaces.portScanner);
    await expectText('Nmap');
    await page.waitForFunction(() => !document.body.innerText.includes('Checking scanning engines'), { timeout: 15000, polling: 100 });
    if (await page.evaluate(() => document.body.innerText.includes('Nmap bulunamadı'))) throw new Error('Turkish Nmap description in English');
    await clickText(en.workspaces.attackSurface);
    await expectText('Recorded port and HTTP measurements are used.');
    await page.screenshot({ path: path.join(scratch, 'redteam-en.png') });
    await page.$eval('button[title="Switch Language"]', e => e.click());
    await expectText('Kayıtlı port ve HTTP ölçümleri kullanılır.');
    if (await page.evaluate(() => /\{\{?count\}?\}/.test(document.body.innerText))) throw new Error('Unresolved count placeholder');
    await page.screenshot({ path: path.join(scratch, 'redteam-tr.png') });
    await page.$eval('button[title="Dil Değiştir"]', e => e.click());
    await expectText('Recorded port and HTTP measurements are used.');
    await clickText(en.workspaces.purpleMatrix);
    await expectText(en.operational.purpleScope);
    await page.$eval('button[title="Switch Language"]', e => e.click());
    await expectText(tr.operational.purpleScope);
    await page.$eval('button[title="Dil Değiştir"]', e => e.click());
    await expectText(en.operational.purpleScope);
    const targetPath=path.join(scratch,'harmless-yara-target.txt');fs.writeFileSync(targetPath,'LSIP_PACKAGED_FIXTURE');
    const collection=path.join(scratch,'collection');fs.mkdirSync(path.join(collection,'Windows/System32/config'),{recursive:true});
    const recycle=path.join(collection,'$Recycle.Bin');fs.mkdirSync(recycle,{recursive:true});
    const deletedPath='C:\\Fixture\\deleted.txt\0',header=Buffer.alloc(28+deletedPath.length*2);header.writeBigInt64LE(2n);header.writeBigInt64LE(123n,8);header.writeBigInt64LE(133801632000000000n,16);header.writeUInt32LE(deletedPath.length,24);header.write(deletedPath,28,'utf16le');fs.writeFileSync(path.join(recycle,'$ITEST01.txt'),header);
    console.log('Language checks passed; testing bundled engines');
    const engines=await page.evaluate(async ({targetPath,collection})=>{
      const activation=await window.lsip.invoke('module-manager:activate','v3-detection-lab');
      if(!activation.success)throw new Error('Detection module activation failed');
      const yara=await window.lsip.invoke('ioc:evaluate-rule',{kind:'YARA',content:'rule packaged_fixture { strings: $a="LSIP_PACKAGED_FIXTURE" condition: $a }',targetPath});
      await window.lsip.invoke('module-manager:activate','dfir-registry');
      const registry=await window.lsip.invoke('dfir:analyze-artifact',{type:'registry',source:'local'});
      const forensic=await window.lsip.invoke('dfir:analyze-artifact',{type:'recycle',source:collection});
      return {yara,registry,forensic};
    },{targetPath,collection});
    if(!engines.yara.success||engines.yara.data.matchesCount!==1||!engines.registry.success||!engines.forensic.success||engines.forensic.data.records.length!==1)throw new Error('Packaged engine check failed: '+JSON.stringify(engines));
    result.forensicEngine=engines.forensic.data.engine;
    result.yaraEngine=engines.yara.data.engine;result.registryValues=engines.registry.data.records.length;
    result.languageSwitching = 'Red Team result descriptions and Purple Team details: en -> tr -> en passed';
    await page.screenshot({ path: path.join(scratch, 'app.png') });
    fs.writeFileSync(path.join(root, 'security-audit/package-validation.json'), JSON.stringify({ ...result, version: require('../package.json').version, generatedAt: new Date().toISOString(), sourceMatches: wanted, noRuntimeDataBundled: true }, null, 2));
    console.log(JSON.stringify(result));
    await browser.close(); browser = undefined;
    await Promise.race([new Promise(r => child.once('exit', r)), new Promise(r => setTimeout(r, 8000))]);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child.exitCode === null) { try { execFileSync(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch {} }
    log.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });


