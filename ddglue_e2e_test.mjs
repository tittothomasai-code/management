// ddglue_e2e_test (integrator, batch8): scripted slide/rotate drill end to end in the DD cabin with dd-driller + dd-motor loaded. SIM.
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8871').replace(/\/$/,'');let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(BASE+'/?demo=ddcab&nosplash=1',{waitUntil:'load',timeout:180000});
await p.waitForFunction(()=>document.getElementById('ddSurv')&&window.DDCAB?.sess&&window.GX?.dddrv&&window.GX?.ddglue,{timeout:120000}).catch(()=>{});
const r=await p.evaluate(async()=>{const G=GX,s=()=>DDCAB.sess,m0=s().bit.md,i0=s().bit.inc,L0=s().log.length;
 DDCAB.cmd('Slide 10 m at TF 0');const m1=s().bit.md,i1=s().bit.inc;DDCAB.cmd('Rotate 9 m');const m2=s().bit.md;DDCAB.cmd('Survey');
 const log=s().log.slice(L0).join('\n');return {m0,m1,m2,i0,i1,log,glue:G.ddcab?.onInstruction===G.ddglue?.onInstruction,keys:Object.keys(G.ddcab||{}).join(),motor:!!G.ddmotor?.state,drv:!!G.dddrv}});
ok(r.glue&&r.drv,'glue: cabin onInstruction routed to dd-driller');ok(r.motor,'GX.ddmotor alias present');
ok(r.m1>r.m0+9.5,`slide drills 10 m in cabin ${r.m0}->${r.m1}`);ok(r.m2>r.m1+8.5,`rotate drills 9 m ${r.m1}->${r.m2}`);
ok(/Driller:/.test(r.log)&&!/not loaded/.test(r.log),'driller readback in cabin log');ok(/Survey/i.test(r.log),'survey logged');
ok(errs.length==0,'no page errors '+errs.slice(0,2).join(' | '));console.log(r.log.split('\n').slice(0,8).join('\n'));
await b.close();console.log(`${pass} pass, ${fail} fail`);process.exit(fail?1:0);
