// srassets.js (v5.12.2.1): Showroom A's "Assets" slide-out curtain, ported as a shared component so it outlives A's screen.
// Same look and behaviour as A (showroom.js #srDrw): vertical "☰ Assets" tab on the right edge (bottom sheet on phones),
// "◀ Back" + rig name crumb, table Asset | Type | Key spec | BOM, tap a row to zoom in (row expands to its parts), tap it again to close.
// mount(host,{rig:()=>({name}), assets:()=>[{k,name,type,spec,bom,comps:[{n,spec,lines}]}], onSel(k|null), onComp(k,i), narrow:()=>bool})
const es=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const CSS=`.srAs{position:absolute;z-index:8;top:calc(56px + env(safe-area-inset-top));right:0;bottom:calc(76px + env(safe-area-inset-bottom));width:min(400px,88vw);background:rgba(6,16,32,.94);border-left:1px solid #3a6a9a;transform:translateX(100%);transition:transform .3s ease;display:flex;flex-direction:column;box-sizing:border-box;color:#e8f0ff;font:13px system-ui,sans-serif}
.srAs.open{transform:none}.srAs .srAsHdl{position:absolute;left:-44px;top:40%;width:44px;min-height:80px!important;min-width:0!important;padding:4px!important;border-radius:10px 0 0 10px!important;writing-mode:vertical-rl;font-size:12px!important}
.srAs .srAsCrumb{padding:8px 10px;font-size:13px;border-bottom:1px solid #2a4a6a;display:flex;gap:6px;align-items:center;flex-wrap:wrap}.srAs .srAsCrumb a{color:#7fe3ff;cursor:pointer;text-decoration:underline}.srAs .srAsCrumb button{min-height:30px!important;padding:2px 10px!important}
.srAs .srAsList{overflow:auto;flex:1}.srAs table{width:100%;border-collapse:collapse;font-size:12.5px}.srAs th{text-align:left;position:sticky;top:0;background:#0c1d33;padding:6px;font-weight:600;opacity:.8}.srAs td{padding:7px 6px;border-bottom:1px solid #1d3550;vertical-align:top}
.srAs tr.b{cursor:pointer}.srAs tr.b:hover,.srAs tr.on{background:#14365a}.srAs tr.c{cursor:pointer;background:#0a1a2c}.srAs tr.c td:first-child{padding-left:22px}.srAs tr.c.on{background:#1d4a2a}
.srAs.narrow{top:auto;left:0;right:0;bottom:0;width:auto;height:58vh;border-left:0;border-top:1px solid #3a6a9a;border-radius:14px 14px 0 0;transform:translateY(100%)}.srAs.narrow.open{transform:none}
.srAs.narrow .srAsHdl{left:50%;top:-40px;transform:translateX(-50%);writing-mode:horizontal-tb;width:auto;min-height:40px!important;border-radius:10px 10px 0 0!important;padding:4px 16px!important}`;
export function mount(host,o){if(!document.getElementById('srAsCss')){const s=document.createElement('style');s.id='srAsCss';s.textContent=CSS;document.head.appendChild(s)}
 const el=document.createElement('aside');el.className='srAs';el.id=(o.id||'srAs');el.setAttribute('aria-label','Rig assets');
 el.innerHTML=`<button class=srAsHdl id=${el.id}Hdl aria-label="Open or close the asset table" aria-expanded=false>☰ Assets</button><div class=srAsCrumb></div><div class=srAsList></div>`;host.appendChild(el);
 const S={open:false,k:null,c:null,el};const q=c=>el.querySelector(c);
 const lay=()=>el.classList.toggle('narrow',!!o.narrow?.());
 function render(){lay();const r=o.rig()||{},A=o.assets()||[],cur=A.find(a=>a.k==S.k);
  q('.srAsCrumb').innerHTML=`<button class=srAsBack aria-label=Back>◀ Back</button><a data-l=0>${es(r.name)}</a>`+(cur?` › <a data-l=1>${es(cur.name)}</a>`:'');
  q('.srAsBack').onclick=back;q('.srAsCrumb').querySelectorAll('a').forEach(a=>a.onclick=()=>{if(a.dataset.l=='0')sel(null);else{S.c=null;render()}});
  q('.srAsList').innerHTML=`<table><tr><th>Asset</th><th>Type</th><th>Key spec</th><th>BOM</th></tr>`+A.map(a=>{const op=S.k==a.k;
   return `<tr class="b${op?' on':''}" data-k="${es(a.k)}"><td>${op?'▾':'▸'} ${es(a.name)}</td><td>${es(a.type)}</td><td>${es(a.spec)}</td><td>${es(a.bom)}</td></tr>`+(op?(a.comps||[]).map((c,i)=>`<tr class="c${S.c==i?' on':''}" data-c="${i}"><td>${es(c.n)}</td><td colspan=2>${es(c.spec||'')}</td><td>${es(c.lines??1)}</td></tr>`).join(''):'')}).join('')+`</table><div style="font-size:11px;opacity:.6;padding:6px">Generic SIM values. Tap a row to zoom; tap again to close.</div>`;
  q('.srAsList').querySelectorAll('tr.b').forEach(tr=>{const k=tr.dataset.k;tr.onclick=()=>{if(S.k==k)back();else sel(k)}});
  q('.srAsList').querySelectorAll('tr.c').forEach(tr=>tr.onclick=()=>{S.c=+tr.dataset.c;o.onComp?.(S.k,S.c);render()})}
 function sel(k){S.k=k;S.c=null;o.onSel?.(k);render()}
 function back(){if(S.c!=null){S.c=null;o.onSel?.(S.k);render()}else if(S.k)sel(null);else drawer(false)}
 function drawer(on){S.open=on==null?!S.open:!!on;el.classList.toggle('open',S.open);q('.srAsHdl').setAttribute('aria-expanded',S.open);if(!S.open){if(S.k){S.k=null;S.c=null;o.onSel?.(null)}return S.open}o.onOpen?.();render();return S.open}
 q('.srAsHdl').onclick=e=>{e.stopPropagation();drawer()};['pointerdown','wheel','keydown'].forEach(t=>el.addEventListener(t,e=>e.stopPropagation(),{passive:true}));
 addEventListener('resize',lay);lay();
 return Object.assign(S,{drawer,sel,back,render,refresh:()=>{if(S.k&&!(o.assets()||[]).some(a=>a.k==S.k)){S.k=null;S.c=null}if(S.open)render()}})}
// ---- shared data helpers: rows from a componentPath -> BOM map (B rigs, C detail rig) ----
export const TYPE=[[/mast|derrick|substructure|floor|leg|hull|deck|column|pontoon|frame|chassis|stair|handrail|catwalk|vdoor/,'Structure'],[/drawworks|crown|block|hoist|mast_raise|winch|crane/,'Hoisting'],[/top_drive|rotary|kelly/,'Rotary'],[/pump|mud|shaker|tank|degass|desand|circul/,'Circulating'],[/bop|choke|kill|accum|koomey|diverter|well_control/,'Well control'],[/pipe|tubular|rack|roughneck|reel|injector|coil|snub/,'Tubulars'],[/gen|power|vfd|engine|switch|fuel/,'Power'],[/doghouse|cabin|console|driller/,'Control'],[/light/,'Lighting'],[/frac|blender|missile|iron/,'Pressure pumping']];
export const typeOf=p=>{const n=p.toLowerCase();for(const [re,t] of TYPE)if(re.test(n))return t;return 'Equipment'};
export function specOf(p,st){const t=typeOf(p),n=p.toLowerCase();if(/mast|derrick/.test(n))return `${st.hook} t hook load`;if(/drawworks/.test(n))return `${st.kw} kW`;if(/block|crown/.test(n))return `Rated ${st.hook} t`;if(/top_drive/.test(n))return 'Up to 250 rpm';if(t=='Well control')return `${(st.bop||10000).toLocaleString('en-US')} psi`;if(/pump/.test(n))return `${st.pumps||'Triplex pumps'}`;if(t=='Power')return `${st.kw} kW total`;if(/substructure|floor/.test(n))return `${st.depth} m depth rating`;return st.short||'Generic'}
const nice0=s=>s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
export function fromTree(m,st,pretty=nice0){const P=Object.keys(m),dep=p=>p.split('/').length,kids=pre=>P.filter(p=>dep(p)==(pre?dep(pre)+1:1)&&(!pre||p.startsWith(pre+'/'))),under=p=>P.filter(x=>x==p||x.startsWith(p+'/')).length;
 return kids('').map(p=>({k:p,name:pretty(p.split('/').pop()),type:typeOf(p),spec:specOf(p,st),bom:under(p),comps:kids(p).map(c=>({n:pretty(c.split('/').pop()),spec:m[c]||'',lines:under(c),path:c}))}))}
