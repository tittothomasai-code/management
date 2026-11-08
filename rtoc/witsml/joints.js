// Joint context. Authoritative tally / connection events win. Signal cuts are estimates.
// A stand is not split into joints. Missing boundaries stay unknown. No fixed pipe length is assumed.

const DEPTH_MN = /^(DBTM|BITDEP|BDEP|BIT_DEPTH|BITDEPTH|DMEA|HDTH|HDEP|HOLEDEPTH|HOLE_DEPTH)$/i;
const BIT_MN = /^(DBTM|BITDEP|BDEP|BIT_DEPTH|BITDEPTH)$/i;
const HOLE_MN = /^(DMEA|HDTH|HDEP|HOLEDEPTH|HOLE_DEPTH|DEPT|DEPTH)$/i;
const RPM_MN = /^(RPMA|RPM|TRPM|SRPM)$/i;
const FLOW_MN = /^(MFIA|FLOWIN|TFLO|FLOW)$/i;
const ROP_MN = /^(ROPA|ROP|ROP_AVG)$/i;
const HK_MN = /^(HKLA|HKLD|HOOKLOAD)$/i;
const SLIPS_MN = /^(SLIPS|INSLIPS)$/i;
const CONN_MN = /^(CONN|CONNECTION|CONNFLAG)$/i;
const JOINT_TYPE = /stand|double|drill\s*pipe|^dp$|joint|hwdp/i;
const CONN_CODE = /^(conn|connection|make\s*connection|making\s*connection)$/i;

export const SIGNAL_THRESHOLDS = {
  flowOffFrac: 0.1,
  rpmOff: 5,
  onBottom_m: 0.5,
  minPumpOff_s: 45,
  maxConn_s: 3600,
  reamFlat_m: 0.05,
};

function finite(n) { return typeof n === 'number' && Number.isFinite(n); }

function logs(wb) { return wb.branches?.log?.objects || []; }

function pick(values, re) {
  if (!values) return null;
  const k = Object.keys(values).find(m => re.test(m));
  if (!k) return null;
  const v = values[k];
  return { mnemonic: k, number: v.number, unit: v.unit, status: v.status };
}

function quantile(arr, p) {
  const s = arr.filter(finite).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))];
}

export function kindFromLength(len) {
  if (!finite(len)) return 'unknown';
  if (len >= 8 && len <= 11) return 'joint';
  if (len >= 17 && len <= 20) return 'double';
  if (len >= 25 && len <= 31) return 'stand';
  return 'unknown';
}

function kindFromType(type) {
  const t = String(type || '');
  if (/stand/i.test(t)) return 'stand';
  if (/double/i.test(t)) return 'double';
  if (JOINT_TYPE.test(t)) return 'joint';
  return null;
}

function timeObj(ms, source) {
  if (!finite(ms)) return { ms: null, isoUtc: null, source: source || 'unknown' };
  return { ms, isoUtc: new Date(ms).toISOString(), source };
}

export function tallyJoints(wb) {
  const placed = [];
  const unplaced = [];
  const ignored = [];
  for (const tub of wb.branches?.tubular?.objects || []) {
    if (tub.dataStatus === 'unreadable' || tub.dataStatus === 'pending') {
      unplaced.push({ tubularUid: tub.uid, reason: tub.reason || tub.dataStatus });
      continue;
    }
    let md = 0;
    let chain = true;
    let prevSeq = null;
    for (const c of tub.components || []) {
      const kind = kindFromType(c.type);
      if (!kind) { ignored.push({ tubularUid: tub.uid, uid: c.uid, type: c.type || '', reason: 'not a joint or stand component' }); continue; }
      if (!chain) { unplaced.push({ tubularUid: tub.uid, uid: c.uid, type: c.type, sequence: c.sequence, reason: 'length chain already broken' }); continue; }
      if (prevSeq != null && finite(c.sequence) && c.sequence !== prevSeq + 1) {
        chain = false;
        unplaced.push({ tubularUid: tub.uid, uid: c.uid, type: c.type, sequence: c.sequence, reason: 'sequence gap' });
        continue;
      }
      const len = c.len?.len?.metres;
      if (!finite(len)) {
        chain = false;
        unplaced.push({ tubularUid: tub.uid, uid: c.uid, type: c.type, sequence: c.sequence, reason: c.len?.len?.status || 'length missing' });
        continue;
      }
      placed.push({
        tubularUid: tub.uid, componentUid: c.uid, type: c.type, sequence: c.sequence,
        kind, kindSource: 'component-type',
        startMd_m: md, endMd_m: md + len, length_m: len,
      });
      md += len;
      prevSeq = finite(c.sequence) ? c.sequence : prevSeq;
    }
  }
  return { placed, unplaced, ignored };
}

function connectionEvents(wb) {
  const events = [];
  for (const r of wb.branches?.opsReport?.objects || []) {
    for (const a of r.activities || []) {
      if (!CONN_CODE.test(a.code || '') && !CONN_CODE.test(a.phase || '')) continue;
      events.push({
        source: 'ops-activity',
        md_m: a.md?.len?.metres ?? null,
        mdStatus: a.md?.len?.status || 'absent',
        ms: a.start?.ms ?? null,
        code: a.code || a.phase,
      });
    }
  }
  for (const log of logs(wb)) {
    if (log.indexKind !== 'time' && log.indexKind !== 'depth') continue;
    for (const row of log.rows || []) {
      const flag = pick(row.values, CONN_MN);
      if (!flag || flag.number !== 1) continue;
      const depth = log.indexKind === 'depth' && row.index.unitStatus === 'converted' ? row.index.metres : metresOf(pick(row.values, HOLE_MN));
      events.push({
        source: 'connection-curve',
        curve: flag.mnemonic,
        md_m: depth,
        mdStatus: finite(depth) ? 'converted' : 'unconverted',
        ms: row.index.ms ?? null,
      });
    }
  }
  return events.filter(e => finite(e.md_m) || finite(e.ms));
}

function isMetres(unit) {
  return /^(m|metre|meter|metres|meters)$/i.test(String(unit || '').trim());
}

function metresOf(hole) {
  if (!hole || !finite(hole.number) || !isMetres(hole.unit)) return null;
  return hole.number;
}

function samplesFrom(log) {
  const rows = log.rows || [];
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.index.ms == null) continue;
    const bit = pick(row.values, BIT_MN);
    const hole = pick(row.values, HOLE_MN);
    const rpm = pick(row.values, RPM_MN);
    const flow = pick(row.values, FLOW_MN);
    const hk = pick(row.values, HK_MN);
    const slips = pick(row.values, SLIPS_MN);
    const rop = pick(row.values, ROP_MN);
    const depthBit = bit && finite(bit.number) && isMetres(bit.unit) ? bit.number : null;
    const depthHole = hole && finite(hole.number) && isMetres(hole.unit) ? hole.number : null;
    out.push({
      ms: row.index.ms,
      bit: finite(depthBit) ? depthBit : null,
      hole: finite(depthHole) ? depthHole : null,
      rpm: rpm?.number ?? null,
      flow: flow?.number ?? null,
      hk: hk?.number ?? null,
      slips: slips?.number ?? null,
      rop: rop?.number ?? null,
      values: row.values,
    });
  }
  return out;
}

function classifyModes(samples, thr) {
  const flowVals = samples.map(s => s.flow).filter(finite);
  const flowRef = quantile(flowVals, 0.9);
  const flowOn = flowRef == null ? null : Math.max(1, thr.flowOffFrac * flowRef);
  const runs = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const next = samples[i + 1];
    let mode = 'unknown';
    const have = [s.flow, s.rpm, s.bit, s.hole].every(finite);
    if (!have || flowOn == null) mode = 'unknown';
    else {
      const offBottom = s.hole - s.bit > thr.onBottom_m;
      const flowing = s.flow > flowOn;
      const rotating = s.rpm > thr.rpmOff;
      const holeFlat = next && finite(next.hole) ? Math.abs(next.hole - s.hole) <= thr.reamFlat_m : false;
      if (!flowing && !rotating && offBottom) mode = 'connection';
      else if (flowing && rotating && offBottom && holeFlat) mode = 'reaming';
      else if (flowing && rotating && offBottom) mode = 'off-bottom';
      else if (flowing && rotating && !offBottom) mode = 'drilling';
      else if (flowing && !rotating) mode = 'circulating';
      else if (!flowing) mode = 'pumps-off';
      else mode = 'unknown';
    }
    const dt = next ? Math.max(0, (next.ms - s.ms) / 1000) : 0;
    const prev = runs[runs.length - 1];
    if (prev && prev.mode === mode) { prev.duration_s += dt; prev.samples++; prev.endMs = s.ms; }
    else runs.push({ mode, duration_s: dt, samples: 1, startMs: s.ms, endMs: s.ms, durationBasis: 'sum-of-steps-to-next-sample' });
  }
  return { runs, flowOn, thresholds: thr };
}

function deriveConnections(samples, thr) {
  const rejected = [];
  if (samples.length < 5) return { events: [], rejected, slipsSource: 'none', confidence: 'none' };
  const hasSlips = samples.some(s => s.slips === 0 || s.slips === 1);
  const hk = samples.map(s => s.hk).filter(finite);
  const medHk = quantile(hk, 0.5);
  const hasHk = hk.length > samples.length * 0.5 && finite(medHk);
  const slipsSource = hasSlips ? 'channel' : hasHk ? 'hookload' : 'none';
  const confidence = hasSlips ? 'high' : hasHk ? 'medium' : 'none';
  const inSlips = (s) => {
    if (hasSlips) return s.slips === 1;
    if (hasHk && finite(s.hk)) return s.hk < medHk * 0.5 && medHk - s.hk > 100;
    return false;
  };
  const flowVals = samples.map(s => s.flow).filter(finite);
  const flowRef = quantile(flowVals, 0.9) || 0;
  const flowThr = Math.max(1, thr.flowOffFrac * flowRef);
  const off = s => finite(s.flow) && s.flow <= flowThr;
  const events = [];
  let i = 0;
  while (i < samples.length) {
    if (!off(samples[i])) { i++; continue; }
    let j = i;
    while (j + 1 < samples.length && off(samples[j + 1])) j++;
    const seg = samples.slice(i, j + 1);
    const dur = (seg[seg.length - 1].ms - seg[0].ms) / 1000;
    i = j + 1;
    if (dur < thr.minPumpOff_s) { rejected.push({ reason: 'pump-blip', ms: seg[0].ms, duration_s: dur }); continue; }
    if (dur > thr.maxConn_s) { rejected.push({ reason: 'too-long', ms: seg[0].ms, duration_s: dur }); continue; }
    if (!seg.some(s => !finite(s.rpm) || s.rpm < thr.rpmOff)) { rejected.push({ reason: 'still-rotating', ms: seg[0].ms }); continue; }
    if (!seg.some(s => finite(s.hole) && finite(s.bit) && s.hole - s.bit > thr.onBottom_m)) { rejected.push({ reason: 'not-off-bottom', ms: seg[0].ms }); continue; }
    if (slipsSource === 'none' || !seg.some(inSlips)) { rejected.push({ reason: 'no-slips-evidence', ms: seg[0].ms }); continue; }
    const slip = seg.find(inSlips) || seg[0];
    const md = finite(slip.hole) ? slip.hole : null;
    if (!finite(md)) { rejected.push({ reason: 'no-hole-depth', ms: slip.ms }); continue; }
    events.push({ source: 'derived-signals', md_m: md, ms: slip.ms, slipsSource, confidence });
  }
  return { events, rejected, slipsSource, confidence, thresholds: thr };
}

function sliceSeries(wb, joint) {
  const series = [];
  for (const log of logs(wb)) {
    if (log.dataStatus !== 'ingested' && log.dataStatus !== 'partial') continue;
    const rows = [];
    for (const row of log.rows || []) {
      let md = null;
      let ms = null;
      if (log.indexKind === 'depth') md = row.index.metres;
      if (log.indexKind === 'time') ms = row.index.ms;
      const hole = pick(row.values, HOLE_MN);
      const bit = pick(row.values, BIT_MN);
      if (md == null) md = metresOf(hole);
      if (md == null) md = metresOf(bit);
      const inMd = finite(joint.startMd_m) && finite(joint.endMd_m) && finite(md) && md >= joint.startMd_m - 1e-6 && md <= joint.endMd_m + 1e-6;
      const inTime = finite(joint.startTime?.ms) && finite(joint.endTime?.ms) && finite(ms) && ms >= joint.startTime.ms && ms <= joint.endTime.ms;
      if (log.indexKind === 'depth' ? inMd : (inMd || inTime)) rows.push({ md, ms, values: row.values });
    }
    if (!rows.length) continue;
    const mns = new Set();
    rows.forEach(r => Object.keys(r.values).forEach(m => mns.add(m)));
    for (const mn of mns) {
      series.push({
        logUid: log.uid, mnemonic: mn, unit: rows.find(r => r.values[mn])?.values[mn].unit || '',
        points: rows.map(r => ({ md: r.md, ms: r.ms, v: r.values[mn]?.number ?? null })),
      });
    }
  }
  return series;
}

function associateSurveys(joint, stations) {
  if (!finite(joint.startMd_m) || !finite(joint.endMd_m)) return [];
  const usable = stations.filter(s => finite(s.md_m));
  const inside = usable.filter(s => s.md_m >= joint.startMd_m - 1e-6 && s.md_m <= joint.endMd_m + 1e-6);
  const pickDist = (s) => Math.min(Math.abs(s.md_m - joint.startMd_m), Math.abs(s.md_m - joint.endMd_m));
  const chosen = inside.length ? inside : (() => {
    if (!usable.length) return [];
    let best = usable[0];
    let d = pickDist(best);
    for (const s of usable) { const dd = pickDist(s); if (dd < d) { best = s; d = dd; } }
    return [{ ...best, _dist: d }];
  })();
  return chosen.map(s => ({
    trajectoryUid: s.trajectoryUid, stationUid: s.stationUid,
    md_m: s.md_m, incl_deg: s.incl_deg, azi_deg: s.azi_deg, tvd_m: s.tvd_m,
    withinInterval: inside.length > 0, distance_m: inside.length ? 0 : pickDist(s),
    alignedBy: 'depth', interpolated: false,
    time: s.time?.ms != null ? s.time : null,
  }));
}

function summaryOf(joint, samplesIn) {
  const rop = samplesIn.map(s => s.rop).filter(finite);
  return {
    samples: samplesIn.length,
    mdSpan_m: finite(joint.startMd_m) && finite(joint.endMd_m) ? joint.endMd_m - joint.startMd_m : null,
    duration_s: finite(joint.startTime?.ms) && finite(joint.endTime?.ms) ? (joint.endTime.ms - joint.startTime.ms) / 1000 : null,
    meanRop_m_h: rop.length ? rop.reduce((a, b) => a + b, 0) / rop.length : null,
    ropSamples: rop.length,
  };
}

function modesBetween(modeRuns, startMs, endMs) {
  if (!finite(startMs) || !finite(endMs)) return [];
  return (modeRuns || []).filter(r => r.endMs >= startMs && r.startMs <= endMs).map(r => ({
    mode: r.mode, samples: r.samples, duration_s: r.duration_s, durationBasis: r.durationBasis,
  }));
}

function latestHole(wb) {
  let best = null;
  for (const log of logs(wb)) {
    for (const row of log.rows || []) {
      const fromIndex = log.indexKind === 'depth' && row.index.unitStatus === 'converted' ? row.index.metres : null;
      const fromCurve = metresOf(pick(row.values, HOLE_MN));
      const v = finite(fromIndex) ? fromIndex : fromCurve;
      if (finite(v)) best = best == null ? v : Math.max(best, v);
    }
  }
  return best;
}

function latestTime(wb) {
  let best = null;
  for (const log of logs(wb)) for (const row of log.rows || []) if (finite(row.index.ms)) best = best == null ? row.index.ms : Math.max(best, row.index.ms);
  return best;
}

function buildFromBounds(wb, bounds, meta) {
  const stations = [];
  for (const t of wb.branches?.trajectory?.objects || []) {
    for (const s of t.stations || []) stations.push({
      trajectoryUid: t.uid, stationUid: s.uid || '',
      md_m: s.md?.len?.metres ?? null, incl_deg: s.incl?.degrees ?? null, azi_deg: s.azi?.degrees ?? null, tvd_m: s.tvd?.len?.metres ?? null,
      time: s.time,
    });
  }
  const timeLogs = logs(wb).filter(l => l.indexKind === 'time');
  const sampleLog = timeLogs.find(l => (l.rows || []).some(r => r.index.ms != null && pick(r.values, RPM_MN))) || timeLogs[0];
  const samples = sampleLog ? samplesFrom(sampleLog) : [];
  const modeInfo = classifyModes(samples, SIGNAL_THRESHOLDS);
  const holeNow = latestHole(wb);
  const timeNow = latestTime(wb);
  const joints = [];
  const unknowns = [...meta.unknowns];
  const usable = bounds.filter(b => finite(b.md_m)).sort((a, b) => a.md_m - b.md_m || (a.ms ?? 0) - (b.ms ?? 0));
  if (usable.length < 1 && meta.requireBounds) {
    return { joints: [], jointCount: null, unknowns: [...unknowns, 'no depth boundaries'], modes: modeInfo, alternativesIgnored: meta.alternativesIgnored || '' };
  }
  const intervals = [];
  for (let i = 0; i < usable.length - 1; i++) intervals.push({ start: usable[i], end: usable[i + 1], open: false });
  if (meta.allowOpen && usable.length && finite(holeNow) && holeNow > usable[usable.length - 1].md_m + 0.05) {
    intervals.push({ start: usable[usable.length - 1], end: { md_m: holeNow, ms: timeNow, source: 'latest-sample' }, open: true });
  }
  if (!intervals.length) unknowns.push(usable.length ? 'only one depth boundary; joint count unknown' : 'no depth boundaries');
  intervals.forEach((iv, n) => {
    const length = iv.end.md_m - iv.start.md_m;
    const kind = iv.start.kind || kindFromLength(length);
    const kindSource = iv.start.kind ? iv.start.kindSource : 'measured-length-band';
    const joint = {
      id: (wb.uid || 'wb') + ':' + meta.method + ':' + n,
      index: n + 1,
      open: iv.open,
      kind: iv.start.kind || kind,
      kindSource,
      boundarySource: meta.boundarySource,
      method: meta.method,
      uncertainty: meta.uncertainty,
      confidence: iv.start.confidence || meta.confidence || 'as-reported',
      startMd_m: iv.start.md_m,
      endMd_m: iv.end.md_m,
      length_m: length,
      startTime: timeObj(iv.start.ms, iv.start.source),
      endTime: timeObj(iv.end.ms, iv.open ? 'latest-sample' : iv.end.source),
      slipsSource: meta.slipsSource || null,
    };
    if (!iv.start.kind && kind === 'unknown') joint.kind = 'unknown';
    const inSamples = samples.filter(s => {
      const md = finite(s.hole) ? s.hole : s.bit;
      return finite(md) && md >= joint.startMd_m - 1e-6 && md <= joint.endMd_m + 1e-6;
    });
    joint.modes = modesBetween(modeInfo.runs, joint.startTime.ms, joint.endTime.ms);
    if (!joint.modes.length) joint.modes = inSamples.length ? [{ mode: 'unknown', samples: inSamples.length, duration_s: null, durationBasis: 'no time overlap' }] : [];
    joint.surveys = associateSurveys(joint, stations);
    joint.series = sliceSeries(wb, joint);
    joint.summary = summaryOf(joint, inSamples);
    joint.formations = (meta.formations || []).filter(f => finite(f.mdTop_m) && f.mdTop_m < joint.endMd_m && (f.mdBottom_m == null || f.mdBottom_m > joint.startMd_m));
    joints.push(joint);
  });
  return { joints, jointCount: joints.length, unknowns, modes: modeInfo, alternativesIgnored: meta.alternativesIgnored || '', rejected: meta.rejected || [] };
}

export function buildJoints(wb) {
  const formations = [];
  for (const f of wb.branches?.formationMarker?.objects || []) {
    formations.push({ mdTop_m: f.mdTop?.len?.metres ?? null, mdBottom_m: f.mdBottom?.len?.metres ?? null, name: f.name || '', source: 'formationMarker' });
  }
  const tally = tallyJoints(wb);
  const events = connectionEvents(wb);
  if (tally.placed.length || tally.unplaced.length) {
    const bounds = tally.placed.map(p => ({
      md_m: p.startMd_m, ms: null, source: 'tubular-tally', kind: p.kind, kindSource: p.kindSource, confidence: 'as-reported',
      endMd_m: p.endMd_m,
    }));
    // Each placed component is itself one interval; do not wait for a following boundary and do not open a fake one.
    const stations = [];
    for (const t of wb.branches?.trajectory?.objects || []) for (const s of t.stations || []) stations.push({
      trajectoryUid: t.uid, stationUid: s.uid || '', md_m: s.md?.len?.metres ?? null, incl_deg: s.incl?.degrees ?? null, azi_deg: s.azi?.degrees ?? null, tvd_m: s.tvd?.len?.metres ?? null, time: s.time,
    });
    const unknowns = [];
    if (tally.unplaced.length) unknowns.push(tally.unplaced.length + ' tally component(s) not placed: ' + tally.unplaced.map(u => u.reason).join('; '));
    const holeNow = latestHole(wb);
    const coveredTo = tally.placed.length ? Math.max(...tally.placed.map(p => p.endMd_m)) : null;
    if (finite(holeNow) && finite(coveredTo) && holeNow > coveredTo + 0.05) unknowns.push('hole depth is beyond the tally; no extra joint was added');
    const joints = tally.placed.map((p, n) => {
      let startMs = null;
      let endMs = null;
      let timeSource = 'unknown';
      for (const e of events) {
        if (finite(e.md_m) && Math.abs(e.md_m - p.startMd_m) <= 1 && finite(e.ms)) { startMs = e.ms; timeSource = e.source; }
        if (finite(e.md_m) && Math.abs(e.md_m - p.endMd_m) <= 1 && finite(e.ms)) { endMs = e.ms; timeSource = e.source; }
      }
      const joint = {
        id: (wb.uid || 'wb') + ':tubular-tally:' + n,
        index: n + 1,
        open: false,
        kind: p.kind,
        kindSource: p.kindSource,
        boundarySource: 'tubular-tally',
        method: 'tubular-component-length',
        uncertainty: 'as-reported',
        confidence: 'as-reported',
        startMd_m: p.startMd_m,
        endMd_m: p.endMd_m,
        length_m: p.length_m,
        startTime: timeObj(startMs, startMs == null ? 'unknown' : timeSource),
        endTime: timeObj(endMs, endMs == null ? 'unknown' : timeSource),
        componentType: p.type,
        componentUid: p.componentUid,
      };
      joint.surveys = associateSurveys(joint, stations);
      joint.series = sliceSeries(wb, joint);
      joint.modes = [];
      joint.summary = summaryOf(joint, []);
      joint.formations = formations.filter(f => finite(f.mdTop_m) && f.mdTop_m < joint.endMd_m && (f.mdBottom_m == null || f.mdBottom_m > joint.startMd_m));
      if (startMs == null && endMs == null) joint.timeNote = 'no recorded boundary time; depth/time crosswalk was not assumed';
      return joint;
    });
    return {
      joints, jointCount: joints.length, unknowns,
      unplaced: tally.unplaced, ignoredComponents: tally.ignored,
      modes: { runs: [], note: 'tally joints have no signal window attached' },
      alternativesIgnored: events.length || logs(wb).some(l => l.indexKind === 'time') ? 'signals-or-events-not-used-to-cut-joints' : '',
      boundarySource: 'tubular-tally',
    };
  }
  const authoritative = events.filter(e => e.source !== 'derived-signals' && finite(e.md_m));
  if (authoritative.length >= 2) {
    return {
      ...buildFromBounds(wb, authoritative.map(e => ({ md_m: e.md_m, ms: e.ms, source: e.source })), {
        method: 'connection-events', boundarySource: authoritative[0].source, uncertainty: 'event', confidence: 'recorded',
        allowOpen: true, requireBounds: true, unknowns: [], formations, alternativesIgnored: 'derived-signals',
      }),
      boundarySource: 'connection-event',
    };
  }
  const timeLog = logs(wb).find(l => l.indexKind === 'time' && (l.rows || []).length);
  if (!timeLog) {
    return { joints: [], jointCount: null, unknowns: ['no tubular tally and no time log; joint count unknown'], modes: { runs: [] }, alternativesIgnored: '', boundarySource: 'none' };
  }
  const samples = samplesFrom(timeLog);
  const derived = deriveConnections(samples, SIGNAL_THRESHOLDS);
  if (derived.slipsSource === 'none') {
    return {
      joints: [], jointCount: null,
      unknowns: ['no tally, no connection events, and no slips or hookload; joint boundaries were not derived'],
      modes: classifyModes(samples, SIGNAL_THRESHOLDS),
      rejected: derived.rejected, boundarySource: 'none', alternativesIgnored: '',
    };
  }
  const pack = buildFromBounds(wb, derived.events.map(e => ({ md_m: e.md_m, ms: e.ms, source: 'derived-signals', confidence: e.confidence })), {
    method: 'derived-from-signals', boundarySource: 'derived-signals', uncertainty: 'estimate',
    confidence: derived.confidence, slipsSource: derived.slipsSource, allowOpen: true, requireBounds: true,
    unknowns: derived.events.length ? ['intervals before the first observed connection are unknown and were not filled by a pipe length'] : ['no connection boundary passed the signal checks'],
    formations, rejected: derived.rejected, alternativesIgnored: '',
  });
  pack.boundarySource = 'derived-signals';
  pack.slipsSource = derived.slipsSource;
  pack.rejected = derived.rejected;
  return pack;
}
