// casingtd_test (helper I): soft-string T&D while running casing (SIM). Model checks + ?demo=casing HUD.
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8836').replace(/\/$/,'');let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w8=ms=>new Promise(r=>setTimeout(r,ms));
globalThis.window=globalThis;globalThis.localStorage={getItem:()=>null,setItem(){}};
const T=await import('./casingtd.js');const O=await import('./ops3d.js');const w=O.well(),P=O.casingPlan(w),sh=P.s.shoeMD,o={kgm:P.kgm,mudSG:P.s.mudSG,odM:P.Dp,prevShoeMD:P.prev.shoeMD};
const r=T.casingTD(w,sh,o);ok(r.pu>r.rot&&r.rot>r.so,`PU ${r.pu.toFixed(0)} > ROT ${r.rot.toFixed(0)} > SO ${r.so.toFixed(0)} kN at ${sh.toFixed(0)} m`);
const z=T.casingTD(w,sh,{...o,muCH:0,muOH:0});ok(Math.abs(z.pu-z.so)<1e-6&&z.torque==0,'μ=0: PU = SO, no torque');
const v={at:md=>[0,0,md]},V=T.casingTD(v,1000,{kgm:70,mudSG:1.2,muCH:.3,muOH:.3});ok(Math.abs(V.pu-V.so)<1e-6&&Math.abs(V.rot-30-70*9.80665*(1-1.2/7.85))<0.01,'vertical: no drag, buoyed weight exact');
const hi=T.casingTD(w,sh,{...o,muOH:0.4});ok(hi.pu>r.pu&&hi.so<r.so&&hi.torque>r.torque,'more friction: more PU, less SO, more torque');
const b=T.broomstick(w,sh,o);ok(b.length>10&&b.every(q=>q['pu0.4']>=q['pu0.1']&&q['so0.4']<=q['so0.1']),'broomstick chart fans out with μ');
ok(isFinite(r.torque)&&r.torque>0,'rotating torque '+r.torque.toFixed(1)+' kN·m');
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=casing&nosplash=1',{waitUntil:'load',timeout:180000});const up=await p.waitForFunction(()=>window.dwOps&&/T&D/.test(document.getElementById('ops3d')?.innerText||''),{timeout:150000}).then(()=>true,()=>false);
 ok(up,nm+': HUD shows T&D (SIM)');await w8(4000);const t=await p.evaluate(()=>ops3d.innerText.match(/T&D[^\n]*\n?[^\n]*/)?.[0]||'');ok(/PU [\d,]+ · SO [\d,]+ · ROT [\d,]+ kN/.test(t)&&!/NaN/.test(t),nm+': '+t.replace(/\s+/g,' '));
 await p.screenshot({path:`shots_live/134_casingtd_${nm}.png`});await ctx.close()}
ok(!ERR.length,'no page errors '+ERR.slice(0,2).join(' | '));await br.close();console.log(`casingtd ${pass}/${fail}`);process.exit(fail?1:0)
