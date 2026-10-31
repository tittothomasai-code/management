// showroomb_test.mjs: Showroom B (arcade rig select) + Showroom A/B toggle, desk + 390x844 phone. No network writes.
// node showroomb_test.mjs [base]   env SHOT prefix. Prints PASS/FAIL lines and FPS (A vs B).
import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=(process.argv[2]||'http://localhost:8955').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'180_srb_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],FPS={};
const MOCK=()=>{const B=()=>Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={id:'Mock Xbox Controller',index:0,connected:true,axes:[0,0,0,0],buttons:B(),mapping:'standard'};
 navigator.getGamepads=()=>[window.__pad,null,null,null];window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}};
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
const only=process.env.ONLY;
for(const nm of ['desk','phone']){if(only&&only!=nm)continue;const vp=VP[nm];
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(nm+': '+e));await p.evaluateOnNewDocument(MOCK);
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase\.co|adaga|witsml/i.test(r.url())&&!/\.js(\?|$)/.test(r.url()))return r.abort();r.continue()});
 const idle=async(t=90000)=>p.waitForFunction(()=>window.GX?.showroomB?.idle?.(),{timeout:t,polling:250}).then(()=>true).catch(()=>false);
 const rate=async ms=>p.evaluate(ms=>new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<ms)requestAnimationFrame(f);else r(n*1000/(performance.now()-t0))};requestAnimationFrame(f)}),ms);
 // 1) start screen toggle, default A
 await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#st_showroom',{timeout:60000}).catch(()=>{});await p.waitForSelector('#srabStart',{timeout:20000}).catch(()=>{});
 ok(await p.evaluate(()=>!!document.getElementById('srabStart')),nm+': start screen has Showroom A/B toggle');
 ok(await p.evaluate(()=>srabSA.classList.contains('on')&&!srabSB.classList.contains('on')&&GX.showroomAB.get()=='A'),nm+': default is A');
 await p.evaluate(()=>st_showroom.click());await p.waitForSelector('#showroom canvas',{timeout:30000}).catch(()=>{});
 ok(await p.evaluate(()=>!!document.getElementById('showroom')&&!document.getElementById('showroomB')),nm+': A tile opens Showroom A');
 await w(4000);FPS[nm+'_A']=await rate(5000);
 ok(await p.evaluate(()=>!!document.getElementById('srpBtn')&&document.getElementById('srpBox').hidden),nm+': A perf readout present, off by default');
 await p.keyboard.press('p');await w(2500);let pf=await p.evaluate(()=>({s:GX.srperf.stats(),t:srpBox.textContent,vis:!srpBox.hidden}));ok(pf.vis&&pf.s.id=='A'&&/FPS/.test(pf.t)&&/MB/.test(pf.t)&&/LOD/.test(pf.t),nm+': P shows A perf ('+JSON.stringify(pf.s)+')');
 await p.screenshot({path:SH+nm+'_A_perf.png'});await p.keyboard.press('p');ok(await p.evaluate(()=>srpBox.hidden&&localStorage.getItem('dw_srperf')=='0'),nm+': P hides it (saved)');await p.screenshot({path:SH+nm+'_A_day.png'});
 await p.evaluate(()=>srNight.click());await w(3500);await p.screenshot({path:SH+nm+'_A_night.png'});await p.evaluate(()=>srNight.click());await w(500);
 await p.evaluate(()=>GX.showroom.close());
 // 2) switch to B in Settings (Tools group) and open via HUD button
 await p.waitForFunction(()=>!!document.getElementById('srabSet'),{timeout:30000}).catch(()=>{});ok(await p.evaluate(()=>!!document.getElementById('srabSet')),nm+': Settings has Showroom A/B toggle');
 ok(await p.evaluate(()=>GX.showroomAB.keys().join()=='A,B'&&!document.getElementById('srabTC')&&!document.getElementById('srabSC')),nm+': selector A/B, C hidden until it registers');
 ok(await p.evaluate(()=>{localStorage.setItem('dw_showroom_ab','C');const g=GX.showroomAB.get();localStorage.setItem('dw_showroom_ab','A');return g=='A'}),nm+': unregistered C falls back to A');
 await p.evaluate(()=>srabTB.click());ok(await p.evaluate(()=>localStorage.getItem('dw_showroom_ab')=='B'&&srabTB.classList.contains('on')),nm+': Settings toggle sets B (saved)');
 await p.waitForSelector('#btnShow',{timeout:30000}).catch(()=>{});await p.evaluate(()=>btnShow.click());await p.waitForSelector('#showroomB canvas',{timeout:30000}).catch(()=>{});
 ok(await p.evaluate(()=>!!document.getElementById('showroomB')&&!document.getElementById('showroom')),nm+': HUD Showroom button opens B when B is on');
 ok(await idle(240000),nm+': B settles (intro + slam done)');
 const S=()=>p.evaluate(()=>{const B=GX.showroomB,T=B.ST;return {i:T.i,n:T.rigs.length,id:T.grp?.userData.id,lod:T.lod,schema:T.man?.schemaVersion,name:srbName.textContent,bars:[...document.querySelectorAll('#srbStats .row')].map(r=>({k:r.dataset.k,v:+r.dataset.v,w:parseFloat(r.querySelector('.fill').style.width)||0,t:r.querySelector('.v').textContent})),dots:[...document.querySelectorAll('#srbDots i')].map(d=>d.classList.contains('on'))}});
 let a=await S();ok(a.n==10&&a.schema,nm+': manifest loaded, 10 rigs (schema '+a.schema+')');ok(!!a.id&&a.name.length>3,nm+': GLB rig on podium ('+a.id+')');
 ok(nm=='phone'?/[LM]/.test(a.lod):a.lod=='M',nm+': LOD '+a.lod);
 ok(await p.evaluate(()=>[...GX.showroomB.ST.grp.userData.meshes].some(m=>m.userData.path)),nm+': meshes mapped to manifest node paths');
 await w(1500);a=await S();ok(a.bars.length==4&&a.bars.every(x=>x.w>0||x.v==0)&&a.bars.map(x=>x.k).join()=='hook,depth,kw,bop',nm+': 4 stat bars fill ('+a.bars.map(x=>x.k+' '+x.w.toFixed(0)+'%').join(', ')+')');
 const txt=await p.evaluate(()=>showroomB.textContent);ok(/SIM/.test(txt)&&!/LIVE/.test(txt),nm+': SIM label, no LIVE');ok(!/codex|openai|gpt|claude|anthropic/i.test(txt),nm+': no AI provider name');
 await p.evaluate(()=>srpBtn.click());await w(2500);{const q=await p.evaluate(()=>({s:GX.srperf.stats(),vis:!srpBox.hidden,ls:localStorage.getItem('dw_srperf')}));ok(q.vis&&q.ls=='1'&&q.s.id=='B'&&q.s.mb>0&&q.s.loadMs>0&&q.s.fps>0&&q.s.lod==a.lod,nm+': B perf readout via button ('+JSON.stringify(q.s)+')')}
 await p.screenshot({path:SH+nm+'_B_perf.png'});await p.evaluate(()=>srpBtn.click());FPS[nm+'_B']=await rate(5000);console.log('FPS',nm,'A',FPS[nm+'_A'].toFixed(1),'B',FPS[nm+'_B'].toFixed(1),'ratio',(FPS[nm+'_B']/FPS[nm+'_A']).toFixed(2));
 /* sanity floor only (swiftshader noise); real-device check = srperf readout */ok(FPS[nm+'_B']>=FPS[nm+'_A']*.3||FPS[nm+'_B']>=.5,nm+': B frame rate holds vs A ('+FPS[nm+'_B'].toFixed(1)+' vs '+FPS[nm+'_A'].toFixed(1)+')');
 await p.screenshot({path:SH+nm+'_B_day.png'});
 // 3) inputs: keys, gamepad, swipe
 a=await S();await p.keyboard.press('ArrowRight');await w(200);let c=await S();ok(c.i==(a.i+1)%10&&c.dots[c.i],nm+': → next rig ('+c.name+')');ok(c.bars.some((x,k)=>x.t!=a.bars[k].t),nm+': stats change');
 await idle();await p.keyboard.press('a');await w(200);c=await S();ok(c.i==a.i,nm+': A key → previous');await idle();
 const press=async i=>{const i0=await p.evaluate(()=>GX.showroomB.ST.i);await p.evaluate(i=>{__pad.buttons[i]={pressed:true,value:1}},i);await p.waitForFunction(i0=>GX.showroomB.ST.i!=i0,{timeout:15000,polling:100},i0).catch(()=>{});await p.evaluate(i=>{__pad.buttons[i]={pressed:false,value:0}},i);await w(400)};
 await press(5);c=await S();ok(c.i==(a.i+1)%10,nm+': RB → next');await idle();await press(4);c=await S();ok(c.i==a.i,nm+': LB → previous');await idle();
 const box={x:vp.width/2,y:vp.height*.45};const swipe=async dx=>{if(nm=='phone'){await p.evaluate(({x,y,dx})=>{const cv=showroomB.querySelector('canvas'),o={bubbles:true,pointerId:2,pointerType:'touch',clientY:y};cv.dispatchEvent(new PointerEvent('pointerdown',{...o,clientX:x}));cv.dispatchEvent(new PointerEvent('pointermove',{...o,clientX:x+dx/2}));cv.dispatchEvent(new PointerEvent('pointerup',{...o,clientX:x+dx}))},{...box,dx})}else{await p.mouse.move(box.x,box.y);await p.mouse.down();for(let k=1;k<=6;k++)await p.mouse.move(box.x+dx*k/6,box.y);await p.mouse.up()}await w(300)};
 await swipe(-160);c=await S();ok(c.i==(a.i+1)%10,nm+': swipe left → next');await idle();await swipe(160);c=await S();ok(c.i==a.i,nm+': swipe right → previous');
 ok(await idle(),nm+': whoosh/slam transition settles');const L=await p.evaluate(()=>GX.showroomB.ST.sfxLog.map(x=>x.n).join());ok(/whoosh/.test(L)&&/slam/.test(L),nm+': whoosh + slam cues');
 // 4) card + A/B/C drill-down, no overlap after animations
 await p.evaluate(()=>GX.showroomB.show(0));await idle();await p.keyboard.press('i');await w(300);ok(await p.evaluate(()=>!srbCard.hidden),nm+': I opens parts card');
 const D=async()=>p.evaluate(()=>{const B=GX.showroomB;return {path:B.ST.path,items:[...srbCard.querySelectorAll('li button')].map(x=>x.dataset.go),bom:srbCard.querySelector('.bom')?.textContent||'',map:B.ST.grp.userData.map,hi:B.ST.hi.length}});
 let d=await D();ok(d.items.length>3&&d.items.every(k=>!k.includes('/')),nm+': level A list ('+d.items.length+' systems)');
 const aK=d.items.find(k=>Object.keys(d.map).some(x=>x.startsWith(k+'/')&&x.split('/').length==3))||d.items.find(k=>Object.keys(d.map).some(x=>x.startsWith(k+'/')));
 await p.evaluate(k=>srbCard.querySelector(`li button[data-go="${k}"]`).click(),aK);d=await D();ok(d.path==aK&&d.bom.includes(d.map[aK])&&d.hi>0,nm+': A '+aK+' → BOM '+d.map[aK]+' highlighted');
 ok(d.items.length>0&&d.items.every(k=>k.split('/').length==2),nm+': level B list ('+d.items.join(' ')+')');
 const bK=d.items.find(k=>Object.keys(d.map).some(x=>x.startsWith(k+'/')))||d.items[0];await p.evaluate(k=>srbCard.querySelector(`li button[data-go="${k}"]`).click(),bK);d=await D();ok(d.path==bK&&d.bom.includes(d.map[bK]),nm+': B '+bK);
 if(d.items.length){const cK=d.items[0];await p.evaluate(k=>srbCard.querySelector(`li button[data-go="${k}"]`).click(),cK);d=await D();ok(d.path==cK&&cK.split('/').length==3&&d.bom.includes(d.map[cK]),nm+': C '+cK)}
 await w(300);ok(await idle(),nm+': card reframe settles');await w(600);
 const ov=await p.evaluate(()=>{const r=GX.showroomB.rigRect(),c=srbCard.getBoundingClientRect(),i=!(c.right<=r.left||c.left>=r.right||c.bottom<=r.top||c.top>=r.bottom);return {i,r,c:c.toJSON()}});ok(!ov.i,nm+': card does not cover the rig (after animations) '+JSON.stringify([Math.round(ov.r.left),Math.round(ov.r.top),Math.round(ov.r.right),Math.round(ov.r.bottom)]));
 await p.screenshot({path:SH+nm+'_B_card.png'});
 // tap on the rig picks a part
 const pt=await p.evaluate(()=>{const r=GX.showroomB.rigRect();for(let k=0;k<200;k++){const x=r.left+(r.right-r.left)*((k*37%100)/100),y=r.top+(r.bottom-r.top)*((k*61%100)/100);if(GX.showroomB.pick(x,y))return{x,y}}return null});
 ok(!!pt,nm+': raycast pick finds a mapped part');if(pt){await p.evaluate(()=>GX.showroomB.cardShow(true,null));await p.evaluate(({x,y})=>{const cv=showroomB.querySelector('canvas');cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,bubbles:true,pointerId:1}));cv.dispatchEvent(new PointerEvent('pointerup',{clientX:x,clientY:y,bubbles:true,pointerId:1}))},pt);d=await D();ok(!!d.path&&!d.path.includes('/'),nm+': tap on rig opens level A part ('+d.path+')')}
 if(nm=='phone'){await p.evaluate(()=>srbCardT.click());ok(await p.evaluate(()=>srbCard.classList.contains('col')),nm+': card folds (compact)');await p.evaluate(()=>srbCardT.click())}
 await p.evaluate(()=>GX.showroomB.cardShow(true,null));await w(300);await p.keyboard.press('Escape');ok(await p.evaluate(()=>document.getElementById('srbCard')?.hidden&&!!document.getElementById('showroomB')),nm+': Esc closes card first');
 // 5) night keeps rig lights on
 await p.keyboard.press('n');await w(2500);const N=await p.evaluate(()=>GX.showroomB.nightState());ok(N.on&&(N.lightMeshes==0||(N.emissive>=5&&N.points>0)),nm+': night on, rig lights lit ('+JSON.stringify(N)+')');
 await idle();await p.screenshot({path:SH+nm+'_B_night.png'});await p.keyboard.press('n');await w(300);ok(await p.evaluate(()=>!GX.showroomB.nightState().on),nm+': day again');
 // 6) mute
 await p.keyboard.press('m');ok(await p.evaluate(()=>GX.showroomB.ST.mute&&localStorage.getItem('dw_srb_mute')=='1'&&srbMute.textContent=='🔇'),nm+': M mutes (saved)');
 await p.keyboard.press('ArrowRight');await w(300);ok(await p.evaluate(()=>{const L=GX.showroomB.ST.sfxLog;return L[L.length-1].muted}),nm+': cues silent when muted');await idle();await p.evaluate(()=>srbMute.click());ok(await p.evaluate(()=>!GX.showroomB.ST.mute),nm+': unmute');
 // 7) select
 await idle();const sel=await p.evaluate(()=>new Promise(r=>{const ev=[];addEventListener('dw-rig',e=>ev.push(e.detail));srbSel.click();setTimeout(()=>r({ev,boom:srbBoom.classList.contains('go'),push:GX.showroomB.ST.cd.d<GX.showroomB.ST.cs.d}),300)}));
 ok(sel.boom&&sel.ev[0]?.src=='B',nm+': SELECT! confirm, emits rig '+sel.ev[0]?.id);ok(sel.push,nm+': camera push-in');ok(sel.ev[0]?.applied,nm+': rig design applied (GX.setDesign)');
 await p.waitForFunction(()=>!document.getElementById('showroomB'),{timeout:20000}).catch(()=>{});ok(await p.evaluate(()=>!document.getElementById('showroomB')&&!!localStorage.getItem('dw_showroom_rig_b')),nm+': closes after select, choice saved');
 // 8) toggle back to A
 await p.evaluate(()=>srabTA.click());await p.evaluate(()=>btnShow.click());await w(1500);ok(await p.evaluate(()=>!!document.getElementById('showroom')&&!document.getElementById('showroomB')&&localStorage.getItem('dw_showroom_ab')=='A'),nm+': toggle back to A opens Showroom A');
 await p.evaluate(()=>GX.showroom.close());
 // 9) start tile with B + pack override fallback
 await p.evaluate(()=>localStorage.setItem('dw_showroom_ab','B'));await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#srabStart',{timeout:60000}).catch(()=>{});
 ok(await p.evaluate(()=>srabSB.classList.contains('on')),nm+': start toggle shows B after reload');await p.evaluate(()=>st_showroom.click());await p.waitForSelector('#showroomB',{timeout:30000}).catch(()=>{});
 ok(await p.evaluate(()=>!!document.getElementById('showroomB')),nm+': start tile opens B');await idle();await p.keyboard.press('Escape');await w(300);ok(await p.evaluate(()=>!document.getElementById('showroomB')),nm+': Esc closes B');
 await p.evaluate(()=>{window.__copen=0;GX.showroomAB.register('C',{label:'C · Test',open:()=>{window.__copen++}})});await w(800);
 await p.waitForSelector('#srabTC',{timeout:15000}).catch(()=>{});ok(await p.evaluate(()=>!!document.getElementById('srabTC')&&GX.showroomAB.keys().join()=='A,B,C'),nm+': register C shows a third button');
 await p.evaluate(()=>srabTC.click());await p.evaluate(()=>GX.showroomAB.open());await w(800);ok(await p.evaluate(()=>window.__copen==1&&localStorage.getItem('dw_showroom_ab')=='C'),nm+': C chosen opens registered C');
 await p.evaluate(()=>localStorage.setItem('dw_showroom_ab','A'));await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));fs.writeFileSync(SH+'fps.json',JSON.stringify(FPS,null,1));
console.log(`\n${pass} passed, ${fails} failed`);await b.close();process.exit(fails?1:0)
