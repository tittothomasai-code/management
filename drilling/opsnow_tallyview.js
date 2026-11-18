// opsnow_tallyview.js: Tally tab on joints.html. Auto-populated per branch from connection
// depth steps (labelled derived). Multiple runs, editable cells, CSV/XLSX import, persisted locally.
import * as C from './opsnow_core.js?v=re1115';
import * as J from './opsnow_joints.js?v=re1115';
import * as T from './opsnow_tallyboard.js?v=re1115';
import * as RS from './opsnow_runsheet.js?v=re1115';
import * as XE from './opsnow_export.js?v=re1115';
import * as JS from './opsnow_jsurvey.js?v=re1115';
import * as MVP from './opsnow_mvp.js?v=re1115';
import {applyPipeChecks} from './opsnow_joint_metrics.mjs?v=tally1118';
import {referenceScope,loadMeasuredReference,inventoryRows,inventoryPosition,compareDerivedTally,renderTallyComparison} from './opsnow_tally_compare.mjs?v=opsref1118';
import {renderHardpoints} from './opsnow_hardpoints.mjs?v=hardpoint1118';
import {renderMeasuredUpload} from './opsnow_measured_upload.mjs?v=hardpoint1118';
import {reportedOperation,drillingReferenceMd,renderOperationReport} from './opsnow_operation_report.mjs?v=eow1118';
export const NOMINAL_M = 13; // project rule: drill pipe joints are 13 m (nominal until a connection or tally measures them)
const $ = id => document.getElementById(id);
const fin = Number.isFinite;
const fmt = (v, d = 2) => fin(v) ? v.toLocaleString('en-AU', {minimumFractionDigits: d, maximumFractionDigits: d}) : '';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
let X = () => ({}), xlsxRows = null, feeding = false, winFnOpt = null;
const V = {branch: '', toast: '', warning: ''};
const loadSaved = (well, branch) => { try { return JSON.parse(localStorage.getItem(T.storeKey(well, branch)) || 'null'); } catch { return null; } };
const writeSaved = (well, branch, runs, manual) => { try { localStorage.setItem(T.storeKey(well, branch), JSON.stringify(T.persistShape(runs, manual))); } catch {} };
export function init(getCtx, opts = {}) {
  X = getCtx; xlsxRows = opts.xlsxRows; winFnOpt = opts.windowFn || null;
  const body = document.createElement('div'); body.id = 'vw_jttally'; body.className = 'tb';
  body.innerHTML = `<div class="tb-bar">
      <label>Branch <select id="tbBranch"></select></label>
      <span id="tbRec" class="tb-rec"></span>
      <span class="vw-sp"></span>
      <label class="jt-tally" id="tbImpL"><input id="tbImp" type="file" accept=".csv,.txt,.tsv,.xlsx" hidden><span id="tbImpT">Upload measured tally</span></label>
      <button type="button" id="tbAddRun">Add run</button>
      <button type="button" id="tbCsv">Export CSV</button>
      <button type="button" id="tbXlsx">Export XLSX</button>
    </div>
    <p id="tbWarn" class="tb-warn" hidden></p>
    <section id="tbUpload" hidden></section>
    <p id="tbNote" class="on-muted tb-note"></p>
    <div id="tbHead" class="tb-head"></div>
    <section id="tbOperationReport" hidden aria-label="Reported well operation"></section>
    <section id="tbCompare" hidden></section>
    <section id="tbHardpoints" hidden></section>
    <div id="tbRuns"></div>`;
  (opts.host || document.body).appendChild(body);
  $('tbBranch').onchange = e => { V.branch = e.target.value; draw(); };
  $('tbAddRun').onclick = () => mutate(runs => T.addRun(runs, runs.at(-1)?.id, {startMd: X().holeMd, firstN: lastN(runs) + 1}), true);
  const upload=renderMeasuredUpload($('tbUpload'),()=>X(),xlsxRows,()=>X().refresh?.(),C.parseCsv);
  $('tbImp').onchange = e => { const f = e.target.files?.[0]; if (f) upload.read(f); e.target.value = ''; };
  $('tbCsv').onclick = () => { const {runs, rec} = board(); XE.download(fileBase() + '-tally.csv', XE.csvBlob(tallyCsv(runs, rec))); };
  $('tbXlsx').onclick = () => { const {runs, rec} = board(); XE.download(fileBase() + '-tally.xlsx', XE.xlsxBlob(tallyRows(runs, rec), 'Tally')); };
}
export function importTally(t, name) { if (!t?.joints?.length) return; mutate(runs => runs.map((r, i) => i === 0 ? T.applyTallyImport(r, t) : r), true); V.toast = 'Real tally ' + (name || '') + ' applied over the auto-generated lengths'; }
function fileBase() { const x = X(); return (x.well || 'well') + '-' + (V.branch || x.active || 'branch'); }
function lastN(runs) { return runs.flatMap(r => r.joints).at(-1)?.n || 0; }
function wellName() { return X().well || 'DR101L'; }
function branchName() { return V.branch || X().active || ''; }
function branchOperation(){return reportedOperation(wellName(),branchName());}
function measuredReference(){const x=X();return branchName()===x.active&&x.measuredReference?x.measuredReference:referenceScope(x.well,branchName())?V.measuredReference:null;}
function referenceAt(md){const r=measuredReference();return r?.checkpoint&&md<r.checkpoint.md?r.uncorrectedReference:r;}
function drawComparison(x){
 const host=$('tbCompare');if(!host)return;
 if(!referenceScope(x.well,branchName())&&!measuredReference()){host.hidden=true;host.replaceChildren();return;}
 host.hidden=false;
 if(!measuredReference()){
  host.textContent=V.referenceFailed?'Measured inventory could not be loaded. Derived readings remain separate.':'Loading measured inventory…';
  if(!V.referenceRequested){V.referenceRequested=true;loadMeasuredReference(x.well,branchName()).then(ref=>{if(!compareDerivedTally([],ref).inventory.length)throw Error('invalid reference');V.measuredReference=ref;draw();}).catch(()=>{V.referenceFailed=true;draw();});}
  return;
 }
 const ref=measuredReference(),active=branchName()===x.active,result=compareDerivedTally(active?(x.pipeChecks||[]):[],ref);
 renderTallyComparison(document,host,result,ref,active?x:{bitMd:null,holeMd:null});
}
function sourceTally(x) {
  const t = x.tally; if (!t?.joints?.length) return null;
  if (/^tally board/i.test(x.tallyName || t.source || '')) return null;
  return t;
}
function firstNOf(conns, holeMd, x) {
  if (!conns?.length) return 1;
  const measured=!sourceTally(x)&&inventoryRows(referenceAt(conns[0].md)).find(j=>Math.abs(j.startMd-conns[0].md)<=.3);
  if(measured)return measured.n;
  const med = C.joints(conns, holeMd).median;
  const nums = J.numbering(conns, med, sourceTally(x));
  return nums[0]?.n ?? 1;
}
function applyCanonicalNumbers(runs, conns, holeMd, x) {
  if (!conns?.length || !runs?.length) return runs;
  const numbered = J.numbering(conns, C.joints(conns, holeMd).median, sourceTally(x));
  const nums=numbered.map((n,i)=>{const measured=sourceTally(x)?[]:inventoryRows(referenceAt(conns[i].md)),j=measured.find(j=>Math.abs(j.startMd-conns[i].md)<=.3);return j?{n:j.n,kind:'measured reference'}:n;});
  let k = 0;
  for (const r of runs) {
    if (k < nums.length) r.firstN = nums[k].n;
    for (const j of r.joints) {
      const saved = j.overridden && j.source === 'edit' && j.n != null;
      if (!saved && k < nums.length) j.n = nums[k].n;
      k++;
    }
  }
  return runs;
}
export function board() {
  const x = X(), branch = branchName(), well = wellName();
  const saved = loadSaved(well, branch);
  const isActive = !branch || branch === x.active;
  const conns = isActive ? (x.conns || []) : [];
  const holeMd = isActive ? x.holeMd : null;
  const act = !branchOperation() && isActive && x.tl?.rows?.length ? J.timeActivity(x.tl.rows, x.tl.map) : null;
  const firstN = firstNOf(conns, holeMd, x);
  let runs = T.buildBoard(conns, holeMd, {saved, timeAct: act, depthRows: isActive ? x.data?.rows : null, firstN, bha: T.savedRuns(saved)[0]?.bha, startMd: conns[0]?.md});
  const measured=measuredReference();
  // The recorded run's BHA is a starting assembly reference, never another MD offset.
  // Preserve any operator-entered BHA and do not assign it to earlier parent-hole runs.
  if(measured&&!saved?.manual&&runs[0]?.startMd>=measured.startMd-.3&&!runs[0].bha?.length)runs[0]={...runs[0],bha:[{desc:'BHA at run start',len:measured.bhaLen}],bhaLen:measured.bhaLen};
  runs = applyCanonicalNumbers(runs, conns, holeMd, x);
  runs = applyPipeChecks(runs,isActive?(x.pipeChecks||[]):[]);
  const savedFirst = T.savedRuns(saved)[0]?.firstN;
  if (savedFirst && firstN === savedFirst + 1) writeSaved(well, branch, runs, saved && !Array.isArray(saved) && saved.manual);
  const rec = isActive ? T.reconcile(runs.at(-1) || T.derivedRun([], holeMd), holeMd, 1) : {flag: false, text: 'Hole MD is for the active wellbore only. This branch has no live hole MD in this view.'};
  if (!T.savedRuns(saved).length && runs.length) writeSaved(well, branch, runs, false);
  return {runs, rec, conns, holeMd, isActive, well, branch, saved};
}
function feed(runs) {
  V.feedNote='';
  if(branchName()&&X().active&&branchName()!==X().active){V.feedNote='Edits saved for this branch. The active wellbore tally is unchanged.';return;}
  // Save edits on the board, but never promote an unverified MD interval to a
  // physical pipe length in the shared tally used by the live joint tracker.
  if(runs.some(r=>r.joints.some(j=>!j.current&&!j.overridden&&!fin(j.pipeCheck?.estimatedLength)))){
    V.feedNote='Edits saved. Resolve the pipe-length checks or enter measured lengths before updating the shared tally.';return;
  }
  // the joint still drilling has no measured length yet: never feed its partial length as a tally length (it would read "2.9 m of 1.7 m")
  const t = T.toTallyAll(runs.map(r => ({...r, joints: (r.joints || []).filter(j => !j.current || j.overridden)})));
  if (!t.joints.length) return;
  feeding = true;
  X().setTally?.(t, 'tally board · ' + (branchName() || 'active'));
  feeding = false;
}
function mutate(fn, manual) {
  const {runs, well, branch, saved} = board();
  const next = fn(runs);
  const wasManual = saved && !Array.isArray(saved) && saved.manual;
  writeSaved(well, branch, next, manual || wasManual);
  feed(next);
  draw();
}
async function importFile(f) {
  const x = X();
  try {
    let rows, text;
    if (/\.xlsx$/i.test(f.name)) rows = await xlsxRows(await f.arrayBuffer());
    else { text = await f.text(); rows = C.parseCsv(text); }
    // run-sheet text? try if it looks like a slide sheet
    let sheet = null;
    if (text && /Bit to DS|Tally length|Slide\s+/i.test(text)) sheet = RS.parseRunSheetText(text);
    else if (rows?.length) {
      const maybe = RS.parseRunSheetRows(rows);
      if (maybe?.joints?.length) sheet = maybe;
    }
    if (sheet?.joints?.length) {
      const m = RS.wellMatches(sheet, x.well, x.active);
      if (!m.ok) { V.warning = 'This sheet was not applied as the live tally: ' + m.reason + '. Review it on the Run sheet tab; do not treat another well\'s numbers as this well.'; draw(); return; }
      const tally = RS.toTally(sheet);
      if (sheet.header && (sheet.header.bitToDs || sheet.header.bitToGs || sheet.header.bhaLen)) x.setOffsets?.(tally.offsets, 'run sheet ' + f.name);
      mutate(runs => runs.map((r, i) => i === 0 ? T.applyTallyImport(r, tally) : r), true);
      V.warning = ''; V.toast = 'Imported ' + tally.joints.length + ' joints from ' + f.name;
      return;
    }
    const t = C.parseTally(rows);
    if (t.error) throw new Error(t.error);
    mutate(runs => runs.map((r, i) => i === 0 ? T.applyTallyImport(r, t) : r), true);
    V.warning = ''; V.toast = 'Imported ' + t.joints.length + ' joints from ' + f.name + ' (overrides derived lengths)';
  } catch (e) { V.warning = f.name + ': ' + e.message; draw(); }
}
function tallyRows(runs, rec) {
  const x = X(), ctx = rowCtx(), head = ['Run', 'Jt#', 'Length m', 'Length source', 'Cumulative length m', 'MD top m', 'MD bottom m', 'Bit MD m', 'Bit MD kind', 'Hole MD m', 'In hole (bit depth)',
    'Survey MD m', 'Survey Inc °', 'Survey Azi °', 'Survey TVD m', 'Survey source', ...MVP.COLS, 'BHA on top m', 'Running total vs hole MD m'];
  const rows = [head], r2 = v => fin(v) ? +v.toFixed(2) : (v ?? '');
  for (const r of runs) {
    for (const j of r.joints) { const c = rowCalc(j, r, ctx);
      rows.push([r.name, fin(j.n) ? Math.round(j.n) : j.n, r2(j.len), c.lenSrc, r2(j.cum), r2(c.top), r2(c.bottom), j.current ? r2(ctx.bitMd) : '', j.current ? (fin(ctx.bitMd) ? ctx.bitKind : 'not reported (' + (ctx.bitKind || 'missing') + ')') : '', r2(ctx.holeMd), c.inHole,
        r2(c.sv.md), r2(c.sv.inc), r2(c.sv.azi), r2(c.sv.tvd), c.sv.label, ...MVP.cols(c.mvp, ctx.plan), r2(r.bhaLen), r2(rec?.runTotal)]); }
  }
  if(branchOperation())rows.push([],['Reported operation', 'TD 2618.90 m MD; liner running reported 18 Nov 2026 AEST. Historical drilling tally; liner depth, liner count and exact TD time not supplied.']);
  rows.push([], ['Notes', 'Length source: derived BHE = completed stroke cross-checked against MD; review = unverified MD interval; measured tally = imported; estimated = drilling or nominal ' + NOMINAL_M + ' m; edited = typed on this device.'],
    ['', 'Survey: geosteering-report value interpolated by minimum curvature (' + (x.reportSurveys?.note || 'pending') + '), else a WITSML station inside the joint, else no survey. Never carried down.'],
    ['', MVP.planNote(ctx.plan)], ['', 'Bit MD is never shown deeper than hole MD.']);
  if (rec) rows.push(['Reconcile', rec.text]);
  if(x.hardpoints?.scope){rows.push([],['Measured hardpoint history · AEST / UTC timestamps retained'],['Action','Joint','Measured MD m','BHA m','Measured at UTC','Recorded at UTC','Operator','Measured source','Event ID']);x.hardpoints.events.filter(e=>JSON.stringify(e.scope)===JSON.stringify(x.hardpoints.scope)).forEach(e=>rows.push([e.action,e.joint??'',e.md??'',e.bhaLen??'',e.effectiveAt||'',e.recordedAt,e.operator,e.source,e.id]));}
  const measured=measuredReference();if(measured){const c=compareDerivedTally(branchName()===x.active?(x.pipeChecks||[]):[],measured);
    if(c.referenceIssues.length)rows.push(['Measured reference inconsistencies',c.referenceIssues.join('; ')]);
    rows.push([],['Independent derived vs measured tally'],['BHA m',c.bhaLen,'Carried string reference m',c.carriedReference,'Starting MD m (BHA already included)',c.startMd],['Measured entries','Start MD m','End MD m','Derived BHE length m','Measured length m','Difference m','Derived end MD m','Measured end MD m','Cumulative difference m','Result']);
    c.rows.forEach(r=>rows.push([r.entries,r.startMd,r.endMd,r.derivedLength??'',r.measuredLength??'',r.difference??'',r.derivedEndMd??'',r.measuredEndMd??'',r.cumulativeDifference??'',r.status]));
  }
  return rows;
}
// ---------- per-row derived values (shared by screen and export) ----------
function rowCtx() {
  const x = X(), branch = branchName(), isActive = !branch || branch === x.active;
  const path = isActive ? x.branches?.find(b => b.name === x.active)?.path : x.branches?.find(b => b.name === branch)?.path;
  const svs = isActive ? (x.surveys || []) : [];
  const holeMd = isActive ? x.holeMd : null, bitOk = !branchOperation()&&(x.bitKind === 'reported' || x.bitKind === 'derived'), bitMd = isActive && bitOk && fin(x.bitMd) ? (fin(holeMd) ? Math.min(x.bitMd, holeMd) : x.bitMd) : null; // A liner/tool position cannot establish the historical drilling string's in-hole count.
  return {x, isActive, path, svs, holeMd, bitMd, bitKind: branchOperation()?'historical drilling string':x.bitKind || '', plan: MVP.planOf(x), rep: isActive ? x.reportSurveys?.rep : null, winAt: (() => { try { return winFnOpt?.() || null; } catch { return null; } })()};
}
function lenSource(j) {
  if (j.overridden) return j.source === 'tally' ? 'measured · tally' : /nominal/.test(j.source || '') ? 'estimated · nominal ' + NOMINAL_M + ' m' : 'edited';
  const live=X(),operation=branchOperation(),at=inventoryPosition(measuredReference(),drillingReferenceMd(operation,live.bitMd,live.holeMd)),target=j.current&&(at?.n===j.n?at:inventoryRows(referenceAt(j.start)).find(m=>Math.abs(m.startMd-j.start)<=.3));
  if(operation&&j.current)return 'historical final interval · '+(target?'inventory pipe '+fmt(target.len,2)+' m; full length not derived':'pipe length unverified');
  if(target)return 'partial depth advance · measured target '+fmt(target.len,2)+' m';
  return j.current ? 'estimated · drilling (nominal ' + NOMINAL_M + ' m)' : fin(j.pipeCheck?.estimatedLength)?'derived · BHE / MD cross-check':'review · MD interval; '+(j.pipeCheck?.issues.join('; ')||'complete BHE stroke unavailable');
}
function rowCalc(j, r, c) {
  const bottom = fin(j.hd) ? j.hd : null, top = fin(j.start) ? j.start : fin(bottom) && fin(j.len) ? bottom - j.len : null;
  const lo = top, hi = j.current ? c.holeMd : bottom;
  const inJ = fin(lo) && fin(hi) ? c.svs.filter(s => s.md >= lo - 1e-6 && s.md < hi + (j.current ? 1e-6 : 0)) : [];
  const sv = JS.resolve({start: lo, end: j.current ? null : hi, length: fin(hi) && fin(lo) ? hi - lo : null, survey: inJ.at(-1) || null}, c.rep, c.holeMd);
  const mPath = c.path?.length ? c.path : MVP.tiePath(c.svs);
  const cmpMd = fin(hi) ? hi : top, m = MVP.modelAt(cmpMd, mPath, sv);
  const mvp = MVP.compare(m?.md ?? cmpMd, m, c.plan, m && fin(m.n) ? MVP.seamOf(c.winAt, m) : null);
  const inHole = !fin(bottom)||!fin(c.bitMd)?'unconfirmed':bottom<=c.bitMd+.05?(c.bitKind==='derived'?'yes (derived)':'yes'):'not fully in hole at reported bit depth';
  return {top, bottom, sv, mvp, inHole, lenSrc: lenSource(j)};
}
function tallyCsv(runs, rec) { return tallyRows(runs, rec).map(r => r.map(v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n'); }
export function draw() {
  if (feeding) return;
  if(V.drawing){V.redraw=true;return;}V.drawing=true;
  try {
  const x = X(), {runs, rec, conns, holeMd, isActive, branch} = board();
  const names = [...new Set([x.active, ...(x.branches || []).map(b => b.name)].filter(Boolean))];
  if (!V.branch && x.active) V.branch = x.active;
  const operation=branchOperation();renderOperationReport($('tbOperationReport'),operation,isActive?x.holeMd:null);
  $('tbBranch').innerHTML = names.map(n => `<option value="${esc(n)}"${n === (V.branch || x.active) ? ' selected' : ''}>${esc(n)}</option>`).join('') || '<option>—</option>';
  const recEl = $('tbRec'),reference=measuredReference(),comparison=reference?compareDerivedTally(isActive?(x.pipeChecks||[]):[],reference):null;
  recEl.textContent=comparison?(comparison.referenceIssues.length?'CHECK · '+comparison.referenceIssues.length+' measured-reference inconsistencies':comparison.review?'CHECK · '+comparison.review+' BHE/tally cycles need review':comparison.rows.length?comparison.matched+' completed cycles match · '+(comparison.fullStart?'current interval remains separate':'partial coverage; earlier lengths unverified'):'Awaiting independent BHE cycles'):'Arithmetic only · '+rec.text;
  recEl.dataset.flag=comparison?(comparison.referenceIssues.length||comparison.review||!comparison.fullStart?'1':'0'):(rec.flag?'1':'0');
  const w = $('tbWarn'),warning=V.warning||V.feedNote; w.hidden = !warning; w.textContent = warning || '';
  $('tbNote').textContent = isActive
    ? (conns.length ? (runs.length + ' run' + (runs.length === 1 ? '' : 's') + ' · ' + runs.reduce((a, r) => a + r.joints.length, 0) + ' joints from connection depth steps, labelled derived until edited or imported. Every cell is editable. Edits stay on this device for ' + wellName() + ' / ' + (branch || x.active) + ' and feed the joint tracker and the run sheet.')
      : 'No connections in feed for this wellbore. Import a tally or add a run and enter joints by hand. Nothing is invented from surveys.')
    : 'No connections in feed for this branch (only the active wellbore\'s depth log is read). Import a tally or enter joints by hand. Nothing is invented from surveys.';
  if(operation)$('tbNote').textContent='Drilling ended at reported TD 2,618.90 m MD. Available history is retained; its coverage may be partial. The final interval is not ongoing drilling or a measured full pipe. Liner movements and liner counts are not inferred from this drilling tally. BHA and measured drilling references are retained.';
  { const c = rowCtx(); $('tbHead').innerHTML = (c.isActive && fin(c.holeMd) ? `<span>Hole MD <b>${fmt(c.holeMd, 1)} m</b></span><span>Bit MD <b>${fin(c.bitMd) ? fmt(c.bitMd, 1) + ' m' : 'not reported'}</b>${fin(c.bitMd) && c.bitKind !== 'reported' ? ' (' + esc(c.bitKind) + ')' : !fin(c.bitMd) && c.bitKind ? ' (source ' + esc(c.bitKind) + ')' : ''} · never deeper than hole</span>` : '<span>No live hole MD for this branch</span>')
    + `<span>${measuredReference()?'Measured inventory lengths loaded':'Nominal joint '+NOMINAL_M+' m'} · MD connection-spacing median ${fin(c.x.conns?.length > 2 ? C.joints(c.x.conns, c.holeMd).median : null) ? fmt(C.joints(c.x.conns, c.holeMd).median, 2) + ' m' : '—'}</span><span>${esc(c.x.reportSurveys?.note || '')}</span><span>${esc(MVP.planNote(c.plan))}</span>`; }
  if(operation&&isActive&&fin(x.holeMd))$('tbHead').children[1].textContent='Historical drilling string · current tool position cannot establish its in-hole count.';
  $('tbRuns').innerHTML = runs.map((r, ri) => runHtml(r, ri, runs, rec, holeMd)).join('') || '<p class="on-muted">No runs yet.</p>';
  wireRuns(runs);
  drawComparison(x);
  $('tbImp').disabled=branchName()!==x.active;
  renderMeasuredUpload($('tbUpload'),()=>X(),xlsxRows,()=>X().refresh?.(),C.parseCsv);
  renderHardpoints($('tbHardpoints'),()=>branchName()===X().active?X():{hardpoints:null},()=>X().refresh?.());
  if($('vwTallyOut'))$('vwTallyOut').hidden=!!measuredReference();
  } finally {V.drawing=false;if(V.redraw){V.redraw=false;queueMicrotask(draw);}}
}
function runHtml(r, ri, runs, rec, holeMd) {
  const bha = r.bhaLen || 0, c = rowCtx();
  const th = '<th>Jt#</th><th>Length m</th><th>Length source</th><th>Cumulative from run start m</th><th>MD top m</th><th>MD bottom m</th><th>Bit / hole MD m</th><th>Survey<br><small>inc / azi / TVD · source</small></th>'
    + '<th class="mvp">Inc °<br><small>MODEL · PLAN · Δ</small></th><th class="mvp">Azi °<br><small>MODEL · PLAN · Δ</small></th><th class="mvp">TVD m<br><small>MODEL · PLAN · Δ</small></th><th class="mvp">VS m<br><small>MODEL · PLAN · Δ</small></th><th>C-C to<br>plan m</th><th>BHA on top m</th><th></th>';
  return `<section class="tb-run" data-id="${esc(r.id)}">
    <div class="tb-runh"><input class="tb-name" data-k="name" value="${esc(r.name)}"><span class="on-muted">${esc(r.source || '')}${fin(r.startMd) ? ' · start ' + fmt(r.startMd, 2) + ' m MD' : ''}</span>
      <label>BHA on top <input class="tb-bha" data-k="bha" inputmode="decimal" value="${bha ? fmt(bha, 2) : ''}"> m</label>
      <span class="vw-sp"></span>
      ${ri > 0 ? '<button type="button" data-act="merge">Merge with previous</button>' : ''}
      <button type="button" data-act="addj" title="Adds a ${NOMINAL_M} m nominal joint (estimated until measured)">Add joint</button>
    </div>
    <div class="ac-tw"><table class="on-table tb-tab"><thead><tr>${th}</tr></thead>
      <tbody>${(r.joints || []).slice().reverse().map(j => {
        const q = rowCalc(j, r, c), over = j.overridden ? ' tb-over' : '', sv = q.sv;
        const bh = j.current && fin(c.holeMd) ? (fin(c.bitMd) ? 'bit ' + fmt(c.bitMd, 1) + (c.bitKind && c.bitKind !== 'reported' ? ' (' + esc(c.bitKind) + ')' : '') + ' ≤ hole ' + fmt(c.holeMd, 1) : 'bit not reported · hole ' + fmt(c.holeMd, 1)) : q.inHole === 'yes' ? '<small class="on-muted">in hole</small>' : esc(q.inHole || '—');
        const svT = sv.src === 'none' ? '<small class="on-muted">no survey</small>' : fmt(sv.inc, 1) + ' / ' + fmt(sv.azi, 1) + ' / ' + (fin(sv.tvd) ? fmt(sv.tvd, 1) : '—') + ' <small class="tb-src">' + (sv.src === 'report' ? 'report' : 'WITSML') + '</small>';
        return `<tr data-n="${j.n}" class="${j.current ? 'jt-cur' : ''}${j.overridden ? ' tb-overrow' : ''}">
          <td class="${over}"><input data-f="n" value="${fin(j.n) ? Math.round(j.n) : (j.n ?? '')}" inputmode="numeric" aria-label="Joint number"></td>
          <td class="${over}"><input data-f="len" value="${fmt(j.len, 2)}" inputmode="decimal" aria-label="Length m"></td>
          <td><span class="tb-src">${esc(q.lenSrc)}</span></td>
          <td class="${over}"><input data-f="cum" value="${fmt(j.cum, 2)}" inputmode="decimal" aria-label="Cumulative length m"></td>
          <td>${fmt(q.top, 2)}</td>
          <td class="${over}"><input data-f="hd" value="${fmt(j.hd, 2)}" inputmode="decimal" aria-label="MD bottom m"></td>
          <td>${bh}</td><td>${svT}</td>
          <td class="mvp">${MVP.cellHtml(q.mvp, 'inc', 1)}</td><td class="mvp">${MVP.cellHtml(q.mvp, 'azi', 1)}</td><td class="mvp">${MVP.cellHtml(q.mvp, 'tvd', 1)}</td><td class="mvp">${MVP.cellHtml(q.mvp, 'vs', 1)}</td><td>${MVP.ccHtml(q.mvp)}</td>
          <td><input data-f="bha" value="${fmt(bha, 2)}" inputmode="decimal" title="BHA length on top of this run"></td>
          <td>${j.n && r.joints[0]?.n !== j.n ? `<button type="button" data-act="split" data-n="${j.n}">Split here</button>` : ''}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="15" class="on-muted">No joints in this run.</td></tr>'}</tbody></table></div>
    ${ri === runs.length - 1 ? `<p class="tb-foot ${rec.flag ? 'tb-mismatch' : ''}">Arithmetic only · ${esc(rec.text)}</p>` : ''}
  </section>`;
}
function wireRuns(runs) {
  $('tbRuns').querySelectorAll('.tb-run').forEach(sec => {
    const id = sec.dataset.id;
    const name = sec.querySelector('.tb-name');
    name.onchange = () => mutate(rs => rs.map(r => r.id === id ? {...r, name: name.value.trim() || r.name} : r), true);
    sec.querySelector('.tb-bha').onchange = e => {
      const v = Number(String(e.target.value).replace(',', '.'));
      mutate(rs => rs.map(r => r.id === id ? {...r, bha: fin(v) ? [{desc: 'BHA', len: v}] : [], bhaLen: fin(v) ? v : 0} : r), true);
    };
    sec.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'merge') {
        const i = runs.findIndex(r => r.id === id); if (i < 1) return;
        mutate(rs => T.mergeRuns(rs, rs[i - 1].id, id), true);
      }
      if (act === 'split') mutate(rs => T.splitHere(rs, id, +b.dataset.n), true);
      if (act === 'addj') mutate(rs => rs.map(r => r.id === id ? T.addJoint(r, {}) : r), true);
    });
    sec.querySelectorAll('tbody tr[data-n]').forEach(tr => {
      const n = +tr.dataset.n;
      tr.querySelectorAll('input[data-f]').forEach(inp => {
        inp.onchange = () => {
          const f = inp.dataset.f, raw = inp.value.trim(), v = Number(raw.replace(',', '.'));
          if (f === 'bha') {
            const len = fin(v) ? v : 0;
            mutate(rs => rs.map(r => r.id === id ? {...r, bha: len ? [{desc: 'BHA', len}] : [], bhaLen: len} : r), true);
            return;
          }
          const edit = {};
          if (f === 'n' && fin(v)) edit.n = v;
          if (f === 'len' && fin(v)) edit.len = v;
          if (f === 'hd' && fin(v)) edit.hd = v;
          if (f === 'cum' && fin(v)) edit.hd = v; // cumulative length edited: treat as HD when start is 0-based? better: keep cum as running length, recompute hd from startMd + cum
          mutate(rs => rs.map(r => {
            if (r.id !== id) return r;
            if (f === 'cum' && fin(v) && fin(r.startMd)) edit.hd = r.startMd + v;
            return T.applyOverrides(r, {joints: {[n]: edit}});
          }), true);
        };
      });
    });
  });
}
