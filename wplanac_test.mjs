// feat/wellplan-ac test: ISCWSA ellipses, SF vs EDM offsets (GX.edm API), traffic light, AFE. Pure checks + browser (phone + desk).
import puppeteer from 'puppeteer-core';import fs from 'fs';import * as WP from './wplan.js';import * as A from './wplanac.js';import {parseFile} from './edm.js';
const BASE=(process.argv[2]||'http://localhost:8831').replace(/\/$/,''),SH='shots_live/160_wplanac_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const W=WP.calc(JSON.parse(JSON.stringify(WP.DEFAULT)));const U=A.uncertainty(W.S.rows);
ok(U.length>20&&U.every(r=>[r.ne.a,r.ne.b,r.sigV].every(Number.isFinite)),'covariance per station, '+U.length+' stations, all finite');
ok(U.at(-1).ne.a>U[5].ne.a,'uncertainty grows with depth ('+U[5].ne.a.toFixed(2)+' → '+U.at(-1).ne.a.toFixed(2)+' m 1σ)');
ok(U.every(r=>r.ne.a>=r.ne.b-1e-9),'ellipse major ≥ minor axis');ok(U.at(-1).ne.a>3&&U.at(-1).ne.a<60,'TD 1σ major '+U.at(-1).ne.a.toFixed(1)+' m in a sane MWD range (3–60 m)');
const E2=A.ellPts(U.at(-1).ne,2),r2=Math.max(...E2.map(([n,e])=>Math.hypot(n,e)));ok(Math.abs(r2-2*U.at(-1).ne.a)<0.05*U.at(-1).ne.a,'2σ ellipse = 2 × 1σ major');
ok(Math.abs(A.sfOne(10,1,{k:3.5,Rr:0.1,Ro:0.1})-(10-0.2)/3.5)<1e-9,'SF formula (C-C − radii) / (k·σ)');
ok(A.light(0.8)=='red'&&A.light(1.2)=='amber'&&A.light(1.5)=='green'&&A.light(4)=='green','traffic light: <1 red, 1–1.5 amber, ≥1.5 green');
const ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length),R=await parseFile('edm_pad.xml',ab(fs.readFileSync('fixtures/edm_pad.xml')));globalThis.GX={edm:{ST:{R}}};
let O=A.edmOffsets({N:0,E:15});ok(O.length==4&&O.every(o=>o.src=='IMPORT'),'4 offsets read through GX.edm API, tagged IMPORT');
let AC=A.antiCollision(U,O);ok(AC.every(a=>Number.isFinite(a.minSF)&&a.minCtc>0),'min SF per offset: '+AC.map(a=>a.name+' '+a.minSF.toFixed(2)).join(', '));
const s=AC[0].scan.find(x=>x.md==AC[0].minSFmd);ok(Math.abs(A.sfOne(s.ctc,s.sig)-s.sf)<1e-9,'scan SF matches formula at min point');
AC=A.antiCollision(U,A.edmOffsets({N:0,E:30.5}));ok(AC.find(a=>a.name=='SYN-2').light=='red','plan on SYN-2 slot → red');
const F=A.afePlan(W);ok(F.rows.length==3&&F.days>5&&F.days<120&&F.cost>1e6,'AFE '+F.days.toFixed(1)+' days, $'+(F.cost/1e6).toFixed(2)+' M, 3 sections');
ok(F.P10.days<=F.P50.days&&F.P50.days<=F.P90.days&&F.tag=='SIM','P10 ≤ P50 ≤ P90, tagged SIM');ok(A.afePlan(W,{rig:80000}).cost>F.cost,'higher rig rate → higher cost');
ok(F.tdT.every((x,i)=>!i||(x[0]>=F.tdT[i-1][0]&&x[1]>=F.tdT[i-1][1])),'days-vs-depth monotonic');
delete globalThis.GX;
// ---- browser ----
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!/localhost/.test(r.url()))bad.push(r.url())});
 await p.goto(BASE+'/?nosplash=1&edm=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.edm&&document.getElementById('edm')&&GX.wplan,{timeout:120000});await w(800);
 await (await p.$('#edmf')).uploadFile('fixtures/edm_pad.xml');await p.waitForFunction(()=>window.GX.edm.ST.R?.A,{timeout:60000});await w(800);await p.evaluate(()=>GX.edm.close());
 await p.evaluate(()=>GX.wplan.open('acell'));await p.waitForFunction(()=>window.GX.wplanac&&document.getElementById('acPlan'),{timeout:30000});await w(500);
 let t=await p.evaluate(()=>document.getElementById('wp').innerText);ok(/ISCWSA/.test(t)&&/SIM/.test(t)&&!/\bLIVE\b/.test(t),nm+': ellipse tab shows ISCWSA, SIM, no LIVE');await p.evaluate(()=>document.getElementById('acPlan').scrollIntoView());await p.screenshot({path:SH+nm+'_1_ellipses.png'});
 await p.evaluate(()=>{document.getElementById('acEx').value='10';document.getElementById('acEx').dispatchEvent(new Event('change'))});await w(300);await p.screenshot({path:SH+nm+'_1b_ellipses_x10.png'});
 await p.evaluate(()=>GX.wplan.open('plan'));await w(1500);const g=await p.evaluate(()=>!!GX.wplan.W?.three?.sc?.getObjectByName('wpacEll'));ok(g,nm+': 2σ/1σ ellipses drawn in 3D trajectory view');await p.screenshot({path:SH+nm+'_2_3d.png'});
 await p.evaluate(()=>GX.wplan.open('acedm'));await p.waitForSelector('#acTbl');await w(300);const rows=await p.$$eval('#acTbl tr[data-light]',x=>x.map(r=>r.dataset.light));t=await p.evaluate(()=>document.getElementById('wp').innerText);
 ok(rows.length==4&&/IMPORT/.test(t)&&/SYN-1/.test(t),nm+': AC table 4 EDM offsets ('+rows.join()+')');await p.evaluate(()=>document.getElementById('acTbl').scrollIntoView());await p.screenshot({path:SH+nm+'_3_ac.png'});
 await p.evaluate(()=>{document.getElementById('acE').value='30.5';document.getElementById('acGo').click()});await w(300);const r2=await p.$$eval('#acTbl tr[data-light]',x=>x.map(r=>r.dataset.light));ok(r2.includes('red'),nm+': moving wellhead onto SYN-2 slot shows red ('+r2.join()+')');await p.evaluate(()=>document.getElementById('acTbl').scrollIntoView());await p.screenshot({path:SH+nm+'_4_ac_red.png'});
 await p.evaluate(()=>{document.getElementById('acE').value='15';document.getElementById('acGo').click()});
 await p.evaluate(()=>GX.wplan.open('afe'));await p.waitForSelector('#afeTbl');await w(300);t=await p.evaluate(()=>document.getElementById('wp').innerText);ok(/P10/.test(t)&&/SIM/.test(t)&&/Liner/.test(t)&&!/\bLIVE\b/.test(t)&&!/NaN/.test(t),nm+': AFE table + P10/P50/P90, SIM');await p.evaluate(()=>document.getElementById('afeTbl').scrollIntoView());await p.screenshot({path:SH+nm+'_5_afe.png'});
 await p.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no outside writes '+bad.slice(0,3).join());
await b.close();console.log(`wplanac ${pass}/${fails}`);process.exit(fails?1:0)
