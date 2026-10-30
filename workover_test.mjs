// feat/workover test: start tile, ?workover=<job> for all jobs, SIM-only labels, sequence controls (play/step/checklist hold), engineering sanity, no network writes.
import puppeteer from 'puppeteer-core';import * as E from './woeng.js';
const BASE=(process.argv[2]||'http://localhost:8816').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'140_workover_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
// ---- pure engineering checks ----
const ks=E.killSG();ok(ks>1.1&&ks<1.2,'kill SG '+ks.toFixed(3));const fp=E.freePoint(E.stretch(2210,100),100);ok(Math.abs(fp-2210)<1,'free point round-trip '+fp.toFixed(1)+' m');
ok(Math.abs(E.stretch(2210,100)-0.639)<0.01,'stretch 0.639 m @100 kN (E·A)');const P=E.balancedPlug({base:2420});ok(Math.abs(P.V-1.94)<0.03&&P.h>100&&P.disp>0,'balanced plug '+P.V.toFixed(2)+' m3, h '+P.h.toFixed(1));
const ub=E.underbalance();ok(ub>2&&ub<7,'perf underbalance '+ub.toFixed(1)+' MPa in 2–7');ok(/16\/30|20\/40/.test(E.gravel().mesh),'Saucier gravel '+E.gravel().mesh);
ok(E.ctForces(0).light>200&&E.ctForces(0).light<1500,'CT pipe-light '+E.ctForces(0).light.toFixed(0)+' m');ok(E.lineTension(2400).sf>3,'slickline SF '+E.lineTension(2400).sf.toFixed(1));
const J=E.jobs();const keys=Object.keys(J);ok(keys.length>=9,'jobs: '+keys.join());for(const k of keys){J[k].key=k;const TL=E.timeline(J[k]);let bad=0;for(let t=0;t<=TL.T;t+=TL.T/60){const s=E.stateAt(J[k],TL,t);if(![s.hook,s.whp,s.bhp,s.str,s.tdep].every(Number.isFinite))bad++}
 ok(!bad&&E.stateAt(J[k],TL,TL.T+1).done,k+': state finite over timeline, ends done ('+J[k].steps.length+' steps)');ok(!J[k].steps.some(s=>/NaN|undefined/.test((s.calc||'')+(s.chk||[]).join())),k+': no NaN in calcs')}
// ---- browser ----
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
async function pg(url,vp){const ctx=await b.createBrowserContext();const p=await ctx.newPage();p.ctx=ctx;await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(r.method()!='GET'&&!/localhost/.test(u))bad.push(u);if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});await p.goto(url,{waitUntil:'load',timeout:120000});return p}
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 let p=await pg(BASE+'/?start=1',vp);await p.waitForSelector('#st_workover',{timeout:60000}).catch(()=>{});ok(!!await p.$('#st_workover'),nm+': start screen has Workover tile');
 await p.evaluate(()=>document.getElementById('st_workover').click());await p.waitForFunction(()=>window.dwWO&&document.getElementById('woHud')?.innerText.length>10,{timeout:60000}).catch(()=>{});
 ok(await p.evaluate(()=>!!window.dwWO&&!document.querySelector('#start .tile')),nm+': tile opens workover mode');await w(1500);await p.screenshot({path:SH+nm+'_0_open.png'});await p.ctx.close();
 p=await pg(BASE+'/?workover=workover',vp);await p.waitForFunction(()=>window.dwWO?.last,{timeout:90000}).catch(()=>{});
 const tx=await p.evaluate(()=>document.getElementById('wo').innerText);ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx),nm+': SIM label, never LIVE');
 // play a bit: time advances
 await p.evaluate(()=>document.querySelector('#woPlay').click());await w(1500);let t=await p.evaluate(()=>dwWO.R.t);ok(t>0.05,nm+': Play advances time ('+t.toFixed(2)+' s)');await p.evaluate(()=>document.querySelector('#woPause').click());
 // step mode: hold at step end until checks are ticked
 await p.evaluate(()=>document.querySelector('#woStop').click());await p.evaluate(()=>{document.getElementById('woSm').click()});await p.evaluate(()=>document.querySelector('#woPlay').click());
 await p.waitForFunction(()=>dwWO.R.hold,{timeout:20000}).catch(()=>{});let h=await p.evaluate(()=>({hold:dwWO.R.hold,dis:document.getElementById('woStep').disabled,st:document.getElementById('woSt').textContent}));
 ok(h.hold&&h.dis&&/Tick the checks/.test(h.st),nm+': step mode holds at step end, Step blocked until checks ticked ('+h.st+')');
 await p.$$eval('#woChk input',a=>a.forEach(x=>x.click()));await p.evaluate(()=>document.querySelector('#woStep').click());await w(400);let i=await p.evaluate(()=>dwWO.last.i);ok(i>=1,nm+': ticks + Step → next step ('+(i+1)+')');
 if(nm=='phone')ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no horizontal overflow');
 // every job: seek to key points, check HUD numbers, screenshots
 let n=0;for(const k of ['workover','completion','perf','gravel','fishing','pa','slick','wireline','ct']){await p.select('#woJob',k);await w(300);const T=await p.evaluate(()=>dwWO.R.TL.T);
  for(const fr of [0.35,0.75,1.01]){await p.evaluate(x=>dwWO.tick(x),T*fr);await w(nm=='desk'?500:250);
   const s=await p.evaluate(()=>{const s=dwWO.last;return {i:s.i,u:s.unit,hook:s.hook,whp:s.whp,hud:document.getElementById('woHud').innerText}});
   if(/NaN|undefined/.test(s.hud))ok(false,nm+' '+k+': NaN in HUD');else n++;
   if(fr==0.75)await p.screenshot({path:SH+nm+'_'+k+'.png'})}}
 ok(n==27,nm+': all 9 jobs render with clean HUD ('+n+'/27)');
 const fin=await p.evaluate(()=>{dwWO.setJob('pa');dwWO.tick(1e9);return {cem:dwWO.last.cem.length,done:dwWO.last.done,st:document.getElementById('woSt').textContent}});ok(fin.cem==3&&fin.done&&/complete/.test(fin.st),nm+': P&A ends with 3 cement plugs, job complete');
 await p.keyboard.press('Escape');await w(300);ok(!await p.$('#wo'),nm+': Esc closes workover');await p.ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no external writes / witsml / supabase '+bad.slice(0,2).join());
console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
