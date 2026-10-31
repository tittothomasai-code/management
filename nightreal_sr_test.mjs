// nightreal_sr_test (v5.12.1.3): Showroom B at night uses the realistic sky (GX.nightReal), old cartoon stars/flare hidden; user zoom.
// usage: node nightreal_sr_test.mjs http://localhost:8961   env SHOT prefix (default shots_live/195_nrsr_)
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8961').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'195_nrsr_');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
const A_MIN=3*Math.hypot(.6,.4,1.3); // Showroom A closest close-up: zoomMs offset with min size 3 m (showroom.js)
for(const nm of (process.env.ONLY?[process.env.ONLY]:['desk','phone'])){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(VP[nm]);
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())&&!/\.js(\?|$)/.test(r.url())?r.abort():r.continue());
 await p.goto(BASE+'/?nosplash',{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.GX&&GX.night&&window.G&&G._scene,{timeout:180000});
 await p.evaluate(async()=>{localStorage.setItem('dw_night','1');const m=await import('./showroomb.js?v=b3');await m.open(0)});
 await p.waitForFunction(()=>GX.showroomB?.ST?.grp&&GX.showroomB.idle?.(),{timeout:240000,polling:250}).catch(()=>{});
 await p.evaluate(()=>GX.showroomB.nightSet(true));await w(3000);
 const r=await p.evaluate(()=>{const B=GX.showroomB.ST,sc=B.scene,o=GX.nightReal?.objects(sc);const ly=B.layers[0].visible,fl=B.spots.some(s=>s.fl.visible),gh=B.ghosts.some(g=>g.visible);
  const rt=sc.getObjectByName('nightRoot');return {has:!!GX.nightReal&&typeof GX.nightReal.apply=='function',o,active:GX.nightReal?.active(sc),inScene:!!rt&&rt.parent===sc,ly,fl,gh,hemi:B.hemi.intensity,sky:sc.getObjectByName('nightSky')?.material?.opacity}});
 console.log(nm,JSON.stringify(r));
 ok(r.has,nm+': GX.nightReal registered');ok(r.active&&r.inScene&&r.o?.root,nm+': real night root in Showroom B scene');
 ok(r.o?.shader&&r.o?.aMag&&r.o?.moon,nm+': atmospheric sky shader, magnitude star field, moon');ok(r.sky>0.9,nm+': sky faded in ('+r.sky+')');
 ok(nm=='phone'?r.o?.lowq&&r.o.quality=='low':!r.o?.lowq&&r.o?.moonLight,nm+': quality '+r.o?.quality+(nm=='phone'?' (light phone sky)':' (+ moonlight)'));
 ok(!r.ly&&!r.fl&&!r.gh,nm+': old showroom dot stars, flare and lens ghosts hidden');ok(r.hemi<0.2,nm+': ambient dimmed to moonlight ('+r.hemi.toFixed(3)+')');
 await p.screenshot({path:SH+nm+'_B_night.png'});
 // day restores
 await p.evaluate(()=>GX.showroomB.nightSet(false));await w(1800);const d=await p.evaluate(()=>{const B=GX.showroomB.ST;return {root:B.scene.getObjectByName('nightRoot')?.visible,hemi:B.hemi.intensity}});
 ok(!d.root&&Math.abs(d.hemi-.9)<.01,nm+': day restores lights ('+d.hemi+')');await p.evaluate(()=>GX.showroomB.nightSet(true));await w(1500);
 // zoom
 const z0=await p.evaluate(()=>GX.showroomB.zoomInfo());ok(z0.min<=A_MIN,nm+': B min zoom '+z0.min+' m <= A close-up '+A_MIN.toFixed(2)+' m');
 if(nm=='desk'){const bx=await p.evaluate(()=>{const c=showroomB.querySelector('canvas').getBoundingClientRect();return [c.width/2,c.height/2]});await p.mouse.move(...bx);for(let k=0;k<25;k++){await p.mouse.wheel({deltaY:-240});await w(40)}}
 else{const c=await p.target().createCDPSession();const tp=(t,pts)=>c.send('Input.dispatchTouchEvent',{type:t,touchPoints:pts});for(let rep=0;rep<4;rep++){await tp('touchStart',[{x:150,y:420,id:1},{x:240,y:420,id:2}]);for(let k=1;k<=10;k++){await tp('touchMove',[{x:150-k*12,y:420,id:1},{x:240+k*12,y:420,id:2}]);await w(30)}await tp('touchEnd',[]);await w(100)}}
 await w(2500);const z1=await p.evaluate(()=>GX.showroomB.zoomInfo());console.log(nm,'zoom',JSON.stringify(z0),'->',JSON.stringify(z1));
 ok(z1.dist<z0.dist*0.6,nm+': '+(nm=='desk'?'wheel':'pinch')+' moves the camera closer ('+z0.dist+' -> '+z1.dist+' m)');
 await p.screenshot({path:SH+nm+'_B_closeup.png'});
 await p.evaluate(()=>{for(let k=0;k<40;k++)GX.showroomB.zoomBy(.6)});await w(2500);const z2=await p.evaluate(()=>GX.showroomB.zoomInfo());ok(z2.dist>=z2.min-0.3&&z2.dist<=A_MIN,nm+': closest zoom '+z2.dist+' m (limit '+z2.min+')');
 await p.evaluate(()=>srbZout.click());await w(1500);const z3=await p.evaluate(()=>GX.showroomB.zoomInfo());ok(z3.dist>z2.dist,nm+': on-screen zoom-out button works');
 await p.evaluate(()=>GX.showroomB.close());await w(500);
 ok(errs.length==0,nm+': no page errors '+errs.slice(0,2).join('|'));await ctx.close()}
await br.close();console.log(`nightreal_sr_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
