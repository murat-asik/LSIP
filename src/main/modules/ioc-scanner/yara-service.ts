import { app } from 'electron';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { text } from '../../core/security';
export async function scanYara(content:string,targetPath:string) {
  text(targetPath,'Target file');
  if(typeof content!=='string'||!content.trim()||content.length>65536)throw new Error('Invalid YARA rule');
  if(/^\s*include\s/m.test(content))throw new Error('External YARA includes are not permitted in the editor');
  const target=path.resolve(targetPath),stat=await fs.stat(target);
  if(!stat.isFile()||stat.size>512*1024*1024)throw new Error('Select one regular file, at most 512 MiB');
  const engine=app.isPackaged?path.join(process.resourcesPath,'tools/yara-x/yr.exe'):path.join(app.getAppPath(),'vendor/yara-x/yr.exe');
  const directory=await fs.mkdtemp(path.join(app.getPath('temp'),'lsip-yara-'));
  const rule=path.join(directory,'rule.yar');
  try {
    await fs.writeFile(rule,content,{flag:'wx'});
    const stdout=await new Promise<string>((resolve,reject)=>execFile(engine,['scan','--output-format=json','--disable-console-logs','--threads=1','--timeout=15',rule,target],{cwd:directory,windowsHide:true,timeout:20000,maxBuffer:4*1024*1024,encoding:'utf8'},(error,out,stderr)=>error?reject(new Error(stderr.trim()||error.message)):resolve(out)));
    const result=JSON.parse(stdout);
    return {status:'SUCCESS',engine:'YARA-X '+result.version,recordsScanned:1,matchesCount:result.matches.length,matchedEvents:result.matches.map((m:any)=>({eventId:'YARA',timestamp:new Date().toISOString(),process:m.rule,cmd:m.file}))};
  } finally {await fs.unlink(rule).catch(()=>{});await fs.rmdir(directory).catch(()=>{});}
}
