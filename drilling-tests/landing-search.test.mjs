import {test} from 'node:test';import assert from 'node:assert/strict';
import {planLanding,createLandingInspector} from '../drilling/opsnow_landing_core.mjs';
import {minCurve} from '../drilling/bha-builder/shared/wp-autotrack-core.js';
const input=()=>({scope:{well:'SIM SEARCH',wellbore:'SIM A'},tie:{md:0,n:0,e:0,tvd:0,inc:0,azi:15},target:{mode:'position',md:500,n:330*Math.cos(Math.PI/12),e:330*Math.sin(Math.PI/12),tvd:300,inc:90,azi:15},limits:{maxDls:12,positionTol:.05,angleTol:.1},joints:{mode:'nominal',nominalM:13,anchorMd:0},searchOptions:{budgetMs:10000}});
test('adaptive search evaluates and refines beyond its initial seeds and accounts for every outcome',()=>{
 const progress=[],r=planLanding(input(),{onProgress:p=>progress.push(p.candidate.id)}),s=r.search;
 assert.equal(s.status,'converged');assert.ok(s.evaluated>34);assert.equal(s.trace.length,s.evaluated);assert.equal(progress.length,s.evaluated);assert.equal(s.feasible+s.rejected+s.duplicates,s.evaluated);
 assert.ok(s.trace.some(x=>x.stage==='space exploration'));assert.ok(s.trace.some(x=>x.stage==='joint-tangent refinement'));assert.ok(s.bestHistory.length>1);
 const oldBest=Math.min(...s.trace.slice(0,10).filter(x=>x.feasible).map(x=>x.peakDls));const best=r.candidates.find(c=>c.id===r.recommendation);assert.ok(best.peakDls<oldBest-.01);assert.ok(r.candidates.length<s.evaluated);assert.match(s.domain,/not exhaustive/);
});
test('a budget pause preserves the frontier and complete ledger; continuation does not restart or claim convergence',()=>{
 const i=input();i.searchOptions.batchEvaluations=4;const first=planLanding(i);assert.equal(first.search.status,'budget-paused');assert.equal(first.search.converged,false);assert.equal(first.search.resumable,true);assert.equal(first.search.evaluated,4);
 const second=planLanding({...i,searchOptions:{budgetMs:10000}},{resume:first.search});assert.equal(second.search.status,'converged');assert.ok(second.search.evaluated>first.search.evaluated);assert.deepEqual(second.search.trace.slice(0,4),first.search.trace);assert.equal(new Set(second.search.trace.map(x=>x.id)).size,second.search.evaluated);
 assert.throws(()=>planLanding({...i,scope:{well:'OTHER'}},{resume:first.search}),/different inputs/);
});
test('every ledger entry reconstructs its own joint schedule or original rejection, including non-retained cases',()=>{
 const r=planLanding(input()),inspect=createLandingInspector(r.search.replay,r.search.trace);assert.ok(r.search.trace.length>r.candidates.length);
 for(const record of r.search.trace){const c=inspect(record.id);assert.equal(c.id,record.id);assert.equal(c.feasible,record.feasible);assert.deepEqual(c.issues,record.issues);if(!c.path.length)continue;assert.ok(Math.abs(c.peakDls-record.peakDls)<1e-8);let p={...r.tie};for(const row of c.jointSchedule.rows)p=minCurve(p,{md:row.endMd,inc:row.endInc,azi:row.endAzi});assert.ok(Math.hypot(p.n-c.end.n,p.e-c.end.e,p.tvd-c.end.tvd)<1e-6);}
});
test('a geometric proof is recorded as a proof, without fabricating unevaluated alternatives',()=>{
 const i=input();i.target.md=100;const r=planLanding(i);assert.equal(r.search.status,'bound-infeasible');assert.equal(r.search.evaluated,1);assert.equal(r.search.trace[0].recipe.type,'bound');assert.equal(r.recommendation,null);assert.equal(r.difficulty.hard,true);
});
