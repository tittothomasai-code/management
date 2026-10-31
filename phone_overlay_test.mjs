// v5.12.5.3 phone overlay test: full-screen overlays are not squashed into a mobile.js bottom sheet (390x844). Optional arg 2: screenshot dir.
let pass=0,fail=0;
import puppeteer from 'puppeteer-core';
const B=process.argv[2],SD=process.argv[3]||'';const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const L=[['ddc','ddcab.js?v=r2'],['ddTracks','ddtracks.js?v=t2'],['safetyW','safety.js?v=s1'],['showroom','showroom.js?v=b18'],['showroomC','showroomc.js?v=c8'],['syncP','sitesync.js?v=y1'],['mon','monitor.js?v=b11'],['wo','workover.js?v=b15']];
for(const [id,mod] of L){const c=await br.createBrowserContext();const p=await c.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
try{await p.goto(B+'/?nosplash=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.wplan,{timeout:120000});
await p.evaluate(async m=>{const x=await import('./'+m);if(x.init)try{x.init()}catch(e){};await x.open()},mod);await new Promise(r=>setTimeout(r,15000));
const r=await p.evaluate(i=>{const e=document.getElementById(i);if(!e)return 'missing';const b=e.getBoundingClientRect();return {sh:e.classList.contains('msheet'),y:b.y|0,h:b.height|0}},id);const good=r!='missing'&&!r.sh&&r.y==0&&r.h>=840;good?pass++:fail++;console.log((good?'PASS ':'FAIL ')+id+' full screen, not a sheet '+JSON.stringify(r));
if(SD)await p.screenshot({path:`${SD}/phone_overlay_${id}.png`})}catch(e){fail++;console.log('FAIL '+id,'ERR',e.message.slice(0,120))}await c.close()}
await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)

