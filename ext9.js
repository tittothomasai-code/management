// ext9.js v4.9: Kalman filter + RTS smoother on gamma boundary crossings → reservoir top/bottom TVD + dip along HL, ±1σ.
// Pure functions (no I/O). Image up/down bins decide which boundary (top vs bottom) a crossing is. Labelled 'Estimated (Kalman, gamma)'.
export const KLABEL='Estimated (Kalman, gamma)';
const R2D=180/Math.PI;
// --- tiny 3x3 linear algebra ---
const mm=(A,B)=>A.map(r=>B[0].map((_,j)=>r.reduce((s,v,k)=>s+v*B[k][j],0)));const tr=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const ad=(A,B)=>A.map((r,i)=>r.map((v,j)=>v+B[i][j]));const sb=(A,B)=>A.map((r,i)=>r.map((v,j)=>v-B[i][j]));const mv=(A,x)=>A.map(r=>r.reduce((s,v,k)=>s+v*x[k],0));
function inv3(m){const[a,b,c]=m[0],[d,e,f]=m[1],[g,h,i]=m[2];const A=e*i-f*h,B=-(d*i-f*g),Cc=d*h-e*g,D=a*A+b*B+c*Cc;if(Math.abs(D)<1e-300)return null;
 return [[A/D,-(b*i-c*h)/D,(b*f-c*e)/D],[B/D,(a*i-c*g)/D,-(a*f-c*d)/D],[Cc/D,-(a*h-b*g)/D,(a*e-b*d)/D]]}
// interpolate md → {hd,tvd} on a curtain [{md,hd,tvd}]
export function mdToCurtain(cu,md){if(!cu.length)return null;let k=cu.findIndex(c=>c.md>=md);if(k<0)return null;if(k==0)return md==cu[0].md?{hd:cu[0].hd,tvd:cu[0].tvd}:null;const a=cu[k-1],b=cu[k],f=(md-a.md)/((b.md-a.md)||1);return {hd:a.hd+(b.hd-a.hd)*f,tvd:a.tvd+(b.tvd-a.tvd)*f}}
// gamma crossings of the cutoff. samples: [{md,hd,tvd,v,up,dn}] sorted by md. Returns crossings with boundary 'top'|'bottom'.
export function findCrossings(S,o={}){const cut=o.cut??75,minRun=o.minRun??1,sm=o.smooth??2;if(S.length<3)return [];
 const v=S.map((s,i)=>{let n=0,t=0;for(let j=Math.max(0,i-sm);j<=Math.min(S.length-1,i+sm);j++)if(isFinite(S[j].v)){t+=S[j].v;n++}return n?t/n:NaN});
 const out=[];let st=null,lastI=0;for(let i=0;i<S.length;i++){if(!isFinite(v[i]))continue;const sand=v[i]<cut;if(st===null){st=sand;lastI=i;continue}
  if(sand!==st){// confirm the new state persists ≥ minRun m (hysteresis against noise)
   let j=i;while(j<S.length&&isFinite(v[j])&&(v[j]<cut)===sand&&S[j].md-S[i].md<minRun)j++;if(j<S.length&&(v[j]<cut)!==sand&&S[j].md-S[i].md<minRun)continue;
   const a=S[i-1],b=S[i],f=(cut-v[i-1])/((v[i]-v[i-1])||1),L=(x,y)=>x+(y-x)*f;const md=L(a.md,b.md),hd=L(a.hd,b.hd),tvd=L(a.tvd,b.tvd);
   // image up/down: mean over ±2 m. Sand above (up low gamma) & shale below ⇒ BOTTOM of reservoir; shale above & sand below ⇒ TOP.
   let up=0,dn=0,n=0;for(const s of S)if(Math.abs(s.md-md)<=2&&isFinite(s.up)&&isFinite(s.dn)){up+=s.up;dn+=s.dn;n++}
   let boundary,by;if(n&&Math.abs(up-dn)/n>(o.imgMin??5)){boundary=up>dn?'top':'bottom';by='image up/down'}
   else{const goingDown=b.tvd>=a.tvd;boundary=(sand===goingDown)?'top':'bottom';by='direction (no image contrast)'}
   out.push({md,hd,tvd,into:sand?'sand':'shale',boundary,by,upMinusDn:n?(up-dn)/n:null});st=sand;lastI=i}}return out}
// Kalman filter + RTS smoother. state x=[zTop, thick, slope] where zTop(hd) TVD of top, bottom=zTop+thick, slope=dTVD/dHD (dip: −atan(slope), + = rises along well).
// Q: slope random-walk spectral density (per m), R: crossing TVD variance (m²). grid: hd values to report.
export function kalman(cr,grid,o={}){const Q=o.Q??1e-6,R=o.R??0.25,th0=o.th0??5,qth=o.qth??Q*10;if(!cr.length)return null;
 const ev=[...cr.map(c=>({hd:c.hd,m:c})),...grid.map(h=>({hd:h,m:null}))].sort((a,b)=>a.hd-b.hd||(a.m?-1:1));
 const t0=cr.find(c=>c.boundary=='top'),b0=cr.find(c=>c.boundary=='bottom');
 let x=[t0?t0.tvd:b0.tvd-th0,t0&&b0?Math.max(0.1,b0.tvd-t0.tvd- (b0.hd-t0.hd)*0):th0,0];if(!t0)x[0]=b0.tvd-th0;
 // propagate the initial top guess back to the first event hd
 let P=[[100,0,0],[0,(t0&&b0)?25:th0*th0,0],[0,0,Math.tan(5/R2D)**2]];let h=Math.min(...cr.map(c=>c.hd));
 // re-reference the initial top estimate to hd0 using slope 0 (big variance covers it)
 const F=[],Pp=[],xp=[],Xf=[],Pf=[],H=[];
 for(const e of ev){const dh=Math.max(0,e.hd-h);const f=[[1,0,dh],[0,1,0],[0,0,1]];const q=[[Q*dh**3/3,0,Q*dh**2/2],[0,qth*dh,0],[Q*dh**2/2,0,Q*dh]];
  const xP=mv(f,x),PP=ad(mm(mm(f,P),tr(f)),q);let xn=xP,Pn=PP;
  if(e.m){const Hm=e.m.boundary=='top'?[1,0,0]:[1,1,0];const y=e.m.tvd-Hm.reduce((s,v,k)=>s+v*xP[k],0);const PH=PP.map(r=>r.reduce((s,v,k)=>s+v*Hm[k],0));const Sv=Hm.reduce((s,v,k)=>s+v*PH[k],0)+R;const K=PH.map(v=>v/Sv);
   xn=xP.map((v,i)=>v+K[i]*y);Pn=PP.map((r,i)=>r.map((v,j)=>v-K[i]*PH[j]));e.innov=y;e.S=Sv}
  F.push(f);xp.push(xP);Pp.push(PP);Xf.push(xn);Pf.push(Pn);x=xn;P=Pn;h=e.hd}
 // RTS smoother
 const Xs=Xf.map(v=>[...v]),Ps=Pf.map(p=>p.map(r=>[...r]));for(let k=ev.length-2;k>=0;k--){const Pi=inv3(Pp[k+1]);if(!Pi)continue;const Cg=mm(mm(Pf[k],tr(F[k+1])),Pi);
  Xs[k]=ad([Xf[k]],[mv(Cg,sb([Xs[k+1]],[xp[k+1]])[0])])[0];Ps[k]=ad(Pf[k],mm(mm(Cg,sb(Ps[k+1],Pp[k+1])),tr(Cg)))}
 const pts=ev.map((e,k)=>{const s=Ps[k],x=Xs[k];return {hd:e.hd,top:x[0],bot:x[0]+x[1],thick:x[1],slope:x[2],dip:-Math.atan(x[2])*R2D,sTop:Math.sqrt(Math.max(0,s[0][0])),sBot:Math.sqrt(Math.max(0,s[0][0]+s[1][1]+2*s[0][1])),sDip:Math.sqrt(Math.max(0,s[2][2]))*R2D,meas:e.m?{boundary:e.m.boundary,tvd:e.m.tvd,innov:e.innov}:null}});
 return {label:KLABEL,grid:pts.filter(p=>!p.meas),at:pts,n:cr.length,nTop:cr.filter(c=>c.boundary=='top').length,nBot:cr.filter(c=>c.boundary=='bottom').length,Q,R}}
export function estAt(K,hd){const g=K.grid;if(!g.length)return null;if(hd<=g[0].hd)return g[0];if(hd>=g.at(-1).hd)return g.at(-1);const k=g.findIndex(p=>p.hd>=hd),a=g[k-1],b=g[k],f=(hd-a.hd)/((b.hd-a.hd)||1);const L=n=>a[n]+(b[n]-a[n])*f;return {hd,top:L('top'),bot:L('bot'),sTop:L('sTop'),sBot:L('sBot'),dip:L('dip')}}
// compare with reference picks (WITSML formation markers): [{name,hd,tvd,boundary}] → residuals, RMS, agreement (|res| ≤ 2σ_total)
export function compareRefs(K,refs,R=0.25){if(!refs||!refs.length)return {none:true,msg:'no reference picks in data'};
 const r=refs.map(p=>{const e=estAt(K,p.hd);const est=p.boundary=='bottom'?e.bot:e.top,s=Math.hypot(p.boundary=='bottom'?e.sBot:e.sTop,Math.sqrt(R));const res=p.tvd-est;return {...p,est,res,sig:s,agree:Math.abs(res)<=2*s}});
 const rms=Math.sqrt(r.reduce((s,x)=>s+x.res*x.res,0)/r.length);return {none:false,picks:r,rms,agree:r.filter(x=>x.agree).length,n:r.length}}
// synthetic benchmark: undulating near-horizontal well through a dipping reservoir; returns RMS of smoothed top/bottom vs truth.
export function synthBench(o={}){const dip=o.dip??1.5,th=o.th??4,top0=o.top0??1000,cut=o.cut??75;let seed=o.seed??7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};const gauss=()=>Math.sqrt(-2*Math.log(rnd()+1e-12))*Math.cos(2*Math.PI*rnd());
 const sl=-Math.tan(dip/R2D),T=hd=>top0+sl*hd+0.6*Math.sin(hd/260),B=hd=>T(hd)+th;const S=[];
 for(let hd=0;hd<=1200;hd+=0.5){const tvd=top0+th/2+sl*hd+(th/2+1.2)*Math.sin(hd/70);const fac=z=>(z>T(hd)&&z<B(hd))?40:115;const v=fac(tvd)+gauss()*6;S.push({md:hd,hd,tvd,v,up:fac(tvd-0.4)+gauss()*4,dn:fac(tvd+0.4)+gauss()*4})}
 const cr=findCrossings(S,{cut});const grid=[];for(let h=0;h<=1200;h+=10)grid.push(h);const K=kalman(cr,grid,{Q:o.Q??1e-7,R:o.R??0.04,th0:th});
 const inner=K.grid.filter(p=>p.hd>=100&&p.hd<=1100);const e=inner.map(p=>[p.top-T(p.hd),p.bot-B(p.hd)]);const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);
 const cov=inner.filter(p=>Math.abs(p.top-T(p.hd))<=p.sTop).length/inner.length;
 const wrong=cr.filter(c=>{const dt=Math.abs(c.tvd-T(c.hd)),db=Math.abs(c.tvd-B(c.hd));return (dt<db?'top':'bottom')!==c.boundary}).length;
 return {n:cr.length,rmsTop:rms(e.map(x=>x[0])),rmsBot:rms(e.map(x=>x[1])),dipEst:inner.reduce((s,p)=>s+p.dip,0)/inner.length,dipTrue:dip,cover1s:cov,misclassified:wrong,K}}
