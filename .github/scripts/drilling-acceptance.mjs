import {chromium} from '../../drilling-tests/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const plan=JSON.parse(await readFile('release-evidence/release-plan.json','utf8')),preview=plan.previewUrl;
const browser=await chromium.launch({executablePath:process.env.ROBOTYX_CHROMIUM_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const width of [390,1920]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1080},isMobile:width===390,hasTouch:width===390,ignoreHTTPSErrors:true});
 await context.route('**/*',route=>{const r=route.request(),url=new URL(r.url());if(r.method()!=='GET'||/\/.netlify\/functions\/|\/rest\/v1\//.test(url.pathname))return route.abort();return route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(preview+'/ops',{waitUntil:'domcontentloaded'});await page.locator('.on-top #onPumps').waitFor();await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.includes('opsnow_pumps.css')));
 assert.equal(await page.locator('.on-pump-picture').count(),0);assert.equal(await page.locator('[data-drive-value]').innerText(),'—');assert.equal(await page.locator('#onPumps').getAttribute('data-state'),'unknown');
 assert.ok((await page.locator('#onPumps').boundingBox()).height<=80);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('[data-bha-context]').click();const frame=page.frameLocator('#bha-context-panel iframe');await frame.locator('[data-action="example"]').click();assert.equal(await frame.locator('tbody tr').count(),12);await frame.locator('[data-action="exit"]').click();await page.waitForFunction(()=>document.querySelector('#bha-context-panel').hidden);
 await page.screenshot({path:'release-evidence/ops-'+width+'.png'});results.push({width,check:'Real preview Ops loads compact pump/top-drive status; BHA opens and returns; no source substitution'});
 await page.goto(preview+'/?nosplash=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.G?.bhaBuilder&&window.GX_READY);
 const position=await page.evaluate(()=>G.cam.position.toArray());await page.evaluate(()=>G.bhaBuilder.enter());await page.waitForFunction(()=>G.bhaBuilder.active);await page.locator('[data-action="example"]').click();assert.equal(await page.locator('#bha-builder-ui tbody tr').count(),12);await page.keyboard.press('Escape');await page.waitForFunction(()=>!G.bhaBuilder.active);
 const restored=await page.evaluate(()=>G.cam.position.toArray());position.forEach((v,i)=>assert.ok(Math.abs(v-restored[i])<1e-6));
 await page.evaluate(async()=>{const dd=window.DDCAB||await import('./ddcab.js?v=r2');dd.open();});await page.locator('#ddc [data-bha-context]').click();await page.waitForFunction(()=>G.bhaBuilder.active);await page.keyboard.press('Escape');await page.waitForFunction(()=>!G.bhaBuilder.active);assert.equal(await page.locator('#ddc').isVisible(),true);
 await page.evaluate(()=>(window.GX?.start||window.dwStart).show());await page.locator('#start .tiles > button').first().waitFor();const menu=await page.locator('#start .tiles > button').allTextContents();assert.match(menu[0],/Plan/);assert.match(menu[1],/Drill/);
 await page.screenshot({path:'release-evidence/menu-'+width+'.png'});assert.deepEqual(errors,[]);results.push({width,check:'Actual game and DD BHA open/restore; Plan-before-Drill preserved',errors});await context.close();
}await writeFile('release-evidence/browser-results.json',JSON.stringify({passed:true,preview,results,mode:'Actual unpublished deploy in clean browsers; no live credentials or source interception; writes/API calls blocked.'},null,2)+'\n');console.log('PASS unpublished preview on desktop and phone');
}finally{await browser.close();}
