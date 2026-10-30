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
// v2: earth model hook + SIM fallback (node, no browser)
{const bad={formationIndex:()=>-1,geologyFn:()=>null};ok(!GS.useEarthModel(bad)&&/no "reservoir"/.test(GS.EM.why)&&GS.geology(0).top==GS.simGeology(0).top,'fallback: no reservoir in earth model -> SIM layer');
 const nan={formationIndex:()=>1,geologyFn:()=>x=>({top:NaN,base:NaN})};ok(!GS.useEarthModel(nan)&&/error/.test(GS.EM.why),'fallback: bad earth model values -> SIM layer');
 const fk={formationIndex:()=>3,geologyFn:()=>x=>({top:2500+x*0.03,base:2508+x*0.03,th:8,name:'Res A',lith:'sandstone'}),model:()=>({src:'SIM'})};ok(GS.useEarthModel(fk)&&GS.geology(100).top==2503&&GS.model().inZone>=0.9&&GS.model().sim,'earth model drop-in: geology(x) from geologyFn, path stays in layer, still SIM');
 ok(GS.isLiveSrc('WITSML')&&!GS.isLiveSrc('SIM')&&!GS.isLiveSrc('SIMULATED'),'SIM label stays unless the source is real data');GS.useEarthModel(null)}
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[],ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){
 const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=geosteer&nosplash=1',{waitUntil:'load',timeout:180000});
 const shown=await p.waitForFunction(()=>{const e=document.getElementById('gsP');return e&&e.style.display=='block'&&window.GX?.geosteer},{timeout:120000}).then(()=>true,()=>false);ok(shown,`${nm}: ?demo=geosteer opens the Geosteering demo panel`);
 await w(3000);await p.waitForFunction(()=>document.getElementById('gsCur')?.getBoundingClientRect().right>0,{timeout:20000}).catch(()=>{});let r=await p.evaluate(()=>{const P=document.getElementById('gsP'),q={width:innerWidth},cr=document.getElementById('gsCur').getBoundingClientRect();return {sim:document.getElementById('gsSim').textContent,live:/\bLIVE\b/.test(P.innerText),cur:document.getElementById('gsCur').getBoundingClientRect().width,w:q.width,sw:Math.round(cr.right),T:GX.geosteer.state().T,stat:document.getElementById('gsStat').textContent}});
 ok(r.sim=='SIM'&&!r.live,`${nm}: SIM label shown, no LIVE`);ok(r.sw<=r.w+1&&r.cur>300,`${nm}: fits the screen, curtain inside the screen (right edge ${r.sw}/${r.w})`);ok(r.T>2.5&&/(IN|OUT of) the layer/.test(r.stat),`${nm}: animation runs, bit IN/OUT status shown (thin target: OUT at times is real; in-zone % checked below) (${r.stat.slice(0,60)})`);
 await p.screenshot({path:`${SH}${nm}_1_start.png`});
 await p.click('#gsEnd');await w(800);r=await p.evaluate(()=>({n:document.querySelectorAll('#gsDec tr').length,top:document.querySelector('#gsDec tr')?.textContent}));ok(r.n>=20,`${nm}: End shows all steering decisions (${r.n})`);
 const em=await p.evaluate(()=>{const S=GX.strat,g=GX.geosteer,i=S.formationIndex('reservoir'),f=(S.targetFn||S.geologyFn)(i,g.EM.azi),G0=S.geologyFn(i,g.EM.azi)(300),T0=g.geology(300);return {tgt:g.EM.target,th:T0.th,gth:G0.base-G0.top,inG:T0.top>=G0.top-1e-9&&T0.base<=G0.base+1e-9,on:g.EM.on,name:g.EM.name,src:g.EM.src,d:Math.abs(g.geology(300).top-f(300).top),inz:g.M.inZone,txt:document.getElementById('gsGeo').innerText,why:g.EM.why}});
 ok(em.on&&em.d<1e-9,`${nm}: target layer comes from the earth model (${em.name}, src ${em.src}) ${em.why}`);ok(em.tgt&&em.th<8&&em.th<em.gth&&em.inG,`${nm}: geosteer uses the thin SIM target sub-layer (${em.th?.toFixed(1)} m in ${em.gth?.toFixed(0)} m gross)`);ok(em.inz>=0.8,`${nm}: path stays in the earth-model layer ${(100*em.inz).toFixed(0)}%`);ok(/from the earth model \(SIM\)/.test(em.txt)||/WITSML|EDM/.test(em.txt),`${nm}: panel names the target and source`);
 const ev=await p.evaluate(()=>{window.dispatchEvent(new CustomEvent('strat:bit',{detail:{formation:'Test shale',lith:'shale',md:1234,tvd:1200,src:'SIM'}}));return document.getElementById('gsGeo').innerText});ok(/entered Test shale \(shale\) at MD 1234/.test(ev),`${nm}: strat:bit event shown in the panel`);
 ok(await p.evaluate(()=>Array.isArray(GX.geosteer.EM.ahead)&&typeof GX.strat.lookAhead=='function'),`${nm}: lookAhead used (${await p.evaluate(()=>GX.geosteer.EM.ahead.length)} tops ahead)`);
 await p.screenshot({path:`${SH}${nm}_2_end.png`,fullPage:false});
 await p.click('#gsPlay');ok(await p.evaluate(()=>!GX.geosteer.state().play),`${nm}: Pause works`);await p.click('#gsRe');ok(await p.evaluate(()=>GX.geosteer.state().T<10),`${nm}: Restart goes back to the heel`);
 await p.click('#gsX');ok(await p.evaluate(()=>document.getElementById('gsP').style.display=='none'),`${nm}: ✕ closes the demo`);
 // no demo param: no panel
 await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:180000});await w(4000);ok(await p.evaluate(()=>!document.getElementById('gsP')),`${nm}: without ?demo=geosteer the demo does not open`);await ctx.close()}
ok(!EXT.length,'no Supabase/Adaga/WITSML requests '+EXT.slice(0,2));ok(!ERR.length,'no page errors '+ERR.slice(0,2));
await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
