// wwell.js v5.12.20: SHARED whole-well WITSML 1.4.1.1 model. One module for ?wdash AND the simulator (WITSML panel, Monitor a well,
// live rig/well views, 3D trajectory). Discovers EVERY object in a well (all wellbores -> all time + depth logs incl. FE / mud / survey logs,
// trajectories, mudLogs), reads data, selects the live / real-time branch by default, and builds Depth and Time views (channels mapped through
// bit-depth / hole-depth). Transport is injected (call(op,wmlType,query,options) -> {xml}); credentials never pass through this module.
import * as K from './wdash_core.js?v=fp-ops-r2-20261108';
import { redactedRanges } from './witsml-redaction-slots.mjs?v=wred1-20261109';
export const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const xa=s=>String(s??'').replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
export const ids=(x,t)=>[...String(x).matchAll(new RegExp('<(?:\\w+:)?'+t+'\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?'+t+'>)','g'))].map(m=>({uid:(m[1].match(/\buid="([^"]*)"/)||[])[1],name:(((m[2]||'').match(/<(?:\w+:)?name>([^<]*)</)||[])[1]||'').trim()})).filter(w=>w.uid);
export const WIN={time:12*3600e3,depth:500};// first read per log: last 12 h (time) / last 500 m (depth)
export function rangeQ(s){const last=s.rows.at(-1)?.[0];if(s.time){const st=last?last+1:(Date.parse(s.end||'')?Date.parse(s.end)-WIN.time:0);return st?`<startDateTimeIndex>${new Date(st).toISOString()}</startDateTimeIndex>`:''}
 const u=s.uom||'m';const e=parseFloat(s.end);return last!=null?`<startIndex uom="${u}">${last}</startIndex>`:Number.isFinite(e)?`<startIndex uom="${u}">${Math.max(0,e-WIN.depth)}</startIndex>`:''}
const X=j=>typeof j=='string'?j:(j?.xml||'');
const GUARDED_REASONS = new Set(['credential-reflection','format-character','credential-reflection-and-format-character','parser-format']);
const IDENTITY_ROLES = new Set(['well-uid','wellbore-identity']);
export function guardRefusal(reply) {
  if (reply?.code === 'proxy-refusal' || reply?.error === 'proxy refusal') return Object.assign(new Error('refused by proxy'),{guardRefusal:true,proxyRefusal:true});
  if (!GUARDED_REASONS.has(reply?.reason) && reply?.error !== 'upstream response refused') return null;
  return Object.assign(new Error('refused by proxy'),{guardRefusal:true,proxyRefusal:true});
}
const mustStop = e => e.auth || e.guardRefusal || e.proxyRefusal || e.redactionHold || e.identityStop || e.closed || e.name === 'AbortError';

function localOf(name) {
  const text = String(name || '');
  const colon = text.lastIndexOf(':');
  return colon < 0 ? text : text.slice(colon + 1);
}
function openElements(xml, index) {
  const stack = [];
  let i = 0;
  while (i < index) {
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      if (end < 0 || end >= index) break;
      i = end + 3;
      continue;
    }
    const lt = xml.indexOf('<', i);
    if (lt < 0 || lt >= index) break;
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const end = xml.startsWith('<?', lt) ? xml.indexOf('?>', lt + 2) : xml.indexOf('>', lt + 2);
      if (end < 0) break;
      i = end + (xml.startsWith('<?', lt) ? 2 : 1);
      continue;
    }
    if (xml.startsWith('</', lt)) {
      const gt = xml.indexOf('>', lt);
      if (gt < 0) break;
      stack.pop();
      i = gt + 1;
      continue;
    }
    const gt = xml.indexOf('>', lt);
    if (gt < 0) break;
    const head = xml.slice(lt + 1, gt);
    const name = (head.match(/^([A-Za-z0-9_.:-]+)/) || [])[1] || '';
    if (!/\/\s*$/.test(head) && gt < index) stack.push({ local: localOf(name), start: lt });
    i = gt + 1;
  }
  return stack;
}
function elementEnd(xml, start) {
  const gt = xml.indexOf('>', start);
  if (gt < 0) return null;
  const head = xml.slice(start + 1, gt);
  const name = (head.match(/^([A-Za-z0-9_.:-]+)/) || [])[1];
  if (!name) return null;
  if (/\/\s*$/.test(head)) return gt + 1;
  let depth = 1;
  let i = gt + 1;
  while (i < xml.length && depth > 0) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) return null;
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end < 0) return null;
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const end = xml.startsWith('<?', lt) ? xml.indexOf('?>', lt + 2) : xml.indexOf('>', lt + 2);
      if (end < 0) return null;
      i = end + (xml.startsWith('<?', lt) ? 2 : 1);
      continue;
    }
    const close = xml.startsWith('</', lt);
    const gt2 = xml.indexOf('>', lt);
    if (gt2 < 0) return null;
    const raw = xml.slice(lt + (close ? 2 : 1), gt2).trim().split(/\s/)[0];
    if (raw === name) {
      if (close) {
        depth -= 1;
        if (depth === 0) return gt2 + 1;
      } else if (!/\/\s*$/.test(xml.slice(lt + 1, gt2))) depth += 1;
    }
    i = gt2 + 1;
  }
  return null;
}
function cutFor(xml, range) {
  const stack = openElements(xml, range.start);
  if (range.role === 'log-data') {
    const data = [...stack].reverse().find((item) => item.local === 'data');
    const end = data ? elementEnd(xml, data.start) : 0;
    if (data && end > range.end) return { start: data.start, end, field: 'log-data' };
    return { start: range.start, end: range.end, field: 'log-data' };
  }
  const station = [...stack].reverse().find((item) => item.local === 'trajectoryStation');
  if (station || stack.some((item) => item.local === 'trajectory')) {
    if (station) {
      const end = elementEnd(xml, station.start);
      if (end > range.end) return { start: station.start, end, field: 'trajectory' };
    }
    return { start: range.start, end: range.end, field: 'trajectory' };
  }
  const field = { 'well-name': 'name', 'well-field': 'field', 'well-country': 'country', comment: 'comment', 'attribute-value': 'attribute', 'namespace-uri': 'namespace', text: 'text' }[range.role] || range.role;
  if (range.role === 'comment') {
    const open = xml.lastIndexOf('<!--', range.start);
    const close = xml.indexOf('-->', range.end);
    if (open >= 0 && close >= range.end) return { start: open, end: close + 3, field };
  }
  return { start: range.start, end: range.end, field };
}
// Drop every listed slot. A redacted well uid or wellbore identity imports nothing.
// Other listed nodes are removed, and the field is marked redacted rather than kept as a value.
export function applyRedactedSlots(xml, slots) {
  const ranges = redactedRanges(typeof xml === 'string' ? xml : '', slots);
  if (!ranges) return { hold: true };
  if (ranges.some((range) => IDENTITY_ROLES.has(range.role))) return { stop: true };
  const fields = [];
  const cuts = [];
  for (const range of ranges) {
    const cut = cutFor(xml, range);
    fields.push({ role: range.role, ordinal: range.ordinal, field: cut.field });
    cuts.push(cut);
  }
  cuts.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const cut of cuts) {
    const last = merged[merged.length - 1];
    if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
    else merged.push({ start: cut.start, end: cut.end });
  }
  let out = xml;
  for (let i = merged.length - 1; i >= 0; i--) out = out.slice(0, merged[i].start) + out.slice(merged[i].end);
  return { xml: out, fields };
}
export function prepareReply(reply, status) {
  if (reply?.redactionApplied === true) return { reply };
  if (status === 502) return { transport: true };
  if (status === 422 || reply?.code === 'proxy-refusal' || reply?.error === 'proxy refusal') return { refusal: true };
  if (guardRefusal(reply)) return { refusal: true };
  if (reply?.passwordRedacted !== true) return { reply };
  const slots = Array.isArray(reply.redactedSlots) ? reply.redactedSlots : [];
  const xml = typeof reply.xml === 'string' ? reply.xml : '';
  if (reply.redactionScope !== 'slots' || !slots.length) return { redactionHold: true };
  const xmlSlots = slots.filter((slot) => slot !== 'supp/1' && slot !== 'fault/1');
  const fields = [];
  if (slots.includes('supp/1')) fields.push({ role: 'supp', ordinal: 1, field: 'supp' });
  if (slots.includes('fault/1')) fields.push({ role: 'fault', ordinal: 1, field: 'fault' });
  let nextXml = xml;
  if (xmlSlots.length) {
    const applied = applyRedactedSlots(xml, xmlSlots);
    if (applied.hold) return { redactionHold: true };
    if (applied.stop) return { identityStop: true };
    nextXml = applied.xml;
    fields.push(...applied.fields);
  } else if (!redactedRanges(xml, slots)) return { redactionHold: true };
  const cleaned = { ...reply, xml: nextXml, supp: slots.includes('supp/1') ? '' : (reply.supp || ''), redactedFields: fields, redactionApplied: true };
  if (slots.includes('fault/1')) delete cleaned.error;
  return { reply: cleaned };
}
function xmlOf(reply) {
  const decision = prepareReply(reply, reply?.httpStatus);
  if (decision.transport) throw Object.assign(new Error('disconnected'),{transportRefusal:true});
  if (decision.refusal) throw Object.assign(new Error('refused by proxy'),{guardRefusal:true,proxyRefusal:true});
  if (decision.redactionHold) throw Object.assign(new Error('REDACTED - not imported'),{redactionHold:true});
  if (decision.identityStop) throw Object.assign(new Error('Import stopped. Redacted well identity.'),{identityStop:true,closed:true});
  return X(decision.reply);
}
function scopedXml(reply, type, {well, bore, uid}) {
  const xml=xmlOf(reply);
  const rootObjects=new RegExp('<(?:[\\w.-]+:)?'+type+'(?=[\\s/>])([^>]*?)>', 'g');
  for (const [, attributes] of xml.matchAll(rootObjects)) {
    const supplied=new Map([...attributes.matchAll(/(?:^|\s)(uidWell|uidWellbore|uid)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([,k,a,b])=>[k,a??b]));
    for (const [key, expected] of [['uidWell',well],['uidWellbore',bore],['uid',uid]]) {
      const actual=supplied.get(key);
      if (expected && actual && actual!==expected && actual!==xa(expected)) {
        throw Object.assign(new Error('The store returned data outside the requested well, wellbore or object. Import stopped.'),{closed:true});
      }
    }
  }
  return xml;
}
export async function readKnownWell(call, uid) {
  if (!uid) throw new Error('Enter a well UID.');
  const reply = await call('WMLS_GetFromStore','well',
    `<wells ${NS}><well uid="${xa(uid)}"/></wells>`, 'returnElements=id-only;maxReturnNodes=1');
  const rows = ids(xmlOf(reply),'well');
  if (rows.length !== 1 || rows[0].uid !== uid) throw new Error('The store did not return exactly the requested well UID.');
  return {...rows[0],name:rows[0].name || uid};
}

// io from any transport
export function makeIO(call){return {
 listWells:async()=>ids(xmlOf(await call('WMLS_GetFromStore','well',`<wells ${NS}><well uid=""><name/></well></wells>`,'returnElements=id-only')),'well'),
 listWbs:async w=>ids(scopedXml(await call('WMLS_GetFromStore','wellbore',`<wellbores ${NS}><wellbore uidWell="${xa(w)}" uid=""><name/></wellbore></wellbores>`,'returnElements=id-only'),'wellbore',{well:w}),'wellbore'),
 listLogs:async(w,b)=>K.parseLogs(scopedXml(await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${xa(w)}" uidWellbore="${xa(b)}" uid=""/></logs>`,'returnElements=header-only'),'log',{well:w,bore:b})).map(l=>({...l,uidWellbore:l.uidWellbore||b})),
 listTraj:async(w,b)=>K.parseTraj(scopedXml(await call('WMLS_GetFromStore','trajectory',`<trajectorys ${NS}><trajectory uidWell="${xa(w)}" uidWellbore="${xa(b)}" uid=""/></trajectorys>`,'returnElements=all'),'trajectory',{well:w,bore:b})).map(t=>({...t,uidWellbore:t.uidWellbore||b})),
 listMud:async(w,b)=>K.parseMudLogs(scopedXml(await call('WMLS_GetFromStore','mudLog',`<mudLogs ${NS}><mudLog uidWell="${xa(w)}" uidWellbore="${xa(b)}" uid=""/></mudLogs>`,'returnElements=all'),'mudLog',{well:w,bore:b})).map(t=>({...t,uidWellbore:t.uidWellbore||b})),
 readLog:async(w,s)=>{const L=K.parseLogs(scopedXml(await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${xa(w)}" uidWellbore="${xa(s.wb)}" uid="${xa(s.uid)}">${rangeQ(s)}<logData><data/></logData></log></logs>`,'returnElements=data-only;maxReturnNodes=2000'),'log',{well:w,bore:s.wb,uid:s.uid}))[0];
  if(L&&L.rows.length){if(!s.ml||!s.rows.length){s.ml=null;s.rows=[]}K.appendRows(s,L.ml,L.rows,L.ul);return L.rows.length}return 0}}}
async function optional(read, onError) {
  try { return await read(); }
  catch (e) { if (mustStop(e)) throw e; return onError(e); }
}
export function summary(sets,wbs){const L=sets.filter(s=>s.obj=='log');return {wellbores:wbs,logs:L.length,time:L.filter(s=>s.time).length,depth:L.filter(s=>!s.time).length,
 realtime:sets.filter(s=>s.kind=='realtime').length,fe:sets.filter(s=>s.kind=='fe').length,mudlog:sets.filter(s=>s.kind=='mudlog').length,survey:sets.filter(s=>s.kind=='survey').length,
 trajectories:sets.filter(s=>s.obj=='trajectory').length,mudLogs:sets.filter(s=>s.obj=='mudLog').length,withData:sets.filter(s=>s.rows?.length).length,errors:sets.filter(s=>s.err).length}}
export const discText=d=>`${d.wellbores} wellbores · ${d.logs} logs (${d.time} time, ${d.depth} depth; ${d.realtime} real-time, ${d.fe} FE, ${d.mudlog} mud, ${d.survey} survey) · ${d.trajectories} trajectories · ${d.mudLogs} mudLogs · ${d.withData} with data`+(d.errors?` · ${d.errors} unreadable`:'');
// discover EVERY object in the well, read data, pick the live branch. -> {well,wbs,sets,disc,P}
export async function discoverWell(io,well,note=()=>{}){note('Reading wellbores…');const wbs=await io.listWbs(well);if(!wbs.length)throw new Error('Connected, but the store returned no wellbores for well '+well+' (empty result)');const sets=[];
 for(const b of wbs){note('Wellbore '+(b.name||b.uid)+': listing objects…');const lg=await optional(()=>io.listLogs(well,b.uid),()=>[]);
  const tr=await optional(()=>io.listTraj(well,b.uid),()=>[]);
  const ml=await optional(()=>io.listMud(well,b.uid),()=>[]);
  for(const s of [...lg,...tr,...ml]){s.wb=b.uid;s.wbName=b.name||b.uid;s.kind=K.classify(s);s.short=(s.name||s.uid).replace(/\W+/g,'').slice(0,10);if(s.obj=='log'){s.uom='m';s.ml=null;s.rows=[];s.ul=[]}sets.push(s)}}
 note('Reading data from '+sets.filter(s=>s.obj=='log').length+' logs…');for(const s of sets.filter(s=>s.obj=='log')) await optional(()=>io.readLog(well,s),e=>{s.err=e.message});
 const P=K.pickLive(sets.filter(s=>s.rows?.length))||K.pickLive(sets);if(!P)throw new Error('the store returned no logs or trajectories for well '+well+' (empty result)');
 return {well,wbs,sets,disc:summary(sets,wbs.length),P}}
// Depth + Time views for the branch P: every channel of P's wellbore, native or mapped through the first time log with a depth channel
export function buildViews(sets,P){if(!P)return {M:null,dep:{ml:null,rows:[]},tim:{ml:null,rows:[]}};const W=sets.filter(s=>s.wb==P.wb&&s.rows?.length),tl=[P,...W.filter(s=>s.time&&s!==P)].filter(s=>s.time);
 let M=null;for(const s of tl){M=K.depthMap(s);if(M){M.from=s.name||s.uid;break}}return {M,dep:K.combine(W,'depth',M,P),tim:K.combine(W,'time',M,P)}}
// ---- the simulator's shared well model (one per page): GX.wellmodel ----
export const WM={well:'',wbs:[],sets:[],disc:null,P:null,M:null,dep:{ml:null,rows:[]},tim:{ml:null,rows:[]},mode:'time',tag:'SIM',subs:new Set(),io:null,at:0};
const emit=()=>{for(const f of WM.subs)try{f(WM)}catch(e){}};
export function rebuild(){Object.assign(WM,buildViews(WM.sets,WM.P));emit()}
export async function load(io,well,{note,tag='LIVE'}={}){const R=await discoverWell(io,well,note);if([...R.wbs,...R.sets].some(x=>/SIM-TEST|SIMULATED|\bSIM\b/i.test((x.name||'')+' '+(x.nameWell||''))))tag='SIM-TEST';// never LIVE on simulated stores
 Object.assign(WM,R,{io,tag,at:Date.now()});WM.mode=R.P.time?'time':'depth';rebuild();return WM}
export function select(uid,wb){const s=WM.sets.find(x=>x.uid==uid&&(!wb||x.wb==wb));if(s){WM.P=s;rebuild()}return s}
export function setMode(m){WM.mode=m=='depth'?'depth':'time';emit();return WM.mode}
export const view=()=>WM.mode=='depth'?WM.dep:WM.tim;
export async function refresh(){if(!WM.io||!WM.P||WM.P.obj!='log')return 0;const n=await WM.io.readLog(WM.well,WM.P);if(n)rebuild();return n}
export const trajectories=()=>WM.sets.filter(s=>s.obj=='trajectory');
export function clear(){Object.assign(WM,{well:'',wbs:[],sets:[],disc:null,P:null,M:null,dep:{ml:null,rows:[]},tim:{ml:null,rows:[]},tag:'SIM',io:null});emit()}
export const on=f=>{WM.subs.add(f);return()=>WM.subs.delete(f)};
// last value of every channel in the current view at its index (for panels): [{mn,unit,v,how,from}]
export function latest(){const V=view();if(!V.ml||!V.rows.length)return {idx:null,ch:[]};const r=V.rows.at(-1);
 return {idx:r[0],ch:V.ml.slice(1).map((mn,i)=>{let k=V.rows.length-1,v=V.rows[k][i+1];while(!Number.isFinite(v)&&k>0)v=V.rows[--k][i+1];return {mn,unit:V.ul?.[i+1]||'',v:Number.isFinite(v)?v:null,how:V.src?.[mn]?.how||'',from:V.src?.[mn]?.name||''}})}}
if(typeof window!='undefined'){window.GX=window.GX||{};window.GX.wellmodel={WM,load,select,setMode,view,refresh,trajectories,clear,on,latest,discText,makeIO,discoverWell,buildViews}}
