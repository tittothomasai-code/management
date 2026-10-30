// Mud effect on ROP (SIM). Bourgoyne & Young (1974) differential-pressure term x4:
//   f4 = exp(2.303·a4·D·(gp − ρc))  with D in ft, gp pore gradient and ρc mud/ECD in ppg.
// a4 is formation-dependent (BY range ~1e-6..1e-4); 2e-5 used as a SIM default. Underbalance is capped.
// Mud-type factor: OBM gives faster ROP than WBM in shale (less bit balling); 1.10 is a SIM value.
import {window_} from './fluids.js';
export const ROPMUD={a4:2e-5,minF:0.3,maxF:1.3,type:{WBM:1.0,OBM:1.1}};
// refPpg: ROP calibration mud (physics default 10 ppg WBM) -> factor 1, so base play is unchanged.
export function ropMudFactor(mwPpg,tvdFt,type='WBM',porePpg,refPpg){
 if(!(mwPpg>0)||!(tvdFt>0))return 1;
 let gp=porePpg;if(gp==null){const w=window_(tvdFt*0.3048);gp=w.pore*8.345}
 const ref=refPpg??gp,f4=Math.exp(2.303*ROPMUD.a4*tvdFt*(ref-mwPpg)),t=ROPMUD.type[String(type).toUpperCase()]??1;
 return Math.min(ROPMUD.maxF,Math.max(ROPMUD.minF,f4))*t}
