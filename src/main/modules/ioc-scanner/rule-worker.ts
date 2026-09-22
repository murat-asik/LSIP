import { parentPort, workerData } from 'worker_threads';
import { evaluateRules } from './rule-engine';
try { parentPort?.postMessage({success:true,data:evaluateRules(workerData.kind,workerData.content,workerData.records)}); }
catch(error:any) { parentPort?.postMessage({success:false,error:error.message}); }
