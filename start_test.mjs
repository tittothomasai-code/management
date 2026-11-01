// v5.9.1 start-screen test: each tile lands in the right place (keyboard, touch/click, gamepad), version shown, sound defaults OFF,
// ?s=CODE skips to join, ?nosplash skips, Continue only with saved state, no SIM/TEST cell ever tagged LIVE. 116_start_* shots (desk 1440x900 + phone 390x844).
import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,'');const DIR=process.env.SHOTDIR||'shots_live';const PRE=process.env.SHOT||'116_start_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[];
const PAD=`(()=>{const G={index:0,id:'SIM pad',connected:true,axes:[0,0,0,0],buttons:[...Array(17)].map(()=>({pressed:false,value:0}))};window.__pad=G;navigator.getGamepads=()=>[G]})()`;
async function page(vp,path,{fresh=true,abortNet=false,pre=null}={}){const ctx=await br.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);await p.evaluateOnNewDocument(PAD);if(pre)await p.evaluateOnNewDocument(pre);
 if(abortNet){await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())?r.abort():r.continue())}
 else p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});
 p.on('pageerror',e=>/WebGL/.test(e.message)||console.log('pageerror',e.message));
 await p.goto(BASE+path,{waitUntil:'load',timeout:180000});await p.bringToFront();p.ctx=ctx;return p}
const vis=(p,sel)=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&getComputedStyle(e).display!='none'&&e.getBoundingClientRect().height>0},sel);
const gone=p=>p.waitForFunction(()=>!document.getElementById('start'),{timeout:20000}).then(()=>true,()=>false);
const tap=async(p,sel,touch)=>{await p.waitForSelector(sel,{timeout:20000});if(touch)await p.tap(sel);else await p.click(sel)};
const press=async(p,b)=>{await p.evaluate(b=>{__pad.buttons[b].pressed=true},b);await w(400);await p.evaluate(b=>{__pad.buttons[b].pressed=false},b);await w(400)};
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){const T=nm=='phone';
 // 1. menu, version, sound off, no Continue on a fresh device
 let p=await page(vp,'/?start=1');await p.waitForSelector('#start .tile',{timeout:60000});await w(1200);
 const m=await p.evaluate(()=>({tiles:[...document.querySelectorAll('#start .tiles .tile')].map(b=>b.dataset.go),ver:document.getElementById('stVer').textContent,meta:document.querySelector('meta[name=app-version]').content,snd:document.getElementById('stSnd').textContent,sim:!!document.querySelector('#start .sim'),live:/\bLIVE\b/.test(document.getElementById('start').innerText),r:(q=>({width:q.width,height:q.height}))(document.getElementById('start').getBoundingClientRect()),over:[...document.querySelectorAll('#start .tiles .tile')].every(b=>{const q=b.getBoundingClientRect();return q.left>=0&&q.right<=innerWidth&&q.bottom<=innerHeight})}));
 ok(m.tiles.join()=='grp:drill,grp:plan,grp:monitor,grp:ops',`${nm}: main menu = 4 groups Drill/Plan/Monitor/Operations [${m.tiles}]`);
 ok(m.ver&&m.ver==m.meta&&/^v5\.(9|1[0-9])/.test(m.ver),`${nm}: version on screen = ${m.ver}`);
 ok(/Sound off/.test(m.snd),`${nm}: sound defaults OFF`);ok(m.sim&&!m.live,`${nm}: SIM label, no LIVE`);ok(m.r.width==vp.width&&m.r.height==vp.height&&m.over,`${nm}: full-screen, all tiles on screen (${m.r.width}x${m.r.height}, ${m.over})`);
 await p.screenshot({path:`${DIR}/${PRE}${nm}_1_menu.png`});
 // keyboard: Down moves focus, Enter on New simulation opens SIM picker, Esc goes back
 await p.keyboard.press('ArrowDown');let f=await p.evaluate(()=>document.querySelector('#start .tile.on')?.dataset.go);ok(f==(T?'grp:plan':'grp:monitor'),`${nm}: keyboard ArrowDown moves focus (${f})`);
 await p.keyboard.press('ArrowUp');await p.keyboard.press('Enter');await w(300);let dr=await p.evaluate(()=>[...document.querySelectorAll('#start .tiles .tile')].map(b=>b.dataset.go).join());ok(dr=='sim,ddcab,ddtracks,showroom,back',`${nm}: Enter on Drill → Drill page (${dr})`);
 await p.screenshot({path:`${DIR}/${PRE}${nm}_1b_drill.png`});f=await p.evaluate(()=>document.querySelector('#start .tile.on')?.dataset.go);
 await p.keyboard.press('Enter');await w(300);await p.waitForFunction(()=>[...document.querySelectorAll('#start .tiles .tile')].map(b=>b.dataset.go).join()=='simA,simFree,back',{timeout:30000,polling:50}).catch(()=>{});let sub=await p.evaluate(()=>[...document.querySelectorAll('#start .tiles .tile')].map(b=>b.dataset.go).join());ok(f=='sim'&&sub=='simA,simFree,back',`${nm}: Enter on New simulation → SIM well picker (${sub})`);
 await p.screenshot({path:`${DIR}/${PRE}${nm}_2_sim_picker.png`});
 await p.keyboard.press('Escape');await w(200);sub=await p.evaluate(()=>[...document.querySelectorAll('#start .tiles .tile')].map(b=>b.dataset.go).join());ok(sub.startsWith('sim,'),'Esc → back to Drill page ('+sub+')');
 await p.keyboard.press('Escape');await w(200);sub=await p.evaluate(()=>[...document.querySelectorAll('#start .tiles .tile')].map(b=>b.dataset.go).join());ok(sub=='grp:drill,grp:plan,grp:monitor,grp:ops','Esc again → main menu');
 // sound toggle
 await tap(p,'#stSnd',T);ok(/Sound on/.test(await p.$eval('#stSnd',e=>e.textContent)),`${nm}: sound toggle turns on`);await tap(p,'#stSnd',T);
 // New simulation → SIM proposal A (touch/click)
 await tap(p,'#st_grp\\:drill',T);await tap(p,'#st_sim',T);await tap(p,'#st_simA',T);let g=await gone(p);await p.waitForFunction(()=>window.GX?.wplan?.W?.P,{timeout:120000});
 let r=await p.evaluate(()=>({last:dwStart.last,name:GX.wplan.W.P.name,c:GX.wplan.W.P.casing.length,wp:document.getElementById('wp')?.style.display}));
 ok(g&&r.last=='simA'&&r.name=='SIM proposal A'&&r.c==3&&r.wp!='block',`${nm}: New simulation → SIM proposal A loaded, rig view (${JSON.stringify(r)})`);
 await w(2500);await p.screenshot({path:`${DIR}/${PRE}${nm}_3_sim_started.png`});await p.ctx.close();
 // Free drilling via gamepad: A on New simulation, d-pad down, A
 p=await page(vp,'/?start=1');await p.waitForSelector('#start .tile',{timeout:60000});await w(800);await press(p,0);await w(800);await press(p,0);await w(200);await press(p,15);
 f=await p.evaluate(()=>document.querySelector('#start .tile.on')?.dataset.go);await press(p,0);g=await gone(p);
 ok(f=='simFree'&&g&&await p.evaluate(()=>dwStart.last)=='simFree',`${nm}: gamepad A / d-pad right → Free drilling, start screen closes (${f},${g})`);
 await p.ctx.close();
 // New well → Well Planning, blank proposal
 p=await page(vp,'/?start=1');await tap(p,'#st_grp\\:plan',T);await tap(p,'#st_well',T);g=await gone(p);await p.waitForFunction(()=>document.getElementById('wp')?.style.display=='block',{timeout:120000}).catch(()=>{});await w(800);
 r=await p.evaluate(()=>({last:dwStart.last,name:GX.wplan.W.P.name,c:GX.wplan.W.P.casing.length,t:GX.wplan.W.P.targets.length,view:GX.wplan.W.view,wp:document.getElementById('wp')?.style.display}));
 ok(g&&r.last=='wplan'&&r.wp=='block'&&r.name=='New well (SIM)'&&r.c==0&&r.t==1&&r.view=='inputs',`${nm}: New well → Well Planning inputs, blank SIM proposal (${JSON.stringify(r)})`);
 await p.screenshot({path:`${DIR}/${PRE}${nm}_4_new_well.png`});await p.ctx.close();
 // Log in as player → name join (no password); after name → session panel (lobby / join by code). Network aborted: nothing written.
 p=await page(vp,'/?start=1',{abortNet:true});await tap(p,'#st_login',T);g=await gone(p);await p.waitForSelector('#plJoin #plName',{timeout:60000}).catch(()=>{});
 r=await p.evaluate(()=>({last:dwStart.last,join:!!document.getElementById('plJoin'),pw:!!document.querySelector('#plJoin input[type=password]')}));
 ok(g&&r.last=='join'&&r.join&&!r.pw,`${nm}: Log in as player → name join, no password field`);
 await p.screenshot({path:`${DIR}/${PRE}${nm}_5_login.png`});
 await p.$eval('#plName',e=>e.value='');await p.$eval('#plName',e=>e.focus());await p.keyboard.type('Start Tester');await p.$eval('#plJoin form',f=>f.requestSubmit());await p.waitForFunction(()=>document.getElementById('sessPanel')?.style.display=='block',{timeout:60000}).catch(()=>{});
 r=await p.evaluate(()=>({n:GX.player.name,sp:document.getElementById('sessPanel')?.style.display}));ok(r.n=='Start Tester'&&r.sp=='block',`${nm}: after name → session panel (lobby / join by code) opens (${JSON.stringify(r)})`);
 await p.ctx.close();
 // Continue only with saved state
 p=await page(vp,'/?start=1',{pre:`try{localStorage.setItem('dw_start_save','{"dest":"simA"}')}catch(e){}`});await p.waitForSelector('#start .tile',{timeout:60000});
 await p.keyboard.press('Enter');await w(300);r=await p.evaluate(()=>[...document.querySelectorAll('#start .tiles .tile')].map(b=>b.dataset.go).join());ok(r=='continue,sim,ddcab,ddtracks,showroom,back',`${nm}: saved state → Continue first on Drill page (${r})`);
 if(nm=='desk')await p.screenshot({path:`${DIR}/${PRE}${nm}_6_continue.png`});
 await p.keyboard.press('Enter');g=await gone(p);ok(g&&await p.evaluate(()=>dwStart.last)=='continue',`${nm}: Continue → resumes saved game`);await p.ctx.close();
 // ?s=CODE skips straight to join (network aborted so no session write)
 p=await page(vp,'/?s=abc123&start=1',{abortNet:true});await p.waitForSelector('#plJoin',{timeout:60000}).catch(()=>{});await w(500);
 r=await p.evaluate(()=>({st:!!document.getElementById('start'),join:!!document.getElementById('plJoin'),code:document.getElementById('plCode')?.value}));
 ok(!r.st&&r.join&&r.code=='ABC123',`${nm}: ?s=CODE skips the start screen → join with code ${r.code}`);await p.ctx.close();
}
// ?nosplash and automated runs skip
{const p=await page({width:1440,height:900},'/?nosplash=1');await w(3000);ok(!await p.evaluate(()=>!!document.getElementById('start')),'?nosplash → no start screen');await p.ctx.close()}
// LIVE tag never on SIM/TEST data
{const p=await page({width:1440,height:900},'/?nosplash=1');await p.waitForFunction(()=>window.GX?.ss56,{timeout:180000});
 for(const src of ['test',null]){await p.evaluate(s=>s?GX.ss56.open(s):GX.ss56.open(),src);await w(2500);
  const r=await p.evaluate(()=>({tag:GX.ss56.UI.tagSrc,live:document.querySelectorAll('#ss56t td[title=LIVE],#ss56h [title=LIVE]').length,src:document.getElementById('ss56src').textContent}));
  ok(r.tag!='LIVE'&&r.live==0&&!/^LIVE/.test(r.src),`slide sheet ${src||'default'} source (${r.tag}): 0 cells tagged LIVE, badge "${r.src}"`)}
 await p.ctx.close()}
// v5.12.4.2 DD Tracks tile: click/tap → start closes, track select opens; shot per viewport
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){
 const p=await page(vp,'/?start=1');await p.waitForSelector('#start .tile[data-go=ddtracks]',{timeout:60000});await p.evaluate(()=>dwStart.reveal('ddtracks'));await w(1000);
 const lb=await p.evaluate(()=>document.querySelector('#start .tiles .tile[data-go=ddtracks]').textContent);ok(/DD Tracks/.test(lb)&&/SIM/.test(lb),`${nm}: DD Tracks tile shows "DD Tracks" + SIM`);
 await tap(p,'#start .tiles .tile[data-go=ddtracks]',nm=='phone');const g=await gone(p);
 const o=await p.waitForFunction(()=>window.GX?.ddtracks?.isOpen?.(),{timeout:60000}).then(()=>true,()=>false);
 ok(g&&o,`${nm}: DD Tracks tile → start closes, track select opens`);await w(1200);
 fs.mkdirSync(DIR,{recursive:true});await p.screenshot({path:`${DIR}/${PRE}ddtracks_${nm}.png`});
 const sv=await p.evaluate(()=>{try{return JSON.parse(localStorage.getItem('dw_start_save')||'null')?.dest}catch(e){return 'err'}});ok(sv!='ddtracks',`${nm}: DD Tracks does not write a Continue save (${sv})`);await p.ctx.close()}
ok(EXT.length==0,'no Supabase/Adaga/WITSML requests'+(EXT.length?' '+EXT.slice(0,3):''));
await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
