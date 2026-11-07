// Synthetic WITSML 1.4.1.1 store. TEST-ONLY. These wells are not a rig and must not be shown as live data.
import { escapeXml } from '../witsml/xml.js';

export const LABEL = 'SIM-TEST synthetic store. Not a live rig.';
const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const T0 = Date.parse('2026-11-01T00:00:00Z');

export const PLAN = {
  startMd: 1000,
  segments: [
    { len: 9.25, connect: true },
    { len: 9.5, connect: true, blip: true },
    { len: 28.5, connect: true, ream: true },
    { len: 9.5, connect: false },
  ],
};

export function expectedCuts(extraM = 0) {
  let md = PLAN.startMd;
  const cuts = [];
  for (const s of PLAN.segments) {
    md = +(md + s.len).toFixed(2);
    if (s.connect) cuts.push(md);
  }
  return { cuts, end: +(md + extraM).toFixed(2), start: PLAN.startMd };
}

const CAP_TYPES = ['well', 'wellbore', 'trajectory', 'log', 'mudLog', 'formationMarker', 'bhaRun', 'tubular', 'rig', 'wbGeometry', 'fluidsReport', 'opsReport', 'message', 'risk', 'attachment'];

function iso(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'); }

function timeRows(extraM) {
  const rows = [];
  let md = PLAN.startMd;
  let t = T0;
  const push = (over) => {
    rows.push({
      t, md, bit: over.bit ?? md, hole: over.hole ?? md, rop: over.rop ?? 30, rpm: over.rpm ?? 120,
      flow: over.flow ?? 2000, hk: over.hk ?? 800, slips: over.slips ?? 0, gr: over.gr ?? 40,
    });
    t += over.dt || 30000;
  };
  for (const seg of PLAN.segments) {
    const n = Math.round(seg.len / 0.25);
    for (let i = 0; i < n; i++) {
      md = +(md + 0.25).toFixed(2);
      if (seg.blip && i === Math.floor(n / 2)) push({ flow: 0, rpm: 0, slips: 0, hk: 800, rop: 0, gr: 99, bit: md, hole: md });
      else push({ bit: md, hole: md, gr: 40 + (i % 5) });
    }
    if (seg.ream) {
      for (let k = 0; k < 4; k++) push({ bit: +(md - 3).toFixed(2), hole: md, rpm: 80, flow: 2000, slips: 0, rop: 0, gr: 55 });
    }
    if (seg.connect) {
      for (let k = 0; k < 8; k++) push({ bit: +(md - 2).toFixed(2), hole: md, rpm: 0, flow: 0, hk: 200, slips: 1, rop: 0, gr: 40 });
    }
  }
  const extraN = Math.round(extraM / 0.25);
  for (let i = 0; i < extraN; i++) {
    md = +(md + 0.25).toFixed(2);
    push({ bit: md, hole: md, gr: 41 });
  }
  return rows;
}

function depthFeet() {
  const rows = [];
  for (let ft = 1000; ft <= 2500; ft += 10) {
    rows.push({ ft, gr: 60 + (ft % 50), rhob: 2.4 });
    if (ft === 1500) rows.push({ ft, gr: 180, rhob: 2.4 });
  }
  return rows;
}

function pageBy(rows, start, maxN, get) {
  let i = 0;
  if (start != null && start !== '') {
    const s = +start;
    i = rows.findIndex(r => get(r) >= s - 1e-9);
    if (i < 0) i = rows.length;
  }
  return rows.slice(i, i + maxN);
}

function attr(q, name) {
  return (String(q || '').match(new RegExp('\\b' + name + '="([^"]*)"')) || [])[1] || '';
}

function maxN(options) {
  const m = String(options || '').match(/maxReturnNodes=(\d+)/);
  return m ? +m[1] : 500;
}

export function createFixture() {
  const calls = [];
  const live = { extraM: 0 };
  function request(req) {
    const op = req.op || 'WMLS_GetFromStore';
    const type = req.wmlType || '';
    const q = req.query || '';
    const options = req.options || '';
    calls.push({ op, wmlType: type, options, query: q });
    if (op === 'WMLS_GetVersion') return { result: 1, version: '1.4.1.1', xml: '', supp: LABEL };
    if (op === 'WMLS_GetCap') {
      const objs = CAP_TYPES.map(t => `<dataObject>${t}</dataObject>`).join('');
      return { result: 1, xml: `<capServers ${NS}><capServer apiVers="1.4.1"><function name="WMLS_GetFromStore">${objs}</function></capServer></capServers>`, supp: LABEL };
    }
    if (type === 'well') {
      return { result: 1, xml: `<wells ${NS}><well uid="SIM-W1"><name>SIM-TEST North</name></well><well uid="SIM-W2"><name>SIM-TEST South</name></well></wells>` };
    }
    if (type === 'wellbore') {
      const w = attr(q, 'uidWell');
      const list = w === 'SIM-W1'
        ? [['WB-A', 'SIM-TEST main'], ['WB-B', 'SIM-TEST sidetrack']]
        : w === 'SIM-W2' ? [['WB-C', 'SIM-TEST short']] : [];
      return { result: 1, xml: `<wellbores ${NS}>${list.map(([u, n]) => `<wellbore uidWell="${w}" uid="${u}"><name>${n}</name></wellbore>`).join('')}</wellbores>` };
    }
    const wb = attr(q, 'uidWellbore');
    const uid = attr(q, 'uid');
    if (type === 'risk') return { result: -405, supp: 'risk not supported', xml: '' };
    if (wb === 'WB-B' && type === 'log') return { result: -1, supp: 'store fault reading logs', xml: '' };
    if (type === 'log') return logResponse(wb, uid, q, options, live);
    if (type === 'trajectory') return trajectoryResponse(wb, uid);
    if (type === 'mudLog' && wb === 'WB-A' && !uid) return { result: 1, xml: `<mudLogs ${NS}><mudLog uidWell="SIM-W1" uidWellbore="WB-A" uid="MUD-1"><name>SIM-TEST mud log</name><startMd uom="m">1000</startMd><endMd uom="m">1050</endMd></mudLog></mudLogs>` };
    if (type === 'mudLog' && uid === 'MUD-1') return { result: 1, xml: `<mudLogs ${NS}><mudLog uidWell="SIM-W1" uidWellbore="WB-A" uid="MUD-1"><name>SIM-TEST mud log</name><geologyInterval uid="g1"><mdTop uom="m">1010</mdTop><mdBottom uom="m">1040</mdBottom><lithology uid="l1"><type>SIM-TEST sand</type><lithPc uom="%">70</lithPc></lithology></geologyInterval></mudLog></mudLogs>` };
    if (type === 'formationMarker' && wb === 'WB-A') return { result: 1, xml: `<formationMarkers ${NS}><formationMarker uidWell="SIM-W1" uidWellbore="WB-A" uid="FM-1"><name>SIM-TEST sand</name><mdTopSample uom="m">1010</mdTopSample><mdBottomSample uom="m">1040</mdBottomSample></formationMarker></formationMarkers>` };
    if (type === 'tubular' && wb === 'WB-C' && !uid) return { result: 1, xml: `<tubulars ${NS}><tubular uidWell="SIM-W2" uidWellbore="WB-C" uid="TUB-1"><name>SIM-TEST tally</name><typeTubularAssy>drilling</typeTubularAssy></tubular></tubulars>` };
    if (type === 'tubular' && uid === 'TUB-1') return { result: 1, xml: tubularFull() };
    if (type === 'opsReport' && wb === 'WB-A') return { result: 1, xml: `<opsReports ${NS}><opsReport uidWell="SIM-W1" uidWellbore="WB-A" uid="OPS-1"><name>SIM-TEST DDR</name><dTim>2026-11-01T01:00:00Z</dTim><md uom="m">1020</md><activity uid="a1"><dTimStart>2026-11-01T00:30:00Z</dTimStart><dTimEnd>2026-11-01T01:00:00Z</dTimEnd><phase>DRILL</phase><proprietaryCode>DRILLING</proprietaryCode><md uom="m">1018.75</md><comments>connection made while drilling</comments></activity></opsReport></opsReports>` };
    if (type === 'wbGeometry' && wb === 'WB-A') return { result: 1, xml: `<wbGeometrys ${NS}><wbGeometry uidWell="SIM-W1" uidWellbore="WB-A" uid="GEO-1"><name>SIM-TEST casing</name><wbGeometrySection uid="s1"><typeHoleCasing>casing</typeHoleCasing><mdTop uom="m">0</mdTop><mdBottom uom="ft">3280.84</mdBottom></wbGeometrySection></wbGeometry></wbGeometrys>` };
    if (type === 'message' && wb === 'WB-A') return { result: 1, xml: `<messages ${NS}><message uidWell="SIM-W1" uidWellbore="WB-A" uid="MSG-1"><name>SIM-TEST note</name><dTim>2026-11-01T01:00:00Z</dTim><typeMessage>info</typeMessage><md uom="m">1010</md><messageText>SIM-TEST marker</messageText></message></messages>` };
    const empty = { trajectory: 'trajectorys', mudLog: 'mudLogs', formationMarker: 'formationMarkers', bhaRun: 'bhaRuns', tubular: 'tubulars', rig: 'rigs', wbGeometry: 'wbGeometrys', fluidsReport: 'fluidsReports', opsReport: 'opsReports', message: 'messages', cementJob: 'cementJobs', attachment: 'attachments', log: 'logs' };
    const p = empty[type] || (type + 's');
    return { result: 1, xml: `<${p} ${NS}/>`, supp: LABEL };
  }
  return {
    calls, label: LABEL, tag: 'SIM-TEST',
    appendLive() { live.extraM = +(live.extraM + 0.5).toFixed(2); return live.extraM; },
    extraM() { return live.extraM; },
    request,
  };
}

function tubularFull() {
  const comps = [
    ['c1', 'drill pipe', 1, '9.2'],
    ['c2', 'drill pipe', 2, '9.5'],
    ['c3', 'stand', 3, '27.6'],
    ['c4', 'drill pipe', 4, ''],
    ['c5', 'drill pipe', 5, '9.1'],
  ];
  const body = comps.map(([id, typ, seq, len]) => `<tubularComponent uid="${id}"><typeTubularComp>${typ}</typeTubularComp><sequence>${seq}</sequence>${len === '' ? '' : `<len uom="m">${len}</len>`}</tubularComponent>`).join('');
  return `<tubulars ${NS}><tubular uidWell="SIM-W2" uidWellbore="WB-C" uid="TUB-1"><name>SIM-TEST tally</name><typeTubularAssy>drilling</typeTubularAssy>${body}</tubular></tubulars>`;
}

function logHeaders(wb, live) {
  if (wb !== 'WB-A') return '';
  const rows = timeRows(live?.extraM || 0);
  const end = rows[rows.length - 1];
  const specs = [
    ['TIME-RT', 'SIM-TEST realtime time', 'date time', 'TIME', `<startDateTimeIndex>${iso(rows[0].t)}</startDateTimeIndex><endDateTimeIndex>${iso(end.t)}</endDateTimeIndex>`, [['TIME', 's'], ['DBTM', 'm'], ['DMEA', 'm'], ['ROPA', 'm/h'], ['RPMA', 'rpm'], ['MFIA', 'L/min'], ['HKLA', 'kN'], ['SLIPS', 'unitless'], ['GR', 'gAPI']]],
    ['DEPTH-FE', 'SIM-TEST FE depth', 'measured depth', 'DEPT', '<startIndex uom="ft">1000</startIndex><endIndex uom="ft">2500</endIndex>', [['DEPT', 'ft'], ['GR', 'gAPI'], ['RHOB', 'g/cm3']]],
    ['DEPTH-OO', 'SIM-TEST sparse depth', 'measured depth', 'DEPT', '<startIndex uom="m">0</startIndex><endIndex uom="m">80</endIndex>', [['DEPT', 'm'], ['GR', 'gAPI'], ['WIDGET', 'widgets']]],
    ['STALL', 'SIM-TEST stalled log', 'measured depth', 'DEPT', '<startIndex uom="m">0</startIndex><endIndex uom="m">500</endIndex>', [['DEPT', 'm'], ['GR', 'gAPI']]],
    ['ZONELESS', 'SIM-TEST zoneless time', 'date time', 'TIME', '<startDateTimeIndex>2026-11-01T08:00:00</startDateTimeIndex><endDateTimeIndex>2026-11-01T08:02:00</endDateTimeIndex>', [['TIME', 's'], ['GR', 'gAPI']]],
    ['TIME-OFF', 'SIM-TEST offset time', 'date time', 'TIME', '<startDateTimeIndex>2026-11-01T10:00:00+10:00</startDateTimeIndex><endDateTimeIndex>2026-11-01T10:01:00+10:00</endDateTimeIndex>', [['TIME', 's'], ['GR', 'gAPI']]],
    ['BAD', 'SIM-TEST bad log', 'measured depth', 'DEPT', '<startIndex uom="m">0</startIndex><endIndex uom="m">10</endIndex>', [['DEPT', 'm'], ['GR', 'gAPI']]],
  ];
  return specs.map(([uid, name, kind, curve, span, curves]) => `<log uidWell="SIM-W1" uidWellbore="WB-A" uid="${uid}"><name>${escapeXml(name)}</name><indexType>${kind}</indexType><indexCurve>${curve}</indexCurve>${span}${curves.map(([m, u]) => `<logCurveInfo uid="${m}"><mnemonic>${m}</mnemonic><unit>${u}</unit></logCurveInfo>`).join('')}</log>`).join('');
}

function logResponse(wb, uid, q, options, live) {
  if (wb === 'WB-C') {
    const rows = [0, 5, 10, 15, 20].map(m => `<data>${m},70</data>`).join('');
    if (!uid) return { result: 1, xml: `<logs ${NS}><log uidWell="SIM-W2" uidWellbore="WB-C" uid="SHORT"><name>SIM-TEST short depth</name><indexType>measured depth</indexType><indexCurve>DEPT</indexCurve><startIndex uom="m">0</startIndex><endIndex uom="m">20</endIndex><logCurveInfo uid="DEPT"><mnemonic>DEPT</mnemonic><unit>m</unit></logCurveInfo><logCurveInfo uid="GR"><mnemonic>GR</mnemonic><unit>gAPI</unit></logCurveInfo></log></logs>` };
    return { result: 1, xml: `<logs ${NS}><log uid="SHORT"><logData><mnemonicList>DEPT,GR</mnemonicList><unitList>m,gAPI</unitList>${rows}</logData></log></logs>` };
  }
  if (!uid) return { result: 1, xml: `<logs ${NS}>${logHeaders(wb, live)}</logs>` };
  if (uid === 'BAD') return { result: 1, xml: '<logs><log uid="BAD"><name>SIM-TEST bad log</name>' };
  const n = maxN(options);
  if (uid === 'STALL') {
    return { result: 1, xml: `<logs ${NS}><log uid="STALL"><logData><mnemonicList>DEPT,GR</mnemonicList><unitList>m,gAPI</unitList><data>0,1</data><data>1,1</data></logData></log></logs>` };
  }
  if (uid === 'ZONELESS') {
    return { result: 1, xml: `<logs ${NS}><log uid="ZONELESS"><logData><mnemonicList>TIME,GR</mnemonicList><unitList>s,gAPI</unitList><data>2026-11-01T08:00:00,1</data><data>2026-11-01T08:01:00,2</data><data>2026-11-01T08:02:00,3</data></logData></log></logs>` };
  }
  if (uid === 'TIME-OFF') {
    return { result: 1, xml: `<logs ${NS}><log uid="TIME-OFF"><logData><mnemonicList>TIME,GR</mnemonicList><unitList>s,gAPI</unitList><data>2026-11-01T10:00:00+10:00,4</data><data>2026-11-01T10:01:00+10:00,5</data></logData></log></logs>` };
  }
  if (uid === 'DEPTH-OO') {
    const body = [[20, 1, 3], [0, 2, 3], [80, 4, 3], [10, 3, 3]].map(([d, g, w]) => `<data>${d},${g},${w}</data>`).join('');
    return { result: 1, xml: `<logs ${NS}><log uid="DEPTH-OO"><logData><mnemonicList>DEPT,GR,WIDGET</mnemonicList><unitList>m,gAPI,widgets</unitList>${body}</logData></log></logs>` };
  }
  if (uid === 'DEPTH-FE') {
    const all = depthFeet();
    const start = (q.match(/<startIndex[^>]*>([^<]+)/) || [])[1];
    const slice = pageBy(all, start, n, r => r.ft);
    const body = slice.map(r => `<data>${r.ft},${r.gr},${r.rhob}</data>`).join('');
    return { result: 1, xml: `<logs ${NS}><log uid="DEPTH-FE"><logData><mnemonicList>DEPT,GR,RHOB</mnemonicList><unitList>ft,gAPI,g/cm3</unitList>${body}</logData></log></logs>` };
  }
  if (uid === 'TIME-RT') {
    const all = timeRows(live.extraM);
    const start = (q.match(/<startDateTimeIndex>([^<]+)/) || [])[1];
    const startMs = start ? Date.parse(start) : null;
    let i = 0;
    if (startMs != null && !Number.isNaN(startMs)) {
      i = all.findIndex(r => r.t >= startMs);
      if (i < 0) i = all.length;
    }
    const slice = all.slice(i, i + n);
    const end = all[all.length - 1];
    const body = slice.map(r => `<data>${iso(r.t)},${r.bit},${r.hole},${r.rop},${r.rpm},${r.flow},${r.hk},${r.slips},${r.gr}</data>`).join('');
    const head = q.includes('logData') ? '' : `<name>SIM-TEST realtime time</name><indexType>date time</indexType><startDateTimeIndex>${iso(all[0].t)}</startDateTimeIndex><endDateTimeIndex>${iso(end.t)}</endDateTimeIndex>`;
    return { result: 1, xml: `<logs ${NS}><log uid="TIME-RT">${head}<logData><mnemonicList>TIME,DBTM,DMEA,ROPA,RPMA,MFIA,HKLA,SLIPS,GR</mnemonicList><unitList>s,m,m,m/h,rpm,L/min,kN,unitless,gAPI</unitList>${body}</logData></log></logs>`, supp: LABEL };
  }
  return { result: 1, xml: `<logs ${NS}/>` };
}

function trajectoryResponse(wb, uid) {
  if (wb === 'WB-A') {
    const stations = [
      ['b', 1030, 4, 90, 1029, ''],
      ['a', 1018.75, 2, 90, 1018, ''],
      ['d', 1100, 10, 95, 1090, '2026-11-01T02:00:00Z'],
      ['c', 1030, 4.5, 91, 1029, ''],
    ];
    const body = stations.map(([id, md, inc, azi, tvd, tim]) => `<trajectoryStation uid="${id}">${tim ? `<dTimStn>${tim}</dTimStn>` : ''}<md uom="m">${md}</md><incl uom="dega">${inc}</incl><azi uom="dega">${azi}</azi><tvd uom="m">${tvd}</tvd></trajectoryStation>`).join('');
    return { result: 1, xml: `<trajectorys ${NS}><trajectory uidWell="SIM-W1" uidWellbore="WB-A" uid="TR-A"><name>SIM-TEST survey</name><mdMn uom="m">1018.75</mdMn><mdMx uom="m">1100</mdMx>${body}</trajectory></trajectorys>` };
  }
  if (wb === 'WB-C') {
    return { result: 1, xml: `<trajectorys ${NS}><trajectory uidWell="SIM-W2" uidWellbore="WB-C" uid="TR-C"><name>SIM-TEST far station</name><mdMn uom="m">100</mdMn><mdMx uom="m">100</mdMx><trajectoryStation uid="z"><md uom="m">100</md><incl uom="dega">1</incl><azi uom="dega">10</azi><tvd uom="m">100</tvd></trajectoryStation></trajectory></trajectorys>` };
  }
  return { result: 1, xml: `<trajectorys ${NS}/>` };
}
