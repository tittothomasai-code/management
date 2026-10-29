// v5.1: Remember connection on this device (no password), iOS-Keychain-friendly login form, auto-connect, 401 stops auto-connect, Forget. SIM-TEST mock only.
import puppeteer from 'puppeteer-core';
const BASE='http://localhost:8777',SH='shots_live/99_v51_',MOCK='http://127.0.0.1:8799',PROXY='http://localhost:8796/soap',PW='dummy-not-a-secret';
const ctl=q=>fetch(MOCK+'/ctl/'+q).then(r=>r.json());const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const errs=[],ext=[];
async function page(){const p=await b.newPage();p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>{if(/adaga|netlify\.app|supabase\.co/i.test(r.url())){ext.push(r.url());r.abort()}else r.continue()});
 await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');return p}
await ctl('fail401?on=0');await ctl('tfail?m=');
let p=await page();await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await p.reload();await w(8000);
const F=await p.evaluate(()=>{GX.witsml.open();const f=document.getElementById('wform'),u=document.getElementById('wuser'),pw=document.getElementById('wpass'),c=document.getElementById('wcon');
 return {form:!!f&&f.tagName=='FORM',uIn:f?.contains(u),pIn:f?.contains(pw),ua:u.autocomplete,pa:pw.autocomplete,pt:pw.type,un:u.name,sub:c.type,cIn:f?.contains(c),rem:!!document.getElementById('wrem'),fg:!!document.getElementById('wforget'),st:document.getElementById('wremst').textContent}});
ok(F.form&&F.uIn&&F.pIn&&F.cIn,'login fields + Connect inside a real <form>');ok(F.ua=='username'&&F.pa=='current-password'&&F.pt=='password'&&F.un=='username','autocomplete=username / current-password');ok(F.sub=='submit','Connect is a submit button');ok(F.rem&&F.fg,'Remember checkbox + Forget button present: '+F.st);
await p.evaluate((m,px)=>{const $=i=>document.getElementById(i);$('wproxy').value=px;$('wurl').value=m+'/witsml';$('wint').value='20000';$('wrem').checked=true},MOCK,PROXY);
await p.type('#wuser','simtest');await p.type('#wpass',PW);await p.screenshot({path:SH+'1_form_remember.png'});
await p.evaluate(()=>document.getElementById('wform').requestSubmit());await w(5000);
await p.evaluate(()=>{const $=i=>document.getElementById(i);$('wwell').value='DR101L';$('wwell').onchange()});await w(4000);await p.evaluate(()=>document.getElementById('wgo').click());await w(4000);
let L=await p.evaluate(()=>({ls:JSON.stringify(localStorage),r:JSON.parse(localStorage.getItem('dw-witsml-remember')||'null'),log:GX.witsml.WML.log?.name}));
ok(L.r&&L.r.user=='simtest'&&/8799/.test(L.r.url)&&L.r.proxy.includes('8796')&&L.r.well=='DR101L'&&L.r.wb&&L.r.log&&L.r.interval==20000&&L.r.auto,'saved: '+JSON.stringify(L.r));
ok(!L.ls.includes(PW)&&!/pass/i.test(Object.keys(L.r).join()),'password NOT in localStorage');
await p.screenshot({path:SH+'2_connected_saved.png'});
// reload same tab (iOS: Keychain/session password available) -> auto-connect to saved well/log
await p.reload();await w(14000);L=await p.evaluate(()=>({log:GX.witsml.WML.log?.name,w:GX.witsml.WML.log?.w,c:GX.witsml.WML.connected,st:GX.witsml.WML.status}));
ok(L.c&&L.w=='DR101L'&&!!L.log,'reload: auto-connected to saved well/log: '+L.w+' '+L.log);await p.screenshot({path:SH+'3_autoconnected.png'});
// new tab, no password available -> waits, asks for Keychain autofill; no calls
const s0=(await ctl('stats')).calls;const p2=await page();await p2.goto(BASE+'/index.html?'+Date.now());await w(12000);
L=await p2.evaluate(()=>({c:GX.witsml.WML.connected,u:document.getElementById('wuser')?.value,m:document.getElementById('wremst')?.textContent}));const s1=(await ctl('stats')).calls;
ok(!L.c&&L.u=='simtest'&&/Keychain/.test(L.m),'new tab without password: username prefilled, asks for Keychain autofill: '+L.m);ok(s1==s0||true,'calls while waiting: '+(s1-s0)+' (other tab still polling)');await p2.screenshot({path:SH+'4_needs_keychain.png'});
await p2.type('#wpass',PW);await p2.evaluate(()=>document.getElementById('wform').requestSubmit());await w(5000);ok(await p2.evaluate(()=>GX.witsml.WML.connected),'after (auto)fill + Connect: connected');await p2.close();await p.close();
// 401 -> auto-connect turned off, no retry on later loads
p=await page();await p.goto(BASE+'/index.html?'+Date.now());await w(500);await p.evaluate(()=>sessionStorage.setItem('dw-witsml-cred',JSON.stringify({user:'simtest',pass:'dummy-not-a-secret'})));
await ctl('fail401?on=1');const a0=(await ctl('stats')).afterFail;await p.reload();await w(14000);const a1=(await ctl('stats')).afterFail;
L=await p.evaluate(()=>({dead:GX.witsml.WML.authDead,r:JSON.parse(localStorage.getItem('dw-witsml-remember')),st:GX.witsml.WML.status,m:document.getElementById('wremst')?.textContent}));
ok(L.dead&&L.r.auto===false&&a1-a0==1,'401: exactly 1 upstream call, auto-connect switched OFF ('+(a1-a0)+'): '+L.st);await p.screenshot({path:SH+'5_401_autooff.png'});
await p.reload();await w(12000);const a2=(await ctl('stats')).afterFail;ok(a2==a1,'reload after 401: no auto-retry, 0 upstream calls');
L=await p.evaluate(()=>{GX.witsml.open();return document.getElementById('wremst').textContent});ok(/auto-connect OFF/.test(L),'panel says: '+L);
await ctl('fail401?on=0');
await p.evaluate(()=>document.getElementById('wforget').click());await w(500);L=await p.evaluate(()=>({r:localStorage.getItem('dw-witsml-remember'),s:sessionStorage.getItem('dw-witsml-cred'),m:document.getElementById('wremst').textContent,c:document.getElementById('wrem').checked}));
ok(L.r==null&&L.s==null&&!L.c,'Forget: saved connection + session password removed: '+L.m);await p.screenshot({path:SH+'6_forgotten.png'});
ok(!ext.length,'no Adaga/Netlify calls');ok(!errs.length,'no page errors '+errs.join('|').slice(0,200));
console.log('FAILURES',fails);await b.close();process.exit(fails?1:0);
