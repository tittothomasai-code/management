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
 ok(!!s.stratSrc,nm+': strat layers from helper D model ('+s.stratSrc+')');ok(/Rock at bit: [^\n]*\(/.test(hud)&&await p.evaluate(()=>{const l=GX.subsurface.lithAtBit();return !!(l&&l.strat&&l.name)}),nm+': bit lithology from strat model');
 ok(s.names.includes('subCasing')&&s.names.includes('subCement')&&s.casing?.run>=1,nm+': casing + cement render ('+JSON.stringify(s.casing)+')');
 ok(s.bit[1]<0,nm+': bit is below ground (y='+s.bit[1].toFixed(0)+')');ok(s.layerSrc,nm+': layers source '+s.layerSrc);
 // follows the bit as MD grows
 const b0=s.bit;await p.evaluate(()=>{G.S.md+=300;});await w(3000);const b1=(await st(p)).bit;
 const tgt=await p.evaluate(()=>0);ok(b1[1]<b0[1]||b1[0]!=b0[0],nm+': bit position updates live ('+b0[1].toFixed(0)+' -> '+b1[1].toFixed(0)+')');
 { const s2=await st(p);ok(s2.names.includes('subGamma')&&s2.gamma>0&&/Gamma \d+ API/.test(await p.evaluate(()=>subHud.innerText)),nm+': gamma trace along well ('+s2.gamma+' API)');
   ok(s2.rulerTops>=2&&await p.evaluate(()=>document.querySelectorAll('#subRuler .t').length>=4&&!!document.querySelector('#subRuler .bitm')),nm+': formation-tops depth ruler ('+s2.rulerTops+' tops)');
   if(nm=='phone')ok(await p.evaluate(()=>getComputedStyle(subSplit).display=='none'),'phone: split button hidden') }
 await p.screenshot({path:SH+nm+'_open.png'});
 if(nm=='desk'){await p.evaluate(()=>document.getElementById('subFit').click());await w(1500);await p.screenshot({path:SH+nm+'_fit.png'});ok(!(await st(p)).follow,'Fit turns follow off');
  await p.evaluate(()=>document.getElementById('subSplit').click());await w(1500);const sp=await p.evaluate(()=>({s:GX.subsurface.state().split,l:document.getElementById('subsurf').getBoundingClientRect().left,cw:document.getElementById('subCv').width}));
  const mc=await p.evaluate(()=>{const c=G._scene&&[...document.querySelectorAll('canvas')].find(c=>c.id!='subCv'&&c.getBoundingClientRect().width>300);return c?{w:Math.round(c.getBoundingClientRect().width),split:window.__dwSplitW}:null});ok(mc&&mc.w==720&&mc.split==720,'split: main rig renderer uses left half ('+JSON.stringify(mc)+')');
  ok(sp.s&&sp.l>=600&&sp.l<=800,'split view: subsurface on right half (left='+sp.l+')');await p.screenshot({path:SH+'desk_split.png'});
  await p.evaluate(()=>document.getElementById('subSplit').click());await w(800);ok(!(await st(p)).split,'split view toggles back');ok(await p.evaluate(()=>!window.__dwSplitW&&[...document.querySelectorAll('canvas')].some(c=>c.id!='subCv'&&Math.round(c.getBoundingClientRect().width)==innerWidth)),'split off: main renderer back to full width');
  await p.evaluate(()=>subSplit.click());await w(500);await p.evaluate(()=>GX.subsurface.close());await w(500);ok(await p.evaluate(()=>!window.__dwSplitW),'closing in split restores main view');await p.evaluate(()=>GX.subsurface.open());await w(1500);
  const gl=await p.evaluate(()=>({g:GX.subsurface.state().glow,want:GX.subsurface.glowOf((+S.rop||0)*0.3048),a:GX.subsurface.glowOf(0),b:GX.subsurface.glowOf(40),c:GX.subsurface.glowOf(20)}));
  ok(Math.abs(gl.g-gl.want)<0.15&&gl.a==0&&gl.b==1&&gl.c==0.5,'bit glow follows live ROP (glow '+gl.g.toFixed(2)+' for '+gl.want.toFixed(2)+'; 0/20/40 m/h -> 0/0.5/1)');await p.evaluate(()=>GX.subsurface.open());await p.screenshot({path:SH+'desk_glow.png'});
  await p.evaluate(()=>GX.quality&&GX.quality.set('low'));await w(2000);ok((await st(p)).open,'quality change keeps view open');}
 await p.evaluate(()=>document.getElementById('subClose').click());await w(500);ok(!(await st(p)).open&&await p.evaluate(()=>getComputedStyle(document.getElementById('subsurf')).display=='none'),nm+': Close works');
 if(nm=='desk'){await p.keyboard.press('v');await w(1500);ok((await st(p)).open,'key V opens');await p.keyboard.press('Escape');await w(500);ok(!(await st(p)).open,'Esc closes');
  await p.evaluate(()=>{__pad.buttons[3].pressed=true});await w(400);await p.evaluate(()=>{__pad.buttons[3].pressed=false});await w(1500);ok((await st(p)).open,'gamepad Y opens');
  await p.evaluate(()=>{__pad.buttons[3].pressed=true});await w(400);await p.evaluate(()=>{__pad.buttons[3].pressed=false});await w(500);ok(!(await st(p)).open,'gamepad Y closes')}
 ok(errs.length==0,nm+': no page errors '+errs.slice(0,2).join('|'));await ctx.close()}
await br.close();console.log(`subsurface ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
