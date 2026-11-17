// opsnow_jsurvey.js: per-joint survey values from the geosteering reports (Teams channel, relayed), resolved per joint.
// Source file: ./data/per-joint-surveys.json, written by the geosteer-reports workstream: report survey stations
// interpolated by minimum curvature to each joint; joints without bracketing stations carry status "no survey".
// Order per joint: report value (interpolated between real stations) → live WITSML station inside the joint → "no survey".
// Never extrapolates: no value is carried down from a station above, and no report value deeper than hole MD is used.
// Expected schema (aliases accepted so a field rename does not blank the column):
// {schema: "per-joint-surveys/1", well, wellbore, generated (ISO), method: "minimum curvature", joint_length_m: 13,
//  joints: [{joint, md_top_m, md_base_m, md_m (point the values are at), inc_deg, azi_deg, tvd_m, dls_deg_30m?,
//            status: "interpolated" | "station" | "no survey", source_report, source_time (ISO), bracket?: [{md_m, report}]}]}
const fin = Number.isFinite;
export const URL_DEFAULT = './data/per-joint-surveys.json';
const num = (o, ...ks) => { for (const k of ks) { const v = o?.[k]; if (v != null && v !== '' && fin(Number(v))) return Number(v); } return null; };
const str = (o, ...ks) => { for (const k of ks) { const v = o?.[k]; if (v != null && v !== '') return String(v); } return ''; };
export function parse(doc, {well, wellbore} = {}) {
  if (!doc || typeof doc !== 'object') return {status: 'error', error: 'not a JSON object', entries: []};
  const list = Array.isArray(doc) ? doc : Array.isArray(doc.joints) ? doc.joints : Array.isArray(doc.entries) ? doc.entries : null;
  if (!list) return {status: 'error', error: 'no "joints" array', entries: []};
  const meta = Array.isArray(doc) ? {} : {well: str(doc, 'well', 'well_name'), wellbore: str(doc, 'wellbore', 'wellbore_name'), generated: str(doc, 'generated', 'generated_at', 'updated'),
    method: str(doc, 'method'), jointLen: num(doc, 'joint_length_m', 'jointLength_m', 'jointLength'), schema: str(doc, 'schema')};
  const same = (a, b) => !a || !b || a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase();
  if (!same(meta.well, well) || !same(meta.wellbore, wellbore))
    return {status: 'other-well', error: 'file is for ' + [meta.well, meta.wellbore].filter(Boolean).join(' ') + ', not ' + [well, wellbore].filter(Boolean).join(' '), meta, entries: []};
  // geosteer-reports writer (15 Nov 17:20 shape): {joint, md_from, md_to, top: {md_m, inclination_deg, azimuth_deg, tvd_m, status, bracket, source: [{report_id, time_aest, report_md_m}]}, bottom: {...}}
  // → one point per end (each with its own status), sharing the joint interval.
  const srcTxt = src => Array.isArray(src) && src.length ? src.map(q => 'report ' + (q.time_aest || q.report_id || '') + (q.report_md_m != null ? ' @' + q.report_md_m + ' m' : '')).join(' + ') : str({s: src}, 's');
  const flat = [];
  for (const e of list) {
    if (e && (e.top || e.bottom) && typeof (e.top || e.bottom) === 'object') {
      for (const end of ['top', 'bottom']) { const q = e[end]; if (!q) continue;
        flat.push({joint: e.joint, md_top_m: num(e, 'md_from', 'md_top_m'), md_base_m: num(e, 'md_to', 'md_base_m'), md_m: num(q, 'md_m', 'md'), inc_deg: num(q, 'inclination_deg', 'inc_deg', 'inc'), azi_deg: num(q, 'azimuth_deg', 'azi_deg', 'azi'),
          tvd_m: num(q, 'tvd_m', 'tvd'), status: str(q, 'status'), source_report: srcTxt(q.source), source_time: Array.isArray(q.source) ? '' : '', seam: q.seam ?? null}); }
    } else flat.push({...e, md_top_m: e.md_top_m ?? e.md_from, md_base_m: e.md_base_m ?? e.md_to, inc_deg: e.inc_deg ?? e.inclination_deg, azi_deg: e.azi_deg ?? e.azimuth_deg,
      source_report: e.source_report ?? (Array.isArray(e.source_survey) ? srcTxt(e.source_survey) : e.source_report)});
  }
  const entries = flat.map(e => {
    const top = num(e, 'md_top_m', 'mdTop', 'md_top', 'top_md_m'), base = num(e, 'md_base_m', 'mdBase', 'md_base', 'md_bottom_m', 'base_md_m');
    const md = num(e, 'md_m', 'md', 'survey_md_m') ?? base;
    const inc = num(e, 'inc_deg', 'inc', 'inclination'), azi = num(e, 'azi_deg', 'azi', 'azimuth'), tvd = num(e, 'tvd_m', 'tvd');
    const st = str(e, 'status').toLowerCase();
    const noSv = (/no survey|none|missing/.test(st) && !/interpolated|station/.test(st)) || !fin(inc) || !fin(azi);
    return {joint: num(e, 'joint', 'joint_no', 'n'), top, base, md, inc, azi, tvd, dls: num(e, 'dls_deg_30m', 'dls'), status: noSv ? 'no survey' : (st || 'interpolated'),
      report: str(e, 'source_report', 'report', 'source'), reportTime: str(e, 'source_time', 'report_time')};
  }).filter(e => fin(e.md) || (fin(e.top) && fin(e.base))).sort((a, b) => (a.md ?? a.base) - (b.md ?? b.base));
  return {status: 'ok', meta, entries};
}
// Report entry for a dashboard joint [start, top]: a point inside the joint (closest to its end), else an entry whose
// own joint interval holds this joint's midpoint. Points deeper than `limit` (hole MD) are never used.
export function entryFor(rep, start, top, limit) {
  if (rep?.status !== 'ok' || !rep.entries.length || !fin(start) || !fin(top)) return null;
  const lim = fin(limit) ? limit + 1e-6 : Infinity;
  const inJ = rep.entries.filter(e => fin(e.md) && e.md >= start - 1e-6 && e.md <= top + 1e-6 && (e.md <= lim || e.status === 'no survey'));
  if (inJ.length) return inJ.reduce((a, b) => (Math.abs(b.md - top) < Math.abs(a.md - top) ? b : a));
  const mid = (start + top) / 2;
  const box = rep.entries.find(e => fin(e.top) && fin(e.base) && e.top <= mid && e.base >= mid && (!fin(e.md) || e.md <= lim || e.status === 'no survey'));
  return box || null;
}
// One survey per joint: {src: 'report'|'witsml'|'none', md, inc, azi, tvd, dls, label, reportNote}
export function resolve(j, rep, holeMd) {
  const top = fin(j.end) ? j.end : fin(j.length) ? j.start + j.length : holeMd;
  const e = entryFor(rep, j.start, top, holeMd);
  if (e && e.status !== 'no survey') return {src: 'report', md: e.md, inc: e.inc, azi: e.azi, tvd: e.tvd, dls: e.dls, status: e.status,
    label: e.report || 'geosteering report', report: e.report, reportTime: e.reportTime};
  const w = j.survey;
  if (w && fin(w.inc)) return {src: 'witsml', md: w.md, inc: w.inc, azi: w.azi, tvd: w.tvd ?? w.tvdc ?? null, dls: w.dls ?? null, status: 'station', label: 'WITSML station',
    reportNote: e ? 'report: no survey' : ''};
  return {src: 'none', md: null, inc: null, azi: null, tvd: null, dls: null, status: 'no survey', label: 'no survey', reportNote: e ? 'report: no survey' : ''};
}
// ---------- loader (browser) ----------
const S = {status: 'pending', note: 'per-joint report surveys: pending (file not published yet)', rep: null, at: 0, ver: 0, url: URL_DEFAULT};
export const state = () => S;
export async function load({well, wellbore, url = URL_DEFAULT, onChange} = {}) {
  S.url = url;
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), {cache: 'no-store'});
    if (r.status === 404) { set('pending', 'per-joint report surveys: pending (file not published yet)', null); }
    else if (!r.ok) set('error', 'per-joint report surveys: HTTP ' + r.status, null);
    else {
      const ct = r.headers.get('content-type') || '';
      const txt = await r.text();
      if (!/json/.test(ct) && /^\s*</.test(txt)) set('pending', 'per-joint report surveys: pending (file not published yet)', null);
      else { const rep = parse(JSON.parse(txt), {well, wellbore});
        set(rep.status === 'ok' ? 'ok' : rep.status, rep.status === 'ok' ? 'per-joint report surveys: ' + rep.entries.filter(e => e.status !== 'no survey').length + ' joints with values, ' + rep.entries.filter(e => e.status === 'no survey').length + ' flagged no survey' + (rep.meta?.generated ? ' · file ' + rep.meta.generated : '') : 'per-joint report surveys not used: ' + rep.error, rep.status === 'ok' ? rep : null); }
    }
  } catch (e) { set('error', 'per-joint report surveys: ' + e.message, null); }
  S.at = Date.now(); onChange?.(); return S;
}
function set(status, note, rep) { const k = JSON.stringify([status, rep?.meta?.generated, rep?.entries?.length]); if (k !== S._k) S.ver++; S._k = k; S.status = status; S.note = note; S.rep = rep; }
