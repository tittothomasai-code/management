import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pumpActivity, pumpSample, driveChannel, driveSample, topDriveActivity, refreshDepthTail} from '../drilling/opsnow_pumps.mjs';
const now = Date.parse('2026-11-17T02:00:00Z');
const sample = extra => ({value: 600, unit: 'gpm', at: now - 1000, previousAt: now - 11000, indexType: 'time', source: 'SIM time log', ...extra});
const state = s => pumpActivity({signed: true, now, sample: s});
test('fresh, advancing flow gives aggregate ON or OFF without a unit-specific threshold', () => {
  assert.equal(state(sample()).state, 'on');assert.equal(state(sample({value: 0})).state, 'off');
  assert.equal(state(sample({value: 1, unit: 'L/s'})).state, 'on');
});
test('stale flow is UNKNOWN at the two-minute boundary, even when its last value was zero', () => {
  assert.equal(state(sample({at: now - 119999, previousAt: now - 130000})).state, 'on');
  assert.equal(state(sample({at: now - 120000, previousAt: now - 130000})).state, 'unknown');
  assert.equal(state(sample({value: 0, at: now - 120000, previousAt: now - 130000})).state, 'unknown');
});
test('depth-log flow is displayed as reported; blanks cannot claim a pump state', () => {
  for (const value of [0, 600]) {const r=state(sample({value,indexType:'depth'}));assert.equal(r.state,value?'on':'off');assert.equal(r.reported,true);}
  assert.equal(state(sample({blankLatest: true})).state, 'unknown');
});
test('missing, invalid, future and nonadvancing samples stay UNKNOWN; signed-out state is quiet', () => {
  for (const s of [null, sample({value: NaN}), sample({value: -1}), sample({at: now + 1000}), sample({previousAt: now}), sample({previousAt: undefined})]) assert.equal(state(s).state, 'unknown');
  assert.equal(pumpActivity({signed: false, now, sample: sample()}).state, 'unknown');
});
test('sample extraction retains source time, reported units and blank-latest provenance', () => {
  const s = pumpSample({rows: [[now - 10000, 600], [now, '']], channel: {unit: 'gpm'}, latest: {v: 600, at: now - 10000, blankLatest: true}, time: true, source: 'SIM secondary log'});
  assert.equal(s.value, 600);assert.equal(s.unit, 'gpm');assert.equal(s.blankLatest, true);
  assert.equal(state(s).state, 'unknown');
  assert.equal(pumpSample({rows: [], channel: null, latest: null}), null);
});
const height = extra => ({value:12.8,unitKnown:true,indexType:'time',at:now-1000,previousAt:now-11000,previousValue:8,min:8,max:20,kind:'block',...extra});
test('top-drive marker follows observed height and indicates rising, lowering and holding',()=>{
  const up=topDriveActivity({signed:true,now,sample:height()});assert.equal(up.direction,'Rising');assert.ok(Math.abs(up.ratio-.4)<1e-9);assert.equal(up.note,'Block-height proxy');
  assert.equal(topDriveActivity({signed:true,now,sample:height({previousValue:18})}).direction,'Lowering');
  assert.equal(topDriveActivity({signed:true,now,sample:height({previousValue:12.8})}).direction,'Holding');
});
test('position hides the marker for stale, missing, future or unscaled readings',()=>{
  for(const s of [null,height({at:now-120000}),height({blankLatest:true}),height({at:now+1}),height({unitKnown:false})])assert.equal(topDriveActivity({signed:true,now,sample:s}).ratio,null);
  const fixed=topDriveActivity({signed:true,now,sample:height({min:12.8,max:12.8})});assert.equal(fixed.state,'current');assert.equal(fixed.ratio,null);
});
test('direct top-drive channels take priority over block height; metres and feet retain physical scale',()=>{
  const ch=driveChannel({ml:['TIME','BPOS','TD_HEIGHT'],ul:['s','m','ft'],blockChannel:{col:1,unit:'m'}});assert.equal(ch.col,2);assert.equal(ch.kind,'direct');
  const s=driveSample({rows:[[now-11000,10,20],[now-1000,15,42]],channel:ch,latest:{v:42,at:now-1000},time:true,source:'SIM time log'});
  assert.ok(Math.abs(s.value-12.8016)<1e-9);assert.equal(s.unit,'m');assert.equal(s.kind,'direct');
  assert.equal(driveChannel({ml:['TIME','BPOS'],ul:['s','m'],blockChannel:{col:1,unit:'m'}}).kind,'block');
  assert.equal(driveChannel({ml:['TIME','DBTM'],ul:['s','m']}),null);
  assert.equal(driveChannel({ml:['TIME','TDH'],ul:['s','m'],header:{nullValue:'-999',curves:[{mn:'TDH',nullValue:''}]}}).nullValue,'-999');
});
test('height range excludes missing/null sentinel readings and does not infer mast dimensions',()=>{
  const s=driveSample({rows:[[now-21000,-999.25],[now-11000,8],[now-1000,12.8]],channel:{col:1,unit:'m',nullValue:'-999.25',kind:'block'},latest:{v:12.8,at:now-1000},time:true});assert.equal(s.min,8);assert.equal(s.max,12.8);
  const unknownUnits=driveSample({rows:[[now-1000,12.8]],channel:{col:1,unit:'',kind:'block'},latest:{v:12.8,at:now-1000},time:true});assert.equal(unknownUnits.unitKnown,false);assert.equal(unknownUnits.value,null);
});

test('BHE negative reading remains available in the depth log',()=>{const r=topDriveActivity({signed:true,now,sample:height({value:-.1,min:-.1,max:15,indexType:'depth'})});assert.equal(r.state,'reported');assert.equal(r.ratio,0);});
test('SPP fallback is explicitly inferred and never fabricates a numeric flow rate',()=>{
 const r=pumpActivity({signed:true,now,sample:null,pressureSample:sample({value:1372,unit:'psi',indexType:'depth'})});assert.equal(r.state,'on');assert.equal(r.basis,'spp');assert.equal(r.inferred,true);assert.equal(r.sample.unit,'psi');
 assert.equal(pumpActivity({signed:true,now,sample:sample({value:0}),pressureSample:sample({value:1372})}).basis,'flow');
 assert.equal(pumpActivity({signed:true,now,pressureSample:sample({at:now-120000})}).state,'unknown');
});
test('tail updates at the same MD refresh Flow/SPP/BHE without inventing drilled depth',()=>{
 const store={ml:['MD','Flow','SPP','BHE'],rows:[[100,959,1372,12],[113,959,1372,-.1]]};
 assert.equal(refreshDepthTail(store,{ml:store.ml,rows:[[113,0,0,8]]}),true);assert.equal(store.rows.length,2);assert.deepEqual(store.rows.at(-1),[113,0,0,8]);
 assert.equal(refreshDepthTail(store,{ml:store.ml,rows:[[113,0,0,8]]}),false);
});
