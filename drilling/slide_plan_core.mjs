// Advisory next-joint slide plan. Pure geometry; no network, rig control or model.
// The output is ADVISORY – UNCALIBRATED – NOT A RIG INSTRUCTION. It never invents a target,
// motor yield, joint length or survey: each missing input is named instead.
export const SLIDE_PLAN_VERSION = 'slide-plan/1';
export const ADVISORY_LABEL = 'ADVISORY – UNCALIBRATED – NOT A RIG INSTRUCTION';
const D = Math.PI / 180, fin = x => typeof x === 'number' && Number.isFinite(x);
const unit = (inc, azi) => [Math.sin(inc * D) * Math.cos(azi * D), Math.sin(inc * D) * Math.sin(azi * D), Math.cos(inc * D)]; // N, E, down
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const wrap = a => ((a % 360) + 360) % 360;
const round = (x, n = 2) => fin(x) ? Math.round(x * 10 ** n) / 10 ** n : null;
export function dogleg(i1, a1, i2, a2) { return Math.acos(Math.max(-1, Math.min(1, dot(unit(i1, a1), unit(i2, a2))))) / D; }
// Toolface of the change from attitude 1 to attitude 2. Gravity (high-side) toolface is
// meaningless near vertical, where the azimuthal (magnetic/grid, per the survey frame) toolface is given instead.
export function requiredToolface(i1, a1, i2, a2, verticalBelowDeg = 3) {
  const t1 = unit(i1, a1), t2 = unit(i2, a2), c = dot(t1, t2), d = t2.map((v, k) => v - c * t1[k]), n = Math.hypot(...d);
  if (n < 1e-9) return {toolface_deg: null, reference: null, reason: 'No attitude change is required'};
  const u = d.map(v => v / n);
  if (i1 < verticalBelowDeg) return {toolface_deg: round(wrap(Math.atan2(u[1], u[0]) / D), 1), reference: 'azimuthal (survey north reference)'};
  const hs = [Math.cos(i1 * D) * Math.cos(a1 * D), Math.cos(i1 * D) * Math.sin(a1 * D), -Math.sin(i1 * D)], rt = [-Math.sin(a1 * D), Math.cos(a1 * D), 0];
  return {toolface_deg: round(wrap(Math.atan2(dot(u, rt), dot(u, hs)) / D), 1), reference: 'gravity (high side)'};
}
const range = (lo, hi) => ({low: round(Math.min(lo, hi)), high: round(Math.max(lo, hi))});
/**
 * planNextJoint({survey, bit_md_m, bit_to_survey_m, target, motor, joint, limits})
 *  survey: last scoped station {md, inc, azi}; bit_md_m: reported bit MD at the connection.
 *  target: {md_m, inc_deg, azi_deg} attitude to reach at md_m (provisional landing/attitude target).
 *  motor: {yield_deg_per_30m, response_low?, response_high?, source}; joint: {length_m?, min_m?, max_m?, source}.
 */
export function planNextJoint({survey, bit_md_m, bit_to_survey_m = null, target = null, motor = null, joint = null, limits = null} = {}) {
  const missing = [], assumptions = ['Rotary build/turn tendency assumed zero', 'Constant-curvature path from the bit attitude to the target attitude'];
  const out = {version: SLIDE_PLAN_VERSION, label: ADVISORY_LABEL, status: 'guidance-unavailable', advisory: true, operational: false,
    bit_md_m: fin(bit_md_m) ? bit_md_m : null, survey_md_m: null, projection_m: null, required_dls_deg_per_30m: null, required_dogleg_deg: null,
    toolface_deg: null, toolface_reference: null, joint_length_m: null, slide_length_m: null, rotate_length_m: null, exceeds_limit: null,
    exceeds_yield: null, missing, assumptions};
  if (!(survey && fin(survey.md) && fin(survey.inc) && fin(survey.azi))) missing.push('Latest scoped survey station (MD, inclination, azimuth)');
  if (!fin(bit_md_m)) missing.push('Reported bit MD at the connection');
  if (!(target && fin(target.md_m) && fin(target.inc_deg) && fin(target.azi_deg))) missing.push('Target attitude and MD in the well steering setup (target.md_m, inc_deg, azi_deg)');
  if (missing.length) return out;
  out.survey_md_m = survey.md;
  // Hold the last survey attitude to the bit; the survey-to-bit lag is disclosed.
  out.projection_m = round(bit_md_m - survey.md);
  if (fin(bit_to_survey_m)) assumptions.push('Documented bit-to-survey offset ' + bit_to_survey_m + ' m; as-run status per steering setup');
  else assumptions.push('Bit-to-survey offset unknown; attitude held from the last survey to the reported bit MD');
  const remaining = target.md_m - bit_md_m;
  if (!(remaining > 0)) { missing.push('Target MD must be ahead of the bit'); return out; }
  const dl = dogleg(survey.inc, survey.azi, target.inc_deg, target.azi_deg), dls = dl / remaining * 30, tf = requiredToolface(survey.inc, survey.azi, target.inc_deg, target.azi_deg);
  Object.assign(out, {status: 'advisory-uncalibrated', required_dogleg_deg: round(dl), required_dls_deg_per_30m: round(dls), toolface_deg: tf.toolface_deg, toolface_reference: tf.reference});
  if (fin(limits?.max_dls_deg_per_30m)) out.exceeds_limit = dls > limits.max_dls_deg_per_30m;
  else missing.push('Reviewed maximum DLS limit');
  const yieldDeg = motor?.yield_deg_per_30m, lo = fin(motor?.response_low) ? motor.response_low : .8, hi = fin(motor?.response_high) ? motor.response_high : 1.2;
  const lenLo = fin(joint?.min_m) ? joint.min_m : fin(joint?.length_m) ? joint.length_m : null, lenHi = fin(joint?.max_m) ? joint.max_m : fin(joint?.length_m) ? joint.length_m : null;
  if (!(fin(yieldDeg) && yieldDeg > 0)) missing.push('Motor yield (deg/30 m at 100% slide) in the well steering setup');
  if (!(fin(lenLo) && fin(lenHi) && lenLo > 0 && lenHi >= lenLo && lenHi <= 40)) missing.push('Next joint length or bounded range in the well steering setup');
  if (!(lo > 0 && hi >= lo && hi <= 2)) missing.push('Valid motor response band');
  if (missing.some(m => /Motor yield|joint length|response band/.test(m))) return out;
  assumptions.push('Motor yield ' + yieldDeg + ' deg/30 m from ' + (motor.source || 'unstated source') + ', response band ×' + lo + '–×' + hi);
  assumptions.push('Joint length ' + (lenLo === lenHi ? lenLo + ' m' : lenLo + '–' + lenHi + ' m') + ' from ' + (joint.source || 'unstated source'));
  // Slide fraction = required DLS / achievable DLS; clipped to the joint.
  const frac = y => Math.min(1, dls / y), sLo = frac(yieldDeg * hi) * lenLo, sHi = frac(yieldDeg * lo) * lenHi;
  out.exceeds_yield = dls > yieldDeg * lo;
  out.joint_length_m = range(lenLo, lenHi);
  out.slide_length_m = range(sLo, sHi);
  out.rotate_length_m = range(Math.max(0, lenLo - Math.min(sHi, lenLo)), Math.max(0, lenHi - sLo));
  return out;
}
