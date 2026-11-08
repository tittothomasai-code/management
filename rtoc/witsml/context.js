// Serializable well context built only from an ingest model. No network, no credentials, no invented quantities.
import { OBJECT_TYPES, coverageRows } from './reader.js';
import { buildJoints } from './joints.js';

const TERMINAL = new Set(['ingested', 'missing', 'unsupported', 'unreadable', 'partial']);

function objs(wb, type) {
  return wb.branches?.[type]?.objects || [];
}

function finite(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function curveCatalog(logs) {
  const out = [];
  for (const log of logs) {
    const names = new Map();
    for (const c of log.curves || []) names.set(c.mnemonic, c.unit || '');
    for (const row of log.rows || []) for (const mn of Object.keys(row.values || {})) if (!names.has(mn)) names.set(mn, row.values[mn].unit || '');
    for (const [mnemonic, unit] of names) {
      if (mnemonic === log.indexCurve) continue;
      out.push({ mnemonic, unit, logUid: log.uid, logName: log.name, indexKind: log.indexKind, classification: log.classification, dataStatus: log.dataStatus });
    }
  }
  return out;
}

function spanSummary(logs, kind) {
  const usable = logs.filter(l => l.indexKind === kind && (l.dataStatus === 'ingested' || l.dataStatus === 'partial'));
  let min = null;
  let max = null;
  const tz = new Set();
  const unitProblems = [];
  for (const log of usable) {
    for (const row of log.rows || []) {
      if (kind === 'time') {
        if (row.index.tz) tz.add(row.index.tz);
        if (finite(row.index.ms)) {
          min = min == null ? row.index.ms : Math.min(min, row.index.ms);
          max = max == null ? row.index.ms : Math.max(max, row.index.ms);
        }
      } else if (finite(row.index.metres)) {
        min = min == null ? row.index.metres : Math.min(min, row.index.metres);
        max = max == null ? row.index.metres : Math.max(max, row.index.metres);
      } else if (row.index.unitStatus && row.index.unitStatus !== 'converted') {
        unitProblems.push({ logUid: log.uid, status: row.index.unitStatus, unit: row.index.unit || '' });
      }
    }
  }
  return {
    kind,
    logs: usable.map(l => l.uid),
    min,
    max,
    unit: kind === 'depth' ? 'm' : 'utc-ms',
    timezones: [...tz],
    unitProblems: unitProblems.slice(0, 8),
    partial: usable.some(l => l.dataStatus === 'partial'),
  };
}

function logHistoryDone(log) {
  if (log.dataStatus === 'pending' || log.dataStatus === 'partial' || log.dataStatus === 'unreadable') return false;
  if (log.dataStatus === 'missing') {
    const s = log.headerSpan;
    if (s?.kind === 'depth' && finite(s.start?.metres) && finite(s.end?.metres) && s.end.metres > s.start.metres) return false;
    if (s?.kind === 'time' && finite(s.start?.ms) && finite(s.end?.ms) && s.end.ms > s.start.ms) return false;
    return true;
  }
  return log.dataStatus === 'ingested';
}

function formationsOf(wb) {
  const out = [];
  for (const f of objs(wb, 'formationMarker')) {
    out.push({
      source: 'formationMarker', uid: f.uid, name: f.name || '',
      mdTop_m: f.mdTop?.len?.metres ?? null, mdBottom_m: f.mdBottom?.len?.metres ?? null,
      topStatus: f.mdTop?.len?.status || 'absent', bottomStatus: f.mdBottom?.len?.status || 'absent',
      lithology: f.lithology || '',
    });
  }
  for (const m of objs(wb, 'mudLog')) {
    for (const g of m.intervals || []) {
      out.push({
        source: 'mudLog', uid: g.uid || m.uid, name: g.lithology || m.name || '',
        mdTop_m: g.mdTop?.len?.metres ?? null, mdBottom_m: g.mdBottom?.len?.metres ?? null,
        topStatus: g.mdTop?.len?.status || 'absent', bottomStatus: g.mdBottom?.len?.status || 'absent',
        lithology: g.lithology || '',
        parentUid: m.uid,
      });
    }
  }
  return out;
}

function surveysOf(wb) {
  const out = [];
  for (const t of objs(wb, 'trajectory')) {
    for (const s of t.stations || []) {
      out.push({
        trajectoryUid: t.uid, stationUid: s.uid || '',
        md_m: s.md?.len?.metres ?? null, mdStatus: s.md?.len?.status || 'absent',
        tvd_m: s.tvd?.len?.metres ?? null, tvdStatus: s.tvd?.len?.status || 'absent',
        incl_deg: s.incl?.degrees ?? null, azi_deg: s.azi?.degrees ?? null,
        time: s.time?.ms != null ? { ms: s.time.ms, isoUtc: s.time.isoUtc, tz: s.time.tz } : { ms: null, isoUtc: null, tz: s.time?.tz || 'absent' },
        interpolated: false,
      });
    }
  }
  return out;
}

function operationsOf(wb) {
  const out = [];
  for (const r of objs(wb, 'opsReport')) {
    for (const a of r.activities || []) {
      out.push({
        reportUid: r.uid, activityUid: a.uid || '',
        code: a.code || '', phase: a.phase || '',
        start: a.start?.ms != null ? { ms: a.start.ms, isoUtc: a.start.isoUtc, tz: a.start.tz } : { ms: null, tz: a.start?.tz || 'absent', raw: a.start?.raw || '' },
        end: a.end?.ms != null ? { ms: a.end.ms, isoUtc: a.end.isoUtc, tz: a.end.tz } : { ms: null, tz: a.end?.tz || 'absent', raw: a.end?.raw || '' },
        md_m: a.md?.len?.metres ?? null, mdStatus: a.md?.len?.status || 'absent',
        commentsKept: false,
      });
    }
  }
  return out;
}

function branchView(br) {
  if (!br) return { status: 'pending', reason: 'not visited', count: 0 };
  return {
    status: br.status,
    reason: br.reason || '',
    count: br.objects?.length || 0,
    objects: (br.objects || []).map(o => ({
      uid: o.uid || '',
      name: o.name || '',
      status: o.dataStatus || o.status || br.status,
      reason: o.reason || '',
      indexKind: o.indexKind || '',
      classification: o.classification || '',
      pages: o.pages || 0,
      rows: o.rows?.length || o.stations?.length || o.intervals?.length || o.components?.length || 0,
      curves: (o.curves || []).map(c => ({ mnemonic: c.mnemonic, unit: c.unit || '' })),
    })),
  };
}

export function buildContext(model) {
  const rows = coverageRows(model);
  const wells = [];
  let historyComplete = model.status === 'ingested' || model.status === 'missing';
  let inventoryComplete = model.status === 'ingested' || model.status === 'missing';
  if (model.status === 'pending' || model.status === 'unreadable' || model.cancelled) {
    inventoryComplete = false;
    historyComplete = false;
  }
  for (const w of model.wells || []) {
    if (!TERMINAL.has(w.status)) inventoryComplete = false;
    const wellbores = [];
    for (const wb of w.wellbores || []) {
      if (!TERMINAL.has(wb.status)) inventoryComplete = false;
      for (const t of OBJECT_TYPES) {
        const st = wb.branches?.[t]?.status;
        if (!st || !TERMINAL.has(st)) inventoryComplete = false;
      }
      const logs = objs(wb, 'log');
      if (logs.some(l => !logHistoryDone(l))) historyComplete = false;
      if (objs(wb, 'trajectory').some(t => t.dataStatus === 'partial' || t.dataStatus === 'unreadable' || t.dataStatus === 'pending')) historyComplete = false;
      const unknowns = [];
      if ((wb.branches?.log?.status) === 'unreadable') unknowns.push('log branch unreadable: ' + (wb.branches.log.reason || ''));
      if ((wb.branches?.log?.status) === 'missing') unknowns.push('no logs returned (empty success, not a failed query)');
      if (logs.some(l => l.indexKind === 'unknown')) unknowns.push('at least one log has an unrecognised index type');
      if (logs.some(l => (l.rows || []).some(r => r.index.tz === 'unspecified'))) unknowns.push('at least one time index has no timezone; instants were not assumed');
      if (logs.some(l => l.dataStatus === 'partial')) unknowns.push('at least one log history is partial');
      const jointPack = buildJoints(wb);
      const wbOut = {
        uid: wb.uid,
        name: wb.name,
        status: wb.status,
        reason: wb.reason || '',
        branches: Object.fromEntries(OBJECT_TYPES.map(t => [t, branchView(wb.branches?.[t])])),
        coverage: { depth: spanSummary(logs, 'depth'), time: spanSummary(logs, 'time') },
        logs: logs.map(l => ({
          uid: l.uid, name: l.name, indexKind: l.indexKind, classification: l.classification,
          dataStatus: l.dataStatus, reason: l.reason || '', pages: l.pages || 0,
          rows: l.rows?.length || 0, duplicateCount: l.duplicateCount || 0, relogCount: l.relogCount || 0,
          overlapSkipped: l.overlapSkipped || 0, gapCount: l.gaps?.length || 0,
          headerSpan: l.headerSpan || null, ingestedSpan: l.ingestedSpan || null,
          curves: (l.curves || []).map(c => c.mnemonic),
        })),
        curves: curveCatalog(logs),
        surveys: surveysOf(wb),
        formations: formationsOf(wb),
        operations: operationsOf(wb),
        modes: jointPack.modes,
        gaps: logs.flatMap(l => (l.gaps || []).map(g => ({ logUid: l.uid, from: g.from?.raw ?? g.from, to: g.to?.raw ?? g.to, delta: g.delta }))),
        joints: jointPack.joints,
        jointCount: jointPack.jointCount,
        jointUnknowns: jointPack.unknowns,
        jointBoundary: jointPack.boundarySource || '',
        jointRejected: jointPack.rejected || [],
        unplacedComponents: jointPack.unplaced || [],
        unknowns,
      };
      wellbores.push(wbOut);
    }
    wells.push({ uid: w.uid, name: w.name, status: w.status, reason: w.reason || '', wellbores });
  }
  if ((model.wells || []).some(w => w.status === 'unreadable')) historyComplete = false;
  return {
    schema: 'rtoc-context/1',
    generatedAt: model.generatedAt,
    source: {
      protocol: model.protocol,
      versionReported: model.version,
      unsupportedProtocols: model.unsupportedProtocols,
      tag: model.tag,
      tagNote: model.tagNote || '',
      cap: model.cap,
      liveVerified: false,
      calls: model.calls?.length || 0,
      cancelled: !!model.cancelled,
      limits: model.limits,
    },
    inventoryComplete,
    historyComplete,
    coverage: rows,
    wells,
  };
}
