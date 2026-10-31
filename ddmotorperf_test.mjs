// ddmotorperf_test (helper DD-motor): real-time motor performance pop-up. Shots shots_live/165_ddmotorperf_*.
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8862').replace(/\/$/,''),SH='shots_live/165_ddmotorperf_';let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const ERR=[],EXT=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);p.setDefaultTimeout(120000);
 p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));p.on('request',q=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(q.url()))EXT.push(q.url())});
 await p.goto(BASE+'/?demo=ddmotorperf&nosplash=1',{waitUntil:'load',timeout:180000});
 ok(await p.waitForFunction(()=>document.getElementById('ddmpOP')&&window.GX?.ddcab?.motorPerf?.last,{timeout:150000}).then(()=>true,()=>false),`${nm}: ?demo=ddmotorperf opens pop-up`);await w(400);
 const a=await p.evaluate(()=>{const e=document.getElementById('ddmp'),r=e.getBoundingClientRect();return {sim:e.querySelectorAll('.sim').length,live:/\bLIVE\b/.test(e.innerText),txt:e.innerText,in:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,ov:document.documentElement.scrollWidth>innerWidth+2,top:!!document.elementFromPoint(r.left+r.width/2,r.top+20)?.closest('#ddmp')}});
 ok(a.sim>=3&&!a.live,`${nm}: SIM tags, no LIVE`);ok(a.in&&!a.ov&&a.top,`${nm}: pop-up fits screen, on top`);
 ok(/Stall margin/.test(a.txt)&&/Diff P/.test(a.txt)&&/Power/.test(a.txt)&&/Bit RPM/.test(a.txt),`${nm}: operating point + output shown`);
 ok(/(laminar|transition|turbulent)/.test(a.txt)&&/read only/.test(a.txt),`${nm}: annular regime from fluids.js, read only`);ok(/IN RANGE/.test(a.txt),`${nm}: flow vs rated range`);
 await p.screenshot({path:SH+nm+'_1_popup.png'});
 const r1=await p.evaluate(()=>{const M=GX.ddcab.motor,P=GX.ddcab.motorPerf;const s0=P.last.dP;M.step({wob:20,rotating:true,rpm:40,bend:0.78,hours:0});const L=P.last;
  return {up:L.dP>s0,bit:L.bitRpm==L.surfRpm+L.motorRpm&&L.surfRpm==40,pw:Math.abs(L.power-L.torque*L.motorRpm*2*Math.PI/60)<0.2,m:L.margin,dom:document.getElementById('ddmpOut').innerText}});
 ok(r1.up,`${nm}: step() updates pop-up live`);ok(r1.bit&&/40/.test(r1.dom),`${nm}: bit RPM = surface + motor`);ok(r1.pw&&r1.m>0&&r1.m<100,`${nm}: power = torque x RPM, stall margin`);
 const r2=await p.evaluate(()=>{GX.ddcab.motor.step({wob:35,hours:0});const L=GX.ddcab.motorPerf.last;return {s:L.stall,m:L.margin,el:!!document.getElementById('ddmpStall')}});ok(r2.s&&r2.m==0&&r2.el,`${nm}: stall shows 0 % margin + warning`);
 await p.screenshot({path:SH+nm+'_2_stall.png'});
 const r3=await p.evaluate(()=>{GX.ddcab.motor.step({wob:5,flow:3000,hours:0});return document.getElementById('ddmpFlow').innerText});ok(/ABOVE RANGE/.test(r3),`${nm}: flow above rated range flagged`);
 const d=async o=>p.evaluate(o=>{GX.ddcab.motor.step({...o,hours:0});return JSON.parse(document.getElementById('ddmpC').dataset.dot)},o);
 const d1=await d({wob:5,flow:1800,rotating:false}),d2=await d({wob:20,flow:1800}),d3=await d({wob:20,flow:2200});
 ok(d2.x>d1.x&&d2.yRpm>d1.yRpm&&d2.yTq<d1.yTq,`${nm}: dot moves right with WOB (more diff P), RPM falls, torque rises`);
 ok(d3.yRpm<d2.yRpm&&Math.abs(d3.x-d2.x)<0.5,`${nm}: dot moves up with flow (more RPM at same diff P)`);
 ok(await p.evaluate(()=>{const K=GX.ddcab.motorPerf.curves(GX.ddcab.motor.sess.m,2000);return K.rpmMin.length>10&&K.rpmMax[0][1]>K.rpmMin[0][1]&&K.dPstall>K.dPmax&&/rated flow/.test(document.getElementById('ddmpKey').innerText)}),`${nm}: curves at min/max rated flow, max diff P and stall marked`);
 await p.screenshot({path:SH+nm+'_3_curves.png'});
 await p.click('#ddmpX');ok(await p.evaluate(()=>!document.getElementById('ddmp')),`${nm}: close`);await ctx.close()}
ok(!ERR.length,'no page errors '+ERR.slice(0,2).join(' | '));ok(!EXT.length,'no external data calls');
await br.close();console.log(`ddmotorperf_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
