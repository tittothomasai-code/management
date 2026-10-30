// target2_test (helper D): per-well editable SIM target (thickness, dip), zone %, gamma contrast, Target tab, strip-log band, geosteer uses edits. Shots 161_target2_*.
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8814').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'161_target2_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
// pure (node, with a tiny localStorage)
const mem={};globalThis.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]}};globalThis.window={S:{wellName:'W-A'},dispatchEvent(){}};globalThis.CustomEvent=class{constructor(t,o){this.type=t;this.detail=o?.detail}};
const S=await import('./strat.js');const M=S.SIM_STRAT(),i=S.formationIndex('reservoir',M);
ok(S.wellKey()=='W-A','well key from current well');let f=S.targetFn(i,45,0,0,M);const th0=f(300).th;
S.setTarget({th0:9});f=S.targetFn(i,45,0,0,M);ok(Math.abs(f(300).th-th0)>3&&f(300).th>7,'thickness edit 9 m changes target ('+th0.toFixed(1)+' → '+f(300).th.toFixed(1)+' m)');
ok(S.setTarget({th0:99}).th0==20&&S.setTarget({dip:-40}).dip==-5,'inputs clamped (th 0.5–20, dip ±5)');S.setTarget({th0:4,dip:0});
const f0=S.targetFn(i,45,0,0,M);S.setTarget({dip:1});const f1=S.targetFn(i,45,0,0,M);ok(f1(600).top-f0(600).top>5&&Math.abs(f1(0).top-f0(0).top)<1e-6,'dip 1° moves target top down along x ('+(f1(600).top-f0(600).top).toFixed(1)+' m at 600 m)');
ok([0,200,500,900].every(x=>{const t=f1(x);return t.top>=t.gross.top-1e-9&&t.base<=t.gross.base+1e-9}),'dipped target stays inside gross');
window.S.wellName='W-B';ok(S.targetFn(i,45,0,0,M)(300).th<8&&!S.targetCfg().dip,'other well keeps its own target');window.S.wellName='W-A';
ok(JSON.parse(mem.dw_target_v1)['W-A'].dip==1,'per-well target saved (no secrets)');S.resetTarget();ok(!S.targetCfg().th0,'reset clears well target');
const fn=S.targetFn(i,45,0,0,M),t=fn(300),Sin=[],Sout=[];for(let x=0;x<=1000;x+=10){const q=fn(x);Sin.push({x,tvd:(q.top+q.base)/2});Sout.push({x,tvd:x<500?(q.top+q.base)/2:q.top-3})}
const zi=S.zoneStats(Sin,fn),zo=S.zoneStats(Sout,fn);ok(zi.inPct>99,'path in middle: in zone '+zi.inPct.toFixed(0)+' %');ok(Math.abs(zo.inPct-50)<3&&Math.abs(zo.abovePct-50)<3,'half path above top: '+zo.inPct.toFixed(0)+' / '+zo.abovePct.toFixed(0)+' %');
const C=S.targetContrast(fn,300);ok(C.mid<40&&C.top>25&&C.base>25,'gamma contrast: pay '+C.mid.toFixed(0)+' gAPI, top +'+C.top.toFixed(0)+', base +'+C.base.toFixed(0));ok(S.targetGamma(300,t.gross.top-10,fn)>110,'shoulder shale high gamma');
// browser
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const bad=[],errs=[];
async function pg(url,vp){const ctx=await b.createBrowserContext();const p=await ctx.newPage();p.ctx=ctx;await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();if(/adaga|witsml|supabase\.co/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}if(r.method()!='GET')bad.push(r.method()+' '+u);r.continue()});await p.goto(url,{waitUntil:'load',timeout:120000});return p}
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 let p=await pg(BASE+'/?nosplash&strat=1',vp);await p.waitForFunction(()=>window.GX?.strat?.ready,{timeout:90000}).catch(()=>{});
 await p.evaluate(()=>GX.strat.open('target'));await p.waitForSelector('#stratTgt',{timeout:20000}).catch(()=>{});let tx=await p.evaluate(()=>document.getElementById('strat')?.innerText||'');
 ok(/Target for well/.test(tx)&&/in zone \d+ %/.test(tx)&&/Gamma contrast/.test(tx),nm+': Target tab shows editor, zone %, gamma contrast');ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx)&&!/NaN|undefined/.test(tx),nm+': SIM, no LIVE, clean');
 await w(400);await p.screenshot({path:SH+nm+'_1_tab.png'});
 await p.evaluate(()=>{document.getElementById('tgTh').value=8;document.getElementById('tgDip').value=0.5;document.getElementById('tgSet').click()});await w(300);
 const r=await p.evaluate(()=>{const S=GX.strat,i=S.formationIndex('reservoir');return {cfg:S.targetCfg(),th:S.targetFn(i,45)(300).th,txt:document.getElementById('stratTgt')?.innerText}});ok(r.cfg.th0==8&&r.cfg.dip==0.5&&r.th>6.5&&/TARGET|Target/.test(r.txt),nm+': Set saves well target ('+r.th.toFixed(1)+' m)');
 await p.screenshot({path:SH+nm+'_2_edit.png'});
 await p.evaluate(()=>GX.strat.open('log'));await w(500);ok(!!await p.$('#stratLog'),nm+': strip log renders with target band');await p.screenshot({path:SH+nm+'_3_log.png'});
 const keep=await p.evaluate(()=>localStorage.getItem('dw_target_v1'));await p.ctx.close();
 p=await pg(BASE+'/?demo=geosteer&nosplash=1',vp);await p.evaluate(k=>localStorage.setItem('dw_target_v1',k),keep);await p.waitForFunction(()=>window.GX?.geosteer&&GX.strat?.ready,{timeout:90000}).catch(()=>{});
 const g=await p.evaluate(()=>{GX.geosteer.useEarthModel();GX.geosteer.open();const g=GX.geosteer.geology(300);return {th:g.th,stat:document.getElementById('gsStat')?.innerText||''}});
 ok(g.th>6.5,nm+': geosteer curtain uses edited target ('+g.th.toFixed(1)+' m)');await w(2500);await p.screenshot({path:SH+nm+'_4_geosteer.png'});
 await p.evaluate(()=>{GX.strat.resetTarget();GX.geosteer.useEarthModel()});ok(await p.evaluate(()=>GX.geosteer.geology(300).th<8),nm+': reset restores thin target');await p.ctx.close()}
ok(!errs.filter(e=>!/WebGL/.test(e)).length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no network writes '+bad.slice(0,2).join());
console.log(`\n${pass} pass, ${fails} fail`);await b.close();process.exit(fails?1:0)
