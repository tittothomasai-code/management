const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, extname} from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..'), evidence = resolve(root, 'drilling-tests/survey-alert-evidence');
await mkdir(evidence, {recursive: true});
const pumpEvidence = resolve(root, 'drilling-tests/equipment-evidence');await mkdir(pumpEvidence, {recursive: true});
const stubs = {
  'opsnow_wire.js': `export const cfg={url:'SIM fixture',proxy:'offline'};export const state={dead:false,calls:0,errors:0};export const hasCred=()=>!!window.__simSigned;export const rememberedUser=()=>'';export const signIn=()=>{};export const signOut=()=>{window.__simSigned=false};export async function get(...args){state.calls++;return window.__simRead(...args);}`,
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
    if (name === 'opsnow.js') body = Buffer.from(body.toString() + '\nexport {S as testState, readSurvey as testReadSurvey, readBit as testReadBit, readData as testReadData, render as testRender};');
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
    if((await readFile(resolve(root,'drilling/ops.html'),'utf8')).includes('bha-builder/context-launcher')){await page.locator('[data-bha-context]').waitFor();assert.equal(await page.locator('[data-bha-context]').count(),1);}
    await page.evaluate(async () => {
      const m = await import('./opsnow.js?v=joints1118');window.__testOps = m;window.__simSigned = true;
      Object.assign(m.testState, {well: {uid: 'sim-well', name: 'SIM FIELD'}, wb: {uid: 'sim-bore', name: 'SIM WB1'}, trajUid: 'sim-survey',
        log: {name: 'SIM depth log', time: false, changed: new Date().toISOString()}, data: {ml: [], ul: [], rows: [[100], [113]]}});
      window.__simStations = [{uid: 'sim-100', md: 100, t: '2026-11-17T01:50:00Z'}];
      window.__simRead = async () => ({result: 1, xml: '<trajectorys><trajectory uid="sim-survey">' + __simStations.map(s => '<trajectoryStation uid="' + s.uid + '"><dTimStn>' + s.t + '</dTimStn><typeTrajStation>survey</typeTrajStation><md uom="m">' + s.md + '</md><tvd uom="m">90</tvd><incl uom="dega">72</incl><azi uom="dega">125</azi></trajectoryStation>').join('') + '</trajectory></trajectorys>'});
      await m.testReadSurvey();
    });
    assert.equal(await page.locator('#onSurveyReceived').count(), 0);
    await page.clock.runFor(3500);await page.waitForFunction(async () => (await import('./opsnow_jsurvey.js?v=re1115')).state().status === 'ok');
    const setPump = mode => page.evaluate(async mode => {
      const C = await import('./opsnow_core.js?v=re1115'), S = __testOps.testState, now = Date.now();
      const on = mode !== 'off', delay = mode === 'stale' ? 130000 : 1000;
      const ml = ['TIME','FLOWIN','SPP','RPM','ROP','WOB','TORQUE','FLOWOUT','HKL','BHE','HDTH','DBTM'];
      const ul = ['s','gpm','psi','rpm','m/h','t','kN.m','gpm','klb','m','m','m'];
      const values = [on?600:0,on?2100:0,on?120:0,on?20:0,on?6:0,on?3:0,on?580:0,20,15,113,113];
      const time = mode !== 'depth';if(!time)ml[0]='MD';
      S.log = {uid:'sim-flow',name:time?'SIM time log':'SIM depth log',time,changed:new Date(now).toISOString()};
      const previous=[...values],older=[...values];previous[8]=8;older[8]=20;values[8]=12.8;
      S.data = {ml,ul,rows:[[time?now-delay-20000:87,...older],[time?now-delay-10000:100,...previous],[time?now-delay:113,...values]]};
      S.map = C.mapChannels(ml,ul,S.log);if(mode==='missing')delete S.map.flowIn;
      S.advancedAt = mode==='on'?now-1000:null;S.watchFrom=now-180000;S.timeLog=null;S.pumpSample=null;
      __testOps.testRender();
    }, mode);
    for(const mode of ['on','off','stale','depth','missing']) {
      await setPump(mode);const panel=page.locator('#onPumps');
      assert.equal(await panel.getAttribute('data-state'),mode==='off'?'off':mode==='stale'?'unknown':'on');
      assert.equal(await page.locator('.on-pump-picture').count(),0);assert.equal(await page.locator('.on-top #onPumps').count(),1);
      assert.equal(await panel.getAttribute('data-drive'),mode==='depth'?'reported':mode==='stale'?'unknown':'current');
      if(['on','off'].includes(mode)){assert.match(await panel.locator('[data-drive-value]').innerText(),/12.8 m/);assert.match(await panel.locator('[data-drive-motion]').innerText(),/Rising/);}
      const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);
      await page.screenshot({path:pumpEvidence+`/dashboard-${mode}-${width}.png`});
      await page.locator('.on-top').screenshot({path:pumpEvidence+`/header-${mode}-${width}.png`});
      assert.ok((await panel.boundingBox()).height<=80);
    }
    // The carriage moves with the source reading, independently of bit depth.
    const beforeMarker=await page.locator('[data-drive-marker]').getAttribute('transform');
    await page.evaluate(()=>{const S=__testOps.testState;S.data.rows.at(-2)[9]=12.8;S.data.rows.at(-1)[9]=8;__testOps.testRender();});
    assert.match(await page.locator('[data-drive-motion]').innerText(),/Lowering/);
    assert.notEqual(await page.locator('[data-drive-marker]').getAttribute('transform'),beforeMarker);
    await page.locator('.on-top').screenshot({path:pumpEvidence+`/header-lowering-${width}.png`});
    await page.evaluate(()=>{__testOps.testState.data.rows.at(-2)[9]=8;__testOps.testRender();});
    assert.match(await page.locator('[data-drive-motion]').innerText(),/Holding/);
    await page.evaluate(()=>{const S=__testOps.testState;S.data.ml.push('TDH');S.data.ul.push('m');S.data.rows.forEach((r,i)=>r.push(25+i));__testOps.testRender();});
    assert.match(await page.locator('[data-drive-source]').innerText(),/Reported/);
    assert.match(await page.locator('[data-drive-value]').innerText(),/27.0 m/);
    await setPump('depth');
    await page.evaluate(async()=>{
      const S=__testOps.testState,original=__simRead,count=S.data.rows.length,last=S.data.rows.at(-1).slice();last[1]=0;last[2]=0;last[9]=-.1;
      __simRead=async(type,query)=>{if(!query.includes('112.999999'))throw Error('Tail query skipped current depth');return {result:1,xml:'<logs><log><logData><mnemonicList>'+S.data.ml.join(',')+'</mnemonicList><unitList>'+S.data.ul.join(',')+'</unitList><data>'+last.join(',')+'</data></logData></log></logs>'};};
      await __testOps.testReadData(false);__simRead=original;if(S.data.rows.length!==count||S.data.rows.at(-1)[0]!==113)throw Error('Tail refresh invented depth');
    });
    assert.equal(await page.locator('#onPumps').getAttribute('data-state'),'off');assert.match(await page.locator('[data-drive-value]').innerText(),/-0.1 m/);
    // Flow from the secondary time log uses the existing readBit transport call.
    await setPump('depth');
    await page.evaluate(()=>{delete __testOps.testState.map.flowIn;delete __testOps.testState.map.bh;});
    await page.evaluate(async()=>{
      const S=__testOps.testState,now=Date.now(),original=__simRead;
      S.timeLog={uid:'sim-time-secondary',name:'SIM secondary time log',end:new Date(now-1000).toISOString(),curves:[]};
      __simRead=async()=>({result:1,xml:'<logs><log><logData><mnemonicList>TIME,FLOWIN,BPOS</mnemonicList><unitList>s,gpm,m</unitList><data>'+new Date(now-11000).toISOString()+',0,20</data><data>'+new Date(now-1000).toISOString()+',0,12</data></logData></log></logs>'});
      await __testOps.testReadBit();__simRead=original;__testOps.testRender();
    });
    assert.equal(await page.locator('#onPumps').getAttribute('data-state'),'off');assert.equal(await page.locator('#onPumps').getAttribute('data-drive'),'current');assert.match(await page.locator('[data-drive-value]').innerText(),/12.0 m/);
    await page.evaluate(()=>{__testOps.testState.wb={uid:'sim-other',name:'SIM OTHER'};delete __testOps.testState.map.spp;__testOps.testRender();});
    assert.equal(await page.locator('#onPumps').getAttribute('data-state'),'unknown');assert.equal(await page.locator('#onPumps').getAttribute('data-drive'),'unknown');
    await page.evaluate(()=>{__testOps.testState.wb={uid:'sim-bore',name:'SIM WB1'};});
    await setPump('on');await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#onPumps').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    // Repeated 12.3 m MD spacing is not a measured 13 m joint or absolute BHE.
    await page.evaluate(async()=>{
      const C=await import('./opsnow_core.js?v=re1115'),S=__testOps.testState;
      S.log={uid:'joint-check',name:'SIM depth log',time:false,changed:new Date().toISOString()};
      const rows=[];for(let i=0;i<7;i++){const md=100+i*12.3;rows.push([md-.1,959,1372,-.1],[md,959,1372,12.9]);}rows.push([100+6*12.3+4,959,1372,8.9]);
      S.data={ml:['MD','Flow','SPP','BHE'],ul:['m','lpm','psi','m'],rows};S.map=C.mapChannels(S.data.ml,S.data.ul,S.log);S.timeLog=null;S.pumpSample=null;S.previousDepthRow=null;__testOps.testRender();
    });
    assert.match(await page.locator('#onJointDone').innerText(),/4.0 \/ 13.0 m · nominal/);
    assert.match(await page.locator('#onJointNote').innerText(),/connection spacing 12.3 m MD/);
    assert.match(await page.locator('#onJointNote').innerText(),/observed BHE travel 4.0 m/);
    await page.locator('.on-side').screenshot({path:pumpEvidence+`/joint-comparison-${width}.png`});
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
  await writeFile(pumpEvidence+'/browser-results.json',JSON.stringify({mode:'Actual Ops render and existing secondary time-log reader; local SIM transport only.',widths:[1920,390],checks:['compact reminder in dashboard header','no large pump illustration','fresh positive flow ON','fresh zero flow OFF','stale or missing flow unavailable','top-drive marker uses observed block-height range','position and rising direction shown','carriage moves with lowering height','holding direction','direct position overrides block proxy','stale/depth-only position not presented as current','secondary time log uses existing read','other-well sample rejected','fits viewport'],errors:[]},null,2)+'\n');
} finally { await browser.close();await new Promise(r => server.close(r)); }
