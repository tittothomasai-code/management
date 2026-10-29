// slips.js v4.5: infer the slips state from BIT DEPTH alone (no slips curve, no hookload). Pure functions, no DOM, no network.
// Idea: while the string hangs in the slips the bit cannot move, so bit depth is flat (within a tolerance) for a dwell, the bit is
// a little off bottom, and (if those curves exist) block/hook height travels while bit depth stays put, pumps and rotation are off.
// Afterwards drilling resumes about one joint/stand deeper (confirmation). Every result is labelled 'Inferred from bit depth'.
export const LABEL='Inferred from bit depth';
export const SDEFAULTS={flatTol_m:0.2,minDwell_s:30,offBottomMin_m:0.3,nearBottomMax_m:6,flowOffFrac:0.10,rpmOff:5,minBlockTravel_m:3,resume_s:1800,minNewHole_m:0.3,minConf:0.5};
const fin=Number.isFinite;
const q=(a,p)=>{const s=a.filter(fin).sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.max(0,Math.round(p*(s.length-1))))]:NaN};
function prep(rows){const r=rows.filter(x=>fin(x.t)&&fin(x.bd)).map(x=>({...x})).sort((a,b)=>a.t-b.t);let mx=-Infinity;
 for(const x of r){mx=Math.max(mx,x.bd);if(fin(x.hd))mx=Math.max(mx,x.hd);x.hd=fin(x.hd)?Math.max(x.hd,x.bd):mx}return r}
// rows: [{t,bd,hd?,bh?,flow?,rpm?}] (SI). hookload / slips fields are ignored on purpose.
export function infer(rows0,opt={}){const o={...SDEFAULTS,...opt},R=prep(rows0),n=R.length,out={label:LABEL,params:o,intervals:[],rows:R,current:{inSlips:false,conf:0}};
 if(n<3)return out;
 const has=k=>R.filter(x=>fin(x[k])).length>n*0.5,hasF=has('flow'),hasR=has('rpm'),hasB=has('bh');
 const flowThr=Math.max(1,o.flowOffFrac*(q(R.map(x=>x.flow),0.9)||0));out.channels={flow:hasF,rpm:hasR,block:hasB};
 const off=x=>x.hd-x.bd>o.offBottomMin_m;let i=0;
 while(i<n){if(!off(R[i])){i++;continue}let lo=R[i].bd,hi=lo,j=i;
  while(j+1<n&&off(R[j+1])&&Math.max(hi,R[j+1].bd)-Math.min(lo,R[j+1].bd)<=2*o.flatTol_m&&R[j+1].hd-R[i].hd<o.minNewHole_m){j++;lo=Math.min(lo,R[j].bd);hi=Math.max(hi,R[j].bd)}
  const open=j==n-1,dwell=R[j].t-R[i].t;
  if(dwell>=o.minDwell_s||(open&&dwell>=o.minDwell_s*0.5)){out.intervals.push(score(R,i,j,o,{hasF,hasR,hasB,flowThr,open}));i=j+1}else i++}
 // confirmation pass: next drilled interval about one joint/stand deeper
 const C=out.intervals.filter(v=>v.kind=='connection');C.forEach((v,k)=>{const nx=C[k+1];if(nx){const d=nx.hd-v.hd;v.nextLen_m=d;if(d>=8&&d<=31){v.conf=Math.min(1,v.conf+0.1);v.reasons.push('next one '+d.toFixed(1)+' m deeper (≈ joint/stand)')}}});
 out.intervals.forEach(v=>{v.conf=+Math.max(0,Math.min(1,v.conf)).toFixed(2);v.inSlips=v.conf>=o.minConf});
 const last=out.intervals.at(-1);if(last&&last.open&&last.inSlips)out.current={inSlips:true,conf:last.conf,interval:last,provisional:true};
 else if(last&&last.open)out.current={inSlips:false,conf:last.conf,interval:last,possible:true};
 return out}
function score(R,i,j,o,h){const seg=R.slice(i,j+1),n=R.length,a=seg[0],b=seg.at(-1),rs=[];let c=0.35;rs.push('bit depth flat ±'+o.flatTol_m+' m for '+Math.round(b.t-a.t)+' s, off bottom');
 const ob=q(seg.map(x=>x.hd-x.bd),0.5);if(ob<=o.nearBottomMax_m){c+=0.1;rs.push('near bottom ('+ob.toFixed(1)+' m)')}else{c-=0.15;rs.push('far off bottom ('+ob.toFixed(0)+' m)')}
 let tIn=a.t,tOut=(R[j+1]||b).t;
 if(h.hasF){const offs=seg.filter(x=>fin(x.flow)&&x.flow<=h.flowThr);const fr=offs.length/seg.length;if(fr>=0.5){c+=0.2;rs.push('pumps off')}else if(fr<0.1){c-=0.25;rs.push('pumps on')}
  if(offs.length){tIn=offs[0].t;const k=seg.lastIndexOf(offs.at(-1));tOut=(seg[k+1]||R[j+1]||b).t}}
 if(h.hasR){const fr=seg.filter(x=>fin(x.rpm)&&x.rpm<o.rpmOff).length/seg.length;if(fr>=0.5){c+=0.1;rs.push('rotation off')}else if(fr<0.1){c-=0.15;rs.push('rotating')}}
 if(h.hasB){const bh=seg.map(x=>x.bh).filter(fin),tr=Math.max(...bh)-Math.min(...bh);if(tr>=o.minBlockTravel_m){c+=0.15;rs.push('block travelled '+tr.toFixed(1)+' m while bit stayed put');
   const b0=seg.find(x=>fin(x.bh))?.bh;const k=seg.findIndex(x=>x.t>=tIn&&fin(x.bh)&&Math.abs(x.bh-b0)>0.5);if(k>0)tIn=Math.max(tIn,seg[k-1].t)}else{c-=0.1;rs.push('block did not travel')}}
 // afterwards: drilling resumes deeper (connection) or the bit moves away with no new hole (tripping)
 let kind=h.open?'open':'unconfirmed';for(let k=j+1;k<n&&R[k].t-b.t<=o.resume_s;k++){const x=R[k];
  if(x.hd-a.hd>=o.minNewHole_m&&x.hd-x.bd<=o.offBottomMin_m){kind='connection';c+=0.15;rs.push('drilling resumed deeper');break}
  if(Math.abs(x.bd-a.bd)>=5&&x.hd-a.hd<o.minNewHole_m){kind='trip';c-=0.1;rs.push('bit moved '+(x.bd-a.bd).toFixed(0)+' m with no new hole (tripping)');break}}
 return{tIn,tOut,flatFrom:a.t,flatTo:b.t,bd:q(seg.map(x=>x.bd),0.5),hd:a.hd,dwell_s:tOut-tIn,conf:c,kind,open:h.open,reasons:rs,label:LABEL}}
export function stateAt(res,t){const v=res.intervals.find(v=>t>=v.tIn&&t<v.tOut);return v?{inSlips:v.inSlips,conf:v.conf,interval:v}:{inSlips:false,conf:0}}
// per-row flags for conn.js (connection-like and in-slips only)
export function flags(rows,res){return rows.map(x=>{const v=res.intervals.find(v=>v.inSlips&&x.t>=v.tIn&&x.t<v.tOut);return v?v:null})}
// ---- synthetic tripping log (SIM-TEST): stands pulled out of hole, slips set between stands, no drilling ----
export function synthTrip({stands=6,len=28.2,start_m=2000,dt=5,slips_s=60,pull_s=120,noise=0}={}){const rows=[],truth=[];let t=0,bd=start_m;const hd=start_m+0.1;
 const N=()=>noise?(Math.random()*2-1)*noise:0;
 for(let s=0;s<stands;s++){const t0=t;for(let k=0;k<slips_s;k+=dt){rows.push({t,bd:bd+N(),hd,bh:3+20*k/slips_s,rpm:0,flow:0,slips:null,hkl:null});t+=dt}truth.push({tIn:t0,tOut:t,trip:true});
  for(let k=0;k<pull_s;k+=dt){rows.push({t,bd:bd-len*k/pull_s+N(),hd,bh:30-27*k/pull_s,rpm:0,flow:0,slips:null,hkl:null});t+=dt}bd-=len}
 return{rows,truth,label:'SIM-TEST synthetic tripping log'}}
// strip slips + hookload from a log and add bit-depth noise (for tests)
export function strip(rows,{noise=0,seed=1}={}){let s=seed;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};return rows.map(x=>({...x,slips:null,hkl:null,bd:x.bd+(noise?(r()*2-1)*noise:0)}))}
