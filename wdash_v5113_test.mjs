// v5.12.13 WITSML connection test: mocked proxy behaves like the hosted proxy (header creds required on EVERY call,
// body creds rejected, self-closing wellbore elements). Checks wells->wellbores->logs load, password cleared from the
// field but kept in page memory, never persisted; clear auth / proxy / empty / SOAP-fault messages. node wdash_v5113_test.mjs [base]
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://127.0.0.1:18793').replace(/\/$/,'');const w=ms=>new Promise(r=>setTimeout(r,ms));
let f=0,p=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?p++:f++};
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"',GOOD='Basic '+Buffer.from('tester:S3cret-pw-XYZ').toString('base64');
let mode='ok',calls=[];
function proxy(r){const h=r.headers(),j=JSON.parse(r.postData()||'{}');calls.push({op:j.op,t:j.wmlType,auth:h['x-witsml-authorization']||''});
 if('user' in j||'pass' in j)return [400,{result:-1,error:'send credentials in X-Witsml-Authorization, not the body'}];
 const a=h['x-witsml-authorization']||'';if(!/^Basic [A-Za-z0-9+/=]{4,}$/.test(a))return [400,{result:-1,error:'credentials required (X-Witsml-Authorization: Basic …)'}];
 if(a!=GOOD)return [401,{result:-1,error:'Authentication failed (401)'}];
 if(j.op=='WMLS_GetVersion')return [200,{result:1,version:'1.4.1.1'}];
 if(j.wmlType=='well')return [200,{result:1,xml:`<wells ${NS}><well uid="MW1"><name>Mock Well</name></well></wells>`}];
 if(j.wmlType=='wellbore'){if(mode=='fault')return [200,{result:-1,error:'SOAP fault: mock fault'}];if(mode=='empty')return [200,{result:1,xml:`<wellbores ${NS}/>`}];
  return [200,{result:1,xml:`<wellbores ${NS}><wellbore uidWell="MW1" uid="MB1"/></wellbores>`}]}
 return [200,{result:1,xml:`<logs ${NS}><log uidWell="MW1" uidWellbore="MB1" uid="ML1"><name>Mock log</name><indexType>measured depth</indexType><indexCurve>DEPT</indexCurve><logCurveInfo uid="DEPT"><mnemonic>DEPT</mnemonic><unit>m</unit></logCurveInfo></log></logs>`}]}
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage();await pg.setViewport({width:1400,height:900});await pg.setRequestInterception(true);
pg.on('request',r=>{const u=r.url();if(u.startsWith('https://mock-proxy.invalid/')){if(r.method()=='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});if(mode=='down')return r.respond({status:404,contentType:'text/html',headers:{'access-control-allow-origin':'*'},body:'<html>not found</html>'});const [s,o]=proxy(r);return r.respond({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)})}
 if(/adaga|witsml-proxy\.netlify|supabase\.co/.test(u)&&!/\.js(\?|$)/.test(u))return r.abort();r.continue()});
await pg.goto(BASE+'/?wdash',{waitUntil:'load',timeout:120000});await w(2500);
const st=()=>pg.evaluate(()=>document.getElementById('wdCSt')?.textContent||'');
const connect=async(pw)=>{await pg.evaluate(pw=>{if(!document.getElementById('wdConn'))wdConnB.click()},pw);await w(200);await pg.evaluate(pw=>{wdVia.value='proxy';wdProxy.value='https://mock-proxy.invalid/witsml-proxy';wdUrl.value='https://store.example.test/WMLS';wdUser.value='tester';wdPass.value=pw;wdGo.click()},pw);await w(1500)};
await connect('S3cret-pw-XYZ');
const opts=await pg.evaluate(()=>({w:[...wdW.options].map(o=>o.value),b:[...wdB.options].map(o=>o.value),l:[...wdL.options].map(o=>o.value),pw:wdPass.value}));
ok(opts.w[0]=='MW1'&&opts.b[0]=='MB1'&&opts.l[0]=='ML1','wells -> wellbores (self-closing) -> logs all load: '+JSON.stringify(opts));
ok(opts.pw==='','password field cleared after Connect');
ok(calls.length>=4&&calls.every(c=>c.auth==GOOD),'every request in the session carried the header credentials ('+calls.length+' calls)');
calls=[];await pg.evaluate(()=>{wdW.dispatchEvent(new Event('change'))});await w(800);ok(calls.length>=2&&calls.every(c=>c.auth==GOOD)&&!/credentials/.test(await st()),'re-picking the well later still sends credentials');
calls=[];await connect('');ok(calls.length&&calls.every(c=>c.auth==GOOD)&&/Connected/.test(await st()),'Reconnect with blank password reuses in-page credentials');
const persisted=await pg.evaluate(()=>JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage})+document.cookie+location.href+document.body.innerHTML);
ok(!/S3cret-pw-XYZ|tester/.test(persisted)&&!persisted.includes(GOOD.slice(6)),'password/user name not in storage, cookies, URL or DOM');
ok(/store\.example\.test/.test(await pg.evaluate(()=>localStorage.getItem('dw_wdash_conn')||'')),'non-secret settings (store URL) remembered');
mode='empty';await pg.evaluate(()=>wdW.dispatchEvent(new Event('change')));await w(800);ok(/no wellbores.*empty result/.test(await st()),'empty result message: '+await st());
mode='fault';await pg.evaluate(()=>wdW.dispatchEvent(new Event('change')));await w(800);ok(/Store error \(SOAP fault/.test(await st()),'SOAP fault message: '+await st());
mode='ok';await pg.evaluate(()=>{wdDis.click()});await w(300);await connect('wrong');ok(/Login problem.*refused|Login problem: Authentication failed/.test(await st()),'auth message: '+await st());
mode='down';await connect('S3cret-pw-XYZ');ok(/Proxy\/CORS problem/.test(await st()),'proxy/CORS message: '+await st());
mode='ok';await pg.evaluate(()=>{wdForget.click()});ok(!(await pg.evaluate(()=>localStorage.getItem('dw_wdash_conn'))),'Forget saved connection clears settings');
const np=await pg.evaluate(async()=>{const m=await import('./wdash.js?v=w2');return [m.normProxy('https://tryfecta-witsml-proxy.netlify.app/witsml'),m.isLocalProxy('http://localhost:8796/soap')]});
ok(np[0]=='https://tryfecta-witsml-proxy.netlify.app/witsml-proxy'&&np[1],'proxy URL "/witsml" corrected to /witsml-proxy; local proxy detected');
await b.close();console.log(`\n${p} passed, ${f} failed`);process.exit(f?1:0)
