// woeng.js (feat/workover): pure engineering + job library for Workover / Completions / Intervention. SIM teaching model, metric (SI).
// No DOM, no network. Sources: see docs/workover.md.
export const G=9.80665,IN=0.0254,E_STEEL=207e9,RHO_STEEL=7850;
// ---- SIM well (vertical land well, simplified) ----
export const WELL={name:'SIM well WO-1',td:2600,tvd:2600,csg:{od:7,id:6.184,kgm:43.2,shoe:2590,name:'7 in 29 lb/ft L-80'},
 tbg:{od:3.5,id:2.992,kgm:13.84,yield_kN:921,name:'3-1/2 in 9.3 lb/ft L-80 EUE'},packer:2400,sssv:300,perf:[2430,2452],spf:12,phase:60,
 pres:26.0,tres:95,fluidSG:1.02,whp:9.5,stuck:2210,sandTop:2205,surfT:25};
export const area=(od,id)=>Math.PI/4*((od*IN)**2-(id*IN)**2);
export const cap=id=>Math.PI/4*(id*IN)**2;               // m3/m
export const annCap=(Dh,od)=>Math.PI/4*((Dh*IN)**2-(od*IN)**2);
export const hyd=(sg,tvd)=>sg*1000*G*tvd/1e6;           // MPa
export const BF=sg=>1-sg*1000/RHO_STEEL;
// kill fluid: balance reservoir pressure at top perf plus overbalance (default 1.4 MPa ~ 200 psi)
export function killSG(w=WELL,ob=1.4){return (w.pres+ob)*1e6/(G*w.perf[0]*1000)}
// bullhead: tubing volume to top perf +10 % over-displacement; max surface pressure stays below frac (frac gradient SG-equivalent 1.75)
export function bullhead(w=WELL,fracSG=1.75){const V=cap(w.tbg.id)*w.perf[0];const ks=killSG(w);
 return {V,Vover:V*1.1,killSG:ks,maxSurf:hyd(fracSG,w.perf[0])-hyd(ks,w.perf[0]),startMax:hyd(fracSG,w.perf[0])-hyd(0.85,w.perf[0])}}
// tubing hookload (kN) in fluid, vertical; block weight added
export function hook(L,sg=WELL.fluidSG,kgm=WELL.tbg.kgm,block=45){return block+kgm*G*L*BF(sg)/1000}
// free-point by stretch: L = E·A·ΔL/ΔF (equiv. field form L[ft]=735294·e[in]·W[lb/ft]/ΔF[lb])
export function freePoint(dL,dF_kN,w=WELL){return E_STEEL*area(w.tbg.od,w.tbg.id)*dL/(dF_kN*1000)}
export function stretch(L,dF_kN,w=WELL){return dF_kN*1000*L/(E_STEEL*area(w.tbg.od,w.tbg.id))}
// max overpull with 90 % of joint yield
export function overpull(L,w=WELL,sg=w.fluidSG){return 0.9*w.tbg.yield_kN-hook(L,sg,w.tbg.kgm,0)}
// tubing length changes (Lubinski/Hammerlindl, simplified): temperature + ballooning, metres
export function tubingMoves({L=WELL.packer,dT=40,dPi=10,dPo=0,w=WELL}={}){const a=12.4e-6,R=w.tbg.od/w.tbg.id,nu=0.3;
 const temp=a*L*dT,ball=-(2*nu/E_STEEL)*(L/(R*R-1))*(dPi*1e6-R*R*dPo*1e6);return {temp,ball,net:temp+ball,Fpack_kN:-(temp+ball)*E_STEEL*area(w.tbg.od,w.tbg.id)/L/1000}}
// SSSV control-line pressure to hold open: well pressure at valve + spring/close margin (API 14A, simplified)
export function sssvOpen(w=WELL,spring=8){const pv=w.whp+hyd(0.25,w.sssv);return {pv,open:pv+spring,hold:(pv+spring)*1.2}}
// perforation underbalance (static): reservoir − hydrostatic of fluid column in tubing
export function underbalance(w=WELL,fluidTopTVD=300,sg=w.fluidSG){return w.pres-hyd(sg,w.perf[0]-fluidTopTVD)}
// gravel size (Saucier 1974): D50 gravel = 5–6 × D50 formation sand
export function gravel(d50um=180){const lo=5*d50um,hi=6*d50um;const meshes=[['40/60',250,420],['30/50',300,600],['20/40',420,840],['16/30',600,1190],['12/20',840,1680]];
 const m=meshes.find(x=>(x[1]+x[2])/2>=lo&&(x[1]+x[2])/2<=hi*1.15)||meshes.find(x=>x[2]>=lo)||meshes.at(-1);return {lo,hi,mesh:m[0]}}
// balanced cement plug (pipe in hole): plug length Lp in casing ID; returns slurry volume, height with pipe in, spacer behind, displacement
export function balancedPlug({base,Lp=100,w=WELL,spacerAhead=1.5,pipeID=w.tbg.id,pipeOD=w.tbg.od}={}){const Cc=cap(w.csg.id),Ca=annCap(w.csg.id,pipeOD),Cp=cap(pipeID);
 const V=Cc*Lp,h=V/(Ca+Cp),Vbehind=spacerAhead*Cp/Ca,disp=Cp*(base-h)-Vbehind;return {V,h,Vbehind,disp,top:base-Lp,sacks:V/0.0333,Cc,Ca,Cp}}
// coiled tubing: pipe-light depth (weight = WHP × area), snub force at surface, simple fatigue use per trip
export const CT={od:1.75,wall:0.134,kgm:3.15,yield_kN:280,gooseR:2.4,reelR:1.2};
export function ctForces(depth,whp=WELL.whp,sg=WELL.fluidSG,c=CT){const Ao=Math.PI/4*(c.od*IN)**2,wb=c.kgm*G*BF(sg);
 const F=wb*depth-whp*1e6*Ao-0.05*wb*depth;return {Fsurf_kN:F/1000,light:whp*1e6*Ao/wb,snub:F<0}}
export function ctFatigue(trips=1){return {cycles:trips*6,life:Math.min(100,trips*6/900*100)}} // 6 bend events per trip in/out (reel, gooseneck); SIM life 900
// slickline / e-line surface tension (kN): wire weight in fluid + toolstring + friction 5 %, plus WHP push-out on wire area
export function lineTension(depth,kind='slick',whp=WELL.whp){const d=kind=='slick'?0.108:0.4375,kgm=kind=='slick'?0.047:0.53,tool=kind=='slick'?0.6:2.4;
 const Aw=Math.PI/4*(d*IN)**2,T=(kgm*G*depth*BF(WELL.fluidSG)+tool*1000)*1.05/1000-whp*1e6*Aw/1000;const brk=kind=='slick'?13.3:80;return {T,brk,sf:brk/Math.max(.01,T)}}
// e-line cable stretch: ΔL = T·L/(E_eff·A); used to correct depth with CCL/GR tie-in
export function cableStretch(depth,T_kN){return T_kN*1000*depth/(1.2e11*Math.PI/4*(0.4375*IN)**2)/2}
// ---------- job library: steps with target scene state, duration (SIM s), checklist and a calc line ----------
// scene keys: unit(rig|slick|wl|ct) blk(0..1 block height) str(string depth m) tree(1 on) bop(1 on) lub(1 lubricator) tool(name) tdep(tool depth m)
// fluid(SG colour) kill(0..1 kill fluid fill) pkr(set 1/0) sssv(1 open) perf(0..1 shots) gp(0..1 gravel) cem:[[top,base]] fish(1 fish in hole) jar(0/1) flow(0..1)
const f=(v,d=1)=>Number(v).toFixed(d);
export function jobs(w=WELL){const B=bullhead(w),K=killSG(w),S=sssvOpen(w),U=underbalance(w),GV=gravel(),TM=tubingMoves(),
 P1=balancedPlug({base:w.perf[0]-10,w}),P2=balancedPlug({base:1200,w}),P3=balancedPlug({base:60,Lp:50,w}),FP=freePoint(stretch(w.stuck,100,w),100,w),
 CTl=ctForces(0).light,ST=lineTension(w.packer,'slick'),EL=lineTension(w.perf[1],'wl');
 const kill={t:'Kill the well (bullhead)',d:8,s:{kill:1,flow:0},chk:['Shut-in pressures read: tubing '+f(w.whp)+' MPa','Kill fluid SG '+f(K,2)+' mixed and checked','Pump line pressure test OK','Max surface pressure set '+f(B.startMax)+' MPa (frac limit)'],
  calc:`Kill SG = (Pres ${f(w.pres)} + 1.4 MPa overbalance) / (g × ${w.perf[0]} m) = ${f(K,3)} · bullhead ${f(B.Vover,2)} m³ (tubing to top perf +10 %)`};
 const flowchk={t:'Flow check 30 min (no flow)',d:3,s:{flow:0},chk:['Tubing and annulus pressure 0','Fluid level static'],calc:'Well is dead when tubing and annulus show 0 MPa and no flow for 30 min'};
 const ndnu=[{t:'Set back-pressure valve in hanger',d:3,s:{bpv:1},chk:['BPV set with lubricator','Bleed above BPV, no build-up'],calc:'Two barriers before the tree comes off: kill fluid + BPV'},
  {t:'Nipple down the Xmas tree',d:5,s:{tree:0},chk:['Control line to SSSV isolated','Tree bolts off, tree lifted clear']},
  {t:'Nipple up the BOP stack',d:6,s:{bop:1},chk:['Rams fitted for 3-1/2 in','Annular installed'],calc:'BOP: annular + pipe rams + blind/shear rams on tubing spool'},
  {t:'Pressure test BOP (low 2 / high 34 MPa)',d:4,s:{bop:1},chk:['Low test 2 MPa 5 min OK','High test 34 MPa 10 min OK','Pull BPV'],calc:'Test to the lower of rated working pressure and expected max surface pressure (API Std 53)'}];
 const pullTbg=[{t:'Pick up hanger, unseat packer (straight pull)',d:5,s:{blk:.85,str:w.packer,pkr:0},chk:['Max overpull '+f(overpull(w.packer))+' kN (90 % yield)','Watch weight indicator'],calc:`String weight in fluid ${f(hook(w.packer))} kN incl. block · shear ring release est. +130 kN`},
  {t:'Pull tubing, lay down joints, strap',d:14,s:{str:0,blk:.3},chk:['Fill hole every 5 stands (trip tank)','Cut SSSV control line clamps','Inspect joints'],calc:`Hole fill per 9.6 m joint pulled: ${f(area(w.tbg.od,w.tbg.id)*9.6*1000,1)} L (closed-end wet ${f(Math.PI/4*(w.tbg.od*IN)**2*9.6*1000,1)} L)`}];
 const runCompl=[{t:'Run new completion: packer, nipples, SSSV, tubing',d:14,s:{str:w.packer,blk:.85,pkr:0,sssv:0},chk:['Drift every joint','Torque turn on each connection','Clamp control line every joint'],calc:`Tubing moves at setting: temp +${f(TM.temp,2)} m, ballooning ${f(TM.ball,2)} m → packer force ${f(TM.Fpack_kN)} kN`},
  {t:'Set packer (hydraulic, drop ball, 20 MPa)',d:5,s:{pkr:1},chk:['Ball on seat','Pressure to 20 MPa, hold 10 min','Pull test 90 kN over'],calc:'Hydrostatic set: tubing pressure moves the setting piston, slips bite, element packs off'},
  {t:'Test annulus 14 MPa / test tubing 28 MPa',d:4,s:{},chk:['Annulus test 15 min OK','Tubing test 15 min OK']},
  {t:'Open SSSV with control line',d:3,s:{sssv:1},chk:['Control line pressure '+f(S.hold)+' MPa'],calc:`SSSV opens above ${f(S.open)} MPa (well pressure at valve ${f(S.pv)} + spring) · hold ${f(S.hold)} MPa`},
  {t:'Land hanger, nipple down BOP, nipple up tree',d:7,s:{bop:0,tree:1,blk:.3},chk:['Hanger lock pins in','Tree test 34 MPa'],calc:'BPV in while BOP comes off; pull BPV after the tree test'}];
 const J={};
 J.completion={cat:'Completions',label:'Run a completion (tubing, packer, SSSV)',unit:'rig',init:{tree:0,bop:1,str:0,kill:1},steps:[...runCompl]};
 J.perf={cat:'Completions',label:'Perforate (tubing-conveyed gun)',unit:'rig',init:{tree:0,bop:1,str:0,kill:1},steps:[
  {t:'Make up TCP guns '+w.spf+' SPF '+w.phase+'° on tubing',d:4,s:{tool:'gun',tdep:0},chk:['Gun arming in safe area','Radio silence on','Firing head check'],calc:`${w.perf[1]-w.perf[0]} m × ${w.spf} SPF ≈ ${Math.round((w.perf[1]-w.perf[0])/0.3048*w.spf)} shots`},
  {t:'Run guns to depth, GR/CCL tie-in',d:10,s:{tdep:w.perf[0],str:w.perf[0]-5},chk:['Correlate to open-hole log','Space out within 0.3 m']},
  {t:'Set packer, swab fluid level for underbalance',d:5,s:{pkr:1,lvl:300},chk:['Fluid level 300 m'],calc:`Underbalance = Pres ${f(w.pres)} − hydrostatic ${f(hyd(w.fluidSG,w.perf[0]-300))} = ${f(U)} MPa (aim 2–7 MPa, API RP 19B/King)`},
  {t:'Fire guns (drop bar)',d:3,s:{perf:1},chk:['Shot detected on surface']},
  {t:'Flow to clean up perforations',d:6,s:{flow:1},chk:['Choke 16/64 in','Sand monitor'],calc:'Underbalance surge cleans crushed zone and debris from tunnels'}]};
 J.gravel={cat:'Completions',label:'Gravel pack basics (cased-hole)',unit:'rig',init:{tree:0,bop:1,str:0,kill:1,perf:1},steps:[
  {t:'Size gravel from sand sieve (D50 180 µm)',d:3,s:{},chk:['Sieve analysis done'],calc:`Saucier: gravel D50 = 5–6 × 180 µm = ${GV.lo}–${GV.hi} µm → ${GV.mesh} US mesh`},
  {t:'Run screen + gravel-pack packer + service tool',d:12,s:{tool:'screen',tdep:w.perf[1]+3,str:w.perf[0]-30},chk:['Screen across perfs +3 m','Wash pipe inside screen']},
  {t:'Set GP packer, circulate position',d:4,s:{pkr:1},chk:['Packer test 7 MPa']},
  {t:'Pump gravel slurry until screen-out',d:10,s:{gp:1},chk:['Rate 0.5 m³/min','Watch for pressure rise (screen-out)'],calc:'Gravel fills perforation tunnels then annulus screen/casing; screen-out shows a full pack'},
  {t:'Reverse out excess, pull service tool',d:5,s:{str:0,blk:.3},chk:['Clean returns']}]};
 J.workover={cat:'Workover',label:'Full workover: kill, ND/NU, pull, re-complete',unit:'rig',init:{tree:1,bop:0,str:w.packer,pkr:1,sssv:1,kill:0,flow:1},steps:[
  {t:'Rig up pulling unit, raise mast',d:6,s:{mast:1,flow:1},chk:['Guy lines to anchors','Mast level','Safety meeting'],calc:'SIM pulling unit: 30 m mast, 900 kN hook rating'},
  {t:'Close SSSV, shut in, read pressures',d:3,s:{sssv:0,flow:0},chk:['Tubing pressure '+f(w.whp)+' MPa']},
  {t:'Open SSSV to bullhead',d:2,s:{sssv:1}},kill,flowchk,...ndnu,...pullTbg,...runCompl,
  {t:'Swab / unload, return well to production',d:6,s:{flow:1,kill:0},chk:['Handover to production'],calc:'Reduce hydrostatic below Pres so the well flows'}]};
 J.fishing={cat:'Workover',label:'Stuck tubing: free point, cut, fish (overshot, spear, jars)',unit:'rig',init:{tree:0,bop:1,str:w.packer,pkr:1,kill:1,sand:1},steps:[
  {t:'Try to unseat: string does not move',d:5,s:{blk:.9},chk:['Pull to '+f(overpull(w.stuck)*0.8)+' kN over (80 % limit)'],calc:`Max overpull ${f(overpull(w.stuck))} kN · string is stuck in sand fill above packer`},
  {t:'Stretch test → free point',d:5,s:{},chk:['Mark pipe at 1st pull','Pull +100 kN, measure stretch'],calc:`Stretch ${f(stretch(w.stuck,100),3)} m at +100 kN → L = E·A·ΔL/ΔF = ${Math.round(FP)} m (free point)`},
  {t:'Run e-line chemical cutter, cut 10 m above free point',d:8,s:{tool:'cutter',tdep:w.stuck-10},chk:['Cutter on depth (CCL)','Fire, see weight drop']},
  {t:'Pull free tubing to surface',d:12,s:{str:0,tool:'',tdep:0,fishTop:w.stuck-10,blk:.3},chk:['Count joints recovered'],calc:`Fish left: ${w.packer-(w.stuck-10)} m of tubing + packer`},
  {t:'Run overshot + bumper sub + jars + accelerator',d:12,s:{tool:'overshot',tdep:w.stuck-12,str:w.stuck-12},chk:['Grapple sized to tubing OD 88.9 mm','Jar tripped at surface to check'],calc:'Overshot catches the fish OUTSIDE (OD); spear catches INSIDE (ID)'},
  {t:'Engage fish, circulate, jar up (cycle ×6)',d:10,s:{tdep:w.stuck-10,jar:1},chk:['Rotate right to engage grapple','Circulate over the fish'],calc:'Jar: store energy in stretch, release at set load → impact many times the static pull'},
  {t:'Fish comes free, pull out',d:12,s:{jar:0,sand:0,str:0,tdep:0,fishTop:0,pkr:0,blk:.3},chk:['Fish at surface, lay out'],calc:'If overshot fails: release (rotate right), change to spear in fish ID'}]};
 J.pa={cat:'Workover',label:'Plug and abandonment (cement plugs)',unit:'rig',init:{tree:0,bop:1,str:0,kill:1,perf:1},steps:[
  {t:'Run open-ended tubing to '+(w.perf[0]-10)+' m',d:10,s:{str:w.perf[0]-10,blk:.85},chk:['Tubing tally checked']},
  {t:'Pump balanced plug 1 over reservoir',d:8,s:{cem:[[P1.top,P1.base]]},chk:['Spacer ahead 1.5 m³ + behind '+f(P1.Vbehind,2)+' m³'],calc:`100 m plug: ${f(P1.V,2)} m³ slurry (casing cap ${f(P1.Cc*1000,1)} L/m), height with pipe in ${f(P1.h)} m, displace ${f(P1.disp,2)} m³`},
  {t:'Pull 20 m above plug, reverse out, WOC',d:6,s:{str:P1.top-20},chk:['WOC 8 h (SIM)']},
  {t:'Tag plug + 45 kN, pressure test 7 MPa',d:4,s:{str:P1.top},chk:['Top of cement tagged '+Math.round(P1.top)+' m','Test 7 MPa 15 min'],calc:'Verify the barrier position (tag) and integrity (pressure test) (NORSOK D-010 / OEUK)'},
  {t:'Plug 2 (intermediate) at 1100–1200 m',d:9,s:{str:1100,cem:[[P1.top,P1.base],[P2.top,P2.base]]},chk:['Covers previous casing shoe'],calc:`${f(P2.V,2)} m³ slurry · displace ${f(P2.disp,2)} m³`},
  {t:'Surface plug 10–60 m, cut casing 3 m below ground',d:9,s:{str:0,blk:.3,cem:[[P1.top,P1.base],[P2.top,P2.base],[10,60]],tree:0,bop:0,cut:1},chk:['Weld cap with well ID','Site restored'],calc:`Surface plug ${f(P3.V,2)} m³ · permanent barriers: reservoir + intermediate + surface`}]};
 J.slick={cat:'Intervention',label:'Slickline: gauge run, set plug in nipple',unit:'slick',init:{tree:1,lub:0,flow:1,sssv:1,pkr:1,str:w.packer},steps:[
  {t:'Rig up lubricator, stuffing box, BOP on tree',d:6,s:{lub:1},chk:['Pressure test lubricator '+f(w.whp*1.2)+' MPa','Wire 0.108 in checked']},
  {t:'Run gauge cutter / drift to '+w.packer+' m',d:8,s:{tool:'gauge',tdep:w.packer},chk:['Watch weight for tags'],calc:`Wire tension at ${w.packer} m: ${f(ST.T,2)} kN · break ${ST.brk} kN · safety factor ${f(ST.sf,1)}`},
  {t:'POOH, run plug on running tool, set in X-nipple',d:10,s:{tdep:w.packer-20,flow:0},chk:['Jar down to set','Shear pin sheared']},
  {t:'Test plug from above, POOH, rig down',d:6,s:{tdep:0,tool:'',lub:0},chk:['Inflow test 10 min OK']}]};
 J.wireline={cat:'Intervention',label:'Wireline logging (e-line, cased-hole PLT/GR-CCL)',unit:'wl',init:{tree:1,lub:0,flow:1,sssv:1,pkr:1,str:w.packer},steps:[
  {t:'Rig up e-line, grease head, lubricator',d:6,s:{lub:1},chk:['Grease injection on','Tool string check at surface']},
  {t:'RIH logging tool to '+w.perf[1]+' m',d:10,s:{tool:'logtool',tdep:w.perf[1]+5},chk:['Speed below 60 m/min in tubing'],calc:`Cable tension ${f(EL.T,1)} kN · stretch correction ${f(cableStretch(w.perf[1],EL.T),2)} m`},
  {t:'Log up: GR + CCL tie-in, flow spinner',d:8,s:{tdep:w.perf[0]-40,log:1},chk:['Correlate to base log','Repeat pass']},
  {t:'POOH, rig down',d:7,s:{tdep:0,tool:'',lub:0},chk:['Data QC on surface']}]};
 J.ct={cat:'Intervention',label:'Coiled tubing: nitrogen lift / sand clean-out',unit:'ct',init:{tree:1,lub:0,flow:0,sssv:1,pkr:1,str:w.packer,sand:1},steps:[
  {t:'Rig up CT: injector, gooseneck, stripper, BOP',d:7,s:{lub:1},chk:['Quad BOP function test','Stripper pressure set','Reel inspected'],calc:`CT 1.75 in: pipe-light until ${f(CTl)} m (WHP × area > weight) → injector must snub`},
  {t:'RIH with jetting nozzle, pumping',d:10,s:{tool:'nozzle',tdep:w.sandTop-5},chk:['Watch weight vs model','Pump 0.3 m³/min'],calc:`At ${w.sandTop} m: surface weight ${f(ctForces(w.sandTop).Fsurf_kN)} kN`},
  {t:'Wash sand fill, circulate to surface',d:10,s:{tdep:w.packer-5,sand:0},chk:['Sand at returns','Short trips every 30 m'],calc:'Annular velocity CT×tubing must exceed sand slip velocity; short trips stop sand bridges'},
  {t:'Pump nitrogen, lift the well',d:6,s:{flow:1},chk:['N2 rate 30 m³/min (std)'],calc:'N2 lowers the hydrostatic in tubing so the reservoir flows'},
  {t:'POOH, rig down, log fatigue',d:8,s:{tdep:0,tool:'',lub:0},chk:['Fatigue +'+ctFatigue(1).cycles+' bend cycles ('+f(ctFatigue(1).life,1)+' % SIM life)']}]};
 return J}
// timeline: cumulative times; stateAt(job,t) interpolates numeric keys, discrete keys switch at step end (or start for tool)
const NUM=['blk','str','tdep','kill','perf','gp','flow','lvl','mast','fishTop'];
export function timeline(J){let t=0;const T=J.steps.map(s=>{const o={...s,t0:t};t+=s.d;return o});return {steps:T,T:t}}
export function stateAt(J,TL,t){const base={unit:J.unit,blk:.3,str:0,tdep:0,tree:1,bop:0,lub:0,tool:'',kill:0,pkr:0,sssv:1,perf:0,gp:0,cem:[],flow:0,lvl:0,mast:J.unit=='rig'&&J.key!='workover'?1:0,jar:0,sand:0,fishTop:0,bpv:0,log:0,cut:0,...J.init};
 if(J.key=='workover')base.mast=0;let s={...base},i=0;
 for(;i<TL.steps.length;i++){const st=TL.steps[i];if(t>=st.t0+st.d){s={...s,...st.s};continue}
  const u=Math.max(0,(t-st.t0)/st.d),e=u*u*(3-2*u),n={...s};for(const k in st.s){const v=st.s[k];if(NUM.includes(k)&&typeof v=='number'){const a=s[k]??0;n[k]=a+(v-a)*e}else if(k=='tool'||k=='lub'||k=='bop'&&v==1||k=='jar')n[k]=v;else if(u>0.6)n[k]=v}
  s=n;break}
 s.i=Math.min(i,TL.steps.length-1);s.done=t>=TL.T;
 const w=WELL,ks=killSG(w);s.whp=s.flow>0.5?w.whp*0.6:s.kill>0.95||s.tree==0?0:w.whp*(1-s.kill);s.hook=s.unit=='rig'?hook(s.str,s.kill>0.5?ks:w.fluidSG):s.unit=='ct'?Math.max(0,ctForces(s.tdep,s.whp).Fsurf_kN):Math.max(0,lineTension(s.tdep,s.unit=='slick'?'slick':'wl',s.whp).T);
 if(s.jar&&s.unit=='rig')s.hook+=Math.max(0,Math.sin(t*3))*220;s.bhp=s.kill>0.5?hyd(ks,w.perf[0]):w.pres;return s}
