// bom.js v1: Workshop 'BOM' tab — bill of materials table for each exploded-view model (data in bom_data.js).
// Row tap highlights the 3D part; 3D/label tap highlights the row (hook in ext12 hi()). CSV export. All values SIM.
import {BOM,RIG,names,walk,asset} from './bom_data.js?v=1';
let W,$;const es=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function rows(k){const E=W.CAT[k],d=BOM[k]||[];return E.parts.map((p,i)=>({no:i+1,part:p.n,qty:d[i]?.[0]??1,spec:d[i]?.[1]??'Generic',fn:d[i]?.[2]??p.ds,src:'SIM',i}))}
const q=v=>{v=String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
export function csv(k){const E=W.CAT[k];return ['Item no.,Part name,Qty,Material / spec,Function,3D part,Source',...rows(k).map(r=>[r.no,r.part,r.qty,r.spec,r.fn,'part#'+r.i,'SIM'].map(q).join(','))].join('\n')+'\n# '+E.label+' - SIM generic values, not drawings for this rig\n'}
export function download(k){k=k||W.ST.eq;const t=csv(k),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download='bom_'+k+'_SIM.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);window.__bomLast={name:a.download,text:t};return a.download}
function css(){const s=document.createElement('style');s.textContent=`#bomT{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}#bomT th,#bomT td{text-align:left!important;padding:4px 3px;border-bottom:1px solid #223;vertical-align:top;overflow-wrap:anywhere}
#bomT tr.bom{cursor:pointer}#bomT tr.on td{background:#2a6f97;color:#fff}#bomT .c1{width:26px}#bomT .c3{width:30px}#bomT .c6{width:40px}#bomT a{color:#7cf}
@media (max-width:899px){#bomT .fn{display:none}#bomT tr.on+tr.fnr{display:table-row}}#bomT tr.fnr{display:none}#bomT tr.fnr td{color:#9ab;font-size:11px}`;document.head.appendChild(s)}
export function ui(){const ST=W.ST,E=W.CAT[ST.eq];if(!E)return;
 $('wsBody').innerHTML=`<div class="row"><b>BOM — ${es(E.label)}</b><span class="wsSim">SIM generic parts — not this rig's drawings</span></div>
<div class="row"><select id="bomEq">${Object.entries(W.CAT).map(([k,v])=>`<option value="${k}"${k==ST.eq?' selected':''}>${es(v.label)}</option>`).join('')}</select><button id="bomCsv">⬇ CSV</button></div>
<div style="color:#9ab;font-size:12px">Tap a row to show the part in 3D. Tap a part to find its row.</div>
<table id="bomT"><thead><tr><th class="c1">No.</th><th>Part</th><th class="c3">Qty</th><th>Material / spec</th><th class="fn">Function</th><th class="c6">3D</th></tr></thead><tbody>${rows(ST.eq).map(r=>`<tr class="bom" data-i="${r.i}"><td>${r.no}</td><td>${es(r.part)}</td><td>${r.qty}</td><td>${es(r.spec)} <span class="wsSim">SIM</span></td><td class="fn">${es(r.fn)}</td><td><a href="#part${r.i}" data-i="${r.i}">▶ ${r.i+1}</a></td></tr><tr class="fnr"><td></td><td colspan="5">${es(r.fn)}</td></tr>`).join('')}</tbody></table>`;
 $('bomEq').onchange=e=>{ST.eq=e.target.value;ST.built='';ui();W.layout()};$('bomCsv').onclick=()=>download();
 $('bomT').querySelectorAll('tr.bom').forEach(tr=>tr.onclick=e=>{e.preventDefault();W.showPart(+tr.dataset.i)});
 if(!ST.meshes.length||ST.built!='bom:'+ST.eq){ST.t=1;ST.target=1;W.buildExp();ST.built='bom:'+ST.eq}onHi(ST.sel)}
export function onHi(i){const t=$('bomT');if(!t)return;t.querySelectorAll('tr.bom').forEach(tr=>{const on=+tr.dataset.i==i;tr.classList.toggle('on',on);if(on&&W.ST.mode=='bom')tr.scrollIntoView?.({block:'nearest'})})}
export function init(ws){W=ws;$=ws.$;css();const b=document.createElement('button');b.id='wsBom';b.textContent='📋 BOM';b.onclick=()=>W.setMode('bom');$('wsBha').after(b);
 names(W.CAT);window.GX.bom={ui,onHi,rows,csv,download,BOM,RIG,walk,asset}}
