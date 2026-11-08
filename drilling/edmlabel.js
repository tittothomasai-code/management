// edmlabel.js v5.10.x (feat/edm-labels): clickable wellhead labels in EDM "Site 3D" (edmui.js scene3d).
// Each wellhead gets a name label that follows the 3D view; tap/click a label or the wellhead sphere (three.js Raycaster)
// to open a details card: well name, slot, status, TD (MD/TVD), last survey station, closest offset separation factor (SF).
// Data comes only from the GX.edm API (GX.edm.ST.R = parsed import; A = site frame + anti-collision matrix from ac.js).
// Imported data is tagged IMPORT (never LIVE). Metric. SF = simplified planning-grade value from ac.js, not an ISCWSA scan.
import * as THREE from 'three';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1=v=>v==null||!Number.isFinite(+v)?'–':(+v).toFixed(1);
let L=null;
function css(){if(document.getElementById('elcss'))return;const s=document.createElement('style');s.id='elcss';s.textContent=`
.edmLW{position:relative}.edmLbls{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.edmLbl{position:absolute;transform:translate(-50%,-130%);pointer-events:auto;background:#0d1620e0;color:#e8f4ff;border:1px solid #58a;border-radius:6px;padding:2px 7px;font:600 11px system-ui;white-space:nowrap;cursor:pointer;min-height:24px;line-height:20px}
.edmLbl.sel{background:#2a5d8a;border-color:#9cf}.edmLbl i{display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:4px}
#edmCard{position:absolute;left:8px;top:8px;max-width:min(300px,calc(100% - 16px));background:#0d1620f4;color:#dde;border:1px solid #58a;border-radius:8px;padding:8px 10px;font:12px system-ui;z-index:2;pointer-events:auto}
#edmCard table{width:100%;border-collapse:collapse}#edmCard th{text-align:left;color:#9bd;font-weight:500;padding:2px 6px 2px 0}#edmCard td{padding:2px 0}
#edmCard .x{float:right;min-width:40px;min-height:32px;border-radius:6px;border:1px solid #58a;background:#123;color:#dde}#edmCard .stop{color:#ff6b6b;font-weight:700}#edmCard .warn{color:#ffc04d;font-weight:700}`;document.head.appendChild(s)}
// details for wellbore index i of the site frame
export function details(i){const R=window.GX?.edm?.ST?.R;if(!R?.A)return null;const A=R.A,M=R.M,b=A.wbs[i];if(!b)return null;const w=M.wells.find(x=>x.id==b.well)||{};
 const ts=M.traj.filter(t=>t.wb==b.wbId),sv=ts.find(t=>t.kind=='definitive')||ts.find(t=>t.kind=='survey'),last=sv?.pts?.at(-1)||null,end=b.pts.at(-1);
 const status=sv?'Drilled (survey)':ts.some(t=>t.kind=='plan')?'Planned':'No trajectory';
 let sf=null;const row=A.ac?.M?.[i];if(row)row.forEach((c,j)=>{if(c&&j!=i&&(!sf||c.sf<sf.sf))sf={sf:c.sf,ctc:c.ctc,name:A.wbs[j].name}});
 return {name:b.name,slot:w.slot||null,status,kind:b.kind,td:end.md,tvd:end.Z,last:last?{md:last.md,inc:last.inc,azi:last.azi,tvd:last.tvd,src:sv.name}:null,sf,tag:'IMPORT'}}
function card(i){const d=details(i);const box=L.wrap;let c=box.querySelector('#edmCard');if(!d){c?.remove();return}if(!c){c=document.createElement('div');c.id='edmCard';box.appendChild(c)}
 const sfc=d.sf?(d.sf.sf<1?'stop':d.sf.sf<1.5?'warn':''):'';
 c.innerHTML=`<button class=x aria-label="Close details">✕</button><b>${esc(d.name)}</b> <span class=edmtag>IMPORT</span><table>
<tr><th>Slot</th><td>${esc(d.slot||'–')}</td></tr><tr><th>Status</th><td>${esc(d.status)}</td></tr><tr><th>TD</th><td>${f1(d.td)} m MD · ${f1(d.tvd)} m TVD (${esc(d.kind)})</td></tr>
<tr><th>Last survey</th><td>${d.last?`${f1(d.last.md)} m MD · inc ${f1(d.last.inc)}° · az ${f1(d.last.azi)}°`:'none'}</td></tr>
<tr><th>Closest offset</th><td>${d.sf?`<span class=${sfc}>SF ${d.sf.sf.toFixed(2)}</span> · ${f1(d.sf.ctc)} m C-C · ${esc(d.sf.name)}`:'–'}</td></tr></table><small>SF: simplified planning value, not an approved anti-collision scan.</small>`;
 c.querySelector('.x').onclick=e=>{e.stopPropagation();select(null)};L.sel=i;L.lbls.forEach((e,j)=>e.classList.toggle('sel',j===i))}
export function select(i){if(!L)return;if(i==null){L.wrap.querySelector('#edmCard')?.remove();L.sel=null;L.lbls.forEach(e=>e.classList.remove('sel'));return}card(i)}
export function attach({c,s,cam,A}){css();detach();const wrap=c.parentElement;wrap.classList.add('edmLW');const ov=document.createElement('div');ov.className='edmLbls';wrap.appendChild(ov);
 const heads=[];s.traverse(o=>{if(o.isMesh&&o.userData.edmWb!=null)heads[o.userData.edmWb]=o});
 const lbls=A.wbs.map((b,i)=>{const e=document.createElement('button');e.className='edmLbl';e.dataset.i=i;const col=heads[i]?.material?.color?.getStyle?.()||'#fff';e.innerHTML=`<i style="background:${col}"></i>${esc(b.name)}`;e.setAttribute('aria-label','Well details: '+b.name);
  e.onclick=ev=>{ev.stopPropagation();select(i)};ov.appendChild(e);return e});
 const ray=new THREE.Raycaster(),v=new THREE.Vector2();let down=null;
 const pd=e=>{down=[e.clientX,e.clientY]},pu=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=c.getBoundingClientRect();v.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(v,cam);
  const hit=ray.intersectObjects(heads.filter(Boolean),false)[0];if(hit)select(hit.object.userData.edmWb)};
 c.addEventListener('pointerdown',pd);c.addEventListener('pointerup',pu);
 const p=new THREE.Vector3();let on=true;const loop=()=>{if(!on)return;if(!c.isConnected){if(L&&L.ov===ov)detach();else on=false;return}const W=c.clientWidth,H=c.clientHeight;cam.updateMatrixWorld();
  lbls.forEach((e,i)=>{const h=heads[i];if(!h)return;p.copy(h.position).project(cam);const vis=p.z<1&&Math.abs(p.x)<=1.05&&Math.abs(p.y)<=1.05;e.style.display=vis?'':'none';if(vis){e.style.left=((p.x+1)/2*W)+'px';e.style.top=((1-p.y)/2*H)+'px'}});requestAnimationFrame(loop)};
 L={wrap,ov,lbls,heads,sel:null,stop(){on=false;c.removeEventListener('pointerdown',pd);c.removeEventListener('pointerup',pu);ov.remove();wrap.querySelector('#edmCard')?.remove()},cam};loop();
 window.GX=window.GX||{};window.GX.edmlabel={attach,detach,select,details,state:()=>L&&{n:lbls.length,sel:L.sel},_cam:()=>L?.cam};return L}
export function detach(){if(L){L.stop();L=null}}
