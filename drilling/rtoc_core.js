// rtoc_core.js: pure (no DOM) helpers for Steve's RTOC. Node-testable.
// Units: the simulator is imperial internally (ft, ft/h, klbf, ft·lbf, psi, gpm). RTOC displays metric.
export const FT=0.3048,KLBF_KN=4.448222,FTLBF_KNM=0.0013558179,PSI_KPA=6.894757,GPM_LPM=3.785412;
export const m=ft=>ft*FT;
// Joint segmentation from recorded samples. A joint ends when slips are SET (connection) and the next joint starts when
// slips are RELEASED. No fixed joint length is assumed. The first joint is flagged partial (recording began mid-joint).
export function segment(samples){const J=[];let cur=null,prev=null;
 for(const s of samples){
  if(!cur&&!s.slips){cur={n:J.length+1,startMd:s.md,startT:s.t,endMd:s.md,endT:s.t,open:true,partial:J.length==0&&!(prev&&prev.slips),slide:0,rotate:0,off:0,i0:samples.indexOf(s),i1:samples.indexOf(s)};J.push(cur)}
  if(cur){if(prev&&!s.slips&&!prev.slips){const d=Math.max(0,s.md-prev.md);if(d>0){if(s.mode=='slide')cur.slide+=d;else cur.rotate+=d}else if(!s.gapBefore)cur.off+=Math.max(0,s.t-prev.t)}
   cur.endMd=Math.max(cur.endMd,s.md);cur.endT=s.t;cur.i1=samples.indexOf(s);
   if(s.slips){cur.open=false;cur=null}}
  prev=s}
 return J}
export function inJoint(samples,j){return samples.slice(j.i0,j.i1+1)}
// Min-curvature path from survey rows [md,inc,azi,N,E,TVD] (ft) -> vertical section along azimuth az0.
export const vs=(N,E,az0)=>N*Math.cos(az0*Math.PI/180)+E*Math.sin(az0*Math.PI/180);
export function interpTvd(surveys,md){if(!surveys.length)return null;if(md<=surveys[0][0])return surveys[0][5];for(let i=1;i<surveys.length;i++){const a=surveys[i-1],b=surveys[i];if(md<=b[0]){const f=(md-a[0])/((b[0]-a[0])||1);return a[5]+(b[5]-a[5])*f}}return null}
// Straight-line estimate from the last survey to a deeper MD at the last inc/azi. Returns {N,E,TVD} or null. ESTIMATE, not a survey.
export function estimateAt(last,md){if(!last||md<=last[0])return null;const d=md-last[0],i=last[1]*Math.PI/180,a=last[2]*Math.PI/180;return {N:last[3]+d*Math.sin(i)*Math.cos(a),E:last[4]+d*Math.sin(i)*Math.sin(a),TVD:last[5]+d*Math.cos(i)}}
export function layerAt(layers,tvd){let L=null,k=-1;(layers||[]).forEach((l,i)=>{if(tvd>=l.top){L=l;k=i}});if(!L)return null;const nx=layers[k+1];return {...L,idx:k,base:nx?nx.top:null}}
export function events(evts,j){return (evts||[]).filter(e=>e[0]>=j.startT-0.001&&e[0]<=j.endT+0.001)}
export function stats(rows,key){const v=rows.map(r=>r[key]).filter(x=>Number.isFinite(x));if(!v.length)return null;let a=0;for(const x of v)a+=x;return {min:Math.min(...v),max:Math.max(...v),avg:a/v.length,n:v.length}}
export function brisbane(d=new Date()){try{return new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d)+' AEST'}catch(e){return d.toISOString()}}
export function isTyping(t){if(!t)return false;const n=(t.tagName||'').toLowerCase();return n=='input'||n=='textarea'||n=='select'||!!t.isContentEditable}
