// opsnow_core.js: pure logic for the operator screen (no DOM, no network). Node-testable.
// Reads WITSML 1.4.1.1 XML text, picks the active wellbore/log, maps channels, derives joints from
// block travel and computes the survey path by minimum curvature. Never invents values: a missing
// channel stays null and is reported as "not in source".
export const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
export const xa = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const ent = s => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const tag = (b, k) => { const m = new RegExp('<(?:\\w+:)?' + k + '\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?' + k + '>').exec(b); return m ? ent(m[1].trim()) : ''; };
const tagUom = (b, k) => { const m = new RegExp('<(?:\\w+:)?' + k + '\\b([^>]*)>([\\s\\S]*?)</').exec(b); return m ? {v: ent(m[2].trim()), uom: (/uom="([^"]*)"/.exec(m[1]) || [])[1] || ''} : {v: '', uom: ''}; };
const attr = (a, k) => ent((new RegExp('(?:^|\\s)' + k + '="([^"]*)"').exec(a) || [])[1] || '');
function objects(xml, name) {
  const out = [], re = new RegExp('<(?:\\w+:)?' + name + '\\b([^>]*?)(/>|>([\\s\\S]*?)</(?:\\w+:)?' + name + '>)', 'g');
  let m; while ((m = re.exec(xml))) out.push({a: m[1], b: m[3] || ''});
  return out;
}
export const num = v => { if (v == null || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

export function parseWellbores(xml) {
  return objects(xml, 'wellbore').map(({a, b}) => ({uid: attr(a, 'uid'), uidWell: attr(a, 'uidWell'), name: tag(b, 'name') || attr(a, 'uid'),
    nameWell: tag(b, 'nameWell'), created: tag(b, 'dTimCreation'), changed: tag(b, 'dTimLastChange')}));
}
export function parseWells(xml) { return objects(xml, 'well').map(({a, b}) => ({uid: attr(a, 'uid'), name: tag(b, 'name') || attr(a, 'uid')})); }

export function parseLogHeaders(xml) {
  return objects(xml, 'log').map(({a, b}) => {
    const curves = objects(b, 'logCurveInfo').map(c => ({mn: tag(c.b, 'mnemonic'), unit: tag(c.b, 'unit'), nullValue: tag(c.b, 'nullValue'),
      min: tag(c.b, 'minDateTimeIndex') || tag(c.b, 'minIndex'), max: tag(c.b, 'maxDateTimeIndex') || tag(c.b, 'maxIndex')}));
    const it = tag(b, 'indexType'), time = /time/i.test(it);
    const s = tagUom(b, 'startIndex'), e = tagUom(b, 'endIndex');
    return {uid: attr(a, 'uid'), uidWell: attr(a, 'uidWell'), uidWellbore: attr(a, 'uidWellbore'), name: tag(b, 'name'), nameWellbore: tag(b, 'nameWellbore'),
      indexType: it, time, indexCurve: tag(b, 'indexCurve'), growing: /^true$/i.test(tag(b, 'objectGrowing')), nullValue: tag(b, 'nullValue'),
      start: time ? tag(b, 'startDateTimeIndex') : num(s.v), end: time ? tag(b, 'endDateTimeIndex') : num(e.v), indexUom: time ? 's' : (e.uom || s.uom || 'm'),
      changed: tag(b, 'dTimLastChange'), curves};
  });
}

// Log data block -> {ml, ul, rows:[[index, ...values]]}; index is ms epoch (time) or metres (depth).
export function parseLogData(xml, time) {
  const log = objects(xml, 'log')[0]; if (!log) return {ml: [], ul: [], rows: []};
  const ml = tag(log.b, 'mnemonicList').split(',').map(s => s.trim()), ul = tag(log.b, 'unitList').split(',').map(s => s.trim());
  const rows = [];
  for (const m of log.b.matchAll(/<(?:\w+:)?data>([^<]*)<\/(?:\w+:)?data>/g)) {
    const c = m[1].split(','); const ix = time ? Date.parse(c[0].trim()) : num(c[0]);
    if (!Number.isFinite(ix)) continue;
    rows.push([ix, ...c.slice(1).map(v => ent(v.trim()))]);
  }
  rows.sort((p, q) => p[0] - q[0]);
  return {ml, ul, rows};
}

export function parseTrajectory(xml, opts = {}) {
  const t = objects(xml, 'trajectory')[0]; if (!t) return null;
  const st = objects(t.b, 'trajectoryStation').map(({a, b}) => {
    const md = tagUom(b, 'md'), tvd = tagUom(b, 'tvd'), inc = tagUom(b, 'incl'), az = tagUom(b, 'azi');
    return {uid: attr(a, 'uid'), t: tag(b, 'dTimStn'), type: tag(b, 'typeTrajStation'), md: toM(num(md.v), md.uom), tvd: toM(num(tvd.v), tvd.uom),
      inc: toDeg(num(inc.v), inc.uom), azi: toDeg(num(az.v), az.uom)};
  }).filter(s => s.md != null && s.inc != null && s.azi != null && (opts.includePlan || !/^(plan|planned|proposed|projected|projection)/i.test(s.type))).sort((p, q) => p.md - q.md);
  return {uid: attr(t.a, 'uid'), uidWell: attr(t.a, 'uidWell'), uidWellbore: attr(t.a, 'uidWellbore'), name: tag(t.b, 'name'), nameWell: tag(t.b, 'nameWell'), nameWellbore: tag(t.b, 'nameWellbore'),
    growing: /^true$/i.test(tag(t.b, 'objectGrowing')), end: tag(t.b, 'dTimTrajEnd'), stations: st};
}
export const isPlanName = name => /plan|proposed|rev\s*c\d*|revc\d*/i.test(name || '');
export function parseTrajectoryIds(xml) {
  return objects(xml, 'trajectory').map(({a, b}) => ({uid: attr(a, 'uid'), uidWell: attr(a, 'uidWell'), uidWellbore: attr(a, 'uidWellbore'),
    name: tag(b, 'name'), nameWell: tag(b, 'nameWell'), nameWellbore: tag(b, 'nameWellbore')}));
}
export const pickSurvey = ids => (ids || []).find(t => !isPlanName(t.name)) || null;
export const pickPlan = ids => (ids || []).find(t => isPlanName(t.name)) || null;
const toM = (v, u) => v == null ? null : /^(ft|usft|ft_us)$/i.test(u) ? v * 0.3048 : v;
const toDeg = (v, u) => v == null ? null : /^rad$/i.test(u) ? v * 180 / Math.PI : v;

// Channel roles. First alias that exists in the log wins. Units are kept as the source reports them.
export const ROLES = [
  ['rop', 'ROP', /^(ROPA|ROP|ROPI|ROP_AVG)$/i],
  ['wob', 'WOB', /^(WOB|WOBA|SWOB|WOB_AVG)$/i],
  ['rpm', 'RPM', /^(RPMA|RPM|TDRPM|SRPM|RPM_SURF)$/i],
  ['torque', 'Torque', /^(TORQUE|TQA|TQ|STOR|TORQ|TDTQ)$/i],
  ['spp', 'SPP', /^(SPP|SPPA|STPP|SPPRESS)$/i],
  ['flowIn', 'Flow in', /^(FLOW|FLOW_?IN|MFIA|MFI|TFLO|TFLOW|FLOWIN)$/i],
  ['flowOut', 'Flow out', /^(FLOW_?OUT|MFOA|MFO|RETFL|FLOWOUT)$/i],
  ['hkl', 'Hookload', /^(HOOKLOAD|HKL|HKLA|HKLD)$/i],
  ['bh', 'Block height', /^(BHE|BPOS|BLKPOS|BLOCK_?HEIGHT)$/i],
  ['hd', 'Hole MD', /^(HOLEDEP(TH)?|DMEA|HDTH|HOLE_?DEPTH|DEPTH_?HOLE)$/i],
  ['bd', 'Bit MD', /^(BDE|BDEP|BITDEP(TH)?|BIT_?DEPTH|DBTM|DEPTH_?BIT)$/i],
  ['gas', 'Total gas', /^(PASONGAS|TGAS|TOTAL_?GAS|GAS)$/i],
  ['diffp', 'Diff. pressure', /^(DIFFP|DIFF_?P|DIFFPRESS)$/i],
  ['time', 'Time', /^(TIME|DTIM|DTE|DATE_?TIME|TIMESTAMP)$/i],
];
export const PARAMS = ['rop', 'wob', 'rpm', 'torque', 'spp', 'flowIn', 'flowOut', 'hkl', 'bh'];
export function mapChannels(ml, ul, header) {
  const units = new Map((header?.curves || []).map(c => [c.mn.toUpperCase(), c]));
  const out = {};
  for (const [key, label, re] of ROLES) {
    const i = ml.findIndex((m, j) => j > 0 && re.test(m.replace(/\s+/g, '')));
    if (i < 0) continue;
    const c = units.get(ml[i].toUpperCase());
    out[key] = {key, label, mn: ml[i], col: i, unit: ul[i] || c?.unit || '', nullValue: c?.nullValue || header?.nullValue || ''};
  }
  return out;
}
export function value(raw, ch) {
  const v = num(raw); if (v == null) return null;
  if (ch?.nullValue !== '' && ch?.nullValue != null && v === Number(ch.nullValue)) return null;
  if (v === -999.25) return null;
  return v;
}
// Latest non-blank value of each channel, with the index it came from.
export function latestValues(rows, map) {
  const out = {};
  for (const [k, ch] of Object.entries(map)) {
    for (let i = rows.length - 1; i >= 0 && i >= rows.length - 50; i--) { const v = value(rows[i][ch.col], ch); if (v != null) { out[k] = {v, at: rows[i][0], blankLatest: i !== rows.length - 1}; break; } }
  }
  return out;
}
export function series(rows, ch) { const xs = [], ys = []; for (const r of rows) { const v = value(r[ch.col], ch); if (v != null) { xs.push(r[0]); ys.push(v); } } return {xs, ys}; }

// Append rows strictly after the last index (no duplicates), keep a bounded window.
export function appendRows(store, data, keep = 4000) {
  if (!store.ml?.length) { store.ml = data.ml; store.ul = data.ul; }
  if (data.ml.join(',') !== store.ml.join(',')) { // columns changed: remap by mnemonic
    const idx = store.ml.map(m => data.ml.indexOf(m));
    data = {...data, rows: data.rows.map(r => [r[0], ...idx.slice(1).map(i => i > 0 ? r[i] : '')])};
  }
  const last = store.rows.at(-1)?.[0] ?? -Infinity; let added = 0;
  for (const r of data.rows) if (r[0] > last + 1e-9) { store.rows.push(r); added++; }
  if (store.rows.length > keep) store.rows.splice(0, store.rows.length - keep);
  return added;
}

// Pick the wellbore that is being drilled: newest created wellbore whose logs changed most recently.
export function pickActive(wellbores, headersByWb) {
  const ms = s => Date.parse(s) || 0;
  const ranked = wellbores.map(b => {
    const logs = headersByWb[b.uid] || [];
    return {b, logs, changed: Math.max(0, ...logs.map(l => ms(l.changed))), created: ms(b.created)};
  }).filter(x => x.logs.length).sort((p, q) => q.changed - p.changed || q.created - p.created);
  return ranked[0] || null;
}
// Primary drilling log: most drilling parameters, then freshest change. A time log that has
// stopped (not growing, or far behind the depth log) loses to a growing depth log.
export function pickPrimary(logs, now = Date.now()) {
  const ms = s => Date.parse(s) || 0;
  const scored = logs.map(l => {
    const ml = ['IDX', ...l.curves.filter(c => c.mn !== l.indexCurve).map(c => c.mn)];
    const map = mapChannels(ml, ml.map(() => ''), l);
    const params = PARAMS.filter(k => map[k]).length;
    const age = now - ms(l.changed);
    let liveCurves = params;
    if (l.time) { // count only curves whose data reaches the log end (others are one-off samples)
      liveCurves = PARAMS.filter(k => { const c = l.curves.find(c => c.mn === map[k]?.mn); return c && Math.abs(ms(c.max) - ms(l.end)) < 300000; }).length;
    }
    return {l, params, liveCurves, age, score: liveCurves * 10 + (l.growing ? 30 : 0) - Math.min(60, age / 60000)};
  }).filter(x => x.params >= 2).sort((p, q) => q.score - p.score);
  return scored[0]?.l || null;
}

// Connections from block travel: the block is raised to the top for each new joint, so a jump up of
// more than 3 m between consecutive depth rows marks a connection at that hole depth.
// A block jump within minGapM of the previous connection is normally a pick-up mid-joint, not a new joint
// (DR101L WB04B01: 0.2–2 m "joints" at 684, 823, 848, 961, 972 m). It still counts when the block went from
// the floor (≤ 0.6 m) to full height (≥ 93% of the highest seen) after ≥ 2 m: a short joint or pup was added
// (708.0 → 711.1 m, 3.1 m, then 12.3 m joints again).
export function connectionsFromBlock(rows, map, jumpM = 3, minGapM = 6) {
  const ch = map.bh; if (!ch) return [];
  const out = []; let prev = null, maxTop = 0;
  for (const r of rows) {
    const v = value(r[ch.col], ch); if (v == null) continue;
    if (prev && v - prev.v > jumpM) {
      const gap = out.length ? r[0] - out.at(-1).md : Infinity, full = prev.v <= 0.6 && v >= 0.93 * Math.max(maxTop, v);
      if (gap >= minGapM || (gap >= 2 && full)) out.push({md: r[0], blockTop: v, blockBottom: prev.v, short: gap < minGapM});
      maxTop = Math.max(maxTop, v);
    }
    prev = {v, md: r[0]};
  }
  return out;
}
export function joints(conns, holeMd) {
  const list = conns.slice(1).map((c, i) => ({start: conns[i].md, end: c.md, length: c.md - conns[i].md}));
  const lengths = list.map(j => j.length).filter(l => l > 6 && l < 30).sort((a, b) => a - b);
  const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : null;
  const last = conns.at(-1);
  const current = last && holeMd != null ? {start: last.md, drilled: Math.max(0, holeMd - last.md)} : null;
  return {list, median, current};
}

// Minimum curvature from MD/Inc/Azi. Returns N, E, TVD (TVD from source when reported) and DLS deg/30 m.
export function minCurve(st) {
  const R = Math.PI / 180, out = [];
  for (let i = 0; i < st.length; i++) {
    const s = st[i];
    if (!i) { out.push({...s, n: 0, e: 0, tvdc: s.tvd ?? 0, dls: null}); continue; }
    const p = st[i - 1], o = out[i - 1], dmd = s.md - p.md;
    const i1 = p.inc * R, i2 = s.inc * R, a1 = p.azi * R, a2 = s.azi * R;
    const cosb = Math.cos(i2 - i1) - Math.sin(i1) * Math.sin(i2) * (1 - Math.cos(a2 - a1));
    const b = Math.acos(Math.max(-1, Math.min(1, cosb))), rf = b > 1e-9 ? 2 / b * Math.tan(b / 2) : 1;
    out.push({...s, n: o.n + dmd / 2 * (Math.sin(i1) * Math.cos(a1) + Math.sin(i2) * Math.cos(a2)) * rf,
      e: o.e + dmd / 2 * (Math.sin(i1) * Math.sin(a1) + Math.sin(i2) * Math.sin(a2)) * rf,
      tvdc: o.tvdc + dmd / 2 * (Math.cos(i1) + Math.cos(i2)) * rf, dls: dmd > 0.01 ? b / R * 30 / dmd : null});
  }
  return out;
}

// Freshness of the source, from the store's own change time (depth logs carry no clock).
export function freshness(changedIso, now = Date.now()) {
  const t = Date.parse(changedIso); if (!Number.isFinite(t)) return {state: 'unknown', age: null};
  const age = Math.max(0, now - t);
  return {state: age < 180000 ? 'live' : age < 900000 ? 'delayed' : 'stopped', age, t};
}
// Activity from what the source shows: hole depth advancing between our own reads (depth logs have
// no clock), with RPM telling rotating from sliding. Never claims drilling from store freshness alone.
// The Adaga store lands new rows in batches about once a minute, so allow 2.5 min before saying
// the hole has stopped deepening.
export const BATCH_MS = 150000;
export function rigState({fresh, advancedAt, watchFrom, now = Date.now(), rpm, rop, flow, timeLog}) {
  if (fresh.state === 'stopped' || fresh.state === 'unknown') return 'No new data';
  if (advancedAt == null && (watchFrom == null || now - watchFrom < BATCH_MS)) return 'Checking activity…';
  const since = advancedAt ?? watchFrom;
  const making = advancedAt != null && now - advancedAt < BATCH_MS;
  if (making && (rop ?? 0) > 0.5) return (rpm ?? 0) > 5 ? 'Drilling · rotating' : 'Drilling · sliding';
  const mins = since != null ? Math.max(1, Math.round((now - since) / 60000)) : null;
  return 'Hole depth not advancing' + (mins ? ' · ' + (advancedAt == null ? '≥ ' : '') + mins + ' min' : '') + ((flow ?? 0) > 50 ? ' · pumps on' : '');
}
// Bit MD: prefer a live reported channel (BDE/DBTM/etc). The Adaga time log on DR101L/WB04B01
// stopped at 04:40 AEST 14 Nov (growing=false; requestLatestValues still ends there; no later
// time log exists on this well). A depth log has no bit-depth mnemonic. When the rig state is
// on-bottom drilling, bit MD equals hole MD — that is derived, never presented as a reported channel.
export const BIT_STALE_MS = 900000;
export function resolveBit({reported, holeMd, state, now = Date.now(), staleMs = BIT_STALE_MS}) {
  const live = reported && Number.isFinite(reported.v) && Number.isFinite(reported.at) && (now - reported.at) < staleMs;
  if (live) { const c = clampBit(reported.v, holeMd); return {v: c.v, at: reported.at, kind: 'reported', source: reported.source || 'time log', clamped: c.clamped, was: c.was}; }
  if (/^Drilling/.test(state || '') && Number.isFinite(holeMd)) {
    return {v: holeMd, at: now, kind: 'derived', source: 'hole MD while on bottom'};
  }
  return {v: null, at: Number.isFinite(reported?.at) ? reported.at : null, kind: reported ? 'stale' : 'missing',
    source: reported?.source || null, last: Number.isFinite(reported?.v) ? reported.v : null};
}

export const aest = ms => Number.isFinite(ms) ? new Date(ms).toLocaleTimeString('en-AU', {timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}) + ' AEST' : '—';
export const aestDay = ms => Number.isFinite(ms) ? new Date(ms).toLocaleString('en-AU', {timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false}) + ' AEST' : '—';
export function ago(ms) { if (!Number.isFinite(ms)) return ''; const s = Math.round(ms / 1000); return s < 90 ? s + ' s ago' : s < 5400 ? Math.round(s / 60) + ' min ago' : (s / 3600).toFixed(1) + ' h ago'; }

// Hard rule: the bit is never deeper than the hole. A reported or derived bit MD past hole MD is clamped to hole MD.
export function clampBit(bitMd, holeMd) {
  if (!Number.isFinite(bitMd)) return {v: null, clamped: false};
  if (Number.isFinite(holeMd) && bitMd > holeMd) return {v: holeMd, clamped: true, was: bitMd};
  return {v: bitMd, clamped: false};
}
const f1 = (v, d) => Number.isFinite(v) ? v.toLocaleString('en-AU', {minimumFractionDigits: d, maximumFractionDigits: d}) : '—';
// Labels that say what each number is. Active wellbore: hole MD (true latest depth). Others: their last survey station.
export function branchLabel(b, active, holeMd) {
  const last = b?.path?.at(-1)?.md;
  if (b?.name === active && Number.isFinite(holeMd)) return b.name + ' · hole ' + f1(holeMd, 1) + ' m MD';
  return (b?.name || '') + ' · last survey ' + f1(last, 0) + ' m MD';
}
export function bitLabel(bitPos, holeMd, kind) {
  if (!bitPos) return '';
  if (kind === 'not reported') return 'Hole TD ' + f1(bitPos.md, 1) + ' m MD · bit depth not reported';
  const off = Number.isFinite(holeMd) ? holeMd - bitPos.md : null;
  const where = off == null ? '' : off <= 0.05 ? ' · at hole' : ' · ' + f1(off, 1) + ' m off bottom';
  return 'Bit ' + f1(bitPos.md, 1) + ' m MD' + where + (kind ? ' (' + kind + ')' : '');
}
export function projLabel(bitPos) { return bitPos && bitPos.dmd > 0.05 ? 'projected ' + f1(bitPos.dmd, 1) + ' m past last survey ' + f1(bitPos.from, 1) + ' m' : ''; }
// ---------- derived from depth: projection to bit, joint number ----------
// Constant build and turn rates from the last two stations, carried to the bit MD (standard projection).
export function projectToBit(calc, bitMd, holeMd) {
  if (!calc?.length || !Number.isFinite(bitMd)) return null;
  bitMd = clampBit(bitMd, holeMd).v; // never extrapolate the bit past hole depth
  const s = calc.at(-1), p = calc.at(-2); const dmd = bitMd - s.md; if (dmd < 0) return null;
  let br = 0, tr = 0;
  if (p && s.md - p.md > 0.5) { br = (s.inc - p.inc) / (s.md - p.md); let da = s.azi - p.azi; if (da > 180) da -= 360; if (da < -180) da += 360; tr = da / (s.md - p.md); }
  const inc = s.inc + br * dmd, azi = ((s.azi + tr * dmd) % 360 + 360) % 360;
  const step = minCurve([{md: s.md, inc: s.inc, azi: s.azi, tvd: 0}, {md: bitMd, inc, azi}])[1];
  const tvd0 = s.tvd ?? s.tvdc;
  return {md: bitMd, inc, azi, tvd: tvd0 + step.tvdc, n: (s.n ?? 0) + step.n, e: (s.e ?? 0) + step.e, from: s.md, dmd, br30: br * 30, tr30: tr * 30, holeMd: Number.isFinite(holeMd) ? holeMd : null};
}
// Joint number of the joint being drilled. With a tally: the tally joint whose cumulative depth (BHA + joints)
// covers the bit. Without one: connections seen in this wellbore's log plus the joints already in the hole
// at the first seen connection (first connection MD / measured joint length), labelled estimated.
// field-edm-1115: the estimate is made from each connection's own depth, so it no longer depends on where the depth-log read
// started or on connections missed in a gap (before: first seen connection + count, which gave the 2151.6 m joint 163 on one
// load and 175 on another). The measured median is rounded to 0.1 m so small changes in the read sample do not renumber.
export function estJointLen(median) { return Number.isFinite(median) && median > 0 ? Math.round(median * 10) / 10 : null; }
export function estimateJointAt(md, median, bhaLen = 0) { const L = estJointLen(median); return L && Number.isFinite(md) ? Math.max(1, Math.round((md - (bhaLen || 0)) / L) + 1) : null; }
// Estimated number per connection: from its own depth, never repeating or going back (a short joint/pup counts as one joint).
export function estimateSequence(conns, median, bhaLen = 0) { let prev = null, off = 0; return (conns || []).map(c => { const e = estimateJointAt(c.md, median, bhaLen); if (e == null) return null; let n = e + off; if (prev != null && n <= prev) { off += prev + 1 - n; n = prev + 1; } prev = n; return n; }); } // off = short joints seen so far (kept across gaps)
export function jointNumber(conns, median, bitMd, tally) {
  if (tally?.joints?.length && Number.isFinite(bitMd)) {
    const j = tally.joints.find(j => j.cumDepth >= bitMd - 1e-6) || null;
    return j ? {n: j.n, kind: 'tally'} : {n: null, kind: 'beyond tally'};
  }
  if (!conns?.length || !median) return null;
  const n = estimateSequence(conns, median, tally?.bhaLen).at(-1); if (n == null) return null;
  return {n, kind: 'estimated', above: n - conns.length, seen: conns.length, jointLen: estJointLen(median)};
}
export function niceTicks(lo, hi, step) { const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6)); return out; }

// ---------- branches: tie each branch survey onto its parent (DR101L surveys start at each kick-off) ----------
export function interpAt(path, md) {
  if (!path?.length) return null;
  if (md <= path[0].md) return {...path[0]};
  for (let i = 1; i < path.length; i++) if (md <= path[i].md) {
    const a = path[i - 1], b = path[i], f = (md - a.md) / ((b.md - a.md) || 1), L = k => a[k] + (b[k] - a[k]) * f;
    return {md, n: L('n'), e: L('e'), tvd: L('tvd'), inc: L('inc'), azi: b.azi};
  }
  const s = path.at(-1), R = Math.PI / 180, d = md - s.md; // straight extension along the last station
  return {md, n: s.n + d * Math.sin(s.inc * R) * Math.cos(s.azi * R), e: s.e + d * Math.sin(s.inc * R) * Math.sin(s.azi * R), tvd: s.tvd + d * Math.cos(s.inc * R), inc: s.inc, azi: s.azi, extrapolated: true};
}
// trajs: [{name, uid, stations:[{md,inc,azi,tvd,t}]}]. Parent = other branch covering (or ending ≤ 60 m before)
// this branch's first MD whose TVD there matches within 2 m. A branch whose stations all repeat another's is a duplicate.
export function buildBranches(trajs, tvdTol = 2, reach = 60) {
  const B = trajs.filter(t => t.stations?.length).map(t => ({...t, st: [...t.stations].sort((a, b) => a.md - b.md)}));
  for (const b of B) {
    const dup = B.find(o => o !== b && o.st.length > b.st.length && b.st.every(s => o.st.some(x => Math.abs(x.md - s.md) < 0.01 && Math.abs(x.inc - s.inc) < 0.01)));
    if (dup) b.duplicateOf = dup.name;
  }
  const raw = new Map(B.map(b => [b, minCurve(b.st)]));
  for (const b of B) {
    if (b.duplicateOf) continue; const s0 = b.st[0]; let best = null;
    for (const o of B) {
      if (o === b || o.duplicateOf || o.st[0].md >= s0.md) continue;
      const oc = raw.get(o); if (o.st.at(-1).md < s0.md - reach) continue;
      const p = interpAt(oc.map(x => ({...x, tvd: x.tvd ?? x.tvdc})), s0.md); if (!p || s0.tvd == null) continue;
      const d = Math.abs(p.tvd - s0.tvd); if (d <= tvdTol && (!best || d < best.d)) best = {o, d};
    }
    b.parent = best?.o.name || null; b.tieMd = best ? s0.md : 0; b.tieDtvd = best?.d ?? null;
  }
  const byName = new Map(B.map(b => [b.name, b])), done = new Map();
  const place = b => {
    if (done.has(b.name)) return done.get(b.name);
    done.set(b.name, null);
    let origin = {n: 0, e: 0}, mc = raw.get(b);
    if (b.duplicateOf) { const d = place(byName.get(b.duplicateOf)); const pts = d ? d.filter(p => p.md <= b.st.at(-1).md + 1e-6) : []; done.set(b.name, pts); return pts; }
    if (b.parent) { const pp = place(byName.get(b.parent)); const t = pp && interpAt(pp, b.st[0].md); if (t) origin = {n: t.n, e: t.e}; }
    else mc = minCurve([{md: 0, inc: 0, azi: 0, tvd: 0}, ...b.st]).slice(1); // root: vertical from surface to the first station
    const pts = mc.map(s => ({md: s.md, inc: s.inc, azi: s.azi, t: s.t, tvd: s.tvd ?? s.tvdc, n: s.n - (b.parent ? mc[0].n : 0) + origin.n, e: s.e - (b.parent ? mc[0].e : 0) + origin.e}));
    done.set(b.name, pts); return pts;
  };
  for (const b of B) b.path = place(b);
  for (const b of B) { const chain = []; let c = b; while (c?.parent) { chain.push({name: c.parent, below: c.tieMd}); c = byName.get(c.parent); } b.ancestry = chain; }
  return B;
}

// ---------- anti-collision (estimated) ----------
// Simple, stated error model (not a full ISCWSA tool model): radius of the uncertainty ellipse at ~2 sigma
// grows linearly with MD: r = 0.3 m + 7.5 m per 1000 m MD. SF = centre-to-centre / (r_ref + r_offset).
export const EOU = {base: 0.3, perKm: 7.5, label: 'Estimated: uncertainty radius 0.3 m + 7.5 m per 1000 m MD (~2σ), not a tool error model'};
export const eouRadius = md => EOU.base + EOU.perKm * Math.max(0, md) / 1000;
export const sf = (cc, md1, md2) => cc / (eouRadius(md1) + eouRadius(md2));
export const sfLevel = v => !Number.isFinite(v) ? 'none' : v < 1 ? 'red' : v < 1.5 ? 'amber' : 'ok';
export function closestOnPath(p, path) {
  let best = null;
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[i + 1] || a;
    const ux = b.n - a.n, uy = b.e - a.e, uz = b.tvd - a.tvd, L2 = ux * ux + uy * uy + uz * uz;
    const f = L2 > 0 ? Math.max(0, Math.min(1, ((p.n - a.n) * ux + (p.e - a.e) * uy + (p.tvd - a.tvd) * uz) / L2)) : 0;
    const q = {n: a.n + ux * f, e: a.e + uy * f, tvd: a.tvd + uz * f, md: a.md + (b.md - a.md) * f};
    const d = Math.hypot(p.n - q.n, p.e - q.e, p.tvd - q.tvd);
    if (!best || d < best.cc) best = {cc: d, q};
  }
  return best;
}
// Section of an offset branch that is NOT shared hole with the reference branch: the shared motherbore above
// the point where the two paths split is excluded, so a branch never "collides" with its own parent hole.
export function offsetSection(ref, off) {
  if (off.name === ref.name || off.duplicateOf) return [];
  const anc = new Map(ref.ancestry.map(a => [a.name, a.below]));
  // off is an ancestor of ref: only off's hole below where ref's lineage left it
  if (anc.has(off.name)) return off.path.filter(p => p.md > anc.get(off.name) + 1e-6);
  // ref is an ancestor of off, or they share an ancestor: drop off's points on the shared ancestry
  const offAnc = new Map(off.ancestry.map(a => [a.name, a.below]));
  if (offAnc.has(ref.name)) return off.path.filter(p => p.md > offAnc.get(ref.name) + 1e-6);
  const common = ref.ancestry.find(a => offAnc.has(a.name));
  if (common) { const split = Math.min(anc.get(common.name), offAnc.get(common.name)); return off.path.filter(p => p.md > split + 1e-6); }
  return off.path;
}
// Reference points: the active branch's own drilled section (below its tie-on), plus the bit projection.
// Junction zone: against a branch the active hole kicked off from (its parent line), separation starts at zero
// by design. Those points are not alarms until the hole has first diverged to SF >= 1.5 from that branch; after
// that any approach counts. Other branches have no exclusion.
export function antiCollision(branches, refName, bit, divergeSf = 1.5) {
  const ref = branches.find(b => b.name === refName); if (!ref) return null;
  const own = ref.path.filter(p => p.md >= ref.tieMd - 1e-6); if (bit && bit.md > (own.at(-1)?.md ?? 0)) own.push(bit);
  const lineage = new Set(ref.ancestry.map(a => a.name)), out = [];
  for (const o of branches) {
    if (o === ref || o.duplicateOf) continue;
    const sec = offsetSection(ref, o); if (sec.length < 1) { out.push({name: o.name, excluded: 'shared hole only'}); continue; }
    const recs = own.map(p => { const c = closestOnPath(p, sec); return c && {md: p.md, offMd: c.q.md, cc: c.cc, sf: sf(c.cc, p.md, c.q.md), q: c.q, p}; }).filter(Boolean);
    let diverged = !lineage.has(o.name), junctionTo = null, min = null, minCc = null;
    for (const r of recs) { if (!diverged && r.sf >= divergeSf) { diverged = true; junctionTo = r.md; } r.junction = !diverged; if (diverged && (!min || r.sf < min.sf)) min = r; if (diverged && (!minCc || r.cc < minCc.cc)) minCc = r; }
    out.push({name: o.name, min, minCc, diverged, cur: recs.at(-1) || null, from: sec[0].md, to: sec.at(-1).md, parentLine: lineage.has(o.name), junctionTo});
  }
  return {ref: ref.name, refFrom: ref.tieMd, bit, rows: out.sort((a, b) => (a.min?.sf ?? 1e9) - (b.min?.sf ?? 1e9))};
}
// Travelling-cylinder bearing of an offset point around the reference wellbore, clockwise from high side.
export function tcBearing(p, q) {
  const R = Math.PI / 180, I = p.inc * R, A = p.azi * R;
  const t = [Math.sin(I) * Math.cos(A), Math.sin(I) * Math.sin(A), Math.cos(I)]; // n, e, down
  let hs = [Math.cos(I) * Math.cos(A), Math.cos(I) * Math.sin(A), -Math.sin(I)]; // high side (up the hole wall)
  const rt = [t[1] * hs[2] - t[2] * hs[1], t[2] * hs[0] - t[0] * hs[2], t[0] * hs[1] - t[1] * hs[0]]; // right of high side looking down-hole
  const v = [q.n - p.n, q.e - p.e, q.tvd - p.tvd]; const dt = v[0] * t[0] + v[1] * t[1] + v[2] * t[2];
  const w = v.map((x, i) => x - dt * t[i]); const x = w[0] * rt[0] + w[1] * rt[1] + w[2] * rt[2], y = w[0] * hs[0] + w[1] * hs[1] + w[2] * hs[2];
  return ((Math.atan2(x, y) / R) + 360) % 360;
}

// ---------- azimuthal gamma image (MWD Image log, MG = 4 sectors) ----------
// Sector order checked against the quadrant curves of MWD Formation Evaluation on WB04B01 at 1,401.49 m:
// MG = 12.99 12.7 12 10.12 and GMTQ 12.99, GMRQ 12.70, GMBQ 12.00, GMLQ 10.12 → order Top, Right, Bottom, Left.
export const IMAGE_SECTORS = ['Top', 'Right', 'Bottom', 'Left'];
export function imageRows(d, nullValue = -999.25) {
  const i = d.ml.findIndex(m => /^MG$/i.test(m)), a = d.ml.findIndex(m => /^MGAVG$/i.test(m)); if (i < 0) return [];
  return d.rows.map(r => { const s = String(r[i] ?? '').trim().split(/\s+/).map(Number); return {md: r[0], s: s.length >= 4 && s.every(v => Number.isFinite(v) && v !== nullValue) ? s : null, avg: num(r[a])}; }).filter(r => r.s);
}
// Robust display range from the whole log (2nd–98th percentile), so a few spikes do not wash out the plot.
export function robustRange(vals, lo = 0.02, hi = 0.98) {
  const v = vals.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null;
  let a = v[Math.floor(lo * (v.length - 1))], b = v[Math.ceil(hi * (v.length - 1))]; if (b - a < 1e-6) { a -= 1; b += 1; }
  return [a, b];
}
// WOB health: the depth log's WOB is negative over much of WB04B01 and drifts with depth. Positive and negative
// readings mix inside the same joints, so this is a hookload tare (zero) drift, not a reversed sign: flipping it
// would be wrong. Report it plainly instead of "fixing" it.
export function wobCheck(rows, ch, lastN = 600) {
  if (!ch) return null; const v = []; for (let i = Math.max(0, rows.length - lastN); i < rows.length; i++) { const x = value(rows[i][ch.col], ch); if (x != null) v.push(x); }
  if (v.length < 20) return null; const neg = v.filter(x => x < 0).length / v.length, pos = v.filter(x => x > 1).length / v.length;
  const med = [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
  return {negShare: neg, posShare: pos, median: med, tare: neg > 0.3, mixed: neg > 0.05 && pos > 0.05};
}

// ---------- pipe tally ----------
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  const sep = (text.split('\n')[0].match(/\t/g)?.length || 0) > (text.split('\n')[0].match(/,/g)?.length || 0) ? '\t' : (text.split('\n')[0].match(/;/g)?.length || 0) > (text.split('\n')[0].match(/,/g)?.length || 0) ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(s => s.trim())).filter(r => r.some(Boolean));
}
// Rows (array of string arrays) → {bha:[{desc,len}], bhaLen, joints:[{n,len,cum,cumDepth}], unit, issues}.
// Header row is found by a length column; joint rows have a number in the joint column; any other row with a
// length before the first joint (or marked BHA) is a BHA component.
export function parseTally(rows) {
  const issues = []; const H = rows.findIndex(r => r.some(c => /length|len\b|lgth/i.test(c)));
  if (H < 0) return {error: 'No "Length" column found in the tally'};
  const h = rows[H].map(c => c.toLowerCase());
  const col = re => h.findIndex(c => re.test(c));
  const cL = col(/length|len\b|lgth/), cN = col(/joint|jt|^#|^no\.?$|number|item/), cC = col(/cum|total|running/), cD = col(/desc|component|type|tool/), cB = col(/bha|section|group/);
  const unit = /\bft\b|feet|\(ft\)/.test(h[cL]) ? 'ft' : 'm'; const k = unit === 'ft' ? 0.3048 : 1;
  const bha = [], joints = [];
  for (const r of rows.slice(H + 1)) {
    const len = num(String(r[cL] ?? '').replace(/[^0-9.\-]/g, '')); if (len == null) continue;
    const id = String(r[cN] ?? '').trim(), n = /^\d+(\.0+)?$/.test(id) ? Number(id) : null, desc = cD >= 0 ? r[cD] : '';
    const isBha = (cB >= 0 && /bha/i.test(r[cB] || '')) || /\b(bit|motor|mwd|lwd|bha|stab|sub|collar|jar|hwdp|float|xo|crossover|pony|ubho|nmdc|monel)\b/i.test(desc || id) && n == null;
    if (n != null && !isBha) joints.push({n, len: len * k, cumSheet: cC >= 0 ? num(String(r[cC]).replace(/[^0-9.\-]/g, '')) : null});
    else if (!joints.length || isBha) bha.push({desc: desc || id || 'BHA item', len: len * k});
  }
  if (!joints.length) return {error: 'No numbered joints found in the tally'};
  const bhaLen = bha.reduce((a, b) => a + b.len, 0); let cum = 0;
  joints.sort((a, b) => a.n - b.n);
  for (const j of joints) { cum += j.len; j.cum = cum; j.cumDepth = bhaLen + cum; if (j.cumSheet != null) { const cs = j.cumSheet * k; if (Math.abs(cs - j.cum) > 0.05 && Math.abs(cs - j.cumDepth) > 0.05) issues.push('Joint ' + j.n + ': sheet cumulative ' + cs.toFixed(2) + ' m ≠ sum of lengths ' + j.cum.toFixed(2) + ' m'); } }
  for (let i = 1; i < joints.length; i++) if (joints[i].n !== joints[i - 1].n + 1) issues.push('Joint numbers jump ' + joints[i - 1].n + ' → ' + joints[i].n);
  return {unit, bha, bhaLen, joints, issues};
}
// Compare a tally with connections measured from block travel by depth. Each connection is matched to the
// tally joint whose cumulative depth (BHA + joints) is nearest; the hole drilled between two connections is the
// next joint's length. Tolerances: 0.3 m per joint, 1 m cumulative.
export function compareTally(tally, conns, bitMd, tolJ = 0.3, tolC = 1) {
  if (!tally?.joints?.length) return null;
  const J = tally.joints, rows = [];
  for (let i = 0; i < conns.length; i++) {
    const c = conns[i].md; let k = -1, d = Infinity;
    for (let x = 0; x < J.length; x++) { const dd = Math.abs(J[x].cumDepth - c); if (dd < d) { d = dd; k = x; } }
    if (k < 0 || d > Math.max(6, tolC * 4)) { rows.push({conn: c, joint: null, cumDiff: null}); continue; }
    const next = conns[i + 1], nj = J[k + 1];
    const measured = next && nj && next.md - c < nj.len * 1.6 ? next.md - c : null; // a longer gap means a connection was not seen
    rows.push({conn: c, joint: J[k].n, cumDepth: J[k].cumDepth, cumDiff: c - J[k].cumDepth, nextJoint: nj?.n ?? null, tallyLen: nj?.len ?? null, measured,
      lenDiff: measured != null && nj ? measured - nj.len : null});
  }
  const matched = rows.filter(r => r.joint != null), lenRows = matched.filter(r => r.lenDiff != null);
  const lenBad = lenRows.filter(r => Math.abs(r.lenDiff) > tolJ), cumBad = matched.filter(r => Math.abs(r.cumDiff) > tolC);
  const inHole = Number.isFinite(bitMd) ? J.filter(j => j.cumDepth <= bitMd + 1e-6).length : null;
  const covering = Number.isFinite(bitMd) ? J.find(j => j.cumDepth >= bitMd) : null;
  const pass = matched.length > 0 && !lenBad.length && !cumBad.length && !tally.issues?.length;
  return {rows, matched: matched.length, unmatched: rows.length - matched.length, lenChecked: lenRows.length, lenBad, cumBad, maxLenDiff: Math.max(0, ...lenRows.map(r => Math.abs(r.lenDiff))),
    maxCumDiff: Math.max(0, ...matched.map(r => Math.abs(r.cumDiff))), inHole, drilling: covering?.n ?? null, tallyTotal: tally.bhaLen + J.at(-1).cum, pass, tolJ, tolC};
}
// Merge rows from a backfill read (older part of the log) in front of what the screen already holds.
export function prependRows(store, data) {
  if (!store.ml?.length) { store.ml = data.ml; store.ul = data.ul; store.rows = data.rows.slice(); return data.rows.length; }
  let rows = data.rows;
  if (data.ml.join(',') !== store.ml.join(',')) { const idx = store.ml.map(m => data.ml.indexOf(m)); rows = rows.map(r => [r[0], ...idx.slice(1).map(i => i > 0 ? r[i] : '')]); }
  const first = store.rows[0]?.[0] ?? Infinity; const older = rows.filter(r => r[0] < first - 1e-9);
  store.rows = older.concat(store.rows); return older.length;
}
export function sliceByIndex(rows, lo, hi) { // rows sorted by index; returns [i0, i1)
  const bs = x => { let a = 0, b = rows.length; while (a < b) { const m = (a + b) >> 1; if (rows[m][0] < x) a = m + 1; else b = m; } return a; };
  return [Math.max(0, bs(lo) - 1), Math.min(rows.length, bs(hi) + 1)];
}
