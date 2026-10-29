import puppeteer from 'puppeteer-core';
import * as M from './wplan.js';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const near=(a,b,t)=>Math.abs(a-b)<=t;
// V1 textbook (drillingformulas.com): 3500->3600 ft, I15/A20 -> I25/A45: beta 12.95 deg, RF 1.00408, N 27.22, E 19.45, TVD 94.01
{const b=M.dogleg(15,20,25,45),rf=2/b*Math.tan(b/2),d=M.minCurv(3500,15,20,3600,25,45);
 ok(near(b*180/Math.PI,12.95,0.01)&&near(rf,1.00428,1e-5),`textbook beta ${(b*180/Math.PI).toFixed(3)} RF ${rf.toFixed(5)} (site prints 1.00408; 2/β·tan(β/2) at β=0.22605 = 1.00428; its N/E/TVD match ours)`);
 ok(near(d[0],27.22,0.01)&&near(d[1],19.45,0.01)&&near(d[2],94.01,0.01),`textbook dN ${d[0].toFixed(2)} dE ${d[1].toFixed(2)} dTVD ${d[2].toFixed(2)} (27.22/19.45/94.01)`);}
// V2 analytic circular build 3 deg/30m 0->30 deg
{const R=M.radius(3);let h=0,v=0;for(let k=0;k<10;k++){const d=M.minCurv(k*30,k*3,45,(k+1)*30,(k+1)*3,45);h+=Math.hypot(d[0],d[1]);v+=d[2]}
 ok(near(h,R*(1-Math.cos(Math.PI/6)),1e-6)&&near(v,R*Math.sin(Math.PI/6),1e-6),`analytic arc H ${h.toFixed(3)} V ${v.toFixed(3)} R ${R.toFixed(2)}`);}
// V3 default SIM proposal hits targets, DLS within max, positions consistent with geometry
const L=M.plan(M.DEFAULT),S=M.survey(L),TC=M.targetCheck(L,S);
ok(TC.every(t=>t.miss<1),'targets hit: '+TC.map(t=>t.name+' '+t.miss.toFixed(2)+' m').join(', '));
ok(Math.max(...S.rows.map(r=>r.dls))<=M.DEFAULT.maxDls+1e-6,'max DLS '+Math.max(...S.rows.map(r=>r.dls)).toFixed(2));
ok(L.legs.some(l=>l.kind=='build')&&L.legs.some(l=>l.kind.includes('turn'))&&L.legs.some(l=>l.kind=='hold'),'sections '+L.legs.map(l=>l.kind).join(','));
const dropL=M.plan({...M.DEFAULT,targets:[{name:'S1',tvd:1200,n:400,e:0,tol:20,dls:3}],steps:[],tdHold:0});const dS=M.plan({...M.DEFAULT,targets:[{name:'S1',tvd:1200,n:400,e:0,tol:20,dls:3},{name:'S2',tvd:2000,n:500,e:0,tol:20,dls:3}],tdHold:0});
ok(dS.legs.some(l=>l.kind.startsWith('drop')),'S-well drop section: '+dS.legs.map(l=>l.kind).join(','));
ok(M.plan({...M.DEFAULT,targets:[{name:'X',tvd:520,n:900,e:0,tol:10,dls:3}]}).warn.length==1,'unreachable target flagged');
ok(M.toCSV(S).split('\n').length==S.rows.length+1,'CSV rows '+S.rows.length);
// UI
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for(const [tag,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1280,height:800}]]){
 const pg=await br.newPage();await pg.setViewport(vp);const errs=[];pg.on('pageerror',e=>errs.push(e.message));const net=[];pg.on('request',r=>{if(!/localhost/.test(r.url()))net.push(r.url())});
 await pg.goto('http://localhost:8781/?nosplash=1',{waitUntil:'load',timeout:60000});await pg.waitForFunction(()=>window.GX?.wplan,{timeout:60000});
 await pg.waitForFunction(()=>document.querySelector('#uiTools #btnWP'),{timeout:12000}).catch(()=>{});ok(await pg.evaluate(()=>!!document.querySelector('#uiTools #btnWP')||!!document.getElementById('btnWP')),tag+' Tools button present (in Tools: '+await pg.evaluate(()=>!!document.querySelector('#uiTools #btnWP'))+')');
 await pg.evaluate(()=>document.getElementById('uiTab_tools')?.click());await new Promise(r=>setTimeout(r,500));await pg.evaluate(()=>document.getElementById('btnWP').scrollIntoView());await pg.screenshot({path:`shots_live/108_w1_${tag}_0_tools.png`});await pg.evaluate(()=>document.getElementById('btnWP').click());await pg.evaluate(()=>GX.wplan.open('inputs'));await new Promise(r=>setTimeout(r,500));await pg.screenshot({path:`shots_live/108_w1_${tag}_1_inputs.png`});
 await pg.click('#wpCalc');await new Promise(r=>setTimeout(r,2500));
 ok(await pg.evaluate(()=>document.querySelectorAll('#wpTbl tbody tr').length>20&&!!document.querySelector('#wp3d canvas')),tag+' table + 3D rendered');
 ok(await pg.evaluate(()=>/SIM/.test(document.getElementById('wp').textContent)&&!/LIVE/.test(document.getElementById('wp').textContent)),tag+' SIM tag, no LIVE');
 await pg.evaluate(()=>document.getElementById('wp').scrollTop=0);await pg.screenshot({path:`shots_live/108_w1_${tag}_2_trajectory.png`});
 await pg.evaluate(()=>document.querySelector('#wpTbl').scrollIntoView());await pg.screenshot({path:`shots_live/108_w1_${tag}_3_table.png`});
 await pg.evaluate(()=>GX.wplan.open('inputs'));await pg.click('#wpSave');await new Promise(r=>setTimeout(r,500));
 ok((await pg.evaluate(()=>GX.wplan.dbAll('proposals'))).length>=1,tag+' saved to IndexedDB');
 ok(!errs.length,tag+' no page errors '+errs.join('|'));ok(!net.some(u=>/adaga|witsml|supabase/i.test(u)),tag+' no external data calls');await pg.close()}
await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
