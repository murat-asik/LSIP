import { useAppStore } from '../stores/app.store';

/** Keep form state mounted while pausing hidden views' repeated IPC requests. */
export function createViewPolling(tab:string,callback:()=>unknown,intervalMs:number):()=>void {
  let disposed=false,running=false;
  const poll=async()=>{
    if(disposed||running||useAppStore.getState().activeTab!==tab)return;
    running=true;
    try{await callback();}catch(error){console.error(`Polling failed for ${tab}`,error);}finally{running=false;}
  };
  const timer=window.setInterval(()=>{void poll();},intervalMs);
  const unsubscribe=useAppStore.subscribe((state,previous)=>{
    if(state.activeTab===tab&&previous.activeTab!==tab)void poll();
  });
  return ()=>{disposed=true;window.clearInterval(timer);unsubscribe();};
}
export function stopViewPolling(dispose:()=>void):void {dispose();}
