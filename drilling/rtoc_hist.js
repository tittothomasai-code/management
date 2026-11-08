// rtoc_hist.js: bounded, read-only full-history paging for one WITSML log through the EXISTING transport contract
// call(op,wmlType,query,options) -> {xml,result?,supp?}  (ext4.js call/callRetry: result 1 = complete, 2 = partial / more data).
// Never loops forever: page/row/time caps, and stops when a page adds no new index (duplicate boundary / server ignoring start).
import * as K from './wdash_core.js?v=fp-ops-r2-20261108';
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const xa=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const isAuth=e=>e?.status===401||e?.code===401||/\b401\b|unauthori[sz]ed|authentication required/i.test(String(e?.message||''));
export const CAPS={pageNodes:2000,maxPages:40,maxRows:60000,maxMs:120000,callMs:30000};
function q(well,s,start){const r=start==null?'':s.time?`<startDateTimeIndex>${new Date(start).toISOString()}</startDateTimeIndex>`:`<startIndex uom="${xa(s.uom||'m')}">${start}</startIndex>`;
 return `<logs ${NS}><log uidWell="${xa(well)}" uidWellbore="${xa(s.wb)}" uid="${xa(s.uid)}">${r}<logData><data/></logData></log></logs>`}
const hdrStart=s=>s.time?(Date.parse(s.start||'')||null):(Number.isFinite(parseFloat(s.start))?parseFloat(s.start):null);
// Optional fifth transport argument is {signal}; legacy four-argument transports may ignore it.
export async function deadlineCall(call,args,{ms=30000,signal}={}){
 const controller=new AbortController();let timer,rejectAbort;const relay=()=>{controller.abort(signal?.reason);const e=new Error('WITSML request aborted');e.code='ABORTED';rejectAbort?.(e)};
 if(signal?.aborted)relay();else signal?.addEventListener('abort',relay,{once:true});
 try{return await Promise.race([
  new Promise((_,reject)=>{rejectAbort=reject;if(controller.signal.aborted)relay()}),
  Promise.resolve().then(()=>{if(controller.signal.aborted)throw new Error('Request aborted');return call(...args,{signal:controller.signal})}),
  new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const e=new Error('WITSML request deadline exceeded');e.code='TIMEOUT';reject(e)},Math.max(1,ms))})
 ])}finally{clearTimeout(timer);signal?.removeEventListener('abort',relay)}
}
// status: fault | partial | timeout | complete | capped-pages | capped-rows | capped-time | stalled (page added nothing new) | aborted (well switched) | error
export async function readAll(call,well,s,{caps=CAPS,fresh=true,alive=()=>true,now=()=>Date.now()}={}){const c={...CAPS,...caps};
 if(fresh){s.ml=null;s.rows=[];s.ul=[]}const st={status:'complete',pages:0,rows:0,dupDropped:0,lastResult:null,err:null,from:null};const t0=now();
 let start=s.rows.length?s.rows.at(-1)[0]:hdrStart(s);st.from=start;
 for(;;){if(!alive()){st.status='aborted';break}if(st.pages>=c.maxPages){st.status='capped-pages';break}if(s.rows.length>=c.maxRows){st.status='capped-rows';break}if(now()-t0>c.maxMs){st.status='capped-time';break}
  let j;try{j=await deadlineCall(call,['WMLS_GetFromStore','log',q(well,s,start),'returnElements=data-only;maxReturnNodes='+c.pageNodes],{ms:Math.min(c.callMs,Math.max(1,c.maxMs-(now()-t0)))})}catch(e){st.status=e.code==='TIMEOUT'?'timeout':isAuth(e)?'auth':'error';st.err=e.message;break}
  if(!alive()){st.status='aborted';break}
  st.pages++;st.lastResult=j?.result??null;
  const raw=typeof j==='string'?j:(j?.xml||'');const envelope=K.soapResult(raw);
  const result=j?.result??envelope.result;st.lastResult=result??null;
  const fault=j?.fault||envelope.fault;const supp=j?.supp||envelope.supp||'';
  if(fault||(result!=null&&Number(result)<0)||/\b504\b|gateway\s*timeout|timed?\s*out/i.test(supp)||/<(?:\w+:)?Fault\b/.test(raw)){
   st.status=isAuth({message:String(fault||supp)})?'auth':'fault';st.err=String(fault||supp||('WITSML result '+result));break}
  const L=K.parseLogs(normalizeLog13(typeof j=='string'?j:(j?.xml||'')))[0];const got=L?.rows?.length||0;
  if(!got){st.status=Number(result)===2?'partial':'complete';if(st.status==='partial')st.err='Partial response returned no rows; continuation unverified';break}
  const n=K.appendRows(s,L.ml,L.rows,L.ul);st.rows+=n;st.dupDropped+=got-n;
  if(!n){st.status=Number(result)===2?'stalled':'complete';break}// nothing new: duplicate boundary only -> done (or a server ignoring the start index)
  start=s.rows.at(-1)[0];
  if(!(Number(result)===2||got>=c.pageNodes)){st.status='complete';break}}
 if(s.rows.length>c.maxRows){s.rows.splice(0,s.rows.length-c.maxRows)}
 return Object.assign(st,quality(s))}
// gaps (index step > 5x median step) + sparse channels (> 50% empty)
export function quality(s){const R=s.rows||[];const out={n:R.length,first:R[0]?.[0]??null,last:R.at(-1)?.[0]??null,gaps:[],sparse:[]};if(R.length<3)return out;
 const d=[];for(let i=1;i<R.length;i++)d.push(R[i][0]-R[i-1][0]);const m=d.slice().sort((a,b)=>a-b)[d.length>>1]||0;
 if(m>0)for(let i=1;i<R.length;i++){if(R[i][0]-R[i-1][0]>5*m)out.gaps.push([R[i-1][0],R[i][0]])}out.gaps=out.gaps.slice(0,50);
 (s.ml||[]).forEach((mn,j)=>{if(!j)return;let e=0;for(const r of R)if(!Number.isFinite(r[j]))e++;if(e/R.length>0.5)out.sparse.push(mn+' '+Math.round(e/R.length*100)+'% empty')});return out}
export function freshness(lastMs,{now=Date.now(),current=false}={}){if(!Number.isFinite(lastMs))return {state:'unknown',text:'No time index: freshness unknown'};const age=now-lastMs,mins=age/60000;if(age<-60e3)return {state:'future',age,text:'Source timestamp is in the FUTURE vs this clock (time-zone/clock skew?)'};
 const h=mins<120?Math.round(mins)+' min':mins<2880?(mins/60).toFixed(1)+' h':(mins/1440).toFixed(1)+' d';
 if(!current)return {state:'historical',age,text:'Historical · last data '+h+' ago'};return {state:mins<=5?'fresh':mins<=30?'lagging':'stale',age,text:(mins<=5?'FRESH':mins<=30?'LAGGING':'STALE')+' · last data '+h+' ago'}}
// read-only object parsers that wdash_core lacks (formationMarker, message); regex, Node + browser
const tagAll=(x,t)=>[...String(x||'').matchAll(new RegExp('<(?:\\w+:)?'+t+'\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?'+t+'>)','g'))].map(m=>({attr:m[1]||'',body:m[2]??''}));
const t1=(x,t)=>{const a=tagAll(x,t)[0];return a?a.body.trim():''};const uom=(x,t)=>((tagAll(x,t)[0]?.attr||'').match(/uom="([^"]*)"/)||[])[1]||'';
const toFt=(v,u)=>Number.isFinite(v)?(/^ft/i.test(u)?v:v/0.3048):null;
export function parseMarkers(x){return tagAll(x,'formationMarker').map(f=>({name:t1(f.body,'name'),md:toFt(parseFloat(t1(f.body,'mdTopSample')),uom(f.body,'mdTopSample')),tvd:toFt(parseFloat(t1(f.body,'tvdTopSample')),uom(f.body,'tvdTopSample')),wb:(f.attr.match(/uidWellbore="([^"]*)"/)||[])[1]||''})).filter(f=>f.name&&Number.isFinite(f.md)).sort((a,b)=>a.md-b.md)}
export function parseMessages(x){return tagAll(x,'message').map(m=>({t:Date.parse(t1(m.body,'dTim'))||null,md:toFt(parseFloat(t1(m.body,'md')),uom(m.body,'md')),type:t1(m.body,'typeMessage'),text:t1(m.body,'messageText').replace(/&lt;/g,'<').replace(/&amp;/g,'&').slice(0,200),wb:(m.attr.match(/uidWellbore="([^"]*)"/)||[])[1]||''})).filter(m=>m.text).sort((a,b)=>(a.t||0)-(b.t||0))}

// ---- live follow (user-initiated only; never started on load) ----
// liveHint: hint only, the user decides. Uses objectGrowing, dTimLastChange recency, else last time-index row.
export function liveHint(set,{now=Date.now(),recentMin=30}={}){const g=set?.objectGrowing??set?.growing;
 if(g===true||g==='true')return {hint:'live',reason:'objectGrowing=true'};
 const lc=Date.parse(set?.dTimLastChange||set?.lastChange||'');const lr=set?.time?set?.rows?.at?.(-1)?.[0]:null;const t=Number.isFinite(lc)?lc:Number.isFinite(lr)?lr:null;
 if(t!=null){const m=(now-t)/60000;return m<=recentMin?{hint:'live',reason:(Number.isFinite(lc)?'dTimLastChange ':'last row ')+Math.round(m)+' min ago'}:{hint:'historic',reason:(Number.isFinite(lc)?'dTimLastChange ':'last row ')+(m/60).toFixed(1)+' h ago'}}
 if(g===false||g==='false')return {hint:'historic',reason:'objectGrowing=false'};return {hint:'unknown',reason:'no growing flag or change time'}}
export const LIVE={intervalMs:15000,minIntervalMs:10000,maxBackoffMs:300000,staleMs:120000};
const RETRY=new Set(['fault','timeout','error','stalled','partial']);
// makeFollower: tick() -> readAll-style status {status,rows}. Timers injectable for tests. One timer at most; generation guard drops late ticks after stop().
export function makeFollower({tick,intervalMs=LIVE.intervalMs,maxBackoffMs=LIVE.maxBackoffMs,staleMs=LIVE.staleMs,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,onState=()=>{}}={}){
 const S={on:false,paused:false,busy:false,interval:Math.max(LIVE.minIntervalMs,intervalMs||LIVE.intervalMs),fails:0,nextMs:null,lastNewAt:now(),lastStatus:null,stopReason:null,ticks:0,newRows:0,stale:false};
 let timer=null,gen=0;const emit=()=>{S.stale=S.on&&now()-S.lastNewAt>staleMs;onState({...S})};
 const clear=()=>{if(timer!=null){clearTimer(timer);timer=null}S.nextMs=null};
 const sched=ms=>{clear();if(!S.on||S.paused)return;S.nextMs=ms;const g=gen;timer=setTimer(()=>{timer=null;if(g===gen)run(g)},ms)};
 async function run(g){if(S.busy||g!==gen)return;S.busy=true;let st;try{st=await tick()}catch(e){st={status:isAuth(e)?'auth':'error',err:e.message}}S.busy=false;
  if(g!==gen)return;S.ticks++;S.lastStatus=st?.status;
  if(st?.rows>0){S.newRows+=st.rows;S.lastNewAt=now()}
  if(st?.status==='auth'){S.on=false;S.stopReason='auth: store rejected credentials (401), not retried';clear();emit();return st}
  if(st?.status==='aborted'){S.on=false;S.stopReason='source switched';clear();emit();return st}
  if(RETRY.has(st?.status)&&!(st.rows>0)){S.fails++;sched(Math.min(maxBackoffMs,S.interval*2**S.fails))}else{S.fails=0;sched(S.interval)}
  emit();return st}
 return {start(){if(S.on)return;S.on=true;S.paused=false;S.stopReason=null;S.fails=0;S.lastNewAt=now();gen++;sched(0);emit()},
  stop(reason='user'){S.on=false;S.stopReason=reason;gen++;clear();emit()},
  pause(){if(!S.on||S.paused)return;S.paused=true;clear();emit()},
  resume(){if(!S.on||!S.paused)return;S.paused=false;sched(0);emit()},
  setInterval(ms){S.interval=Math.max(LIVE.minIntervalMs,ms|0);if(S.on&&!S.paused&&!S.busy&&!S.fails)sched(S.interval);emit()},
  refreshNow(){return run(gen)},
  state(){S.stale=S.on&&now()-S.lastNewAt>staleMs;return {...S}},_timer:()=>timer}}

// ---- WITSML version negotiation (1.4.1.1 preferred, else 1.3.1.1). Same 1series namespace; only version attr + capabilities differ. ----
export const VERSIONS=['1.4.1.1','1.3.1.1'];
export function pickVersion(getVersionXml){const raw=String(getVersionXml||'');const m=raw.match(/<(?:\w+:)?Result[^>]*>([^<]*)</);const list=(m?m[1]:raw).split(/[,\s]+/).map(v=>v.trim()).filter(v=>/^\d+(\.\d+)+$/.test(v));
 const v=VERSIONS.find(x=>list.includes(x));return {version:v||null,offered:list,supported:!!v}}
// GetCap: does the store advertise maxReturnNodes? 1.3.1 stores generally do not; absent cap -> option omitted.
export function capsFrom(capXml,version){const x=String(capXml||'');const fn=[...x.matchAll(/<(?:\w+:)?function\b[^>]*name="([^"]+)"/g)].map(m=>m[1]);
 return {version,maxReturnNodes:version==='1.4.1.1'||/maxReturnNodes/.test(x),functions:fn}}
export async function negotiate(call){let gv;try{gv=await call('WMLS_GetVersion','','','')}catch(e){return {version:'1.4.1.1',offered:[],supported:false,err:'GetVersion failed: '+e.message+' (assuming 1.4.1.1)',maxReturnNodes:true}}
 const v=pickVersion(gv?.xml||gv?.supp||(typeof gv=='string'?gv:''));if(!v.offered.length)return {version:'1.4.1.1',offered:[],supported:false,maxReturnNodes:true,err:'GetVersion empty (assuming 1.4.1.1, unverified)'};if(!v.version)return {...v,version:null,err:'Store offers no supported version ('+(v.offered.join(',')||'none')+')'};
 let cap='';try{const c=await call('WMLS_GetCap','','','dataVersion='+v.version);cap=c?.xml||c?.supp||''}catch(e){}
 return {...v,...capsFrom(cap,v.version),capRead:!!cap}}
// adapter around the EXISTING transport: rewrite version attr of outgoing queries; drop maxReturnNodes if not advertised; normalize 1.3.1 log responses.
export function versionAdapter(call,neg){if(!neg?.version||neg.version==='1.4.1.1')return call;
 return async(op,t,q,o,...rest)=>{const q2=String(q||'').replace(/version="1\.4\.1\.1"/g,'version="'+neg.version+'"');
  let o2=String(o||'');if(!neg.maxReturnNodes)o2=o2.split(';').filter(x=>!/^\s*maxReturnNodes=/.test(x)).join(';');
  const r=await call(op,t,q2,o2,...rest);if(t==='log'&&r&&typeof r==='object'&&r.xml)return {...r,xml:normalizeLog13(r.xml)};return r}}
// 1.3.1.1 logs: no <mnemonicList>/<unitList>; columns come from logCurveInfo (columnIndex order, mnemonic, unit).
export function normalizeLog13(xml){const x=String(xml||'');if(!/<(?:\w+:)?logData\b/.test(x)||/<(?:\w+:)?mnemonicList\b/.test(x))return x;
 return x.replace(/<((?:\w+:)?)log\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?log>/g,(all,pfx,attr,body)=>{if(/<(?:\w+:)?mnemonicList\b/.test(body)||!/<(?:\w+:)?logData\b/.test(body))return all;
  const ci=tagAll(body,'logCurveInfo').map((c,i)=>({m:t1(c.body,'mnemonic'),u:t1(c.body,'unit'),k:parseInt(t1(c.body,'columnIndex'))||i+1})).filter(c=>c.m).sort((a,b)=>a.k-b.k);
  if(!ci.length)return all;const ic=t1(body,'indexCurve');if(ic){const i=ci.findIndex(c=>c.m===ic);if(i>0)ci.unshift(...ci.splice(i,1))}
  return `<${pfx}log${attr}>`+body.replace(/<((?:\w+:)?)logData>/,(m,p)=>`<${p}logData><${p}mnemonicList>${ci.map(c=>c.m).join(',')}</${p}mnemonicList><${p}unitList>${ci.map(c=>c.u).join(',')}</${p}unitList>`)+`</${pfx}log>`})}
