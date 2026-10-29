// v4.10: survey-load failure reasons + fallback query strategies, against SIM-TEST mock failure modes. NO Adaga calls.
import puppeteer from 'puppeteer-core';
const BASE='http://localhost:8777',SH='shots_live/99_v410_',MOCK='http://127.0.0.1:8799',PROXY='http://localhost:8796/soap';
const ctl=q=>fetch(MOCK+'/ctl/'+q).then(r=>r.json());const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p=await b.newPage();const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));let IC='';
await p.setRequestInterception(true);p.on('request',async r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co/i.test(u)){ext.push(u);return r.abort()}
 if(IC&&u.startsWith(PROXY)&&/"wmlType":"trajectory"/.test(r.postData()||'')){if(IC=='504')return r.respond({status:504,contentType:'text/html',headers:{'Access-Control-Allow-Origin':'*'},body:'<html><body><h1>504 Gateway Timeout</h1>Task timed out after 10.00 seconds</body></html>'});if(IC=='slow'){await w(3000);try{return r.continue()}catch{return}}}r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
await ctl('fmt?f=plain');await ctl('fail401?on=0');
await p.evaluate((m,px)=>{const X=GX.witsml;X.CFG.proxy=px;X.CFG.url=m+'/witsml';X.setCred('simtest','dummy-not-a-secret');X.open()},MOCK,PROXY);
async function run(mode,ic='',tmo){await ctl('tfail?m='+mode);IC=ic;return p.evaluate(async t=>{const X=GX.witsml;X.CFG.callTimeoutMs=t||28000;X.CFG.svWell='DR101L';X.CFG.svWellbore='WB01B02';X.CFG.svTraj='';X.CFG.svTrajPick='';GEO.surv={src:'SIM',name:'',live:false,stations:[]};
 await X.svStart();X.svStop('test');const V=X.WML.sv;return {found:V.found,why:V.why||'',status:X.WML.status,n:GEO.surv.stations.length,uid:V.cur?.uid,steps:X.WML.svDiag.map(d=>d.step+(d.err?' ERR':'')),auth:!!X.WML.authDead,toast:document.getElementById('wtoast')?.textContent||''}},tmo)}
const R={};const show=(k,r)=>console.log('  ['+k+'] found='+r.found+' n='+r.n+(r.uid?' uid='+r.uid:'')+'\n    SCREEN: '+r.status);
let r=R.ok=await run('');show('baseline',r);ok(r.found&&r.n>10&&!r.why,'baseline: stations load, no failure reason');
r=await run('needwb');show('needwb',r);ok(r.found&&r.steps.some(s=>/^2 .*ERR/.test(s)),'server rejects uidWellbore="" (-415): step 2 fails, per-wellbore query loads survey');
r=await run('noidonly');show('noidonly',r);ok(r.found&&r.steps.some(s=>/^3b /.test(s)),'returnElements=id-only rejected (-427): header-fields query (3b) loads survey');
r=await run('fullonly');show('fullonly',r);ok(r.found&&r.steps.some(s=>/^F1 .*ERR/.test(s))&&r.steps.some(s=>/^F2 /.test(s)),'only full templates accepted (-409): F1 tried, F2 full empty-element template loads survey');
r=await run('nameonly');show('nameonly',r);ok(r.found&&r.steps.some(s=>/^F3 /.test(s)),'only name query accepted: F3 "Survey - Directional" loads survey');
r=await run('spaceuid');show('spaceuid',r);ok(r.found&&r.uid=='SIM TEST & TRAJ 1'&&r.n>10,'uid with spaces and & is XML-escaped in follow-up queries; stations load');
r=await run('unsupported');show('unsupported',r);await p.screenshot({path:SH+'1_unsupported.png'});
ok(!r.found&&/Result -413/.test(r.status)&&/SuppMsgOut "SIM-TEST mock: data object trajectory not supported"/.test(r.status)&&/HTTP 200/.test(r.status)&&/step "/.test(r.status),'trajectory unsupported: screen shows step, Result -413, SuppMsgOut, HTTP 200');
ok(r.steps.includes('F4 requestObjectSelectionCapability ERR')&&r.steps.some(s=>/F4b GetCap/.test(s)),'F4 requestObjectSelectionCapability + GetCap tried last');
r=await run('fault');show('fault',r);ok(!r.found&&!r.auth&&/SOAP fault: SIM-TEST: error -401/.test(r.status),'SOAP fault containing "-401" is shown and does NOT trip the 401 auth guard');
r=await run('http500');show('http500',r);ok(!r.found&&/HTTP 500/.test(r.status),'upstream HTTP 500 shown');
r=await run('','504');show('netlify504',r);await p.screenshot({path:SH+'2_netlify504.png'});ok(!r.found&&/HTTP 504/.test(r.status)&&/non-JSON/.test(r.status)&&/timeout/i.test(r.status),'Netlify 504 HTML page shown as HTTP 504 non-JSON / function timeout');
r=await run('','slow',1500);show('slow',r);ok(!r.found&&/no answer from proxy within 2 s/.test(r.status),'client timeout shown with seconds');IC='';
r=await run('fmtdouble');await ctl('fmt?f=double');r=await run('');show('double-escaped XMLout',r);ok(r.found&&r.n>10,'double-escaped XMLout still parses');await ctl('fmt?f=plain');
await ctl('fail401?on=1');const s0=(await ctl('stats')).afterFail;r=await run('');show('401',r);await w(2000);const s1=(await ctl('stats')).afterFail;await p.screenshot({path:SH+'3_auth401.png'});
ok(r.auth&&/Auth failed/.test(r.status)&&s1-s0==1,'401: auth latch, exactly one upstream call after the 401, no retry ('+(s1-s0)+')');
const r2=await p.evaluate(async()=>{await GX.witsml.svStart();return GX.witsml.WML.sv.state});const s2=(await ctl('stats')).afterFail;ok(s2==s1,'after 401 a new Find surveys makes no upstream call: '+r2);
await ctl('fail401?on=0');await ctl('tfail?m=');
ok(!ext.length,'no Adaga/Netlify calls: '+ext.length);ok(!errs.length,'no page errors '+errs.join('|').slice(0,200));
console.log('FAILURES',fails);await b.close();process.exit(fails?1:0);
