// safety.js v5.12.0: Safety World (game mode). Corrective action missions + hazard hunts on a 3D rig. SIM scenarios only.
// Scenario data comes from safety_adapter.js (SIM today, ORG per organisation later). Every card shows its source tag.
// Phone, desktop, keyboard (arrows/Tab, Enter, Esc), gamepad (d-pad, A select, B back), touch/click.
import * as THREE from 'three';
import * as AD from './safety_adapter.js?v=s1';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LB='dw_safety_lb',CR='dw_safety_crew',CAK='dw_safety_ca';
const AREA={pumps:[-9,1,4],cellar:[0,.5,0],derrick:[0,14,0],floor:[2,4.5,2],shakers:[-8,1.5,-5],catwalk:[9,1,0],crane:[6,7,-8]};
const CTRL={guard:'Install guard',barrier:'Put barrier',permit:'Get permit',ppe:'Supply PPE'};
const S={el:null,r:null,scene:null,cam:null,raf:0,marks:[],tenant:null,data:null,mode:'menu',ca:null,hunt:null,pad:{prev:{},t:0},ang:.6};
const CSS=`#safetyW{position:fixed;inset:0;z-index:100002;background:#06101c;color:#eaf6ff;font:15px system-ui,-apple-system,Segoe UI,sans-serif}
#safetyW canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#safetyW .pn{position:absolute;left:8px;top:calc(8px + env(safe-area-inset-top));width:min(380px,calc(100vw - 16px));max-height:calc(100vh - 24px);overflow:auto;background:rgba(8,22,40,.92);border:1px solid #2d5a85;border-radius:14px;padding:10px 12px;box-sizing:border-box}
@media (max-width:600px){#safetyW .pn{top:auto;bottom:calc(8px + env(safe-area-inset-bottom));max-height:52vh}}
#safetyW h2{margin:0 0 6px;font-size:18px}#safetyW h3{margin:8px 0 4px;font-size:15px}
#safetyW button{min-height:44px;margin:3px 0;width:100%;text-align:left;border-radius:10px;border:2px solid #3a6a9a;background:#0f2a48;color:#eaf6ff;font:inherit;padding:6px 10px;cursor:pointer}
#safetyW button.on{border-color:#7fe3ff;box-shadow:0 0 0 2px #7fe3ff}#safetyW button:disabled{opacity:.45}
#safetyW .tag{display:inline-block;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:800;letter-spacing:.08em;margin-right:6px;vertical-align:middle}
#safetyW .tag.SIM{background:#8a8f98;color:#fff}#safetyW .tag.ORG{background:#1f7a4a;color:#fff}
#safetyW .st{font-size:12px;opacity:.8}#safetyW .od{color:#ff8a8a}#safetyW .ok{color:#8fe3a0}
#safetyW .top{position:absolute;right:8px;top:calc(8px + env(safe-area-inset-top));display:flex;gap:6px;align-items:center}
#safetyW .top button{width:auto;min-width:44px}#safetyW .score{background:rgba(8,22,40,.92);border:1px solid #2d5a85;border-radius:10px;padding:6px 10px;font-weight:700}`;
const score=()=>{const L=S.data?.missions||[];if(!L.length)return 100;const st=caState();return Math.round(100*L.reduce((a,m)=>a+(st[m.id]?.closed?1:m.due<0?0:.5),0)/L.length)};
function caState(){try{return JSON.parse(localStorage.getItem(CAK)||'{}')}catch(e){return {}}}
function setCa(id,v){const s=caState();s[id]={...(s[id]||{}),...v};try{localStorage.setItem(CAK,JSON.stringify(s))}catch(e){}}
function lb(){try{return JSON.parse(localStorage.getItem(LB)||'[]')}catch(e){return []}}
function crew(){return localStorage.getItem(CR)||'Crew A'}
function scene3d(cv){const r=new THREE.WebGLRenderer({canvas:cv,antialias:true});r.setPixelRatio(Math.min(2,devicePixelRatio||1));
 const sc=new THREE.Scene();sc.background=new THREE.Color(0x0b1a2c);const cam=new THREE.PerspectiveCamera(50,1,.1,500);
 sc.add(new THREE.HemisphereLight(0xcfe8ff,0x223322,1.1));const d=new THREE.DirectionalLight(0xffffff,1.2);d.position.set(10,20,8);sc.add(d);
 const box=(w,h,dp,x,y,z,c)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,dp),new THREE.MeshStandardMaterial({color:c,roughness:.8}));m.position.set(x,y,z);sc.add(m);return m};
 box(40,.2,30,0,-.1,0,0x3a4a3a);box(10,4,10,0,2,0,0x55606c);box(1.6,.2,1.6,0,4.1,0,0x222222);
 for(const [x,z] of [[-2,-2],[2,-2],[-2,2],[2,2]]){const l=box(.3,24,.3,x*.8,16,z*.8,0xd8b04a);l.rotation.set(z*.04,0,-x*.04)}
 box(5,2,2.4,-9,1,4,0x2f6db5);box(5,2,2.4,-9,1,7.5,0x2f6db5);box(4,1.6,3,-8,.8,-5,0x6a6a6a);box(12,.8,1.5,9,.4,0,0x8a7a5a);
 const cr=box(.6,10,.6,6,5,-8,0xe0a020);box(8,.4,.4,9,10,-8,0xe0a020);
 r.setAnimationLoop(null);return {r,sc,cam}}
function fit(){if(!S.r)return;const w=innerWidth,h=innerHeight;S.r.setSize(w,h,false);S.cam.aspect=w/h;S.cam.updateProjectionMatrix()}
function clearMarks(){for(const m of S.marks)S.scene.remove(m);S.marks=[]}
function mark(pos,color,data){const m=new THREE.Mesh(new THREE.SphereGeometry(.9,18,12),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.6}));m.position.set(...pos);m.userData=data;S.scene.add(m);S.marks.push(m);return m}
function loop(t){if(!S.el)return;S.ang+=.0016;const R=S.cam.aspect<1?62:34;S.cam.position.set(Math.sin(S.ang)*R,16,Math.cos(S.ang)*R);S.cam.lookAt(0,6,0);
 for(const m of S.marks){m.scale.setScalar(1+.15*Math.sin(t/250))}S.r.render(S.scene,S.cam);if(S.hunt)tick();S.raf=requestAnimationFrame(loop)}
function pick(ev){const rc=new THREE.Raycaster(),p=new THREE.Vector2((ev.clientX/innerWidth)*2-1,-(ev.clientY/innerHeight)*2+1);rc.setFromCamera(p,S.cam);const h=rc.intersectObjects(S.marks)[0];if(h)act(h.object.userData)}
function act(d){if(!d)return;if(d.k=='ca')return openCa(d.id);if(d.k=='spot')return spot(d.i)}
function caMarks(){clearMarks();const st=caState();for(const m of S.data.missions){const s=st[m.id]||{};mark(AREA[m.area]||[0,2,0],s.closed?0x2fbf5a:m.due<0?0xe03030:0xe0a020,{k:'ca',id:m.id})}}
function tag(s){return `<span class="tag ${s.source}" data-src="${s.source}">${s.source}</span>`}
function btn(go,html,dis){return `<button data-go="${esc(go)}"${dis?' disabled':''}>${html}</button>`}
function render(){const P=S.el.querySelector('.pn'),st=caState();S.el.querySelector('#swScore').textContent='Site safety score '+score();
 if(S.mode=='menu'){caMarks();P.innerHTML=`<h2>Safety World <span class="tag SIM">SIM</span></h2><div class=st>All scenarios are simulated. Do not use them as real site records.</div>
  <h3>Corrective action missions</h3>`+S.data.missions.map(m=>{const s=st[m.id]||{};return btn('ca:'+m.id,tag(m)+esc(m.title)+`<div class="st ${s.closed?'ok':m.due<0?'od':''}">${s.closed?'Closed':m.due<0?'Overdue '+(-m.due)+' d':'Due in '+m.due+' d'}</div>`)}).join('')+
  `<h3>Hazard hunts</h3>`+S.data.hunts.map(h=>btn('hunt:'+h.id,tag(h)+esc(h.title)+`<div class=st>${h.hazards.length} hazards · ${h.time} s</div>`)).join('')+
  `<h3>Leaderboard</h3><div id=swLb class=st>`+(lb().slice(0,5).map((e,i)=>`${i+1}. ${esc(e.crew)} · ${e.score} · ${esc(e.hunt)}`).join('<br>')||'No scores yet.')+`</div>`+btn('crew','Crew: '+esc(crew())+' (change)')+btn('exit','↩ Exit Safety World')}
 else if(S.mode=='ca'){const m=S.ca,s=st[m.id]||{},n=s.step||0;P.innerHTML=`<h2>${tag(m)}${esc(m.title)}</h2><div class=st>${esc(m.text)}</div><h3>Step ${Math.min(n+1,4)} of 4</h3>`+
  btn('inspect','1. Inspect the area'+(n>0?' ✓':''),n!=0)+`<div id=swCtl>`+Object.entries(CTRL).map(([k,v])=>btn('ctl:'+k,'2. '+v+(n>1&&k==m.control?' ✓':''),n!=1)).join('')+`</div>`+
  btn('verify','3. Verify the control'+(n>2?' ✓':''),n!=2)+btn('close','4. Close the action'+(s.closed?' ✓':''),n!=3)+`<div id=swMsg class=st>${esc(S.msg||'')}</div>`+btn('back','↩ Back')}
 else if(S.mode=='hunt'){const H=S.hunt;P.innerHTML=`<h2>${tag(H.def)}${esc(H.def.title)}</h2><div class=st>Find all hazards. Select a spot on the rig or in the list. A wrong spot costs 5 points.</div>
  <h3 id=swTime>Time ${Math.max(0,Math.ceil(H.left))} s · Found ${H.found.size}/${H.def.hazards.length} · Points ${H.pts}</h3>`+
  H.spots.map((p,i)=>btn('spot:'+i,(H.found.has(i)?'✓ '+esc(p.h.name):'Spot '+(i+1)+' · '+esc(p.area)),H.found.has(i)||H.miss.has(i))).join('')+`<div id=swMsg class=st>${esc(S.msg||'')}</div>`+btn('back','↩ Stop hunt')}
 else if(S.mode=='done'){const H=S.hunt0;P.innerHTML=`<h2>${tag(H.def)}Hunt result</h2><h3 id=swResult>Points ${H.pts} · Found ${H.found.size}/${H.def.hazards.length}</h3><div class=st>Crew ${esc(crew())}. Your score is on the leaderboard.</div>`+btn('back','↩ Back')}
 const B=[...P.querySelectorAll('button')];B.forEach(b=>b.onclick=e=>{e.preventDefault();go(b.dataset.go)});S.btns=B;S.fi=Math.max(0,B.findIndex(b=>!b.disabled));foc(S.fi)}
function foc(i){const B=(S.btns||[]).filter(b=>!b.disabled);if(!B.length)return;i=(i+B.length)%B.length;S.fi=i;S.btns.forEach(b=>b.classList.remove('on'));B[i].classList.add('on');B[i].focus({preventScroll:true})}
function openCa(id){S.ca=S.data.missions.find(m=>m.id==id);if(!S.ca)return;S.msg='';S.mode='ca';clearMarks();const m=mark(AREA[S.ca.area]||[0,2,0],caState()[id]?.closed?0x2fbf5a:S.ca.due<0?0xe03030:0xe0a020,{k:'ca',id});render()}
function go(g){if(!g)return;const m=S.ca,st=m?caState()[m.id]||{}:{};
 if(g=='exit')return close();if(g=='back'){S.hunt=null;S.mode='menu';S.msg='';return render()}
 if(g=='crew'){const c=prompt('Crew name',crew());if(c){localStorage.setItem(CR,c.slice(0,24))}return render()}
 if(g.startsWith('ca:'))return openCa(g.slice(3));if(g.startsWith('hunt:'))return startHunt(g.slice(5));if(g.startsWith('spot:'))return spot(+g.slice(5));
 if(g=='inspect'){setCa(m.id,{step:1});S.msg='Area inspected. Select the correct control.'}
 else if(g.startsWith('ctl:')){if(g.slice(4)==m.control){setCa(m.id,{step:2});S.msg='Control applied.'}else S.msg='That control does not remove this hazard. Try again.'}
 else if(g=='verify'){setCa(m.id,{step:3});S.msg='Control verified.'}
 else if(g=='close'){setCa(m.id,{step:4,closed:true});S.msg='Action closed. Site safety score is now '+score()+'.'}
 render()}
function startHunt(id){const def=S.data.hunts.find(h=>h.id==id);if(!def)return;const hz=def.hazards.map(k=>AD.HAZARDS.find(h=>h.id==k)).filter(Boolean);
 const decoy=Object.keys(AREA).filter(a=>!hz.some(h=>h.area==a)).slice(0,def.difficulty=='easy'?1:def.difficulty=='medium'?2:3);
 const spots=[...hz.map(h=>({h,area:h.area})),...decoy.map(a=>({h:null,area:a}))].sort((a,b)=>a.area.localeCompare(b.area));
 S.hunt={def,spots,found:new Set(),miss:new Set(),pts:0,left:def.time,t0:performance.now()};S.mode='hunt';S.msg='';clearMarks();
 spots.forEach((p,i)=>{const a=AREA[p.area];mark([a[0]+(i%2?1.5:-1.5),a[1]+1,a[2]],0xe0a020,{k:'spot',i})});render()}
function spot(i){const H=S.hunt;if(!H||H.found.has(i)||H.miss.has(i))return;const p=H.spots[i];if(p.h){H.found.add(i);H.pts+=10+Math.round(H.left/10);S.msg='Found: '+p.h.name+'. '+p.h.text;S.marks[i]?.material.color.set(0x2fbf5a)}else{H.miss.add(i);H.pts-=5;S.msg='No hazard at this spot.';S.marks[i]?.material.color.set(0x667788)}
 if(H.found.size==H.def.hazards.length)return endHunt();render()}
function tick(){const H=S.hunt;H.left=H.def.time-(performance.now()-H.t0)/1000;const e=$('swTime');if(e)e.textContent=`Time ${Math.max(0,Math.ceil(H.left))} s · Found ${H.found.size}/${H.def.hazards.length} · Points ${H.pts}`;if(H.left<=0)endHunt()}
function endHunt(){const H=S.hunt;S.hunt=null;S.hunt0=H;const L=lb();L.push({crew:crew(),score:H.pts,hunt:H.def.title,source:H.def.source,t:Date.now()});L.sort((a,b)=>b.score-a.score);try{localStorage.setItem(LB,JSON.stringify(L.slice(0,20)))}catch(e){}S.mode='done';render()}
function key(e){if(!S.el)return;const k=e.key;if(k=='Escape'){S.mode=='menu'?close():go('back')}else if(k=='ArrowDown'||k=='ArrowRight')foc(S.fi+1);else if(k=='ArrowUp'||k=='ArrowLeft')foc(S.fi-1);else if(k=='Enter'||k==' '){(S.btns||[]).filter(b=>!b.disabled)[S.fi]?.click()}else return;e.preventDefault();e.stopPropagation()}
function pad(){if(!S.el)return;for(const g of navigator.getGamepads?.()||[]){if(!g)continue;const b=i=>!!g.buttons[i]?.pressed,ax=g.axes||[];const s={u:b(12)||ax[1]<-.5,d:b(13)||ax[1]>.5,a:b(0),b:b(1)};const P=S.pad.prev[g.index]||{};
 if(s.d&&!P.d)foc(S.fi+1);if(s.u&&!P.u)foc(S.fi-1);if(s.a&&!P.a)(S.btns||[]).filter(x=>!x.disabled)[S.fi]?.click();if(s.b&&!P.b)key({key:'Escape',preventDefault(){},stopPropagation(){}});S.pad.prev[g.index]=s}}
export async function open(ctx={tenantId:null}){if(S.el)return api();if(!$('swCss')){const st=document.createElement('style');st.id='swCss';st.textContent=CSS;document.head.appendChild(st)}
 S.tenant=ctx.tenantId||null;S.data=await AD.getScenarios({tenantId:S.tenant});const e=document.createElement('section');e.id='safetyW';e.setAttribute('role','dialog');e.setAttribute('aria-label','Safety World');
 e.innerHTML=`<canvas></canvas><div class=top><span id=swScore class=score></span><button id=swX aria-label="Close Safety World">✕</button></div><div class=pn></div>`;document.body.appendChild(e);S.el=e;
 const g=scene3d(e.querySelector('canvas'));S.r=g.r;S.scene=g.sc;S.cam=g.cam;fit();addEventListener('resize',fit);e.querySelector('canvas').addEventListener('pointerup',pick);$('swX').onclick=()=>close();
 addEventListener('keydown',key,true);S.padT=setInterval(pad,50);S.mode='menu';render();S.raf=requestAnimationFrame(loop);return api()}
export function close(){if(!S.el)return;cancelAnimationFrame(S.raf);clearInterval(S.padT);removeEventListener('keydown',key,true);removeEventListener('resize',fit);try{S.r.dispose()}catch(e){}S.el.remove();S.el=null;S.hunt=null;S.marks=[];try{dispatchEvent(new CustomEvent('dw:safety-closed'))}catch(e){}}
export function isOpen(){return !!S.el}
const API={open,close,isOpen,S,adapter:AD,score,go,spot};function api(){window.GX=window.GX||{};window.GX.safety=API;return API}api();
