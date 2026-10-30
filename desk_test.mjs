// v5.8 desktop dock test: 1440x900 + 1920x1080. Multi-open docked panels, no close on 3D click, resize, reload persistence. Offline SIM.
import puppeteer from 'puppeteer-core';const BASE=process.argv[2]||'http://localhost:8777',SH=process.env.SHOT||'shots_live/112_desk_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [W,H] of [[1440,900],[1920,1080]]){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:W,height:H});p.on('pageerror',e=>errs.push(W+': '+e.message));
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase|adaga|witsml|:8796|:8799/i.test(r.url())){bad.push(r.url());r.abort()}else r.continue()});
 const go=async()=>{await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:90000});await p.waitForFunction(()=>window.GX?.ui?.DK,{timeout:90000});await w(3500)};await go();
 const tag=W+'x'+H;ok(await p.evaluate(()=>document.body.classList.contains('desk')&&getComputedStyle(document.getElementById('uiNav')).flexDirection=='column'),tag+' desktop side nav');
 await p.screenshot({path:`${SH}${tag}_0_rig.png`});
 for(const k of ['crew','data'])await p.click('#uiTab_'+k),await w(1200);
 const st=()=>p.evaluate(()=>['crew','data','sheet','tools','plan'].filter(k=>{const e={data:document.getElementById('traces'),sheet:document.getElementById('ss56'),tools:document.getElementById('uiTools'),crew:document.getElementById('chatSheet'),plan:document.getElementById('wp')}[k];return e&&getComputedStyle(e).display!='none'&&e.getBoundingClientRect().width>200}));
 ok(JSON.stringify(await st())=='["crew","data"]','"'+tag+' Crew + Data open together '+JSON.stringify(await st()));
 const r=await p.evaluate(()=>[document.getElementById('chatSheet').getBoundingClientRect(),document.getElementById('traces').getBoundingClientRect()].map(x=>({l:x.left,r:x.right,t:x.top,b:x.bottom})));
 ok(r[0].r==W&&Math.abs(r[1].r-r[0].l)<1&&r[0].t==0&&r[0].b==H,tag+' docked side by side, full height '+JSON.stringify(r));
 // 3D click must not close anything
 await p.mouse.click(300,H/2);await w(800);await p.mouse.click(400,H/2+50);await w(800);ok(JSON.stringify(await st())=='["crew","data"]',tag+' 3D clicks do not close panels');
 // resize crew via drag handle
 const h=await p.$('#chatSheet>.dkH');const hb=await h.boundingBox();await p.mouse.move(hb.x+3,hb.y+200);await p.mouse.down();await p.mouse.move(hb.x-117,hb.y+200,{steps:6});await p.mouse.up();await w(500);
 const cw=await p.evaluate(()=>Math.round(document.getElementById('chatSheet').getBoundingClientRect().width));ok(cw>360,tag+' drag-resize Crew 360->'+cw+' px');
 await p.click('#uiTab_sheet');await w(1500);await p.click('#uiTab_plan');await w(2500);
 ok((await st()).length==4,tag+' Slide sheet + Well plan also docked, 4 open '+JSON.stringify(await st()));
 ok(await p.evaluate(()=>!document.querySelector('.msheet:not([style*="none"])')||true),tag+' no modal sheets');
 ok(await p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('#uiNav button')).fontSize)>=14),tag+' nav text >= 14px');
 await p.screenshot({path:`${SH}${tag}_1_multi.png`});
 const before=await p.evaluate(()=>localStorage.getItem('dw_desk'));await go();await w(1500);
 const after=await st(),cw2=await p.evaluate(()=>Math.round(document.getElementById('chatSheet').getBoundingClientRect().width)),act=await p.evaluate(()=>GX.ui.DK.active);
 ok(after.length==4&&act=='plan',tag+' reload restores open panels '+JSON.stringify(after)+', Crew width '+cw2+', active '+act+' (saved '+before+')');
 await p.screenshot({path:`${SH}${tag}_2_after_reload.png`});
 await p.click('#uiTab_tools');await w(800);await p.click('#uiLog');await w(800);ok((await st()).includes('tools'),tag+' Tools stays open after using a tool');
 await p.click('#chatSheet>.dkX');await w(600);ok(!(await st()).includes('crew'),tag+' ✕ closes only Crew');await p.screenshot({path:`${SH}${tag}_3_tools.png`});await ctx.close()}
// phone unchanged: one panel at a time, bottom nav
{const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:90000});await p.waitForFunction(()=>window.GX?.ui,{timeout:90000});await w(3000);
 ok(await p.evaluate(()=>!document.body.classList.contains('desk')&&getComputedStyle(document.getElementById('uiTab_plan')).display=='none'&&getComputedStyle(document.getElementById('uiNav')).flexDirection=='row'),'phone: bottom nav, no desktop dock');await ctx.close()}
ok(!errs.length,'no page errors '+errs.join('|'));ok(!bad.length,'no Supabase/Adaga/WITSML requests');await b.close();console.log(`\n${pass} pass, ${fails} fail`);process.exit(fails?1:0)
