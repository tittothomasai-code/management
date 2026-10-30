// v5.9.3 Monitor-a-well test: 4th start tile, SIM view (labelled SIM, never LIVE), MD advances, ETA, surveys w/ distance to plan, 3 charts;
// saved WITSML well -> WITSML source via existing panel only, no witsml/adaga/supabase requests made by the page. No network writes.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'122_monitor_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const bad=[],errs=[];
async function pg(url,vp,pre){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});if(pre)await p.evaluateOnNewDocument(pre);
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|witsml|:8796|:8799/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}if(/supabase\.co/.test(u))return r.abort();r.continue()});
 await p.goto(url,{waitUntil:'load',timeout:120000});return p}
const PH={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},DK={width:1440,height:900};
for(const [nm,vp] of [['phone',PH],['desk',DK]]){
 const p=await pg(BASE+'/?start=1',vp);await p.waitForSelector('#st_monitor',{timeout:60000}).catch(()=>{});
 const n=await p.evaluate(()=>document.querySelectorAll('#start .tile, .tile[data-go]').length);const has=await p.$('#st_monitor');
 ok(!!has,nm+': start screen has "Monitor a well" tile ('+n+' tiles)');ok(await p.evaluate(()=>/Monitor a well/.test(document.getElementById('st_monitor')?.textContent||'')),nm+': tile label');
 if(nm=='phone')await p.screenshot({path:SH+'0_start_phone.png'});
 await p.evaluate(()=>document.getElementById('st_monitor').click());await p.waitForSelector('#mon',{timeout:30000}).catch(()=>{});await w(1500);
 const a=await p.evaluate(()=>({t:document.getElementById('mon')?.innerText||'',cv:document.querySelectorAll('#mon canvas').length,md:+document.getElementById('monMD')?.textContent,sv:document.querySelectorAll('#monSv tbody tr td:nth-child(4)').length,eta:document.getElementById('monETA')?.textContent,src:GX.monitor?.M.src}));
 ok(a.src=='SIM'&&/\bSIM\b/.test(a.t),nm+': no saved WITSML → SIM well, labelled SIM');ok(!/\bLIVE\b/i.test(a.t),nm+': never says LIVE');
 ok(a.cv>=3,nm+': depth-vs-time, depth-vs-plan, traces canvases ('+a.cv+')');ok(a.md>0,nm+': MD shown '+a.md+' m');ok(a.sv>=3,nm+': latest surveys with distance to plan ('+a.sv+' rows)');
 ok(/h|d|At TD/.test(a.eta||''),nm+': ETA to TD '+a.eta);ok(/Hole section \/ casing/.test(a.t)&&/(drilling to|All casing)/.test(a.t),nm+': hole section / casing point line');
 ok(/Drilling|Connection|Casing point|At TD/.test(a.t),nm+': activity / rig state shown');ok(/Depth vs time/.test(a.t)&&/Depth vs plan/.test(a.t)&&/Key traces/.test(a.t)&&/ROP/.test(a.t),nm+': panel titles');
 await w(3500);const md2=await p.evaluate(()=>+document.getElementById('monMD').textContent);ok(md2>=a.md&&await p.evaluate(()=>GX.monitor.M.hist.length>50),nm+': SIM advances ('+a.md+'→'+md2+' m)');
 const ink=await p.evaluate(()=>{const c=document.getElementById('monDT'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let k=0;for(let i=0;i<d.length;i+=16)if(d[i+3])k++;return k});ok(ink>200,nm+': depth-vs-time chart drawn');
 if(nm=='phone'){const ov=await p.evaluate(()=>document.getElementById('mon').scrollWidth<=innerWidth+1);ok(ov,'phone: no horizontal overflow')}
 await p.screenshot({path:SH+'1_sim_'+nm+'.png',fullPage:false});if(nm=='phone'){await p.evaluate(()=>document.getElementById('mon').scrollTo(0,9999));await w(300);await p.screenshot({path:SH+'2_sim_phone_surveys.png'})}
 await p.evaluate(()=>document.getElementById('monX').click());ok(await p.evaluate(()=>!document.getElementById('mon')),nm+': close button');await p.close()}
// saved WITSML well (url/well only, no password) -> WITSML source, existing panel only, no requests
const q=await pg(BASE+'/?monitor=1',DK,()=>localStorage.setItem('dw-witsml-remember',JSON.stringify({url:'https://witsml.example.invalid/store',proxy:'',username:'demo',well:'Saved Well 7'})));
await q.waitForSelector('#mon',{timeout:60000}).catch(()=>{});await w(2500);
const c=await q.evaluate(()=>({t:document.getElementById('mon')?.innerText||'',src:GX.monitor?.M.src}));
ok(c.src=='WITSML'&&/Saved WITSML connection: Saved Well 7/.test(c.t),'saved WITSML well → monitor uses saved connection ('+c.src+')');ok(!/\bLIVE\b/i.test(c.t),'saved: never says LIVE');
ok(/Waiting for data|not connected|WITSML/.test(c.t)&&!/\(SIM\)/.test(c.t.split('\n')[0]),'saved: no fake SIM data shown as the well');
await q.screenshot({path:SH+'3_saved_witsml.png'});ok(bad.length==0,'no WITSML/Adaga requests made ('+bad.length+')');
ok(errs.filter(e=>!/WebSocket|supabase|Failed to fetch/i.test(e)).length==0,'no page errors '+errs.slice(0,2).join(' | '));
await b.close();console.log(`monitor ${pass} pass, ${fails} fail`);process.exit(fails?1:0)
