import { isIPv4 } from 'net';
export function ipv4Number(ip:string):number {
  if(!isIPv4(ip))throw new Error('Invalid IPv4 address');
  return ip.split('.').reduce((value,part)=>(value*256+Number(part))>>>0,0);
}
export function subnetFor(ip:string,mask:string):string {
  const bits=ipv4Number(mask).toString(2).padStart(32,'0');
  if(!/^1*0*$/.test(bits))throw new Error('Invalid network mask');
  const network=(ipv4Number(ip)&ipv4Number(mask))>>>0;
  return [24,16,8,0].map(shift=>(network>>>shift)&255).join('.')+'/'+bits.replace(/0/g,'').length;
}
export function scopeContains(scope:string,ip:string):boolean {
  const parts=scope.split('/');
  if(parts.length!==2||!/^\d{1,2}$/.test(parts[1]))throw new Error('Expected IPv4/CIDR scope');
  const prefix=Number(parts[1]);if(prefix<0||prefix>32)throw new Error('Invalid network prefix');
  const mask=prefix===0?0:(0xffffffff<<(32-prefix))>>>0;
  return ((ipv4Number(parts[0])&mask)>>>0)===((ipv4Number(ip)&mask)>>>0);
}
