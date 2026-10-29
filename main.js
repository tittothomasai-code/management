import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import * as PH from './physics.js?v=equip10290907';
const {FT,R}=PH;
const EXT={afterStep(){},frame(){},actX(){return false},layout(){return null},restore(){}};window.EXT=EXT;
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
entity('Iron roughneck',rnG,{anchor:new THREE.Vector3(0,3,0),panel:()=>({title:'Iron roughneck',rows:[['Position',()=>S.rough?'at well centre':'parked'],['Operation',()=>S.rnOp?S.rnOp.kind+' '+(S.t-S.rnOp.t0).toFixed(0)+'/6 s':(S.seq&&S.seq.tdOverride?'sequence':'idle')],['Joint',()=>S.connected?'made up':'broken out']],html:`<button data-a="roughin">In</button><button data-a="roughout">Out</button><button data-a="break">Break out</button><button data-a="make">Make up</button><br><small>Interlocked: slips set, pumps off, no rotation</small>`})});
// ---------- catwalk + pipe rack ----------
const cwG=new THREE.Group();box(22,0.8,1.6,mat.blue,18,0.8,0,cwG);const ramp=box(14,0.3,1.4,mat.steel,0,0,0,cwG);ramp.position.set(9,4.6,0);ramp.rotation.z=-Math.atan2(7.4,13);
for(let i=0;i<8;i++)cyl(0.12,0.12,9.1,mat.pipe,18,0.6+(i>>2)*0.25,3+(i%4)*0.3,cwG).rotation.z=Math.PI/2;
const joint=cyl(0.12,0.12,9.1,mat.pipe,0,0,0,cwG);// moving joint (shown 1 single scaled; stand = 3 joints)
entity('Catwalk',cwG,{anchor:new THREE.Vector3(18,3,0),panel:()=>({title:'Catwalk + pipe rack',rows:[['State',()=>S.catwalk?'delivering':'idle']]})});
// drill string above floor + new stand
const strTop=cyl(0.12,0.12,1,mat.pipe,0,0,0,scene);const newStand=cyl(0.12,0.12,27.4,mat.pipe,0,0,0,scene);
// ---------- pumps ----------
const pumps=[];
function makePump(st,x,z){const g=new THREE.Group();g.position.set(x,0.3,z);
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
 const tags=[];
 const e=entity('Mud pump '+st.id,g,{anchor:new THREE.Vector3(0,4.5,0),
  update(){const th=st.theta;crank.rotation.z=-th;pist.forEach((r,k)=>{r.position.x=r.userData.home.x+0.55*Math.cos(th-2*Math.PI*k/3)+(e.explode||0)*0});
   const ex=e.ex=(e.ex||0)+(((e.explode?1:0)-(e.ex||0))*0.1);let j=0;for(const [n,o] of Object.entries(parts)){const h=o.userData.home;const dir=new THREE.Vector3(h.x*0.5,h.y-1.2,h.z*1.3+((j++%3)-1)*0.6);o.position.set(h.x+dir.x*ex*1.2+(n.startsWith('Piston')?0.55*Math.cos(th-2*Math.PI*(+n.slice(-1)-1)/3):0),h.y+dir.y*ex*1.5,h.z+dir.z*ex*1.5)}},
  panel:()=>({title:'Mud pump '+st.id+(st.tripped?' TRIPPED':''),rows:[['Type',()=>st.ptype||'Triplex 1600 HP'],['Manifold valve',()=>st.valve===false?'CLOSED':'open'],['SPM',()=>st.spm.toFixed(0)+' / max '+(st.max_spm||PH.P.pump.max_spm)],['Flow gpm',()=>st.flow.toFixed(0)],['Strokes',()=>st.strokes.toFixed(0)],['Discharge psi',()=>S.spp.toFixed(0)]],
   html:`<button data-a="pon:${st.id}">On</button><button data-a="poff:${st.id}">Off</button><button data-a="preset:${st.id}">Reset pop-off</button><br>SPM cmd <input type=range min=0 max=140 data-k="pumps.${S.pumps.indexOf(st)}.cmd"><br>Liner in <input type=range min=4.5 max=7.5 step=0.25 data-e="liner_in"> Stroke in <input type=range min=8 max=14 step=1 data-e="stroke_in"><br><button data-x="tree">Parts tree (drill down)</button><button data-x="pvalve">Manifold valve</button><br><small>Double-click pump: exploded view</small>`}),
  dbl(){e.explode=!e.explode;showTags(e.explode?parts:null)}});
 st.liner_in??=PH.P.pump.liner_in;st.stroke_in??=PH.P.pump.stroke_in;e.parts=parts;e.st=st;e.key='pump'+st.id;e.type='mudpump';e.removable=e.movable=true;pumps.push(e);if(linesReady)rebuildLines();return e}
let linesReady=false;S.pumps.forEach((st,i)=>makePump(st,-28,4+i*9));
let tagEls=[];function showTags(parts){tagEls.forEach(t=>t.el.remove());tagEls=[];if(!parts)return;for(const [n,o] of Object.entries(parts)){const el=document.createElement('div');el.className='tag';el.textContent=n;document.body.appendChild(el);tagEls.push({el,o})}}
// ---------- flow lines with particles ----------
const lp=(...a)=>new THREE.Vector3(...a);
const manifold=lp(-12,1.2,6);
const curves=[new THREE.CatmullRomCurve3([manifold,lp(-6,1.2,4),lp(-3.6,1.5,3.6),lp(-3.6,FLOOR,3.6)],false,'catmullrom',0.1), new THREE.LineCurve3(lp(-3.6,FLOOR,3.6),lp(-2.6,FLOOR+30,2.6))];
const lineSegs=curves.map(c=>{const m=new THREE.Mesh(new THREE.TubeGeometry(c,40,0.18,8),mat.steel);m.castShadow=true;scene.add(m);return m});
let hoseMesh=null;const hoseCurve=()=>{const top=lp(-2.6,FLOOR+30,2.6),gn=lp(0,FLOOR+S.dw.quill+3.2,0.9);const mid=top.clone().lerp(gn,0.5);mid.y=Math.min(top.y,gn.y)-6;return new THREE.CatmullRomCurve3([top,lp(-2.4,top.y-1.5,2.4),mid,gn])};
// particles
const NP=60;let hoseC=hoseCurve(),pumpCurves=[],pumpLineMeshes=[],pGeom=null,pPos=null,pCol=null,pu=[],pMesh=null;
const allCurves=()=>[...pumpCurves,...curves,hoseC];
function pumpCurve(e){const g=e.obj.position,a=lp(g.x+3.6,2.2,g.z),m=lp((g.x+manifold.x)/2,1.2,(g.z+manifold.z)/2);return new THREE.CatmullRomCurve3([a,lp(a.x+2,1.2,a.z),m,manifold])}
function rebuildLines(){pumpLineMeshes.forEach(m=>{scene.remove(m);m.geometry.dispose()});pumpCurves=pumps.map(pumpCurve);
 pumpLineMeshes=pumpCurves.map(c=>{const m=new THREE.Mesh(new THREE.TubeGeometry(c,40,0.18,8),mat.steel);m.castShadow=true;m.userData.ent=lineEnt;scene.add(m);return m});
 const n=(pumpCurves.length+3)*NP;if(pPos&&pPos.length==n*3)return;
 if(pMesh){scene.remove(pMesh);pGeom.dispose()}pPos=new Float32Array(n*3);pCol=new Float32Array(n*3);pGeom=new THREE.BufferGeometry();pGeom.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeom.setAttribute('color',new THREE.BufferAttribute(pCol,3));
 pMesh=new THREE.Points(pGeom,new THREE.PointsMaterial({size:0.45,vertexColors:true,depthTest:false,transparent:true}));pMesh.renderOrder=5;scene.add(pMesh);pu=Array.from({length:n},()=>Math.random())}
const col=new THREE.Color();function pcol(psi){col.setHSL(0.66-0.66*Math.min(1,psi/4000),1,0.55);return col}
const lineEnt={name:'Standpipe + hose',obj:new THREE.Group(),update(){},anchor:lp(-3,FLOOR+22,3),panel:()=>({title:'Standpipe + rotary hose',rows:[['SPP psi',()=>S.spp.toFixed(0)],['Flow in gpm',()=>S.Q.toFixed(0)],['Manifold loss psi',()=>S.prof.man.toFixed(0)],['Surface line loss psi',()=>S.prof.surf.toFixed(0)]],html:'<small>particle speed = flow; colour = pressure (blue low, red high)</small>'})};
lineSegs.forEach(m=>m.userData.ent=lineEnt);lineEnt.obj.position.set(0,0,0);ents.push(lineEnt);lineEnt.noModel=true;linesReady=true;rebuildLines();
// ---------- underground: strata, well, string, BHA ----------
const UG=new THREE.Group();scene.add(UG);const WS=0.03;// m per ft (well geometry scale)
const W=(n,e,tvd)=>new THREE.Vector3(e*WS,-tvd*WS,-n*WS);
const strata=[[0,15,0x8a6f4d],[15,40,0xa58a5c],[40,70,0x7b6a58],[70,120,0x5d5248]];
const strataG=new THREE.Group();strata.forEach(([a,b,c])=>{const m=box(90,b-a,60,new THREE.MeshStandardMaterial({color:c,transparent:true,opacity:0.08,depthWrite:false}),20,-(a+b)/2,-20,strataG);m.castShadow=false});strataG.visible=false;scene.add(strataG);
{const pp=PH.planPath().map(p=>W(p[3],p[4],p[5]));const g=new THREE.BufferGeometry().setFromPoints(pp);const l=new THREE.Line(g,new THREE.LineDashedMaterial({color:0x33ff66,dashSize:1,gapSize:0.6}));l.computeLineDistances();l.name='simPlan';UG.add(l)}
let boreMesh=null,strMesh=null,lastBuild=-1;const bha=new THREE.Group();bha.name='bhaGroup';UG.add(bha);
const motorMesh=cyl(0.35,0.35,1.6,mat.paint,0,0.8,0,bha);const bitMesh=cyl(0.45,0.15,0.5,M(0xd4af37,0.9,0.3),0,-0.25,0,bha);
// v4.0: single path. If md moved back (well switch / reset / replay) drop stations deeper than md so the sim path never folds back into a V.
function trimSurveys(){const s=S.surveys;if(!s||!s.length){S.surveys=[[0,0,0,0,0,0]];return}if(s.at(-1)[0]<=S.md+0.5)return;const k=s.filter(q=>q[0]<=S.md);S.surveys=k.length?k:[s[0][0]<=S.md?s[0]:[0,0,0,0,0,0]];S.lastS=S.surveys.at(-1)[0];S.pos=S.surveys.at(-1).slice(3)}
// v4.6: real-data mode (Live WITSML connected, or Replay). In real mode the SIM physics trajectory must never be drawn.
const realMode=()=>{const X=window.GX?.witsml?.WML||window.WML;if(!X)return null;if(X.mode=='replay'&&X.rp)return 'REPLAY';if(X.liveMode)return X.simulated?'SIMULATED':'LIVE';return null};
window.realMode=realMode;window.pathSrc=()=>PATHSRC;window.wellPts=()=>tipPath().map(v=>[v.x,v.y,v.z]);let PATHSRC='SIM';
const realSurvey=(rm)=>{const g=window.GEO;return g&&g.calc&&g.calc.length>=2&&!(rm=='LIVE'&&g.surv?.simTest)&&g.surv?.src!='SIM'};
const tipPath=()=>{const rm=realMode();if(rm&&!realSurvey(rm)){PATHSRC='VERTICAL';return [W(0,0,0),W(0,0,Math.max(1,S.md))]}
 const gp=window.GEO&&window.GEO.pathPts&&window.GEO.pathPts(S.md);if(gp&&gp.length>=2){PATHSRC='SURVEY';return gp.map(q=>W(q.ns,q.ew,q.tvd))}PATHSRC='SIM';trimSurveys();const s=S.surveys,l=s[s.length-1];const p=PH.minCurv(l.slice(3),l[0],l[1],l[2],S.md,S.inc,S.azi);return [...s.map(q=>W(q[3],q[4],q[5])),W(...p)]};
let wellCurve=null;function buildWell(){const pts=tipPath();if(pts.length<2||S.md<=0){boreMesh&&(UG.remove(boreMesh),boreMesh.geometry.dispose(),boreMesh=null);strMesh&&(UG.remove(strMesh),strMesh.geometry.dispose(),strMesh=null);wellCurve=null;return}const c=new THREE.CatmullRomCurve3(pts);wellCurve=c;
 boreMesh&&(UG.remove(boreMesh),boreMesh.geometry.dispose());strMesh&&(UG.remove(strMesh),strMesh.geometry.dispose());
 boreMesh=new THREE.Mesh(new THREE.TubeGeometry(c,Math.max(8,pts.length*2),0.9,10),new THREE.MeshStandardMaterial({color:0xff8c3a,emissive:0x552200,transparent:true,opacity:0.55,depthWrite:false,side:THREE.DoubleSide}));UG.add(boreMesh);
 // string ends at bit depth (off bottom when hoisted)
 const bd=PH.bitDepth(S),f=Math.max(0.01,Math.min(1,(S.md>0&&isFinite(bd))?bd/S.md:1))||1;const sp=[];for(let i=0;i<=60;i++)sp.push(c.getPoint(f*i/60));
 strMesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp),80,0.15,6),mat.pipe);UG.add(strMesh);
 const tip=c.getPoint(f),tan=c.getTangent(f);bha.position.copy(tip);bha.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),tan.normalize());}
const wellEnt={noModel:true,name:'Well',obj:bha,update(){},anchor:new THREE.Vector3(0,0,0),panel:()=>({title:'Well + BHA (directional)',rows:[['MD ft',()=>S.md.toFixed(0)],['TVD ft',()=>S.pos[2].toFixed(0)],['Inc / Azi °',()=>S.inc.toFixed(1)+' / '+S.azi.toFixed(0)],['Mode / TF°',()=>S.mode+' / '+S.tf.toFixed(0)],['ROP ft/h',()=>S.rop.toFixed(0)],['Motor RPM',()=>S.motorRpm.toFixed(0)+(S.stalled?' STALL':'')],['Bit RPM',()=>S.bitRpm.toFixed(0)],['Motor ΔP psi',()=>S.dpm.toFixed(0)],['Bit ΔP psi',()=>S.dpb.toFixed(0)],['Washout %',()=>((S.wf||0)*100).toFixed(0)]]})};
bha.traverse(o=>o.userData.ent=wellEnt);ents.push(wellEnt);
// ---------- selection + panels ----------
const panelsEl=document.getElementById('panels');let sel=null,panelEl=null,panelRows=[];
function select(e){sel=e;panelsEl.innerHTML='';panelEl=null;if(!e||!e.panel)return;const d=e.panel();panelEl=document.createElement('div');panelEl.className='panel';
 panelEl.innerHTML=`<h4>${d.title} <span style="color:#fc6;font-weight:400">SIM</span></h4>`+d.rows.map((r,i)=>`<div class=r><span id=pl${i}>${U.lab(r[0])}</span><b id=pv${i}></b></div>`).join('')+(d.html?'<div style="margin-top:4px">'+d.html+'</div>':'')+panelFooter(e);panelsEl.appendChild(panelEl);panelRows=d.rows;
 panelEl.querySelectorAll('input[data-e]').forEach(inp=>{const k=inp.dataset.e;inp.value=e.st[k];inp.oninput=()=>{e.st[k]=+inp.value;saveLayout()}});
 panelEl.querySelectorAll('[data-x]').forEach(b=>{b.onclick=()=>actX(e,b.dataset.x,b)});
 panelEl.querySelectorAll('input[data-k]').forEach(inp=>{const k=inp.dataset.k.split('.');const get=()=>k.reduce((o,x)=>o[x],S);inp.value=get();inp.oninput=()=>{let o=S;for(const x of k.slice(0,-1))o=o[x];o[k.at(-1)]=+inp.value;if(k[0]=='tf'){S.autoSteer=false}}});
 panelEl.querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>act(b.dataset.a))}
function act(a){const ev=m=>PH.ev(S,m);
 const pm=a.match(/^(pon|poff|preset):(\d+)$/);if(pm){const p=S.pumps.find(p=>p.id==+pm[2]);if(!p)return;if(pm[1]=='pon')p.on=true;else if(pm[1]=='poff')p.on=false;else{p.tripped=false;ev('Pop-off reset')}saveLayout();return}
 if(['hoist','lower','hold','auto'].includes(a)){if(a=='auto'){PH.doAct(S,'drill');return}S.dw.mode=a}
 else if(a=='rotate'||a=='slide'){S.mode=a;S.autoSteer=false}else if(a=='autosteer'){S.autoSteer=!S.autoSteer;ev('Auto-steer '+(S.autoSteer?'on':'off'))}
 else if(['slipset','sliprel','roughin','roughout','break','make'].includes(a))PH.doAct(S,a)}
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
function pick(ev){mouse.set(ev.clientX/innerWidth*2-1,-ev.clientY/innerHeight*2+1);ray.setFromCamera(mouse,cam);const hits=ray.intersectObjects(scene.children,true).filter(h=>h.object.userData.ent&&h.object.visible);return hits.length?hits[0].object.userData.ent:null}
let downXY=null,drag=null;const gPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-0.3),gHit=new THREE.Vector3();
ren.domElement.addEventListener('pointerdown',e=>{downXY=[e.clientX,e.clientY];const en=pick(e);if(en&&en.movable&&!under){drag={en,moved:false};ctl.enabled=false}});
ren.domElement.addEventListener('pointermove',e=>{if(!drag||!downXY)return;if(Math.hypot(e.clientX-downXY[0],e.clientY-downXY[1])<5&&!drag.moved)return;drag.moved=true;mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(mouse,cam);if(ray.ray.intersectPlane(gPlane,gHit)){const o=drag.en.obj.position;o.x=Math.max(-44,Math.min(34,gHit.x));o.z=Math.max(-26,Math.min(42,gHit.z));if(drag.en.type=='mudpump')rebuildLines()}});
ren.domElement.addEventListener('pointerup',e=>{const d=drag;drag=null;ctl.enabled=true;if(d&&d.moved){saveLayout();return}if(downXY&&Math.hypot(e.clientX-downXY[0],e.clientY-downXY[1])<5)select(pick(e))});
ren.domElement.addEventListener('dblclick',e=>{const en=pick(e);if(en&&en.dbl){en.dbl();select(en);ctl.target.copy(en.obj.position).add(lp(0,2,0));cam.position.copy(en.obj.position).add(lp(10,8,14))}});
// ---------- HUD ----------
const $=id=>document.getElementById(id);
$('conn').onclick=startConn;function startConn(){if(S.seq)return;if(S.dw.quill>6){PH.ev(S,'Connection needs the stand drilled down (quill < 6 m). Now '+S.dw.quill.toFixed(1)+' m');return}PH.startSeq(S,'conn')}
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
 rnG.position.x+=((S.rough?1.0:3.5)-rnG.position.x)*0.08;rnG.position.z+=((S.rough?1.0:3.5)-rnG.position.z)*0.08;rnHead.rotation.y=S.rough&&(S.rnOp||S.seq&&S.seq.tdOverride)?S.t*4:0;
 // string above floor: from floor to stringTop
 const top=S.connected&&!S.slips?q:S.stickup;strTop.scale.y=Math.max(0.01,top);strTop.position.set(0,FLOOR+top/2,0);
 if(S.connected&&!S.slips&&q<0.05)strTop.visible=false;else strTop.visible=true;
 // catwalk joint
 joint.visible=!!S.catwalk;if(S.catwalk){const ph=Math.min(1,(S.t-S.seq.t0)/10);joint.position.set(14-ph*9,1.6+ph*7,0);joint.rotation.z=Math.PI/2-ph*1.1}
 newStand.visible=!!S.newJoint;if(S.newJoint){newStand.position.set(0,FLOOR+S.stickup+13.7,0)}
 // hose rebuild
 hoseC=hoseCurve();hoseMesh&&(scene.remove(hoseMesh),hoseMesh.geometry.dispose());hoseMesh=new THREE.Mesh(new THREE.TubeGeometry(hoseC,30,0.16,6),mat.hose);hoseMesh.castShadow=true;hoseMesh.userData.ent=lineEnt;scene.add(hoseMesh);
 // particles
 const cs=allCurves();const flows=[...pumps.map(e=>e.st.flow),S.Q,S.Q,S.Q];const pres=[...pumps.map(()=>S.spp+(S.prof?.man||0)),S.spp,S.spp-(S.prof?.surf||0)*0.5,S.spp-(S.prof?.surf||0)];
 for(let c=0;c<cs.length;c++){const len=cs[c].getLength(),sp=flows[c]/1000*6/len;for(let k=0;k<NP;k++){const j=c*NP+k;pu[j]=(pu[j]+sp*dtR*(spd/20)**0.3)%1;cs[c].getPoint(pu[j],v3);pPos.set([v3.x,v3.y,v3.z],j*3);const cc=pcol(pres[c]);pCol.set([cc.r,cc.g,cc.b],j*3)}}
 pMesh.visible=S.Q>5;pGeom.attributes.position.needsUpdate=true;pGeom.attributes.color.needsUpdate=true;
 trimSurveys();const _pk=(realMode()||'')+'|'+(window.GEO?.calc?.length||0)+'|'+(window.GEO?.surv?.src||'');if(Math.abs(S.md-lastBuild)>2||S._lastBD!==Math.round(PH.bitDepth(S))||S._pk!==_pk){S._pk=_pk;buildWell();lastBuild=S.md;S._lastBD=Math.round(PH.bitDepth(S))}
 motorMesh.material.emissive.setHex(S.stalled?0xff2200:0x000000);
 ents.forEach(e=>e.update());_upd0();
}
// ---------- equipment palette (add / move / remove) + 3D model replacement ----------
// Non-pump equipment has visual + simple on/off state only. No physics model behind it. SIMULATED.
const eqMat={grey:M(0x7c858c,0.5,0.5),green:M(0x3f6b45,0.3,0.6),orange:M(0xd9822b,0.3,0.5),screen:M(0x444a50,0.7,0.4,{wireframe:false})};
const runTxt=st=>()=>{const m=Math.floor(st.run/60);return Math.floor(m/60)+'h'+String(m%60).padStart(2,'0')+'m'};
const share=(type,st)=>{if(!st.on)return 0;const n=eqList.filter(e=>e.type==type&&e.st.on).length;return n?S.Q/n:0};
const onRows=st=>[['State',()=>st.on?'ON':'off'],['Run time (sim)',runTxt(st)]];
const onBtns='<button data-x="on">On</button><button data-x="off">Off</button>';
function cones(g,n,r,h,x0,dx){for(let k=0;k<n;k++){const c=cyl(r,r*0.25,h,eqMat.grey,x0+k*dx,2.2,0,g);c.rotation.x=Math.PI}}
const EQ={
 mudpump:{label:'Mud pump',pump:true},
 shaker:{label:'Shale shaker',build(g,st){box(4,1.2,2.4,mat.dark,0,0.6,0,g);const sc=box(3.6,0.25,2.2,eqMat.screen,0,1.6,0,g);sc.rotation.z=-0.12;st._sc=sc;cyl(0.3,0.3,0.6,mat.blue,0,2.2,1.3,g).rotation.x=Math.PI/2;box(0.8,1.4,2.4,eqMat.grey,-2,1.9,0,g)},
  rows:st=>[...onRows(st),['Returns through gpm',()=>share('shaker',st).toFixed(0)]],html:()=>onBtns+'<br><small>Returns = sim flow in, split across shakers that are ON.</small>',
  update(st){st._sc&&(st._sc.position.y=1.6+(st.on?Math.sin(performance.now()/18)*0.04:0))}},
 desander:{label:'Desander',build(g){box(3,1.6,1.6,mat.dark,0,0.8,0,g);cyl(0.2,0.2,3,mat.steel,0,3.1,0,g).rotation.z=Math.PI/2;cones(g,2,0.55,1.4,-0.8,1.6)},
  rows:st=>[...onRows(st),['Feed gpm',()=>share('desander',st).toFixed(0)]],html:()=>onBtns},
 desilter:{label:'Desilter',build(g){box(3.4,1.6,1.4,mat.dark,0,0.8,0,g);cyl(0.15,0.15,3.4,mat.steel,0,3,0,g).rotation.z=Math.PI/2;cones(g,8,0.2,1,-1.5,0.43)},
  rows:st=>[...onRows(st),['Feed gpm',()=>share('desilter',st).toFixed(0)]],html:()=>onBtns},
 degasser:{label:'Degasser',build(g){box(2.6,0.3,2,mat.dark,0,0.15,0,g);cyl(0.8,0.8,3.2,eqMat.orange,0,1.9,0,g);cyl(0.12,0.12,1.5,mat.steel,0,4.2,0,g)},
  rows:st=>[...onRows(st)],html:()=>onBtns+'<br><small>No gas model in this sim.</small>'},
 generator:{label:'Generator',build(g,st){box(6,2.6,2.4,mat.yellow,0,1.3,0,g);box(6.1,0.3,2.5,mat.dark,0,2.75,0,g);st._ex=cyl(0.18,0.18,1.4,mat.dark,2.2,3.5,0.6,g)},
  rows:st=>[...onRows(st),['Gensets ON (all)',()=>eqList.filter(e=>e.type=='generator'&&e.st.on).length]],html:()=>onBtns+'<br><small>No electrical load model.</small>',
  update(st){st._ex&&(st._ex.material=st.on?mat.dark:mat.steel)}},
 bop:{label:'BOP stack',init:{ann:0,pipe:0,blind:0},build(g,st){cyl(1.1,1.3,1.6,mat.paint,0,4.6,0,g);st._r=[];for(let k=0;k<2;k++){box(1.6,0.9,1.6,mat.paint,0,2.9-k*1.2,0,g);const L=box(0.8,0.6,0.6,mat.steel,-1.2,2.9-k*1.2,0,g),Rr=box(0.8,0.6,0.6,mat.steel,1.2,2.9-k*1.2,0,g);st._r.push([L,Rr])}box(2.4,0.6,2.4,mat.dark,0,0.6,0,g)},
  rows:st=>[['Annular',()=>st.ann?'CLOSED':'open'],['Pipe rams',()=>st.pipe?'CLOSED':'open'],['Blind rams',()=>st.blind?'CLOSED':'open']],
  html:()=>'<button data-x="t:ann">Annular</button><button data-x="t:pipe">Pipe rams</button><button data-x="t:blind">Blind rams</button><br><small>Visual only: not tied to well flow.</small>',
  update(st){st._r&&st._r.forEach(([a,b],k)=>{const c=k==0?st.pipe:st.blind;a.position.x=c?-0.9:-1.2;b.position.x=c?0.9:1.2})}},
 choke:{label:'Choke manifold',init:{pct:50},build(g){box(4,0.3,2,mat.dark,0,0.15,0,g);for(let k=0;k<3;k++){cyl(0.12,0.12,3.6,mat.steel,0,1+k*0.7,0,g).rotation.z=Math.PI/2;for(const x of[-1.2,0,1.2])cyl(0.25,0.25,0.4,mat.paint,x,1+k*0.7,0.25,g).rotation.x=Math.PI/2}},
  rows:st=>[['Choke opening %',()=>st.pct]],html:()=>'Opening <input type=range min=0 max=100 data-e="pct"><br><small>Visual only: no back-pressure model.</small>'},
 accumulator:{label:'Accumulator (Koomey)',build(g){box(4,0.3,1.6,mat.dark,0,0.15,0,g);for(let k=0;k<6;k++)cyl(0.22,0.22,1.8,eqMat.green,-1.6+k*0.64,1.2,0,g);box(4,0.6,1.6,mat.blue,0,2.4,0,g)},
  rows:st=>[['Charge pump',()=>st.on?'ON':'off']],html:()=>onBtns+'<br><small>No pressure model.</small>'},
 piperack:{label:'Pipe rack',init:{n:12},build(g,st){for(const x of[-3.5,0,3.5])box(0.4,1,3.2,mat.dark,x,0.5,0,g);st._p=[];for(let k=0;k<24;k++){const p=cyl(0.12,0.12,9.1,mat.pipe,0,1.12+Math.floor(k/12)*0.25,-1.4+(k%12)*0.25,g);p.rotation.z=Math.PI/2;st._p.push(p)}},
  rows:st=>[['Joints on rack',()=>st.n]],html:()=>'Joints <input type=range min=0 max=24 data-e="n">',update(st){st._p&&st._p.forEach((p,k)=>p.visible=k<st.n)}},
 lighttower:{label:'Light tower',build(g,st){box(1.6,1,1.2,mat.yellow,0,0.5,0,g);cyl(0.1,0.1,7,mat.steel,0,4.5,0,g);st._l=box(1.6,0.6,0.3,M(0xffffff,0,0.5),0,8,0,g)},rows:onRows,html:()=>onBtns,
  update(st){st._l&&st._l.material.emissive.setHex(st.on?0xffffcc:0)}},
 doghouse:{label:'Doghouse / office',build(g){box(6,2.8,2.6,mat.white,0,1.4,0,g);box(1,1.8,0.1,mat.blue,1.5,1,1.31,g)},rows:st=>[['Type',()=>'cabin']]},
};
const eqList=[];let eqId=0;
function footprintFree(o,ignore){const b=new THREE.Box3().setFromObject(o);for(const e of ents){if(e===ignore||e.noModel||!e.obj.parent||e.obj.parent!==scene)continue;const c=new THREE.Box3().setFromObject(e.obj);c.expandByScalar(1.0);if(b.min.x<c.max.x&&b.max.x>c.min.x&&b.min.z<c.max.z&&b.max.z>c.min.z)return false}
 for(const c of pumpCurves.concat(curves)){for(let t=0;t<=1;t+=0.05){const p=c.getPoint(t);if(p.x>b.min.x-0.5&&p.x<b.max.x+0.5&&p.z>b.min.z-0.5&&p.z<b.max.z+0.5&&p.y<4)return false}}
 return b.min.x>-45&&b.max.x<35&&b.min.z>-27&&b.max.z<43}
function autoPlace(e,pref){const o=e.obj,c=[];for(let x=-42;x<=32;x+=1.5)for(let z=-25;z<=41;z+=1.5)c.push([x,z]);c.sort((a,b)=>Math.hypot(a[0]-pref[0],a[1]-pref[1])-Math.hypot(b[0]-pref[0],b[1]-pref[1]));
 for(const [x,z] of c){o.position.x=x;o.position.z=z;o.updateMatrixWorld(true);if(footprintFree(o,e))return true}o.position.set(pref[0],0.3,pref[1]);return false}
function makeEquip(type,st,pos){const T=EQ[type],g=new THREE.Group();g.position.set(0,0.3,0);T.build(g,st);const name=T.label+' '+st.id;
 g.userData.isEquip=1;const e=entity(name,g,{anchor:new THREE.Vector3(0,new THREE.Box3().setFromObject(g).max.y+0.8,0),update(){},panel:()=>({title:name,rows:T.rows?T.rows(st):[],html:T.html?T.html(st):''})});
 e.type=type;e.st=st;e.key='eq'+st.id;e.removable=e.movable=true;eqList.push(e);
 if(pos){g.position.x=pos[0];g.position.z=pos[1]}else autoPlace(e,[-30,26]);return e}
function addEquip(type,pos,saved){let e;const T=EQ[type];if(!T)throw new Error('unknown type '+type);
 if(T.pump){const st=saved?PH.newPump(S,{cmd:saved.cmd??100,on:saved.on??false,...(saved.id?{id:saved.id}:{})}):PH.newPump(S,{on:false});e=makePump(st,pos?pos[0]:-28,pos?pos[1]:4);if(!pos)autoPlace(e,[-28,4+9*(pumps.length-1)]);rebuildLines()}
 else{const st={id:++eqId,on:true,run:0,...(T.init||{}),...(saved||{})};e=makeEquip(type,st,pos)}
 if(!saved){PH.ev(S,'Added '+e.name);saveLayout();applyTypeModel(e)}return e}
function removeEnt(e){if(!e||!e.removable)return;if(sel===e)select(null);scene.remove(e.obj);ents.splice(ents.indexOf(e),1);
 if(e.type=='mudpump'){S.pumps.splice(S.pumps.indexOf(e.st),1);pumps.splice(pumps.indexOf(e),1);if(e.explode)showTags(null);rebuildLines()}else eqList.splice(eqList.indexOf(e),1);
 PH.ev(S,'Removed '+e.name);if(!restoring)delModel(e.key);saveLayout()}
function eqTick(dt){if(!dt)return;for(const e of eqList){if(e.st.on)e.st.run+=dt}}
const _upd0=()=>{for(const e of eqList){const T=EQ[e.type];T.update&&T.update(e.st,0.016)}};const _sync0=sync;
// ---------- persistence (localStorage layout; IndexedDB for model files) ----------
const LKEY='dw3-layout-v1',MKEY='dw3-models-v1';let restoring=false;
const stClean=st=>Object.fromEntries(Object.entries(st).filter(([k])=>k[0]!='_'));
function saveLayout(){if(restoring)return;try{localStorage.setItem(LKEY,JSON.stringify({pumps:pumps.map(e=>({id:e.st.id,x:e.obj.position.x,z:e.obj.position.z,cmd:e.st.cmd,on:e.st.on})),equip:eqList.map(e=>({type:e.type,x:e.obj.position.x,z:e.obj.position.z,st:stClean(e.st)}))}))}catch(err){}}
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('dw3',1);r.onupgradeneeded=()=>r.result.createObjectStore('models');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbPut(k,v){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction('models','readwrite');t.objectStore('models').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function idbGet(k){const d=await idb();return new Promise((res,rej)=>{const r=d.transaction('models').objectStore('models').get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const mGet=()=>{try{return JSON.parse(localStorage.getItem(MKEY)||'{}')}catch{return{}}},mSet=m=>{try{localStorage.setItem(MKEY,JSON.stringify(m))}catch{}};
function delModel(k){const m=mGet();delete m[k];mSet(m)}
async function restoreLayout(){const L=JSON.parse(localStorage.getItem(LKEY)||'null');restoring=true;
 try{if(L){[...pumps].forEach(e=>removeEnt(e));L.pumps.forEach(p=>addEquip('mudpump',[p.x,p.z],p));S._pid=Math.max(2,...S.pumps.map(p=>p.id));L.equip.forEach(q=>{if(EQ[q.type]){if(q.st.id>eqId)eqId=q.st.id-1;const e=addEquip(q.type,[q.x,q.z],q.st);eqId=Math.max(eqId,e.st.id)}})}}finally{restoring=false}
 saveLayout();const m=mGet();for(const e of ents){const r=m[e.key||e.name]||m['type:'+(e.type||e.name)];if(r)await applyRecord(e,r).catch(err=>console.warn('model restore',e.name,err))}}
// ---------- 3D model replacement ----------
const LD={glb:['GLTFLoader','GLTFLoader'],gltf:['GLTFLoader','GLTFLoader'],obj:['OBJLoader','OBJLoader'],fbx:['FBXLoader','FBXLoader'],stl:['STLLoader','STLLoader']};
async function parseModel(data,ext,url){ext=(ext||'').toLowerCase();const d=LD[ext];if(!d)throw new Error('Unsupported format: '+ext+' (use GLB, GLTF, OBJ, FBX or STL)');
 const mod=await import('./vendor/loaders/'+d[0]+'.js'),ld=new mod[d[1]]();
 if(url&&data==null)return await new Promise((res,rej)=>ld.load(url,r=>res(norm(r,ext)),undefined,rej));
 if(ext=='glb'||ext=='gltf')return await new Promise((res,rej)=>ld.parse(data,'',r=>res(norm(r,ext)),rej));
 if(ext=='obj')return norm(ld.parse(new TextDecoder().decode(data)),ext);return norm(ld.parse(data),ext)}
function norm(r,ext){if(ext=='glb'||ext=='gltf')return r.scene;if(ext=='stl')return new THREE.Mesh(r,M(0x9aa3ab,0.5,0.5));return r}
function origBox(e){const o=e.obj;o.updateMatrixWorld(true);const b=new THREE.Box3();(e.orig||o.children).forEach(c=>{const v=c.visible;c.visible=true;b.expandByObject(c);c.visible=v});const inv=new THREE.Matrix4().copy(o.matrixWorld).invert();return b.applyMatrix4(inv)}
function applyModel(e,model){const o=e.obj,ob=origBox(e);if(e.model){o.remove(e.model)}else{e.orig=[...o.children]}e.orig.forEach(c=>c.visible=false);
 const w=new THREE.Group();w.add(model);model.updateMatrixWorld(true);const mb=new THREE.Box3().setFromObject(model);const ms=mb.getSize(new THREE.Vector3()),os=ob.getSize(new THREE.Vector3());
 const k=Math.min(...[0,1,2].map(i=>ms.getComponent(i)>1e-6?os.getComponent(i)/ms.getComponent(i):Infinity));const s=isFinite(k)&&k>0?k:1;model.scale.multiplyScalar(s);model.updateMatrixWorld(true);
 const nb=new THREE.Box3().setFromObject(model),nc=nb.getCenter(new THREE.Vector3()),oc=ob.getCenter(new THREE.Vector3());model.position.add(new THREE.Vector3(oc.x-nc.x,ob.min.y-nb.min.y,oc.z-nc.z));
 w.traverse(c=>{c.userData.ent=e;if(c.isMesh){c.castShadow=c.receiveShadow=true}});o.add(w);e.model=w;if(sel===e)select(e)}
function resetModel(e){if(!e||!e.model)return;e.obj.remove(e.model);e.model=null;e.orig.forEach(c=>c.visible=true);const m=mGet();delete m[e.key||e.name];mSet(m);PH.ev(S,'Default model restored: '+e.name);if(sel===e)select(e)}
async function applyRecord(e,r){const mdl=r.url?await parseModel(null,r.ext,r.url):await parseModel((await idbGet(r.idb)).buf,r.ext);applyModel(e,mdl)}
const extOf=n=>(n.split('?')[0].split('.').pop()||'').toLowerCase();
async function replaceFromURL(e,url,all){const ext=extOf(url);applyModel(e,await parseModel(null,ext,url));const m=mGet(),rec={url,ext};m[e.key||e.name]=rec;if(all)setType(e,rec,m);mSet(m);PH.ev(S,'Model replaced: '+e.name)}
async function replaceFromFile(e,file,all){const ext=extOf(file.name),buf=await file.arrayBuffer();applyModel(e,await parseModel(buf,ext));const k='f:'+(e.key||e.name)+':'+Date.now();
 const m=mGet(),rec={idb:k,ext,file:file.name};try{await idbPut(k,{buf})}catch(err){console.warn('model not persisted',err)}m[e.key||e.name]=rec;if(all)setType(e,rec,m);mSet(m);PH.ev(S,'Model replaced: '+e.name+' ('+file.name+')')}
function setType(e,rec,m){m['type:'+(e.type||e.name)]=rec;for(const x of ents)if(x!==e&&(x.type||x.name)==(e.type||e.name)&&!x.noModel)applyRecord(x,rec).catch(err=>console.warn(err))}
function applyTypeModel(e){const r=mGet()['type:'+e.type];if(r)applyRecord(e,r).catch(err=>console.warn(err))}
const fileIn=document.createElement('input');fileIn.type='file';fileIn.accept='.glb,.gltf,.obj,.fbx,.stl';fileIn.style.display='none';fileIn.id='modelFile';document.body.appendChild(fileIn);let fileTarget=null;
fileIn.onchange=()=>{const f=fileIn.files[0],t=fileTarget;fileIn.value='';if(f&&t)replaceFromFile(t.e,f,t.all).catch(err=>{PH.ev(S,'Model load failed: '+err.message);console.warn(err)})};
function panelFooter(e){if(!e)return'';let h='';if(e.noModel&&!e.removable)return'';h+='<div style="margin-top:5px;border-top:1px solid #345;padding-top:4px">';
 if(!e.noModel)h+=`<small>3D model:</small><br><button data-x="mfile">Replace with 3D model (file)</button><button data-x="murl">… from URL</button>${e.model?'<button data-x="mreset">Reset to default model</button>':''}<br><label><input type=checkbox id="mall" style="width:auto"> apply to all of this type</label><br>`;
 if(e.removable)h+='<button data-x="remove" style="background:#612">Remove</button> <small>Drag to move</small>';return h+'</div>'}
function actX(e,x,b){if(EXT.actX(e,x,b))return;const st=e.st,all=()=>!!document.getElementById('mall')?.checked;
 if(x=='on'){st.on=true;saveLayout()}else if(x=='off'){st.on=false;saveLayout()}else if(x.startsWith('t:')){const k=x.slice(2);st[k]=st[k]?0:1;PH.ev(S,e.name+': '+k+(st[k]?' closed':' opened'));saveLayout()}
 else if(x=='remove')removeEnt(e);else if(x=='mreset')resetModel(e);
 else if(x=='mfile'){fileTarget={e,all:all()};fileIn.click()}
 else if(x=='murl'){const u=prompt('Model URL (.glb, .gltf, .obj, .fbx, .stl)');if(u)replaceFromURL(e,u.trim(),all()).catch(err=>{PH.ev(S,'Model load failed: '+err.message);console.warn(err)})}}
// HUD menu
{const hud=document.getElementById('hud'),btn=document.createElement('button');btn.id='addeq';btn.textContent='Add equipment ▾';hud.appendChild(btn);
 const m=document.createElement('div');m.id='eqmenu';m.style.cssText='display:none;position:fixed;top:40px;left:8px;background:#101820ee;border:1px solid #5a7;border-radius:6px;padding:6px;z-index:10';
 m.innerHTML=Object.entries(EQ).map(([k,t])=>`<button data-add="${k}" style="display:block;width:100%;text-align:left;margin:2px 0;background:#234;color:#def;border:1px solid #567;border-radius:3px;padding:3px 8px;cursor:pointer">${t.label}</button>`).join('')+'<hr style="border-color:#345"><button id="eqreset" style="background:#422;color:#fdd;border:1px solid #855;border-radius:3px;padding:3px 8px;cursor:pointer">Reset layout + models</button>';
 document.body.appendChild(m);btn.onclick=()=>m.style.display=m.style.display=='none'?'block':'none';
 m.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const e=addEquip(b.dataset.add);m.style.display='none';select(e)});
 m.querySelector('#eqreset').onclick=()=>{if(confirm('Reset equipment layout and 3D models to default?')){localStorage.removeItem(LKEY);localStorage.removeItem(MKEY);try{indexedDB.deleteDatabase('dw3')}catch{}location.reload()}}}

import('./ext.js?v=52').then(x=>x.init({THREE,S,PH,scene,cam,ctl,ents,pumps,select,entity,box,cyl,beam,mat,M,lp,curves,FLOOR,MH,td,tdAll,blk,dwG,slG,rnG,rnArm,cwG,UG,W,allCurves:()=>allCurves(),getWell:()=>wellCurve,act,EXT,removeEnt,saveLayout,addEquip,EQ,eqList,pumpsArr:pumps,setUnder,ren,groundMat,pad,sun,bha,rigG,dwG,ctl,makePump,rebuildLines,sel:()=>sel})).catch(e=>console.error('ext',e));
// ---------- loop (fixed step) ----------
const DT=0.05;let acc=0,last=performance.now(),spd=20,uiT=0;
function frame(now){const dtR=Math.min(0.1,(now-last)/1000);last=now;spd=+$('spd').value;
 if(!paused){acc+=dtR*spd;let n=0;while(acc>=DT&&n<400){PH.seqTick(S);PH.step(S,DT);EXT.afterStep();acc-=DT;n++}if(n>=400)acc=0;eqTick(n*DT)}
 // WASD move
 const f=new THREE.Vector3();cam.getWorldDirection(f);f.y=0;f.normalize();const r=new THREE.Vector3().crossVectors(f,new THREE.Vector3(0,1,0));const m=new THREE.Vector3();const sp=30*dtR;
 if(keys.w)m.add(f);if(keys.s)m.sub(f);if(keys.d)m.add(r);if(keys.a)m.sub(r);if(keys.q)m.y-=1;if(keys.e)m.y+=1;if(m.lengthSq()){m.normalize().multiplyScalar(sp);cam.position.add(m);ctl.target.add(m)}
 sync(dtR);EXT.frame(dtR);ctl.update();ren.render(scene,cam);
 if(sel&&panelEl){sel.obj.updateMatrixWorld();v3.copy(sel.anchor).applyMatrix4(sel.obj.matrixWorld);if(sel===lineEnt)v3.copy(sel.anchor);v3.project(cam);panelEl.style.display=v3.z<1?'':'none';panelEl.style.left=((v3.x+1)/2*innerWidth)+'px';panelEl.style.top=((1-v3.y)/2*innerHeight)+'px'}
 for(const t of tagEls){t.o.getWorldPosition(v3);v3.project(cam);t.el.style.left=((v3.x+1)/2*innerWidth)+'px';t.el.style.top=((1-v3.y)/2*innerHeight)+'px'}
 if(now-uiT>200){uiT=now;panelRows.forEach((r,i)=>{const el=document.getElementById('pv'+i);if(el)el.textContent=U.val(r[0],r[1]());const lb=document.getElementById('pl'+i);if(lb)lb.textContent=U.lab(r[0])});
  const rm=realMode(),pl=UG.getObjectByName('simPlan');if(pl)pl.visible=!rm;
  let ns=document.getElementById('nosurv');if(!ns){ns=document.createElement('div');ns.id='nosurv';ns.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(84px + env(safe-area-inset-top));background:#5a3a00ee;color:#ffd27a;font:bold 13px sans-serif;padding:4px 10px;border-radius:6px;z-index:41;pointer-events:none;display:none;text-align:center;max-width:92vw';document.body.appendChild(ns)}
  ns.style.display=rm&&PATHSRC=='VERTICAL'?'':'none';ns.textContent='No survey — trajectory assumed vertical ('+rm+')'+(window.WML?.sv?.why?' · WHY: '+WML.sv.why:'');
  if(rm){$('clock').textContent=U.txt(`${rm} data  |  MD ${S.md.toFixed(0)} ft  |  well path: ${PATHSRC=='SURVEY'?'survey ('+(window.GEO?.surv?.src||'')+')':'no survey, vertical'}`)}else{
  const h=Math.floor(S.t/3600),mi=Math.floor(S.t/60)%60;$('clock').textContent=U.txt(`SIM time ${h}h${String(mi).padStart(2,'0')}m  ×${spd}  |  MD ${S.md.toFixed(0)} ft  SPP ${S.spp.toFixed(0)} psi  Q ${S.Q.toFixed(0)} gpm  ROP ${S.rop.toFixed(0)} ft/h`)+(S.seq?'  |  CONNECTION: '+S.seq.steps[S.seq.i][0]:'');}
  $('log').innerHTML=S.events.slice(-6).reverse().map(e=>`${(e[0]/60).toFixed(1)}m ${U.txt(e[1])}`).join('<br>')}
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);
// test hooks
window.G={EXT,S,PH,ents,_scene:scene,select:n=>select(ents.find(e=>e.name==n)),view:(p,t)=>{cam.position.set(...p);ctl.target.set(...t)},setUnder,startConn,explode:i=>pumps[i].dbl(),addEquip,removeEnt:n=>removeEnt(ents.find(e=>e.name==n)),replaceModelURL:(n,u)=>replaceFromURL(ents.find(e=>e.name==n),u),resetModel:n=>resetModel(ents.find(e=>e.name==n)),pumps,EQ,run:sec=>{for(let i=0;i<sec/DT;i++){PH.seqTick(S);PH.step(S,DT);EXT.afterStep()}}};

restoreLayout().catch(e=>console.warn('layout restore',e));
