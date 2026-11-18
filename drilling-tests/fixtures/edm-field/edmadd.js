// edmadd.js (dr101l-plan-1115): ADD the DR101L.edm.xml import (parsed from the well folder, data/dr101l-edm-world.json) to the
// EDM sites saved on this device. Additive only: every saved import is backed up first (separate IndexedDB "dw_edm_backup" + a
// downloadable file), nothing saved is replaced, overwritten or de-duplicated. A same-named well in another import is kept and
// both are labelled by source. Before/after counts per saved dataset are returned so the caller can show that nothing was lost.
import * as store from './edmstore.js?v=5941';
export const ID = 'edm_dr101l_wellfolder_20261115';
export const DATA = './data/dr101l-edm-world.json?v=dr1115';
const BDB = 'dw_edm_backup';
function bdb() { return new Promise((res, rej) => { const q = indexedDB.open(BDB, 1); q.onupgradeneeded = () => q.result.createObjectStore('b'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function putBackup(key, obj) { const d = await bdb(); await new Promise((res, rej) => { const t = d.transaction('b', 'readwrite'); t.objectStore('b').put(new Blob([JSON.stringify(obj)], {type: 'application/json'}), key); t.oncomplete = res; t.onerror = () => rej(t.error); }); d.close(); }
export async function listBackups() { try { const d = await bdb(); const k = await new Promise((res, rej) => { const r = d.transaction('b').objectStore('b').getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); d.close(); return k; } catch { return []; } }
const countsOf = W => ({sites: W?.sites?.length ?? 0, wells: W?.wells?.length ?? 0, wellbores: W?.wbs?.length ?? 0, surveys: (W?.wbs || []).reduce((a, b) => a + (b.traj?.length || 0), 0)});
async function fingerprint(W) { const s = JSON.stringify(W); const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(h)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function snapshot() {
  const L = await store.list(), out = [];
  for (const m of L) { let W = null; try { W = await store.get(m.id); delete W.savedId; delete W.savedAt; } catch {} out.push({id: m.id, name: m.name, date: m.date, ...countsOf(W), wellNames: (W?.wells || []).map(w => w.name), fp: W ? await fingerprint(W) : null, W}); }
  return out;
}
export async function addDr101l({fetchFn = globalThis.fetch} = {}) {
  const before = await snapshot();
  const key = 'backup-' + new Date().toISOString();
  const file = {kind: 'dw-sites', v: 2, tag: 'IMPORT', exported: new Date().toISOString(), note: 'Backup made before adding DR101L.edm.xml', sites: before.map(s => ({id: s.id, name: s.name, date: s.date, W: s.W}))};
  await putBackup(key, file);
  const strip = a => a.map(({W, ...r}) => r);
  if (before.some(s => s.id === ID)) return {added: false, reason: 'DR101L.edm.xml (well folder) is already saved on this device; nothing changed.', backupKey: key, backupFile: file, before: strip(before), after: strip(before), collisions: []};
  const W = await (await fetchFn(DATA)).json();
  const collisions = before.filter(s => s.wellNames.some(n => W.wells.some(w => String(w.name).trim().toUpperCase() === String(n).trim().toUpperCase())));
  W.name = 'DR101L.edm.xml · well folder 15 Nov 2026';
  if (collisions.length) { W.collisionNote = 'Same well name also in: ' + collisions.map(c => c.name).join(', ') + '. Both kept, labelled by source.'; for (const w of W.wells) w.sourceLabel = 'DR101L.edm.xml (well folder)'; }
  await store.save(W, {id: ID});
  const after = await snapshot();
  const lost = before.filter(b => { const a = after.find(x => x.id === b.id); return !a || a.fp !== b.fp; });
  return {added: true, backupKey: key, backupFile: file, before: strip(before), after: strip(after), collisions: collisions.map(c => ({id: c.id, name: c.name})), lost: lost.map(x => x.id)};
}
export function countsTable(r) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const ids = [...new Set([...r.before.map(x => x.id), ...r.after.map(x => x.id)])];
  const row = id => { const b = r.before.find(x => x.id === id), a = r.after.find(x => x.id === id); const c = (o, k) => o ? o[k] : '–';
    return `<tr><td>${esc((a || b).name)}</td><td>${c(b, 'sites')} → ${c(a, 'sites')}</td><td>${c(b, 'wells')} → ${c(a, 'wells')}</td><td>${c(b, 'wellbores')} → ${c(a, 'wellbores')}</td><td>${c(b, 'surveys')} → ${c(a, 'surveys')}</td><td>${!b ? 'added' : a && a.fp === b.fp ? 'unchanged' : 'CHANGED'}</td></tr>`; };
  return `<table><tr><th>Saved dataset</th><th>Sites</th><th>Wells</th><th>Wellbores</th><th>Trajectories</th><th>State</th></tr>${ids.map(row).join('')}</table>`;
}
export function downloadBackup(r) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.backupFile)], {type: 'application/json'})); a.download = 'edm-saved-sites-backup-' + r.backupKey.slice(7, 26).replace(/:/g, '') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
