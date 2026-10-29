// v5.2: WestSide report reference (SIM-TEST, transcribed, NOT live) → min-curv TVDSS/DLS, tie-in at reported TVD, curtain/3D horizontal, Compare-to-report, thin-seam Kalman sanity.
import fs from 'fs';import puppeteer from 'puppeteer-core';import * as G from './geo.js';import * as K from './ext9.js';import {parseReport,ours,deltas} from './ext10.js';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};const M=0.3048;
const F=JSON.parse(fs.readFileSync('fixtures/westside_dr101l_wb01b02_2879.json'));const E=F.elevation_m;ok(/SIM-TEST/.test(F.label)&&/NOT LIVE/.test(F.label),'fixture labelled SIM-TEST / NOT LIVE');
// 1. min curvature vs report, tie-in at first station's reported TVD (TVDSS + elevation)
const st=F.stations.map((r,i)=>({md:r[0]/M,inc:r[1],azi:r[2],...(i?{}:{tvd_rep:(r[3]+E)/M})}));const c=G.minCurvStations(st);
let mt=0,md=0;const rows=[];c.forEach((p,i)=>{const r=F.stations[i],t=p.tvd*M-E,d=p.dls*10/(100*M);mt=Math.max(mt,Math.abs(t-r[3]));if(i)md=Math.max(md,Math.abs(d-r[4]));rows.push([r[0],t.toFixed(2),r[3],d.toFixed(2),r[4]].join(' '))});
console.log(rows.join('\n'));ok(c[0].tie=='reported TVD','default tie-in uses reported TVD of first station (was md·cos(inc) → '+(F.stations[0][0]*Math.cos(F.stations[0][1]*Math.PI/180)).toFixed(0)+' m)');
ok(mt<=0.10,'TVDSS max |Δ| '+mt.toFixed(3)+' m over 18 stations (table rounded to 0.1)');ok(md<=0.15,'DLS max |Δ| '+md.toFixed(2)+'°/10 m');
const l=c.at(-1);ok(Math.abs(l.tvd*M-F.last.tvd)<0.05&&Math.abs(l.tvd*M-E-F.last.tvdss)<0.05,'last survey TVD '+(l.tvd*M).toFixed(2)+' vs 250.52, TVDSS '+(l.tvd*M-E).toFixed(2)+' vs 109.41');
const rep=parseReport('Last survey 2,851.05 92.34 171.74 171.74 250.52 109.41 1.08\nProjection 2,879.09 91.75 171.74 171.74 249.38 108.27 0.00');ok(rep.last.md==2851.05&&rep.proj.tvdss==108.27&&rep.last.dls==1.08,'paste parser (thousands commas, mag-azi column)');
const o=ours(c,rep,E),d=deltas(rep,o);console.log(JSON.stringify(d));ok(Math.abs(d.proj.tvdss)<0.05,'projection (straight at last inc) TVDSS Δ '+d.proj.tvdss.toFixed(3)+' m; min-curv-to-91.75° alt Δ '+d.proj.tvdMC.toFixed(2)+' m');
ok(G.samplePath(c,F.proj.md/M,5)[0].md==c[0].md,'path starts at tie-in (upper hole not invented)');
// WITSML path: parseTrajectory keeps <tvd> → same tie-in (sidetrack trajectory that starts deep)
const xml='<trajectorys><trajectory><name>SIM-TEST</name>'+F.stations.map(r=>`<trajectoryStation><md uom="m">${r[0]}</md><tvd uom="m">${(r[3]+E).toFixed(2)}</tvd><incl uom="dega">${r[1]}</incl><azi uom="dega">${r[2]}</azi></trajectoryStation>`).join('')+'</trajectory></trajectorys>';
const c2=G.minCurvStations(G.parseTrajectory(xml).stations);ok(Math.abs(c2.at(-1).tvd*M-250.52)<0.05,'WITSML-parsed deep trajectory ties in at <tvd>: last TVD '+(c2.at(-1).tvd*M).toFixed(2));
// 4. Kalman, thin 2 m seam
for(const o of [{dip:0.8,th:2,top0:249.5},{dip:0.8,th:2,top0:249.5,seed:3},{dip:-0.8,th:2,top0:249.5,seed:11}]){const r=K.synthBench(o);const g=r.K.grid.filter(p=>p.hd>=100&&p.hd<=1100),th=g.map(p=>p.thick);
 ok(r.rmsTop<0.1&&r.rmsBot<0.1&&Math.abs(r.dipEst-o.dip)<0.1&&r.misclassified==0&&Math.min(...th)>1.8&&Math.max(...th)<2.2&&g.every(p=>p.bot>p.top),`2 m seam dip ${o.dip}: ${r.n} crossings, RMS top ${r.rmsTop.toFixed(3)} bot ${r.rmsBot.toFixed(3)} m, dip ${r.dipEst.toFixed(2)}°, thick ${Math.min(...th).toFixed(2)}–${Math.max(...th).toFixed(2)} m`)}
{const Kb=K.kalman([{hd:100,tvd:251,boundary:'bottom'}],[0,50,100,150],{th0:2});ok(Kb.nTop==0&&Math.abs(Kb.grid[2].thick-2)<1e-6,'only-bottom crossing (report case: climbing up into seam): thickness = prior 2 m, flagged in UI as not measured')}
// browser
const BASE='http://localhost:8777',SH='shots_live/100_v52_';const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>{if(/adaga|netlify\.app|supabase\.co/i.test(r.url()))r.abort();else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});await p.goto(BASE+'/index.html?'+Date.now());await p.evaluate(()=>{localStorage.clear()});await p.reload();await new Promise(r=>setTimeout(r,9000));
await p.click('#g8btn');await new Promise(r=>setTimeout(r,800));await p.click('#r52btn');await p.click('#r52ref');await new Promise(r=>setTimeout(r,3000));
let R2=await p.evaluate(()=>{const c=GX.ref52.compare();const pts=GEO.pathPts(GX.witsml?0:0);const pp=GEO.pathPts(S_md());function S_md(){return GEO.calc.at(-1).md+92}const tv=pp.map(q=>q.tvd*0.3048),inc=pp.map(q=>q.inc);
 return {d:c.d,src:GEO.surv.src,live:GEO.surv.live,ps:window.pathSrc(),tmin:Math.min(...tv),tmax:Math.max(...tv),imin:Math.min(...inc),ve:G8.ve,san:G8.kalSan,txt:document.getElementById('r52o').innerText.slice(0,600)}});
console.log(JSON.stringify(R2));ok(/SIM-TEST/.test(R2.src)&&!R2.live,'app survey source labelled SIM-TEST, not live');ok(Math.abs(R2.d.last.tvdss)<0.05&&Math.abs(R2.d.last.dls)<0.15&&Math.abs(R2.d.proj.tvdss)<0.05,'in-app compare: last TVDSS Δ '+R2.d.last.tvdss.toFixed(3)+', DLS Δ '+R2.d.last.dls.toFixed(2)+', proj TVDSS Δ '+R2.d.proj.tvdss.toFixed(3));
ok(R2.ps=='SURVEY','3D well path source = SURVEY (not vertical)');ok(R2.imin>88&&R2.tmax-R2.tmin<10,'path horizontal: inc ≥ '+R2.imin.toFixed(1)+'°, TVD span '+(R2.tmax-R2.tmin).toFixed(1)+' m over ~230 m');ok(R2.ve>3&&R2.ve<20,'curtain vertical exaggeration ×'+R2.ve?.toFixed(1)+' (report ≈ ×9)');
await p.evaluate(()=>document.getElementById('g8cur').scrollIntoView());await p.screenshot({path:SH+'1_curtain_reference.png'});await p.evaluate(()=>document.getElementById('r52').scrollIntoView());await p.screenshot({path:SH+'2_compare_to_report.png'});
await p.click('#g8v3');await new Promise(r=>setTimeout(r,2500));await p.screenshot({path:SH+'3_3d_horizontal.png'});
// 5. WITSML-style load (same code path as svPoll: appendStations with parsed <tvd>) → same shape; and with no stations → vertical
const W5=await p.evaluate(async(xml)=>{const G=await import('./geo.js?v=52');const st=G.parseTrajectory(xml).stations;GEO.appendStations(st,{src:'WITSML SIM-TEST',name:'mock/WB01B02',simTest:true});const l=GEO.calc.at(-1);return {n:GEO.calc.length,tvd:l.tvd*0.3048,src:GEO.surv.src}},xml);
ok(W5.n==18&&Math.abs(W5.tvd-250.52)<0.05,'WITSML-path load ('+W5.src+'): '+W5.n+' stations, last TVD '+W5.tvd.toFixed(2)+' m (report 250.52)');
ok(!errs.length,'no page errors '+errs.join('|').slice(0,200));console.log('FAILURES',fails);await b.close();process.exit(fails?1:0);
