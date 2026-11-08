import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {minCurvStations} from './geo.js?v=fp-ops-r2-20261108';
import {synth} from './conn.js?v=fp-ops-r2-20261108';
import {actualSurveyStations, drilledIntervals, feedConnectionIntervals, feedJoints, feedSource, fixtureFeed, imageRows, jointProgress, readSamples, sourceStamp, surveyDepthIntervals, surveyDoglegs, surveyHoleContext, surveyMatches} from './operations_data.js';

const env = {window:{}, localStorage:{getItem:()=>null}, document:{readyState:'loading',addEventListener(){}}};
runInNewContext(readFileSync(new URL('./units.js',import.meta.url),'utf8'),env);
const now = 1700000000000;
const initial = now - 2000;
const w = {
  mode:'off', connected:true, log:{w:'A',b:'B',uid:'T',indexType:'date time'},
  hist:[{t:now-5000},{t:initial}],lastRowMs:initial,healthy:()=>true,
};
const store = {url:'https://example.com/witsml'};
const observation = {};
const status = (feed = w, clock = now, config = store) => feedSource(feed,clock,config,observation);
assert.equal(status(null),'WITSML DISCONNECTED');
assert.equal(status({...w,log:null}),'WITSML WAITING');
assert.equal(status(),'WITSML WAITING FOR ADVANCE','a history batch is not evidence of an advancing feed');
assert.equal(status(),'WITSML WAITING FOR ADVANCE','duplicate polls cannot enable LIVE');
w.hist.push({t:now-1000});
w.lastRowMs = now-1000;
assert.equal(status(),'WITSML LIVE');
assert.equal(status(w,w.lastRowMs+119999),'WITSML LIVE');
assert.equal(status(w,w.lastRowMs+120000),'WITSML STALE','strict age cutoff');
assert.equal(status(),'WITSML WAITING FOR ADVANCE');
assert.equal(status(w,now,{url:'https://example.org/witsml'}),'WITSML WAITING FOR ADVANCE');
assert.equal(status({...w,log:{...w.log,uid:'new'}}),'WITSML WAITING FOR ADVANCE');
assert.equal(status({...w,hist:[{t:now-1000}]}),'WITSML WAITING FOR ADVANCE');
assert.equal(status({...w,lastRowMs:now}),'WITSML WAITING','receipt time cannot be the source index');
assert.equal(status({...w,hist:[{t:now+1000}],lastRowMs:now+1000}),'WITSML WAITING');
assert.equal(status({...w,hist:[{t:now-180000}],lastRowMs:now-180000}),'WITSML STALE');
assert.equal(status({...w,hist:[{t:NaN}]}),'WITSML WAITING');
assert.equal(status({...w,hist:[]}),'WITSML WAITING','a log header is not a source row');
assert.equal(status({...w,log:{...w.log,indexType:'measured depth'}}),'WITSML TIME LOG REQUIRED');
assert.equal(status({...w,mode:'replay'}),'WITSML REPLAY');
assert.equal(status({...w,authDead:true}),'WITSML DISCONNECTED');
assert.equal(status({...w,transportDead:true}),'WITSML DISCONNECTED');
assert.equal(status({...w,simulated:true}),'WITSML TEST FEED');
assert.equal(status({...w,supp:'SIM-TEST'}),'WITSML TEST FEED');
assert.equal(status({...w,log:{...w.log,nameWell:'SYNTHETIC WELL'}}),'WITSML TEST FEED');
assert.equal(status({...w,log:{...w.log,nameWellbore:'FIXTURE WB'}}),'WITSML TEST FEED');
assert.equal(status(w,now,{url:'http://127.0.0.1:8952/witsml'}),'WITSML TEST FEED');
assert.equal(status(w,now,{url:'https://example.org/sim/witsml'}),'WITSML TEST FEED');
assert.equal(fixtureFeed(w,{url:'https://fixture.invalid/witsml'}),true);
assert.equal(fixtureFeed(w,{...store,proxy:'http://127.0.0.1:8952/witsml-proxy'}),false);
assert.equal(sourceStamp({lastRowMs:now,hist:[]},'WITSML LIVE',now),'');
assert.match(sourceStamp(w,'WITSML LIVE',now), /age 1 s/);
assert.equal(status(),'WITSML WAITING FOR ADVANCE');
w.hist.push({t:now-500}); w.lastRowMs=now-500;
assert.equal(status(),'WITSML LIVE');
w.hist.push({t:now-800}); w.lastRowMs=now-800;
assert.equal(status(),'WITSML WAITING FOR ADVANCE','backwards source time resets the observation');

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
assert.deepEqual(feedJoints([{t:1,bd:100},{t:2,hd:127,slips:1}]),{joints:[],active:undefined});
const jointInput = {
  ml:['TIME','DMEA','JOINT_START_MD','JOINT_END_MD','JOINT_NUMBER','AC_CTC','AC_OFFSET_N','AC_OFFSET_E','PVT','TGAS','TF','STICKSLIP_ALARM','PACKOFF_ALARM'],
  ul:['','m','ft','ft','','m','m','m','bbl','%','rad','',''],
  ix:0, rows:[{t:now,x:['','311','1000',String(1000+13/.3048),'85','27','10','-5','10','1.2',String(Math.PI/2),'1','0']}],
};
const parsed = readSamples(jointInput,{}, {DMEA:'holedepth'},Infinity,env.window.U);
const tally = feedJoints(parsed);
assert.equal(tally.active.number,85);
assert.ok(Math.abs(tally.active.end-tally.active.start-13)<1e-9);
assert.equal(parsed[0].ctc,27);
assert.equal(parsed[0].north,10);
assert.equal(parsed[0].east,-5);
assert.ok(Math.abs(parsed[0].pit-1.589873)<1e-9);
assert.equal(parsed[0].gas,1.2);
assert.equal(parsed[0].tf,90);
assert.equal(parsed[0].stick,1);
assert.equal(parsed[0].pack,0);
assert.equal(feedJoints([...parsed,{hd:312}]).active,undefined,'blank current boundaries are not carried forward');
assert.equal(feedJoints([{hd:340,jointStart:300,jointEnd:313}]).active,undefined,'out-of-joint depth cannot be assigned to the current joint');
assert.equal(feedJoints([{hd:300,jointStart:310,jointEnd:300}]).joints.length,0);
assert.deepEqual(feedJoints([{hd:304,jointStart:300,jointEnd:313}]).active,{start:300,end:313,number:undefined},'no generated joint number');


const image = {well:'A',wb:'B',sim:false,img:{rows:[{md:100,v:[0,1]},{md:103,v:[1,2]}]}};
assert.equal(imageRows(w,image,99,101).length,1);
assert.deepEqual(imageRows(w,{...image,wb:'OTHER'},99,101),[]);
assert.deepEqual(imageRows({...w,simulated:true},image,99,101),[]);
const geo = {calc:[{},{}],surv:{live:true}};
assert.equal(surveyMatches({...w,sv:{cur:{wb:'B'}}},geo,'A'),true);
assert.equal(surveyMatches({...w,sv:{cur:{wb:'OTHER'}}},geo,'A'),false);
assert.equal(surveyMatches({...w,sv:{cur:{wb:'B',st:[{typ:'planned'}]}}},geo,'A'),false);
assert.equal(surveyMatches({...w,sv:{cur:{wb:'B'}}},geo,'OTHER'),false);
const station = (m, overrides = {}) => ({md:m/.3048,wb:'B',traj:'actual',datum:'KB',typ:'survey',...overrides});
const scoped = stations => actualSurveyStations(stations,'B','actual');
const survey = surveyDepthIntervals(scoped([
  station(127), station(100), station(114), station(127),
  station(135,{typ:'planned'}), station(112,{virtual:true}),
  station(115,{wb:'sidetrack'}), station(119,{traj:'other'}),
  station(145,{datum:'other-datum'}),
]));
assert.deepEqual(survey.map(i => Math.round(i.length)),[14,13]);
assert.deepEqual(survey.map(i => Math.round(i.start)),[100,114]);
assert.deepEqual(surveyDepthIntervals(scoped([station(100),station(114,{datum:'GL'})])),[]);
assert.deepEqual(actualSurveyStations([station(100),station(114)],'sidetrack','actual'),[]);
const bySource = {
  ml:['TIME','MD','BITDEP','GAMMA_MD','SURVEY_MD'], ul:['','m','m','m','m'], ix:0,
  rows:[{t:now,x:['','999','297','284','292']}],
};
assert.deepEqual(readSamples(bySource,{}, {MD:'md'},Infinity,env.window.U),[{t:now/1000,bd:297}],
  'generic, survey and gamma MD cannot stand in for hole depth');
assert.equal(readSamples(bySource,{}, {MD:'holedepth'},Infinity,env.window.U)[0].hd,999);
assert.equal(readSamples(bySource,{}, {GAMMA_MD:'holedepth',SURVEY_MD:'holedepth',BITDEP:'holedepth'},
  Infinity,env.window.U)[0].hd,undefined);

const connectionFixture = synth({joints:3,start_m:242,len:28,rop_mh:60,withSlips:true});
const calculated = feedConnectionIntervals(connectionFixture.rows);
assert.deepEqual(calculated,[{start:270,end:298,length:28},{start:298,end:326,length:28}]);
const firstResume = connectionFixture.truth[0].tSlipsOut;
assert.deepEqual(feedConnectionIntervals(connectionFixture.rows.map(r =>
  r.t >= firstResume && r.t <= firstResume + 20 ? {...r,slips:null} : r)),
  [{start:298,end:326,length:28}],'missing slips breaks the first interval');
assert.deepEqual(feedConnectionIntervals(connectionFixture.rows.map(r=>({...r,hd:null}))),[]);
assert.deepEqual(feedConnectionIntervals(connectionFixture.rows.map(r=>({...r,slips:null}))),[]);

const timestamp = new Date(20000).toISOString();
const logged = [{t:0,hd:300,bd:300},{t:10,hd:300,bd:298.7},{t:30,hd:300,bd:298.7}];
assert.deepEqual(surveyHoleContext(logged,timestamp),{holeMd:300,pickup:300-298.7});
assert.deepEqual(surveyHoleContext(logged.slice(1),timestamp),{holeMd:300,pickup:null});
assert.equal(surveyHoleContext(logged.slice(0,-1),timestamp),null);
assert.equal(surveyHoleContext([...logged.slice(0,-1),{t:30,hd:301,bd:299}],timestamp),null);
assert.equal(surveyHoleContext(logged,''),null);
const doglegStations = [station(300,{inc:0,azi:0}),station(330,{inc:3,azi:0}),
  station(360,{inc:3,azi:0})];
const doglegs = surveyDoglegs(minCurvStations(doglegStations));
assert.equal(doglegs.length,2,'virtual wellhead is excluded');
assert.equal(doglegs[0].start,300);
assert.ok(Math.abs(doglegs[0].end-330)<1e-9);
assert.ok(Math.abs(doglegs[0].dls-3)<1e-9);
assert.ok(doglegs[1].dls<1e-5,'straight interval has zero DLS');
assert.deepEqual(surveyDoglegs(minCurvStations([doglegStations[0],{...doglegStations[1],datum:'GL'}])),[]);
console.log('PASS operations adapter: WITSML states, units, replay, progress, wellbore guards');
