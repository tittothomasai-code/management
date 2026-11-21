import {drawRiskBands} from './opsnow_watch_3d.mjs?v=watch1';
// opsnow_views.js: the operator screen's pop-up views: Live log (depth tracks + gamma image), 3D wells,
// Anti-collision radar and Tally check. Pure canvas, no libraries, nothing leaves the browser.
import * as C from './opsnow_core.js?v=re1115';
import * as GV from './opsnow_geoview.js?v=re1115';
import * as AV from './opsnow_acview.js?v=re1115';
import * as JV from './opsnow_jointsview.js?v=re1115';
import * as TV from './opsnow_tallyview.js?v=re1115';
import * as SV from './opsnow_slideview.js?v=re1115';
import * as EV from './opsnow_eowrview.js?v=re1115';
import * as SU from './opsnow_surveyui.js?v=re1115';
export const forward = () => AV.forward();
// joints.html: the Joints dashboard as its own page. Surfaces for the window check come from the Geosteer store on this device.
const $ = id => document.getElementById(id);
let jtTab = 'joints';
export function initJointsPage(getCtx, host) {
  X = getCtx; GV.bind(getCtx);
  host.innerHTML = `<nav class="jt-tabs" role="tablist" id="jtTabs">
      <button type="button" data-jt="joints" role="tab" aria-selected="true">Joints</button>
      <button type="button" data-jt="tally" role="tab">Tally</button>
      <button type="button" data-jt="slide" role="tab">Run sheet</button>
      <button type="button" data-jt="eowr" role="tab">EOWR</button>
    </nav>
    <div id="jtTabJoints"></div><div id="jtTabTally" hidden></div><div id="jtTabSlide" hidden></div><div id="jtTabEowr" hidden></div>`;
  const opts = {windowFn: GV.windowFn, windowKey: GV.windowKey, xlsxRows};
  JV.init(getCtx, {...opts, host: $('jtTabJoints')});
  TV.init(getCtx, {...opts, host: $('jtTabTally')});
  SV.init(getCtx, {...opts, host: $('jtTabSlide')});
  EV.init(getCtx, {...opts, host: $('jtTabEowr')});
  AV.initPop(getCtx, opts);
  host.querySelectorAll('#jtTabs button').forEach(b => b.onclick = () => {
    jtTab = b.dataset.jt; try { history.replaceState(null, '', '#' + jtTab); } catch {}
    host.querySelectorAll('#jtTabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $('jtTabJoints').hidden = jtTab !== 'joints';
    $('jtTabTally').hidden = jtTab !== 'tally';
    $('jtTabSlide').hidden = jtTab !== 'slide';
    $('jtTabEowr').hidden = jtTab !== 'eowr';
    getCtx().onOpen?.(jtTab === 'slide' || jtTab === 'tally' ? 'joints' : 'joints');
    drawJoints();
  });
  // deep link: joints.html#tally | #slide | #eowr
  const h = (location.hash || '').slice(1); const b0 = h && host.querySelector('#jtTabs button[data-jt="' + h + '"]'); if (b0) b0.click();
}
export const togglePop = on => AV.togglePop(on);
export const drawJoints = () => { try { if (jtTab === 'tally') TV.draw(); else if (jtTab === 'slide') SV.draw(); else if (jtTab === 'eowr') EV.draw(); else JV.draw(); } catch (e) { const n = document.getElementById('vwNote'); if (n) n.textContent = 'View error: ' + e.message; } };
export const getPlan = () => GV.getPlan?.();
export const setPlan = (p, name) => GV.setPlan?.(p, name);
export const getKb = () => GV.getKb?.();
export const importSurvey = (f, ctx) => SU.importFile(f, ctx, xlsxRows);
export const downloadSurvey = ctx => SU.downloadLive(ctx);
const fmt = (v, d = 1) => Number.isFinite(v) ? (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toLocaleString('en-AU', {minimumFractionDigits: d, maximumFractionDigits: d}) : '—';
let X = () => ({}); // context getter set by opsnow.js
const CAM0 = {yaw: 1.2, pitch: 0.42, dist: 1, pan: [0, 0]};
const V = {open: '', follow: true, top: null, span: null, hoverMd: null, tracksOn: null, cam: {...CAM0, vx: 3}, hidden: new Set(), blink: false};
export const TRACKS = [
  {id: 'drill', name: 'ROP · WOB', curves: [['ROPA', '#5cc8ff', [0, 150]], ['WOB', '#ffb547']]},
  {id: 'hook', name: 'Hookload · Block', curves: [['HOOKLOAD', '#f6e05e'], ['BHE', '#a0aec0', [0, 30]]]},
  {id: 'rot', name: 'Torque · RPM', curves: [['TORQUE', '#d59cff'], ['RPMA', '#7ee08a', [0, 120]]]},
  {id: 'hyd', name: 'SPP · Flow · ΔP', curves: [['SPP', '#ff7b7b'], ['Flow', '#4fd1c5'], ['DIFFP', '#ff9f43']]},
  {id: 'gas', name: 'Gas %', curves: [['PasonGas', '#ffffff'], ['C1 - Methane', '#7ee08a'], ['C2 - Ethane', '#5cc8ff'], ['C3 - Propane', '#ffb547'], ['C4 - Iso-Butane', '#ff7b7b']]},
  {id: 'gr', name: 'Gamma', curves: [['GMAVG', '#7ee08a', null, 'fe']]},
  {id: 'img', name: 'Gamma image', image: true},
];
const SHORT = {'C1 - Methane': 'C1', 'C2 - Ethane': 'C2', 'C3 - Propane': 'C3', 'C4 - Iso-Butane': 'C4', HOOKLOAD: 'HKL', PasonGas: 'Gas'};
export function init(getCtx) {
  X = getCtx;
  const el = document.createElement('section'); el.id = 'vwPanel'; el.className = 'vw-panel'; el.hidden = true;
  el.innerHTML = `<div class="vw-head"><nav class="vw-tabs" role="tablist">
      <button data-v="log" role="tab">Live log</button><button data-v="3d" role="tab">3D wells</button><button data-v="ac" role="tab">Anti-collision</button><button data-v="tally" role="tab">Tally</button><button data-v="geo" role="tab">Geosteer</button></nav>
      <span id="vwNote" class="on-muted"></span><button id="vwClose" type="button" aria-label="Close">✕</button></div>
    <div id="vw_log" class="vw-body" hidden>
      <div class="vw-tools"><span id="vwChips" class="vw-chips"></span><span class="vw-sp"></span>
        <button id="vwZoomIn" type="button" aria-label="Zoom in">＋</button><button id="vwZoomOut" type="button" aria-label="Zoom out">－</button><button id="vwFollow" type="button" aria-pressed="true">Follow bit</button></div>
      <div id="vwHdr" class="vw-hdr"></div><div class="vw-cw"><canvas id="vwLog"></canvas></div><p id="vwRead" class="vw-read on-muted"></p></div>
    <div id="vw_3d" class="vw-body" hidden>
      <div class="vw-tools"><span id="vw3Chips" class="vw-chips"></span><span class="vw-sp"></span>
        <button id="vw3Vx" type="button" title="Vertical exaggeration">Vertical ×3</button><button id="vw3Reset" type="button">Reset view</button></div>
      <div class="vw-cw"><canvas id="vw3d"></canvas></div><p id="vw3Note" class="on-muted vw-read"></p></div>
    <div id="vw_tally" class="vw-body" hidden>
      <div id="vwTallyBoard"></div>
      <details class="vw-override" id="vwOverride"><summary>Load real tally to override · reconciles at 0.3 m per joint, 1 m cumulative</summary>
        <label id="vwDrop" class="vw-drop"><input id="vwFile" type="file" accept=".csv,.txt,.tsv,.xlsx" hidden><b>Drop a real pipe tally here</b><span class="on-muted">CSV or Excel (.xlsx). Read in this browser only; nothing is uploaded. Its lengths replace the auto-generated ones and are checked against the connections in the depth log.</span></label>
        <div id="vwTallyOut"></div></details></div>`;
  document.getElementById('onRoot').appendChild(el);
  AV.initPop(getCtx, {windowFn: GV.windowFn, windowKey: GV.windowKey});
  TV.init(getCtx, {host: $('vwTallyBoard'), windowFn: GV.windowFn, windowKey: GV.windowKey, xlsxRows}); // ops.html Tally: auto-generated board (same as joints.html Tally)
  AV.init(getCtx, {windowFn: GV.windowFn, windowKey: GV.windowKey, blink: () => V.blink, onChange: () => { if (V.open === 'geo') GV.draw(); getCtx().refresh?.(); }});
  GV.init(getCtx, {gammaColor, forward: () => AV.forward(), fanOn: () => AV.fanOn(), riskColor: AV.riskColor, xlsxRows, importSurvey: f => SU.importFile(f, getCtx(), xlsxRows), downloadSurvey: () => SU.downloadLive(getCtx())});
  el.querySelectorAll('.vw-tabs button').forEach(b => b.onclick = () => open(b.dataset.v));
  $('vwClose').onclick = () => { el.hidden = true; V.open = ''; document.body.classList.remove('vw-on'); };
  $('vwZoomIn').onclick = () => { V.span = Math.max(15, (V.span || 100) / 1.5); draw(); };
  $('vwZoomOut').onclick = () => { V.span = Math.min(1200, (V.span || 100) * 1.5); draw(); };
  $('vwFollow').onclick = () => { V.follow = !V.follow; $('vwFollow').setAttribute('aria-pressed', String(V.follow)); draw(); };
  $('vw3Vx').onclick = () => { V.cam.vx = V.cam.vx === 1 ? 3 : V.cam.vx === 3 ? 10 : 1; $('vw3Vx').textContent = 'Vertical ×' + V.cam.vx; draw(); };
  $('vw3Reset').onclick = () => { V.cam = {...CAM0, pan: [0, 0], vx: V.cam.vx}; draw(); };
  logInput($('vwLog')); orbitInput($('vw3d'));
  const drop = $('vwDrop');
  drop.ondragover = e => { e.preventDefault(); drop.dataset.over = '1'; }; drop.ondragleave = () => { drop.dataset.over = ''; };
  drop.ondrop = e => { e.preventDefault(); drop.dataset.over = ''; const f = e.dataTransfer.files?.[0]; if (f) readTally(f); };
  $('vwFile').onchange = e => { const f = e.target.files?.[0]; if (f) readTally(f); };
  addEventListener('resize', () => draw());
  setInterval(() => { V.blink = !V.blink; if (V.open === 'ac' || V.open === '3d') draw(); }, 600);
}
export function open(v) {
  const el = $('vwPanel'); el.hidden = false; V.open = v; document.body.classList.add('vw-on');
  el.querySelectorAll('.vw-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === v)));
  for (const k of ['log', '3d', 'ac', 'tally', 'geo']) $('vw_' + k).hidden = k !== v;
  X().onOpen?.(v); draw();
}
export const isOpen = () => V.open;
export function draw() { if (!V.open) return; try { ({log: drawLog, '3d': draw3d, ac: AV.draw, tally: drawTally, geo: GV.draw})[V.open](); } catch (e) { $('vwNote').textContent = 'View error: ' + e.message; } }
function canvasFit(cv, h) {
  const dpr = devicePixelRatio || 1, w = cv.parentElement.clientWidth || 600; h = h || cv.parentElement.clientHeight || 400;
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); return {g, w, h};
}

// ---------- Live log ----------
function colIndex(d, mn) { return d?.ml ? d.ml.indexOf(mn) : -1; }
const scaleCache = new Map();
function curveScale(key, d, col, fixed) {
  if (fixed) return fixed; const c = scaleCache.get(key);
  if (c && c.n > d.rows.length * 0.8) return c.r;
  const vals = []; for (const r of d.rows) { const v = C.num(r[col]); if (v != null && v !== -999.25) vals.push(v); }
  const r = C.robustRange(vals) || [0, 1]; const pad = (r[1] - r[0]) * 0.05; const out = [r[0] - pad, r[1] + pad];
  scaleCache.set(key, {n: d.rows.length, r: out}); return out;
}
function activeTracks(w) {
  if (V.tracksOn) return TRACKS.filter(t => V.tracksOn.has(t.id));
  const ids = w < 700 ? ['drill', 'hook', 'gr', 'img'] : TRACKS.map(t => t.id); V.tracksOn = new Set(ids); return TRACKS.filter(t => V.tracksOn.has(t.id));
}
function logWindow(h) {
  const x = X(), rows = x.data?.rows || []; const lo0 = rows[0]?.[0] ?? 0, bitMd = x.bitMd ?? rows.at(-1)?.[0] ?? 0;
  if (!V.span) V.span = h < 600 ? 60 : 100;
  if (V.follow || V.top == null) V.top = bitMd - V.span * 0.85;
  V.top = Math.max(lo0 - V.span * 0.1, Math.min(V.top, bitMd + V.span * 0.1 - V.span * 0.3 + V.span * 0.2));
  return [V.top, V.top + V.span];
}
function drawLog() {
  const x = X(), d = x.data, cv = $('vwLog'); const box = cv.parentElement; const H = Math.max(260, innerHeight - box.getBoundingClientRect().top - 40);
  box.style.height = H + 'px'; const {g, w, h} = canvasFit(cv, H);
  const tracks = activeTracks(w);
  $('vwChips').innerHTML = TRACKS.map(t => `<button type="button" data-t="${t.id}" aria-pressed="${V.tracksOn.has(t.id)}">${t.name}</button>`).join('');
  $('vwChips').querySelectorAll('button').forEach(b => b.onclick = () => { const s = V.tracksOn; s.has(b.dataset.t) ? s.delete(b.dataset.t) : s.add(b.dataset.t); if (!s.size) s.add('drill'); drawLog(); });
  if (!d?.rows?.length) { g.fillStyle = '#8aa0b2'; g.font = '13px system-ui'; g.fillText('Reading the depth log…', 16, 30); return; }
  const DW = w < 600 ? 54 : 70, tw = (w - DW) / tracks.length; const [top, bot] = logWindow(h);
  const Y = md => (md - top) / (bot - top) * h;
  // depth column
  g.fillStyle = '#0d151c'; g.fillRect(0, 0, DW, h); g.font = '11px system-ui'; g.textAlign = 'right';
  const step = V.span > 400 ? 50 : V.span > 150 ? 20 : V.span > 50 ? 10 : 5;
  for (const t of C.niceTicks(top, bot, step)) { const y = Y(t); g.strokeStyle = '#18242f'; g.beginPath(); g.moveTo(DW, y); g.lineTo(w, y); g.stroke(); g.fillStyle = '#8aa0b2'; g.fillText(fmt(t, 0), DW - 6, y + 4); }
  // connections with joint numbers
  const jn = x.jointNo, conns = x.conns || [];
  conns.forEach((c, i) => { if (c.md < top || c.md > bot) return; const y = Y(c.md); g.strokeStyle = '#3a5166'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(DW, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]);
    const n = jn?.n != null ? jn.n - (conns.length - 1 - i) : null; g.fillStyle = '#5f7c95'; g.textAlign = 'left'; g.font = '10px system-ui'; g.fillText(n != null ? 'J' + n : 'conn', 3, y - 2); });
  // surveys
  for (const s of x.surveys || []) { if (s.md < top || s.md > bot) continue; const y = Y(s.md); g.fillStyle = '#ffb547'; g.beginPath(); g.moveTo(DW, y); g.lineTo(DW - 7, y - 4); g.lineTo(DW - 7, y + 4); g.fill();
    if (V.span <= 150) { g.font = '9px system-ui'; g.textAlign = 'left'; g.fillText(fmt(s.inc, 1) + '°', 3, y + 11); } }
  // tracks
  const hdr = [];
  tracks.forEach((t, ti) => {
    const x0 = DW + ti * tw; g.strokeStyle = '#1f2d3a'; g.strokeRect(x0 + 0.5, 0, tw, h);
    if (t.image) { drawImage(g, x.image, x0, tw, top, bot, Y, h); hdr.push(`<div style="width:${tw}px"><b>Gamma image</b><span>${V.imgRange ? 'dark ' + fmt(V.imgRange[0], 0) + ' → bright ' + fmt(V.imgRange[1], 0) + ' api (scaled to view)' : 'no data'}</span></div>`); return; }
    const lines = [];
    for (const [mn, col, fixed, src] of t.curves) {
      const dd = src === 'fe' ? x.fe : d; const ci = colIndex(dd, mn); if (ci < 1) continue;
      const [lo, hi] = curveScale((src || 'd') + mn, dd, ci, fixed); const [i0, i1] = C.sliceByIndex(dd.rows, top, bot);
      g.save(); g.beginPath(); g.rect(x0, 0, tw, h); g.clip();
      if (lo < 0 && hi > 0) { const zx = x0 + (0 - lo) / (hi - lo) * tw; g.strokeStyle = '#2f3e4c'; g.beginPath(); g.moveTo(zx, 0); g.lineTo(zx, h); g.stroke(); }
      g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath(); let pen = false; const stride = Math.max(1, Math.floor((i1 - i0) / (h * 1.5)));
      let lastMd = -1e9; for (let i = i0; i < i1; i += stride) { const v = C.num(dd.rows[i][ci]); if (v == null || v === -999.25) continue; const md = dd.rows[i][0]; if (md - lastMd > 2) pen = false; const px = x0 + (v - lo) / (hi - lo) * tw, py = Y(md); pen ? g.lineTo(px, py) : g.moveTo(px, py); pen = true; lastMd = md; } // gaps under 2 m are bridged (blank rows interleave)
      g.stroke(); g.restore();
      const u = dd.ul?.[ci] || ''; lines.push(`<i style="color:${col}"><em>${fmt(lo, lo > -10 && hi < 10 ? 1 : 0)}</em>${SHORT[mn] || mn} ${u}<em>${fmt(hi, lo > -10 && hi < 10 ? 1 : 0)}</em></i>`);
    }
    hdr.push(`<div style="width:${tw}px">${lines.join('') || '<span>not in source</span>'}</div>`);
  });
  $('vwHdr').style.paddingLeft = DW + 'px'; $('vwHdr').innerHTML = hdr.join('');
  // bit / hole depth line
  const bm = x.bitMd ?? d.rows.at(-1)[0]; if (bm >= top && bm <= bot) { const y = Y(bm); g.strokeStyle = '#ff5d5d'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.lineWidth = 1; g.fillStyle = '#ff8a8a'; g.textAlign = 'right'; g.font = 'bold 11px system-ui'; g.fillText(fmt(bm, 1), DW - 6, y - 4); }
  // hover cursor
  if (V.hoverMd != null && V.hoverMd >= top && V.hoverMd <= bot) { const y = Y(V.hoverMd); g.strokeStyle = '#cfe3f5'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(DW, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]); }
  g.textAlign = 'left';
  $('vwRead').textContent = readout(V.hoverMd ?? bm);
  $('vwNote').textContent = 'Whole log ' + fmt(d.rows[0][0], 1) + '–' + fmt(d.rows.at(-1)[0], 1) + ' m MD · ' + d.rows.length.toLocaleString('en-AU') + ' rows' + (x.backfilling ? ' · reading the rest…' : '') + ' · ▶ survey · dashed = connection';
}
function readout(md) {
  const x = X(), d = x.data; if (!d?.rows?.length || md == null) return '';
  const [i0, i1] = C.sliceByIndex(d.rows, md - 0.05, md + 0.05); const r = d.rows[Math.min(i1 - 1, Math.max(i0, i0 + 1))] || d.rows.at(-1);
  const pick = ['ROPA', 'WOB', 'HOOKLOAD', 'BHE', 'TORQUE', 'RPMA', 'SPP', 'Flow', 'DIFFP', 'PasonGas'];
  const im = x.image?.length ? x.image.reduce((a, b) => Math.abs(b.md - md) < Math.abs(a.md - md) ? b : a) : null;
  return fmt(r[0], 1) + ' m MD · ' + pick.map(m => { const i = d.ml.indexOf(m); return i > 0 && C.num(r[i]) != null ? (SHORT[m] || m) + ' ' + fmt(C.num(r[i]), 1) : null; }).filter(Boolean).join(' · ') +
    (im && Math.abs(im.md - md) < 2 ? ' · GR image T/R/B/L ' + im.s.map(v => fmt(v, 0)).join('/') : '');
}
const CMAP = [[0, [20, 12, 4]], [0.25, [90, 45, 10]], [0.5, [190, 120, 30]], [0.75, [245, 200, 90]], [1, [255, 250, 225]]];
export function gammaColor(t) { t = Math.max(0, Math.min(1, t)); for (let i = 1; i < CMAP.length; i++) if (t <= CMAP[i][0]) { const [a, ca] = CMAP[i - 1], [b, cb] = CMAP[i], f = (t - a) / (b - a); return ca.map((c, k) => Math.round(c + (cb[k] - c) * f)); } return CMAP.at(-1)[1]; }
function drawImage(g, img, x0, tw, top, bot, Y, h) {
  if (!img?.length) { g.fillStyle = '#6b7d8c'; g.font = '11px system-ui'; g.fillText('no image data', x0 + 6, 20); return; }
  const vis = img.filter(a => a.md >= top && a.md <= bot).flatMap(a => a.s); const r = C.robustRange(vis.length > 8 ? vis : img.flatMap(a => a.s)) || [0, 100]; V.imgRange = r; const N = Math.max(8, Math.floor(tw / 3));
  for (let i = 0; i < img.length; i++) {
    const a = img[i]; if (a.md < top - 5 || a.md > bot + 5) continue;
    const next = img[i + 1]; const y0 = Y(a.md - (i ? Math.min(1, (a.md - img[i - 1].md) / 2) : 0.5)), y1 = Y(next ? Math.min(a.md + 1, (a.md + next.md) / 2) : a.md + 0.5);
    for (let k = 0; k < N; k++) { // unwrapped circumference T→R→B→L→T, cosine-blend between sector centres
      const ang = k / N * 4, s0 = Math.floor(ang) % 4, s1 = (s0 + 1) % 4, f = ang - Math.floor(ang), wv = (1 - Math.cos(f * Math.PI)) / 2;
      const v = a.s[s0] * (1 - wv) + a.s[s1] * wv; const c = gammaColor((v - r[0]) / (r[1] - r[0]));
      g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(x0 + k * tw / N, y0, tw / N + 0.6, Math.max(1, y1 - y0));
    }
  }
  g.fillStyle = '#0b1117aa'; g.fillRect(x0, 0, tw, 13); g.fillStyle = '#cfd9e2'; g.font = '9px system-ui'; ['T', 'R', 'B', 'L', 'T'].forEach((s, i) => g.fillText(s, x0 + Math.min(tw - 8, Math.max(2, i * tw / 4 - 3)), 10));
}
function logInput(cv) {
  let drag = null, pinch = null;
  const mdAt = y => { const r = cv.getBoundingClientRect(); return V.top + (y - r.top) / r.height * V.span; };
  cv.addEventListener('wheel', e => { e.preventDefault(); if (e.ctrlKey) { V.span = Math.max(15, Math.min(1200, V.span * (e.deltaY > 0 ? 1.15 : 0.87))); } else { V.follow = false; V.top += e.deltaY / cv.clientHeight * V.span; } $('vwFollow').setAttribute('aria-pressed', String(V.follow)); drawLog(); }, {passive: false});
  cv.addEventListener('pointerdown', e => { drag = {y: e.clientY, top: V.top}; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { V.hoverMd = mdAt(e.clientY); if (drag && Math.abs(e.clientY - drag.y) > 3) { V.follow = false; $('vwFollow').setAttribute('aria-pressed', 'false'); V.top = drag.top - (e.clientY - drag.y) / cv.clientHeight * V.span; } drawLog(); });
  cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('pointerleave', () => { if (!drag) { V.hoverMd = null; drawLog(); } });
  cv.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = {d: Math.abs(e.touches[0].clientY - e.touches[1].clientY), span: V.span}; }, {passive: true});
  cv.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { e.preventDefault(); const dd = Math.abs(e.touches[0].clientY - e.touches[1].clientY) || 1; V.span = Math.max(15, Math.min(1200, pinch.span * pinch.d / dd)); drawLog(); } }, {passive: false});
  cv.addEventListener('touchend', () => { pinch = null; });
  cv.style.touchAction = 'none';
}

// ---------- 3D wells ----------
export const BRANCH_COLORS = ['#5cc8ff', '#7ee08a', '#d59cff', '#ffb547', '#4fd1c5', '#ff7b7b', '#f6e05e', '#a0aec0'];
function colorOf(name, list) { const i = list.findIndex(b => b.name === name); return BRANCH_COLORS[i % BRANCH_COLORS.length]; }
let reportPlanOnly=false,riskScope='',riskKinds=new Set(),riskTools=null;
function draw3d() {
  const x=X(),watch=x.reportWatch,policy=watch?.policy,cv=$('vw3d'),box=cv.parentElement;
  const nextScope=JSON.stringify(policy?.scope||null);if(nextScope!==riskScope){riskScope=nextScope;reportPlanOnly=false;riskKinds=new Set((policy?.zones||[]).map(z=>z.kind||'anti-collision'));}
  const actual=(x.branches||[]).filter(b=>!b.duplicateOf),ref=policy?.reference_path,planOnly=!!ref&&(reportPlanOnly||!actual.length);
  const B=planOnly?[{name:ref.name,path:ref.points,isReportPlan:true}]:actual,shownPlan=planOnly?null:x.plan;
  if(!riskTools){riskTools=document.createElement('div');riskTools.className='on-risk-tools';box.before(riskTools);}
  const markup=policy?'<button type="button" data-risk-basis>'+(planOnly?'Report plan shown':'Show report plan watches')+'</button><span data-risk-mode></span>'+[...new Set(policy.zones.map(z=>z.kind||'anti-collision'))].map(k=>'<label><input type="checkbox" data-risk-kind="'+k+'" '+(riskKinds.has(k)?'checked':'')+'>'+k.replaceAll('-',' ')+'</label>').join(''):'<span>Report risk layers are unavailable. No all-clear is implied.</span>';
  if(riskTools.dataset.markup!==markup){riskTools.dataset.markup=markup;riskTools.innerHTML=markup;riskTools.querySelector('[data-risk-basis]')?.addEventListener('click',()=>{reportPlanOnly=!planOnly;draw3d();});riskTools.querySelectorAll('[data-risk-kind]').forEach(el=>el.onchange=()=>{el.checked?riskKinds.add(el.dataset.riskKind):riskKinds.delete(el.dataset.riskKind);draw3d();});}
  const mode=riskTools.querySelector('[data-risk-mode]');if(mode)mode.textContent=planOnly?'Planned MD/TVD · report basis':'Actual overlay requires a verified branch and datum. Use the report plan to review risk bands.';

  box.style.height = Math.max(240, innerHeight - box.getBoundingClientRect().top - (innerWidth < 600 ? 125 : 80)) + 'px'; const {g, w, h} = canvasFit(cv);
  $('vw3Chips').innerHTML = B.map(b => `<button type="button" data-b="${esc(b.name)}" aria-pressed="${!V.hidden.has(b.name)}" style="--c:${b.name === x.active ? '#ff5d5d' : colorOf(b.name, B)}"><i></i>${esc(b.name)}</button>`).join('') + (B.length ? `<button type="button" data-all="1">All</button>` : '');
  $('vw3Chips').querySelectorAll('button').forEach(bt => bt.onclick = () => { if (bt.dataset.all) V.hidden.clear(); else V.hidden.has(bt.dataset.b) ? V.hidden.delete(bt.dataset.b) : V.hidden.add(bt.dataset.b); draw3d(); });
  if (!B.length) { g.fillStyle = '#8aa0b2'; g.font = '13px system-ui'; g.fillText(x.branchMsg || 'Reading the surveys of every wellbore…', 16, 30); return; }
  let n0 = 0, n1 = 0, e0 = 0, e1 = 0, t1 = 0; for (const b of [...B, ...(shownPlan?.length ? [{path: shownPlan}] : [])]) for (const p of b.path) { n0 = Math.min(n0, p.n); n1 = Math.max(n1, p.n); e0 = Math.min(e0, p.e); e1 = Math.max(e1, p.e); t1 = Math.max(t1, p.tvd); }
  const cx = (e0 + e1) / 2, cy = (n0 + n1) / 2, cz = t1 / 2, ext = Math.max(n1 - n0, e1 - e0, t1 * V.cam.vx, 10);
  const {yaw, pitch, dist, pan, vx} = V.cam, s = Math.min(w * 0.9, h * 1.4) / ext / dist;
  const P = p => { const X0 = p.e - cx, Y0 = p.n - cy, Z0 = -(p.tvd - cz) * vx; const x1 = X0 * Math.cos(yaw) - Y0 * Math.sin(yaw), y1 = X0 * Math.sin(yaw) + Y0 * Math.cos(yaw);
    const y2 = y1 * Math.sin(pitch) - Z0 * Math.cos(pitch); return [w / 2 + pan[0] + x1 * s, h / 2 + pan[1] + y2 * s]; };
  // surface datum: a light grid at TVD 0 around the wellhead, north arrow
  const raw = Math.max(n1 - n0, e1 - e0, 10) / 6, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag, gs = (f > 5 ? 10 : f > 2 ? 5 : f > 1 ? 2 : 1) * mag;
  const ge0 = Math.floor(e0 / gs) * gs, ge1 = Math.ceil(e1 / gs) * gs, gn0 = Math.floor(n0 / gs) * gs, gn1 = Math.ceil(n1 / gs) * gs;
  g.strokeStyle = '#18242f'; g.lineWidth = 1; // surface datum grid (TVD 0) under the wells only
  for (let e = ge0; e <= ge1 + 1e-6; e += gs) { const a = P({e, n: gn0, tvd: 0}), b = P({e, n: gn1, tvd: 0}); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  for (let n = gn0; n <= gn1 + 1e-6; n += gs) { const a = P({e: ge0, n, tvd: 0}), b = P({e: ge1, n, tvd: 0}); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  g.fillStyle = '#4a5d6e'; g.font = '10px system-ui'; const gl = P({e: ge1, n: gn0, tvd: 0}); g.fillText('surface grid ' + fmt(gs, 0) + ' m', Math.max(4, Math.min(w - 110, gl[0] + 4)), Math.max(12, Math.min(h - 4, gl[1] + 12)));
  const o = P({e: 0, n: 0, tvd: 0}), nA = P({e: 0, n: gs, tvd: 0}); g.strokeStyle = '#8aa0b2'; g.beginPath(); g.moveTo(...o); g.lineTo(...nA); g.stroke(); g.fillStyle = '#8aa0b2'; g.font = '11px system-ui'; g.fillText('N', nA[0] + 3, nA[1]);
  g.fillStyle = '#cfd9e2'; g.beginPath(); g.arc(o[0], o[1], 3.5, 0, 7); g.fill(); g.fillText('Wellhead (surface, TVD 0)', o[0] + 6, o[1] - 6);
  // user-loaded surfaces (Geosteer layers): wireframe in the same frame as the surveys
  for (const sf of GV.surfaces3d({n0, n1, e0, e1})) { g.strokeStyle = sf.color + '99'; g.lineWidth = 1;
    for (const ln of sf.lines) { g.beginPath(); let pen = false; for (const q of ln) { if (!q) { pen = false; continue; } const s2 = P(q); pen ? g.lineTo(...s2) : g.moveTo(...s2); pen = true; } g.stroke(); }
    const q0 = sf.lines.flat().find(Boolean); if (q0) { const s2 = P(q0); g.fillStyle = sf.color; g.font = '11px system-ui'; g.fillText(sf.name, s2[0] + 4, s2[1] - 4); } }
  // branches
  const order = [...B].sort((a, b) => (a.name === x.active) - (b.name === x.active)); const placed = [];
  const label = (txt, px, py, font, col) => { g.font = font; const wv = g.measureText(txt).width; px = Math.max(4, Math.min(w - wv - 4, px)); let y = py; for (let k = 0; k < 8 && placed.some(r => px < r[0] + r[2] && px + wv > r[0] && Math.abs(y - r[1]) < 12); k++) y += 13; placed.push([px, y, wv]); g.fillStyle = col; g.fillText(txt, px, y); };
  for (const b of order) {
    if (V.hidden.has(b.name)) continue; const act = b.name === x.active; const col = act ? '#ff5d5d' : colorOf(b.name, B);
    g.strokeStyle = col; g.lineWidth = act ? 3 : 1.6; g.globalAlpha = act ? 1 : 0.85; g.beginPath();
    const parent = b.parent ? B.find(o => o.name === b.parent) : null; const start = parent ? C.interpAt(parent.path, b.tieMd) : {e: 0, n: 0, tvd: 0};
    g.moveTo(...P(start)); for (const p of b.path) g.lineTo(...P(p)); g.stroke(); g.globalAlpha = 1;
    const end = P(b.path.at(-1)); if (act && x.bitPos && Number.isFinite(x.holeMd)) { g.fillStyle = '#ffb0b0'; g.fillRect(end[0] - 2, end[1] - 2, 4, 4); label('last survey ' + fmt(b.path.at(-1).md, 1) + ' m MD', end[0] - 20, end[1] + 18, '10px system-ui', '#ffb0b0'); } else label(b.isReportPlan ? 'Report plan · '+fmt(b.path.at(-1).md,1)+' m MD' : C.branchLabel(b, x.active, x.holeMd), end[0] + 5, end[1] + 4, (act ? 'bold ' : '') + '11px system-ui', col);
    if (b.parent) { const k = P(start); g.fillStyle = '#cfd9e2'; g.fillRect(k[0] - 2, k[1] - 2, 4, 4); }
  }
  if (shownPlan?.length > 1) { g.strokeStyle = '#e6edf3'; g.globalAlpha = 0.8; g.setLineDash([6, 4]); g.lineWidth = 1.6; g.beginPath(); shownPlan.forEach((p, i) => i ? g.lineTo(...P(p)) : g.moveTo(...P(p))); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; const pe = P(shownPlan.at(-1)); label('plan ' + (shownPlanName || '') + ' · TD ' + fmt(shownPlan.at(-1).md, 1) + ' m MD', pe[0] + 5, pe[1] + 4, '11px system-ui', '#e6edf3'); }
  if(planOnly)drawRiskBands({g,project:P,path:ref.points,zones:policy.zones.filter(z=>riskKinds.has(z.kind||'anti-collision')),width:w,height:h});
  const act = B.find(b => b.name === x.active);
  if (act && x.bitPos && !V.hidden.has(act.name)) { const last = P(act.path.at(-1)), bp = P(x.bitPos); g.strokeStyle = '#ff5d5d'; g.setLineDash([3, 3]); g.lineWidth = 2; g.beginPath(); g.moveTo(...last); g.lineTo(...bp); g.stroke(); g.setLineDash([]);
    g.fillStyle = V.blink ? '#ffffff' : '#ff5d5d'; g.beginPath(); g.arc(bp[0], bp[1], 5, 0, 7); g.fill(); g.fillStyle = '#ffd0d0'; g.font = 'bold 11px system-ui'; const kind = x.bitKind === 'derived' ? 'derived from hole MD' : x.bitKind === 'reported' ? 'reported' : 'not reported';
    const L3 = [[C.branchLabel(act, x.active, x.holeMd), 'bold 11px system-ui', '#ff5d5d'], [C.bitLabel(x.bitPos, x.holeMd, kind), 'bold 11px system-ui', '#ffd0d0'], [C.projLabel(x.bitPos), 'italic 10px system-ui', '#ff9a9a']].filter(r => r[0]);
    g.font = 'bold 11px system-ui'; const bw = Math.max(...L3.map(r => g.measureText(r[0]).width)) + 12, bx = w < 600 ? 8 : Math.max(4, Math.min(w - bw - 4, bp[0] + 14)), by = w < 600 ? 8 : Math.max(4, bp[1] - 26 - L3.length * 14); // phone: fixed top-left, leader to the marker
    g.strokeStyle = '#ff5d5d88'; g.beginPath(); g.moveTo(bp[0], bp[1]); g.lineTo(bx, by + L3.length * 14 + 6); g.stroke(); g.fillStyle = '#0b1117dd'; g.fillRect(bx, by, bw, L3.length * 14 + 8);
    L3.forEach((r, i) => { g.font = r[1]; g.fillStyle = r[2]; g.fillText(r[0], bx + 6, by + 15 + i * 14); }); placed.push([bx, by + 10, bw], [bx, by + 24, bw], [bx, by + 38, bw]); }
  $('vw3Note').textContent = planOnly ? 'REPORT PLAN ONLY. The coloured bands mark sourced MD/TVD intervals; their screen width is not a clearance radius. Actual position and branch/depth alignment are unverified. Drag to orbit, pinch to zoom.' : 'Trajectories by minimum curvature from each wellbore\'s survey, tied on at its kick-off (■). Red line = surveyed hole, dashed = projected from the last survey to the bit.' + (X().plan?.length ? ' White dashed = well plan (' + (X().planName || 'plan') + ').' : '') + ' The bit is never placed deeper than hole MD (latest depth-log row). Other wellbores are labelled with their last survey station. Drag to orbit, wheel or pinch to zoom, two-finger or right-drag to pan.' + (V.cam.vx !== 1 ? ' Vertical exaggerated ×' + V.cam.vx + '.' : '');
  $('vwNote').textContent = planOnly ? 'Report plan · actual position unverified' : B.length + ' branches · ' + (x.active || '') + ' highlighted';
}
function orbitInput(cv) {
  let d = null, pts = new Map(), pin = null;
  cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); d = {x: e.clientX, y: e.clientY, cam: {...V.cam, pan: [...V.cam.pan]}, btn: e.button}; cv.setPointerCapture(e.pointerId); if (pts.size === 2) { const [a, b] = [...pts.values()]; pin = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: V.cam.dist, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], pan: [...V.cam.pan]}; } });
  cv.addEventListener('pointermove', e => { if (!d) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pin && pts.size === 2) { const [a, b] = [...pts.values()]; V.cam.dist = Math.max(0.05, Math.min(5, pin.dist * pin.d / (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1))); V.cam.pan = [pin.pan[0] + (a[0] + b[0]) / 2 - pin.mid[0], pin.pan[1] + (a[1] + b[1]) / 2 - pin.mid[1]]; draw3d(); return; }
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (d.btn === 2 || e.shiftKey) V.cam.pan = [d.cam.pan[0] + dx, d.cam.pan[1] + dy]; else { V.cam.yaw = d.cam.yaw + dx * 0.008; V.cam.pitch = Math.max(0.02, Math.min(1.57, d.cam.pitch + dy * 0.006)); }
    draw3d(); });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pin = null; if (!pts.size) d = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); V.cam.dist = Math.max(0.05, Math.min(5, V.cam.dist * (e.deltaY > 0 ? 1.12 : 0.89))); draw3d(); }, {passive: false});
  cv.style.touchAction = 'none';
}

// ---------- Tally ----------
let tallyFile = '';
async function readTally(f) {
  tallyFile = f.name; let rows;
  try {
    if (/\.xlsx$/i.test(f.name)) rows = await xlsxRows(await f.arrayBuffer());
    else if (/\.pdf$/i.test(f.name)) throw new Error('PDF tallies are not read yet: save the sheet as CSV or Excel');
    else rows = C.parseCsv(await f.text());
    const t = C.parseTally(rows); if (t.error) throw new Error(t.error);
    TV.importTally?.(t, f.name); X().setTally?.(t, f.name); // board first (it feeds itself), then the real tally for the reconcile check
  } catch (e) { X().setTally?.(null, f.name, e.message); }
  drawTally();
}
function drawTally() {
  try { TV.draw(); } catch (e) { $('vwTallyBoard').innerHTML = '<p class="vw-fail">Tally board error: ' + esc(e.message) + '</p>'; }
  const x = X(), t = /^tally board/i.test(x.tallyName || '') ? null : x.tally, cmp = x.tallyCmp, out = $('vwTallyOut');
  $('vwNote').textContent = 'Tally · auto-generated from the live depth log · optional real tally reconciles at 0.3 m per joint, 1 m cumulative';
  if (x.tallyError) { out.innerHTML = `<p class="vw-fail">${esc(tallyFile)}: ${esc(x.tallyError)}</p>`; return; }
  if (!t) { out.innerHTML = '<p class="on-muted">No real tally loaded: the auto-generated tally above is in use. A real tally needs joint number and length (m or ft); cumulative and BHA lines are optional.</p>'; return; }
  const pass = cmp?.pass;
  out.innerHTML = `<p class="${pass ? 'vw-pass' : 'vw-fail'}"><b>${pass ? 'PASS' : 'CHECK'}</b> · ${esc(x.tallyName)} · ${t.joints.length} joints + BHA ${fmt(t.bhaLen, 2)} m = ${fmt(cmp?.tallyTotal, 2)} m</p>
    <ul class="vw-sum">
      <li>Joint lengths: ${cmp?.lenChecked ?? 0} compared with hole drilled between connections · ${cmp?.lenBad.length ? '<b>' + cmp.lenBad.length + ' off by more than 0.3 m</b>' : 'all within 0.3 m'} (largest ${fmt(cmp?.maxLenDiff, 2)} m)</li>
      <li>Cumulative (BHA + joints) vs connection depth: ${cmp?.cumBad.length ? '<b>' + cmp.cumBad.length + ' off by more than 1 m</b>' : 'all within 1 m'} (largest ${fmt(cmp?.maxCumDiff, 2)} m)</li>
      <li>Joint count: tally puts ${fmt(cmp?.inHole, 0)} joints fully in the hole at bit ${fmt(x.bitMd, 1)} m; drilling joint ${cmp?.drilling ?? '—'} · connections seen in the log ${x.conns?.length ?? 0}${cmp?.unmatched ? ', ' + cmp.unmatched + ' not matched to the tally' : ''}</li>
      ${t.issues.map(i => '<li><b>' + esc(i) + '</b></li>').join('')}</ul>
    <table class="on-table"><thead><tr><th>Connection m</th><th>Tally joint</th><th>Tally cum. m</th><th>Δ cum. m</th><th>Next joint</th><th>Tally len m</th><th>Drilled m</th><th>Δ len m</th></tr></thead><tbody>
    ${(cmp?.rows || []).slice().reverse().map(r => `<tr data-bad="${(r.cumDiff != null && Math.abs(r.cumDiff) > cmp.tolC) || (r.lenDiff != null && Math.abs(r.lenDiff) > cmp.tolJ)}"><td>${fmt(r.conn, 1)}</td><td>${r.joint ?? 'no match'}</td><td>${fmt(r.cumDepth, 2)}</td><td>${fmt(r.cumDiff, 2)}</td><td>${r.nextJoint ?? ''}</td><td>${fmt(r.tallyLen, 2)}</td><td>${fmt(r.measured, 1)}</td><td>${fmt(r.lenDiff, 2)}</td></tr>`).join('')}</tbody></table>`;
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Minimal .xlsx reader: unzip with the browser's DecompressionStream and read the first sheet
// (or, with opt.prefer, the first sheet whose name matches; rows.sheetName / rows.sheetNames tell which).
export async function xlsxRows(buf, opt = {}) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); const files = {};
  let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid .xlsx file');
  let p = dv.getUint32(eocd + 16, true); const n = dv.getUint16(eocd + 10, true);
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); files[name] = {method, csize, off}; p += 46 + nl + xl + cl;
  }
  const read = async name => { const f = files[name]; if (!f) return ''; const lnl = dv.getUint16(f.off + 26, true), lxl = dv.getUint16(f.off + 28, true); const data = u8.subarray(f.off + 30 + lnl + lxl, f.off + 30 + lnl + lxl + f.csize);
    if (f.method === 0) return new TextDecoder().decode(data); const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return await new Response(s).text(); };
  const ss = [...(await read('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(t => t[1]).join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  let sheet = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0])[0]; if (!sheet) throw new Error('No worksheet in the .xlsx');
  let sheetName = '', sheetNames = [];
  try {
    const wbx = await read('xl/workbook.xml'), rel = await read('xl/_rels/workbook.xml.rels');
    const tgt = {}; for (const m of rel.matchAll(/<Relationship\s[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) tgt[m[1]] = 'xl/' + m[2].replace(/^\/?xl\//, '');
    for (const m of rel.matchAll(/<Relationship\s[^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g)) tgt[m[2]] = 'xl/' + m[1].replace(/^\/?xl\//, '');
    const list = [...wbx.matchAll(/<sheet\s[^>]*?name="([^"]*)"[^>]*?r:id="([^"]+)"/g)].map(m => ({name: m[1].replace(/&amp;/g, '&'), file: tgt[m[2]]})).filter(x => x.file && files[x.file]);
    sheetNames = list.map(x => x.name);
    const pick = opt.prefer ? list.find(x => opt.prefer.test(x.name)) : list[0];
    if (pick) { sheet = pick.file; sheetName = pick.name; }
  } catch {}
  const xml = await read(sheet), rows = [], byRow = {};
  for (const r of xml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
    const row = [], rn = +((/\br="(\d+)"/.exec(r[1]) || [])[1] || 0); r[1] = r[2];
    for (const c of r[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (/r="([A-Z]+)\d+"/.exec(c[1]) || [])[1] || ''; let ci = 0; for (const ch of ref) ci = ci * 26 + ch.charCodeAt(0) - 64; ci = Math.max(0, ci - 1);
      const t = (/t="([^"]*)"/.exec(c[1]) || [])[1], v = (/<v>([^<]*)<\/v>/.exec(c[2] || '') || [])[1] ?? (/<t[^>]*>([^<]*)<\/t>/.exec(c[2] || '') || [])[1] ?? '';
      row[ci] = t === 's' ? ss[Number(v)] ?? '' : v;
    }
    const clean = Array.from(row, x => (x ?? '').trim()); rows.push(clean); if (rn) byRow[rn] = clean;
  }
  const out = rows.filter(r => r.some(Boolean)); out.sheetName = sheetName; out.sheetNames = sheetNames; out.byRow = byRow;
  return out;
}
