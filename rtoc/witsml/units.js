// Unit and timestamp normalisation for the isolated reader.
// Length factors match units.js / wmlinv.js in the audited tree (ft = 0.3048 m, US survey foot = 1200/3937 m).
// Missing or unknown units are left unconverted. They are never treated as metres.

const FT_US = 1200 / 3937;

const LENGTH = {
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  ft: 0.3048, 'ftus': FT_US, 'ft(us)': FT_US, usft: FT_US,
  in: 0.0254, km: 1000, cm: 0.01, mm: 0.001,
};

const ANGLE = { dega: 1, deg: 1, degree: 1, rad: 180 / Math.PI, radian: 180 / Math.PI };

export function normUom(u) {
  return String(u ?? '').trim().toLowerCase().replace(/µ/g, 'u').replace(/\s+/g, '');
}

export function toMetres(value, uom) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  const rawUnit = uom == null ? '' : String(uom);
  if (!Number.isFinite(n)) return { metres: null, raw: value ?? null, unit: rawUnit, status: 'not-a-number' };
  if (!rawUnit.trim()) return { metres: null, raw: n, unit: '', status: 'unit-missing' };
  const f = LENGTH[normUom(rawUnit)];
  if (f == null) return { metres: null, raw: n, unit: rawUnit, status: 'unconverted' };
  return { metres: n * f, raw: n, unit: rawUnit, status: 'converted' };
}

export function toDegrees(value, uom) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  const rawUnit = uom == null ? '' : String(uom);
  if (!Number.isFinite(n)) return { degrees: null, raw: value ?? null, unit: rawUnit, status: 'not-a-number' };
  if (!rawUnit.trim()) return { degrees: null, raw: n, unit: '', status: 'unit-missing' };
  const f = ANGLE[normUom(rawUnit)];
  if (f == null) return { degrees: null, raw: n, unit: rawUnit, status: 'unconverted' };
  return { degrees: n * f, raw: n, unit: rawUnit, status: 'converted' };
}

/**
 * Parse a WITSML timestamp.
 * Offsets and Z become a UTC instant. A value with no zone is NOT assumed to be UTC or rig local.
 */
export function parseTimestamp(s) {
  const raw = String(s ?? '').trim();
  if (!raw) return { raw: '', ms: null, isoUtc: null, offsetMinutes: null, tz: 'absent' };
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!m) return { raw, ms: null, isoUtc: null, offsetMinutes: null, tz: 'unparsed' };
  const frac = m[7] ? m[7] : '';
  const zone = m[8] || '';
  if (!zone) {
    return { raw, ms: null, isoUtc: null, offsetMinutes: null, tz: 'unspecified' };
  }
  const offsetMinutes = zone === 'Z' ? 0 : (zone.startsWith('-') ? -1 : 1) * (parseInt(zone.slice(1, 3), 10) * 60 + parseInt(zone.slice(4, 6), 10));
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const ms = utc - offsetMinutes * 60 * 1000 + (frac ? Math.round(parseFloat(frac) * 1000) : 0);
  return { raw, ms, isoUtc: new Date(ms).toISOString(), offsetMinutes, tz: zone === 'Z' ? 'utc' : 'offset' };
}

export function isoFromMs(ms) {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
