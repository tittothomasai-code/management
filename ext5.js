// ext5.js v3.8: subsurface layers (formation tops as 3D strata) + survey (min curvature) panels.
// No server calls: WITSML formationMarker / trajectory XML is parsed from pasted or loaded text (hand-made samples in tests).
// LIVE badge only ever shown for survey data pushed via GEO.ingestTrajectory(xml,{live:true}) from a live WITSML connection; files/manual/examples are SIM.
import * as GG from './geo.js?v=52';
let C,S,THREE,G3,PATH,lay,sur,rd;const KEY='dw-geo';const $=id=>document.getElementById(id);
const GEO={layers:[],surv:{src:'SIM',name:'',live:false,stations:[]},calc:[]};window.GEO=GEO;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const met=()=>U.sys=='metric',L=v=>v==null||!isFinite(v)?'':U.v('ft',v).toFixed(1),LU=()=>U.u('ft'),Lin=v=>U.x(+v,U.u('ft'),'ft');
const UCS=v=>!isFinite(v)?'':met()?(v/145.0377).toFixed(1):v.toFixed(0),UCSU=()=>met()?'MPa':'psi',UCSin=v=>met()?+v*145.0377:+v;
const EM=v=>!isFinite(v)?'':U.v('ppg',v).toFixed(met()?0:2),EMU=()=>U.u('ppg'),EMin=v=>U.x(+v,U.u('ppg'),'ppg');
const DLS=v=>met()?GG.dlsPer30m(v):v,DLSU=()=>met()?'°/30m':'°/100ft';
function save(){try{localStorage.setItem(KEY,JSON.stringify({layers:GEO.layers,surv:GEO.surv.live||GEO.surv.simTest?{src:'SIM',name:'',stations:[]}:{...GEO.surv,live:false}}))}catch{}}
function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d){GEO.layers=d.layers||[];GEO.surv=d.surv||GEO.surv;GEO.surv.live=false}else GEO.layers=GG.SIM_LAYERS()}catch{GEO.layers=GG.SIM_LAYERS()}}
const ev=m=>C.PH.ev(S,m);
// ---- active path: imported survey if any, else the simulator's own survey ----
const simStations=()=>S.surveys.map(q=>({md:q[0],inc:q[1],azi:q[2],ns:q[3],ew:q[4],tvd:q[5]}));
function recalc(){GEO.calc=GEO.surv.stations.length?GG.minCurvStations(GEO.surv.stations):[];}
const active=()=>GEO.calc.length>=2?GEO.calc:simStations();
const pos=md=>GEO.calc.length>=2?GG.pointAt(GEO.calc,md):GG.interpAt(simStations(),md);
GEO.pathPts=md=>GEO.calc.length>=2?GG.samplePath(GEO.calc,md,Math.max(20,md/200)):null;
const tagOf=()=>!GEO.calc.length?'sim':GEO.surv.live?'live':GEO.surv.simTest?'live-sim':'sim';
const srcBadge=()=>{const g=tagOf(),live=g=='live',st=g=='live-sim';const t=GEO.calc.length?(live?'LIVE · '+GEO.surv.src:st?'SIM-TEST · '+GEO.surv.src:'SIM · '+GEO.surv.src):'SIM · simulator';return `<span style="background:${live?'#1a7f37':st?'#e08a00':'#8a6d1a'};color:#fff;border-radius:3px;padding:0 4px;font-weight:700">${t}</span>`};
// ---- 3D ----
function build3D(){const W=C.W,WS=-W(0,0,1).y;G3&&C.scene.remove(G3);G3=new THREE.Group();G3.name='geoLayers';
 for(const Lr of GEO.layers){const a=Lr.top_tvd??Lr.top_md,b=Lr.base_tvd??Lr.base_md;if(!(b>a))continue;const h=(b-a)*WS;
  const m=new THREE.Mesh(new THREE.BoxGeometry(90,h,60),new THREE.MeshStandardMaterial({color:new THREE.Color(Lr.color||'#888'),transparent:true,opacity:0.16,depthWrite:false}));m.position.set(20,-(a*WS+h/2),-20);G3.add(m);
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:new THREE.Color(Lr.color||'#888')}));e.position.copy(m.position);G3.add(e);
  G3.add(label(Lr.name,-25,-(a*WS)-1.2,-20))}
 for(const c of GEO.casing||[]){const ps=[];for(let m=c.mdTop;m<=c.mdBot+0.1;m+=Math.max(10,(c.mdBot-c.mdTop)/60)){const q=GEO.calc.length>=2?GG.pointAt(GEO.calc,m):GG.interpAt(simStations(),m);ps.push(W(q.ns,q.ew,q.tvd))}if(ps.length<2)continue;const tb=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ps),Math.max(8,ps.length*2),Math.max(0.25,(c.od||9.625)/12*0.03*6),10,false),new THREE.MeshStandardMaterial({color:c.cased?0x9aa7b5:0x6b4a2b,transparent:true,opacity:0.35,depthWrite:false}));G3.add(tb);G3.add(label((c.cased?'Casing ':'Open hole ')+(c.od?c.od+'" ':'')+L(c.mdTop)+'–'+L(c.mdBot)+' '+LU()+' · '+(c.tag||'SIM'),ps.at(-1).x+3,ps.at(-1).y,ps.at(-1).z,0.7))}
 const lastMd=GEO.calc.length?GEO.calc.at(-1).md:0;const pts=(GEO.calc.length>=2?GG.samplePath(GEO.calc,Math.min(lastMd,Math.max(lastMd,0)),Math.max(10,lastMd/300)):active()).map(p=>W(p.ns,p.ew,p.tvd));
 if(GEO.calc.length>=2&&S.md>lastMd+1){const a=GG.pointAt(GEO.calc,lastMd),b=GG.pointAt(GEO.calc,S.md);const pl=new THREE.Line(new THREE.BufferGeometry().setFromPoints([W(a.ns,a.ew,a.tvd),W(b.ns,b.ew,b.tvd)]),new THREE.LineDashedMaterial({color:0xff44ff,dashSize:1.2,gapSize:0.8,depthTest:false}));pl.computeLineDistances();pl.renderOrder=11;G3.add(pl);const m=W((a.ns+b.ns)/2,(a.ew+b.ew)/2,(a.tvd+b.tvd)/2);{const A=W(a.ns,a.ew,a.tvd),B=W(b.ns,b.ew,b.tvd),d=B.clone().sub(A),len=d.length(),n=Math.max(2,Math.floor(len/1.6)),mt=new THREE.MeshBasicMaterial({color:0xff44ff,transparent:true,opacity:0.95,depthTest:false});for(let i=0;i<n;i+=2){const c=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,len/n,10),mt);c.position.copy(A.clone().add(d.clone().multiplyScalar((i+0.5)/n)));c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());c.renderOrder=12;G3.add(c)}}G3.add(label('PROJECTED · SIM +'+L(S.md-lastMd)+' '+LU(),m.x+2,m.y,m.z,0.9));GEO._proj=S.md}if(pts.length>=2){const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:GEO.calc.length?0x33ddff:0xffcc33}));G3.add(ln)}
 for(const c of GG.crossings(active(),GEO.layers)){const Lr=GEO.layers.find(x=>x.name==c.name);const s=new THREE.Mesh(new THREE.SphereGeometry(1.1,14,10),new THREE.MeshBasicMaterial({color:new THREE.Color(Lr?.color||'#fff')}));s.position.copy(W(c.ns,c.ew,c.tvd));G3.add(s);
  const r=new THREE.Mesh(new THREE.TorusGeometry(1.6,0.15,6,24),new THREE.MeshBasicMaterial({color:0xffffff}));r.position.copy(s.position);r.rotation.x=Math.PI/2;G3.add(r);G3.add(label('▶ '+c.name.replace(/ \(SIMULATED\)/,'')+' @ '+L(c.md)+' '+LU()+' MD',s.position.x+3,s.position.y+1.5,s.position.z,0.8))}
 G3.visible=!!$('under')?.classList.contains('on');C.scene.add(G3);GEO._built=active().length+':'+GEO.layers.length}
function label(t,x,y,z,sc=1){const cv=document.createElement('canvas');cv.width=512;cv.height=64;const g=cv.getContext('2d');g.font='bold 30px system-ui';g.fillStyle='#000a';g.fillRect(0,0,Math.min(512,g.measureText(t).width+16),48);g.fillStyle='#fff';g.fillText(t,8,34);
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false,transparent:true}));sp.scale.set(24*sc,3*sc,1);sp.position.set(x+12*sc,y,z);sp.renderOrder=10;return sp}
// ---- physics: env hook (SIMULATED rock model) ----
function hook(prev){S.envHook=(s,dt)=>{prev&&prev(s,dt);const bd=C.PH.bitDepth(s),p=pos(bd);const Lr=GG.formationAt(GEO.layers,bd,p?.tvd);const f=GG.rockFactors(Lr);
  if(s.rop>0&&f.rop!==1){const nr=s.rop*f.rop;s.md+=(nr-s.rop)/3600*dt;s.rop=nr}if(s.td.torque>0)s.td.torque*=f.tq;
  s.formation=Lr?Lr.name:'(none)';s.env={fm_index:Lr?GEO.layers.indexOf(Lr):-1,ucs_psi:Lr?.ucs_psi??0,porosity:Lr?.porosity??0,pp_ppg:Lr?.pp_ppg??0,fp_ppg:Lr?.fp_ppg??0,rop_factor:f.rop,torque_factor:f.tq};
  if(s._fm!==s.formation){if(s._fm!==undefined)C.PH.ev(s,'Bit entered formation: '+s.formation);s._fm=s.formation}}}
// ---- UI ----
function panel(id,top){const d=document.createElement('div');d.id=id;d.style.cssText=C.PANEL+`;left:10px;top:${top}px;width:640px;max-height:46vh;overflow:auto;display:none;border-color:#c96`;document.body.appendChild(d);return d}
const B=(id,t)=>`<button id="${id}" style="${C.BTN}">${t}</button>`;const inp=(k,i,v,w=60,t='text')=>`<input data-${k}="${i}" type="${t}" value="${esc(v)}" style="width:${w}px;background:#0b1218;color:#def;border:1px solid #456">`;
let UNDO=null;
function addAtBit(){const bdF=C.PH.bitDepth(S);if(!isFinite(bdF)||bdF<=0){ev('Add layer at bit depth: bit depth unknown');return}const p=pos(bdF),tv=p?.tvd??bdF;
 const host=GEO.layers.find(l=>l.top_md<=bdF&&l.base_md>bdF);const nxt=GEO.layers.filter(l=>l.top_md>bdF).sort((a,b)=>a.top_md-b.top_md)[0];
 let base=host?host.base_md:nxt?nxt.top_md:bdF+Lin(met()?100:300),baseT=host?host.base_tvd:nxt?nxt.top_tvd:tv+(base-bdF);
 if(host){host.base_md=bdF;host.base_tvd=tv}
 const nl={name:'New layer @ '+L(bdF)+' '+LU(),top_md:bdF,base_md:base,top_tvd:tv,base_tvd:baseT,color:'#'+((Math.random()*0xffffff)|0).toString(16).padStart(6,'0'),ucs_psi:8000,porosity:.1,pp_ppg:9,fp_ppg:14,src:'manual'};
 GEO.layers.push(nl);GEO.layers.sort((a,b)=>(a.top_md??0)-(b.top_md??0));GEO._focus=GEO.layers.indexOf(nl);ev('Added layer at bit depth '+L(bdF)+' '+LU()+(host?' (split '+host.name+')':''));changed()}
function renderLay(){if(lay.style.display=='none')return;const ex=GEO.layers.some(l=>/SIMULATED/.test(l.name));const bdF=C.PH.bitDepth(S);
 const F='font-size:16px;min-height:40px;box-sizing:border-box;background:#0b1218;color:#def;border:1px solid #456;border-radius:6px;padding:4px 6px';
 const fld=(k,i,lab,v,u)=>`<label style="display:flex;flex-direction:column;flex:1 1 120px;min-width:110px;font-size:12px;color:#9ab">${lab}${u?' ('+u+')':''}<input data-${k}="${i}" inputmode="decimal" value="${esc(v)}" style="${F};width:100%"></label>`;
 const BB=(id,t,c='#1b5e20')=>`<button id="${id}" style="${C.BTN};font-size:15px;min-height:44px;padding:6px 12px;background:${c};color:#fff;border-radius:8px;font-weight:700">${t}</button>`;
 lay.innerHTML=`<b style="color:#fc9">Subsurface layers</b> <span style="color:#fc6">${ex?'SIMULATED example data — not real formations':'user data'} · depths in ${LU()} (${met()?'Metric':'Imperial'})</span> <button id="lyx" style="${C.BTN};float:right;min-width:40px;min-height:40px">×</button>
 <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0">${BB('lyadd','+ Add layer')}${BB('lybit','+ Add layer at bit depth ('+L(bdF)+' '+LU()+')','#2a6f97')}${UNDO?BB('lyundo','↶ Undo delete','#6b4a2b'):''}</div>
 <div id="lycards" style="display:flex;flex-direction:column;gap:8px">`+
 (GEO.layers.length?GEO.layers.map((l,i)=>`<div data-card="${i}" style="border:1px solid #456;border-left:8px solid ${esc(/^#[0-9a-f]{6}$/i.test(l.color)?l.color:'#888')};border-radius:8px;padding:6px;background:#0f1820${GG.formationAt([l],bdF,pos(bdF)?.tvd)?';box-shadow:0 0 0 2px #fd8':''}">
  <div style="display:flex;gap:6px;align-items:center"><input data-lc="${i}" type="color" aria-label="Layer colour" value="${/^#[0-9a-f]{6}$/i.test(l.color)?l.color:'#888888'}" style="width:48px;height:44px;padding:0;border:1px solid #456;border-radius:6px;background:none">
  <input data-ln="${i}" aria-label="Layer name" value="${esc(l.name)}" style="${F};flex:1;min-width:0;font-weight:700">
  <button data-ldel="${i}" aria-label="Delete layer" style="${C.BTN};min-width:44px;min-height:44px;font-size:18px;background:#7a1d1d;color:#fff;border-radius:8px">✕</button></div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${fld('ltm',i,'Top MD',L(l.top_md),LU())}${fld('lbm',i,'Base MD',L(l.base_md),LU())}</div>
  <details style="margin-top:4px"><summary style="font-size:13px;color:#9cf;min-height:28px">More: TVD, rock properties</summary><div style="display:flex;flex-wrap:wrap;gap:6px">
  ${fld('ltt',i,'Top TVD',L(l.top_tvd),LU())}${fld('lbt',i,'Base TVD',L(l.base_tvd),LU())}${fld('lu',i,'UCS',UCS(l.ucs_psi),UCSU())}${fld('lp',i,'Porosity',isFinite(l.porosity)?(l.porosity*100).toFixed(0):'','%')}${fld('lpp',i,'Pore press.',EM(l.pp_ppg),EMU())}${fld('lfp',i,'Frac grad.',EM(l.fp_ppg),EMU())}</div></details></div>`).join(''):'<div style="color:#fc6;font-size:14px;padding:8px">No layers. Press “+ Add layer” or “+ Add layer at bit depth”.</div>')+`</div>
 <div style="margin-top:8px">${B('lysim','Load SIMULATED example')}${B('lyclr','Clear all')} <label style="${C.BTN}">Import CSV<input id="lyf" type="file" accept=".csv,.txt" style="display:none"></label></div>
 <textarea id="lyta" placeholder="Paste layer CSV (name,top_m,base_m,top_tvd_m,base_tvd_m,lith,ucs_mpa,porosity,pp_sg,fp_sg) or WITSML formationMarker XML" style="width:100%;box-sizing:border-box;height:46px;background:#0b1218;color:#def;font:12px monospace"></textarea><br>${B('lyimp','Import pasted text')}
 <small>Highlighted card = layer at the bit. Physics: formation at the bit scales ROP and top-drive torque through S.envHook (SIMULATED rock model, factor 1.0 at UCS 55 MPa / 8000 psi). Unitless CSV headers assume the selected unit system.</small>`;
 lay.querySelector('#lyx').onclick=()=>lay.style.display='none';
 const set=(sel,fn,ev2='onchange')=>lay.querySelectorAll(`[data-${sel}]`).forEach(e=>e[ev2]=()=>{const l=GEO.layers[+e.dataset[sel]];fn(l,e.value);if(sel=='lc')e.closest('[data-card]').style.borderLeftColor=e.value;changed(true)});
 set('ln',(l,v)=>l.name=v);set('ltm',(l,v)=>l.top_md=Lin(v));set('lbm',(l,v)=>l.base_md=Lin(v));set('ltt',(l,v)=>l.top_tvd=Lin(v));set('lbt',(l,v)=>l.base_tvd=Lin(v));set('lc',(l,v)=>l.color=v,'oninput');set('lu',(l,v)=>l.ucs_psi=UCSin(v));set('lp',(l,v)=>l.porosity=+v/100);set('lpp',(l,v)=>l.pp_ppg=EMin(v));set('lfp',(l,v)=>l.fp_ppg=EMin(v));
 lay.querySelectorAll('[data-ldel]').forEach(b=>b.onclick=()=>{const k=+b.dataset.ldel;UNDO={i:k,l:GEO.layers[k]};GEO.layers.splice(k,1);ev('Deleted layer '+UNDO.l.name);changed()});
 const u=$('lyundo');if(u)u.onclick=()=>{GEO.layers.splice(Math.min(UNDO.i,GEO.layers.length),0,UNDO.l);UNDO=null;changed()};
 $('lyadd').onclick=()=>{const l=[...GEO.layers].sort((a,b)=>(a.base_md??0)-(b.base_md??0)).at(-1),t=l?l.base_md:0,d=Lin(met()?150:500);GEO.layers.push({name:'New layer '+(GEO.layers.length+1),top_md:t,base_md:t+d,top_tvd:l?l.base_tvd:0,base_tvd:(l?l.base_tvd:0)+d,color:'#'+((Math.random()*0xffffff)|0).toString(16).padStart(6,'0'),ucs_psi:8000,porosity:.1,pp_ppg:9,fp_ppg:14,src:'manual'});GEO._focus=GEO.layers.length-1;changed()};
 $('lybit').onclick=addAtBit;
 $('lysim').onclick=()=>{GEO.layers=GG.SIM_LAYERS();ev('Loaded SIMULATED example layers (not real formation data)');changed()};$('lyclr').onclick=()=>{UNDO=null;GEO.layers=[];changed()};
 $('lyf').onchange=async e=>{const f=e.target.files[0];if(f)importLayers(await f.text(),f.name)};$('lyimp').onclick=()=>importLayers($('lyta').value,'pasted');
 if(GEO._focus!=null){const c=lay.querySelector(`[data-card="${GEO._focus}"]`);GEO._focus=null;if(c){c.scrollIntoView({block:'nearest'});c.style.outline='2px solid #7cf'}}}
GEO.addAtBit=addAtBit;
function importLayers(t,name){try{let r;if(/<\s*(\w+:)?formationMarker/.test(t)){r=GG.parseFormationMarkers(t);ev('Imported '+r.length+' formation markers from WITSML XML ('+name+') — file data, SIM badge')}else{const x=GG.parseLayersCSV(t,U.sys);r=x.layers;ev('Imported '+r.length+' layers from CSV ('+name+'): '+x.log.join(', '))}if(!r.length)throw new Error('no layers found');GEO.layers=r;changed()}catch(e){ev('Layer import failed: '+e.message)}}
function renderSur(){if(sur.style.display=='none')return;const s=GEO.calc.length?GEO.calc:GG.minCurvStations(simStations().map(({md,inc,azi})=>({md,inc,azi})),{});
 sur.innerHTML=`<b style="color:#fc9">Survey</b> ${srcBadge()} <span style="color:#9ab">${esc(GEO.surv.name||'')} · min curvature · ${U.sys=='metric'?'Metric':'Imperial'}</span> <button id="svx" style="${C.BTN};float:right">×</button><br>
 <style>#geoSur td,#geoSur th,#geoLay th{padding:1px 5px}</style><table style="border-collapse:collapse;font-size:10px;text-align:right"><tr><th>MD ${LU()}</th><th>Inc °</th><th>Azi °</th><th>TVD ${LU()}</th><th>N/S ${LU()}</th><th>E/W ${LU()}</th><th>DLS ${DLSU()}</th><th>VS ${LU()}</th><th></th></tr>`+
 (GEO.calc.length?s:s.filter((p,i)=>i%5==0||i==s.length-1)).map((p,i)=>`<tr><td>${L(p.md)}</td><td>${p.inc.toFixed(2)}</td><td>${p.azi.toFixed(2)}</td><td>${L(p.tvd)}</td><td>${L(p.ns)}</td><td>${L(p.ew)}</td><td>${DLS(p.dls||0).toFixed(2)}</td><td>${L(p.vs)}</td><td>${GEO.calc.length?`<button data-sdel="${i}" style="${C.BTN}">✕</button>`:''}</td></tr>`).join('')+`</table>
 Manual: MD ${inp('sm',0,'',60)} Inc ${inp('si',0,'',44)} Azi ${inp('sa',0,'',44)} ${B('svadd','+ Add station')} ${B('svsim','Use simulator survey')} <label style="${C.BTN}">Import CSV<input id="svf" type="file" accept=".csv,.txt,.xml" style="display:none"></label><br>
 <textarea id="svta" placeholder="Paste survey CSV (md_m,inc,azi) or WITSML trajectory XML" style="width:600px;height:46px;background:#0b1218;color:#def;font:10px monospace"></textarea><br>${B('svimp','Import pasted text')}
 <small>${GEO.calc.length?'Bit follows the imported survey path (cyan). ':'Showing the simulator\'s own survey (yellow path). '}Rings mark where the path crosses each formation top. Manual, CSV, file and example data are always badged SIM.</small>`;
 sur.querySelector('#svx').onclick=()=>sur.style.display='none';
 sur.querySelectorAll('[data-sdel]').forEach(b=>b.onclick=()=>{GEO.surv.stations.splice(+b.dataset.sdel,1);changed()});
 $('svadd').onclick=()=>{const md=Lin(sur.querySelector('[data-sm]').value),inc=+sur.querySelector('[data-si]').value,azi=+sur.querySelector('[data-sa]').value;if(![md,inc,azi].every(isFinite)||sur.querySelector('[data-sm]').value===''){ev('Manual survey: enter MD, Inc and Azi');return}
  if(!GEO.calc.length)GEO.surv={src:'manual',name:'manual entry',live:false,stations:[{md:0,inc:0,azi:0}]};GEO.surv.src='manual';GEO.surv.live=false;GEO.surv.stations.push({md,inc,azi});ev('Manual survey station '+L(md)+' '+LU()+' MD, Inc '+inc+', Azi '+azi);changed()};
 $('svsim').onclick=()=>{GEO.surv={src:'SIM',name:'',live:false,stations:[]};changed()};
 $('svf').onchange=async e=>{const f=e.target.files[0];if(f)importSurvey(await f.text(),f.name)};$('svimp').onclick=()=>importSurvey($('svta').value,'pasted')}
function importSurvey(t,name,o={}){try{let st,src,nm=name;if(/<\s*(\w+:)?trajectoryStation/.test(t)){const r=GG.parseTrajectory(t);st=r.stations;nm=r.name;src=o.live?'WITSML':'WITSML file'}else{st=GG.parseSurveyCSV(t,U.sys);src='CSV'}
  if(st.length<1)throw new Error('no stations');if(st[0].md>0&&!isFinite(st[0].tvd_rep))st.unshift({md:0,inc:0,azi:st[0].azi});GEO.surv={src,name:nm,live:!!o.live,stations:st};ev('Imported '+st.length+' survey stations ('+src+': '+nm+')'+(o.live?' LIVE':' — SIM badge'));changed()}catch(e){ev('Survey import failed: '+e.message)}}
GEO.appendStations=(st,o={})=>{if(!(GEO.surv.src==o.src&&GEO.surv.name==o.name)||!GEO.surv.stations.length){GEO.surv={src:o.src,name:o.name,live:!!o.live,simTest:!!o.simTest,stations:[]}}GEO.surv.live=!!o.live;GEO.surv.simTest=!!o.simTest;const n=GG.mergeStations(GEO.surv.stations,st);if(n){ev((o.live?'LIVE':'SIM-TEST')+' survey: +'+n+' station(s), last MD '+L(GEO.surv.stations.at(-1).md)+' '+LU());changed()}return n};
GEO.ingestTrajectory=(xml,o={})=>importSurvey(xml,'WITSML',o);GEO.importLayers=importLayers;
// v3.9 per-well replica: full reset (no carry-over) + casing from wbGeometry
GEO.minCurv=st=>GG.minCurvStations(st);GEO.casing=[];GEO.resetWell=(tag)=>{GEO.surv={src:'SIM',name:'',live:false,simTest:false,stations:[]};GEO.layers=GG.SIM_LAYERS();GEO.layerSrc='SIM';GEO.casing=[];GEO._proj=null;try{localStorage.removeItem(KEY)}catch{}ev('Well switched'+(tag?' to '+tag:'')+': survey, layers and casing reset (SIM until the server provides them)');changed()};
GEO.setCasing=(secs)=>{GEO.casing=secs||[];build3D()};;GEO.importSurvey=importSurvey;
function changed(keepLay){recalc();S._lastBD=null;save();build3D();if(!keepLay)renderLay();renderSur()}
function readout(){const bd=C.PH.bitDepth(S),Lr=GG.formationAt(GEO.layers,bd,pos(bd)?.tvd),f=GG.rockFactors(Lr),p=pos(bd);
 rd.innerHTML=`<b>Formation @ bit</b> <span style="background:#8a6d1a;color:#fff;border-radius:3px;padding:0 3px">SIM</span> ${Lr?`<span style="display:inline-block;width:9px;height:9px;background:${esc(Lr.color)};border:1px solid #fff"></span> ${esc(Lr.name)} · UCS ${UCS(Lr.ucs_psi)} ${UCSU()} · φ ${isFinite(Lr.porosity)?(Lr.porosity*100).toFixed(0):'?'}% · PP ${EM(Lr.pp_ppg)} / FP ${EM(Lr.fp_ppg)} ${EMU()} · ROP×${f.rop.toFixed(2)} TQ×${f.tq.toFixed(2)}`:'(no layer at bit)'}<br>Bit ${L(bd)} ${LU()} MD · TVD ${L(p?.tvd)} ${LU()} · Inc ${(p?.inc??S.inc).toFixed(1)}° Azi ${(p?.azi??S.azi).toFixed(1)}° · survey ${srcBadge()}`}
export function init(ctx){C=ctx;S=C.S;THREE=C.THREE;load();recalc();
 lay=panel('geoLay',120);sur=panel('geoSur',140);rd=document.createElement('div');rd.id='geoRd';rd.style.cssText=C.PANEL+';left:50%;transform:translateX(-50%);bottom:34px;border-color:#c96;max-width:760px';document.body.appendChild(rd);
 const anchor=$('under');const mk=(id,t,el,f)=>{const b=document.createElement('button');b.id=id;b.textContent=t;b.className=anchor?.className||'';anchor?.after(b);b.onclick=()=>{el.style.display=el.style.display=='none'?'':'none';f()}};
 mk('btnSur','Survey',sur,renderSur);mk('btnLay','Subsurface',lay,renderLay);
 hook(S.envHook);
 (window.GX_SIGS=window.GX_SIGS||[]).push(add=>{const at=()=>pos(C.PH.bitDepth(S));const sb=tagOf;
  add('geo:inc','Survey · Inclination °','',()=>at()?.inc??S.inc,sb);add('geo:azi','Survey · Azimuth °','',()=>at()?.azi??S.azi,sb);
  add('geo:dls','Survey · DLS (°/30m metric · °/100ft imperial)','',()=>{const s=active(),bd=C.PH.bitDepth(S);const c=GEO.calc.length?s:GG.minCurvStations(s.map(({md,inc,azi})=>({md,inc,azi})));let d=0;for(const q of c)if(q.md<=bd)d=q.dls||0;return DLS(d)},sb);
  add('geo:tvd','Survey · TVD at bit','ft',()=>at()?.tvd??null,sb);add('geo:fm','Subsurface · formation index at bit','',()=>S.env?.fm_index??-1)});
 const f0=C.EXT.frame;let tk=0;C.EXT.frame=dt=>{f0(dt);if(G3)G3.visible=!!$('under')?.classList.contains('on');
  if(GEO.calc.length>=2&&Math.abs(S.md-(GEO._proj??0))>3&&S.md>GEO.calc.at(-1).md)build3D();
  if((tk+=dt)>0.5){tk=0;readout();if(!GEO.calc.length&&GEO._built!==active().length+':'+GEO.layers.length&&S.surveys.length%3==0)build3D()}};
 U.on&&U.on(()=>{renderLay();renderSur();build3D();readout()});build3D();readout()}
