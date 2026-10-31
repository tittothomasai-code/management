// srasetting_test (v5.12.2.1): Settings toggle 'Show Showroom A (classic)'. Off by default (single showroom, no switch);
// on -> Showroom | A (classic) switch, A opens as before; stays on after reload. Desk + phone. Shot 198_sra_<vp>_on.png
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8961').replace(/\/$/,''),SH='shots_live/198_sra_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
const load=async p=>{await p.goto(BASE+'/?nosplash',{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.GX&&window.G&&G._scene&&GX.showroomAB&&GX.showroomC&&document.getElementById('srabAon'),{timeout:180000})};
for(const nm of (process.env.ONLY?[process.env.ONLY]:['desk','phone'])){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(VP[nm]);
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())&&!/\.js(\?|$)/.test(r.url())?r.abort():r.continue());
 await load(p);
 let s=await p.evaluate(()=>({cb:document.getElementById('srabAon').checked,lbl:document.getElementById('srabAonL').textContent.trim(),keys:GX.showroomAB.keys()}));ok(!s.cb&&s.lbl=='Show Showroom A (classic)'&&s.keys.join()=='C',nm+': toggle off by default, one showroom '+JSON.stringify(s));
 await p.evaluate(()=>GX.showroomAB.open());await p.waitForFunction(()=>GX.showroomC.ST.open,{timeout:180000});await w(500);ok(await p.evaluate(()=>!document.querySelector('.srabH')),nm+': off -> no switch in showroom');await p.evaluate(()=>GX.showroomC.close());
 await p.evaluate(()=>document.getElementById('srabAon').click());await w(500);
 s=await p.evaluate(()=>({ls:localStorage.getItem('dw_showroom_a_on'),keys:GX.showroomAB.keys()}));ok(s.ls=='1'&&s.keys.join()=='C,A',nm+': on -> remembered, A available '+JSON.stringify(s));
 await load(p);ok(await p.evaluate(()=>document.getElementById('srabAon').checked&&GX.showroomAB.keys().includes('A')),nm+': still on after reload');
 await p.evaluate(()=>GX.showroomAB.open());await p.waitForFunction(()=>GX.showroomC.ST.open&&document.querySelector('#srcTop .srabH'),{timeout:180000});await w(1500);
 const h=await p.evaluate(()=>[...document.querySelectorAll('#srcTop .srabH button')].map(b=>b.textContent));ok(h.join('|')=='Showroom|A (classic)',nm+': switch shows '+h.join(' | '));
 await p.screenshot({path:SH+nm+'_on.png'});
 await p.evaluate(()=>document.getElementById('srabHA').click());await p.waitForFunction(()=>document.getElementById('showroom')&&!document.getElementById('showroomC'),{timeout:180000});await w(3000);
 ok(await p.evaluate(()=>!!document.getElementById('srHdl')&&!!document.getElementById('srUse')&&!!document.querySelector('#srTop .srabH')),nm+': A (classic) opens as before, with Assets tab and switch back');
 await p.screenshot({path:SH+nm+'_A.png'});
 await p.evaluate(()=>document.getElementById('srabHC').click());await p.waitForFunction(()=>document.getElementById('showroomC')&&!document.getElementById('showroom'),{timeout:180000});ok(true,nm+': switch back to Showroom');
 await p.evaluate(()=>GX.showroomC.close());await p.evaluate(()=>document.getElementById('srabAon').click());await w(400);
 ok(await p.evaluate(()=>localStorage.getItem('dw_showroom_a_on')=='0'&&GX.showroomAB.keys().join()=='C'&&GX.showroomAB.get()=='C'),nm+': off again -> single showroom');
 ok(!errs.length,nm+': no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
await br.close();console.log(`srasetting: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
