// v5.9.2.2 WITSML 1.4.1.1 correctness + well profile test. Fixtures are hand-made WITSML 1.4.1.1 XML (metres/feet, dega/rad, missing tvd, tie-in,
// magnetic/grid refs, duplicate station uid, out-of-order, null values). Reference = analytic circular arc (min curvature is exact on an arc) to 0.01 m.
// No network: pure functions in node + parser in the page (no Adaga/WITSML requests).
import puppeteer from 'puppeteer-core';import * as GG from './geo.js';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,'');let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const FT=0.3048,D=Math.PI/180,Rr=30/(3*D);// 3°/30 m build from surface, azimuth 45° grid
const ref=md=>{const th=md/Rr;const hd=Rr*(1-Math.cos(th));return {tvd:Rr*Math.sin(th),ns:hd*Math.cos(45*D),ew:hd*Math.sin(45*D),hd,inc:th/D}};
const near=(a,b,t=0.01)=>Math.abs(a-b)<=t;
// ---- A: node, minimum curvature vs analytic (metres) ----
const mds=[];for(let m=30;m<=900;m+=30)mds.push(m);
const stM=mds.map(m=>({md:m/FT,inc:ref(m).inc,azi:45}));
let c=GG.minCurvStations(stM,{vsAzi:45});let worst=0;for(const x of c.filter(x=>!x.virtual)){const r=ref(x.md*FT);worst=Math.max(worst,Math.abs(x.tvd*FT-r.tvd),Math.abs(x.ns*FT-r.ns),Math.abs(x.ew*FT-r.ew),Math.abs(x.vs*FT-r.hd))}
ok(worst<0.01,'A1 surface tie-in (MD 0, inc 0) + min curvature matches analytic arc to '+worst.toExponential(2)+' m (TVD/NS/EW/VS, 30 stations to 900 m)');
ok(c[0].virtual&&c[0].md==0&&c[0].tie=='surface','A2 first station MD 30 m → surface tie point added, no straight-line md·cos(inc) guess');
ok(c.slice(2).every(x=>near(x.dls*30/(100*FT),3,1e-6)),'A3 DLS = 3.000 °/30 m on every interval');
const r300=ref(300),deep=stM.filter(x=>x.md*FT>=300).map((x,i)=>i?x:{...x,tvd_rep:r300.tvd/FT,ns_rep:r300.ns/FT,ew_rep:r300.ew/FT});
c=GG.minCurvStations(deep,{vsAzi:45});worst=0;for(const x of c){const r=ref(x.md*FT);worst=Math.max(worst,Math.abs(x.tvd*FT-r.tvd),Math.abs(x.ns*FT-r.ns),Math.abs(x.ew*FT-r.ew))}
ok(worst<0.01&&/reported TVD\/NS\/EW/.test(c[0].tie),'A4 deep tie-in at reported TVD/NS/EW (MD 300 m) → exact to '+worst.toExponential(2)+' m');
c=GG.minCurvStations(stM);ok(near(c.at(-1).vsAziUsed,45,1e-9)&&/closure/.test(c[0].vsSrc),'A5 no plan/trajectory VS azimuth → closure azimuth, labelled');
c=GG.minCurvStations(stM.map(x=>({...x,tvd_rep:ref(x.md*FT).tvd/FT+(Math.abs(x.md*FT-600)<1?2/FT:0)})),{vsAzi:45});
const fl=c.filter(x=>x.tvdFlag);ok(fl.length==1&&near(fl[0].md*FT,600,1e-6)&&near(-fl[0].dTvd*FT,2,0.01),'A6 server TVD vs computed: 2 m mismatch at MD 600 flagged, others agree');
// ---- B: page, WITSML parser semantics ----
const st=(rows,o={})=>rows.map(([u,md,inc,azi,tvd,t,typ],i)=>`<trajectoryStation uid="${u}">${t?`<dTimStn>${t}</dTimStn>`:''}${typ?`<typeTrajStation>${typ}</typeTrajStation>`:''}<md uom="${o.lu||'m'}" datum="RKB">${md}</md>${tvd!=null?`<tvd uom="${o.lu||'m'}" datum="RKB">${tvd}</tvd>`:''}<incl uom="${o.au||'dega'}">${inc}</incl><azi uom="${o.au||'dega'}">${azi}</azi>${o.disp&&i==0?`<dispNs uom="${o.lu||'m'}">${o.disp[0]}</dispNs><dispEw uom="${o.lu||'m'}">${o.disp[1]}</dispEw>`:''}</trajectoryStation>`).join('');
const T=(body,hdr='')=>`<?xml version="1.0"?><trajectorys xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><trajectory uidWell="W1" uidWellbore="WB1" uid="T1"><nameWell>W1</nameWell><name>Survey - Directional</name>${hdr}${body}</trajectory></trajectorys>`;
const arcRows=(f=m=>m,au='dega',lu='m')=>mds.map((m,i)=>{const r=ref(m);const k=lu=='ft'?1/FT:1;const a=v=>au=='rad'?(v*D).toFixed(10):v.toFixed(8);return ['s'+i,(m*k).toFixed(6),a(r.inc),a(f(45)),(r.tvd*k).toFixed(6),'2026-10-30T0'+(i%9)+':00:00Z']});
const FX={
 metres:T(st(arcRows()),'<aziRef>grid north</aziRef>'),
 feetRad:T(st(arcRows(m=>m,'rad','ft').map(r=>[...r.slice(0,4),null,r[5]]),{lu:'ft',au:'rad'}),'<aziRef>grid north</aziRef>'),
 magnetic:T(st(arcRows(a=>a-2+1)),'<aziRef>magnetic north</aziRef><magDeclUsed uom="dega">2</magDeclUsed><gridCorUsed uom="dega">1</gridCorUsed><aziVertSect uom="dega">44</aziVertSect>'),
 dupOrder:T(st([['a',60,ref(60).inc,45,null,'2026-10-30T01:00:00Z'],['b',30,ref(30).inc,45,null,'2026-10-30T00:00:00Z'],['a',60,ref(60).inc,45,null,'2026-10-30T02:00:00Z'],['c',90,ref(90).inc,45,null,'2026-10-30T03:00:00Z']]),'<aziRef>grid north</aziRef>'),
 tieIn:T(st(arcRows().slice(9).map((r,i)=>i?r:[...r.slice(0,6),'tie in point']),{disp:[ref(300).ns.toFixed(6),ref(300).ew.toFixed(6)]}),'<aziRef>grid north</aziRef>')};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const bad=[];
const p=await b.newPage();await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|witsml\.|supabase\.co|:8796|:8799/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});
await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.witsml?.svParse&&window.GEO?.appendStations,{timeout:120000});
const P=await p.evaluate(async FX=>{const X=GX.witsml,G=await import('./geo.js'),o={};for(const k in FX){const s=X.svParse(FX[k]);const c=G.minCurvStations(s,{vsAzi:s.find(x=>isFinite(x.vsAzi))?.vsAzi});o[k]={n:s.length,uids:s.map(x=>x.uid),azi:s.map(x=>x.azi),ref:s[0]?.ref,note:s[0]?.refNote,tie:c[0]?.tie,virt:!!c[0]?.virtual,vsAzi:c[0]?.vsAziUsed,datum:s[0]?.datum,typ:s[0]?.typ,calc:c.map(x=>({md:x.md,tvd:x.tvd,ns:x.ns,ew:x.ew,vs:x.vs,f:!!x.tvdFlag,v:!!x.virtual}))}}
 const m=await import('./ext4.js?v=593');o.nul=[m.wmlVal('-999.25','',' -999.25'),m.wmlVal('-999.25','','-999.25'),m.wmlVal('','',''),m.wmlVal('12.5','-999.25','-999.25'),m.wmlVal('9999','9999','-999.25'),m.wmlVal('abc','','')];return o},FX);
const chk=(k,lab)=>{const o=P[k];let w=0;for(const x of o.calc.filter(x=>!x.v)){const r=ref(x.md*FT);w=Math.max(w,Math.abs(x.tvd*FT-r.tvd),Math.abs(x.ns*FT-r.ns),Math.abs(x.ew*FT-r.ew))}ok(w<0.01,lab+' → profile within '+w.toExponential(2)+' m of reference');return w};
chk('metres','B1 metres/dega/grid north');ok(P.metres.ref=='grid north'&&P.metres.datum=='RKB','B1 north ref + MD datum (RKB) carried');ok(!P.metres.calc.some(x=>x.f),'B1 server TVD agrees with min-curvature TVD (no flags)');
chk('feetRad','B2 feet + radians, no server TVD');ok(P.feetRad.virt,'B2 missing TVD → surface tie-in, not vertical assumption');
chk('magnetic','B3 magnetic north + declination 2° + convergence 1° → grid');ok(P.magnetic.ref=='grid north'&&P.magnetic.azi.every(a=>near(a,45,1e-6))&&/declination 2\.000.*convergence 1\.000/.test(P.magnetic.note),'B3 azimuth corrected magnetic→true→grid: '+P.magnetic.note);
ok(near(P.magnetic.vsAzi,44+2-1,1e-9),'B3 trajectory aziVertSect (magnetic 44°) used as VS azimuth, same correction → 45° grid');
ok(P.dupOrder.n==3&&P.dupOrder.uids.join()=='b,a,c','B4 duplicate station uid deduped (latest dTimStn), sorted by MD: '+P.dupOrder.uids.join());
chk('tieIn','B5 trajectory starting at a "tie in point" (MD 300 m, tvd + dispNs/dispEw)');ok(/reported TVD\/NS\/EW/.test(P.tieIn.tie)&&P.tieIn.typ=='tie in point','B5 tie-in from reported TVD/NS/EW, typeTrajStation read');
ok(JSON.stringify(P.nul)==JSON.stringify([null,null,null,12.5,null,null]),'C log data: log nullValue, curve nullValue, empty, non-numeric → null; real values kept '+JSON.stringify(P.nul));
ok(bad.length==0,'no Adaga/WITSML requests');await b.close();console.log(`wml ${pass} pass, ${fails} fail`);process.exit(fails?1:0)
