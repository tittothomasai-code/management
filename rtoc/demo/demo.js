import { createFixture, LABEL } from '../fixtures/store.js';
import { ingest } from '../witsml/reader.js';
import { buildContext } from '../witsml/context.js';
import { goLive, initSelection, shownJoint, step } from '../witsml/selection.js';

const LIMITS = { maxReturnNodes: 80, maxPagesPerObject: 20, concurrency: 2, delayMs: 0 };
const fix = createFixture();
let ctx = null;
let selection = initSelection();
let wellId = 'SIM-W1';
let wbId = 'WB-A';
let hidden = false;

const $ = id => document.getElementById(id);

function currentWb() {
  const w = ctx.wells.find(x => x.uid === wellId) || ctx.wells[0];
  return w?.wellbores.find(b => b.uid === wbId) || w?.wellbores[0] || null;
}

function fmtMd(v) { return v == null || !Number.isFinite(v) ? 'unknown' : v.toFixed(2) + ' m'; }
function fmtTime(t) {
  if (!t || t.ms == null) return 'unknown' + (t?.source ? ' (' + t.source + ')' : '');
  return t.isoUtc + (t.source ? ' · ' + t.source : '');
}

async function reload() {
  const model = await ingest(fix.request, { limits: LIMITS, tag: 'SIM-TEST' });
  ctx = buildContext(model);
  if (!ctx.wells.some(w => w.uid === wellId)) wellId = ctx.wells[0]?.uid || '';
  const w = ctx.wells.find(x => x.uid === wellId);
  if (!w?.wellbores.some(b => b.uid === wbId)) wbId = w?.wellbores[0]?.uid || '';
  render();
}

function render() {
  const w = ctx.wells.find(x => x.uid === wellId) || ctx.wells[0];
  const wellSel = $('well');
  wellSel.innerHTML = ctx.wells.map(x => `<option value="${x.uid}">${x.name}</option>`).join('');
  wellSel.value = w.uid;
  const wbSel = $('wb');
  wbSel.innerHTML = w.wellbores.map(b => `<option value="${b.uid}">${b.name}</option>`).join('');
  const wb = currentWb();
  wbSel.value = wb?.uid || '';
  $('meta').textContent = `${ctx.source.protocol} · reported ${ctx.source.versionReported || 'unknown'} · tag ${ctx.source.tag} · live store verified: no · inventory ${ctx.inventoryComplete ? 'finished' : 'incomplete'} · history ${ctx.historyComplete ? 'read through header ends' : 'not fully read'} · ${ctx.source.calls} read calls · ${LABEL}`;
  $('app').style.setProperty('--split', hidden ? '0' : ($('app').style.getPropertyValue('--split') || '42%'));
  $('app').classList.toggle('hide-well', hidden);
  $('hide').textContent = hidden ? 'Show well pane' : 'Hide well pane';
  renderWell(wb);
  renderJoint(wb);
}

function renderWell(wb) {
  if (!wb) { $('wellPane').innerHTML = '<p>No wellbore.</p>'; return; }
  const rows = Object.entries(wb.branches).map(([type, br]) => {
    const objs = br.objects.map(o => `${o.uid || '(no uid)'} ${o.status}${o.reason ? ' — ' + o.reason : ''}${o.rows ? ' · ' + o.rows + ' rows' : ''}`).join('<br>') || br.reason || '';
    return `<tr><td>${type}</td><td><span class="chip ${br.status}">${br.status}</span></td><td>${objs}</td></tr>`;
  }).join('');
  const logs = wb.logs.map(l => `<li>${l.name} · ${l.classification || l.indexKind} · ${l.dataStatus}${l.reason ? ' (' + l.reason + ')' : ''} · ${l.rows} rows · ${l.pages} pages · gaps ${l.gapCount}</li>`).join('');
  $('wellPane').innerHTML = `
    <h2>${wb.name}</h2>
    <p>Depth-log span ${fmtMd(wb.coverage.depth.min)} → ${fmtMd(wb.coverage.depth.max)}${wb.coverage.depth.partial ? ' · partial' : ''}. This is only depth-indexed logs, not the time-log hole depth. Time ${wb.coverage.time.min == null ? 'unknown' : new Date(wb.coverage.time.min).toISOString()} → ${wb.coverage.time.max == null ? 'unknown' : new Date(wb.coverage.time.max).toISOString()}.</p>
    <p>Curves ${wb.curves.length}. Surveys ${wb.surveys.length}. Formations ${wb.formations.length}. Operations ${wb.operations.length}. Joints ${wb.jointCount == null ? 'unknown' : wb.jointCount}.</p>
    <h3>Branches</h3>
    <table><thead><tr><th>Type</th><th>Status</th><th>Objects</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>Logs</h3><ul>${logs || '<li>none</li>'}</ul>
    <h3>Not known</h3><ul>${[...wb.unknowns, ...wb.jointUnknowns].map(u => `<li>${u}</li>`).join('') || '<li>none recorded</li>'}</ul>`;
}

function renderJoint(wb) {
  const joints = wb?.joints || [];
  const j = shownJoint(selection, joints);
  const live = joints.find(x => x.open) || joints.at(-1);
  const hist = selection.mode === 'historical';
  let html = '';
  if (hist) html += `<div class="hist">Historical snapshot frozen. Live end is now ${fmtMd(live?.endMd_m)}. This view stays at ${fmtMd(j?.endMd_m)}.</div>`;
  if (!j) {
    html += `<h2>Joint unknown</h2><p>No joint was identified for this wellbore. Count: ${wb?.jointCount == null ? 'unknown' : wb.jointCount}.</p>`;
    $('joint').innerHTML = html;
    return;
  }
  const i = joints.findIndex(x => x.id === j.id);
  html += `<h2>${j.open ? 'Open joint' : 'Joint'} ${i + 1} of ${joints.length}</h2>`;
  html += `<p>${j.kind} · ${j.kindSource}<br>Source ${j.boundarySource} · method ${j.method} · uncertainty ${j.uncertainty}</p>`;
  html += `<p>Start depth ${fmtMd(j.startMd_m)}<br>End depth ${fmtMd(j.endMd_m)}<br>Start time ${fmtTime(j.startTime)}<br>End time ${fmtTime(j.endTime)}</p>`;
  if (j.timeNote) html += `<p>${j.timeNote}</p>`;
  html += `<h3>Modes</h3><ul>${(j.modes || []).map(m => `<li>${m.mode}: ${m.duration_s == null ? 'duration unknown' : m.duration_s.toFixed(0) + ' s'} · ${m.samples} samples · ${m.durationBasis || ''}</li>`).join('') || '<li>unknown</li>'}</ul>`;
  const sum = j.summary || {};
  html += `<h3>Summary</h3><ul>
    <li>Samples ${sum.samples ?? 0}</li>
    <li>MD span ${fmtMd(sum.mdSpan_m)}</li>
    <li>Duration ${sum.duration_s == null ? 'unknown' : sum.duration_s.toFixed(0) + ' s'}</li>
    <li>Mean ROP ${sum.meanRop_m_h == null ? 'not in data' : sum.meanRop_m_h.toFixed(2) + ' m/h from ' + sum.ropSamples + ' samples'}</li>
  </ul>`;
  html += `<h3>Surveys</h3><ul>${(j.surveys || []).map(s => `<li>MD ${fmtMd(s.md_m)} · inc ${s.incl_deg ?? 'unknown'}° · azi ${s.azi_deg ?? 'unknown'}° · ${s.withinInterval ? 'inside joint' : 'nearest, ' + s.distance_m.toFixed(2) + ' m away'} · aligned by ${s.alignedBy} · not interpolated</li>`).join('') || '<li>none associated</li>'}</ul>`;
  html += `<h3>Joint series</h3><canvas id="chart" width="640" height="160"></canvas>`;
  $('joint').innerHTML = html;
  draw(j);
  $('prev').disabled = i <= 0;
  $('next').disabled = i < 0 || i >= joints.length - 1;
}

function draw(j) {
  const canvas = $('chart');
  if (!canvas) return;
  const s = (j.series || []).find(x => x.mnemonic === 'ROPA') || (j.series || []).find(x => x.mnemonic === 'GR') || (j.series || [])[0];
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#9aafc6';
  g.font = '12px system-ui';
  if (!s || !s.points.some(p => Number.isFinite(p.v))) { g.fillText('No numeric series inside this joint.', 12, 24); return; }
  const pts = s.points.filter(p => Number.isFinite(p.v) && Number.isFinite(p.md));
  const xs = pts.map(p => p.md), ys = pts.map(p => p.v);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  g.fillText(`${s.mnemonic} (${s.unit || 'unit unknown'}) · ${pts.length} points`, 12, 16);
  g.strokeStyle = '#7eb6d9';
  g.beginPath();
  pts.forEach((p, i) => {
    const x = 20 + (maxX === minX ? 0 : (p.md - minX) / (maxX - minX)) * (canvas.width - 40);
    const y = 30 + (maxY === minY ? 0 : (maxY - p.v) / (maxY - minY)) * (canvas.height - 46);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.stroke();
}

$('well').onchange = () => { wellId = $('well').value; selection = goLive(); reload(); };
$('wb').onchange = () => { wbId = $('wb').value; selection = goLive(); render(); };
$('hide').onclick = () => { hidden = !hidden; render(); };
$('prev').onclick = () => { selection = stepBack(selection); render(); };
$('next').onclick = () => { selection = stepFwd(selection); render(); };
$('current').onclick = () => { selection = goLive(); render(); };
$('live').onclick = async () => { fix.appendLive(); await reload(); };

function stepBack(state) { return step(state, currentWb()?.joints || [], -1); }
function stepFwd(state) { return step(state, currentWb()?.joints || [], 1); }

const gutter = $('gutter');
gutter.addEventListener('pointerdown', (e) => {
  gutter.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const r = $('app').getBoundingClientRect();
    const pct = Math.min(70, Math.max(22, ((ev.clientX - r.left) / r.width) * 100));
    $('app').style.setProperty('--split', pct + '%');
  };
  const up = () => { gutter.removeEventListener('pointermove', move); gutter.removeEventListener('pointerup', up); };
  gutter.addEventListener('pointermove', move);
  gutter.addEventListener('pointerup', up);
});

reload();
