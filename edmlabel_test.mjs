// feat/edm-labels test: clickable wellhead labels in EDM Site 3D (edmlabel.js). Synthetic fixture only (fixtures/edm_pad.*, made-up pad).
// Checks: one label per wellbore, labels follow the view, click label and raycast click on the wellhead open details (name, slot, status,
// TD, last survey, closest-offset SF), IMPORT tag never LIVE, close, phone + desk, no network writes, no page errors.
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8841').replace(/\/$/,''),SH='shots_live/153_edmlabel_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],posts=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>/WebGL/.test(e.message)||errs.push(e.message));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))posts.push(r.method()+' '+r.url())});
 await p.goto(BASE+'/?nosplash=1&edm=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.edm&&document.getElementById('edm'),{timeout:120000});await w(800);
 if(!await p.$('#edmf'))await p.evaluate(()=>GX.edm.open());await w(500);
 const inp=await p.$('#edmf');await inp.uploadFile('fixtures/edm_pad.xml');await p.waitForFunction(()=>window.GX.edm.ST.R,{timeout:60000});await w(800);await p.evaluate(()=>document.querySelector('#edm nav button[data-t=site]')?.click());await p.waitForSelector('.edmLW .edmLbl',{timeout:30000});
 await p.waitForFunction(()=>window.GX.edmlabel?.state?.(),{timeout:30000}).catch(()=>{});await w(1500);
 const s=await p.evaluate(()=>{const L=[...document.querySelectorAll('.edmLW .edmLbl')];const c=document.querySelector('.edmLW canvas').getBoundingClientRect();
  return {n:L.length,wbs:GX.edm.ST.R.A.wbs.length,vis:L.filter(e=>{const r=e.getBoundingClientRect();return e.style.display!='none'&&r.left>=c.left-40&&r.right<=c.right+40&&r.top>=c.top-30&&r.bottom<=c.bottom}).length,txt:L.map(e=>e.textContent)}});
 ok(s.n==s.wbs&&s.n==4,`${nm}: one label per wellbore (${s.n}) ${JSON.stringify(s.txt)}`);ok(s.vis>=3,`${nm}: labels sit on the 3D view (${s.vis} visible)`);
 await p.evaluate(()=>document.querySelector('.edmLW').scrollIntoView());await w(300);await p.screenshot({path:SH+nm+'_1_labels.png'});
 // labels follow the camera
 const l0=await p.$eval('.edmLW .edmLbl',e=>e.style.left+','+e.style.top);await p.evaluate(()=>{const c=document.querySelector('.edmLW canvas');const r=c.getBoundingClientRect();});
 const cr=await p.$eval('.edmLW canvas',c=>{const r=c.getBoundingClientRect();return [r.left+r.width*0.8,r.top+r.height*0.8]});
 await p.evaluate(()=>{const c=GX.edmlabel._cam();c.position.x+=0.3*c.position.length();c.updateMatrixWorld()});await p.waitForFunction(l0=>{const e=document.querySelector('.edmLW .edmLbl');return e&&e.style.left+','+e.style.top!=l0},{timeout:15000},l0).catch(()=>{});
 const l1=await p.$eval('.edmLW .edmLbl',e=>e.style.left+','+e.style.top);ok(l0!=l1,`${nm}: label moves with orbit (${l0} → ${l1})`);
 // click label
 const lb=await p.$$('.edmLW .edmLbl');let idx=-1;for(let i=0;i<lb.length;i++){if(await lb[i].evaluate(e=>e.style.display!='none')){idx=i;break}}
 await p.evaluate(i=>document.querySelectorAll('.edmLW .edmLbl')[i].click(),idx);await w(400);
 const d=await p.evaluate(i=>{const c=document.getElementById('edmCard');const D=GX.edmlabel.details(i);return {c:!!c,t:c?.innerText||'',D}},idx);
 ok(d.c&&d.t.includes(d.D.name),`${nm}: click label opens details for ${d.D.name}`);
 ok(/Slot/.test(d.t)&&/Status/.test(d.t)&&/TD/.test(d.t)&&/Last survey/.test(d.t)&&/Closest offset/.test(d.t),`${nm}: details show slot, status, TD, last survey, closest offset`);
 ok(d.D.td>0&&d.D.last&&d.D.last.md>0&&d.D.sf&&d.D.sf.sf>0,`${nm}: values from GX.edm data (TD ${d.D.td.toFixed(1)} m, last survey ${d.D.last?.md?.toFixed(1)} m, SF ${d.D.sf?.sf?.toFixed(2)})`);
 ok(/IMPORT/.test(d.t)&&!/\bLIVE\b/.test(d.t),`${nm}: card tagged IMPORT, never LIVE`);ok(/ m MD/.test(d.t)&&!/\bft\b/.test(d.t),`${nm}: metric units`);
 const fit=await p.evaluate(()=>{const c=document.getElementById('edmCard').getBoundingClientRect();return c.left>=0&&c.right<=innerWidth});ok(fit,`${nm}: card fits the screen width`);
 await p.screenshot({path:SH+nm+'_2_card.png'});
 await p.click('#edmCard .x');await w(300);ok(await p.evaluate(()=>!document.getElementById('edmCard')),`${nm}: ✕ closes the card`);
 // raycast click on a wellhead sphere
 const hp=await p.evaluate(()=>{const L=document.querySelectorAll('.edmLW .edmLbl');for(const e of L){if(e.style.display=='none')continue;const c=document.querySelector('.edmLW canvas').getBoundingClientRect();const x=c.left+parseFloat(e.style.left),y=c.top+parseFloat(e.style.top);
  // hide labels so the click reaches the canvas
  document.querySelector('.edmLW .edmLbls').style.visibility='hidden';return [x,y,+e.dataset.i]}return null});
 if(hp){await p.mouse.click(hp[0],hp[1]);await w(400)}const rs=await p.evaluate(()=>GX.edmlabel.state());
 ok(hp&&rs?.sel!=null&&await p.evaluate(()=>!!document.getElementById('edmCard')),`${nm}: click on the wellhead in 3D (raycast) opens details (sel ${rs?.sel})`);
 await p.evaluate(()=>document.querySelector('.edmLW .edmLbls').style.visibility='');
 // switch tab: labels removed
 await p.evaluate(()=>document.querySelector('#edm nav button[data-t=wells]').click());await w(500);ok(await p.evaluate(()=>!document.querySelector('.edmLbls')&&!GX.edmlabel.state()),`${nm}: leaving Site 3D removes labels`);
 await p.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!posts.length,'no network writes '+posts.slice(0,2));
console.log(`\n${pass} passed, ${fails} failed`);await b.close();process.exit(fails?1:0)
