// ddmotor_test (helper DD-motor): mud motor management. Shots shots_live/164_ddmotor_*.
import puppeteer from 'puppeteer-core';import * as C from './ddmotor_core.js';
const BASE=(process.argv[2]||'http://localhost:8862').replace(/\/$/,''),SH='shots_live/164_ddmotor_';let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));const near=(a,b,t)=>Math.abs(a-b)<=t;
const M=C.MOTORS.m675;
ok(near(C.rpmNoLoad(M,1800),1800*M.rev_gal/3.785411784,1e-9),'no-load RPM = flow x rev/L');
const a=C.state(M,{flow:1800,wob:5}),b=C.state(M,{flow:1800,wob:20});ok(b.dP>a.dP&&b.torque>a.torque&&b.motorRpm<=a.motorRpm,'more WOB: more diff P and torque, RPM falls');
ok(near(b.spp-b.sppOff,b.dP,0.11),'SPP = off-bottom + diff P');ok(near(b.torque,b.dP*M.tqPerBar,0.01),'torque proportional to diff P');
ok(C.state(M,{flow:2200,wob:5}).motorRpm>a.motorRpm,'more flow: more motor RPM');
const s=C.state(M,{flow:1800,wob:35});ok(s.stall&&s.motorRpm==0&&s.spp>b.spp+20&&s.warn.includes('STALL'),'stall: RPM 0, SPP spike');
ok(C.state(M,{flow:1800,wob:35,offBottom:true}).dP==0,'off bottom: no diff P');
ok(near(C.yieldDLS(M,1.5),2*1.5/(M.L1+M.L2)*30,0.01)&&C.yieldDLS(M,2.12)>C.yieldDLS(M,1.15)&&C.yieldDLS(M,0)==0,'yield by three-point geometry, grows with bend');
ok(C.state(M,{flow:1800,wob:5,bend:1.83,rotating:true,rpm:60}).warn.includes('ROTATE-WITH-BEND LIMIT')&&!C.state(M,{flow:1800,wob:5,bend:0.78,rotating:true,rpm:60}).warn.length,'rotate-with-bend limit');
const r=C.state(M,{flow:1800,wob:20,tfSet:10});ok(r.tfShift<0&&near(r.tfAct,C.norm360(10+r.tfShift),1e-9)&&C.state(M,{flow:1800,wob:20,rotating:true,rpm:30}).tfShift==0,'reactive torque turns TF left when sliding');
ok(C.tfMode(3)=='MTF'&&C.tfMode(20)=='GTF','MTF below 5 deg inc, GTF above');
ok(C.state(M,{flow:800,wob:5}).warn.includes('FLOW OUT OF RANGE'),'flow range warning');
const W1=C.newWear(),W2=C.newWear();C.wearStep(M,W1,a,10,{temp:90});C.wearStep(M,W2,C.state(M,{flow:1800,wob:28}),10,{temp:90});ok(W2.statorEq>W1.statorEq,'high diff P wears stator faster');
const W3=C.newWear();C.wearStep(M,W3,a,10,{temp:150});ok(W3.statorEq>W1.statorEq*3,'hot hole wears stator faster');
const W4=C.newWear();for(let i=0;i<5;i++)C.wearStep(M,W4,s,0.1,{temp:90});ok(W4.stalls==5&&C.health(M,W4).pull,'5 stalls: pull the motor');
const sf=C.slideFor(M,1.5,3.5);ok(near(sf.slide+sf.rotate,30,0.01)&&sf.ok&&near(sf.slide,3.5/sf.yield*30,0.1),'slide sheet: slide length for required DLS');
ok([a,s].every(x=>x.src=='SIM')&&C.health(M,W1).src=='SIM','engine output tagged SIM');
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[],ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);p.setDefaultTimeout(120000);
 p.on('request',q=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(q.url()))EXT.push(q.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=ddmotor&nosplash=1',{waitUntil:'load',timeout:180000});
 ok(await p.waitForFunction(()=>document.getElementById('ddmG')&&window.GX?.ddcab?.motor,{timeout:150000}).then(()=>true,()=>false),`${nm}: ?demo=ddmotor opens panel, GX.ddcab.motor hook`);await w(500);
 const t=await p.evaluate(()=>{const e=document.getElementById('ddm');return {sim:e.querySelectorAll('.sim').length,live:/\bLIVE\b/.test(e.innerText),ov:document.documentElement.scrollWidth>innerWidth+2,spec:document.querySelectorAll('#ddmSpec tr').length}});
 ok(t.sim>=3&&!t.live,`${nm}: SIM tags, no LIVE`);ok(t.spec>=6,`${nm}: spec sheet`);ok(!t.ov,`${nm}: no side scroll`);await p.screenshot({path:SH+nm+'_1_panel.png'});
 await p.evaluate(()=>GX.ddcab.motor.step({wob:35,hours:0.1}));await w(200);const s2=await p.evaluate(()=>({st:GX.ddcab.motor.state.stall,steps:document.querySelectorAll('#ddmStall li').length,w:document.getElementById('ddmWarn').innerText}));
 ok(s2.st&&s2.steps>=5&&/STALL/.test(s2.w),`${nm}: stall shows recovery steps`);await p.screenshot({path:SH+nm+'_2_stall.png'});
 await p.click('#ddmPU');await w(100);ok(await p.evaluate(()=>!GX.ddcab.motor.state.stall),`${nm}: pick up clears stall`);
 await p.select('#ddmB','2.12');await p.select('#ddmR','1');await p.evaluate(()=>GX.ddcab.motor.step({rpm:60,hours:0}));ok(/ROTATE-WITH-BEND/.test(await p.$eval('#ddmWarn',e=>e.innerText)),`${nm}: rotate-with-bend warning in UI`);
 const host=await p.evaluate(()=>{const d=document.createElement('div');d.id='hostX';document.body.appendChild(d);GX.ddcab.motor.mount(d);return !!d.querySelector('#ddmG')&&!document.getElementById('ddmX')});ok(host,`${nm}: mount() puts panel inside a cabin container`);
 await ctx.close()}
ok(!EXT.length,'no external data calls');ok(!ERR.length,'no page errors '+ERR.slice(0,2).join(' | '));
await br.close();console.log(`ddmotor_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
