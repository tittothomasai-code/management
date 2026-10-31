// showroomc_test.mjs: Showroom C (detailed hero rig, pass-2 pack), desk + 390x844 phone. No network writes.
// node showroomc_test.mjs [base]. Prints PASS/FAIL and FPS. Selector A/B/C + perf readout checks run only when B's srpick/srperf hooks are present.
import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=(process.argv[2]||'http://localhost:8957').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'190_src_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0,skip=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};const sk=m=>{console.log('SKIP '+m);skip++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',protocolTimeout:240000,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],FPS={};
const MOCK=()=>{const B=()=>Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={id:'Mock Xbox Controller',index:0,connected:true,axes:[0,0,0,0],buttons:B(),mapping:'standard'};navigator.getGamepads=()=>[window.__pad,null,null,null];window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}};
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
for(const nm of ['desk','phone']){if(process.env.ONLY&&process.env.ONLY!=nm)continue;const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(VP[nm]);p.on('pageerror',e=>errs.push(nm+': '+e));await p.evaluateOnNewDocument(MOCK);
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase\.co|adaga|witsml/i.test(r.url())&&!/\.js(\?|$)/.test(r.url()))return r.abort();r.continue()});
 const idle=(t=60000)=>p.waitForFunction(()=>window.GX?.showroomC?.idle?.(),{timeout:t,polling:250}).then(()=>true).catch(()=>false);
 const rate=ms=>p.evaluate(ms=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<ms)requestAnimationFrame(f);else r(n*1000/(performance.now()-t0))};requestAnimationFrame(f)}),ms);
 const shot=n=>p.screenshot({path:SH+nm+'_'+n+'.png'});
 await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#st_showroom',{timeout:60000}).catch(()=>{});
 // baseline: Showroom A frame rate on the same box, same run
 await p.evaluate(()=>st_showroom.click());await p.waitForSelector('#showroom canvas',{timeout:30000}).catch(()=>{});await w(5000);FPS[nm+'_A']=await rate(5000);await p.evaluate(()=>GX.showroom.close());await w(500);await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#st_showroom',{timeout:60000}).catch(()=>{});await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#st_showroom',{timeout:60000}).catch(()=>{});
 // selector A/B/C (needs feat/showroom-b registry)
 const hasReg=await p.waitForFunction(()=>!!window.GX?.showroomAB?.register,{timeout:8000}).then(()=>true).catch(()=>false);
 if(hasReg){await p.waitForSelector('#srabStart button[data-ab=C]',{timeout:30000}).catch(()=>{});ok(await p.evaluate(()=>!!document.querySelector('#srabStart button[data-ab=C]')),nm+': selector shows C');ok(await p.evaluate(()=>GX.showroomAB.get()=='A'),nm+': default still A');
  await p.evaluate(()=>{const b=document.querySelector('#srabStart button[data-ab=C]');if(b)b.click()});ok(await p.evaluate(()=>GX.showroomAB.get()=='C'),nm+': selector sets C');ok(await p.evaluate(()=>GX.showroomAB.keys().join()=='A,B,C'),nm+': registry keys A,B,C');await p.evaluate(()=>GX.showroomAB.open())}
 else{sk(nm+': A/B/C selector (feat/showroom-b registry not in this build)');await p.evaluate(()=>GX.showroomC.open())}
 await p.waitForSelector('#showroomC canvas',{timeout:30000}).catch(()=>{});ok(await p.evaluate(()=>!!document.getElementById('showroomC')),nm+': Showroom C opens');
 ok(await idle(120000),nm+': rig loads and settles');
 const st=await p.evaluate(()=>{const C=GX.showroomC,S=C.ST;return {lod:S.lod,mb:S.mb,ms:S.loadMs,n:Object.keys(S.T).length,mapped:S.meshes.filter(m=>m.userData.path).length,meshes:S.meshes.length,bad:Object.keys(S.T).filter(k=>!S.nodes[k]).length,schema:S.man.schemaVersion,txt:document.getElementById('showroomC').textContent}});
 ok(nm=='phone'?/[LM]/.test(st.lod):st.lod=='H',nm+': LOD '+st.lod+' ('+st.mb+' MB, load '+st.ms+' ms)');ok(st.n>100&&st.bad==0,nm+': manifest tree '+st.n+' parts, all nodes found in GLB');ok(st.mapped==st.meshes,nm+': every mesh maps to a component ('+st.mapped+'/'+st.meshes+')');
 ok(/SIM/.test(st.txt)&&!/LIVE/.test(st.txt),nm+': SIM label, no LIVE');ok(!/codex|openai|gpt|claude|anthropic|gemini/i.test(st.txt),nm+': no AI provider name');
 await w(1500);FPS[nm]=await rate(5000);console.log('FPS',nm,FPS[nm].toFixed(1));console.log('FPS',nm,'A',FPS[nm+'_A'].toFixed(1),'C',FPS[nm].toFixed(1),'ratio',(FPS[nm]/FPS[nm+'_A']).toFixed(2));ok(FPS[nm]>=FPS[nm+'_A']*(nm=='phone'?.6:.3),nm+': C frame rate vs A ('+FPS[nm].toFixed(1)+' vs '+FPS[nm+'_A'].toFixed(1)+')');await shot('overview');
 // close-ups
 for(const [k,part] of [['top_drive','top_drive'],['bop','bop_stack'],['pumps','mud_pump_1'],['cabin','doghouse/driller_console']]){await p.evaluate(k=>document.querySelector(`#srcBar [data-pre=${k}]`).click(),k);await idle();
  const r=await p.evaluate(part=>{const S=GX.showroomC.ST;const d=S.cam.position.distanceTo(S.ctl.target);return {pre:S.preset,sel:S.sel,d}},part);ok(r.pre==k&&r.sel==part&&r.d<60,nm+': close-up '+k+' (sel '+r.sel+', dist '+r.d.toFixed(1)+' m)');await shot('cu_'+k)}
 // card + A/B/C drill-down
 await p.evaluate(()=>GX.showroomC.select('bop_stack'));let c=await p.evaluate(()=>({v:!srcCard.hidden,lv:srcCard.querySelector('h3 .lv').textContent,bom:srcCard.querySelector('.bom').textContent}));ok(c.v&&c.lv=='A'&&/DW1500\/bop_stack/.test(c.bom),nm+': card A level BOP, BOM '+c.bom);
 await p.evaluate(()=>[...srcCard.querySelectorAll('li button')].find(b=>/Accumulator/.test(b.textContent)).click());c=await p.evaluate(()=>({lv:srcCard.querySelector('h3 .lv').textContent,s:GX.showroomC.ST.sel}));ok(c.lv=='B'&&c.s=='bop_stack/accumulator',nm+': drill to B '+c.s);
 await p.evaluate(()=>srcCard.querySelector('li button').click());c=await p.evaluate(()=>({lv:srcCard.querySelector('h3 .lv').textContent,s:GX.showroomC.ST.sel}));ok(c.lv=='C'&&c.s=='bop_stack/accumulator/control_panel',nm+': drill to C '+c.s);await idle();await shot('card_C');
 if(nm=='desk'){const ov=await p.evaluate(()=>{const S=GX.showroomC.ST,r=srcCard.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight});ok(ov,nm+': card stays in view')}
 // BOM table driven by manifest
 await p.evaluate(()=>srcBomB.click());const bm=await p.evaluate(()=>{const S=GX.showroomC.ST,nb=S.rig.lods[S.lod].nodeToBom,rows=[...srcBom.querySelectorAll('tr[data-p]')];return {rows:rows.length,n:Object.keys(nb).length,match:rows.every(r=>r.querySelector('td.b').textContent==nb[r.dataset.p]),on:srcBom.querySelector('tr.on')?.dataset.p}});
 ok(bm.rows==bm.n&&bm.match,nm+': BOM table '+bm.rows+' rows = manifest, ids match');ok(bm.on=='bop_stack/accumulator/control_panel',nm+': BOM row of selection is marked');
 await p.evaluate(()=>srcBom.querySelector('tr[data-p="mud_pump_2/fluid_end"]').click());ok(await p.evaluate(()=>GX.showroomC.ST.sel=='mud_pump_2/fluid_end'),nm+': BOM row click selects part');await idle();await shot('bom');await p.evaluate(()=>srcBomB.click());
 // keyboard + gamepad
 await p.keyboard.press('Escape');ok(await p.evaluate(()=>!GX.showroomC.ST.sel&&!!document.getElementById('showroomC')),nm+': Esc closes card first');
 await p.keyboard.press('1');await idle();ok(await p.evaluate(()=>GX.showroomC.ST.preset=='overview'),nm+': key 1 = overview');
 const pd=async i=>{await p.evaluate(i=>{__pad.buttons[i].pressed=true;__pad.buttons[i].value=1},i);await w(300);await p.evaluate(i=>{__pad.buttons[i].pressed=false;__pad.buttons[i].value=0},i);await w(250)};
 await pd(5);ok(await p.evaluate(()=>GX.showroomC.ST.preset=='top_drive'),nm+': pad RB next close-up');await pd(4);ok(await p.evaluate(()=>GX.showroomC.ST.preset=='overview'),nm+': pad LB back');
 const th0=await p.evaluate(()=>{const S=GX.showroomC.ST;return Math.atan2(S.cam.position.x-S.ctl.target.x,S.cam.position.z-S.ctl.target.z)});await p.evaluate(()=>__pad.axes[0]=.9);await w(700);await p.evaluate(()=>__pad.axes[0]=0);
 const th1=await p.evaluate(()=>{const S=GX.showroomC.ST;return Math.atan2(S.cam.position.x-S.ctl.target.x,S.cam.position.z-S.ctl.target.z)});ok(Math.abs(th1-th0)>.05,nm+': pad stick orbits');
 const d0=await p.evaluate(()=>GX.showroomC.ST.cam.position.distanceTo(GX.showroomC.ST.ctl.target));await p.keyboard.press('Equal');await p.keyboard.press('Equal');const d1=await p.evaluate(()=>GX.showroomC.ST.cam.position.distanceTo(GX.showroomC.ST.ctl.target));ok(d1<d0*.9,nm+': + key zooms in');
 ok(await p.evaluate(()=>{const r=document.getElementById('showroomC').getBoundingClientRect();return r.height>=innerHeight-1&&r.width>=innerWidth-1}),nm+': overlay full-screen (not mobile sheet)');if(nm=='phone'){const cv=await p.$('#showroomC canvas'),bx=await cv.boundingBox();const a0=th1;await p.touchscreen.touchStart(bx.width*.3,bx.height*.4);for(let i=1;i<=8;i++){await p.touchscreen.touchMove(bx.width*(.3+i*.05),bx.height*.4);await w(250)}await p.touchscreen.touchEnd();await w(2500);
  const a1=await p.evaluate(()=>{const S=GX.showroomC.ST;return Math.atan2(S.cam.position.x-S.ctl.target.x,S.cam.position.z-S.ctl.target.z)});ok(Math.abs(a1-a0)>.05,nm+': swipe orbits');
  const cdp=await p.target().createCDPSession();const D=async(x1,x2)=>cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195-x1,y:400,id:1},{x:195+x1+x2,y:400,id:2}]});const z0=await p.evaluate(()=>GX.showroomC.ST.cam.position.distanceTo(GX.showroomC.ST.ctl.target));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:165,y:400,id:1},{x:225,y:400,id:2}]});for(let i=1;i<=8;i++){await D(30+i*12,0);await w(250)}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await w(2500);
  const z1=await p.evaluate(()=>GX.showroomC.ST.cam.position.distanceTo(GX.showroomC.ST.ctl.target));ok(z1<z0*.95,nm+': pinch zooms in ('+z0.toFixed(1)+' -> '+z1.toFixed(1)+')')}
 // explode / inspect
 await p.keyboard.press('1');await idle();await p.keyboard.press('x');await idle();const ex=await p.evaluate(()=>{const S=GX.showroomC.ST;return S.top.reduce((a,k)=>a+S.nodes[k].position.distanceTo(S.home[k]),0)/S.top.length});ok(ex>4,nm+': explode moves parts apart (avg '+ex.toFixed(1)+' m)');
 await p.evaluate(()=>GX.showroomC.select('drawworks'));await w(400);await shot('explode');await pd(3);await idle();await p.waitForFunction(()=>{const S=GX.showroomC.ST;return S.top.reduce((a,k)=>a+S.nodes[k].position.distanceTo(S.home[k]),0)<.01},{timeout:30000,polling:300}).catch(()=>{});const ex2=await p.evaluate(()=>{const S=GX.showroomC.ST;return S.top.reduce((a,k)=>a+S.nodes[k].position.distanceTo(S.home[k]),0)});ok(ex2<.01,nm+': pad Y re-assembles');await p.evaluate(()=>GX.showroomC.select(null));
 // night
 await p.keyboard.press('n');await w(800);const nt=await p.evaluate(()=>{const S=GX.showroomC.ST;return {n:S.night,lights:S.lights.length,e:S.lights[0]?.emissiveIntensity,lamps:S.lamps.filter(l=>l.intensity>0).length,scr:S.screens.length,sun:S.sun.intensity}});
 ok(nt.n&&nt.lights>0&&nt.e>=5&&nt.lamps>0&&nt.sun<.2,nm+': night: rig lights on ('+nt.lamps+' lamps, emissive '+nt.e+'), sun down');ok(nt.scr>0,nm+': cabin HMI screens glow ('+nt.scr+' materials)');
 FPS[nm+'_night']=await rate(4000);console.log('FPS',nm,'night',FPS[nm+'_night'].toFixed(1));await shot('night');await p.evaluate(()=>GX.showroomC.preset('cabin'));await idle();await shot('night_cabin');await p.evaluate(()=>GX.showroomC.preset('overview'));await idle();
 // perf readout (srperf.js from feat/showroom-b)
 if(await p.evaluate(()=>!!window.GX?.srperf?.attach)){await p.waitForFunction(()=>window.srpBtn&&window.srpBox,{timeout:15000}).catch(()=>{});ok(await p.evaluate(()=>!!document.querySelector('#showroomC #srpBtn')&&srpBox.hidden),nm+': C perf readout attached, off by default');
  await p.keyboard.press('p');await w(2500);const q=await p.evaluate(()=>({s:GX.srperf.stats(),t:srpBox.textContent,vis:!srpBox.hidden}));ok(q.vis&&q.s.id=='C'&&q.s.mb>0&&q.s.loadMs>0&&q.s.fps>0&&q.s.lod==GX.showroomC.ST.lod&&/FPS/.test(q.t)&&/MB/.test(q.t)&&/LOD/.test(q.t),nm+': P shows C perf ('+JSON.stringify(q.s)+')');FPS[nm+'_srperf']=q.s;await shot('perf');await p.keyboard.press('p');ok(await p.evaluate(()=>srpBox.hidden),nm+': P hides it')}
 else sk(nm+': srperf overlay (feat/showroom-b srperf.js not in this build)');
 // close
 await p.evaluate(()=>GX.showroomC.select(null));await p.keyboard.press('Escape');await w(600);ok(await p.evaluate(()=>!document.getElementById('showroomC')),nm+': Esc closes Showroom C');ok(await p.evaluate(()=>!document.getElementById('srpBox')&&(!window.GX?.srperf||GX.srperf.stats()==null)),nm+': perf readout detached on close');
 await ctx.close()}
fs.writeFileSync(SH+'fps.json',JSON.stringify(FPS,null,1));
const E=errs.filter(e=>!/supabase|WebSocket|witsml|adaga|Failed to fetch/i.test(e));ok(E.length==0,'no page errors'+(E.length?': '+E.slice(0,3).join(' | '):''));
console.log(`\n${pass} passed, ${fails} failed, ${skip} skipped`);await b.close();process.exit(fails?1:0)
