// pob.js — Personnel On Board (SIM roster). Made-up role-based IDs only; no real people.
// Part of the environment state: GX.pob.state() -> {unit,beds,onBoard,onShift,persons,transport,stopWork,muster}
const BEDS={land:48,jackup:120,semi:150,drillship:180};
// [code,role,company,count per crew (A day / B night) by unit {land,off}, hat group, on-shift location]
const ROLES=[['OIM','OIM / Toolpusher','DRL',[1,1],'sup','Office'],['CMN','Company man','OPR',[1,1],'sup','Office'],
 ['DRL','Driller','DRL',[1,1],'drill','Drill floor'],['AD','Assistant Driller','DRL',[1,1],'drill','Drill floor'],
 ['DM','Derrickman','DRL',[1,1],'drill','Mud pits'],['FH','Floorhand / Roughneck','DRL',[3,4],'drill','Drill floor'],
 ['MUD','Mud engineer','SVC',[1,1],'svc','Mud pits'],['CRN','Crane operator','DRL',[0,1],'deck','Crane'],
 ['RAB','Roustabout','DRL',[0,6],'deck','Pipe deck'],['MED','Medic','MED',[1,1],'med','Sick bay'],
 ['MCH','Mechanic / Electrician','DRL',[1,3],'drill','Engine room'],['CAT','Catering','CAT',[2,6],'cat','Galley'],
 ['SVC','Service hand (logging/cement)','SVC',[1,6],'svc','Drill floor']];
const HAT={sup:'#f4f4f2',drill:'#e8731a',deck:'#2f6fd1',svc:'#f2c418',med:'#2aa84a',cat:null},SUIT={DRL:'#b3261e',OPR:'#1f4fa3',SVC:'#d9a400',MED:'#2a8a48',CAT:'#e9e9e6'};
const LOC3={'Drill floor':[4,12.5,-4],'Mud pits':[-14,3,9],'Office':[18,4,-16],'Crane':[-18,10,-14],'Pipe deck':[10,2,14],'Sick bay':[22,4,-12],'Engine room':[-10,3,-16],'Galley':[24,4,-20],'Quarters':[28,4,-18],'Muster station':[30,2,8],'Sheltered (stop-work)':[16,3,-10]};
const h32=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
const rng=seed=>()=>((seed=Math.imul(seed^seed>>>15,seed|1)+0x6d2b79f5|0)>>>0)/4294967296;
const SKIN=['#f6d7c3','#eac0a0','#d9a27e','#c68a62','#a86b45','#8a5534','#6b3f25'],HAIR=['#1c1410','#3b2618','#6b4423','#a8743a','#d9b36c','#8d8d8d','#c94f2a'];
export function avatar(p,sz=36){const r=rng(h32(p.id)),sk=SKIN[r()*7|0],hr=HAIR[r()*7|0],hat=HAT[p.hat],suit=SUIT[p.co],beard=r()<.3,gl=r()<.2,ey=r()<.5?2.2:1.8;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#1b2430"/>`+
 `<path d="M6 40c1-9 6-12 14-12s13 3 14 12z" fill="${suit}"/><path d="M17 28l3 5 3-5" fill="none" stroke="#fff8" stroke-width="1.2"/>`+
 `<rect x="23" y="33" width="9" height="5" rx="1" fill="#fff"/><text x="27.5" y="37" font-size="3.2" text-anchor="middle" font-family="monospace" fill="#111">${p.code}</text>`+
 `<ellipse cx="20" cy="19" rx="8" ry="9" fill="${sk}"/>`+(hat?'':`<path d="M12 17c0-7 16-7 16 0c-2-3-14-3-16 0z" fill="${hr}"/>`)+
 `<circle cx="17" cy="19" r="${ey/2+.3}" fill="#222"/><circle cx="23" cy="19" r="${ey/2+.3}" fill="#222"/>`+(gl?'<rect x="14.5" y="17" width="5" height="4" rx="1" fill="none" stroke="#222" stroke-width=".8"/><rect x="20.5" y="17" width="5" height="4" rx="1" fill="none" stroke="#222" stroke-width=".8"/>':'')+
 `<path d="M17 24q3 2 6 0" fill="none" stroke="#5a2e1e" stroke-width="1"/>`+(beard?`<path d="M12.5 21q7.5 12 15 0q-2 5-7.5 5t-7.5-5z" fill="${hr}"/>`:'')+
 (hat?`<path d="M10 15c0-8 20-8 20 0z" fill="${hat}"/><rect x="8" y="14" width="24" height="2.4" rx="1.2" fill="${hat}"/><rect x="19" y="8" width="2" height="6" fill="#0002"/>`:`<rect x="13" y="7" width="14" height="5" rx="2" fill="#fff"/>`)+`</svg>`}
const uri=s=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
let C,RC,el,hud,panel,sel=null,ST={unit:'land',persons:[],muster:null,log:[]},mk=null,lastSig='';
const unitOf=()=>{const s=RC?.site||{};return s.unit||(/north sea|offshore|semi/i.test(s.name||'')?'semi':'land')};
function roster(unit){const off=unit!='land',P=[];
 for(const [code,role,co,n,hat,loc] of ROLES)for(const crew of['A','B']){const k=n[off?1:0];for(let i=1;i<=k;i++)P.push({id:`${code}-${crew}${i}`,code,name:`${role.split(' /')[0]} ${crew}${i}`,role,co,hat,crew,work:loc})}
 // land: the off-duty crew B half stays in camp; offshore: both crews on board (hitch). Plus a 3rd crew ashore (not on board).
 return P}
const hr=()=>{const d=RC.now(),tz=RC.site.tz;const p=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(d).split(':');return +p[0]%24+p[1]/60};
const fx=()=>{const e=RC.eff||{};return{gust:e.wind_gusts_10m??0,code:e.weather_code??0,vis:e.visibility!=null?e.visibility/1000:(RC.fx().fog>0.3?0.8:10),bolt:(e.weather_code>=95)||RC.fx().bolt>0}};
// Limits (SIM defaults, illustrative; later from Environment.limits)
const LIM={heli_gust_kmh:65,heli_vis_km:1.5,bus_vis_km:0.5,lightning:true};
function transport(unit){const f=fx(),h=hr(),off=unit!='land',mode=off?'Helicopter':'Crew bus',why=[];
 if(f.bolt)why.push('lightning');if(off&&f.gust>LIM.heli_gust_kmh)why.push(`gusts ${Math.round(f.gust)} km/h > ${LIM.heli_gust_kmh}`);
 if(f.vis<(off?LIM.heli_vis_km:LIM.bus_vis_km))why.push(`visibility ${f.vis.toFixed(1)} km`);
 const next=h<10?'10:00 today':'10:00 tomorrow';return{mode,next,cancelled:why.length>0,why,status:why.length?(off?'FLIGHTS CANCELLED':'BUS DELAYED'):'On schedule'}}
function compute(){const unit=unitOf();if(unit!=ST.unit||!ST.persons.length){ST.unit=unit;ST.persons=roster(unit)}
 const h=hr(),dayShift=h>=6&&h<18,onCrew=dayShift?'A':'B',f=fx(),stop=f.bolt,M=ST.muster;
 for(const p of ST.persons){p.onShift=p.crew==onCrew&&!(p.code=='MED'&&false);let loc=p.onShift?p.work:'Quarters';
  if(stop&&p.onShift&&(loc=='Drill floor'||loc=='Pipe deck'||loc=='Crane'))loc='Sheltered (stop-work)';
  if(M){loc=M.at[p.id]!=null&&M.el>=M.at[p.id]?'Muster station':(loc+' → muster')}p.loc=loc}
 const onBoard=ST.persons.length;ST.state={unit,beds:BEDS[unit],onBoard,onShift:ST.persons.filter(p=>p.onShift).length,shift:dayShift?'Day (06:00–18:00 rig)':'Night (18:00–06:00 rig)',stopWork:stop,transport:transport(unit),muster:M&&{elapsed:M.el,accounted:Object.keys(M.at).filter(k=>M.el>=M.at[k]).length,of:onBoard},sim:true};return ST.state}
function hudText(s){return `👷 POB ${s.onBoard}/${s.beds} · on shift ${s.onShift}`+(s.stopWork?' · ⚡ STOP-WORK floor':'')+(s.transport.cancelled?' · ✈ '+s.transport.status:'')+(s.muster?` · 🚨 MUSTER ${s.muster.accounted}/${s.muster.of}`:'')+' <span style="background:#7a5a14;border-radius:3px;padding:0 3px;font-size:10px">SIM</span>'}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function startMuster(reason='Drill'){const r=rng(h32(reason+Date.now()));const at={};for(const p of ST.persons)at[p.id]=3+r()*(p.loc=='Quarters'?40:25);
 ST.muster={reason,t0:performance.now(),el:0,at,dur:60};log(`Muster started (${reason}) · POB ${ST.persons.length}`);render(true)}
function log(m){const t=new Intl.DateTimeFormat('en-GB',{timeZone:RC.site.tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(RC.now());ST.log.unshift(`${t} rig · ${m}`);ST.log=ST.log.slice(0,30);try{localStorage.dw_musterlog=JSON.stringify(ST.log)}catch(e){}}
function tickMuster(){const M=ST.muster;if(!M)return;M.el=(performance.now()-M.t0)/1000;const n=ST.persons.filter(p=>M.el>=M.at[p.id]).length;
 if(n==ST.persons.length&&!M.done){M.done=true;log(`All accounted for: ${n}/${n} in ${M.el.toFixed(0)} s`)}
 else if(M.el>M.dur&&!M.done&&!M.late){M.late=true;log(`Countdown expired: ${n}/${ST.persons.length} accounted, ${ST.persons.length-n} missing — search`)}}
function render(force){const s=compute();
 const r=document.getElementById('rigClock')?.getBoundingClientRect();hud.style.top=((r?r.bottom:150)+4)+'px';hud.innerHTML=hudText(s);
 if(!panel)return;const sig=JSON.stringify([s,sel,ST.log.length,ST.persons.map(p=>p.loc)]);if(!force&&sig==lastSig)return;lastSig=sig;
 const T=s.transport,M=ST.muster,mb=M?`<div style="border:1px solid #c44;border-radius:6px;padding:6px;margin:6px 0;background:#3a1010"><b style="color:#f88">🚨 MUSTER (${esc(M.reason)})</b> · ${M.done?'<b style="color:#7e7">ALL ACCOUNTED FOR</b>':`T+${M.el.toFixed(0)} s · ${Math.max(0,M.dur-M.el).toFixed(0)} s left`} · ${s.muster.accounted}/${s.muster.of}
  <div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:4px">${ST.persons.map(p=>{const ok=M.el>=M.at[p.id];return `<img title="${esc(p.id)}" src="${uri(avatar(p,22))}" style="opacity:${ok?1:.25};outline:${ok?'2px solid #4c4':'none'};border-radius:4px">`}).join('')}</div>
  <button id="pobEnd" style="margin-top:4px">End muster</button></div>`:'';
 const groups={};for(const p of ST.persons)(groups[p.role]??=[]).push(p);
 const det=sel&&ST.persons.find(p=>p.id==sel);
 panel.querySelector('#pobBody').innerHTML=`<div>${esc(RC.site.name)} · <b>${s.unit}</b> · beds ${s.beds} (${s.unit=='land'?'land camp':'offshore quarters'}) · <b>POB ${s.onBoard}/${s.beds}</b> · on shift ${s.onShift} · ${s.shift}</div>
 <div style="margin:4px 0;padding:4px 6px;border-radius:4px;background:${T.cancelled?'#4a1414':'#14341f'}">${T.mode==='Helicopter'?'🚁':'🚌'} Crew change ${T.mode} · next ${T.next} rig · <b style="color:${T.cancelled?'#f77':'#7e7'}">${T.status}</b>${T.why.length?' — '+esc(T.why.join(', ')):''}</div>
 ${s.stopWork?'<div style="padding:4px 6px;background:#4a3a10;border-radius:4px">⚡ Lightning/thunderstorm: STOP-WORK on drill floor, pipe deck and crane. Crew sheltered.</div>':''}${mb}
 ${det?`<div style="display:flex;gap:8px;border:1px solid #567;border-radius:6px;padding:6px;margin:6px 0">${avatar(det,64)}<div><b>${esc(det.name)}</b> <span style="opacity:.6">${det.id}</span><br>${esc(det.role)} · ${({DRL:'Drilling contractor',OPR:'Operator',SVC:'Service co.',MED:'Medical',CAT:'Catering'})[det.co]}<br>Crew ${det.crew} · ${det.onShift?'<b style="color:#7e7">ON shift</b>':'off shift'} · 📍 ${esc(det.loc)}<br><span style="opacity:.6">SIM roster person (not real)</span></div></div>`:''}
 <div style="max-height:46vh;overflow:auto;margin-top:4px">${Object.entries(groups).map(([role,L])=>`<div style="margin-top:4px;color:#8fd">${esc(role)} (${L.length})</div>`+L.map(p=>`<div data-pid="${p.id}" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:1px 2px;${sel==p.id?'background:#234':''}"><img src="${uri(avatar(p,24))}"><span style="flex:1">${esc(p.name)} <span style="opacity:.5">${p.id}</span></span><span style="color:${p.onShift?'#7e7':'#889'}">${p.onShift?'on':'off'}</span><span style="opacity:.8;min-width:110px">${esc(p.loc)}</span></div>`).join('')).join('')}</div>
 <details style="margin-top:6px"><summary>Muster log (${ST.log.length})</summary><div style="font-size:11px">${ST.log.map(esc).join('<br>')||'—'}</div></details>`;
 panel.querySelectorAll('[data-pid]').forEach(e=>e.onclick=()=>{sel=sel==e.dataset.pid?null:e.dataset.pid;render(true)});
 const pe=panel.querySelector('#pobEnd');if(pe)pe.onclick=()=>{log('Muster stood down');ST.muster=null;render(true)}}
function toggle(v){if(v===undefined)v=!panel;if(!v){panel?.remove();panel=null;return}
 panel=document.createElement('div');panel.id='pobPanel';panel.style.cssText='position:fixed;right:10px;top:60px;z-index:40;width:min(94vw,480px);max-height:86vh;overflow:auto;background:#0e1724f2;color:#e8eef4;border:1px solid #5a7;border-radius:8px;padding:8px 10px;font:12px system-ui';
 panel.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#8fd">👷 POB — Personnel On Board <span style="background:#7a5a14;border-radius:3px;padding:0 3px;font-size:10px">SIM roster</span></b><span><button id="pobMus" style="background:#7a1414;color:#fff;border:1px solid #c44;border-radius:4px">🚨 Muster drill</button> <button id="pobX">✕</button></span></div><div id="pobBody"></div>`;
 document.body.appendChild(panel);panel.querySelector('#pobX').onclick=()=>toggle(false);panel.querySelector('#pobMus').onclick=()=>startMuster('Drill');lastSig='';render(true)}
// 3D markers: one avatar sprite per occupied location with a count (cheap).
function markers(){const T=C?.THREE||window.THREE;if(!T||!C?.scene)return;if(!mk){mk=new T.Group();mk.name='pobMarkers';C.scene.add(mk)}
 const by={};for(const p of ST.persons){const k=p.loc.split(' →')[0];(by[k]??=[]).push(p)}const sig=JSON.stringify(Object.entries(by).map(([k,v])=>[k,v.length]));if(mk.userData.sig==sig)return;mk.userData.sig=sig;
 while(mk.children.length){const c=mk.children.pop();c.material.map?.dispose();c.material.dispose()}
 for(const [k,L] of Object.entries(by)){const pos=LOC3[k];if(!pos)continue;const cv=document.createElement('canvas');cv.width=cv.height=96;const g=cv.getContext('2d'),tx=new T.CanvasTexture(cv),im=new Image();
  im.onload=()=>{g.drawImage(im,0,0,96,96);g.fillStyle='#000c';g.fillRect(52,64,44,32);g.fillStyle='#fff';g.font='bold 26px system-ui';g.fillText(L.length,56,90);tx.needsUpdate=true};im.src=uri(avatar(L[0],96));
  const s=new T.Sprite(new T.SpriteMaterial({map:tx,depthTest:false}));s.position.set(...pos);s.scale.set(3,3,1);s.renderOrder=999;s.userData.loc=k;mk.add(s)}}
export async function init(c){C=c;RC=window.GX?.rigClock;if(!RC)return;if(!C.THREE){try{C.THREE=await import('three')}catch(e){}}
 try{ST.log=JSON.parse(localStorage.dw_musterlog||'[]')}catch(e){}
 hud=document.createElement('div');hud.id='pobHud';hud.style.cssText='position:fixed;left:8px;z-index:6;color:#dde;background:#0b1320cc;border:1px solid #456;border-radius:6px;padding:3px 8px;font:12px system-ui;cursor:pointer';hud.title='Open POB panel';hud.onclick=()=>toggle();document.body.appendChild(hud);
 const q=new URLSearchParams(location.search);
 setInterval(()=>{tickMuster();render();markers()},500);render();markers();if(q.get('pob')=='1')toggle(true);
 window.GX.pob={state:compute,persons:()=>ST.persons,toggle,muster:startMuster,endMuster:()=>{ST.muster=null},avatar,log:()=>ST.log,limits:LIM,select:id=>{sel=id;render(true)}}}
