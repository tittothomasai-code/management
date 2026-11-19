// Landing geometry only. Reuses the game's minimum-curvature implementation.
import {minCurve,validatePoint,atMD} from './bha-builder/shared/wp-autotrack-core.js';
const R=Math.PI/180,D=1/R,finite=Number.isFinite,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const wrap=a=>(a%360+360)%360;
export const signedAngle=a=>((a+540)%360+360)%360-180;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),mag=v=>Math.hypot(...v),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const direction=p=>[Math.sin(p.inc*R)*Math.cos(p.azi*R),Math.sin(p.inc*R)*Math.sin(p.azi*R),Math.cos(p.inc*R)];
const angles=v=>({inc:Math.acos(clamp(v[2]/mag(v),-1,1))*D,azi:wrap(Math.atan2(v[1],v[0])*D)});
const dogleg=(a,b)=>Math.acos(clamp(dot(direction(a),direction(b)),-1,1))*D;
const smooth=t=>t*t*(3-2*t),smoother=t=>t*t*t*(t*(6*t-15)+10);
const PROFILES=[
 ['Uniform',0,1,'linear'],['Early landing',0,.8,'linear'],['Delayed build',.2,1,'linear'],
 ['Smooth entry and exit',0,1,'smooth'],['Gentle shoulders',0,1,'smoother'],
 ['Earlier build',0,.65,'smooth'],['Later build',.35,1,'smooth'],
 ['Front loaded',0,1,'front'],['Back loaded',0,1,'back'],['Build before turn',0,1,'split']
];
export function validateInput(input){
 const {tie,target,limits}=input||{};validatePoint(tie);
 if(!target||!['md','position'].includes(target.mode)||!finite(target.inc)||target.inc<0||target.inc>180||!finite(target.azi)||target.azi<0||target.azi>=360)throw Error('Enter landing inclination 0–180° and azimuth 0–<360°.');
 if(!limits||!finite(limits.maxDls)||limits.maxDls<=0||limits.maxDls>30||!finite(limits.positionTol)||limits.positionTol<=0||!finite(limits.angleTol)||limits.angleTol<=0||limits.angleTol>10)throw Error('Enter a positive DLS ceiling (up to 30°/30 m), position tolerance and angle tolerance.');
 if(target.mode==='md'||target.md!==null&&target.md!==undefined){if(!finite(target.md)||target.md<=tie.md+.1||target.md-tie.md>20000)throw Error('Landing MD must be ahead of the tie-on by 0.1–20,000 m.');}
 if(target.mode==='position'&&(!['n','e','tvd'].every(k=>finite(target[k])&&Math.abs(target[k])<1e7)||mag([target.n-tie.n,target.e-tie.e,target.tvd-tie.tvd])<.1))throw Error('Enter a distinct landing position in the same local N/E and TVD datum as the tie-on.');
 if(target.mode==='position'&&mag([target.n-tie.n,target.e-tie.e,target.tvd-tie.tvd])>20000)throw Error('This landing planner supports targets within 20 km of the tie-on.');
 if(input.surveys!==undefined&&(!Array.isArray(input.surveys)||input.surveys.length>20000))throw Error('Use at most 20,000 scoped source surveys.');
 if(input.componentLimit!==null&&input.componentLimit!==undefined&&(!finite(input.componentLimit)||input.componentLimit<=0||input.componentLimit>30))throw Error('The selected design profile has an invalid declared component DLS limit.');
 for(const gain of [limits.responseLow??.8,limits.responseHigh??1.2])if(!finite(gain)||gain<=0||gain>2)throw Error('Response sensitivity multipliers must be greater than zero and at most 2.');
 if((limits.responseLow??.8)>(limits.responseHigh??1.2))throw Error('The low response multiplier must not exceed the high multiplier.');
 return input;
}
function fraction(t,start,finish,kind){const u=clamp((t-start)/(finish-start),0,1);return kind==='smooth'?smooth(u):kind==='smoother'?smoother(u):kind==='front'?1-(1-u)**1.7:kind==='back'?u**1.7:u;}
function anglePath(tie,target,profile){
 const [,start,finish,kind]=profile,L=target.md-tie.md,a=direction(tie),b=direction(target),beta=dogleg(tie,target)*R;
 if(beta>Math.PI-1e-6)throw Error('Opposite endpoint tangents need an intermediate orientation; this family is not uniquely defined.');
 const steps=Math.min(2400,Math.max(120,Math.ceil(L/3))),path=[{...tie,dls:0}];
 for(let k=1;k<=steps;k++){
  const t=k/steps,u=fraction(t,start,finish,kind);let orient;
  if(kind==='split')orient={inc:tie.inc+(target.inc-tie.inc)*smooth(clamp(t/.8,0,1)),azi:wrap(tie.azi+signedAngle(target.azi-tie.azi)*smooth(clamp((t-.15)/.85,0,1)))};
  else orient=angles(a.map((v,i)=>beta<1e-9?v*(1-u)+b[i]*u:(v*Math.sin((1-u)*beta)+b[i]*Math.sin(u*beta))/Math.sin(beta)));
  if(k===steps)orient={inc:target.inc,azi:target.azi};
  path.push(minCurve(path.at(-1),{md:tie.md+L*t,...orient}));
 }return path;
}
const GLX=[0,.5384693101056831,-.5384693101056831,.906179845938664,-.906179845938664],GLW=[.5688888888888889,.4786286704993665,.4786286704993665,.2369268850561891,.2369268850561891];
function bezier(c,t){const q=1-t;return c[0].map((_,j)=>q**3*c[0][j]+3*q*q*t*c[1][j]+3*q*t*t*c[2][j]+t**3*c[3][j]);}
function derivative(c,t){const q=1-t;return c[0].map((_,j)=>3*(q*q*(c[1][j]-c[0][j])+2*q*t*(c[2][j]-c[1][j])+t*t*(c[3][j]-c[2][j])));}
function second(c,t){return c[0].map((_,j)=>6*((1-t)*(c[2][j]-2*c[1][j]+c[0][j])+t*(c[3][j]-2*c[2][j]+c[1][j])));}
function arc(c,a,b){const m=(a+b)/2,h=(b-a)/2;return h*GLX.reduce((s,x,i)=>s+GLW[i]*mag(derivative(c,m+h*x)),0);}
function fullLength(c){let n=0;for(let k=0;k<32;k++)n+=arc(c,k/32,(k+1)/32);return n;}
function controlPoints(tie,target,a,b){const p=[tie.n,tie.e,tie.tvd],q=[target.n,target.e,target.tvd],v=direction(tie),w=direction(target);return [p,p.map((x,i)=>x+a*v[i]),q.map((x,i)=>x-b*w[i]),q];}
const SCALES=[[.35,.35],[.2,.45],[.45,.2],[.2,.2],[.5,.5],[.15,.6],[.6,.15],[.3,.55],[.55,.3],[.65,.65]];
function positionPath(tie,target,index,positionTol){
 const chord=mag([target.n-tie.n,target.e-tie.e,target.tvd-tie.tvd]),[a,b]=SCALES[index],wanted=finite(target.md)?target.md-tie.md:null;
 let scale=1,mdFit=true;
 if(wanted!==null){
  // Search all sampled brackets rather than assuming arc length is monotonic.
  const samples=Array.from({length:65},(_,i)=>.002*10**(i*4/64));let best=null;
  for(let i=0;i<samples.length;i++){
   const s=samples[i],len=fullLength(controlPoints(tie,target,chord*a*s,chord*b*s)),err=Math.abs(len-wanted);
   if(!best||err<best.err)best={s,err};
   if(i){let lo=samples[i-1],hi=s,fl=fullLength(controlPoints(tie,target,chord*a*lo,chord*b*lo))-wanted,fh=len-wanted;
    if(fl*fh<=0){for(let k=0;k<40;k++){const mid=(lo+hi)/2,fm=fullLength(controlPoints(tie,target,chord*a*mid,chord*b*mid))-wanted;if(fl*fm<=0){hi=mid;fh=fm;}else{lo=mid;fl=fm;}}scale=(lo+hi)/2;best={s:scale,err:Math.abs(fullLength(controlPoints(tie,target,chord*a*scale,chord*b*scale))-wanted)};break;}
   }
  }scale=best.s;mdFit=best.err<=.1;
 }
 const c=controlPoints(tie,target,chord*a*scale,chord*b*scale);let previousPeak=null,result;
 for(const steps of [240,480,960,1920]){
  let md=tie.md,peak=0,minSpeed=Infinity;const path=[];
  for(let k=0;k<=steps;k++){
   const t=k/steps,p=bezier(c,t),v=derivative(c,t),v2=second(c,t),speed=mag(v);minSpeed=Math.min(minSpeed,speed);
   if(speed<1e-7)throw Error('This template has an unresolved tangent/cusp.');
   if(k)md+=arc(c,(k-1)/steps,t);
   const cross=[v[1]*v2[2]-v[2]*v2[1],v[2]*v2[0]-v[0]*v2[2],v[0]*v2[1]-v[1]*v2[0]],dls=mag(cross)/speed**3*30*D;peak=Math.max(peak,dls);
   path.push({md,n:p[0],e:p[1],tvd:p[2],...angles(v),dls});
  }
  // Check the curve against the shared minimum-curvature discretisation.
  let integrationError=0,cumulativeIntegrationError=0,integrated=path[0];for(let k=1;k<path.length;k++){const calc=minCurve(path[k-1],path[k]);integrationError=Math.max(integrationError,mag([calc.n-path[k].n,calc.e-path[k].e,calc.tvd-path[k].tvd]));integrated=minCurve(integrated,path[k]);cumulativeIntegrationError=Math.max(cumulativeIntegrationError,mag([integrated.n-path[k].n,integrated.e-path[k].e,integrated.tvd-path[k].tvd]));}
  result={path,peak,mdFit,integrationError,cumulativeIntegrationError,converged:previousPeak!==null&&Math.abs(peak-previousPeak)<=Math.max(.002,peak*.005)&&integrationError<.01&&cumulativeIntegrationError<=Math.min(.05,positionTol*.1)};
  if(result.converged)break;previousPeak=peak;
 }return result;
}
function summarize(path,input,extra={}){
 const {target,limits}=input,last=path.at(-1);let peak=extra.peak||0,turnPeak=0,buildPeak=0,totalDogleg=0;
 for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],dm=b.md-a.md,beta=dogleg(a,b);peak=Math.max(peak,beta*30/dm);totalDogleg+=beta;buildPeak=Math.max(buildPeak,Math.abs(b.inc-a.inc)*30/dm);turnPeak=Math.max(turnPeak,Math.abs(signedAngle(b.azi-a.azi))*Math.sin((a.inc+b.inc)/2*R)*30/dm);}
 const positionMiss=target.mode==='position'?mag([last.n-target.n,last.e-target.e,last.tvd-target.tvd]):null,mdMiss=finite(target.md)?last.md-target.md:null,orientationMiss=dogleg(last,target),limit=Math.min(limits.maxDls,input.componentLimit||Infinity),issues=[];
 if(peak>limit+1e-6)issues.push('DLS ceiling exceeded');
 if(positionMiss!==null&&positionMiss>limits.positionTol)issues.push('Position tolerance missed');
 if(orientationMiss>limits.angleTol)issues.push('Landing angle tolerance missed');
 if(mdMiss!==null&&Math.abs(mdMiss)>.1)issues.push('Landing MD not met');
 if(extra.converged===false||extra.integrationError>.01)issues.push('Geometry resolution did not converge');
 return {end:last,peakDls:peak,buildPeak,turnPeak,totalDogleg,positionMiss,mdMiss,orientationMiss,dlsMargin:limit-peak,limit,issues,feasible:!issues.length,mdLength:last.md-path[0].md,cumulativeIntegrationError:extra.cumulativeIntegrationError??0,resolution:extra.converged===undefined?'Minimum-curvature stations':extra.converged?'Converged sampled cubic':'Unresolved sampled cubic'};
}
export function surveyResponse(surveys,{bhaId='',runStartMd=null,runEndMd=null,maxIntervals=12}={}){
 const valid=(surveys||[]).filter(p=>p&&['md','inc','azi'].every(k=>finite(p[k]))&&p.inc>=0&&p.inc<=180&&p.azi>=0&&p.azi<360);
 const sorted=valid.slice().sort((a,b)=>a.md-b.md),intervals=[],issues=[];
 if(valid.length!==surveys?.length)issues.push('Invalid survey rows excluded');
 if(bhaId&&(!finite(runStartMd)||runStartMd<0||runEndMd!==null&&(!finite(runEndMd)||runEndMd<=runStartMd)))return {intervals:[],issues:['Enter a valid BHA run start/end MD before assigning observations to it.'],attributed:false};
 for(let k=1;k<sorted.length;k++){
  const a=sorted[k-1],b=sorted[k],dm=b.md-a.md;if(dm<=.1){issues.push('Duplicate or very short survey interval excluded');continue;}
  if(bhaId&&a.md<runStartMd-.001)continue;
  if(bhaId&&finite(runEndMd)&&b.md>runEndMd+.001)continue;
  if(dm>90){issues.push('Sparse survey interval above 90 m excluded from response statistics');continue;}
  const build=(b.inc-a.inc)*30/dm,turn=signedAngle(b.azi-a.azi)*Math.sin((a.inc+b.inc)/2*R)*30/dm;
  intervals.push({fromMd:a.md,toMd:b.md,build,turn,dls:dogleg(a,b)*30/dm,aziReliable:Math.min(a.inc,b.inc)>=5});
 }
 const recent=intervals.slice(-Math.max(1,Math.min(1000,maxIntervals))),median=v=>{const a=v.filter(finite).sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:null;};
 const medianBuild=median(recent.map(x=>x.build)),medianTurn=median(recent.filter(x=>x.aziReliable).map(x=>x.turn)),medianDls=median(recent.map(x=>x.dls));
 return {intervals:recent,issues:[...new Set(issues)],attributed:!!bhaId&&recent.length>=3,bhaId: bhaId||null,runStartMd:finite(runStartMd)?runStartMd:null,runEndMd:finite(runEndMd)?runEndMd:null,medianBuild,medianTurn,medianDls,count:recent.length,confidence:recent.length>=6?'More observations':recent.length>=3?'Limited observations':'Insufficient observations',method:'Observed survey curvature; steering exposure, formation and drilling settings are not controlled. Not motor yield or maximum capability.'};
}
export function fitSteeringResponse(intervals,exposures,bhaId){
 if(!bhaId||!Array.isArray(exposures))return {available:false,reason:'BHA run ID and recorded steering intervals are required.'};
 const rows=[];
 for(const s of intervals){const match=exposures.filter(x=>x.bhaId===bhaId&&x.fromMd<=s.fromMd+.001&&x.toMd>=s.toMd-.001);if(match.length===1)rows.push({...s,f:match[0].slidePercent/100});}
 const fs=rows.map(x=>x.f);if(rows.length<4||Math.max(...fs)-Math.min(...fs)<.3)return {available:false,reason:'Need at least four matched intervals with slide exposure spread of at least 30 percentage points.'};
 const mean=(a,k)=>a.reduce((s,x)=>s+x[k],0)/a.length,mf=mean(rows,'f'),den=rows.reduce((s,x)=>s+(x.f-mf)**2,0);
 const fit=k=>{const my=mean(rows,k),slope=rows.reduce((s,x)=>s+(x.f-mf)*(x[k]-my),0)/den,intercept=my-slope*mf,rmse=Math.sqrt(rows.reduce((s,x)=>s+(x[k]-(intercept+slope*x.f))**2,0)/Math.max(1,rows.length-2));return {rotate:intercept,slide:intercept+slope,rmse};};
 const turnRows=rows.filter(x=>x.aziReliable!==false);
 return {available:true,count:rows.length,build:fit('build'),turn:turnRows.length===rows.length?fit('turn'):null,method:'Linear fit to recorded slide fraction and surveyed curvature; association, not isolated BHA causality. Near-vertical turn fits are withheld.'};
}
export function compareBhaRuns(surveys,exposures){
 const ids=[...new Set(exposures.map(x=>x.bhaId))];
 return ids.map(bhaId=>{const records=exposures.filter(x=>x.bhaId===bhaId),from=Math.min(...records.map(x=>x.fromMd)),to=Math.max(...records.map(x=>x.toMd)),all=surveyResponse(surveys,{bhaId,runStartMd:from,runEndMd:to,maxIntervals:1000}),intervals=all.intervals.filter(s=>records.filter(x=>x.fromMd<=s.fromMd+.001&&x.toMd>=s.toMd-.001).length===1).slice(-12),median=k=>{const v=intervals.filter(s=>k!=='turn'||s.aziReliable).map(s=>s[k]).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:null;};
  return {bhaId,fromMd:from,toMd:to,count:intervals.length,medianBuild:median('build'),medianTurn:median('turn'),medianDls:median('dls'),steering:fitSteeringResponse(intervals,exposures,bhaId)};
 });
}
export function parseExposures(text){
 if(typeof text!=='string'||text.length>100000)throw Error('Steering CSV must be under 100 kB.');
 const lines=text.trim().split(/\r?\n/).filter(Boolean),head=lines.shift()?.split(',').map(x=>x.trim());
 if(!head||head.join(',')!=='fromMd,toMd,bhaId,slidePercent')throw Error('Use CSV columns fromMd,toMd,bhaId,slidePercent.');
 const rows=lines.map((line,i)=>{const parts=line.split(',').map(x=>x.trim());if(parts.length!==4||parts.some(x=>!x))throw Error('Incomplete steering interval at row '+(i+2));const [a,b,bhaId,f]=parts,fromMd=Number(a),toMd=Number(b),slidePercent=Number(f);if(![fromMd,toMd,slidePercent].every(finite)||fromMd<0||toMd<=fromMd||slidePercent<0||slidePercent>100||bhaId.length>100)throw Error('Invalid steering interval at row '+(i+2));return {fromMd,toMd,bhaId,slidePercent};});
 if(rows.length>1000)throw Error('Use at most 1,000 steering intervals.');
 for(let i=0;i<rows.length;i++)for(let j=0;j<i;j++)if(rows[i].bhaId===rows[j].bhaId&&Math.max(rows[i].fromMd,rows[j].fromMd)<Math.min(rows[i].toMd,rows[j].toMd)-1e-6)throw Error('Overlapping steering intervals for the same BHA are ambiguous.');
 return rows;
}
export function responseSensitivity(path,gain,target){
 let actual={...path[0]};
 for(let k=1;k<path.length;k++){
  const u=direction(path[k-1]),v=direction(path[k]),axis=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],norm=mag(axis);let next=direction(actual);
  if(norm>1e-10){const a=axis.map(x=>x/norm),angle=Math.atan2(norm,clamp(dot(u,v),-1,1))*gain,c=Math.cos(angle),s=Math.sin(angle),cross=[a[1]*next[2]-a[2]*next[1],a[2]*next[0]-a[0]*next[2],a[0]*next[1]-a[1]*next[0]],projection=dot(a,next);next=next.map((x,i)=>x*c+cross[i]*s+a[i]*projection*(1-c));}
  actual=minCurve(actual,{md:path[k].md,...angles(next)});
 }
 const nominal=path.at(-1);return {gain,end:actual,angleMiss:dogleg(actual,target),positionMiss:target.mode==='position'?mag([actual.n-target.n,actual.e-target.e,actual.tvd-target.tvd]):null,displacementFromNominal:mag([actual.n-nominal.n,actual.e-nominal.e,actual.tvd-nominal.tvd]),method:'Assumed gain applied to planned incremental curvature axes; not a calibrated BHA prediction.'};
}
export function projectResponseTrend(tie,landingMd,response){
 if(response.count<3||!finite(response.medianBuild)||!finite(response.medianTurn)||!finite(landingMd)||landingMd<=tie.md||landingMd-tie.md>2000)return null;
 if(finite(response.runEndMd)&&tie.md>response.runEndMd+.001)return null;
 let p={...tie};const steps=Math.ceil((landingMd-tie.md)/3),dm=(landingMd-tie.md)/steps;
 for(let k=0;k<steps;k++){
  const inc=p.inc+response.medianBuild*dm/30;if(inc<5||inc>175)return null;
  const sin=Math.sin((p.inc+inc)/2*R);p=minCurve(p,{md:p.md+dm,inc,azi:wrap(p.azi+response.medianTurn*dm/(30*sin))});
 }return {end:p,method:'Extrapolation of recent surveyed build/turn trend, without assuming unchanged steering or proving BHA causality.'};
}
export function planLanding(input){
 validateInput(input);const response=surveyResponse(input.surveys||[],input.response||{}),steering=fitSteeringResponse(response.intervals,input.exposures||[],input.response?.bhaId),candidates=[];
 for(let i=0;i<10;i++){
  try{const extra=input.target.mode==='position'?positionPath(input.tie,input.target,i,input.limits.positionTol):{},path=extra.path||anglePath(input.tie,input.target,PROFILES[i]),summary=summarize(path,input,extra),observed=response.count>=3&&finite(response.medianDls)?response.medianDls:null;
   const sensitivity=[input.limits.responseLow??.8,input.limits.responseHigh??1.2].map(g=>responseSensitivity(path,g,input.target));
   const score=summary.peakDls+.05*summary.totalDogleg+.0005*summary.mdLength+(observed===null?0:.1*Math.abs(summary.peakDls-observed));
   candidates.push({id:'landing-'+(i+1),name:input.target.mode==='position'?'Position template '+(i+1):PROFILES[i][0],path,...summary,score,sensitivity,aboveObserved:observed===null?null:summary.peakDls>observed,duplicateOf:null});
  }catch(e){candidates.push({id:'landing-'+(i+1),name:'Template '+(i+1),path:[],feasible:false,issues:[e.message],score:null,peakDls:null,duplicateOf:null});}
 }
 // Degenerate holds are explicitly identified rather than inventing ten unique paths.
 const signatures=new Map();for(const c of candidates){if(!c.path.length)continue;const p=c.path,signature=[.25,.5,.75,1].flatMap(t=>{const x=atMD(p,p[0].md+(p.at(-1).md-p[0].md)*t);return [x.n,x.e,x.tvd,x.md].map(v=>v.toFixed(2));}).join('|');if(signatures.has(signature))c.duplicateOf=signatures.get(signature);else signatures.set(signature,c.id);}
 const ranked=candidates.filter(c=>c.feasible&&!c.duplicateOf).sort((a,b)=>a.score-b.score),recommendation=ranked[0]||null;
 return {schema:'robotyx.landing-plan.v1',generatedAt:input.generatedAt||new Date().toISOString(),scope:input.scope||null,tie:input.tie,tieSource:input.tieSource||'User entered',target:input.target,limits:input.limits,componentLimit:input.componentLimit||null,componentSource:input.componentSource||null,
  response,steering,bhaComparisons:compareBhaRuns(input.surveys||[],input.exposures||[]),recordedSteering:input.exposures||[],surveySnapshot:(input.surveys||[]).slice(-50),trend:projectResponseTrend(input.tie,finite(input.target.md)?input.target.md:recommendation?.end.md,response),candidates,uniqueCount:signatures.size,recommendation:recommendation?.id||null,
  difficulty:{hard:!recommendation||recommendation.peakDls/recommendation.limit>=.9,thresholdFraction:.9,reason:!recommendation?'No evaluated candidate meets all entered limits.':recommendation.peakDls/recommendation.limit>=.9?'Best candidate requires at least 90% of the effective DLS ceiling; little curvature margin remains.':'Best candidate retains more than 10% DLS margin.'},
  rationale:recommendation?'Lowest score among generated feasible, distinct candidates: peak DLS + 0.05 × total dogleg + 0.0005 × drilled length + 0.1 × difference from observed median DLS when available. This is not a global optimum.':'No generated candidate meets all entered geometry/DLS constraints. No path is recommended.',
  minimumAverageDls:input.target.mode==='md'?dogleg(input.tie,input.target)*30/(input.target.md-input.tie.md):null,
  notes:['Planning geometry, not live equipment control. No collision clearance is included.','Landing MD/angle mode does not constrain terminal N/E/TVD. Position mode uses the stated survey coordinate frame.','Peak DLS is sampled; position templates refine peak-change and both segment/cumulative minimum-curvature integration checks.','Observed survey response is not a proven BHA capability envelope or motor yield.',...(Math.min(input.target.inc,180-input.target.inc)<5?['Near vertical, azimuth is poorly constrained; angular miss is the 3-D tangent difference.']:[])]};
}
