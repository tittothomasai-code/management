// workover2_test (helper F): woeng2 engineering + wo2 panel (CT, fishing, P&A), SIM labels, phone/desk shots 160_wo2_*.
import puppeteer from 'puppeteer-core';import * as E from './woeng2.js';
const BASE=(process.argv[2]||'http://localhost:8816').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'160_wo2_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
// pure checks
const B=E.bendStrain();ok(B.plastic&&B.reel>B.goose,'CT bends past yield on reel ('+(B.reel*100).toFixed(2)+' %)');
const F0=E.ctFatigue2(1,0),F3=E.ctFatigue2(1,30);ok(F0.Nreel>600&&F0.Nreel<1200,'reel cycles to failure '+F0.Nreel.toFixed(0));ok(F3.Nreel<F0.Nreel,'pressure cuts fatigue life');
ok(E.ctFatigue2(1000,15).retire&&!E.ctFatigue2(5,15).retire,'retire flag after many trips');ok(E.ctFatigue2(1).cyclesPerTrip==6,'6 bend cycles per trip');
const bh=E.buckling(90),bv=E.buckling(0);ok(Math.abs(bh.hel/bh.sin-Math.SQRT2)<1e-9,'helical = √2 × sinusoidal (Chen)');ok(bh.sin>5000&&bh.sin<30000,'Dawson-Paslay 90° '+(bh.sin/1000).toFixed(1)+' kN');ok(bv.hel<bh.hel,'vertical helical load lower than lateral');
ok(E.buckling(30).sin<E.buckling(90).sin,'critical load rises with inclination');
const L=E.lockup();ok(!L.reachTD&&L.md>E.CTWELL.kop,'lock-up before TD at mu 0.25: '+L.md.toFixed(0)+' m');ok(E.lockup({...E.CTWELL,mu:0.15}).reachTD,'lower friction reaches TD');
ok(E.rih(1000).surf_kN>0&&!E.rih(1000).needSnub,'vertical RIH: string in tension at 1000 m');
const C=E.ctCirc(160,3000),C2=E.ctCirc(240,3000);ok(C.pump_MPa>C.ct_MPa&&C.ct_MPa>C.ann_MPa,'CT circulation: inside CT loss dominates');ok(C2.pump_MPa>C.pump_MPa,'more rate → more pump pressure');ok(Number.isFinite(C.pump_MPa)&&C.limitOK,'pump pressure '+C.pump_MPa.toFixed(1)+' MPa inside limit');
ok(E.fishTool({}).map(t=>t.k).join()=='overshot','clean fish top → overshot');ok(E.fishTool({topCondition:'split'})[0].k=='taper','split top → taper tap');ok(E.fishTool({junk:true})[0].k=='mill','junk → mill');ok(E.fishTool({stuck:true}).some(t=>t.k=='jar'),'stuck → jar added');
const ec=E.fishEcon();ok(Math.abs(ec.Dmax-(180e3+1.6e6)/(95e3+12e3))<1e-9&&ec.decision=='fish','econ Dmax '+ec.Dmax.toFixed(1)+' d, fish');ok(E.fishEcon({estDays:20}).decision=='sidetrack','20 days → sidetrack');
const P=E.paPlan().map(p=>E.checkPlug(p));ok(P.length==4&&P.every(p=>p.ok),'P&A 4 plugs pass');ok(!E.checkPlug({...P[0],base:P[0].top+30}).lenOK,'30 m plug fails length');ok(!E.checkPlug({...P[0],where:'oh',base:P[0].top+80}).lenOK,'80 m open-hole plug fails');
ok(E.tagTest(P[0],P[0].top+2,55).pass&&!E.tagTest(P[0],P[0].top+20,55).pass,'tag test depth check');ok(E.pressTest(P[0],0,7,0.1).pass&&!E.pressTest(P[0],5,7,0.1).pass&&!E.pressTest(P[0],0,7,1).pass,'pressure test: need, drop');ok(!E.inflowTest(5,3).pass,'inflow seen → fail');
// browser
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(r.method()!='GET'&&!/localhost/.test(u))bad.push(u);if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});
 await p.goto(BASE+'/?workover=ct',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.dwWO?.last&&document.getElementById('woMore'),{timeout:90000}).catch(()=>{});
 ok(!!await p.$('#woMore'),nm+': workover has CT/fishing/P&A button');await p.evaluate(()=>document.getElementById('woMore').click());await p.waitForSelector('#wo2Life',{timeout:30000}).catch(()=>{});
 let tx=await p.evaluate(()=>document.getElementById('wo2')?.innerText||'');ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx)&&!/NaN|undefined/.test(tx),nm+': CT tab SIM, clean');ok(/Lock-up depth/.test(tx)&&/Pump pressure/.test(tx),nm+': CT tab shows lock-up and pump pressure');
 await w(500);await p.screenshot({path:SH+nm+'_1_ct.png'});
 const l1=await p.$eval('#wo2Lock',e=>e.textContent);await p.evaluate(()=>dwWO2.set('mu',0.15));const l2=await p.$eval('#wo2Lock',e=>e.textContent);ok(/m MD/.test(l1)&&/Reaches TD/.test(l2),nm+': friction input changes lock-up ('+l1+' → '+l2+')');
 await p.evaluate(()=>dwWO2.setTab('fish'));tx=await p.$eval('#wo2',e=>e.innerText);ok(/Overshot|spear|Taper|mill/i.test(tx)&&/Decision/.test(tx),nm+': fishing tab tools + decision');
 await p.evaluate(()=>dwWO2.set('est',25));ok(/Sidetrack/.test(await p.$eval('#wo2Dec',e=>e.textContent)),nm+': long fishing → Sidetrack');await p.evaluate(()=>dwWO2.set('est',4));await w(300);await p.screenshot({path:SH+nm+'_2_fish.png'});
 await p.evaluate(()=>dwWO2.setTab('pa'));tx=await p.$eval('#wo2',e=>e.innerText);ok((tx.match(/PASS/g)||[]).length>=7&&/Primary|Secondary/.test(tx),nm+': P&A plugs + tests pass');
 await p.evaluate(()=>dwWO2.set('drop',2));ok(/FAIL/.test(await p.$eval('#wo2PT',e=>e.textContent)),nm+': big pressure drop → FAIL');await p.evaluate(()=>dwWO2.set('drop',0.1));await w(300);await p.screenshot({path:SH+nm+'_3_pa.png'});
 if(nm=='phone')ok(await p.evaluate(()=>document.getElementById('wo2').scrollWidth<=innerWidth+1),'phone: no horizontal overflow');
 await p.keyboard.press('Escape');await w(300);ok(!await p.$('#wo2')&&!!await p.$('#wo'),nm+': Esc closes panel, workover stays');await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no external writes '+bad.slice(0,2).join());
console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
