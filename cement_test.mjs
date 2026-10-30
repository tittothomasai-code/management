// v5.12 cementing demo test (?demo=cement): model checks + UI desk/phone. SIM only, no network writes.
import puppeteer from 'puppeteer-core';import * as M from './cement.js';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'128_cement_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const C=M.plan();ok(Math.abs(C.Vend-C.seq.reduce((a,b)=>a+b[1],0))<1e-6,'volumes sum '+C.Vend.toFixed(1)+' m³');ok(Math.abs(C.seq[3][1]-C.capC*C.fc)<1e-6,'displacement = casing capacity to float collar ('+C.seq[3][1].toFixed(1)+' m³)');
const e=M.stateAt(C,C.Vend);ok(e.ph=='bumped'&&e.pump>3500,'plug bump at end, '+(e.pump/1000).toFixed(2)+' MPa');ok(Math.abs(e.cementTop-C.leadTop)<C.shoe/180*2,'final TOC ≈ planned lead top '+C.leadTop+' m ('+Math.round(e.cementTop)+')');
ok(e.cs.slice(-2).every(f=>f=='tail'),'shoe track left full of tail slurry');ok(e.an.at(-1)=='tail','tail around the shoe');ok(e.ecd<M.FRAC,'final ECD '+e.ecd.toFixed(2)+' < frac '+M.FRAC);
const s0=M.stateAt(C,0);ok(Math.abs(s0.dU)<1,'static all-mud U-tube balanced');ok(M.stateAt(C,C.Vend*0.6).freefall,'free-fall phase flagged when casing heavier');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}if(r.method()!='GET')bad.push(u);r.continue()});
 await p.goto(BASE+'/?demo=cement',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.dwCem,{timeout:90000}).catch(()=>{});
 ok(await p.evaluate(()=>!!window.dwCem),nm+': ?demo=cement opens');ok(!(await p.$('#start .tile')),nm+': start menu skipped');
 const tx=await p.evaluate(()=>cem.innerText);ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx),nm+': SIM, never LIVE');ok(/m³/.test(tx)&&/MPa/.test(tx)&&/SG/.test(tx),nm+': metric units');
 for(const [f,lab] of [[0.15,'1_lead'],[0.62,'2_freefall'],[1,'3_bumped']]){await p.evaluate(v=>dwCem.seek(v),C.Vend*f);await w(700);const s=await p.evaluate(()=>({ph:dwCem.last.ph,t:cem.innerText}));ok(!/NaN|undefined/.test(s.t),nm+' '+lab+': '+s.ph+', no NaN');await p.screenshot({path:SH+lab+'_'+nm+'.png'})}
 ok(await p.evaluate(()=>/Plug bumped/.test(cemmsg.textContent)),nm+': bump message');if(nm=='phone')ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no horizontal overflow');await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no writes / witsml / supabase');console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
