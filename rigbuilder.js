// rigbuilder.js (feat/rig-builder): Rig Builder. Pick parts from the full catalogue (Showroom A workshop BOM, B pass-1, C pass-2),
// assemble them in slots, see live key specs + BOM, save under a name. Saved rigs: load, rename, duplicate, delete (confirm),
// export / import JSON, and they show as rigs in Showroom B. Storage via rigbuilder_store.js (localStorage dw_custom_rigs_v1 now).
// All specs are SIM (generic class values). Keys, gamepad, touch; desk + phone.
import * as C from './rigbuilder_core.js?v=rb3';import * as S from './rigbuilder_store.js?v=rb1';import * as R3 from './rigbuilder3d.js?v=rb3';
export const VER='rb3';
const $=id=>document.getElementById(id),es=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),fmt=n=>(+n||0).toLocaleString('en-AU');
export const ST={el:null,cat:null,man1:null,rig:null,slot:'mast',sel:0,list:[],dirty:false,tab:'build',pad:null,padPrev:[],dlg:null,q:''};
let CATp=null;
export function catalogue(){return CATp||(CATp=(async()=>{const get=u=>fetch(new URL(u,import.meta.url).href+'?v='+VER).then(r=>r.ok?r.json():null).catch(()=>null);
 const [m1,m2,bd,m3]=await Promise.all([get('./assets/rigsb/pass1/manifest.json'),get('./assets/rigsc/pass2/manifest.json'),import('./bom_data.js?v=1').catch(()=>null),get('./assets/rigparts/pass3/manifest.json')]);
 ST.man1=m1;ST.man2=m2;ST.man3=m3;ST.cat=C.buildCatalogue(m1,m2,bd?.RIG,m3);return ST.cat})())}
// ---------- showroom hook: custom rigs as extra Showroom B rigs (base model = rig that gave the mast) ----------
export function showroomRigs(base){const list=S.cached();if(!ST.cat||!list.length)return [];const out=[];
 for(const r of list){const b=(base||[]).find(x=>x.id==C.baseRig(r,ST.cat))||(base||[])[0];if(!b)continue;const s=C.specs(r,ST.cat);
  out.push({...b,id:'custom:'+r.id,rb:r,name:r.name,kind:'custom build',custom:true,customId:r.id,st:{hook:s.hook,depth:s.depth,kw:s.kw,bop:s.bop,short:r.name,hookNote:s.hook?null:'n/a',design:{derrick_klbf:Math.round(s.hook*2.2),dw_hp:ST.cat.find(c=>c.id==r.slots.dw)?.cls.hp||1000,lines:10,bop_psi:s.bop,pumps:[]}}})}return out}
async function showInShowroom(id){await save(true);try{localStorage.setItem('dw_showroom_rig_b','custom:'+id)}catch(e){}close();
 if($('start')&&$('st_showroom')){const u=new URL(location.href);u.searchParams.set('showroom','b');history.replaceState(history.state,'',u);$('st_showroom').click();setTimeout(()=>{const v=new URL(location.href);v.searchParams.delete('showroom');history.replaceState(history.state,'',v)},4000);return}
 const m=await import('./showroomb.js?v=b1');m.open()}
// ---------- CSS ----------
const CSS=`#rigBuilder{position:fixed;inset:0;z-index:100002;background:#0b0d10;color:#e8ebef;font:14px Inter,system-ui,-apple-system,Segoe UI,sans-serif;display:grid;grid-template-rows:auto 1fr;overflow:hidden}
#rigBuilder button,#rigBuilder input{font:inherit;color:#e8ebef;background:#161a1f;border:1px solid #2c333b;border-radius:6px;min-height:36px;padding:4px 12px;cursor:pointer}
#rigBuilder button:hover,#rigBuilder button:focus-visible{border-color:#c9a46a;outline:none}#rigBuilder button.pri{background:#c9a46a;color:#111;border-color:#c9a46a;font-weight:600}
#rigBuilder input{cursor:text;width:100%;box-sizing:border-box}#rigBuilder .sim{border:1px solid #6b737c;color:#aab2ba;border-radius:3px;font-size:10px;padding:0 4px;margin-left:6px;letter-spacing:.1em}
#rbTop{display:flex;align-items:center;gap:8px;padding:8px 12px;padding-top:calc(8px + env(safe-area-inset-top));border-bottom:1px solid #1f252b}#rbTop .tt{font-weight:600;letter-spacing:.3em;font-size:13px;flex:1}
#rbTabs{display:none}#rbMain{display:grid;grid-template-columns:300px 1fr 360px;min-height:0}
#rbMain>div{min-height:0;min-width:0;overflow:auto;padding:10px 12px;border-right:1px solid #1f252b}
#rbSlots{display:flex;flex-direction:column;gap:3px;margin-bottom:8px}#rbSlots button{display:flex;justify-content:space-between;text-align:left;gap:6px;font-size:13px}
#rbSlots button.on{border-color:#c9a46a;background:#221d14}#rbSlots button small{color:#8b949d;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px}
#rbItems{display:flex;flex-direction:column;gap:3px}#rbItems button{text-align:left;display:flex;flex-direction:column;align-items:flex-start;font-size:13px}#rbItems button small{color:#8b949d;font-size:11px}
#rbItems button.on{border-color:#c9a46a;background:#221d14}#rbItems button.cur{box-shadow:0 0 0 2px #c9a46a88}
#rbItems h4,#rbCat h4,#rbRight h4{margin:10px 0 4px;font-weight:600;font-size:11px;letter-spacing:.14em;color:#8b949d;text-transform:uppercase}
#rbCenter{display:flex;flex-direction:column;gap:10px}#rbSvg{flex:1;min-height:260px;background:radial-gradient(#161a20,#0b0d10 70%);border:1px solid #1f252b;border-radius:6px}
#rbSvg{position:relative;overflow:hidden}#rbSvg canvas{position:absolute;inset:0}#rb3Lbl,#rb3Help,#rb3Miss,#rbLoad3{position:absolute;z-index:1;pointer-events:none;font-size:12px;color:#aab2ba}#rb3Lbl{left:10px;top:8px;right:10px;text-shadow:0 1px 2px #000}#rb3Lbl b{color:#e8ebef;font-weight:600}#rb3Lbl small{color:#6f7880}#rb3Help{left:10px;bottom:8px;color:#6f7880;font-size:11px}#rb3Miss{right:10px;bottom:8px;color:#e0a06a}#rbLoad3{left:50%;top:50%;transform:translate(-50%,-50%);background:#12161aee;border:1px solid #262c33;border-radius:6px;padding:6px 12px}#rbLoad3[hidden]{display:none}#rbSvg .z{cursor:pointer}#rbSvg .z rect,#rbSvg .z path{fill:#1b2026;stroke:#3a434d;stroke-width:1.2}
#rbSvg .z.f rect,#rbSvg .z.f path{fill:#262d35;stroke:#8d96a0}#rbSvg .z.on rect,#rbSvg .z.on path{stroke:#c9a46a;stroke-width:2.2}#rbSvg text{fill:#aab2ba;font-size:11px;pointer-events:none}
#rbSvg .z.miss rect,#rbSvg .z.miss path{stroke-dasharray:4 3}
#rbNameRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#rbNameRow input{flex:1;min-width:160px}#rbErr{color:#e0a06a;font-size:12px;min-height:16px;width:100%}
#rbQty{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:#aab2ba;align-items:center}#rbQty button{min-width:36px;padding:2px 8px}
#rbSpecs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}#rbSpecs div{background:#12161a;border:1px solid #1f252b;border-radius:6px;padding:6px 8px}
#rbSpecs span{display:block;color:#8b949d;font-size:11px;letter-spacing:.08em}#rbSpecs b{font-weight:600;font-variant-numeric:tabular-nums;font-size:16px}
#rbWarn{color:#e0a06a;font-size:12px;margin:4px 0}#rbBom{width:100%;border-collapse:collapse;font-size:12px}#rbBom td,#rbBom th{border-bottom:1px solid #1c2127;padding:3px 4px;text-align:left;vertical-align:top}
#rbBom th{color:#8b949d;font-weight:500}#rbBom tr.B td:nth-child(2){padding-left:12px;color:#c3c9cf}#rbBom tr.C td:nth-child(2){padding-left:22px;color:#9aa3ac}#rbBom td.q{text-align:right;font-variant-numeric:tabular-nums}
#rbBom .id{color:#6f7880;font-size:10px;word-break:break-all}
#rbSaved{position:absolute;right:0;top:0;bottom:0;width:min(420px,100%);background:#0f1215;border-left:1px solid #262c33;z-index:3;display:flex;flex-direction:column;padding:12px;padding-top:calc(12px + env(safe-area-inset-top));gap:8px;box-shadow:-20px 0 40px #0008}
#rbSaved[hidden],#rbDlg[hidden]{display:none}#rbList{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px}
#rbList .it{border:1px solid #262c33;border-radius:6px;padding:8px;background:#12161a}#rbList .it.cur{border-color:#c9a46a}#rbList .it b{display:block}#rbList .it small{color:#8b949d;font-size:11px}
#rbList .it .acts{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#rbList .it .acts button{min-height:32px;padding:2px 8px;font-size:12px}
#rbDlg{position:absolute;inset:0;background:#000a;z-index:5;display:flex;align-items:center;justify-content:center}#rbDlg>div{background:#12161a;border:1px solid #2c333b;border-radius:8px;padding:16px;width:min(380px,90vw);display:flex;flex-direction:column;gap:10px}
#rbDlg textarea{width:100%;box-sizing:border-box;min-height:120px;background:#0b0d10;color:#e8ebef;border:1px solid #2c333b;border-radius:6px;font:12px monospace}
#rbDlg .row{display:flex;gap:8px;justify-content:flex-end}#rbToast{position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);background:#1c2127;border:1px solid #3a434d;border-radius:6px;padding:6px 14px;z-index:6;font-size:13px;pointer-events:none;opacity:0;transition:opacity .2s}#rbToast.on{opacity:1}
#rbHint{color:#6f7880;font-size:11px}
@media (max-width:819px){#rbTabs{display:flex;gap:4px;padding:6px 8px;border-bottom:1px solid #1f252b}#rbTabs button{flex:1}#rbTabs button.on{border-color:#c9a46a;background:#221d14}
#rigBuilder{grid-template-rows:auto auto 1fr}#rbMain{grid-template-columns:minmax(0,1fr)}#rbCur,#rbOpenSaved{display:none}#rbTop{padding:6px 8px;padding-top:calc(6px + env(safe-area-inset-top))}#rbTop .tt{font-size:12px}#rbNameRow input{min-width:0;flex-basis:100%}#rbNameRow button{flex:1}#rbMain>div{display:none;border:0;padding-bottom:calc(16px + env(safe-area-inset-bottom))}
#rigBuilder[data-tab=build] #rbCat,#rigBuilder[data-tab=build] #rbCenter,#rigBuilder[data-tab=specs] #rbRight{display:flex;flex-direction:column}
#rigBuilder[data-tab=build] #rbMain{grid-template-rows:auto 1fr;overflow:auto}#rigBuilder[data-tab=build] #rbCenter{order:-1;overflow:visible}#rigBuilder[data-tab=build] #rbCat{overflow:visible}
#rbSvg{min-height:240px;max-height:42vh;flex:none;height:42vh}#rbSlots{flex:none;flex-direction:row;overflow-x:auto;overflow-y:hidden;gap:4px;padding:2px 0 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}#rbSlots button{scroll-snap-align:start;min-height:52px}#rb3Help{display:none}#rbQ{flex:none}#rbSlots button{flex:none;flex-direction:column}#rbSlots button small{max-width:110px}#rbHint{display:none}#rbTop .tt{letter-spacing:.16em}}`;
// ---------- schematic (elevation, slot zones) ----------
const ZONES={mast:'<path d="M182 30 L218 30 L236 200 L164 200 Z"/>',td:'<rect x="186" y="70" width="28" height="44" rx="3"/>',sub:'<rect x="130" y="200" width="140" height="44"/>',
 dw:'<rect x="236" y="176" width="44" height="24" rx="2"/>',bop:'<rect x="186" y="246" width="28" height="44" rx="2"/>',cabin:'<rect x="100" y="172" width="58" height="28" rx="2"/>',
 pipe:'<path d="M270 236 L372 214 L372 228 L270 250 Z"/>',pumps:'<rect x="292" y="262" width="80" height="28" rx="2"/>',tanks:'<rect x="20" y="262" width="96" height="28" rx="2"/>',
 power:'<rect x="20" y="222" width="96" height="30" rx="2"/>',extra:'<rect x="292" y="40" width="88" height="40" rx="2"/>'};
const ZL={mast:[200,24],td:[200,94],sub:[200,226],dw:[258,170],bop:[200,302],cabin:[129,166],pipe:[322,210],pumps:[332,280],tanks:[68,280],power:[68,241],extra:[336,64]};
function svg(){const r=ST.rig,sp=C.SLOTS;return `<svg viewBox="0 0 400 320" role=img aria-label="Rig layout"><line x1="0" y1="290.5" x2="400" y2="290.5" stroke="#2c333b"/>`+sp.map(s=>{const f=s.multi?r.extras.length:!!r.slots[s.k];
 return `<g class="z${f?' f':''}${ST.slot==s.k?' on':''}${s.req&&!f?' miss':''}" data-z="${s.k}" tabindex=-1>${ZONES[s.k]}<title>${es(s.l)}</title></g><text x="${ZL[s.k][0]}" y="${ZL[s.k][1]}" text-anchor=middle>${es(s.l.split(' /')[0])}${s.multi&&f?' ('+f+')':''}</text>`}).join('')+`</svg>`}
// ---------- 3D stage ----------
const phoneish=()=>matchMedia('(max-width:819px)').matches||/Mobi|Android|iPhone/.test(navigator.userAgent);
export function lod(){try{const u=new URLSearchParams(location.search).get('rblod');if(/^[HML]$/.test(u||''))return u}catch(e){}return phoneish()?'L':'M'}
const man=()=>({m1:ST.man1,m2:ST.man2,m3:ST.man3});
function draw3d(){const st=ST.stage;if(!st)return;const k=JSON.stringify(C.nodeSet(ST.rig))+JSON.stringify(ST.rig.qty);
 if(k!=ST.k3){ST.k3=k;clearTimeout(ST.t3);$('rbLoad3').hidden=false;ST.t3=setTimeout(()=>st.set(ST.rig,ST.cat,man()).then(g=>{if(g){$('rbLoad3').hidden=true;miss3(g)}}),60)}st.select(ST.slot);
 const S0=C.SLOTS.find(s=>s.k==ST.slot),it=S0.multi?null:item(ST.rig.slots[ST.slot]);$('rb3Lbl').innerHTML=`<b>${es(S0.l)}</b> · ${S0.multi?ST.rig.extras.length+' added':it?es(it.name+' · '+it.rigName):'none'} · <small>${es(C.ANCHORS[ST.slot].at)}</small>`}
function miss3(g){const m=g.userData.missing;$('rb3Miss').textContent=m.length?'No mesh: '+m.map(x=>x.slot).join(', '):''}
// Saved rig record -> assembled 3D group (Showroom B uses this).
export async function assemble3d(rec,lodK){await catalogue();return R3.assemble(rec,ST.cat,lodK||lod(),man())}
// ---------- render ----------
const item=id=>ST.cat.find(c=>c.id==id);
function items(){const q=ST.q.trim().toLowerCase();return ST.cat.filter(c=>c.slot==ST.slot&&(!q||(c.name+' '+c.rigName+' '+c.bom).toLowerCase().includes(q)))}
const SRC={A:'Showroom A · workshop',B:'Showroom B · pass 1',C:'Showroom C · pass 2'};
function renderCat(){const r=ST.rig;$('rbSlots').innerHTML=C.SLOTS.map(s=>{const it=s.multi?null:item(r.slots[s.k]);return `<button data-s="${s.k}" class="${ST.slot==s.k?'on':''}" aria-pressed=${ST.slot==s.k}><span>${es(s.l)}${s.req?'':' <small>(option)</small>'}</span><small>${s.multi?(r.extras.length+' added'):it?es(it.rigName):'none'}</small></button>`}).join('');
 const L=items(),S0=C.SLOTS.find(s=>s.k==ST.slot);ST.sel=Math.min(ST.sel,Math.max(0,L.length-1));
 $('rbItems').innerHTML=`<h4>${es(S0.l)} · ${L.length} parts</h4>`+(S0.req?'':`<button data-i="-1" class="${!S0.multi&&!r.slots[S0.k]?'on':''}${ST.sel==-1?' cur':''}"><span>None</span></button>`)+
  L.map((c,i)=>{const on=S0.multi?r.extras.includes(c.id):r.slots[S0.k]==c.id;return `<button data-i="${i}" data-id="${es(c.id)}" class="${on?'on':''}${i==ST.sel?' cur':''}" aria-pressed=${on}><span>${on&&S0.multi?'✓ ':''}${es(c.name)}</span><small>${es(c.rigName)} · ${es(SRC[c.src])} · ${c.kids.length} sub-parts</small></button>`}).join('');
 $('rbSlots').querySelectorAll('button').forEach(b=>b.onclick=()=>slot(b.dataset.s));$('rbItems').querySelectorAll('button').forEach(b=>b.onclick=()=>{ST.sel=+b.dataset.i;pick(b.dataset.id||null)})}
function renderRig(){const r=ST.rig,s=C.specs(r,ST.cat),q=r.qty;draw3d();
 $('rbSpecs').innerHTML=[['Hook load',s.hook?fmt(s.hook)+' t':'n/a'],['Depth',fmt(s.depth)+' m'],['Power',fmt(s.kw)+' kW'],['BOP',fmt(s.bop)+' psi'],['Pump power',fmt(s.pumpHp)+' hp'],['Peak load',fmt(s.load)+' kW']].map(([l,v])=>`<div><span>${l}</span><b>${v}</b></div>`).join('');
 $('rbWarn').innerHTML=s.warn.map(es).join('<br>');const B=C.bom(r,ST.cat);
 $('rbBom').innerHTML=`<tr><th>Lvl</th><th>Part</th><th>Qty</th></tr>`+B.map(x=>`<tr class=${x.lvl}><td>${x.lvl}</td><td>${es(x.name)}${x.slot?` <small style="color:#8b949d">· ${es(x.slot)}</small>`:''}<div class=id>${es(x.bom)}${x.src?' · '+es(x.src):''}</div></td><td class=q>${x.qty}</td></tr>`).join('');
 $('rbBomN').textContent=B.length+' lines';$('rbQty').innerHTML=`<span>Mud pumps <button data-q="pumps:-1" aria-label="Fewer pumps">−</button> <b id=rbQP>${q.pumps}</b> <button data-q="pumps:1" aria-label="More pumps">+</button></span><span>Generators <button data-q="power:-1" aria-label="Fewer generators">−</button> <b id=rbQG>${q.power}</b> <button data-q="power:1" aria-label="More generators">+</button></span>`;
 $('rbQty').querySelectorAll('button').forEach(b=>b.onclick=()=>{const [k,d]=b.dataset.q.split(':'),S0=C.SLOTS.find(s=>s.k==k);r.qty[k]=Math.min(S0.qty[1],Math.max(S0.qty[0],r.qty[k]+ +d));dirty()});
 $('rbCur').textContent=r.id?(r.name+(ST.dirty?' · not saved':'')):(ST.dirty?'New rig · not saved':'New rig')}
function render(){renderCat();renderRig();const c=ST.el.querySelector('#rbItems .cur');c?.scrollIntoView?.({block:'nearest'})}
function dirty(){ST.dirty=true;renderCat();renderRig()}
export function slot(k){if(!C.SLOTS.some(s=>s.k==k))return;ST.slot=k;ST.q='';$('rbQ').value='';const L=items(),cur=ST.rig.slots[k];ST.sel=Math.max(0,L.findIndex(c=>c.id==cur));render()}
export function pick(id){const S0=C.SLOTS.find(s=>s.k==ST.slot),r=ST.rig;if(S0.multi){if(!id)r.extras=[];else r.extras=r.extras.includes(id)?r.extras.filter(x=>x!=id):[...r.extras,id]}else if(id)r.slots[S0.k]=id;else if(!S0.req)delete r.slots[S0.k];dirty()}
// ---------- save / list ----------
const toast=t=>{const e=$('rbToast');if(!e)return;e.textContent=t;e.classList.add('on');clearTimeout(ST.tt);ST.tt=setTimeout(()=>e.classList.remove('on'),2200)};
export async function refresh(){ST.list=await S.list();renderSaved();return ST.list}
export async function save(quiet){const v=C.validName($('rbName').value,ST.list,ST.rig.id);$('rbErr').textContent=v.ok?'':v.err;if(!v.ok){if(!quiet)$('rbName').focus();return false}
 const r=ST.rig,now=Date.now();r.name=v.name;if(!r.id){r.id=C.newId();r.created=now}r.updated=now;await S.put(C.clean(JSON.parse(JSON.stringify(r))));ST.dirty=false;$('rbName').value=r.name;await refresh();renderRig();if(!quiet)toast('Saved: '+r.name);return true}
export function load(id){const r=ST.list.find(x=>x.id==id);if(!r)return false;ST.rig=C.clean(JSON.parse(JSON.stringify(r)));ST.rig.extras=ST.rig.extras.filter(item);ST.dirty=false;$('rbName').value=r.name;$('rbErr').textContent='';try{localStorage.setItem('dw_rb_last',id)}catch(e){}render();renderSaved();toast('Loaded: '+r.name);return true}
export function newRig(){ST.rig=C.defaults(ST.cat);ST.dirty=false;$('rbName').value='';$('rbErr').textContent='';render();renderSaved()}
export async function rename(id,name){const r=ST.list.find(x=>x.id==id);if(!r)return {ok:false,err:'Not found.'};const v=C.validName(name,ST.list,id);if(!v.ok)return v;r.name=v.name;r.updated=Date.now();await S.put(r);if(ST.rig.id==id){ST.rig.name=v.name;$('rbName').value=v.name}await refresh();renderRig();return v}
export async function duplicate(id){const r=ST.list.find(x=>x.id==id);if(!r)return null;let n=r.name+' copy',i=2;while(!C.validName(n,ST.list).ok)n=`${r.name} copy ${i++}`;const d={...JSON.parse(JSON.stringify(r)),id:C.newId(),name:n,created:Date.now(),updated:Date.now()};await S.put(d);await refresh();toast('Copied: '+n);return d}
export async function remove(id){await S.remove(id);if(ST.rig.id==id){ST.rig.id='';ST.dirty=true}await refresh();renderRig();return true}
export function exportText(ids){return C.exportJSON(ST.list.filter(r=>!ids||ids.includes(r.id)))}
export function download(ids){const t=exportText(ids),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'application/json'}));a.download=(ids?.length==1?ST.list.find(r=>r.id==ids[0]).name.replace(/[^\w-]+/g,'_'):'custom_rigs')+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);return t}
export async function importText(t){const v=C.importJSON(t,ST.list);if(!v.ok)return v;for(const r of v.rigs)await S.put(r);await refresh();toast('Imported '+v.rigs.length+' rig'+(v.rigs.length>1?'s':''));return v}
function renderSaved(){const L=$('rbList');if(!L)return;L.innerHTML=ST.list.length?ST.list.slice().sort((a,b)=>b.updated-a.updated).map(r=>{const s=C.specs(r,ST.cat);return `<div class="it${ST.rig?.id==r.id?' cur':''}" data-id="${es(r.id)}"><b>${es(r.name)}</b><small>${s.hook?fmt(s.hook)+' t':'n/a'} · ${fmt(s.depth)} m · ${fmt(s.kw)} kW · ${fmt(s.bop)} psi · SIM · ${new Date(r.updated).toLocaleString('en-AU',{dateStyle:'short',timeStyle:'short'})}</small>
 <div class=acts><button data-a=load>Load</button><button data-a=ren>Rename</button><button data-a=dup>Duplicate</button><button data-a=sr>Showroom</button><button data-a=exp>Export</button><button data-a=del>Delete</button></div></div>`}).join(''):'<div style="color:#8b949d">No saved rigs yet. Build a rig, type a name and select Save.</div>';
 L.querySelectorAll('.it').forEach(el=>{const id=el.dataset.id,r=ST.list.find(x=>x.id==id);el.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const a=b.dataset.a;
  if(a=='load'){if(ST.dirty&&!(await ask({t:'Load "'+r.name+'"? Your changes that are not saved will be lost.',ok:'Load'})))return;load(id);savedShow(false)}
  else if(a=='ren'){const n=await ask({t:'New name',val:r.name,ok:'Rename',check:v=>C.validName(v,ST.list,id)});if(n!=null){await rename(id,n);toast('Renamed')}}
  else if(a=='dup')await duplicate(id);else if(a=='sr'){ST.rig.id==id||load(id);showInShowroom(id)}else if(a=='exp'){download([id]);toast('Exported: '+r.name)}
  else if(a=='del'){if(await ask({t:'Delete "'+r.name+'"? You cannot undo this.',ok:'Delete'})){await remove(id);toast('Deleted')}}})})}
export function savedShow(on){const e=$('rbSaved');if(!e)return;e.hidden=!on;$('rbOpenSaved').setAttribute('aria-expanded',!!on);if(on){refresh();setTimeout(()=>e.querySelector('button')?.focus(),30)}}
// in-app dialog: confirm (no val) or prompt (val). Resolves true/false or string/null.
export function ask(o){return new Promise(res=>{const d=$('rbDlg');d.hidden=false;const P=o.val!=null||o.area;d.innerHTML=`<div role=alertdialog aria-modal=true aria-label="${es(o.t)}"><div>${es(o.t)}</div>${o.area?'<textarea id=rbDlgV aria-label="JSON"></textarea>':P?`<input id=rbDlgV value="${es(o.val)}" maxlength=80>`:''}<div id=rbDlgE style="color:#e0a06a;font-size:12px"></div><div class=row><button id=rbDlgC>Cancel</button><button id=rbDlgO class=pri>${es(o.ok||'OK')}</button></div></div>`;
 const v=$('rbDlgV'),done=x=>{d.hidden=true;d.innerHTML='';ST.dlg=null;res(x)};ST.dlg={ok:()=>$('rbDlgO').click(),cancel:()=>done(P?null:false)};
 $('rbDlgC').onclick=ST.dlg.cancel;$('rbDlgO').onclick=()=>{if(!P)return done(true);if(o.check){const c=o.check(v.value);if(!c.ok){$('rbDlgE').textContent=c.err;return}return done(c.name)}done(v.value)};(v||$('rbDlgO')).focus();v?.select?.()})}
async function importUI(){const t=await ask({t:'Paste rig JSON, or select Cancel and use Import file.',area:1,ok:'Import'});if(t==null||t===false)return;const v=await importText(t);if(!v.ok)toast(v.err)}
// ---------- input ----------
function key(e){if(!ST.el)return;const tg=e.target,typing=tg&&/^(INPUT|TEXTAREA)$/.test(tg.tagName);
 if(ST.dlg){if(e.key=='Escape'){e.preventDefault();ST.dlg.cancel()}else if(e.key=='Enter'&&tg?.tagName!='TEXTAREA'){e.preventDefault();ST.dlg.ok()}e.stopPropagation();return}
 if(e.key=='Escape'){e.preventDefault();e.stopPropagation();if(!$('rbSaved').hidden)savedShow(false);else if(typing)tg.blur();else close();return}
 if(typing){if(e.key=='Enter'&&tg.id=='rbName'){e.preventDefault();save()}e.stopPropagation();return}
 const L=items(),k=e.key;let h=1;
 if(k=='ArrowDown'){ST.sel=Math.min(L.length-1,ST.sel+1);render()}else if(k=='ArrowUp'){ST.sel=Math.max(0,ST.sel-1);render()}
 else if(k=='ArrowRight'||k=='ArrowLeft'){const i=C.SLOTS.findIndex(s=>s.k==ST.slot),n=C.SLOTS.length;slot(C.SLOTS[(i+(k=='ArrowRight'?1:n-1))%n].k)}
 else if(k=='Enter'||k==' '){if(tg?.tagName=='BUTTON'&&k==' ')return;if(tg?.tagName=='BUTTON'&&!tg.closest('#rbItems')){h=0}else pick(ST.sel<0?null:L[ST.sel]?.id)}
 else if(k=='s'||k=='S'){save()}else if(k=='l'||k=='L'){savedShow($('rbSaved').hidden)}else if(k=='/'){$('rbQ').focus()}else h=0;
 if(h){e.preventDefault();e.stopPropagation()}}
function poll(){if(!ST.el)return;const g=[...(navigator.getGamepads?.()||[])].find(x=>x&&x.connected);if(g){const b=g.buttons.map(x=>x.pressed||x.value>.5),P=ST.padPrev,dn=i=>b[i]&&!P[i];
 const fire=k=>key({key:k,target:document.body,preventDefault(){},stopPropagation(){}});
 if(ST.dlg){if(dn(0))ST.dlg.ok();if(dn(1))ST.dlg.cancel()}else{if(dn(12))fire('ArrowUp');if(dn(13))fire('ArrowDown');if(dn(14)||dn(4))fire('ArrowLeft');if(dn(15)||dn(5))fire('ArrowRight');if(dn(0))fire('Enter');if(dn(3))save();if(dn(2))savedShow($('rbSaved').hidden);if(dn(1))fire('Escape')}ST.padPrev=b}
 ST.pad=setTimeout(poll,60)}
function tab(t){ST.tab=t;ST.el.dataset.tab=t;ST.el.querySelectorAll('#rbTabs button').forEach(b=>{b.classList.toggle('on',b.dataset.t==t);b.setAttribute('aria-pressed',b.dataset.t==t)});if(t=='saved')savedShow(true)}
// ---------- open / close ----------
function api(){return {VER,ST,C,S,open,close,slot,pick,save,load,newRig,rename,duplicate,remove,exportText,download,importText,refresh,savedShow,ask,showroomRigs,catalogue,tab,assemble3d,lod,R3,stage:()=>ST.stage,isOpen:()=>!!ST.el}}
export async function open(){if(ST.el)return;pin();if(!$('rbCss')){const s=document.createElement('style');s.id='rbCss';s.textContent=CSS;document.head.appendChild(s)}await catalogue();await refresh();
 const el=ST.el=document.createElement('section');el.id='rigBuilder';el.setAttribute('role','dialog');el.setAttribute('aria-label','Rig builder');el.dataset.tab='build';
 el.innerHTML=`<div id=rbTop><span class=tt>RIG BUILDER<span class=sim>SIM</span></span><span id=rbCur style="color:#8b949d;font-size:12px;max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span><button id=rbNew>New</button><button id=rbOpenSaved aria-expanded=false>Saved rigs</button><button id=rbX aria-label="Close (Esc)">✕</button></div>
<div id=rbTabs><button data-t=build class=on>Build</button><button data-t=specs>Specs & BOM</button><button data-t=saved>Saved</button></div>
<div id=rbMain><div id=rbCat><div id=rbSlots role=tablist aria-label="Rig slots"></div><input id=rbQ type=search placeholder="Filter parts ( / )" aria-label="Filter parts"><div id=rbItems role=listbox aria-label="Parts"></div></div>
<div id=rbCenter><div id=rbSvg><div id=rb3Lbl></div><div id=rb3Miss></div><div id=rbLoad3>Loading part models…</div><div id=rb3Help>Drag to turn · Scroll or pinch to zoom · Select a part to edit its slot</div></div><div id=rbQty></div><div id=rbNameRow><input id=rbName maxlength=80 placeholder="Rig name, for example George special" aria-label="Rig name"><button id=rbSave class=pri>Save</button><button id=rbShow>View in showroom</button><div id=rbErr role=alert></div></div>
<div id=rbHint>← → slot · ↑ ↓ part · Enter fit · S save · L saved rigs · Esc close · Pad: D-pad / LB RB · Ⓐ fit · Ⓨ save · Ⓧ saved · Ⓑ close</div></div>
<div id=rbRight><h4>Key specs <span class=sim>SIM</span></h4><div id=rbSpecs></div><div id=rbWarn></div><h4>Live BOM · <span id=rbBomN></span></h4><table id=rbBom></table><p style="color:#6f7880;font-size:11px">Generic SIM class values from the rig catalogue. Not a design for a real rig. Check against the maker's data before use.</p></div></div>
<div id=rbSaved hidden><div style="display:flex;gap:6px;align-items:center"><b style="flex:1;letter-spacing:.14em;font-weight:600">SAVED RIGS</b><button id=rbSavedX aria-label="Close saved rigs">✕</button></div>
<div style="display:flex;gap:6px;flex-wrap:wrap"><button id=rbExpAll>Export all</button><button id=rbImp>Import file</button><button id=rbPaste>Paste JSON</button><input id=rbFile type=file accept="application/json,.json" hidden></div><div id=rbList></div>
<small style="color:#6f7880">Stored on this device (${es(S.adapter().name)}). Share with Export, then Import on the other device.</small></div><div id=rbDlg hidden></div><div id=rbToast role=status></div>`;
 document.body.appendChild(el);ST.rig=C.defaults(ST.cat);ST.dirty=false;ST.k3=null;ST.stage=R3.stage($('rbSvg'),{phone:phoneish(),lod:lod()});ST.stage.onPick=k=>slot(k);
 $('rbX').onclick=close;$('rbNew').onclick=async()=>{if(ST.dirty&&!(await ask({t:'Start a new rig? Your changes that are not saved will be lost.',ok:'New rig'})))return;newRig()};$('rbOpenSaved').onclick=()=>savedShow($('rbSaved').hidden);$('rbSavedX').onclick=()=>{savedShow(false);if(ST.tab=='saved')tab('build')};
 $('rbSave').onclick=()=>save();$('rbShow').onclick=async()=>{if(await save())showInShowroom(ST.rig.id)};$('rbName').oninput=()=>{$('rbErr').textContent='';ST.dirty=true;renderRig()};
 $('rbQ').oninput=e=>{ST.q=e.target.value;ST.sel=0;renderCat()};$('rbExpAll').onclick=()=>{if(!ST.list.length)return toast('No saved rigs to export');download();toast('Exported '+ST.list.length+' rigs')};
 $('rbImp').onclick=()=>$('rbFile').click();$('rbPaste').onclick=importUI;$('rbFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const v=await importText(await f.text());if(!v.ok)toast(v.err);e.target.value=''};
 el.querySelectorAll('#rbTabs button').forEach(b=>b.onclick=()=>{if(b.dataset.t!='saved')savedShow(false);tab(b.dataset.t)});
 render();addEventListener('keydown',key,true);addEventListener('dw:home',close);ST.padPrev=[];poll()}
export function close(){if(!ST.el)return;ST.stage?.dispose();ST.stage=null;clearTimeout(ST.pad);removeEventListener('keydown',key,true);removeEventListener('dw:home',close);ST.el.remove();ST.el=null;ST.dlg=null}
// ---------- entry points: button beside the showroom selector (start screen + Settings), GX.rigBuilder ----------
function pin(){window.GX=window.GX||{};if(!window.GX.rigBuilder)window.GX.rigBuilder=api()}
function inject(){for(const id of ['srabStart','srabSet']){const s=$(id);if(s&&!s.querySelector('.rbOpen')){const b=document.createElement('button');b.type='button';b.className='rbOpen';b.id=id=='srabStart'?'rbBtnStart':'rbBtnSet';b.textContent='Rig builder';b.setAttribute('aria-label','Open the rig builder');
 b.onclick=e=>{e.preventDefault();e.stopPropagation();open()};s.appendChild(b)}}}
export function init(){if(typeof document=='undefined'||window.__rb)return;window.__rb=1;pin();catalogue();let n=0;const t=setInterval(()=>{pin();if(++n>120)clearInterval(t)},500);
 let q=0;new MutationObserver(()=>{if(q)return;q=1;requestAnimationFrame(()=>{q=0;inject()})}).observe(document.body,{childList:true,subtree:true});inject()}
if(typeof document!='undefined'){if(document.body)init();else addEventListener('DOMContentLoaded',init)}
