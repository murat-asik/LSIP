import crypto from 'crypto';
import { app } from 'electron';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { text } from '../../core/security';
import { databaseManager } from '../../core/database-manager';
import { runPowerShell } from '../../core/powershell';

async function readLiveRunKeys() {
  const script = `$ErrorActionPreference='Stop'
$rows = @(); $warnings = @()
foreach ($hive in @([Microsoft.Win32.RegistryHive]::LocalMachine, [Microsoft.Win32.RegistryHive]::CurrentUser)) {
  foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64, [Microsoft.Win32.RegistryView]::Registry32)) {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
    try {
      foreach ($subpath in @('SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run','SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce')) {
        $key = $null
        try {
          $key = $base.OpenSubKey($subpath, $false)
          if ($null -ne $key) { foreach ($name in $key.GetValueNames()) {
            $rows += [PSCustomObject]@{ hive=$hive.ToString(); view=$view.ToString(); path=$subpath; name=$name; value=$key.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames); value_type=$key.GetValueKind($name).ToString() }
          } }
        } catch { $warnings += $_.Exception.Message }
        finally { if ($null -ne $key) { $key.Dispose() } }
      }
    } finally { $base.Dispose() }
  }
}
[PSCustomObject]@{records=@($rows); warnings=($warnings -join '; ')} | ConvertTo-Json -Compress -Depth 5`;
  const output = await new Promise<string>((resolve,reject)=>runPowerShell(script,(error,stdout,stderr)=>error?reject(new Error(stderr || error.message)):resolve(stdout)));
  const parsed=JSON.parse(output);
  if(!Array.isArray(parsed.records))throw new Error('Unexpected registry collector output');
  if(!parsed.records.length && parsed.warnings)throw new Error(parsed.warnings);
  return parsed as {records:any[];warnings:string};
}
const diskPlugins:Record<string,string>={prefetch:'prefetch',amcache:'amcache',shimcache:'shimcache',jumplists:'jumplist',srum:'sru.network_data',usn:'usnjrnl',recycle:'recyclebin',registry:'runkeys'};
const memoryPlugins:Record<string,string>={pslist:'windows.pslist.PsList',netscan:'windows.netscan.NetScan',malfind:'windows.malware.malfind.Malfind'};
export async function analyzeForensic(input:{type:string;source:string;memoryPlugin?:string;symbolsPath?:string}) {
  if(!input || (!Object.hasOwn(diskPlugins,input.type)&&input.type!=='memory'))throw new Error('Unknown forensic artifact type');
  text(input.source,'Evidence source');
  const live=input.source==='local';
  if(live && input.type==='registry') {
    const result=await readLiveRunKeys();
    const snapshot={type:input.type,source:input.source,collectedAt:Date.now(),engine:'Windows Registry (read-only)',...result};
    await saveSnapshot(snapshot);
    return snapshot;
  }
  const source=live?'local?fallback-to-directory-fs':path.resolve(input.source);
  if(!live)await fs.stat(source);
  const engine=app.isPackaged?path.join(process.resourcesPath,'tools/forensics/lsip-forensics.exe'):path.join(app.getAppPath(),'vendor/forensics/lsip-forensics/lsip-forensics.exe');
  let args:string[];
  if(input.type==='memory') {
    if(live)throw new Error('Select a memory dump file');
    if(!(await fs.stat(source)).isFile())throw new Error('Memory input must be a regular file');
    const plugin=memoryPlugins[input.memoryPlugin||'pslist'];if(!plugin)throw new Error('Unknown memory plugin');
    args=['memory','--offline','-q','-r','json','-f',source];
    if(input.symbolsPath){text(input.symbolsPath,'Symbols directory');const symbols=path.resolve(input.symbolsPath);if(!(await fs.stat(symbols)).isDirectory())throw new Error('Symbols path must be a directory');args.push('-s',symbols);}
    args.push(plugin);
  }else args=['disk','--no-cache','-j','--limit','1000','-f',diskPlugins[input.type],source];
  const {stdout,stderr}=await new Promise<{stdout:string;stderr:string}>((resolve,reject)=>execFile(engine,args,{windowsHide:true,timeout:120000,maxBuffer:24*1024*1024,encoding:'utf8'},(err,stdout,stderr)=>err?reject(new Error(stderr.replace(/\x1b\[[0-9;]*m/g,'').slice(-2500)||err.message)):resolve({stdout,stderr})));
  let records:any[]=[];
  if(input.type==='memory'){
    records=JSON.parse(stdout);if(!Array.isArray(records))throw new Error('Unexpected memory parser output');
  } else {
    for(const line of stdout.split(/\r?\n/).filter(Boolean)){
      const row=JSON.parse(line);if(row?._type==='recorddescriptor')continue;records.push(row);
    }
  }
  if(!records.length && /error|unsupported|incompatible|not found|failed/i.test(stderr))throw new Error(stderr.replace(/\x1b\[[0-9;]*m/g,'').slice(-2500));
  const snapshot={type:input.type,source:input.source,collectedAt:Date.now(),limited:input.type!=='memory' && records.length>=1000,engine:input.type==='memory'?'Volatility 3':'Dissect',records,warnings:stderr.replace(/\x1b\[[0-9;]*m/g,'').trim().slice(-2500)};
  await saveSnapshot(snapshot);
  return snapshot;
}

async function saveSnapshot(snapshot:{type:string;source:string;collectedAt:number}) {
  await databaseManager.queryRun('dfir','INSERT INTO dfir_analysis_runs (id, artifact_type, source, collected_at, result_json) VALUES (?, ?, ?, ?, ?)',[crypto.randomUUID(),snapshot.type,snapshot.source,snapshot.collectedAt,JSON.stringify(snapshot)]);
}
