// edmstream.js v5.9.4.1: streaming EDM reader for very large exports (hundreds of MB). Works in a Web Worker and in node.
// The file is read in slices from the local Blob/File (zip central directory from the tail; each .xml entry inflated as a stream),
// so the whole text is never held in memory. Only the tables/columns the viewer needs are kept; survey stations are packed
// into numeric arrays and decimated. Nothing is uploaded. Output is tagged IMPORT (never LIVE). EDM lengths are feet → metres.
import {minCurvM} from './ac.js?v=5924';
import {trajStats} from './edmstats.js?v=5942';
const FT=0.3048;
const KEEP={CD_PROJECT:1,CD_SITE:1,CD_WELL:1,CD_WELLBORE:1,CD_DATUM:1,CD_SCENARIO:1,CD_DESIGN:1,CD_DEFINITIVE_SURVEY_HEADER:1,CD_SURVEY_HEADER:1,CD_PLAN_HEADER:1,CD_WELLPLAN:1,
 CD_ASSEMBLY:1,CD_ASSEMBLY_COMP:1,CD_CASE:1,CD_HOLE_SECT:1,DP_PROJECT_TARGET:1,CD_PROJ_TARG_WELL_LINK:1,CD_PROJECT_TARGET_WB_LINK:1,CD_TARGET:1,CD_WP_TARGET:1,
 CD_WELLBORE_FORMATION:1,CD_SLOT:1,CD_POLICY:1};
const STN={CD_DEFINITIVE_SURVEY_STATION:'def',CD_SURVEY_STATION:'svy',CD_PLAN_STATION:'plan',CD_WELLPLAN_STATION:'plan'};
const DROP=/^(create|update)_(user_id|app_id)$|^covariance|^attachment|^ellipse_|^mag_|^tight_group_id$|^is_readonly$/;
const ent=s=>s.indexOf('&')<0?s:s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const AT=/([A-Za-z0-9_:.-]+)\s*=\s*"([^"]*)"/g;
function attrs(s,all){const r={};let a;AT.lastIndex=0;while((a=AT.exec(s))){const k=a[1].toLowerCase();if(all||!DROP.test(k))r[k]=ent(a[2].trim())}return r}
// ---- incremental scanner: feed text chunks, rows go to sink(table,row,stationKind) ----
export function scanner(sink){let carry='';const feed=(chunk,final)=>{const t=carry+chunk;let i=0;const n=t.length;
 while(true){const lt=t.indexOf('<',i);if(lt<0){i=n;break}let j=lt+1;while(j<n){const c=t.charCodeAt(j);if(c==32||c==62||c==47||c==10||c==13||c==9)break;j++}
  if(j>=n){i=lt;break}const name=t.slice(lt+1,j);const gt=t.indexOf('>',j);if(gt<0){i=lt;break}
  const up=name.toUpperCase(),st=STN[up];if(!st&&!KEEP[up]){i=gt+1;continue}
  const self=t.charCodeAt(gt-1)==47;const r=attrs(t.slice(j,self?gt-1:gt),!!st);
  if(!self){const end=t.indexOf('</'+name,gt);if(end<0){if(!final){i=lt;break}}else{const body=t.slice(gt+1,end);if(body.indexOf('<CD_')<0){let c;const cr=/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g;while((c=cr.exec(body)))r[c[1].toLowerCase()]=ent(c[2])}i=end+name.length+3;sink(up,r,st);continue}}
  sink(up,r,st);i=gt+1}
 carry=t.slice(i);if(carry.length>16e6)carry=carry.slice(-1e6)};return {feed,end:()=>feed('',true)}}
// ---- streaming sources ----
async function u8(blob,a,b){return new Uint8Array(await blob.slice(a,b).arrayBuffer())}
export async function zipEntries(blob){const sz=blob.size,tl=Math.min(sz,65558+22),tail=await u8(blob,sz-tl,sz),dv=new DataView(tail.buffer);let e=-1;
 for(let i=tail.length-22;i>=0;i--)if(dv.getUint32(i,true)==0x06054b50){e=i;break}if(e<0)throw new Error('not a zip file (no central directory)');
 const n=dv.getUint16(e+10,true),cdSize=dv.getUint32(e+12,true),cdOff=dv.getUint32(e+16,true);const cd=await u8(blob,cdOff,cdOff+cdSize),cv=new DataView(cd.buffer);let p=0;const out=[];
 for(let k=0;k<n;k++){if(cv.getUint32(p,true)!=0x02014b50)throw new Error('bad zip directory');const m=cv.getUint16(p+10,true),cs=cv.getUint32(p+20,true),us=cv.getUint32(p+24,true),fl=cv.getUint16(p+28,true),xl=cv.getUint16(p+30,true),cl=cv.getUint16(p+32,true),lo=cv.getUint32(p+42,true);
  const name=new TextDecoder().decode(cd.subarray(p+46,p+46+fl));p+=46+fl+xl+cl;if(!/\.(xml|edm)$/i.test(name)||/(^|\/)__MACOSX\//.test(name))continue;const lh=await u8(blob,lo,lo+30),lv=new DataView(lh.buffer);
  const ds=lo+30+lv.getUint16(26,true)+lv.getUint16(28,true);out.push({name,method:m,cs,us,start:ds})}
 if(!out.length)throw new Error('zip has no .xml file');return out}
function entryStream(blob,e){const raw=blob.slice(e.start,e.start+e.cs).stream();if(e.method==0)return raw;if(e.method==8)return raw.pipeThrough(new DecompressionStream('deflate-raw'));throw new Error('zip method '+e.method+' not supported')}
async function pump(stream,sc,onBytes){const rd=stream.getReader(),dec=new TextDecoder();let got=0;for(;;){const {value,done}=await rd.read();if(done)break;got+=value.length;sc.feed(dec.decode(value,{stream:true}));onBytes?.(got)}sc.feed(dec.decode());sc.end()}
const isZip=async b=>{const h=await u8(b,0,4);return h[0]==0x50&&h[1]==0x4b&&h[2]==3&&h[3]==4};
// ---- collect: compact tables + packed stations ----
export function collector(){const T={},S={def:{},svy:{},plan:{}},cnt={};const nf=v=>{const x=parseFloat(v);return Number.isFinite(x)?x:NaN};
 const sink=(t,r,st)=>{cnt[t]=(cnt[t]||0)+1;if(st){const key=st=='def'?(r.def_survey_header_id||r.definitive_survey_id):st=='svy'?r.survey_header_id:(r.plan_id||r.wellplan_id);if(key==null)return;
   const g=S[st][key]||(S[st][key]={wb:r.wellbore_id,md:[],inc:[],azi:[],e:[],n:[],tvd:[],dls:[]});g.md.push(nf(r.md));g.inc.push(nf(r.inclination??r.inc));g.azi.push(nf(r.azimuth??r.azi));g.e.push(nf(r.offset_east));g.n.push(nf(r.offset_north));g.tvd.push(nf(r.tvd));g.dls.push(nf(r.dogleg_severity));return}
  (T[t]||(T[t]=[])).push(r)};return {T,S,cnt,sink}}
export async function readBlob(blob,name,{onProg}={}){const C=collector(),sc=scanner(C.sink);const files=[];const t0=Date.now();const MB=x=>(x/1e6).toFixed(0);
 if(await isZip(blob)){const es=await zipEntries(blob);const tot=es.reduce((a,e)=>a+e.us,0);let done=0;for(const e of es){files.push(e.name);await pump(entryStream(blob,e),sc,g=>onProg?.(0.02+0.86*Math.min(1,(done+g)/tot),'reading '+e.name+' · '+MB(done+g)+' / '+MB(tot)+' MB'));done+=e.us}}
 else{files.push(name);await pump(blob.stream(),sc,g=>onProg?.(0.02+0.86*Math.min(1,g/blob.size),'reading '+name+' · '+MB(g)+' / '+MB(blob.size)+' MB'))}
 return {...C,files,ms:Date.now()-t0}}
// ---- world model (every site/well at its real position, metric, local ENU about the data centroid) ----
const num=v=>{const x=parseFloat(v);return Number.isFinite(x)?x:null};const pick=(r,...k)=>{for(const x of k)if(r&&r[x]!=null&&r[x]!=='')return r[x];return null};
const by=(a,k)=>{const m=new Map();for(const r of a||[]){const v=r[k];if(v==null)continue;let l=m.get(v);if(!l)m.set(v,l=[]);l.push(r)}return m};
const ts=v=>{const m=/(\d{4}-\d\d-\d\d)/.exec(v||'');return m?m[1]:null};
function pathOf(g,L){const idx=[...g.md.keys()].filter(i=>Number.isFinite(g.md[i])).sort((a,b)=>g.md[a]-g.md[b]);if(!idx.length)return null;
 const hasPos=idx.every(i=>Number.isFinite(g.tvd[i])&&Number.isFinite(g.e[i])&&Number.isFinite(g.n[i]));let pts;
 if(hasPos)pts=idx.map(i=>({md:g.md[i]*L,ew:g.e[i]*L,ns:g.n[i]*L,tvd:g.tvd[i]*L,inc:g.inc[i],azi:g.azi[i]}));
 else{const st=idx.map(i=>({md:g.md[i]*L,inc:g.inc[i]||0,azi:g.azi[i]||0}));pts=minCurvM(st).map((p,k)=>({...p,inc:st[k].inc,azi:st[k].azi}))}
 let dls=0;for(const i of idx)if(g.dls[i]>dls)dls=g.dls[i];return {pts,n:g.md.length,maxDls:dls||null}}
function decimate(pts,max=90){if(pts.length<=max)return pts;const out=[],s=(pts.length-1)/(max-1);for(let k=0;k<max;k++)out.push(pts[Math.round(k*s)]);return out}
const r1=v=>v==null?null:Math.round(v*10)/10;
export function world(R,{units='ft',name='EDM'}={}){const L=units=='m'?1:FT,len=v=>v==null?null:v*L,T=k=>R.T[k]||[];
 const projects=new Map(T('CD_PROJECT').map(p=>[p.project_id,{id:p.project_id,name:p.project_name||p.project_id,zone:p.geo_zone_id||null,datum:p.geo_datum_id||null,sysDatum:p.system_datum_desc||null}]));
 const customer=T('CD_POLICY')[0]?.customer_name||null;const wellRows=T('CD_WELL');
 const geo=T('CD_SITE').some(s=>num(s.geo_latitude)!=null)||wellRows.some(w=>num(w.geo_latitude)!=null);
 const sites=T('CD_SITE').map(s=>({id:s.site_id,name:pick(s,'site_name','site_common_name')||s.site_id,project:projects.get(s.project_id)?.name||null,lat:num(s.geo_latitude),lon:num(s.geo_longitude),
  mapE:len(num(pick(s,'geo_map_easting','loc_easting','easting'))),mapN:len(num(pick(s,'geo_map_northing','loc_northing','northing'))),created:ts(s.create_date),updated:ts(s.update_date),wells:[]}));
 const siteBy=new Map(sites.map(s=>[s.id,s]));
 let lat0=0,lon0=0,k=0;if(geo){for(const w of wellRows){const a=num(w.geo_latitude),b=num(w.geo_longitude);if(a!=null&&b!=null&&Math.abs(a)>0.001){lat0+=a;lon0+=b;k++}}if(k){lat0/=k;lon0/=k}}
 const cosL=Math.cos(lat0*Math.PI/180),enu=(la,lo)=>({E:(lo-lon0)*111320*cosL,N:(la-lat0)*110574});
 const s0=sites.find(s=>s.mapE!=null)||{mapE:0,mapN:0};
 const datums=by(T('CD_DATUM'),'well_id'),wbsBy=by(T('CD_WELLBORE'),'well_id');
 const scen=by(T('CD_SCENARIO').concat(T('CD_DESIGN')),'wellbore_id'),defH=by(T('CD_DEFINITIVE_SURVEY_HEADER'),'wellbore_id'),svH=by(T('CD_SURVEY_HEADER'),'wellbore_id'),plH=by(T('CD_PLAN_HEADER').concat(T('CD_WELLPLAN')),'wellbore_id');
 const asmBy=by(T('CD_ASSEMBLY'),'wellbore_id'),compBy=by(T('CD_ASSEMBLY_COMP'),'assembly_id'),caseBy=by(T('CD_CASE'),'wellbore_id'),holeBy=by(T('CD_HOLE_SECT'),'wellbore_id'),fmBy=by(T('CD_WELLBORE_FORMATION'),'wellbore_id');
 const designById=new Map(T('CD_SCENARIO').concat(T('CD_DESIGN')).map(d=>[d.scenario_id||d.design_id,d]));
 const ptg=new Map(T('DP_PROJECT_TARGET').map(t=>[t.project_target_id,t])),tgW=by(T('CD_PROJ_TARG_WELL_LINK'),'well_id'),tgB=by(T('CD_PROJECT_TARGET_WB_LINK'),'wellbore_id'),tgOld=by(T('CD_TARGET').concat(T('CD_WP_TARGET')),'wellbore_id');
 const tgt=t=>({name:t.target_name||t.project_target_id||t.target_id,tvd:r1(len(num(pick(t,'target_tvd','tvd')))),lat:num(t.geo_latitude),lon:num(t.geo_longitude),dN:r1(len(num(pick(t,'offset_north','ns')))),dE:r1(len(num(pick(t,'offset_east','ew')))),r:r1(len(num(pick(t,'radius','target_radius','tolerance_right'))))});
 const wells=[],wbs=[];
 for(const w of wellRows){const s=siteBy.get(w.site_id);const dl=(datums.get(w.well_id)||[]).map(d=>({name:d.datum_name,elev:r1(len(num(pick(d,'datum_elevation','elevation')))),def:d.is_default=='Y',date:ts(d.date_established)}));
  const dd=dl.find(d=>d.def)||dl[0]||null;let E,N;const la=num(w.geo_latitude),lo=num(w.geo_longitude);
  if(geo&&la!=null&&lo!=null&&Math.abs(la)>0.001)({E,N}=enu(la,lo));else if(geo&&s?.lat!=null)({E,N}=enu(s.lat,s.lon));else{E=((s?.mapE??0)-s0.mapE)+(len(num(pick(w,'offset_east','loc_offset_east')))??0)+(len(num(w.slot_ew))??0);N=((s?.mapN??0)-s0.mapN)+(len(num(pick(w,'offset_north','loc_offset_north')))??0)+(len(num(w.slot_ns))??0)}
  const W={id:w.well_id,site:w.site_id,siteName:s?.name||null,project:s?.project||null,name:pick(w,'well_common_name','well_legal_name','well_name')||w.well_id,lat:la,lon:lo,E:r1(E),N:r1(N),
   mapE:r1(len(num(w.geo_offset_east))),mapN:r1(len(num(w.geo_offset_north))),datum:dd,datums:dl,waterDepth:r1(len(num(w.water_depth))),subsea:w.is_subsea=='Y',spud:ts(pick(w,'spud_date','date_spud','spud_dt'))||null,operator:pick(w,'operator','operator_name','company_name')||customer||null,created:ts(w.create_date),updated:ts(w.update_date),wbs:[],
   targets:(tgW.get(w.well_id)||[]).map(x=>ptg.get(x.project_target_id)).filter(Boolean).map(tgt)};
  wells.push(W);s?.wells.push(W.id);const del=dd?.elev??0;
  for(const b of wbsBy.get(w.well_id)||[]){const id=b.wellbore_id;const traj=[];
   const add=(kind,h,g)=>{if(!g)return;const p=pathOf(g,L);if(!p)return;traj.push({kind,name:h?.name||h?.survey_name||h?.plan_name||kind,phase:(h?.phase||designById.get(h?.design_id)?.phase||'').toUpperCase()||null,company:h?.company||null,date:ts(h?.header_date||h?.effective_date),stations:p.n,mdMax:r1(p.pts.at(-1).md),maxDls:p.maxDls,pts:p.pts})};
   for(const h of defH.get(id)||[])add('definitive',h,R.S.def[h.def_survey_header_id||h.definitive_survey_id]);for(const h of svH.get(id)||[])add('survey',h,R.S.svy[h.survey_header_id]);for(const h of plH.get(id)||[])add('plan',h,R.S.plan[h.plan_id]);
   const rank=t=>(t.kind=='definitive'?0:t.kind=='survey'?2:4)+(t.phase=='ACTUAL'?0:1);traj.sort((a,b)=>rank(a)-rank(b));const best=traj[0]||null;
   const sc=(scen.get(id)||[]).map(d=>({name:d.name||d.design_name,phase:(d.phase||'').toUpperCase(),version:d.version||null}));const actual=traj.some(t=>t.phase=='ACTUAL'&&t.kind!='plan')||sc.some(d=>d.phase=='ACTUAL');
   const asm=(asmBy.get(id)||[]).map(a=>({name:a.assembly_name,type:a.string_type||null,size:num(pick(a,'assembly_size','od_casing','od')),hole:num(a.hole_size),base:r1(len(num(pick(a,'md_assembly_base','md_base')))),baseTVD:r1(len(num(a.tvd_assembly_base))),top:r1(len(num(pick(a,'md_assembly_top','md_top')))),length:r1(len(num(a.length_total))),
    comps:(compBy.get(a.assembly_id)||[]).sort((x,y)=>(num(x.sequence_no)||0)-(num(y.sequence_no)||0)).map(c=>({type:pick(c,'sect_type_code','comp_type_code','description','catalog_key_desc'),od:num(c.od_body),grade:c.grade||null,weight:num(c.nominal_weight),len:r1(len(num(c.length))),burst:num(c.pressure_burst),collapse:num(c.pressure_collapse)}))}));
   const path=best?decimate(best.pts).map(p=>({md:r1(p.md),E:r1(E+p.ew),N:r1(N+p.ns),Z:r1(p.tvd-del),tvd:r1(p.tvd)})):null;
   wbs.push({id,well:w.well_id,site:w.site_id,name:pick(b,'wellbore_name','wellbore_common_name')||id,status:actual?'Drilled (actual surveys)':traj.length||sc.length?'Planned':'No trajectory',
    bhMD:r1(len(num(b.bh_md))??best?.mdMax??null),bhTVD:r1(len(num(b.bh_tvd))??best?.pts.at(-1).tvd??null),koMD:r1(len(num(b.ko_md))),deviated:b.is_deviated=='Y',bhLat:num(b.geo_latitude_bh),bhLon:num(b.geo_longitude_bh),
    designs:sc,traj:traj.map(({pts,...t})=>t),kind:best?.kind||null,path,st:best?trajStats(best.pts):null,casing:asm.filter(a=>/casing|liner|conductor|tubing/i.test((a.type||'')+' '+(a.name||''))),assemblies:asm,
    cases:(caseBy.get(id)||[]).map(c=>c.case_name),holes:(holeBy.get(id)||[]).sort((x,y)=>(num(x.sequence_no)||0)-(num(y.sequence_no)||0)).map(h=>({type:h.sect_type_code,d:num(h.effective_diameter),len:r1(len(num(h.length)))})),
    formations:(fmBy.get(id)||[]).length,targets:(tgB.get(id)||[]).map(x=>ptg.get(x.project_target_id)).filter(Boolean).map(tgt).concat((tgOld.get(id)||[]).map(tgt))});W.wbs.push(id)}}
 const wbBy=new Map(wbs.map(b=>[b.id,b]));
 for(const W of wells){const bs=W.wbs.map(i=>wbBy.get(i));W.status=bs.some(b=>/Drilled/.test(b.status))?'Drilled':bs.some(b=>b.status=='Planned')?'Planned':'No trajectory';W.td=Math.max(0,...bs.map(b=>b.bhMD||0))||null;W.tvd=Math.max(0,...bs.map(b=>b.bhTVD||0))||null}
 const wBy=new Map(wells.map(w=>[w.id,w]));
 for(const s of sites){const ws=s.wells.map(i=>wBy.get(i)).filter(Boolean);if(ws.length){s.E=r1(ws.reduce((a,w)=>a+w.E,0)/ws.length);s.N=r1(ws.reduce((a,w)=>a+w.N,0)/ws.length)}else if(geo&&s.lat!=null){const p=enu(s.lat,s.lon);s.E=r1(p.E);s.N=r1(p.N)}else{s.E=(s.mapE??0)-s0.mapE;s.N=(s.mapN??0)-s0.mapN}}
 // position outliers (bad coordinates in the source): far from the median of all wellheads → flagged, still shown, excluded from the default framing
 const med=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[b.length>>1]:0};const mE=med(wells.map(w=>w.E)),mN=med(wells.map(w=>w.N));const dd=wells.map(w=>Math.hypot(w.E-mE,w.N-mN)).sort((a,b)=>a-b);const p90=dd.length?dd[Math.floor(dd.length*0.9)]:0;
 const lim=Math.max(5*p90,50000);let nOut=0;for(const w of wells){w.outlier=Math.hypot(w.E-mE,w.N-mN)>lim;if(w.outlier)nOut++}for(const b of wbs)b.outlier=!!wBy.get(b.well)?.outlier;for(const s of sites){const ws=s.wells.map(i=>wBy.get(i)).filter(Boolean),ok=ws.filter(w=>!w.outlier);if(ok.length&&ok.length<ws.length){s.E=r1(ok.reduce((a,w)=>a+w.E,0)/ok.length);s.N=r1(ok.reduce((a,w)=>a+w.N,0)/ok.length)}s.outlier=ws.length?ws.every(w=>w.outlier):Math.hypot(s.E-mE,s.N-mN)>lim}
 const bx=(f)=>{let e0=Infinity,e1=-Infinity,n0=Infinity,n1=-Infinity,z1=0;const ext=(E,N)=>{e0=Math.min(e0,E);e1=Math.max(e1,E);n0=Math.min(n0,N);n1=Math.max(n1,N)};
  for(const s of sites)if(f(s))ext(s.E,s.N);for(const w of wells)if(f(w))ext(w.E,w.N);for(const b of wbs)if(f(b))for(const p of b.path||[]){ext(p.E,p.N);z1=Math.max(z1,p.Z)}if(!Number.isFinite(e0)){e0=n0=-100;e1=n1=100}return {e0,e1,n0,n1,maxDepth:z1}};
 const bounds=bx(x=>!x.outlier),boundsAll=bx(()=>true);
 return {tag:'IMPORT',name,customer,units,geo,origin:{lat:lat0,lon:lon0},projects:[...projects.values()],sites,wells,wbs,bounds,boundsAll,outliers:nOut,tables:R.cnt,files:R.files,ms:R.ms,built:new Date().toISOString()}}
// legacy tables for the pad-level parser in edm.js (small files only): station rows rebuilt from packed arrays
export function legacyTables(R){const T={...R.T};const rows=(st,tab,key)=>{for(const [k,g] of Object.entries(R.S[st])){const a=T[tab]||(T[tab]=[]);for(let i=0;i<g.md.length;i++)a.push({[key]:k,wellbore_id:g.wb,md:String(g.md[i]),inclination:String(g.inc[i]),azimuth:String(g.azi[i])})}};
 rows('def','CD_DEFINITIVE_SURVEY_STATION','definitive_survey_id');rows('svy','CD_SURVEY_STATION','survey_header_id');rows('plan','CD_PLAN_STATION','plan_id');
 for(const h of T.CD_DEFINITIVE_SURVEY_HEADER||[])if(!h.definitive_survey_id)h.definitive_survey_id=h.def_survey_header_id;return T}
