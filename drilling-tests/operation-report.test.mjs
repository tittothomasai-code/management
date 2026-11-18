import {test} from 'node:test';import assert from 'node:assert/strict';
import {END_OF_WELL_REPORT as R,reportedOperation,reportDepthIssue,drillingReferenceMd} from '../drilling/opsnow_operation_report.mjs';
const now=Date.parse('2026-11-18T12:00:00+10:00');
test('the operational report applies only to the named well and WB04B01',()=>{
 assert.equal(reportedOperation('DR101L','WB04B01',now),R);
 assert.equal(reportedOperation('DR0101L','DR0101L_WB04B01',now),R);
 for(const [w,b]of [['OTHER','WB04B01'],['DR101L','WB03'],['DR101L','WB04'],['DR101L',null],[null,'WB04B01']])assert.equal(reportedOperation(w,b,now),null);
});
test('later reports are not retroactively applied before their report date',()=>{
 assert.equal(reportedOperation('DR101L','WB04B01',Date.parse('2026-11-17T23:59:59+10:00')),null);
 assert.equal(reportedOperation('DR101L','WB04B01',Date.parse('2026-11-18T00:00:00+10:00')),R);
 assert.equal(R.tdAt,null);assert.equal(R.linerDepth,null);assert.equal(R.linerJoints,null);
});
test('the supplied summary reconciles KOP, final MD, lateral length and exit intervals',()=>{
 const close=(a,b)=>assert.ok(Math.abs(a-b)<.005);
 close(R.tdMd-R.kopMd,R.lateralLength);close(R.inSeamLength+R.faultedExitLength,R.lateralLength);
 close(R.faultedExits.reduce((n,x)=>n+x.toMd-x.fromMd,0),22);assert.equal(R.stratigraphicExitLength,0);
 assert.ok(Math.abs(R.inSeamLength/R.lateralLength*100-R.inSeamPercent)<.01);
});
test('off-bottom positions cannot renumber the historical TD inventory reference',()=>{
 assert.equal(drillingReferenceMd(R,900,2618.9),2618.9);
 assert.equal(drillingReferenceMd(R,null,2600),2618.9);
 assert.equal(drillingReferenceMd(null,900,2618.9),900);
 assert.equal(drillingReferenceMd(null,null,2618.9),2618.9);
});
test('a source depth beyond reported TD is flagged without changing either value',()=>{
 const input={holeMd:2700};assert.match(reportDepthIssue(R,input.holeMd),/exceeds reported TD/);
 assert.equal(input.holeMd,2700);assert.equal(R.tdMd,2618.9);
 assert.equal(reportDepthIssue(R,2618.9),null);assert.equal(reportDepthIssue(R,2500),null);assert.equal(reportDepthIssue(R,null),null);
 assert.equal(Object.isFrozen(R),true);assert.equal(Object.isFrozen(R.faultedExits[0]),true);
});
