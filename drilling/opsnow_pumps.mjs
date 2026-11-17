const finite = Number.isFinite;
export function pumpActivity({signed, sample, now = Date.now()}) {
  const result = (state, note) => ({state, note, sample});
  if (!signed) return result('unknown', 'Sign in to receive pump readings');
  if (!sample || !finite(sample.value)) return result('unknown', 'Flow-in reading not reported');
  if (sample.value < 0) return result('unknown', 'Flow-in reading is invalid');
  if (sample.blankLatest) return result('unknown', 'Latest flow-in sample is missing');
  if (sample.indexType !== 'time') return result('unknown', 'Depth-log reading only; current pump state is unknown');
  if (!finite(sample.at) || sample.at > now) return result('unknown', 'Flow-in sample time is unavailable or ahead of the clock');
  if (now - sample.at >= 120000) return result('unknown', 'Flow-in reading is stale');
  if (!finite(sample.previousAt) || sample.previousAt >= sample.at) return result('unknown', 'Waiting for advancing flow sample times');
  return result(sample.value > 0 ? 'on' : 'off', 'Inferred from flow in; individual pump switches are not reported');
}

export function pumpSample({rows, channel, latest, time, source}) {
  if (!channel || !latest) return null;
  return {value: latest.v, unit: channel.unit, at: latest.at, previousAt: rows.at(-2)?.[0],
    indexType: time ? 'time' : 'depth', blankLatest: latest.blankLatest, source};
}

export function createPumpGraphic({document: doc = document, before}) {
  const css = doc.createElement('link');css.rel = 'stylesheet';css.href = new URL('./opsnow_pumps.css', import.meta.url);doc.head.append(css);
  const root = doc.createElement('section');root.id = 'onPumps';root.dataset.state = 'unknown';root.setAttribute('aria-label', 'Pump activity');
  // Original schematic motor, coupling, pump body and inlet/discharge piping.
  root.innerHTML = `<div class="on-pump-picture"><svg viewBox="0 0 320 150" role="img" aria-label="Schematic pump with motor and flow piping">
    <defs><linearGradient id="on-pump-metal" x2="0" y2="1"><stop stop-color="#8aa5b5"/><stop offset=".45" stop-color="#334f62"/><stop offset="1" stop-color="#203440"/></linearGradient></defs>
    <path class="on-pump-pipe" d="M306 125h-43V98M264 79h25V30h20"/>
    <path class="on-pump-flow" d="M306 125h-43V98M264 79h25V30h20"/>
    <path class="on-pump-arrow" d="m297 24 10 6-10 6z"/>
    <rect x="20" y="128" width="270" height="8" rx="3" fill="#3a5465"/>
    <path d="M42 116v12h47v-12m66 0v12h60v-12" fill="#718a99"/>
    <rect x="28" y="70" width="76" height="48" rx="10" fill="url(#on-pump-metal)" stroke="#9ab0ba"/>
    <g stroke="#233e50" stroke-width="3"><path d="M39 76v36m10-36v36m10-36v36m10-36v36m10-36v36m10-36v36"/></g>
    <circle cx="66" cy="94" r="17" fill="#162d3d" stroke="#7d99aa"/>
    <g class="on-pump-rotor" fill="none" stroke="currentColor" stroke-width="3"><path d="M66 81v26m-13-13h26m-22-9 18 18m0-18-18 18"/></g>
    <rect x="104" y="88" width="33" height="12" rx="3" fill="#a3b5bf"/><rect x="115" y="85" width="11" height="18" rx="2" fill="#557487"/>
    <rect x="137" y="54" width="90" height="67" rx="8" fill="url(#on-pump-metal)" stroke="#9ab0ba"/>
    <rect x="146" y="64" width="72" height="36" rx="4" fill="#142b38"/>
    <g class="on-pump-piston" stroke="currentColor" stroke-width="4"><path d="M151 75h58m-58 15h58"/><path d="M175 68v14m18 0v14" stroke-width="7"/></g>
    <g fill="#abc0cb"><circle cx="148" cy="111" r="3"/><circle cx="216" cy="111" r="3"/><circle cx="148" cy="60" r="3"/><circle cx="216" cy="60" r="3"/></g>
    <rect x="228" y="67" width="38" height="48" rx="5" fill="#45687e" stroke="#91a9b7"/>
    <path d="M237 73v35m12-35v35m12-35v35" stroke="#99b1bf" stroke-width="3"/>
    <text x="289" y="18" text-anchor="middle" fill="#b9cbd5" font-size="10" font-family="system-ui">FLOW IN</text>
  </svg></div><div class="on-pump-readout"><span class="on-pump-kicker">PUMP ACTIVITY</span><strong data-pump-state role="status" aria-live="polite">UNKNOWN</strong><span data-pump-flow></span><p data-pump-note></p><small data-pump-source></small></div>`;
  before.before(root);
  const set = (selector, value) => { const el = root.querySelector(selector);if (el.textContent !== value) el.textContent = value; };
  return {root, update(input) {
    const activity = pumpActivity(input), sample = activity.sample;root.dataset.state = activity.state;
    set('[data-pump-state]', activity.state === 'on' ? 'PUMPS ON' : activity.state === 'off' ? 'PUMPS OFF' : 'CURRENT STATE UNKNOWN');
    set('[data-pump-flow]', sample && finite(sample.value) && sample.value >= 0 ? (activity.state === 'unknown' ? 'Last flow in · ' : 'Flow in · ') + sample.value.toLocaleString('en-AU', {maximumFractionDigits: 1}) + ' ' + (sample.unit || '(unit not reported)') : 'Flow in · not reported');
    set('[data-pump-note]', activity.note);
    const last = activity.state === 'unknown' && sample && finite(sample.value) && sample.value >= 0 && !sample.blankLatest ? ' · Last recorded: ' + (sample.value > 0 ? 'ON' : 'OFF') : '';
    const time = sample?.indexType === 'time' && finite(sample.at) ? ' · ' + new Date(sample.at).toLocaleTimeString('en-AU', {timeZone: 'Australia/Brisbane', hour12: false}) + ' AEST' : '';
    set('[data-pump-source]', 'Flow-derived · aggregate · schematic' + (sample?.source ? ' · ' + sample.source : '') + last + time);
    return activity;
  }};
}
