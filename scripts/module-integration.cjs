// Real local read-only collector checks in an isolated Electron profile.
const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),scratch=path.join(root,'tmp/module-integration');
fs.mkdirSync(scratch,{recursive:true});
app.setPath('userData',path.join(scratch,'profile')); app.disableHardwareAcceleration();
const results=[];let window,manager,db;
const deadline=setTimeout(()=>{console.error('Integration timeout');app.exit(1)},240000);
app.whenReady().then(async()=>{
 db=require('../dist/main/core/database-manager').databaseManager;await db.ready;
 manager=require('../dist/main/core/module-manager').moduleManager;
 const {container}=require('../dist/main/core/service-container');
 container.register('databaseManager',db);
 container.register('configManager',require('../dist/main/core/config-manager').configManager);
 const dirs=fs.readdirSync(path.join(root,'dist/main/modules'),{withFileTypes:true}).filter(x=>x.isDirectory());
 for(const dir of dirs){
   const folder=path.join(root,'dist/main/modules',dir.name);
   for(const file of fs.readdirSync(folder).filter(x=>x.endsWith('.module.js'))){
     const mod=require(path.join(folder,file));
     const ctor=Object.values(mod).find(x=>typeof x==='function'&&x.prototype?.initialize);
     if(ctor)manager.registerModule(new ctor());
   }
 }
 const fixture=path.join(scratch,'fixture.html');fs.writeFileSync(fixture,'<!doctype html><meta charset="utf-8"><p>Integration</p>');
 window=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'dist/preload/index.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
 require('../dist/main/core/security').trustRenderer(window.webContents,pathToFileURL(fixture).href);await window.loadFile(fixture);
 for(const mod of manager.getModulesList()){
  try{const pair=await Promise.all([manager.initializeOnDemand(mod.name),manager.initializeOnDemand(mod.name)]);results.push({module:mod.name,initialized:pair.every(Boolean)});}catch(e){results.push({module:mod.name,error:e.message});}
 }
 const checks=[['dashboard:metrics'],['process:list'],['threads:list',{}],['dlls:list',{}],['certs:list'],['connection:active'],['assets:get-all'],['events:query',{}],['dns:query',{}],['smb:shares'],['rdp:sessions'],['usb:devices'],['persistence:registry'],['timeline:query',{}],['dfir:get-memory-analysis'],['dfir:get-registry-keys'],['dfir:get-artifacts','prefetch'],['internet:get-health']];
 for(const [channel,payload] of checks){
  const started=Date.now();
  try{
   const result=await window.webContents.executeJavaScript(`window.lsip.invoke(${JSON.stringify(channel)},${JSON.stringify(payload)||'undefined'})`);
   results.push({channel,success:result?.success,count:Array.isArray(result?.data)?result.data.length:undefined,error:result?.error,ms:Date.now()-started});
  }catch(e){results.push({channel,success:false,error:e.message,ms:Date.now()-started});}
 }
 fs.writeFileSync(path.join(root,'security-audit/module-integration.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
 await manager.shutdownAll();await db.closeAll();window.destroy();clearTimeout(deadline);app.exit(results.some(r=>r.initialized===false||r.success===false||r.error)?1:0);
}).catch(e=>{console.error(e);clearTimeout(deadline);app.exit(1)});
