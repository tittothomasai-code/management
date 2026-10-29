// v5.7.1 test: two players on a TEST session via RPCs only (SIM). No Adaga/WITSML network.
import puppeteer from 'puppeteer-core';const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/106_rpc_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[],rest=[];
async function pg(name){const ctx=await b.createBrowserContext();const p=await ctx.newPage();p.on('pageerror',e=>errs.push(name+': '+e.message));await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(/adaga|witsml|:8796|:8799/i.test(u)){bad.push(u);r.abort();return}if(/\/rest\/v1\//.test(u))rest.push(u.replace(/^.*\/rest\/v1\//,''));r.continue()});
 await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});await p.goto(BASE+(name=='Carol'?'/index.html?join&t=':'/index.html?player='+name+'&t=')+Date.now(),{timeout:90000});await p.waitForFunction(()=>window.GX&&GX.session&&GX.chat,{timeout:60000});await w(1000);return p}
const A=await pg('TESTAlice');const ver=await A.evaluate(()=>document.getElementById('appVer').innerText);ok(/v5\.7\.1/.test(ver),'version '+ver);
const code=await A.evaluate(()=>GX.session.create('TEST v571'));ok(/^[A-Z0-9]{4,8}$/.test(code),'TEST session created '+code);
const B=await pg('TESTBob');await B.evaluate(c=>GX.session.join(c),code);
for(const p of [A,B])await p.evaluate(()=>{document.getElementById('uiTab_crew').click();GX.session.open(true)});
await A.evaluate(()=>GX.chat.send('hello from Alice (TEST)'));await B.evaluate(()=>GX.chat.send('hi Alice, Bob here (TEST)'));await w(6500);
const ta=await A.evaluate(()=>document.getElementById('chatList').innerText),tb=await B.evaluate(()=>document.getElementById('chatList').innerText);
ok(/Bob here/.test(ta)&&/hello from Alice/.test(ta),'Alice sees both messages');ok(/hello from Alice/.test(tb)&&/Bob here/.test(tb),'Bob sees both messages');
ok((ta.match(/Bob here/g)||[]).length==1&&(tb.match(/hello from Alice/g)||[]).length==1,'no duplicates (poll + broadcast de-duplicated by id)');
const pl=await A.evaluate(()=>document.getElementById('sessPlayers').innerText);ok(/TESTAlice/.test(pl)&&/TESTBob/.test(pl),'players via get_players: '+pl.replace(/\n/g,', '));
const bad2=rest.filter(u=>!/^rpc\//.test(u));ok(bad2.length==0,'no direct table reads ('+[...new Set(rest)].join(' ')+')');
const st=await A.evaluate(()=>GX.session.rpc('messages?select=*',{}).then(()=> 'open',e=>'blocked'));
await A.screenshot({path:SH+'2_chat_alice.png'});await B.screenshot({path:SH+'2b_chat_bob.png'});
const r=await A.evaluate(()=>GX.player.sync.push('score',{well:'SIM well',score:87,joints:12}).then(()=>'ok',e=>e.message));await w(1500);await A.evaluate(()=>GX.session.refresh());await w(800);
const lb=await A.evaluate(()=>document.getElementById('sessBoard').innerText);ok(/TESTAlice/.test(lb)&&/87/.test(lb),'leaderboard via get_leaderboard ('+r+'): '+lb.replace(/\s+/g,' '));await A.screenshot({path:SH+'3_leaderboard.png'});
await A.close();await B.close();const C=await pg('Carol');await C.evaluate(()=>{const s=document.getElementById('plName');s.value='TESTCarol'});await C.screenshot({path:SH+'1_join.png'});
ok(bad.length==0,'no Adaga/WITSML calls');ok(errs.length==0,'no page errors '+errs.join(';'));console.log('CODE='+code);console.log(fails?'FAILS '+fails:'ALL PASS');await b.close();process.exit(fails?1:0)
