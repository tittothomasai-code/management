// sitesync.js v5.12.8 (sync file now also carries custom rigs, dw_custom_rigs_v1; merged by id, newer 'updated' wins; v1 files still open).
// sitesync.js v5.12.1: phone/laptop sync for saved EDM sites.
// Two modes:
//  - Sync file (default, always on): export saved sites to one file, open it on the other device. No server.
//  - Cloud sync (only when a free Supabase project is set in <meta name="dw-sync-url"> + <meta name="dw-sync-key">
//    or window.DW_SYNC={url,key}): anonymous device login + a pairing code. Off when not set.
// Never syncs WITSML credentials or any secret: sanitize() removes credential-like keys before anything leaves the device.
import * as store from './edmstore.js?v=5941';import * as rigs from './rigbuilder_store.js?v=rb1';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SECRET=/witsml|passw|secret|token|credential|auth|username|apikey|api_key|cookie|session/i;
export function sanitize(o){if(Array.isArray(o))return o.map(sanitize);if(o&&typeof o=='object'){const r={};for(const [k,v] of Object.entries(o)){if(SECRET.test(k))continue;r[k]=sanitize(v)}return r}return o}
export function config(){const m=n=>document.querySelector(`meta[name="${n}"]`)?.content?.trim();const c=window.DW_SYNC||{url:m('dw-sync-url'),key:m('dw-sync-key')};return c&&c.url&&c.key?{url:c.url.replace(/\/$/,''),key:c.key}:null}
export const enabled=()=>!!config();
export async function exportFile(){const L=await store.list(),sites=[];for(const m of L){const W=await store.get(m.id);delete W.savedId;delete W.savedAt;sites.push({id:m.id,name:m.name,date:m.date,W:sanitize(W)})}
 const R=(await rigs.list().catch(()=>[])).filter(r=>r&&r.id!=null).map(sanitize);
 return {kind:'dw-sites',v:2,tag:'IMPORT',exported:new Date().toISOString(),sites,rigs:R}}
const ts=r=>Number(r?.updated??r?.created??0)||0;
export async function importRigs(arr){let added=0,updated=0,kept=0;if(!Array.isArray(arr))return {added,updated,kept};
 const have=new Map((await rigs.list()).map(r=>[String(r.id),r])),seen=new Set();
 for(const raw of arr){if(!raw||typeof raw!='object'||raw.id==null)continue;const id=String(raw.id);if(seen.has(id))continue;seen.add(id);const r=sanitize(raw),h=have.get(id);
  if(h&&ts(h)>=ts(r)){kept++;continue}await rigs.put(r);h?updated++:added++}return {added,updated,kept}}
export async function importFile(obj){if(!obj||obj.kind!='dw-sites'||!Array.isArray(obj.sites))throw new Error('This is not a Drilling World sites file.');
 const have=new Map((await store.list()).map(m=>[m.id,m]));let added=0,kept=0;
 for(const s of obj.sites){const h=have.get(s.id);if(h&&h.date>=s.date){kept++;continue}await store.save(sanitize(s.W),{id:s.id});added++}const rg=await importRigs(obj.rigs);return {added,kept,rigs:rg}}
// ---- cloud (Supabase REST + GoTrue anonymous sign-in); used only when config() is set
const SK='dw_sync_sess',SP='dw_sync_space';
async function sess(c){let s=null;try{s=JSON.parse(localStorage.getItem(SK)||'null')}catch(e){}if(s&&s.exp>Date.now()/1000+60)return s;
 const r=await fetch(c.url+'/auth/v1/signup',{method:'POST',headers:{apikey:c.key,'content-type':'application/json'},body:'{}'});if(!r.ok)throw new Error('Cloud sync login failed ('+r.status+')');const j=await r.json();
 s={token:j.access_token,exp:Math.floor(Date.now()/1000)+(j.expires_in||3600)};localStorage.setItem(SK,JSON.stringify(s));return s}
async function rest(path,opt={}){const c=config();if(!c)throw new Error('Cloud sync is off');const s=await sess(c);const r=await fetch(c.url+path,{...opt,headers:{apikey:c.key,authorization:'Bearer '+s.token,'content-type':'application/json',...(opt.headers||{})}});if(!r.ok)throw new Error('Cloud sync error '+r.status);return r.status==204?null:r.json()}
export async function createSpace(){const code=await rest('/rest/v1/rpc/dw_sync_create_space',{method:'POST',body:'{}'});localStorage.setItem(SP,'1');return code}
export async function joinSpace(code){const id=await rest('/rest/v1/rpc/dw_sync_join_space',{method:'POST',body:JSON.stringify({p_code:String(code).trim().toUpperCase()})});localStorage.setItem(SP,'1');return id}
export async function push(){const f=await exportFile();for(const s of f.sites)await rest('/rest/v1/rpc/dw_sync_put_site',{method:'POST',body:JSON.stringify({p_site_id:s.id,p_name:s.name,p_updated:s.date,p_payload:s.W})});return f.sites.length}
export async function pull(){const rows=await rest('/rest/v1/dw_sync_sites?select=site_id,name,updated_at,payload&deleted=eq.false');return importFile({kind:'dw-sites',sites:rows.map(r=>({id:r.site_id,name:r.name,date:r.updated_at,W:r.payload}))})}
// ---- UI panel
const CSS=`#syncP{position:fixed;inset:0;z-index:100003;background:rgba(3,8,26,.75);display:flex;align-items:center;justify-content:center;font:15px system-ui,-apple-system,Segoe UI,sans-serif;color:#eaf6ff}
#syncP .b{width:min(440px,calc(100vw - 20px));max-height:calc(100vh - 20px);overflow:auto;background:#0b2244;border:2px solid #3a6a9a;border-radius:16px;padding:14px;box-sizing:border-box}
#syncP h2{margin:0 0 6px;font-size:19px}#syncP p{margin:6px 0;font-size:13px;opacity:.85}#syncP button,#syncP input{min-height:44px;width:100%;margin:4px 0;border-radius:10px;border:2px solid #3a6a9a;background:#0f2a48;color:#eaf6ff;font:inherit;padding:6px 10px;box-sizing:border-box}
#syncP button:disabled{opacity:.45}#syncP .st{font-size:13px;min-height:18px;color:#bfe6ff}#syncP .tag{background:#8a8f98;color:#fff;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:800}`;
export async function open(){if($('syncP'))return;if(!$('syncCss')){const s=document.createElement('style');s.id='syncCss';s.textContent=CSS;document.head.appendChild(s)}
 const n=(await store.list()).length,nr=(await rigs.list().catch(()=>[])).length,on=enabled(),e=document.createElement('div');e.id='syncP';e.setAttribute('role','dialog');e.setAttribute('aria-label','Sync saved sites');
 e.innerHTML=`<div class=b><h2>Sync saved sites</h2><p>${n} saved site${n==1?'':'s'} on this device. ${nr?nr+' custom rig'+(nr==1?'':'s')+' too. ':''}Sync sends the site model and custom rigs only. It never sends WITSML user names or passwords.</p>
 <h3 style="margin:8px 0 2px;font-size:15px">Sync file</h3><p>Make a file on this device. Open the file on your phone or laptop to add the sites and custom rigs there.</p>
 <button id=syExp ${n||nr?'':'disabled'}>Make sync file</button><button id=syImpB>Open sync file</button><input id=syImp type=file accept=".json,application/json" hidden>
 <h3 style="margin:8px 0 2px;font-size:15px">Cloud sync</h3>`+(on?`<p>Pair this device with a code, then send or get sites.</p><button id=syNew>Make pairing code</button><input id=syCode placeholder="Pairing code" autocomplete=off><button id=syJoin>Pair with code</button><button id=syPush>Send sites</button><button id=syPull>Get sites</button>`
 :`<p id=syOff>Cloud sync is off on this site. Use a sync file.</p>`)+`<div id=sySt class=st role=status></div><button id=syX>Close</button></div>`;document.body.appendChild(e);
 const st=t=>{$('sySt').textContent=t},run=f=>async()=>{try{await f()}catch(x){st(x.message||String(x))}};
 $('syX').onclick=close;addEventListener('keydown',escK,true);
 $('syExp').onclick=run(async()=>{const f=await exportFile(),txt=JSON.stringify(f),name='drilling-world-sites-'+new Date().toISOString().slice(0,10)+'.json',file=new File([txt],name,{type:'application/json'});window.GX.sync.last=f;
  if(navigator.canShare?.({files:[file]})&&!navigator.webdriver){await navigator.share({files:[file],title:'Drilling World sites'})}else{const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
  st('Sync file made: '+f.sites.length+' site'+(f.sites.length==1?'':'s')+(f.rigs.length?', '+f.rigs.length+' custom rig'+(f.rigs.length==1?'':'s'):'')+'.')});
 $('syImpB').onclick=()=>$('syImp').click();$('syImp').onchange=run(async()=>{const f=$('syImp').files[0];if(!f)return;const r=await importFile(JSON.parse(await f.text()));const g=r.rigs||{},gn=(g.added||0)+(g.updated||0);st('Added '+r.added+' site'+(r.added==1?'':'s')+'. Kept '+r.kept+' that were already new.'+(gn||g.kept?' Custom rigs: '+(g.added||0)+' added, '+(g.updated||0)+' updated, '+(g.kept||0)+' kept.':''));try{dispatchEvent(new CustomEvent('dw:sites-changed'))}catch(x){}});
 if(on){$('syNew').onclick=run(async()=>{const c=await createSpace();$('syCode').value=c;st('Pairing code: '+c+'. Type it on the other device.')});$('syJoin').onclick=run(async()=>{await joinSpace($('syCode').value);st('Device paired.')});
  $('syPush').onclick=run(async()=>{st('Sent '+await push()+' sites.')});$('syPull').onclick=run(async()=>{const r=await pull();st('Added '+r.added+' sites.')})}
 setTimeout(()=>$('syExp')?.focus(),50)}
function escK(k){if(k.key=='Escape'&&$('syncP')){k.stopPropagation();k.preventDefault();close()}}
export function close(){removeEventListener('keydown',escK,true);$('syncP')?.remove()}
const API={open,close,sanitize,exportFile,importFile,importRigs,enabled,config,last:null};window.GX=window.GX||{};window.GX.sync=API;
