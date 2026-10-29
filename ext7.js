// ext7.js v4.4: bit-depth tracking + new-pipe animation.
// The 3D string/bit follow bit depth from data (Live WITSML, Replay, or the SIM-TEST timeline), smoothly interpolated
// between polls. Hole depth vs bit depth shown separately. On each connection a joint/stand is lifted from the catwalk or
// racking board, stabbed, spun up, slips pulled and lowered; a tool-joint ring rides down with it. Read-only: no network calls here.
let C,S,THREE,P,HUD,BIT,HOLE,ANIM=null,TJ=null,CAP='';
const $=id=>document.getElementById(id);const FT=0.3048;
const met=()=>!window.U||U.sys=='metric';const L=ft=>met()?ft*FT:ft,LU=()=>met()?'m':'ft';
const KEY='dw-bit-opt';const O=Object.assign({follow:false,anim:true,spd:30},JSON.parse(localStorage.getItem(KEY)||'{}'));const save=()=>localStorage.setItem(KEY,JSON.stringify(O));
// ---- state ----
const T={mode:'sim',tag:'SIM',bd:null,hd:null,disp:{bd:null,hd:null},seg:null,conns:[],connKey:'',lastSlips:false,liveConnN:0,lastSample:null};
const ST={on:false,playing:false,t:0,t0:0,t1:0,rows:null,conns:[],lt:0};// SIM-TEST timeline
const at=(rows,t,k)=>{let lo=0,hi=rows.length-1;if(!rows.length)return null;if(t<=rows[0].t)return rows[0][k];if(t>=rows[hi].t)return rows[hi][k];
 while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m].t<=t)lo=m;else hi=m}const a=rows[lo],b=rows[hi],f=(t-a.t)/((b.t-a.t)||1);return Number.isFinite(a[k])&&Number.isFinite(b[k])?a[k]+(b[k]-a[k])*f:a[k]};
function wml(){return GX.witsml?.WML}
function source(){const W=wml();if(ST.on)return{mode:'simtest',tag:'SIM-TEST'};
 if(W&&W.mode=='replay'&&W.rp)return{mode:'replay',tag:'REPLAY'};
 if(W&&W.liveMode&&W.healthy&&W.healthy())return{mode:'live',tag:W.simulated?'SIMULATED':'LIVE'};
 return{mode:'sim',tag:'SIM'}}
let RC={k:'',rows:[]};function dataRows(){const d=GX.witsml?.data?.();if(!d)return[];const k=d.src+':'+d.rows.length+':'+(d.rows.at(-1)?.t??'');if(RC.k!==k){RC={k,rows:GX.conn.fromWitsml(d).rows};
  try{const r=GX.conn.detect(RC.rows,GX.conn.opt?.()||{});T.conns=r.connections;T.lenMed=r.kpi?.medianLen_m}catch{T.conns=[]}}return RC.rows}
// ---- per-frame target ----
function target(now){const s=source();T.mode=s.mode;T.tag=s.tag;
 if(s.mode=='simtest'){const R=ST.rows,t=ST.t;const bd=at(R,t,'bd'),hd=at(R,t,'hd');return{bd:bd/FT,hd:hd/FT,t,bh:at(R,t,'bh'),hkl:at(R,t,'hkl'),flow:at(R,t,'flow'),rpm:at(R,t,'rpm'),conns:ST.conns}}
 if(s.mode=='replay'){const R=dataRows(),t=wml().rp.t/1000;const bd=at(R,t,'bd'),hd=at(R,t,'hd');return{bd:Number.isFinite(bd)?bd/FT:S.bitDepthLive_ft,hd:Number.isFinite(hd)?hd/FT:S.md,t,conns:T.conns}}
 if(s.mode=='live'){const R=dataRows(),x=R.at(-1);if(!x)return null;const bd=Number.isFinite(x.bd)?x.bd/FT:S.bitDepthLive_ft,hd=Number.isFinite(x.hd)?x.hd/FT:S.md;
  // interpolate between polls: glide from the displayed value to the new sample over the measured poll interval
  if(!T.seg||T.seg.key!==x.t){const dur=Math.min(20,Math.max(0.5,T.seg?(now-T.seg.at)/1000:1));T.seg={key:x.t,at:now,dur,from:{bd:T.disp.bd??bd,hd:T.disp.hd??hd},to:{bd,hd}}}
  const f=Math.min(1,(now-T.seg.at)/1000/T.seg.dur),g=T.seg;return{bd:g.from.bd+(g.to.bd-g.from.bd)*f,hd:g.from.hd+(g.to.hd-g.from.hd)*f,live:true}}
 return{bd:C.PH.bitDepth(S),hd:S.md,phys:true}}
function drive(tg){if(!tg||tg.phys)return;let bd=tg.bd,hd=tg.hd;if(!Number.isFinite(hd))hd=S.md;if(!Number.isFinite(bd))bd=hd;hd=Math.max(hd,bd);
 if(T.mode=='simtest'){S.connected=true;S.slips=tg.hkl<300;S.dw.quill=Math.max(0,Math.min(28.5,tg.bh??S.dw.quill));S.Q=(tg.flow||0)/3.785412;S.td.rpm=tg.rpm||0;S.bitRpm=S.td.rpm;S.hook=(tg.hkl||0)/4.448222;S.wob=0;
  if(S.pumps?.length){const n=S.Q>20?Math.max(1,Math.min(S.pumps.length,Math.ceil(S.Q/450))):0;S.pumps.forEach((p,i)=>{p.on=i<n;p.cmd=p.spm=p.on?+(S.Q/n/4.36).toFixed(1):0})}}
 S.md=hd;const top=S.connected&&!S.slips?S.dw.quill:S.stickup;S.L=bd+top/FT;S.bitDepthLive_ft=bd}
// ---- 3D: bit + hole-bottom markers, new-pipe animation ----
const wp=u=>{const w=C.getWell?.();if(!w)return null;const p=w.getPointAt(Math.max(0,Math.min(1,u)));return C.UG.localToWorld(p)};
function markers(bd,hd){if(!BIT){BIT=new THREE.Mesh(new THREE.SphereGeometry(0.35,14,10),new THREE.MeshBasicMaterial({color:0x33ddff,depthTest:false}));BIT.renderOrder=9;BIT.name='bitMarker';
  HOLE=new THREE.Mesh(new THREE.TorusGeometry(0.45,0.07,6,18),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false}));HOLE.renderOrder=9;HOLE.name='holeMarker';C.scene.add(BIT,HOLE)}
 const md=S.md||1,a=wp(bd/md),b=wp(1);BIT.visible=!!a;HOLE.visible=!!b&&hd-bd>0.5/FT;if(a)BIT.position.copy(a);if(b){HOLE.position.copy(b);HOLE.lookAt(C.cam.position)}return a}
function follow(p){if(!O.follow||!p)return;const ctl=C.ctl,cam=C.cam,d=cam.position.clone().sub(ctl.target),n=ctl.target.clone().lerp(p,0.08);cam.position.copy(n.clone().add(d));ctl.target.copy(n);ctl.update?.()}
function pipeMesh(len){const g=new THREE.Group();g.name='newPipe';const m=new THREE.MeshStandardMaterial({color:0x8899aa,metalness:0.7,roughness:0.35});
 const body=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,len,10),m);g.add(body);const tj=new THREE.MeshStandardMaterial({color:0xffaa22,emissive:0x552200});
 const box=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,0.5,10),tj);box.position.y=len/2-0.25;const pin=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.13,0.4,10),tj);pin.position.y=-len/2+0.2;g.add(box,pin);g.userData={len};return g}
const ease=x=>x<0?0:x>1?1:x*x*(3-2*x),seg=(p,a,b)=>ease((p-a)/(b-a));
const PH_=[[0,.28,'Lift joint from '],[.28,.38,'Stab into box'],[.38,.6,'Make up (spin)'],[.6,.7,'Slips out'],[.7,1,'Lower string']];
function animate(p,c){const len=Math.max(3,Math.min(31,c.len_m||9.4)),stand=len>20;if(!ANIM||ANIM.userData.len!==len){clearAnim();ANIM=pipeMesh(len);TJ=new THREE.Mesh(new THREE.TorusGeometry(0.24,0.08,6,16),new THREE.MeshBasicMaterial({color:0xffaa22}));TJ.name='newToolJoint';C.scene.add(ANIM,TJ)}
 const F=C.FLOOR,su=S.stickup||1.5,stub=F+su;// joint bottom must end at the stick-up
 const from=stand?new THREE.Vector3(-2.2,F+len/2+0.2,-2.6):new THREE.Vector3(14,1.6,0),tilt0=stand?0:Math.PI/2;
 const lift=seg(p,0,.28),stab=seg(p,.28,.38),spin=seg(p,.38,.6),lower=seg(p,.7,1);
 const above=new THREE.Vector3(0,stub+0.4+len/2,0);const pos=from.clone().lerp(above,lift);pos.y-=0.4*stab;pos.y-=len*lower;
 if(!stand&&lift<1)pos.y+=Math.sin(lift*Math.PI)*6;ANIM.position.copy(pos);ANIM.rotation.set(0,spin*Math.PI*10,tilt0*(1-lift));
 ANIM.visible=pos.y-len/2>F-len+0.05;TJ.visible=stab>0.99;TJ.position.set(0,stub-len*lower,0);TJ.rotation.x=Math.PI/2;TJ.scale.setScalar(spin>0&&spin<1?1.25:1);
 const ph=PH_.find(q=>p>=q[0]&&p<q[1])||PH_.at(-1);CAP=`Connection #${c.n??'?'}: ${ph[2]}${ph[2].startsWith('Lift')?(stand?'racking board':'catwalk'):''} · ${L(len/FT).toFixed(1)} ${LU()} ${stand?'stand':'single'}`}
function clearAnim(){for(const o of [ANIM,TJ])if(o){C.scene.remove(o);o.traverse(x=>x.geometry?.dispose?.())}ANIM=TJ=null;CAP=''}
// timeline-tied (Replay / SIM-TEST): progress = position of t inside [slips in, slips out + 30 s]
function timelineAnim(t,conns){const c=conns.find(c=>t>=c.tSlipsIn&&t<=c.tSlipsOut+30);if(!c||!O.anim){clearAnim();return}
 const len=c.length_m>0.5?c.length_m:(T.lenMed||ST.lenMed||9.4);animate((t-c.tSlipsIn)/((c.tSlipsOut+30)-c.tSlipsIn),{n:c.n,len_m:len})}
// live: play when slips set with bit off bottom (or Connections panel finds a new one); 20 s wall-clock animation
let LV=null;function liveAnim(now){const off=(S.md-S.bitDepthLive_ft)*FT>0.5;const n=T.conns.length;
 if(((S.slips&&!T.lastSlips&&off)||n>T.liveConnN)&&!LV)LV={t0:now,n:n+(S.slips?1:0)};T.lastSlips=!!S.slips;T.liveConnN=n;
 if(LV){const p=(now-LV.t0)/20000;if(p>1||!O.anim){LV=null;clearAnim();return}animate(p,{n:LV.n,len_m:T.lenMed||9.4})}else clearAnim()}
// ---- panel ----
const badge=t=>`<span id="bttag" style="background:${t=='LIVE'?'#1a7f37':t=='REPLAY'?'#7c4dff':t=='SIM'?'#6b7580':'#b04a00'};color:#fff;padding:1px 6px;border-radius:4px;font-weight:700">${t}</span>`;
function panel(){const B=(id,t,c='#2a4a6a')=>`<button id="${id}" style="${C.BTN};font-size:15px;min-height:44px;padding:6px 10px;background:${c};color:#fff;border-radius:8px">${t}</button>`;
 P.innerHTML=`<b style="color:#9cf">Bit depth tracking</b> <span id="btbadge"></span> <button id="btx" style="float:right">✕</button>
 <div id="btread" style="font-size:15px;color:#fff;background:#13202c;border-radius:6px;padding:6px;margin:6px 0"></div>
 <div style="display:flex;gap:8px;align-items:flex-start"><canvas id="btstrip" width="220" height="300" style="width:110px;height:150px;background:#081018;border-radius:6px"></canvas>
 <div style="flex:1;display:flex;flex-direction:column;gap:6px">
 <label style="font-size:15px;min-height:40px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="btfol" ${O.follow?'checked':''}> Camera follows bit</label>
 <label style="font-size:15px;min-height:40px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="btani" ${O.anim?'checked':''}> New-pipe animation</label>
 <div id="btcap" style="color:#fb4;font-size:14px;min-height:20px"></div></div></div>
 <div style="margin-top:6px;border-top:1px solid #345;padding-top:6px"><b style="font-size:13px;color:#9ab">SIM-TEST timeline</b> <small style="color:#9ab">(synthetic data, not real rig data)</small>
 <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px">${B('btsim',ST.on?'Stop SIM-TEST':'Run SIM-TEST','#7a3d00')}${B('btpp',ST.playing?'Pause':'Play')}
 <select id="btspd" style="font-size:16px;min-height:44px">${[10,30,60,120].map(v=>`<option ${v==O.spd?'selected':''} value="${v}">${v}x</option>`).join('')}</select></div>
 <input id="btsc" type="range" min="0" max="1000" value="0" style="width:100%;min-height:36px"></div>
 <small style="color:#9ab">Live: bit glides between polls (≥10 s). Replay/SIM-TEST: animation is tied to the timeline — scrub to any connection. Hole depth is the deepest depth seen; the white ring marks hole bottom when the bit is off bottom.</small>`;
 $('btx').onclick=()=>{P.style.display='none'};$('btfol').onchange=e=>{O.follow=e.target.checked;save()};$('btani').onchange=e=>{O.anim=e.target.checked;save();if(!O.anim)clearAnim()};
 $('btspd').onchange=e=>{O.spd=+e.target.value;save()};$('btsim').onclick=()=>{ST.on?simStop():simStart();panel()};$('btpp').onclick=()=>{ST.playing=!ST.playing;ST.lt=0;panel()};
 $('btsc').oninput=e=>{if(!ST.on)simStart();ST.t=ST.t0+(ST.t1-ST.t0)*e.target.value/1000}}
function simStart(){const s=GX.conn.synth({joints:4,len:9.4,start_m:1000});ST.rows=s.rows;ST.t0=s.rows[0].t;ST.t1=s.rows.at(-1).t;ST.t=ST.t0;const r=GX.conn.detect(s.rows);ST.conns=r.connections;ST.lenMed=r.kpi.medianLen_m;ST.on=true;ST.playing=true;ST.lt=0;
 const b=$('sim');if(b){b.textContent='SIM-TEST timeline - synthetic, not real rig data';b.style.background='#b04a00'}S.events?.push([S.t,'SIM-TEST bit-depth timeline started ('+r.connections.length+' connections)'])}
function simStop(){ST.on=false;ST.playing=false;clearAnim();const b=$('sim');if(b){b.textContent='SIMULATED - not real rig data';b.style.background='#b8860b'}}
function strip(bd,hd){const cv=$('btstrip');if(!cv)return;const g=cv.getContext('2d'),W=cv.width,H=cv.height;g.fillStyle='#081018';g.fillRect(0,0,W,H);
 const span=Math.max(300/FT,hd*0.12),d0=Math.max(0,bd-span*0.6),d1=d0+span,Y=d=>(d-d0)/(d1-d0)*H;
 for(const l of (window.GEO?.layers||[])){const a=Y(l.top_md),b=Y(l.base_md);if(b<0||a>H)continue;g.fillStyle=l.color||'#776';g.fillRect(0,a,W*0.62,b-a);g.fillStyle='#fff';g.font='18px sans-serif';if(a>=-2&&a<H-20)g.fillText((l.name||'').slice(0,12),4,Math.max(18,a+20))}
 g.fillStyle='#000a';g.fillRect(W*0.62,0,W,H);g.strokeStyle='#bbb';g.lineWidth=6;g.beginPath();g.moveTo(W*0.8,0);g.lineTo(W*0.8,Y(hd));g.stroke();
 g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();g.moveTo(W*0.64,Y(hd));g.lineTo(W,Y(hd));g.stroke();g.fillStyle='#3df';g.beginPath();const y=Y(bd);g.moveTo(W*0.8,y+12);g.lineTo(W*0.7,y-6);g.lineTo(W*0.9,y-6);g.fill();
 g.fillStyle='#3df';g.font='bold 20px sans-serif';g.fillText('BIT',W*0.65,y-12);g.fillStyle='#ccc';g.font='16px sans-serif';g.fillText(L(d0).toFixed(0),W*0.64,18);g.fillText(L(d1).toFixed(0)+LU(),W*0.64,H-6)}
function readout(bd,hd){const f=window.GEO?.layers?.find(l=>bd>=l.top_md&&bd<l.base_md),off=hd-bd;
 const h=`Bit <b id="btbd">${L(bd).toFixed(1)}</b> ${LU()} · Hole <b id="bthd">${L(hd).toFixed(1)}</b> ${LU()}<br>${off>0.5/FT?`<span style="color:#fc6">Bit OFF BOTTOM by <b id="btoff">${L(off).toFixed(1)}</b> ${LU()}</span>`:'<span id="btoff" style="color:#7d7">Bit on bottom</span>'} · Formation: <b>${f?f.name:'—'}</b>`;
 if($('btread'))$('btread').innerHTML=h;if($('btbadge'))$('btbadge').innerHTML=badge(T.tag);if($('btcap'))$('btcap').textContent=CAP;
 if(HUD)HUD.innerHTML=`${badge(T.tag)} Bit ${L(bd).toFixed(1)} / Hole ${L(hd).toFixed(1)} ${LU()}${off>0.5/FT?' · off btm '+L(off).toFixed(1):''}${CAP?'<br><span style="color:#fb4">'+CAP+'</span>':''}`;
 const sc=$('btsc');if(sc&&ST.on&&document.activeElement!==sc)sc.value=Math.round((ST.t-ST.t0)/((ST.t1-ST.t0)||1)*1000)}
let ui=0;function tick(now){requestAnimationFrame(tick);try{
 if(ST.on&&ST.playing){const dt=ST.lt?(now-ST.lt)/1000:0;ST.t=Math.min(ST.t1,ST.t+dt*O.spd);if(ST.t>=ST.t1)ST.playing=false}ST.lt=now;
 const tg=target(now);if(!tg)return;drive(tg);const bd=tg.phys?tg.bd:S.bitDepthLive_ft,hd=S.md;T.disp={bd,hd};
 const p=markers(bd,hd);follow(p);
 if(T.mode=='simtest'||T.mode=='replay')timelineAnim(tg.t,tg.conns||[]);else if(T.mode=='live')liveAnim(now);else clearAnim();
 if(now-ui>200){ui=now;readout(bd,hd);if(P.style.display!='none')strip(bd,hd)}}catch(e){console.warn('ext7',e)}}
export function init(ctx){C=ctx;S=C.S;THREE=C.THREE;
 P=document.createElement('div');P.id='bitp';P.style.cssText=C.PANEL+';left:10px;top:200px;width:420px;max-height:70vh;overflow:auto;display:none;border-color:#3df';document.body.appendChild(P);panel();
 HUD=document.createElement('div');HUD.id='bithud';HUD.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(26px + env(safe-area-inset-top));background:#0b1218cc;color:#def;font:12px sans-serif;padding:3px 8px;border-radius:6px;z-index:41;pointer-events:none;text-align:center;max-width:94vw';document.body.appendChild(HUD);
 const anchor=$('btnConn')||$('under');const b=document.createElement('button');b.id='btnBit';b.textContent='Bit depth';b.className=anchor?.className||'';anchor?.after(b);
 b.onclick=()=>{P.style.display=P.style.display=='none'?'':'none';if(P.style.display!='none'){panel();window.MOB?.on&&MOB.open('bitp')}};window.U?.on?.(()=>panel());
 window.GX=window.GX||{};GX.bit={state:()=>({...T,disp:{...T.disp},anim:!!ANIM,cap:CAP,st:{on:ST.on,t:ST.t,t0:ST.t0,t1:ST.t1,playing:ST.playing,conns:ST.conns.length}}),simStart,simStop,seek:t=>{ST.t=t},pause:()=>{ST.playing=false},opt:O,anim:()=>ANIM,panel};
 requestAnimationFrame(tick)}
