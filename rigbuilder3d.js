// rigbuilder3d.js (feat/rig-builder): live 3D assembly for the Rig Builder from the real part meshes.
// Parts are cut from the pass-1 (Showroom B) and pass-2 (Showroom C) GLBs by manifest node name, and from the Blender A rig
// (assets/rigs/triple_*.glb) by top node name (the A files have no userData.part tags; their node names match the A BOM ids).
// Each part is pivoted to base centre and snapped to the anchor table in rigbuilder_core.js (layout). Metres, scale 1.
// Pumps and generators: one unit mesh (mud_pump_N / generator_N child) is repeated in a row. Where a pack has only a bank mesh,
// the bank is repeated and the part is listed in UNIT_MISSING. All data SIM.
import * as THREE from 'three';import * as C from './rigbuilder_core.js?v=rb2';
export const VER='rb2';
const UNIT={pumps:/^mud_pump_\d+$/,power:/^generator_\d+$/};
const COMP={substructure:['drill_floor','rotary_table']};
const ALOD={H:'high',M:'med',L:'low'};
let LDp=null;function loader(){return LDp||(LDp=(async()=>{const [{GLTFLoader},{DRACOLoader}]=await Promise.all([import('./vendor/loaders/GLTFLoader.js'),import('./vendor/loaders/DRACOLoader.js')]);
 const d=new DRACOLoader();d.setDecoderPath(new URL('./vendor/libs/draco/',import.meta.url).href);d.setDecoderConfig({type:'wasm'});const l=new GLTFLoader();l.setDRACOLoader(d);return l})())}
const FILES=new Map();
export function fileFor(it,lod,man){if(it.src=='A')return `./assets/rigs/triple_${ALOD[lod]||'med'}.glb`;
 const m=it.src=='C'?man.m2:man.m1,r=m?.rigs?.find(x=>x.id==it.rig);const f=r?.lods?.[lod]?.file||r?.lods?.M?.file;return f?(it.src=='C'?'./assets/rigsc/pass2/':'./assets/rigsb/pass1/')+f:null}
function scene(url){if(!FILES.has(url))FILES.set(url,loader().then(l=>l.loadAsync(new URL(url,import.meta.url).href)).then(g=>{g.scene.updateMatrixWorld(true);return g.scene}).catch(e=>{FILES.delete(url);throw e}));return FILES.get(url)}
function findTop(sc,name){let hit=null;const q=[...sc.children];while(q.length){const o=q.shift();if(o.name==name){hit=o;break}q.push(...o.children)}return hit}
// Returns {obj, size:[x,y,z], unit:'unit'|'bank'|'single', tris} or null. obj is pivoted: x,z centre at 0, base at y 0.
const PARTS=new Map();
export async function part(it,lod,man){const url=fileFor(it,lod,man);if(!url)return null;const key=url+'|'+it.node;
 if(!PARTS.has(key))PARTS.set(key,(async()=>{const sc=await scene(url);let n=findTop(sc,it.node);if(!n)return null;let unit='single';const U=UNIT[it.slot];
  if(U){const u=[];n.traverse(o=>{if(o!==n&&U.test(o.name)&&!u.length)u.push(o)});if(u.length){n=u[0];unit='unit'}else if(/generators|pump_trucks|mudpumps/.test(it.node))unit='bank'}
  const srcs=[n,...(COMP[it.node]||[]).map(x=>findTop(sc,x)).filter(Boolean)],g=new THREE.Group();
  for(const s of srcs){const c=s.clone(true);s.matrixWorld.decompose(c.position,c.quaternion,c.scale);g.add(c)}
  g.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(g),sz=bb.getSize(new THREE.Vector3()),ce=bb.getCenter(new THREE.Vector3());
  const p=new THREE.Group();g.position.set(-ce.x,-bb.min.y,-ce.z);p.add(g);let tris=0;p.traverse(o=>{if(o.isMesh){tris+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;o.castShadow=o.receiveShadow=false}});
  return {obj:p,size:[sz.x,sz.y,sz.z],unit,tris:Math.round(tris)}})().catch(e=>{PARTS.delete(key);console.warn('rig builder part',it.id,e);return null}));
 return PARTS.get(key)}
function inst(p,it,slot,i){const o=p.obj.clone(true);o.traverse(m=>{if(m.isMesh){m.material=Array.isArray(m.material)?m.material.map(x=>x.clone()):m.material.clone();m.userData.rb={slot,id:it.id,i}}});
 o.userData.rb={slot,id:it.id,i,unit:p.unit,size:p.size};o.name='rb_'+slot+'_'+i;return o}
// Build the whole rig as a THREE.Group (used by the builder stage and by Showroom B). lod H|M|L.
export async function assemble(rig,cat,lod,man){const L=C.instances(rig),by=id=>cat.find(c=>c.id==id),root=new THREE.Group();root.name='custom_rig';
 const ps=await Promise.all(L.map(x=>{const it=by(x.id);return it?part(it,lod,man):null}));const dims={},ex=[],parts=[],missing=[];
 L.forEach((x,k)=>{const p=ps[k];if(!p){missing.push(x);return}if(x.slot=='extra')ex.push(p.size);else dims[x.slot]=dims[x.slot]||p.size});
 const at=C.layout(dims,rig.qty||{},ex);let ei=0;
 L.forEach((x,k)=>{const p=ps[k];if(!p)return;const o=inst(p,by(x.id),x.slot,x.i),a=x.slot=='extra'?at.extra[ei++]:at[x.slot]?.[x.i];if(a)o.position.set(a[0],a[1],a[2]);root.add(o);parts.push(o)});
 root.userData={parts,missing,nodeSet:parts.map(o=>o.userData.rb.slot+'#'+o.userData.rb.i+':'+o.userData.rb.id).sort(),anchors:at,lod};return root}
// ---------- builder stage: dark stage, orbit + zoom, hover / select highlight ----------
const HL={hover:0x6a5530,sel:0x8a6a2a};
export function stage(host,opt={}){const ren=new THREE.WebGLRenderer({antialias:!opt.phone,powerPreference:'high-performance'});ren.setPixelRatio(Math.min(devicePixelRatio||1,opt.phone?1.25:1.75));
 ren.outputColorSpace=THREE.SRGBColorSpace;ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=1.05;host.appendChild(ren.domElement);ren.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none';
 const sc=new THREE.Scene();sc.background=new THREE.Color(0x0b0d10);sc.fog=new THREE.Fog(0x0b0d10,160,420);
 sc.add(new THREE.HemisphereLight(0xdfe6ee,0x1a1d21,.9));const key=new THREE.DirectionalLight(0xffffff,1.6);key.position.set(40,70,50);sc.add(key);const rim=new THREE.DirectionalLight(0x9fb3c8,.6);rim.position.set(-50,30,-40);sc.add(rim);
 const flo=new THREE.Mesh(new THREE.CircleGeometry(150,64),new THREE.MeshStandardMaterial({color:0x101317,roughness:.95,metalness:0}));flo.rotation.x=-Math.PI/2;flo.position.y=-.02;sc.add(flo);
 const grid=new THREE.GridHelper(200,40,0x2a3038,0x181c21);grid.position.y=0;sc.add(grid);
 import('./vendor/environments/RoomEnvironment.js').then(({RoomEnvironment})=>{const pm=new THREE.PMREMGenerator(ren);sc.environment=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose()}).catch(()=>{});
 const cam=new THREE.PerspectiveCamera(40,1,.5,1200);cam.position.set(70,45,80);const S={ren,sc,cam,root:null,hover:null,sel:null,ctl:null,tok:0,fps:0,frames:0,t0:performance.now(),dead:false,onPick:null,busy:false};
 import('./vendor/OrbitControls.js').then(({OrbitControls})=>{if(S.dead)return;const c=S.ctl=new OrbitControls(cam,ren.domElement);c.enableDamping=true;c.dampingFactor=.08;c.maxPolarAngle=Math.PI*.495;c.minDistance=8;c.maxDistance=400;c.target.set(0,15,0);c.update()});
 const size=()=>{const w=host.clientWidth||1,h=host.clientHeight||1;ren.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();S.need=Math.max(S.need||0,2)};const ro=new ResizeObserver(size);ro.observe(host);size();
 const ray=new THREE.Raycaster(),v=new THREE.Vector2();const hit=e=>{if(!S.root)return null;const r=ren.domElement.getBoundingClientRect();v.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(v,cam);
  const h=ray.intersectObjects(S.root.children,true)[0];return h?.object?.userData?.rb||null};
 let down=null;ren.domElement.addEventListener('pointermove',e=>{if(e.pointerType!='mouse')return;const h=hit(e);const k=h?h.slot:null;if(k!==S.hover){S.hover=k;paint()}});
 ren.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});ren.domElement.addEventListener('pointerup',e=>{if(!down)return;const d=Math.hypot(e.clientX-down[0],e.clientY-down[1]);down=null;if(d>6)return;const h=hit(e);if(h&&S.onPick)S.onPick(h.slot)});
 function paint(){if(!S.root)return;S.need=Math.max(S.need,2);for(const o of S.root.userData.parts){const s=o.userData.rb.slot,c=s==S.sel?HL.sel:s==S.hover?HL.hover:0;o.traverse(m=>{if(m.isMesh)for(const x of [].concat(m.material))if(x.emissive){x.emissive.setHex(c);x.emissiveIntensity=c?.55:0}})}}
 function frame(fit){if(!S.root)return;const bb=new THREE.Box3().setFromObject(S.root),sz=bb.getSize(new THREE.Vector3()),c=bb.getCenter(new THREE.Vector3()),r=Math.max(sz.x,sz.y,sz.z)*.5||20;
  if(S.ctl)S.ctl.target.set(c.x,Math.min(c.y,sz.y*.4),c.z);if(fit){const d=r/Math.tan(cam.fov*Math.PI/360)*(cam.aspect<1?1.9:1.25);const dir=new THREE.Vector3(.75,.45,.85).normalize();cam.position.copy((S.ctl?S.ctl.target:c).clone().add(dir.multiplyScalar(d)))}S.ctl?.update()}
 S.set=async(rig,cat,man,{fit=false}={})=>{const tok=++S.tok;S.busy=true;let g;try{g=await assemble(rig,cat,opt.lod||'M',man)}finally{if(tok==S.tok)S.busy=false}if(tok!=S.tok||S.dead)return null;
  if(S.root){S.sc.remove(S.root);S.root.traverse(m=>{if(m.isMesh)[].concat(m.material).forEach(x=>x.dispose())})}const first=!S.root;S.root=g;sc.add(g);paint();frame(first||fit);return g};
 S.select=k=>{S.sel=k;paint()};S.frame=()=>frame(true);
 // render on demand (orbit, change, resize), so a still stage costs no GPU time on phone.
 S.need=3;const want=()=>{S.need=Math.max(S.need,2)};const loop=t=>{if(S.dead)return;S.raf=requestAnimationFrame(loop);if(S.ctl?.update())S.need=Math.max(S.need,1);if(S.need>0||S.cont){S.need--;ren.render(sc,cam);S.frames++}if(t-S.t0>1000){S.fps=Math.round(S.frames*1000/(t-S.t0));S.frames=0;S.t0=t}};S.raf=requestAnimationFrame(loop);
 S.bench=(ms=2000)=>new Promise(r=>{S.cont=1;const f0=S.frames,t0=performance.now();setTimeout(()=>{S.cont=0;r(Math.round((S.frames-f0)*10000/(performance.now()-t0))/10)},ms)});
 S.want=want;import('./vendor/OrbitControls.js').then(()=>{const t=setInterval(()=>{if(S.ctl){S.ctl.addEventListener('change',want);clearInterval(t)}if(S.dead)clearInterval(t)},50)});
 S.dispose=()=>{S.dead=true;cancelAnimationFrame(S.raf);ro.disconnect();S.ctl?.dispose();ren.dispose();ren.forceContextLoss?.();ren.domElement.remove()};return S}
