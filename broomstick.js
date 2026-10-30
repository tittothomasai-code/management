// broomstick.js (feat/casing-broomstick): broomstick chart for the 9-5/8" casing run + HUD hookload.
// Model curves: casingtd.js broomstick() (Johancsik soft-string T&D, SPE 11380) for μ 0.1–0.4. Measured points: casingtd output td.so
// from the ops3d.js run timeline (stateAt / window.dwOps.last). No new T&D engine. Everything SIM, never LIVE. Sources: docs/casing-broomstick.md.
import {broomstick} from './casingtd.js';import {well,casingPlan,stateAt,G} from './ops3d.js?v=b4';
export const MUS=[0.1,0.2,0.3,0.4];const $=id=>document.getElementById(id),f0=v=>Number.isFinite(v)?Math.round(v).toString():'–';
export function tdOpts(P){return {kgm:P.kgm,mudSG:P.s.mudSG,odM:P.Dp,prevShoeMD:P.prev.shoeMD}}
export function curves(w,P,step=50){return broomstick(w,P.s.shoeMD,tdOpts(P),MUS,step)}
// SIM "measured" hookload: td.so (running in) and td.pu at each joint, with a small deterministic sensor scatter (±1 %)
export function measured(P,w,n=60){const out=[];let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647-0.5;
 for(let i=1;i<=n;i++){const s=stateAt(P,w,P.T*i/n*0.97);if(s.shoeMD<5)continue;out.push(fromState(s,1+rnd()*0.02))}return out}
export function fromState(s,k=1){return {md:s.shoeMD,so:s.td.so*k,pu:s.td.pu*k,rot:s.td.rot*k,src:'SIM'}}
// apparent friction factor: interpolate the measured slack-off between the model so-curves at that depth
export function curvesAt(C,md){let i=C.findIndex(r=>r.md>=md);i=i<0?C.length-1:Math.max(1,i);const a=C[Math.min(i,C.length-1)-1]||C[0],b=C[Math.min(i,C.length-1)],t=b.md>a.md?Math.min(1,Math.max(0,(md-a.md)/(b.md-a.md))):0,o={md};for(const k of Object.keys(a))if(k!='md')o[k]=a[k]+(b[k]-a[k])*t;return o}
export function apparentMu(C,pt){const r=curvesAt(C,pt.md),so=MUS.map(m=>r['so'+m]);// so falls as μ rises
 if(so[0]-so.at(-1)<0.05*so[0])return null;// near-vertical: curves too close to read μ
 if(pt.so>=so[0])return MUS[0];if(pt.so<=so.at(-1))return MUS.at(-1);for(let i=1;i<so.length;i++)if(pt.so>=so[i])return MUS[i-1]+(MUS[i]-MUS[i-1])*(so[i-1]-pt.so)/(so[i-1]-so[i]);return null}
export function advice(mu,plan=0.3){return mu==null?'':mu>plan+0.07?'Slack-off is low: friction is higher than plan. Check hole cleaning and ledges. Do not force the casing down.':mu<plan-0.12?'Slack-off is high: friction is lower than plan. Check that the string weight is correct.':'Hookload follows the plan friction.'}
const COL={0.1:'#4fc3ff',0.2:'#3ddc84',0.3:'#ffc04d',0.4:'#ff6b6b'};
// chart: x = hookload kN, y = depth MD down (classic broomstick)
export function draw(cv,C,pts,opt={}){const c=cv.getContext('2d'),d=devicePixelRatio||1,W=cv.width=Math.max(10,cv.clientWidth*d),H=cv.height=Math.max(10,cv.clientHeight*d);c.fillStyle='#06101a';c.fillRect(0,0,W,H);
 const maxMD=Math.max(C.at(-1).md,...pts.map(p=>p.md)),maxF=Math.max(...C.map(r=>r['pu'+MUS.at(-1)]),...pts.map(p=>p.pu||0))*1.05,L=36*d,T=10*d,B=26*d,X=v=>L+v/maxF*(W-L-8*d),Y=v=>T+v/maxMD*(H-T-B),fs=(opt.small?9:11)*d;
 c.font=`${fs}px system-ui`;c.strokeStyle='#22364d';c.fillStyle='#9ab';for(let i=0;i<=4;i++){const md=maxMD*i/4,f=maxF*i/4;c.beginPath();c.moveTo(L,Y(md));c.lineTo(W,Y(md));c.moveTo(X(f),T);c.lineTo(X(f),H-B);c.stroke();c.fillText(f0(md),2,Y(md)+fs/3);if(i)c.fillText(f0(f),X(f)-fs,H-B+fs+2*d)}
 const line=(k,col,dash)=>{c.strokeStyle=col;c.setLineDash(dash||[]);c.lineWidth=(opt.small?1.2:1.8)*d;c.beginPath();C.forEach((r,i)=>c[i?'lineTo':'moveTo'](X(r[k]),Y(r.md)));c.stroke();c.setLineDash([])};
 line('rot','#c9d3df',[2*d,3*d]);for(const m of MUS){line('pu'+m,COL[m]);line('so'+m,COL[m],[6*d,4*d])}
 for(const p of pts){c.fillStyle='#fff';c.beginPath();c.arc(X(p.so),Y(p.md),(opt.small?1.8:2.6)*d,0,7);c.fill()}
 if(opt.now){c.strokeStyle='#ff00d0';c.lineWidth=2*d;c.beginPath();c.arc(X(opt.now.so),Y(opt.now.md),5*d,0,7);c.stroke()}
 c.fillStyle='#cfd8e3';c.fillText('Hookload kN → · depth MD m ↓ · SIM',L+4*d,H-4*d);
 if(!opt.small){let x=L+6*d;for(const m of MUS){c.fillStyle=COL[m];c.fillText('μ '+m,x,T+fs+2*d);x+=46*d}c.fillStyle='#cfd8e3';c.fillText('— PU  - - SO  ··· ROT  ● measured SO',x,T+fs+2*d)}}
// ---------- panel ----------
const U={el:null,C:null,P:null,w:null,pts:null};
function data(){if(!U.C){U.w=well();U.P=casingPlan(U.w);U.C=curves(U.w,U.P);U.pts=measured(U.P,U.w)}return U}
export function open(){const D=data();if(!U.el){const P=document.createElement('div');P.id='bstk';P.style.cssText='position:fixed;left:0;right:0;bottom:calc(52px + env(safe-area-inset-bottom));max-height:82vh;overflow:auto;z-index:9300;background:rgba(14,22,34,.98);border-top:2px solid #ffc04d;border-radius:14px 14px 0 0;padding:10px 12px;color:#e8eef5;font:13px system-ui';
  if(innerWidth>=700)P.style.cssText+=';left:auto;right:12px;width:640px;border:2px solid #ffc04d;border-radius:14px';document.body.appendChild(P);U.el=P}
 const last=D.pts.at(-1),mu=apparentMu(D.C,last);
 U.el.innerHTML=`<div style="display:flex;align-items:center;gap:8px"><b>Casing broomstick · 9-5/8"</b><span style="background:#8a8f98;border-radius:6px;padding:0 5px;font-size:10px">SIM</span><button id=bstkX style="margin-left:auto;min-height:36px">✕</button></div>
 <div style="font-size:12px;opacity:.8;margin:4px 0">Model pick-up, slack-off and rotating hookload for friction factors 0.1 to 0.4 (soft-string). Points: hookload while running in (slack-off). Shoe ${f0(D.P.s.shoeMD)} m MD, mud ${D.P.s.mudSG} SG.</div>
 <canvas id=bstkC style="width:100%;height:min(52vh,420px);display:block;border-radius:8px"></canvas>
 <table style="width:100%;font-size:12px;margin-top:6px"><tr><td>Last point</td><td id=bstkLast>${f0(last.md)} m · SO ${f0(last.so)} kN</td></tr><tr><td>Apparent friction</td><td id=bstkMu>${mu?.toFixed(2)} (plan 0.20 cased / 0.30 open hole)</td></tr><tr><td>Action</td><td>${advice(mu)}</td></tr></table>`;
 U.el.style.display='block';$('bstkX').onclick=close;requestAnimationFrame(()=>draw($('bstkC'),D.C,D.pts))}
export function close(){if(U.el)U.el.style.display='none'}
// ---------- HUD in ops3d casing run ----------
const H={pts:[],lastMD:-1,C:null};
function hudTick(){const O=window.dwOps,S=$('ops3d');if(!O||!S||O.mode!='casing'||!O.last?.td){H.pts=[];H.lastMD=-1;return}
 if(!H.C||H.P!==O.P){H.P=O.P;H.C=curves(O.w,O.P,100);H.pts=[]}
 const s=O.last,p=fromState(s);if(!H.pts.length&&O.stateAt){const T=Math.min(O.t,O.P.T);for(let i=1;i<40;i++){const q=O.stateAt(T*i/40);if(q.shoeMD>5&&q.shoeMD<p.md)H.pts.push(fromState(q))}H.lastMD=H.pts.at(-1)?.md??-1}// replay the run so farif(Math.abs(p.md-H.lastMD)>=6){H.pts.push(p);H.lastMD=p.md;if(H.pts.length>400)H.pts.shift()}
 let box=$('bsHud');if(!box){box=document.createElement('div');box.id='bsHud';box.style.cssText='position:absolute;right:10px;top:216px;width:min(42vw,200px);background:#0b1320dd;border:1px solid #2a3a50;border-radius:8px;padding:4px;font:11px system-ui;color:#e6eef8;pointer-events:none';
  box.innerHTML='<div><b>Hookload</b> <span style="background:#b58900;color:#000;border-radius:4px;padding:0 4px;font-weight:700">SIM</span></div><div id=bsHL style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums"></div><div id=bsMu style="opacity:.8"></div><canvas id=bsC style="width:100%;height:140px;display:block"></canvas>';S.appendChild(box);const nx=$('o3next');if(nx)nx.style.top='420px'}
 const mu=apparentMu(H.C,p);$('bsHL').textContent=`${f0(p.so)} kN · ${(p.so/G).toFixed(0)} t`;$('bsMu').textContent=`SO at ${f0(p.md)} m · μ≈${mu?.toFixed(2)??'–'}`;draw($('bsC'),H.C,H.pts,{small:true,now:p})}
export function init(){if(typeof document=='undefined')return;globalThis.GX=globalThis.GX||{};GX.broomstick={open,close,curves,measured,apparentMu,H,U};setInterval(()=>{try{hudTick()}catch(e){console.error('broomstick hud',e)}},250);
 const add=(n=0)=>{const a=$('uig_seq')||$('btnLay');if(!a){if(n<40)setTimeout(()=>add(n+1),500);return}if($('btnBroom'))return;const b=document.createElement('button');b.id='btnBroom';b.textContent='Casing broomstick';if(a.id=='btnLay'){b.className=a.className;a.after(b)}else a.appendChild(b);b.onclick=()=>U.el&&U.el.style.display!='none'?close():open()};add();
 if(new URLSearchParams(location.search).has('broomstick'))setTimeout(open,300)}
