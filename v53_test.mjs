// v5.3: roof/floor AUTO-PICK (4-quadrant gamma + Kalman/RTS) vs Doug's BL ROOF/FLOOR (pixel-digitised from the WestSide report, SIM-TEST).
// NO real quadrant gamma exists yet: everything here is SIM-TEST (synthetic or mock WITSML). NO Adaga calls.
import fs from 'fs';import puppeteer from 'puppeteer-core';import * as GG from './geo.js';import * as K9 from './ext9.js';import * as Q from './ext11.js';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};const M=0.3048,w=ms=>new Promise(r=>setTimeout(r,ms));
const F=JSON.parse(fs.readFileSync('fixtures/westside_dr101l_wb01b02_2879.json')),D=JSON.parse(fs.readFileSync('fixtures/westside_roof_floor_2879.json'));
ok(/SIM-TEST/.test(D.label)&&/transcribed/.test(D.label)&&D.points.length>50,'Doug reference labelled SIM-TEST / transcribed: '+D.points.length+' digitised columns');
const th=D.points.map(p=>p.floor-p.roof);console.log('Doug band thickness',Math.min(...th).toFixed(2),'–',Math.max(...th).toFixed(2));
// 1. mnemonic finder
const f1=Q.findQuad(['DEPT','GMHQ','GMLQ','GMRQ','GMDQ','GMUQ','GMAVG','MG']);ok(f1.up=='GMUQ'&&f1.dn=='GMDQ'&&f1.lt=='GMLQ'&&f1.rt=='GMRQ'&&f1.avg=='GMAVG','report track names → up GMUQ, dn GMDQ, lt GMLQ, rt GMRQ, avg GMAVG');
const f2=Q.findQuad(['DEPTH','GR_UP','GR_DN','GR_LT','GR_RT']),f3=Q.findQuad(['GMUP','GMDN','GMLT','GMRT']),f4=Q.findQuad(['GRU','GRD','GRL','GRR']);ok(f2.ok&&f3.ok&&f4.ok&&f3.rt=='GMRT'&&f4.dn=='GRD','GR_UP/GMUP/GRU families');
const f5=Q.findQuad(['X1','X2','X3','X4'],'up=X3,dn=X1,lt=X2,rt=X4');ok(f5.ok&&f5.up=='X3'&&f5.src.up=='manual','manual mapping for unknown names');
// 2. Otsu
const ot=Q.otsu([...Array(300)].map((_,i)=>i%3?115+Math.sin(i)*5:40+Math.cos(i)*4));ok(ot.cut>50&&ot.cut<105&&Math.abs(ot.lo-40)<5&&Math.abs(ot.hi-115)<6,'bimodal cutoff '+ot.cut.toFixed(0)+' (modes '+ot.lo.toFixed(0)+'/'+ot.hi.toFixed(0)+')');
// 3. synthetic 4-quadrant gamma along the report trajectory
const st=F.stations.map((r,i)=>({md:r[0]/M,inc:r[1],azi:r[2],...(i?{}:{tvd_rep:(r[3]+F.elevation_m)/M})}));const calc=GG.minCurvStations(st);let hd=0;const cu=calc.map((p,i)=>{if(i){const q=calc[i-1];hd+=Math.hypot(p.ns-q.ns,p.ew-q.ew)*M}return {hd,tvd:p.tvd*M,md:p.md*M}});
const refs=Q.dougToCurtain(D.points.map(p=>({md:p.hpl+D.hplToMd,roof:p.roof,floor:p.floor})),cu,F.elevation_m,K9);const RES={};
for(const [name,thk,pri] of [['doug3m',null,2],['report2m',2.0,2],['seam1.2m',1.2,3],['seam1.5m',1.5,3]]){const S=Q.synthQuad(cu,Q.seamFrom(refs,thk),{K9,seed:11});const A=Q.autoPick(S,{K9,thPrior:pri});const R=thk?refs.map(r=>({...r,floor:r.roof+thk})):refs;const c=Q.compareDoug(A.K,R,K9,0.3);
 const g=A.K.grid.filter(p=>p.hd>=refs[0].hd),thm=g.reduce((s,p)=>s+p.thick,0)/g.length;RES[name]={nT:A.nT,nB:A.nB,src:A.thickSrc,roof:c.roof,floor:c.floor,thick:thm,lr:A.q.lr,cut:A.q.cut};console.log(name,JSON.stringify(RES[name]))}
ok(RES.doug3m.roof.rms<0.15&&RES.doug3m.roof.agree>=0.9,'Doug-shaped seam: roof recovered from up-quadrant, RMS '+RES.doug3m.roof.rms.toFixed(2)+' m, '+Math.round(100*RES.doug3m.roof.agree)+'% within 2σ');
ok(RES.doug3m.nB==0&&/PRIOR/.test(RES.doug3m.src),'Doug-shaped 3 m seam: floor out of quadrant reach → thickness = PRIOR, stated ("'+RES.doug3m.src+'")');
ok(RES['seam1.2m'].nB>10&&/MEASURED/.test(RES['seam1.2m'].src)&&RES['seam1.2m'].floor.rms<0.2&&Math.abs(RES['seam1.2m'].thick-1.2)<0.25,'1.2 m seam: floor measured without crossing it (prior 3 m ignored): floor RMS '+RES['seam1.2m'].floor.rms.toFixed(2)+', mean thickness '+RES['seam1.2m'].thick.toFixed(2)+' m');
ok(RES['seam1.5m'].floor.rms<0.2,'1.5 m seam: floor RMS '+RES['seam1.5m'].floor.rms.toFixed(2)+' m, thickness '+RES['seam1.5m'].thick.toFixed(2)+' ('+RES['seam1.5m'].src+')');
ok(RES.doug3m.lr.ok==RES.doug3m.lr.n&&RES.doug3m.lr.okOut==RES.doug3m.lr.nOut,'left/right check consistent with average gamma');
fs.writeFileSync('/tmp/v53_res.json',JSON.stringify(RES,null,1));
// 4. browser
const BASE='http://localhost:8777',MOCK='http://127.0.0.1:8799',PROXY='http://localhost:8796/soap',SH='shots_live/101_v53_';const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>{if(/adaga|netlify\.app|supabase\.co/i.test(r.url()))r.abort();else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});await p.goto(BASE+'/index.html?'+Date.now());await p.evaluate(()=>{localStorage.clear()});await p.reload();await w(9000);
await p.click('#g8btn');await w(800);await p.click('#r53btn');await p.click('#r53syn');await w(4000);
const B1=await p.evaluate(()=>({t:document.getElementById('r53o').innerText,n:Q53.refs?.length,cmp:Q53.cmp&&{r:Q53.cmp.roof,f:Q53.cmp.floor}}));console.log(JSON.stringify(B1));
ok(/Auto-picked \(filter\)/.test(B1.t)&&/SIM-TEST/.test(B1.t)&&/PRIOR/.test(B1.t)&&B1.cmp?.r?.rms<0.2,'in-app SIM-TEST run: labelled, roof RMS vs Doug '+B1.cmp?.r?.rms?.toFixed(2)+', thickness prior stated');
await p.evaluate(()=>document.getElementById('r53c').scrollIntoView());await p.screenshot({path:SH+'1_autopick_vs_doug.png'});await p.evaluate(()=>document.getElementById('r53').scrollIntoView());await p.screenshot({path:SH+'2_panel_numbers.png'});
await p.click('#r53syn2');await w(2500);const B2=await p.evaluate(()=>document.getElementById('r53o').innerText);ok(/MEASURED/.test(B2),'1.2 m seam in app: thickness MEASURED');await p.evaluate(()=>document.getElementById('r53c').scrollIntoView());await p.screenshot({path:SH+'3_thin_seam_measured.png'});
// 5. mock WITSML: quadrant mnemonics found across logs + filter on them
await fetch(MOCK+'/ctl/fmt?f=plain').catch(()=>{});
await p.evaluate((m,px)=>{const X=GX.witsml;X.CFG.proxy=px;X.CFG.url=m+'/witsml';X.setCred('simtest','dummy-not-a-secret');X.open();X.WML.liveMode=true},MOCK,PROXY);await w(1500);
await p.evaluate(async()=>{await GX.witsml.loadWell('DR101L','WB01B02')});await w(4000);await p.evaluate(async()=>{await GX.geo8.load()});await w(1500);
const L=await p.evaluate(()=>{const G=GX.geo8.G8;return {scan:(G.quadScan||[]).map(s=>s.log+':'+(s.f.ok?s.f.up+'/'+s.f.dn+'/'+s.f.lt+'/'+s.f.rt+'/'+s.f.avg:'none')),q:G.quad&&{log:G.quad.log,n:G.quad.rows.length},err:G.quadErr}});console.log(JSON.stringify(L));
ok(L.q&&L.q.n>100&&L.scan.some(s=>/GMUQ\/GMDQ\/GMLQ\/GMRQ\/GMAVG/.test(s)),'mock WITSML: quadrant curves found by mnemonic scan of all logs ('+L.q?.log+', '+L.q?.n+' rows)');
const R5=await p.evaluate(()=>{const r=GX.q53.runLive();return {t:document.getElementById('r53o').innerText,dbg:document.getElementById('r53dbg').innerText.slice(0,400),nT:r?.A?.nT,nB:r?.A?.nB,e:r?.A?.K?.grid.at(-1)}});console.log(JSON.stringify(R5));
ok(/SIM-TEST quadrant gamma/.test(R5.t)&&R5.nT>0&&R5.nB>0&&/GMUQ/.test(R5.dbg),'mock quadrant gamma through the filter: '+R5.nT+' roof / '+R5.nB+' floor obs; mnemonics shown in debug');
await p.evaluate(()=>{document.getElementById('r53').scrollIntoView()});await p.screenshot({path:SH+'4_mock_witsml_quadrants.png'});await p.evaluate(()=>document.getElementById('r53dbg').scrollIntoView());await p.screenshot({path:SH+'5_mnemonics_debug.png'});
ok(!errs.length,'no page errors '+errs.join('|').slice(0,300));console.log('FAILURES',fails);await b.close();process.exit(fails?1:0);
