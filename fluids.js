// v5.x Drilling fluids, hydraulics (API RP 13D style), pits and well control. SIM teaching model, never LIVE.
// SI units inside: m, m³/s, kg/m³, Pa. Display: SG, m³/min, kPa/MPa, Pa (rheology), kW.
export const G=9.81,IN=0.0254,BBL=0.158987,GPM=3.785411784e-3/60,PSI=6894.757,LB100=0.4788;// 1 lbf/100ft² = 0.4788 Pa
export const DEG=0.511;// 1 Fann dial degree (R1B1, F1) ≈ 0.511 Pa (= 1.0678 lbf/100ft²)
export const sg2rho=s=>s*1000,rho2sg=r=>r/1000;
// ---------- Stage 1: mud types and rheology ----------
export const MUDS={
 wbm:{id:'wbm',name:'Water-base mud (KCl polymer)',type:'WBM',sg:1.25,fann:{600:52,300:34,200:27,100:19,6:6,3:5},gel10s:6,gel10m:12,oilWater:null,solids:{lgs:5.5,hgs:9.0},mbt:15,ph:9.5,fluidLoss:5.0,es:null,cl:30000},
 obm:{id:'obm',name:'Oil-base mud (invert emulsion 80/20)',type:'OBM',sg:1.40,fann:{600:62,300:38,200:29,100:20,6:8,3:7},gel10s:9,gel10m:14,oilWater:[80,20],solids:{lgs:4.0,hgs:12.5},mbt:null,ph:null,fluidLoss:3.0,es:650,cl:null}};
export const clone=m=>JSON.parse(JSON.stringify(m));
const lg=Math.log10;
// Fann readings → model parameters (API RP 13D)
export function bingham(m){const f=m.fann,PV=f[600]-f[300],YP=f[300]-PV;return{PV,YP,PVpas:PV/1000,YPpa:YP*LB100}}// PV cP, YP lbf/100ft²
export function powerLaw(m){const f=m.fann,np=3.32*lg(f[600]/f[300]),Kp=DEG*f[300]/511**np,na=0.657*lg(f[100]/f[3]),Ka=DEG*f[100]/170.2**na;return{np,Kp,na,Ka}}// K in Pa·sⁿ
export function herschel(m){const f=m.fann,ty=Math.max(0,2*f[3]-f[6]),/* API RP 13D: τy=2R3−R6, n=3.32log((R600−τy)/(R300−τy)), K=(R300−τy)/511ⁿ */n=3.32*lg((f[600]-ty)/(f[300]-ty)),K=DEG*(f[300]-ty)/511**n;return{tyLB:ty,ty:ty*DEG,n,K}}
export const shearRate=rpm=>1.703*rpm;
export function tauModel(m,gamma,model='hb'){if(model=='bingham'){const b=bingham(m);return b.YPpa+b.PVpas*gamma}if(model=='pl'){const p=powerLaw(m);return p.Kp*gamma**p.np}const h=herschel(m);return h.ty+h.K*gamma**h.n}
// solids from retort-style inputs: % vol. LGS 2.6 SG, HGS barite 4.2 SG
export function solidsSG(m){return m.solids.lgs/100*2.6+m.solids.hgs/100*4.2}
// mud check: returns list of [item,value,limit,status,advice]
export function mudCheck(m,o={}){const b=bingham(m),r=[],add=(k,v,lim,ok,adv)=>r.push({k,v,lim,ok,adv});
 const pp=o.poreSG??1.15,fr=o.fracSG??1.65,ecd=o.ecdSG??m.sg;
 add('Mud density',m.sg.toFixed(2)+' SG',`> pore ${pp.toFixed(2)}`,m.sg>pp,'Weight up with barite');
 add('ECD',ecd.toFixed(2)+' SG',`< frac ${fr.toFixed(2)}`,ecd<fr-0.02,'Reduce flow rate or YP');
 add('Plastic viscosity',b.PV+' cP','< '+(m.type=='OBM'?30:25),b.PV<(m.type=='OBM'?30:25),'High PV: remove low-gravity solids (centrifuge, dilute)');
 add('Yield point',b.YP+' lbf/100ft²','8 – 25',b.YP>=8&&b.YP<=25,b.YP<8?'Low YP: add polymer/viscosifier for hole cleaning':'High YP: add thinner');
 add('6-rpm reading',m.fann[6],'≥ 1.0–1.5 × hole Ø (in)',m.fann[6]>=(o.holeIn??8.5)*1.0,'Low-shear reading low: poor cuttings suspension');
 add('Gels 10 s / 10 min',m.gel10s+' / '+m.gel10m,'flat, 10 min < 2.5 × 10 s',m.gel10m<2.5*m.gel10s&&m.gel10m<25,'Progressive gels: surge/swab risk, treat');
 add('Low-gravity solids',m.solids.lgs+' %vol','< 6 %',m.solids.lgs<6,'Run solids control, dilute');
 add('API fluid loss',m.fluidLoss+' mL/30 min','< 6',m.fluidLoss<6,'Add fluid-loss additive');
 if(m.type=='OBM')add('Electrical stability',m.es+' V','> 400',m.es>400,'Weak emulsion: add emulsifier/lime');
 else{add('pH',m.ph,'9 – 10.5',m.ph>=9&&m.ph<=10.5,'Adjust with caustic');add('MBT',m.mbt+' kg/m³','< 40',m.mbt<40,'Reactive clay build-up: dilute')}
 return r}
// ---------- Stage 2: hydraulics ----------
export function defWell(){return{md:3000,tvd:2800,inc:30,shoeMD:2000,shoeTVD:1900,holeD:8.5*IN,csgID:8.681*IN,
 string:[{n:'Drill pipe 5"',od:5*IN,id:4.276*IN,len:2790},{n:'HWDP 5"',od:5*IN,id:3*IN,len:110},{n:'Drill collars 6-1/2"',od:6.5*IN,id:2.8125*IN,len:100}],
 nozzles:[13,13,13,12,12],bitD:8.5*IN,surfCase:3,pump:{linerIn:6,strokeIn:12,eff:0.97,max_spm:140,n:2}}}
// API RP 13D surface equipment case: equivalent length of pipe (m) and ID (m)
const SURF={1:[61,3*IN],2:[97,3.5*IN],3:[134,4*IN],4:[146,4*IN]};
export const pumpOutput=(p,spm)=>Math.PI/4*(p.linerIn*IN)**2*(p.strokeIn*IN)*3*p.eff*spm/60;// triplex m³/s per pump
export const nozzleArea=nz=>nz.reduce((a,n)=>a+Math.PI/4*(n/32*IN)**2,0);
// friction factor, generalised Reynolds (API RP 13D-2010 power-law/HB form)
function fric(Re,n){const ReL=3470-1370*n,ReT=4270-1370*n,a=(lg(n)+3.93)/50,b=(1.75-lg(n))/7,fl=16/Re,ft=a/Re**b;if(Re<ReL)return{f:fl,reg:'laminar'};if(Re>ReT)return{f:ft,reg:'turbulent'};const fL=16/ReL,fT=a/ReT**b;return{f:fL+(Re-ReL)/(ReT-ReL)*(fT-fL),reg:'transition'}}
// pressure gradient (Pa/m) for pipe (Do=0) or annulus (Di inside Do)
export function gradient(m,Q,Do,Di=0,pipe=true){const rho=sg2rho(m.sg),A=pipe?Math.PI/4*Do**2:Math.PI/4*(Do**2-Di**2),V=Q/A;if(V<=0)return{V:0,dpdl:0,reg:'static',Re:0};
 const h=herschel(m),n=h.n,K=h.K,D=pipe?Do:Do-Di;
 const gw=pipe?(3*n+1)/(4*n)*8*V/D:(2*n+1)/(3*n)*12*V/D;// wall shear rate, s⁻¹
 const tw=(pipe?(4/3):1.5)**n*h.ty+K*gw**n;// API RP 13D (2010+) HB wall shear stress at corrected wall shear rate
 const Re=8*rho*V*V/tw,{f,reg}=fric(Re,n);const dpdl=2*f*rho*V*V/D;return{V,dpdl,reg,Re,gw,tw}}
export function hydraulics(m,w,Q,o={}){const rho=sg2rho(m.sg),out={Q,sections:[]};const [Ls,Ds]=SURF[w.surfCase||3];
 out.surf=gradient(m,Q,Ds).dpdl*Ls;let str=0,ann=0,depth=0;const segs=[...w.string];// bottom up for annulus
 for(const s of segs){const g=gradient(m,Q,s.id);str+=g.dpdl*s.len;s._g=g}
 // annulus: from bottom; cased above shoe, open hole below
 let top=w.md-segs.reduce((a,s)=>a+s.len,0);let mdS=top;const annSegs=[];
 for(const s of segs){const a0=mdS,a1=mdS+s.len;const parts=[];if(a1<=w.shoeMD)parts.push([a0,a1,w.csgID]);else if(a0>=w.shoeMD)parts.push([a0,a1,w.holeD]);else{parts.push([a0,w.shoeMD,w.csgID]);parts.push([w.shoeMD,a1,w.holeD])}
  for(const [x0,x1,Dh] of parts.filter(q=>q[1]-q[0]>0.5)){const g=gradient(m,Q,Dh,s.od,false);const dp=g.dpdl*(x1-x0);ann+=dp;annSegs.push({n:s.n+(Dh==w.holeD?' × open hole':' × casing'),from:x0,to:x1,Dh,od:s.od,V:g.V,dp,reg:g.reg,Re:g.Re})}mdS=a1}
 const An=nozzleArea(w.nozzles),Vn=Q/An,bit=rho*Q*Q/(2*0.95**2*An**2),hhp=bit*Q,bitA=Math.PI/4*w.bitD**2;
 const motor=o.motorDp||0,mwd=o.mwdDp??(Q>0?1.2e6*(Q/0.0379)**2:0);
 out.string=str;out.ann=ann;out.annSegs=annSegs;out.bit=bit;out.Vn=Vn;out.hhp=hhp;out.hsi=hhp/bitA;out.hsiImp=hhp/745.7/((w.bitD/IN)**2*Math.PI/4);out.impact=rho*Q*Vn*0.95;
 out.motor=motor;out.mwd=mwd;out.spp=out.surf+str+bit+ann+motor+mwd;out.pctBit=bit/out.spp;
 out.ecd=m.sg+ann/(G*w.tvd*1000);out.ecdShoe=m.sg+ann*(w.shoeMD/w.md)/(G*w.shoeTVD*1000);
 const oh=annSegs.filter(a=>a.Dh==w.holeD),ohDP=oh.reduce((a,b)=>a.V<b.V?a:b,{V:1e9});out.avMin=Math.min(...annSegs.map(a=>a.V));out.avDP=annSegs.find(a=>/Drill pipe/.test(a.n)&&a.Dh==w.holeD)?.V??out.avMin;
 return out}
// cuttings transport: slip velocity (Moore, API RP 13D annex), transport ratio, concentration, ECD with cuttings
export function cuttings(m,w,H,rop_mph,o={}){const rho=sg2rho(m.sg),ds=(o.dsMM??6)/1000,rs=(o.rhoS??2600),Va=H.avDP,Dh=w.holeD,Dp=w.string[0].od;
 const pl=powerLaw(m),n=pl.na,K=pl.Ka;if(Va<=0)return{Vs:0,Ft:0,Ca:0,ecdC:H.ecd,hci:0,ok:false,minAV:0};
 const mua=K*((2*n+1)/(3*n)*12*Va/(Dh-Dp))**(n-1);// apparent viscosity Pa·s
 let Vs=Math.sqrt(4*G*ds*(rs-rho)/(3*rho*1.5));for(let i=0;i<20;i++){const Rp=rho*Vs*ds/mua,Cd=Rp<3?24/Rp:Rp<300?22/Math.sqrt(Rp):1.5;Vs=Math.sqrt(4*G*ds*(rs-rho)/(3*rho*Cd))}
 const incF=1+(w.inc||0)/45*(w.inc<=60?1:0.8)*(1+ (w.inc>30&&w.inc<60?0.5:0));// Luo/Rubiandini-style inclination factor (approx)
 const VsI=Vs*incF,Ft=Math.max(0,1-VsI/Va),Ah=Math.PI/4*Dh*Dh,Qs=Ah*rop_mph/3600,Ca=Ft>0?Math.min(0.2,Qs/(Qs+H.Q*Ft)):0.2;
 const ecdC=H.ecd+(Ca*(rs-rho))/1000;const minAV=VsI/0.5;// transport ratio ≥ 0.5 target
 const rpmF=(o.rpm??120)/120;const hci=Math.min(2,Ft*rpmF**0.25*(m.fann[6]/(Dh/IN))**0.2);
 return{Vs,VsI,Ft,Ca,ecdC,minAV,hci,ok:Ft>=0.5&&Ca<0.05,mua}}
// surge & swab while tripping (Burkhardt clinging constant, closed or open end)
export function surgeSwab(m,w,vpipe,o={}){const closed=o.closed??true;let dp=0;const rows=[];let mdS=w.md-w.string.reduce((a,s)=>a+s.len,0);
 for(const s of w.string){const Dh=mdS+s.len>w.shoeMD?w.holeD:w.csgID,ann=Dh**2-s.od**2,Kc=closed?0.45:0.45;
  const Ve=Math.abs(vpipe)*(Kc+(closed?s.od**2:(s.od**2-s.id**2))/ann);const Qe=Ve*Math.PI/4*ann;const g=gradient(m,Qe,Dh,s.od,false);
  // gel break-over at start of trip
  const gelDp=4*m.gel10m*LB100/(Dh-s.od)*s.len*(o.gelBreak?1:0);dp+=g.dpdl*s.len+gelDp;rows.push({n:s.n,Ve,dp:g.dpdl*s.len});mdS+=s.len}
 const emw=dp/(G*w.tvd*1000);return{dp,emwSurge:m.sg+emw,emwSwab:m.sg-emw,rows}}
// max trip speed so swab stays above pore + margin and surge below frac − margin
export function tripLimits(m,w,pore,frac,margin=0.02){let lo=0.01,hi=3;const f=v=>{const s=surgeSwab(m,w,v);return s.emwSwab>=pore+margin&&s.emwSurge<=frac-margin};if(!f(lo))return 0;for(let i=0;i<40;i++){const mid=(lo+hi)/2;f(mid)?lo=mid:hi=mid}return lo}
// ROP effect of overbalance (chip hold-down, Bourgoyne-Young x4 style): ROP × exp(−k·Δρ·TVD)
export const ropFactor=(ecdSG,poreSG,tvd)=>Math.exp(-0.000105*Math.max(0,(ecdSG-poreSG)*1000)*tvd/100*0.1);
// ---------- Stage 4 helper: pore/frac window (uses helper D strat API when present) ----------
export function window_(tvd){const D=globalThis.GX?.strat;if(D?.pressureAt){try{const r=D.pressureAt(tvd);if(r&&isFinite(r.pore)&&isFinite(r.frac))return{...r,src:'strat'}}catch(e){}}
 // SIM fallback: normal 1.03 SG to 1500 m, ramp to 1.30 by 3200 m; Eaton-style frac with ν≈0.38 and overburden ~2.3 SG
 const pore=tvd<1500?1.03:Math.min(1.45,1.03+(tvd-1500)/1700*0.27),ob=1.9+0.4*Math.min(1,tvd/3000),k=0.38/0.62,frac=pore+k*(ob-pore);return{pore,frac,ob,src:'SIM'}}
export function windowProfile(maxTVD,step=50){const r=[];for(let z=step;z<=maxTVD;z+=step)r.push({tvd:z,...window_(z)});return r}

/* Weight-up / dilution (SIM). Mass balance, SG units. Barite SG 4.2 (API 13A), water 1.0.
   Barite per m³ of start mud, no volume limit: kg = 1000·ρw·SGb·(ρ2−ρ1)/(SGb−ρ2). */
export function weightUp(sg1,sg2,vol,agentSG=4.2){if(sg2<=sg1)return{kg:0,vAdd:0,vNew:vol,sacks:0};const vA=vol*(sg2-sg1)/(agentSG-sg2),kg=vA*agentSG*1000;return{kg,vAdd:vA,vNew:vol+vA,sacks:Math.ceil(kg/25)}}
export function dilute(sg1,sg2,vol,addSG=1.0){if(sg2>=sg1||sg2<=addSG)return{vAdd:0,vNew:vol};const vA=vol*(sg1-sg2)/(sg2-addSG);return{vAdd:vA,vNew:vol+vA}}

/* Downhole density and rheology correction (SIM). Volume-fraction mass balance with liquid
   compressibility and thermal expansion (Sorelle et al. 1982; Kutasov 1988 form ρ=ρ0·exp(γ·ΔP − α·ΔT)).
   Solids taken as incompressible. Rheology factor from base-fluid viscosity vs T and P (API RP 13D
   §on HTHP effects), referenced to 49 °C / 0.1 MPa (the 120 °F test temperature). Approximate coefficients. */
export const PT={water:{g:4.5e-10,a:3.5e-4},oil:{g:7.5e-10,a:7.5e-4},Tsurf:20,Tref:49,gradT:0.03,
 rhe:{wbm:{kT:0.008,kP:0},obm:{kT:0.013,kP:1.5e-9}}};
export function mudAt(m,P,T){const so=(m.solids?.lgs||0)+(m.solids?.hgs||0),liq=1-so/100,[o,wv]=m.type=='OBM'?(m.oilWater||[80,20]).map(x=>x/100):[0,1];
 const dP=Math.max(0,P-1e5),dT=T-PT.Tsurf,fw=Math.exp(PT.water.g*dP-PT.water.a*dT),fo=Math.exp(PT.oil.g*dP-PT.oil.a*dT);
 const f=liq*(o*fo+wv*fw)+(1-liq);// volume-weighted (good to <1 % for these ranges)
 const sg=m.sg*f,k=PT.rhe[m.type=='OBM'?'obm':'wbm'],fr=Math.exp(-k.kT*(T-PT.Tref)+k.kP*dP),fann={};
 for(const r in m.fann)fann[r]=m.fann[r]*fr;return{...m,sg,fann,_f:f,_fr:fr}}
export function hydroPT(m,tvd,o={}){const n=o.n||60,dz=tvd/n,gT=o.gradT??PT.gradT,Ts=o.Tsurf??PT.Tsurf;let P=1e5,prof=[];
 for(let i=0;i<n;i++){const z=(i+0.5)*dz,T=Ts+gT*z,ma=mudAt(m,P,T);P+=ma.sg*1000*G*dz;if(i%Math.ceil(n/6)==0||i==n-1)prof.push({z:Math.round(z),T,sg:ma.sg,pv:ma.fann[600]-ma.fann[300]})}
 const Pc=1e5+m.sg*1000*G*tvd,Tb=Ts+gT*tvd,b=mudAt(m,P,Tb);return{P,Pconst:Pc,dP:P-Pc,esd:(P-1e5)/(1000*G*tvd),Tb,sgBottom:b.sg,pvBottom:b.fann[600]-b.fann[300],prof}}
