// v5.11 casing-run 3D demo test (?demo=casing): opens, SIM-labelled, joints advance, hookload/EMW sane, lands. No network writes.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'127_casing_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(r.method()!='GET'&&!/localhost|robotyx/.test(u))bad.push(u);if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});
 await p.goto(BASE+'/?demo=casing',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.dwOps&&document.getElementById('ops3d'),{timeout:90000}).catch(()=>{});
 ok(await p.evaluate(()=>!!window.dwOps),nm+': ?demo=casing opens ops 3D');ok(!(await p.$('#start .tile')),nm+': start menu skipped');
 const tx=await p.evaluate(()=>ops3d.innerText);ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx),nm+': labelled SIM, never LIVE');
 await w(2500);const T=await p.evaluate(()=>dwOps.P.T);ok(T>60,nm+': timeline '+Math.round(T)+' s, '+await p.evaluate(()=>dwOps.P.N)+' joints');
 for(const [f,lab] of [[0.02,'1_surface'],[0.5,'2_mid'],[1.01,'3_landed']]){await p.evaluate(t=>dwOps.seek(t),T*f);await w(1200);
  const s=await p.evaluate(()=>{const s=dwOps.last;return {j:s.joints,md:s.shoeMD,hl:s.hl,emw:s.emw,ph:s.phase}});console.log(' ',lab,JSON.stringify(s));
  ok(s.hl>0&&isFinite(s.emw)&&s.emw>1&&s.emw<2.5,nm+' '+lab+': hookload '+Math.round(s.hl)+' kN, EMW '+s.emw.toFixed(2)+' SG');
  if(lab=='3_landed')ok(s.ph=='landed'&&s.md>1000,nm+': landed at '+Math.round(s.md)+' m MD');if(lab=='2_mid')ok(s.j>3,nm+': joints advance ('+s.j+')');
  await p.screenshot({path:SH+lab+'_'+nm+'.png'})}
 const nan=await p.evaluate(()=>/NaN|undefined/.test(ops3d.innerText));ok(!nan,nm+': no NaN/undefined in HUD');
 if(nm=='phone')ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no horizontal overflow');
 await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no external writes / witsml / supabase '+bad.slice(0,2).join());
console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
