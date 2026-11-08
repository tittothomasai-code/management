// edmstore.js v5.9.4.1: saved EDM imports on this device only (IndexedDB). Stores the parsed, compacted model (gzip JSON), never the raw file.
// Nothing goes to a server. Quota errors are reported with the size that was attempted.
const DB='dw_edm',VER=1;let dbp=null;
function db(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{if(!self.indexedDB)return rej(new Error('IndexedDB not available in this browser'));const q=indexedDB.open(DB,VER);
 q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'id'});if(!d.objectStoreNames.contains('data'))d.createObjectStore('data')};
 q.onsuccess=()=>res(q.result);q.onerror=()=>{dbp=null;rej(q.error)}});return dbp}
const tx=async(stores,mode,fn)=>{const d=await db();return new Promise((res,rej)=>{const t=d.transaction(stores,mode);let out;try{out=fn(t)}catch(e){return rej(e)}t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('aborted'))})};
const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function gz(str){if(self.CompressionStream){const s=new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));return {blob:await new Response(s).blob(),enc:'gzip'}}return {blob:new Blob([str]),enc:'none'}}
async function ungz(blob,enc){if(enc=='gzip')return await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();return await blob.text()}
export const fmtMB=b=>b>=1e6?(b/1e6).toFixed(1)+' MB':(b/1e3).toFixed(0)+' kB';
export function isQuota(e){return !!e&&(e.name=='QuotaExceededError'||e.code==22||/quota/i.test(e.message||''))}
export async function save(W,{id}={}){const json=JSON.stringify(W);const {blob,enc}=await gz(json);id=id||('edm_'+Date.now().toString(36));
 const meta={id,name:W.name,customer:W.customer||null,sites:W.sites.length,wells:W.wells.length,wbs:W.wbs.length,date:new Date().toISOString(),size:blob.size,raw:json.length,enc,tag:'IMPORT'};
 try{await tx(['meta','data'],'readwrite',t=>{t.objectStore('data').put(blob,id);t.objectStore('meta').put(meta)})}
 catch(e){const err=new Error((isQuota(e)?'Not enough storage on this device to save ':'Could not save ')+fmtMB(blob.size)+(isQuota(e)?' — free some space or remove a saved site.':': '+(e?.message||e)));err.quota=isQuota(e);err.size=blob.size;throw err}
 try{await navigator.storage?.persist?.()}catch(e){}return meta}
export async function list(){try{const r=await tx(['meta'],'readonly',t=>req(t.objectStore('meta').getAll()));return (await r).sort((a,b)=>b.date.localeCompare(a.date))}catch(e){return []}}
export async function get(id){const [m,b]=await tx(['meta','data'],'readonly',t=>Promise.all([req(t.objectStore('meta').get(id)),req(t.objectStore('data').get(id))]));if(!m||!b)throw new Error('saved site not found');const W=JSON.parse(await ungz(b,m.enc));W.savedId=id;W.savedAt=m.date;return W}
export async function remove(id){await tx(['meta','data'],'readwrite',t=>{t.objectStore('meta').delete(id);t.objectStore('data').delete(id)});return true}
export async function usage(){try{return await navigator.storage.estimate()}catch(e){return null}}
