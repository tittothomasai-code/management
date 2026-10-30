// helper G test: well planning designer, ISCWSA error model + SF, T&D/buckling/ROP/vibration, MW window/temp/stuck pipe, AFE.
// Node unit checks (analytic) then UI desk 1440x900 + phone 390x844 with 130_wpg_* shots. SIM only.
import puppeteer from 'puppeteer-core';import * as C from './wpg_core.js';
const BASE=process.argv[2]||'http://localhost:8817';let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const near=(a,b,t)=>Math.abs(a-b)<=t;const w=ms=>new Promise(r=>setTimeout(r,ms));
// --- design
{const s=C.buildHold({kop:600,bur:3,target:{name:'T1',n:800,e:600,tvd:2500}});const D=C.runSections(s,{targets:[{name:'T1',n:800,e:600,tvd:2500,tol:30,tolV:30}]}),S=C.stationsOf(D,30),h=C.targetHits(S,[{name:'T1',n:800,e:600,tvd:2500,tol:30,tolV:30}])[0];ok(h.ok&&h.m<0.5&&!D.warn.length,'build-hold hits target (miss '+h.m.toFixed(3)+' m), TD '+D.td.toFixed(0))
 ok(Math.max(...S.map(r=>r.dls))<=3.0001,'build-hold DLS ≤ 3°/30m')}
{const H=C.horizontal({kop:800,bur:4,entry:{n:900,e:400,tvd:2200},lateral:1000});const D=C.runSections(H.secs,{}),S=C.stationsOf(D,30);const e=S.find(r=>Math.abs(r.md-(D.td-1000))<1)||S.reduce((a,b)=>Math.abs(b.tvd-2200)<Math.abs(a.tvd-2200)&&b.inc>89?b:a);
 ok(H.ok&&near(S.at(-1).inc,90,0.01)&&near(S.at(-1).tvd,2200,0.5),'horizontal lands at 90° and 2200 m TVD');const lat=C.laterals(D,[{kickMD:1700,dAzi:-35,dls:6,len:700}]);ok(lat.length==1&&lat[0].D.legs[0].md0==1700&&near(lat[0].D.legs.at(-1).len,700,0.5),'multilateral branch from 1700 m, length 700 m')}
{const r=C.sShape({kop:600,bur:3,dor:2,target:{name:'T',n:700,e:0,tvd:2600}});const S=C.stationsOf(C.runSections(r.secs,{}),30);ok(r.ok&&near(S.at(-1).n,700,1)&&near(S.at(-1).tvd,2600,1)&&S.at(-1).inc<0.5,'S-shape returns vertical at target')}
// --- error model
{const V=C.stationsOf(C.runSections([{kind:'hold',len:3000}],{}),30),cv=C.covISCWSA(V),c=cv.at(-1).C;ok(c[0][0]>0&&c[2][2]>0&&Math.sqrt(c[2][2])<10,'vertical 3000 m: TVD σ '+Math.sqrt(c[2][2]).toFixed(2)+' m');
 const off=V.map(r=>({...r,e:r.e+20})),s=C.sfScan(cv,C.covISCWSA(off));ok(s.every(x=>near(x.ctc,20,0.5)),'parallel offset 20 m: C-C = 20');ok(s[5].sf>s.at(-1).sf,'SF falls with depth as ellipses grow');{const tc=C.tcyl(cv,s);ok(tc.every(x=>x.dist<=x.ctc+0.01),'TC distance <= C-C');ok(near(tc[1].dist,20,1)&&near(tc[1].ang,90,5),'TC: east offset at 90° near surface');}
 const sum=C.sfSummary('x',s);ok(['OK','ALERT','STOP'].includes(sum.lvl),'SF rule level '+sum.lvl+' min '+sum.minSF.toFixed(2))}
// --- T&D
{const V=C.stationsOf(C.runSections([{kind:'hold',len:2000}],{}),30);const p=C.tnd(V,{bitMd:2000,op:'pooh'}),r=C.tnd(V,{bitMd:2000,op:'rih'}),o=C.tnd(V,{bitMd:2000,op:'rob'});
 const wt=C.STRING.reduce((a,c,i,A)=>a+c.kgm*(i==A.length-1?2000-A.slice(0,-1).reduce((s,x)=>s+x.len,0):c.len),0)*C.G0*(1-1.2/7.85);ok(near(p.hook,wt,wt*0.01)&&near(r.hook,wt,wt*0.01),'vertical: hook = buoyed weight '+(wt/1000).toFixed(0)+' kN (no drag)');ok(near(o.hook,wt,wt*0.01),'vertical rotate off bottom = buoyed weight')}
{const H=C.horizontal({kop:800,bur:4,entry:{n:900,e:400,tvd:2200},lateral:1000});const S=C.stationsOf(C.runSections(H.secs,{}),30);const td=S.at(-1).md;const p=C.tnd(S,{bitMd:td,op:'pooh'}),r=C.tnd(S,{bitMd:td,op:'rih'}),o=C.tnd(S,{bitMd:td,op:'rob'});
 ok(p.hook>o.hook&&o.hook>r.hook,'horizontal: trip out > rotate > trip in');ok(o.torque>1000,'rotating torque '+(o.torque/1000).toFixed(1)+' kN·m');const b=C.broomstick(S,{td,step:200});ok(b.pooh['0.4'].at(-1)>b.pooh['0.1'].at(-1)&&b.rih['0.4'].at(-1)<b.rih['0.1'].at(-1),'broomstick fans out with FF');
 const bk=C.buckCheck(C.tnd(S,{bitMd:td,op:'slide',wob:150e3}),8.5,1.2);ok(bk.some(x=>x.state!='none'),'high slide WOB in lateral shows buckling')}
// --- ROP/bits/vib/env
ok(C.ropBY({D:2000,ucs:40})>C.ropBY({D:2000,ucs:120}),'ROP falls with UCS');ok(C.ropBY({D:2000,wob:120})>C.ropBY({D:2000,wob:60}),'ROP rises with WOB');ok(C.bitFor(20).type=='PDC'&&C.bitFor(250).type!='PDC'||C.bitFor(250).iadc!=C.bitFor(20).iadc,'bit changes with rock strength');
{const s1=C.stickSlip({rpm:60}),s2=C.stickSlip({rpm:200});ok(s1.ssi>s2.ssi,'stick-slip index falls at high RPM')}
{const a=C.stability(2000,0,0),b=C.stability(2000,60,0);ok(a.pore<a.collapse+0.5&&a.collapse<a.frac&&a.frac<a.ob,'window order pore/collapse < frac < overburden');ok(b.collapse>a.collapse,'collapse MW rises with inclination')}
{const T=C.tempProfile({td:3000});ok(T.bhct<T.bhst&&T.bhct>0.6*T.bhst,'BHCT '+T.bhct.toFixed(0)+' < BHST '+T.bhst.toFixed(0)+' °C')}
{const A=C.afe([{name:'a',len:500,mdBot:500,holeIn:17.5,csg:'13-3/8',rop:30,bitLife:900,bitType:'PDC',dir:false,log:false},{name:'b',len:1500,mdBot:2000,holeIn:12.25,csg:'9-5/8',rop:15,bitLife:900,bitType:'PDC',dir:true,log:true}]);ok(A.P10.cost<=A.P50.cost&&A.P50.cost<=A.P90.cost&&A.days>5,'AFE P10≤P50≤P90, '+A.days.toFixed(1)+' days')}
{const S=C.stationsOf(C.runSections([{kind:'hold',len:3000}],{}),30),a=C.hydraulics(S,{td:3000,q:1500,shoeMd:2000}),b=C.hydraulics(S,{td:3000,q:3000,shoeMd:2000});ok(b.spp>a.spp*2&&b.ecd>a.ecd&&a.ecd>1.2,'hydraulics: SPP '+a.spp.toFixed(0)+'→'+b.spp.toFixed(0)+' bar, ECD '+a.ecd.toFixed(3)+'→'+b.ecd.toFixed(3));ok(b.spp>150&&b.spp<600,'SPP in field range')}
// --- UI
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const EXT=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}]]){const p=await br.newPage();await p.setViewport(vp);const errs=[];
 p.on('pageerror',e=>errs.push(String(e)));p.on('request',r=>{if(/supabase|adaga|witsml/i.test(r.url()))EXT.push(r.url())});
 await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:180000});await p.waitForFunction(()=>window.GX?.wplan,{timeout:180000});await w(2000);
 await p.evaluate(()=>GX.wplan.open('wgd'));await p.waitForFunction(()=>window.GX?.wpg&&document.getElementById('wgGen'),{timeout:60000});await w(500);
 ok(await p.evaluate(()=>document.querySelectorAll('#wp .wgPlot').length>=3&&/SIM/.test(document.getElementById('wp').textContent)),nm+': Design tab shows 3 plots + SIM label');await p.screenshot({path:`shots_live/130_wpg_${nm}_1_design.png`});
 await p.evaluate(()=>document.querySelector('#wp [data-mode=ml]').click());await w(400);await p.evaluate(()=>document.getElementById('wgApply').click());await w(800);
 const td=await p.evaluate(()=>GX.wpg.G.D.td);ok(await p.evaluate(()=>GX.wpg.G.LAT.length==2&&Math.abs(GX.wpg.G.D.td-(window.__W=GX.wpg.G.D.td))<1),nm+': multilateral with 2 laterals; plan applied TD '+td.toFixed(0));
 for(const [t,sel,n] of [['wge','#wgSFT','2_sf'],['wge','#wgTC svg','2b_tcyl'],['wgp','.wgPlot','3_tnd'],['wgv','.wgPlot','5_mw'],['wga','#wgAFE','8_afe']]){await p.evaluate(t=>GX.wplan.open(t),t);await p.waitForSelector('#wp '+sel,{timeout:60000});await w(600);await p.screenshot({path:`shots_live/130_wpg_${nm}_${n}.png`});ok(true,nm+': tab '+t+' renders')}
 for(const [t,sub,n] of [['wgp','phys:broom','4_broom'],['wgp','phys:buck','4b_buck'],['wgp','phys:rop','4c_rop'],['wgp','phys:vib','4d_vib'],['wgp','phys:str','4e_str'],['wgv','env:temp','6_temp'],['wgv','env:hook','7_hook'],['wgv','env:stuck','7b_stuck'],['wgv','env:hyd','7c_hyd']]){await p.evaluate(t=>GX.wplan.open(t),t);await w(300);await p.evaluate(s=>document.querySelector(`#wp [data-sub="${s}"]`).click(),sub);await w(700);await p.evaluate(()=>document.querySelector('#wp .wgPlot,#wp #wgWI')?.scrollIntoView({block:'center'}));await w(200);
  ok(await p.evaluate(()=>document.querySelectorAll('#wp .wgPlot,#wp #wgWI,#wp table').length>0),nm+': '+sub+' renders');await p.screenshot({path:`shots_live/130_wpg_${nm}_${n}.png`})}
 {const r=await p.evaluate(()=>{const g=GX.wpg,o=g.G.ph.ffOH;g.G.ph.ffOH=0.27;const h=g.hookload(99999,'pooh').hookKN;g.G.ph.ffOH=o;const c=g.ffCalib(99999,h,'pooh'),h2=g.hookload(99999,'rih').hookKN,c2=g.ffCalib(99999,h2,'rih');return [c.ff,c2.ff,o]});ok(Math.abs(r[0]-0.27)<0.01,'FF calibration from POOH hookload recovers 0.27 ('+r[0]?.toFixed(3)+')');ok(Math.abs(r[1]-r[2])<0.01,'FF calibration from RIH hookload recovers '+r[2]);}
 const hk=await p.evaluate(()=>GX.wpg.hookload(1500,'pooh'));ok(hk&&hk.hookKN>200&&hk.tag=='SIM','GX.wpg.hookload(1500) '+hk?.hookKN?.toFixed(0)+' kN SIM');
 const lab=await p.evaluate(()=>/LIVE/.test(document.getElementById('wp').textContent));ok(!lab,nm+': no LIVE label on SIM data');
 if(nm=='phone')ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'phone: no page side scroll');
 ok(!errs.length,nm+': no page errors '+errs.slice(0,2).join(' | '));await p.close()}
ok(!EXT.length,'no network to Supabase/Adaga/WITSML');await br.close();console.log(`\n${pass} pass, ${fail} fail`);process.exit(fail?1:0)
