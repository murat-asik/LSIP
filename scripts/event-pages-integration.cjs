const assert=require('assert/strict'),fs=require('fs');
const {readEventPage}=require('../dist/main/modules/event-explorer/event-pages');
(async()=>{
 const first=await readEventPage('Application',undefined,3);
 assert(first.events.length>0,'Application log needs at least one existing event');
 const second=await readEventPage('Application',first.cursor,3);
 assert(!second.warning);
 assert(second.events.every(e=>BigInt(e.recordId)>BigInt(first.cursor.record_id)));
 const reset=await readEventPage('Application',{...first.cursor,timestamp:'1900-01-01T00:00:00.0000000Z'},3);
 assert.match(reset.warning,/reset or retention/);
 assert.equal(reset.events[0].recordId,first.events[0].recordId);
 await assert.rejects(()=>readEventPage('Invalid-channel'));
 const result={checkedAt:new Date().toISOString(),pass:true,checks:4,firstRecords:first.events.length,nextRecords:second.events.length,resetSimulated:true,systemLogModified:false};
 fs.writeFileSync('security-audit/event-pages-integration.json',JSON.stringify(result,null,2));console.log(result);
})().catch(error=>{console.error(error);process.exitCode=1});
