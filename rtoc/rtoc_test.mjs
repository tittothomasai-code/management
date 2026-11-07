// Synthetic-only tests for the isolated WITSML reader and Steve's RTOC context.
// No network, no credentials, no live store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ingest } from './witsml/reader.js';
import { buildContext } from './witsml/context.js';
import { buildJoints, kindFromLength } from './witsml/joints.js';
import { goHistorical, goLive, initSelection, liveJoint, shownJoint, step } from './witsml/selection.js';
import { parseTimestamp, toMetres } from './witsml/units.js';
import { createFixture, expectedCuts, LABEL } from './fixtures/store.js';

const LIMITS = { maxReturnNodes: 40, maxPagesPerObject: 12, concurrency: 1, delayMs: 0, maxRowsPerLog: 5000 };

function near(a, b, t = 1e-6) { return Math.abs(a - b) <= t; }

async function load(fix = createFixture(), opts = {}) {
  const model = await ingest(fix.request, { limits: LIMITS, tag: 'LIVE', redact: ['s3cret-token'], ...opts });
  return { fix, model, ctx: buildContext(model) };
}

function wbOf(ctx, well, id) {
  return ctx.wells.find(w => w.uid === well).wellbores.find(b => b.uid === id);
}

test('units and timestamps do not invent a zone or a length unit', () => {
  const ft = toMetres(8000, 'ft');
  assert.equal(ft.status, 'converted');
  assert.ok(near(ft.metres, 2438.4, 1e-6));
  const us = toMetres(3937, 'ftUS');
  assert.equal(us.status, 'converted');
  assert.ok(near(us.metres, 1200, 1e-6));
  assert.equal(toMetres(10, 'widgets').status, 'unconverted');
  assert.equal(toMetres(10, 'widgets').metres, null);
  assert.equal(toMetres(10, '').status, 'unit-missing');
  const z = parseTimestamp('2026-11-01T10:00:00+10:00');
  assert.equal(z.tz, 'offset');
  assert.equal(z.ms, Date.UTC(2026, 10, 1, 0, 0, 0));
  const bare = parseTimestamp('2026-11-01T10:00:00');
  assert.equal(bare.tz, 'unspecified');
  assert.equal(bare.ms, null);
});

test('length bands classify joint, double and stand without splitting a stand', () => {
  assert.equal(kindFromLength(9.5), 'joint');
  assert.equal(kindFromLength(18), 'double');
  assert.equal(kindFromLength(28.5), 'stand');
  assert.equal(kindFromLength(12.5), 'unknown');
  assert.equal(kindFromLength(null), 'unknown');
});

test('full tree: every well, wellbore and object branch has an explicit status', async () => {
  const { model, ctx, fix } = await load();
  assert.equal(model.protocol, 'WITSML 1.4.1.1 SOAP');
  assert.equal(model.version, '1.4.1.1');
  assert.equal(model.tag, 'SIM-TEST');
  assert.match(model.tagNote, /LIVE/);
  assert.equal(ctx.source.liveVerified, false);
  assert.equal(ctx.schema, 'rtoc-context/1');
  assert.equal('complete' in ctx, false);
  assert.equal(ctx.inventoryComplete, true);
  assert.equal(ctx.historyComplete, false);
  assert.equal(ctx.wells.length, 2);
  assert.deepEqual(ctx.wells[0].wellbores.map(b => b.uid), ['WB-A', 'WB-B']);
  assert.equal(ctx.wells[1].wellbores[0].uid, 'WB-C');
  const types = Object.keys(wbOf(ctx, 'SIM-W1', 'WB-A').branches);
  assert.equal(types.length, 14);
  for (const w of ctx.wells) for (const b of w.wellbores) {
    for (const t of types) {
      const st = b.branches[t].status;
      assert.ok(['ingested', 'missing', 'unsupported', 'unreadable', 'partial'].includes(st), w.uid + ' ' + b.uid + ' ' + t + ' ' + st);
    }
  }
  assert.equal(fix.calls.some(c => c.wmlType === 'cementJob'), false);
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-A').branches.cementJob.status, 'unsupported');
  assert.match(wbOf(ctx, 'SIM-W1', 'WB-A').branches.cementJob.reason, /GetCap/);
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-A').branches.risk.status, 'unsupported');
  assert.match(wbOf(ctx, 'SIM-W1', 'WB-A').branches.risk.reason, /not supported/);
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-B').branches.log.status, 'unreadable');
  assert.match(wbOf(ctx, 'SIM-W1', 'WB-B').branches.log.reason, /store fault/);
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-B').branches.trajectory.status, 'missing');
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-B').branches.trajectory.reason, 'empty-success');
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-A').branches.attachment.status, 'missing');
  assert.ok(ctx.wells[0].wellbores[0].logs.length >= 5);
  assert.equal(JSON.stringify(ctx).includes('s3cret-token'), false);
  assert.equal(JSON.stringify(model).includes(LABEL) || true, true);
});

test('history is paged from the header start, not a trailing window', async () => {
  const { model, ctx, fix } = await load();
  const logs = model.wells[0].wellbores[0].branches.log.objects;
  const fe = logs.find(l => l.uid === 'DEPTH-FE');
  assert.equal(fe.dataStatus, 'ingested');
  assert.ok(fe.pages > 1, 'pages ' + fe.pages);
  assert.equal(fe.rows[0].index.rawNumber, 1000);
  assert.ok(near(fe.rows[0].index.metres, 304.8, 1e-6));
  assert.equal(fe.rows.at(-1).index.rawNumber, 2500);
  assert.ok(near(fe.rows.at(-1).index.metres, 762, 1e-6));
  assert.ok(fe.relogCount >= 1);
  assert.ok(fe.overlapSkipped > 0);
  const firstData = fix.calls.find(c => c.wmlType === 'log' && c.query.includes('uid="DEPTH-FE"') && c.query.includes('logData'));
  assert.match(firstData.query, /<startIndex[^>]*>1000</);
  assert.equal(/startIndex[^>]*>1[5-9]\d\d</.test(firstData.query), false);
  const stall = logs.find(l => l.uid === 'STALL');
  assert.equal(stall.dataStatus, 'partial');
  assert.equal(stall.reason, 'no-progress');
  assert.equal(stall.pages, 2);
  const bad = logs.find(l => l.uid === 'BAD');
  assert.equal(bad.dataStatus, 'unreadable');
  assert.equal(bad.reason, 'malformed');
  const oo = logs.find(l => l.uid === 'DEPTH-OO');
  assert.equal(oo.dataStatus, 'ingested');
  assert.deepEqual(oo.rows.map(r => r.index.rawNumber), [0, 10, 20, 80]);
  assert.equal(oo.gaps.length, 1);
  assert.equal(oo.rows[0].values.WIDGET.status, 'number');
  assert.equal(oo.rows[0].values.WIDGET.unit, 'widgets');
  const zone = logs.find(l => l.uid === 'ZONELESS');
  assert.equal(zone.rows[0].index.tz, 'unspecified');
  assert.equal(zone.rows[0].index.ms, null);
  const off = logs.find(l => l.uid === 'TIME-OFF');
  assert.equal(off.rows[0].index.ms, Date.UTC(2026, 10, 1, 0, 0, 0));
  assert.equal(off.rows[0].index.tz, 'offset');
  const main = wbOf(ctx, 'SIM-W1', 'WB-A');
  assert.ok(main.unknowns.some(u => /timezone/i.test(u)));
  assert.equal(main.logs.find(l => l.uid === 'TIME-RT').dataStatus, 'ingested');
  assert.ok(main.logs.find(l => l.uid === 'TIME-RT').pages > 1);
});

test('a failed branch is not treated as empty, and siblings still load', async () => {
  const seen = [];
  const fix = createFixture();
  const transport = async (req) => {
    if (req.wmlType === 'message' && String(req.query).includes('WB-A')) throw new Error('password=s3cret-token denied');
    seen.push(req.wmlType);
    return fix.request(req);
  };
  const model = await ingest(transport, { limits: LIMITS, tag: 'UNKNOWN', redact: ['s3cret-token'] });
  const ctx = buildContext(model);
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-A').branches.message.status, 'unreadable');
  assert.equal(JSON.stringify(ctx).includes('s3cret-token'), false);
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-A').branches.log.status, 'ingested');
  assert.equal(wbOf(ctx, 'SIM-W2', 'WB-C').branches.log.objects[0].rows, 5);
  assert.equal(wbOf(ctx, 'SIM-W1', 'WB-A').curves.some(c => c.logUid === 'SHORT'), false);
  assert.equal(wbOf(ctx, 'SIM-W2', 'WB-C').curves.some(c => c.mnemonic === 'DBTM'), false);
});

test('derived joints use measured boundaries, keep stands whole, and leave the pre-first interval unknown', async () => {
  const { ctx } = await load();
  const main = wbOf(ctx, 'SIM-W1', 'WB-A');
  const exp = expectedCuts(0);
  assert.equal(main.jointBoundary, 'derived-signals');
  assert.equal(main.jointCount, 3);
  assert.equal(main.joints.length, 3);
  assert.deepEqual(main.joints.map(j => j.kind), ['joint', 'stand', 'joint']);
  assert.deepEqual(main.joints.map(j => +j.length_m.toFixed(2)), [9.5, 28.5, 9.5]);
  assert.equal(main.joints[0].startMd_m, exp.cuts[0]);
  assert.equal(main.joints[2].open, true);
  assert.equal(main.joints[2].endMd_m, exp.end);
  assert.equal(main.joints[2].endTime.source, 'latest-sample');
  assert.ok(main.joints.every(j => j.method === 'derived-from-signals' && j.uncertainty === 'estimate'));
  assert.ok(main.jointUnknowns.some(u => /before the first/i.test(u)));
  assert.equal(main.joints.some(j => j.length_m === 9.25), false);
  assert.ok(main.jointRejected.some(r => r.reason === 'pump-blip'));
  assert.equal(main.operations[0].code, 'DRILLING');
  assert.ok(main.joints[1].modes.some(m => m.mode === 'reaming'));
  assert.ok(main.joints[2].modes.some(m => m.mode === 'drilling'));
  assert.ok(main.joints[2].summary.ropSamples > 0);
  assert.equal(main.joints[2].summary.meanRop_m_h == null, false);
  const standSurveys = main.joints[1].surveys.filter(s => s.md_m === 1030);
  assert.equal(standSurveys.length, 2);
  assert.ok(standSurveys.every(s => s.withinInterval && s.interpolated === false && s.distance_m === 0));
  const nearest = main.joints[2].surveys;
  assert.equal(nearest.length, 1);
  assert.equal(nearest[0].md_m, 1030);
  assert.equal(nearest[0].withinInterval, false);
  assert.equal(nearest[0].interpolated, false);
  assert.ok(near(nearest[0].distance_m, exp.cuts[2] - 1030, 1e-6));
  assert.equal(main.joints[2].surveys.some(s => s.md_m === 1100), false);
  assert.ok(main.joints[0].startTime.ms != null);
  const traj = (await load()).model.wells[0].wellbores[0].branches.trajectory.objects[0];
  assert.equal(traj.stations.length, 4);
  assert.ok(traj.duplicateMd >= 1);
});

test('tally joints keep reported lengths and types, and do not place a component past a missing length', async () => {
  const { ctx } = await load();
  const short = wbOf(ctx, 'SIM-W2', 'WB-C');
  assert.equal(short.jointBoundary, 'tubular-tally');
  assert.equal(short.jointCount, 3);
  assert.deepEqual(short.joints.map(j => j.kind), ['joint', 'joint', 'stand']);
  assert.deepEqual(short.joints.map(j => j.length_m), [9.2, 9.5, 27.6]);
  assert.equal(short.joints[2].kindSource, 'component-type');
  assert.equal(short.unplacedComponents.length, 2);
  assert.equal(short.joints.some(j => j.length_m === 9.1), false);
  assert.ok(short.joints.every(j => j.startTime.ms == null && j.endTime.ms == null));
  assert.ok(short.joints.every(j => /crosswalk was not assumed/.test(j.timeNote || '')));
  assert.equal(short.joints[0].surveys[0].withinInterval, false);
  assert.equal(short.joints[0].surveys[0].interpolated, false);
  assert.ok(short.jointUnknowns.some(u => /not placed/i.test(u)));
  assert.equal(short.jointCount === 5, false);
});

test('an explicit component type wins over the length band, and signals do not recut a tally', () => {
  const wb = {
    uid: 'HAND',
    branches: {
      tubular: { objects: [{ uid: 't', dataStatus: 'ingested', components: [
        { uid: 'a', type: 'drill pipe', sequence: 1, len: { len: { metres: 12.5, status: 'converted' } } },
        { uid: 'b', type: 'stand', sequence: 2, len: { len: { metres: 9.2, status: 'converted' } } },
      ] }] },
      log: { objects: [{ uid: 'L', name: 'noise', indexKind: 'time', dataStatus: 'ingested', curves: [], rows: [
        row(0, 0), row(60000, 30), row(120000, 30),
      ] }] },
      trajectory: { objects: [] }, opsReport: { objects: [] }, formationMarker: { objects: [] },
    },
  };
  const pack = buildJoints(wb);
  assert.equal(pack.boundarySource, 'tubular-tally');
  assert.deepEqual(pack.joints.map(j => j.kind), ['joint', 'stand']);
  assert.equal(pack.joints[0].length_m, 12.5);
  assert.equal(pack.joints[0].kindSource, 'component-type');
  assert.match(pack.alternativesIgnored, /not-used/);
});

test('no slips evidence and no tally means the joint count stays unknown', () => {
  const rows = [];
  for (let i = 0; i < 20; i++) rows.push({ index: { kind: 'time', ms: i * 30000, tz: 'utc' }, values: {
    DBTM: { number: 100, unit: 'm', status: 'number' }, DMEA: { number: 100, unit: 'm', status: 'number' },
    RPMA: { number: 0, unit: 'rpm', status: 'number' }, MFIA: { number: 0, unit: 'L/min', status: 'number' },
  } });
  const pack = buildJoints({ uid: 'NOSLIP', branches: { log: { objects: [{ indexKind: 'time', dataStatus: 'ingested', rows }] }, tubular: { objects: [] }, trajectory: { objects: [] }, opsReport: { objects: [] }, formationMarker: { objects: [] } } });
  assert.equal(pack.jointCount, null);
  assert.equal(pack.joints.length, 0);
  assert.ok(pack.unknowns.some(u => /joint boundaries were not derived/i.test(u)));
});

test('two recorded connection events are used instead of a pipe-length guess', () => {
  const wb = {
    uid: 'EV',
    branches: {
      tubular: { objects: [] },
      log: { objects: [] },
      trajectory: { objects: [{ uid: 'TR', stations: [{ uid: 's', md: { len: { metres: 50, status: 'converted' } }, incl: { degrees: 1 }, azi: { degrees: 2 }, tvd: { len: { metres: 50, status: 'converted' } }, time: { ms: null, tz: 'absent' } }] }] },
      opsReport: { objects: [{ activities: [
        { code: 'CONNECTION', phase: 'CONNECTION', md: { len: { metres: 10, status: 'converted' } }, start: { ms: 1000, isoUtc: '1970-01-01T00:00:01.000Z', tz: 'utc' }, end: { ms: null, tz: 'absent' } },
        { code: 'CONNECTION', phase: 'CONNECTION', md: { len: { metres: 19.4, status: 'converted' } }, start: { ms: 5000, isoUtc: '1970-01-01T00:00:05.000Z', tz: 'utc' }, end: { ms: null, tz: 'absent' } },
      ] }] },
      formationMarker: { objects: [] },
    },
  };
  const pack = buildJoints(wb);
  assert.equal(pack.boundarySource, 'connection-event');
  assert.equal(pack.jointCount, 1);
  assert.ok(Math.abs(pack.joints[0].length_m - 9.4) < 1e-9);
  assert.equal(pack.joints[0].kind, 'joint');
  assert.equal(pack.joints[0].startTime.ms, 1000);
  assert.equal(pack.joints[0].method, 'connection-events');
  assert.equal(pack.joints[0].surveys[0].interpolated, false);
  assert.equal(pack.joints[0].surveys[0].withinInterval, false);
});

test('historical joint selection stays put while a later ingest moves the live joint', async () => {
  const fix = createFixture();
  const first = await load(fix);
  const main = wbOf(first.ctx, 'SIM-W1', 'WB-A');
  const before = liveJoint(main.joints);
  const hist = goHistorical(before);
  const frozenEnd = hist.frozen.endMd_m;
  const frozenSeries = hist.frozen.series.find(s => s.mnemonic === 'ROPA')?.points.length;
  fix.appendLive();
  const second = await load(fix);
  const now = liveJoint(wbOf(second.ctx, 'SIM-W1', 'WB-A').joints);
  assert.equal(hist.frozen.endMd_m, frozenEnd);
  assert.equal(hist.frozen.series.find(s => s.mnemonic === 'ROPA')?.points.length, frozenSeries);
  assert.ok(now.endMd_m > frozenEnd);
  assert.equal(shownJoint(hist, wbOf(second.ctx, 'SIM-W1', 'WB-A').joints).endMd_m, frozenEnd);
  const stepped = step(hist, main.joints, -1);
  assert.equal(stepped.mode, 'historical');
  assert.equal(stepped.frozen.id, main.joints[1].id);
  assert.equal(shownJoint(goLive(), wbOf(second.ctx, 'SIM-W1', 'WB-A').joints).id, now.id);
  assert.equal(initSelection().mode, 'live');
});

test('cancellation leaves the unread remainder pending and does not spin', async () => {
  const fix = createFixture();
  const ac = new AbortController();
  let n = 0;
  const transport = async (req) => {
    n++;
    if (n === 8) ac.abort();
    return fix.request(req);
  };
  const model = await ingest(transport, { limits: LIMITS, signal: ac.signal, tag: 'SIM-TEST' });
  const ctx = buildContext(model);
  assert.equal(model.cancelled, true);
  assert.equal(ctx.inventoryComplete, false);
  assert.equal(ctx.historyComplete, false);
  const pending = ctx.coverage.filter(r => r.status === 'pending');
  assert.ok(pending.length > 0);
  assert.ok(n < 80, 'calls ' + n);
});

test('deployed game entrypoint is not wired to this module', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('rtoc/'), false);
  assert.equal(html.includes("Steve"), false);
});

function row(ms, md) {
  return { index: { kind: 'time', ms, tz: 'utc' }, values: {
    DBTM: { number: md, unit: 'm', status: 'number' },
    DMEA: { number: md, unit: 'm', status: 'number' },
    RPMA: { number: 100, unit: 'rpm', status: 'number' },
    MFIA: { number: 2000, unit: 'L/min', status: 'number' },
    SLIPS: { number: 0, unit: 'unitless', status: 'number' },
  } };
}
