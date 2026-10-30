// Mud in the 3D scene (SIM). Active pit + trip tank beside the mud pumps.
// Fluid level follows the well-control pit volumes; colour follows mud type and density.
import * as THREE from 'three';
const COL={wbm:0x8a6a45,obm:0x3b2c1e};
export function mount(G,st){
  const sc=G._scene;if(!sc)return null;
  const pump=(G.ents||[]).find(e=>/^Mud pump/.test(e.name));
  const base=pump?pump.obj.position.clone():new THREE.Vector3(-14,0,8);
  const root=new THREE.Group();root.name='SIM mud tanks';root.position.copy(base).add(new THREE.Vector3(0,0,-7));
  const steel=new THREE.MeshStandardMaterial({color:0x6d7780,metalness:.6,roughness:.5,transparent:true,opacity:.35,side:THREE.DoubleSide});
  const mk=(w,h,d,x,cap)=>{const t=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),steel);t.position.set(x,h/2,0);root.add(t);
    const m=new THREE.MeshStandardMaterial({color:COL.wbm,roughness:.25,metalness:.1});
    const f=new THREE.Mesh(new THREE.BoxGeometry(w*.96,1,d*.96),m);f.position.set(x,0,0);root.add(f);return{f,m,h,cap,area:w*d}};
  // active pit 8×2.4×3 m (~58 m³ usable), trip tank 1.2×3×1.2 m (~4.3 m³)
  const act=mk(8,2.4,3,0,58),trip=mk(1.2,3,1.2,5.2,4.3);
  const foam=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(120*3),3)),new THREE.PointsMaterial({color:0xeeeeee,size:.12}));foam.visible=false;root.add(foam);
  sc.add(root);
  const set=(T,vol)=>{const fr=Math.max(.02,Math.min(1,vol/T.cap));const hh=T.h*.96*fr;T.f.scale.y=hh;T.f.position.y=hh/2;return fr};
  const api={root,act,trip,level:{act:0,trip:0},alive:true};
  const tick=()=>{if(!api.alive)return;const wc=st.wc,p=wc?.pits;
    const a=p?p.active:60,t=p?p.trip:3;
    api.level.act=set(act,a);api.level.trip=set(trip,t);
    const sg=wc?.mud?.sg??st.mud.sg,k=String((wc?.mud||st.mud)?.type||st.mudK||'wbm').toLowerCase(),c=new THREE.Color(COL[k]||COL.wbm);
    c.offsetHSL(0,0,Math.max(-.08,Math.min(.12,(sg-1.2)*.25)));// heavier mud (barite) looks greyer/lighter
    act.m.color.copy(c);trip.m.color.copy(c);
    const gas=!!(wc&&(wc.venting||wc.gasAtSurface||(wc.gasTop!=null&&wc.gasTop<5&&wc.gasV>0)));foam.visible=gas;
    if(gas){const P=foam.geometry.attributes.position;for(let i=0;i<120;i++)P.setXYZ(i,(Math.random()-.5)*7.6,act.f.scale.y+Math.random()*.25,(Math.random()-.5)*2.8);P.needsUpdate=true}
  };
  tick();const iv=setInterval(tick,200);api.update=tick;
  api.remove=()=>{api.alive=false;clearInterval(iv);sc.remove(root)};
  return api;
}
