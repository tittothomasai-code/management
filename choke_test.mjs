// choke_test (helper B): choke manifold test SIM (API Std 53). Shots 162_choke_*.
import puppeteer from 'puppeteer-core';import * as C from './choke.js';import * as B from './bop.js';
const BASE=(process.argv[2]||'http://localhost:8812').replace(/\/$/,''),SH='shots_live/162_choke_';let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const seq=C.sequence();ok(seq.length==9&&seq.filter(s=>s.kind=='pressure').length==7,'sequence: 7 valve pressure steps + 2 choke function steps');
ok(seq.filter(s=>s.kind=='pressure').every(s=>s.low>=250&&s.low<=350),'low test 250–350 psi on all valves');
ok(seq.find(s=>s.id=='cm1').high==7000&&seq.find(s=>s.id=='cm5').high==5000,'high: upstream MASP+500=7000, downstream 5000 psi');
ok(C.sequence(true).find(s=>s.id=='cm1').high==10000,'initial test: upstream to RWP 10000 psi');
const good=C.runAll();ok(good.every(r=>r.pass),'no leak: all PASS');ok(good.filter(r=>r.kind=='pressure').every(r=>r.lowE.dur>=5&&r.highE.dur>=5),'every hold ≥5 min');
const bad=C.runAll({cm3:20});ok(bad.filter(r=>!r.pass).length==1&&!bad.find(r=>r.id=='cm3').pass,'SIM leak on CM3: only CM3 FAIL');
ok(/not stable/.test(bad.find(r=>r.id=='cm3').why.join()),'fail reason: not stable');ok(!C.runAll({chA:1}).find(r=>r.id=='chA').pass,'choke function fail');
ok(B.STACK.items.length>0&&typeof B.highTarget=='function','bop API used, unchanged');
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[],ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);p.setDefaultTimeout(120000);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=choke&nosplash=1',{waitUntil:'load',timeout:180000});
 ok(await p.waitForFunction(()=>document.getElementById('chP')&&window.CHOKESIM,{timeout:150000}).then(()=>true,()=>false),`${nm}: ?demo=choke opens the panel`);await w(500);
 const t=await p.evaluate(()=>({sim:document.querySelectorAll('#chP .sim').length,live:/\bLIVE\b/.test(document.getElementById('chP').innerText),rows:document.querySelectorAll('#chRec tr[data-i]').length}));
 ok(t.sim>=3&&!t.live,`${nm}: labelled SIM, no LIVE`);ok(t.rows==9,`${nm}: record table 9 rows`);await p.screenshot({path:SH+nm+'_1_schematic.png'});
 await p.click('#chRun');await w(300);const r=await p.evaluate(()=>({sum:document.getElementById('chSum').innerText,f:document.querySelectorAll('#chRec .ok').length}));ok(/All parts PASS/.test(r.sum)&&r.f==9,`${nm}: run: all PASS`);
 await p.evaluate(()=>CHOKESIM.select(1));await w(200);await p.screenshot({path:SH+nm+'_2_pass_chart.png'});
 await p.evaluate(()=>{CHOKESIM.setLeak('cm3');CHOKESIM.run();CHOKESIM.select(3)});await w(200);const f=await p.evaluate(()=>({sum:document.getElementById('chSum').innerText,bad:document.querySelectorAll('#chRec .bad').length}));
 ok(/1 FAIL/.test(f.sum)&&f.bad==1,`${nm}: SIM leak CM3: 1 FAIL in record`);await p.screenshot({path:SH+nm+'_3_fail.png'});
 if(nm=='phone'){const sw=await p.evaluate(()=>document.getElementById('chP').scrollWidth<=innerWidth+2);ok(sw,'phone: no horizontal scroll')}
 await p.keyboard.press('Escape');ok(await p.evaluate(()=>!document.getElementById('chP')),`${nm}: Escape closes`);await ctx.close()}
ok(!EXT.length,'no external data calls');ok(!ERR.length,'no page errors '+ERR.slice(0,2).join(' | '));await br.close();console.log(`choke_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
