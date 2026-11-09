import {FT, TRACKS, actualSurveyStations, drilledIntervals, fallbackInterval, feedConnectionIntervals, feedJoints, feedSource, finite, imageRows,
  jointProgress, latestChannel, readSamples, surveyDepthIntervals, surveyDoglegs, surveyHoleContext, surveyIntervals as estimateSpans, surveyMatches} from './operations_data.js?v=j13b-20261109';
import {sourceBackedSummary} from './rtoc_summary.js?v=j13b-20261109';
import {chart, doglegChart, imageLog} from './operations_plots.js?v=ops-observer-r4';
import {minCurvStations, samplePath} from './geo.js?v=fp-ops-r2-20261108';
import {createCutaway} from './operations_scene.js?v=ops-observer-r1';

const $ = id => document.getElementById(id);
const fmt = (v, digits = 1) => finite(v) ? v.toLocaleString('en-AU', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
}) : '—';
const surveyPoint = p => ({md:p.md*FT, n:p.ns*FT, e:p.ew*FT, tvd:p.tvd*FT});
const MODES = [['mode','Survey trajectory'], ['plan','Plan vs Actual'], ['dls','DLS']];
const MODE_NAMES = {slide:'Slide', rotary:'Rotary', remaining:'Remaining', unknown:'Unclassified'};
const TRACK_HTML = TRACKS.map(([name], i) =>
  '<section class="ops-panel"><h3>' + name + '</h3><p class="ops-muted" id="opsLatest' + i + '"></p><canvas id="opsTrack' + i + '" role="img" aria-label="' + name + ' trend"></canvas></section>'
).join('');
const RADAR = '<svg viewBox="0 0 124 124" role="img" aria-label="Anti-collision radar, plan view">' +
  '<g fill="none" stroke="#426478" stroke-width="1"><circle cx="62" cy="62" r="56"/><circle cx="62" cy="62" r="37"/>' +
  '<circle cx="62" cy="62" r="19"/><path d="M6 62h112M62 6v112"/></g><text x="65" y="13" fill="#a0b7c8" font-size="8">N</text>' +
  '<g id="opsRadarTargets"></g></svg>';

const MARKUP = `
  <div class="ops-shell">
    <header class="ops-header">
      <h1 class="ops-brand"><em>ROBOTYX</em><i>/</i>DRILLING WORLD</h1>
      <div class="ops-meta"><div id="opsWell">DRILLING OPERATIONS</div><time id="opsSourceTime" class="ops-muted"></time></div>
      <div class="ops-flex"><span class="ops-badge" id="opsSource" role="status">STARTING</span>
        <button id="opsConnect" type="button" aria-expanded="false" aria-controls="opsWitsmlDock">WITSML</button><button id="opsClose" type="button">Exit dashboard</button></div>
    </header>
    <div class="ops-layout">
    <aside id="opsWitsmlDock" aria-label="WITSML connection" hidden></aside>
    <div class="ops-content">
    <div class="ops-grid">
      <aside class="ops-panel">
        <div class="ops-heading ops-flex"><h2>Joint tally</h2><span class="ops-muted">End MD (m)</span></div>
        <ul class="ops-list" id="opsTally"></ul>
        <h2 class="ops-heading">Calculated connections</h2>
        <ul class="ops-list ops-status" id="opsConnectionIntervals"></ul>
        <p class="ops-note ops-muted">Hole MD at each connection. An interval can span a stand.</p>
        <h2 class="ops-heading">Survey MD intervals</h2>
        <ul class="ops-list ops-status" id="opsSurveyIntervals"></ul>
        <p class="ops-note ops-muted">Survey-to-survey spans are estimates. A span is not one joint, and a gap is not split into joints.</p>
        <h2 class="ops-heading">Source checks</h2><ul class="ops-list ops-status" id="opsNext"></ul>
      </aside>
      <main class="ops-center">
        <section class="ops-panel ops-progress ops-pad" aria-label="Joint progress">
          <div class="ops-flex"><strong id="opsJoint">Joint progress</strong><strong id="opsMetres"></strong><strong class="ops-pct" id="opsPct"></strong></div>
          <div class="ops-bar" id="opsBar"></div>
          <div class="ops-flex ops-muted"><span id="opsStart"></span><span id="opsEnd"></span></div>
          <p class="ops-note" id="opsJointEstimate"></p>
        </section>
        <section class="ops-panel ops-stage" aria-label="Interactive 3D well cutaway">
          <canvas id="opsScene" aria-label="3D well cutaway. Drag to orbit and scroll to zoom."></canvas>
          <div class="ops-dls" id="opsDlsPanel" hidden>
            <p id="opsDlsSummary" class="ops-note"></p>
            <canvas id="opsDlsChart" role="img" aria-label="Dogleg severity by absolute survey measured depth"></canvas>
          </div>
          <div class="ops-tabs" role="group" aria-label="Well view overlay">${MODES.map(([key,label]) =>
            '<button type="button" data-view="' + key + '" aria-pressed="' + (key === 'mode') + '">' + label + '</button>').join('')}</div>
          <div class="ops-empty-view" id="opsEmpty" hidden></div><span class="ops-bit" id="opsBit" hidden>BIT</span>
          <div class="ops-legend" id="opsLegend"></div>
        </section>
        <section class="ops-panel ops-pad ops-commands">
          <h2>Operations</h2>
          <span class="ops-readonly">READ-ONLY</span>
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
    <p class="ops-note ops-muted" id="opsTrackWindow"></p>
    <div class="ops-tracks">${TRACK_HTML}</div>
    <section class="ops-panel ops-pad" id="opsWellSummary" aria-label="Selected well summary"></section>
    <footer class="ops-footer"><span id="opsSurvey"></span><span id="opsFooter"></span></footer>
    </div>
    </div>
  </div>`;

let root, scene, timer, view = 'mode', origin;
let feed = {}, lastSceneKey = '';
const observation = {};
let loadedImage, loadingImage = false, imageError = '';

function feedModel(api, source) {
  const w = api?.WML;
  const selected = source === 'WITSML LIVE' ? api?.data?.() : null;
  const data = selected?.src === 'live' && selected.rows === w?.hist ? selected : null;
  if (source === 'WITSML LIVE' && !data) source = 'WITSML WAITING';
  const key = JSON.stringify([api?.CFG?.url,w?.log?.w,w?.log?.b,w?.log?.uid,source]);
  const history = data?.rows;
  const tail = history?.at(-1);
  const stamp = [history?.length, tail?.t, Array.isArray(tail?.x) ? tail.x.join('\u001f') : '', JSON.stringify(api?.CFG?.map)].join('|');
  if (feed.key !== key || feed.stamp !== stamp || feed.history !== history) {
    const rows = readSamples(data, w?.log, api?.CFG?.map, Infinity, window.U);
    feed = {key,stamp,history,rows,tally:feedJoints(rows),
      connections:feedConnectionIntervals(rows),intervals:drilledIntervals(rows)};
  }
  const {rows, tally, intervals, connections} = feed;
  const latest = rows.at(-1);
  const hd = latest?.hd, bd = latest?.bd;
  const {joints, active:joint} = tally;
  const path = [];
  let plan = [], surveyIntervals = [], doglegs = [], surveyDatum;
  let lastSurvey = null;
  const geo = window.GEO;
  if (data && surveyMatches(w,geo,api?.CFG?.svWell)) {
    const raw = actualSurveyStations(geo.surv.stations,w.log.b,w.sv.cur.uid);
    const native = raw.map(s => ({
      nativeMd: Number.isFinite(s.nativeMd) ? s.nativeMd : s.md,
      uom: s.uom || (Number.isFinite(s.nativeMd) ? 'm' : 'ft'),
      wb: s.wb, typ: s.typ || '', datum: s.datum || '',
    }));
    const depthSpans = surveyDepthIntervals(raw);
    const estimated = estimateSpans(native, w.log.w, w.log.b, api?.CFG?.svWell);
    surveyIntervals = estimated.length ? estimated.map(span => {
      const match = depthSpans.find(d => Math.abs(d.start - span.start) < 1e-3 && Math.abs(d.end - span.end) < 1e-3);
      return {...span, startTime: match?.startTime, endTime: match?.endTime};
    }) : depthSpans;
    const datum = raw[0]?.datum;
    const valid = raw.every(station => station.datum === datum &&
      finite(station.inc) && station.inc >= 0 && station.inc <= 180 && finite(station.azi));
    const stations = valid ? minCurvStations(raw) : [];
    doglegs = surveyDoglegs(stations);
    surveyDatum = datum;
    const end = stations.at(-1)?.md;
    if (raw.length) lastSurvey = raw.at(-1).md * FT;
    if (stations.length >= 2 && end > stations[0].md) {
      path.push(...samplePath(stations,end,Math.max(12,end/160)).map(surveyPoint));
      const candidate = w.svCands?.find(c => c.wb === w.log.b &&
        c.uid !== w.sv.cur.uid && c.st?.length >= 2 &&
        datum && c.st.every(x => x.datum === datum && /^(plan|planned|proposed)$/.test(x.typ)));
      if (candidate) plan = minCurvStations(candidate.st).map(surveyPoint);
    }
  }
  const canShowIdentity = !['WITSML TEST FEED','WITSML REPLAY','WITSML DISCONNECTED'].includes(source);
  const g8 = loadedImage?.log === w?.log && loadedImage?.url === api?.CFG?.url ? loadedImage?.data : null;
  const image = data ? imageRows(w,g8,-Infinity,Infinity) : [];
  const gamma = data && g8 && g8.well === w.log.w && g8.wb === w.log.b && !g8.sim
    ? g8.fe?.gr?.findLast(row => finite(row.md) && finite(row.v)) : null;
  return {source, hd, bd, path, plan, intervals, joint, joints, rows, image, lastSurvey, surveyIntervals, connections, doglegs, surveyDatum, gammaMd:gamma?.md,
    label:(canShowIdentity && [w?.log?.nameWell || w?.log?.w,w?.log?.nameWb || w?.log?.b].filter(Boolean).join(' / ')) || 'SELECT A WELL AND TIME LOG',
    imageName:image.length ? g8.img.name : null, key};
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
  const {joint,joints} = model;
  const list = $('opsTally');
  if (!joints.length) {
    const li = document.createElement('li');
    li.textContent = 'No source joint tally';
    list.replaceChildren(li);
  } else list.replaceChildren(...joints.map(j => {
    const li = document.createElement('li'), b = document.createElement('b'), n = document.createElement('span');
    li.setAttribute('aria-current',j === joint ? 'true' : 'false');
    b.textContent = finite(j.number) ? 'J-' + String(j.number).padStart(2,'0') : 'Joint';
    n.textContent = fmt(j.end);
    li.append(b,n); return li;
  }));
  const p = jointProgress(joint,model.hd,model.intervals);
  set('opsJoint', finite(joint?.number) ? 'Joint ' + String(joint.number).padStart(2,'0') : 'Joint progress');
  set('opsMetres',p ? fmt(p.drilled) + ' / ' + fmt(p.length) + ' m' : '—');
  set('opsPct',finite(p?.pct) ? fmt(p.pct,0) + '%' : '—');
  set('opsStart','START MD  ' + fmt(joint?.start) + ' m');
  set('opsEnd','END MD  ' + fmt(joint?.end) + ' m');
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
  const mdRange = (start,end) => fmt(start,2) + ' → ' + fmt(end,2) + ' m MD';
  const connectionRows = model.connections.slice(-3).reverse().map(({start,end,length}) =>
    [mdRange(start,end),fmt(length,2) + ' m']);
  statuses('opsConnectionIntervals',connectionRows.length ? connectionRows : [['No verified connection pair','']]);

  const surveyRows = model.surveyIntervals.slice(-4).reverse().flatMap(interval => {
    const start = surveyHoleContext(model.rows,interval.startTime);
    const end = surveyHoleContext(model.rows,interval.endTime);
    const rows = [[mdRange(interval.start,interval.end),fmt(interval.length,2) + ' m']];
    if (start && end && Date.parse(interval.endTime) > Date.parse(interval.startTime) && end.holeMd >= start.holeMd) {
      rows.push(['Hole ' + mdRange(start.holeMd,end.holeMd),fmt(end.holeMd-start.holeMd,2) + ' m']);
    } else if (end) {
      rows.push(['Hole MD at survey',fmt(end.holeMd,2) + ' m']);
    }
    if (finite(end?.pickup)) rows.push(['Bit pickup at survey',fmt(end.pickup,2) + ' m']);
    return rows;
  });
  statuses('opsSurveyIntervals',surveyRows.length ? surveyRows : [['No matched source survey intervals','']]);
  const fallback = !joints.length && !model.surveyIntervals.length ? fallbackInterval(model.hd) : null;
  set('opsJointEstimate', joints.length
    ? 'Reported joint boundaries stay separate from survey-span estimates. A survey span is not one joint.'
    : fallback
      ? fallback.basis
      : model.surveyIntervals.length
        ? 'Survey spans are estimates only. Joint count inside a gap is unknown.'
        : 'No measured joint length. Nothing is invented.');
  statuses('opsNext',[
    ['Time log', model.source === 'WITSML LIVE' ? 'Advancing' : 'Unavailable'],
    ['Joint boundaries', joints.length ? 'Source reported' : 'Unavailable'],
    ['Trajectory', model.path.length ? 'Matched survey' : 'Unavailable'],
    ['Hole MD', finite(model.hd) ? fmt(model.hd,2) + ' m' : 'Unavailable'],
    ['Bit MD', finite(model.bd) ? fmt(model.bd,2) + ' m' : 'Unavailable'],
    ['Gamma log MD', finite(model.gammaMd) ? fmt(model.gammaMd,2) + ' m' : 'Unavailable'],
  ]);
}

function radar(model) {
  const reported = model.rows.at(-1);
  set('opsRadarLabel','SOURCE REPORTED');
  set('opsSF',finite(reported?.sf) ? 'SF ' + fmt(reported.sf,2) : '—');
  set('opsRadarDetail',finite(reported?.ctc) ? fmt(reported.ctc) + ' m centreline' :
    finite(reported?.sf) ? 'Upstream calculation' : 'No mapped anti-collision data');
  const targets = $('opsRadarTargets');
  if (finite(reported?.east) && finite(reported?.north)) {
    const scale = 53 / Math.max(100,Math.hypot(reported.east,reported.north));
    targets.innerHTML = '<circle cx="62" cy="62" r="3" fill="#26caff"/><circle cx="' +
      (62+reported.east*scale) + '" cy="' + (62-reported.north*scale) + '" r="4" fill="#bc8df8"/>';
  } else targets.replaceChildren();
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
  const showDls = view === 'dls';
  $('opsScene').hidden = showDls;
  $('opsDlsPanel').hidden = !showDls;
  $('opsLegend').hidden = showDls;
  if (showDls) {
    $('opsEmpty').hidden = true;
    const latest = model.doglegs.at(-1);
    set('opsDlsSummary', latest ? 'Latest DLS ' + fmt(latest.dls,2) + ' °/30 m · Survey MD ' +
      fmt(latest.start,2) + '–' + fmt(latest.end,2) + ' m · Datum ' + (model.surveyDatum || 'unreported') :
      'DLS unavailable · Need two actual survey stations on the same depth datum.');
    doglegChart($('opsDlsChart'),model.doglegs);
    return;
  }
  const legend = $('opsLegend');
  const keys = [['#87adc2','Survey trajectory'],['#a0b4c4','Schematic terrain']];
  if (view === 'plan') keys.push(['#c6dae3',model.plan.length ? 'Plan' : 'No plan on matching survey datum']);
  keys.push(['#a0b4c4','Survey-only view · log MD alignment unverified']);
  legend.replaceChildren(...keys.map(([color,text]) => {
    const s = document.createElement('span'); s.style.color = color; s.textContent = text; return s;
  }));
  const empty = $('opsEmpty');
  empty.hidden = Boolean(scene && model.path.length > 1);
  empty.textContent = !scene ? '3D view requires WebGL' : 'No matched trajectory survey';
  const key = [model.key,view,model.path.length,model.plan.length,
    model.lastSurvey,model.path.at(-1)?.tvd,model.path.at(-1)?.n,model.plan.at(-1)?.tvd].join('|');
  if (key !== lastSceneKey) {
    lastSceneKey = key;
    scene?.update({...model,plan:view === 'plan' ? model.plan : [],intervals:[]},'mode');
  }
}

function renderPlots(model) {
  const start = model.joint?.start, end = model.joint?.end;
  const depth = finite(start) && finite(end) && end > start;
  const rows = depth ? model.rows.filter(r => finite(r.hd) && r.hd >= start && r.hd <= end).map(r => ({...r,x:r.hd})) :
    model.rows.slice(-150).map(r => ({...r,x:r.t}));
  set('opsTrackWindow',depth ? 'JOINT WINDOW · HOLE MD ' + fmt(start,2) + '–' + fmt(end,2) + ' m' :
    'RECENT TIME · SOURCE JOINT BOUNDARIES UNAVAILABLE');
  const stale = model.source === 'WITSML STALE';
  const noteFor = key => {
    const state = latestChannel(model.rows, key, stale);
    if (state === 'value') return fmt(model.rows.at(-1)[key],key === 'ecd' ? 2 : 1);
    if (state === 'blank') return '— no sample';
    if (state === 'stale') return 'feed stale';
    return 'no channel';
  };
  for (const [i,track] of TRACKS.entries()) {
    chart($('opsTrack'+i),track,rows,depth ? start : rows[0]?.t,depth ? end : rows.at(-1)?.t,
      depth ? 'depth' : 'time');
    set('opsLatest'+i, track.slice(1).map(([key,name]) => name + ' ' + noteFor(key)).join(' · '));
  }
  const imageEnd = model.image.at(-1)?.md;
  const image = model.image.filter(row => row.md >= imageEnd - 30);
  const imageStart = image[0]?.md;
  imageLog($('opsImage'),image,imageStart,imageEnd);
  const imageDepth = finite(imageEnd) ? 'LWD INDEX MD ' + fmt(imageStart,2) + '–' + fmt(imageEnd,2) + ' m · ' : '';
  set('opsDepth',imageDepth + (model.imageName || imageError || 'Image unavailable'));
  const button = $('opsLoadImage');
  button.hidden = model.source !== 'WITSML LIVE' || !window.GX?.geo8?.load;
  button.disabled = loadingImage;
  button.textContent = loadingImage ? 'Loading image…' : 'Load WITSML image';
}

function render() {
  if (!root) return;
  const api = window.GX?.witsml;
  const m = feedModel(api,feedSource(api?.WML,Date.now(),api?.CFG,observation));
  const {source} = m;
  set('opsWell','DRILLING OPERATIONS  •  ' + m.label);
  set('opsSource',source);
  $('opsSource').dataset.live = source === 'WITSML LIVE';
  $('opsConnect').disabled = !api?.open;
  renderTally(m); radar(m); renderSignals(m); renderScene(m); renderPlots(m);
  set('opsExecution',source === 'WITSML LIVE' ? 'Following the selected time log' :
    'Open WITSML, select the well and time log, then press Start live.');
  const latest = m.rows.at(-1);
  const sourceTime = $('opsSourceTime');
  const iso = !finite(latest?.t) ? '' : new Date(latest.t * 1000).toISOString();
  sourceTime.textContent = iso ? 'SOURCE ' + iso.slice(0,16).replace('T',' ') + ' UTC' : 'SOURCE TIME UNAVAILABLE';
  if (iso) sourceTime.dateTime = iso;
  else sourceTime.removeAttribute('datetime');
  set('opsSurvey','LAST SURVEY MD  ' + fmt(m.lastSurvey) + ' m MD  •  TOOLFACE  ' +
    (finite(latest?.tf) ? fmt(latest.tf,0) + '°' : '—'));
  set('opsFooter',latest ? 'READ-ONLY · SAMPLE ' + new Date(latest.t*1000).toISOString().replace('T',' ').slice(0,19) + ' UTC' :
      'READ-ONLY · WAITING FOR A WITSML TIME LOG');
  renderInventory(api?.wellContract);
}

function renderInventory(contract) {
  const host = $('opsWellSummary');
  if (!host) return;
  const summary = sourceBackedSummary(contract);
  host.replaceChildren();
  const title = document.createElement('h2');
  title.textContent = 'Selected well';
  const lead = document.createElement('p');
  lead.className = 'ops-note';
  lead.textContent = summary.message;
  host.append(title, lead);
  if (!summary.facts.length) return;
  const list = document.createElement('ul');
  list.className = 'ops-list';
  for (const fact of summary.facts) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const value = document.createElement('b');
    name.textContent = fact.fact;
    const shown = Array.isArray(fact.value) ? fact.value.join(', ') : String(fact.value);
    value.textContent = fact.flag ? shown + ' · ' + fact.flag : shown;
    li.append(name, value);
    list.append(li);
  }
  host.append(list);
  if (summary.serverMetadata.length) {
    const note = document.createElement('p');
    note.className = 'ops-note';
    note.textContent = 'Server vendor and version are capability data, not well facts (' + summary.serverMetadata.length + ' kept separate).';
    host.append(note);
  }
}

async function loadFeedImage() {
  const api = window.GX?.witsml, geo = window.GX?.geo8;
  if (loadingImage || !geo?.load || feedSource(api?.WML,Date.now(),api?.CFG,observation) !== 'WITSML LIVE') return;
  const log = api.WML.log, url = api.CFG.url;
  const previousImage = geo.G8.img, previousGamma = geo.G8.fe;
  loadingImage = true; imageError = ''; render();
  try {
    await geo.load();
    if (api.WML.log !== log || api.CFG.url !== url) return;
    const {img, fe, well, wb, sim} = geo.G8;
    const sameScope = loadedImage?.log === log && loadedImage?.url === url;
    const image = img !== previousImage ? img : sameScope ? loadedImage.data.img : null;
    const gamma = fe !== previousGamma ? fe : sameScope ? loadedImage.data.fe : null;
    loadedImage = {log,url,data:{img:image,fe:gamma,well,wb,sim}};
    if (!image?.rows?.length) imageError = 'No compatible image log found';
  } catch {
    if (api.WML.log === log) imageError = 'Image load failed';
  } finally {
    loadingImage = false;
    render();
  }
}

function syncDock() {
  const dock = $('opsWitsmlDock');
  if (!dock) return;
  const panel = $('witsml');
  const open = panel?.parentElement === dock && panel.style.display !== 'none';
  dock.hidden = !open;
  $('opsConnect').setAttribute('aria-expanded', String(open));
  if (!open && dock.dataset.wasOpen === 'true' && document.activeElement === document.body) {
    $('opsConnect').focus({preventScroll:true});
  }
  dock.dataset.wasOpen = String(open);
}
function dockWitsml(open) {
  const dock = $('opsWitsmlDock'), api = window.GX?.witsml;
  if (!api?.open) return;
  if (!open) api.close();
  else {
    api.open();
    const panel = $('witsml');
    if (panel) {
      if (panel.parentElement !== dock) dock.append(panel);
      syncDock();
      panel.querySelector('#wX')?.focus({preventScroll:true});
    }
  }
  syncDock();
}
function keydown(e) {
  if (e.key !== 'Escape') return;
  e.stopPropagation();
  if (!$('opsWitsmlDock').hidden) dockWitsml(false);
  else close();
}
function loadCSS() {
  if ($('opsCSS')) return;
  const link = document.createElement('link');
  link.id = 'opsCSS'; link.rel = 'stylesheet'; link.href = new URL('./operations.css?v=ops-observer-r4',import.meta.url);
  document.head.append(link);
}

export function open() {
  if (root) return;
  // Operations is a read-only, WITSML-backed surface. Reset and suppress the
  // separate sample-only DROPZ training UI while this dashboard is visible.
  window.dropz?.modes?.reset?.();
  document.body.classList.add('operations-active');
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
  const dock = $('opsWitsmlDock');
  window.addEventListener('witsml:panel',syncDock);
  $('opsConnect').onclick = () => dockWitsml(dock.hidden);
  if (window.GX?.witsml?.isOpen?.()) dockWitsml(true);
  root.addEventListener('click',e => {
    const button = e.target.closest('button');
    if (button?.dataset.view) {
      view = button.dataset.view;
      for (const b of root.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed',String(b === button));
      render();
    }
  });
  root.querySelector('[data-view="' + view + '"]').setAttribute('aria-pressed','true');
  if (view !== 'mode') root.querySelector('[data-view=mode]').setAttribute('aria-pressed','false');
  root.addEventListener('keydown',keydown);
  if (dock.hidden) $('opsClose').focus({preventScroll:true});
  render();
  timer = setInterval(render,400);
}
export function close() {
  if (!root) return;
  clearInterval(timer);
  window.removeEventListener('witsml:panel',syncDock);
  if ($('opsWitsmlDock').contains($('witsml'))) window.GX?.witsml?.close?.();
  scene?.dispose();
  scene = null; lastSceneKey = '';
  feed = {}; loadedImage = null; imageError = '';
  feedSource(null,Date.now(),null,observation);
  root.remove(); root = null;
  document.body.classList.remove('operations-active');
  origin?.focus?.({preventScroll:true});
}
