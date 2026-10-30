// v5.8 invite-link test: 2 headless players; Supabase RPCs MOCKED in-browser (no Supabase writes, no Adaga/WITSML). SIM only.
import puppeteer from 'puppeteer-core';const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/112_invite_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const DB={sessions:{},msgs:[],id:0};
function rpcMock(fn,a){if(fn=='create_session'){const c='SIM'+(100+Object.keys(DB.sessions).length);DB.sessions[c]={players:[{player_name:a.p_host}]};return c}
 const s=DB.sessions[a.p_code];if(!s)throw 404;
 if(fn=='join_session'){if(!s.players.find(p=>p.player_name==a.p_name))s.players.push({player_name:a.p_name});return true}
 if(fn=='get_players')return s.players;if(fn=='get_leaderboard')return [];
 if(fn=='post_message'){const m={id:++DB.id,code:a.p_code,author_kind:'player',player_name:a.p_name,body:a.p_body,created_at:new Date().toISOString()};DB.msgs.push(m);return m.id}
 if(fn=='get_messages')return DB.msgs.filter(m=>m.code==a.p_code&&m.id>a.p_since_id);return null}
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
async function pg(name,url,share){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(name+': '+e.message));
 await p.evaluateOnNewDocument(sh=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}};window.__shared=[];if(sh)navigator.share=async d=>{window.__shared.push(d)};else{try{delete Navigator.prototype.share}catch(e){}Object.defineProperty(navigator,'share',{value:undefined});window.__clip=null;Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__clip=t}}})}},share);
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();const m=u.match(/supabase\.co\/rest\/v1\/rpc\/(\w+)/);
  if(m){if(r.method()=='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   let body,st=200;try{body=JSON.stringify(rpcMock(m[1],JSON.parse(r.postData()||'{}')))}catch(e){st=404;body='{"message":"no session"}'}return r.respond({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body})}
  if(/supabase|adaga|witsml|:8796|:8799/i.test(u)){bad.push(u);return r.abort()}r.continue()});
 await p.goto(url,{waitUntil:'load',timeout:90000});await p.waitForFunction(()=>window.GX?.session,{timeout:90000});return p}
// Player A: host creates session, opens Crew, taps Share (navigator.share path)
const A=await pg('A',BASE+'/?nosplash=1&player=SIM%20Host',true);const code=await A.evaluate(()=>GX.session.create('SIM invite test'));
await A.evaluate(()=>document.getElementById('uiTab_crew')?.click());await w(800);
ok(await A.evaluate(c=>document.getElementById('sessCodeBig')?.textContent==c&&!!document.getElementById('sessShare'),code),'Crew shows session code '+code+' + Share button');
await A.screenshot({path:SH+'1_host_crew.png'});await A.click('#sessShare');await w(300);
const sh=await A.evaluate(()=>window.__shared[0]);ok(sh?.url=='https://drilling.robotyx.systems/?s='+code,'navigator.share called with '+sh?.url);
// Player C: no navigator.share -> clipboard + toast
const C=await pg('C',BASE+'/?nosplash=1&player=SIM%20Watcher',false);await C.evaluate(c=>GX.session.join(c),code);await C.evaluate(()=>document.getElementById('uiTab_crew')?.click());await w(500);await C.click('#sessShare');await w(300);
ok(await C.evaluate(c=>window.__clip=='https://drilling.robotyx.systems/?s='+c&&/copied/.test(document.getElementById('sessToast')?.textContent||''),code),'fallback: link copied to clipboard + toast');await C.screenshot({path:SH+'2_copied_toast.png'});
// Player B: brand-new device opens the invite link (no saved name) -> join screen shows prefilled code -> enters name -> auto-joins
const B=await pg('B',BASE+'/?nosplash=1&join=1&s='+code.toLowerCase(),true);await B.waitForSelector('#plJoin #plCode',{timeout:20000}).catch(()=>{});
ok(await B.evaluate(c=>document.getElementById('plCode')?.value==c,code),'invite link prefills code on join screen');await B.screenshot({path:SH+'3_guest_join_screen.png'});
await B.type('#plName','SIM Guest');await B.click('#plJoin button[type=submit]');await B.waitForFunction(c=>GX.session.S.code==c,{timeout:15000},code).catch(()=>{});
ok(await B.evaluate(c=>GX.session.S.code==c,code),'guest auto-joined '+code+' after entering name');
await A.evaluate(()=>GX.session.refresh());await w(300);ok(await A.evaluate(()=>GX.session.S.players.map(p=>p.player_name).includes('SIM Guest')),'host sees SIM Guest in players');
await B.evaluate(()=>GX.chat?.transport?.send({text:'hello from guest (SIM)'}));await w(3500);
ok(await A.evaluate(()=>/hello from guest/.test(document.body.innerText)),'host received guest chat via polling');
await B.evaluate(()=>document.getElementById('uiTab_crew')?.click());await w(800);await B.screenshot({path:SH+'4_guest_crew.png'});
ok(!errs.length,'no page errors '+errs.join('|'));ok(!bad.length,'no real Supabase/Adaga/WITSML requests '+bad.slice(0,2).join(' '));
await b.close();console.log(`\n${pass} pass, ${fails} fail`);process.exit(fails?1:0)
