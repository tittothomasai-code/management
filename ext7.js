// ext7.js v4.4: bit-depth tracking + new-pipe animation.
// The 3D string/bit follow bit depth from data (Live WITSML, Replay, or the SIM-TEST timeline), smoothly interpolated
// between polls. Hole depth vs bit depth shown separately. On each connection a joint/stand is lifted from the catwalk or
// racking board, stabbed, spun up, slips pulled and lowered; a tool-joint ring rides down with it. Read-only: no network calls here.
import * as SL from './slips.js?v=49';
// v4.5: slips state inferred from bit depth when the data has no slips curve (hookload deliberately not used).
let C,S,THREE,P,HUD,BIT,HOLE,ANIM=null,TJ=null,CAP='';
const $=id=>document.getElementById(id);const FT=0.3048;
const met=()=>!window.U||U.sys=='metric';const L=ft=>met()?ft*FT:ft,LU=()=>met()?'m':'ft';
const KEY='dw-bit-opt';const O=Object.assign({follow:false,anim:true,spd:30},JSON.parse(localStorage.getItem(KEY)||'{}'));const save=()=>localStorage.setItem(KEY,JSON.stringify(O));
const SKEY='dw-slips-opt';let SO=Object.assign({},SL.SDEFAULTS,JSON.parse(localStorage.getItem(SKEY)||'{}'));
let SLS={inSlips:false,conf:0,src:'none'},BAND={rows:null,res:null,t:null};const INF={k:'',res:null};
function inferFor(rows,k){if(INF.k!==k){INF.k=k;INF.res=SL.infer(rows,SO)}return INF.res}
const hasSlCurve=rows=>rows.some(x=>x.slips===0||x.slips===1);
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
let RC={k:'',rows:[]};const connOpt=()=>({...(GX.conn.opt?.()||{}),slips:SO});function dataRows(){const d=GX.witsml?.data?.();if(!d)return[];const k=d.src+':'+d.rows.length+':'+(d.rows.at(-1)?.t??'');if(RC.k!==k){RC={k,rows:GX.conn.fromWitsml(d).rows};
  try{const r=GX.conn.detect(RC.rows,connOpt());T.conns=r.connections;T.lenMed=r.kpi?.medianLen_m}catch{T.conns=[]}}return RC.rows}
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
 if(T.mode=='simtest'){S.connected=true;S.slips=ST.inf?SLS.inSlips:tg.hkl<300;S.dw.quill=Math.max(0,Math.min(28.5,tg.bh??S.dw.quill));S.Q=(tg.flow||0)/3.785412;S.td.rpm=tg.rpm||0;S.bitRpm=S.td.rpm;S.hook=(tg.hkl||0)/4.448222;S.wob=0;
  if(S.pumps?.length){const n=S.Q>20?Math.max(1,Math.min(S.pumps.length,Math.ceil(S.Q/450))):0;S.pumps.forEach((p,i)=>{p.on=i<n;p.cmd=p.spm=p.on?+(S.Q/n/4.36).toFixed(1):0})}}
 S.md=hd;const top=S.connected&&!S.slips?S.dw.quill:S.stickup;S.L=bd+top/FT;S.bitDepthLive_ft=bd}
function slipsState(tg){let rows=null,t=null;
 if(T.mode=='simtest'){rows=ST.rows;t=tg.t;if(!ST.inf){SLS={inSlips:(tg.hkl??1e9)<300,conf:1,src:'curve'};BAND={rows,res:inferFor(SL.strip(rows),'st0'),t};return}}
 else if(T.mode=='replay'||T.mode=='live'){rows=dataRows();t=T.mode=='replay'?tg.t:rows.at(-1)?.t;if(hasSlCurve(rows)){const x=rows.at(-1);SLS={inSlips:x?.slips===1,conf:1,src:'curve'};BAND={rows:null,res:null,t:null};return}}
 else{SLS={inSlips:!!S.slips,conf:1,src:'sim'};BAND={rows:null,res:null,t:null};return}
 if(!rows||rows.length<3){SLS={inSlips:false,conf:0,src:'none'};return}
 const k=T.mode+':'+rows.length+':'+rows.at(-1).t+':'+JSON.stringify(SO);
 // live: only data up to now (provisional, no look-ahead). Replay/SIM-TEST: whole log, so confirmation counts.
 const res=inferFor(rows,k);const st=T.mode=='live'?res.current:SL.stateAt(res,t);
 SLS={inSlips:!!st.inSlips,conf:st.conf||0,src:'inferred',kind:st.interval?.kind,provisional:!!st.provisional,possible:!!st.possible};BAND={rows,res,t}}
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
 const sl=SLS.src=='inferred'?(SLS.inSlips&&SLS.kind!='trip'):!!S.slips;
 if(((sl&&!T.lastSlips&&off)||n>T.liveConnN)&&!LV)LV={t0:now,n:n+(sl?1:0),inf:SLS.src=='inferred'};T.lastSlips=sl;T.liveConnN=n;
 if(LV){const p=(now-LV.t0)/20000;if(p>1||!O.anim){LV=null;clearAnim();return}animate(p,{n:LV.n,len_m:T.lenMed||9.4})}else clearAnim()}
// ---- panel ----
const badge=t=>`<span id="bttag" style="background:${t=='LIVE'?'#1a7f37':t=='REPLAY'?'#7c4dff':t=='SIM'?'#6b7580':'#b04a00'};color:#fff;padding:1px 6px;border-radius:4px;font-weight:700">${t}</span>`;
function panel(){const B=(id,t,c='#2a4a6a')=>`<button id="${id}" style="${C.BTN};font-size:15px;min-height:44px;padding:6px 10px;background:${c};color:#fff;border-radius:8px">${t}</button>`;
 P.innerHTML=`<b style="color:#9cf">Bit depth tracking</b> <span id="btbadge"></span> <button id="btx" style="float:right">✕</button>
 <div id="btread" style="font-size:15px;color:#fff;background:#13202c;border-radius:6px;padding:6px;margin:6px 0"></div>
 <div id="btslips" style="font-size:15px;border-radius:6px;padding:6px;margin:6px 0;background:#13202c"></div>
 <div style="display:flex;gap:8px;align-items:flex-start"><canvas id="btstrip" width="220" height="300" style="width:110px;height:150px;background:#081018;border-radius:6px"></canvas>
 <div style="flex:1;display:flex;flex-direction:column;gap:6px">
 <label style="font-size:15px;min-height:40px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="btfol" ${O.follow?'checked':''}> Camera follows bit</label>
 <label style="font-size:15px;min-height:40px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="btani" ${O.anim?'checked':''}> New-pipe animation</label>
 <div id="btcap" style="color:#fb4;font-size:14px;min-height:20px"></div></div></div>
 <div style="margin-top:6px;border-top:1px solid #345;padding-top:6px"><b style="font-size:13px;color:#9ab">SIM-TEST timeline</b> <small style="color:#9ab">(synthetic data, not real rig data)</small>
 <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px">${B('btsim',ST.on?'Stop SIM-TEST':'Run SIM-TEST','#7a3d00')}${B('btpp',ST.playing?'Pause':'Play')}
 <select id="btspd" style="font-size:16px;min-height:44px">${[10,30,60,120].map(v=>`<option ${v==O.spd?'selected':''} value="${v}">${v}x</option>`).join('')}</select></div>
 <label style="font-size:14px;min-height:36px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="btsinf" ${O.simInf?'checked':''}> SIM-TEST without slips/hookload curves (infer from bit depth)</label>
 <canvas id="btband" width="760" height="70" style="width:100%;height:35px;background:#081018;border-radius:6px"></canvas>
 <input id="btsc" type="range" min="0" max="1000" value="0" style="width:100%;min-height:36px"></div>
 <details id="btadv" style="margin-top:6px"><summary style="font-size:14px;color:#9cf;min-height:36px">Advanced: slips inference (${SL.LABEL})</summary><div style="display:flex;flex-wrap:wrap;gap:6px">
 ${[['flatTol_m','Flat tolerance ±',1],['minDwell_s','Min dwell',0],['offBottomMin_m','Min off bottom',1],['nearBottomMax_m','Max off bottom (connection)',1],['minBlockTravel_m','Min block travel',1],['minConf','Min confidence',2]].map(([k,lab,f])=>{const v=f==1?L(SO[k]/FT):f==2?Math.round(SO[k]*100):SO[k],u=f==1?LU():f==2?'%':'s';return `<label style="display:flex;flex-direction:column;flex:1 1 110px;font-size:12px;color:#9ab">${lab} (${u})<input data-so="${k}" data-f="${f}" inputmode="decimal" value="${+(+v).toFixed(2)}" style="font-size:16px;min-height:40px;background:#0b1218;color:#def;border:1px solid #456;border-radius:6px;padding:4px"></label>`}).join('')}</div>
 ${B('btsrst','Reset slips settings')}<br><small style="color:#9ab">Used only when the data has no slips curve. In slips = bit depth flat within the tolerance for the dwell with the bit off bottom; block travel, pumps off and rotation off raise confidence; drilling resuming ~one joint/stand deeper confirms it. Moving away with no new hole = tripping (no connection). Hookload is not used.</small></details>
 <small style="color:#9ab">Live: bit glides between polls (≥10 s). Replay/SIM-TEST: animation is tied to the timeline — scrub to any connection. Hole depth is the deepest depth seen; the white ring marks hole bottom when the bit is off bottom.</small>`;
 $('btx').onclick=()=>{P.style.display='none'};$('btfol').onchange=e=>{O.follow=e.target.checked;save()};$('btani').onchange=e=>{O.anim=e.target.checked;save();if(!O.anim)clearAnim()};
 $('btspd').onchange=e=>{O.spd=+e.target.value;save()};$('btsim').onclick=()=>{ST.on?simStop():simStart();panel()};$('btpp').onclick=()=>{ST.playing=!ST.playing;ST.lt=0;panel()};
 $('btsinf').onchange=e=>{O.simInf=e.target.checked;save();if(ST.on){simStart();}};
 $('btsrst').onclick=()=>{SO=Object.assign({},SL.SDEFAULTS);localStorage.removeItem(SKEY);INF.k='';RC.k='';if(ST.on)simStart();panel()};
 P.querySelectorAll('[data-so]').forEach(e=>e.onchange=()=>{let v=parseFloat(e.value);if(!isFinite(v))return;const f=+e.dataset.f;if(f==1&&!met())v*=FT;if(f==2)v/=100;SO[e.dataset.so]=v;localStorage.setItem(SKEY,JSON.stringify(SO));INF.k='';RC.k='';if(ST.on)simStart();GX.conn?.result?.()&&GX.conn.run()});
 $('btsc').oninput=e=>{if(!ST.on)simStart();ST.t=ST.t0+(ST.t1-ST.t0)*e.target.value/1000}}
function simStart(opt={}){const s=GX.conn.synth({joints:4,len:9.4,start_m:1000});ST.inf=opt.inferred??O.simInf??false;if(ST.inf)s.rows=SL.strip(s.rows,{noise:0.05});ST.rows=s.rows;INF.k='';ST.t0=s.rows[0].t;ST.t1=s.rows.at(-1).t;ST.t=ST.t0;const r=GX.conn.detect(s.rows,{...(GX.conn.opt?.()||{}),slips:SO});ST.conns=r.connections;ST.lenMed=r.kpi.medianLen_m;ST.on=true;ST.playing=true;ST.lt=0;
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
 if($('btread'))$('btread').innerHTML=h;
 const sc_=SLS.src,inf=sc_=='inferred',pc=Math.round(SLS.conf*100),ins=SLS.inSlips;
 const sTxt=sc_=='none'?'Slips: — (no data)':ins?`SLIPS IN${inf?' ~'+pc+'%':''}`:inf&&SLS.possible?`Slips: possible (${pc}%)`:'Slips: out';
 const sTag=inf?`<span style="background:#6b4a00;color:#fd8;padding:1px 5px;border-radius:4px;font-size:12px">${SL.LABEL}${SLS.provisional?' · provisional':''}${SLS.kind=='trip'?' · tripping':''}</span>`:sc_=='curve'?'<span style="font-size:12px;color:#9ab">from slips curve</span>':'';
 if($('btslips')){$('btslips').innerHTML=`<b id="btsltxt" style="color:${ins?'#ffb347':'#9c9'}">${sTxt}</b> ${sTag}`;$('btslips').style.border=ins?'2px solid #ffb347':'1px solid #345'}
 band();if($('btbadge'))$('btbadge').innerHTML=badge(T.tag);if($('btcap'))$('btcap').textContent=CAP;
 if(HUD)HUD.innerHTML=`${badge(T.tag)} Bit ${L(bd).toFixed(1)} / Hole ${L(hd).toFixed(1)} ${LU()}${off>0.5/FT?' · off btm '+L(off).toFixed(1):''}${SLS.src!='none'?` · <b style="color:${SLS.inSlips?'#ffb347':'#9c9'}">${SLS.inSlips?'SLIPS IN':'slips out'}</b>${SLS.src=='inferred'?` <span style="color:#fd8">(inferred ${Math.round(SLS.conf*100)}%)</span>`:''}`:''}${CAP?'<br><span style="color:#fb4">'+CAP+'</span>':''}`;
 const sc=$('btsc');if(sc&&ST.on&&document.activeElement!==sc)sc.value=Math.round((ST.t-ST.t0)/((ST.t1-ST.t0)||1)*1000)}
function band(){const cv=$('btband');if(!cv||P.style.display=='none')return;const g=cv.getContext('2d'),W=cv.width,H=cv.height;g.fillStyle='#081018';g.fillRect(0,0,W,H);
 const R=BAND.rows,res=BAND.res;g.font='22px sans-serif';if(!R||!res||R.length<2){g.fillStyle='#789';g.fillText(SLS.src=='curve'?'Slips from slips curve':'Slips band: needs Live/Replay/SIM-TEST data',8,42);return}
 const t0=R[0].t,t1=R.at(-1).t,X=t=>(W-4)*(t-t0)/((t1-t0)||1)+2;
 for(const v of res.intervals){g.globalAlpha=0.35+0.65*v.conf;g.fillStyle=!v.inSlips?'#667':v.kind=='trip'?'#a6f':'#ffb347';g.fillRect(X(v.tIn),10,Math.max(3,X(v.tOut)-X(v.tIn)),H-24)}g.globalAlpha=1;
 if(BAND.t!=null){g.fillStyle='#3df';g.fillRect(X(BAND.t)-2,0,4,H)}g.fillStyle='#fd8';g.font='18px sans-serif';g.fillText('Slips (inferred from bit depth): '+res.intervals.filter(v=>v.inSlips).length,6,H-2)}
let ui=0;function tick(now){requestAnimationFrame(tick);try{
 if(ST.on&&ST.playing){const dt=ST.lt?(now-ST.lt)/1000:0;ST.t=Math.min(ST.t1,ST.t+dt*O.spd);if(ST.t>=ST.t1)ST.playing=false}ST.lt=now;
 const tg=target(now);if(!tg)return;slipsState(tg);drive(tg);const bd=tg.phys?tg.bd:S.bitDepthLive_ft,hd=S.md;T.disp={bd,hd};
 const p=markers(bd,hd);follow(p);
 if(T.mode=='simtest'||T.mode=='replay')timelineAnim(tg.t,tg.conns||[]);else if(T.mode=='live')liveAnim(now);else clearAnim();
 if(now-ui>200){ui=now;readout(bd,hd);if(P.style.display!='none')strip(bd,hd)}}catch(e){console.warn('ext7',e)}}
export function init(ctx){C=ctx;S=C.S;THREE=C.THREE;
 P=document.createElement('div');P.id='bitp';P.style.cssText=C.PANEL+';left:10px;top:200px;width:420px;max-height:70vh;overflow:auto;display:none;border-color:#3df';document.body.appendChild(P);panel();
 HUD=document.createElement('div');HUD.id='bithud';HUD.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(26px + env(safe-area-inset-top));background:#0b1218cc;color:#def;font:12px sans-serif;padding:3px 8px;border-radius:6px;z-index:41;pointer-events:none;text-align:center;max-width:94vw';document.body.appendChild(HUD);
 const anchor=$('btnConn')||$('under');const b=document.createElement('button');b.id='btnBit';b.textContent='Bit depth';b.className=anchor?.className||'';anchor?.after(b);
 b.onclick=()=>{P.style.display=P.style.display=='none'?'':'none';if(P.style.display!='none'){panel();window.MOB?.on&&MOB.open('bitp')}};window.U?.on?.(()=>panel());
 window.GX=window.GX||{};GX.bit={setFollow:v=>{O.follow=!!v;const e=document.getElementById('btfol');if(e)e.checked=O.follow},conns:()=>ST.on?ST.conns:T.conns,connT0:()=>ST.on?ST.t0:0,slips:()=>({...SLS}),slipsRes:()=>BAND.res,slipsOpt:()=>SO,state:()=>({...T,disp:{...T.disp},anim:!!ANIM,cap:CAP,st:{on:ST.on,t:ST.t,t0:ST.t0,t1:ST.t1,playing:ST.playing,conns:ST.conns.length}}),simStart,simStop,seek:t=>{ST.t=t},pause:()=>{ST.playing=false},opt:O,anim:()=>ANIM,panel};
 requestAnimationFrame(tick)}
