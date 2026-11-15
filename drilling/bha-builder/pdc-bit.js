// Original five-blade PDC geometry. The cutting face is at the downhole end (Y=0).
// Dimensions follow the entered envelope. The profile is visual, not certified tool CAD.
export function buildPdcBit(T,{r,L:overallLength,bore,n,tier,part,mesh,steel,dark,gold,cutter}){
 const L=Math.min(overallLength,.18*(2*r/(6.125*.0254))),extension=overallLength-L,bodyExtra=extension*.6;
 const cutR=Math.min(.0065,r*.0835,L*.075),cutH=Math.min(.008,r*.105,L*.07),inlet=Math.max(bore,r*.18);
 const profile=[[0,.13*L],[.25*r,.13*L],[.58*r,.20*L],[.70*r,.36*L],[.69*r,.54*L],[.70*r,.58*L],[.70*r,.77*L+bodyExtra],[.56*r,.81*L+bodyExtra],[.56*r,overallLength],[inlet,overallLength],[inlet,.68*L],[0,.68*L],[0,.13*L]];
 part('crown');const crownPoints=[],subdivisions=[8,3,1][tier];for(let k=0;k<profile.length-1;k++)for(let i=0;i<subdivisions;i++){const t=i/subdivisions;crownPoints.push(new T.Vector2(profile[k][0]+(profile[k+1][0]-profile[k][0])*t,profile[k][1]+(profile[k+1][1]-profile[k][1])*t));}crownPoints.push(new T.Vector2(...profile.at(-1)));const crownGeometry=new T.LatheGeometry(crownPoints,tier===0?96:n);
 // Cut the nozzle cylinders through the crown surface. Sleeves cover the cut rims.
 if(tier<2){const position=crownGeometry.attributes.position,indices=crownGeometry.index.array,kept=[],center=new T.Vector3(),vertex=new T.Vector3();for(let i=0;i<indices.length;i+=3){center.set(0,0,0);for(let j=0;j<3;j++)center.add(vertex.fromBufferAttribute(position,indices[i+j]));center.multiplyScalar(1/3);let opening=false;for(let j=0;j<5;j++){const angle=j*Math.PI*2/5+.84,origin=new T.Vector3(Math.sin(angle)*r*.47,L*.17,Math.cos(angle)*r*.47),axis=new T.Vector3(Math.sin(angle)*.28,-.96,Math.cos(angle)*.28).normalize(),delta=center.clone().sub(origin),along=delta.dot(axis),radial=delta.addScaledVector(axis,-along).length();if(along>-L*.078&&along<L*.026&&radial<r*.078){opening=true;break;}}if(!opening)kept.push(indices[i],indices[i+1],indices[i+2]);}crownGeometry.setIndex(kept);}mesh(crownGeometry,steel);
 // Two machined wrench flats on the cylindrical body below the gauge section.
 part('bit-body');const shape=new T.Shape(),samples=[64,24,12][tier];for(let i=0;i<=samples;i++){const a=i/samples*Math.PI*2,x=T.MathUtils.clamp(Math.sin(a)*r*.88,-r*.73,r*.73),z=Math.cos(a)*r*.88;i?shape.lineTo(x,z):shape.moveTo(x,z);}shape.closePath();const hole=new T.Path();hole.absarc(0,0,inlet,0,Math.PI*2,true);shape.holes.push(hole);
 const body=new T.ExtrudeGeometry(shape,{depth:L*.18+bodyExtra,bevelEnabled:tier<2,bevelThickness:L*.006,bevelSize:r*.009,bevelSegments:tier===0?3:1,steps:1,curveSegments:tier===0?24:tier===1?12:6});body.rotateX(Math.PI/2);mesh(body,steel,[0,L*.76+bodyExtra,0]);
 const path=new T.CatmullRomCurve3([[.12,.09],[.35,.035],[.65,.065],[.89,.15],[.97,.28],[.97,.55]].map(([radius,y])=>new T.Vector3(radius*r,y*L,0)),false,'centripetal');
 const point=(base,t)=>{const p=path.getPoint(t),a=base+.62*t;return {radius:p.x,y:p.y,angle:a};};
 function sweep(base,steps,topRadius,rootRadius,yStart,yEnd,halfWidth){const positions=[],indices=[];for(let i=0;i<=steps;i++){
  const t=i/steps;let radius,y,a;if(topRadius){radius=topRadius;y=yStart+(yEnd-yStart)*t;a=base+.47+.15*t;}else{const p=point(base,t);radius=p.radius;y=p.y;a=p.angle;}
  const inner=topRadius?rootRadius:Math.max(radius*.64,r*.045),back=topRadius?y:y+L*.10;
  for(const [rr,yy]of [[radius,y],[inner,back]])for(const shift of [-halfWidth,halfWidth])positions.push(Math.sin(a+shift)*rr,yy,Math.cos(a+shift)*rr);
  if(i<steps){const k=i*4;for(const offset of [0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5])indices.push(k+offset);}
 }
 indices.push(0,2,1,1,2,3);const end=steps*4;indices.push(end,end+1,end+2,end+1,end+3,end+2);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;}
 part('blades');for(let j=0;j<5;j++){const blade=mesh(sweep(j*Math.PI*2/5,[28,12,4][tier],null,null,null,null,.16),gold);blade.name='blade-'+(j+1);}
 part('gauge-pads');for(let j=0;j<5;j++){const pad=mesh(sweep(j*Math.PI*2/5,[12,5,2][tier],r*.992,r*.945,L*.31,L*.55,.10),steel);pad.name='gauge-pad-'+(j+1);}
 // Cutter faces follow the curved crown and gauge. Their axes face the leading
 // side of each blade, with a back-rake component toward the local rock surface.
 part('cutters');const count=[10,6,3][tier],segments=[24,12,6][tier],yAxis=new T.Vector3(0,1,0);
 for(let j=0;j<5;j++)for(let i=0;i<count;i++){
  const t=.10+i/(count-1)*.79,base=j*Math.PI*2/5,p=point(base,t),a=p.angle+.15;
  const before=path.getPoint(Math.max(0,t-.005)),after=path.getPoint(Math.min(1,t+.005)),dy=after.y-before.y,dr=after.x-before.x;
  const normal=new T.Vector3(Math.sin(a)*dy,-dr,Math.cos(a)*dy).normalize(),tangent=new T.Vector3(Math.cos(a),0,-Math.sin(a)),axis=tangent.multiplyScalar(.88).addScaledVector(normal,.48).normalize();
  const radius=Math.min(p.radius,r-cutR*1.3),position=new T.Vector3(Math.sin(a)*radius,Math.max(cutR*1.55,p.y-cutR*.5),Math.cos(a)*radius),rotation=new T.Quaternion().setFromUnitVectors(yAxis,axis);
  const carrier=mesh(new T.CylinderGeometry(cutR,cutR,cutH,segments),steel,position.clone().addScaledVector(axis,-cutH*.30).toArray());carrier.quaternion.copy(rotation);carrier.name='carbide-substrate-'+j+'-'+i;
  const face=mesh(new T.CylinderGeometry(cutR*.98,cutR*.98,cutH*.15,segments),cutter,position.clone().addScaledVector(axis,cutH*.275).toArray());face.quaternion.copy(rotation);face.name='diamond-face-'+j+'-'+i;
  if(tier===0){const edge=mesh(new T.TorusGeometry(cutR*.98,cutR*.035,5,segments),gold,position.clone().addScaledVector(axis,cutH*.35).toArray());edge.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),axis);}
 }
 // Nozzles are open annular sleeves with a throat set behind the metal lip.
 // They sit in the recessed junk channels, rather than on a flat cutting plate.
 part('fluid-nozzles');for(let j=0;j<5;j++){
  const a=j*Math.PI*2/5+.84,position=new T.Vector3(Math.sin(a)*r*.47,L*.17,Math.cos(a)*r*.47),axis=new T.Vector3(Math.sin(a)*.28,-.96,Math.cos(a)*.28).normalize(),q=new T.Quaternion().setFromUnitVectors(yAxis,axis),depth=L*.065;
  const sleeve=new T.LatheGeometry([[r*.064,-depth],[r*.105,-depth],[r*.105,0],[r*.064,0],[r*.064,-depth]].map(v=>new T.Vector2(...v)),segments);
  const nozzle=mesh(sleeve,steel,position.toArray());nozzle.quaternion.copy(q);nozzle.name='nozzle-'+(j+1);
  const throat=mesh(new T.CylinderGeometry(r*.062,r*.062,L*.006,segments),dark,position.clone().addScaledVector(axis,-depth*.94).toArray());throat.quaternion.copy(q);throat.name='recessed-throat-'+(j+1);
  if(tier<2){const lip=mesh(new T.TorusGeometry(r*.0845,r*.012,5,segments),gold,position.toArray());lip.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),axis);}
 }
 if(tier<2){part('gauge-wear-buttons');for(let j=0;j<5;j++)for(let i=0;i<(tier===0?9:3);i++){const a=j*Math.PI*2/5+.52+(i%3-1)*.055,y=L*(.36+Math.floor(i/3)*.06),axis=new T.Vector3(Math.sin(a),0,Math.cos(a)),button=mesh(new T.CylinderGeometry(r*.025,r*.025,r*.014,tier===0?12:6),cutter,[Math.sin(a)*r*.991,y,Math.cos(a)*r*.991]);button.quaternion.setFromUnitVectors(yAxis,axis);}}
 part('uphole-connection');if(tier<2){const threadLength=L*.18+extension*.4,turns=Math.min(120,Math.max(7,Math.round(threadLength/(L*.18/7))));const threadPath=new class extends T.Curve{getPoint(t,target=new T.Vector3()){const a=t*Math.PI*2*turns;return target.set(Math.sin(a)*r*.56,L*.81+bodyExtra+threadLength*t,Math.cos(a)*r*.56);}};mesh(new T.TubeGeometry(threadPath,tier===0?Math.min(600,turns*24):Math.min(240,turns*8),Math.min(r*.012,L*.008),tier===0?6:4,false),dark);}
}
