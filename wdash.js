// wdash.js v5.12.12: WITSML dashboard. Vertical depth (or time) logs, tracks side by side, auto-scroll, curve picker, scales,
// borehole image tracks (unwrapped 0-360°, colour map, sinusoids). Data: WITSML 1.4.1.1 store (via proxy or direct) or SIM.
// Credentials: held ONLY in this module's memory while the panel is connected. Never written to browser storage (local or session),
// cookies, URLs, the console or error text. Cleared on Disconnect and on close. SIM data is labelled SIM, never LIVE.
import * as K from './wdash_core.js?v=w1';
const $=id=>document.getElementById(id);
const HOSTED='https://tryfecta-witsml-proxy.netlify.app/witsml-proxy',LOCAL='http://localhost:8796/soap';
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
let CRED=null,TYPED=false;// {user,pass} memory only
const D={el:null,src:'SIM',mode:'depth',auto:true,top:null,span:{depth:30,time:600},dep:{ml:null,rows:[]},tim:{ml:null,rows:[]},tracks:[],imgs:[],sines:true,timer:0,simMd:1500,simT:0,
 conn:{proto:'soap',via:'proxy',proxy:HOSTED,url:'',well:'',wb:'',log:'',logTime:false,connected:false,okAt:0,err:'',sim:false},raf:0};
export const ST=D;
const live=()=>D.src=='WITSML'&&D.conn.connected&&!D.conn.sim&&!!D.conn.log&&D.conn.logTime==(D.mode=='time')&&Date.now()-D.conn.okAt<120000&&cur().rows.length>0;
const badge=()=>live()?'LIVE':'SIM';
const cur=()=>D.mode=='depth'?D.dep:D.tim;
// ---------- default tracks from available mnemonics ----------
function defaultTracks(ml){const s=K.findStd(ml),T=[];const c=(k,i)=>{const d=K.STD.find(x=>x[0]==k);return {mn:s[k],min:d[4][0],max:d[4][1],log:!!d[5],color:K.COLORS[i%8]}};
 const add=(name,ks)=>{const cv=ks.filter(k=>s[k]).map((k,i)=>c(k,i));if(cv.length)T.push({name,curves:cv})};
 add('Drilling',['ROP','WOB']);add('Rotary',['RPM','TQ']);add('Hydraulics',['SPP','FLOW']);add('Gamma',['GR']);add('Resistivity',['RES']);
 if(!T.length)ml.slice(1,4).forEach((m,i)=>T.push({name:m,curves:[{mn:m,min:NaN,max:NaN,log:false,color:K.COLORS[i]}]}));
 const st=cur();D.imgs=K.findImages(st.ml||ml,st.rows.slice(-50));D.imgs.slice(0,2).forEach(im=>T.push({name:'Image '+im.name,image:im.name}));
 if(!D.imgs.length)T.push({name:'Image',image:null});return T}
// ---------- SIM feed ----------
function simInit(){D.dep={ml:K.SIM_ML.slice(),ul:K.SIM_UL.slice(),rows:K.simSeries(1500,1560,0.05)};D.simMd=1560;
 const now=Date.now();D.tim={ml:['TIME',...K.SIM_ML],ul:['ms',...K.SIM_UL],rows:[]};let md=1530;for(let k=-900;k<=0;k+=2){md+=0.02;D.tim.rows.push([now+k*1000,...K.simRow(+md.toFixed(2))])}D.simT=now}
function simTick(){const r=D.dep.rows.at(-1),rop=r[1]||20,dmd=Math.max(0.05,rop/3600*60);// 60x time compression
 const add=K.simSeries(+(D.simMd+0.05).toFixed(2),+(D.simMd+dmd).toFixed(2),0.05);D.dep.rows.push(...add);D.simMd=add.length?add.at(-1)[0]:D.simMd;
 const t=Date.now();D.tim.rows.push([t,...K.simRow(+D.simMd.toFixed(2))]);trim()}
function trim(){for(const s of [D.dep,D.tim])if(s.rows.length>40000)s.rows.splice(0,s.rows.length-40000)}
// ---------- WITSML transport ----------
export function normProxy(p){try{const u=new URL(p);if(u.hostname=='tryfecta-witsml-proxy.netlify.app'&&u.pathname!='/witsml-proxy'){u.pathname='/witsml-proxy';return u.href}}catch(e){}return p}
export const isLocalProxy=p=>/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(p);
const AUTH=m=>Object.assign(new Error('Login problem: '+m+' — type the password and press Connect again.'),{auth:1});
const NOPRX=m=>new Error('Proxy/CORS problem: '+m);
// v5.12.14 (owner override, this device only): settings + user name in localStorage; password in sessionStorage (tab life);
// opt-in "remember" = AES-GCM ciphertext in localStorage, key non-extractable in IndexedDB. Never in logs / sync / cloud.
const SAVEK='dw_wdash_conn',PWS='dw_wdash_pw',PWE='dw_wdash_pwenc',IDB='dw_wdash_keys';
function saveCfg(){try{const C=D.conn;localStorage.setItem(SAVEK,JSON.stringify({proto:'soap',via:C.via,proxy:C.proxy,url:C.url,user:CRED?.user||'',remember:!!C.remember,well:C.well,wb:C.wb,log:C.log,logTime:!!C.logTime}))}catch(e){}}
function loadCfg(){try{const o=JSON.parse(localStorage.getItem(SAVEK)||'null');if(o){for(const k of ['via','proxy','url'])if(typeof o[k]=='string')D.conn[k]=o[k];D.conn.remember=!!o.remember}return o}catch(e){return null}}
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open(IDB,1);r.onupgradeneeded=()=>r.result.createObjectStore('k');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbOp(mode,f){const db=await idb();return new Promise((res,rej)=>{const t=db.transaction('k',mode),q=f(t.objectStore('k'));t.oncomplete=()=>{db.close();res(q?.result)};t.onerror=()=>{db.close();rej(t.error)}})}
async function aesKey(create){let k=await idbOp('readonly',o=>o.get('aes'));if(!k&&create){k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await idbOp('readwrite',o=>o.put(k,'aes'))}return k}
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u))),ub64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
async function savePw(pw,remember){try{sessionStorage.setItem(PWS,pw)}catch(e){}try{if(remember){const k=await aesKey(true),iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(pw));localStorage.setItem(PWE,JSON.stringify({iv:b64(iv),ct:b64(ct)}))}else localStorage.removeItem(PWE)}catch(e){}}
async function loadPw(){try{const s=sessionStorage.getItem(PWS);if(s)return s}catch(e){}try{const e=JSON.parse(localStorage.getItem(PWE)||'null');if(!e)return '';const k=await aesKey(false);if(!k)return '';return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(e.iv)},k,ub64(e.ct)))}catch(e){return ''}}
async function forgetCfg(){try{localStorage.removeItem(SAVEK);localStorage.removeItem(PWE);sessionStorage.removeItem(PWS)}catch(e){}try{await idbOp('readwrite',o=>o.delete('aes'))}catch(e){}}
async function savedCred(){const o=loadCfg();if(!o||!o.user)return null;const pass=await loadPw();return pass?{user:o.user,pass}:null}
async function autoReconnect(){const o=loadCfg(),c=await savedCred();if(!o||!c||!o.url||!o.well||!o.wb||!o.log)return;CRED=c;const C=D.conn;
 try{await call('WMLS_GetVersion');Object.assign(C,{connected:true,sim:/\/sim\b|simulated/i.test(C.url),well:o.well,wb:o.wb,log:o.log,logTime:!!o.logTime,okAt:0,hdr:null});
  D.dep={ml:null,rows:[]};D.tim={ml:null,rows:[]};D.conn.lastPoll=Date.now();D.src='WITSML';D.mode=o.logTime?'time':'depth';D.tracks=[];D.top=null;D.auto=true;await pollLive();if(!D.tracks.length&&cur().ml)D.tracks=defaultTracks(cur().ml);head();render()}
 catch(e){C.connected=false;C.err='Auto-reconnect failed: '+e.message;render()}}
async function call(op,wmlType,query,options){try{return await call1(op,wmlType,query,options)}catch(e){if(TYPED||!(e.auth||e.timeout))throw e;const c=await savedCred();if(c)CRED=c;return await call1(op,wmlType,query,options)}}
async function call1(op,wmlType,query,options){const C=D.conn,u=CRED||{user:'',pass:''};let body,h;const ac=new AbortController(),to=setTimeout(()=>ac.abort(),45000);
 try{if(C.via=='direct'){const r=await fetch(C.url,{method:'POST',signal:ac.signal,headers:{'Content-Type':'text/xml; charset=utf-8',SOAPAction:'"http://www.witsml.org/action/120/Store.'+op+'"',...(u.user?{Authorization:'Basic '+btoa(unescape(encodeURIComponent(u.user+':'+u.pass)))}:{})},body:K.soapEnvelope(op,{wmlType,query,options})});
   if(r.status==401||r.status==403)throw Object.assign(new Error('login refused by the store (HTTP '+r.status+')'),{auth:1});const s=K.soapResult(await r.text());if(s.fault)throw new Error('store fault: '+s.fault);if(s.result!=null&&s.result<0)throw new Error('store result '+s.result+' '+s.supp);return s}
  h={'Content-Type':'application/json'};C.proxy=normProxy(C.proxy);const hosted=!isLocalProxy(C.proxy);if(hosted&&!u.user)throw AUTH('no login in this session');if(hosted&&u.user)h['X-Witsml-Authorization']='Basic '+btoa(unescape(encodeURIComponent(u.user+':'+u.pass)));
  body=JSON.stringify(hosted?{url:C.url,op,wmlType,query,options}:{url:C.url,user:u.user,pass:u.pass,op,wmlType,query,options});
  const r=await fetch(C.proxy,{method:'POST',headers:h,body,signal:ac.signal});if(r.status==401||r.status==403&&!/origin|upstream not allowed|op not allowed/.test(await r.clone().text().catch(()=>'')))throw AUTH('the store refused the user name/password (HTTP '+r.status+')');
  const j=await r.json().catch(()=>null);if(!j)throw NOPRX('proxy answered HTTP '+r.status+(r.status==404?' — check the proxy URL':'')+' (not JSON)');
  if(j.error){const m=String(j.error);if(/credentials required|Authentication failed/i.test(m))throw AUTH(m);if(/origin not allowed|upstream not allowed|rate limit|upstream (connection|timeout)|TLS/i.test(m))throw NOPRX(m);if(/SOAP fault/i.test(m))throw new Error('Store error ('+m+')');throw new Error('Proxy: '+m)}
  if(op!='WMLS_GetVersion'&&typeof j.result=='number'&&j.result<0)throw new Error('Store error (result '+j.result+(j.supp?': '+j.supp:'')+')');return {xml:j.xml||'',version:j.version||j.result,result:j.result,supp:j.supp}}
 catch(e){if(e.name=='AbortError')throw Object.assign(new Error('no answer within 45 s'),{timeout:1});if(e instanceof TypeError)throw NOPRX(C.via=='direct'?'browser blocked the request (CORS) or the store is unreachable — use a proxy (see guide)':'cannot reach the proxy (check the proxy URL / network)');throw Object.assign(new Error(K.redact(e.message,[u.user,u.pass])),{auth:e.auth})}
 finally{clearTimeout(to)}}
export const ids=(x,t)=>[...String(x).matchAll(new RegExp('<(?:\\w+:)?'+t+'\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?'+t+'>)','g'))].map(m=>({uid:(m[1].match(/\buid="([^"]*)"/)||[])[1],name:(((m[2]||'').match(/<(?:\w+:)?name>([^<]*)</)||[])[1]||'').trim()})).filter(w=>w.uid);
async function listWells(){const j=await call('WMLS_GetFromStore','well',`<wells ${NS}><well uid=""><name/></well></wells>`,'returnElements=id-only');return ids(j.xml,'well')}
async function listWbs(w){const j=await call('WMLS_GetFromStore','wellbore',`<wellbores ${NS}><wellbore uidWell="${w}" uid=""><name/></wellbore></wellbores>`,'returnElements=id-only');return ids(j.xml,'wellbore')}
async function listLogs(w,b){const j=await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${w}" uidWellbore="${b}" uid=""/></logs>`,'returnElements=header-only');return K.parseLogs(j.xml)}
async function pollLive(){const C=D.conn;if(!C.connected||!C.log||C.busy)return;C.busy=true;const s=C.logTime?D.tim:D.dep;
 try{const last=s.rows.at(-1)?.[0];let rng='';
  if(C.logTime)rng=last?`<startDateTimeIndex>${new Date(last+1).toISOString()}</startDateTimeIndex>`:(C.hdr?.end?`<startDateTimeIndex>${new Date(Date.parse(C.hdr.end)-3600e3).toISOString()}</startDateTimeIndex>`:'');
  else rng=last!=null?`<startIndex uom="${C.uom||'m'}">${last}</startIndex>`:(C.hdr?.end!=null?`<startIndex uom="${C.uom||'m'}">${Math.max(0,C.hdr.end-200)}</startIndex>`:'');
  const j=await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${C.well}" uidWellbore="${C.wb}" uid="${C.log}">${rng}<logData><data/></logData></log></logs>`,'returnElements=data-only;maxReturnNodes=2000');
  const L=K.parseLogs(j.xml)[0];if(L&&L.rows.length){const before=s.ml;K.appendRows(s,L.ml,L.rows,L.ul);if(!before||D.tracks.length==0)D.tracks=defaultTracks(s.ml)}
  C.okAt=Date.now();C.err='';C.polls=(C.polls||0)+1}catch(e){C.err=e.message;if(e.auth){disconnect('Login refused — polling stopped. Check user name and password.')}}finally{C.busy=false;render()}}
function disconnect(msg){CRED=null;Object.assign(D.conn,{connected:false,log:'',okAt:0,err:msg||''});['wdUser','wdPass'].forEach(i=>{if($(i))$(i).value=''});D.src='SIM';simInit();D.tracks=defaultTracks(cur().ml);D.top=null;D.auto=true;head();render()}
// ---------- UI ----------
const CSS=`body.mob #wdash.msheet,body.mob #wdash.mcol,#wdash.msheet{display:flex!important;top:0!important;bottom:0!important;left:0!important;right:0!important;width:auto!important;max-height:none!important;height:auto!important;overflow:hidden!important;border-radius:0!important;z-index:100002!important}body.mob #wdash.msheet::before{display:none!important}
#wdash{position:fixed;inset:0;z-index:100002;background:#0b1118;color:#dde7f0;font:13px system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
#wdash .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px;background:#121c27;border-bottom:1px solid #253445}
#wdash button,#wdash select,#wdash input{font:inherit;background:#1d2a38;color:#dde7f0;border:1px solid #33475c;border-radius:6px;padding:5px 8px;min-height:32px}
#wdash button.on{background:#2a6db0;border-color:#4b93d8}#wdash .tag{position:static!important;transform:none!important;display:inline-block;margin:0 6px;font-weight:800;letter-spacing:.08em;border-radius:5px;padding:3px 8px;color:#fff}
#wdash .tag.SIM{background:#8a8f98}#wdash .tag.LIVE{background:#c62828}#wdash h1{font-size:15px;margin:0 6px 0 0}
#wdash .body{flex:1;position:relative;overflow-x:auto;overflow-y:hidden;touch-action:none}#wdash canvas{display:block}
#wdash .note{padding:3px 8px;font-size:12px;color:#9fb3c6;background:#0f1822;border-top:1px solid #1e2b39}
#wdPick,#wdConn{position:absolute;right:8px;top:48px;z-index:3;background:#121c27;border:1px solid #33475c;border-radius:8px;padding:10px;max-height:78vh;overflow:auto;width:min(420px,94vw);box-shadow:0 8px 30px #000a}
#wdPick .tr{border:1px solid #253445;border-radius:6px;padding:6px;margin:6px 0}#wdPick .cv{display:grid;grid-template-columns:1fr 64px 64px auto auto;gap:4px;align-items:center;margin:3px 0}
#wdPick .cv input{width:100%;box-sizing:border-box;min-height:28px;padding:2px 4px}#wdConn label{display:grid;grid-template-columns:96px 1fr;gap:6px;align-items:center;margin:5px 0}
#wdConn small{color:#9fb3c6;display:block;margin-top:6px}@media (max-width:600px){#wdash .hide-ph{display:none}#wdash h1{font-size:13px}}`;
export function open(){if(D.el)return;const st=document.createElement('style');st.id='wdashCss';st.textContent=CSS;document.head.appendChild(st);
 const el=document.createElement('div');el.id='wdash';el.innerHTML=`<div class=bar><h1>WITSML dashboard</h1><span id=wdTag class="tag SIM">SIM</span>
 <button id=wdModeD class=on>Depth</button><button id=wdModeT>Time</button><button id=wdZin aria-label="Zoom in">＋</button><button id=wdZout aria-label="Zoom out">－</button>
 <button id=wdAuto class=on title="Auto-scroll to newest data">⤓ Follow</button><button id=wdTracks>Tracks</button><button id=wdSines class=on>Sines</button><button id=wdConnB>Connect…</button>
 <a id=wdHelp href="./user-guide.html#witsml" target=_blank rel=noopener style="color:#8ecbff" class=hide-ph>Guide</a><span style="flex:1"></span><button id=wdX aria-label=Close>✕</button></div>
 <div class=body id=wdBody><canvas id=wdCv></canvas></div><div class=note id=wdNote></div>`;document.body.appendChild(el);D.el=el;
 if(!D.dep.rows.length)simInit();if(!D.tracks.length)D.tracks=defaultTracks(cur().ml);
 $('wdX').onclick=close;$('wdModeD').onclick=()=>setMode('depth');$('wdModeT').onclick=()=>setMode('time');
 $('wdZin').onclick=()=>zoom(1/1.5);$('wdZout').onclick=()=>zoom(1.5);$('wdAuto').onclick=()=>{D.auto=!D.auto;if(D.auto)D.top=null;head();render()};
 $('wdSines').onclick=()=>{D.sines=!D.sines;head();render()};$('wdTracks').onclick=()=>picker();$('wdConnB').onclick=connPanel;
 const B=$('wdBody');let drag=null;B.addEventListener('pointerdown',e=>{if(e.target.id!='wdCv')return;const hy=e.offsetY;if(hy<HEAD){const t=hitTrack(e.offsetX);if(t>=0)picker(t);return}drag={y:e.clientY,x:e.clientX,top:viewTop(),sl:B.scrollLeft}});
 addEventListener('pointermove',D.pm=e=>{if(!drag)return;const dy=e.clientY-drag.y;B.scrollLeft=drag.sl-(e.clientX-drag.x);if(Math.abs(dy)>3){D.auto=false;D.top=drag.top-dy/pxPer();head();render()}});addEventListener('pointerup',D.pu=()=>drag=null);
 B.addEventListener('wheel',e=>{e.preventDefault();if(e.ctrlKey){zoom(e.deltaY>0?1.2:1/1.2);return}D.auto=false;D.top=viewTop()+e.deltaY/pxPer();head();render()},{passive:false});
 addEventListener('resize',D.rs=()=>render());addEventListener('keydown',D.kd=e=>{if(e.key=='Escape'&&D.el){e.stopPropagation();close()}},true);
 D.timer=setInterval(()=>{if(D.src=='SIM')simTick();else if(D.conn.connected&&Date.now()-(D.conn.lastPoll||0)>=10000){D.conn.lastPoll=Date.now();pollLive()}render()},1000);D.livePoll=0;head();render();window.GX=window.GX||{};GX.wdash={ST:D,open,close,K,render,setMode};autoReconnect()}
export function close(){if(!D.el)return;clearInterval(D.timer);D.el.remove();$('wdashCss')?.remove();D.el=null;removeEventListener('pointermove',D.pm);removeEventListener('pointerup',D.pu);removeEventListener('resize',D.rs);removeEventListener('keydown',D.kd,true);
 if(D.conn.connected)disconnect();CRED=null}
function setMode(m){D.mode=m;D.top=null;D.auto=true;D.tracks=defaultTracks(cur().ml||[]);head();render()}
function zoom(f){D.span[D.mode]=Math.min(D.mode=='depth'?2000:86400,Math.max(D.mode=='depth'?2:30,D.span[D.mode]*f));render()}
function head(){if(!D.el)return;const t=$('wdTag');t.textContent=badge();t.className='tag '+badge();$('wdModeD').classList.toggle('on',D.mode=='depth');$('wdModeT').classList.toggle('on',D.mode=='time');
 $('wdAuto').classList.toggle('on',D.auto);$('wdSines').classList.toggle('on',D.sines);$('wdConnB').textContent=D.conn.connected?'Store ✓':'Connect…'}
// ---------- drawing ----------
const HEAD=58,AXW=46;let LAY=[];
const pxPer=()=>{const h=($('wdCv')?.clientHeight||600)-HEAD;return h/D.span[D.mode]/(D.mode=='time'?1000:1)};
function viewTop(){const s=cur();const span=D.span[D.mode]*(D.mode=='time'?1000:1);if(D.auto||D.top==null){const last=s.rows.at(-1)?.[0]??0;return last-span*0.85}return D.top}
function hitTrack(x){return LAY.findIndex(l=>x>=l.x&&x<l.x+l.w)}
function scale(c,v,w){if(!Number.isFinite(v))return NaN;let a=c.min,b=c.max;if(!Number.isFinite(a)||!Number.isFinite(b)){[a,b]=c.auto||[0,1]}if(c.log){a=Math.log10(Math.max(1e-3,a));b=Math.log10(Math.max(1e-3,b));v=Math.log10(Math.max(1e-3,v))}return (v-a)/((b-a)||1)*w}
const fmtI=v=>D.mode=='depth'?v.toFixed(1):new Date(v).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
export function render(){if(!D.el)return;const B=$('wdBody'),cv=$('wdCv'),dpr=Math.min(2,devicePixelRatio||1);const s=cur();
 const nT=D.tracks.length,imgN=D.tracks.filter(t=>'image' in t).length,avail=B.clientWidth-AXW;const minW=innerWidth<600?84:120;
 let cw=Math.max(minW,Math.floor((avail)/(nT+imgN*0.6||1)));const W=AXW+D.tracks.reduce((a,t)=>a+Math.round(cw*('image' in t?1.6:1)),0),H=B.clientHeight;
 cv.style.width=Math.max(W,B.clientWidth)+'px';cv.style.height=H+'px';cv.width=Math.max(W,B.clientWidth)*dpr;cv.height=H*dpr;const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
 g.fillStyle='#0b1118';g.fillRect(0,0,cv.width,H);const top=viewTop(),pp=pxPer(),bot=top+(H-HEAD)/pp,y=v=>HEAD+(v-top)*pp;
 const ix=s.ml?0:-1;let i0=0,i1=s.rows.length;{let lo=0,hi=s.rows.length;while(lo<hi){const m=(lo+hi)>>1;s.rows[m][0]<top?lo=m+1:hi=m}i0=Math.max(0,lo-1);lo=i0;hi=s.rows.length;while(lo<hi){const m=(lo+hi)>>1;s.rows[m][0]<=bot?lo=m+1:hi=m}i1=Math.min(s.rows.length,lo+1)}
 const vis=s.rows.slice(i0,i1),stride=Math.max(1,Math.floor(vis.length/(H*1.5)));
 // index axis
 g.fillStyle='#121c27';g.fillRect(0,0,AXW,H);g.fillStyle='#9fb3c6';g.font='10px system-ui';g.fillText(D.mode=='depth'?'MD '+(s.ul?.[0]||'m'):'Time',4,14);g.fillText(D.mode=='depth'?'':'local',4,26);
 const stepI=niceStep((bot-top)/8);for(let v=Math.ceil(top/stepI)*stepI;v<bot;v+=stepI){const yy=y(v);g.fillStyle='#9fb3c6';g.fillText(fmtI(v),2,yy+3);g.strokeStyle='#1b2733';g.beginPath();g.moveTo(AXW,yy);g.lineTo(W,yy);g.stroke()}
 LAY=[];let x=AXW;const lastRow=s.rows.at(-1);
 D.tracks.forEach((t,ti)=>{const w=Math.round(cw*('image' in t?1.6:1));LAY.push({x,w});g.strokeStyle='#253445';g.strokeRect(x+.5,HEAD,w-1,H-HEAD);g.fillStyle='#121c27';g.fillRect(x,0,w,HEAD);g.strokeRect(x+.5,.5,w-1,HEAD-1);
  g.save();g.beginPath();g.rect(x+1,0,w-2,H);g.clip();
  if('image' in t){drawImage(g,t,x,w,H,vis,y,top,bot)}else t.curves.forEach((c,k)=>{const j=s.ml?.indexOf(c.mn);if(j==null||j<0){g.fillStyle='#e57373';g.fillText(c.mn+' (none)',x+4,14+k*15);return}
   if(!Number.isFinite(c.min)||!Number.isFinite(c.max)){const vv=vis.map(r=>r[j]).filter(Number.isFinite);c.auto=vv.length?[Math.min(...vv),Math.max(...vv)]:[0,1]}
   g.strokeStyle=c.color;g.lineWidth=1.3;g.beginPath();let st=false;for(let i=0;i<vis.length;i+=stride){const r=vis[i],v=r[j];if(!Number.isFinite(v)){st=false;continue}const px=x+2+scale(c,v,w-4),py=y(r[0]);st?g.lineTo(px,py):g.moveTo(px,py);st=true}g.stroke();
   const lv=[...s.rows].reverse().find(r=>Number.isFinite(r[j]))?.[j];const a=Number.isFinite(c.min)?c.min:c.auto[0],b=Number.isFinite(c.max)?c.max:c.auto[1];
   g.fillStyle=c.color;g.font='bold 11px system-ui';g.fillText(c.mn+' '+(Number.isFinite(lv)?(+lv).toFixed(lv<10?2:0):'–')+' '+(s.ul?.[j]||''),x+4,13+k*22);g.font='9px system-ui';g.fillStyle='#9fb3c6';
   g.fillText(fmtN(a),x+4,23+k*22);const bt=fmtN(b);g.fillText(bt,x+w-6-g.measureText(bt).width,23+k*22);g.fillStyle=c.color;g.fillRect(x+4,25+k*22,w-10,1)});
  if(!('image' in t)&&t.curves.length==0){g.fillStyle='#9fb3c6';g.fillText('empty · tap to add',x+4,14)}
  g.restore();x+=w});
 // newest-data marker
 if(lastRow){const yy=y(lastRow[0]);g.strokeStyle='#ffd54f';g.setLineDash([4,3]);g.beginPath();g.moveTo(AXW,yy);g.lineTo(W,yy);g.stroke();g.setLineDash([])}
 const C=D.conn,n=$('wdNote');const lab=badge();
 n.textContent=(lab=='LIVE'?'LIVE · '+C.url.replace(/^https?:\/\//,'').split('/')[0]+' · '+C.log+' · last poll '+new Date(C.okAt).toLocaleTimeString():D.src=='WITSML'?'SIM label · store '+(C.sim?'is a SIMULATED test store':'not returning data yet')+(C.err?' · '+C.err:''):'SIM · simulated well data, not from a rig · Connect… to read a WITSML store')+
  ' · '+(D.mode=='depth'?'depth':'time')+' window '+(D.mode=='depth'?D.span.depth.toFixed(0)+' m':Math.round(D.span.time/60)+' min')+(D.auto?' · following newest':' · paused (Follow to resume)');head()}
function fmtN(v){return Math.abs(v)>=1000?(v/1000).toFixed(1)+'k':Math.abs(v)>=10?v.toFixed(0):(+v).toFixed(1)}
function niceStep(r){const p=10**Math.floor(Math.log10(r||1)),m=r/p;return (m<1.5?1:m<3.5?2:m<7.5?5:10)*p}
function drawImage(g,t,x,w,H,vis,y,top,bot){const s=cur();const im=D.imgs.find(i=>i.name==t.image)||null;
 g.fillStyle='#ddd';g.font='bold 11px system-ui';g.fillText(t.name,x+4,13);g.font='9px system-ui';g.fillStyle='#9fb3c6';
 if(!im){g.fillText('No image (array / sector) curves',x+4,26);g.fillText('in this log. Needs e.g. 8/16/32-',x+4,38);g.fillText('sector image GR or resistivity.',x+4,50);return}
 ['0°','90','180','270','360'].forEach((l,k)=>g.fillText(l,x+2+k*(w-14)/4,50));g.fillText(im.n+' sectors · '+(s.ul?.[im.cols[0]]||''),x+4,26);
 const rows=vis.map(r=>[r[0],K.imgRow(r,im)]).filter(r=>r[1]);if(!rows.length)return;
 const all=rows.flatMap(r=>r[1]).filter(Number.isFinite).sort((a,b)=>a-b),lo=all[Math.floor(all.length*0.02)]??0,hi=all[Math.floor(all.length*0.98)]??1;
 const logS=/ohm|res/i.test((s.ul?.[im.cols[0]]||'')+im.name);const nv=v=>logS?(Math.log10(Math.max(1e-3,v))-Math.log10(Math.max(1e-3,lo)))/((Math.log10(Math.max(1e-3,hi))-Math.log10(Math.max(1e-3,lo)))||1):(v-lo)/((hi-lo)||1);
 for(let i=0;i<rows.length;i++){const [d,v]=rows[i],y0=y(d),y1=i+1<rows.length?y(rows[i+1][0]):y0+2,h=Math.max(1,y1-y0+0.5),sw=(w-2)/v.length;
  for(let k=0;k<v.length;k++){if(!Number.isFinite(v[k]))continue;const c=K.cmap(nv(v[k]));g.fillStyle=`rgb(${c})`;g.fillRect(x+1+k*sw,y0,sw+0.6,h)}}
 if(D.sines&&rows.length>30){const dia=D.mode=='depth'?(s.ul?.[0]=='ft'?0.708:0.216):null;if(!dia){g.fillStyle='#fff';g.fillText('Sines: depth mode only',x+4,H-6);return}
  const sn=K.autoSines(rows.map(r=>r[0]),rows.map(r=>r[1]),dia,10);g.strokeStyle='#00e5ff';g.lineWidth=1.5;g.font='9px system-ui';
  for(const f of sn){g.beginPath();for(let k=0;k<=60;k++){const th=k/60*2*Math.PI,px=x+1+k/60*(w-2),py=y(f.z0+f.amp*Math.cos(th-f.az*Math.PI/180));k?g.lineTo(px,py):g.moveTo(px,py)}g.stroke();
   g.fillStyle='#00e5ff';g.fillText(`${f.dip.toFixed(0)}°/${f.az.toFixed(0)}°`,x+3,y(f.z0)-3)}}}
// ---------- track & curve picker ----------
function picker(focus){$('wdConn')?.remove();if($('wdPick')){$('wdPick').remove();if(typeof focus!='number')return}const s=cur(),ml=(s.ml||[]).slice(1);
 const P=document.createElement('div');P.id='wdPick';const opts=ml.map(m=>`<option>${m}</option>`).join('');
 P.innerHTML=`<b>Tracks and curves</b> <small style="color:#9fb3c6">min/max empty = auto scale</small>`+D.tracks.map((t,ti)=>`<div class=tr data-t=${ti} ${ti===focus?'style="border-color:#4b93d8"':''}><div style="display:flex;gap:6px;align-items:center"><input data-k=name value="${t.name}" style="flex:1"><button data-k=up>▲</button><button data-k=del>✕</button></div>`+
  ('image' in t?`<div class=cv style="grid-template-columns:1fr">Image: <select data-k=img><option value="">(none)</option>${D.imgs.map(i=>`<option ${i.name==t.image?'selected':''}>${i.name}</option>`).join('')}</select></div>`:
  t.curves.map((c,ci)=>`<div class=cv data-c=${ci}><span style="color:${c.color}">${c.mn}</span><input data-k=min placeholder=auto value="${Number.isFinite(c.min)?c.min:''}"><input data-k=max placeholder=auto value="${Number.isFinite(c.max)?c.max:''}"><label><input type=checkbox data-k=log ${c.log?'checked':''}>log</label><button data-k=rm>–</button></div>`).join('')+
  `<select data-k=add><option value="">+ add curve…</option>${opts}</select>`)+`</div>`).join('')+
  `<div style="display:flex;gap:6px;flex-wrap:wrap"><button id=wdAddT>+ Curve track</button><button id=wdAddI>+ Image track</button><button id=wdReset>Default tracks</button><button id=wdPickX>Done</button></div>`;
 D.el.appendChild(P);const re=()=>{render();P.remove();picker(typeof focus=='number'?focus:-1)};
 P.querySelectorAll('.tr').forEach(el=>{const t=D.tracks[+el.dataset.t];el.querySelector('[data-k=name]').onchange=e=>{t.name=e.target.value;render()};
  el.querySelector('[data-k=del]').onclick=()=>{D.tracks.splice(+el.dataset.t,1);re()};el.querySelector('[data-k=up]').onclick=()=>{const i=+el.dataset.t;if(i>0){[D.tracks[i-1],D.tracks[i]]=[D.tracks[i],D.tracks[i-1]];re()}};
  el.querySelector('[data-k=img]')&&(el.querySelector('[data-k=img]').onchange=e=>{t.image=e.target.value||null;t.name='Image '+(t.image||'');re()});
  el.querySelector('[data-k=add]')&&(el.querySelector('[data-k=add]').onchange=e=>{if(!e.target.value)return;const st=K.STD.find(d=>d[3].test(e.target.value));t.curves.push({mn:e.target.value,min:st?st[4][0]:NaN,max:st?st[4][1]:NaN,log:!!st?.[5],color:K.COLORS[t.curves.length%8]});re()});
  el.querySelectorAll('.cv[data-c]').forEach(cr=>{const c=t.curves[+cr.dataset.c];cr.querySelector('[data-k=min]').onchange=e=>{c.min=e.target.value===''?NaN:+e.target.value;render()};cr.querySelector('[data-k=max]').onchange=e=>{c.max=e.target.value===''?NaN:+e.target.value;render()};
   cr.querySelector('[data-k=log]').onchange=e=>{c.log=e.target.checked;render()};cr.querySelector('[data-k=rm]').onclick=()=>{t.curves.splice(+cr.dataset.c,1);re()}})});
 $('wdAddT').onclick=()=>{D.tracks.push({name:'Track '+(D.tracks.length+1),curves:[]});re()};$('wdAddI').onclick=()=>{D.tracks.push({name:'Image '+(D.imgs[0]?.name||''),image:D.imgs[0]?.name||null});re()};
 $('wdReset').onclick=()=>{D.tracks=defaultTracks(s.ml||[]);re()};$('wdPickX').onclick=()=>P.remove()}
// ---------- connection panel (credentials: memory only) ----------
function connPanel(){$('wdPick')?.remove();if($('wdConn')){$('wdConn').remove();return}if(!D.conn.connected)loadCfg();D.conn.proxy=String(D.conn.proxy).replace(/"/g,'');D.conn.url=String(D.conn.url).replace(/"/g,'');const C=D.conn,P=document.createElement('div');P.id='wdConn';
 P.innerHTML=`<b>WITSML store</b><label>Standard<select id=wdProto><option value=soap>WITSML 1.4.1.1 (SOAP)</option><option value=etp>WITSML 2.0 (ETP 1.2)</option></select></label>
 <label>Route<select id=wdVia><option value=proxy ${C.via=='proxy'?'selected':''}>Through a proxy</option><option value=direct ${C.via=='direct'?'selected':''}>Direct from browser (store must allow CORS)</option></select></label>
 <label id=wdProxyL>Proxy URL<input id=wdProxy value="${C.proxy}" list=wdProxyList autocomplete=off><datalist id=wdProxyList><option value="${HOSTED}"><option value="${LOCAL}"></datalist></label>
 <label>Store URL<input id=wdUrl value="${C.url}" placeholder="https://your-store/WMLS" autocomplete=off spellcheck=false></label>
 <label>User name<input id=wdUser value="${(CRED?.user||loadCfg()?.user||'').replace(/["<&]/g,'')}" autocomplete=off autocapitalize=off spellcheck=false></label><label>Password<input id=wdPass type=password autocomplete=off placeholder="(saved — leave blank to reuse)"></label><label style="display:flex;gap:6px;align-items:center"><input id=wdRem type=checkbox ${C.remember?'checked':''} style="width:auto">Remember password on this device</label>
 <div style="display:flex;gap:6px;flex-wrap:wrap"><button id=wdGo>${C.connected?'Reconnect':'Connect'}</button><button id=wdDis ${C.connected?'':'disabled'}>Disconnect</button><button id=wdCX>Close</button><button id=wdForget title="Clears the saved route, URLs, user name, password and last picks on this device">Forget saved connection</button></div>
 <div id=wdPickLog style="margin-top:6px"></div><div id=wdCSt style="margin-top:6px;color:#ffcc80"></div>
 <small>Saved on this device only: route, proxy URL, store URL, user name and last-picked well/wellbore/log. The password is kept for this browser tab (until it closes); tick <b>Remember password on this device</b> to keep it encrypted (AES-GCM, key locked in this browser) so the dashboard reconnects by itself next time. Leave the password blank to reuse the saved one. Nothing is synced, exported or logged. <b>Forget saved connection</b> clears all of it. Without a store the dashboard shows SIM data. The default proxy only reaches its one allowed store; for other stores run <code>node witsml_proxy.mjs</code> (local) or ask for a proxy for that store. WITSML 2.0 (ETP) is not in this build.</small>`;
 D.el.appendChild(P);$('wdCX').onclick=()=>P.remove();const sv=()=>{$('wdProxyL').style.display=$('wdVia').value=='proxy'?'':'none'};$('wdVia').onchange=sv;sv();
 $('wdDis').onclick=()=>{disconnect('Disconnected');P.remove()};if($('wdForget'))$('wdForget').onclick=async()=>{await forgetCfg();CRED=null;$('wdUser').value='';$('wdPass').value='';$('wdRem').checked=false;C.remember=false;$('wdCSt').textContent='Saved connection, user name and password cleared from this device'};
 $('wdGo').onclick=async()=>{const st=$('wdCSt');if($('wdProto').value=='etp'){st.textContent='WITSML 2.0 / ETP 1.2 is not in this build. Use a 1.4.1.1 SOAP endpoint (most stores have both).';return}
  Object.assign(C,{via:$('wdVia').value,proxy:$('wdProxy').value.trim(),url:$('wdUrl').value.trim(),connected:false,err:''});if(!/^https?:\/\//.test(C.url)){st.textContent='Enter the store URL (https://…)';return}
  {const nu=$('wdUser').value.trim(),np=$('wdPass').value;C.remember=$('wdRem').checked;if(np===''&&!(CRED&&CRED.user==nu&&CRED.pass)){const sc=await savedCred();if(sc&&sc.user==nu)CRED=sc}TYPED=np!=='';if(!(np===''&&CRED&&CRED.user==nu&&CRED.pass))CRED={user:nu,pass:np}}$('wdPass').value='';st.textContent='Connecting…';
  try{await call('WMLS_GetVersion');C.connected=true;C.sim=/\/sim\b|simulated/i.test(C.url);saveCfg();await savePw(CRED.pass,C.remember);TYPED=false;const ws=await listWells();if(!ws.length){st.textContent='Connected, but the store returned no wells for this login (empty result)';return}
   st.textContent='Connected · '+ws.length+' wells';const L=$('wdPickLog');L.innerHTML=`<label>Well<select id=wdW>${ws.map(w=>`<option value="${w.uid}">${w.name||w.uid}</option>`).join('')}</select></label><label>Wellbore<select id=wdB></select></label><label>Log<select id=wdL></select></label><button id=wdUse>Show this log</button>`;
   let logs=[];const wb=async()=>{const b=await listWbs($('wdW').value);$('wdB').innerHTML=b.map(x=>`<option value="${x.uid}">${x.name||x.uid}</option>`).join('');if(!b.length){$('wdL').innerHTML='';st.textContent='Connected, but the store returned no wellbores for well '+$('wdW').value+' (empty result)';return}const sv=loadCfg();if(sv&&b.some(x=>x.uid==sv.wb))$('wdB').value=sv.wb;await lg()};
   const lg=async()=>{logs=await listLogs($('wdW').value,$('wdB').value);if(!logs.length)st.textContent='Connected, but no logs in this wellbore (empty result)';$('wdL').innerHTML=logs.map(l=>`<option value="${l.uid}">${(l.name||l.uid)+' · '+(l.time?'time':'depth')+' · '+l.curves.length+' curves'}</option>`).join('')};
   $('wdW').onchange=()=>wb().catch(e=>st.textContent=e.message);$('wdB').onchange=()=>lg().catch(e=>st.textContent=e.message);await wb();
   $('wdUse').onclick=async()=>{const l=logs.find(x=>x.uid==$('wdL').value);if(!l)return;Object.assign(C,{well:$('wdW').value,wb:$('wdB').value,log:l.uid,logTime:l.time,okAt:0,hdr:null});saveCfg();
    const j=await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${C.well}" uidWellbore="${C.wb}" uid="${C.log}"/></logs>`,'returnElements=header-only').catch(e=>{st.textContent=e.message;return null});
    if(j){const hx=j.xml;C.uom=(hx.match(/<(?:\w+:)?endIndex[^>]*uom="([^"]*)"/)||[])[1]||'m';C.hdr={end:l.time?(hx.match(/<(?:\w+:)?endDateTimeIndex>([^<]*)</)||[])[1]:+((hx.match(/<(?:\w+:)?endIndex[^>]*>([^<]*)</)||[])[1])}}
    const s={ml:null,rows:[]};D.dep={ml:null,rows:[]};D.tim={ml:null,rows:[]};if(l.time)D.tim=s;else D.dep=s;D.conn.lastPoll=Date.now();D.src='WITSML';D.mode=l.time?'time':'depth';D.tracks=[];D.top=null;D.auto=true;await pollLive();if(!D.tracks.length&&s.ml)D.tracks=defaultTracks(s.ml);head();render();P.remove()}}
  catch(e){C.connected=false;CRED=null;TYPED=false;st.textContent='Connect failed: '+e.message}}}
