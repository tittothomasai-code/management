// bop_test (helper B): BOP test SIM: API 53 criteria, drawdown (Boyle), closing times, panel + 3D hooks. Shots 132_bop_*.
import puppeteer from 'puppeteer-core';import * as B from './bop.js';
const BASE=(process.argv[2]||'http://localhost:8812').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'132_bop_');let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const lo=B.evaluate(B.pressureTest({target:300}),'low'),loL=B.evaluate(B.pressureTest({target:300,leak:8}),'low'),loBad=B.evaluate(B.pressureTest({target:400}),'low');
ok(lo.pass&&lo.dur>=5,'low 300 psi, no leak: PASS, hold ≥5 min');ok(!loL.pass,'low with SIM leak: FAIL');ok(!loBad.pass&&/250–350/.test(loBad.why),'low at 400 psi: FAIL');
const hi=B.evaluate(B.pressureTest({target:7000}),'high'),hiL=B.evaluate(B.pressureTest({target:7000,leak:25}),'high');ok(hi.pass&&!hiL.pass,'high 7000 psi: PASS; with leak FAIL');
const ann=B.STACK.items[0],ram=B.STACK.items[1];ok(B.highTarget(ann)==3500&&B.highTarget(ram)==7000&&B.highTarget(ram,true)==10000,'high targets: annular 3500, ram 7000, initial ram 10000');
const d=B.drawdown();ok(d.pass&&d.final>=B.ACC.pre+200,`drawdown 16 bottles: final ${d.final.toFixed(0)} psi PASS`);ok(!B.drawdown({...B.ACC,bottles:6}).pass,'drawdown 6 bottles: FAIL');
ok(Math.abs(B.pAfter(B.ACC,0)-3000)<1e-6&&Math.abs(B.pAfter(B.ACC,1e9)-1000)<1e-6,'Boyle end points');ok(B.functionTest().every(f=>f.ok),'function test close times inside limits');
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[],ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);p.setDefaultTimeout(120000);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=bop&nosplash=1',{waitUntil:'load',timeout:180000});
 ok(await p.waitForFunction(()=>document.getElementById('bopP')?.style.display=='block'&&window.BOPSIM,{timeout:150000}).then(()=>true,()=>false),`${nm}: ?demo=bop opens the panel`);
 await p.waitForFunction(()=>window.GX?.bopG,{timeout:60000}).catch(()=>{});const h=await p.evaluate(()=>{BOPSIM.hook3D();return {g:!!GX.bopG,n:['bop_upr','bop_bsr','bop_lpr','bop_ann','bop_plug'].filter(n=>GX.bopG?.getObjectByName(n)).length}});ok(h.g&&h.n==5,`${nm}: 3D hooks (${h.n}/5)`);
 await p.$eval('#bopPlug',e=>e.click());await w(500);ok(await p.evaluate(()=>BOPSIM.ST.plug==2&&/landed/.test(document.getElementById('bopPlugSt').textContent)),`${nm}: test plug lands`);
 await p.$eval('#bopRun',e=>e.click());await w(800);let r=await p.evaluate(()=>({res:document.getElementById('bopRes').innerText,closed:BOPSIM.ST.closed.ann,sim:document.getElementById('bopSim').textContent,live:/\bLIVE\b/.test(document.getElementById('bopP').innerText)}));
 ok(/Annular preventer: low PASS · high PASS/.test(r.res)&&r.closed,`${nm}: annular low+high PASS, shown closed`);ok(r.sim=='SIM'&&!r.live,`${nm}: SIM label, no LIVE`);
 const x0=await p.evaluate(()=>GX.bopG.getObjectByName('bop_upr').children[1].position.x);await p.$eval('[data-c=upr]',e=>e.click());await w(3000);const x1=await p.evaluate(()=>GX.bopG.getObjectByName('bop_upr').children[1].position.x);ok(x1<x0-0.5,`${nm}: ram blocks close (${x0.toFixed(2)}→${x1.toFixed(2)})`);
 await p.screenshot({path:`${SH}${nm}_1_pressure.png`});
 await p.$eval('#bopLeak',e=>e.click());await p.$eval('#bopSel',e=>e.value='upr');await p.$eval('#bopRun',e=>e.click());await w(500);ok(/Upper pipe ram: low FAIL · high FAIL/.test(await p.evaluate(()=>document.getElementById('bopRes').innerText)),`${nm}: SIM leak → FAIL`);
 await p.$eval('#bopDDrun',e=>e.click());await w(500);ok(await p.evaluate(()=>document.getElementById('bopDDres')?.textContent=='PASS'),`${nm}: drawdown PASS in panel`);
 await p.evaluate(()=>document.getElementById('bopDD').scrollIntoView());await p.screenshot({path:`${SH}${nm}_2_drawdown.png`});
 ok(await p.evaluate(()=>document.getElementById('bopLo').getBoundingClientRect().right<=innerWidth),`${nm}: charts fit`);
 await p.$eval('#bopX',e=>e.click());ok(await p.evaluate(()=>document.getElementById('bopP').style.display=='none'),`${nm}: ✕ closes`);await ctx.close()}
ok(!EXT.length,'no Supabase/Adaga/WITSML requests');ok(!ERR.length,'no page errors '+ERR.slice(0,2));await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
