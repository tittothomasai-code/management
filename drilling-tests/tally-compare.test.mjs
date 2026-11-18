import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareDerivedTally,referenceScope,inventoryRows,comparisonCsv,inventoryPosition,inventoryResetLabel} from '../drilling/opsnow_tally_compare.mjs';
import {derivePipeChecks} from '../drilling/opsnow_joint_metrics.mjs';
const reference={unit:'m',startMd:822.53,bhaLen:48.53,joints:[{n:63,len:3.1},{n:64,len:9.26},{n:65,len:12.46}]};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} vs ${b}`);
test('BHA is counted once: carried string 774 plus BHA 48.53 anchors absolute MD 822.53',()=>{
 const r=compareDerivedTally([{startMd:822.53,endMd:834.89,derivedLength:12.36,issues:[]}],reference);
 close(r.carriedReference,774);close(r.bhaLen+r.carriedReference,r.startMd);close(r.rows[0].derivedEndMd,834.89);close(r.rows[0].measuredEndMd,834.89);
 assert.equal(r.rows[0].entries,'63–64');assert.equal(r.rows[0].status,'match');assert.equal(r.fullStart,true);
});
test('measured differences never overwrite independent BHE lengths; cumulative differences remain visible',()=>{
 const ref={unit:'m',startMd:100,bhaLen:20,joints:[{n:1,len:12.4},{n:2,len:12.4}]},before=JSON.stringify(ref);
 const r=compareDerivedTally([{startMd:100,endMd:112.4,derivedLength:13,issues:[]},{startMd:112.4,endMd:124.8,derivedLength:12.4,issues:[]}],ref);
 assert.equal(r.rows[0].derivedLength,13);close(r.rows[0].difference,.6);close(r.rows[1].cumulativeDifference,.6);assert.equal(r.rows[1].status,'review');assert.equal(JSON.stringify(ref),before);
});
test('missing cycles and incomplete evidence leave derived cumulative totals unavailable',()=>{
 const r=compareDerivedTally([{startMd:822.53,endMd:825.63,derivedLength:null,issues:['Incomplete BHE']},{startMd:825.63,endMd:834.89,derivedLength:9.26,issues:[]}],reference);
 assert.equal(r.rows[0].derivedLength,null);assert.equal(r.rows[1].derivedEndMd,null);assert.match(comparisonCsv(r),/Incomplete BHE/);
 const window=compareDerivedTally([{startMd:834.89,endMd:847.35,derivedLength:12.46,issues:[]}],reference);assert.equal(window.fullStart,false);close(window.windowStart,834.89);
});
test('scope is exact for this well and branch; invalid references and unaligned endpoints cannot pass',()=>{
 assert.equal(referenceScope('DR101L','WB04B01'),true);assert.equal(referenceScope('DR0101L','DR0101L_WB04B01'),true);
 for(const [w,b] of [['OTHER','WB04B01'],['DR101L','WB03B01'],['DR101L','WB04B010']])assert.equal(referenceScope(w,b),false);
 assert.equal(inventoryRows({...reference,bhaLen:900}).length,0);
 const r=compareDerivedTally([{startMd:825,endMd:837,derivedLength:12,issues:[]}],reference);assert.equal(r.rows[0].status,'review');assert.equal(r.rows[0].measuredLength,null);
});
test('the supplied inventory includes all 189 entries regardless of drilling-detail blanks',()=>{
 const ref=JSON.parse(readFileSync(new URL('../drilling/data/dr101l-wb04-measured-tally.json',import.meta.url),'utf8')),r=inventoryRows(ref);
 assert.equal(r.length,189);assert.equal(r[0].n,63);assert.equal(r.at(-1).n,251);close(r.at(-1).endMd,3156.54);assert.equal(ref.bhaLen,48.53);
 const at=r.find(j=>j.startMd<=2618.9&&j.endMd>=2618.9);assert.equal(at.n,208);close(at.endMd-2618.9,4.11);
});
test('the raw independent result survives the existing measured-tally discrepancy check',()=>{
 const r=derivePipeChecks({rows:[[100,13],[104,9],[108,5],[112.9,0]],map:{bh:{col:1,unit:'m',nullValue:''}},conns:[{md:100,blockTop:13,blockBottom:0},{md:113,blockTop:13,blockBottom:0}],tally:{bhaLen:100,joints:[{n:1,len:12,cumDepth:112}]}})[0];
 assert.equal(r.estimatedLength,null);assert.equal(r.derivedLength,13);
});
test('screenshot MD maps to entry 208, not estimated 223; BHA is not added twice',()=>{
 const ref=JSON.parse(readFileSync(new URL('../drilling/data/dr101l-wb04-measured-tally.json',import.meta.url),'utf8'));
 const p=inventoryPosition(ref,2618.9);assert.equal(p.n,208);close(p.startMd,2610.62);close(p.endMd,2623.01);close(p.len,12.39);close(p.advance,8.28);close(p.remaining,4.11);
 const other=inventoryRows(ref).find(j=>j.n===223);close(other.startMd,2796.74);close(other.endMd,2809.08);
 assert.equal(inventoryPosition(ref,null),null);assert.equal(inventoryPosition(ref,700),null);
});
test('BHE resets get measured joint labels only when the MD start aligns',()=>{
 const ref=JSON.parse(readFileSync(new URL('../drilling/data/dr101l-wb04-measured-tally.json',import.meta.url),'utf8'));
 assert.equal(inventoryResetLabel(ref,2609.2),'BHE');assert.equal(inventoryResetLabel(ref,2610.62),'J208 (MD)');
});
