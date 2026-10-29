// v4.4 iPhone test: bit-depth tracking + new-pipe animation on SIM-TEST synthetic timeline. Offline, NO Adaga calls.
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/',PFX=process.argv[3]||'80';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const p=await b.newPage();const errs=[],cerr=[],ext=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()=='error')cerr.push(m.text())});
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co/i.test(u)){ext.push(u);r.abort()}else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
ok(await p.evaluate(()=>!!window.GX?.bit),'ext7 loaded');
await p.evaluate(()=>document.getElementById('btnBit').click());await w(800);
ok(await p.evaluate(()=>MOB.openId=='bitp'),'Bit depth opens as phone sheet');
await p.screenshot({path:SH+PFX+'_v44_iphone_bit_panel_sim.png'});
await p.evaluate(()=>{GX.bit.simStart();GX.bit.pause()});await w(500);
const s0=await p.evaluate(()=>GX.bit.state());ok(s0.st.conns==3||s0.st.conns==4,'SIM-TEST timeline connections: '+s0.st.conns);
// drilling: bit on bottom, string bit depth follows data
await p.evaluate(()=>GX.bit.seek(GX.bit.state().st.t0+600));await w(800);
const a=await p.evaluate(()=>({bd:GX.bit.state().disp.bd,ph:G.PH.bitDepth(G.S),md:G.S.md,tag:document.getElementById('bttag')?.textContent,sim:document.getElementById('sim').textContent,txt:document.getElementById('btread').textContent}));
console.log(JSON.stringify(a));ok(Math.abs(a.bd-a.ph)<0.5,'3D string bit depth = data bit depth');ok(Math.abs(a.bd*0.3048-1005)<2,'bit ≈1005 m at t0+600 s (ROP 30 m/h)');ok(a.tag=='SIM-TEST'&&!/LIVE/.test(a.sim+a.txt),'labelled SIM-TEST, never LIVE');ok(/on bottom/.test(a.txt),'bit on bottom shown');
// smooth interpolation: two close times give close depths
const d1=await p.evaluate(async()=>{GX.bit.seek(GX.bit.state().st.t0+601);await new Promise(r=>setTimeout(r,1200));return GX.bit.state().disp.bd});ok(Math.abs(d1-a.bd)<0.2&&d1>a.bd,'smooth (1 s → +'+((d1-a.bd)*0.3048).toFixed(3)+' m)');
// connection: off bottom + animation
const c=await p.evaluate(()=>{const R=GX.conn.detect(GX.conn.synth({joints:4,len:9.4,start_m:1000}).rows).connections;return R.map(c=>({i:c.tSlipsIn,o:c.tSlipsOut}))});
const shots=[[0.12,'lift'],[0.33,'stab'],[0.5,'spin'],[0.85,'lower']];let k=1;
for(const [f,n] of shots){await p.evaluate(t=>GX.bit.seek(t),c[1].i+f*((c[1].o+30)-c[1].i));await w(900);
 const st=await p.evaluate(()=>{const s=GX.bit.state();const a=GX.bit.anim();return{cap:s.cap,anim:s.anim,off:document.getElementById('btoff')?.textContent,y:a&&a.position.y,rx:a&&a.rotation.z}});console.log(n,JSON.stringify(st));
 ok(st.anim&&new RegExp({lift:'Lift',stab:'Stab',spin:'spin',lower:'Lower'}[n]).test(st.cap),'animation phase '+n+': '+st.cap);
 if(n=='lift')ok(/OFF|[0-9]/.test(st.off||'')&&!/on bottom/.test(st.off),'bit off bottom during connection');
 if(k==1){await p.evaluate(()=>{document.getElementById('bitp').style.display='none';G.view&&G.view([10,16,12],[0,13,0])});await w(600)}
 await p.screenshot({path:SH+(+PFX+k)+'_v44_iphone_newpipe_'+n+'.png'});k++}
ok(await p.evaluate(()=>/9\.4 m single/.test(GX.bit.state().cap)),'uses detected joint length (9.4 m single)');
// toggle off
await p.evaluate(()=>{document.getElementById('btnBit').click();document.getElementById('btnBit').click()});await w(500);
await p.evaluate(()=>{const e=document.getElementById('btani');e.checked=false;e.dispatchEvent(new Event('change'))});await w(600);ok(await p.evaluate(()=>!GX.bit.state().anim),'animation toggle off hides it');
await p.evaluate(()=>{const e=document.getElementById('btani');e.checked=true;e.dispatchEvent(new Event('change'));const f=document.getElementById('btfol');f.checked=true;f.dispatchEvent(new Event('change'))});
// follow cam + after connection
await p.evaluate(()=>GX.bit.seek(GX.bit.state().st.t0+3600));await w(2500);
const fo=await p.evaluate(()=>{const m=G._scene.getObjectByName('bitMarker');const t=GX.bit.opt.follow;return{t,d:m?m.position.distanceTo(G._scene.getObjectByName('bitMarker').position):0,tgt:window.G?.ctl?1:0}});ok(fo.t,'camera follow on');
await p.screenshot({path:SH+(+PFX+5)+'_v44_iphone_follow_bit.png'});
await p.evaluate(()=>{document.getElementById('bitp').style.display='';MOB.open('bitp')});await w(500);await p.screenshot({path:SH+(+PFX+6)+'_v44_iphone_bit_strip_geology.png'});
await p.evaluate(()=>U.set('imperial'));await w(600);ok(await p.evaluate(()=>/ft/.test(document.getElementById('btread').textContent)),'imperial readout ft');await p.evaluate(()=>U.set('metric'));
ok(ext.length==0,'no external requests: '+ext.length);ok(errs.length==0&&cerr.length==0,'no page/console errors '+errs.concat(cerr).slice(0,3).join(' | '));
console.log(fails?'FAILS '+fails:'ALL PASS');await b.close();process.exit(fails?1:0);
