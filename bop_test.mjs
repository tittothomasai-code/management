// bop_test (helper B): BOP test SIM (stage 1+2): API 53 criteria, drawdown (Boyle), closing times, panel + 3D hooks. Shots 132_bop_*.
import puppeteer from 'puppeteer-core';import * as B from './bop.js';
const BASE=(process.argv[2]||'http://localhost:8812').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'132_bop_');let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const lo=B.evaluate(B.pressureTest({target:300}),'low'),loL=B.evaluate(B.pressureTest({target:300,leak:8}),'low'),loBad=B.evaluate(B.pressureTest({target:400}),'low');
ok(lo.pass&&lo.dur>=5,'low 300 psi, no leak: PASS, hold ≥5 min');ok(!loL.pass,'low with SIM leak: FAIL');ok(!loBad.pass&&/250–350/.test(loBad.why),'low at 400 psi: FAIL');
const hi=B.evaluate(B.pressureTest({target:7000}),'high'),hiL=B.evaluate(B.pressureTest({target:7000,leak:25}),'high');ok(hi.pass&&!hiL.pass,'high 7000 psi: PASS; with leak FAIL');
const ann=B.STACK.items[0],ram=B.STACK.items[1];ok(B.highTarget(ann)==3500&&B.highTarget(ram)==7000&&B.highTarget(ram,true)==10000,'high targets: annular 3500, ram 7000, initial ram 10000');
const d=B.drawdown();ok(d.pass&&d.final>=B.ACC.pre+200,`drawdown 16 bottles: final ${d.final.toFixed(0)} psi PASS`);ok(!B.drawdown({...B.ACC,bottles:6}).pass,'drawdown 6 bottles: FAIL');
ok(Math.abs(B.pAfter(B.ACC,0)-3000)<1e-6&&Math.abs(B.pAfter(B.ACC,1e9)-1000)<1e-6,'Boyle end points');ok(B.functionTest().every(f=>f.ok),'function test close times inside limits');
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[],ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);p.setDefaultTimeout(120000);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=bop&nosplash=1',{waitUntil:'load',timeout:180000});
 ok(await p.waitForFunction(()=>document.getElementById('bopP')?.style.display=='block'&&window.BOPSIM,{timeout:150000}).then(()=>true,()=>false),`${nm}: ?demo=bop opens the panel`);
 await p.waitForFunction(()=>window.GX?.bopG,{timeout:60000}).catch(()=>{});const h=await p.evaluate(()=>{BOPSIM.hook3D();return {g:!!GX.bopG,n:['bop_upr','bop_bsr','bop_lpr','bop_ann','bop_plug'].filter(n=>GX.bopG?.getObjectByName(n)).length}});ok(h.g&&h.n==5,`${nm}: 3D hooks (${h.n}/5)`);
 {const st=()=>p.evaluate(()=>{const G=GX.bopG,own=o=>{for(let q=o;q&&q!==G;q=q.parent)if(/^bop_/.test(q.name))return true;return false},b=[],r=[];G.traverse(o=>{if(o.isMesh)(own(o)?r:b).push(o.material)});return {on:BOPSIM.GH.on,nb:b.length,bodyGhost:b.filter(m=>m.transparent&&m.opacity<0.3).length,ramSolid:r.filter(m=>!m.transparent||m.opacity==1).length,nr:r.length,btn:document.getElementById('bopGhost')?.textContent}});
  let g=await st();ok(g.on&&g.nb>5&&g.bodyGhost==g.nb&&g.ramSolid==g.nr,`${nm}: cut-away on at open: ${g.bodyGhost}/${g.nb} body parts see-through, ${g.ramSolid}/${g.nr} rams/annular solid`);
  await p.evaluate(()=>{const G=GX.bopG,c=new GX.THREE.Vector3();G.getWorldPosition(c);G.updateMatrixWorld()});await p.screenshot({path:`${SH}${nm}_0_cutaway.png`});
  await p.$eval('#bopGhost',e=>e.click());g=await st();ok(!g.on&&g.bodyGhost==0&&/Cut-away/.test(g.btn),`${nm}: toggle → solid view restored (${g.btn})`);
  await p.$eval('#bopGhost',e=>e.click());g=await st();ok(g.on&&g.bodyGhost==g.nb&&/Solid/.test(g.btn),`${nm}: toggle → cut-away again`)}
 await p.$eval('#bopPlug',e=>e.click());await w(500);ok(await p.evaluate(()=>BOPSIM.ST.plug==2&&/landed/.test(document.getElementById('bopPlugSt').textContent)),`${nm}: test plug lands`);
 await p.$eval('#bopRun',e=>e.click());await w(800);let r=await p.evaluate(()=>({res:document.getElementById('bopRes').innerText,closed:BOPSIM.ST.closed.ann,sim:document.getElementById('bopSim').textContent,live:/\bLIVE\b/.test(document.getElementById('bopP').innerText)}));
 ok(/Annular preventer: low PASS · high PASS/.test(r.res)&&r.closed,`${nm}: annular low+high PASS, shown closed`);ok(r.sim=='SIM'&&!r.live,`${nm}: SIM label, no LIVE`);
 const x0=await p.evaluate(()=>GX.bopG.getObjectByName('bop_upr').children[1].position.x);await p.$eval('[data-c=upr]',e=>e.click());await w(3000);const x1=await p.evaluate(()=>GX.bopG.getObjectByName('bop_upr').children[1].position.x);ok(x1<x0-0.5,`${nm}: ram blocks close (${x0.toFixed(2)}→${x1.toFixed(2)})`);
 await p.screenshot({path:`${SH}${nm}_1_pressure.png`});
 await p.$eval('#bopLeak',e=>e.click());await p.$eval('#bopSel',e=>e.value='upr');await p.$eval('#bopRun',e=>e.click());await w(500);ok(/Upper pipe ram: low FAIL · high FAIL/.test(await p.evaluate(()=>document.getElementById('bopRes').innerText)),`${nm}: SIM leak → FAIL`);
 await p.$eval('#bopDDrun',e=>e.click());await w(500);ok(await p.evaluate(()=>document.getElementById('bopDDres')?.textContent=='PASS'),`${nm}: drawdown PASS in panel`);
 await p.evaluate(()=>document.getElementById('bopDD').scrollIntoView());await p.screenshot({path:`${SH}${nm}_2_drawdown.png`});
 ok(await p.evaluate(()=>document.getElementById('bopLo').getBoundingClientRect().right<=innerWidth),`${nm}: charts fit`);

 // ---- stage 2 ----
 await p.evaluate(()=>{BOPSIM.TR.save({})});await p.$eval('#uiBop',e=>e.click()).catch(()=>{});await w(1500);ok(await p.evaluate(()=>document.getElementById('bopP')?.style.display=='block'&&!!document.getElementById('uiBop')),`${nm}: Tools → BOP tests button opens the panel`);
 const cam=await p.evaluate(async()=>{const c0=G.cam.position.clone(),b=new (GX.THREE.Vector3)();GX.bopG.getWorldPosition(b);BOPSIM.flyTo('annular');await new Promise(r=>setTimeout(r,2500));return {d0:G.ctl.target.distanceTo(b),d1:G.cam.position.distanceTo(b)}});ok(cam.d0<6&&cam.d1<15,`${nm}: camera at the BOP stack (target ${cam.d0.toFixed(1)} m from stack, camera ${cam.d1.toFixed(1)} m)`);
 const cms=await p.$$eval('#bopSel option',o=>o.filter(x=>/^cm\d/.test(x.value)).length);ok(cms==6,`${nm}: 6 choke manifold valves listed one by one`);
 await p.$eval('#bopLeak',e=>e.checked=false);await p.$eval('#bopSel',e=>{e.value='cm5';e.onchange()});await p.$eval('#bopRun',e=>e.click());await w(400);ok(await p.evaluate(()=>/CM valve 5.*: low PASS · high PASS/.test(document.getElementById('bopRes').innerText)&&BOPSIM.RES.tests.cm5.hiT.target==5000),`${nm}: downstream CM valve 5 high test at 5000 psi PASS`);
 await p.$eval('#bopSel',e=>{e.value='kchk';e.onchange()});ok(await p.evaluate(()=>document.getElementById('bopDirL').style.display==''),`${nm}: check valve shows the direction choice`);
 await p.$eval('#bopDir',e=>e.value='pump');await p.$eval('#bopRun',e=>e.click());await w(400);ok(await p.evaluate(()=>/Kill line check valve: low FAIL[\s\S]*wellbore side/.test(document.getElementById('bopRes').innerText)),`${nm}: check valve from pump side → FAIL with reason`);
 await p.$eval('#bopDir',e=>e.value='wellbore');await p.$eval('#bopRun',e=>e.click());await w(400);ok(await p.evaluate(()=>/Kill line check valve: low PASS · high PASS/.test(document.getElementById('bopRes').innerText)),`${nm}: check valve from wellbore side → PASS`);
 await p.$eval('#bopAll',e=>e.click());await w(800);for(const id of ['ann','upr','bsr','lpr','hcr','kill'])await p.evaluate(i=>BOPSIM.setClosed(i,true),id);let du=await p.evaluate(()=>BOPSIM.dueStatus());ok(!du.p.overdue&&du.p.left>=20&&!du.f.overdue,`${nm}: after Run all, pressure test due in ${du.p.left} days`);
 for(let k=0;k<3;k++)await p.$eval('#bopDay',e=>e.click());du=await p.evaluate(()=>({d:BOPSIM.dueStatus(),t:document.getElementById('bopDue').innerText}));ok(du.d.p.overdue&&du.d.f.overdue&&/OVERDUE/.test(du.t),`${nm}: +21 SIM days → OVERDUE shown`);
 await p.evaluate(()=>document.getElementById('bopDue').scrollIntoView());await p.screenshot({path:`${SH}${nm}_3_due.png`});
 await p.evaluate(()=>{let b=false;navigator.getGamepads=()=>[{id:'SIM pad',axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i==1&&b,value:0}))}];window.__padB=v=>b=v});await w(200);await p.evaluate(()=>__padB(true));await w(600);await p.evaluate(()=>__padB(false));
 ok(await p.evaluate(()=>document.getElementById('bopP').style.display=='none'),`${nm}: gamepad B closes the panel`);
 await p.evaluate(()=>BOPSIM.TR.save({}));
 await p.evaluate(()=>BOPSIM_open());await p.$eval('#bopX',e=>e.click());ok(await p.evaluate(()=>document.getElementById('bopP').style.display=='none'),`${nm}: ✕ closes`);ok(await p.evaluate(()=>{let t=0;GX.bopG.traverse(o=>{if(o.isMesh&&o.material.transparent&&o.material.opacity<0.3)t++});return !BOPSIM.GH.on&&t==0}),`${nm}: close restores solid stack`);await ctx.close()}
ok(!EXT.length,'no Supabase/Adaga/WITSML requests');ok(!ERR.length,'no page errors '+ERR.slice(0,2));await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
