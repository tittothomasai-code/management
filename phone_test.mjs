// v5.8 phone test (390x844, touch): audits EVERY Tools button (tap -> its target is visible on screen, twice: open, close, reopen)
// + LIVE labelling: with no real feed nothing says LIVE. SIM only; no network writes (Supabase session off under webdriver).
import puppeteer from 'puppeteer-core';const BASE=process.argv[2]||'http://localhost:8777',SH=process.env.SHOT||'shots_live/113_phone_';const EXT=[];const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
// panel buttons: [button selector (id or text), target element id]
const PANEL=[['#wbtn','witsml'],['#addeq','eqmenu'],['text=Equipment library','libmenu'],['#dsgbtn','designer'],['#btnExpl','wshop'],['#btnBhaB','wshop'],['#btnWP','wp'],['#btnSur','geoSur'],['#btnLay','geoLay'],['#btnBit','bitp'],['#g8btn','g8'],['#btnConn','connp'],['#seqedbtn','seqeditor'],['#uiSeq','seqpanel'],['#uiSig','sigsrc'],['#btnPlayer','plJoin'],];
// Events log / Formation at bit are on/off toggles that keep Tools open (STAY) - checked separately below
async function page(){const p=await br.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});p.on('request',r=>{if(/supabase|adaga|witsml|netlify\/functions/i.test(r.url()))EXT.push(r.method()+' '+r.url().slice(0,80))});p.on('pageerror',e=>/WebGL/.test(e.message)||console.log('pageerror',e.message));
 await p.goto(BASE+'/?nosplash=1&player=SIM%20Phone',{waitUntil:'load',timeout:180000});await p.waitForFunction(()=>document.getElementById('uiTools')&&document.getElementById('wbtn'),{timeout:180000});await w(2500);return p}
const sel=s=>s.startsWith('#')?`document.getElementById(${JSON.stringify(s.slice(1))})`:`[...document.querySelectorAll('#uiTools button')].find(b=>b.textContent.trim()==${JSON.stringify(s.slice(5))})`;
async function openTools(p){await p.evaluate(()=>{document.getElementById('plJoin')?.remove();document.getElementById('uiTab_rig').click()});await w(350);await p.evaluate(()=>document.getElementById('uiTab_tools').click());await w(350)}
async function tap(p,s){const pt=await p.evaluate(`(()=>{const b=${sel(s)};if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);return {x,y,hit:!!hit&&(hit===b||b.contains(hit)),inView:r.top>=0&&r.bottom<=innerHeight&&r.width>20}})()`);if(!pt)return null;await p.touchscreen.tap(pt.x,pt.y);return pt}
const onScreen=(p,id)=>p.evaluate(id=>{const e=document.getElementById(id);if(!e)return false;const cs=getComputedStyle(e);if(cs.display=='none'||cs.visibility=='hidden'||e.classList.contains('uihide'))return false;const r=e.getBoundingClientRect();return r.width>40&&r.height>30&&r.bottom>20&&r.top<innerHeight-20&&r.right>20&&r.left<innerWidth-20},id);
const all=await (async()=>{const p=await page();await openTools(p);const L=await p.evaluate(()=>[...document.querySelectorAll('#uiTools button')].map(b=>(b.id?'#'+b.id:'text='+b.textContent.trim())));await p.screenshot({path:SH+'0_tools_sheet.png'});
 // LIVE labelling with no feed connected
 const txt=await p.evaluate(()=>document.body.innerText);const bad=(txt.match(/[^\n]*\bLIVE\b[^\n]*/g)||[]).filter(l=>!/not LIVE|no live feed|SIM|only with a live feed/i.test(l));
 ok(bad.length==0,'no LIVE label without a live feed'+(bad.length?' :: '+bad.join(' || '):''));
 ok(await p.evaluate(()=>document.querySelector('#uiTop .st')?.textContent.trim()=='SIM'),'top status chip says SIM');
 ok(await p.evaluate(()=>/OFF|SIM/.test(document.getElementById('wlm')?.textContent||'')&&!/^LIVE/.test(document.getElementById('wlm')?.textContent||'')),'Follow-feed button not LIVE: '+await p.evaluate(()=>document.getElementById('wlm')?.textContent));
 // Follow feed ON but no healthy real feed -> SIM, never LIVE; simulated feed -> SIMULATED
 const r=await p.evaluate(async()=>{const X=window.GX?.witsml?.WML||window.WML;if(!X)return 'noWML';const o={lm:X.liveMode,sim:X.simulated};const out=[];X.liveMode=true;X.simulated=false;out.push(realMode());X.simulated=true;out.push(realMode());document.getElementById('wlmc')?.click();await new Promise(r=>setTimeout(r,1500));out.push(document.getElementById('wlm')?.textContent||'');out.push(document.getElementById('sim')?.textContent||'');X.liveMode=o.lm;X.simulated=o.sim;return out});
 console.log('  feed checks:',JSON.stringify(r));ok(Array.isArray(r)&&r[0]=='SIM'&&r[1]=='SIMULATED'&&!/^LIVE/.test(r[2])&&!/\bLIVE\b/.test(r[3]),'Follow feed ON without a real feed: SIM/SIMULATED, never LIVE');
 await p.close();return L})();
console.log('Tools buttons:',all.length);
// every button: visible + actually tappable (elementFromPoint hits it) inside the sheet
{const p=await page();for(const s of all){await openTools(p);const pt=await p.evaluate(`(()=>{const b=${sel(s)};if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&r.width>20&&r.height>=30&&!!h&&(h===b||b.contains(h))})()`);ok(pt,'button visible + tappable in Tools: '+s)}await p.close()}
// panel buttons: tap -> target visible on screen; close (✕/Rig) -> tap again -> visible again
const chunks=[PANEL.slice(0,6),PANEL.slice(6,12),PANEL.slice(12)];let shot=1;
for(const ch of chunks){const p=await page();for(const [s,id] of ch){for(const r of [1,2]){await openTools(p);const t=await tap(p,s);if(!t){ok(false,s+' missing');break}await w(1000);if(r==2&&/btnExpl|btnBhaB/.test(s))ok(!(await onScreen(p,id)),`tap ${s} again -> #${id} toggles off (v5.9.2)`);else ok(await onScreen(p,id),`tap ${s} -> #${id} visible (round ${r})`);
  if(r==1&&['#wbtn','#btnWP','#uiSig','#btnBit'].includes(s))await p.screenshot({path:SH+(shot++)+'_'+id+'.png'})}
  if(s=='#wbtn'){const txt=await p.evaluate(()=>document.getElementById('witsml')?.innerText||'');ok(!/\bLIVE\b/.test(txt.replace(/not LIVE|no live feed|only with a live feed|shown as LIVE only then|never shown as LIVE|LIVE MODE[^\n]*live feed/gi,'')),'WITSML panel shows no LIVE claim while disconnected')}}
 await p.close()}
{const p=await page();await openTools(p);await tap(p,'#uiLog');await w(600);ok(await onScreen(p,'log'),'Events log toggles on');await tap(p,'#uiLog');await w(600);ok(!(await onScreen(p,'log')),'Events log toggles off');ok(await onScreen(p,'uiTools'),'Tools stays open for toggles');await p.close()}
ok(EXT.length==0,'no Supabase/Adaga/WITSML requests (no lobby join) '+EXT.slice(0,3).join(' | '));
console.log(`\n${pass} passed, ${fails} failed`);await br.close();process.exit(fails?1:0)
