// dd_cabin_test (helper DD-cabin): DD training cabin + mud motor. Shots shots_live/163_ddcab_*.
import puppeteer from 'puppeteer-core';import * as C from './ddcab_core.js';
const BASE=(process.argv[2]||'http://localhost:8835').replace(/\/$/,''),SH='shots_live/163_ddcab_';let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const near=(a,b,t)=>Math.abs(a-b)<=t;
// --- engine ---
let s1={md:0,inc:0,azi:0,E:0,N:0,tvd:0};const m1=C.minCurve(s1,100,0,0);ok(near(m1.tvd,100,1e-9)&&near(m1.dls,0,1e-9),'min curvature: vertical 100 m');
const a={md:1000,inc:10,azi:30,E:0,N:0,tvd:0},b=C.minCurve(a,1030,13,35);ok(near(C.dogleg(10,30,13,35),3.16,0.01)&&near(b.dls,3.16,0.01),'dogleg 10/30 -> 13/35 = 3.16 deg/30m');
ok(near(C.steer(30,45,3,0,30).inc,33,1e-6)&&near(C.steer(30,45,3,0,30).azi,45,1e-6),'steer TF 0 (high side): pure build');
ok(near(C.steer(30,45,3,180,30).inc,27,1e-6),'steer TF 180: pure drop');const rt=C.steer(30,45,3,90,30);ok(rt.azi>45&&near(rt.inc,30,0.2),'steer TF 90: turn right');
const rq=C.requiredTF(30,45,32,50);const back=C.steer(30,45,rq.dl,rq.tf,30);ok(near(back.inc,32,0.01)&&near(back.azi,50,0.01),'requiredTF round trip');
const M=C.MOTOR;ok(near(C.yieldDLS(M),60*1.5/13,1e-9),'motor yield: three-point geometry');
const ms=C.motorState(M,{flow:1800,wob:8,rotating:false,rpm:0});ok(near(ms.motorRpm,1800*C.motorRevL(M)*(1-0.35*(ms.dP/M.dPmax)**2),1)&&ms.motorRpm>100,'motor RPM = flow x rev/L');
ok(ms.spp>ms.sppOff&&near(ms.spp-ms.sppOff,ms.dP,0.2),'SPP = off-bottom + diff pressure');
const st=C.motorState(M,{flow:1800,wob:20,rotating:false,rpm:0});ok(st.stall&&st.motorRpm==0&&st.spp>ms.spp+25,'stall: SPP spike, motor stops');
ok(C.motorState(M,{flow:1800,wob:8,rotating:true,rpm:40}).bitRpm>ms.motorRpm,'rotating: bit RPM = motor + surface');
ok(C.motorState({...M,bend:2.12},{flow:1800,wob:8,rotating:true,rpm:40}).warn.includes('ROTATE-WITH-BEND LIMIT'),'rotate-with-bend limit warning');
ok(C.motorState(M,{flow:900,wob:5}).warn.includes('FLOW OUT OF RANGE'),'flow range warning');
ok(JSON.stringify(C.parse('Slide 10 m at TF 30L'))==JSON.stringify({cmd:'slide',len:10,tf:330}),'parse slide with left TF');ok(C.parse('rotate 27')?.len==27&&C.parse('take survey')?.cmd=='survey'&&C.parse('WOB 6')?.v==6,'parse rotate/survey/wob');
ok(/I do not understand/.test(C.command(C.newSession('build'),'make coffee').say[0]),'unknown command: driller asks again');
// build scenario driven by the recommendation calculator should stay near plan
const S=C.newSession('build');while(S.bit.md<S.S.endMd){const t=C.planTarget(S,30),r=C.recommend(S,t.inc,t.azi,30);if(r.slide>0.5)C.command(S,`slide ${r.slide} m at tf ${r.tf}`);if(r.rotate>0.5)C.command(S,`rotate ${r.rotate} m`);C.command(S,'take survey')}
const sc=C.score(S);ok(sc.done&&sc.avgDev<5&&sc.score>=70,`build: recommendation path stays on plan (avg ${sc.avgDev} m, score ${sc.score})`);ok(S.statorH>0&&S.temp>20,'stator hours + temperature tracked');
const S2=C.newSession('build');C.command(S2,'rotate 300');ok(C.score(S2).avgDev>C.score(S).avgDev,'rotate only: further from plan than steered run');
const SS=C.newSession('build');C.command(SS,'wob 25');const r2=C.command(SS,'slide 10 tf 0');ok(SS.stalled&&r2.say.some(x=>/STALL/.test(x)),'stall in session');ok(/stalled/.test(C.command(SS,'rotate 5').say.join()),'driller refuses until pick-up');
C.command(SS,'pick up');C.command(SS,'wob 6');ok(!SS.stalled&&C.command(SS,'slide 5 tf 0').say.some(x=>/complete/.test(x)),'recovery: pick up, less WOB, drill on');
const L=C.newSession('land');ok(L.S.zone&&C.score(L).zone===0,'land scenario has zone score');const lp=C.landPoint(L.plan),z=L.zoneFn(Math.hypot(lp.E,lp.N));ok(lp.tvd>z.top&&lp.tvd<z.base&&z.src=='SIM','zone sits on plan landing point, SIM');
const K=C.newSession('collide');const t0=C.tcPoint(K.bit,K.offsets[0].P);ok(t0.d>0&&t0.sf>0&&t0.ang>=0&&t0.ang<360,'travelling cylinder point');
let minPlan=9;for(const p of K.plan)if(p.md>300&&p.md<1000)minPlan=Math.min(minPlan,C.tcPoint(p,K.offsets[0].P).sf);ok(minPlan<1.5,'collide: plan path brings SF below 1.5 (trainee must steer away)');
// --- browser ---
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[],ERR=[];
for(const [nm,vp] of [['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}],['desk',{width:1440,height:900}]]){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);p.setDefaultTimeout(120000);
 p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.url())});p.on('pageerror',e=>/WebGL/.test(e.message)||ERR.push(e.message));
 await p.goto(BASE+'/?demo=ddcab&nosplash=1',{waitUntil:'load',timeout:180000});
 ok(await p.waitForFunction(()=>document.getElementById('ddSurv')&&window.DDCAB?.sess,{timeout:150000}).then(()=>true,()=>false),`${nm}: ?demo=ddcab opens the cabin`);await w(800);
 const t=await p.evaluate(()=>({sim:document.querySelectorAll('#ddc .sim').length,live:/\bLIVE\b/.test(document.getElementById('ddc').innerText),cv:['ddTF','ddVS','ddGR','ddTC'].every(i=>document.getElementById(i)),rows:document.querySelectorAll('#ddSurv tr').length,ov:document.documentElement.scrollWidth>innerWidth+2}));
 ok(t.sim>=6&&!t.live,`${nm}: SIM tags, no LIVE`);ok(t.cv&&t.rows>=2,`${nm}: data screens (toolface, section, gamma, TC, survey table)`);ok(!t.ov,`${nm}: no page side scroll`);
 await p.screenshot({path:SH+nm+'_1_cabin.png'});
 if(nm=='phone'){await p.click('[data-tab="steer"]');await w(200)}
 await p.type('#ddCmd','Slide 10 m at TF 20');await p.click('#ddSend');await w(300);
 const a1=await p.evaluate(()=>({md:DDCAB.sess.bit.md,log:document.getElementById('ddLog').innerText}));ok(a1.md>=309.9&&/Copy\. Slide 10 m at toolface 20 deg/.test(a1.log)&&/Slide is complete/.test(a1.log),`${nm}: typed instruction, driller acknowledges and executes`);
 await p.click('#ddRec');await w(400);const a2=await p.evaluate(()=>({n:DDCAB.sess.surveys.length,calc:document.getElementById('ddCalc').innerText}));ok(a2.n>=2&&/Recommendation: slide/.test(a2.calc),`${nm}: recommendation button drills + surveys`);
 await p.screenshot({path:SH+nm+'_2_steer.png'});
 if(nm=='phone'){await p.click('[data-tab="motor"]');await w(200)}
 ok(await p.evaluate(()=>{const e=document.getElementById('ddMotor');return e&&e.offsetParent!==null&&/Max diff pressure/.test(e.innerText)&&/Rev per gal/.test(e.innerText)}),`${nm}: motor spec sheet visible`);
 await p.evaluate(()=>{DDCAB.cmd('WOB 25');DDCAB.cmd('Slide 5 m at TF 0')});await w(300);ok(await p.evaluate(()=>!!document.getElementById('ddStall')&&/STALL/.test(document.getElementById('ddLog').innerText)),`${nm}: stall detection shows recovery steps`);
 if(nm=='phone')await p.click('[data-tab="screens"]');await w(200);await p.screenshot({path:SH+nm+'_3_stall.png'});
 await p.evaluate(()=>{DDCAB.cmd('Pick up off bottom');DDCAB.cmd('WOB 6')});ok(await p.evaluate(()=>!document.getElementById('ddStall')),`${nm}: recovered after pick up`);
 await p.evaluate(()=>DDCAB.scenario('land'));await w(300);ok(await p.evaluate(()=>/in zone/.test(document.getElementById('ddScoreP').innerText)),`${nm}: land scenario shows in-zone %`);await p.screenshot({path:SH+nm+'_4_land.png'});
 await p.evaluate(()=>DDCAB.scenario('collide'));await w(300);ok(await p.evaluate(()=>/OFFSET-A \(SIM\)/.test(document.getElementById('ddTCt').innerText)),`${nm}: collide scenario: offset in travelling cylinder`);await p.screenshot({path:SH+nm+'_5_collide.png'});
 if(nm=='desk'){const cols=await p.evaluate(()=>getComputedStyle(document.querySelector('#ddc .bd')).gridTemplateColumns.split(' ').length);ok(cols==3,'desk: docked 3-column layout');
  await p.click('#ddL .colb');await w(200);ok(await p.evaluate(()=>document.getElementById('ddL').classList.contains('ddCol')&&document.getElementById('ddL').getBoundingClientRect().width<=50),'desk: left dock collapses to strip');await p.screenshot({path:SH+'desk_6_collapsed.png'});await p.click('#ddL .colb')}
 // home tile
 const p2=await ctx.newPage();await p2.setViewport(vp);await p2.goto(BASE+'/?start=1',{waitUntil:'load',timeout:180000});const hasT=await p2.waitForSelector('#st_ddcab',{timeout:120000}).then(()=>true,()=>false);ok(hasT,`${nm}: home page has DD Training tile`);
 if(hasT){await p2.evaluate(()=>document.getElementById('st_ddcab').click());ok(await p2.waitForFunction(()=>document.getElementById('ddc')?.style.display=='flex',{timeout:60000}).then(()=>true,()=>false),`${nm}: tile opens the cabin`)}
 await ctx.close()}
ok(EXT.length==0,'no external requests');ok(ERR.length==0,'no page errors '+ERR.slice(0,2).join(' | '));
await br.close();console.log(`dd_cabin ${pass}/${fail}`);process.exit(fail?1:0);
