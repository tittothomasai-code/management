// srstart_desk_test.mjs: desk e2e (v5.12.2.1 one showroom): no A|B|C picker on the start screen; one Showroom tile;
// tile rig count = all rigs in the single showroom (C main + B rigs + A rigs); tile opens it for saved A, B or C.
import puppeteer from '/workspace/drill-sim/v3-game/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const URL=(process.argv[2]||'http://localhost:8955/').replace(/\/$/,''),SHOT=process.argv[3]||'shots_live/184_start_desk.png';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader']});let fail=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
try{const p=await b.newPage();await p.setViewport({width:1440,height:900});const errs=[];p.on('pageerror',e=>errs.push(e.message));
for(const ab of ['B','C','A']){
await p.goto(URL+'/?start=1',{waitUntil:'load',timeout:180000});await p.evaluate(v=>localStorage.setItem('dw_showroom_ab',v),ab);await p.reload({waitUntil:'load',timeout:180000});
await p.waitForSelector('#st_showroom',{visible:true,timeout:180000});await p.waitForFunction(()=>document.getElementById('st_rigN')?.dataset.src,{timeout:180000}).catch(()=>{});await new Promise(r=>setTimeout(r,1500));
const r=await p.evaluate(()=>({pick:!!document.getElementById('srabStart'),n:+document.getElementById('st_rigN')?.textContent,src:document.getElementById('st_rigN')?.dataset.src}));
const want=await p.evaluate(async()=>1+(await import('./showroom.js?v=b17')).RIGS.length+(await (await import('./showroomb.js?v=b6')).manifest()).rigs.length);
ck(!r.pick,`${ab}: no showroom picker on start`);ck(r.n===want&&r.src=='C',`${ab}: tile count ${r.n} == ${want} (one showroom)`);
if(ab=='B')await p.screenshot({path:SHOT});
await p.click('#st_showroom');await p.waitForFunction(()=>window.GX?.showroomC?.ST?.open,{timeout:180000}).catch(()=>{});ck(await p.evaluate(()=>!!document.getElementById('showroomC')&&!document.getElementById('showroomB')&&!document.getElementById('showroom')),`${ab}: Showroom tile opens the single showroom`)}
ck(!errs.length,'no page errors '+errs.slice(0,2).join(' | '))}catch(e){ck(0,'exception '+e.message)}
await b.close();console.log(fail?'FAILED '+fail:'ALL PASS');process.exit(fail?1:0)
