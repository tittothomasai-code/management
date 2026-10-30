// cemeval.js (helper I4, batch6): cement job evaluation after the 9-5/8" primary cement job. SIM bond log (CBL amplitude, bond index,
// pseudo VDL), top of cement after losses, and a zonal isolation check. Reuses cement.js (plan, stateAt) and centralizer.js (profile).
// No new hydraulics. All output is SIM, never LIVE. No network calls. Metric units.
import * as CM from './cement.js';import * as CZ from './centralizer.js';
export const LOG={Afree:60,Amin:1.5,biGood:0.8,isoLen:30,leadMax:0.85,tailMax:1.0,step:3};// mV free pipe (9-5/8", 3 ft) / fully bonded; NORSOK D-010 30 m
// mud displacement efficiency from standoff (SIM curve: full at Rs ≥ 67 %, falls fast under 50 %; Nelson & Guillot 2006 ch. 5)
export function dispEff(Rs){const r=Math.max(0,Math.min(100,Rs));return r>=CZ.TARGET?1:r>=50?0.75+0.25*(r-50)/(CZ.TARGET-50):0.3+0.45*r/50}
export const ampOf=bi=>LOG.Afree*Math.pow(LOG.Amin/LOG.Afree,Math.max(0,Math.min(1,bi)));
export const biOf=A=>Math.log(LOG.Afree/A)/Math.log(LOG.Afree/LOG.Amin);// bond index (Pardue et al. 1963)
export function fgShoe(C){try{const S=globalThis.GX?.strat;if(S?.pressureAt){const p=S.pressureAt(S.model(),C.shoeTVD);if(p?.fg_sg>0)return {fg:p.fg_sg,src:'strat'}}}catch(e){}return {fg:CM.FRAC,src:'SIM'}}
export function jobEcd(C,n=120){let mx=0,at=0;for(let i=0;i<=n;i++){const s=CM.stateAt(C,C.Vend*i/n);if(s.ecd>mx){mx=s.ecd;at=s.V}}return {ecdMax:mx,atV:at}}
// every: centraliser spacing in joints (1..4). fg: override frac gradient at the shoe (SG).
export function evaluate({every=null,fg=null,C=CM.plan()}={}){const R=CZ.recommend(C.w,C.P),ev=every||R.best.every,prof=CZ.profile(C.w,C.P,{every:ev});
 const F=fg!=null?{fg,src:'user'}:fgShoe(C),J=jobEcd(C),over=Math.max(0,J.ecdMax-F.fg);
 const lostM3=over>0?Math.min(0.5*(C.Vend-C.cum[1][1]+C.cum[0][1]),over*400):0;// SIM: 0.4 m³ lost per 0.001 SG over FG, max half the slurry
 const tocPlan=C.leadTop,capTop=C.leadTop<C.prev?C.capCH:C.capOH,toc=Math.min(C.tailTop,tocPlan+lostM3/capTop);
 const RsAt=md=>{if(md<C.prev)return 75;let b=prof[0];for(const p of prof)if(Math.abs(p.md-md)<Math.abs(b.md-md))b=p;return b.Rs};
 const rows=[];for(let md=Math.max(0,C.leadTop-150);md<=C.shoe;md+=LOG.step){const cem=md>=toc,Rs=RsAt(md),de=dispEff(Rs),mx=md>=C.tailTop?LOG.tailMax:LOG.leadMax,bi=cem?de*mx:0;
  rows.push({md,Rs,de,bi,amp:ampOf(bi),slurry:!cem?'mud':md>=C.tailTop?'tail':'lead',tag:'SIM'})}
 let best=0,run=0,bestTop=null,top=null;for(let i=rows.length-1;i>=0;i--){const r=rows[i];if(r.md>=C.prev&&r.bi>=LOG.biGood){if(!run)top=r.md;run+=LOG.step;if(run>best){best=run;bestTop=r.md}}else run=0}
 const shoeRun=(()=>{let L=0;for(let i=rows.length-1;i>=0;i--){if(rows[i].bi>=LOG.biGood)L+=LOG.step;else break}return L})();
 const minRs=Math.min(...prof.map(p=>p.Rs)),pass=shoeRun>=LOG.isoLen,adv=[];
 if(minRs<CZ.TARGET)adv.push(`Standoff is ${minRs.toFixed(0)} % at the lowest point. Use 1 centraliser per ${Math.max(1,R.best.every)} joint${R.best.every>1?'s':''} (${R.best.count} total).`);
 if(over>0)adv.push(`ECD ${J.ecdMax.toFixed(3)} SG was more than the fracture gradient ${F.fg.toFixed(2)} SG. About ${lostM3.toFixed(1)} m³ lost. Use a lighter lead slurry or a lower pump rate.`);
 if(toc>tocPlan+5)adv.push(`Top of cement is ${(toc-tocPlan).toFixed(0)} m deeper than planned. Do a temperature or bond log check before you drill out.`);
 if(shoeRun<LOG.isoLen)adv.push(`Only ${shoeRun} m of good bond above the shoe. The FIT can leak along a channel at the shoe.`);
 if(!pass)adv.push(`Less than ${LOG.isoLen} m of good bond above the shoe. Do a remedial squeeze before the FIT.`);
 return {C,every:ev,rec:R.best.every,count:prof.length,minRs,fg:F.fg,fgSrc:F.src,ecdMax:J.ecdMax,lostM3,tocPlan,toc,rows,bestGood:best,bestTop,shoeRun,pass,adv,tag:'SIM'}}
// ---------------- UI ----------------
const U={el:null,every:null,E:null};const $=id=>document.getElementById(id);
function draw(c,E){const dpr=Math.min(2,devicePixelRatio||1),w=c.clientWidth||360,h=c.clientHeight||420;c.width=w*dpr;c.height=h*dpr;const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
 const R=E.rows,m0=R[0].md,m1=R.at(-1).md,Y=md=>16+(md-m0)/(m1-m0)*(h-22);const tr=[[0,.12,'MD m'],[.12,.30,'Standoff %'],[.30,.52,'CBL mV 0-70'],[.52,.70,'Bond index'],[.70,1,'VDL (SIM)']];
 g.font='10px system-ui';for(const [a,b,t] of tr){g.fillStyle='#0b1218';g.fillRect(a*w,0,(b-a)*w-1,h);g.fillStyle='#cde';g.fillText(t,a*w+3,11)}
 for(let md=Math.ceil(m0/100)*100;md<=m1;md+=100){g.fillStyle='#9ab';g.fillText(md.toFixed(0),3,Y(md)+4);g.fillStyle='#fff1';g.fillRect(.12*w,Y(md),.88*w,1)}
 const dy=Math.max(1,Y(m0+LOG.step)-Y(m0));
 for(const r of R){const y=Y(r.md)-dy/2;g.fillStyle=r.Rs>=CZ.TARGET?'#2e7d32':r.Rs>=50?'#f9a825':'#c62828';g.fillRect(.12*w,y,(.18*w)*Math.min(1,r.Rs/100),dy+.5);
  g.fillStyle=r.bi>=LOG.biGood?'#2e7d32':r.bi>0.4?'#f9a825':'#c62828';g.fillRect(.52*w,y,(.18*w)*r.bi,dy+.5);
  for(let k=0;k<10;k++){const x=.70*w+k*.03*w,amp=r.amp/LOG.Afree,sh=Math.sin(r.md*0.9+k*1.7)*(1-amp)*3;g.fillStyle=`rgba(255,255,255,${0.12+0.75*(k%2?amp:amp*0.6)+(k%2?0:0.15*(1-amp))})`;g.fillRect(x+sh,y,.015*w,dy+.5)}}
 g.strokeStyle='#4fc3ff';g.lineWidth=1.4;g.beginPath();R.forEach((r,i)=>{const x=.30*w+Math.min(1,r.amp/70)*.22*w;i?g.lineTo(x,Y(r.md)):g.moveTo(x,Y(r.md))});g.stroke();
 const mark=(md,col,t)=>{if(md<m0||md>m1)return;g.strokeStyle=col;g.setLineDash([5,3]);g.beginPath();g.moveTo(0,Y(md));g.lineTo(w,Y(md));g.stroke();g.setLineDash([]);g.fillStyle=col;g.fillText(t,.13*w,Y(md)-3)};
 mark(E.C.prev,'#9ab','Previous shoe '+E.C.prev.toFixed(0)+' m');if(Math.abs(E.toc-E.tocPlan)>20)mark(E.tocPlan,'#aaa','Planned TOC '+E.tocPlan.toFixed(0)+' m');mark(E.toc,'#ffb74d','TOC '+E.toc.toFixed(0)+' m (SIM)');mark(E.C.tailTop,'#ddd','Tail top');mark(E.C.shoe-1,'#ff6b6b','Shoe '+E.C.shoe.toFixed(0)+' m')}
function render(){const E=U.E=evaluate({every:U.every});const B=$('celB'),f=(x,d=0)=>(+x).toFixed(d);
 B.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0">${[['Verdict',E.pass?'<b style="color:#6f6">ISOLATION OK</b>':'<b style="color:#f66">POOR ISOLATION</b>'],['Longest good bond in open hole',f(E.bestGood)+' m'],['Good bond above shoe',f(E.shoeRun)+' m, need '+LOG.isoLen+' m'],['TOC',f(E.toc)+' m MD (plan '+f(E.tocPlan)+')'],['Max ECD',f(E.ecdMax,3)+' SG'],['FG at shoe',f(E.fg,2)+' SG ('+E.fgSrc+')'],['Losses',f(E.lostM3,1)+' m³'],['Min standoff',f(E.minRs)+' %']].map(([a,b])=>`<div style="background:#0d1620;border:1px solid #233;border-radius:8px;padding:4px 8px"><small style="color:#9ab">${a}</small><br>${b}</div>`).join('')}</div>
 <label>Centralisers: <select id=celEv>${[1,2,3,4].map(n=>`<option value=${n} ${n==E.every?'selected':''}>1 per ${n} joint${n>1?'s':''}${n==E.rec?' (recommended)':''}</option>`).join('')}</select></label>
 <canvas id=celLog style="width:100%;height:min(52vh,460px);display:block;margin-top:6px;border-radius:8px"></canvas>
 <ul id=celAdv style="margin:6px 0 0 18px;padding:0">${E.adv.length?E.adv.map(a=>`<li>${a}</li>`).join(''):'<li>No action. Cement is good for the FIT.</li>'}</ul>
 <div style="color:#9ab;font-size:11px;margin-top:4px">SIM bond log from the job model: standoff → mud removal → bond index → CBL amplitude. Not a measured log.</div>`;
 $('celEv').onchange=e=>{U.every=+e.target.value;render()};fit();requestAnimationFrame(()=>draw($('celLog'),E))}
export function open(){if(!U.el){const d=document.createElement('section');d.id='cel';d.style.cssText='position:fixed;left:0;right:0;bottom:calc(52px + env(safe-area-inset-bottom));max-height:82vh;overflow:auto;z-index:9300;background:rgba(14,22,34,.98);border-top:1px solid #2a3a50;border-radius:14px 14px 0 0;padding:10px 12px;color:#e8eef5;font:13px system-ui';
  d.innerHTML='<div style="display:flex;align-items:center;gap:8px"><b>Cement evaluation 9-5/8"</b><span style="background:#555;border-radius:3px;padding:0 4px;font-size:11px">SIM</span><button id=celX style="margin-left:auto" aria-label="Close">✕</button></div><div id=celB></div>';document.body.appendChild(d);U.el=d;$('celX').onclick=close}
 U.el.style.display='block';fit();if(globalThis.GX?.ui?.show)try{GX.ui.show(U.el)}catch(e){}render()}
function fit(){if(!U.el||document.getElementById('celCss'))return;const st=document.createElement('style');st.id='celCss';st.textContent='body.desk #cel{left:104px!important;bottom:0!important}';document.head.appendChild(st)}
export function close(){if(U.el)U.el.style.display='none'}
export function init(){if(typeof document=='undefined')return;globalThis.GX=globalThis.GX||{};GX.cemeval={open,close,U,evaluate,dispEff,ampOf,biOf,LOG};
 const add=(n=0)=>{const a=document.getElementById('uig_seq')||document.getElementById('btnLay');if(!a){if(n<40)setTimeout(()=>add(n+1),500);return}if($('btnCEL'))return;const b=document.createElement('button');b.id='btnCEL';b.textContent='Cement log';b.title='Cement bond log and isolation check (SIM)';if(a.id=='btnLay'){b.className=a.className;a.after(b)}else a.appendChild(b);b.onclick=()=>U.el&&U.el.style.display!='none'?close():open()};add();
 if(new URLSearchParams(location.search).get('demo')=='cemlog')setTimeout(open,300)}
