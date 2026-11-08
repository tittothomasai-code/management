// vla.js (v5.15.1): Vision-Language-Action robot on the drill floor. SIM only. Scripted logic, no external services.
// Open with Shift+V, the "Robot (VLA)" HUD button, ?demo=vla, or GX.vla.open(). (Plain V stays with the subsurface view.)
// Modular: core (perceive / parse / plan / safety) is pure and reads one env record. Set GX.vla.setEnv(fn) to drive it
// from the physics/environment data record later. fn() must return {crew:[{id,name,x,z}], gustKmh, windKmh, windDir, lightning, visKm, pipe:{rack,floor}}.
export const LIM={gustKmh:50,windKmh:40,visKm:0.8,zoneM:1.6};
export const WELL={x:0,z:0},RACK={x:-4.2,z:2.4},HOME={x:-2.6,z:1.4},BOP={x:0,z:0,y:-3};
const INTENTS=[
 {id:'stand',words:['stand','pipe','joint','tubular','pick','well centre','well center','trip'],label:'Move next stand to well centre',
  steps:['Scan pipe rack','Move arm to next stand','Close gripper','Lift stand','Move stand to well centre','Lower stand into stump','Open gripper','Return to park position']},
 {id:'bop',words:['bop','leak','inspect','blowout','preventer','check'],label:'Inspect BOP for leaks',
  steps:['Move to cellar access','Extend camera arm','Scan BOP flanges','Scan ram bonnets','Compare with baseline','Retract camera arm','Return to park position']},
 {id:'clear',words:['clear','tidy','clean','floor','remove','debris'],label:'Clear the drill floor',
  steps:['Scan drill floor','Pick loose item 1','Place item 1 on pipe rack','Pick loose item 2','Place item 2 on pipe rack','Return to park position']},
 {id:'park',words:['park','home','stop','stow','return'],label:'Park the robot',steps:['Return to park position']}];
export const EXAMPLES=['Pick up the next stand and move it to well centre','Inspect the BOP for leaks','Clear the drill floor','Park the robot'];
let envFn=null;
const RC=()=>window.GX?.rigClock;
function defaultEnv(){const e=RC()?.eff||{},f=RC()?.fx?.()||{};const pob=window.GX?.pob?.state?.();
 const floor=(pob?.persons||window.GX?.pob?.persons?.()||[]).filter(p=>p.onShift&&p.loc=='Drill floor');
 const spots=[[2.8,-2.2],[-1.2,-3.4],[3.4,2.6],[1.5,3.6],[-3.6,-1.8],[4,0]];
 const crew=floor.map((p,i)=>({id:p.id,name:p.name,code:p.code,x:spots[i%6][0],z:spots[i%6][1]}));
 if(T.intrude)crew.push({id:'TEST-1',name:'Floorhand (test)',code:'FH',x:-3.1,z:1.9});
 return{crew,gustKmh:e.wind_gusts_10m??0,windKmh:e.wind_speed_10m??0,windDir:e.wind_direction_10m??270,lightning:(e.weather_code>=95)||(f.bolt>0),
  visKm:e.visibility!=null?e.visibility/1000:(f.fog>0.3?0.6:10),rain:e.precipitation||0,pipe:{rack:T.rack,floor:T.loose},src:pob?'POB board + rig weather (SIM)':'Rig weather (SIM)'}}
export const env=()=>(envFn||defaultEnv)();
// Vision: turn the env record into a list of what the robot "sees".
export function perceive(E){const v=[];v.push({k:'Crew on drill floor',v:E.crew.length});
 for(const c of E.crew)v.push({k:c.name,v:`${c.x.toFixed(1)} m, ${c.z.toFixed(1)} m`,crew:c});
 v.push({k:'Stands on rack',v:E.pipe.rack},{k:'Loose items on floor',v:E.pipe.floor},{k:'Wind / gust',v:`${Math.round(E.windKmh)} / ${Math.round(E.gustKmh)} km/h`},
  {k:'Lightning',v:E.lightning?'YES':'No'},{k:'Visibility',v:`${E.visKm>=10?'>10':E.visKm.toFixed(1)} km`});return v}
// Language: keyword scoring (scripted, not a model).
export function parse(text){const t=(text||'').toLowerCase();let best=null,sc=0;
 for(const I of INTENTS){const s=I.words.reduce((a,w)=>a+(t.includes(w)?1:0),0);if(s>sc){sc=s;best=I}}
 return best?{intent:best,hits:sc}:{intent:null,hits:0}}
export function confidence(P,E){if(!P.intent)return 0.15;let c=0.55+Math.min(3,P.hits)*0.13;
 if(E.visKm<2)c-=0.15;if(E.rain>2)c-=0.07;if(P.intent.id=='stand'&&E.pipe.rack<1)c-=0.4;if(P.intent.id=='clear'&&E.pipe.floor<1)c-=0.3;return Math.max(0.05,Math.min(0.98,c))}
// Safety: returns list of reasons to stop. Work zone = circle around the arm path.
const segD=(p,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz||1;let t=((p.x-a.x)*dx+(p.z-a.z)*dz)/l;t=Math.max(0,Math.min(1,t));return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)};
export function zonePath(id){return id=='bop'?[HOME,{x:0.9,z:0.9}]:id=='clear'?[HOME,RACK,{x:1.2,z:-0.8}]:[HOME,RACK,WELL]}
export function safety(E,id){const r=[];const P=zonePath(id||'stand');
 for(const c of E.crew){let d=1e9;for(let i=0;i<P.length-1;i++)d=Math.min(d,segD(c,P[i],P[i+1]));if(d<LIM.zoneM)r.push({type:'crew',sev:'high',text:`${c.name} is in the robot work zone (${d.toFixed(1)} m). Robot stopped.`})}
 if(E.lightning)r.push({type:'lightning',sev:'high',text:'Lightning near the rig. Robot stopped. Stay clear of the derrick.'});
 if(E.gustKmh>LIM.gustKmh)r.push({type:'wind',sev:'warn',text:`Wind gust ${Math.round(E.gustKmh)} km/h is more than limit ${LIM.gustKmh} km/h. Robot stopped.`});
 if(E.visKm<LIM.visKm)r.push({type:'vis',sev:'warn',text:`Visibility ${E.visKm.toFixed(1)} km is less than limit ${LIM.visKm} km. Robot stopped.`});return r}
export function plan(text,E=env()){const P=parse(text),conf=confidence(P,E);return{text,intent:P.intent?.id||null,label:P.intent?.label||'Command not clear',steps:P.intent?P.intent.steps.slice():[],conf,ok:!!P.intent&&conf>=0.5,stops:safety(E,P.intent?.id)}}
// ---- 3D robot ----
const T={rack:6,loose:2,intrude:false,run:null,log:[],R:null,last:null};
const POSE={park:{x:HOME.x,z:HOME.z,yaw:0,sh:0.3,el:1.9,g:1},rack:{x:-3.4,z:1.9,yaw:2.3,sh:1.1,el:0.9,g:1},lift:{x:-3.4,z:1.9,yaw:2.3,sh:0.5,el:1.3,g:0},
 well:{x:-1.2,z:0.7,yaw:-0.5,sh:0.9,el:0.8,g:0},bop:{x:-0.4,z:1.2,yaw:-0.9,sh:1.5,el:0.2,g:1},floor:{x:0.2,z:-0.6,yaw:-1.2,sh:1.3,el:0.6,g:1}};
const STEPPOSE={'Scan pipe rack':['rack',0,1],'Move arm to next stand':['rack',0,1],'Close gripper':['rack',1,0],'Lift stand':['lift',1,0],'Move stand to well centre':['well',1,0],
 'Lower stand into stump':['well',1,1],'Open gripper':['well',0,1],'Return to park position':['park',0,1],'Move to cellar access':['bop',0,1],'Extend camera arm':['bop',0,1],
 'Scan BOP flanges':['bop',0,1],'Scan ram bonnets':['bop',0,1],'Compare with baseline':['bop',0,1],'Retract camera arm':['park',0,1],'Scan drill floor':['floor',0,1],
 'Pick loose item 1':['floor',2,0],'Place item 1 on pipe rack':['rack',2,1],'Pick loose item 2':['floor',2,0],'Place item 2 on pipe rack':['rack',2,1]};
function build(C){const THREE=C.THREE;if(!THREE||!C.scene)return null;const Y=(C.FLOOR||8)+0.3;
 const M=(c,m=0.5,r=0.45)=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r});const Y1=M(0xf2b705),D=M(0x2b2f36,0.6,0.5),S=M(0x9aa4ad,0.8,0.3);
 const g=new THREE.Group();g.name='vla_robot';
 const base=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.35,0.9),D);base.position.y=0.18;g.add(base);
 for(const sx of[-0.45,0.45])for(const sz of[-0.38,0.38]){const w=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.12,14),M(0x111111,0.1,0.9));w.rotation.x=Math.PI/2;w.position.set(sx,0.15,sz);g.add(w)}
 const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.22,0.08,0.92),Y1);stripe.position.y=0.33;g.add(stripe);
 const turret=new THREE.Group();turret.position.y=0.37;g.add(turret);
 const col=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.5,18),Y1);col.position.y=0.25;turret.add(col);
 const sh=new THREE.Group();sh.position.y=0.55;turret.add(sh);
 const up=new THREE.Mesh(new THREE.BoxGeometry(0.18,1.3,0.18),Y1);up.position.y=0.65;sh.add(up);
 const el=new THREE.Group();el.position.y=1.3;sh.add(el);const j=new THREE.Mesh(new THREE.SphereGeometry(0.14,14,10),D);el.add(j);
 const fo=new THREE.Mesh(new THREE.BoxGeometry(0.14,1.1,0.14),Y1);fo.position.y=0.55;el.add(fo);
 const hand=new THREE.Group();hand.position.y=1.1;el.add(hand);
 const fl=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.25,0.12),S),fr=fl.clone();hand.add(fl,fr);
 const cam=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.1,0.12),D);cam.position.set(0,0.12,0.1);hand.add(cam);
 const lens=new THREE.Mesh(new THREE.CircleGeometry(0.035,12),new THREE.MeshBasicMaterial({color:0x33ddff}));lens.position.set(0,0.12,0.161);hand.add(lens);
 const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,3.2,12),M(0x6b4a2e,0.7,0.4));pipe.visible=false;hand.add(pipe);
 const box=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.25,0.3),M(0x3a6ea5,0.3,0.6));box.visible=false;box.position.y=0.15;hand.add(box);
 const beacon=new THREE.Mesh(new THREE.SphereGeometry(0.08,10,8),new THREE.MeshBasicMaterial({color:0x22cc55}));beacon.position.set(0.45,0.5,0.3);g.add(beacon);
 const zone=new THREE.Mesh(new THREE.RingGeometry(LIM.zoneM-0.06,LIM.zoneM,48),new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:0.55,side:THREE.DoubleSide}));zone.rotation.x=-Math.PI/2;zone.position.y=0.03;g.add(zone);
 g.position.set(HOME.x,Y,HOME.z);C.scene.add(g);
 return{g,turret,sh,el,fl,fr,pipe,box,beacon,zone,Y,p:{...POSE.park}}}
function apply(R){const p=R.p;R.g.position.x=p.x;R.g.position.z=p.z;R.turret.rotation.y=p.yaw;R.sh.rotation.z=p.sh;R.el.rotation.z=p.el;const o=0.04+0.08*p.g;R.fl.position.x=-o;R.fr.position.x=o}
// ---- run loop ----
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function moveTo(key,carry,grip,dur){const R=T.R;const a={...(R?R.p:POSE.park)},b={...POSE[key],g:grip};const t0=performance.now();
 if(R){R.pipe.visible=carry==1;R.box.visible=carry==2}
 while(true){const k=Math.min(1,(performance.now()-t0)/dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;if(R){for(const q in b)R.p[q]=a[q]+(b[q]-a[q])*e;apply(R)}
  const s=safety(env(),T.run?.intent);if(s.length)return s;if(T.run?.abort)return[{type:'op',sev:'info',text:'Operator stopped the robot.'}];if(k>=1)return null;await sleep(30)}}
function alert(s){try{window.GX?.alerts?.push({type:'vla_'+s.type,severity:s.sev,text:'Robot (VLA): '+s.text})}catch(e){}}
export async function run(text){if(T.run&&!T.run.done)return T.run;const P=plan(text);T.run={...P,i:-1,state:'Planning',done:false,abort:false,t0:Date.now()};render();
 if(!P.ok){T.run.state=P.intent?'Low confidence. Robot does not move. Give a clearer command.':'Command not clear. Robot does not move.';T.run.done=true;render();return T.run}
 if(P.stops.length){T.run.state='STOPPED (safety)';T.run.stops=P.stops;P.stops.forEach(alert);T.run.done=true;beacon(1);render();return T.run}
 beacon(0.5);for(let i=0;i<P.steps.length;i++){T.run.i=i;T.run.state='Running';render();const[k,c,g]=STEPPOSE[P.steps[i]]||['park',0,1];
  const s=await moveTo(k,c,g,P.steps[i].startsWith('Scan')||P.steps[i].startsWith('Compare')?1600:1200);
  if(s){T.run.stops=s;T.run.state=s[0].type=='op'?'Stopped by operator':'STOPPED (safety)';s.forEach(alert);beacon(1);T.run.done=true;render();return T.run}}
 if(P.intent=='stand')T.rack=Math.max(0,T.rack-1);if(P.intent=='clear')T.loose=0;
 T.run.state='Complete';T.run.result=P.intent=='bop'?'No leak seen at flanges or ram bonnets (SIM). Record the inspection.':P.intent=='stand'?'Stand is in the stump at well centre.':P.intent=='clear'?'Drill floor is clear.':'Robot is parked.';
 T.run.done=true;beacon(0);T.log.unshift(`${new Date().toLocaleTimeString()} ${P.label}: complete`);render();return T.run}
function beacon(l){const b=T.R?.beacon;if(b)b.material.color.setHex(l>=1?0xff2222:l>0?0xffaa00:0x22cc55)}

// ---- auto demo (v5.15.1): "Watch VLA demo" button on the main page ----
const D={on:false,i:0,abort:false};const DEMO=['Move next stand to well centre','Crew in work zone: robot stops','Clear the drill floor','Thunderstorm: robot stops','Reset weather and park'];
const wxSet=k=>{try{RC()?.setWeather?.(k)}catch(e){}};
async function dwait(ms){const t=Date.now();while(Date.now()-t<ms){if(D.abort)throw 0;await sleep(100)}}
async function dstep(i,f){if(D.abort)throw 0;D.i=i;render();await f();if(D.abort)throw 0;await dwait(4000)}
export async function demo(){if(D.on)return;const S=document.getElementById('start');if(S&&window.GX?.start?.enter){GX.start.enter('simFree');await sleep(1200)}
 open();D.on=true;D.abort=false;T.intrude=false;T.rack=6;T.loose=2;if(T.run&&!T.run.done)T.run.abort=true;await sleep(200);T.run=null;
 try{await dstep(0,async()=>{wxSet('clear');await sleep(400);await run('Pick up the next stand and move it to well centre')});
  await dstep(1,async()=>{T.intrude=true;await run('Inspect the BOP for leaks')});
  await dstep(2,async()=>{T.intrude=false;await run('Clear the drill floor')});
  await dstep(3,async()=>{wxSet('storm');await sleep(600);await run('Pick up the next stand and move it to well centre')});
  await dstep(4,async()=>{wxSet('clear');await sleep(600);await run('Park the robot')});D.i=5}catch(e){}
 endDemo()}
export function stopDemo(){D.abort=true;if(T.run&&!T.run.done)T.run.abort=true;endDemo()}
function endDemo(){if(!D.on)return;D.on=false;T.intrude=false;wxSet('clear');render()}
function demoBar(){const b=$('vlaDemo');if(!b)return;b.style.display=D.on?'flex':'none';if(D.on)$('vlaDemoT').textContent=`Demo ${Math.min(D.i+1,5)}/5: ${DEMO[Math.min(D.i,4)]}`}
function mainBtn(){if($('vlaMain'))return;const b=document.createElement('button');b.id='vlaMain';b.textContent='▶ Watch VLA demo';b.title='Watch the robot (VLA) simulation';
 b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(64px + env(safe-area-inset-bottom));z-index:100002;background:#f2b705;color:#111;font:700 15px system-ui;border:2px solid #fff;border-radius:22px;padding:10px 20px;cursor:pointer;box-shadow:0 4px 14px #0008';
 b.onclick=()=>D.on?stopDemo():demo();document.body.appendChild(b);setInterval(()=>{b.textContent=D.on?'■ Stop VLA demo':'▶ Watch VLA demo';b.style.background=D.on?'#c62828':'#f2b705';b.style.color=D.on?'#fff':'#111'},300)}
// ---- panel ----
const $=id=>document.getElementById(id);const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function vision(E){const s=24,cx=110,cz=80,X=x=>cx+x*s,Z=z=>cz+z*s;const P=zonePath(T.run?.intent||'stand');let h=`<svg viewBox="0 0 220 160" width="220" height="160" style="background:#0b1118;border:1px solid #345;border-radius:4px">`;
 h+=`<rect x="${X(-4.6)}" y="${Z(-3.6)}" width="${9.2*s}" height="${7.2*s}" fill="#1a232d" stroke="#3a4a5a"/>`;
 h+=`<polyline points="${P.map(p=>X(p.x)+','+Z(p.z)).join(' ')}" fill="none" stroke="#ffaa0044" stroke-width="${LIM.zoneM*2*s}" stroke-linecap="round" stroke-linejoin="round"/>`;
 h+=`<rect x="${X(RACK.x)-14}" y="${Z(RACK.z)-6}" width="28" height="12" fill="#6b4a2e"/><text x="${X(RACK.x)}" y="${Z(RACK.z)+18}" fill="#ab9" font-size="8" text-anchor="middle">rack ${E.pipe.rack}</text>`;
 h+=`<circle cx="${X(0)}" cy="${Z(0)}" r="6" fill="none" stroke="#8fd" stroke-width="2"/><text x="${X(0)}" y="${Z(0)-9}" fill="#8fd" font-size="8" text-anchor="middle">well</text>`;
 const R=T.R?.p||POSE.park;h+=`<rect x="${X(R.x)-7}" y="${Z(R.z)-5}" width="14" height="10" fill="#f2b705"/>`;
 const bad=new Set(safety(E,T.run?.intent).filter(r=>r.type=='crew').map(r=>r.text.split(' is ')[0]));
 for(const c of E.crew)h+=`<circle cx="${X(c.x)}" cy="${Z(c.z)}" r="5" fill="${bad.has(c.name)?'#ff3b3b':'#4fc3f7'}"/><text x="${X(c.x)}" y="${Z(c.z)-7}" fill="#cde" font-size="7" text-anchor="middle">${esc(c.code||'')}</text>`;
 const a=(E.windDir||0)*Math.PI/180;h+=`<g transform="translate(196,22) rotate(${(E.windDir||0)+180})"><line x1="0" y1="-10" x2="0" y2="10" stroke="${E.gustKmh>LIM.gustKmh?'#f55':'#9cf'}" stroke-width="2"/><path d="M-4 5 L0 11 L4 5" fill="none" stroke="${E.gustKmh>LIM.gustKmh?'#f55':'#9cf'}" stroke-width="2"/></g><text x="196" y="44" fill="#9ab" font-size="7" text-anchor="middle">wind</text>`;
 return h+'</svg>'}
export function render(){const p=$('vlaP');if(!p||p.style.display=='none')return;demoBar();const E=env(),r=T.run,st=safety(E,r?.intent);
 const conf=r?Math.round(r.conf*100):null,cc=conf==null?'#789':conf>=75?'#4caf50':conf>=50?'#ffb300':'#e53935';
 $('vlaVis').innerHTML=vision(E)+`<div style="font-size:10px;opacity:.75;margin-top:2px">Source: ${esc(E.src||'env record')}</div><table style="font-size:11px;width:100%">${perceive(E).map(v=>`<tr><td style="opacity:.75">${esc(v.k)}</td><td style="text-align:right"><b>${esc(v.v)}</b></td></tr>`).join('')}</table>`;
 $('vlaLang').innerHTML=r?`<div>Command: <i>"${esc(r.text)}"</i></div><div>Intent: <b>${esc(r.label)}</b></div><div style="margin:4px 0">Confidence: <b style="color:${cc}">${conf}%</b><div style="height:6px;background:#233;border-radius:3px"><div style="height:6px;width:${conf}%;background:${cc};border-radius:3px"></div></div></div><ol style="margin:4px 0 0 18px;padding:0">${r.steps.map((s,i)=>`<li style="${i==r.i&&!r.done?'color:#ffd54f;font-weight:700':i<r.i||(r.done&&r.state=='Complete')?'color:#8c8':''}">${esc(s)}</li>`).join('')}</ol>`:'<i style="opacity:.7">Type or pick a command. Then push Run.</i>';
 const sc=r?.state=='Complete'?'#4caf50':/STOP/.test(r?.state||'')?'#e53935':'#ffb300';
 $('vlaAct').innerHTML=(r?`<div>Status: <b style="color:${sc}">${esc(r.state)}</b>${r.i>=0&&!r.done?` · step ${r.i+1}/${r.steps.length}`:''}</div>`:'<div>Status: <b>Parked</b></div>')+(r?.result?`<div style="color:#8c8">${esc(r.result)}</div>`:'')+
  ((r?.stops||[]).map(s=>`<div style="color:#ff8a80">⚠ ${esc(s.text)}</div>`).join(''))+
  `<div style="margin-top:4px;font-size:11px">Safety check now: ${st.length?`<b style="color:#ff8a80">${st.length} stop condition(s)</b>`:'<b style="color:#8c8">Clear</b>'} · limits: gust ${LIM.gustKmh} km/h, zone ${LIM.zoneM} m, no lightning</div>`}
const B='background:#234;color:#def;border:1px solid #567;border-radius:3px;padding:3px 7px;margin:2px;cursor:pointer;font-size:11px';
export function open(){let p=$('vlaP');if(!p){p=document.createElement('div');p.id='vlaP';p.style.cssText='position:fixed;right:10px;top:60px;z-index:40;width:min(640px,96vw);max-height:84vh;overflow:auto;background:#101820f2;color:#e8eef4;border:1px solid #5a7;border-radius:8px;padding:10px;font:12px system-ui';
 p.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#8fd;font-size:14px">Robot (VLA): Vision · Language · Action <span style="background:#b8860b;color:#000;padding:1px 5px;border-radius:3px;font-size:10px">SIM</span></b><button id="vlaX" style="${B}">Close</button></div>
 <div id="vlaDemo" style="display:none;justify-content:space-between;align-items:center;background:#3a2a00;border:1px solid #f2b705;border-radius:4px;padding:4px 8px;margin-top:6px"><b id="vlaDemoT" style="color:#ffd54f"></b><button id="vlaDemoX" style="${B};background:#8b1e1e">Stop / exit demo</button></div><div style="display:flex;gap:6px;margin:8px 0"><input id="vlaIn" list="vlaEx" placeholder="Type a command, e.g. Inspect the BOP for leaks" style="flex:1;background:#0b1118;color:#e8eef4;border:1px solid #456;border-radius:4px;padding:5px"><datalist id="vlaEx">${EXAMPLES.map(e=>`<option value="${e}">`).join('')}</datalist><button id="vlaGo" style="${B};background:#2e7d32">Run</button><button id="vlaStop" style="${B};background:#8b1e1e">Stop</button></div>
 <div style="margin-bottom:6px">${EXAMPLES.map(e=>`<button class="vlaEx" style="${B}">${e}</button>`).join('')}</div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
 <div><h4 style="margin:0 0 4px;color:#8fd">1. Vision</h4><div id="vlaVis"></div></div><div><h4 style="margin:0 0 4px;color:#8fd">2. Language</h4><div id="vlaLang"></div></div><div><h4 style="margin:0 0 4px;color:#8fd">3. Action</h4><div id="vlaAct"></div>
 <div style="margin-top:8px;border-top:1px solid #345;padding-top:6px;font-size:11px"><b>Test safety</b><br><button id="vlaCrew" style="${B}">Put crew in work zone</button><button id="vlaWind" style="${B}">Set high wind</button><button id="vlaStorm" style="${B}">Set thunderstorm</button><button id="vlaClr" style="${B}">Set clear weather</button><button id="vlaReset" style="${B}">Reset rack</button></div></div></div>
 <div style="font-size:10px;opacity:.65;margin-top:6px">Simulated robot. Scripted command parser. Not connected to real equipment. Stop alerts go to the Alerts log (A).</div>`;
 document.body.appendChild(p);$('vlaX').onclick=()=>{stopDemo();close()};$('vlaDemoX').onclick=stopDemo;const go=()=>{const t=$('vlaIn').value.trim();if(t)run(t)};$('vlaGo').onclick=go;$('vlaIn').onkeydown=e=>{e.stopPropagation();if(e.key=='Enter')go()};
 p.querySelectorAll('.vlaEx').forEach(b=>b.onclick=()=>{$('vlaIn').value=b.textContent;run(b.textContent)});$('vlaStop').onclick=()=>{if(T.run&&!T.run.done)T.run.abort=true};
 $('vlaCrew').onclick=()=>{T.intrude=!T.intrude;$('vlaCrew').textContent=T.intrude?'Move crew out of work zone':'Put crew in work zone';render()};
 const wx=k=>{try{RC()?.setWeather?.(k)}catch(e){}setTimeout(render,300)};$('vlaWind').onclick=()=>wx('wind');$('vlaStorm').onclick=()=>wx('storm');$('vlaClr').onclick=()=>wx('clear');$('vlaReset').onclick=()=>{T.rack=6;T.loose=2;render()}}
 p.style.display='block';render();return p}
export function close(){const p=$('vlaP');if(p)p.style.display='none'}
const toggle=()=>{const p=$('vlaP');p&&p.style.display!='none'?close():open()};
export function init(C){T.R=build(C);if(T.R)apply(T.R);window.GX=window.GX||{};
 GX.vla={demo,stopDemo,demoState:D,open,close,toggle,run,plan,parse,perceive,safety,env,setEnv:f=>{envFn=f},LIM,state:T,EXAMPLES};
 addEventListener('keydown',e=>{const t=e.target;if(t&&(/INPUT|TEXTAREA|SELECT/.test(t.tagName)||t.isContentEditable))return;if(e.key=='V'&&e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();toggle()}else if(e.key=='Escape'&&$('vlaP')?.style.display=='block'){stopDemo();close()}},true);
 mainBtn();const hud=$('hud');if(hud&&!$('vlaBtn')){const b=document.createElement('button');b.id='vlaBtn';b.textContent='Robot (VLA)';b.title='Robot (VLA) panel (Shift+V)';b.onclick=toggle;hud.appendChild(b)}
 setInterval(()=>render(),1000);if(new URLSearchParams(location.search).get('demo')=='vla'){const go=()=>document.getElementById('start')?setTimeout(go,300):open();setTimeout(go,800)}}
