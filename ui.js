// ui.js v5.7: UI simplification. Rig full screen, minimal HUD, one bottom nav (5 tabs), one panel open at a time,
// all other controls grouped in Tools. Existing buttons are MOVED (not copied), so there are no duplicates.
// v5.8 desktop (>=1024px): left nav rail; Data / Slide sheet / Tools / Well plan / Crew dock as resizable side panels, several open at once,
// never auto-closed (no 3D-click close, no modal sheets); open set, widths and active tab persist in localStorage 'dw_desk'. Phone unchanged.
// ?ui=classic restores the old layout (used by older regression tests).
const $=id=>document.getElementById(id);
const GROUPS=[['equip','Equipment and exploded view'],['bha','BHA'],['geo','Surveys and geology'],['seq','Replay and sequences'],['set','Settings and connection'],['adv','Advanced (settings)']];
// id or exact text -> [group, new label or null]
const MAP=[['addeq','equip','Add equipment'],['Equipment library ▾','equip','Equipment library'],['Add sensor','equip'],['Export layout','equip'],['Import layout','equip'],['dsgbtn','equip','Rig designer'],['btnExpl','equip','Exploded view'],
 ['btnBhaB','bha','BHA builder'],
 ['btnSur','geo','Surveys'],['btnLay','geo','Subsurface layers'],['btnBit','geo','Bit depth'],['g8btn','geo','Geosteering'],['under','geo','Underground view'],['btnStrat','geo','Earth model (lithology)'],
 ['conn','seq','Run connection'],['btnConn','seq','Connections'],['seqedbtn','seq','Sequence editor'],['pause','seq'],['spd','seq'],
 ['wbtn','set','WITSML connection'],['wlm','set'],['units','set'],['btnPlayer','set','Switch player']];
const TOOL_TGT={wbtn:'witsml',addeq:'eqmenu','Equipment library':'libmenu'};const STAY=new Set(['pause','spd','units','wlm','clr','uiLog','uiFrm']);const FULL=new Set(['wshop','ss56','designer','seqeditor']);
const PANEL_SKIP=new Set(['uiTop','uiNav','uiTools','uiX','mdock','sim','clock','log','appVer','bithud','wtoast','panels','plJoin','g8btn','svhud','eqmenu','libmenu','nosurv','vpad','edmmap']);
let cur=null,prevVis=new Set(),rop={md:null,t:0,v:0};
function css(){const s=document.createElement('style');s.textContent=`
body.ui57.ui57 #hud,body.ui57.ui57 #hud.msheet,body.ui57 #mdock,body.ui57 #sim,body.ui57 #clock,body.ui57 #bithud,body.ui57 #chatHead{display:none!important}
body.ui57 #log.uihide,body.ui57 #geoRd.uihide{display:none!important}
#uiTop{position:fixed;top:calc(4px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:9500;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:calc(100vw - 12px);font:12px system-ui;color:#e8eef5;pointer-events:none}
body.mob #uiTop{font-size:11px;gap:4px}body.mob #uiTop span{padding:2px 6px}#uiTop.hid{display:none}#uiTools #g8btn{position:static!important;inset:auto!important;transform:none!important}
#uiTop span{background:rgba(10,16,26,.82);border:1px solid #2a3a50;border-radius:10px;padding:3px 8px;white-space:nowrap}
#uiTop .st{font-weight:700}#uiTop .st.SIM{background:#8a6a10}#uiTop .st.LIVE{background:#1db954;color:#000}
#uiNav{position:fixed;left:0;right:0;bottom:0;height:calc(52px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box;z-index:9600;display:flex;background:rgba(10,16,26,.96);border-top:1px solid #2a3a50}
#uiNav button{flex:1;background:none;border:0;color:#cdd;font:12px system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:0}
#uiNav button b{font-size:18px;font-weight:400}#uiNav button.on{color:#7cf;background:#16263a}
#uiTools{position:fixed;left:0;right:0;bottom:calc(52px + env(safe-area-inset-bottom));max-height:62vh;overflow:auto;z-index:9400;background:rgba(14,22,34,.97);border-top:1px solid #2a3a50;border-radius:14px 14px 0 0;padding:12px 12px 16px;color:#e8eef5;font:14px system-ui;display:none}
@media (min-width:700px){#uiTools{left:auto;right:12px;width:420px;border-radius:14px;border:1px solid #2a3a50}}
#uiTools h4{margin:10px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#8fb4d8}
#uiTools .g{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#uiTools button,#uiTools select{min-height:38px;font-size:14px!important;background:#1b2430;color:#dde;border:1px solid #456;border-radius:8px;padding:0 10px}
#uiTools span{font-size:13px}
#uiX{position:fixed;z-index:9700;display:none;width:40px;height:40px;border-radius:20px;border:1px solid #789;background:#22303f;color:#fff;font:20px system-ui}
#appVer{bottom:calc(56px + env(safe-area-inset-bottom))!important}
body.ui57 #chatSheet{bottom:calc(52px + env(safe-area-inset-bottom))!important;left:0!important;width:100%!important;border-radius:14px 14px 0 0!important}
@media (min-width:700px){body.ui57 #chatSheet{left:auto!important;right:12px!important;width:380px!important}}
body.ui57 .msheet.mcol{max-height:none!important}`;document.head.appendChild(s)}
function find(k){return $(k)||[...document.querySelectorAll('#hud > *')].find(e=>e.textContent.trim()==k)}
function buildTools(){const T=document.createElement('section');T.id='uiTools';T.innerHTML='<b style="font-size:16px">Tools</b>'+GROUPS.map(([k,l])=>`<h4>${l}</h4><div class=g id=uig_${k}></div>`).join('');document.body.appendChild(T);
 const hud=$('hud');if(!hud)return;
 for(const [k,g,lab] of MAP){const e=find(k);if(!e)continue;if(lab&&e.tagName=='BUTTON')e.textContent=lab;if(k=='spd'){const s=document.createElement('span');s.textContent='Time speed';$('uig_seq').appendChild(s)}$('uig_'+g).appendChild(e)}
 // faults + feed + camera + leftovers
 for(const e of [...hud.children]){const t=e.textContent.trim();
  if(e.id=='plBadge'||e.id=='btnSS56'||e.id=='trbtn'){e.style.display='none';continue}
  if(/^Faults/.test(t)){e.textContent='Faults (SIM):'}
  if(/^Faults|Washout|Motor stall|Plugged nozzle|Brake fade/.test(t)||e.id=='clr'){if(e.id=='clr')e.textContent='Clear faults';$('uig_seq').appendChild(e);continue}
  if(/^Time$/.test(t)){e.remove();continue}
  if(/^Camera/.test(t)){$('uig_set').appendChild(e);continue}
  if(/^Feed/.test(t)){$('uig_set').appendChild(e);continue}
  $('uig_adv').appendChild(e)}
 const mk=(g,l,f,id)=>{const b=document.createElement('button');b.textContent=l;if(id)b.id=id;b.onclick=f;$('uig_'+g).appendChild(b)};
 mk('seq','Sequence player',()=>show($('seqpanel')),'uiSeq');
 const sig=[...document.body.children].find(e=>/^Signal sources/.test(e.textContent.trim()));if(sig){sig.id=sig.id||'sigsrc';mk('set','Signal sources',()=>show(sig),'uiSig')}
 mk('equip','BOP tests',()=>import('./bop.js?v=3').then(m=>m.open()),'uiBop');mk('adv','Events log',()=>{$('log')?.classList.toggle('uihide')},'uiLog');mk('adv','Formation at bit',()=>{$('geoRd')?.classList.toggle('uihide')},'uiFrm');
 // v5.8 phone fix: toggle-style Tools buttons (WITSML connection, Add equipment) used to CLOSE their panel when it had been hidden by ✕/Rig
 // (panel still existed, so the toggle removed it) => the tap looked like it just dismissed the sheet. A Tools tap must always OPEN its target.
 T.addEventListener('click',ev=>{const b=ev.target.closest('button'),tg=b&&(TOOL_TGT[b.id]||TOOL_TGT[b.textContent.trim()]);if(tg)setTimeout(()=>{const e=$(tg);if(!e||!vis(e)){b.onclick?.call(b,ev);const e2=$(tg);if(e2&&!vis(e2))e2.style.display='block'}tick()},20)});
 T.addEventListener('click',ev=>{if(DK.on)return;const b=ev.target.closest('button');if(!b||STAY.has(b.id)||/Washout|Motor stall|Plugged nozzle|Brake fade/.test(b.textContent))return;setTimeout(()=>{T.style.display='none';tick()},0)},true);
 if($('wcov'))mk('adv','WITSML coverage',()=>show($('wcov')),'uiCov')}
function panels(){const o=[...document.body.children].filter(e=>(e.tagName=='DIV'||e.id=='uiTools')&&!PANEL_SKIP.has(e.id)&&/fixed|absolute/.test(getComputedStyle(e).position));document.querySelectorAll('#panels>.panel').forEach(e=>o.push(e));const w=$('wshop');if(w&&!o.includes(w))o.push(w);return o}
const vis=e=>e&&getComputedStyle(e).display!='none'&&e.getBoundingClientRect().height>0&&(e.childElementCount||e.textContent.trim());
function hide(e){if(!e)return;if(e.id=='ss56'){window.GX?.ss56?.close?.();return}if(e.id=='chatSheet'){window.GX?.chat?.toggle?.(false);e.style.setProperty('display','none','important');return}e.style.display='none'}

// ---------- v5.8 desktop dock ----------
const DK={on:false,open:[],w:{},active:null},DLS='dw_desk',DEFW={data:520,sheet:640,tools:380,plan:560,crew:360};
const isDesk=()=>innerWidth>=1024;
const del=k=>({data:$('traces'),sheet:$('ss56'),tools:$('uiTools'),crew:$('chatSheet'),plan:$('wp')}[k]);
const keyOf=e=>['data','sheet','tools','plan','crew'].find(k=>del(k)===e&&e);
function dsave(){try{localStorage.setItem(DLS,JSON.stringify({open:DK.open,w:DK.w,active:DK.active,col:DK.col||{},split:DK.split}))}catch(e){}}
function dload(){try{const o=JSON.parse(localStorage.getItem(DLS)||'{}');DK.open=(o.open||[]).filter(k=>k in DEFW);DK.w=o.w||{};DK.active=o.active||null;DK.col=o.col||{};DK.split=o.split}catch(e){}}
const OPEN={data:()=>{let t=$('traces');if(!t){$('trbtn')?.click();t=$('traces')}if(t)t.style.display='block'},sheet:()=>window.GX?.ss56?.open?.(),
 tools:()=>{$('uiTools').style.display='block'},plan:()=>{window.GX?.wplan?.open?.()},crew:()=>{const c=$('chatSheet');if(!c)return;c.style.removeProperty('display');c.style.display='flex';window.GX?.chat?.toggle?.(true)}};
const SP=(e,k,v)=>e.style.setProperty(k,v,'important');
function undock(e){if(!e)return;if(e.dataset.dkOrig!=null){const d=e.style.display;e.style.cssText=e.dataset.dkOrig;e.style.display=d;delete e.dataset.dkOrig}e.querySelector(':scope>.dkH')?.remove();e.querySelector(':scope>.dkX')?.remove();e.classList.remove('dk')}
export function dockOpen(k,act=true){if(!DK.open.includes(k))DK.open.push(k);if(act)DK.active=k;DK.busy=true;try{OPEN[k]?.()}catch(e){console.warn('dock',k,e)}DK.busy=false;dsave();layout();tick()}
export function dockClose(k){DK.open=DK.open.filter(x=>x!=k);if(DK.active==k)DK.active=DK.open.at(-1)||null;const e=del(k);if(e){undock(e);hide(e)}dsave();layout();tick()}
function layout(){if(!DK.on)return;let right=0;const top=0,L=DK.open.filter(k=>vis(del(k))),want=L.map(k=>Math.max(280,Math.min(DK.w[k]||DEFW[k],innerWidth-420))),avail=innerWidth-104-240,sum=want.reduce((a,b)=>a+b,0),f=sum>avail?avail/sum:1;
 for(const k of L){const e=del(k);let w=DK.col?.[k]?40:Math.max(220,Math.round(want[L.indexOf(k)]*f));// v5.10.1 dock hook: collapsed panel = 40 px strip (dock.js)

  if(e.dataset.dkOrig==null)e.dataset.dkOrig=e.style.cssText.replace(/display:[^;]*;?/g,'');e.classList.add('dk');SP(e,'position','fixed');SP(e,'inset','auto');SP(e,'top',top+'px');SP(e,'bottom','0px');SP(e,'right',(right)+'px');SP(e,'left','auto');SP(e,'width',w+'px');SP(e,'max-width','none');SP(e,'height','auto');SP(e,'max-height','none');SP(e,'border-radius','0');SP(e,'z-index',String(9400+(DK.active==k?50:0)));SP(e,'box-sizing','border-box');
  if(k=='crew'){const b=$('chatBody');if(b)b.style.display='flex'}
  if(!e.querySelector(':scope>.dkH')){const h=document.createElement('div');h.className='dkH';h.title='Drag to resize';h.dataset.k=k;e.appendChild(h);h.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();h.setPointerCapture(ev.pointerId);const x0=ev.clientX,w0=e.getBoundingClientRect().width;
    const mv=m=>{DK.w[k]=Math.round(Math.max(280,Math.min(innerWidth-420,w0+(x0-m.clientX))));layout()},up=()=>{h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);dsave()};h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up)});
   const x=document.createElement('button');x.className='dkX';x.textContent='✕';x.title='Close panel';x.setAttribute('aria-label','Close '+k);x.onclick=ev=>{ev.stopPropagation();dockClose(k)};e.appendChild(x);
   e.addEventListener('pointerdown',()=>{if(DK.active!=k){DK.active=k;dsave();layout();tick()}},true)}
  right+=w}
 document.body.style.setProperty('--dkR',right+'px');try{window.GX?.dock?.after?.(right,L)}catch(e){}}// v5.10.1 dock hook
function dcss(){const s=document.createElement('style');s.textContent=`
body.desk #wshop{left:104px!important}
body.desk #uiNav{top:0;bottom:0;right:auto;width:104px;height:auto;flex-direction:column;justify-content:flex-start;padding:8px 0;border-top:0;border-right:1px solid #2a3a50}
body.desk #uiNav button{flex:0 0 74px;font:600 14px system-ui;gap:4px;border-left:3px solid transparent}
body.desk #uiNav button b{font-size:22px}body.desk #uiNav button.on{border-left-color:#7cf}body.desk #uiNav button.act{background:#22406a;color:#fff}
body.desk #uiTop{left:112px;transform:none;justify-content:flex-start;max-width:calc(100vw - 124px - var(--dkR,0px));font-size:14px}body.desk #uiX{display:none!important}
body.desk #appVer{bottom:4px!important;right:calc(var(--dkR,0px) + 6px)!important}
body:not(.desk) #uiTab_plan{display:none!important}
.dk{background:rgba(12,19,30,.98)!important;border:0!important;border-left:1px solid #3a5070!important;overflow:auto}.dk.dk{padding-left:12px}
.dkH{position:absolute;left:0;top:0;bottom:0;width:8px;cursor:ew-resize;background:linear-gradient(90deg,#3a5070,transparent);z-index:5;touch-action:none}
.dkH:hover{background:#5fa8ff}
.dkX{position:absolute;top:6px;right:8px;z-index:6;width:30px;height:30px;border-radius:15px;border:1px solid #789;background:#22303f;color:#fff;font:15px system-ui;cursor:pointer}
body.desk #ss56.dk .bar{padding-right:46px}body.desk #chatSheet.dk #chatHead{display:flex!important;padding-right:46px}
body.desk #traces.dk,body.desk #uiTools.dk,body.desk #wp.dk{padding-top:40px!important}body.desk #uiTools.dk,body.desk #wp.dk{font-size:15px}`;document.head.appendChild(s)}
function deskMode(){const d=isDesk();if(d==DK.on)return;DK.on=d;document.body.classList.toggle('desk',d);
 if(d){for(const k of DK.open)if(del(k)||OPEN[k]){try{DK.busy=true;OPEN[k]()}catch(e){}DK.busy=false}layout()}
 else{for(const k of Object.keys(DEFW)){const e=del(k);if(e&&e.classList.contains('dk')){undock(e);hide(e)}}document.body.style.removeProperty('--dkR')}tick()}
export function show(e){if(DK.on){const k=keyOf(e);if(k){if(!DK.busy)dockOpen(k);return}}if(!e)return;for(const p of panels())if(p!==e&&vis(p))hide(p);if(e.id=='uiTools'){e.style.display='block'}else if(e.id=='chatSheet'){e.style.removeProperty('display');e.style.display='flex';window.GX?.chat?.toggle?.(true)}else if(e.id=='ss56'){window.GX?.ss56?.open?.()}else e.style.display=e.dataset.uidisp||'block';cur=e;tick()}
export function closeAll(){if(DK.on){for(const k of [...DK.open])dockClose(k);return}for(const p of panels())if(vis(p))hide(p);cur=null;tick()}
const TABS=[['rig','🛢','Rig',()=>closeAll()],['data','📈','Data',()=>{const t=$('traces');if(vis(t))return closeAll();if(t)show(t);else $('trbtn')?.click()}],['sheet','📋','Slide sheet',()=>show($('ss56'))],['tools','☰','Tools',()=>show($('uiTools'))],['crew','💬','Crew',()=>show($('chatSheet'))],['plan','📐','Well plan',()=>window.GX?.wplan?.open?.()]];
function buildNav(){const n=document.createElement('nav');n.id='uiNav';n.innerHTML=TABS.map(([k,i,l])=>`<button id=uiTab_${k} data-k=${k}><b>${i}</b>${l}</button>`).join('');document.body.appendChild(n);
 for(const [k,,,f] of TABS)$('uiTab_'+k).onclick=()=>{if(DK.on){if(k=='rig'){closeAll();return}if(DK.open.includes(k)){if(DK.active==k)dockClose(k);else{DK.active=k;dsave();layout();tick()}}else dockOpen(k);return}const tgt={sheet:$('ss56'),tools:$('uiTools'),crew:$('chatSheet')}[k];if(tgt&&vis(tgt)&&k!='rig'){closeAll();return}f()};
 const x=document.createElement('button');x.id='uiX';x.textContent='✕';x.title='Close';x.setAttribute('aria-label','Close panel');x.onclick=()=>closeAll();document.body.appendChild(x);
 const t=document.createElement('header');t.id='uiTop';document.body.appendChild(t)}
function status(){const W=window.GX?.witsml?.WML,S=window.G?.S||{};const ft=.3048;
 const live=W&&W.mode=='live'&&!W.simulated&&W.hist?.length;const rep=W?.mode=='replay';const st=live?'LIVE':'SIM';
 const well=(W?.log?.well||W?.wellName||W?.log?.name||'SIM well').toString().slice(0,24);
 const bd=Number.isFinite(S.bitDepth)?S.bitDepth*ft:Number.isFinite(S.md)?S.md*ft:null;const now=performance.now();
 if(bd!=null){if(rop.md==null||now-rop.t>5000){if(rop.md!=null){const simH=(now-rop.t)/3.6e6*(Number($('spd')?.value)||1);rop.v=simH>0?Math.max(0,(bd-rop.md)/simH):0}rop.md=bd;rop.t=now}}
 const rpm=S.bitRpm??S.rpm??0,q=S.Q??0,onb=S.wob>1;const mode=q<50?'Pumps off':!onb?'Off bottom':rpm<5?'Slide':'Rotate';
 return {st:rep?'SIM':st,src:rep?'Replay':live?'WITSML':'SIM',well,bd,rop:rop.v,mode,player:window.GX?.player?.get()||'—'}}
function tick(){const s=status(),T=$('uiTop');if(T)T.innerHTML=`<span>${s.well}</span><span>Bit ${s.bd!=null?s.bd.toFixed(1):'—'} m</span><span>ROP ${s.rop.toFixed(1)} m/h</span><span>${s.mode}</span><span class="st ${s.st}">${s.st}${s.src=='Replay'?' · Replay':''}</span><span>👤 ${s.player}</span>`;
 if(DK.on){for(const k of [...DK.open]){const e=del(k);if(!DK.restoring&&(!e||!vis(e))){DK.open=DK.open.filter(x=>x!=k);undock(e);dsave()}}
  for(const k of Object.keys(DEFW)){const e=del(k);if(e&&vis(e)&&!DK.open.includes(k)&&!DK.busy){DK.open.push(k);DK.active=k;dsave()}}
  layout();prevVis=new Set(panels().filter(vis));cur=del(DK.active)||null;
  for(const [k] of TABS){const b=$('uiTab_'+k);b?.classList.toggle('on',k=='rig'?!DK.open.length:DK.open.includes(k));b?.classList.toggle('act',k==DK.active&&DK.open.includes(k))}
  const X=$('uiX');if(X)X.style.display='none';return}
 // one panel at a time: a panel that just opened by its own button closes the others
 const P=panels(),V=new Set(P.filter(vis));for(const e of V)if(!prevVis.has(e)){for(const o of V)if(o!==e)hide(o);cur=e}
 const open=P.filter(vis);if(!open.includes(cur))cur=open.at(-1)||null;prevVis=new Set(open);
 for(const [k] of TABS){const tg={data:$('traces'),sheet:$('ss56'),tools:$('uiTools'),crew:$('chatSheet')}[k];$('uiTab_'+k)?.classList.toggle('on',k=='rig'?!cur:tg===cur&&!!cur)}
 T&&T.classList.toggle('hid',!!cur&&FULL.has(cur.id)&&document.body.classList.contains('mob'));const X=$('uiX');if(X){if(cur&&cur.id!='ss56'&&cur.id!='wshop'){const r=cur.getBoundingClientRect();X.style.display='block';X.style.top=Math.max(4,r.top-46)+'px';X.style.left=Math.min(innerWidth-46,r.right-44)+'px'}else X.style.display='none'}}
export function init(){if(typeof document=='undefined')return;const q=new URLSearchParams(location.search);window.GX=window.GX||{};
 if(q.get('ui')=='classic'){GX.ui={classic:true};return}
 document.body.classList.add('ui57');css();buildNav();buildTools();
 for(const id of ['seqpanel','geoRd','log'])if($(id)){if(id=='seqpanel')$(id).style.display='none';else $(id).classList.add('uihide')}
 const sig=$('sigsrc');if(sig)sig.style.display='none';const ch=$('chatSheet');if(ch)ch.style.setProperty('display','none','important');
 dcss();dload();prevVis=new Set(panels().filter(vis));GX.ui={show,closeAll,status,tick,classic:false,DK,dockOpen,dockClose,layout};import('./dock.js?v=2').then(m=>m.init()).catch(e=>console.warn('dock',e));
 DK.restoring=true;deskMode();addEventListener('resize',()=>{deskMode();layout()});setTimeout(()=>{if(DK.on)for(const k of DK.open)if(!vis(del(k))){try{DK.busy=true;OPEN[k]()}catch(e){}DK.busy=false}layout();setTimeout(()=>{DK.restoring=false;tick()},1200)},1500);setInterval(tick,400);tick()}
// v5.9.2: desktop left nav (104 px) used to cover left-anchored floating panels (Sequence player, Survey table hid the MD column).
// Any visible fixed/absolute panel that starts under the nav is moved right of it and narrowed to fit.
export function navGuard(){if(!document.body.classList.contains('desk'))return;const N=document.getElementById('uiNav');if(!N)return;const nr=N.getBoundingClientRect().right+8;
 const skip=new Set(['uiNav','uiTop','start','ops3d','appVer','wshop','chatSheet']);
 for(const e of [...document.body.children,...document.querySelectorAll('#panels>.panel')]){if(skip.has(e.id)||!(e instanceof HTMLElement))continue;const cs=getComputedStyle(e);if(cs.display=='none'||!/fixed|absolute/.test(cs.position))continue;
  const r=e.getBoundingClientRect();if(r.width<4||r.height<4||r.left>=nr-1||r.right<=0)continue;if(r.width>=innerWidth-2)continue;// full-screen layers stay
  e.style.setProperty('left',nr+'px','important');e.style.maxWidth=`calc(100vw - ${nr+8}px - var(--dkR,0px))`;e.dataset.navGuard='1'}}
if(typeof window!='undefined'){setInterval(()=>{try{navGuard()}catch(e){}},400);addEventListener('resize',()=>navGuard())}
