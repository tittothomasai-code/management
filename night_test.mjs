// night_test (feat/night): Day/Night toggle on phone + desktop. HUD button, stars, moon, blinking beacon,
// lights by quality (Low = no real lights), smooth transition, scene-agnostic API on a second scene, fps on Low.
// usage: node night_test.mjs http://localhost:8877
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8877').replace(/\/$/,''),SH='shots_live/140_night_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const PHONE={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},DESK={width:1440,height:900};
async function open(vp,q=''){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);
 await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())?r.abort():r.continue());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 for(let i=0;i<3;i++){try{await p.goto(BASE+'/?nosplash'+q,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.GX&&GX.night&&GX.quality&&GX.quality.get()&&document.getElementById('nightBtn'),{timeout:120000});break}catch(e){if(i==2)throw e;await w(3000)}}
 await w(2000);return {p,ctx,errs}}
const view=p=>p.evaluate(()=>G.view([30,22,42],[0,20,0]));
async function fps(p,sec=4){return p.evaluate(s=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;performance.now()-t0<s*1000?requestAnimationFrame(f):r(n/((performance.now()-t0)/1000))};requestAnimationFrame(f)}),sec)}
for(const [vp,nm] of [[DESK,'desk'],[PHONE,'phone']]){const {p,ctx,errs}=await open(vp);
 ok(await p.evaluate(()=>!GX.night.isOn()&&document.getElementById('nightBtn').textContent.includes('Day')),nm+': starts in Day, HUD button shows Day');
 await view(p);await w(600);await p.screenshot({path:SH+nm+'_day.png'});
 const r=await p.evaluate(()=>{const b=document.getElementById('nightBtn');return !!(b.closest('#uiTools')||b.closest('#hud'))&&!!document.getElementById('qualityBtn')&&b.parentElement===document.getElementById('qualityBtn').parentElement});ok(r,nm+': night button sits next to Quality in the HUD Tools menu');
 const mid=await p.evaluate(()=>new Promise(r=>{document.getElementById('nightBtn').click();const t0=performance.now();setTimeout(()=>r(performance.now()-t0<1200?GX.night.t():0.5),400)}));ok(mid>0&&mid<1,nm+': smooth transition in progress (t='+mid.toFixed(2)+')');
 await p.waitForFunction(()=>GX.night.stats().skyOpacity==1,{timeout:30000}).catch(()=>{});
 const s=await p.evaluate(()=>GX.night.stats());console.log(nm,JSON.stringify(s));
 ok(s.on&&s.t==1,nm+': night on after toggle');ok(s.stars>=500&&s.skyOpacity==1,nm+': starfield + night sky present ('+s.stars+' stars)');ok(s.moon,nm+': moon present');
 ok(await p.evaluate(()=>document.getElementById('nightBtn').textContent.includes('Night')),nm+': button shows Night');
 const bl=await p.evaluate(async()=>{const a=new Set();for(let i=0;i<24;i++){a.add(GX.night.stats().beaconOn);await new Promise(r=>setTimeout(r,90))}return [...a]});ok(bl.length==2,nm+': red crown beacon blinks ('+bl+')');
 const names=await p.evaluate(()=>{const c={};G._scene.getObjectByName('nightRoot').traverse(o=>{c[o.name]=(c[o.name]||0)+1});return c});
 ok(names.nightFlood>=4&&names.nightDerrick>=4&&names.nightCrown>=4&&names.nightBeacon==1&&names.nightWork>=4&&names.nightPool>=2,nm+': flood, derrick, crown, beacon, work lights, pools ('+JSON.stringify(names)+')');
 await view(p);await w(500);await p.screenshot({path:SH+nm+'_night_'+s.quality+'.png'});
 ok(await p.evaluate(()=>localStorage.dw_night=='1'),nm+': state saved');
 // lights by quality
 const L={};for(const q of['low','medium','high']){await p.evaluate(q=>GX.quality.set(q),q);await w(1500);L[q]=await p.evaluate(()=>GX.night.stats())}
 console.log(nm,'lights by quality',JSON.stringify(Object.fromEntries(Object.entries(L).map(([k,v])=>[k,[v.lights,v.shadowLights,v.sprites,v.stars]]))));
 ok(L.low.lights==0&&L.low.shadowLights==0,nm+': Low has no real lights (sprites only)');ok(L.medium.lights>L.low.lights&&L.medium.shadowLights==0,nm+': Medium adds unshadowed lights');
 ok(L.high.lights>L.medium.lights&&L.high.shadowLights<=1&&L.high.sprites>L.medium.sprites,nm+': High adds lights, 1 shadow max, glow halos');
 ok(L.high.t==1&&L.low.on,nm+': night kept across quality change');
 if(nm=='desk'){await view(p);await w(600);await p.screenshot({path:SH+'desk_night_high.png'});await p.evaluate(()=>G.view([-10,9,14],[0,8,0]));await w(600);await p.screenshot({path:SH+'desk_night_floor_high.png'})}
 // scene-agnostic API: a second scene (showroom style)
 const sa=await p.evaluate(async()=>{const T=await import('./vendor/three.module.js');const sc=new T.Scene();const rig=new T.Group();rig.add(new T.Mesh(new T.BoxGeometry(4,30,4)));sc.add(rig);sc.add(new T.HemisphereLight(0xffffff,0x333333,1));
  await GX.night.set(true,sc,rig,{quality:'low',dur:200});const a=GX.night.stats(sc);const main=GX.night.isOn();await GX.night.toggle(sc,null,{dur:100});const b=GX.night.stats(sc);GX.night.dispose(sc);return {a,b,main,gone:!sc.getObjectByName('nightRoot')}});
 ok(sa.a.on&&sa.a.t==1&&sa.a.lights==0&&sa.b.t==0&&sa.main&&sa.gone,nm+': API works on a separate scene, main untouched, dispose cleans up');
 // back to day
 await p.evaluate(()=>GX.night.toggle());await p.waitForFunction(()=>GX.night.t()==0,{timeout:20000}).catch(()=>{});
 ok(await p.evaluate(()=>!GX.night.isOn()&&!G._scene.getObjectByName('nightRoot').visible),nm+': back to Day hides night objects');
 ok(errs.length==0,nm+': no page errors '+errs.slice(0,2).join('|'));
 // reload keeps night (saved)
 if(nm=='phone'){await p.evaluate(()=>GX.night.set(true,null,null,{instant:true}));await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.GX&&GX.night&&document.getElementById('nightBtn'),{timeout:120000});await w(1500);ok(await p.evaluate(()=>GX.night.isOn()),'phone: saved night survives reload');await p.evaluate(()=>localStorage.dw_night='0')}
 await ctx.close()}
// fps on Low (phone, 4x CPU throttle): night not much slower than day
const F={};for(const n of['0','1']){let best=0;for(let k=0;k<2;k++){const {p,ctx}=await open(PHONE,'&q=low&night='+n);await view(p);const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:4});await w(1000);best=Math.max(best,await fps(p));if(n=='1'&&k==0)await p.screenshot({path:SH+'phone_night_low.png'});await ctx.close()}F[n=='1'?'night':'day']=+best.toFixed(1)}
console.log('PHONE Low FPS (4x CPU throttle):',JSON.stringify(F));ok(F.night>=F.day*0.8,'Low: no fps collapse at night');
await br.close();console.log(`night_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
