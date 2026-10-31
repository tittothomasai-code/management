// wplanac.js (feat/wellplan-ac): well-plan uncertainty, anti-collision vs EDM offsets, and cost/AFE. Extension tabs for wplan.js.
// Reuses wpg_core.js engines (ISCWSA covariance covISCWSA, sfScan, afe). No new engine. Everything here is SIM (EDM offsets are IMPORT).
// Sources: docs/wellplan-ac.md (ISCWSA OWSG MWD rev5, SPE-90408 Williamson 2000, SPE-194074 Sawaryn et al. 2019, IADC DDR / AFE practice).
import * as K from './wpg_core.js?v=g1';
const $=id=>document.getElementById(id),es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
export const OPT={k:3.5,Rr:0.108,Ro:0.108,Sm:0,alert:1.5,stop:1.0,step:30,head:{N:0,E:15},rig:52000,show3d:true,tag:'SIM'};
// --- stations every ~step m from wplan survey rows [{md,inc,azi,n,e,tvd}] (deg, m) ---
export function stations(rows,step=OPT.step){const out=[];let last=-1e9;for(const r of rows){if(r.md-last>=step-1e-6||r===rows.at(-1)){out.push({md:r.md,inc:r.inc,azi:r.azi,n:r.n,e:r.e,tvd:r.tvd});last=r.md}}return out}
// --- ISCWSA covariance per station + 1-sigma ellipse axes (horizontal NE and in the plane normal to the hole) ---
export function uncertainty(rows,o={}){const st=K.covISCWSA(stations(rows,o.step||OPT.step));return st.map(r=>{const [a,b,ang]=K.ellNE(r.C),t=K.vec(r.inc,r.azi),p=K.ellPerp(r.C,t);
 return {...r,ne:{a,b,ang},perp:{a:p[0],b:p[1],ang:p[2],u:p[3],v:p[4]},sigV:Math.sqrt(Math.max(0,r.C[2][2])),tag:'SIM'}})}
// ellipse polyline (N,E) for k sigma
export function ellPts(e,k=1,n=36){const out=[];for(let i=0;i<=n;i++){const t=i/n*2*Math.PI,x=k*e.a*Math.cos(t),y=k*e.b*Math.sin(t),c=Math.cos(e.ang),s=Math.sin(e.ang);out.push([x*c-y*s,x*s+y*c])}return out}
// --- offsets via GX.edm API only (no raw file reads). Shifted so the plan wellhead is the origin. ---
export function edmOffsets(head=OPT.head){const A=globalThis.GX?.edm?.ST?.R?.A;if(!A?.wbs?.length)return [];
 return A.wbs.map(w=>({name:w.name,src:'IMPORT',kind:w.kind,st:K.covISCWSA(K.fromPath(w.pts,{N:head.N,E:head.E}))})).filter(o=>o.st.length>1)}
// --- Separation factor (ISCWSA CA WG, Sawaryn et al. 2019): SF=(D_ctc - (Rr+Ro) - Sm)/(k * sigma_s), sigma_s along the centre-to-centre line ---
export function sfOne(D,sig,o=OPT){return sig>1e-9?(D-o.Rr-o.Ro-(o.Sm||0))/(o.k*sig):99}
export const light=(sf,o=OPT)=>sf<o.stop?'red':sf<o.alert?'amber':'green';
export function antiCollision(ref,offs,o=OPT){return offs.map(f=>{const S=K.sfScan(ref,f.st,{...K.SFOPT,...o}),m=S.reduce((a,b)=>b.sf<a.sf?b:a,S[0]),c=S.reduce((a,b)=>b.ctc<a.ctc?b:a,S[0]);
 return {name:f.name,src:f.src,scan:S,minSF:m.sf,minSFmd:m.md,minCtc:c.ctc,minCtcMd:c.md,ellSum:o.k*m.sig,light:light(m.sf,o)}})}
// --- AFE from the plan: sections between casing points, rig rate + consumables. Uses wpg_core.afe (P10/P50/P90). ---
const HOLE={'20':26,'13-3/8':17.5,'9-5/8':12.25,'7':8.5,'4-1/2':6};
export function sectionsFromPlan(W){const CS=W.CS||[];let top=0;const td=W.L?.td??W.S.rows.at(-1).md,out=[];
 const pts=CS.length?CS:[{name:'TD',md:td}];for(const c of pts){const m=/(\d+(?:-\d+\/\d+)?)"/.exec(c.name),csg=m?m[1]:'7',len=Math.max(1,c.md-top),r=W.S.rows.filter(x=>x.md>top&&x.md<=c.md),maxInc=Math.max(0,...r.map(x=>x.inc));
  out.push({name:c.name,mdTop:top,mdBot:c.md,len,csg,holeIn:HOLE[csg]||8.5,rop:csg=='13-3/8'?30:csg=='9-5/8'?20:12,bitLife:csg=='13-3/8'?900:600,bitType:'PDC',dir:maxInc>5,log:csg!='13-3/8'});top=c.md}return out}
export function sharedRates(){return globalThis.GX?.wpg?.G?.rates||null}
export function afePlan(W,o={}){const sr=o.rates||sharedRates()||{},R={...K.RATES,...sr,spread:o.rig??sr.spread??OPT.rig},secs=sectionsFromPlan(W),A=K.afe(secs,{R,n:o.n||300,seed:o.seed||7});
 const cons=A.rows.map(s=>{const hv=Math.PI/4*(s.holeIn*0.0254)**2*s.len;return {name:s.name,mudM3:hv*1.8,cemM3:hv*0.5,bits:s.bits,casingM:s.mdBot}});
 return {...A,rig:R.spread,cons,tag:'SIM'}}
// ---------------- UI ----------------
let W0=null,G3=null;const S={unc:null,ac:null,afe:null};
const tag='<span class=wpS>SIM</span>',itag='<span class=wpS style="background:#7a4ad0">IMPORT</span>';
const COL={red:'#ff5a5a',amber:'#ffb020',green:'#3ddc84'};
function recalc(W){S.unc=uncertainty(W.S.rows);S.offs=edmOffsets(OPT.head);S.ac=antiCollision(S.unc,S.offs)}
function planCanvas(cv,W){const c=cv.getContext('2d'),w=cv.width=cv.clientWidth*devicePixelRatio,h=cv.height=cv.clientHeight*devicePixelRatio;c.fillStyle='#06101a';c.fillRect(0,0,w,h);
 const all=[...W.S.rows.map(r=>[r.n,r.e]),...(S.offs||[]).flatMap(o=>o.st.map(r=>[r.n,r.e]))];let n0=Math.min(...all.map(p=>p[0])),n1=Math.max(...all.map(p=>p[0])),e0=Math.min(...all.map(p=>p[1])),e1=Math.max(...all.map(p=>p[1]));
 const sp=Math.max(n1-n0,e1-e0,50)*1.15,cn=(n0+n1)/2,ce=(e0+e1)/2,sc=Math.min(w,h)/sp,X=e=>w/2+(e-ce)*sc,Y=n=>h/2-(n-cn)*sc;
 c.lineWidth=1.5*devicePixelRatio;for(const o of S.offs||[]){const a=(S.ac||[]).find(x=>x.name==o.name);c.strokeStyle=COL[a?.light||'green'];c.beginPath();o.st.forEach((r,i)=>c[i?'lineTo':'moveTo'](X(r.e),Y(r.n)));c.stroke();c.fillStyle='#cfd8e3';c.font=`${11*devicePixelRatio}px system-ui`;c.fillText(o.name,X(o.st.at(-1).e)+4,Y(o.st.at(-1).n))}
 c.strokeStyle='#4fc3ff';c.beginPath();W.S.rows.forEach((r,i)=>c[i?'lineTo':'moveTo'](X(r.e),Y(r.n)));c.stroke();
 const ex=Math.max(1,(S.ex||1));for(const r of S.unc.filter((_,i)=>i%3==0)){for(const [k,col] of [[1,'#9be7ff'],[2,'#ffd27a']]){c.strokeStyle=col;c.lineWidth=devicePixelRatio;c.beginPath();ellPts(r.ne,k*ex).forEach(([dn,de],i)=>c[i?'lineTo':'moveTo'](X(r.e+de),Y(r.n+dn)));c.stroke()}}
 c.fillStyle='#9ab';c.font=`${10*devicePixelRatio}px system-ui`;c.fillText(`Plan view · ellipses 1σ (blue) 2σ (yellow) ×${ex} · SIM`,6,h-6)}
function on3d(T){if(!OPT.show3d||!S.unc)return;const {THREE,sc,P}=T;const g=new THREE.Group();g.name='wpacEll';
 for(const r of S.unc.filter((_,i)=>i%2==0)){const e=r.perp;for(const [k,col] of [[1,0x9be7ff],[2,0xffd27a]]){const pts=[];for(let i=0;i<=32;i++){const t=i/32*2*Math.PI,x=k*e.a*Math.cos(t),y=k*e.b*Math.sin(t),c=Math.cos(e.ang),s=Math.sin(e.ang),a=x*c-y*s,b=x*s+y*c;
  pts.push(P({n:r.n+a*e.u[0]+b*e.v[0],e:r.e+a*e.u[1]+b*e.v[1],tvd:r.tvd+a*e.u[2]+b*e.v[2]}))}g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:col,transparent:true,opacity:k==1?0.9:0.6})))}}
 for(const o of S.offs||[]){const a=(S.ac||[]).find(x=>x.name==o.name),col=a?.light=='red'?0xff5a5a:a?.light=='amber'?0xffb020:0x3ddc84;g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(o.st.map(P)),new THREE.LineBasicMaterial({color:col})))}
 sc.add(g);G3=g}
function head(){return `<div style="font-size:11px;opacity:.8;margin:4px 0">Plan wellhead on the EDM site grid: N <input id=acN type=number value=${OPT.head.N} style="width:70px"> E <input id=acE type=number value=${OPT.head.E} style="width:70px"> m · k <input id=acK type=number step=0.1 value=${OPT.k} style="width:56px"> <button id=acGo>Apply</button></div>`}
function bindHead(B,W,fn){$('acGo').onclick=()=>{OPT.head={N:+$('acN').value||0,E:+$('acE').value||0};OPT.k=+$('acK').value||3.5;recalc(W);fn(B)}}
function tabEll(B){const W=W0();recalc(W);const L=S.unc.at(-1);B.innerHTML=`<div style="margin:4px 0"><b>Position uncertainty</b> ${tag} · ISCWSA error model, OWSG MWD rev5 terms</div>
 <div style="font-size:12px">At TD ${L.md.toFixed(0)} m MD: 1σ horizontal ${L.ne.a.toFixed(1)} × ${L.ne.b.toFixed(1)} m · 2σ ${(2*L.ne.a).toFixed(1)} × ${(2*L.ne.b).toFixed(1)} m · 1σ vertical ${L.sigV.toFixed(1)} m</div>
 <label style="font-size:12px"><input type=checkbox id=ac3d ${OPT.show3d?'checked':''}> Show ellipses in 3D (Trajectory tab)</label> <label style="font-size:12px">Scale ×<select id=acEx>${[1,5,10,20].map(v=>`<option ${S.ex==v?'selected':''}>${v}</option>`).join('')}</select></label>
 <canvas id=acPlan style="width:100%;height:min(40vh,320px);display:block;border-radius:8px"></canvas>
 <div style="overflow:auto;max-height:26vh"><table class=wpT style="font-size:11px" id=acEllT><tr><th>MD</th><th>TVD</th><th>1σ a</th><th>1σ b</th><th>2σ a</th><th>2σ b</th><th>1σ V</th></tr>${S.unc.filter((_,i)=>i%3==0||i==S.unc.length-1).map(r=>`<tr><td>${r.md.toFixed(0)}</td><td>${r.tvd.toFixed(0)}</td><td>${r.ne.a.toFixed(2)}</td><td>${r.ne.b.toFixed(2)}</td><td>${(2*r.ne.a).toFixed(2)}</td><td>${(2*r.ne.b).toFixed(2)}</td><td>${r.sigV.toFixed(2)}</td></tr>`).join('')}</table></div>`;
 $('ac3d').onchange=e=>{OPT.show3d=e.target.checked};$('acEx').onchange=e=>{S.ex=+e.target.value;planCanvas($('acPlan'),W)};planCanvas($('acPlan'),W)}
function tabAC(B){const W=W0();recalc(W);const has=S.offs.length;B.innerHTML=`<div style="margin:4px 0"><b>Anti-collision vs EDM offsets</b> ${tag} ${has?itag:''}</div>${head()}
 ${has?'':`<div style="color:#ffc04d;margin:6px 0">No EDM site is open. Open “Import EDM” and load a site file, then come back to this tab. <button id=acEdm>Import EDM</button></div>`}
 <div style="font-size:11px;opacity:.8">SF = (centre-to-centre − (Rr + Ro)) ÷ (k × σ). Red SF &lt; ${OPT.stop}, amber ${OPT.stop}–${OPT.alert}, green ≥ ${OPT.alert}. Rr = Ro = ${OPT.Rr} m, k = ${OPT.k}.</div>
 <table class=wpT style="font-size:12px;width:100%" id=acTbl><tr><th style="text-align:left">Offset</th><th>Min SF</th><th>@ MD</th><th>Min C-C m</th><th>@ MD</th><th>k·σ m</th><th></th></tr>
 ${S.ac.map(a=>`<tr data-light=${a.light}><td style="text-align:left">${es(a.name)}</td><td style="color:${COL[a.light]};font-weight:700">${a.minSF>=99?'>99':a.minSF.toFixed(2)}</td><td>${a.minSFmd.toFixed(0)}</td><td>${a.minCtc.toFixed(1)}</td><td>${a.minCtcMd.toFixed(0)}</td><td>${a.ellSum.toFixed(1)}</td><td><span style="display:inline-block;width:14px;height:14px;border-radius:7px;background:${COL[a.light]}"></span></td></tr>`).join('')}</table>
 <canvas id=acPlan style="width:100%;height:min(36vh,300px);display:block;border-radius:8px;margin-top:6px"></canvas>`;
 bindHead(B,W,tabAC);$('acEdm')?.addEventListener('click',()=>globalThis.GX?.edm?.open?.());planCanvas($('acPlan'),W)}
const usd=v=>'$'+(v/1e6).toFixed(2)+' M';
function tabAFE(B){const W=W0();S.afe=afePlan(W,sharedRates()?{}:{rig:OPT.rig});const A=S.afe;B.innerHTML=`<div style="margin:4px 0"><b>Cost and time (AFE)</b> ${tag} · all values are estimates for training</div><div id=afeNote style="font-size:11px;color:#9ab">Uses the same rates as the AFE tab. The AFE tab also adds risk lines, so its P50 is higher.</div>
 <div style="font-size:12px">Rig spread rate <input id=afeRig type=number value=${A.rig} style="width:90px"> USD/day <button id=afeGo>Apply</button></div>
 <table class=wpT style="font-size:12px;width:100%" id=afeTbl><tr><th style="text-align:left">Section</th><th>Hole in</th><th>Length m</th><th>Days</th><th>Bits</th><th>Mud m³</th><th>Cement m³</th><th>Cost</th></tr>
 ${A.rows.map((s,i)=>`<tr><td style="text-align:left">${es(s.name)}</td><td>${s.holeIn}</td><td>${s.len.toFixed(0)}</td><td>${s.days.toFixed(1)}</td><td>${s.bits}</td><td>${A.cons[i].mudM3.toFixed(0)}</td><td>${A.cons[i].cemM3.toFixed(0)}</td><td>${usd(s.cost)}</td></tr>`).join('')}
 <tr style="font-weight:700"><td style="text-align:left">Total (with mob + wellhead)</td><td></td><td></td><td id=afeDays>${A.days.toFixed(1)}</td><td></td><td></td><td></td><td id=afeCost>${usd(A.cost)}</td></tr></table>
 <div style="font-size:12px;margin:4px 0">P10 / P50 / P90: ${A.P10.days.toFixed(1)} / ${A.P50.days.toFixed(1)} / ${A.P90.days.toFixed(1)} days · ${usd(A.P10.cost)} / ${usd(A.P50.cost)} / ${usd(A.P90.cost)} ${tag}</div>
 <canvas id=afeDvd style="width:100%;height:min(34vh,260px);display:block;border-radius:8px"></canvas>`;
 $('afeGo').onclick=()=>{OPT.rig=+$('afeRig').value||52000;const r=sharedRates();if(r)r.spread=OPT.rig;tabAFE(B)};dvd($('afeDvd'),A)}
function dvd(cv,A){const c=cv.getContext('2d'),w=cv.width=cv.clientWidth*devicePixelRatio,h=cv.height=cv.clientHeight*devicePixelRatio,d=devicePixelRatio;c.fillStyle='#06101a';c.fillRect(0,0,w,h);
 const T=A.tdT,dm=Math.max(...T.map(x=>x[1]))*1.1,mm=Math.max(...T.map(x=>x[0]))*1.05,L=40*d,X=v=>L+v/dm*(w-L-10*d),Y=v=>12*d+v/mm*(h-30*d);
 c.strokeStyle='#2a4060';c.font=`${10*d}px system-ui`;c.fillStyle='#9ab';for(let i=0;i<=4;i++){const y=Y(mm*i/4);c.beginPath();c.moveTo(L,y);c.lineTo(w,y);c.stroke();c.fillText((mm*i/4).toFixed(0),2,y+3*d)}
 c.strokeStyle='#4fc3ff';c.lineWidth=2*d;c.beginPath();T.forEach(([m,t],i)=>c[i?'lineTo':'moveTo'](X(t),Y(m)));c.stroke();c.fillText('Days vs depth (m MD) · SIM',L+4*d,h-4*d)}
export function register(W){W0=()=>W;W.tabs.push(['acell','Error ellipses'],['acedm','AC vs EDM'],['afe','AFE by section']);W.ext.acell=tabEll;W.ext.acedm=tabAC;W.ext.afe=tabAFE;
 W.on3d.push(T=>{if(!S.unc)recalc(W);on3d(T)});globalThis.GX=globalThis.GX||{};import('./wplanpol.js?v=b11').then(m=>m.register(W)).catch(e=>console.error('wplanpol',e));GX.wplanac={OPT,sharedRates,S,uncertainty,edmOffsets,antiCollision,afePlan,sfOne,light,recalc:()=>recalc(W)}}
