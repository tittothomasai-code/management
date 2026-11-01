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
 const it=tag1(b,'indexType');return {uid:attr(L.attr,'uid'),name:tag1(b,'name'),indexType:it,time:/time/i.test(it),indexCurve:tag1(b,'indexCurve'),curves,ml,ul,rows}})}
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
