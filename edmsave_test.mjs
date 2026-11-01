// v5.9.4.1 EDM map + saved-sites test — synthetic fixtures only (two made-up pads). Checks: all sites/wells in the 3D map, decluttered labels,
// tap/click a wellhead → detail panel, save to IndexedDB, reload, start-menu Saved sites list, open saved, remove with confirm. Phone + desk.
import puppeteer from 'puppeteer-core';import fs from 'fs';import {pad} from './fixtures/mkedm.mjs';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/126_edmsave_';const w=ms=>new Promise(r=>setTimeout(r,ms));const settle=async(p,ms)=>{await w(ms);await p.waitForFunction(()=>GX.edmmap?.settled?.(),{timeout:60000,polling:100}).catch(()=>{})};let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
// two synthetic pads 3 km apart → 2 sites, 7 wells
const A=pad({wells:4}),B=pad({wells:3}).replace(/"S1"/g,'"S2"').replace(/SYNTH PAD A/,'SYNTH PAD B').replace(/loc_easting="500000"/,'loc_easting="503000"').replace(/(well_id|wellbore_id|design_id|definitive_survey_id|plan_id|datum_id)="([^"]+)"/g,'$1="Q$2"').replace(/SYN-(\d)/g,'SYB-$1');
const body=s=>s.replace(/^[\s\S]*?<export>/,'').replace(/<\/export>\s*$/,'');const FX='/tmp/edm_two_pads.xml';fs.writeFileSync(FX,`<?xml version="1.0"?>\n<export>${body(A)}${body(B)}</export>`);
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],posts=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(nm+': '+e.message));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))posts.push(r.method()+' '+r.url())});
 let dialogs=0;p.on('dialog',d=>{dialogs++;d.accept()});
 await p.goto(BASE+'/?nosplash=1&edm=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.edm&&document.getElementById('edm'),{timeout:120000});await w(600);
 await (await p.$('#edmf')).uploadFile(FX);
 await p.waitForFunction(()=>GX.edm.ST.R?.W&&GX.edm.ST.saved,{timeout:60000});
 const s=await p.evaluate(()=>{const W=GX.edm.ST.R.W;return {sites:W.sites.length,wells:W.wells.length,wbs:W.wbs.length,saved:GX.edm.ST.saved,tag:W.tag}});
 ok(s.sites==2&&s.wells==7&&s.wbs==7&&s.tag=='IMPORT',`${nm}: two-pad import → 2 sites, 7 wells, IMPORT (${s.sites}/${s.wells}/${s.wbs})`);ok(!!s.saved?.id&&s.saved.size>0,`${nm}: auto-saved on device (${s.saved?.size} bytes)`);
 await p.evaluate(()=>GX.edm.openMap());await p.waitForFunction(()=>GX.edmmap?.open&&document.querySelector('#edmmap canvas'),{timeout:30000});await settle(p,1500);
 const m=await p.evaluate(()=>{const M=GX.edmmap,c=document.querySelector('#edmmap canvas').getBoundingClientRect();const on=M.W.wells.map((_,i)=>M.screen('well',i)).filter(q=>q&&q[0]>=0&&q[1]>=0&&q[0]<=c.width&&q[1]<=c.height).length;
  const L=[...document.querySelectorAll('#edmmap .eml')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect());let ov=0;for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],o=L[j];if(a.left<o.right&&o.left<a.right&&a.top<o.bottom&&o.top<a.bottom)ov++}
  return {on,n:M.W.wells.length,labels:L.length,ov,cnt:document.getElementById('emcnt').innerText,live:/\bLIVE\b/.test(document.getElementById('edmmap').innerText)}});
 ok(m.on==m.n,`${nm}: map frames all wellheads on screen (${m.on}/${m.n})`);ok(m.labels>0&&m.ov==0,`${nm}: labels decluttered (${m.labels} shown, ${m.ov} overlaps)`);ok(/2 sites · 7 wells/.test(m.cnt)&&!m.live,`${nm}: count bar "${m.cnt}", never LIVE`);
 await p.screenshot({path:SH+nm+'_1_map.png'});
 await p.evaluate(()=>{const M=GX.edmmap;M.select('site',M.W.sites.findIndex(x=>/PAD B/.test(x.name)),true);document.getElementById('emdx').click()});await settle(p,2500);
 const pt=await p.evaluate(()=>{const M=GX.edmmap,c=document.querySelector('#edmmap canvas').getBoundingClientRect();const i=M.W.wells.findIndex(x=>/SYB-2/.test(x.name));const q=M.screen('well',i);const X=c.left+q[0],Y=c.top+q[1];return [X,Y]});
 if(nm=='phone')await p.touchscreen.tap(pt[0],pt[1]);else await p.mouse.click(pt[0],pt[1]);await w(700);
 const d=await p.evaluate(()=>{const e=document.getElementById('emdet');return e&&e.offsetParent?e.innerText:''});
 ok(/SYB-2/.test(d)&&/SYNTH PAD B/.test(d)&&/\bm\b/.test(d),`${nm}: ${nm=='phone'?'tap':'click'} wellhead → detail panel with well, site, metres (${d.split('\n').slice(0,2).join(' | ')})`);await p.screenshot({path:SH+nm+'_2_detail.png'});
 // reload → start menu Saved sites → open → remove
 await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#st_saved',{timeout:60000});ok(true,`${nm}: after reload, start menu shows Saved sites tile`);await w(400);await p.screenshot({path:SH+nm+'_3_tile.png'});
 await (await p.evaluate(()=>dwStart.reveal('saved')),p.click('#st_saved'));await w(400);const row=await p.evaluate(()=>[...document.querySelectorAll('#start .svrow')].map(r=>r.innerText.replace(/\s+/g,' ')));ok(row.length==1&&/7 wells · 2 sites/.test(row[0])&&/[kM]B/.test(row[0]),`${nm}: saved list row "${row[0]}"`);await p.screenshot({path:SH+nm+'_4_list.png'});
 await p.click('[data-go^="open:"]');await p.waitForFunction(()=>GX.edmmap?.open&&GX.edmmap.W.wells.length==7,{timeout:60000});await w(1000);ok(true,`${nm}: open saved → map with 7 wells (no re-import)`);await p.screenshot({path:SH+nm+'_5_opened.png'});
 await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#st_saved',{timeout:60000});await (await p.evaluate(()=>dwStart.reveal('saved')),p.click('#st_saved'));await w(300);const d0=dialogs;await p.click('#start .svrm');await w(800);
 const left=await p.evaluate(async()=>(await (await import('./edmstore.js?v=5941')).list()).length);ok(dialogs==d0+1&&left==0,`${nm}: Remove asks to confirm, then deletes (left ${left})`);
 await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#st_edm',{timeout:60000});await w(1200);ok(!(await p.$('#st_saved')),`${nm}: Saved sites tile gone when list empty`);
 await ctx.close()}
ok(!posts.length,'no upload: zero non-GET requests ('+posts.slice(0,3)+')');ok(!errs.length,'no page errors '+errs.slice(0,3));
await b.close();console.log(`edmsave ${pass} pass, ${fails} fail`);process.exit(fails?1:0);
