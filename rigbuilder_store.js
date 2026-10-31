// rigbuilder_store.js (feat/rig-builder): storage adapter for custom rigs. Default = localStorage key dw_custom_rigs_v1.
// Plug a remote adapter later (Software team lead's saved-site sync) with setAdapter({name,list,put,remove}); all methods async.
export const KEY='dw_custom_rigs_v1';
export const local={name:'local',
 async list(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return []}},
 async put(r){const a=await this.list(),i=a.findIndex(x=>x.id==r.id);if(i>=0)a[i]=r;else a.push(r);localStorage.setItem(KEY,JSON.stringify(a));return r},
 async remove(id){const a=(await this.list()).filter(x=>x.id!=id);localStorage.setItem(KEY,JSON.stringify(a));return true}};
let AD=local;const subs=new Set();
export const adapter=()=>AD;
export function setAdapter(a){if(!a||typeof a.list!='function'||typeof a.put!='function'||typeof a.remove!='function')return false;AD=a;emit();return true}
export const onChange=f=>{subs.add(f);return ()=>subs.delete(f)};
function emit(){for(const f of subs)try{f()}catch(e){}try{dispatchEvent(new CustomEvent('dw-custom-rigs'))}catch(e){}}
export const list=()=>AD.list();
export async function put(r){const x=await AD.put(r);emit();return x}
export async function remove(id){const x=await AD.remove(id);emit();return x}
// Sync read for showroom hooks (local cache of the last list()).
export function cached(){try{return AD===local?JSON.parse(localStorage.getItem(KEY)||'[]'):(AD.cache||[])}catch(e){return []}}
