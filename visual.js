// visual.js (feat/visual): render quality setting (Low / Medium / High, saved), HDRI sky lighting,
// PBR metal surfaces (procedural maps), distance LOD for small parts, and extra rig detail
// (mud pump discharge + dampeners + motors, top drive service loop, setback stands, mast lights,
// BOP accumulator + choke manifold). Geometry is procedural. HDRI: Poly Haven (CC0), see CREDITS.md.
// It does not change physics or animation state. Pump and top-drive animations stay in main.js.
import {RGBELoader} from './vendor/loaders/RGBELoader.js';
const KEY='dw_quality',LV=['low','medium','high'];
export const PRESET={
 low:   {pr:1,   shadow:0,    env:false,lodFar:60, detail:false,label:'Low'},
 medium:{pr:1.5, shadow:1024, env:true, lodFar:140,detail:true, label:'Medium'},
 high:  {pr:2,   shadow:2048, env:true, lodFar:400,detail:true, label:'High'}};
export function isPhone(){try{return matchMedia('(pointer:coarse)').matches||Math.min(innerWidth,innerHeight)<600}catch{return false}}
export function defaultLevel(){return isPhone()?'low':'high'}
export function getLevel(){const q=new URLSearchParams(location.search).get('q');if(LV.includes(q))return q;const s=localStorage.getItem(KEY);return LV.includes(s)?s:defaultLevel()}
let C,THREE,level=null,hdr=null,procEnv=null,small=[],detailG=null,btn=null,lodT=0;
const v=()=>new C.THREE.Vector3();
// ---------- procedural PBR maps (canvas, no download) ----------
function noiseTex(kind){const n=256,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d'),d=g.createImageData(n,n);
 for(let y=0;y<n;y++){let row=Math.random()*40;for(let x=0;x<n;x++){row+=(Math.random()-0.5)*6;const k=kind=='brushed'?128+row*0.6+(Math.random()-0.5)*30:150+(Math.random()-0.5)*70+(((x*7+y*13)%97)<3?-60:0);
  const i=(y*n+x)*4;d.data[i]=d.data[i+1]=d.data[i+2]=Math.max(0,Math.min(255,k));d.data[i+3]=255}}
 g.putImageData(d,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);return t}
function pbr(){const m=C.mat,br=noiseTex('brushed'),wn=noiseTex('worn');
 const set=(o,map,met,rgh,b)=>{if(!o)return;o.roughnessMap=map;o.metalnessMap=null;o.metalness=met;o.roughness=rgh;o.bumpMap=map;o.bumpScale=b;o.envMapIntensity=1;o.needsUpdate=true};
 set(m.steel,br,0.9,0.45,0.004);set(m.pipe,br,0.95,0.4,0.003);set(m.dark,wn,0.7,0.65,0.006);
 for(const k of['paint','yellow','blue','white'])set(m[k],wn,0.25,0.6,0.008)}
// ---------- environment ----------
async function loadHdr(){if(hdr)return hdr;const pm=new THREE.PMREMGenerator(C.ren);
 const t=await new RGBELoader().loadAsync('./assets/hdri/kloofendal_puresky_1k.hdr');t.mapping=THREE.EquirectangularReflectionMapping;hdr=pm.fromEquirectangular(t).texture;t.dispose();pm.dispose();return hdr}
// ---------- extra detail (procedural) ----------
function detail(){const {box,cyl,beam,mat,M,FLOOR,MH}=C,g=new THREE.Group();g.name='visualDetail';const L=(...a)=>new THREE.Vector3(...a);
 const red=M(0xb3261e,0.35,0.5),grey=M(0x5b6168,0.85,0.4),lamp=new THREE.MeshStandardMaterial({color:0xfff6d0,emissive:0xfff2b0,emissiveIntensity:1.5});
 // mud pumps: discharge line, pulsation dampener, suction line, electric motor + belt guard (added to each pump group)
 for(const e of C.pumps){const p=e.obj,d=new THREE.Group();d.name='pumpDetail';p.add(d);
  cyl(0.45,0.45,0.5,grey,2.2,3.0,1.6,d);const s=new THREE.Mesh(new THREE.SphereGeometry(0.55,20,12),red);s.position.set(2.2,3.6,1.6);s.castShadow=true;d.add(s);
  beam(L(2.2,2.5,1.6),L(4.4,2.5,1.6),0.14,grey,d);beam(L(4.4,2.5,1.6),L(4.4,0.6,1.6),0.14,grey,d);
  beam(L(1.8,0.6,-1.9),L(4.4,0.6,-1.9),0.2,M(0x3a3f45,0.6,0.5),d);
  const mo=cyl(0.8,0.8,2.2,C.mat.blue,-3.2,1.2,-1.1,d,24);mo.rotation.z=Math.PI/2;for(let i=0;i<10;i++){const f=box(2.1,0.05,0.12,grey,-3.2,1.2,-1.1,d);f.rotation.x=i*Math.PI/10}
  box(0.5,1.8,2.2,C.mat.yellow,-4.3,1.6,0.3,d)}
 // top drive service loop: standpipe up the mast + hose hanging to the gooseneck (updated each frame)
 const sp=cyl(0.1,0.1,30,grey,-2.6,FLOOR+15,-2.6,g,10);const hoseMat=M(0x111111,0,0.85);let hose=null;
 g.userData.tick=()=>{const t=v();C.td.getWorldPosition(t);const a=L(-2.6,FLOOR+30,-2.6),b=L(t.x+0.2,t.y+1.6,t.z-0.8),m=a.clone().lerp(b,0.5);m.y-=Math.max(2,Math.abs(a.y-b.y)*0.25+3);
  const cv=new THREE.QuadraticBezierCurve3(a,m,b);if(hose){hose.geometry.dispose();hose.geometry=new THREE.TubeGeometry(cv,24,0.09,6)}else{hose=new THREE.Mesh(new THREE.TubeGeometry(cv,24,0.09,6),hoseMat);hose.castShadow=true;hose.name='serviceLoop';g.add(hose)}};
 // setback: racked stands on the drill floor (pipe handling), tops leaning into the fingerboard
 for(let r=0;r<3;r++)for(let k=0;k<6;k++){const x=-4.4+k*0.32,z=-3.6+r*0.32;beam(L(x,FLOOR+0.2,z),L(x*0.55,FLOOR+27,z*0.7),0.07,C.mat.pipe,g)}
 // mast lights (emissive, no extra light sources)
 for(let i=1;i<5;i++){const y=FLOOR+i*9,f=1-(i*9)/MH*0.65;for(const s of[-1,1]){const l=box(0.4,0.25,0.25,lamp,s*3*f,y,3*f+0.2,g);l.castShadow=false}}
 // BOP control: accumulator (Koomey) unit and choke manifold beside the substructure
 const acc=new THREE.Group();acc.position.set(14,0.3,-14);g.add(acc);box(5,0.3,2,C.mat.dark,0,0.15,0,acc);box(5,0.6,2,red,0,0.6,0,acc);
 for(let i=0;i<8;i++)for(const z of[-0.5,0.5])cyl(0.18,0.18,1.6,red,-2.1+i*0.6,1.7,z,acc,12);box(1.2,1.6,0.6,grey,2.8,1.2,0,acc);
 const ch=new THREE.Group();ch.position.set(10,0.3,10);g.add(ch);box(4,0.25,2,C.mat.dark,0,0.12,0,ch);beam(L(-1.8,1,0),L(1.8,1,0),0.14,grey,ch);
 for(let i=0;i<4;i++){cyl(0.22,0.22,0.5,red,-1.5+i,1,0,ch,12);cyl(0.04,0.04,0.6,grey,-1.5+i,1.5,0,ch,6)}beam(L(-1.8,1,0),L(-6,1,-5),0.1,grey,ch);
 g.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.userData.lod=1}});C.scene.add(g);return g}
// ---------- LOD: hide small parts far from the camera ----------
function collect(){small=[];const bs=new THREE.Sphere();C.scene.traverse(o=>{if(!o.isMesh||o.userData.noLod||!o.geometry)return;if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
 const sc=o.getWorldScale(v()).length()/1.732;if(o.geometry.boundingSphere.radius*sc<0.8&&o.parent&&o.parent!==C.scene)small.push(o)})}
function lodTick(){const P=PRESET[level],cp=C.cam.position,w=v();for(const o of small){if(o.userData.lodHide===undefined)o.userData.lodHide=false;o.getWorldPosition(w);const far=w.distanceTo(cp)>P.lodFar;
 if(far&&o.visible){o.visible=false;o.userData.lodHide=true}else if(!far&&o.userData.lodHide){o.visible=true;o.userData.lodHide=false}}}
// ---------- apply ----------
export async function setLevel(l){if(!LV.includes(l))return;level=l;try{localStorage.setItem(KEY,l)}catch{}const P=PRESET[l],ren=C.ren;
 ren.setPixelRatio(Math.min(devicePixelRatio||1,P.pr));ren.setSize(innerWidth,innerHeight);
 ren.shadowMap.enabled=!!P.shadow;ren.shadowMap.type=l=='high'?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
 if(C.sun){C.sun.castShadow=!!P.shadow;if(P.shadow&&C.sun.shadow.mapSize.x!==P.shadow){C.sun.shadow.mapSize.set(P.shadow,P.shadow);if(C.sun.shadow.map){C.sun.shadow.map.dispose();C.sun.shadow.map=null}}}
 C.scene.traverse(o=>{if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.needsUpdate=true)}});
 if(procEnv===null)procEnv=C.scene.environment||undefined;
 if(P.env){try{C.scene.environment=await loadHdr();C.ren.toneMappingExposure=0.9}catch(e){console.warn('hdri',e);C.scene.environment=procEnv||null}}else C.scene.environment=procEnv||null;
 if(detailG)detailG.visible=P.detail;C.scene.traverse(o=>{if(o.name=='pumpDetail')o.visible=P.detail});
 for(const o of small)if(o.userData.lodHide){o.visible=true;o.userData.lodHide=false}lodTick();
 if(btn)btn.textContent='Quality: '+P.label;window.dispatchEvent(new CustomEvent('dw-quality',{detail:l}))}
export async function init(ctx){C=ctx;THREE=C.THREE;pbr();detailG=detail();collect();
 btn=document.createElement('button');btn.id='qualityBtn';btn.title='Graphics quality. Low is smooth on phones.';
 btn.onclick=()=>setLevel(LV[(LV.indexOf(level)+1)%3]);(document.getElementById('hud')||document.body).appendChild(btn);
 await setLevel(getLevel());
 const tick=()=>{try{detailG.visible&&detailG.userData.tick();const n=performance.now();if(n-lodT>400){lodT=n;lodTick()}}catch(e){}requestAnimationFrame(tick)};requestAnimationFrame(tick);
 window.GX=window.GX||{};window.GX.quality={get:()=>level,set:setLevel,levels:LV,small:()=>small.length};}
