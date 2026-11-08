// edmstats.js v5.9.4.2: per-wellbore / per-well statistics, well-type classification, field filters and field-level stats for the EDM sites view.
// Pure functions (node + browser). All lengths metres, angles degrees, DLS °/30 m. Marked IMPORT data — planning aid only.
const D=Math.PI/180,r1=v=>v==null||!Number.isFinite(v)?null:Math.round(v*10)/10;
export const KOP_INC=3,LAND_INC=80,VERT_INC=10;
// stats from full-resolution stations {md,inc,azi,tvd,ew,ns}
export function trajStats(pts){if(!pts?.length)return null;let maxInc=0,maxIncMD=null,maxDls=0,maxDlsMD=null,kop=null,land=null,landTVD=null;
 for(let i=0;i<pts.length;i++){const p=pts[i],inc=+p.inc||0;if(inc>maxInc){maxInc=inc;maxIncMD=p.md}if(kop==null&&inc>=KOP_INC){let j=i;while(j>0&&(+pts[j-1].inc||0)>1)j--;kop=Math.max(0,j?pts[j-1].md:p.md)}if(land==null&&inc>=LAND_INC){land=p.md;landTVD=p.tvd}
  if(i){const a=pts[i-1],dmd=p.md-a.md;if(dmd>0.5){const i1=(+a.inc||0)*D,i2=inc*D,da=((+p.azi||0)-(+a.azi||0))*D;const c=Math.cos(i2-i1)-Math.sin(i1)*Math.sin(i2)*(1-Math.cos(da));const dl=Math.acos(Math.max(-1,Math.min(1,c)))/D*30/dmd;if(dl>maxDls){maxDls=dl;maxDlsMD=p.md}}}}
 const e=pts.at(-1),disp=Math.hypot(e.ew||0,e.ns||0),az=disp>0.5?((Math.atan2(e.ew,e.ns)/D)+360)%360:null;
 return {n:pts.length,md0:r1(pts[0].md),md1:r1(e.md),tvd:r1(e.tvd),maxInc:r1(maxInc),maxIncMD:r1(maxIncMD),maxDls:r1(maxDls),maxDlsMD:r1(maxDlsMD),kop:r1(kop),land:r1(land),landTVD:r1(landTVD),lat:land!=null?r1(e.md-land):null,disp:r1(disp),cAz:r1(az),approx:false}}
// fallback for older saved sites: approximate from the decimated display path {md,E,N,Z,tvd}
export function pathStats(path,E0,N0){if(!path?.length)return null;const pts=path.map((p,i)=>{let inc=0,azi=0;const q=path[i+1]||p,o=path[i-1]||p,a=i<path.length-1?p:o,b=i<path.length-1?q:p;const dh=Math.hypot(b.E-a.E,b.N-a.N),dz=b.tvd-a.tvd;if(dh+Math.abs(dz)>0.01){inc=Math.atan2(dh,dz)/D;azi=(Math.atan2(b.E-a.E,b.N-a.N)/D+360)%360}return {md:p.md,inc,azi,tvd:p.tvd,ew:p.E-E0,ns:p.N-N0}});
 const s=trajStats(pts);if(s){s.approx=true;s.n=null}return s}
export function wbStats(b,well){return b.st||(b.path?pathStats(b.path,well?.E??b.path[0].E,well?.N??b.path[0].N):null)}
export function wellType(maxInc){return maxInc==null?'Unknown':maxInc>=LAND_INC?'Horizontal':maxInc>=VERT_INC?'Directional':'Vertical'}
// per-well aggregate; wbOf(id)→wellbore
export function wellStats(W,w,wbOf){if(w._st)return w._st;const bs=w.wbs.map(wbOf).filter(Boolean);const ss=bs.map(b=>[b,wbStats(b,w)]).filter(x=>x[1]);
 const main=ss.slice().sort((a,b)=>(b[1].md1||0)-(a[1].md1||0))[0];const M=main?.[1]||{};const max=k=>ss.reduce((a,[,s])=>s[k]!=null&&(a==null||s[k]>a)?s[k]:a,null);
 const surveys=bs.flatMap(b=>(b.traj||[]).filter(t=>t.kind!='plan')),plans=bs.flatMap(b=>(b.traj||[]).filter(t=>t.kind=='plan')).length+bs.reduce((a,b)=>a+(b.designs||[]).filter(d=>d.phase&&d.phase!='ACTUAL').length,0);
 const cas=bs.flatMap(b=>b.casing||[]);const sizes=[...new Set(cas.map(a=>a.size).filter(v=>v!=null).map(Number))].sort((a,b)=>b-a);
 const dates=bs.flatMap(b=>(b.traj||[]).filter(t=>t.kind!='plan'&&t.date).map(t=>t.date)).sort();const mds=surveys.map(t=>t.mdMax).filter(v=>v!=null);
 const maxInc=max('maxInc');
 const pos=v=>v!=null&&v>0?v:null;return w._st={td:(a=>a.length?Math.max(...a):null)([pos(w.td),pos(M.md1)].filter(v=>v!=null)),tvd:pos(M.tvd)??pos(w.tvd),maxInc,maxDls:max('maxDls'),lat:max('lat'),disp:max('disp'),cAz:M.cAz??null,kop:M.kop??null,land:M.land??null,landTVD:M.landTVD??null,
  nWb:w.wbs.length,nCas:cas.length,casSizes:sizes,nSurv:surveys.length,nStations:surveys.reduce((a,t)=>a+(t.stations||0),0),mdRange:mds.length?[0,Math.max(...mds)]:null,nPlan:plans,
  spud:w.spud||dates[0]||null,spudSrc:w.spud?'record':dates[0]?'first survey':null,type:wellType(maxInc),approx:ss.some(([,s])=>s.approx),operator:w.operator||W.customer||null,field:w.project||null,status:w.status}}
// ---- filters ----
export function emptyFilter(){return {q:'',sites:[],status:[],field:[],op:[],type:[],td:[null,null],inc:[null,null],spud:[null,null],has:{survey:null,plan:null,casing:null},only:true}}
export function active(F){if(!F)return 0;let n=0;if(F.q?.trim())n++;for(const k of ['sites','status','field','op','type'])if(F[k]?.length)n++;for(const k of ['td','inc','spud'])if(F[k]&&(F[k][0]!=null&&F[k][0]!==''||F[k][1]!=null&&F[k][1]!==''))n++;for(const k in F.has||{})if(F.has[k]!=null)n++;return n}
const inR=(v,[a,b])=>{const lo=a===''||a==null?null:+a,hi=b===''||b==null?null:+b;if(lo==null&&hi==null)return true;if(v==null)return false;return (lo==null||v>=lo)&&(hi==null||v<=hi)};
const inD=(v,[a,b])=>{if(!a&&!b)return true;if(!v)return false;const d=String(v).slice(0,10);return (!a||d>=a)&&(!b||d<=b)};
export function match(W,w,F,wbOf){if(!active(F))return true;const s=wellStats(W,w,wbOf);const q=F.q?.trim().toLowerCase();
 if(q&&!(w.name||'').toLowerCase().includes(q)&&!(w.siteName||'').toLowerCase().includes(q))return false;
 if(F.sites?.length&&!F.sites.includes(w.site))return false;if(F.status?.length&&!F.status.includes(w.status))return false;if(F.field?.length&&!F.field.includes(s.field||'(none)'))return false;if(F.op?.length&&!F.op.includes(s.operator||'(none)'))return false;if(F.type?.length&&!F.type.includes(s.type))return false;
 if(!inR(s.td,F.td||[])||!inR(s.maxInc,F.inc||[])||!inD(s.spud,F.spud||[]))return false;const H=F.has||{};
 if(H.survey!=null&&(s.nSurv>0)!=H.survey)return false;if(H.plan!=null&&(s.nPlan>0)!=H.plan)return false;if(H.casing!=null&&(s.nCas>0)!=H.casing)return false;return true}
export function mask(W,F,wbOf){const m=new Uint8Array(W.wells.length);W.wells.forEach((w,i)=>{m[i]=match(W,w,F,wbOf)?1:0});return m}
export function hist(vals,bins=10,lo=null,hi=null){const v=vals.filter(x=>x!=null&&Number.isFinite(x));if(!v.length)return {lo:0,hi:0,step:0,c:[]};lo=lo??Math.min(...v);hi=hi??Math.max(...v);if(hi<=lo)hi=lo+1;const step=(hi-lo)/bins,c=new Array(bins).fill(0);for(const x of v)c[Math.min(bins-1,Math.max(0,Math.floor((x-lo)/step)))]++;return {lo,hi,step,c}}
export function fieldStats(W,m,wbOf){const ws=W.wells.filter((w,i)=>!m||m[i]);const S=ws.map(w=>wellStats(W,w,wbOf));const by=k=>{const o={};for(const s of S){const v=s[k]||'(none)';o[v]=(o[v]||0)+1}return o};const sum=k=>r1(S.reduce((a,s)=>a+(s[k]||0),0));
 const sites=new Set(ws.map(w=>w.site));return {wells:ws.length,sites:sites.size,wbs:S.reduce((a,s)=>a+s.nWb,0),totMD:sum('td'),totLat:sum('lat'),surveys:S.reduce((a,s)=>a+s.nSurv,0),casing:S.reduce((a,s)=>a+s.nCas,0),
  status:by('status'),type:by('type'),field:by('field'),op:by('operator'),tdH:hist(S.map(s=>s.td),10,0),incH:hist(S.map(s=>s.maxInc),9,0,90),maxTD:S.reduce((a,s)=>Math.max(a,s.td||0),0)||null,avgTD:(n=>n?r1(S.reduce((a,s)=>a+(s.td||0),0)/n):null)(S.filter(s=>s.td).length)}}
