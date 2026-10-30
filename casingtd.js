// Torque and drag while running casing (SIM). Johancsik, Friesen & Dawson (1984) soft-string model, SPE 11380:
//   N = sqrt((F·Δα·sin Ī)² + (F·ΔI + Wb·ΔL·sin Ī)²)   side force per element
//   F_top = F_bot + Wb·ΔL·cos Ī ± μ·N   (+ pick-up, − slack-off)      ΔT = μ·N·r (rotating)
// Wb = buoyed weight per m (BF = 1 − ρmud/ρsteel). Cased-hole and open-hole friction factors (typical 0.20 / 0.30, SIM).
export const TD={muCH:0.20,muOH:0.30,step:10,block:30,steelSG:7.85};
const G=9.80665;
function dirAt(w,md){const a=w.at(Math.max(0,md-1)),b=w.at(md+1),dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];return {inc:Math.atan2(Math.hypot(dx,dy),dz),azi:Math.atan2(dx,dy)}}
// w: ops3d well() (at(md)->[E,N,TVD]); shoeMD: casing shoe depth now; o: {kgm, mudSG, odM, prevShoeMD, muCH, muOH}
export function casingTD(w,shoeMD,o={}){const mudSG=o.mudSG??1.2,BF=1-mudSG/TD.steelSG,Wb=(o.kgm||70)*G*BF/1000,r=(o.odM||0.2445)/2,prev=o.prevShoeMD??0,
 muCH=o.muCH??TD.muCH,muOH=o.muOH??TD.muOH,n=Math.max(1,Math.ceil(shoeMD/TD.step)),dl=shoeMD/n;
 let pu=0,so=0,rot=0,tq=0,minSO=Infinity,nMax=0;// integrate from shoe (bottom) up
 for(let k=n;k>=1;k--){const md1=k*dl,md0=md1-dl,a=dirAt(w,md0),b=dirAt(w,md1),Im=(a.inc+b.inc)/2,dI=b.inc-a.inc;let dA=b.azi-a.azi;if(dA>Math.PI)dA-=2*Math.PI;if(dA<-Math.PI)dA+=2*Math.PI;if(Im<0.02)dA=0;
  const mu=(md0+md1)/2<prev?muCH:muOH,ax=Wb*dl*Math.cos(Im),side=F=>Math.hypot(F*dA*Math.sin(Im),F*dI+Wb*dl*Math.sin(Im)),
   Np=side(pu),Ns=side(so),Nr=side(rot);
  pu+=ax+mu*Np;so+=ax-mu*Ns;rot+=ax;tq+=mu*Nr*r;minSO=Math.min(minSO,so);nMax=Math.max(nMax,Nr/dl)}
 return {pu:pu+TD.block,so:Math.max(TD.block,so+TD.block),rot:rot+TD.block,torque:tq,stuckSO:minSO<0,sideMax:nMax,muCH,muOH,src:'SIM'}}
// broomstick chart: hookload vs shoe depth for several friction factors (planning view)
export function broomstick(w,shoeMD,o={},mus=[0.1,0.2,0.3,0.4],step=50){const out=[];for(let md=step;md<=shoeMD;md+=step){const row={md};for(const m of mus){const r=casingTD(w,md,{...o,muCH:m,muOH:m});row['pu'+m]=r.pu;row['so'+m]=r.so}row.rot=casingTD(w,md,o).rot;out.push(row)}return out}
