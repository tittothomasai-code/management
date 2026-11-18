import {createServer} from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(import.meta.dirname,'..'),evidence=resolve(root,'drilling-tests/edm-field-evidence');await mkdir(evidence,{recursive:true});
const overrides=new Set(['edmui.js','edmmap.js','edm_field_check.mjs','edm_field_check_core.mjs','edm_field_check_worker.mjs']);
const cache=new Map([['edmadd.js',await readFile(resolve(root,'drilling-tests/fixtures/edm-field/edmadd.js'))],['data/dr101l-edm-world.json',await readFile(resolve(root,'drilling-tests/fixtures/edm-field/dr101l-edm-world.json'))]]),external=[];
const server=createServer(async(req,res)=>{try{
 const name=new URL(req.url,'http://local').pathname.slice(1);
 if(!name)return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"./vendor/three.module.js"}}</script><body style="margin:0;background:#06101a"><script type="module">import * as U from "./edmui.js?v=5941";U.open();</script></body></html>');
 if(name.includes('..')||name.includes('.netlify')||req.method!=='GET')return res.writeHead(403).end();
 let body;if(overrides.has(name))body=await readFile(resolve(root,'drilling',name));else{if(!cache.has(name)){let bytes;try{bytes=await readFile(resolve(root,'drilling',name));}catch{bytes=await readFile(resolve(root,'drilling',name.toLowerCase()));}cache.set(name,bytes);}body=cache.get(name);}
 res.writeHead(200,{'Content-Type':{'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'}[extname(name)]||'application/octet-stream'}).end(body);
 }catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.ROBOTYX_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [1920,390]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1080},isMobile:width===390,hasTouch:width===390});const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);console.log('Page error:',e.message);});
 await context.route('**/*',route=>{if(!route.request().url().startsWith(origin)){external.push(route.request().url());return route.abort();}return route.continue();});
 page.on('console',m=>{if(m.type()==='error')console.log('Console error:',m.text());});page.on('response',r=>{if(r.status()>=400)console.log('Asset error',new URL(r.url()).pathname,r.status());});
 await page.goto(origin);await page.locator('#edmdrb').waitFor({state:'visible'});
 const before=await page.evaluate(async()=>{const S=await import('./edmstore.js?v=5941');const W={name:'SIM saved-import preservation sentinel',sites:[],wells:[],wbs:[],bounds:{e0:0,e1:1,n0:0,n1:1,maxDepth:0}};await S.save(W,{id:'preservation-sentinel'});return JSON.stringify(W);});
 await page.locator('#edmdrb').click();await page.waitForFunction(()=>window.GX?.edmmap?.fieldCheck?.report());
 const r=await page.evaluate(()=>GX.edmmap.fieldCheck.report());assert.equal(r.status,'INCOMPLETE');assert.equal(r.assessedPairs,0);assert.equal(r.referenceTrajectories.length,4);assert.ok(r.referenceTrajectories.every(p=>p.kind==='PLANNED'));assert.ok(Math.abs(r.center.E-805279.555996779)<1e-6);assert.ok(Math.abs(r.center.N-7255911.811970977)<1e-6);
 assert.match(await page.locator('#edmmap').innerText(),/No offset comparison was possible/);
 const after=await page.evaluate(async()=>{const S=await import('./edmstore.js?v=5941'),w=await S.get('preservation-sentinel');delete w.savedId;delete w.savedAt;return JSON.stringify(w);});assert.equal(after,before);
 const waitDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export report',exact:true}).click();const reportFile=await waitDownload;assert.equal(JSON.parse(await readFile(await reportFile.path(),'utf8')).status,'INCOMPLETE');
 await page.screenshot({path:evidence+'/dr101l-field-'+width+'.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 results.push({width,placedE:r.center.E,placedN:r.center.N,datum:r.center.crs,status:r.status,pairs:r.assessedPairs,savedImportsPreserved:true,errors});await context.close();
}assert.deepEqual(external,[]);await writeFile(evidence+'/browser-results.json',JSON.stringify({mode:'Actual EDM UI/source with read-only production baseline assets; known DR101L import only; no real offset data invented.',results},null,2)+'\n');console.log('PASS EDM field placement and incomplete 10 km report on desktop and phone');
}finally{await browser.close();await new Promise(r=>server.close(r));}
