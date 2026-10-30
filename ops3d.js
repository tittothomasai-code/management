// v5.11 Ops 3D (SIM): casing run along the planned survey path, joint by joint. Pure timeline (stateAt) + Three.js view.
const LIM=1.36;
// Everything here is a SIM teaching animation: SIM proposal A trajectory, API-style SIM pipe, simplified hydraulics. Never LIVE.
import * as WP from './wplan.js';import * as C from './casing.js';
export const G=9.80665,JL=12.2,SHOE=0.6;
// ---- well & string ----
export function well(){const W=WP.calc(JSON.parse(JSON.stringify(WP.DEFAULT)));const D=C.design(W,{});const at=md=>WP.pointAt(W.L,W.S,Math.max(0,md));
 const inc=md=>{const a=at(md-1),b=at(md+1),dz=b[2]-a[2],dh=Math.hypot(b[0]-a[0],b[1]-a[1]);return Math.atan2(dh,dz)};return {W,D,at,inc,tvd:md=>at(md)[2]}}
// surge/swab (Bingham slot-flow, closed-end string with float valves, clinging const Kc): kPa over annulus length L
export function surge({v,Dh,Dp,L,PV=0.035,YP=15,Kc=0.45}){const ann=Dh*Dh-Dp*Dp,va=Math.abs(v)*(Dp*Dp/ann+Kc),h=(Dh-Dp)/2*2/2,gap=Dh-Dp;
 const grad=12*PV*va/(gap*gap)+3*YP/gap;return {va,dPkPa:grad*L/1000*Math.sign(v)}}
// hookload while running: buoyed weight × (cos inc − μ sin inc) integrated along the run string (kN), floor 0
export function hookload(w,shoeMD,mudSG,{mu=0.3,kgm,block=30}={}){const BF=1-mudSG/7.85;let s=0;const n=Math.max(1,Math.ceil(shoeMD/10)),dl=shoeMD/n;
 for(let k=0;k<n;k++){const i=w.inc((k+.5)*dl);s+=kgm*G*BF*dl*Math.max(0,Math.cos(i)-mu*Math.sin(i))/1000}return Math.max(block,s+block)}
// ---- casing run timeline ----
export function casingPlan(w){const e=w.D[1],s=e.s,prev=w.D[0].s,IN=0.0254;const N=Math.ceil((s.shoeMD-SHOE)/JL);
 const Dh=holeIn(s.hole)*IN,Dp=e.p.od*IN,ev=[];const tight=Math.round((1150-SHOE)/JL),stuck=Math.round((1640-SHOE)/JL);
 // per-joint durations: slow first joints, time-lapse in the middle, slow for events; fill-up every 10 joints
 const J=[];let t=0;for(let k=1;k<=N;k++){let d=k<=4?3.2:k<=8?1.2:0.42;const tag=[];if(k%10==0){tag.push('fill');d+=1.4}
  if(k==14){tag.push('surge');d+=3}if(k==tight){tag.push('tight');d+=5}if(k==stuck){tag.push('stuck');d+=7}if(k==N){tag.push('land');d+=2}
  if(Math.abs(w.tvd(SHOE+k*JL)-prev.shoeTVD)<JL&&!J.some(j=>j.tag.includes('shoe13')))tag.push('shoe13');J.push({k,t0:t,d,tag});t+=d}
 return {e,s,prev,N,Dh,Dp,J,T:t+4,kgm:e.p.kgm,events:J.filter(j=>j.tag.length).map(j=>({k:j.k,t:j.t0,tag:j.tag})),
  cent:Array.from({length:Math.min(N,40)},(_,i)=>SHOE+JL*0.5+i*JL),fillEvery:10}}
export const holeIn=h=>{const m=String(h).match(/(\d+)(?:-(\d+)\/(\d+))?/);return m?+m[1]+(m[2]?m[2]/m[3]:0):12.25};
const ease=x=>x<0?0:x>1?1:x*x*(3-2*x);
export function stateAt(P,w,t){const s=P.s;if(t>=P.T-4){const f=P.J.at(-1);return st(P,w,P.N,1,'landed',t,f)}
 let j=P.J.find(q=>t<q.t0+q.d)||P.J.at(-1);const u=(t-j.t0)/j.d;return st(P,w,j.k,u,null,t,j)}
function st(P,w,k,u,ph,t,j){const s=P.s,M=0.35;// first 35% of a joint cycle: pick up + make up new joint at the floor; rest: run 12.2 m
 let run=u<M?0:ease((u-M)/(1-M)),phase=ph||(u<M?'makeup':'run'),msg='',over=0,sp=0,warn='';
 if(j.tag.includes('stuck')&&!ph){// stops 60% down, overpull & circulate, works free
  if(u>M&&u<0.85){run=Math.min(run,0.6);phase=u<0.55?'stuck':u<0.7?'work':'circulate';over=phase=='work'?Math.sin((u-.55)/.15*Math.PI)*380:0;msg=phase=='stuck'?'⚠ Casing stopped at '+f0(SHOE+(k-1+0.6)*JL)+' m, cannot go down (differential sticking risk across permeable sand)':phase=='work'?'Working pipe: pick up within the SIM overpull limit (max 380 kN over), slack off':'Circulate at low rate to break gel, then slack off. Casing comes free';if(u>=0.85)run=0.6+0.4*ease((u-.85)/.15)}
  else if(u>=0.85)run=0.6+0.4*ease((u-.85)/.15)}
 if(j.tag.includes('tight')&&!ph&&u>M){const r=(u-M)/(1-M);if(r<0.7){run=0.3+0.1*Math.sin(r*20)*.5;phase='tight';over=-220*Math.abs(Math.sin(r*10));msg='⚠ Tight spot at '+f0(SHOE+(k-1+0.3)*JL)+' m: slack-off weight lost. Reciprocate gently, do not exceed the SIM slack-off limit'}else run=0.3+0.7*ease((r-.7)/.3)}
 const shoeMD=Math.min(s.shoeMD,SHOE+(k-1+run)*JL+(ph?0:0)),inFull=ph=='landed'?s.shoeMD:shoeMD;
 // running speed (m/s) for surge: derivative of run over the run window
 const runDur=j.d*(1-M);sp=phase=='run'?JL/runDur*1.5*Math.sin(Math.PI*Math.min(1,Math.max(0,(u-M)/(1-M))))*(j.tag.includes('surge')?1:0.45):0;
 const tvd=w.tvd(inFull),L=Math.max(0,inFull-P.prev.shoeMD)+P.prev.shoeMD,sv=Math.min(sp,j.k<=8?0.9:0.9);let realV=j.tag.includes('surge')?Math.min(3.0,sp):Math.min(0.55,sp);
 const sg=surge({v:realV,Dh:P.Dh,Dp:P.Dp,L:inFull});const emw=s.mudSG+sg.dPkPa/(G*Math.max(tvd,1));
 if(j.tag.includes('surge')&&phase=='run')msg=emw>LIM?'⚠ Surge: EMW at shoe '+emw.toFixed(2)+' SG above the SIM weak-zone limit '+LIM+' SG. Slow down!':'Running speed back to 0.55 m/s to stay under the '+LIM+' SG weak zone';
 const swab=phase=='work'||phase=='tight'?s.mudSG-surge({v:0.4,Dh:P.Dh,Dp:P.Dp,L:inFull}).dPkPa/(G*Math.max(tvd,1)):null;
 const sinceFill=(k-1)%P.fillEvery+run,fill=j.tag.includes('fill')&&u<0.4;const emptyM=fill?0:sinceFill*JL;if(fill)msg='Fill-up: float valves closed, top up the string with mud ('+(Math.PI/4*(P.Dp-2*P.e.p.t*0.0254)**2*P.fillEvery*JL).toFixed(1)+' m³ per 10 joints)';
 if(j.tag.includes('shoe13')&&!msg)msg='Passing 13-3/8" shoe at '+f0(P.prev.shoeMD)+' m MD: into 12-1/4" open hole';if(ph=='landed')msg='Casing landed: 9-5/8" shoe at '+f0(s.shoeMD)+' m MD / '+f0(s.shoeTVD)+' m TVD · ready to cement';
 if(!msg&&k<=4)msg=u<M?'Joint '+k+': pick up, stab and make up to torque':'Joint '+k+': run in, set slips';
 const hl=hookload(w,inFull,s.mudSG,{kgm:P.kgm})+over;return {t,k,u,phase:ph||phase,shoeMD:inFull,shoeTVD:tvd,joints:ph?P.N:k-1+(run>0.999?1:0),hl,over,v:realV,emw,swab,emptyM,fill,msg,limit:LIM,pore:1.20}}
const f0=x=>Math.round(x).toLocaleString('en-AU');
// ---- view ----
let THREE;export async function open(mode='casing',{demo=false,speed=1}={}){THREE=THREE||await import('three');const w=well(),P=casingPlan(w);
 document.getElementById('ops3d')?.remove();const S=document.createElement('section');S.id='ops3d';S.dataset.mode=mode;
 S.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#05080d;color:#e6eef8;font:13px system-ui;overflow:hidden';
 S.innerHTML=`<canvas id=o3c style="position:absolute;inset:0;width:100%;height:100%"></canvas>
 <div style="position:absolute;left:10px;top:10px;right:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;pointer-events:none"><b style="font-size:15px">Casing run · 9-5/8" intermediate</b><span id=o3sim style="background:#b58900;color:#000;border-radius:6px;padding:1px 7px;font-weight:700">SIM</span><small style="opacity:.75">SIM proposal A · radial scale ×${RX} · teaching animation, not an engineered run</small>${demo?'':'<button id=o3x style="margin-left:auto;pointer-events:auto">✕</button>'}</div>
 <div id=o3hud style="position:absolute;left:10px;bottom:calc(12px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,auto);gap:4px 14px;background:#0b1320cc;border:1px solid #2a3a50;border-radius:10px;padding:8px 10px;font-variant-numeric:tabular-nums;max-width:calc(100% - 20px)"></div>
 <div id=o3msg style="position:absolute;left:50%;top:48px;transform:translateX(-50%);max-width:min(560px,92vw);text-align:center;background:#0b1320dd;border:1px solid #2a3a50;border-radius:10px;padding:6px 10px;opacity:0;transition:opacity .3s"></div>
 <canvas id=o3prof width=160 height=220 style="position:absolute;right:10px;top:44px;width:120px;height:165px;background:#0b1320cc;border:1px solid #2a3a50;border-radius:8px"></canvas>`;
 document.body.appendChild(S);const cv=S.querySelector('#o3c'),R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(2,devicePixelRatio));
 const sc=new THREE.Scene();sc.background=new THREE.Color(0x05080d);sc.fog=new THREE.Fog(0x05080d,120,420);const cam=new THREE.PerspectiveCamera(50,1,0.5,3000);
 sc.add(new THREE.HemisphereLight(0xbcd4ff,0x223322,1.1));const dl=new THREE.DirectionalLight(0xffffff,1.4);dl.position.set(50,80,30);sc.add(dl);
 const V=md=>{const p=w.at(md);return new THREE.Vector3(p[1],-p[2],-p[0])};// x=E, y=-TVD, z=-N
 const pts=[];for(let m=0;m<=P.s.shoeMD+0.01;m+=2)pts.push(V(m));const curve=new THREE.CatmullRomCurve3(pts);const segs=pts.length-1;
 const tube=(r,col,op,to=P.s.shoeMD,from=0,side=THREE.FrontSide)=>{const a=Math.round(from/2),b=Math.round(to/2),c=new THREE.CatmullRomCurve3(pts.slice(a,b+1));const m=new THREE.Mesh(new THREE.TubeGeometry(c,Math.max(2,b-a),r,24,false),new THREE.MeshStandardMaterial({color:col,transparent:op<1,opacity:op,side,depthWrite:op>=1,roughness:.6,metalness:.2}));sc.add(m);return m};
 const IN=0.0254,r=x=>x*IN/2*RX;
 tube(r(12.25),0x7a5a3a,0.22,P.s.shoeMD,P.prev.shoeMD,THREE.DoubleSide);tube(r(17.5),0x6b4f33,0.12,P.prev.shoeMD,0,THREE.DoubleSide);tube(r(13.375),0x8a96a6,0.35,P.prev.shoeMD,0,THREE.DoubleSide);
 // formation rings every 50 m in open hole
 for(let m=Math.ceil(P.prev.shoeMD/50)*50;m<P.s.shoeMD;m+=50){const g=new THREE.Mesh(new THREE.TorusGeometry(r(12.25),0.12,6,32),new THREE.MeshBasicMaterial({color:0x8b6b44}));g.position.copy(V(m));g.lookAt(V(m+1));sc.add(g)}
 // run string: full tube revealed with drawRange
 const cs=new THREE.TubeGeometry(curve,segs,r(9.625),20,false),csM=new THREE.Mesh(cs,new THREE.MeshStandardMaterial({color:0xc9d3df,metalness:.55,roughness:.35}));sc.add(csM);const perSeg=20*6;
 const shoe=new THREE.Mesh(new THREE.SphereGeometry(r(9.625)*1.05,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xff8c1a,roughness:.5}));sc.add(shoe);
 const ring=(rad,col,n)=>{const m=new THREE.InstancedMesh(new THREE.TorusGeometry(rad,rad*0.09,6,28),new THREE.MeshStandardMaterial({color:col,metalness:.3,roughness:.5}),n);sc.add(m);return m};
 const collars=ring(r(10.6)*0.98,0x9fb3c8,160),cents=ring(r(11.8),0x3ddc84,P.cent.length),fc=ring(r(10.9),0xff8c1a,1);
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(9,9,0.6,40),new THREE.MeshStandardMaterial({color:0x3a4250}));floor.position.y=0.3+3;sc.add(floor);
 const ground=new THREE.Mesh(new THREE.CircleGeometry(160,48),new THREE.MeshStandardMaterial({color:0x2f3b2a,transparent:true,opacity:.55,side:THREE.DoubleSide}));ground.rotation.x=-Math.PI/2;sc.add(ground);
 const der=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(2.5,8,46,4,6,true)),new THREE.LineBasicMaterial({color:0xffc94a}));der.position.y=26;sc.add(der);
 const newJ=new THREE.Mesh(new THREE.CylinderGeometry(r(9.625),r(9.625),JL,20),csM.material);sc.add(newJ);
 const dummy=new THREE.Object3D(),place=(im,i,md)=>{dummy.position.copy(V(md));dummy.lookAt(V(md+0.5));dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix)};
 const hud=S.querySelector('#o3hud'),msg=S.querySelector('#o3msg'),pf=S.querySelector('#o3prof').getContext('2d');
 const prof=(st)=>{const c=pf,W_=160,H=220,R_=w.W.S.rows,mxH=Math.max(...R_.map(q=>Math.hypot(q.n,q.e)))||1,mxV=R_.at(-1).tvd,sx=x=>12+x/mxH*(W_-24),sy=z=>14+z/mxV*(H-28);c.clearRect(0,0,W_,H);
  c.strokeStyle='#4a5a70';c.lineWidth=2;c.beginPath();R_.forEach((q,i)=>c[i?'lineTo':'moveTo'](sx(Math.hypot(q.n,q.e)),sy(q.tvd)));c.stroke();
  c.strokeStyle='#c9d3df';c.lineWidth=3;c.beginPath();R_.filter(q=>q.md<=st.shoeMD).forEach((q,i)=>c[i?'lineTo':'moveTo'](sx(Math.hypot(q.n,q.e)),sy(q.tvd)));c.stroke();
  const p=w.at(st.shoeMD);c.fillStyle='#ff8c1a';c.beginPath();c.arc(sx(Math.hypot(p[0],p[1])),sy(p[2]),4,0,7);c.fill();c.fillStyle='#9ab';c.font='10px system-ui';c.fillText('Section · SIM',6,H-4)};
 const resize=()=>{const W_=S.clientWidth,H=S.clientHeight;R.setSize(W_,H,false);cam.aspect=W_/H;cam.updateProjectionMatrix()};resize();addEventListener('resize',resize);
 let t0=performance.now(),seekT=null,alive=true,camP=new THREE.Vector3(30,20,30),camL=new THREE.Vector3();
 const api={P,w,mode,stateAt:t=>stateAt(P,w,t),get t(){return seekT??(performance.now()-t0)/1000*speed},seek(t){seekT=t},play(){if(seekT!=null){t0=performance.now()-seekT/speed*1000;seekT=null}},close(){alive=false;S.remove();removeEventListener('resize',resize)},last:null};
 window.dwOps=api;S.querySelector('#o3x')?.addEventListener('click',api.close);
 const frame=()=>{if(!alive)return;const t=Math.min(api.t,P.T),s=stateAt(P,w,t);api.last=s;
  const seg=Math.max(1,Math.round(s.shoeMD/2));cs.setDrawRange(0,seg*perSeg);shoe.position.copy(V(s.shoeMD));shoe.lookAt(V(s.shoeMD+1));shoe.rotateX(Math.PI/2);
  let n=0;for(let m=s.shoeMD-SHOE-JL;m>0&&n<160;m-=JL)place(collars,n++,m);collars.count=n;
  P.cent.forEach((o,i)=>place(cents,i,Math.max(0.1,s.shoeMD-o)));cents.count=P.cent.filter(o=>s.shoeMD-o>0).length;place(fc,0,Math.max(0.1,s.shoeMD-SHOE-JL*2));fc.count=s.shoeMD>SHOE+JL*2?1:0;
  [collars,cents,fc].forEach(m=>m.instanceMatrix.needsUpdate=true);
  newJ.visible=s.phase=='makeup';if(newJ.visible){const u=s.u/0.35;newJ.position.set(0,3+JL/2+ (1-Math.min(1,u*1.4))*JL*0.8,0)}
  // camera: surface for first joints, then follow the shoe from the side
  const sp=V(s.shoeMD),tg=V(Math.max(0,s.shoeMD-8)),near=s.shoeMD<60;const side=new THREE.Vector3().subVectors(V(s.shoeMD+2),sp).cross(new THREE.Vector3(0,1,0));if(side.lengthSq()<1e-6)side.set(1,0,0);side.normalize();
  const want=near?new THREE.Vector3(34,22,40):tg.clone().add(side.multiplyScalar(30)).add(new THREE.Vector3(0,10,0)),look=near?new THREE.Vector3(0,-Math.min(20,s.shoeMD/2),0):sp;
  if(s.phase=='landed'){want.copy(sp).add(new THREE.Vector3(60,40,60))}camP.lerp(want,seekT!=null?1:0.06);camL.lerp(look,seekT!=null?1:0.08);cam.position.copy(camP);cam.lookAt(camL);
  const tn=s.hl/G,ok=s.emw<=s.limit;hud.innerHTML=[['Joints',`${s.joints} / ${P.N}`],['Shoe MD',`${f0(s.shoeMD)} m`],['Shoe TVD',`${f0(s.shoeTVD)} m`],['Hookload',`${f0(s.hl)} kN · ${tn.toFixed(0)} t`],['Run speed',`${s.v.toFixed(2)} m/s`],['Phase',s.phase],
   ['Surge EMW',`<span style="color:${ok?'#3ddc84':'#ff6b6b'}">${s.emw.toFixed(2)}</span> / ${s.limit} SG`],['Swab EMW',s.swab==null?'–':`<span style="color:${s.swab<s.pore?'#ff6b6b':'#3ddc84'}">${s.swab.toFixed(2)}</span> / ${s.pore} SG`],['Unfilled',`${s.emptyM.toFixed(0)} m${s.fill?' · filling':''}`]]
   .map(([a,b])=>`<div><div style="opacity:.65;font-size:11px">${a}</div><b>${b}</b></div>`).join('');
  msg.textContent=s.msg;msg.style.opacity=s.msg?1:0;prof(s);R.render(sc,cam);requestAnimationFrame(frame)};frame();return api}
const RX=25;
if(typeof location!='undefined'&&new URLSearchParams(location.search).get('demo')=='casing'){const q=new URLSearchParams(location.search);open('casing',{demo:true,speed:+q.get('speed')||1})}
