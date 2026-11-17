// Existing Robotyx target-threading arc math from well-planning.js, blob 4dd4b006.
// Full precision is retained here instead of worksheet display rounding.
const RAD=x=>x*Math.PI/180,DEG=x=>x*180/Math.PI;
function vTan(inc, azi) { const i = RAD(inc), a = RAD(azi); return [Math.sin(i) * Math.cos(a), Math.sin(i) * Math.sin(a), Math.cos(i)]; }   // [N, E, V↓]
function vIncAzi(t) { const inc = DEG(Math.acos(Math.min(1, Math.max(-1, t[2])))); const azi = (DEG(Math.atan2(t[1], t[0])) + 360) % 360; return { inc, azi }; }
export function arcToPoint(cur, P) {                               // cur:{n,e,tvd,inc,azi}; P:[n,e,tvd]
  const c = [P[0] - cur.n, P[1] - cur.e, P[2] - cur.tvd], cl = Math.hypot(c[0], c[1], c[2]);
  if (cl < 1e-6) return null;
  const ch = [c[0] / cl, c[1] / cl, c[2] / cl], t0 = vTan(cur.inc, cur.azi);
  let dot = t0[0] * ch[0] + t0[1] * ch[1] + t0[2] * ch[2]; dot = Math.min(1, Math.max(-1, dot));
  const phi = Math.acos(dot);                               // angle between tangent and chord
  const t1 = [2 * dot * ch[0] - t0[0], 2 * dot * ch[1] - t0[1], 2 * dot * ch[2] - t0[2]];   // end tangent = chord-reflection of t0
  const bend = 2 * phi, R = phi < 1e-6 ? Infinity : cl / (2 * Math.sin(phi)), L = phi < 1e-6 ? cl : R * bend;
  const dls = L > 0 ? DEG(bend) / L * 30 : 0, ea = vIncAzi(t1);
  return { endInc: ea.inc, endAzi: ea.azi, dls, L, bend: DEG(bend), chord: cl };
}
const v3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// dense stations along the TRUE circular arc from cur through P (tangent rotated
// via Rodrigues). Min-curvature over these reproduces the arc exactly (lands on P),
// unlike linear inc/azi interpolation which drifts on 3-D turns.
export function arcRowsExact(cur, P, step = 30) {
  const c = [P[0] - cur.n, P[1] - cur.e, P[2] - cur.tvd], cl = Math.hypot(c[0], c[1], c[2]);
  if (cl < 1e-6) return { rows: [], dls: 0, bend: 0, L: 0 };
  const ch = [c[0] / cl, c[1] / cl, c[2] / cl], t0 = vTan(cur.inc, cur.azi);
  let d = Math.min(1, Math.max(-1, v3dot(t0, ch))); const phi = Math.acos(d);
  const t1 = [2 * d * ch[0] - t0[0], 2 * d * ch[1] - t0[1], 2 * d * ch[2] - t0[2]];
  const bend = 2 * phi, R = phi < 1e-6 ? Infinity : cl / (2 * Math.sin(phi)), L = phi < 1e-6 ? cl : R * bend;
  const dls = L > 0 ? DEG(bend) / L * 30 : 0;
  let k = v3cross(t0, t1); const kl = Math.hypot(k[0], k[1], k[2]);
  const rows = [], steps = Math.max(1, Math.ceil(L / step));
  if (kl < 1e-9) { const ia = vIncAzi(t0); for (let i = 1; i <= steps; i++) rows.push({ md: (cur.md + L * i / steps), inc: ia.inc, azi: ia.azi }); return { rows, dls, bend: DEG(bend), L }; }
  k = [k[0] / kl, k[1] / kl, k[2] / kl];
  for (let i = 1; i <= steps; i++) {
    const th = bend * i / steps, ct = Math.cos(th), st = Math.sin(th), kxt = v3cross(k, t0), kd = v3dot(k, t0);
    const t = [t0[0] * ct + kxt[0] * st + k[0] * kd * (1 - ct), t0[1] * ct + kxt[1] * st + k[1] * kd * (1 - ct), t0[2] * ct + kxt[2] * st + k[2] * kd * (1 - ct)];
    const ia = vIncAzi(t); rows.push({ md: (cur.md + L * i / steps), inc: ia.inc, azi: ia.azi });
  }
  return { rows, dls, bend: DEG(bend), L };
}
