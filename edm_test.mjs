// v5.9.2.4 EDM import test — synthetic fixtures only (made-up pad). Checks: node parser (xml + zip), browser worker import with progress,
// large file, no network upload, IMPORT tag (never LIVE), site datum, anti-collision flags, single-well view, start-menu tile.
import puppeteer from 'puppeteer-core';import fs from 'fs';import {pad} from './fixtures/mkedm.mjs';import {parseFile} from './edm.js';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/125_edm_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
const X=await parseFile('edm_pad.xml',ab(fs.readFileSync('fixtures/edm_pad.xml'))),Z=await parseFile('edm_pad.zip',ab(fs.readFileSync('fixtures/edm_pad.zip')));
ok(X.M.wells.length==4&&X.A.wbs.length==4,'xml: 4 wells, 4 wellbores with trajectories');ok(JSON.stringify(Z.A.wbs.map(b=>b.pts.at(-1)))==JSON.stringify(X.A.wbs.map(b=>b.pts.at(-1))),'zip gives the same model as xml');
ok(X.A.wbs.every(b=>b.kind=='definitive'),'definitive survey preferred over plan');ok(Math.abs(X.A.datum-35)<0.01&&Math.abs(X.A.wbs[1].shift-2)<0.01,'common site datum 35 m; 33 m well shifted 2.00 m');
ok(Math.abs(X.A.wbs[1].pts[0].E-30)<0.01,'slot offset 30 m east applied (ft→m)');ok(X.M.tag=='IMPORT','model tagged IMPORT');
const fl=X.A.ac.flags;ok(fl.some(f=>f.a==0&&f.b==1&&f.sf<1&&f.flag=='STOP <1.0'),'converging pair flagged STOP <1.0');ok(fl.some(f=>f.sf>=1&&f.sf<1.5&&f.flag=='WARN <1.5'),'WARN <1.5 flag present');
ok(X.M.casing.length==8&&X.M.casing.some(c=>Math.abs(c.shoe-1500)<0.01),'casing shoes extracted (m)');ok(X.M.bha[0].comps.length==2&&X.M.targets.length==4,'BHA + targets extracted');
const mz=await parseFile('m.xml',ab(Buffer.from(pad({wells:2}).replace(/md="([\d.]+)"/g,(a,v)=>`md="${(v*0.3048).toFixed(3)}"`))),{units:'m'});ok(Math.abs(mz.A.wbs[0].pts.at(-1).md-2950)<0.1,'units=m option keeps metres');
let bad=false;try{await parseFile('x.zip',new ArrayBuffer(10))}catch(e){bad=/zip/.test(e.message)}ok(bad,'corrupt zip → clear error');
const big=pad({wells:8,stations:120,extra:400000});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],posts=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(e.message));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))posts.push(r.method()+' '+r.url())});
 if(nm=='phone'){await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#st_edm',{timeout:60000});ok(true,'start menu has Import EDM tile');await w(500);await p.screenshot({path:SH+'0_tile.png'});
  await p.click('#st_edm');await p.waitForFunction(()=>window.GX?.edm&&getComputedStyle(document.getElementById('edm')).display!='none',{timeout:120000});await w(800);await p.screenshot({path:SH+'1_picker.png'})}
 else{await p.goto(BASE+'/?nosplash=1&edm=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.edm&&document.getElementById('edm'),{timeout:120000});await w(800)}
 const inp=await p.$('#edmf');await inp.uploadFile(nm=='phone'?'fixtures/edm_pad.zip':'fixtures/edm_pad.xml');
 await p.waitForFunction(()=>window.GX.edm.ST.R,{timeout:60000});await w(1500);
 const s=await p.evaluate(()=>{const R=GX.edm.ST.R,t=document.getElementById('edm').innerText;return {n:R.A.wbs.length,flags:R.A.ac.flags.length,tag:/IMPORT/.test(t),live:/\bLIVE\b/.test(t),c:!!document.querySelector('#edm3d canvas'),vis:document.getElementById('edm').getBoundingClientRect().height>100}});
 ok(s.n==4&&s.flags==2&&s.c&&s.vis,`${nm}: worker import → site 3D with 4 wellbores, 2 flags (${JSON.stringify(s)})`);ok(s.tag&&!s.live,`${nm}: IMPORT tag shown, never LIVE`);
 await p.screenshot({path:SH+nm+'_2_site3d.png'});
 await p.evaluate(()=>{GX.edm.ST.tab='ac';GX.edm.render()});await w(300);const ac=await p.evaluate(()=>document.getElementById('edm').innerText);ok(/STOP <1.0/.test(ac)&&/WARN <1.5/.test(ac)&&/not ISCWSA/.test(ac),`${nm}: AC table shows STOP/WARN and model caveat`);await p.screenshot({path:SH+nm+'_3_ac.png'});
 await p.evaluate(()=>{GX.edm.ST.tab='wells';GX.edm.render()});await w(200);await p.click('[data-pick="1"]');await w(300);await p.waitForFunction(()=>/SYN-2/.test(document.getElementById('edm').innerText)&&/RSS/.test(document.getElementById('edm').innerText),{timeout:30000,polling:100}).catch(()=>{});const sw=await p.evaluate(()=>document.getElementById('edm').innerText);ok(/SYN-2/.test(sw)&&/Intermediate/.test(sw)&&/RSS/.test(sw)&&/T-2/.test(sw),`${nm}: single-well pick shows trajectories, casing, BHA, target`);await p.screenshot({path:SH+nm+'_4_well.png'});
 if(nm=='desk'){const t0=Date.now();const r=await p.evaluate(async big=>{const buf=new TextEncoder().encode(big).buffer;const pr=[];const t=performance.now();let mx=0;const id=setInterval(()=>{const b=document.querySelector('#edmbar');if(b)pr.push(b.style.width)},50);
   GX.edm.ST.R=null;GX.edm.render();let frames=0,on=true,lt=performance.now(),gap=0;const f=()=>{if(on){const n=performance.now();gap=Math.max(gap,n-lt);lt=n;frames++;requestAnimationFrame(f)}};f();const R=await GX.edm.load('large.xml',buf);on=false;clearInterval(id);on=false;gap=Math.max(gap,performance.now()-lt);return {gap,ms:performance.now()-t,frames,n:R.A.wbs.length,pr:new Set(pr).size}},big);
  ok(r.n==8&&r.pr>=2,`large file (${(big.length/1e6).toFixed(0)} MB) parsed in worker with progress (${r.ms.toFixed(0)} ms, ${r.pr} progress steps, ${r.frames} UI frames during parse)`);ok(r.frames>5||(r.frames>=3&&r.gap<0.5*r.ms),`UI kept rendering during parse (worker, not main thread): ${r.frames} frames, longest gap ${r.gap.toFixed(0)} of ${r.ms.toFixed(0)} ms`);await p.screenshot({path:SH+'5_large_site.png'})}
 await p.close()}
ok(!posts.length,'no upload: zero non-GET requests ('+posts.slice(0,3)+')');ok(!errs.length,'no page errors '+errs.slice(0,3));
await b.close();console.log(`edm ${pass} pass, ${fail=fails} fail`);process.exit(fails?1:0);var fail;
