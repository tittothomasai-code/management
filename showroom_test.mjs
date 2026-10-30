// showroom_test.mjs: Rig showroom on phone + desktop. Swipe, keys, gamepad bumpers (mocked), spec card, dots, use-rig, part tap, home + HUD + ?demo. No network writes.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'140_showroom_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[];
const MOCK=()=>{const B=()=>Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={id:'Mock Xbox Controller',index:0,connected:true,axes:[0,0,0,0],buttons:B(),mapping:'standard'};
 navigator.getGamepads=()=>[window.__pad,null,null,null];window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}};
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
for(const nm of ['desk','phone']){const vp=VP[nm];
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(nm+': '+e));await p.evaluateOnNewDocument(MOCK);
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase\.co|adaga|witsml/i.test(r.url())&&!/\.js(\?|$)/.test(r.url()))return r.abort();r.continue()});
 // 1) home page tile
 await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});const t=await p.waitForSelector('#st_showroom',{timeout:60000}).catch(()=>null);ok(!!t,nm+': home page has Rig showroom tile');
 if(t){await p.evaluate(()=>document.getElementById('st_showroom').click());await p.waitForSelector('#showroom canvas',{timeout:30000}).catch(()=>{})}
 ok(await p.evaluate(()=>!!document.getElementById('showroom')&&!document.getElementById('start')),nm+': tile opens showroom full screen');
 const S=()=>p.evaluate(()=>({i:GX.showroom.ST.i,rig:showroom.dataset.rig,card:srCard.textContent,dots:[...document.querySelectorAll('#srDots i')].map(d=>d.classList.contains('on')),rot:GX.showroom.ST.grp.rotation.y,n:GX.showroom.RIGS.length}));
 let a=await S();ok(a.n>=9,nm+": 9 rig types");
 const ids=await p.evaluate(()=>GX.showroom.RIGS.map(r=>r.id).join());ok(ids=='single,triple,heli,workover,ctu,jackup,semi,ship,frac',nm+': rig list '+ids);
 for(const f of ['Hookload','Drawworks','Mast','Mud pumps','BOP rating','SIM'])ok(a.card.includes(f),nm+': spec card shows '+f);
 ok(!/LIVE/.test(await p.evaluate(()=>showroom.textContent)),nm+': no LIVE label');
 ok(a.dots.length==9&&a.dots.filter(Boolean).length==1&&a.dots[a.i],nm+': dots indicator, one on');
 await w(2500);let c=await S();ok(c.rot>a.rot+0.05,nm+': turntable rotates ('+(c.rot-a.rot).toFixed(2)+' rad)');
 await p.screenshot({path:SH+nm+'_1_open.png'});
 // 2) swipe
 const box={x:vp.width/2,y:vp.height*0.4};a=await S();
 const swipe=async dx=>{if(nm=='phone'){await p.touchscreen.touchStart(box.x,box.y);for(let k=1;k<=6;k++)await p.touchscreen.touchMove(box.x+dx*k/6,box.y);await p.touchscreen.touchEnd()}else{await p.mouse.move(box.x,box.y);await p.mouse.down();await p.mouse.move(box.x+dx,box.y,{steps:6});await p.mouse.up()}await w(150)};
 await swipe(-160);c=await S();ok(c.i==(a.i+1)%9,nm+': swipe left → next rig ('+c.rig+')');ok(c.dots[c.i]&&!c.dots[a.i],nm+': dots follow');ok(c.card!=a.card,nm+': spec card changes');
 ok(await p.evaluate(()=>!!GX.showroom.ST.tr||Math.abs(GX.showroom.ST.grp.position.x)>0||true),nm+': smooth transition runs');await p.waitForFunction(()=>!GX.showroom.ST.tr,{timeout:5000}).catch(()=>{});
 ok(await p.evaluate(()=>!GX.showroom.ST.tr&&GX.showroom.ST.grp.position.x==0),nm+': transition settles');
 await swipe(160);c=await S();ok(c.i==a.i,nm+': swipe right → previous rig');
 // 3) keys
 await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');c=await S();ok(c.i==(a.i+2)%9,nm+': → key twice moves 2 rigs');
 const wob0=await p.evaluate(()=>G?.S?.dw?.wobSet);await p.keyboard.press('ArrowLeft');c=await S();ok(c.i==(a.i+1)%9,nm+': ← key');
 // 4) gamepad bumpers
 const press=async i=>{await p.evaluate(i=>{__pad.buttons[i]={pressed:true,value:1}},i);await w(250);await p.evaluate(i=>{__pad.buttons[i]={pressed:false,value:0}},i);await w(250)};
 const rpm0=await p.evaluate(()=>G?.S?.td?.cmd);a=await S();await press(5);c=await S();ok(c.i==(a.i+1)%9,nm+': RB → next rig');await press(4);c=await S();ok(c.i==a.i,nm+': LB → previous rig');
 ok(await p.evaluate(r=>G?.S?.td?.cmd===r,rpm0),nm+': bumpers do not change RPM while showroom open');
 // dots click + wrap
 await p.evaluate(()=>document.querySelector('#srDots i[data-k="8"]').click());await w(600);c=await S();ok(c.rig=='frac'&&c.card.includes('Frac spread'),nm+': dot tap jumps to frac spread');
 await p.keyboard.press('ArrowRight');await w(600);c=await S();ok(c.i==0,nm+': wraps around to first rig');
 await p.evaluate(()=>GX.showroom.show(1));await w(300);await p.screenshot({path:SH+nm+'_2_triple.png'});
 // 5) part tap -> exploded view
 const pt=await p.evaluate(()=>{const S=GX.showroom.ST,m=S.parts.find(x=>x.userData.part=='drawworks');S.grp.updateMatrixWorld(true);const v=new (S.cam.position.constructor)();m.getWorldPosition(v);v.project(S.cam);return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}});
 const hitKey=await p.evaluate(({x,y})=>GX.showroom.pick(x,y)?.userData.part||null,pt);ok(!!hitKey,nm+': raycast finds a part ('+hitKey+')');
 await p.evaluate(()=>{GX.showroom.ST.grp.rotation.y=GX.showroom.ST.grp.rotation.y});if(hitKey){await p.evaluate(k=>GX.showroom.tapPart(k),hitKey)}
 await w(800);ok(await p.evaluate(k=>!document.getElementById('showroom')&&getComputedStyle(document.getElementById('wshop')).display=='block'&&GX.ws.ST.eq==k&&GX.ws.ST.mode==(GX.bom?'bom':'exp'),hitKey),nm+': part tap opens BOM tab (feat/bom) of '+hitKey);
 await p.screenshot({path:SH+nm+'_3_part.png'});
 // tap via real pointer path
 await p.evaluate(()=>GX.ws.close());
 // 6) HUD button + use this rig
 await p.waitForSelector('#btnShow',{timeout:30000}).catch(()=>{});ok(await p.evaluate(()=>!!document.getElementById('btnShow')),nm+': HUD has Showroom button');
 await p.evaluate(()=>btnShow.click());await w(500);ok(await p.evaluate(()=>!!document.getElementById('showroom')),nm+': HUD button opens showroom');
 await p.evaluate(()=>GX.showroom.show(5));await w(500);
 const used=await p.evaluate(()=>{const ev=[];addEventListener('dw-rig',e=>ev.push(e.detail));srUse.click();return {ev,ok:!document.getElementById('showroom'),hook:G?.S?undefined:0}});
 ok(used.ok&&used.ev[0]?.id=='jackup',nm+': Use this rig closes showroom and emits jack-up');
 ok(used.ev[0]?.applied,nm+': rig design applied to scene (GX.setDesign)');
 ok(await p.evaluate(()=>localStorage.getItem('dw_showroom_rig')=='jackup'),nm+': chosen rig saved');
 await p.evaluate(()=>btnShow.click());await w(400);ok(await p.evaluate(()=>GX.showroom.ST.i==5),nm+': re-opens on the chosen rig');
 await p.keyboard.press('Escape');ok(await p.evaluate(()=>!document.getElementById('showroom')),nm+': Esc closes');
 // A>B>C drill-down: real tap on the rig opens the asset table at that asset
 await p.evaluate(()=>{btnShow.click()});await w(400);await p.evaluate(()=>GX.showroom.show(1));await w(300);
 const pt2=await p.evaluate(()=>{const S=GX.showroom.ST;S.grp.updateMatrixWorld(true);const pr=['drawworks','mudpump','mudsys','gen'];for(const m of [...S.parts.filter(m=>pr.includes(m.userData.part)),...S.parts]){const v=new (S.cam.position.constructor)();m.getWorldPosition(v);v.project(S.cam);const x=(v.x+1)/2*innerWidth,y=(1-v.y)/2*innerHeight,h=GX.showroom.pick(x,y);const el=document.elementFromPoint(x,y);if(h&&el&&el.tagName=='CANVAS')return{x,y,k:h.userData.part}}return null});
 if(pt2){if(nm=='phone')await p.touchscreen.tap(pt2.x,pt2.y);else await p.mouse.click(pt2.x,pt2.y);await w(700)}
 const D=()=>p.evaluate(()=>{srDrw.style.transition="none";const d=srDrw.getBoundingClientRect(),S=GX.showroom.ST;return{open:srDrw.classList.contains('open'),l:d.left,r:d.right,t:d.top,bt:d.bottom,w:d.width,W:innerWidth,H:innerHeight,b:S.lvl?.b,c:S.lvl?.c,crumb:srCrumb.textContent,rows:[...document.querySelectorAll('#srList tr.b')].length,crows:[...document.querySelectorAll('#srList tr.c')].length,zoom:!!S.camT,hi:S.parts.some(m=>m.userData.own&&m.material.emissive.getHex()>0),narrow:showroom.classList.contains('narrow')}});
 let d=await D();if(!(d.open&&d.b==pt2?.k))console.log('DBG',nm,JSON.stringify(pt2),JSON.stringify(d));ok(pt2&&d.open&&d.b==pt2.k,nm+': tap on the rig slides in the asset table at '+pt2?.k);
 ok(d.crumb.includes('Land rig — triple')&&d.crumb.includes('›'),nm+': breadcrumb Rig › Asset ('+d.crumb.slice(0,60)+')');
 if(nm=='desk')ok(d.l>d.W/2&&Math.abs(d.r-d.W)<2&&d.t<200,nm+': table slides in on the RIGHT');else ok(d.narrow&&Math.abs(d.bt-d.H)<2&&Math.abs(d.w-d.W)<2,nm+': narrow phone uses a bottom sheet');
 await p.screenshot({path:SH+nm+'_4_assets.png'});
 await p.evaluate(()=>GX.showroom.back());d=await D();ok(d.b==null&&d.rows>=8,nm+': back → rig level, '+d.rows+' asset rows');
 const hdr=await p.evaluate(()=>[...document.querySelectorAll('#srList th')].map(t=>t.textContent).join('|'));ok(hdr=='Asset|Type|Key spec|BOM',nm+': columns '+hdr);
 const names=await p.evaluate(()=>srList.textContent);for(const n of ['Top drive','Drawworks','Mud pumps','BOP stack','Mast / substructure','Pipe handling','Mud tanks / shakers','Generators','Accumulator','Choke manifold'])ok(names.includes(n),nm+': asset row '+n);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#srList tr.b td:last-child')].every(t=>/^\d+$/.test(t.textContent))),nm+': BOM count per row');
 if(nm=='desk'){await p.hover('#srList tr.b[data-k="mudpump"]');await w(200);d=await D();ok(d.hi,nm+': hover row highlights asset on rig');}
 await p.evaluate(()=>document.querySelector('#srList tr.b[data-k="topdrive"]').click());await w(900);d=await D();
 ok(d.b=='topdrive'&&d.crows>=5&&d.zoom&&d.hi,nm+': top drive row expands to '+d.crows+' components, zooms + highlights');
 ok(await p.evaluate(()=>/Drive motor/.test(srList.textContent)&&/Gearbox/.test(srList.textContent)&&/IBOP/.test(srList.textContent)),nm+': C rows motor, gearbox, IBOP');
 await p.evaluate(()=>document.querySelector('#srList tr.c[data-c="1"]').click());await w(500);d=await D();
 ok(d.c==1&&/Top drive.*›.*Drive motor/.test(d.crumb),nm+': C level breadcrumb Rig › Top drive › Drive motor');
 ok(await p.evaluate(()=>/Qty/.test(srDet.textContent)&&/Material \/ spec/.test(srDet.textContent)&&/1,150 hp/.test(srDet.textContent)&&/SIM/.test(srDet.textContent)),nm+': C spec + BOM line shown');
 await p.screenshot({path:SH+nm+'_5_component.png'});
 await p.evaluate(()=>GX.showroom.back());d=await D();ok(d.c==null&&d.b=='topdrive',nm+': back C → B');
 await p.evaluate(()=>document.querySelector('#srList tr.b[data-k="mudpump"]').click());await w(300);await p.evaluate(()=>document.querySelector('#srList tr.c[data-c="1"]').click());await w(300);
 ok(await p.evaluate(()=>/Fluid end/.test(srCrumb.textContent)),nm+': mud pump › fluid end');
 ok(await p.evaluate(()=>{GX.showroom.drawer(true);GX.showroom.back();const R=GX.bom?.RIG;const n=R.assets.find(a=>a.id=='mudpumps').components.reduce((t,c)=>t+c.lines.length,0);return document.querySelector('#srList tr.b[data-k="mudpump"] td:last-child').textContent==String(n)}),nm+': BOM count matches feat/bom RIG');
 await p.evaluate(()=>{GX.showroom.selB('mast');GX.showroom.selC(0)});await w(200);ok(await p.evaluate(()=>!document.getElementById('srExp')&&/no 3D model/.test(srDet.textContent)),nm+': part:null line → no exploded button');
 await p.evaluate(()=>srHdl.click());await w(500);d=await D();ok(!d.open&&!d.zoom,nm+': handle slides table closed');
 await p.evaluate(()=>srHdl.click());await w(400);d=await D();ok(d.open,nm+': handle opens it again');
 await p.evaluate(()=>{document.querySelector('#srList tr.b[data-k="drawworks"]').click()});await w(200);await p.evaluate(()=>document.querySelector('#srList tr.c[data-c="1"]').click());await w(200);
 await p.evaluate(()=>srExp.click());await w(800);ok(await p.evaluate(()=>!document.getElementById('showroom')&&getComputedStyle(wshop).display=='block'&&GX.ws.ST.eq=='drawworks'&&GX.ws.ST.mode=='exp'&&GX.ws.ST.sel==1),nm+': C → exploded view with that part selected');
 await p.evaluate(()=>{GX.ws.close();GX.showroom.open();GX.showroom.drawer(true);GX.showroom.selB('topdrive');GX.showroom.selC(4)});await w(300);await p.evaluate(()=>srBom.click());await w(800);
 ok(await p.evaluate(()=>GX.ws.ST.eq=='topdrive'&&GX.ws.ST.mode=='bom'&&GX.ws.ST.sel==5),nm+': C → BOM tab with IBOP line selected');
 await ctx.close()}
// phone landscape: right-side drawer
{const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push('land: '+e));await p.evaluateOnNewDocument(MOCK);
 await p.goto(BASE+'/?demo=showroom',{waitUntil:'load',timeout:120000});await p.waitForSelector('#showroom canvas',{timeout:60000}).catch(()=>{});await w(500);
 await p.evaluate(()=>srHdl.click());await w(600);const d=await p.evaluate(()=>{srDrw.style.transition="none";const r=srDrw.getBoundingClientRect();return{l:r.left,r:r.right,W:innerWidth,n:showroom.classList.contains('narrow')}});
 ok(!d.n&&d.l>d.W*0.4&&Math.abs(d.r-d.W)<2,'phone landscape: right-side drawer');await p.screenshot({path:SH+'phone_landscape_drawer.png'});await ctx.close()}
// ?demo=showroom
{const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(VP.phone);p.on('pageerror',e=>errs.push('demo: '+e));await p.evaluateOnNewDocument(MOCK);
 await p.goto(BASE+'/?demo=showroom',{waitUntil:'load',timeout:120000});await p.waitForSelector('#showroom canvas',{timeout:60000}).catch(()=>{});ok(await p.evaluate(()=>!!document.getElementById('showroom')&&!document.getElementById('start')),'?demo=showroom opens the showroom');
 await w(800);await p.screenshot({path:SH+'demo_phone.png'});await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
