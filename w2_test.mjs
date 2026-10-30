import puppeteer from 'puppeteer-core';import fs from 'fs';
import * as WP from './wplan.js';import * as AC from './wac.js';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const near=(a,b,t)=>Math.abs(a-b)<=t;
const M={...AC.MODEL,hole:0};const D2R=Math.PI/180;
// P1 parallel vertical wells 10 m apart (offset due east). Only inclination error acts horizontally: sigma_each = MD*sInc(rad).
{const r=AC.well('ref',{n:0,e:0},[{md:0,inc:0,azi:0},{md:2000,inc:0,azi:0}],'SIM',M),o=AC.well('off',{n:0,e:10},[{md:0,inc:0,azi:0},{md:2000,inc:0,azi:0}],'SIM',M),S=AC.scan(r,o,M);
 ok(S.every(s=>near(s.dist,10,1e-9)),'P1 C-C distance = 10 m at every station');ok(S.every(s=>s.md<1||near(s.tcAng,90,1e-6)),'P1 TC angle 90° (east, north-referenced)');
 const exp=md=>10/(M.k*Math.SQRT2*md*M.sInc*D2R);let e=0;for(const s of S)if(s.md>0&&s.sf<99)e=Math.max(e,Math.abs(s.sf-exp(s.md))/exp(s.md));ok(e<1e-9,'P1 SF = 10/(k·√2·MD·σinc) at all MD (max rel err '+e.toExponential(1)+')');
 const R=AC.report(r,[o],M)[0],aMD=10/(M.k*Math.SQRT2*M.alert*M.sInc*D2R),sMD=10/(M.k*Math.SQRT2*M.stop*M.sInc*D2R);
 ok(R.firstAlert==Math.ceil(aMD/10)*10&&R.firstStop==Math.ceil(sMD/10)*10,`P1 alert from ${R.firstAlert} m (analytic ${aMD.toFixed(1)}), stop from ${R.firstStop} m (analytic ${sMD.toFixed(1)})`);}
// P2 parallel slant wells, inc 60 azi 0, 10 m apart laterally (east): lateral sigma from azimuth only = MD*sAzi*sin60
{const rows=[{md:0,inc:60,azi:0},{md:1500,inc:60,azi:0}],r=AC.well('ref',{n:0,e:0},rows,'SIM',M),o=AC.well('off',{n:0,e:10},rows,'SIM',M),S=AC.scan(r,o,M);
 const exp=md=>10/(M.k*Math.SQRT2*md*M.sAzi*D2R*Math.sin(60*D2R));let e=0;for(const s of S)if(s.md>0&&s.sf<99)e=Math.max(e,Math.abs(s.sf-exp(s.md))/exp(s.md));
 ok(S.every(s=>near(s.dist,10,1e-9))&&e<1e-9,'P2 slant parallel: C-C 10 m, SF = 10/(k·√2·MD·σazi·sin60) (rel err '+e.toExponential(1)+')');ok(S.every(s=>s.md<1||near(s.tcAng,90,1e-6)),'P2 TC angle 90° right of high side');}
// P3 hole radius: SF uses (D - 2r)
{const m2={...M,hole:0.108},r=AC.well('ref',{n:0,e:0},[{md:0,inc:0,azi:0},{md:1000,inc:0,azi:0}],'SIM',m2),o=AC.well('off',{n:0,e:10},[{md:0,inc:0,azi:0},{md:1000,inc:0,azi:0}],'SIM',m2),s=AC.scan(r,o,m2).at(-1);
 ok(near(s.sf,(10-0.216)/(3*Math.SQRT2*1000*0.1*D2R),1e-9),'P3 hole radii subtracted: SF '+s.sf.toFixed(3));}
// E1 ellipse: vertical well, isotropic horizontal sigma = MD*sInc
{const w=AC.well('v',{n:0,e:0},[{md:0,inc:0,azi:0},{md:1000,inc:0,azi:0}],'SIM',M),p=w.pts.at(-1),[a,b]=AC.ellipse(p.C,p.t);ok(near(a,1000*0.1*D2R,1e-9)&&near(b,a,1e-9),'E1 vertical ellipse circular, 1σ '+a.toFixed(3)+' m');
 const s=AC.well('s',{n:0,e:0},[{md:0,inc:90,azi:0},{md:1000,inc:90,azi:0}],'SIM',M).pts.at(-1),[a2,b2]=AC.ellipse(s.C,s.t);ok(near(Math.max(a2,b2),1000*0.5*D2R,1e-9)&&near(Math.min(a2,b2),1000*0.1*D2R,1e-9),'E2 horizontal well: lateral 1σ '+Math.max(a2,b2).toFixed(2)+' (azi), vertical '+Math.min(a2,b2).toFixed(2)+' (inc)');}
// Beam: straight vertical ref, offset 5 m away below bit inside a 2° cone
{const r=AC.well('ref',{n:0,e:0},[{md:0,inc:0,azi:0},{md:1000,inc:0,azi:0}],'SIM',M),o=AC.well('off',{n:0,e:5},[{md:0,inc:0,azi:0},{md:1000,inc:0,azi:0}],'SIM',M),o2=AC.well('far',{n:0,e:60},[{md:0,inc:0,azi:0},{md:1000,inc:0,azi:0}],'SIM',M);
 const b=AC.beam(r,[o,o2],500,M);ok(b.hits.find(h=>h.off=='off').inside&&!b.hits.find(h=>h.off=='far').inside,'beam: 5 m offset inside, 60 m offset clear (r0 '+b.r0.toFixed(2)+' m)');}
// import
{const c=AC.parseCSV(fs.readFileSync('fixtures/offset_sim.csv','utf8'));ok(c.length==1&&c[0].name=='SIM CSV Offset-A'&&c[0].head.n==-30&&c[0].rows.length==4,'CSV import');
 const x=AC.parseEDM(fs.readFileSync('fixtures/offset_sim_edm.xml','utf8'));ok(x.length==1&&x[0].name=='SIM EDM Offset-B / OH'&&x[0].head.e==-80&&x[0].rows.length==4,'EDM import');}
// SIM default scenario
{const L=WP.plan(WP.DEFAULT),R=AC.report(AC.planWell(L),AC.SIM_OFFSETS.map(o=>AC.well(o.name,o.head,o.rows)));for(const r of R)console.log('   ',r.name,'minSF',r.minSF.toFixed(2),'@',r.mdAtMin,'m',r.status);ok(R.some(r=>r.status=='STOP'),'SIM scenario includes a STOP case')}
// UI
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for(const [tag,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1280,height:800}]]){
 const pg=await br.newPage();await pg.setViewport(vp);const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()=='error'&&/wac|wplan/.test(m.text()))errs.push(m.text())});const net=[];pg.on('request',r=>{if(!/localhost/.test(r.url()))net.push(r.url())});
 await pg.goto('http://localhost:8781/?nosplash=1',{waitUntil:'load',timeout:60000});await pg.waitForFunction(()=>window.GX?.wplan&&window.GX?.wac,{timeout:60000});
 const shot=async n=>{await pg.evaluate(()=>document.getElementById('wp').scrollTop=0);await new Promise(r=>setTimeout(r,1200));await pg.screenshot({path:`shots_live/109_w2_${tag}_${n}.png`})};
 await pg.evaluate(()=>GX.wplan.open('plan'));await pg.evaluate(()=>document.querySelector('#wp [data-v=offsets]').click());await pg.waitForSelector('#acFile');
 const inp=await pg.$('#acFile');await inp.uploadFile('fixtures/offset_sim.csv','fixtures/offset_sim_edm.xml');await pg.waitForFunction(()=>/Imported 2/.test(document.getElementById('acMsg')?.textContent||''),{timeout:15000}).catch(()=>{});
 ok(await pg.evaluate(()=>GX.wac.A.offs.length==5&&GX.wac.A.offs.filter(o=>o.tag=='IMPORT').length==2),tag+' imported CSV + EDM into IndexedDB (5 wells)');await shot('1_offsets_3d');
 await pg.evaluate(()=>document.querySelector('#wp [data-v=ac]').click());await pg.waitForSelector('#acTC');await shot('2_minsf_report');
 ok(await pg.evaluate(()=>/Error model: concept only, not certified/.test(document.getElementById('wpBody').textContent)),tag+' AC view shows concept-only error-model label');
 ok(await pg.evaluate(()=>/STOP/.test(document.getElementById('wpBody').textContent)&&document.querySelectorAll('#wpBody canvas').length==3),tag+' min-SF report with STOP + ladder/SF/TC plots');
 await pg.evaluate(()=>document.getElementById('acLad').scrollIntoView());await new Promise(r=>setTimeout(r,300));await pg.screenshot({path:`shots_live/109_w2_${tag}_3_ladder_sf.png`});
 await pg.evaluate(()=>document.getElementById('acTC').scrollIntoView());await new Promise(r=>setTimeout(r,300));await pg.screenshot({path:`shots_live/109_w2_${tag}_4_tc.png`});
 await pg.evaluate(()=>{GX.wac.A.bitMd=1380;document.querySelector('#wp [data-v=beam]').click()});await pg.waitForSelector('#acBeam');await shot('5_beam');
 ok(await pg.evaluate(()=>/Error model: concept only, not certified \(simplified ISCWSA-style\)/.test(document.getElementById('wpBody').textContent)),tag+' beam view shows concept-only error-model label');
 ok(await pg.evaluate(()=>/IN BEAM/.test(document.getElementById('acBeamT').textContent)),tag+' beam flags Offset-3 ahead of bit at 1380 m');
 await pg.evaluate(()=>document.getElementById('wp3d').scrollIntoView());await new Promise(r=>setTimeout(r,1200));await pg.screenshot({path:`shots_live/109_w2_${tag}_6_beam_3d.png`});
 ok(await pg.evaluate(()=>!/\bLIVE\b/.test(document.getElementById('wp').textContent)),tag+' no LIVE label');
 await pg.evaluate(()=>GX.wac.A.offs.filter(o=>o.tag=='IMPORT').map(o=>o.name)).then(async n=>{for(const x of n)await pg.evaluate(x=>new Promise(ok=>{const r=indexedDB.open('dw_wplan',1);r.onsuccess=()=>{const t=r.result.transaction('offsets','readwrite');t.objectStore('offsets').delete(x);t.oncomplete=ok}}),x)});
 ok(!errs.length,tag+' no page errors '+errs.join('|'));ok(!net.length,tag+' no external requests '+net.slice(0,3).join(' '));await pg.close()}
await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
