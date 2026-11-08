// Read-only adapter for the simulator's selected WITSML time log.
import {detect, median} from './conn.js';
export function wmlValue(raw, curveNull, logNull) {
  if (raw == null || String(raw).trim() === '') return null;
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  const missing = String(curveNull ?? '').trim() ? curveNull : logNull;
  return missing != null && String(missing).trim() !== '' && v === Number(missing) ? null : v;
}

export function sameWellbore(log, well, bore) {
  return Boolean(log?.w && log?.b && log.w === well && log.b === bore);
}

export const FT = 0.3048;
export const finite = Number.isFinite;
export const TRACKS = [
  ['ROP / WOB', ['rop', 'ROP', 'm/h'], ['wob', 'WOB', 'kN']],
  ['TORQUE / RPM', ['torque', 'Torque', 'kN·m'], ['rpm', 'RPM', 'rpm']],
  ['SPP / ECD', ['spp', 'SPP', 'kPa'], ['ecd', 'ECD', 'g/cm³']],
  ['FLOW IN / OUT', ['flow', 'In', 'L/min'], ['out', 'Out', 'L/min']],
];
const CHANNELS = {
  hd: ['m', ['holedepth', 'md'], /^(DMEA|DBTM|HOLEDEP(TH)?|HDEP|HDTH|HOLE_DEPTH|MD)$/i],
  bd: ['m', ['bitdepth'], /^(BDE|BDEP|BITDEP(TH)?|BIT_DEPTH|DBTB|DBTM_BIT)$/i],
  rop: ['m/h', ['rop'], /^(ROP|ROPA|ROPI)$/i],
  wob: ['kN', ['wob'], /^(WOB|WOBA|SWOB)$/i],
  torque: ['kN·m', ['tq'], /^(TQ|TQA|STOR|TORQ|TDTQ|TORQUE)$/i],
  rpm: ['rpm', ['rpm'], /^(RPM|RPMA|TDRPM|SRPM)$/i],
  spp: ['kPa', ['spp'], /^(SPP|SPPA|STPP|PRES_SP|SPPRESS)$/i],
  ecd: ['g/cm³', ['ops.ecd'], /^(ECD|ECDB|ECD_BIT|ECDM)$/i],
  flow: ['L/min', ['Q'], /^(FLOW|FLOW_?IN|MFIA|MFI|TFLO|TFLOW)$/i],
  out: ['L/min', ['ops.out'], /^(FLOW_?OUT|MFOA|MFO|RETFL)$/i],
  pit: ['m3', ['ops.pit'], /^(PIT_?VOL|PITVOLUME|PVT|PVTOT|TVOL)$/i],
  gas: ['%', ['ops.gas'], /^(GAS_?PCT|GASPCT|TGAS|TOTALGAS)$/i],
  tf: ['deg', ['ops.tf'], /^(TF|TOOLFACE|GTF|MTF)$/i],
  bh: ['m', ['quill'], /^(BHE|BPOS|BLKPOS|HKHT|BLOCK)$/i],
  hkl: ['kN', ['hook'], /^(HKL|HKLA|HKLD|HOOKLOAD)$/i],
  sf: ['ratio', ['ops.sf'], /^(SEPARATION_FACTOR|AC_MIN_SF|AC_SF)$/i],
  ctc: ['m', ['ops.ctc'], /^(AC_CTC|AC_CLEARANCE|CENTRELINE_DISTANCE)$/i],
  north: ['m', ['ops.north'], /^(AC_OFFSET_N|AC_DELTA_N)$/i],
  east: ['m', ['ops.east'], /^(AC_OFFSET_E|AC_DELTA_E)$/i],
  slips: ['flag', [], /^(SLIPS|SLIPSTAT|INSLIPS|SLIP)$/i],
  stick: ['flag', ['ops.stick'], /^(STICKSLIP_ALARM|STICK_SLIP_ALARM)$/i],
  pack: ['flag', ['ops.pack'], /^(PACKOFF_ALARM|PACK_OFF_ALARM)$/i],
  stall: ['flag', ['ops.stall'], /^(MOTOR_STALL_ALARM|PDM_STALL_ALARM)$/i],
};
const MAX_AGE = 120_000;
// Explicit fixture marks already used by the connection, the local sim store, and the synthetic fixture.
// The approved proxy host is not one of them: a custom https store with ordinary names can still be LIVE.
const FIXTURE_TEXT = /SIM-TEST|SIMULATED|\bSYNTHETIC\b/i;

function fixtureUrl(url) {
  try {
    const u = new URL(String(url || ''));
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    return /(?:^|\/)sim(?:\/|$)|simulated/i.test(u.pathname);
  } catch { return false; }
}

export function fixtureFeed(w, cfg) {
  if (!w) return false;
  if (w.simulated) return true;
  const log = w.log || {};
  const text = [log.name, log.nameWell, log.nameWellbore, log.nameWb, log.field, log.uid, w.supp].filter(Boolean).join(' ');
  if (FIXTURE_TEXT.test(text)) return true;
  return fixtureUrl(cfg?.url || w.storeUrl || '');
}

export function feedSource(w, now = Date.now(), cfg) {
  if (!w) return 'SIM';
  if (w.mode === 'loading') return 'WITSML WAITING';
  const fixture = fixtureFeed(w, cfg);
  if (w.mode === 'replay' && w.rp) return fixture ? 'SIM-TEST REPLAY' : 'REPLAY';
  if (!w.log && !w.liveMode && !w.connected) return 'SIM';
  if (!w.log) return 'WITSML WAITING';
  // A successful header read or a depth log is not a fresh drilling sample.
  if (!/time/i.test(w.log.indexType || '')) return 'WITSML TIME LOG REQUIRED';
  const sample = w.hist?.at(-1);
  if (!finite(sample?.t) || !finite(w.lastRowMs) || !w.lastRowMs) return 'WITSML WAITING';
  if (!w.healthy?.() || now - w.lastRowMs > MAX_AGE || now - sample.t > MAX_AGE) return 'WITSML STALE';
  return fixture ? 'WITSML SIM-TEST' : 'WITSML LIVE';
}

export function readSamples(data, log = {}, map = {}, until = Infinity, units) {
  if (!data?.ml?.length) return [];
  const {ml, ul = [], rows = [], ix} = data;
  const curves = new Map((log.curves || []).filter(c => c.mn).map(c => [c.mn.toUpperCase(), c]));
  const columns = Object.entries(CHANNELS).map(([key, [target, names, alias]]) => {
    const mapped = ml.findIndex((m, i) => i !== ix && names.includes(map[m]));
    const i = mapped >= 0 ? mapped : ml.findIndex((m, j) => j !== ix && alias.test(m) && (!map[m] || names.includes(map[m])));
    if (i < 0) return null;
    const curve = curves.get(ml[i].toUpperCase());
    return {key, target, i, unit: ul[i]?.trim() || curve?.unit, nullValue: curve?.nullValue};
  }).filter(Boolean);
  const out = [];
  // Replay owns the cursor. Never read a later row, even when the full log is in memory.
  let lo = 0, hi = rows.length;
  if (until < Infinity) {
    while (lo < hi) {
      const i = (lo + hi) >>> 1;
      if (rows[i].t <= until) lo = i + 1;
      else hi = i;
    }
  } else lo = rows.length;
  for (const row of rows.slice(Math.max(0, lo - 12000), lo)) {
    if (!finite(row.t)) continue;
    const p = {t: row.t / 1000};
    for (const c of columns) {
      const v = wmlValue(row.x[c.i], c.nullValue, log.nullValue);
      p[c.key] = convert(v, c.unit, c.target, units);
    }
    out.push(p);
  }
  return out;
}

function convert(v, from, to, units) {
  if (!finite(v)) return null;
  const u = String(from || '').toLowerCase().trim().replace(/³/g, '3');
  if (to === 'ratio') return v >= 0 && (!u || /^(1|ratio|unitless|dimensionless)$/.test(u)) ? v : null;
  if (to === 'flag') return v === 0 || v === 1 ? v : null;
  if (to === 'rpm') return /^(rpm|rev\/min|1\/min)$/.test(u) ? v : null;
  if (to === 'deg') return /^(deg|dega|°)$/.test(u) ? v : u === 'rad' ? v * 180 / Math.PI : null;
  if (to === '%') return /^(%|pct|percent)$/.test(u) ? v : null;
  if (to === 'm3') return u === 'm3' ? v : u === 'bbl' ? v * 0.1589873 : null;
  if (u === to.toLowerCase().replace(/³/g, '3')) return v;
  const a = units?.dim(from), b = units?.dim(to);
  return a && b && a[0] === b[0] ? units.x(v, from, to) : null;
}

export function feedJoints(samples) {
  if (!samples.some(r => finite(r.hd)) || !samples.some(r => finite(r.bd))) return [];
  const edges = detect(samples).connections.map(c => c.depth_m).filter(finite).sort((a, b) => a - b)
    .filter((md, i, a) => i === 0 || md - a[i - 1] > 0.5);
  const joints = edges.slice(1).map((end, i) => ({start: edges[i], end, number: i + 1}));
  if (!edges.length) return joints;
  const lengths = joints.slice(-4).map(j => j.end - j.start);
  const typical = median(lengths);
  const estimated = lengths.length >= 2 && typical >= 8 && typical <= 31 &&
    lengths.every(n => Math.abs(n - typical) < typical * 0.12);
  joints.push({start: edges.at(-1), end: estimated ? edges.at(-1) + typical : null,
    number: joints.length + 1, estimated, open: true});
  return joints;
}

export function drilledIntervals(rows) {
  let max = -Infinity, lastTime = -Infinity;
  const out = [];
  for (const p of rows) {
    if (!finite(p.hd) || p.hd <= max) continue;
    if (finite(max)) {
      const prev = out.at(-1);
      const continuous = p.t - lastTime <= 120 && p.hd - max <= 5;
      const onBottom = finite(p.bd) && Math.abs(p.hd - p.bd) <= 0.6;
      const mode = continuous && onBottom ? p.mode || (
        finite(p.rpm) && p.rpm >= 5 ? 'rotary' :
        finite(p.rpm) && p.flow > 200 ? 'slide' : 'unknown'
      ) : 'unknown';
      if (prev?.mode === mode && prev.to === max) prev.to = p.hd;
      else out.push({from: max, to: p.hd, mode});
    }
    max = p.hd;
    lastTime = p.t;
  }
  return out;
}

export function jointProgress(joint, hd, intervals) {
  if (!joint || !finite(hd)) return null;
  const {start, end} = joint;
  const drilled = Math.max(0, (finite(end) ? Math.min(hd, end) : hd) - start);
  const length = finite(end) ? end - start : null;
  const segments = [];
  let cursor = start;
  for (const i of intervals) {
    const a = Math.max(start, cursor, i.from), b = Math.min(start + drilled, i.to);
    if (!(b > a)) continue;
    if (a > cursor) segments.push({mode: 'unknown', metres: a - cursor});
    segments.push({mode: i.mode, metres: b - a});
    cursor = b;
  }
  if (cursor < start + drilled) segments.push({mode: 'unknown', metres: start + drilled - cursor});
  if (length > drilled) segments.push({mode: 'remaining', metres: length - drilled});
  const totals = {slide: 0, rotary: 0, unknown: 0, remaining: 0};
  for (const s of segments) totals[s.mode] += s.metres;
  return {drilled, length, segments, totals, pct: length > 0 ? 100 * drilled / length : null};
}

export function imageRows(w, image, start, end) {
  if (!image?.img || !sameWellbore(w?.log, image.well, image.wb) ||
      Boolean(w.simulated) !== Boolean(image.sim)) return [];
  return image.img.rows.filter(r => r.md >= start && r.md <= end && r.v.some(finite));
}

const STAMPED = new Set(['WITSML LIVE', 'WITSML SIM-TEST', 'WITSML STALE', 'REPLAY', 'SIM-TEST REPLAY']);
// Newest parsed time-log row. A header end time, a depth-log client clock, or lastRowMs with no history sample is not a source row.
export function sourceStamp(w, source, now = Date.now()) {
  if (!w || !STAMPED.has(source)) return '';
  const sample = w.hist?.at(-1)?.t;
  if (!finite(sample)) return '';
  const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  let text = ' · last source row ' + iso(sample) + ' (age ' + Math.max(0, Math.round((now - sample) / 1000)) + ' s)';
  if (finite(w.lastRowMs) && w.lastRowMs && w.lastRowMs !== sample) text += ', index ' + iso(w.lastRowMs);
  return text;
}

export function surveyMatches(w, geo, configuredWell) {
  const s = w?.sv;
  return geo?.calc?.length >= 2 && !s?.mismatch &&
    sameWellbore(w?.log, configuredWell, s?.cur?.wb) &&
    !(s.cur.st?.length && s.cur.st.every(x => /^(plan|planned|proposed)$/.test(x.typ))) &&
    (w.simulated ? geo.surv?.simTest : geo.surv?.live && !geo.surv?.simTest);
}
