// wpg_core.js (helper G) — well planning + drilling physics engine. Pure functions, no DOM, no network. Node-testable.
// Everything computed here is a planning/simulator aid and is tagged SIM unless the inputs come from real data. Sources: docs/wplan-physics.md
export const D2R=Math.PI/180,R2D=180/Math.PI,G0=9.80665,FT=0.3048,IN=0.0254,PSI=6894.757,LBF=4.448222,KLBF=4448.222;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],add=(a,b,k=1)=>[a[0]+k*b[0],a[1]+k*b[1],a[2]+k*b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],len=a=>Math.hypot(a[0],a[1],a[2]),nrm=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l]};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const vec=(inc,azi)=>[Math.sin(inc*D2R)*Math.cos(azi*D2R),Math.sin(inc*D2R)*Math.sin(azi*D2R),Math.cos(inc*D2R)]; // [N,E,V]
export const incAzi=t=>{const i=Math.acos(clamp(t[2],-1,1))*R2D;let a=Math.atan2(t[1],t[0])*R2D;if(a<0)a+=360;return [i,i<1e-7?0:a]};
export function doglegRad(i1,a1,i2,a2){return Math.acos(clamp(Math.cos((i2-i1)*D2R)-Math.sin(i1*D2R)*Math.sin(i2*D2R)*(1-Math.cos((a2-a1)*D2R)),-1,1))}
export function minCurv(md1,i1,a1,md2,i2,a2){const b=doglegRad(i1,a1,i2,a2),rf=b<1e-9?1:2/b*Math.tan(b/2),h=(md2-md1)/2,t1=vec(i1,a1),t2=vec(i2,a2);return [h*(t1[0]+t2[0])*rf,h*(t1[1]+t2[1])*rf,h*(t1[2]+t2[2])*rf]}
// high-side / right unit vectors for a tangent. For a vertical tangent, `azRef` gives the plane (magnetic/gravity toolface reference).
function frame(t,azRef=0){const [i,a]=incAzi(t);const A=(i<0.01?azRef:a)*D2R,I=i*D2R;return {h:[Math.cos(I)*Math.cos(A),Math.cos(I)*Math.sin(A),-Math.sin(I)],r:[-Math.sin(A),Math.cos(A),0]}}

// ================= 1. TRAJECTORY DESIGN =================
// Section list engine. Section kinds:
//  {kind:'hold',len} | {kind:'hold',toTVD} | {kind:'hold',toMD}
//  {kind:'curve',dls,tf,len}            dls °/30 m, toolface ° from high side (azimuth when vertical)
//  {kind:'curve',dls,inc,azi}           build/turn to an attitude at that DLS
//  {kind:'target',dls,target:'T1'}      curve-hold (tangent) to hit target centre
export function runSections(secs,{start=[0,0,0],t0=[0,0,1],md0=0,targets=[],maxDls=null}={}){let p=start.slice(),t=t0.slice(),md=md0;const legs=[],warn=[];
 const curve=(n,beta,L,dls,name)=>{const k=beta/L;const dp=beta<1e-9?mul(t,L):add(mul(t,Math.sin(beta)/k),n,(1-Math.cos(beta))/k);const t2=beta<1e-9?t:nrm(add(mul(t,Math.cos(beta)),n,Math.sin(beta)));
  legs.push({kind:beta<1e-9?'hold':'curve',md0:md,md1:md+L,len:L,p0:p,t0:t,n,beta,dls:beta<1e-9?0:dls,name});p=add(p,dp);t=t2;md+=L};
 secs.forEach((s,si)=>{const nm=s.name||('S'+(si+1));
  if(s.kind=='hold'){let L=s.len??0;if(s.toTVD!=null){L=t[2]>1e-6?(s.toTVD-p[2])/t[2]:0;if(L<0){warn.push(nm+': TVD is above the current point');L=0}}if(s.toMD!=null)L=Math.max(0,s.toMD-md);if(L>1e-6)curve(t,0,L,0,nm);return}
  if(s.kind=='curve'){const dls=+s.dls||0;if(maxDls&&dls>maxDls+1e-9)warn.push(`${nm}: DLS ${dls} is more than the limit ${maxDls} °/30 m`);
   if(s.inc!=null){const t1=vec(s.inc,s.azi??incAzi(t)[1]),b=Math.acos(clamp(dot(t,t1),-1,1));if(b<1e-9)return;if(dls<=0){warn.push(nm+': DLS must be more than 0');return}let n=nrm(add(t1,t,-Math.cos(b)));curve(n,b,b/(dls*D2R/30),dls,nm);return}
   const F=frame(t,s.tf0??0),tf=(s.tf||0)*D2R,n=nrm(add(mul(F.h,Math.cos(tf)),F.r,Math.sin(tf)));const L=s.len||0;if(L>1e-6)curve(n,dls*D2R/30*L,L,dls,nm);return}
  if(s.kind=='target'){const T=targets.find(x=>x.name==s.target);if(!T){warn.push(nm+': no target '+s.target);return}const R=30/((s.dls||3)*D2R),c=[T.n,T.e,T.tvd];
   const d=add(c,p,-1),a=dot(d,t),pv=add(d,t,-a),b=len(pv);if(b<1e-6){if(a>0)curve(t,0,a,0,nm);return}const n=mul(pv,1/b);
   // solve beta: point on arc then tangent passes through c.  f(beta)= cross condition. Bisection on beta in (0,pi)
   const f=be=>{const q=[R*Math.sin(be),R*(1-Math.cos(be))],u=[Math.cos(be),Math.sin(be)];return (a-q[0])*u[1]-(b-q[1])*u[0]};
   let lo=1e-9,hi=null;for(let k=1;k<=360;k++){const x=k*Math.PI/360*0.999;if(f(lo)*f(x)<=0){hi=x;break}lo=x}if(hi==null||(a*a+(b-R)*(b-R))<R*R){warn.push(`${nm}: target ${T.name} can not be hit at ${s.dls} °/30 m (too close)`);return}
   for(let k=0;k<80;k++){const m=(lo+hi)/2;f(lo)*f(m)<=0?hi=m:lo=m}const be=(lo+hi)/2;if(maxDls&&s.dls>maxDls)warn.push(`${nm}: DLS ${s.dls} is more than the limit ${maxDls}`);
   curve(n,be,R*be,s.dls||3,nm);const h=len(add(c,p,-1));if(h>1e-6)curve(t,0,h,0,nm+' hold');}});
 return {legs,warn,td:md,end:{p,t,md}}}
export function stationsOf(D,step=30){const out=[];const mds=new Set([D.legs[0]?.md0??0,D.td]);for(const g of D.legs){mds.add(g.md0);mds.add(g.md1);for(let m=Math.ceil(g.md0/step)*step;m<g.md1;m+=step)mds.add(m)}
 for(const md of [...mds].sort((a,b)=>a-b)){const g=D.legs.find(l=>md<=l.md1+1e-9)||D.legs.at(-1);if(!g){out.push({md,inc:0,azi:0,n:0,e:0,tvd:0,dls:0,sec:''});continue}const s=md-g.md0,k=g.len>0?g.beta/g.len:0,be=k*s;
  const p=be<1e-9?add(g.p0,g.t0,s):add(add(g.p0,g.t0,Math.sin(be)/k),g.n,(1-Math.cos(be))/k),t=be<1e-9?g.t0:nrm(add(mul(g.t0,Math.cos(be)),g.n,Math.sin(be)));const [inc,azi]=incAzi(t);
  out.push({md,inc,azi,n:p[0],e:p[1],tvd:p[2],dls:g.dls,sec:g.name,t})}return out}
// --- profile generators (2D in the plane of the target azimuth). Return section lists. ---
export function buildHold({kop,bur,target}){return [{kind:'hold',toMD:kop,name:'Vertical'},{kind:'target',dls:bur,target:target.name,name:'Build + tangent'}]}
export function horizontal({kop,bur,entry,lateral=1000,landInc=90}){const D=Math.hypot(entry.n,entry.e),az=(Math.atan2(entry.e,entry.n)*R2D+360)%360,R=30/(bur*D2R),V=entry.tvd;
 // build-hold-build: tanI=(D-R(1-cos Il)... general landing inc Il: TVD=KOP+R sinI + L cosI + R(sinIl - sinI); disp=R(1-cosI)+L sinI+R(cosI-cosIl)
 const Il=landInc*D2R,f=I=>{const L=(V-kop-R*Math.sin(I)-R*(Math.sin(Il)-Math.sin(I)))/Math.cos(I);return {L,d:R*(1-Math.cos(I))+L*Math.sin(I)+R*(Math.cos(I)-Math.cos(Il))}};
 let lo=0.001,hi=Il-0.001,ok=true;if(f(lo).d>D||f(hi).d<D)ok=false;for(let k=0;k<80;k++){const m=(lo+hi)/2;f(m).d<D?lo=m:hi=m}const I=(lo+hi)/2,{L}=f(I);
 return {ok:ok&&L>=0,tanInc:I*R2D,secs:[{kind:'hold',toMD:kop,name:'Vertical'},{kind:'curve',dls:bur,inc:I*R2D,azi:az,name:'Build 1'},{kind:'hold',len:Math.max(0,L),name:'Tangent'},{kind:'curve',dls:bur,inc:landInc,azi:az,name:'Build 2 (land)'},{kind:'hold',len:lateral,name:'Lateral'}]}}
export function sShape({kop,bur,dor,target,finalInc=0}){const D=Math.hypot(target.n,target.e),az=(Math.atan2(target.e,target.n)*R2D+360)%360,R1=30/(bur*D2R),R2=30/(dor*D2R),V=target.tvd,If=finalInc*D2R;
 const f=I=>{const L=(V-kop-R1*Math.sin(I)-R2*(Math.sin(I)-Math.sin(If)))/Math.cos(I);return {L,d:R1*(1-Math.cos(I))+L*Math.sin(I)+R2*(Math.cos(If)-Math.cos(I))}};
 let lo=If+0.001,hi=85*D2R,ok=true;if(f(lo).d>D||f(hi).d<D||f(hi).L<0)ok=false;for(let k=0;k<80;k++){const m=(lo+hi)/2;(f(m).d<D&&f(m).L>=0)?lo=m:hi=m}const I=(lo+hi)/2,{L}=f(I);
 return {ok:ok&&L>=0,holdInc:I*R2D,secs:[{kind:'hold',toMD:kop,name:'Vertical'},{kind:'curve',dls:bur,inc:I*R2D,azi:az,name:'Build'},{kind:'hold',len:Math.max(0,L),name:'Tangent'},{kind:'curve',dls:dor,inc:Math.max(0.0001,finalInc),azi:az,name:'Drop'},{kind:'hold',toTVD:V,name:'Hold to target'}]}}
// multilateral: laterals kick off from the main bore at kickMD, turn by dAzi at dls, then hold a lateral length
export function laterals(main,list){return list.map((L,i)=>{const S=stationsOf(main,5),k=S.reduce((b,r)=>Math.abs(r.md-L.kickMD)<Math.abs(b.md-L.kickMD)?r:b,S[0]);
 const D=runSections([{kind:'curve',dls:L.dls||6,inc:L.inc??k.inc,azi:(k.azi+(L.dAzi||0)+360)%360,name:'L'+(i+1)+' turn'},{kind:'hold',len:L.len||800,name:'L'+(i+1)+' lateral'}],{start:[k.n,k.e,k.tvd],t0:k.t,md0:k.md});return {name:L.name||('Lateral '+(i+1)),kickMD:k.md,D}})}
export function targetHits(S,targets){return targets.map(T=>{let best=1e18,r0=null;for(let i=1;i<S.length;i++){const a=S[i-1],b=S[i],A=[a.n,a.e,a.tvd],B=[b.n,b.e,b.tvd],AB=add(B,A,-1),q=clamp(dot(add([T.n,T.e,T.tvd],A,-1),AB)/Math.max(1e-9,dot(AB,AB)),0,1),P=add(A,AB,q),d=add(P,[T.n,T.e,T.tvd],-1);
  // lateral (horizontal) miss and vertical miss, for box/cylinder tolerance
  const h=Math.hypot(d[0],d[1]),v=Math.abs(d[2]),m=len(d);if(m<best){best=m;r0={md:a.md+q*(b.md-a.md),h,v,m}}}
 const tolH=T.tol??30,tolV=T.tolV??tolH;return {name:T.name,...r0,tolH,tolV,ok:r0&&r0.h<=tolH+1e-6&&r0.v<=tolV+1e-6}})}

// ================= 2. ERROR MODEL (ISCWSA MWD, Williamson 2000 SPE 67616; OWSG set) =================
// Each term: weighting function w(inc,azi,md) -> [dMD, dInc(rad), dAzi(rad)] per unit error, magnitude sigma, propagation 'sys' or 'rand'.
export const GEO={G:9.80665,B:50000,dip:60,dec:0};
export function terms(g=GEO){const G=g.G,B=g.B,th=g.dip*D2R,tn=Math.tan(th),cB=B*Math.cos(th);return [
 {id:'DRFR',s:0.35,p:'rand',w:()=>[1,0,0],d:'Depth reference, random'},
 {id:'DSFS',s:5.6e-4,p:'sys',w:(I,A,md)=>[md,0,0],d:'Depth scale factor'},
 {id:'DSTG',s:2.5e-7,p:'sys',w:(I,A,md,tvd)=>[md*tvd,0,0],d:'Depth stretch (MD x TVD)'},
 {id:'ABXY-TI1',s:0.0040,p:'sys',w:(I,A)=>[0,-Math.cos(I)/G,tn*Math.cos(I)*Math.sin(A)/G],d:'Accelerometer bias XY'},
 {id:'ABZ',s:0.0040,p:'sys',w:(I,A)=>[0,-Math.sin(I)/G,tn*Math.sin(I)*Math.sin(A)/G],d:'Accelerometer bias Z'},
 {id:'ASXY-TI1',s:0.0005,p:'sys',w:(I,A)=>[0,Math.sin(I)*Math.cos(I)/Math.SQRT2,-tn*Math.sin(I)*Math.cos(I)*Math.sin(A)/Math.SQRT2],d:'Accelerometer scale XY'},
 {id:'ASZ',s:0.0005,p:'sys',w:(I,A)=>[0,-Math.sin(I)*Math.cos(I),tn*Math.sin(I)*Math.cos(I)*Math.sin(A)],d:'Accelerometer scale Z'},
 {id:'MBXY-TI1',s:70,p:'sys',w:(I,A)=>[0,0,-Math.cos(I)*Math.sin(A)/cB],d:'Magnetometer bias XY'},
 {id:'MBZ',s:70,p:'sys',w:(I,A)=>[0,0,-Math.sin(I)*Math.sin(A)/cB],d:'Magnetometer bias Z'},
 {id:'MSXY-TI1',s:0.0016,p:'sys',w:(I,A)=>[0,0,Math.sin(I)*Math.sin(A)*(tn*Math.cos(I)+Math.sin(I)*Math.cos(A))/Math.SQRT2],d:'Magnetometer scale XY'},
 {id:'MSZ',s:0.0016,p:'sys',w:(I,A)=>[0,0,-(Math.sin(I)*Math.cos(A)+tn*Math.cos(I))*Math.sin(I)*Math.sin(A)],d:'Magnetometer scale Z'},
 {id:'DEC',s:0.36*D2R,p:'sys',w:()=>[0,0,1],d:'Declination'},
 {id:'DBH',s:5000*D2R,p:'sys',w:()=>[0,0,1/cB],d:'Declination, B-field dependent'},
 {id:'AMIL',s:220,p:'sys',w:(I,A)=>[0,0,Math.sin(I)*Math.sin(A)/cB],d:'Axial magnetic interference'},
 {id:'SAG',s:0.2*D2R,p:'sys',w:I=>[0,Math.sin(I),0],d:'BHA sag'},
 {id:'XYM1',s:0.1*D2R,p:'sys',w:I=>[0,Math.abs(Math.sin(I)),0],d:'Misalignment 1'},
 {id:'XYM2',s:0.1*D2R,p:'sys',w:()=>[0,0,-1],d:'Misalignment 2'}]}
const dT=(I,A)=>[[Math.cos(I)*Math.cos(A),Math.cos(I)*Math.sin(A),-Math.sin(I)],[-Math.sin(I)*Math.sin(A),Math.sin(I)*Math.cos(A),0]];
// st: [{md,inc,azi,n,e,tvd}] ascending. Returns rows with C (3x3 NEV covariance, 1 sigma)
export function covISCWSA(st,{geo=GEO,scale=1,only=null}={}){const T0=terms(geo).filter(x=>!only||only.includes(x.id)),N=st.length;
 // near-vertical singularity (ISCWSA Rev4 idea): XY sensor terms act in both horizontal axes. Shadow copies act 90° to the azimuth while inc < VSING.
 const VS=0.5*D2R,T=[...T0,...T0.filter(x=>/XY/.test(x.id)&&x.p=='sys').map(x=>({...x,id:x.id+'-V',rot:1,w:(I,A,md,tvd)=>{if(I>=VS)return [0,0,0];const w=x.w(0,A,md,tvd);return [0,w[1]*(1-I/VS),0]}}))];
 const t=st.map(r=>vec(r.inc,r.azi)),dt=st.map(r=>dT(r.inc*D2R,r.azi*D2R)),dt9=st.map(r=>dT(r.inc*D2R,(r.azi+90)*D2R));
 // full derivative dr/dp_k when station k is interior (affects segments k and k+1)
 const dr=(k,last,DT=dt)=>{const dm1=k>0?st[k].md-st[k-1].md:0,dm2=!last&&k<N-1?st[k+1].md-st[k].md:0,tp=k>0?t[k-1]:t[k],tn=!last&&k<N-1?t[k+1]:null;
  const dMD=last||k==N-1?mul(add(tp,t[k]),0.5):mul(add(tp,tn,-1),0.5);const s=(dm1+dm2)/2;return [dMD,mul(DT[k][0],s),mul(DT[k][1],s)]};
 const sys=T.map(()=>[0,0,0]);let rnd=[[0,0,0],[0,0,0],[0,0,0]];const out=[];
 const outer=(e,C,k=1)=>{for(let a=0;a<3;a++)for(let b=0;b<3;b++)C[a][b]+=k*e[a]*e[b]};
 for(let K=0;K<N;K++){const r=st[K],I=r.inc*D2R,A=(r.azi-(geo.dec||0))*D2R,C=[[0,0,0],[0,0,0],[0,0,0]];const dL0=dr(K,true),dI0=dr(K,false),dL9=dr(K,true,dt9),dI9=dr(K,false,dt9);
  T.forEach((x,j)=>{const dL=x.rot?dL9:dL0,dI=x.rot?dI9:dI0;const w=x.w(I,A,r.md,r.tvd),s=x.s*scale;if(K==0&&x.p=='sys'){}const eL=[0,1,2].map(a=>s*(dL[0][a]*w[0]+dL[1][a]*w[1]+dL[2][a]*w[2])),eI=[0,1,2].map(a=>s*(dI[0][a]*w[0]+dI[1][a]*w[1]+dI[2][a]*w[2]));
   if(x.p=='sys'){outer(add(sys[j],eL),C);sys[j]=add(sys[j],eI)}else{outer(eL,C);for(let a=0;a<3;a++)for(let b=0;b<3;b++)C[a][b]+=rnd[a][b];outer(eI,rnd)}});
  out.push({...r,C})}
 return out}
export function sym2eig(a,b,c){const tr=(a+c)/2,d=Math.sqrt(((a-c)/2)**2+b*b);const l1=tr+d,l2=Math.max(0,tr-d),ang=0.5*Math.atan2(2*b,a-c);return [Math.sqrt(Math.max(0,l1)),Math.sqrt(l2),ang]}
// horizontal (NE) ellipse and ellipse in the plane perpendicular to the hole
export function ellNE(C){return sym2eig(C[0][0],C[0][1],C[1][1])}
export function ellPerp(C,t){const F=frame(t),u=F.h,v=F.r,q=(x,y)=>x.reduce((s,xa,a)=>s+xa*(C[a][0]*y[0]+C[a][1]*y[1]+C[a][2]*y[2]),0);return [...sym2eig(q(u,u),q(u,v),q(v,v)),u,v]}
export const sigAlong=(C,u)=>Math.sqrt(Math.max(0,u.reduce((s,ua,a)=>s+ua*(C[a][0]*u[0]+C[a][1]*u[1]+C[a][2]*u[2]),0)));
// stations from a positions-only path [{md,N,E,Z}] (EDM decimated path) -> inc/azi by chord tangent
export function fromPath(path,head={N:0,E:0}){const P=path.filter(p=>Number.isFinite(p.md)&&Number.isFinite(p.Z));const out=[];for(let i=0;i<P.length;i++){const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)];const d=[b.N-a.N,b.E-a.E,b.Z-a.Z];const [inc,azi]=len(d)>1e-6?incAzi(nrm(d)):[0,0];out.push({md:P[i].md,inc,azi,n:P[i].N-head.N,e:P[i].E-head.E,tvd:P[i].Z})}return out}
// ISCWSA / OWSG separation factor: SF=(D-Rr-Ro-Sm)/(k*sigma_s), sigma_s=sqrt(n'(Cr+Co)n)
export const SFOPT={k:3.5,Sm:0.3,Rr:0.108,Ro:0.108,alert:1.5,stop:1.0,minor:1.0};
export function sfScan(ref,off,o=SFOPT){const res=[];const O=off;for(const r of ref){let bd=1e18,bi=0;for(let j=0;j<O.length;j++){const q=(O[j].n-r.n)**2+(O[j].e-r.e)**2+(O[j].tvd-r.tvd)**2;if(q<bd){bd=q;bi=j}}
 // refine on neighbouring segments
 let best={d:Math.sqrt(bd),j:bi,f:0};for(const j of [bi-1,bi]){if(j<0||j+1>=O.length)continue;const A=[O[j].n,O[j].e,O[j].tvd],B=[O[j+1].n,O[j+1].e,O[j+1].tvd],AB=add(B,A,-1),R=[r.n,r.e,r.tvd],q=clamp(dot(add(R,A,-1),AB)/Math.max(1e-9,dot(AB,AB)),0,1),d=len(add(R,add(A,AB,q),-1));if(d<best.d)best={d,j,f:q}}
 const oj=O[best.j],Co=oj.C,P=best.j+1<O.length?add([oj.n,oj.e,oj.tvd],add([O[best.j+1].n,O[best.j+1].e,O[best.j+1].tvd],[oj.n,oj.e,oj.tvd],-1),best.f):[oj.n,oj.e,oj.tvd];
 const dv=add(P,[r.n,r.e,r.tvd],-1),D=len(dv),nv=D>1e-6?mul(dv,1/D):[0,0,1],C=[0,1,2].map(a=>[0,1,2].map(b=>r.C[a][b]+Co[a][b])),s=sigAlong(C,nv);
 const sf=s>1e-9?(D-o.Rr-o.Ro-o.Sm)/(o.k*s):99;res.push({md:r.md,tvd:r.tvd,omd:oj.md+(best.f*((O[best.j+1]?.md??oj.md)-oj.md)),ctc:D,sig:s,sf,es:D-o.Rr-o.Ro-o.k*s})}return res}
export function sfSummary(name,S,o=SFOPT){const m=S.reduce((a,b)=>b.sf<a.sf?b:a,S[0]),c=S.reduce((a,b)=>b.ctc<a.ctc?b:a,S[0]);const lvl=m.sf<o.stop?'STOP':m.sf<o.alert?'ALERT':'OK';return {name,minSF:m.sf,minSFmd:m.md,minCtc:c.ctc,minCtcMd:c.md,lvl}}
// the old check (simple radius) for comparison
export const simpleRadius=(S,r=30)=>S.filter(x=>x.ctc<r).length;

// ================= 3. DRILLSTRING, T&D (Johancsik soft string), BUCKLING =================
export const STEEL={E:207e9,G:79.3e9,rho:7850,nu:0.3};
// default BHA + string (bit first). od/id inches, len m, kgm kg/m (incl. tool joints), yield klbf, mtq kN.m (make-up torque)
export const STRING=[
 {name:'8-1/2" PDC bit',type:'bit',od:8.5,id:2,len:0.35,kgm:200},{name:'6-3/4" RSS',type:'rss',od:6.75,id:2.5,len:4.5,kgm:160,stab:8.25},{name:'6-3/4" MWD/LWD',type:'mwd',od:6.75,id:2.8,len:18,kgm:150,stab:8.25},
 {name:'6-1/2" drill collar',type:'dc',od:6.5,id:2.8125,len:56,kgm:135},{name:'6-1/2" jar',type:'jar',od:6.5,id:2.75,len:10,kgm:130},{name:'5" HWDP',type:'hwdp',od:5,id:3,len:84,kgm:74.4,tj:6.5},
 {name:'5" DP 19.5 ppf S-135',type:'dp',od:5,id:4.276,len:99999,kgm:33.0,tj:6.625,yieldK:560,mtq:44}];
export const Ipipe=c=>Math.PI/64*((c.od*IN)**4-(c.id*IN)**4),Jpipe=c=>2*Ipipe(c),Apipe=c=>Math.PI/4*((c.od*IN)**2-(c.id*IN)**2);
// expand string along bit depth: returns per-element arrays from bit (md=bitMd) upward
export function stringAt(str,bitMd){const out=[];let top=bitMd;for(const c of str){const L=Math.min(c.len,top);if(L<=0)break;out.push({...c,mdBot:top,mdTop:top-L,L});top-=L;if(top<=0)break}return out}
export function survAt(S,md){if(md<=S[0].md)return S[0];for(let i=1;i<S.length;i++)if(S[i].md>=md){const a=S[i-1],b=S[i],f=(md-a.md)/((b.md-a.md)||1);return {md,inc:a.inc+f*(b.inc-a.inc),azi:a.azi+f*(((b.azi-a.azi+540)%360)-180),tvd:a.tvd+f*(b.tvd-a.tvd)}}return S.at(-1)}
// ops: 'pooh','rih','rob' (rotate off bottom), 'drill' (rotate on bottom), 'slide'
// returns elements top-down with T (N, + tension), M (N.m), Fn (N/m), and surface hookload (N), surface torque
export function tnd(S,{bitMd,str=STRING,mw=1.20,ffCH=0.2,ffOH=0.3,shoeMd=0,op='pooh',wob=0,tob=0,rpm=120,vTrip=0.5,dx=10,holeIn=8.5}){
 const BF=1-mw*1000/STEEL.rho,els=stringAt(str,bitMd),seg=[];let T=(op=='drill'||op=='slide')?-wob:0,M=op=='drill'?tob:0;
 for(const e of els){for(let b=e.mdBot;b>e.mdTop+1e-6;){const a=Math.max(e.mdTop,b-dx),L=b-a,s1=survAt(S,a),s2=survAt(S,b),I1=s1.inc*D2R,I2=s2.inc*D2R,dI=I2-I1,dA=(((s2.azi-s1.azi+540)%360)-180)*D2R,Ib=(I1+I2)/2;
  const w=e.kgm*G0*BF*L,mu=b<=shoeMd?ffCH:ffOH,r=(e.tj||e.od)*IN/2;
  const Fn=Math.sqrt((T*dA*Math.sin(Ib))**2+(T*dI+w*Math.sin(Ib))**2);
  // rotating: friction goes into torque; trip: axial. Combined (rotating + moving): split by velocity ratio (Aadnoy)
  let fa=0,ft=0;if(op=='pooh'||op=='rih'){fa=mu*Fn}else if(op=='slide'){fa=mu*Fn}else{const vr=Math.PI*2*r*rpm/60,ang=Math.atan2(vTrip*0,vr);fa=mu*Fn*Math.sin(ang);ft=mu*Fn*Math.cos(ang)}
  const sgn=op=='pooh'?1:(op=='rih'||op=='slide')?-1:0;T=T+w*Math.cos(Ib)+sgn*fa;M=M+ft*r;
  seg.push({md:a,mdB:b,T,M,Fn:Fn/L,e:e.name,type:e.type,od:e.od,id:e.id,tj:e.tj,kgm:e.kgm,inc:Ib*R2D,yieldK:e.yieldK,mtq:e.mtq,wb:e.kgm*G0*BF});b=a}}
 seg.reverse();return {seg,hook:seg[0]?.T??0,torque:seg[0]?.M??0,BF}}
// fix: after reverse seg[0] is top. Expose helper
export function surface(R){return {T:R.seg[0]?.T??0,M:R.seg[0]?.M??0}}
// buckling limits per element (N). Dawson-Paslay (inclined), Wu/Juvkam-Wold vertical, Chen helical = 2*sqrt(2)*Fsin
export function bucklingLimits(e,holeIn,mw){const BF=1-mw*1000/STEEL.rho,I=Ipipe(e),w=e.kgm*G0*BF,r=Math.max(0.005,(holeIn-(e.tj||e.od))*IN/2),th=e.inc*D2R;
 const vert=2.55*Math.cbrt(STEEL.E*I*w*w),incl=2*Math.sqrt(STEEL.E*I*w*Math.sin(th)/r);const sin=th<5*D2R?Math.max(vert,Math.min(incl,vert*4)):incl,hel=th<5*D2R?5.55*Math.cbrt(STEEL.E*I*w*w):2*Math.SQRT2*sin;return {sin,hel}}
export function buckCheck(R,holeIn,mw){return R.seg.map(s=>{const L=bucklingLimits(s,holeIn,mw),c=-s.T;return {md:s.md,comp:c,sin:L.sin,hel:L.hel,state:c>L.hel?'helical':c>L.sin?'sinusoidal':'none'}})}
// broomstick: surface hookload vs bit depth for a set of friction factors
export function broomstick(S,{td,str=STRING,mw=1.2,shoeMd=0,ffs=[0.1,0.2,0.3,0.4],step=60,block=35e3}){const out={depth:[],rotate:[],pooh:{},rih:{}};for(const f of ffs){out.pooh[f]=[];out.rih[f]=[]}
 for(let d=step;d<=td+1e-6;d+=step){out.depth.push(d);out.rotate.push((surface(tnd(S,{bitMd:d,str,mw,shoeMd,op:'rob'})).T+block*G0)/1000);
  for(const f of ffs){out.pooh[f].push((surface(tnd(S,{bitMd:d,str,mw,shoeMd,op:'pooh',ffCH:f*0.8,ffOH:f})).T+block*G0)/1000);out.rih[f].push((surface(tnd(S,{bitMd:d,str,mw,shoeMd,op:'rih',ffCH:f*0.8,ffOH:f})).T+block*G0)/1000)}}return out}

// ================= ROP (Bourgoyne & Young 1974, SPE 4238) + BIT SELECTION =================
export const BY={a2:0.00009,a3:0.00004,a4:0.00002,a5:1.0,a6:0.6,a7:0.5,a8:0.4,wdt:0.5};
// D m TVD, gp pore SG, mw SG (ECD), wob kN, db in, rpm, h tooth wear 0..1, q l/min, dpBit bar, ucs MPa, bitType 'PDC'|'RC'
export function ropBY({D,gp=1.03,mw=1.2,wob=80,db=8.5,rpm=120,h=0.1,q=2200,dpBit=40,ucs=40,bitType='PDC'},a=BY){const Dft=D/FT,gpp=gp*8.345,rc=mw*8.345,W=wob*1000/KLBF,wd=Math.max(a.wdt+0.01,W/db);
 const f1=(bitType=='PDC'?1.25:0.8)*45*(10/Math.max(3,ucs))**0.9/FT; // ft/h drillability from UCS (SIM calibration)
 const qg=q/3.785,Fj=0.01823*0.95*qg*Math.sqrt(rc*dpBit*14.5038);
 const x=[0,10000-Dft,Dft**0.69*(gpp-9),Dft*(gpp-rc),Math.log((wd-a.wdt)/(4-a.wdt)),Math.log(rpm/60),-h,Fj/1000];
 const lnR=Math.log(f1)+a.a2*x[1]+a.a3*x[2]+a.a4*x[3]+a.a5*x[4]+a.a6*x[5]+a.a7*x[6]+a.a8*(x[7]-1);return Math.max(0.1,Math.exp(lnR)*FT)} // m/h
// IADC bit selection by UCS (fixed cutter IADC code: body M/S, profile, cutter size). Ranges per common operator guides
export function bitFor(ucs){if(ucs<20)return {type:'PDC',iadc:'M223',desc:'5 blade, 19 mm cutters, soft',life:1800};if(ucs<50)return {type:'PDC',iadc:'M323',desc:'6 blade, 16 mm cutters, soft-medium',life:1400};
 if(ucs<100)return {type:'PDC',iadc:'M433',desc:'7 blade, 13 mm cutters, medium-hard',life:900};if(ucs<170)return {type:'PDC',iadc:'M443',desc:'8-9 blade, 13 mm, hard/abrasive',life:500};return {type:'RC',iadc:'537 / 637',desc:'TCI roller cone or impregnated, very hard',life:250}}
// SIM lithology fallback when the strat model is not loaded
export const SIM_COLUMN=[{top:0,lith:'claystone',ucs:15,phi:.3},{top:300,lith:'sandstone',ucs:30,phi:.24},{top:800,lith:'shale',ucs:40,phi:.08},{top:1400,lith:'siltstone',ucs:55,phi:.12},{top:1900,lith:'limestone',ucs:100,phi:.07},{top:2300,lith:'shale',ucs:50,phi:.06},{top:2600,lith:'sandstone',ucs:60,phi:.18}];
export function simLith(tvd){let r=SIM_COLUMN[0];for(const x of SIM_COLUMN)if(tvd>=x.top)r=x;return {...r,src:'SIM'}}

// ================= VIBRATION / STICK-SLIP =================
// Stick-slip: critical surface speed Omega_c = dT / Z, Z = J*sqrt(G*rho) torsional impedance of the drill pipe (Kyllingstad & Halsey 1988; Dwars 2015)
export function stickSlip({tob=8000,tfric=6000,muRatio=0.25,rpm=120,dp=STRING.at(-1)}){const Z=Jpipe(dp)*Math.sqrt(STEEL.G*STEEL.rho),dT=muRatio*(tob+tfric),wc=dT/Z,nc=wc*60/(2*Math.PI);return {Z,dT,rpmCrit:nc,ssi:nc/Math.max(1,rpm),risk:nc/Math.max(1,rpm)>1?'HIGH':nc/Math.max(1,rpm)>0.7?'MEDIUM':'LOW'}}
// axial (bit bounce) natural freq, fixed-free string f=c/4L; tricone excites 3x RPM. Lateral: pinned-pinned BHA span between stabilizers with mud added mass
export function critRPM({L,span=12,od=6.75,id=2.8,mw=1.2}){const c=Math.sqrt(STEEL.E/STEEL.rho),fa=c/(4*L),I=Math.PI/64*((od*IN)**4-(id*IN)**4),m=STEEL.rho*Math.PI/4*((od*IN)**2-(id*IN)**2)+mw*1000*Math.PI/4*((od*IN)**2)*1.0+mw*1000*Math.PI/4*(id*IN)**2,fl=Math.PI/(2*span*span)*Math.sqrt(STEEL.E*I/m);
 return {axial3x:fa*60/3,axial:fa*60,lateral:fl*60}}

// ================= 4. PHYSICS ENVIRONMENT =================
// overburden (Miller-type bulk density compaction, SIM onshore), pore (hydrostatic + SIM overpressure ramp), Eaton fracture gradient, Kirsch + Mohr-Coulomb collapse
export const ENV={rhoW:1.03,rhoS:1.9,rhoD:2.55,cz:1600,opTop:null,opMax:1.35,nu0:0.25,nu1:0.42,nuZ:3000,sHr:1.10,sHazi:45,phi:30,T0:0,ucsK:1,tSurf:25,grad:30,airGap:0};
export function rhoB(z,E=ENV){return E.rhoS+(E.rhoD-E.rhoS)*(1-Math.exp(-z/E.cz))}
export function obGrad(z,E=ENV){if(z<=0)return E.rhoS;const n=60,h=z/n;let s=0;for(let i=0;i<n;i++)s+=rhoB((i+0.5)*h,E)*h;return s/z} // SG
export function poreGrad(z,E=ENV,td=3000){const top=E.opTop??0.65*td;if(z<=top)return E.rhoW;const f=Math.min(1,(z-top)/Math.max(1,(td-top)*0.6));return E.rhoW+(E.opMax-E.rhoW)*f*f*(3-2*f)}
export function fracGrad(z,E=ENV,td=3000){const ob=obGrad(z,E),pp=poreGrad(z,E,td),nu=E.nu0+(E.nu1-E.nu0)*(1-Math.exp(-z/E.nuZ));return nu/(1-nu)*(ob-pp)+pp}
// stresses (MPa) at depth z; inclined borehole hoop stress (Kirsch, Fjaer et al.); returns collapse MW and breakdown MW (SG) for a hole at inc/azi
export function stability(z,inc,azi,{ucs=40,E=ENV,td=3000}={}){const g=G0*1000*z/1e6,Sv=obGrad(z,E)*g,Pp=poreGrad(z,E,td)*g,Sh=fracGrad(z,E,td)*g,SH=Sh*E.sHr,q=(1+Math.sin(E.phi*D2R))/(1-Math.sin(E.phi*D2R));
 const I=inc*D2R,a=(azi-E.sHazi)*D2R,ca=Math.cos(a),sa=Math.sin(a),ci=Math.cos(I),si=Math.sin(I);
 const sx=(SH*ca*ca+Sh*sa*sa)*ci*ci+Sv*si*si,sy=SH*sa*sa+Sh*ca*ca,sz=(SH*ca*ca+Sh*sa*sa)*si*si+Sv*ci*ci,txy=0.5*(Sh-SH)*Math.sin(2*a)*ci,tyz=0.5*(Sh-SH)*Math.sin(2*a)*si,txz=0.5*(SH*ca*ca+Sh*sa*sa-Sv)*Math.sin(2*I);
 const wall=Pw=>{let worst=-1e9,minT=1e9;for(let k=0;k<36;k++){const th=k*Math.PI/36,c2=Math.cos(2*th),s2=Math.sin(2*th);const st=sx+sy-2*(sx-sy)*c2-4*txy*s2-Pw,sa_=sz-2*STEEL.nu*(sx-sy)*c2-4*STEEL.nu*txy*s2,tz=2*(tyz*Math.cos(th)-txz*Math.sin(th));
   const m=(st+sa_)/2,r=Math.sqrt(((st-sa_)/2)**2+tz*tz),s1=m+r-Pp,s3n=Pw-Pp,s3t=m-r-Pp;const s3=Math.min(s3n,s3t,s1),s1e=Math.max(s1,s3n);worst=Math.max(worst,s1e-(ucs*E.ucsK+q*s3));minT=Math.min(minT,s3t)}return {worst,minT}};
 const sg=P=>P/g;let lo=0,hi=Sv*1.5;if(wall(lo).worst<=0)lo=0;else{for(let k=0;k<50;k++){const m=(lo+hi)/2;wall(m).worst>0?lo=m:hi=m}}const Pc=wall(0).worst<=0?0:hi;
 let blo=Pp,bhi=Sv*2;for(let k=0;k<50;k++){const m=(blo+bhi)/2;wall(m).minT>-E.T0?blo=m:bhi=m}
 return {pore:sg(Pp),collapse:Math.max(sg(Pc),0),frac:sg(Sh),breakdown:sg(blo),ob:sg(Sv),Sv,SH,Sh,Pp}}
export function mwWindow(S,{td,lith=simLith,E=ENV,mw=1.2,ecd=null,step=50}){const rows=[];for(const r of S){if(rows.length&&r.tvd-rows.at(-1).tvd<step&&r!==S.at(-1))continue;const L=lith(r.tvd,r.e,r.n);const s=stability(Math.max(1,r.tvd),r.inc,r.azi,{ucs:L.ucs||40,E,td});
 const lowL=Math.max(s.pore,s.collapse),hiL=Math.min(s.frac,s.breakdown),e=ecd?ecd(r):mw;rows.push({md:r.md,tvd:r.tvd,...s,low:lowL,high:hiL,mw,ecd:e,ok:mw>=lowL&&e<=hiL,lith:L.lith,src:L.src})}return rows}
// circulating temperature: Holmes & Swift (1970) steady counter-flow; formation geothermal, Ramey f(t) via U_a
export function tempProfile({td,tIn=null,q=2200,tSurf=ENV.tSurf,grad=ENV.grad,cp=3800,rho=1200,rp=0.054,rw=0.108,Up=700,Ua=500,n=200,hours=6}){const m=rho*q/60000,mc=m*cp,dz=td/n,Tf=z=>tSurf+grad*z/1000;tIn=tIn??tSurf+5;
 const Ap=2*Math.PI*rp*Up,Aa=2*Math.PI*rw*Ua*Math.min(1,1/Math.log(1+Math.sqrt(hours/6))+0.3);
 // linear system by shooting on Ta at surface: integrate both downward
 const shoot=Ta0=>{let Tp=tIn,Ta=Ta0;const rows=[{z:0,Tp,Ta,Tf:Tf(0)}];for(let i=0;i<n;i++){const z=i*dz;const dTp=Ap*(Ta-Tp)/mc,dTa=(Ap*(Ta-Tp)-Aa*(Tf(z)-Ta))/mc;Tp+=dTp*dz;Ta+=dTa*dz;rows.push({z:z+dz,Tp,Ta,Tf:Tf(z+dz)})}return rows};
 const e=T=>{const r=shoot(T).at(-1);return r.Ta-r.Tp};let a=tIn-50,b=Tf(td)+50;for(let k=0;k<70;k++){const m=(a+b)/2;e(a)*e(m)<=0?b=m:a=m}return {rows:shoot((a+b)/2),bhct:shoot((a+b)/2).at(-1).Tp,bhst:Tf(td),outlet:(a+b)/2}}
// stuck pipe risk per depth (0..1 per mechanism, combined 1-prod(1-r))
export function stuckRisk(S,{win,lith=simLith,mw=1.2,annVel=0.8,staticH=0.5}){return S.filter((r,i)=>i%2==0).map(r=>{const w=win.reduce((b,x)=>Math.abs(x.tvd-r.tvd)<Math.abs(b.tvd-r.tvd)?x:b,win[0]),L=lith(r.tvd,r.e,r.n),perm=(L.phi||0)>0.1?1:0.2;
 const dP=(mw-w.pore)*G0*r.tvd/1000; // MPa
 const diff=clamp(dP/12,0,1)*perm*clamp(0.4+staticH/2,0,1),pack=clamp(Math.exp(-(((r.inc-50)/18)**2))*(1.3-annVel),0,1),geom=clamp((r.dls||0)/8,0,1),inst=mw<w.collapse?clamp((w.collapse-mw)/0.15+0.3,0,1):clamp((w.collapse+0.05-mw)/0.2,0,0.3),loss=mw>w.high?1:0;
 const tot=1-(1-diff)*(1-pack)*(1-geom)*(1-inst)*(1-loss*0.6);return {md:r.md,tvd:r.tvd,diff,pack,geom,inst,loss,tot}})}

// ================= 5. AFE TIME & COST (SIM rates) =================
export const RATES={currency:'USD',spread:52000,dd:9500,mudM3:420,cementM3:600,bitPDC:38000,bitRC:16000,casingM:{'20':520,'13-3/8':260,'9-5/8':165,'7':95,'4-1/2':60},trip:350,conn:0.1,casRun:180,npt:0.12,mob:250000,wh:180000,logging:120000,flat:{bop:12,cement:8,woc:12,log:18}};
export function rng(seed=1){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
export function afe(sections,{R=RATES,n=400,seed=7}={}){const det=r=>{let days=R.mob?2:0,cost=R.mob+R.wh;const rows=[];let tdT=[[0,days]];
 for(const s of sections){const rop=s.rop*(r?Math.exp((r()-0.5)*0.6):1),onB=s.len/rop,conn=s.len/28.5*R.conn,bits=Math.max(1,Math.ceil(s.len/s.bitLife)),trips=bits*2*s.mdBot/R.trip,cas=s.mdBot/R.casRun+6,flat=R.flat.bop+R.flat.cement+R.flat.woc+(s.log?R.flat.log:0);
  let h=onB+conn+trips+cas+flat;const npt=h*R.npt*(r?(0.5+r()*1.5):1);h+=npt;const d=h/24,hv=Math.PI/4*(s.holeIn*IN)**2*s.len;
  const c=d*R.spread+(s.dir?d*R.dd:0)+bits*(s.bitType=='PDC'?R.bitPDC:R.bitRC)+(s.mdBot*(R.casingM[s.csg]||120))+hv*1.8*R.mudM3+hv*0.5*R.cementM3+(s.log?R.logging:0);
  days+=d;cost+=c;rows.push({...s,rop,onB,trips,cas,flat,npt,days:d,cost:c,bits});tdT.push([s.mdBot,days])}return {days,cost,rows,tdT}};
 const base=det(null),r=rng(seed),sims=[];for(let i=0;i<n;i++)sims.push(det(r));const q=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.floor(p*(a.length-1))];
 return {...base,P10:{days:q(sims.map(s=>s.days),.1),cost:q(sims.map(s=>s.cost),.1)},P50:{days:q(sims.map(s=>s.days),.5),cost:q(sims.map(s=>s.cost),.5)},P90:{days:q(sims.map(s=>s.days),.9),cost:q(sims.map(s=>s.cost),.9)},tag:'SIM'}}
