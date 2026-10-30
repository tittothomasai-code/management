// v5.12 cementing demo test (?demo=cement): model checks + UI desk/phone. SIM only, no network writes.
import puppeteer from 'puppeteer-core';import * as M from './cement.js';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'128_cement_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const C=M.plan();ok(Math.abs(C.Vend-C.seq.reduce((a,b)=>a+b[1],0))<1e-6,'volumes sum '+C.Vend.toFixed(1)+' m³');ok(Math.abs(C.seq[3][1]-C.capC*C.fc)<1e-6,'displacement = casing capacity to float collar ('+C.seq[3][1].toFixed(1)+' m³)');
const e=M.stateAt(C,C.Vend);ok(e.ph=='bumped'&&e.pump>3500,'plug bump at end, '+(e.pump/1000).toFixed(2)+' MPa');ok(Math.abs(e.cementTop-C.leadTop)<C.shoe/180*2,'final TOC ≈ planned lead top '+C.leadTop+' m ('+Math.round(e.cementTop)+')');
ok(e.cs.slice(-2).every(f=>f=='tail'),'shoe track left full of tail slurry');ok(e.an.at(-1)=='tail','tail around the shoe');ok(e.ecd<M.FRAC,'final ECD '+e.ecd.toFixed(2)+' < frac '+M.FRAC);
const s0=M.stateAt(C,0);ok(Math.abs(s0.dU)<1,'static all-mud U-tube balanced');ok(M.stateAt(C,C.Vend*0.6).freefall,'free-fall phase flagged when casing heavier');
// v5.13 drill-out + FIT/LOT model (SIM)
const F=await import('./fitlot.js');const fit=F.test(C,{mode:'FIT'}),lot=F.test(C,{mode:'LOT'});
ok(Math.abs(fit.emwTest-F.FIT_EMW)<0.01,'FIT reaches test EMW '+fit.emwTest.toFixed(3)+' SG');ok(fit.held,'FIT holds 10 min');ok(fit.emwMax<F.FRAC,'FIT stays below frac '+F.FRAC);
ok(lot.lo&&Math.abs(lot.emwLO-F.FRAC)<0.02,'LOT leak-off at '+lot.emwLO.toFixed(3)+' SG ≈ SIM frac');ok(lot.isip<lot.stop.p,'LOT ISIP below max pump pressure');
{const a=lot.pts.filter(q=>q.pump);const s1=(a[5].p-a[0].p),s2=(a.at(-1).p-a.at(-6).p);ok(s2<s1*0.5,'LOT line bends over after leak-off')}
{const it=F.drillOut(C);ok(it[0].top<C.fc&&it.at(-1).bot>C.shoe+2.9,'drill-out from plugs to 3 m new hole');ok(it.every((x,i)=>!i||Math.abs(x.top-it[i-1].bot)<1e-6),'drill-out items continuous')}
ok(F.ucs(F.readyAt())>=F.DRILL_OUT_UCS-1e-9&&F.readyAt()<F.WOC_H,'WOC: drill-out strength at '+F.readyAt().toFixed(1)+' h < '+F.WOC_H+' h');
// v5.14 centraliser standoff (API RP 10D-2 method, SIM spring)
const Z=await import('./centralizer.js');{const R=Z.recommend(C.w,C.P),o1=R.options[0];ok(o1.minRs>=Z.TARGET&&o1.minRs<=100,'1 per joint: min standoff '+o1.minRs.toFixed(0)+' % ≥ '+Z.TARGET);
 ok(R.options[1].minRs<o1.minRs,'wider spacing gives lower standoff');const v=Z.standoff(C.w,C.P,100,12.2);ok(v.Rs>95,'near-vertical standoff ≈ 100 % ('+v.Rs.toFixed(0)+')');ok(Z.html(R).includes('SIM'),'standoff panel labelled SIM')}
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}if(r.method()!='GET')bad.push(u);r.continue()});
 await p.goto(BASE+'/?demo=cement',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.dwCem,{timeout:90000}).catch(()=>{});
 ok(await p.evaluate(()=>!!window.dwCem),nm+': ?demo=cement opens');ok(!(await p.$('#start .tile')),nm+': start menu skipped');
 const tx=await p.evaluate(()=>cem.innerText);ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx),nm+': SIM, never LIVE');ok(/m³/.test(tx)&&/MPa/.test(tx)&&/SG/.test(tx),nm+': metric units');
 for(const [f,lab] of [[0.15,'1_lead'],[0.62,'2_freefall'],[1,'3_bumped']]){await p.evaluate(v=>dwCem.seek(v),C.Vend*f);await w(700);const s=await p.evaluate(()=>({ph:dwCem.last.ph,t:cem.innerText}));ok(!/NaN|undefined/.test(s.t),nm+' '+lab+': '+s.ph+', no NaN');await p.screenshot({path:SH+lab+'_'+nm+'.png'})}
 ok(await p.evaluate(()=>/Plug bumped/.test(cemmsg.textContent)),nm+': bump message');await p.waitForSelector('#cntz',{timeout:20000}).catch(()=>{});ok(await p.evaluate(()=>!!document.getElementById('cntz')&&/standoff/i.test(cntz.innerText)),nm+': centraliser standoff panel');if(nm=='phone')ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no horizontal overflow');await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no writes / witsml / supabase');console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
