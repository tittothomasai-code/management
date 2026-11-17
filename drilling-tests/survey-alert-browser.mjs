const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, extname} from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..'), evidence = resolve(root, 'drilling-tests/survey-alert-evidence');
await mkdir(evidence, {recursive: true});
const stubs = {
  'opsnow_wire.js': `export const cfg={url:'SIM fixture',proxy:'offline'};export const state={dead:false,calls:0,errors:0};export const hasCred=()=>!!window.__simSigned;export const rememberedUser=()=>'';export const signIn=()=>{};export const signOut=()=>{window.__simSigned=false};export async function get(){state.calls++;return window.__simRead();}`,
  'opsnow_views.js': `export const init=()=>{},draw=()=>{},getPlan=()=>null,getKb=()=>null;`,
  'opsnow_wellplans.js': `export const load=()=>Promise.resolve(),planFor=()=>null;`,
  'opsnow_planview.js': `export const init=()=>{},refresh=()=>{};`,
  'opsnow_ac.js': `export const RANK={},acTotals=()=>({}),summaryLine=()=>'',worse=()=>null;`,
};
const server = createServer(async (req, res) => {
  try {
    const name = new URL(req.url, 'http://local').pathname.slice(1) || 'ops.html';
    if (name in stubs) return res.writeHead(200, {'Content-Type': 'text/javascript'}).end(stubs[name]);
    if (name === 'data/per-joint-surveys.json') return res.writeHead(200, {'Content-Type': 'application/json'}).end(JSON.stringify(report));
    const path = resolve(root, ['opsnow_core.js', 'opsnow_jsurvey.js', 'opsnow.css'].includes(name) ? 'drilling-tests/fixtures/survey-alert/' + name : 'drilling/' + (name === 'ops' ? 'ops.html' : name));
    if (!path.startsWith(root + '/')) return res.writeHead(403).end();
    let body = await readFile(path);
    // Test-only access to the actual Ops read/render functions. Production has no test hooks.
    if (name === 'opsnow.js') body = Buffer.from(body.toString() + '\nexport {S as testState, readSurvey as testReadSurvey, render as testRender};');
    res.writeHead(200, {'Content-Type': {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css'}[extname(path)] || 'application/octet-stream'}).end(body);
  } catch { res.writeHead(404).end(); }
});
const reportRow = (md, source) => ({md_m: md, inc_deg: 72, azi_deg: 125, status: 'station', source_report: source});
let report;
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({executablePath: process.env.ROBOTYX_CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox']});
const results = [];
try {
  for (const width of [1920, 390]) {
    report = {well: 'SIM FIELD', wellbore: 'SIM WB1', joints: [reportRow(100, 'SIM report A')]};
    const context = await browser.newContext({viewport: {width, height: width === 390 ? 844 : 1080}, isMobile: width === 390, hasTouch: width === 390});
    const page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', route => { if (!route.request().url().startsWith(origin)) { external.push(route.request().url()); return route.abort(); } return route.continue(); });
    await page.clock.install({time: new Date('2026-11-17T02:00:00Z')});
    await page.goto(origin + '/ops');
    await page.evaluate(async () => {
      const m = await import('./opsnow.js?v=survey1117');window.__testOps = m;window.__simSigned = true;
      Object.assign(m.testState, {well: {uid: 'sim-well', name: 'SIM FIELD'}, wb: {uid: 'sim-bore', name: 'SIM WB1'}, trajUid: 'sim-survey',
        log: {name: 'SIM depth log', time: false, changed: new Date().toISOString()}, data: {ml: [], ul: [], rows: [[100], [113]]}});
      window.__simStations = [{uid: 'sim-100', md: 100, t: '2026-11-17T01:50:00Z'}];
      window.__simRead = async () => ({result: 1, xml: '<trajectorys><trajectory uid="sim-survey">' + __simStations.map(s => '<trajectoryStation uid="' + s.uid + '"><dTimStn>' + s.t + '</dTimStn><typeTrajStation>survey</typeTrajStation><md uom="m">' + s.md + '</md><tvd uom="m">90</tvd><incl uom="dega">72</incl><azi uom="dega">125</azi></trajectoryStation>').join('') + '</trajectory></trajectorys>'});
      await m.testReadSurvey();
    });
    assert.equal(await page.locator('#onSurveyReceived').count(), 0);
    await page.clock.runFor(3500);await page.waitForFunction(async () => (await import('./opsnow_jsurvey.js?v=re1115')).state().status === 'ok');
    await page.locator('#onGear').click();await page.locator('#onSelWb').focus();
    await page.evaluate(async () => { __simStations.push({uid: 'sim-113', md: 113, t: '2026-11-17T02:01:00Z'});await __testOps.testReadSurvey(); });
    const alert = page.locator('#onSurveyReceived');await alert.waitFor();
    assert.match(await alert.innerText(), /Survey received/);assert.match(await alert.innerText(), /113\.00 m/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'onSelWb');
    assert.equal(await alert.getAttribute('role'), 'status');assert.equal(await alert.getAttribute('aria-live'), 'polite');
    assert.equal(await alert.evaluate(el => getComputedStyle(el).animationIterationCount), '3');
    await page.locator('#onClose').click();
    await page.screenshot({path: evidence + '/survey-green-' + width + '.png'});
    const bounds = await alert.boundingBox();assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await alert.getByRole('button', {name: 'Dismiss survey notification'}).click();
    await page.evaluate(() => __testOps.testReadSurvey());assert.equal(await alert.isVisible(), false);
    // The actual report-loader timer/callback receives a new provenance source.
    report.joints.push(reportRow(126, 'SIM report B'));await page.clock.fastForward(10 * 60 * 1000);
    await alert.waitFor();assert.match(await alert.innerText(), /Geosteering report/);
    assert.match(await alert.innerText(), /126\.00 m/);
    await alert.getByRole('button').click();report.generated = 'only file metadata changed';await page.clock.fastForward(10 * 60 * 1000);
    await page.waitForTimeout(100);assert.equal(await alert.isVisible(), false);
    // A stale in-flight read must not announce or assign an old well's survey.
    await page.evaluate(async () => {
      const original = __simRead;let release;__simRead = () => new Promise(r => { release = r; });
      const pending = __testOps.testReadSurvey();__testOps.testState.wb = {uid: 'sim-other', name: 'SIM OTHER'};
      release(await original());await pending;__simRead = original;
    });assert.equal(await alert.isVisible(), false);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.evaluate(async () => { await __testOps.testReadSurvey();__simStations.push({uid: 'sim-139', md: 139, t: '2026-11-17T02:03:00Z'});await __testOps.testReadSurvey(); });
    await alert.waitFor();assert.equal(await alert.evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);assert.deepEqual(external, []);
    results.push({width, checks: ['first history quiet', 'new WITSML survey pulses green', 'focus preserved', 'dismiss and duplicate suppression', 'new report through existing loader callback', 'generated-file metadata quiet', 'old well response ignored', 'reduced motion', 'fits viewport'], errors, external});
    console.log('PASS Ops survey alert', width);await context.close();
  }
  await writeFile(evidence + '/browser-results.json', JSON.stringify({mode: 'Actual Ops source and parsers, local SIM transport and static fixtures only. No external network or real credentials.', results}, null, 2) + '\n');
} finally { await browser.close();await new Promise(r => server.close(r)); }
