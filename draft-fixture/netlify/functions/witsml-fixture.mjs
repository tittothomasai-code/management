// Draft-only SIM-TEST fixture. No upstream, no credential storage, no logs.
// Not part of the production drilling artifact. Delete the draft deploy after the preview.
const MODES = new Set(['advance', 'stale', 'missing', '401']);
const OPS = new Set(['WMLS_GetVersion', 'WMLS_GetFromStore']);
const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const STEP = 10_000;
export const WELL = 'FIXTURE TEST WELL (NOT LIVE)';
export const LOGNAME = 'SIM-TEST time log';
const CURVES = [['TIME','s'],['DEPT','m'],['BDEP','m'],['RPMA','rpm'],['TQ','kN.m'],['SWOB','kN'],['ROPA','m/h'],['MFIA','L/min']];

function allowedOrigin(origin) {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname;
    return host === 'drilling.robotyx.systems' || host.endsWith('.netlify.app') || host.endsWith('.github.io');
  } catch { return false; }
}
function headers(origin) {
  const h = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', vary: 'Origin' };
  if (allowedOrigin(origin)) {
    if (origin) h['access-control-allow-origin'] = origin;
    h['access-control-allow-methods'] = 'GET, POST, OPTIONS';
    h['access-control-allow-headers'] = 'Content-Type, X-Witsml-Authorization';
    h['access-control-max-age'] = '600';
  }
  return h;
}
const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, '.000Z');
function clock(now, mode) {
  const end = mode === 'stale' ? now - 180_000 : now;
  const t1 = Math.floor(end / STEP) * STEP;
  return { t0: t1 - STEP, t1 };
}
function sample(ms, blank) {
  return `<data>${iso(ms)},2000.00,2000.00,${blank ? '' : '90'},${blank ? '' : '12'},14,30,2600</data>`;
}
function store(typ, query, mode, now) {
  if (typ === 'well') return `<wells ${NS}><well uid="FIX-W"><name>${WELL}</name><field>SIM-TEST</field></well></wells>`;
  if (typ === 'wellbore') return `<wellbores ${NS}><wellbore uidWell="FIX-W" uid="FIX-WB"><name>FIXTURE WB</name></wellbore></wellbores>`;
  if (typ !== 'log') return `<${typ}s ${NS}/>`;
  const { t0, t1 } = clock(now, mode);
  const info = CURVES.map(([m,u]) => `<logCurveInfo uid="${m}"><mnemonic>${m}</mnemonic><unit>${u}</unit></logCurveInfo>`).join('');
  const hdr = `<nameWell>${WELL}</nameWell><nameWellbore>FIXTURE WB</nameWellbore><name>${LOGNAME}</name><indexType>date time</indexType><indexCurve>TIME</indexCurve><startDateTimeIndex>${iso(t0)}</startDateTimeIndex><endDateTimeIndex>${iso(t1)}</endDateTimeIndex>`;
  if (!query.includes('<logData')) return `<logs ${NS}><log uidWell="FIX-W" uidWellbore="FIX-WB" uid="GT">${hdr}${info}</log></logs>`;
  const start = (query.match(/<startDateTimeIndex>([^<]*)</) || [])[1];
  const startMs = start ? Date.parse(start) : -Infinity;
  const rows = [t0, t1].filter(t => Number.isFinite(startMs) ? t > startMs : true).map(t => sample(t, mode === 'missing' && t === t1));
  return `<logs ${NS}><log uidWell="FIX-W" uidWellbore="FIX-WB" uid="GT"><logData><mnemonicList>${CURVES.map(c => c[0]).join(',')}</mnemonicList><unitList>${CURVES.map(c => c[1]).join(',')}</unitList>${rows.join('')}</logData></log></logs>`;
}

export function fixtureResponse({ method, url, origin = '', bodyText = '', now = Date.now() }) {
  const head = headers(origin);
  if (origin && !allowedOrigin(origin)) return { status: 403, headers: head, json: { result: -1, error: 'origin not allowed' } };
  if (method === 'OPTIONS') return { status: 204, headers: head, body: null };
  if (method === 'GET') return { status: 200, headers: head, json: { ok: true, service: 'witsml-fixture', identity: 'SIM-TEST', well: WELL, forwards: false, modes: [...MODES] } };
  if (method !== 'POST') return { status: 405, headers: head, json: { result: -1, error: 'method not allowed' } };
  let raw;
  try { raw = JSON.parse(bodyText || '{}'); } catch { return { status: 400, headers: head, json: { result: -1, error: 'bad json' } }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { status: 400, headers: head, json: { result: -1, error: 'bad json' } };
  const mode = MODES.has(new URL(url, 'https://fixture.invalid').searchParams.get('mode')) ? new URL(url, 'https://fixture.invalid').searchParams.get('mode') : 'advance';
  if (mode === '401') return { status: 401, headers: head, json: { result: -1, error: 'Authentication failed' } };
  const op = raw.op || 'WMLS_GetFromStore';
  if (!OPS.has(op)) return { status: 403, headers: head, json: { result: -1, error: 'read-only fixture: op not allowed' } };
  if (op === 'WMLS_GetVersion') return { status: 200, headers: head, json: { result: 1, version: '1.4.1.1', xml: '', supp: 'SIM-TEST fixture' } };
  const typ = String(raw.wmlType || '');
  if (!/^[A-Za-z]{2,40}$/.test(typ)) return { status: 400, headers: head, json: { result: -1, error: 'bad wmlType' } };
  const query = typeof raw.query === 'string' ? raw.query.slice(0, 8000) : '';
  return { status: 200, headers: head, json: { result: 1, xml: store(typ, query, mode, now), supp: 'SIM-TEST fixture' } };
}

export default async function handler(req) {
  const out = fixtureResponse({
    method: req.method,
    url: req.url,
    origin: req.headers.get('origin') || '',
    bodyText: req.method === 'POST' ? await req.text() : '',
  });
  if (out.body === null) return new Response(null, { status: out.status, headers: out.headers });
  return new Response(JSON.stringify(out.json), { status: out.status, headers: { ...out.headers, 'content-type': 'application/json' } });
}
