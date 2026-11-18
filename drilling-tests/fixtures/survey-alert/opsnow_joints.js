// opsnow_joints.js: per-joint records for the Joints dashboard. Pure logic, no DOM.
// A joint = hole drilled between two connections seen in the depth log's block height (core.connectionsFromBlock).
// Numbers come from the tally when one is loaded (matched by cumulative depth), else the same estimate as the main screen.
// Time-based figures (drilling time, slips-to-slips, off-bottom, reaming) come only from the time log, and only where it was read.
import * as C from './opsnow_core.js?v=re1115';
import * as A from './opsnow_ac.js?v=re1115';
import * as JS from './opsnow_jsurvey.js?v=re1115';
import * as MVP from './opsnow_mvp.js?v=re1115';
const fin = Number.isFinite;
export const PARAMS = [['rop', 'ROP'], ['wob', 'WOB'], ['rpm', 'RPM'], ['torque', 'Torque'], ['spp', 'SPP'], ['flowIn', 'Flow'], ['gamma', 'Gamma']];
export const FLAG_RULES = {slowRop: 0.6, highTorque: 1.25, longConn: 1.5, longConnMinS: 300};
export const FLAG_NAMES = {slowRop: 'Slow ROP', highTorque: 'High torque', longConn: 'Long connection', dls: 'DLS over limit', ac: 'Anti-collision', window: 'Out of window'};
function stats(rows, col, ch, lo, hi) {
  if (col == null || col < 1) return null; const [i0, i1] = C.sliceByIndex(rows, lo, hi); const vs = [];
  for (let i = i0; i < i1; i++) { const r = rows[i]; if (r[0] < lo - 1e-9 || r[0] >= hi - 1e-9) continue; const v = C.value(r[col], ch); if (v != null) vs.push(v); }
  if (!vs.length) return null; const avg = vs.reduce((a, b) => a + b, 0) / vs.length; vs.sort((a, b) => a - b);
  return {avg, max: vs[Math.min(vs.length - 1, Math.floor(vs.length * 0.98))], peak: vs.at(-1), n: vs.length}; // max = 98th percentile (single-row spikes at connections excluded)
}
// Joint numbering: tally first (the joint picked up at each connection), else estimate (joints above the first seen connection + count).
export function numbering(conns, median, tally) {
  const cmp = tally?.joints?.length ? C.compareTally(tally, conns, null) : null;
  const est = median ? C.estimateSequence(conns, median, tally?.bhaLen) : []; // same estimate as the ops joint card (opsnow_core.jointNumber)
  return conns.map((c, i) => { const t = cmp?.rows[i]; if (t?.nextJoint != null) return {n: t.nextJoint, kind: 'tally', tallyLen: t.tallyLen, cumDiff: t.cumDiff};
    return {n: est[i] ?? null, kind: 'estimated'}; });
}
// ---------- time log: activity per row ----------
// states: drilling (bit on bottom and hole deepening), slips (hookload at block weight), reaming (off bottom, pumps on, bit moving),
// offbottom (any other off-bottom time). Hole depth from the time log = running max of bit depth.
export function timeActivity(trows, tmap) {
  const bd = tmap?.bd, hk = tmap?.hkl, fl = tmap?.flowIn, tq = tmap?.torque; if (!bd || !trows?.length) return null;
  const out = []; let hole = -Infinity; const hv = [];
  for (const r of trows) { const v = C.value(r[hk?.col], hk); if (v != null) hv.push(v); }
  hv.sort((a, b) => a - b); const q = f => hv.length ? hv[Math.min(hv.length - 1, Math.floor(f * hv.length))] : null;
  const low = q(0.03), high = q(0.6), thr = low != null && high != null && high - low > 5 ? low + (high - low) * 0.3 : null;
  let prevBd = null;
  for (const r of trows) {
    const b = C.value(r[bd.col], bd); if (b == null) continue; const deep = b > hole + 0.02; if (b > hole) hole = b;
    const h = C.value(r[hk?.col], hk), f = C.value(r[fl?.col], fl), t = C.value(r[tq?.col], tq);
    const onB = b >= hole - 0.3; let st;
    if (thr != null && h != null && h < thr) st = 'slips';
    else if (onB && (deep || (prevBd != null && b >= prevBd - 0.01 && (f ?? 0) > 50))) st = 'drilling';
    else if (!onB && (f ?? 0) > 50 && prevBd != null && Math.abs(b - prevBd) > 0.005 && (t ?? 0) > 0.5) st = 'reaming';
    else st = onB ? 'onbottom' : 'offbottom';
    out.push({t: r[0], bd: b, hole, hkl: h, fl: f, st}); prevBd = b;
  }
  return {rows: out, slipsThr: thr, from: out[0]?.t ?? null, to: out.at(-1)?.t ?? null};
}
// Time-based figures for a joint [start, end): drilling time, the connection that started it (slips-to-slips) and activity minutes.
export function jointTime(act, start, end, isCurrent) {
  if (!act?.rows.length) return null; const R = act.rows;
  const iA = R.findIndex(r => r.hole >= start - 0.05); if (iA < 0) return {covered: false};
  if (iA === 0 && R[0].hole > start + 0.5) return {covered: false};
  let iB = end != null ? R.findIndex((r, i) => i > iA && r.hole >= end - 0.05) : -1; if (iB < 0) { if (!isCurrent && end != null) return {covered: false, partial: true}; iB = R.length - 1; }
  // connection = the gap after the hole reached start until drilling resumes beyond it; slips-to-slips = first..last in-slips row in it
  let iR = R.findIndex((r, i) => i > iA && r.hole > start + 0.15); if (iR < 0) iR = iB;
  let s0 = null, s1 = null; for (let i = iA; i <= iR; i++) if (R[i].st === 'slips') { if (s0 == null) s0 = R[i].t; s1 = R[i].t; }
  const mins = {drilling: 0, onbottom: 0, slips: 0, reaming: 0, offbottom: 0};
  for (let i = iA + 1; i <= iB; i++) { const dt = Math.min(60, (R[i].t - R[i - 1].t) / 1000); mins[R[i].st] += dt / 60; }
  return {covered: true, tStart: R[iA].t, tEnd: R[iB].t, tResume: R[iR].t, drillS: (R[iB].t - R[iR].t) / 1000, connS: s0 != null ? (s1 - s0) / 1000 + 1 : null, slipsIn: s0, slipsOut: s1, mins, live: isCurrent && iB === R.length - 1};
}
// ---------- all joints ----------
// inp: {rows, map, conns, holeMd, bitMd, fe, surveys, tally, branches, active, ac, winAt, act, t (AC settings)}
export function buildJoints(inp) {
  const {rows = [], map = {}, conns = [], holeMd, fe, surveys = [], tally, branches, active, ac, winAt, act} = inp, t = inp.t || A.getSettings();
  if (!conns.length || !rows.length) return {list: [], well: {}, median: null};
  const JJ = C.joints(conns, holeMd), median = JJ.median, nums = numbering(conns, median, tally);
  const fem = fe?.ml ? {gamma: {col: fe.ml.findIndex(m => /^GMAVG$/i.test(m)), nullValue: ''}} : {};
  const ref = branches?.find(b => b.name === active), path = ref?.path, diverged = {}; for (const r of ac?.rows || []) if (r.parentLine) diverged[r.name] = Boolean(r.diverged);
  const list = conns.map((c, i) => {
    const next = conns[i + 1], cur = !next, end = next ? next.md : null, top = cur ? holeMd : end, nb = nums[i];
    const expLen = nb.tallyLen ?? median, projEnd = fin(expLen) ? c.md + expLen : null;
    const j = {i, n: nb.n, numKind: nb.kind, start: c.md, end, current: cur, projEnd, length: fin(top) ? top - c.md : null, expLen, correction: end != null && projEnd != null ? end - projEnd : null,
      progress: cur && fin(top) && expLen ? Math.min(1.5, (top - c.md) / expLen) : null, p: {}};
    for (const [k] of PARAMS) { const ch = k === 'gamma' ? fem.gamma : map[k]; const src = k === 'gamma' ? fe?.rows : rows; j.p[k] = src && ch && ch.col > 0 ? stats(src, ch.col, ch, c.md, fin(top) ? top + (cur ? 1e-6 : 0) : c.md) : null; }
    const sv = surveys.filter(s => s.md >= c.md - 1e-6 && s.md < (top ?? c.md) + (cur ? 1e-6 : 0)); j.survey = sv.at(-1) || null; j.surveys = sv; j.surveyAbove = j.survey ? null : [...surveys].reverse().find(s => s.md < c.md) || null;
    j.sv = JS.resolve(j, inp.reportSurveys, holeMd); // per-joint survey: report (interpolated) → WITSML station in joint → no survey; never carried down
    { // model vs plan at the joint's end MD (or the model's own MD when only a report survey covers it)
      const mPath = path?.length ? path : MVP.tiePath(surveys);
      const endMd = fin(top) ? top : c.md, m = MVP.modelAt(endMd, mPath, j.sv);
      j.mvpPlan = inp.plan || null;
      j.mvp = MVP.compare(m?.md ?? endMd, m, inp.plan || null, m && fin(m.n) ? MVP.seamOf(winAt, m) : null);
    }
    j.dlsMax = sv.length ? Math.max(...sv.map(s => s.dls).filter(fin), -Infinity) : null; if (!fin(j.dlsMax)) j.dlsMax = null;
    // anti-collision over the joint: points along the active path every ~2 m
    if (path && branches && fin(top) && top > c.md && top <= (ref.tieMd ?? 0) + 1e-6) j.acNote = 'shared hole above the ' + active + ' kick-off at ' + (ref.tieMd ?? 0).toFixed(1) + ' m (not compared)';
    else if (path && branches && fin(top) && top > c.md) {
      const pts = [{md: c.md - 1, n: 0, e: 0, tvd: 0}]; for (let m = c.md; m <= top + 1e-6; m += Math.max(2, (top - c.md) / 6)) { const p = C.interpAt(cur && inp.bitPos && m > (path.at(-1)?.md ?? 0) ? [...path, inp.bitPos] : path, m); if (p) pts.push({...p, md: m, ahead: +(m - c.md).toFixed(1)}); }
      const sc = pts.length > 1 ? A.scanAhead(pts, branches, active, t, diverged) : null;
      j.ac = sc?.minCc ? {cc: sc.minCc.cc, ccName: sc.minCc.name, ccMd: sc.minCc.md, sf: sc.minSf.sf, sfName: sc.minSf.name, sfMd: sc.minSf.md, dist: A.distLevel(sc.minCc.cc, t), sfL: A.sfLevel(sc.minSf.sf, t)} : null;
      const endP = C.interpAt(cur && inp.bitPos ? [...path, inp.bitPos] : path, top); const w = endP && winAt ? winAt(endP) : null; j.window = w?.filter(x => x.kind === 'window' && x.state) || null;
    }
    j.time = act ? jointTime(act, c.md, end, cur) : null;
    return j;
  });
  // well averages: over every row from the first connection to the hole
  const well = {}; const lo = conns[0].md, hi = (holeMd ?? conns.at(-1).md) + 1e-6;
  for (const [k] of PARAMS) { const ch = k === 'gamma' ? fem.gamma : map[k]; const src = k === 'gamma' ? fe?.rows : rows; well[k] = src && ch && ch.col > 0 ? stats(src, ch.col, ch, lo, hi) : null; }
  const conn = list.map(j => j.time?.connS).filter(fin).sort((a, b) => a - b); well.connS = conn.length ? conn[Math.floor(conn.length / 2)] : null;
  // baseline for the ROP/torque flags: median of the previous 10 completed joints (≥ 3), so a lateral is not judged against the vertical
  const med = a => { const v = a.filter(fin).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
  for (const j of list) { const prev = list.slice(Math.max(0, j.i - 10), j.i).filter(q => !q.current); j.base = prev.length >= 3 ? Object.fromEntries(PARAMS.map(([k]) => [k, med(prev.map(q => q.p[k]?.avg))])) : null; }
  for (const j of list) j.flags = flagsOf(j, well, t);
  return {list, well, median};
}
export function flagsOf(j, well, t = A.getSettings()) {
  const f = [], full = !j.current || (j.length ?? 0) > 3;
  const bR = j.base?.rop ?? well.rop?.avg, bT = j.base?.torque ?? well.torque?.avg;
  if (full && j.p.rop && fin(bR) && j.p.rop.avg < bR * FLAG_RULES.slowRop) f.push('slowRop');
  if (full && j.p.torque && fin(bT) && bT > 0 && j.p.torque.avg > bT * FLAG_RULES.highTorque) f.push('highTorque');
  if (j.time?.connS && well.connS && j.time.connS > Math.max(well.connS * FLAG_RULES.longConn, FLAG_RULES.longConnMinS)) f.push('longConn');
  if (j.dlsMax != null && j.dlsMax > t.dlsLimit) f.push('dls');
  if (j.ac && (A.RANK[j.ac.dist] >= 2 || A.RANK[j.ac.sfL] >= 2)) f.push('ac');
  if (j.window?.some(w => w.state !== 'in')) f.push('window');
  return f;
}
// ---------- navigation: live follows the newest joint; history holds a chosen joint ----------
// state: {live: true} | {live: false, start: <joint start MD>}. Keyed by start MD so it survives renumbering by a tally.
export const liveState = () => ({live: true});
export function current(list) { return list.at(-1) || null; }
export function selected(state, list) { if (!list.length) return null; if (state.live) return current(list); return list.find(j => Math.abs(j.start - state.start) < 1e-6) || current(list); }
export function step(state, list, dir) {
  const s = selected(state, list); if (!s) return state; const k = Math.max(0, Math.min(list.length - 1, s.i + dir));
  return k === list.length - 1 ? liveState() : {live: false, start: list[k].start};
}
export const pick = (list, i) => i >= list.length - 1 ? liveState() : {live: false, start: list[i].start};
// Called when the joint list is rebuilt. A new connection (newest joint start changed) resets the live dashboard to the new joint.
export function onUpdate(prevList, list, state) {
  const a = current(prevList || []), b = current(list); const newJoint = Boolean(a && b && b.start > a.start + 1e-6);
  return {state, newJoint, reset: newJoint && state.live, joint: b};
}
// ---------- CSV ----------
const r1 = (v, d = 1) => fin(v) ? v.toFixed(d) : '';
export const CSV_COLS = ['joint', 'numbering', 'start_md_m', 'end_md_m', 'projected_end_md_m', 'correction_m', 'length_m', 'drilling_time_min', 'connection_slips_to_slips_min',
  'rop_avg_m_h', 'rop_max_m_h', 'wob_avg', 'rpm_avg', 'torque_avg', 'torque_max', 'spp_avg', 'flow_avg', 'gamma_avg_api', 'survey_md_m', 'inc_deg', 'azi_deg', 'survey_tvd_m', 'survey_source', 'dls_deg_30m',
  ...MVP.COLS.map(c => 'mvp: ' + c), 'min_cc_m', 'min_cc_branch', 'dist_risk', 'min_sf', 'min_sf_branch', 'sf_risk', 'window', 'flags', 'current'];
export function toCsv(list) {
  const q = s => /[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s);
  const rows = [...list].reverse().map(j => [j.n ?? '', j.numKind, r1(j.start, 2), r1(j.end, 2), r1(j.projEnd, 2), r1(j.correction, 2), r1(j.length, 2), r1(j.time?.covered ? j.time.drillS / 60 : null), r1(j.time?.connS != null ? j.time.connS / 60 : null),
    r1(j.p.rop?.avg), r1(j.p.rop?.max), r1(j.p.wob?.avg), r1(j.p.rpm?.avg, 0), r1(j.p.torque?.avg), r1(j.p.torque?.max), r1(j.p.spp?.avg, 0), r1(j.p.flowIn?.avg, 0), r1(j.p.gamma?.avg),
    r1(j.sv?.md, 2), r1(j.sv?.inc, 2), r1(j.sv?.azi, 2), r1(j.sv?.tvd, 2), j.sv?.label ?? 'no survey', r1(j.survey?.dls, 2), ...MVP.cols(j.mvp, j.mvpPlan), r1(j.ac?.cc), j.ac?.ccName ?? '', j.ac?.dist ?? '', r1(j.ac?.sf, 2), j.ac?.sfName ?? '', j.ac?.sfL ?? '',
    j.window?.length ? j.window.map(w => w.name + ' ' + w.state).join('; ') : '', j.flags.map(f => FLAG_NAMES[f]).join('; '), j.current ? 'yes' : ''].map(q).join(','));
  return [CSV_COLS.join(','), ...rows].join('\n') + '\n';
}
// ---------- sort / filter for the index ----------
export const SORTS = {n: j => j.n ?? j.i, start: j => j.start, length: j => j.length, drill: j => j.time?.drillS, conn: j => j.time?.connS, rop: j => j.p.rop?.avg, torque: j => j.p.torque?.avg,
  dls: j => j.dlsMax, cc: j => j.ac?.cc, sf: j => j.ac?.sf, gamma: j => j.p.gamma?.avg};
export function indexRows(list, {sort = 'start', dir = -1, filter = 'all', text = ''} = {}) {
  let L = list.filter(j => filter === 'all' || (filter === 'flagged' ? j.flags.length : j.flags.includes(filter)));
  if (text.trim()) { const s = text.trim(); L = L.filter(j => String(j.n ?? '').startsWith(s) || j.start.toFixed(1).startsWith(s)); }
  const f = SORTS[sort] || SORTS.start; L = [...L].sort((a, b) => { const x = f(a), y = f(b); if (!fin(x) && !fin(y)) return 0; if (!fin(x)) return 1; if (!fin(y)) return -1; return (x - y) * dir; });
  const cur = L.find(j => j.current); return cur ? [cur, ...L.filter(j => j !== cur)] : L; // live joint pinned at the top
}
