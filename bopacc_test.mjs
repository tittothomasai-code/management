// bopacc_test (helper B, batch6): bop ghost opacity fix + accumulator drawdown chart (SIM). Shots 170_bopacc_*.
import puppeteer from 'puppeteer-core';import * as B from './bop.js';
const BASE=(process.argv[2]||'http://localhost:8812').replace(/\/$/,''),SH='shots_live/170_bopacc_';let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
ok(B.GH.opacity>0.05&&B.GH.opacity<0.6,'ghost opacity factor in a visible range');ok(typeof B.drawDD=='function','drawDD exported');
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[],ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);p.setDefaultTimeout(120000);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=bop&nosplash=1',{waitUntil:'load',timeout:180000});
 ok(await p.waitForFunction(()=>document.getElementById('bopP')?.style.display=='block'&&window.BOPSIM,{timeout:150000}).then(()=>true,()=>false),`${nm}: panel opens`);
 await p.waitForFunction(()=>window.GX?.bopG,{timeout:60000}).catch(()=>{});
 const g=await p.evaluate(()=>{BOPSIM.hook3D();BOPSIM.ghost(true);const a=BOPSIM.ghostStats();BOPSIM.ghost(true);const a2=BOPSIM.ghostStats();BOPSIM.ghost(false);const b=BOPSIM.ghostStats();BOPSIM.ghost(true);const c=BOPSIM.ghostStats();return {a,a2,b,c}});
 ok(g.a.on&&g.a.ghost>0&&g.a.bad==0,`${nm}: ghost on: ${g.a.ghost}/${g.a.meshes} body meshes see-through, none invisible or opaque`);ok(g.a.ownTop>0,`${nm}: rams/annular drawn on top (${g.a.ownTop})`);
 ok(g.a2.ghost==g.a.ghost,`${nm}: ghost twice: no double fade`);ok(!g.b.on&&g.b.ghost==0&&g.b.ownTop==0,`${nm}: ghost off restores solid`);ok(g.c.ghost==g.a.ghost,`${nm}: ghost on again same`);
 await p.evaluate(()=>BOPSIM.flyTo?.('ram'));await w(800);await p.screenshot({path:SH+nm+'_1_ghost.png'});
 const d=await p.evaluate(()=>{const r=BOPSIM.runDrawdown();const c=document.getElementById('bopDDc');c.scrollIntoView();const x=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<x.length;i+=16)if(x[i]>120||x[i+1]>120)n++;return {pass:r.pass,n,res:document.getElementById('bopDDres').textContent,txt:document.getElementById('bopP').innerText}});
 ok(d.pass&&d.res=='PASS'&&d.n>200,`${nm}: drawdown chart drawn, PASS (${d.n} lit px)`);ok(/SIM/.test(d.txt)&&!/\bLIVE\b/.test(d.txt),`${nm}: SIM label, no LIVE`);await w(200);await p.screenshot({path:SH+nm+'_2_dd_pass.png'});
 const f=await p.evaluate(()=>{const r=BOPSIM.runDrawdown({...BOPSIM.ACC||{bottles:16,galEach:11,pre:1000,op:3000,minOp:1200},bottles:6});document.getElementById('bopDDc').scrollIntoView();return {pass:r.pass,res:document.getElementById('bopDDres').textContent}});
 ok(!f.pass&&f.res=='FAIL',`${nm}: 6 bottles: chart FAIL`);await w(200);await p.screenshot({path:SH+nm+'_3_dd_fail.png'});
 if(nm=='phone')ok(await p.evaluate(()=>document.getElementById('bopDDc').getBoundingClientRect().width<=innerWidth),'phone: chart fits width');await ctx.close()}
ok(!EXT.length,'no external data calls');ok(!ERR.length,'no page errors '+ERR.slice(0,2).join(' | '));await br.close();console.log(`bopacc_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
