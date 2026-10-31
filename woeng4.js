// woeng4 (helper F, batch6+): squeeze cementing (cement retainer, injection test, hesitation squeeze) and fishing jar impact (stress wave, accelerator, jar window).
// Builds on woeng2 (P&A tests, jarImpact) and woeng3 (cap, balancedPlug). All outputs are SIM teaching values. Sources in docs/squeeze-jar.md. Pure module: no DOM.
import * as W from './woeng2.js';import {cap} from './woeng3.js';
const {G,IN,E_STEEL,RHO_STEEL}=W,PI=Math.PI,C_STEEL=Math.sqrt(E_STEEL/RHO_STEEL); // bar wave speed ≈ 5135 m/s
// ---- squeeze cementing (retainer method, low-pressure hesitation squeeze) ----
export const SQZ={perfTop:2380,perfBase:2395,csgID:6.184,tbgID:2.441,tbgOD:2.875,retainer:2365,fg_sg:1.70,pp_sg:1.15,slurrySG:1.90,dispSG:1.03,
 injQ_m3min:0.16,injP_MPa:6,stageM3:0.16,holdMin:15,thickH:4,margin_MPa:1.4,testMPa:7};
const hyd=(sg,m)=>sg*1000*G*m/1e6;
// injection test: injectivity index II = q / (BHP - Pres). Surface limit for a low-pressure squeeze: frac pressure at perfs minus margin, minus the column hydrostatic.
export function injTest(s=SQZ){const bhp=s.injP_MPa+hyd(s.dispSG,s.perfTop),pres=hyd(s.pp_sg,s.perfTop),II=s.injQ_m3min/Math.max(0.01,bhp-pres);
 const pf=hyd(s.fg_sg,s.perfTop),maxSurf=pf-s.margin_MPa-hyd(s.dispSG,s.perfTop);return {bhp,pres,II,pf,maxSurf,belowFrac:bhp<pf-s.margin_MPa,inject:II>0.005}}
// slurry: casing below retainer to perf base (rat hole) + squeeze volume into perfs (SIM rule: 0.05 m³ per m perforated, ×(1+II factor)) + 20 % excess; tubing to retainer for displacement
export function sqzVolumes(s=SQZ){const T=injTest(s),Lp=s.perfBase-s.perfTop,below=cap(s.csgID)*(s.perfBase-s.retainer),into=Lp*0.05*(1+Math.min(2,T.II*20));
 const Vc=(below+into)*1.2,tbg=cap(s.tbgID)*s.retainer;return {below,into,Vc,tbg,disp:tbg+below*0.0,underDisp:0.16,dispPump:Math.max(0,tbg-0.16)}}
// hesitation schedule: pump stage, hold. Filter cake builds; each stage needs more pressure (SIM: dP rises with cement placed / into-volume). Stop at final squeeze pressure.
export function hesitation(s=SQZ){const T=injTest(s),V=sqzVolumes(s),st=[];let placed=0,t=0,p=s.injP_MPa+hyd(s.dispSG,s.perfTop)-hyd(s.slurrySG,Math.min(s.perfTop,V.Vc/cap(s.tbgID)))*0;
 const pFinal=T.maxSurf;let k=0;while(placed<V.into*1.0001&&k<40){const v=Math.min(s.stageM3,V.into-placed);placed+=v;k++;const frac=placed/V.into;
  const pump=s.injP_MPa*(1+3*frac*frac),hold=pump*(1-0.5*(1-frac));t+=v/s.injQ_m3min+s.holdMin;st.push({n:k,v,placed,pump:Math.min(pump,pFinal),hold:Math.min(hold,pFinal),t});
  if(pump>=pFinal){st[st.length-1].final=true;break}}
 const tot=(V.tbg/s.injQ_m3min+t)/60;return {stages:st,final:st.at(-1),pFinal,totalH:tot,thickOK:tot<=0.75*s.thickH,sim:true}}
export const SQZ_STEPS=['Set cement retainer above perfs','Sting in, pressure test tubing and annulus','Injection test with brine','Mix and pump spacer + cement','Displace to retainer (leave 0.16 m³ in tubing)','Hesitation squeeze in stages','Reach final squeeze pressure, hold 10 min','Sting out, reverse out excess cement','Pull out of hole','Wait on cement','Drill out retainer, pressure test squeeze','Inflow test (negative test)'];
export function sqzJob(s=SQZ){const T=injTest(s),V=sqzVolumes(s),H=hesitation(s),pt=W.pressTest({},0,s.testMPa,0.1);
 const fails=[];if(!T.belowFrac)fails.push('Injection pressure is above frac pressure: lower the rate');if(!T.inject)fails.push('No injection: perfs are plugged, perforate again or wash');if(!H.thickOK)fails.push('Job longer than 75 % of thickening time');
 if(s.retainer>=s.perfTop||s.perfTop-s.retainer>30)fails.push('Set the retainer 5–30 m above the top perf');return {T,V,H,pt,ok:!fails.length,fails,steps:SQZ_STEPS,sim:true}}
// ---- jar impact (stress-wave model) ----
export const JAR={pipeOD:3.5,pipeID:2.764,pipeYieldkN:1200,dcOD:4.75,dcID:2.25,dcLen:90,jarMax_kN:450,accStroke:0.2,depth:2400,stuckAt:2300,mudSG:1.2,mu:0.25};
const area=(od,id)=>PI/4*((od*IN)**2-(id*IN)**2);
// Z = E·A/c (impedance). Released overpull T sends a wave: hammer speed v0 = T / Z_pipe. With accelerator: spring energy ½·T·stroke added: v = √(v0² + T·s/m).
// Peak impact force at anvil ≈ Z_dc · v (limited to collar mass impulse). Impulse ≈ m·v. Free stretch energy from woeng2.jarImpact.
export function jarBlow(overpull_kN=200,acc=true,j=JAR){const Ap=area(j.pipeOD,j.pipeID),Ad=area(j.dcOD,j.dcID),Zp=E_STEEL*Ap/C_STEEL,Zd=E_STEEL*Ad/C_STEEL,m=RHO_STEEL*Ad*j.dcLen;
 const T=overpull_kN*1e3,v0=T/Zp,v=acc?Math.sqrt(v0*v0+T*j.accStroke/m):v0,F=Zd*v,dur=2*j.dcLen/C_STEEL,I=m*v;
 const free=W.jarImpact(overpull_kN,j.stuckAt,j.pipeOD,j.pipeID);return {v,F_kN:F/1000,ratio:F/T,I_kNs:I/1000,dur_ms:dur*1000,mass_t:m/1000,Zp,Zd,stretch_m:free.stretch_m,energy_kJ:free.energy_kJ+(acc?0.5*overpull_kN*j.accStroke:0),acc,sim:true}}
// jar window: string weight above jar (buoyed, vertical SIM) + overpull at surface must stay ≤ 80 % pipe yield; overpull ≤ jar rating; jar must be above stuck point and in tension.
export function jarWindow(overpull_kN=200,j=JAR){const jarAt=j.stuckAt-j.dcLen-10,kgm=area(j.pipeOD,j.pipeID)*RHO_STEEL,bf=1-j.mudSG*1000/RHO_STEEL,wAbove=kgm*G*bf*jarAt/1000*(1+j.mu*0);
 const hook=wAbove+overpull_kN,lim=0.8*j.pipeYieldkN,maxOP=Math.max(0,Math.min(j.jarMax_kN,lim-wAbove));
 return {jarAt,wAbove,hook,lim,maxOP,okYield:hook<=lim,okJar:overpull_kN<=j.jarMax_kN,okPos:jarAt<j.stuckAt,ok:hook<=lim&&overpull_kN<=j.jarMax_kN&&jarAt<j.stuckAt,sim:true}}
export function jarCurve(j=JAR){const p=[];for(let op=25;op<=j.jarMax_kN;op+=25)p.push({op,acc:jarBlow(op,true,j).F_kN,no:jarBlow(op,false,j).F_kN});return p}
