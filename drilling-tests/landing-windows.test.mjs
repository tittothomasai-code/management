import {test} from 'node:test';import assert from 'node:assert/strict';
import {checkWindows,windowCorners,windowFrame,validateWindows,windowsFromPath} from '../drilling/opsnow_landing_windows.mjs';
import {planLanding,createLandingInspector} from '../drilling/opsnow_landing_core.mjs';
import {minCurve,atMD} from '../drilling/bha-builder/shared/wp-autotrack-core.js';
import {createLandingSimulation,landingSimulationInput,acceptLandingSimulationPlan,advanceLandingSimulation} from '../drilling/opsnow_landing_sim.mjs';
const start={md:0,n:0,e:0,tvd:0,inc:0,azi:0},gate=(id,tvd)=>({id,n:0,e:0,tvd,inc:0,azi:0,widthM:4,heightM:6});
test('window frames have metre dimensions in any orientation; validate dimensions, names and finite coordinates',()=>{
 for(const [inc,azi]of [[0,0],[90,15],[35,280]]){const w={...gate('A',10),inc,azi},c=windowCorners(w),f=windowFrame(w);assert.ok(Math.abs(Math.hypot(c[1].n-c[0].n,c[1].e-c[0].e,c[1].tvd-c[0].tvd)-4)<1e-8);assert.ok(Math.abs(Math.hypot(c[2].n-c[1].n,c[2].e-c[1].e,c[2].tvd-c[1].tvd)-6)<1e-8);assert.ok(Math.abs(f.normal.reduce((s,x,i)=>s+x*f.right[i],0))<1e-8);}
 assert.throws(()=>validateWindows([{...gate('A',10),widthM:0}]),/width/);assert.throws(()=>validateWindows([gate('A',1),gate('A',2)]),/unique/);assert.throws(()=>validateWindows([{...gate('A',1),n:NaN}]),/finite/);
});
test('forward plane crossings use true 3D bounds, inclusive edges and target order',()=>{
 const path=[start,minCurve(start,{md:100,inc:0,azi:0})];assert.deepEqual(checkWindows(path,[gate('A',20),gate('B',70)]).map(x=>x.status),['passed','passed']);assert.ok(Math.abs(checkWindows(path,[gate('A',20)])[0].crossing.md-20)<1e-6);
 assert.equal(checkWindows(path,[{...gate('edge',20),e:2}])[0].status,'passed');assert.equal(checkWindows(path,[{...gate('off-plane-view',20),e:2.01}])[0].status,'missed');assert.equal(checkWindows(path,[gate('B',70),gate('A',20)])[1].status,'out-of-order');assert.equal(checkWindows(path,[{...gate('reverse',20),inc:180}])[0].status,'not-reached');assert.equal(checkWindows(path,[gate('beyond',110)])[0].status,'not-reached');
});
test('curved arcs find a forward crossing even when both joint endpoints are on the same side',()=>{
 const a={...start,inc:80},b=minCurve(a,{md:20,inc:80,azi:180}),w={id:'curved',n:2,e:0,tvd:10,inc:90,azi:0,widthM:10,heightM:100};assert.ok(a.n<2&&b.n<2);const r=checkWindows([a,b],[w])[0];assert.equal(r.status,'passed');assert.ok(Math.abs(r.crossing.n-2)<1e-6);const p=atMD([a,b],r.crossing.md);assert.ok(Math.hypot(p.n-r.crossing.n,p.e-r.crossing.e,p.tvd-r.crossing.tvd)<1e-8);const apex=atMD([a,b],10);assert.equal(checkWindows([a,b],[{...w,id:'tangent only',n:apex.n,tvd:apex.tvd}])[0].status,'not-reached');
});
test('window misses reject otherwise valid landings and survive ledger reconstruction',()=>{
 const i={tie:start,target:{mode:'md',md:200,inc:30,azi:0},limits:{maxDls:10,positionTol:.1,angleTol:.1},joints:{mode:'nominal',nominalM:13},searchOptions:{budgetMs:10000,batchEvaluations:4}},baseline=planLanding(i),p=atMD(baseline.candidates[0].path,100),w={id:'lateral challenge',n:p.n,e:50,tvd:p.tvd,inc:p.inc,azi:p.azi,widthM:.2,heightM:.2},r=planLanding({...i,windows:[w]});assert.equal(r.recommendation,null);assert.ok(r.candidates.every(c=>!c.feasible&&c.windowChecks[0].status==='missed'));assert.ok(r.search.trace.every(c=>c.issues.some(x=>x.includes('Target window'))));w.e=400;assert.equal(r.search.replay.input.windows[0].e,50);const inspect=createLandingInspector(r.search.replay,r.search.trace);for(const row of r.search.trace)assert.deepEqual(inspect(row.id).windowChecks,row.windowChecks);
});
test('500 m SIM passes all frozen windows joint by joint; consumed windows leave remaining constraints',()=>{
 const s=createLandingSimulation();let r=planLanding(landingSimulationInput(s)),c=r.candidates.find(c=>c.id===r.recommendation);s.windows=windowsFromPath(c.path);const original=JSON.stringify(s.windows);let count=0;
 while(s.tie.md<500-1e-6&&count++<45){const i=landingSimulationInput(s);r=planLanding(i);c=acceptLandingSimulationPlan(s,r);assert.ok(c,'Window path absent at '+s.tie.md);assert.ok(c.windowChecks.every(w=>w.status==='passed'));advanceLandingSimulation(s,c);assert.equal(JSON.stringify(s.windows),original);}
 assert.equal(s.tie.md,500);assert.ok(checkWindows(s.drilled,s.windows).every(w=>w.status==='passed'));assert.equal(s.searchHistory.length,39);assert.equal(landingSimulationInput({...s,landingMd:510}).windows.length,0);assert.throws(()=>advanceLandingSimulation(s,{...c,windowChecks:[{status:'missed'}]}),/misses/);
});

test('the adaptive search changes joint instructions to pass an offset window instead of ignoring it',()=>{
 const i={tie:start,target:{mode:'md',md:200,inc:30,azi:0},limits:{maxDls:10,positionTol:.1,angleTol:.1},joints:{mode:'nominal',nominalM:13},searchOptions:{budgetMs:10000}},baseline=planLanding(i).candidates[0],p=atMD(baseline.path,100),window={id:'offset',n:p.n,e:.3,tvd:p.tvd,inc:p.inc,azi:p.azi,widthM:.2,heightM:2};assert.equal(checkWindows(baseline.path,[window])[0].status,'missed');const r=planLanding({...i,windows:[window]}),best=r.candidates.find(c=>c.id===r.recommendation);assert.ok(best);assert.equal(best.windowChecks[0].status,'passed');assert.ok(best.jointSchedule.rows.some(row=>Math.abs(row.deltaAzi)>.1));assert.ok(r.search.trace.some(c=>c.windowChecks.some(w=>w.status==='missed')));assert.equal(best.end.inc,30);assert.equal(best.end.azi,0);
});
