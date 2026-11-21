import {test} from 'node:test';import assert from 'node:assert/strict';
import {closestSegments,pathIntersectsRadius,normalizeModel,assessField,fieldReference} from '../drilling/edm_field_check_core.mjs';
const p=(E,N,Z=0,md=0)=>({E,N,Z,md}),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
function model(offsets=1){
 const W={name:'SIM field',crs:{zone:'UTM-55S',datum:'GDA2020',sys:'Mean Sea Level'},sites:[],wells:[{id:'ref',name:'DR101L',mapE:805279.56,mapN:7255911.81,E:0,N:0}],wbs:[{id:'r1',well:'ref',name:'SIM reference',status:'Planned',path:[p(0,0,0,0),p(0,0,100,100)],traj:[{stations:2}]}]};
 for(let i=0;i<offsets;i++){const x=10+i;W.wells.push({id:'o'+i,name:'SIM OFFSET '+i,mapE:805279.56+x,mapN:7255911.81,E:x,N:0});W.wbs.push({id:'b'+i,well:'o'+i,name:'SIM offset '+i,status:'Drilled',path:[p(x,0,0,0),p(x,0,100,100)],traj:[{stations:2}]});}return W;
}
test('segment geometry catches crossings between survey samples and degenerate/parallel cases',()=>{
 close(closestSegments(p(-10,0,0,0),p(10,0,0,20),p(0,-10,0,0),p(0,10,0,20)).distance,0);
 close(closestSegments(p(0,0),p(10,0),p(0,3),p(10,3)).distance,3);
 close(closestSegments(p(0,0),p(0,0),p(1,0),p(1,0)).distance,1);
 close(closestSegments(p(-10,0),p(10,0),p(0,-10,5),p(0,10,5)).distance,5);
});
test('10 km selection includes a trajectory crossing the area even when endpoints/wellhead lie outside',()=>{
 assert.equal(pathIntersectsRadius([p(-20000,0),p(20000,0)],{E:0,N:0},10000),true);
 assert.equal(pathIntersectsRadius([p(11000,0),p(12000,0)],{E:0,N:0},10000),false);
});
test('all eligible offsets are assessed without the original site-view 40-path cap',()=>{
 const r=assessField([model(45)]);assert.equal(r.assessedOffsetTrajectories,45);assert.equal(r.assessedPairs,45);assert.equal(r.status,'LOADED DATA SCREENED');assert.equal(r.sameWellExcluded,1);assert.ok(r.results.every(x=>Number.isFinite(x.closestApproachM)));
});
test('missing offsets never report clearance and decimation remains visible',()=>{
 const W=model(0);W.wbs[0].traj[0].stations=200;const r=assessField([W]);assert.equal(r.status,'INCOMPLETE');assert.equal(r.results.length,0);assert.match(r.limitations.join(' '),/not clearance/);assert.match(r.limitations.join(' '),/decimated/);
});
test('mixed datums and unknown vertical references are skipped explicitly',()=>{
 const A=model(0),B=model(1);B.wells=B.wells.slice(1);B.wbs=B.wbs.slice(1);B.crs.datum='GDA94';const r=assessField([A,B]);assert.equal(r.status,'INCOMPLETE');assert.equal(r.results.length,0);assert.match(r.skipped.map(x=>x.reason).join(' '),/datum/);
 const C=model(1);C.crs.sys=null;assert.equal(assessField([C]).results.length,0);
});
test('zero or absent coordinates do not silently place a well at the origin',()=>{
 const W=model(0);W.wells[0].mapE=0;W.wells[0].mapN=0;const n=normalizeModel(W);assert.equal(n.paths.length,0);assert.match(n.warnings[0].reason,/coordinates/);assert.equal(assessField([W]).center,null);
});
test('grid wellhead placement preserves explicit coordinates and native trajectory offsets',()=>{
 const n=normalizeModel(model(1));close(n.paths[0].points[0].E,805279.56);close(n.paths[1].points[0].E,805289.56);close(n.paths[0].points[1].Z,100);
});
test('the selected well is the reference even when the legacy default well is present',()=>{
 const W=model(2);W.savedId='sim-field';
 const reference=fieldReference(W,'o0');assert.equal(reference.wellName,'SIM OFFSET 0');
 const report=assessField([{id:W.savedId,W}],reference);
 assert.equal(report.well,'SIM OFFSET 0');assert.equal(report.referenceTrajectories.length,1);
 assert.equal(report.referenceTrajectories[0].name,'SIM offset 0');
 assert.equal(report.assessedOffsetTrajectories,2);assert.ok(report.results.some(r=>r.offsetWell==='DR101L'));
 assert.deepEqual(report.referenceScope,{sourceId:'sim-field',wellId:'o0'});
});
test('multiple wells require an explicit selection; one-well imports still open automatically',()=>{
 assert.throws(()=>fieldReference(model(1)),/Select the reference/);
 assert.throws(()=>fieldReference(model(1),'missing-id'),/Select the reference/);
 assert.equal(fieldReference(model(0)).wellName,'DR101L');
});
test('source identity prevents same-named imports from being joined into the reference',()=>{
 const W=model(1);W.savedId='sim-a';const other=model(0);other.wells[0].id='other-id';other.wbs[0].well='other-id';
 const report=assessField([{id:'sim-a',W},{id:'sim-b',W:other}],fieldReference(W,'ref'));
 assert.equal(report.referenceTrajectories.length,1);assert.equal(report.assessedPairs,1);
 assert.match(report.skipped.map(s=>s.reason).join(' '),/identity association is unverified/);
 assert.equal(assessField([{id:'sim-b',W:other}],fieldReference(W,'ref')).status,'INCOMPLETE');
 assert.throws(()=>assessField([W],{referenceSourceId:'sim-a'}),/Both source and well identity/);
});
