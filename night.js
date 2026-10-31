// night.js (feat/night): Day/Night toggle. Scene-agnostic. Values are generic (SIM), no real rig data.
// API (window.GX.night):
//   set(on, scene?, rigRoot?, opts?) -> Promise  on=true night, false day. scene/rigRoot default to the main scene/rig.
//       opts: {floorY, cabins:[Object3D], quality:'low'|'medium'|'high', ren, dur(ms, default 1500), instant}
//   toggle(scene?, rigRoot?, opts?)   flip the state for that scene.
//   isOn(scene?) -> bool               target state.   t(scene?) -> 0..1 current blend (0 day, 1 night).
//   stats(scene?) -> {on,t,quality,stars,sprites,lights,shadowLights,beaconOn,moon}
//   dispose(scene)                     remove all night objects from a scene (showroom on close).
// Each scene keeps its own state, so the showroom can call GX.night.set(true, showScene, rigGroup).
// Quality: Low = emissive sprites + ground light pools, no real lights. Medium = + 3 spot/point lights, no shadows.
//          High = + 6 lights (1 shadowed floodlight) + large glow halos (bloom look).
let THREE=null;const ST=new WeakMap(),ALL=new Set();let MAIN=null,btn=null,raf=0;
const QL=()=>(window.GX&&GX.quality&&GX.quality.get())||'medium';
function canvasTex(sz,draw){const c=document.createElement('canvas');c.width=c.height=sz;draw(c.getContext('2d'),sz);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
let TX=null;function tex(){if(TX)return TX;TX={
 glow:canvasTex(64,(g,s)=>{const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.25,'rgba(255,255,255,0.6)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,s,s)}),
 pool:canvasTex(128,(g,s)=>{const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);r.addColorStop(0,'rgba(255,236,190,0.9)');r.addColorStop(0.5,'rgba(255,220,160,0.35)');r.addColorStop(1,'rgba(255,220,160,0)');g.fillStyle=r;g.fillRect(0,0,s,s)}),
 moon:canvasTex(128,(g,s)=>{const r=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);r.addColorStop(0,'rgba(250,248,235,1)');r.addColorStop(0.42,'rgba(240,238,225,1)');r.addColorStop(0.47,'rgba(200,210,255,0.35)');r.addColorStop(1,'rgba(160,180,255,0)');g.fillStyle=r;g.fillRect(0,0,s,s);g.fillStyle='rgba(190,190,180,0.5)';[[0.44,0.42,0.06],[0.56,0.55,0.045],[0.5,0.6,0.03]].forEach(([x,y,rr])=>{g.beginPath();g.arc(x*s,y*s,rr*s,0,7);g.fill()})})};return TX}
const addMat=(map,color,op=1)=>new THREE.SpriteMaterial({map,color,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:false});
function sky(R){const g=new THREE.SphereGeometry(R,24,16),p=g.attributes.position,c=[];const top=new THREE.Color(0x02040b),hor=new THREE.Color(0x1a2440),tmp=new THREE.Color();
 for(let i=0;i<p.count;i++){const y=p.getY(i)/R;tmp.copy(hor).lerp(top,Math.min(1,Math.max(0,y*1.6)));c.push(tmp.r,tmp.g,tmp.b)}g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false}));m.renderOrder=-10;m.name='nightSky';m.frustumCulled=false;return m}
function stars(n,R){const pos=[],col=[];let s=12345;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
 for(let i=0;i<n;i++){const u=rnd(),th=rnd()*Math.PI*2,y=0.06+u*0.94,r=Math.sqrt(1-y*y);pos.push(Math.cos(th)*r*R,y*R,Math.sin(th)*r*R);const b=0.55+rnd()*0.45,w=rnd();col.push(b*(w<0.2?0.8:1),b*0.95,b*(w>0.85?0.75:1))}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 const m=new THREE.Points(g,new THREE.PointsMaterial({size:2,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false}));m.name='nightStars';m.renderOrder=-9;m.frustumCulled=false;return m}
function build(s){const q=s.quality,T=tex(),G=new THREE.Group();G.name='nightRoot';G.visible=false;s.g=G;s.items=[];s.lights=[];
 const sk=new THREE.Group();sk.name='nightSkyGroup';sk.add(sky(1400));const nS=q=='low'?600:q=='medium'?1200:2000;sk.add(stars(nS,1300));
 const moon=new THREE.Sprite(addMat(T.moon,0xffffff,0));moon.material.blending=THREE.NormalBlending;moon.position.set(-520,760,-700);moon.scale.setScalar(110);moon.name='nightMoon';moon.renderOrder=-8;sk.add(moon);
 s.sky=sk;s.nStars=nS;G.add(sk);s.items.push({o:sk.children[0],k:1},{o:sk.children[1],k:1},{o:moon,k:1});
 // rig geometry from rigRoot bounding box (world space)
 const b=new THREE.Box3();if(s.rig){s.rig.updateMatrixWorld(true);b.setFromObject(s.rig)}if(b.isEmpty())b.set(new THREE.Vector3(-6,0,-6),new THREE.Vector3(6,48,6));
 const H=b.max.y-b.min.y,cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2,top=b.max.y,gy=b.min.y,fl=s.opts.floorY!=null?s.opts.floorY:gy+H*0.17,hw=Math.max(1,(b.max.x-b.min.x)/2);
 const big=q=='high'?2.2:1;const spr=(x,y,z,col,sc,name,op=1)=>{const m=new THREE.Sprite(addMat(T.glow,col,0));m.position.set(x,y,z);m.scale.setScalar(sc);m.name=name;G.add(m);s.items.push({o:m,k:op});return m};
 // mast floodlights (warm), derrick lights along the mast, crown lights
 const flood=[[1,0.45],[-1,0.45],[1,0.75],[-1,0.75]].map(([sx,f])=>spr(cx+sx*hw*0.55,gy+H*f,cz+hw*0.4,0xfff0c8,2.4*big,'nightFlood'));
 for(let f=0.3;f<0.95;f+=0.13)for(const sx of[-1,1])spr(cx+sx*hw*0.35*(1.2-f),gy+H*f,cz,0xffe9b0,0.9*big,'nightDerrick');
 for(const sx of[-1,1])for(const sz of[-1,1])spr(cx+sx*1.4,top-0.2,cz+sz*1.4,0xffffff,1.1*big,'nightCrown');
 // aviation red beacon (blinks ~1 Hz, ICAO type obstruction light look)
 s.beacon=spr(cx,top+0.6,cz,0xff1a10,3*big,'nightBeacon');s.beaconItem=s.items[s.items.length-1];
 // rig floor work lights
 const work=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sz])=>spr(cx+sx*hw*0.8,fl+3.2,cz+sz*hw*0.8,0xfff6e0,1.6*big,'nightWork'));
 if(q=='high')[...flood,...work,s.beacon].forEach(o=>{const h=new THREE.Sprite(addMat(T.glow,o.material.color.getHex(),0));h.position.copy(o.position);h.scale.setScalar(o.scale.x*3.2);h.name='nightHalo';G.add(h);s.items.push({o:h,k:0.35})});
 // ground light pools (cheap additive decals)
 const pool=(x,z,r,op)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(r,r),new THREE.MeshBasicMaterial({map:T.pool,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.set(x,gy+0.25,z);m.name='nightPool';m.renderOrder=2;G.add(m);s.items.push({o:m,k:op})};
 pool(cx,cz,Math.max(30,H*0.8),0.55);pool(cx,cz,H*0.35,0.4);const fp=new THREE.Mesh(new THREE.PlaneGeometry(hw*2.2,hw*2.2),new THREE.MeshBasicMaterial({map:T.pool,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,toneMapped:false}));fp.rotation.x=-Math.PI/2;fp.position.set(cx,fl+0.45,cz);fp.name='nightPool';G.add(fp);s.items.push({o:fp,k:0.5});
 // lit cabin windows
 s.nWin=0;(s.opts.cabins||[]).forEach(c=>{const cb=new THREE.Box3().setFromObject(c);if(cb.isEmpty())return;const w=cb.max.x-cb.min.x,h=cb.max.y-cb.min.y;
  for(const side of[1,-1]){const z=side>0?cb.max.z+0.04:cb.min.z-0.04;for(let i=0;i<2;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(w*0.22,h*0.3),new THREE.MeshBasicMaterial({color:0xffc870,transparent:true,opacity:0,fog:false,toneMapped:false}));m.position.set(cb.min.x+w*(0.25+i*0.4),cb.min.y+h*0.6,z);if(side<0)m.rotation.y=Math.PI;m.name='nightWindow';G.add(m);s.items.push({o:m,k:1});s.nWin++}}
  const gl=new THREE.Sprite(addMat(T.glow,0xffb050,0));gl.position.set((cb.min.x+cb.max.x)/2,cb.min.y+h*0.6,cb.max.z+0.5);gl.scale.setScalar(Math.max(w,3)*big);gl.name='nightWindowGlow';G.add(gl);s.items.push({o:gl,k:0.6})});
 // real lights by quality
 const L=(o,k)=>{G.add(o);s.lights.push({o,k,base:o.intensity});o.intensity=0};
 if(q!='low'){const mk=(x,y,z,i,sh)=>{const l=new THREE.SpotLight(0xfff0d0,i,H*2.2,0.9,0.6,1.2);l.position.set(x,y,z);l.target.position.set(cx,gy,cz);G.add(l.target);l.castShadow=!!sh;if(sh){l.shadow.mapSize.set(1024,1024)}L(l,1)};
  mk(cx+hw*0.6,gy+H*0.6,cz+hw*0.6,q=='high'?900:700,q=='high');mk(cx-hw*0.6,gy+H*0.6,cz-hw*0.6,600,false);
  const bl=new THREE.PointLight(0xff2010,40,25,1.5);bl.position.copy(s.beacon.position);bl.name='nightBeaconLight';L(bl,1);s.beaconLight=bl;
  if(q=='high'){[[-1,-1],[1,1]].forEach(([sx,sz])=>{const p=new THREE.PointLight(0xfff6e0,120,30,1.5);p.position.set(cx+sx*hw*0.8,fl+3.2,cz+sz*hw*0.8);L(p,1)});const m2=new THREE.SpotLight(0xfff0d0,500,H*2,0.8,0.6,1.2);m2.position.set(cx-hw*0.6,gy+H*0.75,cz+hw*0.6);m2.target.position.set(cx,fl,cz);G.add(m2.target);L(m2,1)}}
 s.scene.add(G)}
function capture(s){s.base=[];s.scene.traverse(o=>{if(o.isLight&&!o.name.startsWith('night')&&!(s.g&&isIn(o,s.g))&&(o.isDirectionalLight||o.isHemisphereLight||o.isAmbientLight)){s.base.push({o,i:o.intensity})}});
 s.fog0=s.scene.fog?s.scene.fog.color.clone():null;s.env0=s.scene.environmentIntensity!=null?s.scene.environmentIntensity:1}
function isIn(o,g){for(let p=o;p;p=p.parent)if(p===g)return true;return false}
function apply(s){const t=s.t,e=t*t*(3-2*t);s.g.visible=t>0.001;
 s.items.forEach(it=>{if(it===s.beaconItem)return;it.o.material.opacity=it.k*e});
 s.lights.forEach(l=>{l.o.intensity=l.base*e});
 s.base.forEach(b=>{b.o.intensity=b.i*(1-0.88*e)});
 if(s.scene.fog&&s.fog0)s.scene.fog.color.copy(s.fog0).lerp(new THREE.Color(0x0b1222),e);
 const R=s.opts.ren;if(R){if(s.exp0==null||(e==0))s.exp0=R.toneMappingExposure;R.toneMappingExposure=s.exp0*(1-0.6*e)}}
function tick(now){raf=0;let busy=false;for(const s of ALL){if(!s.scene)continue;
  if(s.t!==s.target){const f=Math.min(1,(now-s.t0)/Math.max(1,s.dur));s.t=s.from+(s.target-s.from)*f;if(f>=1)s.t=s.target;apply(s);if(s.t===s.target&&s.res){s.res.forEach(r=>r());s.res=[]}}
  s.last=now;if(s.t>0){busy=true;const on=blinkOn();s.beaconOn=on;const e=s.t*s.t*(3-2*s.t);s.beacon.material.opacity=on?e:0.04*e;if(s.beaconLight)s.beaconLight.intensity=on?40*e:0}else if(s.t!==s.target)busy=true}
 if(busy||[...ALL].some(s=>s.t!==s.target))raf=requestAnimationFrame(tick)}
const curT=s=>{if(s.t===s.target||s.t0==null)return s.t;const f=Math.min(1,(performance.now()-s.t0)/Math.max(1,s.dur));return f>=1?s.target:s.from+(s.target-s.from)*f};
const blinkOn=()=>(performance.now()%1000)<450;
const kick=()=>{if(!raf)raf=requestAnimationFrame(tick)};
function state(scene,rig,opts){scene=scene||MAIN&&MAIN.scene;if(!scene)throw new Error('night: no scene');let s=ST.get(scene);
 const q=(opts&&opts.quality)||QL();
 if(!s){s={scene,rig:rig||(scene===(MAIN&&MAIN.scene)?MAIN.rig():null),opts:opts||{},t:0,target:0,dur:1500,res:[],quality:q};ST.set(scene,s);ALL.add(s);
  if(!s.opts.cabins&&scene===(MAIN&&MAIN.scene))s.opts.cabins=MAIN.cabins();if(scene===(MAIN&&MAIN.scene)){if(s.opts.floorY==null)s.opts.floorY=MAIN.floorY;if(!s.opts.ren)s.opts.ren=MAIN.ren}capture(s);build(s);
  const prev=scene.onBeforeRender;scene.onBeforeRender=function(r,sc,cam){if(s.sky&&cam)s.sky.position.copy(cam.position);prev&&prev.apply(this,arguments)}}
 else{if(rig&&rig!==s.rig){s.rig=rig;rebuild(s)}if(opts)Object.assign(s.opts,opts);if(opts&&opts.quality&&opts.quality!==s.quality){s.quality=opts.quality;rebuild(s)}}
 return s}
function rebuild(s){if(s.g){s.scene.remove(s.g);s.g.traverse(o=>{o.geometry&&o.geometry.dispose();o.material&&o.material.dispose&&o.material.dispose()})}build(s);apply(s)}
function set(on,scene,rig,opts){if(!THREE&&window.THREE_NIGHT)THREE=window.THREE_NIGHT;const s=state(scene,rig,opts);s.target=on?1:0;s.from=s.t;s.t0=performance.now();s.dur=opts&&opts.dur!=null?opts.dur:1500;
 if(opts&&opts.instant){s.t=s.target;apply(s)} if(s.scene===(MAIN&&MAIN.scene)){try{localStorage.dw_night=on?'1':'0'}catch(e){}label()}
 kick();return new Promise(r=>{if(s.t===s.target)r();else s.res.push(r)})}
function stats(scene){const s=ST.get(scene||(MAIN&&MAIN.scene));if(!s)return {on:false,t:0,stars:0,sprites:0,lights:0,shadowLights:0};let sp=0;s.g.traverse(o=>{if(o.isSprite&&o.name!='nightMoon')sp++});
 return {on:s.target==1,t:+curT(s).toFixed(3),quality:s.quality,stars:s.nStars,sprites:sp,lights:s.lights.length,shadowLights:s.lights.filter(l=>l.o.castShadow).length,beaconOn:s.t>0&&blinkOn(),beaconOpacity:+s.beacon.material.opacity.toFixed(3),moon:!!s.sky.getObjectByName('nightMoon'),windows:s.nWin,skyOpacity:+s.sky.children[0].material.opacity.toFixed(3)}}
function label(){if(!btn)return;const on=MAIN&&ST.get(MAIN.scene)&&ST.get(MAIN.scene).target==1;btn.textContent=on?'☾ Night':'☀ Day';btn.setAttribute('aria-pressed',on?'true':'false')}
const API={set,toggle:(scene,rig,opts)=>{const s=ST.get(scene||(MAIN&&MAIN.scene));return set(!(s&&s.target==1),scene,rig,opts)},isOn:scene=>{const s=ST.get(scene||(MAIN&&MAIN.scene));return !!(s&&s.target==1)},
 t:scene=>{const s=ST.get(scene||(MAIN&&MAIN.scene));return s?curT(s):0},stats,dispose:scene=>{const s=ST.get(scene);if(!s)return;s.t=0;apply(s);s.scene.remove(s.g);ALL.delete(s);ST.delete(scene)},
 useThree:T=>{THREE=T}};
window.GX=window.GX||{};window.GX.night=API;
export {API as night};
// main-scene hook: ext3.js calls init(C)
export function init(C){THREE=C.THREE;MAIN={scene:C.scene,ren:C.ren,floorY:(C.FLOOR||8)+0.4,rig:()=>C.rigG||null,cabins:()=>(C.ents||[]).filter(e=>/doghouse|office|cabin/i.test(e.name)).map(e=>e.obj)};
 btn=document.createElement('button');btn.id='nightBtn';btn.title='Day or night. Night turns on the rig lights.';btn.onclick=()=>API.toggle();(document.getElementById('hud')||document.body).appendChild(btn);label();
 window.addEventListener('dw-quality',ev=>{const s=ST.get(C.scene);if(s&&ev.detail&&ev.detail!==s.quality){s.quality=ev.detail;rebuild(s)}});
 let saved='0';try{saved=localStorage.dw_night||'0'}catch(e){}const q=new URLSearchParams(location.search).get('night');if(q!=null)saved=q=='0'?'0':'1';if(saved=='1')set(true,C.scene,null,{instant:true})}
