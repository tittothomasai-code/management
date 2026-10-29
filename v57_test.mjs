// v5.7 UI simplification test (iPhone 390x844 + desktop 1440x900). No Adaga/WITSML network.
import puppeteer from 'puppeteer-core';const BASE=process.argv[2]||'http://localhost:8777';const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const ext=[],errs=[];
for(const [nm,vp,ua] of [['iphone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'],['desktop',{width:1440,height:900},null]]){
const p=await b.newPage();p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>{if(/adaga|netlify\.app|supabase\.co|witsml|:8796|:8799/i.test(r.url())){ext.push(r.url());r.abort()}else r.continue()});
await p.setViewport(vp);if(ua)await p.setUserAgent(ua);await p.goto(BASE+'/index.html?'+Date.now());await w(10000);
const V=()=>p.evaluate(()=>[...document.body.children].filter(e=>e.id!='uiTop'&&e.id!='uiNav'&&e.id!='uiX'&&e.id!='appVer'&&getComputedStyle(e).display!='none'&&/fixed|absolute/.test(getComputedStyle(e).position)&&/DIV|SECTION/.test(e.tagName)&&e.getBoundingClientRect().height>0).map(e=>e.id||e.className));
const v0=await V();ok(v0.length==0,nm+': rig full screen, no panels open at start ('+v0.join(',')+')');
const top=await p.evaluate(()=>document.getElementById('uiTop').innerText);ok(/SIM well/.test(top)&&/Bit [\d.]+ m/.test(top)&&/ROP/.test(top)&&/(Rotate|Slide|Off bottom|Pumps off)/.test(top)&&/SIM/.test(top)&&!/LIVE/.test(top)&&/TEST player/.test(top),nm+': minimal HUD: '+top.replace(/\n/g,' | '));
const tabs=await p.evaluate(()=>[...document.querySelectorAll('#uiNav button')].map(b=>b.innerText.replace(/\n/g,' ')));ok(tabs.length==5,nm+': 5 tabs '+tabs.join(' / '));
const dup=await p.evaluate(()=>{const t=[...document.querySelectorAll('button')].filter(b=>b.offsetParent||getComputedStyle(b).display!='none').map(b=>b.textContent.trim()).filter(Boolean);document.getElementById('uiTab_tools').click();const s=[...document.querySelectorAll('#uiTools button')].map(b=>b.textContent.trim());return {dups:s.filter((x,i)=>s.indexOf(x)!=i),n:s.length,hudVis:getComputedStyle(document.getElementById('hud')).display}});
ok(dup.dups.length==0&&dup.n>15&&dup.hudVis=='none',nm+': Tools has '+dup.n+' controls, no duplicates, old toolbar hidden');await w(400);
const tv=await V();ok(tv.length==1&&tv[0]=='uiTools',nm+': Tools open alone');
await p.evaluate(()=>document.getElementById('btnBhaB').click());await w(1200);const bv=await V();ok(!bv.includes('uiTools')&&bv.length==1,nm+': opening BHA from Tools closes Tools (open: '+bv.join(',')+')');
await p.evaluate(()=>document.getElementById('uiTab_sheet').click());await w(1200);const sv=await V();ok(sv.length==1&&sv[0]=='ss56',nm+': Slide sheet tab, one panel ('+sv.join(',')+')');
await p.evaluate(()=>document.getElementById('uiTab_crew').click());await w(600);const cv=await V();ok(cv.length==1&&cv[0]=='chatSheet',nm+': Crew tab opens chat alone');
const xr=await p.evaluate(()=>{const x=document.getElementById('uiX');return getComputedStyle(x).display});ok(xr=='block',nm+': close button shown');await p.evaluate(()=>document.getElementById('uiX').click());await w(500);ok((await V()).length==0,nm+': close button closes the panel');
await p.evaluate(()=>document.getElementById('uiTab_data').click());await w(900);const dv=await V();ok(dv.length==1&&dv[0]=='traces',nm+': Data tab opens traces ('+dv.join(',')+')');
await p.evaluate(()=>document.getElementById('uiTab_rig').click());await w(500);ok((await V()).length==0,nm+': Rig tab closes all');
if(nm=='iphone'){const nb=await p.evaluate(()=>{const r=document.getElementById('uiNav').getBoundingClientRect();return {bottom:r.bottom,height:r.height}});ok(nb.bottom<=844&&nb.height<=60,'iphone: nav at bottom, '+nb.height+'px')}
await p.close()}
ok(ext.length==0,'no Adaga / proxy / WITSML requests');ok(errs.length==0,'no page errors '+errs.join('|').slice(0,200));
await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);
