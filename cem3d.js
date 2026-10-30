// v5.12/5.13 Cementing in 3D + WOC + drill out the shoe + FIT/LOT (SIM). ?demo=cement3d (full) · ?demo=fit (from drill-out) · &test=LOT
// Uses the 9-5/8" SIM plan from ops3d.js/cement.js. SIM teaching animation, not an engineered job. Never LIVE. No network.
import {well,G,JL,SHOE} from './ops3d.js';import * as CM from './cement.js';import * as F from './fitlot.js';
const RX=25,IN=0.0254,f0=x=>Math.round(x).toLocaleString('en-AU');
// ---- timeline (animation seconds) ----
export const PH=[['cement',0,40],['bump',40,44],['woc',44,56],['drill',56,78],['fit',78,100]];
export function timeline(C,mode='FIT'){const items=F.drillOut(C),T=F.test(C,{mode}),tEnd=T.pts.at(-1).t;return {C,items,T,tEnd,dur:PH.at(-1)[2]}}
export function stateAt(L,t){const C=L.C;t=Math.max(0,Math.min(L.dur,t));const ph=PH.find(p=>t<p[2])?.[0]||'fit',u=(a,b)=>Math.max(0,Math.min(1,(t-a)/(b-a)));
 const V=C.Vend*u(0,40),c=CM.stateAt(C,V);const s={t,ph,V,cem:c,an:c.an,cs:c.cs,pump:c.pump,ecd:c.ecd,toc:c.cementTop,msg:c.msg};
 // plugs: bottom plug runs ahead of the lead slurry, top plug behind the tail slurry; both stop on the float collar
 const vSp=C.cum[0][1],vTl=C.cum[2][1];s.bplug=V>=vSp?Math.min(C.fc,(V-vSp)/C.capC):null;s.tplug=V>=vTl?Math.min(C.fc-0.8,(V-vTl)/C.capC):null;s.burst=V>=vSp+C.capC*C.fc;
 s.woch=ph=='cement'?0:ph=='bump'?0:F.WOC_H*u(44,56);s.ucs=F.ucs(s.woch);s.ready=s.ucs>=F.DRILL_OUT_UCS;s.bit=null;s.item=null;s.fit=null;
 if(ph=='bump')s.msg='Plug bump: top plug lands on the float collar · pressure up 3.5 MPa · bleed off · floats hold (no flow back)';
 if(ph=='woc')s.msg=`WOC (wait on cement) ${s.woch.toFixed(1)} h · tail strength ${s.ucs.toFixed(1)} MPa${s.ready?' · strong enough to drill out (≥ '+F.DRILL_OUT_UCS+' MPa)':' · do not drill yet'}`;
 if(ph=='woc'||ph=='bump'){s.pump=ph=='bump'?c.pump:0;s.ecd=C.shoeTVD?c.ecd:0}
 if(ph=='drill'||ph=='fit'){const I=L.items,top=I[0].top-30,end=I.at(-1).bot,tot=I.reduce((a,i)=>a+(i.bot-i.top)/i.rop,0),tr=(end-top)*0+0;
  // first 15%: trip in to top of plugs; rest: drill each item, time-weighted by ROP
  const x=u(56,78);if(x<0.15){s.bit=top+(I[0].top-top)*x/0.15;s.item={n:'Run in hole to top of cement',rop:0,wob:0,rpm:0}}else{let r=(x-0.15)/0.85*tot;s.bit=end;s.item=I.at(-1);for(const i of I){const h=(i.bot-i.top)/i.rop;if(r<=h){s.bit=i.top+r*i.rop;s.item=i;break}r-=h}}
  if(ph=='fit')s.bit=end;s.pump=0;s.msg=x<0.15?'Run in with 8-1/2" bit · tag cement on top plug':'Drilling '+s.item.n.toLowerCase()+' · '+s.item.wob+' kN WOB · '+s.item.rpm+' rpm';s.removed=I.filter(i=>s.bit>=i.bot-1e-6).map(i=>i.k)}
 if(ph=='fit'){const T=L.T,tt=T.pts.at(-1).t*u(78,98),pts=T.pts.filter(q=>q.t<=tt),q=pts.at(-1)||{t:0,v:0,p:0,pump:1};s.fit={pts,q,emw:T.mud+q.p/(G*T.tvd),lo:T.lo&&q.t>=T.lo.t?T.lo:null,done:t>=98};
  s.msg=s.fit.done?T.msg:q.pump?`${T.mode}: BOP closed · pump 50 L/min down the drill pipe · ${(q.p/1000).toFixed(2)} MPa = ${s.fit.emw.toFixed(2)} SG EMW${s.fit.lo?' · leak-off seen, line bends over':''}`:`${T.mode}: pump stopped · shut in, watch the pressure`}
 return s}
// ---- view ----
let THREE;export async function open({mode,start=0,speed=1}={}){THREE=THREE||await import('three');const q=new URLSearchParams(location.search);mode=mode||(q.get('test')=='LOT'?'LOT':'FIT');
 const C=CM.plan(),L=timeline(C,mode),w=C.w;document.getElementById('cem3d')?.remove();const S=document.createElement('section');S.id='cem3d';
 S.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#05080d;color:#e6eef8;font:13px system-ui;overflow:hidden';
 S.innerHTML=`<canvas id=c3c style="position:absolute;inset:0;width:100%;height:100%"></canvas>
 <div style="position:absolute;left:10px;top:8px;right:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="font-size:15px">Cement · drill out · ${mode}</b><span style="background:#b58900;color:#000;border-radius:6px;padding:1px 7px;font-weight:700">SIM</span><small style="opacity:.75">9-5/8" SIM plan · radial scale ×${RX} · teaching model</small><button id=c3x style="margin-left:auto">✕</button></div>
 <div id=c3ph style="position:absolute;left:10px;top:38px;display:flex;gap:4px;flex-wrap:wrap">${[['cement','Cement',0],['woc','WOC',44],['drill','Drill out',56],['fit',mode,78]].map(([k,n,t])=>`<button data-t=${t} data-k=${k} style="background:#1b2636;color:#e6eef8;border:1px solid #2a3a50;border-radius:8px;padding:5px 9px;min-height:32px">${n}</button>`).join('')}</div>
 <div id=c3msg style="position:absolute;left:50%;top:80px;transform:translateX(-50%);width:min(560px,92vw);text-align:center;background:#0b1320dd;border:1px solid #2a3a50;border-radius:10px;padding:6px 10px;box-sizing:border-box"></div>
 <canvas id=c3plot width=320 height=170 style="position:absolute;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));width:min(320px,calc(100% - 20px));background:#0b1320dd;border:1px solid #2a3a50;border-radius:8px"></canvas>
 <div id=c3hud style="position:absolute;left:10px;bottom:calc(190px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,auto);gap:4px 12px;background:#0b1320cc;border:1px solid #2a3a50;border-radius:10px;padding:8px 10px;font-variant-numeric:tabular-nums;max-width:calc(100% - 20px);box-sizing:border-box"></div>
 <style>@media (max-width:600px){#c3leg{display:none!important}}</style><div id=c3leg style="position:absolute;right:10px;top:116px;display:flex;flex-direction:column;gap:2px;font-size:11px;background:#0b1320aa;padding:4px 6px;border-radius:8px">${Object.values(CM.FL).map(f=>`<span><i style="display:inline-block;width:10px;height:10px;background:${f.c};border-radius:2px"></i> ${f.n}</span>`).join('')}</div>`;
 document.body.appendChild(S);const cv=S.querySelector('#c3c'),R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(2,devicePixelRatio));
 const sc=new THREE.Scene();sc.background=new THREE.Color(0x05080d);const cam=new THREE.PerspectiveCamera(50,1,0.5,6000);sc.add(new THREE.HemisphereLight(0xbcd4ff,0x223322,1.1));const dl=new THREE.DirectionalLight(0xffffff,1.3);dl.position.set(50,80,30);sc.add(dl);
 const V=md=>{const p=w.at(md);return new THREE.Vector3(p[1],-p[2],-p[0])},r=x=>x*IN/2*RX,N=60,dm=C.shoe/N;
 const seg=(a,b,rad,col,op,side=THREE.FrontSide)=>{const pts=[];for(let m=a;m<=b+1e-6;m+=Math.max(0.5,(b-a)/6))pts.push(V(m));if(pts.length<2)pts.push(V(b));const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),6,rad,18,false);
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:col,transparent:op<1,opacity:op,side,depthWrite:op>=1,roughness:.7,metalness:.1}));sc.add(m);return m};
 // hole + previous casing (13-3/8") + annulus cells + casing wall + inside cells
 seg(C.prev,C.shoe+6,r(12.25),0x7a5a3a,0.18,THREE.DoubleSide);seg(0,C.prev,r(13.375),0x8a96a6,0.3,THREE.DoubleSide);
 const ann=[],ins=[];for(let i=0;i<N;i++){const a=i*dm,b=(i+1)*dm,ro=a<C.prev?r(12.3):r(11.6);ann.push(seg(a,b,ro,0x6b5a3a,0.85));ins.push(seg(a,b,r(8.5),0x6b5a3a,1))}
 const csg=seg(0,C.shoe,r(9.625),0xc9d3df,0.32,THREE.DoubleSide);
 const mk=(geo,col)=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:col,roughness:.5}));sc.add(m);return m},orient=(m,md)=>{m.position.copy(V(md));m.lookAt(V(md+1));m.rotateX(Math.PI/2)};
 const shoe=mk(new THREE.CylinderGeometry(r(9.625)*1.08,r(9.625)*0.7,SHOE*RX*0.4,24),0xff8c1a);orient(shoe,C.shoe-0.3);
 const fcol=mk(new THREE.CylinderGeometry(r(9.9),r(9.9),0.5*RX*0.4,24),0xff8c1a);orient(fcol,C.fc);
 const cents=[];for(const o of C.P.cent){const m=new THREE.Mesh(new THREE.TorusGeometry(r(11.6),r(11.6)*0.07,6,24),new THREE.MeshStandardMaterial({color:0x3ddc84}));m.position.copy(V(C.shoe-o));m.lookAt(V(C.shoe-o+1));sc.add(m);cents.push(m)}
 const bplug=mk(new THREE.CylinderGeometry(r(8.6),r(8.6),4,20),0xe53935),tplug=mk(new THREE.CylinderGeometry(r(8.6),r(8.6),4,20),0x1e88e5);
 const bit=mk(new THREE.SphereGeometry(r(8.5),20,12),0xffd54f),dp=seg(0,1,r(5),0x8899aa,1);dp.visible=false;const rat=seg(C.shoe,C.shoe+1.5+3,r(8.5),0x2a1d12,0.9);
 const der=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(2.5,8,46,4,6,true)),new THREE.LineBasicMaterial({color:0xffc94a}));der.position.y=26;sc.add(der);
 const col={};for(const k in CM.FL)col[k]=new THREE.Color(CM.FL[k].c);const set=(m,k,dark)=>{m.material.color.copy(col[k]);if(dark&&(k=='tail'||k=='lead'))m.material.color.multiplyScalar(1-0.35*dark)};
 const hud=S.querySelector('#c3hud'),msg=S.querySelector('#c3msg'),pc=S.querySelector('#c3plot'),y=pc.getContext('2d');
 const resize=()=>{const W_=S.clientWidth,H=S.clientHeight;R.setSize(W_,H,false);cam.aspect=W_/H;cam.updateProjectionMatrix()};resize();addEventListener('resize',resize);
 let t0=performance.now()-start/speed*1000,seekT=null,alive=true,camP=new THREE.Vector3(),camL=new THREE.Vector3(),first=true,dpMd=-1;const cemH=[];
 const api={C,L,mode,stateAt:t=>stateAt(L,t),get t(){return seekT??(performance.now()-t0)/1000*speed},seek(t){seekT=t},play(){if(seekT!=null){t0=performance.now()-seekT/speed*1000;seekT=null}},close(){alive=false;S.remove();removeEventListener('resize',resize)},last:null};
 window.dwCem3d=api;S.querySelector('#c3x').onclick=api.close;S.querySelectorAll('#c3ph button').forEach(b=>b.onclick=()=>{seekT=null;t0=performance.now()-(+b.dataset.t)/speed*1000});
 const plot=s=>{y.clearRect(0,0,320,170);y.strokeStyle='#2a3a4a';y.strokeRect(36,16,278,128);y.fillStyle='#9ab';y.font='11px system-ui';
  if(s.fit){const T=L.T,pm=Math.max(...T.pts.map(q=>q.p))/1000*1.15,tm=T.pts.at(-1).t,X=t=>36+278*t/tm,Y=p=>144-128*p/1000/pm;y.fillText(T.mode+': pressure (MPa) vs time (min) · SIM',4,12);y.fillText(pm.toFixed(1),4,24);y.fillText('0',24,146);y.fillText(tm.toFixed(0)+' min',276,160);
   if(T.mode=='LOT'){y.strokeStyle='#ff6b6b55';y.setLineDash([4,3]);y.beginPath();y.moveTo(36,Y(T.Plo));y.lineTo(314,Y(T.Plo));y.stroke();y.setLineDash([])}
   y.strokeStyle='#4dabf7';y.lineWidth=2;y.beginPath();s.fit.pts.forEach((q,i)=>i?y.lineTo(X(q.t),Y(q.p)):y.moveTo(X(q.t),Y(q.p)));y.stroke();y.lineWidth=1;
   if(s.fit.lo){y.fillStyle='#ff6b6b';y.beginPath();y.arc(X(s.fit.lo.t),Y(s.fit.lo.p),4,0,7);y.fill();y.fillText('leak-off '+(L.T.emwLO).toFixed(2)+' SG',X(s.fit.lo.t)-40,Y(s.fit.lo.p)-8)}return}
  if(s.ph=='woc'||s.ph=='drill'){const X=h=>36+278*h/F.WOC_H,Y=m=>144-128*m/F.UCS_MAX;y.fillText('Tail slurry strength (MPa) vs WOC time (h) · SIM',4,12);y.strokeStyle='#ffd54f55';y.beginPath();y.moveTo(36,Y(F.DRILL_OUT_UCS));y.lineTo(314,Y(F.DRILL_OUT_UCS));y.stroke();
   y.strokeStyle='#ffd54f';y.lineWidth=2;y.beginPath();for(let h=0;h<=s.woch+1e-6;h+=0.1)h?y.lineTo(X(h),Y(F.ucs(h))):y.moveTo(X(h),Y(F.ucs(h)));y.stroke();y.lineWidth=1;y.fillText(F.UCS_MAX+'',8,24);y.fillText(F.WOC_H+' h',286,160);return}
  y.fillText('Cement: pump pressure (MPa) vs pumped (m³) · SIM',4,12);const pm=Math.max(8,...cemH.map(h=>h.p/1000))*1.1;y.strokeStyle='#ffb74d';y.lineWidth=2;y.beginPath();cemH.forEach((h,i)=>{const X=36+278*h.V/C.Vend,Y=144-128*h.p/1000/pm;i?y.lineTo(X,Y):y.moveTo(X,Y)});y.stroke();y.lineWidth=1;y.fillText(pm.toFixed(0),8,24);y.fillText(C.Vend.toFixed(0)+' m³',280,160)};
 const frame=()=>{if(!alive)return;const t=Math.min(api.t,L.dur),s=stateAt(L,t);api.last=s;
  if(s.ph=='cement'){if(cemH.length&&s.V<cemH.at(-1).V)cemH.length=0;if(!cemH.length||s.V>cemH.at(-1).V+0.3)cemH.push({V:s.V,p:s.pump})}
  const dark=Math.min(1,s.ucs/F.UCS_MAX*2),k2=i=>Math.min(s.an.length-1,Math.round((i+0.5)*s.an.length/N));
  for(let i=0;i<N;i++){set(ann[i],s.an[k2(i)],dark);const md=(i+0.5)*dm;set(ins[i],s.cs[k2(i)],dark);ins[i].visible=!(s.bit!=null&&md<s.bit&&md>C.fc-1)}
  bplug.visible=s.bplug!=null&&!(s.removed||[]).includes('plugs');if(bplug.visible)orient(bplug,Math.max(1,s.bplug));tplug.visible=s.tplug!=null&&!(s.removed||[]).includes('plugs');if(tplug.visible)orient(tplug,Math.max(1,s.tplug-1.6));
  fcol.visible=!(s.removed||[]).includes('fc');shoe.visible=!(s.removed||[]).includes('shoe');rat.material.color.set(s.bit!=null&&s.bit>C.shoe+0.1?0x3d2a18:0x2a1d12);rat.visible=s.bit!=null&&s.bit>C.shoe;
  bit.visible=s.bit!=null;if(bit.visible){bit.position.copy(V(s.bit));const b=Math.round(s.bit);if(Math.abs(b-dpMd)>=3){sc.remove(dp);dp.geometry.dispose();const ndp=seg(0,Math.max(2,s.bit-1),r(5),0x8899aa,1);Object.assign(dp,{geometry:ndp.geometry});sc.remove(ndp);sc.add(dp);dpMd=b}dp.visible=true}else dp.visible=false;
  // camera: long side view while cementing, close at shoe after
  const close=s.ph!='cement',fo=V(close?C.shoe-10:C.shoe*0.62),side=new THREE.Vector3(1,0.25,1).normalize(),want=fo.clone().add(side.multiplyScalar(close?80:Math.max(500,C.shoe*0.42)));
  camP.lerp(want,first||seekT!=null?1:0.05);camL.lerp(fo,first||seekT!=null?1:0.06);first=false;cam.position.copy(camP);cam.lookAt(camL);
  const items=[['Phase',s.ph=='fit'?L.T.mode:s.ph=='woc'?'WOC':s.ph=='drill'?'drill out':s.ph],['Pumped',`${s.V.toFixed(1)} / ${C.Vend.toFixed(1)} m³`],['Pump',`${(s.pump/1000).toFixed(2)} MPa`],
   ['Top of cement',s.toc==null?'–':f0(s.toc)+' m MD'],['WOC',`${s.woch.toFixed(1)} h`],['Tail strength',`<span style="color:${s.ready?'#3ddc84':'#ffd54f'}">${s.ucs.toFixed(1)}</span> MPa`],
   ['Bit MD',s.bit==null?'–':f0(s.bit)+' m'],['Drilling',s.item?s.item.n:'–'],s.fit?['EMW at shoe',`${s.fit.emw.toFixed(2)} SG`]:['ECD at shoe',`${s.ecd.toFixed(2)} / ${CM.FRAC} SG`]];
  hud.innerHTML=items.map(([a,b])=>`<div><div style="opacity:.65;font-size:11px">${a}</div><b>${b}</b></div>`).join('');msg.textContent=s.msg;
  S.querySelectorAll('#c3ph button').forEach(b=>b.style.borderColor=b.dataset.k==s.ph||(b.dataset.k=='cement'&&s.ph=='bump')?'#ffd54f':'#2a3a50');plot(s);R.render(sc,cam);requestAnimationFrame(frame)};frame();return api}
if(typeof location!='undefined'){const d=new URLSearchParams(location.search).get('demo'),sp=+new URLSearchParams(location.search).get('speed')||1;if(d=='cement3d')open({speed:sp});if(d=='fit')open({start:56,speed:sp})}
