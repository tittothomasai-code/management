// srbassets_test (v5.12.2.1): Showroom B opens on the C detail rig (rig #1, C's GLB + parts manifest, lighter LOD on phones);
// A's Assets curtain in B: tab opens/closes, rows = rig parts, tap a row zooms in close, tap again closes. Desk + phone.
// usage: node srbassets_test.mjs http://localhost:8961   shots shots_live/196_srba_*
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8961').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'196_srba_');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
for(const nm of (process.env.ONLY?[process.env.ONLY]:['desk','phone'])){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(VP[nm]);
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())&&!/\.js(\?|$)/.test(r.url())?r.abort():r.continue());
 await p.goto(BASE+'/?nosplash',{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.GX&&window.G&&G._scene&&GX.showroomAB,{timeout:180000});
 await p.evaluate(()=>{localStorage.removeItem('dw_srb_cfirst');localStorage.setItem('dw_showroom_ab','B');localStorage.setItem('dw_showroom_rig_b','jackup')});
 await p.evaluate(()=>GX.showroomAB.open());
 await p.waitForFunction(()=>GX.showroomB?.ST?.grp&&GX.showroomB.idle?.(),{timeout:300000,polling:250}).catch(()=>{});await w(1500);
 const r=await p.evaluate(()=>{const B=GX.showroomB,S=B.ST,r=S.rigs[S.i];return {i:S.i,id:r.id,src:r.src,lod:S.grp.userData.lod,base:r.base,n:S.rigs.length,ids:S.rigs.map(x=>x.id),parts:Object.keys(S.grp.userData.map).length}});
 const bman=await p.evaluate(()=>GX.showroomB.ST.man.rigs.map(r=>r.id));console.log(nm,JSON.stringify(r));
 ok(r.i==0&&r.src=='C'&&/assets\/rigsc\//.test(r.base),nm+': B opens on the C detail rig #1 ('+r.id+') from assets/rigsc');
 ok(nm=='phone'?r.lod!='H':r.lod=='H',nm+': C rig LOD '+r.lod+(nm=='phone'?' (lighter on phone)':' (high on desktop)'));
 ok(r.parts>=100,nm+': C parts manifest mapped ('+r.parts+' nodes)');
 if(bman)ok(r.n==bman.length+1&&bman.every((id,k)=>r.ids[k+1]==id),nm+': all '+bman.length+' B rigs kept in order after the C rig ('+r.n+' total)');
 await p.screenshot({path:SH+nm+'_B_Crig.png'});
 // Assets tab
 ok(await p.evaluate(()=>{const h=document.getElementById('srbAsHdl');return !!h&&/Assets/.test(h.textContent)&&!srbAs.classList.contains('open')}),nm+': Assets tab present, closed');
 await p.click('#srbAsHdl');await w(700);
 const t=await p.evaluate(()=>({open:srbAs.classList.contains('open'),hdr:[...srbAs.querySelectorAll('th')].map(x=>x.textContent).join('|'),rows:srbAs.querySelectorAll('tr.b').length,back:!!srbAs.querySelector('.srAsBack'),name:srbAs.querySelector('.srAsCrumb a')?.textContent,want:GX.showroomB.assetList().length}));
 ok(t.open&&t.hdr=='Asset|Type|Key spec|BOM'&&t.back&&t.rows>0&&t.rows==t.want,nm+': Assets opens: '+t.hdr+', Back + "'+t.name+'", '+t.rows+' rows');
 await p.screenshot({path:SH+nm+'_B_assets_open.png'});
 const d0=await p.evaluate(()=>GX.showroomB.focusInfo().dist);
 const k=await p.evaluate(()=>{const a=GX.showroomB.assetList(),x=a.find(r=>/top_drive|drawworks|bop|pump/.test(r.k))||a[0];return x.k});
 await p.click(`#srbAs tr.b[data-k="${k}"]`);await w(3500);
 const f=await p.evaluate(()=>({...GX.showroomB.focusInfo(),on:!!srbAs.querySelector('tr.b.on'),sub:srbAs.querySelectorAll('tr.c').length,base:GX.showroomB.zoomInfo().base}));
 console.log(nm,'focus',k,d0,'->',JSON.stringify(f));
 ok(f.path==k&&f.on,nm+': tap row "'+k+'" selects + expands ('+f.sub+' parts)');ok(f.dist<d0*.5&&f.dist<15,nm+': camera zoomed in close '+d0+' -> '+f.dist+' m');
 await p.screenshot({path:SH+nm+'_B_assets_zoom.png'});
 await p.click(`#srbAs tr.b[data-k="${k}"]`);await w(3000);
 const g=await p.evaluate(()=>({...GX.showroomB.focusInfo(),on:!!srbAs.querySelector('tr.b.on'),open:srbAs.classList.contains('open')}));
 ok(!g.path&&!g.on&&g.open&&g.dist>f.dist*2,nm+': tap same row again closes it, camera back out ('+g.dist+' m)');
 await p.click('#srbAsHdl');await w(700);ok(await p.evaluate(()=>!srbAs.classList.contains('open')),nm+': Assets tab closes');
 // switch rig: B rig 2 loads, assets refill
 await p.evaluate(()=>GX.showroomB.go(1));await p.waitForFunction(()=>GX.showroomB.ST.i==1&&GX.showroomB.ST.grp&&GX.showroomB.idle(),{timeout:240000,polling:250}).catch(()=>{});
 const r2=await p.evaluate(()=>({id:GX.showroomB.ST.rigs[1].id,n:GX.showroomB.assetList().length}));ok(r2.n>0,nm+': next rig '+r2.id+' assets '+r2.n);
 ok(!errs.length,nm+': no page errors '+errs.slice(0,2).join(' | '));
 ok(!(await p.evaluate(()=>/\bLIVE\b/.test(document.getElementById('showroomB')?.innerText||''))),nm+': no LIVE label');
 await ctx.close()}
await br.close();console.log(`${pass} passed, ${fail} failed`);process.exit(fail?1:0)
