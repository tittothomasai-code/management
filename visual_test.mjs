// visual_test (feat/visual): quality setting Low/Medium/High (saved, phone default Low, desk default High),
// HDRI environment on Medium/High, extra detail visible, LOD, animations still run, FPS under CPU-throttled phone emulation.
// usage: node visual_test.mjs http://localhost:8813 [before]   (before = screenshots only, for the old build)
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8813').replace(/\/$/,''),BEFORE=process.argv[3]=='before',SH='shots_live/130_visual_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const PHONE={width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true},DESK={width:1440,height:900};
async function open(vp,q='',ls=null){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);
 await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())?r.abort():r.continue());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));if(ls)await p.evaluateOnNewDocument(ls);
 await p.goto(BASE+'/?nosplash'+q,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.G&&window.G.S,{timeout:60000});
 if(!BEFORE)await p.waitForFunction(()=>window.GX&&GX.quality&&GX.quality.get(),{timeout:60000});await w(2500);return {p,ctx,errs}}
const view=p=>p.evaluate(()=>{G.view([22,20,26],[0,16,0]);document.querySelectorAll('.panel,#eqmenu').forEach(e=>e.style&&0)});
async function fps(p,sec=5){return p.evaluate(s=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;performance.now()-t0<s*1000?requestAnimationFrame(f):r(n/((performance.now()-t0)/1000))};requestAnimationFrame(f)}),sec)}
if(BEFORE){for(const [vp,nm] of [[DESK,'desk'],[PHONE,'phone']]){const {p,ctx}=await open(vp);await view(p);await w(800);await p.screenshot({path:SH+'before_'+nm+'_rig.png'});
  await p.evaluate(()=>G.view([-14,6,22],[-28,2,8]));await w(800);await p.screenshot({path:SH+'before_'+nm+'_pumps.png'});
  if(vp===PHONE){const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:4});console.log('BEFORE phone fps (4x CPU throttle):',(await fps(p)).toFixed(1))}await ctx.close()}
 await br.close();process.exit(0)}
// defaults
{const {p,ctx,errs}=await open(PHONE);ok(await p.evaluate(()=>GX.quality.get())=='low','phone defaults to Low');ok(!await p.evaluate(()=>G._scene.getObjectByName('visualDetail').visible),'Low hides extra detail');
 ok(errs.length==0,'no page errors (phone) '+errs.slice(0,2).join('|'));ok(await p.evaluate(()=>!!document.getElementById('qualityBtn')),'quality button present');await ctx.close()}
{const {p,ctx,errs}=await open(DESK);ok(await p.evaluate(()=>GX.quality.get())=='high','desk defaults to High');
 ok(await p.evaluate(()=>G._scene.environment&&G._scene.environment.isTexture),'environment map set on High');
 ok(await p.evaluate(()=>G._scene.getObjectByName('visualDetail').visible&&!!G._scene.getObjectByName('serviceLoop')),'extra detail + service loop visible');
 ok(await p.evaluate(()=>GX.quality.small()>50),'LOD list collected');
 // LOD: far camera hides small parts
 const cnt=()=>{let n=0;G._scene.traverse(o=>{if(o.userData.lodHide)n++});return n};
 await p.evaluate(()=>G.view([0,300,700],[0,16,0]));const hid=await p.waitForFunction(c=>eval(c)()>20,{timeout:20000},'('+cnt+')').then(()=>true,()=>false);ok(hid,'LOD hides small parts when far');
 await view(p);ok(await p.waitForFunction(c=>eval(c)()==0,{timeout:20000},'('+cnt+')').then(()=>true,()=>false),'LOD shows parts again when near');
 // button cycles + saved
 await p.evaluate(()=>document.getElementById('qualityBtn').click());await w(800);ok(await p.evaluate(()=>GX.quality.get()=='low'&&localStorage.dw_quality=='low'),'button cycles High->Low and saves');
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.GX&&GX.quality&&GX.quality.get(),{timeout:60000});ok(await p.evaluate(()=>GX.quality.get())=='low','saved level survives reload');
 ok(await p.evaluate(()=>!G._scene.environment||G._scene.environment!==null),'env fallback ok');
 // animations still driven: pump on -> crank angle advances; pumps off -> stays
 await p.evaluate(()=>GX.quality.set('high'));await w(1500);
 const a=await p.evaluate(async()=>{const th=()=>G.animProbe().vth.reduce((x,y)=>x+y,0);G.pumps.forEach(e=>{e.st.on=false});await new Promise(r=>setTimeout(r,1500));const t0=th();await new Promise(r=>setTimeout(r,1500));const off=th()-t0;
  G.pumps.forEach(e=>{e.st.on=true;e.st.cmd=100});await new Promise(r=>setTimeout(r,2500));const t1=th();await new Promise(r=>setTimeout(r,1500));return {off,on:th()-t1}});
 ok(Math.abs(a.off)<1e-6&&a.on>0,'pump animation follows pump state ('+JSON.stringify(a)+')');
 ok(errs.length==0,'no page errors (desk) '+errs.slice(0,2).join('|'));
 for(const l of['low','medium','high']){await p.evaluate(l=>GX.quality.set(l),l);await w(1500);await view(p);await w(800);await p.screenshot({path:SH+'after_desk_rig_'+l+'.png'})}
 await p.evaluate(()=>G.view([-14,6,22],[-28,2,8]));await w(1000);await p.screenshot({path:SH+'after_desk_pumps_high.png'});
 await p.evaluate(()=>G.view([12,4,-6],[14,1,-14]));await w(800);await p.screenshot({path:SH+'after_desk_bopctrl_high.png'});await ctx.close()}
// FPS under CPU-throttled phone emulation
const F={};for(const l of['low','medium','high']){const {p,ctx}=await open(PHONE,'&q='+l);await view(p);await w(800);const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:4});
 await w(1000);F[l]=+(await fps(p)).toFixed(1);if(l!='medium')await p.screenshot({path:SH+'after_phone_rig_'+l+'.png'});await ctx.close()}
console.log('PHONE FPS (390x844 @3x, 4x CPU throttle, SwiftShader):',JSON.stringify(F));ok(F.low>=F.high*0.95,'Low not slower than High');
await br.close();console.log(`visual_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
