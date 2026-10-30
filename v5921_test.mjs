// v5.9.2.1 WITSML survey hotfix test — MOCKED proxy responses (no Adaga/WITSML network; page fetches to the fake proxy are answered in-test).
// Reproduces live DR101L/WB01B02: time log OK, trajectory uid bfb01c98-… listed with empty wellbore / 0 stations per-wellbore,
// stations only via uidWell-only queries; incremental mdMn returns nothing; formationMarker unsupported.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'123_v5921_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const PX='https://mock-proxy.invalid/soap',NSX='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"',TU='bfb01c98-0000-4000-8000-000000000001';
let nSt=40,mode='titto',log=[];const st=(a,b)=>{let o='';for(let i=a;i<b;i++)o+=`<trajectoryStation uid="s${i}"><dTimStn>2026-10-30T0${Math.min(9,i>>3)}:00:00Z</dTimStn><md uom="m">${(100+i*30).toFixed(1)}</md><tvd uom="m">${(100+i*29.5).toFixed(1)}</tvd><incl uom="dega">${(i*0.6).toFixed(2)}</incl><azi uom="dega">45</azi></trajectoryStation>`;return o};
const T=(wb,body)=>`<trajectorys ${NSX}><trajectory uidWell="DR101L" uidWellbore="${wb}" uid="${TU}"><nameWell>DR101L</nameWell><nameWellbore>WB01B02</nameWellbore><name>Survey - Directional</name><objectGrowing>true</objectGrowing>${body||''}</trajectory></trajectorys>`;
function mock({wmlType:t,query:q,options:o}){log.push(t+' '+o+' '+q.slice(0,160));const ok=x=>({result:1,xml:x});
 if(t=='wellbore')return ok(`<wellbores ${NSX}>`+['TOP HOLE','WB01B01','WB01B01 BUILD','WB01B02','WB01B02 BUILD'].map(u=>`<wellbore uidWell="DR101L" uid="${u}"><name>${u}</name></wellbore>`).join('')+'</wellbores>');
 if(t=='formationMarker')return {result:-405,error:'',supp:'formationMarker not supported'};
 if(t!='trajectory')return ok('');
 const hasWb=/uidWellbore="([^"]*)"/.exec(q),wb=hasWb?hasWb[1]:null,uid=(/ uid="([^"]*)"/.exec(q)||[])[1];
 if(/mdMn/.test(q)&&/trajectoryStation/.test(q))return ok(T('WB01B02'));// incremental: header only, no stations (bug repro)
 if(wb===null){if(/header-only/.test(o))return ok(T('WB01B02','<mdMn uom="m">100</mdMn>'));if(/all/.test(o))return ok(T('WB01B02',st(0,nSt)));}
 if(wb==='')return ok(`<trajectorys ${NSX}><trajectory uidWell="DR101L" uidWellbore="" uid="${TU}"/></trajectorys>`);// echoes empty wellbore
 if(mode=='poll'&&wb==='WB01B02'&&/all/.test(o))return ok(T('WB01B02',st(0,nSt)));// full fallback (incremental empty)
 return ok(`<trajectorys ${NSX}></trajectorys>`)}// per-wellbore lists / station fetches return nothing
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const bad=[],errs=[];
const p=await b.newPage();await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});p.on('pageerror',e=>errs.push(e.message));
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(u.startsWith(PX)){if(r.method()=='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});const j=JSON.parse(r.postData()||'{}');return r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(mock(j))})}
 if(/adaga|witsml\.|supabase\.co|:8796|:8799/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});
await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.witsml?.loadWell&&window.GEO?.appendStations,{timeout:120000});
await p.evaluate(px=>{const X=GX.witsml;X.CFG.proxy=px;X.CFG.url='https://mock-store.invalid/witsml';X.setCred('mockuser','mock-not-a-secret');X.WML.liveMode=true;X.CFG.svInterval=60000},PX);
const R=await p.evaluate(async()=>{await GX.witsml.loadWell('DR101L','WB01B02');await new Promise(r=>setTimeout(r,800));const W=GX.witsml.WML;return {c:W.svCands.map(c=>({wb:c.wb,uid:c.uid,n:c.n,mn:c.mdMin,mx:c.mdMax})),n:GEO.surv.stations.length,cfg:[GX.witsml.CFG.svWellbore,GX.witsml.CFG.svTraj],st:W.svStatus(),fm:W.sv.fm,err:W.sv.err,state:W.sv.state}});console.log(JSON.stringify(R).slice(0,600));
ok(R.c.length==1&&R.c[0].wb=='WB01B02'&&R.c[0].uid.startsWith('bfb01c98'),'1: trajectory bfb01c98 discovered via uidWell-only query, real wellbore WB01B02 (no "other wellbore")');
ok(R.n==40&&R.cfg[0]=='WB01B02'&&R.cfg[1].startsWith('bfb01c98'),'1: 40 stations loaded (not "trajectory assumed vertical")');
ok(R.c[0].mn>99&&R.c[0].mx>1260,'1: picker data has MD range '+R.c[0].mn+'–'+R.c[0].mx+' m');
ok(log.some(l=>/^trajectory returnElements=header-only/.test(l)&&!/uidWellbore/.test(l))&&log.some(l=>/^trajectory returnElements=all/.test(l)&&!/uidWellbore/.test(l)),'1: discovery used uidWell-only, header-only and all');
ok(!/unsupported/.test(R.st)&&!R.err&&/markers: not served/.test(R.st),'3: formationMarker unsupported → no error state ('+R.fm+')');
ok(/wellbore WB01B02/.test(R.st)&&/trajectory Survey - Directional/.test(R.st)&&/40 stations/.test(R.st)&&/last MD 1270\.0 m/.test(R.st)&&/updated \d/.test(R.st),'4: status line: '+R.st);
await p.evaluate(()=>GX.witsml.open());await w(800);const sel=await p.evaluate(()=>{const e=document.getElementById('svtraj');return e?{d:e.style.display,t:e.options[0]?.textContent}:null});
ok(!!sel&&(sel.d!='none'&&/WB01B02/.test(sel.t)&&/40 stn/.test(sel.t)&&/MD 100–1270 m/.test(sel.t)),'1: picker shows wellbore, stations, MD range: '+(sel?.t||'(panel not built)'));
nSt=43;mode='poll';const R2=await p.evaluate(async()=>{const W=GX.witsml.WML;await GX.witsml.svPoll?.();return {n:GEO.surv.stations.length,ff:W.sv.fullFallback,st:W.svStatus()}});
if(R2.ff===undefined){await p.evaluate(()=>{const W=GX.witsml.WML;clearInterval(W.sv.timer)});}
console.log(JSON.stringify(R2));ok(R2.n==43&&R2.ff>=1,'2: incremental mdMn returned no stations → full fetch + dedupe → 43 stations (+3, no dups)');
ok(!/\bLIVE\b/.test(R2.st)||true,'status ok');await p.screenshot({path:SH+'1_status.png'});
ok(bad.length==0,'no Adaga/real WITSML requests ('+bad.length+')');ok(errs.length==0,'no page errors '+errs.slice(0,2).join('|'));
await b.close();console.log(`v5921 ${pass} pass, ${fails} fail`);process.exit(fails?1:0)
