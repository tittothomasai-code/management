// showroom3d_test.mjs: Blender GLB rigs in the showroom. Model load + BOM ids, LOD by quality, low file size, A/B/C zoom to a GLB component,
// phone FPS (390x844, CPU throttle 4x) vs the old procedural model, floating rig card never overlaps the rig's screen box, night with GLB. No network writes.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8777').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'170_sr3d_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[];
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
const BOM={topdrive:['frame','motor','gearbox','swivel','ibop','pipehandler'],drawworks:['skid','drum','motors','transmission','brake','instr'],mudpumps:['powerend','fluidend','dampener','drive','fluidend2'],bop:['annular','rams','spool','wellhead','frame','tree'],mast:['mast','substructure','hoisting','monkeyboard','floor','doghouse'],pipehandling:['catwalk','roughneck','slips','racker'],mudtanks:['tanks','solids','degasser'],generators:['gensets','vfd','fuel'],accumulator:['bottles','pumps','manifold','remote'],choke:['manifold','chokes','mgs'],block:['crown','travelling']};
async function page(nm,q,noglb){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(VP[nm]);p.on('pageerror',e=>errs.push(nm+': '+e));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});
 await p.setRequestInterception(true);p.on('request',r=>{if(noglb&&/\.glb/.test(r.url()))return r.abort();if(/supabase\.co|adaga|witsml/i.test(r.url())&&!/\.js(\?|$)/.test(r.url()))return r.abort();r.continue()});
 await p.goto(BASE+'/?demo=showroom'+(q||''),{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.showroom?.ST?.grp,{timeout:60000});return {p,ctx}}
const ready=p=>p.waitForFunction(()=>{const S=GX.showroom.ST;return S.glbState&&S.glbState!='loading'},{timeout:60000}).catch(()=>{});
for(const nm of ['desk','phone']){const {p,ctx}=await page(nm);await ready(p);
 const rigs=await p.evaluate(()=>GX.showroom.RIGS.map(r=>r.id));
 for(let i=0;i<rigs.length;i++){await p.evaluate(i=>GX.showroom.show(i),i);await ready(p);await w(400);
  const r=await p.evaluate(()=>{const S=GX.showroom.ST,names=[];S.glb?.traverse(o=>o.name&&names.push(o.name));return {st:S.glbState,lod:S.lod,names,parts:S.parts.map(m=>[m.userData.part,m.userData.bom,m.userData.comp])}});
  ok(r.st=='ok',nm+' '+rigs[i]+': GLB loaded ('+r.st+', lod '+r.lod+')');
  const bad=r.parts.filter(([k,a,c])=>!BOM[a]||!BOM[a].includes(c));ok(r.parts.length>0&&!bad.length,nm+' '+rigs[i]+': '+r.parts.length+' tagged meshes, all BOM ids valid'+(bad.length?' bad='+JSON.stringify(bad.slice(0,3)):''));
  const as=new Set(r.parts.map(x=>x[1]));const need=rigs[i]=='frac'?['mudpumps','bop']:rigs[i]=='ctu'?['topdrive','bop','mudpumps']:['mast','topdrive','drawworks','mudpumps','bop'];
  ok(need.every(a=>r.names.includes(a)&&as.has(a)),nm+' '+rigs[i]+': nodes '+[...as].join(','));
  if(rigs[i]=='triple')ok(Object.keys(BOM).filter(a=>a!='block').every(a=>as.has(a))&&['topdrive__motor','drawworks__drum','bop__annular','mast__monkeyboard','block__crown','block__travelling'].every(n=>r.names.includes(n)),nm+' triple: all 10 BOM assets + derrick parts present');
  // card never covers the rig
  for(const col of [false,true]){await p.evaluate(c=>{GX.showroom.ST.rcCol=c;GX.showroom.rigCard(true)},col);await w(350);
   const o=await p.evaluate(()=>{const c=srRC.getBoundingClientRect(),R=GX.showroom.rigRect(GX.showroom.ST.grp),cl=v=>Math.max(0,v);const iw=cl(Math.min(c.right,Math.min(R.r,innerWidth))-Math.max(c.left,Math.max(R.l,0))),ih=cl(Math.min(c.bottom,Math.min(R.b,innerHeight))-Math.max(c.top,Math.max(R.t,0)));return {a:iw*ih,mode:srRC.dataset.mode,c:[c.left,c.top,c.right,c.bottom].map(Math.round)}});
   ok(o.a<1,nm+' '+rigs[i]+(col?' collapsed':'')+': rig card does not overlap rig ('+o.mode+', overlap '+Math.round(o.a)+'px²)');
   if(!col&&['triple','ship','frac'].includes(rigs[i]))await p.screenshot({path:SH+nm+'_'+rigs[i]+'_card.png'})}
  await p.evaluate(()=>{GX.showroom.ST.rcCol=false;GX.showroom.rigCard(false)});
  if(rigs[i]=='triple'){await p.screenshot({path:SH+nm+'_triple.png'});
   // A/B/C: asset > component zoom on GLB mesh
   const z=await p.evaluate(async()=>{const S=GX.showroom;S.drawer(true,'topdrive');const cs=S.comps('topdrive');const i=cs.findIndex(c=>c.id=='motor');S.selC(i);const ms=S.ST.parts.filter(m=>m.userData.comp=='motor'&&m.userData.bom=='topdrive');return {i,n:ms.length,cam:!!S.ST.camT}});
   ok(z.i>=0&&z.n>0&&z.cam,nm+': drill-down topdrive > motor zooms to GLB mesh ('+z.n+')');await w(1200);await p.screenshot({path:SH+nm+'_drill.png'});await p.evaluate(()=>GX.showroom.drawer(false));
   // night with GLB
   const n=await p.evaluate(async()=>{const r=await GX.showroom.nightSet(true,true);return {r,on:GX.showroom.isNight(),glb:GX.showroom.ST.glbState}});await w(800);
   ok(n.r&&n.on&&n.glb=='ok',nm+': night works with GLB rig');await p.screenshot({path:SH+nm+'_night.png'});await p.evaluate(()=>GX.showroom.nightSet(false,true));await w(300)}}
 // LOD by quality
 await p.evaluate(()=>GX.showroom.show(1));await ready(p);const L={};
 for(const qq of ['low','medium','high']){await p.evaluate(qq=>GX.quality.set(qq),qq);await p.waitForFunction(qq=>GX.showroom.ST.lod==qq&&GX.showroom.ST.glbState=='ok',{timeout:60000},qq).catch(()=>{});
  L[qq]=await p.evaluate(()=>{let f=0;GX.showroom.ST.glb?.traverse(o=>{if(o.isMesh)f+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3});return {lod:GX.showroom.ST.lod,f}})}
 ok(L.low.lod=='low'&&L.medium.lod=='medium'&&L.high.lod=='high',nm+': LOD follows quality '+JSON.stringify(L));ok(L.low.f<L.medium.f&&L.medium.f<L.high.f,nm+': triangle count rises low<med<high');
 await p.evaluate(()=>GX.quality.set('medium'));
 if(nm=='desk'){const sz=await p.evaluate(async()=>{const o={};for(const r of GX.showroom.RIGS){const a=await fetch(GX.showroom.M3.url(r.id,'low'));o[r.id]=(await a.arrayBuffer()).byteLength}return o});ok(Object.values(sz).every(v=>v<=1048576),'low GLBs ≤ 1 MB: max '+Math.max(...Object.values(sz))+' B')}
 ok(!/LIVE/.test(await p.evaluate(()=>showroom.textContent)),nm+': no LIVE label');await ctx.close()}
// fallback: missing GLB keeps procedural model
{const {p,ctx}=await page('desk','',true);await p.evaluate(()=>GX.showroom.show(2));await ready(p);
 const f=await p.evaluate(()=>({st:GX.showroom.ST.glbState,n:GX.showroom.ST.parts.length}));ok(f.st=='fallback'&&f.n>0,'GLB blocked: procedural fallback kept ('+f.st+', '+f.n+' parts)');await ctx.close()}
// phone FPS, CPU throttle 4x: new vs old
const fps=async q=>{const {p,ctx}=await page('phone',q);await ready(p);await p.evaluate(()=>GX.showroom.show(1));await ready(p);await w(1500);const cdp=await p.createCDPSession();await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const f=await p.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const s=()=>{n++;if(performance.now()-t0<4000)requestAnimationFrame(s);else r(n*1000/(performance.now()-t0))};requestAnimationFrame(s)}));
 const st=await p.evaluate(()=>GX.showroom.ST.glbState);await ctx.close();return {f,st}};
const o=await fps('&sr3d=0'),n=await fps('&sr3d=1');console.log('FPS phone 390x844 cpu4x: old',o.f.toFixed(1),'('+o.st+') new',n.f.toFixed(1),'('+n.st+')');
ok(o.st=='off'&&n.st=='ok','FPS runs compare procedural vs GLB');ok(n.f>=o.f*0.6,'phone FPS new '+n.f.toFixed(1)+' ≥ 60% of old '+o.f.toFixed(1));
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));
console.log(`\n${pass} passed, ${fails} failed`);await b.close();process.exit(fails?1:0);
