// v5.11.2.1 P0 hotfix test: 🏠 Home from the scene (desktop rail + phone nav), visible over the WITSML panel; click, Esc (first Esc closes panel),
// gamepad View (8), browser Back, confirm when a feed/session runs, root reload shows the start screen (no auto-resume).
// Desktop also: WITSML pop-up ✕ / Close / Esc / click-outside close it, auto-connect on reload does NOT open it, error toast never covers ✕. Offline SIM.
import puppeteer from 'puppeteer-core';const BASE=process.argv[2]||'http://localhost:8777',SH=process.env.SHOT||'shots_live/130_home_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const MOCK=()=>{const B=()=>Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={id:'Mock Xbox Controller',index:0,connected:true,axes:[0,0,0,0],buttons:B(),mapping:'standard'};navigator.getGamepads=()=>[window.__pad,null,null,null];try{if(!localStorage.getItem('dw_player'))localStorage.setItem('dw_player','Home test')}catch(e){}};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',ignoreDefaultArgs:['--enable-automation'],args:['--disable-blink-features=AutomationControlled','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(nm+': '+e.message+' @'+String(e.stack||'').split('\n').slice(1,3).join(' ')));await p.evaluateOnNewDocument(MOCK);
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase|adaga|witsml|example\.invalid|:8796|:8799/i.test(r.url())&&!/rpc\/join_lobby/.test(r.url())&&r.resourceType()!='script'){bad.push(r.url());r.abort()}else r.continue()});
 let dlg=null;p.on('dialog',async d=>{const a=dlg??true;dlg=null;a?await d.accept():await d.dismiss()});
 const onStart=()=>p.evaluate(()=>!!document.getElementById('start'));
 const waitStart=async(v,t=8000)=>{const e=Date.now()+t;while(Date.now()<e){if(await onStart()==v)return true;await w(200)}return false};
 const pick=async id=>{await p.evaluate(id=>document.getElementById(id)?.click(),id);await w(500)};
 const enter=async()=>{if(await p.evaluate(()=>!!document.getElementById('st_continue')))await pick('st_continue');else{await pick('st_sim');await pick('st_simFree')}return await waitStart(false,30000)};
 await p.goto(BASE+'/',{waitUntil:'load',timeout:90000});
 ok(await waitStart(true,30000),nm+': root URL shows the start screen (webdriver hidden)');
 ok(await enter(),nm+': New simulation → scene');
 await p.waitForFunction(()=>window.GX?.home&&document.getElementById('uiTab_home')&&window.GX?.witsml,{timeout:90000});await w(1500);
 // WITSML panel open over the scene
 await p.evaluate(()=>GX.witsml.open());await w(600);
 const hv=await p.evaluate(()=>{const b=document.getElementById('uiTab_home'),r=b.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {ok:!!t&&(t===b||b.contains(t)),r:[r.left,r.top,r.width,r.height].map(Math.round),first:b.parentNode.firstElementChild===b,w:!!document.getElementById('witsml')}});
 ok(hv.ok&&hv.w&&hv.r[2]>0,nm+': 🏠 Home visible and on top with WITSML panel open '+JSON.stringify(hv));ok(hv.first,nm+': Home is first in the nav');
 await p.screenshot({path:SH+nm+'_0_witsml_home.png'});
 if(nm=='desk'){
  const x=await p.evaluate(()=>{const P=document.getElementById('witsml'),X=document.getElementById('wX'),pr=P.getBoundingClientRect(),r=X.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {top:r.top-pr.top<20,right:pr.right-r.right<24,hit:t===X}});
  ok(x.top&&x.right&&x.hit,'desk: WITSML ✕ in the top-right and clickable '+JSON.stringify(x));
  await p.click('#wX');await w(400);ok(await p.evaluate(()=>!document.getElementById('witsml')&&!GX.witsml.isOpen()),'desk: ✕ closes the WITSML panel');
  await p.evaluate(()=>GX.witsml.open());await w(400);await p.click('#wx');await w(400);ok(await p.evaluate(()=>!document.getElementById('witsml')),'desk: existing Close (next to Disconnect) closes it');
  await p.evaluate(()=>GX.witsml.open());await w(400);await p.mouse.click(700,820);await w(400);ok(await p.evaluate(()=>!document.getElementById('witsml')),'desk: click outside closes it');
  await p.evaluate(()=>document.getElementById('wbtn')?.click()||GX.witsml.open());await w(400);ok(await p.evaluate(()=>GX.witsml.isOpen()),'desk: 🛰 reopens after closing');
  // red error/STALE toast must not cover the close controls
  await p.evaluate(()=>{document.getElementById('wtoast')?.remove();GX.witsml.WML&&0});await p.evaluate(()=>{const s=document.getElementById('wst');/* fire the same error toast path */document.getElementById('wcon')&&0});
  await p.evaluate(()=>{const f=[...document.querySelectorAll('#witsml button')].find(b=>b.id=='wcon');GX.witsml.CFG.proxy=GX.witsml.HOSTED_PROXY;GX.witsml.CFG.url='https://example.invalid/x';document.getElementById('wuser').value='';document.getElementById('wpass').value='';f.click()});await w(600);
  const tc=await p.evaluate(()=>{const t=document.getElementById('wtoast'),X=document.getElementById('wX'),c=document.getElementById('wx');if(!t||t.style.display=='none')return {toast:false};const tr=t.getBoundingClientRect(),o=e=>{const r=e.getBoundingClientRect();return !(r.right<tr.left||r.left>tr.right||r.bottom<tr.top||r.top>tr.bottom)};const xr=X.getBoundingClientRect();return {toast:true,overX:o(X),overClose:o(c),hit:document.elementFromPoint(xr.left+xr.width/2,xr.top+xr.height/2)===X}});
  ok(tc.toast&&!tc.overX&&!tc.overClose&&tc.hit,'desk: red error toast does not overlap ✕ / Close '+JSON.stringify(tc));await p.screenshot({path:SH+'desk_1_toast.png'});
 }
 // Esc: first closes the WITSML panel, second goes home
 if(!(await p.evaluate(()=>GX.witsml.isOpen())))await p.evaluate(()=>GX.witsml.open()),await w(300);
 await p.keyboard.press('Escape');await w(500);ok(!(await onStart())&&!(await p.evaluate(()=>GX.witsml.isOpen())),nm+': first Esc closes the panel, stays in scene');
 await p.evaluate(()=>GX.ui.closeAll());await w(300);await p.keyboard.press('Escape');ok(await waitStart(true),nm+': second Esc goes home');await enter();await w(500);
 // click Home
 await p.evaluate(()=>GX.witsml.open());await w(300);await p.click('#uiTab_home');ok(await waitStart(true),nm+': clicking 🏠 Home (WITSML open) shows the start screen');
 ok(await p.evaluate(()=>!!document.getElementById('st_continue')),nm+': start screen offers Continue');ok(await enter(),nm+': Continue returns to the scene');
 // gamepad View (8)
 await w(400);await p.evaluate(()=>{__pad.buttons[8]={pressed:true,value:1}});await w(300);await p.evaluate(()=>{__pad.buttons[8]={pressed:false,value:0}});
 ok(await waitStart(true),nm+': gamepad View (8) goes home');ok(await p.evaluate(()=>{const l=document.getElementById('inpLegend');return !l||getComputedStyle(l).display=='none'}),nm+': View no longer toggles the legend');await enter();
 // browser Back
 await w(500);ok(await p.evaluate(()=>!!history.state?.dwScene),nm+': scene entry pushed a history state');await p.evaluate(()=>history.back());ok(await waitStart(true),nm+': browser Back goes home');ok(p.url().startsWith(BASE),nm+': still on the site after Back '+p.url());await enter();
 // confirm when a feed runs
 await w(400);await p.evaluate(()=>{GX.witsml.WML.timer=GX.witsml.WML.timer||'TEST'});dlg=false;await p.click('#uiTab_home');await w(800);ok(!(await onStart()),nm+': feed running + confirm cancelled → stays in scene');
 dlg=true;await p.click('#uiTab_home');ok(await waitStart(true),nm+': feed running + confirm OK → home');await p.evaluate(()=>{if(GX.witsml.WML.timer=='TEST')GX.witsml.WML.timer=null});await enter();
 // root reload: no auto-resume; Home still reachable
 if(nm=='desk')await p.evaluate(()=>localStorage.setItem('dw-witsml-remember',JSON.stringify({on:true,auto:true,url:'https://example.invalid/x',proxy:'https://example.invalid/p',user:'hometest'})));
 await p.goto(BASE+'/',{waitUntil:'load',timeout:90000});ok(await waitStart(true,30000),nm+': reload of root shows the start screen (no auto-resume)');ok(await enter(),nm+': Continue after reload');
 await p.waitForFunction(()=>document.getElementById('uiTab_home'),{timeout:30000});ok(true,nm+': Home present after reload');
 if(nm=='desk'){await w(6000);ok(await p.evaluate(()=>!GX.witsml.isOpen()),'desk: auto-connect (saved connection) on reload does not open the WITSML panel');
  ok(await p.evaluate(()=>{const c=document.getElementById('wchip');return !!c&&getComputedStyle(c).display!='none'}),'desk: auto-connect shows the status chip');
  for(const k of ['data','tools','crew','rig','plan','rig']){await p.evaluate(k=>document.getElementById('uiTab_'+k)?.click(),k);await w(900)}
  ok(await p.evaluate(()=>!GX.witsml.isOpen()),'desk: switching views keeps the WITSML panel closed');
  await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:90000});await p.waitForFunction(()=>window.GX?.witsml,{timeout:90000});await w(6000);ok(await p.evaluate(()=>!GX.witsml.isOpen()),'desk: second reload (?nosplash) still closed');
  await p.click('#wchip');await w(500);ok(await p.evaluate(()=>GX.witsml.isOpen()),'desk: chip click opens the panel');await p.keyboard.press('Escape');await w(400);ok(await p.evaluate(()=>!GX.witsml.isOpen()&&localStorage.getItem('dw_wml_dismissed')=='1'),'desk: Esc closes it and dismissal is saved');await p.evaluate(()=>localStorage.removeItem('dw-witsml-remember'))}
 await p.screenshot({path:SH+nm+'_2_after.png'});await ctx.close()}
ok(!errs.length,'no page errors '+errs.join('|'));ok(!bad.length,'no Supabase/Adaga/WITSML requests '+bad.slice(0,3).join(' '));await b.close();console.log(`\n${pass} pass, ${fails} fail`);process.exit(fails?1:0)
