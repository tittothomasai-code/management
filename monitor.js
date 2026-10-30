// monitor.js v5.9.3: "Monitor a well" — phone-first progress view. SIM unless a saved WITSML connection exists.
// Saved WITSML: uses ONLY the existing saved-connection behaviour (opens the existing WITSML panel to reconnect; reads window.WML/S once
// that panel reports "connected"). This module makes NO network calls of its own. SIM data is always labelled SIM, never LIVE. Metric units.
import * as WP from './wplan.js?v=592';
const $=id=>document.getElementById(id),RKEY='dw-witsml-remember';
const saved=()=>{try{const r=JSON.parse(localStorage.getItem(RKEY)||'null');return r&&(r.url||r.well||r.log)?r:null}catch{return null}};
const M={el:null,src:'SIM',timer:0,t:0,hist:[],surv:[],plan:null,cas:[],speed:120,last:null};
const fmt=(v,d=0)=>Number.isFinite(v)?v.toFixed(d):'–';
const hm=h=>!Number.isFinite(h)?'–':h<48?`${fmt(h,1)} h`:`${fmt(h/24,1)} d`;
// ---- plan (SIM proposal A from Well Planning) ----
function loadPlan(){const W=WP.W;if(!W.L)WP.calc(JSON.parse(JSON.stringify(WP.DEFAULT)));const rows=W.S.rows.map(r=>({md:r.md,tvd:r.tvd,n:r.n??r.N??0,e:r.e??r.E??0,inc:r.inc}));
 const td=rows.at(-1).md;let cas=[];try{cas=WP.casingMD(W.L,W.S).map(c=>({name:c.name,md:Math.min(td,c.md)}))}catch{}
 cas=cas.filter(c=>Number.isFinite(c.md));return {rows,td,name:(W.P&&W.P.name)||'SIM proposal A',cas:cas.sort((a,b)=>a.md-b.md)}}
function at(md){const R=M.plan.rows;if(md<=R[0].md)return R[0];for(let i=1;i<R.length;i++)if(R[i].md>=md){const a=R[i-1],b=R[i],f=(md-a.md)/((b.md-a.md)||1);return {md,tvd:a.tvd+f*(b.tvd-a.tvd),n:a.n+f*(b.n-a.n),e:a.e+f*(b.e-a.e),inc:a.inc+f*(b.inc-a.inc)}}return R.at(-1)}
const vs=p=>Math.hypot(p.n,p.e);
// ---- SIM engine (deterministic, time-compressed) ----
const STAND=28,CONN_H=0.25,SURV_H=0.1,CSG_H=14;
const ropFor=md=>{const k=M.plan.cas.filter(x=>x.md<=md).length;return [45,28,16,12][Math.min(3,k)]};
function simStep(dtH){const s=M.st;if(s.md>=M.plan.td-1e-6){s.act='At TD (SIM) · circulating';return}
 if(s.wait>0){s.wait-=dtH;if(s.wait<=0){s.act='Drilling (SIM)';}return}
 const rop=ropFor(s.md)*(0.85+0.3*Math.abs(Math.sin(s.md/37)));s.rop=rop;const nm=Math.min(M.plan.td,s.md+rop*dtH);
 const nextStand=Math.floor(s.md/STAND+1)*STAND,cp=M.plan.cas.find(c=>c.md>s.md+1e-6&&c.md<=nm);
 if(cp){s.md=cp.md;s.act=`Casing point reached: ${cp.name} — running casing & cementing (SIM)`;s.wait=CSG_H;s.rop=0;survey(s.md);return}
 if(nm>=nextStand&&nextStand<M.plan.td){s.md=nextStand;s.act='Connection + survey (SIM)';s.wait=CONN_H+SURV_H;s.rop=0;survey(s.md);return}
 s.md=nm;s.act=s.md>=M.plan.td?'At TD (SIM) · circulating':'Drilling (SIM)'}
function survey(md){const p=at(md),dn=2.5*Math.sin(md/310)+md/900,de=2*Math.cos(md/270)-1,dt=1.2*Math.sin(md/450);
 M.surv.push({md,inc:p.inc,tvd:p.tvd+dt,n:p.n+dn,e:p.e+de,dist:Math.hypot(dn,de,dt),t:M.t});if(M.surv.length>400)M.surv.shift()}
function record(){const s=M.st,live=M.src=='SIM';const w=live?(s.rop>0?18+6*Math.sin(M.t*3):0):NaN;
 M.hist.push({t:M.t,md:s.md,rop:s.rop||0,wob:w,spp:s.rop>0?14000+40*s.md/10:s.act.startsWith('Conn')?0:9000,hook:s.rop>0?600+s.md*0.32:350+s.md*0.4,act:s.act});if(M.hist.length>3000)M.hist.splice(0,M.hist.length-3000)}
function startSim(){M.plan=loadPlan();M.st={md:0,rop:0,act:'Drilling (SIM)',wait:0};M.t=0;M.hist=[];M.surv=[];
 // prefill history to ~40% of TD so the view is populated, 6-minute steps
 while(M.st.md<M.plan.td*0.4){M.t+=0.1;simStep(0.1);record()}}
function tick(){if(M.src=='SIM'){const dt=M.speed/3600;M.t+=dt;simStep(dt);record()}else readWitsml();render()}
// ---- saved WITSML: read-only view of what the existing connection already provides ----
function readWitsml(){const W=window.WML,S=window.S;M.wstat=W?.status||'not connected';if(!W||!/connect/i.test(M.wstat)||/not/i.test(M.wstat)||!S)return;
 M.t=(S.t||0)/3600;const md=S.md;if(!Number.isFinite(md))return;const prev=M.hist.at(-1);const rop=prev&&M.t>prev.t?Math.max(0,(md-prev.md)/(M.t-prev.t)):0;
 M.st={md,rop,act:S.slips?'In slips / connection':S.Q>0&&rop>0?'Drilling':S.Q>0?'Circulating':'Pumps off',wait:0};M.hist.push({t:M.t,md,rop,wob:S.wob,spp:S.spp,hook:S.hook,act:M.st.act})}
// ---- derived ----
function stats(){const s=M.st,P=M.plan,H=M.hist;const cur=at(s.md);
 const win=H.filter(h=>h.t>=M.t-24);const net=win.length>1?(win.at(-1).md-win[0].md)/Math.max(1e-6,win.at(-1).t-win[0].t):NaN;
 const left=Math.max(0,P.td-s.md),casLeft=P.cas.filter(c=>c.md>s.md+1e-6&&c.md<P.td-1).length;
 const eta=left<=0?0:Number.isFinite(net)&&net>0?left/net+casLeft*CSG_H:NaN;
 const done=P.cas.filter(c=>c.md<=s.md+1e-6),next=P.cas.find(c=>c.md>s.md+1e-6);
 const sec=next?`${done.length?done.at(-1).name+' set · ':''}drilling to ${next.name} @ ${fmt(next.md)} m MD`:'All casing points reached';
 const pt=planTime(),behind=Number.isFinite(pt)?M.t-pt:NaN;return {cur,net,eta,left,sec,next,done,behind}}
function planTime(){// plan curve: nominal ROP + nominal flat time; time the plan reaches current MD
 let t=0,md=0;const P=M.plan,tgt=M.st.md;while(md<tgt-1e-6){const r=ropFor(md),cp=P.cas.find(c=>c.md>md+1e-6),nx=Math.min(tgt,(Math.floor(md/STAND)+1)*STAND,cp?cp.md:Infinity);t+=(nx-md)/r;md=nx;if(md<tgt-1e-6){t+=cp&&Math.abs(cp.md-md)<1e-6?CSG_H:CONN_H+SURV_H}}return t}
function planCurve(){const P=M.plan,out=[[0,0]];let t=0,md=0;while(md<P.td-1e-6){const r=ropFor(md),cp=P.cas.find(c=>c.md>md+1e-6),nx=Math.min(P.td,(Math.floor(md/STAND)+1)*STAND,cp?cp.md:Infinity);t+=(nx-md)/r;md=nx;out.push([t,md]);if(md<P.td-1e-6){t+=cp&&Math.abs(cp.md-md)<1e-6?CSG_H:CONN_H+SURV_H;out.push([t,md])}}return out}
// ---- drawing ----
function cv(id){const c=$(id),r=c.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);if(c.width!=Math.round(r.width*d)){c.width=Math.round(r.width*d);c.height=Math.round(r.height*d)}const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,r.width,r.height);return [x,r.width,r.height]}
function axes(x,w,h,xl,yl,X0,X1,Y0,Y1,inv){x.strokeStyle='#2c4258';x.fillStyle='#8fb3cf';x.font='10px system-ui';x.lineWidth=1;const L=40,B=18;
 for(let i=0;i<=4;i++){const y=6+(h-B-6)*i/4,v=inv?Y0+(Y1-Y0)*i/4:Y1-(Y1-Y0)*i/4;x.beginPath();x.moveTo(L,y);x.lineTo(w-4,y);x.stroke();x.fillText(fmt(v),2,y+3)}
 for(let i=0;i<=4;i++){const xx=L+(w-L-4)*i/4;x.fillText(fmt(X0+(X1-X0)*i/4,X1-X0<10?1:0),xx-8,h-4)}x.fillText(xl,w-60,h-4);x.save();x.translate(10,h/2);x.restore();x.fillText(yl,L+4,14);
 return (X,Y)=>[L+(w-L-4)*(X-X0)/((X1-X0)||1),inv?6+(h-B-6)*(Y-Y0)/((Y1-Y0)||1):6+(h-B-6)*(1-(Y-Y0)/((Y1-Y0)||1))]}
function line(x,f,pts,col,dash){x.strokeStyle=col;x.lineWidth=2;x.setLineDash(dash||[]);x.beginPath();pts.forEach((p,i)=>{const [a,b]=f(p[0],p[1]);i?x.lineTo(a,b):x.moveTo(a,b)});x.stroke();x.setLineDash([])}
function draw(){const H=M.hist;if(!H.length)return;const pc=M.plan?planCurve():[];
 {const [x,w,h]=cv('monDT');const t1=Math.max(M.t,...pc.map(p=>p[0]).slice(-1))*1.02,f=axes(x,w,h,'time (h)','MD m',0,t1,0,(M.plan?.td||1)*1.02,true);
  pc.length&&line(x,f,pc,'#7f8fa0',[5,4]);line(x,f,H.filter((_,i)=>i%3==0||i==H.length-1).map(p=>[p.t,p.md]),'#ffb347');for(const c of M.plan?.cas||[]){const [,y]=f(0,c.md);x.fillStyle='#6fd38a';x.fillText('▶ '+c.name,44,y-2)}}
 {const [x,w,h]=cv('monDP');const R=M.plan.rows,mx=Math.max(...R.map(vs))*1.1+10,mt=Math.max(...R.map(r=>r.tvd))*1.02,f=axes(x,w,h,'VS (m)','TVD m',0,mx,0,mt,true);
  line(x,f,R.map(r=>[vs(r),r.tvd]),'#7f8fa0',[5,4]);const S=M.surv;line(x,f,S.map(s=>[vs(s),s.tvd]),'#ffb347');const c=at(M.st.md);const [a,b]=f(vs(c),c.tvd);x.fillStyle='#ff5a5a';x.beginPath();x.arc(a,b,4,0,7);x.fill()}
 {const [x,w,h]=cv('monTr');const win=H.filter(p=>p.t>=M.t-12),t0=win[0]?.t||0;const tr=[['rop','ROP m/h','#ffb347',80],['wob','WOB t','#5fa8ff',40],['spp','SPP kPa/500','#c58cff',20000],['hook','Hook t/10','#6fd38a',1500]];
  const f=axes(x,w,h,'last 12 h','scaled',t0,Math.max(M.t,t0+0.1),0,100);tr.forEach(([k,l,c,mx],i)=>{line(x,f,win.filter(p=>Number.isFinite(p[k])).map(p=>[p.t,100*p[k]/mx]),c);x.fillStyle=c;x.fillText(l,44+i*70,h-24)})}}
// ---- UI ----
const CSS=`#mon{position:fixed;inset:0;z-index:99990;background:#08111b;color:#e6f0f8;font:13px system-ui,-apple-system,sans-serif;overflow:auto;-webkit-overflow-scrolling:touch;padding:calc(8px + env(safe-area-inset-top)) 10px calc(16px + env(safe-area-inset-bottom));box-sizing:border-box}
#mon h2{margin:0;font-size:18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}#mon .simb{background:#8a8f98;color:#fff;border-radius:6px;padding:1px 7px;font-size:12px;font-weight:800;letter-spacing:.08em}
#mon .wb{background:#2a5a8a;color:#fff;border-radius:6px;padding:1px 7px;font-size:12px;font-weight:800}
#mon .g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0}@media(min-width:820px){#mon .g{grid-template-columns:repeat(4,minmax(0,1fr))}#mon .pl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}}
#mon .k{background:#102031;border:1px solid #23405c;border-radius:10px;padding:8px}#mon .k small{display:block;opacity:.7;font-size:11px}#mon .k b{font-size:20px}
#mon .card{background:#0d1a28;border:1px solid #23405c;border-radius:10px;padding:8px;margin-bottom:8px}#mon canvas{width:100%;height:190px;display:block}
#mon table{width:100%;border-collapse:collapse;font-size:12px}#mon td,#mon th{padding:3px 4px;border-bottom:1px solid #1d3247;text-align:right}#mon th:first-child,#mon td:first-child{text-align:left}
#mon button{background:#163049;color:#dfeefa;border:1px solid #3a6a9a;border-radius:16px;padding:7px 12px;font:13px system-ui;min-height:36px}#mon .act{font-size:15px;font-weight:700;color:#ffd27a}`;
function shell(){const st=document.createElement('style');st.id='monCss';st.textContent=CSS;document.head.appendChild(st);const e=document.createElement('section');e.id='mon';e.setAttribute('role','dialog');e.setAttribute('aria-label','Monitor a well');
 e.innerHTML=`<h2>📈 Monitor <span id=monName></span> <span id=monBadge></span><span style="flex:1"></span><button id=monSpd title="SIM speed">⏩ ×120</button><button id=monX aria-label="Close monitor">✕</button></h2>
 <div id=monSrc style="font-size:12px;opacity:.8;margin-top:3px"></div><div class=card style="margin-top:8px"><small style="opacity:.7">Current activity / rig state</small><div id=monAct class=act>–</div><div id=monSec style="font-size:12px;margin-top:3px"></div></div>
 <div class=g><div class=k><small>Bit / hole depth MD</small><b id=monMD>–</b> m</div><div class=k><small>ROP</small><b id=monROP>–</b> m/h</div><div class=k><small>ETA to TD</small><b id=monETA>–</b></div><div class=k><small>vs plan</small><b id=monVs>–</b></div></div>
 <div class=pl><div class=card><b>Depth vs time</b> <small style="opacity:.7">orange actual · grey dashed plan</small><canvas id=monDT></canvas></div><div class=card><b>Depth vs plan</b> <small style="opacity:.7">section view, TVD vs VS</small><canvas id=monDP></canvas></div><div class=card><b>Key traces</b><canvas id=monTr></canvas></div></div>
 <div class=card><b>Latest surveys</b> <small style="opacity:.7">distance to plan (3D)</small><table id=monSv><thead><tr><th>MD m</th><th>Inc °</th><th>TVD m</th><th>Dist to plan m</th></tr></thead><tbody></tbody></table></div>`;
 document.body.appendChild(e);M.el=e;$('monX').onclick=close;$('monSpd').onclick=()=>{M.speed=M.speed==120?600:M.speed==600?30:120;$('monSpd').textContent='⏩ ×'+M.speed}}
function render(){if(!M.el)return;const sim=M.src=='SIM';$('monBadge').innerHTML=sim?'<span class=simb>SIM</span>':'<span class=wb>WITSML</span>';$('monSpd').style.display=sim?'':'none';
 if(!M.st){$('monAct').textContent='Waiting for data from the saved WITSML connection ('+(M.wstat||'not connected')+') — reconnect in the WITSML panel';return}
 const s=stats();$('monName').textContent=M.plan.name+(sim?' (SIM)':'');$('monAct').textContent=M.st.act;$('monSec').textContent='Hole section / casing: '+s.sec;
 $('monMD').textContent=fmt(M.st.md);$('monROP').textContent=fmt(M.st.rop,1);$('monETA').textContent=s.left<=0?'At TD':hm(s.eta);
 $('monVs').textContent=Number.isFinite(s.behind)?(Math.abs(s.behind)<0.5?'on plan':(s.behind>0?'+':'−')+hm(Math.abs(s.behind))+(s.behind>0?' behind':' ahead')):'–';
 $('monSv').tBodies[0].innerHTML=M.surv.slice(-6).reverse().map(v=>`<tr><td>${fmt(v.md)}</td><td>${fmt(v.inc,1)}</td><td>${fmt(v.tvd,1)}</td><td style="color:${v.dist>5?'#ff8a5a':'#8fe3a0'}">${fmt(v.dist,1)}</td></tr>`).join('')||'<tr><td colspan=4>no surveys yet</td></tr>';
 try{draw()}catch(e){console.error('monitor draw',e)}}
export function open(){window.GX=window.GX||{};GX.monitor=API;if(M.el)return API;const sv=saved();M.src=sv?'WITSML':'SIM';shell();
 if(sv){M.plan=loadPlan();M.st=null;$('monSrc').textContent=`Saved WITSML connection: ${sv.well||sv.log||'well'} — read-only, existing connection only. Plan overlay = SIM proposal A.`;
  // existing saved-connection behaviour only: open the WITSML panel so the user reconnects there (credentials are never stored).
  try{document.getElementById('wbtn')?.click()}catch{}}
 else{startSim();$('monSrc').textContent='No saved WITSML connection — SIM well (simulated data only). Time compressed ×'+M.speed+'.'}
 render();M.timer=setInterval(tick,1000);addEventListener('resize',render);API.M=M;return API}
export function close(){clearInterval(M.timer);removeEventListener('resize',render);M.el?.remove();$('monCss')?.remove();M.el=null}
const API={open,close,M,stats:()=>stats(),saved};window.GX=window.GX||{};GX.monitor=API;
