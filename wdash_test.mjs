// v5.12.12 WITSML dashboard browser test: start tile, SIM (labelled SIM, never LIVE), depth+time, tracks, zoom, follow, picker,
// image tracks + sines, no-array case, mocked WITSML store -> LIVE, credentials never persisted. node wdash_test.mjs [base] ; shots -> ../witsml-shots/
import puppeteer from 'puppeteer-core';import * as K from './wdash_core.js';
const BASE=(process.argv[2]||'http://127.0.0.1:18793').replace(/\/$/,''),SH=process.env.SHOTS||'../witsml-shots/';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],seen=[];
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';let mdNow=2400;
function store(q){const j=JSON.parse(q.postData()||'{}');seen.push(j);if(j.op=='WMLS_GetVersion')return {result:'1.4.1.1',version:'1.4.1.1'};
 if(j.wmlType=='well')return {result:1,xml:`<wells ${NS}><well uid="TW1"><name>Test Well 1</name></well></wells>`};
 if(j.wmlType=='wellbore')return {result:1,xml:`<wellbores ${NS}><wellbore uidWell="TW1" uid="TB1"><name>Test Wellbore</name></wellbore></wellbores>`};
 const hdr=`<name>MWD depth</name><indexType>measured depth</indexType><startIndex uom="m">2300</startIndex><endIndex uom="m">${mdNow}</endIndex><indexCurve>DEPT</indexCurve>`+K.SIM_ML.slice(0,9).map((m,i)=>`<logCurveInfo uid="${m}"><mnemonic>${m}</mnemonic><unit>${K.SIM_UL[i]}</unit></logCurveInfo>`).join('');
 if(/header-only/.test(j.options))return {result:1,xml:`<logs ${NS}><log uidWell="TW1" uidWellbore="TB1" uid="TL1">${hdr}</log></logs>`};
 const si=+((j.query.match(/<startIndex[^>]*>([^<]*)</)||[])[1]||2300);mdNow+=0.5;const rows=K.simSeries(+(si+0.1).toFixed(2),mdNow,0.1).map(r=>r.slice(0,9));
 return {result:1,xml:`<logs ${NS}><log uidWell="TW1" uidWellbore="TB1" uid="TL1"><logData><mnemonicList>${K.SIM_ML.slice(0,9)}</mnemonicList><unitList>${K.SIM_UL.slice(0,9)}</unitList>${rows.map(r=>`<data>${r.join(',')}</data>`).join('')}</logData></log></logs>`}}
async function pg(url,vp){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(u.startsWith('https://mock-proxy.invalid/'))return r.method()=='OPTIONS'?r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}}):r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(store(r))});
  if(/adaga|witsml-proxy|supabase\.co|:8796/.test(u)&&!/\.js(\?|$)/.test(u))return r.abort();r.continue()});await p.goto(url,{waitUntil:'load',timeout:120000});return p}
const ink=p=>p.evaluate(()=>{const c=document.getElementById('wdCv'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let k=0;for(let i=0;i<d.length;i+=64)if(d[i]+d[i+1]+d[i+2]>120)k++;return k});
const PH={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},LT={width:1440,height:900};
for(const [nm,vp] of [['phone',PH],['laptop',LT]]){
 const p=await pg(BASE+'/?start=1',vp);await p.waitForSelector('#st_wdash',{timeout:90000}).catch(()=>{});ok(await p.evaluate(()=>/WITSML dashboard/.test(document.getElementById('st_wdash')?.textContent||'')),nm+': start tile "WITSML dashboard"');
 await p.evaluate(()=>document.getElementById('st_wdash').scrollIntoView());await w(400);await p.screenshot({path:SH+nm+'_0_start_tile.png'});
 await p.evaluate(()=>document.getElementById('st_wdash').click());await p.waitForSelector('#wdash',{timeout:30000});await w(2500);
 const a=await p.evaluate(()=>({tag:wdTag.textContent,t:document.getElementById('wdash').innerText,tr:GX.wdash.ST.tracks.map(t=>t.name),last:GX.wdash.ST.dep.rows.at(-1)[0]}));
 ok(a.tag=='SIM'&&!/\bLIVE\b/.test(a.t),nm+': no store -> SIM tag, no LIVE word');ok(['Drilling','Rotary','Hydraulics','Gamma','Resistivity'].every(x=>a.tr.includes(x))&&a.tr.filter(x=>/^Image/.test(x)).length==2,nm+': tracks '+a.tr.join(' | '));
 const cs=await p.evaluate(()=>GX.wdash.ST.tracks.flatMap(t=>t.curves||[]).map(c=>c.mn).join());ok(['ROPA','SWOB','RPMA','TQA','SPPA','MFIA','GR','RESD'].every(m=>cs.includes(m)),nm+': curves ROP WOB RPM TQ SPP flow GR RES');
 ok(await ink(p)>2000,nm+': logs + images drawn');await p.screenshot({path:SH+nm+'_1_depth_sim.png'});
 await w(3000);const last2=await p.evaluate(()=>GX.wdash.ST.dep.rows.at(-1)[0]);ok(last2>a.last,nm+': new SIM data arrives ('+a.last+'→'+last2+' m)');
 const fol=await p.evaluate(()=>{const S=GX.wdash.ST,c=document.getElementById('wdCv');const H=c.clientHeight-58,last=S.dep.rows.at(-1)[0];return {auto:S.auto,frac:(last-(last-S.span.depth*0.85))/S.span.depth}});ok(fol.auto&&Math.abs(fol.frac-0.85)<0.01,nm+': auto-scroll keeps newest at 85% of window');
 await p.evaluate(()=>wdZin.click());ok(await p.evaluate(()=>GX.wdash.ST.span.depth<30),nm+': zoom in');await p.evaluate(()=>wdZout.click());
 await p.evaluate(()=>GX.wdash.ST.sines);const sn=await p.evaluate(()=>{const S=GX.wdash.ST,K=GX.wdash.K,r=S.dep.rows.slice(-600),im=S.imgs[0];return K.autoSines(r.map(x=>x[0]),r.map(x=>K.imgRow(x,im))).length});ok(sn>=1,nm+': sinusoids picked on image ('+sn+')');
 if(nm=='laptop'){await p.evaluate(()=>{GX.wdash.ST.span.depth=12;GX.wdash.render()});await w(300);await p.screenshot({path:SH+'laptop_2_image_sines_zoom.png'});await p.evaluate(()=>{GX.wdash.ST.span.depth=30})}
 await p.evaluate(()=>wdModeT.click());await w(1200);const tm=await p.evaluate(()=>({mode:GX.wdash.ST.mode,tag:wdTag.textContent,n:GX.wdash.ST.tim.rows.length,note:wdNote.textContent}));ok(tm.mode=='time'&&tm.tag=='SIM'&&tm.n>100&&/time window/.test(tm.note),nm+': time mode SIM');
 await p.screenshot({path:SH+nm+'_3_time_sim.png'});await p.evaluate(()=>wdModeD.click());
 await p.evaluate(()=>wdTracks.click());await w(300);ok(await p.evaluate(()=>!!document.getElementById('wdPick')&&document.querySelectorAll('#wdPick .tr').length==GX.wdash.ST.tracks.length),nm+': track/curve picker lists tracks');
 await p.evaluate(()=>{const s=document.querySelector('#wdPick .tr [data-k=add]');s.value='HKLA'in{}?'':'GR';s.dispatchEvent(new Event('change'))});await w(200);
 await p.evaluate(()=>{const i=document.querySelector('#wdPick .tr .cv[data-c] [data-k=max]');i.value='100';i.dispatchEvent(new Event('change'))});ok(await p.evaluate(()=>GX.wdash.ST.tracks[0].curves.length==3&&GX.wdash.ST.tracks[0].curves[0].max==100),nm+': add curve + set scale max');
 await p.screenshot({path:SH+nm+'_4_picker.png'});await p.evaluate(()=>wdPickX.click());
 // drag pauses follow
 await p.evaluate(()=>{const S=GX.wdash.ST;S.auto=false;S.top=S.dep.rows.at(-1)[0]-40;GX.wdash.render()});ok(await p.evaluate(()=>/paused/.test(wdNote.textContent)),nm+': manual scroll pauses follow');await p.evaluate(()=>wdAuto.click());
 if(nm=='phone')ok(await p.evaluate(()=>document.querySelector('#wdash .bar').scrollWidth<=innerWidth+1),'phone: toolbar fits (wraps)');
 // no array curves
 await p.evaluate(()=>{const S=GX.wdash.ST;S.dep.rows=S.dep.rows.map(r=>r.slice(0,9));S.dep.ml=S.dep.ml.slice(0,9);S.dep.ul=S.dep.ul.slice(0,9);});
 await p.evaluate(()=>{wdTracks.click();wdReset.click();wdPickX.click()});await w(400);const na=await p.evaluate(()=>({imgs:GX.wdash.ST.imgs.length,t:GX.wdash.ST.tracks.filter(t=>'image' in t).map(t=>t.image)}));ok(na.imgs==0&&na.t.length==1&&na.t[0]==null,nm+': no array curves -> one empty image track with explanation');
 await p.screenshot({path:SH+nm+'_5_no_image_curves.png'});
 // mocked store -> LIVE; credentials never persisted
 await p.evaluate(()=>wdConnB.click());await w(200);await p.evaluate(()=>{wdVia.value='proxy';wdProxy.value='https://mock-proxy.invalid/soap';wdUrl.value='https://store.example.test/WMLS';wdUser.value='tester';wdPass.value='S3cret-pw-XYZ';wdGo.click()});
 await p.waitForSelector('#wdUse',{timeout:20000}).catch(()=>{});await w(500);await p.screenshot({path:SH+nm+'_6_connect.png'});await p.evaluate(()=>wdUse.click());await w(2500);
 const L=await p.evaluate(()=>({tag:wdTag.textContent,n:GX.wdash.ST.dep.rows.length,note:wdNote.textContent,img:GX.wdash.ST.tracks.filter(t=>'image' in t).map(t=>t.image)}));
 ok(L.tag=='LIVE'&&L.n>100&&/^LIVE/.test(L.note),nm+': connected store with data -> LIVE ('+L.n+' rows)');ok(L.img.length==1&&L.img[0]==null,nm+': live log without array curves -> image track explains');
 await p.screenshot({path:SH+nm+'_7_live_mock.png'});
 const n0=L.n;await p.evaluate(()=>GX.wdash.ST.conn.lastPoll=0);await w(2500);ok(await p.evaluate(()=>GX.wdash.ST.dep.rows.length)>n0,nm+': incremental poll appends rows');
 await p.evaluate(()=>wdModeT.click());await w(300);ok(await p.evaluate(()=>wdTag.textContent)=='SIM',nm+': other index mode without data is not LIVE');await p.evaluate(()=>wdModeD.click());
 const persisted=await p.evaluate(()=>JSON.stringify({...localStorage})+document.cookie+location.href+document.getElementById('wdash').innerHTML);ok(!/S3cret-pw-XYZ/.test(persisted),nm+': password not in localStorage, cookies, URL or DOM (sessionStorage by design since v5.12.14)');
 await p.evaluate(()=>{wdConnB.click();wdDis.click()});await w(300);ok(await p.evaluate(()=>wdTag.textContent=='SIM'&&!GX.wdash.ST.conn.connected),nm+': disconnect -> back to SIM');
 await p.evaluate(()=>wdX.click());ok(await p.evaluate(()=>!document.getElementById('wdash')),nm+': close');await p.close()}
ok(seen.length>0&&seen.every(j=>j.url=='https://store.example.test/WMLS'),'all store calls went to the entered store via the entered proxy');
ok(!errs.filter(e=>!/WebSocket|supabase|Failed to fetch|THREE/i.test(e)).length,'no page errors '+errs.slice(0,3).join(' | '));
await b.close();console.log(`\n${pass} passed, ${fails} failed`);process.exit(fails?1:0)
