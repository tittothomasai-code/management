// rig.js (feat/rig-realism): land-rig derrick and box-on-box substructure with dimensions in the
// proportions of API Spec 4F (derrick size 18A: 30 ft base square, 23 ft 8 in V-window,
// 7 ft 6 in drawworks window, 5 ft 6 in top opening, 12 ft gin-pole clearance) and IADC
// floor-safety items (handrails 1.07 m, mid-rail, toe board, caged ladder). Physically based
// materials (paint = dielectric, galvanised grating = metal) and a 3-level THREE.LOD so phones
// draw few members. All geometry is procedural and written for this project. Visual only:
// it does not change physics, animation or the click entity of the old mast group.
let THREE,C,lod=null,cur=-1,qual='high';
const FT=0.3048;
// ---------- dimensions (metres) ----------
export function dims(MH){return {
 height:MH,                       // floor to bottom of crown support beams (game rig: 40 m, ~131 ft)
 base:30*FT,                      // nominal base square, heel to heel (API 4F size 18A)
 top:5.5*FT,                      // smallest clear opening at the water table
 vWindow:(23+8/12)*FT,            // V-door window opening from the base plate
 dwWindow:7.5*FT,                 // drawworks window opening
 ginPole:12*FT,                   // gin pole clearance above the crown support beam
 rackBoard:26.5,                  // racking (monkey) board height above floor, for ~27 m stands (triples)
 floorH:0,                        // filled in init: drill floor height above pad
 rail:1.07,midRail:0.53,toe:0.1}} // floor handrail heights (top rail, mid rail, toe board)
// ---------- procedural PBR maps ----------
function grainTex(seed,scale){const n=128,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d'),d=g.createImageData(n,n);let s=seed;const r=()=>((s=(s*16807)%2147483647)/2147483647);
 for(let i=0;i<n*n;i++){const v=200-r()*scale-(r()<0.01?70:0);d.data[i*4]=d.data[i*4+1]=d.data[i*4+2]=v;d.data[i*4+3]=255}
 g.putImageData(d,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
function gratingTex(){const n=128,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d');g.fillStyle='#202020';g.fillRect(0,0,n,n);g.fillStyle='#d0d0d0';
 for(let i=0;i<n;i+=8)g.fillRect(i,0,3,n);for(let j=0;j<n;j+=32)g.fillRect(0,j,n,2);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,6);return t}
export function materials(){const rough=grainTex(7,60),rough2=grainTex(11,90),grate=gratingTex();
 const S=(o)=>new THREE.MeshStandardMaterial(o);
 return {
  paint:S({name:'rigPaint',color:0xc9c4b8,metalness:0,roughness:0.55,roughnessMap:rough}),       // off-white epoxy on structural steel
  red:S({name:'rigRed',color:0xa8281e,metalness:0,roughness:0.5,roughnessMap:rough}),
  safety:S({name:'rigSafety',color:0xe3b21c,metalness:0,roughness:0.5,roughnessMap:rough}),     // safety yellow rails / toe boards
  galv:S({name:'rigGalv',color:0xa7acb0,metalness:1,roughness:0.45,roughnessMap:rough2}),       // hot-dip galvanised steel
  grate:S({name:'rigGrate',color:0x8f9499,metalness:1,roughness:0.6,roughnessMap:grate,bumpMap:grate,bumpScale:0.02}),
  sheave:S({name:'rigSheave',color:0x6b7076,metalness:1,roughness:0.35}),
  lamp:S({name:'rigLamp',color:0xfff6d0,emissive:0xfff2b0,emissiveIntensity:1.4,metalness:0,roughness:0.4})}}
// ---------- member builder (one InstancedMesh per material + section) ----------
class Members{constructor(){this.L=new Map()}
 add(m,a,b,w,h=w){const k=m.name+'|'+w+'|'+h;if(!this.L.has(k))this.L.set(k,{m,w,h,list:[]});this.L.get(k).list.push([a.clone(),b.clone()])}
 build(name){const g=new THREE.Group();g.name=name;const up=new THREE.Vector3(0,1,0),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3(),M=new THREE.Matrix4();let n=0;
  for(const {m,w,h,list} of this.L.values()){const geo=new THREE.BoxGeometry(1,1,1);const im=new THREE.InstancedMesh(geo,m,list.length);
   list.forEach(([a,b],i)=>{const d=b.clone().sub(a),L=d.length();q.setFromUnitVectors(up,d.normalize());s.set(w,L,h);p.copy(a).lerp(b,0.5);M.compose(p,q,s);im.setMatrixAt(i,M)});
   im.castShadow=im.receiveShadow=true;im.userData.noLod=true;im.computeBoundingSphere();g.add(im);n+=list.length}
  g.userData.members=n;return g}}
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
// ---------- derrick ----------
function derrick(D,F,lvl,mt){const B=new Members(),hb=D.base/2,ht=D.top/2+0.35,H=D.height,top=F+H;
 const leg=(sx,sz,y)=>{const f=(y-F)/H,r=hb+(ht-hb)*f;return V(sx*r,y,sz*r)};
 const C4=[[-1,-1],[1,-1],[1,1],[-1,1]];// sides: 0 = -z (drawworks), 1 = +x, 2 = +z (V-door), 3 = -x
 for(const [sx,sz] of C4)B.add(mt.paint,leg(sx,sz,F),leg(sx,sz,top),lvl==2?0.4:0.32);
 // panel heights: shorter panels near the top where the legs are closer
 const ys=[F];let y=F,ph=4.2;while(y<top-1){y=Math.min(top,y+ph);ys.push(y);ph=Math.max(2.4,ph*0.93)}if(ys.at(-1)<top)ys.push(top);
 const step=lvl==0?1:lvl==1?1:3;
 for(let i=0;i<ys.length;i+=step){const yy=ys[i];if(yy==F)continue;
  for(let s=0;s<4;s++){if(s==2&&yy<F+D.vWindow)continue;if(s==0&&yy<F+D.dwWindow)continue;const [a,b]=[C4[s],C4[(s+1)%4]];B.add(mt.paint,leg(a[0],a[1],yy),leg(b[0],b[1],yy),lvl==2?0.25:0.16)}}
 if(lvl<2){// X bracing on each side panel; V-door side open below the V-window, drawworks side open below its window
  for(let i=0;i+1<ys.length;i++){const y0=ys[i],y1=ys[i+1];for(let s=0;s<4;s++){if(s==2&&y0<F+D.vWindow-0.1)continue;if(s==0&&y0<F+D.dwWindow-0.1)continue;const [a,b]=[C4[s],C4[(s+1)%4]];
   B.add(mt.paint,leg(a[0],a[1],y0),leg(b[0],b[1],y1),0.1);if(lvl==0)B.add(mt.paint,leg(b[0],b[1],y0),leg(a[0],a[1],y1),0.1)}}
  // V-window header and drawworks-window header (heavier girts)
  B.add(mt.paint,leg(1,1,F+D.vWindow),leg(-1,1,F+D.vWindow),0.26);B.add(mt.paint,leg(-1,-1,F+D.dwWindow),leg(1,-1,F+D.dwWindow),0.22)}
 // water table, crown support beams and gin pole
 const wt=ht+0.5;for(const z of[-1,1]){B.add(mt.red,V(-wt,top,z*wt),V(wt,top,z*wt),0.4,0.5);B.add(mt.red,V(z*wt,top,-wt),V(z*wt,top,wt),0.4,0.5)}
 for(const x of[-0.55,0.55])B.add(mt.red,V(x,top+0.25,-wt),V(x,top+0.25,wt),0.3,0.5);
 for(const x of[-wt,wt])B.add(mt.paint,V(x,top,0),V(x,top+D.ginPole,0),0.22);B.add(mt.paint,V(-wt,top+D.ginPole,0),V(wt,top+D.ginPole,0),0.24);
 if(lvl<2){// racking board on the setback side with fingers
  const ry=F+D.rackBoard,r=leg(1,1,ry).x;B.add(mt.galv,V(-r-0.6,ry,-r-0.9),V(r+0.6,ry,-r-0.9),0.12,0.6);B.add(mt.safety,V(-r-0.6,ry+1.07,-r-1.3),V(r+0.6,ry+1.07,-r-1.3),0.06);
  for(let k=-6;k<=6;k++){if(lvl==1&&k%3)continue;const x=k*0.32;B.add(mt.galv,V(x,ry+0.05,-r-0.6),V(x,ry+0.05,-r+0.9),0.06)}
  // crown platform handrail
  for(const z of[-1,1])B.add(mt.safety,V(-wt-0.4,top+1.3,z*(wt+0.4)),V(wt+0.4,top+1.3,z*(wt+0.4)),0.05)}
 if(lvl==0){// caged ladder up the off-drawworks leg (-x,+z), rungs every 0.3 m
  for(let yy=F+0.3;yy<top;yy+=0.3*4){const p=leg(-1,1,yy);B.add(mt.galv,V(p.x-0.35,yy,p.z+0.05),V(p.x-0.35,yy,p.z+0.55),0.04)}
  for(let yy=F+2.2;yy<top;yy+=1.5){const p=leg(-1,1,yy);B.add(mt.safety,V(p.x-0.9,yy,p.z),V(p.x-0.9,yy,p.z+0.7),0.04)}}
 const g=B.build('derrick'+lvl);
 // crown block sheaves (round, cylinders) at the drill line height used by main.js
 const inst=(geo,m,pts,rz)=>{const im=new THREE.InstancedMesh(geo,m,pts.length),M=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(V(0,0,1),rz),one=V(1,1,1);
  pts.forEach((p,i)=>im.setMatrixAt(i,M.compose(p,q,one)));im.castShadow=m!==mt.lamp;im.userData.noLod=true;im.computeBoundingSphere();g.add(im);return im};
 if(lvl<2){const n=lvl==0?6:3,dx=lvl==0?0.3:0.6;inst(new THREE.CylinderGeometry(0.7,0.7,0.22,lvl==0?28:12),mt.sheave,[...Array(n)].map((_,i)=>V(-0.75+i*dx,top+1.3,0)),Math.PI/2)}
 if(lvl==0)inst(new THREE.BoxGeometry(0.35,0.25,0.25),mt.lamp,[1,2,3,4].map(i=>{const yy=F+i*8.5,p=leg(1,1,yy);return V(p.x+0.2,yy,p.z+0.2)}),0);
 return g}
// ---------- substructure (box-on-box) and drill floor ----------
function substructure(D,F,lvl,mt){const B=new Members(),W=D.base/2+1.2,L=8.5,boxW=2.4;
 for(const sx of[-1,1]){const x=sx*(W-boxW/2);// two side boxes running along z, each a braced truss of four chords
  const ch=[[x-boxW/2,0.3],[x+boxW/2,0.3],[x-boxW/2,F-0.4],[x+boxW/2,F-0.4]];
  for(const [cx,cy] of ch)B.add(mt.paint,V(cx,cy,-L),V(cx,cy,L),0.45);
  const nb=lvl==2?2:lvl==1?4:8;for(let i=0;i<=nb;i++){const z=-L+2*L*i/nb;for(const cx of[x-boxW/2,x+boxW/2]){B.add(mt.paint,V(cx,0.3,z),V(cx,F-0.4,z),0.35);if(lvl<2&&i<nb)B.add(mt.paint,V(cx,0.3,z),V(cx,F-0.4,z+2*L/nb),0.18)}
   if(lvl<2)B.add(mt.paint,V(x-boxW/2,F-0.4,z),V(x+boxW/2,F-0.4,z),0.25)}}
 // rotary beams and setback beams spanning the boxes (clear height under rotary beams for the BOP stack)
 for(const z of[-1.1,1.1])B.add(mt.red,V(-W,F-0.35,z),V(W,F-0.35,z),0.5,0.7);
 if(lvl<2)for(const z of[-4.5,-3])B.add(mt.paint,V(-W,F-0.35,z),V(W,F-0.35,z),0.4,0.6);
 const g=B.build('sub'+lvl);
 // drill floor: galvanised grating with a steel plate around the rotary
 const fl=new THREE.Mesh(new THREE.BoxGeometry(2*W,0.4,2*L),mt.grate);fl.position.set(0,F,0);fl.receiveShadow=fl.castShadow=true;fl.userData.noLod=true;g.add(fl);
 if(lvl<2){const R=new Members(),e=W-0.05,l=L-0.05;// handrails: top rail 1.07 m, mid rail, toe board; V-door side left open for the catwalk
  const run=(a,b)=>{R.add(mt.safety,V(a[0],F+0.2+D.rail,a[1]),V(b[0],F+0.2+D.rail,b[1]),0.05);if(lvl==0){R.add(mt.safety,V(a[0],F+0.2+D.midRail,a[1]),V(b[0],F+0.2+D.midRail,b[1]),0.04);R.add(mt.safety,V(a[0],F+0.25,a[1]),V(b[0],F+0.25,b[1]),0.02,D.toe)}};
  run([-e,-l],[e,-l]);run([-e,-l],[-e,l]);run([e,-l],[e,l]);run([-e,l],[-1.8,l]);run([1.8,l],[e,l]);
  if(lvl==0)for(const [x,z] of[[-e,-l],[e,-l],[-e,l],[e,l],[-e,0],[e,0],[0,-l]])R.add(mt.safety,V(x,F+0.2,z),V(x,F+0.2+D.rail,z),0.05);
  // stairs from the pad to the floor on the -x side (about 40 degrees)
  const sx=-W-0.6,run0=F/Math.tan(40*Math.PI/180);R.add(mt.galv,V(sx-0.5,0.3,-1-run0),V(sx-0.5,F,-1),0.08,0.25);R.add(mt.galv,V(sx+0.5,0.3,-1-run0),V(sx+0.5,F,-1),0.08,0.25);
  const nst=Math.round(F/0.2);for(let i=1;i<nst;i+=lvl==0?1:3){const t=i/nst;R.add(mt.grate,V(sx-0.5,0.3+t*(F-0.3),-1-run0*(1-t)),V(sx+0.5,0.3+t*(F-0.3),-1-run0*(1-t)),0.03,0.25)}
  R.add(mt.safety,V(sx-0.55,1.3,-1-run0),V(sx-0.55,F+1.0,-1),0.05);
  g.add(R.build('floorRails'))}
 return g}
// ---------- LOD ----------
function pick(){if(!lod)return -1;const i=lod.getCurrentLevel();return i}
export function setQuality(q){qual=q;if(!lod)return;const near=q=='low'?0:q=='medium'?60:90;lod.levels[1].distance=near;lod.levels[2].distance=q=='low'?120:q=='medium'?180:240;}
export function init(ctx){C=ctx;THREE=ctx.THREE;const F=ctx.FLOOR,MH=ctx.MH;const D=dims(MH);D.floorH=F;const mt=materials();
 // hide the old placeholder lattice in rigG (kept, not removed: the click entity and the rotary + casing stay)
 let hidden=0;for(const o of ctx.rigG.children){if(!o.isMesh)continue;const p=o.geometry.parameters||{};
  const isRot=o.geometry.type=='CylinderGeometry'&&Math.abs(p.radiusTop-1.2)<1e-6&&Math.abs(p.height-0.5)<1e-6;const isCsg=o.geometry.type=='CylinderGeometry'&&Math.abs(p.radiusTop-0.35)<1e-6;
  if(!isRot&&!isCsg&&!o.userData.keep){o.visible=false;o.userData.rigOld=true;hidden++}}
 // the old mast lamps from visual.js sat on the old leg line: hide them, the new derrick has its own
 const vd=ctx.scene.getObjectByName('visualDetail');if(vd)vd.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissiveIntensity>1&&o.geometry.type=='BoxGeometry'){o.visible=false;o.userData.rigOld=true}});
 // ext2.js 'v32visuals' added X-bracing, floor rails, fingers and a ladder on the old leg line: hide those (doghouse, guide rails, crown cluster stay)
 const v32=ctx.scene.getObjectByName('v32visuals');if(v32){const hx=new Set(['b5a032','d8c020','e0b020']);for(const o of v32.children){if(!o.isMesh||!o.material||!o.material.color)continue;
  if(hx.has(o.material.color.getHexString())&&Math.abs(o.position.x)<7.5&&Math.abs(o.position.z)<7.5){o.visible=false;o.userData.rigOld=true;hidden++}}}
 lod=new THREE.LOD();lod.name='rigLOD';if('hysteresis' in lod)lod.hysteresis=0.1;
 const counts=[];for(let l=0;l<3;l++){const g=new THREE.Group();g.name='rigL'+l;const d=derrick(D,F,l,mt),s=substructure(D,F,l,mt);g.add(d,s);
  let n=0,draws=0;g.traverse(o=>{if(o.isInstancedMesh){n+=o.count;draws++}else if(o.isMesh){n++;draws++}});counts.push({members:n,draws});lod.addLevel(g,[0,90,240][l])}
 lod.traverse(o=>{o.userData.ent=ctx.rigG.userData.ent||(ctx.rigG.children[0]&&ctx.rigG.children[0].userData.ent)});
 ctx.scene.add(lod);
 const q0=(window.GX&&GX.quality&&GX.quality.get())||'high';setQuality(q0);addEventListener('dw-quality',e=>setQuality(e.detail));
 window.GX=window.GX||{};window.GX.rig={dims:D,counts,hidden,level:()=>lod.getCurrentLevel(),quality:()=>qual,lod,materials:mt,standard:'API Spec 4F size 18A proportions'};
 return window.GX.rig}
