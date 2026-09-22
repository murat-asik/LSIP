// Isolated real Electron boundary test; does not start LSIP collectors.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '..');
const scratch = path.join(root, 'tmp', 'electron-security-smoke');
fs.mkdirSync(scratch, { recursive: true });
app.setPath('userData', path.join(scratch, 'profile'));
app.disableHardwareAcceleration();
const checks = [];
const windows = [];
const check = (name, pass) => { checks.push({ name, pass: !!pass }); if (!pass) throw new Error(name); };
const deadline = setTimeout(() => { console.error('Electron smoke timeout'); app.exit(1); }, 30000);
app.whenReady().then(async () => {
  const { trustRenderer, safeIpcHandle } = require('../dist/main/core/security');
  const fixture = path.join(scratch, 'Türkçe test.html');
  fs.writeFileSync(fixture, '<!doctype html><meta charset="utf-8"><title>LSIP isolated security test</title><p>IPC test</p>');
  safeIpcHandle('app:get-status', () => ({ isolated: true }));
  const make = () => {
    const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(root, 'dist/preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    windows.push(win); return win;
  };
  const trusted = make();
  trustRenderer(trusted.webContents, pathToFileURL(fixture).href);
  await trusted.loadFile(fixture);
  check('Gerçek sandbox preload ve güvenilir IPC çalışır', await trusted.webContents.executeJavaScript("window.lsip.invoke('app:get-status').then(r => r.isolated === true)"));
  check('Node renderer içinde erişilemez', await trusted.webContents.executeJavaScript("typeof require === 'undefined' && typeof process === 'undefined'"));
  check('Bilinmeyen IPC kanalı reddedilir', await trusted.webContents.executeJavaScript("(async()=>{try{await window.lsip.invoke('app:invented');return false}catch{return true}})()"));
  const foreign = make(); await foreign.loadFile(fixture);
  check('Aynı dosyayı açan yetkisiz pencere reddedilir', await foreign.webContents.executeJavaScript("(async()=>{try{await window.lsip.invoke('app:get-status');return false}catch{return true}})()"));
  await trusted.loadURL('data:text/html,<p>foreign document</p>');
  check('Güvenilir pencerede farklı belge reddedilir', await trusted.webContents.executeJavaScript("(async()=>{try{await window.lsip.invoke('app:get-status');return false}catch{return true}})()"));
}).then(() => {
  fs.writeFileSync(path.join(root, 'security-audit/electron-smoke-results.json'), JSON.stringify({ total: checks.length, passed: checks.filter(x => x.pass).length, checks }, null, 2));
  console.log(JSON.stringify(checks)); clearTimeout(deadline); windows.forEach(w => w.destroy()); app.exit(0);
}).catch(error => { console.error(error); clearTimeout(deadline); windows.forEach(w => w.destroy()); app.exit(1); });
