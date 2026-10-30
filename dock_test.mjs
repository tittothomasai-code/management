// v5.10.1 desk dock test (dock.js): desktop 1440x900 — chat + data docked together over the 3D view, resize, collapse/expand,
// layout kept on reload (localStorage dw_desk), split subsurface view sits between nav and dock, on-screen controls (#vpad) move left of the dock.
// Phone 390x844: no dock, one panel at a time, no collapse buttons (layout unchanged). Offline SIM, network to Supabase/WITSML blocked.
// Uses puppeteer-core like the other repo tests (no Playwright install on the box).
import puppeteer from 'puppeteer-core';const BASE=process.argv[2]||'http://localhost:8823',SH=process.env.SHOT||'shots_live/145_dock_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
async function page(ctx,vp){const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>/WebGL/.test(e.message)||errs.push(e.message));
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase|adaga|witsml|:8796|:8799/i.test(r.url())){bad.push(r.url());r.abort()}else r.continue()});return p}
const go=async p=>{await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:90000});await p.waitForFunction(()=>window.GX?.ui?.DK&&window.GX?.dock,{timeout:90000});await w(3500)};
const R=(p,id)=>p.evaluate(id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return {l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width),vis:cs.display!='none'&&r.height>0}},id);
// ---- desktop 1440
const ctx=await b.createBrowserContext();const p=await page(ctx,{width:1440,height:900});await go(p);
ok(await p.evaluate(()=>document.body.classList.contains('desk')),'desk mode at 1440');
await p.click('#uiTab_crew');await w(1200);await p.click('#uiTab_data');await w(1500);
let c=await R(p,'chatSheet'),d=await R(p,'traces');
ok(c?.vis&&d?.vis,'chat and data both open '+JSON.stringify({c,d}));ok(c&&d&&(c.r<=d.l+1||d.r<=c.l+1),'chat and data side by side, no overlap');
ok(Math.max(c.r,d.r)>=1439,'dock at the right edge');
// 3D click does not close them
await p.mouse.click(400,450);await w(800);ok((await R(p,'chatSheet')).vis&&(await R(p,'traces')).vis,'3D click keeps both open');
await p.screenshot({path:SH+'1_desk_chat_data.png'});
// resize data with its handle
const h=await p.evaluate(()=>{const r=document.querySelector('#traces>.dkH').getBoundingClientRect();return [r.x+3,r.y+200]});
const w0=(await R(p,'traces')).w;await p.mouse.move(...h);await p.mouse.down();await p.mouse.move(h[0]-120,h[1],{steps:6});await p.mouse.up();await w(500);
const w1=(await R(p,'traces')).w;ok(w1>w0+60,`drag handle widens data ${w0} -> ${w1}`);
// collapse chat
await p.click('#chatSheet .dkC_btn');await w(600);c=await R(p,'chatSheet');
ok(c.vis&&c.w<=42,'chat collapses to a strip ('+c.w+' px)');ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#chatSheet .dkStrip')).display=='flex'),'strip with Expand button shown');
await p.screenshot({path:SH+'2_desk_collapsed.png'});
// reload: layout remembered
await go(p);c=await R(p,'chatSheet');d=await R(p,'traces');
ok(c?.vis&&c.w<=42&&d?.vis&&Math.abs(d.w-w1)<=3,'reload keeps open set, collapsed chat and data width '+JSON.stringify({c,d}));
const ls=await p.evaluate(()=>JSON.parse(localStorage.getItem('dw_desk')));ok(ls.col?.crew&&ls.open.includes('data'),'localStorage dw_desk has col '+JSON.stringify(ls));
await p.screenshot({path:SH+'3_desk_after_reload.png'});
await p.click('#chatSheet .dkStrip');await w(700);ok((await R(p,'chatSheet')).w>200,'expand chat again');
// split subsurface view with the dock open
await p.evaluate(async()=>{const s=GX.subsurface;if(!s.state().open)await s.open?.();});await w(2500);
await p.evaluate(()=>{const b=document.getElementById('subSplit');b?b.click():GX.subsurface.split?.(true)});await w(2500);
const dkR=await p.evaluate(()=>parseInt(getComputedStyle(document.body).getPropertyValue('--dkR')));
const ss=await R(p,'subsurf');const sw=await p.evaluate(()=>window.__dwSplitW);
ok(ss?.vis&&Math.abs(ss.r-(1440-dkR))<=2,`split view ends at the dock edge (subsurf right ${ss?.r}, dock ${dkR})`);
ok(Math.abs(sw-ss.l)<=2,`rig render width = split line (${sw} vs ${ss.l})`);
ok(await p.evaluate(()=>{const e=document.getElementById('chatSheet'),r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e.contains(h)}),'chat is on top, not under the subsurface view');
await p.screenshot({path:SH+'4_desk_split.png'});
await p.click('#chatSheet .dkX');await w(1200);const ss2=await R(p,'subsurf'),dkR2=await p.evaluate(()=>parseInt(getComputedStyle(document.body).getPropertyValue('--dkR')));
ok(Math.abs(ss2.r-(1440-dkR2))<=2,'closing chat: split view grows to the new dock edge');
await p.evaluate(()=>GX.ui.closeAll());await w(1500);const ss3=await R(p,'subsurf');ok(Math.abs(ss3.l-720)<=2&&ss3.r>=1439,'no dock: split returns to the normal half/half '+JSON.stringify(ss3));
await p.evaluate(()=>{document.getElementById('subSplit')?.click();GX.subsurface.close?.()});await w(800);
// vpad / controller controls (vpad.js lives in feat/controls; here a stand-in with the same ids and base CSS)
await p.evaluate(()=>{const v=document.createElement('div');v.id='vpad';v.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9640';v.innerHTML='<div id=vpR style="position:absolute;right:20px;bottom:20px;width:120px;height:120px;background:#3a5;pointer-events:auto"></div>';document.body.appendChild(v);
 const t=document.createElement('button');t.id='vpToggle';t.textContent='🎮';t.style.cssText='position:fixed;bottom:14px;right:14px;z-index:9650';document.body.appendChild(t)});
await p.click('#uiTab_data');await w(1200);const dk=await p.evaluate(()=>parseInt(getComputedStyle(document.body).getPropertyValue('--dkR')));
const vr=await R(p,'vpR'),vt=await R(p,'vpToggle');ok(dk>200&&vr.r<=1440-dk&&vt.r<=1440-dk,`vpad and toggle sit left of the dock (dock ${dk}, pad right ${vr.r}, toggle right ${vt.r})`);
await p.screenshot({path:SH+'5_desk_vpad.png'});await ctx.close();

// ---- dock-split: min pane width with Data 640 + Crew 360 docks
async function splitCase(vp,tag){const cx=await b.createBrowserContext();const p=await page(cx,vp);await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:90000});
 await p.evaluate(()=>localStorage.setItem('dw_desk',JSON.stringify({open:[],w:{data:640,crew:360},col:{}})));await go(p);
 await p.click('#uiTab_crew');await w(1000);await p.click('#uiTab_data');await w(1200);
 await p.evaluate(async()=>{const s=GX.subsurface;if(!s.state().open)await s.open?.()});await w(2500);
 await p.evaluate(()=>{const b=document.getElementById('subSplit');b?b.click():GX.subsurface.split?.(true)});await w(3000);
 const st=await p.evaluate(()=>{const ss=document.getElementById('subsurf').getBoundingClientRect(),dkR=parseInt(getComputedStyle(document.body).getPropertyValue('--dkR'));const sw=window.__dwSplitW;
  return {ssL:Math.round(ss.left),ssR:Math.round(ss.right),ssT:Math.round(ss.top),ssW:Math.round(ss.width),dkR,sw,col:{...GX.ui.DK.col},auto:{...(GX.ui.DK.autoCol||{})},stack:document.getElementById('subsurf').classList.contains('dkStack')}});
 const M=await p.evaluate(()=>GX.dock.MIN);
 const rigW=st.stack?vp.width-104:st.sw-104;ok(st.ssW>=M&&rigW>=M,`${tag}: both panes >= ${M}px (rig ${rigW}, subsurface ${st.ssW}) ${JSON.stringify(st)}`);
 await p.screenshot({path:SH+tag+'_split.png'});
 return {p,cx,st,M}}
{const {p,cx,st,M}=await splitCase({width:1440,height:900},'7_1440');
 ok(Object.keys(st.auto).length>=1&&st.col.data,'1440: widest dock (Data) auto-collapsed to a strip');
 // drag the splitter: rig share changes and is saved
 const hx=await p.evaluate(()=>{const r=document.getElementById('dkSplitH').getBoundingClientRect();return r.display=='none'?null:[r.left+5,400]});
 ok(!!hx,'splitter handle shown');await p.mouse.move(...hx);await p.mouse.down();await p.mouse.move(hx[0]+60,400,{steps:5});await p.mouse.up();await w(800);
 const s1=await p.evaluate(()=>({sw:window.__dwSplitW,split:JSON.parse(localStorage.getItem('dw_desk')).split}));
 ok(Math.abs(s1.sw-(hx[0]+60-0))<=8&&s1.split>0.5,'drag splitter moves the split and saves dw_desk.split '+JSON.stringify(s1));
 // drag far: clamped to min
 await p.mouse.move(s1.sw,400);await p.mouse.down();await p.mouse.move(1430,400,{steps:5});await p.mouse.up();await w(800);
 const ssw=await p.evaluate(()=>Math.round(document.getElementById('subsurf').getBoundingClientRect().width));ok(ssw>=M,'splitter is clamped: subsurface keeps '+ssw+'px');
 await p.screenshot({path:SH+'8_1440_dragged.png'});
 // reload keeps split share
 await p.evaluate(()=>{const b=document.getElementById('subSplit');b?.click()});await w(1500);
 const back=await p.evaluate(()=>({col:{...GX.ui.DK.col},auto:Object.keys(GX.ui.DK.autoCol||{}).length,h:getComputedStyle(document.getElementById('dkSplitH')).display}));
 ok(!back.col.data&&back.auto==0&&back.h=='none','close split: auto-collapsed dock expands again, splitter hidden '+JSON.stringify(back));
 await go(p);ok(await p.evaluate(()=>GX.ui.DK.split>0.5),'reload keeps saved split share');await cx.close()}
{const {cx,st}=await splitCase({width:1920,height:1080},'9_1920');ok(!st.stack,'1920: side-by-side split kept');await cx.close()}
{const {cx,st}=await splitCase({width:1100,height:800},'10_1100');ok(!st.stack,'1100: strips give room, side-by-side kept');await cx.close()}
{const cx=await b.createBrowserContext();const p=await page(cx,{width:1024,height:768});await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:90000});
 await p.evaluate(()=>localStorage.setItem('dw_desk',JSON.stringify({open:[],w:{},col:{}})));await go(p);
 for(const k of ['data','sheet','tools','plan','crew']){await p.evaluate(k=>GX.ui.dockOpen(k),k);await w(700)}
 await p.evaluate(async()=>{const s=GX.subsurface;if(!s.state().open)await s.open?.()});await w(2500);
 await p.evaluate(()=>{const b=document.getElementById('subSplit');b?b.click():GX.subsurface.split?.(true)});await w(3500);
 const st=await p.evaluate(()=>{const e=document.getElementById('subsurf'),r=e.getBoundingClientRect();return {stack:e.classList.contains('dkStack'),t:Math.round(r.top),w:Math.round(r.width),open:GX.ui.DK.open.length,col:Object.keys(GX.ui.DK.col).length}});
 ok(st.col==5&&(st.stack?st.t>=380:st.w>=360),'1024 with 5 docks: all auto-collapsed to strips, panes >= 360 or stacked '+JSON.stringify(st));
 await p.screenshot({path:SH+'11_1024_stacked.png'});await cx.close()}
// ---- phone
const pc=await b.createBrowserContext();const q=await page(pc,{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await go(q);
ok(await q.evaluate(()=>!document.body.classList.contains('desk')),'phone: no desk mode');
await q.evaluate(()=>document.getElementById('uiTab_crew').click());await w(1200);await q.evaluate(()=>document.getElementById('uiTab_data').click());await w(1500);
const pcv=await R(q,'chatSheet');ok(!pcv?.vis,'phone: one panel at a time (chat closed when data opened)');
ok(await q.evaluate(()=>!document.querySelector('.dkC_btn,.dk')),'phone: no dock or collapse buttons');
ok(await q.evaluate(()=>getComputedStyle(document.getElementById('uiNav')).bottom=='0px'),'phone: bottom nav unchanged');
await q.screenshot({path:SH+'6_phone_data.png'});await pc.close();
ok(!errs.length,'no page errors '+errs.join(' | ').slice(0,300));ok(!bad.length,'no external network');
console.log(`\n${pass} passed, ${fails} failed`);await b.close();process.exit(fails?1:0)
