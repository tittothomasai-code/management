import {FT, TRACKS, drilledIntervals, feedJoints, feedSource, finite, imageRows,
  jointProgress, readSamples, sourceStamp, surveyMatches} from './operations_data.js';
import {chart, imageLog} from './operations_plots.js';
import {minCurvStations, pointAt, samplePath} from './geo.js';
import {pair, radius} from './ac.js';
import {simSeries} from './wdash_core.js';
import {createCutaway} from './operations_scene.js';

const $ = id => document.getElementById(id);
const fmt = (v, digits = 1) => finite(v) ? v.toLocaleString('en-AU', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
}) : '—';
const ftPoint = p => ({md:p[0]*FT, n:p[3]*FT, e:p[4]*FT, tvd:p[5]*FT});
const surveyPoint = p => ({md:p.md*FT, n:p.ns*FT, e:p.ew*FT, tvd:p.tvd*FT});
const MODES = [['mode','Slide / Rotary'], ['torque','Torque'], ['wob','WOB'], ['plan','Plan vs Actual']];
const MODE_NAMES = {slide:'Slide', rotary:'Rotary', remaining:'Remaining', unknown:'Unclassified'};
const TRACK_HTML = TRACKS.map(([name], i) =>
  '<section class="ops-panel"><h3>' + name + '</h3><canvas id="opsTrack' + i + '" role="img" aria-label="' + name + ' trend"></canvas></section>'
).join('');
const RADAR = '<svg viewBox="0 0 124 124" role="img" aria-label="Anti-collision radar, plan view">' +
  '<g fill="none" stroke="#426478" stroke-width="1"><circle cx="62" cy="62" r="56"/><circle cx="62" cy="62" r="37"/>' +
  '<circle cx="62" cy="62" r="19"/><path d="M6 62h112M62 6v112"/></g><text x="65" y="13" fill="#a0b7c8" font-size="8">N</text>' +
  '<g id="opsRadarTargets"></g></svg>';

const MARKUP = `
  <div class="ops-shell">
    <header class="ops-header">
      <h1 class="ops-brand"><em>ROBOTYX</em><i>/</i>DRILLING WORLD</h1>
      <div class="ops-meta" id="opsWell">DRILLING OPERATIONS</div>
      <div class="ops-flex"><span class="ops-badge" id="opsSource" role="status">STARTING</span>
        <button id="opsConnect" type="button">WITSML</button><button id="opsClose" type="button">Exit dashboard</button></div>
    </header>
    <div class="ops-grid">
      <aside class="ops-panel">
        <div class="ops-heading ops-flex"><h2>Joint tally</h2><span class="ops-muted">End MD (m)</span></div>
        <ul class="ops-list" id="opsTally"></ul>
        <h2 class="ops-heading">Next up</h2><ul class="ops-list" id="opsNext"></ul>
      </aside>
      <main class="ops-center">
        <section class="ops-panel ops-progress ops-pad" aria-label="Joint progress">
          <div class="ops-flex"><strong id="opsJoint">Joint progress</strong><strong id="opsMetres"></strong><strong class="ops-pct" id="opsPct"></strong></div>
          <div class="ops-bar" id="opsBar"></div>
          <div class="ops-flex ops-muted"><span id="opsStart"></span><span id="opsEnd"></span></div>
        </section>
        <section class="ops-panel ops-stage" aria-label="Interactive 3D well cutaway">
          <canvas id="opsScene" aria-label="3D well cutaway. Drag to orbit and scroll to zoom."></canvas>
          <div class="ops-tabs" role="group" aria-label="Well view overlay">${MODES.map(([key,label]) =>
            '<button type="button" data-view="' + key + '" aria-pressed="' + (key === 'mode') + '">' + label + '</button>').join('')}</div>
          <div class="ops-empty-view" id="opsEmpty" hidden></div><span class="ops-bit" id="opsBit" hidden>BIT</span>
          <div class="ops-legend" id="opsLegend"></div>
        </section>
        <section class="ops-panel ops-pad ops-commands">
          <h2>Execution</h2>
          <button type="button" data-cmd="hold">Ⅱ Hold</button><button type="button" data-cmd="slide">» Slide</button>
          <button type="button" data-cmd="rotate">⟳ Rotary</button><button type="button" data-cmd="survey">⊕ Take survey</button>
          <button type="button" data-cmd="connection">Make connection</button>
          <span class="ops-muted" id="opsExecution" role="status"></span>
        </section>
      </main>
      <aside class="ops-right">
        <section class="ops-panel"><h2 class="ops-heading">Anti-collision</h2><div class="ops-pad ops-radar">${RADAR}
          <div><p id="opsRadarLabel">LOOK-AHEAD</p><strong id="opsSF">—</strong><p id="opsRadarDetail"></p></div>
        </div></section>
        <section class="ops-panel"><h2 class="ops-heading">Early alerts</h2><ul class="ops-list ops-status" id="opsAlerts"></ul></section>
        <section class="ops-panel"><h2 class="ops-heading">Well control</h2><ul class="ops-list ops-status" id="opsControl"></ul></section>
      </aside>
    </div>
    <section class="ops-panel ops-log">
      <div class="ops-heading ops-flex"><h2>LWD image log</h2><div class="ops-flex"><span class="ops-muted" id="opsDepth"></span><button id="opsLoadImage" type="button" hidden>Load WITSML image</button></div></div>
      <canvas id="opsImage" role="img" aria-label="Azimuthal image log by measured depth"></canvas>
    </section>
    <div class="ops-tracks">${TRACK_HTML}</div>
    <footer class="ops-footer"><span id="opsSurvey"></span><span id="opsFooter"></span></footer>
  </div>`;

let root, scene, timer, view = 'mode', origin, message = '', messageAt = 0;
let sim = {rows:[], joints:[]}, feed = {}, lastSceneKey = '';
let loadedImage, loadingImage = false, imageError = '';

function gameModel(g) {
  const s = g.S, hd = s.md * FT, bd = g.PH.bitDepth(s) * FT;
  const previous = sim.rows.at(-1);
  if (sim.state !== s || (previous && (s.t < previous.t || hd < previous.hd - .5))) {
    sim = {rows:[], joints:[], state:s};
  }
  const end = s.L * FT - g.PH.P.dw.min_quill;
  const current = sim.joints.at(-1);
  if (!current) sim.joints.push({start:Math.max(0,end-g.PH.STAND_LENGTH_M), end, number:1});
  else if (!s.seq && end > current.end + 1) {
    current.end = hd;
    sim.joints.push({start:hd, end, number:current.number+1});
  }
  if (!sim.rows.length || s.t > sim.rows.at(-1).t) {
    sim.rows.push({t:s.t, hd, bd, mode:s.mode === 'slide' ? 'slide' : 'rotary',
      rop:s.rop*FT, wob:s.wob*4.448222, torque:s.td.torque*.0013558179, rpm:s.td.rpm,
      spp:s.spp*6.894757, flow:s.Q*3.785412, tf:s.tf, stall:Number(Boolean(s.stalled))});
    if (sim.rows.length > 3600) sim.rows.shift();
  }
  const stations = s.surveys || [];
  const last = stations.at(-1);
  const exact = last && [s.md, s.inc, s.azi,
    ...g.PH.minCurv(last.slice(3), last[0], last[1], last[2], s.md, s.inc, s.azi)];
  const path = stations.filter(q => q[0] < s.md).map(ftPoint);
  if (exact) path.push(ftPoint(exact));
  const plan = sim.plan ||= g.PH.planPath().map(ftPoint);
  const offset = sim.offset ||= plan.map(p => ({...p,n:p.n + 27,e:p.e + 19}));
  const joint = sim.joints.at(-1);
  return {source:'SIM', hd, bd, path, plan, offset, estimate:[], bit:atMD(path,bd),
    intervals:drilledIntervals(sim.rows), joint, joints:sim.joints.slice(-6), rows:sim.rows,
    image:hd > joint.start ? simSeries(joint.start, Math.min(hd,joint.end), .16).map(r => ({md:r[0],v:r.slice(9,25)})) : [],
    lastSurvey:last?.[0]*FT, label:'SIMULATOR WELL', s, key:'sim'};
}

function atMD(points, md) {
  if (!finite(md) || !points.length || md < points[0].md || md > points.at(-1).md + .00001) return null;
  const i = points.findIndex(p => p.md >= md);
  if (i <= 0) return i === 0 ? points[0] : points.at(-1);
  const a = points[i-1], b = points[i], f = (md-a.md)/(b.md-a.md);
  return {md,n:a.n+(b.n-a.n)*f,e:a.e+(b.e-a.e)*f,tvd:a.tvd+(b.tvd-a.tvd)*f};
}

function feedModel(api, source) {
  const w = api?.WML;
  const data = w?.log ? api?.data?.() : null, cursor = w?.mode === 'replay' ? w.rp.t : Infinity;
  const key = JSON.stringify([api?.CFG?.url,w?.log?.w,w?.log?.b,w?.log?.uid,source]);
  const history = data?.rows;
  const stamp = [history?.length,history?.at(-1)?.t,cursor,JSON.stringify(api?.CFG?.map)].join('|');
  if (feed.key !== key || feed.stamp !== stamp || feed.history !== history) {
    const rows = readSamples(data, w?.log, api?.CFG?.map, cursor, window.U);
    feed = {key,stamp,history,rows,joints:feedJoints(rows),intervals:drilledIntervals(rows)};
  }
  const {rows, joints, intervals} = feed;
  const latest = rows.at(-1);
  const hd = latest?.hd, bd = latest?.bd;
  const active = joints.at(-1);
  const joint = active?.end < hd ? {...active,end:null,estimated:false} : active;
  const j0 = joint?.start ?? hd - 30;
  const path = [], estimate = [];
  let plan = [];
  let bit = null, lastSurvey = null;
  const geo = window.GEO;
  if (surveyMatches(w,geo,api?.CFG?.svWell) && finite(hd)) {
    const stations = w.mode === 'replay' ? geo.calc.filter(s => {
      const time = Date.parse(s.t);
      return s.md * FT <= hd && finite(time) && time <= cursor;
    }) : geo.calc;
    const tail = stations.at(-1);
    const end = Math.min(hd/FT,tail?.md);
    if (stations.length >= 2 && end > stations[0].md) {
      path.push(...samplePath(stations,end,Math.max(12,end/160)).map(surveyPoint));
      const candidate = w.mode !== 'replay' && w.svCands?.find(c => c.wb === w.log.b &&
        c.uid !== w.sv.cur.uid && c.st?.length >= 2 &&
        c.st.every(x => /^(plan|planned|proposed)$/.test(x.typ)));
      if (candidate) plan = minCurvStations(candidate.st).map(surveyPoint);
      lastSurvey = stations.filter(s => s.md <= end).at(-1)?.md * FT;
      if (finite(bd) && bd <= end*FT && bd >= path[0].md) bit = surveyPoint(pointAt(stations,bd/FT));
      else if (finite(bd) && bd > end*FT && bd-end*FT <= 30 && bd <= hd+.6) {
        bit = surveyPoint(pointAt(stations,bd/FT));
        estimate.push(path.at(-1),bit);
      }
    }
  }
  const g8 = loadedImage?.log === w?.log && loadedImage?.url === api?.CFG?.url ? loadedImage?.data : null;
  const image = w?.mode === 'replay' ? [] : imageRows(w,g8,j0,Math.min(hd,joint?.end ?? hd));
  return {source, hd, bd, path, estimate, bit, plan, offset:[], intervals, joint,
    joints:joints.slice(-7).map(j => j === active ? joint : j), rows, image, lastSurvey,
    label:[w?.log?.nameWell || w?.log?.w,w?.log?.nameWb || w?.log?.b].filter(Boolean).join(' / ') || 'SELECT A WELL AND TIME LOG',
    imageName:image.length ? g8.img.name : null, key, feed:w};
}

function set(id, text) { $(id).textContent = text; }
function statuses(id, rows) {
  $(id).replaceChildren(...rows.map(([label,value,alert]) => {
    const li = document.createElement('li'), t = document.createElement('span'), b = document.createElement('b');
    t.textContent = label; b.textContent = value; b.dataset.alert = Boolean(alert);
    li.append(t,b); return li;
  }));
}

function renderTally(model) {
  const {joint,joints,source} = model;
  const simMode = source === 'SIM';
  const list = $('opsTally');
  if (!joints.length) {
    const li = document.createElement('li');
    li.textContent = simMode ? 'Waiting for the simulator' : 'Waiting for detectable connections';
    list.replaceChildren(li);
  } else list.replaceChildren(...joints.map(j => {
    const li = document.createElement('li'), b = document.createElement('b'), n = document.createElement('span');
    li.setAttribute('aria-current',j === joint ? 'true' : 'false');
    b.textContent = (simMode ? 'S-' : 'I-') + String(j.number).padStart(2,'0');
    n.textContent = finite(j.end) ? (j.estimated ? '≈ ' : '') + fmt(j.end) : 'Open';
    li.append(b,n); return li;
  }));
  const p = jointProgress(joint,model.hd,model.intervals);
  set('opsJoint', joint ? (simMode ? 'Stand ' : 'Interval ') + String(joint.number).padStart(2,'0') : 'Joint progress');
  set('opsMetres',p ? fmt(p.drilled) + ' / ' + fmt(p.length) + ' m' : '—');
  set('opsPct',finite(p?.pct) ? fmt(p.pct,0) + '%' : '—');
  set('opsStart','START MD  ' + fmt(joint?.start) + ' m');
  set('opsEnd','END MD  ' + (joint?.estimated ? '≈ ' : '') + fmt(joint?.end) + ' m');
  const bar = $('opsBar');
  const span = p?.length || p?.drilled;
  bar.setAttribute('aria-label', p ? Object.entries(p.totals).map(([k,v]) => MODE_NAMES[k] + ' ' + fmt(v) + ' m').join(', ') : 'Joint interval unavailable');
  bar.replaceChildren(...(p?.segments || []).map(s => {
    const el = document.createElement('span');
    el.dataset.mode = s.mode; el.style.width = (100*s.metres/span) + '%';
    el.title = MODE_NAMES[s.mode] + ' ' + fmt(s.metres) + ' m';
    if (s.metres/span >= .12) el.textContent = el.title;
    return el;
  }));
  const seq = model.s?.seq;
  const next = seq ? seq.steps.slice(seq.i,seq.i+3).map((s,i) => [s[0],i ? '' : 'Current']) :
    simMode ? [[model.s._sd ? 'Stand drilled' : 'Finish stand',''],['Take survey',''],['Make connection','']] :
    [['Observer mode','Read-only'],['Connections','Inferred']];
  statuses('opsNext',next);
}

function radar(model) {
  const simMode = model.source === 'SIM';
  const pts = points => points.map(p => ({md:p.md,E:p.e,N:p.n,Z:p.tvd}));
  const planned = model.plan.filter(p => p.md >= model.hd && p.md <= model.hd + 120);
  const off = model.offset.filter(p => p.md >= model.hd - 90 && p.md <= model.hd + 210);
  const result = simMode && planned.length && off.length ? pair({pts:pts(planned)},{pts:pts(off)}) : null;
  const hit = result && atMD(model.offset,result.mdOff), ref = result && atMD(model.plan,result.mdRef);
  const reported = model.source === 'WITSML STALE' ? null : model.rows.at(-1);
  set('opsRadarLabel',simMode ? 'SIM LOOK-AHEAD · 120 m' : 'FEED-REPORTED');
  set('opsSF',finite(result?.sf) ? 'SF ' + fmt(result.sf,2) : finite(reported?.sf) ? 'SF ' + fmt(reported.sf,2) : '—');
  set('opsRadarDetail',simMode ? finite(result?.ctc) ?
    fmt(result.ctc) + ' m centreline · simplified training model' : 'No planned stations ahead' :
    model.source === 'WITSML STALE' ? 'Feed stale' :
    finite(reported?.ctc) ? fmt(reported.ctc) + ' m centreline · upstream calculation' :
    finite(reported?.sf) ? 'Upstream calculation' : 'No mapped anti-collision data');
  if (!simMode && finite(reported?.east) && finite(reported?.north)) {
    const scale = 53 / Math.max(100,Math.hypot(reported.east,reported.north));
    $('opsRadarTargets').innerHTML = '<circle cx="62" cy="62" r="3" fill="#26caff"/><circle cx="' +
      (62+reported.east*scale) + '" cy="' + (62-reported.north*scale) + '" r="4" fill="#bc8df8"/>';
    return;
  }
  $('opsRadarTargets').innerHTML = hit && ref ? (() => {
    const scale = 53 / Math.max(100,result.ctc + radius(result.mdOff));
    const x = 62 + (hit.e-ref.e)*scale, y = 62 - (hit.n-ref.n)*scale;
    return '<circle cx="62" cy="62" r="' + radius(result.mdRef)*scale + '" fill="none" stroke="#26caff" stroke-dasharray="3 2"/>' +
      '<circle cx="62" cy="62" r="3" fill="#26caff"/><circle cx="' + x + '" cy="' + y + '" r="' + radius(result.mdOff)*scale +
      '" fill="none" stroke="#bc8df8" stroke-dasharray="3 2"/><circle cx="' + x + '" cy="' + y + '" r="4" fill="#bc8df8"/>';
  })() : '';
}

function renderSignals(model) {
  const latest = model.rows.at(-1) || {};
  const stale = model.source === 'WITSML STALE';
  const flag = (label,key) => [label, stale ? 'Feed stale' : latest[key] === 1 ? 'Active' :
    latest[key] === 0 ? 'No active flag' : 'No alarm channel', !stale && latest[key] === 1];
  statuses('opsAlerts',[flag('Stick-slip','stick'),flag('Pack-off','pack'),flag('Motor stall','stall')]);
  const flow = finite(latest.flow) && finite(latest.out) ? latest.out - latest.flow : null;
  statuses('opsControl',[
    ['Flow out − in',stale ? 'Feed stale' : finite(flow) ? (flow > 0 ? '+' : '') + fmt(flow,0) + ' L/min' : 'Need both flow channels'],
    ['Active pit volume',stale ? 'Feed stale' : finite(latest.pit) ? fmt(latest.pit,2) + ' m³' : 'No channel'],
    ['Total gas',stale ? 'Feed stale' : finite(latest.gas) ? fmt(latest.gas,2) + ' %' : 'No channel'],
  ]);
}

function renderScene(model) {
  const values = new Map();
  if (view === 'torque' || view === 'wob') for (const r of model.rows) {
    if (finite(r.hd) && finite(r[view]) && finite(r.bd) && Math.abs(r.hd-r.bd) <= .6) {
      values.set(Math.floor(r.hd),r[view]);
    }
  }
  const all = [...values.values()], min = all.length ? Math.min(...all) : 0, max = all.length ? Math.max(...all) : 0;
  model.heat = new Map([...values].map(([k,v]) => [k,max > min ? (v-min)/(max-min) : .5]));
  const legend = $('opsLegend');
  const keys = view === 'mode' ? [['#18c9ff','Rotary'],['#ffb639','Slide'],['#87adc2','Unclassified']] :
    view === 'plan' ? [['#18c9ff',model.plan.length ? 'Actual' : 'Actual · no matched plan']] :
    [['#7fb9e0',all.length ? fmt(min) + '–' + fmt(max) + (view === 'wob' ? ' kN' : ' kN·m') : 'No mapped ' + view.toUpperCase()]];
  if (model.plan.length) keys.push(['#c6dae3','Plan']);
  if (model.offset.length) keys.push(['#ad82ef','SIM offset']);
  if (model.estimate.length) keys.push(['#ffb639','Estimated to bit']);
  keys.push(['#a0b4c4','Illustrative geology']);
  legend.replaceChildren(...keys.map(([color,text]) => {
    const s = document.createElement('span'); s.style.color = color; s.textContent = text; return s;
  }));
  const empty = $('opsEmpty');
  empty.hidden = Boolean(scene && model.path.length > 1);
  empty.textContent = !scene ? '3D view requires WebGL' : 'No matched trajectory survey';
  set('opsBit',model.estimate.length ? 'EST. BIT' : 'BIT');
  const key = [model.key,view,model.path.length,model.plan.length,model.estimate.length,
    model.hd?.toFixed(1),model.bd?.toFixed(1),model.lastSurvey,
    model.path.at(-1)?.tvd,model.path.at(-1)?.n,model.plan.at(-1)?.tvd,model.intervals.at(-1)?.mode,model.rows.at(-1)?.[view]].join('|');
  if (key !== lastSceneKey) {
    lastSceneKey = key;
    scene?.update(model,view);
  }
}

function renderPlots(model) {
  const start = model.joint?.start ?? (finite(model.hd) ? Math.max(0,model.hd-30) : null);
  const end = model.joint?.end ?? model.hd;
  const recent = model.rows.slice(-1000);
  const depth = finite(start) && end > start;
  const rows = depth ? recent.filter(r => r.hd >= start && r.hd <= Math.min(end,model.hd)).map(r => ({...r,x:r.hd})) :
    recent.slice(-150).map(r => ({...r,x:r.t}));
  for (const [i,track] of TRACKS.entries()) {
    chart($('opsTrack'+i),track,rows,depth ? start : rows[0]?.t,depth ? end : rows.at(-1)?.t,
      depth ? 'depth' : model.source === 'SIM' ? 'simtime' : 'time');
  }
  imageLog($('opsImage'),model.image,start,end,model.bd,model.hd);
  set('opsDepth',(finite(model.bd) ? 'BIT  ' + fmt(model.bd) + ' m MD' : 'BIT MD unavailable') +
    (model.source === 'SIM' ? ' · synthetic image' : model.imageName ? ' · ' + model.imageName : imageError ? ' · ' + imageError : ''));
  const button = $('opsLoadImage');
  button.hidden = !['WITSML LIVE','WITSML SIM-TEST'].includes(model.source) || !window.GX?.geo8?.load;
  button.disabled = loadingImage;
  button.textContent = loadingImage ? 'Loading image…' : 'Load WITSML image';
}

function render() {
  if (!root) return;
  const g = window.G, api = window.GX?.witsml;
  if (!g) return;
  const source = feedSource(api?.WML, Date.now(), api?.CFG);
  const m = source === 'SIM' ? gameModel(g) : feedModel(api,source);
  set('opsWell','DRILLING OPERATIONS  •  ' + m.label);
  set('opsSource',(source === 'SIM' ? 'TRAINING SIMULATION' : source) + sourceStamp(api?.WML, source));
  $('opsSource').dataset.live = source === 'WITSML LIVE';
  $('opsConnect').disabled = !api?.open;
  renderTally(m); radar(m); renderSignals(m); renderScene(m); renderPlots(m);
  const s = m.s;
  const can = source === 'SIM' && !s?.seq;
  for (const button of root.querySelectorAll('[data-cmd]')) {
    const cmd = button.dataset.cmd;
    button.disabled = !can || (cmd === 'connection' && s.dw.quill > 6);
    button.setAttribute('aria-pressed',String(Boolean(s && !s.seq &&
      (cmd === 'hold' ? s.dw.mode === 'hold' : ['slide','rotate'].includes(cmd) && s.dw.mode === 'auto' && s.mode === cmd))));
  }
  const state = !s ? 'Observer only' : s.seq ? s.seq.steps[s.seq.i][0] :
    s.dw.mode === 'hold' ? 'Hold active' : s.mode === 'slide' ? 'Slide active' : 'Rotary active';
  set('opsExecution',Date.now() < messageAt+3500 ? message : state);
  const latest = m.rows.at(-1);
  set('opsSurvey','LAST SURVEY  ' + fmt(m.lastSurvey) + ' m MD  •  TOOLFACE  ' +
    (finite(latest?.tf) ? fmt(latest.tf,0) + '°' : '—'));
  set('opsFooter',source === 'SIM' ? 'SIMULATED SIGNALS · SESSION STAND TALLY' :
    latest ? 'READ-ONLY · SAMPLE ' + new Date(latest.t*1000).toISOString().replace('T',' ').slice(0,19) + ' UTC' :
      'READ-ONLY · WAITING FOR A WITSML TIME LOG');
}

function command(cmd) {
  const {S:s,PH:ph,act,startConn} = window.G;
  const api = window.GX?.witsml;
  if (feedSource(api?.WML, Date.now(), api?.CFG) !== 'SIM' || s.seq) return;
  if (cmd === 'survey') {
    if (s.md > s.lastS + .001) ph.survey(s);
    message = 'Survey recorded at ' + fmt(s.md*FT) + ' m MD';
  } else if (cmd === 'connection') {
    if (s.dw.quill > 6) return;
    startConn();
    message = 'Connection sequence started';
  } else if (cmd === 'hold') {
    act('hold'); message = 'Hold active';
  } else {
    if (!ph.doAct(s,'drill')) message = 'Interlock · ' + ph.guard(s,'drill');
    else { act(cmd); message = cmd === 'slide' ? 'Slide active' : 'Rotary active'; }
  }
  messageAt = Date.now();
  render();
}

async function loadFeedImage() {
  const api = window.GX?.witsml, geo = window.GX?.geo8;
  if (loadingImage || !api?.WML?.log || !geo?.load) return;
  const log = api.WML.log, url = api.CFG.url;
  loadingImage = true; imageError = ''; render();
  try {
    await geo.load();
    if (api.WML.log !== log || api.CFG.url !== url) return;
    const {img, well, wb, sim} = geo.G8;
    loadedImage = {log,url,data:{img,well,wb,sim}};
    if (!img?.rows?.length) imageError = 'No compatible image log found';
  } catch {
    if (api.WML.log === log) imageError = 'Image load failed';
  } finally {
    loadingImage = false;
    render();
  }
}

function keydown(e) {
  if (e.key === 'Escape') { e.stopPropagation(); close(); }
}
function loadCSS() {
  if ($('opsCSS')) return;
  const link = document.createElement('link');
  link.id = 'opsCSS'; link.rel = 'stylesheet'; link.href = new URL('./operations.css?v=ol2',import.meta.url);
  document.head.append(link);
}

export function open() {
  if (root) return;
  loadCSS();
  origin = document.activeElement;
  root = document.createElement('section');
  root.id = 'dwOperations'; root.setAttribute('aria-label','Drilling operations dashboard');
  root.innerHTML = MARKUP;
  root.style.visibility = 'hidden';
  document.body.append(root);
  try { scene = createCutaway($('opsScene'),$('opsBit')); } catch (e) { console.warn('Operations 3D',e); }
  root.style.visibility = '';
  $('opsClose').onclick = () => close();
  $('opsLoadImage').onclick = loadFeedImage;
  $('opsConnect').onclick = () => {
    close(); window.GX?.witsml?.open?.();
    // Keep this workflow above unrelated floating simulator controls.
    const panel = $('witsml');
    if (panel) panel.style.zIndex = '100021';
  };
  root.addEventListener('click',e => {
    const button = e.target.closest('button');
    if (button?.dataset.view) {
      view = button.dataset.view;
      for (const b of root.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed',String(b === button));
      render();
    }
    if (button?.dataset.cmd) command(button.dataset.cmd);
  });
  root.querySelector('[data-view="' + view + '"]').setAttribute('aria-pressed','true');
  if (view !== 'mode') root.querySelector('[data-view=mode]').setAttribute('aria-pressed','false');
  root.addEventListener('keydown',keydown);
  $('opsClose').focus({preventScroll:true});
  render();
  timer = setInterval(render,400);
}
export function close() {
  if (!root) return;
  clearInterval(timer);
  scene?.dispose();
  scene = null; lastSceneKey = '';
  root.remove(); root = null;
  origin?.focus?.({preventScroll:true});
}
