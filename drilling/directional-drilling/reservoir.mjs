// A deformable SIM reservoir in the same local north/east/TVD frame as the game.
export const SURFACE_SHAPES=['rolling','flat','dome','basin','saddle','folded'];
export function createReservoir(kop){return {shape:'rolling',scaleN:55,scaleE:70,n:kop.n+420,e:kop.e+38,centerTvd:kop.tvd+300,thickness:24,tiltN:.025,tiltE:-.01,warp:5,widthN:200,widthE:220};}
export function validateReservoir(r){for(const k of ['n','e','centerTvd','thickness','tiltN','tiltE','warp','widthN','widthE'])if(!Number.isFinite(r[k]))throw Error('Reservoir settings must be finite.');if(Math.abs(r.centerTvd)>5000||r.thickness<2||r.thickness>100||Math.abs(r.tiltN)>.35||Math.abs(r.tiltE)>.35||r.warp<0||r.warp>20||r.widthN<50||r.widthE<50)throw Error('Use 2–100 m thickness, dip slopes ±0.35 and contour warp 0–20 m.');if(!SURFACE_SHAPES.includes(r.shape??'rolling')||![r.scaleN??55,r.scaleE??70].every(v=>Number.isFinite(v)&&v>=20&&v<=200))throw Error('Choose a surface shape and 20–200 m contour scales.');return r;}
export function surfaceRelief(r,dn,de){
 const N=r.scaleN??55,E=r.scaleE??70,u=dn/N,v=de/E;let h=0,du=0,dv=0;
 switch(r.shape??'rolling'){
  case 'flat':break;
  case 'dome':case 'basin':{const f=Math.exp(-.5*(u*u+v*v)),sign=r.shape==='dome'?1:-1;h=sign*(1-f);du=sign*u*f;dv=sign*v*f;break;}
  case 'saddle':{const a=u*u-v*v,d=1+u*u+v*v;h=a/d;du=2*u*(1+2*v*v)/(d*d);dv=-2*v*(1+2*u*u)/(d*d);break;}
  case 'folded':{const a=u+.6*Math.sin(v);h=Math.sin(a);du=Math.cos(a);dv=.6*Math.cos(v)*Math.cos(a);break;}
  default:h=Math.sin(u)*Math.cos(v);du=Math.cos(u)*Math.cos(v);dv=-Math.sin(u)*Math.sin(v);
 }
 return {height:r.warp*h,gradientN:r.warp*du/N,gradientE:r.warp*dv/E};
}
export function surfaceAt(r,n,e,{outside=false}={}){const dn=n-r.n,de=e-r.e;if(!outside&&(Math.abs(dn)>r.widthN/2+1e-7||Math.abs(de)>r.widthE/2+1e-7))return null;const relief=surfaceRelief(r,dn,de),mid=r.centerTvd+r.tiltN*dn+r.tiltE*de+relief.height;return {mid,roof:mid-r.thickness/2,floor:mid+r.thickness/2,gradientN:r.tiltN+relief.gradientN,gradientE:r.tiltE+relief.gradientE};}

export function alignReservoirTargets(g){const r=validateReservoir(g.reservoir),landing=g.targets.at(-1);g.landing.heightM=Math.min(g.landing.heightM,Math.max(.5,r.thickness*.8));r.n=landing.n;r.e=landing.e;
 for(const t of g.targets){if(t.passed)continue;if(t.role==='entry'){t.n=landing.n-g.landing.entryDistance*Math.cos(g.landing.azi*Math.PI/180);t.e=landing.e-g.landing.entryDistance*Math.sin(g.landing.azi*Math.PI/180);}const surface=surfaceAt(r,t.n,t.e);if(t.role==='landing'||t.role==='entry')t.tvd=surfaceAt(r,t.n,t.e,{outside:true}).mid;else if(surface)t.tvd=Math.min(t.tvd,surface.floor-Math.min(2,r.thickness*.2));}
}
export function floorConflict(path,r,fromMd){
 const lerp=(a,b,t)=>Object.fromEntries(['n','e','tvd','md'].map(k=>[k,a[k]+(b[k]-a[k])*t])),depth=p=>{const s=surfaceAt(r,p.n,p.e);return s?s.floor-p.tvd:null;};
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(b.md<fromMd-1e-7)continue;const cuts=[Math.max(0,(fromMd-a.md)/(b.md-a.md)),1];for(const [axis,half]of [['n',r.widthN/2],['e',r.widthE/2]])for(const bound of [r[axis]-half,r[axis]+half]){const t=(bound-a[axis])/(b[axis]-a[axis]);if(t>cuts[0]&&t<1)cuts.push(t);}cuts.sort((x,y)=>x-y);
  for(let j=1;j<cuts.length;j++){const lo=cuts[j-1],hi=cuts[j];for(let k=0;k<=2;k++){const t=lo+(hi-lo)*k/2,p=lerp(a,b,t),d=depth(p);if(d!==null&&d<-.00001){let left=Math.max(lo,t-(hi-lo)/2),right=t;for(let z=0;z<30;z++){const mid=(left+right)/2,clear=depth(lerp(a,b,mid));if(clear===null||clear>=0)left=mid;else right=mid;}return {md:Math.max(fromMd,lerp(a,b,left).md-.001),point:p,clearanceM:d,reason:'Planned line crosses the reservoir floor.'};}}}
 }return null;
}
