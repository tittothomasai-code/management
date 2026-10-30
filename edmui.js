// edmui.js v5.9.2.4: "Import EDM" — local file (.xml/.edm.xml/.zip) parsed in a Web Worker on this device (no upload).
// Default view: whole site/pad in 3D on a common site datum, with simplified anti-collision (SF, centre-to-centre). Tag IMPORT, never LIVE.
import * as THREE from 'three';import {OrbitControls} from './vendor/OrbitControls.js';
const ST={R:null,tab:'site',pick:null,busy:false};let P,R3=null;const $=s=>P.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const f1=v=>v==null||!Number.isFinite(v)?'–':v.toFixed(1);
const COL=['#4fc3f7','#ffb74d','#81c784','#e57373','#ba68c8','#fff176','#4db6ac','#f06292'];
function css(){const s=document.createElement('style');s.textContent=`#edm{position:fixed;inset:auto 0 52px 0;max-height:78vh;z-index:40;background:#0d1620f2;color:#dde;font:13px system-ui;border-top:2px solid #58a;border-radius:14px 14px 0 0;display:none;flex-direction:column;overflow:hidden}
#edm header{display:flex;align-items:center;gap:8px;padding:10px 12px}#edm header b{flex:1}#edm button{min-height:40px;padding:4px 12px;border-radius:8px;border:1px solid #58a;background:#123;color:#dde}
#edm nav{display:flex;gap:6px;overflow-x:auto;padding:0 10px 6px}#edm nav button{flex:0 0 auto}#edm nav button.sel{background:#2a5d8a}#edm .bd{overflow:auto;padding:6px 12px 12px;flex:1}
#edm table{border-collapse:collapse;width:100%;font-size:12px}#edm td,#edm th{padding:4px 5px;border-bottom:1px solid #2a3a4a;text-align:left}#edm .edmtag{background:#7a4ad0;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px}
#edm .stop{color:#ff6b6b;font-weight:700}#edm .warn{color:#ffc04d;font-weight:700}#edm .bar{height:8px;background:#234;border-radius:4px;overflow:hidden;margin:8px 0}#edm .bar i{display:block;height:100%;background:#4fc3f7;width:0}
#edm canvas{width:100%;height:34vh;display:block;border-radius:8px;background:#06101a;touch-action:none}#edm .drop{border:2px dashed #58a;border-radius:10px;padding:18px;text-align:center}
@media(min-width:900px){#edm{inset:60px 8px auto auto;width:640px;border:2px solid #58a;border-radius:8px}}`;document.head.appendChild(s)}
function ui(){if(P)return;css();P=document.createElement('div');P.id='edm';P.innerHTML=`<header><b>EDM import <span class=edmtag>IMPORT</span></b><button id=edmx aria-label=Close>✕</button></header>
<nav>${[['site','Site 3D'],['ac','Anti-collision'],['wells','Wells'],['well','Single well']].map(([k,l])=>`<button data-t=${k}>${l}</button>`).join('')}</nav><div class=bd id=edmbd></div>`;document.body.appendChild(P);
 $('#edmx').onclick=close;P.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{ST.tab=b.dataset.t;render()})}
function pickerHTML(){return `<div class=drop><p>Choose an EDM export (.xml, .edm.xml or .zip). It is read on this device only — nothing is uploaded.</p>
<input type=file id=edmf accept=".xml,.zip,application/xml,application/zip"> <label>Units in file <select id=edmu><option value=ft>ft (EDM default)</option><option value=m>m</option></select></label>
<div class=bar><i id=edmbar></i></div><div id=edmst>No file loaded.</div></div>`}
export function load(name,buf,units='ft'){return new Promise((res,rej)=>{let wk;try{wk=new Worker(new URL('./edmworker.js?v=5924',import.meta.url),{type:'module'})}catch(e){return rej(e)}ST.busy=true;
 wk.onmessage=e=>{const d=e.data;if(d.prog!=null){const b=P&&$('#edmbar'),s=P&&$('#edmst');if(b)b.style.width=Math.round(d.prog*100)+'%';if(s)s.textContent=d.msg+' · '+Math.round(d.prog*100)+'%'}
  if(d.error){ST.busy=false;wk.terminate();const s=P&&$('#edmst');if(s)s.textContent='Could not read file: '+d.error;rej(new Error(d.error))}
  if(d.done){ST.busy=false;wk.terminate();ST.R=d.done;ST.R.name=name;ST.tab='site';ST.pick=null;render();res(d.done)}};
 wk.postMessage({name,buf,units},[buf])})}
function scene3d(el){if(R3){R3.stop();R3=null}const A=ST.R.A,c=document.createElement('canvas');el.appendChild(c);const w=c.clientWidth||360,h=c.clientHeight||300;
 const r=new THREE.WebGLRenderer({canvas:c,antialias:true});r.setPixelRatio(Math.min(2,devicePixelRatio));r.setSize(w,h,false);const s=new THREE.Scene(),cam=new THREE.PerspectiveCamera(45,w/h,1,1e6);
 let mx=0,mz=0,ext=10;const all=A.wbs.flatMap(b=>b.pts);for(const p of all){mx=Math.max(mx,Math.abs(p.E),Math.abs(p.N));mz=Math.max(mz,p.Z)}ext=Math.max(mx,mz,100);
 // three: x=E, y=-Z (up), z=-N
 const v=p=>new THREE.Vector3(p.E,-p.Z,-p.N);A.wbs.forEach((b,i)=>{const g=new THREE.BufferGeometry().setFromPoints(b.pts.map(v));s.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:COL[i%COL.length]})));
  const m=new THREE.Mesh(new THREE.SphereGeometry(ext/150),new THREE.MeshBasicMaterial({color:COL[i%COL.length]}));m.position.copy(v(b.pts[0]));s.add(m)});
 for(const f of A.ac.flags){const a=A.wbs[f.a],b=A.wbs[f.b],pa=a.pts.reduce((x,p)=>Math.abs(p.md-f.mdRef)<Math.abs(x.md-f.mdRef)?p:x),pb=b.pts.reduce((x,p)=>Math.abs(p.md-f.mdOff)<Math.abs(x.md-f.mdOff)?p:x);
  const g=new THREE.BufferGeometry().setFromPoints([v(pa),v(pb)]);s.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:f.sf<1?0xff3030:0xffc040})));const m=new THREE.Mesh(new THREE.SphereGeometry(ext/80),new THREE.MeshBasicMaterial({color:f.sf<1?0xff3030:0xffc040,wireframe:true}));m.position.copy(v(pa));s.add(m)}
 const grid=new THREE.GridHelper(ext*2,20,0x335577,0x223344);s.add(grid);cam.position.set(ext*1.5,ext*0.1,ext*1.7);const ctl=new OrbitControls(cam,c);ctl.target.set(0,-mz*0.55,0);ctl.update();
 let on=true;const loop=()=>{if(!on)return;ctl.update();r.render(s,cam);requestAnimationFrame(loop)};loop();R3={stop(){on=false;r.dispose()},cam,ctl};}
export function render(){if(!P)return;P.querySelectorAll('nav button').forEach(b=>b.classList.toggle('sel',b.dataset.t==ST.tab));const bd=$('#edmbd'),R=ST.R;
 if(R3&&ST.tab!='site'){R3.stop();R3=null}
 if(!R){bd.innerHTML=pickerHTML();bindPicker();return}
 const A=R.A,M=R.M,head=`<div>File <b>${esc(R.name)}</b> · ${M.sites.length} site(s) · ${M.wells.length} wells · ${A.wbs.length} wellbores with trajectories · site datum ${f1(A.datum)} m · <span class=edmtag>IMPORT</span> <button id=edmnew>Other file</button></div>`;
 if(ST.tab=='site'){bd.innerHTML=head+`<p>Whole pad on a common site datum (site centre + slot offsets; TVD shifted to the highest well datum). Drag to orbit, pinch/scroll to zoom. Red = SF &lt; 1.0, amber = SF &lt; 1.5.</p><div id=edm3d></div>`+legend();try{scene3d($('#edm3d'))}catch(e){$('#edm3d').textContent='3D unavailable: '+e.message}}
 else if(ST.tab=='ac'){const n=A.wbs.length,C=A.ac.M;bd.innerHTML=head+`<p>${esc(A.ac.model)}. Planning aid only — not an approved anti-collision scan.</p>
  <h4>Closest approaches flagged</h4>${A.ac.flags.length?`<table><tr><th>Reference</th><th>Offset</th><th>SF</th><th>C-C m</th><th>MD ref m</th><th>TVD m</th><th></th></tr>${A.ac.flags.map(f=>`<tr><td>${esc(A.wbs[f.a].name)}</td><td>${esc(A.wbs[f.b].name)}</td><td class=${f.sf<1?'stop':'warn'}>${f.sf.toFixed(2)}</td><td>${f1(f.ctc)}</td><td>${f1(f.mdRef)}</td><td>${f1(f.tvd)}</td><td class=${f.sf<1?'stop':'warn'}>${f.flag}</td></tr>`).join('')}</table>`:'<p>No pair below SF 1.5.</p>'}
  <h4>SF matrix (centre-to-centre m)</h4><table><tr><th></th>${A.wbs.map((b,j)=>`<th>#${j+1}</th>`).join('')}</tr>${A.wbs.map((b,i)=>`<tr><th>#${i+1} ${esc(b.name)}</th>${A.wbs.map((x,j)=>{const c=C[i][j];return `<td class=${c?c.sf<1?'stop':c.sf<1.5?'warn':'':''}>${c?c.sf.toFixed(2)+'<br><small>'+f1(c.ctc)+'</small>':'–'}</td>`}).join('')}</tr>`).join('')}</table>`}
 else if(ST.tab=='wells'){bd.innerHTML=head+`<table><tr><th>Well</th><th>Slot</th><th>Datum m</th><th>Trajectory</th><th>TD m</th><th>TVD m</th><th></th></tr>${A.wbs.map((b,i)=>{const w=M.wells.find(x=>x.id==b.well)||{};return `<tr><td><span style="color:${COL[i%COL.length]}">●</span> ${esc(b.name)}</td><td>${esc(w.slot||'–')}</td><td>${f1(w.datum)}</td><td>${b.kind}</td><td>${f1(b.pts.at(-1).md)}</td><td>${f1(b.pts.at(-1).Z)}</td><td><button data-pick="${i}">Open</button></td></tr>`}).join('')}</table>`;bd.querySelectorAll('[data-pick]').forEach(x=>x.onclick=()=>{ST.pick=+x.dataset.pick;ST.tab='well';render()})}
 else{const i=ST.pick??0,b=A.wbs[i];if(!b){bd.innerHTML=head+'<p>No wellbore with a trajectory.</p>'}else{const ts=M.traj.filter(t=>t.wb==b.wbId),cs=M.casing.filter(c=>c.wb==b.wbId),bh=M.bha.filter(c=>c.wb==b.wbId),tg=M.targets.filter(t=>t.wb==b.wbId||t.well==b.well);
  bd.innerHTML=head+`<label>Well <select id=edmsel>${A.wbs.map((x,j)=>`<option value=${j} ${j==i?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
  <h4>Trajectories</h4><table><tr><th>Kind</th><th>Name</th><th>Stations</th><th>TD m</th></tr>${ts.map(t=>`<tr><td>${t.kind}</td><td>${esc(t.name)}</td><td>${t.st.length}</td><td>${f1(t.st.at(-1)?.md)}</td></tr>`).join('')}</table>
  <h4>Casing</h4>${cs.length?`<table><tr><th>String</th><th>OD in</th><th>Top m</th><th>Shoe m</th></tr>${cs.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.od??'–'}</td><td>${f1(c.top)}</td><td>${f1(c.shoe)}</td></tr>`).join('')}</table>`:'<p>none</p>'}
  <h4>BHA</h4>${bh.length?bh.map(a=>`<p><b>${esc(a.name)}</b>: ${a.comps.map(c=>esc(c.type)+(c.od?' '+c.od+'in':'')+(c.len?' '+f1(c.len)+' m':'')).join(' · ')}</p>`).join(''):'<p>none</p>'}
  <h4>Targets</h4>${tg.length?`<table><tr><th>Name</th><th>TVD m</th><th>N m</th><th>E m</th><th>Radius m</th></tr>${tg.map(t=>`<tr><td>${esc(t.name)}</td><td>${f1(t.tvd)}</td><td>${f1(t.dN)}</td><td>${f1(t.dE)}</td><td>${f1(t.r)}</td></tr>`).join('')}</table>`:'<p>none</p>'}
  <h4>Stations (${b.kind}, site frame)</h4><table><tr><th>MD m</th><th>E m</th><th>N m</th><th>TVD m</th></tr>${b.pts.filter((p,k)=>k%Math.ceil(b.pts.length/40)==0||k==b.pts.length-1).map(p=>`<tr><td>${f1(p.md)}</td><td>${f1(p.E)}</td><td>${f1(p.N)}</td><td>${f1(p.Z)}</td></tr>`).join('')}</table>`;
  $('#edmsel').onchange=e=>{ST.pick=+e.target.value;render()}}}
 const nb=$('#edmnew');if(nb)nb.onclick=()=>{ST.R=null;render()}}
const legend=()=>`<div>${ST.R.A.wbs.map((b,i)=>`<span style="color:${COL[i%COL.length]}">● ${esc(b.name)}</span>`).join(' &nbsp; ')}</div>`;
function bindPicker(){const f=$('#edmf');f.onchange=async()=>{const x=f.files[0];if(!x)return;$('#edmst').textContent='Reading '+x.name+' ('+(x.size/1e6).toFixed(1)+' MB) …';try{await load(x.name,await x.arrayBuffer(),$('#edmu').value)}catch(e){}}}
export function open(){init();ui();render();P.dataset.uidisp='flex';if(window.GX?.ui?.show)window.GX.ui.show(P);else P.style.display='flex'}
export function close(){if(R3){R3.stop();R3=null}if(P)P.style.display='none'}
export function init(){window.GX=window.GX||{};window.GX.edm={ST,open,close,load,render}}
init();
