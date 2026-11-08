// ddmotor_core.js (helper DD-motor): positive displacement mud motor management engine. Pure functions, no DOM.
// All spec values are generic SIM values (not a vendor sheet). Units: L/min, bar, kN·m, deg, deg/30 m, degC, h, t.
// Methods: motor RPM = flow x rev per volume (PDM handbooks), torque proportional to differential pressure,
// stall when diff pressure passes stall pressure, three-point bend geometry for yield, reactive torque toolface shift,
// elastomer life halves per +10 degC over rating (Arrhenius rule of thumb). See docs/ddmotor.md.
export const GAL=3.785411784;
export const MOTORS={
 m475:{id:'m475',name:'4-3/4 in 7:8 lobe 3.8 stg',od:120.7,lobes:'7:8',stages:3.8,rev_gal:0.52,flow:[450,1100],dPmax:40,stallF:1.35,tqPerBar:0.11,bendMax:2.12,L1:1.4,L2:9.6,maxTemp:150,statorLife:180,bearLife:250},
 m675:{id:'m675',name:'6-3/4 in 7:8 lobe 5.0 stg',od:171.5,lobes:'7:8',stages:5.0,rev_gal:0.28,flow:[1100,2300],dPmax:55,stallF:1.35,tqPerBar:0.27,bendMax:2.12,L1:1.8,L2:11.2,maxTemp:150,statorLife:200,bearLife:300},
 m800:{id:'m800',name:'8 in 4:5 lobe 5.3 stg',od:203.2,lobes:'4:5',stages:5.3,rev_gal:0.16,flow:[1900,3400],dPmax:60,stallF:1.35,tqPerBar:0.48,bendMax:1.83,L1:2.1,L2:12.4,maxTemp:150,statorLife:220,bearLife:320}};
export const BENDS=[0,0.39,0.78,1.15,1.5,1.83,2.12];
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
export const revPerL=m=>m.rev_gal/GAL;
// no-load motor RPM from flow
export const rpmNoLoad=(m,flow)=>flow*revPerL(m);
// diff pressure from WOB: bit torque T = mu*WOB*g*D/3 (Pessier & Fear; PDC mu SIM 0.9), dP = T / torque-per-bar
export function dPfromWob(m,wob,{mu=0.9,bitD=null,lith=1}={}){const D=(bitD||m.od*1.25)/1000;const T=mu*lith*wob*9.80665*D/3;return {T:+T.toFixed(2),dP:+(T/m.tqPerBar).toFixed(1)}}
// three-point geometry: yield DLS deg/30m = 2*bend/(L1+L2)*30 (L in m)
export const yieldDLS=(m,bend)=>+(2*bend/(m.L1+m.L2)*30).toFixed(2);
// max surface RPM allowed when rotating with a bend (SIM practice table)
export function rotateLimit(bend){if(bend<=0.78)return 80;if(bend<=1.15)return 60;if(bend<=1.5)return 45;if(bend<=1.83)return 30;return 0}
// reactive torque turns toolface to the left (counter-clockwise) as diff pressure rises; SIM 1.2 deg per bar
export const reactiveTF=(dP,k=1.2)=>+(-k*dP).toFixed(1);
export const norm360=a=>((a%360)+360)%360;
export const tfMode=inc=>inc<5?'MTF':'GTF';
export function state(m,{flow,wob,bend=0,rpm=0,rotating=false,inc=30,tfSet=0,temp=80,lith=1,offBottom=false,sppOff=null}){
 const w=[];const {dP:dPw,T}=offBottom?{dP:0,T:0}:dPfromWob(m,wob,{lith});const dPstall=m.dPmax*m.stallF;const stall=!offBottom&&flow>0&&dPw>=dPstall;
 const dP=stall?+dPstall.toFixed(1):dPw;const r0=rpmNoLoad(m,flow);const slip=0.25*(dP/m.dPmax)**2;const mRpm=stall?0:Math.max(0,r0*(1-slip));
 const tq=+(dP*m.tqPerBar).toFixed(2);const off=sppOff??+(8+flow*flow*1.6e-5).toFixed(1);const spp=+(off+dP+(stall?25:0)).toFixed(1);
 const tfShift=rotating?0:reactiveTF(dP);const tfAct=norm360(tfSet+tfShift);const lim=rotateLimit(bend);
 if(flow<m.flow[0]||flow>m.flow[1])w.push('FLOW OUT OF RANGE');if(dP>0.8*m.dPmax&&!stall)w.push('DIFF P HIGH');if(stall)w.push('STALL');
 if(rotating&&rpm>lim)w.push('ROTATE-WITH-BEND LIMIT');if(bend>m.bendMax)w.push('BEND ABOVE MOTOR MAX');if(temp>m.maxTemp)w.push('TEMP ABOVE STATOR RATING');
 return {flow,dP,dPstall:+dPstall.toFixed(1),sppOff:off,spp,motorRpm:Math.round(mRpm),noLoadRpm:Math.round(r0),bitRpm:Math.round(mRpm+(rotating?rpm:0)),torque:tq,bitTorque:T,tfSet,tfShift,tfAct,tfMode:tfMode(inc),yield:yieldDLS(m,bend),rotLimit:lim,stall,warn:w,src:'SIM'}}
// stall recovery steps (standard practice)
export const STALL_STEPS=['Stop the slide. Pick up off bottom at once.','Do not increase flow. Let SPP go back to the off-bottom value.','Do a check of flow rate. Keep it in the motor flow range.','Tag bottom slowly with half the last WOB.','Increase WOB in small steps. Keep diff pressure below 80 % of max.','Record the stall in the motor run log.'];
// wear: stator hours weighted by load and temperature, bearing wear by WOB
export function newWear(){return {hours:0,statorEq:0,bearEq:0,stalls:0,maxTemp:0,src:'SIM'}}
export function wearStep(m,W,st,hours,{temp=80,wob=0}={}){const load=cl(st.dP/m.dPmax,0,2);const tf=2**Math.max(0,(temp-(m.maxTemp-30))/10);
 W.hours+=hours;W.statorEq+=hours*(0.3+load**2)*tf*(st.stall?20:1);W.bearEq+=hours*(0.5+wob/20);if(st.stall)W.stalls++;W.maxTemp=Math.max(W.maxTemp,temp);return W}
export function health(m,W){const s=cl(1-W.statorEq/m.statorLife,0,1),b=cl(1-W.bearEq/m.bearLife,0,1);const h=Math.min(s,b);
 return {stator:+(s*100).toFixed(0),bearing:+(b*100).toFixed(0),pull:h<0.15||W.stalls>=5,warn:h<0.3||W.stalls>=3,src:'SIM'}}
// temperature: SIM geothermal 3 degC/100 m + motor heat from load
export const temp=(tvd,dP,m)=>+(20+0.03*tvd+12*cl(dP/m.dPmax,0,1.5)).toFixed(1);
// slide sheet helper: slide length to get the required DLS change over a course
export function slideFor(m,bend,needDLS,course=30){const y=yieldDLS(m,bend);if(y<=0)return {slide:0,rotate:course,ok:false,yield:y};const s=cl(needDLS/y*course,0,course);return {slide:+s.toFixed(1),rotate:+(course-s).toFixed(1),ok:needDLS<=y,yield:y}}
// simple run: apply a sequence of steps, return log
export function run(m,steps,opt={}){const W=newWear();const log=[];for(const p of steps){const t=temp(opt.tvd||2000,0,m);const st=state(m,{...p,temp:t});wearStep(m,W,st,p.h||0.5,{temp:temp(opt.tvd||2000,st.dP,m),wob:p.wob});log.push(st)}return {log,wear:W,health:health(m,W)}}
