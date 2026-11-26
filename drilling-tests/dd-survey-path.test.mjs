import test from 'node:test';
import assert from 'node:assert/strict';
import * as dd from '../drilling/ddrun.js';
import { minCurve, vec } from '../drilling/ddcab_core.js';
import { TRACKS } from '../drilling/ddtracks_data.js';
import { SurveyPath, pathPoint } from '../drilling/dd_survey_path.mjs';

const tie = { md: 300, E: 120, N: -50 };
const survey = (md, inc, azi, tvd) => ({ md, inc, azi, tvd, src: 'SIM' });
const first = survey(300, 20, 355, 270),
  second = survey(330, 24, 3, 297.7),
  third = survey(360, 22, 4, 325.2);
const path = (start = first) => new SurveyPath(tie, start, 30);
const xyz = (p) => [p.E, p.N, p.tvd];
const near = (a, b, tol = 1e-7) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}, tolerance ${tol}`);

test('original observations and reported TVD remain immutable; only E/N are survey-derived', () => {
  const a = Object.freeze({ ...first }),
    b = Object.freeze({ ...second }),
    m = path(a);
  m.addSurvey(b);
  const computed = minCurve({ ...a, ...tie }, b.md, b.inc, b.azi),
    anchor = m.anchors[1];
  assert.deepEqual({ ...a }, first);
  assert.deepEqual({ ...b }, second);
  for (const k of ['md', 'inc', 'azi', 'tvd']) assert.equal(anchor[k], b[k]);
  assert.equal(anchor.E, computed.E);
  assert.equal(anchor.N, computed.N);
  assert.notEqual(anchor.tvd, computed.tvd);
  assert.deepEqual(xyz(pathPoint(m.segments[0], 330, 'reference')), xyz(computed));
  assert.deepEqual(xyz(pathPoint(m.segments[0], 330)), xyz(anchor));
  assert.equal(anchor.src, 'SIM');
  assert.equal(Object.hasOwn(b, 'E'), false);
});

test('Robotyx reconstruction hits both anchors and is tangent-continuous across surveys', () => {
  const m = path();
  for (let i = 300; i < 360; i++) {
    const slide = i % 30 < 12;
    m.record(i, i + 1, slide ? 'slide' : 'rotate', slide ? 90 : null, 5);
    if (i === 329) m.addSurvey(second);
  }
  m.addSurvey(third);
  assert.equal(m.segments.length, 2);
  for (const seg of m.segments) {
    assert.equal(seg.slide, 12);
    assert.equal(seg.rotate, 18);
    assert.deepEqual(xyz(pathPoint(seg, seg.a.md)), xyz(seg.a));
    assert.deepEqual(xyz(pathPoint(seg, seg.b.md)), xyz(seg.b));
    assert.equal(pathPoint(seg, seg.b.md + 0.1), null);
  }
  const h = 0.0002,
    l = m.segments[0],
    r = m.segments[1];
  const left = xyz(pathPoint(l, 330 - h)),
    middle = xyz(m.anchors[1]),
    right = xyz(pathPoint(r, 330 + h));
  vec(second.inc, second.azi).forEach((v, k) => {
    near((middle[k] - left[k]) / h, v, 0.00002);
    near((right[k] - middle[k]) / h, v, 0.00002);
  });
});

test('mode, depth and effective toolface alter the interior only; missing or conflicting coverage falls back', () => {
  const create = (legs) => {
    const m = path();
    for (const leg of legs) m.record(...leg);
    m.addSurvey(second);
    return m.segments[0];
  };
  const input = [
    [300, 313, 'slide', 75, 5],
    [313, 330, 'rotate', null, 5]
  ];
  const good = create(input),
    reverse = create([
      [300, 317, 'rotate', null, 5],
      [317, 330, 'slide', 75, 5]
    ]);
  const otherTf = create([[300, 313, 'slide', 295, 5], input[1]]);
  for (const seg of [reverse, otherTf]) {
    assert.deepEqual(xyz(seg.b), xyz(good.b));
    assert.notDeepEqual(xyz(pathPoint(seg, 315)), xyz(pathPoint(good, 315)));
  }
  const empty = create([]);
  for (const rows of [
    [input[0]],
    [input[1], input[0]],
    [input[0], input[0], input[1]],
    [[300, 330, 'slide', null, 5]],
    [[300, 330, 'connection', null, 0]],
    [[300, 330, 'slide', 45, NaN]]
  ]) {
    const fallback = create(rows);
    assert.equal(fallback.slide, undefined);
    assert.deepEqual(xyz(pathPoint(fallback, 315)), xyz(pathPoint(empty, 315)));
  }
});

test('vertical, near vertical, horizontal, tangent and north wrap use finite short arcs', () => {
  for (const [i1, a1, i2, a2] of [
    [0, 0, 0, 277],
    [0.001, 15, 0.01, 359],
    [90, 359, 90, 1],
    [90, 90, 90, 90],
    [92, 4, 88, 360]
  ]) {
    const a = survey(300, i1, a1, 200);
    const ref = minCurve({ ...a, ...tie }, 330, i2, a2);
    const m = path(a);
    m.addSurvey(survey(330, i2, a2, ref.tvd));
    const seg = m.segments[0];
    for (let md = 300; md <= 330; md += 0.5) assert.ok(xyz(pathPoint(seg, md)).every(Number.isFinite));
    if (a1 === 359) {
      const p = pathPoint(seg, 315);
      near(p.N, tie.N + 15, 0.01);
      near(p.E, tie.E, 0.2);
    }
    if (i1 === 0 && i2 === 0) {
      const p = pathPoint(seg, 315);
      near(p.E, tie.E);
      near(p.tvd, 215);
    }
  }
});

test('duplicates, reversed MD, missing stands, invalid observations and singular directions never bridge', () => {
  for (const [bad, why] of [
    [{ ...second, azi: 7 }, /Conflicting/],
    [first, /reordered/],
    [{ ...third, md: 390 }, /gap/],
    [{ ...third, tvd: 999 }, /TVD/],
    [{ ...third, inc: null }, /Invalid/],
    [{ ...third, src: 'LIVE' }, /Invalid/],
    [{ ...third, inc: 156, azi: 183 }, /opposite/]
  ]) {
    const m = path();
    m.addSurvey(second);
    m.addSurvey({ ...second });
    assert.equal(m.duplicates, 1);
    m.addSurvey(bad);
    m.addSurvey(third);
    assert.match(m.issue, why);
    assert.equal(m.segments.length, 1);
    assert.equal(m.anchors.length, 2);
  }
  for (const origin of [
    { md: 300, E: null, N: 0 },
    { md: 333, E: 0, N: 0 }
  ]) {
    const m = new SurveyPath(origin, first, 30);
    m.addSurvey(second);
    assert.equal(m.anchors.length, 0);
    assert.match(m.issue, /tie-in/);
  }
});

test('gamma appears at accepted detector MD only and cannot affect curve position', () => {
  const m = path();
  m.addSurvey(second);
  const before = xyz(pathPoint(m.segments[0], 314));
  const gamma = {
    packet: { sensorMd: 314, bitMd: 320, gamma: 76 },
    md: 314,
    mean: 72,
    half95: 9,
    updated: true
  };
  m.addGamma({ ...gamma, md: 315 });
  assert.equal(m.gamma.length, 0);
  m.addGamma(gamma);
  m.addGamma(gamma);
  assert.equal(m.gamma.length, 1);
  assert.equal(m.gamma[0].md, 314);
  assert.equal(m.gamma[0].mean, 72);
  m.addGamma({
    ...gamma,
    md: 315,
    packet: { ...gamma.packet, sensorMd: 315 },
    updated: false,
    status: 'Incompatible drilling mode'
  });
  assert.equal(m.gamma[1].mean, null);
  assert.equal(m.gamma[1].raw, 76);
  assert.deepEqual(xyz(pathPoint(m.segments[0], 314)), before);
  assert.equal(pathPoint(m.segments[0], 336), null);
});

test('fractional acquisition MD stays exact; rounding a survey never relocates a gamma sample', () => {
  const m = new SurveyPath({ ...tie, md: 300.035 }, first, 30);
  m.record(300.035, 330.035, 'rotate', null, 0);
  m.addSurvey(second);
  assert.equal(m.segments[0].slide, undefined);
  const md = 315.035;
  m.addGamma({ packet: { sensorMd: md, bitMd: md + 6, gamma: 71 }, md, mean: 70, half95: 6, updated: true });
  assert.equal(m.gamma[0].md, md);
  assert.equal(pathPoint(m.segments[0], m.gamma[0].md).md, md);
});

test('all track tie-ins and first anchors align in game coordinates; tracks share no observations', () => {
  for (const track of TRACKS) {
    const run = dd.newRun({ plan: track.plan, seed: 55 });
    const m = run.surveyPath;
    const origin = track.plan.find((p) => p.md === run.surveys[0].md);
    assert.equal(m.tie.E, origin.E);
    assert.equal(m.tie.N, origin.N);
    assert.equal(m.gamma.length, 0);
    dd.drill(run, 30);
    assert.equal(m.issue, '');
    assert.equal(m.anchors.length, 2);
    assert.equal(m.segments.length, 1);
    for (const k of ['md', 'inc', 'azi', 'tvd']) assert.equal(m.anchors[1][k], run.surveys[1][k]);
    assert.equal(m.segments[0].slide, 20);
  }
});

test('pickup, stall and replay do not add surveyed distance; reset and switching wells clear geometry', () => {
  const a = dd.load({ seed: 49, name: 'A' });
  dd.drill(a, 36);
  const saved = structuredClone(a.surveyPath.anchors);
  const depth = a.bit.md,
    n = a.surveyPath.pending.length;
  a.set.wob = 0;
  dd.drill(a, 4);
  assert.equal(a.bit.md, depth);
  a.set.wob = 39;
  dd.drill(a, 4);
  assert.equal(a.bit.md, depth);
  assert.deepEqual(a.surveyPath.anchors, saved);
  assert.equal(a.surveyPath.pending.length, n);
  const replay = dd.load({ seed: 49, name: 'A' });
  dd.drill(replay, 36);
  assert.deepEqual(replay.surveyPath.anchors, saved);
  assert.deepEqual(replay.surveyPath.segments, a.surveyPath.segments);
  const b = dd.reset({ track: 'new-branch', plan: TRACKS[2].plan });
  assert.equal(b.surveyPath.anchors.length, 1);
  assert.equal(b.surveyPath.pending.length, 0);
  assert.equal(b.surveyPath.segments.length, 0);
  assert.equal(b.surveyPath.gamma.length, 0);
  assert.equal(dd.load({ name: 'B' }).surveyPath.segments.length, 0);
});

test('observing the same drill sequence leaves hidden truth, score, instructions and surveys unchanged', () => {
  const run = dd.newRun({ seed: 19 }),
    control = dd.newRun({ seed: 19 });
  control.surveyPath = { record() {}, addGamma() {}, addSurvey() {} };
  for (const r of [run, control]) {
    dd.drill(r, 21);
    r.set.mode = 'rotate';
    dd.drill(r, 49);
  }
  for (const key of ['bit', 'truth', 'surveys', 'instr', 'rec', 'set', 'hours', 'rop', 'stalls'])
    assert.deepEqual(run[key], control[key]);
  assert.deepEqual(dd.score(run), dd.score(control));
});
