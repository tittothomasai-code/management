// v5.9.2.3 animation tied to state: pumps (pistons, particles) and top drive / string rotation.
import puppeteer from 'puppeteer-core';import * as AN from './anim.js';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,'');let pass=0,fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const S=(o)=>Object.assign({pumps:[{on:true,spm:60},{on:true,spm:40}],Q:500,td:{rpm:80},mode:'rotate',slips:false},o);
// unit
let a=AN.pumpAnim(S({pumps:[{on:false,spm:37},{on:false,spm:12}]}),false);ok(!a.run&&a.sum==0,'SIM pumps toggled off → 0 SPM even while SPM is still decaying (no drift)');
a=AN.pumpAnim(S(),false);ok(a.run&&a.per[0]==60&&a.per[1]==40,'SIM pumps on → per-pump SPM');
ok(AN.pumpAnim(S({pumps:[{on:false,spm:0},{on:false,spm:0}],Q:0}),true).run===false,'LIVE SPM 0 and flow 0 → off');
ok(AN.pumpAnim(S({pumps:[{spm:0.5},{spm:0.4}],Q:10}),true).run===false,'LIVE below thresholds (ΣSPM 0.9 ≤ 1, flow 10 ≤ 20 gpm) → off');
a=AN.pumpAnim(S({pumps:[{spm:0},{spm:0}],Q:420}),true);ok(a.run&&Math.abs(a.sum-100)<1e-9,'LIVE flow-in 420 gpm without SPM channel → on, speed from flow (100 SPM eq.)');
a=AN.pumpAnim(S({pumps:[{spm:55},{spm:0}],Q:0}),true);ok(a.run&&a.per[0]==55,'LIVE SPM 55 → on at 55');
const d1=AN.adv(0,40,1),d2=AN.adv(0,80,1);ok(Math.abs(d2/d1-2)<1e-12&&AN.adv(1.3,0,5)==1.3,'angle advance ∝ SPM/RPM, 0 → no change');
ok(AN.rotAnim(S(),false)==80,'SIM rotary 80 RPM → 80');ok(AN.rotAnim(S({mode:'slide'}),false)==0,'SIM sliding → 0');ok(AN.rotAnim(S({slips:true}),false)==0,'in slips → 0');
ok(AN.rotAnim(S({td:{rpm:0.4}}),false)==0,'RPM < 1 → 0');ok(AN.rotAnim(S({td:{rpm:120}}),true)==120&&AN.rotAnim(S({td:{rpm:0}}),true)==0,'LIVE RPM channel 120 → 120; 0 → 0');
// browser
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const p=await b.newPage();await p.setViewport({width:1200,height:800});
const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.G?.animProbe&&G.S?.pumps?.length,{timeout:120000});
const w=ms=>new Promise(r=>setTimeout(r,ms));const pr=()=>p.evaluate(()=>G.animProbe());
await p.evaluate(()=>{G.S.pumps.forEach(p=>{p.on=true;p.cmd=60});G.S.autoSteer=false;G.S.mode='rotate';G.S.slips=false;G.S.connected=true;G.S.rough=false;G.S.td.cmd=60});await w(6000);
let x0=await pr();await w(2000);let x1=await pr();const r60=(x1.vth[0]-x0.vth[0])/(x1.t-x0.t),q60=(x1.vtd-x0.vtd)/(x1.t-x0.t);
ok(r60>0&&x1.vis&&JSON.stringify(x1.pp)!=JSON.stringify(x0.pp),'pumps on: pistons turn and flow particles move');
await p.evaluate(()=>G.S.pumps.forEach(p=>p.cmd=120));await w(7000);x0=await pr();await w(2000);x1=await pr();const r120=(x1.vth[0]-x0.vth[0])/(x1.t-x0.t);
const exp=x1.spm[0]/x0.spm[0];ok(Math.abs(r120/r60-(x1.anim.pumps.per[0]/ (r60*60/2/Math.PI)))<0.2||Math.abs(r120/r60-2)<0.25,'pump speed ∝ SPM: rate ratio '+(r120/r60).toFixed(2)+' for SPM '+(r60*60/2/Math.PI).toFixed(0)+'→'+(r120*60/2/Math.PI).toFixed(0));
ok(Math.abs(r120*60/2/Math.PI-x1.anim.pumps.per[0])<0.1*x1.anim.pumps.per[0],'piston rate matches SPM ('+(r120*60/2/Math.PI).toFixed(1)+' vs '+x1.anim.pumps.per[0].toFixed(1)+')');
await p.evaluate(()=>G.S.pumps.forEach(p=>p.on=false));await w(300);x0=await pr();await w(1500);x1=await pr();
ok(JSON.stringify(x0.vth)==JSON.stringify(x1.vth)&&JSON.stringify(x0.pp)==JSON.stringify(x1.pp)&&!x1.vis,'pumps off: pistons and particles frame-to-frame identical, particles hidden (SPM still decaying: '+x1.spm.map(v=>v.toFixed(1)).join('/')+')');
ok(q60>0,'rotary: quill/string turning ('+(q60*60/2/Math.PI).toFixed(1)+' rpm)');
await p.evaluate(()=>{G.S.td.cmd=120});await w(6000);x0=await pr();await w(2000);x1=await pr();const q120=(x1.vtd-x0.vtd)/(x1.t-x0.t);
ok(Math.abs(q120*60/2/Math.PI-x1.anim.rpm)<0.1*x1.anim.rpm&&x1.quill==x1.vtd&&x1.rot==x1.vtd,'rotation rate matches RPM ('+(q120*60/2/Math.PI).toFixed(1)+' vs '+x1.anim.rpm.toFixed(1)+'); quill, rotary, string share the angle');
await p.evaluate(()=>{G.S.mode='slide'});await w(300);x0=await pr();await w(1500);x1=await pr();ok(x0.vtd==x1.vtd,'sliding: no rotation');
await p.evaluate(()=>{G.S.mode='rotate';G.S.slips=true});await w(300);x0=await pr();await w(1500);x1=await pr();ok(x0.vtd==x1.vtd,'in slips: no rotation');
await p.evaluate(()=>{G.S.slips=false;G.S.td.cmd=0;G.S.td.rpm=0});await w(1500);x0=await pr();await w(1500);x1=await pr();ok(x0.vtd==x1.vtd,'RPM 0: no rotation');
ok(!errs.length,'no page errors '+errs.slice(0,2).join(' | '));await b.close();console.log(`anim ${pass} pass, ${fails} fail`);process.exit(fails?1:0)
