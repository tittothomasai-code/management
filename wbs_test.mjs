// feat/wbs test: Kirsch breakout + mud window (pure, closed-form checks) and the strip log tracks in the browser (phone + desk).
globalThis.window=globalThis;import puppeteer from 'puppeteer-core';import * as W from './wbs.js';const ST=(await import('./strat.js')).default;
const BASE=(process.argv[2]||'http://localhost:8871').replace(/\/$/,''),SH='shots_live/170_wbs_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const P={pp:1.05,fg:1.6,ob:2.2},S=W.stresses(2000,P),q=3,ucs=30;
ok(Math.abs(S.SH/S.Sh-W.CFG.sHr)<1e-9&&S.Sv>S.SH&&S.SH>S.Sh,'normal fault regime Sv > SH > Sh');
const pwC=(3*S.SH-S.Sh-S.Pp-ucs+q*S.Pp)/(1+q)/S.g,X=W.window1(2000,P,0,0,ucs);
ok(Math.abs(X.collapse-pwC)<0.002,'vertical hole collapse '+X.collapse.toFixed(3)+' SG = Kirsch + Mohr-Coulomb closed form '+pwC.toFixed(3));
const bd=(3*S.Sh-S.SH-S.Pp)/S.g;ok(Math.abs(X.breakdown-bd)<0.002,'breakdown '+X.breakdown.toFixed(3)+' SG = (3Sh − SH − Pp)/g '+bd.toFixed(3));
ok(X.collapseAllow<X.collapse,'allowed '+W.CFG.maxBo+'° breakout needs less mud than zero breakout');
const b1=W.breakout(S,0,0,1.0*S.g,ucs),b2=W.breakout(S,0,0,0.95*S.g,ucs),b3=W.breakout(S,0,0,1.3*S.g,ucs);
ok(b1.width>0&&b2.width>b1.width&&b3.width==0,'breakout width grows when mud weight drops ('+b3.width+'°, '+b1.width.toFixed(0)+'°, '+b2.width.toFixed(0)+'°)');
ok(Math.abs(((0+b1.theta)%180)-((W.CFG.sHazi+90)%180))<2,'vertical breakout points to Shmin azimuth ('+b1.theta+'°)');
ok(W.breakout(S,0,0,2.1*S.g,ucs).tensile&&!b3.tensile,'tensile fracture above breakdown');
ok(W.window1(2000,P,0,0,60).collapse<X.collapse,'stronger rock → lower collapse mud weight');
const Xh=W.window1(2000,P,70,W.CFG.sHazi+90,ucs);ok(Xh.collapse>X.collapse,'inclined hole toward Shmin needs more mud ('+Xh.collapse.toFixed(2)+' > '+X.collapse.toFixed(2)+')');
const M=ST.model(),path=[];for(let md=0;md<=3000;md+=30)path.push({md,tvd:md<1000?md:1000+(md-1000)*0.8,E:md<1000?0:(md-1000)*0.6,N:0});
const pr=W.profile(ST,M,path,1.45,{step:100}),sm=W.summary(pr);ok(pr.length>20&&pr.every(r=>r.tag=='SIM'&&r.collapse>=0&&r.breakdown>r.pp),'profile '+pr.length+' points along path, all SIM');
ok(pr.every(r=>Math.abs(r.pp-ST.pressureAt(M,r.tvd,0,0).pp_sg)<0.2),'pore from GX.strat.pressureAt');
ok(pr.some(r=>r.lith=='salt')||pr.some(r=>r.ucs!=pr[0].ucs),'UCS from strat lithology');
const lo=W.profile(ST,M,path,1.0,{step:100});ok(W.summary(lo).kick>sm.kick,'light mud → more kick risk points');ok(['OK','MINOR BREAKOUT','BREAKOUT','KICK RISK','LOSS RISK'].includes(pr[5].state),'state labels');
// ---- browser ----
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!/localhost/.test(r.url()))bad.push(r.url())});
 await p.goto(BASE+'/?nosplash=1&wbs=1.30',{waitUntil:'load',timeout:120000});
 try{await p.waitForFunction(()=>document.getElementById('wbsLog'),{timeout:120000})}catch(e){}
 ok(await p.evaluate(()=>!!document.getElementById('stratLog')&&!!document.getElementById('wbsLog')),nm+': strip log + stability tracks shown');
 ok(await p.evaluate(()=>!!document.getElementById('btnWBS')),nm+': Hole stability button');
 const t=await p.evaluate(()=>document.getElementById('wbsBox')?.textContent||'');ok(/SIM/.test(t)&&!/LIVE/.test(t),nm+': tagged SIM, never LIVE');ok(/1\.30 SG/.test(t),nm+': mud weight from URL (1.30 SG)');
 ok(await p.evaluate(()=>{const c=document.getElementById('wbsLog');const g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=40)if(d[i]+d[i+1]+d[i+2]>200)n++;return n>200}),nm+': tracks drawn');
 await p.evaluate(()=>document.getElementById('wbsBox').scrollIntoView());await w(300);await p.screenshot({path:SH+nm+'.png'});
 await p.evaluate(()=>GX.wbs.setMW(1.0));await w(300);const t2=await p.evaluate(()=>document.getElementById('wbsSum').textContent);ok(/1\.00 SG/.test(t2)&&GX!==0,nm+': mud weight change redraws');
 await p.evaluate(()=>document.getElementById('wbsBox').scrollIntoView());await p.screenshot({path:SH+nm+'_light.png'});await p.close()}
ok(!errs.length,'no page errors '+errs.slice(0,2).join(' | '));ok(!bad.length,'no external writes');await b.close();
console.log(`${pass} pass, ${fails} fail`);process.exit(fails?1:0)
