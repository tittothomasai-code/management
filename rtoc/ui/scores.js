// Honest scoreboard figures from one wellbore context. No targets, ranks, or filled-in zeros.

function finite(n) { return typeof n === 'number' && Number.isFinite(n); }

function round(n, d = 2) {
  if (!finite(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function modeTimeline(joint) {
  const modes = joint?.modes || [];
  const known = modes.filter(m => finite(m.duration_s) && m.duration_s > 0);
  const total = known.reduce((s, m) => s + m.duration_s, 0);
  if (!total) {
    return {
      segments: modes.map(m => ({ mode: m.mode, share: null, duration_s: finite(m.duration_s) ? m.duration_s : null, samples: m.samples ?? null })),
      basis: 'duration unknown',
    };
  }
  return {
    segments: modes.map(m => ({
      mode: m.mode,
      share: finite(m.duration_s) && m.duration_s > 0 ? m.duration_s / total : null,
      duration_s: finite(m.duration_s) ? m.duration_s : null,
      samples: m.samples ?? null,
    })),
    basis: known[0].durationBasis || 'sample steps',
    total_s: total,
  };
}

export function courseFrames(joints, { filter = 'all', selectedId = null } = {}) {
  const list = joints || [];
  const shown = list.filter(j => filter === 'all' || j.kind === filter);
  const lengths = shown.map(j => j.length_m).filter(finite);
  const maxLen = lengths.length ? Math.max(...lengths) : 0;
  return {
    filter,
    frames: shown.map(j => ({
      id: j.id,
      index: j.index,
      kind: j.kind || 'unknown',
      open: !!j.open,
      selected: j.id === selectedId,
      length_m: finite(j.length_m) ? j.length_m : null,
      bar: finite(j.length_m) && maxLen > 0 ? j.length_m / maxLen : null,
      uncertainty: j.uncertainty || 'unknown',
      method: j.method || '',
    })),
    hiddenSelected: !!(selectedId && !shown.some(j => j.id === selectedId)),
    total: list.length,
  };
}

export function scoreboard(wb, joint, source = {}) {
  const branches = wb?.branches ? Object.values(wb.branches) : [];
  const counts = {};
  for (const b of branches) {
    const st = b?.status || 'pending';
    counts[st] = (counts[st] || 0) + 1;
  }
  const uncertainty = wb?.jointBoundary === 'derived-signals' ? 'estimate'
    : wb?.jointBoundary === 'tubular-tally' ? 'as-reported'
    : wb?.jointBoundary === 'connection-event' ? 'recorded'
    : 'unknown';
  const kpis = [];
  kpis.push({
    id: 'joints',
    label: 'Joints identified',
    value: wb?.jointCount ?? null,
    unit: wb?.jointCount == null ? null : 'intervals',
    denominator: null,
    uncertainty,
    partial: false,
    note: wb?.jointCount == null
      ? 'Joint count is unknown. No number was filled in.'
      : (wb.jointBoundary || 'boundary source not named'),
  });
  const len = joint?.length_m;
  kpis.push({
    id: 'joint-length',
    label: joint?.open ? 'Open joint length' : 'Shown joint length',
    value: round(len),
    unit: finite(len) ? 'm' : null,
    denominator: null,
    uncertainty: joint?.uncertainty || 'unknown',
    partial: false,
    note: joint ? `${joint.method || 'method unknown'} · ${joint.kind || 'kind unknown'}` : 'No joint is selected.',
  });
  const rop = joint?.summary?.meanRop_m_h;
  const ropN = joint?.summary?.ropSamples ?? 0;
  kpis.push({
    id: 'rop',
    label: 'Mean ROP on shown joint',
    value: round(rop),
    unit: finite(rop) ? 'm/h' : null,
    denominator: ropN,
    denominatorLabel: `${ropN} samples`,
    uncertainty: finite(rop) ? (joint?.uncertainty || 'from samples') : 'not in data',
    partial: false,
    note: finite(rop) ? `Mean of ${ropN} ROP samples. Not a target.` : 'No ROP samples on this joint.',
  });
  const dep = wb?.coverage?.depth;
  kpis.push({
    id: 'depth-logs',
    label: 'Depth-log span',
    value: dep && finite(dep.min) && finite(dep.max) ? round(dep.max - dep.min) : null,
    unit: dep && finite(dep.min) ? 'm' : null,
    denominator: dep?.logs?.length ?? 0,
    denominatorLabel: `${dep?.logs?.length ?? 0} depth logs`,
    uncertainty: dep?.partial ? 'partial' : (dep && finite(dep.min) ? 'ingested span' : 'unknown'),
    partial: !!dep?.partial,
    note: 'Depth-indexed logs only. This is not the time-log hole depth.',
    from: finite(dep?.min) ? dep.min : null,
    to: finite(dep?.max) ? dep.max : null,
  });
  const tim = wb?.coverage?.time;
  kpis.push({
    id: 'time-logs',
    label: 'Time-log span',
    value: tim && finite(tim.min) && finite(tim.max) ? round((tim.max - tim.min) / 1000, 0) : null,
    unit: tim && finite(tim.min) ? 's' : null,
    denominator: tim?.logs?.length ?? 0,
    denominatorLabel: `${tim?.logs?.length ?? 0} time logs`,
    uncertainty: tim?.partial ? 'partial' : (tim?.timezones?.includes('unspecified') ? 'timezone unspecified' : (finite(tim?.min) ? 'utc' : 'unknown')),
    partial: !!tim?.partial,
    note: finite(tim?.min) ? `${new Date(tim.min).toISOString()} → ${new Date(tim.max).toISOString()}` : 'No comparable time index.',
  });
  const surveys = joint?.surveys || [];
  const inside = surveys.filter(s => s.withinInterval).length;
  kpis.push({
    id: 'surveys',
    label: 'Surveys on shown joint',
    value: joint ? surveys.length : null,
    unit: joint ? 'stations' : null,
    denominator: wb?.surveys?.length ?? 0,
    denominatorLabel: `${wb?.surveys?.length ?? 0} in the wellbore`,
    uncertainty: surveys.some(s => s.interpolated) ? 'interpolated' : 'not interpolated',
    partial: false,
    note: joint
      ? (inside ? `${inside} inside the joint. ${surveys.length - inside} shown as nearest.` : (surveys.length ? 'None inside. Nearest station only.' : 'No station associated.'))
      : 'No joint is selected.',
  });
  return {
    kpis,
    counts,
    branchTotal: branches.length,
    tag: source.tag || 'UNKNOWN',
    liveVerified: false,
  };
}
