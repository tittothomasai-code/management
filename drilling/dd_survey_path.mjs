// Local E, N, TVD (positive down) in metres. Azimuth is clockwise from north.
import { vec, minCurve, steer, dogleg, R, D } from './ddcab_core.js?v=b11';

const finite = Number.isFinite;
const keys = ['E', 'N', 'tvd'];
const eps = 1e-7;
function validSurvey(s) {
  return (
    s?.src === 'SIM' &&
    [s.md, s.inc, s.azi, s.tvd].every(finite) &&
    s.md >= 0 &&
    s.inc >= 0 &&
    s.inc <= 180 &&
    s.azi >= 0 &&
    s.azi <= 360
  );
}

// Integrate a fraction of the same great-circle tangent arc used by minCurve.
function arc(a, b, md) {
  if (md <= a.md) return a;
  if (md >= b.md) return b;
  const u = (md - a.md) / (b.md - a.md);
  const p = vec(a.inc, a.azi),
    q = vec(b.inc, b.azi);
  const angle = dogleg(a.inc, a.azi, b.inc, b.azi) * R;
  const weight = (v) => (angle < 1e-7 ? v : Math.sin(v * angle) / Math.sin(angle));
  const v = p.map((n, i) => weight(1 - u) * n + weight(u) * q[i]);
  return minCurve(a, md, Math.atan2(Math.hypot(v[0], v[1]), v[2]) * D, Math.atan2(v[0], v[1]) * D);
}

function integrateDrilling(a, b, log) {
  let p = a,
    slide = 0;
  const nodes = [a];
  for (const row of log) {
    const { from, to, mode, tf, yieldDls } = row;
    if (![from, to].every(finite) || to <= from || Math.abs(from - p.md) > eps || to > b.md + eps)
      return null;
    let direction = p;
    if (mode === 'slide') {
      if (!finite(tf) || !finite(yieldDls) || yieldDls < 0 || (yieldDls * (to - from)) / 30 >= 179)
        return null;
      direction = steer(p.inc, p.azi, yieldDls, tf, to - from);
      slide += to - from;
    } else if (mode !== 'rotate') return null;
    p = minCurve(p, to, direction.inc, direction.azi);
    nodes.push({ ...p, mode, tf: mode === 'slide' ? tf : null });
  }
  if (nodes.length < 2 || Math.abs(p.md - b.md) > eps) return null;
  return { nodes, slide, rotate: b.md - a.md - slide };
}

export function pathPoint(seg, md, layer = 'derived') {
  if (!finite(md) || md < seg.a.md || md > seg.b.md) return null;
  if (layer === 'reference') return arc(seg.refA, seg.refB, md);
  if (md === seg.a.md) return seg.a;
  if (md === seg.b.md) return seg.b;
  const nodes = seg.nodes;
  let lo = 0,
    hi = nodes.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (nodes[mid].md < md) lo = mid;
    else hi = mid;
  }
  const base = arc(nodes[lo], nodes[hi], md);
  const length = seg.b.md - seg.a.md,
    t = (md - seg.a.md) / length;
  // Cubic closure preserves initial direction and exactly matches final position and tangent.
  const posWeight = t * t * (3 - 2 * t),
    tangentWeight = t * t * (t - 1) * length;
  const point = { md };
  keys.forEach((key, i) => {
    point[key] = base[key] + posWeight * seg.positionError[i] + tangentWeight * seg.tangentError[i];
  });
  return point;
}

export class SurveyPath {
  constructor(tie, first, standM) {
    this.tie = { md: tie.md, E: tie.E, N: tie.N };
    this.standM = standM;
    this.anchors = [];
    this.segments = [];
    this.gamma = [];
    this.pending = [];
    this.issue = '';
    this.duplicates = 0;
    if (!validSurvey(first) || ![tie.md, tie.E, tie.N].every(finite) || Math.abs(first.md - tie.md) > 0.051) {
      this.issue = 'Kickoff survey or horizontal tie-in unavailable';
      return;
    }
    const a = { ...first, E: tie.E, N: tie.N };
    this.anchors.push(a);
    this.reference = a;
  }

  record(from, to, mode, tf, yieldDls) {
    if (!this.issue) this.pending.push({ from, to, mode, tf, yieldDls });
  }

  addGamma(sample) {
    const p = sample?.packet;
    if (
      !p ||
      this.issue ||
      !finite(p.sensorMd) ||
      p.sensorMd !== sample.md ||
      p.sensorMd < this.anchors[0].md ||
      p.sensorMd <= (this.gamma.at(-1)?.md ?? -Infinity)
    )
      return;
    const updated = sample.updated === true && [p.gamma, sample.mean, sample.half95].every(finite);
    this.gamma.push({
      md: p.sensorMd,
      raw: p.gamma,
      mean: updated ? sample.mean : null,
      half95: updated ? sample.half95 : null,
      updated,
      status: sample.status
    });
  }

  addSurvey(s) {
    if (this.issue) return;
    const a = this.anchors.at(-1);
    const length = s?.md - a.md;
    if (!validSurvey(s)) this.issue = 'Invalid survey';
    else if (
      length === 0 &&
      s.inc === a.inc &&
      s.tvd === a.tvd &&
      (s.inc === 0 || s.inc === 180 || (s.azi - a.azi) % 360 === 0)
    ) {
      this.duplicates++;
      return;
    } else if (length <= 0) this.issue = 'Conflicting or reordered survey';
    else if (length > this.standM + 0.101) this.issue = 'Survey gap exceeds one stand';
    else if (Math.abs(s.tvd - a.tvd) > length + 0.101)
      this.issue = 'Survey TVD change exceeds drilled interval';
    else if (dogleg(a.inc, a.azi, s.inc, s.azi) > 179) this.issue = 'Ambiguous near-opposite directions';
    if (this.issue) {
      this.pending = [];
      return;
    }

    const refA = this.reference,
      refB = minCurve(refA, s.md, s.inc, s.azi);
    const b = { ...s, E: refB.E, N: refB.N };
    const drilled = integrateDrilling(a, b, this.pending);
    const nodes = drilled?.nodes ?? [a, minCurve(a, b.md, b.inc, b.azi)];
    const end = nodes.at(-1),
      targetVec = vec(b.inc, b.azi),
      endVec = vec(end.inc, end.azi);
    this.segments.push({
      a,
      b,
      refA,
      refB,
      nodes,
      slide: drilled?.slide,
      rotate: drilled?.rotate,
      positionError: keys.map((k) => b[k] - end[k]),
      tangentError: targetVec.map((v, i) => v - endVec[i])
    });
    this.anchors.push(b);
    this.reference = refB;
    this.pending = [];
  }
}
