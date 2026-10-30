// geosteer_test (helper B): ?demo=geosteer opens a SIM geosteering demo: target layer top/base, well path in the layer, gamma + resistivity, decisions. No LIVE label, no network. Shots 131_geosteer_*.
import puppeteer from 'puppeteer-core';import * as GS from './geosteer.js';
const BASE=(process.argv[2]||'http://localhost:8812').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'131_geosteer_');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
// pure model
const M=GS.model();ok(M.sim&&M.st.length>100&&M.dec.length>=20,`model: ${M.st.length} stations, ${M.dec.length} decisions, SIM`);
ok(M.inZone>=0.9,`model: well path stays in the target layer ${(100*M.inZone).toFixed(0)}% of length (>=90%)`);
const acts=new Set(M.dec.map(d=>d.act));ok(acts.has('Rotate, hold')&&[...acts].some(a=>/down/.test(a)),`model: decisions include hold and steer actions [${[...acts]}]`);
const f=M.dec.find(d=>d.x>=520&&/down/.test(d.act));ok(!!f,`model: after the SIM fault (x=520 m) the geosteerer steers down (${f&&f.md.toFixed(0)} m MD)`);
ok(M.st.every((s,i)=>!i||Math.abs(s.inc-M.st[i-1].inc)<=GS.MAXB*GS.STEP/30+1e-9),'model: inclination change is never more than the build limit');
ok(M.st.every(s=>s.gr>0&&s.res>0),'model: gamma and resistivity are positive');
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[],ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){
 const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=geosteer&nosplash=1',{waitUntil:'load',timeout:180000});
 const shown=await p.waitForFunction(()=>{const e=document.getElementById('gsP');return e&&e.style.display=='block'&&window.GX?.geosteer},{timeout:120000}).then(()=>true,()=>false);ok(shown,`${nm}: ?demo=geosteer opens the Geosteering demo panel`);
 await w(3000);let r=await p.evaluate(()=>{const P=document.getElementById('gsP'),q={width:innerWidth},cr=document.getElementById('gsCur').getBoundingClientRect();return {sim:document.getElementById('gsSim').textContent,live:/\bLIVE\b/.test(P.innerText),cur:document.getElementById('gsCur').getBoundingClientRect().width,w:q.width,sw:Math.round(cr.right),T:GX.geosteer.state().T,stat:document.getElementById('gsStat').textContent}});
 ok(r.sim=='SIM'&&!r.live,`${nm}: SIM label shown, no LIVE`);ok(r.sw<=r.w+1&&r.cur>300,`${nm}: fits the screen, curtain inside the screen (right edge ${r.sw}/${r.w})`);ok(r.T>2.5&&/IN the layer/.test(r.stat),`${nm}: animation runs, bit in the layer (${r.stat.slice(0,60)})`);
 await p.screenshot({path:`${SH}${nm}_1_start.png`});
 await p.click('#gsEnd');await w(800);r=await p.evaluate(()=>({n:document.querySelectorAll('#gsDec tr').length,top:document.querySelector('#gsDec tr')?.textContent}));ok(r.n>=20,`${nm}: End shows all steering decisions (${r.n})`);
 await p.screenshot({path:`${SH}${nm}_2_end.png`,fullPage:false});
 await p.click('#gsPlay');ok(await p.evaluate(()=>!GX.geosteer.state().play),`${nm}: Pause works`);await p.click('#gsRe');ok(await p.evaluate(()=>GX.geosteer.state().T<10),`${nm}: Restart goes back to the heel`);
 await p.click('#gsX');ok(await p.evaluate(()=>document.getElementById('gsP').style.display=='none'),`${nm}: ✕ closes the demo`);
 // no demo param: no panel
 await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:180000});await w(4000);ok(await p.evaluate(()=>!document.getElementById('gsP')),`${nm}: without ?demo=geosteer the demo does not open`);await ctx.close()}
ok(!EXT.length,'no Supabase/Adaga/WITSML requests '+EXT.slice(0,2));ok(!ERR.length,'no page errors '+ERR.slice(0,2));
await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
