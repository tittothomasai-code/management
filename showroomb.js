// showroomb.js (feat/showroom-b): Showroom B — arcade "rig select" (kart-game style) for the pass-N rig model pack.
// Models + node->BOM map come from assets/rigsb/<pack>/manifest.json (pack: ?srbpack= | localStorage dw_srb_pack | CFG.pack).
// Drop a new pack folder (same manifest schema) and change CFG.pack to swap models. Rig ids missing from STATS get stats from manifest dimensions.
// HONESTY: all rigs and numbers are GENERIC SIM class values, not a specific real rig. Labelled SIM. No network writes.
import * as THREE from 'three';
export const VER='b1';
export const CFG={pack:'pass1'};
// Extra polish (light rays, lens flare, confetti/sparks) is deferred: off unless ?srbfx=1 or localStorage dw_srb_fx=1.
export const fxOn=()=>{try{return new URLSearchParams(location.search).get('srbfx')=='1'||localStorage.getItem('dw_srb_fx')=='1'}catch(e){return false}};
const $=id=>document.getElementById(id),es=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PT={s:'Triplex 1000 HP (10in)',m:'Triplex 1600 HP (12in)',l:'Triplex 2200 HP (14in)',q:'Quintuplex 2500 HP (11in)'};
const pumps=(n,t,l)=>Array.from({length:n},()=>({type:PT[t],liner_in:l}));
// SIM class values. hook t, depth m (rated measured depth), power kW (main drive / fleet), bop psi.
export const STATS={
 land_1500_ac_double:{hook:340,depth:6100,kw:1119,bop:10000,short:'1500 AC',design:{derrick_klbf:750,dw_hp:1500,lines:10,bop_psi:10000,pumps:pumps(2,'m',6)}},
 land_3000_triple_walking:{hook:680,depth:9100,kw:2237,bop:15000,short:'3000 Walker',design:{derrick_klbf:1500,dw_hp:3000,lines:12,wire_in:1.625,bop_psi:15000,pumps:pumps(3,'l',6.5)}},
 workover_truck:{hook:113,depth:4500,kw:410,bop:5000,short:'Workover',design:{derrick_klbf:250,dw_hp:550,lines:6,bop_psi:5000,pumps:pumps(1,'s',5)}},
 coiled_tubing:{hook:36,depth:6000,kw:450,bop:10000,short:'Coil',design:{derrick_klbf:80,dw_hp:300,lines:4,bop_psi:10000,pumps:pumps(1,'s',4.5)}},
 jackup:{hook:680,depth:9100,kw:2237,bop:15000,short:'Jackup',design:{derrick_klbf:1500,dw_hp:3000,lines:12,wire_in:1.625,bop_psi:15000,pumps:pumps(3,'l',6.5)}},
 semi_submersible:{hook:907,depth:10700,kw:3430,bop:15000,short:'Semi',design:{derrick_klbf:2000,dw_hp:4600,lines:14,wire_in:1.625,bop_psi:15000,pumps:pumps(4,'l',6.5)}},
 drillship:{hook:1134,depth:12200,kw:3730,bop:15000,short:'Drillship',design:{derrick_klbf:2500,dw_hp:5000,lines:14,wire_in:1.625,bop_psi:15000,pumps:pumps(5,'l',7)}},
 platform_modular:{hook:450,depth:7600,kw:1492,bop:15000,short:'Platform',design:{derrick_klbf:1000,dw_hp:2000,lines:12,bop_psi:15000,pumps:pumps(3,'m',6.5)}},
 snubbing_unit:{hook:270,depth:6000,kw:560,bop:10000,short:'Snubber',design:{derrick_klbf:600,dw_hp:750,lines:4,bop_psi:10000,pumps:pumps(1,'s',4.5)}},
 frac_spread:{hook:0,depth:7000,kw:37000,bop:15000,short:'Frac',hookNote:'n/a',design:{derrick_klbf:300,dw_hp:400,lines:6,bop_psi:15000,pumps:pumps(4,'q',4.5)}}};
export const BARS=[['hook','Hook load',1200,v=>v?v.toLocaleString('en-AU')+' t':'n/a'],['depth','Depth',12500,v=>v.toLocaleString('en-AU')+' m'],['kw','Power',4000,v=>v>=10000?(v/1000).toFixed(0)+' MW':v.toLocaleString('en-AU')+' kW'],['bop','BOP',20000,v=>v.toLocaleString('en-AU')+' psi']];
function statsFor(r){const s=STATS[r.id];if(s)return s;const h=(r.dimensions?.floorHeight||5)+(r.dimensions?.mastHeightAboveFloor||0);return {hook:Math.round(h*12),depth:Math.round(h*130),kw:Math.round(h*30),bop:10000,short:r.id,design:{derrick_klbf:500,dw_hp:1000,lines:8,bop_psi:10000,pumps:pumps(2,'m',6)}}}
export const bar=(k,v)=>{const B=BARS.find(b=>b[0]==k);return Math.max(0,Math.min(1,v/B[2]))};
export const pretty=s=>{s=String(s).split('/').pop().replace(/_/g,' ');return s.charAt(0).toUpperCase()+s.slice(1)};
export const ST={el:null,i:0,man:null,rigs:[],base:'',lod:'M',cache:new Map(),mute:false,night:false,sfxLog:[],cardOn:false,cardCol:false,path:null,hi:[],anim:0,frames:0,fps:0};
const phone=()=>Math.min(innerWidth,innerHeight)<600||(matchMedia?.('(pointer:coarse)').matches&&innerWidth<900);
export function pack(){try{const u=new URLSearchParams(location.search).get('srbpack');if(u&&/^[\w-]+$/.test(u))return u;const l=localStorage.getItem('dw_srb_pack');if(l&&/^[\w-]+$/.test(l))return l}catch(e){}return CFG.pack}
export function lodPick(){try{const u=new URLSearchParams(location.search).get('srblod');if(/^[HML]$/.test(u||''))return u}catch(e){}return phone()?(devicePixelRatio>2.5?'L':'L'):'M'}
export async function manifest(){if(ST.man)return ST.man;ST.base=new URL(`./assets/rigsb/${pack()}/`,import.meta.url).href;const r=await fetch(ST.base+'manifest.json?v='+VER);if(!r.ok)throw new Error('manifest '+r.status);const m=await r.json();
 if(!Array.isArray(m.rigs)||!m.rigs.length)throw new Error('manifest has no rigs');ST.man=m;ST.rigs=m.rigs.map(r=>({...r,st:statsFor(r)}));return m}
let LDp=null;function loader(){return LDp||(LDp=(async()=>{const [{GLTFLoader},{DRACOLoader}]=await Promise.all([import('./vendor/loaders/GLTFLoader.js'),import('./vendor/loaders/DRACOLoader.js')]);
 const d=new DRACOLoader();d.setDecoderPath(new URL('./vendor/libs/draco/',import.meta.url).href);d.setDecoderConfig({type:'wasm'});const l=new GLTFLoader();l.setDRACOLoader(d);return l})())}
// Map: bomId -> manifest path (e.g. mud_system/mud_pump_1/power_end). Uses node extras.bomId (names can be made unique by the loader).
function bomIndex(r,lod){const m=(r.lods?.[lod]?.nodeToBom)||r.nodeToBom||{},inv={};for(const [p,b] of Object.entries(m))inv[b]=p;return {map:m,inv}}
export async function loadRig(i){const r=ST.rigs[i],lod=r.lods?.[ST.lod]?ST.lod:'M',k=r.id+'_'+lod;
 if(!ST.cache.has(k))ST.cache.set(k,loader().then(l=>l.loadAsync(new URL(r.lods[lod].file,ST.base).href+'?v='+VER)).then(g=>g.scene).catch(e=>{ST.cache.delete(k);throw e}));
 const src=await ST.cache.get(k),root=src.clone(true),{map,inv}=bomIndex(r,lod),meshes=[],lights=[];
 root.traverse(o=>{if(o.isMesh){const b=o.userData.bomId||o.parent?.userData?.bomId;o.userData.path=inv[b]||null;o.userData.bom=b||null;meshes.push(o);const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(x=>/light/i.test(x.name)))lights.push(o)}});
 // normalise: max size 40 units, base on podium top, centred.
 const bb=new THREE.Box3().setFromObject(root),sz=bb.getSize(new THREE.Vector3()),c=bb.getCenter(new THREE.Vector3()),s=40/Math.max(sz.x,sz.y,sz.z);
 const g=new THREE.Group();root.scale.setScalar(s);root.position.set(-c.x*s,-bb.min.y*s,-c.z*s);g.add(root);g.userData={id:r.id,map,meshes,lights,size:sz.clone().multiplyScalar(s),lod};return g}
// ---------- audio (WebAudio synth, no files) ----------
let AC=null;function ac(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state=='suspended')AC.resume();return AC}catch(e){return null}}
export function sfx(n){ST.sfxLog.push({n,muted:ST.mute});if(ST.sfxLog.length>60)ST.sfxLog.shift();if(ST.mute)return false;const A=ac();if(!A)return false;const t=A.currentTime,o=A.destination;
 const tone=(f0,f1,d,type='sawtooth',v=.12,dl=0)=>{const g=A.createGain(),x=A.createOscillator();x.type=type;x.frequency.setValueAtTime(f0,t+dl);x.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dl+d);g.gain.setValueAtTime(v,t+dl);g.gain.exponentialRampToValueAtTime(.0001,t+dl+d);x.connect(g).connect(o);x.start(t+dl);x.stop(t+dl+d+.02)};
 const noise=(d,f0,f1,v=.2,q=1.2)=>{const b=A.createBuffer(1,Math.ceil(A.sampleRate*d),A.sampleRate),a=b.getChannelData(0);for(let k=0;k<a.length;k++)a[k]=Math.random()*2-1;const s=A.createBufferSource();s.buffer=b;const f=A.createBiquadFilter();f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+d);const g=A.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+d*.3);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(f).connect(g).connect(o);s.start(t);s.stop(t+d)};
 if(n=='whoosh')noise(.35,400,3200,.25);else if(n=='slam'){tone(140,38,.35,'sine',.5);noise(.18,900,200,.3,.7)}else if(n=='select'){[523,659,784,1047].forEach((f,k)=>tone(f,f*1.01,.18,'square',.08,k*.07));tone(1047,2093,.5,'sawtooth',.06,.28)}
 else if(n=='intro'){tone(110,880,1.6,'sawtooth',.06);noise(1.4,200,5000,.12)}else if(n=='tick')tone(900,700,.05,'square',.05);else if(n=='fill')tone(300,1200,.4,'triangle',.05);return true}
export function setMute(m){ST.mute=!!m;try{localStorage.setItem('dw_srb_mute',m?'1':'0')}catch(e){}const b=$('srbMute');if(b){b.textContent=m?'🔇':'🔊';b.setAttribute('aria-pressed',!!m);b.title=m?'Sound off (M)':'Sound on (M)'}}
// ---------- textures ----------
function cvTex(w,h,fn){const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
const glowTex=()=>cvTex(128,128,(x,w)=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.2,'rgba(255,230,180,.7)');g.addColorStop(1,'rgba(255,200,120,0)');x.fillStyle=g;x.fillRect(0,0,w,w)});
function layerTex(k){return cvTex(1024,256,(x,w,h)=>{let s=k*977+1;const R=()=>(s=(s*16807)%2147483647)/2147483647;
 if(k==0){for(let n=0;n<60;n++){x.fillStyle=`rgba(255,255,255,${.06+R()*.22})`;x.fillRect(R()*w,R()*h*.8,1+R()*1.5,1+R()*1.5)}return}
 x.fillStyle=k==1?'#16191d':'#0f1114';x.beginPath();x.moveTo(0,h);for(let X=0;X<=w;X+=16)x.lineTo(X,h*(k==1?.55:.7)-Math.sin(X*.01+k)*h*.12-R()*h*.08);x.lineTo(w,h);x.fill();
 for(let n=0;n<(k==1?5:9);n++){const X=R()*w,H=h*(.25+R()*.3),Y=h*(k==1?.6:.75);x.strokeStyle=x.fillStyle;x.lineWidth=2;x.beginPath();x.moveTo(X-10,Y);x.lineTo(X,Y-H);x.lineTo(X+10,Y);x.stroke();x.fillStyle='#7d705a';x.fillRect(X-1.5,Y-H-3,3,3);x.fillStyle=k==1?'#16191d':'#0f1114'}})}
// ---------- scene ----------
function setupGL(){ST.fx=fxOn();const cv=ST.el.querySelector('canvas'),P=phone();const ren=ST.ren=new THREE.WebGLRenderer({canvas:cv,antialias:false,powerPreference:'high-performance'});ren.setPixelRatio(Math.min(devicePixelRatio,P?1.5:2));ren.setSize(innerWidth,innerHeight,false);
 ren.outputColorSpace=THREE.SRGBColorSpace;ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=1.05;
 const sc=ST.scene=new THREE.Scene();sc.background=new THREE.Color(0x0b0d10);sc.fog=new THREE.Fog(0x0b0d10,160,520);
 const cam=ST.cam=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.5,1500);
 import('./vendor/environments/RoomEnvironment.js').then(({RoomEnvironment})=>{if(!ST.ren)return;const pm=new THREE.PMREMGenerator(ren);ST.env=pm.fromScene(new RoomEnvironment(),.04).texture;sc.environment=ST.env;pm.dispose()}).catch(()=>{});
 ST.hemi=new THREE.HemisphereLight(0xe6ebf0,0x20140a,.9);sc.add(ST.hemi);ST.key=new THREE.DirectionalLight(0xfff1dd,1.6);ST.key.position.set(40,80,60);sc.add(ST.key);
 // stage: floor + podium (rotates)
 const fl=new THREE.Mesh(new THREE.CircleGeometry(160,P?32:64),new THREE.MeshStandardMaterial({color:0x121417,metalness:.6,roughness:.35}));fl.rotation.x=-Math.PI/2;fl.position.y=-2;sc.add(fl);
 const ringM=new THREE.MeshBasicMaterial({color:0xc9a46a,transparent:true,opacity:.8});ST.ring=new THREE.Mesh(new THREE.TorusGeometry(31,.35,8,P?48:96),ringM);ST.ring.rotation.x=Math.PI/2;ST.ring.position.y=.05;sc.add(ST.ring);
 ST.pod=new THREE.Group();const pod=new THREE.Mesh(new THREE.CylinderGeometry(30,32,2,P?32:64),new THREE.MeshStandardMaterial({color:0x24282d,metalness:.8,roughness:.25}));pod.position.y=-1;ST.pod.add(pod);
 const stripes=new THREE.Mesh(new THREE.CylinderGeometry(32.05,32.05,.6,P?32:64,1,true),new THREE.MeshBasicMaterial({color:0xdfe8f2,transparent:true,opacity:.7}));stripes.position.y=-1.2;ST.pod.add(stripes);sc.add(ST.pod);
 // parallax background layers
 ST.layers=[0,1,2].map(k=>{const t=layerTex(k);t.wrapS=THREE.RepeatWrapping;const m=new THREE.Mesh(new THREE.PlaneGeometry(1400-k*300,350-k*80),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,fog:false}));m.position.set(0,k==0?160:60-k*10,-420+k*110);m.userData.sp=[.02,.08,.18][k];sc.add(m);return m});
 // sweeping spotlights + visible light rays + flare sprites
 const G=ST.glow=glowTex(),cols=[0xe6d2ae,0xcfdbe6,0xf2ede4];ST.spots=[];for(let k=0;k<2;k++){const sp=new THREE.SpotLight(cols[k],P?900:1200,260,.22,.6,1.6);sp.position.set([-55,55,0][k],95,[40,30,-20][k]);sc.add(sp);sc.add(sp.target);
  const rayG=new THREE.ConeGeometry(14,100,24,1,true);rayG.translate(0,-50,0);const ray=new THREE.Mesh(rayG,new THREE.MeshBasicMaterial({color:cols[k],transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));ray.position.copy(sp.position);sc.add(ray);
  const fl=new THREE.Sprite(new THREE.SpriteMaterial({map:G,color:cols[k],blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,fog:false}));fl.scale.setScalar(26);fl.position.copy(sp.position);ray.visible=fl.visible=ST.fx;sc.add(fl);ST.spots.push({sp,ray,fl,ph:k*2.1})}
 // lens flare ghosts (screen-space chain from main flare toward centre)
 ST.ghosts=[.35,.6,.85,1.2].map((d,k)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:G,color:[0xd8c39a,0xd6e0ea,0xe8e4dc,0xffffff][k],blending:THREE.AdditiveBlending,depthWrite:false,depthTest:false,transparent:true,opacity:.25,fog:false}));s.userData.d=d;s.scale.setScalar([6,3,9,4][k]);sc.add(s);return s});
 // particles: confetti (instanced) + sparks (points)
 const NC=P?120:320;const cg=new THREE.PlaneGeometry(.9,.5);const cm=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,vertexColors:false});ST.conf=new THREE.InstancedMesh(cg,cm,NC);ST.conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage);ST.conf.count=0;ST.conf.frustumCulled=false;
 const pal=[0xc9a46a,0xdfe8f2,0xcfd6de,0xd8dde2,0xffffff];for(let k=0;k<NC;k++)ST.conf.setColorAt(k,new THREE.Color(pal[k%pal.length]));sc.add(ST.conf);ST.cP=[];
 const NS=P?150:400,sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(NS*3),3));ST.sparks=new THREE.Points(sg,new THREE.PointsMaterial({color:0xe6d2ae,size:P?.9:.7,map:G,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));ST.sparks.frustumCulled=false;sc.add(ST.sparks);ST.sP=[];ST.NS=NS;
 ST.cs={az:2.6,el:1.0,d:260,ty:20,ox:0,oy:0};ST.cd={az:.55,el:.22,d:110,ty:20,ox:0,oy:0};ST.t=0;ST.shake=0}
function burst(conf){if(!ST.fx)return;const r=ST.grp?.userData.size||new THREE.Vector3(30,30,30);if(conf){ST.cP=[];const N=ST.conf.instanceMatrix.count;for(let k=0;k<N;k++)ST.cP.push({p:new THREE.Vector3((Math.random()-.5)*20,r.y*1.1+Math.random()*10,(Math.random()-.5)*20),v:new THREE.Vector3((Math.random()-.5)*50,20+Math.random()*30,(Math.random()-.5)*50),r:new THREE.Euler(Math.random()*6,Math.random()*6,0),w:Math.random()*10,life:3+Math.random()})}
 for(let k=0;k<ST.NS*(conf?1:.6);k++){const a=Math.random()*6.283;ST.sP.push({p:new THREE.Vector3(Math.cos(a)*30,.3,Math.sin(a)*30),v:new THREE.Vector3(Math.cos(a)*(8+Math.random()*25),6+Math.random()*(conf?40:14),Math.sin(a)*(8+Math.random()*25)),life:.6+Math.random()*.8})}if(ST.sP.length>ST.NS)ST.sP.splice(0,ST.sP.length-ST.NS)}
function stepFx(dt){const D=new THREE.Object3D();let n=0;for(const c of ST.cP){c.life-=dt;if(c.life<=0||c.p.y<-1)continue;c.v.y-=22*dt;c.v.multiplyScalar(1-1.2*dt);c.p.addScaledVector(c.v,dt);c.r.x+=c.w*dt;c.r.y+=c.w*.7*dt;D.position.copy(c.p);D.rotation.copy(c.r);D.updateMatrix();ST.conf.setMatrixAt(n++,D.matrix)}ST.conf.count=n;ST.conf.instanceMatrix.needsUpdate=true;if(!n)ST.cP=[];
 const a=ST.sparks.geometry.attributes.position.array;ST.sP=ST.sP.filter(s=>(s.life-=dt)>0);let m=0;for(const s of ST.sP){s.v.y-=30*dt;s.p.addScaledVector(s.v,dt);a[m++]=s.p.x;a[m++]=Math.max(0,s.p.y);a[m++]=s.p.z}ST.sparks.geometry.setDrawRange(0,m/3);ST.sparks.geometry.attributes.position.needsUpdate=true}
// ---------- framing: fit the rig in a free screen rect (card / HUD never covers it) ----------
export function freeRect(){const W=innerWidth,H=innerHeight,P=phone(),cr=ST.cardOn&&$('srbCard')?.getBoundingClientRect();const r=P?{x0:8,x1:W-8,y0:118,y1:H-250}:{x0:360,x1:W-40,y0:150,y1:H-120};
 if(cr&&cr.width){if(P)r.y0=Math.max(r.y0,cr.bottom+10);else r.x1=Math.min(r.x1,cr.left-40)}if(r.y1-r.y0<120)r.y1=r.y0+120;return r}
function frame(push){const g=ST.grp;if(!g)return;const s=g.userData.size,R=.5*Math.hypot(s.x,s.y,s.z),F=freeRect(),W=innerWidth,H=innerHeight,rpx=Math.min(F.x1-F.x0,F.y1-F.y0)/2*.86,t=Math.tan(THREE.MathUtils.degToRad(ST.cam.fov/2));
 const al=Math.atan(rpx*2*t/H),d=R/Math.sin(al);Object.assign(ST.cd,{d:push?d*.55:d,ty:s.y/2,ox:W/2-(F.x0+F.x1)/2,oy:H/2-(F.y0+F.y1)/2})}
function applyCam(dt){const C=ST.cs,D=ST.cd,k=1-Math.exp(-dt*(ST.intro?1.6:4.5));let moving=0;for(const n of ['az','el','d','ty','ox','oy']){const e=D[n]-C[n];if(Math.abs(e)>(n=='d'?.05:n[0]=='o'?.5:.001))moving=1;C[n]+=e*k}ST.camMoving=moving;if(!moving)ST.intro=0;
 const sh=ST.shake>0?(ST.shake*=.88,ST.shake):0;const cam=ST.cam;cam.position.set(Math.sin(C.az)*Math.cos(C.el)*C.d+(Math.random()-.5)*sh,C.ty+Math.sin(C.el)*C.d+(Math.random()-.5)*sh,Math.cos(C.az)*Math.cos(C.el)*C.d);cam.lookAt(0,C.ty,0);
 cam.setViewOffset(innerWidth,innerHeight,C.ox,C.oy,innerWidth,innerHeight)}
// screen rect of the rig (projected bbox corners), for tests and card placement
export function rigRect(){const g=ST.grp;if(!g)return null;g.updateMatrixWorld(true);ST.cam.updateMatrixWorld();const b=new THREE.Box3();for(const m of g.userData.meshes)if(m.visible)b.expandByObject(m);const v=new THREE.Vector3(),W=innerWidth,H=innerHeight;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 for(let k=0;k<8;k++){v.set(k&1?b.max.x:b.min.x,k&2?b.max.y:b.min.y,k&4?b.max.z:b.min.z).project(ST.cam);const X=(v.x+1)/2*W,Y=(1-v.y)/2*H;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y)}return {left:x0,top:y0,right:x1,bottom:y1}}
// ---------- night ----------
export function nightSet(on){ST.night=!!on;try{localStorage.setItem('dw_night',on?'1':'0')}catch(e){}const b=$('srbNight');if(b){b.textContent=on?'☀ Day':'☾ Night';b.setAttribute('aria-pressed',!!on)}ST.el?.classList.toggle('night',!!on);lightsApply();try{const h=window.GX?.nightReal;if(h?.apply)h.apply({scene:ST.scene,renderer:ST.ren,camera:ST.cam,on:!!on,src:'showroomB'});dispatchEvent(new CustomEvent('dw-night',{detail:{on:!!on,src:'showroomB',scene:ST.scene}}))}catch(e){}}
function lightsApply(){if(!ST.scene)return;const n=ST.night;ST.hemi.intensity=n?.12:.9;ST.key.intensity=n?.15:1.6;ST.scene.background.set(n?0x050607:0x0b0d10);ST.scene.fog.color.set(n?0x050607:0x0b0d10);ST.ren.toneMappingExposure=n?1.25:1.05;
 for(const s of ST.spots)s.sp.intensity=(phone()?900:1200)*(n?1.6:1);const g=ST.grp;if(!g)return;
 for(const m of g.userData.lights){const ms=Array.isArray(m.material)?m.material:[m.material];for(const x of ms)if(/light/i.test(x.name)){if(!x.userData.srb){x.userData.srb=1;x.userData.e0=x.emissiveIntensity}x.emissive?.set?.(0xfff0c0);x.emissiveIntensity=n?6:Math.max(1,x.userData.e0||1)}}
 // a few real point lights at rig light positions (night only; capped for phones)
 if(!g.userData.pl){g.userData.pl=[];const W=new THREE.Vector3(),picks=g.userData.lights.filter((m,k,a)=>k%Math.max(1,Math.ceil(a.length/(phone()?2:4)))==0).slice(0,phone()?2:4);g.updateMatrixWorld(true);
  for(const m of picks){const p=new THREE.PointLight(0xffe2a8,0,60,1.4);m.getWorldPosition(W);g.worldToLocal(W);p.position.copy(W);g.add(p);g.userData.pl.push(p)}}
 for(const p of g.userData.pl)p.intensity=n?700:0}
export const nightState=()=>({on:ST.night,emissive:ST.grp?Math.max(0,...ST.grp.userData.lights.flatMap(m=>(Array.isArray(m.material)?m.material:[m.material]).filter(x=>/light/i.test(x.name)).map(x=>x.emissiveIntensity))):0,points:ST.grp?.userData.pl?.filter(p=>p.intensity>0).length||0,lightMeshes:ST.grp?.userData.lights.length||0});
// ---------- UI ----------
const CSS=`body #showroomB,body.mob #showroomB.msheet{position:fixed!important;inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:auto!important;height:auto!important;max-height:none!important;z-index:100003!important;transform:none!important;border-radius:0!important;margin:0!important;padding:0!important}/* mobile.js .msheet guard */#showroomB{position:fixed;inset:0;z-index:100003;background:#070b16;color:#f2f7ff;font:14px system-ui,-apple-system,Segoe UI,sans-serif;user-select:none;-webkit-user-select:none;touch-action:none;overflow:hidden}
#showroomB canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#showroomB button{font:inherit;cursor:pointer;color:#fff;background:rgba(14,24,48,.85);border:2px solid #3a5f9a;border-radius:12px;min-height:44px;min-width:44px;padding:6px 12px}#showroomB button:focus-visible{outline:3px solid #ffd27a}
#srbTop{position:absolute;top:calc(8px + env(safe-area-inset-top));left:10px;right:10px;display:flex;align-items:center;gap:8px;z-index:5}#srbTop .tt{font-weight:900;letter-spacing:.18em;font-style:italic;font-size:clamp(14px,3.6vw,20px);color:#ffd27a;text-shadow:0 2px 0 #7a3a00,0 0 18px #ff9a2c88;flex:1}
.srbSim{background:#8a8f98;color:#fff;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700;letter-spacing:.1em;font-style:normal;margin-left:6px;text-shadow:none}
#srbBanner{position:absolute;left:50%;top:calc(56px + env(safe-area-inset-top));transform:translateX(-50%) skewX(-12deg);z-index:3;text-align:center;padding:6px 26px 8px;background:linear-gradient(90deg,#ff3d6e,#ffb627);border:3px solid #fff;border-radius:6px;box-shadow:0 6px 0 #7a1d3a,0 10px 30px #0008;max-width:calc(100vw - 30px);box-sizing:border-box;pointer-events:none}
#srbBanner b{display:block;transform:skewX(12deg);font-size:clamp(17px,4.6vw,34px);font-weight:900;font-style:italic;letter-spacing:.04em;text-transform:uppercase;color:#fff;text-shadow:0 3px 0 #7a1d3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#srbBanner small{display:block;transform:skewX(12deg);font-size:12px;font-weight:700;color:#2a0a14}
#srbBanner.slam{animation:srbSlam .45s cubic-bezier(.2,1.6,.4,1)}@keyframes srbSlam{0%{transform:translateX(-50%) skewX(-12deg) scale(2.2);opacity:0}60%{opacity:1}100%{transform:translateX(-50%) skewX(-12deg) scale(1)}}
#srbStats{position:absolute;left:14px;bottom:calc(96px + env(safe-area-inset-bottom));width:320px;z-index:3;background:rgba(6,12,28,.78);border:2px solid #3a5f9a;border-radius:14px;padding:10px 12px;box-sizing:border-box}
#srbStats .row{display:grid;grid-template-columns:78px 1fr 82px;gap:8px;align-items:center;margin:4px 0;font-weight:700;font-size:13px}#srbStats .row span:last-child{text-align:right;font-variant-numeric:tabular-nums;font-size:12px}
#srbStats .bar{height:14px;background:#1a2440;border-radius:7px;overflow:hidden;border:1px solid #33456e;position:relative}#srbStats .fill{height:100%;width:0;border-radius:7px;background:repeating-linear-gradient(90deg,#7cff6b 0 14px,#3fd03a 14px 16px);transition:width .9s cubic-bezier(.2,1.3,.5,1)}
#srbStats .row[data-k=depth] .fill{background:repeating-linear-gradient(90deg,#3fd0ff 0 14px,#1d8ac0 14px 16px)}#srbStats .row[data-k=kw] .fill{background:repeating-linear-gradient(90deg,#ffb627 0 14px,#c07a10 14px 16px)}#srbStats .row[data-k=bop] .fill{background:repeating-linear-gradient(90deg,#ff4d8d 0 14px,#b02a5a 14px 16px)}
#srbBot{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:center;align-items:center;gap:12px;z-index:4}
#srbSel{font-size:22px!important;font-weight:900;font-style:italic;letter-spacing:.12em;padding:8px 34px!important;background:linear-gradient(#ffd23f,#ff9a1f)!important;color:#2a1400!important;border:3px solid #fff!important;border-radius:16px!important;box-shadow:0 5px 0 #8a4a00,0 0 24px #ffb62788;min-height:56px!important}
#srbPrev,#srbNext{font-size:22px;border-radius:50%!important;min-width:56px!important;min-height:56px!important}
#srbDots{position:absolute;left:0;right:0;bottom:calc(78px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:6px;z-index:3;pointer-events:none}#srbDots i{width:9px;height:9px;border-radius:50%;background:#ffffff40}#srbDots i.on{background:#ffd27a;box-shadow:0 0 8px #ffd27a}
#srbHint{position:absolute;right:14px;bottom:calc(20px + env(safe-area-inset-bottom));font-size:11px;opacity:.6;text-align:right;z-index:2;max-width:300px}
#srbBoom{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:8;pointer-events:none;font-size:clamp(54px,16vw,150px);font-weight:900;font-style:italic;color:#fff;text-shadow:0 6px 0 #c2410c,0 0 40px #ffb627,0 0 90px #ff3d6e;opacity:0}#srbBoom.go{animation:srbBoom 1.4s ease-out forwards}
@keyframes srbBoom{0%{transform:scale(3) rotate(-8deg);opacity:0}15%{transform:scale(.9) rotate(-4deg);opacity:1}25%{transform:scale(1.05) rotate(-4deg)}80%{opacity:1}100%{transform:scale(1.15) rotate(-4deg);opacity:0}}
#srbFlash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:7}#srbFlash.go{animation:srbFl .5s ease-out}@keyframes srbFl{0%{opacity:.85}100%{opacity:0}}
#srbCard{position:absolute;z-index:6;right:14px;top:150px;width:min(320px,calc(100vw - 20px));max-height:calc(100vh - 300px);overflow:auto;background:rgba(8,16,36,.93);border:2px solid #3a5f9a;border-radius:14px;padding:10px 12px;box-sizing:border-box;font-size:13px;box-shadow:0 8px 28px #000a}#srbCard[hidden]{display:none}
#showroomB.night #srbCard{background:rgba(3,6,14,.95);border-color:#c89a3a}#srbCard h3{margin:0 92px 4px 0;font-size:15px}#srbCard .x{position:absolute;top:4px;right:4px;min-height:38px!important;min-width:38px!important;padding:0!important}#srbCard .tg{position:absolute;top:4px;right:46px;min-height:38px!important;min-width:38px!important;padding:0!important}
#srbCard .cr{font-size:12px;margin:2px 0 6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center}#srbCard .cr button{min-height:30px!important;padding:2px 8px!important;font-size:12px}#srbCard .lv{display:inline-block;background:#ffb627;color:#1a1000;border-radius:5px;font-weight:800;font-size:11px;padding:0 5px;margin-right:4px}
#srbCard ul{list-style:none;margin:0;padding:0}#srbCard li button{width:100%;text-align:left;margin:2px 0;min-height:36px!important;padding:4px 8px!important;font-size:13px;display:flex;justify-content:space-between;gap:6px}#srbCard li button.on{border-color:#ffd27a;background:#3a2a08}#srbCard .bom{font:11px ui-monospace,monospace;opacity:.8;word-break:break-all}#srbCard .note{font-size:11px;opacity:.7;margin-top:6px}
#srbCard.col ul,#srbCard.col .note{display:none}
#srbLoad{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;font-weight:800;letter-spacing:.2em;opacity:.8}#srbLoad[hidden]{display:none}
@media (max-width:600px){#srbStats{left:8px;right:8px;width:auto;bottom:calc(84px + env(safe-area-inset-bottom));padding:6px 10px}#srbStats .row{grid-template-columns:70px 1fr 74px;margin:2px 0;font-size:12px}#srbStats .bar{height:11px}
#srbBot{gap:8px}#srbSel{font-size:19px!important;padding:6px 22px!important}#srbHint{display:none}#srbDots{bottom:calc(230px + env(safe-area-inset-bottom))}#srbBanner{top:calc(54px + env(safe-area-inset-top));padding:4px 16px 6px}
#srbCard{left:10px;right:10px;width:auto;top:calc(54px + env(safe-area-inset-top));max-height:42vh;font-size:12px}#showroomB.card #srbBanner{display:none}#srbTop .tt{font-size:13px;letter-spacing:.1em}}
/* premium skin: dark stage, restrained neutrals, one muted amber accent */
#showroomB{background:#0b0d10;color:#e8ebef;font:14px Inter,system-ui,-apple-system,Segoe UI,sans-serif}
#showroomB button{background:rgba(22,26,31,.82)!important;color:#e8ebef!important;border:1px solid #2c333b!important;border-radius:8px!important;box-shadow:none!important;text-shadow:none!important;backdrop-filter:blur(6px)}
#showroomB button:hover{border-color:#c9a46a!important}
#srbTop .tt{font-style:normal;font-weight:600;letter-spacing:.32em;color:#e8ebef;text-shadow:none;font-size:clamp(12px,3vw,15px)}
.srbSim{background:transparent;border:1px solid #6b737c;color:#aab2ba}
#srbBanner{transform:translateX(-50%);background:rgba(14,17,21,.78);border:0;border-top:2px solid #c9a46a;border-radius:2px;box-shadow:0 12px 40px #0009;backdrop-filter:blur(8px)}
#srbBanner b{transform:none;font-style:normal;font-weight:600;letter-spacing:.08em;color:#f2f4f6;text-shadow:none;font-size:clamp(16px,4vw,26px)}
#srbBanner small{transform:none;color:#9aa3ac;letter-spacing:.14em}
#srbStats{background:rgba(14,17,21,.78)!important;border:1px solid #262c33!important;border-radius:6px!important;box-shadow:0 12px 40px #0008!important;backdrop-filter:blur(8px)}
#srbStats .row span{color:#9aa3ac;letter-spacing:.06em}#srbStats .row span:last-child,#srbStats .v{color:#f2f4f6;font-variant-numeric:tabular-nums;font-weight:600}
#srbStats .bar{height:6px;background:#1c2127;border:0;border-radius:3px}
#srbStats .fill,#srbStats .row[data-k] .fill{background:linear-gradient(90deg,#8d7650,#d8bd8a)!important;border-radius:3px}
#showroomB #srbSel{font-style:normal!important;font-weight:600;letter-spacing:.28em;font-size:16px!important;background:#c9a46a!important;color:#111!important;border:0!important;border-radius:6px!important}
#srbBoom{font-style:normal;font-weight:300;letter-spacing:.3em;font-size:clamp(24px,6vw,56px);color:#f2f4f6;text-shadow:0 0 30px #0008}
#srbFlash{background:radial-gradient(#fff3,#0000 60%)!important}
#srbCard{background:rgba(14,17,21,.9)!important;border:1px solid #262c33!important;border-radius:6px!important;box-shadow:0 12px 40px #0009!important}
#srbCard .lv{background:#1c2127!important;color:#d8bd8a!important;border:1px solid #3a3226}
#srbDots i{background:#3a4149!important;box-shadow:none!important}#srbDots i.on{background:#c9a46a!important}
#srbHint{color:#7d868f}
`;
function html(){const n=ST.rigs.length;return `<canvas></canvas><div id=srbTop><span class=tt>RIG SELECT<span class=srbSim>SIM</span></span><button id=srbInfo aria-label="Parts card (I)" title="Parts card (I)">ⓘ</button><button id=srbNight aria-label="Day or night (N)">☾ Night</button><button id=srbMute aria-label="Sound (M)">🔊</button><button id=srbX aria-label="Close (Esc)">✕</button></div>
<div id=srbBanner><b id=srbName></b><small id=srbSub></small></div><div id=srbLoad hidden>LOADING…</div>
<div id=srbStats aria-label="Rig stats (SIM)">${BARS.map(([k,l])=>`<div class=row data-k=${k}><span>${l}</span><div class=bar><div class=fill></div></div><span class=v></span></div>`).join('')}</div>
<div id=srbDots>${ST.rigs.map(()=>'<i></i>').join('')}</div><div id=srbCard role=dialog aria-label="Rig parts card" hidden></div>
<div id=srbBot><button id=srbPrev aria-label="Previous rig">◀</button><button id=srbSel>SELECT</button><button id=srbNext aria-label="Next rig">▶</button></div>
<div id=srbHint>← → / A D / LB RB / swipe: change rig · Enter / ⒶA: select · I / Ⓨ: parts · N: night · M: sound · Esc / Ⓑ: close</div><div id=srbFlash></div><div id=srbBoom>RIG SELECTED</div>`}
function hud(){const r=ST.rigs[ST.i],s=r.st;$('srbName').textContent=r.name;$('srbSub').textContent=`${ST.i+1} / ${ST.rigs.length} · ${r.kind} · SIM`;const B=$('srbBanner');B.classList.remove('slam');void B.offsetWidth;B.classList.add('slam');
 [...$('srbDots').children].forEach((d,k)=>d.classList.toggle('on',k==ST.i));
 for(const [k,,,f] of BARS){const row=ST.el.querySelector(`#srbStats .row[data-k=${k}]`),fi=row.querySelector('.fill');fi.style.transition='none';fi.style.width='0%';void fi.offsetWidth;fi.style.transition='';row.querySelector('.v').textContent=k=='hook'&&s.hookNote?s.hookNote:f(s[k]);row.dataset.v=bar(k,s[k]).toFixed(3)}
 clearTimeout(ST.fillT);ST.fillT=setTimeout(()=>{if(!ST.el)return;for(const [k] of BARS){const row=ST.el.querySelector(`#srbStats .row[data-k=${k}]`);row.querySelector('.fill').style.width=(+row.dataset.v*100).toFixed(1)+'%'}sfx('fill')},180)}
// ---------- card: A/B/C drill-down from manifest node paths ----------
function kids(prefix){const m=ST.grp?.userData.map||{},d=prefix?prefix.split('/').length+1:1;return Object.keys(m).filter(p=>p.split('/').length==d&&(!prefix||p.startsWith(prefix+'/')))}
function cardHTML(){const r=ST.rigs[ST.i],m=ST.grp?.userData.map||{},p=ST.path,segs=p?p.split('/'):[],L='ABC';
 const crumbs=`<button data-go="">${es(ST.rigs[ST.i].st.short||'Rig')}</button>`+segs.map((s,k)=>`› <button data-go="${es(segs.slice(0,k+1).join('/'))}"><span class=lv>${L[k]}</span>${es(pretty(s))}</button>`).join(' ');
 const lvl=segs.length,list=lvl<3?kids(p):[];
 return `<button class=tg id=srbCardT aria-label="Fold or unfold card">${ST.cardCol?'▾':'▴'}</button><button class=x id=srbCardX aria-label="Close card (Esc)">✕</button><h3>${es(r.name)} <span class=srbSim>SIM</span></h3>
 <div class=cr>${crumbs}</div>${p?`<div class=bom>BOM ${es(m[p]||'?')}</div>`:''}<ul>${list.map(k=>`<li><button data-go="${es(k)}" class="${ST.hiP==k?'on':''}"><span><span class=lv>${L[lvl]}</span>${es(pretty(k))}</span><small>${kids(k).length?kids(k).length+' ›':''}</small></button></li>`).join('')}</ul>
 <div class=note>${lvl==0?'Level A: main systems. Tap one to see level B parts, then level C.':lvl<3&&list.length?'Tap a part to go one level down.':'Lowest level. Tap a level above to go back.'} Tap the rig to pick a part. Generic SIM model.</div>`}
export function cardShow(on,path){ST.cardOn=!!on;if(path!==undefined)ST.path=path||null;const c=$('srbCard');if(!c)return;ST.el.classList.toggle('card',!!on);if(!on){c.hidden=true;hilite(null);frame();return}
 c.hidden=false;c.classList.toggle('col',ST.cardCol);c.innerHTML=cardHTML();hilite(ST.path);
 c.querySelectorAll('[data-go]').forEach(b=>b.onclick=e=>{e.stopPropagation();sfx('tick');cardShow(true,b.dataset.go)});$('srbCardX').onclick=e=>{e.stopPropagation();cardShow(false)};$('srbCardT').onclick=e=>{e.stopPropagation();ST.cardCol=!ST.cardCol;cardShow(true)};
 requestAnimationFrame(()=>frame())}
const HM=new THREE.MeshStandardMaterial({color:0xffb627,emissive:0xff8a00,emissiveIntensity:.8,metalness:.2,roughness:.5});
function hilite(path){for(const m of ST.hi){m.material=m.userData.m0}ST.hi=[];if(!path||!ST.grp)return;for(const m of ST.grp.userData.meshes){const p=m.userData.path;if(p&&(p==path||p.startsWith(path+'/'))){m.userData.m0=m.material;m.material=HM;ST.hi.push(m)}}}
export function pick(x,y){if(!ST.grp)return null;const rc=new THREE.Raycaster(),v=new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1);rc.setFromCamera(v,ST.cam);const h=rc.intersectObjects(ST.grp.userData.meshes,false).find(i=>i.object.userData.path);return h?h.object:null}
function tapAt(x,y){const o=pick(x,y);if(!o){if(ST.cardOn&&ST.path)cardShow(true,null);return}const segs=o.userData.path.split('/'),cur=ST.path?ST.path.split('/'):[];
 // tap goes one level deeper along the tapped part's path (A -> B -> C)
 let k=0;while(k<cur.length&&cur[k]==segs[k])k++;const np=segs.slice(0,k<cur.length?1:Math.min(segs.length,cur.length+1)).join('/');sfx('tick');cardShow(true,np)}
// ---------- rig change: whoosh out, slam in ----------
export async function show(i,dir=1){const n=ST.rigs.length;i=((i%n)+n)%n;const tok=ST.tok=(ST.tok||0)+1;ST.i=i;ST.anim++;hud();sfx('whoosh');
 const old=ST.grp;if(old?.userData.in){delete old.userData.in;ST.anim--}if(ST.out){ST.pod.remove(ST.out.g)}ST.out=old?{g:old,t:0,dir}:null;ST.grp=null;ST.para=(ST.para||0)+dir;
 if(ST.cardOn)ST.path=null;let g;try{$('srbLoad').hidden=!!ST.cache.get(ST.rigs[i].id+'_'+ST.lod);g=await loadRig(i)}catch(e){console.warn('showroomB load',e);$('srbLoad').textContent='MODEL NOT LOADED';ST.anim--;return}finally{if($('srbLoad'))$('srbLoad').hidden=true}
 if(tok!=ST.tok||!ST.el){ST.anim--;return}g.position.y=70;g.position.x=dir*12;g.userData.in={t:0};ST.pod.add(g);ST.grp=g;lightsApply();frame();if(ST.cardOn)cardShow(true,null);
 const pre=(k)=>{const r=ST.rigs[((k%n)+n)%n];if(r&&!ST.cache.get(r.id+'_'+ST.lod))loadRig(((k%n)+n)%n).catch(()=>{})};setTimeout(()=>{pre(i+1);pre(i-1)},600)}
export function go(d){if(ST.sel)return;show(ST.i+d,d)}
export function select(){if(!ST.grp||ST.sel)return false;const r=ST.rigs[ST.i];ST.sel=1;ST.anim++;sfx('select');burst(true);ST.shake=2.5;frame(true);const B=$('srbBoom');B.classList.remove('go');void B.offsetWidth;B.classList.add('go');const F=$('srbFlash');F.classList.remove('go');void F.offsetWidth;F.classList.add('go');
 let applied=false;try{if(window.GX?.setDesign){window.GX.setDesign({...r.st.design,name:r.name+' (SIM)'});applied=true}}catch(e){console.warn('showroomB setDesign',e)}
 try{localStorage.setItem('dw_showroom_rig_b',r.id)}catch(e){}try{dispatchEvent(new CustomEvent('dw-rig',{detail:{id:r.id,name:r.name,applied,src:'B'}}))}catch(e){}
 ST.selT=setTimeout(()=>{ST.anim--;ST.sel=0;close()},1700);return true}
// ---------- input ----------
function key(e){if(!ST.el)return;const k=e.key;if(/INPUT|TEXTAREA/.test(e.target?.tagName))return;let h=1;
 if(k=='ArrowRight'||k=='d'||k=='D')go(1);else if(k=='ArrowLeft'||k=='a'||k=='A')go(-1);else if(k=='Enter'||k==' ')select();else if(k=='Escape'){if(ST.cardOn)cardShow(false);else close()}
 else if(k=='n'||k=='N')nightSet(!ST.night);else if(k=='m'||k=='M')setMute(!ST.mute);else if(k=='i'||k=='I'||k=='c'||k=='C')cardShow(!ST.cardOn);else h=0;if(h){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}}
function pad(){const g=[...(navigator.getGamepads?.()||[])].find(Boolean);if(!g)return;const b=g.buttons.map(x=>!!x?.pressed),P=ST.prev||{},ed=i=>b[i]&&!P[i];const ax=g.axes[0]||0,axd=ax>.6?1:ax<-.6?-1:0;
 if(ed(5)||ed(15)||(axd==1&&ST.ax!=1))go(1);if(ed(4)||ed(14)||(axd==-1&&ST.ax!=-1))go(-1);if(ed(0))select();if(ed(1)){if(ST.cardOn)cardShow(false);else close()}if(ed(3))cardShow(!ST.cardOn);if(ed(2))nightSet(!ST.night);ST.prev=b;ST.ax=axd}
function ptr(cv){let s=null;cv.addEventListener('pointerdown',e=>{s={x:e.clientX,y:e.clientY,t:performance.now()};try{cv.setPointerCapture(e.pointerId)}catch(_){}});
 cv.addEventListener('pointerup',e=>{if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy))go(dx<0?1:-1);else if(Math.hypot(dx,dy)<10)tapAt(e.clientX,e.clientY);s=null});cv.addEventListener('pointercancel',()=>s=null)}
// ---------- loop ----------
function loop(now){if(!ST.el)return;ST.raf=requestAnimationFrame(loop);const dt=Math.min(.05,(now-(ST.last||now))/1000);ST.last=now;ST.t+=dt;ST.frames++;
 if(now-(ST.fT||0)>1000){if(window.GX?.showroomB!==ST.api){window.GX=window.GX||{};window.GX.showroomB=ST.api}ST.fps=ST.frames*1000/(now-(ST.fT||now-1000));ST.frames=0;ST.fT=now}
 if(ST.gpT==null||now-ST.gpT>50){ST.gpT=now;pad()}
 ST.pod.rotation.y+=dt*.35;ST.ring.material.opacity=.55+.3*Math.sin(ST.t*3);
 for(const s of ST.spots){const a=ST.t*.6+s.ph;s.sp.target.position.set(Math.sin(a)*26,0,Math.cos(a*.8)*18);s.ray.lookAt(s.sp.target.position);s.ray.rotateX(-Math.PI/2);s.fl.material.opacity=.6+.4*Math.sin(ST.t*4+s.ph)}
 // parallax: layers slide by different speeds after a rig change
 for(const L of ST.layers){L.material.map.offset.x+=((ST.para*L.userData.sp)-L.material.map.offset.x)*Math.min(1,dt*3)}
 const o=ST.out;if(o){o.t+=dt;const k=Math.min(1,o.t/.35);o.g.position.x=-o.dir*k*k*90;o.g.rotation.z=o.dir*k*.4;if(k>=1){ST.pod.remove(o.g);ST.out=null}}
 const g=ST.grp;if(g?.userData.in){const I=g.userData.in;I.t+=dt;const k=Math.min(1,Math.max(0,(I.t-.15)/.3));g.position.y=70*(1-k*k);g.position.x*=1-k;if(k>=1){g.position.set(0,0,0);delete g.userData.in;ST.shake=1.6;burst(false);sfx('slam');ST.anim--}}
 applyCam(dt);stepFx(dt);
 // lens-flare ghosts along the line from the brightest flare to the screen centre
 const f=ST.spots[0].fl.position.clone().project(ST.cam),vis=ST.fx&&f.z<1&&Math.abs(f.x)<1.3&&Math.abs(f.y)<1.3;for(const s of ST.ghosts){s.visible=vis;if(!vis)continue;const p=new THREE.Vector3(f.x*(1-s.userData.d*2),f.y*(1-s.userData.d*2),.5).unproject(ST.cam);s.position.copy(p).sub(ST.cam.position).setLength(60).add(ST.cam.position);s.material.opacity=.18*(ST.night?1.5:1)}
 ST.ren.render(ST.scene,ST.cam)}
export function idle(){return !!ST.el&&!!ST.grp&&!ST.anim&&!ST.camMoving&&!ST.out&&!ST.grp.userData.in&&!ST.sel}
function size(){if(!ST.ren)return;ST.ren.setSize(innerWidth,innerHeight,false);ST.cam.aspect=innerWidth/innerHeight;ST.cam.updateProjectionMatrix();frame()}
function api(){return {ST,STATS,BARS,CFG,open,close,show,go,select,sfx,setMute,nightSet,nightState,cardShow,pick,rigRect,freeRect,idle,pack,lodPick,manifest,isOpen:()=>!!ST.el}}
export async function open(i){if(ST.el)return;window.GX=window.GX||{};window.GX.showroomB=ST.api=ST.api||api();if(!$('srbCss')){const s=document.createElement('style');s.id='srbCss';s.textContent=CSS;document.head.appendChild(s)}
 try{await manifest()}catch(e){console.warn('showroomB manifest',e);alert('Showroom B models are not available. Opening Showroom A.');const m=await import('./showroom.js?v=b16');m.init();m.open();return}
 ST.lod=lodPick();try{ST.mute=localStorage.getItem('dw_srb_mute')=='1'}catch(e){}
 const el=ST.el=document.createElement('div');el.id='showroomB';el.setAttribute('role','dialog');el.setAttribute('aria-label','Rig select, showroom B');el.innerHTML=html();document.body.appendChild(el);
 $('srbX').onclick=close;$('srbPrev').onclick=()=>go(-1);$('srbNext').onclick=()=>go(1);$('srbSel').onclick=select;$('srbNight').onclick=()=>nightSet(!ST.night);$('srbMute').onclick=()=>setMute(!ST.mute);$('srbInfo').onclick=()=>cardShow(!ST.cardOn);
 setupGL();ptr(el.querySelector('canvas'));setMute(ST.mute);let on=false;try{on=window.GX?.night?.isOn?.()??localStorage.getItem('dw_night')=='1'}catch(e){}nightSet(on);
 let st=i;if(st==null)try{st=Math.max(0,ST.rigs.findIndex(r=>r.id==localStorage.getItem('dw_showroom_rig_b')))}catch(e){st=0}
 ST.intro=1;ST.para=0;ST.prev=null;show(st||0,1);addEventListener('keydown',key,true);addEventListener('resize',size);addEventListener('dw:home',close);ST.last=0;ST.raf=requestAnimationFrame(loop);const at=performance.now();import('./srperf.js?v=p1').then(m=>{if(ST.el)m.attach({id:'B',el:ST.el,at,lod:()=>ST.lod,ready:()=>!!ST.grp,match:/assets\/rigsb\/.*\.glb/})}).catch(()=>{})}
export function close(){if(!ST.el)return;import('./srperf.js?v=p1').then(m=>m.detach('B')).catch(()=>{});cancelAnimationFrame(ST.raf);clearTimeout(ST.selT);clearTimeout(ST.fillT);removeEventListener('keydown',key,true);removeEventListener('resize',size);removeEventListener('dw:home',close);
 try{for(const c of [...ST.pod.children])if(c.userData?.meshes)ST.pod.remove(c);ST.scene.traverse(o=>{if(o.geometry&&!o.isSprite)o.geometry.dispose?.()});ST.env?.dispose();ST.ren.dispose()}catch(e){}ST.el.remove();Object.assign(ST,{el:null,grp:null,out:null,scene:null,ren:null,env:null,cardOn:false,path:null,hi:[],anim:0,sel:0,tok:(ST.tok||0)+1})}
