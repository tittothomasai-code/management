// rtoc.js: Steve's RTOC, per-joint real-time operations dashboard; WITSML is primary, SIM is explicit demo only.
// Opened from the start screen (Drill > Steve's RTOC), the HUD button, ?rtoc, or GX.rtoc.open(). Esc closes.
// DATA HONESTY: WITSML is the default source; simulator data appears only after the user selects the explicit demo.
// Joint history is RECORDED from the selected time log: joints are
// split at connections (slips set -> slips released), never at a fixed length. Nothing is back-filled or invented; missing
// items show "not available". SIM geology is illustrative; live WITSML uses store markers or neutral context.
// Keys while open: G = cycle bottom layer (telemetry / geosteering profile), A = roof/floor guide lines on the profile.
// Historical review is read-only: SIM controls are disabled until "Return to current".
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import * as WML from './rtoc_wml.js?v=a2';
import * as HI from './rtoc_hist.js?v=h1';
import * as SUM from './rtoc_summary.js?v=j13c-20261109';
import * as C from './rtoc_core.js?v=j13c-20261109';
import {planPath,PLAN} from './physics.js?v=j13c-20261109';
import {compose} from './rtoc_scene_model.js?v=u1';import {createScene3D,loadRig} from './rtoc_scene3d.js?v=u1';import {mapKey,SHORTCUTS} from './rtoc_input.js?v=u1';import {fromGame} from './rtoc_adapter.js?v=u1';import {antiCollision} from './rtoc_status.js?v=u1';import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
const RIG={m:null,st:'idle'};// Codex land_rig.glb (assets/codex), loaded once on first open; procedural derrick until/if it fails
const $=id=>document.getElementById(id),FT=C.FT,M=C.m;
const REC={stores:new Map(),key:null,timer:0,lastT:-1};
const ST={el:null,sel:null,layer:'tele',roof:true,ctx:true,raf:0,scenes:[],ro:null,last:0};
try{const p=JSON.parse(localStorage.getItem('dw_rtoc_prefs')||'{}');if(p.layer)ST.layer=p.layer;if(p.roof!=null)ST.roof=p.roof;if(p.ctx!=null)ST.ctx=p.ctx;ST.pick=null;ST.pins=p.pins||{}}catch(e){}
const savePrefs=()=>{try{localStorage.setItem('dw_rtoc_prefs',JSON.stringify({layer:ST.layer,roof:ST.roof,ctx:ST.ctx,pick:ST.pick||null,pins:ST.pins||{}}))}catch(e){}};
// ---------- source + recorder ----------
// ---------- WITSML wells (read-only, cached in memory only; never persisted) + per-source persistence of SIM history ----------
const WL={io:null,list:[],cache:new Map(),disc:new Map(),busy:'',note:'',fixture:false,current:null,now:()=>Date.now()};
const HK='dw_rtoc_hist_v1',RUN='run-'+Date.now().toString(36);
function histIdx(){try{return JSON.parse(localStorage.getItem(HK)||'{}')}catch(e){return {}}}
function saveHist(){try{const st=REC.stores.get(simKey());if(!st||st.samples.length<2)return;const k=simKey(),keep=[];let lt=-1e9,lp=null;
  for(const x of st.samples){if(!lp||x.slips!==lp.slips||x.mode!==lp.mode||x.t-lt>=2){keep.push([x.t,+x.md.toFixed(2),x.bd==null?null:+x.bd.toFixed(2),x.mode=='slide'?1:0,x.slips?1:0,+(x.rop||0).toFixed(1),+(x.wob||0).toFixed(1),+(x.rpm||0).toFixed(0),+(x.tq||0).toFixed(0),+(x.spp||0).toFixed(0),+(x.q||0).toFixed(0)]);lt=x.t;lp=x}}
  const S=window.S||{},I=histIdx();I[k]={source:'SIM',well:'SIM well',wellbore:'main',run:RUN,t0:st.t0,saved:Date.now(),n:keep.length};
  const ks=Object.keys(I).filter(x=>x.startsWith('SIM|')).sort((a,b)=>I[b].saved-I[a].saved);ks.slice(5).forEach(x=>{delete I[x];localStorage.removeItem(HK+'|'+x)});
  localStorage.setItem(HK+'|'+k,JSON.stringify({v:1,samples:keep.slice(-6000),surveys:(S.surveys||[]).slice(-400)}));localStorage.setItem(HK,JSON.stringify(I))}catch(e){}}
function loadHist(k){try{const o=JSON.parse(localStorage.getItem(HK+'|'+k)||'null');if(!o||o.v!==1)return null;
  return {samples:o.samples.map(a=>({t:a[0],md:a[1],bd:a[2],mode:a[3]?'slide':'rotate',slips:!!a[4],rop:a[5],wob:a[6],rpm:a[7],tq:a[8],spp:a[9],q:a[10],faults:''})),surveys:o.surveys||[]}}catch(e){return null}}
const simKey=()=>'SIM|'+RUN+'|SIM well|main';
const NO_SOURCE_KEY='WITSML|NOT_CONNECTED',DEMO_KEY='DEMO|SIMULATED';
function source(){if(ST.pick===simKey())return {kind:'SIM',key:simKey(),label:'SIMULATED DEMO'};if(ST.pick&&ST.pick!=simKey()){if(ST.pick.startsWith('SIM|')){const h=WL.cache.get(ST.pick)||(()=>{const o=loadHist(ST.pick);if(o)WL.cache.set(ST.pick,o);return o})();const m=histIdx()[ST.pick];
   if(h)return {kind:'SIMHIST',key:ST.pick,label:'SIM run '+(m?C.brisbane(new Date(m.t0)):'(earlier)'),H:h}}
  else{const D=WL.cache.get(ST.pick);if(D)return {kind:'WITSML',key:D.key,label:(WL.fixture?'TEST FIXTURE · ':'WITSML · ')+D.wellName+' / '+D.wbName,D,test:WL.fixture}}}
 return srcLive()}
function srcLive(){return {kind:'WITSMLWAIT',key:NO_SOURCE_KEY,label:'WITSML · not connected'}}
function store(key){let s=REC.stores.get(key);if(!s){s={key,samples:[],t0:Date.now(),evOff:0};REC.stores.set(key,s)}return s}
function sample(){const S=window.S;if(!S||!Number.isFinite(S.md))return;const src=source();if(src.kind!='SIM')return;// Record only after the user explicitly selects the SIMULATED demo.
 const s=store(src.key);REC.key=src.key;if(S.t===REC.lastT)return;REC.lastT=S.t;
 const bd=window.GX?.bit?.state?.()?.disp?.bd;
 s.samples.push({t:S.t,wall:Date.now(),md:S.md,bd:Number.isFinite(bd)?bd:null,mode:S.mode,slips:!!S.slips,rop:S.rop,wob:S.wob,rpm:S.td?.rpm,tq:S.td?.torque,spp:S.spp,q:S.Q,seq:!!S.seq,faults:Object.keys(S.faults||{}).filter(k=>S.faults[k]).join(',')});
 if(s.samples.length>40000)s.samples.splice(0,5000)}
export function startRecorder(){if(REC.timer)return;REC.timer=setInterval(sample,250)}
export function recorded(key){const s=source();if(!key||key==s.key){if(s.D)return {key:s.key,samples:s.D.samples,t0:s.D.samples[0]?.t??Date.now()};if(s.H)return {key:s.key,samples:s.H.samples,t0:s.H.samples[0]?.t??0}}return store(key||REC.key||s.key)}
export function joints(key){return C.segment(recorded(key).samples)}
// ---------- UI ----------
const CSS=`body.rtoc-open #vlaMain{display:none!important}#rtoc{position:fixed;inset:0;z-index:100000;background:radial-gradient(ellipse at 50% 0,#13294a,#071222 70%);color:#dbe7f5;font:12px system-ui,sans-serif;display:grid;grid-template-rows:auto 1fr auto auto;gap:6px;padding:6px;box-sizing:border-box;overflow:hidden}
#rtoc *{box-sizing:border-box}#rtoc .pn{background:#0c1a30e6;border:1px solid #23406a;border-radius:6px;padding:6px 8px;min-width:0;min-height:0}
#rtoc h3{margin:0 0 4px;font-size:11px;letter-spacing:.08em;color:#9fc3ea;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;gap:6px}
#rtoc button{background:#132a4a;color:#e6f0ff;border:1px solid #2f5a8f;border-radius:4px;padding:5px 9px;cursor:pointer;font:inherit;min-height:30px}
#rtoc button:hover{border-color:#38d6c8}#rtoc button:focus-visible{outline:2px solid #ffc04a;outline-offset:1px}#rtoc button[disabled]{opacity:.45;cursor:not-allowed}
#rtoc button.on{background:#14506a;border-color:#38d6c8}#rtoc kbd{background:#06101e;border:1px solid #456;border-radius:3px;padding:0 4px;font-size:10px;margin-left:4px;color:#ffc04a}
#rtoc .hdr{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#rtoc .brand{font-weight:800;letter-spacing:.06em}#rtoc .brand b{color:#38d6c8}
#rtoc .badge{border:1px solid #ffc04a;color:#ffc04a;border-radius:4px;padding:2px 8px;font-weight:700;font-size:11px}#rtoc .badge.w{border-color:#38d6c8;color:#38d6c8}
#rtoc .main{display:grid;grid-template-columns:220px minmax(0,1fr) 250px;gap:6px;min-height:0}
#rtoc .ctr{display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:6px;min-height:0}#rtoc .viewrow{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;min-height:0}#rtoc .viewrow.ctx{grid-template-columns:minmax(280px,42%) minmax(0,1fr)}
#rtoc .v3{position:relative;min-height:0;padding:0;overflow:hidden}#rtoc .v3 canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}
#rtoc .v3 .cap{position:absolute;left:8px;top:6px;right:8px;pointer-events:none;display:flex;justify-content:space-between;gap:6px;font-size:11px;text-shadow:0 1px 2px #000}
#rtoc .v3 .leg{position:absolute;left:8px;bottom:6px;pointer-events:none;font-size:10px;background:#06101ecc;border-radius:4px;padding:3px 6px}#rtoc .v3 .lbl{position:absolute;pointer-events:none;font-size:10px;font-weight:700;white-space:nowrap;transform:translate(-50%,-130%);text-shadow:0 1px 2px #000}
#rtoc .tally{overflow:auto;max-height:100%}#rtoc .jt{display:flex;justify-content:space-between;width:100%;text-align:left;margin:2px 0;background:#0e213b;border-color:#23406a}#rtoc .jt.sel{background:#1257a8;border-color:#7fc4ff}#rtoc .jt.cur b{color:#38d6c8}
#rtoc .left{display:grid;grid-template-rows:minmax(0,1fr) auto;gap:6px;min-height:0}#rtoc .right{display:grid;grid-template-rows:auto auto auto;gap:6px;align-content:start;overflow:auto;min-height:0}
#rtoc .score{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}#rtoc .big{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}#rtoc .pct{color:#38d6c8}
#rtoc .rib{display:flex;height:16px;border-radius:3px;overflow:hidden;background:repeating-linear-gradient(45deg,#1a2a40,#1a2a40 6px,#22344e 6px,#22344e 12px);margin:4px 0;font-size:10px;line-height:16px}
#rtoc .rib i{display:block;font-style:normal;white-space:nowrap;overflow:hidden;padding:0 4px;color:#04101e;font-weight:700}#rtoc .rib .sl{background:#f0a830}#rtoc .rib .ro{background:#3d8cf0}#rtoc .rib .of{background:#5b6b80}
#rtoc .row{display:flex;justify-content:space-between;gap:8px;padding:2px 0}#rtoc .na{color:#8a9bb2;font-style:italic}#rtoc .ok{color:#5fe0a0}#rtoc .wr{color:#ffc04a}
#rtoc .exe{display:flex;gap:6px;align-items:center;flex-wrap:wrap}#rtoc .rev{background:#3a2a05;border:1px solid #ffc04a;color:#ffd98a;border-radius:4px;padding:4px 8px;display:flex;gap:8px;align-items:center}
#rtoc .bottom{display:grid;gap:6px;min-height:0}#rtoc .tracks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}#rtoc .tracks canvas,#rtoc .geo canvas,#rtoc .lwd canvas{width:100%;display:block}
#rtoc .foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:10px;color:#9fb3cc}
#rtoc .kp{display:grid;gap:4px}#rtoc .kp .k{border-bottom:1px solid #23406a;padding:3px 0}#rtoc .kp .k small{display:block;color:#9fc3ea;font-size:10px;letter-spacing:.06em}#rtoc .kp .k b{font-size:16px;font-variant-numeric:tabular-nums}
#rtoc .ctxw{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;overflow:hidden}#rtoc .kp{overflow:auto;min-height:0}#rtoc .ctxin{display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:6px;min-height:0}
@media (max-width:900px){#rtoc{overflow:auto;display:block}#rtoc>*{margin-bottom:6px}#rtoc .main{grid-template-columns:1fr}#rtoc .viewrow.ctx{grid-template-columns:1fr}#rtoc .v3{height:300px}#rtoc .ctxw .v3{height:260px}#rtoc .tracks{grid-template-columns:1fr 1fr}#rtoc .left{grid-template-rows:auto auto}#rtoc .tally{max-height:180px}#rtoc .ctxin{grid-template-columns:1fr}}`;
const CSS2=`@media (min-width:901px){#rtoc{grid-template-rows:30px minmax(0,1fr) auto auto;padding:4px 8px;gap:5px;background:radial-gradient(120% 80% at 50% 0%,#0f2236 0%,#070e18 70%)}
#rtoc .hdr{padding:2px 8px;flex-wrap:nowrap;overflow:hidden;white-space:nowrap}#rtoc #rtWell{overflow:hidden;text-overflow:ellipsis;min-width:0}#rtoc .bottom h3{margin:0}#rtoc .hdr button{min-height:24px;padding:2px 8px}#rtoc .brand{font:800 italic 15px system-ui;white-space:nowrap}
#rtoc .main{grid-template-columns:18% minmax(0,1fr) 23.5%}#rtoc .pn{background:linear-gradient(180deg,rgba(18,34,54,.94),rgba(10,20,34,.94));border-color:#23405f;border-radius:5px}
#rtoc h3{font-size:12px;color:#e9f1fb;font-weight:700}#rtoc .jt{padding:6px 10px;margin:0;border-radius:0;border:0;border-top:1px solid #1b3350;background:none;font-weight:600;font-size:13px;min-height:0}#rtoc .jt.sel{background:linear-gradient(90deg,#1f6fe0,#1b5fc0);color:#fff}
#rtoc .viewrow,#rtoc .viewrow.ctx{grid-template-columns:minmax(0,1fr);position:relative}
#rtoc #rtCtx{position:absolute;right:6px;top:6px;width:clamp(150px,22%,200px);max-height:20px;z-index:3;background:rgba(8,16,28,.86);padding:2px 7px;overflow:hidden;cursor:pointer}#rtoc #rtCtx.open{max-height:62%;overflow:auto}#rtoc #rtCtx h3::before{content:'▸ ';color:#38d6c8}#rtoc #rtCtx.open h3::before{content:'▾ '}#rtoc #rtCtx:not(.open) h3 span{display:none}
#rtoc #rtCtx h3{font-size:10px;color:#9fc3ea;display:block}#rtoc #rtCtx h3 span{display:block;font-weight:400;letter-spacing:0;text-transform:none;font-size:9.5px;color:#8a9bb2}
#rtoc #rtCtx .ctxin{grid-template-columns:1fr;display:block}#rtoc #rtCtx3{position:static;height:auto;min-height:0;background:none;border:0;padding:0}#rtoc #rtCtx3 .cap{position:static;display:block;font-size:9.5px;color:#a9c0d8;text-shadow:none}#rtoc #rtCtx3 .leg{display:none}
#rtoc #rtCtx .kp .k{padding:2px 0}#rtoc #rtCtx .kp .k b{font-size:12px}#rtoc #rtCtx .kp .k div{font-size:10px}
#rtoc #rtJ3{background:linear-gradient(180deg,#0e2033 0%,#13263a 45%,#0a1522 100%)}#rtoc #rtJ3 .cap{top:34px;font-size:10px}
#rtoc .score{padding:4px 12px}#rtoc .big{font-size:20px}#rtoc .rib{height:17px;line-height:17px}
#rtoc .exe{padding:5px 12px;flex-wrap:nowrap}#rtoc .exe button{flex:1;max-width:150px;font-weight:600}#rtoc .exe h3{font-size:15px;color:#e9f1fb}
#rtoc .right{grid-template-rows:auto auto auto}#rtoc .bottom{grid-template-rows:auto auto;padding:4px 8px}#rtoc .lwd canvas{height:40px!important}#rtoc .tracks canvas{height:clamp(56px,10.5vh,110px)!important}
#rtoc .foot{font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px}}
#rtoc .vtabs{position:absolute;left:8px;top:6px;right:8px;display:flex;gap:6px;z-index:2;flex-wrap:wrap}#rtoc .vtabs button{min-height:22px;padding:2px 12px;background:#0f2034;border-color:#2a4566;font-size:11.5px}#rtoc .vtabs button.on{background:#1d4f8f;border-color:#3d8cf0}#rtoc .vtabs button[aria-disabled=true]{opacity:.5}#rtoc .vtabs kbd{margin:0 5px 0 0}
#rtoc .srcb{position:absolute;left:8px;bottom:30px;display:flex;flex-wrap:wrap;gap:3px;max-width:62%;z-index:2;pointer-events:none}#rtoc .srcb span{background:rgba(8,16,28,.72);border:1px solid #2a4566;border-radius:2px;padding:0 5px;font-size:9px;color:#a9c0d8}
#rtoc .vunav{position:absolute;right:8px;bottom:30px;background:rgba(40,20,8,.88);border:1px solid #c98a2e;color:#f0c080;padding:1px 7px;font-size:10px;border-radius:2px;z-index:2}
#rtoc .v3 .lbl{background:rgba(8,16,28,.85);border:1px solid currentColor;padding:1px 6px;border-radius:2px}
#rtoc #rtACc{width:100%;height:150px;display:block}#rtoc .dot{display:inline-block;width:11px;height:11px;border-radius:50%;border:1px dashed #5d6f84;margin-right:6px;vertical-align:-1px}
#rtoc .ov{position:absolute;inset:0;display:grid;place-items:center;background:rgba(3,8,14,.55);z-index:20}#rtoc .ov[hidden]{display:none}#rtoc .ovb{background:#0d1c2e;border:1px solid #3d8cf0;border-radius:6px;padding:12px 16px;min-width:320px}#rtoc .ovb td{padding:3px 10px;border-top:1px solid #1b3350}
#rtoc .rstrip{display:flex;gap:4px;align-items:center;overflow:hidden;white-space:nowrap;font-size:9.5px;color:#a9c0d8;padding:0 2px;min-height:16px}#rtoc .rstrip span{border:1px solid #23405f;border-radius:2px;padding:0 5px;background:#0a1626}#rtoc .rstrip .lg{border-color:#2f5a8f;color:#dbe7f5}#rtoc .rstrip i{display:inline-block;width:14px;height:3px;vertical-align:middle;margin:0 3px 0 5px}#rtoc .rstrip i.d{height:0;border-top:2px dashed #d0d8e6;background:none}
#rtoc #rtJ3 .leg{display:none}#rtoc #rtJ3 .cap{top:auto;bottom:3px;left:6px;right:6px;font-size:9px;opacity:.75}
@media (min-width:901px){#rtoc{font-size:11px}#rtoc h3{font-size:10.5px;margin-bottom:2px}#rtoc .pn{padding:4px 7px}#rtoc .jt{padding:4px 8px;font-size:11.5px}#rtoc .row{padding:1px 0}#rtoc .big{font-size:18px}#rtoc .score{gap:8px;padding:3px 10px}#rtoc .score .row{font-size:10.5px}#rtoc .rib{height:15px;line-height:15px;margin:2px 0}
#rtoc .ctr{gap:4px}#rtoc .main{gap:5px}#rtoc .exe{gap:5px;padding:3px 8px}#rtoc .exe button{min-height:24px;padding:2px 6px;font-size:11px;white-space:nowrap}#rtoc .exe h3{font-size:12.5px}#rtoc .exe .badge{font-size:9.5px;white-space:nowrap;padding:1px 5px}#rtoc .exe #rtRev:empty{display:none}
#rtoc .right .pn{padding:3px 7px}#rtoc #rtAC .na,#rtoc #rtAl .na{font-size:9.5px}#rtoc #rtACc{height:104px}#rtoc .right>.pn:first-child{overflow:hidden;max-height:34%}#rtoc .right{grid-template-rows:auto minmax(0,1fr) auto}#rtoc .right>.pn{overflow:hidden}#rtoc .bottom{gap:3px}#rtoc .bottom h3 button{min-height:20px;padding:1px 6px;font-size:10px}#rtoc .lwd canvas{height:26px!important}#rtoc .foot{font-size:9.5px}
#rtoc .hdr{gap:8px}#rtoc .hdr .badge{font-size:10px;padding:1px 6px}#rtoc .hdr button{font-size:11px}#rtoc .vtabs button{min-height:20px;padding:1px 9px;font-size:10.5px}#rtoc .left .pn:last-child{font-size:10.5px}}
@media (max-width:900px){#rtoc .hdr{display:grid;grid-template-columns:1fr auto auto auto;align-items:center}#rtoc .hdr .brand{grid-column:1/-1;font-size:13px}#rtoc .hdr #rtSrc{grid-column:1/-1;justify-self:start}#rtoc .hdr #rtWell{grid-column:1/-1;text-align:left!important;order:0}#rtoc .hdr button{min-height:30px;padding:3px 8px}#rtoc .rstrip{flex-wrap:wrap;white-space:normal}}
#rtoc .mnav{display:none}@media (max-width:900px){#rtoc .mnav{display:flex;gap:6px;margin-top:6px}#rtoc .mnav button{flex:1}#rtoc .main{display:flex!important;flex-direction:column}#rtoc .ctr{order:-1;display:flex;flex-direction:column}#rtoc .viewrow,#rtoc .viewrow.ctx{display:flex!important;flex-direction:column-reverse}#rtoc .score{grid-template-columns:1fr auto}#rtoc .score>div:nth-child(2){grid-column:1/-1;grid-row:2}#rtoc .score .big{white-space:nowrap}#rtoc .score .row{flex-wrap:wrap}#rtoc .hdr{gap:6px}#rtoc .hdr #rtWell{flex-basis:100%;order:5;font-size:11px}#rtoc .vtabs{overflow-x:auto;flex-wrap:nowrap}#rtoc .vtabs button{flex:0 0 auto}#rtoc .srcb{max-width:95%}#rtoc #rtCtx3{height:auto}#rtoc .v3#rtJ3{height:52vh}}`;

const f1=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('en-AU',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const HC={};function setH(id,h){if(HC[id]===h&&$(id).innerHTML)return false;HC[id]=h;$(id).innerHTML=h;return true}
const H=new Proxy({},{set(o,k,v){setH(k,v);return true}});
const NA=t=>`<span class=na>${t}</span>`;
function curJoint(J){return J.length&&J.at(-1).open?J.at(-1):null}
function selJoint(J){if(ST.sel==null)return curJoint(J)||J.at(-1)||null;return J.find(j=>j.n==ST.sel)||null}
function wsel(src){const sel=$('rtWsel');if(!sel)return;const I=histIdx(),runs=Object.keys(I).filter(k=>k.startsWith('SIM|')&&k!=simKey()).sort((a,b)=>I[b].t0-I[a].t0);
 const opts=[[NO_SOURCE_KEY,'WITSML · not connected'],[DEMO_KEY,'DEMO · SIMULATED rig'],...runs.map(k=>[k,'DEMO · saved SIM run '+C.brisbane(new Date(I[k].t0))+' (read-only)']),...WL.list.flatMap(w=>{const p=(WL.fixture?'TEST-FIXTURE':'WITSML')+'|'+w.uid,R=WL.disc.get(w.uid);const top=[p,(w.uid==WL.current?'CURRENT · ':'HISTORIC · ')+(w.name||w.uid)];return R&&R.wbs.length>1?[top,...R.wbs.map(b=>[p+'|'+b.uid,'   ↳ wellbore '+(b.name||b.uid)])]:[top]})];
 const sig=opts.map(o=>o[0]).join(',');if(sel.dataset.sig!==sig){sel.innerHTML=opts.map(([k,t])=>`<option value="${k.replace(/"/g,'&quot;')}">${t.replace(/</g,'&lt;')}</option>`).join('');sel.dataset.sig=sig;sel.onchange=()=>{const v=sel.value;if(v===NO_SOURCE_KEY){stopLive('source switched');ST.pick=null;savePrefs();render(true);return}if(v===DEMO_KEY){pick(simKey()).catch(()=>{});return}const hit=v.split('|').length>2?(WL.cache.has(v)?v:null):[...WL.cache.keys()].find(k=>k.startsWith(v+'|'));(hit?Promise.resolve(ST.pick=hit,savePrefs(),render(true)):pick(v)).catch(()=>{})}}
 const cur=src.kind=='SIM'?DEMO_KEY:src.D?(WL.disc.get(src.D.well)?.wbs.length>1?src.D.key:src.D.source+'|'+src.D.well):src.key;if(sel.value!==cur&&document.activeElement!==sel)sel.value=cur;$('rtWselL').hidden=false;$('rtBusy').textContent=WL.busy}
export function open(){if(ST.el){render();return API}startRecorder();
 window.dropz?.modes?.reset?.();
 if(!$('rtocCss')){const s=document.createElement('style');s.id='rtocCss';s.textContent=CSS+CSS2+`#rtoc .summary{z-index:30;background:rgba(3,8,14,.76)}#rtoc .summaryBox{width:min(920px,calc(100vw - 24px));max-height:calc(100vh - 28px);overflow:auto}#rtoc .summaryHead{display:flex;justify-content:space-between;align-items:center;gap:12px;position:sticky;top:-12px;background:#0d1c2e;padding:4px 0 8px;z-index:1}#rtoc .summaryHead h3{margin:0}#rtoc .summaryLead{color:#9fc3ea;margin:2px 0 10px}#rtoc .summaryGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}#rtoc .summaryStat,#rtoc .summaryFact{border:1px solid #23405f;background:#091727;border-radius:4px;padding:7px;min-width:0}#rtoc .summaryStat small,#rtoc .summaryFact small{display:block;color:#9fc3ea;font-size:10px;text-transform:uppercase}#rtoc .summaryStat b{display:block;font-size:16px;margin-top:3px}#rtoc .summaryFacts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}#rtoc .summaryFact b{display:block;margin:3px 0;color:#f0c36a}#rtoc .summaryFact p{margin:0;color:#a9bbcc;font-size:10px;line-height:1.4}#rtoc .summaryQuality{margin:8px 0 0;padding-left:18px;color:#a9bbcc;font-size:10px}@media(max-width:650px){#rtoc .summaryGrid{grid-template-columns:repeat(2,minmax(0,1fr))}#rtoc .summaryFacts{grid-template-columns:1fr}#rtoc .summaryBox{padding:9px;min-width:0}}`;document.head.appendChild(s)}
 if(RIG.st=='idle'){RIG.st='loading';loadRig(GLTFLoader,new URL('./assets/codex/land_rig.glb',import.meta.url).href).then(m=>{RIG.m=m;RIG.st=m?'glb':'fallback';ST._k=null;ST.scenes.forEach(s=>s.fitKey=null)})}
 const el=document.createElement('section');el.id='rtoc';el.setAttribute('role','dialog');el.setAttribute('aria-label',"Steve's RTOC");
 el.innerHTML=`<div class="hdr pn"><span class=brand>ROBOTYX <b>/</b> DRILLING WORLD <b>·</b> STEVE'S RTOC</span><span id=rtSrc class=badge>WITSML NOT CONNECTED</span><span id=rtWell style="flex:1;text-align:center;font-weight:700"></span><label id=rtWselL style=font-size:11px>Source <select id=rtWsel aria-label="Select live WITSML well or explicit demo"></select></label><span id=rtBusy class=na style=font-size:11px></span>
 <button id=rtConnectW type=button>Connect live WITSML</button><button id=rtSummaryB type=button>Well summary</button>
 <button id=rtKeys title="Keyboard shortcuts (?)">Keys<kbd>?</kbd></button><button id=rtCtxB aria-pressed=true title="Whole-well framing and context card (C)">Whole-well context<kbd>C</kbd></button><button id=rtClose aria-label="Close RTOC">Close<kbd>Esc</kbd></button></div>
 <div class=main><div class=left><div class="pn tally"><h3>Joint tally <span>MD (m)</span></h3><div id=rtTally></div></div><div class=pn><h3>Next up</h3><div id=rtNext></div></div></div>
 <div class=ctr><div class="pn score" id=rtScore></div><div class="viewrow" id=rtViews><div class="pn ctxw" id=rtCtx><h3>Whole-well snapshot <span id=rtCtxAs></span></h3><div class=ctxin><div class=v3 id=rtCtx3><div class=cap><span>WHOLE WELL · <span id=rtCtxSrc></span></span><span id=rtCtxGeo>ILLUSTRATIVE GEOLOGY · NOT TO SCALE</span></div><div class=leg><span style=color:#38d6c8>━ Surveyed</span> · <span style=color:#ffb347>┅ Estimate to bit</span> · <span style=color:#ccd>┅ Plan</span> · <span style=color:#9ab>▮ Casing</span></div></div><div class=kp id=rtKpi></div></div></div>
 <div class="pn v3" id=rtJ3><div class=vtabs id=rtVtabs></div><div class=cap><span id=rtJ3t></span><span id=rtJ3s></span></div><div class=leg><span style=color:#3d8cf0>━ Rotary</span> · <span style=color:#f0a830>━ Slide</span> · <span style=color:#38d6c8>━ Surveyed (other)</span> · <span style=color:#ccd>┅ Plan</span> · <span style=color:#ffb347>● Bit / estimate</span> · Offset: ${'n/a'}</div></div></div>
 <div class=mnav><button id=rtPrevJ aria-label="Previous joint">◀ Prev joint</button><button id=rtCurJ>Current</button><button id=rtNextJ aria-label="Next joint">Next joint ▶</button></div><div class=rstrip id=rtStrip></div><div class="pn exe"><h3 style="margin:0 6px 0 0">Execution</h3><span id=rtMode class=badge></span><button id=rtHold>Hold / Resume</button><button id=rtSlide>Slide</button><button id=rtRot>Rotary</button><button id=rtAuto>Auto-steer</button><button id=rtSurv>Take survey</button><span id=rtRev></span></div></div>
 <div class=right><div class=pn><h3>Anti-collision</h3><div id=rtAC></div></div><div class=pn><h3>Early alerts <span id=rtAlN></span></h3><div id=rtAl></div></div><div class=pn><h3>Well control</h3><div id=rtWC></div></div></div></div>
 <div class="bottom pn" id=rtBottom><h3><span id=rtLayT></span><button id=rtCyc aria-label="Cycle bottom layer (G)">Bottom layer: <span id=rtCycN></span><kbd>G</kbd></button></h3><div id=rtTele><div class=lwd><canvas id=rtLwd height=34></canvas></div><div class=tracks id=rtTracks></div></div><div class=geo id=rtGeo hidden><div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><button id=rtRoof aria-pressed=true aria-label="Toggle roof and floor lines (A)">Roof / floor lines<kbd>A</kbd></button><span id=rtGeoN class=na></span></div><canvas id=rtGeoC height=175></canvas></div></div>
 <div class="foot pn" id=rtFoot></div><div class=ov id=rtOv hidden role=document aria-label="Keyboard shortcuts"><div class=ovb><h3>Keyboard shortcuts</h3><table>${SHORTCUTS.map(([k,t])=>`<tr><td><kbd>${k}</kbd></td><td>${t}</td></tr>`).join('')}</table><p class=na style=font-size:10.5px>Tab and F1 are never captured. No execution keys are bound.</p><button id=rtOvC>Close<kbd>Esc</kbd></button></div></div><div class="ov summary" id=rtSummary hidden role=dialog aria-label="Historical well summary"><div class="ovb summaryBox"><div class=summaryHead><h3 id=rtSummaryTitle>Well summary</h3><div><button id=rtSummaryCopy>Copy summary</button> <button id=rtSummaryClose>Close</button></div></div><div id=rtSummaryBody></div></div></div>`;
 document.body.appendChild(el);ST.el=el;ST._tk=null;ST._k=null;document.body.classList.add('rtoc-open');
 $('rtTracks').innerHTML=[['ROP / WOB','rop','wob'],['Torque / RPM','tq','rpm'],['SPP / ECD','spp','ecd'],['Flow in / out','q','qout']].map(([t,a,b])=>`<div><div style="font-size:10px;color:#9fc3ea" id=rtTt_${a}>${t}</div><canvas data-a=${a} data-b=${b} height=96></canvas></div>`).join('');
 $('rtClose').onclick=close;$('rtKeys').onclick=()=>ov(true);$('rtOvC').onclick=()=>ov(false);$('rtSummaryB').onclick=showSummary;$('rtSummaryClose').onclick=hideSummary;$('rtSummary').onclick=e=>{if(e.target===$('rtSummary'))hideSummary()};$('rtSummaryCopy').onclick=copySummary;$('rtPrevJ').onclick=()=>stepJoint(-1);$('rtNextJ').onclick=()=>stepJoint(1);$('rtCurJ').onclick=current;$('rtCtxB').onclick=toggleCtx;$('rtCtx').querySelector('h3').onclick=()=>$('rtCtx').classList.toggle('open');$('rtCyc').onclick=cycle;$('rtRoof').onclick=roof;$('rtConnectW').onclick=connectLive;
 const S=()=>window.S,live=()=>ST.sel==null;
 const ctl=(id,f)=>{$(id).onclick=()=>{if(!live()||!S())return;f(S());render()}};
 ctl('rtSlide',s=>{s.autoSteer=false;s.mode='slide'});ctl('rtRot',s=>{s.autoSteer=false;s.mode='rotate'});ctl('rtAuto',s=>{s.autoSteer=true});ctl('rtHold',()=>{$('pause')?.click()});
 ctl('rtSurv',s=>{const l=s.surveys.at(-1);if(l&&s.md>l[0]+0.5){const e=C.estimateAt(l,s.md);s.surveys.push([s.md,s.inc,s.azi,e.N,e.E,e.TVD]);s.lastS=s.md;(s.events||[]).push([s.t,'RTOC: survey taken at '+s.md.toFixed(0)+' ft (SIM)'])}});
 ST.scenes=[mkScene($('rtJ3'),'joint')];
 ST.ro=new ResizeObserver(()=>{ST.scenes.forEach(sz);ST._k=null;render()});ST.ro.observe(el);
 layout();render();loop();setTimeout(()=>$('rtClose')?.focus(),0);return API}
function showSummary(){
 const box=$('rtSummary'),body=$('rtSummaryBody'),d=data(),src=d.src;
 box.hidden=false;ST.summaryKey=src.key;
 if(src.kind!=='WITSML'||src.test||!src.D){
  $('rtSummaryTitle').textContent='Historical well summary';
  body.innerHTML='';
  const p=document.createElement('p');p.className='summaryLead';p.textContent=src.kind==='WITSMLWAIT'?'Connect to the authorized WITSML store, then select a historical well. No simulated values are used in this summary.':'Select a real WITSML well to generate a source-derived summary. Demo runs are excluded.';
  body.append(p);$('rtSummaryCopy').disabled=true;return
 }
 const m=SUM.build(src.D);$('rtSummaryTitle').textContent=m.wellName+' · '+m.wellboreName;
 $('rtSummaryCopy').disabled=false;
 const lead=document.createElement('p');lead.className='summaryLead';lead.textContent=(m.current?'Current well snapshot':'Historical WITSML data')+' · read-only · '+d.rec.samples.length+' time-log samples · source values only';
 body.replaceChildren(lead);
 const stats=document.createElement('div');stats.className='summaryGrid';
 for(const x of m.stats){const card=document.createElement('div');card.className='summaryStat';const l=document.createElement('small');l.textContent=x.label;const v=document.createElement('b');v.textContent=x.value;card.append(l,v);stats.append(card)}
 body.append(stats);
 const h=document.createElement('h3');h.textContent=m.message||'Source-backed facts';body.append(h);
 const facts=document.createElement('div');facts.className='summaryFacts';
 for(const [i,x] of m.facts.entries()){const card=document.createElement('div');card.className='summaryFact';const l=document.createElement('small');l.textContent='FACT '+(i+1)+' · '+x.label;const v=document.createElement('b');v.textContent=x.value;const p=document.createElement('p');p.textContent=x.detail;card.append(l,v,p);facts.append(card)}
 body.append(facts);
 const qh=document.createElement('h3');qh.textContent='Source quality and limits';body.append(qh);
 const ul=document.createElement('ul');ul.className='summaryQuality';for(const line of m.quality){const li=document.createElement('li');li.textContent=line;ul.append(li)}body.append(ul);
 ST.summaryText=m.copyText
}
function hideSummary(){if($('rtSummary'))$('rtSummary').hidden=true}
async function copySummary(){if(!ST.summaryText)return;try{await navigator.clipboard.writeText(ST.summaryText);$('rtSummaryCopy').textContent='Copied'}catch(e){$('rtSummaryCopy').textContent='Copy unavailable'}setTimeout(()=>{if($('rtSummaryCopy'))$('rtSummaryCopy').textContent='Copy summary'},1800)}

export function close(){if(!ST.el)return;ST.ov=false;cancelAnimationFrame(ST.raf);ST.ro?.disconnect();ST.scenes.forEach(s=>{s.ctl.dispose();s.r.dispose();s.r.forceContextLoss?.()});ST.scenes=[];ST.el.remove();ST.el=null;document.body.classList.remove('rtoc-open')}
function layout(){if(!ST.el)return;$('rtCtx').hidden=!ST.ctx;$('rtViews').classList.toggle('ctx',ST.ctx);$('rtCtxB').classList.toggle('on',ST.ctx);$('rtCtxB').setAttribute('aria-pressed',ST.ctx);
 $('rtTele').hidden=ST.layer!='tele';$('rtGeo').hidden=ST.layer!='geo';$('rtCycN').textContent=ST.layer=='tele'?'Telemetry → Geosteering':'Geosteering → Telemetry';$('rtLayT').textContent=ST.layer=='tele'?'LWD + telemetry (selected joint)':'Geosteering profile (selected joint)';
 $('rtRoof').classList.toggle('on',ST.roof);$('rtRoof').setAttribute('aria-pressed',ST.roof);requestAnimationFrame(()=>{ST.scenes.forEach(sz);drawBottom()})}
function toggleCtx(){ST.ctx=!ST.ctx;savePrefs();layout();ST._k=null;render(true)}
export function cycle(){ST.layer=ST.layer=='tele'?'geo':'tele';savePrefs();layout();drawBottom()}
export function roof(){ST.roof=!ST.roof;savePrefs();layout();drawBottom()}
export function select(n){const k=source().key;ST.pins=ST.pins||{};if(n==null)delete ST.pins[k];else ST.pins[k]=n;ST.sel=n;savePrefs();render(true)}
export function current(){select(null)}
export async function wells(){if(WL.list.length||!WL.io)return WL.list;WL.list=await WL.io.listWells();return WL.list}
async function connectLive(){if(WL.busy)return;const X=window.GX?.witsml;
 if(!X||typeof X.callRetry!='function'){try{X?.open?.()}catch(e){}WL.busy=X?'Connect to your authorized WITSML store, then press Connect live WITSML.':'Open the WITSML connection, connect to your store, then return here.';render();return}
 WL.busy='Connecting to the authorized WITSML store (read-only)…';render();
 try{const current=X.WML?.log?.w||window.GX?.wellmodel?.WM?.well||null;await useExistingTransport(current);WL.busy=WL.list.length?`${WL.list.length} WITSML well${WL.list.length===1?'':'s'} found. Select a well to load its read-only data.`:'No wells returned by the WITSML store.'}
 catch(e){WL.busy='WITSML connection failed. Reconnect to the store and try again.'}
 render()}
const WMNS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
async function objs(t,well,wb){try{return (await WL.call('WMLS_GetFromStore',t,`<${t}s ${WMNS}><${t} uidWell="${well}" uidWellbore="${wb}" uid=""/></${t}s>`,'returnElements=all')).xml||''}catch(e){return ''}}
// key: SOURCE|well[|wellbore]. Generation token: a slower read for a previous pick never overwrites the current selection.
export async function pick(key){stopLive('source switched');const gen=ST.gen=(ST.gen||0)+1;if(!key||key===NO_SOURCE_KEY){ST.pick=null;savePrefs();render(true);return source()}
 if(key===DEMO_KEY||key===simKey()){ST.pick=simKey();savePrefs();render(true);return source()}
 if(key.startsWith('SIM|')){ST.pick=key;savePrefs();render(true);return source()}
 const [,well,wbReq]=key.split('|');if(!WL.io)throw new Error('No WITSML transport');const alive=()=>gen===ST.gen;WL.busy='Reading '+well+(wbReq?' / '+wbReq:'')+' (read-only)…';render();
 try{const W=window.GX.wellmodel;let R=WL.disc.get(well);if(!R){R=await W.discoverWell(WL.io,well);if(!alive())return null;WL.disc.set(well,R)}
  const wb=wbReq||R.P?.wb||R.wbs[0]?.uid;const logStatus=[];
  for(const s0 of R.sets.filter(s=>s.obj=='log'&&s.wb==wb)){const st=await HI.readAll(WL.call,well,s0,{caps:WL.caps,alive});if(st.status=='aborted'||!alive())return null;
   logStatus.push({name:s0.name||s0.uid,uid:s0.uid,time:!!s0.time,...st})}
  let casing=[],datumXml='';try{const gx=await objs('wbGeometry',well,wb);const {parseCasing}=await import('./wmlinv.js?v=5923');casing=parseCasing(new DOMParser().parseFromString(gx||'<x/>','application/xml'))}catch(e){}
  try{datumXml=(await WL.call('WMLS_GetFromStore','well',`<wells ${WMNS}><well uid="${well}"><name/><wellDatum/></well></wells>`,'returnElements=requested')).xml}catch(e){}
  const markers=HI.parseMarkers(await objs('formationMarker',well,wb)),messages=HI.parseMessages(await objs('message',well,wb));if(!alive())return null;
  const tl=R.sets.filter(s=>s.obj=='log'&&s.time&&s.wb==wb&&s.rows?.length).sort((a,b)=>(b.rows.at(-1)[0]-a.rows.at(-1)[0])||(b.rows.length-a.rows.length))[0];
  const cur=well==WL.current&&wb==(WL.currentWb||wb);
  const D=WML.toRtoc(R,{wb,timeLog:tl,source:WL.fixture?'TEST-FIXTURE':'WITSML',current:cur,casing,datumXml,markers,messages,logStatus,fresh:HI.freshness(tl?.rows.at(-1)?.[0],{now:WL.now(),current:cur}),wellName:(WL.list.find(w=>w.uid==well)||{}).name||well});
  D._ctx={R,tl,well,wb,casing,datumXml,markers,messages,logStatus};WL.cache.set(D.key,D);ST.pick=D.key;WL.busy='';savePrefs();render(true);return source()}
 catch(e){if(alive()){WL.busy='WITSML read failed. Check store access and try again.';render()}throw e}}
// one incremental refresh of the CURRENT well's time log (no timer, no polling enabled). Returns the paging status.
export async function refreshNow(){if(LV.f?.state().on&&!LV.f.state().busy&&!LV.inTick)return LV.f.refreshNow();return tickOnce()}
async function tickOnce(){const s=source();if(!s.D||!s.D._ctx)return {status:'not-current'};const c=s.D._ctx,gen=ST.gen;if(!c.tl)return {status:'no-time-log'};
 const st=await HI.readAll(WL.call,c.well,c.tl,{caps:WL.caps,fresh:false,alive:()=>gen===ST.gen});if(st.status=='aborted')return st;
 const ls=c.logStatus.map(L=>L.uid==c.tl.uid?{...L,...st,rows:c.tl.rows.length}:L);
 if(gen!==ST.gen)return {status:'aborted'};const D=WML.toRtoc(c.R,{...c,timeLog:c.tl,logStatus:ls,source:s.D.source,current:s.D.current,fresh:HI.freshness(c.tl.rows.at(-1)?.[0],{now:WL.now(),current:true}),wellName:s.D.wellName});
 D._ctx={...c,logStatus:ls};WL.cache.set(D.key,D);render(true);return st}
// transport injection: any function with the existing ext4 contract call(op,wmlType,query,options)->{xml,result}. Does not read config or credentials.
export async function useTransport(call0,{fixture=false,current=null,currentWb=null,caps=null,now=null,version=null}={}){await import('./wwell.js?v=fp-ops-r2-20261108');WL.neg=version?{version,maxReturnNodes:version==='1.4.1.1',offered:[version]}:await HI.negotiate(call0);if(!WL.neg.version)throw new Error(WL.neg.err);const call=HI.versionAdapter(call0,WL.neg);WL.call=(op,t,q,o,ctx)=>HI.deadlineCall(call,[op,t,q,o],{ms:caps?.callMs??HI.CAPS.callMs,signal:ctx?.signal});WL.io=window.GX.wellmodel.makeIO(WL.call);WL.fixture=fixture;WL.current=current;WL.currentWb=currentWb;
 stopLive('transport changed');WL.caps=caps||undefined;WL.now=now||(()=>Date.now());WL.list=[];WL.cache.clear();WL.disc.clear();ST.gen=(ST.gen||0)+1;await wells();render(true);return WL.list}
// binds the game's existing authenticated WITSML caller (GX.witsml.callRetry) if the user already connected it. Never called automatically.
export async function useExistingTransport(current){const X=window.GX?.witsml;if(!X||typeof X.callRetry!='function')throw new Error('No existing WITSML connection in this session');return useTransport((op,t,q,o)=>X.callRetry(op,t,q,o),{current})}
export async function useFixture(o={}){const F=await import('./rtoc_fixtures.js?v=f2');return useTransport(o.call||F.call,{fixture:true,current:o.current||F.WELLS[0],caps:o.caps,now:o.now})}
function key(e){if(!ST.el)return;const r=mapKey({key:e.key,code:e.code,repeat:e.repeat,ctrlKey:e.ctrlKey,metaKey:e.metaKey,altKey:e.altKey,shiftKey:e.shiftKey,isComposing:e.isComposing,keyCode:e.keyCode,target:e.target,inButton:!!(e.target&&e.target.closest&&e.target.closest('#rtoc button'))},{open:true,intro:!!document.getElementById('intro'),overlay:!!ST.ov});
 if(!r)return;if(r.prevent)e.preventDefault();if(r.consume)e.stopImmediatePropagation();const a=r.action;if(!a)return;
 if(a=='close')close();else if(a=='overlayOpen')ov(true);else if(a=='overlayClose')ov(false);else if(a=='layer')cycle();else if(a=='roof')roof();else if(a=='frame')toggleCtx();else if(a=='view')setView(r.arg);else if(a=='joint')stepJoint(r.arg);else if(a=='jointCurrent'){if(!WL.busy&&ST.sel!=null)current()}}
addEventListener('keydown',key,true);
// ---------- render ----------
function data(){const src=source(),rec=recorded(src.key);ST.sel=(ST.pins||{})[src.key]??null;let J=C.segment(rec.samples),S=window.S||{},x;
 if(src.D){const D=src.D;if(!D.current)J.forEach(j=>j.open=false);S={surveys:D.surveys,md:D.bitMd??D.surveys.at(-1)?.[0]??0,events:D.events||[],formation:'',mode:rec.samples.at(-1)?.mode,slips:rec.samples.at(-1)?.slips};
  x={plan:D.plan,cas:D.casing,lay:D.lay||{src:null,list:[]},td:D.td,az:D.az,ref:D.ref,planSrc:D.planName?'store plan: '+D.planName:null,casSrc:'wbGeometry (store)',ro:true}}
 else if(src.H){J.forEach(j=>j.open=false);S={surveys:src.H.surveys,md:rec.samples.at(-1)?.md??0,events:[],formation:''};x={plan:planPath(),cas:casing(),lay:layers(),td:PLAN.td_md,az:PLAN.azi,ref:null,planSrc:'SIM physics plan',casSrc:'SIM casing program',ro:true}}
 else if(src.kind=='WITSMLWAIT'){J=[];S={surveys:[],md:null,events:[],formation:''};x={plan:[],cas:[],lay:{src:null,list:[]},td:null,az:0,ref:null,planSrc:null,casSrc:null,ro:true}}
 else x={plan:planPath(),cas:casing(),lay:layers(),td:PLAN.td_md,az:PLAN.azi,ref:null,planSrc:'SIM physics plan',casSrc:'SIM casing program',ro:false};
 return {src,rec,J,S,...x,j:selJoint(J),cur:curJoint(J)}}
export function state(){const d=data();return {open:!!ST.el,sel:ST.sel,layer:ST.layer,roof:ST.roof,ctx:ST.ctx,src:d.src,joints:d.J.map(j=>({n:j.n,startMd:j.startMd,endMd:j.endMd,open:j.open,partial:j.partial})),shown:d.j&&{n:d.j.n,startMd:d.j.startMd,endMd:d.j.endMd}}}
function render(force){if(!ST.el)return;const d=data(),{J,S,j,src}=d,review=ST.sel!=null;if($('rtSummary')&&!$('rtSummary').hidden&&ST.summaryKey!==src.key)hideSummary();
 $('rtSrc').textContent=src.kind=='SIM'?'SIMULATED DEMO':src.kind=='SIMHIST'?'SIM HISTORY · read-only':src.kind=='WITSMLWAIT'?'WITSML NOT CONNECTED':src.test?'TEST FIXTURE · synthetic, not a real well':'WITSML · read-only';$('rtSrc').className='badge'+(src.kind=='WITSML'?' w':'');wsel(src);
 $('rtConnectW').disabled=!!WL.busy;$('rtConnectW').textContent=WL.io?'Refresh WITSML wells':'Connect live WITSML';
 $('rtWell').textContent=(src.kind=='SIM'?'SIMULATED DEMO':src.kind=='WITSMLWAIT'?'Connect to an authorized WITSML store':src.label)+(S.formation?' · '+S.formation:'')+(src.D?(src.D.current?' · CURRENT':' · HISTORIC'):'');
 const list=[...J].reverse();
 const tk=[d.src.key,list.map(x=>x.n+(x.open?'o':'')+(x.partial?'p':'')).join(','),j&&j.n].join('|');
 if(ST._tk!==tk){ST._tk=tk;const foc=document.activeElement?.dataset?.n;$('rtTally').innerHTML=(list.length?list.map(x=>`<button class="jt${j&&x.n==j.n?' sel':''}${x.open?' cur':''}" data-n=${x.n} aria-pressed=${!!(j&&x.n==j.n)}><span>J-${String(x.n).padStart(3,'0')}${x.open?' <b>DRILLING</b>':''}${x.partial?' <small class=na>partial</small>':''}</span><span id=rtJr_${x.n}></span></button>`).join(''):NA(src.D?'No joints: no connection evidence in this source.':src.kind=='WITSMLWAIT'?'No WITSML well selected. Connect and select a live well, or choose DEMO for simulated data.':src.kind=='SIMHIST'?'No joints in this saved run.':'No joints recorded yet. Joints are recorded from this session at each connection.'))+`<div class=na id=rtRecN style="margin-top:4px;font-size:10px"></div>`;
  $('rtTally').querySelectorAll('.jt').forEach(b=>b.onclick=()=>{const n=+b.dataset.n,c=curJoint(J);select(c&&c.n==n?null:n)});if(foc)$('rtTally').querySelector(`.jt[data-n="${foc}"]`)?.focus()}
 list.forEach(x=>{const e=$('rtJr_'+x.n);if(e)e.innerHTML=`${f1(M(x.startMd))}–${f1(M(x.endMd))}${x.open?'':' <span class=ok>✓</span>'}`});
 if($('rtRecN'))$('rtRecN').textContent=src.D?(J.length?`Joints from connection evidence (pumps off + off bottom) in “${src.D.logName}”. ${J[0]?.partial?'J-001 starts at log start (partial). ':''}Earlier hole: surveys only.`:`No joints: ${src.D.why||'no connection evidence'}. Gap shown, nothing invented.`):src.kind=='WITSMLWAIT'?'No telemetry is shown until a live WITSML well is selected.':d.rec.samples.length?`Recording since ${C.brisbane(new Date(d.rec.t0))}. Earlier hole: surveys only (${(S.surveys||[]).filter(s=>s[0]<(J[0]?.startMd??Infinity)).length} stations), no joint telemetry.`:'';
 H.rtNext=review?`<div class=wr>Reviewing J-${String(ST.sel).padStart(3,'0')} (read-only)</div><button id=rtBack style="width:100%;margin-top:4px">⟲ Return to current joint</button>`:src.kind!='SIM'?`<div class=row>◦ Read-only source: no actions. Pick a joint in the tally to review it.</div>${src.D?liveRow():''}`:['Finish joint (drill down stand)','Take survey (auto every 20 ft SIM)','Make connection (HUD: Run connection)'].map(t=>`<div class=row>◦ ${t}</div>`).join('');
 if($('rtBack'))$('rtBack').onclick=current;if($('rtLive'))$('rtLive').onclick=()=>followLive(!LV.f?.state().on);if($('rtRef'))$('rtRef').onclick=()=>refreshNow();
 ['rtHold','rtSlide','rtRot','rtAuto','rtSurv'].forEach(id=>{$(id).disabled=review||src.kind!='SIM';$(id).title=review?'Disabled while reviewing a historical joint':src.kind!='SIM'?'Read-only source: simulator controls disabled':'Local simulator only'});
 $('rtMode').textContent=src.kind=='WITSMLWAIT'?'WAITING FOR WITSML':src.kind!='SIM'?(review?'REVIEW · READ-ONLY':'HISTORY · READ-ONLY'):review?'REVIEW · READ-ONLY':(S.slips?'IN SLIPS':S.mode=='slide'?'SLIDE ACTIVE':'ROTARY ACTIVE')+(S.autoSteer?' · AUTO':'');
 H.rtRev=review?`<span class=rev>${src.kind=='SIM'?'Historical joint pinned — live drilling continues':src.D?.current?'Joint pinned — source is a read-only snapshot (no polling)':'Joint pinned — historical read-only source'} <button id=rtBack2>Return to current</button></span>`:'';if($('rtBack2'))$('rtBack2').onclick=current;
 // score
 if(!j){H.rtScore=`<div>${NA(src.D?('NO JOINT EVIDENCE — '+(src.D.why||'no connections found in log')+'. Joints are not invented; gap shown.'):src.kind=='WITSMLWAIT'?'Connect and select a live WITSML well. No simulated values are shown in live mode.':src.kind=='SIM'?'DEMO MODE · Start the simulator to record a joint.':'Waiting for the first recorded joint.')}</div>`}else{const len=j.endMd-j.startMd,dr=j.slide+j.rotate||1,ps=j.slide/dr*100,pr=j.rotate/dr*100;
  H.rtScore=`<div><div style="font-size:11px;color:#9fc3ea">JOINT</div><div class=big>J-${String(j.n).padStart(3,'0')}</div></div><div><div class=rib>${j.slide>0?`<i class=sl style="width:${ps}%">SLIDE ${f1(M(j.slide))} m (${ps.toFixed(0)}%)</i>`:''}${j.rotate>0?`<i class=ro style="width:${pr}%">ROTARY ${f1(M(j.rotate))} m (${pr.toFixed(0)}%)</i>`:''}${j.open?`<i class=of style="flex:1;background:transparent;color:#9fb3cc">OPEN · ends at next connection</i>`:''}</div><div class=row><span>START MD <b>${f1(M(j.startMd))} m</b></span><span>${j.open?'BIT MD':'END MD'} <b>${f1(M(j.endMd))} m</b></span><span>Off-bottom ${f1(j.off/60,1)} min</span></div></div><div style="text-align:right"><div class=big>${f1(M(len))} m</div><div class=pct>${j.open?'drilling':(j.partial?'partial (recording started mid-joint)':'complete')}</div></div>`}
 // right panels
 {const ac=antiCollision({offsets:[]});H.rtAC=`<canvas id=rtACc height=150></canvas><div class=row><span>Projected min SF</span><b class=na>n/a</b></div>${NA('No offset wells or position-uncertainty data loaded. Anti-collision not available. '+ac.note)}`;requestAnimationFrame(polar)}
 const ev=j?C.events(S.events,j):[],faults=j?[...new Set(C.inJoint(d.rec.samples,j).flatMap(s=>s.faults?s.faults.split(','):[]))]:[];
 $('rtAlN').textContent=j?`J-${String(j.n).padStart(3,'0')}`:'';
 H.rtAl=(faults.length?faults.map(f=>`<div class="row wr">⚠ SIM fault active: ${f}</div>`).join(''):'')+(ev.length?ev.slice(-6).map(e=>`<div class=row><span>${e[1]}</span></div>`).join(''):(faults.length?'':`<span class=ok>✓ No alerts or events recorded in this joint</span>`))+`<div class=na style="font-size:10px">${src.kind=='WITSML'?(src.D?.events?.length?'Events = WITSML message objects in this wellbore (store text, read-only).':'No message objects in this wellbore.'):src.kind=='WITSMLWAIT'?'No live well selected.':'SIMULATED events only.'}</div>`;
 const rows=j?C.inJoint(d.rec.samples,j):[],qs=C.stats(rows,'q');
 H.rtWC=`<div class=row><span><i class=dot style="border-style:solid;border-color:#3d8cf0"></i>Flow in (avg)</span><b>${qs?f1(qs.avg*C.GPM_LPM,0)+' L/min':'—'}</b></div><div class=row><span><i class=dot></i>Flow out / balance</span>${NA('not available')}</div><div class=row><span><i class=dot></i>Pit volume</span>${NA('not available')}</div><div class=row><span><i class=dot></i>Gas trend</span>${NA('not available')}</div>`;
 const last=(S.surveys||[]).at(-1);
 H.rtFoot=`<span>${src.kind=='SIM'?'SOURCE · SIMULATED demo':src.kind=='SIMHIST'?'SOURCE · saved SIM run (read-only)':src.kind=='WITSMLWAIT'?'SOURCE · WITSML not connected':`SOURCE · ${src.test?'TEST FIXTURE (synthetic)':'WITSML'} · log “${src.D.logName||'none'}” ${src.D.logRows} rows (≤2000/request) · traj “${src.D.trajName||'none'}”`} · ${d.rec.samples.length} samples</span>${src.D&&src.D.gaps.length?`<span class=na id=rtGaps>GAPS: ${src.D.gaps.join(' · ')}</span>`:''}<span>${last?`Last survey ${f1(M(last[0]))} m MD · inc ${f1(last[1])}° · azi ${f1(last[2])}°`:'No surveys'}</span><span>As of ${C.brisbane()}</span>`;
 $('rtJ3t').textContent=j?`JOINT J-${String(j.n).padStart(3,'0')} · ${f1(M(j.startMd))}–${f1(M(j.endMd))} m MD`:'JOINT VIEW';$('rtJ3s').textContent=(d.lay.list.length?(d.lay.src=='formationMarker (store)'?'Formation tops from store markers (neutral, no lithology)':'SIM formation model (illustrative)'):'No formation data in source (neutral block)')+' · section along well azimuth';
 kpi(d);if(force||!ST._k||ST._k!==sig(d)){ST._k=sig(d);ST.scenes.forEach(s=>build(s,d))}drawBottom(d)}
const sig=d=>[d.src.key,d.j?.n,Math.floor((d.j?.endMd||0)/30),(d.S.surveys||[]).length,ST.ctx,ST.view,RIG.st].join('|');
function kpi(d){const S=d.S,bd=d.rec.samples.at(-1)?.bd??S.md,last=(S.surveys||[]).at(-1),cas=d.cas||[];
 $('rtCtxGeo').textContent=d.lay.list.length?(d.lay.src=='formationMarker (store)'?'STORE FORMATION TOPS · NEUTRAL':'ILLUSTRATIVE GEOLOGY · NOT TO SCALE'):'NO FORMATION DATA · NEUTRAL BLOCK';$('rtCtxSrc').textContent=d.src.kind=='WITSML'?(d.src.test?'TEST FIXTURE':'WITSML'):d.src.kind=='WITSMLWAIT'?'WAITING':'SIM';$('rtCtxAs').textContent=d.src.kind=='WITSMLWAIT'?'No WITSML well selected':d.ro?((d.src.D?.fresh?d.src.D.fresh.text+' · ':'')+(d.src.D?.current?'current well snapshot, not polled':'read-only history')+' · data to '+(d.rec.samples.at(-1)?(d.src.D?new Date(d.rec.samples.at(-1).wall).toLocaleString('en-AU',{timeZone:'Australia/Brisbane',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' AEST':C.brisbane()):'—')):'as of '+C.brisbane()+' · live context (not the selected joint)';
 H.rtKpi=`<div class=k><small>BIT DEPTH</small><b style=color:#ffb347>${Number.isFinite(bd)?f1(M(bd))+' m MD':'—'}</b></div><div class=k><small>LAST SURVEY</small><b style=color:#38d6c8>${last?f1(M(last[0]))+' m MD':'—'}</b><div>${last&&Number.isFinite(bd)?(bd>=last[0]?f1(M(bd-last[0]))+' m behind bit':'<span class=na>survey '+f1(M(last[0]-bd))+' m deeper than logged bit (log ends earlier)</span>'):''}</div></div><div class=k><small>PLANNED TD</small>${d.td!=null?`<b>${f1(M(d.td))} m MD</b><div class=na style=font-size:10px>${d.planSrc}</div>`:`<b class=na style=font-size:12px>No plan in source</b>`}</div><div class=k><small>DEPTH REFERENCE</small>${d.ref?`<b style=font-size:12px>${d.ref}</b>`:`<b class=na style=font-size:12px>${d.src.kind=='WITSMLWAIT'?'Connect WITSML to read the well datum':'Not specified'+(d.src.kind=='WITSML'?' (no wellDatum)':' (SIM)')}</b>`}</div><div class=k><small>CASING</small>${cas.length?cas.map(c=>`<div>${c.name} shoe ${f1(M(c.shoeMD))} m${c.shoeMD>S.md?' <span class=na>(planned, below bit)</span>':''}</div>`).join('')+'<div class=na style=font-size:10px>'+d.casSrc+'</div>':NA(d.src.kind=='WITSML'?'No casing (wbGeometry) in source':d.src.kind=='WITSMLWAIT'?'Connect WITSML to read casing':'No casing program loaded')}</div>`}
function casing(){try{const P=window.GX?.subsurface?.casingProgram?.();return (P?.list||[]).filter(c=>Number.isFinite(c.shoeMD))}catch(e){return []}}
function layers(){try{const L=window.GX?.subsurface?.layers?.();return {src:L?.src||'SIM',list:(L?.list||[]).filter(l=>Number.isFinite(l.top))}}catch(e){return {src:null,list:[]}}}
// ---------- 3D ----------
function mkScene(host,kind){const r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(1.5,devicePixelRatio||1));host.prepend(r.domElement);
 r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.05;
 const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(38,1,1,200000),ctl=new OrbitControls(cam,r.domElement);ctl.enableDamping=true;
 sc.add(new THREE.HemisphereLight(0xcfe2ff,0x2a1c10,1.0));const dl=new THREE.DirectionalLight(0xffe6c0,2.0);dl.position.set(-0.6,1,0.9);sc.add(dl);const fl=new THREE.DirectionalLight(0x9cc0ff,.5);fl.position.set(1,.3,-.4);sc.add(fl);
 const s={host,kind,r,sc,cam,ctl,g:new THREE.Group(),labels:[],dirty:true};ctl.addEventListener('change',()=>{s.dirty=true});sc.add(s.g);sz(s);return s}
function sz(s){s.dirty=true;const w=s.host.clientWidth||1,h=s.host.clientHeight||1;s.r.setSize(w,h,false);s.cam.aspect=w/h;s.cam.updateProjectionMatrix()}
const texCache={};function rockTex(c,seed){const k=c+seed;if(texCache[k])return texCache[k];const cv=document.createElement('canvas');cv.width=64;cv.height=256;const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,64,256);let r=seed*9301+49297;const rnd=()=>(r=(r*9301+49297)%233280)/233280;
 for(let i=0;i<70;i++){x.fillStyle=`rgba(${rnd()<.5?0:255},${rnd()<.5?0:230},${rnd()<.5?0:200},${0.05+rnd()*0.12})`;x.fillRect(0,rnd()*256,64,1+rnd()*5)}const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return texCache[k]=t}
function tube(pts,color,rad,dash){if(pts.length<2)return null;if(dash){const g=new THREE.BufferGeometry().setFromPoints(pts);const l=new THREE.Line(g,new THREE.LineDashedMaterial({color,dashSize:rad*6,gapSize:rad*4}));l.computeLineDistances();return l}
 const c=new THREE.CatmullRomCurve3(pts,false,'centripetal');return new THREE.Mesh(new THREE.TubeGeometry(c,Math.min(400,pts.length*6),rad,8,false),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.55,roughness:.4}))}
// Reference-style single scene: volumetric earth block + rig + whole trajectory + selected joint (rtoc_scene_model/rtoc_scene3d).
function build(s,d){s.dirty=true;s.g.clear();s.s3?.clear();s.labels.forEach(l=>l.el.remove());s.labels=[];
 const rows=d.j?C.inJoint(d.rec.samples,d.j):[],m=fromGame(d,{rows,frame:ST.ctx?'well':'joint',view:ST.view||'mode'});m.aspect=s.cam.aspect||1.8;const desc=compose(m);s.desc=desc;
 if(!desc.ok){H.rtStrip=`<span>${desc.warnings.join(' · ')}</span>`;return}
 const b=createScene3D(THREE,{rigModel:RIG.m});s.s3=b;const out=b.build(desc);s.g.add(out.g);
 const col={bit:'#ffb347',jstart:'#cfe3ff',jend:'#ffb347',target:'#e8d8a0'};out.labels.forEach(l=>lab(s,l.p,l.text,col[l.kind]||'#e6eef8'));
 const V=[['mode','Slide / Rotary'],['torque','Torque'],['wob','WOB'],['plan','Plan vs Actual']],av=desc.view||{available:false,id:ST.view||'mode'};
 H.rtVtabs=V.map(([id,t],i)=>`<button data-v=${id} class="${(ST.view||'mode')==id?'on':''}" aria-pressed=${(ST.view||'mode')==id} aria-disabled=${id==av.id?!av.available:false}><kbd>${i+1}</kbd>${t}</button>`).join('');
 $('rtVtabs').querySelectorAll('button').forEach(x=>x.onclick=()=>setView(x.dataset.v));
 const sourceNote=src.kind=='WITSMLWAIT'?'<span style="border-color:#c98a2e;color:#f0c080">WITSML NOT CONNECTED · no operational values shown</span>':src.kind=='SIM'?'<span style="border-color:#c98a2e;color:#f0c080">DEMO MODE · SIMULATED DATA · not a live rig</span>':src.test?'<span style="border-color:#c98a2e;color:#f0c080">TEST FIXTURE · synthetic, not a real well</span>':'';
 H.rtStrip=`<span class=lg>${legend(desc)}</span>${sourceNote}${desc.badges.concat([RIG.st=='glb'?'Rig: Codex model, not to scale':'Rig: symbol, not to scale']).map(t=>`<span>${t}</span>`).join('')}`;
 s.host.querySelector('.vunav')?.remove();if(d.j&&!av.available){const e=document.createElement('div');e.className='vunav';e.textContent=`${V.find(v=>v[0]==av.id)[1]}: not available for this source — showing ${av.id=='plan'?'actual only':'drilling mode'}`;s.host.appendChild(e)}
 const fk=[d.src.key,d.j?.n,ST.ctx,Math.round(s.cam.aspect*10),RIG.st].join('|');if(s.fitKey!==fk&&desc.camera){s.fitKey=fk;b.applyCamera(s.cam,s.ctl,desc.camera);const B=desc.block;s.cam.near=B.W/3000;s.cam.far=B.W*50;s.cam.updateProjectionMatrix()}}
function legend(desc){const L=desc.view?.legend,h=c=>'#'+c.toString(16).padStart(6,'0'),k=p=>desc.paths.some(x=>x.kind==p);if(L)return `<i style="background:linear-gradient(90deg,#2a6cff,#38d6c8,#f0d040,#f05030)"></i>${L.ch=='tq'?'Torque':'WOB'} ${f1(L.lo)}–${f1(L.hi)} ${L.unit}`;
 return `<i style=background:#3d8cf0></i>Rotary <i style=background:#f0a830></i>Slide <i style=background:#38d6c8></i>Surveyed${k('estimate')?' <i class=d style=border-color:#ffb347></i>Est. to bit':''}${k('plan')?' <i class=d></i>Plan':''}${k('offset')?' <i style=background:#a070e0></i>Offset':''}`}
function setView(v){ST.view=v;ST._k=null;render(true)}
function stepJoint(step){if(WL.busy)return false;const J=data().J;if(!J.length)return false;const cur=curJoint(J);let i=ST.sel==null?(cur?J.indexOf(cur):J.length-1):J.findIndex(x=>x.n==ST.sel);if(i<0)i=J.length-1;
 const ni=Math.max(0,Math.min(J.length-1,i+step));if(ni===i)return false;const n=J[ni].n;select(cur&&cur.n==n?null:n);return true}
function ov(on){if(!ST.el)return;ST.ov=!!on;$('rtOv').hidden=!on;if(on)$('rtOvC')?.focus()}
function polar(){const c=$('rtACc');if(!c)return;const r=c.getBoundingClientRect(),dp=Math.min(2,devicePixelRatio||1),w=Math.max(10,r.width),h=Math.max(60,r.height||104);c.width=w*dp;c.height=h*dp;const x=c.getContext('2d');x.setTransform(dp,0,0,dp,0,0);
 const cx=w/2,cy=h/2,R=Math.min(w,h)/2-8;x.strokeStyle='#2a4566';x.fillStyle='#8fb3d9';x.font='9px system-ui';[1,2,3].forEach(i=>{x.beginPath();x.arc(cx,cy,R*i/3,0,7);x.stroke();x.fillText(`${i*100} m`,cx+3,cy-R*i/3+10)});
 x.beginPath();x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.stroke();x.fillStyle='#38d6c8';x.beginPath();x.arc(cx,cy,4,0,7);x.fill();x.textAlign='center';x.fillStyle='#a9c0d8';x.fillText('own well',cx,cy+15);x.fillStyle='#f0c080';x.fillText('offset data unavailable',cx,cy+R-3)}
function buildLegacy(s,d){const g=s.g;g.clear();s.labels.forEach(l=>l.el.remove());s.labels=[];
 const S=d.S,sv=(S.surveys||[]).filter(r=>r&&Number.isFinite(r[5]));if(!sv.length)return;const az=d.az||0;const P=(N,E,T)=>new THREE.Vector3(M(C.vs(N,E,az)),-M(T),0.0);
 const whole=s.kind=='ctx',j=d.j;let lo,hi;
 if(whole){lo=0;hi=Math.max(S.md,d.td||0)}else if(j){const len=Math.max(j.endMd-j.startMd,30),pad=Math.max(len*2,120);lo=Math.max(0,j.startMd-pad);hi=j.endMd+pad}else{lo=Math.max(0,S.md-300);hi=S.md+150}
 const plan=(d.plan||[]).filter(p=>p[0]>=lo&&p[0]<=hi).map(p=>P(p[3],p[4],p[5]));const surv=sv.filter(r=>r[0]>=lo-40&&r[0]<=hi).map(r=>P(r[3],r[4],r[5]));
 const all=[...plan,...surv];if(!all.length)return;const bb=new THREE.Box3().setFromPoints(all);const sizeV=bb.getSize(new THREE.Vector3());
 let yTop=whole?0:bb.max.y+Math.max(20,sizeV.y*0.4),yBot=bb.min.y-Math.max(20,sizeV.y*0.3);const Hh=yTop-yBot;const W=Math.max(sizeV.x*1.4,Hh*(whole?1.1:1.5),40),x0=bb.min.x-(W-sizeV.x)*(whole?0.25:0.5),x1=x0+W;const D=W*0.45;
 const L=d.lay;const list=L.list.length?L.list:[{top:0,c:'#5d5a55',name:'Formation model n/a'}];
 for(let i=0;i<list.length;i++){const t=-M(list[i].top),b=list[i+1]?-M(list[i+1].top):-1e9;const a=Math.min(yTop,t),z=Math.max(yBot,b);if(a<=z)continue;const h=a-z;
  const neutral=!L.list.length||list[i].neutral;const mat=neutral?new THREE.MeshStandardMaterial({color:list[i].c||'#5d5a55',roughness:1,metalness:0,transparent:true,opacity:.85}):new THREE.MeshStandardMaterial({map:rockTex(list[i].c||'#7d6a52',i+1),roughness:.95,metalness:0});if(!neutral)mat.map.repeat.set(Math.max(1,W/60),Math.max(1,h/40));if(neutral&&L.list.length)lab(s,new THREE.Vector3(x0+(x1-x0)*0.04,t-2,0),list[i].name,'#d8dde4');
  const m=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,h,D),mat);m.position.set((x0+x1)/2,z+h/2,-D/2-0.5);g.add(m);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x000000,transparent:true,opacity:.25}));edge.position.copy(m.position);g.add(edge)}
 const r0=Math.max(W,Hh)/(whole?200:150);
 if(whole){// surface + rig symbol
  const pad=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,r0*2,D),new THREE.MeshStandardMaterial({color:0x4a5a3a,roughness:1}));pad.position.set((x0+x1)/2,r0,-D/2-0.5);g.add(pad);
  const H=Math.max(sizeV.y*0.08,30),rig=new THREE.Group();const lm=new THREE.LineBasicMaterial({color:0xffc04a});const pts=[];const b=H*0.18;for(const[x,z]of[[-b,-b],[b,-b],[b,b],[-b,b]])pts.push(new THREE.Vector3(x,0,z),new THREE.Vector3(0,H,0));
  for(let k=1;k<6;k++){const y=H*k/6,w=b*(1-k/6);for(const[a,c]of[[[-w,-w],[w,-w]],[[w,-w],[w,w]],[[w,w],[-w,w]],[[-w,w],[-w,-w]]])pts.push(new THREE.Vector3(a[0],y,a[1]),new THREE.Vector3(c[0],y,c[1]))}
  rig.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),lm));rig.position.set(P(0,0,0).x,r0*2,0);g.add(rig);lab(s,rig.position.clone().add(new THREE.Vector3(0,H,0)),'Rig (symbol)','#ffc04a');
  (d.cas||[]).forEach(c=>{if(!(c.shoeMD<=S.md))return;/* only strings whose shoe is above the current bit, drawn along surveys */const pts=sv.filter(r=>r[0]>=(c.topMD||0)&&r[0]<=c.shoeMD).map(r=>P(r[3],r[4],r[5]));if(pts.length<2)return;
   const cm=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),64,r0*2.2,10,false),new THREE.MeshStandardMaterial({color:0x9fb3c8,metalness:.8,roughness:.3,transparent:true,opacity:.35,depthWrite:false}));cm.renderOrder=2;g.add(cm);lab(s,pts.at(-1),`${c.name} · shoe ${f1(M(c.shoeMD),0)} m MD`,'#e6eef8')})}
 if(plan.length>1){const l=tube(plan,0xd0d8e6,r0,true);if(l)g.add(l)}
 if(!whole&&j){const pre=sv.filter(r=>r[0]<=j.startMd).map(r=>P(r[3],r[4],r[5])),post=sv.filter(r=>r[0]>=j.endMd).map(r=>P(r[3],r[4],r[5]));[pre,post].forEach(p=>{const t=tube(p.filter(v=>v.x>=x0-1e3),0x38d6c8,r0*0.8);if(t){t.material.transparent=true;t.material.opacity=.55;g.add(t)}});
  // selected joint coloured by recorded mode, positioned on surveys (+ estimate beyond the last survey)
  const rows=C.inJoint(d.rec.samples,j);let seg=[],mode=null;const flush=()=>{if(seg.length>1){const t=tube(seg,mode=='slide'?0xf0a830:0x3d8cf0,r0*2.6);if(t)g.add(t)}};
  const posAt=md=>{const tv=C.interpTvd(sv,md);if(tv!=null){let a=sv[0];for(const r of sv){if(r[0]<=md)a=r}const b=sv.find(r=>r[0]>=md)||a,f=(md-a[0])/((b[0]-a[0])||1);return {p:P(a[3]+(b[3]-a[3])*f,a[4]+(b[4]-a[4])*f,a[5]+(b[5]-a[5])*f),est:false}}const e=C.estimateAt(sv.at(-1),md);return e?{p:P(e.N,e.E,e.TVD),est:true}:null};
  for(const r of rows){if(r.slips)continue;const q=posAt(r.md);if(!q)continue;if(r.mode!==mode){if(seg.length)flush();const lastp=seg.at(-1);seg=lastp?[lastp]:[];mode=r.mode}if(!seg.length||seg.at(-1).distanceTo(q.p)>r0*0.4)seg.push(q.p)}flush();
  const a=posAt(j.startMd),b=posAt(j.endMd);if(a)lab(s,a.p,`START ${f1(M(j.startMd))} m`,'#cfe3ff');if(b){const bm=new THREE.Mesh(new THREE.SphereGeometry(r0*3,16,12),new THREE.MeshStandardMaterial({color:0xffb347,emissive:0xff9020,emissiveIntensity:.8}));bm.position.copy(b.p);g.add(bm);lab(s,b.p,(j.open?'BIT':'END')+` ${f1(M(j.endMd))} m${b.est?' (estimated beyond last survey)':''}`,'#ffb347')}}
 else{const t=tube(surv,0x38d6c8,r0*1.2);if(t)g.add(t);const l=sv.at(-1);lab(s,P(l[3],l[4],l[5]),'LAST SURVEY','#38d6c8');const bd=d.rec.samples.at(-1)?.bd??S.md;const e=C.estimateAt(l,bd);if(e){const pe=P(e.N,e.E,e.TVD);const t2=tube([P(l[3],l[4],l[5]),pe],0xffb347,r0,true);if(t2)g.add(t2);const bm=new THREE.Mesh(new THREE.SphereGeometry(r0*2.5,16,12),new THREE.MeshStandardMaterial({color:0xffb347,emissive:0xff9020}));bm.position.copy(pe);g.add(bm);lab(s,pe,'BIT · ESTIMATED','#ffb347')}
  const pt=(d.plan||[]).at(-1);if(pt)lab(s,P(pt[3],pt[4],pt[5]),'PLANNED TD','#d0d8e6')}
 const fk=[d.src.key,whole?'w':(j?j.n:'-'),ST.ctx,Math.round(s.cam.aspect*10)].join('|');if(s.fitKey===fk)return;s.fitKey=fk;const c=new THREE.Vector3((x0+x1)/2,(yTop+yBot)/2,-D*0.3),span=Math.max((x1-x0)/Math.max(.5,s.cam.aspect),yTop-yBot),dist=span/(2*Math.tan(20*Math.PI/180))*1.15;s.ctl.target.copy(c);const dir=new THREE.Vector3(-0.26,0.2,1).normalize();s.cam.position.copy(c).addScaledVector(dir,dist);s.cam.near=span/1000;s.cam.far=span*20;s.cam.updateProjectionMatrix();s.ctl.update()}
function lab(s,p,t,col){const el=document.createElement('div');el.className='lbl';el.textContent=t;el.style.color=col;s.host.appendChild(el);s.labels.push({el,p:p.clone()})}
function loop(){ST.raf=requestAnimationFrame(loop);if(!ST.el)return;attach();const now=performance.now();if(now-ST.last>1000){ST.last=now;render()}
 for(const s of ST.scenes){if(s.host.offsetParent===null&&getComputedStyle(s.host).position!=='fixed'&&s.host.closest('[hidden]'))continue;/* perf: the sim shares this thread; redraw only on interaction/rebuild, else ≤1 fps */const moved=s.ctl.update();if(!moved&&!s.dirty&&now-(s.lastR||0)<1000)continue;s.dirty=false;s.lastR=now;s.r.render(s.sc,s.cam);const w=s.host.clientWidth,h=s.host.clientHeight;for(const l of s.labels){const v=l.p.clone().project(s.cam);const on=v.z<1&&Math.abs(v.x)<1.05&&Math.abs(v.y)<1.05;l.el.style.display=on?'block':'none';if(on){const lw=l.el.offsetWidth||60;l.el.style.left=Math.max(lw/2+2,Math.min(w-lw/2-2,(v.x+1)/2*w))+'px';l.el.style.top=((1-v.y)/2*h)+'px'}}}}
// ---------- bottom layer (2D) ----------
function cv(c){const r=c.getBoundingClientRect(),dp=Math.min(2,devicePixelRatio||1),w=Math.max(10,r.width);if(!c.dataset.h)c.dataset.h=c.getAttribute('height');const h=+c.dataset.h;c.width=w*dp;c.height=h*dp;c.style.height=h+'px';const x=c.getContext('2d');x.setTransform(dp,0,0,dp,0,0);return {x,w,h}}
function drawBottom(d){if(!ST.el)return;d=d||data();const j=d.j,rows=j?C.inJoint(d.rec.samples,j).filter(r=>!r.slips):[];if(ST.layer=='tele'){lwd(d,j);tracks(rows,j)}else geo(d,j)}
function lwd(d,j){const {x,w,h}=cv($('rtLwd'));x.fillStyle='#08121f';x.fillRect(0,0,w,h);const L=d.lay.list,sv=d.S.surveys||[];
 if(j&&L.length){const a=j.startMd,b=Math.max(j.endMd,a+1);for(let px=0;px<w;px++){const md=a+(b-a)*px/w,tv=C.interpTvd(sv,md)??C.estimateAt(sv.at(-1),md)?.TVD;const la=tv!=null?C.layerAt(L,tv):null;x.fillStyle=la?la.c:'#222';x.globalAlpha=.55;x.fillRect(px,0,1,h)}x.globalAlpha=1}
 x.fillStyle='#000a';x.fillRect(0,0,w,14);x.fillStyle='#ffd98a';x.font='10px system-ui';x.fillText('LWD image log: not available (no image log in this source). '+(L.length?(d.lay.src=='formationMarker (store)'?'Strip shows store formation-marker intervals (neutral; no lithology data).':'Strip shows SIM formation MODEL lithology along the joint — not a measurement.'):'No formation/lithology data in this source.'),6,10)}
// plot cards (from rtoc-ui-rebuild harness): grid, MD x-axis, dual y-axes + units, legend; channels absent in the source are drawn as unavailable, never synthesised.
function tracks(rows,j){const U={rop:[r=>r.rop*FT,'m/h','ROP'],wob:[r=>r.wob*C.KLBF_KN,'kN','WOB'],tq:[r=>r.tq*C.FTLBF_KNM,'kN·m','Torque'],rpm:[r=>r.rpm,'rpm','RPM'],spp:[r=>r.spp*C.PSI_KPA,'kPa','SPP'],ecd:null,q:[r=>r.q*C.GPM_LPM,'L/min','Flow in'],qout:null},NM={ecd:'ECD',qout:'Flow out'},COLS=['#3d8cf0','#f0a830'];
 $('rtTracks').querySelectorAll('canvas').forEach(c=>{const {x,w,h}=cv(c),l=34,rg=34,t=14,bm=15,W=Math.max(10,w-l-rg),H=Math.max(10,h-t-bm);x.clearRect(0,0,w,h);x.fillStyle='#08121f';x.fillRect(0,0,w,h);x.font='9px system-ui';
  if(!j||rows.length<2){x.fillStyle='#8a9bb2';x.fillText(j?'Not enough samples recorded in this joint yet':'No joint selected',8,h/2);return}
  const a=j.startMd,b=Math.max(j.endMd,a+0.5),X=md=>l+(md-a)/(b-a)*W;x.strokeStyle='#1d3550';x.lineWidth=1;for(let i=0;i<=4;i++){const y=t+H*i/4;x.beginPath();x.moveTo(l,y);x.lineTo(l+W,y);x.stroke()}for(let i=0;i<=5;i++){const xx=l+W*i/5;x.beginPath();x.moveTo(xx,t);x.lineTo(xx,t+H);x.stroke()}
  x.fillStyle='#8fb3d9';x.textAlign='center';for(let i=0;i<=5;i++)x.fillText(f1(M(a+(b-a)*i/5)),l+W*i/5,h-4);x.textAlign='left';let lx=w-4;const leg=[];
  [c.dataset.a,c.dataset.b].forEach((k,side)=>{const u=U[k],col=COLS[side];const v=u?rows.map(u[0]):[];const fin=v.filter(Number.isFinite);const name=u?u[2]:NM[k];
   if(!u||fin.length<2){leg.push([name+' n/a','#5d6f84']);x.fillStyle='#5d6f84';x.textAlign=side?'right':'left';x.fillText(name+': not available in source',side?l+W-4:l+4,t+H/2+(side?11:0));x.textAlign='left';return}
   let lo=Math.min(...fin),hi=Math.max(...fin);const pd=(hi-lo)*.2||Math.max(1,Math.abs(hi)*.05);lo-=pd;hi+=pd;const Y=q=>t+H-(q-lo)/(hi-lo)*H;
   x.strokeStyle=col;x.lineWidth=1.3;x.beginPath();let st=false;rows.forEach((r,i)=>{const q=v[i];if(!Number.isFinite(q)){st=false;return}st?x.lineTo(X(r.md),Y(q)):x.moveTo(X(r.md),Y(q));st=true});x.stroke();
   x.fillStyle=col;x.textAlign=side?'left':'right';for(let i=0;i<=4;i++){const q=lo+(hi-lo)*i/4;x.fillText(Math.abs(q)>=1000?Math.round(q).toLocaleString('en-AU'):f1(q,Math.abs(q)<10?1:0),side?l+W+3:l-3,Y(q)+3)}
   x.save();x.translate(side?w-2:7,t+H/2);x.rotate(-Math.PI/2);x.textAlign='center';x.fillText(u[1],0,0);x.restore();x.textAlign='left';leg.push([`${name} ${f1(fin.at(-1),fin.at(-1)<10?1:0)} ${u[1]}`,col])});
  x.textAlign='right';for(const [txt,col] of leg.reverse()){x.fillStyle=col;x.fillText('— '+txt,lx,10);lx-=x.measureText('— '+txt).width+10}x.textAlign='left'})}
function geo(d,j){const c=$('rtGeoC'),{x,w,h}=cv(c),S=d.S,sv=(S.surveys||[]).filter(r=>Number.isFinite(r[5])),L=d.lay.list,az=d.az||0;x.fillStyle='#120c06';x.fillRect(0,0,w,h);
 if(!j||!sv.length){x.fillStyle='#8a9bb2';x.fillText('No joint / survey data',10,20);$('rtGeoN').textContent='';return}
 const V=r=>M(C.vs(r[3],r[4],az)),T=r=>M(r[5]);const endMd=j.endMd,last=sv.at(-1),eEnd=endMd>last[0]?C.estimateAt(last,endMd):null;
 const pts=sv.map(r=>({md:r[0],inc:r[1],v:V(r),t:T(r)}));const ja=pts.filter(p=>p.md>=j.startMd&&p.md<=endMd);let jv=ja.map(p=>p.v),jt=ja.map(p=>p.t);
 const sA=C.estimateAt(sv.filter(r=>r[0]<=j.startMd).at(-1),j.startMd);if(sA){jv.push(M(C.vs(sA.N,sA.E,az)));jt.push(M(sA.TVD))}if(eEnd){jv.push(M(C.vs(eEnd.N,eEnd.E,az)));jt.push(M(eEnd.TVD))}if(!jv.length){const p=pts.filter(p=>p.md<=endMd).at(-1)||pts[0];jv=[p.v];jt=[p.t]}
 const cl=Math.max((j.endMd-j.startMd)*3,200);/* context: 3x joint length (min 200 ft) either side, by MD */const inWin=pts.filter(p=>p.md>=j.startMd-cl&&p.md<=endMd+cl);const vv=[...jv,...inWin.map(p=>p.v)],vsp=Math.max(Math.max(...vv)-Math.min(...vv),10),v0=Math.min(...vv)-vsp*0.08,v1=Math.max(...vv)+vsp*0.25;const tvs=[...jt,...inWin.map(p=>p.t)];let t0=Math.min(...tvs),t1=Math.max(...tvs);const tp=Math.max((t1-t0)*0.35,12);t0-=tp;t1+=tp;
 const X=v=>40+(v-v0)/(v1-v0)*(w-80),Y=t=>18+(t-t0)/(t1-t0)*(h-38);
 // strata (SIM model, flat tops)
 for(let i=0;i<L.length;i++){const a=M(L[i].top),b=L[i+1]?M(L[i+1].top):1e9;if(b<t0||a>t1)continue;x.fillStyle=L[i].c;x.globalAlpha=.35;x.fillRect(40,Y(Math.max(a,t0)),w-80,Y(Math.min(b,t1))-Y(Math.max(a,t0)));x.globalAlpha=.12;x.fillStyle='#000';for(let k=0;k<12;k++){const yy=Y(Math.max(a,t0))+((k*37)%100)/100*(Y(Math.min(b,t1))-Y(Math.max(a,t0)));x.fillRect(40,yy,w-80,1)}x.globalAlpha=1}
 const bitTv=eEnd?M(eEnd.TVD):(C.interpTvd(sv,endMd)!=null?M(C.interpTvd(sv,endMd)):null);const tgt=bitTv!=null?C.layerAt(L.map(l=>({...l,top:M(l.top)})),bitTv):null;
 if(tgt){x.fillStyle='#ffd77a';x.globalAlpha=.18;x.fillRect(40,Y(Math.max(tgt.top,t0)),w-80,Y(Math.min(tgt.base??t1,t1))-Y(Math.max(tgt.top,t0)));x.globalAlpha=1}
 if(ST.roof){if(tgt){x.setLineDash([6,4]);x.lineWidth=1;x.strokeStyle='#ffe2a0cc';for(const[t,lbl]of[[tgt.top,'ROOF'],[tgt.base,'FLOOR']]){if(t==null||t<t0||t>t1)continue;x.beginPath();x.moveTo(40,Y(t));x.lineTo(w-40,Y(t));x.stroke();x.fillStyle='#ffe2a0';x.font='bold 10px system-ui';x.fillText(`${lbl} · ${tgt.name} (SIM model top, flat, ${f1(t)} m TVD)`,w-40-x.measureText(`${lbl} · ${tgt.name} (SIM model top, flat, ${f1(t)} m TVD)`).width,Y(t)-3)}x.setLineDash([])}
  $('rtGeoN').textContent=tgt?`Roof/floor: ${tgt.name} — SIM formation model (no dip data). Not measured.`:'Roof/floor: no formation model at the bit'}else $('rtGeoN').textContent='Roof/floor lines hidden (press A)';
 // inclination strip
 x.fillStyle='#000c';x.fillRect(40,0,w-80,14);x.font='9px system-ui';let lastX=-1e9;for(let i=1;i<inWin.length;i++){const a=inWin[i-1],b=inWin[i];if(X(a.v)-lastX<26)continue;lastX=X(a.v);x.strokeStyle='#ffffff22';x.beginPath();x.moveTo(X(a.v),0);x.lineTo(X(a.v),h-20);x.stroke();x.fillStyle='#cfe3ff';x.fillText(f1(b.inc)+'°',X(a.v)+2,10)}
 // trajectory: surveyed, joint highlight, estimate, projection
 const pl=(arr,col,lw,dash)=>{if(arr.length<2)return;x.setLineDash(dash||[]);x.strokeStyle=col;x.lineWidth=lw;x.beginPath();arr.forEach((p,i)=>i?x.lineTo(X(p.v),Y(p.t)):x.moveTo(X(p.v),Y(p.t)));x.stroke();x.setLineDash([])};
 pl(pts,'#e040c0',2);pl(ja.length?(sA?[{v:M(C.vs(sA.N,sA.E,az)),t:M(sA.TVD)},...ja]:ja):[],'#ff7af0',4);
 if(eEnd){const a=pts.at(-1),b={v:M(C.vs(eEnd.N,eEnd.E,az)),t:M(eEnd.TVD)};pl([a,b],'#ffb347',2,[5,3])}
 const live=ST.sel==null&&j.open;if(live){const bd=d.rec.samples.at(-1)?.bd??S.md,e=C.estimateAt(last,Math.max(bd,last[0])+30/FT);if(e){const a=eEnd?{v:M(C.vs(eEnd.N,eEnd.E,az)),t:M(eEnd.TVD)}:pts.at(-1);pl([a,{v:M(C.vs(e.N,e.E,az)),t:M(e.TVD)}],'#38d6c8',2,[2,3]);x.fillStyle='#38d6c8';x.font='10px system-ui';x.fillText('Bit projection 30 m (predictive, last inc/azi)',X(M(C.vs(e.N,e.E,az)))-200,Y(M(e.TVD))+14)}}
 x.font='10px system-ui';let lx=-1e9,ly=-1e9;inWin.forEach(p=>{x.fillStyle='#fff';x.beginPath();x.arc(X(p.v),Y(p.t),2.5,0,7);x.fill();if(Math.hypot(X(p.v)-lx,Y(p.t)-ly)<70)return;lx=X(p.v);ly=Y(p.t);const t=`${f1(M(p.md),0)} m: ${f1(p.inc)}°`;x.fillStyle='#0009';const tw=x.measureText(t).width;x.fillRect(X(p.v)-tw/2-2,Y(p.t)+5,tw+4,12);x.fillStyle='#fff';x.fillText(t,X(p.v)-tw/2,Y(p.t)+14)});
 // axes
 x.fillStyle='#9fb3cc';x.font='10px system-ui';for(let k=0;k<=5;k++){const t=t0+(t1-t0)*k/5;x.fillText(f1(t,0),4,Y(t)+3)}x.fillText('TVD m',4,h-22);for(let k=0;k<=6;k++){const v=v0+(v1-v0)*k/6;x.fillText(f1(v,0),X(v)-10,h-6)}const ve=((t1-t0)/(h-38))/((v1-v0)/(w-80));x.fillText('Vertical section m (az '+PLAN.azi+'°) · vertical exaggeration ×'+f1(1/ve,1),w-330,h-18);
 x.fillStyle='#e040c0';x.fillText('━ Surveyed',50,h-22);x.fillStyle='#ff7af0';x.fillText('━ Selected joint',120,h-22);x.fillStyle='#ffb347';x.fillText('┅ Estimate beyond last survey',210,h-22)}
// ---------- entry ----------
function hudBtn(){const H=$('hud');if(!H||$('rtocBtn'))return;const b=document.createElement('button');b.id='rtocBtn';b.textContent="Steve's RTOC";b.title="Open Steve's RTOC (per-joint dashboard)";b.onclick=()=>open();H.appendChild(b)}
// ---- Follow live: user-initiated only (default OFF, never auto-started). Polls the picked source|well|wellbore incrementally via the bound transport. ----
const LV={f:null,key:null,intervalMs:HI.LIVE.intervalMs,st:null,vis:false};
function liveRow(){const s=source(),h=s.D?._ctx?.tl?HI.liveHint(s.D._ctx.tl,{now:WL.now()}):{hint:'unknown',reason:'no time log'},v=LV.st;
 const on=v?.on&&LV.key==s.key;const msg=on?(v.paused?'paused (tab hidden)':v.fails?'retrying, backoff '+Math.round((v.nextMs||0)/1000)+' s':'every '+Math.round(v.interval/1000)+' s')+(v.stale?' · STALE: no new rows':''):(v?.stopReason&&LV.key==s.key?'off ('+v.stopReason+')':'off');
 return `<div class=row>◦ Store hint: ${h.hint.toUpperCase()} (${h.reason}) — you decide</div><div class=row>◦ Follow live: ${msg}</div><button id=rtLive style="width:100%;margin-top:4px">${on?'■ Stop following':'▶ Follow live'}</button><button id=rtRef style="width:100%;margin-top:4px">⟳ Refresh now</button>`}
function stopLive(reason){if(LV.f){LV.f.stop(reason);LV.f=null}}
export function followLive(on=true,{intervalMs}={}){if(intervalMs)LV.intervalMs=Math.max(HI.LIVE.minIntervalMs,intervalMs);stopLive('user');if(!on){render();return liveState()}
 const s=source();if(!s.D?._ctx?.tl)throw new Error('Pick a WITSML well with a time log first');const key=s.key,gen=ST.gen;LV.key=key;
 LV.f=HI.makeFollower({tick:async()=>{if(gen!==ST.gen||source().key!==key)return {status:'aborted'};LV.inTick=true;try{return await tickOnce()}finally{LV.inTick=false}},intervalMs:LV.intervalMs,now:()=>WL.now(),onState:x=>{LV.st=x;if(ST.el)render()}});
 if(!LV.vis&&typeof document!='undefined'){LV.vis=true;document.addEventListener('visibilitychange',()=>{if(!LV.f)return;document.hidden?LV.f.pause():LV.f.resume()})}
 LV.f.start();if(typeof document!='undefined'&&document.hidden)LV.f.pause();return liveState()}
export function witsmlVersion(){return WL.neg||null}
export function liveState(){return {key:LV.key,...(LV.f?LV.f.state():LV.st||{on:false})}}
const API={open,witsmlVersion,followLive,liveState,close,state,select,current,cycle,roof,joints,recorded,startRecorder,wells,pick,useFixture,useTransport,useExistingTransport,refreshNow,saveHist,isOpen:()=>!!ST.el};
function attach(){window.GX=window.GX||{};if(window.GX.rtoc!==API)window.GX.rtoc=API}/* ext.js replaces window.GX at startup: re-attach like start.js does */attach();addEventListener('load',attach);[1000,3000,6000,12000].forEach(t=>setTimeout(attach,t));startRecorder();
if(document.readyState=='loading')addEventListener('DOMContentLoaded',hudBtn);else hudBtn();setTimeout(hudBtn,3000);
if(new URLSearchParams(location.search).has('rtocfixture')){useFixture().then(()=>{if(ST.pick&&!ST.pick.startsWith('SIM|')&&!WL.cache.has(ST.pick))pick(ST.pick).catch(()=>{})}).catch(()=>{})}
setInterval(saveHist,10000);addEventListener('pagehide',saveHist);
if(new URLSearchParams(location.search).has('rtoc')){const go=()=>window.S&&window.GX?.subsurface?open():setTimeout(go,300);go()}
