// v5.10 C1 casing design test: API 5C3 hand calcs vs published API values, load cases vs hand calcs, DF edits flip pass/fail, tally, CSV;
// UI at 1440x900 + 390x844 (119_casing_* shots); Well Planning tabs (Offsets…DD program, Casing) appear without reopening. SIM only; no Supabase/Adaga/WITSML.
import puppeteer from 'puppeteer-core';import * as WP from './wplan.js';import * as C from './casing.js';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,'');const DIR='shots_live',PRE=process.env.SHOT||'119_casing_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const near=(a,b,t)=>Math.abs(a-b)<=t;const w=ms=>new Promise(r=>setTimeout(r,ms));
// 1. ratings vs published API 5C3 values (psi, klbf)
for(const [s,wt,g,b,c,y] of [['9-5/8',47,'L-80',6870,4750,1086],['13-3/8',68,'K-55',3450,1950,1069],['7',29,'L-80',8160,7020,676],['7',32,'P-110',12460,10780,1025],['9-5/8',40,'J-55',3950,2570,630]]){const p=C.pipe(s,wt,g);
 ok(near(p.burstPsi,b,10)&&near(p.collapsePsi,c,c*0.01)&&near(p.yieldLbf/1000,y,2),`${s}" ${wt} lb/ft ${g}: burst ${p.burstPsi.toFixed(0)}≈${b}, collapse ${p.collapsePsi.toFixed(0)}≈${c} (${p.collapseMode}), body yield ${(p.yieldLbf/1000).toFixed(0)}≈${y} klbf`)}
// 2. loads vs hand calcs (surface string, default SIM proposal)
const W=WP.calc(JSON.parse(JSON.stringify(WP.DEFAULT)));const D=C.design(W,{});const e=D[0],s=e.s,g=9.80665;
ok(D.length==3&&D.map(x=>x.s.size).join()=='13-3/8,9-5/8,7'&&D[2].s.liner&&near(D[2].s.topMD,D[1].s.shoeMD-100,1e-6),'3 strings from casing points; 7" liner top = 9-5/8" shoe − 100 m');
{const Pres=s.poreNextSG*g*s.nextTVD,b0=Pres-0.1*g*s.nextTVD,bz=Pres-0.1*g*(s.nextTVD-s.shoeTVD)-1.03*g*s.shoeTVD;ok(near(e.bMax,Math.max(b0,bz),1e-6),`burst max load = hand calc ${Math.max(b0,bz).toFixed(0)} kPa (gas to surface, saltwater backup)`)}
ok(near(e.cMax,s.mudSG*g*s.shoeTVD,1e-6),`collapse max = mud ${s.mudSG} SG × g × ${s.shoeTVD.toFixed(0)} m = ${e.cMax.toFixed(0)} kPa`);
{const BF=1-s.mudSG/7.85,h=e.p.kgm*g*s.shoeTVD*BF/1000;ok(near(e.hang,h,1e-6)&&near(e.sf.tension,e.p.tension/h,1e-9),`tension = ${e.p.kgm.toFixed(1)} kg/m × g × ${s.shoeTVD.toFixed(0)} m × BF ${BF.toFixed(3)} = ${h.toFixed(0)} kN`)}
ok(D.every(x=>x.pass&&x.DF.burst==1.1&&x.DF.collapse==1&&x.DF.tension==1.6),'default DFs 1.1 / 1.0 / 1.6; auto-selection passes every string ('+D.map(x=>x.p.wt+'# '+x.p.grade).join(', ')+')');
{const o=C.design(W,{DF:{collapse:5}});ok(o.every(x=>!x.ok.collapse&&!x.pass),'collapse DF 5 → every string FAILs')}
{const o=C.design(W,{over:[{wt:54.5,grade:'J-55',mudSG:2.2}]});ok(!o[0].auto&&!o[0].ok.collapse&&o[0].sf.collapse<1,'manual 54.5# J-55 with 2.2 SG mud → collapse FAIL (SF '+o[0].sf.collapse.toFixed(2)+')')}
{const t=e.tal;ok(near(t.rows.reduce((a,r)=>a+r.len,0),e.lenMD,1e-6)&&t.rows[0].item=='Float shoe'&&t.rows[2].item.includes('float collar')&&t.joints==Math.ceil((e.lenMD-0.6)/12.2),`tally: shoe + ${t.joints} joints = ${e.lenMD.toFixed(1)} m, float collar on joint 2`)}
{const c=C.toCSV(D,'x').split('\n');ok(/SIM concept/.test(c[0])&&c.filter(l=>/,SIM$/.test(l)).length==3&&c.includes('# CASING TALLY'),'CSV: 3 design rows tagged SIM + tally')}
// 3. UI
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){const p=await br.newPage();await p.setViewport(vp);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||console.log('pageerror',e.message));
 await p.goto(BASE+'/?nosplash=1',{waitUntil:'domcontentloaded',timeout:180000});
 // open Well Planning the moment it exists (before extension tabs register), then check tabs arrive without reopening
 await p.waitForFunction(()=>window.GX?.wplan,{timeout:180000,polling:20});const t0=await p.evaluate(()=>{GX.wplan.open();return GX.wplan.W.tabs.length});
 await p.waitForFunction(()=>GX.wplan.W.tabs.length>=4&&GX.wplan.W.tabs.every(([v])=>document.querySelector(`#wp [data-v="${v}"]`)),{timeout:30000}).catch(()=>{});
 const tb=await p.evaluate(()=>({tabs:GX.wplan.W.tabs.map(t=>t[1]),btn:[...document.querySelectorAll('#wp [data-v]')].map(b=>b.textContent),open:document.getElementById('wp').style.display}));
 ok(tb.open=='block'&&tb.tabs.length>=4&&tb.tabs.every(l=>tb.btn.includes(l))&&tb.btn.includes('Casing'),`${nm}: tabs registered after open (${t0} at open) appear without reopening: ${tb.btn.join(' | ')}`);
 await p.evaluate(()=>document.querySelector('#wp [data-v=casing]').click());await p.waitForSelector('#csg .csgSec',{timeout:30000});await w(500);
 let G;let r=await p.evaluate(()=>({n:document.querySelectorAll('#csg .csgSec').length,pass:document.querySelectorAll('#csg .csgSec').length&&[...document.querySelectorAll('#csg .csgSec')].every(c=>/PASS/.test(c.textContent)),sim:/SIM/.test(document.getElementById('csg').textContent),live:/\bLIVE\b/.test(document.getElementById('csg').textContent),plots:document.querySelectorAll('#csg svg.csgPlot').length,wide:document.getElementById('wp').scrollWidth<=document.getElementById('wp').clientWidth+2}));
 ok(r.n==3&&r.pass&&r.sim&&!r.live&&r.plots==3&&r.wide,`${nm}: Casing tab: 3 sections PASS, SIM label, 3 load-line plots, no sideways overflow`+(r.n==3&&r.pass&&r.sim&&!r.live&&r.plots==3&&r.wide?'':' '+JSON.stringify(r)));
 await p.screenshot({path:`${DIR}/${PRE}${nm}_1_design.png`});
 await p.$eval('#csgDF_collapse',e=>{e.value='5';e.dispatchEvent(new Event('change'))});await w(300);
 r=await p.evaluate(()=>[...document.querySelectorAll('#csg .csgSec')].map(c=>/FAIL/.test(c.textContent)).every(Boolean));ok(r,`${nm}: DF collapse 5 → all FAIL in UI`);
 await p.screenshot({path:`${DIR}/${PRE}${nm}_2_fail.png`});
 await p.$eval('#csgDF_collapse',e=>{e.value='1';e.dispatchEvent(new Event('change'))});await w(300);
 await p.$eval('#csg .csgSec .csgG',e=>{e.value=e.options[e.options.length-1].value;e.dispatchEvent(new Event('change'))});await w(300);
 r=await p.evaluate(()=>({g:document.querySelector('#csg .csgSec .csgG').value,t:document.querySelector('#csg .csgSec').textContent}));G=r.g;ok(r.g&&r.g!='J-55'&&/manual selection/.test(r.t),`${nm}: grade override → manual selection`);
 await p.evaluate(()=>{document.querySelector('#csg .csgSec details').open=true});await w(200);
 if(nm=='phone')await p.evaluate(()=>document.querySelector('#csg .csgSec details').scrollIntoView());await p.screenshot({path:`${DIR}/${PRE}${nm}_3_tally.png`});
 const csv=await p.evaluate(()=>new Promise(res=>{const o=URL.createObjectURL;URL.createObjectURL=b=>{b.text().then(res);return o.call(URL,b)};document.getElementById('csgCsv').click()}));
 ok(/CASING DESIGN/.test(csv)&&csv.includes(G)&&/# CASING TALLY/.test(csv),`${nm}: CSV export (${csv.split('\n').length} lines)`);await p.close()}
ok(EXT.length==0,'no Supabase/Adaga/WITSML requests'+(EXT.length?' '+EXT.slice(0,3):''));await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
