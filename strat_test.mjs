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
  {const t=await p.evaluate(()=>{const S=GX.strat,i=S.formationIndex('reservoir'),f=S.targetFn(i,45),g=S.geologyFn(i,45),r=[];for(let x=0;x<=1000;x+=50){const a=f(x),b=g(x);r.push({th:a.th,in:a.top>=b.top-1e-9&&a.base<=b.base+1e-9,gt:b.base-b.top,top:a.top})}const a0=f(0);return {r,name:a0.name,sim:a0.sim,api:!!S.TARGET}});
   ok(t.api&&t.r.every(q=>q.th>=1.5&&q.th<=8&&q.th<q.gt),'API: targetFn thin sub-layer 1.5–8 m, thinner than gross ('+Math.min(...t.r.map(q=>q.th)).toFixed(1)+'–'+Math.max(...t.r.map(q=>q.th)).toFixed(1)+' m)');ok(t.r.every(q=>q.in),'API: target stays inside the gross reservoir');
   ok(t.sim&&/\(SIM\)/.test(t.name),'API: target tagged SIM '+t.name);ok(Math.max(...t.r.map(q=>q.top))-Math.min(...t.r.map(q=>q.top))>1,'API: target top undulates')}
  // stage 2b: pressures
  const pr=await p.evaluate(()=>{const S=GX.strat,M=S.model(),a=S.pressureAt(M,800),b=S.pressureAt(M,1600),w=S.mudWindow(),pf=S.pressureProfile();return {a,b,w,mw:S.mudWeight(),n:pf.length,mono:pf.every(q=>q.pp_sg<q.fg_sg&&q.fg_sg<=q.ob_sg+1e-6)}});
  ok(pr.a.pp_sg>=1.0&&pr.a.pp_sg<1.1&&pr.b.pp_sg>pr.a.pp_sg,'pressure: hydrostatic shallow, SIM overpressure deep '+pr.a.pp_sg+' / '+pr.b.pp_sg);
  ok(pr.n>10&&pr.mono,'pressure: PP < FG <= OB along well ('+pr.n+' pts)');ok(typeof pr.mw=='number'&&pr.w&&/OK|NARROW|RISK/.test(pr.w.state),'pressure: mud window from mud weight '+pr.mw+' ppg → '+(pr.w&&pr.w.state));
  // stage 2c: geosteer + wplan hooks
  const gh=await p.evaluate(async()=>{const S=GX.strat;const la=S.lookAhead(3000),g=S.geologyFn(S.formationIndex('reservoir'))(200),pr=S.prognosis();let tab='',rows=0;
   for(let i=0;i<20&&!GX.wplan?.W?.tabs?.some(t=>t[0]=='geology');i++)await new Promise(r=>setTimeout(r,500));
   if(GX.wplan){GX.wplan.open('geology');await new Promise(r=>setTimeout(r,500));tab=document.getElementById('wpBody')?.innerText||'';await new Promise(r=>setTimeout(r,1200));{const c=document.getElementById('stratBit').getBoundingClientRect(),w=document.getElementById('wp').getBoundingClientRect();window.__chipClear=c.right<=w.left+1}rows=document.querySelectorAll('#wpBody tbody tr').length}
   return {la:la.length,g:g&&g.th>0&&g.top>0,pr:pr.length,tab,rows,pp:!!S.planPath(),clear:window.__chipClear}});
  ok(gh.la>=3,'geosteer: lookAhead tops '+gh.la);ok(gh.g,'geosteer: geologyFn top/base/th');ok(gh.pp&&gh.pr>=5,'wplan: prognosis on planned path '+gh.pr);
  ok(gh.rows>=5&&/SIM/.test(gh.tab)&&!/\bLIVE\b/.test(gh.tab),'wplan: Geology tab '+gh.rows+' rows, SIM');ok(gh.clear,'chip not under Well planning panel');await p.screenshot({path:'shots_live/141_strat2_desk_wplan.png'});await p.evaluate(()=>GX.wplan?.close());
  // drilling uses the model
  const d=await p.evaluate(async()=>{document.getElementById('stratUse').click();await new Promise(r=>setTimeout(r,300));const L=GEO.layers;const s=L.filter(l=>l.strat);const lith=new Set(s.map(l=>l.lith));const r=window.S.env;GX.strat.applyToDrilling(false);return {n:s.length,lith:lith.size,back:GEO.layers.every(l=>!l.strat),sim:s.every(l=>/SIMULATED/.test(l.src))}});
  ok(d.n>20&&d.lith>=8,'drilling: GEO layers from model ('+d.n+' beds, '+d.lith+' lithologies)');ok(d.sim,'drilling: layers marked SIMULATED');ok(d.back,'drilling: switch off restores layers')}
 // stage 2a: bit lithology chip
 await p.evaluate(()=>GX.strat.close());await w(1300);const hb=await p.evaluate(()=>{const e=document.getElementById('stratBit');if(!e)return null;if(e.closest('.msheet')||e.classList.contains('msheet'))return {t:e.textContent,in:false,api:''};const r=e.getBoundingClientRect();return {t:e.textContent,in:r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight,api:GX.strat.hudText(GX.strat.atBit())}});
 ok(!!hb&&/^Bit: /.test(hb.t)&&/\bSIM\b/.test(hb.t),nm+': bit lithology chip '+(hb&&hb.t));ok(!!hb&&hb.in,nm+': chip inside screen');await p.screenshot({path:`shots_live/141_strat2_${nm}_hud.png`});
 await p.evaluate(()=>GX.strat.close());await p.close()}
const q=await pg(BASE+'/?nosplash&strat=1',PH);await q.waitForSelector('#strat',{timeout:60000}).catch(()=>{});ok(await q.evaluate(()=>!!document.getElementById('strat')),'?strat=1 opens panel');await q.close();
ok(bad.length==0,'no WITSML/Adaga/Supabase or write requests ('+bad.slice(0,2).join(' ')+')');ok(errs.filter(e=>!/WebSocket|supabase|Failed to fetch/i.test(e)).length==0,'no page errors '+errs.slice(0,2).join(' | '));
await b.close();console.log(`strat ${pass} pass, ${fails} fail`);process.exit(fails?1:0)
