// srcfleet_test.mjs: Showroom C rig catalogue covers every Showroom A rig/spec/equipment entry (A's GLBs). node srcfleet_test.mjs [url]
import puppeteer from '/workspace/drill-sim/v3-game/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const URL=(process.argv[2]||'http://localhost:8957').replace(/\/$/,''),SH='shots_live/192_srcfleet_';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader']});let fail=0;const ck=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const VP={phone:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2},desk:{width:1440,height:900}};
for(const nm of (process.env.ONLY?[process.env.ONLY]:['phone','desk'])){try{const p=await b.newPage();await p.setViewport(VP[nm]);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(URL+'/?nosplash',{waitUntil:'load',timeout:180000});await p.waitForSelector('#btnShow',{timeout:180000});await p.evaluate(()=>GX.showroomAB.set('C'));await p.evaluate(()=>btnShow.click());
await p.waitForFunction(()=>GX.showroomC?.ST?.root,{timeout:180000});
await p.tap?.('#srcFleetB').catch(()=>{});await p.evaluate(()=>{if(!GX.showroomC.ST.fl)srcFleetB.click()});await p.waitForFunction(()=>document.querySelectorAll('#srcFleet [data-arig]').length>=10,{timeout:60000}).catch(()=>{});
const info=await p.evaluate(async()=>{const a=await import('./showroom.js?v=b16'),sc=await import('./showroomc.js?v=c10');/* D3: superseded A rigs are not listed */return {rigs:a.RIGS.map(r=>r.id).filter(id=>!sc.superseded(id)),eq:Object.keys(a.ASSET),shownR:[...document.querySelectorAll('#srcFleet [data-fid]')].map(e=>e.dataset.fid).filter(Boolean),shownE:[...document.querySelectorAll('#srcFleet [data-aeq]')].map(e=>e.dataset.aeq),vis:!srcFleet.hidden&&srcFleet.getBoundingClientRect().height>100}});
ck(info.vis,nm+': catalogue panel visible');ck(info.rigs.every(r=>info.shownR.includes(r)),nm+': all A rigs listed '+info.shownR.join());ck(info.eq.every(k=>info.shownE.includes(k)),nm+': all A equipment listed '+info.shownE.join());
await p.screenshot({path:SH+nm+'_panel.png'});
for(const id of info.rigs){await p.evaluate(id=>document.querySelector(`#srcFleet [data-arig="${id}"]`).click(),id);const ok=await p.waitForFunction(id=>GX.showroomC.ST.alt==id&&GX.showroomC.ST.altObj&&srcMsg.hidden,{timeout:120000},id).then(()=>1,()=>0);
 const t=await p.evaluate(()=>{let n=0;GX.showroomC.ST.altObj?.traverse(o=>{if(o.isMesh)n++});return {n,root:GX.showroomC.ST.root.visible,name:srcName.textContent}});ck(ok&&t.n>0&&!t.root,`${nm}: view ${id} (${t.n} meshes, "${t.name}")`);
 if(nm=='phone'&&(id=='single'||id=='heli')){await p.evaluate(()=>GX.showroomC.fleet(false));await new Promise(r=>setTimeout(r,2500));await p.screenshot({path:SH+nm+'_'+id+'.png'});await p.evaluate(()=>GX.showroomC.fleet(true))}}
await p.evaluate(()=>document.querySelector('#srcFleet [data-arig=""]').click());await new Promise(r=>setTimeout(r,500));
ck(await p.evaluate(()=>GX.showroomC.ST.root.visible&&!GX.showroomC.ST.alt&&!GX.showroomC.ST.altObj),nm+': back to detailed rig');
await p.evaluate(()=>GX.showroomC.fleet(false));await p.evaluate(()=>GX.showroomC.preset('bop'));ck(await p.evaluate(()=>GX.showroomC.ST.preset=='bop'&&GX.showroomC.ST.root.visible),nm+': presets still work');
ck(!errs.length,nm+': no page errors '+errs.slice(0,2).join(' | '));await p.close()}catch(e){ck(0,nm+': exception '+e.message)}}
await b.close();console.log(fail?'FAILED '+fail:'ALL PASS');process.exit(fail?1:0)
