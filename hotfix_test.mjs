// v5.7.2 P0 hotfix test: REAL Supabase (drill_game), two browser contexts chatting both ways in MAIN and in a private code session. TEST/SIM names only.
import puppeteer from 'puppeteer-core';const BASE=process.argv[2]||'http://localhost:8790',SH='shots_live/114_hotfix_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const RUN=Date.now().toString(36).slice(-4);
async function pg(name,vp,q){const ctx=await br.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>console.log('pageerror',name,e.message));
 await p.goto(BASE+'/?nosplash=1&player='+encodeURIComponent(name)+q,{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.session,{timeout:120000});return p}
const crew=p=>p.evaluate(()=>{document.getElementById('uiTab_crew')?.click();if(!GX.chat.C.open)GX.chat.toggle()});
const say=(p,t)=>p.evaluate(t=>GX.chat.send(t),t);
const sees=(p,t)=>p.waitForFunction(t=>document.getElementById('chatList')?.textContent.includes(t),{timeout:15000},t).then(()=>true).catch(()=>false);
const G=await pg('TEST George '+RUN,{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2},'&lobby=1');
const T=await pg('TEST Titto '+RUN,{width:1440,height:900},'&lobby=1');
await G.waitForFunction(()=>GX.session.S.code,{timeout:20000});await T.waitForFunction(()=>GX.session.S.code,{timeout:20000});
ok(await G.evaluate(()=>GX.session.S.code)=='MAIN00'&&await T.evaluate(()=>GX.session.S.code)=='MAIN00','no code => both land in the same MAIN lobby');
await crew(G);await crew(T);await w(800);
ok(await G.evaluate(()=>document.getElementById('sessCodeBig')?.textContent=='MAIN'&&!!document.getElementById('sessShare')&&!!document.getElementById('sessJoinIn')),'Crew shows code MAIN + Share + Join by code (phone)');
await say(G,'TEST hi from George '+RUN);ok(await sees(T,'TEST hi from George '+RUN),'MAIN: Titto (desktop) sees George (phone)');
await say(T,'TEST hi from Titto '+RUN);ok(await sees(G,'TEST hi from Titto '+RUN),'MAIN: George sees Titto');
await G.evaluate(()=>GX.session.refresh());await w(800);
ok(await G.evaluate(r=>[...document.querySelectorAll('#sessWho .sessP')].map(e=>e.textContent).join('|').includes('TEST Titto '+r),RUN),'player list shows the other player');
await G.screenshot({path:SH+'1_phone_main.png'});await T.screenshot({path:SH+'2_desktop_main.png'});
// private code session: George creates, shares, Titto joins via ?s=CODE in a fresh page
const code=await G.evaluate(()=>GX.session.create('TEST hotfix '+Date.now()));ok(/^[A-Z0-9]{6}$/.test(code),'private session '+code);
await G.evaluateOnNewDocument(()=>{});await G.evaluate(()=>{window.__clip=null;Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__clip=t}},configurable:true})});
await w(500);await G.evaluate(()=>document.getElementById('sessShare').click());await w(400);ok(await G.evaluate(c=>window.__clip=='https://drilling.robotyx.systems/?s='+c,code),'Share copies https://drilling.robotyx.systems/?s='+code);
const T2=await (async()=>{await T.goto(BASE+'/?nosplash=1&player='+encodeURIComponent('TEST Titto '+RUN)+'&s='+code,{waitUntil:'load',timeout:120000});await T.waitForFunction(c=>GX.session?.S.code==c,{timeout:30000},code);return T})();
ok(true,'?s='+code+' auto-joined');await crew(T2);await w(600);
await say(T2,'TEST code msg Titto '+RUN);ok(await sees(G,'TEST code msg Titto '+RUN),'code session: George sees Titto');
await say(G,'TEST code msg George '+RUN);ok(await sees(T2,'TEST code msg George '+RUN),'code session: Titto sees George');
await G.screenshot({path:SH+'3_phone_code.png'});await T2.screenshot({path:SH+'4_desktop_code.png'});
// join by code field back to MAIN
await T2.evaluate(()=>{document.getElementById('sessJoinIn').value='main'});await T2.evaluate(()=>document.getElementById('sessJoinGo').click());await T2.waitForFunction(()=>GX.session.S.code=='MAIN00',{timeout:15000}).catch(()=>{});
ok(await T2.evaluate(()=>GX.session.S.code)=='MAIN00','Join by code "main" returns to the lobby');
console.log('RUN',RUN,'CODE',code);console.log(`\n${pass} passed, ${fails} failed`);await br.close();process.exit(fails?1:0)
