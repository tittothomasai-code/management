import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import * as PH from './physics.js';
const {FT,R}=PH;
const S=PH.newState();window.S=S;
// ---------- renderer / scene ----------
const ren=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});ren.setPixelRatio(Math.min(devicePixelRatio,2));ren.setSize(innerWidth,innerHeight);
ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;ren.toneMapping=THREE.ACESFilmicToneMapping;ren.outputColorSpace=THREE.SRGBColorSpace;document.body.appendChild(ren.domElement);
const scene=new THREE.Scene();
// procedural sky gradient
{const c=document.createElement('canvas');c.width=2;c.height=256;const g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#2d5d9a');gr.addColorStop(0.55,'#9cc3e6');gr.addColorStop(1,'#e9dcc4');g.fillStyle=gr;g.fillRect(0,0,2,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;scene.background=t}
scene.fog=new THREE.Fog(0xcfd8e0,180,600);
const cam=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,0.1,2000);cam.position.set(60,40,70);
const ctl=new OrbitControls(cam,ren.domElement);ctl.target.set(0,18,0);ctl.enableDamping=true;ctl.update();
scene.add(new THREE.HemisphereLight(0xcfe3ff,0x6b5a40,0.9));
const sun=new THREE.DirectionalLight(0xfff1dc,2.2);sun.position.set(60,100,40);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,far:300});scene.add(sun);
const M=(c,m=0.2,r=0.6,o={})=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r,...o});
const mat={steel:M(0x8a9199,0.8,0.35),paint:M(0xd23b2a,0.3,0.5),yellow:M(0xe0b020,0.3,0.5),blue:M(0x2c5d9e,0.3,0.5),dark:M(0x2a2d31,0.6,0.5),pipe:M(0x6d6f73,0.9,0.3),white:M(0xe8e8e8,0.1,0.6),hose:M(0x151515,0,0.8),gravel:M(0x9b8f7c,0,0.95)};
function box(w,h,d,m,x=0,y=0,z=0,par){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;par&&par.add(o);return o}
function cyl(r1,r2,h,m,x=0,y=0,z=0,par,seg=20){const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;par&&par.add(o);return o}
function beam(a,b,r,m,par){const v=new THREE.Vector3().subVectors(b,a),o=cyl(r,r,v.length(),m,0,0,0,par,8);o.position.copy(a).addScaledVector(v,0.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize());return o}
// ---------- terrain (procedural noise) ----------
const groundMat=M(0x7d8a55,0,0.95,{transparent:true});
{const g=new THREE.PlaneGeometry(800,800,120,120);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),d=Math.hypot(x,z);const h=d<70?0:(Math.sin(x*0.03)*Math.cos(z*0.025)*4+Math.sin(x*0.011+z*0.017)*6)*Math.min(1,(d-70)/60);p.setY(i,h-0.05)}g.computeVertexNormals();const t=new THREE.Mesh(g,groundMat);t.receiveShadow=true;scene.add(t);window.terrain=t}
const pad=box(80,0.3,70,M(0xa89a82,0,0.95,{transparent:true}),-5,0.1,8,scene);
// ---------- entity-component ----------
const ents=[];function entity(name,obj,opts={}){const e={name,obj,update:opts.update||(()=>{}),panel:opts.panel,anchor:opts.anchor||new THREE.Vector3(0,5,0),dbl:opts.dbl};obj.traverse(o=>o.userData.ent=e);scene.add(obj);ents.push(e);return e}
const FLOOR=8;
// ---------- substructure + mast ----------
const rigG=new THREE.Group();
for(const x of[-5,5])for(const z of[-5,5])box(0.6,FLOOR,0.6,mat.paint,x,FLOOR/2,z,rigG);
box(12,0.4,12,mat.dark,0,FLOOR,0,rigG);
const MH=40,mt=FLOOR,legs=[[-3,-3],[3,-3],[-3,3],[3,3]].map(([x,z])=>[new THREE.Vector3(x,mt,z),new THREE.Vector3(x*0.35,mt+MH,z*0.35)]);
legs.forEach(([a,b])=>beam(a,b,0.25,mat.yellow,rigG));
for(let y=0;y<MH;y+=4){const f=y/MH;for(let i=0;i<4;i++){const [a1,b1]=legs[i],[a2,b2]=legs[(i+1)%4];const p1=a1.clone().lerp(b1,f),p2=a2.clone().lerp(b2,f),q2=a2.clone().lerp(b2,(y+4)/MH);beam(p1,p2,0.08,mat.yellow,rigG);if(i!=3)beam(p1,q2,0.06,mat.yellow,rigG)}}
box(3,1,3,mat.yellow,0,mt+MH+0.5,0,rigG);// crown
for(let i=0;i<4;i++){const s=cyl(0.6,0.6,0.3,mat.steel,0,mt+MH+1.3,-0.9+i*0.6,rigG);s.rotation.x=Math.PI/2}
box(2,0.2,2,mat.steel,0,mt+MH-12,-3,rigG);// monkey board
// rotary table
const rotary=cyl(1.2,1.2,0.5,mat.dark,0,FLOOR+0.45,0,rigG);
// casing below floor
cyl(0.35,0.35,FLOOR,mat.steel,0,FLOOR/2,0,rigG);
entity('Rig mast',rigG,{anchor:new THREE.Vector3(0,FLOOR+MH,0),panel:()=>({title:'Mast & crown',rows:[['Hookload klbf',()=>S.hook.toFixed(1)],['Bit depth ft',()=>PH.bitDepth(S).toFixed(0)],['MD ft',()=>S.md.toFixed(0)]]})});
// ---------- travelling block, drill line, top drive ----------
const blk=new THREE.Group();box(1.4,2.2,1,mat.yellow,0,1.1,0,blk);cyl(0.15,0.15,1.2,mat.steel,0,-0.4,0,blk);
const td=new THREE.Group();box(1.6,2.6,1.4,mat.paint,0,0,0,td);cyl(0.5,0.5,1.4,mat.dark,0,1.9,0,td);box(0.6,0.5,1.2,mat.steel,0,1.2,0.9,td);// gooseneck
const quill=new THREE.Group();cyl(0.18,0.18,1.4,mat.steel,0,-2,0,quill);box(0.5,0.12,0.12,mat.yellow,0,-1.8,0,quill);td.add(quill);
const tdAll=new THREE.Group();tdAll.add(blk);blk.position.y=3.3;tdAll.add(td);box(0.4,1,0.3,mat.steel,1.5,0,0,tdAll);// rail dolly
const lineMat=new THREE.LineBasicMaterial({color:0x222222});const lines=new THREE.Group();scene.add(lines);
const dlines=[];for(let i=0;i<4;i++){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);const l=new THREE.Line(g,lineMat);lines.add(l);dlines.push(l)}
const tdEnt=entity('Top drive',tdAll,{anchor:new THREE.Vector3(0,3,0),panel:()=>({title:'Top drive + block',rows:[['RPM',()=>S.td.rpm.toFixed(0)],['Torque ft-lbf',()=>S.td.torque.toFixed(0)],['Quill height m',()=>S.dw.quill.toFixed(1)],['Connected',()=>S.connected?'yes':'NO']],
 html:`RPM cmd <input type=range min=0 max=180 data-k="td.cmd"><br><button data-a="rotate">Rotate</button><button data-a="slide">Slide</button> TF° <input type=range min=0 max=359 data-k="tf" style="width:70px"><br><button data-a="autosteer">Auto-steer on/off</button>`})});
// ---------- drawworks ----------
const dwG=new THREE.Group();dwG.position.set(0,FLOOR+0.2,-8);box(6,2.4,2.6,mat.blue,0,1.2,0,dwG);const drum=new THREE.Group();dwG.add(drum);drum.position.set(0,2.2,1.6);
{const d=cyl(0.9,0.9,3.2,mat.steel,0,0,0,drum);d.rotation.z=Math.PI/2;for(let i=0;i<8;i++){const s=box(3.3,0.12,0.12,mat.dark,0,0,0,drum);s.position.set(0,0.92*Math.cos(i*Math.PI/4),0.92*Math.sin(i*Math.PI/4))}}
for(const x of[-2.2,2.2]){const b=cyl(1.2,1.2,0.25,mat.dark,x,2.2,1.6,dwG);b.rotation.z=Math.PI/2}
const dwEnt=entity('Drawworks',dwG,{anchor:new THREE.Vector3(0,4,0),panel:()=>({title:'Drawworks',rows:[['Mode',()=>S.dw.mode],['WOB klbf',()=>S.wob.toFixed(1)],['Hookload klbf',()=>S.hook.toFixed(1)],['Brake',()=>S.faults.brake_fade?'FADE':'ok']],
 html:`<button data-a="hoist">Hoist</button><button data-a="lower">Lower</button><button data-a="hold">Hold</button><button data-a="auto">Auto-drill</button><br>WOB set <input type=range min=0 max=45 data-k="dw.wobSet">`})});
// ---------- slips ----------
const slG=new THREE.Group();slG.position.set(0,FLOOR+0.75,0);const slipParts=[];for(let i=0;i<3;i++){const p=new THREE.Group();const b=box(0.35,0.5,0.25,mat.steel,0,0,0.45,p);p.rotation.y=i*2*Math.PI/3;slG.add(p);slipParts.push(b)}
entity('Power slips',slG,{anchor:new THREE.Vector3(0,1.5,0),panel:()=>({title:'Power slips',rows:[['State',()=>S.slips?'SET':'released'],['Stick-up m',()=>S.stickup.toFixed(1)]],html:`<button data-a="slipset">Set</button><button data-a="sliprel">Release</button>`})});
// ---------- iron roughneck ----------
const rnG=new THREE.Group();rnG.position.set(3.5,FLOOR+0.2,3.5);box(0.8,0.6,0.8,mat.dark,0,0.3,0,rnG);const rnArm=new THREE.Group();rnG.add(rnArm);rnArm.position.y=0.6;box(0.3,1.6,0.3,mat.yellow,0,0.8,0,rnArm);const rnHead=box(1,1.2,1,mat.yellow,0,1.6,0,rnArm);
entity('Iron roughneck',rnG,{anchor:new THREE.Vector3(0,3,0),panel:()=>({title:'Iron roughneck',rows:[['Position',()=>S.rough?'at well centre':'parked']]})});
// ---------- catwalk + pipe rack ----------
const cwG=new THREE.Group();box(22,0.8,1.6,mat.blue,18,0.8,0,cwG);const ramp=box(14,0.3,1.4,mat.steel,0,0,0,cwG);ramp.position.set(9,4.6,0);ramp.rotation.z=-Math.atan2(7.4,13);
for(let i=0;i<8;i++)cyl(0.12,0.12,9.1,mat.pipe,18,0.6+(i>>2)*0.25,3+(i%4)*0.3,cwG).rotation.z=Math.PI/2;
const joint=cyl(0.12,0.12,9.1,mat.pipe,0,0,0,cwG);// moving joint (shown 1 single scaled; stand = 3 joints)
entity('Catwalk',cwG,{anchor:new THREE.Vector3(18,3,0),panel:()=>({title:'Catwalk + pipe rack',rows:[['State',()=>S.catwalk?'delivering':'idle']]})});
// drill string above floor + new stand
const strTop=cyl(0.12,0.12,1,mat.pipe,0,0,0,scene);const newStand=cyl(0.12,0.12,27.4,mat.pipe,0,0,0,scene);
// ---------- pumps ----------
const pumps=[];
function makePump(i){const g=new THREE.Group();g.position.set(-28,0.3,4+i*9);
 const parts={};const P=(n,o)=>{parts[n]=o;o.userData.home=o.position.clone();o.userData.part=n;return o};
 box(9,0.4,4,mat.dark,0,0.2,0,g);
 P('Power end',box(3,2.4,2.8,mat.blue,-2.5,1.6,0,g));
 const crank=new THREE.Group();crank.position.set(-2.5,1.6,1.6);g.add(crank);P('Crankshaft',crank);
 const wheel=cyl(1.1,1.1,0.25,mat.steel,0,0,0,crank);wheel.rotation.x=Math.PI/2;box(2.2,0.25,0.3,mat.dark,0,0,0.15,crank);
 const pist=[];for(let k=0;k<3;k++){const z=-0.9+k*0.9;const rod=new THREE.Group();g.add(rod);rod.position.set(0,1.6,z);cyl(0.12,0.12,2.2,mat.steel,0,0,0,rod).rotation.z=Math.PI/2;cyl(0.28,0.28,0.4,mat.white,1.1,0,0,rod).rotation.z=Math.PI/2;P('Piston + liner '+(k+1),rod);pist.push(rod)}
 P('Fluid end',box(1.8,1.8,3,mat.paint,2.3,1.6,0,g));
 for(let k=0;k<3;k++){P('Discharge valve '+(k+1),cyl(0.22,0.22,0.4,mat.steel,2.3,2.7,-0.9+k*0.9,g));P('Suction valve '+(k+1),cyl(0.22,0.22,0.4,mat.steel,3.3,1.0,-0.9+k*0.9,g)).rotation.z=Math.PI/2}
 P('Pulsation dampener',(()=>{const s=new THREE.Mesh(new THREE.SphereGeometry(0.55,24,16),mat.yellow);s.position.set(2.3,3.4,0.9);s.castShadow=true;g.add(s);return s})());
 P('Pop-off valve',cyl(0.12,0.12,0.6,mat.paint,2.3,3.2,-0.9,g));
 P('Suction manifold',cyl(0.25,0.25,3.4,mat.steel,3.6,0.7,0,g)).rotation.x=Math.PI/2;
 const tags=[];const st=S.pumps[i];
 const e=entity('Mud pump '+(i+1),g,{anchor:new THREE.Vector3(0,4.5,0),
  update(){const th=st.theta;crank.rotation.z=-th;pist.forEach((r,k)=>{r.position.x=r.userData.home.x+0.55*Math.cos(th-2*Math.PI*k/3)+(e.explode||0)*0});
   const ex=e.ex=(e.ex||0)+(((e.explode?1:0)-(e.ex||0))*0.1);let j=0;for(const [n,o] of Object.entries(parts)){const h=o.userData.home;const dir=new THREE.Vector3(h.x*0.5,h.y-1.2,h.z*1.3+((j++%3)-1)*0.6);o.position.set(h.x+dir.x*ex*1.2+(n.startsWith('Piston')?0.55*Math.cos(th-2*Math.PI*(+n.slice(-1)-1)/3):0),h.y+dir.y*ex*1.5,h.z+dir.z*ex*1.5)}},
  panel:()=>({title:'Mud pump '+(i+1)+(st.tripped?' TRIPPED':''),rows:[['SPM',()=>st.spm.toFixed(0)],['Flow gpm',()=>st.flow.toFixed(0)],['Strokes',()=>st.strokes.toFixed(0)],['Discharge psi',()=>S.spp.toFixed(0)]],
   html:`<button data-a="pon${i}">On</button><button data-a="poff${i}">Off</button><button data-a="preset${i}">Reset pop-off</button><br>SPM cmd <input type=range min=0 max=140 data-k="pumps.${i}.cmd"><br><small>Double-click pump: exploded view</small>`}),
  dbl(){e.explode=!e.explode;showTags(e.explode?parts:null)}});
 e.parts=parts;pumps.push(e)}
makePump(0);makePump(1);
let tagEls=[];function showTags(parts){tagEls.forEach(t=>t.el.remove());tagEls=[];if(!parts)return;for(const [n,o] of Object.entries(parts)){const el=document.createElement('div');el.className='tag';el.textContent=n;document.body.appendChild(el);tagEls.push({el,o})}}
// ---------- flow lines with particles ----------
const lp=(...a)=>new THREE.Vector3(...a);
const manifold=lp(-12,1.2,6);
const curves=[ new THREE.CatmullRomCurve3([lp(-24.5,2.2,4),lp(-18,1.2,4),manifold]), new THREE.CatmullRomCurve3([lp(-24.5,2.2,13),lp(-18,1.2,13),lp(-14,1.2,8),manifold]),
 new THREE.CatmullRomCurve3([manifold,lp(-6,1.2,4),lp(-3.6,1.5,3.6),lp(-3.6,FLOOR,3.6)],false,'catmullrom',0.1), new THREE.LineCurve3(lp(-3.6,FLOOR,3.6),lp(-2.6,FLOOR+30,2.6))];
const lineSegs=curves.map(c=>{const m=new THREE.Mesh(new THREE.TubeGeometry(c,40,0.18,8),mat.steel);m.castShadow=true;scene.add(m);return m});
let hoseMesh=null;const hoseCurve=()=>{const top=lp(-2.6,FLOOR+30,2.6),gn=lp(0,FLOOR+S.dw.quill+3.2,0.9);const mid=top.clone().lerp(gn,0.5);mid.y=Math.min(top.y,gn.y)-6;return new THREE.CatmullRomCurve3([top,lp(-2.4,top.y-1.5,2.4),mid,gn])};
// particles
const NP=60,pts=[];const allCurves=()=>[...curves,hoseC];let hoseC=hoseCurve();
const pGeom=new THREE.BufferGeometry();const pPos=new Float32Array(NP*5*3),pCol=new Float32Array(NP*5*3);pGeom.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeom.setAttribute('color',new THREE.BufferAttribute(pCol,3));
const pMesh=new THREE.Points(pGeom,new THREE.PointsMaterial({size:0.45,vertexColors:true,depthTest:false,transparent:true}));pMesh.renderOrder=5;scene.add(pMesh);
const pu=Array.from({length:NP*5},(_,i)=>Math.random());
const col=new THREE.Color();function pcol(psi){col.setHSL(0.66-0.66*Math.min(1,psi/4000),1,0.55);return col}
const lineEnt={name:'Standpipe + hose',obj:new THREE.Group(),update(){},anchor:lp(-3,FLOOR+22,3),panel:()=>({title:'Standpipe + rotary hose',rows:[['SPP psi',()=>S.spp.toFixed(0)],['Flow in gpm',()=>S.Q.toFixed(0)],['Manifold loss',()=>S.prof.man.toFixed(0)],['Surface line loss',()=>S.prof.surf.toFixed(0)]],html:'<small>particle speed = flow; colour = pressure (blue low, red high)</small>'})};
lineSegs.forEach(m=>m.userData.ent=lineEnt);lineEnt.obj.position.set(0,0,0);ents.push(lineEnt);
// ---------- underground: strata, well, string, BHA ----------
const UG=new THREE.Group();scene.add(UG);const WS=0.03;// m per ft (well geometry scale)
const W=(n,e,tvd)=>new THREE.Vector3(e*WS,-tvd*WS,-n*WS);
const strata=[[0,15,0x8a6f4d],[15,40,0xa58a5c],[40,70,0x7b6a58],[70,120,0x5d5248]];
const strataG=new THREE.Group();strata.forEach(([a,b,c])=>{const m=box(90,b-a,60,new THREE.MeshStandardMaterial({color:c,transparent:true,opacity:0.08,depthWrite:false}),20,-(a+b)/2,-20,strataG);m.castShadow=false});strataG.visible=false;scene.add(strataG);
{const pp=PH.planPath().map(p=>W(p[3],p[4],p[5]));const g=new THREE.BufferGeometry().setFromPoints(pp);const l=new THREE.Line(g,new THREE.LineDashedMaterial({color:0x33ff66,dashSize:1,gapSize:0.6}));l.computeLineDistances();UG.add(l)}
let boreMesh=null,strMesh=null,lastBuild=-1;const bha=new THREE.Group();UG.add(bha);
const motorMesh=cyl(0.35,0.35,1.6,mat.paint,0,0.8,0,bha);const bitMesh=cyl(0.45,0.15,0.5,M(0xd4af37,0.9,0.3),0,-0.25,0,bha);
const tipPath=()=>{const s=S.surveys,l=s[s.length-1];const p=PH.minCurv(l.slice(3),l[0],l[1],l[2],S.md,S.inc,S.azi);return [...s.map(q=>W(q[3],q[4],q[5])),W(...p)]};
function buildWell(){const pts=tipPath();if(pts.length<2)return;const c=new THREE.CatmullRomCurve3(pts);
 boreMesh&&(UG.remove(boreMesh),boreMesh.geometry.dispose());strMesh&&(UG.remove(strMesh),strMesh.geometry.dispose());
 boreMesh=new THREE.Mesh(new THREE.TubeGeometry(c,Math.max(8,pts.length*2),0.9,10),new THREE.MeshStandardMaterial({color:0xff8c3a,emissive:0x552200,transparent:true,opacity:0.55,depthWrite:false,side:THREE.DoubleSide}));UG.add(boreMesh);
 // string ends at bit depth (off bottom when hoisted)
 const bd=PH.bitDepth(S),f=Math.max(0.01,Math.min(1,bd/S.md));const sp=[];for(let i=0;i<=60;i++)sp.push(c.getPoint(f*i/60));
 strMesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp),80,0.15,6),mat.pipe);UG.add(strMesh);
 const tip=c.getPoint(f),tan=c.getTangent(f);bha.position.copy(tip);bha.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),tan.normalize());}
const wellEnt={name:'Well',obj:bha,update(){},anchor:new THREE.Vector3(0,0,0),panel:()=>({title:'Well + BHA (directional)',rows:[['MD ft',()=>S.md.toFixed(0)],['TVD ft',()=>S.pos[2].toFixed(0)],['Inc / Azi °',()=>S.inc.toFixed(1)+' / '+S.azi.toFixed(0)],['Mode / TF°',()=>S.mode+' / '+S.tf.toFixed(0)],['ROP ft/h',()=>S.rop.toFixed(0)],['Motor RPM',()=>S.motorRpm.toFixed(0)+(S.stalled?' STALL':'')],['Bit RPM',()=>S.bitRpm.toFixed(0)],['Motor ΔP psi',()=>S.dpm.toFixed(0)],['Bit ΔP psi',()=>S.dpb.toFixed(0)],['Washout %',()=>((S.wf||0)*100).toFixed(0)]]})};
bha.traverse(o=>o.userData.ent=wellEnt);ents.push(wellEnt);
// ---------- selection + panels ----------
const panelsEl=document.getElementById('panels');let sel=null,panelEl=null,panelRows=[];
function select(e){sel=e;panelsEl.innerHTML='';panelEl=null;if(!e||!e.panel)return;const d=e.panel();panelEl=document.createElement('div');panelEl.className='panel';
 panelEl.innerHTML=`<h4>${d.title} <span style="color:#fc6;font-weight:400">SIM</span></h4>`+d.rows.map((r,i)=>`<div class=r><span>${r[0]}</span><b id=pv${i}></b></div>`).join('')+(d.html?'<div style="margin-top:4px">'+d.html+'</div>':'');panelsEl.appendChild(panelEl);panelRows=d.rows;
 panelEl.querySelectorAll('input[data-k]').forEach(inp=>{const k=inp.dataset.k.split('.');const get=()=>k.reduce((o,x)=>o[x],S);inp.value=get();inp.oninput=()=>{let o=S;for(const x of k.slice(0,-1))o=o[x];o[k.at(-1)]=+inp.value;if(k[0]=='tf'){S.autoSteer=false}}});
 panelEl.querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a))}
function act(a){const ev=m=>PH.ev(S,m);
 if(a.startsWith('pon'))S.pumps[+a[3]].on=true;else if(a.startsWith('poff'))S.pumps[+a[4]].on=false;else if(a.startsWith('preset')){S.pumps[+a[6]].tripped=false;ev('Pop-off reset')}
 else if(['hoist','lower','hold','auto'].includes(a)){if(a=='auto'&&S.slips){ev('Interlock: release slips before auto-drill');return}S.dw.mode=a}
 else if(a=='rotate'||a=='slide'){S.mode=a;S.autoSteer=false}else if(a=='autosteer'){S.autoSteer=!S.autoSteer;ev('Auto-steer '+(S.autoSteer?'on':'off'))}
 else if(a=='slipset'){if(PH.bitDepth(S)>=S.md-0.5&&S.wob>1){ev('Interlock: pick up off bottom before setting slips');return}S.stickup=S.dw.quill;S.slips=true;ev('Slips set')}
 else if(a=='sliprel'){if(!S.connected){ev('Interlock: cannot release slips, string not connected to top drive');return}S.slips=false;ev('Slips released')}}
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
function pick(ev){mouse.set(ev.clientX/innerWidth*2-1,-ev.clientY/innerHeight*2+1);ray.setFromCamera(mouse,cam);const hits=ray.intersectObjects(scene.children,true).filter(h=>h.object.userData.ent&&h.object.visible);return hits.length?hits[0].object.userData.ent:null}
let downXY=null;ren.domElement.addEventListener('pointerdown',e=>downXY=[e.clientX,e.clientY]);
ren.domElement.addEventListener('pointerup',e=>{if(downXY&&Math.hypot(e.clientX-downXY[0],e.clientY-downXY[1])<5)select(pick(e))});
ren.domElement.addEventListener('dblclick',e=>{const en=pick(e);if(en&&en.dbl){en.dbl();select(en);ctl.target.copy(en.obj.position).add(lp(0,2,0));cam.position.copy(en.obj.position).add(lp(10,8,14))}});
// ---------- HUD ----------
const $=id=>document.getElementById(id);
$('conn').onclick=startConn;function startConn(){if(S.seq)return;if(S.dw.quill>6){PH.ev(S,'Connection needs the stand drilled down (quill < 6 m). Now '+S.dw.quill.toFixed(1)+' m');return}S.seq={steps:PH.connectionSteps(S),i:0}}
document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{const f=b.dataset.f;S.faults[f]=S.t||1e-3;b.classList.add('on');PH.ev(S,'FAULT injected: '+f)});
$('clr').onclick=()=>{S.faults={};S.dw.fadeLoad=0;document.querySelectorAll('[data-f]').forEach(b=>b.classList.remove('on'));PH.ev(S,'Faults cleared')};
let under=false;$('under').onclick=()=>setUnder(!under);
function setUnder(v){under=v;$('under').classList.toggle('on',v);groundMat.opacity=v?0.12:1;groundMat.depthWrite=!v;pad.material.opacity=v?0.2:1;pad.material.depthWrite=!v;strataG.visible=v;if(v){ctl.target.set(10,-45,-10);cam.position.set(95,-25,95)}else{ctl.target.set(0,18,0);cam.position.set(60,40,70)}}
let paused=false;$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Play':'Pause'};
// WASD
const keys={};addEventListener('keydown',e=>keys[e.key.toLowerCase()]=1);addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();ren.setSize(innerWidth,innerHeight)});
// ---------- visual sync from state ----------
const v3=new THREE.Vector3();
function sync(dtR){
 const q=S.dw.quill,tdY=FLOOR+q+2.6;tdAll.position.set(0,tdY,0);td.rotation.y=0;quill.rotation.y=S.td.theta;
 const crownY=FLOOR+MH+1.3,bY=tdY+3.3+2.2;dlines.forEach((l,i)=>{const p=l.geometry.attributes.position;p.setXYZ(0,-0.5+i*0.33,crownY,0);p.setXYZ(1,-0.5+i*0.33,bY,0);p.needsUpdate=true});
 drum.rotation.x=S.dw.drum;rotary.rotation.y=S.td.rpm>0?S.td.theta:rotary.rotation.y;
 slipParts.forEach(b=>{b.position.z+=((S.slips?0.25:0.6)-b.position.z)*0.15;b.position.y=S.slips?-0.15:0.2});
 rnG.position.x+=((S.rough?1.0:3.5)-rnG.position.x)*0.08;rnG.position.z+=((S.rough?1.0:3.5)-rnG.position.z)*0.08;rnHead.rotation.y=S.rough&&S.seq&&S.seq.tdOverride?S.t*4:0;
 // string above floor: from floor to stringTop
 const top=S.connected&&!S.slips?q:S.stickup;strTop.scale.y=Math.max(0.01,top);strTop.position.set(0,FLOOR+top/2,0);
 if(S.connected&&!S.slips&&q<0.05)strTop.visible=false;else strTop.visible=true;
 // catwalk joint
 joint.visible=!!S.catwalk;if(S.catwalk){const ph=Math.min(1,(S.t-S.seq.t0)/10);joint.position.set(14-ph*9,1.6+ph*7,0);joint.rotation.z=Math.PI/2-ph*1.1}
 newStand.visible=!!S.newJoint;if(S.newJoint){newStand.position.set(0,FLOOR+S.stickup+13.7,0)}
 // hose rebuild
 hoseC=hoseCurve();hoseMesh&&(scene.remove(hoseMesh),hoseMesh.geometry.dispose());hoseMesh=new THREE.Mesh(new THREE.TubeGeometry(hoseC,30,0.16,6),mat.hose);hoseMesh.castShadow=true;hoseMesh.userData.ent=lineEnt;scene.add(hoseMesh);
 // particles
 const cs=allCurves();const flows=[S.pumps[0].flow,S.pumps[1].flow,S.Q,S.Q,S.Q];const pres=[S.spp+S.prof?.man||0,S.spp,S.spp,S.spp-(S.prof?.surf||0)*0.5,S.spp-(S.prof?.surf||0)];
 for(let c=0;c<5;c++){const len=cs[c].getLength(),sp=flows[c]/1000*6/len;for(let k=0;k<NP;k++){const j=c*NP+k;pu[j]=(pu[j]+sp*dtR*(spd/20)**0.3)%1;cs[c].getPoint(pu[j],v3);pPos.set([v3.x,v3.y,v3.z],j*3);const cc=pcol(pres[c]);pCol.set([cc.r,cc.g,cc.b],j*3)}}
 pMesh.visible=S.Q>5;pGeom.attributes.position.needsUpdate=true;pGeom.attributes.color.needsUpdate=true;
 if(Math.abs(S.md-lastBuild)>2||S._lastBD!==Math.round(PH.bitDepth(S))){buildWell();lastBuild=S.md;S._lastBD=Math.round(PH.bitDepth(S))}
 motorMesh.material.emissive.setHex(S.stalled?0xff2200:0x000000);
 ents.forEach(e=>e.update());
}
// ---------- loop (fixed step) ----------
const DT=0.05;let acc=0,last=performance.now(),spd=20,uiT=0;
function frame(now){const dtR=Math.min(0.1,(now-last)/1000);last=now;spd=+$('spd').value;
 if(!paused){acc+=dtR*spd;let n=0;while(acc>=DT&&n<400){PH.seqTick(S);PH.step(S,DT);acc-=DT;n++}if(n>=400)acc=0}
 // WASD move
 const f=new THREE.Vector3();cam.getWorldDirection(f);f.y=0;f.normalize();const r=new THREE.Vector3().crossVectors(f,new THREE.Vector3(0,1,0));const m=new THREE.Vector3();const sp=30*dtR;
 if(keys.w)m.add(f);if(keys.s)m.sub(f);if(keys.d)m.add(r);if(keys.a)m.sub(r);if(keys.q)m.y-=1;if(keys.e)m.y+=1;if(m.lengthSq()){m.normalize().multiplyScalar(sp);cam.position.add(m);ctl.target.add(m)}
 sync(dtR);ctl.update();ren.render(scene,cam);
 if(sel&&panelEl){sel.obj.updateMatrixWorld();v3.copy(sel.anchor).applyMatrix4(sel.obj.matrixWorld);if(sel===lineEnt)v3.copy(sel.anchor);v3.project(cam);panelEl.style.display=v3.z<1?'':'none';panelEl.style.left=((v3.x+1)/2*innerWidth)+'px';panelEl.style.top=((1-v3.y)/2*innerHeight)+'px'}
 for(const t of tagEls){t.o.getWorldPosition(v3);v3.project(cam);t.el.style.left=((v3.x+1)/2*innerWidth)+'px';t.el.style.top=((1-v3.y)/2*innerHeight)+'px'}
 if(now-uiT>200){uiT=now;panelRows.forEach((r,i)=>{const el=document.getElementById('pv'+i);if(el)el.textContent=r[1]()});
  const h=Math.floor(S.t/3600),mi=Math.floor(S.t/60)%60;$('clock').textContent=`SIM time ${h}h${String(mi).padStart(2,'0')}m  ×${spd}  |  MD ${S.md.toFixed(0)} ft  SPP ${S.spp.toFixed(0)} psi  Q ${S.Q.toFixed(0)} gpm  ROP ${S.rop.toFixed(0)} ft/h`+(S.seq?'  |  CONNECTION: '+S.seq.steps[S.seq.i][0]:'');
  $('log').innerHTML=S.events.slice(-6).reverse().map(e=>`${(e[0]/60).toFixed(1)}m ${e[1]}`).join('<br>')}
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);
// test hooks
window.G={S,PH,ents,select:n=>select(ents.find(e=>e.name==n)),view:(p,t)=>{cam.position.set(...p);ctl.target.set(...t)},setUnder,startConn,explode:i=>pumps[i].dbl(),run:sec=>{for(let i=0;i<sec/DT;i++){PH.seqTick(S);PH.step(S,DT)}}};
