// ddtracks_data.js (feat/dd-tracks): SIM well plans as "tracks" for the DD cabin steering exercise track select.
// Plans are built with minimum curvature (ddcab_core.minCurve, Taylor & Mason SPE 3362). Build/drop rates in °/30 m. All SIM.
import {minCurve} from './ddcab_core.js?v=b11';
// error keys -> ddrun error fields (ddrun.errors()). Fields of keys NOT in a track's set are set to 0.
export const ERR={walk:{name:'Formation walk',f:['walkAzi','walkInc']},bitwalk:{name:'Bit walk',f:['bitWalk']},yield:{name:'Motor yield variance',f:['yieldSd']},
 tfdrift:{name:'Toolface drift + reactive torque',f:['tfDriftSd','rtPerBar']},noise:{name:'Survey noise (MWD)',f:['svInc','svAzi']},sag:{name:'BHA sag',f:['sag']}};
export const ALLF=Object.values(ERR).flatMap(e=>e.f);
// segments: [mdEnd, targetInc, rate °/30m (0 = hold)], azimuth constant per track
export function buildPlan(segs,azi=60,step=10){let s={md:0,inc:0,azi,E:0,N:0,tvd:0};const P=[{...s}],marks=[];let i0=0;
 for(const [end,inc,rate,label] of segs){if(label)marks.push({label,md:s.md});for(let md=s.md+step;md<=end+1e-6;md+=step){let i=s.inc;if(rate>0)i=i<inc?Math.min(inc,i+rate*step/30):Math.max(inc,i-rate*step/30);s=minCurve(s,md,i,azi);P.push(s)}}
 marks.push({label:'TD',md:s.md});return {P,marks}}
export const CUPS=[
 {id:'rookie',name:'Rookie Cup',icon:'🥉',tracks:[
  {id:'r1',name:'First Build',stars:1,diff:'easy',need:40,azi:45,errs:[],segs:[[300,0,0],[600,20,2,'KOP'],[1100,20,0,'EOB'],],note:'Kick off, build to 20°, hold.'},
  {id:'r2',name:'Windy Hold',stars:1,diff:'easy',need:40,azi:60,errs:['walk'],segs:[[300,0,0],[700,30,2.5,'KOP'],[1300,30,0,'EOB']],note:'Build to 30°, hold against formation walk.'},
  {id:'r3',name:'Steady Hand',stars:2,diff:'normal',need:40,azi:90,errs:['walk','noise'],segs:[[300,0,0],[650,35,3,'KOP'],[1400,35,0,'EOB']],note:'Build to 35°, hold with noisy surveys.'}]},
 {id:'pro',name:'Pro Cup',icon:'🥈',tracks:[
  {id:'p1',name:'S-Bend',stars:3,diff:'normal',need:35,azi:30,errs:['walk','bitwalk','yield'],segs:[[300,0,0],[600,30,3,'KOP'],[1000,30,0,'EOB'],[1450,0,2,'Drop'],[1700,0,0,'Vertical']],note:'S-well: build, tangent, drop back to vertical.'},
  {id:'p2',name:'Walk the Line',stars:3,diff:'normal',need:35,azi:120,errs:['walk','bitwalk','tfdrift'],segs:[[300,0,0],[700,40,3,'KOP'],[1700,40,0,'Tangent']],note:'Long tangent. Fight bit walk and toolface drift.'},
  {id:'p3',name:'Sag Valley',stars:4,diff:'hard',need:30,azi:200,errs:['walk','bitwalk','tfdrift','yield','sag'],segs:[[300,0,0],[650,45,4,'KOP'],[1300,45,0,'Tangent'],[1550,25,2,'Drop'],[1800,25,0,'Hold']],note:'Tangent, drop and hold with BHA sag.'}]},
 {id:'expert',name:'Expert Cup',icon:'🥇',tracks:[
  {id:'e1',name:'Soft Landing',stars:4,diff:'normal',need:30,azi:0,errs:['walk','bitwalk','yield','noise'],segs:[[300,0,0],[1200,90,3,'KOP'],[1800,90,0,'Landing']],note:'Build to horizontal and land in the zone.'},
  {id:'e2',name:'Geosteer Run',stars:5,diff:'hard',need:25,azi:270,errs:['walk','bitwalk','tfdrift','noise','sag'],segs:[[300,0,0],[1150,88,3,'KOP'],[1450,88,0,'Landing'],[1550,92,1.5,'Geosteer up'],[1750,92,0],[1850,89,1.5,'Geosteer down'],[2000,89,0]],note:'Horizontal landing, then geosteer the lateral. Noisy surveys.'},
  {id:'e3',name:'Full Chaos',stars:5,diff:'hard',need:25,azi:150,errs:Object.keys(ERR),segs:[[300,0,0],[1100,90,3.4,'KOP'],[1500,90,0,'Landing'],[1650,93,1.5,'Geosteer'],[2100,93,0]],note:'Every error on. Hard horizontal landing and lateral.'}]}];
export const TRACKS=CUPS.flatMap((c,ci)=>c.tracks.map((t,ti)=>Object.assign(t,{cup:c.id,ci,ti})));
TRACKS.forEach((t,i)=>{t.idx=i;const b=buildPlan(t.segs,t.azi);t.plan=b.P;t.marks=b.marks;t.td=b.P.at(-1).md});
