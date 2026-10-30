// casing.js v5.10 C1: casing design per hole section from Well Planning casing points. SIM only (concept aid, not an approved design).
// Pipe body ratings from API 5C3-style formulas on a built-in API 5CT-style SIM table (OD, nominal weight, wall, grade min yield).
// Simplified SIM load cases: burst = gas to surface from next-section pore pressure with saltwater backup; collapse = full evacuation
// against the section mud; tension = buoyed hanging weight. Metric display (mm, kg/m, m, kPa, kN). No network calls.
import * as WP from './wplan.js';
const fin=Number.isFinite,$=id=>typeof document!='undefined'?document.getElementById(id):null,es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
export const PSI=6.894757,LBF=4.448222,IN=25.4,LBFT=1.488164,G=9.80665,STEEL=7.85;
export const GRADES={'J-55':55000,'K-55':55000,'N-80':80000,'L-80':80000,'C-95':95000,'P-110':110000};
// SIM table: OD (in) → [nominal weight lb/ft, wall in]; ID = OD − 2t; grades available per OD
export const TABLE={'13-3/8':{od:13.375,w:[[54.5,.380],[61,.430],[68,.480],[72,.514]],g:['J-55','K-55','N-80','L-80','C-95']},
 '9-5/8':{od:9.625,w:[[40,.395],[43.5,.435],[47,.472],[53.5,.545]],g:['J-55','K-55','N-80','L-80','C-95','P-110']},
 '7':{od:7,w:[[23,.317],[26,.362],[29,.408],[32,.453]],g:['J-55','K-55','N-80','L-80','C-95','P-110']}};
export const HOLE={'13-3/8':'17-1/2"','9-5/8':'12-1/4"','7':'8-1/2"'};
export const DF0={burst:1.1,collapse:1.0,tension:1.6};
export const OPT={gasSG:0.1,backupSG:1.03,jointM:12.2,linerLap:100,overpullKN:0};
// ---- API 5C3 pipe-body ratings (psi / lbf) ----
export function burstPsi(Yp,D,t){return 0.875*2*Yp*t/D}
export function bodyYieldLbf(Yp,D,t){const d=D-2*t;return Yp*Math.PI/4*(D*D-d*d)}
export function collapse(Yp,D,t){const x=D/t,A=2.8762+0.10679e-5*Yp+0.21301e-10*Yp**2-0.53132e-16*Yp**3,B=0.026233+0.50609e-6*Yp,C=-465.93+0.030867*Yp-0.10483e-7*Yp**2+0.36989e-13*Yp**3,
 ba=B/A,q=3*ba/(2+ba),F=46.95e6*q**3/(Yp*(q-ba)*(1-q)**2),Gg=F*B/A,
 xYP=(Math.sqrt((A-2)**2+8*(B+C/Yp))+(A-2))/(2*(B+C/Yp)),xPT=Yp*(A-F)/(C+Yp*(B-Gg)),xTE=(2+ba)/(3*ba);
 if(x<=xYP)return {psi:2*Yp*(x-1)/x**2,mode:'yield',x};if(x<=xPT)return {psi:Yp*(A/x-B)-C,mode:'plastic',x};if(x<=xTE)return {psi:Yp*(F/x-Gg),mode:'transition',x};return {psi:46.95e6/(x*(x-1)**2),mode:'elastic',x}}
export function pipe(size,wt,grade){const T=TABLE[size];if(!T)return null;const e=T.w.find(r=>r[0]==wt)||T.w[0],t=e[1],D=T.od,Yp=GRADES[grade];const c=collapse(Yp,D,t);
 return {size,od:D,wt:e[0],grade,t,id:D-2*t,Yp,burstPsi:burstPsi(Yp,D,t),collapsePsi:c.psi,collapseMode:c.mode,dt:c.x,yieldLbf:bodyYieldLbf(Yp,D,t),
  burst:burstPsi(Yp,D,t)*PSI,collapse:c.psi*PSI,tension:bodyYieldLbf(Yp,D,t)*LBF/1000,kgm:e[0]*LBFT,odMM:D*IN,idMM:(D-2*t)*IN}}
export const sizeOf=n=>{const m=String(n).match(/(\d+)(?:-(\d+\/\d+))?"/);if(!m)return null;const k=m[2]?m[1]+'-'+m[2]:m[1];return TABLE[k]?k:null};
// ---- sections & loads ----
export function strings(L,S,CS){const cps=(CS||WP.casingMD(L,S)).map(c=>({...c,md:Math.min(c.md,L.td)})).sort((a,b)=>a.md-b.md);const tv=md=>WP.pointAt(L,S,md)[2];
 return cps.map((c,i)=>{const size=sizeOf(c.name)||['13-3/8','9-5/8','7'][Math.min(i,2)],liner=/liner/i.test(c.name),prev=cps[i-1],next=cps[i+1];
  const topMD=liner&&prev?Math.max(0,prev.md-OPT.linerLap):0;return {i,name:c.name,size,liner,hole:HOLE[size],topMD,shoeMD:c.md,topTVD:tv(topMD),shoeTVD:tv(c.md),
   nextTVD:next?tv(next.md):tv(L.td),mudSG:[1.15,1.25,1.35][Math.min(i,2)],poreNextSG:[1.10,1.20,1.25][Math.min(i,2)]}})}
// loads (kPa, kN) at TVD z within the string; all SIM simplified cases
export function loads(s,z){const gas=OPT.gasSG*G,bk=OPT.backupSG*G,Pres=s.poreNextSG*G*s.nextTVD;
 const pin=Math.max(0,Pres-gas*(s.nextTVD-z)),burst=Math.max(0,pin-bk*z),collapse=s.mudSG*G*z;return {burst,collapse,pin}}
export function evaluate(s,sel,DF){DF={...DF0,...DF};const p=pipe(s.size,sel.wt,sel.grade);const n=21,zs=[...Array(n)].map((_,k)=>s.topTVD+(s.shoeTVD-s.topTVD)*k/(n-1));
 const line=zs.map(z=>({z,...loads(s,z)}));const bMax=Math.max(...line.map(r=>r.burst)),cMax=Math.max(...line.map(r=>r.collapse));
 const BF=1-s.mudSG/STEEL,lenMD=s.shoeMD-s.topMD,hang=p.kgm*G*(s.shoeTVD-s.topTVD)*BF/1000+OPT.overpullKN;
 const sf={burst:p.burst/bMax,collapse:p.collapse/cMax,tension:p.tension/hang};const ok={burst:sf.burst>=DF.burst,collapse:sf.collapse>=DF.collapse,tension:sf.tension>=DF.tension};
 return {s,p,line,bMax,cMax,BF,hang,lenMD,sf,ok,pass:ok.burst&&ok.collapse&&ok.tension,DF}}
export function options(size){const T=TABLE[size];const out=[];for(const g of T.g)for(const [w] of T.w){const p=pipe(size,w,g);out.push({wt:w,grade:g,cost:p.kgm*(1+GRADES[g]/2e5)})}return out.sort((a,b)=>a.cost-b.cost)}
export function autoSelect(s,DF){for(const o of options(s.size)){const e=evaluate(s,o,DF);if(e.pass)return o}return options(s.size).at(-1)}
export function tally(e){const n=Math.ceil(e.lenMD/OPT.jointM),R=[];let md=e.s.shoeMD;R.push({no:'Shoe',item:'Float shoe',len:0.6,top:md-0.6,bot:md});md-=0.6;
 for(let k=1;k<=n;k++){const len=Math.min(OPT.jointM,md-e.s.topMD);if(len<=0.05)break;R.push({no:k,item:k==2?'Joint + float collar':'Joint',len,top:md-len,bot:md});md-=len}
 const w=e.p.kgm*e.lenMD/1000;return {rows:R,joints:R.length-1,collarMD:e.s.shoeMD-0.6-OPT.jointM,len:e.lenMD,tonnes:w}}
export function design(W,UI){UI=UI||{};const S=strings(W.L,W.S,W.CS);return S.map((s,i)=>{const o=UI.over?.[i]||{};if(fin(o.mudSG))s.mudSG=o.mudSG;if(fin(o.poreNextSG))s.poreNextSG=o.poreNextSG;
 const sel=o.wt&&o.grade?{wt:o.wt,grade:o.grade}:autoSelect(s,UI.DF);const e=evaluate(s,sel,UI.DF);e.auto=!(o.wt&&o.grade);e.tal=tally(e);return e})}
export function toCSV(D,name){const L=['# CASING DESIGN (SIM concept, not an approved design) — '+(name||''),'# Design factors: burst '+D[0]?.DF.burst+', collapse '+D[0]?.DF.collapse+', tension '+D[0]?.DF.tension,
 'String,Hole,OD (mm),Weight (kg/m),Grade,Top MD (m),Shoe MD (m),Shoe TVD (m),Mud SG,Burst rating (kPa),Max burst load (kPa),SF burst,Collapse rating (kPa),Max collapse load (kPa),SF collapse,Tension rating (kN),Hook load buoyed (kN),SF tension,Result,Tag'];
 for(const e of D)L.push([e.s.name,e.s.hole,e.p.odMM.toFixed(1),e.p.kgm.toFixed(2),e.p.grade,e.s.topMD.toFixed(1),e.s.shoeMD.toFixed(1),e.s.shoeTVD.toFixed(1),e.s.mudSG,e.p.burst.toFixed(0),e.bMax.toFixed(0),e.sf.burst.toFixed(2),e.p.collapse.toFixed(0),e.cMax.toFixed(0),e.sf.collapse.toFixed(2),e.p.tension.toFixed(0),e.hang.toFixed(0),e.sf.tension.toFixed(2),e.pass?'PASS':'FAIL','SIM'].map(x=>/[,"]/.test(x)?`"${String(x).replace(/"/g,'""')}"`:x).join(','));
 L.push('','# CASING TALLY','String,No,Item,Length (m),Top MD (m),Bottom MD (m)');for(const e of D)for(const r of e.tal.rows)L.push([`"${e.s.name.replace(/"/g,'""')}"`,r.no,r.item,r.len.toFixed(2),r.top.toFixed(2),r.bot.toFixed(2)].join(','));return L.join('\n')+'\n'}
// ---- UI ----
const UI={DF:{...DF0},over:[]};
function plot(e){const W=300,H=200,m=34,mx=Math.max(e.p.burst/e.DF.burst,e.p.collapse/e.DF.collapse,e.bMax,e.cMax)*1.08,y=z=>m/2+(H-m)*(z-e.s.topTVD)/Math.max(1,e.s.shoeTVD-e.s.topTVD),x=v=>m+(W-m-6)*v/mx;
 const pl=(k,c,d='')=>`<polyline fill=none stroke="${c}" stroke-width=2 ${d} points="${e.line.map(r=>x(r[k]).toFixed(1)+','+y(r.z).toFixed(1)).join(' ')}"/>`,vl=(v,c)=>`<line x1=${x(v)} x2=${x(v)} y1=${m/2} y2=${H-m/2} stroke="${c}" stroke-dasharray="5 3"/>`;
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:420px;background:#0b1320;border-radius:8px" class=csgPlot><text x=4 y=12 fill="#9ab" font-size=10>TVD ${e.s.topTVD.toFixed(0)}–${e.s.shoeTVD.toFixed(0)} m · pressure 0–${(mx/1000).toFixed(1)} MPa · SIM</text>
 ${pl('burst','#ff6b6b')}${pl('collapse','#4dabf7')}${vl(e.p.burst/e.DF.burst,'#ff6b6b')}${vl(e.p.collapse/e.DF.collapse,'#4dabf7')}
 <text x=${m} y=${H-4} fill="#ff6b6b" font-size=10>— burst load  ┆ rating/DF</text><text x=${m+150} y=${H-4} fill="#4dabf7" font-size=10>— collapse load</text></svg>`}
const chip=(ok,t)=>`<span style="padding:1px 6px;border-radius:6px;background:${ok?'#1e7d3a':'#a52a2a'};color:#fff;font-size:11px">${t}</span>`;
function html(D,W){const f=(v,d=0)=>v.toLocaleString('en-AU',{maximumFractionDigits:d,minimumFractionDigits:d});
 return `<style id=csgStyle>#csg input,#csg select{width:100%;min-width:0;box-sizing:border-box}#csg label{min-width:0}</style><div id=csg><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><b>Casing design</b><span class=wpS>SIM</span><small style="opacity:.7">concept aid, not an approved design · API 5C3-style body ratings, simplified load cases</small></div>
 <div class=wpG style="grid-template-columns:repeat(3,minmax(0,1fr))">${['burst','collapse','tension'].map(k=>`<label>DF ${k}<input id=csgDF_${k} type=number step=0.05 min=0.5 value="${UI.DF[k]}"></label>`).join('')}</div>
 ${D.map((e,i)=>`<div class=csgSec data-i=${i} style="margin:8px 0;padding:8px;border:1px solid #2a3a50;border-radius:10px">
  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b>${es(e.s.name)}</b><small>${e.s.hole} hole · ${e.s.liner?`liner top ${f(e.s.topMD)} m · `:''}shoe ${f(e.s.shoeMD)} m MD / ${f(e.s.shoeTVD)} m TVD</small> ${chip(e.pass,e.pass?'PASS':'FAIL')}</div>
  <div class=wpG style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));margin-top:4px"><label>Weight (kg/m)<select class=csgW>${TABLE[e.s.size].w.map(([w])=>`<option value=${w} ${w==e.p.wt?'selected':''}>${(w*LBFT).toFixed(1)}</option>`).join('')}</select></label>
  <label>Grade<select class=csgG>${TABLE[e.s.size].g.map(g=>`<option ${g==e.p.grade?'selected':''}>${g}</option>`).join('')}</select></label><label>Mud SG<input class=csgM type=number step=0.01 value="${e.s.mudSG}"></label><label>Next pore SG<input class=csgP type=number step=0.01 value="${e.s.poreNextSG}"></label></div>
  <small style="opacity:.75">${e.auto?'auto-selected lightest passing':'manual selection'} · OD ${f(e.p.odMM,1)} mm · ID ${f(e.p.idMM,1)} mm · D/t ${f(e.p.dt,1)} (${e.p.collapseMode} collapse)</small>
  <table class=wpT style="width:100%;margin:4px 0"><tr><th style="text-align:left">Load</th><th>Rating</th><th>Max load</th><th>SF</th><th>DF</th><th></th></tr>
  <tr><td style="text-align:left">Burst (kPa)</td><td>${f(e.p.burst)}</td><td>${f(e.bMax)}</td><td>${e.sf.burst.toFixed(2)}</td><td>${e.DF.burst}</td><td>${chip(e.ok.burst,e.ok.burst?'✓':'✗')}</td></tr>
  <tr><td style="text-align:left">Collapse (kPa)</td><td>${f(e.p.collapse)}</td><td>${f(e.cMax)}</td><td>${e.sf.collapse.toFixed(2)}</td><td>${e.DF.collapse}</td><td>${chip(e.ok.collapse,e.ok.collapse?'✓':'✗')}</td></tr>
  <tr><td style="text-align:left">Tension (kN)</td><td>${f(e.p.tension)}</td><td>${f(e.hang)}</td><td>${e.sf.tension.toFixed(2)}</td><td>${e.DF.tension}</td><td>${chip(e.ok.tension,e.ok.tension?'✓':'✗')}</td></tr></table>
  ${plot(e)}<details><summary>Tally: ${e.tal.joints} joints · ${f(e.tal.len,1)} m · ${f(e.tal.tonnes,1)} t · float collar ~${f(e.tal.collarMD,1)} m</summary><table class=wpT>${e.tal.rows.map(r=>`<tr><td>${r.no}</td><td style="text-align:left">${r.item}</td><td>${r.len.toFixed(2)}</td><td>${r.top.toFixed(1)}</td><td>${r.bot.toFixed(1)}</td></tr>`).join('')}</table></details></div>`).join('')}
 <button id=csgCsv>⬇ CSV (design + tally)</button> <button id=csgAuto>Auto-select all</button></div>`}
let W0=null;
export function register(W){W0=()=>W;W.tabs.push(['casing','Casing']);
 W.ext.casing=B=>{if(!W.L)return B.innerHTML='No plan';const D=design(W,UI);B.innerHTML=html(D,W);
  for(const k of ['burst','collapse','tension'])$('csgDF_'+k).onchange=e=>{const v=+e.target.value;if(v>0)UI.DF[k]=v;W.ext.casing(B)};
  for(const c of B.querySelectorAll('.csgSec')){const i=+c.dataset.i,o=()=>UI.over[i]=UI.over[i]||{};
   c.querySelector('.csgW').onchange=e=>{Object.assign(o(),{wt:+e.target.value,grade:c.querySelector('.csgG').value});W.ext.casing(B)};c.querySelector('.csgG').onchange=e=>{Object.assign(o(),{grade:e.target.value,wt:+c.querySelector('.csgW').value});W.ext.casing(B)};
   c.querySelector('.csgM').onchange=e=>{o().mudSG=+e.target.value;W.ext.casing(B)};c.querySelector('.csgP').onchange=e=>{o().poreNextSG=+e.target.value;W.ext.casing(B)}}
  $('csgAuto').onclick=()=>{UI.over=UI.over.map(o=>({mudSG:o?.mudSG,poreNextSG:o?.poreNextSG}));W.ext.casing(B)};
  $('csgCsv').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([toCSV(D,W.P.name)],{type:'text/csv'}));a.download='casing_design_'+W.P.name.replace(/\W+/g,'_')+'.csv';a.click()}}}
if(typeof window!='undefined'){window.GX=window.GX||{};window.GX.casing={UI,design:()=>W0?design(W0(),UI):null,pipe,collapse,strings,evaluate,toCSV,TABLE,GRADES}}
