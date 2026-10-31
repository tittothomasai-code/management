// showroom.js (feat/showroom): Rig showroom — a "garage" view. One rig at a time on a slow turntable, full screen.
// Change rig: swipe (phone), ←/→ keys, controller LB/RB. Dots indicator. Spec card per rig. Tap a part: exploded view (ext12),
// or its BOM tab when bom.js is loaded. "Use this rig" applies the rig design to the scene (GX.setDesign, ext2.js).
// HONESTY: all rigs and numbers are GENERIC SIM values (typical class values), not a specific real rig. Labelled SIM.
import * as THREE from 'three';
const $=id=>document.getElementById(id),es=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PT={s:'Triplex 1000 HP (10in)',m:'Triplex 1600 HP (12in)',l:'Triplex 2200 HP (14in)',q:'Quintuplex 2500 HP (11in)'};
const pumps=(n,t,l)=>Array.from({length:n},()=>({type:PT[t],liner_in:l}));
// hook t (metric tonnes), dw hp, mast m, BOP psi. design = patch for GX.setDesign.
export const RIGS=[
 {id:'single',name:'Land rig — single',type:'Land, single-joint mast',hook:'136 t (300 klbf)',dw:'400 hp (298 kW)',mast:'26 m',pumps:'1 × triplex 1,000 hp',bop:'5,000 psi (34.5 MPa)',design:{derrick_klbf:300,dw_hp:400,lines:6,bop_psi:5000,pumps:pumps(1,'s',5.5)},kind:'land',H:26,legs:2},
 {id:'triple',name:'Land rig — triple',type:'Land, triple-stand derrick',hook:'340 t (750 klbf)',dw:'1,500 hp (1,119 kW)',mast:'43 m',pumps:'2 × triplex 1,600 hp',bop:'10,000 psi (69 MPa)',design:{derrick_klbf:750,dw_hp:1500,lines:10,bop_psi:10000,pumps:pumps(2,'m',6)},kind:'land',H:43,legs:4},
 {id:'heli',name:'Heli-portable rig',type:'Land, modular (lifts ≤ 4.5 t)',hook:'160 t (350 klbf)',dw:'1,000 hp (746 kW)',mast:'37 m',pumps:'2 × triplex 1,000 hp',bop:'5,000 psi (34.5 MPa)',design:{derrick_klbf:350,dw_hp:1000,lines:8,bop_psi:5000,pumps:pumps(2,'s',5.5)},kind:'heli',H:37,legs:4},
 {id:'workover',name:'Workover / pulling unit',type:'Truck-mounted, telescopic mast',hook:'113 t (250 klbf)',dw:'550 hp (410 kW)',mast:'31 m',pumps:'1 × triplex 1,000 hp',bop:'5,000 psi (34.5 MPa)',design:{derrick_klbf:250,dw_hp:550,lines:6,bop_psi:5000,pumps:pumps(1,'s',5)},kind:'truck',H:31,legs:2},
 {id:'ctu',name:'Coiled tubing unit',type:'CT injector + reel, no derrick',hook:'36 t injector pull (80 klbf)',dw:'n/a — injector head',mast:'≈ 20 m lift frame',pumps:'1 × triplex 1,000 hp (N₂ optional)',bop:'10,000 psi quad CT BOP',design:{derrick_klbf:80,dw_hp:300,lines:4,bop_psi:10000,pumps:pumps(1,'s',4.5)},kind:'ctu',H:20},
 {id:'jackup',name:'Jack-up',type:'Offshore, bottom-supported (≤ 120 m water)',hook:'680 t (1,500 klbf)',dw:'3,000 hp (2,237 kW)',mast:'52 m',pumps:'3 × triplex 2,200 hp',bop:'15,000 psi (103 MPa)',design:{derrick_klbf:1500,dw_hp:3000,lines:12,wire_in:1.625,bop_psi:15000,pumps:pumps(3,'l',6.5)},kind:'jackup',H:52,legs:4},
 {id:'semi',name:'Semi-submersible',type:'Offshore, floating, moored / DP',hook:'907 t (2,000 klbf)',dw:'4,600 hp (3,430 kW)',mast:'64 m',pumps:'4 × triplex 2,200 hp',bop:'15,000 psi subsea',design:{derrick_klbf:2000,dw_hp:4600,lines:14,wire_in:1.625,bop_psi:15000,pumps:pumps(4,'l',6.5)},kind:'semi',H:64,legs:4},
 {id:'ship',name:'Drillship',type:'Offshore, floating, dynamic positioning',hook:'1,134 t (2,500 klbf)',dw:'5,000 hp (3,730 kW)',mast:'70 m',pumps:'5 × triplex 2,200 hp',bop:'15,000 psi subsea',design:{derrick_klbf:2500,dw_hp:5000,lines:14,wire_in:1.625,bop_psi:15000,pumps:pumps(5,'l',7)},kind:'ship',H:70,legs:4},
 {id:'frac',name:'Frac spread',type:'Pressure pumping fleet, no derrick',hook:'n/a',dw:'n/a',mast:'n/a',pumps:'16 × quintuplex 2,500 hp (scene shows 4)',bop:'15,000 psi frac tree',design:{derrick_klbf:300,dw_hp:400,lines:6,bop_psi:15000,pumps:pumps(4,'q',4.5)},kind:'frac',H:6}];
const ST={el:null,i:0,ren:null,scene:null,cam:null,grp:null,old:null,tr:null,raf:0,t:0,last:0,prev:{},dn:null,parts:[],hiT:0,used:null};
const CSS=`#showroom{position:fixed;inset:0;z-index:100002;background:radial-gradient(ellipse at 50% 80%,#24384f,#05080f 70%);color:#eaf6ff;font:14px system-ui,-apple-system,Segoe UI,sans-serif;user-select:none;-webkit-user-select:none;touch-action:none}
#showroom canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#srTop{position:absolute;top:calc(8px + env(safe-area-inset-top));left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;pointer-events:none}
#srTop b{font-size:clamp(16px,4.5vw,22px);letter-spacing:.06em}#srTop button{pointer-events:auto}
#showroom button{background:rgba(10,30,60,.85);color:#dff;border:1px solid #3a6a9a;border-radius:10px;padding:8px 14px;font:inherit;cursor:pointer;min-height:40px}
#showroom button:focus-visible{outline:3px solid #7fe3ff}
.srSim{background:#8a8f98;color:#fff;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700;letter-spacing:.1em;margin-left:6px}
#srRC{position:absolute;z-index:6;width:min(280px,calc(100vw - 16px));max-height:calc(100vh - 120px);overflow:auto;background:rgba(8,20,40,.9);border:1px solid #3a6a9a;border-radius:14px;padding:10px 12px;box-sizing:border-box;font-size:13px;color:#e8f0ff;box-shadow:0 6px 24px rgba(0,0,0,.5)}#srRC[hidden]{display:none}#srRC.night{background:rgba(4,8,18,.94);border-color:#c89a3a;color:#fff}#srRC h3{margin:0 28px 2px 0;font-size:15px}#srRC table{width:100%;border-collapse:collapse}#srRC td{padding:2px 4px;border-bottom:1px solid #ffffff18}#srRC td:last-child{text-align:right}#srRC .ds{margin:6px 0 4px}#srRC .note{font-size:11px;opacity:.75}#srRcX{position:absolute;right:4px;top:4px;min-width:36px;min-height:36px}#srRcT{position:absolute;right:44px;top:4px;min-width:36px;min-height:36px}#srRC h3{margin-right:84px!important}#srRC.col table,#srRC.col .ds,#srRC.col .note{display:none}#srRC.col .ty{font-size:11px}#srRC.col #srRcGo{min-height:36px;margin-top:4px}@media (max-width:600px){#srRC{font-size:12px;padding:8px 10px;width:min(250px,calc(100vw - 16px))}#srRC td{padding:1px 3px}#srRC .ds{display:none}}#srRcGo{width:100%;margin-top:6px;min-height:44px}
#srCard{position:absolute;left:12px;bottom:calc(84px + env(safe-area-inset-bottom));width:min(330px,calc(100vw - 24px));background:rgba(8,20,40,.82);border:1px solid #3a6a9a;border-radius:14px;padding:10px 14px;box-sizing:border-box;transition:opacity .25s}
#srCard h3{margin:0 0 2px;font-size:18px}#srCard .ty{opacity:.75;font-size:12px;margin-bottom:6px}#srCard table{width:100%;border-collapse:collapse;font-size:13px}#srCard td{padding:2px 0}#srCard td:last-child{text-align:right;font-weight:600}
#srCard .note{font-size:11px;opacity:.6;margin-top:4px}
@media (max-width:600px){#srCard{bottom:calc(132px + env(safe-area-inset-bottom));padding:8px 12px}#srCard table{font-size:12px}}
#srBar{position:absolute;left:0;right:0;bottom:calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:8px}
#srNav{display:flex;align-items:center;gap:10px}#srDots{display:flex;gap:7px}#srDots i{width:9px;height:9px;border-radius:50%;background:#456;display:block;cursor:pointer}#srDots i.on{background:#7fe3ff;box-shadow:0 0 8px #7fe3ff;transform:scale(1.3)}
#srUse{background:linear-gradient(135deg,#1d7a3a,#0f4d24)!important;border-color:#5fd38a!important;font-weight:800;padding:10px 22px!important}
#srHint{position:absolute;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));font-size:12px;opacity:.6;text-align:right}@media (max-width:600px){#srHint{display:none}}
#srDrw{position:absolute;top:calc(56px + env(safe-area-inset-top));right:0;bottom:calc(76px + env(safe-area-inset-bottom));width:min(400px,88vw);background:rgba(6,16,32,.94);border-left:1px solid #3a6a9a;transform:translateX(100%);transition:transform .3s ease;display:flex;flex-direction:column;box-sizing:border-box}
#srDrw.open{transform:none}#srHdl{position:absolute;left:-44px;top:40%;width:44px;min-height:80px!important;padding:4px!important;border-radius:10px 0 0 10px!important;writing-mode:vertical-rl;font-size:12px!important}
#srCrumb{padding:8px 10px;font-size:13px;border-bottom:1px solid #2a4a6a;display:flex;gap:6px;align-items:center;flex-wrap:wrap}#srCrumb a{color:#7fe3ff;cursor:pointer;text-decoration:underline}#srCrumb button{min-height:30px!important;padding:2px 10px!important}
#srList{overflow:auto;flex:1}#srList table{width:100%;border-collapse:collapse;font-size:12.5px}#srList th{text-align:left;position:sticky;top:0;background:#0c1d33;padding:6px;font-weight:600;opacity:.8}#srList td{padding:7px 6px;border-bottom:1px solid #1d3550;vertical-align:top}
#srList tr.b{cursor:pointer}#srList tr.b:hover,#srList tr.on{background:#14365a}#srList tr.c{cursor:pointer;background:#0a1a2c}#srList tr.c td:first-child{padding-left:22px}#srList tr.c.on{background:#1d4a2a}#srDet{padding:10px;font-size:13px}#srDet .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
body #showroom.narrow #srDrw{top:auto;left:0;right:0;bottom:0;width:auto;height:58vh;border-left:0;border-top:1px solid #3a6a9a;border-radius:14px 14px 0 0;transform:translateY(100%)}body #showroom.narrow #srDrw.open{transform:none}
body #showroom.narrow #srHdl{left:50%;top:-40px;transform:translateX(-50%);writing-mode:horizontal-tb;width:auto;min-height:40px!important;border-radius:10px 10px 0 0!important;padding:4px 16px!important}
#srToast{position:absolute;top:56px;left:50%;transform:translateX(-50%);background:rgba(8,20,40,.9);border:1px solid #5fd38a;border-radius:10px;padding:6px 12px;display:none}`;
// ---------- procedural models (generic). Parts carry userData.part = ext12 catalogue key ----------
const MAT={};const mat=c=>MAT[c]||(MAT[c]=new THREE.MeshStandardMaterial({color:c,roughness:.6,metalness:.35}));
function box(g,w,h,d,c,x,y,z,part){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;if(part){m.userData.part=part;ST.parts.push(m)}g.add(m);return m}
function cyl(g,r,h,c,x,y,z,part,rx=0,rz=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),mat(c));m.position.set(x,y,z);m.rotation.set(rx,0,rz);m.castShadow=true;if(part){m.userData.part=part;ST.parts.push(m)}g.add(m);return m}
function mast(g,H,base,top,y0,legs){const n0=g.children.length;const tagM=()=>{for(const m of g.children.slice(n0))if(!m.userData.part){m.userData.part='mast';ST.parts.push(m)}};const c='#c9a227',n=legs||4,pts=n==2?[[-1,0],[1,0]]:[[-1,-1],[1,-1],[1,1],[-1,1]];
 for(const [a,b] of pts){const x0=a*base/2,z0=b*base/2,x1=a*top/2,z1=b*top/2,L=Math.hypot(x1-x0,H,z1-z0),m=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,L,6),mat(c));m.position.set((x0+x1)/2,y0+H/2,(z0+z1)/2);m.lookAt(x1,y0+H,z1);m.rotateX(Math.PI/2);g.add(m)}
 for(let k=1;k<8;k++){const f=k/8,w=base+(top-base)*f;box(g,w,.15,n==2?.3:w,c,0,y0+H*f,0).material=mat(c);if(n==2)break}
 box(g,top+1,1,top+1,'#8a6d1f',0,y0+H+.5,0,'block');ST.parts.slice(-1);box(g,1.2,1.6,1,'#e0b020',0,y0+H*.55,0,'block');box(g,1.4,2.4,1.1,'#2b5f8a',0,y0+H*.3,0,'topdrive');tagM()}
function floorKit(g,y,s=1,np=2){box(g,6*s,.6*s,2*s,'#7a5c3a',0,y+.3*s,6*s,'pipe');for(let k=0;k<3;k++)box(g,4*s,2.2*s,2.6*s,'#4a6b8a',-10*s+k*4.4*s,y-2*s,-8*s,'mudsys');box(g,2.4*s,1.2*s,2.4*s,'#9aa0a6',-11*s,y+.6*s,-8*s,'mudsys');
 for(let k=0;k<2;k++)box(g,5*s,2.4*s,2.2*s,'#e0b020',10*s+0,y-2*s,-8*s+k*2.8*s,'gen');box(g,2.6*s,1.6*s,1.4*s,'#c1272d',-4*s,y-2.2*s,8*s,'accum');box(g,3*s,1.2*s,1*s,'#d38b1a',4*s,y-2.2*s,8*s,'choke');box(g,4*s,2*s,2.4*s,'#3b3f45',-6*s,y+1*s,0,'drawworks');cyl(g,.7*s,2*s,'#b08a2e',-6*s,y+2.4*s,0,'drawworks',Math.PI/2);
 cyl(g,.9*s,1.4*s,'#c1272d',0,y-1.4*s,0,'bop');box(g,2*s,.8*s,1.2*s,'#2a4d8f',0,y-2.4*s,0,'bop');
 for(let k=0;k<np;k++)box(g,3.2*s,1.6*s,2*s,'#2f6f3f',8*s,y+.8*s,(k-(np-1)/2)*3*s,'mudpump')}
function build(r){const g=new THREE.Group();ST.parts=[];const H=r.H;
 if(r.kind=='land'||r.kind=='heli'){const sub=r.id=='single'?3:7;box(g,14,sub,10,'#4d5560',0,sub/2,0,'mast');mast(g,H,r.id=='single'?3:9,2,sub,r.legs);floorKit(g,sub,1,r.id=='single'?1:2);
  if(r.kind=='heli')for(let k=0;k<6;k++)box(g,2.4,1.2,1.2,['#c96','#69c','#9c6'][k%3],-6+k*2.4,.6,7)}
 else if(r.kind=='truck'){box(g,16,2.2,3,'#d38b1a',0,1.6,0);box(g,3,3,3,'#e0e4e8',8.5,2.5,0);for(const x of[-6,-3,5,8])for(const z of[-1.6,1.6])cyl(g,.7,.6,'#222',x,.7,z,null,Math.PI/2);
  const m=new THREE.Group();m.position.set(-7,2.7,0);m.rotation.z=-.08;mast(m,H,2.4,1.4,0,2);g.add(m);cyl(g,.8,1.2,'#c1272d',-7,.6,-4,'bop');box(g,4,2,2.4,'#3b3f45',-1,3.7,0,'drawworks');box(g,3,1.6,2,'#2f6f3f',4,.8,-5,'mudpump')}
 else if(r.kind=='ctu'){box(g,12,2,3,'#c8ccd2',-5,1.8,0);cyl(g,2.6,2.6,'#2b5f8a',-6,4.4,0,'drawworks',Math.PI/2);box(g,2,3,2,'#c1272d',4,15,0,'topdrive');
  const t=new THREE.Mesh(new THREE.TorusGeometry(5,.08,6,24,Math.PI/1.6),mat('#ddd'));t.position.set(-1,12,0);t.rotation.z=.2;g.add(t);mast(g,13,4,3,0,4);cyl(g,.9,2.4,'#c1272d',4,1.2,0,'bop');box(g,3,1.6,2,'#2f6f3f',6,.8,-5,'mudpump')}
 else if(r.kind=='jackup'){box(g,40,6,34,'#59626e',0,24,0);for(const [x,z] of[[-17,-15],[17,-15],[0,15]]){cyl(g,1.6,60,'#c9a227',x,18,z)}box(g,10,4,10,'#6b7380',10,29,0);mast(g,H*0.7,9,2,31,4);floorKit(g,31,1,3);cyl(g,1,24,'#999',10,10,0)}
 else if(r.kind=='semi'){for(const z of[-12,12])box(g,60,5,8,'#d0b030',0,2.5,z);for(const x of[-22,22])for(const z of[-12,12])cyl(g,3,18,'#d0b030',x,12,z);box(g,54,6,32,'#59626e',0,24,0);mast(g,H*0.6,10,2,27,4);floorKit(g,27,1,4)}
 else if(r.kind=='ship'){const h=new THREE.Mesh(new THREE.BoxGeometry(110,10,22),mat('#2a3550'));h.position.y=5;g.add(h);box(g,12,14,20,'#e8eaee',-46,17,0);box(g,14,4,14,'#6b7380',0,12,0);mast(g,H*0.6,10,2,14,4);floorKit(g,14,1,5)}
 else if(r.kind=='frac'){for(let k=0;k<8;k++)for(const z of[-5,5]){box(g,9,2.6,2.6,'#2f6f3f',-18+k*5.2,2.2,z,'mudpump');cyl(g,.5,.5,'#222',-18+k*5.2,.5,z,null,Math.PI/2)}
  box(g,8,3,3,'#3b3f45',24,1.5,0);cyl(g,.4,6,'#c1272d',30,3,0,'bop');box(g,1.4,1,1.4,'#c1272d',30,6.5,0,'bop');box(g,40,.4,.4,'#999',3,1,0)}
 const bb=new THREE.Box3().setFromObject(g),s=new THREE.Vector3();bb.getSize(s);g.userData.size=Math.max(s.x,s.y,s.z);g.userData.cy=(bb.min.y+bb.max.y)/2;g.userData.parts=ST.parts;return g}
// ---------- view ----------
const q=()=>window.GX?.quality?.get?.()||'medium';
function setupGL(){const cv=ST.el.querySelector('canvas');const R=ST.ren=new THREE.WebGLRenderer({canvas:cv,antialias:q()!='low',alpha:true});
 R.setPixelRatio(Math.min(devicePixelRatio||1,q()=='low'?1:q()=='high'?2:1.5));R.shadowMap.enabled=q()=='high';
 const S=ST.scene=new THREE.Scene();ST.cam=new THREE.PerspectiveCamera(40,1,.5,2000);S.add(new THREE.HemisphereLight('#cfe8ff','#202830',1.2));
 const d=new THREE.DirectionalLight('#fff',1.6);d.position.set(60,120,80);d.castShadow=q()=='high';S.add(d);
 const tt=new THREE.Mesh(new THREE.CylinderGeometry(1,1.04,.04,64),new THREE.MeshStandardMaterial({color:'#1a2836',metalness:.6,roughness:.4}));tt.receiveShadow=true;ST.table=tt;S.add(tt);size()}
function size(){if(!ST.ren)return;ST.el.classList.toggle('narrow',innerWidth<600);const w=innerWidth,h=innerHeight;ST.ren.setSize(w,h,false);ST.cam.aspect=w/h;ST.cam.updateProjectionMatrix();frameCam()}
function frameCam(){const g=ST.grp;if(!g)return;const s=g.userData.size,fit=s/(2*Math.tan(ST.cam.fov*Math.PI/360))*(ST.cam.aspect<1?1.6/ST.cam.aspect*.75:1.15);
 ST.cam.position.set(0,g.userData.cy+s*.25,fit);ST.look=new THREE.Vector3(0,g.userData.cy*.85,0);ST.cam.lookAt(ST.look);ST.table.scale.set(s*.62,1,s*.62)}
function show(i,dir=0){const n=RIGS.length;i=(i+n)%n;ST.i=i;const r=RIGS[i];if(ST.old){ST.scene.remove(ST.old)}ST.old=dir?ST.grp:null;if(!dir&&ST.grp)ST.scene.remove(ST.grp);
 const g=ST.grp=build(r);g.rotation.y=ST.grp0rot??-.5;ST.scene.add(g);ST.tr=dir?{t:0,dir}:null;frameCam();
 if(!dir)g.position.x=0;rigCard(false);ST.camT=null;ST.lvl=null;if(ST.dOpen)renderList();card();const ds=ST.el.querySelectorAll('#srDots i');ds.forEach((d,k)=>{d.classList.toggle('on',k==i);d.setAttribute('aria-current',k==i)});ST.el.dataset.rig=r.id;if(ST.night)nightSet(true,true)}
const go=d=>show(ST.i+d,d);
function card(){const r=RIGS[ST.i],c=$('srCard');c.innerHTML=`<h3>${es(r.name)} <span class=srSim>SIM</span></h3><div class=ty>${es(r.type)}</div><table>
<tr><td>Hookload</td><td>${es(r.hook)}</td></tr><tr><td>Drawworks</td><td>${es(r.dw)}</td></tr><tr><td>Mast / derrick height</td><td>${es(r.mast)}</td></tr><tr><td>Mud pumps</td><td>${es(r.pumps)}</td></tr><tr><td>BOP rating</td><td>${es(r.bop)}</td></tr></table>
<div class=note>Generic typical values for this rig class (SIM). Not a specific real rig. Tap a part to see its exploded view.</div>`;c.dataset.rig=r.id}
// Rig card extras (generic class values, SIM): depth capacity, top drive, short description.
const RIGX={single:['≈ 2,500 m','Kelly / power swivel, 15 kN·m','Small land rig for shallow wells. Drills with single joints.'],
 triple:['≈ 6,000 m','500 t, 1,150 hp AC, 60 kN·m','Large land rig. Racks triple stands in the derrick for fast trips.'],
 heli:['≈ 4,500 m','350 t, 50 kN·m','Land rig in small modules. A helicopter moves it to remote sites.'],
 workover:['≈ 4,000 m (service)','Power swivel, 10 kN·m','Mast truck for well repair, pulling tubing and rods.'],
 ctu:['≈ 6,000 m (coil reach)','None — injector head 45 t','Runs a continuous steel tube into a live well. No joints to connect.'],
 jackup:['≈ 9,000 m · water ≤ 120 m','750 t, 2 × 1,150 hp, 75 kN·m','Offshore rig. Legs stand on the seabed and lift the hull above the waves.'],
 semi:['≈ 10,000 m · water ≤ 3,000 m','750 t, 85 kN·m','Floating offshore rig on pontoons and columns. Anchors or thrusters hold it.'],
 ship:['≈ 12,000 m · water ≤ 3,600 m','1,000 t, 2 × 1,150 hp, 100 kN·m','Ship with a derrick on the deck. Thrusters hold it over the well.'],
 frac:['n/a (stimulation)','None','Group of pump trucks, blenders and tanks. Pumps fluid to crack the rock.']};
function rcHTML(){const r=RIGS[ST.i],x=RIGX[r.id]||['—','—',''];return `<button id=srRcX aria-label=Close>✕</button><button id=srRcT aria-label="Show or hide details">▾</button><h3>${es(r.name)} <span class=srSim>SIM</span></h3><div class=ty>Type: ${es(r.kind=='heli'?'land':r.kind)} · ${es(r.type)}</div><table>
<tr data-f=hook><td>Hook load / derrick</td><td>${es(r.hook)}</td></tr><tr data-f=depth><td>Depth capacity</td><td>${es(x[0])}</td></tr><tr data-f=dw><td>Drawworks</td><td>${es(r.dw)}</td></tr><tr data-f=td><td>Top drive</td><td>${es(x[1])}</td></tr><tr data-f=pumps><td>Mud pumps</td><td>${es(r.pumps)}</td></tr><tr data-f=bop><td>BOP rating</td><td>${es(r.bop)}</td></tr></table>
<p class=ds>${es(x[2])}</p><div class=note>Generic values for this rig class (SIM). Not a real rig.</div><button id=srRcGo>▤ Assets and parts</button>`}
export function rigCard(on,k){const c=$('srRC');if(!c)return;ST.rc=!!on;ST.rcK=k||null;if(!on){c.hidden=true;return}c.innerHTML=rcHTML();c.dataset.rig=RIGS[ST.i].id;c.hidden=false;
 $('srRcX').onclick=()=>rigCard(false);$('srRcT').onclick=()=>{const col=!c.classList.contains('col');c.classList.toggle('col',col);ST.rcCol=col;$('srRcT').textContent=col?'▸':'▾';placeRC()};c.classList.toggle('col',!!ST.rcCol);$('srRcGo').onclick=()=>{const kk=ST.rcK;rigCard(false);drawer(true,kk)};placeRC()}
function anchorOf(g){const ms=ST.parts.filter(m=>m.userData.part=='mast'&&g.getObjectById(m.id));const bb=new THREE.Box3();g.updateMatrixWorld(true);(ms.length?ms:[g]).forEach(m=>bb.expandByObject(m));const c=bb.getCenter(new THREE.Vector3());c.y=bb.max.y;return g.worldToLocal(c)}
function rigRect(g){if(!g.userData.lbb){g.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(g),inv=g.matrixWorld.clone().invert();g.userData.lbb=bb.applyMatrix4(inv)}const B=g.userData.lbb,r={l:1e9,t:1e9,r:-1e9,b:-1e9};
 for(let i=0;i<8;i++){const v=new THREE.Vector3(i&1?B.max.x:B.min.x,i&2?B.max.y:B.min.y,i&4?B.max.z:B.min.z);g.localToWorld(v).project(ST.cam);const x=(v.x+1)/2*innerWidth,y=(1-v.y)/2*innerHeight;r.l=Math.min(r.l,x);r.r=Math.max(r.r,x);r.t=Math.min(r.t,y);r.b=Math.max(r.b,y)}return r}
// Card floats above the derrick top and never covers the rig: above the rig box, else beside it, else collapsed into the top band.
function placeRC(){const c=$('srRC'),g=ST.grp;if(!ST.rc||!c||!g)return;if(!g.userData.anchor)g.userData.anchor=anchorOf(g);const v=g.localToWorld(g.userData.anchor.clone());v.project(ST.cam);
 const ax=(v.x+1)/2*innerWidth,ay=(1-v.y)/2*innerHeight,R=ST.rcR=rigRect(g),m=8,top0=56,gap=10,W=innerWidth,H=innerHeight;c.classList.toggle('night',!!ST.night);
 const fit=()=>{const w=c.offsetWidth,h=c.offsetHeight;let x=Math.max(m,Math.min(W-w-m,ax-w/2)),y=Math.min(ay,R.t)-gap-h;if(y>=top0)return{x,y,mode:'above'};
  y=Math.max(top0,Math.min(H-h-m,ay-h/2));if(R.r+gap+w<=W-m)return{x:R.r+gap,y,mode:'right'};if(R.l-gap-w>=m)return{x:R.l-gap-w,y,mode:'left'};if(R.b+gap+h<=H-m)return{x,y:R.b+gap,mode:'below'};return null};
 let P=fit();if(!P&&ST.rcCol==null){c.classList.add('col');P=fit();if(P)ST.rcAuto=1;else c.classList.remove('col')}
 if(!P){const w=c.offsetWidth,h=c.offsetHeight;P={x:Math.max(m,Math.min(W-w-m,ax-w/2)),y:Math.max(top0,Math.min(R.t,ay)-gap-h),mode:'top'}}
 c.style.left=P.x+'px';c.style.top=P.y+'px';c.dataset.mode=P.mode;ST.rcA={x:ax,y:ay}}
function frame(now){if(!ST.el)return;if(window.GX&&!window.GX.showroom)window.GX.showroom=api();const dt=Math.min(.25,(now-(ST.last||now))/1000);ST.last=now;ST.t+=dt;const g=ST.grp;
 if(g)g.rotation.y+=dt*(ST.camT?.06:.25);
 if(ST.tr){const T=ST.tr;T.t=Math.min(1,T.t+dt/.45);const e=1-Math.pow(1-T.t,3),W=g.userData.size*1.3;g.position.x=T.dir*W*(1-e);if(ST.old)ST.old.position.x=-T.dir*W*e;if(T.t>=1){if(ST.old)ST.scene.remove(ST.old);ST.old=null;ST.tr=null;g.position.x=0}}
 if(ST.hiT&&now>ST.hiT){ST.parts.forEach(m=>m.material.emissive?.setHex?.(0));ST.hiT=0;if(ST.hk)hilite(ST.hk,0)}
 if(ST.camT){const c=ST.cam,T=ST.camT,k=Math.min(1,dt*4);c.position.lerp(T.p,k);ST.look.lerp(T.l,k);c.lookAt(ST.look)}
 placeRC();ST.ren.render(ST.scene,ST.cam);ST.raf=requestAnimationFrame(frame)}
function pad(){const p=[...(navigator.getGamepads?.()||[])].find(Boolean);if(!p)return;const b=i=>!!p.buttons[i]?.pressed,e=i=>b(i)&&!ST.prev[i];
 if(e(5)||e(15))go(1);if(e(4)||e(14))go(-1);if(e(0))use();if(e(1))close();ST.prev=p.buttons.map(x=>x.pressed)}
function key(e){if(!ST.el)return;const k=e.key;let h=true;if(k=='ArrowRight'||k=='d'||k=='D')go(1);else if(k=='ArrowLeft'||k=='a'||k=='A')go(-1);else if(k=='Escape'){if(ST.rc)rigCard(false);else if(ST.dOpen)back();else close()}else if(k=='Enter'&&(document.activeElement===document.body||!document.activeElement||document.activeElement.id=='srUse'))use();else h=false;if(h){e.preventDefault();e.stopPropagation()}}
function pick(x,y){const r=new THREE.Raycaster(),v=new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1);r.setFromCamera(v,ST.cam);const hit=r.intersectObjects(ST.parts,false)[0];return hit?.object||null}
export function tapPart(key,expOnly){if(!key)return false;const ws=window.GX?.ws;if(!ws||!ws.CAT?.[key])return toast('Exploded view is not ready yet'),false;close();
 ws.open('exp',key);if(!expOnly&&window.GX?.bom&&ws.setMode)try{ws.setMode('bom')}catch(e){}// guarded hook for bom.js (feat/bom)
 return true}
function ptr(){const cv=ST.el.querySelector('canvas');const dn=(x,y)=>{ST.dn={x,y,t:performance.now()};ST.mv={x,y}};
 cv.addEventListener('pointermove',e=>{if(ST.dn)ST.mv={x:e.clientX,y:e.clientY}});cv.addEventListener('touchmove',e=>{const t=e.touches[0];if(ST.dn&&t)ST.mv={x:t.clientX,y:t.clientY};e.preventDefault()},{passive:false});
 cv.addEventListener('pointerdown',e=>{if(e.pointerType!='touch'&&!ST.tch)dn(e.clientX,e.clientY)});cv.addEventListener('pointerup',e=>{if(e.pointerType!='touch'&&!ST.tch)up(e.clientX,e.clientY)});
 cv.addEventListener('touchstart',e=>{ST.tch=1;const t=e.changedTouches[0];dn(t.clientX,t.clientY);e.preventDefault()},{passive:false});cv.addEventListener('touchend',e=>{const t=e.changedTouches[0],m=ST.mv||{};up(Math.abs(m.x-ST.dn?.x)>Math.abs(t.clientX-ST.dn?.x)?m.x:t.clientX,m.y??t.clientY);e.preventDefault()},{passive:false});
 function up(cx,cy){const d=ST.dn;ST.dn=null;if(!d)return;const dx=cx-d.x,dy=cy-d.y;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.2)return go(dx<0?1:-1);
  if(Math.hypot(dx,dy)<12){const m=pick(cx,cy);if(m){m.material=m.material.clone();m.material.emissive=new THREE.Color('#2a6fff');ST.hiT=performance.now()+400;ST.lastPart=m.userData.part;rigCard(true,m.userData.part)}}}}
function toast(t){const e=$('srToast');if(!e)return;e.textContent=t;e.style.display='block';clearTimeout(e._t);e._t=setTimeout(()=>e.style.display='none',2600)}
export function use(){const r=RIGS[ST.i];ST.used=r.id;let ok=false;try{if(window.GX?.setDesign){window.GX.setDesign({...r.design,name:r.name+' (SIM)'});ok=true}}catch(e){console.warn('showroom use',e)}
 try{localStorage.setItem('dw_showroom_rig',r.id)}catch(e){}window.dispatchEvent(new CustomEvent('dw-rig',{detail:{id:r.id,name:r.name,applied:ok}}));close();
 window.GX?.ui?.toast?.(r.name+' loaded (SIM)');return ok}
export function open(i){if(ST.el)return;window.GX=window.GX||{};if(!window.GX.showroom)window.GX.showroom=api();if(!$('srCss')){const s=document.createElement('style');s.id='srCss';s.textContent=CSS;document.head.appendChild(s)}
 const el=ST.el=document.createElement('section');el.id='showroom';el.setAttribute('role','dialog');el.setAttribute('aria-label','Rig showroom');
 el.innerHTML=`<canvas></canvas><div id=srTop><b>🏁 Rig showroom <span class=srSim>SIM</span></b><button id=srClose aria-label="Close showroom">✕ Close</button></div><div id=srToast></div>
<div id=srCard></div><div id=srRC role=dialog aria-label="Rig card" hidden></div><aside id=srDrw aria-label="Rig assets"><button id=srHdl aria-label="Open or close the asset table" aria-expanded=false>☰ Assets</button><div id=srCrumb></div><div id=srList></div></aside><div id=srHint>← → or LB / RB: change rig · Enter: use · Esc: close<br>Tap a part for its exploded view</div>
<div id=srBar><div id=srNav><button id=srPrev aria-label="Previous rig">◀</button><div id=srDots>${RIGS.map((r,k)=>`<i data-k=${k} title="${es(r.name)}"></i>`).join('')}</div><button id=srNext aria-label="Next rig">▶</button></div><button id=srNight aria-label="Day or night">☾ Night</button><button id=srUse>✔ Use this rig</button></div>`;
 document.body.appendChild(el);$('srClose').onclick=close;$('srPrev').onclick=()=>go(-1);$('srNext').onclick=()=>go(1);$('srUse').onclick=use;$('srNight').onclick=()=>nightSet(!ST.night);$('srHdl').onclick=()=>drawer(!ST.dOpen);
 el.querySelectorAll('#srDots i').forEach(d=>d.onclick=()=>{const k=+d.dataset.k;if(k!=ST.i)show(k,k>ST.i?1:-1)});
 setupGL();ptr();let st=i;if(st==null)try{st=Math.max(0,RIGS.findIndex(r=>r.id==localStorage.getItem('dw_showroom_rig')))}catch(e){st=0}show(st||0);nightInit();
 addEventListener('keydown',key,true);addEventListener('resize',size);const p=[...(navigator.getGamepads?.()||[])].find(Boolean);ST.prev=p?p.buttons.map(x=>x.pressed):{};ST.last=0;ST.raf=requestAnimationFrame(frame);ST.pi=setInterval(pad,50)}
export function close(){if(!ST.el)return;try{ST.N?.dispose(ST.scene)}catch(e){}ST.N=null;ST.night=false;cancelAnimationFrame(ST.raf);clearInterval(ST.pi);removeEventListener('keydown',key,true);removeEventListener('resize',size);try{ST.ren.dispose()}catch(e){}ST.el.remove();ST.el=null;ST.dOpen=false;ST.camT=null;ST.lvl=null;ST.grp=null;ST.old=null}
export function init(){if(typeof document=='undefined'||$('btnShow'))return;const hud=$('hud');if(hud){const b=document.createElement('button');b.id='btnShow';b.textContent='🏁 Showroom';b.title='Rig showroom (SIM)';b.onclick=()=>open();hud.appendChild(b)}
 window.GX=window.GX||{};window.GX.showroom=api()}

// ---------- A > B > C hierarchy: rig > child assets > components. C rows come from the ext12 catalogue (same order as the BOM). ----------
// Built on feat/bom RIG (rig > assets > components > BOM lines). Guarded: falls back to the ext12 catalogue if bom_data.js is missing.
let RIGD=null;import('./bom_data.js?v=1').then(m=>{RIGD=m.RIG||null;if(ST.dOpen)renderList()}).catch(()=>{RIGD=null});
const C3=(...a)=>a.map(n=>({n}));
const RID={mudpump:'mudpumps',pipe:'pipehandling',mudsys:'mudtanks',gen:'generators',accum:'accumulator'};
const rigA=k=>{const R=window.GX?.bom?.RIG||RIGD;if(!R)return null;const id=RID[k]||k;return window.GX?.bom?.asset?.(id)||R.assets.find(a=>a.id==id&&a.group!='downhole')||null};
export const ASSET={
 mast:{name:'Mast / substructure',type:'Structure',spec:r=>r.mast+' · '+r.hook,comp:C3('Mast legs and braces','Crown platform','Racking board','Drill floor','Substructure boxes')},
 block:{name:'Crown & travelling block',type:'Hoisting',spec:r=>'Rated '+r.hook,cat:'block'},
 topdrive:{name:'Top drive',type:'Rotary',spec:()=>'Up to 250 rpm',cat:'topdrive'},
 drawworks:{name:'Drawworks',type:'Hoisting',spec:r=>r.dw,cat:'drawworks'},
 mudpump:{name:'Mud pumps',type:'Circulating',spec:r=>r.pumps,cat:'mudpump'},
 bop:{name:'BOP stack',type:'Well control',spec:r=>r.bop,cat:'bop'},
 pipe:{name:'Pipe handling',type:'Tubulars',spec:()=>'Catwalk + racks',comp:C3('Catwalk machine','Pipe racks','Iron roughneck','Power slips')},
 mudsys:{name:'Mud system (tanks / shakers)',type:'Circulating',spec:()=>'≈ 200 m³ active + reserve',comp:C3('Shale shakers','Degasser','Desander / desilter','Active tanks','Mixing hopper')},
 gen:{name:'Generators',type:'Power',spec:()=>'Diesel gensets, 600 V AC',comp:C3('Diesel engine','Alternator','Switchgear / VFD house','Fuel tank')},
 accum:{name:'Accumulator (koomey)',type:'Well control',spec:()=>'3,000 psi, API 16D',comp:C3('Accumulator bottles','Electric pump','Air pumps','Control manifold','Remote panel')},
 choke:{name:'Choke manifold',type:'Well control',spec:r=>r.bop,comp:C3('Adjustable chokes','Gate valves','Pressure gauges','Mud-gas separator line')}};
const keysOf=()=>{const seen=new Set();for(const m of ST.parts)seen.add(m.userData.part);return Object.keys(ASSET).filter(k=>seen.has(k))};
// C rows: {n, i, lines:[{no,qty,spec,fn,part,ws}]}. part:null = no workshop 3D model.
export function comps(k){const A=ASSET[k];if(!A)return[];const R=rigA(k),CAT=window.GX?.ws?.CAT;
 if(R)return R.components.map((c,i)=>({n:c.label||c.lines[0]?.name||(CAT?.[c.lines[0]?.ws]?.parts?.[c.lines[0]?.part]?.n)||c.id,i,id:c.id,lines:c.lines}));
 const cat=A.cat&&CAT?.[A.cat];
 if(cat)return cat.parts.map((p,i)=>({n:p.n,i,lines:[{no:1,qty:1,spec:'Generic',fn:p.ds,part:i,ws:A.cat}]}));
 return (A.comp||[]).map((c,i)=>({n:c.n,i,lines:[{no:1,qty:1,spec:'Generic',fn:'',part:null}]}))}
function bomCount(k){return comps(k).reduce((t,c)=>t+c.lines.length,0)}
const nameOf=k=>rigA(k)?.label||ASSET[k].name;
function hilite(k,on){for(const m of ST.parts){const x=m.userData.part==k&&on;if(x&&!m.userData.own){m.material=m.material.clone();m.userData.own=1}if(m.userData.own)m.material.emissive.setHex(x?0x2a6fff:0)}}
function zoom(k){const ms=ST.parts.filter(m=>m.userData.part==k);if(!ms.length){ST.camT=null;frameCam();return}const bb=new THREE.Box3();ms.forEach(m=>bb.expandByObject(m));
 const c=bb.getCenter(new THREE.Vector3()),sz=Math.max(4,bb.getSize(new THREE.Vector3()).length());ST.look=ST.look||c.clone();ST.camT={p:c.clone().add(new THREE.Vector3(sz*.6,sz*.4,sz*1.3)),l:c}}
export function drawer(open,k){ST.dOpen=open;$('srDrw').classList.toggle('open',open);$('srHdl').setAttribute('aria-expanded',open);if(!open){if(ST.hk)hilite(ST.hk,0);ST.lvl=null;ST.camT=null;frameCam();return}
 if(k&&ASSET[k])selB(k);else renderList()}
export function selB(k){if(ST.hk&&ST.hk!=k)hilite(ST.hk,0);ST.lvl={b:k,c:null};ST.hk=k;hilite(k,1);zoom(k);renderList()}
export function selC(i){const L=ST.lvl;if(!L)return;L.c=i;hilite(L.b,1);zoom(L.b);renderList()}
export function back(){const L=ST.lvl;if(L?.c!=null){L.c=null;renderList()}else if(L){hilite(L.b,0);ST.lvl=null;ST.hk=null;ST.camT=null;frameCam();renderList()}else drawer(false)}
function renderList(){const r=RIGS[ST.i],L=ST.lvl,A=L&&ASSET[L.b],cs=L?comps(L.b):[],C=L&&L.c!=null?cs[L.c]:null;
 $('srCrumb').innerHTML=`<button id=srBack aria-label=Back>◀ Back</button><a data-l=0>${es(r.name)}</a>`+(A?` › <a data-l=1>${es(nameOf(L.b))}</a>`:'')+(C?` › <b>${es(C.n)}</b>`:'');
 $('srBack').onclick=back;$('srCrumb').querySelectorAll('a').forEach(a=>a.onclick=()=>{if(a.dataset.l=='0'){ST.lvl&&hilite(ST.lvl.b,0);ST.lvl=null;ST.hk=null;ST.camT=null;frameCam();renderList()}else{ST.lvl.c=null;renderList()}});
 if(C){const L3=C.lines,m3=L3.find(l=>l.part!=null&&l.ws&&window.GX?.ws?.CAT?.[l.ws]);
  $('srList').innerHTML=`<div id=srDet><h3 style="margin:0 0 4px">${es(C.n)} <span class=srSim>SIM</span></h3><div>Part of: ${es(nameOf(L.b))}</div>
<table><tr><th>No.</th><th>Qty</th><th>Material / spec</th><th>Function</th></tr>${L3.map(l=>`<tr class=ln><td>${es(l.no??'')}</td><td>${es(l.qty)}</td><td>${es(l.spec||'—')}${l.part==null?' <i style="opacity:.6">(no 3D model)</i>':''}</td><td>${es(l.fn||'—')}</td></tr>`).join('')}</table>
<div class=row>${m3?`<button id=srExp>💥 Exploded view</button><button id=srBom>📋 BOM</button>`:'<span style="opacity:.7">No workshop 3D model for this component.</span>'}</div></div>`;
  if(m3){$('srExp').onclick=()=>{tapPart(m3.ws,true);try{window.GX.ws.showPart(m3.part)}catch(e){}};$('srBom').onclick=()=>{tapPart(m3.ws);try{window.GX.ws.showPart(m3.part)}catch(e){}}}return}
 const ks=keysOf();$('srList').innerHTML=`<table><tr><th>Asset</th><th>Type</th><th>Key spec</th><th>BOM</th></tr>`+ks.map(k=>{const a=ASSET[k],open=L?.b==k;
  return `<tr class="b${open?' on':''}" data-k="${k}"><td>${open?'▾':'▸'} ${es(nameOf(k))}</td><td>${es(a.type)}</td><td>${es(a.spec(r))}</td><td>${bomCount(k)}</td></tr>`+(open?comps(k).map(c=>`<tr class=c data-c="${c.i}"><td>${es(c.n)}</td><td colspan=2>${es(c.lines[0]?.spec||'')}</td><td>${c.lines.length}</td></tr>`).join(''):'')}).join('')+`</table><div style="font-size:11px;opacity:.6;padding:6px">Generic SIM values. Tap a row to zoom; tap again to close.</div>`;
 $('srList').querySelectorAll('tr.b').forEach(tr=>{const k=tr.dataset.k;tr.onmouseenter=()=>{if(!ST.lvl)hilite(k,1)};tr.onmouseleave=()=>{if(!ST.lvl)hilite(k,0)};tr.onclick=()=>{if(ST.lvl?.b==k)back();else selB(k)}});
 $('srList').querySelectorAll('tr.c').forEach(tr=>tr.onclick=()=>selC(+tr.dataset.c))}
function api(){return {ST,RIGS,ASSET,open,close,go,show,use,tapPart,pick,isOpen:()=>!!ST.el,init,comps,drawer,rigCard,rigRect,selB,selC,back,nightSet,isNight:()=>!!ST.night}}
if(typeof window!='undefined'){window.GX=window.GX||{};window.GX.showroom=window.GX.showroom||api()}

// ---------- Day / night (feat/night). Guarded: does nothing if night.js is not there. ----------
async function nightMod(){let N=window.GX?.night;if(!N){try{N=(await import('./night.js?v=n1')).night}catch(e){N=null}}if(N){try{N.useThree?.(THREE)}catch(e){}}return N}
export async function nightSet(on,instant){const N=await nightMod();ST.night=!!on;const b=$('srNight');if(b){b.textContent=on?'☀ Day':'☾ Night';b.classList.toggle('on',!!on)}
 if(!N||!ST.scene||!ST.grp)return false;ST.N=N;try{if(instant)N.dispose(ST.scene);await N.set(!!on,ST.scene,ST.grp,{ren:ST.ren,quality:q(),instant:!!instant})}catch(e){console.error('showroom night',e);return false}return true}
export function nightInit(){let on=false;try{const N=window.GX?.night;on=N?.isOn?N.isOn():localStorage.getItem('dw_night')=='1'}catch(e){}if(on)nightSet(true,true)}
