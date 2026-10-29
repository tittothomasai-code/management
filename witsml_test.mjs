// WITSML + any-signal traces test. Needs: node witsml_proxy.mjs (port 8796). Usage: LNA_OFF=1 node witsml_test.mjs [url] [outdir]
import puppeteer from 'puppeteer-core';
const URL=process.argv[2]||'http://localhost:8777/index.html';const OUT=process.argv[3]||'shots';
const args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'];if(process.env.LNA_OFF)args.push('--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args});const p=await b.newPage();await p.setViewport({width:1500,height:900});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()=='error')errs.push(m.text())});const w=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto(URL);await w(6000);await p.evaluate(()=>localStorage.clear());await p.reload();await w(6000);
const r1=await p.evaluate(()=>{GX.addPumpType('Triplex 2200 HP (14in)');GX.addPumpType('Triplex 2200 HP (14in)');GX.placeLib('surface_mud_motor');GX.placeLib('standpipe_manifold');GX.addBha('mwd');GX.addBha('jar');GX.addSensor(0.4,'Sensor A');
 G.S.pumps.forEach(p=>{p.on=true;p.cmd=50});G.run(10);const c=GX.traces.catalogue();return{pumps:G.S.pumps.length,cat:c.length,eq:c.filter(x=>x.id.startsWith('eq.')).length,parts:c.filter(x=>x.label.split(' › ').length>2).length,state:c.filter(x=>x.id.startsWith('st.')).length,seq:c.filter(x=>x.id.startsWith('seq')).length}});
await p.evaluate(()=>{GX.traces.addTrack('spp');GX.traces.addTrack('p1.spm');for(let i=0;i<40;i++)G.run(0.25)});
// WITSML connect to SIMULATED store
await p.evaluate(()=>document.getElementById('wbtn').click());await w(500);await p.evaluate(()=>document.getElementById('wsim').click());await w(3000);
const lists=await p.evaluate(()=>({st:document.getElementById('wst').textContent,wells:[...document.querySelectorAll('#wwell option')].map(o=>o.textContent),logs:[...document.querySelectorAll('#wlog option')].map(o=>o.value)}));
await p.evaluate(()=>{document.getElementById('wlog').value='SIM-TIME';document.getElementById('wlog').dispatchEvent(new Event('change'));document.getElementById('wgo').click()});
await w(7000);await p.evaluate(()=>{G.run(3)});await w(2500);
const live=await p.evaluate(()=>{const W=GX.witsml.WML;return{st:W.status,rows:W.rows,polls:W.polls,ch:Object.keys(W.channels).length,map:GX.witsml.CFG.map,spp:G.S.spp,src:{...G.SRC||{}},p1:G.S.pumps[0].spm,tag:W.tag(),feed:document.getElementById('ftxt').textContent}});
await p.screenshot({path:OUT+'/18_witsml_connect_mapping.png'});
// depth log too
const depth=await p.evaluate(async()=>{const L=(await GX.witsml.listLogs('SIM-W1','SIM-WB1')).find(l=>l.uid=='SIM-DEPTH');return{type:L.indexType,end:L.end,curves:L.curves.length}});
// traces: live-channel mapped + unmapped, pump SPM driven, formula, deep equipment part
await p.evaluate(()=>{document.getElementById('wx').click();const T=GX.traces;T.open(true);['wml:SPPA','wml:TVA','spp','p1.spm','tq'].forEach(T.addTrack);
 T.addFormula('Total flow','gpm','[p1.flow]+[p2.flow]+[p3.flow]');T.addFormula('SPP vs baseline','psi','[spp]-base[spp]');
 const rot=T.catalogue().find(c=>/Rotor › rpm/.test(c.label));if(rot)T.addTrack(rot.id);const mwd=T.catalogue().find(c=>/MWD tool.*Pulser › pressure/.test(c.label));if(mwd)T.addTrack(mwd.id);
 const s=document.getElementById('trwin');s.value=30;s.dispatchEvent(new Event('change'))});
for(let i=0;i<6;i++){await w(1500);await p.evaluate(()=>G.run(2))}
await p.evaluate(()=>{G.view([-30,22,40],[-6,10,0])});await w(1500);await p.screenshot({path:OUT+'/19_traces_witsml_formula_parts.png'});
// searchable tree
await p.evaluate(()=>{const q=document.getElementById('trq');q.value='rotor';q.dispatchEvent(new Event('input'))});await w(800);await p.screenshot({path:OUT+'/20_signal_tree_search.png'});
await p.evaluate(()=>{const q=document.getElementById('trq');q.value='';q.dispatchEvent(new Event('input'))});await w(500);
await p.evaluate(()=>{const f=document.getElementById('trsrcf');f.value='live';f.dispatchEvent(new Event('change'));const q=document.getElementById('trq');q.value='';q.dispatchEvent(new Event('input'))});await w(800);await p.screenshot({path:OUT+'/21_signal_tree_live_only_filter.png'});
const tr=await p.evaluate(()=>{const T=GX.traces.TR;return T.tracks.map(t=>[t.id,(t.srcs||[]).at(-1),(T.data[t.id]||[]).filter(v=>v!=null).length])});
await p.evaluate(()=>{document.getElementById('trtbox').style.display='none';G.select(G.ents.find(e=>e.st&&e.st.id==1).name)});await w(1200);await p.screenshot({path:OUT+'/22_pump_panel_source_badge.png'});
const badges=await p.evaluate(()=>[...document.querySelectorAll('.srcpill,.srcb')].map(x=>x.textContent).slice(0,12));
const csv=await p.evaluate(()=>GX.traces.toCSV().split('\n').slice(0,2).join(' / ').slice(0,300));
const leak=await p.evaluate(()=>JSON.stringify(localStorage).includes('secretpw'));
console.log(JSON.stringify({r1,lists,live,depth,tr,badges,csv},null,0));console.log('ERRORS',errs.length,errs);await b.close();
