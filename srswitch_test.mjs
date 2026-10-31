// srswitch_test.mjs: phone e2e for the A|B|C header switch (v5.12.1.2). node srswitch_test.mjs [url] [shot]
import puppeteer from '/workspace/drill-sim/v3-game/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const URL=process.argv[2]||'http://localhost:8955/',SHOT=process.argv[3]||'shots_live/183_srswitch_phone';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader']});
let fail=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
try{const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(URL+(URL.includes('?')?'&':'?')+'nosplash',{waitUntil:'load',timeout:180000});
await p.waitForFunction(()=>window.GX?.showroomAB,{timeout:180000});
await p.evaluate(()=>localStorage.setItem('dw_showroom_ab','B'));await p.reload({waitUntil:'load',timeout:180000});
await p.waitForSelector('#btnShow',{timeout:180000});await p.evaluate(()=>btnShow.click());
await p.waitForSelector('#showroomB #srbTop .srabH',{visible:true,timeout:180000});
// overlap + visibility check for a given header
const lay=sel=>p.evaluate(sel=>{const h=document.querySelector(sel+' .srabH');if(!h)return {vis:0};const r=h.getBoundingClientRect(),vis=r.width>60&&r.height>24&&r.top>=0&&r.right<=innerWidth&&getComputedStyle(h).visibility!='hidden';
 const root=h.closest('#showroom,#showroomB,#showroomC'),bad=[];root.querySelectorAll('button,a,select,input,[role=button],#srbBanner,#srbTop .tt,#srTop>b').forEach(e=>{if(h.contains(e)||e.contains(h))return;const q=e.getBoundingClientRect();if(!q.width||!q.height||getComputedStyle(e).visibility=='hidden')return;if(q.left<r.right-1&&q.right>r.left+1&&q.top<r.bottom-1&&q.bottom>r.top+1)bad.push((e.id||e.className||e.tagName)+'')});
 const c=document.getElementById('srabHC');return {vis,bad,r:[r.left,r.top,r.width,r.height].map(Math.round),cDis:!!c?.disabled,cTxt:c?.textContent}},sel);
let L=await lay('#srbTop');ck(L.vis,'B header switch visible '+JSON.stringify(L.r));ck(!L.bad.length,'B switch no overlap '+L.bad);ck(!L.cDis&&!/soon/.test(L.cTxt),'C enabled, not soon ('+L.cTxt+')');
await p.screenshot({path:SHOT+'_B.png'});
ck(await p.evaluate(()=>!document.querySelector('#srabHA')&&[...document.querySelectorAll('.srabH')].every(h=>[...h.querySelectorAll('button[data-abh]')].map(b=>b.dataset.abh).join('')=='BC')),'headers are B | C only (no A)');
ck(await p.evaluate(()=>{const o=localStorage.getItem('dw_showroom_ab');localStorage.setItem('dw_showroom_ab','A');const g=GX.showroomAB.get();localStorage.setItem('dw_showroom_ab',o);return g=='C'}),'saved A -> C');
await p.tap('#srabHC');await p.waitForFunction(()=>document.getElementById('showroomC'),{timeout:180000}).catch(()=>{});
ck(await p.evaluate(()=>!!document.getElementById('showroomC')&&GX.showroomAB.get()=='C'),'tap C -> showroom C');
await p.waitForSelector('#srcTop .srabH',{visible:true,timeout:60000}).catch(()=>{});
L=await lay('#srcTop');ck(L.vis,'C header switch visible '+JSON.stringify(L.r));ck(!L.bad.length,'C switch no overlap '+L.bad);
ck(await p.evaluate(()=>document.querySelector('#srcTop #srabHC')?.classList.contains('on')),'C segment active in C header');
await new Promise(r=>setTimeout(r,4000));await p.screenshot({path:SHOT+'_C.png'});
await p.tap('#srabHB');await p.waitForFunction(()=>document.getElementById('showroomB')&&!document.getElementById('showroom'),{timeout:180000}).catch(()=>{});
ck(await p.evaluate(()=>!!document.getElementById('showroomB')&&GX.showroomAB.get()=='B'),'tap B -> showroom B');
await p.goto(URL+'/?showroom=a',{waitUntil:'load',timeout:180000});await new Promise(r=>setTimeout(r,3000));ck(await p.evaluate(()=>GX.showroomAB.get()=='C'),'?showroom=a link -> C');
ck(!errs.length,'no page errors '+errs.slice(0,2).join(' | '));
}catch(e){ck(0,'exception '+e.message)}
await b.close();console.log(fail?'FAILED '+fail:'ALL PASS');process.exit(fail?1:0)
