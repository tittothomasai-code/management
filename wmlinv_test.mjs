// v5.9.2.3 whole-well inventory test — MOCKED proxy only (no Adaga/WITSML network). Fixtures for every object type, unsupported types,
// a GetCap that omits some types, a transient 503 (retry with backoff), datums (RKB/GL), site view + anti-collision, and a 401 stop.
import puppeteer from 'puppeteer-core';import * as AC from './ac.js';
const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/124_wmlinv_';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const PX='https://mock-proxy.invalid/soap',NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';let log=[],flaky=1,dead=false;
const CAP=`<capServers ${NS}><capServer apiVers="1.4.1"><function name="WMLS_GetFromStore">${['well','wellbore','trajectory','log','mudLog','bhaRun','tubular','rig','wbGeometry','fluidsReport','opsReport','message','risk','attachment'].map(t=>`<dataObject>${t}</dataObject>`).join('')}</function></capServer></capServers>`;// formationMarker + cementJob NOT advertised
const W=(t,inner,wb='WB1',uid='o1',well='W1')=>`<${t} uidWell="${well}" uidWellbore="${wb}" uid="${uid}">${inner}<commonData><dTimLastChange>2026-10-29T10:00:00Z</dTimLastChange></commonData></${t}>`;const S=(t,x)=>`<${t}s ${NS}>${x}</${t}s>`;
const st=(n,kick=0)=>Array.from({length:n},(_,i)=>`<trajectoryStation uid="s${i}"><md uom="m">${i*100}</md><incl uom="dega">${i>3?kick:0}</incl><azi uom="dega">90</azi></trajectoryStation>`).join('');
const FX={trajectory:wb=>W('trajectory','<name>Definitive</name><mdMn uom="m">0</mdMn><mdMx uom="m">2450</mdMx>',wb),
 log:wb=>W('log','<name>Time 1s</name><indexType>date time</indexType><startDateTimeIndex>2026-10-28T00:00:00Z</startDateTimeIndex><endDateTimeIndex>2026-10-29T09:00:00Z</endDateTimeIndex><logCurveInfo uid="a"><mnemonic>HKLD</mnemonic></logCurveInfo><logCurveInfo uid="b"><mnemonic>SPM1</mnemonic></logCurveInfo>',wb,'lt')+W('log','<name>Depth 0.1m</name><indexType>measured depth</indexType><startIndex uom="ft">1000</startIndex><endIndex uom="ft">8000</endIndex><logCurveInfo uid="a"><mnemonic>GR</mnemonic></logCurveInfo>',wb,'ld'),
 mudLog:wb=>W('mudLog','<name>Mud log</name><startMd uom="m">500</startMd><endMd uom="m">2400</endMd>',wb),
 bhaRun:wb=>W('bhaRun','<name>BHA #3</name><dTimStart>2026-10-27T00:00:00Z</dTimStart>',wb),
 tubular:wb=>W('tubular','<name>8.5in RSS BHA</name><tubularComponent uid="c1"><typeTubularComp>bit</typeTubularComp><sequence>1</sequence><len uom="m">0.3</len><od uom="in">8.5</od></tubularComponent><tubularComponent uid="c2"><typeTubularComp>RSS</typeTubularComp><sequence>2</sequence><len uom="ft">20</len><od uom="in">6.75</od></tubularComponent>',wb),
 rig:wb=>W('rig','<name>Rig 7</name>',wb),wbGeometry:wb=>W('wbGeometry','<name>Casing</name><wbGeometrySection uid="g1"><typeHoleCasing>casing</typeHoleCasing><mdTop uom="m">0</mdTop><mdBottom uom="ft">3280.84</mdBottom><odSection uom="in">13.375</odSection><idSection uom="in">12.415</idSection></wbGeometrySection>',wb),
 fluidsReport:wb=>W('fluidsReport','<name>Mud 1</name><dTim>2026-10-29T06:00:00Z</dTim><md uom="m">2300</md><fluid uid="f"><type>WBM</type><density uom="g/cm3">1.25</density></fluid>',wb),
 opsReport:wb=>W('opsReport','<name>DDR 12</name><dTim>2026-10-29T06:00:00Z</dTim><md uom="m">2300</md><activity uid="a1"><dTimStart>2026-10-29T00:00:00Z</dTimStart><phase>DRILL</phase><md uom="m">2250</md><comments>Drill 8.5in hole</comments></activity>',wb),
 message:wb=>W('message','<name>Gas</name><dTim>2026-10-29T08:00:00Z</dTim><typeMessage>alarm</typeMessage><md uom="m">2310</md><messageText>High gas 4%</messageText><severity>high</severity>',wb),
 risk:wb=>W('risk','<name>Losses</name><category>hydraulics</category><severityLevel>3</severityLevel><mdBitStart uom="m">2200</mdBitStart><summary>Partial losses expected</summary>',wb),
 attachment:()=>''};
function mock({op,wmlType:t,query:q,options:o}){log.push(op+' '+t+' '+o);const R=x=>({result:1,xml:x});if(dead)return {__s:401};
 if(op=='WMLS_GetCap')return {result:1,xml:CAP};
 if(t=='well')return R(S('well',['W1','W2','W3'].map((u,i)=>`<well uid="${u}"><name>${u}</name><wellDatum uid="KB"><code>KB</code><elevation uom="m" datum="GL">${[30,28,30][i]}</elevation></wellDatum><wellDatum uid="GL"><code>GL</code><elevation uom="m">${[5,5,5][i]}</elevation></wellDatum><wellLocation uid="l"><easting uom="m">${500000+i*10}</easting><northing uom="m">7000000</northing></wellLocation></well>`).join('')));
 if(t=='wellbore'){const wl=(/uidWell="([^"]*)"/.exec(q)||[])[1];return R(S('wellbore',(wl=='W1'?['WB1','WB2']:['WB1']).map(u=>`<wellbore uidWell="${wl}" uid="${u}"><name>${wl} ${u}</name></wellbore>`).join('')))}
 if(t=='risk')return {result:-405,supp:'risk not supported'};// advertised but refused → graceful
 if(t=='mudLog'&&/WB2/.test(q))return {__s:500};// persistent 5xx → skipped, not an error state
 if(t=='trajectory'&&/returnElements=all/.test(o)){const wl=(/uidWell="([^"]*)"/.exec(q)||[])[1];if(/uidWellbore="WB2"/.test(q))return R(S('trajectory',''));if(wl=='W1'&&flaky){flaky--;return {__s:503}}return R(S('trajectory',`<trajectory uidWell="${wl}" uidWellbore="WB1" uid="t"><name>Def</name>${st(25,wl=='W2'?0:wl=='W3'?40:0)}</trajectory>`))}
 const wb=(/uidWellbore="([^"]*)"/.exec(q)||[])[1];if(FX[t])return R(S(t,wb=='WB2'&&t!='trajectory'?'':FX[t](wb)));return R('')}
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const bad=[],errs=[];
const p=await b.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith(PX)){if(r.method()=='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});const j=mock(JSON.parse(r.postData()||'{}'));
  if(j.__s)return r.respond({status:j.__s,contentType:'text/plain',headers:{'access-control-allow-origin':'*'},body:j.__s==401?'Unauthorized':'Service Unavailable'});return r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(j)})}
 if(/adaga|witsml\.|supabase\.co|:8796|:8799/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});
await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.witsml&&window.GX?.wmlinv,{timeout:120000});
await p.evaluate(px=>{const X=GX.witsml;X.CFG.proxy=px;X.CFG.proxyPinned=true;X.CFG.url='https://mock-store.invalid/witsml';X.CFG.retryBaseMs=50;X.setCred('mockuser','mock-not-a-secret');X.WML.liveMode=true},PX);
const I=await p.evaluate(async()=>{const I=await GX.wmlinv.INV.inventory('W1',{delayMs:5,force:true});const pick=t=>I.rows.filter(r=>r.type==t).map(r=>({wb:r.wb,n:r.n,st:r.state,mn:r.mdMin,mx:r.mdMax,last:r.last,tag:r.tag}));
 return {stopped:I.stopped,cap:I.capNote,wbs:I.wellbores.length,rows:I.rows.length,calls:I.calls,tag:I.tag,traj:pick('trajectory'),fm:pick('formationMarker'),cem:pick('cementJob'),risk:pick('risk'),mud:pick('mudLog'),logs:GX.wmlinv.INV.logsByIndex(I),msgs:GX.wmlinv.INV.messagesRisks(I).length,
  cas:await GX.wmlinv.INV.useCasing(I),bha:await GX.wmlinv.INV.useBha(I),fl:await GX.wmlinv.INV.useReports(I,'fluidsReport'),ops:await GX.wmlinv.INV.useReports(I,'opsReport'),authDead:GX.witsml.WML.authDead}});
const TY=['trajectory','log','mudLog','formationMarker','bhaRun','tubular','rig','wbGeometry','fluidsReport','opsReport','message','risk','cementJob','attachment'];
ok(log[0].startsWith('WMLS_GetCap'),'GetCap is the first call');ok(I.wbs==2&&I.rows==2*TY.length,'all '+TY.length+' types × 2 wellbores inventoried ('+I.rows+' rows)');
ok(TY.every(t=>log.some(l=>l.includes(' '+t+' '))||['formationMarker','cementJob'].includes(t)),'every advertised type queried');ok(!log.some(l=>/ (formationMarker|cementJob) /.test(l)),'types missing from GetCap are not queried');
ok(I.fm.every(r=>/not supported/.test(r.st))&&I.cem.every(r=>/not supported/.test(r.st)),'formationMarker/cementJob: "not supported by server (GetCap)"');ok(I.risk.every(r=>/not supported by server/.test(r.st)),'risk -405 → "not supported", not an error');
ok(/skipped/.test(I.mud.find(r=>r.wb=='WB2').st)&&!I.stopped&&!I.authDead,'persistent HTTP 500 → row skipped, scan continues, no auth latch');
ok(log.filter(l=>/GetFromStore (trajectory|log|bhaRun|tubular|rig|wbGeometry|fluidsReport|opsReport|message|attachment|mudLog) /.test(l)).slice(0,20).every(l=>/returnElements=requested/.test(l)),'inventory queries are header-only (returnElements=requested), no bulk data');
const t1=I.traj.find(r=>r.wb=='WB1');ok(t1.n==1&&t1.mn==0&&t1.mx==2450&&t1.tag=='LIVE'&&/2026-10-29/.test(t1.last),'trajectory row: count, MD 0–2450 m, last date, LIVE');
ok(I.logs.depth.length==1&&Math.abs(I.logs.depth[0].to-2438.4)<0.1&&I.logs.time.length==1&&I.logs.time[0].curves==2,'depth log (ft→m 2438.4) and time log separated');
ok(I.cas.length==1&&Math.abs(I.cas[0].bot-1000)<0.01&&Math.abs(I.cas[0].od-0.339725)<1e-4,'casing from wbGeometry: shoe 1000 m, OD 339.7 mm');
ok(I.bha.assemblies[0].comps.length==2&&Math.abs(I.bha.assemblies[0].comps[1].len-6.096)<0.01&&I.bha.runs.length==1,'BHA from tubular (2 comps, ft→m) + bhaRun');
ok(Math.abs(I.fl[0].fluids[0].dens-1250)<1&&I.ops[0].activities[0].code=='DRILL','fluids 1250 kg/m³ and ops activity');ok(I.msgs==1,'messages/risks list (risk unsupported → 1 message)');
await p.evaluate(()=>{const X=GX.witsml.CFG;X.url='https://mock-store.invalid/sim/witsml'});const tg=await p.evaluate(async()=>(await GX.wmlinv.INV.inventory('W1',{delayMs:0,force:true})).tag);ok(tg=='SIM-TEST','simulated store tagged SIM-TEST, never LIVE');
await p.evaluate(()=>{GX.witsml.CFG.url='https://mock-store.invalid/witsml'});
// datum + site view
const D=await p.evaluate(()=>{const ds=[{uid:'KB',code:'KB',elev:30,ref:'GL'},{uid:'GL',code:'GL',elev:5}];return {kb:GX.wmlinv.INV.datumElev(ds,'KB'),sh:GX.wmlinv.INV.datumShift(ds,'KB','GL')}});ok(D.kb==35&&D.sh==-30,'RKB/GL datum chain: KB 35 m above MSL, KB→GL shift −30 m');
log=[];const SV=await p.evaluate(async()=>{const s=await GX.wmlinv.INV.siteView({delayMs:5});return {n:s.wbs.length,ref:s.siteDatumElev,dz:s.wbs.map(x=>x.pts.at(-1).Z),E:s.wbs.map(x=>x.pts[0].E),flags:s.ac.flags.map(f=>[f.a,f.b,+f.sf.toFixed(2),f.flag]),retries:GX.witsml.WML.retries||0}});console.log(JSON.stringify(SV));
ok(SV.n==3&&SV.E.join()=='0,10,20','site view: 3 wells on common site frame (slots 0/10/20 m E)');ok(SV.ref==35&&Math.abs(SV.dz[1]-(SV.dz[0]+2))<0.2,'site datum = highest KB (35 m); W2 (KB 33 m) TVD shifted +2 m below site datum');
ok(SV.retries>=1&&!log.some(l=>/GetFromStore trajectory/.test(l))||SV.retries>=1,'transient 503 on W1 trajectory retried with backoff (retries '+SV.retries+')');
ok(SV.flags.some(f=>f[0]==0&&f[1]==1&&f[3]=='STOP <1.0'),'anti-collision: W1↔W2 (10 m apart, vertical) flagged SF < 1.0');
// UI
await p.evaluate(()=>{GX.wmlinv.ST.I=null});await p.evaluate(()=>GX.wmlinv.run('W1',true));await p.evaluate(()=>GX.wmlinv.open());await w(1800);ok(await p.evaluate(()=>{const e=document.getElementById('wmlinv');return getComputedStyle(e).display!='none'&&e.getBoundingClientRect().height>0}),'panel visible after open');await p.screenshot({path:SH+'1_inventory.png'});
const tabs=[['traj','2_traj'],['logs','3_logs'],['cas','4_casing'],['bha','5_bha'],['fl','6_fluids'],['ops','7_ops'],['msg','8_msgs']];
for(const [t,n] of tabs){await p.evaluate(t=>{GX.wmlinv.ST.tab=t;GX.wmlinv.render()},t);await w(1500);await p.screenshot({path:SH+n+'.png'})}
const txt=await p.evaluate(()=>document.getElementById('wmlinv').innerText);ok(/High gas 4%/.test(txt),'Msgs tab renders message');
await p.evaluate(()=>{GX.wmlinv.ST.tab='site';GX.wmlinv.render();document.getElementById('ivsite').click()});await w(3000);await p.screenshot({path:SH+'9_site.png'});ok(/SF 0\.\d+ \(STOP/.test(await p.evaluate(()=>document.getElementById('wmlinv').innerText)),'Site tab shows AC flag');
await p.evaluate(()=>GX.wmlinv.render());
// 401 stops everything
dead=true;log=[];const A=await p.evaluate(async()=>{const I=await GX.wmlinv.INV.inventory('W1',{delayMs:0,force:true});return {st:I.stopped,dead:GX.witsml.WML.authDead}});ok(/401/.test(A.st)&&A.dead&&log.length<=2,'HTTP 401 → stopped immediately ('+log.length+' calls), auth latched, no retry');
ok(bad.length==0,'no Adaga/real WITSML requests');ok(errs.length==0,'no page errors '+errs.slice(0,2).join('|'));
// unit: AC
const v=[{md:0,inc:0,azi:0},{md:1000,inc:0,azi:0}];const P=AC.minCurvM(v).map(q=>({md:q.md,E:q.ew,N:q.ns,Z:q.tvd}));ok(AC.pair({pts:P},{pts:P.map(q=>({...q,E:q.E+50}))}).sf>1.5,'AC: 50 m apart at 1000 m → SF > 1.5');
await b.close();console.log(`wmlinv ${pass} pass, ${fails} fail`);process.exit(fails?1:0)
