// v5.9.2 hotfix test (CTO recording): 1 own chat message not doubled; 2 joiner strip leaves 'Connecting…' when joining with the code box focused;
// 3 desktop left nav no longer covers Sequence player / Survey table (MD column visible); 4 exploded view toggles off; 5 anti-collision shows progress and yields.
// Supabase RPCs MOCKED in-browser (no real Supabase writes), no Adaga/WITSML. SIM only.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'120_v592_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const DB={sessions:{SIM777:{players:[]}},msgs:[],id:0};
function rpcMock(fn,a){if(fn=='join_lobby'){a.p_code='MAIN00';DB.sessions.MAIN00=DB.sessions.MAIN00||{players:[]}}if(fn=='create_session'){const c='SIM'+(100+Object.keys(DB.sessions).length);DB.sessions[c]={players:[{player_name:a.p_host}]};return c}
 const s=DB.sessions[a.p_code];if(!s)throw 404;if(fn=='join_lobby'){s.players.push({player_name:a.p_name});return 'MAIN00'}
 if(fn=='join_session'){if(!s.players.find(p=>p.player_name==a.p_name))s.players.push({player_name:a.p_name});return true}
 if(fn=='get_players')return s.players;if(fn=='get_leaderboard')return [];
 if(fn=='post_message'){const m={id:++DB.id,code:a.p_code,author_kind:'player',player_name:a.p_name,body:a.p_body,created_at:new Date().toISOString()};DB.msgs.push(m);return {__delay:2700,v:m.id}}// slow insert response, row already pollable
 if(fn=='get_messages')return DB.msgs.filter(m=>m.code==a.p_code&&m.id>a.p_since_id);return null}
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
async function pg(name,url,vp){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp||{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});p.on('pageerror',e=>/WebGL/.test(e.message)||errs.push(name+': '+e.message));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});
 await p.setRequestInterception(true);p.on('request',async r=>{const u=r.url();const m=u.match(/supabase\.co\/rest\/v1\/rpc\/(\w+)/);
  if(m){if(r.method()=='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   let v,st=200;try{v=rpcMock(m[1],JSON.parse(r.postData()||'{}'));if(v&&v.__delay){await w(v.__delay);v=v.v}}catch(e){st=404;v={message:'no session'}}return r.respond({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(v)})}
  if(/supabase|adaga|witsml|:8796|:8799/i.test(u)){bad.push(u);return r.abort()}r.continue()});
 await p.goto(url,{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.session&&window.GX?.chat,{timeout:120000});return p}
// 1 + 2: phone, no auto-join under webdriver -> strip says Connecting…; join by typing in the focused code box + Enter
const A=await pg('A',BASE+'/?nosplash=1&player=SIM%20Tester');await A.evaluate(()=>document.getElementById('uiTab_crew')?.click());await w(800);
ok(await A.evaluate(()=>/Connecting to the MAIN lobby/.test(document.getElementById('sessStrip')?.textContent||'')),'before join: strip shows Connecting… (no session)');
await A.focus('#sessJoinIn');await A.keyboard.type('sim777');await A.keyboard.press('Enter');await A.waitForFunction(()=>GX.session.S.code=='SIM777',{timeout:15000}).catch(()=>{});await w(600);
// keep the box focused (as on the recording), then let a render happen
await A.focus('#sessJoinIn');await A.evaluate(()=>GX.session.refresh());await w(400);
let st=await A.evaluate(()=>({t:document.getElementById('sessStrip').textContent,code:document.getElementById('sessCodeBig')?.textContent}));
ok(st.code=='SIM777'&&!/Connecting to the MAIN lobby/.test(st.t),'2: after joining with the code box focused the strip shows session SIM777, not Connecting… ('+st.t.slice(0,60)+')');
await A.screenshot({path:SH+'2_joined_strip.png'});
await A.evaluate(()=>{const i=document.getElementById('chatIn');i.value='dupe check (SIM) 1';document.getElementById('chatForm').requestSubmit()});await w(6500);
const cnt=await A.evaluate(()=>(document.getElementById('chatList').textContent.match(/dupe check \(SIM\) 1/g)||[]).length);
ok(cnt==1,'1: own message shown once after polls (slow post_message response): '+cnt+'×');
await A.evaluate(()=>{const i=document.getElementById('chatIn');i.value='dupe check (SIM) 2';document.getElementById('chatForm').requestSubmit()});await w(6000);
ok(await A.evaluate(()=>(document.getElementById('chatList').textContent.match(/dupe check \(SIM\) 2/g)||[]).length)==1,'1: second message also shown once');
DB.msgs.push({id:++DB.id,code:'SIM777',author_kind:'player',player_name:'SIM Other',body:'dupe check (SIM) 1',created_at:new Date().toISOString()});await w(3500);
ok(await A.evaluate(()=>(document.getElementById('chatList').textContent.match(/dupe check \(SIM\) 1/g)||[]).length)==2,"1: another player's identical text is still shown");
await A.screenshot({path:SH+'1_chat_once.png'});
// 3 + 4 + 5: desktop
const D=await pg('D',BASE+'/?nosplash=1',{width:1440,height:900});await w(1500);
const navR=await D.evaluate(()=>document.getElementById('uiNav').getBoundingClientRect().right);
await D.evaluate(()=>{document.getElementById('seqpanel').style.display='block';document.getElementById('btnSur').click()});await w(900);
const ov=await D.evaluate(()=>['seqpanel','geoSur'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),th=[...e.querySelectorAll('th')].find(t=>/^MD/.test(t.textContent.trim()));return {id,l:Math.round(r.left),th:th?Math.round(th.getBoundingClientRect().left):null}}));
ok(ov.every(o=>o.l>=navR&&(o.th==null||o.th>=navR)),`3: Sequence player + Survey table start right of the ${navR}px nav, MD column visible ${JSON.stringify(ov)}`);
const hit=await D.evaluate(()=>{const out=[];for(const id of ['seqpanel','geoSur']){const r=document.getElementById(id).getBoundingClientRect();const e=document.elementFromPoint(r.left+12,r.top+30);out.push(!!e&&!document.getElementById('uiNav').contains(e))}return out});
ok(hit.every(Boolean),'3: nav no longer sits on top of the panel left edges');await D.screenshot({path:SH+'3_desk_panels.png'});
await D.evaluate(()=>{for(const id of ['seqpanel','geoSur'])document.getElementById(id).style.display='none'});
// 4 exploded view
const tools=async()=>{await D.click('#uiTab_tools');await w(400)};
await tools();await D.click('#btnExpl');await w(800);ok(await D.evaluate(()=>{const r=document.getElementById('wsExp').getBoundingClientRect(),e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e&&document.getElementById('wsExp').contains(e)}),'3/4: workshop toolbar (🔩 Exploded tab) is not under the left nav');ok(await D.evaluate(()=>getComputedStyle(document.getElementById('wshop')).display!='none'),'4: Exploded view opens');
await w(1200);await D.screenshot({path:SH+'4_exploded.png'});
let lab=await D.evaluate(()=>[GX.ws.ST.target,document.getElementById('wsGo').textContent]);await D.click('#wsGo');await w(1200);
let lab2=await D.evaluate(()=>[GX.ws.ST.target,document.getElementById('wsGo').textContent]);
ok(lab[0]==1&&/Collapse/.test(lab[1])&&lab2[0]==0&&/Explode/.test(lab2[1]),'4: exploded button toggles the explosion off '+JSON.stringify([lab,lab2]));
await D.click('#wsGo');await w(600);ok(await D.evaluate(()=>GX.ws.ST.target)==1,'4: and back on');const wx=await D.evaluate(()=>{const r=document.getElementById('wsExp').getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return [e?.tagName,e?.textContent.slice(0,30),e?.parentElement?.id,e?.closest('[id]')?.id,JSON.stringify(r)]});console.log('  wsExp hit:',wx);await D.click('#wsExp');await w(600);ok(await D.evaluate(()=>GX.ws.ST.target)==0,'4: clicking the active 🔩 Exploded tab toggles it off');
await tools();await D.click('#btnExpl');await w(500);ok(await D.evaluate(()=>getComputedStyle(document.getElementById('wshop')).display=='none'),'4: Tools → Exploded view again toggles the workshop off');
// 5 anti-collision progress
await A.close();await D.evaluate(()=>{GX.wplan.open('plan')});await w(500);
const r5=await D.evaluate(async()=>{const M=await import('./wac.js?v=592');const W=GX.wplan.W;const seen=new Set();const mo=new MutationObserver(()=>{const b=document.getElementById('acBar');if(b)seen.add(b.style.width)});mo.observe(document.getElementById('wp'),{subtree:true,attributes:true,childList:true});
 const t0=performance.now();document.querySelector('#wp [data-v=ac]').click();const sawBar=!!document.getElementById('acBar');await new Promise(r=>{const f=()=>document.getElementById('acTC')?r():setTimeout(f,20);f()});mo.disconnect();
 // force a fresh chunked run and check it yields to the event loop between chunks
 const A0=await M.computeAsync(W);A0.M.alert=A0.M.alert+1e-9;const prog=[];let ticks=0,run=true;(function t(){if(run){ticks++;setTimeout(t,0)}})();const r=await M.computeAsync(W,(f)=>prog.push(f));run=false;
 const one=M.report(r.ref,r.wells,r.M);return {sawBar,bar:[...seen],ms:performance.now()-t0,steps:prog.length,ticks,mono:prog.every((x,i)=>!i||x>=prog[i-1]),last:prog.at(-1),eq:one.length>0&&JSON.stringify(one)==JSON.stringify(r.rep)}});
ok(r5.sawBar&&r5.bar.includes('100%'),'5: progress bar shown on opening Anti-collision '+JSON.stringify(r5.bar.slice(0,5)));
ok(r5.steps>=5&&r5.mono&&r5.last==1,'5: chunked compute reports progress ('+r5.steps+' steps, ends at 100%)');ok(r5.ticks>=r5.steps-2,'5: work yields to the event loop between chunks ('+r5.ticks+' timer ticks ran during compute)');
ok(r5.eq,'5: chunked result identical to the one-shot calculation');
await D.screenshot({path:SH+'5_ac_done.png'});
const t0=await D.evaluate(async()=>{const t=performance.now();document.querySelector('#wp [data-v=plan]').click();await new Promise(r=>setTimeout(r,200));document.querySelector('#wp [data-v=ac]').click();await new Promise(r=>{const f=()=>document.getElementById('acTC')?r():setTimeout(f,20);f()});return performance.now()-t});
ok(t0<3000,'5: reopening Anti-collision uses the cached result ('+t0.toFixed(0)+' ms)');
ok(!errs.length,'no page errors '+errs.join('|'));ok(!bad.length,'no real Supabase/Adaga/WITSML requests '+bad.slice(0,2).join(' '));
await b.close();console.log(`\n${pass} pass, ${fails} fail`);process.exit(fails?1:0)
