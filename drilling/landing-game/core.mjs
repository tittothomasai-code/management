// A game spline, not a drilling instruction or a physical BHA response model.
import {parseJointLengths,validateJointConfig,jointBoundaries} from '../opsnow_landing_joints.mjs';
import {createReservoir,alignReservoirTargets,surfaceAt,floorConflict,validateReservoir} from './reservoir.mjs';
import {validateLanding,entryPose,landingStatus} from './landing.mjs';
export {parseJointLengths,validateLanding};
const F=Number.isFinite,keys=['n','e','tvd'],R=Math.PI/180,dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=v=>Math.hypot(...v),unit=v=>{const m=norm(v);return m>1e-10?v.map(x=>x/m):[0,0,1];},vec=p=>keys.map(k=>p[k]),diff=(a,b)=>keys.map(k=>a[k]-b[k]);
const direction=p=>p.tangent||[Math.sin(p.inc*R)*Math.cos(p.azi*R),Math.sin(p.inc*R)*Math.sin(p.azi*R),Math.cos(p.inc*R)];
const angles=v=>({inc:Math.acos(Math.max(-1,Math.min(1,v[2])))/R,azi:(Math.atan2(v[1],v[0])/R+360)%360});
function point(p){if(!p||!keys.every(k=>F(p[k])&&Math.abs(p[k])<=5000))throw Error('Place targets within ±5,000 m in local N / E / TVD.');return Object.fromEntries(keys.map(k=>[k,p[k]]));}
export const demoTally=()=>Array.from({length:80},(_,i)=>({id:'SIM '+(i+1),lengthM:[12.42,12.31,12.66,12.18,12.57][i%5]}));
export function createGame(kickoff={md:0,n:0,e:0,tvd:0,inc:0,azi:15}){
 if(!F(kickoff.md)||kickoff.md<0||!F(kickoff.inc)||kickoff.inc<0||kickoff.inc>180||!F(kickoff.azi)||kickoff.azi<0||kickoff.azi>=360)throw Error('Kickoff needs a non-negative MD and valid inclination/azimuth.');point(kickoff);
 const targets=[{id:'target-1',name:'First build',n:55,e:-32,tvd:100},{id:'target-2',name:'Sky bend',n:165,e:52,tvd:205},{id:'target-3',name:'Reservoir entry',role:'entry',n:340,e:30,tvd:295},{id:'target-4',name:'Landing',role:'landing',n:420,e:38,tvd:300}].map(t=>({...t,n:t.n+kickoff.n,e:t.e+kickoff.e,tvd:t.tvd+kickoff.tvd,passed:false}));
 const g={schema:'robotyx.sky-run.v1',kickoff:{...kickoff},md:kickoff.md,targets,reservoir:createReservoir(kickoff),landing:{mode:'surface',azi:15,inc:90,widthM:12,heightM:6,entryDistance:80},nextId:5,mode:'10',tally:demoTally(),tallySource:'SIMULATED varied joint lengths',firstRemainingM:null,path:[],rings:[],finished:false,version:0};rebuild(g);return g;
}
function spline(start,targets,reservoir){
 const knots=[start,...targets],path=[{...start,tangent:unit(direction(start))}],startDir=unit(direction(start));let md=start.md;
 for(let i=0;i<knots.length-1;i++){
  const a=knots[i],b=knots[i+1],L=norm(diff(b,a));if(L<.5)throw Error('Keep neighbouring targets at least 0.5 m apart.');
  const before=knots[Math.max(0,i-1)],after=knots[Math.min(knots.length-1,i+2)],m0=i===0?startDir.map(x=>x*L*.8):diff(b,before).map(x=>x*.5),m1=i===knots.length-2?diff(b,a):diff(after,a).map(x=>x*.5),steps=Math.min(800,Math.max(12,Math.ceil((L+norm(m0)+norm(m1))/2)));
  for(const [p,m,locked]of [[a,m0,i===0],[b,m1,false]]){const surface=surfaceAt(reservoir,p.n,p.e);if(surface&&!locked&&p.tvd>=surface.roof&&p.tvd<=surface.floor)m[2]=surface.gradientN*m[0]+surface.gradientE*m[1];}if(b.role==='landing'&&b.entryTangent){const length=norm(diff(b,a));b.entryTangent.forEach((v,k)=>m1[k]=v*length);}
  for(let j=1;j<=steps;j++){const t=j/steps,t2=t*t,t3=t2*t,p={},v=[];for(let k=0;k<3;k++){const av=a[keys[k]],bv=b[keys[k]];p[keys[k]]=(2*t3-3*t2+1)*av+(t3-2*t2+t)*m0[k]+(-2*t3+3*t2)*bv+(t3-t2)*m1[k];v.push((6*t2-6*t)*av+(3*t2-4*t+1)*m0[k]+(-6*t2+6*t)*bv+(3*t2-2*t)*m1[k]);}md+=norm(diff(p,path.at(-1)));const tangent=unit(v);path.push({...p,md,tangent,...angles(tangent),...(j===steps?{targetId:b.id}:{})});}
 }
 return path;
}
export function atDistance(path,md){
 if(!path.length)throw Error('No game path.');if(md<=path[0].md)return {...path[0]};if(md>=path.at(-1).md)return {...path.at(-1)};let lo=1,hi=path.length-1;while(lo<hi){const m=(lo+hi)>>1;if(path[m].md<md)lo=m+1;else hi=m;}const a=path[lo-1],b=path[lo],u=(md-a.md)/(b.md-a.md),tangent=unit(a.tangent.map((x,i)=>x+(b.tangent[i]-x)*u));return {...Object.fromEntries(keys.map(k=>[k,a[k]+(b[k]-a[k])*u])),md,tangent,...angles(tangent)};
}
export function rebuild(g){
 validateLanding(g.landing);alignReservoirTargets(g);g.targets.at(-1).entryTangent=entryPose(g).tangent;const start=g.path.length?atDistance(g.path,g.md):{...g.kickoff,tangent:direction(g.kickoff)},remaining=g.targets.filter(t=>!t.passed);if(!remaining.length){g.finished=true;return;}
 const head=g.path.filter(p=>p.md<g.md-1e-7),tail=spline(start,remaining,g.reservoir);g.path=[...head,...tail];for(const t of remaining)t.md=tail.find(p=>p.targetId===t.id).md;g.floorConflict=floorConflict(g.path,g.reservoir,g.md);g.landingStatus=landingStatus(g);g.version++;refreshRings(g);
}
export function refreshRings(g){
 const end=g.path.at(-1).md;let boundaries=[],covered=end;
 if(g.mode==='tally'){
  const config={mode:'measured',records:g.tally,anchorMd:g.kickoff.md,firstRemainingM:g.firstRemainingM};validateJointConfig(config);covered=Math.min(end,g.kickoff.md+g.tally.reduce((s,t)=>s+t.lengthM,0)-(g.firstRemainingM===null?0:g.tally[0].lengthM-g.firstRemainingM));if(covered>g.kickoff.md+1e-6)boundaries=jointBoundaries(g.kickoff.md,covered,config).filter(r=>!r.partialAtLanding||Math.abs(r.endMd-end)<1e-6).map(r=>({md:r.endMd,label:r.joint,partial:r.partialAtLanding}));
 }else{const spacing=Number(g.mode);if(![10,30].includes(spacing))throw Error('Choose 10 m, 30 m or tally spacing.');for(let md=g.kickoff.md+spacing;md<end-1e-5;md+=spacing)boundaries.push({md,label:Math.round(md-g.kickoff.md)+' m'});}
 g.coveredMd=covered;const targets=g.targets.filter(t=>t.md<=covered+1e-6);g.rings=[...boundaries.filter(r=>!targets.some(t=>Math.abs(t.md-r.md)<.15)).map(r=>({...atDistance(g.path,r.md),id:'guide-'+r.md.toFixed(5),name:r.label,type:'guide',partial:!!r.partial,passed:r.md<=g.md+1e-7})),...targets.map(t=>({...atDistance(g.path,t.md),...t,type:'target'}))].sort((a,b)=>a.md-b.md);if(g.rings.length>2000)throw Error('Route has too many rings; use 30 m spacing.');
}
export function moveRing(g,id,position,{landing=null}={}){
 if(g.finished)throw Error('Restart to move targets after landing.');const ring=g.rings.find(r=>r.id===id);if(!ring||ring.passed||ring.md<=g.md+.05)throw Error('The flown section is fixed. Move a ring ahead of the bit.');const p=point(position),snapshot=JSON.stringify({targets:g.targets,path:g.path,rings:g.rings,nextId:g.nextId,version:g.version,coveredMd:g.coveredMd,reservoir:g.reservoir,landing:g.landing,landingStatus:g.landingStatus,floorConflict:g.floorConflict});let target=g.targets.find(t=>t.id===id);
 try{if(landing){Object.assign(g.landing,landing);validateLanding(g.landing);}if(!target){if(g.targets.length>=40)throw Error('Use at most 40 movable targets.');const index=g.targets.findIndex(t=>t.md>ring.md);target={id:'target-'+g.nextId++,name:'Your target '+(g.nextId-1),...p,passed:false};g.targets.splice(index<0?g.targets.length:index,0,target);}else Object.assign(target,p);if(target.role==='landing'){const dn=p.n-g.reservoir.n,de=p.e-g.reservoir.e;g.reservoir.centerTvd=p.tvd;for(const t of g.targets)if(t.role==='entry'&&!t.passed){t.n+=dn;t.e+=de;}}if(target.role==='entry'){const end=g.targets.at(-1);g.landing.azi=(Math.atan2(end.e-p.e,end.n-p.n)/R+360)%360;g.landing.entryDistance=Math.max(5,Math.min(1000,Math.hypot(end.n-p.n,end.e-p.e)));g.reservoir.centerTvd+=p.tvd-surfaceAt(g.reservoir,p.n,p.e,{outside:true}).mid;}rebuild(g);return target.id;}catch(e){Object.assign(g,JSON.parse(snapshot));throw e;}
}
export function advance(g,metres){
 if(!F(metres)||metres<0)throw Error('Advance must be non-negative.');const end=Math.min(g.path.at(-1).md,g.coveredMd,g.floorConflict?.md??Infinity,g.landingStatus?.stopMd??Infinity);g.md=Math.min(end,g.md+metres);for(const t of g.targets)if(t.md<=g.md+1e-6)t.passed=true;for(const r of g.rings)r.passed=r.md<=g.md+1e-6;g.finished=g.md>=g.path.at(-1).md-1e-6;return atDistance(g.path,g.md);
}
export function setSpacing(g,mode,{records=null,source=null,firstRemainingM=null}={}){
 const old={mode:g.mode,tally:g.tally,tallySource:g.tallySource,firstRemainingM:g.firstRemainingM};try{g.mode=mode;if(records){g.tally=records.map(r=>({...r}));g.firstRemainingM=firstRemainingM;}if(source)g.tallySource=source;refreshRings(g);g.version++;}catch(e){Object.assign(g,old);refreshRings(g);throw e;}
}
export function pathDls(path,md){const a=atDistance(path,Math.max(path[0].md,md-.5)),b=atDistance(path,Math.min(path.at(-1).md,md+.5)),angle=Math.acos(Math.max(-1,Math.min(1,dot(a.tangent,b.tangent))));return b.md>a.md?angle/R*30/(b.md-a.md):0;}

export function editReservoir(g,patch){if(g.finished)throw Error('Restart to reshape the reservoir after landing.');const old=JSON.stringify({reservoir:g.reservoir,targets:g.targets,path:g.path,rings:g.rings,version:g.version,floorConflict:g.floorConflict,coveredMd:g.coveredMd,landing:g.landing,landingStatus:g.landingStatus});try{Object.assign(g.reservoir,patch);validateReservoir(g.reservoir);rebuild(g);}catch(e){Object.assign(g,JSON.parse(old));throw e;}}
