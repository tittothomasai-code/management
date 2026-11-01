// v5.12.20 simulator whole-well WITSML test (local SIM-TEST fixture only, fixtures/witsml_multi.mjs): the SIMULATOR's WITSML panel
// (ext4 live feed + 3D trajectory) and "Monitor a well" use the SAME shared wwell.js model as ?wdash: every wellbore/log/trajectory/mudLog,
// live branch default, Depth/Time selector with mapped channels. node simwell_test.mjs [base]  shots -> $SHOTS (default ../sim-witsml-shots/)
import puppeteer from 'puppeteer-core';import fs from 'fs';import * as WW from './wwell.js';import * as F from './fixtures/witsml_multi.mjs';
const BASE=(process.argv[2]||'http://127.0.0.1:18793').replace(/\/$/,''),SH=process.env.SHOTS||'../sim-witsml-shots/';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
// ---- unit: shared model on the multi-log fixture (no browser) ----
{const io=WW.makeIO(async(op,t,q,o)=>F.answer({op,wmlType:t,query:q,options:o}));const W=await WW.load(io,'W1',{tag:'SIM-TEST'});
 ok(W.disc.wellbores==2&&W.disc.logs==6&&W.disc.trajectories==1&&W.disc.mudLogs==1&&W.disc.realtime==1&&W.disc.fe==1,'unit: shared model discovers every object '+JSON.stringify(W.disc));
 ok(W.P.uid=='RT1'&&W.mode=='time','unit: live branch default + time view');ok(['GR','NPHI','GASC1','ROPA'].every(m=>W.tim.ml.includes(m)),'unit: time view has depth channels mapped');
 WW.setMode('depth');ok(['ROPA','SPPA','GR'].every(m=>W.dep.ml.includes(m))&&W.dep.src.ROPA.how=='mapped','unit: depth view has time channels mapped');
 const la=WW.latest();ok(la.ch.length>5&&la.ch.some(c=>c.mn=='GR'&&c.v!=null),'unit: latest values per channel');WW.select('ST1','WB2');WW.setMode('time');ok(!W.tim.rows.length,'unit: sidetrack without time log -> no time view');
 const src=['ext4.js','monitor.js','wdash.js'].map(f=>fs.readFileSync(new URL('./'+f,import.meta.url),'utf8'));
 ok(/wwell\.js/.test(src[0])&&/GX\?\.wellmodel/.test(src[1])&&/WW\.discoverWell/.test(src[2])&&!/async function listTraj/.test(src[2]),'unit: simulator + monitor + dashboard all use the one shared module (no duplicate discovery)');WW.clear()}
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[];
async function pg(url,vp){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(u.startsWith('https://mock-proxy.invalid/'))return r.method()=='OPTIONS'?r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}}):r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(F.answer(JSON.parse(r.postData()||'{}')))});
  if(/adaga|witsml-proxy|supabase\.co|:8796/.test(u)&&!/\.js(\?|$)/.test(u))return r.abort();r.continue()});await p.goto(url,{waitUntil:'load',timeout:180000});return p}
const PH={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},LT={width:1440,height:900};
for(const [nm,vp] of [['phone',PH],['laptop',LT]]){
 const p=await pg(BASE+'/?nosplash=1&player=SIM%20Test',vp);await p.waitForFunction(()=>window.GX?.witsml&&document.getElementById('wbtn'),{timeout:180000}).catch(()=>{});await w(2500);
 await p.evaluate(()=>{if(!GX.witsml.isOpen?.())GX.witsml.open()});await w(500);
 await p.evaluate(()=>{wproxy.value='https://mock-proxy.invalid/soap';wurl.value='https://store.example.test/WMLS';wuser.value='tester';wpass.value='S3cret-pw-XYZ';wcon.click()});
 await p.waitForFunction(()=>document.getElementById('wwell')?.options.length>0,{timeout:30000}).catch(()=>{});await w(800);
 await p.evaluate(()=>{wwb.value='WB2';GX.witsml.loadWell(wwell.value,'WB2')});// user had the sidetrack picked: live branch must still win
 await p.waitForFunction(()=>GX.witsml.WML.whole?.disc&&GX.witsml.WML.log,{timeout:45000}).catch(()=>{});await w(2500);
 const a=await p.evaluate(()=>{const W=GX.witsml.WML,M=GX.wellmodel.WM;return {disc:M.disc,P:M.P?.uid,mode:M.mode,log:W.log?.uid,logWb:W.log?.b,sv:GX.witsml.CFG.svWellbore,tag:wwTag.textContent,opts:wwSet.options.length,note:wwNote.textContent,ml:M.tim.ml,ch:Object.keys(W.channels||{})}});
 ok(a.disc&&a.disc.wellbores==2&&a.disc.logs==6&&a.disc.trajectories==1&&a.disc.mudLogs==1,nm+': simulator discovers every object '+JSON.stringify(a.disc));
 ok(a.P=='RT1'&&a.log=='RT1'&&a.logWb=='WB1'&&a.sv=='WB1',nm+': live branch drives the sim feed + 3D trajectory wellbore by default ('+a.log+'/'+a.logWb+', traj '+a.sv+')');
 ok(a.tag!='LIVE'&&/SIM-TEST/.test(a.tag),nm+': SIM-TEST fixture never labelled LIVE ('+a.tag+')');ok(a.opts==6,nm+': branch selector lists every log with data ('+a.opts+')');
 ok(a.mode=='time'&&['GR','NPHI','GASC1'].every(m=>a.ml.includes(m))&&/via DBTM/.test(a.note),nm+': time view with depth channels mapped via DBTM');
 await p.evaluate(()=>document.getElementById('wwm').scrollIntoView());await p.screenshot({path:SH+nm+'_1_sim_panel_time.png'});
 await p.evaluate(()=>wwD.click());await w(500);const d=await p.evaluate(()=>({m:GX.wellmodel.WM.mode,ml:GX.wellmodel.WM.dep.ml,note:wwNote.textContent}));
 ok(d.m=='depth'&&['ROPA','SPPA','GR'].every(m=>d.ml.includes(m))&&/Depth view/.test(d.note),nm+': simulator Depth toggle maps time channels to depth');
 await p.evaluate(()=>document.getElementById('wwm').scrollIntoView());await p.screenshot({path:SH+nm+'_2_sim_panel_depth.png'});
 // Monitor a well shows the same model
 await p.evaluate(async()=>{const m=await import('./monitor.js?v=b12');m.open()});await w(1500);
 const mo=await p.evaluate(()=>({t:monWWb.textContent,tag:monWWtag.textContent,P:monWWP.textContent}));ok(/2 wellbores · 6 logs/.test(mo.t)&&/Realtime/.test(mo.P)&&mo.tag!='LIVE',nm+': Monitor a well shows whole well + live branch ('+mo.tag+')');
 await p.evaluate(()=>monWWT.click());await w(300);ok(await p.evaluate(()=>GX.wellmodel.WM.mode=='time'&&monWWT.classList.contains('on')),nm+': Monitor Depth/Time selector');
 await p.evaluate(()=>document.getElementById('monWW').scrollIntoView());await p.screenshot({path:SH+nm+'_3_monitor_whole_well.png'});
 await p.evaluate(()=>GX.monitor?.close?.());await p.evaluate(()=>GX.witsml.close?.());await w(800);await p.screenshot({path:SH+nm+'_4_sim_3d.png'});
 const persisted=await p.evaluate(()=>JSON.stringify({...localStorage})+location.href+document.body.innerHTML);ok(!/S3cret-pw-XYZ/.test(persisted),nm+': password not in localStorage/URL/DOM');
 await p.close()}
ok(!errs.filter(e=>!/WebSocket|supabase|Failed to fetch|THREE/i.test(e)).length,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(`\n${pass} passed, ${fails} failed`);process.exit(fails?1:0)
