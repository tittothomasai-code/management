import test from 'node:test';
import assert from 'node:assert/strict';
import { courseFrames, modeTimeline, scoreboard } from './ui/scores.js';
import { cinematicPose, createCinematicController, tryGameAdapter } from './ui/cinematic.js';
import { goHistorical, shownJoint } from './witsml/selection.js';

function finite(n) { return typeof n === 'number' && Number.isFinite(n); }

function wbFixture() {
  return {
    jointCount: 3,
    jointBoundary: 'derived-signals',
    branches: { log: { status: 'ingested', objects: [] }, trajectory: { status: 'missing', objects: [] }, risk: { status: 'unsupported', objects: [] } },
    coverage: {
      depth: { min: 0, max: 80, partial: true, logs: ['DEPTH-OO'] },
      time: { min: Date.parse('2026-11-01T00:00:00Z'), max: Date.parse('2026-11-01T01:00:00Z'), partial: false, logs: ['TIME-RT'], timezones: ['utc'] },
    },
    surveys: [{ md_m: 1 }, { md_m: 2 }],
    curves: [], formations: [], operations: [], logs: [],
    joints: [
      { id: 'j1', index: 1, kind: 'joint', open: false, length_m: 9.5, uncertainty: 'estimate', method: 'derived-from-signals', boundarySource: 'derived-signals', kindSource: 'measured-length-band', startMd_m: 10, endMd_m: 19.5, startTime: { ms: 1, isoUtc: 't', source: 'derived-signals' }, endTime: { ms: 2, isoUtc: 't2', source: 'derived-signals' }, modes: [{ mode: 'drilling', duration_s: 100, samples: 4, durationBasis: 'sum-of-steps-to-next-sample' }, { mode: 'reaming', duration_s: null, samples: 1 }], summary: { meanRop_m_h: 22.5, ropSamples: 4, samples: 4, mdSpan_m: 9.5, duration_s: 100 }, surveys: [{ md_m: 12, withinInterval: true, distance_m: 0, incl_deg: 1, azi_deg: 2, interpolated: false, alignedBy: 'depth' }] },
      { id: 'j2', index: 2, kind: 'stand', open: false, length_m: 28.5, uncertainty: 'estimate', method: 'derived-from-signals', boundarySource: 'derived-signals', kindSource: 'measured-length-band', startMd_m: 19.5, endMd_m: 48, startTime: { ms: 2, isoUtc: 't2', source: 'derived-signals' }, endTime: { ms: 3, isoUtc: 't3', source: 'derived-signals' }, modes: [], summary: { meanRop_m_h: null, ropSamples: 0 }, surveys: [] },
      { id: 'j3', index: 3, kind: 'unknown', open: true, length_m: null, uncertainty: 'estimate', method: 'derived-from-signals', boundarySource: 'derived-signals', kindSource: 'measured-length-band', startMd_m: 48, endMd_m: null, startTime: { ms: null, source: 'unknown' }, endTime: { ms: null, source: 'unknown' }, modes: [{ mode: 'unknown', duration_s: 0, samples: 1 }], summary: { meanRop_m_h: null, ropSamples: 0 }, surveys: [{ md_m: 100, withinInterval: false, distance_m: 12, incl_deg: null, azi_deg: null, interpolated: false, alignedBy: 'depth' }] },
    ],
  };
}

function walk(value, hit) {
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (/target|rank|stars|mario|nintendo/i.test(k)) hit.push(k);
      walk(v, hit);
    }
  }
}

test('scores use real figures and leave unknowns empty', () => {
  const wb = wbFixture();
  const board = scoreboard(wb, wb.joints[0], { tag: 'SIM-TEST' });
  assert.equal(board.liveVerified, false);
  assert.equal(board.tag, 'SIM-TEST');
  assert.equal(board.kpis.find(k => k.id === 'joints').value, 3);
  assert.equal(board.kpis.find(k => k.id === 'rop').value, 22.5);
  assert.equal(board.kpis.find(k => k.id === 'rop').denominator, 4);
  assert.equal(board.kpis.find(k => k.id === 'joint-length').uncertainty, 'estimate');
  const none = scoreboard(wb, wb.joints[2], { tag: 'SIM-TEST' });
  assert.equal(none.kpis.find(k => k.id === 'rop').value, null);
  assert.equal(none.kpis.find(k => k.id === 'joint-length').value, null);
  const empty = scoreboard({ jointCount: null, branches: {}, coverage: {} }, null, {});
  assert.equal(empty.kpis.find(k => k.id === 'joints').value, null);
  assert.match(empty.kpis.find(k => k.id === 'joints').note, /unknown/i);
  const sum = Object.values(board.counts).reduce((s, n) => s + n, 0);
  assert.equal(sum, board.branchTotal);
  const bad = [];
  walk(board, bad);
  assert.deepEqual(bad, []);
});

test('joint filter hides cards without changing the selected id', () => {
  const wb = wbFixture();
  const sel = goHistorical(wb.joints[0]);
  const course = courseFrames(wb.joints, { filter: 'stand', selectedId: shownJoint(sel, wb.joints).id });
  assert.equal(course.frames.length, 1);
  assert.equal(course.frames[0].kind, 'stand');
  assert.equal(course.hiddenSelected, true);
  assert.equal(sel.frozen.id, 'j1');
  assert.equal(sel.frozen.length_m, 9.5);
  const unk = courseFrames(wb.joints, { filter: 'unknown', selectedId: 'j3' });
  assert.equal(unk.frames.length, 1);
  assert.equal(unk.frames[0].bar, null);
  assert.equal(unk.frames[0].length_m, null);
});

test('mode timeline does not invent equal shares when duration is missing', () => {
  const tl = modeTimeline(wbFixture().joints[0]);
  assert.equal(tl.segments.find(s => s.mode === 'drilling').share, 1);
  assert.equal(tl.segments.find(s => s.mode === 'reaming').share, null);
  const bare = modeTimeline(wbFixture().joints[2]);
  assert.equal(bare.basis, 'duration unknown');
  assert.ok(bare.segments.every(s => s.share == null));
});

function keyEvent(key, extra = {}) {
  const e = {
    key, repeat: false, defaultPrevented: false, target: { tagName: 'BODY' },
    preventDefault() { e.defaultPrevented = true; },
    stopPropagation() { e.stopped = true; },
    ...extra,
  };
  return e;
}

function harness(opts = {}) {
  let camera = { position: [14, 9, 20], target: [0, 6, 0], controlsEnabled: true, mode: 'orbit' };
  let pumps = 1;
  let clutter = false;
  const writes = [];
  const listeners = {};
  const button = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(type, fn) { listeners['click:' + type] = fn; }, removeEventListener() {} };
  const host = {
    read: () => structuredClone(camera),
    write(next) { writes.push(structuredClone(next)); camera = structuredClone(next); },
    setClutter(v) { clutter = !!v; },
    bump() { pumps += 1; },
    pumps: () => pumps,
    clutter: () => clutter,
    writes,
  };
  const win = {
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener() {},
    matchMedia() { return { matches: false }; },
  };
  const doc = { activeElement: { tagName: 'BODY' } };
  const frames = [];
  const ctrl = createCinematicController(host, {
    claimKey: opts.claimKey === true,
    reducedMotion: opts.reducedMotion === true,
    window: win,
    document: doc,
    button,
    now: () => opts.clock?.t ?? 0,
    requestFrame: opts.reducedMotion ? undefined : (fn) => { frames.push(fn); return frames.length; },
    cancelFrame() {},
    ...opts.extra,
  });
  return { host, ctrl, listeners, button, frames, doc, fire(e) { listeners.keydown(e); } };
}

test('F1 repeat, typing, and Escape restore the camera without touching sim state', () => {
  const h = harness({ claimKey: true, reducedMotion: true });
  const before = h.host.read();
  h.fire(keyEvent('F1'));
  assert.equal(h.ctrl.isOn(), true);
  assert.equal(h.host.clutter(), true);
  assert.equal(h.button.attrs['aria-pressed'], 'true');
  assert.notDeepEqual(h.host.read().position, before.position);
  assert.equal(h.host.read().controlsEnabled, false);
  assert.equal(h.host.read().mode, 'orbit');
  const posed = h.host.writes.length;
  h.fire(keyEvent('F1', { repeat: true }));
  assert.equal(h.host.writes.length, posed);
  assert.equal(h.ctrl.isOn(), true);
  h.doc.activeElement = { tagName: 'INPUT' };
  h.fire(keyEvent('F1', { target: h.doc.activeElement }));
  assert.equal(h.ctrl.isOn(), true);
  h.doc.activeElement = { tagName: 'BODY' };
  h.host.bump();
  h.fire(keyEvent('Escape'));
  assert.equal(h.ctrl.isOn(), false);
  assert.deepEqual(h.host.read(), before);
  assert.equal(h.host.clutter(), false);
  assert.equal(h.host.pumps(), 2);
  const writes = h.host.writes.length;
  h.fire(keyEvent('Escape'));
  assert.equal(h.host.writes.length, writes);
});

test('F1 is not claimed unless the host asks, so browser help is left alone', () => {
  const h = harness({ claimKey: false, reducedMotion: true });
  const e = keyEvent('F1');
  h.fire(e);
  assert.equal(h.ctrl.isOn(), false);
  assert.equal(e.defaultPrevented, false);
  h.listeners['click:click']();
  assert.equal(h.ctrl.isOn(), true);
  h.ctrl.exit();
  assert.deepEqual(h.host.read().position, [14, 9, 20]);
});

test('reduced motion applies the cinematic frame in one write', () => {
  const h = harness({ claimKey: true, reducedMotion: true });
  h.ctrl.enter();
  assert.equal(h.frames.length, 0);
  assert.equal(h.host.writes.length, 1);
  const pose = cinematicPose({ position: [14, 9, 20], target: [0, 6, 0], controlsEnabled: true, mode: 'orbit' });
  assert.deepEqual(h.host.read().position, pose.position);
});

test('an in-flight camera move restores the original frame, not a midpoint', () => {
  const clock = { t: 0 };
  const h = harness({ claimKey: true, reducedMotion: false, extra: {} });
  const ctrl = createCinematicController(h.host, {
    claimKey: true, reducedMotion: false, window: { addEventListener(type, fn) { h.listeners[type] = fn; }, removeEventListener() {}, matchMedia() { return { matches: false }; } },
    document: h.doc, now: () => clock.t,
    requestFrame(fn) { h.frames.push(fn); return 1; }, cancelFrame() {},
  });
  const before = h.host.read();
  ctrl.enter();
  clock.t = 100;
  h.frames[0]();
  assert.ok(h.host.read().position[0] !== before.position[0]);
  ctrl.exit();
  assert.deepEqual(h.host.read(), before);
});

test('game camera adapter stays unavailable without GX.camMode', () => {
  const missing = tryGameAdapter(undefined, undefined);
  assert.equal(missing.available, false);
  assert.match(missing.reason, /pending/);
  assert.equal(missing.contract.f1.includes('Not bound'), true);
  let pumps = 0;
  const g = {
    cam: { position: { x: 1, y: 2, z: 3, set(x, y, z) { this.x = x; this.y = y; this.z = z; } } },
    ctl: { target: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, enabled: true, update() {} },
    pumps: () => { pumps += 1; },
  };
  let modeCalls = 0;
  const gx = { camMode() { modeCalls += 1; } };
  const found = tryGameAdapter(gx, g);
  assert.equal(found.available, true);
  const snap = found.host.read();
  found.host.write({ ...snap, position: [4, 5, 6], controlsEnabled: false });
  found.host.write(snap);
  assert.deepEqual([g.cam.position.x, g.cam.position.y, g.cam.position.z], [1, 2, 3]);
  assert.equal(g.ctl.enabled, true);
  assert.equal(modeCalls, 0);
  assert.equal(pumps, 0);
  assert.equal(finite(snap.position[0]), true);
});
