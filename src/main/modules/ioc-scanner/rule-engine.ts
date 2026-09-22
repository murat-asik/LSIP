import { parse } from 'yaml';
export type RecordData = Record<string, any>;
type Predicate = (record: RecordData) => boolean;
const field = (record: RecordData, name: string) => record[Object.keys(record).find(k => k.toLowerCase() === name.toLowerCase()) || name];
function wildcard(pattern: string): RegExp {
  let regex = '';
  for(let i=0;i<pattern.length;i++) {
    const c=pattern[i];
    if(c==='\\' && /[?*\\]/.test(pattern[i+1] || ' ')) regex+=pattern[++i].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    else regex+=c==='*'?'.*':c==='?'?'.':c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }
  return new RegExp('^'+regex+'$','i');
}
function booleanExpression(tokens: string[], atom: (token:string)=>Predicate): Predicate {
  let i=0;
  const primary=():Predicate=>{
    const token=tokens[i++];
    if(!token) throw new Error('Incomplete condition');
    if(token.toLowerCase()==='not'){const p=primary();return r=>!p(r);}
    if(token==='('){const p=or();if(tokens[i++]!==')')throw new Error('Missing closing parenthesis');return p;}
    return atom(token);
  };
  const and=():Predicate=>{let p=primary();while(tokens[i]?.toLowerCase()==='and'){i++;const a=p,b=primary();p=r=>a(r)&&b(r);}return p;};
  const or=():Predicate=>{let p=and();while(tokens[i]?.toLowerCase()==='or'){i++;const a=p,b=and();p=r=>a(r)||b(r);}return p;};
  const result=or(); if(i!==tokens.length)throw new Error('Unsupported condition near '+tokens[i]);return result;
}
function selection(value:any):Predicate {
  if(Array.isArray(value)){const children=value.map(selection);return r=>children.some(p=>p(r));}
  if(typeof value==='string'){const match=wildcard('*'+value+'*');return r=>match.test(JSON.stringify(r));}
  if(!value || typeof value!=='object')throw new Error('Invalid Sigma selection');
  const tests=Object.entries(value).map(([key,expected])=>{
    const [name,...mods]=key.split('|');
    if(mods.some(m=>!['contains','startswith','endswith','all','exists','re'].includes(m)))throw new Error('Unsupported Sigma modifier: '+key);
    const values=Array.isArray(expected)?expected:[expected];
    const tests=values.map(v=>{
      if(mods.includes('exists')){if(typeof v!=='boolean')throw new Error('exists requires boolean');return (actual:any)=>(actual!==undefined&&actual!==null)===v;}
      if(v===null)return (actual:any)=>actual===null||actual===undefined;
      if(typeof v==='object')throw new Error('Invalid Sigma value');
      let pattern=String(v);
      if(mods.includes('contains'))pattern='*'+pattern+'*';
      if(mods.includes('startswith'))pattern+='*';
      if(mods.includes('endswith'))pattern='*'+pattern;
      const regex=mods.includes('re')?new RegExp(pattern,'i'):wildcard(pattern);
      return (actual:any)=>actual!==undefined&&actual!==null&&regex.test(String(actual));
    });
    return (r:RecordData)=>{const actual=field(r,name);return mods.includes('all')?tests.every(p=>p(actual)):tests.some(p=>p(actual));};
  });
  return r=>tests.every(p=>p(r));
}
export function compileSigma(content:string):Predicate {
  const rule=parse(content,{maxAliasCount:20});
  if(!rule?.detection || typeof rule.detection.condition!=='string')throw new Error('A Sigma detection and condition are required');
  if(rule.correlation || rule.detection.timeframe)throw new Error('Aggregation and timeframe conditions are not supported');
  const selections:Record<string,Predicate>=Object.create(null);
  for(const [name,value] of Object.entries(rule.detection))if(name!=='condition')selections[name]=selection(value);
  let condition=rule.detection.condition as string;
  condition=condition.replace(/\b(1|all)\s+of\s+(them|[\w*]+)/g,(_match,mode,pattern)=>{
    const names=Object.keys(selections).filter(k=>pattern==='them'||wildcard(pattern).test(k));
    if(!names.length)throw new Error('No selections match '+pattern);
    return '('+names.join(mode==='all'?' and ':' or ')+')';
  });
  const tokens=condition.match(/\(|\)|[^\s()]+/g)||[];
  const test=booleanExpression(tokens,token=>{if(!Object.hasOwn(selections,token))throw new Error('Unknown selection '+token);return selections[token];});
  const category=rule.logsource?.category;
  const product=rule.logsource?.product, service=rule.logsource?.service;
  if(product && product!=='windows')throw new Error('Only Windows event log sources are supported');
  if(service && !['security','sysmon','system','application','powershell'].includes(service))throw new Error('Unsupported logsource service: '+service);
  const supported=['process_creation','network_connection','dns_query','registry_event','registry_set','file_event','image_load'];
  if(category && !supported.includes(category))throw new Error('Unsupported logsource category: '+category);
  const eventIds:Record<string,number[]>={process_creation:[1,4688],network_connection:[3,5156],dns_query:[22],registry_event:[12,13,14],registry_set:[13],file_event:[11],image_load:[7]};
  return r=>{
    const source=String(r.Provider||r.Channel||'').toLowerCase();
    if(service && !source.includes(service))return false;
    if(category) {
      const id=Number(r.EventID);
      if(!eventIds[category].includes(id))return false;
      if(id>=4600 ? !source.includes('security') : !source.includes('sysmon'))return false;
    }
    return test(r);
  };
}
export function compileHunt(query:string):Predicate {
  const predicates:Predicate[]=[];
  const remainder=query.replace(/([A-Za-z][\w.]*)\s*(=|!=|CONTAINS\b|MATCHES\b)\s*("(?:\\.|[^"\\])*"|'[^']*'|\d+)/gi,(_all,name,op,literal)=>{
    let expected:string;
    if(literal.startsWith('"'))expected=JSON.parse(literal);else expected=literal.startsWith("'")?literal.slice(1,-1):literal;
    const re=op.toUpperCase()==='MATCHES'?new RegExp(expected,'i'):null;
    predicates.push(r=>{
      const value=field(r,name);if(value===undefined||value===null)return false;
      const actual=String(value);
      switch(op.toUpperCase()){case '=':return actual.toLowerCase()===expected.toLowerCase();case '!=':return actual.toLowerCase()!==expected.toLowerCase();case 'CONTAINS':return actual.toLowerCase().includes(expected.toLowerCase());default:return re!.test(actual);}
    });return ' $'+(predicates.length-1)+' ';
  });
  return booleanExpression(remainder.match(/\(|\)|[^\s()]+/g)||[],token=>{
    if(!/^\$\d+$/.test(token)||!predicates[Number(token.slice(1))])throw new Error('Invalid query near '+token);
    return predicates[Number(token.slice(1))];
  });
}
export function evaluateRules(kind:string,content:string,records:RecordData[]) {
  let test:Predicate;
  if(kind==='Sigma')test=compileSigma(content);
  else if(kind==='Hunt')test=compileHunt(content);
  else if(kind==='IOC'){
    const values=content.split(/[\r\n,]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(!values.length||values.length>1000)throw new Error('Supply 1–1000 indicators');
    test=r=>Object.values(r).some(value=>values.includes(String(value).toLowerCase()));
  }else throw new Error('Unknown rule type');
  const matches=records.filter(test);
  return {status:'SUCCESS',matchesCount:matches.length,matchedEvents:matches,recordsScanned:records.length};
}
