// dropz_boot.js: attaches the DROPZ training overlay (sealed release 2026-11-08 06:50 AEST) to the REAL game scene. No main.js change.
// Loaded BEFORE home.js so its capture-phase Escape guard runs first: while DROPZ isolation / DROPS mode is active, Escape only restores
// the DROPZ view (no native Home navigation). Otherwise Escape is untouched. SAMPLE register, illustrative positions, training only.
import * as THREE from 'three';
const OVL='[role=dialog],[aria-modal=true],#intro,#start,#splash,#ddTracks,#showroom,#showroomB,#showroomC,#wshop,#ddCab,#ddRun';
const vis=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
addEventListener('keydown',e=>{const D=window.dropz,M=D?.modes;if(e.key!=='Escape'||!M||!(M.isolation?.active||M.mode))return;
 if(e.repeat||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||'')||e.target?.isContentEditable)return;
 const host=D.group&&document.querySelector('.dropz-modebar')?.parentElement;if([...document.querySelectorAll(OVL)].some(x=>!(host&&host.contains(x))&&vis(x)))return;
 M.reset();e.preventDefault();e.stopImmediatePropagation()},true);
async function boot(){const until=Date.now()+60000;while(!window.G?._scene||!window.G?.cam||!window.GX?.rig?.dims||!document.querySelector('body > canvas')){if(Date.now()>until)return;await new Promise(r=>setTimeout(r,200))}
 const [{attachDropz},register]=await Promise.all([import('./dropz.js?v=d20261108a'),fetch('./dropz_register.json?v=d20261108a').then(r=>r.json())]);const G=window.G;
 const ent=n=>{const e=G.ents.find(e=>e.name===n);return e?.group||e?.obj};
 const resolvePosition=(item,i)=>{const spread=(i%3-1)*.7,mast=ent('Rig mast'),o=mast?mast.getWorldPosition(new THREE.Vector3()):new THREE.Vector3();
  if(item.zone==='top drive'){const td=ent('Top drive');if(td){const v=td.getWorldPosition(new THREE.Vector3());return [v.x+1.2+spread,v.y+1+(i%2),v.z+.7]}}
  if(item.zone==='pipe deck'){const cw=ent('Catwalk'),v=cw?cw.getWorldPosition(new THREE.Vector3()):o;return [v.x+15+spread,v.y+1.5,v.z+2+(i%3)]}
  const D=GX.rig.dims,F=D.floorH,ry=F+D.rackBoard,r=(D.base/2)*(1-D.rackBoard/D.height)+(D.top/2)*(D.rackBoard/D.height);
  const L=item.zone==='crown'?[spread,F+D.height+1.3,0]:item.zone==='monkey board'?[spread,ry+.45,-r-.9]:item.zone==='racking board'?[spread,ry+.25,-r+.3]:[-(D.base/2)*(1-Math.min(D.height,item.heightM)/D.height),F+Math.min(D.height,item.heightM),2.6+spread];
  return L.map((v,j)=>v+[o.x,o.y,o.z][j])};
 window.dropz=attachDropz(G._scene,THREE,{register,game:true,camera:G.cam,renderer:null,canvas:document.querySelector('body > canvas'),resolvePosition,
  floorY:item=>item.zone==='pipe deck'?.25:((ent('Rig mast')?.getWorldPosition(new THREE.Vector3()).y)||0)+GX.rig.dims.floorH+.2});
 {const st=document.createElement('style');st.id='dropzBootCss';st.textContent='@media (pointer:coarse),(max-width:760px){.dropz-modebar button,[class*=dropz] button{min-height:44px;min-width:44px}}';document.head.appendChild(st)}
 // honesty banner while the overlay is visible (section: not folded by mobile.js)
 const b=document.createElement('section');b.id='dropzNote';b.setAttribute('role','note');b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:56px;z-index:100013;max-width:min(94vw,760px);background:#2a1208ee;color:#ffd9b0;border:1px solid #ff9a4a;border-radius:8px;padding:6px 10px;font:12px/1.35 system-ui;text-align:center;pointer-events:none;display:none';
 b.textContent='DROPZ TRAINING ILLUSTRATION · SAMPLE register (15 demo items, not a rig inventory or inspection) · positions approximate · red zones are an illustrative assumption, NOT an official DROPS distance or exclusion/safe zone · native asset/BOM mapping not available (0/15 sample items match game catalogue)';
 document.body.appendChild(b);const tick=()=>{const on=!!window.dropz?.group?.visible;if(b.dataset.on!==String(on)){b.dataset.on=on;b.style.setProperty('display',on?'block':'none','important')}setTimeout(tick,250)};tick();window.dropzReady=true}
boot().catch(e=>console.warn('DROPZ overlay unavailable:',e.message));
