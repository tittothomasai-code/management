import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSurveyTracker, reportSurveyStations} from '../drilling/opsnow_survey_alert.mjs';
const station = (md, extra = {}) => ({uid: 's' + md, md, inc: 72, azi: 125, ...extra});
const receipt = (tracker, stations, scope = 'SIM/WB1', source = 'witsml') => tracker.observe({scope, source, stations});
test('initial history and unchanged polls are quiet; a new batch produces one receipt', () => {
  const tracker = createSurveyTracker(), old = [station(100), station(113)];
  assert.equal(receipt(tracker, old), null);assert.equal(receipt(tracker, old), null);
  const event = receipt(tracker, [...old, station(139), station(126), station(139)]);
  assert.equal(event.count, 2);assert.equal(event.latest.md, 139);
  assert.equal(receipt(tracker, [...old, station(126), station(139)]), null);
});
test('backfill, corrections, projections and invalid readings do not announce new surveys', () => {
  const tracker = createSurveyTracker();receipt(tracker, [station(113)]);
  assert.equal(receipt(tracker, [station(100), station(113, {inc: 75}), station(126, {type: 'projected'}), station(139, {inc: null}), station(152, {azi: NaN})]), null);
});
test('measurement timestamps permit a new survey at the same or shallower depth; old timed data stays quiet', () => {
  const tracker = createSurveyTracker();receipt(tracker, [station(113, {t: '2026-11-17T02:00:00Z'})]);
  assert.equal(receipt(tracker, [station(200, {t: '2026-11-17T01:00:00Z'})]), null);
  const event = receipt(tracker, [station(100, {uid: 'new-measurement', t: '2026-11-17T02:10:00Z'})]);
  assert.equal(event.latest.md, 100);assert.equal(receipt(tracker, [event.latest]), null);
});
test('first survey after an empty baseline alerts; failed reads neither reset nor consume the baseline', () => {
  const tracker = createSurveyTracker();receipt(tracker, []);receipt(tracker, null);
  assert.equal(receipt(tracker, [station(13)]).count, 1);
  receipt(tracker, null);assert.equal(receipt(tracker, [station(13)]), null);
  assert.equal(receipt(tracker, [station(26)]).latest.md, 26);
});
test('well, wellbore and feed scopes do not leak receipt state into each other', () => {
  const tracker = createSurveyTracker();receipt(tracker, [station(100)], 'SIM-A/WB1');
  assert.equal(receipt(tracker, [station(900)], 'SIM-B/WB1'), null);
  assert.equal(receipt(tracker, [station(200)], 'SIM-A/WB2'), null);
  assert.equal(receipt(tracker, [station(113)], 'SIM-A/WB1').count, 1);
  assert.equal(receipt(tracker, [station(100)], 'SIM-A/WB1', 'reports'), null);
});
test('report provenance suppresses repeated generated files and interpolated joints from the same reports', () => {
  const report = entries => ({status: 'ok', meta: {generated: 'changed on every write'}, entries});
  const row = (md, source) => ({md, inc: 72, azi: 125, status: 'interpolated', report: source, reportTime: ''});
  const tracker = createSurveyTracker(), first = reportSurveyStations(report([row(100, 'SIM report A'), row(113, 'SIM report A')]));
  assert.equal(first.length, 1);receipt(tracker, first, 'SIM/WB1', 'reports');
  assert.equal(receipt(tracker, reportSurveyStations(report([row(126, 'SIM report A')])), 'SIM/WB1', 'reports'), null);
  const next = reportSurveyStations(report([row(126, 'SIM report A + SIM report B'), row(139, 'SIM report B')]));
  const event = receipt(tracker, next, 'SIM/WB1', 'reports');assert.equal(event.count, 1);assert.equal(event.latest.md, 139);
  assert.equal(receipt(tracker, reportSurveyStations(report([row(139, 'SIM report C')])), 'SIM/WB1', 'reports').count, 1);
});
test('missing and mismatched report data cannot produce a receipt', () => {
  assert.equal(reportSurveyStations(null), null);assert.equal(reportSurveyStations({status: 'other-well'}), null);
  assert.deepEqual(reportSurveyStations({status: 'ok', entries: [{md: 100, inc: null, azi: null, status: 'no survey', report: 'SIM ignored'}]}), []);
});
