// subtarget_test: SIM target band (strat.targetFn) in subsurface view via dw-sub-build hook; follows setTarget; phone + desk. Shots 172_subtarget_*.
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8814').replace(/\/$/,''),SH='shots_live/172_subtarget_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const bad=[];
for(const [vp,nm] of [[{width:1440,height:900},'desk'],[{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},'phone']]){
 const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);await p.setRequestInterception(true);
 p.on('request',r=>{if(r.method()!='GET'&&!/localhost/.test(r.url()))bad.push(r.url());/supabase|adaga|witsml|netlify\/functions/i.test(r.url())?r.abort():r.continue()});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(BASE+'/?nosplash',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.GX?.subsurface&&GX.subtarget,{timeout:90000}).catch(()=>{});await w(1500);
 ok(await p.evaluate(()=>GX.subtarget?.src=='SIM'),nm+': subtarget API loaded, SIM');
 await p.evaluate(()=>GX.subsurface.open());await p.waitForFunction(()=>GX.subsurface.state().names.includes('target_band_SIM'),{timeout:30000}).catch(()=>{});await w(1500);
 const s=await p.evaluate(()=>({n:GX.subsurface.state().names,st:GX.subtarget.stats()}));
 ok(s.n.includes('target_band_SIM'),nm+': band in subsurface scene');
 ok(s.st&&s.st.n>=20&&s.st.thMin>=0.5&&s.st.thMax<=20&&s.st.topMin>0,nm+': band rows/thickness sane '+JSON.stringify(s.st&&{n:s.st.n,th:[s.st.thMin.toFixed(1),s.st.thMax.toFixed(1)]}));
 const eq=await p.evaluate(async()=>{const m=GX.strat,M=m.model(),f=m.targetFn(m.formationIndex('reservoir',M),45,0,0,M),r=GX.subtarget.sample(f,45,1500,25);return Math.abs(r[10].top-f(250).top)<1e-9&&Math.abs(r[10].E-250*Math.SQRT1_2)<1e-6});ok(eq,nm+': band follows strat.targetFn at azimuth');
 await p.evaluate(()=>{document.getElementById('subFollow').click();document.getElementById('subFit').click()});await w(500);await p.mouse.move(vp.width/2,vp.height/2);for(let k=0;k<7;k++){await p.mouse.wheel({deltaY:300});await w(60)}await w(1500);await p.screenshot({path:SH+nm+'_1_band.png'});
 const t2=await p.evaluate(async()=>{GX.strat.setTarget({th0:12});dispatchEvent(new Event('dw-quality'));await new Promise(r=>setTimeout(r,1500));const t=GX.subtarget.stats();GX.strat.resetTarget?.();return t});
 ok(t2&&t2.thMax>s.st.thMax+3,nm+': thicker target → thicker band ('+t2?.thMax?.toFixed(1)+' m)');await p.screenshot({path:SH+nm+'_2_thick.png'});
 const tx=await p.evaluate(()=>document.getElementById('subsurf').innerText);ok(!/\bLIVE\b/.test(tx),nm+': never LIVE');
 ok(!errs.length,nm+': no page errors '+errs.slice(0,2).join('|'));await ctx.close()}
ok(!bad.length,'no external writes');await br.close();console.log(`subtarget_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
