// srstart_desk_test.mjs: desk e2e (v5.12.1.2): start-screen showroom switch clear of the hint; rig tile count matches registered rigs.
import puppeteer from '/workspace/drill-sim/v3-game/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const URL=(process.argv[2]||'http://localhost:8955/').replace(/\/$/,''),SHOT=process.argv[3]||'shots_live/184_start_desk.png';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader']});let fail=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
try{const p=await b.newPage();await p.setViewport({width:1440,height:900});const errs=[];p.on('pageerror',e=>errs.push(e.message));
for(const ab of ['B','A']){
await p.goto(URL+'/?start=1',{waitUntil:'load',timeout:180000});await p.evaluate(v=>localStorage.setItem('dw_showroom_ab',v),ab);await p.reload({waitUntil:'load',timeout:180000});
await p.waitForSelector('#srabStart',{visible:true,timeout:180000});await p.waitForFunction(()=>document.getElementById('st_rigN')?.dataset.src,{timeout:180000}).catch(()=>{});
const r=await p.evaluate(()=>{const a=srabStart.getBoundingClientRect(),h=document.querySelector('#start .hint').getBoundingClientRect(),hit=a.left<h.right&&a.right>h.left&&a.top<h.bottom&&a.bottom>h.top;return {hit,a:[a.left,a.top,a.width,a.height].map(Math.round),h:[h.left,h.top,h.width,h.height].map(Math.round),n:+st_rigN.textContent,src:st_rigN.dataset.src,c:document.getElementById('srabSC')?.disabled}});
const want=await p.evaluate(async ab=>ab=='B'?(await (await import('./showroomb.js?v=b2')).manifest()).rigs.length:(await import('./showroom.js?v=b16')).RIGS.length,ab);
ck(!r.hit,`${ab}: switch ${r.a} clear of hint ${r.h}`);ck(r.n===want&&r.src==ab,`${ab}: tile count ${r.n} == registered ${want}`);ck(r.c,`${ab}: C disabled on start`);
if(ab=='B')await p.screenshot({path:SHOT})}
ck(!errs.length,'no page errors '+errs.slice(0,2).join(' | '))}catch(e){ck(0,'exception '+e.message)}
await b.close();console.log(fail?'FAILED '+fail:'ALL PASS');process.exit(fail?1:0)
