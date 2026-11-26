import { pathPoint } from './dd_survey_path.mjs';

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const colors = { anchors: '#f5f2e9', derived: '#62dfc0', reference: '#dca5ff', plan: '#738bb8' };
const layers = [
  ['anchors', 'Survey anchors'],
  ['derived', 'Robotyx path'],
  ['reference', 'Minimum curvature'],
  ['gamma', 'Gamma at sensor MD'],
  ['plan', 'Track plan']
];
const gammaColor = (v) => 'hsl(' + (210 - 170 * Math.max(0, Math.min(1, v / 150))) + ' 90% 64%)';

export const surveyPanel = `<details class="drPath"><summary>Robotyx survey path · 3D <small>SIMULATED</small></summary>
<div class="pathLayers">${layers.map(([key, label]) => `<label><input type="checkbox" data-layer="${key}" ${key === 'plan' ? '' : 'checked'}><span style="color:${colors[key] || '#eebd66'}">${label}</span></label>`).join('')}</div>
<canvas tabindex="0" aria-label="3D survey trajectory. Drag or use arrow keys to orbit. Tap a station or segment to inspect."></canvas>
<div class="rw"><button type="button" data-view="in" aria-label="Zoom in">+</button><button type="button" data-view="out" aria-label="Zoom out">−</button><button type="button" data-view="fit">Fit view</button><small>Drag to orbit · tap to inspect · gamma blue 0 to gold 150+ gAPI · gray ring held</small></div>
<div data-path-status></div><label>Inspect <select data-pick></select></label>
<label data-scrub hidden>Segment MD (m) <input type="range" step="any"></label><button type="button" data-next-gamma hidden>Next gamma sample</button><div data-info></div>
<small>E / N in metres from the game origin · TVD increases down. White stations use reported TVD and survey-computed E/N. The path between stations is inferred. Positional uncertainty is unquantified.</small></details>`;

export const surveyCss = `#ddRun .drPath{background:#101e28;border:1px solid #354859;border-radius:6px;padding:7px 9px;color:#dfebf1}
#ddRun .drPath summary{cursor:pointer;font-weight:650;padding:4px 0}#ddRun .drPath summary small{color:#aebfc9}
#ddRun .pathLayers{display:flex;flex-wrap:wrap;gap:2px 12px}#ddRun .pathLayers label{min-height:32px}
#ddRun .drPath canvas{display:block;width:100%;max-width:none;height:clamp(180px,29vh,340px);touch-action:none;cursor:grab}
#ddRun .drPath button,#ddRun .drPath select{min-height:32px}#ddRun .drPath select{max-width:100%}
#ddRun .drPath [hidden]{display:none}#ddRun .drPath [data-info]{line-height:1.5}
#ddRun .drPath [data-path-status]{color:#e9ce96;margin:4px 0}#ddRun .drPath input[type=range]{width:min(210px,56%)}`;

export function mountSurveyView(section) {
  const $ = (s) => section.querySelector(s),
    canvas = $('canvas'),
    pick = $('[data-pick]'),
    slider = $('[data-scrub] input');
  const active = Object.fromEntries(layers.map(([key]) => [key, $('[data-layer="' + key + '"]')]));
  let run,
    model,
    count = -1,
    yaw,
    pitch,
    zoom,
    hits = [],
    pointer;
  function fit() {
    yaw = -0.6;
    pitch = 0.38;
    zoom = 1;
  }
  fit();

  function options() {
    if (count === model.anchors.length) return;
    const old = pick.value;
    pick.replaceChildren(new Option('Latest survey', 'latest'));
    model.anchors.forEach((s, i) => {
      if (i)
        pick.add(
          new Option('Interval ' + fmt(model.anchors[i - 1].md, 1) + '–' + fmt(s.md, 1) + ' m', 'i' + (i - 1))
        );
      pick.add(new Option('Survey ' + fmt(s.md, 1) + ' m', 's' + i));
    });
    pick.value = old && Array.from(pick.options).some((o) => o.value === old) ? old : 'latest';
    count = model.anchors.length;
  }

  function select(key, md) {
    pick.value = key;
    if (key[0] === 'i') {
      const seg = model.segments[Number(key.slice(1))];
      slider.min = seg.a.md;
      slider.max = seg.b.md;
      slider.value = md ?? (seg.a.md + seg.b.md) / 2;
    }
    paint();
  }

  function paint() {
    if (!run || !section.open || !section.isConnected) return;
    options();
    const last = model.anchors.at(-1),
      gamma = model.gamma;
    const tail = last ? Math.max(0, run.bit.md - last.md) : null;
    $('[data-path-status]').textContent = model.issue
      ? model.issue + ' · path stops at last usable anchor.'
      : !model.segments.length
        ? 'Waiting for the next survey to close the first interval.'
        : model.anchors.length +
          ' surveys · path ends at ' +
          fmt(last.md, 1) +
          ' m MD · ' +
          fmt(tail, 1) +
          ' m beyond last survey.';
    if (model.duplicates)
      $('[data-path-status]').textContent += ' Repeated surveys ignored: ' + model.duplicates + '.';
    const interval = pick.value[0] === 'i',
      index = pick.value === 'latest' ? model.anchors.length - 1 : Number(pick.value.slice(1));
    const segment = interval ? model.segments[index] : null;
    const chosen = segment ? pathPoint(segment, Number(slider.value)) : model.anchors[index];
    $('[data-scrub]').hidden = !segment;
    let info = '';
    if (chosen && segment) {
      info =
        'Inferred at MD ' +
        fmt(chosen.md, 1) +
        ' m · E ' +
        fmt(chosen.E) +
        ' / N ' +
        fmt(chosen.N) +
        ' / TVD ' +
        fmt(chosen.tvd) +
        ' m. ';
      const ref = pathPoint(segment, chosen.md, 'reference');
      info +=
        'Offset from minimum curvature ' +
        fmt(Math.hypot(chosen.E - ref.E, chosen.N - ref.N, chosen.tvd - ref.tvd), 3) +
        ' m. ';
      const step = segment.nodes.slice(1).find((row) => chosen.md <= row.md);
      if (step?.mode)
        info +=
          'Logged ' +
          step.mode +
          (step.mode === 'slide' ? ' · effective toolface ' + fmt(step.tf, 1) + '°' : '') +
          '. ';
      info +=
        segment.slide == null
          ? 'Survey-only interpolation · complete drilling coverage unavailable.'
          : 'Depth-matched slide ' + fmt(segment.slide, 1) + ' m / rotate ' + fmt(segment.rotate, 1) + ' m. ';
    } else if (chosen) {
      info =
        'Survey MD ' +
        fmt(chosen.md, 1) +
        ' m · inclination ' +
        fmt(chosen.inc) +
        '° · azimuth ' +
        fmt(chosen.azi) +
        '° · reported TVD ' +
        fmt(chosen.tvd, 1) +
        ' m. ';
      info +=
        (index === 0 ? 'Kickoff tie-in' : 'Minimum-curvature') +
        ' E ' +
        fmt(chosen.E) +
        ' / N ' +
        fmt(chosen.N) +
        ' m.';
    }
    if (chosen) {
      const g = gamma.find((s) => Math.abs(s.md - chosen.md) < 1e-6);
      if (g?.updated)
        info += ` Sensor MD ${fmt(g.md, 1)} m · raw ${fmt(g.raw, 1)} / fused ${fmt(g.mean, 1)} ± ${fmt(g.half95, 1)} gAPI (model 95%).`;
      else if (g)
        info += ` Sensor MD ${fmt(g.md, 1)} m · raw ${fmt(g.raw, 1)} gAPI · ${g.status}. No gamma update.`;
      else info += ' No gamma sample at this exact MD.';
    }
    const nextGamma = $('[data-next-gamma]');
    nextGamma.hidden = !segment;
    if (segment)
      nextGamma.disabled = !gamma.some((g) => g.updated && g.md >= segment.a.md && g.md <= segment.b.md);
    $('[data-info]').textContent = info;

    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    hits = [];
    if (!last) return;
    // Frame in physical 3D units; changing camera angle never stretches TVD relative to E or N.
    const keys = ['E', 'N', 'tvd'],
      mid = {},
      span = [];
    for (const k of keys) {
      let lo = Infinity,
        hi = -Infinity;
      for (const a of model.anchors) {
        lo = Math.min(lo, a[k]);
        hi = Math.max(hi, a[k]);
      }
      mid[k] = (lo + hi) / 2;
      span.push(hi - lo);
    }
    const scale = (Math.max(1, Math.min(w - 52, h - 48)) / Math.max(5, Math.hypot(...span))) * zoom;
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw),
      cp = Math.cos(pitch),
      sp = Math.sin(pitch);
    const rotate = (e, n, z) => [e * cy - n * sy, z * cp - (e * sy + n * cy) * sp];
    const project = (p) => {
      const [x, y] = rotate(p.E - mid.E, p.N - mid.N, p.tvd - mid.tvd);
      return [w / 2 + x * scale, h / 2 + y * scale];
    };
    const line = (points, color, width, dash = []) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const dot = (xy, color, r) => {
      ctx.beginPath();
      ctx.arc(...xy, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    };
    // A horizontal E/N grid at the deepest anchor gives the orbit a depth reference.
    const gridTarget = Math.max(1, Math.hypot(...span) / 6);
    const order = 10 ** Math.floor(Math.log10(gridTarget));
    const spacing = [1, 2, 5, 10].find((v) => v * order >= gridTarget) * order;
    const gridZ = Math.max(...model.anchors.map((a) => a.tvd));
    const grid = (e, n) => project({ E: mid.E + spacing * e, N: mid.N + spacing * n, tvd: gridZ });
    for (let j = -2; j <= 2; j++) {
      line([grid(j, -2), grid(j, 2)], '#20313d', 1);
      line([grid(-2, j), grid(2, j)], '#20313d', 1);
    }
    ctx.font = '11px system-ui';
    ctx.fillStyle = '#9bb0bf';
    ctx.fillText('E/N grid ' + spacing + ' m · TVD ' + fmt(gridZ, 1) + ' m', 10, 16);
    if (active.plan.checked && model.anchors.length > 1) {
      // Draw only consecutive finite plan legs within the anchored MD window.
      for (let i = 1; i < run.plan.length; i++) {
        const a = run.plan[i - 1],
          b = run.plan[i];
        if (
          ![a.md, b.md, ...keys.map((k) => a[k]), ...keys.map((k) => b[k])].every(Number.isFinite) ||
          b.md <= a.md
        )
          continue;
        const lo = Math.max(a.md, model.anchors[0].md),
          hi = Math.min(b.md, last.md);
        if (lo >= hi) continue;
        const sample = (md) =>
          Object.fromEntries(keys.map((k) => [k, a[k] + ((b[k] - a[k]) * (md - a.md)) / (b.md - a.md)]));
        line([project(sample(lo)), project(sample(hi))], colors.plan, 1.5, [6, 4]);
      }
    }
    let gi = 0;
    for (const [i, seg] of model.segments.entries()) {
      const length = seg.b.md - seg.a.md,
        n = Math.max(2, Math.ceil(length));
      const stations = Array.from({ length: n + 1 }, (_, j) =>
        j === n ? seg.b.md : seg.a.md + (length * j) / n
      );
      for (const layer of ['derived', 'reference']) {
        if (!active[layer].checked) continue;
        const positions = stations.map((md) => project(pathPoint(seg, md, layer)));
        line(positions, colors[layer], layer === 'derived' ? 3.5 : 1.5, layer === 'reference' ? [3, 4] : []);
        for (let j = 1; j < positions.length; j++)
          hits.push({
            xy: positions[j - 1],
            end: positions[j],
            key: 'i' + i,
            md: stations[j - 1],
            endMd: stations[j],
            priority: 0
          });
      }
      if (active.gamma.checked)
        while (gi < gamma.length && gamma[gi].md <= seg.b.md) {
          const g = gamma[gi++];
          if (g.md < seg.a.md) continue;
          const xy = project(pathPoint(seg, g.md));
          if (g.updated) dot(xy, gammaColor(g.mean), 2.3);
          else {
            ctx.beginPath();
            ctx.arc(...xy, 3, 0, Math.PI * 2);
            ctx.strokeStyle = '#bcc1c9';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          hits.push({ xy, key: 'i' + i, md: g.md, priority: 1 });
        }
    }
    if (active.anchors.checked)
      model.anchors.forEach((a, i) => {
        const xy = project(a);
        dot(xy, '#182632', 5.5);
        dot(xy, colors.anchors, 3.5);
        hits.push({ xy, key: 's' + i, priority: 2 });
        if (i === 0 || i === model.anchors.length - 1) {
          ctx.fillStyle = colors.anchors;
          ctx.font = '12px system-ui';
          ctx.fillText((i === 0 ? 'Tie-in ' : 'Survey ') + fmt(a.md, 1) + ' m MD', xy[0] + 9, xy[1] + 3);
        }
      });
    if (chosen && (segment ? active.derived.checked : active.anchors.checked)) {
      ctx.beginPath();
      ctx.arc(...project(chosen), 7, 0, 2 * Math.PI);
      ctx.strokeStyle = '#ffe390';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.font = '11px system-ui';
    const target = Math.min(80, w * 0.19) / scale,
      magnitude = 10 ** Math.floor(Math.log10(target));
    const metres = ([5, 2, 1].find((v) => v * magnitude <= target) ?? 1) * magnitude;
    const rulerX = w - 12 - metres * scale;
    line(
      [
        [rulerX, h - 17],
        [rulerX, h - 12],
        [w - 12, h - 12],
        [w - 12, h - 17]
      ],
      '#afc5d3',
      1
    );
    ctx.fillStyle = '#c4d5e2';
    ctx.fillText(metres + ' m', rulerX, h - 20);

    for (const [label, vector, color] of [
      ['E', [1, 0, 0], '#e5b782'],
      ['N', [0, 1, 0], '#a0dfb9'],
      ['D', [0, 0, 1], '#96c6f3']
    ]) {
      const [x, y] = rotate(...vector),
        end = [31 + 18 * x, h - 30 + 18 * y];
      line([[31, h - 30], end], color, 1.5);
      ctx.fillStyle = color;
      ctx.fillText(label, end[0] + 2, end[1] + 2);
    }
  }

  pick.onchange = () => select(pick.value);
  $('[data-next-gamma]').onclick = () => {
    const seg = model.segments[Number(pick.value.slice(1))];
    const points = model.gamma.filter((g) => g.updated && g.md >= seg.a.md && g.md <= seg.b.md);
    const next = points.find((g) => g.md > Number(slider.value) + 1e-7) ?? points[0];
    if (next) select(pick.value, next.md);
  };
  slider.oninput = paint;
  section.ontoggle = paint;
  Object.values(active).forEach((input) => (input.onchange = paint));
  section.querySelectorAll('[data-view]').forEach(
    (button) =>
      (button.onclick = () => {
        if (button.dataset.view === 'fit') fit();
        else zoom = Math.max(0.25, Math.min(16, zoom * (button.dataset.view === 'in' ? 1.45 : 1 / 1.45)));
        paint();
      })
  );
  function orbit(dx, dy) {
    yaw += dx;
    pitch = Math.max(-1.45, Math.min(1.45, pitch + dy));
    paint();
  }
  canvas.onkeydown = (e) => {
    const delta = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, 0.15], ArrowDown: [0, -0.15] }[
      e.key
    ];
    if (delta) {
      e.preventDefault();
      e.stopPropagation();
      orbit(...delta);
    }
  };
  canvas.onpointerdown = (e) => {
    if (pointer || e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: false };
  };
  canvas.onpointermove = (e) => {
    if (pointer?.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x,
      dy = e.clientY - pointer.y;
    if (!pointer.drag && Math.hypot(dx, dy) < 4) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, drag: true };
    orbit(dx * 0.012, dy * 0.012);
  };
  canvas.onpointerup = (e) => {
    if (pointer?.id !== e.pointerId) return;
    if (!pointer.drag) {
      const r = canvas.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top;
      let best = null,
        score = Infinity;
      for (const hit of hits) {
        let [hx, hy] = hit.xy,
          md = hit.md;
        if (hit.end) {
          const dx = hit.end[0] - hx,
            dy = hit.end[1] - hy;
          const t = Math.min(1, Math.max(0, ((x - hx) * dx + (y - hy) * dy) / (dx * dx + dy * dy || 1)));
          hx += t * dx;
          hy += t * dy;
          md += t * (hit.endMd - md);
        }
        const distance = Math.hypot(hx - x, hy - y);
        if (distance <= 13 && distance - hit.priority * 1.8 < score) {
          best = { key: hit.key, md };
          score = distance - hit.priority * 1.8;
        }
      }
      if (best) select(best.key, best.md);
    }
    pointer = null;
  };
  canvas.onlostpointercapture = canvas.onpointercancel = () => {
    pointer = null;
  };
  new ResizeObserver(paint).observe(canvas);
  return (next) => {
    if (run !== next) {
      run = next;
      model = next.surveyPath;
      hits = [];
      pointer = null;
      count = -1;
      pick.replaceChildren();
      fit();
    }
    paint();
  };
}
