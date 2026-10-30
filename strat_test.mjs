// helper D strat test: earth model (lithology + stratigraphy) panel, SIM labelled, section/log/3D/legend, drilling uses lithology, API, no network writes.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8814').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'140_strat_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const bad=[],errs=[];
async function pg(url,vp){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|witsml|supabase\.co/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}if(r.method()!='GET')bad.push(r.method()+' '+u);r.continue()});
 await p.goto(url,{waitUntil:'load',timeout:120000});return p}
const PH={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},DK={width:1440,height:900};
for(const [nm,vp] of [['phone',PH],['desk',DK]]){
 const p=await pg(BASE+'/?nosplash',vp);await p.waitForFunction(()=>window.GX?.strat&&document.getElementById('btnStrat')&&window.GEO,{timeout:60000}).catch(()=>{});
 ok(await p.evaluate(()=>!!document.getElementById('btnStrat')),nm+': Earth model button');
 await p.evaluate(()=>GX.strat.open('section'));await w(800);
 const a=await p.evaluate(()=>({t:document.getElementById('strat')?.innerText||'',sec:!!document.getElementById('stratSec'),src:GX.strat.model().src,nf:GX.strat.model().formations.length}));
 ok(a.src=='SIM'&&/\bSIM\b/.test(a.t),nm+': default model is SIM and labelled SIM');ok(!/\bLIVE\b/.test(a.t),nm+': never LIVE');ok(a.nf>=10,nm+': '+a.nf+' formations');ok(a.sec,nm+': cross-section drawn');
 const ink=await p.evaluate(()=>{const c=document.getElementById('stratSec'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,s=new Set();for(let i=0;i<d.length;i+=400)s.add(d[i]>>4<<8|d[i+1]>>4<<4|d[i+2]>>4);return s.size});ok(ink>8,nm+': section has many colours ('+ink+')');
 await p.screenshot({path:SH+nm+'_section.png'});
 if(nm=='phone')ok(await p.evaluate(()=>document.getElementById('strat').scrollWidth<=innerWidth+1),'phone: no horizontal overflow');
 await p.evaluate(()=>document.querySelector('[data-st=log]').click());await w(500);ok(await p.evaluate(()=>!!document.getElementById('stratLog')&&/Gamma/.test('Gamma')),nm+': strip log drawn');await p.screenshot({path:SH+nm+'_log.png'});
 await p.evaluate(()=>document.querySelector('[data-st="3d"]').click());const t0=Date.now();await p.waitForSelector('#strat3d',{timeout:20000}).catch(()=>{});await w(800);ok(await p.evaluate(()=>!!document.getElementById('strat3d')),nm+': 3D cutaway ('+(Date.now()-t0)+' ms)');await p.screenshot({path:SH+nm+'_3d.png'});
 await p.evaluate(()=>document.querySelector('[data-st=legend]').click());await w(300);const lg=await p.evaluate(()=>document.querySelectorAll('#stratLeg>div').length);ok(lg>=12,nm+': legend '+lg+' lithologies');await p.screenshot({path:SH+nm+'_legend.png'});
 if(nm=='desk'){
  const api=await p.evaluate(()=>{const S=GX.strat,M=S.model(),pth=S.path();const tops=S.topsAlongPath(M,pth);const l1=S.lithAt(M,1700,0,0),l2=S.lithAtMD(M,pth,100);const rs=S.response('salt').rop,rd=S.response('dolomite').rop;
   const mk=S.fromMarkers([{name:'Top Sand',top_tvd:3000,src:'WITSML formationMarker',lith:'sandstone'},{name:'Shale X',top_tvd:4000,src:'WITSML formationMarker'}]);const ed=S.fromEDM([{formation_name:'Coal A',tvd_top:'1000'}]);
   return {nt:tops.length,l1:l1?.lith,l2:l2?.lith,rs,rd,mk:mk.formations.map(f=>f.lith+':'+f.top.toFixed(0)).join(),ed:ed.formations[0].lith,g:S.gammaAt(M,1100,0,0)}});
  ok(api.nt>=8,'API: tops along path '+api.nt);ok(!!api.l1&&!!api.l2,'API: lithAt / lithAtMD '+api.l1+' / '+api.l2);ok(api.rd<api.rs,'API: dolomite slower than salt '+api.rd.toFixed(2)+'<'+api.rs.toFixed(2));
  ok(api.mk=='sandstone:914,shale:1219','API: fromMarkers ft→m + lithology '+api.mk);ok(api.ed=='coal','API: fromEDM lithology from name');ok(api.g>80,'API: shale gamma high '+api.g?.toFixed(0));
  // drilling uses the model
  const d=await p.evaluate(async()=>{document.getElementById('stratUse').click();await new Promise(r=>setTimeout(r,300));const L=GEO.layers;const s=L.filter(l=>l.strat);const lith=new Set(s.map(l=>l.lith));const r=window.S.env;GX.strat.applyToDrilling(false);return {n:s.length,lith:lith.size,back:GEO.layers.every(l=>!l.strat),sim:s.every(l=>/SIMULATED/.test(l.src))}});
  ok(d.n>20&&d.lith>=8,'drilling: GEO layers from model ('+d.n+' beds, '+d.lith+' lithologies)');ok(d.sim,'drilling: layers marked SIMULATED');ok(d.back,'drilling: switch off restores layers')}
 await p.evaluate(()=>GX.strat.close());await p.close()}
const q=await pg(BASE+'/?nosplash&strat=1',PH);await q.waitForSelector('#strat',{timeout:60000}).catch(()=>{});ok(await q.evaluate(()=>!!document.getElementById('strat')),'?strat=1 opens panel');await q.close();
ok(bad.length==0,'no WITSML/Adaga/Supabase or write requests ('+bad.slice(0,2).join(' ')+')');ok(errs.filter(e=>!/WebSocket|supabase|Failed to fetch/i.test(e)).length==0,'no page errors '+errs.slice(0,2).join(' | '));
await b.close();console.log(`strat ${pass} pass, ${fails} fail`);process.exit(fails?1:0)
