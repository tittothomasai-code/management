import {feedSource} from './site/operations_data.js';
import {surveyIntervals,fallbackInterval} from './site/operations_joint_estimates.js';
import {segment} from './site/rtoc_core.js';
let failed=0;const ok=(c,m)=>{if(!c)failed++;console.log((c?'PASS ':'FAIL ')+m)};
const T=Date.now(),log={indexType:'date time'},mk=(t,extra={})=>({mode:'live',connected:true,liveMode:true,log,hist:[{t}],lastRowMs:T,healthy:()=>true,...extra});
let w=mk(T-5000);const cfg={url:'https://australia.example/WMLS'};
ok(feedSource(w,T,cfg)==='WITSML SNAPSHOT','first fresh = SNAPSHOT');
ok(feedSource(w,T+1000,cfg)==='WITSML SNAPSHOT','same row again (poll only) stays SNAPSHOT');
w.hist=[{t:T-5000},{t:T}];ok(feedSource(w,T+2000,cfg)==='WITSML LIVE','advanced source row = LIVE');
ok(feedSource(w,T+2000,{url:'https://other.example/WMLS'})==='WITSML SNAPSHOT','store switch resets to SNAPSHOT');
w.connected=false;ok(feedSource(w,T+3000,cfg)==='WITSML DISCONNECTED','disconnect not SIM/LIVE');
const w2=mk(T-1000);w2.hist=[{t:T-1000}];feedSource(w2,T,cfg);w2.hist=[{t:T-2000}];ok(feedSource(w2,T+100,cfg)==='WITSML SNAPSHOT','regressing source time resets, not LIVE');
const w3=mk(T+3600e3);feedSource(w3,T,cfg);w3.hist=[{t:T+7200e3}];const r3=feedSource(w3,T+500,cfg);ok(r3!=='WITSML LIVE','future-dated source rows not LIVE (got '+r3+')');
const st=(md,uom='m',wb='B',typ='')=>({nativeMd:md,uom,wb,typ});
ok(surveyIntervals([st(100),st(113)],'W','B','X').length===0,'wrong configured well -> none');
const s1=surveyIntervals([st(100),st(328.084,'ft'),st(130)],'W','B','W');
// The original boolean required length===2, which is the rejected shape
// (a near-zero conversion span plus 100→130). Collapsing 328.084 ft onto 100 m
// leaves one estimate, 100 m to 130 m, and no sub-millimetre span.
ok(s1.length===1&&Math.abs(s1[0].start-100)<1e-6&&Math.abs(s1[0].end-130)<1e-6&&s1.every(x=>x.estimated)&&s1.every(x=>Math.abs(x.end-x.start)>=1e-3),'ft conversion sane '+JSON.stringify(s1.map(x=>[x.start.toFixed(2),x.end.toFixed(2)])));
ok(!(s1.length===2&&Math.abs((s1[0]?.end??0)-100)<1e-3),'ft conversion does not emit the near-zero span');
const s2=surveyIntervals([st(100),st(90),st(103)],'W','B','W');ok(s2.length===0,'reversed breaks adjacency, no bridge 100->103: '+JSON.stringify(s2.map(x=>[x.start,x.end])));
const s3=surveyIntervals([st(100),st(113,'m','B','Planned'),st(126)],'W','B','W');ok(s3.length===0,'planned in middle breaks adjacency: '+JSON.stringify(s3.map(x=>[x.start,x.end])));
const s4=surveyIntervals([st(100),st(100.0001)],'W','B','W');ok(s4.every(x=>x.estimated),'tiny spans still estimates');
ok(fallbackInterval(NaN)===null&&fallbackInterval(-1)===null,'bad md no fallback');
const seg=segment([{t:0,md:100,slips:false},{t:10,md:105,slips:false},{t:20,md:200,slips:false,gapBefore:true},{t:30,md:205,slips:false}]);
ok(seg.length===2&&seg[0].endMd===105,'gapBefore splits segment, no bridge: '+JSON.stringify(seg.map(j=>[j.startMd,j.endMd,j.partial])));
if(failed){console.error(failed+' adversarial case(s) failed');process.exit(1)}
