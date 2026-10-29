// v5.5 iPhone test: blind prediction log + human-pick import + scorecard. SIM-TEST only (synthetic gamma, Doug fixture); NO Adaga/proxy calls.
import fs from 'fs';import puppeteer from 'puppeteer-core';import * as P from './ext13.js';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/103_v55_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
// unit: parsing + freezing
const fx=fs.readFileSync('fixtures/westside_roof_floor_2879.json','utf8'),H1=P.parseHuman(fx);ok(H1.picks.length>50&&Math.abs(H1.picks[0].md-(2353.7+288.4))<0.01,'fixture JSON → '+H1.picks.length+' picks, HPL→MD +288.4');
const H2=P.parseHuman('md,roof,floor\n2900,106.7,109.7\n2905,106.6,109.6');const H3=P.parseHuman('hpl roof floor\n2611.6 106.7 109.7');ok(H2.picks.length==2&&H2.picks[1].md==2905&&Math.abs(H3.picks[0].md-2900)<0.01,'CSV (md) and whitespace (hpl) formats');
const L=[];P.append({run:'r',label:'SIM-TEST',md:1,roof:1,floor:2},L);P.append({run:'r',label:'SIM-TEST',md:2,roof:1,floor:2},L);ok(!P.append({run:'r',md:1.5,roof:9,floor:9},L)&&P.verify(L),'append-only: no back-filling an earlier MD, chain verifies');
let frozen=false;try{L[0].roof=5}catch{frozen=true}ok((frozen||L[0].roof==1)&&P.verify(L),'entries frozen');const L2=L.map(x=>({...x}));L2[0].roof=1.3;ok(!P.verify(L2),'hindsight edit breaks hash chain');
const sc=P.score([{run:'r',label:'SIM-TEST',md:10,roof:1.2,floor:2,sRoof:.1,sFloor:.1,seenRoof:true,seenFloor:false},{run:'r',label:'SIM-TEST',md:20,roof:1.0,floor:3,sRoof:.1,sFloor:.1,seenRoof:true}],{src:'x',picks:[{md:10,roof:1,floor:2.2},{md:20,roof:1,floor:2}]});
ok(Math.abs(sc.roof.mean-0.1)<1e-9&&Math.abs(sc.roof.bias-0.1)<1e-9&&sc.floor.max==1&&sc.roof.within==1&&sc.floor.within==0.5&&sc.label=='SIM-TEST'&&sc.lead.roof.leadM==0&&!sc.lead.floor.seen,'scorecard maths (mean/bias/max/±0.5/lead)');
// browser
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const p=await b.newPage();const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co|witsml|:8796|:8799/i.test(u)){ext.push(u);r.abort()}else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2000);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
await p.click('#g8btn');await w(800);await p.click('#r53btn');await w(500);ok(await p.evaluate(()=>!!document.getElementById('p55')&&!!GX.p55),'blind-log section inside 🎯 Roof/floor panel');
await p.evaluate(()=>document.getElementById('p55').scrollIntoView());await p.screenshot({path:SH+'1_panel_empty.png'});
// import Doug picks by paste (exactly how Titto would)
await p.evaluate(t=>{document.getElementById('p55h').value=t},fx);await p.click('#p55imp');await w(500);ok(await p.evaluate(()=>GX.p55.ST.human?.picks?.length>50),'pasted fixture JSON imported');
const t0=Date.now();await p.evaluate(()=>GX.p55.simReplay());await w(1500);const S=await p.evaluate(()=>({n:GX.p55.ST.log.length,sc:GX.p55.ST.sc,o:document.getElementById('p55o').innerText,v:GX.p55.verify()}));console.log('replay',S.n,'entries in',Date.now()-t0,'ms');console.log(S.o);
ok(S.n>=30&&S.v,'SIM-TEST blind replay logged '+S.n+' frozen entries, chain intact');ok(S.sc&&S.sc.label=='SIM-TEST'&&/SIM-TEST/.test(S.o)&&!/\bLIVE\b/.test(S.o.replace(/while live/i,'')),'labelled SIM-TEST, never LIVE');
ok(S.sc.roof.n>=40&&S.sc.roof.median<0.5,'roof scored: median |e| '+S.sc.roof.median.toFixed(2)+' m, max '+S.sc.roof.max.toFixed(2)+', bias '+S.sc.roof.bias.toFixed(2)+', ±0.5 '+Math.round(100*S.sc.roof.within)+'%');
ok(S.sc.floor.n>=40,'floor scored: median |e| '+S.sc.floor.median.toFixed(2)+', ±0.5 '+Math.round(100*S.sc.floor.within)+'% (floor seen: '+S.sc.lead.floor.seen+')');
ok(S.sc.lead.roof.seen&&S.sc.lead.roof.leadM!=null,'roof lead '+S.sc.lead.roof.leadM+' m (first seen MD '+S.sc.lead.roof.firstSeenMd+' vs human '+S.sc.lead.roof.humanFirstMd+')');
fs.writeFileSync('/tmp/v55_score.json',JSON.stringify(S.sc,null,1));
await p.evaluate(()=>document.getElementById('p55o').scrollIntoView());await p.screenshot({path:SH+'2_scorecard.png'});await p.evaluate(()=>document.getElementById('p55c').scrollIntoView({block:'center'}));await p.screenshot({path:SH+'3_curtain_overlay.png'});
await p.evaluate(()=>document.getElementById('p55tbl').scrollIntoView({block:'center'}));await p.screenshot({path:SH+'4_per_md_errors.png'});
// persisted + frozen across reload; replay of a second run doesn't alter the first
const first=await p.evaluate(()=>JSON.stringify(GX.p55.ST.log.slice(0,5)));await p.reload();await w(9000);await p.click('#g8btn');await w(600);await p.click('#r53btn');await w(500);
ok(await p.evaluate(f=>JSON.stringify(GX.p55.ST.log.slice(0,5))==f&&GX.p55.verify()&&GX.p55.ST.human?.picks?.length>50,first),'log + human picks saved on device, unchanged after reload');
const csv=await p.evaluate(()=>GX.p55.toCSV()),scsv=await p.evaluate(()=>{GX.p55.score();return GX.p55.scoreCSV()});ok(/^run,label,timestamp,md_m/.test(csv)&&csv.split('\n').length>30&&/SIM-TEST/.test(scsv),'CSV exports (log + scorecard)');fs.writeFileSync('/tmp/v55_log.csv',csv);
// file upload path
fs.writeFileSync('/tmp/next_section.csv','md,roof,floor\n2880,106.9,109.9\n2890,106.8,109.8\n');const fi=await p.$('#p55file');await fi.uploadFile('/tmp/next_section.csv');await w(800);ok(await p.evaluate(()=>GX.p55.ST.human.picks.length==2&&/next_section/.test(GX.p55.ST.human.src)),'CSV upload imports picks');
await p.evaluate(()=>document.getElementById('p55').scrollIntoView());await p.screenshot({path:SH+'5_uploaded_next_section.png'});
const lsKeys=await p.evaluate(()=>Object.keys(localStorage).join(' '));ok(!/pass/i.test(lsKeys)&&!/pass/i.test(await p.evaluate(()=>localStorage.getItem('dw_predlog55')||'')),'no password in localStorage ('+lsKeys+')');
ok(ext.length==0,'no Adaga / proxy / WITSML requests ('+ext.length+')');ok(errs.length==0,'no page errors '+errs.join(' | ').slice(0,200));
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);
