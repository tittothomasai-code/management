// v5.11.4.1 P0: DD cabin steering run (ddrun.js). Cold start (fresh profile) -> ?demo=ddcab -> Start/Pause/Reset, default plan, MWD survey per stand,
// injected errors, deviation readouts, steering reduces distance to plan, score, difficulty, motor + perf dot live, stall drill, gamepad 9. Desk + phone. Offline SIM.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH=process.env.SHOT||'shots_live/131_ddrun_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const MOCK=()=>{const B=()=>Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={id:'Mock Xbox Controller',index:0,connected:true,axes:[0,0,0,0],buttons:B(),mapping:'standard'};navigator.getGamepads=()=>[window.__pad,null,null,null]};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(nm+': '+e.message));await p.evaluateOnNewDocument(MOCK);
 await p.setRequestInterception(true);p.on('request',r=>{if(/adaga|witsml|:8796|:8799/i.test(r.url())&&r.resourceType()!='script'){bad.push(r.url());r.abort()}else r.continue()});
 const E=(f,...a)=>p.evaluate(f,...a),R=()=>E(()=>{const r=GX.ddrun.run;return {md:r.bit.md,n:r.surveys.length,run:r.running,instr:r.instr,dP:r.ms?.dP,wob:r.set.wob,start:r.surveys[0].md}});
 await p.goto(BASE+'/?demo=ddcab',{waitUntil:'load',timeout:90000});
 ok(await p.waitForSelector('#ddRun #drGo',{visible:true,timeout:60000}).then(()=>true,()=>false),nm+': cold start (fresh profile, ?demo=ddcab) shows the run bar with Start');
 ok(await E(()=>localStorage.length==0||!localStorage.getItem('dw_start_save')),nm+': nothing pre-loaded (no saved game)');
 const pl=await E(()=>{const r=GX.ddrun.run,P=r.plan,mx=Math.max(...P.map(p=>p.inc));return {src:r.planSrc,kop:P.find(p=>p.inc>0.5)?.md,mx,end:P.at(-1).inc,txt:document.getElementById('drPlan').textContent}});
 ok(pl.src=='default SIM plan'&&pl.kop>=300&&pl.kop<=320&&Math.abs(pl.mx-35)<0.01&&Math.abs(pl.end-20)<0.01&&/default SIM plan/.test(pl.txt),nm+': default SIM plan loaded (KOP 300, build to 35°, tangent, drop to 20°) '+JSON.stringify(pl));
 ok(await E(()=>{const r=document.getElementById('drGo').getBoundingClientRect();return r.width>40&&r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id=='drGo'}),nm+': Start is visible and on top');
 const r0=await R();ok(!r0.run,nm+': idle before Start');
 await p.select('#drSpd','4');await p.click('#drGo');await w(400);ok(await E(()=>document.getElementById('drGo').textContent.includes('Pause')),nm+': Start -> button shows Pause');
 const g0=await E(()=>document.getElementById('drG').textContent);await p.click('#drPerf');await p.waitForFunction(()=>GX.ddcab.motorPerf?.dot,{timeout:20000}).catch(()=>{});await w(300);const d0=await E(()=>GX.ddcab.motorPerf?.dot&&{...GX.ddcab.motorPerf.dot});ok(!!d0,nm+': motor-performance pop-up opens with an operating point');
 const t0=Date.now();while(Date.now()-t0<40000&&(await R()).n<3)await w(500);const r1=await R();
 ok(r1.md>r0.md+30,nm+': depth advances while running ('+r0.md.toFixed(1)+' -> '+r1.md.toFixed(1)+')');ok(r1.n>=3,nm+': MWD surveys arrive ('+r1.n+')');
 ok(await E(()=>{const s=GX.ddrun.run.surveys;return s.slice(1).every((v,i)=>Math.abs(v.md-s[i].md-30)<0.05)}),nm+': one MWD survey per 30 m stand');
 ok(r1.instr!=r0.instr,nm+': driller instruction changes ('+r1.instr.slice(0,60)+')');ok(await E(g=>document.getElementById('drG').textContent!=g,g0),nm+': deviation / rig readouts update live');
 await E(()=>{const e=document.getElementById('drWob');e.value=20;e.dispatchEvent(new Event('input'))});await p.waitForFunction(x=>GX.ddcab.motorPerf?.dot&&GX.ddcab.motorPerf.dot.x!=x,{timeout:30000},d0?.x).catch(()=>{});await w(300);const d1=await E(()=>({...GX.ddcab.motorPerf.dot})),r2=await R();
 ok(await E(()=>GX.ddcab.motor?.sess?.wob==GX.ddrun.run.set.wob),nm+': mud motor driven through GX.ddcab.motor.step (WOB '+r2.wob+')');ok(r2.dP!=r0.dP&&r2.dP>0,nm+': motor diff pressure updates ('+r2.dP+' bar)');
 ok(d1.x!=d0.x||d1.yRpm!=d0.yRpm,nm+': perf pop-up dot moves ('+d0.x+' -> '+d1.x+')');
 await E(()=>{const e=document.getElementById('drWob');e.value=10;e.dispatchEvent(new Event('input'))});await w(1500);ok(await E(()=>{const e=document.getElementById('ddmp');return !!e&&e.getBoundingClientRect().bottom<=innerHeight+1&&e.getBoundingClientRect().height>100}),nm+': perf pop-up open and on screen mid-run');await p.screenshot({path:SH+nm+'_midrun_perf.png'});ok(true,nm+': screenshot '+SH+nm+'_midrun_perf.png');
 ok(await E(()=>!/\bLIVE\b/.test(document.getElementById('ddRun').textContent)&&/SIM/.test(document.getElementById('ddRun').textContent)),nm+': run bar tagged SIM, never LIVE');
 await E(()=>document.getElementById('ddmp')&&GX.ddcab.motorPerf.close());
 await p.click('#drGo');await w(400);const pa=await R();await w(1500);const pb=await R();ok(!pa.run&&pa.md==pb.md,nm+': Pause freezes depth');
 await p.click('#drReset');await w(400);const rs=await R();ok(rs.md==rs.start&&rs.n==1&&!rs.run,nm+': Reset restores the start ('+rs.md+' m, 1 survey)');
 // scripted sequence (deterministic engine in page)
 const sq=await E(()=>{const D=GX.ddrun,seq=(diff,steer)=>{const r=D.newRun({diff,seed:42});for(let i=0;i<10;i++){if(steer)D.applyRec(r);else r.set.mode='rotate';D.drill(r,30)}return {md:r.bit.md,E:r.bit.E,N:r.bit.N,tvd:r.bit.tvd,dist:D.offsets(r).dist,sc:D.score(r),n:r.surveys.length}};
  const off=seq('off',true),nor=seq('normal',true),rot=seq('normal',false);return {off,nor,rot,mag:['easy','normal','hard'].map(k=>D.errMag(D.errors(k,42)))}});
 ok(sq.nor.n==11,nm+': scripted 10 stands -> 10 MWD surveys');
 ok(Math.hypot(sq.nor.E-sq.off.E,sq.nor.N-sq.off.N,sq.nor.tvd-sq.off.tvd)>0.5,nm+': injected errors change the trajectory (vs errors off)');
 ok(sq.nor.dist<sq.rot.dist,nm+': correct steering reduces distance to plan ('+sq.nor.dist.toFixed(1)+' m vs '+sq.rot.dist.toFixed(1)+' m unsteered)');
 ok(sq.nor.sc.score>=0&&sq.nor.sc.score<=100&&sq.nor.sc.score>sq.rot.sc.score&&Number.isFinite(sq.nor.sc.dlsSd),nm+': score computes (steered '+sq.nor.sc.score+' vs unsteered '+sq.rot.sc.score+')');
 ok(sq.mag[0]<sq.mag[1]&&sq.mag[1]<sq.mag[2],nm+': difficulty scales error magnitude '+sq.mag.map(x=>x.toFixed(1)).join(' < '));
 await p.select('#drDiff','hard');await w(300);ok(await E(()=>GX.ddrun.run.diff=='hard'&&GX.ddrun.run.E.k==2),nm+': Difficulty select applies (Hard)');await p.select('#drDiff','normal');
 ok(await E(()=>{const D=GX.ddrun,r=D.run;D.drill(r,5000);D.ui();const e=document.getElementById('drEnd');return r.done&&!e.hidden&&/Score \d+\/100/.test(e.textContent)}),nm+': end-of-run score shown at TD');
 ok(await E(()=>{const D=GX.ddrun;let got=null;const un=D.onFinish(x=>got=x);const r=D.load({plan:D.defaultPlan(),difficulty:'easy',seed:7,errors:{bitWalk:0}});const okL=r.diff=='easy'&&r.seed==7&&r.E.bitWalk==0;D.start();D.drill(r,5000);un();D.pause();return okL&&got&&Number.isFinite(got.score)&&got.time.simHours>0&&got.src=='SIM'}),nm+': plug-in API load()/start()/onFinish() -> {score,time}');
 await p.click('#drReset');await w(300);
 // stall drill
 await p.select('#drScen','stall');await w(300);await p.click('#drGo');const s0=Date.now();while(Date.now()-s0<60000&&!(await E(()=>GX.ddrun.run.stalled)))await w(300);
 ok(await E(()=>{const e=document.getElementById('drStall');return GX.ddrun.run.stalls>=1&&!e.hidden&&/STALL/.test(e.textContent)}),nm+': Motor stall drill ramps WOB to stall and shows the warning (WOB '+(await R()).wob+' t)');
 await p.click('#drPU');await w(300);ok(await E(()=>!GX.ddrun.run.stalled),nm+': Pick up off bottom clears the stall');await p.click('#drGo');await w(300);
 // gamepad: Start (9) tap toggles, hold resets, no Home
 await p.select('#drScen','build');await w(300);const pr=async(ms)=>{await E(()=>{window.__pad.buttons[9]={pressed:true,value:1}});await w(ms);await E(()=>{window.__pad.buttons[9]={pressed:false,value:0}});await w(300)};
 await pr(150);ok(await E(()=>GX.ddrun.run.running),nm+': gamepad Start tap starts the run');await w(1200);await pr(150);ok(await E(()=>!GX.ddrun.run.running),nm+': gamepad Start tap pauses');
 const mdp=(await R()).md;await pr(1400);const af=await R();ok(af.md==af.start&&mdp>af.start&&!af.run,nm+': gamepad Start hold (1 s) resets');
 ok(await E(()=>!document.getElementById('start')&&document.getElementById('ddc').style.display!='none'),nm+': Start button does not trigger Home');
 if(nm=='phone')ok(await E(()=>{const e=document.getElementById('ddRun');return e.scrollWidth<=e.clientWidth+2}),'phone: run bar fits the width');
 await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,5).join(' | '));ok(!bad.length,'no WITSML/Adaga requests '+bad.slice(0,3).join(' '));
console.log(`\nddrun ${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0);
