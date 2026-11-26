import assert from 'node:assert/strict';
import {readFile, readdir, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {dirname, extname, basename, resolve, sep} from 'node:path';
import {chromium} from 'playwright';

const root = resolve(import.meta.dirname, '../drilling');
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let path = resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!path.startsWith(root + sep)) throw Error();
    // The release host resolves vendor filenames case-insensitively.
    const files = await readdir(dirname(path));
    const file = files.find(f => f === basename(path)) ?? files.find(f => f.toLowerCase() === basename(path).toLowerCase());
    const entry = name === '/' && process.env.ROBOTYX_GAME_ENTRY_HTML;
    const body = await readFile(entry || resolve(dirname(path), file));
    res.writeHead(200, {'Content-Type': ({'.js':'text/javascript', '.mjs':'text/javascript', '.html':'text/html',
      '.css':'text/css', '.json':'application/json', '.png':'image/png'})[extname(path)] ?? 'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({executablePath:process.env.ROBOTYX_CHROMIUM_PATH || '/usr/bin/chromium',
  args:['--no-sandbox', '--enable-unsafe-swiftshader']});
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({reducedMotion:'reduce',viewport:{width,height:width === 390 ? 844 : 900},isMobile:width===390,hasTouch:width===390});
    await context.route('**/*', r => r.request().url().startsWith(origin + '/') && r.request().method() === 'GET' ? r.continue() : r.abort());
    const page = await context.newPage();
    const activate = locator => width === 390 ? locator.tap() : locator.click();
    const errors = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    page.setDefaultTimeout(60000);
    await page.goto(origin + '/?start', {waitUntil:'domcontentloaded'});
    await activate(page.locator('[data-go="grp:drill"]'));
    const track = width === 390;
    await activate(page.locator(track ? '#st_ddtracks' : '#st_ddcab'));
    if (track) await activate(page.locator('#dtStart'));
    const log = page.getByRole('region', {name:'Simulated gamma log'});
    await log.waitFor();
    if (!track) {
      assert.match(await log.innerText(), /Waiting for sensor coverage/);
      await page.locator('#drScen').selectOption('tangent');
      await page.locator('#drMode').selectOption('slide');
    }
    if (track) await page.waitForFunction(() => window.GX?.ddrun?.run?.track === 'r1' && GX.ddrun.run.running);
    await page.locator('#drSpd').selectOption('4');
    if (!track) await activate(page.locator('#drGo'));
    await page.waitForFunction(() => /Fused [0-9]/.test(document.querySelector('[data-gamma-reading]')?.textContent), undefined, {timeout:30000});
    await page.waitForFunction(() => window.GX.ddrun.run.surveys.length >= 2, undefined, {timeout:120000});
    await activate(page.locator('#drGo'));
    await activate(log.locator('summary'));
    const details = await log.innerText();
    assert.match(details, /synthetic formation-response ROP [0-9]/);
    assert.match(details, /model 95%/);
    const coords = await log.boundingBox();
    assert.ok(coords.x >= 0 && coords.x + coords.width <= width + 1);
    const {sensorMd,bitMd} = await page.evaluate(() => GX.ddrun.run.gammaLog.latest.packet);
    assert.ok(Math.abs(bitMd - sensorMd - 6) < 1e-8);
    // Advance the same paused game's solver through three more stands for historical inspection.
    const history = await page.evaluate(() => {
      const dd=GX.ddrun,r=dd.run, prior=JSON.stringify(r.surveys);
      const n=r.surveys.length;dd.drill(r,90);dd.ui();
      return {preserved:JSON.stringify(r.surveys.slice(0,n))===prior, newSurveys:r.surveys.length-n};
    });
    assert.deepEqual(history,{preserved:true,newSurveys:3});
    const overlay = page.locator('.drPath'), chart = overlay.locator('canvas');
    await activate(overlay.locator('summary'));
    await overlay.locator('[data-pick]').selectOption('i0');
    assert.match(await overlay.locator('[data-info]').innerText(), /Depth-matched slide/);
    await activate(overlay.locator('[data-next-gamma]'));
    assert.match(await overlay.locator('[data-info]').innerText(), /Sensor MD .* raw .*fused/);
    const checked = await overlay.locator('[data-layer="gamma"]').isChecked();
    await activate(overlay.locator('[data-layer="gamma"]'));
    assert.notEqual(await overlay.locator('[data-layer="gamma"]').isChecked(), checked);
    await activate(overlay.locator('[data-layer="gamma"]'));
    await activate(overlay.locator('[data-layer="plan"]'));
    await chart.scrollIntoViewIfNeeded();
    const rect=await chart.boundingBox(), x=Math.round(rect.x+rect.width/2),y=Math.round(rect.y+rect.height/2);
    assert.ok(rect.x>=0 && rect.x+rect.width<=width+1);
    const image=()=>chart.evaluate(c=>c.toDataURL());
    const initial=await image();
    if(track){
      const cdp=await context.newCDPSession(page);
      for(const [type,dx] of [['touchStart',0],['touchMove',25],['touchMove',48],['touchEnd',0]])
        await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:x+dx,y:y+dx/3}]});
      await cdp.detach();
    }else{
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+48,y+16,{steps:4});await page.mouse.up();
    }
    assert.notEqual(await image(),initial,'orbit changes the projected 3D scene');
    await activate(overlay.locator('[data-view="in"]'));
    await activate(overlay.locator('[data-view="fit"]'));
    await chart.scrollIntoViewIfNeeded();
    // Locate the rendered white survey marker in canvas pixels and pick it through the actual input device.
    const marker=await chart.evaluate(c=>{
      const {width:w,height:h}=c, pixels=c.getContext('2d').getImageData(0,0,w,h).data;
      const white=(x,y)=>{const i=(y*w+x)*4;return pixels[i]===245 && pixels[i+1]===242 && pixels[i+2]===233;};
      for(let y=4;y<h-4;y++)for(let x=4;x<w-4;x++){
        if(white(x,y)&&white(x-2,y)&&white(x+2,y)&&white(x,y-2)&&white(x,y+2)){
          const b=c.getBoundingClientRect();return {x:b.x+x*b.width/w,y:b.y+y*b.height/h};
        }
      }
    });
    assert.ok(marker,'visible survey marker');
    if(track) await page.touchscreen.tap(marker.x,marker.y);else await page.mouse.click(marker.x,marker.y);
    assert.match(await overlay.locator('[data-pick]').inputValue(),/^s/);
    await overlay.locator('[data-pick]').selectOption('s1');
    assert.match(await overlay.locator('[data-info]').innerText(),/reported TVD.*Minimum-curvature E/);
    if(process.env.ROBOTYX_SURVEY_EVIDENCE_DIR){
      await mkdir(process.env.ROBOTYX_SURVEY_EVIDENCE_DIR,{recursive:true});
      await chart.screenshot({path:resolve(process.env.ROBOTYX_SURVEY_EVIDENCE_DIR,'path-'+width+'.png')});
    }
    await activate(page.locator('#drPU'));
    assert.match(await log.innerText(), /Off bottom/);
    await activate(page.locator('#drReset'));
    assert.match(await log.innerText(), /Fused —/);
    assert.match(await overlay.locator('[data-path-status]').innerText(), /Waiting for the next survey/);
    assert.equal(await overlay.locator('[data-pick] option[value="i0"]').count(),0);
    assert.deepEqual(errors.filter(s => /dd_gamma|dd_survey|ddrun\.js/i.test(s)), []);
    if (errors.length) console.warn('Host page errors:', [...new Set(errors.map(e => e.split('\n')[0]))]);
    console.log(`${width}px · ${track?'DD Tracks (First Build)':'DD Training'} → Start → Pause → 3D orbit, layers, interval and station inspection → pick up → reset passed · sensor MD ${sensorMd} m`);
    await context.close();
  }
} finally { await browser.close(); server.closeAllConnections(); server.close(); }
