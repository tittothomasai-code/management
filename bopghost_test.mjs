// bopghost_test (helper I): ghost/cut-away toggle shows the 3D ram blocks. Shots 133_bopghost_*.
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8836').replace(/\/$/,''),SH='shots_live/133_bopghost_';let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);
 p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=bop&nosplash=1',{waitUntil:'load',timeout:180000});
 ok(await p.waitForFunction(()=>document.getElementById('bopP')?.style.display=='block'&&window.BOPSIM&&window.GX?.bopG,{timeout:150000}).then(()=>true,()=>false),`${nm}: panel + stack ready`);
 ok(await p.evaluate(()=>!!document.getElementById('bopGhost')),`${nm}: ghost toggle in panel`);
 await p.$eval('#bopGhost',e=>e.click());await w(300);
 let r=await p.evaluate(()=>{let body=0,see=0,ramOpaque=true;GX.bopG.traverse(o=>{if(!o.isMesh)return;let own=false;for(let x=o;x;x=x.parent)if(/^bop_(upr|bsr|lpr|ann|plug)$/.test(x.name))own=true;const m=[].concat(o.material);if(own){if(/^bop_(upr|bsr|lpr)$/.test(o.parent?.name)&&m.some(q=>q.transparent&&q.opacity<1))ramOpaque=false}else{body++;if(m.every(q=>q.transparent&&q.opacity<0.5))see++}});return {body,see,ramOpaque,st:BOPSIM.ST.ghost}});
 ok(r.st&&r.body>0&&r.see==r.body,`${nm}: ghost on → ${r.see}/${r.body} body meshes see-through`);ok(r.ramOpaque,`${nm}: ram blocks stay solid`);
 await p.$eval('[data-c=upr]',e=>e.click()).catch(()=>{});await p.evaluate(()=>BOPSIM.flyTo&&BOPSIM.flyTo('ram'));await w(2500);
 await p.evaluate(()=>document.getElementById('bopP').style.opacity='0.15');await p.screenshot({path:`${SH}${nm}_on.png`});await p.evaluate(()=>document.getElementById('bopP').style.opacity='');
 await p.$eval('#bopGhost',e=>e.click());await w(300);
 r=await p.evaluate(()=>{let op=0,n=0;GX.bopG.traverse(o=>{if(o.isMesh&&o.userData.ghostM){n++;if(o.material===o.userData.ghostM)op++}});return {op,n,st:BOPSIM.ST.ghost}});
 ok(!r.st&&r.n>0&&r.op==r.n,`${nm}: ghost off → original materials back`);await ctx.close()}
ok(!ERR.length,'no page errors '+ERR.slice(0,2).join(' | '));await br.close();console.log(`bopghost ${pass}/${fail}`);process.exit(fail?1:0)
