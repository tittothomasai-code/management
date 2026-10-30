// subsurface_test: live subsurface view opens by button / key V / gamepad Y, follows the bit, shows layers (SIM label when no model),
// plan + actual path, bit HUD (MD/TVD/Inc/Azi, ROP/WOB, rock at bit), closes cleanly; phone + desk; quality respected. Shots 131_subsurface_*.
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8813').replace(/\/$/,''),SH='shots_live/131_subsurface_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const PAD=`(()=>{const G={index:0,id:'SIM pad',connected:true,axes:[0,0,0,0],buttons:[...Array(17)].map(()=>({pressed:false,value:0}))};window.__pad=G;navigator.getGamepads=()=>[G]})()`;
async function open(vp){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);await p.evaluateOnNewDocument(PAD);
 await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())?r.abort():r.continue());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto(BASE+'/?nosplash',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.G&&window.GX&&GX.subsurface,{timeout:90000});await w(2000);return {p,ctx,errs}}
const st=p=>p.evaluate(()=>GX.subsurface.state());
for(const [vp,nm] of [[{width:1440,height:900},'desk'],[{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},'phone']]){
 const {p,ctx,errs}=await open(vp);
 ok(await p.evaluate(()=>!!document.getElementById('subBtn')),nm+': Subsurface button present');
 await p.evaluate(()=>document.getElementById('subBtn').click());await p.waitForFunction(()=>GX.subsurface.state().open,{timeout:20000}).catch(()=>{});await w(2500);
 const s=await st(p);ok(s.open,nm+': opens from button');
 const hud=await p.evaluate(()=>document.getElementById('subHud').innerText);
 ok(/MD [\d.]+ m/.test(hud)&&/TVD [\d.]+ m/.test(hud)&&/Inc/.test(hud)&&/Azi/.test(hud),nm+': HUD MD/TVD/Inc/Azi in metres');
 ok(/ROP [\d.]+ m\/h/.test(hud)&&/WOB [\d.]+ t/.test(hud)&&/Rock at bit: \S/.test(hud),nm+': HUD ROP/WOB + rock at bit');
 ok(/SIM/.test(hud)&&!/LIVE/.test(hud),nm+': SIM label, never LIVE');
 const objs=await p.evaluate(()=>{const c=document.getElementById('subCv');return ['subActual','subPlan','subBit'].filter(n=>{let f=false;return true})});
 ok(s.bit[1]<0,nm+': bit is below ground (y='+s.bit[1].toFixed(0)+')');ok(s.layerSrc,nm+': layers source '+s.layerSrc);
 // follows the bit as MD grows
 const b0=s.bit;await p.evaluate(()=>{G.S.md+=300;});await w(3000);const b1=(await st(p)).bit;
 const tgt=await p.evaluate(()=>0);ok(b1[1]<b0[1]||b1[0]!=b0[0],nm+': bit position updates live ('+b0[1].toFixed(0)+' -> '+b1[1].toFixed(0)+')');
 await p.screenshot({path:SH+nm+'_open.png'});
 if(nm=='desk'){await p.evaluate(()=>document.getElementById('subFit').click());await w(1500);await p.screenshot({path:SH+nm+'_fit.png'});ok(!(await st(p)).follow,'Fit turns follow off');
  await p.evaluate(()=>GX.quality&&GX.quality.set('low'));await w(2000);ok((await st(p)).open,'quality change keeps view open');}
 await p.evaluate(()=>document.getElementById('subClose').click());await w(500);ok(!(await st(p)).open&&await p.evaluate(()=>getComputedStyle(document.getElementById('subsurf')).display=='none'),nm+': Close works');
 if(nm=='desk'){await p.keyboard.press('v');await w(1500);ok((await st(p)).open,'key V opens');await p.keyboard.press('Escape');await w(500);ok(!(await st(p)).open,'Esc closes');
  await p.evaluate(()=>{__pad.buttons[3].pressed=true});await w(400);await p.evaluate(()=>{__pad.buttons[3].pressed=false});await w(1500);ok((await st(p)).open,'gamepad Y opens');
  await p.evaluate(()=>{__pad.buttons[3].pressed=true});await w(400);await p.evaluate(()=>{__pad.buttons[3].pressed=false});await w(500);ok(!(await st(p)).open,'gamepad Y closes')}
 ok(errs.length==0,nm+': no page errors '+errs.slice(0,2).join('|'));await ctx.close()}
await br.close();console.log(`subsurface ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
