// ext14.js v5.6: auto DD Slide Sheet (run sheet), one row per joint, derived ONLY from time/depth log channels + trajectory.
// Joint boundaries = connections from conn.js (slips via hookload<=block weight+margin, bit off bottom, pumps off). Slide vs rotate = surface RPM<5 while drilling (pumps on, bit on bottom, hole depth advancing).
// Cell tags: LIVE (direct channel/station value from a real feed), DERIVED (computed from channels), MANUAL (typed by user), SIM (simulator / not from a real feed), TEST (fixture). Sim/test data is NEVER tagged LIVE.
// No network calls in this file.
import * as CN from './conn.js';
const fin=Number.isFinite,$=id=>document.getElementById(id),es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const med=a=>{const s=a.filter(fin).sort((x,y)=>x-y);return s.length?s[(s.length-1)>>1]*0.5+s[s.length>>1]*0.5:null};
const cmean=a=>{a=a.filter(fin);if(!a.length)return null;let x=0,y=0;for(const d of a){x+=Math.cos(d*Math.PI/180);y+=Math.sin(d*Math.PI/180)}return ((Math.atan2(y,x)*180/Math.PI)+360)%360};
// ---------- channel resolution (internal = field units: m, klbf, psi, gpm, deg) ----------
const MN={hd:/^(DMEA|DEPTH_?HOLE|HDTH|HOLE_?DEPTH|DEPT_HOLE)/i,bd:/^(DBTM|BDEP|BIT_?DEP|BITDEPTH|DBTV?)/i,hkl:/^(HKLA|HKLD|HKL|HOOK)/i,wob:/^(SWOB|WOBA|WOB)/i,rpm:/^(RPMA|TDRPM|SRPM|RPM)/i,flow:/^(TFLO|MFIA|FLOWIN|FLOW)/i,spp:/^(SPPA|SPP)/i,tf:/^(MTF|GTF|TFC|TFACE|TOOLFACE|TF)$/i,azi:/^(DAZI|MWD_?AZI|AZIM?)$/i};
const CV={klbf:1,kn:1/4.44822,'1000lbf':1,lbf:1e-3,kkgf:2.20462,tonne:2.20462,psi:1,kpa:1/6.89476,bar:14.5038,mpa:145.038,gpm:1,'galus/min':1,'l/min':1/3.78541,lpm:1/3.78541,'m3/min':264.172,'m3/s':15850.3,m:1,ft:0.3048,deg:1,dega:1,rad:180/Math.PI,rpm:1,'c/min':1,'1/min':1};
const cv=(u)=>{const k=String(u||'').toLowerCase().replace(/\s/g,'');return CV[k]??1};
export function fromLog(L){const ml=L.ml||[],ul=L.ul||[],ix={},f={};for(const k in MN){const i=ml.findIndex((m,j)=>j!=L.ix&&MN[k].test(String(m).trim()));if(i>=0){ix[k]=i;f[k]=cv(ul[i])}}
 const out=[];for(const r of L.rows){const o={t:r.t};for(const k in ix){const s=r.x[ix[k]];const v=s===''||s==null?NaN:+s;o[k]=fin(v)?v*f[k]:null}out.push(o)}return {samples:out,channels:Object.fromEntries(Object.entries(ix).map(([k,i])=>[k,ml[i]]))}}
// ---------- core derivation ----------
export const OPT={rpmSlide:5,onBot:0.3,flowFrac:0.1,minStep:0.002};
export function derive(samples,o={}){o={...OPT,...o};const R=samples.filter(x=>fin(x.t)).sort((a,b)=>a.t-b.t);const n=R.length;const out={rows:[],conns:[],info:{n}};if(n<5)return out;
 let mx=-1e9;for(const x of R){if(fin(x.hd))mx=Math.max(mx,x.hd);x.hd=mx;if(!fin(x.bd))x.bd=x.hd}
 const fRef=med(R.map(x=>x.flow).filter(v=>v>0))||0,fThr=Math.max(1,o.flowFrac*fRef),hasTf=R.some(x=>fin(x.tf));
 // connections via conn.js (kN / L/min); rpm forced >=5 while pumping so a slide-first joint still counts as "drilling resumed"
 const D=CN.detect(R.map(x=>({t:x.t/1000,bd:x.bd,hd:x.hd,hkl:fin(x.hkl)?x.hkl*4.44822:null,flow:fin(x.flow)?x.flow*3.78541:null,spp:x.spp,rpm:x.flow>fThr?Math.max(10,x.rpm||0):(x.rpm||0)})),{});
 const C=D.connections.map(c=>({tIn:c.tSlipsIn*1000,tOut:c.tSlipsOut*1000,tOff:c.tOff*1000,tOn:c.tOn*1000,depth:c.depth_m,dur_s:c.slips_s}));out.conns=C;out.info.conn=D.info;
 const drill=R.map((x,i)=>i>0&&x.hd-R[i-1].hd>o.minStep&&x.flow>fThr&&x.hd-x.bd<o.onBot);
 const start0=R.find(x=>fin(x.hd)).hd;const bounds=[];let a=0;for(const c of C){bounds.push([a,c.tIn,c]);a=c.tOut}bounds.push([a,Infinity,null]);
 let prevHd=start0,jn=o.firstJoint??1;
 for(const [t0,t1,c] of bounds){const I=[];for(let i=1;i<n;i++)if(R[i].t>t0&&R[i].t<=t1&&drill[i])I.push(i);if(!I.length)continue;
  const md=i=>{const x=R[i];return fin(x.rpm)?(x.rpm<o.rpmSlide?'Slide':'Rotate'):(fin(x.tf)?'Slide':'?')};
  // segments, merged by mode in first-appearance order (max 2 shown, like the sheet)
  const seg=[];for(const i of I){const m=md(i),dm=R[i].hd-R[i-1].hd;let s=seg.find(z=>z.mode==m);if(!s){s={mode:m,m:0,t0:R[i-1].t,idx:[]};seg.push(s)}s.m+=dm;s.idx.push(i);s.t1=R[i].t}
  const tS=R[I[0]-1].t,tE=R[I.at(-1)].t,hd=R[I.at(-1)].hd,len=hd-prevHd;const S1=seg[0],S2=seg[1]||null;if(S2)S2.t0=Math.max(S2.t0,S1.t0);
  const clock1=((S2?S2.t0:tE)-tS)/3.6e6,clock2=S2?(tE-S2.t0)/3.6e6:0;
  const DI=I.map(i=>R[i]),rot=DI.filter(x=>fin(x.rpm)&&x.rpm>=o.rpmSlide),sl=I.filter(i=>md(i)=='Slide').map(i=>R[i]);
  const pre=R.filter(x=>x.t>=t0&&x.t<tS&&x.hd-x.bd>=o.onBot&&x.flow>fThr);const preRot=pre.filter(x=>x.rpm>=o.rpmSlide);
  const post=c?R.filter(x=>x.t>tE&&x.t<=c.tIn):[],k0=c?R.findIndex(x=>x.t>=c.tOut):-1;
  const pu=c?post.filter((x,j)=>j>0&&x.bd<post[j-1].bd-0.01&&x.hd-x.bd>=o.onBot).map(x=>x.hkl):[];
  let so=[];if(c){for(let k=k0;k>0&&k<n&&R[k].t<(bounds.find(b=>b[0]==c.tOut)?.[1]??Infinity);k++){const x=R[k];if(x.flow>fThr||drill[k])break;if(x.bd>R[k-1].bd+0.01)so.push(x.hkl)}}
  const sppOn=med(DI.map(x=>x.spp)),sppOff=med(pre.map(x=>x.spp));
  // pumps-off pause inside the joint without slips (e.g. LCM) -> derived comment
  const notes=[];{let p0=null;for(let i=I[0];i<=I.at(-1);i++){const off=!(R[i].flow>fThr);if(off&&p0==null)p0=i;if(!off&&p0!=null){const dur=(R[i].t-R[p0].t)/6e4;if(dur>=5)notes.push(`Pumps off ${Math.round(dur)} min at ${R[p0].hd.toFixed(1)} m (no slips, not a connection)`);p0=null}}}
  const aziC=c?med(R.filter(x=>x.t>=c.tIn&&x.t<=c.tOut).map(x=>x.azi)):med(R.filter(x=>x.t>tE).map(x=>x.azi));
  out.rows.push({jt:jn++,t0:tS,tDM2:S2?S2.t0:null,t1:tE,hrs:(tE-tS)/3.6e6,len,hd,m1:S1.mode,m1m:S1.m,m1h:clock1,rop1:S1.m/clock1,m2:S2?.mode||'',m2m:S2?S2.m:null,m2h:clock2,rop2:S2?S2.m/clock2:null,trop:len/((tE-tS)/3.6e6),
   tf:sl.length&&hasTf?cmean(sl.map(x=>x.tf)):null,tfSrc:hasTf?'ch':'none',wob:med(DI.map(x=>x.wob)),rpm:rot.length?med(rot.map(x=>x.rpm)):(DI.some(x=>fin(x.rpm))?0:null),flow:med(DI.map(x=>x.flow)),sppOn,sppOff,diff:fin(sppOn)&&fin(sppOff)?sppOn-sppOff:null,
   rot:med(preRot.map(x=>x.hkl)),pu:pu.length?Math.max(...pu.filter(fin)):null,so:med(so),mwdAzi:aziC,conn:c,notes,open:!c,segs:seg.map(s=>({mode:s.mode,m:s.m}))});prevHd=hd}
 return out}
export function surveyFor(rows,stations,bitToSensor=14.73){for(const r of rows){const s=stations.filter(x=>x.md<=r.hd-bitToSensor+0.5).at(-1);r.sv=s||null}return rows}
export function totals(rows){const T={sl:0,slh:0,ro:0,roh:0};for(const r of rows)for(const [m,mm,h] of [[r.m1,r.m1m,r.m1h],[r.m2,r.m2m,r.m2h]]){if(m=='Slide'){T.sl+=mm;T.slh+=h}if(m=='Rotate'){T.ro+=mm;T.roh+=h}}T.slRop=T.slh?T.sl/T.slh:null;T.roRop=T.roh?T.ro/T.roh:null;return T}
// ---------- TEST fixture: synthetic 10 s time log that reproduces the PDF rows ----------
const hm=(s,day0)=>{const [h,m]=s.split(':').map(Number);return day0+(h*60+m)*6e4};
export function synthFromRows(ROWS,H,o={}){const dt=o.dt||10e3,day0=Date.parse('2026-03-12T14:00:00Z'),BW=8,rows=[],st=[];let hd=H.startDepth,t=hm(ROWS[0].start,day0)-5*6e4;
 const push=(x)=>{rows.push({t,...x});t+=dt};const N=v=>v==null?null:v;
 const until=(T,f)=>{while(t<T)push(f())};
 for(let j=0;j<ROWS.length;j++){const r=ROWS[j],nx=ROWS[j+1],tS=hm(r.start,day0),tD=r.dm2?hm(r.dm2,day0):null,tE=hm(r.end,day0);
  // pre-joint: rotating (or not) off bottom, pumps on -> ROT weight + SPP off
  const off={hd,bd:hd-1,hkl:r.rot??r.so??30,wob:0,rpm:r.rot!=null?40:0,flow:r.flow,spp:r.sppOff,tf:null,azi:null};until(tS-60e3,()=>off);until(tS,()=>({...off,bd:hd-0.25}));
  const segs=[[r.mode1,r.m1,tS,tD||tE]];if(r.mode2)segs.push([r.mode2,r.m2,tD,tE]);
  for(const [mode,mm,a,b] of segs){const pause=/LCM/.test(r.comment)&&mode=='Rotate'?[hm('1:34',day0),hm('2:45',day0),582.0]:null;const h0=hd;
   const drillTo=(T,H1)=>{const hs=hd,ts=t,steps=Math.max(1,Math.round((T-ts)/dt));for(let k=0;k<=steps;k++){const h=hs+(H1-hs)*k/steps;hd=h;push({hd:h,bd:h,hkl:(r.rot??34)-(r.wob??0),wob:N(r.wob),rpm:r.rpm==null?null:(mode=='Slide'?0:r.rpm),flow:r.flow,spp:r.sppOn,tf:mode=='Slide'&&r.tf!=null?((r.tf+(k%3-1)*4)+360)%360:null,azi:null})}};
   t=a;if(pause){drillTo(pause[0],pause[2]);const ph=hd;until(pause[1],()=>({hd:ph,bd:ph-1,hkl:r.rot,wob:0,rpm:0,flow:0,spp:0,tf:null,azi:null}));t=pause[1];drillTo(b,h0+mm)}else drillTo(b,h0+mm)}
  hd=+r.hd.toFixed(3);t=tE+dt;
  if(!nx){const te=t;until(te+180e3,()=>({hd,bd:hd-1,hkl:30,wob:0,rpm:0,flow:r.flow,spp:r.sppOff,tf:null,azi:r.mwdAzi}));break}
  // connection: pick up (PU), pumps off, slips (block weight), MWD survey, slips out, slack off (SO), pumps on
  const tN=hm(nx.start,day0);const ps=t;until(ps+60e3,()=>({hd,bd:hd-0.3-3*(t-ps)/60e3,hkl:r.pu,wob:0,rpm:0,flow:r.flow,spp:r.sppOff,tf:null,azi:null}));
  const bdS=hd-3.3;until(t+30e3,()=>({hd,bd:bdS,hkl:r.pu,wob:0,rpm:0,flow:0,spp:0,tf:null,azi:null}));
  const tSO=tN-4*60e3;until(tSO,()=>({hd,bd:bdS,hkl:BW,wob:0,rpm:0,flow:0,spp:0,tf:null,azi:r.mwdAzi}));
  st.push({md:r.sMd,inc:r.sInc,azi:r.sAzi,t:tSO-60e3});
  const s0=t;until(s0+60e3,()=>({hd,bd:bdS+2.3*(t-s0)/60e3,hkl:r.so,wob:0,rpm:0,flow:0,spp:0,tf:null,azi:null}))}
 st.push({md:ROWS.at(-1).sMd,inc:ROWS.at(-1).sInc,azi:ROWS.at(-1).sAzi,t});
 const ml=['TIME','DMEA','DBTM','HKLA','SWOB','RPMA','TFLO','SPPA','MTF','DAZI'],ul=['s','m','m','klbf','klbf','rpm','gpm','psi','deg','deg'];
 const f=v=>v==null||!fin(v)?'':String(+v.toFixed(3));
 return {name:'TEST fixture NP045L WB04B01 (synthetic from PDF rows)',ml,ul,ix:0,rows:rows.map(x=>({t:x.t,x:[new Date(x.t).toISOString(),f(x.hd),f(x.bd),f(x.hkl),f(x.wob),f(x.rpm),f(x.flow),f(x.spp),f(x.tf),f(x.azi)]})),stations:st}}
// per-field comparison with PDF rows
const tm=t=>t==null?'':new Date(t).toLocaleTimeString('en-AU',{timeZone:'Australia/Brisbane',hour:'numeric',minute:'2-digit',hour12:false}).replace(/^0(\d):/,'$1:');
export const FIELDS=[['start','t0','time'],['dm2','tDM2','time'],['end','t1','time'],['len','len',0.05],['hd','hd',0.05],['mode1','m1','str'],['m1','m1m',0.1],['tf','tf',5],['rop1','rop1',0.06],['mode2','m2','str'],['m2','m2m',0.1],['rop2','rop2',0.06],['trop','trop',0.06],['wob','wob',0.5],['rpm','rpm',0.5],['flow','flow',0.5],['sppOn','sppOn',1],['sppOff','sppOff',1],['diff','diff',1],['rot','rot',0.5],['pu','pu',0.5],['so','so',0.5],['mwdAzi','mwdAzi',0.01],['sMd','svMd',0.01],['sInc','svInc',0.01],['sAzi','svAzi',0.01]];
export function compare(rows,PDF){const per={},bad=[];const val=(r,k)=>k=='svMd'?r.sv?.md:k=='svInc'?r.sv?.inc:k=='svAzi'?r.sv?.azi:r[k];
 for(const [pk,dk,tol] of FIELDS){let ok=0,nn=0;for(const p of PDF){const r=rows.find(x=>Math.abs(x.hd-p.hd)<1);nn++;if(!r){bad.push([p.jt,pk,'no row']);continue}const a=p[pk],b=val(r,dk);let g;
   if(tol=='time')g=(a||'')==(b==null?'':tm(b));else if(tol=='str')g=(a||'')==(b||'');else if(a==null)g=b==null;else if(b==null)g=false;else{const rel=(pk.startsWith('rop')||pk=='trop');g=rel?Math.abs(b-a)<=Math.max(0.02*Math.abs(a),tol):(pk=='tf'?Math.abs(((b-a+540)%360)-180)<=tol:Math.abs(b-a)<=tol)}
   if(g)ok++;else bad.push([p.jt,pk,a,b==null?null:(tol=='time'?tm(b):typeof b=='number'?+b.toFixed(2):b)])}per[pk]={ok,n:nn}}return {per,bad}}
export {tm};
// ======================= UI =======================
const LS='dw_ss56';let UI={open:false,src:'auto',metric:true,man:{},hdr:{},L:null,D:null,tagSrc:'SIM',why:''},SIMBUF=[];
try{Object.assign(UI,JSON.parse(localStorage.getItem(LS)||'{}'),{open:false})}catch{}
const save=()=>{try{const {open,L,D,...k}=UI;localStorage.setItem(LS,JSON.stringify(k))}catch{}};
const UN={w:['kN',4.44822,'klbf'],p:['kPa',6.89476,'psi'],q:['L/min',3.78541,'gpm']};
const uc=(k,v)=>v==null||!fin(v)?null:(UI.metric&&UN[k]?v*UN[k][1]:v),ul=k=>UN[k]?(UI.metric?UN[k][0]:UN[k][2]):'';
const HDEF={tfOffset:'',bitToDS:'',bitToGS:'',bhaLen:'',rkbToGl:'',dip:'',htotal:'',magDec:'',gridConv:'',totCorr:'',magModel:'',well:'',client:'',ddDay:'',ddNight:'',drillerDay:'',drillerNight:'',koAzi:''};
// columns: [key, label, group, getter(r)->[value,tag], unitKind, decimals]
function cols(){const D='DERIVED',dir=UI.tagSrc=='LIVE'?'LIVE':UI.tagSrc,der=UI.tagSrc=='SIM'?'SIM':D;const M='MANUAL';
 const man=(r,k)=>{const v=UI.man[(UI.wellKey||'')+'|'+r.jt+'|'+k];return v!=null?[v,M,1]:null};
 return [['jt','Jt#','Tally',r=>[r.jt,der]],['date','Date','Time',r=>[new Date(r.t0).toLocaleDateString('en-AU',{timeZone:'Australia/Brisbane'}),der]],['start','Start / DM1','Time',r=>[tm(r.t0),der]],['dm2','Start DM2','Time',r=>[r.tDM2?tm(r.tDM2):'',der]],['end','End Joint','Time',r=>[tm(r.t1)+(r.open?' …':''),der]],['hrs','Hrs','Time',r=>[`${Math.floor(r.hrs)}:${String(Math.round(r.hrs*60)%60).padStart(2,'0')}`,der]],
 ['len','Length (m)','Tally',r=>[r.len,der],null,2],['hd','HD RKB (m)','Tally',r=>[r.hd,der],null,2],
 ['mode1','Mode 1','Steer 1',r=>[r.m1,der]],['m1','(m)','Steer 1',r=>[r.m1m,der],null,2],['tf','TF','Steer 1',r=>r.tf==null?[r.tfSrc=='none'?'':'',r.tfSrc=='none'?'SIM':der]:[r.tf,UI.tagSrc=='SIM'?'SIM':der],null,0],['rop1','ROP 1 (m/hr)','Steer 1',r=>[r.rop1,der],null,2],
 ['mode2','Mode 2','Steer 2',r=>[r.m2,der]],['m2','(m)','Steer 2',r=>[r.m2m,der],null,2],['rop2','ROP 2 (m/hr)','Steer 2',r=>[r.rop2,der],null,2],['trop','Total ROP (m/hr)','Drilling',r=>[r.trop,der],null,2],
 ['wob','WOB','Drilling',r=>[r.wob,der],'w',1],['rpm','Rotary RPM','Drilling',r=>[r.rpm,der],null,0],['flow','Flow','Drilling',r=>[r.flow,der],'q',0],['sppOn','SPP ON','Drilling',r=>[r.sppOn,der],'p',0],['sppOff','SPP OFF','Drilling',r=>[r.sppOff,der],'p',0],['diff','Diff','Drilling',r=>[r.diff,der],'p',0],
 ['rot','ROT','Drilling',r=>[r.rot,der],'w',0],['pu','Pick Up','Drilling',r=>[r.pu,der],'w',0],['so','Slack Off','Drilling',r=>[r.so,der],'w',0],['lith','Lith.','Survey',r=>man(r,'lith')||['',M,1]],
 ['mwdAzi','MWD Azi (deg)','Survey',r=>[r.mwdAzi,dir],null,2],['sMd','Survey MD','Survey',r=>[r.sv?.md,dir],null,2],['sInc','Inc (deg)','Survey',r=>[r.sv?.inc,dir],null,2],['sAzi','Azi (deg)','Survey',r=>[r.sv?.azi,dir],null,2],
 ['comment','Comments','Survey',r=>man(r,'comment')||[r.notes.join('; '),r.notes.length?der:M,1]]]}
const TAGC={LIVE:'#1db954',DERIVED:'#2f7fd0',MANUAL:'#c08a00',SIM:'#8a8f98',TEST:'#b04ad0'};
const fmt=(v,d)=>v==null||v===''?'':typeof v=='number'?(d!=null?v.toFixed(d):String(v)):String(v);
export function table(){return {cols:cols(),rows:(UI.D?.rows||[])}}
export function cellsOf(r){return cols().map(([k,l,g,f,u,d])=>{const [v,t,ed]=f(r);const vv=typeof v=='number'?uc(u,v):v;return {k,v:vv,s:fmt(vv,d),tag:t,ed:!!ed}})}
function hdrVals(){const T=UI.D?totals(UI.D.rows):{},H={...HDEF,...UI.hdr},bha=window.GX?.ws?.totals&&window.WS?.bha?.length?window.GX.ws.totals(window.WS.bha):null;
 const M=k=>[H[k],'MANUAL'],der=UI.tagSrc=='SIM'?'SIM':'DERIVED';
 return [['Player',window.GX?.player?.get()||'anon','MANUAL'],['TF Offset (deg)',...M('tfOffset'),'tfOffset'],['Bit to DS (m)',...M('bitToDS'),'bitToDS'],['Bit to GS (m)',...M('bitToGS'),'bitToGS'],['BHA Len. (m)',H.bhaLen!==''?H.bhaLen:(bha?bha.len.toFixed(2):''),H.bhaLen!==''?'MANUAL':'SIM','bhaLen'],['RKB to GL (m)',...M('rkbToGl'),'rkbToGl'],
 ['Sliding (m)',T.sl?.toFixed(2),der],['Sliding Time (hrs)',T.slh?.toFixed(2),der],['Rotating (m)',T.ro?.toFixed(2),der],['Rotating Time (hrs)',T.roh?.toFixed(2),der],['Sliding ROP (m/hr)',T.slRop?.toFixed(2),der],['Rotating ROP (m/hr)',T.roRop?.toFixed(2),der],
 ['Dip (deg)',...M('dip'),'dip'],['Htotal (nT)',...M('htotal'),'htotal'],['Mag Dec (deg)',...M('magDec'),'magDec'],['Grid Conv (deg)',...M('gridConv'),'gridConv'],['Total Correction (deg)',...M('totCorr'),'totCorr'],['Magnetic Model',...M('magModel'),'magModel'],
 ['Well Name',H.well||UI.wellName||'',H.well?'MANUAL':(UI.wellName?UI.tagSrc=='LIVE'?'LIVE':UI.tagSrc:'MANUAL'),'well'],['Client',...M('client'),'client'],['DD - Day',...M('ddDay'),'ddDay'],['DD - Night',...M('ddNight'),'ddNight'],['Driller Day',...M('drillerDay'),'drillerDay'],['Driller Night',...M('drillerNight'),'drillerNight'],['K/O Azimuth (deg)',...M('koAzi'),'koAzi']]}
export function toCSV(){const C=cols(),R=UI.D?.rows||[];const q=s=>/[",\n]/.test(s)?'"'+String(s).replace(/"/g,'""')+'"':s;const L=['# DD Slide Sheet,'+q(UI.why),'# units,'+(UI.metric?'metric (kN, kPa, L/min, m)':'field (klbf, psi, gpm, m)')];
 for(const [l,v,t] of hdrVals())L.push('# '+q(l)+','+q(v??'')+','+t);
 const PN=q(window.GX?.player?.get()||'anon');L.push(C.map(([k,l,g,f,u])=>q(l+(u?' ('+ul(u)+')':''))).join(',')+',tags,player');for(const r of R){const c=cellsOf(r);L.push(c.map(x=>q(x.s)).join(',')+','+q(c.map(x=>x.tag[0]).join(''))+','+PN)}return L.join('\n')}
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function css(){if($('ss56css'))return;const s=document.createElement('style');s.id='ss56css';s.textContent=`
#ss56{position:fixed;inset:0;z-index:70;background:#0b1015;color:#e8eef4;font:12px system-ui,sans-serif;display:none;flex-direction:column}
#ss56 .bar{display:flex;flex-wrap:wrap;gap:6px;padding:6px 8px calc(6px);padding-top:max(6px,env(safe-area-inset-top));background:#121b24;border-bottom:1px solid #345;align-items:center}
#ss56 button,#ss56 select{background:#1b2430;color:#dde;border:1px solid #456;border-radius:6px;min-height:36px;padding:0 10px;font-size:14px}
#ss56 .src{font-weight:600;padding:3px 8px;border-radius:5px}
#ss56 .wrap{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding-bottom:env(safe-area-inset-bottom)}
#ss56 .hdr{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:2px 10px;padding:6px 8px;border-bottom:1px solid #345}
#ss56 .hdr div{display:flex;justify-content:space-between;gap:6px;border-bottom:1px dotted #2a3642}
#ss56 table{border-collapse:separate;border-spacing:0;white-space:nowrap}
#ss56 th,#ss56 td{border-right:1px solid #233;border-bottom:1px solid #233;padding:3px 6px;text-align:right}
#ss56 thead th{position:sticky;top:0;background:#16202b;z-index:2;font-weight:600;text-align:center}
#ss56 thead tr.g th{top:0}#ss56 thead tr.c th{top:22px}
#ss56 td:first-child,#ss56 th:first-child{position:sticky;left:0;background:#16202b;z-index:3;text-align:center;font-weight:700}
#ss56 td{border-left:3px solid transparent}#ss56 td i{font-style:normal;font-size:9px;padding:0 3px;border-radius:3px;margin-left:3px;color:#fff;opacity:.9}
#ss56 td[contenteditable]{background:#2a2410;outline:none;min-width:60px;text-align:left}
#ss56 .leg i{font-style:normal;padding:1px 6px;border-radius:4px;color:#fff;margin-right:4px}
@media print{body *{visibility:hidden!important}#ss56,#ss56 *{visibility:visible!important}canvas{display:none!important}#ss56{position:absolute!important;left:0;top:0;width:100%;height:auto!important;overflow:visible!important;display:block!important;background:#fff;color:#000;font-size:7px}#ss56 .bar button,#ss56 .bar select,#ss56 .noprint{display:none!important}#ss56 .wrap{overflow:visible}#ss56 th,#ss56 td{border-color:#999;padding:1px 2px}#ss56 thead th,#ss56 td:first-child,#ss56 th:first-child{background:#eee;position:static}#ss56 td[contenteditable]{background:#fff8dc}#ss56 .hdr div{border-color:#bbb}@page{size:A3 landscape;margin:8mm}}`;document.head.appendChild(s)}
function build(){css();const d=document.createElement('div');d.id='ss56';d.innerHTML=`<div class=bar><b>📋 DD Slide Sheet</b><span id=ss56src class=src></span>
<select id=ss56sel><option value=auto>Source: session (WITSML / Replay / sim)</option><option value=test>Source: TEST fixture (NP045L PDF)</option></select>
<button id=ss56u></button><button id=ss56csv>⬇ CSV</button><button id=ss56pdf>⬇ PDF</button><button id=ss56x>✕ Close</button></div>
<div class=wrap><div id=ss56why class=noprint style="padding:4px 8px;color:#9ab"></div><div class="leg noprint" style="padding:2px 8px">${Object.entries(TAGC).map(([k,c])=>`<i style="background:${c}">${k}</i>`).join('')} <small>tap a yellow MANUAL cell to edit</small></div><div id=ss56h class=hdr></div><div id=ss56t></div></div>`;document.body.appendChild(d);
 $('ss56x').onclick=()=>close();$('ss56sel').onchange=e=>{UI.src=e.target.value;save();refresh(true)};$('ss56u').onclick=()=>{UI.metric=!UI.metric;save();render()};
 $('ss56csv').onclick=()=>dl('dd_slide_sheet_'+(UI.wellName||'well').replace(/\W+/g,'_')+'.csv',toCSV(),'text/csv');$('ss56pdf').onclick=()=>{render();window.print()}}
function render(){const T=table();$('ss56u').textContent='Units: '+(UI.metric?'Metric':'Field (PDF)');$('ss56sel').value=UI.src;
 const sc=$('ss56src');sc.textContent=UI.tagSrc=='LIVE'?'LIVE data':UI.tagSrc=='TEST'?'TEST fixture – not live':'SIM – not real rig data';sc.style.background=TAGC[UI.tagSrc]||'#555';$('ss56why').textContent=UI.why;
 $('ss56h').innerHTML=hdrVals().map(([l,v,t,k])=>`<div><span>${es(l)}</span><span><b ${t=='MANUAL'&&k?`contenteditable data-h="${k}"`:''} style="min-width:40px;display:inline-block;text-align:right;${t=='MANUAL'?'background:#2a2410':''}">${es(v??'')}</b> <small style="color:${TAGC[t]}">${t}</small></span></div>`).join('');
 const G=[];for(const c of T.cols){const g=c[2];if(G.at(-1)?.[0]==g)G.at(-1)[1]++;else G.push([g,1])}
 let h=`<table id=ss56tbl><thead><tr class=g>${G.map(([g,n])=>`<th colspan=${n}>${g}</th>`).join('')}</tr><tr class=c>${T.cols.map(c=>`<th>${es(c[1])}${c[4]?'<br><small>('+ul(c[4])+')</small>':''}</th>`).join('')}</tr></thead><tbody>`;
 h+=`<tr><td>START</td><td colspan=6 style="text-align:left">START DEPTH</td><td></td><td>${UI.D?.start!=null?UI.D.start.toFixed(2):''}</td>${'<td></td>'.repeat(T.cols.length-9)}</tr>`;
 for(const r of T.rows){h+='<tr>'+cellsOf(r).map((c,i)=>`<td data-k="${c.k}" data-jt="${r.jt}" ${c.ed?'contenteditable':''} style="border-left-color:${TAGC[c.tag]}" title="${c.tag}">${es(c.s)}${i&&!c.ed?`<i style="background:${TAGC[c.tag]}">${c.tag[0]}</i>`:''}</td>`).join('')+'</tr>'}
 if(!T.rows.length)h+=`<tr><td colspan=${T.cols.length} style="text-align:left">No joints yet – waiting for drilling data (hole depth advancing with pumps on).</td></tr>`;
 $('ss56t').innerHTML=h+'</tbody></table>';
 for(const e of $('ss56t').querySelectorAll('td[contenteditable]'))e.onblur=()=>{UI.man[(UI.wellKey||'')+'|'+e.dataset.jt+'|'+e.dataset.k]=e.innerText.trim();save()};
 for(const e of $('ss56h').querySelectorAll('[data-h]'))e.onblur=()=>{UI.hdr[e.dataset.h]=e.innerText.trim();save();render()}}
// ---- data sources ----
async function testSource(){const [{ROWS,HEADER}]=await Promise.all([import('./fixtures/runsheet_np045l_rows.js?v=56')]);const L=synthFromRows(ROWS,HEADER);L.header=HEADER;L.pdf=ROWS;return L}
function sessionSource(){const W=window.GX?.witsml?.WML;if(W?.mode=='replay'&&W.rp?.rows?.length){const R=W.rp;return {name:'REPLAY '+(W.log?.name||''),ml:R.ml,ul:R.ul,ix:R.ix,rows:R.rows.filter(x=>x.t<=R.t),tag:W.simulated?'SIM':'LIVE',why:'Replay of '+(W.simulated?'SIMULATED test':'real')+' WITSML time log up to the replay cursor'}}
 if(W?.hist?.length&&W.histMl)return {name:W.log?.name||'',ml:W.histMl,ul:W.histUl||[],ix:W.histIx,rows:W.hist,tag:W.simulated?'SIM':'LIVE',why:'WITSML time log received this session ('+W.hist.length+' rows)'};
 return {name:'Simulator',sim:true,tag:'SIM',why:'No WITSML data this session – built from the game simulator (SIM, not real rig data)'}}
function stationsM(tag){const st=window.GEO?.surv?.stations||[];return st.map(s=>({md:s.md*0.3048,inc:s.inc,azi:s.azi}))}
export async function refresh(force){if(!$('ss56'))return;let L,samples,st,tag,why;
 if(UI.src=='test'){L=UI.L&&UI.L.pdf?UI.L:await testSource();UI.L=L;samples=fromLog(L).samples;st=L.stations;tag='TEST';why='TEST fixture: synthetic 10 s time log generated from the 29 rows of the WestSide NP045L WB04B01 PDF (13/03/2026). Not live.';if(!Object.keys(UI.hdr).length||force&&!UI.hdrFromTest){UI.hdr={...L.header};UI.hdrFromTest=true}UI.wellName=L.header.well;UI.wellKey='TEST';
  if(!UI.testMan){for(const r of L.pdf){UI.man['TEST|'+r.jt+'|lith']=r.lith;if(r.comment)UI.man['TEST|'+r.jt+'|comment']=r.comment}UI.testMan=1}}
 else{const S=sessionSource();tag=S.tag;why=S.why;if(S.sim){samples=SIMBUF.slice()}else{samples=fromLog(S).samples}st=stationsM(tag);UI.wellName=S.name;UI.wellKey=S.name}
 const D=derive(samples,UI.src=='test'?{firstJoint:42}:{});surveyFor(D.rows,st,+(UI.hdr.bitToDS)||14.73);D.start=samples.find(x=>fin(x.hd))?.hd;UI.D=D;UI.tagSrc=tag;UI.why=why;render();
 try{window.GX?.onSheetRows?.(D.rows,{tag,well:UI.wellName})}catch(e){console.warn(e)}return D}
function sampleSim(){const W=window.GX?.witsml?.WML;if(W?.hist?.length||W?.mode=='replay')return;const S=window.G?.S;if(!S||!fin(S.md))return;const ft=0.3048;
 SIMBUF.push({t:Date.now(),hd:S.md*ft,bd:(fin(S.bitDepth)?S.bitDepth:S.md)*ft,hkl:S.hook,wob:S.wob,rpm:S.td?.rpm??S.bitRpm,flow:S.Q,spp:S.spp,tf:S.tf,azi:null});if(SIMBUF.length>40000)SIMBUF.splice(0,10000)}
export function open(src){if(!$('ss56'))build();if(src)UI.src=src;UI.open=true;$('ss56').style.display='flex';return refresh(true)}
export function close(){UI.open=false;$('ss56').style.display='none'}
export function init(){if(typeof document=='undefined')return;build();const hud=$('hud');if(hud){const b=document.createElement('button');b.id='btnSS56';b.textContent='📋 Slide sheet';b.onclick=()=>open();hud.appendChild(b)}
 setInterval(sampleSim,1000);setInterval(()=>{if(UI.open&&UI.src!='test')refresh()},3000);
 window.GX=window.GX||{};GX.ss56={UI,open,close,refresh,derive,fromLog,synthFromRows,compare,totals,toCSV,table,cellsOf,surveyFor,FIELDS}}
