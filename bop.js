// bop.js (helper B): BOP test SIM, after API Std 53 (5th ed. 2018) and API RP 53 practice. Open with ?demo=bop or GX.bop.open().
// API: window.BOPSIM (window.GX is replaced by the app at start, so the API is not kept only on GX).
// Pure model: pressureTest / evaluate / drawdown / functionTest. Plus a panel with pressure-vs-time charts and 3D hooks on the BOP stack (GX.bopG).
// All values are SIM unless they come from data. Pressures are in bar, with psi in brackets (API 53 limits are set in psi).
export const PSI=0.0689476,bar=p=>p*PSI,fmt=p=>`${bar(p).toFixed(1)} bar (${Math.round(p)} psi)`;
// ---- criteria (API 53) ----
export const CRIT={lowMin:250,lowMax:350,lowAbort:500,holdMin:5,// low test 250-350 psi, if >500 psi bleed to 0 and start again; hold 5 min stabilized, no visible leak
 stab:{lowPsiPerMin:3,highPsiPerMin:10},// SIM stabilization rule: pressure drop over the last 2 min of the hold (the operator's chart criteria apply on a real rig)
 ramClose:30,annClose:30,annCloseLarge:45,ddMargin:200,// closing times s; drawdown: final >= precharge + 200 psi
 testDays:21,funcDays:7};
// ---- stack and components (SIM 13-5/8" 10k surface stack) ----
export const STACK={bore:13.625,rwp:10000,masp:6500,annRwp:5000,items:[
 {id:'ann',name:'Annular preventer',kind:'annular',closeGal:17.98,openGal:14.16},
 {id:'upr',name:'Upper pipe ram',kind:'ram',closeGal:5.8,openGal:5.0},
 {id:'bsr',name:'Blind shear ram',kind:'ram',closeGal:10.6,openGal:9.8},
 {id:'lpr',name:'Lower pipe ram',kind:'ram',closeGal:5.8,openGal:5.0},
 {id:'hcr',name:'HCR valve (choke line)',kind:'valve',closeGal:0.6,openGal:0.6},
 {id:'kill',name:'Kill line valve',kind:'valve',closeGal:0.5,openGal:0.5},
 {id:'kchk',name:'Kill line check valve',kind:'check',closeGal:0,openGal:0},
 ...[['cm1','CM valve 1 (upstream, choke line inlet)','up'],['cm2','CM valve 2 (upstream, adjustable choke A)','up'],['cm3','CM valve 3 (upstream, adjustable choke B)','up'],['cm4','CM valve 4 (upstream, bypass line)','up'],
   ['cm5','CM valve 5 (downstream, to gas buster)','down'],['cm6','CM valve 6 (downstream, to flare line)','down']].map(([id,name,side])=>({id,name,kind:'manifold',side,closeGal:0,openGal:0}))]};
// choke manifold: upstream of the chokes = same rating as the rams; downstream of the chokes = lower rated part (SIM 5000 psi).
STACK.cmDownRwp=5000;
// high test pressure per API 53: rams/valves = RWP of the part, or MASP+500 if the test is after the first (lesser); annular = 70% of annular RWP or MASP (lesser)
export function highTarget(it,initial=false,S=STACK){if(it.kind=='manifold'&&it.side=='down')return initial?S.cmDownRwp:Math.min(S.cmDownRwp,S.masp+500);if(it.kind=='annular')return Math.min(0.7*S.annRwp,S.masp);return initial?S.rwp:Math.min(S.rwp,S.masp+500)}
// ---- SIM pressure test trace: pump up, hold, bleed. leak psi/min (0 = good seal). Returns [{t (s), p (psi)}] ----
export function pressureTest({target,hold=CRIT.holdMin,leak=0,rate=target>1000?1500:150,seed=1}){const P=[];let p=0,t=0;const dt=5,r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-0.5};
 while(p<target){P.push({t,p});t+=dt;p=Math.min(target,p+rate*dt/60)}const t0=t;// pump stops at target
 for(;t<=t0+hold*60+60;t+=dt){const e=(t-t0)/60;const settle=target*0.012*(1-Math.exp(-e/0.8));// fluid/temperature settle in the first minutes
  P.push({t,p:Math.max(0,target-settle-leak*e+r()*1.5)})}const pe=P.at(-1).p;for(let k=1;k<=6;k++)P.push({t:t+k*dt,p:pe*(1-k/6)});return {P,t0,t1:t0+hold*60+60,target}}
export function evaluate(T,type){const H=T.P.filter(x=>x.t>=T.t0&&x.t<=T.t1),dur=(H.at(-1).t-H[0].t)/60,L=H.filter(x=>x.t>=T.t1-120),drop=(L[0].p-L.at(-1).p)/((L.at(-1).t-L[0].t)/60||1),pmin=Math.min(...H.map(x=>x.p));
 const lim=type=='low'?CRIT.stab.lowPsiPerMin:CRIT.stab.highPsiPerMin,why=[];
 if(type=='low'&&(T.target<CRIT.lowMin||T.target>CRIT.lowMax))why.push('low test pressure is not 250–350 psi');
 if(type=='low'&&Math.max(...T.P.map(x=>x.p))>CRIT.lowAbort)why.push('pressure went above 500 psi: bleed to zero and start again');
 if(dur<CRIT.holdMin)why.push('hold is less than 5 min');if(drop>lim)why.push(`pressure drop ${drop.toFixed(1)} psi/min in the last 2 min is more than ${lim} psi/min (not stable)`);
 if(type=='high'&&pmin<0.95*T.target)why.push('pressure fell below 95% of the test pressure');
 return {pass:!why.length,why,drop,dur,pmin}}
// ---- accumulator (Boyle, isothermal) ----
export const ACC={bottles:16,galEach:11,pre:1000,op:3000,minOp:1200};// SIM: 16 x 11 gal bottles, 1000 psi precharge, 3000 psi operating
export const pAfter=(A,usedGal)=>{const V0=A.bottles*A.galEach,stored=V0*(1-A.pre/A.op);if(usedGal>=stored)return A.pre;return A.pre*V0/(V0*A.pre/A.op+usedGal)}
// drawdown test per API 53: pumps OFF, close annular + up to 4 rams (BSR substituted by upper pipe ram a second time) + open HCR. Final >= precharge+200.
export function drawdown(A=ACC,S=STACK,{seq=['ann','upr','upr','lpr','hcr-open']}={}){let used=0,t=0;const rows=[],q0=45;// q0 SIM gal/min regulator flow at full pressure
 for(const s of seq){const id=s.replace('-open',''),it=S.items.find(i=>i.id==id),v=s.endsWith('-open')?it.openGal:it.closeGal,p0=pAfter(A,used),q=q0*Math.sqrt(Math.max(0.05,(p0-A.minOp*0.5)/A.op)),sec=v/q*60;used+=v;t+=sec;
  const lim=it.kind=='annular'?(S.bore>=18.75?CRIT.annCloseLarge:CRIT.annClose):CRIT.ramClose;rows.push({fn:it.name+(s.endsWith('-open')?' (open)':' (close)'),gal:v,sec,p:pAfter(A,used),ok:sec<=lim,lim})}
 const fin=pAfter(A,used),need=A.pre+CRIT.ddMargin;return {rows,final:fin,need,pass:fin>=need&&rows.every(r=>r.ok),used}}
// function test: close/open each item from the panel; times from the same flow model at full pressure
export function functionTest(A=ACC,S=STACK){const q0=45;return S.items.filter(i=>i.closeGal).map(it=>{const sec=it.closeGal/q0*60,lim=it.kind=='annular'?(S.bore>=18.75?CRIT.annCloseLarge:CRIT.annClose):CRIT.ramClose;return {id:it.id,name:it.name,sec,lim,ok:sec<=lim}})}
// ---- 3D hooks on the existing BOP (ext2 exposes GX.bopG); fall back to nothing if missing ----
let H3=null;const ST={closed:{},plug:0};
function hook3D(){const G=window.GX?.bopG,THREE=window.GX?.THREE||window.THREE;if(H3||!G||!THREE)return H3;const M=c=>new THREE.MeshStandardMaterial({color:c,metalness:0.6,roughness:0.4});H3={rams:{},ann:null,plug:null};
 for(const [id,y] of [['upr',3.3],['bsr',2.2],['lpr',1.3]]){const g=new THREE.Group();for(const s of [-1,1]){const m=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.5,0.7),M(id=='bsr'?0x30b0ff:0xffd040));m.position.set(s*1.6,y,0);m.userData.s=s;g.add(m)}g.name='bop_'+id;G.add(g);H3.rams[id]=g}
 const ring=new THREE.Mesh(new THREE.TorusGeometry(0.9,0.22,12,32),M(0x222222));ring.rotation.x=Math.PI/2;ring.position.y=4.6;ring.name='bop_ann';G.add(ring);H3.ann=ring;
 const plug=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.45,0.5,24),M(0x9aa4ad));plug.add(body);const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,8,12),M(0x666a70));pipe.position.y=4.2;plug.add(pipe);plug.name='bop_plug';plug.visible=false;G.add(plug);H3.plug=plug;
 let tl=performance.now();const tick=()=>{const now=performance.now(),dt=Math.min(1,(now-tl)/1000);tl=now;const k=1-Math.exp(-dt*5),k2=1-Math.exp(-dt*2);for(const id in H3.rams){const c=ST.closed[id]?1:0;for(const m of H3.rams[id].children){const tgt=m.userData.s*(1.6-c*1.05);m.position.x+=(tgt-m.position.x)*k}}
  const a=ST.closed.ann?0.35:1;H3.ann.scale.x+=(a-H3.ann.scale.x)*k;H3.ann.scale.y+=(a-H3.ann.scale.y)*k;
  H3.plug.visible=ST.plug>0;const py=ST.plug==2?0.3:9;H3.plug.position.y+=(py-H3.plug.position.y)*k2;requestAnimationFrame(tick)};tick();return H3}
export function setClosed(id,v){ST.closed[id]=v;if(v&&STACK.items.find(i=>i.id==id)?.closeGal)recordTest(id,'f');hook3D();render()}
export function runPlug(v=true){ST.plug=v?2:0;hook3D();render()}
// ---- 21-day test-due tracker (SIM clock = device date + SIM day offset; stored on this device only) ----
const KEY='bopsim_v1',DAY=864e5;export const TR={load(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch{return {}}},save(o){try{localStorage.setItem(KEY,JSON.stringify(o))}catch{}}};
export const now=()=>Date.now()+(TR.load().off||0)*DAY;
export function recordTest(id,kind='p'){const o=TR.load();(o[kind]=o[kind]||{})[id]=now();TR.save(o)}
export function addDays(n){const o=TR.load();o.off=(o.off||0)+n;TR.save(o);render()}
export function dueStatus(){const o=TR.load(),t=now(),ids=STACK.items.map(i=>i.id),P=o.p||{},F=o.f||{};
 const oldP=Math.min(...ids.map(i=>P[i]||0)),oldF=Math.min(...STACK.items.filter(i=>i.closeGal).map(i=>F[i.id]||0));
 const st=(last,days)=>{if(!last)return {never:true,overdue:true,left:-1};const left=Math.floor((last+days*DAY-t)/DAY);return {last,due:last+days*DAY,left,overdue:t>last+days*DAY}};
 return {p:st(oldP,CRIT.testDays),f:st(oldF,CRIT.funcDays),missing:ids.filter(i=>!P[i])}}
const dstr=x=>new Date(x).toISOString().slice(0,10);
// ---- camera: fly to the BOP stack while the panel is open, go back on close (time based) ----
let CAM=null;const CG=()=>window.G?.cam?window.G:window.GX;// camera + controls live on window.G (see input.js)
function flyTo(kind){const g=CG(),G=window.GX?.bopG;if(!g?.cam||!g?.ctl||!G)return false;const T=window.GX.THREE||window.THREE;const c=new T.Vector3();G.getWorldPosition(c);
 const y=kind=='annular'?4.6:kind=='manifold'||kind=='check'||kind=='valve'?1.3:2.6;const tgt=c.clone().add(new T.Vector3(0,y,0)),pos=tgt.clone().add(new T.Vector3(0,1.5,8.5));
 if(!CAM)CAM={p0:g.cam.position.clone(),t0:g.ctl.target.clone()};animCam(pos,tgt);return true}
function animCam(pos,tgt){const g=CG(),a=g.cam.position.clone(),b=g.ctl.target.clone(),t0=performance.now(),D=1200;CAM.goal={pos,tgt};
 const step=()=>{const k=Math.min(1,(performance.now()-t0)/D),e=k*k*(3-2*k);g.cam.position.lerpVectors(a,pos,e);g.ctl.target.lerpVectors(b,tgt,e);g.ctl.update?.();if(k<1&&CAM?.goal?.pos===pos)setTimeout(step,16)};step()}
function camBack(){const g=CG();if(!CAM||!g?.cam)return;const c=CAM;CAM={goal:null};animCam(c.p0,c.t0);CAM=null}
// gamepad: B closes the BOP panel (own poll, so no change to input.js)
let padPrev=false;function padPoll(){const p=document.getElementById('bopP');if(!p||p.style.display=='none')return;const g=[...(navigator.getGamepads?.()||[])].find(Boolean),b=!!g?.buttons[1]?.pressed;if(b&&!padPrev)close();padPrev=b;setTimeout(padPoll,50)}
export function close(){const p=document.getElementById('bopP');if(p)p.style.display='none';camBack()}
// ---- panel ----
const $=id=>document.getElementById(id);const RES={};
function chart(cv,T,ev,label){const r=cv.getBoundingClientRect(),s=devicePixelRatio;cv.width=r.width*s;cv.height=r.height*s;const g=cv.getContext('2d'),W=cv.width,H=cv.height,tm=T.P.at(-1).t,pm=T.target*1.15;
 const X=t=>30*s+(t/tm)*(W-40*s),Y=p=>H-16*s-(p/pm)*(H-30*s);g.fillStyle='#10151c';g.fillRect(0,0,W,H);
 g.fillStyle='rgba(120,200,120,.12)';g.fillRect(X(T.t0),0,X(T.t1)-X(T.t0),H-16*s);g.strokeStyle='rgba(255,255,255,.35)';g.setLineDash([4*s,4*s]);g.beginPath();g.moveTo(X(0),Y(T.target));g.lineTo(X(tm),Y(T.target));g.stroke();g.setLineDash([]);
 g.strokeStyle=ev.pass?'#5f5':'#f55';g.lineWidth=2*s;g.beginPath();T.P.forEach((q,i)=>i?g.lineTo(X(q.t),Y(q.p)):g.moveTo(X(q.t),Y(q.p)));g.stroke();
 g.font=`${11*s}px system-ui`;g.fillStyle='#ddd';g.fillText(label+' · target '+fmt(T.target)+' · SIM',32*s,13*s);g.fillStyle='#aaa';g.fillText('time '+Math.round(tm/60)+' min · green band = hold',32*s,H-3*s)}
function render(){const B=$('bopBody');if(!B)return;const du=dueStatus(),dl=(s,n)=>s.never?`<b style=color:#f55>${n}: not done (SIM)</b>`:`${n}: last ${dstr(s.last)}, due ${dstr(s.due)} → ${s.overdue?'<b style=color:#f55>OVERDUE</b>':'<b style=color:#5f5>'+s.left+' days left</b>'}`;
 $('bopDue').innerHTML=dl(du.p,'Pressure test (every 21 days)')+'<br>'+dl(du.f,'Function test (every 7 days)')+(du.missing.length&&!du.p.never?'':du.missing.length?`<br><span style=opacity:.7>Not yet pressure tested: ${du.missing.length} of ${STACK.items.length} parts</span>`:'')+`<br><span style=opacity:.7>SIM date ${dstr(now())}</span>`;const ft=functionTest(),dd=RES.dd;
 B.querySelector('#bopFn').innerHTML=STACK.items.filter(i=>i.closeGal).map(i=>{const f=ft.find(x=>x.id==i.id);return `<tr><td>${i.name}</td><td><button data-c=${i.id}>${ST.closed[i.id]?'Open':'Close'}</button></td><td>${ST.closed[i.id]?'<b style=color:#fb4>CLOSED</b>':'open'}</td><td>${f?f.sec.toFixed(1)+' s / ≤'+f.lim+' s '+(f.ok?'✅':'❌'):''}</td></tr>`}).join('');
 B.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>setClosed(b.dataset.c,!ST.closed[b.dataset.c]));
 $('bopPlugSt').textContent=ST.plug==2?'Test plug landed in the wellhead (SIM). Casing is isolated below the plug.':'Test plug not run.';
 $('bopRes').innerHTML=Object.values(RES.tests||{}).map(r=>`<div style="margin:4px 0"><b>${r.name}</b>: low ${r.lo.pass?'<b style=color:#5f5>PASS</b>':'<b style=color:#f55>FAIL</b>'} · high ${r.hi.pass?'<b style=color:#5f5>PASS</b>':'<b style=color:#f55>FAIL</b>'}${[...r.lo.why,...r.hi.why].map(w=>'<br>⚠ '+w).join('')}</div>`).join('');
 $('bopDD').innerHTML=dd?`<table style="width:100%;font-size:12px"><tr><th align=left>Function</th><th>gal</th><th>s</th><th>Pressure after</th></tr>${dd.rows.map(r=>`<tr><td>${r.fn}</td><td>${r.gal.toFixed(1)}</td><td>${r.sec.toFixed(1)} ${r.ok?'✅':'❌'}</td><td>${fmt(r.p)}</td></tr>`).join('')}</table><div>Final ${fmt(dd.final)} · need ≥ ${fmt(dd.need)} (precharge + 200 psi) → <b id=bopDDres style="color:${dd.pass?'#5f5':'#f55'}">${dd.pass?'PASS':'FAIL'}</b></div>`:''}
export const DIR={kchk:'wellbore'};// kill line check valve: test direction. API 53: test the check valve from the wellbore side (the direction it must hold).
export function runTest(id,{leak=0,initial=false,dir}={}){const it=STACK.items.find(i=>i.id==id);if(it.kind=='check'){dir=dir||DIR.kchk;if(dir!='wellbore')leak=Math.max(leak,4000)}const lo=pressureTest({target:300,leak:leak*0.3,seed:3}),hiT=highTarget(it,initial),hi=pressureTest({target:hiT,leak,seed:7});
 const r={id,name:it.name,lo:evaluate(lo,'low'),hi:evaluate(hi,'high'),loT:lo,hiT:hi};if(it.kind=='check'&&dir!='wellbore'){const m='a check valve opens to pressure from the pump side: test it from the wellbore side';r.lo.pass=r.hi.pass=false;r.lo.why=[m];r.hi.why=[]}
 if(r.lo.pass&&r.hi.pass)recordTest(id);flyTo(it.kind);(RES.tests=RES.tests||{})[id]=r;if(it.kind=='annular'||it.kind=='ram')setClosed(id,true);
 if($('bopLo')){chart($('bopLo'),lo,r.lo,it.name+' low test');chart($('bopHi'),hi,r.hi,it.name+' high test')}render();return r}
export function runDrawdown(A){RES.dd=drawdown(A);render();return RES.dd}
export function open(){let p=$('bopP');if(!p){p=document.createElement('div');p.id='bopP';p.style.cssText='position:fixed;inset:0;z-index:9800;background:#0d1117f2;color:#ddd;overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 8px) 8px 40px;font:13px system-ui';if(innerWidth>=1024)p.style.cssText+=';inset:0 0 0 auto;width:480px;border-left:1px solid #2a3a50';// desktop: side panel, so the 3D BOP stays in view
 const opts=STACK.items.map(i=>`<option value=${i.id}>${i.name}</option>`).join('');
 p.innerHTML=`<div style="display:flex;gap:6px;align-items:center"><b style="font-size:15px">BOP test</b><span id=bopSim style="background:#8a8f98;color:#fff;border-radius:6px;padding:1px 6px;font-size:11px">SIM</span><span style="flex:1"></span><button id=bopX>✕</button></div>
 <div style="opacity:.75;margin:4px 0">Training only. Stack: ${STACK.bore}" ${STACK.rwp} psi surface BOP (SIM). Rules from API Std 53. Pressures in bar (psi).</div><div id=bopBody>
 <h4 style="margin:8px 0 4px">Test due (SIM)</h4><div id=bopDue></div><button id=bopDay>+7 SIM days</button> <button id=bopRst>Reset dates</button>
 <h4 style="margin:8px 0 4px">1. Test plug</h4><button id=bopPlug>⬇ Run test plug</button> <button id=bopPull>⬆ Pull test plug</button> <span id=bopPlugSt></span>
 <h4 style="margin:8px 0 4px">2. Function test (close / open, times)</h4><table style="width:100%;font-size:12px" id=bopFn></table>
 <h4 style="margin:8px 0 4px">3. Pressure test (low 250–350 psi, then high; hold 5 min)</h4><select id=bopSel>${opts}</select> <label><input type=checkbox id=bopLeak> add a SIM leak</label> <label id=bopDirL style="display:none">Pressure from <select id=bopDir><option value=wellbore>wellbore side</option><option value=pump>pump side</option></select></label> <button id=bopRun>▶ Run test</button> <button id=bopAll>Run all</button>
 <canvas id=bopLo style="width:100%;height:150px;display:block;margin-top:4px"></canvas><canvas id=bopHi style="width:100%;height:150px;display:block;margin-top:4px"></canvas><div id=bopRes></div>
 <h4 style="margin:8px 0 4px">4. Accumulator drawdown (pumps off)</h4><label>Bottles <input id=bopNb type=number value=${ACC.bottles} style="width:50px"></label> <label>Precharge psi <input id=bopPre type=number value=${ACC.pre} style="width:60px"></label> <button id=bopDDrun>▶ Run drawdown</button><div id=bopDD></div>
 <div style="opacity:.7;font-size:11px;margin-top:8px">Rules: low test 250–350 psi; above 500 psi, bleed to zero and start again. Hold each test 5 min or more with a stable pressure and no visible leak. Rams close in 30 s or less. Annular closes in 30 s or less (45 s if the bore is 18-3/4" or more). After the drawdown, accumulator pressure must be 200 psi or more above precharge. Pressure test every 21 days or less. Function test every 7 days. Test the kill line check valve from the wellbore side. Test choke manifold valves one at a time, in the direction of flow: upstream of the chokes to the ram rating, downstream to the lower rating.</div></div>`;
 document.body.appendChild(p);$('bopX').onclick=close;$('bopDay').onclick=()=>addDays(7);$('bopRst').onclick=()=>{TR.save({});render()};$('bopSel').onchange=()=>{$('bopDirL').style.display=$('bopSel').value=='kchk'?'':'none'};$('bopPlug').onclick=()=>runPlug(true);$('bopPull').onclick=()=>runPlug(false);
 $('bopRun').onclick=()=>{if(ST.plug!=2)runPlug(true);runTest($('bopSel').value,{leak:$('bopLeak').checked?25:0,dir:$('bopDir').value})};$('bopAll').onclick=()=>{runPlug(true);for(const i of STACK.items)runTest(i.id,{leak:$('bopLeak').checked&&i.id=='upr'?25:0})};
 $('bopDDrun').onclick=()=>runDrawdown({...ACC,bottles:+$('bopNb').value||ACC.bottles,pre:+$('bopPre').value||ACC.pre})}
 p.style.display='block';hook3D();render();flyTo('ram');padPrev=true;setTimeout(padPoll,50);setTimeout(()=>$('bopX')?.focus(),0);window.BOPSIM={open,runTest,runDrawdown,runPlug,setClosed,ST,RES,STACK,CRIT,drawdown,pressureTest,evaluate,functionTest,hook3D:()=>hook3D(),dueStatus,addDays,TR,flyTo,close,highTarget,CAM:()=>CAM};if(window.GX)GX.bop=window.BOPSIM;return p}
if(typeof document!='undefined'){window.BOPSIM_open=open;if(new URLSearchParams(location.search).get('demo')=='bop'){const go=()=>document.getElementById('start')?setTimeout(go,300):open();setTimeout(go,500)}}
