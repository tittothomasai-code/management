// feat/dd-tracks: DD steering exercise track select (ddtracks.js). Cold start (fresh profile) -> ?demo=ddtracks -> track grid. Keyboard, gamepad, swipe,
// locks, pick, START (countdown transition), run starts with the track plan + error set, force-complete, best score saved, next track unlocked. Desk + phone. SIM, offline.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8842').replace(/\/$/,''),SH=process.env.SHOT||'shots_live/176_ddtracks_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const MOCK=()=>{const B=()=>Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={id:'Mock Xbox Controller',index:0,connected:true,axes:[0,0,0,0],buttons:B(),mapping:'standard'};navigator.getGamepads=()=>[window.__pad,null,null,null]};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--autoplay-policy=no-user-gesture-required']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(nm+': '+e.message));await p.evaluateOnNewDocument(MOCK);
 await p.setRequestInterception(true);p.on('request',r=>{if(/adaga|witsml|:8796|:8799/i.test(r.url())&&r.resourceType()!='script'){bad.push(r.url());r.abort()}else r.continue()});
 const E=(f,...a)=>p.evaluate(f,...a),S=()=>E(()=>GX.ddtracks.state),key=async k=>{await p.keyboard.press(k);await w(260)};
 const btn=async(i,ms=120)=>{await E(i=>{window.__pad.buttons[i]={pressed:true,value:1}},i);await w(ms);await E(i=>{window.__pad.buttons[i]={pressed:false,value:0}},i);await w(260)};
 await p.goto(BASE+'/?demo=ddtracks',{waitUntil:'load',timeout:90000});
 ok(await p.waitForSelector('#ddTracks .card canvas',{visible:true,timeout:60000}).then(()=>true,()=>false),nm+': cold start (?demo=ddtracks) opens the track select');
 ok(await E(()=>!localStorage.getItem('dw_tracks_v1')),nm+': fresh profile, no saved track progress');
 const g=await E(()=>{const c=[...document.querySelectorAll('#ddTracks .card')];return {n:c.length,cups:document.querySelectorAll('#dtCups .cp').length,lock:c.map(x=>x.dataset.locked),stars:c.every(x=>x.querySelector('.stars')),errs:c.map(x=>x.querySelector('.errs').textContent),best:c[0].querySelector('.best').textContent,sim:/SIM/.test(document.getElementById('ddTracks').textContent),live:/LIVE/.test(document.getElementById('ddTracks').textContent)}});
 ok(g.n==3&&g.cups==3,nm+': 3 cups, 3 track cards in Rookie');ok(g.lock.join()=='false,true,true',nm+': only the first Rookie track is unlocked '+g.lock);ok(g.stars&&g.best.includes('Best'),nm+': cards show stars and best');
 ok(/Formation walk/.test(g.errs[1])&&/Survey noise/.test(g.errs[2]),nm+': cards list the error set');ok(g.sim&&!g.live,nm+': labelled SIM, never LIVE');
 const px=async()=>E(()=>{const c=document.querySelector('#ddTracks .card.sel canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i+=16)s=(s*31+d[i]+d[i+2])%1e9;return s});
 const h0=await px();await w(500);ok(h0!=await px(),nm+': selected card 3D path preview rotates');
 const sb=await E(()=>{const r=document.getElementById('dtStart').getBoundingClientRect();return r.width>=120&&r.height>=44&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id=='dtStart'});ok(sb,nm+': big START visible and on top');
 await p.screenshot({path:SH+nm+'_0_grid.png'});
 // keyboard
 await key('ArrowRight');ok((await S()).ti==1,nm+': keyboard Right moves to track 2');ok(await E(()=>document.getElementById('dtStart').disabled),nm+': START disabled on a locked track');
 await key('Enter');ok((await S()).focus=='grid',nm+': Enter on a locked track does not pick');await p.screenshot({path:SH+nm+'_1_locked.png'});
 await key('ArrowDown');await w(300);ok((await S()).cup==1,nm+': keyboard Down goes to Pro Cup');ok(await E(()=>[...document.querySelectorAll('#ddTracks .card')].every(c=>c.dataset.locked=='true')),nm+': Pro Cup tracks are locked');
 await key('ArrowUp');await w(300);await key('ArrowLeft');ok((await S()).cup==0&&(await S()).ti==0,nm+': Up + Left back to Rookie track 1');
 // gamepad (no 8 / 9)
 await btn(15);{const q=await S();ok(q.ti==1,nm+': gamepad D-pad right '+JSON.stringify(q))};await btn(14);ok((await S()).ti==0,nm+': gamepad D-pad left');await btn(13);await w(300);ok((await S()).cup==1,nm+': gamepad D-pad down -> next cup');await btn(12);await w(300);ok((await S()).cup==0,nm+': gamepad D-pad up');
 await btn(0);ok((await S()).focus=='start',nm+': gamepad A picks the track (focus START)');await btn(1);ok((await S()).focus=='grid'&&await E(()=>!!document.getElementById('ddTracks')),nm+': gamepad B goes back to the grid');
 ok(await E(()=>!document.getElementById('start')),nm+': no Home triggered by track select input');
 // swipe
 const sw=async(dx,dy)=>{const cx=vp.width/2,cy=Math.round(vp.height*0.4);if(vp.hasTouch){const s=await p.createCDPSession();await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy}]});for(const f of [.3,.6,1])await s.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+dx*f,y:cy+dy*f}]});await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}else{await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx+dx,cy+dy,{steps:4});await p.mouse.up()}await w(400)};
 await sw(-150,0);ok((await S()).ti==1,nm+': swipe left -> next track '+JSON.stringify(await S()));await sw(150,0);ok((await S()).ti==0,nm+': swipe right -> previous track');await sw(0,-150);await w(250);ok((await S()).cup==1,nm+': swipe up -> next cup');await sw(0,150);await w(250);ok((await S()).cup==0,nm+': swipe down -> previous cup');
 // mute
 await key('m');ok(await E(()=>GX.ddtracks.muted&&localStorage.getItem('dw_tracks_mute')=='1'),nm+': M mutes (saved)');await key('m');ok(await E(()=>!GX.ddtracks.muted),nm+': M unmutes');
 // pick + START with keyboard
 await key('Enter');ok((await S()).focus=='start',nm+': Enter picks track 1');await p.keyboard.press('Enter');await w(120);const fxOn=await E(()=>getComputedStyle(document.getElementById('dtFx')).display=='flex');await p.screenshot({path:SH+nm+'_2_transition.png'});
 ok(fxOn,nm+': START plays the countdown transition');
 ok(await p.waitForFunction(()=>GX.ddrun?.run?.track=='r1'&&GX.ddrun.run.running&&!document.getElementById('ddTracks'),{timeout:30000}).then(()=>true,()=>false),nm+': run starts in the cabin with track r1');
 const rr=await E(()=>{const r=GX.ddrun.run,t=GX.ddtracks.TRACKS[0];return {td:r.td,ttd:t.td,same:r.plan.length==t.plan.length&&Math.abs(r.plan.at(-1).tvd-t.plan.at(-1).tvd)<1e-6,errs:[r.E.walkAzi,r.E.bitWalk,r.E.svAzi,r.E.sag],diff:r.diff,src:r.planSrc,cab:document.getElementById('ddc').style.display!='none',txt:document.getElementById('drPlan').textContent}});
 ok(rr.same&&rr.td==rr.ttd&&/Track First Build/.test(rr.txt),nm+': run uses the track plan ('+rr.txt+')');ok(rr.errs.every(x=>x==0)&&rr.diff=='easy',nm+': run uses the track error set (r1: none) and difficulty');ok(rr.cab,nm+': cabin is open');
 ok(await E(()=>!!document.getElementById('drTracks')),nm+': cabin run bar has a Tracks button');
 // force-complete with good steering
 const fin=await E(()=>{const D=GX.ddrun,r=D.run;D.pause();let k=0;while(!r.done&&k++<200){D.applyRec(r);D.drill(r,30)}D.ui();return {done:r.done,sc:D.score(r).score}});ok(fin.done,nm+': track run force-completed at TD (score '+fin.sc+')');
 ok(await p.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('dw_tracks_v1')||'{}');return s.best?.r1},{timeout:5000}).then(()=>true,()=>false),nm+': best score saved');
 const bs=await E(()=>JSON.parse(localStorage.getItem('dw_tracks_v1')).best.r1);ok(bs.score==fin.sc&&bs.hours>0,nm+': best = '+bs.score+'/100, '+bs.hours+' h');
 ok(await E(()=>!document.getElementById('dtToast').hidden&&/unlocked/.test(document.getElementById('dtToast').textContent)),nm+': toast says the next track is unlocked');
 await p.click('#drTracks');await p.waitForSelector('#ddTracks .card');await w(400);
 const after=await E(()=>[...document.querySelectorAll('#ddTracks .card')].map(c=>c.dataset.locked+'|'+c.querySelector('.best').textContent));ok(after[1].startsWith('false')&&after[2].startsWith('true')&&/Best \d+/.test(after[0]),nm+': track 2 unlocked, track 3 still locked, best shown '+after.join(' ; '));
 // second track via gamepad, error set check
 await btn(15);await btn(0);await btn(0);ok(await p.waitForFunction(()=>GX.ddrun?.run?.track=='r2'&&GX.ddrun.run.running,{timeout:30000}).then(()=>true,()=>false),nm+': gamepad A, A starts track r2');
 ok(await E(()=>{const e=GX.ddrun.run.E;return e.walkAzi!=0&&e.bitWalk==0&&e.svAzi==0&&e.yieldSd==0}),nm+': r2 run has formation walk only');
 await E(()=>GX.ddrun.pause());await p.reload({waitUntil:'load'});await w(500);await p.goto(BASE+'/?demo=ddtracks',{waitUntil:'load'});await p.waitForSelector('#ddTracks .card');await w(400);
 ok(await E(()=>document.querySelectorAll('#ddTracks .card')[1].dataset.locked=='false'),nm+': unlock persists after reload');
 if(nm=='phone')ok(await E(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no horizontal page overflow');
 await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,5).join(' | '));ok(!bad.length,'no WITSML/Adaga requests '+bad.slice(0,3).join(' '));
console.log(`\nddtracks ${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0);
