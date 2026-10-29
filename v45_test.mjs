// v4.5 iPhone test (390x844): slips inferred from bit depth on SIM-TEST synthetic data with slips + hookload curves REMOVED. Offline, NO Adaga calls.
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/90_v45_';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const p=await b.newPage();const errs=[],cerr=[],ext=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()=='error')cerr.push(m.text())});
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co/i.test(u)){ext.push(u);r.abort()}else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
await p.evaluate(()=>document.getElementById('btnBit').click());await w(600);
await p.evaluate(()=>{const e=document.getElementById('btsinf');e.checked=true;e.dispatchEvent(new Event('change'));GX.bit.simStart({inferred:true});GX.bit.pause()});await w(600);
const st=await p.evaluate(()=>GX.bit.state().st);ok(st.conns==4,'SIM-TEST (no slips/hookload) timeline connections from bit depth: '+st.conns+'/4');
const R=await p.evaluate(()=>GX.bit.slipsRes().intervals.map(v=>({i:v.tIn,o:v.tOut,c:v.conf,k:v.kind,s:v.inSlips})));console.log(JSON.stringify(R));
const c=R.filter(v=>v.s&&v.k=='connection');
// mid-slips of connection 2
await p.evaluate(t=>GX.bit.seek(t),(c[1].i+c[1].o)/2);await w(1200);
const a=await p.evaluate(()=>({sl:GX.bit.slips(),S:G.S.slips,txt:document.getElementById('btslips').textContent,hud:document.getElementById('bithud').textContent,tag:document.getElementById('bttag')?.textContent,sim:document.getElementById('sim').textContent,anim:GX.bit.state().anim,cap:GX.bit.state().cap}));console.log(JSON.stringify(a));
ok(a.sl.inSlips&&a.sl.src=='inferred'&&a.S===true,'in slips (inferred) mid-connection, 3D slips set');ok(/SLIPS IN/.test(a.txt)&&/Inferred from bit depth/.test(a.txt),'panel: SLIPS IN + "Inferred from bit depth"');
ok(/SLIPS IN/.test(a.hud)&&/inferred \d+%/.test(a.hud),'top bar: SLIPS IN (inferred NN%)');ok(a.anim&&/Connection #2/.test(a.cap),'new-pipe animation triggered by inferred slips: '+a.cap);
ok(a.tag=='SIM-TEST'&&!/LIVE/.test(a.sim+a.txt+a.hud),'labelled SIM-TEST, never LIVE');
await p.screenshot({path:SH+'1_iphone_slips_in_panel.png'});
const band=await p.evaluate(()=>{const cv=document.getElementById('btband');const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]>150&&d[i+2]<120)n++;cv.scrollIntoView();return n});ok(band>500,'slips band drawn on timeline ('+band+' px)');
await w(400);await p.screenshot({path:SH+'2_iphone_slips_band_timeline.png'});
// drilling: slips out
await p.evaluate(t=>GX.bit.seek(t),c[1].o+400);await w(1000);
const d=await p.evaluate(()=>({sl:GX.bit.slips(),txt:document.getElementById('btslips').textContent,on:document.getElementById('btoff').textContent}));ok(!d.sl.inSlips&&/out/.test(d.txt),'drilling: slips out ('+d.txt+')');
await p.evaluate(()=>{document.getElementById('bitp').style.display='none'});await p.evaluate(t=>GX.bit.seek(t),c[2].i+0.3*(c[2].o+30-c[2].i));await w(1200);
await p.screenshot({path:SH+'3_iphone_hud_newpipe_inferred.png'});
// advanced settings
await p.evaluate(()=>{document.getElementById('bitp').style.display='';MOB.open('bitp');document.getElementById('btadv').open=true;document.getElementById('btadv').scrollIntoView()});await w(500);
await p.screenshot({path:SH+'4_iphone_advanced_settings.png'});
const adv=await p.evaluate(async()=>{const e=document.querySelector('[data-so="minDwell_s"]');e.value='400';e.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,500));const n1=GX.bit.state().st.conns;
 document.getElementById('btsrst').click();await new Promise(r=>setTimeout(r,500));return{n1,n2:GX.bit.state().st.conns,unit:document.querySelector('[data-so="flatTol_m"]').parentElement.textContent}});
ok(adv.n1==0&&adv.n2==4,'min dwell 400 s -> '+adv.n1+' conns; reset -> '+adv.n2);ok(/\(m\)/.test(adv.unit),'metric by default: '+adv.unit.trim());
// false positives in page: tripping + short pump-off, Connections panel label
const fp=await p.evaluate(async()=>{const SL=await import('./slips.js?v=45');const t=SL.synthTrip({stands:5,noise:0.05});const s=GX.conn.synth({joints:5,pumpBlip_at:2,pumpBlip_s:30});
 return{trip:GX.conn.detect(t.rows).connections.length,blip:GX.conn.detect(SL.strip(s.rows,{noise:0.05})).connections.length,src:GX.conn.detect(SL.strip(s.rows)).info.slipsFrom}});
ok(fp.trip==0&&fp.blip==5&&fp.src=='Inferred from bit depth','in-page: tripping 0 conns, 30 s pump-off 5/5, source label');
await p.evaluate(()=>U.set('imperial'));await w(600);ok(await p.evaluate(()=>/\(ft\)/.test(document.querySelector('[data-so="flatTol_m"]').parentElement.textContent)),'imperial switch shows ft');await p.evaluate(()=>U.set('metric'));
ok(ext.length==0,'no external requests: '+ext.length);ok(errs.length==0&&cerr.length==0,'no page/console errors '+errs.concat(cerr).slice(0,3).join(' | '));
console.log(fails?'FAILS '+fails:'ALL PASS');await b.close();process.exit(fails?1:0);
