import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {STAND_LENGTH_M, newState, startSeq, seqTick, step, P, postConnectFootage} from '../drilling/physics.js';
import {FUTURE_SKEW_MS, feedSource} from '../drilling/operations_data.js';
import {JOINT_REFERENCE_M, PHYSICAL_JOINT_TOL_M, UNIT_DUPLICATE_M, fallbackInterval, surveyIntervals} from '../drilling/operations_joint_estimates.js';
import {segment} from '../drilling/rtoc_core.js';
import {build, sourceBackedSummary} from '../drilling/rtoc_summary.js';

const root = new URL('../drilling/', import.meta.url);
const text = name => readFileSync(new URL(name, root), 'utf8');

assert.equal(STAND_LENGTH_M, 13);
assert.equal(JOINT_REFERENCE_M, 13);
assert.ok(UNIT_DUPLICATE_M < 1e-4);
assert.ok(PHYSICAL_JOINT_TOL_M > 0.1);
assert.notEqual(UNIT_DUPLICATE_M, PHYSICAL_JOINT_TOL_M);
for (const name of ['physics.js', 'main.js', 'ext2.js']) {
  assert.doesNotMatch(text(name), /27\.[0-9]/, name + ' still has a 27.x m joint length');
}
assert.match(text('main.js'), /STAND_LENGTH_M\/2/);
assert.match(text('ext2.js'), /JOINT_M\+0\.2/);
assert.match(text('ext2.js'), /stickup\+'\+JOINT_M/);
assert.match(text('main.js'), /PH\.STAND_LENGTH_M,mat\.pipe/);
assert.match(text('ext4.js'), /off%STAND_LENGTH_M/);
assert.match(text('rtoc_fixtures.js'), /elevation uom="m" datum="MSL">27\.4</);
assert.match(text('fixtures/runsheet_np045l_rows.js'), /27\.40/);

const versions = {
  'main.js': ['physics.js?v=j13b-20261109', 'ext.js?v=j13b-20261109'],
  'index.html': ['main.js?v=j13b-20261109', 'start.js?v=j13b-20261109'],
  'ext.js': ['ext2.js?v=j13b-20261109'],
  'ext2.js': ['physics.js?v=j13b-20261109', 'ext3.js?v=j13b-20261109'],
  'ext3.js': ['ext4.js?v=j13b-20261109'],
  'ext4.js': ['physics.js?v=j13b-20261109', 'rtoc_summary.js?v=j13b-20261109'],
  'rtoc.js': ['physics.js?v=j13b-20261109', 'rtoc_core.js?v=j13b-20261109', 'rtoc_summary.js?v=j13b-20261109'],
  'rtoc_summary.js': ['rtoc_core.js?v=j13b-20261109'],
  'start.js': ['rtoc.js?v=j13b-20261109', 'operations.js?v=j13b-20261109'],
  'operations.js': ['operations_data.js?v=j13b-20261109', 'rtoc_summary.js?v=j13b-20261109'],
  'operations_data.js': ['operations_joint_estimates.js?v=j13b-20261109'],
};
const esc = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [file, needles] of Object.entries(versions)) {
  const body = text(file);
  for (const needle of needles) assert.match(body, new RegExp(esc(needle)), file + ' missing ' + needle);
}

const st = (md, uom = 'm', wb = 'B', typ = '') => ({nativeMd:md, uom, wb, typ});
const wide = surveyIntervals([st(100), st(200)], 'W', 'B', 'W');
assert.equal(wide.length, 1);
assert.equal(wide[0].jointCount, 'unknown');
assert.equal(wide[0].estimated, true);
assert.notEqual(wide[0].referenceEstimate.verified, true);
assert.ok(wide[0].referenceEstimate.rounded > 1);

const now = 1_700_000_000_000;
const observation = {};
const log = {w:'A', b:'B', uid:'T', indexType:'date time'};
const row = (t, extra = {}) => ({mode:'off', connected:true, log, hist:[{t}], lastRowMs:t, healthy:() => true, ...extra});
const status = (feed, clock = now, cfg = {url:'https://example.com/witsml'}) => feedSource(feed, clock, cfg, observation);
assert.equal(status(row(now - 5000)), 'WITSML WAITING FOR ADVANCE');
assert.equal(status(row(now - 5000)), 'WITSML WAITING FOR ADVANCE');
const live = row(now - 1000);
live.hist = [{t:now - 5000}, {t:now - 1000}];
assert.equal(status(live), 'WITSML LIVE');
assert.notEqual(status({...live, connected:false}), 'SIM');
assert.equal(status({...live, connected:false}), 'WITSML DISCONNECTED');
assert.equal(status(row(now + 3600e3), now), 'WITSML FUTURE');
assert.notEqual(status(row(now + 7200e3), now + 500), 'WITSML LIVE');
assert.equal(FUTURE_SKEW_MS > 0 && FUTURE_SKEW_MS < 1000, true);
assert.equal(status(row(now + 200), now), 'WITSML WAITING FOR ADVANCE');

const contract = JSON.parse(readFileSync(new URL('./fixtures/well-summary-safe.json', import.meta.url), 'utf8'));
const doubled = structuredClone(contract);
doubled.sourceBackedFacts.wellIdentityAndWellbores.push(doubled.sourceBackedFacts.wellIdentityAndWellbores[0]);
const summary = sourceBackedSummary(doubled);
assert.equal(contract._meta.gates.verified, false);
assert.equal(summary.verified, false);
assert.equal(summary.substantiveFactCount, 6);
assert.equal(summary.enoughForTen, false);
assert.match(summary.message, /not enough source-backed data for 10 facts/i);
assert.equal(summary.serverMetadata.length, 4);
assert.equal(summary.facts.some(fact => /Example Store|Adaga|DR101L/.test(String(fact.value))), false);
assert.equal(summary.facts.find(fact => fact.provenance.field === 'name').flag, 'redacted/unverified');
assert.equal(summary.facts.find(fact => fact.provenance.field === 'uid').flag, 'redacted/unverified');
assert.equal(summary.serverMetadata.some(fact => fact.value === 'Example Store'), true);
const fixtureText = readFileSync(new URL('./fixtures/well-summary-safe.json', import.meta.url), 'utf8');
assert.doesNotMatch(fixtureText, /11f2db19|7168c8e0|01M6WZ|DR101L|WB03B01|Adaga/);
assert.equal(summary.facts.some(fact => /formation|sandstone|joint length/i.test(fact.fact + JSON.stringify(fact.value))), false);
assert.equal(summary.survey.status, 'unavailable');
assert.deepEqual(summary.survey.intervals, []);
assert.equal(summary.survey.jointCount, 'unknown');
assert.match(summary.gaps.join(' '), /502/);
assert.match(summary.gaps.join(' '), /504/);
assert.equal(contract.wellboreAssociation.wellbores.length, 7);
assert.equal(contract.surveyDerivedIntervals.surveyIntervals.length, 0);

const empty = build({samples:[], surveys:[]});
assert.ok(empty.facts.length < 10);
assert.match(empty.message, /not enough source-backed data for 10 facts/);
assert.doesNotMatch(empty.copyText, /10 SOURCE-DERIVED FACTS/);

const seg = segment([{t:0, md:100, slips:false}, {t:10, md:105, slips:false}, {t:20, md:200, slips:false, gapBefore:true}, {t:30, md:205, slips:false}]);
assert.equal(seg.length, 2);
assert.equal(seg[0].endMd, 105);
assert.equal(seg[1].startMd, 200);
assert.equal(fallbackInterval(Number.NaN), null);

const footage = postConnectFootage();
assert.ok(footage.slide + footage.rotate < STAND_LENGTH_M / 0.3048);
assert.ok(Math.abs((footage.slide + footage.rotate) * 0.3048 - STAND_LENGTH_M / 2) < 0.05);
const rig = newState();
const lengthBefore = rig.L;
startSeq(rig, 'full');
let minQuill = rig.dw.quill;
for (let i = 0; i < 400000 && rig.seq; i++) {
  step(rig, 0.05);
  seqTick(rig);
  if (rig.dw.quill < minQuill) minQuill = rig.dw.quill;
}
assert.equal(rig.seq, null, 'full sequence finishes');
assert.ok(minQuill >= P.dw.min_quill - 1e-6, 'min quill ' + minQuill);
assert.ok(Math.abs((rig.L - lengthBefore) * 0.3048 - STAND_LENGTH_M) < 0.02);

const changed = [
  'drilling/ext.js', 'drilling/ext2.js', 'drilling/ext3.js', 'drilling/ext4.js', 'drilling/main.js',
  'drilling/operations.js', 'drilling/operations_data.js', 'drilling/operations_joint_estimates.js',
  'drilling/physics.js', 'drilling/rtoc.js', 'drilling/rtoc_core.js', 'drilling/rtoc_summary.js', 'drilling/start.js',
  'drilling-tests/adversarial.mjs', 'drilling-tests/joint_summary_test.mjs',
  'drilling-tests/site/operations_data.js', 'drilling-tests/site/operations_joint_estimates.js', 'drilling-tests/site/rtoc_core.js',
];
for (const file of changed) {
  const parsed = spawnSync(process.execPath, ['--check', file], {encoding:'utf8'});
  assert.equal(parsed.status, 0, file + '\n' + parsed.stderr);
}
console.log('PASS joint, survey estimate, source state, well summary, cache versions, sequence, parse');
