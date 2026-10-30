// subtarget.js (helper D, feat/target-sub): SIM target band in the subsurface view (subsurface.js belongs to helper C).
// Hook: subsurface.js build() dispatches 'dw-sub-build' {group,THREE}; this module adds the band to that group.
// Band = strat.targetFn(reservoir) top/base along the section azimuth, swept ±halfW m across. Data is SIM, never LIVE.
import * as THREE from 'three';
const ST={on:true,azi:45,len:1500,step:25,halfW:60,last:null};
async function strat(){if(window.GX?.strat?.targetFn)return window.GX.strat;try{return await import('./strat.js?v=b6')}catch{return null}}
// pure: sample band rows {x,E,N,top,base,th}
export function sample(fn,azi=45,len=1500,step=25){const a=azi*Math.PI/180,r=[];for(let x=0;x<=len+1e-6;x+=step){const g=fn(x);if(!(isFinite(g.top)&&isFinite(g.base)))continue;r.push({x,E:x*Math.sin(a),N:x*Math.cos(a),top:g.top,base:g.base,th:g.base-g.top})}return r}
export function stats(rows){if(!rows?.length)return null;const th=rows.map(r=>r.th),tp=rows.map(r=>r.top);return {n:rows.length,thMin:Math.min(...th),thMax:Math.max(...th),topMin:Math.min(...tp),topMax:Math.max(...tp),src:'SIM'}}
// sheet across section: two edges offset ±halfW perpendicular to azimuth; coordinates x=E, y=-TVD, z=-N (as subsurface.js)
function sheet(rows,key,azi,halfW){const a=azi*Math.PI/180,pe=Math.cos(a),pn=-Math.sin(a),pos=[],idx=[];
 rows.forEach((r,i)=>{for(const s of [-1,1])pos.push(r.E+s*halfW*pe,-r[key],-(r.N+s*halfW*pn));if(i){const b=2*i;idx.push(b-2,b-1,b,b-1,b+1,b)}});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}
function label(txt){const c=document.createElement('canvas');c.width=256;c.height=48;const x=c.getContext('2d');x.fillStyle='#000a';x.fillRect(0,0,256,48);x.fillStyle='#ffe066';x.font='bold 26px sans-serif';x.fillText(txt,10,33);
 const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true}));s.scale.set(160,30,1);s.renderOrder=5;return s}
export async function add(group){const m=await strat();if(!m||!ST.on||!group)return null;let M,ti;try{M=m.model();ti=m.formationIndex('reservoir',M)}catch{return null}if(!(ti>=0))return null;
 const rows=sample(m.targetFn(ti,ST.azi,0,0,M),ST.azi,ST.len,ST.step);if(rows.length<2)return null;const G=new THREE.Group();G.name='target_band_SIM';
 const mt=new THREE.MeshStandardMaterial({color:0xffd23f,emissive:0x664400,transparent:true,opacity:0.45,side:THREE.DoubleSide,depthWrite:false,depthTest:false});
 for(const k of ['top','base']){const me=new THREE.Mesh(sheet(rows,k,ST.azi,ST.halfW),mt);me.name='target_'+k+'_SIM';me.renderOrder=4;G.add(me)}
 const lp=k=>rows.map(r=>new THREE.Vector3(r.E,-r[k],-r.N));for(const k of ['top','base'])G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lp(k)),new THREE.LineBasicMaterial({color:0xffe066})));
 const r0=rows[Math.floor(rows.length/2)],l=label('TARGET (SIM)');l.position.set(r0.E,-r0.top+25,-r0.N);G.add(l);
 group.add(G);ST.last=stats(rows);return G}
export function init(){if(typeof window=='undefined'||window.__subTgt)return;window.__subTgt=1;addEventListener('dw-sub-build',e=>add(e.detail?.group));
 const api={stats:()=>ST.last,cfg:ST,sample,src:'SIM'},at=()=>{window.GX=window.GX||{};if(window.GX.subtarget!==api)window.GX.subtarget=api};at();setInterval(at,500)}
init();
