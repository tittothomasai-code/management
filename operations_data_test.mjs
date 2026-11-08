import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {drilledIntervals, feedJoints, feedSource, fixtureFeed, imageRows, jointProgress, readSamples, sourceStamp, surveyMatches} from './operations_data.js';

const env = {window:{}, localStorage:{getItem:()=>null}, document:{readyState:'loading',addEventListener(){}}};
runInNewContext(readFileSync(new URL('./units.js',import.meta.url),'utf8'),env);
const now = 1700000000000;
const w = {log:{w:'A',b:'B',indexType:'date time'},hist:[{t:now-2000}],connected:true,lastRowMs:now-2000,healthy:()=>true};
assert.equal(feedSource(null,now),'SIM');
assert.equal(feedSource({...w,log:null},now),'WITSML WAITING');
assert.equal(feedSource(w,now),'WITSML LIVE');
assert.equal(feedSource({...w,simulated:true},now),'WITSML SIM-TEST');
assert.equal(feedSource({...w,lastRowMs:now-180000},now),'WITSML STALE');
assert.equal(feedSource({...w,mode:'replay',rp:{}},now),'REPLAY');
assert.equal(feedSource({...w,hist:[]},now),'WITSML WAITING','header timestamp alone is not a source sample');
assert.equal(feedSource({...w,hist:[{t:NaN}]},now),'WITSML WAITING');
assert.equal(feedSource({...w,hist:[{t:now-180000}],lastRowMs:now},now),'WITSML STALE','source timestamp, not receipt time, controls freshness');
assert.equal(feedSource({...w,log:{...w.log,indexType:'measured depth'}},now),'WITSML TIME LOG REQUIRED');
const approved = {url:'https://australia.adagasolutions.com/WMLS', proxy:'https://tryfecta-witsml-proxy.netlify.app/witsml-proxy'};
const synthetic = {...w, simulated:false, log:{...w.log, name:'General Time-Based', nameWell:'SYNTHETIC WELL', nameWellbore:'SYNTHETIC WB'}};
assert.equal(feedSource(synthetic, now, approved), 'WITSML SIM-TEST', 'synthetic fixture on the approved proxy is not LIVE');
assert.equal(fixtureFeed({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', nameWellbore:'SYNTHETIC WB', name:'Time'}}, approved), true, 'wellbore identity counts, not only the well name');
assert.equal(feedSource({...w, simulated:false, supp:'SIM-TEST mock', log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, approved), 'WITSML SIM-TEST', 'store SuppMsgOut is provenance');
assert.equal(feedSource({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, {url:'https://customer.example/witsml', proxy:'https://logs.example/custom-proxy'}), 'WITSML LIVE', 'custom store with ordinary names can be LIVE');
assert.equal(feedSource({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, approved), 'WITSML LIVE', 'approved proxy plus a real well name can be LIVE');
assert.equal(feedSource({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, {url:'https://sim.example.com/witsml', proxy:approved.proxy}), 'WITSML LIVE', 'a sim hostname or the approved proxy is not itself a fixture');
assert.equal(feedSource({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, {url:'http://127.0.0.1:8952/witsml'}), 'WITSML SIM-TEST');
assert.equal(feedSource({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, {url:'https://customer.example/sim/witsml'}), 'WITSML SIM-TEST');
assert.equal(feedSource({...synthetic, lastRowMs:now-180000}, now, approved), 'WITSML STALE');
assert.notEqual(feedSource(synthetic, now, approved), 'WITSML LIVE');
const sample = now - 2000;
const boxWell = 'FIXTURE TEST WELL (NOT LIVE)';
const boxCfg = {url:'https://fixture.invalid/WMLS', proxy:'http://127.0.0.1:8952/witsml-proxy'};
const box = {...w, simulated:false, hist:[{t:sample}], lastRowMs:sample, log:{...w.log, name:'General Time-Based', nameWell:boxWell}};
assert.equal(box.log.nameWell, 'FIXTURE TEST WELL (NOT LIVE)');
assert.equal(feedSource(box, now, boxCfg), 'WITSML SIM-TEST', 'reported GUI fixture is not LIVE');
assert.notEqual(feedSource(box, now, boxCfg), 'WITSML LIVE');
assert.equal(sourceStamp(box, 'WITSML SIM-TEST', now), ' · last source row ' + new Date(sample).toISOString().replace(/\.\d{3}Z$/, 'Z') + ' (age 2 s)');
assert.equal(feedSource(box, now, {url:'https://customer.example/witsml', proxy:'https://logs.example/custom-proxy'}), 'WITSML SIM-TEST', 'the reported well name is enough without the loopback proxy');
assert.equal(feedSource({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, boxCfg), 'WITSML SIM-TEST', 'fixture.invalid is a reserved store, whatever the proxy is');
assert.equal(feedSource({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, {url:'https://australia.adagasolutions.com/WMLS', proxy:'http://127.0.0.1:8952/witsml-proxy'}), 'WITSML LIVE', 'a loopback proxy in front of a real store is not a fixture');
assert.equal(feedSource({...w, simulated:false, log:{...w.log, nameWell:'Highland 22', name:'Time'}}, now, {url:'https://fixture.example.com/WMLS', proxy:'https://logs.example/custom-proxy'}), 'WITSML LIVE', 'fixture in a normal hostname is not a reserved store');
const headerEnd = now - 1000;
assert.equal(sourceStamp({lastRowMs: headerEnd, hist: [], okAt: now}, 'WITSML WAITING', now), '', 'log header end is not a source row');
assert.equal(sourceStamp({lastRowMs: now, hist: [], okAt: now}, 'WITSML LIVE', now), '', 'client clock in lastRowMs is not a source row');
assert.equal(sourceStamp({lastRowMs: headerEnd, hist: [{t: headerEnd}], okAt: now}, 'WITSML TIME LOG REQUIRED', now), '');
assert.equal(sourceStamp({hist: [{t: headerEnd}]}, 'SIM', now), '');
const stamped = sourceStamp({lastRowMs: headerEnd, hist: [{t: headerEnd}], okAt: now, simulated: true}, 'WITSML SIM-TEST', now);
assert.equal(stamped, ' · last source row ' + new Date(headerEnd).toISOString().replace(/\.\d{3}Z$/, 'Z') + ' (age 1 s)');
assert.equal(stamped.includes('WITSML LIVE'), false);
const split = sourceStamp({lastRowMs: now, hist: [{t: now - 5000}], okAt: now}, 'WITSML STALE', now);
assert.match(split, /age 5 s/, 'age follows the parsed sample, not okAt or lastRowMs');
assert.match(split, new RegExp('index ' + new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z')));

const input = {
  ml:['TIME','CUSTOM_HD','BITDEP','RPM','MFIA','SPPA','WOB','CUSTOM_RET','AC_MIN_SF','MOTOR_STALL_ALARM','ECD','TGAS'],
  ul:['','','m','rpm','gpm','psi','kn','L/min','1','','ppg','unitless'],
  ix:0,
  rows:[
    {t:now-1000,x:['','1000','304.8','0','300','1500','-999.25','1130','1.5','0','11','1.2']},
    {t:now,x:['','1005','305.5','50','301','1550','41','1129','1.4','1','11','1.2']},
  ],
};
const log = {nullValue:'-999.25',curves:[{mn:'CUSTOM_HD',unit:'ft',nullValue:''}]};
const map = {CUSTOM_HD:'holedepth',CUSTOM_RET:'ops.out'};
const rows = readSamples(input,log,map,now-1,env.window.U);
assert.equal(rows.length,1,'replay excludes future rows');
assert.equal(rows[0].hd,304.8);
assert.equal(rows[0].bd,304.8);
assert.equal(rows[0].wob,null);
assert.equal(rows[0].gas,null,'unsupported units stay missing');
assert.equal(rows[0].flow,1135.6236);
assert.equal(rows[0].sf,1.5);
assert.equal(rows[0].stall,0);
assert.equal(rows[0].out,1130);
assert.ok(Math.abs(rows[0].ecd-1.3180904)<.000001);

const intervals = drilledIntervals([
  {t:0,hd:100,bd:100,rpm:0,flow:1000},
  {t:1,hd:102,bd:102,rpm:0,flow:1000},
  {t:2,hd:104,bd:104,rpm:60,flow:1000},
  {t:3,hd:105,bd:90,rpm:60,flow:1000},
  {t:130,hd:106,bd:106,rpm:60,flow:1000},
]);
assert.deepEqual(jointProgress({start:99,end:109},106,intervals).totals,
  {slide:2,rotary:2,unknown:3,remaining:3});
assert.equal(jointProgress({start:99,end:null},106,intervals).pct,null);
assert.deepEqual(feedJoints([{t:1,bd:100}]),[]);

const image = {well:'A',wb:'B',sim:false,img:{rows:[{md:100,v:[0,1]},{md:103,v:[1,2]}]}};
assert.equal(imageRows(w,image,99,101).length,1);
assert.deepEqual(imageRows(w,{...image,wb:'OTHER'},99,101),[]);
assert.deepEqual(imageRows({...w,simulated:true},image,99,101),[]);
const geo = {calc:[{},{}],surv:{live:true}};
assert.equal(surveyMatches({...w,sv:{cur:{wb:'B'}}},geo,'A'),true);
assert.equal(surveyMatches({...w,sv:{cur:{wb:'OTHER'}}},geo,'A'),false);
assert.equal(surveyMatches({...w,sv:{cur:{wb:'B',st:[{typ:'planned'}]}}},geo,'A'),false);
assert.equal(surveyMatches({...w,sv:{cur:{wb:'B'}}},geo,'OTHER'),false);
console.log('PASS operations adapter: WITSML states, units, replay, progress, wellbore guards');
