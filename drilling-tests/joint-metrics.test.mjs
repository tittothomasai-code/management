import {test} from 'node:test';
import assert from 'node:assert/strict';
import {connectionRows,jointMetrics,reconcileDepths,derivePipeChecks,applyPipeChecks,depthMetres} from '../drilling/opsnow_joint_metrics.mjs';
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
const cycle=()=>({rows:[[100,13],[104,9],[108,5],[112.9,0]],map:{bh:{col:1,unit:'m',nullValue:''}},conns:[{md:100,blockTop:13,blockBottom:0},{md:113,blockTop:13,blockBottom:0}]});
test('a complete BHE stroke derives pipe length when downward movement agrees with MD gain',()=>{
 const r=derivePipeChecks(cycle())[0];assert.equal(r.estimatedLength,13);assert.equal(r.mdAdvance,13);assert.equal(r.status,'derived estimate');assert.equal(r.bitBasis,'not reported');
});
test('disagreement, pickup, missing data, off-bottom bit and multiple-joint gaps cannot become trusted lengths',()=>{
 const variants=[
  x=>{x.conns[1].md=112.3;},
  x=>{x.rows[2][1]=11;},
  x=>{x.rows=x.rows.slice(0,2);},
  x=>{x.rows.forEach(r=>r.push(r[0]-2));x.map.bd={col:2,unit:'m',nullValue:''};},
  x=>{x.conns[1].md=126;x.rows.push([125.9,-13]);x.conns[1].blockBottom=-13;},
  x=>{x.rows.forEach(r=>r[1]=-999.25);},
 ];
 for(const change of variants){const x=cycle();change(x);const r=derivePipeChecks(x)[0];assert.equal(r.estimatedLength,null);assert.equal(r.status,'review');assert.ok(r.issues.length);}
});
test('matching a BHA offset does not overwrite measured tally values; length/end mismatches are visible',()=>{
 const x=cycle();x.tally={bhaLen:100,joints:[{n:1,len:13,cumDepth:113}]};const before=JSON.stringify(x.tally);
 assert.equal(derivePipeChecks(x)[0].status,'tally match');assert.equal(JSON.stringify(x.tally),before);
 x.tally.joints[0]={n:1,len:12,cumDepth:112};const r=derivePipeChecks(x)[0];assert.equal(r.joint,1);assert.equal(r.estimatedLength,null);assert.match(r.issues.join(' '),/Tally length/);assert.match(r.issues.join(' '),/cumulative depth/);
});
test('BHE datum offsets and feet units preserve derived stroke length',()=>{
 const x=cycle();x.rows.forEach(r=>{r[1]=(r[1]-.1)/.3048;});x.map.bh.unit='ft';x.conns.forEach(c=>{c.blockTop-=.1;c.blockBottom-=.1;});assert.equal(derivePipeChecks(x)[0].estimatedLength,13);
 assert.equal(depthMetres(100,{unit:'ft'}),30.48);assert.equal(depthMetres(100,{unit:'unknown'}),null);
});
test('a missing or contradictory bit never silently inherits hole depth',()=>{
 assert.equal(reconcileDepths({holeMd:100,bit:{kind:'missing'}}).bitMd,null);
 assert.equal(reconcileDepths({holeMd:100,bit:{v:100,kind:'reported',clamped:true,was:105}}).bitMd,null);
 assert.equal(reconcileDepths({holeMd:100,bit:{v:105,kind:'reported'}}).bitMd,null);
 assert.equal(reconcileDepths({holeMd:100,bit:{v:80,kind:'reported'}}).bitMd,80);
 assert.equal(reconcileDepths({holeMd:100,bit:{v:100,kind:'derived'}}).basis,'derived');
});
test('only completed derived rows take BHE estimates; current, edited and imported rows stay intact',()=>{
 const base={start:100,hd:113,len:12.9,source:'derived',overridden:false,current:false};
 const runs=[{joints:[base,{...base,n:2,current:true},{...base,n:3,overridden:true,source:'tally',len:13.2}]}],before=JSON.stringify(runs);
 const next=applyPipeChecks(runs,derivePipeChecks(cycle()));
 assert.equal(next[0].joints[0].len,13);assert.equal(next[0].joints[0].source,'bhe-derived');assert.equal(next[0].joints[1].len,12.9);assert.equal(next[0].joints[2].len,13.2);assert.equal(JSON.stringify(runs),before);
});
test('legacy depth-derived intervals are never called an actual tally length',()=>{
 const args={summary,rows:[],tally:{joints:[{n:7,len:12.3,source:'derived'}]},jointNumber:{n:7,kind:'tally'}};
 assert.equal(jointMetrics(args).basis,'nominal');assert.equal(jointMetrics(args).length,13);
 args.tally.joints[0].source='bhe-derived';assert.equal(jointMetrics(args).basis,'derived');assert.equal(jointMetrics(args).length,12.3);
});
