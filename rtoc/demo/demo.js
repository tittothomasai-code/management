import { createFixture, LABEL } from '../fixtures/store.js';
import { ingest } from '../witsml/reader.js';
import { buildContext } from '../witsml/context.js';
import { goHistorical, goLive, initSelection, shownJoint, step } from '../witsml/selection.js';
import { drawSeries, renderCourseBoard } from '../ui/board.js';
import { createCinematicController } from '../ui/cinematic.js';

const LIMITS = { maxReturnNodes: 80, maxPagesPerObject: 20, concurrency: 2, delayMs: 0 };
const fix = createFixture();
let ctx = null;
let selection = initSelection();
let wellId = 'SIM-W1';
let wbId = 'WB-A';
let hidden = false;
let filter = 'all';
let pumps = 0;

const $ = id => document.getElementById(id);

const rig = {
  position: [14, 9, 20],
  target: [0, 6, 0],
  controlsEnabled: true,
  mode: 'orbit',
};
function readRig() {
  return { position: rig.position.slice(), target: rig.target.slice(), controlsEnabled: rig.controlsEnabled, mode: rig.mode };
}
function writeRig(s) {
  rig.position = s.position.slice();
  rig.target = s.target.slice();
  if (typeof s.controlsEnabled === 'boolean') rig.controlsEnabled = s.controlsEnabled;
  if ('mode' in s) rig.mode = s.mode;
  paintRig();
}
function paintRig() {
  const dist = Math.hypot(rig.position[0], rig.position[1], rig.position[2]) || 1;
  const scale = Math.max(0.45, Math.min(1.15, 16 / dist));
  const el = $('derrick');
  if (!el) return;
  el.style.transform = `translate(calc(-50% + ${rig.position[0]}px), ${-rig.position[1]}px) scale(${scale})`;
}

function currentWb() {
  const w = ctx?.wells.find(x => x.uid === wellId) || ctx?.wells[0];
  return w?.wellbores.find(b => b.uid === wbId) || w?.wellbores[0] || null;
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
  $('filter').value = filter;
  $('meta').textContent = `${ctx.source.protocol} · reported ${ctx.source.versionReported || 'unknown'} · tag ${ctx.source.tag} · live store verified: no · inventory ${ctx.inventoryComplete ? 'finished' : 'incomplete'} · history ${ctx.historyComplete ? 'read through header ends' : 'not fully read'} · ${ctx.source.calls} read calls · ${LABEL}`;
  $('app').classList.toggle('hide-well', hidden);
  $('hide').textContent = hidden ? 'Show well pane' : 'Hide well pane';
  const shown = shownJoint(selection, wb?.joints || []);
  renderCourseBoard({
    score: $('score'),
    course: $('course'),
    well: $('wellPane'),
    joint: $('joint'),
  }, {
    wellbore: wb,
    shown,
    source: ctx.source,
    filter,
    historical: selection.mode === 'historical',
  });
  drawSeries($('chart'), shown);
  const joints = wb?.joints || [];
  const i = joints.findIndex(j => j.id === shown?.id);
  $('prev').disabled = i <= 0;
  $('next').disabled = i < 0 || i >= joints.length - 1;
  paintRig();
}

$('well').onchange = () => { wellId = $('well').value; selection = goLive(); reload(); };
$('wb').onchange = () => { wbId = $('wb').value; selection = goLive(); render(); };
$('filter').onchange = () => { filter = $('filter').value; render(); };
$('hide').onclick = () => { hidden = !hidden; render(); };
$('prev').onclick = () => { selection = step(selection, currentWb()?.joints || [], -1); render(); };
$('next').onclick = () => { selection = step(selection, currentWb()?.joints || [], 1); render(); };
$('current').onclick = () => { selection = goLive(); render(); };
$('live').onclick = async () => { fix.appendLive(); await reload(); };
$('course').addEventListener('click', (e) => {
  const b = e.target.closest('[data-joint]');
  if (!b) return;
  const j = (currentWb()?.joints || []).find(x => x.id === b.dataset.joint);
  if (j) { selection = goHistorical(j); render(); }
});

$('gutter').addEventListener('pointerdown', (e) => {
  $('gutter').setPointerCapture(e.pointerId);
  const move = (ev) => {
    const r = $('app').getBoundingClientRect();
    const pct = Math.min(70, Math.max(22, ((ev.clientX - r.left) / r.width) * 100));
    $('app').style.setProperty('--split', pct + '%');
  };
  const up = () => { $('gutter').removeEventListener('pointermove', move); $('gutter').removeEventListener('pointerup', up); };
  $('gutter').addEventListener('pointermove', move);
  $('gutter').addEventListener('pointerup', up);
});

$('rigPumps').onclick = () => { pumps += 1; $('pumpCount').textContent = String(pumps); };

const cine = createCinematicController({
  read: readRig,
  write: writeRig,
  setClutter(hide) { $('rigDemo').classList.toggle('rtoc-cinematic', hide); },
}, {
  claimKey: true,
  button: $('cinematicBtn'),
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  now: () => performance.now(),
  requestFrame: cb => requestAnimationFrame(cb),
  cancelFrame: id => cancelAnimationFrame(id),
  onChange(active) {
    $('cinematicBtn').textContent = active ? 'Exit cinematic (Esc)' : 'Cinematic view (F1)';
    $('cineState').textContent = active ? 'Cinematic view on. Sim pumps were not changed.' : '';
  },
});

paintRig();
reload();
void cine;
