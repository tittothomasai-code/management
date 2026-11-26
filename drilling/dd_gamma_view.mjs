const value = (x, digits = 1) => Number.isFinite(x) ? x.toFixed(digits) : '—';

export const gammaPanel = `<section aria-label="Simulated gamma log" style="background:#0d1620;padding:7px 9px;border-radius:5px">
  <strong>Steering run gamma · SIMULATED</strong> <small>Read-only</small>
  <div data-gamma-reading></div><small data-gamma-status></small>
  <details><summary>Gamma log and depth references</summary>
    <canvas data-gamma-chart width="660" height="135" role="img" aria-label="Recent raw and fused gamma by sensor measured depth"></canvas>
    <div><small>White dots · raw &nbsp; Cyan line · fused &nbsp; Shaded band · model 95%</small></div>
    <div data-gamma-depth></div><div data-gamma-mechanics></div>
    <small>One station per metre. The simulated detector sits 6 m behind the bit. Faster drilling shortens counting time. A change in matched, mode-normalized drilling response increases uncertainty at that depth.</small>
  </details></section>`;

function plot(canvas, trace) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h);
  if (!trace.length) return;
  const top = Math.max(50, ...trace.map(s => Math.max(s.packet.gamma ?? 0, (s.mean ?? 0) + (s.half95 ?? 0))));
  const first = trace[0].md, span = Math.max(1, trace.at(-1).md - first);
  const x = s => 8 + (s.md - first) / span * (w - 16);
  const y = v => h - 22 - Math.max(0, v) / top * (h - 27);
  c.fillStyle = '#73ceeb38';
  const estimates = trace.filter(s => Number.isFinite(s.mean));
  if (estimates.length) {
    c.beginPath();
    for (const s of estimates) c.lineTo(x(s), y(s.mean + s.half95));
    for (const s of estimates.slice().reverse()) c.lineTo(x(s), y(s.mean - s.half95));
    c.closePath(); c.fill();
    c.strokeStyle = '#72dbef'; c.lineWidth = 2; c.beginPath();
    for (const s of estimates) c.lineTo(x(s), y(s.mean));
    c.stroke();
  }
  c.fillStyle = '#eef';
  for (const s of trace) if (Number.isFinite(s.packet.gamma)) {
    c.beginPath(); c.arc(x(s), y(s.packet.gamma), 2.5, 0, Math.PI * 2); c.fill();
  }
  c.font = '16px system-ui'; c.fillText(`${value(first)}–${value(trace.at(-1).md)} m sensor MD · 0–${Math.ceil(top)} gAPI`, 6, h - 4);
}

export function renderGamma(el, run) {
  const log = run.gammaLog, s = log.latest, m = s?.packet.mechanics;
  const put = (key, msg) => { el.querySelector('[data-gamma-' + key + ']').textContent = msg; };
  put('reading', `Raw ${value(s?.packet.gamma)} gAPI · Fused ${value(s?.mean)} ± ${value(s?.half95)} gAPI (model 95%)`);
  put('status', `${log.status} · Sensor station MD ${value(s?.md)} m${!run.running && s ? ' · run stopped' : ''}`);
  const survey = run.surveys.at(-1);
  put('depth', `Current bit MD ${value(run.bit.md)} m · Survey MD ${value(survey?.md)} m / TVD ${value(survey?.tvd)} m · Hole depth is not independently measured in DD Training.`);
  put('mechanics', m ? `At acquisition: bit MD ${value(s.packet.bitMd)} m · ${s.packet.mode} · ROP ${value(s.packet.rop)} m/h. At matched sensor MD: ${m.mode} · WOB ${value(m.wob)} t · bit ${value(m.bitRpm, 0)} RPM · flow ${value(m.flow, 0)} L/min · rig ROP ${value(m.referenceRop)} m/h · synthetic formation-response ROP ${value(m.formationRop)} m/h.` : 'Awaiting matched drilling measurements.');
  const chart = el.querySelector('[data-gamma-chart]');
  if (chart.closest('details').open) plot(chart, log.trace);
  chart.closest('details').ontoggle = () => plot(chart, log.trace);
}
