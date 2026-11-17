import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pumpActivity, pumpSample} from '../drilling/opsnow_pumps.mjs';
const now = Date.parse('2026-11-17T02:00:00Z');
const sample = extra => ({value: 600, unit: 'gpm', at: now - 1000, previousAt: now - 11000, indexType: 'time', source: 'SIM time log', ...extra});
const state = s => pumpActivity({signed: true, now, sample: s});
test('fresh, advancing flow gives aggregate ON or OFF without a unit-specific threshold', () => {
  assert.equal(state(sample()).state, 'on');assert.equal(state(sample({value: 0})).state, 'off');
  assert.equal(state(sample({value: 1, unit: 'L/s'})).state, 'on');
});
test('stale flow is UNKNOWN at the two-minute boundary, even when its last value was zero', () => {
  assert.equal(state(sample({at: now - 119999, previousAt: now - 130000})).state, 'on');
  assert.equal(state(sample({at: now - 120000, previousAt: now - 130000})).state, 'unknown');
  assert.equal(state(sample({value: 0, at: now - 120000, previousAt: now - 130000})).state, 'unknown');
});
test('depth samples and carried-forward blanks cannot claim a current pump state', () => {
  for (const value of [0, 600]) assert.equal(state(sample({value, indexType: 'depth'})).state, 'unknown');
  assert.equal(state(sample({blankLatest: true})).state, 'unknown');
});
test('missing, invalid, future and nonadvancing samples stay UNKNOWN; signed-out state is quiet', () => {
  for (const s of [null, sample({value: NaN}), sample({value: -1}), sample({at: now + 1000}), sample({previousAt: now}), sample({previousAt: undefined})]) assert.equal(state(s).state, 'unknown');
  assert.equal(pumpActivity({signed: false, now, sample: sample()}).state, 'unknown');
});
test('sample extraction retains source time, reported units and blank-latest provenance', () => {
  const s = pumpSample({rows: [[now - 10000, 600], [now, '']], channel: {unit: 'gpm'}, latest: {v: 600, at: now - 10000, blankLatest: true}, time: true, source: 'SIM secondary log'});
  assert.equal(s.value, 600);assert.equal(s.unit, 'gpm');assert.equal(s.blankLatest, true);
  assert.equal(state(s).state, 'unknown');
  assert.equal(pumpSample({rows: [], channel: null, latest: null}), null);
});
