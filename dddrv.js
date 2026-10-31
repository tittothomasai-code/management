// dddrv.js (helper DD-driller): steering instructions + scripted driller response for DD Training. All values SIM.
// Flow per instruction: parse -> validate -> read-back (driller says the order back) -> execute in steps (orient TF, slide/rotate footage) -> survey -> score.
// Hook: if GX.ddcab.onInstruction(fn) exists (cabin, feat/dd-cabin) we register handle(); the cabin passes {text|cmd, state}. Mud motor (feat/dd-motor) is used through
// GX.ddmotor.state({flow,wob,rotating}) when present (stall, diff pressure, yield); else a SIM fallback. No shared files are edited. No network calls.
// Methods: minimum curvature (SPE/ISCWSA), toolface steering with motor yield (three-point geometry), slide-sheet practice (orient, then slide; rotate holds).
const R=Math.PI/180,D=180/Math.PI,cl=(x,a,b)=>Math.max(a,Math.min(b,x)),n360=a=>((a%360)+360)%360;
export const LIMITS={maxFt:30,minFt:0.5,tfTol:15,dlsMax:6,wob:[0,30],flow:[1100,2400],src:'SIM'}; // m, deg, deg/30m, t, L/min
const NUM='(-?\\d+(?:\\.\\d+)?)';
export function parse(txt){const s=String(txt||'').toLowerCase().replace(/,/g,' ').replace(/\s+/g,' ').trim();let m;
 const len=(m=s.match(new RegExp(NUM+'\\s*(m|ft|feet|metres?|meters?)\\b')))?(m[2]=='ft'||m[2]=='feet'?+m[1]*0.3048:+m[1]):(m=s.match(new RegExp('(?:slide|rotate)\\s+'+NUM)))?+m[1]:null;
 const tf=(m=s.match(new RegExp('(?:tf|toolface|tool face)\\s*(?:at\\s*)?'+NUM)))?+m[1]:(m=s.match(/\b(hs|high side)\b/))?0:(m=s.match(/\b(ls|low side)\b/))?180:null;
 if(/^slide|\bslide\b/.test(s))return {cmd:'slide',len,tf};
 if(/\brotate\b/.test(s))return {cmd:'rotate',len};
 if(/\bsurvey\b/.test(s))return {cmd:'survey'};
 if((m=s.match(new RegExp('wob\\s*(?:to\\s*)?'+NUM))))return {cmd:'wob',v:+m[1]};
 if((m=s.match(new RegExp('flow\\s*(?:to\\s*)?'+NUM))))return {cmd:'flow',v:+m[1]};
 if(/pick ?up|off bottom/.test(s))return {cmd:'pickup'};
 return null}
export function validate(c,st){if(!c)return {ok:false,why:'I do not understand. Say again. Example: "Slide 10 m at TF 30".'};
 if(c.cmd=='slide'||c.cmd=='rotate'){if(c.len==null)return {ok:false,why:'Give the length. Example: "'+(c.cmd=='slide'?'Slide 10 m at TF 30':'Rotate 20 m')+'".'};
  if(c.len<LIMITS.minFt||c.len>LIMITS.maxFt)return {ok:false,why:`Length must be ${LIMITS.minFt} to ${LIMITS.maxFt} m for one order.`}}
 if(c.cmd=='slide'&&c.tf==null)return {ok:false,why:'Give the toolface. Example: "TF 30" or "high side".'};
 if(c.cmd=='slide'&&(c.tf<-180||c.tf>360))return {ok:false,why:'Toolface must be -180 to 360 deg.'};
 if(c.cmd=='wob'&&(c.v<LIMITS.wob[0]||c.v>LIMITS.wob[1]))return {ok:false,why:`WOB must be ${LIMITS.wob[0]} to ${LIMITS.wob[1]} t.`};
 if(c.cmd=='flow'&&(c.v<LIMITS.flow[0]||c.v>LIMITS.flow[1]))return {ok:false,why:`Flow must be in the motor range ${LIMITS.flow[0]} to ${LIMITS.flow[1]} L/min.`};
 if((c.cmd=='slide'||c.cmd=='rotate')&&st&&st.stall)return {ok:false,why:'The motor is stalled. Pick up off bottom first.'};
 return {ok:true}}
export function readback(c){const f=x=>(+x).toFixed(1).replace(/\.0$/,'');switch(c.cmd){
 case 'slide':return `Copy. Slide ${f(c.len)} m at toolface ${Math.round(n360(c.tf))} deg.`;case 'rotate':return `Copy. Rotate ${f(c.len)} m.`;
 case 'survey':return 'Copy. Stop and take a survey.';case 'wob':return `Copy. Set WOB to ${f(c.v)} t.`;case 'flow':return `Copy. Set flow to ${f(c.v)} L/min.`;case 'pickup':return 'Copy. Pick up off bottom.'}return ''}
export function newState(o={}){return {md:o.md??500,inc:o.inc??0,azi:o.azi??0,tvd:o.tvd??o.md??500,N:0,E:0,wob:o.wob??8,flow:o.flow??1800,tf:0,stall:false,bend:o.bend??1.5,
 yieldDls:o.yieldDls??4.5,rotDls:o.rotDls??0.2,rng:o.seed??7,log:[],scores:[],surveys:[{md:o.md??500,inc:o.inc??0,azi:o.azi??0,src:'SIM'}],src:'SIM'}}
function rnd(st){st.rng=(st.rng*16807)%2147483647;return st.rng/2147483647-0.5}
function motor(st,rotating){const M=globalThis.GX?.ddmotor;if(M?.state){try{const q=M.state({flow:st.flow,wob:st.wob,rotating});if(q)return {...q,src:q.src||'SIM'}}catch(e){}}
 const dP=st.wob*4.2;return {dP,stall:dP>52*0.95*14.5/14.5&&st.wob>12.4,yieldDls:st.yieldDls,src:'SIM'}} // SIM fallback: stall above ~12.4 t
// step the wellbore L metres at dogleg severity dls (deg/30m) along toolface tf (deg from high side); minimum curvature position update
export function step(st,L,dls,tf){const dl=dls*L/30*R,i1=st.inc*R,a1=st.azi*R;let i2=i1,a2=a1;if(dl>1e-9){const t=tf*R;
 const ci=Math.cos(i1)*Math.cos(dl)-Math.sin(i1)*Math.sin(dl)*Math.cos(t);i2=Math.acos(cl(ci,-1,1));
 if(Math.sin(i2)>1e-9){const da=Math.atan2(Math.sin(t)*Math.sin(dl)*Math.sin(i1),Math.cos(dl)-Math.cos(i1)*Math.cos(i2));a2=a1+da}}
 const b=Math.acos(cl(Math.cos(i2-i1)-Math.sin(i1)*Math.sin(i2)*(1-Math.cos(a2-a1)),-1,1)),rf=b>1e-7?2/b*Math.tan(b/2):1,h=L/2*rf;
 st.N+=h*(Math.sin(i1)*Math.cos(a1)+Math.sin(i2)*Math.cos(a2));st.E+=h*(Math.sin(i1)*Math.sin(a1)+Math.sin(i2)*Math.sin(a2));st.tvd+=h*(Math.cos(i1)+Math.cos(i2));
 st.md+=L;st.inc=i2*D;st.azi=n360(a2*D);return st}
// expected result of an order (no noise) for scoring
export function expect(st,c){const t={...st};if(c.cmd=='slide')step(t,c.len,t.yieldDls,n360(c.tf));else if(c.cmd=='rotate')step(t,c.len,0,0);return {md:t.md,inc:t.inc,azi:t.azi}}
export function execute(st,c){const say=[],v=validate(c,st);if(!v.ok){say.push('Driller: '+v.why);return {ok:false,say,src:'SIM'}}
 say.push('Driller: '+readback(c));let res={ok:true,say,src:'SIM'};
 if(c.cmd=='slide'||c.cmd=='rotate'){const rot=c.cmd=='rotate',ms=motor(st,rot),exp=expect(st,c);
  if(ms.stall){st.stall=true;say.push('Driller: Motor stall. SPP is up and ROP is zero. I stop and pick up off bottom.');res.stall=true;res.drilled=0;st.log.push({...c,drilled:0,stall:true});return res}
  let tfAct=null;if(!rot){tfAct=n360(c.tf+rnd(st)*16);st.tf=tfAct;say.push(`Driller: Orienting. Toolface is ${Math.round(tfAct)} deg. Sliding now.`)}else say.push('Driller: Rotating now.');
  const dls=rot?st.rotDls:(ms.yieldDls??st.yieldDls)*(1+rnd(st)*0.2);const segs=Math.max(1,Math.ceil(c.len/5));
  for(let k=0;k<segs;k++)step(st,c.len/segs,dls,rot?n360(rnd(st)*360):tfAct);
  say.push(`Driller: Done. ${c.cmd=='slide'?'Slid':'Rotated'} ${c.len.toFixed(1)} m. Bit at ${st.md.toFixed(1)} m MD.`);
  const sc=scoreOrder(c,exp,st,tfAct);st.scores.push(sc);Object.assign(res,{drilled:c.len,tfAct,score:sc,dP:ms.dP});st.log.push({...c,drilled:c.len,tfAct})}
 else if(c.cmd=='survey'){const s={md:+st.md.toFixed(1),inc:+st.inc.toFixed(2),azi:+st.azi.toFixed(2),tvd:+st.tvd.toFixed(1),src:'SIM'};const p=st.surveys.at(-1);
  s.dls=p&&s.md>p.md?+(Math.acos(cl(Math.cos((s.inc-p.inc)*R)-Math.sin(p.inc*R)*Math.sin(s.inc*R)*(1-Math.cos((s.azi-p.azi)*R)),-1,1))*D*30/(s.md-p.md)).toFixed(2):0;
  st.surveys.push(s);say.push(`Driller: Survey at ${s.md} m. Inc ${s.inc} deg, Azi ${s.azi} deg, DLS ${s.dls} deg/30m.`);res.survey=s}
 else if(c.cmd=='wob'){st.wob=c.v;say.push('Driller: WOB is set.')}else if(c.cmd=='flow'){st.flow=c.v;say.push('Driller: Flow is set.')}
 else if(c.cmd=='pickup'){st.stall=false;say.push('Driller: Off bottom. SPP is back to normal.')}
 return res}
// score one order 0..100: toolface accuracy (slides), result vs expected direction, DLS limit
export function scoreOrder(c,exp,st,tfAct){const dirErr=Math.acos(cl(Math.cos((st.inc-exp.inc)*R)-Math.sin(exp.inc*R)*Math.sin(st.inc*R)*(1-Math.cos((st.azi-exp.azi)*R)),-1,1))*D;
 const tfErr=tfAct==null?0:Math.abs(((tfAct-n360(c.tf))+540)%360-180),dls=c.cmd=='slide'?st.yieldDls:st.rotDls;
 let s=100-Math.min(40,dirErr*20)-Math.max(0,tfErr-LIMITS.tfTol)*1.5-(dls>LIMITS.dlsMax?30:0);return {score:Math.round(cl(s,0,100)),dirErr:+dirErr.toFixed(2),tfErr:+tfErr.toFixed(1),src:'SIM'}}
export function total(st){const a=st.scores;return {orders:a.length,avg:a.length?Math.round(a.reduce((x,y)=>x+y.score,0)/a.length):0,src:'SIM'}}
// cabin hook entry: payload {text|cmd, state}
export function handle(p){const st=p?.state||(API.st??=newState());const c=p?.cmd||parse(p?.text);return execute(st,c)}
const API={parse,validate,readback,newState,step,expect,execute,scoreOrder,total,handle,LIMITS};
export function attach(n=0){const G=globalThis.GX;if(G){G.dddrv=API;if(typeof G.ddcab?.onInstruction=='function'){G.ddcab.onInstruction(handle);return true}}
 if(typeof setTimeout=='function'&&n<40)setTimeout(()=>attach(n+1),500);return false}
if(typeof window!='undefined')attach();
export default API;
