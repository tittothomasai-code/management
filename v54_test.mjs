// v5.4 iPhone test: exploded view (all equipment) + BHA builder. Offline, SIM only, NO Adaga/WITSML calls.
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const p=await b.newPage();const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co|witsml/i.test(u)){ext.push(u);r.abort()}else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
ok(await p.evaluate(()=>!!window.GX?.ws&&!!document.getElementById('btnExpl')&&!!document.getElementById('btnBhaB')),'ext12 loaded, HUD buttons present');
await p.evaluate(()=>document.getElementById('btnExpl').click());await w(2500);
const geo=()=>p.evaluate(()=>{const v=document.getElementById('wsView').getBoundingClientRect(),s=document.getElementById('wsSheet').getBoundingClientRect();return {vb:v.bottom,st:s.top,vh:v.height,sh:s.height}});
let g=await geo();ok(g.vb<=g.st+1&&g.vh>300,'model viewport sits above the sheet (view bottom '+g.vb.toFixed(0)+' ≤ sheet top '+g.st.toFixed(0)+', view h '+g.vh.toFixed(0)+')');
const keys=await p.evaluate(()=>Object.keys(GX.ws.CAT));ok(keys.length>=12&&['topdrive','drawworks','mudpump','bop','swivel','pdcbit','motor','mwd'].every(k=>keys.includes(k)),'catalogue covers '+keys.length+' equipment types');
for(const k of keys){await p.evaluate(k=>{const s=document.getElementById('wsEq');s.value=k;s.dispatchEvent(new Event('change'))},k);await w(1400);
 const r=await p.evaluate(()=>{const S=GX.ws.ST,v=document.getElementById('wsView').getBoundingClientRect();const L=[...document.querySelectorAll('.wsl')];const vis=L.filter(e=>e.style.display!='none');
  const inside=vis.filter(e=>{const x=parseFloat(e.style.left),y=parseFloat(e.style.top);return x>=0&&x<=v.width&&y>=0&&y<=v.height}).length;
  const moved=S.meshes.some(m=>{const q=m.userData.p;return Math.hypot(m.position.x-q.p[0],m.position.y-q.p[1],m.position.z-q.p[2])>0.01});return {n:S.meshes.length,lab:L.length,vis:vis.length,inside,t:S.t,moved}});
 ok(r.n>=4&&r.lab==r.n&&r.t==1&&r.moved&&r.inside==r.vis&&r.vis>=r.n-1,k+': '+r.n+' parts exploded, '+r.vis+' labels visible inside the view');
 if(['topdrive','mudpump','motor'].includes(k))await p.screenshot({path:SH+'102_v54_exploded_'+k+'.png'})}
await p.evaluate(()=>{const s=document.getElementById('wsEq');s.value='topdrive';s.dispatchEvent(new Event('change'))});await w(1500);
// tap a part in the 3D view (centre of the gearbox mesh)
const tap=await p.evaluate(()=>{const S=GX.ws.ST;const i=2;const m=S.meshes[i];const v=document.getElementById('wsView').getBoundingClientRect();const e=document.querySelector('.wsl[data-i="2"]');return {x:v.left+parseFloat(e.style.left),y:v.top+parseFloat(e.style.top)}});
await p.evaluate(()=>document.querySelector('.wsl[data-i="2"]').click());await w(500);
const info=await p.evaluate(()=>{const e=document.getElementById('wsInfo');return {d:getComputedStyle(e).display,t:e.textContent,sel:GX.ws.ST.sel,b:e.getBoundingClientRect().bottom,st:document.getElementById('wsSheet').getBoundingClientRect().top}});
ok(info.d=='block'&&/Gearbox/.test(info.t)&&/torque/.test(info.t)&&info.sel==2&&info.b<=info.st,'tap label → description card (above sheet): '+info.t.slice(0,60));
// raycast tap on the canvas
await p.evaluate(()=>{document.getElementById('wsInfo').style.display='none';GX.ws.ST.sel=-1});
const c=await p.evaluate(()=>{const S=GX.ws.ST,m=S.meshes[1];const v=document.getElementById('wsView').getBoundingClientRect();const q=m.position.clone();const e=document.querySelector('.wsl[data-i="1"]');return {x:v.left+parseFloat(e.style.left),y:v.top+parseFloat(e.style.top)+(1%2?-10:10)}});
await p.evaluate(()=>{document.querySelectorAll('.wsl').forEach(e=>e.style.pointerEvents='none')});await p.mouse.click(c.x,c.y);await w(500);
ok(await p.evaluate(()=>GX.ws.ST.sel>=0&&getComputedStyle(document.getElementById('wsInfo')).display=='block'),'tap on the 3D part (raycast) selects part '+await p.evaluate(()=>GX.ws.ST.sel));
await p.evaluate(()=>{document.querySelectorAll('.wsl').forEach(e=>e.style.pointerEvents='')});
await p.screenshot({path:SH+'102_v54_part_description.png'});
await p.evaluate(()=>document.getElementById('wsRe').click());await w(4000);
ok(await p.evaluate(()=>{const S=GX.ws.ST;return S.t==0&&S.meshes.every(m=>{const q=m.userData.p;return Math.hypot(m.position.x-q.p[0],m.position.y-q.p[1],m.position.z-q.p[2])<1e-6})}),'Reassemble returns every part to its assembled position');
await p.screenshot({path:SH+'102_v54_reassembled.png'});
// collapsible sheet
await p.evaluate(()=>document.getElementById('wsGrip').click());await w(400);g=await geo();ok(g.sh<=70&&g.vh>700,'sheet collapses → view '+g.vh.toFixed(0)+' px tall');
await p.evaluate(()=>document.getElementById('wsGrip').click());await w(300);
// selection mapping from scene names
ok(await p.evaluate(()=>GX.ws.keyFor('Top drive')=='topdrive'&&GX.ws.keyFor('Mud pump 2')=='mudpump'&&GX.ws.keyFor('BOP stack')=='bop'&&GX.ws.keyFor('Drawworks')=='drawworks'),'scene entity names map to exploded models');
// ---- BHA builder ----
await p.evaluate(()=>document.getElementById('wsBha').click());await w(1500);
for(const k of ['slick','pendulum','motorbuild','rsslat']){await p.evaluate(k=>{const s=document.getElementById('wsPre');s.value=k;s.dispatchEvent(new Event('change'))},k);await w(900);
 const r=await p.evaluate(()=>{const S=GX.ws.ST,T=GX.ws.totals(S.bha);const rows=document.querySelectorAll('#wsBody tr[data-i]').length;const sim=document.querySelectorAll('#wsBody tr[data-i] .wsSim').length;return {n:S.bha.length,rows,sim,len:T.len,kg:T.kg,m:S.meshes.length,bit:/bit/i.test(S.bha[0].n),live:/LIVE/.test(document.getElementById('wshop').textContent),tot:document.getElementById('wsTot').textContent}});
 ok(r.rows==r.n&&r.sim==r.n&&r.m==r.n&&r.bit&&!r.live&&r.len>50&&r.kg>5000,k+': '+r.n+' items, '+r.len.toFixed(1)+' m, '+(r.kg/1000).toFixed(2)+' t, all SIM, no LIVE, bit at row 1');
 if(k=='motorbuild'||k=='rsslat')await p.screenshot({path:SH+'102_v54_bha_'+k+'.png'})}
const before=await p.evaluate(()=>GX.ws.ST.bha.map(x=>x.k).join());
await p.evaluate(()=>{const s=document.getElementById('wsAddK');s.value='jar';document.getElementById('wsAdd').click()});await w(500);
ok(await p.evaluate(()=>GX.ws.ST.bha[1].k=='jar'),'Add inserts a jar above the bit');
await p.evaluate(()=>document.querySelector('#wsBody tr[data-i="1"] button[data-a="up"]').click());await w(400);
ok(await p.evaluate(()=>GX.ws.ST.bha[2].k=='jar'),'▼ moves it away from the bit');
await p.evaluate(()=>document.querySelector('#wsBody tr[data-i="2"] button[data-a="rm"]').click());await w(400);
ok(await p.evaluate(()=>GX.ws.ST.bha.map(x=>x.k).join())==before,'✕ removes it (back to preset order)');
const lb=await p.evaluate(()=>{const T0=GX.ws.totals(GX.ws.ST.bha).len;const inp=document.querySelector('#wsBody tr[data-i="5"] input[data-f="len"]');inp.value='20';inp.dispatchEvent(new Event('change'));return T0});await w(400);
ok(await p.evaluate(()=>/20/.test(String(GX.ws.ST.bha[5].len))),'edit length updates item');
ok(await p.evaluate(()=>{const it={od:165,id:71,len:9.1};const kg=GX.ws.kgOf(it);return kg>1100&&kg<1250}),'steel tube weight estimate (6½in DC 9.1 m ≈ '+(await p.evaluate(()=>GX.ws.kgOf({od:165,id:71,len:9.1}))).toFixed(0)+' kg)');
g=await geo();ok(g.vb<=g.st+1,'BHA 3D view above the sheet');
const bb=await p.evaluate(()=>{const S=GX.ws.ST;return S.meshes.every(m=>{const v=m.getWorldPosition(new m.position.constructor());return Math.abs(v.x)<0.01&&Math.abs(v.z)<0.01})});ok(bb,'BHA lies along the wellbore axis');
await p.evaluate(()=>{const s=document.getElementById('wsPre');s.value='motorbuild';s.dispatchEvent(new Event('change'))});await w(800);
await p.evaluate(()=>document.querySelector('#wsBody tr[data-i="1"] td:nth-child(2)').click());await w(400);
await p.screenshot({path:SH+'102_v54_bha_component_info.png'});
await p.evaluate(()=>document.getElementById('wsClose').click());await w(800);
ok(await p.evaluate(()=>getComputedStyle(document.getElementById('wshop')).display=='none'&&!!window.MOB),'Close returns to the game');
await p.screenshot({path:SH+'102_v54_back_to_game.png'});
ok(ext.length==0,'no Adaga / proxy / WITSML requests ('+ext.length+')');ok(errs.length==0,'no page errors '+errs.join(' | ').slice(0,200));
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);
