// wo2 (helper F, workover2): panel for coiled tubing (fatigue, buckling, lock-up, circulation), fishing (tools, economics) and P&A (barriers, tests). SIM.
import * as E from './woeng2.js';import * as E3 from './woeng3.js';import * as W4 from './wo4.js?v=sj1';
const CSS=`#wo2{position:fixed;inset:0;z-index:2147483000;background:#07111bf2;color:#dfe;font:14px system-ui,sans-serif;overflow:auto;padding:10px;box-sizing:border-box}
#wo2 .t{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}#wo2 button{background:#16324a;color:#dfe;border:1px solid #3a6a8a;border-radius:6px;padding:7px 10px;font-size:14px;min-height:36px}
#wo2 button.on{background:#2a6a9a}#wo2 .sim{background:#a60;color:#fff;border-radius:4px;padding:1px 6px;font-size:12px;font-weight:700}#wo2 .g{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
#wo2 .c{background:#0d2233;border:1px solid #234;border-radius:8px;padding:8px;min-width:0}#wo2 canvas{width:100%;height:auto;background:#06121c;border-radius:6px}#wo2 table{border-collapse:collapse;width:100%;font-size:13px}
#wo2 td,#wo2 th{border-bottom:1px solid #234;padding:3px 4px;text-align:left}#wo2 .ok{color:#7f7}#wo2 .bad{color:#f77}#wo2 label{display:inline-block;margin:3px 8px 3px 0;font-size:13px}#wo2 input,#wo2 select{width:80px;background:#0a1a28;color:#dfe;border:1px solid #3a6a8a;border-radius:4px;padding:3px}`;
const R={el:null,tab:'ct',v:{trips:40,p:15,mu:0.25,Q:160,depth:3000,jt:60,jd:4000,wpn:10,stretch:300,dF:100,pipe:'2-7/8 in 6.5 lb/ft tubing',fod:2.875,hid:6.184,pbase:2430,plen:150,pstep:0,top:'clean',stuck:1,est:4,pS:0.6,rig:95,st:1600,inj:0,tagD:2302,tagW:55,test:7,drop:0.1,flow:0}};
const $=s=>R.el.querySelector(s),f=(x,n=1)=>Number.isFinite(x)?x.toFixed(n):'–',okc=b=>b?'<b class=ok>PASS</b>':'<b class=bad>FAIL</b>';
function inp(k,lab,step=1){return `<label>${lab} <input data-k=${k} type=number step=${step} value=${R.v[k]}></label>`}
function ct(){const V=R.v,w={...E.CTWELL,mu:+V.mu},Fa=E.ctFatigue2(+V.trips,+V.p),B=E.bendStrain(),L=E.lockup(w),C=E.ctCirc(+V.Q,+V.depth,w),bh=E.buckling(90,w),bv=E.buckling(0,w);
 return {html:`<div class=g><div class=c><b>Reel and injector</b> <span class=sim>SIM</span><br>${inp('trips','Trips done')}${inp('p','Pressure MPa')}${inp('mu','Friction',0.05)}
 <table><tr><td>CT</td><td>${E.CT2.od} in × ${E.CT2.wall} in, ${E.CT2.len} m on reel</td></tr><tr><td>Bend strain reel / gooseneck</td><td>${f(B.reel*100,2)} % / ${f(B.goose*100,2)} % (yield ${f(B.yield*100,2)} %)</td></tr>
 <tr><td>Cycles per trip</td><td>${Fa.cyclesPerTrip}</td></tr><tr><td>Fatigue life used</td><td id=wo2Life>${f(Fa.lifeUsedPct)} % SIM</td></tr><tr><td>Trips left</td><td>${Fa.tripsLeft} ${Fa.retire?'<b class=bad>Retire string</b>':''}</td></tr>
 <tr><td>Injector max pull / snub</td><td>${E.CT2.inj.maxPull_kN} / ${E.CT2.inj.maxSnub_kN} kN</td></tr></table></div>
 <div class=c><b>Buckling and lock-up</b> <span class=sim>SIM</span><table><tr><td>Sinusoidal (Dawson-Paslay) 90°</td><td>${f(bh.sin/1000,2)} kN</td></tr><tr><td>Helical 90°</td><td>${f(bh.hel/1000,2)} kN</td></tr>
 <tr><td>Helical vertical (Lubinski)</td><td>${f(bv.hel/1000,2)} kN</td></tr><tr><td>Lock-up depth</td><td id=wo2Lock>${L.reachTD?'Reaches TD '+w.td+' m':f(L.md,0)+' m MD'}</td></tr></table><canvas id=wo2F width=600 height=300></canvas></div>
 <div class=c><b>Circulation (API RP 13D)</b> <span class=sim>SIM</span><br>${inp('Q','Rate L/min',10)}${inp('depth','CT depth m',100)}<table><tr><td>Pump pressure</td><td id=wo2Pump>${f(C.pump_MPa)} MPa</td></tr>
 <tr><td>Inside CT (reel + well)</td><td>${f(C.ct_MPa)} MPa (${C.regCT})</td></tr><tr><td>Annulus</td><td>${f(C.ann_MPa,2)} MPa (${C.regAnn}, ${f(C.vAnn,2)} m/s)</td></tr><tr><td>Tool</td><td>${f(C.tool_MPa)} MPa</td></tr>
 <tr><td>Below 80 % burst</td><td>${okc(C.limitOK)}</td></tr></table></div></div>`,draw:()=>{const cv=$('#wo2F'),g=cv.getContext('2d');g.clearRect(0,0,600,300);g.strokeStyle='#345';g.strokeRect(40,10,550,260);
 const pts=[];for(let d=200;d<=w.td;d+=100){const r=E.rih(d,w);pts.push([d,r.surf_kN,r.lock||r.overSnub])}const mn=Math.min(-E.CT2.inj.maxSnub_kN,...pts.map(p=>p[1])),mx=Math.max(...pts.map(p=>p[1]),50);
 const X=d=>40+d/w.td*550,Y=v=>10+(mx-v)/(mx-mn)*260;g.strokeStyle='#f77';g.setLineDash([5,4]);g.beginPath();g.moveTo(40,Y(-E.CT2.inj.maxSnub_kN));g.lineTo(590,Y(-E.CT2.inj.maxSnub_kN));g.stroke();g.setLineDash([]);
 g.strokeStyle='#8fd';g.lineWidth=2;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));g.stroke();g.fillStyle='#dfe';g.font='13px sans-serif';
 g.fillText('Surface weight kN vs CT depth m (SIM)',48,26);g.fillStyle='#f77';g.fillText('Max snub',48,Y(-E.CT2.inj.maxSnub_kN)-4);if(!L.reachTD){g.fillStyle='#fd8';g.fillRect(X(L.md)-1,10,2,260);g.fillText('Lock-up',X(L.md)-60,290)}g.fillStyle='#9ab';g.fillText('0',36,288);g.fillText(w.td+' m',548,288)}}}
function fish(){const V=R.v,T=E.fishTool({topCondition:V.top,stuck:!!+V.stuck,junk:V.top=='junk',hasID:V.top!='noid'}),Ec=E.fishEcon({estDays:+V.est,pSuccess:+V.pS,rigRate:V.rig*1000,sidetrackCost:V.st*1000}),J=E.jarImpact();
 return {html:`<div class=g><div class=c><b>Select fishing tools</b> <span class=sim>SIM</span><br><label>Fish top <select data-k=top>${['clean','split','noid','junk'].map(x=>`<option ${x==V.top?'selected':''} value=${x}>${{clean:'Clean OD',split:'Split / flared',noid:'No ID access',junk:'Junk'}[x]}</option>`).join('')}</select></label>
 <label>Stuck <select data-k=stuck><option value=1 ${+V.stuck?'selected':''}>Yes</option><option value=0 ${+V.stuck?'':'selected'}>No</option></select></label><ol id=wo2Tools>${T.map(t=>`<li>${t.name}</li>`).join('')}</ol>
 <small>Jar SIM: 180 kN overpull at 2000 m gives ${f(J.stretch_m,2)} m stretch, ${f(J.energy_kJ)} kJ.</small></div>
 <div class=c><b>Fish or sidetrack?</b> <span class=sim>SIM</span><br>${inp('est','Days to fish',0.5)}${inp('pS','Chance of success',0.05)}${inp('rig','Rig k$/day',5)}${inp('st','Sidetrack k$',50)}
 <table><tr><td>Max economic fishing time</td><td>${f(Ec.Dmax)} days</td></tr><tr><td>Expected cost to fish</td><td>${f(Ec.costFish/1e6,2)} M$</td></tr><tr><td>Cost to sidetrack</td><td>${f(Ec.costST/1e6,2)} M$</td></tr>
 <tr><td>Decision</td><td id=wo2Dec><b>${Ec.decision=='fish'?'Fish':'Sidetrack'}</b></td></tr></table><small>D<sub>max</sub> = (fish value + sidetrack cost) / (rig rate + tool cost per day)</small></div></div>`}}
function pa(){const V=R.v,P=E.paPlan().map(p=>E.checkPlug(p)),tg=E.tagTest(P[0],+V.tagD,+V.tagW),pt=E.pressTest(P[0],+V.inj,+V.test,+V.drop),it=E.inflowTest(5,+V.flow);
 return {html:`<div class=g><div class=c><b>Barrier schematic (NORSOK D-010)</b> <span class=sim>SIM</span><canvas id=wo2S width=420 height=520></canvas></div>
 <div class=c><b>Cement plugs</b> <span class=sim>SIM</span><table id=wo2Plugs><tr><th>Plug</th><th>Top–base m</th><th>Length</th><th>Check</th></tr>${P.map(p=>`<tr><td>${p.id} ${p.role}</td><td>${p.top}–${p.base}</td><td>${p.L} m</td><td>${okc(p.ok)} ${p.ok?'':p.why}</td></tr>`).join('')}</table>
 <small>Cased hole plug ≥ 50 m. Open hole ≥ 100 m with 50 m above the source. UK guideline ≥ 100 ft.</small></div>
 <div class=c><b>Verify primary plug P1</b> <span class=sim>SIM</span><br>${inp('tagD','Tag depth m')}${inp('tagW','Set-down kN')}${inp('test','Test MPa',0.5)}${inp('drop','Drop MPa',0.05)}${inp('inj','Inj. press. MPa',0.5)}${inp('flow','Inflow L',0.1)}
 <table><tr><td>Tag test</td><td id=wo2Tag>${okc(tg.pass)}</td></tr><tr><td>Pressure test</td><td id=wo2PT>${okc(pt.pass)} ${pt.why}</td></tr><tr><td>Inflow test</td><td id=wo2In>${okc(it.pass)} ${it.why}</td></tr></table></div></div>`,
 draw:()=>{const cv=$('#wo2S'),g=cv.getContext('2d'),w=E.PA_WELL,D=2700,Y=d=>20+d/D*480;g.clearRect(0,0,420,520);g.font='12px sans-serif';
  const csg=[[w.surfShoe,150,'20 in'],[w.intShoe,120,'13 3/8 in'],[w.csgShoe,90,'7 in']];csg.forEach(([s,hw,n])=>{g.strokeStyle='#aab';g.lineWidth=3;g.beginPath();g.moveTo(210-hw/2,20);g.lineTo(210-hw/2,Y(s));g.moveTo(210+hw/2,20);g.lineTo(210+hw/2,Y(s));g.stroke();g.fillStyle='#aab';g.fillText(n+' shoe '+s+' m',210+hw/2+4,Y(s))});
  g.fillStyle='#c84';g.globalAlpha=.4;g.fillRect(30,Y(w.reservoir.top),360,Y(w.reservoir.base)-Y(w.reservoir.top));g.fillStyle='#ca4';g.fillRect(30,Y(w.shallowGas.top)-6,360,12);g.globalAlpha=1;
  g.fillStyle='#fd8';g.fillText('Reservoir (SIM)',4,Y(w.reservoir.top)-3);g.fillText('Shallow gas (SIM)',4,Y(w.shallowGas.top)-8);
  P.forEach((p,i)=>{g.fillStyle=p.ok?(i%2?'#4a8':'#7bd'):'#d55';g.fillRect(166,Y(p.top),88,Math.max(3,Y(p.base)-Y(p.top)));g.fillStyle='#fff';g.fillText(p.id,200,Y(p.top)+12)});
  g.strokeStyle='#7bd';g.setLineDash([4,3]);g.strokeRect(150,Y(P[0].top)-4,120,Y(P[0].base)-Y(P[0].top)+8);g.strokeStyle='#4a8';g.strokeRect(146,Y(P[1].top)-4,128,Y(P[1].base)-Y(P[1].top)+8);g.setLineDash([]);
  g.fillStyle='#7bd';g.fillText('Primary barrier',10,Y(P[0].top)+10);g.fillStyle='#4a8';g.fillText('Secondary barrier',10,Y(P[1].top)+10)}}}

// ---- batch6 tabs (woeng3) ----
function chart(cv,series,{xl,yl,xmax,ymin,ymax,lines=[]}){const g=cv.getContext('2d'),W=cv.width,H=cv.height,s=W/560,X=x=>48*s+x/xmax*(W-60*s),Y=y=>H-28*s-(y-ymin)/(ymax-ymin)*(H-44*s);g.clearRect(0,0,W,H);g.font=`${10*s}px system-ui`;
 g.strokeStyle='#234';g.fillStyle='#9ab';for(let k=0;k<=5;k++){const y=ymin+(ymax-ymin)*k/5;g.beginPath();g.moveTo(X(0),Y(y));g.lineTo(W-12*s,Y(y));g.stroke();g.fillText(f(y,0),4*s,Y(y)+3*s)}
 for(const l of lines){g.strokeStyle=l.c;g.setLineDash([6*s,4*s]);g.beginPath();g.moveTo(X(0),Y(l.y));g.lineTo(W-12*s,Y(l.y));g.stroke();g.setLineDash([]);g.fillStyle=l.c;g.fillText(l.t,X(0)+4*s,Y(l.y)-3*s)}
 for(const S of series){g.strokeStyle=S.c;g.lineWidth=2.5*s;g.beginPath();let st=false;for(const [x,y] of S.p){if(y==null){st=false;continue}st?g.lineTo(X(x),Y(y)):g.moveTo(X(x),Y(y));st=true}g.stroke();g.lineWidth=1}
 g.fillStyle='#cde';g.fillText(xl,W-150*s,H-8*s);g.fillText(yl,48*s,12*s);let lx=W-200*s;for(const S of series){g.fillStyle=S.c;g.fillText('■ '+S.n,lx,12*s);lx+=70*s}}
function ct2(){const V=R.v,M=E3.fatigueMap([{depth:+V.jd,p:+V.p,trips:+V.jt,wipers:[{from:+V.jd-500,to:+V.jd,n:+V.wpn}]}]),C=E3.weightChart({...E.CTWELL,mu:+V.mu});
 return {html:`<div class=g><div class=c><b>String fatigue map</b> <span class=sim>SIM</span><br>${inp('jt','Trips')}${inp('jd','Depth m',100)}${inp('wpn','Wipers per trip')}${inp('p','Pressure MPa')}
 <canvas id=wo3F width=1120 height=520></canvas><div id=wo3Fr>Peak ${f(M.maxPct,0)} % at ${M.atM} m from tip · ${M.retire?'<b class=bad>RETIRE or cut</b>':'<b class=ok>OK</b>'}${M.cutTipM?` · cut ${M.cutTipM} m from tip → ${M.lenAfterCut} m left`:''}</div></div>
 <div class=c><b>Weight indicator</b> <span class=sim>SIM</span><br>${inp('mu','Friction',0.05)}<canvas id=wo3W width=1120 height=520></canvas><div id=wo3Wr>Lock-up ${C.lock.reachTD?'none: CT reaches TD':f(C.lock.md,0)+' m'} · injector max pull ${C.maxPull} kN, max snub ${-C.maxSnub} kN</div></div></div>`,
 draw:()=>{chart($('#wo3F'),[{n:'damage %',c:'#f84',p:M.D.map((d,i)=>[i*M.seg,d*100])}],{xl:'m from CT tip →',yl:'life used %',xmax:E.CT2.len,ymin:0,ymax:Math.max(100,M.maxPct*1.1),lines:[{y:80,c:'#ffd54a',t:'Retire 80 %'}]});
  chart($('#wo3W'),[{n:'RIH',c:'#4cf',p:C.pts.map(q=>[q.md,q.rih])},{n:'POOH',c:'#5f5',p:C.pts.map(q=>[q.md,q.pooh])},{n:'free',c:'#999',p:C.free.map(q=>[q.md,q.f])}],{xl:'MD m →',yl:'surface load kN',xmax:E.CTWELL.td,ymin:C.maxSnub*0.6,ymax:Math.max(...C.pts.map(q=>q.pooh))*1.2,lines:[{y:0,c:'#f84',t:'0 kN: below = snub'}]})}}}
function fish2(){const V=R.v,S=E3.stuckPoint(V.pipe,+V.stretch,+V.dF),O=E3.overshot(+V.fod,+V.hid),Wp=E3.washover(+V.fod,+V.hid);
 return {html:`<div class=g><div class=c><b>Free point from stretch</b> <span class=sim>SIM</span><br><label>Pipe <select data-k=pipe style="width:200px">${Object.keys(E3.PIPES).map(k=>`<option ${k==V.pipe?'selected':''}>${k}</option>`).join('')}</select></label>${inp('stretch','Stretch mm')}${inp('dF','Extra pull kN')}
 <table><tr><td>Steel area</td><td>${f(S.A_cm2,1)} cm²</td></tr><tr><td>Free pipe length L = E·A·ΔL/ΔF</td><td id=wo3Fp><b>${f(S.freeM,0)} m</b></td></tr><tr><td>Next</td><td>Run free-point tool near ${f(S.freeM,0)} m, then back off or cut above it</td></tr></table></div>
 <div class=c><b>Overshot and wash pipe</b> <span class=sim>SIM</span><br>${inp('fod','Fish OD in',0.125)}${inp('hid','Hole ID in',0.125)}<table>
 <tr><td>Overshot</td><td id=wo3Os>${O.ok?`${O.id} (OD ${O.od} in), ${O.grapple} grapple ${O.size} in`:'<b class=bad>'+O.why+'</b>'}</td></tr><tr><td>Wash pipe</td><td id=wo3Wp>${Wp.ok?`${Wp.id}: OD ${Wp.od} in, ID ${Wp.id_in} in, gap to hole ${f(Wp.ann_in,2)} in`:'<b class=bad>'+Wp.why+'</b>'}</td></tr></table></div></div>`}}
function plug(){const V=R.v,P=E3.balancedPlug({base:+V.pbase,len:+V.plen}),i=Math.min(+V.pstep,P.steps.length-1),Z=E3.plugState(P,i,+V.pbase);
 return {html:`<div class=g><div class=c><b>Balanced cement plug</b> <span class=sim>SIM</span><br>${inp('pbase','Plug base m',10)}${inp('plen','Length m',10)}
 <table><tr><td>Cement</td><td>${f(P.Vc,2)} m³</td></tr><tr><td>Height with pipe in</td><td>${f(P.H,0)} m → top ${f(P.top,0)} m ${P.lenOK?'<b class=ok>≥ 50 m</b>':'<b class=bad>short</b>'}</td></tr><tr><td>Spacer behind (balance)</td><td>${f(P.spBehind,2)} m³</td></tr><tr><td>Displacement</td><td>${f(P.disp,2)} m³</td></tr><tr><td>Total time</td><td>${f(P.totalH,1)} h</td></tr></table>
 <div style="margin:6px 0"><button id=wo3Prev>◀ Step</button> <button id=wo3Next>Step ▶</button> <b id=wo3St>${P.steps[i].n}/${P.steps.length}: ${P.steps[i].t}</b></div>
 <table id=wo3Seq>${P.steps.map((s,k)=>`<tr style="${k==i?'background:#1c3448':''}"><td>${s.n}</td><td>${s.t}</td><td>${f(s.cum,1)} h</td></tr>`).join('')}</table></div>
 <div class=c><b>Wellbore</b> <span class=sim>SIM</span><canvas id=wo3Pc width=600 height=900></canvas></div></div>`,
 draw:()=>{const c=$('#wo3Pc'),g=c.getContext('2d'),W=c.width,H=c.height,t0=P.top-120,t1=+V.pbase+60,Y=m=>(m-t0)/(t1-t0)*H,col={cement:'#9a9a9a',spacer:'#c8a',set:'#777'};g.fillStyle='#06121c';g.fillRect(0,0,W,H);
  g.fillStyle='#234';g.fillRect(150,0,300,H);g.fillStyle='#456';g.fillRect(140,0,10,H);g.fillRect(450,0,10,H);
  for(const a of Z.ann){g.fillStyle=Z.set&&a.f=='cement'?col.set:col[a.f];g.fillRect(150,Y(a.top),300,Y(a.base)-Y(a.top))}
  g.fillStyle='#bcd';g.fillRect(270,0,12,Y(Z.pipeEnd));g.fillRect(318,0,12,Y(Z.pipeEnd));for(const a of Z.pipe){g.fillStyle=col[a.f];g.fillRect(282,Y(Math.max(t0,a.top)),36,Y(a.base)-Y(Math.max(t0,a.top)))}
  g.fillStyle='#fff';g.font='22px system-ui';g.fillText(`Top ${f(P.top,0)} m`,10,Y(P.top)+6);g.fillText(`Base ${V.pbase} m`,10,Y(+V.pbase)+6);g.fillText('Pipe end '+f(Z.pipeEnd,0)+' m',465,Y(Z.pipeEnd)+6);
  g.fillStyle='#ffd54a';g.fillText(Z.set?'Cement set (SIM)':'Cement / spacer (SIM)',160,30);
  $('#wo3Prev').onclick=()=>{R.v.pstep=Math.max(0,i-1);render()};$('#wo3Next').onclick=()=>{R.v.pstep=Math.min(P.steps.length-1,i+1);render()}}}}
Object.assign(R.v,W4.DEF);const H4=()=>({inp,f,okc,$,chart}),sqz=()=>W4.sqz(R.v,H4()),jar=()=>W4.jar(R.v,H4()); // hook: wo4 tabs
function render(){const T={ct,fish,pa,ct2,fish2,plug,sqz,jar}[R.tab](),b=$('#wo2B');b.innerHTML=T.html;T.draw?.();b.querySelectorAll('[data-k]').forEach(i=>i.onchange=()=>{R.v[i.dataset.k]=i.value;render()})}
export function open(tab='ct'){if(R.el)close();const st=document.createElement('style');st.id='wo2Css';st.textContent=CSS;document.head.appendChild(st);const d=document.createElement('div');d.id='wo2';R.el=d;
 d.innerHTML=`<div class=t><b>🔧 Coiled tubing, fishing, P&amp;A</b><span class=sim>SIM</span>${[['ct','Coiled tubing'],['ct2','CT string life'],['fish','Fishing'],['fish2','Free point / tools'],['pa','Plug and abandon'],['plug','Cement plug'],['sqz','Squeeze'],['jar','Jar blow']].map(([k,n])=>`<button data-t=${k}>${n}</button>`).join('')}<button id=wo2X style="margin-left:auto">✕ Close</button></div><div id=wo2B></div>
 <small style="opacity:.7">SIM teaching model. Simplified methods: see docs/workover2.md. Not for real well design.</small>`;document.body.appendChild(d);
 d.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>setTab(b.dataset.t));$('#wo2X').onclick=close;addEventListener('keydown',key,true);setTab(tab);window.dwWO2=api();return api()}
function setTab(t){R.tab=t;R.el.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t==t));render()}
function key(e){if(R.el&&e.key=='Escape'){close();e.stopPropagation()}}
export function close(){if(!R.el)return;removeEventListener('keydown',key,true);R.el.remove();document.getElementById('wo2Css')?.remove();R.el=null}
function api(){return {R,setTab,set:(k,v)=>{R.v[k]=v;render()},close,E}}
// fix/flakes: on phone the ui.js one-panel rule saw #wo turn visible after #wo2 opened and hid #wo2 (screenshots showed the rig). While #wo2 is open, park #wo; restore it when #wo2 closes.
if(typeof document!='undefined'&&document.body)new MutationObserver(()=>{const w=document.getElementById('wo');if(!w)return;if(R.el&&R.el.isConnected){if(w.style.display!='none'){w.dataset.wo2park=w.style.display||'_';w.style.display='none'}}else if(w.dataset.wo2park){const v=w.dataset.wo2park;delete w.dataset.wo2park;w.style.display=v=='_'?'':v}}).observe(document.body,{childList:true});
