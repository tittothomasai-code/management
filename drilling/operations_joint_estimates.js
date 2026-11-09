// Survey-span joint estimates. A measured-depth difference between adjacent stations
// is an estimate of pipe in the ground. It is never one physical joint, and a gap
// is never split into joints. 13 m is the nominal reference used only when no
// usable survey stations exist.
export const JOINT_REFERENCE_M = 13;
// Conversion noise only. 328.084 ft * 0.3048 = 100.0000032 m must collapse onto 100 m.
// This is not the physical joint tolerance below.
export const UNIT_DUPLICATE_M = 5e-5;
// Separate from UNIT_DUPLICATE_M. Not used to merge stations or to invent joints.
export const PHYSICAL_JOINT_TOL_M = 0.5;

const TO_M = {m:1, ft:0.3048, usft:1200/3937, 'ft(us)':1200/3937};

function metres(station) {
  if (!station || !Number.isFinite(station.nativeMd)) return null;
  const factor = TO_M[String(station.uom || '').toLowerCase().trim()];
  return factor == null ? null : station.nativeMd * factor;
}

function blocked(station) {
  return /plan|project|interpolat/i.test(String(station?.typ || ''));
}

function span(start, end) {
  const length = end - start;
  return {
    start, end, length,
    estimated: true,
    jointCount: 'unknown',
    verified: false,
    basis: 'Survey-to-survey measured depth is an estimate, not a joint boundary. The span is not split into joints.',
    referenceEstimate: {
      basis: 'reference-13m',
      rounded: Math.round(length / JOINT_REFERENCE_M),
      verified: false,
      note: 'Reference guess only. Not a source fact and not a joint count.',
    },
  };
}

// stations use the ext4 contract {nativeMd, uom, wb, typ}. Identity is the caller's
// selected well and wellbore. A mismatch, a bad unit, a planned station or a
// reversed MD drops the whole chain so nothing is bridged across the break.
export function surveyIntervals(stations, well, bore, configuredWell) {
  if (!well || !bore || well !== configuredWell || !Array.isArray(stations)) return [];
  const intervals = [];
  let previous = null;
  let previousDatum = null;
  for (const station of stations) {
    if (!station || station.wb !== bore || blocked(station)) return [];
    const md = metres(station);
    if (md == null || md < 0) return [];
    const datum = station.datum || '';
    if (previous != null && datum && previousDatum && datum !== previousDatum) return [];
    if (previous != null) {
      const delta = md - previous;
      if (delta < -UNIT_DUPLICATE_M) return [];
      if (delta > UNIT_DUPLICATE_M) intervals.push(span(previous, md));
    }
    if (previous == null || md - previous > UNIT_DUPLICATE_M) {
      previous = md;
      previousDatum = datum;
    }
  }
  return intervals;
}

// Prospective reference used only when no survey stations are available.
// Not a measured joint and not a count.
export function fallbackInterval(md) {
  if (!Number.isFinite(md) || md < 0) return null;
  return {
    start: md,
    end: md + JOINT_REFERENCE_M,
    length: JOINT_REFERENCE_M,
    estimated: true,
    jointCount: 'unknown',
    verified: false,
    basis: '13 m reference estimate. No usable surveys. Joint count unknown. Not a measured joint.',
  };
}
