// ddcab_core.js (helper DD-cabin): directional driller training engine. Pure functions, no DOM. All generic values are SIM.
// Methods: minimum curvature (Taylor & Mason 1972, SPE 3362), dogleg/toolface relations (ISCWSA / Inglis), PDM power section
// relations (motor RPM = flow x rev per volume, torque proportional to differential pressure; NOV / Halliburton motor handbooks),
// three-point bend geometry for motor yield. Units: m, deg, deg/30 m, t, L/min, bar, degC.
export const R=Math.PI/180,D=180/Math.PI,GAL=3.78541;
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
export function mulberry(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// ---- survey maths ----
export function vec(inc,azi){return [Math.sin(inc*R)*Math.sin(azi*R),Math.sin(inc*R)*Math.cos(azi*R),Math.cos(inc*R)]} // E,N,V
export function dogleg(i1,a1,i2,a2){const c=Math.cos((i2-i1)*R)-Math.sin(i1*R)*Math.sin(i2*R)*(1-Math.cos((a2-a1)*R));return Math.acos(cl(c,-1,1))*D}
export function minCurve(s1,md,inc,azi){const dl=dogleg(s1.inc,s1.azi,inc,azi)*R,L=md-s1.md,rf=dl>1e-7?2/dl*Math.tan(dl/2):1;
 const a=vec(s1.inc,s1.azi),b=vec(inc,azi),f=L/2*rf;return {md,inc,azi:((azi%360)+360)%360,E:s1.E+f*(a[0]+b[0]),N:s1.N+f*(a[1]+b[1]),tvd:s1.tvd+f*(a[2]+b[2]),dls:L>0?dl*D*30/L:0}}
// new direction after a course L with dogleg rate dls (deg/30m) at gravity toolface tf (deg from high side)
export function steer(inc,azi,dls,tf,L){const dl=dls*L/30*R;if(dl<1e-9)return {inc,azi};const i=inc*R,a=azi*R,t=tf*R;
 const T=vec(inc,azi),H=[Math.cos(i)*Math.sin(a),Math.cos(i)*Math.cos(a),-Math.sin(i)],Rt=[Math.cos(a),-Math.sin(a),0];
 const n=[0,1,2].map(k=>Math.cos(t)*H[k]+Math.sin(t)*Rt[k]),v=[0,1,2].map(k=>Math.cos(dl)*T[k]+Math.sin(dl)*n[k]);
 const ni=Math.acos(cl(v[2],-1,1))*D;let na=Math.atan2(v[0],v[1])*D;if(ni<0.01)na=azi;return {inc:ni,azi:(na+360)%360}}
// toolface needed to go from (i1,a1) to (i2,a2): returns {dl, tf}
export function requiredTF(i1,a1,i2,a2){const dl=dogleg(i1,a1,i2,a2);if(dl<1e-6)return {dl:0,tf:0};const T=vec(i1,a1),V=vec(i2,a2),i=i1*R,a=a1*R;
 const H=[Math.cos(i)*Math.sin(a),Math.cos(i)*Math.cos(a),-Math.sin(i)],Rt=[Math.cos(a),-Math.sin(a),0];const dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
 const p=[0,1,2].map(k=>V[k]-dot(V,T)*T[k]);let tf=Math.atan2(dot(p,Rt),dot(p,H))*D;return {dl,tf:(tf+360)%360}}
export const mtf=(gtf,azi)=>((azi+gtf)%360+360)%360; // magnetic TF used below ~5 deg inc
// ---- mud motor (SIM spec sheet, generic 6-3/4 in 7:8 lobe) ----
export const MOTOR={name:'SIM 6-3/4 in PDM, 7:8 lobe, 4.0 stage',od_in:6.75,lobes:'7:8',stages:4.0,bend:1.5,rev_gal:0.28,dPmax:52,flow:[1100,2400],stallTq:16.3,
 bitToBend:1.6,bendToStab:11.4,maxRotBend:1.83,maxRotRpm:60,statorLife:180,maxTemp:150,src:'SIM generic (handbook-style values)'};
export const motorRevL=m=>m.rev_gal/GAL;
export function yieldDLS(m,f=1){return 60*m.bend/(m.bitToBend+m.bendToStab)*f} // three-point geometry, deg/30m (SIM factor f for formation/side force)
export function motorState(m,{flow,wob,rotating,rpm,lith=1,offBottom=false}){const fl=cl(flow,0,4000),q=Math.max(0,fl);
 let dP=offBottom?0:cl(wob,0,40)*4.2*lith; const stall=dP>=m.dPmax&&!offBottom;const sppOff=+(30+ (q/1000)**1.8*48).toFixed(1); // SIM system loss
 const mRpm=stall?0:q*motorRevL(m)*(1-0.35*Math.min(1,dP/m.dPmax)**2);const tq=stall?m.stallTq:m.stallTq*Math.min(1,dP/m.dPmax);
 const spp=sppOff+(stall?m.dPmax*1.25:dP);const bitRpm=mRpm+(rotating?rpm:0);
 const warn=[];if(q<m.flow[0]||q>m.flow[1])warn.push('FLOW OUT OF RANGE');if(rotating&&(m.bend>m.maxRotBend||rpm>m.maxRotRpm))warn.push('ROTATE-WITH-BEND LIMIT');if(stall)warn.push('STALL');
 return {flow:q,dP:+dP.toFixed(1),spp:+spp.toFixed(1),sppOff,motorRpm:+mRpm.toFixed(0),bitRpm:+bitRpm.toFixed(0),torque:+tq.toFixed(1),stall,warn}}
export function ropOf(ms,{wob,lithRop=1,rotating}){if(ms.stall||wob<=0)return 0;return +(cl(wob,0,30)*0.9*Math.sqrt(Math.max(ms.bitRpm,1)/150)*lithRop*(rotating?1.25:0.8)).toFixed(1)} // m/h SIM
export const STALL_STEPS=['Stop the slide. Pick up off bottom.','Let SPP go back to the off-bottom value.','Do a check of flow rate. Keep it in the motor flow range.','Tag bottom slowly. Set less WOB (start at half).','Increase WOB in small steps. Keep diff pressure below 80 % of max.'];
// ---- plan + scenarios ----
export function planPath({kop,bur,inc,azi,land=null,td}){const P=[{md:0,inc:0,azi,E:0,N:0,tvd:0,dls:0}];let s=P[0];const step=10;
 while(s.md<td){const md=s.md+step;let i=s.inc;if(md>kop&&i<inc)i=Math.min(inc,i+bur*step/30);if(land&&md>land.md&&i<land.inc)i=Math.min(land.inc,i+land.bur*step/30);s=minCurve(s,md,i,azi);P.push(s)}return P}
export const SCEN={
 build:{name:'Build to target',plan:{kop:300,bur:3,inc:30,azi:45,td:1100},start:{md:300,inc:0.5,azi:45},endMd:900,dlsMax:5,desc:'Kick off at 300 m. Build to 30 deg at azimuth 45 deg with 3 deg/30 m.'},
 tangent:{name:'Hold tangent',plan:{kop:200,bur:3,inc:45,azi:120,td:1400},start:{md:650,inc:44,azi:121.5},endMd:1150,dlsMax:2,desc:'Hold 45 deg and azimuth 120 deg. The formation walks the bit.',walk:0.6},
 land:{name:'Land in target zone',plan:{kop:300,bur:3,inc:60,azi:45,land:{md:1100,inc:89,bur:6},td:2000},start:{md:1100,inc:60,azi:45},endMd:1700,dlsMax:8,desc:'Land at 89 deg inside the target zone, then stay in zone.',zone:true},
 collide:{name:'Avoid offset well',plan:{kop:250,bur:2.5,inc:25,azi:90,td:1200},start:{md:400,inc:3.5,azi:90},endMd:1000,dlsMax:4,desc:'An offset well is close on the plan. Keep separation factor above 1.5.',offsets:[{name:'OFFSET-A (SIM)',E0:105,N0:-2,inc:12,azi:270,kop:300}]}};
export function offsetPath(o,td=1400){const P=[{md:0,inc:0,azi:o.azi,E:o.E0,N:o.N0,tvd:0}];let s=P[0];while(s.md<td){const md=s.md+20;s=minCurve(s,md,md>o.kop?o.inc:0,o.azi);P.push(s)}return P}
export function closest(P,pt){let best={d:Infinity};for(let k=1;k<P.length;k++){const a=P[k-1],b=P[k],ab=[b.E-a.E,b.N-a.N,b.tvd-a.tvd],ap=[pt.E-a.E,pt.N-a.N,pt.tvd-a.tvd],L2=ab[0]**2+ab[1]**2+ab[2]**2||1;
 const t=cl((ab[0]*ap[0]+ab[1]*ap[1]+ab[2]*ap[2])/L2,0,1),q={E:a.E+t*ab[0],N:a.N+t*ab[1],tvd:a.tvd+t*ab[2],md:a.md+t*(b.md-a.md)},d=Math.hypot(pt.E-q.E,pt.N-q.N,pt.tvd-q.tvd);if(d<best.d)best={d,...q}}return best}
// travelling cylinder: offset position in plane normal to the wellbore, angle from high side (deg, clockwise)
export function tcPoint(st,offP){const c=closest(offP,st),T=vec(st.inc,st.azi),i=st.inc*R,a=st.azi*R;const H=[Math.cos(i)*Math.sin(a),Math.cos(i)*Math.cos(a),-Math.sin(i)],Rt=[Math.cos(a),-Math.sin(a),0];
 const v=[c.E-st.E,c.N-st.N,c.tvd-st.tvd],dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];let ang=Math.atan2(dot(v,Rt),dot(v,H))*D;if(st.inc<5)ang=Math.atan2(v[0],v[1])*D; // north ref when near vertical
 const unc=0.0075*(st.md+c.md)+1; // SIM error ellipse sum (m), ISCWSA-style growth with MD
 return {d:c.d,ang:(ang+360)%360,sf:+(c.d/unc).toFixed(2),omd:c.md}}
// target zone: band in TVD versus horizontal departure along plan azimuth. fn(x)->{top,base}. Default SIM band; UI may pass strat.targetFn.
export function simZone(top0=0,x0=0,th=5){return x=>{const top=top0+0.02*(x-x0)+1.2*Math.sin((x-x0)/220);return {top,base:top+th,src:'SIM'}}}
export function landPoint(plan){return plan.find(p=>p.inc>=88.5)||plan.at(-1)}
// rebase a strat.targetFn-style fn(x)->{top,base} so the zone sits on the plan landing point (keeps its shape and thickness)
export function rebaseZone(fn,plan){const L=landPoint(plan),x0=Math.hypot(L.E,L.N),z0=fn(x0),mid=(z0.top+z0.base)/2,off=L.tvd-mid;return x=>{const z=fn(x);return {top:z.top+off,base:z.base+off,src:z.src||'SIM'}}}
// ---- the scripted driller ----
const STE={rotate:(n)=>`Rotate ${n} m.`,slide:(n,t)=>`Slide ${n} m at toolface ${t} deg.`,wob:v=>`Set WOB to ${v} t.`,flow:v=>`Set flow rate to ${v} L/min.`,rpm:v=>`Set surface RPM to ${v}.`,survey:()=>'Take a survey.'};
export function parse(txt){const s=String(txt||'').toLowerCase().replace(/,/g,' ');let m;
 if(m=s.match(/slide\s+(\d+(?:\.\d+)?)\s*m?\b.*?(?:tf|toolface)\s*(-?\d+(?:\.\d+)?)\s*([lr])?/)){let t=+m[2];if(m[3]=='l')t=360-t;return {cmd:'slide',len:+m[1],tf:(t%360+360)%360}}
 if(m=s.match(/rotate\s+(\d+(?:\.\d+)?)/))return {cmd:'rotate',len:+m[1]};
 if(m=s.match(/wob\D*(\d+(?:\.\d+)?)/))return {cmd:'wob',v:+m[1]};
 if(m=s.match(/flow\D*(\d+(?:\.\d+)?)/))return {cmd:'flow',v:+m[1]};
 if(m=s.match(/rpm\D*(\d+(?:\.\d+)?)/))return {cmd:'rpm',v:+m[1]};
 if(/survey/.test(s))return {cmd:'survey'};if(/pick ?up|off ?bottom/.test(s))return {cmd:'pickup'};return null}
export function ste(c){if(!c)return '';const f=STE[c.cmd];return f?f(c.len??c.v,c.tf!=null?Math.round(c.tf):undefined):c.cmd=='pickup'?'Pick up off bottom.':''}
// Motor management (stall, limits, fatigue, spec sheet) belongs to the dd-motor helper: pass o.motorFn(motor,opts)->motorState-like object.
// Without it the cabin uses a plain SIM motor with no stall.
export function newSession(key='build',o={}){const S=SCEN[key];const plan=planPath(S.plan);const p0=closest(plan,{E:0,N:0,tvd:0});
 let st=plan[0];for(const p of plan)if(p.md<=S.start.md)st=p; st={...minCurve(st,S.start.md,S.start.inc,S.start.azi),dls:0};
 return {key,S,plan,motor:{...MOTOR,...(o.motor||{})},motorFn:o.motorFn||null,rng:mulberry(o.seed||7),zoneFn:o.zoneFn?rebaseZone(o.zoneFn,plan):(()=>{const L=landPoint(plan);return simZone(L.tvd-2.5,Math.hypot(L.E,L.N))})(),offsets:(S.offsets||[]).map(x=>({...x,P:offsetPath(x)})),
  bit:{...st},surveys:[{...st}],lastSurveyMd:st.md,set:{wob:8,flow:1800,rpm:40},rotating:false,stalled:false,mode:'idle',hours:0,statorH:0,temp:0,log:[],time:0,events:[],zoneL:0,totL:0,dlsOver:0,maxDev:0,minSF:Infinity,slideMd:0,rotMd:0,mwdOffset:15}}
export function lithFactor(sess){return 1} // UI replaces with strat response
export function bitTemp(tvd,dP,dPmax){return +(20+0.03*tvd+12*Math.min(1,dP/dPmax)).toFixed(1)} // SIM geothermal 3 degC/100 m + motor heat
// drill one course; returns events
function drill(sess,len,rot,tf){const m=sess.motor,ev=[];const sub=Math.max(1,Math.ceil(len/2)),dl=len/sub;let done=0;
 for(let k=0;k<sub;k++){const lr=sess.lith?sess.lith(sess.bit):{rop:1,dP:1};const mf=sess.motorFn||((mm,o)=>motorState({...mm,dPmax:1e9},o));const ms=mf(m,{flow:sess.set.flow,wob:sess.set.wob,rotating:rot,rpm:sess.set.rpm,lith:lr.dP??1});
  if(ms.stall){sess.stalled=true;ev.push({t:'stall',md:sess.bit.md,ms});break}
  const rop=ropOf(ms,{wob:sess.set.wob,lithRop:lr.rop??1,rotating:rot});let tfAct=tf;
  let dls;if(rot){dls=0.15+(sess.S.walk||0)*0.25;tfAct=sess.S.walk?90:180}else{dls=yieldDLS(m,0.9+0.2*sess.rng());tfAct=tf+(sess.rng()-.5)*16} // SIM scatter: reactive torque
  const nd=steer(sess.bit.inc,sess.bit.azi,dls,tfAct,dl);const b=minCurve(sess.bit,sess.bit.md+dl,nd.inc,nd.azi);b.dls=dls;
  const h=dl/Math.max(rop,0.1);sess.hours+=h;sess.time+=h;sess.statorH+=h*(1+ms.dP/m.dPmax);sess.temp=bitTemp(b.tvd,ms.dP,m.dPmax);
  if(rot)sess.rotMd+=dl;else sess.slideMd+=dl;sess.bit=b;done+=dl;sess.last=ms;sess.lastRop=rop;
  const pc=closest(sess.plan,b);sess.maxDev=Math.max(sess.maxDev,pc.d);sess.devSum=(sess.devSum||0)+pc.d*dl;sess.totL+=dl;
  if(sess.S.zone){const x=Math.hypot(b.E,b.N),z=sess.zoneFn(x);if(b.tvd>=z.top&&b.tvd<=z.base)sess.zoneL+=dl}
  for(const o of sess.offsets){const t=tcPoint(b,o.P);sess.minSF=Math.min(sess.minSF,t.sf);if(t.sf<1.5&&!sess.sfWarn){sess.sfWarn=1;ev.push({t:'sf',sf:t.sf})}}
  if(ms.warn.includes('ROTATE-WITH-BEND LIMIT'))ev.push({t:'rotlimit'})}
 return {done,ev}}
// Data primitives for plug-ins (dd-driller / dd-motor helpers): drill a course and take a survey. They change only the SIM session.
export function drillCourse(sess,len,rotate=false,tf=0){return drill(sess,len,rotate,tf)}
export function takeSurvey(sess){const pv=sess.surveys.at(-1),s={...sess.bit};s.dls=s.md>pv.md?dogleg(pv.inc,pv.azi,s.inc,s.azi)*30/(s.md-pv.md):0;sess.surveys.push(s);sess.lastSurveyMd=s.md;sess.time+=0.05;return s}
// Reference only: simple instruction parser + driller script. NOT wired in the cabin UI; the dd-driller helper owns this (GX.ddcab.onInstruction).
export function command(sess,c){if(typeof c=='string')c=parse(c);const say=[];if(!c)return {ok:false,say:['Driller: I do not understand. Say again. Example: "Slide 10 m at TF 30".']};
 say.push('You: '+ste(c));const m=sess.motor;
 if(sess.stalled&&c.cmd!='pickup'&&c.cmd!='wob'&&c.cmd!='flow'&&c.cmd!='survey'){say.push('Driller: The motor is stalled. Tell me to pick up off bottom first.');return {ok:false,say}}
 switch(c.cmd){case 'pickup':sess.stalled=false;say.push('Driller: I picked up off bottom. SPP is back to '+motorState(m,{flow:sess.set.flow,wob:0,offBottom:true}).spp+' bar.');break;
  case 'wob':sess.set.wob=cl(c.v,0,40);say.push(`Driller: WOB is set to ${sess.set.wob} t.`);break;
  case 'flow':sess.set.flow=cl(c.v,0,4000);say.push(`Driller: Flow rate is set to ${sess.set.flow} L/min.`+(sess.set.flow<m.flow[0]||sess.set.flow>m.flow[1]?' Caution: this is out of the motor flow range.':''));break;
  case 'rpm':sess.set.rpm=cl(c.v,0,200);say.push(`Driller: Surface RPM is set to ${sess.set.rpm}.`);break;
  case 'survey':{const pv=sess.surveys.at(-1),s={...sess.bit};s.dls=s.md>pv.md?dogleg(pv.inc,pv.azi,s.inc,s.azi)*30/(s.md-pv.md):0;sess.surveys.push(s);sess.lastSurveyMd=s.md;sess.time+=0.05;say.push(`Driller: Survey is complete. MD ${s.md.toFixed(1)} m, Inc ${s.inc.toFixed(2)} deg, Azi ${s.azi.toFixed(2)} deg.`);break}
  case 'rotate':case 'slide':{const rot=c.cmd=='rotate';sess.rotating=rot;say.push('Driller: Copy. '+ste(c)+' I start now.');const r=drill(sess,c.len,rot,c.tf||0);
   for(const e of r.ev){if(e.t=='stall')say.push(`Driller: STALL at ${e.md.toFixed(1)} m. SPP jumped to ${e.ms.spp} bar and ROP is zero. I stopped.`);if(e.t=='sf')say.push(`Driller: Caution. Separation factor is ${e.sf}. It is less than 1.5.`)}
   if(r.ev.some(e=>e.t=='rotlimit'))say.push('Driller: Caution. Surface RPM or bend is above the rotate-with-bend limit.');
   if(!sess.stalled)say.push(`Driller: ${rot?'Rotation':'Slide'} is complete. I drilled ${r.done.toFixed(1)} m.`);sess.rotating=false;break}}
 sess.log.push(...say);return {ok:true,say}}
// projection to bit from last survey using the last course DLS/TF (simple: use bit state, which is the known sim truth; projected = survey extrapolated with rate)
export function projectToBit(sess){const s=sess.surveys.at(-1),n=sess.surveys.at(-2);const L=sess.bit.md-s.md;if(L<=0)return {...s,L:0};
 let dls=0,tf=0;if(n&&s.md>n.md){const r=requiredTF(n.inc,n.azi,s.inc,s.azi);dls=r.dl*30/(s.md-n.md);tf=r.tf}const d=steer(s.inc,s.azi,dls,tf,L);return {...minCurve(s,sess.bit.md,d.inc,d.azi),L,dls}}
// slide/rotate recommendation to reach (inc,azi) in course L
export function recommend(sess,inc,azi,L){const p=projectToBit(sess),r=requiredTF(p.inc,p.azi,inc,azi),need=r.dl*30/L,y=yieldDLS(sess.motor);const slide=cl(r.dl/y*30,0,L);
 return {need:+need.toFixed(2),yield:+y.toFixed(2),tf:Math.round(r.tf),slide:+slide.toFixed(1),rotate:+(L-slide).toFixed(1),ratio:+(slide/L*100).toFixed(0),ok:need<=y}}
export function planTarget(sess,ahead=30){const md=sess.bit.md+ahead;let a=sess.plan[0];for(const p of sess.plan)if(p.md<=md)a=p;return a}
export function score(sess){const avgDev=sess.totL?sess.devSum/sess.totL:0,zone=sess.S.zone?(sess.totL?sess.zoneL/sess.totL*100:0):null;
 const dls=sess.surveys.reduce((m,s)=>Math.max(m,s.dls||0),0),over=Math.max(0,dls-sess.S.dlsMax);let pts=100-avgDev*2-over*10-Math.max(0,sess.time-(sess.S.endMd-sess.S.start.md)/8)*0.5; // SIM time allowance: 8 m/h average
 if(zone!=null)pts=pts*0.5+zone*0.5;if(sess.offsets.length&&sess.minSF<1.5)pts-=30;
 return {avgDev:+avgDev.toFixed(1),maxDev:+sess.maxDev.toFixed(1),maxDLS:+dls.toFixed(2),dlsOver:over>0,hours:+sess.time.toFixed(1),zone:zone==null?null:+zone.toFixed(0),minSF:isFinite(sess.minSF)?sess.minSF:null,score:Math.round(cl(pts,0,100)),done:sess.bit.md>=sess.S.endMd}}
