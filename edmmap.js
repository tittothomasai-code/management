// edmmap.js v5.9.4.1: every imported EDM site and well at its real position in 3D (local metres about the data centroid, from lat/long).
// Tap/click any wellhead or well path for all its details; decluttered labels (sites when zoomed out, wells when zoomed in); hover card on desktop.
// Data stays on this device. Tagged IMPORT, never LIVE. Metric.
import * as THREE from 'three';import {OrbitControls} from './vendor/OrbitControls.js';import {matrix} from './ac.js?v=5924';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1=v=>v==null||!Number.isFinite(+v)?'–':(+v).toFixed(1),f0=v=>v==null||!Number.isFinite(+v)?'–':Math.round(+v).toLocaleString('en-AU'),fl=v=>v==null?'–':(+v).toFixed(6);
const SC={Drilled:0x4fc3f7,Planned:0xffb74d,'No trajectory':0x9e9e9e},OUT=0xff5ab4;
let M=null;
function css(){if(document.getElementById('emcss'))return;const s=document.createElement('style');s.id='emcss';s.textContent=`
#edmmap{position:fixed;inset:0;z-index:9700;background:#06101a;color:#dde;font:13px system-ui;display:flex;flex-direction:column}
#edmmap .bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;background:#0d1620ee;border-bottom:1px solid #2a4a6a;z-index:3}
#edmmap .bar b{font-size:14px}#edmmap button,#edmmap select{min-height:38px;padding:4px 10px;border-radius:8px;border:1px solid #58a;background:#123;color:#dde;font:inherit}
#edmmap input{min-height:36px;border-radius:8px;border:1px solid #58a;background:#081420;color:#dde;padding:0 10px;font:inherit;width:min(260px,46vw)}
#edmmap .tag{position:static!important;display:inline-block;margin-left:6px;vertical-align:middle;background:#7a4ad0;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px}#edmmap .cnt{opacity:.85}#edmmap .sp{flex:1}
#emwrap{position:relative;flex:1;min-height:0}#emc{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
#emlab{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.eml{position:absolute;left:0;top:0;white-space:nowrap;font-size:11px;line-height:16px;padding:0 5px;border-radius:4px;background:#0a1a2acc;border:1px solid #3a6a9a;color:#e8f4ff;pointer-events:auto;cursor:pointer;transform-origin:0 0}
.eml.site{font-size:12px;font-weight:700;border-color:#ffd54f;color:#fff3c4}.eml.sel{background:#2a5d8a;border-color:#fff}
#emhov{position:absolute;display:none;pointer-events:none;background:#0d1620f4;border:1px solid #58a;border-radius:8px;padding:8px 10px;max-width:280px;z-index:4;font-size:12px;line-height:1.45}
#emres{position:absolute;top:0;left:10px;z-index:5;background:#0d1620f8;border:1px solid #58a;border-radius:8px;max-height:50vh;overflow:auto;display:none;min-width:240px}
#emres button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #234;border-radius:0}
#emdet{position:absolute;z-index:6;background:#0d1620f6;border:2px solid #58a;display:none;flex-direction:column;overflow:hidden;right:8px;top:8px;bottom:8px;width:430px;border-radius:10px}
#emdet header{display:flex;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid #2a4a6a}#emdet header b{flex:1;font-size:15px}
#emdet .bd{overflow:auto;padding:8px 12px 16px;flex:1}#emdet table{border-collapse:collapse;width:100%;font-size:12px;margin:4px 0}#emdet td,#emdet th{padding:3px 5px;border-bottom:1px solid #22344a;text-align:left;vertical-align:top}
#emdet th{color:#9cc}#emdet h4{margin:12px 0 4px;color:#7fe3ff}#emdet details{border:1px solid #2a4a6a;border-radius:8px;margin:8px 0;padding:4px 8px}#emdet summary{cursor:pointer;font-weight:700;padding:6px 0}
#emdet .chip{display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;background:#234}#emdet .stop{color:#ff6b6b;font-weight:700}#emdet .warn{color:#ffc04d;font-weight:700}
#emleg{position:absolute;left:8px;bottom:8px;z-index:2;background:#0d1620cc;border-radius:8px;padding:4px 8px;font-size:11px;pointer-events:none}
#emnote{position:absolute;left:50%;transform:translateX(-50%);top:8px;z-index:2;background:#4a2a10ee;border:1px solid #ffb74d;border-radius:8px;padding:4px 10px;font-size:12px;display:none}
@media(max-width:820px){#emdet{left:0;right:0;bottom:0;top:auto;width:auto;height:58%;border-radius:14px 14px 0 0}#edmmap .bar{padding:6px}#edmmap .hidem{display:none}}`;document.head.appendChild(s)}
function dot(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.beginPath();x.arc(32,32,26,0,7);x.fillStyle='#fff';x.fill();x.lineWidth=6;x.strokeStyle='#000';x.stroke();const t=new THREE.CanvasTexture(c);return t}
export function close(){if(!M)return;M.on=false;M.ro?.disconnect();M.r.dispose();M.el.remove();removeEventListener('keydown',M.key,true);const cb=M.onClose;M=null;if(window.GX?.edmmap)window.GX.edmmap.open=false;cb?.()}
export function open(W,{onClose,saved}={}){close();css();const el=document.createElement('div');el.id='edmmap';
 const nW=W.wells.length,nS=W.sites.length,nB=W.wbs.length;
 el.innerHTML=`<div class=bar><b>EDM sites <span class=tag>IMPORT</span></b><span class=cnt id=emcnt>${nS.toLocaleString('en-AU')} sites · ${nW.toLocaleString('en-AU')} wells · ${nB.toLocaleString('en-AU')} wellbores</span><span class=sp></span>
 <input id=emq type=search placeholder="Find well or site" autocomplete=off aria-label="Find well or site"><button id=emlist>Sites</button><button id=emfit title="Frame all sites">Fit all</button>${W.outliers?`<button id=emout class=hidem title="Wells whose coordinates are far from the rest">Outliers (${W.outliers})</button>`:''}
 <label class=hidem>VE <select id=emve aria-label="Vertical exaggeration">${[1,2,5,10,20,50].map(v=>`<option>${v}</option>`).join('')}</select></label><span id=emsv class=hidem>${esc(saved||'')}</span><button id=emx aria-label="Close sites view">✕</button></div>
 <div id=emwrap><canvas id=emc></canvas><div id=emlab></div><div id=emhov></div><div id=emres></div><div id=emnote></div>
 <div id=emleg><span style="color:#4fc3f7">● Drilled</span> &nbsp;<span style="color:#ffb74d">● Planned</span> &nbsp;<span style="color:#9e9e9e">● No trajectory</span>${W.outliers?' &nbsp;<span style="color:#ff5ab4">● position outlier</span>':''} &nbsp;<span style="color:#ffd54f">◎ site</span> · depth ×<span id=emvel>1</span></div>
 <div id=emdet role=dialog aria-label="Details"><header><b id=emdt></b><button id=emback style="display:none">← Site</button><button id=emdx aria-label="Close details">✕</button></header><div class=bd id=emdb></div></div></div>`;
 document.body.appendChild(el);const $=s=>el.querySelector(s),c=$('#emc');
 const r=new THREE.WebGLRenderer({canvas:c,antialias:true});r.setPixelRatio(Math.min(2,devicePixelRatio));const s=new THREE.Scene();s.background=new THREE.Color(0x06101a);
 const B=W.bounds,cx=(B.e0+B.e1)/2,cy=(B.n0+B.n1)/2,ext=Math.max(B.e1-B.e0,B.n1-B.n0,200);
 const ve0=Math.max(1,Math.min(50,[1,2,5,10,20,50].reduce((a,v)=>v<=ext/(Math.max(B.maxDepth,100)*6)?v:a,1)));
 const cam=new THREE.PerspectiveCamera(50,1,1,1e8);const ctl=new OrbitControls(cam,c);ctl.enableDamping=false;ctl.screenSpacePanning=false;ctl.maxPolarAngle=Math.PI*0.495;ctl.zoomToCursor=true;
 // geometry — three: x=E, y=-Z*VE (up), z=-N
 const X=E=>E-cx,Zc=N=>-(N-cy);const col=new THREE.Color();const ST=window.GX?.edmmap||{};
 const wbI=W.wbs.map((b,i)=>i).filter(i=>W.wbs[i].path?.length>1);let nv=0;for(const i of wbI)nv+=(W.wbs[i].path.length-1)*2;
 const pp=new Float32Array(nv*3),pc=new Float32Array(nv*3),vwb=new Int32Array(nv);let k=0;
 const wellBy=new Map(W.wells.map((w,i)=>[w.id,i])),siteBy=new Map(W.sites.map((x,i)=>[x.id,i])),wbBy=new Map(W.wbs.map((b,i)=>[b.id,i]));
 for(const i of wbI){const b=W.wbs[i],w=W.wells[wellBy.get(b.well)];col.setHex(w?.outlier?OUT:SC[b.status=='Drilled (actual surveys)'?'Drilled':b.status]||0x9e9e9e);const P=b.path;
  for(let j=1;j<P.length;j++)for(const p of [P[j-1],P[j]]){pp[k*3]=X(p.E);pp[k*3+1]=-p.Z;pp[k*3+2]=Zc(p.N);pc[k*3]=col.r;pc[k*3+1]=col.g;pc[k*3+2]=col.b;vwb[k]=i;k++}}
 const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));pg.setAttribute('color',new THREE.BufferAttribute(pc,3));
 const paths=new THREE.LineSegments(pg,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.9}));const pgrp=new THREE.Group();pgrp.add(paths);s.add(pgrp);
 const tex=dot();const wp=new Float32Array(nW*3),wc=new Float32Array(nW*3);W.wells.forEach((w,i)=>{wp[i*3]=X(w.E);wp[i*3+1]=0;wp[i*3+2]=Zc(w.N);col.setHex(w.outlier?OUT:SC[w.status]||0x9e9e9e);wc[i*3]=col.r;wc[i*3+1]=col.g;wc[i*3+2]=col.b});
 const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.BufferAttribute(wp,3));wg.setAttribute('color',new THREE.BufferAttribute(wc,3));
 const heads=new THREE.Points(wg,new THREE.PointsMaterial({size:9,sizeAttenuation:false,vertexColors:true,map:tex,alphaTest:0.4,depthTest:false}));heads.renderOrder=2;s.add(heads);
 const sp=new Float32Array(nS*3);W.sites.forEach((x,i)=>{sp[i*3]=X(x.E);sp[i*3+1]=0;sp[i*3+2]=Zc(x.N)});const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
 const sitesP=new THREE.Points(sg,new THREE.PointsMaterial({size:16,sizeAttenuation:false,color:0xffd54f,map:tex,alphaTest:0.4,transparent:true,opacity:0.55,depthTest:false}));sitesP.renderOrder=1;s.add(sitesP);
 const grid=new THREE.GridHelper(ext*1.4,28,0x335577,0x1a2a3a);s.add(grid);
 const selG=new THREE.Group();s.add(selG);
 const st=M={on:true,el,r,s,cam,ctl,W,ve:ve0,sel:null,dirty:true,labels:[],mode:'sites',onClose,lastLab:0,key:null,ro:null};
 function setVE(v){st.ve=v;pgrp.scale.y=v;$('#emve').value=String(v);$('#emvel').textContent=v;st.dirty=true;drawSel()}
 function fit(b=W.bounds,keepDir=false){const ccx=(b.e0+b.e1)/2,ccy=(b.n0+b.n1)/2,R=Math.max(b.e1-b.e0,b.n1-b.n0,300)/2;const asp=cam.aspect,fov=cam.fov*Math.PI/360;
  const d=R/Math.tan(fov)/Math.min(1,asp)*1.25;const t=new THREE.Vector3(X(ccx),0,Zc(ccy));const dir=keepDir?cam.position.clone().sub(ctl.target).normalize():new THREE.Vector3(0,Math.sin(1.05),Math.cos(1.05));
  fly(t,t.clone().add(dir.multiplyScalar(d)))}
 let anim=null;function fly(t,p,ms=650){const t0=ctl.target.clone(),p0=cam.position.clone(),a=performance.now();anim=()=>{const u=Math.min(1,(performance.now()-a)/ms),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2;ctl.target.lerpVectors(t0,t,e);cam.position.lerpVectors(p0,p,e);st.dirty=true;if(u>=1)anim=null};
  cam.near=Math.max(0.5,p.distanceTo(t)/2000);cam.far=Math.max(1e6,p.distanceTo(t)*50);cam.updateProjectionMatrix()}
 function size(){const w=c.clientWidth||innerWidth,h=c.clientHeight||innerHeight;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();st.dirty=true}
 // projection helpers
 const v3=new THREE.Vector3();function proj(x,y,z){v3.set(x,y,z).project(cam);if(v3.z>1||v3.z<-1)return null;const w=c.clientWidth,h=c.clientHeight;return [(v3.x+1)/2*w,(1-v3.y)/2*h]}
 function nearest(px,py,rad){let best=null,bd=rad*rad;for(let i=0;i<nW;i++){const q=proj(wp[i*3],0,wp[i*3+2]);if(!q)continue;const d=(q[0]-px)**2+(q[1]-py)**2;if(d<bd){bd=d;best={kind:'well',i}}}
  if(best)return best;const step=nv>300000?2:1;for(let j=0;j<nv;j+=step){const q=proj(pp[j*3],pp[j*3+1]*st.ve,pp[j*3+2]);if(!q)continue;const d=(q[0]-px)**2+(q[1]-py)**2;if(d<bd){bd=d;best={kind:'wb',i:vwb[j]}}}
  if(best)return best;for(let i=0;i<nS;i++){const q=proj(sp[i*3],0,sp[i*3+2]);if(!q)continue;const d=(q[0]-px)**2+(q[1]-py)**2;if(d<bd*1.5){bd=d;best={kind:'site',i}}}return best}
 // selection highlight
 function drawSel(){selG.clear();const S=st.sel;if(!S)return;const add=(b,c2)=>{if(!b.path)return;const g=new THREE.BufferGeometry().setFromPoints(b.path.map(p=>new THREE.Vector3(X(p.E),-p.Z*st.ve,Zc(p.N))));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:c2,depthTest:false}));l.renderOrder=3;selG.add(l)};
  const pt=(E,N,sz,c2)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([X(E),0,Zc(N)]),3));const p=new THREE.Points(g,new THREE.PointsMaterial({size:sz,sizeAttenuation:false,color:c2,map:tex,alphaTest:0.4,depthTest:false}));p.renderOrder=4;selG.add(p)};
  if(S.kind=='site'){const x=W.sites[S.i];pt(x.E,x.N,24,0xffffff);for(const id of x.wells){const w=W.wells[wellBy.get(id)];if(w)for(const b of w.wbs)add(W.wbs[wbBy.get(b)],0xffffff)}}
  else{const w=W.wells[S.i];pt(w.E,w.N,18,0xffffff);for(const b of w.wbs)add(W.wbs[wbBy.get(b)],S.wb===b?0xfff176:0xffffff)}st.dirty=true}
 // labels (greedy declutter, ≤80, throttled)
 const lab=$('#emlab'),pool=[];function labels(){const w=c.clientWidth,h=c.clientHeight,cand=[];let vis=0;const wv=[];
  for(let i=0;i<nW;i++){const q=proj(wp[i*3],0,wp[i*3+2]);if(q&&q[0]>-20&&q[0]<w+20&&q[1]>-20&&q[1]<h+20){vis++;wv.push([i,q])}}
  st.mode=vis<=160?'wells':'sites';const sel=st.sel;
  if(st.mode=='wells'){for(const [i,q] of wv)cand.push({t:W.wells[i].name,q,cls:'',k:'well',i,pr:-Math.hypot(q[0]-w/2,q[1]-h/2)})}
  else for(let i=0;i<nS;i++){const q=proj(sp[i*3],0,sp[i*3+2]);if(q&&q[0]>-20&&q[0]<w+20&&q[1]>-20&&q[1]<h+20)cand.push({t:W.sites[i].name,q,cls:'site',k:'site',i,pr:W.sites[i].wells.length*50-Math.hypot(q[0]-w/2,q[1]-h/2)*0.2})}
  if(sel){const x=sel.kind=='site'?W.sites[sel.i]:W.wells[sel.i];const q=proj(X(x.E),0,Zc(x.N));if(q)cand.push({t:x.name,q,cls:(sel.kind=='site'?'site ':'')+'sel',k:sel.kind,i:sel.i,pr:1e9})}
  cand.sort((a,b)=>b.pr-a.pr);const placed=[],out=[];for(const o of cand){if(out.length>=80)break;const lw=o.t.length*6.4+12,lh=18,x0=o.q[0]+7,y0=o.q[1]-9;if(placed.some(p=>x0<p[2]&&x0+lw>p[0]&&y0<p[3]&&y0+lh>p[1]))continue;if(out.some(z=>z.k==o.k&&z.i==o.i))continue;placed.push([x0,y0,x0+lw,y0+lh]);o.x=x0;o.y=y0;out.push(o)}
  while(pool.length<out.length){const d=document.createElement('div');d.className='eml';d.onclick=e=>{e.stopPropagation();select(d._k,d._i,true)};lab.appendChild(d);pool.push(d)}
  pool.forEach((d,j)=>{const o=out[j];if(!o){d.style.display='none';return}d.style.display='block';d.textContent=o.t;d.className='eml '+o.cls;d._k=o.k;d._i=o.i;d.dataset.k=o.k;d.dataset.i=o.i;d.style.transform=`translate(${o.x|0}px,${o.y|0}px)`});st.labels=out.map(o=>({k:o.k,i:o.i,t:o.t}))}
 // details
 const det=$('#emdet'),db=$('#emdb'),row=(k,v)=>v==null||v===''||v==='–'?'':`<tr><th>${k}</th><td>${v}</td></tr>`;
 const wbHTML=(b,open)=>{const tr=b.traj||[];return `<details ${open?'open':''} data-wb="${esc(b.id)}"><summary>${esc(b.name)} <span class=chip>${esc(b.status)}</span></summary><table>${row('TD (MD) m',f1(b.bhMD))}${row('TVD m',f1(b.bhTVD))}${row('Kick-off MD m',f1(b.koMD))}${row('Deviated',b.deviated?'yes':'no')}${row('Bottom hole lat/long',b.bhLat!=null?fl(b.bhLat)+', '+fl(b.bhLon):null)}${row('Shown trajectory',esc(b.kind||'none'))}${row('Formations',b.formations||null)}</table>
  <h4>Trajectories / surveys (${tr.length})</h4>${tr.length?`<table><tr><th>Kind</th><th>Name</th><th>Phase</th><th>Stations</th><th>MD m</th><th>Max DLS</th></tr>${tr.map(t=>`<tr><td>${t.kind}</td><td>${esc(t.name)}${t.company?'<br><small>'+esc(t.company)+'</small>':''}</td><td>${esc(t.phase||'–')}</td><td>${t.stations}</td><td>${f1(t.mdMax)}</td><td>${t.maxDls==null?'–':f1(t.maxDls)}</td></tr>`).join('')}</table>`:'<p>none</p>'}
  <h4>Designs / plans (${b.designs.length})</h4>${b.designs.length?`<table><tr><th>Name</th><th>Phase</th></tr>${b.designs.map(d=>`<tr><td>${esc(d.name)}</td><td>${esc(d.phase||'–')}</td></tr>`).join('')}</table>`:'<p>none</p>'}
  <h4>Casing &amp; assemblies (${b.assemblies.length})</h4>${b.assemblies.length?`<table><tr><th>Name</th><th>Type</th><th>Size in</th><th>Hole in</th><th>Base MD m</th><th>Base TVD m</th></tr>${b.assemblies.map(a=>`<tr><td>${esc(a.name)}${a.comps.length?'<br><small>'+a.comps.map(x=>esc(x.type||'')+(x.od?' '+x.od+'in':'')+(x.grade?' '+esc(x.grade):'')+(x.weight?' '+x.weight+'ppf':'')).join(' · ')+'</small>':''}</td><td>${esc(a.type||'–')}</td><td>${a.size??'–'}</td><td>${a.hole==null?'–':(+a.hole).toFixed(3)}</td><td>${f1(a.base)}</td><td>${f1(a.baseTVD)}</td></tr>`).join('')}</table>`:'<p>none</p>'}
  ${b.cases.length?`<h4>Load cases (${b.cases.length})</h4><p>${b.cases.map(esc).join(' · ')}</p>`:''}${b.holes.length?`<h4>Hole sections</h4><table><tr><th>Type</th><th>Dia in</th><th>Length m</th></tr>${b.holes.map(x=>`<tr><td>${esc(x.type||'–')}</td><td>${x.d??'–'}</td><td>${f1(x.len)}</td></tr>`).join('')}</table>`:''}
  <h4>Targets (${b.targets.length})</h4>${b.targets.length?tgtT(b.targets):'<p>none</p>'}
  ${b.path?`<h4>Path (${b.path.length} pts shown, local metres)</h4><table><tr><th>MD</th><th>E</th><th>N</th><th>TVD</th></tr>${b.path.filter((p,j)=>j%Math.ceil(b.path.length/12)==0||j==b.path.length-1).map(p=>`<tr><td>${f1(p.md)}</td><td>${f1(p.E)}</td><td>${f1(p.N)}</td><td>${f1(p.tvd)}</td></tr>`).join('')}</table>`:''}</details>`};
 const tgtT=t=>`<table><tr><th>Name</th><th>TVD m</th><th>Lat/long or N/E</th><th>Radius m</th></tr>${t.map(x=>`<tr><td>${esc(x.name)}</td><td>${f1(x.tvd)}</td><td>${x.lat!=null?fl(x.lat)+', '+fl(x.lon):f1(x.dN)+' / '+f1(x.dE)}</td><td>${f1(x.r)}</td></tr>`).join('')}</table>`;
 function showWell(i,wbId){const w=W.wells[i],x=W.sites[siteBy.get(w.site)];$('#emdt').innerHTML=esc(w.name)+' <span class=tag>IMPORT</span>';$('#emback').style.display=x?'':'none';$('#emback').onclick=()=>x&&select('site',siteBy.get(w.site),true);
  db.innerHTML=`<table>${row('Status',`<span class=chip>${esc(w.status)}</span>`+(w.outlier?' <span class=warn>position far from other wells — check coordinates</span>':''))}${row('Site',esc(w.siteName))}${row('Project',esc(w.project))}${row('Latitude, longitude',w.lat!=null?fl(w.lat)+', '+fl(w.lon):null)}
   ${row('Local E / N m',f1(w.E)+' / '+f1(w.N))}${row('Map E / N m',w.mapE!=null?f1(w.mapE)+' / '+f1(w.mapN):null)}${row('Wellbores',w.wbs.length)}${row('Deepest TD (MD) m',f1(w.td))}${row('Deepest TVD m',f1(w.tvd))}
   ${row('Datum',w.datum?esc(w.datum.name)+' '+f1(w.datum.elev)+' m':null)}${row('Other datums',w.datums.length>1?w.datums.map(d=>esc(d.name)+' '+f1(d.elev)+' m'+(d.def?' (default)':'')).join('<br>'):null)}${row('Water depth / ground m',f1(w.waterDepth))}${row('Subsea',w.subsea?'yes':null)}${row('Created / updated',(w.created||'–')+' / '+(w.updated||'–'))}</table>
   ${w.targets.length?'<h4>Well targets</h4>'+tgtT(w.targets):''}<h4>Wellbores (${w.wbs.length})</h4>${w.wbs.map((id,j)=>{const b=W.wbs[wbBy.get(id)];return b?wbHTML(b,wbId?id==wbId:j==0):''}).join('')}`;det.style.display='flex';db.scrollTop=0}
 function showSite(i){const x=W.sites[i];const ws=x.wells.map(id=>W.wells[wellBy.get(id)]).filter(Boolean);$('#emdt').innerHTML=esc(x.name)+' <span class=tag>IMPORT</span>';$('#emback').style.display='none';
  db.innerHTML=`<table>${row('Project',esc(x.project))}${row('Latitude, longitude',x.lat!=null?fl(x.lat)+', '+fl(x.lon):null)}${row('Local E / N m',f1(x.E)+' / '+f1(x.N))}${row('Map E / N m',x.mapE!=null?f1(x.mapE)+' / '+f1(x.mapN):null)}${row('Wells',ws.length)}${row('Wellbores',ws.reduce((a,w)=>a+w.wbs.length,0))}${row('Created / updated',(x.created||'–')+' / '+(x.updated||'–'))}${row('Position',x.outlier?'<span class=warn>far from the other sites — check coordinates</span>':null)}</table>
  <h4>Wells (${ws.length})</h4><table><tr><th>Well</th><th>Status</th><th>WBs</th><th>TD m</th><th></th></tr>${ws.map(w=>`<tr><td>${esc(w.name)}</td><td>${esc(w.status)}</td><td>${w.wbs.length}</td><td>${f1(w.td)}</td><td><button data-well="${wellBy.get(w.id)}">Open</button></td></tr>`).join('')}</table>
  <button id=emac>Anti-collision check (this site)</button><div id=emacr></div>`;db.querySelectorAll('[data-well]').forEach(b=>b.onclick=()=>select('well',+b.dataset.well,true));$('#emac').onclick=()=>siteAC(i);det.style.display='flex';db.scrollTop=0}
 function siteAC(i){const x=W.sites[i];const bs=x.wells.flatMap(id=>W.wells[wellBy.get(id)]?.wbs||[]).map(id=>W.wbs[wbBy.get(id)]).filter(b=>b?.path);const use=bs.slice(0,40);const A=matrix(use.map(b=>({name:b.name,well:b.well,pts:b.path})));
  $('#emacr').innerHTML=`<p><small>${esc(A.model)} · planning aid only, not an approved anti-collision scan${bs.length>40?` · first 40 of ${bs.length} wellbores`:''}.</small></p>${A.flags.length?`<table><tr><th>Ref</th><th>Offset</th><th>SF</th><th>C-C m</th><th>MD m</th></tr>${A.flags.slice(0,60).map(f=>`<tr><td>${esc(use[f.a].name)} <small>${esc(W.wells[wellBy.get(use[f.a].well)]?.name)}</small></td><td>${esc(use[f.b].name)} <small>${esc(W.wells[wellBy.get(use[f.b].well)]?.name)}</small></td><td class=${f.sf<1?'stop':'warn'}>${f.sf.toFixed(2)}</td><td>${f1(f.ctc)}</td><td>${f1(f.mdRef)}</td></tr>`).join('')}</table>`:'<p>No pair below SF 1.5.</p>'}`;st.ac={site:i,flags:A.flags.length,n:use.length}}
 function select(kind,i,flyTo,wbId){if(kind=='wb'){const b=W.wbs[i];wbId=b.id;kind='well';i=wellBy.get(b.well)}st.sel={kind,i,wb:wbId||null};drawSel();if(kind=='site')showSite(i);else showWell(i,wbId);
  if(flyTo){const x=kind=='site'?W.sites[i]:W.wells[i];let R=kind=='site'?400:250;const ids=kind=='site'?x.wells.flatMap(id=>W.wells[wellBy.get(id)]?.wbs||[]):x.wbs;for(const id of ids){const b=W.wbs[wbBy.get(id)];for(const p of b?.path||[])R=Math.max(R,Math.hypot(p.E-x.E,p.N-x.N)*1.3)}
   const t=new THREE.Vector3(X(x.E),0,Zc(x.N)),dir=cam.position.clone().sub(ctl.target).normalize();if(dir.y<0.35){dir.y=0.6;dir.normalize()}fly(t,t.clone().add(dir.multiplyScalar(R*2.6)))}st.dirty=true}
 // input
 let down=null;c.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()};$('#emres').style.display='none'});
 c.addEventListener('pointerup',e=>{if(!down)return;const d=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=performance.now()-down.t;down=null;if(d>8||dt>700)return;const rc=c.getBoundingClientRect();const h=nearest(e.clientX-rc.left,e.clientY-rc.top,e.pointerType=='mouse'?14:28);if(h)select(h.kind,h.i,false)});
 let hovT=0;const hov=$('#emhov');c.addEventListener('pointermove',e=>{if(e.pointerType!='mouse'||e.buttons){hov.style.display='none';return}const n=performance.now();if(n-hovT<60)return;hovT=n;const rc=c.getBoundingClientRect(),x=e.clientX-rc.left,y=e.clientY-rc.top;const h=nearest(x,y,12);
  if(!h||h.kind=='wb'&&false){hov.style.display='none';c.style.cursor='';return}c.style.cursor='pointer';hov.innerHTML=card(h);hov.style.display='block';hov.style.left=Math.min(x+14,rc.width-290)+'px';hov.style.top=Math.min(y+14,rc.height-150)+'px'});
 c.addEventListener('pointerleave',()=>hov.style.display='none');
 function card(h){if(h.kind=='site'){const x=W.sites[h.i];return `<b>${esc(x.name)}</b> <span class=tag>site</span><br>${esc(x.project||'')}<br>${x.wells.length} wells · ${x.lat!=null?fl(x.lat)+', '+fl(x.lon):''}<br><small>Click for details</small>`}
  const w=h.kind=='well'?W.wells[h.i]:W.wells[wellBy.get(W.wbs[h.i].well)];const b=h.kind=='wb'?W.wbs[h.i]:null;return `<b>${esc(w.name)}</b>${b?' · '+esc(b.name):''}<br>Site: ${esc(w.siteName)}<br>${w.lat!=null?fl(w.lat)+', '+fl(w.lon):'E '+f1(w.E)+' N '+f1(w.N)}<br>${w.wbs.length} wellbore(s) · TD ${f1(w.td)} m MD · TVD ${f1(w.tvd)} m<br>Status: ${esc(w.status)}<br><small>Click for all details</small>`}
 ctl.addEventListener('change',()=>{st.dirty=true;hov.style.display='none'});
 $('#emx').onclick=close;$('#emdx').onclick=()=>{det.style.display='none';st.sel=null;drawSel()};$('#emfit').onclick=()=>fit(W.bounds);if($('#emout'))$('#emout').onclick=()=>{fit(W.boundsAll);note(`${W.outliers} well(s) have coordinates far from the rest (shown pink). Fit all returns to the main field.`)};
 $('#emve').onchange=e=>setVE(+e.target.value);
 $('#emlist').onclick=()=>{const L=[...W.sites.keys()].sort((a,b)=>W.sites[a].name.localeCompare(W.sites[b].name));$('#emdt').textContent=`Sites (${nS.toLocaleString('en-AU')})`;$('#emback').style.display='none';
  db.innerHTML=`<table><tr><th>Site</th><th>Project</th><th>Wells</th></tr>${L.map(i=>`<tr><td><button data-site="${i}" style="min-height:30px;padding:2px 8px">${esc(W.sites[i].name)}</button></td><td>${esc(W.sites[i].project||'')}</td><td>${W.sites[i].wells.length}</td></tr>`).join('')}</table>`;
  db.onclick=e=>{const b=e.target.closest('[data-site]');if(b)select('site',+b.dataset.site,true)};det.style.display='flex'};
 const q=$('#emq'),res=$('#emres');q.oninput=()=>{const t=q.value.trim().toLowerCase();if(t.length<2){res.style.display='none';return}const out=[];for(let i=0;i<nS&&out.length<6;i++)if(W.sites[i].name.toLowerCase().includes(t))out.push(['site',i,'◎ '+W.sites[i].name]);
  for(let i=0;i<nW&&out.length<14;i++)if(W.wells[i].name.toLowerCase().includes(t))out.push(['well',i,'● '+W.wells[i].name+' · '+(W.wells[i].siteName||'')]);
  res.innerHTML=out.length?out.map(o=>`<button data-k=${o[0]} data-i=${o[1]}>${esc(o[2])}</button>`).join(''):'<div style="padding:8px">No match</div>';res.style.display='block';res.querySelectorAll('button').forEach(b=>b.onclick=()=>{res.style.display='none';select(b.dataset.k,+b.dataset.i,true)})};
 function note(t){const n=$('#emnote');n.textContent=t;n.style.display='block';clearTimeout(note.t);note.t=setTimeout(()=>n.style.display='none',6000)}
 st.key=e=>{if(!M)return;if(e.key=='Escape'){if(det.style.display!='none'){det.style.display='none';st.sel=null;drawSel()}else close();e.preventDefault();e.stopPropagation()}};addEventListener('keydown',st.key,true);
 st.ro=new ResizeObserver(size);st.ro.observe(c);size();setVE(ve0);cam.position.set(0,ext,ext);ctl.target.set(0,0,0);fit(W.bounds);
 if(!W.sites.length)note('No sites found in this file.');else if(W.outliers)note(`${W.outliers} well(s) have coordinates far from the rest — tap "Outliers" to see them.`);
 const loop=()=>{if(!st.on)return;if(anim)anim();if(st.dirty){st.dirty=false;ctl.update();r.render(s,cam);const n=performance.now();if(n-st.lastLab>110){st.lastLab=n;labels()}else st.labDue=true}else if(st.labDue&&performance.now()-st.lastLab>110){st.labDue=false;st.lastLab=performance.now();labels()}requestAnimationFrame(loop)};loop();
 const api={open:true,W,st,select:(k,i,f=true)=>select(k,i,f),fit:(all)=>fit(all?W.boundsAll:W.bounds),close,
  screen:(k,i)=>{const x=k=='site'?W.sites[i]:W.wells[i];return proj(X(x.E),0,Zc(x.N))},pick:(x,y,r=20)=>nearest(x,y,r),idx:(k,id)=>k=='site'?siteBy.get(id):k=='well'?wellBy.get(id):wbBy.get(id),
  pathScreen:(i,j)=>{const p=W.wbs[i].path[j];return proj(X(p.E),-p.Z*st.ve,Zc(p.N))},labels:()=>st.labels,mode:()=>st.mode,cam,ctl};
 window.GX=window.GX||{};window.GX.edmmap=api;return api}
