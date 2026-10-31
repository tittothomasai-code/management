// squeezejar_test (helper F): woeng4 squeeze cementing + jar impact, wo2 Squeeze/Jar tabs. Shots 175_sqj_*.
import puppeteer from 'puppeteer-core';import * as E from './woeng4.js';import * as W from './woeng2.js';
const BASE=(process.argv[2]||'http://localhost:8877').replace(/\/$/,''),SH='shots_live/175_sqj_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const T=E.injTest();ok(T.belowFrac&&T.inject&&T.maxSurf>0,'injection test below frac, max surface '+T.maxSurf.toFixed(1)+' MPa');ok(!E.injTest({...E.SQZ,injP_MPa:20}).belowFrac,'20 MPa injection breaks formation');
ok(!E.injTest({...E.SQZ,injQ_m3min:0.0001}).inject,'no rate → no injection');
const V=E.sqzVolumes();ok(Math.abs(V.tbg-Math.PI/4*(2.441*0.0254)**2*2365)<1e-9,'tubing capacity to retainer');ok(V.Vc>V.below+V.into&&V.dispPump<V.tbg,'20 % excess, under-displace');
const H=E.hesitation();ok(H.final.final&&H.stages.every((q,i)=>i==0||q.pump>=H.stages[i-1].pump),'hesitation pressure rises to final squeeze');ok(H.stages.every(q=>q.pump<=H.pFinal+1e-9),'never above frac limit');
const J=E.sqzJob();ok(J.ok&&J.steps.length==12,'squeeze job PASS, 12 steps');ok(!E.sqzJob({...E.SQZ,retainer:2390}).ok,'retainer below top perf fails');ok(!E.sqzJob({...E.SQZ,thickH:0.5}).ok,'short thickening time fails');
const B=E.jarBlow(200),B0=E.jarBlow(200,false);ok(Math.abs(B0.v-200e3/B0.Zp)<1e-9,'no accelerator: v0 = T/Z');ok(B.F_kN>B0.F_kN,'accelerator gives harder blow '+B.F_kN.toFixed(0)+' vs '+B0.F_kN.toFixed(0)+' kN');
ok(E.jarBlow(300).F_kN>B.F_kN,'more overpull → more impact');ok(Math.abs(B.stretch_m-W.jarImpact(200,2300,3.5,2.764).stretch_m)<1e-12,'stretch uses woeng2.jarImpact');
const Wn=E.jarWindow(200);ok(Wn.ok,'200 kN jar window OK');ok(!E.jarWindow(500).okJar,'500 kN over jar rating');ok(!E.jarWindow(400,{...E.JAR,pipeYieldkN:800}).okYield,'weak pipe: over 80 % yield');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(r.method()!='GET'&&!/localhost/.test(u))bad.push(u);if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});
 await p.goto(BASE+'/?workover=ct',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.dwWO?.last&&document.getElementById('woMore'),{timeout:90000}).catch(()=>{});
 await p.evaluate(()=>document.getElementById('woMore').click());await p.waitForFunction(()=>window.dwWO2,{timeout:30000}).catch(()=>{});
 await p.evaluate(()=>dwWO2.setTab('sqz'));let tx=await p.$eval('#wo2',e=>e.innerText);ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx)&&!/NaN|undefined|Infinity/.test(tx),nm+': squeeze tab SIM, clean');
 ok(/PASS/.test(await p.$eval('#wo4Sq',e=>e.textContent))&&/Hesitation/.test(tx),nm+': squeeze PASS + chart');await w(300);await p.screenshot({path:SH+nm+'_1_sqz.png'});
 await p.evaluate(()=>dwWO2.set('sqP',20));ok(/FAIL/.test(await p.$eval('#wo4Sq',e=>e.textContent)),nm+': high injection pressure → FAIL');await p.evaluate(()=>dwWO2.set('sqP',6));
 await p.evaluate(()=>dwWO2.setTab('jar'));tx=await p.$eval('#wo2',e=>e.innerText);ok(/Peak impact/.test(tx)&&!/NaN|undefined/.test(tx),nm+': jar tab clean');
 const f1=parseFloat(await p.$eval('#wo4F',e=>e.textContent));await p.evaluate(()=>dwWO2.set('jAcc',0));const f2=parseFloat(await p.$eval('#wo4F',e=>e.textContent));ok(f1>f2,nm+': accelerator off → smaller blow '+f1+' > '+f2);
 await p.evaluate(()=>dwWO2.set('jAcc',1));await w(300);await p.screenshot({path:SH+nm+'_2_jar.png'});
 await p.evaluate(()=>dwWO2.setTab('plug'));ok(!!await p.$('#wo3Pc'),nm+': existing cement plug tab still works');
 if(nm=='phone')ok(await p.evaluate(()=>document.getElementById('wo2').scrollWidth<=innerWidth+1),'phone: no horizontal overflow');await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no external writes '+bad.slice(0,2).join());
console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
