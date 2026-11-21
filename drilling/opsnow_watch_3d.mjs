const finite=Number.isFinite;
const lerp=(a,b,t)=>Object.fromEntries(['md','tvd','n','e'].map(k=>[k,a[k]+t*(b[k]-a[k])]));
// Clip every segment, including repeated TVD crossings. Never extrapolate coverage.
export function riskSegments(path,zone){
 const axis=zone.axis==='tvd'?'tvd':'md',lo=axis==='tvd'?zone.from_tvd_m:zone.from_md_m,hi=axis==='tvd'?zone.to_tvd_m:zone.to_md_m;
 if(!finite(lo)||!finite(hi)||hi<lo)return [];const segments=[];
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i];if(![a,b].every(p=>['md','tvd','n','e'].every(k=>finite(p[k])))||b.md<=a.md)continue;
  const d=b[axis]-a[axis];if(!d){if(a[axis]>=lo&&a[axis]<=hi)segments.push([a,b]);continue;}
  let t0=(lo-a[axis])/d,t1=(hi-a[axis])/d;if(t0>t1)[t0,t1]=[t1,t0];t0=Math.max(0,t0);t1=Math.min(1,t1);if(t1>=t0)segments.push([lerp(a,b,t0),lerp(a,b,t1)]);
 }return segments;
}
export function drawRiskBands({g,project,path,zones,width,height,labels=true}){
 let count=0;const placed=[];
 for(const z of zones){
  const segments=riskSegments(path,z);if(!segments.length)continue;count++;const color=z.kind==='geology'?'#b394d8':z.classification==='high-risk'?'#e5ad55':'#d6c478';
  g.save();g.strokeStyle=color;g.fillStyle=color;g.globalAlpha=.22;g.lineWidth=z.classification==='high-risk'?16:6;g.lineCap='round';
  for(const [a,b]of segments){g.beginPath();g.moveTo(...project(a));g.lineTo(...project(b));g.stroke();}g.globalAlpha=.9;g.lineWidth=1;
  const first=segments[0][0],last=segments.at(-1)[1];for(const p of [first,last]){const q=project(p);g.beginPath();g.arc(q[0],q[1],5,0,Math.PI*2);g.stroke();}
  if(labels&&placed.length<6){const p=segments[0][0],q=project(p);if(!placed.some(v=>Math.hypot(v[0]-q[0],v[1]-q[1])<45)){
   const tvds=segments.flat().map(p=>p.tvd),str=`${first.md.toFixed(0)}–${last.md.toFixed(0)} m MD · ${Math.min(...tvds).toFixed(1)}–${Math.max(...tvds).toFixed(1)} m TVD`;
   g.font='11px system-ui';const x=Math.max(5,Math.min(width-g.measureText(str).width-5,q[0]+10)),y=Math.max(14,Math.min(height-22,q[1]-10));g.globalAlpha=1;g.fillText(z.label.slice(0,38),x,y);g.fillText(str,x,y+13);placed.push(q);
  }}g.restore();
 }return count;
}
