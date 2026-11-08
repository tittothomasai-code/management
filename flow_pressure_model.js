// The view reads one simulated circuit at a time. No operational feed enters this module.
import * as F from './fluids.js';
import {hydrostaticHeads} from './wellctl.js';
import {annularCapacityM3, uTubeProfile} from './pressure_core.js';

const nonNegative = value => Number.isFinite(value) && value > 0 ? value : 0;
const FT = 0.3048;

export function rigCircuit(rig, fluid) {
  const w=F.clone(fluid?.w || F.defWell());
  const mud=fluid?.mud || F.MUDS.wbm;
  w.md=Math.max(1,nonNegative(rig.md)*FT);
  w.tvd=Math.min(w.md,Math.max(1,nonNegative(rig.pos?.[2] || rig.md)*FT));
  // The fluids panel's dimensions may belong to a separate teaching scenario.
  w.shoeMD=Math.min(w.md*.7,w.shoeMD);
  w.shoeTVD=w.tvd*w.shoeMD/w.md;
  const collar=Math.min(w.md*.1,30),hwdp=Math.min(w.md*.08,25);
  w.string=[
    {n:'Drill pipe',od:5*F.IN,id:4.276*F.IN,len:w.md-collar-hwdp},
    {n:'HWDP',od:5*F.IN,id:3*F.IN,len:hwdp},
    {n:'BHA / collars',od:6.5*F.IN,id:2.8125*F.IN,len:collar},
  ];
  const q=nonNegative(rig.Q)*F.GPM;
  return {w,mud,q,pumpRate:q,returnRate:q,applied:0,mode:q?'Circulating':'Pump off',
    tools:q?{motorDp:nonNegative(rig.dpm)*F.PSI,mwdDp:nonNegative(rig.prof?.xb)*F.PSI}:{motorDp:0,mwdDp:0}};
}

export function wellControlCircuit(wc) {
  const q=nonNegative(wc.Qloop);
  return {w:F.clone(wc.w),mud:{...wc.mud,sg:wc.omw},q,pumpRate:nonNegative(wc.Qin),returnRate:nonNegative(wc.Qout),
    applied:nonNegative(wc.Pc),mode:wc.mode==='shutin'?'Shut in':q?'Circulating through choke':
      wc.Qin>0?'Closed return · charging well':wc.bop?'Pump off · trapped pressure':'Pump off',
    tools:{mwdDp:0},heads:md=>hydrostaticHeads(wc,md)};
}

export function circuitModel(circuit) {
  const {mud,q,w,applied,tools,heads}=circuit;
  const h=F.hydraulics(mud,w,q,tools);
  const area=s=>Math.PI/4*(s.Dh**2-s.od**2);
  const ann=h.annSegs.map(s=>({...s,areaM2:area(s)}));
  const capacity=annularCapacityM3(ann.map(s=>({
    fromM:s.from,toM:s.to,holeDiameterM:s.Dh,pipeOutsideDiameterM:s.od,
  })));
  const annLength=ann.reduce((sum,s)=>sum+s.to-s.from,0);
  const along=(z,parts)=>parts.reduce((sum,s)=>sum+s.dp*Math.max(0,Math.min(1,(z*w.md/w.tvd-s.from)/(s.to-s.from))),0);
  let from=0;
  const string=w.string.map(s=>{const part={from,to:from+s.len,dp:s._g.dpdl*s.len};from+=s.len;return part});
  const zToMd=z=>z*w.md/w.tvd;
  const profile=uTubeProfile({
    tvdM:w.tvd,depthsM:Array.from({length:31},(_,i)=>w.tvd*i/30),
    densityKgM3:F.sg2rho(mud.sg),appliedSurfacePa:applied,
    surfaceLossPa:h.surf,stringLossPa:h.string,annulusLossPa:h.ann,bitLossPa:h.bit,
    motorLossPa:h.motor,mwdLossPa:h.mwd,stringLossAt:z=>along(z,string),annulusLossAt:z=>along(z,ann),
    ...(heads?{stringHydrostaticAt:z=>heads(zToMd(z)).string,annulusHydrostaticAt:z=>heads(zToMd(z)).annulus}:{}),
  });
  return {...circuit,h,profile,ann,capacity,meanAnnularVelocity:capacity?q*annLength/capacity:0,
    nozzleArea:F.nozzleArea(w.nozzles)};
}
