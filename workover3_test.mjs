// workover3_test (helper F, batch6): woeng3 (CT string fatigue map, weight indicator, free point, overshot/wash pipe, balanced cement plug sequence) + wo2 new tabs. Shots 171_wo3_*.
import puppeteer from 'puppeteer-core';import * as E from './woeng3.js';import * as W from './woeng2.js';
const BASE=(process.argv[2]||'http://localhost:8816').replace(/\/$/,''),SH='shots_live/171_wo3_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const M1=E.fatigueMap([{depth:3000,p:10,trips:1}]),F1=W.ctFatigue2(1,10);ok(Math.abs(M1.maxPct/100-F1.damage)<1e-9,'1 trip map = woeng2 per-trip damage');ok(M1.D[Math.round(3500/50)]==0,'part never run in: no damage');
const M2=E.fatigueMap([{depth:4000,p:15,trips:60,wipers:[{from:3500,to:4000,n:10}]}]);ok(M2.atM>=3500&&M2.atM<=4000&&M2.retire,'wipers make a local fatigue peak at 3500–4000 m, retire');
const M3=E.fatigueMap([{depth:5000,p:30,trips:400}]);ok(M3.cutTipM>0&&M3.lenAfterCut<W.CT2.len,'heavy use: cut tip '+M3.cutTipM+' m');
const C=E.weightChart();ok(!C.lock.reachTD&&C.pts.find(q=>q.md>C.lock.md).rih==null,'weight chart: RIH stops at lock-up');ok(C.pts.every((q,i)=>q.rih==null||q.pooh>=q.rih),'POOH load ≥ RIH load (drag)');
ok(C.pts.every((q,i)=>q.pooh>=C.free[i].f-1e-6),'POOH ≥ no-friction load');
const S=E.stuckPoint('2-7/8 in 6.5 lb/ft tubing',300,100);ok(Math.abs(S.freeM-207e9*S.A_cm2/1e4*0.3/1e5)<1e-6&&S.freeM>600&&S.freeM<900,'free point L = EAΔL/ΔF = '+S.freeM.toFixed(0)+' m');
ok(E.stuckPoint('2-7/8 in 6.5 lb/ft tubing',600,100).freeM>S.freeM,'more stretch → deeper free point');
const O=E.overshot(2.875,6.184);ok(O.ok&&O.od<=6.184-0.25&&O.size==2.875,'overshot for 2-7/8 in fish in 7 in casing: '+O.id+' '+O.grapple);ok(!E.overshot(6,6.184).ok,'6 in fish in 6.184 in hole: no overshot');
const Wp=E.washover(2.875,6.184);ok(Wp.ok&&Wp.id_in>=3&&Wp.od<=5.684,'wash pipe '+Wp.id);ok(!E.washover(5.5,6.184).ok,'no wash pipe for 5.5 in fish');
const P=E.balancedPlug();ok(P.H>=150&&P.lenOK,'plug height with pipe in '+P.H.toFixed(0)+' m ≥ 50 m');ok(Math.abs(P.spBehind/P.Cp-1.6/P.Ca)<1e-9,'spacer behind balances spacer ahead (same height)');
ok(Math.abs(P.disp-(P.Cp*(2430-P.H)-P.spBehind))<1e-9&&P.disp>0,'displacement '+P.disp.toFixed(2)+' m³');ok(P.steps.length==11&&P.steps.map(s=>s.id).join()=='rih,circ,spA,cmt,spB,disp,pooh,rev,woc,tag,test','sequence 11 steps in order');
ok(P.afterPull<P.top&&P.steps.at(-1).cum>12,'pull above top, WOC in total '+P.totalH.toFixed(1)+' h');ok(E.plugState(P,8).set&&!E.plugState(P,5).set&&E.plugState(P,6).pipeEnd<P.top,'schematic states: pipe out of cement after pull, set after WOC');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(r.method()!='GET'&&!/localhost/.test(u))bad.push(u);if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});
 await p.goto(BASE+'/?workover=ct',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.dwWO?.last&&document.getElementById('woMore'),{timeout:90000}).catch(()=>{});
 await p.evaluate(()=>document.getElementById('woMore').click());await p.waitForFunction(()=>window.dwWO2,{timeout:30000}).catch(()=>{});
 const tabs=await p.$$eval('#wo2 [data-t]',b=>b.map(x=>x.dataset.t).join());ok(tabs.startsWith('ct,ct2,fish,fish2,pa,plug'),nm+': 6 base tabs (+squeeze, jar)');
 await p.evaluate(()=>dwWO2.setTab('ct2'));await w(300);let tx=await p.$eval('#wo2',e=>e.innerText);ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx)&&!/NaN|undefined/.test(tx),nm+': CT life tab SIM, clean');ok(/RETIRE/.test(tx)&&/Lock-up 44\d\d m/.test(tx),nm+': fatigue retire + lock-up shown');
 await p.evaluate(()=>{dwWO2.set('jt',5);dwWO2.set('wpn',0)});ok(/OK/.test(await p.$eval('#wo3Fr',e=>e.textContent)),nm+': fewer trips → OK');await p.evaluate(()=>{dwWO2.set('jt',60);dwWO2.set('wpn',10)});await w(300);await p.screenshot({path:SH+nm+'_1_ctlife.png'});
 await p.evaluate(()=>dwWO2.setTab('fish2'));tx=await p.$eval('#wo2',e=>e.innerText);ok(/726 m/.test(await p.$eval('#wo3Fp',e=>e.textContent))&&/OS-/.test(tx)&&/WP-/.test(tx),nm+': free point + overshot + wash pipe');
 await p.evaluate(()=>dwWO2.set('fod',6));ok(/no overshot|too large/.test(await p.$eval('#wo3Os',e=>e.textContent)),nm+': big fish → no overshot');await p.evaluate(()=>dwWO2.set('fod',2.875));await w(200);await p.screenshot({path:SH+nm+'_2_fish.png'});
 await p.evaluate(()=>dwWO2.setTab('plug'));ok(/^1\/11/.test(await p.$eval('#wo3St',e=>e.textContent)),nm+': plug step 1/11');for(let k=0;k<4;k++){await p.evaluate(()=>document.getElementById('wo3Next').click());await w(50);}ok(/^5\/11/.test(await p.$eval('#wo3St',e=>e.textContent)),nm+': Step ▶ advances');
 await w(200);await p.screenshot({path:SH+nm+'_3_plug_pump.png'});await p.evaluate(()=>dwWO2.set('pstep',8));ok(/^9\/11.*Wait on cement/.test(await p.$eval('#wo3St',e=>e.textContent)),nm+': WOC step');await w(200);await p.screenshot({path:SH+nm+'_4_plug_woc.png'});
 if(nm=='phone')ok(await p.evaluate(()=>document.getElementById('wo2').scrollWidth<=innerWidth+2),'phone: no horizontal scroll');await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,2).join('|'));ok(!bad.length,'no external writes');await b.close();console.log(`workover3_test: ${pass} pass, ${fails} fail`);process.exit(fails?1:0)
