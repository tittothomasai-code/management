// v4.7 iPhone test: survey discovery across ALL wellbores (SIM-TEST mock upstream 127.0.0.1:8799 via local proxy 8796). NO Adaga calls.
// Needs: node mock_upstream.mjs & node witsml_proxy.mjs (fresh, not latched by a 401).
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/96_v47_',MOCK='http://127.0.0.1:8799',PROXY=process.argv[3]||'http://localhost:8796/soap';
const ctl=q=>fetch(MOCK+'/ctl/'+q).then(r=>r.json());
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const p=await b.newPage();const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co/i.test(u)){ext.push(u);r.abort()}else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
await ctl('fmt?f=plain');
await p.evaluate((m,px)=>{const X=GX.witsml;X.CFG.proxy=px;X.CFG.url=m+'/witsml';X.setCred('simtest','dummy-not-a-secret');X.open();X.WML.liveMode=true},MOCK,PROXY);
const run=async(wl,wb)=>p.evaluate(async(wl,wb)=>{await GX.witsml.loadWell(wl,wb);await new Promise(r=>setTimeout(r,800));const W=GX.witsml.WML;return{c:W.svCands.map(c=>({wb:c.wb,uid:c.uid,n:c.n,g:c.growing})),wbs:W.svDiag.find(d=>d.wellbores!=null)?.wellbores,n:GEO.surv.stations.length,sim:GEO.surv.simTest,live:GEO.surv.live,cfg:[GX.witsml.CFG.svWellbore,GX.witsml.CFG.svTraj],path:window.pathSrc&&pathSrc()}},wl,wb);
// A: DR101L real layout (5 wellbores, trajectory 'Survey - Directional' in WB01B02 + older one in WB01B01)
const A=await run('DR101L','WB01B02');console.log('A',JSON.stringify(A));
ok(A.wbs==5,'A: all 5 wellbores of DR101L listed (TOP HOLE, WB01B01, WB01B01 BUILD, WB01B02, WB01B02 BUILD)');
ok(A.c.length==2&&A.c.some(c=>c.uid=='TRJ-OLD-01'&&c.wb=='WB01B01'),'A: trajectories found across wellbores: '+A.c.map(c=>c.wb+'/'+c.uid).join(', '));
ok(A.cfg[0]=='WB01B02'&&A.cfg[1]=='SIMTEST-TRAJ'&&A.n==48,'A: picks WB01B02 "Survey - Directional" by uid, 48 stations');
ok(A.sim&&!A.live,'A: labelled SIM-TEST, not LIVE');
// prefer selected log wellbore: log in WB01B01 -> old trajectory
const A2=await run('DR101L','WB01B01');ok(A2.cfg[0]=='WB01B01'&&A2.n==5,'A2: log wellbore WB01B01 preferred -> TRJ-OLD-01, 5 stations');
// encodings
for(const f of ['prefixed','cdata','double']){await ctl('fmt?f='+f);const R=await run('DR101L','WB01B02');ok(R.n==48&&R.cfg[1]=='SIMTEST-TRAJ','encoding '+f+': 48 stations parsed')}
await ctl('fmt?f=plain');
// C: log in WB03A, trajectories only in WB03B -> guardrail: NOT used automatically; chooser warns; manual pick = mismatch flagged
const C=await run('DR303M','WB03A');console.log('C',JSON.stringify(C));
ok(C.n==0&&C.c.length==2&&C.c.every(c=>c.wb=='WB03B'),'G1 parent: trajectories in other wellbore WB03B found but NOT auto-used for log wellbore WB03A');
await p.evaluate(()=>{MOB&&MOB.open&&MOB.open('witsml');const d=document.getElementById('svdbg');d.open=true;document.getElementById('svtraj').scrollIntoView()});await w(700);
const sel=await p.evaluate(()=>({vis:document.getElementById('svtraj').style.display!='none',opts:[...document.getElementById('svtraj').options].map(o=>o.textContent)}));
ok(sel.vis&&sel.opts.length==2&&sel.opts.every(o=>/other wellbore/.test(o)),'G1 chooser lists 2 with ⚠ other wellbore: '+sel.opts.join(' | '));
await p.evaluate(()=>{const e=document.getElementById('svtraj');e.value=String(GX.witsml.WML.svCands.findIndex(c=>c.uid=='ACT-1'));e.dispatchEvent(new Event('change'))});await w(2500);
const mm=await p.evaluate(()=>({n:GEO.surv.stations.length,cur:GX.witsml.svCurrency(),hud:document.getElementById('svhud').innerText}));
ok(mm.n==20&&mm.cur.flags.some(f=>/Wellbore mismatch/.test(f))&&/mismatch/.test(mm.hud),'G1 manual pick of other wellbore -> 20 stations + "Wellbore mismatch" warning in HUD');
await p.screenshot({path:SH+'1_iphone_trajectory_chooser.png'});
// back to DR101L for currency/sanity guardrails
await run('DR101L','WB01B02');await w(2500);
const hud=await p.evaluate(()=>document.getElementById('svhud').innerText);ok(/Well DR101L.*\/ WB01B02.*\/ Survey - Directional/.test(hud),'G1 HUD: '+hud.split('\n')[0]);
const cur=await p.evaluate(async()=>{const X=GX.witsml,S=G.S,r={};X.CFG.svStaleH=1e6;S.md=1500/0.3048;r.ok=X.svCurrency();X.CFG.svStaleM=50;r.stale=X.svCurrency();X.CFG.svStaleM=100;S.md=500/0.3048;r.deep=X.svCurrency();S.md=1500/0.3048;X.CFG.svStaleH=24;const t=X.WML.sv.trajTime;X.WML.sv.trajTime=new Date(X.WML.lastRowMs-48*3.6e6).toISOString();r.old=X.svCurrency();X.WML.sv.trajTime=t;return r});
console.log('CUR',JSON.stringify(cur));
ok(cur.ok.ok,'G2 deepest 1410 m vs hole 1500 m (limit 100) -> current');ok(cur.stale.flags.some(f=>/Survey stale.*behind/.test(f)),'G2 limit 50 m -> "Survey stale"');
ok(cur.deep.flags.some(f=>/deeper than hole/.test(f)),'G2 hole 500 m -> "Survey deeper than hole"');ok(cur.old.flags.some(f=>/stale.*h older/.test(f)),'G2 survey 48 h older than log -> stale');
const rp=await p.evaluate(async()=>{const X=GX.witsml;document.getElementById('svi').value='900';const a=Math.min(300000,Math.max(60000,900000));await (await fetch('http://127.0.0.1:8799/ctl/grow?k=2')).json();const n0=GEO.surv.stations.length;await X.svPoll();return{n0,n1:GEO.surv.stations.length,iv:X.CFG.svInterval,timer:!!X.WML.sv.timer}});
ok(rp.n1==rp.n0+2&&rp.iv<=300000&&rp.iv>=60000&&rp.timer,'G3 re-poll adds new stations ('+rp.n0+'->'+rp.n1+'), interval '+rp.iv/1000+' s within 60–300 s');
const sn=await p.evaluate(()=>{const f=(md,inc,azi)=>({md:md/0.3048,inc,azi});return GX.witsml.svSanity([f(0,0,0),f(100,2,10),f(90,3,10),f(120,190,10),f(130,4,400),f(140,40,10),f(200,5,12),f(200,5,12)]).drop});
console.log('SAN',JSON.stringify(sn));ok(sn.md==1&&sn.inc==1&&sn.azi==1&&sn.dls==1,'G4 sanity drops: non-monotonic 1, incl>180 1, azi>360 1, dogleg spike 1 (exact duplicate silently merged)');
await p.evaluate(()=>{MOB&&MOB.open&&MOB.open('witsml');document.getElementById('svdbg').open=true});await w(2500);const dbg=await p.evaluate(()=>{const e=document.getElementById('svdbgb');e.parentElement.scrollIntoView();e.scrollIntoView();return e.innerText});
ok(/wellbores 5/.test(dbg)&&/trajectories 2/.test(dbg)&&/stations 48/.test(dbg)&&/<trajectorys/.test(dbg),'debug view: wellbores, trajectories, stations, raw XMLout');ok(/Source/.test(dbg)&&/Freshness/.test(dbg)&&/MD monotonic/.test(dbg)&&/Currency/.test(dbg),'G5 debug shows source, freshness, sanity badges, currency');
ok(!/dummy-not-a-secret/.test(dbg+await p.content()),'no credential in debug view/page');
await w(300);await p.screenshot({path:SH+'2_iphone_survey_debug.png'});
// none anywhere: unknown well -> clear message, debug still shows steps
const N=await run('NOPE1','');ok(N.c.length==0&&N.n==0,'no trajectory anywhere -> none, vertical path');
await p.evaluate(()=>document.getElementById('svdbgb').scrollIntoView());await w(300);await p.screenshot({path:SH+'3_iphone_debug_no_trajectory.png'});
ok(!errs.length,'no page errors '+errs.join('|'));ok(!ext.filter(u=>/adaga/i.test(u)).length,'no Adaga calls');
await b.close();console.log(fails?'FAILURES '+fails:'ALL PASS');process.exit(fails?1:0);
