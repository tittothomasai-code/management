// Executable geometric stations at pipe/control boundaries, not a sampled summary.
import {minCurve,atMD} from './bha-builder/shared/wp-autotrack-core.js';
const R=Math.PI/180,D=1/R,F=Number.isFinite,wrap=a=>(a%360+360)%360;
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=v=>Math.hypot(...v);
const dir=p=>[Math.sin(p.inc*R)*Math.cos(p.azi*R),Math.sin(p.inc*R)*Math.sin(p.azi*R),Math.cos(p.inc*R)];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function jointDogleg(a,b){const u=dir(a),v=dir(b);return Math.atan2(norm(cross(u,v)),dot(u,v))*D;}
const signed=a=>((a+540)%360+360)%360-180;
export function parseJointLengths(text){
 if(typeof text!=='string'||text.length>200000)throw Error('Joint-length CSV must be under 200 kB.');
 const lines=text.trim().split(/\r?\n/).filter(x=>x.trim());if(lines.shift()?.trim()!=='joint,lengthM')throw Error('Use joint CSV columns joint,lengthM.');
 const ids=new Set(),records=lines.map((line,i)=>{const parts=line.split(',').map(s=>s.trim());if(parts.length!==2||!parts[0]||parts[0].length>80||!parts[1])throw Error('Incomplete joint-length row '+(i+2));const lengthM=Number(parts[1]);if(!F(lengthM)||lengthM<=.01||lengthM>100||ids.has(parts[0]))throw Error('Joint lengths must be >0.01–100 m with unique joint IDs.');ids.add(parts[0]);return {id:parts[0],lengthM};});
 if(!records.length||records.length>4000)throw Error('Supply 1–4,000 measured joint lengths.');return records;
}
export function validateJointConfig(value={mode:'6'}){
 const c={...value};if(!['6','9','nominal','measured'].includes(c.mode))throw Error('Choose 6 m, 9 m, nominal or measured joints.');
 if(c.anchorMd!==null&&c.anchorMd!==undefined&&(!F(c.anchorMd)||c.anchorMd<0))throw Error('Joint-length anchor MD must be non-negative.');
 if(c.mode==='nominal'&&(!F(c.nominalM)||c.nominalM<=.1||c.nominalM>100))throw Error('Nominal joint length must be >0.1–100 m.');
 if(c.mode==='measured'){
  if(!Array.isArray(c.records)||!c.records.length||c.records.length>4000)throw Error('Measured mode requires 1–4,000 joint lengths.');
  const ids=new Set();for(const r of c.records){if(!r||typeof r.id!=='string'||!r.id||r.id.length>80||ids.has(r.id)||!F(r.lengthM)||r.lengthM<=.01||r.lengthM>100)throw Error('Invalid or duplicate measured joint record.');ids.add(r.id);}
 }
 const first=c.mode==='measured'?c.records[0].lengthM:c.mode==='nominal'?c.nominalM:Number(c.mode);
 if(c.firstRemainingM!==null&&c.firstRemainingM!==undefined&&(!F(c.firstRemainingM)||c.firstRemainingM<=.001||c.firstRemainingM>first+.000001))throw Error('First remaining length must be positive and no greater than the first full joint.');
 return c;
}
export function jointBoundaries(startMd,endMd,config){
 const c=validateJointConfig(config);if(!F(startMd)||!F(endMd)||endMd<=startMd)throw Error('Joint schedule requires increasing MD.');
 const rows=[];let cursor=c.anchorMd??startMd,index=0;if(cursor>startMd+1e-7)throw Error('Joint-length anchor MD must not be after the tie-on.');
 if(c.mode!=='measured'){
  const full=c.mode==='nominal'?c.nominalM:Number(c.mode),first=F(c.firstRemainingM)?c.firstRemainingM:full;
  if(startMd>=cursor+first-1e-8){index=1+Math.max(0,Math.floor((startMd-cursor-first+1e-8)/full));cursor+=first+(index-1)*full;}
 }
 while(cursor<endMd-1e-8){
  if(rows.length>=4000)throw Error('Joint schedule exceeds 4,000 intervals.');
  const record=c.mode==='measured'?c.records[index]:{id:'Step '+(index+1),lengthM:c.mode==='nominal'?c.nominalM:Number(c.mode)};
  if(!record){const e=Error('Measured joint lengths end '+(endMd-Math.max(startMd,cursor)).toFixed(3)+' m before this candidate lands. Supply the remaining measured joints.');e.code='JOINT_COVERAGE';throw e;}
  const atAnchor=index===0&&F(c.firstRemainingM)?c.firstRemainingM:record.lengthM,end=cursor+atAnchor;
  if(end<=startMd+1e-8){cursor=end;index++;continue;}
  const from=Math.max(startMd,cursor),available=end-from,to=Math.min(endMd,end),lengthM=to-from,within=record.lengthM-atAnchor+from-cursor;
  rows.push({step:index+1,joint:record.id,startMd:from,endMd:to,lengthM,fullJointM:record.lengthM,availableM:available,fromWithinJointM:within,toWithinJointM:within+lengthM,partialAtStart:within>1e-7,partialAtLanding:to>=endMd-1e-8&&lengthM<available-1e-7,remainingAfterLandingM:Math.max(0,available-lengthM)});
  cursor=end;index++;
 }return rows;
}
function solve3(A,b){
 const a=A.map((r,i)=>[...r,b[i]]);for(let k=0;k<3;k++){let p=k;for(let j=k+1;j<3;j++)if(Math.abs(a[j][k])>Math.abs(a[p][k]))p=j;if(Math.abs(a[p][k])<1e-20)return null;[a[k],a[p]]=[a[p],a[k]];const v=a[k][k];for(let j=k;j<4;j++)a[k][j]/=v;for(let i=0;i<3;i++)if(i!==k){const w=a[i][k];for(let j=k;j<4;j++)a[i][j]-=w*a[k][j];}}
 return a.map(r=>r[3]);
}
function stationPath(base,params){
 const out=[{...base[0],dls:0}],first=base[0].md,L=base.at(-1).md-first;
 for(let k=1;k<base.length;k++){
  const p=base[k];let inc=p.inc,azi=p.azi;
  if(k<base.length-1){const u=(p.md-first)/L,s=[Math.sin(Math.PI*u),Math.sin(2*Math.PI*u),Math.sin(3*Math.PI*u)],db=s.reduce((n,v,i)=>n+v*params[i],0)*R,dt=s.reduce((n,v,i)=>n+v*params[i+3],0)*R,v=dir(p),b=[Math.cos(inc*R)*Math.cos(azi*R),Math.cos(inc*R)*Math.sin(azi*R),-Math.sin(inc*R)],t=[-Math.sin(azi*R),Math.cos(azi*R),0],w=v.map((x,i)=>x+db*b[i]+dt*t[i]),m=norm(w);inc=Math.atan2(Math.hypot(w[0],w[1]),w[2])*D;azi=Math.hypot(w[0],w[1])<1e-12?p.azi:wrap(Math.atan2(w[1]/m,w[0]/m)*D);}
  const a=out.at(-1),b=minCurve(a,{md:p.md,inc,azi});b.dls=jointDogleg(a,b)*30/(b.md-a.md);out.push(b);
 }return out;
}
function endpointError(path,target){const p=path.at(-1);return [p.n-target.n,p.e-target.e,p.tvd-target.tvd];}
function fitPosition(base,target,tolerance){
 let params=Array(6).fill(0),path=stationPath(base,params),error=endpointError(path,target),miss=norm(error),iterations=0;
 // Minimum-norm corrections to smooth interior tangent bases. Endpoint tangents
 // and every pipe MD boundary remain fixed throughout the fit.
 for(;iterations<35&&miss>tolerance;iterations++){
  const h=.005,columns=Array.from({length:6},(_,j)=>{const p=params.slice();p[j]+=h;const e=endpointError(stationPath(base,p),target);return e.map((v,i)=>(v-error[i])/h);});let accepted=false;
  for(const damping of [1e-8,1e-5,.001,.1]){
   const A=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>columns.reduce((sum,c)=>sum+c[i]*c[j],0)+(i===j?damping:0))),solution=solve3(A,error.map(x=>-x));if(!solution)continue;const delta=columns.map(c=>dot(c,solution));
   for(const step of [1,.5,.25,.125,.0625]){const next=params.map((x,i)=>Math.max(-30,Math.min(30,x+step*delta[i]))),candidate=stationPath(base,next),e=endpointError(candidate,target),m=norm(e);if(m<miss-1e-10){params=next;path=candidate;error=e;miss=m;accepted=true;break;}}
   if(accepted)break;
  }if(!accepted)break;
 }return {path,miss,iterations,converged:miss<=tolerance};
}
export function buildJointPlan(designPath,target,config={mode:'6'},{positionTol=2}={}){
 if(!Array.isArray(designPath)||designPath.length<2)throw Error('A trajectory is required for the joint schedule.');
 const c=validateJointConfig(config);c.anchorMd??=designPath[0].md;const boundaries=jointBoundaries(designPath[0].md,designPath.at(-1).md,c),base=[{...designPath[0]},...boundaries.map(r=>atMD(designPath,r.endMd))];base.at(-1).inc=target.inc;base.at(-1).azi=target.azi;
 const fit=target.mode==='position'?fitPosition(base,target,Math.min(.000001,positionTol*.01)):{path:stationPath(base,Array(6).fill(0)),miss:null,iterations:0,converged:true},path=fit.path;
 if(target.mode==='position')fit.converged=fit.miss<=Math.min(.005,positionTol*.1);
 const rows=boundaries.map((row,k)=>{const a=path[k],b=path[k+1],doglegDeg=jointDogleg(a,b),deltaInc=b.inc-a.inc,deltaAzi=signed(b.azi-a.azi),dls=doglegDeg*30/row.lengthM,aziReliable=Math.min(a.inc,b.inc)>=5&&Math.max(a.inc,b.inc)<=175;
  return {...row,startInc:a.inc,endInc:b.inc,startAzi:a.azi,endAzi:b.azi,deltaInc,deltaAzi,doglegDeg,dls,buildRate:deltaInc*30/row.lengthM,azimuthRate:aziReliable?deltaAzi*30/row.lengthM:null,endN:b.n,endE:b.e,endTvd:b.tvd,aziReliable,action:doglegDeg<1e-7?'Hold the starting tangent':(deltaInc>=0?'Build ':'Drop ')+Math.abs(deltaInc).toFixed(4)+'°'+(aziReliable?(deltaAzi>=0?'; turn right ':'; turn left ')+Math.abs(deltaAzi).toFixed(4)+'°':'; azimuth near vertical — use the endpoint tangent')};
 });
 return {path,schedule:{schema:'robotyx.landing-joints.v1',config:c,source:c.source|| (c.mode==='measured'?'User-entered measured lengths':'Assumed control/joint length'),rows,landingMiss:fit.miss,iterations:fit.iterations,converged:fit.converged,method:'One constant-curvature minimum-curvature arc per row. End MD/inc/azi reconstruct the whole landing trajectory.',units:{md:'m',length:'m',dogleg:'degrees over this row',dls:'degrees per 30 m'}}};
}
