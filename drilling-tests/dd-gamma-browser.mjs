import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
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
    await activate(page.locator('#st_ddcab'));
    const log = page.getByRole('region', {name:'Simulated gamma log'});
    await log.waitFor();
    assert.match(await log.innerText(), /Waiting for sensor coverage/);
    await page.locator('#drSpd').selectOption('4');
    await activate(page.locator('#drGo'));
    await page.waitForFunction(() => /Fused [0-9]/.test(document.querySelector('[data-gamma-reading]')?.textContent), undefined, {timeout:30000});
    await activate(page.locator('#drGo'));
    await activate(log.locator('summary'));
    const details = await log.innerText();
    assert.match(details, /synthetic formation-response ROP [0-9]/);
    assert.match(details, /model 95%/);
    const coords = await log.boundingBox();
    assert.ok(coords.x >= 0 && coords.x + coords.width <= width + 1);
    const {sensorMd,bitMd} = await page.evaluate(() => GX.ddrun.run.gammaLog.latest.packet);
    assert.ok(Math.abs(bitMd - sensorMd - 6) < 1e-8);
    await activate(page.locator('#drPU'));
    assert.match(await log.innerText(), /Off bottom/);
    await activate(page.locator('#drReset'));
    assert.match(await log.innerText(), /Fused —/);
    assert.deepEqual(errors.filter(s => /dd_gamma|ddrun\.js/i.test(s)), []);
    if (errors.length) console.warn('Host page errors:', [...new Set(errors.map(e => e.split('\n')[0]))]);
    console.log(`${width}px · Drill → DD Training → Start → Pause → inspect → pick up → reset passed · sensor MD ${sensorMd} m`);
    await context.close();
  }
} finally { await browser.close(); server.closeAllConnections(); server.close(); }
