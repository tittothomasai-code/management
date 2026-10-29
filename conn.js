import * as SL from './slips.js?v=49';
// conn.js v4.5 (slips inferred from bit depth when no slips/hookload curve): connection + joint detection from time-log channels. Pure functions (no DOM) so node can unit-test.
// Rows (SI): {t: seconds, bd: bit depth m, hd: hole depth m|null, bh: block height m|null, hkl: hookload kN|null,
//            rpm, flow: L/min, spp: kPa|null, wob: kN|null, slips: 0/1|null}. Results are ESTIMATES from data.
export const DEFAULTS={flowOffFrac:0.10,rpmOff:5,onBottomTol_m:0.5,slipsMargin_kN:0,minPumpOff_s:45,maxConn_s:3600,minSlips_s:10,minBlockTravel_m:3,resume_s:1800,minNewHole_m:0.3,blockWeight_kN:0};
const q=(a,p)=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.max(0,Math.round(p*(s.length-1))))]:NaN};
export const median=a=>q(a,0.5);
export function classify(len){if(!Number.isFinite(len))return 'unknown';if(len>=8&&len<=11)return 'single';if(len>=17&&len<=20)return 'double';if(len>=25&&len<=31)return 'stand';return 'unknown'}
export function prepare(rows){const r=rows.filter(x=>Number.isFinite(x.t)).sort((a,b)=>a.t-b.t);let mx=-Infinity;
 for(const x of r){if(!Number.isFinite(x.hd)){if(Number.isFinite(x.bd))mx=Math.max(mx,x.bd);x.hd=Number.isFinite(mx)?mx:null}else mx=Math.max(mx,x.hd)}return r}
export function detect(rows0,opt={}){const o={...DEFAULTS,...opt};const R=prepare(rows0.map(x=>({...x})));const n=R.length;
 const res={connections:[],params:o,info:{rows:n}};if(n<5)return res;
 const flowRef=q(R.map(x=>x.flow),0.9),flowThr=Math.max(1,o.flowOffFrac*(flowRef||0));
 const hk=R.map(x=>x.hkl).filter(Number.isFinite),hasHk=hk.length>n*0.5,hasSl=R.some(x=>x.slips===0||x.slips===1),hasBh=R.filter(x=>Number.isFinite(x.bh)).length>n*0.5;
 const bw=o.blockWeight_kN>0?o.blockWeight_kN:q(hk,0.03),hkRange=q(hk,0.97)-bw,margin=o.slipsMargin_kN>0?o.slipsMargin_kN:Math.max(10,0.15*(hkRange||0));
 Object.assign(res.info,{flowRef,flowThr,blockWeight_kN:bw,slipsThr_kN:bw+margin,slipsFrom:hasSl?'slips channel':hasHk&&o.slipsSource!='bitdepth'?'hookload ≤ block weight + margin':SL.LABEL,hasBlock:hasBh});
 const useInf=!hasSl&&(!hasHk||o.slipsSource=='bitdepth');let INF=null,FL=null;
 if(useInf){INF=SL.infer(R,o.slips||{});FL=SL.flags(R,INF);res.inferred=INF.intervals;res.info.inferred=true}
 const inSlips=useInf?(x=>!!FL[R.indexOf(x)]):(x=>hasSl&&(x.slips===0||x.slips===1)?x.slips===1:Number.isFinite(x.hkl)&&x.hkl<=bw+margin);
 const hasFl=R.filter(x=>Number.isFinite(x.flow)).length>n*0.5;
 if(useInf&&!hasFl){for(const v of INF.intervals){if(!v.inSlips||v.kind!='connection')continue;const rr=R.find(x=>x.t>=v.tIn)||R[0];
   res.connections.push({tOff:v.tIn,tOn:v.tOut,pumpOff_s:NaN,tSlipsIn:v.tIn,tSlipsOut:v.tOut,slips_s:v.tOut-v.tIn,duration_s:v.tOut-v.tIn,depth_m:v.hd,bitDepth_m:v.bd,inferred:true,confidence:v.conf,label:SL.LABEL})}}
 const off=x=>!(x.flow>flowThr);let i=useInf&&!hasFl?n:0;
 while(i<n){if(!off(R[i])){i++;continue}let j=i;while(j+1<n&&off(R[j+1]))j++;const a=R[i],b=R[j],dur=b.t-a.t;const nx=R[Math.min(n-1,j+1)];
  const rec={tOff:a.t,tOn:nx.t,pumpOff_s:nx.t-a.t};const ia=i;i=j+1;
  if(rec.pumpOff_s<o.minPumpOff_s||rec.pumpOff_s>o.maxConn_s){continue}
  const seg=R.slice(ia,j+1);
  if(!seg.some(x=>(x.rpm??0)<o.rpmOff))continue;
  if(!seg.some(x=>Number.isFinite(x.hd)&&Number.isFinite(x.bd)&&x.hd-x.bd>o.onBottomTol_m))continue;// bit off bottom
  // longest in-slips run
  let best=null,s0=null;for(let k=0;k<seg.length;k++){const on=inSlips(seg[k]);if(on&&s0==null)s0=k;if((!on||k==seg.length-1)&&s0!=null){const e=on?k:k-1;if(!best||seg[e].t-seg[s0].t>best[2])best=[s0,e,seg[e].t-seg[s0].t];s0=null}}
  if(!best||best[2]<o.minSlips_s)continue;
  const sIn=seg[best[0]],sOut=seg[best[1]];
  if(hasBh){const bh0=sIn.bh,bhMax=Math.max(...seg.slice(best[0],best[1]+1).map(x=>x.bh).filter(Number.isFinite));if(!(bhMax-bh0>=o.minBlockTravel_m))continue;rec.blockTravel_m=bhMax-bh0}
  const hd0=sIn.hd;let resumed=null;for(let k=j+1;k<n&&R[k].t-b.t<=o.resume_s;k++){if(R[k].hd-hd0>=o.minNewHole_m&&R[k].flow>flowThr&&(R[k].rpm??1)>=o.rpmOff){resumed=R[k];break}}
  if(!resumed)continue;
    Object.assign(rec,{tSlipsIn:sIn.t,tSlipsOut:(seg[best[1]+1]||nx).t,depth_m:hd0,bitDepth_m:sIn.bd,tResume:resumed.t});rec.slips_s=rec.tSlipsOut-rec.tSlipsIn;if(useInf){const v=FL[R.indexOf(sIn)];rec.inferred=true;rec.confidence=v?.conf;rec.label=SL.LABEL}rec.duration_s=rec.slips_s;
  res.connections.push(rec)}
 const C=res.connections;C.forEach((c,k)=>{c.n=k+1;c.length_m=k?c.depth_m-C[k-1].depth_m:null});
 const lens=C.slice(1).map(c=>c.length_m).filter(x=>x>0.5);const ml=median(lens);
 res.kpi={connections:C.length,avgConn_s:C.length?C.reduce((s,c)=>s+c.duration_s,0)/C.length:null,medianLen_m:Number.isFinite(ml)?ml:null,avgLen_m:lens.length?lens.reduce((s,x)=>s+x,0)/lens.length:null,mode:classify(ml)};
 const last=R.at(-1);res.bitDepthNow_m=Number.isFinite(last.bd)?last.bd:last.hd;res.holeDepthNow_m=last.hd;
 res.toolJoints=toolJoints(C,res.bitDepthNow_m,res.kpi.medianLen_m);return res}
// Tool-joint depths along the string at the current bit depth (m from rotary table). Connection k's joint top was at the
// rotary table when the bit was at depth_m(k); it has since moved down by (bitNow - depth_m(k)). Older joints (before the data) are
// extrapolated every median length down to the bit and flagged extrapolated.
export function toolJoints(C,bitNow,len){const out=[];if(!Number.isFinite(bitNow))return out;
 for(const c of C){const d=bitNow-c.depth_m;if(d>=0&&d<=bitNow)out.push({depth_m:d,fromConn:c.n,extrapolated:false})}
 if(len>1&&C.length){let d=bitNow-C[0].depth_m+len,guard=0;while(d<bitNow&&guard++<5000){out.push({depth_m:d,fromConn:null,extrapolated:true});d+=len}}
 out.sort((a,b)=>a.depth_m-b.depth_m);out.forEach((j,k)=>j.joint=k+1);return out}
export function toCSV(res,fmtT=t=>t){const inf=res.info?.inferred;const h='n,slips_in,slips_out,pumps_off,pumps_on,duration_s,pump_off_s,hole_depth_m,bit_depth_m,length_m,block_travel_m'+(inf?',slips_confidence,slips_source':'');
 return '# Connections — Estimated from data (Drilling World v4.5). Mode: '+(res.kpi?.mode||'?')+'\n'+h+'\n'+res.connections.map(c=>[c.n,fmtT(c.tSlipsIn),fmtT(c.tSlipsOut),fmtT(c.tOff),fmtT(c.tOn),c.duration_s.toFixed(0),(Number.isFinite(c.pumpOff_s)?c.pumpOff_s.toFixed(0):''),c.depth_m.toFixed(2),c.bitDepth_m?.toFixed(2)??'',c.length_m==null?'':c.length_m.toFixed(2),c.blockTravel_m?.toFixed(2)??''].concat(inf?[c.confidence??'',SL.LABEL]:[]).join(',')).join('\n')+'\n'}
// ---- synthetic generator (SIM-TEST) with known connections; used by unit tests and the in-game SIM-TEST button ----
export function synth({joints=6,len=9.4,start_m=1500,dt=5,rop_mh=30,conn_s=240,pumpBlip_at=null,pumpBlip_s=30,stand=false,noBlock=false,withSlips=false}={}){
 const L=stand?28.2:len,rows=[],truth=[];let t=0,hd=start_m,bd=start_m;const BW=180,ST=900,FL=2800,RPM=120;
 const push=(o)=>rows.push({t,bd,hd,bh:o.bh,hkl:o.hkl,rpm:o.rpm,flow:o.flow,spp:o.flow>0?18000:300,wob:o.wob,slips:withSlips?(o.sl?1:0):null});
 for(let j=0;j<joints;j++){// drill one joint/stand
  const t0=t,drill_s=L/(rop_mh/3600);for(let s=0;s<drill_s;s+=dt){const f=s/drill_s;hd=Math.max(hd,start_m+j*L+L*f);bd=hd;
    const blip=pumpBlip_at!=null&&j==pumpBlip_at&&s>drill_s*0.5&&s<drill_s*0.5+pumpBlip_s;push({bh:noBlock?null:30-27*f,hkl:ST-80,rpm:blip?0:RPM,flow:blip?0:FL,wob:80});t+=dt}
  hd=start_m+(j+1)*L;bd=hd;
  // connection: off bottom, pumps off, rpm 0, slips (hookload -> block weight), block travels up, pumps+rpm on, back to drilling
  const c0=t;const ph=[[30,{bh:3.5,hkl:ST,rpm:60,flow:FL,wob:0,pick:1}],[20,{bh:4,hkl:ST,rpm:0,flow:0,wob:0}],[conn_s,{bh:'up',hkl:BW,rpm:0,flow:0,wob:0,sl:1}],[20,{bh:30,hkl:ST,rpm:0,flow:0,wob:0}],[40,{bh:30,hkl:ST,rpm:RPM,flow:FL,wob:0}]];
  let sIn=null,sOut=null;for(const [d,o] of ph){for(let s=0;s<d;s+=dt){if(o.pick)bd=hd-Math.min(1.5,s*0.1);else if(o.sl||o.bh===30)bd=hd-1.5;const oo={...o};if(o.bh=='up')oo.bh=4+26*Math.min(1,s/(d*0.6));if(noBlock)oo.bh=null;if(o.sl&&sIn==null)sIn=t;if(o.sl)sOut=t;push(oo);t+=dt}}
  truth.push({depth_m:hd,tSlipsIn:sIn,tSlipsOut:sOut+dt});bd=hd}
 for(let s=0;s<120;s+=dt){hd+=rop_mh/3600*dt;bd=hd;push({bh:20,hkl:ST-80,rpm:RPM,flow:FL,wob:80});t+=dt}
 return {rows,truth,label:'SIM-TEST synthetic time log'}}
