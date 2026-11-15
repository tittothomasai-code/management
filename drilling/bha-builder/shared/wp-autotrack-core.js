import {arcToPoint,arcRowsExact} from './wp-tracking-geometry.js';
export const TRACK_SCHEMA='robotyx.well-tracking.v1';
const rad=x=>x*Math.PI/180,deg=x=>x*180/Math.PI,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const vec=(a,b)=>[a.n-b.n,a.e-b.e,a.tvd-b.tvd],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const tangent=p=>[Math.sin(rad(p.inc))*Math.cos(rad(p.azi)),Math.sin(rad(p.inc))*Math.sin(rad(p.azi)),Math.cos(rad(p.inc))];
const unit=v=>{const l=Math.hypot(...v);return l>1e-12?v.map(x=>x/l):null;};
export const trackingAvailable=({sso})=>sso===false;
export function validatePoint(p){if(!p||!['md','n','e','tvd','inc','azi'].every(k=>Number.isFinite(p[k]))||p.md<0||p.inc<0||p.inc>180||p.azi<0||p.azi>=360||p.md>1e6||['n','e','tvd'].some(k=>Math.abs(p[k])>1e7))throw Error('Trajectory requires finite local N/E/TVD metres, increasing MD and degree angles.');return p;}
export function validatePath(path){if(!Array.isArray(path)||path.length<2||path.length>20000)throw Error('Supply 2–20,000 trajectory points.');path.forEach((p,i)=>{validatePoint(p);if(i&&p.md<=path[i-1].md)throw Error('Trajectory MD must increase.');});return path;}
export function minCurve(a,b){
 const t0=tangent(a),t1=tangent(b),beta=Math.acos(clamp(dot(t0,t1),-1,1)),ds=b.md-a.md,rf=beta<1e-9?1:2*Math.tan(beta/2)/beta;if(beta>Math.PI-1e-6)throw Error('Antipodal survey tangents cannot define a unique arc.');
 return {...b,n:a.n+ds/2*(t0[0]+t1[0])*rf,e:a.e+ds/2*(t0[1]+t1[1])*rf,tvd:a.tvd+ds/2*(t0[2]+t1[2])*rf,dls:ds>0?deg(beta)*30/ds:0};
}
export function resultPath(r){const keys=['md','inc','azi','n','e','tvd'];if(!r||keys.some(k=>!Array.isArray(r[k])||r[k].length!==r.md.length))throw Error('Compute a consistent trajectory first.');return validatePath(r.md.map((md,i)=>Object.fromEntries(keys.map(k=>[k,r[k][i]]))));}
export function atMD(path,md){
 if(md<path[0].md||md>path.at(-1).md)return null;if(md===path[0].md)return {...path[0]};
 const i=path.findIndex((p,i)=>i&&p.md>=md),a=path[i-1],b=path[i],f=(md-a.md)/(b.md-a.md),t0=tangent(a),t1=tangent(b),angle=Math.acos(clamp(dot(t0,t1),-1,1));
 const v=t0.map((v,j)=>angle<1e-9?v*(1-f)+t1[j]*f:(v*Math.sin((1-f)*angle)+t1[j]*Math.sin(f*angle))/Math.sin(angle));
 return minCurve(a,{md,inc:deg(Math.acos(clamp(v[2],-1,1))),azi:(deg(Math.atan2(v[1],v[0]))+360)%360});
}
export function localDls(path,from,to){let max=0;for(let i=1;i<path.length;i++)if(path[i].md>=from&&path[i-1].md<=to)max=Math.max(max,minCurve(path[i-1],path[i]).dls);return max;}
export function componentCheck(component,tolerance,config,dls){
 const lengthM=Number(component.len)*.3048,odIn=Math.max(Number(component.od),component.stab?Number(component.sod||component.od):0),idIn=Number(component.id),unknown=[];
 for(const k of ['rigidSpanM','odToleranceMm','maxDls'])if(!Number.isFinite(tolerance?.[k]))unknown.push(k);
 if(!(lengthM>0&&odIn>0&&idIn>=0&&idIn<odIn)||!Number.isFinite(component.yield)||component.yield<=0)unknown.push('component dimensions/yield');
 if(unknown.length)return {status:'unknown',unknown,component:component.name||component.type,dls};
 if(tolerance.rigidSpanM<0||tolerance.rigidSpanM>lengthM+1e-6||tolerance.odToleranceMm<0||tolerance.maxDls<0)throw Error('Tolerance profile has invalid span, diameter tolerance or DLS limit.');
 const cutter=component.type==='Bit',diameterMm=odIn*25.4+tolerance.odToleranceMm,availableMm=(config.holeIn*25.4-(cutter?0:config.holeToleranceMm)-diameterMm)/2;
 const radius=dls>0?30/rad(dls):Infinity,half=tolerance.rigidSpanM/2,sagittaMm=half>=radius?Infinity:radius===Infinity?0:(half*half/(radius+Math.sqrt(radius*radius-half*half)))*1000;
 const requiredMm=sagittaMm+(cutter?0:config.radialReserveMm),clearanceMm=availableMm-requiredMm;
 const bendingPsi=dls>0?30e6*(odIn*.0254/2)/radius:0,stressSF=bendingPsi>0?component.yield/bendingPsi:null;
 const reasons=[];if(clearanceMm< -1e-7)reasons.push('Rigid-span / diameter clearance exceeded');if(dls>tolerance.maxDls+1e-7)reasons.push('Component DLS limit exceeded');
 return {status:reasons.length?'blocked':'pass',component:component.name||component.type,lengthM,diameterMm,dls,limitDls:tolerance.maxDls,availableMm,sagittaMm,requiredMm,clearanceMm,stressSF,reasons,source:tolerance.source||'User-declared profile'};
}
export function validateConfig(c){for(const k of ['holeIn','holeToleranceMm','radialReserveMm','maxDls','jointLengthM','jointCount','horizontalTolM','verticalTolM','referenceRadiusM','offsetRadiusM','separationMarginM'])if(!Number.isFinite(c[k])||c[k]<0)throw Error('Simulation settings require finite non-negative values.');if(c.holeIn<=0||c.holeIn>36||c.maxDls<=0||c.maxDls>30||c.jointLengthM<1||c.jointLengthM>30||!Number.isInteger(c.jointCount)||c.jointCount<1||c.jointCount>500||c.horizontalTolM<=0||c.verticalTolM<=0)throw Error('Simulation settings exceed supported bounds.');return c;}
export function bhaAt(path,bitMD,bha,profiles,config){
 let offset=0;return bha.map((c,i)=>{const length=Number(c.len)*.3048,to=bitMD-offset,from=to-length;offset+=length;const entered=to>path[0].md;
 return {...componentCheck(c,profiles[i],config,entered?localDls(path,Math.max(path[0].md,from),Math.min(bitMD,to)):0),index:i,fromMD:from,toMD:to,location:to<=0?'Above rig floor':from<0?'Partly above rig floor':'In hole'};});
}
export function segmentDistance(a,b,c,d){
 const u=vec(b,a),v=vec(d,c),r=vec(a,c),uu=dot(u,u),vv=dot(v,v),vr=dot(v,r);let s=0,t=0;
 if(uu<=1e-12&&vv<=1e-12)return {distance:Math.hypot(...r),s,t};
 if(uu<=1e-12)t=clamp(vr/vv,0,1);else{const ur=dot(u,r);if(vv<=1e-12)s=clamp(-ur/uu,0,1);else{const uv=dot(u,v),den=uu*vv-uv*uv;s=den?clamp((uv*vr-ur*vv)/den,0,1):0;t=(uv*s+vr)/vv;if(t<0){t=0;s=clamp(-ur/uu,0,1);}if(t>1){t=1;s=clamp((uv-ur)/uu,0,1);}}}
 return {distance:Math.hypot(...r.map((x,i)=>x+s*u[i]-t*v[i])),s,t};
}
export function screenOffsets(path,offsets,config){
 if(!Array.isArray(offsets)||offsets.length>8)throw Error('Use at most eight scoped offset trajectories.');
 if(!offsets.length)return {status:'unknown',reason:'No offsets supplied. Select and align all relevant offset wells.',rows:[],iscwsa:false};
 let budget=0;const rows=offsets.map(o=>{
  if(!o.tieOnConfirmed||o.frame!=='local-nev-m'||!Number.isFinite(o.shiftN)||!Number.isFinite(o.shiftE)||!Number.isFinite(o.shiftTvd))return {id:o.id,status:'unknown',reason:'Offset coordinate tie-on is unconfirmed.'};
  validatePath(o.path);if((budget+=(path.length-1)*(o.path.length-1))>2000000)throw Error('Offset screen exceeds pair budget; use a reviewed smaller interval.');
  const points=o.path.map(p=>({...p,n:p.n+o.shiftN,e:p.e+o.shiftE,tvd:p.tvd+o.shiftTvd}));let best={distance:Infinity,referenceMD:null,offsetMD:null};
  for(let i=1;i<path.length;i++)for(let j=1;j<points.length;j++){const r=segmentDistance(path[i-1],path[i],points[j-1],points[j]);if(r.distance<best.distance)best={distance:r.distance,referenceMD:path[i-1].md+r.s*(path[i].md-path[i-1].md),offsetMD:points[j-1].md+r.t*(points[j].md-points[j-1].md)};}
  const reserve=config.referenceRadiusM+config.offsetRadiusM+config.separationMarginM;return {id:o.id,name:o.name,...best,declaredEnvelopeM:reserve,envelopeGapM:best.distance-reserve,status:best.distance<reserve?'blocked':'pass',method:'Polyline distance / declared radial envelope',sf:null};
 });return {status:rows.some(r=>r.status==='blocked')?'blocked':rows.some(r=>r.status==='unknown')||config.offsetSetReviewed!==true?'unknown':'pass',reason:config.offsetSetReviewed!==true?'Offset inventory has not been confirmed complete for this interval.':null,rows,iscwsa:false};
}
function rotate(v,axis,angle){const c=Math.cos(angle),s=Math.sin(angle),kx=cross(axis,v),kd=dot(axis,v);return v.map((x,i)=>x*c+kx[i]*s+axis[i]*kd*(1-c));}
export function trackTargets({tieOn,targets,config,responseGain=1,toolfaceErrorDeg=0}){
 validatePoint(tieOn);validateConfig(config);if(!Array.isArray(targets)||!targets.length||targets.length>16||targets.some(t=>!['n','e','tvd'].every(k=>Number.isFinite(t[k])&&Math.abs(t[k])<=1e7)))throw Error('Supply 1–16 finite local targets.');if(!Number.isFinite(responseGain)||responseGain<.5||responseGain>1.5||!Number.isFinite(toolfaceErrorDeg)||Math.abs(toolfaceErrorDeg)>30)throw Error('Response scenario is outside the rehearsal bounds.');
 const path=[{...tieOn}],joints=[],hits=[];let targetIndex=0,blocked=null;
 for(let j=0;j<config.jointCount&&targetIndex<targets.length;j++){
  const fromMD=path.at(-1).md;let advance=0;
  for(let sub=0;sub<10&&targetIndex<targets.length;sub++){
   const cur=path.at(-1),target=targets[targetIndex],delta=vec(target,cur),horizontal=Math.hypot(delta[0],delta[1]),vertical=Math.abs(delta[2]);
   if(horizontal<=config.horizontalTolM&&vertical<=config.verticalTolM){hits.push({index:targetIndex,name:target.name||'Target '+(targetIndex+1),md:cur.md,horizontal,vertical});targetIndex++;sub--;continue;}
   const arc=arcToPoint(cur,[target.n,target.e,target.tvd]);if(!arc||arc.bend>170){blocked='Remaining target is behind the allowable forward approach.';break;}
   const ds=Math.min(config.jointLengthM/10,arc.L),desired=Math.min(arc.dls,config.maxDls),t0=tangent(cur),tEnd=tangent({inc:arc.endInc,azi:arc.endAzi});let axis=unit(cross(t0,tEnd)),t=t0;
   if(axis){axis=rotate(axis,t0,rad(toolfaceErrorDeg));t=rotate(t0,axis,rad(desired*ds/30*responseGain));}
   const next=minCurve(cur,{md:cur.md+ds,inc:deg(Math.acos(clamp(t[2],-1,1))),azi:(deg(Math.atan2(t[1],t[0]))+360)%360});path.push(next);advance+=ds;
  }
  if(advance>1e-8)joints.push({index:j+1,id:'planning-joint-'+(j+1),fromMD,toMD:path.at(-1).md,lengthM:advance,targetIndex,bit:{...path.at(-1)}});if(blocked)break;
 }
 const last=path.at(-1);while(targetIndex<targets.length){const t=targets[targetIndex],horizontal=Math.hypot(t.n-last.n,t.e-last.e),vertical=Math.abs(t.tvd-last.tvd);if(horizontal>config.horizontalTolM||vertical>config.verticalTolM)break;hits.push({index:targetIndex,name:t.name||'Target '+(targetIndex+1),md:last.md,horizontal,vertical});targetIndex++;}const target=targets[targetIndex];return {path,joints,hits,targetIndex,complete:targetIndex===targets.length,blocked,remaining:target?Math.hypot(...vec(target,last)):0,responseGain,toolfaceErrorDeg,executionEnabled:false};
}
export function assessRehearsal(sim,bha,profiles,offsets,config,stress){
 if(!bha.length||bha.length>32||bha[0]?.type!=='Bit')throw Error('Supply 1–32 BHA components, bit first.');
 const maxDls=sim.path.length>1?localDls(sim.path,sim.path[0].md,sim.path.at(-1).md):0;
 const components=bha.map((c,i)=>componentCheck(c,profiles[i],config,maxDls));
 if(stress){const r=stress(maxDls);components.forEach((c,i)=>{c.combinedStressSF=r.rows?.[i]?.SF??null;if(!Number.isFinite(c.combinedStressSF)){c.status=c.status==='blocked'?'blocked':'unknown';c.unknown=[...(c.unknown||[]),'combined stress result'];}else if(c.combinedStressSF<1.5){c.status='blocked';c.reasons=[...(c.reasons||[]),'Existing combined-stress estimator SF below illustrative 1.5 review threshold'];}});}
 const collision=screenOffsets(sim.path.length>1?sim.path:[sim.path[0],{...sim.path[0],md:sim.path[0].md+.001}],offsets,config);
 const reasons=[...(sim.blocked?[sim.blocked]:[]),...(maxDls>config.maxDls+1e-6?['Commanded DLS ceiling exceeded by proposed or response curvature.']:[])];
 return {components,collision,maxDls,reasons,status:reasons.length||components.some(c=>c.status==='blocked')||collision.status==='blocked'?'blocked':components.some(c=>c.status==='unknown')||collision.status==='unknown'?'unknown':'pass',executionEnabled:false};
}
export function scenarioKey(input){return JSON.stringify(input);}

export function trackEnvelope(path,reference,config){
 validatePath(reference);const rows=path.map(p=>{const ref=atMD(reference,p.md);if(!ref)return {md:p.md,status:'unknown'};const horizontal=Math.hypot(p.n-ref.n,p.e-ref.e),vertical=Math.abs(p.tvd-ref.tvd),hMargin=config.horizontalTolM-config.referenceRadiusM-horizontal,vMargin=config.verticalTolM-config.referenceRadiusM-vertical;return {md:p.md,horizontal,vertical,hMargin,vMargin,status:hMargin<0||vMargin<0?'blocked':'pass'};});
 return {status:rows.some(r=>r.status==='blocked')?'blocked':rows.some(r=>r.status==='unknown')?'unknown':'pass',maxHorizontal:Math.max(0,...rows.map(r=>r.horizontal||0)),maxVertical:Math.max(0,...rows.map(r=>r.vertical||0)),rows};
}
