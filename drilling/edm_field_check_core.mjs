// Field screening in the declared projected frame. No invented offsets or zero coordinates.
import {fwd,parseZone2} from './edmgeo.js?v=2';
import {radius} from './ac.js?v=fp-ops-r2-20261108';
const finite=Number.isFinite,canonical=s=>{const n=String(s||'').trim().toUpperCase().replace(/[\s_-]/g,'');return n==='DR0101L'?'DR101L':n;},clamp=x=>Math.max(0,Math.min(1,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((v,i)=>v-b[i]),vec=p=>[p.E,p.N,p.Z];
export function closestSegments(a,b,c,d){
 const p=vec(a),q=vec(c),u=sub(vec(b),p),v=sub(vec(d),q),w=sub(p,q),aa=dot(u,u),ee=dot(v,v),f=dot(v,w);let s=0,t=0;
 if(aa<1e-16&&ee<1e-16){}else if(aa<1e-16)t=clamp(f/ee);else{const cc=dot(u,w);if(ee<1e-16)s=clamp(-cc/aa);else{const bb=dot(u,v),den=aa*ee-bb*bb;s=den>1e-16?clamp((bb*f-cc*ee)/den):0;t=(bb*s+f)/ee;if(t<0){t=0;s=clamp(-cc/aa);}else if(t>1){t=1;s=clamp((bb-cc)/aa);}}}
 const A=p.map((x,i)=>x+s*u[i]),B=q.map((x,i)=>x+t*v[i]);return {distance:Math.hypot(...sub(A,B)),s,t,mdRef:a.md+s*(b.md-a.md),mdOff:c.md+t*(d.md-c.md),pointRef:{E:A[0],N:A[1],Z:A[2]},pointOffset:{E:B[0],N:B[1],Z:B[2]}};
}
export function pathIntersectsRadius(path,center,radiusM=10000){
 const origin={E:center.E,N:center.N,Z:0,md:0};for(let i=0;i<path.length;i++){const a={...path[Math.max(0,i-1)],Z:0},b={...path[i],Z:0};if(closestSegments(a,b,origin,origin).distance<=radiusM)return true;}return false;
}
function frame(W){
 const z=parseZone2(W.crs?.zone,W.crs?.datum),datum=String(W.crs?.datum||'').toUpperCase();
 if(!z||!Number.isInteger(z.zone)||z.zone<1||z.zone>60||!['GDA2020','GDA94','WGS84'].some(x=>datum.replace(/\s/g,'').includes(x)))return null;
 return {zone:z.zone,south:z.south,datum:datum.includes('2020')?'GDA2020':datum.includes('94')?'GDA94':'WGS84',vertical:/mean sea level|\bmsl\b/i.test(W.crs?.sys||'')?'MSL':/\bahd\b/i.test(W.crs?.sys||'')?'AHD':null};
}
function wellhead(W,w,F){
 const s=W.sites?.find(s=>s.id===w.site),valid=(e,n)=>finite(e)&&finite(n)&&e>100000&&e<1000000&&n>0&&n<10000000;
 if(s?.wells?.length===1&&s.wells[0]===w.id&&valid(s.mapE,s.mapN)&&(!valid(w.mapE,w.mapN)||Math.hypot(w.mapE-s.mapE,w.mapN-s.mapN)<.2))return {E:s.mapE,N:s.mapN,source:'EDM site map coordinates'};
 if(valid(w.mapE,w.mapN))return {E:w.mapE,N:w.mapN,source:'EDM well map coordinates'};
 if(finite(w.lat)&&finite(w.lon)&&Math.abs(w.lat)>.001&&Math.abs(w.lat)<=90&&Math.abs(w.lon)<=180){const p=fwd(w.lat,w.lon,F.zone,F.south);return {E:p.E,N:p.N,source:'Declared-datum latitude/longitude projected to the source grid'};}return null;
}
export function normalizeModel(W,sourceId='active'){
 const F=frame(W),warnings=[],paths=[],wells=[];
 if(!F)return {sourceId,name:W.name,frame:null,paths,wells,warnings:[{sourceId,reason:'Horizontal CRS or datum missing/unsupported'}]};
 if(!F.vertical)warnings.push({sourceId,reason:'Vertical datum missing; trajectories cannot be assessed against other datums'});
 for(const w of W.wells||[]){
  const head=wellhead(W,w,F);if(!head){warnings.push({sourceId,well:w.name,reason:'Wellhead coordinates missing or zero'});continue;}
  const localFinite=finite(w.E)&&finite(w.N);wells.push({id:w.id,name:w.name,...head,frame:F});
  for(const b of (W.wbs||[]).filter(b=>b.well===w.id)){
   if(!localFinite||!Array.isArray(b.path)||b.path.length<2||!b.path.every(p=>[p.E,p.N,p.Z,p.md].every(finite))){warnings.push({sourceId,well:w.name,wellbore:b.name,reason:'Trajectory absent or contains invalid coordinates'});continue;}
   const points=b.path.map(p=>({...p,E:head.E+p.E-w.E,N:head.N+p.N-w.N}));
   if(points.some((p,i)=>i&&p.md<points[i-1].md)){warnings.push({sourceId,well:w.name,wellbore:b.name,reason:'Trajectory MD is not monotonic'});continue;}
   const stations=b.traj?.[0]?.stations;
   paths.push({sourceId,sourceName:W.name,well:w.name,wellId:w.id,id:b.id,name:b.name,frame:F,points,head,
    kind:/planned/i.test(b.status||'')||b.traj?.[0]?.phase==='PLAN'?'PLANNED':/drilled|actual/i.test(b.status||'')?'AS-DRILLED':'UNSPECIFIED',
    decimated:finite(stations)&&stations>points.length,loadedStations:points.length,sourceStations:stations??null});
  }
 }return {sourceId,name:W.name,frame:F,paths,wells,warnings};
}
const sameFrame=(a,b)=>a&&b&&a.zone===b.zone&&a.south===b.south&&a.datum===b.datum&&a.vertical&&a.vertical===b.vertical;
export function trajectoryPair(A,B){
 let closest=null,sfMin=Infinity,sfCase=null;
 for(let i=1;i<A.points.length;i++)for(let j=1;j<B.points.length;j++){
  const a=A.points[i-1],b=A.points[i],c=B.points[j-1],d=B.points[j],r=closestSegments(a,b,c,d);
  if(!closest||r.distance<closest.distance)closest=r;
  // Maximum cone radii on each segment give a conservative SF lower bound.
  const sf=r.distance/(radius(Math.max(a.md,b.md))+radius(Math.max(c.md,d.md)));
  if(sf<sfMin){sfMin=sf;sfCase=r;}
 }
 return {closestApproachM:closest.distance,closestAt:closest,sfLowerBound:sfMin,sfAt:sfCase,flag:sfMin<1?'STOP':sfMin<1.5?'REVIEW':'NO PROXIMITY FLAG'};
}
export function assessField(models,{wellName='DR101L',radiusM=10000,now=new Date().toISOString()}={}){
 if(!finite(radiusM)||radiusM<=0)throw Error('A positive search radius is required.');
 const normalized=models.map((m,i)=>normalizeModel(m.W||m,m.id||'source-'+i)),target=canonical(wellName),references=normalized.flatMap(m=>m.paths).filter(p=>canonical(p.well)===target),center=references[0]?.head;
 const report={schema:'robotyx-field-screen/1',well:wellName,radiusM,generatedAt:now,status:'INCOMPLETE',center:center?{E:center.E,N:center.N,crs:references[0].frame}:null,
  sourceDatasets:normalized.map(m=>({id:m.sourceId,name:m.name,wells:m.wells.length,trajectories:m.paths.length})),referenceTrajectories:references.map(p=>({name:p.name,source:p.sourceName,kind:p.kind,loadedStations:p.loadedStations,sourceStations:p.sourceStations})),
  results:[],skipped:normalized.flatMap(m=>m.warnings),outsideRadius:0,sameWellExcluded:0,duplicatesExcluded:0,
  limitations:['Only loaded EDM datasets were searched; regional well-inventory completeness is not established.','Simplified cone uncertainty: radius = 1 m + 1% MD; SF is a conservative segment bound, not an approved survey error model.']};
 if(!references.length){report.limitations.unshift('No valid reference trajectory or wellhead was available.');return report;}
 if(references.some(p=>p.decimated))report.limitations.push('Reference geometry uses display-decimated paths; full-resolution surveys are required for a final assessment.');
 if(references.some(p=>sameFrame(p.frame,references[0].frame)&&Math.hypot(p.head.E-center.E,p.head.N-center.N)>1))report.limitations.push('Reference-well sources disagree on wellhead position by more than 1 m; review source placement before relying on the comparisons.');
 const offsets=[],seen=new Set();
 for(const m of normalized)for(const p of m.paths){
  if(canonical(p.well)===target){report.sameWellExcluded++;continue;}
  if(!sameFrame(p.frame,references[0].frame)){report.skipped.push({source:p.sourceName,well:p.well,wellbore:p.name,reason:'Horizontal or vertical datum differs or is unknown; no transformation was assumed'});continue;}
  if(!pathIntersectsRadius(p.points,center,radiusM)){report.outsideRadius++;continue;}
  const signature=JSON.stringify([canonical(p.well),p.name,p.points]);if(seen.has(signature)){report.duplicatesExcluded++;continue;}seen.add(signature);offsets.push(p);
 }
 for(const off of offsets)for(const ref of references){
  if(!sameFrame(ref.frame,off.frame)){report.skipped.push({source:ref.sourceName,well:ref.well,wellbore:ref.name,reason:'Reference/offset datum differs'});continue;}
  report.results.push({reference:ref.name,referenceSource:ref.sourceName,referenceKind:ref.kind,offsetWell:off.well,offset:off.name,offsetSource:off.sourceName,offsetKind:off.kind,offsetDecimated:off.decimated,...trajectoryPair(ref,off)});
 }
 report.assessedOffsetTrajectories=offsets.length;report.assessedPairs=report.results.length;report.results.sort((a,b)=>a.sfLowerBound-b.sfLowerBound);
 report.status=report.results.length?'LOADED DATA SCREENED':'INCOMPLETE';
 if(!offsets.length)report.limitations.unshift('No surrounding offset trajectories in a compatible datum were available within 10 km. This is not clearance.');
 if(offsets.some(p=>p.decimated))report.limitations.push('Some offset trajectories are display-decimated; omitted survey stations were not assessed.');
 return report;
}
