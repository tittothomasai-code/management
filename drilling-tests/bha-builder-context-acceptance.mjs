const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const game=process.env.BHA_GAME_ROOT||resolve(import.meta.dirname,'../drilling');if(!game)throw Error('Set BHA_GAME_ROOT to the candidate drilling folder.');
const evidence=resolve(import.meta.dirname,'bha-evidence');await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.ROBOTYX_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [390,1920]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1080},isMobile:width===390,hasTouch:width===390,ignoreHTTPSErrors:true});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'||/\/.netlify\/functions\/|\/rest\/v1\//.test(url.pathname))return route.abort();
  if(url.origin==='https://drilling.robotyx.systems'){const path=resolve(game,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(path.startsWith(resolve(game)+'/'))try{return route.fulfill({status:200,contentType:{'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'}[extname(path)]||'application/octet-stream',body:await readFile(path)});}catch{}}
  return route.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://drilling.robotyx.systems/ops.html',{waitUntil:'domcontentloaded'});await page.locator('[data-bha-context]').waitFor();
 const before=await page.locator('#onWell').count()?await page.locator('#onWell').innerText():null;
 await page.locator('[data-bha-context]').click();const frame=page.frameLocator('#bha-context-panel iframe');await frame.locator('[data-action="example"]').click();await frame.locator('[data-name]').fill('SIM context '+width);await frame.locator('[data-action="save"]').click();assert.match(await frame.locator('.bb-notice').innerText(),/version 1/);
 await page.screenshot({path:evidence+`/ops-bha-${width}.png`});await frame.locator('[data-action="exit"]').click();await page.waitForFunction(()=>document.querySelector('#bha-context-panel').hidden);assert.equal(new URL(page.url()).pathname,'/ops.html');if(before!==null)assert.equal(await page.locator('#onWell').innerText(),before);
 await page.locator('[data-bha-context]').click();assert.equal(await frame.locator('tbody tr').count(),12);await frame.locator('[data-action="exit"]').click();
 results.push({width,check:'Ops editor saves to shared library, returns without navigation, retains draft'});console.log('PASS Ops',width);
 await page.goto('https://drilling.robotyx.systems/?nosplash=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>G?.bhaBuilder&&window.GX_READY);await page.evaluate(async()=>{const dd=window.DDCAB||await import('./ddcab.js?v=r2');dd.open();});console.log('DD READY',width);await page.locator('body > canvas').first().evaluate(c=>c.dataset.bhaOriginalCanvas='true');
 const launch=page.locator('#ddc [data-bha-context]');await launch.waitFor();const cabin=await page.locator('#ddScen').inputValue();await launch.click();await page.waitForFunction(()=>G.bhaBuilder.active);assert.match(await page.locator('[data-action="exit"]').innerText(),/Directional drilling/);
 {const options=await page.locator('[data-saved] option').allTextContents();const i=options.findIndex(s=>s.includes('SIM context '+width));assert.ok(i>0);await page.locator('[data-saved]').selectOption({index:i});}
 await page.locator('[data-action="load"]').click();assert.equal(await page.locator('#bha-builder-ui tbody tr').count(),12);await page.locator('[data-action="tool"]').click();await page.screenshot({path:evidence+`/dd-bha-${width}.png`});await page.keyboard.press('Escape');await page.waitForFunction(()=>!G.bhaBuilder.active);assert.equal(await page.locator('#ddc').isVisible(),true);assert.equal(await page.locator('#ddScen').inputValue(),cabin);assert.equal(await page.locator('canvas[data-bha-original-canvas=true]').count(),1);
 results.push({width,check:'Directional Drilling loads Ops saved assembly, reuses game canvas, Escape restores cabin scenario'});console.log('PASS Directional Drilling',width);
 // The accepted menu still starts with Plan before Drill.
 await page.evaluate(()=>(window.GX?.start||window.dwStart).show());await page.locator('#st_grp\\:plan').waitFor();const groups=await page.locator('#start .tiles > button').allTextContents();assert.match(groups[0],/Plan/);assert.match(groups[1],/Drill/);
 assert.deepEqual(errors,[]);await context.close();
 }await writeFile(evidence+'/context-results.json',JSON.stringify({results,testMode:'Candidate game static files with read-only production fallback. All writes and API calls blocked. Phone touch/viewport emulation; software WebGL.'},null,2)+'\n');
}finally{await browser.close();}
