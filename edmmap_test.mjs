// v5.12.3 EDM Map toggle + GL + TD markers. Synthetic fixtures only (made-up pads, NOT real data). Tile requests are answered locally with a plain PNG
// so the test needs no network; it also checks that only map-tile GETs leave the page (EDM data stays on the device).
import puppeteer from 'puppeteer-core';import fs from 'fs';import {pad} from './fixtures/mkedm.mjs';import {fwd,inv} from './edmgeo.js';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/128_edmmap_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const ft=m=>(m/0.3048).toFixed(4);const E0=612345.0,N0=7012345.0;// made-up UTM-55S map position
let G=pad({wells:3}).replace('<CD_SITE site_id="S1"','<CD_PROJECT project_id="P1" project_name="SYNTH FIELD" geo_system_id="UTM" geo_zone_id="UTM-55S" geo_datum_id="GDA2020" system_datum_desc="Mean Sea Level"/>\n<CD_SITE project_id="P1" site_id="S1"');
for(let i=0;i<3;i++)G=G.replace(`well_common_name="SYN-${i+1}"`,`well_common_name="SYN-${i+1}" geo_offset_east="${ft(E0+i*30)}" geo_offset_north="${ft(N0)}" is_subsea="N"${i==1?` water_depth="${ft(80)}"`:''}`);
G=G.replace('<CD_DATUM datum_id="D0"','<CD_DATUM datum_id="G0" well_id="W1" datum_name="GL" datum_elevation="'+ft(120)+'" is_default="N"/>\n<CD_DATUM datum_id="D0"');
const FG='/tmp/edm_map_geo.xml',FN='/tmp/edm_map_nocrs.xml';fs.writeFileSync(FG,G);fs.writeFileSync(FN,pad({wells:3}));
{const q=inv(E0,N0,55,true),p=fwd(q.lat,q.lon,55,true);ok(Math.abs(p.E-E0)<0.001&&Math.abs(p.N-N0)<0.001,`unit: UTM-55S inverse/forward round trip (${q.lat.toFixed(6)}, ${q.lon.toFixed(6)})`)}
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(nm+': '+e.message));p.on("console",m=>{if(m.type()=="error")console.log("CERR",m.text())});p.on("dialog",d=>d.accept());
 const ext=[],bad=[];const TRX=/^https:\/\/(server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile|tile\.openstreetmap\.org)\/\d+\/\d+\/\d+(\.png)?$/;
  /* tiles answered via CDP Fetch with URL patterns only (page-wide interception stalls module workers) */const cdp=await p.createCDPSession();await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*server.arcgisonline.com*'},{urlPattern:'*tile.openstreetmap.org*'}]});
  cdp.on('Fetch.requestPaused',async ev=>{const u=ev.request.url;if(TRX.test(u)&&ev.request.method=='GET'){ext.push(u);await cdp.send('Fetch.fulfillRequest',{requestId:ev.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'},{name:'Access-Control-Allow-Origin',value:'*'}],body:Buffer.from(PNG).toString('base64')}).catch(()=>{})}else{bad.push(ev.request.method+' '+u);await cdp.send('Fetch.failRequest',{requestId:ev.requestId,errorReason:'BlockedByClient'}).catch(()=>{})}});
  p.on('request',r=>{const u=r.url();if(u.startsWith(BASE)||u.startsWith('data:')||u.startsWith('blob:')||TRX.test(u))return;if(r.method()!='GET'||!/fonts|cdn|unpkg|jsdelivr/.test(u))bad.push(r.method()+' '+u)});
 const load=async f=>{await w(4000);await p.goto(BASE+'/?nosplash=1&edm=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.edm&&document.getElementById('edm'),{timeout:120000});await w(500);
  await (await p.$('#edmf')).uploadFile(f);await p.waitForFunction(()=>GX.edm.ST.R?.W&&!GX.edm.ST.busy,{timeout:150000}).catch(async e=>{await p.screenshot({path:"/tmp/edmmap_fail.png"});console.log("LOADFAIL",errs,await p.evaluate(()=>document.getElementById("edm")?.innerText.slice(0,600)));throw e});await p.evaluate(()=>GX.edm.openMap());await p.waitForFunction(()=>GX.edmmap?.open&&document.querySelector('#edmmap canvas'),{timeout:30000});await w(1200)};
 await load(FN);let r=await p.evaluate(()=>({btn:!!document.getElementById('emmapb'),note:document.getElementById('emnomap')?.innerText||'',crs:GX.edmmap.W.crs}));
 ok(!r.btn&&/no coordinate system/.test(r.note)&&!r.crs,`${nm}: no CRS → no Map toggle, note "${r.note}"`);await p.screenshot({path:SH+nm+'_0_nocrs.png'});
 await p.evaluate(()=>localStorage.removeItem('dw_edm_map'));await load(FG);
 r=await p.evaluate(()=>{const M=GX.edmmap,W=M.W;return {crs:W.crs,wells:W.wells.map(w=>({n:w.name,lat:w.lat,lon:w.lon,E:w.E,N:w.N,gl:w.gl,src:w.glSrc,dat:w.datum})),ll:W.wells.map(w=>M.ll(w.E,w.N)),btn:document.getElementById('emmapb')?.innerText}});
 ok(r.crs?.kind=='utm'&&r.crs.zone=='UTM-55S'&&r.btn=='Map: Off',`${nm}: CRS ${JSON.stringify(r.crs)} · toggle "${r.btn}"`);
 const ck=r.wells.map((x,i)=>{const p2=fwd(x.lat,x.lon,55,true);return Math.hypot(p2.E-(E0+i*30),p2.N-N0)});ok(ck.every(d=>d<0.01),`${nm}: wellhead lat/long → UTM matches file E/N (max ${Math.max(...ck).toFixed(4)} m)`);
 const fr=r.ll.map((q,i)=>Math.hypot((q[0]-r.wells[i].lat)*110574,(q[1]-r.wells[i].lon)*111320*Math.cos(q[0]*Math.PI/180)));ok(fr.every(d=>d<0.2),`${nm}: map frame puts each wellhead at its lat/long (max ${Math.max(...fr).toFixed(3)} m)`);
 ok(r.wells[0].gl==120&&/GL/.test(r.wells[0].src)&&r.wells[1].gl==80&&/water_depth/.test(r.wells[1].src)&&r.wells[2].gl==null,`${nm}: GL from datum GL 120, ground elevation 80, third n/a (${r.wells.map(x=>x.gl)})`);
 await p.evaluate(()=>GX.edmmap.fit());await w(1500);
 r=await p.evaluate(()=>[...document.querySelectorAll('#edmmap .eml')].filter(e=>e.offsetParent).map(e=>e.textContent));
 ok(r.length>0&&r.every(t=>/^SYN-1 · GL 120\.0 m$|^SYN-2 · GL 80\.0 m$|^SYN-3 · GL n\/a$/.test(t)),`${nm}: wellhead labels show GL (${r.join(' | ')})`);
 r=await p.evaluate(()=>{const T=GX.edmmap.td();return {n:T.n,shown:T.shown.length,list:T.list.map(d=>({kind:d.kind,md:d.md,tvd:d.tvd,tvdss:d.tvdss,ref:d.ref})),wb:GX.edmmap.W.wbs.map(b=>b.traj.length).reduce((a,b)=>a+b,0),labs:[...document.querySelectorAll('#emtd .emt')].filter(e=>e.offsetParent).map(e=>e.innerText)}});
 ok(r.n==r.wb&&r.n==6&&r.list.some(d=>d.kind=='plan')&&r.list.some(d=>d.kind=='definitive'),`${nm}: TD marker on every wellbore trajectory and plan (${r.n}/${r.wb})`);
 const d0=r.list[0];ok(d0.md>2900&&d0.tvd>2000&&Math.abs(d0.tvdss-(d0.tvd-35))<0.11&&/RKB 35\.0 m/.test(d0.ref),`${nm}: TD values MD ${d0.md}, TVD ${d0.tvd}, TVDSS ${d0.tvdss}, ref ${d0.ref}`);
 ok(r.shown>0&&r.labs.length>0,`${nm}: TD labels shown (${r.labs.length}) e.g. "${r.labs[0]}"`);
 if(nm=='desk')ok(r.labs.every(t=>/MD .* · TVD .* · TVDSS .* m · ref /.test(t)),`desk: TD labels readable in full `+JSON.stringify(r.labs.slice(0,3)));
 else{const tap=await p.evaluate(()=>{const e=[...document.querySelectorAll('#emtd .emt')].find(e=>e.offsetParent);const r2=e.getBoundingClientRect();return {x:r2.x+r2.width/2,y:r2.y+r2.height/2,h:r2.height,t0:e.innerText,j:e.dataset.j}});
  ok(tap.h>=24&&!/TVDSS/.test(tap.t0),`phone: TD chip is short and tappable (h ${tap.h}px, "${tap.t0}")`);await p.touchscreen.tap(tap.x,tap.y);await w(500);
  const t1=await p.evaluate(j=>document.querySelector(`#emtd .emt[data-j="${j}"]`)?.innerText||'',tap.j);ok(/TVDSS .* m · ref /.test(t1),`phone: tap opens full TD label "${t1}"`)}
 await p.screenshot({path:SH+nm+'_1_td_gl.png'});
 await p.click('#emmapb');await w(800);await p.waitForFunction(()=>GX.edmmap.map().ok>0&&GX.edmmap.map().mesh,{timeout:30000}).catch(()=>{});await w(600);
 r=await p.evaluate(()=>{const M=GX.edmmap;return {m:M.map(),btn:document.getElementById('emmapb').innerText,attr:document.getElementById('emattr').innerText,ls:localStorage.getItem('dw_edm_map'),g:M.glAt(M.W.wells[0].E,M.W.wells[0].N)}});
 ok(r.m.mode=='street'&&r.m.mesh&&r.m.ok>0&&r.btn=='Map: Street'&&/OpenStreetMap/.test(r.attr)&&r.ls=='street',`${nm}: Map on → Street tiles (OSM, ${r.m.ok} tiles z${r.m.z}), attribution "${r.attr}", saved`);
 ok(Math.abs(r.g-120)<0.01&&r.m.glWells==2,`${nm}: ground at real GL under SYN-1 (${r.g.toFixed(2)} m, from ${r.m.glWells} wells)`);
 ok(ext.length>0&&ext.every(u=>/openstreetmap/.test(u))&&!bad.length,`${nm}: only OSM tile GETs (no Esri) leave the page (${ext.length} tiles; other ${bad.length}${bad.length?': '+bad[0]:''})`);
 await p.screenshot({path:SH+nm+'_2_map_street.png'});
 r=await p.evaluate(()=>{try{localStorage.setItem('dw_edm_map','sat')}catch{}const b=document.getElementById('emmapb');return {} });await p.evaluate(()=>GX.edmmap.close());await p.evaluate(()=>GX.edm.openMap());await p.waitForFunction(()=>GX.edmmap?.open,{timeout:30000});await w(1500);r=await p.evaluate(()=>({m:GX.edmmap.map().mode}));ok(r.m!='sat'&&!ext.some(u=>/arcgisonline/.test(u)),`${nm}: Satellite flag off: a saved 'sat' setting does not load Esri tiles (mode ${r.m})`);await p.evaluate(()=>GX.edmmap.setMap('street'));await w(800);
 await p.evaluate(()=>GX.edmmap.close());await p.evaluate(()=>GX.edm.openMap());await p.waitForFunction(()=>GX.edmmap?.open,{timeout:30000});await w(1500);
 r=await p.evaluate(()=>({m:GX.edmmap.map().mode,btn:document.getElementById('emmapb').innerText}));ok(r.m=='street'&&r.btn=='Map: Street',`${nm}: Map setting kept on reopen (${r.btn})`);
 await p.screenshot({path:SH+nm+'_3_map_street.png'});
 await p.click('#emmapb');await w(500);r=await p.evaluate(()=>({m:GX.edmmap.map(),ls:localStorage.getItem('dw_edm_map')}));ok(r.m.mode=='off'&&!r.m.mesh&&r.ls=='off',`${nm}: Map off removes the map`);
 await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));await b.close();console.log(`\n${pass} passed, ${fails} failed`);process.exit(fails?1:0)
