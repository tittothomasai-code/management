// sitesync_test (feat/site-sync): saved EDM site sync between two devices (laptop -> phone) with a sync file,
// WITSML credentials stripped, cloud sync off by default, and cloud flow against a MOCK Supabase (no network). Synthetic sites only.
// usage: node sitesync_test.mjs http://localhost:8942
import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=(process.argv[2]||'http://localhost:8942').replace(/\/$/,''),SH='shots_live/191_sync_';
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const PHONE={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},DESK={width:1440,height:900};
const mock=[];
async function open(vp,{cloud=false}={}){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(vp);await p.setRequestInterception(true);
 p.on('request',async r=>{const u=r.url();if(u.startsWith('https://mock-sync.invalid')){let b=r.postData();if(b==null&&r.hasPostData?.())b=await r.fetchPostData().catch(()=>undefined);mock.push({u,m:r.method(),h:r.headers(),b});const path=new URL(u).pathname;
   const J=b=>r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(b)});
   if(r.method()=='OPTIONS')return r.respond({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
   if(path=='/auth/v1/signup')return J({access_token:'mock.jwt',expires_in:3600});if(path.endsWith('dw_sync_create_space'))return J('ABCDE12345');if(path.endsWith('dw_sync_join_space'))return J('00000000-0000-0000-0000-000000000001');
   if(path.endsWith('dw_sync_put_site'))return J(null);if(path=='/rest/v1/dw_sync_sites')return J(mock.filter(x=>x.m=='POST'&&x.u.endsWith('dw_sync_put_site')).map(x=>{const b=JSON.parse(x.b);return {site_id:b.p_site_id,name:b.p_name,updated_at:b.p_updated,payload:b.p_payload}}));return J(null)}
  /supabase|adaga|witsml|netlify\/functions/i.test(u)?r.abort():r.continue()});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));if(cloud)await p.evaluateOnNewDocument(()=>{window.DW_SYNC={url:'https://mock-sync.invalid',key:'mock-anon'}});
 await p.goto(BASE+'/?start=1',{waitUntil:'domcontentloaded',timeout:120000});await p.waitForSelector('#stSync',{timeout:120000});await w(800);return {p,ctx,errs}}
const seed=p=>p.evaluate(async()=>{const S=await import('./edmstore.js?v=5941');for(const n of ['SYNTH PAD A','SYNTH PAD B'])await S.save({name:n+' (SIM)',customer:null,sites:[{id:'S1',name:n}],wells:[{id:'W1',name:'SYN-1',witsml:{url:'https://x',username:'u',password:'p'}},{id:'W2',name:'SYN-2'}],wbs:[{id:'B1'}],witsmlPassword:'secret1',apiToken:'t'},{id:'edm_'+n.slice(-1)});return (await S.list()).length});
const L=await open(DESK);ok(await seed(L.p)==2,'laptop: 2 synthetic saved sites');await L.p.evaluate(()=>location.reload());await L.p.waitForSelector('#stSync',{timeout:120000});await w(1500);
await L.p.click('#stSync');await L.p.waitForSelector('#syncP #syExp:not([disabled])',{timeout:30000});
ok(await L.p.evaluate(()=>!!document.getElementById('syOff')&&/Cloud sync is off/.test(document.getElementById('syncP').innerText)),'cloud sync off by default (no project set), sync file works');
ok(await L.p.evaluate(()=>/never sends WITSML/i.test(document.getElementById('syncP').innerText)&&!/\bLIVE\b/.test(document.getElementById('syncP').innerText)),'panel says WITSML log-in data is never sent');
await L.p.screenshot({path:SH+'desk_panel.png'});await L.p.click('#syExp');await L.p.waitForFunction(()=>GX.sync.last,{timeout:30000});
const F=await L.p.evaluate(()=>GX.sync.last);const txt=JSON.stringify(F);
ok(F.sites.length==2&&F.sites[0].W.wells.length==2,'sync file holds 2 sites with their wells');ok(!/witsml|password|secret|token|"u"|"p"/i.test(txt.replace(/"kind":"dw-sites"/,'')),'no WITSML credentials or secrets in sync file');
ok(await L.p.evaluate(()=>/Sync file made: 2 sites/.test(document.getElementById('sySt').textContent)),'status: sync file made');fs.writeFileSync('/tmp/dw_sync_file.json',txt);
// phone: empty device, open the file
const P=await open(PHONE);ok(await P.p.evaluate(()=>!document.querySelector('#start .tile[data-go=saved]')),'phone: no saved sites yet');
await P.p.click('#stSync');await P.p.waitForSelector('#syncP #syImp',{timeout:30000});const vis=await P.p.evaluate(()=>{const r=document.querySelector('#syncP .b').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0});ok(vis,'phone: panel fits the screen');
await P.p.screenshot({path:SH+'phone_panel.png'});const inp=await P.p.$('#syImp');await inp.uploadFile('/tmp/dw_sync_file.json');await P.p.waitForFunction(()=>/Added 2 sites/.test(document.getElementById('sySt').textContent),{timeout:30000}).catch(()=>{});
ok(await P.p.evaluate(()=>/Added 2 sites/.test(document.getElementById('sySt').textContent)),'phone: opened sync file, added 2 sites');
await P.p.keyboard.press('Escape');await w(300);ok(await P.p.evaluate(()=>!document.getElementById('syncP')),'Esc closes panel');
await P.p.waitForSelector('#start .tile[data-go=saved]',{timeout:20000}).catch(()=>{});ok(await P.p.evaluate(()=>/2 saved/.test(document.querySelector('#start .tile[data-go=saved]')?.innerText||'')),'phone: start menu shows 2 saved sites');
await P.p.screenshot({path:SH+'phone_after.png'});
const g=await P.p.evaluate(async()=>{const S=await import('./edmstore.js?v=5941');const W=await S.get('edm_A');return {n:W.wells.length,cred:JSON.stringify(W).match(/witsml|password|secret/i)}});ok(g.n==2&&!g.cred,'phone: synced site opens, 2 wells, no credentials stored');
await P.p.click('#stSync');await P.p.waitForSelector('#syncP #syImp');await (await P.p.$('#syImp')).uploadFile('/tmp/dw_sync_file.json');await w(1500);
ok(await P.p.evaluate(()=>/Added 0 sites\. Kept 2/.test(document.getElementById('sySt').textContent)),'opening the same file again adds no duplicates');
// bad file
fs.writeFileSync('/tmp/dw_bad.json','{"a":1}');await (await P.p.$('#syImp')).uploadFile('/tmp/dw_bad.json');await w(1000);ok(await P.p.evaluate(()=>/not a Drilling World sites file/.test(document.getElementById('sySt').textContent)),'wrong file is refused');
ok(L.errs.length==0&&P.errs.length==0,'no page errors '+[...L.errs,...P.errs].slice(0,2));await L.ctx.close();await P.ctx.close();
// v5.12.8: custom rigs (dw_custom_rigs_v1) ride in the sync file; merge by id, newer 'updated' wins, no duplicates, secrets stripped, v1 files still open
const SS='/workspace/shots/sync/';fs.mkdirSync(SS,{recursive:true});
const RK='dw_custom_rigs_v1',rig=(id,name,updated,x={})=>({id,name,created:1,updated,parts:[],...x});
const L2=await open(DESK);await seed(L2.p);await L2.p.evaluate((RK,a)=>localStorage.setItem(RK,JSON.stringify(a)),RK,[rig('rA','Laptop rig A',2000,{apiKey:'zz-not-real',meta:{password:'zz'}}),rig('rB','Laptop rig B',2000),rig('rC','Laptop rig C',2000)]);
await L2.p.evaluate(()=>location.reload());await L2.p.waitForSelector('#stSync',{timeout:120000});await w(1500);await L2.p.click('#stSync');await L2.p.waitForSelector('#syncP #syExp:not([disabled])',{timeout:30000});
ok(await L2.p.evaluate(()=>/3 custom rigs too/.test(document.getElementById('syncP').innerText)),'laptop: panel counts 3 custom rigs');
await L2.p.click('#syExp');await L2.p.waitForFunction(()=>GX.sync.last,{timeout:30000});const F2=await L2.p.evaluate(()=>GX.sync.last);const t2=JSON.stringify(F2);
ok(F2.v==2&&F2.rigs.length==3&&F2.sites.length==2,'sync file v2 holds 2 sites + 3 custom rigs');ok(!/apiKey|password|zz-not-real/.test(t2),'custom rig credential-like keys stripped');
ok(await L2.p.evaluate(()=>/Sync file made: 2 sites, 3 custom rigs/.test(document.getElementById('sySt').textContent)),'status counts rigs');await L2.p.screenshot({path:SS+'laptop_export.png'});
fs.writeFileSync('/tmp/dw_sync_v2.json',t2);const v1=JSON.parse(t2);delete v1.rigs;v1.v=1;fs.writeFileSync('/tmp/dw_sync_v1.json',JSON.stringify(v1));await L2.ctx.close();
const P2=await open(PHONE);await P2.p.evaluate((RK,a)=>localStorage.setItem(RK,JSON.stringify(a)),RK,[rig('rA','Phone old A',1000),rig('rB','Phone newer B',3000),rig('rP','Phone only P',1500)]);
await P2.p.evaluate(()=>location.reload());await P2.p.waitForSelector('#stSync',{timeout:120000});await w(1500);
await P2.p.click('#stSync');await P2.p.waitForSelector('#syncP #syImp',{timeout:30000});await (await P2.p.$('#syImp')).uploadFile('/tmp/dw_sync_v1.json');await w(1500);
ok(await P2.p.evaluate(()=>/Added 2 sites/.test(document.getElementById('sySt').textContent)&&!/Custom rigs/.test(document.getElementById('sySt').textContent)),'old v1 sync file (no rigs) still opens');
await (await P2.p.$('#syImp')).uploadFile('/tmp/dw_sync_v2.json');await w(1500);const s2=await P2.p.evaluate(()=>document.getElementById('sySt').textContent);console.log('rig import:',s2);
ok(/Custom rigs: 1 added, 1 updated, 1 kept/.test(s2),'phone: rigs merged (C added, A newer from laptop, B newer on phone kept)');await P2.p.screenshot({path:SS+'phone_import.png'});
const R2=await P2.p.evaluate(RK=>JSON.parse(localStorage.getItem(RK)),RK);const by=Object.fromEntries(R2.map(r=>[r.id,r]));
ok(R2.length==4&&by.rA.name=='Laptop rig A'&&by.rB.name=='Phone newer B'&&by.rC&&by.rP,'phone: 4 rigs, newer copy won by id');ok(!/apiKey|password|zz-not-real/.test(JSON.stringify(R2)),'phone: no credentials stored in rigs');
await P2.p.evaluate(()=>{document.getElementById('syImp').value='';document.getElementById('sySt').textContent=''});await (await P2.p.$('#syImp')).uploadFile('/tmp/dw_sync_v2.json');await w(1500);ok(await P2.p.evaluate(()=>/Custom rigs: 0 added, 0 updated, 3 kept/.test(document.getElementById('sySt').textContent)),'re-import adds no duplicate rigs');
ok((await P2.p.evaluate(RK=>JSON.parse(localStorage.getItem(RK)).length,RK))==4,'phone: still 4 rigs after re-import');ok(L2.errs.length==0&&P2.errs.length==0,'no page errors (rig sync)');await P2.ctx.close();
// cloud flow on mock Supabase (flag on)
const C=await open(DESK,{cloud:true});await seed(C.p);await C.p.click('#stSync');await C.p.waitForSelector('#syncP #syNew',{timeout:30000});
await C.p.click('#syNew');await C.p.waitForFunction(()=>/ABCDE12345/.test(document.getElementById('sySt').textContent),{timeout:20000}).catch(()=>{});ok(await C.p.evaluate(()=>document.getElementById('syCode').value=='ABCDE12345'),'cloud (flag on, mock): pairing code shown');
await C.p.click('#syPush');await C.p.waitForFunction(()=>/Sent 2/.test(document.getElementById('sySt').textContent),{timeout:20000}).catch(()=>{});
console.log('status:',await C.p.evaluate(()=>document.getElementById('sySt').textContent));const puts=mock.filter(x=>x.m=='POST'&&x.u.endsWith('dw_sync_put_site'));ok(puts.length==2&&puts.every(x=>x.h.authorization=='Bearer mock.jwt'),'cloud: 2 sites sent with device login');ok(puts.every(x=>!/witsml|password|secret|token/i.test(x.b)),'cloud: no credentials sent');
await C.p.screenshot({path:SH+'desk_cloud_mock.png'});await C.ctx.close();
const C2=await open(PHONE,{cloud:true});await C2.p.click('#stSync');await C2.p.waitForSelector('#syncP #syJoin');await C2.p.type('#syCode','abcde12345');await C2.p.evaluate(()=>document.getElementById('syJoin').click());await C2.p.waitForFunction(()=>/paired/i.test(document.getElementById('sySt').textContent),{timeout:30000}).catch(()=>{});console.log('join status:',await C2.p.evaluate(()=>document.getElementById('sySt').textContent));await C2.p.evaluate(()=>document.getElementById('syPull').click());
await C2.p.waitForFunction(()=>/Added 2/.test(document.getElementById('sySt').textContent),{timeout:20000}).catch(()=>{});ok(await C2.p.evaluate(()=>/Added 2/.test(document.getElementById('sySt').textContent)),'cloud: phone paired with code and got 2 sites');
const jb=mock.find(x=>x.m=='POST'&&x.u.endsWith('dw_sync_join_space'));console.log('join body',jb&&jb.b);ok(/"p_code":"ABCDE12345"/.test(jb?.b||''),'cloud: code sent upper case');await C2.ctx.close();
ok(!mock.some(x=>!x.u.startsWith('https://mock-sync.invalid')),'cloud: only the configured project is called');
console.log(`sitesync: ${pass} pass, ${fail} fail`);await br.close();process.exit(fail?1:0)
