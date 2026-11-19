import {test} from 'node:test';import assert from 'node:assert/strict';
import {planLanding,surveyResponse,parseExposures,fitSteeringResponse,responseSensitivity,compareBhaRuns} from '../drilling/opsnow_landing_core.mjs';
const close=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<=tol,`${a} is not within ${tol} of ${b}`);
const tie={md:0,n:0,e:0,tvd:0,inc:0,azi:0},limits={maxDls:10,positionTol:1,angleTol:.1,responseLow:.8,responseHigh:1.2};
function mdInput(extra={}){return {tie:{...tie},target:{mode:'md',md:900,inc:90,azi:0},limits:{...limits},...extra};}
test('uniform 90-degree build matches the analytic circular arc and lower DLS bound',()=>{
 const r=planLanding(mdInput()),c=r.candidates[0],radius=900/(Math.PI/2);
 close(c.peakDls,3);close(c.end.n,radius);close(c.end.e,0);close(c.end.tvd,radius);close(r.minimumAverageDls,3);assert.equal(r.recommendation,'landing-1');
});
test('MD/angle search stops on a proven curvature lower bound rather than filling a scenario quota',()=>{
 const r=planLanding(mdInput());assert.equal(r.search.evaluated,1);assert.equal(r.search.status,'exact-tangent-bound-attained');assert.equal(r.uniqueCount,1);const c=r.candidates[0];close(c.end.md,900);close(c.end.inc,90);assert.equal(c.positionMiss,null);close(c.peakDls,r.minimumAverageDls);
});
test('azimuth wraps by the short turn and near-vertical landing does not invent directional curvature',()=>{
 const r=planLanding(mdInput({tie:{...tie,inc:90,azi:359},target:{mode:'md',md:300,inc:90,azi:1}}));close(r.candidates[0].peakDls,.2,1e-5);close(r.candidates[0].end.azi,1);
 const h=planLanding(mdInput({target:{mode:'md',md:300,inc:0,azi:123}}));close(h.candidates[0].peakDls,0);assert.equal(h.uniqueCount,1);
});
test('straight hold duplicates are labelled; an impossible DLS ceiling produces no recommendation',()=>{
 const h=planLanding(mdInput({tie:{...tie,inc:40,azi:60},target:{mode:'md',md:300,inc:40,azi:60}}));assert.equal(h.search.evaluated,1);assert.equal(h.uniqueCount,1);assert.equal(h.search.status,'exact-tangent-bound-attained');
 const blocked=planLanding(mdInput({limits:{...limits,maxDls:1}}));assert.equal(blocked.recommendation,null);assert.ok(blocked.candidates.every(c=>!c.feasible));
});
test('position templates meet the actual N/E/TVD target and endpoint angles; sampled geometry converges',()=>{
 const target={mode:'position',n:300,e:100,tvd:500,inc:85,azi:20,md:null},r=planLanding(mdInput({target,limits:{...limits,maxDls:30}}));
 assert.ok(r.search.evaluated>10);assert.ok(r.candidates.length>0);assert.ok(r.recommendation);
 for(const c of r.candidates){close(c.end.n,300,.005);close(c.end.e,100,.005);close(c.end.tvd,500,.005);close(c.end.inc,85);close(c.end.azi,20);assert.ok(c.mdLength>=Math.hypot(300,100,500));assert.equal(c.resolution,'Joint-by-joint minimum curvature');assert.ok(c.cumulativeIntegrationError<=.05);}
});
test('position-mode MD constraint is solved; MD shorter than straight distance is never marked feasible',()=>{
 const target={mode:'position',n:300,e:100,tvd:500,inc:85,azi:20,md:680},r=planLanding(mdInput({target,limits:{...limits,maxDls:30}}));
 assert.ok(r.candidates.some(c=>c.feasible));for(const c of r.candidates.filter(c=>c.feasible))close(c.end.md,680,.1);
 const b=planLanding(mdInput({target:{...target,md:300}}));assert.equal(b.recommendation,null);assert.ok(b.candidates.every(c=>c.issues.includes('Landing MD not met')||!c.path.length));
});
test('same straight position curve is not miscounted as ten geometries because parameter speed differs',()=>{
 const r=planLanding(mdInput({target:{mode:'position',n:0,e:0,tvd:500,inc:0,azi:0,md:null}}));assert.equal(r.uniqueCount,1);close(r.candidates[0].end.md,500);
});
test('invalid tie-on, behind-bit target and unknown values fail rather than becoming zeroes',()=>{
 assert.throws(()=>planLanding(mdInput({tie:{...tie,n:null}})),/finite/);
 assert.throws(()=>planLanding(mdInput({target:{mode:'md',md:0,inc:90,azi:0}})),/ahead/);
 assert.throws(()=>planLanding(mdInput({target:{mode:'md',md:900,inc:90,azi:NaN}})),/azimuth/);
 assert.throws(()=>planLanding(mdInput({limits:{...limits,responseLow:1.2,responseHigh:.8}})),/low response/);
 const r=planLanding(mdInput({componentLimit:1}));assert.equal(r.recommendation,null);
});
test('gain one reproduces the nominal path; assumed lower gain under-builds without claiming measured prediction',()=>{
 const r=planLanding(mdInput()),c=r.candidates[0],one=responseSensitivity(c.path,1,r.target),low=responseSensitivity(c.path,.8,r.target);
 close(one.end.n,c.end.n,1e-4);close(one.end.tvd,c.end.tvd,1e-4);close(one.angleMiss,0,1e-4);close(low.end.inc,72,1e-4);assert.match(low.method,/not a calibrated/);
});
test('observed curvature is isolated to the entered BHA run and sparse/duplicate intervals are excluded',()=>{
 const surveys=[{md:0,inc:10,azi:0},{md:30,inc:12,azi:0},{md:60,inc:14,azi:0},{md:90,inc:16,azi:0},{md:120,inc:18,azi:0},{md:150,inc:20,azi:0},{md:150,inc:20,azi:0},{md:300,inc:30,azi:0}];
 const r=surveyResponse(surveys,{bhaId:'SIM BHA B',runStartMd:60});assert.equal(r.attributed,true);assert.equal(r.count,3);assert.ok(r.intervals.every(i=>i.fromMd>=60));close(r.medianBuild,2);assert.match(r.issues.join(' '),/Sparse/);assert.match(r.method,/Not motor yield/);
 assert.equal(surveyResponse(surveys,{bhaId:'B'}).attributed,false);assert.equal(surveyResponse(surveys).attributed,false);
});
test('recorded steering fit requires correct run IDs and measured exposure variation',()=>{
 const intervals=[0,.25,.5,.75,1].map((f,i)=>({fromMd:i*30,toMd:(i+1)*30,build:1+4*f,turn:2*f,dls:1+4*f,aziReliable:true}));
 const exposures=parseExposures('fromMd,toMd,bhaId,slidePercent\n'+intervals.map((x,i)=>`${x.fromMd},${x.toMd},SIM BHA,${i*25}`).join('\n'));
 const fit=fitSteeringResponse(intervals,exposures,'SIM BHA');assert.equal(fit.available,true);close(fit.build.rotate,1);close(fit.build.slide,5);close(fit.build.rmse,0);
 assert.equal(fitSteeringResponse(intervals,exposures,'OTHER BHA').available,false);
 assert.equal(fitSteeringResponse(intervals,exposures.map(x=>({...x,slidePercent:50})),'SIM BHA').available,false);
 assert.throws(()=>parseExposures('fromMd,toMd,bhaId,slidePercent\n0,40,BHA,50\n30,60,BHA,70'),/Overlapping/);
});
test('hard landing distinguishes no solution from a feasible path with less than ten percent DLS margin',()=>{
 const a=planLanding(mdInput({limits:{...limits,maxDls:3.2}}));assert.ok(a.recommendation);assert.equal(a.difficulty.hard,true);assert.match(a.difficulty.reason,/90%/);
 const b=planLanding(mdInput({limits:{...limits,maxDls:1}}));assert.equal(b.difficulty.hard,true);assert.match(b.difficulty.reason,/No evaluated/);
 assert.equal(planLanding(mdInput()).difficulty.hard,false);
});
test('recorded BHA comparisons and run-end limits do not attribute subsequent run observations to the old BHA',()=>{
 const s=Array.from({length:9},(_,i)=>({md:i*30,inc:i<=4?10+i*2:18+(i-4)*4,azi:0}));
 const exposures=parseExposures('fromMd,toMd,bhaId,slidePercent\n0,120,BHA-A,50\n120,240,BHA-B,75');
 const r=compareBhaRuns(s,exposures);assert.equal(r.length,2);close(r[0].medianBuild,2);close(r[1].medianBuild,4);assert.equal(r[0].count,4);assert.equal(r[1].count,4);
 const old=surveyResponse(s,{bhaId:'BHA-A',runStartMd:0,runEndMd:120});close(old.medianBuild,2);assert.equal(old.count,4);
});
