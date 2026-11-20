// opsnow.js: one clean, read-only operator screen for the live WITSML well.
// Signs in once per tab, then finds the active wellbore and its drilling log by itself and keeps
// reading with bounded calls (one at a time). Settings and diagnostics stay behind the gear button.
import * as WPL from './opsnow_wellplans.js?v=dr1115';
import * as C from './opsnow_core.js?v=re1115';
import {connectionRows, jointMetrics, depthMetres, reconcileDepths, derivePipeChecks, renderPipeChecks} from './opsnow_joint_metrics.mjs?v=tally1118';
import {referenceScope,loadMeasuredReference,inventoryPosition,inventoryResetLabel,compareDerivedTally} from './opsnow_tally_compare.mjs?v=opsref1118';
import {checkpointState,renderHardpoints,STORAGE_KEY} from './opsnow_hardpoints.mjs?v=hardpoint1118';
import {uploadedReference} from './opsnow_measured_upload.mjs?v=hardpoint1118';
import {reportedOperation,reportDepthIssue,drillingReferenceMd,renderOperationReport} from './opsnow_operation_report.mjs?v=eow1118';
import {wellWorkspaceUrl} from './opsnow_landing_status.mjs?v=ops-landing1';
import {initLandingDock} from './opsnow_landing_dock.mjs?v=ops-landing1';
import {initLandingPlanner} from './opsnow_landing.mjs?v=ops-landing1';
import {initPerformance} from './opsnow_performance.mjs?v=performance1';
import * as W from './opsnow_wire.js?v=re1115';
import * as VW from './opsnow_views.js?v=re1115';
import * as A from './opsnow_ac.js?v=re1115';
import * as WP from './opsnow_planview.js?v=re1115';
import * as JS from './opsnow_jsurvey.js?v=re1115';
import {createSurveyAlerts, reportSurveyStations} from './opsnow_survey_alert.mjs?v=survey1117';
import {createPumpGraphic, pumpSample, driveChannel, driveSample, refreshDepthTail} from './opsnow_pumps.mjs?v=spp100';
const $ = id => document.getElementById(id);
let landingPlanner=null,landingDock=null,performanceView=null;
const PAGE = ['joints', 'wellplan'].includes(document.documentElement.dataset.page) ? document.documentElement.dataset.page : 'ops'; // joints.html / wellplan.html: same data layer, one surface each
const DEF_WELL = new URLSearchParams(location.search).get('well') || 'DR101L';
const NOMINAL_JOINT_M = 13; // fallback only; complete BHE strokes supply labelled derived lengths.
const WINDOW_M = 150, WINDOW_MS = 3 * 3600e3, TREND_M = 60, TREND_MS = 2 * 3600e3;
const S = {well: null, wellbores: [], headers: {}, wb: null, log: null, map: {}, data: {ml: [], ul: [], rows: []},
  traj: null, trajUid: null, bit: null, pumpSample: null, previousDepthRow: null, timeLog: null, advancedAt: null, message: '', override: {wb: '', log: ''},
  due: {data: 0, header: 0, survey: 0, discover: 0, extra: 0}, pages: 0, started: false,
  // whole-log extras: older depth rows, MWD gamma + image logs, every wellbore's survey (read once, then kept fresh)
  backfill: 'todo', fe: null, image: null, imageRange: null, branchTrajs: null, branchMsg: '', branches: null, ac: null, tally: null, tallyName: '', tallyError: '',
  storePlanId: null, storePlanName: '', storePlan: null, importedPlan: null, importedPlanName: '', offsets: null, extraOffsets: [], surveyOverride: null, surveyHeader: null, rigName: null};
const TKEY = 'opsnow-tally'; // the loaded tally is kept on this device so ops.html and joints.html number joints the same way
try { const T = JSON.parse(localStorage.getItem(TKEY) || 'null'); if (T?.t?.joints?.length) { S.tally = T.t; S.tallyName = T.name || 'tally'; } } catch {}
const OKEY = w => 'opsnow-offsets:' + (w || '');
try { const O = JSON.parse(localStorage.getItem(OKEY(DEF_WELL)) || 'null'); if (O) S.offsets = O; } catch {}
try { const P = JSON.parse(localStorage.getItem('opsnow-plan:' + DEF_WELL) || 'null'); if (P?.p?.path) { S.importedPlan = P.p; S.importedPlanName = P.name || 'plan'; } } catch {}
const fmt = (v, d = 1) => Number.isFinite(v) ? (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toLocaleString('en-AU', {minimumFractionDigits: d, maximumFractionDigits: d}) : '—';

const surveyAlerts = PAGE === 'ops' ? createSurveyAlerts() : null;
const surveyContext = () => ({scope: S.well && S.wb ? JSON.stringify([S.well.uid, S.wb.uid]) : null, well: S.well?.name, wellbore: S.wb?.name});

// ---------- reads (bounded, sequential) ----------
async function discover() {
  setMsg('Finding well ' + DEF_WELL + '…');
  let r = await W.get('well', `<wells ${C.NS}><well uid=""><name>${C.xa(DEF_WELL)}</name></well></wells>`, 'returnElements=id-only');
  let wells = C.parseWells(r.xml);
  if (!wells.length) { r = await W.get('well', `<wells ${C.NS}><well uid="${C.xa(DEF_WELL)}"><name/></well></wells>`, 'returnElements=id-only'); wells = C.parseWells(r.xml); }
  if (!wells.length) throw new Error('Well ' + DEF_WELL + ' was not found on the WITSML store');
  S.well = wells[0];
  setMsg('Reading wellbores of ' + S.well.name + '…');
  r = await W.get('wellbore', `<wellbores ${C.NS}><wellbore uidWell="${C.xa(S.well.uid)}" uid=""><name/><commonData><dTimCreation/><dTimLastChange/></commonData></wellbore></wellbores>`, 'returnElements=requested');
  S.wellbores = C.parseWellbores(r.xml).sort((a, b) => (Date.parse(b.created) || 0) - (Date.parse(a.created) || 0));
  // Check the three newest wellbores (or the chosen one) for the log that is changing now.
  const check = S.override.wb ? S.wellbores.filter(b => b.uid === S.override.wb) : S.wellbores.slice(0, 3);
  for (const b of check) { setMsg('Reading logs of wellbore ' + b.name + '…'); await readHeaders(b.uid); }
  const act = S.override.wb ? {b: check[0], logs: S.headers[check[0]?.uid] || []} : C.pickActive(check, S.headers);
  if (!act?.b) throw new Error('No logs found in the newest wellbores of ' + S.well.name);
  await selectWellbore(act.b);
}
async function readHeaders(uidWb) {
  const r = await W.get('log', `<logs ${C.NS}><log uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(uidWb)}" uid=""/></logs>`, 'returnElements=header-only');
  S.headers[uidWb] = C.parseLogHeaders(r.xml);
  return S.headers[uidWb];
}
async function selectWellbore(b) {
  const changed = S.wb?.uid !== b.uid; if (changed) {surveyAlerts?.clear();S.tl=null;S.surveyOverride=null;S.traj=null;S.trajUid=null;S.log=null;S.data={ml:[],ul:[],rows:[]};S.advancedAt=null;} S.wb = b;
  const logs = S.headers[b.uid] || await readHeaders(b.uid);
  const log = (S.override.log && logs.find(l => l.uid === S.override.log)) || C.pickPrimary(logs);
  if (!log) throw new Error('No drilling log with parameters in wellbore ' + b.name);
  S.timeLog = logs.find(l => l.time && l.curves.some(c => /^(BDE|BITDEP|DBTM|BIT_?DEPTH)/i.test(c.mn))) || null;
  if (changed || S.log?.uid !== log.uid) { S.log = log; S.bit = null; S.data = {ml: [], ul: [], rows: []}; S.map = {}; S.advancedAt = null; S.pumpSample = null; S.previousDepthRow = null; S.backfill = log.time ? 'n/a' : 'todo'; S.fe = S.image = null; S.branchTrajs = null; S.branches = null; await readData(true); S.trajUid = null; S.traj = null; }
  if (!S.trajUid) await findTrajectory();
  await readSurvey();
  if (S.timeLog && S.timeLog !== S.log) await readBit();
}
function blockConnections(rows,map){const normalized=connectionRows(rows,map);return normalized?C.connectionsFromBlock(normalized.rows,normalized.map):[];}
function ensureMeasuredReference(){
 const well=S.well?.name||DEF_WELL,branch=S.wb?.name||'',key=JSON.stringify([well,branch]);if(S.referenceKey===key)return;
 S.referenceKey=key;S.measuredReference=null;
 if(referenceScope(well,branch))loadMeasuredReference(well,branch).then(ref=>{if(S.referenceKey!==key)return;S.measuredReference=ref;render();}).catch(()=>{});
}
function currentJoint(conns,holeMd){
 const md=drillingReferenceMd(S.operationReport,S.bitMd,holeMd),p=inventoryPosition(S.effectiveReference,md);
 return p?{n:p.n,kind:'inventory reference',reference:p,checkpoint:S.effectiveReference?.checkpoint,basis:S.operationReport?'reported final TD reference':Number.isFinite(S.bitMd)?'bit MD reference':'hole MD reference'}:S.operationReport?null:C.jointNumber(conns,C.joints(conns,holeMd).median,S.bitMd,S.tally);
}
function referenceContext(){
 const uploadScope=S.well?.uid&&S.wb?.uid?{well:S.well.uid,wellbore:S.wb.uid}:null;
 let base=S.measuredReference,error='';try{base=uploadedReference(uploadScope)||base;}catch(e){error=e.message;}
 if(!base&&S.tally?.joints?.length&&!/^tally board/i.test(S.tallyName||''))base={...S.tally,unit:'m',startMd:S.tally.startMd??S.tally.bhaLen,source:S.tallyName||'Imported measured tally'};
 const run=base?.runId||('log:'+(S.log?.uid||'')+';start:'+(base?.startMd??'')),scope=uploadScope&&base?{...uploadScope,run}:null;
 const hardpoints=checkpointState(scope,base);if(error)hardpoints.error=error;
 return {uploadScope,baseMeasuredReference:base,measuredReference:hardpoints.reference,hardpoints,runIdentifier:run,operator:W.rememberedUser?.()||''};
}
function window0(log) {
  if (log.time) { const end = Date.parse(log.end); return `<startDateTimeIndex>${new Date(end - WINDOW_MS).toISOString()}</startDateTimeIndex>`; }
  return `<startIndex uom="${C.xa(log.indexUom || 'm')}">${Math.max(log.start ?? 0, (log.end ?? 0) - WINDOW_M).toFixed(2)}</startIndex>`;
}
function fromLast(log) {
  const last = S.data.rows.at(-1)?.[0];
  if (last == null) return window0(log);
  return log.time ? `<startDateTimeIndex>${new Date(last + 1000).toISOString()}</startDateTimeIndex>` : `<startIndex uom="${C.xa(log.indexUom || 'm')}">${(last - 0.000001).toFixed(6)}</startIndex>`;
}
async function readData(initial) {
  const log = S.log; let pages = 0, added = 0;
  do {
    setMsg(initial ? 'Reading ' + log.name + ' (recent ' + (log.time ? '3 h' : WINDOW_M + ' m') + ')…' : '');
    const r = await W.get('log', `<logs ${C.NS}><log uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(S.wb.uid)}" uid="${C.xa(log.uid)}">${fromLast(log)}<logData><mnemonicList/><unitList/><data/></logData></log></logs>`, 'returnElements=data-only;maxReturnNodes=5000');
    if (S.log !== log) return;
    const d = C.parseLogData(r.xml, log.time); pages++;
    if (!d.rows.length) break;
    if (!S.data.ml.length) S.map = C.mapChannels(d.ml, d.ul, log);
    if (!log.time) { S.previousDepthRow=S.data.rows.at(-1)?.slice() || null; refreshDepthTail(S.data, d); }
    const n = C.appendRows(S.data, d, 60000); added += n; if(n)S.previousDepthRow=null;
    if ((r.result !== 2 && d.rows.length < 4990) || !n) break; // 2 = partial; the Adaga store also returns 1 on a full 5,000-row page
  } while (pages < 6);
  if (added && !initial) S.advancedAt = Date.now();
  if (initial) S.watchFrom = Date.now();
  render();
}
async function findTrajectory() {
  // Per-wellbore listing only. A well-wide query with an empty uidWellbore can ignore the well filter on this store.
  const r = await W.get('trajectory', `<trajectorys ${C.NS}><trajectory uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(S.wb.uid)}" uid=""><name/></trajectory></trajectorys>`, 'returnElements=id-only');
  const ids = C.parseTrajectoryIds(r.xml);
  const pick = C.pickSurvey(ids) || ids[0];
  S.trajUid = pick?.uid || '';
  const plan = C.pickPlan(ids);
  S.storePlanId = plan && plan.uid !== S.trajUid ? plan : null;
  S.storePlanName = S.storePlanId?.name || '';
  if (!S.storePlanId) S.storePlan = null;
}
async function readStorePlan() {
  if (!S.storePlanId) { S.storePlan = null; return; }
  const r = await W.get('trajectory', `<trajectorys ${C.NS}><trajectory uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(S.wb.uid)}" uid="${C.xa(S.storePlanId.uid)}"/></trajectorys>`, 'returnElements=all');
  const t = C.parseTrajectory(r.xml, {includePlan: true});
  if (t?.stations?.length) {
    const path = C.minCurve(t.stations).map(s => ({...s, tvd: s.tvd ?? s.tvdc}));
    S.storePlan = {path, name: t.name, source: 'WITSML trajectory ' + t.name + ' (this wellbore)'};
  } else S.storePlan = null;
}
async function readSurvey() {
  const receiptContext = surveyContext(), receiptTrajectory = S.trajUid;
  if (!S.trajUid) { S.traj = null; surveyAlerts?.observe({...receiptContext, source: 'witsml', stations: []}); return; }
  const r = await W.get('trajectory', `<trajectorys ${C.NS}><trajectory uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(S.wb.uid)}" uid="${C.xa(S.trajUid)}"/></trajectorys>`, 'returnElements=all');
  if (receiptContext.scope !== surveyContext().scope || receiptTrajectory !== S.trajUid) return;
  const t = C.parseTrajectory(r.xml); if (t) { t.calc = C.minCurve(t.stations); S.traj = t; buildBranches(); surveyAlerts?.observe({...receiptContext, source: 'witsml', stations: t.stations}); }
  render();
}
async function readBit() {
  const L = S.timeLog, receiptScope = surveyContext().scope; const end = Date.parse(L.end); if (!Number.isFinite(end)) return;
  const r = await W.get('log', `<logs ${C.NS}><log uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(S.wb.uid)}" uid="${C.xa(L.uid)}"><startDateTimeIndex>${new Date(end - 120000).toISOString()}</startDateTimeIndex><logData><mnemonicList/><unitList/><data/></logData></log></logs>`, 'returnElements=data-only;maxReturnNodes=5000');
  if (receiptScope !== surveyContext().scope || L !== S.timeLog) return;
  const d = C.parseLogData(r.xml, true), m = C.mapChannels(d.ml, d.ul, L), lv = C.latestValues(d.rows, m);
  const dc = driveChannel({ml: d.ml, ul: d.ul, header: L, blockChannel: m.bh});
  const dh = dc ? C.latestValues(d.rows, {drive: dc}).drive : null;
  S.pumpSample = {scope: receiptScope, logUid: L.uid, sample: pumpSample({rows: d.rows, channel: m.flowIn, latest: lv.flowIn, time: true, source: L.name}), pressure: pumpSample({rows:d.rows,channel:m.spp,latest:lv.spp,time:true,source:L.name}), drive: driveSample({rows: d.rows, channel: dc, latest: dh, time: true, source: L.name})};
  S.bit = lv.bd ? {v: depthMetres(lv.bd.v,m.bd), at: lv.bd.at, log: L} : null;
}
// Whole depth log: page back from the log start up to the first row already held (5,000 rows per call).
async function backfill() {
  const log = S.log; if (log.time || !S.data.rows.length) { S.backfill = 'n/a'; return; }
  let from = log.start ?? 0; const first = S.data.rows[0][0], buf = {ml: [], ul: [], rows: []};
  for (let p = 0; p < 8 && from < first - 0.01; p++) {
    S.backfill = 'reading';
    const r = await W.get('log', `<logs ${C.NS}><log uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(S.wb.uid)}" uid="${C.xa(log.uid)}"><startIndex uom="${C.xa(log.indexUom || 'm')}">${from.toFixed(2)}</startIndex><endIndex uom="${C.xa(log.indexUom || 'm')}">${(first - 0.01).toFixed(2)}</endIndex><logData><mnemonicList/><unitList/><data/></logData></log></logs>`, 'returnElements=data-only;maxReturnNodes=5000');
    if (S.log !== log) return; const d = C.parseLogData(r.xml, false); if (!d.rows.length) break;
    C.appendRows(buf, d, 1e9); from = d.rows.at(-1)[0] + 0.01; // pages run oldest → newest; merge once at the end
    if (r.result !== 2 && d.rows.length < 4990) break; await sleep(1500); // full page without result 2 seen on this store
  }
  if (buf.rows.length) C.prependRows(S.data, buf);
  S.backfill = 'done'; render();
}
// MWD logs on the same wellbore (depth-indexed): "MWD Image" (MG, 4 azimuthal gamma sectors) and
// "MWD Formation Evaluation" (GMAVG, quadrant gamma, NBINC near-bit inclination). Whole log once, then new rows.
const extraLog = re => (S.headers[S.wb?.uid] || []).find(l => !l.time && re.test(l.name));
async function readExtra(key, re) {
  const L = extraLog(re); if (!L) { S[key] = {ml: [], ul: [], rows: [], missing: true}; return; }
  const store = S[key]?.uid === L.uid ? S[key] : {uid: L.uid, name: L.name, ml: [], ul: [], rows: []}; S[key] = store;
  for (let p = 0; p < 6; p++) {
    const last = store.rows.at(-1)?.[0]; const from = last != null ? last + 0.005 : (L.start ?? 0);
    const r = await W.get('log', `<logs ${C.NS}><log uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(S.wb.uid)}" uid="${C.xa(L.uid)}"><startIndex uom="m">${from.toFixed(3)}</startIndex><logData><mnemonicList/><unitList/><data/></logData></log></logs>`, 'returnElements=data-only;maxReturnNodes=5000');
    const d = C.parseLogData(r.xml, false); if (!d.rows.length) break; const n = C.appendRows(store, d, 60000);
    if ((r.result !== 2 && d.rows.length < 4990) || !n) break;
  }
  if (key === 'image') { S.imageRows = C.imageRows(store); S.imageRange = C.robustRange(S.imageRows.flatMap(r => r.s)); }
}
// Every wellbore's survey, so branches can be drawn and checked for separation. Branch surveys do not change
// once drilled, so they are read once; the active one comes from readSurvey every 2 min.
async function readBranches() {
  const list = []; S.branchMsg = 'Reading the surveys of ' + S.wellbores.length + ' wellbores…';
  for (const b of S.wellbores) {
    if (b.uid === S.wb.uid) { list.push({name: b.name, uid: b.uid, active: true}); continue; }
    const r = await W.get('trajectory', `<trajectorys ${C.NS}><trajectory uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(b.uid)}" uid=""><name/></trajectory></trajectorys>`, 'returnElements=id-only');
    const ids = [...r.xml.matchAll(/<(?:\w+:)?trajectory\b[^>]*\suid="([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?trajectory>/g)].map(m => ({uid: m[1], name: (/<(?:\w+:)?name>([^<]*)</.exec(m[2]) || [])[1] || ''}));
    const pick = ids.find(t => !/plan|proposed/i.test(t.name)) || ids[0]; if (!pick) { list.push({name: b.name, uid: b.uid, stations: []}); continue; }
    await sleep(800);
    const r2 = await W.get('trajectory', `<trajectorys ${C.NS}><trajectory uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(b.uid)}" uid="${C.xa(pick.uid)}"/></trajectorys>`, 'returnElements=all');
    const t = C.parseTrajectory(r2.xml); list.push({name: b.name, uid: b.uid, stations: t?.stations || []});
    await sleep(800);
  }
  S.branchTrajs = list; S.branchMsg = ''; buildBranches();
}
function buildBranches() {
  if (!S.branchTrajs || !(S.surveyOverride || S.traj)) return;
  const stations = S.surveyOverride || S.traj.stations;
  const list = S.branchTrajs.map(b => b.active ? {name: b.name, uid: b.uid, stations} : b);
  const extra = (S.extraOffsets || []).map(o => ({name: o.name, stations: o.stations || o.path || []}));
  S.branches = C.buildBranches([...list, ...extra]);
}
async function extras() { // one bounded job per loop turn, in order of what the operator sees first
  if (S.backfill === 'todo' || S.backfill === 'reading') return backfill();
  if (PAGE === 'wellplan') { // well plan page: only the other holes (ghost lines, clearance) and any store plan
    if (!S.branchTrajs) return readBranches();
    if (S.storePlanId && !S.storePlan) return readStorePlan();
    return;
  }
  if (PAGE === 'joints') { // joints page: no image log needed
    if (!S.fe) return readExtra('fe', /formation evaluation|gamma|\bfe\b/i);
    if (!S.branchTrajs) return readBranches();
    if (S.storePlanId && !S.storePlan) return readStorePlan();
    return readExtra('fe', /formation evaluation|gamma|\bfe\b/i);
  }
  if (!S.image) return readExtra('image', /image/i);
  if (!S.fe) return readExtra('fe', /formation evaluation|gamma|\bfe\b/i);
  if (!S.branchTrajs) return readBranches();
  if (S.storePlanId && !S.storePlan) return readStorePlan();
  await readExtra('image', /image/i); await sleep(1000); await readExtra('fe', /formation evaluation|gamma|\bfe\b/i);
}
async function refreshHeader() {
  const old = S.log; const logs = await readHeaders(S.wb.uid);
  const same = logs.find(l => l.uid === old.uid); if (same) { Object.assign(old, {changed: same.changed, end: same.end, growing: same.growing}); }
  const tl = S.timeLog && logs.find(l => l.uid === S.timeLog.uid); const tlMoved = tl && tl.end !== S.timeLog.end;
  if (tl) S.timeLog = tl;
  if (!S.override.log) { const best = C.pickPrimary(logs); if (best && best.uid !== old.uid) { await selectWellbore(S.wb); return; } }
  if (tlMoved && S.timeLog !== S.log) await readBit();
}
// Time log for Joints / Performance (connection times, off-bottom, mode evidence): read only once requested.
// First 3 h up to the log end (≤ 3 pages of 5,000 rows), then new rows each minute; "Read 3 h earlier" pages further back on request.
async function readTimeLog() {
  const L = S.timeLog, receiptScope=surveyContext().scope; if (!L) { S.tl = {missing: true, rows: []}; return; }
  if (!S.tl || S.tl.uid !== L.uid || S.tl.scope!==receiptScope) S.tl = {scope:receiptScope,uid: L.uid, name: L.name, ml: [], ul: [], rows: [], map: null};
  const T = S.tl, q = (a, b) => `<logs ${C.NS}><log uidWell="${C.xa(S.well.uid)}" uidWellbore="${C.xa(S.wb.uid)}" uid="${C.xa(L.uid)}"><startDateTimeIndex>${new Date(a).toISOString()}</startDateTimeIndex>${b ? `<endDateTimeIndex>${new Date(b).toISOString()}</endDateTimeIndex>` : ''}<logData><mnemonicList/><unitList/><data/></logData></log></logs>`;
  if (S.tlBack && T.rows.length) { // one 3 h block further back
    S.tlBack = false; const first = T.rows[0][0], buf = {ml: [], ul: [], rows: []}; let from = first - 3 * 3600e3;
    for (let p = 0; p < 3 && from < first - 1000; p++) { if(receiptScope!==surveyContext().scope||T!==S.tl)return;const r = await W.get('log', q(from, first - 1000), 'returnElements=data-only;maxReturnNodes=5000'); if(receiptScope!==surveyContext().scope||T!==S.tl||S.timeLog?.uid!==L.uid)return;const d = C.parseLogData(r.xml, true); if (!d.rows.length) break; C.appendRows(buf, d, 1e9); from = d.rows.at(-1)[0] + 1000; if (d.rows.length < 4990) break; await sleep(1000); }
    if (buf.rows.length) C.prependRows(T, buf); render(); return;
  }
  const end = Date.parse(L.end); let from = T.rows.length ? T.rows.at(-1)[0] + 1000 : (Number.isFinite(end) ? end - 3 * 3600e3 : Date.now() - 3 * 3600e3);
  for (let p = 0; p < 3; p++) {
    if(receiptScope!==surveyContext().scope||T!==S.tl)return;const r = await W.get('log', q(from), 'returnElements=data-only;maxReturnNodes=5000'); if(receiptScope!==surveyContext().scope||T!==S.tl||S.timeLog?.uid!==L.uid)return;const d = C.parseLogData(r.xml, true); if (!d.rows.length) break;
    if (!T.map) T.map = C.mapChannels(d.ml, d.ul, L); C.appendRows(T, d, 80000); from = d.rows.at(-1)[0] + 1000; if (d.rows.length < 4990) break; await sleep(1000);
  }
  T.read = Date.now(); render();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let backoff = 0;
async function loop() {
  if (S.started) return; S.started = true;
  while (true) {
    if (!W.hasCred() || W.state.dead) { S.started = false; render(); return; }
    const now = Date.now();
    try {
      if (!S.wb || now >= S.due.discover) { await discover(); S.due = {data: now + 20000, header: now + 60000, survey: now + 120000, discover: now + 600000, extra: now + 3000}; }
      else if (now >= S.due.data) { S.due.data = now + 20000; await readData(false); }
      else if (now >= S.due.header) { S.due.header = now + 60000; await refreshHeader(); }
      else if (now >= S.due.survey) { S.due.survey = now + 120000; await readSurvey(); }
      else if (S.wantTl && now >= (S.due.tl ?? 0)) { S.due.tl = now + 60000; await readTimeLog(); }
      else if (now >= S.due.extra) { const first = PAGE === 'wellplan' ? !S.branchTrajs : S.backfill !== 'done' || (!S.image && PAGE !== 'joints') || !S.fe || !S.branchTrajs; S.due.extra = now + (first ? 3000 : 60000); await extras(); }
      setMsg(''); backoff = 0;
    } catch (e) {
      setMsg(e.message); if (e.fatal || e.needAuth) { S.started = false; render(); return; }
      backoff = Math.min(120000, (backoff || 10000) * 2); await sleep(backoff);
    }
    render(); await sleep(4000);
  }
}

// ---------- view ----------
const TILES = [['rop', 'ROP'], ['wob', 'WOB'], ['rpm', 'RPM'], ['torque', 'Torque'], ['spp', 'SPP'], ['flowIn', 'Flow in'], ['flowOut', 'Flow out'], ['hkl', 'Hookload'], ['bh', 'Block height']];
const COLORS = {rop: '#5cc8ff', wob: '#ffb547', rpm: '#7ee08a', torque: '#d59cff', spp: '#ff7b7b', flowIn: '#4fd1c5', flowOut: '#9ad0ff', hkl: '#f6e05e', bh: '#a0aec0'};
const MARKUP = `
<header class="on-top">
  <div class="on-id"><b id="onWell">WITSML</b><span id="onWb"></span> <a class="on-world" href="./world.html" title="Field map: world to well">Field map</a></div>
  <div class="on-state"><span id="onState" class="on-chip">Connecting</span><span id="onFresh" class="on-fresh"></span></div>
  <section id="onOperationReport" hidden aria-label="Reported well operation"></section>
  <div class="on-depths"><div><small>Hole MD</small><b id="onHole">—</b></div><div><small id="onBitLbl">Bit MD</small><b id="onBit">—</b></div><div><small>Last survey</small><b id="onLastSv">—</b></div></div>
  <button id="onGear" class="on-gear" type="button" aria-label="Settings" aria-expanded="false">⚙</button>
  <nav class="on-views" aria-label="Views"><button type="button" id="onLandingWorkspace">Landing & drilling</button><button type="button" data-v="log">Live log</button><button type="button" id="onPerformance">Performance</button><button type="button" data-v="3d">3D wells</button><button type="button" data-v="ac" id="onAcBtn">Anti-collision</button><button type="button" data-v="tally">Tally</button><button type="button" data-v="geo">Geosteer</button><a class="on-linkbtn" id="onJointsLink" href="./joints.html">Joints ↗</a><a class="on-linkbtn" id="onPlanLink" href="./wellplan.html" title="Well planning (key P)">Well plan ↗</a></nav>
</header>
<p id="onMsg" class="on-msg" role="status" hidden></p>
<section id="onSignin" class="on-card on-signin" hidden>
  <h2>Sign in to the WITSML store</h2>
  <p class="on-muted">Read-only. The password stays in this browser tab only.</p>
  <form id="onForm" autocomplete="on" onsubmit="return false">
    <input id="onUser" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="Username">
    <input id="onPass" name="password" type="password" autocomplete="current-password" placeholder="Password">
    <label class="on-muted"><input id="onRem" type="checkbox" checked> Remember username on this device</label>
    <button id="onGo" type="submit">Connect</button>
  </form>
</section>
<main id="onMain"><section id="onLandingDock" aria-label="Landing and drilling guidance"></section>
  <p id="onTilesNote" class="on-muted on-tilesnote"></p>
  <section class="on-tiles" id="onTiles"></section>
  <section class="on-grid">
    <div class="on-card on-trends"><div class="on-h"><h2>Drilling parameters</h2><span id="onTrendAxis" class="on-muted"></span></div><div id="onTrends"></div>
      <div class="on-trend on-axisrow"><span><b>Hole depth (m MD)</b></span><canvas id="onAxis"></canvas></div><p id="onTrendRead" class="on-muted on-read">Hover or touch a chart to read values at a depth.</p></div>
    <div class="on-side">
      <div class="on-card"><div class="on-h"><h2><span id="onJointLabel">Joint</span> <b id="onJointNo" class="on-jno"></b></h2><span id="onJointNote" class="on-muted"></span></div>
        <div class="on-bar"><span id="onJointBar"></span></div><div class="on-flex"><b id="onJointDone">—</b><span id="onJointRange" class="on-muted"></span></div>
        <ul id="onJoints" class="on-list"></ul></div>
      <div class="on-card"><div class="on-h"><h2>Survey</h2><span id="onSvNote" class="on-muted"></span></div>
        <div class="on-svbar"><label class="jt-tally">Import survey report<input id="onSvFile" type="file" accept=".csv,.txt,.xlsx" hidden></label><button type="button" id="onSvExport">Export survey report</button></div>
        <table class="on-table"><thead><tr><th>MD m</th><th>Inc °</th><th>Azi °</th><th>TVD m</th><th>DLS °/30m</th><th>Time</th></tr></thead><tbody id="onSv"></tbody></table><p id="onProj" class="on-muted on-proj"></p>
        <div class="on-plots"><canvas id="onPlan" width="300" height="220" aria-label="Plan view"></canvas><canvas id="onSect" width="300" height="220" aria-label="Section view"></canvas></div></div>
    </div>
  </section>
  <footer id="onFoot" class="on-muted"></footer>
</main>
<aside id="onSettings" class="on-settings" hidden>
  <div class="on-h"><h2>Settings</h2><button id="onClose" type="button" aria-label="Close settings">✕</button></div>
  <label>Well name or UID <input id="onWellTarget" type="text" maxlength="256" autocapitalize="off" spellcheck="false"></label><button id="onOpenWell" type="button">Open well</button><p class="on-muted">Opening another well refreshes Ops. Reconnect if prompted.</p><label>Wellbore <select id="onSelWb"></select></label>
  <label>Drilling log <select id="onSelLog"></select></label>
  <div id="onDiag" class="on-diag"></div>
  <p><button id="onReload" type="button">Re-read now</button> <button id="onOut" type="button">Sign out</button></p>
  <details><summary>Advanced tools</summary><button id="onLanding" type="button">Landing planner · Q</button></details>
  <p><a href="./?operations">Engineering dashboard</a> · <a href="./">Simulator</a></p>
</aside>`;
const MARKUP_J = MARKUP.replace(/<nav class="on-views"[\s\S]*?<\/nav>/, '<nav class="on-views" aria-label="Pages"><a class="on-linkbtn" id="onOpsLink" href="./ops.html">← Operations screen</a><span class="on-pagetag">Joints dashboard</span><button type="button" id="onScanBtn" title="3D anti-collision scanner (key A)">AC scanner <kbd>A</kbd></button><a class="on-linkbtn" id="onPlanLink" href="./wellplan.html">Well plan ↗</a></nav>')
  .replace(/<main id="onMain">[\s\S]*?<\/main>/, '<main id="onMain" class="jt-main"><p id="vwNote" class="on-muted jt-note"></p><div id="jtHost"></div></main>');
const MARKUP_P = MARKUP.replace(/<nav class="on-views"[\s\S]*?<\/nav>/, '<nav class="on-views" aria-label="Pages"><a class="on-linkbtn" id="onOpsLink" href="./ops.html">← Operations screen</a><span class="on-pagetag">Well plan</span><a class="on-linkbtn" id="onJointsLink" href="./joints.html">Joints ↗</a><button type="button" id="onConnBtn" class="on-linkbtn" hidden>Connect WITSML for existing holes</button></nav>')
  .replace(/<main id="onMain">[\s\S]*?<\/main>/, '<main id="onMain" class="jt-main wp-main"><div id="wpHost"></div></main>');
function setMsg(t) { S.message = t || ''; const m = $('onMsg'); if (m) { m.textContent = S.message; m.hidden = !S.message; } }
function chart(cv, xs, ys, color, x0, x1, marks, hover) {
  const dpr = devicePixelRatio || 1, w = cv.clientWidth || 300, h = cv.clientHeight || 56;
  cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  g.strokeStyle = '#16212b'; for (const t of C.niceTicks(x0, x1, 10)) { const x = (t - x0) / (x1 - x0) * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  if (hover != null && hover >= x0 && hover <= x1) { const x = (hover - x0) / (x1 - x0) * w; g.strokeStyle = '#cfe3f5'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  if (xs.length < 2) { g.fillStyle = '#6b7d8c'; g.font = '12px system-ui'; g.fillText('no samples in window', 8, h / 2); return; }
  let lo = Infinity, hi = -Infinity; for (const y of ys) { if (y < lo) lo = y; if (y > hi) hi = y; }
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; } const pad = (hi - lo) * .1; lo -= pad; hi += pad;
  const X = x => (x - x0) / (x1 - x0) * w, Y = y => h - (y - lo) / (hi - lo) * h;
  g.strokeStyle = '#2a3a48'; g.setLineDash([3, 4]); for (const m of marks) { g.beginPath(); g.moveTo(X(m), 0); g.lineTo(X(m), h); g.stroke(); } g.setLineDash([]);
  g.strokeStyle = color; g.lineWidth = 1.5; g.beginPath(); xs.forEach((x, i) => i ? g.lineTo(X(x), Y(ys[i])) : g.moveTo(X(x), Y(ys[i]))); g.stroke();
  g.fillStyle = '#6b7d8c'; g.font = '10px system-ui'; g.fillText(fmt(hi - pad, Math.abs(hi) < 10 ? 1 : 0), 4, 11); g.fillText(fmt(lo + pad, Math.abs(lo) < 10 ? 1 : 0), 4, h - 3);
  if (lo < 0 && hi > 0) { g.strokeStyle = '#3a4a58'; g.setLineDash([1, 3]); g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke(); g.setLineDash([]); }
}
// Depth axis under the trend charts: ticks every 10 m, labels every 10 m (20 m on narrow screens), joint numbers at connections.
function depthAxis(cv, x0, x1, conns, jno) {
  const dpr = devicePixelRatio || 1, w = cv.clientWidth || 300, h = cv.clientHeight || 34;
  cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  if (!(x1 > x0)) return; const X = x => (x - x0) / (x1 - x0) * w, lab = w < 360 ? 20 : 10;
  g.strokeStyle = '#4a5d6e'; g.beginPath(); g.moveTo(0, 0.5); g.lineTo(w, 0.5); g.stroke();
  g.fillStyle = '#9fb1c1'; g.font = '10px system-ui'; g.textAlign = 'center';
  for (const t of C.niceTicks(x0, x1, 10)) { const x = X(t); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 5); g.stroke(); if (Math.round(t) % lab === 0 && x > 12 && x < w - 12) g.fillText(fmt(t, 0), x, 15); }
  conns.forEach((c, i) => { if (c.md < x0 || c.md > x1) return; const x = X(c.md); g.fillStyle = '#5f7c95'; g.fillRect(x - 0.5, 18, 1, 4); const n = jno?.n != null ? jno.n - (conns.length - 1 - i) : null; const label=S.effectiveReference?inventoryResetLabel(S.effectiveReference,c.md):n!=null?(jno.kind==='estimated'?'E':'J')+n:'';if(label)g.fillText(label,x,31); });
  g.textAlign = 'left';
}
function survPlot(cv, pts, mode, plan) {
  const dpr = devicePixelRatio || 1, w = cv.clientWidth || 300, h = cv.clientHeight || 200; cv.width = w * dpr; cv.height = h * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  g.fillStyle = '#8aa0b2'; g.font = '11px system-ui'; g.fillText(mode === 'plan' ? 'PLAN · N up (computed from MD/Inc/Azi)' : 'SECTION · TVD vs MD', 6, 13);
  if (pts.length < 2) { g.fillText('needs two stations', 6, h / 2); return; }
  const xs = pts.map(p => mode === 'plan' ? p.e : p.md), ys = pts.map(p => mode === 'plan' ? p.n : -(p.tvd ?? p.tvdc));
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (mode === 'plan') { const s = Math.max(x1 - x0, y1 - y0, 10) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; x0 = cx - s; x1 = cx + s; y0 = cy - s; y1 = cy + s; }
  else { const s = Math.max(y1 - y0, 4); y0 -= s * .3; y1 += s * .3; }
  const m = 22, X = x => m + (x - x0) / ((x1 - x0) || 1) * (w - 2 * m), Y = y => h - m + 6 - (y - y0) / ((y1 - y0) || 1) * (h - 2 * m);
  if (plan?.length > 1) { const px = plan.map(p => mode === 'plan' ? p.e : p.md), py = plan.map(p => mode === 'plan' ? p.n : -(p.tvd ?? p.tvdc)); g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip(); g.strokeStyle = '#e6edf3aa'; g.setLineDash([5, 4]); g.lineWidth = 1.2; g.beginPath(); px.forEach((x, i) => i ? g.lineTo(X(x), Y(py[i])) : g.moveTo(X(x), Y(py[i]))); g.stroke(); g.setLineDash([]); g.restore(); g.fillStyle = '#cfd9e2'; g.font = '10px system-ui'; g.fillText('- - plan', w - 50, 13); }
  g.strokeStyle = '#5cc8ff'; g.lineWidth = 2; g.beginPath(); xs.forEach((x, i) => i ? g.lineTo(X(x), Y(ys[i])) : g.moveTo(X(x), Y(ys[i]))); g.stroke();
  g.fillStyle = '#ffb547'; g.beginPath(); g.arc(X(xs.at(-1)), Y(ys.at(-1)), 4, 0, 7); g.fill();
  g.fillStyle = '#6b7d8c'; g.font = '10px system-ui';
  if (mode === 'plan') g.fillText('span ' + fmt(x1 - x0, 0) + ' m', w - 70, h - 4);
  else { g.fillText('TVD ' + fmt(-y1, 1) + '–' + fmt(-y0, 1) + ' m', 6, h - 4); g.fillText('MD ' + fmt(x0, 0) + '–' + fmt(x1, 0), w - 90, h - 4); }
}
let built = false, pumpGraphic = null;
function buildCommon() {
  $('onUser').value = W.rememberedUser();
  $('onWellTarget').value=DEF_WELL;
  $('onOpenWell').onclick=()=>{try{location.assign(wellWorkspaceUrl(location.href,$('onWellTarget').value));}catch(error){setMsg(error.message);$('onWellTarget').focus();}};
  $('onWellTarget').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('onOpenWell').click();}};
  $('onGo').onclick = () => { const u = $('onUser').value.trim(), p = $('onPass').value; if (!u || !p) return setMsg('Enter username and password'); W.signIn(u, p, $('onRem').checked); $('onPass').value = ''; setMsg('Connecting…'); render(); loop(); };
  $('onGear').onclick = () => { const s = $('onSettings'); s.hidden = !s.hidden; $('onGear').setAttribute('aria-expanded', String(!s.hidden)); render(); };
  $('onClose').onclick = () => { $('onSettings').hidden = true; $('onGear').setAttribute('aria-expanded', 'false'); };
  $('onOut').onclick = () => { surveyAlerts?.clear(); W.signOut(); location.reload(); };
  $('onReload').onclick = () => { S.due = {data: 0, header: 0, survey: 0, discover: 0, extra: 0}; S.wb = null; loop(); };
  $('onSelWb').onchange = e => { S.override.wb = e.target.value; S.override.log = ''; S.wb = null; S.due.discover = 0; loop(); };
  $('onSelLog').onchange = e => { S.override.log = e.target.value; if (S.wb) { S.log = null; selectWellbore(S.wb).catch(x => setMsg(x.message)); } };
  addEventListener('resize', () => render());
}
function build() {
  if (built) return; built = true;
  document.body.innerHTML = '<div id="onRoot" class="on-root' + (PAGE === 'joints' ? ' on-jpage' : PAGE === 'wellplan' ? ' on-jpage on-wppage' : '') + '">' + (PAGE === 'joints' ? MARKUP_J : PAGE === 'wellplan' ? MARKUP_P : MARKUP) + '</div>';
  const qs = location.search; for (const a of document.querySelectorAll('#onJointsLink,#onOpsLink,#onPlanLink')) a.href += qs;
  landingPlanner=initLandingPlanner(ctx);
  if (PAGE === 'wellplan') { buildCommon(); WP.init(ctx, $('wpHost'), {xlsxRows: VW.xlsxRows}); $('onConnBtn').onclick = () => { S.showSignin = !S.showSignin; render(); }; document.title = 'Well plan · live WITSML'; return; }
  addEventListener('keydown', e => { if (e.key !== 'p' && e.key !== 'P') return; if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable) return; location.href = './wellplan.html' + qs; });
  if (PAGE === 'joints') { buildCommon(); S.wantTl = true; VW.initJointsPage(ctx, $('jtHost')); $('onScanBtn').onclick = () => VW.togglePop(true); document.title = 'Joints · live WITSML'; return; }
  landingDock=initLandingDock({host:$('onLandingDock'),getContext:ctx,planner:landingPlanner});
  performanceView=initPerformance({button:$('onPerformance'),getContext:()=>({...ctx(),scope:surveyContext().scope,primaryLog:S.log,timeLog:S.timeLog,tl:S.tl?.scope===surveyContext().scope?S.tl:null}),onOpen:()=>{S.wantTl=true;if(!S.tl)S.due.tl=0;}});
  pumpGraphic = createPumpGraphic({host: document.querySelector('.on-depths')});
  $('onTiles').innerHTML = TILES.map(([k, n]) => `<div class="on-tile" data-k="${k}"><small>${n}</small><b id="onV_${k}">—</b><i id="onU_${k}"></i></div>`).join('');
  $('onTrends').innerHTML = TILES.map(([k, n]) => `<div class="on-trend" data-k="${k}"><span><b>${n}</b> <em id="onT_${k}"></em></span><canvas id="onC_${k}"></canvas></div>`).join('');
  buildCommon();
  const tr = $('onTrends').parentElement;
  const hov = e => { const cv = tr.querySelector('canvas'); if (!cv || !S.trendX) return; const r = cv.getBoundingClientRect(); const f = (e.clientX - r.left) / r.width; S.hoverMd = f >= 0 && f <= 1 ? S.trendX[0] + f * (S.trendX[1] - S.trendX[0]) : null; render(); };
  tr.addEventListener('pointermove', hov); tr.addEventListener('pointerdown', hov); tr.addEventListener('pointerleave', () => { S.hoverMd = null; render(); });
  document.querySelectorAll('.on-views button[data-v]').forEach(b => b.onclick = () => VW.open(b.dataset.v));
  VW.init(ctx);
  if ($('onSvFile')) $('onSvFile').onchange = async e => { const f = e.target.files?.[0]; if (f) { try { await VW.importSurvey(f, ctx()); render(); } catch (err) { setMsg(err.message); } } e.target.value = ''; };
  if ($('onSvExport')) $('onSvExport').onclick = () => VW.downloadSurvey(ctx());
}
// What the pop-up views need, computed from the same state as the main screen.
function ctx() {
  const holeMd = S.log && !S.log.time ? S.data.rows.at(-1)?.[0] : null;
  return {landingFeed:{signed:W.hasCred()&&!W.state.dead,advancedAt:S.advancedAt},...referenceContext(),operationReport:S.operationReport,historicalRun:!!S.operationReport,data: S.data, fe: S.fe, image: S.imageRows, imageRange: S.imageRange, conns: S.conns, jointNo: S.jointNo, bitMd: S.bitMd ?? null, holeMd: S.holeMd ?? holeMd, bitKind: S.bitKind, depthCheck:S.depthCheck, pipeChecks:S.pipeChecks||[],
    branches: S.branches, branchMsg: S.branchMsg, active: S.wb?.name, bitPos: S.bitPos, ac: S.ac, backfilling: S.backfill === 'reading' || S.backfill === 'todo',
    tally: S.tally, tallyName: S.tallyName, tallyError: S.tallyError, tallyCmp: S.tally ? C.compareTally(S.tally, S.conns || [], S.bitMd) : null,
    refresh: () => render(), map: S.map, tl: S.tl, timeLogName: S.timeLog?.name || '',
    readTimeBack: () => { S.tlBack = true; S.due.tl = 0; },
    well: S.well?.name || DEF_WELL, rig: S.rigName, kb: (VW.getKb?.() ?? S.surveyHeader?.kb?.v ?? null),
    plan: currentPlan()?.path || null, planName: currentPlan()?.name || '', planSource: currentPlan()?.source || 'no plan in store',
    offsets: S.offsets, surveyHeader: S.surveyHeader, reportSurveys: JS.state(),surveySource:S.surveyOverride?'Uploaded survey override':S.traj?.name||'Active WITSML survey',
    surveys: (S.surveyOverride ? S.surveyOverride.map(s => ({...s, tvd: s.tvd ?? s.tvdc})) : (S.traj?.calc || [])),
    setTally: (t, name, err) => { S.tally = t; S.tallyName = name; S.tallyError = err || ''; try { t ? localStorage.setItem(TKEY, JSON.stringify({t, name})) : localStorage.removeItem(TKEY); } catch {} render(); },
    setOffsets: (o, src) => { S.offsets = {...(o || {}), source: src || o?.source || 'uploaded'}; try { localStorage.setItem(OKEY(S.well?.name || DEF_WELL), JSON.stringify(S.offsets)); } catch {} render(); },
    setPlan: (p, name) => { S.importedPlan = p; S.importedPlanName = name || p?.name || 'plan'; try { localStorage.setItem('opsnow-plan:' + (S.well?.name || DEF_WELL), JSON.stringify({p, name: S.importedPlanName})); } catch {} VW.setPlan?.(p, S.importedPlanName); render(); },
    addOffset: o => { S.extraOffsets = [...(S.extraOffsets || []).filter(x => x.name !== o.name), o]; buildBranches(); render(); },
    setSurveyOverride: (stations, parsed, name) => { S.surveyOverride = stations; S.surveyHeader = parsed?.header || S.surveyHeader; S.traj = S.traj || {}; S.traj.calc = C.minCurve(stations); S.traj.name = 'uploaded override · ' + (name || ''); buildBranches(); render(); },
    setSurveyHeader: h => { S.surveyHeader = h; },
    onOpen: v => { if ((v === '3d' || v === 'ac' || v === 'geo' || v === 'joints' || v === 'tally' || v === 'slide') && !S.branchTrajs && S.wb) S.due.extra = 0; if (v === 'joints' || v === 'tally' || v === 'slide') { S.wantTl = true; if (!S.tl) S.due.tl = 0; } }};
}
function currentPlan() {
  if (S.importedPlan?.path) return {path: S.importedPlan.path, name: S.importedPlanName || S.importedPlan.name, source: S.importedPlan.source || ('uploaded: ' + (S.importedPlanName || 'plan'))};
  const g = VW.getPlan?.(); if (g?.path) return g;
  if (S.storePlan?.path) return S.storePlan;
  const f = WPL.planFor(S.well?.name || DEF_WELL, S.wb?.name); if (f) return f; // dr101l-plan-1115: well-folder plan, last fallback
  return null;
}
function render() {
  build();
  S.operationReport=reportedOperation(S.well?.name,S.wb?.name);
  ensureMeasuredReference();
  S.effectiveReference=referenceContext().measuredReference;
  const signed = W.hasCred() && !W.state.dead;
  $('onSignin').hidden = signed || (PAGE === 'wellplan' && !S.showSignin); $('onMain').hidden = PAGE !== 'wellplan' && !signed && !S.data.rows.length;
  if (PAGE === 'wellplan' && $('onConnBtn')) $('onConnBtn').hidden = signed;
  const L = S.log, rows = S.data.rows, now = Date.now();
  $('onWell').textContent = S.well?.name || DEF_WELL; $('onWb').textContent = S.wb ? 'Wellbore ' + S.wb.name + (L ? ' · ' + L.name : '') : '';
  const fresh = C.freshness(L?.changed, now);
  const lv = C.latestValues(rows, S.map);
  const primaryFlow = pumpSample({rows, channel: S.map.flowIn, latest: lv.flowIn, time: Boolean(L?.time), source: L?.name});
  const secondaryFlow = S.pumpSample?.scope === surveyContext().scope && S.pumpSample?.logUid === S.timeLog?.uid ? S.pumpSample.sample : null;
  const dc = driveChannel({ml: S.data.ml, ul: S.data.ul, header: L, blockChannel: S.map.bh});
  const dh = dc ? C.latestValues(rows, {drive: dc}).drive : null;
  const primaryDrive = driveSample({rows, channel: dc, latest: dh, time: Boolean(L?.time), source: L?.name});
  if(primaryDrive && !L?.time && S.previousDepthRow?.[0]===rows.at(-1)?.[0]){const change=driveSample({rows:[S.previousDepthRow,rows.at(-1)],channel:dc,latest:dh,time:false,source:L?.name});primaryDrive.previousValue=change.previousValue;if(Number.isFinite(change.previousValue)){primaryDrive.min=Math.min(primaryDrive.min,change.previousValue);primaryDrive.max=Math.max(primaryDrive.max,change.previousValue);}}
  const secondaryDrive = S.pumpSample?.scope === surveyContext().scope && S.pumpSample?.logUid === S.timeLog?.uid ? S.pumpSample.drive : null;
  const primaryPressure=pumpSample({rows,channel:S.map.spp,latest:lv.spp,time:Boolean(L?.time),source:L?.name});
  const secondaryPressure=S.pumpSample?.scope===surveyContext().scope && S.pumpSample?.logUid===S.timeLog?.uid ? S.pumpSample.pressure : null;
  pumpGraphic?.update({signed, now, pressureSample:L?.time ? primaryPressure : primaryPressure || secondaryPressure, sample: L?.time ? primaryFlow : primaryFlow || secondaryFlow, driveSample: L?.time ? primaryDrive : primaryDrive || secondaryDrive});
  const sourceHoleMd=L&&!L.time?rows.at(-1)?.[0]:depthMetres(lv.hd?.v,S.map.hd),report=S.operationReport;
  renderOperationReport($('onOperationReport'),report,sourceHoleMd);
  const state = !signed ? (W.state.dead ? 'Stopped' : 'Not signed in') : report ? (reportDepthIssue(report,sourceHoleMd)?'Reported TD · depth conflict':'Liner running · reported 18 Nov') : !L ? 'Connecting' : C.rigState({fresh, advancedAt: S.advancedAt, watchFrom: S.watchFrom, now, rpm: lv.rpm?.v, rop: lv.rop?.v, flow: lv.flowIn?.v, timeLog: L?.time});
  const chip = $('onState'); chip.textContent = state; chip.dataset.s = /^Drilling/.test(state) ? 'drill' : /No new|Stopped|Not signed/.test(state) ? 'bad' : 'idle';
  // The store re-stamps dTimLastChange about once a minute even when no row is added, so it proves the
  // feed is connected, not that data is new. New data = rows added between our own reads.
  const adv = S.advancedAt != null && now - S.advancedAt < C.BATCH_MS;
  const since = S.advancedAt ?? S.watchFrom;
  $('onFresh').textContent = !L ? '' : fresh.state === 'stopped' || fresh.state === 'unknown' ? 'NO NEW DATA · store last changed ' + C.aestDay(fresh.t) :
    adv ? 'LIVE · new rows ' + C.ago(now - S.advancedAt) : (L.time ? 'Last row ' + C.aest(rows.at(-1)?.[0]) : 'Feed connected (store sync ' + C.aest(fresh.t) + ') · ' + (S.advancedAt != null ? 'no new rows since ' + C.aest(S.advancedAt) : 'no new rows since this screen opened ' + C.aest(since)));
  $('onFresh').dataset.s = adv ? 'live' : fresh.state === 'stopped' ? 'stopped' : 'delayed';
  const holeMd = L && !L.time ? rows.at(-1)?.[0] : depthMetres(lv.hd?.v,S.map.hd);
  $('onHole').textContent = Number.isFinite(holeMd) ? fmt(holeMd, 1) + ' m' : '—';
  const reported = L?.time ? (lv.bd ? {v: depthMetres(lv.bd.v,S.map.bd), at: lv.bd.at, source: L.name} : null) : (S.bit ? {v: S.bit.v, at: S.bit.at, source: S.bit.log?.name || S.timeLog?.name || 'time log'} : null);
  // A fresh off-bottom bit is legitimate. Never replace it just to agree with hole MD.
  const rowBit = !L?.time&&S.map.bd ? depthMetres(C.value(rows.at(-1)?.[S.map.bd.col],S.map.bd),S.map.bd) : null;
  const bit = Number.isFinite(rowBit) ? {...C.clampBit(rowBit,holeMd),kind:'reported',source:L.name,depthIndexed:true} : C.resolveBit({reported, holeMd, state, now});
  S.depthCheck=reconcileDepths({holeMd,bit});
  $('onBitLbl').textContent = bit.kind === 'derived' ? 'Bit MD · derived' : 'Bit MD';
  $('onBit').dataset.kind = bit.kind; $('onBit').dataset.stale = String(bit.kind === 'stale' || bit.kind === 'missing');
  if (bit.kind === 'reported') {
    $('onBit').textContent = bit.clamped ? 'check source' : fmt(bit.v, 1) + ' m';
    $('onBit').title = 'Reported by source (' + bit.source + ') '+(bit.depthIndexed?'at '+fmt(holeMd,1)+' m MD (depth log)': 'at '+C.aestDay(bit.at)) + (bit.clamped ? '. Source said ' + fmt(bit.was, 1) + ' m, deeper than hole MD ' + fmt(holeMd, 1) + ' m. Excluded from tally counts until resolved.' : '');
  } else if (bit.kind === 'derived') {
    $('onBit').textContent = fmt(bit.v, 1) + ' m';
    $('onBit').title = 'Derived, not reported: assumes on-bottom drilling while hole MD is advancing. No current bit-depth channel is available.';
  } else if (bit.kind === 'stale') {
    $('onBit').textContent = 'not reported';
    $('onBit').title = 'No live bit-depth channel. "' + (bit.source || S.timeLog?.name || 'time log') + '" stopped at ' + C.aestDay(bit.at) + (bit.last != null ? ' (' + fmt(bit.last, 1) + ' m then)' : '') + '. Bit MD is shown as derived from hole MD only while drilling on bottom.';
  } else {
    $('onBit').textContent = 'not in source';
    $('onBit').title = 'No bit depth channel is reported. Bit MD is shown as derived from hole MD only while drilling on bottom.';
  }
  S.bitMd = S.depthCheck.bitMd; S.holeMd = S.depthCheck.holeMd; S.bitKind = bit.clamped?'invalid':bit.kind;
  landingPlanner?.refresh();landingDock?.refresh();
  const conns = L && !L.time ? blockConnections(rows,S.map) : [];S.conns=conns;
  const cache=S.pipeCache,lastRow=rows.at(-1)?.join(',');
  if(!cache||cache.rows!==rows||cache.count!==rows.length||cache.tail!==lastRow||cache.map!==S.map||cache.tally!==S.tally){
    S.pipeChecks=derivePipeChecks({rows,map:S.map,conns,tally:/^tally board/i.test(S.tallyName)?null:S.tally,nominal:NOMINAL_JOINT_M});
    S.pipeCache={rows,count:rows.length,tail:lastRow,map:S.map,tally:S.tally};
  }
  // bit position: projected from the last survey (constant build/turn); absolute N/E once branches are tied on
  const actB = S.branches?.find(b => b.name === S.wb?.name), base = actB?.path || S.traj?.calc;
  S.bitPos = base?.length && Number.isFinite(S.bitMd) ? C.projectToBit(base, S.bitMd, holeMd) : null;
  S.ac = S.branches && S.bitPos && actB ? C.antiCollision(S.branches, S.wb.name, S.bitPos) : null;
  if (PAGE === 'wellplan') { const lastSv = S.traj?.stations?.at(-1); $('onLastSv').textContent = lastSv ? fmt(lastSv.md, 1) + ' m · ' + C.aest(Date.parse(lastSv.t)).replace(' AEST', '') : '—'; WP.refresh(); renderSettings(); return; }
  if (PAGE === 'joints') { // joints page: header + the Joints dashboard only
    S.jointNo = currentJoint(conns,holeMd);
    const lastSv = S.traj?.stations.at(-1); $('onLastSv').textContent = lastSv ? fmt(lastSv.md, 1) + ' m · ' + C.aest(Date.parse(lastSv.t)).replace(' AEST', '') : '—';
    VW.drawJoints(); renderPipeChecks(document,S.pipeChecks,S.depthCheck,$('jtHost').parentElement); renderSettings(); return;
  }
  // Badge: proximity (DIST, actual C-C) and separation factor (SF, estimated) shown apart, plus a flag when the hold projection reaches a limit.
  const acT = S.ac ? A.acTotals(S.ac) : null, acF = S.ac ? VW.forward() : null, acBtn = $('onAcBtn');
  const aheadL = acF ? acF.hold.worst : 'none', acL = acT ? [acT.dist, acT.sfL].reduce(A.worse) : '';
  acBtn.dataset.l = acL; acBtn.dataset.d = acT?.dist || ''; acBtn.dataset.s = acT?.sfL || '';
  acBtn.title = !acT ? 'Anti-collision (reading surveys)' : 'Closest centre-to-centre ' + fmt(acT.cc?.cc, 1) + ' m (' + (acT.cc?.name || '—') + ') · lowest estimated separation factor ' + fmt(acT.sf?.sf, 2) + ' (' + (acT.sf?.name || '—') + ')' + (acF ? ' · projected ahead: ' + A.summaryLine(acF.hold, acF.range) : '') + ' · press A anywhere for the scanner pop-up';
  acBtn.innerHTML = !acT ? 'Anti-collision' : `Anti-collision <i class="acb" data-k="d" data-l="${acT.dist}">${fmt(acT.cc?.cc, 0)} m</i><i class="acb" data-k="s" data-l="${acT.sfL}">SF ${fmt(acT.sf?.sf, 1)}</i>` + (A.RANK[aheadL] >= 2 ? `<i class="acb" data-k="a" data-l="${aheadL}">AHEAD</i>` : '');
  const lastSv = S.traj?.stations.at(-1); $('onLastSv').textContent = lastSv ? fmt(lastSv.md, 1) + ' m · ' + C.aest(Date.parse(lastSv.t)).replace(' AEST', '') : '—';
  const depthLog = L && !L.time, notAdv = !/^Drilling/.test(state);
  $('onTilesNote').textContent = !L ? '' : depthLog ? (notAdv ? 'Values at the last drilled depth, ' + fmt(holeMd, 1) + ' m MD. This log only adds rows while the hole deepens.' : 'Latest values at ' + fmt(holeMd, 1) + ' m MD') : 'Latest values at ' + C.aest(rows.at(-1)?.[0]);
  for (const [k] of TILES) {
    const ch = S.map[k], v = lv[k]; const tile = $('onV_' + k).parentElement;
    $('onV_' + k).textContent = ch ? (v ? fmt(v.v, Math.abs(v.v) < 100 ? 1 : 0) : '—') : 'not in source';
    $('onU_' + k).textContent = ch ? ch.unit + (ch.mn !== ch.label ? ' · ' + ch.mn : '') : '';
    tile.dataset.missing = String(!ch); tile.dataset.stale = String(fresh.state !== 'live');
  }
  // WOB: negative readings in the source are a hookload zero (tare) drift, not a reversed sign; shown as reported.
  const wc = C.wobCheck(rows, S.map.wob); const wt = $('onV_wob')?.parentElement;
  if (wt) { wt.dataset.flag = String(Boolean(wc?.tare)); wt.title = wc?.tare ? 'Shown as reported. ' + Math.round(wc.negShare * 100) + '% of the last ' + 60 + ' m reads below zero (median ' + fmt(wc.median, 1) + ' klbs) while ' + Math.round(wc.posShare * 100) + '% reads above 1 klbs: the surface WOB zero (off-bottom hookload) has drifted. Not a sign flip, so not inverted. Ask the rig to re-zero WOB.' : '';
    if (wc?.tare) $('onU_wob').textContent = (S.map.wob?.unit || '') + ' · not zeroed at source'; }
  // trends: depth logs vs MD (last 60 m), time logs vs time (last 2 h)
  const xEnd = rows.at(-1)?.[0], x0 = L?.time ? xEnd - TREND_MS : xEnd - TREND_M;
  const win = Number.isFinite(xEnd) ? rows.filter(r => r[0] >= x0) : [];
  $('onTrendAxis').textContent = Number.isFinite(xEnd) ? (L.time ? 'last 2 h to ' + C.aest(xEnd) : 'last ' + TREND_M + ' m drilled · dashed = BHE reset · '+(S.effectiveReference?'J labels require tally MD alignment':'E = estimated joint')) : '';
  for (const [k, n] of TILES) {
    const box = $('onC_' + k).parentElement, ch = S.map[k]; box.hidden = !ch;
    if (!ch) continue; const s = C.series(win, ch);
    $('onT_' + k).textContent = s.ys.length ? fmt(s.ys.at(-1), 1) + ' ' + ch.unit : '';
    chart($('onC_' + k), s.xs, s.ys, COLORS[k], Math.max(x0, rows[0][0]), xEnd, conns.map(c => c.md).filter(m => m >= x0), S.hoverMd);
  }
  const J0 = C.joints(conns, holeMd); S.jointNo = currentJoint(conns,holeMd);
  if (Number.isFinite(xEnd)) { S.trendX = [Math.max(x0, rows[0][0]), xEnd]; depthAxis($('onAxis'), S.trendX[0], xEnd, conns, S.jointNo); }
  if (S.hoverMd != null && Number.isFinite(xEnd)) {
    const [i0, i1] = C.sliceByIndex(rows, S.hoverMd - 0.05, S.hoverMd + 0.05); const r = rows[Math.min(i1 - 1, i0 + 1)] || rows.at(-1);
    $('onTrendRead').textContent = fmt(r[0], 1) + ' m MD · ' + TILES.filter(([k]) => S.map[k]).map(([k, n]) => { const v = C.value(r[S.map[k].col], S.map[k]); return n + ' ' + (v == null ? '—' : fmt(v, Math.abs(v) < 100 ? 1 : 0)) + ' ' + S.map[k].unit; }).join(' · ');
  } else $('onTrendRead').textContent = 'Hover or touch a chart to read values at a depth.';
  // Target joint length is from the tally or project nominal; MD spacing is separate.
  const JN = S.jointNo,ref=JN?.reference,J=ref?{...J0,current:{start:ref.startMd,drilled:ref.advance}}:J0,metric = jointMetrics({summary:J0,rows,blockChannel:S.map.bh,tally:S.tally,jointNumber:JN,nominal:NOMINAL_JOINT_M});
  $('onJointLabel').textContent=report?'Inventory at TD':'Joint';$('onJointBar').parentElement.hidden=!!report;
  if(ref){metric.length=ref.len;metric.basis='inventory MD reference';metric.overdue=false;}
  $('onJointNo').textContent = JN?.n != null ? '#' + JN.n + (JN.kind === 'estimated' ? ' (est.)' : JN.checkpoint?' (anchor)':ref?' (MD ref.)':' (tally)') : '';
  $('onJointNo').title = ref?'Measured inventory at '+JN.basis+'. BHA '+fmt(S.effectiveReference.bhaLen,2)+' m is already included in the '+fmt(S.effectiveReference.startMd,2)+' m starting reference. This is not an independently verified BHE connection count.':JN?.kind === 'estimated' ? JN.seen + ' connections seen in this wellbore\'s log + about ' + JN.above + ' joints already in the hole at the first one (first connection MD ÷ observed connection spacing). Load a tally for the exact number.' : JN?.kind === 'tally' ? 'From the loaded tally (' + S.tallyName + ')' : '';
  if (J.current) {
    const len = metric.length, pct = Math.min(100, J.current.drilled / len * 100);
    $('onJointBar').style.width = pct + '%'; $('onJointDone').textContent = fmt(J.current.drilled, ref?2:1) + ' / ' + fmt(len, ref?2:1) + ' m · ' + metric.basis;
    $('onJointRange').textContent = 'from ' + fmt(J.current.start, ref?2:1) + ' m MD · '+(ref?'inventory endpoint ':'expected connection ≈ ') + fmt(J.current.start + len, ref?2:1) + ' m MD' + (metric.overdue ? ' · connection may be missed' : '');
    $('onJointNote').textContent = [metric.spacing!=null?'connection spacing '+fmt(metric.spacing,1)+' m MD':'',metric.travel!=null?'observed BHE travel '+fmt(metric.travel,1)+' m':''].filter(Boolean).join(' · ');
    if(ref&&J0.current&&Math.abs(J0.current.start-ref.startMd)>.3)$('onJointNote').textContent+=' · BHE reset differs from tally start by '+fmt(Math.abs(J0.current.start-ref.startMd),2)+' m; alignment needs review';
    $('onJoints').innerHTML = J.list.slice(-4).reverse().map((j, i) => {const compared=S.effectiveReference?compareDerivedTally([{startMd:j.start,endMd:j.end,derivedLength:null,issues:[]}],S.effectiveReference).rows[0]:null;const label=S.effectiveReference?(compared?.entries&&compared.entries!=='unaligned'?'Tally MD '+compared.entries:'BHE interval (unaligned)'):JN?.n!=null?(JN.kind==='estimated'?'Est. J':'J')+(JN.n-1-i):'';return `<li><span>${label?label+' · ':''}${fmt(j.start, 1)} → ${fmt(j.end, 1)} m</span><b>${fmt(j.length, 1)} m MD</b></li>`;}).join('');
  } else { $('onJointBar').style.width = '0'; $('onJointDone').textContent = '—'; $('onJointRange').textContent = S.map.bh ? 'no connection in window yet' : 'block height not in source'; $('onJoints').innerHTML = ''; $('onJointNote').textContent = ''; }
  if(report){
    $('onJointNo').textContent=ref?'#'+ref.n+' (TD MD ref.)':'';
    $('onJointDone').textContent='TD '+fmt(report.tdMd,2)+' m MD · drilling complete';
    $('onJointRange').textContent=ref?'TD advance within inventory entry '+fmt(ref.advance,2)+' / '+fmt(ref.len,2)+' m; not a measured pipe length.':'Final drilling joint count unconfirmed.';
    $('onJointNote').textContent='Historical drilling reference · liner tally not supplied';
  }
  renderPipeChecks(document,S.pipeChecks,S.depthCheck,$('onJointDone').closest('.on-card'));
  let hp=$('onHardpoints');if(!hp){hp=document.createElement('section');hp.id='onHardpoints';$('onJointDone').closest('.on-card').append(hp);}renderHardpoints(hp,()=>({...ctx(),well:S.well?.name,active:S.wb?.name}),render);
  // survey
  const calc = S.traj?.calc || [];
  $('onSvNote').textContent = S.traj ? S.traj.name + ' · ' + calc.length + ' stations' : S.trajUid === '' ? 'no trajectory in this wellbore' : '';
  $('onSv').innerHTML = calc.slice(-6).reverse().map(s => `<tr><td>${fmt(s.md, 2)}</td><td>${fmt(s.inc, 2)}</td><td>${fmt(s.azi, 2)}</td><td>${fmt(s.tvd ?? s.tvdc, 2)}</td><td>${fmt(s.dls, 2)}</td><td>${C.aest(Date.parse(s.t)).replace(' AEST', '')}</td></tr>`).join('');
  const plp = currentPlan()?.path; survPlot($('onPlan'), calc, 'plan', plp); survPlot($('onSect'), calc, 'section', plp);
  const pj = calc.length ? C.projectToBit(calc, S.bitMd, S.holeMd) : null;
  const nb = S.fe?.rows?.length ? (() => { const i = S.fe.ml.indexOf('NBINC'); for (let k = S.fe.rows.length - 1; k >= 0 && i > 0; k--) { const v = C.num(S.fe.rows[k][i]); if (v != null) return {md: S.fe.rows[k][0], v}; } return null; })() : null;
  $('onProj').textContent = pj ? 'At bit ' + fmt(pj.md, 1) + ' m (projected ' + fmt(pj.dmd, 1) + ' m from the last survey): inc ' + fmt(pj.inc, 1) + '°, azi ' + fmt(pj.azi, 1) + '°, TVD ' + fmt(pj.tvd, 1) + ' m' + (nb ? ' · near-bit inc reported ' + fmt(nb.v, 1) + '° at ' + fmt(nb.md, 1) + ' m' : '') : '';
  // footer + settings
  const missing = TILES.filter(([k]) => !S.map[k]).map(([, n]) => n);
  $('onFoot').textContent = L ? 'Read-only WITSML · ' + (S.well?.name || '') + ' / ' + (S.wb?.name || '') + ' / ' + L.name + ' · ' + rows.length.toLocaleString('en-AU') + ' rows in view' +
    (missing.length ? ' · not reported by source: ' + missing.join(', ') : '') + (S.timeLog && S.timeLog !== L ? ' · time log "' + S.timeLog.name + '" ' + (S.timeLog.growing ? 'growing' : 'stopped at ' + C.aestDay(Date.parse(S.timeLog.end))) : '') : '';
  performanceView?.refresh();VW.draw(); renderSettings();
}
function renderSettings() {
  if (!$('onSettings').hidden) {
    $('onSelWb').innerHTML = '<option value="">Automatic (active wellbore)</option>' + S.wellbores.map(b => `<option value="${b.uid}" ${S.override.wb === b.uid ? 'selected' : ''}>${b.name}</option>`).join('');
    const logs = S.wb ? S.headers[S.wb.uid] || [] : [];
    $('onSelLog').innerHTML = '<option value="">Automatic (most drilling channels, freshest)</option>' + logs.map(l => `<option value="${l.uid}" ${S.override.log === l.uid ? 'selected' : ''}>${l.name} · ${l.indexType}${l.growing ? '' : ' · stopped'}</option>`).join('');
    $('onDiag').innerHTML = `<p>Store ${W.cfg.url}<br>Proxy ${W.cfg.proxy}<br>Calls ${W.state.calls} · errors ${W.state.errors}${W.state.lastError ? ' · last: ' + W.state.lastError.replace(/</g, '&lt;') : ''}<br>Last call ${C.aest(W.state.lastCallAt)}</p>
      <p>Channel map: ${Object.values(S.map).map(c => c.label + ' ← ' + c.mn + ' (' + c.unit + ')').join(', ') || '—'}</p><p>Reads: data every 20 s, headers 60 s, survey 2 min, wellbores 10 min. One call at a time.</p>`;
  }
}
export function start() { build(); render(); if (W.hasCred()) loop(); }
start();
setInterval(() => { if (built) render(); }, 5000);

// Per-joint report surveys (geosteering reports → ./data/per-joint-surveys.json). Loaded once the wellbore is known, then every 10 min.
if (PAGE !== 'wellplan') {
  const jl = () => { if (!S.wb) return setTimeout(jl, 5000); const receiptContext = surveyContext(); JS.load({well: receiptContext.well || DEF_WELL, wellbore: receiptContext.wellbore, onChange: () => { if (receiptContext.scope !== surveyContext().scope) return; surveyAlerts?.observe({...receiptContext, source: 'reports', stations: JS.state().status === 'pending' ? [] : reportSurveyStations(JS.state().rep)}); try { render(); } catch {} }}); };
  setTimeout(jl, 3000); setInterval(jl, 10 * 60 * 1000);
}
// dr101l-plan-1115: well-folder plans (RevC0 package) for model vs plan when no other plan is loaded.
WPL.load().then(() => { try { if (built) render(); } catch {} });
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key==='opsnow-measured-uploads:v1'){try{render();}catch{}}});
setInterval(()=>{if(built&&S.wb&&!document.hidden){try{render();}catch{}}},30000);
