// safety_test (feat/safety-world): Safety World e2e on desktop + phone. SIM tags on every scenario, CA mission flow
// (wrong control rejected, close -> green, score up), hazard hunt scoring + leaderboard, keyboard + gamepad, start tile,
// adapter tenant scoping (ORG only for own tenant, SIM fallback). usage: node safety_test.mjs http://localhost:8809
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8809').replace(/\/$/,''),SH='shots_live/190_safety_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const PHONE={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},DESK={width:1440,height:900};
async function open(vp,q='/?nosplash&demo=safety'){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);
 await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())?r.abort():r.continue());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 for(let i=0;i<3;i++){try{await p.goto(BASE+q,{waitUntil:'domcontentloaded',timeout:120000});break}catch(e){if(i==2)throw e;await w(3000)}}
 return {p,ctx,errs}}
const ready=p=>p.waitForFunction(()=>window.GX?.safety?.isOpen()&&document.querySelector('#safetyW .pn button'),{timeout:120000});
const txt=p=>p.evaluate(()=>document.querySelector('#safetyW .pn').innerText);
for(const [vp,nm] of [[DESK,'desk'],[PHONE,'phone']]){const {p,ctx,errs}=await open(vp);await ready(p);await w(1500);
 const t=await p.evaluate(()=>{const B=[...document.querySelectorAll('#safetyW .pn button')].filter(b=>/^(ca|hunt):/.test(b.dataset.go));return {n:B.length,tags:B.map(b=>b.querySelector('.tag')?.textContent),live:/\bLIVE\b|\bHSE\b/.test(document.getElementById('safetyW').innerText),marks:GX.safety.S.marks.length,score:document.getElementById('swScore').textContent,
  vis:[...document.querySelectorAll('#safetyW .pn,#swScore,#swX')].every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0})}});
 ok(t.n==7&&t.tags.every(x=>x=='SIM'),`${nm}: 4 missions + 3 hunts, every one tagged SIM (${t.tags})`);ok(!t.live,`${nm}: no LIVE or HSE text`);ok(t.marks==4,`${nm}: 4 CA markers on 3D rig (${t.marks})`);ok(t.vis,`${nm}: panel, score and close on screen`);
 const col=await p.evaluate(()=>GX.safety.S.marks.map(m=>m.material.color.getHex()));ok(col.filter(c=>c==0xe03030).length==2,`${nm}: overdue actions show red markers`);
 await p.screenshot({path:SH+nm+'_menu.png'});const s0=await p.evaluate(()=>GX.safety.score());
 await p.click('#safetyW button[data-go="ca:ca-sim-01"]');await w(400);ok(/Step 1 of 4/.test(await txt(p)),`${nm}: mission opens at step 1`);
 await p.click('#safetyW button[data-go="inspect"]');await w(200);await p.click('#safetyW button[data-go="ctl:ppe"]');await w(200);
 ok(/does not remove this hazard/.test(await txt(p)),`${nm}: wrong control is rejected`);
 await p.click('#safetyW button[data-go="ctl:guard"]');await w(200);await p.click('#safetyW button[data-go="verify"]');await w(200);await p.click('#safetyW button[data-go="close"]');await w(300);
 ok(/Action closed/.test(await txt(p)),`${nm}: inspect, control, verify, close completes the mission`);await p.screenshot({path:SH+nm+'_mission.png'});
 await p.click('#safetyW button[data-go="back"]');await w(400);const s1=await p.evaluate(()=>({s:GX.safety.score(),g:GX.safety.S.marks.map(m=>m.material.color.getHex()).filter(c=>c==0x2fbf5a).length}));
 ok(s1.s>s0&&s1.g==1,`${nm}: score up ${s0}→${s1.s}, closed marker green`);
 await p.click('#safetyW button[data-go="hunt:hh-sim-med"]');await w(500);const h=await p.evaluate(()=>{const H=GX.safety.S.hunt;return {n:H.spots.length,hz:H.spots.map((s,i)=>s.h?i:-1).filter(i=>i>=0),dec:H.spots.findIndex(s=>!s.h),m:GX.safety.S.marks.length}});
 ok(h.hz.length==5&&h.n==7&&h.m==7,`${nm}: medium hunt has 5 hazards + 2 decoys as 3D spots`);
 await p.click(`#safetyW button[data-go="spot:${h.dec}"]`);await w(200);ok(/No hazard/.test(await txt(p)),`${nm}: wrong spot costs points`);
 // click one hazard spot on the 3D canvas (raycast)
 const sc=await p.evaluate(i=>{const S=GX.safety.S,v=S.marks[i].position.clone().project(S.cam);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}},h.hz[0]);
 const covered=await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName!='CANVAS',sc);
 if(!covered){await p.mouse.click(sc.x,sc.y);await w(300)}else await p.click(`#safetyW button[data-go="spot:${h.hz[0]}"]`);
 ok(await p.evaluate(i=>GX.safety.S.hunt?.found.has(i),h.hz[0]),`${nm}: hazard found (${covered?'list':'3D click'})`);await p.screenshot({path:SH+nm+'_hunt.png'});
 for(const i of h.hz.slice(1)){await p.click(`#safetyW button[data-go="spot:${i}"]`);await w(150)}await w(300);
 const r=await p.evaluate(()=>({t:document.getElementById('swResult')?.textContent,lb:JSON.parse(localStorage.getItem('dw_safety_lb')||'[]')}));
 ok(/Found 5\/5/.test(r.t||'')&&r.lb.length==1&&r.lb[0].crew=='Crew A'&&r.lb[0].source=='SIM',`${nm}: result + crew leaderboard entry (${r.t})`);await p.screenshot({path:SH+nm+'_result.png'});
 await p.keyboard.press('Escape');await w(300);ok(await p.evaluate(()=>/Hazard hunts/.test(document.querySelector('#safetyW .pn').innerText)),`${nm}: Esc goes back to menu`);
 await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await w(400);ok(/Step|Closed|of 4/.test(await txt(p)),`${nm}: keyboard ArrowDown + Enter opens a mission`);
 // gamepad: B back, A select
 await p.evaluate(()=>{window.__gp={index:0,buttons:Array(17).fill(0).map(()=>({pressed:false})),axes:[0,0,0,0]};navigator.getGamepads=()=>[window.__gp]});
 const press=async b=>{await p.evaluate(b=>__gp.buttons[b].pressed=true,b);await w(160);await p.evaluate(b=>__gp.buttons[b].pressed=false,b);await w(160)};
 await press(1);ok(await p.evaluate(()=>/Hazard hunts/.test(document.querySelector('#safetyW .pn').innerText)),`${nm}: gamepad B goes back`);
 await press(13);await press(0);ok(/of 4/.test(await txt(p)),`${nm}: gamepad d-pad + A opens a mission`);
 await press(1);await press(1);ok(await p.evaluate(()=>!GX.safety.isOpen()),`${nm}: B on menu closes Safety World`);
 ok(errs.length==0,`${nm}: no page errors ${errs.slice(0,2)}`);await ctx.close()}
// start tile
{const {p,ctx}=await open(PHONE,'/?start=1');await p.waitForSelector('#start .tile[data-go=safety]',{timeout:120000});await w(800);
 const v=await p.evaluate(()=>{const r=document.querySelector('#start .tile[data-go=safety]').getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0&&/SIM/.test(document.querySelector('#start .tile[data-go=safety]').innerText)});ok(v,'phone: Safety World tile on start screen, on screen, says SIM');
 await p.click('#start .tile[data-go=safety]');await ready(p);ok(true,'start tile opens Safety World');await ctx.close()}
// adapter scoping
{const {p,ctx}=await open(DESK);await ready(p);const r=await p.evaluate(async()=>{const A=GX.safety.adapter;const un=A.register({id:'orgA',source:'ORG',tenantId:'org-a',listMissions:async()=>[{id:'a1',title:'A mission',area:'floor',control:'ppe',due:1,steps:[],text:'x',tenantId:'org-b'}],listHunts:async()=>[]});
  const none=await A.getScenarios({tenantId:null}),b=await A.getScenarios({tenantId:'org-b'}),a=await A.getScenarios({tenantId:'org-a'});let bad=false;try{A.register({id:'z',source:'ORG'})}catch(e){bad=true}
  const stub=A.orgAdapterStub('org-c');const u2=A.register(stub);const c=await A.getScenarios({tenantId:'org-c'});un();u2();
  return {none:none.missions.map(m=>m.source).join(),b:b.missions.map(m=>m.source).join(),a:a.missions.map(m=>m.source+':'+m.tenantId).join(),bad,c:c.missions.map(m=>m.source).join()}});
 ok(r.none=='SIM,SIM,SIM,SIM','no login → SIM only');ok(r.b=='SIM,SIM,SIM,SIM','other tenant never sees org-a ORG data');ok(r.a=='ORG:org-a','own tenant sees ORG, tenant forced to adapter tenant ('+r.a+')');
 ok(r.bad,'ORG adapter without tenantId is refused');ok(r.c=='SIM,SIM,SIM,SIM','stub org with no data → SIM fallback');
 await p.evaluate(async()=>{GX.safety.close();const un=GX.safety.adapter.register({id:'demo',source:'ORG',tenantId:'demo-org',listMissions:async()=>[{id:'d1',title:'Demo ORG action (test only)',area:'floor',control:'ppe',due:2,text:'Test record.'}],listHunts:async()=>[]});await GX.safety.open({tenantId:'demo-org'});un()});await w(800);
 ok(await p.evaluate(()=>document.querySelector('#safetyW .tag.ORG')?.textContent=='ORG'),'ORG scenario shows ORG tag');await p.screenshot({path:SH+'desk_org_tag.png'});await ctx.close()}
console.log(`safety: ${pass} pass, ${fail} fail`);await br.close();process.exit(fail?1:0)
