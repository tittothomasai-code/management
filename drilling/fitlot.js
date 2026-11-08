// v5.13 Drill out the shoe + FIT / LOT (SIM). Pure model, no DOM, no network. SIM teaching model, never LIVE.
// After WOC: drill top plug, bottom plug, float collar, shoe track cement, float shoe, rathole and 3 m new formation.
// Then close the BOP and pump slowly down the drill pipe: pressure rises linearly (mud + system compressibility) until
// the formation starts to take fluid (leak-off). FIT stops at a set test EMW; LOT continues past leak-off, then pump stops (ISIP) and bleeds.
import {G} from './ops3d.js';
export const MUD=1.25,FRAC=1.55,FIT_EMW=1.45,RATE=0.05,COMP=4.5e-7;// SG, SG, SG, m³/min (50 L/min), 1/kPa
export const WOC_H=12,UCS_MAX=24,UCS_TAU=9,UCS_DELAY=3,DRILL_OUT_UCS=3.5;// h, MPa, h, h, MPa (≈500 psi)
// SIM compressive strength of tail slurry vs time after plug bump (MPa)
export const ucs=h=>h<=UCS_DELAY?0:UCS_MAX*(1-Math.exp(-(h-UCS_DELAY)/UCS_TAU));
export const readyAt=()=>UCS_DELAY-UCS_TAU*Math.log(1-DRILL_OUT_UCS/UCS_MAX);
// drill-out items, bottom-up MDs from the casing plan (cement.js plan C)
export function drillOut(C,newHole=3){const fc=C.fc,sh=C.shoe;return [
 {k:'plugs',n:'Top + bottom plug',top:fc-0.8,bot:fc,rop:6,wob:20,rpm:60},
 {k:'fc',n:'Float collar',top:fc,bot:fc+0.5,rop:4,wob:30,rpm:60},
 {k:'track',n:'Shoe track cement',top:fc+0.5,bot:sh-0.6,rop:20,wob:40,rpm:80},
 {k:'shoe',n:'Float shoe',top:sh-0.6,bot:sh,rop:3,wob:30,rpm:60},
 {k:'rat',n:'Rathole',top:sh,bot:sh+1.5,rop:25,wob:40,rpm:100},
 {k:'new',n:'New formation',top:sh+1.5,bot:sh+1.5+newHole,rop:15,wob:60,rpm:120}]}
export function drillTime(items){return items.reduce((a,i)=>a+(i.bot-i.top)/i.rop*60,0)}// minutes
// FIT/LOT: volume pumped (m³) → surface pressure (kPa). sys = volume under pressure (m³).
export function test(C,{mode='LOT',mud=MUD,frac=FRAC,fit=FIT_EMW,sys}={}){const tvd=C.shoeTVD,k=1/(COMP*(sys||C.capC*C.shoe+3)),Plo=(frac-mud)*G*tvd,Pfit=(fit-mud)*G*tvd;
 const pts=[];let p=0,v=0,t=0;const dt=0.05,dv=RATE*dt;let lo=null,stop=null;// t in minutes
 while(t<60){if(mode=='FIT'&&p>=Pfit){stop=stop??{t,v,p};break}if(mode=='LOT'&&lo&&v>=lo.v+0.12){stop={t,v,p};break}
  const leak=p>Plo?Math.min(0.9,(p-Plo)/(0.08*Plo)):0;p+=k*dv*(1-leak);if(!lo&&p>=Plo)lo={t,v,p};v+=dv;t+=dt;pts.push({t,v,p,pump:1})}
 // shut in: FIT holds 10 min with small bleed; LOT instant drop to ISIP then decline
 const isip=mode=='LOT'?Math.max(Plo*0.92,stop.p*0.9):stop.p;for(let s=0.25;s<=10;s+=0.25){const pp=mode=='FIT'?stop.p*(1-0.01*s/10):isip*(0.88+0.12*Math.exp(-s/2.5));pts.push({t:stop.t+s,v:stop.v,p:pp,pump:0})}
 const emw=P=>mud+P/(G*tvd);const end=pts.at(-1);
 return {mode,tvd,mud,k,Plo,Pfit,pts,lo,stop,isip,emwLO:lo?emw(lo.p):null,emwMax:emw(stop.p),emwTest:emw(mode=='FIT'?stop.p:lo.p),held:mode=='FIT'?end.p>=stop.p*0.95:null,
  maasp:(emw(mode=='FIT'?stop.p:lo.p)-mud)*G*tvd,kick:null,
  msg:mode=='FIT'?`FIT to ${fit.toFixed(2)} SG EMW: pressure held ${(end.p/1000).toFixed(2)} MPa for 10 min · test OK`:`LOT: leak-off at ${(lo.p/1000).toFixed(2)} MPa = ${emw(lo.p).toFixed(2)} SG EMW at the shoe`}}
