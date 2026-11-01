// v5.12.19 whole-well WITSML discovery test (local SIM-TEST fixture only): 2 wellbores, multiple time + depth logs, trajectory, mudLog, real-time log.
// Covers discovery counts, default live branch, depth/time toggle with mapped channels, "no mapping" message, Settings guide link on a phone.
// node wall_test.mjs [base]   shots -> $SHOTS (default ../witsml-all-shots/test_)
import puppeteer from 'puppeteer-core';import * as K from './wdash_core.js';import * as F from './fixtures/witsml_multi.mjs';
const BASE=(process.argv[2]||'http://127.0.0.1:18793').replace(/\/$/,''),SH=process.env.SHOTS||'../witsml-all-shots/test_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
// ---- unit: core ----
{const rt={obj:'log',time:true,name:'Realtime Time Log',uid:'RT1',end:'2026-11-01T03:00:00Z',rows:[[1]]},gt={obj:'log',time:true,name:'General Time',uid:'G',end:'2026-11-01T05:00:00Z',rows:[[1]]},dl={obj:'log',time:false,name:'MWD',uid:'M',end:'1290',rows:[[1]]};
 for(const s of [rt,gt,dl])s.kind=K.classify(s);ok(rt.kind=='realtime'&&gt.kind=='time'&&dl.kind=='depth','unit: classify realtime/time/depth');
 ok(K.classify({obj:'log',name:'FE Wireline'})=='fe'&&K.classify({obj:'log',name:'Mud Log Gas'})=='mudlog'&&K.classify({obj:'trajectory'})=='survey','unit: classify FE, mud log, survey');
 ok(K.pickLive([dl,gt,rt])===rt,'unit: live branch preferred over a later-ending time log');ok(K.pickLive([dl,gt])===gt,'unit: no realtime -> latest time log');
 const T={ml:['TIME','DBTM','ROPA'],rows:[[0,100,10],[10,105,11],[20,104,12],[30,110,13]]};const M=K.depthMap(T);ok(M&&M.mn=='DBTM'&&M.pts.length==3,'unit: depth map from bit depth (running max)');
 ok(Math.abs(K.t2d(M,5)-102.5)<1e-9&&Math.abs(K.d2t(M,107.5)-20)<1e-9,'unit: time->depth and depth->time interpolation');
 const D={ml:['DEPT','GR'],ul:['m','gAPI'],rows:[[100,50],[105,60],[110,70]],time:false,uid:'D'};T.time=true;T.uid='T';T.ul=['ms','m','m/h'];
 const cd=K.combine([T,D],'depth',M,T),ct=K.combine([T,D],'time',M,T);ok(cd.ml.includes('ROPA')&&cd.ml.includes('GR')&&cd.src.ROPA.how=='mapped'&&cd.src.GR.how=='native','unit: depth view has native GR + mapped ROPA');
 ok(ct.ml.includes('GR')&&ct.src.GR.how=='mapped'&&ct.rows.length==4,'unit: time view has mapped GR on the live time grid');
 const cn=K.combine([T,D],'depth',null,T);ok(cn.ml.includes('GR')&&!cn.ml.includes('ROPA')&&cn.missing.length==1,'unit: no mapping -> time log listed as not available in depth view')}
// ---- browser ----
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[];
async function pg(url,vp){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(u.startsWith('https://mock-proxy.invalid/'))return r.method()=='OPTIONS'?r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}}):r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(F.answer(JSON.parse(r.postData()||'{}')))});
  if(/adaga|witsml-proxy|supabase\.co|:8796/.test(u)&&!/\.js(\?|$)/.test(u))return r.abort();r.continue()});await p.goto(url,{waitUntil:'load',timeout:120000});return p}
const PH={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},LT={width:1440,height:900};
for(const [nm,vp] of [['phone',PH],['laptop',LT]]){
 const p=await pg(BASE+'/?wdash',vp);await p.waitForFunction(()=>window.GX?.wdash,{timeout:90000}).catch(()=>{});
 await p.evaluate(async()=>{if(!document.getElementById('wdash')){const m=await import('./wdash.js?v=w4');m.open()}});await w(1500);
 await p.evaluate(()=>wdConnB.click());await w(200);await p.evaluate(()=>{wdVia.value='proxy';wdProxy.value='https://mock-proxy.invalid/soap';wdUrl.value='https://store.example.test/WMLS';wdUser.value='tester';wdPass.value='S3cret-pw-XYZ';wdGo.click()});
 await p.waitForSelector('#wdUse',{timeout:20000}).catch(()=>{});await p.evaluate(()=>wdUse.click());await p.waitForFunction(()=>GX.wdash.ST.disc,{timeout:30000}).catch(()=>{});await w(1800);
 const d=await p.evaluate(()=>GX.wdash.ST.disc);ok(d&&d.wellbores==2&&d.logs==6&&d.time==2&&d.depth==4&&d.realtime==1&&d.fe==1&&d.mudlog==2&&d.trajectories==1&&d.mudLogs==1,nm+': discovered every object '+JSON.stringify(d));
 const a=await p.evaluate(()=>{const S=GX.wdash.ST;return {P:S.P?.uid,mode:S.mode,tag:wdTag.textContent,ml:S.tim.ml,sel:wdSet.value,opts:wdSet.options.length,note:wdNote.textContent}});
 ok(a.P=='RT1'&&a.mode=='time'&&a.sel=='WB1|RT1',nm+': live/realtime branch selected by default, time view');ok(a.tag=='LIVE',nm+': LIVE tag on real-time data');
 ok(a.opts==8,nm+': dataset selector lists every dataset with data ('+a.opts+')');
 ok(['DBTM','ROPA','SPPA','HKLA','GR','RESD','NPHI','GASC1','INCL','ML_ROPAV'].every(m=>a.ml.includes(m)),nm+': time view has every channel (depth ones mapped) '+a.ml.length);ok(/via DBTM/.test(a.note),nm+': note shows the index mapping');
 await p.screenshot({path:SH+nm+'_1_time_live.png'});
 await p.evaluate(()=>wdModeD.click());await w(600);const dd=await p.evaluate(()=>{const S=GX.wdash.ST;return {mode:S.mode,ml:S.dep.ml,src:S.dep.src,n:S.dep.rows.length,P:S.P.uid}});
 ok(dd.mode=='depth'&&dd.P=='RT1'&&['ROPA','SPPA','GR','NPHI','GASC1'].every(m=>dd.ml.includes(m))&&dd.src.ROPA.how=='mapped'&&dd.src.GR.how=='native'&&dd.n>100,nm+': depth toggle keeps live branch, time channels mapped to depth');
 await p.screenshot({path:SH+nm+'_2_depth.png'});
 const n0=await p.evaluate(()=>GX.wdash.ST.P.rows.length);F.tick();F.tick();await p.evaluate(()=>GX.wdash.ST.conn.lastPoll=0);await w(2500);ok(await p.evaluate(()=>GX.wdash.ST.P.rows.length)>n0,nm+': live branch keeps polling');
 await p.evaluate(()=>{wdSet.value='WB2|ST1';wdSet.dispatchEvent(new Event('change'))});await w(400);await p.evaluate(()=>wdModeT.click());await w(500);
 const s2=await p.evaluate(()=>({n:GX.wdash.ST.tim.rows.length,note:wdNote.textContent}));ok(s2.n==0&&/no time↔depth mapping/.test(s2.note),nm+': sidetrack without time log -> clear "no mapping" in time view');
 await p.screenshot({path:SH+nm+'_3_no_mapping.png'});
 const persisted=await p.evaluate(()=>JSON.stringify({...localStorage})+location.href+document.body.innerHTML);ok(!/S3cret-pw-XYZ/.test(persisted),nm+': password not in localStorage/URL/DOM');
 await p.close()}
// Settings guide link on a phone (no start screen)
{const p=await pg(BASE+'/?nosplash',PH);await p.waitForSelector('#uiTab_tools',{timeout:90000}).catch(()=>{});await w(3000);await p.evaluate(()=>document.getElementById('uiTab_tools')?.click());await w(800);
 const g=await p.evaluate(()=>{const a=document.getElementById('setGuide');if(!a)return null;a.scrollIntoView();const r=a.getBoundingClientRect();return {w:r.width,h:r.height,y:r.top,vis:getComputedStyle(a).visibility,href:a.getAttribute('href')}});
 ok(g&&g.w>50&&g.h>8&&g.y>=0&&g.y<844&&g.href=='./user-guide.html',"phone: Settings 'User guide' link visible "+JSON.stringify(g));await p.screenshot({path:SH+'phone_4_settings_guide.png'});await p.close()}
ok(!errs.filter(e=>!/WebSocket|supabase|Failed to fetch|THREE/i.test(e)).length,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(`\n${pass} passed, ${fails} failed`);process.exit(fails?1:0)
