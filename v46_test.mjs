// v4.6 iPhone test: LIVE with no surveys must draw a VERTICAL well + "No survey" label, never the SIM curve/SIM clock. Offline, NO Adaga calls.
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/95_v46_';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const p=await b.newPage();const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co/i.test(u)){ext.push(u);r.abort()}else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
// SIM baseline: curved sim path, SIM clock
const s0=await p.evaluate(()=>({src:pathSrc(),clk:document.getElementById('clock').textContent}));ok(/SIM time/.test(s0.clk),'SIM mode: SIM clock shown');
// mock LIVE connected, live MD 2842.3 m, no survey stations
await p.evaluate(()=>{GEO.resetWell&&GEO.resetWell();WML.liveMode=true;WML.simulated=false;G.S.md=2842.3/0.3048});await w(1500);
const a=await p.evaluate(()=>{const pts=wellPts();return{src:pathSrc(),pts,clk:document.getElementById('clock').textContent,lab:document.getElementById('nosurv'),labT:document.getElementById('nosurv').textContent,labV:document.getElementById('nosurv').style.display!='none'}});
const maxOff=Math.max(...a.pts.map(q=>Math.hypot(q[0],q[2])));
ok(a.src=='VERTICAL'&&maxOff<1e-6,'LIVE no survey -> vertical path (max horiz offset '+maxOff+')');
ok(a.labV&&/No survey — trajectory assumed vertical/.test(a.labT),'label shown: '+a.labT);
ok(!/SIM time/.test(a.clk)&&/LIVE/.test(a.clk),'clock in LIVE has no "SIM time": '+a.clk);
await p.screenshot({path:SH+'1_iphone_live_no_survey_vertical.png'});
// live surveys arrive (radian uom) -> survey path, label hidden
await p.evaluate(async()=>{const GG=await import('./geo.js?v=46');const x='<trajectory><name>T</name>'+[[0,0,0],[500,0,0.785],[1500,0.35,0.785],[2842,0.52,0.8]].map(r=>`<trajectoryStation><md uom="m">${r[0]}</md><incl uom="rad">${r[1]}</incl><azi uom="rad">${r[2]}</azi></trajectoryStation>`).join('')+'</trajectory>';const t=GG.parseTrajectory(x);GEO.appendStations(t.stations,{src:'WITSML',name:'T',live:true})});await w(1500);
const c=await p.evaluate(()=>({src:pathSrc(),st:GEO.surv.stations.map(s=>s.inc),lv:document.getElementById('nosurv').style.display,clk:document.getElementById('clock').textContent}));
ok(c.src=='SURVEY'&&c.lv=='none'&&Math.abs(Math.max(...c.st)-29.79)<0.1,'LIVE with rad surveys -> survey path, inc in degrees max '+Math.max(...c.st).toFixed(2)+', label hidden');
await p.screenshot({path:SH+'2_iphone_live_with_survey.png'});
// SIM-TEST stations must not be used as LIVE trajectory
await p.evaluate(()=>{GEO.resetWell();GEO.appendStations([{md:0,inc:0,azi:0},{md:3000,inc:20,azi:45},{md:9000,inc:60,azi:45}],{src:'SIM-TEST',name:'x',simTest:true})});await w(1200);
ok(await p.evaluate(()=>pathSrc())=='VERTICAL','SIM-TEST stations not drawn in LIVE');
// back to sim
await p.evaluate(()=>{WML.liveMode=false;GEO.resetWell()});await w(1200);
const d=await p.evaluate(()=>({src:pathSrc(),clk:document.getElementById('clock').textContent,lv:document.getElementById('nosurv').style.display}));ok(d.src!='VERTICAL'&&/SIM time/.test(d.clk)&&d.lv=='none','back to SIM: sim path + SIM clock, no label');
await p.screenshot({path:SH+'3_iphone_back_to_sim.png'});
ok(!errs.length,'no page errors '+errs.join('|'));ok(!ext.filter(u=>/adaga/i.test(u)).length,'no Adaga calls');
await b.close();console.log(fails?'FAILURES '+fails:'ALL PASS');process.exit(fails?1:0);
