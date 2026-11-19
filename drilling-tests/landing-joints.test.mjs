import {test} from 'node:test';import assert from 'node:assert/strict';
import {jointBoundaries,parseJointLengths,jointDogleg} from '../drilling/opsnow_landing_joints.mjs';
import {planLanding} from '../drilling/opsnow_landing_core.mjs';
import {minCurve} from '../drilling/bha-builder/shared/wp-autotrack-core.js';
import {createLandingSimulation,landingSimulationInput,acceptLandingSimulationPlan,advanceLandingSimulation} from '../drilling/opsnow_landing_sim.mjs';
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b}`);
const origin={md:0,n:0,e:0,tvd:0,inc:0,azi:0},limits={maxDls:15,positionTol:.05,angleTol:.1};
test('6/9/13 m schedules stop on a partial final joint and retain full pipe lengths',()=>{
 for(const [mode,L]of [['6',6],['9',9],['nominal',13]]){const rows=jointBoundaries(100,150,{mode,nominalM:13,anchorMd:100});near(rows.reduce((s,r)=>s+r.lengthM,0),50);near(rows.at(-1).endMd,150);near(rows[0].fullJointM,L);assert.equal(rows.at(-1).partialAtLanding,true);near(rows.at(-1).fullJointM,L);}
});
test('measured lengths maintain first remaining length, full lengths and stable MD boundaries after a new survey',()=>{
 const records=parseJointLengths('joint,lengthM\nJ208,12.39\nJ209,12.44\nJ210,12.31');
 const config={mode:'measured',records,anchorMd:2618.9,firstRemainingM:4.11};let r=jointBoundaries(2618.9,2640,config);
 near(r[0].endMd,2623.01);near(r[0].fromWithinJointM,8.28);near(r[0].fullJointM,12.39);assert.equal(r[0].partialAtStart,true);assert.equal(r.at(-1).partialAtLanding,true);
 r=jointBoundaries(2627,2640,config);assert.equal(r[0].joint,'J209');near(r[0].endMd,2635.45);near(r[0].availableM,8.45);near(r[0].fromWithinJointM,3.99);
 const nominal=jointBoundaries(130,150,{mode:'nominal',nominalM:13,anchorMd:100});assert.equal(nominal[0].joint,'Step 3');near(nominal[0].endMd,139);near(nominal[0].lengthM,9);
});
test('measured coverage gaps are never replaced by nominal lengths or called a hard geometric failure',()=>{
 assert.throws(()=>jointBoundaries(0,100,{mode:'measured',records:[{id:'only',lengthM:12.4}],anchorMd:0}),/Supply the remaining/);
 const r=planLanding({tie:origin,target:{mode:'md',md:100,inc:10,azi:0},limits,joints:{mode:'measured',records:[{id:'only',lengthM:12.4}]}});assert.equal(r.recommendation,null);assert.equal(r.coverageMissing,true);assert.equal(r.difficulty.hard,false);
 assert.throws(()=>parseJointLengths('joint,lengthM\nA,12\nA,13'),/unique/);assert.throws(()=>parseJointLengths('joint,lengthM\nA,0'),/lengths/);
});
test('joint instructions reproduce an analytic constant-curvature landing with exact dogleg/DLS per joint',()=>{
 const r=planLanding({tie:origin,target:{mode:'md',md:900,inc:90,azi:0},limits,joints:{mode:'nominal',nominalM:13,anchorMd:0}}),c=r.candidates[0];let p={...origin};
 for(const row of c.jointSchedule.rows){near(row.dls,3);near(row.doglegDeg,row.lengthM*.1);near(row.dls*row.lengthM/30,row.doglegDeg);p=minCurve(p,{md:row.endMd,inc:row.endInc,azi:row.endAzi});}
 near(p.md,900);near(p.inc,90);near(p.n,900/(Math.PI/2));near(p.tvd,900/(Math.PI/2));near(c.peakDls,3);near(c.jointSchedule.rows.at(-1).lengthM,3);
});
test('a position landing reconstructed only from the row MD/inc/azi reaches the requested place and tangent',()=>{
 const target={mode:'position',md:680,n:300,e:100,tvd:500,inc:85,azi:20};
 for(const cfg of [{mode:'6'},{mode:'9'},{mode:'nominal',nominalM:12.42},{mode:'measured',records:Array.from({length:65},(_,i)=>({id:'PIPE-'+i,lengthM:[12.31,12.66,12.42][i%3]}))}]){
  const r=planLanding({tie:origin,target,limits:{...limits,maxDls:30},joints:cfg}),c=r.candidates.find(c=>c.id===r.recommendation);assert.ok(c,'No fitted joint schedule for '+cfg.mode);let p={...origin};
  for(const row of c.jointSchedule.rows){near(row.startMd,p.md);const next=minCurve(p,{md:row.endMd,inc:row.endInc,azi:row.endAzi});near(jointDogleg(p,next),row.doglegDeg);near(row.dls,row.doglegDeg*30/row.lengthM);p=next;}
  near(p.md,680);near(p.n,300,.005);near(p.e,100,.005);near(p.tvd,500,.005);near(p.inc,85);near(p.azi,20);
 }
});
test('an isolated 500 m well repeatedly searches and executes each joint with an immutable drilled prefix',()=>{
 for(const mode of ['6','9','nominal','measured']){
  const s=createLandingSimulation('normal',mode);let count=0;
  while(s.tie.md<500-1e-6&&count++<120){const before=JSON.stringify(s.drilled),r=planLanding(landingSimulationInput(s));assert.equal(JSON.stringify(s.drilled),before);const c=acceptLandingSimulationPlan(s,r);assert.ok(c,mode+' failed at '+s.tie.md);advanceLandingSimulation(s,c);}
  near(s.tie.md,500);near(s.tie.tvd,300,.005);near(s.tie.inc,90);near(s.tie.azi,15);assert.ok(s.executed.at(-1).partialAtLanding);assert.equal(s.events.length,0);
 }
});
test('shallower reservoir replans remaining joints; deeper reservoir blocks 500 m and only changes MD explicitly',()=>{
 for(const kind of ['early','deep']){
  const s=createLandingSimulation(kind);let snapshot=null,blocked=false,count=0;
  while(s.tie.md<s.landingMd-1e-6&&count++<100){if(!snapshot&&s.tie.md>=260-1e-7)snapshot=JSON.stringify(s.drilled);const r=planLanding(landingSimulationInput(s)),c=acceptLandingSimulationPlan(s,r);if(!c){assert.equal(kind,'deep');assert.equal(s.landingMd,500);assert.equal(r.difficulty.hard,true);assert.equal(JSON.stringify(s.drilled),snapshot);blocked=true;s.landingMd=510;continue;}advanceLandingSimulation(s,c);if(snapshot)assert.equal(JSON.stringify(s.drilled.slice(0,JSON.parse(snapshot).length)),snapshot);}
  near(s.tie.md,kind==='deep'?510:500);near(s.tie.tvd,kind==='deep'?320:280,.005);near(s.tie.inc,90);near(s.tie.azi,15);assert.equal(s.events[0].fromTvd,300);assert.equal(blocked,kind==='deep');
 }
});
test('a prior plan from another scope never becomes a carry-forward candidate',()=>{
 const input={scope:{well:'ONE'},tie:origin,target:{mode:'md',md:100,inc:10,azi:0},limits,joints:{mode:'6'}},r=planLanding(input),c=r.candidates.find(c=>c.id===r.recommendation),other=planLanding({...input,scope:{well:'TWO'},previous:{scope:r.scope,path:c.path}});assert.equal(other.candidates.some(c=>c.carryForward),false);
});
