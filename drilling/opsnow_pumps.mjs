const finite = Number.isFinite;
export function pumpActivity({signed, sample, pressureSample, now = Date.now()}) {
  const usable = s => s && finite(s.value) && s.value >= 0 && !s.blankLatest &&
    (s.indexType === 'depth' || (finite(s.at) && s.at <= now && now-s.at < 120000 && finite(s.previousAt) && s.previousAt < s.at));
  if (!signed) return {state:'unknown',note:'Sign in to receive readings',sample:null};
  const flow=usable(sample), pressure=!flow && usable(pressureSample), selected=flow?sample:pressure?pressureSample:null;
  if (!selected) return {state:'unknown',note:'No usable flow or SPP reading',sample:null};
  return {state:selected.value>0?'on':'off',sample:selected,inferred:pressure,basis:pressure?'spp':'flow',reported:selected.indexType==='depth',
    note:pressure?'Pump activity inferred from SPP; trapped pressure is possible. Numeric flow requires calibration.':'Reported flow-in reading'};
}

export function refreshDepthTail(store, data) {
  const last=store.rows.at(-1);if(!last || store.ml.join(',')!==data.ml.join(','))return false;
  const update=data.rows.find(row=>Math.abs(row[0]-last[0])<1e-9);
  if(!update || JSON.stringify(update)===JSON.stringify(last))return false;
  store.rows[store.rows.length-1]=update.slice();return true;
}

export function pumpSample({rows, channel, latest, time, source}) {
  if (!channel || !latest) return null;
  return {value: latest.v, unit: channel.unit, at: latest.at, previousAt: rows.at(-2)?.[0],
    indexType: time ? 'time' : 'depth', blankLatest: latest.blankLatest, source};
}

export function driveChannel({ml, ul, header, blockChannel}) {
  const col = (ml || []).findIndex((name, i) => i > 0 && /^(TDH|TDPOS|TOP_?DRIVE_?(HEIGHT|POSITION)|TD_?(HEIGHT|POSITION))$/i.test(name.replace(/\s+/g, '')));
  if (col < 0) return blockChannel ? {...blockChannel, kind: 'block'} : null;
  const curve = header?.curves?.find(c => c.mn.toUpperCase() === ml[col].toUpperCase());
  return {col, mn: ml[col], unit: ul?.[col] || curve?.unit || '', nullValue: curve?.nullValue || header?.nullValue || '', kind: 'direct'};
}
const metreFactor = unit => /^(m|metres?|meters?)$/i.test(unit || '') ? 1 : /^(ft|feet|foot|usft|ft_us)$/i.test(unit || '') ? .3048 : /^(mm)$/i.test(unit || '') ? .001 : /^(cm)$/i.test(unit || '') ? .01 : null;
export function driveSample({rows, channel, latest, time, source}) {
  if (!channel || !latest) return null;
  const factor = metreFactor(channel.unit);
  const read = row => {
    const raw = row?.[channel.col];if (raw == null || raw === '') return null;
    const v = Number(raw);return !finite(v) || v === -999.25 || (channel.nullValue !== '' && channel.nullValue != null && v === Number(channel.nullValue)) || factor === null ? null : v * factor;
  };
  const values = rows.map(read).filter(finite);
  return {...pumpSample({rows, channel, latest, time, source}), value: factor === null ? null : latest.v * factor, unit: 'm',
    unitKnown: factor !== null, kind: channel.kind, mnemonic: channel.mn, previousValue: read(rows.at(-2)),
    min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null};
}
export function topDriveActivity({signed, sample, now = Date.now()}) {
  const result = note => ({state: 'unknown', note, sample, ratio: null, direction: null});
  if (!signed || !sample) return result('Position not reported');
  if (!sample.unitKnown) return result('Position units not reported');
  if (!finite(sample.value) || sample.blankLatest) return result('Latest position missing');
  const reported = sample.indexType !== 'time';
  if (!reported && (!finite(sample.at) || sample.at > now || now - sample.at >= 120000)) return result('Position stale');
  if (!reported && (!finite(sample.previousAt) || sample.previousAt >= sample.at)) return result('Waiting for advancing samples');
  const delta = finite(sample.previousValue) ? sample.value - sample.previousValue : null;
  return {state: reported ? 'reported' : 'current', sample, note: sample.kind === 'direct' ? 'Reported top-drive position' : 'Block-height proxy',
    ratio: finite(sample.min) && finite(sample.max) && sample.max - sample.min >= .1 ? Math.max(0, Math.min(1, (sample.value - sample.min) / (sample.max - sample.min))) : null,
    direction: delta === null ? null : delta > .02 ? 'Rising' : delta < -.02 ? 'Lowering' : 'Holding'};
}

export function createPumpGraphic({document: doc = document, host}) {
  const css = doc.createElement('link');css.rel = 'stylesheet';css.href = new URL('./opsnow_pumps.css?v=depth1118', import.meta.url);doc.head.append(css);
  const root = doc.createElement('div');root.id = 'onPumps';root.hidden=true;css.addEventListener('load',()=>{root.hidden=false;});root.dataset.state = 'unknown';root.setAttribute('aria-label', 'Drilling equipment status');
  root.innerHTML = `<div class="on-pump-reminder"><span class="on-pump-dot" aria-hidden="true"></span><div><span data-pump-state role="status" aria-live="polite">Pumps —</span><small data-pump-flow></small></div></div>
    <div class="on-drive"><svg viewBox="0 0 60 72" role="img" aria-label="Top-drive position within the observed travel range"><path class="on-drive-rails" d="M10 6v58M26 6v58M8 6h20M8 64h20M18 8v54"/><g data-drive-marker hidden><rect x="11" width="14" height="8" rx="2"/><path d="M18 8v6m-3 0h6"/></g><text x="32" y="10" data-drive-max></text><text x="32" y="66" data-drive-min></text></svg><div><small class="on-drive-label">Top drive</small><span data-drive-value>—</span><small data-drive-motion></small><small data-drive-source></small></div></div>`;
  host.after(root);
  const set = (selector, value) => { const el = root.querySelector(selector);if (el.textContent !== value) el.textContent = value; };
  return {root, update(input) {
    const pump = pumpActivity(input), sample = pump.sample;root.dataset.state = pump.state;
    set('[data-pump-state]', pump.state === 'on' ? (pump.inferred ? 'Pumps likely on' : 'Pumps on') : pump.state === 'off' ? (pump.inferred ? 'Pumps likely off' : 'Pumps off') : 'Pumps —');
    set('[data-pump-flow]', pump.state !== 'unknown' ? sample.value.toLocaleString('en-AU', {maximumFractionDigits: 1}) + ' ' + (sample.unit || '') + (pump.inferred ? ' · SPP' : '') + (pump.reported ? ' · depth log' : '') : 'No flow / SPP reading');
    root.querySelector('.on-pump-reminder').title = pump.note;
    const drive = topDriveActivity({...input, sample: input.driveSample});root.dataset.drive = drive.state;
    const ds = drive.sample, current = drive.state === 'current' || drive.state === 'reported';
    set('[data-drive-value]', ds && finite(ds.value) ? (current ? '' : 'Last ') + ds.value.toFixed(1) + ' m' : '—');
    set('[data-drive-motion]', current ? (drive.direction === 'Rising' ? '↑ Rising' : drive.direction === 'Lowering' ? '↓ Lowering' : drive.direction || 'Movement —') : drive.note);
    set('[data-drive-source]', current ? (ds.kind === 'direct' ? 'Reported' : ds.mnemonic || 'BHE') + (drive.state === 'reported' ? ' · depth log' : '') + (drive.ratio === null ? ' · range pending' : '') : '');
    const marker = root.querySelector('[data-drive-marker]');marker.toggleAttribute('hidden', !current || drive.ratio === null);
    if (current && drive.ratio !== null) marker.setAttribute('transform', 'translate(0,' + (6 + (1 - drive.ratio) * 44).toFixed(2) + ')');
    set('[data-drive-max]', current && drive.ratio !== null ? ds.max.toFixed(1) : '');set('[data-drive-min]', current && drive.ratio !== null ? ds.min.toFixed(1) : '');
    root.querySelector('.on-drive').title = drive.note + (drive.ratio === null ? '' : '; rail shows observed sample range, not full mast height');
    return {pump, drive};
  }};
}
