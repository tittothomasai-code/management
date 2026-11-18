// opsnow_tallyboard.js: per-branch, multi-run tally. Lengths are derived from connections in the
// depth log (labelled derived) until a sheet, import or edit overrides them. Pure logic, no DOM.
import * as C from './opsnow_core.js?v=re1115';
const fin = Number.isFinite;
const idOf = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function derivedRun(conns, holeMd, opt = {}) {
  const bha = (opt.bha || []).map(x => ({...x})); const bhaLen = bha.reduce((a, b) => a + (b.len || 0), 0);
  const startMd = opt.startMd ?? conns?.[0]?.md ?? null;
  const joints = [];
  if (conns?.length) {
    for (let i = 0; i < conns.length; i++) {
      const a = conns[i].md, next = conns[i + 1], cur = !next;
      const end = cur ? holeMd : next.md; if (!fin(a)) continue;
      const len = fin(end) ? end - a : null;
      joints.push({n: (opt.firstN ?? 1) + i, len, start: a, hd: fin(end) ? end : null, cumDepth: fin(end) ? end : null, current: cur, source: 'derived', overridden: false});
    }
  }
  let cum = 0; for (const j of joints) { if (fin(j.len)) cum += j.len; j.cum = cum; }
  return {id: opt.id || idOf(), name: opt.name || 'Run 1', startMd, endMd: joints.filter(j => fin(j.hd)).at(-1)?.hd ?? null, bha, bhaLen, joints, source: 'derived from connections', firstN: opt.firstN ?? 1};
}
export function applyOverrides(run, edits = {}) {
  const out = {...run, bha: (run.bha || []).map(x => ({...x})), joints: (run.joints || []).map(j => ({...j}))};
  if (edits.bha) out.bha = edits.bha.map(x => ({...x})); out.bhaLen = out.bha.reduce((a, b) => a + (b.len || 0), 0);
  if (edits.name) out.name = edits.name;
  const byN = edits.joints || {};
  for (const j of out.joints) {
    const e = byN[j.n] ?? byN[String(j.n)]; if (!e) continue;
    if (e.len != null && fin(+e.len) && Math.abs(+e.len - (j.len ?? NaN)) > 1e-6) { j.len = +e.len; j.source = e.source || 'edit'; j.overridden = true; }
    if (e.n != null && Number(e.n) !== j.n) { j.n = Number(e.n); j.overridden = true; j.source = j.source === 'derived' ? 'edit' : j.source; }
    if (e.hd != null && fin(+e.hd)) { j.hd = +e.hd; j.overridden = true; }
  }
  // recompute running HD from start + lengths when a length was overridden
  let acc = out.startMd;
  for (let i = 0; i < out.joints.length; i++) {
    const j = out.joints[i];
    if (fin(acc) && fin(j.len)) { const expect = acc + j.len; if (j.overridden && j.hd != null && !edits.joints?.[j.n]?.hd) j.hd = expect; else if (j.hd == null) j.hd = expect; acc = j.hd; j.cumDepth = j.hd; }
    else { j.cumDepth = j.hd; if (fin(j.hd)) acc = j.hd; }
  }
  out.endMd = out.joints.filter(j => fin(j.hd)).at(-1)?.hd ?? out.endMd;
  return out;
}
export function applyTallyImport(run, tally) {
  if (!tally?.joints?.length) return run;
  const edits = {joints: {}};
  if (tally.bha?.length) edits.bha = tally.bha;
  for (const t of tally.joints) edits.joints[t.n] = {len: t.len, hd: t.cumDepth, source: 'tally'};
  const out = applyOverrides({...run, startMd: tally.startMd ?? run.startMd}, edits);
  out.source = 'tally import';
  return out;
}
export function toTally(run) {
  let cum = 0; const joints = (run.joints || []).filter(j => fin(j.len)).map(j => { cum += j.len; return {n: j.n, len: j.len, cum, cumDepth: j.cumDepth ?? j.hd, source: j.source, overridden: j.overridden}; });
  return {unit: 'm', bha: run.bha || [], bhaLen: run.bhaLen || 0, startMd: run.startMd, joints, issues: [], source: run.source || 'derived'};
}
// Running total (start MD + sum of completed lengths, or last HD) versus hole MD.
export function reconcile(run, holeMd, tol = 1) {
  // include the joint being drilled (derived length = hole MD − last connection) so the running total is compared to hole MD, not the last connection
  const done = (run.joints || []).filter(j => fin(j.len));
  const sum = done.reduce((a, j) => a + j.len, 0);
  const fromStart = fin(run.startMd) ? run.startMd + sum : null;
  const lastHd = done.at(-1)?.hd ?? run.endMd;
  const vs = fin(fromStart) ? fromStart : lastHd;
  const diff = fin(vs) && fin(holeMd) ? vs - holeMd : null;
  const flag = diff != null && Math.abs(diff) > tol;
  return {holeMd, runTotal: vs, fromStart, lastHd, lengthSum: sum, diff, tol, flag,
    text: !fin(holeMd) ? 'hole MD not in feed' : diff == null ? 'cannot compare' : flag
      ? 'Tally running total ' + vs.toFixed(2) + ' m vs hole MD ' + holeMd.toFixed(2) + ' m · mismatch ' + (diff > 0 ? '+' : '') + diff.toFixed(2) + ' m (limit ' + tol + ' m)'
      : 'Tally running total ' + vs.toFixed(2) + ' m matches hole MD ' + holeMd.toFixed(2) + ' m within ' + tol + ' m'};
}
// Auto-split connections into runs on a trip (hole MD falling, or a long off-bottom gap in the time log).
export function detectRunBreaks(conns, opt = {}) {
  const breaks = []; // index in conns at which a new run starts
  const rows = opt.depthRows || [];
  // Depth index going backwards between successive rows (unusual, but is a trip signature)
  if (rows.length > 2) {
    let prev = rows[0][0];
    for (const r of rows) {
      if (r[0] < prev - 2) {
        const md = prev; const i = conns.findIndex((c, k) => k > 0 && c.md >= md - 0.5);
        if (i > 0 && !breaks.includes(i)) breaks.push(i);
      }
      prev = Math.max(prev, r[0]);
    }
  }
  const act = opt.timeAct?.rows;
  if (act?.length) {
    // a stretch of off-bottom/slips longer than 3 h with bit coming up > 30 m is a trip
    let up0 = null, minBd = null, lastOn = null;
    for (const r of act) {
      const off = r.st === 'offbottom' || r.st === 'slips' || r.st === 'reaming';
      if (!off) { if (up0 != null && minBd != null && lastOn != null && r.t - up0 > 3 * 3600000 && lastOn - minBd > 30) {
        const md = r.hole; const i = conns.findIndex(c => c.md >= md - 0.5); if (i > 0 && !breaks.includes(i)) breaks.push(i);
      } up0 = minBd = lastOn = null; continue; }
      if (up0 == null) { up0 = r.t; lastOn = r.bd; minBd = r.bd; }
      minBd = Math.min(minBd, r.bd);
    }
  }
  // large connection gap (more than 4× median joint) may be a trip if also flagged in opt, but MD-only
  // gaps are usually missed connections, not trips — do not auto-split on them.
  return breaks.sort((a, b) => a - b);
}
export function splitRuns(conns, holeMd, opt = {}) {
  const br = (opt.breaks || detectRunBreaks(conns, opt)).filter(i => i > 0 && i < (conns?.length || 0));
  const cuts = [0, ...br, conns?.length || 0];
  const runs = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const slice = (conns || []).slice(cuts[k], cuts[k + 1]); if (!slice.length) continue;
    const last = k === cuts.length - 2;
    const endMd = last ? holeMd : (conns[cuts[k + 1]]?.md ?? slice.at(-1)?.md);
    runs.push(derivedRun(slice, endMd, {name: 'Run ' + (k + 1), firstN: runs.length ? (runs.at(-1).joints.at(-1)?.n ?? 0) + 1 : (opt.firstN ?? 1), bha: opt.bha, startMd: slice[0]?.md, id: idOf()}));
  }
  if (!runs.length) runs.push(derivedRun(conns, holeMd, {name: 'Run 1', bha: opt.bha, startMd: conns?.[0]?.md, firstN: opt.firstN ?? 1}));
  return runs;
}
export function splitHere(runs, runId, jointN) {
  const i = runs.findIndex(r => r.id === runId); if (i < 0) return runs;
  const r = runs[i], k = r.joints.findIndex(j => j.n === jointN); if (k < 1) return runs;
  const aJ = r.joints.slice(0, k), bJ = r.joints.slice(k);
  const a = {...r, joints: aJ, endMd: aJ.at(-1)?.hd ?? aJ.at(-1)?.start, name: r.name}; const b = derivedRun([], null, {name: r.name + 'b', firstN: bJ[0]?.n, bha: r.bha, startMd: bJ[0]?.start, id: idOf()});
  b.joints = bJ.map(j => ({...j})); b.endMd = bJ.at(-1)?.hd; b.startMd = bJ[0]?.start;
  return [...runs.slice(0, i), a, b, ...runs.slice(i + 1)];
}
export function mergeRuns(runs, aId, bId) {
  const i = runs.findIndex(r => r.id === aId), j = runs.findIndex(r => r.id === bId);
  if (i < 0 || j < 0 || Math.abs(i - j) !== 1) return runs;
  const lo = Math.min(i, j), hi = Math.max(i, j), a = runs[lo], b = runs[hi];
  const merged = {...a, joints: [...a.joints, ...b.joints], endMd: b.endMd, name: a.name};
  return [...runs.slice(0, lo), merged, ...runs.slice(hi + 1)];
}
export function addRun(runs, afterId, opt = {}) {
  const i = afterId ? runs.findIndex(r => r.id === afterId) : runs.length - 1;
  const r = derivedRun([], opt.holeMd, {name: 'Run ' + (runs.length + 1), firstN: opt.firstN ?? 1, bha: opt.bha, startMd: opt.startMd, id: idOf()});
  const at = i < 0 ? runs.length : i + 1;
  return [...runs.slice(0, at), r, ...runs.slice(at)];
}
export const storeKey = (well, branch) => 'opsnow-tally:' + (well || '') + ':' + (branch || '');
export function savedRuns(saved) { return !saved ? [] : Array.isArray(saved) ? saved : (saved.runs || []); }
export function persistShape(runs, manual = false) {
  return {manual: !!manual, runs: (runs || []).map(r => ({id: r.id, name: r.name, startMd: r.startMd, firstN: r.firstN, bha: r.bha, edits: Object.fromEntries((r.joints || []).filter(j => j.overridden).map(j => [j.n, {len: j.len, n: j.n, hd: j.hd, source: j.source}]))}))};
}
export function applyPersisted(runs, saved) {
  const list = savedRuns(saved);
  if (!list.length || !runs?.length) return runs;
  return runs.map((r, i) => {
    const s = list.find(x => x.id === r.id) || list[i]; if (!s) return r;
    return applyOverrides({...r, id: s.id || r.id, name: s.name || r.name, bha: s.bha || r.bha, firstN: s.firstN || r.firstN, bhaLen: (s.bha || r.bha || []).reduce((a, b) => a + (b.len || 0), 0)}, {joints: s.edits || {}});
  });
}
export function buildBoard(conns, holeMd, opt = {}) {
  const pack = opt.saved, list = savedRuns(pack), manual = pack && !Array.isArray(pack) && pack.manual;
  let breaks = [];
  if (manual && list.length) {
    for (const s of list.slice(1)) {
      if (fin(s.startMd) && conns?.length) {
        const i = conns.findIndex(c => Math.abs(c.md - s.startMd) < 0.25);
        if (i > 0 && !breaks.includes(i)) breaks.push(i);
      }
    }
  } else {
    breaks = [...(opt.breaks || detectRunBreaks(conns, opt))];
    for (const s of list.slice(1)) {
      if (fin(s.startMd) && conns?.length) {
        const i = conns.findIndex(c => Math.abs(c.md - s.startMd) < 0.25);
        if (i > 0 && !breaks.includes(i)) breaks.push(i);
      }
    }
  }
  let runs = splitRuns(conns, holeMd, {...opt, breaks});
  runs = applyPersisted(runs, pack);
  for (const s of list) {
    if (runs.some(r => r.id === s.id)) continue;
    if (fin(s.startMd) && conns?.some(c => Math.abs(c.md - s.startMd) < 0.25)) continue;
    runs.push(applyOverrides(derivedRun([], holeMd, {id: s.id, name: s.name, startMd: s.startMd, bha: s.bha, firstN: s.firstN || 1}), {joints: s.edits || {}}));
  }
  return runs;
}
export function toTallyAll(runs) {
  const bha = runs[0]?.bha || []; const joints = [];
  for (const r of runs || []) for (const j of toTally(r).joints) joints.push(j);
  return {unit: 'm', bha, bhaLen: runs[0]?.bhaLen || 0, startMd: runs[0]?.startMd, joints, issues: [], source: runs[0]?.source || 'derived'};
}
export function addJoint(run, opt = {}) {
  const last = (run.joints || []).at(-1);
  const n = opt.n ?? (last?.n ?? (run.firstN || 1) - 1) + 1;
  const start = opt.start ?? last?.hd ?? run.startMd;
  const len = opt.len ?? 13; // nominal 13 m (project rule), labelled estimated until measured
  const hd = fin(start) && fin(len) ? start + len : (opt.hd ?? null);
  const j = {n, len, start, hd, cumDepth: hd, current: false, source: opt.source || (opt.len == null ? 'nominal 13 m' : 'edit'), overridden: true};
  const joints = [...(run.joints || []).map(x => ({...x, current: false})), j];
  let cum = 0; for (const q of joints) { if (fin(q.len)) cum += q.len; q.cum = cum; }
  return {...run, joints, endMd: hd ?? run.endMd};
}
