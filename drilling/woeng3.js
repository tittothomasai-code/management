// woeng3 (helper F, batch6): deeper coiled tubing (string fatigue map, weight indicator RIH/POOH), fishing (stuck point, overshot/grapple, washover)
// and P&A balanced cement plug sequence. All outputs are SIM teaching values. Sources in docs/workover3.md. Pure module: no DOM.
import * as W from './woeng2.js';
const {G,IN,E_STEEL,RHO_STEEL}=W,BF=sg=>1-sg*1000/RHO_STEEL,PI=Math.PI;
// ---- CT string fatigue map: damage per segment along the string (0 m = CT tip). Each trip: the run length passes reel + gooseneck,
// 6 bending events per round trip (2 reel, 4 gooseneck), same counts as woeng2.ctFatigue2. Wiper cycles at depth add cycles only to the part on the gooseneck.
export function fatigueMap(jobs,c=W.CT2,seg=50){const n=Math.ceil(c.len/seg),D=new Array(n).fill(0);
 for(const j of jobs){const F=W.ctFatigue2(1,j.p??10,c),dr=2/F.Nreel,dg=4/F.Ngoose,rep=j.trips??1;
  for(let i=0;i<n;i++){const x=i*seg;if(x<=j.depth)D[i]+=rep*(dr+dg)}// segment x from tip goes into the well when depth >= x
  for(const wp of j.wipers||[]){// wiper: CT moved up and down between from..to (MD of tip): segments at the gooseneck are tip offsets (depth range)
   for(let i=0;i<n;i++){const x=i*seg;if(x>=wp.from&&x<=wp.to)D[i]+=rep*(wp.n||1)*dg}}}
 const max=Math.max(...D),imax=D.indexOf(max);let cut=0;for(let i=0;i<n&&D[i]>=0.8;i++)cut=(i+1)*seg;// cut the damaged tip part if over 80 %
 return {seg,D:D.map(d=>Math.min(1.5,d)),maxPct:max*100,atM:imax*seg,retire:max>=0.8,cutTipM:cut,lenAfterCut:c.len-cut,sim:true}}
// ---- weight indicator: surface load (kN) vs depth, RIH (woeng2.rih, buckling + Mitchell contact) and POOH (soft-string, drag adds) ----
export function pooh(depth,w=W.CTWELL,c=W.CT2,ds=5){const wb=c.kgm*G*BF(w.brineSG);let F=0;for(let s=depth;s>0;s-=ds){const th=W.incAt(s,w)*PI/180;F+=wb*Math.cos(th)*ds+w.mu*wb*Math.sin(th)*ds}
 const Ao=PI/4*(c.od*IN)**2;return {surf_kN:(F-w.whpMPa*1e6*Ao)/1000,overPull:(F-w.whpMPa*1e6*Ao)/1000>c.inj.maxPull_kN}}
export function weightChart(w=W.CTWELL,c=W.CT2,step=100){const L=W.lockup(w,c),pts=[];for(let d=step;d<=w.td;d+=step){const r=W.rih(d,w,c),p=pooh(d,w,c);pts.push({md:d,rih:d<=L.md?r.surf_kN:null,pooh:p.surf_kN})}
 const free=pts.map(q=>({md:q.md,f:W.rih(q.md,{...w,mu:0},c).surf_kN}));return {pts,free,lock:L,maxPull:c.inj.maxPull_kN,maxSnub:-c.inj.maxSnub_kN,sim:true}}
// ---- fishing: stuck (free) point from stretch, Hooke: L = E A dL / dF ----
export const PIPES={'2-7/8 in 6.5 lb/ft tubing':{od:2.875,id:2.441},'3-1/2 in 9.3 lb/ft tubing':{od:3.5,id:2.992},'1-3/4 in CT':{od:1.75,id:1.482},'5 in 19.5 lb/ft DP':{od:5,id:4.276}};
export function stuckPoint(pipe,stretchMM,dPull_kN){const p=PIPES[pipe]||pipe,A=PI/4*((p.od*IN)**2-(p.id*IN)**2),L=E_STEEL*A*(stretchMM/1000)/(dPull_kN*1000);return {freeM:L,A_cm2:A*1e4,sim:true}}
// overshot + grapple selection: spiral grapple catches up to the overshot max spiral catch, basket grapple for larger fish to max basket catch (SIM catalogue values)
export const OVERSHOTS=[{id:'OS-375',od:3.75,maxSpiral:2.875,maxBasket:2.375},{id:'OS-4625',od:4.625,maxSpiral:3.75,maxBasket:3.0625},{id:'OS-5750',od:5.75,maxSpiral:4.75,maxBasket:4.0},{id:'OS-8125',od:8.125,maxSpiral:6.625,maxBasket:5.875}];
export function overshot(fishOD,holeID,clear=0.25){const fit=OVERSHOTS.filter(o=>o.od<=holeID-clear);for(const o of fit){if(fishOD<=o.maxBasket)return {...o,grapple:'basket',size:fishOD,ok:true}
 if(fishOD<=o.maxSpiral)return {...o,grapple:'spiral',size:fishOD,ok:true}}return {ok:false,why:fit.length?'fish too large for any overshot that fits the hole: use a spear or wash over':'no overshot fits the hole'}}
export const WASHPIPE=[{id:'WP-3.75',od:3.75,id_in:3.25},{id:'WP-4.5',od:4.5,id_in:3.958},{id:'WP-5.75',od:5.75,id_in:5.0},{id:'WP-8.125',od:8.125,id_in:7.25}];
export function washover(fishOD,holeID){const w=WASHPIPE.filter(p=>p.od<=holeID-0.5&&p.id_in>=fishOD+0.125);return w.length?{...w[w.length-1],ok:true,ann_in:(holeID-w.at(-1).od)/2}:{ok:false,why:'no wash pipe fits between fish and hole'}}
// ---- P&A balanced cement plug (pipe in the plug, tail at plug base). Capacities m3/m. ----
export const cap=d=>PI/4*(d*IN)**2;
export function balancedPlug({base=2430,len=150,holeID=6.184,pipeOD=2.875,pipeID=2.441,spAhead=1.6,excess=0.1,pullAbove=60,pooh_mpm=9,woc_h=12,tagT=5,testBar=70}={}){
 const Ch=cap(holeID),Cp=cap(pipeID),Ca=Ch-cap(pipeOD),Vc=len*Ch*(1+excess),H=Vc/(Ca+Cp),spBehind=spAhead*Cp/Ca,Hsp=spAhead/Ca,top=base-H,// displacement leaves cement + spacer balanced
  disp=Cp*(base-H)-spBehind,afterPull=top-pullAbove,steps=[
  {n:1,id:'rih',t:'Run in hole with open-ended pipe to plug base',md:base,v:0,h:base/1000/0.5},
  {n:2,id:'circ',t:'Circulate bottoms up, condition fluid',v:Ch*base,h:1.5},
  {n:3,id:'spA',t:`Pump spacer ahead ${spAhead.toFixed(1)} m³`,v:spAhead,h:0.3},
  {n:4,id:'cmt',t:`Pump cement ${Vc.toFixed(2)} m³ (${(excess*100).toFixed(0)} % excess)`,v:Vc,h:0.6},
  {n:5,id:'spB',t:`Pump spacer behind ${spBehind.toFixed(2)} m³ (balance)`,v:spBehind,h:0.1},
  {n:6,id:'disp',t:`Displace ${disp.toFixed(2)} m³ (under-displace slightly, let it U-tube)`,v:disp,h:0.8},
  {n:7,id:'pooh',t:`Pull out slowly (${pooh_mpm} m/min) to ${afterPull.toFixed(0)} m, ${pullAbove} m above plug top`,md:afterPull,h:(base-afterPull)/pooh_mpm/60},
  {n:8,id:'rev',t:'Reverse circulate pipe clean',v:Cp*afterPull*1.5,h:0.7},
  {n:9,id:'woc',t:`Wait on cement ${woc_h} h`,h:woc_h},
  {n:10,id:'tag',t:`Tag plug top with ${tagT} t, compare with ${top.toFixed(0)} m`,h:1},
  {n:11,id:'test',t:`Pressure test ${testBar} bar for 15 min`,h:0.5}];
 let cum=0;for(const s of steps){cum+=s.h;s.cum=cum}
 return {Ch,Cp,Ca,Vc,H,top,spBehind,Hsp,disp,afterPull,steps,totalH:cum,lenOK:H>=W.PA_RULES.csgPlug,sim:true}}
// fluid columns (top,base,type) in annulus and pipe after step i, for the schematic
export function plugState(P,i,base=2430){const st=P.steps[i]?.id,A=[],Pp=[];const top=P.top,spT=top-P.Hsp;
 const pipeEnd=['pooh','rev','woc','tag','test'].includes(st)?P.afterPull:base;
 if(['cmt','spB','disp','pooh','rev','woc','tag','test'].includes(st)){const done=st!='cmt';
  if(done){A.push({top,base,f:'cement'},{top:spT,base:top,f:'spacer'});if(st=='spB'){Pp.push({top:base-P.H-P.spBehind/P.Cp,base,f:'cement'})}else if(st=='disp')Pp.push({top:top-P.spBehind/P.Cp,base:top,f:'spacer'},{top,base,f:'cement'})}
  else Pp.push({top:base-P.Vc/P.Cp,base,f:'cement'})}
 if(st=='spA')Pp.push({top:base-1.6/P.Cp,base,f:'spacer'});
 return {pipeEnd,ann:A,pipe:Pp,set:['woc','tag','test'].includes(st)}}
