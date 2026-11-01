// coolmode_test (v5.12.7): Settings toggle 'Cool mode (arcade showroom)'. OFF by default -> professional one showroom (C), unchanged.
// ON -> Rig showroom opens the pre-v5.12.6 black arcade look + kart-style rig select (showroomb.js); remembered after reload; OFF again -> C. Desk + phone.
// Shots: shots_live/199_cool_<vp>_{off,on}.png
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8961').replace(/\/$/,''),SH='shots_live/199_cool_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
const load=async p=>{await p.goto(BASE+'/?nosplash',{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.GX&&window.G&&G._scene&&GX.showroomAB&&GX.showroomC&&document.getElementById('srabCool'),{timeout:180000})};
for(const nm of (process.env.ONLY?[process.env.ONLY]:['desk','phone'])){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(VP[nm]);
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())&&!/\.js(\?|$)/.test(r.url())?r.abort():r.continue());
 await load(p);
 let s=await p.evaluate(()=>({cb:document.getElementById('srabCool').checked,lbl:document.getElementById('srabCoolL').textContent.trim(),keys:GX.showroomAB.keys()}));ok(!s.cb&&s.lbl=='Cool mode (arcade showroom)'&&s.keys.join()=='C',nm+': Cool mode off by default '+JSON.stringify(s));
 ok(await p.evaluate(()=>GX.showroomAB.open())=='C',nm+': off -> professional showroom C');await p.waitForFunction(()=>GX.showroomC.ST.open,{timeout:180000});await w(6000);
 ok(await p.evaluate(()=>!document.getElementById('showroomB')),nm+': off -> no arcade screen');await p.screenshot({path:SH+nm+'_off.png'});await p.evaluate(()=>GX.showroomC.close());await w(500);
 await p.evaluate(()=>document.getElementById('srabCool').click());await w(300);ok(await p.evaluate(()=>localStorage.getItem('dw_cool_mode'))=='1',nm+': on -> remembered');
 await load(p);ok(await p.evaluate(()=>document.getElementById('srabCool').checked&&GX.showroomAB.coolOn()),nm+': still on after reload');
 ok(await p.evaluate(()=>GX.showroomAB.open())=='B',nm+': on -> arcade showroom B');await p.waitForFunction(()=>document.getElementById('showroomB'),{timeout:180000});await w(8000);
 s=await p.evaluate(()=>{const e=document.getElementById('showroomB');return {bg:getComputedStyle(e).backgroundColor,c:!!(window.GX.showroomC.ST.open)}});ok(!s.c,nm+': on -> one showroom C not opened '+JSON.stringify(s));
 await p.screenshot({path:SH+nm+'_on.png'});
 await p.keyboard.press('ArrowRight');await w(1500);ok(await p.evaluate(()=>!!document.getElementById('showroomB')),nm+': rig select arrow keeps arcade open');
 await p.evaluate(()=>import('./srpick.js?v=b10').then(m=>m.coolOn()&&GX.showroomAB.setCool(false)));await p.evaluate(()=>import('./showroomb.js?v=b7').then(m=>m.close()));await w(500);
 ok(await p.evaluate(()=>GX.showroomAB.open())=='C',nm+': off again -> C');
 ok(!errs.length,nm+': no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
await br.close();console.log(`coolmode_test ${pass}/${fail}`);process.exit(fail?1:0)
