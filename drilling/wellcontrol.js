// wellcontrol.js (feat/wellcontrol): kick detection, kill sheet (Driller's / Wait-and-Weight), MAASP from strat2, lost circulation + LCM pill.
// Engines reused: wellctl.js (kick/shut-in/kill simulator), fluids.js (API RP 13D hydraulics, ECD, window_ -> GX.strat.pressureAt). No new hydraulics engine.
// Everything is SIM (teaching model), never LIVE. Sources: docs/wellcontrol.md.
import * as F from './fluids.js';import * as WC from './wellctl.js';
const G=9.80665,BAR=1e5,$=id=>document.getElementById(id),f1=v=>Number.isFinite(v)?v.toFixed(1):'–',f2=v=>Number.isFinite(v)?v.toFixed(2):'–',bar=p=>f1(p/BAR);
// ---------- kick detection (API RP 59 / IADC WellSharp warning signs) ----------
export const KICK={pitGain:1.0,flowDeltaPct:10,flowDeltaM3min:0.1,breakX:2.0};
// h: [{t,pit,qin,qout}] history; rop: [{t,rop}] ; returns primary + secondary signs
export function detect(S,rop=[],o=KICK){const gain=S.pits.active-S.pits.ref,qin=S.Qin||0,dq=(S.Qout||0)-qin,dqPct=qin>0?dq/qin*100:(dq>1e-4?100:0);
 const r=rop.slice(-30),base=r.slice(0,-5).reduce((a,x)=>a+x.rop,0)/Math.max(1,r.length-5),now=r.slice(-5).reduce((a,x)=>a+x.rop,0)/Math.max(1,Math.min(5,r.length)),brk=r.length>=10&&base>0&&now>=o.breakX*base;
 const pit=gain>=o.pitGain,flow=dq*60>=o.flowDeltaM3min&&dqPct>=o.flowDeltaPct,flowPumpsOff=qin==0&&dq>1e-4;
 return {pitGain:gain,flowDelta:dq*60,flowDeltaPct:dqPct,drillBreak:brk,ropBase:base,ropNow:now,signs:{pit,flow:flow||flowPumpsOff,drillBreak:brk},kick:pit||flow||flowPumpsOff,action:pit||flow||flowPumpsOff?'Stop drilling. Pick up off bottom, stop pumps, flow check. If the well flows, shut in.':brk?'Drilling break: stop and flow check.':'Continue. Watch pits and flow.',tag:'SIM'}}
// stabilised shut-in pressures: SIDPP/SICP change < 0.35 bar/min over the last 2 min
export function stabilised(S){const h=S.hist.filter(x=>x.t>=S.t-120);if(h.length<3)return false;return Math.abs(h.at(-1).pc-h[0].pc)/BAR/((h.at(-1).t-h[0].t)/60)<0.35}
// ---------- kill sheet ----------
// kill sheet from the wellctl engine + kill profiles for both methods (drillpipe pressure vs strokes)
export function killSheet(S){const K=WC.killSheet(S);const sb=K.stkSurfBit,ba=K.stkBitSurf;
 const ww=[[0,K.icp],[sb,K.fcp],[sb+ba,K.fcp]];// W&W: one circulation, ICP -> FCP while kill mud fills the string, then hold FCP
 const dm=[[0,K.icp],[sb+ba,K.icp],[sb+ba,K.icp],[sb+ba+sb,K.fcp],[2*(sb+ba),K.fcp]];// Driller's: circ 1 hold ICP (old mud), circ 2 ICP -> FCP then hold FCP
 const step=K.sched.map((r,i)=>({...r,bar:r.p/BAR,psiPer100:i?((K.sched[i-1].p-r.p)/BAR)/((r.stk-K.sched[i-1].stk)/100||1):null}));
 return {...K,ww,dm,step,tag:'SIM'}}
export function dpAt(profile,stk){for(let i=1;i<profile.length;i++){const [s0,p0]=profile[i-1],[s1,p1]=profile[i];if(stk<=s1)return s1>s0?p0+(p1-p0)*(stk-s0)/(s1-s0):p1}return profile.at(-1)[1]}
// ---------- MAASP (IWCF): (FG_shoe - MW) x g x TVD_shoe; FG from strat2 (GX.strat.pressureAt) via fluids.window_ ----------
export function maasp(w,mwSG){const win=F.window_(w.shoeTVD),fg=win.frac;return {fgSG:fg,src:win.src||'default',lith:win.lith,mw:mwSG,maasp:(fg-mwSG)*1000*G*w.shoeTVD,tag:'SIM'}}
// ---------- lost circulation when ECD (fluids.js) > fracture gradient ----------
export const LOSS={kmD:2000,hM:10,muPa:0.03,re:50,rw:0.108};
export function ecdAt(mud,w,Q){const H=F.hydraulics(mud,w,Q,{mwdDp:0});return {ecd:mud.sg+H.ann/(1000*G*w.tvd),annDp:H.ann,spp:H.spp}}
// weakest point: shoe (strat FG at shoe TVD) and bit. Loss rate: radial Darcy q = 2πkhΔP / (μ ln(re/rw)), SIM permeability/height.
export function losses(mud,w,Q,o=LOSS){const E=ecdAt(mud,w,Q),shoe=F.window_(w.shoeTVD),bit=F.window_(w.tvd);
 const ecdShoe=mud.sg+E.annDp*(w.shoeMD/w.md)/(1000*G*w.shoeTVD),overShoe=(ecdShoe-shoe.frac)*1000*G*w.shoeTVD,overBit=(E.ecd-bit.frac)*1000*G*w.tvd,dP=Math.max(overShoe,overBit,0);
 const k=o.kmD*9.869e-16,q=dP>0?2*Math.PI*k*o.hM*dP/(o.muPa*Math.log(o.re/o.rw)):0,qh=q*3600;
 const cls=qh<=0?'none':qh<1.6?'seepage':qh<16?'partial':Q>0&&q>=Q*0.95?'total':'severe';
 return {ecd:E.ecd,ecdShoe,fgShoe:shoe.frac,fgBit:bit.frac,dP,rateM3h:Math.min(qh,Q*3600),cls,pill:lcmPill(cls,w),tag:'SIM'}}
// LCM pill by loss class (common industry guide; see docs)
export function lcmPill(cls,w){const ohLen=Math.max(30,w.md-w.shoeMD),cap=Math.PI/4*(w.holeD**2-(w.string.at(-1).od)**2),vol=Math.max(8,Math.min(ohLen,150)*cap*1.5);
 const T={none:null,seepage:{blend:'Fine CaCO3 + fine fibre',kgm3:40,spot:'Pump in mud, no stop'},partial:{blend:'Medium + coarse CaCO3, graphite, fibre',kgm3:100,spot:'Spot across loss zone, pull above, wait 1 h'},
  severe:{blend:'Coarse LCM blend, high fluid-loss squeeze pill',kgm3:150,spot:'Spot and squeeze at low rate, wait 2–4 h'},total:{blend:'Cross-link or cement plug',kgm3:0,spot:'Stop drilling. Fill annulus from top, monitor level. Plan a plug.'}}[cls];
 return T&&{...T,volM3:vol,kg:T.kgm3*vol,tag:'SIM'}}
// ---------- simulator run (headless) ----------
export function scenario(o={}){const S=WC.newWC({mud:o.mud,well:o.well});const R={S,rop:[],t:0,kickAt:null,shutAt:null};WC.takeKick(S,S.omw+(o.over??0.15));
 for(let t=0;t<(o.max??4000);t++){WC.step(S,1);R.rop.push({t,rop:S.qInf>0?40:18});const d=detect(S,R.rop);if(d.kick&&R.kickAt==null)R.kickAt=t;if(R.kickAt!=null&&t>=R.kickAt+(o.react??60)){WC.shutIn(S);R.shutAt=t;break}}
 for(let t=0;t<900&&!stabilised(S)||t<180;t++)WC.step(S,1);R.K=killSheet(S);R.M=maasp(S.w,S.omw);return R}
// ---------- UI ----------
const U={el:null,tab:'kick',R:null,S:null,rop:[],method:'dm',run:false,raf:0,last:0,speed:20};
const CSS=`#wcx{position:fixed;left:0;right:0;bottom:calc(52px + env(safe-area-inset-bottom));max-height:80vh;overflow:auto;z-index:9300;background:rgba(14,22,34,.98);border-top:2px solid #c9302c;border-radius:14px 14px 0 0;padding:10px 12px;color:#e8eef5;font:13px system-ui}
#wcx .s{background:#8a8f98;color:#fff;border-radius:6px;padding:0 4px;font-size:10px}#wcx button{min-height:38px;padding:2px 10px;border-radius:8px;border:1px solid #567;background:#1b2430;color:#dde}#wcx button.on{background:#c9302c;color:#fff}
#wcx table{border-collapse:collapse;width:100%;font-size:12px}#wcx td,#wcx th{padding:3px 5px;border-bottom:1px solid #223;text-align:left}#wcx .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}#wcx .g div{background:#0b1320;border-radius:8px;padding:6px}#wcx .g small{display:block;opacity:.65;font-size:11px}
#wcx .red{color:#ff6b6b;font-weight:700}#wcx .amb{color:#ffc04d;font-weight:700}#wcx .grn{color:#3ddc84;font-weight:700}#wcx canvas{width:100%;height:min(34vh,260px);display:block;border-radius:8px;background:#06101a}
@media(min-width:700px){#wcx{left:auto;right:12px;width:640px;border-radius:14px;border:2px solid #c9302c}}`;
function chokeInfo(){const B=globalThis.GX?.bop;if(!B?.ST)return 'BOP panel not loaded';const c=B.ST.closed||{};const hcr=c.hcr?'closed':'open';const rams=Object.entries(c).filter(([k,v])=>v&&k!='hcr').map(([k])=>k);return `BOP sim: HCR (choke line) ${hcr}; closed: ${rams.join(', ')||'none'}`}
function build(){if(U.el)return U.el;const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s);const P=document.createElement('div');P.id='wcx';
 P.innerHTML=`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><b>🛑 Well control <span class=s>SIM</span></b>${[['kick','Kick'],['kill','Kill sheet'],['maasp','MAASP and losses']].map(([k,l])=>`<button data-t=${k}>${l}</button>`).join('')}<button id=wcxX style="margin-left:auto">✕</button></div><div id=wcxB></div>`;
 document.body.appendChild(P);P.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>show(b.dataset.t));$('wcxX').onclick=close;U.el=P;return P}
function reset(){U.S=WC.newWC({});U.rop=[];U.kickAt=null;WC.takeKick(U.S,U.S.omw+0.15);U.run=true}
function show(t){U.tab=t;U.el.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t==t));const B=$('wcxB');if(!U.S)reset();
 if(t=='kick'){B.innerHTML=`<div style="font-size:12px;opacity:.85">Drilling into a zone with higher pore pressure. Watch the warning signs. When the well flows, shut in.</div><div class=g id=wcxK></div>
  <div style="display:flex;gap:6px;margin:6px 0;flex-wrap:wrap"><button id=wcxShut>Shut in (hard)</button><button id=wcxReset>Start again</button><label style="font-size:12px;align-self:center">Speed ×<select id=wcxSp>${[1,10,20,60].map(v=>`<option ${v==U.speed?'selected':''}>${v}</option>`).join('')}</select></label></div>
  <div id=wcxAct style="font-weight:700;margin:4px 0"></div><canvas id=wcxPit></canvas><div style="font-size:11px;opacity:.75;margin-top:4px">${chokeInfo()}</div>`;
  $('wcxShut').onclick=()=>{WC.shutIn(U.S)};$('wcxReset').onclick=()=>{reset();show('kick')};$('wcxSp').onchange=e=>U.speed=+e.target.value;paintKick()}
 else if(t=='kill'){const S=U.S;if(S.mode!='shutin'&&S.mode!='kill'){B.innerHTML='<p>Shut in the well first (Kick tab). Then the kill sheet uses the stabilised SIDPP and SICP.</p><button id=wcxAuto>Run a kick and shut in for me</button>';$('wcxAuto').onclick=()=>{const R=scenario();U.S=R.S;U.rop=R.rop;show('kill')};return}
  const K=killSheet(S);U.K=K;B.innerHTML=`<div class=g>${[['SIDPP',bar(K.sidpp)+' bar'],['SICP',bar(K.sicp)+' bar'],['Pit gain',f1(K.pitGain)+' m³'],['Influx',K.influxType+' '+f2(K.influxSG)+' SG'],['Original mud',f2(S.omw)+' SG'],['Kill mud (KMW)',f2(K.kmw)+' SG'],['ICP',bar(K.icp)+' bar'],['FCP',bar(K.fcp)+' bar'],['SCR @ '+K.scrSpm+' spm',bar(K.scrP)+' bar'],['Strokes surface→bit',K.stkSurfBit],['Strokes bit→shoe',K.stkBitShoe],['Strokes bit→surface',K.stkBitSurf],['MAASP (now)',bar(K.maasp)+' bar'],['MAASP (KMW)',bar(K.maaspK)+' bar']].map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
  <div style="margin:6px 0"><button data-m=dm>Driller's method</button> <button data-m=ww>Wait and Weight</button> <span class=s>SIM</span></div><canvas id=wcxDP></canvas>
  <b>Pressure step-down (surface to bit)</b><table id=wcxStep><tr><th>Strokes</th><th>DP pressure bar</th></tr>${K.step.map(r=>`<tr><td>${r.stk}</td><td>${f1(r.bar)}</td></tr>`).join('')}</table>
  <div style="font-size:11px;opacity:.75">KMW = OMW + SIDPP ÷ (g × TVD). ICP = SIDPP + SCR. FCP = SCR × KMW ÷ OMW. ${chokeInfo()}</div>`;
  B.querySelectorAll('[data-m]').forEach(b=>{b.classList.toggle('on',b.dataset.m==U.method);b.onclick=()=>{U.method=b.dataset.m;show('kill')}});paintDP()}
 else{const S=U.S,w=S.w,M=maasp(w,S.omw),Q0=F.pumpOutput(w.pump,100)*w.pump.n;U.lossSG=U.lossSG??S.omw;const mud={...F.clone(F.MUDS.wbm),sg:U.lossSG},L=losses(mud,w,U.lossQ??Q0);U.L=L;
  B.innerHTML=`<b>MAASP</b> <span class=s>SIM</span><div class=g>${[['Shoe TVD',f1(w.shoeTVD)+' m'],['Frac gradient at shoe',f2(M.fgSG)+' SG ('+(M.src=='strat'?'Earth model':'default')+')'],['Mud',f2(M.mw)+' SG'],['MAASP',bar(M.maasp)+' bar']].map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
  <div style="font-size:11px;opacity:.75">MAASP = (FG shoe − MW) × g × TVD shoe.</div><b>Lost circulation (ECD vs frac gradient)</b>
  <div style="font-size:12px;margin:4px 0">Mud SG <input id=wcxMW type=number step=0.01 value=${f2(U.lossSG)} style="width:70px"> Flow <input id=wcxQ type=number step=0.1 value=${f1((U.lossQ??Q0)*60)} style="width:70px"> m³/min <button id=wcxL>Calculate</button></div>
  <div class=g id=wcxLoss>${[['ECD at bit',f2(L.ecd)+' SG'],['ECD at shoe',f2(L.ecdShoe)+' SG'],['FG shoe / bit',f2(L.fgShoe)+' / '+f2(L.fgBit)+' SG'],['Over-pressure',bar(L.dP)+' bar'],['Loss rate',f1(L.rateM3h)+' m³/h'],['Class',`<span class=${L.cls=='none'?'grn':L.cls=='seepage'?'amb':'red'}>${L.cls}</span>`]].map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>
  ${L.pill?`<div id=wcxPill style="margin-top:6px;padding:6px;border:1px solid #c9302c;border-radius:8px"><b>LCM pill</b> <span class=s>SIM</span><br>${L.pill.blend} · ${L.pill.kgm3} kg/m³ · ${f1(L.pill.volM3)} m³ (${Math.round(L.pill.kg)} kg)<br>${L.pill.spot}</div>`:'<div id=wcxPill class=grn style="margin-top:6px">ECD is below the fracture gradient. No losses.</div>'}`;
  $('wcxL').onclick=()=>{U.lossSG=+$('wcxMW').value;U.lossQ=+$('wcxQ').value/60;show('maasp')}}}
function chart(cv,series,xl,yl,mark){const c=cv.getContext('2d'),d=devicePixelRatio||1,w=cv.width=cv.clientWidth*d,h=cv.height=cv.clientHeight*d;c.fillStyle='#06101a';c.fillRect(0,0,w,h);
 const xs=series.flatMap(s=>s.pts.map(p=>p[0])),ys=series.flatMap(s=>s.pts.map(p=>p[1]));const x1=Math.max(...xs)||1,y0=Math.min(0,...ys),y1=Math.max(...ys)*1.1||1,L=44*d,X=v=>L+v/x1*(w-L-8*d),Y=v=>h-18*d-(v-y0)/(y1-y0)*(h-30*d);
 c.font=`${10*d}px system-ui`;c.fillStyle='#9ab';c.strokeStyle='#2a4060';for(let i=0;i<=4;i++){const v=y0+(y1-y0)*i/4;c.beginPath();c.moveTo(L,Y(v));c.lineTo(w,Y(v));c.stroke();c.fillText(v.toFixed(0),2,Y(v)+3*d)}
 for(const s of series){c.strokeStyle=s.col;c.lineWidth=2*d;c.beginPath();s.pts.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](X(x),Y(y)));c.stroke()}
 if(mark)for(const [x,l] of mark){c.strokeStyle='#567';c.setLineDash([4*d,4*d]);c.beginPath();c.moveTo(X(x),12*d);c.lineTo(X(x),h-18*d);c.stroke();c.setLineDash([]);c.fillText(l,X(x)+3*d,14*d)}
 c.fillStyle='#cfd8e3';c.fillText(xl+' · '+yl+' · SIM',L+4*d,h-4*d)}
function paintDP(){const K=U.K,p=U.method=='dm'?K.dm:K.ww;chart($('wcxDP'),[{col:'#ffb020',pts:p.map(([s,v])=>[s,v/BAR])}],'Strokes','Drillpipe pressure bar',U.method=='dm'?[[K.stkSurfBit+K.stkBitSurf,'Circ 2'],[2*K.stkSurfBit+K.stkBitSurf,'KMW at bit']]:[[K.stkSurfBit,'KMW at bit']])}
function paintKick(){const S=U.S,d=detect(S,U.rop),k=$('wcxK');if(!k)return;const sg=d.signs,cl=v=>v?'red':'grn';
 k.innerHTML=[['Pit gain',`<span class=${cl(sg.pit)}>${f2(d.pitGain)} m³</span>`],['Flow out − in',`<span class=${cl(sg.flow)}>${f2(d.flowDelta)} m³/min</span>`],['Drilling break',`<span class=${cl(sg.drillBreak)}>${sg.drillBreak?'YES':'no'}</span> (${f1(d.ropNow)} m/h)`],['SIDPP',S.mode=='shutin'?bar(Math.max(0,S.Pdp))+' bar':'–'],['SICP',S.mode=='shutin'?bar(S.Pc)+' bar':'–'],['Time',Math.round(S.t)+' s'],['State',S.mode=='shutin'?(stabilised(S)?'Shut in, pressures stable':'Shut in, pressures building'):'Drilling']].map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('');
 $('wcxAct').textContent=S.mode=='shutin'?(stabilised(S)?'Pressures stable. Record SIDPP and SICP. Open the Kill sheet tab.':'Wait for the pressures to become stable.'):d.action;$('wcxAct').className=d.kick&&S.mode!='shutin'?'red':'';
 const h=S.hist.slice(-300);if(h.length>1)chart($('wcxPit'),[{col:'#4fc3ff',pts:h.map(x=>[x.t,x.pit-S.pits.ref])},{col:'#ff6b6b',pts:h.map(x=>[x.t,(x.qout-x.qin)*60])}],'Time s','Pit gain m³ (blue), flow delta m³/min (red)')}
function loop(ts){if(!U.el||U.el.style.display=='none'){U.raf=0;return}const dt=Math.min(0.2,(ts-(U.last||ts))/1000);U.last=ts;
 if(U.run&&U.tab=='kick'){const n=Math.max(1,Math.round(dt*U.speed));for(let i=0;i<n;i++){WC.step(U.S,1);U.rop.push({t:U.S.t,rop:U.S.mode=='shutin'?0:U.S.qInf>0?40:18});if(U.rop.length>200)U.rop.shift()}paintKick()}U.raf=requestAnimationFrame(loop)}
export function open(t){build();U.el.style.display='block';if(globalThis.GX?.ui?.show)try{GX.ui.show(U.el)}catch(e){}show(t||U.tab);if(!U.raf)U.raf=requestAnimationFrame(loop)}
export function close(){if(U.el)U.el.style.display='none'}
export function init(){if(typeof document=='undefined')return;globalThis.GX=globalThis.GX||{};GX.wellcontrol={open,close,U,detect,killSheet,maasp,losses,lcmPill,scenario,dpAt};
 const add=(n=0)=>{const a=document.getElementById('uig_seq')||document.getElementById('btnLay');if(!a){if(n<40)setTimeout(()=>add(n+1),500);return}if($('btnWC'))return;const b=document.createElement('button');b.id='btnWC';b.textContent='Well control';if(a.id=='btnLay'){b.className=a.className;a.after(b)}else a.appendChild(b);b.onclick=()=>U.el&&U.el.style.display!='none'?close():open()};add();
 if(new URLSearchParams(location.search).has('wellcontrol'))setTimeout(()=>open(new URLSearchParams(location.search).get('wellcontrol')||'kick'),300)}
