// rig-realism test: API 4F-proportioned derrick + substructure, PBR material values, 3-level LOD, phone Low cap.
import puppeteer from 'puppeteer-core';const BASE=(process.argv[2]||'http://localhost:8863').replace(/\/$/,''),SH='shots_live/160_rig_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let pass=0,fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fail++};
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const DESK={width:1440,height:900},PHONE={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true};
async function open(vp,q=''){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);
 await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())?r.abort():r.continue());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(BASE+'/?nosplash'+q,{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.GX&&GX.rig&&GX.quality,{timeout:90000});await w(2000);return {p,ctx,errs}}
const lvlAt=async(p,pos,want)=>{await p.evaluate(pos=>G.view(pos,[0,24,0]),pos);await p.waitForFunction(x=>GX.rig.level()==x,{timeout:20000},want).catch(()=>{});await w(800);return p.evaluate(()=>GX.rig.level())};
{const {p,ctx,errs}=await open(DESK,'&q=high');
 const D=await p.evaluate(()=>GX.rig.dims);console.log(' dims',JSON.stringify(D));
 ok(Math.abs(D.base-9.144)<0.01,'base square 30 ft (9.14 m)');ok(Math.abs(D.vWindow-7.214)<0.01,'V-window 23 ft 8 in');ok(Math.abs(D.dwWindow-2.286)<0.01,'drawworks window 7 ft 6 in');
 ok(Math.abs(D.top-1.676)<0.01&&Math.abs(D.ginPole-3.658)<0.01,'top opening 5 ft 6 in, gin pole 12 ft');ok(D.rail==1.07&&D.toe==0.1,'handrail 1.07 m, toe board 0.1 m');
 ok(await p.evaluate(()=>GX.rig.hidden>=150),'old placeholder lattice hidden ('+await p.evaluate(()=>GX.rig.hidden)+')');
 ok(await p.evaluate(()=>G._scene.getObjectByName('rigLOD').levels.length==3),'3 LOD levels');
 const c=await p.evaluate(()=>GX.rig.counts);console.log(' counts',JSON.stringify(c));ok(c[0].members>c[1].members&&c[1].members>c[2].members,'members drop per LOD level');ok(c[0].draws<=30,'L0 draw calls <=30 ('+c[0].draws+')');
 const m=await p.evaluate(()=>{const M=GX.rig.materials;return {paint:[M.paint.metalness,M.paint.roughness],galv:[M.galv.metalness,M.galv.roughness],std:Object.values(M).every(x=>x.isMeshStandardMaterial)}});
 ok(m.paint[0]==0&&m.galv[0]==1&&m.std,'PBR: paint dielectric, galvanised metal '+JSON.stringify(m));
 ok(await lvlAt(p,[22,20,26],0)==0,'near view -> L0');await p.screenshot({path:SH+'desk_1_near.png'});
 ok(await lvlAt(p,[90,60,110],1)==1,'mid view -> L1');await p.screenshot({path:SH+'desk_2_mid.png'});
 ok(await lvlAt(p,[200,120,260],2)==2,'far view -> L2');await p.screenshot({path:SH+'desk_3_far.png'});
 await p.evaluate(()=>G.view([6,10,14],[0,9,0]));await w(1500);await p.screenshot({path:SH+'desk_4_floor.png'});
 await p.evaluate(()=>G.view([10,52,12],[0,48,0]));await w(1500);await p.screenshot({path:SH+'desk_5_crown.png'});
 ok(await p.evaluate(()=>{const d=G.animProbe();return isFinite(d.quill)&&isFinite(d.rot)}),'animation probe still works');
 ok(!errs.length,'no page errors (desk) '+errs.slice(0,2).join('|'));await ctx.close()}
{const {p,ctx,errs}=await open(PHONE);ok(await p.evaluate(()=>GX.rig.quality())=='low','phone uses Low');
 ok(await lvlAt(p,[22,20,26],1)==1,'phone Low: near view capped at L1');await p.screenshot({path:SH+'phone_1_near.png'});
 await p.evaluate(()=>GX.quality.set('high'));await w(1500);ok(await lvlAt(p,[22,20,26],0)==0,'quality High on phone -> L0 near');
 ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no horizontal overflow');
 ok(!errs.length,'no page errors (phone) '+errs.slice(0,2).join('|'));await ctx.close()}
await br.close();console.log(`rig_test: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
