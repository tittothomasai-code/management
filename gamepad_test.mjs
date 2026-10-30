// v5.9.4 gamepad + keyboard test (mocked navigator.getGamepads). No network writes.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'126_input_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[];
const MOCK=()=>{const B=()=>Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={id:'Mock Xbox Controller',index:0,connected:true,axes:[0,0,0,0],buttons:B(),mapping:'standard'};
 navigator.getGamepads=()=>[window.__pad.connected?window.__pad:null,null,null,null];window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}};
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));await p.evaluateOnNewDocument(MOCK);
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase\.co|adaga|witsml/i.test(r.url())&&!/\.js(\?|$)/.test(r.url()))return r.abort();r.continue()});
 await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.__input&&window.G?.cam&&window.G?.S,{timeout:90000}).catch(()=>{});
 await p.waitForSelector('#uiTab_rig',{timeout:60000}).catch(()=>{});ok(await p.evaluate(()=>!!window.__input),nm+': input module loaded');
 const st=()=>p.evaluate(()=>({az:Math.atan2(G.cam.position.x-G.ctl.target.x,G.cam.position.z-G.ctl.target.z),r:G.cam.position.distanceTo(G.ctl.target),tx:G.ctl.target.x,tz:G.ctl.target.z,wob:G.S.dw.wobSet,rpm:G.S.td.cmd}));
 const set=(f,...x)=>p.evaluate(f,...x);await p.evaluate(()=>{__input.stop();window.__t=1e6});const tick=n=>p.evaluate(n=>{for(let i=0;i<n;i++)__input.poll(window.__t+=16)},n);
 await tick(2);ok(await p.evaluate(()=>__input.ST.pad=='Mock Xbox Controller'),nm+': pad detected');
 let a=await st();await set(()=>__pad.axes[0]=0.9);await tick(20);await set(()=>__pad.axes[0]=0);let c=await st();ok(Math.abs(c.az-a.az)>0.05,nm+': left stick orbits ('+(c.az-a.az).toFixed(3)+' rad)');
 a=c;await set(()=>__pad.axes[3]=-0.9);await tick(20);await set(()=>__pad.axes[3]=0);c=await st();ok(c.r<a.r*0.95,nm+': right stick ↕ zooms ('+a.r.toFixed(1)+'→'+c.r.toFixed(1)+')');
 a=c;await set(()=>__pad.axes[2]=0.9);await tick(20);await set(()=>__pad.axes[2]=0);c=await st();ok(Math.hypot(c.tx-a.tx,c.tz-a.tz)>0.01,nm+': right stick ↔ looks');
 a=c;await set(()=>{__pad.buttons[7]={pressed:true,value:1}});await tick(30);await set(()=>{__pad.buttons[7]={pressed:false,value:0}});c=await st();ok(c.wob>a.wob,nm+': RT raises WOB setpoint ('+a.wob+'→'+c.wob+' klbf)');
 a=c;await set(()=>{__pad.buttons[6]={pressed:true,value:1}});await tick(10);await set(()=>{__pad.buttons[6]={pressed:false,value:0}});c=await st();ok(c.wob<a.wob,nm+': LT lowers WOB');
 ok(await p.evaluate(()=>/WOB setpoint \d+ kN/.test(__input.ST.log.join('|'))),nm+': WOB shown metric (kN)');
 a=c;const press=async i=>{await set(i=>{__pad.buttons[i]={pressed:true,value:1}},i);await tick(3);await set(i=>{__pad.buttons[i]={pressed:false,value:0}},i);await tick(2)};
 await press(5);c=await st();ok(c.rpm==a.rpm+5,nm+': RB +5 RPM ('+c.rpm+')');await press(4);c=await st();ok(c.rpm==a.rpm,nm+': LB −5 RPM');
 await press(15);await w(400);const op=await p.evaluate(()=>__input.ST.lastTab);ok(op=='data',nm+': D-pad → next panel tab ('+op+')');
 await press(1);await w(300);ok(true,nm+': B closes panels (no error)');
 await press(9);ok(await p.evaluate(()=>getComputedStyle(document.getElementById('inpLegend')).display=='block'&&/Left stick/.test(inpLegend.textContent)&&/WOB/.test(inpLegend.textContent)),nm+': Start shows legend');
 await p.screenshot({path:SH+'1_legend_'+nm+'.png'});
 ok(await p.evaluate(()=>{const e=inpLegend,r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+30);return e.contains(h)&&+getComputedStyle(e).zIndex>100000}),nm+': legend sits above the dock, on-screen controls and subsurface view');await press(9);ok(await p.evaluate(()=>getComputedStyle(inpLegend).display=='none'),nm+': Start hides legend');
 // keyboard
 await p.evaluate(()=>document.activeElement?.blur());a=await st();await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');c=await st();ok(Math.abs(c.az-a.az)>0.1,nm+': arrows orbit');
 a=c;await p.keyboard.press('Equal');c=await st();ok(c.r<a.r,nm+': + zooms in');a=c;await p.keyboard.press('Minus');c=await st();ok(c.r>a.r,nm+': − zooms out');
 a=c;await p.keyboard.press('BracketRight');c=await st();ok(c.wob==a.wob+0.5,nm+': ] WOB +');await p.keyboard.press('PageUp');c=await st();ok(c.rpm==a.rpm+5,nm+': PgUp RPM +');
 await p.keyboard.press('Tab');await p.keyboard.press('Tab');const fr=await p.evaluate(()=>{const e=document.activeElement;return e&&e!==document.body?getComputedStyle(e).outlineStyle+' '+getComputedStyle(e).outlineWidth:''});ok(/solid 3px/.test(fr),nm+': Tab shows visible focus ring ('+fr+')');
 if(nm=='desk')await p.screenshot({path:SH+'2_focus_desk.png'});
 await p.evaluate(()=>document.activeElement?.blur());await p.keyboard.type('?');ok(await p.evaluate(()=>getComputedStyle(inpLegend).display=='block'),nm+': ? shows legend');await p.keyboard.press('Escape');ok(await p.evaluate(()=>getComputedStyle(inpLegend).display=='none'),nm+': Esc closes legend/panels');
 await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
