// feat/wellcontrol test: kick detection, kill sheet (DM/W&W), MAASP, losses + LCM pill. Pure checks + browser (phone + desk).
import puppeteer from 'puppeteer-core';import * as M from './wellcontrol.js';import * as F from './fluids.js';import * as WC from './wellctl.js';
const BASE=(process.argv[2]||'http://localhost:8832').replace(/\/$/,''),SH='shots_live/161_wellcontrol_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};const BAR=1e5,G=9.80665;
// kick detection
const S0=WC.newWC({});for(let i=0;i<300;i++)WC.step(S0,1);ok(!M.detect(S0,[]).kick,'no kick signs while balanced');
const R=M.scenario();ok(R.kickAt!=null&&R.kickAt<1800,'kick detected at '+R.kickAt+' s');ok(R.S.mode=='shutin','well shut in');
const d=M.detect(Object.assign(WC.newWC({}),{}),Array.from({length:30},(_,i)=>({t:i,rop:i<25?15:45})));ok(d.drillBreak&&!d.kick,'drilling break flagged (×'+(d.ropNow/d.ropBase).toFixed(1)+'), not a kick by itself');
ok(M.stabilised(R.S),'SIDPP/SICP stabilised before kill sheet');
// kill sheet
const K=R.K;ok(K.sidpp>0&&K.sicp>=K.sidpp-1,'SIDPP '+(K.sidpp/BAR).toFixed(1)+' bar, SICP '+(K.sicp/BAR).toFixed(1)+' bar (SICP ≥ SIDPP)');
const kmw=R.S.omw+K.sidpp/(1000*G*R.S.w.tvd);ok(K.kmw>=kmw-1e-9&&K.kmw-kmw<0.011,'KMW '+K.kmw+' = OMW + SIDPP/(g·TVD) rounded up ('+kmw.toFixed(3)+')');
ok(Math.abs(K.icp-(K.sidpp+K.scrP))<1,'ICP = SIDPP + SCR');ok(Math.abs(K.fcp-K.scrP*K.kmw/R.S.omw)<1,'FCP = SCR × KMW/OMW');
ok(M.dpAt(K.ww,0)==K.icp&&Math.abs(M.dpAt(K.ww,K.stkSurfBit)-K.fcp)<1&&M.dpAt(K.ww,K.stkSurfBit/2)<K.icp,'W&W: ICP → FCP over surface-to-bit strokes');
const c1=K.stkSurfBit+K.stkBitSurf;ok(M.dpAt(K.dm,c1*0.9)==K.icp&&Math.abs(M.dpAt(K.dm,c1+K.stkSurfBit)-K.fcp)<1&&K.dm.at(-1)[0]==2*c1,"Driller's: hold ICP for circ 1, then ICP → FCP, 2 circulations");
ok(K.step.length>3&&K.step.every((r,i)=>!i||r.bar<=K.step[i-1].bar+1e-9),'step-down table decreasing ('+K.step.length+' rows)');ok(K.tag=='SIM','kill sheet tagged SIM');
// MAASP
const Mm=M.maasp(R.S.w,R.S.omw);ok(Math.abs(Mm.maasp-(Mm.fgSG-Mm.mw)*1000*G*R.S.w.shoeTVD)<1&&Mm.maasp>0,'MAASP '+(Mm.maasp/BAR).toFixed(1)+' bar = (FG−MW)·g·TVD shoe');
globalThis.GX={strat:{model:()=>({}),pressureAt:(m,tvd)=>({pp_sg:1.1,fg_sg:1.6,ob_sg:2.2,lith:'shale'})}};const Ms=M.maasp(R.S.w,1.25);ok(Ms.src=='strat'&&Math.abs(Ms.fgSG-1.6)<1e-9,'MAASP uses GX.strat.pressureAt frac gradient');delete globalThis.GX;
// losses
const w0=F.defWell(),Q=F.pumpOutput(w0.pump,100)*w0.pump.n,mud=sg=>({...F.clone(F.MUDS.wbm),sg});
const L0=M.losses(mud(1.25),w0,Q),L1=M.losses(mud(1.75),w0,Q),L2=M.losses(mud(1.9),w0,Q);
ok(L0.cls=='none'&&!L0.pill,'normal mud: ECD '+L0.ecd.toFixed(2)+' < FG '+L0.fgShoe.toFixed(2)+', no losses');ok(L0.ecd>1.25,'ECD > mud weight (annular friction from fluids.hydraulics)');
ok(L1.rateM3h>0&&L1.pill,'heavy mud 1.75: ECD '+L1.ecd.toFixed(2)+' > FG → '+L1.cls+' '+L1.rateM3h.toFixed(1)+' m³/h, pill '+L1.pill.blend);
ok(L2.rateM3h>L1.rateM3h,'more overbalance → more losses ('+L2.cls+')');ok(M.lcmPill('partial',w0).volM3>=8&&M.lcmPill('seepage',w0).kgm3<M.lcmPill('partial',w0).kgm3,'pill volume ≥ 8 m³, concentration by loss class');
// ---- browser ----
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!/localhost/.test(r.url()))bad.push(r.url())});
 await p.goto(BASE+'/?nosplash=1&wellcontrol=kick',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.wellcontrol&&document.getElementById('wcxK'),{timeout:120000});
 ok(await p.evaluate(()=>!!document.getElementById('btnWC')),nm+': Well control button present');
 await p.select('#wcxSp','60');await p.waitForFunction(()=>GX.wellcontrol.detect(GX.wellcontrol.U.S,GX.wellcontrol.U.rop).kick,{timeout:90000});
 ok(await p.evaluate(()=>/Stop drilling|flow check/.test(document.getElementById('wcxAct').textContent)),nm+': kick warning shown');await p.screenshot({path:SH+nm+'_kick.png'});
 await p.click('#wcxShut');await p.waitForFunction(()=>GX.wellcontrol.U.S.mode=='shutin'&&/stable\./.test(document.getElementById('wcxAct').textContent),{timeout:90000});
 await p.evaluate(()=>document.querySelector('#wcx [data-t=kill]').click());await w(300);
 const t=await p.evaluate(()=>document.getElementById('wcx').textContent);ok(/KMW/.test(t)&&/ICP/.test(t)&&/FCP/.test(t),nm+': kill sheet shows KMW, ICP, FCP');
 ok(await p.evaluate(()=>document.querySelectorAll('#wcxStep tr').length>3),nm+': step-down table');await p.evaluate(()=>document.getElementById('wcxDP').scrollIntoView());await p.screenshot({path:SH+nm+'_kill_dm.png'});
 await p.evaluate(()=>document.querySelector('#wcx [data-m=ww]').click());await w(200);await p.screenshot({path:SH+nm+'_kill_ww.png'});
 await p.evaluate(()=>document.querySelector('#wcx [data-t=maasp]').click());await w(200);ok(await p.evaluate(()=>/MAASP/.test(document.getElementById('wcx').textContent)),nm+': MAASP shown');
 await p.evaluate(()=>{document.getElementById('wcxMW').value='1.85';document.getElementById('wcxL').click()});await w(200);
 ok(await p.evaluate(()=>/LCM pill/.test(document.getElementById('wcxPill').textContent)),nm+': losses → LCM pill');await p.evaluate(()=>document.getElementById('wcxPill').scrollIntoView());await p.screenshot({path:SH+nm+'_losses.png'});
 const txt=await p.evaluate(()=>document.getElementById('wcx').textContent);ok(!/\bLIVE\b/.test(txt)&&/SIM/.test(txt),nm+': labelled SIM, never LIVE');await p.close()}
await b.close();ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no external writes');
console.log(`\n${pass} pass, ${fails} fail`);process.exit(fails?1:0)
