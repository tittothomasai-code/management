// Read-only adapter for the simulator's selected WITSML time log.
import {detect} from './conn.js?v=fp-ops-r2-20261108';
import {dlsPer30m} from './geo.js?v=fp-ops-r2-20261108';
export {JOINT_REFERENCE_M, PHYSICAL_JOINT_TOL_M, UNIT_DUPLICATE_M, fallbackInterval, surveyIntervals} from './operations_joint_estimates.js?v=j13-20261109';
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
  hd: ['m', ['holedepth'], /^(HOLEDEP(TH)?|HDEP|HDTH|HOLE_DEPTH)$/i],
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
  jointStart: ['m', ['ops.jointStart'], /^JOINT_START_MD$/i],
  jointEnd: ['m', ['ops.jointEnd'], /^JOINT_END_MD$/i],
  jointNumber: ['id', ['ops.jointNumber'], /^JOINT_NUMBER$/i],
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
// Source clocks a few hundred milliseconds ahead of this browser are skew.
// Anything later, including a row one second ahead, is not a live index.
// One-hour and two-hour future rows stay off LIVE.
export const FUTURE_SKEW_MS = 500;
// Explicit fixture marks already used by the connection, the local sim store, and the synthetic fixture.
// The approved proxy host is not one of them: a custom https store with ordinary names can still be LIVE.
const FIXTURE_TEXT = /SIM-TEST|SIMULATED|\bSYNTHETIC\b|\bFIXTURE\b|NOT LIVE/i;

function fixtureUrl(url) {
  try {
    const u = new URL(String(url || ''));
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === 'invalid' || host.endsWith('.invalid')) return true;
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

// Operations observes the existing poller. Two different source rows must be
// seen across observations of the same session. History from one fetch is
// insufficient, and a rollback of the source clock requires fresh evidence.
export function feedSource(w, now = Date.now(), cfg, observation = {}) {
  function reset(source) {
    observation.log = observation.rows = observation.store = observation.last = null;
    observation.advanced = false;
    return source;
  }
  if (fixtureFeed(w, cfg)) return reset('WITSML TEST FEED');
  if (w?.mode === 'replay') return reset('WITSML REPLAY');
  // A dropped real session stays disconnected. It is not relabelled as the simulator.
  if (!w || w.authDead || w.transportDead || w.connected === false) return reset('WITSML DISCONNECTED');
  if (w.mode === 'loading') return reset('WITSML WAITING');
  // The deployed poller uses mode for replay. A normal live session can
  // still report mode='off' while supplying a selected log and source rows.
  if (!w.log) return reset(w.connected ? 'WITSML WAITING' : 'WITSML DISCONNECTED');
  if (!w.log.w || !w.log.b || !w.log.uid) return reset('WITSML WAITING');
  if (!/time/i.test(w.log.indexType || '')) return reset('WITSML TIME LOG REQUIRED');

  const stamp = w.hist?.at(-1)?.t;
  // lastRowMs is only accepted when it is the same source-row time. A poll or
  // receipt clock that disagrees with the row is not an index.
  if (!finite(stamp) || stamp <= 0 || w.lastRowMs !== stamp) return reset('WITSML WAITING');
  if (stamp > now + FUTURE_SKEW_MS) return reset('WITSML FUTURE');
  if (!w.healthy?.() || now - stamp >= MAX_AGE) return reset('WITSML STALE');

  const store = cfg?.url || w.storeUrl;
  const prior = observation.last;
  const sameSeries = observation.log === w.log && observation.store === store && finite(prior);
  const advancedStamp = sameSeries && stamp > prior;
  if (!sameSeries || stamp < prior || (observation.rows !== w.hist && !advancedStamp)) {
    observation.advanced = false;
  } else if (advancedStamp) observation.advanced = true;
  Object.assign(observation, {log:w.log, rows:w.hist, store, last:stamp});
  return observation.advanced ? 'WITSML LIVE' : 'WITSML WAITING FOR ADVANCE';
}

export function readSamples(data, log = {}, map = {}, until = Infinity, units) {
  if (!data?.ml?.length) return [];
  const {ml, ul = [], rows = [], ix} = data;
  const curves = new Map((log.curves || []).filter(c => c.mn).map(c => [c.mn.toUpperCase(), c]));
  const columns = Object.entries(CHANNELS).map(([key, [target, names, alias]]) => {
    const otherDepth = key === 'hd' ? /(?:GAMMA|SURVEY|BIT|^(?:GR|LWD|MWD)[ _.-])/i :
      key === 'bd' ? /(?:GAMMA|SURVEY|HOLE|^(?:GR|LWD|MWD)[ _.-])/i : null;
    const mapped = ml.findIndex((m, i) => i !== ix && names.includes(map[m]) && !otherDepth?.test(m));
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

// Latest sample only. A blank cell stays blank: history is not copied forward and is not filled with zero.
export function latestChannel(rows, key, stale = false) {
  const seen = rows.some(r => Object.prototype.hasOwnProperty.call(r, key));
  if (!seen) return 'absent';
  if (stale) return 'stale';
  return Number.isFinite(rows.at(-1)?.[key]) ? 'value' : 'blank';
}

function convert(v, from, to, units) {
  if (!finite(v)) return null;
  const u = String(from || '').toLowerCase().trim().replace(/³/g, '3');
  if (to === 'ratio') return v >= 0 && (!u || /^(1|ratio|unitless|dimensionless)$/.test(u)) ? v : null;
  if (to === 'id') return Number.isSafeInteger(v) && v >= 0 && (!u || u === '1' || u === 'unitless') ? v : null;
  if (to === 'flag') return v === 0 || v === 1 ? v : null;
  if (to === 'rpm') return /^(rpm|rev\/min|1\/min)$/.test(u) ? v : null;
  if (to === 'deg') return /^(deg|dega|°)$/.test(u) ? v : u === 'rad' ? v * 180 / Math.PI : null;
  if (to === '%') return /^(%|pct|percent)$/.test(u) ? v : null;
  if (to === 'm3') return u === 'm3' ? v : u === 'bbl' ? v * 0.1589873 : null;
  if (u === to.toLowerCase().replace(/³/g, '3')) return v;
  const a = units?.dim(from), b = units?.dim(to);
  return a && b && a[0] === b[0] ? units.x(v, from, to) : null;
}

// Only explicit per-joint boundaries are a tally. Connection events may be
// stands or may span missed events, so they cannot supply joint boundaries.
export function feedJoints(samples) {
  const tally = new Map();
  let active;
  for (const row of samples) {
    const {jointStart:start, jointEnd:end, jointNumber:number} = row;
    active = undefined;
    if (!finite(start) || !finite(end) || start < 0 || end <= start) continue;
    const key = start;
    const joint = {start, end, number};
    if (tally.has(key)) tally.delete(key);
    tally.set(key,joint);
    if (finite(row.hd) && row.hd >= start && row.hd <= end) active = joint;
  }
  return {joints:[...tally.values()].slice(-7), active};
}

const MAX_SAMPLE_GAP_S = 120;
const HOLE_DEPTH_TOL_M = .10;
const ON_BOTTOM_TOL_M = .50;

// Reuse the existing connection detector with measured inputs only. Each
// uninterrupted run must contain valid hole/bit depth, slips, flow and RPM.
export function feedConnectionIntervals(samples) {
  const intervals = [];
  let run = [];
  function finishRun() {
    if (run.length < 5) return;
    let slipSequence = 0;
    const samplesByTime = new Map();
    for (const [i,row] of run.entries()) {
      if (row.slips === 1 && run[i-1]?.slips === 0) slipSequence++;
      samplesByTime.set(row.t,{row,index:i,slipSequence});
    }

    let previous;
    for (const event of detect(run).connections) {
      const inSlip = samplesByTime.get(event.tSlipsIn);
      const off = samplesByTime.get(event.tOff);
      const on = samplesByTime.get(event.tOn);
      const resume = samplesByTime.get(event.tResume)?.row;
      if (!inSlip || !off || !on || !resume ||
          run[inSlip.index-1]?.slips !== 0 || inSlip.row.slips !== 1 ||
          Math.abs(resume.hd-resume.bd) > ON_BOTTOM_TOL_M ||
          run.slice(off.index,on.index).some(row => Math.abs(row.hd-inSlip.row.hd) > HOLE_DEPTH_TOL_M)) {
        previous = undefined;
        continue;
      }
      if (previous && inSlip.slipSequence === previous.slipSequence + 1 &&
          inSlip.row.hd > previous.row.hd + HOLE_DEPTH_TOL_M) {
        intervals.push({start:previous.row.hd,end:inSlip.row.hd,length:inSlip.row.hd-previous.row.hd});
      }
      previous = inSlip;
    }
  }

  for (const row of samples) {
    const usable = [row.t,row.hd,row.bd,row.flow,row.rpm].every(finite) &&
      row.hd >= 0 && row.bd >= 0 && row.bd <= row.hd + ON_BOTTOM_TOL_M &&
      (row.slips === 0 || row.slips === 1);
    const last = run.at(-1);
    if (!usable || (last && (row.t <= last.t || row.t-last.t > MAX_SAMPLE_GAP_S ||
        row.hd < last.hd - HOLE_DEPTH_TOL_M))) {
      finishRun();
      run = [];
    }
    if (usable) run.push(row);
  }
  finishRun();
  return intervals;
}

// Associate survey time with measured hole and bit depth. If the timestamp
// falls between samples, accept only a short bracket with stable hole depth.
export function surveyHoleContext(samples, time) {
  const t = Date.parse(time) / 1000;
  if (!finite(t)) return null;
  let before, after;
  for (const row of samples) {
    if (row.t <= t && (!before || row.t > before.t)) before = row;
    if (row.t >= t && (!after || row.t < after.t)) after = row;
  }
  if (!before || !after || t-before.t > 30 || after.t-t > 30 ||
      !finite(before.hd) || !finite(after.hd) ||
      Math.abs(after.hd-before.hd) > HOLE_DEPTH_TOL_M) return null;
  const nearest = t-before.t <= after.t-t ? before : after;
  if (nearest.hd < 0) return null;
  const bitStable = finite(before.bd) && finite(after.bd) && Math.abs(after.bd-before.bd) <= HOLE_DEPTH_TOL_M;
  // Measure movement within the bit channel from a preceding on-bottom
  // sample at the same hole depth. A cross-channel depth gap is not pickup.
  let pickup = null;
  if (bitStable) for (const row of samples) {
    if (row.t >= t || t-row.t > MAX_SAMPLE_GAP_S || !finite(row.hd) || !finite(row.bd) ||
        Math.abs(row.hd-nearest.hd) > HOLE_DEPTH_TOL_M || Math.abs(row.bd-row.hd) > ON_BOTTOM_TOL_M) continue;
    const movement = row.bd - nearest.bd;
    if (movement > HOLE_DEPTH_TOL_M) pickup = Math.max(pickup ?? 0,movement);
  }
  return {holeMd:nearest.hd,pickup};
}

// Use the parser's source stations (MD is normalised to feet). Never use the
// interpolated path, a virtual wellhead, or stations from another trajectory.
export function actualSurveyStations(stations, bore, trajectory) {
  if (!bore || !trajectory) return [];
  return (stations || []).filter(s =>
    s.wb === bore && s.traj === trajectory && !s.virtual &&
    !/^(plan|planned|proposed|projection|projected|interpolated|tie[ -]?in)$/i.test(s.typ?.trim() || '') &&
    finite(s.md) && s.md >= 0
  ).sort((a,b) => a.md - b.md);
}

export function surveyDepthIntervals(stations) {
  const intervals = [];
  let previous;
  for (const station of stations) {
    if (previous) {
      const length = (station.md - previous.md) * FT;
      if (length <= .001 && station.datum === previous.datum) continue;
      if (length > .001 && station.datum === previous.datum) {
        intervals.push({start:previous.md * FT,end:station.md * FT,length,startTime:previous.t,endTime:station.t});
      }
    }
    previous = station;
  }
  return intervals;
}

// Minimum-curvature DLS belongs to the interval ending at the actual station.
export function surveyDoglegs(stations) {
  return stations.slice(1).flatMap((end,i) => {
    const start = stations[i];
    if (start.virtual || end.virtual || start.datum !== end.datum ||
        !finite(start.md) || !finite(end.md) || end.md - start.md <= .001 / FT ||
        !finite(end.dls) || end.dls < 0) return [];
    return [{start:start.md * FT,end:end.md * FT,dls:dlsPer30m(end.dls)}];
  });
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
  return image.img.rows.filter(r => finite(r.md) && r.md >= 0 && r.md >= start && r.md <= end && r.v.some(finite));
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
