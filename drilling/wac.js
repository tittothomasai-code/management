// wac.js v5.8 (W2): ANTI-COLLISION concept for the well planner. Written fresh for this game; concept only, not a certified AC tool.
// Offsets (CSV / EDM XML) -> IndexedDB 'dw_wplan'.offsets. Simplified ISCWSA-style MWD error model (systematic terms: inclination,
// azimuth, depth scale, depth reference). Closest approach, traveling cylinder, separation factor (SF) with alert/stop, ladder, TC,
// min-SF report, beam of light ahead of the bit. Metric. Everything assumed is tagged SIM. No network calls.
import * as WP from './wplan.js?v=b11';
const D2R=Math.PI/180,R2D=180/Math.PI,$=id=>document.getElementById(id),es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],len=a=>Math.hypot(...a),sc=(a,k)=>a.map(x=>x*k),nrm=a=>{const l=len(a);return l?sc(a,1/l):a};
export const EM_LABEL='Error model: concept only, not certified (simplified ISCWSA-style)';
const emL=()=>`<div class=emLabel style="margin:4px 0;padding:4px 6px;border:1px solid #f5a623;border-radius:4px;background:#3a2a00;color:#ffd27a;font-size:12px;font-weight:600">⚠ ${EM_LABEL}</div>`;
export const MODEL={name:'MWD, ISCWSA-style (simplified)',sInc:0.1,sAzi:0.5,dsf:5.6e-4,dref:0.35,k:3,hole:0.108,alert:1.5,stop:1.0,tc:100,beam:{len:90,half:2},tag:'SIM'};
// ---- geometry ----
export function densify(rows,step=10){const out=[];for(let i=0;i<rows.length;i++){const r=rows[i];if(i){const q=rows[i-1],dm=r.md-q.md,n=Math.max(1,Math.ceil(dm/step)),t1=WP.vec(q.inc,q.azi),t2=WP.vec(r.inc,r.azi),b=Math.acos(Math.max(-1,Math.min(1,dot(t1,t2))));
  for(let k=1;k<n;k++){const f=k/n;let t;if(b<1e-9)t=t1;else{const a=Math.sin((1-f)*b)/Math.sin(b),c=Math.sin(f*b)/Math.sin(b);t=nrm([a*t1[0]+c*t2[0],a*t1[1]+c*t2[1],a*t1[2]+c*t2[2]])}const [inc,azi]=WP.incAzi(t);out.push({md:q.md+f*dm,inc,azi})}}out.push({md:r.md,inc:r.inc,azi:r.azi})}return out}
export function positions(head,rows){let p=[head.n||0,head.e||0,head.tvd0||0];return rows.map((r,i)=>{if(i){const q=rows[i-1],d=WP.minCurv(q.md,q.inc,q.azi,r.md,r.inc,r.azi);p=[p[0]+d[0],p[1]+d[1],p[2]+d[2]]}return {...r,n:p[0],e:p[1],tvd:p[2],p:p.slice(),t:WP.vec(r.inc,r.azi)}})}
// systematic error vectors summed along the well; covariance = sum e e^T. Returns pts with .C (3x3, NEV)
export function covariance(pts,M=MODEL){const si=M.sInc*D2R,sa=M.sAzi*D2R;let eI=[0,0,0],eIN=[0,0,0],eIE=[0,0,0],eA=[0,0,0];const p0=pts[0].p;
 return pts.map((r,i)=>{if(i){const q=pts[i-1],dm=r.md-q.md,t=nrm([q.t[0]+r.t[0],q.t[1]+r.t[1],q.t[2]+r.t[2]]),[I,A]=WP.incAzi(t).map(x=>x*D2R);
   if(I<1*D2R){eIN=[eIN[0]+dm*si,0,0];eIE=[0,eIE[1]+dm*si,0]} // near-vertical: inclination error has no defined direction -> isotropic horizontal
   else{const hs=[Math.cos(I)*Math.cos(A),Math.cos(I)*Math.sin(A),-Math.sin(I)];eI=eI.map((x,j)=>x+dm*si*hs[j])}
   const az=[-Math.sin(I)*Math.sin(A),Math.sin(I)*Math.cos(A),0];eA=eA.map((x,j)=>x+dm*sa*az[j])}
  const eD=sc(sub(r.p,p0),M.dsf),eR=sc(r.t,M.dref),T=[eI,eIN,eIE,eA,eD,eR],C=[[0,0,0],[0,0,0],[0,0,0]];for(const e of T)for(let a=0;a<3;a++)for(let b=0;b<3;b++)C[a][b]+=e[a]*e[b];return {...r,C}})}
export const sigmaAlong=(C,u)=>Math.sqrt(Math.max(0,u.reduce((s,ua,a)=>s+ua*(C[a][0]*u[0]+C[a][1]*u[1]+C[a][2]*u[2]),0)));
// ellipse in the plane normal to t: returns [semiA, semiB, axisA(3), axisB(3)] (1 sigma)
export function ellipse(C,t){const hs=Math.abs(t[2])>0.9999?[1,0,0]:nrm([t[2]*t[0],t[2]*t[1],-(t[0]*t[0]+t[1]*t[1])]).map(x=>-x),rt=nrm([t[1]*hs[2]-t[2]*hs[1],t[2]*hs[0]-t[0]*hs[2],t[0]*hs[1]-t[1]*hs[0]]);
 const q=(u,v)=>u.reduce((s,ua,a)=>s+ua*(C[a][0]*v[0]+C[a][1]*v[1]+C[a][2]*v[2]),0),a=q(hs,hs),b=q(rt,rt),c=q(hs,rt),tr=(a+b)/2,d=Math.sqrt(Math.max(0,((a-b)/2)**2+c*c)),l1=tr+d,l2=Math.max(0,tr-d),th=0.5*Math.atan2(2*c,a-b);
 const u1=[0,1,2].map(j=>Math.cos(th)*hs[j]+Math.sin(th)*rt[j]),u2=[0,1,2].map(j=>-Math.sin(th)*hs[j]+Math.cos(th)*rt[j]);return [Math.sqrt(l1),Math.sqrt(l2),u1,u2,hs,rt]}
export function well(name,head,rows,tag='SIM',M=MODEL){const dense=densify(rows.slice().sort((a,b)=>a.md-b.md),10);return {name,head,rows,tag,pts:covariance(positions(head,dense),M)}}
export function planWell(L,M=MODEL){const S=WP.survey(L,10);return {name:L.P.name,head:{n:0,e:0},tag:L.P.tag||'SIM',pts:covariance(S.rows.map(r=>({...r,p:[r.n,r.e,r.tvd],t:WP.vec(r.inc,r.azi)})),M)}}
// ---- closest approach / SF / TC ----
export function scan(ref,off,M=MODEL){const O=off.pts;return ref.pts.map(r=>{let bi=0,bd=1e18;for(let j=0;j<O.length;j++){const d=sub(O[j].p,r.p),q=d[0]*d[0]+d[1]*d[1]+d[2]*d[2];if(q<bd){bd=q;bi=j}}
  // refine on the two neighbouring chords
  let best={p:O[bi].p,j:bi,f:0,dist:Math.sqrt(bd)};for(const j of [bi-1,bi]){if(j<0||j+1>=O.length)continue;const a=O[j].p,b=O[j+1].p,ab=sub(b,a),f=Math.max(0,Math.min(1,dot(sub(r.p,a),ab)/dot(ab,ab)||0)),p=[0,1,2].map(k=>a[k]+f*ab[k]),d=len(sub(p,r.p));if(d<best.dist)best={p,j,f,dist:d}}
  const o=O[best.j],o2=O[Math.min(best.j+1,O.length-1)],Co=o.C.map((row,a)=>row.map((x,b)=>x+(o2.C[a][b]-x)*best.f)),v=sub(best.p,r.p),D=best.dist,u=D>1e-9?sc(v,1/D):[1,0,0];
  const ss=Math.sqrt(sigmaAlong(r.C,u)**2+sigmaAlong(Co,u)**2),sf=ss>1e-9?(D-2*M.hole)/(M.k*ss):99;
  const ref3=r.inc>=3,hs=ref3?[Math.cos(r.inc*D2R)*Math.cos(r.azi*D2R),Math.cos(r.inc*D2R)*Math.sin(r.azi*D2R),-Math.sin(r.inc*D2R)]:[1,0,0],rt=ref3?[-Math.sin(r.azi*D2R),Math.cos(r.azi*D2R),0]:[0,1,0];
  let ang=Math.atan2(dot(u,rt),dot(u,hs))*R2D;ang=(ang+360)%360;const st=sf<M.stop?'STOP':sf<M.alert?'ALERT':'OK';
  return {md:r.md,tvd:r.tvd,dist:D,sf:Math.min(sf,99),sig:ss,offMd:o.md+(o2.md-o.md)*best.f,tcAng:ang,tcRef:ref3?'HS':'N',status:st,ref:r.p,off:best.p}})}
export function report(ref,offs,M=MODEL){return offs.map(o=>summarize(o,scan(ref,o,M),M))}
export function summarize(o,S,M=MODEL){{const m=S.reduce((a,b)=>b.sf<a.sf?b:a,S[0]),c=S.reduce((a,b)=>b.dist<a.dist?b:a,S[0]);
 return {name:o.name,tag:o.tag,minSF:m.sf,mdAtMin:m.md,distAtMin:m.dist,offMdAtMin:m.offMd,minDist:c.dist,mdAtMinDist:c.md,firstAlert:S.find(x=>x.sf<M.alert)?.md??null,firstStop:S.find(x=>x.sf<M.stop)?.md??null,status:m.status,scan:S}}}
// beam of light: cone ahead of the bit along its tangent; base radius = k * lateral sigma at the bit
export function beam(ref,offs,bitMd,M=MODEL){const r=ref.pts.reduce((a,b)=>Math.abs(b.md-bitMd)<Math.abs(a.md-bitMd)?b:a,ref.pts[0]),[A,B]=ellipse(r.C,r.t),r0=M.k*Math.max(A,B),th=M.beam.half*D2R,L=M.beam.len;
 const [, , , ,hs,rt]=ellipse(r.C,r.t),hits=[];for(const o of offs){let best=null;for(const q of o.pts){const v=sub(q.p,r.p),a=dot(v,r.t);if(a<=0||a>L)continue;const pr=sub(v,sc(r.t,a)),rp=len(pr),cone=r0+a*Math.tan(th),clr=rp-cone-2*M.hole;
   const h={off:o.name,ahead:a,radial:rp,cone,clear:clr,x:dot(pr,rt),y:dot(pr,hs),inside:clr<=0,offMd:q.md};if(!best||clr<best.clear)best=h}if(best)hits.push(best)}
 return {bit:r,r0,L,half:M.beam.half,hs,rt,hits,pts:offs.flatMap(o=>o.pts.map(q=>{const v=sub(q.p,r.p),a=dot(v,r.t);if(a<=0||a>L)return null;const pr=sub(v,sc(r.t,a));return {off:o.name,a,x:dot(pr,rt),y:dot(pr,hs)}}).filter(Boolean))}}
// ---- import ----
export function parseCSV(text,fallbackName='Offset'){const wells={};let head={n:0,e:0},name=fallbackName;const lines=text.split(/\r?\n/);let cols=null;
 for(const raw of lines){const l=raw.trim();if(!l)continue;let m=l.match(/^#\s*well\s*[:=]\s*(.+)$/i);if(m){name=m[1].trim();continue}m=l.match(/^#\s*wellhead\s*[:=]?\s*N\s*=?\s*(-?[\d.]+)\s*,?\s*E\s*=?\s*(-?[\d.]+)/i);if(m){head={n:+m[1],e:+m[2]};continue}if(l.startsWith('#'))continue;
  const f=l.split(/[,;\t]/).map(x=>x.trim());if(!cols&&f.some(x=>/md|inc|azi/i.test(x))){cols=f.map(x=>x.toLowerCase());continue}
  const g=k=>{const i=cols?cols.findIndex(c=>c.startsWith(k)):({md:0,inc:1,azi:2})[k];return i>=0?+f[i]:NaN},wn=cols&&cols.indexOf('well')>=0?f[cols.indexOf('well')]:name,hn=cols?cols.findIndex(c=>c=='head_n'):-1,he=cols?cols.findIndex(c=>c=='head_e'):-1;
  const md=g('md'),inc=g('inc'),azi=g('azi');if(![md,inc,azi].every(Number.isFinite))continue;(wells[wn]??={name:wn,head:hn>=0?{n:+f[hn],e:+f[he]}:head,rows:[]}).rows.push({md,inc,azi});if(hn<0)wells[wn].head=head}
 return Object.values(wells).filter(w=>w.rows.length>1)}
// EDM (Landmark Engineer's Data Model XML export). Concept parser: CD_WELL / CD_WELLBORE give the name and wellhead offsets; CD_DEFINITIVE_SURVEY_STATION (or CD_SURVEY_STATION) rows give md / inclination / azimuth.
export function parseEDM(xml){const attrs=s=>{const o={};for(const m of s.matchAll(/(\w+)\s*=\s*"([^"]*)"/g))o[m[1].toLowerCase()]=m[2];return o};const wells={},names={},heads={};
 for(const m of xml.matchAll(/<CD_WELL\b([^>]*)\/?>/gi)){const a=attrs(m[1]);if(a.well_id){names[a.well_id]=a.well_common_name||a.well_legal_name||a.well_id;heads[a.well_id]={n:+(a.offset_north??a.loc_north??0)||0,e:+(a.offset_east??a.loc_east??0)||0}}}
 const wbWell={};for(const m of xml.matchAll(/<CD_WELLBORE\b([^>]*)\/?>/gi)){const a=attrs(m[1]);if(a.wellbore_id)wbWell[a.wellbore_id]={well:a.well_id,name:a.wellbore_name}}
 for(const m of xml.matchAll(/<CD_(?:DEFINITIVE_)?SURVEY_STATION\b([^>]*)\/?>/gi)){const a=attrs(m[1]),md=+a.md,inc=+a.inclination,azi=+a.azimuth;if(![md,inc,azi].every(Number.isFinite))continue;const wb=a.wellbore_id||a.well_id||'EDM',w=wbWell[wb]?.well||a.well_id||wb;
  (wells[wb]??={name:(names[w]||w)+(wbWell[wb]?.name?' / '+wbWell[wb].name:''),head:heads[w]||{n:0,e:0},rows:[]}).rows.push({md,inc,azi})}
 return Object.values(wells).filter(w=>w.rows.length>1)}
// SIM offsets placed around the default proposal (assumed data)
const traj=(kop,dls,inc,azi,td)=>{const r=[{md:0,inc:0,azi}];if(kop)r.push({md:kop,inc:0,azi});let md=kop,i=0;while(i<inc){md+=30;i=Math.min(inc,i+dls);r.push({md,inc:i,azi})}r.push({md:td,inc,azi});return r};
export const SIM_OFFSETS=[{name:'SIM Offset-1 (slot 10 m, vertical)',head:{n:8,e:-6},rows:traj(0,0,0,0,1800),tag:'SIM'},
 {name:'SIM Offset-2 (deviated NE)',head:{n:40,e:60},rows:traj(450,2.5,38,40,2600),tag:'SIM'},
 {name:'SIM Offset-3 (crossing, W)',head:{n:750,e:1200},rows:traj(300,3,55,250,2000),tag:'SIM'}];
// ---- state + UI ----
const A={offs:null,M:{...MODEL,beam:{...MODEL.beam}},bitMd:null};
async function loadOffs(){if(A.offs)return A.offs;let a=[];try{a=await WP.dbAll('offsets')}catch{}if(!a.length){a=SIM_OFFSETS.map(x=>({...x}));for(const o of a)try{await WP.dbPut('offsets',o)}catch{}}A.offs=a;return a}
// v5.9.2: chunked, cancellable compute with progress (was one blocking call for several seconds); cached until plan/offsets/model change
const tick=()=>new Promise(r=>setTimeout(r,0));let JOB=0,KEY=null;
export async function computeAsync(W,prog=()=>{}){const key=JSON.stringify([W.L?.td,W.S?.rows?.length,W.S?.rows?.at(-1),A.M,A.offs.map(o=>[o.name,o.rows?.length])]);if(KEY==key&&A.rep){A.beam=beam(A.ref,A.wells,A.bitMd,A.M);return A}const job=++JOB;
 prog(0,'Reference well');await tick();const ref=planWell(W.L,A.M),offs=[],rep=[],n=A.offs.length,CH=150;
 for(let i=0;i<n;i++){const o=A.offs[i];const w=well(o.name,o.head,o.rows,o.tag,A.M);offs.push(w);const S=[];
  for(let a=0;a<ref.pts.length;a+=CH){S.push(...scan({...ref,pts:ref.pts.slice(a,a+CH)},w,A.M));prog((i+Math.min(a+CH,ref.pts.length)/ref.pts.length)/n,o.name);await tick();if(job!=JOB)return null}
  rep.push(summarize(w,S,A.M))}
 if(A.bitMd==null)A.bitMd=Math.round(W.L.td*0.45/10)*10;A.ref=ref;A.wells=offs;A.rep=rep;A.beam=beam(ref,offs,A.bitMd,A.M);KEY=key;prog(1,'done');return A}
function compute(W){const ref=planWell(W.L,A.M),offs=A.offs.map(o=>well(o.name,o.head,o.rows,o.tag,A.M)),rep=report(ref,offs,A.M);if(A.bitMd==null)A.bitMd=Math.round(W.L.td*0.45/10)*10;A.ref=ref;A.wells=offs;A.rep=rep;A.beam=beam(ref,offs,A.bitMd,A.M);return A}
const COL=['#ff9f43','#c56cf0','#2ecc71','#ff6b81','#48dbfb','#feca57'],tagB=t=>`<span class=wpS style="background:${t=='SIM'?'#8a8f98':'#3d6e9e'}">${es(t)}</span>`;
const stC=s=>s=='STOP'?'#ff5252':s=='ALERT'?'#ffb142':'#2ecc71';
function cvs(id,h=180){return `<canvas id=${id} style="width:100%;height:${h}px;background:#08101c;border-radius:8px;display:block;margin:4px 0"></canvas>`}
function ctx(id){const c=$(id),r=c.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);c.width=r.width*d;c.height=r.height*d;const g=c.getContext('2d');g.scale(d,d);g.font='10px system-ui';return [g,r.width,r.height]}
function ladder(){const [g,w,h]=ctx('acLad'),R=A.rep,md=W0().L.td,maxD=Math.min(A.M.tc*2,Math.max(10,...R.flatMap(o=>o.scan.map(s=>s.dist)).filter(x=>x<A.M.tc*2))),X=m=>36+(w-44)*m/md,Y=d=>8+(h-26)*(1-Math.min(d,maxD)/maxD);
 g.strokeStyle='#223';g.fillStyle='#8fb4d8';for(let i=0;i<=4;i++){const d=maxD*i/4;g.beginPath();g.moveTo(36,Y(d));g.lineTo(w-8,Y(d));g.stroke();g.fillText(d.toFixed(0),4,Y(d)+3)}g.fillText('centre-to-centre (m) vs plan MD (m) 0–'+md.toFixed(0),40,h-4);
 R.forEach((o,i)=>{g.strokeStyle=COL[i%COL.length];g.lineWidth=2;g.beginPath();o.scan.forEach((s,k)=>k?g.lineTo(X(s.md),Y(s.dist)):g.moveTo(X(s.md),Y(s.dist)));g.stroke();
  g.fillStyle=COL[i%COL.length];g.globalAlpha=.25;g.beginPath();o.scan.forEach((s,k)=>{const y=Y(Math.max(0,s.dist-A.M.k*s.sig));k?g.lineTo(X(s.md),y):g.moveTo(X(s.md),y)});for(let k=o.scan.length-1;k>=0;k--){const s=o.scan[k];g.lineTo(X(s.md),Y(s.dist))}g.fill();g.globalAlpha=1});}
function sfPlot(){const [g,w,h]=ctx('acSF'),R=A.rep,md=W0().L.td,mx=Math.max(5,A.M.alert*3),X=m=>36+(w-44)*m/md,Y=v=>8+(h-26)*(1-Math.min(v,mx)/mx);
 g.fillStyle='#8fb4d8';for(const [v,c,l] of [[A.M.stop,'#ff5252','STOP'],[A.M.alert,'#ffb142','ALERT']]){g.strokeStyle=c;g.setLineDash([5,4]);g.beginPath();g.moveTo(36,Y(v));g.lineTo(w-8,Y(v));g.stroke();g.setLineDash([]);g.fillStyle=c;g.fillText(l+' '+v,w-60,Y(v)-3)}
 g.fillStyle='#8fb4d8';for(let i=0;i<=mx;i++)g.fillText(i,22,Y(i)+3);g.fillText('separation factor vs plan MD (capped at '+mx+')',40,h-4);
 R.forEach((o,i)=>{g.strokeStyle=COL[i%COL.length];g.lineWidth=2;g.beginPath();o.scan.forEach((s,k)=>k?g.lineTo(X(s.md),Y(s.sf)):g.moveTo(X(s.md),Y(s.sf)));g.stroke()})}
function tcPlot(){const [g,w,h]=ctx('acTC'),cx=w/2,cy=h/2,Rm=Math.min(w,h)/2-16,rr=d=>Rm*Math.min(d,A.M.tc)/A.M.tc;g.strokeStyle='#2a4060';g.fillStyle='#8fb4d8';
 for(let i=1;i<=4;i++){g.beginPath();g.arc(cx,cy,Rm*i/4,0,7);g.stroke();g.fillText((A.M.tc*i/4).toFixed(0)+' m',cx+3,cy-Rm*i/4+10)}for(let a=0;a<360;a+=30){const t=a*D2R;g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Rm*Math.sin(t),cy-Rm*Math.cos(t));g.stroke();g.fillText(a+'°',cx+(Rm+6)*Math.sin(t)-8,cy-(Rm+6)*Math.cos(t)+3)}
 A.rep.forEach((o,i)=>{g.fillStyle=COL[i%COL.length];for(const s of o.scan){if(s.dist>A.M.tc)continue;const t=s.tcAng*D2R;g.beginPath();g.arc(cx+rr(s.dist)*Math.sin(t),cy-rr(s.dist)*Math.cos(t),2.2,0,7);g.fill()}});
 g.fillStyle='#8fb4d8';g.fillText('TC: 0° = high side (inc ≥ 3°) or north (near vertical)',6,h-4)}
function beamPlot(){const [g,w,h]=ctx('acBeam'),B=A.beam,cx=w/2,cy=h/2,Rm=Math.min(w,h)/2-14,lim=Math.max(B.r0+B.L*Math.tan(B.half*D2R),20)*1.6,s=Rm/lim;
 g.strokeStyle='#ffe08a';g.fillStyle='rgba(255,224,138,.07)';for(const f of [1/3,2/3,1]){g.beginPath();g.arc(cx,cy,(B.r0+f*B.L*Math.tan(B.half*D2R))*s,0,7);g.fill();g.stroke()}
 g.strokeStyle='#2a4060';g.beginPath();g.moveTo(cx-Rm,cy);g.lineTo(cx+Rm,cy);g.moveTo(cx,cy-Rm);g.lineTo(cx,cy+Rm);g.stroke();g.fillStyle='#8fb4d8';g.fillText('HS',cx+3,cy-Rm+8);g.fillText('R',cx+Rm-8,cy-3);g.fillText('±'+lim.toFixed(0)+' m',4,12);
 const names=A.wells.map(x=>x.name);for(const p of B.pts){if(Math.abs(p.x)>lim||Math.abs(p.y)>lim)continue;g.fillStyle=COL[names.indexOf(p.off)%COL.length];g.globalAlpha=0.35+0.65*(1-p.a/B.L);g.beginPath();g.arc(cx+p.x*s,cy-p.y*s,2.5,0,7);g.fill()}g.globalAlpha=1;
 g.fillStyle='#8fb4d8';g.fillText(`looking down the bit at ${B.bit.md.toFixed(0)} m MD; next ${B.L} m; dots fade with distance ahead`,6,h-4)}
let W0=()=>null;
function on3d({THREE,sc,P,k}){if(!A.wells)return;const T=THREE,mk=(r)=>P({n:r.p[0],e:r.p[1],tvd:r.p[2]});
 A.wells.forEach((o,i)=>{sc.add(new T.Line(new T.BufferGeometry().setFromPoints(o.pts.map(mk)),new T.LineBasicMaterial({color:COL[i%COL.length]})))});
 const ring=(r,col)=>{const [a,b,u1,u2]=ellipse(r.C,r.t),m=A.M.k,pts=[];for(let j=0;j<=32;j++){const t=j/32*2*Math.PI,c=Math.cos(t)*a*m,s=Math.sin(t)*b*m;pts.push(P({n:r.p[0]+c*u1[0]+s*u2[0],e:r.p[1]+c*u1[1]+s*u2[1],tvd:r.p[2]+c*u1[2]+s*u2[2]}))}sc.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:col,transparent:true,opacity:.8})))};
 for(const w of [A.ref,...A.wells])for(const r of w.pts)if(Math.round(r.md)%150==0&&r.md>0)ring(r,w===A.ref?'#4fc3ff':'#cccccc');
 // plan coloured by SF status
 const pts=[],cols=[];A.ref.pts.forEach((r,j)=>{const worst=A.rep.map(o=>o.scan[j]).reduce((a,b)=>b.sf<a.sf?b:a);pts.push(mk(r));const c=new T.Color(stC(worst.status));cols.push(c.r,c.g,c.b)});
 const gg=new T.BufferGeometry().setFromPoints(pts);gg.setAttribute('color',new T.Float32BufferAttribute(cols,3));sc.add(new T.Line(gg,new T.LineBasicMaterial({vertexColors:true,linewidth:2})));
 const B=A.beam,rEnd=(B.r0+B.L*Math.tan(B.half*D2R))*k,cone=new T.Mesh(new T.ConeGeometry(Math.max(rEnd,0.5),B.L*k,24,1,true),new T.MeshBasicMaterial({color:0xfff2a8,transparent:true,opacity:.6,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false}));
 const tip=mk(B.bit),dir=new T.Vector3(B.bit.t[1],-B.bit.t[2],-B.bit.t[0]).normalize();cone.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),dir);cone.position.copy(tip.clone().add(dir.clone().multiplyScalar(B.L*k/2)));sc.add(cone);const edge=new T.LineSegments(new T.EdgesGeometry(cone.geometry,1),new T.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9}));edge.quaternion.copy(cone.quaternion);edge.position.copy(cone.position);sc.add(edge);const glow=new T.Mesh(new T.SphereGeometry(Math.max(rEnd*0.25,0.4),16,12),new T.MeshBasicMaterial({color:0xffffcc}));glow.position.copy(tip);sc.add(glow)}
function acHTML(W){const R=A.rep,M=A.M;return `${emL()}<div style="margin:4px 0">${tagB('SIM')} <b>Anti-collision (concept)</b> · ${es(M.name)} · σ inc ${M.sInc}°, σ azi ${M.sAzi}°, depth ${M.dref} m + ${(M.dsf*1000).toFixed(2)}‰ · k ${M.k} · hole r ${M.hole} m</div>
 <div class=wpG><label>Alert SF${tagB('SIM')}<input id=acAl type=number step=0.1 value=${M.alert}></label><label>Stop SF${tagB('SIM')}<input id=acSt type=number step=0.1 value=${M.stop}></label><label>σ azimuth (°)${tagB('SIM')}<input id=acSa type=number step=0.05 value=${M.sAzi}></label><label>TC radius (m)<input id=acTCr type=number value=${M.tc}></label></div>
 <h4 style="margin:8px 0 2px">Min-SF report</h4><div style="overflow:auto"><table class=wpT style="font-size:11px"><tr><th>Offset</th><th>Min SF</th><th>@ MD</th><th>C-C</th><th>Off MD</th><th>Min C-C</th><th>1st alert</th><th>1st stop</th><th></th></tr>
 ${R.map((o,i)=>`<tr><td style="text-align:left;color:${COL[i%COL.length]}">${tagB(o.tag)} ${es(o.name)}</td><td><b>${o.minSF.toFixed(2)}</b></td><td>${o.mdAtMin.toFixed(0)}</td><td>${o.distAtMin.toFixed(1)}</td><td>${o.offMdAtMin.toFixed(0)}</td><td>${o.minDist.toFixed(1)}</td><td>${o.firstAlert??'–'}</td><td>${o.firstStop??'–'}</td><td style="color:${stC(o.status)}"><b>${o.status}</b></td></tr>`).join('')}</table></div>
 <h4 style="margin:8px 0 2px">Ladder (centre-to-centre, shaded = k·σ)</h4>${cvs('acLad')}<h4 style="margin:8px 0 2px">Separation factor</h4>${cvs('acSF')}<h4 style="margin:8px 0 2px">Traveling cylinder</h4>${cvs('acTC',300)}`}
function beamHTML(W){const B=A.beam,M=A.M;return `${emL()}<div style="margin:4px 0">${tagB('SIM')} <b>Beam of light ahead of the bit</b> (concept): cone from the bit along its direction, base = k·σ lateral (${B.r0.toFixed(1)} m), half-angle ${M.beam.half}°, ${M.beam.len} m ahead.</div>
 <label style="font-size:11px">Bit MD on plan: <b id=acBitV>${A.bitMd}</b> m<input id=acBit type=range min=0 max=${Math.floor(W.L.td)} step=10 value=${A.bitMd} style="width:100%"></label>
 <div class=wpG><label>Look-ahead (m)<input id=acBL type=number value=${M.beam.len}></label><label>Half-angle (°)${tagB('SIM')}<input id=acBH type=number step=0.5 value=${M.beam.half}></label></div>
 ${cvs('acBeam',300)}<div id=acBeamT>${B.hits.length?B.hits.map(h=>`<div style="color:${h.inside?'#ff5252':'#2ecc71'}">${h.inside?'⛔ IN BEAM':'✔ clear'}: ${es(h.off)} – ${h.ahead.toFixed(0)} m ahead, ${h.radial.toFixed(1)} m off-axis, clearance ${h.clear.toFixed(1)} m</div>`).join(''):'<div>No offset within the look-ahead.</div>'}
 <div>Min SF in next ${M.beam.len} m: ${(()=>{const v=A.rep.map(o=>({o,s:o.scan.filter(s=>s.md>A.bitMd&&s.md<=A.bitMd+M.beam.len).reduce((a,b)=>!a||b.sf<a.sf?b:a,null)})).filter(x=>x.s).sort((a,b)=>a.s.sf-b.s.sf)[0];return v?`<b style="color:${stC(v.s.status)}">${v.s.sf.toFixed(2)}</b> vs ${es(v.o.name)} at ${v.s.md.toFixed(0)} m`:'–'})()}</div></div>
 <div id=wp3d style="height:min(38vh,300px);margin:6px 0;border-radius:8px;overflow:hidden;background:#08101c"></div>`}
function offHTML(){return `${emL()}<div style="margin:4px 0"><b>Offset wells</b> (stored on this device). Import CSV (<code>md,inc,azi</code>; optional <code>well,head_n,head_e</code> columns or <code># well:</code> / <code># wellhead N=.. E=..</code> lines) or EDM XML export.</div>
 <input id=acFile type=file accept=".csv,.txt,.xml,.edm" multiple style="font-size:13px"> <button id=acSim>Reset to SIM offsets</button>
 <div id=acMsg style="font-size:11px;margin:4px 0"></div><table class=wpT style="font-size:11px;width:100%"><tr><th style="text-align:left">Well</th><th>Head N/E</th><th>Stations</th><th>TD</th><th></th></tr>
 ${A.offs.map((o,i)=>`<tr><td style="text-align:left;color:${COL[i%COL.length]}">${tagB(o.tag)} ${es(o.name)}</td><td>${o.head.n}/${o.head.e}</td><td>${o.rows.length}</td><td>${Math.max(...o.rows.map(r=>r.md)).toFixed(0)}</td><td><button data-del="${es(o.name)}">✕</button></td></tr>`).join('')}</table>
 <div id=wp3d style="height:min(38vh,300px);margin:6px 0;border-radius:8px;overflow:hidden;background:#08101c"></div>`}
async function delOff(name){const d=await new Promise((ok,no)=>{const r=indexedDB.open('dw_wplan',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});await new Promise(ok=>{const x=d.transaction('offsets','readwrite');x.objectStore('offsets').delete(name);x.oncomplete=ok})}
export function register(W){W0=()=>W;GX.wac={A,MODEL,computeAsync,scan,report,beam,well,planWell,parseCSV,parseEDM,covariance,ellipse,SIM_OFFSETS};W.tabs.push(['offsets','Offsets'],['ac','Anti-collision'],['beam','Beam']);
 W.on3d.push(on3d);W.extraPts=()=>A.wells?A.wells.flatMap(o=>[o.pts[0],o.pts.at(-1)]):[];
 const prep=async B=>{B.innerHTML=`<div id=acProg style="padding:10px"><div>Computing anti-collision (SIM)… <b id=acPct>0%</b> <small id=acWho style="opacity:.7"></small></div><div style="height:8px;background:#1b2838;border-radius:4px;margin-top:6px;overflow:hidden"><div id=acBar style="height:100%;width:0;background:#5fa8ff;transition:width .1s"></div></div></div>`;await loadOffs();
  const r=await computeAsync(W,(f,who)=>{const p=Math.round(Math.min(1,f)*100);const b=B.querySelector('#acBar');if(b){b.style.width=p+'%';B.querySelector('#acPct').textContent=p+'%';B.querySelector('#acWho').textContent=who||''}A.progress=p});return !!r};
 W.ext.offsets=async B=>{if(!await prep(B))return;B.innerHTML=offHTML();W.draw3d();
  $('acFile').onchange=async e=>{let n=0,msg=[];for(const f of e.target.files){const t=await f.text(),ws=/<\w|^\s*<\?xml/.test(t)&&/SURVEY_STATION/i.test(t)?parseEDM(t):parseCSV(t,f.name.replace(/\.\w+$/,''));for(const w of ws){w.tag='IMPORT';await WP.dbPut('offsets',w);n++}msg.push(f.name+': '+ws.length+' well(s)')}A.offs=null;await W.ext.offsets(B);$('acMsg').textContent='Imported '+n+' · '+msg.join(' · ')};
  $('acSim').onclick=async()=>{for(const o of A.offs)await delOff(o.name);A.offs=null;await W.ext.offsets(B)};
  for(const b of B.querySelectorAll('[data-del]'))b.onclick=async()=>{await delOff(b.dataset.del);A.offs=null;await W.ext.offsets(B)}};
 W.ext.ac=async B=>{if(!await prep(B))return;B.innerHTML=acHTML(W);ladder();sfPlot();tcPlot();const upd=()=>{A.M.alert=+$('acAl').value;A.M.stop=+$('acSt').value;A.M.sAzi=+$('acSa').value;A.M.tc=+$('acTCr').value;W.ext.ac(B)};for(const id of ['acAl','acSt','acSa','acTCr'])$(id).onchange=upd};
 W.ext.beam=async B=>{if(!await prep(B))return;B.innerHTML=beamHTML(W);beamPlot();W.draw3d();$('acBit').oninput=e=>{$('acBitV').textContent=e.target.value};$('acBit').onchange=e=>{A.bitMd=+e.target.value;W.ext.beam(B)};
  $('acBL').onchange=()=>{A.M.beam.len=+$('acBL').value;W.ext.beam(B)};$('acBH').onchange=()=>{A.M.beam.half=+$('acBH').value;W.ext.beam(B)}}}
