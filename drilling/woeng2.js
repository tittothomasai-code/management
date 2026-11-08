// woeng2 (helper F, workover2): deeper coiled tubing, fishing and P&A engineering. All outputs are SIM teaching values.
// Sources in docs/workover2.md. Pure module: no DOM, safe to import from node tests.
import * as F from './fluids.js';
export const G=9.80665,IN=0.0254,E_STEEL=207e9,RHO_STEEL=7850,PSI=6894.757;
const BF=sg=>1-sg*1000/RHO_STEEL;
// ---- coiled tubing string, reel and injector (SIM) ----
export const CT2={od:1.75,wall:0.134,yieldMPa:552,kgm:3.15,reelCoreR:1.22,gooseR:2.44,inj:{maxPull_kN:356,maxSnub_kN:178},len:5600};
export const CTWELL={name:'SIM well WO-1',kop:1200,build:3,incMax:90,td:5200,tbgID:2.992,csgID:6.184,whpMPa:8,brineSG:1.03,mu:0.25};
export function ctProps(c=CT2){const ro=c.od*IN/2,ri=ro-c.wall*IN,A=Math.PI*(ro*ro-ri*ri),I=Math.PI/4*(ro**4-ri**4);return {ro,ri,A,I,EI:E_STEEL*I,idM:2*ri}}
// bending strain on reel and gooseneck: eps = r_o / R (plastic when eps > yield strain ~0.27 %)
export function bendStrain(c=CT2){const ro=c.od*IN/2,ey=c.yieldMPa*1e6/E_STEEL;return {reel:ro/c.reelCoreR,goose:ro/c.gooseR,yield:ey,plastic:ro/c.reelCoreR>ey}}
// low-cycle fatigue: Coffin-Manson type strain-life, with internal pressure derating (Newman/Tipton trend: more pressure, fewer cycles).
// One trip in + out = 6 bend events (reel off/on, gooseneck on/off x2: bend+straighten each counted in pairs -> 3 per direction).
export function ctFatigue2(trips=1,pMPa=10,c=CT2){const s=bendStrain(c);
 const pb=2*c.yieldMPa*c.wall/c.od,kp=Math.max(0.15,1-0.7*pMPa/pb),N=e=>kp*0.265*Math.pow(e,-2); // Coffin-Manson plastic term N ∝ eps^-2, tuned: 1.75 in on 48 in reel ≈ 800 cycles at 0 MPa (SIM)
 const Nr=Math.max(20,N(s.reel)),Ng=Math.max(20,N(s.goose));
 const perTrip=2/Nr+4/Ng,used=trips*perTrip;return {cyclesPerTrip:6,Nreel:Nr,Ngoose:Ng,damage:used,lifeUsedPct:Math.min(100,used*100),tripsLeft:Math.max(0,Math.floor((1-used)/perTrip)),retire:used>=0.8,sim:true}}
// buckling: Dawson-Paslay sinusoidal (inclined), helical = sqrt(2) x sinusoidal (Chen-Cheatham). Vertical: Lubinski 2.55 (EI w^2)^(1/3) helical.
export function buckling(incDeg,w=CTWELL,c=CT2){const p=ctProps(c),wb=c.kgm*G*BF(w.brineSG),r=(w.tbgID*IN-c.od*IN)/2,th=incDeg*Math.PI/180;
 if(incDeg<5){const fs=1.94*Math.cbrt(p.EI*wb*wb);return {sin:fs,hel:2.55*Math.cbrt(p.EI*wb*wb),r,wb}}
 const fs=2*Math.sqrt(p.EI*wb*Math.sin(th)/r);return {sin:fs,hel:Math.SQRT2*fs,r,wb}}
// well survey (SIM): vertical to KOP, build at b deg/30 m to incMax, then tangent
export function incAt(md,w=CTWELL){if(md<=w.kop)return 0;return Math.min(w.incMax,(md-w.kop)*w.build/30)}
// RIH force along string, tip to surface (soft-string + helical contact force, Mitchell wc = r F^2/(4EI)). Compression negative.
export function rih(depth,w=CTWELL,c=CT2,ds=5){const p=ctProps(c),wb=c.kgm*G*BF(w.brineSG);let F=0,lock=false;
 for(let s=depth;s>0;s-=ds){const inc=incAt(s,w),th=inc*Math.PI/180,b=buckling(inc,w,c);const comp=Math.max(0,-F);
  const wc=comp>b.hel?b.r*comp*comp/(4*p.EI):0;const drag=w.mu*(wb*Math.sin(th)+wc);F+=wb*Math.cos(th)*ds-drag*ds;
  if(-F>c.inj.maxSnub_kN*1000*4||(wc>0&&w.mu*wc>wb*Math.cos(th)+wb*2&&-F>b.hel*3)){lock=true;break}}
 const Ao=Math.PI/4*(c.od*IN)**2,surf=F-w.whpMPa*1e6*Ao;return {surf_kN:surf/1000,lock,needSnub:surf<0,overSnub:-surf/1000>c.inj.maxSnub_kN}}
// lock-up depth: deepest MD the injector can push the CT to (bisection on rih)
export function lockup(w=CTWELL,c=CT2){let lo=w.kop,hi=w.td;if(!rih(hi,w,c).overSnub&&!rih(hi,w,c).lock)return {md:w.td,reachTD:true};
 for(let i=0;i<40;i++){const m=(lo+hi)/2,r=rih(m,w,c);(r.overSnub||r.lock)?hi=m:lo=m}return {md:lo,reachTD:false}}
// circulating pressure through CT (reel + well length) and CT x tubing annulus, via fluids.js API RP 13D gradients
export const BRINE={id:'brine',name:'KCl brine (SIM)',type:'WBM',sg:1.03,fann:{600:12,300:7,200:5,100:3.5,6:1,3:0.8},gel10s:1,gel10m:1};
export function ctCirc(Qlpm=160,depth=3000,w=CTWELL,c=CT2,m=BRINE){const p=ctProps(c),Q=Qlpm/60000,onReel=c.len-depth;
 const gi=F.gradient(m,Q,p.idM),ga=F.gradient(m,Q,w.tbgID*IN,c.od*IN,false);const dpCT=gi.dpdl*(depth+onReel),dpAnn=ga.dpdl*depth,nozz=1.5e6*(Qlpm/160)**2;
 return {pump_MPa:(dpCT+dpAnn+nozz)/1e6+w.whpMPa,ct_MPa:dpCT/1e6,ann_MPa:dpAnn/1e6,tool_MPa:nozz/1e6,regCT:gi.reg,regAnn:ga.reg,vAnn:ga.V,limitOK:(dpCT+dpAnn+nozz)/1e6+w.whpMPa<0.8*2*c.yieldMPa*c.wall/c.od}}
// ---- fishing ----
export const FISH_TOOLS={overshot:'Overshot with spiral grapple (catches fish OD)',spear:'Releasing spear (catches fish ID)',taper:'Taper tap (cuts thread in fish ID)',
 die:'Die collar (cuts thread on fish OD)',mill:'Junk mill / magnet (junk, no catch surface)',wash:'Washover pipe + shoe (fill around fish)',jar:'Hydraulic jar + accelerator (stuck fish)'};
export function fishTool({topCondition='clean',hasID=true,odOK=true,stuck=false,junk=false}={}){const t=[];if(junk)t.push('mill');
 else if(topCondition=='clean'&&odOK)t.push('overshot');else if(hasID)t.push(topCondition=='split'?'taper':'spear');else t.push('die');
 if(stuck){t.push('wash','jar')}return t.map(k=>({k,name:FISH_TOOLS[k]}))}
// economic fishing time (Keller/Gatlin rule): D_max = (V + Cs) / (Rf + Cf); fish if expected fishing days < D_max, else sidetrack
export function fishEcon({fishValue=180e3,sidetrackCost=1.6e6,rigRate=95e3,toolDay=12e3,pSuccess=0.6,estDays=4}={}){const Dmax=(fishValue+sidetrackCost)/(rigRate+toolDay);
 const costFish=estDays*(rigRate+toolDay)+(1-pSuccess)*sidetrackCost,costST=sidetrackCost+fishValue;return {Dmax,costFish,costST,decision:estDays<Dmax&&costFish<costST?'fish':'sidetrack',sim:true}}
// jar impact (simple): overpull above string weight at jar x free-length stretch energy
export function jarImpact(overpull_kN=180,L=2000,od=2.875,id=2.441){const A=Math.PI/4*((od*IN)**2-(id*IN)**2),dL=overpull_kN*1e3*L/(E_STEEL*A);return {stretch_m:dL,energy_kJ:0.5*overpull_kN*dL}}
// ---- P&A (NORSOK D-010 rev 4/5 + Energy UK / O&GUK Guidelines issue 7) ----
export const PA_RULES={csgPlug:50,ohPlug:100,ohAboveSource:50,ukMinFt:100,tagkN:[45,70],testAboveInj_MPa:3.5};
export const PA_WELL={reservoir:{top:2450,base:2560,pp_sg:1.18},shallowGas:{top:520,pp_sg:1.05},csgShoe:2590,prodCsg:'7 in',tocProd:1800,intShoe:1350,surfShoe:600,fg:[[600,1.55],[1350,1.70],[2590,1.85]]};
export function paPlan(w=PA_WELL){return [
 {id:'P1',role:'Primary (reservoir)',top:w.reservoir.top-150,base:w.reservoir.top-20,where:'cased',source:'reservoir'},
 {id:'P2',role:'Secondary (reservoir)',top:w.tocProd+50,base:w.tocProd+200,where:'cased',source:'reservoir'},
 {id:'P3',role:'Open hole to surface / shallow gas',top:w.surfShoe-180,base:w.shallowGas.top+60,where:'cased',source:'shallow gas'},
 {id:'P4',role:'Surface plug',top:3,base:80,where:'cased',source:'environment'}]}
// barrier checks: length >= 50 m MD (cased) / 100 m OH with 50 m above source, base at or above formation strong enough (FG at plug base > PP of source + margin)
export function fgAt(tvd,w=PA_WELL){let f=w.fg[0][1];for(const [d,g] of w.fg)if(tvd>=d)f=g;return f}
export function checkPlug(p,w=PA_WELL){const L=p.base-p.top,min=p.where=='oh'?PA_RULES.ohPlug:PA_RULES.csgPlug,src=p.source=='reservoir'?w.reservoir.pp_sg:p.source=='shallow gas'?w.shallowGas.pp_sg:1.0;
 const lenOK=L>=min&&L*3.281>=PA_RULES.ukMinFt,fg=fgAt(p.base,w),fgOK=p.source=='environment'||fg>src+0.05;
 return {...p,L,lenOK,fg,src,fgOK,ok:lenOK&&fgOK,why:!lenOK?`Plug ${L.toFixed(0)} m is less than ${min} m`:!fgOK?`Rock strength at base (FG ${fg.toFixed(2)} SG) not more than source pressure`:'OK'}}
// verification: tag test (set down weight in range, depth within 5 m of planned top) and pressure / inflow test
export function tagTest(p,tagDepth,setDown_kN){const okW=setDown_kN>=PA_RULES.tagkN[0]&&setDown_kN<=PA_RULES.tagkN[1]*1.5,okD=Math.abs(tagDepth-p.top)<=5;return {pass:okW&&okD,okW,okD}}
export function pressTest(p,injMPa=0,testMPa=7,dropMPa=0.1){const need=Math.max(3.5,injMPa+PA_RULES.testAboveInj_MPa);return {need,pass:testMPa>=need&&dropMPa<=0.05*testMPa,why:testMPa<need?`Test must be ≥ ${need.toFixed(1)} MPa`:dropMPa>0.05*testMPa?'Pressure drop more than 5 %':'Stable'}}
export function inflowTest(dpMPa=5,flowL=0){return {pass:flowL<=0.5,dp:dpMPa,why:flowL<=0.5?'No inflow in 15 min':'Inflow seen: barrier failed'}}
