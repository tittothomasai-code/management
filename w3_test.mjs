// v5.8 W3 test: survey program, DD instructions (per section / per stand), CSV + PDF export, plan-vs-actual in the slide sheet.
// Unit checks in node (analytic), then UI at 1440x900 desk + 390x844 phone with 110_w3_* shots. SIM only; asserts no network to Supabase/Adaga/WITSML.
import puppeteer from 'puppeteer-core';import fs from 'fs';import {execSync} from 'child_process';
import * as WP from './wplan.js';import * as D from './ddp.js';import * as AC from './wac.js';
const BASE=process.argv[2]||'http://localhost:8777';let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const near=(a,b,t)=>Math.abs(a-b)<=t;const w=ms=>new Promise(r=>setTimeout(r,ms));
const W=WP.calc(JSON.parse(JSON.stringify(WP.DEFAULT))),G=D.program(W),L=W.L;
// sections
ok(G.secs.length==3&&G.secs[0].md0==0&&near(G.secs.at(-1).md1,L.td,1e-6)&&G.secs.every((s,i)=>!i||s.md0==G.secs[i-1].md1),'3 hole sections contiguous 0→TD ('+G.secs.map(s=>s.hole).join(', ')+')');
// planAt == survey rows
{let e=0;for(const r of W.S.rows){const p=D.planAt(L,r.md);e=Math.max(e,Math.abs(p.inc-r.inc),r.inc>1?Math.abs(((p.azi-r.azi+540)%360)-180):0)}ok(e<1e-6,'planAt matches planned survey at every station (max err '+e.toExponential(1)+')')}
// stands
const S=G.stands;ok(near(S.reduce((a,s)=>a+s.len,0),L.td,1e-6)&&S.every(s=>near(s.slide+s.rot,s.len,0.11)),`${S.length} stands cover TD; slide+rotate = stand length`);
ok(S.filter(s=>s.md1<=L.P.kop).every(s=>s.mode=='Rotate'&&s.tf==null&&s.slide==0),'vertical section above KOP: rotate, no toolface');
{const c=S.filter(s=>s.kind=='build'&&s.md0>=L.legs[1].md0&&s.md1<=L.legs[1].md1);ok(c.length>3&&c.every(s=>near(s.dls,L.legs[1].dls,1e-6)&&near(s.slide/s.len,L.legs[1].dls/D.OPT.yield,0.005)),`build stands: DLS ${L.legs[1].dls} → slide ratio = DLS/yield = ${(L.legs[1].dls/D.OPT.yield).toFixed(2)} (${c.length} stands)`);
 const az=Math.atan2(L.P.targets[0].e,L.P.targets[0].n)*180/Math.PI;ok(c.every(s=>s.inc0<3?(s.tfRef=='MTF'&&near(s.tf,az,0.01)):(s.tfRef=='GTF'&&(near(s.tf,0,0.01)||near(s.tf,360,0.01)))),'build toolface: MTF = target azimuth '+az.toFixed(1)+'° below 3° inc, then GTF 0° (high side) for a pure build')}
ok(S.filter(s=>s.kind=='hold'&&s.md0>=L.legs.find(l=>l.kind=='hold').md0+1&&s.md1<=L.legs.find(l=>l.kind=='hold').md1-1).every(s=>s.mode=='Rotate'),'hold stands: rotate');
{let e=0;for(const s of S){const d=WP.dogleg(s.inc0,s.azi0,s.inc1,s.azi1)*180/Math.PI;e=Math.max(e,Math.abs(d-s.dls*s.len/30))}ok(e<1e-9,'stand DLS × length/30 = dogleg between plan in/out')}
// RSS + higher-than-yield
{const R=D.stands(L,W.S,null,{bha:{name:'RSS test',rss:true}});ok(R.filter(s=>s.dls>=0.3).every(s=>/^RSS steer/.test(s.mode)),'RSS BHA → RSS steer mode, not slides')
 const Y=D.stands(L,W.S,null,{yield:2,bha:{name:'weak motor',motor:true}});ok(Y.filter(s=>s.dls>2.01).every(s=>s.mode=='Slide'&&/exceeds|> motor yield/.test(s.cont)),'DLS > motor yield → full slide + contingency')}
// AC watch points
{const st=S.filter(s=>s.acLvl=='STOP');const sc=G.A.scans.flatMap(o=>o.S.filter(x=>x.sf<G.A.M.stop).map(x=>x.md));
 ok(st.length>0&&st.every(s=>/^STOP/.test(s.cont))&&sc.every(m=>S.some(s=>s.acLvl=='STOP'&&m>=s.md0-1e-6&&m<=s.md1+1e-6)),`AC: every scan station with SF<${G.A.M.stop} lies in a STOP stand (${st.length} stands)`);
 const sec=G.survey.find(s=>s.md0<=sc[0]&&s.md1>=sc[0]);ok(/Every 10 m inside AC alert zone/.test(sec.extra)&&/10 m/.test(sec.interval),'survey program: 10 m surveys in the AC alert zone ('+sec.extra+')')}
ok(G.survey[0].tool.startsWith('Gyro')&&G.survey.every(s=>s.em==AC.EM_LABEL),'surface section gyro; error-model label on every section');
ok(G.dd.every(s=>s.bha&&s.contingency&&s.tag=='SIM')&&near(G.dd.reduce((a,s)=>a+s.slideM+s.rotM,0),L.td,1),'DD per section: BHA, contingency, SIM tag, slide+rotate sums to TD');
// CSV / PDF
{const c=D.toCSV(G),l=c.trim().split('\n');ok(/SIM proposal/.test(l[0])&&l.includes('# DD INSTRUCTIONS PER STAND')&&l.length==4+2+G.survey.length+3+G.dd.length+3+S.length,'CSV: sections + per-section + per-stand rows ('+l.length+' lines)');
 fs.writeFileSync('/tmp/w3.pdf',D.toPDF(G));const t=execSync('pdftotext -layout /tmp/w3.pdf -').toString(),pi=execSync('pdfinfo /tmp/w3.pdf').toString();
 ok(/DD PROGRAM/.test(t)&&/Error model: concept only, not certified/.test(t)&&/SURVEY PROGRAM/.test(t)&&/DD INSTRUCTIONS PER STAND/.test(t)&&/STOP: SF/.test(t),'PDF valid, text extractable ('+(pi.match(/Pages:\s+(\d+)/)||[])[1]+' pages)');}
// ---- browser ----
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){const p=await br.newPage();await p.setViewport(vp);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||console.log('pageerror',e.message));
 const dir='/tmp/w3dl_'+nm;fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir);(await p.createCDPSession()).send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:180000});await p.waitForFunction(()=>window.GX?.wplan&&window.GX?.ss56,{timeout:180000});await w(2500);
 await p.evaluate(()=>GX.wplan.open('program'));await p.waitForSelector('#ddpStands',{timeout:60000});await w(800);
 const u=await p.evaluate(()=>({sv:document.querySelectorAll('#ddpSurvey tr').length-1,sec:document.querySelectorAll('#ddpSec tr').length-1,st:document.querySelectorAll('#ddpStands tr').length-1,stop:[...document.querySelectorAll('#ddpStands td')].some(t=>/^STOP/.test(t.textContent)),txt:document.getElementById('wp').innerText,live:/\bLIVE\b/.test(document.getElementById('wp').innerText)}));
 ok(u.sv==3&&u.sec==3&&u.st==S.length&&u.stop&&/not an approved directional program/.test(u.txt)&&/Error model: concept only/.test(u.txt)&&!u.live,`${nm}: DD program tab: 3 survey rows, 3 sections, ${u.st} stands, STOP watch, concept + EM labels, no LIVE`);
 await p.screenshot({path:`shots_live/110_w3_${nm}_1_program.png`});
 await p.evaluate(()=>document.getElementById('ddpStands').scrollIntoView({block:'start'}));await w(300);await p.screenshot({path:`shots_live/110_w3_${nm}_2_stands.png`});
 await p.evaluate(()=>{document.getElementById('ddpCsv').click();document.getElementById('ddpPdf').click()});await w(2500);const f=fs.readdirSync(dir);
 ok(f.some(x=>/^dd_program_.*\.csv$/.test(x))&&f.some(x=>/\.pdf$/.test(x))&&fs.readFileSync(dir+'/'+f.find(x=>/\.pdf$/.test(x))).slice(0,5).toString()=='%PDF-',`${nm}: CSV + PDF download (${f.join(', ')})`);
 await p.evaluate(()=>{GX.wplan.close();GX.ss56.open('test')});await w(2500);
 const s=await p.evaluate(()=>{const t=GX.ss56.table(),R=t.rows,ix=k=>t.cols.findIndex(c=>c[0]==k);const c=R.map(r=>GX.ss56.cellsOf(r));const g=k=>c.map(x=>x[ix(k)]);
  return {hdr:[...document.querySelectorAll('#ss56 th')].map(e=>e.textContent).join('|'),n:R.length,pInc:g('pInc').filter(x=>x.s!=='').length,dInc:g('dInc').filter(x=>x.s!=='').length,pDD:g('pDD').filter(x=>x.s).length,tags:[...new Set(g('pInc').map(x=>x.tag))],
   chk:R.map((r,i)=>{const md=Number.isFinite(r.sv?.md)?r.sv.md:r.hd,pl=GX.ddp.planAt(md),v=c[i][ix('dInc')].v;return v==null||Math.abs(v-(r.sv.inc-pl.inc))<1e-9}).every(Boolean),csv:/Plan Inc/.test(GX.ss56.toCSV())}});
 ok(/Plan Inc/.test(s.hdr)&&/ΔInc/.test(s.hdr)&&/Plan DD/.test(s.hdr)&&s.pInc==s.n&&s.dInc>0&&s.pDD>0&&s.chk&&s.tags.join()=='SIM'&&s.csv,`${nm}: slide sheet plan-vs-actual: ${s.n} joints, plan ${s.pInc}, Δ ${s.dInc}, DD ${s.pDD}, plan tagged SIM, CSV includes it`);
 await p.evaluate(()=>{const e=document.querySelector('#ss56 .wrap');const th=[...document.querySelectorAll('#ss56 th')].find(t=>/Plan Inc/.test(t.textContent));if(e&&th)e.scrollLeft=th.offsetLeft-60});await w(400);{const h=await p.evaluate(()=>{const r=document.getElementById('ss56h').getBoundingClientRect(),W=document.querySelector('#ss56 .wrap').getBoundingClientRect(),sl=document.querySelector('#ss56 .wrap').scrollLeft;return {sl,in:r.left>=W.left-1&&r.left<W.left+20&&r.width>100}});ok(h.sl>0&&h.in,nm+': well header stays in view when the table is scrolled sideways (scrollLeft '+h.sl+')')}await p.screenshot({path:`shots_live/110_w3_${nm}_3_plan_vs_actual.png`});await p.close()}
ok(EXT.length==0,'no Supabase/Adaga/WITSML requests');await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
