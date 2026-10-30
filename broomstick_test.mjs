// feat/casing-broomstick test: broomstick curves from casingtd, SIM measured hookload, apparent μ, panel + HUD (phone + desk).
import puppeteer from 'puppeteer-core';import * as B from './broomstick.js';import {well,casingPlan,stateAt} from './ops3d.js?v=b4';import {casingTD} from './casingtd.js';
const BASE=(process.argv[2]||'http://localhost:8834').replace(/\/$/,''),SH='shots_live/162_broomstick_';
const w_=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const w=well(),P=casingPlan(w),C=B.curves(w,P),M=B.measured(P,w);
ok(C.length>20&&C.every(r=>B.MUS.every(m=>Number.isFinite(r['pu'+m])&&Number.isFinite(r['so'+m]))),'curves for μ '+B.MUS.join(', ')+' at '+C.length+' depths');
const L=C.at(-1);ok(B.MUS.every((m,i)=>!i||(L['pu'+m]>L['pu'+B.MUS[i-1]]&&L['so'+m]<L['so'+B.MUS[i-1]])),'broomstick opens: PU rises and SO falls with μ ('+Math.round(L['so0.4'])+'–'+Math.round(L['pu0.4'])+' kN at '+L.md+' m)');
ok(C.every(r=>r['so0.1']<=r.rot+1e-6&&r.rot<=r['pu0.1']+1e-6),'ROT between SO and PU');
const r0=casingTD(w,1000,{...B.tdOpts(P),muCH:0.3,muOH:0.3});ok(Math.abs(B.curvesAt(C,1000)['pu0.3']-r0.pu)<1e-6,'curves are casingtd.js output (no new T&D engine)');
ok(M.length>30&&M.every(p=>p.src=='SIM'),'SIM measured points: '+M.length);const s=stateAt(P,w,P.T*0.5);ok(Math.abs(B.fromState(s).so-s.td.so)<1e-9,'measured hookload = td.so from ops3d state');
const deep=M.filter(p=>p.md>1000),mus=deep.map(p=>B.apparentMu(C,p));ok(mus.every(m=>m>0.2&&m<0.36),'apparent μ deep '+Math.min(...mus).toFixed(2)+'–'+Math.max(...mus).toFixed(2)+' (plan 0.2 CH / 0.3 OH)');
ok(B.apparentMu(C,{md:L.md,so:L['so0.4']*0.97})==0.4&&Math.abs(B.apparentMu(C,{md:L.md,so:L['so0.2']})-0.2)<1e-9,'μ fit bounds + exact on curve');ok(B.apparentMu(C,{md:50,so:40})==null,'near-vertical: μ not read');
ok(/higher than plan/.test(B.advice(0.4))&&/follows/.test(B.advice(0.3)),'advice text');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 let p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!/localhost/.test(r.url()))bad.push(r.url())});
 await p.goto(BASE+'/?nosplash=1&broomstick=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>document.getElementById('bstkC')?.width>50,{timeout:120000});await w_(500);
 ok(await p.evaluate(()=>!!document.getElementById('btnBroom')),nm+': button present');const t=await p.evaluate(()=>document.getElementById('bstk').textContent);
 ok(/SIM/.test(t)&&!/\bLIVE\b/.test(t)&&/Apparent friction/.test(t),nm+': panel SIM, apparent friction shown');await p.screenshot({path:SH+nm+'_chart.png'});await p.close();
 p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.goto(BASE+'/?nosplash=1&demo=casing&speed=8',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.dwOps?.last&&document.getElementById('bsHL')&&window.dwOps.last.shoeMD>700,{timeout:180000});await w_(800);
 const h=await p.evaluate(()=>({t:document.getElementById('bsHL').textContent,so:dwOps.last.td.so,n:GX.broomstick.H.pts.length,box:document.getElementById('bsHud').textContent}));
 ok(Math.abs(parseFloat(h.t)-h.so)<30&&h.n>3,nm+': HUD hookload '+h.t+' tracks td.so '+Math.round(h.so)+' ('+h.n+' pts)');ok(/SIM/.test(h.box)&&!/\bLIVE\b/.test(h.box),nm+': HUD labelled SIM');
 await p.screenshot({path:SH+nm+'_hud.png'});await p.close()}
await b.close();ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no external writes');
console.log(`\n${pass} pass, ${fails} fail`);process.exit(fails?1:0)
