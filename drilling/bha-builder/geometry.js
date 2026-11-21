import {buildPdcBit} from './pdc-bit.js';
// Original metre-scale models. Representative tool geometry, not manufacturer CAD.
export function createToolLibrary(T){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 const normalData=new Uint8Array(64*64*4),grainData=new Uint8Array(64*64*4);for(let i=0;i<4096;i++){normalData.set([128+(i%17===0?3:0),128,255,255],i*4);const value=200+(i*13%27);grainData.set([value,value,value,255],i*4);}
 const normal=new T.DataTexture(normalData,64,64),grain=new T.DataTexture(grainData,64,64);for(const map of [normal,grain]){map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(2,8);map.needsUpdate=true;textures.add(map);}
 const mat=(color,metalness=.85,roughness=.3)=>{const m=new T.MeshStandardMaterial({color,metalness,roughness,normalMap:normal,normalScale:new T.Vector2(.14,.14),roughnessMap:grain});materials.add(m);return m;};
 const steel=mat('#a4b1b9'),dark=mat('#22313c',.65,.42),gold=mat('#ba944e'),blue=mat('#356b81',.55,.36),rubber=mat('#202a2b',.02,.85),cutter=mat('#4a5357',.9,.22);
 function model(c,tier=0){
  const n=[64,24,8][tier],r=c.odIn*.0254/2,bore=c.idIn*.0254/2,L=c.lengthM,neck=Math.min(r*.98,Math.max(r*.72,bore*1.04)),end=Math.min(.10,L*.18),root=new T.Group();root.name=c.kind;root.userData={uid:c.uid,kind:c.kind,units:'metres'};
  let current;const part=(name,internal=false)=>{current=new T.Group();current.name=name;current.userData={uid:c.uid,part:name,internal};current.visible=!internal;root.add(current);return current;};
  function mesh(geo,m=steel,pos=[0,0,0]){if(!geo.attributes.uv){const a=geo.attributes.position,uv=new Float32Array(a.count*2);for(let i=0;i<a.count;i++){uv[i*2]=a.getX(i)/(r*2)+.5;uv[i*2+1]=a.getY(i)/L;}geo.setAttribute('uv',new T.BufferAttribute(uv,2));}geometries.add(geo);const o=new T.Mesh(geo,m);o.position.set(...pos);o.userData.uid=c.uid;current.add(o);return o;}
  const cyl=(rad,h,y,m=steel,x=0,z=0)=>mesh(new T.CylinderGeometry(rad,rad,h,n),m,[x,y,z]);
  function body(outer,inner,height,y,m=steel,open=false){const points=[[inner,-height/2],[outer,-height/2],[outer,height/2],[inner,height/2],[inner,-height/2]].map(([x,z])=>new T.Vector2(x,z));return mesh(new T.LatheGeometry(points,n,open?Math.PI*.4:0,open?Math.PI*1.2:Math.PI*2),m,[0,y,0]);}
  function ring(rad,tube,y,m=steel){const o=mesh(new T.TorusGeometry(rad,tube,tier===0?8:4,n),m,[0,y,0]);o.rotation.x=Math.PI/2;return o;}
  function helix(rad,length,y,turns,tube,m=steel,phase=0){const path=new class extends T.Curve{getPoint(t,target=new T.Vector3()){const a=t*Math.PI*2*turns+phase;return target.set(Math.sin(a)*rad,y+t*length,Math.cos(a)*rad);}};return mesh(new T.TubeGeometry(path,tier===0?Math.min(256,Math.max(48,Math.ceil(turns*20))):tier===1?48:12,tube,tier===0?6:4,false),m);}
  function blade(angle,y0,y1,inner,outer,twist=.5,m=gold){const steps=tier===0?20:tier===1?8:2,positions=[];for(let i=0;i<steps;i++){const a=angle+twist*i/steps,b=angle+twist*(i+1)/steps,ya=y0+(y1-y0)*i/steps,yb=y0+(y1-y0)*(i+1)/steps,half=.12;const corners=[];for(const [y,theta]of [[ya,a],[yb,b]])for(const rad of [inner,outer])for(const shift of [-half,half])corners.push([Math.sin(theta+shift)*rad,y,Math.cos(theta+shift)*rad]);for(const idx of [0,2,1,1,2,3,4,5,6,5,7,6,0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5])positions.push(...corners[idx]);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return mesh(geo,m);}
  function connection(y,upper){part(upper?'uphole-connection':'downhole-connection');body(neck,bore,end,y+(upper?-end/2:end/2),steel);if(tier<2){const y0=upper?L-end:.004;helix(neck*.997,end*.85,y0,7,r*.012,dark);ring(neck*.98,r*.018,upper?L-end:L>2?end:end*.9,dark);}}
  if(c.kind==='mwd-battery'){
   root.userData.units='illustrative';part('battery-casing');body(r*.96,0,L*.83,L*.5,steel);part('insulated-end-caps');for(const y of [L*.07,L*.93])cyl(r*.94,L*.055,y,rubber);part('terminal-contacts');for(const y of [L*.03,L*.97])cyl(r*.47,L*.04,y,gold);part('casing-seams');for(const y of [.15,.5,.85])ring(r*.97,r*.018,L*y,dark);part('retaining-sleeve');body(r*.99,r*.97,L*.1,L*.5,blue);part('illustrative-cell-stack',true);for(let i=0;i<3;i++){const y=L*(.23+i*.27);cyl(r*.8,L*.24,y,gold);for(const off of [-.12,.12])cyl(r*.83,L*.015,y+L*off,rubber);}return root;
  }
  const bit=c.type==='Bit',stabilized=c.type==='Stabilizer',pipe=['hwdp','drill-pipe'].includes(c.kind);
  const outer=stabilized?Math.max(bore*1.05,r*.6):pipe?Math.max(bore*1.04,r*.7):r*.965;
  if(!bit){part('tool-housing');const profile=[[bore,0],[neck,0],[neck,end],[outer,end*1.2],[outer,L-end*1.2],[neck,L-end],[neck,L],[bore,L],[bore,0]].map(p=>new T.Vector2(...p));mesh(new T.LatheGeometry(profile,n),c.type==='MWD'?blue:steel);connection(0,false);connection(L,true);}
  if(c.kind==='pdc-bit')buildPdcBit(T,{r,L,bore,n,tier,part,mesh,steel,dark,gold,cutter});
  else if(bit){
   part('bit-body');const inner=c.kind==='core-bit'?bore:0,points=[[inner,0],[r*.65,0],[r*.96,L*.12],[r*.92,L*.4],[neck,L*.65],[neck,L],[Math.max(inner,bore),L],[inner,0]].map(p=>new T.Vector2(...p));mesh(new T.LatheGeometry(points,n),gold);connection(L,true);
   if(c.kind==='roller-bit'){
    part('roller-cones');for(let j=0;j<3;j++){const a=j*Math.PI*2/3,o=mesh(new T.ConeGeometry(r*.3,Math.min(L*.3,r*.7),n),steel,[Math.sin(a)*r*.4,L*.24,Math.cos(a)*r*.4]);o.rotation.set(Math.PI,0,.35);o.rotation.y=a;if(tier<2)for(let i=0;i<8;i++){const theta=i*Math.PI/4;cyl(r*.035,L*.09,L*.07,cutter,Math.sin(a)*r*.48+Math.sin(theta)*r*.25,Math.cos(a)*r*.48+Math.cos(theta)*r*.25);}}
   }else{
    part('cutting-blades');const blades=c.kind==='core-bit'?8:5;for(let j=0;j<blades;j++){const angle=j*Math.PI*2/blades;blade(angle,L*.02,L*.32,Math.max(inner,r*.35),r*.99,.35,gold);if(tier<2){part('cutters');for(let i=0;i<(tier===0?7:3);i++){const rad=Math.max(inner+r*.06,r*.3)+i*(r*.6/(tier===0?7:3)),a=angle+i*.045;const o=cyl(r*.055,r*.04,L*.04,cutter,Math.sin(a)*rad,Math.cos(a)*rad);o.rotation.x=.2;}part('cutting-blades');}}
    part('fluid-nozzles');for(let j=0;j<3;j++){const a=j*Math.PI*2/3+.6;const o=cyl(r*.07,L*.035,L*.03,dark,Math.sin(a)*r*.5,Math.cos(a)*r*.5);o.rotation.z=.2;}
   }
  }
  if(c.kind==='motor'||c.kind==='rss'){
   part('bearing-housing');body(r*.99,bore,Math.min(L*.15,.65),Math.min(L*.12,.5),steel);for(const y of [L*.12,L*.16,L*.78])ring(r*.97,r*.018,y,dark);
   if(c.kind==='motor'){part('power-section');if(tier<2)helix(r*.972,L*.55,L*.23,5,r*.009,dark);part('helical-rotor',true);helix(r*.40,L*.55,L*.23,5,r*.13,steel);part('stator',true);body(r*.78,r*.53,L*.55,L*.505,rubber,true);part('drive-shaft',true);cyl(r*.2,L*.25,L*.18);part('bearing-pack',true);for(let i=0;i<(tier===0?10:3);i++)ring(r*.48,r*.08,L*.05+i*Math.min(L*.01,.04),steel);}
   else{part('steering-pads');for(let j=0;j<3;j++)blade(j*Math.PI*2/3,L*.15,L*.25,r*.88,r*.995,0,gold);}
  }
  if(c.type==='MWD'){
   part('sensor-bands');const bands=c.kind==='resistivity'?8:c.kind==='sonic'?10:4;for(let i=0;i<bands;i++)body(r*.99,bore,Math.min(.035,L*.015),L*(.25+.5*i/bands),i%2?gold:dark);
   part('sensor-windows');for(let j=0;j<4;j++){const a=j*Math.PI/2;const o=mesh(new T.BoxGeometry(r*.16,Math.min(.16,L*.1),r*.06),dark,[Math.sin(a)*r*.96,L*.52,Math.cos(a)*r*.96]);o.rotation.y=a;}
   if(Array.isArray(c.mwdBatteries)&&c.mwdBatteries.length){part('mwd-battery-pack',true);const count=Math.min(8,c.mwdBatteries.length),h=L*.28/count;for(let i=0;i<count;i++){const y=L*.08+h*(i+.5),rad=Math.max(r*.15,Math.min(r*.7,bore*.8));cyl(rad,h*.85,y,steel);for(const off of [-.43,.43])cyl(rad*.45,h*.04,y+off*h,gold);}}
   part('electronics',true);for(let i=0;i<6;i++)cyl(r*.5,L*.04,L*(.25+i*.08),i%2?dark:gold);
  }
  if(stabilized){part(c.kind==='reamer'?'roller-cutters':'stabilizer-blades');const count=c.kind==='hole-opener'?4:3;for(let j=0;j<count;j++)blade(j*Math.PI*2/count,L*.22,L*.78,outer,r*.99,c.kind==='straight-stabilizer'?0:.8,gold);if(c.kind==='reamer'&&tier<2)for(let j=0;j<3;j++)for(let i=0;i<6;i++){const a=j*Math.PI*2/3,y=L*(.3+i*.07);cyl(r*.065,r*.06,y,cutter,Math.sin(a)*r*.9,Math.cos(a)*r*.9);}}
  if(['gap-sub','float-sub','safety','jar','shock','ubho','near-bit','crossover','core-ring','fishing-sub'].includes(c.kind)){
   part('service-features');const gap=c.kind==='gap-sub';for(const t of (gap?[.42,.48,.54]:[.22,.28,.72,.78]))body(r*.99,bore,Math.min(.018,L*.025),L*t,gap?rubber:dark);
   if(['jar','shock'].includes(c.kind)){part('sliding-mandrel');body(Math.max(bore*1.02,r*.78),bore,L*.35,L*.5,steel);if(tier<2)for(let i=0;i<8;i++)helix(r*.97,L*.12,L*.5,1,r*.012,dark,i*Math.PI/4);}
   if(c.kind==='float-sub'){part('check-valve',true);const valve=cyl(Math.max(bore*.95,r*.2),L*.04,L*.45,gold);valve.rotation.z=.3;}
   if(c.kind==='ubho'){part('orientation-sleeve',true);body(r*.65,bore,L*.35,L*.5,gold,true);}
  }
  if(['spiral-collar','nmdc'].includes(c.kind)&&tier<2){part('machined-flutes');for(let j=0;j<3;j++)helix(r*.967,L*.7,L*.15,1.2,r*.008,dark,j*Math.PI*2/3);}
  if(pipe){part('tool-joints');for(const y of [end*1.5,L-end*1.5])body(r*.995,bore,end*1.5,y,steel);if(c.kind==='hwdp'){part('centre-upset');body(r*.97,bore,Math.min(.4,L*.08),L*.5,steel);}}
  if(c.kind==='core-barrel'){part('inner-barrel',true);body(bore*.95,bore*.8,L*.9,L*.5,steel);part('core-catcher');body(r*.97,bore,end,end,gold);}
  return root;
 }
 return {model,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},release(root){root.traverse(o=>{if(o.geometry){o.geometry.dispose();geometries.delete(o.geometry);}});},setCutaway(root,value){root.traverse(o=>{if(o.userData.internal)o.visible=value;if(o.name==='tool-housing'||o.name==='battery-casing')o.visible=!value;});}};
}
