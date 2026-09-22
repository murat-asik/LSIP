// Runs production TypeScript with synthetic credentials and controlled network responses.
const fs=require('fs'),assert=require('assert/strict'),{env}=require('./security-audit.cjs');
const results=[];async function test(name,fn){try{await fn();results.push({name,pass:true})}catch(error){results.push({name,pass:false,error:error.message})}}
const config={id:'fixture',name:'Fixture',enabled:true,apiKey:'SYNTHETIC-ONLY',timeoutMs:1000,rateLimit:{requestsPerMinute:60,requestsPerDay:1000}};
(async()=>{
 await test('Timeout-only configuration changes reach the provider',async()=>{
  const e=env(),Base=e.load('src/main/modules/internet-intelligence/base-provider.ts').BaseIntelligenceProvider;
  const p=new Base();await p.initialize(config);await p.initialize({...config,timeoutMs:2000});assert.equal(p.config.timeoutMs,2000);
 });
 for(const status of [401,403,429])await test('HTTP '+status+' preserves status and does not retry',async()=>{
  let calls=0;const e=env({globals:{fetch:async()=>{calls++;return new Response('',{status})}}});const h=e.load('src/main/modules/internet-intelligence/http-client.ts').httpClient;
  await assert.rejects(h.request('https://fixture.invalid',{retryDelayMs:1}),error=>error.status===status&&error.isRateLimit===(status===429));assert.equal(calls,1);
 });
 await test('503 is retried within the configured limit, then succeeds',async()=>{
  let calls=0;const e=env({globals:{fetch:async()=>++calls<3?new Response('',{status:503}):new Response('{"ok":true}',{headers:{'content-type':'application/json'}})}});
  assert.equal((await e.load('src/main/modules/internet-intelligence/http-client.ts').httpClient.request('https://fixture.invalid',{retryDelayMs:1})).data.ok,true);assert.equal(calls,3);
 });
 await test('User cancellation is not reported as timeout',async()=>{
  const c=new AbortController(),e=env({globals:{fetch:async()=>new Promise(()=>{})}}),h=e.load('src/main/modules/internet-intelligence/http-client.ts').httpClient;
  const pending=h.request('https://fixture.invalid',{signal:c.signal});c.abort();await assert.rejects(pending,error=>error.isCancelled===true&&error.isTimeout===false);
 });
 await test('Timeout is distinguished from cancellation',async()=>{
  const e=env({globals:{fetch:async()=>new Promise(()=>{})}}),h=e.load('src/main/modules/internet-intelligence/http-client.ts').httpClient;
  await assert.rejects(h.request('https://fixture.invalid',{timeoutMs:10}),error=>error.isTimeout===true&&error.isCancelled===false);
 });
 await test('Policy cancellation during retry delay prevents another request',async()=>{
  let calls=0;const e=env({globals:{fetch:async()=>{calls++;return new Response('',{status:503})}}}),h=e.load('src/main/modules/internet-intelligence/http-client.ts').httpClient;
  const pending=h.request('https://fixture.invalid',{retryDelayMs:50});const rejection=assert.rejects(pending,error=>error.isCancelled===true);
  await new Promise(r=>setTimeout(r,10));e.bus.publish('internet:policy-changed',{});await rejection;assert.equal(calls,1);
 });
 for(const status of [401,403,429,503])await test('Health status distinguishes HTTP '+status,async()=>{
  const expected={401:'Invalid API Key',403:'Access Denied',429:'Rate Limited',503:'Provider Offline'};
  const provider={...config,capabilities:{requiresApiKey:true,supportedTypes:['ip']},initialize:async()=>{},healthCheck:async()=>{throw Object.assign(new Error('HTTP '+status),{status})}};
  const e=env({'./secure-config':{secureConfigManager:{getAllProviderCredentials:()=>[config],getGlobalConfig:()=>({enabled:true}),getProviderCredentials:()=>config}}});
  const manager=new(e.load('src/main/modules/internet-intelligence/provider-manager.ts').ProviderManager)();manager.registerProvider(provider);const result=await manager.testConnections();assert.equal(result.fixture.status,expected[status]);
 });
 await test('All eight provider health checks preserve HTTP error identity',async()=>{
  for(const name of fs.readdirSync('src/main/modules/internet-intelligence/providers').filter(n=>n.endsWith('.provider.ts'))){
   const e=env(),exports=e.load('src/main/modules/internet-intelligence/providers/'+name),Provider=Object.values(exports)[0],p=new Provider();await p.initialize(config);
   p.query=async()=>{throw Object.assign(new Error('HTTP 429'),{status:429})};await assert.rejects(()=>p.healthCheck(),error=>error.status===429);
  }
 });
 await test('AbuseIPDB raw response is not written to diagnostic logs',async()=>{
  const e=env({'../http-client':{httpClient:{request:async()=>({status:200,data:{data:{abuseConfidenceScore:10,reports:[{comment:'PRIVATE_CANARY'}]}},durationMs:1})}}});
  const p=new(e.load('src/main/modules/internet-intelligence/providers/abuseipdb.provider.ts').AbuseIPDBProvider)();await p.initialize(config);await p.query('192.0.2.1','ip');assert(!e.logs.join('\n').includes('PRIVATE_CANARY'));
 });
 const fixtures={
  abuseipdb:{data:{data:{abuseConfidenceScore:85,totalReports:2}},risk:'critical'},
  virustotal:{data:{data:{attributes:{last_analysis_stats:{malicious:10,harmless:1}}}},risk:'critical'},
  urlhaus:{data:{query_status:'ok',urls:[{url:'https://fixture.invalid'}]},risk:'high'},
  greynoise:{data:{ip:'192.0.2.1',noise:true,riot:false,classification:'malicious'},risk:'high'},
  hybridanalysis:{data:[{threat_score:90,verdict:'malicious'}],type:'hash',risk:'critical'},
  ipqualityscore:{data:{success:true,fraud_score:95},risk:'critical'},
  otx:{data:{indicator:'192.0.2.1',pulse_info:{count:3}},risk:'high'},
  shodan:{data:{ip_str:'192.0.2.1',ports:[80],vulns:{CVE_FIXTURE:{}}},risk:'high'},
 };
 async function queryFixture(name,data,type='ip',indicator='192.0.2.1'){
  let request;const e=env({'../http-client':{httpClient:{request:async(url,options)=>{request={url,options};return{data,status:200,durationMs:1}}}}});
  const Provider=Object.values(e.load('src/main/modules/internet-intelligence/providers/'+name+'.provider.ts'))[0],p=new Provider();await p.initialize(config);
  return{result:await p.query(indicator,type),request};
 }
 for(const [name,fixture]of Object.entries(fixtures))await test(name+' maps a positive fixture without losing raw evidence',async()=>{
  const {result}=await queryFixture(name,fixture.data,fixture.type);assert.equal(result.risk,fixture.risk);assert.equal(JSON.stringify(result.rawResponse),JSON.stringify(fixture.data));
 });
 await test('URLhaus supplies Auth-Key and rejects query errors',async()=>{
  const {request}=await queryFixture('urlhaus',{query_status:'no_results'});assert.equal(request.options.headers['Auth-Key'],config.apiKey);
  for(const body of [null,{}, {query_status:'invalid_host'}])await assert.rejects(()=>queryFixture('urlhaus',body));
 });
 await test('Absent reports never become a verified-clean verdict',async()=>{
  const cases=[['urlhaus',{query_status:'no_results'},'ip'],['hybridanalysis',[],'hash'],['otx',{indicator:'192.0.2.1',pulse_info:{count:0}},'ip'],['virustotal',{data:{attributes:{last_analysis_stats:{}}}},'ip']];
  for(const [name,data,type]of cases){const {result}=await queryFixture(name,data,type);assert.equal(result.risk,'unknown');assert.equal(result.confidence,0)}
 });
 await test('VirusTotal URL identifiers use URL-safe base64',async()=>{
  const indicator='https://example.invalid/???>>>ÿ';const {request}=await queryFixture('virustotal',fixtures.virustotal.data,'url',indicator);
  assert.equal(request.url.split('/urls/')[1],Buffer.from(indicator).toString('base64url'));
 });
 await test('Shodan domain lookup uses the DNS domain endpoint',async()=>{
  const {result,request}=await queryFixture('shodan',{domain:'example.invalid',data:[]},'domain','example.invalid');assert(request.url.includes('/dns/domain/example.invalid?'));assert.equal(result.risk,'unknown');
 });
 await test('OTX IPv6 routes to the IPv6 endpoint',async()=>{
  const indicator='2001:db8::1';const {request}=await queryFixture('otx',{indicator,pulse_info:{count:1}},'ip',indicator);assert(request.url.includes('/indicators/IPv6/'));
 });
 await test('GreyNoise fields use the documented community endpoint',async()=>{
  const {request}=await queryFixture('greynoise',fixtures.greynoise.data);assert(request.url.includes('/v3/community/'));await assert.rejects(()=>queryFixture('greynoise',{}));
 });
 await test('IPQS rejects missing score and hides provider error text',async()=>{
  for(const data of [{},{success:true},{success:true,fraud_score:'95'},{success:false,message:'PRIVATE_CANARY'}])await assert.rejects(()=>queryFixture('ipqualityscore',data),error=>!error.message.includes('PRIVATE_CANARY'));
 });
 fs.writeFileSync('security-audit/provider-acceptance.json',JSON.stringify({mode:'controlled responses; no live provider access',results},null,2));console.log(JSON.stringify(results,null,2));process.exitCode=results.some(r=>!r.pass)?1:0;
})().catch(error=>{console.error(error);process.exitCode=1});
