// Pits, gain/loss detection and well control simulator (SIM teaching model, never LIVE).
// Single-bubble gas kick (isothermal Boyle, z=1), mud compressibility, orifice choke, PI inflow, fracture losses at shoe.
// Depth model: MD with linear MD→TVD scaling. SI units inside.
import {G,IN,BBL,sg2rho,hydraulics,defWell,MUDS,pumpOutput,window_,clone} from './fluids.js';
const A=d=>Math.PI/4*d*d;
export function geom(w=defWell()){const segs=[];let md=w.md;for(const s of [...w.string].reverse()){/*bottom first*/}
 let top=0;const str=w.string.map(s=>{const r={...s,top,bot:top+s.len,cap:A(s.id),steel:A(s.od)-A(s.id),disp:A(s.od)};top+=s.len;return r});
 const annCap=md=>{const s=str.find(r=>md>=r.top&&md<=r.bot)||str.at(-1);return A(md<w.shoeMD?w.csgID:w.holeD)-A(s.od)};
 const Vstr=str.reduce((a,r)=>a+r.cap*r.len,0);let Vann=0;const N=300,dz=w.md/N;for(let i=0;i<N;i++)Vann+=annCap((i+0.5)*dz)*dz;
 return{w,str,annCap,Vstr,Vann,tvd:md=>md*w.tvd/w.md,N,dz}}
// annulus volume from bottom up to height h above bit → md of that point
function annMdFromBottomVol(g,V){let v=0;for(let i=g.N-1;i>=0;i--){const c=g.annCap((i+0.5)*g.dz)*g.dz;if(v+c>=V)return (i+1)*g.dz-(V-v)/c*g.dz;v+=c}return 0}
function strMdFromTopVol(g,V){let v=0;for(const r of g.str){const c=r.cap*r.len;if(v+c>=V)return r.top+(V-v)/r.cap;v+=c}return g.w.md}
export const FLUIDS={gas:0.20,oil:0.75,water:1.05};
export function newWC(o={}){const w=o.well||defWell(),g=geom(w),mud=clone(o.mud||MUDS.wbm),win=window_(w.tvd);
 const pore=o.poreSG??(mud.sg+0.06),shoeFrac=o.shoeFracSG??window_(w.shoeTVD).frac;
 const p=w.pump,scrSpm=o.scrSpm??30;const S={t:0,w,g,mud,omw:mud.sg,kmw:null,pore,shoeFrac,win,kickType:o.kickType||'gas',PI:o.PI??(2.0e-9),// m³/s/Pa
  pits:{active:o.active??60,reserve:120,trip:3.0,alarm:o.pitAlarm??1.0,ref:o.active??60},
  spm:o.spm??100,pumpsOn:true,bop:false,choke:1,auto:false,mode:'drill',//drill|shutin|kill|trip
  gasV:0,gasN:0,gasTop:w.md,gasBot:w.md,influxTot:0,lossTot:0,qInf:0,qLoss:0,Pc:0,Pdp:0,BHP:0,Pshoe:0,Qin:0,Qout:0,flowDiff:0,
  scrSpm,scrP:null,method:null,phase:'',killV:0,circV:0,events:[],hist:[],cm:4.5e-10,// mud compressibility 1/Pa
  trip:{v:0,pulled:0,expected:0,measured:0},tripDirection:0,flags:{kick:false,loss:false,shutin:false,killed:false,fracExceeded:false}};
 S.scrP=scrPressure(S,scrSpm);return S}
export function scrPressure(S,spm){const Q=pumpOutput(S.w.pump,spm)*S.w.pump.n;const H=hydraulics(S.mud,S.w,Q,{mwdDp:0});return H.spp}// slow circulating rate pressure (all pumps, open well)
function ev(S,m){S.events.push([S.t,m]);if(S.events.length>60)S.events.shift()}
// annular hydrostatic from surface to md (Pa), with gas bubble and kill mud front
function annHydro(S,toMD,fromMD=0){const g=S.g,n=60,dz=(toMD-fromMD)/n;let p=0;const kTop=S.killAnnTop;for(let i=0;i<n;i++){const md=fromMD+(i+0.5)*dz;let sg=S.omw;
 if(md>=S.gasTop&&md<=S.gasBot&&S.gasV>0)sg=FLUIDS[S.kickType];else if(kTop!=null&&md>=kTop)sg=S.kmw;p+=sg*1000*G*(g.tvd(md+dz/2)-g.tvd(md-dz/2))}return p}
function strHydro(S){const g=S.g;const kf=S.killStrBot;if(kf==null||kf<=0)return S.omw*1000*G*S.w.tvd;const kt=g.tvd(Math.min(kf,S.w.md));return S.kmw*1000*G*kt+S.omw*1000*G*(S.w.tvd-kt)}
function setGasPos(S){const V=S.gasV;if(V<=0){S.gasTop=S.gasBot=S.w.md;return}const g=S.g;// bubble bottom at gasBot, find top by capacity
 let v=0,md=S.gasBot;while(v<V&&md>0){const c=g.annCap(md);const d=Math.min(1,md);v+=c*d;md-=d}S.gasTop=Math.max(0,md)}
export function bhpOf(S,Pc,fr=0){return Pc+annHydro(S,S.w.md)+fr}
export function step(S,dt){S.t+=dt;const w=S.w,g=S.g,mud=S.mud;
 const Qin=S.pumpsOn&&S.mode!='shutin'?pumpOutput(w.pump,S.spm)*w.pump.n:0;S.Qin=Qin;
 const H=Qin>0?hydraulics({...mud,sg:S.omw},w,Qin,{mwdDp:0}):null,fr=H?H.ann:0;
 const closed=S.bop,rho=S.omw*1000;
 // gas state: n = P·V (isothermal). Bubble pressure = BHP − hydro below bubble mid.
 const below=md=>annHydro(S,w.md,md);
 const Pgas=Pc=>bhpOf(S,Pc,fr)-below((S.gasTop+S.gasBot)/2)-fr*((w.md-(S.gasTop+S.gasBot)/2)/w.md);
 const Vg=Pc=>S.gasN>0?S.gasN/Math.max(1e5,Pgas(Pc)):0;
 const Cv=0.0035;// choke flow coefficient (m³/s per sqrt(Pa/ρ) fully open)
 const PoreP=S.pore*1000*G*w.tvd;const PfrShoe=S.shoeFrac*1000*G*w.shoeTVD;
 let Pc=0;const P0=bhpOf(S,S.Pc,fr);
 if(closed){const vol=w.g?0:g.Vann+g.Vstr;const resid=Pc_=>{const BHP=bhpOf(S,Pc_,fr),qi=S.kickType&&BHP<PoreP?S.PI*(PoreP-BHP):0,
   Pshoe=Pc_+annHydro(S,w.shoeMD)+fr*w.shoeMD/w.md,ql=Pshoe>PfrShoe?2e-8*(Pshoe-PfrShoe):0,
   qo=S.choke>0?Cv*S.choke*Math.sqrt(Math.max(0,Pc_)/rho):0,dVg=(S.kickType=='gas'?Vg(Pc_)-S.gasV:0);
   return {r:qo*dt-(Qin*dt+qi*dt+dVg-vol*S.cm*(BHP-P0)-ql*dt),qi,qo,ql,BHP,Pshoe}};
  let lo=0,hi=60e6;for(let i=0;i<60;i++){const m=(lo+hi)/2;resid(m).r>0?hi=m:lo=m}Pc=(lo+hi)/2;const R=resid(Pc);S.qInf=R.qi;S.Qout=R.qo;S.qLoss=R.ql}
 else{Pc=0;const BHP=bhpOf(S,0,fr);S.qInf=BHP<PoreP?S.PI*(PoreP-BHP):0;const Pshoe=annHydro(S,w.shoeMD)+fr*w.shoeMD/w.md;S.qLoss=Pshoe>PfrShoe?2e-8*(Pshoe-PfrShoe):0;
  const dVg=S.kickType=='gas'&&S.gasN>0?S.gasN/Math.max(1e5,Pgas(0))-S.gasV:0;S.Qout=Math.max(0,Qin+S.qInf+dVg/dt-S.qLoss)}
 S.Pc=Pc;
 // update influx inventory
 if(S.qInf>0){if(!S.flags.kick&&S.qInf*dt>0){}const dv=S.qInf*dt;S.influxTot+=dv;if(S.kickType=='gas'){const Pb=bhpOf(S,Pc,fr);S.gasN+=Pb*dv}else S.gasV+=dv}
 if(S.kickType=='gas'&&S.gasN>0&&S.gasTop>0)S.gasV=S.gasN/Math.max(1e5,Pgas(Pc));
 // bubble motion: migration when static, carried + slip when circulating
 const vmig=0.08,va=Qin>0?Qin/g.annCap(Math.max(1,S.gasBot)):0;if(S.gasV>0){S.gasBot=Math.max(0,S.gasBot-(va+(S.kickType=='gas'?vmig:0.02))*dt);setGasPos(S);
  if(S.gasTop<=0){// gas at surface: vent through choke/flowline, keep only the part still in the hole
   if(!S._vent){S._vent=1;ev(S,'Gas at surface: hold casing pressure with the choke')}let v=0;for(let md=0;md<S.gasBot;md+=1)v+=g.annCap(md);const Pg=Math.max(1e5,Pgas(Pc));S.gasV=v;S.gasN=v*Pg;S.gasTop=0;
   if(S.gasBot<=1){S.gasN=0;S.gasV=0;S._vent=0;ev(S,'Influx out of the well')}}}
 if(S.gasV<=1e-4&&S.gasN<=0){S.gasTop=S.gasBot=w.md}
 // kill fluid fronts
 if(Qin>0){S.circV+=Qin*dt;if(S.kmw&&S.pumpingKill){S.killV+=Qin*dt;S.killStrBot=strMdFromTopVol(g,S.killV);const va2=S.killV-g.Vstr;S.killAnnTop=va2>0?annMdFromBottomVol(g,va2):null;if(S.killAnnTop!=null&&S.killAnnTop<=0.5&&!S.flags.killed){S.flags.killed=true;ev(S,'Kill mud at surface. Well dead check: stop pumps and flow check')}}}
 // pressures
 const BHP=bhpOf(S,Pc,fr);S.BHP=BHP;S.Pshoe=Pc+annHydro(S,w.shoeMD)+fr*w.shoeMD/w.md;
 S.Pdp=Qin>0?BHP-strHydro(S)+(H.spp-H.ann):Math.max(0,BHP-strHydro(S));
 // pits: returns into active, suction out
 const dPit=(S.Qout-Qin)*dt;S.pits.active+=dPit;S.flowDiff=S.Qout-Qin;
 const gain=S.pits.active-S.pits.ref;if(gain>S.pits.alarm&&!S.flags.kick){S.flags.kick=true;ev(S,`Pit gain ${gain.toFixed(1)} m³: possible kick. Stop drilling, flow check, shut in`)}
 if(gain<-S.pits.alarm&&!S.flags.loss){S.flags.loss=true;ev(S,`Pit loss ${(-gain).toFixed(1)} m³: lost circulation`)}
 if(S.qLoss>0){S.lossTot+=S.qLoss*dt;if(!S.flags.fracExceeded){S.flags.fracExceeded=true;ev(S,'Shoe pressure over fracture pressure: losses at shoe. Reduce choke pressure')}}
 // auto choke: hold drillpipe pressure on schedule (kill) or hold BHP constant
 if(S.auto&&S.bop&&S.mode=='kill'){const tgt=target(S);if(tgt!=null){const Pd=Math.max(2e4,S.Pc+(tgt-S.Pdp)),cr=Math.max(0.0005,Math.min(1,S.Qout/(0.0035*Math.sqrt(Pd/(S.omw*1000)))));S.choke+=(cr-S.choke)*Math.min(1,0.25*dt)}}
 if(S.mode=='kill'&&S.method)killPhase(S);
 if(S.hist.length==0||S.t-S.hist.at(-1).t>=2)S.hist.push({t:S.t,pc:Pc,pdp:S.Pdp,bhp:BHP,pit:S.pits.active,qout:S.Qout,qin:Qin,shoe:S.Pshoe});if(S.hist.length>2000)S.hist.shift();
 return S}
// start influx (e.g. drilled into higher pore pressure)
export function takeKick(S,poreSG){S.pore=poreSG;S.mode='drill';ev(S,`Drilled into zone at ${poreSG.toFixed(2)} SG pore pressure`)}
export function shutIn(S){S.pumpsOn=false;S.bop=true;S.choke=0;S.mode='shutin';S.flags.shutin=true;S.tShut=S.t;S.pitGain=S.pits.active-S.pits.ref;ev(S,`Shut in (hard): pumps off, BOP closed, choke closed. Pit gain ${S.pitGain.toFixed(1)} m³`)}
// kill sheet from shut-in readings
export function killSheet(S){const w=S.w,g=S.g,P=w.pump,spS=pumpOutput(P,1)/(1/60)*1,// m³/stroke
 sidpp=Math.max(0,S.Pdp),sicp=S.Pc,TVD=w.tvd,kmwRaw=S.omw+sidpp/(G*TVD*1000),kmw=Math.ceil(kmwRaw*100-1e-9)/100,icp=sidpp+S.scrP,fcp=S.scrP*kmw/S.omw;
 const vStr=g.Vstr,vBitShoe=(()=>{let v=0;for(let md=w.shoeMD;md<w.md;md+=1)v+=g.annCap(md);return v})(),vAnn=g.Vann;
 const strokes=v=>v/(pumpOutput(P,1)*60);
 const hInf=Math.max(1e-6,S.pitGain||0)/g.annCap(w.md-1);const grad=(S.omw*1000*G-(sicp-sidpp)/Math.max(1,hInf))/(1000*G);
 const maasp=(S.shoeFrac-S.omw)*1000*G*w.shoeTVD,maaspK=(S.shoeFrac-kmw)*1000*G*w.shoeTVD;
 const sched=[];for(let i=0;i<=10;i++)sched.push({stk:Math.round(strokes(vStr)*i/10),p:icp-(icp-fcp)*i/10});
 return{sidpp,sicp,pitGain:S.pitGain||0,kmw,kmwRaw,icp,fcp,scrSpm:S.scrSpm,scrP:S.scrP,stkSurfBit:Math.round(strokes(vStr)),stkBitShoe:Math.round(strokes(vBitShoe)),stkBitSurf:Math.round(strokes(vAnn)),vStr,vAnn,maasp,maaspK,hInf,influxSG:Math.max(0.1,grad),influxType:grad<0.35?'gas':grad<0.85?'oil / gas-cut':'water',sched,bbl:vAnn/BBL}}
export function startKill(S,method){const K=killSheet(S);S.kill=K;S.method=method;S.mode='kill';S.spm=S.scrSpm;S.pumpsOn=true;S.circV=0;S.killV=0;S.killStrBot=null;S.killAnnTop=null;S.kmw=K.kmw;
 S.pumpingKill=method=='ww';S.phase=method=='ww'?'Pump kill mud, follow DP schedule ICP → FCP':'Circulation 1: hold ICP constant with original mud';S.choke=0.05;ev(S,(method=='ww'?'Wait-and-Weight':"Driller's method")+` started at ${S.scrSpm} spm. KMW ${K.kmw.toFixed(2)} SG, ICP ${(K.icp/1e6).toFixed(2)} MPa, FCP ${(K.fcp/1e6).toFixed(2)} MPa`);return K}
export function target(S){const K=S.kill;if(!K)return null;const stk=S.circV/(pumpOutput(S.w.pump,1)*60*S.w.pump.n);const sStr=K.stkSurfBit/S.w.pump.n;
 if(S.method=='dm'){if(!S.pumpingKill)return K.icp;const f=Math.min(1,S.killV/K.vStr);return K.icp+(K.fcp-K.icp)*f}
 const f=Math.min(1,S.killV/K.vStr);return K.icp+(K.fcp-K.icp)*f}
function killPhase(S){const K=S.kill;if(S.method=='dm'&&!S.pumpingKill&&S.circV>=K.vStr+K.vAnn&&S.gasV<=1e-4){S.pumpingKill=true;S.killV=0;S.phase='Circulation 2: pump kill mud, DP pressure ICP → FCP, then hold FCP';ev(S,'Circulation 1 complete: influx out. Start circulation 2 with kill mud')}
 if(S.flags.killed&&!S.done){S.done=true;S.phase='Well killed: stop pumps, flow check, open BOP';S.omw=S.kmw;S.killAnnTop=null;S.killStrBot=null}}
// ---------- tripping and trip tank ----------
export function tripSheet(S,stands=10,standLen=28.5,wet=false){const r=S.g.str[0];const per=(wet?r.disp:r.steel)*standLen;const rows=[];for(let i=1;i<=stands;i++)rows.push({stand:i,expected:per*i});return{per,rows}}
export function tripStep(S,dt,v,o={}){// v>0 pulling (m/s)
 const r=S.g.str[0],ex=r.steel*Math.abs(v)*dt;S.trip.pulled+=v*dt;if(v>0){S.trip.expected+=ex;S.pits.trip-=ex;}
 const m=S.mud,sw=o.swabSG??0;const BHPsg=S.omw-(sw||0);const PoreP=S.pore*1000*G*S.w.tvd,BHP=BHPsg*1000*G*S.w.tvd;
 if(BHP<PoreP){const dv=S.PI*(PoreP-BHP)*dt;S.pits.trip+=dv;S.influxTot+=dv;S.trip.swabbed=(S.trip.swabbed||0)+dv}
 if(o.lossRate)S.pits.trip-=o.lossRate*dt;S.trip.measured=3.0-S.pits.trip;S.trip.diff=S.trip.measured-S.trip.expected;// fill used vs expected (negative = well gave back mud)
 if(S.trip.diff<-0.3&&!S.flags.swab){S.flags.swab=true;ev(S,'Hole took less fill than calculated: swabbed influx. Stop, flow check, run back to bottom')}return S}
