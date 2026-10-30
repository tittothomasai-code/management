// Hydraulic fracturing engine (SIM). Pure functions, no DOM. Units: SI / metric field (MPa, m, m3/min, kg/m3).
// Stresses from lithology (helper D strat.js lithAt when present) via uniaxial-strain (Eaton) Shmin; PKN geometry with
// Carter leak-off by volume balance; treating pressure = Shmin + Pnet + pipe + perf friction − hydrostatic.
export const G=9.80665,IN=0.0254;
// elastic props by strat.js LITH keys (typical lab/log values: Fjær et al. 2008; Economides & Nolte 2000 ch.3)
export const ROCK={sandstone:{E:15,nu:.20},siltstone:{E:20,nu:.25},shale:{E:18,nu:.30},claystone:{E:8,nu:.35},marl:{E:15,nu:.28},limestone:{E:35,nu:.28},chalk:{E:8,nu:.25},dolomite:{E:45,nu:.26},anhydrite:{E:60,nu:.30},salt:{E:30,nu:.45},coal:{E:3,nu:.35},conglomerate:{E:25,nu:.22},basement:{E:60,nu:.25}};
const SIMLITH=z=>z<2195?'shale':z<2250?(Math.floor(z/20)%2?'dolomite':'limestone'):z<2410?'sandstone':z<2515?'shale':'sandstone';
let LITHFN=z=>({lith:SIMLITH(z),formation:'SIM layer',src:'SIM'});
// Strat (helper D): lithology from lithAt, and Sv/Pp/frac gradient in SG from GX.strat.pressureAt(model(),tvd) (Eaton per bed).
// Values are cached per metre TVD (pressureAt integrates overburden, so uncached calls made the frac sim slow).
let PRESS=null;const CACHE=new Map();
export function useStrat(S){CACHE.clear();try{const M=S.model?S.model():S.SIM_STRAT?S.SIM_STRAT():null;
 if(M&&S.lithAt)LITHFN=z=>S.lithAt(M,z)||{lith:SIMLITH(z),src:'SIM'};
 PRESS=M&&S.pressureAt?z=>S.pressureAt(M,z):null}catch(e){PRESS=null}return LITHFN}
export const lithAt=z=>LITHFN(z);
export const FW={sv:0.0226,pp:0.0107,alpha:0.9,tect:1.5,csgID:6.184,maxP:69};// SIM fallback: Sv grad MPa/m (2.3 SG overburden), Pp grad, Biot, tectonic add MPa, 7 in casing, 69 MPa (10 000 psi) iron limit
export const sg2mpa=(sg,z)=>sg*G*z/1000;// SG × g × TVD
export function stress(zIn){const z=Math.round(zIn);if(CACHE.has(z))return CACHE.get(z);let o;const L=lithAt(z),k=L?.lith||'shale',r=ROCK[k]||ROCK.shale;
 const q=PRESS?(()=>{try{return PRESS(z)}catch(e){return null}})():null;
 if(q&&Number.isFinite(q.fg_sg)){const lk=ROCK[q.lith]?q.lith:k,rr=ROCK[lk]||r;o={z,lith:lk,formation:L?.formation,E:rr.E,nu:rr.nu,Sv:sg2mpa(q.ob_sg,z),Pp:sg2mpa(q.pp_sg,z),sh:sg2mpa(q.fg_sg,z),pp_sg:q.pp_sg,fg_sg:q.fg_sg,ob_sg:q.ob_sg,src:q.src||'SIM'}}
 else{const Sv=FW.sv*z,Pp=FW.pp*z,sh=r.nu/(1-r.nu)*(Sv-FW.alpha*Pp)+FW.alpha*Pp+FW.tect;o={z,lith:k,formation:L?.formation,E:r.E,nu:r.nu,Sv,Pp,sh,pp_sg:Pp*1000/(G*z),fg_sg:sh*1000/(G*z),ob_sg:Sv*1000/(G*z),src:'SIM'}}
 CACHE.set(z,o);return o}
// perf friction Δp = ρ q² / (2 Cd² A²), A = n·π·d²/4 (Crump & Conway 1988; Cd 0.6 sharp → 0.9 eroded)
export function perfFric(q,n,d=0.0094,rho=1000,Cd=0.7){const A=n*Math.PI*d*d/4,Q=q/60;return rho*Q*Q/(2*Cd*Cd*A*A)/1e6}
// casing friction (Fanning, Blasius, × drag-reduction factor for friction reducer / gel)
export function pipeFric(q,L,rho=1000,mu=0.001,dr=0.3){const D=FW.csgID*IN,v=q/60/(Math.PI/4*D*D),Re=rho*v*D/mu,f=0.0791*Re**-0.25;return 2*f*rho*v*v/D*L*dr/1e6}
export const slurryRho=c=>(1000+c)/(1+c/2650);// c = kg proppant per m3 clean fluid
export const PPA=119.83;// 1 lb/gal added = 119.83 kg/m3
// PKN (Perkins-Kern 1961, Nordgren 1972): w_max = 2.31 [q μ (1-ν) x_f / G]^(1/4) per wing, w_avg = π/5·w_max·(π/4), Pnet = E' w_max /(2 h_f)
export function pkn({q,mu,xf,hf,E,nu}){const Gm=E*1e9/(2*(1+nu)),qw=q/60/2,wmax=2.31*(qw*mu*(1-nu)*xf/Gm)**.25,Ep=E*1e9/(1-nu*nu);return {wmax,wavg:wmax*Math.PI*Math.PI/20,pnet:Ep*wmax/(2*hf)/1e6}}
// height: grows into layers whose stress is below σ_pay + 0.8·Pnet (equilibrium-height idea, Simonson et al. 1978), capped
export function height(zc,pnet,pay=12){const s0=stress(zc).sh;let up=zc,dn=zc;while(up>zc-80&&stress(up-1).sh<=s0+0.8*pnet)up--;while(dn<zc+80&&stress(dn+1).sh<=s0+0.8*pnet)dn++;return {top:Math.min(up,zc-pay/2),bot:Math.max(dn,zc+pay/2)}}
// pumping schedule (per stage): pad then 1–5 lb/gal ramps (ppa), then flush to top perf
export function schedule({rate=8,pad=60,ramps=[[1,30],[2,40],[3,40],[4,40],[5,40]],top=2400}={}){const S=[{n:'Pad',c:0,V:pad}];for(const [p,V] of ramps)S.push({n:p+' ppa',c:p*PPA,V});S.push({n:'Flush',c:0,V:+(Math.PI/4*(FW.csgID*IN)**2*top).toFixed(1),flush:1});let t=0;for(const s of S){s.t0=t;s.d=s.V/rate;t+=s.d}return {rate,S,T:t}}
// time-step one stage. Returns history [{t,p,q,c,cf,bhp,xf,hf,w,pnet,risk,so,vp}] and summary
export function simStage({zc,n=36,rate=8,mu=0.15,CL=1.2e-5,dp=0.00064,sch,dt=6,name="Stage"}={}){if(sch?.rate)rate=sch.rate;sch=sch||schedule({rate,top:zc-6});if(sch?.rate)rate=sch.rate;const H=[];let V=0,Vp=0,xf=5,hf=20,t=0,so=0,cut=0,top=zc,bot=zc,ftop=zc-6;const st=stress(zc),T=sch.T;
 const stageAt=t=>{let k=0;for(;k<sch.S.length-1;k++)if(t<sch.S[k].t0+sch.S[k].d)break;return sch.S[k]};
 for(t=0;t<=T+8;t+=dt/60){const pumping=t<T;let seg=pumping?stageAt(t):null;let q=pumping?rate:0;if(seg&&cut&&seg.c>0)seg={...sch.S.at(-1)};// screenout response: cut sand, go to flush
  // surface concentration vs. bottomhole: slurry arrives after casing volume lag
  const lag=sch.S.at(-1).V/rate,segB=pumping?stageAt(Math.max(0,t-lag)):null;const cb=t<lag?0:(segB?.c||0)*(cut&&!segB?.flush?0:1);
  const q_m3s=q/60;V+=q*dt/60;Vp+=cb*q*dt/60/1000;// tonnes of proppant in fracture
  // volume balance with Carter leak-off: V = 2 xf hf (w + 2·κ·CL·√t + spurt)
  for(let it=0;it<6&&q>0;it++){const g=pkn({q,mu,xf,hf,E:st.E,nu:st.nu});const h=height(zc,g.pnet);top=h.top;bot=h.bot;hf=Math.min(90,bot-top);const leak=2*1.5*CL*Math.sqrt(Math.max(1,t*60))+0.0005;xf=Math.max(5,Math.min(400,V/(2*hf*(g.wavg+leak))))}
  let g=pkn({q:Math.max(q,0.001),mu,xf,hf,E:st.E,nu:st.nu});if(!q){const h=H.at(-1);g={wavg:h.w,wmax:h.wmax,pnet:h.pnet*Math.exp(-(t-T)/6)}}
  const eff=Math.min(.95,(g.wavg*2*xf*hf)/Math.max(1,V)),cf=Vp*1000/Math.max(1,g.wavg*2*xf*hf*0.62+1e-6);// in-fracture slurry conc (dehydration raises it)
  const risk=Math.max(0,Math.min(1.5,Math.max(cf/1600,(cb>0?3*dp/Math.max(1e-4,g.wavg*1.1):0))));// packed limit ~1600 kg/m3; bridging when w < 3·d_prop
  if(risk>=1&&pumping&&!so){so=t}const soP=so&&pumping?Math.min(25,(t-so)*6):0;if(soP>12)cut=1;
  const rhoS=slurryRho(cb),hydro=rhoS*G*zc/1e6,pnet=(g.pnet||0)+soP,bhp=st.sh+pnet,fr=q?pipeFric(q,zc)*(1+cb/1500)+perfFric(q,n):0,p=bhp+fr-hydro;
  H.push({t,p,q,c:pumping?(seg.c||0):0,cb,cf,bhp,xf,hf,top,bot,w:g.wavg||H.at(-1)?.w||0,wmax:g.wmax||0,pnet,risk,so:so?1:0,Vp,eff,seg:seg?.n||'Shut-in',fr,hydro})}
 const isipI=H.findIndex(h=>h.q==0),ISIPs=H[Math.min(H.length-1,isipI+1)].p,ISIPb=ISIPs+H[isipI].hydro;
 const last=H[isipI-1];return {name,zc,st,sch,H,T,ISIP:ISIPs,ISIPbh:ISIPb,fg:st.fg_sg,isipG:ISIPb*1e6/(G*zc*1000),pnet:ISIPb-st.sh,xf:last.xf,hf:last.hf,top:last.top,bot:last.bot,w:last.w,prop:last.Vp,so:!!H.find(h=>h.so),maxP:Math.max(...H.map(h=>h.p)),eff:last.eff}}
// SIM design: 3 plug-and-perf stages, bottom up. Stage 3 is aggressive (thin gel, high ppa) → screenout risk.
export function design(){const D=[{name:'Stage 1 (lower sand)',zc:2550,n:36},{name:'Stage 2 (upper sand, base)',zc:2390,n:36},{name:'Stage 3 (upper sand, top)',zc:2290,n:24,mu:0.05,CL:3e-5,sch:schedule({rate:7,pad:30,ramps:[[2,40],[4,40],[6,50],[8,50]],top:2284})}];return D.map(d=>simStage(d))}
export function at(stg,ft){const H=stg.H;let k=Math.max(0,Math.min(H.length-1,Math.round(ft/((H[1]?.t)||1))));return H[k]}
// job library entry for the workover sequence player
export function fracJob(){const D=design(),f=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'–';const steps=[
 {t:'Rig up frac spread: pumps, blender, data van, iron',d:8,s:{lub:1,spread:1},chk:['Iron rated 69 MPa (10 000 psi)','Pop-off valves set','Exclusion zone marked'],calc:'Spread: 6 pumps × 1.4 m³/min, blender, sand silos, data van (SIM)'},
 {t:'Pressure test treating iron',d:5,s:{},chk:['Test 62 MPa, hold 5 min, no leak'],calc:`Max treating pressure set ${FW.maxP} MPa (90 % of iron and casing limit)`}];
 D.forEach((S,k)=>{const fs=S.sch;steps.push(
  {t:`${S.name}: ${k?'pump down plug + guns on wireline':'run guns on wireline'}`,d:7,s:{stg:k,tool:'gun',tdep:S.zc,ft:0,fon:0},chk:k?['Pump-down rate 1.5 m³/min','Line speed vs. rate matched']:['Guns armed only at depth'],calc:`Stage depth ${S.zc} m in ${S.st.lith}; Shmin ${f(S.st.sh)} MPa (ν ${S.st.nu}, E ${S.st.E} GPa)`},
  ...(k?[{t:`${S.name}: set frac plug at ${S.zc+12} m`,d:3,s:{plug:k},chk:['Plug set, line tension drop seen'],calc:'Composite plug isolates the stage below'}]:[]),
  {t:`${S.name}: perforate, pull out of hole`,d:5,s:{perfs:k+1,tool:'',tdep:0},chk:['All guns fired (shot detection)'],calc:`${k==2?24:36} shots, 0.37 in holes → perf friction ${f(perfFric(fs.rate,k==2?24:36))} MPa at ${fs.rate} m³/min`},
  {t:`${S.name}: pump pad and proppant ramps`,d:16,s:{fon:1,ft:fs.T*0.97},chk:['Watch treating pressure vs. max','Proppant on schedule'],calc:fs.S.map(x=>`${x.n} ${x.V} m³`).join(' · ')+(S.so?` · SCREENOUT risk: sand cut to flush`:'')},
  {t:`${S.name}: flush, shut in, read ISIP`,d:6,s:{ft:S.H.at(-1).t,fon:1},chk:['ISIP recorded','Net pressure computed'],calc:`ISIP ${f(S.ISIP)} MPa (surface), BH ${f(S.ISIPbh)} MPa → ISIP gradient ${f(S.isipG,2)} SG; frac gradient (strat) ${f(S.fg,2)} SG; Pnet ${f(S.pnet)} MPa; xf ${f(S.xf,0)} m, hf ${f(S.hf,0)} m, ${f(S.prop,0)} t proppant`})});
 steps.push({t:'Mill out plugs with coiled tubing',d:8,s:{tool:'nozzle',tdep:2560,fon:0,plug:0,lub:1},chk:['Each plug milled, returns checked'],calc:'CT with motor and mill; short trips to clear debris'},{t:'Flow back and clean up (SIM)',d:6,s:{tool:'',tdep:0,flow:1,spread:0,lub:0},chk:['Sand trap checked','Choke staged up slowly'],calc:'Slow choke staging holds proppant in the fracture'});
 return {cat:'Stimulation',label:'Hydraulic fracturing: plug-and-perf, 3 stages',unit:'frac',init:{tree:1,bop:0,str:0,pkr:0,kill:0,spread:0,stg:0,ft:0,fon:0,perfs:0,plug:0},steps,D}}
