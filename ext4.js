// ext4.js: WITSML 1.4.1.1 live-data connection (via witsml_proxy.mjs). Credentials are session-only: held in memory, never stored or logged.
let C,S,el,PANEL,BTN;const $=id=>document.getElementById(id);
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const PKEY='dw34-witsml-ui';// stores ONLY proxy URL, server URL, poll interval, mapping. Never username/password.
const SIGNALS={spp:'Standpipe pressure',Q:'Flow in',hook:'Hookload',wob:'WOB',rpm:'Top drive RPM',md:'Measured depth',quill:'Block height',tq:'Top drive torque','p1.spm':'Pump 1 SPM','p2.spm':'Pump 2 SPM','p3.spm':'Pump 3 SPM','p4.spm':'Pump 4 SPM',rop:'ROP',bitdepth:'Bit depth',holedepth:'Hole depth (MD)'};
const AUTO=[[/^(SPPA|SPP|STPP|PRES_SP|SPPRESS)$/i,'spp'],[/^(MFIA|TFLO|FLOWIN|MFI|FLOW_IN|TFLOW|FLOW)$/i,'Q'],[/^(ROPA|ROP)$/i,'rop'],[/^(BDE|BITDEP|DBTM_BIT)$/i,'bitdepth'],[/^(DMEA|DBTM|HOLEDEP)$/i,'holedepth'],[/^(BHE|BPOS|BLKPOS|HKHT)$/i,'quill'],[/^(HKLA|HKLD|HOOKLOAD|HKL)/i,'hook'],[/^(SWOB|WOBA|WOB)/i,'wob'],[/^(RPMA|TDRPM|RPM|SRPM)/i,'rpm'],
 [/^(TQA|STOR|TORQ|TDTQ|TQ|TORQUE)/i,'tq'],[/^SPM ?1|^PUMP1|^SPM_1|^SPMA1/i,'p1.spm'],[/^SPM ?2|^PUMP2|^SPM_2|^SPMA2/i,'p2.spm'],[/^SPM ?3|^PUMP3|^SPM_3/i,'p3.spm'],[/^SPM ?4|^PUMP4|^SPM_4/i,'p4.spm']];
const HOSTED_PROXY='https://tryfecta-witsml-proxy.netlify.app/witsml-proxy';// default (Netlify: per-request cert skip for the Adaga host only)
const SUPABASE_PROXY='https://kxwuaasuaskfyecjmuwa.supabase.co/functions/v1/witsml-proxy';// fallback (cert always verified)
const CFG=Object.assign({proxy:HOSTED_PROXY,url:'https://australia.adagasolutions.com/WMLS',interval:15000,map:{},defWell:'DR101L',defWb:'WB01B02',defLog:'General Time-Based'},JSON.parse(localStorage.getItem(PKEY)||'{}'));
// v4.0: hosted HTTPS proxy is the default. Old saved localhost default is migrated (a custom URL is kept).
if((CFG.proxy==='http://localhost:8796/soap'||CFG.proxy===SUPABASE_PROXY)&&!CFG.proxyPinned)CFG.proxy=HOSTED_PROXY;if(!CFG.intervalV41){if(!CFG.interval||CFG.interval===10000)CFG.interval=15000;CFG.intervalV41=1}
// Credentials: sessionStorage only (cleared when the tab closes or on Disconnect); never localStorage, never logged.
const CKEY='dw-witsml-cred';let CRED={user:'',pass:''};try{const c=JSON.parse(sessionStorage.getItem(CKEY)||'null');if(c&&typeof c.user=='string')CRED={user:c.user,pass:String(c.pass||'')}}catch{}
const saveCred=()=>{try{CRED.user||CRED.pass?sessionStorage.setItem(CKEY,JSON.stringify(CRED)):sessionStorage.removeItem(CKEY)}catch{}};
const isHosted=u=>/\/functions\/v1\/witsml-proxy\b|^https:\/\/tryfecta-witsml-proxy\.netlify\.app\/witsml-proxy\b/.test(u||'');
// v3.9 survey feed: trajectory (+formationMarker) polling, incremental via mdMn, min 60 s, independent of the 10 s log poll
CFG.svWell=CFG.svWell||'DR101L';CFG.svWellbore=CFG.svWellbore||'WB01B02';CFG.svInterval=Math.max(60000,+CFG.svInterval||60000);
// memory only
const WML={status:'not connected',channels:{},log:null,last:null,timer:null,rows:0,polls:0,errors:0,simulated:false,fresh:0,
 mode:'off',liveMode:false,rp:null,okAt:0,miss:0,inflight:false,lastRowMs:0,stale:true,
 healthy(){return !!this.log&&this.okAt>0&&this.miss<3&&Date.now()-this.okAt<120000&&Object.keys(this.channels).length>0},
 tag(){if(this.mode=='replay')return 'replay';return this.healthy()?(this.simulated?'live-sim':'live'):'sim'},
 drives(id){if(this.mode=='replay')return 'replay';const ok=this.healthy();if(!ok)return null;for(const [mn,s] of Object.entries(CFG.map))if(s==id&&this.channels[mn]?.v!=null)return this.simulated?'live-sim':'live';return null}};
window.WML=WML;const saveCfg=()=>localStorage.setItem(PKEY,JSON.stringify({proxyPinned:CFG.proxyPinned,proxy:CFG.proxy,url:CFG.url,interval:CFG.interval,map:CFG.map}));
const REPLAY_ENABLED=false;// Replay from data hidden (disabled flag) until auth issue resolved
function authFail(e){WML.authDead=true;WML.connected=false;clearInterval(WML.sv.timer);WML.sv.timer=null;WML.sv.state='STOPPED · auth failure (no retry)';clearInterval(WML.timer);clearInterval(WML.chk);WML.timer=WML.chk=null;WML.liveMode=false;WML.log=null;WML.channels={};try{for(const k in C.SRC)if(C.SRC[k]=='live')C.SRC[k]='sim'}catch{};const m='Auth failed — polling stopped (no auto-retry; press Connect/Start to retry manually)';setSt(m,true);GX.feedStatus&&GX.feedStatus('Auth failed — polling stopped');const b=$('sim');if(b){b.textContent='SIMULATED - Auth failed, polling stopped';b.style.background='#b71c1c';b.style.color='#fff'}}
async function call(op,wmlType,query,options){if(WML.authDead)throw new Error('Auth failed — polling stopped');const hosted=isHosted(CFG.proxy),h={'Content-Type':'application/json'};if(hosted&&(CRED.user||CRED.pass))h['X-Witsml-Authorization']='Basic '+btoa(unescape(encodeURIComponent(CRED.user+':'+CRED.pass)));
 let r;try{r=await fetch(CFG.proxy,{method:'POST',headers:h,body:JSON.stringify(hosted?{url:CFG.url,op,wmlType,query,options}:{url:CFG.url,user:CRED.user,pass:CRED.pass,op,wmlType,query,options})})}catch(e){throw new Error('cannot reach the WITSML proxy (no internet or proxy down)')}
 if(r.status==401||r.status==403){authFail();throw new Error('Auth failed ('+r.status+') — polling stopped')}
 const j=await r.json();if(r.status==401||(j.error&&/Authentication failed|\b401\b/.test(j.error))){authFail();throw new Error('Auth failed — polling stopped')}if(j.error)throw new Error(j.error);if(op=='WMLS_GetFromStore'&&j.result<1)throw new Error('WITSML result '+j.result+' '+(j.supp||''));return j}
const xml=s=>new DOMParser().parseFromString(s||'<x/>','application/xml');const kids=(n,t)=>[...n.getElementsByTagNameNS('*',t)];const txt=(n,t)=>kids(n,t)[0]?.textContent?.trim()??'';
const setSt=(s,err)=>{WML.status=s;const e=$('wst');if(e){e.textContent=s;e.style.color=err?'#f88':'#fd8'}if(err)toast(s,true)};
// v4.0: never fail silently — every error/empty/not-connected message is also shown as a toast visible over the scene (phones included).
function toast(msg,err){let t=document.getElementById('wtoast');if(!t){t=document.createElement('div');t.id='wtoast';t.setAttribute('role','alert');t.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 34px);z-index:99999;max-width:min(92vw,560px);padding:10px 14px;border-radius:10px;font:600 14px/1.35 system-ui,sans-serif;box-shadow:0 4px 18px #0008;pointer-events:auto';t.onclick=()=>t.style.display='none';document.body.appendChild(t)}t.textContent=msg;t.style.background=err?'#b71c1c':'#1b5e20';t.style.color='#fff';t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',err?9000:5000)}
const NOT_CONN='Not connected — enter Adaga login in WITSML panel and press Connect';
function needConn(){if(WML.connected)return false;setSt(NOT_CONN,true);try{GX.witsml&&GX.witsml.isOpen&&!GX.witsml.isOpen()&&GX.witsml.open()}catch{};try{window.MOB&&MOB.on&&MOB.open&&MOB.open('witsml')}catch{};const u=$('wuser');if(u&&!u.value)setTimeout(()=>u.focus(),300);return true}
async function listWells(){const j=await call('WMLS_GetFromStore','well',`<wells ${NS}><well uid=""><name/></well></wells>`,'returnElements=id-only');return kids(xml(j.xml),'well').map(w=>({uid:w.getAttribute('uid'),name:txt(w,'name')||w.getAttribute('uid')}))}
async function listWellbores(w){const j=await call('WMLS_GetFromStore','wellbore',`<wellbores ${NS}><wellbore uidWell="${w}" uid=""><name/></wellbore></wellbores>`,'returnElements=id-only');return kids(xml(j.xml),'wellbore').map(b=>({uid:b.getAttribute('uid'),name:txt(b,'name')||b.getAttribute('uid')}))}
async function listLogs(w,b){const j=await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${w}" uidWellbore="${b}" uid=""/></logs>`,'returnElements=header-only');
 return kids(xml(j.xml),'log').map(l=>({uom:kids(l,'endIndex')[0]?.getAttribute('uom')||'',uid:l.getAttribute('uid'),name:txt(l,'name'),nameWell:txt(l,'nameWell'),indexType:txt(l,'indexType'),indexCurve:txt(l,'indexCurve'),start:txt(l,'startDateTimeIndex')||txt(l,'startIndex'),end:txt(l,'endDateTimeIndex')||txt(l,'endIndex'),
  curves:kids(l,'logCurveInfo').map(c=>({mn:txt(c,'mnemonic'),unit:txt(c,'unit')}))}))}
function autoMap(curves){for(const c of curves){if(CFG.map[c.mn]!==undefined)continue;const a=AUTO.find(([re])=>re.test(c.mn));CFG.map[c.mn]=a?a[1]:''}}
// ---- polling: get only rows after the last index ----
const bne=ms=>new Date(ms).toLocaleTimeString('en-AU',{timeZone:'Australia/Brisbane',hour:'2-digit',minute:'2-digit',hour12:false});
function check(){// stale = 3 missed polls in a row OR >2 min without a successful poll response
 const h=WML.healthy();if(h&&WML.stale){WML.stale=false;GX.feedStatus&&GX.feedStatus('live');S.events.push([S.t,WML.simulated?'WITSML feed SIM-TEST (not LIVE)':'WITSML feed LIVE'])}
 else if(!h&&!WML.stale&&WML.log){WML.stale=true;for(const k of FEEDSIG)if(C.SRC[k]=='live')C.SRC[k]='sim';C.sigRender();GX.feedStatus&&GX.feedStatus('stale, fell back to sim');S.events.push([S.t,'WITSML feed STALE ('+(WML.miss>=3?WML.miss+' missed polls':'no response >2 min')+'): signals fall back to SIMULATED'])}
 const L=WML.log;if(!L)return;const lr=WML.lastRowMs?bne(WML.lastRowMs):'—';
 if(h)setSt((WML.simulated?'SIMULATED TEST DATA':'LIVE')+' · last row '+lr+' AEST · '+L.name+' · rows '+WML.rows+' · polls '+WML.polls);
 else setSt('STALE — showing SIMULATED · last row '+lr+' AEST · missed polls '+WML.miss,true);
 if(WML.mode=='replay')return;const b=$('sim');if(b){const live=h&&!WML.simulated;b.textContent=live?(WML.liveMode?'LIVE MODE · rig driven by WITSML · ':'LIVE WITSML · ')+L.name+' · last row '+lr+' AEST':'SIMULATED - not real rig data';b.style.background=live?'#1db954':'#b8860b'}}
async function poll(){const L=WML.log;if(!L)return;if(WML.inflight){WML.miss++;check();return}const time=/time/i.test(L.indexType);let q;
 if(WML.last==null){const st=time?new Date(Date.parse(L.end)-60000).toISOString():String((+L.end||0)-10);q=time?`<startDateTimeIndex>${st}</startDateTimeIndex>`:`<startIndex uom="${L.uom||'m'}">${st}</startIndex>`}
 else q=time?`<startDateTimeIndex>${WML.last}</startDateTimeIndex>`:`<startIndex uom="${L.uom||'m'}">${WML.last}</startIndex>`;
 WML.inflight=true;
 try{const j=await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${L.w}" uidWellbore="${L.b}" uid="${L.uid}">${q}<logData><mnemonicList/><data/></logData></log></logs>`,'returnElements=data-only;maxReturnNodes=500');
  WML.polls++;WML.okAt=Date.now();WML.miss=0;const d=xml(j.xml);const ml=txt(d,'mnemonicList').split(',').map(s=>s.trim()),ul=txt(d,'unitList').split(',');let rows=kids(d,'data').map(n=>n.textContent.split(','));
  const ix=Math.max(0,ml.indexOf(L.indexCurve));const key=r=>time?Date.parse(r[ix]):+r[ix];if(WML.last!=null){const lk=time?Date.parse(WML.last):+WML.last;rows=rows.filter(r=>key(r)>lk)}
  if(rows.length){const r=rows.at(-1);WML.last=r[ix];WML.rows+=rows.length;WML.fresh=Date.now();WML.lastRowMs=time?Date.parse(r[ix]):Date.now();
   ml.forEach((mn,i)=>{if(i==ix)return;const v=r[i]===''||r[i]==null?null:+r[i];const ch=WML.channels[mn]||(WML.channels[mn]={unit:ul[i]||'',log:L.name});ch.unit=ul[i]||ch.unit;ch.v=isFinite(v)?v:null;ch.map=CFG.map[mn]||''})}
  else if(time&&!WML.lastRowMs&&L.end)WML.lastRowMs=Date.parse(L.end);
  if(WML.healthy())apply()}
 catch(e){WML.errors++;WML.miss++;S.events.push([S.t,'WITSML poll error: '+e.message])}
 finally{WML.inflight=false}check();renderMap();if(WML.covWell&&$('wcov'))covRender()}
// unit conversion to game units (psi, gpm, klbf, ft, ft/h, ft.lbf)
// v3.6: convert each channel by its own uom (log header) via units.js table -> game internal (imperial) units
const GAMEU={Q:'gpm',spp:'psi',hook:'klbf',wob:'klbf',md:'ft',holedepth:'ft',bitdepth:'ft',rop:'ft/h',tq:'ft.lbf',quill:'m'};
const conv=(s,v,u)=>{const g=GAMEU[s];if(!g||v==null||!u)return v;return U.x(v,u,g)};
const FEEDSIG=['spp','Q','hook','wob','rpm','md','quill'];const ALIAS={holedepth:'md'};
function apply(){const vals={};for(const [mn,s0] of Object.entries(CFG.map)){const ch=WML.channels[mn];const v=ch?.v;if(!s0||v==null)continue;const s=ALIAS[s0]||s0;if(FEEDSIG.includes(s))vals[s]=conv(s0,v,ch.unit)}
 if(Object.keys(vals).length){GX.feedPush(vals,WML.simulated?'SIMULATED WITSML test store':'WITSML '+WML.log.name);for(const k in vals)if(C.SRC[k]!='live'){C.SRC[k]='live'}C.sigRender()}}
const chv=n=>{for(const k of n){const c=WML.channels[k];if(c&&c.v!=null)return {v:c.v,u:c.unit}}return null};
function rigFromData(){S=window.G?.S||S;// data overrides the physics sim (not the player): depth, hookload/block, RPM, SPP/flow/pumps, WOB, torque
 const g=(n,s)=>{const c=chv(n);return c?conv(s,c.v,c.u):null};
 let hd=g(['DMEA','DBTM','HOLEDEP'],'md'),bd=g(['BDE','BITDEP'],'md'),hk=g(['HKL','HOOKLOAD','HKLA'],'hook'),rpm=g(['RPM','RPMA'],'x'),spp=g(['SPP','SPPA'],'spp'),q=g(['FLOW','Flow','MFIA','TFLO'],'Q'),wob=g(['WOB','SWOB'],'wob'),tq=g(['TORQUE','TQA'],'tq'),rop=g(['ROP','ROPA'],'rop'),bp=g(['BPOS','BLKPOS','BHE','HKHT'],'x');if(hd==null&&bd!=null){WML.maxBd=Math.max(WML.maxBd||0,bd);hd=WML.maxBd}// no hole-depth curve in the time log: hole depth = deepest bit depth seen
 if(hd!=null)S.md=hd;if(bd!=null){S.bitDepthLive_ft=bd;S.bitDepth=bd}if(hk!=null)S.hook=hk;if(rpm!=null){S.td.rpm=rpm;S.bitRpm=rpm}if(spp!=null)S.spp=spp;if(q!=null)S.Q=q;if(wob!=null)S.wob=wob;if(tq!=null){S.td.torque=tq;S.td.tq=tq}if(rop!=null)S.rop=rop;
 // block position: use BPOS if present, else derive from how far the bit is off bottom within a stand (block rises as bit comes off bottom)
 if(bp!=null)S.dw.quill=bp;else if(hd!=null&&bd!=null){const off=Math.max(0,(hd-bd)*0.3048);S.dw.quill=Math.min(28.5,(S.stickup||1.5)+(off%27))}
 if(q!=null&&S.pumps?.length){const n=q>20?Math.max(1,Math.min(S.pumps.length,Math.ceil(q/450))):0;S.pumps.forEach((p,i)=>{const on=i<n;p.on=on;p.cmd=p.spm=on?+(q/n/4.36).toFixed(1):0})}
 S.slips=hk!=null&&hk<45&&(rpm||0)<1&&(q||0)<20}
function drive(){S=window.G?.S||S;if(WML.mode=='replay'){rigFromData();return}if(WML.liveMode&&WML.healthy()){rigFromData();return}// every sim step: hold pump SPM and top-drive torque at their mapped live values while the data is fresh
 if(!WML.healthy())return;for(const [mn,s] of Object.entries(CFG.map)){const ch=WML.channels[mn];const v=ch?.v;if(v==null||!s)continue;
  if(s=='rop'){S.rop=conv('rop',v,ch.unit);continue}if(s=='bitdepth'){S.bitDepthLive_ft=conv('bitdepth',v,ch.unit);continue}if(s=='tq'){const t=conv('tq',v,ch.unit);S.td.torque=t;S.td.tq=t;continue}
  const m=s.match(/^p(\d)\.spm$/);if(m){const p=S.pumps.find(p=>p.id==+m[1]);if(p){p.on=v>0;p.cmd=v;p.spm=v}}}}
async function start(L){stop(true);WML.log=L;WML.last=null;WML.rows=0;WML.polls=0;WML.channels={};WML.maxBd=0;WML.okAt=0;WML.miss=0;WML.lastRowMs=0;WML.stale=true;WML.inflight=false;L.uom=L.uom||(/time/i.test(L.indexType)?'':'m');WML.simulated=/SIMULATED|SIM-TEST/i.test(L.nameWell+' '+L.name)||/\/sim\/witsml/.test(CFG.url)||/\/\/(127\.0\.0\.1|localhost)[:/]/.test(CFG.url);autoMap(L.curves);saveCfg();
 S.events.push([S.t,'WITSML connected: '+L.name+(WML.simulated?' (SIMULATED test store)':'')]);await poll();WML.timer=setInterval(poll,Math.max(10000,CFG.interval));WML.chk=setInterval(check,5000)}
function stop(quiet){if(WML.timer)clearInterval(WML.timer);if(WML.chk)clearInterval(WML.chk);WML.timer=WML.chk=null;WML.fresh=0;WML.okAt=0;if(!quiet){WML.log=null;setSt('not connected');GX.feedStatus&&GX.feedStatus('not connected');const b=$('sim');if(b){b.textContent='SIMULATED - not real rig data';b.style.background='#b8860b'}for(const k of FEEDSIG)if(C.SRC[k]=='live')C.SRC[k]='sim';C.sigRender()}}
// ---- REPLAY · real data (read-only GetFromStore with a time range; never labelled LIVE) ----
async function loadReplay(L,hours,onProg){const t1=Date.parse(L.end)||Date.now(),t0=t1-hours*3600e3;let from=new Date(t0).toISOString(),rows=[],ml=null,ul=null,guard=0;
 while(guard++<200){const j=await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${L.w}" uidWellbore="${L.b}" uid="${L.uid}"><startDateTimeIndex>${from}</startDateTimeIndex><endDateTimeIndex>${new Date(t1).toISOString()}</endDateTimeIndex><logData><mnemonicList/><data/></logData></log></logs>`,'returnElements=data-only;maxReturnNodes=5000');
  const d=xml(j.xml);ml=ml||txt(d,'mnemonicList').split(',').map(s=>s.trim());ul=ul||txt(d,'unitList').split(',');const ix=Math.max(0,ml.indexOf(L.indexCurve));
  let r=kids(d,'data').map(n=>n.textContent.split(','));const last=rows.length?rows.at(-1).t:-1;r=r.map(x=>({t:Date.parse(x[ix]),x})).filter(o=>o.t>last);if(!r.length)break;rows.push(...r);onProg&&onProg(rows.length,rows.at(-1).t);from=new Date(rows.at(-1).t+1).toISOString();if(rows.at(-1).t>=t1-1000)break}
 const ix=Math.max(0,(ml||[]).indexOf(L.indexCurve));return{ml,ul,ix,rows,t0:rows[0]?.t,t1:rows.at(-1)?.t}}
function replaySet(t){const R=WML.rp;if(!R||!R.rows.length)return;R.t=Math.max(R.t0,Math.min(R.t1,t));let lo=0,hi=R.rows.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(R.rows[m].t<=R.t)lo=m;else hi=m-1}
 const r=R.rows[lo].x;R.ml.forEach((mn,i)=>{if(i==R.ix)return;const v=r[i]===''?null:+r[i];const ch=WML.channels[mn]||(WML.channels[mn]={unit:R.ul[i]||'',log:'REPLAY '+(WML.log?.name||'')});ch.v=isFinite(v)?v:null});
 const lab='REPLAY · real data · '+new Date(R.t).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})+' AEST · '+R.speed+'x';
 const b=$('sim');if(b){b.textContent=lab;b.style.background='#7c4dff'}const sc=$('wrsc');if(sc&&!R.drag)sc.value=Math.round((R.t-R.t0)/(R.t1-R.t0||1)*1000);const tl=$('wrt');if(tl)tl.textContent=lab;
 if(GX.feedStatus)GX.feedStatus('REPLAY · real data');for(const k of FEEDSIG)if(C.SRC[k]=='live')C.SRC[k]='sim';}
function replayTick(){const R=WML.rp;if(!R||!R.playing)return;const now=performance.now(),dt=(now-(R.lt||now))/1000;R.lt=now;replaySet(R.t+dt*1000*R.speed);if(R.t>=R.t1)R.playing=false}
async function startReplay(L,hours,speed){if(!REPLAY_ENABLED)return setSt('Replay from data is disabled',true);stop(true);WML.mode='loading';setSt('loading replay…');const R=await loadReplay(L,hours,(n,t)=>setSt('loading replay… '+n+' rows'));if(!R.rows.length){WML.mode='off';return setSt('replay: no rows in range',true)}
 WML.log=L;WML.channels={};WML.maxBd=0;WML.rp=Object.assign(R,{t:R.t0,speed:speed||10,playing:true,lt:0});WML.mode='replay';setSt('REPLAY · real data · '+R.rows.length+' rows ('+hours+' h)');S.events.push([S.t,'REPLAY · real data: '+R.rows.length+' rows of '+L.name]);
 clearInterval(WML.rpt);WML.rpt=setInterval(replayTick,100);replaySet(R.t0);return R.rows.length}
function stopReplay(){clearInterval(WML.rpt);WML.rpt=null;WML.rp=null;if(WML.mode=='replay'){WML.mode='off';WML.channels={};WML.log=null;GX.feedStatus&&GX.feedStatus('not connected');const b=$('sim');if(b){b.textContent='SIMULATED - not real rig data';b.style.background='#b8860b'}setSt('replay stopped')}}
function setLiveMode(v){WML.liveMode=!!v;const b=$('wlm');if(b){b.textContent='LIVE MODE: '+(v?'ON':'OFF');b.style.background=v?'#1db954':'#444'}const c=$('wlmc');if(c)c.checked=!!v;S.events.push([S.t,'LIVE MODE '+(v?'ON: rig follows WITSML data':'OFF')]);check()}
// ---- UI ----
const svSimTest=()=>WML.simulated||/\/\/(127\.0\.0\.1|localhost)[:/]/.test(CFG.url)||/\/sim\/witsml/.test(CFG.url);
function svParse(x){const d=xml(x),out=[];const cv=(n,t)=>{const e=kids(n,t)[0];if(!e)return null;const v=parseFloat(e.textContent),u=(e.getAttribute('uom')||'').toLowerCase();if(!isFinite(v))return null;return {v,u}};
 for(const tr of kids(d,'trajectory')){const nm=txt(tr,'name');for(const s of kids(tr,'trajectoryStation')){const md=cv(s,'md'),inc=cv(s,'incl'),az=cv(s,'azi'),tv=cv(s,'tvd');if(!md||!inc||!az)continue;const ft=o=>o&&(o.u=='m'?o.v/0.3048:o.v),dg=o=>o.u=='rad'?o.v*180/Math.PI:o.v;
 out.push({uid:s.getAttribute('uid')||'',md:ft(md),inc:dg(inc),azi:dg(az),tvdRep:tv?ft(tv):null,t:txt(s,'dTimStn'),nativeMd:md.v,uom:md.u||'ft',name:nm})}}return out.sort((a,b)=>a.md-b.md)}
async function svPoll(){const V=WML.sv;if(WML.authDead){svStop('STOPPED · auth failure (no retry)');return}if(V.busy)return;V.busy=true;V.polls++;
 try{const q=`<trajectorys ${NS}><trajectory uidWell="${CFG.svWell}" uidWellbore="${CFG.svWellbore}" uid=""><nameWell/><name/>${V.lastMd!=null?`<mdMn uom="${V.uom}">${V.lastMd}</mdMn>`:''}<trajectoryStation uid=""><dTimStn/><md uom=""/><tvd uom=""/><incl uom=""/><azi uom=""/></trajectoryStation></trajectory></trajectorys>`;
  const j=await call('WMLS_GetFromStore','trajectory',q,'returnElements=requested');const st=svParse(j.xml);
  const fresh=V.lastMd==null?st:st.filter(x=>x.nativeMd>V.lastMd+1e-6);V.lastFetched=st.length;
  if(st.length){const l=st.at(-1);if(V.lastMd==null||l.nativeMd>V.lastMd){V.lastMd=l.nativeMd;V.uom=l.uom}}
  const sim=svSimTest()||/SIM/i.test(st[0]?.name||''),n=fresh.length&&window.GEO?GEO.appendStations(fresh,{live:!sim,simTest:sim,src:sim?'WITSML SIM-TEST':'WITSML',name:CFG.svWell+'/'+CFG.svWellbore}):0;
  V.added+=n;V.dups+=st.length-n;V.err='';if(V.polls==1)st.length?toast('Survey feed: '+st.length+' stations read'):setSt('Survey feed: server returned no trajectory stations for '+CFG.svWell+'/'+CFG.svWellbore,true);
  if(V.fm!='unsupported'&&(V.polls==1||V.polls%5==0)){try{const j=await call('WMLS_GetFromStore','formationMarker',`<formationMarkers ${NS}><formationMarker uidWell="${CFG.svWell}" uidWellbore="${CFG.svWellbore}" uid=""/></formationMarkers>`,'returnElements=all');V.fm=/formationMarker\b[^s]/.test(j.xml)?'ok':'none';const h=j.xml.length+':'+j.xml.slice(-200);if(h!=V.fmHash&&/formationMarker\b[^s]/.test(j.xml)){V.fmHash=h;GEO.importLayers&&GEO.importLayers(j.xml,sim?'WITSML SIM-TEST':'WITSML');GEO.layerSrc=sim?'SIM-TEST':'LIVE';GEO.save&&0}}catch(e){if(WML.authDead)throw e;V.fm='unsupported'}}
  V.state=(WML.authDead?'STOPPED':'polling every '+CFG.svInterval/1000+' s')+(sim?' · SIM-TEST (mock upstream, not LIVE)':' · LIVE')}
 catch(e){V.err=e.message;setSt('Survey feed error: '+e.message,true);if(WML.authDead)svStop('STOPPED · auth failure (no retry)')}finally{V.busy=false;svRender()}}
function svStart(){const V=WML.sv;if(WML.authDead){V.state='refused · auth failed earlier — reload page/restart proxy';svRender();return}svStop();Object.assign(V,{lastMd:null,uom:null,polls:0,added:0,dups:0,fm:'unknown',fmHash:'',err:''});CFG.svInterval=Math.max(60000,+CFG.svInterval||60000);V.state='starting';const pr=svPoll();V.timer=setInterval(svPoll,CFG.svInterval);return pr}
function svStop(why){clearInterval(WML.sv.timer);WML.sv.timer=null;WML.sv.state=why||'stopped';svRender()}
function svRender(){const e=$('svst');if(!e)return;const V=WML.sv;e.textContent=`${V.state} · polls ${V.polls} · +${V.added} new · ${V.dups} dup/skipped · last MD ${V.lastMd??'–'} ${V.uom||''} · formationMarker: ${V.fm}${V.err?' · '+V.err:''}`;e.style.color=WML.authDead?'#f66':'#fd8'}
// ---- v3.9 per-well replica: switching well/wellbore fully resets state, then rebuilds from that well's own data ----
WML.cov={};WML.wellInfo=null;WML.sv={timer:null,lastMd:null,uom:null,polls:0,added:0,dups:0,fm:'unknown',fmHash:'',state:'idle',err:''};
const num=(n,t)=>{const v=parseFloat(txt(n,t));return isFinite(v)?v:null};
async function tryGet(typ,q,opt){try{const j=await call('WMLS_GetFromStore',typ,q,opt||'returnElements=all');return xml(j.xml)}catch(e){if(WML.authDead)throw e;return null}}
function resetAll(tag){svStop('switching well');stop(true);WML.log=null;WML.last=null;WML.rows=0;WML.polls=0;WML.channels={};WML.maxBd=0;WML.lastRowMs=0;WML.cov={};WML.wellInfo=null;for(const k in CFG.map)delete CFG.map[k];
 const TR=GX.traces&&GX.traces.TR;if(TR){TR.t=[];TR.marks=[];TR.last=-1e9;for(const t of TR.tracks){TR.data[t.id]=[];t.srcs=[]}}
 S=window.G?.S||S;S.md=0;S.bitDepth=0;S.bitDepthLive_ft=null;S.rop=0;S.Q=0;S.spp=0;S.wob=0;S.hook=0;if(S.td){S.td.rpm=0;S.td.torque=0;S.td.tq=0}(S.pumps||[]).forEach(p=>{p.on=false;p.cmd=p.spm=0});S._lastBD=null;
 try{for(const k in C.SRC)if(C.SRC[k]=='live')C.SRC[k]='sim';C.sigRender()}catch{}
 window.GEO&&GEO.resetWell(tag);S.events.push([S.t,'Well switched to '+tag+': all state reset (traces, survey, layers, depths, pumps, caches)'])}
async function loadWell(w,b){if(WML.authDead){setSt('Auth failed earlier — not loading',true);return}const tag=w+'/'+b;resetAll(tag);setSt('loading well replica '+tag+'…');
 const sim=svSimTest()||/\/\/(127\.0\.0\.1|localhost)[:/]/.test(CFG.url),T=sim?'SIM-TEST':'LIVE',cv=WML.cov,set=(k,st,n)=>cv[k]={st,n:n||''};WML.covWell=tag;WML.covSim=sim;
 const I=WML.wellInfo={uid:w,wb:b};
 const dw=await tryGet('well',`<wells ${NS}><well uid="${w}"><name/><field/><country/><wellLocation><latitude/><longitude/></wellLocation></well></wells>`);const we=dw&&kids(dw,'well')[0];
 if(we){I.name=txt(we,'name');I.field=txt(we,'field');I.lat=num(we,'latitude');I.lon=num(we,'longitude')}set('Well name',we?T:'missing',I.name||'');set('Location',I.lat!=null?T:'missing',I.lat!=null?I.lat.toFixed(4)+', '+I.lon.toFixed(4)+(I.field?' · '+I.field:''):(I.field||'')+' (none from server → not shown)');
 const dr=await tryGet('rig',`<rigs ${NS}><rig uidWell="${w}" uidWellbore="${b}" uid=""/></rigs>`);const ri=dr&&kids(dr,'rig')[0];I.rig=ri?txt(ri,'name'):null;set('Rig name',ri?T:'SIM',ri?I.rig:'no rig object → SIM rig model');
 const dg=await tryGet('wbGeometry',`<wbGeometrys ${NS}><wbGeometry uidWell="${w}" uidWellbore="${b}" uid=""/></wbGeometrys>`);const secs=dg?kids(dg,'wbGeometrySection').map(x=>{const u=e=>(kids(x,e)[0]?.getAttribute('uom')||'m').toLowerCase(),f=(e)=>{const v=num(x,e);return v==null?null:(u(e)=='m'?v/0.3048:v)};const ty=txt(x,'typeHoleCasing');return{type:ty,mdTop:f('mdTop')||0,mdBot:f('mdBottom')||0,od:num(x,'odSection'),cased:!/open/i.test(ty),tag:T}}).filter(x=>x.mdBot>x.mdTop):[];
 window.GEO&&GEO.setCasing(secs);set('Wellbore geometry / casing',secs.length?T:'SIM',secs.length?secs.length+' sections':'no wbGeometry → SIM default casing');
 CFG.svWell=w;CFG.svWellbore=b;saveCfg();await svStart();
 let ls=[];try{ls=await listLogs(w,b)}catch(e){if(WML.authDead)return}const L=ls.find(l=>/time/i.test(l.indexType))||ls[0];
 if(L){await start({...L,w,b})}
 const tagEl=$('wtag')||(()=>{const e=el('div','position:fixed;left:8px;bottom:8px;z-index:20;background:#000a;color:#fff;padding:4px 8px;border-radius:4px;font:12px system-ui');e.id='wtag';document.body.appendChild(e);return e})();
 tagEl.innerHTML=`<b>${(I.name||w).replace(/</g,'&lt;')}</b> / ${b} · Rig: ${I.rig?I.rig.replace(/</g,'&lt;')+' ['+T+']':'SIM rig model [SIM]'} · Loc: ${I.lat!=null?I.lat.toFixed(3)+', '+I.lon.toFixed(3)+' ['+T+']':'missing'}`;
 if(!we&&!secs.length&&!L)setSt('Load well: server returned no data for '+tag+' (no well, geometry or logs)',true);else toast('Loaded '+tag+(L?'':' — no logs found'));
 setSt((sim?'SIM-TEST replica of ':'LIVE replica of ')+tag+' loaded');covRender();return WML.cov}
function covCompute(){const cv=WML.cov;if(!WML.covWell)return cv;const T=WML.covSim?'SIM-TEST':'LIVE',V=WML.sv,set=(k,st,n)=>cv[k]={st,n:n||''};
 const g=window.GEO,ns=g?.surv?.stations?.length||0;set('Trajectory / drill path',ns?T:'SIM',ns?ns+' stations, last MD '+(g.surv.stations.at(-1).md*0.3048).toFixed(0)+' m · beyond = PROJECTED · SIM':'no trajectory → SIM path');
 set('Formation markers',V.fm=='ok'?T:'SIM',V.fm=='ok'?(g?.layers?.length||0)+' layers':'formationMarker '+V.fm+' → SIM example layers');
 const mapped=Object.entries(CFG.map).filter(([mn,s])=>s&&WML.channels[mn]),has=re=>mapped.some(([,s])=>re.test(s));const chs=Object.keys(WML.channels);
 set('Log channels',chs.length?T:'missing',chs.length?chs.length+' channels ('+chs.join(', ')+'), '+mapped.length+' mapped':'no log data');
 const hd=has(/^(md|holedepth)$/),bd=has(/^bitdepth$/)||!!chv(['BDE','BITDEP']);set('Hole depth',hd?T:'SIM',hd?'from log':'→ SIM');set('Bit depth',bd?T:(hd?'SIM':'SIM'),bd?'from log':'no bit-depth channel → SIM (derived from hole depth)');
 const pu=has(/^(Q|p\d\.spm)$/)||!!chv(['SPM1','SPM2','MFIA','FLOW']);set('Pumps / flow',pu?T:'SIM',pu?'from log':'→ SIM');
 set('Rig (hook/WOB/RPM/torque)',has(/^(hook|wob|rpm|tq)$/)||!!chv(['HKLA','SWOB','RPMA','TQA'])?T:'SIM',['HKLA','SWOB','RPMA','TQA'].filter(k=>WML.channels[k]).join(', ')||'→ SIM');
 set('Traces',chs.length?T+' + SIM':'SIM','reset on switch; channels tagged '+T+', the rest SIM');return cv}
function covRender(){covCompute();let p=$('wcov');if(!WML.covWell)return;if(!p){p=el('div',PANEL+';right:8px;top:60px;width:440px;max-height:70vh;overflow:auto');p.id='wcov';document.body.appendChild(p)}
 const col={LIVE:'#1a7f37','SIM-TEST':'#e08a00',SIM:'#8a6d1a',missing:'#7a2b2b'};
 p.innerHTML=`<b style="color:#8fd">Data coverage · ${WML.covWell}</b> ${WML.covSim?'<span style="background:#e08a00;padding:1px 5px;border-radius:3px">SIM-TEST mock upstream — not LIVE</span>':''} <button id=wcovx style="${BTN}">✕</button><table style="width:100%;font-size:12px;margin-top:4px">${Object.entries(WML.cov).map(([k,v])=>`<tr><td>${k}</td><td><span style="background:${col[v.st]||'#555'};padding:1px 6px;border-radius:3px;color:#fff">${v.st}</span></td><td style="color:#bcd">${String(v.n).replace(/</g,'&lt;')}</td></tr>`).join('')}</table>`;$('wcovx').onclick=()=>p.remove()}
let P,logs=[],SELC=null;function ui(){const b=el('button','background:#2c5d9e;color:#fff;font-weight:700','🛰 WITSML');b.id='wbtn';b.onclick=()=>toggle();$('hud').appendChild(b);
 const m=el('button','background:#444;color:#fff;font-weight:700','LIVE MODE: OFF');m.id='wlm';m.title='When ON (and the WITSML feed is healthy) the 3D rig and equipment follow the real data, overriding the physics sim';m.onclick=()=>setLiveMode(!WML.liveMode);$('hud').appendChild(m)}
function toggle(v){if(P&&v!==true){SELC=['wwell','wwb','wlog'].map(id=>[$(id).innerHTML,$(id).value]);P.remove();P=null;return}if(P)return;P=el('div',PANEL+';left:50%;top:50px;transform:translateX(-50%);width:560px;max-height:80vh;overflow:auto');P.id='witsml';
 P.innerHTML=`<b style="color:#8fd">WITSML live data</b> <small>1.4.1.1 SOAP · WMLS_GetFromStore · well → wellbore → log</small>
 <div style="display:grid;grid-template-columns:110px 1fr;gap:3px;margin-top:4px">
 <span>Protocol</span><select id=wproto><option value=soap>WITSML 1.4.1.1 SOAP (via proxy)</option><option value=etp disabled>WITSML 2.0 ETP 1.2 WebSocket (not in this build)</option></select>
 <span>Proxy</span><span><input id=wproxy list=wproxyl value="${CFG.proxy}"><datalist id=wproxyl><option value="${HOSTED_PROXY}">Netlify (default)</option><option value="${SUPABASE_PROXY}">Supabase fallback (cert must be valid)</option></datalist></span><span>Server URL</span><input id=wurl value="${CFG.url}">
 <span>Username</span><input id=wuser autocomplete=off placeholder="session only, never saved"><span>Password</span><input id=wpass type=password autocomplete=new-password placeholder="session only, never saved">
 <span>Poll every</span><span><input id=wint style="width:60px" value="${CFG.interval}"> ms</span></div>
 <button id=wcon style="${BTN}">Connect + list wells</button><button id=wsim style="${BTN}">Use SIMULATED test store</button><button id=wstop style="${BTN}">Disconnect</button><button id=wx style="${BTN}">Close</button>
 <div style="margin:4px 0">Well <select id=wwell style="max-width:150px"></select> Wellbore <select id=wwb style="max-width:130px"></select> Log <select id=wlog style="max-width:170px"></select> <button id=wgo style="${BTN}">▶ Start live</button></div>
 <div style="margin:4px 0"><button id=wrep style="${BTN}">🛢 Load full well replica</button> (resets everything, rebuilds from this well; Data coverage panel)</div>
 <div style="margin:4px 0"><label><input type=checkbox id=wlmc ${WML.liveMode?'checked':''}> <b>LIVE MODE</b> – rig &amp; equipment follow the real WITSML values (overrides the sim)</label></div>
 <div id=wrbox style="display:${REPLAY_ENABLED?'block':'none'};margin:4px 0;padding:4px;border:1px solid #7c4dff;border-radius:4px"><b style="color:#b9a3ff">Replay from data</b> last <input id=wrh style="width:40px" value="2"> h
 at <select id=wrs>${[1,2,5,10,20,30,60].map(v=>`<option ${v==10?'selected':''}>${v}</option>`).join('')}</select>x <button id=wrgo style="${BTN}">Load + play</button><button id=wrpp style="${BTN}">⏯</button><button id=wrx style="${BTN}">Stop replay</button>
 <input id=wrsc type=range min=0 max=1000 value=0 style="width:100%"><div id=wrt style="color:#b9a3ff;font-size:11px">REPLAY · real data – never shown as LIVE</div></div>
 <div style="margin:4px 0;padding:4px;border:1px solid #2f7fd0;border-radius:4px"><b style="color:#8cf">Survey feed</b> (trajectory + formationMarker, incremental by mdMn) well <input id=svw style="width:70px" value="${CFG.svWell}"> wellbore <input id=svb style="width:70px" value="${CFG.svWellbore}"> every <input id=svi style="width:40px" value="${CFG.svInterval/1000}"> s (min 60) <button id=svgo style="${BTN}">▶ Start survey feed</button><button id=svx style="${BTN}">Stop</button><div id=svst style="font-size:11px;color:#fd8">${WML.sv.state}</div></div>
 <div>Status: <span id=wst style="color:#fd8">${WML.status}</span></div><div id=wlinfo style="color:#9ab;font-size:11px"></div>
 <div id=wmap style="margin-top:4px"></div>
 <small style="color:#9ab">Default proxy: hosted HTTPS function (read-only, one allowed server, stores no credentials). Your username/password stay in this tab's sessionStorage and are sent per request as Basic auth; cleared on Disconnect or when the tab closes. A 401 stops all polling. Local alternative: <code>node witsml_proxy.mjs</code> → http://localhost:8796/soap. Every curve is also addable in 📈 Traces → "WITSML channel". ETP 2.0 (Avro binary over WebSocket) is not implemented yet.</small>`;
 document.body.appendChild(P);if(SELC)['wwell','wwb','wlog'].forEach((id,i)=>{$(id).innerHTML=SELC[i][0];$(id).value=SELC[i][1]});
 if($('wuser')&&!$('wuser').value&&CRED.user){$('wuser').value=CRED.user;$('wpass').value=CRED.pass}
 const read=()=>{CFG.proxy=$('wproxy').value.trim();CFG.url=$('wurl').value.trim();CFG.interval=Math.max(10000,+$('wint').value||15000);$('wint').value=CFG.interval;CRED.user=$('wuser').value;CRED.pass=$('wpass').value;saveCred();CFG.proxyPinned=CFG.proxy!==HOSTED_PROXY;saveCfg()};
 const fill=(id,arr,def)=>{$(id).innerHTML=arr.map(o=>`<option value="${o.uid}">${o.name.replace(/</g,'&lt;')}</option>`).join('');const d=def&&arr.find(o=>o.name.trim()==def);if(d)$(id).value=d.uid};
 const wbs=async()=>{try{fill('wwb',await listWellbores($('wwell').value),CFG.defWb);await lgs()}catch(e){setSt('error: '+e.message,true)}};
 const lgs=async()=>{try{logs=await listLogs($('wwell').value,$('wwb').value);fill('wlog',logs.map(l=>({uid:l.uid,name:l.name+' ['+(/time/i.test(l.indexType)?'time':'depth')+']'})));const dl=logs.find(l=>l.name.trim()==CFG.defLog);if(dl)$('wlog').value=dl.uid;info()}catch(e){setSt('error: '+e.message,true)}};
 const info=()=>{const l=logs.find(l=>l.uid==$('wlog').value);$('wlinfo').textContent=l?`${l.indexType} · index ${l.indexCurve} · ${l.start} → ${l.end} · ${l.curves.length} curves: ${l.curves.map(c=>c.mn).join(', ')}`:'';if(l){autoMap(l.curves);WML.preview=l;renderMap()}};
 $('wcon').onclick=async()=>{read();WML.connected=false;if(isHosted(CFG.proxy)&&!/\/sim\//.test(CFG.url)&&(!CRED.user||!CRED.pass)){setSt('Enter your Adaga username and password, then press Connect',true);($('wuser').value?$('wpass'):$('wuser')).focus();return}setSt('connecting…');try{const v=await call('WMLS_GetVersion');WML.connected=true;setSt('connected · server versions '+(v.version||'?'));const ws=(await listWells()).sort((a,b)=>a.name.localeCompare(b.name));fill('wwell',ws,CFG.defWell);if(!ws.length){setSt('Connected, but the server returned no wells for this login',true);return}toast('Connected · '+ws.length+' wells');await wbs()}catch(e){WML.connected=false;setSt('Connect failed: '+e.message,true)}};
 $('wsim').onclick=()=>{$('wurl').value=CFG.proxy.replace(/\/soap$/,'/sim/witsml');$('wcon').click()};
 $('wlmc').onchange=e=>setLiveMode(e.target.checked);
 $('wrgo').onclick=()=>{read();if(needConn())return;const l=logs.find(l=>l.uid==$('wlog').value);if(!l)return setSt('pick a log first',true);if(!/time/i.test(l.indexType))return setSt('replay needs a time-based log',true);startReplay({...l,w:$('wwell').value,b:$('wwb').value},+$('wrh').value||2,+$('wrs').value).catch(e=>setSt('replay error: '+e.message,true))};
 $('wrs').onchange=()=>{if(WML.rp)WML.rp.speed=+$('wrs').value};$('wrpp').onclick=()=>{const R=WML.rp;if(R){R.playing=!R.playing;R.lt=0}};$('wrx').onclick=stopReplay;
 $('wrsc').oninput=()=>{const R=WML.rp;if(R){R.drag=true;replaySet(R.t0+(R.t1-R.t0)*$('wrsc').value/1000);R.drag=false}};
 const sw=()=>{if(WML.log||WML.liveMode||WML.covWell){read();if(needConn())return;loadWell($('wwell').value,$('wwb').value)}};$('wwell').onchange=async()=>{await wbs();sw()};$('wwb').onchange=async()=>{await lgs();sw()};$('wlog').onchange=info;$('wstop').onclick=()=>{WML.connected=false;stop();svStop('stopped (disconnect)');CRED={user:'',pass:''};saveCred();$('wuser').value=$('wpass').value=''};$('wx').onclick=()=>toggle();
 $('wgo').onclick=()=>{read();if(needConn())return;WML.authDead=false;stopReplay();const l=logs.find(l=>l.uid==$('wlog').value);if(!l)return setSt('Pick a log first (no log selected — press Connect, then choose well / wellbore / log)',true);start({...l,w:$('wwell').value,b:$('wwb').value})};
 $('svgo').onclick=()=>{read();CFG.svWell=$('svw').value.trim();CFG.svWellbore=$('svb').value.trim();CFG.svInterval=Math.max(60000,(+$('svi').value||60)*1000);$('svi').value=CFG.svInterval/1000;saveCfg();if(needConn())return;if(!CFG.svWell||!CFG.svWellbore)return setSt('Survey feed: enter a well and wellbore uid first',true);svStart()};$('svx').onclick=()=>svStop();$('wrep').onclick=()=>{read();if(needConn())return;if(!$('wwell').value||!$('wwb').value)return setSt('Load well: pick a well and wellbore first',true);loadWell($('wwell').value,$('wwb').value).catch(e=>setSt('Load well failed: '+e.message,true))};svRender();renderMap()}
function renderMap(){const m=$('wmap');if(!m)return;const L=WML.log||WML.preview;if(!L){m.innerHTML='';return}
 m.innerHTML=`<b>Mnemonic → game signal</b> <small>(auto-mapped; change any; unmapped curves are still traceable)</small><table style="font-size:11px;width:100%">`+L.curves.filter(c=>c.mn!=L.indexCurve).map(c=>{const ch=WML.channels[c.mn];
  return `<tr><td>${c.mn}</td><td>${c.unit}</td><td>${ch?.v??'—'}</td><td><select data-mn="${c.mn}"><option value="">(trace only)</option>${Object.entries(SIGNALS).map(([k,n])=>`<option value="${k}" ${CFG.map[c.mn]==k?'selected':''}>${n}</option>`).join('')}</select></td><td><button data-tr="${c.mn}">📈</button></td></tr>`}).join('')+'</table>';
 m.querySelectorAll('[data-mn]').forEach(s=>s.onchange=()=>{CFG.map[s.dataset.mn]=s.value;saveCfg();if(WML.channels[s.dataset.mn])WML.channels[s.dataset.mn].map=s.value});
 m.querySelectorAll('[data-tr]').forEach(b=>b.onclick=()=>GX.traces.addTrack('wml:'+b.dataset.tr))}
export function init(ctx){C=ctx;S=C.S;el=C.el;PANEL=C.PANEL;BTN=C.BTN||'';ui();
 const E=window.EXT,o=E.afterStep.bind(E);E.afterStep=()=>{drive();o();drive()};
 Object.assign(window.GX,{witsml:{WML,CFG,loadWell,resetAll,covCompute,covRender,svStart,svStop,svPoll,svParse,open:()=>toggle(true),start,stop,poll,listWells,listWellbores,listLogs,setLiveMode,startReplay,stopReplay,replaySet,setCred:(u,p)=>{CRED={user:u,pass:p};saveCred()},HOSTED_PROXY,SUPABASE_PROXY}})}
