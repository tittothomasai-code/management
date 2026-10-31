// night_real_test (feat/night-real): realistic night sky + restrained rig lighting. usage: node night_real_test.mjs http://localhost:8891
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8891').replace(/\/$/,''),SH='shots_live/180_after_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const PHONE={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},DESK={width:1440,height:900};
async function open(vp,q=''){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);
 await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())?r.abort():r.continue());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 for(let i=0;i<3;i++){try{await p.goto(BASE+'/?nosplash'+q,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.GX&&GX.night&&window.G&&G._scene,{timeout:120000});break}catch(e){if(i==2)throw e;await w(3000)}}
 await w(2500);return {p,ctx,errs}}
async function fps(p,sec=4){return p.evaluate(s=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;performance.now()-t0<s*1000?requestAnimationFrame(f):r(n/((performance.now()-t0)/1000))};requestAnimationFrame(f)}),sec)}
for(const [vp,nm] of [[DESK,'desk'],[PHONE,'phone']]){const {p,ctx,errs}=await open(vp);
 await p.evaluate(()=>G.view([30,22,42],[0,20,0]));
 const env0=await p.evaluate(()=>{let v=null;G._scene.traverse(o=>{if(v==null&&o.material&&o.material.envMapIntensity!=null&&o.material.envMap!==undefined)v=o.material.envMapIntensity});return v});
 await p.evaluate(()=>GX.night.set(true,null,null,{instant:true}));await w(1500);
 const r=await p.evaluate(()=>{const sc=G._scene,st=sc.getObjectByName('nightStars'),sk=sc.getObjectByName('nightSky');const mg=st.geometry.attributes.aMag?Array.from(st.geometry.attributes.aMag.array):[];
  const sat=c0=>{const h=c0.getHexString(),c={r:parseInt(h.slice(0,2),16)/255,g:parseInt(h.slice(2,4),16)/255,b:parseInt(h.slice(4,6),16)/255};const mx=Math.max(c.r,c.g,c.b),mn=Math.min(c.r,c.g,c.b);return mx?(mx-mn)/mx:0};let maxSat=0;sc.getObjectByName('nightRoot').traverse(o=>{if(o.isSprite&&o.name!='nightBeacon'&&o.name!='nightMoon'&&!(o.name=='nightHalo'&&o.material.color.r>0.9&&o.material.color.g<0.3))maxSat=Math.max(maxSat,sat(o.material.color))});
  const tw=st.material.uniforms&&st.material.uniforms.uT;
  return {shader:!!(sk&&sk.material.isShaderMaterial&&sk.material.uniforms.uMW),stars:mg.length,faint:mg.filter(m=>m>4).length/mg.length,bright:mg.filter(m=>m<1).length,tw:!!tw,maxSat:+maxSat.toFixed(2),cls:document.body.classList.contains('dw-night'),moon:!!sc.getObjectByName('nightMoon'),q:GX.night.stats().quality}});
 console.log(nm,JSON.stringify(r));
 ok(r.shader,nm+': atmospheric sky shader with Milky Way term');ok(r.stars>=1500,nm+': star field '+r.stars);
 ok(r.faint>0.6&&r.bright>=1&&r.bright<40,nm+': magnitude distribution (faint '+(r.faint*100).toFixed(0)+'%, <1 mag '+r.bright+')');
 ok(r.tw,nm+': scintillation uniform');ok(r.maxSat<0.4,nm+': light colours restrained (max saturation '+r.maxSat+')');ok(r.cls&&r.moon,nm+': night class + moon');
 await w(500);await p.screenshot({path:SH+nm+'_night.png'});
 const env1=await p.evaluate(()=>{let v=null;G._scene.traverse(o=>{if(v==null&&o.material&&o.material.envMapIntensity!=null&&o.material.envMap!==undefined)v=o.material.envMapIntensity});return v});
 ok(env0==null||env1<env0*0.3,nm+': image-based light dimmed at night ('+env0+' -> '+env1+')');
 await p.evaluate(()=>GX.night.set(false,null,null,{instant:true}));await w(800);
 const env2=await p.evaluate(()=>{let v=null;G._scene.traverse(o=>{if(v==null&&o.material&&o.material.envMapIntensity!=null&&o.material.envMap!==undefined)v=o.material.envMapIntensity});return v});
 ok(env0==null||Math.abs(env2-env0)<1e-6,nm+': day restores image-based light');ok(await p.evaluate(()=>!document.body.classList.contains('dw-night')),nm+': night class removed in day');
 await p.screenshot({path:SH+nm+'_day.png'});
 ok(errs.length==0,nm+': no page errors '+errs.slice(0,2).join('|'));await ctx.close()}
// phone fps Low 4x throttle: night within 10 % of day
const F={};for(const n of['0','1']){let best=0;for(let k=0;k<2;k++){const {p,ctx}=await open(PHONE,'&q=low&night='+n);await p.evaluate(()=>G.view([30,22,42],[0,20,0]));const c=await p.target().createCDPSession();await c.send('Emulation.setCPUThrottlingRate',{rate:4});await w(1000);best=Math.max(best,await fps(p));await ctx.close()}F[n=='1'?'night':'day']=+best.toFixed(1)}
console.log('PHONE Low FPS (4x CPU throttle):',JSON.stringify(F));ok(F.night>=F.day*0.9,'phone Low: night fps within 10% of day');
await br.close();console.log(`night_real_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
