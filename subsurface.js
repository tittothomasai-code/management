// subsurface.js (feat/subsurface): dedicated live subsurface view. Own full-screen 3D view that follows the bit.
// Shows strat layers (strat.js from helper D if present, else SIM layers), planned vs actual path, casing + cement,
// bit with MD/TVD/Inc/Azi, ROP/WOB, lithology at bit, offset EDM wells if loaded. Metric. Respects GX.quality.
// Open: HUD button "Subsurface", key V, gamepad Y (button 3). Close: same, or Esc / Close button.
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
const FT=0.3048,$=id=>document.getElementById(id);
const SIM_LAYERS=[['Topsoil + clay','clay',0,'#a08560'],['Sandstone A','sandstone',150,'#d8c070'],['Shale A','shale',420,'#6f7a72'],['Limestone','limestone',780,'#b9c4c9'],['Shale B','shale',1050,'#5d6862'],['Sandstone B (target)','sandstone',1300,'#e0b050'],['Shale C','shale',1700,'#55605a']];
let ST={open:false,ren:null,scene:null,cam:null,ctl:null,dyn:null,strat:null,stratTried:false,last:0,follow:true,bit:new THREE.Vector3(),pad:false,raf:0};
const q=()=>window.GX?.quality?.get?.()||'medium';
const Lv=()=>({low:{pr:1,seg:6,tube:120},medium:{pr:1.5,seg:8,tube:300},high:{pr:2,seg:12,tube:600}})[q()]||{pr:1.5,seg:8,tube:300};
// coordinates: metres, x=E, y=-TVD, z=-N
const V=(n,e,tvd)=>new THREE.Vector3(e,-tvd,-n);
export function actualPts(){const G=window.GEO;try{if(G?.calc?.length>=2)return G.calc.map(s=>V((s.ns||0)*FT,(s.ew||0)*FT,s.tvd*FT))}catch(e){}
 const w=window.wellPts?.();if(w?.length>=2)return w.map(([x,y,z])=>new THREE.Vector3(x/0.03*FT,y/0.03*FT,z/0.03*FT));return []}
export function planPts(){try{return window.G.PH.planPath().map(p=>V(p[3]*FT,p[4]*FT,p[5]*FT))}catch(e){return []}}
// helper D strat API: prefer the shared instance GX.strat (loaded by index.html), else import it, else SIM layers
const SM=()=>window.GX?.strat?.model?window.GX.strat:ST.strat;
async function loadStrat(){if(window.GX?.strat?.model)return window.GX.strat;if(ST.stratTried)return ST.strat;ST.stratTried=true;try{ST.strat=await import('./strat.js')}catch(e){ST.strat=null}return ST.strat}
// SIM demo casing program (used only when the well plan has no casing design). MD in m; td=true runs to TD.
export const DEMO_CASING=[{name:'Conductor 30 in',od:0.762,shoeMD:40,topMD:0,tocMD:0},{name:'Surface 20 in',od:0.508,shoeMD:450,topMD:0,tocMD:0},{name:'Intermediate 13 3/8 in',od:0.340,shoeMD:1150,topMD:0,tocMD:750},{name:'Production 9 5/8 in',od:0.245,shoeMD:2400,topMD:0,tocMD:1900}];
export function casingProgram(){try{const D=window.GX?.casing?.design?.();if(Array.isArray(D)&&D.length)return {src:'plan',list:D.map((s,i)=>({name:s.name||s.s?.name||('String '+(i+1)),shoeMD:s.s?.shoeMD??s.shoeMD,topMD:s.s?.topMD??s.topMD??0,tocMD:s.tocMD??s.s?.tocMD}))}}catch(e){}
 return {src:'SIM demo',list:DEMO_CASING}}
export function layers(){const m=SM();try{const M=m?.model?.();if(M?.formations?.length)return {src:M.src||'model',strat:true,list:M.formations.map((f,i)=>({name:f.name,lith:f.lith,top:(m.topAt?m.topAt(M,i,0,0):f.top),c:(m.LITH?.[f.lith]?.c)||'#888',label:m.LITH?.[f.lith]?.label||f.lith}))}}catch(e){}
 return {src:'SIM',list:SIM_LAYERS.map(([name,lith,top,c])=>({name,lith,top,c}))}}
export function lithAtBit(tvd=-ST.bit.y){const m=SM();try{const M=m?.model?.();const r=(M&&m.lithAt)?m.lithAt(M,tvd,ST.bit.x,-ST.bit.z):m?.atBit?.();if(r)return {name:r.formation||r.name||'',lith:r.props?.label||r.lith||'',key:r.lith,gr:r.props?.gr,c:r.props?.c,src:r.src||M?.src||'model',strat:true}}catch(e){}
 const L=layers().list;let k=null;for(const l of L)if(l.top<=tvd)k=l;return k?{name:k.name,lith:k.lith,src:layers().src}:null}
function css(){if($('subCss'))return;const s=document.createElement('style');s.id='subCss';s.textContent=`#subsurf{position:fixed;inset:0;z-index:100000;background:#05090e;display:none}#subsurf canvas{display:block;width:100%;height:100%;touch-action:none}
#subHud{position:absolute;left:8px;top:calc(8px + env(safe-area-inset-top));background:#0d1620e8;color:#dde;font:13px system-ui;border:1px solid #3a5;border-radius:10px;padding:8px 10px;min-width:180px;pointer-events:none}
#subHud b{color:#9fd}#subHud .sim{background:#a70;color:#fff;border-radius:4px;padding:0 4px;font-weight:bold}
#subBar{position:absolute;right:8px;top:calc(8px + env(safe-area-inset-top));display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}#subBar button{background:#234;color:#def;border:1px solid #567;border-radius:8px;padding:8px 12px;font:14px system-ui;min-height:40px}
@media (max-width:600px){#subHud{top:calc(56px + env(safe-area-inset-top))}}#subsurf.split{left:50%}#subRuler{position:absolute;right:8px;top:calc(64px + env(safe-area-inset-top));bottom:calc(16px + env(safe-area-inset-bottom));width:132px;font:11px system-ui;color:#cde;pointer-events:none}#subRuler .ax{position:absolute;left:44px;top:0;bottom:0;border-left:2px solid #9ab}#subRuler .t{position:absolute;left:0;width:132px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#subRuler .t i{display:inline-block;width:40px;text-align:right;font-style:normal;opacity:.75;margin-right:8px}#subRuler .bitm{position:absolute;left:30px;width:30px;height:4px;background:#ffd040;box-shadow:0 0 8px #ffb000;border-radius:2px}@media (max-width:600px){#subRuler{width:96px;top:calc(210px + env(safe-area-inset-top));bottom:calc(240px + env(safe-area-inset-bottom))}#subRuler .t{width:96px}}#subLeg{position:absolute;left:8px;bottom:calc(8px + env(safe-area-inset-bottom));background:#0d1620d8;color:#cde;font:12px system-ui;border-radius:8px;padding:6px 8px;max-width:60vw}`;document.head.appendChild(s)}
function ui(){css();const d=document.createElement('section');d.id='subsurf';d.innerHTML=`<canvas id="subCv"></canvas><div id="subHud"></div><div id="subBar"><button id="subSplit">Split view</button><button id="subFollow">Follow bit: on</button><button id="subFit">Fit well</button><button id="subClose">Close</button></div><div id="subRuler"></div><div id="subLeg"></div>`;document.body.appendChild(d);
 $('subClose').onclick=close;$('subSplit').onclick=()=>split();if(innerWidth<900)$('subSplit').style.display='none';$('subFit').onclick=fit;$('subFollow').onclick=()=>{ST.follow=!ST.follow;$('subFollow').textContent='Follow bit: '+(ST.follow?'on':'off')}}
function mesh(g,m){const o=new THREE.Mesh(g,m);ST.dyn.add(o);return o}
function tubeAlong(pts,mdFrom,mdTo,r,mat,seg){// pts with cumulative length ~ MD (m)
 const out=[];let acc=0;for(let i=0;i<pts.length;i++){if(i)acc+=pts[i].distanceTo(pts[i-1]);if(acc>=mdFrom&&acc<=mdTo)out.push(pts[i])}if(out.length<2)return null;return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(out),Math.min(400,out.length*3),r,seg),mat)}
function build(){const L=Lv(),sc=ST.scene;if(ST.dyn){sc.remove(ST.dyn);ST.dyn.traverse(o=>{o.geometry?.dispose?.()})}ST.dyn=new THREE.Group();sc.add(ST.dyn);
 const act=actualPts(),plan=planPts(),all=[...act,...plan];const span=Math.max(800,...all.map(p=>Math.hypot(p.x,p.z)+300));
 // ground (transparent) + strat layers
 mesh(new THREE.PlaneGeometry(span*2,span*2).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x6b8a4a,transparent:true,opacity:0.18,depthWrite:false,side:THREE.DoubleSide}));
 const ly=layers(),maxT=Math.max(2000,...all.map(p=>-p.y+200));ly.list.forEach((l,i)=>{const b=i+1<ly.list.length?ly.list[i+1].top:maxT,h=Math.max(1,b-l.top);
  const m=mesh(new THREE.BoxGeometry(span*2,h,span*2),new THREE.MeshStandardMaterial({color:l.c,transparent:true,opacity:q()=='low'?0.10:0.14,depthWrite:false}));m.position.y=-(l.top+h/2);m.renderOrder=-1;
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(span*2,span*2).rotateX(-Math.PI/2)),new THREE.LineBasicMaterial({color:l.c}));e.position.y=-l.top;ST.dyn.add(e)});
 ST.layerSrc=ly.src;$('subLeg').innerHTML=`<b>Layers${ly.src=='SIM'?' <span style="background:#a70;padding:0 4px;border-radius:4px">SIM</span>':' ('+ly.src+')'}</b><br>`+ly.list.map(l=>`<span style="display:inline-block;width:10px;height:10px;background:${l.c}"></span> ${l.name} ${l.top.toFixed(0)} m`).join('<br>')+'<br><span style="color:#3f6">- - plan</span> · <span style="color:#f80">— actual</span> · <span style="color:#bbb">casing</span> · <span style="color:#8aa">cement</span> · <span style="color:#7dff7d">gamma (API)</span>';
 // planned (dashed green) + actual (orange tube)
 if(plan.length>1){const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(plan),new THREE.LineDashedMaterial({color:0x33ff66,dashSize:15,gapSize:9}));l.computeLineDistances();l.name='subPlan';ST.dyn.add(l)}
 if(act.length>1){const t=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(act),Math.min(L.tube,act.length*4),3,L.seg),new THREE.MeshStandardMaterial({color:0xff8c3a,emissive:0x552200}));t.name='subActual';ST.bit.copy(act[act.length-1])}
 // casing + cement (from casing design if present; else none)
 const CP=casingProgram();try{const D=CP.list;if(D&&act.length>1){let acc=0;for(let i=1;i<act.length;i++)acc+=act[i].distanceTo(act[i-1]);
  ST.casing={src:CP.src,run:0};D.forEach((s,i)=>{if(!(s.shoeMD>0)||s.shoeMD>acc+1)return;ST.casing.run++;const sh=Math.min(s.shoeMD,acc),top=s.topMD||0,r=5+(D.length-i)*2;
   const c=tubeAlong(act,top,sh,r,new THREE.MeshStandardMaterial({color:0xb8bec4,metalness:0.8,roughness:0.35,transparent:true,opacity:0.45,depthWrite:false}),L.seg);if(c)c.name='subCasing';
   const toc=Math.max(top,s.tocMD!=null?s.tocMD:sh-300);const cm=tubeAlong(act,toc,sh,r+2.5,new THREE.MeshStandardMaterial({color:0x8aa0a0,transparent:true,opacity:0.3,depthWrite:false}),L.seg);if(cm)cm.name='subCement'})}}catch(e){console.warn('sub casing',e)}
 // offset / EDM wells (if loaded)
 try{const W=window.GX?.edm?.ST?.wells||window.GX?.edm?.ST?.data?.wells||[];let n=0;for(const w of W){const tr=w.traj||w.path||w.survey;if(!Array.isArray(tr)||tr.length<2||n>200)continue;n++;
  const pts=tr.map(p=>V((p.n??p.ns??0)+(w.dn||0),(p.e??p.ew??0)+(w.de||0),p.tvd??0));const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x66aaff}));l.name='subOffset';ST.dyn.add(l)}ST.offsets=n}catch(e){ST.offsets=0}
 // gamma trace along the actual well (from strat gammaAt if present, else SIM from layer); drawn as an offset line, 1 API = 0.6 m
 try{const m=SM(),M=m?.model?.();const g=[];let acc=0;const step=Math.max(1,Math.round(act.length/L.tube));for(let i=0;i<act.length;i+=step){const p=act[i],tvd=-p.y;let v=(M&&m.gammaAt)?m.gammaAt(M,tvd,p.x,-p.z):null;if(v==null){const li=lithAtBit(tvd);v=/sand/i.test(li?.lith||'')?35:/lime|chalk/i.test(li?.lith||'')?20:95}g.push([p,v])}
  if(g.length>1){const pts=g.map(([p,v])=>p.clone().add(new THREE.Vector3(12+v*0.6,0,0)));const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x7dff7d}));l.name='subGamma';ST.dyn.add(l);
   const base=new THREE.Line(new THREE.BufferGeometry().setFromPoints(g.map(([p])=>p.clone().add(new THREE.Vector3(12,0,0)))),new THREE.LineBasicMaterial({color:0x335533}));ST.dyn.add(base);ST.gamma=Math.round(g.at(-1)[1])}}catch(e){console.warn('sub gamma',e)}
 // bit + ROP glow (light and halo scale with ROP)
 const bit=mesh(new THREE.ConeGeometry(6,14,L.seg).rotateX(Math.PI),new THREE.MeshStandardMaterial({color:0xffd040,emissive:0xff9000,emissiveIntensity:0.4}));bit.name='subBit';bit.position.copy(ST.bit);ST.bitM=bit;
 const halo=mesh(new THREE.SphereGeometry(10,L.seg*2,L.seg),new THREE.MeshBasicMaterial({color:0xffb030,transparent:true,opacity:0.25,depthWrite:false,blending:THREE.AdditiveBlending}));halo.name='subGlow';halo.position.copy(ST.bit);ST.halo=halo;
 if(q()!='low'){const pl=new THREE.PointLight(0xffa020,0,250,1.5);pl.position.copy(ST.bit);ST.dyn.add(pl);ST.bitL=pl}else ST.bitL=null;
 ruler(ly)}
// ROP 0..40 m/h → glow 0..1
export const glowOf=ropMh=>Math.max(0,Math.min(1,(+ropMh||0)/40));
function glow(t){const r=((+window.S?.rop||0)*FT),k=glowOf(r),pulse=1+0.15*k*Math.sin(t/120);ST.glow=k;if(ST.bitM)ST.bitM.material.emissiveIntensity=0.3+2.2*k;if(ST.halo){ST.halo.scale.setScalar((0.6+1.8*k)*pulse);ST.halo.material.opacity=0.08+0.35*k}if(ST.bitL)ST.bitL.intensity=k*4e3}
// formation-tops depth ruler (TVD, m)
function ruler(ly){const el=$('subRuler');if(!el)return;const bt=-ST.bit.y,max=Math.max(bt+300,...ly.list.map(l=>l.top).filter(x=>x<bt+800),500),y=v=>(100*v/max).toFixed(2)+'%';
 let h='<div class="ax"></div>';for(let v=0;v<=max;v+=max>2000?500:250)h+=`<div class="t" style="top:${y(v)};color:#789"><i>${v}</i></div>`;
 ly.list.filter(l=>l.top<=max).forEach(l=>{h+=`<div class="t" style="top:${y(l.top)};border-top:1px solid ${l.c}"><i style="color:${l.c}">${l.top.toFixed(0)}</i>${l.name.replace(/^SIM /,'')}</div>`});
 h+=`<div class="bitm" style="top:${y(bt)}" title="bit"></div>`;el.innerHTML=h;ST.rulerTops=ly.list.filter(l=>l.top<=max).length}
// split view: rig (main 3D) on the left, subsurface on the right (desktop)
export function split(on){const d=$('subsurf');if(!d)return;ST.split=on??!ST.split;if(innerWidth<900)ST.split=false;d.classList.toggle('split',ST.split);$('subSplit').textContent=ST.split?'Full view':'Split view';size()}
function fit(){const a=[...actualPts(),...planPts()];if(!a.length)return;const b=new THREE.Box3().setFromPoints(a),c=b.getCenter(new THREE.Vector3()),r=b.getSize(new THREE.Vector3()).length();ST.ctl.target.copy(c);ST.cam.position.copy(c).add(new THREE.Vector3(r*0.8,r*0.3,r*0.8));ST.follow=false;$('subFollow').textContent='Follow bit: off'}
function hud(){const S=window.S||{},md=(S.md||0)*FT,tvd=-ST.bit.y,li=lithAtBit(tvd),src=window.realMode?.()||'';
 $('subHud').innerHTML=`<b>Subsurface view</b> ${src?'<span style="background:#063;padding:0 4px;border-radius:4px">'+src+'</span>':'<span class="sim">SIM</span>'}<br>
MD <b>${md.toFixed(1)} m</b> · TVD <b>${tvd.toFixed(1)} m</b><br>Inc <b>${(+S.inc||0).toFixed(1)}°</b> · Azi <b>${(+S.azi||0).toFixed(1)}°</b><br>
ROP <b>${((+S.rop||0)*FT).toFixed(1)} m/h</b> · WOB <b>${((+S.wob||0)*0.4536).toFixed(1)} t</b><br>Rock at bit: <b${li?.c?` style="color:${li.c}"`:''}>${li?li.name+' ('+li.lith+')':'unknown'}</b>${li&&/SIM/.test(li.src+li.name)?' <span class="sim">SIM</span>':''}${ST.casing?.run?`<br>Casing: ${ST.casing.run} strings run${/SIM/.test(ST.casing.src)?' <span class="sim">SIM</span>':''}`:''}${ST.gamma!=null?`<br>Gamma <b>${ST.gamma} API</b>`:''}${ST.offsets?'<br>Offset wells: '+ST.offsets:''}`}
function loop(now){if(!ST.open)return;if(now-ST.last>1000){ST.last=now;const prev=ST.bit.clone();build();hud();if(ST.follow){const d=ST.bit.clone().sub(prev);ST.cam.position.add(d);ST.ctl.target.copy(ST.bit)}}
 glow(now);ST.ctl.update();ST.ren.render(ST.scene,ST.cam);ST.raf=requestAnimationFrame(loop)}
function size(){if(!ST.ren)return;ST.ren.setPixelRatio(Math.min(devicePixelRatio||1,Lv().pr));const w=$('subsurf').clientWidth||innerWidth,h=$('subsurf').clientHeight||innerHeight;ST.ren.setSize(w,h,false);ST.cam.aspect=w/h;ST.cam.updateProjectionMatrix()}
export async function open(){if(ST.open)return;if(!$('subsurf'))ui();await loadStrat();$('subsurf').style.display='block';ST.open=true;
 if(!ST.ren){ST.ren=new THREE.WebGLRenderer({canvas:$('subCv'),antialias:q()!='low',preserveDrawingBuffer:true});ST.ren.toneMapping=THREE.ACESFilmicToneMapping;ST.scene=new THREE.Scene();ST.scene.background=new THREE.Color(0x05090e);
  ST.scene.add(new THREE.HemisphereLight(0xcfe3ff,0x302010,1.2));const d=new THREE.DirectionalLight(0xffffff,1.5);d.position.set(300,500,200);ST.scene.add(d);
  ST.cam=new THREE.PerspectiveCamera(50,1,1,50000);ST.ctl=new OrbitControls(ST.cam,$('subCv'));ST.ctl.enableDamping=true;ST.ctl.addEventListener('start',()=>{})}
 size();build();ST.cam.position.copy(ST.bit).add(new THREE.Vector3(250,120,250));ST.ctl.target.copy(ST.bit);hud();ST.last=performance.now();ST.raf=requestAnimationFrame(loop);
 $('subBtn')?.classList.add('on')}
export function close(){ST.open=false;cancelAnimationFrame(ST.raf);if($('subsurf'))$('subsurf').style.display='none';$('subBtn')?.classList.remove('on')}
export const toggle=()=>ST.open?close():open();
export function init(){if(typeof document=='undefined'||window.__subInit)return;window.__subInit=1;
 const b=document.createElement('button');b.id='subBtn';b.textContent='Subsurface';b.title='Live subsurface view (key V, gamepad Y)';b.onclick=toggle;(document.getElementById('hud')||document.body).appendChild(b);
 addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;if(e.key=='v'||e.key=='V')toggle();else if(e.key=='Escape'&&ST.open)close()});
 addEventListener('resize',()=>{if(ST.split&&innerWidth<900)split(false);size()});addEventListener('dw-quality',()=>{if(ST.open){size();build()}});
 const poll=()=>{try{const p=[...(navigator.getGamepads?.()||[])].find(x=>x);const d=!!p?.buttons?.[3]?.pressed;if(d&&!ST.pad)toggle();ST.pad=d}catch(e){}setTimeout(poll,100)};poll();
 const api={open,close,toggle,state:()=>({open:ST.open,layerSrc:ST.layerSrc,bit:ST.bit.toArray(),offsets:ST.offsets||0,follow:ST.follow,split:!!ST.split,glow:ST.glow||0,gamma:ST.gamma??null,rulerTops:ST.rulerTops||0,stratSrc:layers().strat?layers().src:null,casing:ST.casing||null,names:ST.dyn?[...new Set(ST.dyn.children.map(o=>o.name).filter(Boolean))]:[]}),layers,lithAtBit,split,glowOf,casingProgram};const attach=()=>{window.GX=window.GX||{};if(window.GX.subsurface!==api)window.GX.subsurface=api};attach();setInterval(attach,500)}
init();
