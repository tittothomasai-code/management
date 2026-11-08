// ddrun.js (v5.11.4.1 P0, fix/ddcab-run): DD cabin steering exercise. Start / Pause / Reset a SIM slide-rotate run against a plan.
// Plan: the current Well Planning plan (GX.wplan.W.S) if one is loaded, else a default SIM plan (KOP, build, tangent, drop/landing).
// Injected errors (seeded, Easy/Normal/Hard): formation walk/tendency, bit walk, motor yield variance, toolface drift + reactive torque,
// MWD survey noise, BHA sag. Signals: MWD survey per 30 m stand, gravity/magnetic TF, offsets from plan, DLS needed, dP/WOB/ROP, motor curve point.
// Motor through GX.ddcab.motor.step (ddmotor.js) so the motor-performance pop-up dot moves; driller wording through GX.dddrv.readback.
// Gamepad: Start/Menu (button 9) toggles run/pause, hold 1 s resets (button 8 stays Home). EVERYTHING HERE IS SIM. Never LIVE. No network.
import * as C from './ddcab_core.js?v=b11';
const R=Math.PI/180,D=180/Math.PI,cl=(x,a,b)=>Math.max(a,Math.min(b,x)),n360=a=>((a%360)+360)%360,f1=v=>(+v).toFixed(1),f2=v=>(+v).toFixed(2),$=id=>document.getElementById(id);
export const DIFF={off:0,easy:0.4,normal:1,hard:2};
export const SCN={
 build:{name:'Build section',startMd:300,mode:'slide',tf:0,len:20,wob:10,flow:1800},
 tangent:{name:'Hold tangent',startMd:800,mode:'rotate',tf:0,len:6,wob:12,flow:1900},
 stall:{name:'Motor stall drill',startMd:420,mode:'slide',tf:0,len:30,wob:8,flow:1800,ramp:true}};
export const STAND=30,TD_PAD=0;
// default SIM directional plan: vertical to KOP 300 m, build 3°/30 m to 35°, hold, drop 1.5°/30 m to 20° (landing), hold to TD. Azimuth 60°.
export function defaultPlan(){const A=60;let s={md:0,inc:0,azi:A,E:0,N:0,tvd:0};const P=[{...s}];
 for(let md=10;md<=1700;md+=10){let i=s.inc;if(md>300&&md<=650)i=Math.min(35,i+1);else if(md>1100&&i>20)i=Math.max(20,i-0.5);s=C.minCurve(s,md,i,A);P.push(s)}return P}
export function wplanPlan(){try{const S=globalThis.GX?.wplan?.W?.S;if(Array.isArray(S)&&S.length>3&&S.every(p=>Number.isFinite(p.md)&&Number.isFinite(p.tvd)))return S.map(p=>({md:p.md,inc:p.inc,azi:p.azi,E:p.e,N:p.n,tvd:p.tvd}))}catch(e){}return null}
function gauss(r){return Math.sqrt(-2*Math.log(Math.max(1e-9,r())))*Math.cos(2*Math.PI*r())}
export function errors(diff='normal',seed=42){const k=DIFF[diff]??1,r=C.mulberry(seed),sg=()=>r()<.5?-1:1,U=(a,b)=>a+(b-a)*r();
 return {k,walkAzi:k*sg()*U(0.3,0.8),walkInc:k*U(-0.4,0.4),bitWalk:k*U(0.1,0.5),yieldSd:0.12*k,tfDriftSd:4*k,rtPerBar:0.4*k,svInc:0.08*k,svAzi:0.4*k,sag:0.15*k,src:'SIM'}}
export function errMag(E){return Math.abs(E.walkAzi)+Math.abs(E.walkInc)+E.bitWalk+E.yieldSd*10+E.tfDriftSd/4+E.rtPerBar*5+E.svInc*10+E.svAzi*2+E.sag*5}
function planAt(P,md){let a=P[0];for(const p of P){if(p.md<=md)a=p;else break}return a}
export function newRun(o={}){const scen=o.scen||'build',sc=SCN[scen],diff=o.diff||'normal',seed=o.seed??42,src=o.plan?'given':wplanPlan()?'Well Planning':'default SIM plan',plan=o.plan||wplanPlan()||defaultPlan();
 const p0=planAt(plan,sc.startMd),bit={md:p0.md,inc:Math.max(0.5,p0.inc),azi:p0.azi,E:p0.E,N:p0.N,tvd:p0.tvd};
 const R0={scen,diff,seed,plan,planSrc:src,td:plan.at(-1).md,E:errors(diff,seed),rng:C.mulberry(seed*7+1),bit,truth:[{...bit}],surveys:[{md:+bit.md.toFixed(1),inc:+bit.inc.toFixed(2),azi:+bit.azi.toFixed(2),tvd:+bit.tvd.toFixed(1),dls:0,dev:0,src:'SIM'}],
  set:{mode:sc.mode,tf:sc.tf,len:sc.len,wob:sc.wob,flow:sc.flow,rpm:40},standMd:0,slid:0,yieldF:1,tfDrift:0,stalls:0,stalled:false,ms:null,rop:0,hours:0,devs:[],running:false,done:false,ticks:0,instr:'',log:[]};
 R0.yieldF=1+R0.E.yieldSd*gauss(R0.rng);instruct(R0);return R0}
function motor(r,rot,dt){const s=r.set,M=globalThis.GX?.ddcab?.motor;let o=null;
 if(M?.step)try{o=M.step({flow:s.flow,wob:s.wob,rpm:rot?s.rpm:0,rotating:rot,tf:Math.round(n360(s.tf)/5)*5%360,inc:+r.bit.inc.toFixed(1),tvd:Math.round(r.bit.tvd),hours:dt})}catch(e){o=null}
 if(!o){const q=C.motorState(C.MOTOR,{flow:s.flow,wob:s.wob,rotating:rot,rpm:s.rpm});o={...q,yield:+C.yieldDLS(C.MOTOR).toFixed(2),src:'SIM fallback'}}return o}
// geometry relative to plan at the bit: up (+ above / high side), right (+ right of plan), along (plan MD - bit MD), dist, DLS needed + TF to get back on plan in 30 m
export function offsets(r){const b=r.bit,q=C.closest(r.plan,b),p=planAt(r.plan,q.md),i=p.inc*R,a=p.azi*R,v=[b.E-q.E,b.N-q.N,b.tvd-q.tvd];
 const H=[Math.cos(i)*Math.sin(a),Math.cos(i)*Math.cos(a),-Math.sin(i)],Rt=[Math.cos(a),-Math.sin(a),0],dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
 const t=planAt(r.plan,q.md+30),tv=[t.E-b.E,t.N-b.N,t.tvd-b.tvd],L=Math.hypot(...tv)||1,ti=Math.acos(cl(tv[2]/L,-1,1))*D,ta=n360(Math.atan2(tv[0],tv[1])*D);
 const rq=C.requiredTF(b.inc,b.azi,ti,ta);return {dist:q.d,up:dot(v,H),right:dot(v,Rt),along:q.md-b.md,dlsNeed:rq.dl*30/L,tfNeed:n360(rq.tf),planInc:p.inc,planAzi:p.azi,src:'SIM'}}
function instruct(r){const o=offsets(r),y=(r.ms?.yield||C.yieldDLS(C.MOTOR)),len=cl(Math.round(STAND*o.dlsNeed/Math.max(0.5,y)),0,STAND),tf=Math.round(o.tfNeed/5)*5%360;
 const c=len<2?{cmd:'rotate',len:STAND}:{cmd:'slide',len,tf},rb=globalThis.GX?.dddrv?.readback;let t;try{t=rb?rb(c):null}catch(e){t=null}
 r.rec=c;r.instr=(c.cmd=='rotate'?'Rotate the stand (on plan, DLS needed '+f2(o.dlsNeed)+'°/30m)':`Slide ${len} m at TF ${tf}°, then rotate ${STAND-len} m`)+(t?' · Driller: '+t:'');return r.instr}
function survey(r){const b=r.bit,E=r.E,g=()=>gauss(r.rng),pv=r.surveys.at(-1);const s={md:+b.md.toFixed(1),inc:+Math.max(0,b.inc-E.sag+E.svInc*g()).toFixed(2),azi:+n360(b.azi+E.svAzi*g()).toFixed(2),tvd:+b.tvd.toFixed(1),src:'SIM'};
 s.dls=s.md>pv.md?+(C.dogleg(pv.inc,pv.azi,s.inc,s.azi)*30/(s.md-pv.md)).toFixed(2):0;s.dev=+offsets(r).dist.toFixed(2);r.surveys.push(s);r.devs.push(s.dev);
 r.yieldF=1+E.yieldSd*gauss(r.rng);r.tfDrift+=E.tfDriftSd*g();r.standMd=0;r.slid=0;instruct(r);r.log.push(`MWD survey ${s.md} m: Inc ${s.inc}° Azi ${s.azi}° TVD ${s.tvd} m (SIM)`);return s}
// drill `len` metres with the current settings (sub-steps of <=1 m). Returns metres made.
export function drill(r,len,dt=0.05){let made=0;while(made<len-1e-9&&!r.done){const s=r.set,rot=s.mode=='rotate'||r.slid>=s.len;const ms=motor(r,rot,dt);r.ms=ms;
  if(ms.stall){if(!r.stalled){r.stalls++;r.log.push('⚠ MOTOR STALL at WOB '+s.wob+' t: pick up off bottom, then reduce WOB.')}r.stalled=true;r.rop=0;break}r.stalled=false;
  const rop=C.ropOf(ms,{wob:s.wob,rotating:rot});r.rop=rop;if(rop<=0)break;const dl=Math.min(1,len-made,STAND-r.standMd),E=r.E,b=r.bit;let inc=b.inc,azi=b.azi;
  if(!rot){const tfA=n360(s.tf+r.tfDrift-E.rtPerBar*(ms.dP||0));r.tfAct=tfA;const n=C.steer(inc,azi,(ms.yield||C.yieldDLS(C.MOTOR))*r.yieldF,tfA,dl);inc=n.inc;azi=n.azi;r.slid+=dl}
  else{azi+=E.bitWalk*dl/30;r.tfAct=null}
  inc=cl(inc+E.walkInc*dl/30,0,120);azi=n360(azi+E.walkAzi*dl/30);const nb=C.minCurve(b,b.md+dl,inc,azi);r.bit={md:nb.md,inc:nb.inc,azi:nb.azi,E:nb.E,N:nb.N,tvd:nb.tvd};r.truth.push({...r.bit});
  r.hours+=dl/Math.max(rop,0.1);made+=dl;r.standMd+=dl;if(r.standMd>=STAND-1e-6)survey(r);if(r.bit.md>=r.td-0.01){r.done=true;r.running=false;r.log.push('Run complete at TD (SIM).');fin(r)}}
 return made}
export function score(r){const d=r.devs,avg=d.length?d.reduce((a,b)=>a+b,0)/d.length:offsets(r).dist,ls=r.surveys.slice(1).map(s=>s.dls),m=ls.length?ls.reduce((a,b)=>a+b,0)/ls.length:0,sd=ls.length>1?Math.sqrt(ls.reduce((a,b)=>a+(b-m)**2,0)/(ls.length-1)):0;
 return {avgDev:+avg.toFixed(1),dlsSd:+sd.toFixed(2),stalls:r.stalls,score:Math.round(cl(100-1.5*avg-8*sd-5*r.stalls,0,100)),done:r.done,src:'SIM'}}
// apply the recommended instruction to the controls (what a good DD would order)
export function applyRec(r){const c=r.rec;if(!c)return;if(c.cmd=='rotate'){r.set.mode='rotate'}else{r.set.mode='slide';r.set.tf=c.tf;r.set.len=c.len}}
// ---------------- UI ----------------
let RUN=null,el=null,timer=null,cab=null,spd=1,ang=0.6,pad={t:0,down:false,fired:false};
const CSS=`#ddRun{background:#101a24;border-bottom:1px solid #2c3d50;padding:6px 8px;display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow:auto;flex:none}
#ddRun .rw{display:flex;gap:6px;flex-wrap:wrap;align-items:center}#ddRun label{display:flex;gap:4px;align-items:center;font-size:12px;color:#bcd}
#ddRun input[type=number]{width:62px}#ddRun input[type=range]{width:110px}#ddRun .go{background:#1f6b3a;font-weight:700}#ddRun .go.on{background:#8a5a00}
#ddRun .rg{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:4px}#ddRun .rg div{background:#0d1620;border-radius:6px;padding:3px 5px}#ddRun .rg small{display:block;color:#8aa;font-size:10px}#ddRun .rg b{font:600 14px ui-monospace,monospace}
#drInstr{background:#13283a;border-left:3px solid #6aa9ff;padding:4px 8px;border-radius:4px}#drStall{background:#5a1010;color:#fff;padding:6px 8px;border-radius:6px;font-weight:700}#drEnd{background:#163a22;padding:6px 8px;border-radius:6px}
#ddRun canvas{background:#081018;border-radius:6px;width:100%;max-width:420px;height:auto}#ddRun .cv{display:grid;grid-template-columns:1fr 1fr;gap:6px}#ddRun table{font:11px ui-monospace,monospace;border-collapse:collapse}#ddRun td,#ddRun th{padding:1px 5px;text-align:right}
@media(max-width:1023px){#ddRun{max-height:58vh}#ddRun .cv{grid-template-columns:1fr}#ddRun input[type=range]{width:90px}}
@media(min-width:1024px){#ddRun .main{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:8px}}`;
function css(){if($('ddRunCss'))return;const s=document.createElement('style');s.id='ddRunCss';s.textContent=CSS;document.head.appendChild(s)}
function build(){el=document.createElement('div');el.id='ddRun';const o=(m,v)=>Object.entries(m).map(([k,x])=>`<option value="${k}"${k==v?' selected':''}>${x.name||x}</option>`).join('');
 el.innerHTML=`<div class="rw"><button id="drGo" class="go">▶ Start</button><button id="drReset">⟲ Reset</button>
 <label>Scenario <select id="drScen">${o(SCN,RUN.scen)}</select></label><label>Difficulty <select id="drDiff">${o({easy:'Easy',normal:'Normal',hard:'Hard'},RUN.diff)}</select></label>
 <label>Speed <select id="drSpd"><option value="1">1×</option><option value="4">4×</option></select></label><button id="drPerf">📈 Motor curve</button><span class="sim">SIM</span><small id="drPlan"></small></div>
 <div class="rw"><label><select id="drMode"><option value="slide">Slide</option><option value="rotate">Rotate</option></select></label>
 <label>TF° <input id="drTF" type="number" min="0" max="355" step="5"></label><label>Slide m <input id="drLen" type="number" min="0" max="30" step="1"></label>
 <label>WOB <input id="drWob" type="range" min="0" max="40" step="0.5"><b id="drWobV"></b>t</label><label>Flow <input id="drFlow" type="range" min="900" max="2600" step="50"><b id="drFlowV"></b>L/min</label>
 <button id="drApply">Use instruction</button><button id="drPU">Pick up off bottom</button></div>
 <div id="drInstr"></div><div id="drStall" hidden></div><div id="drEnd" hidden></div>
 <div class="main"><div><div class="rg" id="drG"></div><table id="drSurv"></table></div><div class="cv"><canvas id="drVS" width="420" height="220"></canvas><canvas id="dr3D" width="420" height="220"></canvas></div></div>`;
 const q=el.querySelector.bind(el),bind=(id,k,f=Number)=>q('#'+id).oninput=e=>{RUN.set[k]=f(e.target.value);RUN.ramp=false;ui()};
 q('#drGo').onclick=toggle;q('#drReset').onclick=()=>reset();q('#drScen').onchange=e=>reset({scen:e.target.value});q('#drDiff').onchange=e=>reset({diff:e.target.value});q('#drSpd').onchange=e=>spd=+e.target.value;
 q('#drMode').onchange=e=>{RUN.set.mode=e.target.value;RUN.slid=e.target.value=='slide'?RUN.slid:RUN.slid;ui()};bind('drTF','tf');bind('drLen','len');bind('drWob','wob');bind('drFlow','flow');
 q('#drApply').onclick=()=>{applyRec(RUN);ui()};q('#drPU').onclick=()=>{RUN.set.wob=Math.max(0,Math.round(RUN.set.wob/2));RUN.ramp=false;RUN.stalled=false;RUN.log.push('Picked up off bottom. WOB set to '+RUN.set.wob+' t.');ui()};
 q('#drPerf').onclick=perf}
async function perf(){const P=globalThis.GX?.ddcab?.motorPerf;try{const m=P||(await import('./ddmotorperf.js?v=r1')).default||globalThis.GX?.ddcab?.motorPerf;if($('ddmp'))m.close();else{m.open();motor(RUN,RUN.set.mode=='rotate',0)}}catch(e){console.error('ddrun perf',e)}}
function gv(n,v,u='',c=''){return `<div><small>${n}</small><b class="${c}">${v}</b> <small>${u}</small></div>`}
export function ui(){if(!el||!RUN)return;const r=RUN,s=r.set,o=offsets(r),ms=r.ms||motor(r,s.mode=='rotate',0),sc=score(r),b=r.bit,last=r.surveys.at(-1),tfMode=b.inc<5?'MTF':'GTF',tfShow=r.tfAct==null?s.tf:r.tfAct,tfRead=b.inc<5?C.mtf(tfShow,b.azi):tfShow;r.ms=ms;
 const set=(id,v)=>{const e=$(id);if(e&&document.activeElement!==e)e.value=v};set('drMode',s.mode);set('drTF',s.tf);set('drLen',s.len);set('drWob',s.wob);set('drFlow',s.flow);$('drWobV').textContent=f1(s.wob);$('drFlowV').textContent=s.flow;
 const g=$('drGo');g.textContent=r.running?'⏸ Pause':'▶ Start';g.classList.toggle('on',r.running);g.setAttribute('aria-pressed',r.running);$('drPlan').textContent='Plan: '+r.planSrc+' · TD '+f1(r.td)+' m';
 const ab=o.up>=0?'Above':'Below',lr=o.right>=0?'Right':'Left',ah=o.along>=0?'Behind':'Ahead';
 $('drG').innerHTML=gv('Bit MD',f1(b.md),'m')+gv('Stand',f1(r.standMd)+'/30','m')+gv('MWD Inc',f2(last.inc),'°')+gv('MWD Azi',f2(last.azi),'°')+gv('MWD TVD',f1(last.tvd),'m')+gv('Toolface '+tfMode,f1(tfRead),'°'+(s.mode=='rotate'?' rot':''))
  +gv('Dist to plan',f1(o.dist),'m',o.dist>10?'bad':o.dist>4?'warn':'ok')+gv(ab+' plan',f1(Math.abs(o.up)),'m')+gv(lr+' of plan',f1(Math.abs(o.right)),'m')+gv(ah+' (MD)',f1(Math.abs(o.along)),'m')
  +gv('DLS needed',f2(o.dlsNeed),'°/30m',o.dlsNeed>(ms.yield||5)?'bad':'')+gv('TF needed',Math.round(o.tfNeed),'°')+gv('Diff P',f1(ms.dP),'bar',ms.stall?'bad':'')+gv('WOB',f1(s.wob),'t')+gv('ROP',f1(r.rop),'m/h')
  +gv('Motor RPM',ms.motorRpm??'-','')+gv('Motor torque',f1(ms.torque||0),'kN·m')+gv('Score',sc.score,'/100')+gv('Avg dev',f1(sc.avgDev),'m')+gv('DLS σ',f2(sc.dlsSd),'°/30m')+gv('Stalls',sc.stalls,'',sc.stalls?'bad':'');
 $('drInstr').textContent='Instruction: '+r.instr;const st=$('drStall');st.hidden=!r.stalled;st.textContent=r.stalled?'⚠ MOTOR STALL (SIM): diff pressure at stall. Pick up off bottom, let SPP settle, reduce WOB.':'';
 const en=$('drEnd');en.hidden=!r.done;en.textContent=r.done?`Run complete (SIM). Score ${sc.score}/100 · avg distance to plan ${sc.avgDev} m · DLS σ ${sc.dlsSd}°/30m · stalls ${sc.stalls}`:'';
 $('drSurv').innerHTML='<tr><th>MWD MD</th><th>Inc</th><th>Azi</th><th>TVD</th><th>DLS</th><th>Dev m</th></tr>'+r.surveys.slice(-5).reverse().map(v=>`<tr><td>${v.md}</td><td>${v.inc}</td><td>${v.azi}</td><td>${v.tvd}</td><td>${v.dls}</td><td>${v.dev}</td></tr>`).join('');draw()}
function draw(){const r=RUN;{const c=$('drVS');if(!c)return;const x=c.getContext('2d'),W=c.width,H=c.height,az=(r.plan.at(-1).azi||0)*R,vs=p=>p.E*Math.sin(az)+p.N*Math.cos(az);x.clearRect(0,0,W,H);
  const md0=Math.max(0,r.bit.md-260),md1=r.bit.md+160,pl=r.plan.filter(p=>p.md>=md0&&p.md<=md1),tr=r.truth.filter(p=>p.md>=md0),all=[...pl,...tr];const v0=Math.min(...all.map(vs))-10,v1=Math.max(...all.map(vs))+10,t0=Math.min(...all.map(p=>p.tvd))-10,t1=Math.max(...all.map(p=>p.tvd))+10,k=Math.min((W-20)/(v1-v0),(H-24)/(t1-t0));
  const X=p=>10+(vs(p)-v0)*k,Y=p=>10+(p.tvd-t0)*k;x.lineWidth=2;x.strokeStyle='#6aa9ff';x.beginPath();pl.forEach(p=>x.lineTo(X(p),Y(p)));x.stroke();x.strokeStyle='#ffb347';x.beginPath();tr.forEach(p=>x.lineTo(X(p),Y(p)));x.stroke();
  x.fillStyle='#fff';x.beginPath();x.arc(X(r.bit),Y(r.bit),4,0,7);x.fill();x.fillStyle='#7ee08a';r.surveys.filter(p=>p.md>=md0).forEach(s=>{const p=planAt(r.truth,s.md);x.fillRect(X(p)-2,Y(p)-2,4,4)});x.fillStyle='#9ab';x.font='11px system-ui';x.fillText('Section near bit: target plan (blue) · actual (orange) · surveys (green) · SIM',8,H-6)}
 {const c=$('dr3D'),x=c.getContext('2d'),W=c.width,H=c.height;x.clearRect(0,0,W,H);const ca=Math.cos(ang),sa=Math.sin(ang),pr=p=>{const u=p.E*ca-p.N*sa,w=p.E*sa+p.N*ca;return [u,p.tvd*0.9-w*0.35]},all=[...r.plan,...r.truth].map(pr);
  const u0=Math.min(...all.map(a=>a[0])),u1=Math.max(...all.map(a=>a[0])),y0=Math.min(...all.map(a=>a[1])),y1=Math.max(...all.map(a=>a[1])),k=Math.min((W-20)/(u1-u0||1),(H-24)/(y1-y0||1)),P=p=>{const a=pr(p);return [10+(a[0]-u0)*k,10+(a[1]-y0)*k]};
  x.lineWidth=2;x.strokeStyle='#6aa9ff';x.beginPath();r.plan.forEach(p=>x.lineTo(...P(p)));x.stroke();x.strokeStyle='#ffb347';x.beginPath();r.truth.forEach(p=>x.lineTo(...P(p)));x.stroke();const bp=P(r.bit);x.fillStyle='#fff';x.beginPath();x.arc(bp[0],bp[1],4,0,7);x.fill();
  x.fillStyle='#9ab';x.font='11px system-ui';x.fillText('3D: target line (blue) vs actual (orange) · SIM',8,H-6)}}
function tick(){const r=RUN;if(!r||!r.running)return;r.ticks++;ang+=0.004;if(r.ramp&&!r.stalled)r.set.wob=Math.min(40,r.set.wob+0.75);drill(r,Math.max(0.2,(r.rop||8)*0.05)*spd,0.05*spd);ui();try{syncCab()}catch(e){}}
const FIN=new Set();let W0=0;
function fin(r){if(r!==RUN||r.finFired)return;r.finFired=true;const sc=score(r),res={score:sc.score,time:{simHours:+r.hours.toFixed(2),wallSec:+((Date.now()-W0)/1000).toFixed(1)},avgDev:sc.avgDev,dlsSd:sc.dlsSd,stalls:r.stalls,diff:r.diff,seed:r.seed,plan:r.planSrc,src:'SIM'};FIN.forEach(f=>{try{f(res)}catch(e){console.warn('ddrun onFinish',e)}})}
// Plug-in API (track select etc.): load({plan,errors,difficulty,seed,scenario}) -> run; start(); onFinish(cb) -> unsubscribe, cb({score,time,...}).
export function load(o={}){if(RUN)RUN.running=false;RUN=newRun({plan:o.plan,diff:o.difficulty||o.diff||'normal',seed:o.seed??42,scen:o.scenario||o.scen||'build'});if(o.errors)Object.assign(RUN.E,o.errors);if(o.name)RUN.planSrc=o.name;RUN.log.push('Loaded: '+RUN.planSrc+' · '+RUN.diff+' (SIM)');ui();return RUN}
export function onFinish(cb){FIN.add(cb);return()=>FIN.delete(cb)}
export function start(){W0=W0&&RUN?.running?W0:Date.now();if(!RUN)reset();if(RUN.done)return;RUN.running=true;RUN.ramp=!!SCN[RUN.scen].ramp&&!RUN.stalls;if(!timer)timer=setInterval(tick,150);ui()}
export function pause(){if(RUN)RUN.running=false;ui()}
export function toggle(){RUN?.running?pause():start()}
export function reset(o={}){const run=!!RUN?.running,tk=o.track!==undefined?o.track:RUN?.track,pl=o.plan||(tk&&o.track===undefined?RUN?.plan:null),eo=o.E||(tk&&o.track===undefined?RUN?.Eo:null);RUN=newRun({scen:o.scen||RUN?.scen,diff:o.diff||RUN?.diff,seed:o.seed??RUN?.seed,plan:pl||undefined});/* ddtracks hook: optional plan / error override / track id */if(tk){RUN.track=tk;RUN.planSrc=o.planName||RUN.planSrc;if(eo){RUN.Eo=eo;Object.assign(RUN.E,eo)}}RUN.log.push('Reset: '+SCN[RUN.scen].name+' · '+RUN.diff+' · plan '+RUN.planSrc+' (SIM).');try{syncCab(true)}catch(e){}ui();return RUN}
// mirror into the cabin screens once per stand (cabin re-render is heavy)
let lastSync=-1;function syncCab(force){const s=cab?.sess;if(!s||!RUN)return;const n=RUN.surveys.length;if(!force&&n==lastSync)return;lastSync=n;s.plan=RUN.plan;s.bit={...RUN.bit};s.surveys=RUN.surveys.map(v=>({...planAt(RUN.truth,v.md),...v}));s.set.wob=RUN.set.wob;s.set.flow=RUN.set.flow;cab.render?.()}
function gp(){const g=(navigator.getGamepads?.()||[]).find(x=>x);const vis=$('ddc')&&$('ddc').style.display!='none';if(!g||!vis){pad.down=false;return}const p=!!g.buttons[9]?.pressed,t=performance.now();
 if(p&&!pad.down){pad.down=true;pad.t=t;pad.fired=false}else if(p&&pad.down&&!pad.fired&&t-pad.t>1000){pad.fired=true;reset()}else if(!p&&pad.down){pad.down=false;if(!pad.fired)toggle()}}
export function active(){return !!($('ddc')&&$('ddc').style.display!='none')}
export function mount(cabApi){cab=cabApi;css();if(!RUN)RUN=newRun({});if(!el)build();const host=$('ddc');if(host&&el.parentNode!==host){const bd=host.querySelector('.bd');host.insertBefore(el,bd||null)}ui();if(!pad.iv)pad.iv=setInterval(gp,60);return API}
const API={load,onFinish,mount,start,pause,toggle,reset,ui,active,get run(){return RUN},newRun,drill,survey:r=>survey(r),offsets,score,errors,errMag,applyRec,defaultPlan,wplanPlan,DIFF,SCN,src:'SIM'};
if(typeof window!='undefined'){window.GX=window.GX||{};GX.ddrun=API}
export default API;
