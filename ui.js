// ui.js v5.7: UI simplification. Rig full screen, minimal HUD, one bottom nav (5 tabs), one panel open at a time,
// all other controls grouped in Tools. Existing buttons are MOVED (not copied), so there are no duplicates.
// ?ui=classic restores the old layout (used by older regression tests).
const $=id=>document.getElementById(id);
const GROUPS=[['equip','Equipment and exploded view'],['bha','BHA'],['geo','Surveys and geology'],['seq','Replay and sequences'],['set','Settings and connection'],['adv','Advanced (settings)']];
// id or exact text -> [group, new label or null]
const MAP=[['addeq','equip','Add equipment'],['Equipment library ▾','equip','Equipment library'],['Add sensor','equip'],['Export layout','equip'],['Import layout','equip'],['dsgbtn','equip','Rig designer'],['btnExpl','equip','Exploded view'],
 ['btnBhaB','bha','BHA builder'],
 ['btnSur','geo','Surveys'],['btnLay','geo','Subsurface layers'],['btnBit','geo','Bit depth'],['g8btn','geo','Geosteering'],['under','geo','Underground view'],
 ['conn','seq','Run connection'],['btnConn','seq','Connections'],['seqedbtn','seq','Sequence editor'],['pause','seq'],['spd','seq'],
 ['wbtn','set','WITSML connection'],['wlm','set'],['units','set'],['btnPlayer','set','Switch player']];
const STAY=new Set(['pause','spd','units','wlm','clr','uiLog','uiFrm']);const FULL=new Set(['wshop','ss56','designer','seqeditor']);
const PANEL_SKIP=new Set(['uiTop','uiNav','uiTools','uiX','mdock','sim','clock','log','appVer','bithud','wtoast','panels','plJoin','g8btn','svhud','eqmenu','libmenu']);
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
 mk('adv','Events log',()=>{$('log')?.classList.toggle('uihide')},'uiLog');mk('adv','Formation at bit',()=>{$('geoRd')?.classList.toggle('uihide')},'uiFrm');
 T.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b||STAY.has(b.id)||/Washout|Motor stall|Plugged nozzle|Brake fade/.test(b.textContent))return;setTimeout(()=>{T.style.display='none';tick()},0)},true);
 if($('wcov'))mk('adv','WITSML coverage',()=>show($('wcov')),'uiCov')}
function panels(){const o=[...document.body.children].filter(e=>(e.tagName=='DIV'||e.id=='uiTools')&&!PANEL_SKIP.has(e.id)&&/fixed|absolute/.test(getComputedStyle(e).position));document.querySelectorAll('#panels>.panel').forEach(e=>o.push(e));const w=$('wshop');if(w&&!o.includes(w))o.push(w);return o}
const vis=e=>e&&getComputedStyle(e).display!='none'&&e.getBoundingClientRect().height>0&&(e.childElementCount||e.textContent.trim());
function hide(e){if(!e)return;if(e.id=='ss56'){window.GX?.ss56?.close?.();return}if(e.id=='chatSheet'){window.GX?.chat?.toggle?.(false);e.style.setProperty('display','none','important');return}e.style.display='none'}
export function show(e){if(!e)return;for(const p of panels())if(p!==e&&vis(p))hide(p);if(e.id=='uiTools'){e.style.display='block'}else if(e.id=='chatSheet'){e.style.removeProperty('display');e.style.display='flex';window.GX?.chat?.toggle?.(true)}else if(e.id=='ss56'){window.GX?.ss56?.open?.()}else e.style.display=e.dataset.uidisp||'block';cur=e;tick()}
export function closeAll(){for(const p of panels())if(vis(p))hide(p);cur=null;tick()}
const TABS=[['rig','🛢','Rig',()=>closeAll()],['data','📈','Data',()=>{const t=$('traces');if(vis(t))return closeAll();if(t)show(t);else $('trbtn')?.click()}],['sheet','📋','Slide sheet',()=>show($('ss56'))],['tools','☰','Tools',()=>show($('uiTools'))],['crew','💬','Crew',()=>show($('chatSheet'))]];
function buildNav(){const n=document.createElement('nav');n.id='uiNav';n.innerHTML=TABS.map(([k,i,l])=>`<button id=uiTab_${k} data-k=${k}><b>${i}</b>${l}</button>`).join('');document.body.appendChild(n);
 for(const [k,,,f] of TABS)$('uiTab_'+k).onclick=()=>{const tgt={sheet:$('ss56'),tools:$('uiTools'),crew:$('chatSheet')}[k];if(tgt&&vis(tgt)&&k!='rig'){closeAll();return}f()};
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
 prevVis=new Set(panels().filter(vis));GX.ui={show,closeAll,status,tick,classic:false};setInterval(tick,400);tick()}
