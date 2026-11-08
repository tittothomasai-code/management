// ac.js v5.9.2.3: shared anti-collision (WITSML site view + EDM pad import). Planning-grade SIMPLIFIED uncertainty
// (cone radius = surface error + k * MD, k=0.01 ~ 1 m per 100 m MD, 2-sigma-ish). Not an ISCWSA error model; label it so in the UI.
const R=Math.PI/180;
export function minCurvM(st){const o=[];let ns=0,ew=0,tvd=0;for(let i=0;i<st.length;i++){const s=st[i];if(i){const a=st[i-1],dm=s.md-a.md,i1=a.inc*R,i2=s.inc*R,a1=a.azi*R,a2=s.azi*R;
 const cd=Math.min(1,Math.max(-1,Math.cos(i2-i1)-Math.sin(i1)*Math.sin(i2)*(1-Math.cos(a2-a1)))),dl=Math.acos(cd),rf=dl>1e-9?2/dl*Math.tan(dl/2):1;
 ns+=dm/2*(Math.sin(i1)*Math.cos(a1)+Math.sin(i2)*Math.cos(a2))*rf;ew+=dm/2*(Math.sin(i1)*Math.sin(a1)+Math.sin(i2)*Math.sin(a2))*rf;tvd+=dm/2*(Math.cos(i1)+Math.cos(i2))*rf}
 else{ns=s.ns??0;ew=s.ew??0;tvd=s.tvd??(s.md*Math.cos(s.inc*R))}o.push({md:s.md,inc:s.inc,azi:s.azi,ns,ew,tvd})}return o}
// densify to <= step m
export function dens(p,step=10){const o=[];for(let i=0;i<p.length;i++){if(i){const a=p[i-1],b=p[i],n=Math.max(1,Math.ceil((b.md-a.md)/step));for(let j=1;j<n;j++){const t=j/n;o.push({md:a.md+(b.md-a.md)*t,E:a.E+(b.E-a.E)*t,N:a.N+(b.N-a.N)*t,Z:a.Z+(b.Z-a.Z)*t})}}o.push(p[i])}return o}
export const radius=(md,{k=0.01,r0=1}={})=>r0+k*Math.max(0,md);
// closest approach of reference well A against offset B. SF = ctc / (rA + rB) (simplified separation factor)
export function pair(A,B,opt){const a=dens(A.pts),b=dens(B.pts);let best={ctc:Infinity};for(const p of a){let bj=null,bd=Infinity;for(const q of b){const d=Math.hypot(p.E-q.E,p.N-q.N,p.Z-q.Z);if(d<bd){bd=d;bj=q}}
 if(!bj)continue;const sf=bd/(radius(p.md,opt)+radius(bj.md,opt));if(sf<(best.sf??Infinity))best={ctc:bd,sf,mdRef:p.md,mdOff:bj.md,tvd:p.Z}}
 best.flag=best.sf<1?'STOP <1.0':best.sf<1.5?'WARN <1.5':'ok';return best}
// wellbores of the same well (sidetracks) share hole above the kick-off: not compared against each other
export function matrix(wbs,opt){const n=wbs.length,M=[];for(let i=0;i<n;i++){M[i]=[];for(let j=0;j<n;j++)M[i][j]=i==j||(wbs[i].well!=null&&wbs[i].well==wbs[j].well)||!wbs[i].pts?.length||!wbs[j].pts?.length?null:j<i?M[j][i]:pair(wbs[i],wbs[j],opt)}
 const flags=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const c=M[i][j];if(c&&c.sf<1.5)flags.push({a:i,b:j,...c})}return {M,flags:flags.sort((x,y)=>x.sf-y.sf),model:'simplified cone: r = 1 m + 1% MD (not ISCWSA)'}}
