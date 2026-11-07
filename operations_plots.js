import {cmap} from './wdash_core.js';

const colors = ['#2dd2ff', '#ffbd4a'];
const textColor = '#a9c2d5';
function context(canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.font = '10px system-ui';
  return {c, w, h};
}
const num = (v, digits = 0) => v.toLocaleString('en-AU', {maximumFractionDigits: digits});

export function chart(canvas, track, rows, start, end, axis) {
  const p = context(canvas);
  if (!p) return;
  const {c,w,h} = p;
  const left = 35, right = w - 35, top = 18, bottom = h - 18;
  c.strokeStyle = '#263f53';
  for (let i = 0; i < 4; i++) {
    const y = top + (bottom - top) * i / 3;
    c.beginPath(); c.moveTo(left, y); c.lineTo(right, y); c.stroke();
  }
  c.fillStyle = textColor;
  c.textAlign = 'center';
  c.fillText(axis === 'depth' ? 'MD (m)' : 'Time window', w / 2, h - 3);
  if (Number.isFinite(start) && end > start) {
    const axisLabel = x => axis === 'depth' ? num(x,1) : new Date(x * 1000).toISOString().slice(11,16);
    if (axis !== 'simtime') {
      c.fillText(axisLabel(start), left + 1, h - 3);
      c.fillText(axisLabel(end), right, h - 3);
    }
  }
  let channels = 0;
  track.slice(1).forEach(([key, name, unit], i) => {
    c.fillStyle = colors[i];
    c.textAlign = i ? 'right' : 'left';
    c.fillText(name + ' · ' + unit, i ? w - 8 : 8, 12);
    const usable = rows.filter(r => Number.isFinite(r[key]));
    if (!usable.length || !(end > start)) return;
    channels++;
    let lo = Math.min(...usable.map(r => r[key])), hi = Math.max(...usable.map(r => r[key]));
    const pad = Math.max(0.01, (hi - lo) * .09, Math.abs(hi) * .01);
    hi += pad; lo -= pad;
    c.fillText(num(hi,2), i ? w - 3 : left - 31, top + 6);
    c.fillText(num(lo,2), i ? w - 3 : left - 31, bottom);
    c.lineWidth = 1.4; c.strokeStyle = colors[i]; c.beginPath();
    let prev = null;
    for (const r of rows) {
      if (!Number.isFinite(r[key])) { prev = null; continue; }
      const x = left + (r.x - start) * (right - left) / (end - start);
      const y = top + (hi - r[key]) * (bottom - top) / (hi - lo);
      if (prev && r.t - prev.t <= 120 && (axis !== 'depth' || (r.x >= prev.x && r.x - prev.x <= 5))) c.lineTo(x,y);
      else { c.moveTo(x,y); c.lineTo(x + .4,y); }
      prev = r;
    }
    c.stroke();
  });
  if (!channels) {
    c.textAlign = 'center'; c.fillStyle = textColor;
    c.fillText('No mapped samples in this interval', w / 2, (top + bottom) / 2 + 4);
  }
}

export function imageLog(canvas, rows, start, end, bit, hole) {
  const p = context(canvas);
  if (!p) return;
  const {c,w,h} = p;
  const x0 = 10, width = w - 20, bottom = h - 17;
  c.fillStyle = '#0a1421'; c.fillRect(x0, 1, width, bottom);
  if (!(end > start) || !rows.length) {
    c.fillStyle = textColor; c.textAlign = 'center';
    c.fillText('No depth-aligned image bins for this interval', w / 2, 24);
    return;
  }
  const vals = rows.flatMap(r => r.v.filter(Number.isFinite));
  const lo = vals.reduce((a,b) => Math.min(a,b), Infinity), hi = vals.reduce((a,b) => Math.max(a,b), -Infinity);
  const span = end - start, x = d => x0 + width * (d - start) / span;
  const steps = rows.slice(1).map((r,i) => r.md - rows[i].md).filter(s => s > 0).sort((a,b) => a-b);
  const step = steps[Math.floor(steps.length / 2)] || Math.min(.15,span);
  c.save(); c.beginPath(); c.rect(x0, 1, Math.max(0,x(Math.min(end,hole))-x0), bottom); c.clip();
  rows.forEach((r,i) => {
    const col = x(r.md);
    const next = rows[i + 1]?.md ?? r.md + step;
    const cw = Math.max(.5, Math.min(next - r.md, step * 1.75) * width / span);
    r.v.forEach((v,j) => {
      if (!Number.isFinite(v)) return;
      c.fillStyle = 'rgb(' + cmap((v-lo)/(hi-lo || 1)).join(',') + ')';
      c.fillRect(col, 1 + j * bottom / r.v.length, cw + .25, bottom / r.v.length + .25);
    });
  });
  c.restore();
  if (Number.isFinite(bit) && bit >= start && bit <= end) {
    c.fillStyle = colors[0]; c.fillRect(x(bit) - .75, 1, 1.5, bottom);
  }
  c.fillStyle = textColor;
  for (let i = 0, n = w < 540 ? 3 : 7; i <= n; i++) {
    const md = start + span * i / n;
    c.textAlign = i === 0 ? 'left' : i === n ? 'right' : 'center';
    c.fillText(num(md,1) + (i === n ? ' m MD' : ''), x(md), h - 3);
  }
}
