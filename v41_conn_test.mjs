// v4.1: never-silent WITSML actions on iPhone viewport. Hosted proxy intercepted (no network, NO Adaga calls).
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/'+(process.argv[3]||'');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);let hits=0;
p.on('request',r=>{if(r.url().includes('/functions/v1/witsml-proxy')){if(r.method()=='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST'}});hits++;return r.respond({status:502,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"result":-1,"error":"Upstream TLS certificate failed verification."}'})}r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2000);await p.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await p.reload();await w(8000);
await p.evaluate(()=>GX.witsml.open());await w(800);
const vis=await p.evaluate(()=>['wuser','wpass','wcon'].map(id=>{const e=document.getElementById(id);if(!e)return [id,false];e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return [id,!!e.offsetParent&&r.width>40&&r.height>=36&&r.top>=0&&r.bottom<=innerHeight,Math.round(r.height)]}));
console.log(JSON.stringify(vis));ok(vis.every(v=>v[1]),'username, password and Connect visible on phone (≥36px tall)');
const toastTxt=()=>p.evaluate(()=>{const t=document.getElementById('wtoast');return t&&t.getBoundingClientRect().height>0?t.textContent:''});
for(const [id,name] of [['svgo','Start survey feed'],['wrep','Load full well replica'],['wgo','Start live']]){await p.evaluate(()=>{const t=document.getElementById('wtoast');if(t)t.style.display='none'});await p.evaluate(i=>{const e=document.getElementById(i);e.scrollIntoView({block:'nearest'});e.click()},id);await w(500);const t=await toastTxt();ok(/Not connected — enter Adaga login in WITSML panel and press Connect/.test(t),name+' while not connected -> clear message');}
await p.evaluate(()=>document.getElementById('svgo').scrollIntoView({block:'nearest'}));await p.evaluate(()=>document.getElementById('svgo').click());await w(400);
console.log('toast',await p.evaluate(()=>{const t=document.getElementById('wtoast');const c=getComputedStyle(t);return [t.style.display,c.display,c.visibility,c.opacity,JSON.stringify(t.getBoundingClientRect())]}));await p.screenshot({path:SH+'66_v41_iphone_not_connected_msg.png'});
ok(hits==0,'no proxy calls while not connected');
await p.evaluate(()=>{document.getElementById('wuser').value='';document.getElementById('wpass').value='';document.getElementById('wcon').click()});await w(500);ok(/username and password/.test(await toastTxt()),'Connect with empty login -> asks for credentials');ok(hits==0,'still no proxy call');
await p.evaluate(()=>{document.getElementById('wuser').value='tuser';document.getElementById('wpass').value='x-not-real';document.getElementById('wcon').click()});await w(1500);const t2=await toastTxt();console.log('connect error toast:',t2);ok(/Connect failed: .*(certificate|cannot reach)/.test(t2),'proxy error shown clearly');
await p.screenshot({path:SH+'67_v41_iphone_connect_error_msg.png'});
ok(errs.length==0,'no page errors '+errs.join('|'));await b.close();console.log(fails?'FAILURES '+fails:'ALL PASS');process.exit(fails?1:0);
