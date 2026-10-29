// v4.3 iPhone test: geology layer add/edit/delete + Connections panel on SIM-TEST synthetic data. Offline, NO Adaga calls.
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/',PFX=process.argv[3]||'70';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const p=await b.newPage();const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co/i.test(u)){ext.push(u);r.abort()}else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
await p.evaluate(()=>{G.S.md=2000;G.S._lastBD=null});await w(1500);
// ---- layers ----
await p.evaluate(()=>document.getElementById('btnLay').click());await w(1200);
const n0=await p.evaluate(()=>document.querySelectorAll('#geoLay [data-card]').length);
const ui=await p.evaluate(()=>{const r=e=>e&&e.getBoundingClientRect();const a=document.getElementById('lyadd'),bb=document.getElementById('lybit'),pk=document.querySelector('#geoLay input[type=color]'),inp=document.querySelector('#geoLay [data-ltm]');return{open:MOB.openId,add:a&&[r(a).width|0,r(a).height|0],bit:bb&&bb.textContent,pick:!!pk,inpH:inp?r(inp).height:0,inpF:inp?getComputedStyle(inp).fontSize:'',panelW:r(document.getElementById('geoLay')).width|0,vw:innerWidth}});
console.log('LAYERS UI',JSON.stringify(ui),'cards',n0);
ok(ui.open=='geoLay','Subsurface opens as phone sheet');ok(ui.add&&ui.add[1]>=44,'big “+ Add layer” button');ok(/bit depth/.test(ui.bit||''),'“Add layer at bit depth” button');ok(ui.pick,'colour picker present');ok(ui.inpH>=40&&ui.inpF=='16px','depth fields ≥40px tall, 16px font (no iOS zoom)');ok(ui.panelW<=ui.vw,'layer sheet fits 390px width');
await p.screenshot({path:SH+PFX+'_v43_iphone_layers_empty_or_sim.png'});
await p.tap('#lyadd');await w(800);const n1=await p.evaluate(()=>document.querySelectorAll('#geoLay [data-card]').length);ok(n1==n0+1,'tap + Add layer adds a card ('+n0+'→'+n1+')');
// edit name, top/base, colour on last card
await p.evaluate(()=>{const c=[...document.querySelectorAll('#geoLay [data-card]')].at(-1);const s=(sel,v)=>{const e=c.querySelector(sel);e.value=v;e.dispatchEvent(new Event(sel.includes('color')?'input':'change'))};s('[data-ln]','Sandstone A');});await w(400);
await p.evaluate(()=>{const c=[...document.querySelectorAll('#geoLay [data-card]')].at(-1);const e=c.querySelector('[data-ltm]');e.value='700';e.dispatchEvent(new Event('change'))});await w(400);
await p.evaluate(()=>{const c=[...document.querySelectorAll('#geoLay [data-card]')].at(-1);const e=c.querySelector('[data-lbm]');e.value='820';e.dispatchEvent(new Event('change'))});await w(400);
await p.evaluate(()=>{const c=[...document.querySelectorAll('#geoLay [data-card]')].at(-1);const e=c.querySelector('input[type=color]');e.value='#ff0000';e.dispatchEvent(new Event('input'))});await w(600);
const ed=await p.evaluate(()=>{const l=JSON.parse(localStorage.getItem('dw-geo')||'null');const c=[...document.querySelectorAll('#geoLay [data-card]')].at(-1);return{name:c.querySelector('[data-ln]').value,top:c.querySelector('[data-ltm]').value,base:c.querySelector('[data-lbm]').value,col:c.querySelector('input[type=color]').value}});
console.log('EDIT',JSON.stringify(ed));ok(ed.name=='Sandstone A'&&Math.abs(+ed.top-700)<0.6&&Math.abs(+ed.base-820)<0.6&&ed.col=='#ff0000','edit name / top / base (metric m) / colour persists after re-render');
await p.screenshot({path:SH+(+PFX+1)+'_v43_iphone_layer_edited.png'});
// add at bit depth
const bd=await p.evaluate(()=>G.PH?G.PH.bitDepth(G.S):null);
await p.tap('#lybit');await w(800);const ab=await p.evaluate(()=>[...document.querySelectorAll('#geoLay [data-ln]')].map(e=>e.value));console.log('AFTER BIT',JSON.stringify(ab),'bit ft',bd);ok(ab.some(n=>/New layer @/.test(n)),'Add layer at bit depth creates a layer at the bit');
await p.screenshot({path:SH+(+PFX+2)+'_v43_iphone_add_at_bit.png'});
// delete + undo
const k=await p.evaluate(()=>document.querySelectorAll('#geoLay [data-card]').length);await p.evaluate(()=>[...document.querySelectorAll('#geoLay [data-ldel]')].at(-1).click());await w(600);
const k2=await p.evaluate(()=>document.querySelectorAll('#geoLay [data-card]').length);ok(k2==k-1,'delete removes card');await p.tap('#lyundo');await w(600);ok(await p.evaluate(()=>document.querySelectorAll('#geoLay [data-card]').length)==k,'undo restores');
// imperial units
await p.evaluate(()=>U.set('imperial'));await w(800);const imp=await p.evaluate(()=>{const c=[...document.querySelectorAll('#geoLay [data-card]')].find(c=>c.querySelector('[data-ln]').value=='Sandstone A');return c&&+c.querySelector('[data-ltm]').value});ok(Math.abs(imp-700/0.3048)<2,'Imperial: top shown in ft ('+imp+')');await p.evaluate(()=>U.set('metric'));await w(500);
await p.evaluate(()=>document.getElementById('lyx').click());await w(500);
// ---- connections ----
await p.evaluate(()=>document.getElementById('btnConn').click());await w(1000);await p.evaluate(()=>GX.conn.setSource('sim'));await w(1200);
const cr=await p.evaluate(()=>{const r=GX.conn.result();return{open:MOB.openId,n:r&&r.kpi.connections,mode:r&&r.kpi.mode,len:r&&r.kpi.avgLen_m,rows:document.querySelectorAll('#cntab tr').length-1,kpi:document.getElementById('cnkpi')?.textContent,est:/Estimated from data/.test(document.getElementById('connp').textContent),tag:/SIM-TEST/.test(document.getElementById('connp').textContent),joints:r&&r.toolJoints.length,rings:(()=>{let n=0;G._scene.traverse(o=>{if(o.name=='toolJoints')n=o.children.length});return n})()}});
console.log('CONN',JSON.stringify(cr));ok(cr.open=='connp','Connections opens as phone sheet');ok(cr.n==8,'SIM-TEST 8 joints → 8 connections detected (30 s pump blip ignored)');ok(cr.mode=='single'&&Math.abs(cr.len-9.4)<0.3,'median joint ≈9.4 m single');ok(cr.rows==cr.n,'table rows = connections');ok(cr.est&&cr.tag,'labelled “Estimated from data” and SIM-TEST');ok(cr.rings>0,'tool-joint rings in 3D ('+cr.rings+')');
await p.screenshot({path:SH+(+PFX+3)+'_v43_iphone_connections_simtest.png'});
await p.evaluate(()=>document.getElementById('cntab').scrollIntoView());await w(300);await p.screenshot({path:SH+(+PFX+4)+'_v43_iphone_connections_table.png'});
// threshold change
await p.evaluate(()=>{const e=document.querySelector('#connp [data-o=minSlips_s]');e.value='600';e.dispatchEvent(new Event('change'))});await w(600);ok(await p.evaluate(()=>GX.conn.result().kpi.connections)==0,'threshold min in-slips 600 s → 0 (configurable)');
await p.evaluate(()=>{localStorage.removeItem('dw-conn-opt');document.getElementById('cnrst').click()});await w(600);ok(await p.evaluate(()=>GX.conn.result().kpi.connections)==8,'reset thresholds → 8');
// csv export
const csv=await p.evaluate(()=>new Promise(res=>{const o=URL.createObjectURL;URL.createObjectURL=bl=>{bl.text().then(res);return o.call(URL,bl)};document.getElementById('cncsv').click()}));ok(csv.split('\n').length>=10&&/Estimated/.test(csv),'CSV export ('+csv.split('\n').length+' lines)');
// 3D view of rings
await p.evaluate(()=>{MOB.open&&MOB.open(null);document.getElementById('under').click();G.view([20,-10,20],[0,-25,0])});await w(1500);await p.screenshot({path:SH+(+PFX+5)+'_v43_iphone_tooljoint_rings.png'});
ok(ext.length==0,'no external (Adaga/proxy) requests: '+ext.length);ok(errs.length==0,'no page errors '+errs.slice(0,3).join(' | '));
console.log(fails?'FAILS '+fails:'ALL PASS');await b.close();process.exit(fails?1:0);
