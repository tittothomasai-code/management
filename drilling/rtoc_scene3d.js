// rtoc_scene3d.js — Three.js renderer for the composed description (rtoc_scene_model.compose()).
// THREE is injected (game uses import-map 'three'); texture factory injectable so node tests run without a canvas.
// Perspective volumetric earth block: per-stratum boxes with undulating top surfaces, rock texture on cut faces,
// displaced terrain cap, rig (Codex land_rig.glb if loader supplied, else procedural derrick), tubes for paths, DOM-free callout anchors.
export function createScene3D(THREE,o={}){
 const g=new THREE.Group(),labels=[];let disposables=[];
 const tex=o.texture||((seed,color,lith)=>canvasRock(THREE,seed,color,lith));
 function track(x){disposables.push(x);return x}
 function clear(){g.clear();labels.length=0;for(const d of disposables)d.dispose?.();disposables=[]}
 function surfaceGeom(B,y,seed,amp,segX=48,segZ=20){// top surface of a stratum (gentle folds)
  const geo=track(new THREE.PlaneGeometry(B.x1-B.x0,B.z1-B.z0,segX,segZ));geo.rotateX(-Math.PI/2);const p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,y+amp*(Math.sin(x/(B.W*0.18)+seed)*0.6+Math.sin(z/(B.D*0.3)+seed*1.7)*0.4))}
  geo.translate((B.x0+B.x1)/2,0,(B.z0+B.z1)/2);geo.computeVertexNormals();return geo}
 function build(desc){clear();if(!desc||!desc.ok)return {g,labels};const B=desc.block,cx=(B.x0+B.x1)/2,cz=(B.z0+B.z1)/2;
  // strata as solid boxes; front (z1) and side (x0) faces carry the texture
  for(const s of desc.strata){const h=s.bot-s.top;if(h<=0)continue;const t=tex(s.seed,s.lith?'#'+new THREE.Color(s.color).lerp(new THREE.Color(0x6b5e4e),0.45).getHexString():s.color,s.lith);
   if(t&&t.repeat)t.repeat.set(Math.max(1,B.W/(s.lith?700:1200)),1);
   const base=new THREE.Color(s.color).lerp(new THREE.Color(0x6b5e4e),s.lith?0.45:0);const mat=track(new THREE.MeshStandardMaterial({color:t&&s.lith?new THREE.Color(0xffffff).lerp(new THREE.Color(0x9a8a76),0.35):base,map:t||null,roughness:.96,metalness:0}));
   const m=new THREE.Mesh(track(new THREE.BoxGeometry(B.W,h,B.D)),mat);m.position.set(cx,-(s.top+h/2),cz);m.userData={kind:'stratum',name:s.name,lith:s.lith};g.add(m);
   const e=new THREE.LineSegments(track(new THREE.EdgesGeometry(m.geometry)),track(new THREE.LineBasicMaterial({color:0,transparent:true,opacity:.35})));e.position.copy(m.position);g.add(e)}
  // terrain cap (displaced, darker greens/browns) — context only
  const cap=new THREE.Mesh(surfaceGeom(B,B.H*0.006,0.7,B.H*0.006,64,24),track(new THREE.MeshStandardMaterial({color:0x4b5038,roughness:1,flatShading:true})));cap.userData.kind='terrain';g.add(cap);
  // rig
  const rigPos=new THREE.Vector3(0,B.H*0.006,0),rigH=Math.max(B.H*0.17,40);
  const rig=o.rigModel?(o.rigModel.parent?.remove(o.rigModel),o.rigModel.scale.setScalar(1),o.rigModel):derrick(THREE,rigH,track);/* single shared instance, no per-build clone */rig.userData.kind='rig';
  if(o.rigModel){/* Codex land_rig: origin at grade on well centreline (README) -> keep origin, uniform exaggerated scale (not to scale badge) */const bb=new THREE.Box3().setFromObject(rig),sz=bb.getSize(new THREE.Vector3());const k=rigH/(sz.y||1);rig.scale.setScalar(k)}
  const rg=new THREE.Group();rg.add(rig);rg.position.copy(rigPos);g.add(rg);
  // paths
  const R={thin:B.W/190,thick:B.W/85};
  for(const p of desc.paths){const v=p.pts.map(a=>new THREE.Vector3(a[0],a[1],a[2]));if(v.length<2)continue;let obj;
   if(p.dash){const geo=track(new THREE.BufferGeometry().setFromPoints(v));obj=new THREE.Line(geo,track(new THREE.LineDashedMaterial({color:p.color,dashSize:B.W/120,gapSize:B.W/180})));obj.computeLineDistances()}
   else{const c=new THREE.CatmullRomCurve3(v,false,'centripetal');obj=new THREE.Mesh(track(new THREE.TubeGeometry(c,Math.min(240,v.length*4),R[p.radius]||R.thin,10,false)),
    track(new THREE.MeshStandardMaterial({color:p.color,emissive:p.color,emissiveIntensity:p.kind=='joint'?.9:.45,roughness:.35,transparent:p.opacity<1,opacity:p.opacity??1})))}
   obj.renderOrder=3;obj.userData={kind:'path',path:p.kind,mode:p.mode};g.add(obj);
   if(!p.dash){/* faint x-ray ghost so any buried section stays readable */const gh=new THREE.Mesh(obj.geometry,track(new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.22,depthTest:false,depthWrite:false})));gh.renderOrder=4;gh.userData={kind:'ghost'};g.add(gh)}}
  for(const c of desc.callouts){const a=new THREE.Vector3(...c.p);if(c.kind=='bit'||c.kind=='jend'){const s=new THREE.Mesh(track(new THREE.SphereGeometry(R.thick*1.6,16,12)),track(new THREE.MeshStandardMaterial({color:0xffb347,emissive:0xff9020,emissiveIntensity:.9})));s.position.copy(a);s.userData.kind='bit';g.add(s)}
   labels.push({kind:c.kind,text:c.text,p:a})}
  // distant hills behind block (context only)
  const hg=track(new THREE.PlaneGeometry(B.W*3,B.H*0.5,80,1));const hp=hg.attributes.position;for(let i=0;i<hp.count;i++){if(hp.getY(i)>0){const x=hp.getX(i);hp.setY(i,B.H*(0.06+0.07*Math.abs(Math.sin(x/(B.W*0.21))+0.5*Math.sin(x/(B.W*0.07)))))}else hp.setY(i,0)}
  const hills=new THREE.Mesh(hg,track(new THREE.MeshBasicMaterial({color:0x1b2a3c,transparent:true,opacity:.9})));hills.position.set(cx,0,B.z0-B.D*1.6);hills.userData.kind='hills';g.add(hills);
  return {g,labels}}
 /** project label anchors -> screen px; caller positions its own DOM nodes */
 function project(cam,w,h){return labels.map(l=>{const v=l.p.clone().project(cam);return {...l,x:(v.x+1)/2*w,y:(1-v.y)/2*h,visible:v.z<1}})}
 function applyCamera(cam,ctl,c){cam.fov=c.fov;cam.position.set(...c.position);cam.near=Math.max(.5,Math.hypot(...c.position.map((v,i)=>v-c.target[i]))/500);cam.far=cam.near*20000;cam.updateProjectionMatrix();if(ctl){ctl.target.set(...c.target);ctl.update?.()}else cam.lookAt(...c.target)}
 return {group:g,build,project,applyCamera,clear,labels}}
export function derrick(THREE,H,track=x=>x){const grp=new THREE.Group(),m=track(new THREE.MeshStandardMaterial({color:0xd8dde4,metalness:.6,roughness:.4}));const b=H*0.17,t=H*0.04,r=H*0.008;
 const leg=(x0,z0,x1,z1,y0,y1)=>{const a=new THREE.Vector3(x0,y0,z0),c=new THREE.Vector3(x1,y1,z1),L=a.distanceTo(c),cy=new THREE.Mesh(track(new THREE.CylinderGeometry(r,r,L,5)),m);cy.position.copy(a).add(c).multiplyScalar(.5);cy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),c.clone().sub(a).normalize());grp.add(cy)};
 for(const[sx,sz]of[[-1,-1],[1,-1],[1,1],[-1,1]])leg(sx*b,sz*b,sx*t,sz*t,0,H);
 for(let k=1;k<8;k++){const y=H*k/8,w=b+(t-b)*k/8,y2=H*(k+1)/8,w2=b+(t-b)*(k+1)/8;for(const[a,c]of[[[-1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]]){leg(a[0]*w,a[1]*w,c[0]*w,c[1]*w,y,y);leg(a[0]*w,a[1]*w,c[0]*w2,c[1]*w2,y,y2)}}
 const floor=new THREE.Mesh(track(new THREE.BoxGeometry(b*3.2,H*0.06,b*3.2)),track(new THREE.MeshStandardMaterial({color:0x6a7380,roughness:.8})));floor.position.y=H*0.03;grp.add(floor);
 const shed=new THREE.Mesh(track(new THREE.BoxGeometry(b*2.2,H*0.08,b*1.2)),track(new THREE.MeshStandardMaterial({color:0x8a8f96})));shed.position.set(b*3,H*0.04,b*0.4);grp.add(shed);return grp}
/** restrained rock texture: banding + grain + bedding streaks; neutral (unsupported) uses low-contrast grey grain only. */
const TEXC=new Map();export function canvasRock(THREE,seed,color,lith){if(typeof document=='undefined')return null;const ck=seed+'|'+color+'|'+lith;if(TEXC.has(ck))return TEXC.get(ck);const cv=document.createElement('canvas');cv.width=256;cv.height=128;const x=cv.getContext('2d');
 x.fillStyle=color;x.fillRect(0,0,256,128);let r=(seed*9301+49297)%233280;const rnd=()=>(r=(r*9301+49297)%233280)/233280;
 const n=lith?260:90;for(let i=0;i<n;i++){const y=rnd()*128,a=lith?0.05+rnd()*0.14:0.03+rnd()*0.05;x.fillStyle=rnd()<.5?`rgba(0,0,0,${a})`:`rgba(255,235,210,${a})`;x.fillRect(0,y,256,lith?0.6+rnd()*3:1)}
 if(lith)for(let i=0;i<1600;i++){x.fillStyle=`rgba(${rnd()<.5?0:255},${rnd()<.5?0:240},${rnd()<.5?0:220},${0.06*rnd()})`;x.fillRect(rnd()*256,rnd()*128,1+rnd()*2,1)}
 const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;if(TEXC.size>200)TEXC.clear();TEXC.set(ck,t);return t}
/** Optional: load Codex land_rig.glb with game's vendored GLTFLoader. Resolves null on failure (procedural derrick used). */
export function loadRig(GLTFLoader,url){return new Promise(res=>{try{new GLTFLoader().load(url,g=>res(g.scene),undefined,()=>res(null))}catch(e){res(null)}})}
