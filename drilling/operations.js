import {FT, TRACKS, actualSurveyStations, drilledIntervals, feedConnectionIntervals, feedJoints, feedSource, finite, imageRows,
  jointProgress, latestChannel, readSamples, surveyDepthIntervals, surveyDoglegs, surveyHoleContext, surveyMatches} from './operations_data.js?v=ops-observer-r5';
import {chart, doglegChart, imageLog} from './operations_plots.js?v=ops-observer-r5';
import {parseLogs, appendRows} from './wdash_core.js?v=well-summary-r1';
import {minCurvStations, samplePath} from './geo.js?v=fp-ops-r2-20261108';
import {createCutaway} from './operations_scene.js?v=ops-observer-r1';
import {buildHistoricalSummary} from './operations_summary.js?v=whole-history-r1';
import {readWholeWellHistory} from './operations_history.js?v=well-history-r1';

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
      <div class="ops-flex"><div class="ops-mode" role="group" aria-label="Dashboard data mode"><button id="opsLiveMode" type="button" aria-pressed="true">LIVE</button><button id="opsHistoryMode" type="button" aria-pressed="false">HISTORY</button><button id="opsDemoMode" type="button" aria-pressed="false">DEMO</button></div><span class="ops-badge" id="opsSource" role="status">STARTING</span>
        <button id="opsHistoryLoad" type="button" hidden>Load full log history</button><button id="opsWholeWell" type="button" hidden>Build whole-well context</button><button id="opsConnect" type="button" aria-expanded="false" aria-controls="opsWitsmlDock">WITSML</button><button id="opsClose" type="button">Exit dashboard</button></div>
    </header>
    <div class="ops-layout">
    <aside id="opsWitsmlDock" aria-label="WITSML connection" hidden></aside>
    <div class="ops-content">
    <div class="ops-grid">
      <aside class="ops-panel">
        <div class="ops-heading ops-flex"><h2>Joint tally</h2><span class="ops-muted">End MD (m)</span></div>
        <input id="opsJointFind" class="ops-joint-find" type="search" placeholder="Find joint number or start MD" aria-label="Find a historical joint" hidden>
        <p id="opsJointCount" class="ops-muted ops-joint-count" hidden></p>
        <ul class="ops-list" id="opsTally"></ul>
        <h2 class="ops-heading">Calculated connections</h2>
        <ul class="ops-list ops-status" id="opsConnectionIntervals"></ul>
        <p class="ops-note ops-muted">Hole MD at each connection. An interval can span a stand.</p>
        <h2 class="ops-heading">Survey MD intervals</h2>
        <ul class="ops-list ops-status" id="opsSurveyIntervals"></ul>
        <p class="ops-note ops-muted">Stand length requires surveys at both stand ends.</p>
        <h2 class="ops-heading">Source checks</h2><ul class="ops-list ops-status" id="opsNext"></ul>
        <section class="ops-summary" id="opsSummaryPanel" aria-label="Historical well summary">
          <div class="ops-flex"><h2>Historical well summary</h2><button id="opsSummaryGenerate" type="button" hidden>Generate 10 facts</button></div>
          <p id="opsSummaryStatus" class="ops-muted">Select a historic well and load its full time log to generate a source-based summary.</p>
          <div id="opsSummaryMetrics" class="ops-summary-metrics" hidden></div>
          <ol id="opsSummaryFacts" class="ops-summary-facts" hidden></ol>
          <div id="opsSummaryBranches" class="ops-summary-branches" hidden></div>
          <p id="opsSummaryLimit" class="ops-note" hidden></p>
        </section>
      </aside>
      <main class="ops-center">
        <section class="ops-panel ops-progress ops-pad" aria-label="Joint progress">
          <div class="ops-flex"><strong id="opsJoint">Joint progress</strong><strong id="opsMetres"></strong><strong class="ops-pct" id="opsPct"></strong></div>
          <div class="ops-bar" id="opsBar"></div>
          <div class="ops-flex ops-muted"><span id="opsStart"></span><span id="opsEnd"></span></div>
        </section>
        <section class="ops-panel ops-stage" aria-label="Interactive 3D well cutaway">
          <svg id="opsFallback" class="ops-fallback" viewBox="0 0 1000 520" role="img" aria-label="Survey section fallback view" hidden>
            <defs>
              <linearGradient id="opsSky" x2="0" y2="1"><stop stop-color="#163a59"/><stop offset=".55" stop-color="#0b2033"/><stop offset="1" stop-color="#101b26"/></linearGradient>
              <linearGradient id="opsRock" x2="0" y2="1"><stop stop-color="#76644b"/><stop offset=".2" stop-color="#4f5050"/><stop offset=".48" stop-color="#303d49"/><stop offset=".72" stop-color="#5b5042"/><stop offset="1" stop-color="#202f3c"/></linearGradient>
              <pattern id="opsStrata" width="44" height="30" patternUnits="userSpaceOnUse"><path d="M0 8h44M0 22h30" stroke="#d2b58a" stroke-opacity=".17" stroke-width="2"/><circle cx="12" cy="15" r="1.3" fill="#d8d1bd" fill-opacity=".28"/></pattern>
              <pattern id="opsGrid" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M46 0H0V46" fill="none" stroke="#56b4e4" stroke-opacity=".11"/></pattern>
              <filter id="opsGlow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <rect width="1000" height="520" fill="url(#opsSky)"/><path d="M0 216 92 160 175 201 272 132 372 205 480 142 570 202 680 127 786 190 888 139 1000 202V310H0Z" fill="#17314a" opacity=".72"/>
            <path d="M0 245 110 203 204 226 312 180 424 234 543 189 655 230 774 176 895 223 1000 190V300H0Z" fill="#263a4a" opacity=".88"/>
            <rect y="250" width="1000" height="270" fill="url(#opsRock)"/><path d="M0 274Q200 255 390 280T1000 268V520H0Z" fill="url(#opsStrata)"/>
            <path d="M0 330Q220 310 420 340T1000 326M0 385Q245 365 500 396T1000 377M0 448Q240 430 510 460T1000 442" fill="none" stroke="#d7b47d" stroke-opacity=".36" stroke-width="13"/>
            <path d="M0 335Q220 315 420 345T1000 331M0 390Q245 370 500 401T1000 382M0 453Q240 435 510 465T1000 447" fill="none" stroke="#202b35" stroke-opacity=".58" stroke-width="5"/>
            <rect y="250" width="1000" height="270" fill="url(#opsGrid)"/>
            <path d="M0 251H1000" stroke="#e3c895" stroke-width="3" opacity=".8"/>
            <g id="opsFallbackRig" stroke="#e7b85c" stroke-width="5" fill="none"><path d="M122 246 155 100 188 246M135 190h40m-45-30h50m-55-30h60m-65-30h70M155 98V57m-20 189 20-145 20 145M117 246h76"/><path d="M105 249h102v18H105z" fill="#475766"/><path d="M111 267v16m26-16v16m26-16v16m26-16v16" stroke="#92acc1"/><path d="M155 82v176" stroke="#16c5ff" stroke-width="4"/></g>
            <path d="M18 492H982" stroke="#a4bfd0" stroke-opacity=".32"/>
            <g id="opsFallbackRoute"></g>
            <g id="opsFallbackBit" hidden><circle r="10" fill="#ffbe45" stroke="#fff1bf" stroke-width="3" filter="url(#opsGlow)"/><text x="15" y="4" fill="#fff1bf" font-size="13" font-weight="700">BIT</text></g>
            <g id="opsFallbackLabel"><rect x="18" y="16" width="255" height="28" rx="5" fill="#07111de8" stroke="#537084"/><text x="31" y="35" fill="#d8e9f5" font-size="13" font-weight="700">SECTION VIEW · SCHEMATIC CONTEXT</text></g>
            <text id="opsFallbackCaption" x="982" y="505" text-anchor="end" fill="#c5d8e6" font-size="12">SURVEY-BASED ROUTE</text>
          </svg>
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
          <h2 id="opsExecTitle">Live operations</h2>
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
    <footer class="ops-footer"><span id="opsSurvey"></span><span id="opsFooter"></span></footer>
    </div>
    </div>
  </div>`;

let root, scene, timer, view = 'mode', origin;
let feed = {}, lastSceneKey = '';
let displayMode = 'live', selectedJointStart = null;
let historicalCache = null, wholeWellCache = null, historyLoading = false;
let historicalSummary = null;
const observation = {};
let loadedImage, loadingImage = false, imageError = '';

function feedModel(api, source, historicalData = null) {
  const w = api?.WML;
  const selected = historicalData || (source === 'WITSML LIVE' ? api?.data?.() : null);
  const data = historicalData?.src === 'historical' ? historicalData : selected?.src === 'live' && selected.rows === w?.hist ? selected : null;
  if (data?.src === 'historical') source = 'WITSML HISTORICAL';
  if (source === 'WITSML LIVE' && !data) source = 'WITSML WAITING';
  const key = JSON.stringify([api?.CFG?.url,w?.log?.w,w?.log?.b,w?.log?.uid,source]);
  const history = data?.rows;
  const tail = history?.at(-1);
  const stamp = [history?.length, tail?.t, Array.isArray(tail?.x) ? tail.x.join('\u001f') : '', JSON.stringify(api?.CFG?.map)].join('|');
  if (feed.key !== key || feed.stamp !== stamp || feed.history !== history) {
    const rows = readSamples(data, w?.log, api?.CFG?.map, Infinity, window.U, historicalData ? Infinity : 12000);
    feed = {key,stamp,history,rows,tally:feedJoints(rows,historicalData ? Infinity : 7),
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
    surveyIntervals = surveyDepthIntervals(raw);
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
function onWitsmlLoaded(event) {
  historicalCache=null;wholeWellCache=null;historicalSummary=null;selectedJointStart=null;
  displayMode=event.detail?.kind==='realtime'?'live':'historical';lastSceneKey='';
  if(root)render();
}
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
  const historical=model.source==='WITSML HISTORICAL', query=$('opsJointFind').value.trim().toLowerCase();
  $('opsJointFind').hidden=!historical;
  $('opsJointCount').hidden=!historical;
  const visibleJoints=historical?(query?joints.filter(j=>String(j.number??'').includes(query)||fmt(j.start,2).includes(query)):joints.slice(-120)):joints;
  $('opsJointCount').textContent=historical?(query?visibleJoints.length+' matching source joints':'Showing latest '+visibleJoints.length+' of '+joints.length+' source joints · search to jump back') : '';
  if (!visibleJoints.length) {
    const li = document.createElement('li');
    li.textContent = joints.length?'No source joint matches':historical?'No joint boundary channels in this log · no lengths inferred':'No source joint tally';
    list.replaceChildren(li);
  } else list.replaceChildren(...visibleJoints.map(j => {
    const li = document.createElement('li'), pick=document.createElement('button'), b = document.createElement('b'), n = document.createElement('span');
    li.setAttribute('aria-current',j === joint ? 'true' : 'false');
    b.textContent = finite(j.number) ? 'J-' + String(j.number).padStart(2,'0') : 'Joint';
    n.textContent = fmt(j.end);
    pick.type='button';pick.className='ops-joint-pick';pick.dataset.jointStart=String(j.start);pick.disabled=!historical;pick.setAttribute('aria-pressed',String(j===joint));pick.append(b,n);
    li.append(pick); return li;
  }));
  const selected = model.joints.find(j=>j.start===selectedJointStart) || joint;
  if (selected) for (const li of list.children) {
    const pick=li.querySelector('[data-joint-start]'), active=Number(pick?.dataset.jointStart)===selected.start;
    li.setAttribute('aria-current',String(active));pick?.setAttribute('aria-pressed',String(active));
  }
  const p = jointProgress(selected,model.hd,model.intervals);
  set('opsJoint', finite(selected?.number) ? 'Joint ' + String(selected.number).padStart(2,'0') : 'Joint progress');
  set('opsMetres',p ? fmt(p.drilled) + ' / ' + fmt(p.length) + ' m' : '—');
  set('opsPct',finite(p?.pct) ? fmt(p.pct,0) + '%' : '—');
  set('opsStart','START MD  ' + fmt(selected?.start) + ' m');
  set('opsEnd','END MD  ' + fmt(selected?.end) + ' m');
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
  statuses('opsNext',[
    ['Time log', model.source === 'WITSML LIVE' ? 'Advancing' : model.source==='WITSML HISTORICAL'?'Historical range loaded':'Unavailable'],
    ['Joint boundaries', joints.length ? 'Source reported' : 'Unavailable'],
    ['Trajectory', model.path.length ? 'Matched survey' : 'Unavailable'],
    ['Hole MD', finite(model.hd) ? fmt(model.hd,2) + ' m' : 'Unavailable'],
    ['Bit MD', finite(model.bd) ? fmt(model.bd,2) + ' m' : 'Unavailable'],
    ['Gamma log MD', finite(model.gammaMd) ? fmt(model.gammaMd,2) + ' m' : 'Unavailable'],
  ]);
}

function radar(model) {
  const reported = model.rows.at(-1);
  set('opsRadarLabel',model.source.startsWith('DEMO') ? 'TRAINING · SYNTHETIC' : 'SOURCE REPORTED');
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
  const historical=model.source==='WITSML HISTORICAL';
  const flag = (label,key) => [label, stale ? 'Feed stale' : historical ? latest[key] === 1 ? 'Flag at historical row' : latest[key] === 0 ? 'Clear at historical row' : 'No alarm channel' : latest[key] === 1 ? 'Active' :
    latest[key] === 0 ? 'No active flag' : 'No alarm channel', !stale && !historical && latest[key] === 1];
  statuses('opsAlerts',[flag('Stick-slip','stick'),flag('Pack-off','pack'),flag('Motor stall','stall')]);
  const flow = finite(latest.flow) && finite(latest.out) ? latest.out - latest.flow : null;
  statuses('opsControl',[
    ['Flow out − in',stale ? 'Feed stale' : finite(flow) ? (flow > 0 ? '+' : '') + fmt(flow,0) + ' L/min'+(historical?' · historic':'') : 'Need both flow channels'],
    ['Active pit volume',stale ? 'Feed stale' : finite(latest.pit) ? fmt(latest.pit,2) + ' m³'+(historical?' · historic':'') : 'No channel'],
    ['Total gas',stale ? 'Feed stale' : finite(latest.gas) ? fmt(latest.gas,2) + ' %'+(historical?' · historic':'') : 'No channel'],
  ]);
}

function renderScene(model) {
  const showDls = view === 'dls';
  $('opsScene').hidden = showDls || !scene;
  $('opsDlsPanel').hidden = !showDls;
  $('opsLegend').hidden = showDls;
  $('opsFallback').hidden = showDls || Boolean(scene);
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
  empty.hidden = scene ? !model.path.length : true;
  empty.textContent = 'No matched trajectory survey';
  if (!scene) drawFallback(model);
  const key = [model.key,view,model.path.length,model.plan.length,
    model.lastSurvey,model.path.at(-1)?.tvd,model.path.at(-1)?.n,model.plan.at(-1)?.tvd].join('|');
  if (key !== lastSceneKey) {
    lastSceneKey = key;
    scene?.update({...model,plan:view === 'plan' ? model.plan : [],intervals:[]},'mode');
  }
}

function drawFallback(model) {
  const svg=$('opsFallback'), route=$('opsFallbackRoute'), bit=$('opsFallbackBit');
  const pts=model.path.filter(p=>finite(p.md)&&finite(p.tvd)&&finite(p.e)&&finite(p.n));
  const demo=model.source.startsWith('DEMO');
  $('opsFallbackCaption').textContent=demo?'DEMO GEOLOGY · SYNTHETIC DATA':'FORMATION DATA UNAVAILABLE · SURVEY ROUTE ONLY';
  $('opsFallbackLabel').querySelector('text').textContent=demo?'TRAINING CUTAWAY · SYNTHETIC GEOLOGY':'SURVEY SECTION · SCHEMATIC CONTEXT';
  $('opsFallbackRig').style.display=pts.length&&Math.abs(pts[0].tvd)<2?'':'none';
  route.replaceChildren(); bit.setAttribute('hidden','');
  if(pts.length<2)return;
  const first=pts[0],last=pts.at(-1),dx=last.e-first.e,dy=last.n-first.n,span=Math.hypot(dx,dy)||1;
  const horizontal=pts.map(p=>((p.e-first.e)*dx+(p.n-first.n)*dy)/span);
  let min=Math.min(0,...horizontal),max=Math.max(1,...horizontal);
  if(max-min<1){min=0;max=1;}
  const maxTvd=Math.max(30,...pts.map(p=>p.tvd));
  const point=p=>[125+740*((((p.e-first.e)*dx+(p.n-first.n)*dy)/span)-min)/(max-min),252+205*p.tvd/maxTvd];
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],pa=point(a),pb=point(b),mid=(a.md+b.md)/2;
    const mode=model.intervals.find(x=>mid>=x.from&&mid<=x.to)?.mode;
    const isCurrent=mid<=model.hd, color=isCurrent?(mode==='slide'?'#ffb638':mode==='rotary'?'#19c8ff':'#9db6c8'):'#9caebc';
    const line=document.createElementNS('http://www.w3.org/2000/svg','path');
    line.setAttribute('d','M'+pa[0].toFixed(1)+' '+pa[1].toFixed(1)+'L'+pb[0].toFixed(1)+' '+pb[1].toFixed(1));
    line.setAttribute('fill','none');line.setAttribute('stroke',color);line.setAttribute('stroke-width',isCurrent?'11':'5');line.setAttribute('stroke-linecap','round');line.setAttribute('opacity',isCurrent?'1':'.52');
    route.append(line);
  }
  const prev=pts.filter(p=>p.md<=model.hd).at(-1)||first,xy=point(prev);
  bit.removeAttribute('hidden');bit.setAttribute('transform','translate('+xy[0].toFixed(1)+' '+xy[1].toFixed(1)+')');
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

// Isolated synthetic fixture. It is used only after an explicit DEMO selection
// and never writes to GX, the WITSML poller, or connection settings.
function demoModel() {
  const base=2384.0, end=2393.6, hd=2390.4, now=Math.floor(Date.now()/1000)-25;
  const rows=Array.from({length:121},(_,i)=>{
    const f=i/120,x=base+(end-base)*f,wave=Math.sin(i*.31),wave2=Math.sin(i*.17+1.2);
    return {t:now-(120-i)*2,hd:x,bd:x-.08,rop:9+wave*1.4,wob:72+wave2*6,torque:6.4+wave*1.1,rpm:98+wave2*9,
      spp:20500+wave*1150,ecd:1.34+wave2*.035,flow:1850+wave*32,out:1844+wave2*30,pit:42.6,gas:.12,
      tf:42,sf:1.62,ctc:31,east:21,north:13,stick:i>83&&i<103?1:0,pack:0,stall:0,mode:f<.27?'slide':'rotary',jointStart:base,jointEnd:end,jointNumber:85};
  });
  const image=Array.from({length:240},(_,i)=>({md:base+(hd-base)*i/239,v:Array.from({length:20},(_,j)=>Math.max(0,Math.min(1,.5+.25*Math.sin(i*.18+j*.42)+.18*Math.cos(i*.07-j*.2))))}));
  const path=Array.from({length:70},(_,i)=>{const f=i/69,md=base+f*(hd-base);return {md,e:Math.max(0,(f-.42)*310),n:Math.sin(f*4)*5,tvd:Math.max(0,(f-.18)*210)};});
  const joints=Array.from({length:7},(_,i)=>({number:82+i,start:base+(i-3)*9.6,end:base+(i-2)*9.6}));
  const doglegs=Array.from({length:12},(_,i)=>({start:base+i*2.5,end:base+(i+1)*2.5,dls:1.2+Math.abs(Math.sin(i*.7))*1.3}));
  return {source:'DEMO · SYNTHETIC DATA',label:'LANDING SECTION · WELL RW-07',hd,bd:hd-.08,path,plan:[],intervals:[{from:base,to:base+2.6,mode:'slide'},{from:base+2.6,to:hd,mode:'rotary'}],joint:joints[3],joints,rows,image,lastSurvey:hd-1.1,surveyIntervals:[],connections:[],doglegs,surveyDatum:'DEMO DATUM',gammaMd:hd-1.5,imageName:'SYNTHETIC IMAGE LOG',key:'demo-rw07'};
}

function render() {
  if (!root) return;
  const api = window.GX?.witsml;
  const live = feedModel(api,feedSource(api?.WML,Date.now(),api?.CFG,observation));
  const log=api?.WML?.log, historyKey=log ? [api?.CFG?.url,log.w,log.b,log.uid].join('|') : '';
  const historyData=displayMode==='historical'&&historicalCache?.key===historyKey?historicalCache.data:null;
  let m = displayMode === 'demo' ? demoModel() : displayMode === 'historical' ? feedModel(api,'WITSML HISTORICAL',historyData) : live;
  if (displayMode==='historical'&&historyData&&selectedJointStart!=null) {
    const chosen=m.joints.find(j=>j.start===selectedJointStart); if(chosen)m={...m,joint:chosen};
  }
  const {source} = m;
  set('opsWell',(displayMode === 'demo' ? 'TRAINING SIMULATION  •  ' : displayMode==='historical'?'HISTORICAL WELL ANALYSIS  •  ':'DRILLING OPERATIONS  •  ') + (m.label || ''));
  const logReady=Boolean(log&&/time/i.test(log.indexType||'')&&!api?.WML?.simulated&&!fixtureFeed(api?.WML,api?.CFG));
  set('opsSource',displayMode==='historical'?(historyData?'WITSML HISTORY · '+(historicalCache.complete?'FULL LOG':'PARTIAL LOG'):logReady?'HISTORY READY · LOAD FULL LOG':'SELECT A WITSML TIME LOG'):source);
  $('opsSource').dataset.live = displayMode === 'live' && source === 'WITSML LIVE';
  $('opsSource').dataset.demo = displayMode === 'demo';
  $('opsSource').dataset.history = displayMode === 'historical';
  $('opsLiveMode').setAttribute('aria-pressed',String(displayMode === 'live'));
  $('opsHistoryMode').setAttribute('aria-pressed',String(displayMode === 'historical'));
  $('opsDemoMode').setAttribute('aria-pressed',String(displayMode === 'demo'));
  $('opsConnect').hidden = displayMode === 'demo';
  $('opsConnect').disabled = false;
  $('opsHistoryLoad').hidden=displayMode!=='historical'||Boolean(historyData);
  $('opsHistoryLoad').disabled=!logReady||historyLoading;
  $('opsHistoryLoad').textContent=historyLoading?'Loading full history…':'Load full log history';
  $('opsWholeWell').hidden=displayMode!=='historical'||!logReady||wholeWellCache?.selectedKey===historyKey;
  $('opsWholeWell').disabled=!logReady||historyLoading;
  $('opsWholeWell').textContent=historyLoading?'Building context…':'Build whole-well context';
  $('opsExecTitle').textContent = displayMode === 'demo' ? 'Training controls · inactive' : displayMode==='historical'?'Historical analysis · read-only':'Live operations';
  renderTally(m); radar(m); renderSignals(m); renderScene(m); renderPlots(m);
  set('opsExecution',displayMode === 'demo' ? 'Synthetic training data · no rig commands' : displayMode==='historical'?historyData?'Historical WITSML record · '+historyData.rows.length.toLocaleString('en-AU')+' rows · read-only':logReady?'Historical mode reads the selected WITSML time log from its start to end.':'Connect WITSML and select the historical well and a time log.':source === 'WITSML LIVE' ? 'Following the selected time log · read-only' :
    'Live values unavailable. Connect WITSML and select the active well and time log.');
  const latest = m.rows.at(-1);
  const sourceTime = $('opsSourceTime');
  const iso = !finite(latest?.t) ? '' : new Date(latest.t * 1000).toISOString();
  sourceTime.textContent = iso ? 'SOURCE ' + iso.slice(0,16).replace('T',' ') + ' UTC' : 'SOURCE TIME UNAVAILABLE';
  if (iso) sourceTime.dateTime = iso;
  else sourceTime.removeAttribute('datetime');
  set('opsSurvey','LAST SURVEY MD  ' + fmt(m.lastSurvey) + ' m MD  •  TOOLFACE  ' +
    (finite(latest?.tf) ? fmt(latest.tf,0) + '°' : '—'));
  set('opsFooter',displayMode === 'demo' ? 'DEMO · SYNTHETIC TRAINING DATA · NOT A LIVE RIG' : displayMode==='historical'?historyData?'HISTORICAL WITSML · '+(historicalCache.complete?'FULL LOG RANGE LOADED':'PARTIAL LOG RANGE · SEE READ LIMIT')+' · READ-ONLY':'HISTORICAL VIEW · NO LIVE STATUS CLAIMED':latest ? (source==='WITSML LIVE'?'LIVE WITSML':'WITSML')+' · READ-ONLY · SOURCE ROW ' + new Date(latest.t*1000).toISOString().replace('T',' ').slice(0,19) + ' UTC' :
      'LIVE MODE · WITSML DATA UNAVAILABLE');
  renderHistoricalSummary(m,historyData,log);
}

function renderHistoricalSummary(model,historyData,log) {
  const panel=$('opsSummaryPanel'),generate=$('opsSummaryGenerate'), status=$('opsSummaryStatus'), metrics=$('opsSummaryMetrics'), facts=$('opsSummaryFacts'), branches=$('opsSummaryBranches'), limit=$('opsSummaryLimit');
  panel.hidden=displayMode!=='historical';if(panel.hidden)return;
  const api=window.GX?.witsml,selectedKey=log?[api?.CFG?.url,log.w,log.b,log.uid].join('|'):'';
  const ready=displayMode==='historical'&&Boolean(historyData);
  generate.hidden=!ready;generate.disabled=!ready||historyLoading;
  if(!ready&&!historicalSummary){status.textContent=displayMode==='historical'?'Load the selected historic WITSML time log, then build the whole-well context across all branches.':'Switch to HISTORY, select an old well and load its full time log.';metrics.hidden=true;facts.hidden=true;branches.hidden=true;limit.hidden=true;return}
  if(!historicalSummary)return;
  status.textContent=historicalSummary.title;
  metrics.replaceChildren(...historicalSummary.metrics.map(({label,value})=>{const card=document.createElement('div');card.className='ops-summary-metric';const name=document.createElement('b'),val=document.createElement('span');name.textContent=label;val.textContent=value;card.append(name,val);return card}));metrics.hidden=false;
  facts.replaceChildren(...historicalSummary.facts.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));facts.hidden=false;
  const context=wholeWellCache?.selectedKey===selectedKey?wholeWellCache:null;
  if(context){
    const title=document.createElement('h3');title.textContent='Branch coverage';
    const note=document.createElement('p');note.textContent=context.summary+(context.complete?' · all discovered log pages read; object inventory is header-level':' · partial, failed, or unhandled object types are listed')+(context.objectInventory?.unhandledTypes?.length?' · not implemented: '+context.objectInventory.unhandledTypes.join(', '):'');
    const rows=(historicalSummary.branches||[]).map(branch=>{const p=document.createElement('p'),survey=branch.trajectories?.length?branch.trajectories.map(t=>`${t.name} [${t.uid}]: ${t.count} stations, ${fmt(t.mdStart)}–${fmt(t.mdEnd)} m MD, max DLS ${fmt(t.dlsMax,2)}°/30 m, 80° crossing ${fmt(t.cut)} m`).join(' · '):'no trajectory objects';p.textContent=`${branch.name} (${branch.uid}) · ${branch.logs} logs: ${branch.complete} complete, ${branch.partial} partial, ${branch.failed} failed · ${branch.rows?.toLocaleString('en-AU')||0} rows · trajectories: ${survey}`;return p});
    const types=document.createElement('p');const typeCounts=Object.entries(context.objectCoverage||{}).map(([name,item])=>`${name}: ${item.objects} objects / ${item.branches} branch rows`).join(' · ');types.textContent='Object inventory · '+(typeCounts||'no non-empty object types')+(context.objectInventory?.capNote?' · '+context.objectInventory.capNote:'');
    const stopped=context.objectInventory?.stopped?document.createElement('p'):null;if(stopped)stopped.textContent='Inventory stopped · '+context.objectInventory.stopped;
    branches.replaceChildren(title,note,...rows,types,...(stopped?[stopped]:[]));branches.hidden=false;
  }else branches.hidden=true;
  limit.textContent=historicalSummary.limits.join(' · ');limit.hidden=!historicalSummary.limits.length;
}

async function buildWholeWellContext(){
  const api=window.GX?.witsml,log=api?.WML?.log,wellData=api?.wellData?.(),cfg=api?.CFG;
  if(historyLoading||!api?.callRetry||!log||!wellData?.sets?.length||api.WML?.simulated||fixtureFeed(api.WML,cfg))return;
  const key=[cfg?.url,log.w,log.b,log.uid].join('|');historyLoading=true;wholeWellCache=null;historicalSummary=null;
  api.setHistoryBusy?.(true);set('opsExecution','Building whole-well context · reading every time and depth log on every discovered wellbore…');render();
  try{
    if(!api.runInventory)throw new Error('The all-object WITSML inventory is unavailable. The whole-well read was not started.');
    set('opsExecution','Building whole-well context · inventorying each branch and supported object family…');
    const inventory=await api.runInventory(wellData.well,true,p=>set('opsExecution',`Well inventory · ${p.wellbore} · ${p.type} · ${p.completed}/${p.total} object groups · ${p.state}`));
    if(/proxy safety refusal|auth failure/i.test(inventory.stopped||''))throw Object.assign(new Error(inventory.stopped),{guardRefusal:/proxy safety refusal/i.test(inventory.stopped)});
    const context=await readWholeWellHistory({api,wellData:{...wellData,sets:wellData.sets.map(s=>({...s,w:wellData.well}))},onProgress:p=>set('opsExecution',`Whole-well read · ${p.wellbore} · ${p.log} · ${p.rows.toLocaleString('en-AU')} rows · ${p.pages} pages`)});
    context.objectInventory=inventory;
    context.objectCoverage=inventory.rows.reduce((all,row)=>{const x=all[row.type]||{type:row.type,objects:0,branches:0,states:{}};x.objects+=row.n||0;x.branches++;x.states[row.state]=(x.states[row.state]||0)+1;all[row.type]=x;return all},{});
    context.inventoryComplete=!inventory.stopped&&!inventory.unhandledTypes?.length&&inventory.rows.every(row=>['ok','none','not supported by server','not supported by server (GetCap)'].includes(row.state));
    context.complete=context.complete&&context.inventoryComplete;
    if([cfg?.url,api.WML?.log?.w,api.WML?.log?.b,api.WML?.log?.uid].join('|')!==key)throw new Error('The WITSML well, branch, log, or store changed during the read. Context was discarded.');
    context.selectedKey=key;wholeWellCache=context;
    const selected=context.logs.find(x=>x.wellbore===log.b&&x.uid===log.uid&&x.data?.rows?.length);
    if(selected){
      const data={src:'historical',ml:selected.data.ml,ul:selected.data.ul,ix:0,rows:selected.data.rows.map(row=>({t:row[0],x:row}))};
      historicalCache={key,data,complete:selected.state==='complete',rows:selected.rows};
    }
    set('opsExecution',context.summary+(context.complete?' · all log pages read; object inventory is header-level':' · inspect partial/failed coverage before using facts'));
  }catch(error){set('opsExecution','Whole-well read stopped: '+String(error?.message||error).slice(0,180))}
  finally{historyLoading=false;api.setHistoryBusy?.(false);render()}
}

async function loadFullHistory() {
  const api=window.GX?.witsml, w=api?.WML, log=w?.log, cfg=api?.CFG;
  if(historyLoading||!api?.callRetry||!log||!log.w||!log.b||!log.uid||!/time/i.test(log.indexType||'')||
      w?.simulated||fixtureFeed(w,cfg))return;
  const key=[cfg?.url,log.w,log.b,log.uid].join('|');
  const start=Date.parse(log.start),end=Date.parse(log.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start){
    set('opsExecution','This time log has no valid start and end times. Select another WITSML time log.');return;
  }
  historyLoading=true;historicalCache=null;set('opsExecution','Reading historical WITSML rows…');render();
  const store={ml:null,ul:null,rows:[]};
  let from=start,pages=0,truncated=false;
  try {
    while(pages<200&&store.rows.length<1000000) {
      if(w.log!==log||[cfg?.url,log.w,log.b,log.uid].join('|')!==key)throw new Error('The selected WITSML well or time log changed. Select HISTORY again.');
      const q='<logs '+api.NS+'><log uidWell="'+api.xa(log.w)+'" uidWellbore="'+api.xa(log.b)+'" uid="'+api.xa(log.uid)+'"><startDateTimeIndex>'+new Date(from).toISOString()+'</startDateTimeIndex><endDateTimeIndex>'+new Date(end).toISOString()+'</endDateTimeIndex><logData><mnemonicList/><unitList/><data/></logData></log></logs>';
      const reply=await api.callRetry('WMLS_GetFromStore','log',q,'returnElements=data-only;maxReturnNodes=5000');
      const parsed=parseLogs(api.normXml(reply?.xml||''))[0];
      if(!parsed?.rows?.length)break;
      const ix=parsed.ml.indexOf(log.indexCurve||parsed.ml[0]);
      if(ix!==0)throw new Error('The WITSML time index is not the first log column. History was stopped to avoid incorrect ordering.');
      parsed.rows.sort((a,b)=>a[0]-b[0]);
      const before=store.rows.length;appendRows(store,parsed.ml,parsed.rows,parsed.ul);pages++;
      const last=store.rows.at(-1)?.[0];
      if(!Number.isFinite(last)||last>=end-1000)break;
      if(store.rows.length===before){truncated=true;break;}
      from=last+1;
      set('opsExecution','Reading full time log · '+store.rows.length.toLocaleString('en-AU')+' rows');
      if(pages>=200||store.rows.length>=1000000)truncated=true;
    }
    if(!store.rows.length)throw new Error('No historical rows were returned for this time log.');
    if(pages>=200||store.rows.length>=1000000)truncated=true;
    if(w.log!==log)throw new Error('The selected WITSML time log changed before the read completed.');
    const data={src:'historical',ml:store.ml,ul:store.ul,ix:0,rows:store.rows.map(row=>({t:row[0],x:row}))};
    historicalCache={key,data,complete:!truncated,rows:store.rows.length};
    set('opsExecution',truncated?'History reached the safe read limit. This is a partial record; narrow the selected log range.':'Full selected WITSML time log loaded · read-only');
  } catch(e) {
    set('opsExecution','Historical read failed: '+String(e?.message||e).slice(0,180));
  } finally {historyLoading=false;render();}
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
  const panelOpen = panel?.parentElement === dock && panel.style.display !== 'none';
  const viewerOpen = window.GX?.witsml?.source==='wdash'&&window.GX?.witsml?.isOpen?.();
  dock.hidden = !panelOpen;
  $('opsConnect').setAttribute('aria-expanded', String(panelOpen||viewerOpen));
  if (!open && dock.dataset.wasOpen === 'true' && document.activeElement === document.body) {
    $('opsConnect').focus({preventScroll:true});
  }
  dock.dataset.wasOpen = String(panelOpen||viewerOpen);
}
function dockWitsml(open) {
  const dock = $('opsWitsmlDock'), api = window.GX?.witsml;
  if (!api?.open) {import('./wdash.js?v=well-summary-r1').then(module=>{module.open();syncDock()}).catch(error=>set('opsExecution','Could not open the WITSML viewer: '+String(error?.message||error)));return;}
  if(api.source==='wdash'){if(open)api.open();else api.close();syncDock();return;}
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
  link.id = 'opsCSS'; link.rel = 'stylesheet'; link.href = new URL('./operations.css?v=whole-history-r1',import.meta.url);
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
  const dock = $('opsWitsmlDock');
  window.addEventListener('witsml:panel',syncDock);
  $('opsConnect').onclick = () => dockWitsml(window.GX?.witsml?.source==='wdash'?!window.GX.witsml.isOpen():dock.hidden);
  $('opsLiveMode').onclick = () => { displayMode='live'; lastSceneKey=''; render(); };
  $('opsHistoryMode').onclick = () => { displayMode='historical'; selectedJointStart=null; lastSceneKey=''; render(); };
  $('opsDemoMode').onclick = () => { displayMode='demo'; lastSceneKey=''; render(); };
  $('opsHistoryLoad').onclick = loadFullHistory;
  $('opsWholeWell').onclick = buildWholeWellContext;
  $('opsSummaryGenerate').onclick = () => {
    const api=window.GX?.witsml, log=api?.WML?.log;
    if(!historicalCache?.data||!log)return;
    const model=feedModel(api,'WITSML HISTORICAL',historicalCache.data);
    const context=wholeWellCache?.selectedKey===[api?.CFG?.url,log.w,log.b,log.uid].join('|')?wholeWellCache:null;
    historicalSummary=buildHistoricalSummary({model,log,wellData:api?.wellData?.(),complete:historicalCache.complete,inventory:api?.wellData?.()?.inventory,context});render();
  };
  $('opsJointFind').oninput = () => render();
  window.addEventListener('witsml:loaded',onWitsmlLoaded);
  if (window.GX?.witsml?.isOpen?.()) dockWitsml(true);
  root.addEventListener('click',e => {
    const button = e.target.closest('button');
    if(button?.dataset.jointStart){selectedJointStart=Number(button.dataset.jointStart);render();return;}
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
  window.removeEventListener('witsml:loaded',onWitsmlLoaded);
  if ($('opsWitsmlDock').contains($('witsml'))) window.GX?.witsml?.close?.();
  scene?.dispose();
  scene = null; lastSceneKey = '';
  feed = {}; loadedImage = null; imageError = ''; displayMode = 'live';historicalSummary=null;historicalCache=null;wholeWellCache=null;
  feedSource(null,Date.now(),null,observation);
  root.remove(); root = null;
  origin?.focus?.({preventScroll:true});
}
