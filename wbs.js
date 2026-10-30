// wbs.js (helper E, batch6): wellbore stability. Breakout width (Kirsch hoop stress + Mohr-Coulomb) and the mud weight window
// (pore, shear collapse, mud weight, breakdown, fracture) along the well, drawn as extra tracks beside the Earth model strip log.
// Pressures and lithology come from GX.strat (pressureAt, lithAt, LITH.ucs). Stress ratio and SHmax azimuth from wpg_core ENV.
// All values are SIM (model output, not measured). Never LIVE. No network calls. Metric units: m, SG, MPa, degrees.
import {ENV,D2R,R2D,G0} from './wpg_core.js?v=g1';
export const CFG={sHr:ENV.sHr,sHazi:ENV.sHazi,phi:ENV.phi,nu:0.25,T0:0,maxBo:60,mwSim:1.20};
const q_=phi=>(1+Math.sin(phi*D2R))/(1-Math.sin(phi*D2R));
// far-field stresses (MPa) from gradients (SG) at TVD z
export function stresses(z,{pp,fg,ob},c=CFG){const g=G0*1000*z/1e6;const Sh=fg*g;return {Sv:ob*g,Sh,SH:Sh*c.sHr,Pp:pp*g,g}}
// wall stresses around an inclined hole (Fjaer et al. 2008 ch.4; Zoback 2007 ch.6). Returns per-theta effective hoop / radial / axial
export function wallStress(S,inc,azi,Pw,c=CFG,N=180){const I=inc*D2R,a=(azi-c.sHazi)*D2R,ca=Math.cos(a),sa=Math.sin(a),ci=Math.cos(I),si=Math.sin(I),{SH,Sh,Sv,Pp}=S;
 const sx=(SH*ca*ca+Sh*sa*sa)*ci*ci+Sv*si*si,sy=SH*sa*sa+Sh*ca*ca,sz=(SH*ca*ca+Sh*sa*sa)*si*si+Sv*ci*ci,txy=0.5*(Sh-SH)*Math.sin(2*a)*ci,tyz=0.5*(Sh-SH)*Math.sin(2*a)*si,txz=0.5*(SH*ca*ca+Sh*sa*sa-Sv)*Math.sin(2*I);
 const o=[];for(let k=0;k<N;k++){const th=k*Math.PI/N,c2=Math.cos(2*th),s2=Math.sin(2*th);const st=sx+sy-2*(sx-sy)*c2-4*txy*s2-Pw,sz_=sz-2*c.nu*(sx-sy)*c2-4*c.nu*txy*s2,tz=2*(tyz*Math.cos(th)-txz*Math.sin(th));
  const m=(st+sz_)/2,r=Math.sqrt(((st-sz_)/2)**2+tz*tz);o.push({th:th*R2D,s1:m+r-Pp,s3t:m-r-Pp,sr:Pw-Pp})}return o}
// breakout: wall points where σ1' > UCS + q·σ3' (Mohr-Coulomb). width in degrees per lobe; tensile when min tangential σ' < −T0
export function breakout(S,inc,azi,Pw,ucs,c=CFG){const W=wallStress(S,inc,azi,Pw,c),q=q_(c.phi);let n=0,mx=-1e9,thMax=0,minT=1e9;
 for(const p of W){const s1=Math.max(p.s1,p.sr),s3=Math.min(p.s3t,p.sr),f=s1-(ucs+q*Math.max(0,s3));if(f>0)n++;if(f>mx){mx=f;thMax=p.th}minT=Math.min(minT,p.s3t)}
 return {width:n/W.length*180,theta:thMax,tensile:minT<-c.T0,margin:-mx}}
// mud weight (SG) where breakout width drops to target (0 = collapse onset, CFG.maxBo = allowed width), and breakdown (tensile)
export function window1(z,P,inc,azi,ucs,c=CFG){const S=stresses(z,P,c),sg=Pw=>Pw/S.g;
 const wAt=Pw=>breakout(S,inc,azi,Pw,ucs,c).width;const solve=tgt=>{let lo=0,hi=S.Sv*1.5;if(wAt(lo)<=tgt)return 0;for(let k=0;k<40;k++){const m=(lo+hi)/2;wAt(m)>tgt?lo=m:hi=m}return hi};
 let blo=S.Pp,bhi=S.Sv*2.2;for(let k=0;k<40;k++){const m=(blo+bhi)/2;breakout(S,inc,azi,m,ucs,c).tensile?bhi=m:blo=m}
 return {pp:P.pp,fg:P.fg,ob:P.ob,collapse:sg(solve(0)),collapseAllow:sg(solve(c.maxBo)),breakdown:sg(blo)}}
const incAzi=(path,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];const dm=Math.max(1e-6,Math.hypot(b.E-a.E,b.N-a.N,b.tvd-a.tvd)),h=Math.hypot(b.E-a.E,b.N-a.N);return {inc:Math.atan2(h,b.tvd-a.tvd)*R2D,azi:(Math.atan2(b.E-a.E,b.N-a.N)*R2D+360)%360,dm}};
// profile along a path [{md,tvd,E,N}] using strat model; mw in SG (number or fn(md))
export function profile(ST,M,path,mw,{step=25,c=CFG}={}){const out=[];if(!path?.length)return out;const md1=path.at(-1).md;let j=0;
 for(let md=Math.max(step,path[0].md);md<=md1+1e-6;md+=step){while(j<path.length-2&&path[j+1].md<md)j++;const p=ST.pointOnPath(path,md);if(!p||p.tvd<30)continue;
  const {inc,azi}=incAzi(path,j+1),pr=ST.pressureAt(M,p.tvd,p.E,p.N),r=ST.lithAt(M,p.tvd,p.E,p.N),lith=r?.lith||pr.lith||'shale',ucs=(ST.LITH[lith]||ST.LITH.shale).ucs;
  const P={pp:pr.pp_sg,fg:pr.fg_sg,ob:pr.ob_sg},w=window1(p.tvd,P,inc,azi,ucs,c),m=typeof mw=='function'?mw(md):mw,bo=breakout(stresses(p.tvd,P,c),inc,azi,m*G0*1000*p.tvd/1e6,ucs,c);
  const state=m<P.pp?'KICK RISK':bo.tensile||m>P.fg?'LOSS RISK':bo.width>c.maxBo?'BREAKOUT':bo.width>0?'MINOR BREAKOUT':'OK';
  out.push({md,tvd:p.tvd,inc,azi,lith,ucs,mw:m,...w,bo:bo.width,boAz:(azi+bo.theta)%360,state,tag:'SIM'})}return out}
export function summary(pr){const n=pr.length||1,c=s=>pr.filter(x=>x.state==s).length;const worst=pr.reduce((a,b)=>b.bo>(a?.bo??-1)?b:a,null);
 const lo=Math.max(...pr.map(x=>Math.max(x.pp,x.collapseAllow))),hi=Math.min(...pr.map(x=>Math.min(x.fg,x.breakdown)));return {n:pr.length,ok:c('OK'),minor:c('MINOR BREAKOUT'),bo:pr.filter(x=>x.bo>CFG.maxBo).length,kick:c('KICK RISK'),loss:c('LOSS RISK'),worst,mwLo:lo,mwHi:hi,single:hi>lo,tag:'SIM'}}
// ---------------- UI ----------------
const U={mw:null,on:true,pr:[]};const $=id=>document.getElementById(id),f2=v=>(+v).toFixed(2);
function mwNow(){if(U.mw!=null)return {v:U.mw,src:'user'};const v=globalThis.GX?.strat?.mudWeight?.();return typeof v=='number'?{v:v/8.345,src:'rig'}:{v:CFG.mwSim,src:'SIM'}}
function pathNow(){const ST=GX.strat;let p=null;try{p=ST.path()}catch(e){}if(!p||p.length<2){try{const W=GX.wplan?.W;if(W)p=ST.planPath(W)}catch(e){}}return p}
export function compute(){const ST=globalThis.GX?.strat;if(!ST?.ready)return null;const M=ST.model(),path=pathNow();if(!path||path.length<2)return null;const md1=path.at(-1).md;
 U.pr=profile(ST,M,path,mwNow().v,{step:Math.max(10,Math.round(md1/120))});U.sum=summary(U.pr);return U}
const COL={pp:'#4fc3ff',col:'#ff9f43',mw:'#fff',bd:'#ff5c8a',fg:'#ff3b3b'};
export function drawTracks(c,h,md1){const g=c.getContext('2d'),dpr=Math.min(2,devicePixelRatio||1),w=c.width/dpr;g.setTransform(dpr,0,0,dpr,0,0);const Y=md=>md/md1*(h-14)+12,pr=U.pr;
 g.fillStyle='#0b1218';g.fillRect(0,0,w,h);const a0=.08*w,a1=.62*w,b0=.63*w,b1=w;g.font='10px system-ui';g.fillStyle='#cde';g.fillText('Mud window SG 0.8-2.4 (SIM)',a0+3,10);g.fillText('Breakout ° (SIM)',b0+3,10);g.fillText('MD m',2,10);for(let md=0;md<=md1;md+=500){g.fillStyle='#9ab';g.fillText(md.toFixed(0),2,Y(md)+4);g.fillStyle='#fff2';g.fillRect(a0,Y(md),w-a0,1)}g.fillStyle='#cde';
 const X=v=>a0+Math.max(0,Math.min(1,(v-.8)/1.6))*(a1-a0),XB=v=>b0+Math.min(1,v/180)*(b1-b0);
 for(let v=1;v<=2.4;v+=.2){g.fillStyle='#fff1';g.fillRect(X(v),12,1,h-14)}for(const v of [60,120]){g.fillStyle='#fff1';g.fillRect(XB(v),12,1,h-14)}
 const dy=pr.length>1?Y(pr[1].md)-Y(pr[0].md):2;
 for(const s of pr){const y=Y(s.md)-dy/2,lo=Math.max(s.pp,s.collapseAllow),hi=Math.min(s.fg,s.breakdown);
  g.fillStyle='#2a6fdb55';g.fillRect(X(.8),y,X(s.pp)-X(.8),dy+.5);g.fillStyle='#ff9f4355';if(s.collapseAllow>s.pp)g.fillRect(X(s.pp),y,X(s.collapseAllow)-X(s.pp),dy+.5);
  g.fillStyle='#27ae6040';if(hi>lo)g.fillRect(X(lo),y,X(hi)-X(lo),dy+.5);g.fillStyle='#ff3b3b55';g.fillRect(X(hi),y,X(2.4)-X(hi),dy+.5);
  g.fillStyle=s.bo>CFG.maxBo?'#ff5c5c':s.bo>0?'#ffb74d':'#2e7d32';g.fillRect(b0,y,XB(s.bo)-b0,dy+.5)}
 const line=(k,col,dash)=>{g.strokeStyle=col;g.lineWidth=1.4;g.setLineDash(dash||[]);g.beginPath();pr.forEach((s,i)=>i?g.lineTo(X(s[k]),Y(s.md)):g.moveTo(X(s[k]),Y(s.md)));g.stroke();g.setLineDash([])};
 line('pp',COL.pp);line('collapse',COL.col,[4,3]);line('breakdown',COL.bd,[4,3]);line('fg',COL.fg);line('mw',COL.mw);
 g.strokeStyle='#ffffff55';g.setLineDash([2,3]);g.beginPath();g.moveTo(XB(CFG.maxBo),12);g.lineTo(XB(CFG.maxBo),h);g.stroke();g.setLineDash([]);
 const bm=(globalThis.S?.md||0)*0.3048;if(bm>0){g.fillStyle='#f80';g.fillRect(0,Y(bm)-1,w,2)}}
function legend(){const m=mwNow(),s=U.sum;if(!s)return '';const it=(c,t)=>`<span style="white-space:nowrap"><i style="display:inline-block;width:14px;height:3px;background:${c};vertical-align:middle"></i> ${t}</span>`;
 return `<div id="wbsLeg" style="display:flex;flex-wrap:wrap;gap:4px 10px;font:12px system-ui;color:#cde;margin:4px 0">${it(COL.pp,'Pore')}${it(COL.col,'Collapse')}${it(COL.mw,'Mud weight')}${it(COL.bd,'Breakdown')}${it(COL.fg,'Fracture')}${it('#27ae60','Safe window')}<span class="tag" style="background:#555;padding:0 4px;border-radius:3px">SIM</span></div>
 <div id="wbsSum" style="font:12px system-ui;color:#dde;margin-bottom:4px">Mud weight <b>${f2(m.v)} SG</b> (${m.src=='SIM'?'SIM default':m.src=='rig'?'from rig mud':'set by you'}). Safe window for one mud weight: ${s.single?`<b style="color:#6f6">${f2(s.mwLo)} to ${f2(s.mwHi)} SG</b>`:`<b style="color:#f66">none, ${f2(s.mwLo)} &gt; ${f2(s.mwHi)} SG. Set casing.</b>`}
 Breakout over ${CFG.maxBo}°: <b>${s.bo}</b> of ${s.n} points${s.worst&&s.worst.bo>0?`, widest ${s.worst.bo.toFixed(0)}° at ${s.worst.md.toFixed(0)} m MD (${s.worst.lith}, toward ${s.worst.boAz.toFixed(0)}°)`:''}. Kick risk ${s.kick}, loss risk ${s.loss}.
 <label style="margin-left:6px">Mud weight SG <input id="wbsMW" type="number" step="0.01" min="0.9" max="2.4" value="${f2(m.v)}" style="width:64px"></label></div>`}
function attach(){const lg=$('stratLog');if(!lg||!U.on||lg.dataset.wbs)return;lg.dataset.wbs=1;if(!compute())return;const V=lg.parentElement,h=parseFloat(lg.style.height)||400,ST=GX.strat,path=pathNow(),md1=path.at(-1).md;
 const box=document.createElement('div');box.id='wbsBox';box.innerHTML=legend();const c=document.createElement('canvas');c.id='wbsLog';const w=Math.min(V.clientWidth||360,980),dpr=Math.min(2,devicePixelRatio||1);c.width=w*dpr;c.height=h*dpr;c.style.width=w+'px';c.style.height=h+'px';box.appendChild(c);lg.after(box);drawTracks(c,h,md1);
 const i=$('wbsMW');if(i)i.onchange=()=>{const v=parseFloat(i.value);U.mw=v>0.8&&v<2.6?v:null;box.remove();delete lg.dataset.wbs;attach()}}
export function init(){if(typeof document=='undefined')return;globalThis.GX=globalThis.GX||{};GX.wbs={CFG,U,stresses,wallStress,breakout,window1,profile,summary,compute,attach,setMW:v=>{U.mw=v;const b=$('wbsBox');if(b){b.remove();const l=$('stratLog');if(l)delete l.dataset.wbs;attach()}}};
 new MutationObserver(()=>{if($('stratLog')&&!$('wbsBox'))attach()}).observe(document.body,{childList:true,subtree:true});
 const add=(n=0)=>{const a=document.getElementById('uig_seq')||document.getElementById('btnLay');if(!a){if(n<40)setTimeout(()=>add(n+1),500);return}if($('btnWBS'))return;const b=document.createElement('button');b.id='btnWBS';b.textContent='Hole stability';b.title='Mud window and breakout on the strip log (SIM)';if(a.id=='btnLay'){b.className=a.className;a.after(b)}else a.appendChild(b);b.onclick=()=>GX.strat?.open?.('log')};add();
 const q=new URLSearchParams(location.search);if(q.has('wbs'))(function go(n=0){if(GX.strat?.open){const v=parseFloat(q.get('wbs'));if(v>0.8)U.mw=v;GX.strat.open('log')}else if(n<60)setTimeout(()=>go(n+1),500)})()}
