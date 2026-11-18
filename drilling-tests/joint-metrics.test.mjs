import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectionRows,jointMetrics} from '../drilling/opsnow_joint_metrics.mjs';
const summary={median:12.3,list:Array(7).fill({length:12.3}),current:{start:100,drilled:4}};
test('MD spacing never silently replaces the project nominal joint length',()=>{
 const r=jointMetrics({summary,rows:[[100,12.9],[104,8.9]],blockChannel:{col:1,unit:'m'}});
 assert.equal(r.length,13);assert.equal(r.basis,'nominal');assert.equal(r.spacing,12.3);assert.ok(Math.abs(r.travel-4)<1e-9);assert.equal(r.drilled,4);
});
test('actual loaded tally length is preferred for a known current tally joint',()=>{
 const r=jointMetrics({summary,rows:[],tally:{joints:[{n:7,len:13.4}]},jointNumber:{n:7,kind:'tally'}});assert.equal(r.length,13.4);assert.equal(r.basis,'tally');
});
test('negative BHE offsets change position, not observed stroke or pipe length',()=>{
 const r=jointMetrics({summary,rows:[[100,-.1],[104,12.9]],blockChannel:{col:1,unit:'m'}});assert.equal(r.travel,13);assert.equal(r.length,13);
});
test('feet are converted before block-jump detection and stroke comparison',()=>{
 const r=connectionRows([[100,0],[100.1,10]],{bh:{col:1,unit:'ft',nullValue:''}});assert.equal(r.rows[1][1],3.048);assert.equal(r.map.bh.unit,'m');
 const m=jointMetrics({summary,rows:[[100,0],[104,10]],blockChannel:{col:1,unit:'ft'}});assert.equal(m.travel,3.048);assert.equal(connectionRows([],{}),null);
});
test('missing/sentinel readings do not become stroke measurements; missed connections are flagged',()=>{
 const r=jointMetrics({summary:{...summary,current:{start:100,drilled:27}},rows:[[100,-999.25],[104,12]],blockChannel:{col:1,unit:'m'}});assert.equal(r.travel,null);assert.equal(r.overdue,true);assert.equal(r.drilled,27);
});
