// feat/casing-cement2 test: SIM cement evaluation (bond index, CBL, TOC after losses, isolation check), phone + desk.
import puppeteer from 'puppeteer-core';import * as M from './cemeval.js';import * as CM from './cement.js';import * as CZ from './centralizer.js';
const BASE=(process.argv[2]||'http://localhost:8873').replace(/\/$/,''),SH='shots_live/172_cemeval_';
const w_=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
ok(Math.abs(M.ampOf(0)-M.LOG.Afree)<1e-9&&Math.abs(M.ampOf(1)-M.LOG.Amin)<1e-9,'CBL amplitude: free pipe '+M.LOG.Afree+' mV, full bond '+M.LOG.Amin+' mV');
ok([0.1,0.5,0.9].every(b=>Math.abs(M.biOf(M.ampOf(b))-b)<1e-9),'bond index = log(Afree/A)/log(Afree/Amin) round trip');
ok(M.dispEff(80)==1&&M.dispEff(67)==1&&M.dispEff(60)<1&&M.dispEff(20)<M.dispEff(49),'mud removal falls under 67 % standoff');
const C=CM.plan();let mx=0;for(let i=0;i<=120;i++)mx=Math.max(mx,CM.stateAt(C,C.Vend*i/120).ecd);
const E1=M.evaluate({every:1}),E3=M.evaluate({every:3});ok(Math.abs(E1.ecdMax-mx)<1e-9,'max ECD from cement.js stateAt '+mx.toFixed(3)+' SG (no new hydraulics)');
ok(E1.minRs==Math.min(...CZ.profile(C.w,C.P,{every:1}).map(p=>p.Rs)),'standoff from centralizer.js profile');
ok(E1.rows.every(r=>r.tag=='SIM')&&E1.tag=='SIM','all log rows tagged SIM');
ok(E1.lostM3>0&&E1.toc>E1.tocPlan,'ECD '+mx.toFixed(3)+' > FG '+E1.fg+' → losses '+E1.lostM3.toFixed(1)+' m³, TOC '+E1.toc.toFixed(0)+' below plan '+E1.tocPlan);
const Eh=M.evaluate({fg:1.8});ok(Eh.lostM3==0&&Eh.toc==Eh.tocPlan,'no losses when FG > ECD: TOC on plan');
ok(E1.rows.filter(r=>r.md<E1.toc).every(r=>r.bi==0&&Math.abs(r.amp-M.LOG.Afree)<1e-9),'free pipe above TOC');
ok(E1.pass&&E1.shoeRun>=30,'1 per joint: isolation OK, '+E1.shoeRun+' m good bond above shoe');
ok(!E3.pass&&E3.shoeRun<E1.shoeRun&&E3.adv.some(a=>/shoe/.test(a))&&E3.adv.some(a=>/centraliser/.test(a)),'1 per 3 joints: poor isolation in open hole, shoe + centraliser advice');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!/localhost/.test(r.url()))bad.push(r.url())});
 await p.goto(BASE+'/?nosplash=1&demo=cemlog',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>document.getElementById('celLog')?.width>50,{timeout:120000});await w_(600);
 ok(await p.evaluate(()=>!!document.getElementById('btnCEL')),nm+': button present');
 const t=await p.evaluate(()=>document.getElementById('cel').textContent);ok(/SIM/.test(t)&&!/\bLIVE\b/.test(t)&&/TOC/.test(t)&&/Bond|bond/.test(t),nm+': panel SIM, TOC and bond shown');
 const r=await p.evaluate(()=>{const c=document.getElementById('cel').getBoundingClientRect();return {w:c.width,vw:innerWidth,sw:document.getElementById('cel').scrollWidth,cw:document.getElementById('cel').clientWidth}});ok(r.sw<=r.cw+2,nm+': no side scroll');if(nm=='desk')ok(await p.evaluate(()=>{const c=document.getElementById('cel').getBoundingClientRect(),e=document.elementFromPoint(c.left+20,c.top+40);return document.getElementById('cel').contains(e)}),'desk: panel not under side nav');
 await p.screenshot({path:SH+nm+'_good.png'});
 await p.select('#celEv','3');await w_(400);const t3=await p.evaluate(()=>document.getElementById('cel').textContent);ok(/POOR ISOLATION|shoe/.test(t3)&&/centraliser/.test(t3),nm+': 1 per 3 joints shows shoe advice');
 await p.screenshot({path:SH+nm+'_poor.png'});await p.close()}
await b.close();ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no external writes');
console.log(`\n${pass} pass, ${fails} fail`);process.exit(fails?1:0)
