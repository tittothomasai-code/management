// wdash_core.js v5.12.12: pure helpers for the WITSML dashboard (no DOM, no network, no storage). Node-testable.
// Parses WITSML 1.4.1.1 <log> XML text, finds standard drilling/petrophysics curves, groups azimuthal/array curves into
// borehole-image sectors, fits sinusoids, and generates SIMULATED depth/time data (always labelled SIM).
export const STD=[// key, label, unit hint, mnemonic patterns (first match wins), default scale
 ['ROP','ROP','m/h',/^(ROPA?|ROP5|ROPI|ROP_AVG|RATE_OF_PEN.*)$/i,[0,60]],
 ['WOB','WOB','klbf',/^(SWOB|WOBA?|DWOB|WOB_AVG)$/i,[0,50]],
 ['RPM','RPM','rpm',/^(RPMA?|TRPM|SRPM|RPM_SURF|DRPM)$/i,[0,200]],
 ['TQ','Torque','kft.lbf',/^(TQA|STOR|TORQ(UE)?|TQ|STQ)$/i,[0,30]],
 ['SPP','SPP','psi',/^(SPPA?|SPP|PRES_SPP)$/i,[0,5000]],
 ['FLOW','Flow in','gpm',/^(MFIA|TFLO|FLOW(IN)?|MFI)$/i,[0,1200]],
 ['GR','Gamma ray','gAPI',/^(GR|GRA|GRC|SGRC|GAMMA|GR_AVG|DGR|ABG)$/i,[0,150]],
 ['RES','Resistivity','ohm.m',/^(RES|RESD|RPD|RT|ATR|PSR|RPCEHM|RESM|RDEEP|RAD)$/i,[0.2,200],1]];
export const COLORS=['#4fc3f7','#ffb74d','#81c784','#e57373','#ba68c8','#fff176','#4db6ac','#f06292'];
export function findStd(mns){const out={};for(const [k,,, re] of STD){const m=mns.find(x=>re.test(x));if(m)out[k]=m}return out}
// ---- XML parsing with regex (works in Node and browser; WITSML log payloads are flat) ----
const unesc=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const tagAll=(x,t)=>[...x.matchAll(new RegExp('<(?:\\w+:)?'+t+'\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?'+t+'>)','g'))].map(m=>({attr:m[1]||'',body:m[2]??''}));
const tag1=(x,t)=>{const a=tagAll(x,t);return a.length?unesc(a[0].body.trim()):''};
const attr=(a,n)=>(a.match(new RegExp('\\b'+n+'="([^"]*)"'))||[])[1]||'';
// returns [{uid,name,indexType,indexCurve,curves:[{mn,unit,array:n|0}],ml:[],ul:[],rows:[[...]]}] ; array values are arrays of numbers
export function parseLogs(x){x=String(x||'');return tagAll(x,'log').map(L=>{const b=L.body;
 const curves=tagAll(b,'logCurveInfo').map(c=>{const ad=tagAll(c.body,'axisDefinition');const n=ad.length?(+tag1(ad[0].body,'count')||+tag1(ad[0].body,'size')||0):0;return {mn:tag1(c.body,'mnemonic')||attr(c.attr,'uid'),unit:tag1(c.body,'unit'),array:n}});
 const ld=tagAll(b,'logData')[0];let ml=[],ul=[],rows=[];
 if(ld){ml=tag1(ld.body,'mnemonicList').split(',').map(s=>s.trim()).filter(Boolean);ul=tag1(ld.body,'unitList').split(',').map(s=>s.trim());
  const isArr=ml.map(m=>(curves.find(c=>c.mn==m)?.array)||0);
  rows=tagAll(ld.body,'data').map(d=>splitRow(unesc(d.body.trim()),isArr))}
 const it=tag1(b,'indexType');return {uid:attr(L.attr,'uid'),uidWellbore:attr(L.attr,'uidWellbore'),obj:'log',end:tag1(b,'endDateTimeIndex')||tag1(b,'endIndex'),start:tag1(b,'startDateTimeIndex')||tag1(b,'startIndex'),name:tag1(b,'name'),indexType:it,time:/time/i.test(it),indexCurve:tag1(b,'indexCurve'),curves,ml,ul,rows}})}
// a data row: comma separated; array curve values are space-separated numbers in one cell (1.4.1.1 convention); time index kept as ms
export function splitRow(s,isArr=[]){return s.split(',').map((c,i)=>{c=c.trim();if(c==='')return NaN;if(isArr[i]||/\s/.test(c)&&i>0)return c.split(/\s+/).map(Number);
 if(i==0&&/\d{4}-\d\d-\d\dT/.test(c))return Date.parse(c);return +c})}
// ---- columnar store ----
export function toColumns(log){const C={};const ml=log.ml.length?log.ml:log.curves.map(c=>c.mn);ml.forEach((m,i)=>C[m]=log.rows.map(r=>r[i]));return {idx:ml[0],ml,C}}
// merge rows strictly increasing by index (append-only feed)
export function appendRows(store,ml,rows,unit=[]){if(!store.ml){store.ml=ml.slice();store.ul=unit.slice();store.rows=[]}
 const map=ml.map(m=>store.ml.indexOf(m));ml.forEach((m,i)=>{if(map[i]<0){store.ml.push(m);store.ul.push(unit[i]||'');map[i]=store.ml.length-1;store.rows.forEach(r=>r.push(NaN))}});
 let last=store.rows.length?store.rows.at(-1)[0]:-Infinity,n=0;for(const r of rows){if(!(r[0]>last))continue;const o=new Array(store.ml.length).fill(NaN);map.forEach((j,i)=>o[j]=r[i]);store.rows.push(o);last=r[0];n++}return n}
// ---- image (array) curves ----
// 1) a single array curve (axisDefinition / space-separated cell) ; 2) a family of sector curves like GRIM_01..GRIM_16, RAB_S1..S16, IMG_GR_B05
export function findImages(ml,rows){const out=[];
 ml.forEach((m,i)=>{if(i==0)return;const v=rows.find(r=>Array.isArray(r[i]));if(v)out.push({name:m,kind:'array',cols:[i],n:v[i].length})});
 const fam={};ml.forEach((m,i)=>{const k=m.match(/^(.*?)(?:[_\-.]?(?:S|SEC|SECT|B|BIN|AZ|SECTOR)?)(\d{1,2})$/i);if(!k||i==0)return;const base=k[1].replace(/[_\-.]$/,'');if(!base)return;(fam[base]=fam[base]||[]).push({i,n:+k[2]})});
 for(const [b,a] of Object.entries(fam))if(a.length>=4){a.sort((x,y)=>x.n-y.n);out.push({name:b,kind:'sectors',cols:a.map(x=>x.i),n:a.length})}
 return out}
export function imgRow(row,img){if(img.kind=='array'){const v=row[img.cols[0]];return Array.isArray(v)?v:null}const v=img.cols.map(i=>row[i]);return v.some(Number.isFinite)?v:null}
// colour map (dark brown -> orange -> pale yellow, classic image log look); t in 0..1
export function cmap(t){t=Math.max(0,Math.min(1,t||0));const s=[[20,10,0],[90,40,5],[170,90,20],[230,160,60],[255,235,170]];const f=t*(s.length-1),i=Math.min(s.length-2,Math.floor(f)),u=f-i;return s[i].map((a,k)=>Math.round(a+(s[i+1][k]-a)*u))}
// least-squares sinusoid z(θ)=z0+A·cos(θ-φ) through per-sector boundary depths; returns {z0,amp,az(deg),dip(deg)} given hole diameter (same unit as z)
export function fitSine(th,z,dia){const n=th.length;if(n<3)return null;let a=0,b=0,c=0;for(let k=0;k<n;k++){a+=z[k];b+=z[k]*Math.cos(th[k]);c+=z[k]*Math.sin(th[k])}
 const z0=a/n,A=2*b/n,B=2*c/n,amp=Math.hypot(A,B),phi=Math.atan2(B,A);return {z0,amp,az:((phi*180/Math.PI)+360)%360,dip:Math.atan2(2*amp,dia)*180/Math.PI}}
// auto-pick bed boundaries on an image: strongest changes of the sector mean, then per-sector boundary depth in a window -> sinusoid fit
export function autoSines(depth,img,dia=0.216,max=8){const N=depth.length;if(N<20)return [];const mean=img.map(v=>v?v.reduce((s,x)=>s+(Number.isFinite(x)?x:0),0)/v.length:NaN);
 const g=[];for(let i=2;i<N-2;i++)g[i]=Math.abs((mean[i+2]-mean[i-2]));const step=Math.abs(depth[N-1]-depth[0])/N||0.1;const win=Math.max(3,Math.round(0.6/step));
 const cand=[];for(let i=win;i<N-win;i++)if(Number.isFinite(g[i])&&g[i]>0&&g[i]>=Math.max(...g.slice(i-win,i+win+1).filter(Number.isFinite)))cand.push(i);
 const thr=(()=>{const s=cand.map(i=>g[i]).sort((a,b)=>b-a);return s.length?s[0]*0.35:Infinity})();const out=[];
 for(const i of cand.sort((a,b)=>g[b]-g[a])){if(g[i]<thr||out.length>=max)break;const ns=img[i]?.length||0;if(!ns)continue;const th=[],z=[];
  for(let s=0;s<ns;s++){let best=i,bv=-1;for(let j=Math.max(1,i-win);j<Math.min(N-1,i+win);j++){const a=img[j-1]?.[s],b=img[j+1]?.[s];const d=Math.abs(b-a);if(d>bv){bv=d;best=j}}th.push((s+0.5)/ns*2*Math.PI);z.push(depth[best])}
  const f=fitSine(th,z,dia);if(f&&f.amp<win*step*1.2)out.push(f)}return out.sort((a,b)=>a.z0-b.z0)}
// ---- SIMULATED generator (deterministic; labelled SIM by callers) ----
// beds: dipping layers produce sinusoids on the sector images. Returns rows in the same format as parsed logs.
export const SIM_ML=['DEPT','ROPA','SWOB','RPMA','TQA','SPPA','MFIA','GR','RESD',...Array.from({length:16},(_,k)=>'GRIM_'+String(k+1).padStart(2,'0')),...Array.from({length:16},(_,k)=>'RIMG_'+String(k+1).padStart(2,'0'))];
export const SIM_UL=['m','m/h','klbf','rpm','kft.lbf','psi','gpm','gAPI','ohm.m',...Array(16).fill('gAPI'),...Array(16).fill('ohm.m')];
const rnd=k=>{const x=Math.sin(k*12.9898+78.233)*43758.5453;return x-Math.floor(x)};
const BEDS=Array.from({length:200},(_,k)=>({top:1500+k*3.1+rnd(k)*2,shale:rnd(k+7)>0.5,dip:25+rnd(k+3)*45,az:rnd(k+11)*360}));
function lith(md,thDeg,dia=0.216){// depth shift from dip at this azimuth -> which bed
 for(let k=BEDS.length-1;k>=0;k--){const B=BEDS[k];const sh=Math.tan(B.dip*Math.PI/180)*dia/2*Math.cos((thDeg-B.az)*Math.PI/180);if(md>=B.top+sh)return B}return {shale:true}}
export function simRow(md,t){const ph=md/7;const sh=lith(md,0).shale;const rop=sh?14+6*Math.sin(ph):32+10*Math.sin(ph*1.7);
 const wob=18+5*Math.sin(md/11),rpm=120+20*Math.sin(md/23),tq=8+wob*0.25+2*Math.sin(md/5),flow=780+30*Math.sin(md/40),spp=2800+md*0.3+40*Math.sin(md/9);
 const gi=[],ri=[];for(let s=0;s<16;s++){const B=lith(md,(s+0.5)*22.5);const n=rnd(Math.floor(md*50)+s);gi.push(+(B.shale?95+15*n:35+12*n).toFixed(1));ri.push(+(B.shale?2+1.5*n:25+20*n).toFixed(2))}
 const gr=gi.reduce((a,b)=>a+b)/16,res=ri.reduce((a,b)=>a+b)/16;
 return [md,rop,wob,rpm,tq,spp,flow,gr,res,...gi,...ri].map((v,i)=>i==0?+v.toFixed(2):+(+v).toFixed(2))}
export function simSeries(md0,md1,step=0.1){const r=[];for(let m=md0;m<=md1+1e-9;m+=step)r.push(simRow(+m.toFixed(2)));return r}
// tiny, dependency-free check that a string carries no credential-looking text (used by tests and the UI before showing errors)
export const redact=(t,secrets=[])=>{let r=String(t||'');for(const v of secrets)if(v&&v.length>1)r=r.split(v).join('***');return r.replace(/(Basic\s+)[A-Za-z0-9+/=]{6,}/g,'$1***')};
// SOAP envelope for direct (no proxy) WITSML 1.4.1.1 calls
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function soapEnvelope(op,a={}){const body=op=='WMLS_GetVersion'?'':op=='WMLS_GetCap'?`<OptionsIn>${esc(a.options||'dataVersion=1.4.1.1')}</OptionsIn>`:`<WMLtypeIn>${esc(a.wmlType)}</WMLtypeIn><QueryIn>${esc(a.query)}</QueryIn><OptionsIn>${esc(a.options||'')}</OptionsIn><CapabilitiesIn></CapabilitiesIn>`;
 return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><q1:${op} xmlns:q1="http://www.witsml.org/message/120">${body}</q1:${op}></soap:Body></soap:Envelope>`}
export function soapResult(x){x=String(x||'');const r=tag1(x,'Result')||tag1(x,'result');const out=tag1(x,'XMLout');const v=tag1(x,'WMLS_GetVersionResult')||(r&&!/^-?\d+$/.test(r)?r:'');return {result:/^-?\d+$/.test(r)?+r:null,xml:out,version:v||r,supp:tag1(x,'SuppMsgOut'),fault:tag1(x,'faultstring')}}
// ---- v5.12.19 whole-well discovery: classify every object, pick the live branch, map time<->depth, combine channels ----
// kind: realtime | time | depth | survey | mudlog | fe (formation evaluation)
export function classify(d){const n=(d.name||'')+' '+(d.uid||'');if(d.obj=='trajectory')return 'survey';if(d.obj=='mudLog')return 'mudlog';
 if(d.time&&/real\s*-?time|\blive\b|\brt\b|_rt\b|realtime/i.test(n))return 'realtime';if(/survey|traj/i.test(n))return 'survey';if(/mud\s*log|mudlog|gas|lith/i.test(n))return 'mudlog';
 if(/\bfe\b|formation\s*eval|wireline|lwd|petro|resist|gamma|neutron|density|sonic|image/i.test(n))return 'fe';return d.time?'time':'depth'}
// live branch: a real-time time log; else the time log with the latest end; else the deepest depth log
export function pickLive(sets){const t=sets.filter(s=>s.time&&s.obj=='log');const end=s=>Date.parse(s.end||'')||0;
 const rt=t.filter(s=>s.kind=='realtime').sort((a,b)=>end(b)-end(a)||(b.rows?.length||0)-(a.rows?.length||0));if(rt.length)return rt[0];
 if(t.length)return t.slice().sort((a,b)=>end(b)-end(a))[0];const dl=sets.filter(s=>!s.time&&s.obj=='log');return dl.sort((a,b)=>(+b.end||0)-(+a.end||0))[0]||sets[0]||null}
export const DEPTH_MN=[/^(DBTM|BITDEP|BDEP|BDE|DBTV|BIT_DEPTH|BITDEPTH)$/i,/^(DMEA|HDTH|HDEP|DEPTH_HOLE|HOLEDEPTH|DEPT|DEPTH|MD)$/i];
// map from a time set: [[t,md]] monotone in t, md = hole depth (running max of bit/hole depth). null if no depth channel.
export function depthMap(set){if(!set||!set.ml)return null;let j=-1,mn='';for(const re of DEPTH_MN){j=set.ml.findIndex((m,i)=>i>0&&re.test(m));if(j>0){mn=set.ml[j];break}}if(j<0)return null;
 const P=[];let mx=-Infinity;for(const r of set.rows){const t=r[0],d=r[j];if(!Number.isFinite(t)||!Number.isFinite(d))continue;if(d>mx){mx=d;P.push([t,d])}}return P.length>=2?{mn,pts:P,bit:set.rows.filter(r=>Number.isFinite(r[0])&&Number.isFinite(r[j])).map(r=>[r[0],r[j]])}:null}
const lerp=(P,x,a,b)=>{if(!P.length)return NaN;if(x<P[0][a]||x>P.at(-1)[a])return NaN;let lo=0,hi=P.length-1;while(hi-lo>1){const m=(lo+hi)>>1;P[m][a]<=x?lo=m:hi=m}const p=P[lo],q=P[hi];return q[a]==p[a]?p[b]:p[b]+(q[b]-p[b])*(x-p[a])/(q[a]-p[a])};
export const t2d=(M,t)=>M?lerp(M.pts,t,0,1):NaN;export const d2t=(M,d)=>M?lerp(M.pts,d,1,0):NaN;
// resample a set's columns onto a target index (array of numbers) in mode 'depth'|'time'; arrays use nearest row
function sampler(set,mode,M){let rows=set.rows;if(!rows.length)return null;const native=set.time?'time':'depth';
 if(native!=mode){if(!M)return null;if(mode=='depth'){// time->depth: keep on-bottom drilling rows (new hole), indexed by hole depth
   rows=rows.map(r=>[t2d(M,r[0]),...r.slice(1)]).filter(r=>Number.isFinite(r[0]));const o=[];let mx=-Infinity;for(const r of rows)if(r[0]>mx){mx=r[0];o.push(r)}rows=o}
  else rows=rows.map(r=>[d2t(M,r[0]),...r.slice(1)]).filter(r=>Number.isFinite(r[0])).sort((a,b)=>a[0]-b[0])}
 if(rows.length<1)return null;return {rows,at(x,j){let lo=0,hi=rows.length-1;if(x<rows[0][0]||x>rows[hi][0])return NaN;while(hi-lo>1){const m=(lo+hi)>>1;rows[m][0]<=x?lo=m:hi=m}
  const p=rows[lo],q=rows[hi],a=p[j],b=q[j];if(Array.isArray(a)||Array.isArray(b))return (x-p[0]<=q[0]-x?a:b)??NaN;if(!Number.isFinite(a)||!Number.isFinite(b))return Number.isFinite(a)&&x-p[0]<=q[0]-x?a:Number.isFinite(b)?b:NaN;return q[0]==p[0]?a:a+(b-a)*(x-p[0])/(q[0]-p[0])}}}
// build the view store for one mode from all sets of one wellbore; primary gives the grid. src[mn] = {set, how:'native'|'mapped'}; missing lists sets without a mapping.
export function combine(sets,mode,M,primary){const out={ml:[],ul:[],rows:[],src:{},missing:[]};const nat=s=>(s.time?'time':'depth')==mode;
 const grid=(nat(primary)&&primary.rows.length?primary:sets.filter(s=>nat(s)&&s.rows.length).sort((a,b)=>b.rows.length-a.rows.length)[0])||(primary&&primary.rows.length?primary:null);
 if(!grid)return out;const gs=sampler(grid,mode,M);if(!gs){out.missing=sets.filter(s=>s.rows.length).map(s=>s.name||s.uid);return out}
 const idx=gs.rows.map(r=>r[0]);out.ml.push(mode=='depth'?'MD':'TIME');out.ul.push(mode=='depth'?(grid.ul?.[0]||'m'):'ms');const cols=[];
 const order=[grid,...sets.filter(s=>s!==grid&&s.rows.length)];
 for(const s of order){const sm=s===grid?gs:sampler(s,mode,M);if(!sm){out.missing.push(s.name||s.uid);continue}
  s.ml.forEach((m,j)=>{if(j==0)return;let mn=m;if(out.src[mn])mn=m+'@'+(s.short||s.uid);if(out.src[mn])return;out.src[mn]={set:s.uid,name:s.name,how:nat(s)?'native':'mapped',orig:m};out.ml.push(mn);out.ul.push(s.ul?.[j]||'');cols.push([sm,j])})}
 out.rows=idx.map((x,i)=>[x,...cols.map(([sm,j])=>sm===gs?gs.rows[i][j]:sm.at(x,j))]);return out}
// trajectory stations -> depth set rows [md,inc,azi,tvd]
export function parseTraj(x){x=String(x||'');return tagAll(x,'trajectory').map(T=>{const st=tagAll(T.body,'trajectoryStation').map(s=>[+tag1(s.body,'md'),+tag1(s.body,'incl'),+tag1(s.body,'azi'),+tag1(s.body,'tvd')]).filter(r=>Number.isFinite(r[0])).sort((a,b)=>a[0]-b[0]);
 return {uid:attr(T.attr,'uid'),uidWellbore:attr(T.attr,'uidWellbore'),name:tag1(T.body,'name'),obj:'trajectory',time:false,ml:['MD','INCL','AZI','TVD'],ul:['m','dega','dega','m'],rows:st}})}
// mudLog geology intervals -> depth set rows [mdTop, ropAv, lith% ] (interval tops)
export function parseMudLogs(x){x=String(x||'');return tagAll(x,'mudLog').map(L=>{const gi=tagAll(L.body,'geologyInterval').map(g=>[+tag1(g.body,'mdTop'),+tag1(g.body,'ropAv')||NaN,+tag1(tagAll(g.body,'lithology')[0]?.body||'','lithPc')||NaN]).filter(r=>Number.isFinite(r[0])).sort((a,b)=>a[0]-b[0]);
 return {uid:attr(L.attr,'uid'),uidWellbore:attr(L.attr,'uidWellbore'),name:tag1(L.body,'name'),obj:'mudLog',time:false,ml:['MD','ML_ROPAV','ML_LITHPC'],ul:['m','m/h','%'],rows:gi}})}
