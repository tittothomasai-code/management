// Course-and-scoreboard view of an RTOC context. Original geometry, no franchise artwork.
import { courseFrames, modeTimeline, scoreboard } from './scores.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function finite(n) { return typeof n === 'number' && Number.isFinite(n); }

function figure(kpi) {
  const value = kpi.value == null ? 'unknown' : String(kpi.value);
  const unit = kpi.unit ? ` ${esc(kpi.unit)}` : '';
  const den = kpi.denominatorLabel ? `<small class="den"> · ${esc(kpi.denominatorLabel)}</small>` : '';
  return `<article class="kpi" data-kpi="${esc(kpi.id)}">
    <p class="kpi-label">${esc(kpi.label)}</p>
    <p class="kpi-value">${esc(value)}${unit ? `<span class="unit">${unit}</span>` : ''}${den}</p>
    <p class="kpi-note">${esc(kpi.uncertainty)}${kpi.partial ? ' · partial' : ''}. ${esc(kpi.note)}</p>
  </article>`;
}

function modeBar(joint) {
  const tl = modeTimeline(joint);
  const drawn = tl.segments.filter(s => s.share != null);
  if (!drawn.length) {
    const names = tl.segments.map(s => s.mode).join(', ') || 'none';
    return `<div class="timeline unknown">Mode times are unknown (${esc(names)}). No equal-width bar was drawn.</div>`;
  }
  const segs = drawn.map(s => `<span class="seg m-${esc(s.mode)}" style="flex:${s.share}" title="${esc(s.mode)} ${Math.round(s.duration_s)} s">${esc(s.mode)}</span>`).join('');
  const rest = tl.segments.filter(s => s.share == null).map(s => s.mode);
  const extra = rest.length ? `<p class="fine">Duration unknown for: ${esc(rest.join(', '))}.</p>` : '';
  return `<div class="timeline" role="img" aria-label="Mode durations">${segs}</div><p class="fine">${esc(tl.basis)}. Shares use recorded durations only.</p>${extra}`;
}

function fmtMd(v) { return finite(v) ? v.toFixed(2) + ' m' : 'unknown'; }
function fmtTime(t) {
  if (!t || t.ms == null) return 'unknown' + (t?.source ? ' (' + t.source + ')' : '');
  return `${t.isoUtc || ''} · ${t.source || 'source unknown'}`;
}

export function renderCourseBoard(parts, state) {
  const wb = state.wellbore;
  const joints = wb?.joints || [];
  const shown = state.shown;
  const board = scoreboard(wb, shown, state.source || {});
  const course = courseFrames(joints, { filter: state.filter || 'all', selectedId: shown?.id || null });
  const counts = Object.entries(board.counts).map(([k, n]) => `<span class="chip ${esc(k)}">${esc(k)} ${n}</span>`).join('');

  if (parts.score) {
    parts.score.innerHTML = `<div class="score-ribbon" aria-label="Well scores">${board.kpis.map(figure).join('')}</div>
      <p class="score-foot">Branch tally ${esc(String(board.branchTotal))} · ${counts || 'none'} · tag ${esc(board.tag)} · live store verified: no</p>`;
  }

  if (parts.course) {
    const frames = course.frames.map(f => `<button type="button" class="stage${f.selected ? ' on' : ''}${f.open ? ' live' : ''}" data-joint="${esc(f.id)}" aria-pressed="${f.selected ? 'true' : 'false'}">
      <span class="stage-k">${esc(f.kind)}</span>
      <span class="stage-n">${f.index}</span>
      <span class="stage-bar">${f.bar == null ? '<i class="unk"></i>' : `<i style="width:${Math.round(f.bar * 100)}%"></i>`}</span>
      <span class="stage-len">${f.length_m == null ? 'length unknown' : f.length_m.toFixed(2) + ' m'}</span>
    </button>`).join('');
    const hidden = course.hiddenSelected ? '<p class="filter-note">The selected joint is hidden by this filter. The selection itself is unchanged.</p>' : '';
    parts.course.innerHTML = `<div class="rail" aria-label="Joint course">${frames || '<p class="filter-note">No joints match this filter.</p>'}</div>${hidden}`;
  }

  if (parts.well && wb) {
    const wasOpen = parts.well.querySelector?.('#coverage')?.open;
    const rows = Object.entries(wb.branches).map(([type, br]) => {
      const objs = (br.objects || []).map(o => `${esc(o.uid || '(no uid)')} ${esc(o.status)}${o.reason ? ' — ' + esc(o.reason) : ''}${o.rows ? ' · ' + esc(o.rows) + ' rows' : ''}`).join('<br>') || esc(br.reason || '');
      return `<tr><td>${esc(type)}</td><td><span class="chip ${esc(br.status)}">${esc(br.status)}</span></td><td>${objs}</td></tr>`;
    }).join('');
    const logs = (wb.logs || []).map(l => `<li>${esc(l.name)} · ${esc(l.classification || l.indexKind)} · ${esc(l.dataStatus)}${l.reason ? ' (' + esc(l.reason) + ')' : ''} · ${l.rows} rows · ${l.pages} pages · gaps ${l.gapCount}</li>`).join('');
    const unknown = [...(wb.unknowns || []), ...(wb.jointUnknowns || [])].map(u => `<li>${esc(u)}</li>`).join('') || '<li>none recorded</li>';
    const dep = wb.coverage?.depth;
    const tim = wb.coverage?.time;
    parts.well.innerHTML = `<details id="coverage"${wasOpen === false ? '' : ' open'}>
      <summary>Coverage detail for ${esc(wb.name)}</summary>
      <p>Depth-log span ${fmtMd(dep?.min)} → ${fmtMd(dep?.max)}${dep?.partial ? ' · partial' : ''}. Depth-indexed logs only, not the time-log hole depth.</p>
      <p>Time ${tim?.min == null ? 'unknown' : new Date(tim.min).toISOString()} → ${tim?.max == null ? 'unknown' : new Date(tim.max).toISOString()}.</p>
      <p>Curves ${wb.curves?.length || 0}. Surveys ${wb.surveys?.length || 0}. Formations ${wb.formations?.length || 0}. Operations ${wb.operations?.length || 0}. Joints ${wb.jointCount == null ? 'unknown' : wb.jointCount}.</p>
      <table><thead><tr><th>Type</th><th>Status</th><th>Objects</th></tr></thead><tbody>${rows}</tbody></table>
      <h3>Logs</h3><ul>${logs || '<li>none</li>'}</ul>
      <h3>Not known</h3><ul>${unknown}</ul>
    </details>`;
  }

  if (parts.joint) {
    if (!shown) {
      parts.joint.innerHTML = `<div class="stage-card"><h2>Joint unknown</h2><p>No joint was identified. Count: ${wb?.jointCount == null ? 'unknown' : wb.jointCount}.</p></div>`;
    } else {
      const i = joints.findIndex(j => j.id === shown.id);
      const hist = state.historical;
      const live = joints.find(j => j.open) || joints.at(-1);
      const surveys = (shown.surveys || []).map(s => `<li>MD ${fmtMd(s.md_m)} · inc ${s.incl_deg ?? 'unknown'}° · azi ${s.azi_deg ?? 'unknown'}° · ${s.withinInterval ? 'inside joint' : 'nearest, ' + (finite(s.distance_m) ? s.distance_m.toFixed(2) : 'unknown') + ' m away'} · ${esc(s.alignedBy || 'depth')} · not interpolated</li>`).join('') || '<li>none associated</li>';
      const banner = hist ? `<div class="hist">Historical snapshot frozen. Live end is now ${fmtMd(live?.endMd_m)}. This view stays at ${fmtMd(shown.endMd_m)}.</div>` : '';
      parts.joint.innerHTML = `${banner}<article class="stage-card">
        <p class="eyebrow">${shown.open ? 'Open joint' : 'Joint'} ${i + 1} of ${joints.length}</p>
        <h2>${esc(shown.kind)} · ${fmtMd(shown.length_m)}</h2>
        <p class="fine">${esc(shown.kindSource || '')} · ${esc(shown.boundarySource || '')} · ${esc(shown.method || '')} · ${esc(shown.uncertainty || '')}</p>
        ${modeBar(shown)}
        <dl class="facts">
          <div><dt>Start depth</dt><dd>${fmtMd(shown.startMd_m)}</dd></div>
          <div><dt>End depth</dt><dd>${fmtMd(shown.endMd_m)}</dd></div>
          <div><dt>Start time</dt><dd>${esc(fmtTime(shown.startTime))}</dd></div>
          <div><dt>End time</dt><dd>${esc(fmtTime(shown.endTime))}</dd></div>
        </dl>
        ${shown.timeNote ? `<p class="fine">${esc(shown.timeNote)}</p>` : ''}
        <h3>Surveys</h3><ul>${surveys}</ul>
        <h3>Joint series</h3><canvas id="chart" width="640" height="150"></canvas>
      </article>`;
    }
  }
  return { board, course };
}

export function drawSeries(canvas, joint) {
  if (!canvas || !joint) return;
  const s = (joint.series || []).find(x => x.mnemonic === 'ROPA') || (joint.series || []).find(x => x.mnemonic === 'GR') || (joint.series || [])[0];
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#d7c7a1';
  g.font = '12px system-ui, sans-serif';
  if (!s || !s.points.some(p => Number.isFinite(p.v))) { g.fillText('No numeric series inside this joint.', 12, 24); return; }
  const pts = s.points.filter(p => Number.isFinite(p.v) && Number.isFinite(p.md));
  if (!pts.length) { g.fillText('Series has no depth index to plot.', 12, 24); return; }
  const xs = pts.map(p => p.md);
  const ys = pts.map(p => p.v);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  g.fillText(`${s.mnemonic} (${s.unit || 'unit unknown'}) · ${pts.length} points`, 12, 16);
  g.strokeStyle = '#e2b657';
  g.lineWidth = 2;
  g.beginPath();
  pts.forEach((p, i) => {
    const x = 16 + (maxX === minX ? 0 : (p.md - minX) / (maxX - minX)) * (canvas.width - 28);
    const y = 28 + (maxY === minY ? 0 : (maxY - p.v) / (maxY - minY)) * (canvas.height - 40);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  });
  g.stroke();
}
