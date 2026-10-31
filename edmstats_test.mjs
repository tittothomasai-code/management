// v5.9.4.2 EDM well stats + field stats + filters — synthetic fixtures only (two made-up pads). Unit checks on edmstats.js, then phone + desk browser:
// well stats table, filter sheet, badge, 3D/labels/pick/search/list hide filtered-out wells, dim mode, persistence per saved site (close/reopen + reload), Clear all.
import puppeteer from 'puppeteer-core';import fs from 'fs';import {pad} from './fixtures/mkedm.mjs';import * as ES from './edmstats.js';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/127_edmstats_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
// ---- unit ----
{const P=[{md:0,inc:0,azi:0,tvd:0,ew:0,ns:0},{md:500,inc:0,azi:0,tvd:500,ew:0,ns:0},{md:800,inc:30,azi:90,tvd:785,ew:76,ns:0},{md:1200,inc:90,azi:90,tvd:950,ew:400,ns:0},{md:2200,inc:90,azi:90,tvd:950,ew:1400,ns:0}];const s=ES.trajStats(P);
 ok(s.maxInc==90&&s.kop==500&&s.land==1200&&s.lat==1000&&s.disp==1400&&s.cAz==90&&s.md1==2200,`unit: horizontal trajStats KOP ${s.kop}, land ${s.land}, lateral ${s.lat}, closure ${s.disp}@${s.cAz}`);
 ok(Math.abs(s.maxDls-4.5)<0.05,`unit: max DLS 4.5 °/30 m (${s.maxDls})`);ok(ES.wellType(5)=='Vertical'&&ES.wellType(45)=='Directional'&&ES.wellType(88)=='Horizontal'&&ES.wellType(null)=='Unknown','unit: well type from max inclination');
 const ap=ES.pathStats(P.map(p=>({md:p.md,E:p.ew+10,N:p.ns,Z:p.tvd,tvd:p.tvd})),10,0);ok(ap.approx&&ap.maxInc>85&&Math.abs(ap.disp-1400)<1,`unit: path fallback approx (inc ${ap.maxInc}, disp ${ap.disp})`);
 const F=ES.emptyFilter();ok(ES.active(F)==0,'unit: empty filter inactive');F.td=[100,null];F.type=['Vertical'];F.has.casing=true;ok(ES.active(F)==3,'unit: active count 3');
 const H=ES.hist([1,2,3,4,100],4,0,100);ok(H.c.join()=='4,0,0,1','unit: histogram bins '+H.c)}
// ---- browser ----
const A=pad({wells:4}),B=pad({wells:3}).replace(/"S1"/g,'"S2"').replace(/SYNTH PAD A/,'SYNTH PAD B').replace(/loc_easting="500000"/,'loc_easting="503000"').replace(/(well_id|wellbore_id|design_id|definitive_survey_id|plan_id|datum_id|assembly_id|target_id)="([^"]+)"/g,'$1="Q$2"').replace(/SYN-(\d)/g,'SYB-$1');
const body=s=>s.replace(/^[\s\S]*?<export>/,'').replace(/<\/export>\s*$/,'');const FX='/tmp/edm_two_pads_st.xml';fs.writeFileSync(FX,`<?xml version="1.0"?>\n<export>${body(A)}${body(B)}</export>`);
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],posts=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(nm+': '+e.message));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))posts.push(r.method()+' '+r.url())});p.on('dialog',d=>d.accept());
 await p.goto(BASE+'/?nosplash=1&edm=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.edm&&document.getElementById('edm'),{timeout:120000});await w(600);
 await (await p.$('#edmf')).uploadFile(FX);await p.waitForFunction(()=>GX.edm.ST.R?.W&&GX.edm.ST.saved,{timeout:60000});
 const openMap=async()=>{await p.evaluate(()=>GX.edm.openMap());await p.waitForFunction(()=>GX.edmmap?.open&&document.querySelector('#edmmap canvas'),{timeout:30000});await w(1200)};await openMap();
 // well stats
 await p.evaluate(()=>GX.edmmap.select('well',2,true));await w(900);
 const ws=await p.evaluate(()=>{const t=document.getElementById('emdb').innerText;const s=GX.edmmap.wstats(2);return {t,s}});
 ok(/Well stats/.test(ws.t)&&/Max inclination/.test(ws.t)&&/Max DLS/.test(ws.t)&&/KOP MD/.test(ws.t)&&/Displacement/.test(ws.t)&&/Casing strings/.test(ws.t)&&/Surveys/.test(ws.t),`${nm}: well detail shows stats table`);
 ok(Math.abs(ws.s.maxInc-25)<0.6&&Math.abs(ws.s.kop-600)<60&&ws.s.nCas==2&&ws.s.casSizes.join()=='13.375,9.625'&&ws.s.nSurv>=1&&ws.s.type=='Directional'&&!ws.s.approx,`${nm}: stats values (inc ${ws.s.maxInc}, KOP ${ws.s.kop}, casing ${ws.s.casSizes}, ${ws.s.type})`);
 await p.screenshot({path:SH+nm+'_1_wellstats.png'});await p.click('#emdx');await w(300);
 // filter sheet
 await p.click('#emfb');await w(600);const fv=await p.evaluate(()=>{const r=document.getElementById('emfp').getBoundingClientRect();return {vis:getComputedStyle(document.getElementById('emfp')).display=='flex',in:r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1,t:document.getElementById('emfp').innerText}});
 ok(fv.vis&&fv.in,`${nm}: filter sheet opens on screen`);ok(/7 wells/.test(fv.t)&&/Field stats/.test(fv.t)&&/TD \(MD\) histogram/.test(fv.t)&&/Max inclination histogram/.test(fv.t)&&/Status/.test(fv.t),`${nm}: field stats with histograms shown`);
 await p.screenshot({path:SH+nm+'_2_filters.png'});
 // site filter via UI select
 await p.evaluate(()=>{const s=document.getElementById('emfs');for(const o of s.options)o.selected=/PAD B/.test(o.textContent);s.dispatchEvent(new Event('change'))});await w(700);await p.waitForFunction(()=>GX.edmmap?.settled?.(),{timeout:60000,polling:100}).catch(()=>{});
 let r=await p.evaluate(()=>{const M=GX.edmmap;const vis=M.W.wells.map((w,i)=>M.visible(i));return {vis,bdg:document.getElementById('embdg').textContent,cnt:document.getElementById('emcnt').innerText,fn:document.getElementById('emfn').innerText,fs:M.fstats()}});
 ok(r.vis.filter(Boolean).length==3&&r.bdg=='1',`${nm}: site filter → 3 of 7 visible, badge ${r.bdg}`);ok(/3 of 7 wells/.test(r.cnt)&&/3 of 7 wells match/.test(r.fn)&&r.fs.wells==3,`${nm}: counts update (${r.cnt})`);
 await p.click('#emfx');await w(300);await p.evaluate(()=>GX.edmmap.fit());await w(1200);
 r=await p.evaluate(()=>{const M=GX.edmmap,W=M.W;const hidden=W.wells.map((w,i)=>i).filter(i=>!M.visible(i));const picks=hidden.map(i=>{const q=M.screen('well',i);if(!q)return null;const h=M.pick(q[0],q[1],6);return h&&h.kind=='well'&&!M.visible(h.i)?'bad':'ok'});
  const labs=[...document.querySelectorAll('#edmmap .eml')].filter(e=>e.offsetParent).map(e=>e.textContent);const q=document.getElementById('emq');q.value='SY';q.dispatchEvent(new Event('input'));const res=document.getElementById('emres').innerText;
  document.getElementById('emlist').click();const list=document.getElementById('emdt').innerText+' '+document.getElementById('emdb').innerText;return {picks,labs,res,list}});
 ok(!r.picks.includes('bad'),`${nm}: hidden wells not pickable`);ok(!r.labs.some(t=>/SYN-|PAD A/.test(t)),`${nm}: no labels for filtered-out wells/sites (${r.labs.slice(0,4)})`);
 ok(!/SYN-\d/.test(r.res)&&/SYB-/.test(r.res)&&/filtered-out/.test(r.res),`${nm}: search lists only matching wells`);ok(/PAD B/.test(r.list)&&!/PAD A/.test(r.list)&&/1 of 2/.test(r.list),`${nm}: sites list filtered`);
 await p.screenshot({path:SH+nm+'_3_filtered.png'});await p.click('#emdx');await w(200);
 // dim mode
 r=await p.evaluate(()=>{const M=GX.edmmap;M.filter({...M.getF(),only:false});return M.W.wells.map((w,i)=>M.visible(i)).filter(Boolean).length});ok(r==7,`${nm}: "show only filtered" off → others dimmed, still shown (${r})`);
 await p.evaluate(()=>{const M=GX.edmmap;M.filter({...M.getF(),only:true})});
 // persistence: close/reopen + reload/open saved
 await p.evaluate(()=>GX.edmmap.close());await w(300);await openMap();r=await p.evaluate(()=>({f:GX.edmmap.getF(),n:GX.edmmap.W.wells.filter((w,i)=>GX.edmmap.visible(i)).length,b:document.getElementById('embdg').textContent}));
 ok(r.f.sites.length==1&&r.n==3&&r.b=='1',`${nm}: filter persists when the map is reopened`);
 const sid=await p.evaluate(()=>GX.edm.ST.saved.id);await p.goto(BASE+'/?nosplash=1&edm=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.edm,{timeout:120000});await w(500);
 await p.evaluate(id=>GX.edm.openSaved(id),sid);await p.waitForFunction(()=>GX.edm.ST.R?.W,{timeout:60000});await openMap();
 r=await p.evaluate(()=>({n:GX.edmmap.W.wells.filter((w,i)=>GX.edmmap.visible(i)).length,b:document.getElementById('embdg').textContent}));ok(r.n==3&&r.b=='1',`${nm}: filter persists for the saved site after reload (${r.n} visible)`);
 // type + TD + has filters via API, then Clear all
 r=await p.evaluate(()=>{const M=GX.edmmap;const a=M.filter({type:['Vertical']}).n,b2=M.filter({inc:[20,null]}).n,c=M.filter({has:{casing:false}}).n,d=M.filter({q:'syb-2'}).n;return [a,b2,c,d]});
 ok(r[0]==2&&r[1]==3&&r[2]==0&&r[3]==1,`${nm}: type/inc/has/name filters (${r})`);
 await p.click('#emfb');await w(400);await p.click('#emfclr');await w(500);r=await p.evaluate(()=>({n:GX.edmmap.W.wells.filter((w,i)=>GX.edmmap.visible(i)).length,b:document.getElementById('embdg').textContent,t:document.getElementById('edmmap').innerText}));
 ok(r.n==7&&r.b=='',`${nm}: Clear all restores 7 wells, badge cleared`);ok(!/\bLIVE\b/.test(r.t),`${nm}: no LIVE label`);
 await ctx.close()}
ok(!posts.length,'no upload: zero non-GET requests ('+posts.slice(0,3)+')');ok(!errs.length,'no page errors '+errs.slice(0,3));
await b.close();console.log(`edmstats ${pass} pass, ${fails} fail`);process.exit(fails?1:0);
