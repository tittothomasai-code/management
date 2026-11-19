// Rectangular target planes in the local north/east/TVD frame, metres.
import {atMD} from './bha-builder/shared/wp-autotrack-core.js';
const R=Math.PI/180,EPS=1e-6,dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),dir=p=>[Math.sin(p.inc*R)*Math.cos(p.azi*R),Math.sin(p.inc*R)*Math.sin(p.azi*R),Math.cos(p.inc*R)];
export function validateWindows(windows=[]){
 if(!Array.isArray(windows)||windows.length>12)throw Error('Use at most 12 rectangular target windows.');const ids=new Set();
 for(const w of windows){if(!w||typeof w.id!=='string'||!w.id.trim()||w.id.length>60||ids.has(w.id))throw Error('Target windows need unique names of 1–60 characters.');ids.add(w.id);if(!['n','e','tvd'].every(k=>Number.isFinite(w[k])&&Math.abs(w[k])<1e7)||!Number.isFinite(w.inc)||w.inc<0||w.inc>180||!Number.isFinite(w.azi)||w.azi<0||w.azi>=360||!['widthM','heightM'].every(k=>Number.isFinite(w[k])&&w[k]>=.1&&w[k]<=1000))throw Error('Window coordinates must be finite; orientation is normal Inc 0–180°, Azi 0–<360°; width/height 0.1–1,000 m.');}return windows;
}
export function windowFrame(w){const normal=dir(w),right=[-Math.sin(w.azi*R),Math.cos(w.azi*R),0],up=[-Math.cos(w.inc*R)*Math.cos(w.azi*R),-Math.cos(w.inc*R)*Math.sin(w.azi*R),Math.sin(w.inc*R)];return {normal,right,up};}
export function windowCorners(w){const {right,up}=windowFrame(w);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>Object.fromEntries(['n','e','tvd'].map((k,i)=>[k,w[k]+u*w.widthM/2*right[i]+v*w.heightM/2*up[i]])));}
// Exact plane distance along each minimum-curvature arc. Split at all derivative
// extrema first, so a crossing between survey endpoints cannot be skipped.
function crossings(a,b,w){
 const {normal,right,up}=windowFrame(w),u=dir(a),end=dir(b),cos=Math.max(-1,Math.min(1,dot(u,end))),beta=Math.acos(cos),L=b.md-a.md,d0=dot([a.n-w.n,a.e-w.e,a.tvd-w.tvd],normal),A=dot(u,normal),v=beta<1e-8?[0,0,0]:end.map((x,i)=>(x-u[i]*cos)/Math.sin(beta)),B=dot(v,normal),distance=t=>d0+(beta<1e-8?L*A*t:L/beta*(A*Math.sin(beta*t)+B*(1-Math.cos(beta*t))));
 const bounds=[0,1];if(beta>=1e-8){const root=Math.atan2(-A,B);for(let k=-2;k<=2;k++){const t=(root+k*Math.PI)/beta;if(t>1e-10&&t<1-1e-10)bounds.push(t);}}bounds.sort((a,b)=>a-b);const hits=[];
 for(let j=1;j<bounds.length;j++){let lo=bounds[j-1],hi=bounds[j],dl=distance(lo),dh=distance(hi);if(dl>EPS||dh<-EPS||dh-dl<1e-9)continue;for(let k=0;k<40;k++){const mid=(lo+hi)/2;if(distance(mid)<0)lo=mid;else hi=mid;}const t=Math.abs(dl)<EPS?bounds[j-1]:Math.abs(dh)<EPS?bounds[j]:(lo+hi)/2;const forwardSpeed=beta<1e-8?A:A*Math.cos(beta*t)+B*Math.sin(beta*t);if(forwardSpeed<=1e-8)continue;const p=atMD([a,b],a.md+L*t),relative=[p.n-w.n,p.e-w.e,p.tvd-w.tvd],x=dot(relative,right),y=dot(relative,up),missM=Math.hypot(Math.max(0,Math.abs(x)-w.widthM/2),Math.max(0,Math.abs(y)-w.heightM/2));hits.push({...p,u:x,v:y,missM});}return hits;
}
export function checkWindows(path,windows=[]){
 validateWindows(windows);if(!windows.length)return [];let previous=-Infinity;
 return windows.map(w=>{const hits=[];for(let k=1;k<path.length;k++)hits.push(...crossings(path[k-1],path[k],w));const forward=hits.filter(p=>p.md>=previous-EPS),hit=forward.find(p=>p.missM<=EPS),nearest=forward.reduce((a,b)=>!a||b.missM<a.missM?b:a,null);if(hit){previous=hit.md;return {id:w.id,status:'passed',crossing:hit,missM:0,reason:'Forward crossing inside the rectangle, in target order.'};}const {normal}=windowFrame(w),gap=path.length?Math.min(...path.map(p=>Math.abs(dot([p.n-w.n,p.e-w.e,p.tvd-w.tvd],normal)))):1e3;return {id:w.id,status:!forward.length&&hits.length?'out-of-order':nearest?'missed':'not-reached',crossing:nearest,missM:nearest?.missM??Math.max(.1,gap),reason:nearest?'Forward plane crossing is outside the rectangle.':hits.length?'Window crossing is before the preceding target.':'No forward crossing of the target plane.'};});
}
export function windowsFromPath(path){const end=path.at(-1);return [120,240,end.md].filter(md=>md>=path[0].md&&md<=end.md).map((md,i)=>{const p=atMD(path,md);return {id:md===end.md?'Landing window':'Window '+(i+1),n:p.n,e:p.e,tvd:p.tvd,inc:p.inc,azi:p.azi,widthM:24,heightM:24,followLanding:md===end.md};});}
