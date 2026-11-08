// Fuller WITSML 1.4.1.1 reader. Reference: wwell.js v5.12.20 and wmlinv.js v5.9.2.3 at e0ae66a.
// Differences from that code, on purpose:
//   - inventory is per well, per wellbore, per object type, not only the newest log window
//   - log history is paged from the header start, with a no-progress stop
//   - an empty successful response is "missing"; a fault is "unreadable"; GetCap omission is "unsupported"
//   - credentials are not a parameter of this module
// WITSML 2.0 / ETP is not implemented. This module does not claim otherwise.

import { attr, emptyPlural, escapeXml, looksTruncated, tagAll, tagText, unescapeXml } from './xml.js';
import { parseTimestamp, toDegrees, toMetres } from './units.js';

export const PROTOCOL = 'WITSML 1.4.1.1 SOAP';
export const UNSUPPORTED_PROTOCOLS = ['WITSML 2.0', 'ETP 1.2'];
export const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';

/** Object types inventoried per wellbore. Same set as wmlinv.js TYPES. */
export const OBJECT_TYPES = ['trajectory', 'log', 'mudLog', 'formationMarker', 'bhaRun', 'tubular', 'rig', 'wbGeometry', 'fluidsReport', 'opsReport', 'message', 'risk', 'cementJob', 'attachment'];

export const READ_OPS = ['WMLS_GetVersion', 'WMLS_GetCap', 'WMLS_GetFromStore'];

export const DEFAULT_LIMITS = {
  maxReturnNodes: 500,
  maxPagesPerObject: 40,
  maxRowsPerLog: 20000,
  maxStations: 5000,
  maxIntervals: 5000,
  concurrency: 3,
  delayMs: 0,
};

const SECRET_KEY = /pass|pwd|secret|token|authorization|credential|cookie/i;

const PLURAL = {
  trajectory: 'trajectorys',
  well: 'wells',
  wellbore: 'wellbores',
};

function plural(type) {
  return PLURAL[type] || type + 's';
}

export function scrub(value, extra = []) {
  let s = String(value ?? '');
  for (const k of extra) if (k && String(k).length > 1) s = s.split(String(k)).join('***');
  s = s.replace(/(Basic\s+)[A-Za-z0-9+/=]{6,}/gi, '$1***');
  s = s.replace(/((?:password|passwd|pwd|secret|token|authorization)\s*[=:]\s*)(\S+)/gi, '$1***');
  return s;
}

function safeOpts(opts) {
  const out = {};
  for (const [k, v] of Object.entries(opts || {})) {
    if (SECRET_KEY.test(k)) continue;
    if (k === 'signal' || k === 'transport' || typeof v === 'function') continue;
    out[k] = v;
  }
  return out;
}

function unsupportedText(result, supp, message) {
  return /-4(05|24|25|60|65)|not support|unsupported|not implemented/i.test([result, supp, message].filter(x => x != null).join(' '));
}

function sleep(ms, signal) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => { clearTimeout(t); const e = new Error('cancelled'); e.code = 'ABORT'; reject(e); };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pool(items, n, fn, signal) {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length || 1)) }, async () => {
    while (i < items.length) {
      if (signal?.aborted) return;
      const job = items[i++];
      await fn(job);
    }
  });
  await Promise.all(workers);
}

function num(s) {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function indexKindOf(indexType) {
  const t = String(indexType || '');
  if (/date|time/i.test(t)) return 'time';
  if (/depth|length|measured/i.test(t)) return 'depth';
  return 'unknown';
}

/** Name classification only. It never drops a log from the read. */
export function classifyLog(meta) {
  const n = (meta.name || '') + ' ' + (meta.uid || '');
  if (meta.obj === 'trajectory') return 'survey';
  if (meta.obj === 'mudLog') return 'mudlog';
  if (meta.indexKind === 'time' && /real\s*-?time|\blive\b|\brt\b|_rt\b|realtime/i.test(n)) return 'realtime';
  if (/survey|traj/i.test(n)) return 'survey';
  if (/mud\s*log|mudlog|\bgas\b|lith/i.test(n)) return 'mudlog';
  if (/\bfe\b|formation\s*eval|wireline|\blwd\b|petro|resist|gamma|neutron|density|sonic|image/i.test(n)) return 'fe';
  if (meta.indexKind === 'time') return 'time';
  if (meta.indexKind === 'depth') return 'depth';
  return 'other';
}

function measureText(body, tag) {
  const el = tagAll(body, tag)[0];
  if (!el) return null;
  const uom = attr(el.attr, 'uom');
  const text = unescapeXml(el.body).trim();
  return { text, uom, len: toMetres(text, uom) };
}

function rowCmp(meta, row) {
  if (meta.indexKind === 'time') return row.index.ms;
  if (meta.indexKind === 'depth') return row.index.rawNumber;
  return null;
}

function pageMax(parsed, meta) {
  let best = null;
  let raw = null;
  for (const row of parsed) {
    const cmp = rowCmp(meta, row);
    if (typeof cmp === 'number' && Number.isFinite(cmp) && (!best || cmp > best.cmp)) best = { raw: row.index.raw, cmp };
    if (raw == null || String(row.index.raw) > String(raw)) raw = row.index.raw;
  }
  return best || (raw == null ? null : { raw, cmp: null });
}

function beyondCursor(meta, row, cursorRaw, cursorCmp) {
  if (cursorRaw == null && cursorCmp == null) return true;
  const cmp = rowCmp(meta, row);
  if (typeof cmp === 'number' && typeof cursorCmp === 'number') return cmp > cursorCmp + (meta.indexKind === 'depth' ? 1e-9 : 0);
  if (cursorRaw != null) return compareRaw(row.index.raw, cursorRaw) > 0;
  return true;
}

function compareRaw(a, b) {
  if (a == null || b == null) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function rowKey(row) {
  const idx = row.index.ms != null ? 't' + row.index.ms : row.index.metres != null ? 'm' + row.index.metres : 'r' + row.index.raw;
  const vals = Object.keys(row.values).sort().map(k => k + '=' + row.values[k].raw).join(',');
  return idx + '|' + vals;
}

function indexComparable(row) {
  if (row.index.kind === 'time') return row.index.ms;
  if (row.index.kind === 'depth') return row.index.metres != null ? row.index.metres : row.index.rawNumber;
  return row.index.rawNumber ?? row.index.raw;
}

export function buildQuery(type, { well, wellbore, uid = '', inner = '' } = {}) {
  const p = plural(type);
  const wb = wellbore ? ` uidWellbore="${escapeXml(wellbore)}"` : '';
  const w = well ? ` uidWell="${escapeXml(well)}"` : '';
  return `<${p} ${NS}><${type}${w}${wb} uid="${escapeXml(uid)}">${inner}</${type}></${p}>`;
}

function headerInner(type) {
  if (type === 'log') {
    return '<name/><indexType/><indexCurve/><nullValue/><startIndex uom=""/><endIndex uom=""/><startDateTimeIndex/><endDateTimeIndex/><direction/><logCurveInfo uid=""><mnemonic/><unit/><curveDescription/></logCurveInfo>';
  }
  if (type === 'trajectory') return '<name/><mdMn uom=""/><mdMx uom=""/>';
  if (type === 'mudLog') return '<name/><startMd uom=""/><endMd uom=""/>';
  if (type === 'formationMarker') return '<name/><mdTopSample uom=""/><mdBottomSample uom=""/><lithology/>';
  if (type === 'bhaRun') return '<name/><dTimStart/><dTimStop/><numBitRun/>';
  if (type === 'tubular') return '<name/><typeTubularAssy/>';
  if (type === 'rig') return '<name/><typeRig/><owner/>';
  if (type === 'wbGeometry') return '<name/><dTimReport/><mdBottom uom=""/>';
  if (type === 'fluidsReport') return '<name/><dTim/><md uom=""/>';
  if (type === 'opsReport') return '<name/><dTim/><md uom=""/>';
  if (type === 'message') return '<name/><dTim/><typeMessage/><md uom=""/><messageText/><severity/>';
  if (type === 'risk') return '<name/><type/><category/><mdBitStart uom=""/><severityLevel/><summary/>';
  if (type === 'cementJob') return '<name/><jobType/><dTimJob/>';
  if (type === 'attachment') return '<name/><fileName/><dTim/><md uom=""/>';
  return '<name/>';
}

function dataInner(meta, cursorRaw) {
  let start = '';
  if (cursorRaw != null && cursorRaw !== '') {
    if (meta.indexKind === 'time') start = `<startDateTimeIndex>${escapeXml(cursorRaw)}</startDateTimeIndex>`;
    else if (meta.indexKind === 'depth') start = `<startIndex uom="${escapeXml(meta.indexUom || '')}">${escapeXml(cursorRaw)}</startIndex>`;
  } else if (meta.indexKind === 'time' && meta.startRaw) start = `<startDateTimeIndex>${escapeXml(meta.startRaw)}</startDateTimeIndex>`;
  else if (meta.indexKind === 'depth' && meta.startRaw != null && meta.startRaw !== '') start = `<startIndex uom="${escapeXml(meta.indexUom || '')}">${escapeXml(meta.startRaw)}</startIndex>`;
  return `${start}<logData><data/></logData>`;
}

function parseCap(xml) {
  const objs = tagAll(xml, 'dataObject').map(o => unescapeXml(o.body).trim()).filter(Boolean);
  return objs.length ? objs : null;
}

function parseIdList(xml, tag) {
  return tagAll(xml, tag).map(el => ({
    uid: attr(el.attr, 'uid'),
    name: tagText(el.body, 'name') || attr(el.attr, 'uid'),
  })).filter(x => x.uid);
}

function curveInfos(body) {
  return tagAll(body, 'logCurveInfo').map(c => ({
    mnemonic: tagText(c.body, 'mnemonic') || attr(c.attr, 'uid'),
    unit: tagText(c.body, 'unit'),
    description: tagText(c.body, 'curveDescription'),
  })).filter(c => c.mnemonic);
}

function parseLogHeader(el) {
  const b = el.body;
  const indexType = tagText(b, 'indexType');
  const indexKind = indexKindOf(indexType);
  const startIdx = tagAll(b, 'startIndex')[0];
  const endIdx = tagAll(b, 'endIndex')[0];
  const startTime = tagText(b, 'startDateTimeIndex');
  const endTime = tagText(b, 'endDateTimeIndex');
  const indexUom = indexKind === 'depth' ? (attr(startIdx?.attr || endIdx?.attr || '', 'uom') || '') : '';
  const startRaw = indexKind === 'time' ? startTime : (startIdx ? unescapeXml(startIdx.body).trim() : '');
  const endRaw = indexKind === 'time' ? endTime : (endIdx ? unescapeXml(endIdx.body).trim() : '');
  const meta = {
    obj: 'log',
    uid: attr(el.attr, 'uid'),
    uidWell: attr(el.attr, 'uidWell'),
    uidWellbore: attr(el.attr, 'uidWellbore'),
    name: tagText(b, 'name'),
    indexType,
    indexKind,
    indexCurve: tagText(b, 'indexCurve'),
    indexUom,
    nullValue: tagText(b, 'nullValue'),
    direction: tagText(b, 'direction'),
    startRaw,
    endRaw,
    curves: curveInfos(b),
  };
  meta.classification = classifyLog(meta);
  meta.headerSpan = spanFromHeader(meta);
  return meta;
}

function spanFromHeader(meta) {
  if (meta.indexKind === 'time') {
    const a = parseTimestamp(meta.startRaw);
    const b = parseTimestamp(meta.endRaw);
    return { kind: 'time', start: a, end: b };
  }
  if (meta.indexKind === 'depth') {
    return { kind: 'depth', start: toMetres(meta.startRaw, meta.indexUom), end: toMetres(meta.endRaw, meta.indexUom) };
  }
  return { kind: 'unknown', start: null, end: null };
}

function splitCells(line) {
  return String(line).split(',').map(c => c.trim());
}

function parseDataRows(logEl, meta) {
  const ld = tagAll(logEl.body, 'logData')[0];
  if (!ld) return [];
  const ml = tagText(ld.body, 'mnemonicList').split(',').map(s => s.trim()).filter(Boolean);
  const ul = tagText(ld.body, 'unitList').split(',').map(s => s.trim());
  const nulls = new Set([meta.nullValue].filter(v => v !== '' && v != null));
  return tagAll(ld.body, 'data').map(d => {
    const cells = splitCells(unescapeXml(d.body.trim()));
    const values = {};
    ml.forEach((mn, i) => {
      if (i === 0) return;
      const raw = cells[i] ?? '';
      const unit = ul[i] || meta.curves.find(c => c.mnemonic === mn)?.unit || '';
      if (raw === '' || nulls.has(raw)) {
        values[mn] = { raw: raw === '' ? null : raw, number: null, unit, status: 'null' };
        return;
      }
      const number = num(raw);
      values[mn] = { raw, number, unit, status: number == null ? 'non-numeric' : 'number' };
    });
    const indexCell = cells[0] ?? '';
    const index = { kind: meta.indexKind, raw: indexCell, unit: meta.indexKind === 'depth' ? (ul[0] || meta.indexUom) : '', ms: null, metres: null, tz: null, rawNumber: num(indexCell) };
    if (meta.indexKind === 'time') {
      const t = parseTimestamp(indexCell);
      index.ms = t.ms;
      index.tz = t.tz;
      index.isoUtc = t.isoUtc;
      index.offsetMinutes = t.offsetMinutes;
    } else if (meta.indexKind === 'depth') {
      const len = toMetres(indexCell, index.unit);
      index.metres = len.metres;
      index.unitStatus = len.status;
    }
    return { index, values };
  });
}

function headerReached(meta, cursorRaw, cursorCmp) {
  if (!meta.endRaw) return false;
  if (meta.indexKind === 'time') {
    const end = parseTimestamp(meta.endRaw);
    if (end.ms != null && cursorCmp != null) return cursorCmp >= end.ms - 1;
    if (cursorRaw != null) return String(cursorRaw) >= String(meta.endRaw);
    return false;
  }
  if (meta.indexKind === 'depth') {
    const end = num(meta.endRaw);
    if (end == null || cursorRaw == null || !Number.isFinite(Number(cursorRaw))) return false;
    return Number(cursorRaw) >= end - 1e-6;
  }
  return false;
}

function gapsOf(rows) {
  const ordered = rows.filter(r => {
    const c = indexComparable(r);
    return typeof c === 'number' && Number.isFinite(c);
  });
  if (ordered.length < 3) return [];
  const deltas = [];
  for (let i = 1; i < ordered.length; i++) deltas.push(indexComparable(ordered[i]) - indexComparable(ordered[i - 1]));
  const pos = deltas.filter(d => d > 0).sort((a, b) => a - b);
  if (!pos.length) return [];
  const median = pos[Math.floor(pos.length / 2)];
  const minGap = Math.max(median * 3, ordered[0].index.kind === 'time' ? 120000 : 1);
  const gaps = [];
  for (let i = 1; i < ordered.length; i++) {
    const d = indexComparable(ordered[i]) - indexComparable(ordered[i - 1]);
    if (d > minGap) gaps.push({ from: ordered[i - 1].index, to: ordered[i].index, delta: d, medianStep: median });
  }
  return gaps;
}

function dedupSort(rows) {
  const seen = new Set();
  const repeats = [];
  const kept = [];
  let duplicateCount = 0;
  let relogCount = 0;
  for (const row of rows) {
    const key = rowKey(row);
    const idxOnly = key.split('|')[0];
    if (seen.has(key)) { duplicateCount++; continue; }
    if ([...seen].some(k => k.startsWith(idxOnly + '|'))) {
      relogCount++;
      repeats.push(row);
    }
    seen.add(key);
    kept.push(row);
  }
  const comparable = kept.every(r => typeof indexComparable(r) === 'number' && Number.isFinite(indexComparable(r)));
  if (comparable) kept.sort((a, b) => indexComparable(a) - indexComparable(b));
  return { rows: kept, duplicateCount, relogCount, repeats, ordered: comparable };
}

function ingestedSpan(rows) {
  if (!rows.length) return null;
  const kind = rows[0].index.kind;
  const cmp = rows.map(indexComparable).filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!cmp.length) return { kind, start: rows[0].index, end: rows[rows.length - 1].index, comparable: false };
  const lo = Math.min(...cmp);
  const hi = Math.max(...cmp);
  const start = rows.find(r => indexComparable(r) === lo)?.index || rows[0].index;
  const end = rows.find(r => indexComparable(r) === hi)?.index || rows.at(-1).index;
  return { kind, start, end, comparable: true };
}

export function coverageRows(model) {
  const rows = [];
  for (const w of model.wells || []) {
    if (w.status !== 'ingested') {
      rows.push({ well: w.uid, wellbore: '', type: 'well', uid: w.uid, status: w.status, reason: w.reason || '' });
      continue;
    }
    for (const b of w.wellbores || []) {
      if (b.status !== 'ingested') {
        rows.push({ well: w.uid, wellbore: b.uid, type: 'wellbore', uid: b.uid, status: b.status, reason: b.reason || '' });
        continue;
      }
      for (const type of OBJECT_TYPES) {
        const br = b.branches[type];
        if (!br) {
          rows.push({ well: w.uid, wellbore: b.uid, type, uid: '', status: 'pending', reason: 'not visited' });
          continue;
        }
        if (!br.objects?.length) {
          rows.push({ well: w.uid, wellbore: b.uid, type, uid: '', status: br.status, reason: br.reason || '' });
          continue;
        }
        for (const o of br.objects) {
          rows.push({
            well: w.uid, wellbore: b.uid, type, uid: o.uid, name: o.name || '',
            status: o.dataStatus || o.status || br.status,
            indexKind: o.indexKind || '',
            pages: o.pages || 0,
            rows: o.rows?.length || o.stations?.length || 0,
            reason: o.reason || br.reason || '',
          });
        }
      }
    }
  }
  if (!rows.length && model.status) rows.push({ well: '', wellbore: '', type: 'store', uid: '', status: model.status, reason: model.reason || '' });
  return rows;
}

export async function ingest(transport, opts = {}) {
  const limits = { ...DEFAULT_LIMITS, ...(opts.limits || {}) };
  const secrets = [...(opts.redact || [])];
  const signal = opts.signal;
  const calls = [];
  const note = opts.note || (() => {});
  let tag = opts.tag || 'UNKNOWN';
  const generatedAt = opts.generatedAt || new Date().toISOString();

  async function call(op, wmlType, query, options) {
    if (signal?.aborted) {
      const e = new Error('cancelled');
      e.code = 'ABORT';
      throw e;
    }
    if (!READ_OPS.includes(op)) throw Object.assign(new Error('read-only: ' + op), { status: 'unreadable' });
    calls.push({ op, wmlType: wmlType || '', options: options || '' });
    note(op + ' ' + (wmlType || ''));
    let resp;
    try {
      resp = await transport({ op, wmlType, query, options });
    } catch (err) {
      if (err?.code === 'ABORT' || signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'ABORT' });
      return { ok: false, status: 'unreadable', result: null, xml: '', supp: '', message: scrub(err?.message || err, secrets), httpStatus: err?.httpStatus || null };
    }
    if (signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'ABORT' });
    const message = scrub(resp?.error || resp?.message || '', secrets);
    const supp = scrub(resp?.supp || '', secrets);
    const versionText = typeof resp?.version === 'string' ? resp.version : (typeof resp?.result === 'string' && /[A-Za-z.]/.test(resp.result) ? resp.result : '');
    const result = resp?.result == null || resp.result === '' || versionText === resp?.result ? null : Number(resp.result);
    const httpStatus = resp?.httpStatus || null;
    if (httpStatus === 401 || httpStatus === 403 || resp?.auth) {
      return { ok: false, status: 'unreadable', result, xml: '', supp, message: message || 'authentication failed', httpStatus, auth: true };
    }
    if (resp?.error && result == null) {
      return { ok: false, status: unsupportedText(result, supp, message) ? 'unsupported' : 'unreadable', result, xml: resp.xml || '', supp, message, httpStatus };
    }
    if (result != null && result <= 0) {
      return { ok: false, status: unsupportedText(result, supp, message) ? 'unsupported' : 'unreadable', result, xml: resp.xml || '', supp, message: message || supp || ('result ' + result), httpStatus };
    }
    return { ok: true, status: 'ok', result: result == null || Number.isNaN(result) ? 1 : result, xml: resp?.xml || '', supp, version: versionText || resp?.version || '', httpStatus };
  }

  const model = {
    schema: 'rtoc-ingest/1',
    protocol: PROTOCOL,
    unsupportedProtocols: UNSUPPORTED_PROTOCOLS,
    version: null,
    tag,
    tagNote: '',
    generatedAt,
    limits,
    calls,
    cap: { status: 'pending', types: null, reason: '' },
    status: 'pending',
    reason: '',
    wells: [],
    cancelled: false,
  };

  const fillPending = (reason) => {
    for (const w of model.wells) for (const b of w.wellbores || []) {
      for (const t of OBJECT_TYPES) if (!b.branches[t]) b.branches[t] = { type: t, status: 'pending', reason, objects: [] };
    }
  };
  const finishCancelled = (reason) => {
    model.cancelled = true;
    model.status = model.wells.length ? 'partial' : 'pending';
    model.reason = reason || 'cancelled';
    fillPending('cancelled');
    return model;
  };

  try {
    const ver = await call('WMLS_GetVersion', '', '', '');
    if (ver.auth) { model.status = 'unreadable'; model.reason = ver.message; return model; }
    if (ver.ok) {
      const fromXml = tagText(ver.xml || '', 'Result');
      model.version = ver.version || (fromXml && !/^-?\d+$/.test(fromXml) ? fromXml : null) || null;
    }
    if (!ver.ok && ver.status === 'unreadable' && !ver.xml) {
      model.cap = { status: 'unknown', types: null, reason: 'version check failed: ' + (ver.message || ver.supp || '') };
    }

    const cap = await call('WMLS_GetCap', '', '', 'dataVersion=1.4.1.1');
    if (cap.code === 'ABORT') return finishCancelled();
    if (cap.auth) { model.status = 'unreadable'; model.reason = cap.message; return model; }
    if (!cap.ok) model.cap = { status: 'unknown', types: null, reason: cap.message || 'GetCap failed' };
    else {
      const types = parseCap(cap.xml || '');
      model.cap = types ? { status: 'known', types, reason: '' } : { status: 'unknown', types: null, reason: 'GetCap returned no dataObject list' };
    }

    const wellsResp = await call('WMLS_GetFromStore', 'well', buildQuery('well', { inner: '<name/>' }), 'returnElements=requested');
    if (wellsResp.auth) { model.status = 'unreadable'; model.reason = wellsResp.message; return model; }
    if (!wellsResp.ok) { model.status = wellsResp.status; model.reason = wellsResp.message || 'well list failed'; return model; }
    if (looksTruncated(wellsResp.xml)) { model.status = 'unreadable'; model.reason = 'malformed well list'; return model; }
    const wells = parseIdList(wellsResp.xml, 'well');
    if (!wells.length) { model.status = 'missing'; model.reason = 'empty-success'; return model; }

    const forceSim = wells.some(w => /SIM-TEST|SIMULATED|\bSIM\b/i.test(w.name + ' ' + w.uid));
    if (forceSim && tag === 'LIVE') { tag = 'SIM-TEST'; model.tagNote = 'names are synthetic; LIVE tag refused'; }
    else if (/SIM-TEST|SIMULATED|\bSIM\b/i.test(wells.map(w => w.name).join(' '))) tag = tag === 'UNKNOWN' ? 'SIM-TEST' : tag;
    model.tag = tag;

    for (const w of wells) {
      if (signal?.aborted) return finishCancelled();
      const wbResp = await call('WMLS_GetFromStore', 'wellbore', buildQuery('wellbore', { well: w.uid, inner: '<name/>' }), 'returnElements=requested');
      if (wbResp.auth) { model.status = 'unreadable'; model.reason = wbResp.message; return model; }
      const well = { uid: w.uid, name: w.name, status: 'ingested', reason: '', wellbores: [] };
      if (!wbResp.ok) {
        well.status = wbResp.status;
        well.reason = wbResp.message || 'wellbore list failed';
        model.wells.push(well);
        continue;
      }
      if (looksTruncated(wbResp.xml)) {
        well.status = 'unreadable';
        well.reason = 'malformed wellbore list';
        model.wells.push(well);
        continue;
      }
      const wbs = parseIdList(wbResp.xml, 'wellbore');
      if (!wbs.length) {
        well.status = 'missing';
        well.reason = 'empty-success';
        model.wells.push(well);
        continue;
      }
      if (/SIM-TEST|SIMULATED|\bSIM\b/i.test(wbs.map(b => b.name).join(' '))) {
        if (model.tag === 'LIVE') { model.tag = 'SIM-TEST'; model.tagNote = 'names are synthetic; LIVE tag refused'; }
        else if (model.tag === 'UNKNOWN') model.tag = 'SIM-TEST';
      }
      for (const b of wbs) {
        well.wellbores.push({ uid: b.uid, name: b.name, status: 'ingested', reason: '', branches: {} });
      }
      model.wells.push(well);
    }

    const jobs = [];
    for (const well of model.wells) {
      if (well.status !== 'ingested') continue;
      for (const wb of well.wellbores) jobs.push({ well, wb });
    }
    await pool(jobs, limits.concurrency, async ({ well, wb }) => {
      if (signal?.aborted) return;
      await readWellbore(call, well, wb, model.cap, limits, signal, secrets);
    }, signal);

    if (signal?.aborted) return finishCancelled();
    model.status = 'ingested';
    return model;
  } catch (err) {
    if (err?.code === 'ABORT' || signal?.aborted) return finishCancelled(scrub(err.message, secrets));
    model.status = 'unreadable';
    model.reason = scrub(err?.message || err, secrets);
    return model;
  }
}

async function readWellbore(call, well, wb, cap, limits, signal, secrets) {
  for (const type of OBJECT_TYPES) {
    if (signal?.aborted) {
      wb.branches[type] = { type, status: 'pending', reason: 'cancelled', objects: [] };
      continue;
    }
    if (cap.status === 'known' && !cap.types.includes(type)) {
      wb.branches[type] = { type, status: 'unsupported', reason: 'not in GetCap', objects: [] };
      continue;
    }
    let resp;
    try {
      resp = await call('WMLS_GetFromStore', type, buildQuery(type, { well: well.uid, wellbore: wb.uid, inner: headerInner(type) }), 'returnElements=requested');
      if (limits.delayMs) await sleep(limits.delayMs, signal);
    } catch (err) {
      if (err?.code === 'ABORT') {
        wb.branches[type] = { type, status: 'pending', reason: 'cancelled', objects: [] };
        continue;
      }
      throw err;
    }
    if (resp.auth) {
      wb.branches[type] = { type, status: 'unreadable', reason: resp.message, objects: [] };
      wb.status = 'unreadable';
      wb.reason = resp.message;
      return;
    }
    if (!resp.ok) {
      wb.branches[type] = { type, status: resp.status, reason: resp.message || resp.supp || resp.status, objects: [] };
      continue;
    }
    if (looksTruncated(resp.xml) || (!emptyPlural(resp.xml, plural(type)) && !tagAll(resp.xml, type).length && String(resp.xml || '').trim())) {
      wb.branches[type] = { type, status: 'unreadable', reason: 'malformed', objects: [] };
      continue;
    }
    const els = tagAll(resp.xml, type);
    if (!els.length) {
      wb.branches[type] = { type, status: 'missing', reason: 'empty-success', objects: [] };
      continue;
    }
    const objects = [];
    for (const el of els) {
      if (signal?.aborted) break;
      try {
        objects.push(await readObject(call, type, el, well, wb, limits, signal));
      } catch (err) {
        if (err?.code === 'ABORT') {
          objects.push({ uid: attr(el.attr, 'uid'), status: 'pending', dataStatus: 'pending', reason: 'cancelled' });
          break;
        }
        objects.push({ uid: attr(el.attr, 'uid'), status: 'unreadable', dataStatus: 'unreadable', reason: scrub(err.message, secrets) });
      }
    }
    const pending = objects.some(o => o.dataStatus === 'pending' || o.status === 'pending');
    wb.branches[type] = {
      type,
      status: pending ? 'partial' : 'ingested',
      reason: pending ? 'cancelled' : '',
      objects,
    };
  }
}

async function readObject(call, type, el, well, wb, limits, signal) {
  if (type === 'log') return readLog(call, el, well, wb, limits, signal);
  if (type === 'trajectory') return readTrajectory(call, el, well, wb, limits, signal);
  if (type === 'mudLog') return readMudLog(call, el, well, wb, limits, signal);
  if (type === 'tubular') return readTubular(call, el, well, wb, limits, signal);
  if (type === 'opsReport') return readOps(call, el, well, wb, limits, signal);
  if (type === 'formationMarker') return readSimpleMeasured(el, 'formationMarker');
  if (type === 'wbGeometry') return readGeometry(call, el, well, wb, limits, signal);
  return readListed(type, el);
}

function readListed(type, el) {
  return {
    obj: type,
    uid: attr(el.attr, 'uid'),
    name: tagText(el.body, 'name'),
    status: 'ingested',
    dataStatus: 'ingested',
    reason: '',
    fields: {
      dTim: tagText(el.body, 'dTim') || tagText(el.body, 'dTimStart') || tagText(el.body, 'dTimJob') || tagText(el.body, 'dTimReport'),
      dTimStop: tagText(el.body, 'dTimStop'),
      text: tagText(el.body, 'messageText') || tagText(el.body, 'summary'),
      code: tagText(el.body, 'typeMessage') || tagText(el.body, 'type') || tagText(el.body, 'jobType') || tagText(el.body, 'typeTubularAssy') || tagText(el.body, 'typeRig'),
      md: measureText(el.body, 'md') || measureText(el.body, 'mdBitStart') || measureText(el.body, 'mdBottom'),
    },
  };
}

function readSimpleMeasured(el, type) {
  const top = measureText(el.body, 'mdTopSample') || measureText(el.body, 'mdPrognosed');
  const bot = measureText(el.body, 'mdBottomSample');
  return {
    obj: type,
    uid: attr(el.attr, 'uid'),
    name: tagText(el.body, 'name'),
    status: 'ingested',
    dataStatus: 'ingested',
    reason: '',
    mdTop: top,
    mdBottom: bot,
    lithology: tagText(el.body, 'lithology'),
  };
}

async function readLog(call, el, well, wb, limits, signal) {
  const meta = parseLogHeader(el);
  const base = {
    ...meta,
    status: 'partial',
    dataStatus: 'pending',
    reason: '',
    pages: 0,
    rows: [],
    duplicateCount: 0,
    relogCount: 0,
    gaps: [],
    ingestedSpan: null,
  };
  const rows = [];
  let cursorRaw = null;
  let cursorCmp = null;
  let pages = 0;
  while (pages < limits.maxPagesPerObject && rows.length < limits.maxRowsPerLog) {
    if (signal?.aborted) {
      base.dataStatus = 'partial';
      base.reason = 'cancelled';
      base.pages = pages;
      base.rows = rows;
      return base;
    }
    const resp = await call(
      'WMLS_GetFromStore', 'log',
      buildQuery('log', { well: well.uid, wellbore: wb.uid, uid: meta.uid, inner: dataInner(meta, cursorRaw) }),
      'returnElements=data-only;maxReturnNodes=' + limits.maxReturnNodes,
    );
    pages++;
    if (!resp.ok) {
      base.pages = pages;
      base.rows = rows;
      base.dataStatus = rows.length ? 'partial' : 'unreadable';
      base.reason = resp.message || resp.status;
      base.status = base.dataStatus;
      return base;
    }
    if (looksTruncated(resp.xml)) {
      base.pages = pages;
      base.rows = rows;
      base.dataStatus = 'unreadable';
      base.reason = 'malformed';
      base.status = 'unreadable';
      return base;
    }
    const parsed = tagAll(resp.xml, 'log').flatMap(l => parseDataRows(l, meta));
    const fresh = parsed.filter(r => beyondCursor(meta, r, cursorRaw, cursorCmp));
    base.overlapSkipped = (base.overlapSkipped || 0) + (parsed.length - fresh.length);
    if (!parsed.length) {
      base.pages = pages;
      base.reason = rows.length ? '' : 'empty-success';
      break;
    }
    if (!fresh.length) {
      base.pages = pages;
      base.reason = 'no-progress';
      break;
    }
    rows.push(...fresh);
    const max = pageMax(parsed, meta);
    if (!max || (cursorCmp != null && max.cmp != null && !(max.cmp > cursorCmp)) || (max.cmp == null && cursorRaw != null && compareRaw(max.raw, cursorRaw) <= 0)) {
      base.pages = pages;
      base.reason = 'no-progress';
      break;
    }
    cursorRaw = max.raw;
    cursorCmp = max.cmp;
    base.pages = pages;
    const short = parsed.length < limits.maxReturnNodes;
    const reachedNow = headerReached(meta, cursorRaw, meta.indexKind === 'time' ? cursorCmp : num(cursorRaw));
    if (reachedNow) break;
    if (short && !meta.endRaw) break;
  }
  if (pages >= limits.maxPagesPerObject && !headerReached(meta, cursorRaw, meta.indexKind === 'time' ? cursorCmp : num(cursorRaw))) {
    base.reason = base.reason || 'page-cap';
  }
  if (rows.length >= limits.maxRowsPerLog && !headerReached(meta, cursorRaw, meta.indexKind === 'time' ? cursorCmp : num(cursorRaw))) {
    base.reason = base.reason || 'row-cap';
  }
  const packed = dedupSort(rows);
  base.rows = packed.rows;
  base.duplicateCount = packed.duplicateCount;
  base.relogCount = packed.relogCount;
  base.ordered = packed.ordered;
  base.gaps = packed.ordered ? gapsOf(packed.rows) : [];
  base.ingestedSpan = ingestedSpan(packed.rows);
  base.pages = pages;
  const reached = headerReached(meta, cursorRaw, meta.indexKind === 'time' ? cursorCmp : num(cursorRaw));
  const stalled = base.reason === 'no-progress' || base.reason === 'page-cap' || base.reason === 'row-cap' || base.reason === 'short-page-before-header-end' || base.reason === 'cancelled';
  if (!packed.rows.length && base.reason === 'empty-success') {
    base.dataStatus = 'missing';
    base.status = 'missing';
  } else if (stalled || (!reached && meta.endRaw && packed.rows.length)) {
    base.dataStatus = 'partial';
    base.status = 'partial';
  } else {
    base.dataStatus = 'ingested';
    base.status = 'ingested';
    if (base.reason === 'empty-success') base.reason = '';
  }
  return base;
}

async function readTrajectory(call, el, well, wb, limits, signal) {
  if (signal?.aborted) return { uid: attr(el.attr, 'uid'), status: 'pending', dataStatus: 'pending', reason: 'cancelled', stations: [] };
  const resp = await call('WMLS_GetFromStore', 'trajectory', buildQuery('trajectory', { well: well.uid, wellbore: wb.uid, uid: attr(el.attr, 'uid'), inner: '' }), 'returnElements=all;maxReturnNodes=' + limits.maxStations);
  if (!resp.ok) return { uid: attr(el.attr, 'uid'), name: tagText(el.body, 'name'), status: resp.status, dataStatus: resp.status, reason: resp.message || resp.status, stations: [] };
  if (looksTruncated(resp.xml)) return { uid: attr(el.attr, 'uid'), status: 'unreadable', dataStatus: 'unreadable', reason: 'malformed', stations: [] };
  const body = tagAll(resp.xml, 'trajectory')[0]?.body || el.body;
  let stations = tagAll(body, 'trajectoryStation').map(s => {
    const md = measureText(s.body, 'md');
    const tvd = measureText(s.body, 'tvd');
    const incl = toDegrees(tagText(s.body, 'incl'), attr(tagAll(s.body, 'incl')[0]?.attr || '', 'uom') || 'dega');
    const azi = toDegrees(tagText(s.body, 'azi'), attr(tagAll(s.body, 'azi')[0]?.attr || '', 'uom') || 'dega');
    const time = parseTimestamp(tagText(s.body, 'dTimStn') || tagText(s.body, 'dTim'));
    return { uid: attr(s.attr, 'uid'), md, tvd, incl, azi, time, type: tagText(s.body, 'typeTrajStation') };
  });
  stations.sort((a, b) => (a.md?.len?.metres ?? a.md?.len?.raw ?? 0) - (b.md?.len?.metres ?? b.md?.len?.raw ?? 0));
  let capped = false;
  if (stations.length > limits.maxStations) { stations = stations.slice(0, limits.maxStations); capped = true; }
  const dup = new Set();
  let duplicateMd = 0;
  for (const s of stations) {
    const k = s.md?.len?.metres != null ? String(s.md.len.metres) : String(s.md?.len?.raw);
    if (dup.has(k)) duplicateMd++;
    dup.add(k);
  }
  return {
    obj: 'trajectory', uid: attr(el.attr, 'uid'), name: tagText(el.body, 'name') || tagText(body, 'name'),
    status: capped ? 'partial' : 'ingested', dataStatus: capped ? 'partial' : 'ingested', reason: capped ? 'station-cap' : '',
    stations, duplicateMd,
    mdMn: measureText(el.body, 'mdMn'), mdMx: measureText(el.body, 'mdMx'),
  };
}

async function readMudLog(call, el, well, wb, limits, signal) {
  if (signal?.aborted) return { uid: attr(el.attr, 'uid'), status: 'pending', dataStatus: 'pending', reason: 'cancelled', intervals: [] };
  const resp = await call('WMLS_GetFromStore', 'mudLog', buildQuery('mudLog', { well: well.uid, wellbore: wb.uid, uid: attr(el.attr, 'uid') }), 'returnElements=all;maxReturnNodes=' + limits.maxIntervals);
  if (!resp.ok) return { uid: attr(el.attr, 'uid'), name: tagText(el.body, 'name'), status: resp.status, dataStatus: resp.status, reason: resp.message || '', intervals: [] };
  if (looksTruncated(resp.xml)) return { uid: attr(el.attr, 'uid'), status: 'unreadable', dataStatus: 'unreadable', reason: 'malformed', intervals: [] };
  const body = tagAll(resp.xml, 'mudLog')[0]?.body || '';
  let intervals = tagAll(body, 'geologyInterval').map(g => ({
    uid: attr(g.attr, 'uid'),
    mdTop: measureText(g.body, 'mdTop'),
    mdBottom: measureText(g.body, 'mdBottom'),
    lithology: tagText(g.body, 'type') || tagText(g.body, 'lithology'),
    lithPc: num(tagText(g.body, 'lithPc')),
  }));
  let capped = false;
  if (intervals.length > limits.maxIntervals) { intervals = intervals.slice(0, limits.maxIntervals); capped = true; }
  return {
    obj: 'mudLog', uid: attr(el.attr, 'uid'), name: tagText(body, 'name') || tagText(el.body, 'name'),
    status: capped ? 'partial' : 'ingested', dataStatus: capped ? 'partial' : 'ingested', reason: capped ? 'interval-cap' : '',
    intervals,
  };
}

async function readTubular(call, el, well, wb, limits, signal) {
  if (signal?.aborted) return { uid: attr(el.attr, 'uid'), status: 'pending', dataStatus: 'pending', reason: 'cancelled', components: [] };
  const resp = await call('WMLS_GetFromStore', 'tubular', buildQuery('tubular', { well: well.uid, wellbore: wb.uid, uid: attr(el.attr, 'uid') }), 'returnElements=all');
  if (!resp.ok) return { uid: attr(el.attr, 'uid'), name: tagText(el.body, 'name'), status: resp.status, dataStatus: resp.status, reason: resp.message || '', components: [] };
  if (looksTruncated(resp.xml)) return { uid: attr(el.attr, 'uid'), status: 'unreadable', dataStatus: 'unreadable', reason: 'malformed', components: [] };
  const body = tagAll(resp.xml, 'tubular')[0]?.body || '';
  const components = tagAll(body, 'tubularComponent').map(c => ({
    uid: attr(c.attr, 'uid'),
    type: tagText(c.body, 'typeTubularComp'),
    sequence: num(tagText(c.body, 'sequence')),
    len: measureText(c.body, 'len'),
    description: tagText(c.body, 'description'),
  })).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  return {
    obj: 'tubular', uid: attr(el.attr, 'uid'), name: tagText(body, 'name') || tagText(el.body, 'name'),
    typeTubularAssy: tagText(body, 'typeTubularAssy'),
    status: 'ingested', dataStatus: 'ingested', reason: '', components,
  };
}

async function readOps(call, el, well, wb, limits, signal) {
  if (signal?.aborted) return { uid: attr(el.attr, 'uid'), status: 'pending', dataStatus: 'pending', reason: 'cancelled', activities: [] };
  const resp = await call('WMLS_GetFromStore', 'opsReport', buildQuery('opsReport', { well: well.uid, wellbore: wb.uid, uid: attr(el.attr, 'uid') }), 'returnElements=all');
  if (!resp.ok) return { uid: attr(el.attr, 'uid'), name: tagText(el.body, 'name'), status: resp.status, dataStatus: resp.status, reason: resp.message || '', activities: [] };
  if (looksTruncated(resp.xml)) return { uid: attr(el.attr, 'uid'), status: 'unreadable', dataStatus: 'unreadable', reason: 'malformed', activities: [] };
  const body = tagAll(resp.xml, 'opsReport')[0]?.body || '';
  const activities = tagAll(body, 'activity').map(a => ({
    uid: attr(a.attr, 'uid'),
    start: parseTimestamp(tagText(a.body, 'dTimStart')),
    end: parseTimestamp(tagText(a.body, 'dTimEnd')),
    code: tagText(a.body, 'proprietaryCode') || tagText(a.body, 'phase'),
    phase: tagText(a.body, 'phase'),
    comments: tagText(a.body, 'comments'),
    md: measureText(a.body, 'md'),
  }));
  return {
    obj: 'opsReport', uid: attr(el.attr, 'uid'), name: tagText(body, 'name') || tagText(el.body, 'name'),
    dTim: parseTimestamp(tagText(body, 'dTim')),
    md: measureText(body, 'md'),
    status: 'ingested', dataStatus: 'ingested', reason: '', activities,
  };
}

async function readGeometry(call, el, well, wb, limits, signal) {
  if (signal?.aborted) return { uid: attr(el.attr, 'uid'), status: 'pending', dataStatus: 'pending', reason: 'cancelled', sections: [] };
  const resp = await call('WMLS_GetFromStore', 'wbGeometry', buildQuery('wbGeometry', { well: well.uid, wellbore: wb.uid, uid: attr(el.attr, 'uid') }), 'returnElements=all');
  if (!resp.ok) return { uid: attr(el.attr, 'uid'), name: tagText(el.body, 'name'), status: resp.status, dataStatus: resp.status, reason: resp.message || '', sections: [] };
  if (looksTruncated(resp.xml)) return { uid: attr(el.attr, 'uid'), status: 'unreadable', dataStatus: 'unreadable', reason: 'malformed', sections: [] };
  const body = tagAll(resp.xml, 'wbGeometry')[0]?.body || '';
  const sections = tagAll(body, 'wbGeometrySection').map(s => ({
    uid: attr(s.attr, 'uid'),
    type: tagText(s.body, 'typeHoleCasing'),
    mdTop: measureText(s.body, 'mdTop'),
    mdBottom: measureText(s.body, 'mdBottom'),
  }));
  return { obj: 'wbGeometry', uid: attr(el.attr, 'uid'), name: tagText(body, 'name') || tagText(el.body, 'name'), status: 'ingested', dataStatus: 'ingested', reason: '', sections };
}
