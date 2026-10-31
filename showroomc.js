// showroomc.js (feat/showroom-c): Showroom C — detailed hero showcase of ONE land rig (model pack pass 2).
// Model + node->BOM map from assets/rigsc/<pack>/manifest.json (pack: ?srcpack= | localStorage dw_src_pack | CFG.pack). Drop a new pack with the same schema to swap.
// Orbit/zoom, preset close-ups, explode/inspect, night lights, A/B/C drill-down + BOM from the manifest, floating card.
// HONESTY: generic SIM rig, not a specific real rig. Labelled SIM. No network writes.
// Hooks (guarded): GX.showroomAB.register('C',...) from srpick.js (feat/showroom-b); srperf.js attach({id:'C',el,lod,ready,match}) on open / detach('C') on close (feat/showroom-b, key P).
import * as THREE from 'three';
export const VER='c1';
export const CFG={pack:'pass2'};
const $=id=>document.getElementById(id),es=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const phone=()=>Math.min(innerWidth,innerHeight)<600||matchMedia('(pointer:coarse)').matches&&innerWidth<900;
const q=()=>{try{return new URLSearchParams(location.search)}catch(e){return new URLSearchParams()}};
const pack=()=>q().get('srcpack')||(()=>{try{return localStorage.getItem('dw_src_pack')}catch(e){return null}})()||CFG.pack;
export const ST={open:false,lod:null,night:false,exp:0,expT:0,sel:null,card:true,bom:false,anim:null,t0:0,frames:0,fpsT:0,fps:0,loadMs:0,mb:0,preset:'overview'};
const NAMES={substructure:'Substructure',drill_floor:'Drill floor',handrails:'Handrails',stairs:'Stairs',rotary_table:'Rotary table',derrick:'Mast',setback_pipe:'Setback pipe',crown_block:'Crown block',travelling_block:'Travelling block',hook:'Hook',drill_line:'Drill line',deadline_anchor:'Deadline anchor',top_drive:'Top drive',drill_string:'Drill string',service_loop:'Service loop',drawworks:'Drawworks',iron_roughneck:'Iron roughneck',bop_stack:'BOP stack',mud_tanks:'Mud tanks',mud_pump_1:'Mud pump 1',mud_pump_2:'Mud pump 2',mud_pump_3:'Mud pump 3',shale_shakers:'Shale shakers',degasser:'Degasser',mud_pipework:'Mud pipework',standpipe_manifold:'Standpipe manifold',doghouse:'Driller cabin',vdoor:'V-door',catwalk:'Catwalk',pipe_rack:'Pipe rack',generators:'Generators',vfd_house:'VFD house',fuel_tank:'Fuel tank',cable_trays:'Cable trays',safety_equipment:'Safety equipment',ibop:'IBOP',hmi:'HMI'};
export const nice=p=>{const s=String(p).split('/').pop();return NAMES[s]||s.replace(/^light_/,'Light ').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase())};
export const PRESETS=[['overview','Overview',['*']],['top_drive','Top drive',['top_drive']],['bop','BOP',['bop_stack']],['pumps','Pumps',['mud_pump_1','mud_pump_2','mud_pump_3']],['cabin','Cabin',['doghouse']]];
export async function manifest(){if(ST.man)return ST.man;ST.base=new URL(`./assets/rigsc/${pack()}/`,import.meta.url).href;const r=await fetch(ST.base+'manifest.json?v='+VER);if(!r.ok)throw new Error('manifest '+r.status);ST.man=await r.json();ST.rig=ST.man.rigs[0];return ST.man}
let LDp=null;function loader(){return LDp||(LDp=(async()=>{const [{GLTFLoader},{DRACOLoader}]=await Promise.all([import('./vendor/loaders/GLTFLoader.js'),import('./vendor/loaders/DRACOLoader.js')]);
 const d=new DRACOLoader();d.setDecoderPath(new URL('./vendor/libs/draco/',import.meta.url).href);d.setDecoderConfig({type:'wasm'});const l=new GLTFLoader();l.setDRACOLoader(d);return l})())}
export function pickLod(){const o=(q().get('srclod')||'').toUpperCase();if(/^[HML]$/.test(o))return o;return phone()?(devicePixelRatio>2.5||innerWidth<400?'L':'M'):'H'}
// tree of component paths from manifest nodeToBom (per LOD).
export function tree(lod){const nb=ST.rig.lods[lod]?.nodeToBom||ST.rig.nodeToBom,T={};for(const p of Object.keys(nb)){const parts=p.split('/');T[p]={path:p,bom:nb[p],level:'ABC'[Math.min(parts.length,3)-1],parent:parts.length>1?parts.slice(0,-1).join('/'):null,kids:[]}}
 for(const n of Object.values(T))if(n.parent&&T[n.parent])T[n.parent].kids.push(n.path);return T}
function css(){if($('srcCss'))return;const s=document.createElement('style');s.id='srcCss';s.textContent=`
#showroomC{position:fixed;inset:0;z-index:60;background:#0c0f13;color:#dde3ea;font:13px system-ui,sans-serif;touch-action:none;user-select:none}
#showroomC canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#showroomC button{font:inherit;color:#e4e9ef;background:rgba(18,22,28,.86);border:1px solid #3a4450;border-radius:6px;min-height:36px;padding:4px 10px;cursor:pointer}
#showroomC button.on{border-color:#c9a46a;color:#f3e3c6;background:rgba(40,32,20,.9)}#showroomC button:focus-visible{outline:2px solid #c9a46a}
#srcTop{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:8px;padding:8px 10px;background:linear-gradient(rgba(6,8,11,.85),rgba(6,8,11,0))}
#srcTop h2{margin:0;font-size:15px;font-weight:600;letter-spacing:.02em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#srcTop .sim{font-size:11px;border:1px solid #6b7684;border-radius:4px;padding:1px 5px;margin-left:6px;color:#aab4c0}
#srcBar{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:96vw}
#srcCard{position:absolute;width:290px;max-height:46vh;overflow:auto;background:rgba(12,15,19,.93);border:1px solid #3a4450;border-left:3px solid #c9a46a;border-radius:6px;padding:8px 10px;box-shadow:0 6px 24px #0008}
#srcCard h3{margin:0 80px 2px 0;font-size:14px;font-weight:600}#srcCard .x,#srcCard .tg{position:absolute;top:4px;min-width:34px!important;min-height:34px!important;padding:0!important}#srcCard .x{right:4px}#srcCard .tg{right:42px}
#srcCard .cr{font-size:12px;margin:2px 0 6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center}#srcCard .cr button{min-height:28px;padding:1px 7px;font-size:12px}
#srcCard .lv{display:inline-block;border:1px solid #c9a46a;color:#e8d3ad;border-radius:4px;font-size:11px;padding:0 4px;margin-right:4px}#srcCard .bom{font:11px ui-monospace,monospace;color:#9aa6b3;word-break:break-all}
#srcCard ul{list-style:none;margin:4px 0 0;padding:0}#srcCard li button{width:100%;text-align:left;margin:2px 0;min-height:32px;font-size:13px}
#srcCard.min ul,#srcCard.min .cr{display:none}
#srcBom{position:absolute;top:52px;right:10px;bottom:62px;width:330px;overflow:auto;background:rgba(12,15,19,.94);border:1px solid #3a4450;border-radius:6px;padding:6px 8px}
#srcBom table{width:100%;border-collapse:collapse;font-size:12px}#srcBom td{padding:3px 4px;border-bottom:1px solid #222a33;cursor:pointer}#srcBom td.b{font:11px ui-monospace,monospace;color:#9aa6b3}#srcBom tr.on td{background:#2a2316}
#srcMsg{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);font-size:14px;color:#aab4c0}
@media (max-width:600px){#srcCard{left:6px!important;right:6px;width:auto;top:auto!important;bottom:104px;max-height:32vh}#srcBom{left:6px;right:6px;width:auto;top:auto;bottom:104px;height:36vh}#srcBar button{min-height:40px;padding:4px 8px}#srcTop h2{font-size:13px}}`;document.head.appendChild(s)}
function ui(){const el=ST.el=document.createElement('section');el.id='showroomC';el.setAttribute('role','dialog');el.setAttribute('aria-label','Showroom C');
 el.innerHTML=`<canvas></canvas><div id=srcTop><h2 id=srcName>Showroom C</h2><button id=srcBomB aria-pressed=false title="Parts list (B)">BOM</button><button id=srcNight aria-pressed=false title="Night (N)">Night</button><button id=srcX aria-label="Close showroom (Esc)">✕</button></div>
 <div id=srcMsg>Loading model…</div><div id=srcBar>${PRESETS.map(([k,t],i)=>`<button data-pre=${k} title="${t} (${i+1})">${t}</button>`).join('')}<button id=srcExp aria-pressed=false title="Explode (X)">Explode</button></div><div id=srcCard hidden></div><div id=srcBom hidden></div>`;
 document.body.appendChild(el);el.querySelectorAll('[data-pre]').forEach(b=>b.onclick=()=>preset(b.dataset.pre));$('srcExp').onclick=()=>explode();$('srcNight').onclick=()=>night();$('srcX').onclick=()=>close();$('srcBomB').onclick=()=>bom()}
async function setupGL(){const cv=ST.el.querySelector('canvas'),P=phone(),ren=ST.ren=new THREE.WebGLRenderer({canvas:cv,antialias:!P,powerPreference:'high-performance'});
 ren.setPixelRatio(Math.min(devicePixelRatio,P?1.25:1.5));ren.setSize(innerWidth,innerHeight,false);ren.outputColorSpace=THREE.SRGBColorSpace;ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=1;
 const sc=ST.scene=new THREE.Scene();ST.cam=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,2000);ST.cam.position.set(70,45,80);
 ST.sky=skyMesh();sc.add(ST.sky);ST.hemi=new THREE.HemisphereLight(0xdfe6ee,0x3a3226,.7);sc.add(ST.hemi);ST.sun=new THREE.DirectionalLight(0xfff2e0,2.2);ST.sun.position.set(60,90,40);sc.add(ST.sun);
 const g=new THREE.Mesh(new THREE.CircleGeometry(220,P?32:64),new THREE.MeshStandardMaterial({color:0x6b6152,roughness:.95,metalness:0}));g.rotation.x=-Math.PI/2;g.position.y=-.08;sc.add(g);ST.ground=g;
 try{const {RoomEnvironment}=await import('./vendor/environments/RoomEnvironment.js');const pm=new THREE.PMREMGenerator(ren);ST.env=pm.fromScene(new RoomEnvironment(),.04).texture;sc.environment=ST.env;sc.environmentIntensity=.6;pm.dispose()}catch(e){}
 const {OrbitControls}=await import('./vendor/OrbitControls.js');const c=ST.ctl=new OrbitControls(ST.cam,cv);c.enableDamping=true;c.dampingFactor=.18;c.minDistance=2;c.maxDistance=220;c.maxPolarAngle=Math.PI*.495;c.target.set(0,20,0);c.addEventListener('start',()=>{ST.anim=null})}
// sky dome: day = soft overcast gradient; night = deep blue-black with faint stars near zenith (no cartoon colours).
function skyMesh(){const m=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{n:{value:0}},vertexShader:'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform float n;varying vec3 v;float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}void main(){float y=max(v.y,0.);vec3 d=mix(vec3(.80,.83,.86),vec3(.42,.55,.70),pow(y,.6));vec3 nt=mix(vec3(.035,.04,.05),vec3(.006,.009,.018),pow(y,.5));vec3 c=mix(d,nt,n);float s=step(.9985,h(floor(v*420.)))*smoothstep(.05,.4,y)*n;gl_FragColor=vec4(c+s*.55,1.);}'});
 return new THREE.Mesh(new THREE.SphereGeometry(900,32,16),m)}
async function loadRig(){const t0=performance.now(),lod=ST.lod=pickLod(),r=ST.rig,url=new URL(r.lods[lod].file,ST.base).href+'?v='+VER;const l=await loader();const gl=await l.loadAsync(url);
 ST.loadMs=Math.round(performance.now()-t0);ST.mb=+(r.lods[lod].bytes/1048576).toFixed(2);const root=ST.root=gl.scene;ST.scene.add(root);ST.nodes={};ST.meshes=[];ST.lights=[];ST.screens=[];
 root.traverse(o=>{const p=o.userData?.componentPath;if(p&&!ST.nodes[p])ST.nodes[p]=o;if(o.isMesh){ST.meshes.push(o);const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(/^light/i.test(m.name)){ST.lights.push(m);m.userData.e0=m.emissiveIntensity}if(/^screen/i.test(m.name))ST.screens.push(m)}}});
 // component path of any mesh: nearest ancestor with componentPath.
 for(const m of ST.meshes){let o=m;while(o&&!o.userData?.componentPath)o=o.parent;m.userData.path=o?.userData.componentPath||null}
 ST.T=tree(lod);ST.top=Object.keys(ST.nodes).filter(p=>!p.includes('/'));ST.home={};for(const p of ST.top)ST.home[p]=ST.nodes[p].position.clone();
 const bb=new THREE.Box3().setFromObject(root);ST.bb=bb;ST.ctr=bb.getCenter(new THREE.Vector3());
 // night lamp points at light_* nodes (few on phones).
 const lampN=Object.keys(ST.nodes).filter(p=>/light_/.test(p.split('/').pop())),max=phone()?3:8;ST.lamps=[];for(const p of lampN.slice(0,max)){const L=new THREE.PointLight(0xffe2b8,0,38,1.6);ST.nodes[p].getWorldPosition(L.position);L.position.y-=.6;ST.scene.add(L);ST.lamps.push(L)}
 $('srcMsg').hidden=true;$('srcName').innerHTML=es(r.name.replace(/\s+—.*$/,''))+'<span class=sim>SIM</span>';preset('overview',true)}
function boxOf(paths){const b=new THREE.Box3();for(const p of paths){if(p=='*'){b.copy(ST.bb);continue}const n=ST.nodes[p];if(n)b.expandByObject(n)}return b}
export function preset(k,instant){const P=PRESETS.find(x=>x[0]==k)||PRESETS[0];ST.preset=P[0];document.querySelectorAll('#srcBar [data-pre]').forEach(b=>{const on=b.dataset.pre==P[0];b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 const b=boxOf(P[2]),c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3()),r=Math.max(s.x,s.y,s.z)*.5,f=ST.cam.fov*Math.PI/360,dist=r/Math.sin(f)*(phone()?1.25:.95);let pos;
 if(k=='cabin'){const con=ST.nodes['doghouse/driller_console']||ST.nodes.doghouse,cb=new THREE.Box3().setFromObject(con),cc=cb.getCenter(new THREE.Vector3()),dir=cc.clone().sub(c).setY(0);if(dir.lengthSq()<1e-4)dir.set(1,0,0);dir.normalize();pos=cc.clone().addScaledVector(dir,-Math.max(1.4,s.x*.35)).add(new THREE.Vector3(0,.6,0));c.copy(cc);ST.ctl.minDistance=.3}
 else{ST.ctl.minDistance=2;const dir=new THREE.Vector3(1,.45,1.1).normalize();if(k=='overview')dir.set(1,.38,1.3).normalize();pos=c.clone().addScaledVector(dir,dist)}
 if(k!='overview'&&k!='cabin'&&ST.sel?.split('/')[0]!=P[2][0])select(P[2][0]);if(k=='cabin')select('doghouse/driller_console');
 ST.anim={p0:ST.cam.position.clone(),p1:pos,t0:ST.ctl.target.clone(),t1:c,s:performance.now(),d:instant?1:1100};return k}
export function explode(v){ST.expT=v==null?(ST.expT?0:1):(v?1:0);const b=$('srcExp');if(b){b.classList.toggle('on',!!ST.expT);b.setAttribute('aria-pressed',!!ST.expT)}return ST.expT}
function applyExplode(dt){ST.exp+=(ST.expT-ST.exp)*Math.min(1,dt*4);if(Math.abs(ST.exp-ST.expT)<1e-3)ST.exp=ST.expT;for(const p of ST.top){const n=ST.nodes[p],h=ST.home[p],b=ST.cb?.[p];if(!b)continue;const d=b.clone().sub(ST.ctr);d.y=Math.max(0,d.y)*.35;if(d.lengthSq()<1)d.set(0,1,0);d.normalize();n.position.copy(h).addScaledVector(d,ST.exp*9)}}
export function night(v){ST.night=v==null?!ST.night:!!v;const N=ST.night;ST.sky.material.uniforms.n.value=N?1:0;ST.hemi.intensity=N?.05:.7;ST.sun.intensity=N?.06:2.2;ST.sun.color.set(N?0x9fb3d6:0xfff2e0);if(ST.scene)ST.scene.environmentIntensity=N?.08:.6;ST.ren.toneMappingExposure=N?1.25:1;
 for(const m of ST.lights){m.emissive?.set(0xffe2b8);m.emissiveIntensity=N?6:.4}for(const m of ST.screens)m.emissiveIntensity=N?2.2:1.2;for(const L of ST.lamps)L.intensity=N?(phone()?90:60):0;ST.ground.material.color.set(N?0x3a362f:0x6b6152);
 ST.el.classList.toggle('night',N);const b=$('srcNight');if(b){b.classList.toggle('on',N);b.setAttribute('aria-pressed',N)}return N}
export function bom(v){ST.bom=v==null?!ST.bom:!!v;const el=$('srcBom'),b=$('srcBomB');b.classList.toggle('on',ST.bom);b.setAttribute('aria-pressed',ST.bom);el.hidden=!ST.bom;if(ST.bom){const rows=Object.values(ST.T);
 el.innerHTML=`<b>Parts list (BOM)</b> <span class=sim style="font-size:11px;color:#aab4c0">SIM · ${rows.length} items</span><table>${rows.map(n=>`<tr data-p="${es(n.path)}"${n.path==ST.sel?' class=on':''}><td style="padding-left:${(n.path.split('/').length-1)*12+4}px"><span class=lv>${n.level}</span>${es(nice(n.path))}</td><td class=b>${es(n.bom)}</td></tr>`).join('')}</table>`;
 el.querySelectorAll('tr[data-p]').forEach(t=>t.onclick=()=>select(t.dataset.p,true))}if(ST.bom&&phone())card(false);return ST.bom}
// highlight: tint selected component meshes via emissive on cloned materials.
function hi(path){for(const m of ST.meshes){const on=path&&m.userData.path&&(m.userData.path==path||m.userData.path.startsWith(path+'/'));if(on&&!m.userData.m0){m.userData.m0=m.material;m.material=(Array.isArray(m.material)?m.material.map(x=>x.clone()):m.material.clone());(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{if(x.emissive&&!/^light|^screen/i.test(x.name)){x.emissive.set(0x5a4520);x.emissiveIntensity=.6}})}
 else if(!on&&m.userData.m0){const c=m.material;m.material=m.userData.m0;delete m.userData.m0;(Array.isArray(c)?c:[c]).forEach(x=>x.dispose())}}}
export function select(path,focus){if(path&&!ST.T[path])return null;ST.sel=path||null;hi(ST.sel);if(ST.bom)bom(true);if(path){ST.cardOpen=true;card(true)}else card(false);
 if(focus&&path){const b=new THREE.Box3().setFromObject(ST.nodes[path]),c=b.getCenter(new THREE.Vector3()),r=Math.max(1.5,b.getSize(new THREE.Vector3()).length()*.5),dir=ST.cam.position.clone().sub(ST.ctl.target).normalize();ST.anim={p0:ST.cam.position.clone(),p1:c.clone().addScaledVector(dir,r/Math.sin(ST.cam.fov*Math.PI/360)*1.1),t0:ST.ctl.target.clone(),t1:c,s:performance.now(),d:900}}return ST.sel}
export function card(show){const el=$('srcCard');if(!el)return;if(show===false||!ST.sel){el.hidden=true;return}const n=ST.T[ST.sel],tag=ST.nodes[ST.sel]?.userData.assetTag,crumbs=[];let p=n;while(p){crumbs.unshift(p);p=p.parent?ST.T[p.parent]:null}
 el.hidden=false;el.innerHTML=`<button class=tg title="Fold card" aria-label="Fold card">${ST.min?'▸':'▾'}</button><button class=x aria-label="Close card">✕</button><h3><span class=lv>${n.level}</span>${es(nice(n.path))} <span class=sim style="font-size:10px;color:#aab4c0">SIM</span></h3>
 <div class=bom>BOM ${es(n.bom)}${tag?' · Tag '+es(tag):''}</div><div class=cr>${crumbs.map((c,i)=>`<button data-p="${es(c.path)}">${c.level} ${es(nice(c.path))}</button>`).join('›')}</div>
 ${n.kids.length?`<ul>${n.kids.map(k=>`<li><button data-p="${es(k)}"><span class=lv>${ST.T[k].level}</span>${es(nice(k))}</button></li>`).join('')}</ul>`:'<div style="font-size:12px;color:#9aa6b3">No sub-parts in this model.</div>'}`;
 el.classList.toggle('min',!!ST.min);el.querySelector('.x').onclick=()=>select(null);el.querySelector('.tg').onclick=()=>{ST.min=!ST.min;card(true)};el.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>select(b.dataset.p,true));place()}
// float the card near the part, kept inside the view and off the part's own screen box.
function place(){const el=$('srcCard');if(!el||el.hidden||!ST.sel||phone())return;const b=new THREE.Box3().setFromObject(ST.nodes[ST.sel]),pts=[];for(let i=0;i<8;i++){const v=new THREE.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).project(ST.cam);pts.push([(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight])}
 const x1=Math.max(...pts.map(p=>p[0])),x0=Math.min(...pts.map(p=>p[0])),y0=Math.min(...pts.map(p=>p[1])),w=el.offsetWidth,h=el.offsetHeight;let x=x1+16;if(x+w>innerWidth-8)x=x0-16-w;if(x<8)x=innerWidth-w-8-(ST.bom?340:0);let y=Math.min(Math.max(56,y0),innerHeight-h-62);el.style.left=x+'px';el.style.top=y+'px'}
function pick(e){if(ST.drag>6)return;const r=ST.ren.domElement.getBoundingClientRect(),m=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),rc=new THREE.Raycaster();rc.setFromCamera(m,ST.cam);const h=rc.intersectObjects(ST.meshes,false)[0];
 if(!h){return}let p=h.object.userData.path;// first tap: top level (A); tap again inside the same assembly: go one level deeper.
 if(p){const parts=p.split('/'),cur=ST.sel?ST.sel.split('/'):[];let d=1;while(d<parts.length&&cur.slice(0,d).join('/')==parts.slice(0,d).join('/')&&cur.length>=d)d++;select(parts.slice(0,Math.min(d,parts.length)).join('/'))}}
// input
const KEYS={};function key(e){if(!ST.open)return;const k=e.key;if(k=='Escape'){e.preventDefault();e.stopImmediatePropagation();if(ST.bom)bom(false);else if(ST.sel)select(null);else close();return}
 if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;let u=1;if(/^[1-5]$/.test(k))preset(PRESETS[+k-1][0]);else if(k=='x'||k=='X')explode();else if(k=='n'||k=='N')night();else if(k=='b'||k=='B')bom();else if(k=='c'||k=='C'){if(ST.sel)select(null)}
 else if(k=='ArrowLeft')orbit(-.12,0);else if(k=='ArrowRight')orbit(.12,0);else if(k=='ArrowUp')orbit(0,-.08);else if(k=='ArrowDown')orbit(0,.08);else if(k=='+'||k=='=')zoom(.85);else if(k=='-'||k=='_')zoom(1.18);else u=0;if(u){e.preventDefault();e.stopImmediatePropagation()}}
export function orbit(a,b){ST.anim=null;const c=ST.ctl,o=ST.cam.position.clone().sub(c.target),s=new THREE.Spherical().setFromVector3(o);s.theta-=a;s.phi=Math.min(Math.PI*.495,Math.max(.05,s.phi+b));ST.cam.position.copy(c.target).add(new THREE.Vector3().setFromSpherical(s))}
export function zoom(f){ST.anim=null;const c=ST.ctl,o=ST.cam.position.clone().sub(c.target),l=Math.min(c.maxDistance,Math.max(c.minDistance,o.length()*f));ST.cam.position.copy(c.target).addScaledVector(o.normalize(),l)}
const PAD={prev:[]};function pad(){const n=performance.now(),dt=Math.min(.1,(n-(PAD.t||n))/1000)||.05;PAD.t=n;if(!ST.open)return;const p=[...(navigator.getGamepads?.()||[])].find(Boolean);if(!p)return;const ax=i=>{const v=p.axes[i]||0;return Math.abs(v)<.15?0:v},bt=i=>!!p.buttons[i]?.pressed,ed=i=>bt(i)&&!PAD.prev[i];
 if(ax(0)||ax(1))orbit(ax(0)*1.6*dt,ax(1)*1.1*dt);if(ax(3))zoom(1+ax(3)*1.4*dt);if(ed(5))cyc(1);if(ed(4))cyc(-1);if(ed(3))explode();if(ed(2))night();if(ed(6))bom();
 if(ed(0)){const T=ST.sel?ST.T[ST.sel]:null;select(T?.kids[0]||ST.top[0],true)}if(ed(15)||ed(14)){const L=ST.sel&&ST.T[ST.sel].parent?ST.T[ST.T[ST.sel].parent].kids:ST.top,i=L.indexOf(ST.sel);select(L[(i+(ed(15)?1:-1)+L.length)%L.length],true)}
 if(ed(1)){if(ST.sel){const pa=ST.T[ST.sel].parent;select(pa,!!pa)}else close()}PAD.prev=p.buttons.map(b=>b.pressed)}
function cyc(d){const i=PRESETS.findIndex(x=>x[0]==ST.preset);preset(PRESETS[(i+d+PRESETS.length)%PRESETS.length][0])}
function loop(now){if(!ST.open)return;ST.raf=requestAnimationFrame(loop);const dt=Math.min(.1,(now-(ST.last||now))/1000)||1/60;ST.last=now;
 if(ST.anim){const a=ST.anim,t=Math.min(1,(now-a.s)/a.d),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;ST.cam.position.lerpVectors(a.p0,a.p1,e);ST.ctl.target.lerpVectors(a.t0,a.t1,e);if(t>=1)ST.anim=null}
 if(ST.root){if(!ST.cb){ST.cb={};for(const p of ST.top)ST.cb[p]=new THREE.Box3().setFromObject(ST.nodes[p]).getCenter(new THREE.Vector3())}applyExplode(dt)}ST.ctl.update();ST.ren.render(ST.scene,ST.cam);if(ST.sel&&!ST.anim)place();
 ST.frames++;if(now-ST.fpsT>1000){ST.fps=Math.round(ST.frames*1000/(now-ST.fpsT));ST.frames=0;ST.fpsT=now}}
function resize(){if(!ST.ren)return;ST.cam.aspect=innerWidth/innerHeight;ST.cam.updateProjectionMatrix();ST.ren.setSize(innerWidth,innerHeight,false);place()}
export function perf(){return {name:'Showroom C',loadMs:ST.loadMs,fps:ST.fps,mb:ST.mb,lod:ST.lod,tris:ST.rig?.lods?.[ST.lod]?.triangles||0}}
export function idle(){return ST.open&&!!ST.root&&!ST.anim&&Math.abs(ST.exp-ST.expT)<1e-3}
export async function open(){if(ST.open)return;css();ST.open=true;ui();addEventListener('keydown',key,true);addEventListener('resize',resize);
 const cv=ST.el.querySelector('canvas');cv.addEventListener('pointerdown',e=>{ST.drag=0;ST.pd=[e.clientX,e.clientY]});cv.addEventListener('pointermove',e=>{if(ST.pd)ST.drag=Math.max(ST.drag,Math.hypot(e.clientX-ST.pd[0],e.clientY-ST.pd[1]))});cv.addEventListener('pointerup',e=>{if(ST.pd)pick(e);ST.pd=null});
 try{await manifest();await setupGL();ST.last=0;ST.fpsT=performance.now();PAD.t=0;PAD.prev=[...(navigator.getGamepads?.()||[])].find(Boolean)?.buttons.map(b=>b.pressed)||[];ST.pi=setInterval(pad,50);ST.raf=requestAnimationFrame(loop);ST.loadMs=0;/* srperf hook */import('./srperf.js?v=p1').then(m=>ST.open&&m.attach({id:'C',el:ST.el,at:performance.now(),lod:()=>ST.lod||'–',ready:()=>!!ST.loadMs,match:/assets\/rigsc\//})).catch(()=>{});await loadRig();night(false)}catch(e){console.error('showroomc',e);const m=$('srcMsg');if(m){m.hidden=false;m.textContent='Model did not load. Close and try again.'}}}
export function close(){if(!ST.open)return;ST.open=false;import('./srperf.js?v=p1').then(m=>m.detach('C')).catch(()=>{});cancelAnimationFrame(ST.raf);clearInterval(ST.pi);removeEventListener('keydown',key,true);removeEventListener('resize',resize);try{ST.ctl?.dispose();ST.ren?.dispose();ST.ren?.forceContextLoss?.()}catch(e){}
 ST.el?.remove();Object.assign(ST,{el:null,ren:null,root:null,nodes:null,meshes:null,cb:null,sel:null,anim:null,exp:0,expT:0,bom:false,night:false,last:0,lamps:[]});try{window.GX?.srperf?.unregister?.('C')}catch(e){}}
const API={open,close,preset,explode,night,bom,select,orbit,zoom,perf,idle,tree,nice,ST,PRESETS,VER};
function reg(){window.GX=window.GX||{};window.GX.showroomC=API;try{window.GX.showroomAB?.register?.('C',{label:'C · Detail',aria:'Showroom C, detailed rig',open:()=>open(),close})}catch(e){}}
if(typeof window!='undefined'){reg();let n=0;const t=setInterval(()=>{if(window.GX?.showroomC!==API)window.GX=Object.assign(window.GX||{},{showroomC:API});if(window.GX?.showroomAB?.register&&!API._reg){API._reg=1;reg()}if(++n>120)clearInterval(t)},500)}
