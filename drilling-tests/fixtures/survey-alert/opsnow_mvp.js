// opsnow_mvp.js: model vs plan at the same MD, for every per-joint view (Joints, Tally on joints.html and ops.html, Run sheet).
// MODEL = the drilled well: the active wellbore's survey path (minimum curvature, WITSML) interpolated at the MD, or the
// per-joint report survey where the path has not reached that MD yet. Never extrapolated past the last station.
// PLAN = the well plan in this build/device (uploaded or Well plan page) or a WITSML plan trajectory on this wellbore.
// Differences are model − plan. C-C = 3D distance between the model point and the plan point at the same MD (needs N/E on both).
// VS uses the plan's closure azimuth (surface to plan end) for both. Seam position comes from loaded Geosteer roof/floor only.
import * as C from './opsnow_core.js?v=re1115';
import * as WPL from './opsnow_wellplans.js?v=dr1115';
const fin = Number.isFinite, R = Math.PI / 180;
export const NO_PLAN = 'no plan loaded';
export function planOf(x) {
  const p = x?.plan;
  if (!Array.isArray(p) || p.length < 2) return null;
  const path = p.filter(s => fin(s.md)).sort((a, b) => a.md - b.md);
  if (path.length < 2) return null;
  const end = path.at(-1), az = fin(end.n) && fin(end.e) && Math.hypot(end.n, end.e) > 1 ? Math.atan2(end.e, end.n) / R : null;
  return {path, name: x.planName || 'plan', source: x.planSource || 'plan', az, mdMin: path[0].md, mdMax: end.md};
}
const wrap = d => { let v = ((d % 360) + 540) % 360 - 180; return v; };
const vs = (p, az) => fin(p?.n) && fin(p?.e) && fin(az) ? p.n * Math.cos(az * R) + p.e * Math.sin(az * R) : null;
// model point at md: active path (stations up to its last MD), else a report survey value for that joint (no N/E)
// dr101l-plan-1115: model path from the active wellbore's own stations when no composite path is available yet. Minimum curvature from
// the first station; N/E are placed absolutely only when a bundled well-folder tie matches the first station (else N/E stay null as before).
export function tiePath(svs) {
  if (!svs?.length) return null;
  const st = [...svs].sort((a, b) => a.md - b.md), s0 = st[0], t = WPL.tieAt(s0.md, s0.tvd ?? s0.tvdc);
  if (!t) return st.map(s => ({...s, n: null, e: null, tvd: s.tvd ?? s.tvdc}));
  const mc = C.minCurve(st);
  return mc.map(s => ({...s, n: s.n - mc[0].n + t.n, e: s.e - mc[0].e + t.e, tvd: s.tvd ?? s.tvdc, tie: 'well folder tie ' + t.wellbore}));
}
export function modelAt(md, path, sv) {
  if (!fin(md)) return null;
  if (path?.length && md >= path[0].md - 1e-6 && md <= path.at(-1).md + 1e-6) { const q = C.interpAt(path, md); if (q && !q.extrapolated) return {...q, src: 'survey path (WITSML)'}; }
  if (sv && sv.src !== 'none' && fin(sv.inc)) {
    const q = path?.length && fin(sv.md) && sv.md >= path[0].md - 1e-6 && sv.md <= path.at(-1).md + 1e-6 ? C.interpAt(path, sv.md) : null; // N/E of the station itself when the path covers it
    return {md: sv.md, inc: sv.inc, azi: sv.azi, tvd: sv.tvd, n: fin(q?.n) ? q.n : null, e: fin(q?.e) ? q.e : null, src: sv.src === 'report' ? 'report survey' : 'WITSML station'};
  }
  return null;
}
// One comparison. plan null → {noPlan: true}. MD outside the plan → {outside: true} (plan is not extended).
export function compare(md, model, plan, seam) {
  if (!plan) return {md, noPlan: true, label: NO_PLAN, seam: seam ?? null};
  if (!fin(md) || md < plan.mdMin - 1e-6 || md > plan.mdMax + 1e-6) return {md, outside: true, label: 'MD outside plan (' + plan.mdMin.toFixed(0) + '–' + plan.mdMax.toFixed(0) + ' m)', seam: seam ?? null};
  const p = C.interpAt(plan.path, md);
  const P = {inc: p.inc, azi: p.azi, tvd: p.tvd, vs: vs(p, plan.az), n: p.n, e: p.e};
  if (!model) return {md, plan: P, model: null, label: 'no model at this MD (beyond last survey)', seam: seam ?? null};
  const M = {inc: model.inc, azi: model.azi, tvd: model.tvd, vs: vs(model, plan.az), n: model.n, e: model.e, src: model.src};
  const d = {inc: fin(M.inc) && fin(P.inc) ? M.inc - P.inc : null, azi: fin(M.azi) && fin(P.azi) ? wrap(M.azi - P.azi) : null,
    tvd: fin(M.tvd) && fin(P.tvd) ? M.tvd - P.tvd : null, vs: fin(M.vs) && fin(P.vs) ? M.vs - P.vs : null};
  const cc = fin(M.n) && fin(M.e) && fin(M.tvd) && fin(P.n) && fin(P.e) && fin(P.tvd) ? Math.hypot(M.n - P.n, M.e - P.e, M.tvd - P.tvd) : null;
  return {md, plan: P, model: M, d, cc, hl: hlOf(M, P), seam: seam ?? null};
}
// dr101l-plan-1115: position of the model relative to the plan at the same MD, in the plan's own frame:
// above = +ve when the model is above (shallower than) the plan, right = +ve when right of the plan looking along the plan direction.
export function hlOf(M, P) {
  if (![M?.n, M?.e, M?.tvd, P?.n, P?.e, P?.tvd, P?.inc, P?.azi].every(fin)) return null;
  const i = P.inc * R, a = P.azi * R, t = [Math.sin(i) * Math.cos(a), Math.sin(i) * Math.sin(a), Math.cos(i)];
  const up = [0, 0, -1], k = up[0] * t[0] + up[1] * t[1] + up[2] * t[2]; let u = up.map((x, j) => x - k * t[j]); const nu = Math.hypot(...u); if (nu < 1e-9) return null; u = u.map(x => x / nu);
  const r = [t[1] * u[2] - t[2] * u[1], t[2] * u[0] - t[0] * u[2], t[0] * u[1] - t[1] * u[0]], d = [M.n - P.n, M.e - P.e, M.tvd - P.tvd];
  return {above: d[0] * u[0] + d[1] * u[1] + d[2] * u[2], right: d[0] * r[0] + d[1] * r[1] + d[2] * r[2]};
}
// Seam position from Geosteer window results [{name, kind, state, ...}] at a point; null when no roof/floor is loaded.
export function seamOf(winAt, pt) {
  if (!winAt || !pt || !fin(pt.tvd)) return null;
  try { const w = winAt(pt)?.filter(x => x.kind === 'window' && x.state); if (!w?.length) return null; return w.map(x => x.name + ' ' + x.state + (fin(x.toRoof) ? ' · ' + x.toRoof.toFixed(1) + ' m below roof' : '') + (fin(x.toFloor) ? ' · ' + x.toFloor.toFixed(1) + ' m above floor' : '')).join('; '); } catch { return null; }
}
// Flat columns for exports (same order everywhere).
export const COLS = ['Compare MD m', 'Model source', 'MODEL Inc °', 'PLAN Inc °', 'Δ Inc (model−plan) °', 'MODEL Azi °', 'PLAN Azi °', 'Δ Azi °',
  'MODEL TVD m', 'PLAN TVD m', 'Δ TVD m', 'MODEL VS m', 'PLAN VS m', 'Δ VS m', 'C-C to plan m', 'Seam position', 'Plan', 'Above (+) / below (−) plan m', 'Right (+) / left (−) of plan m'];
const r = (v, d = 2) => fin(v) ? +v.toFixed(d) : '';
export function cols(c, plan) {
  if (!c) return COLS.map(() => '');
  const planName = plan ? plan.name + ' (' + plan.source + ')' : NO_PLAN;
  const seam = c.seam || 'no roof/floor loaded';
  if (c.noPlan) return [r(c.md), '', '', NO_PLAN, '', '', NO_PLAN, '', '', NO_PLAN, '', '', NO_PLAN, '', NO_PLAN, seam, NO_PLAN, '', ''];
  if (c.outside) return [r(c.md), '', '', c.label, '', '', c.label, '', '', c.label, '', '', c.label, '', '', seam, planName, '', ''];
  const M = c.model || {}, P = c.plan || {}, d = c.d || {}, none = c.model ? '' : c.label;
  return [r(c.md), M.src || none, r(M.inc), r(P.inc), r(d.inc), r(M.azi), r(P.azi), r(d.azi), r(M.tvd), r(P.tvd), r(d.tvd), r(M.vs), r(P.vs), r(d.vs), c.cc != null ? r(c.cc) : (c.model ? 'needs model N/E' : ''), seam, planName, c.hl ? r(c.hl.above) : '', c.hl ? r(c.hl.right) : ''];
}
// Compact HTML cell: "M 91.5 · P 90.0 · Δ +1.5"
const f = (v, d) => fin(v) ? v.toLocaleString('en-AU', {minimumFractionDigits: d, maximumFractionDigits: d}) : '—';
const sg = (v, d) => fin(v) ? (v > 0 ? '+' : '') + f(v, d) : '—';
export function cellHtml(c, k, d = 1) {
  if (!c) return '—';
  if (c.noPlan) return '<small class="on-muted">no plan loaded</small>';
  if (c.outside) return '<small class="on-muted">outside plan</small>';
  if (!c.model) return `<small class="mvp-p">P ${f(c.plan?.[k], d)}</small> <small class="on-muted">· no model</small>`;
  return `<small class="mvp-m">M ${f(c.model[k], d)}</small> <small class="mvp-p">P ${f(c.plan[k], d)}</small> <b class="mvp-d">Δ ${sg(c.d?.[k], d)}</b>`;
}
export function ccHtml(c) { if (!c || c.noPlan) return '<small class="on-muted">no plan loaded</small>'; if (c.outside || !c.model) return '—'; return fin(c.cc) ? f(c.cc, 1) + (c.hl ? `<br><small class="mvp-d">${f(Math.abs(c.hl.above), 1)} ${c.hl.above >= 0 ? 'above' : 'below'} · ${f(Math.abs(c.hl.right), 1)} ${c.hl.right >= 0 ? 'right' : 'left'}</small>` : '') : '<small class="on-muted">needs N/E</small>'; }
export function planNote(plan) { return plan ? 'Plan: ' + plan.name + ' · ' + plan.source + ' · ' + plan.mdMin.toFixed(0) + '–' + plan.mdMax.toFixed(0) + ' m MD. M = model (drilled), P = plan, Δ = model − plan, at the same MD.' : 'No plan loaded for this branch: plan columns read "no plan loaded". Load one on the Well plan page or Geosteer tab (or add a plan trajectory in WITSML).'; }
