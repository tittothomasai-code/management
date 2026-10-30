// edm.js v5.9.2.4: EDM (Landmark Engineer's Data Model) XML export parser. Runs in the browser only (Web Worker or main thread):
// nothing is uploaded. Pure functions, no DOM, so the same code runs in node tests. Tag every result IMPORT (never LIVE).
// EDM stores lengths in feet internally; unit option 'ft' (default) or 'm'. Output is metric.
import {minCurvM,matrix} from './ac.js?v=5924';
const FT=0.3048;
// ---- minimal zip reader (stored + deflate via DecompressionStream) ----
export async function unzip(buf,onProg){const u=new Uint8Array(buf),dv=new DataView(u.buffer,u.byteOffset,u.byteLength);let e=-1;
 for(let i=u.length-22;i>=Math.max(0,u.length-65558);i--)if(dv.getUint32(i,true)==0x06054b50){e=i;break}if(e<0)throw new Error('not a zip file');
 const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[];
 for(let k=0;k<n;k++){if(dv.getUint32(p,true)!=0x02014b50)throw new Error('bad zip directory');const m=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),fl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
  const name=new TextDecoder().decode(u.subarray(p+46,p+46+fl));p+=46+fl+xl+cl;if(!/\.xml$/i.test(name))continue;
  const ds=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true),raw=u.subarray(ds,ds+cs);let data;
  if(m==0)data=raw;else if(m==8)data=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());else throw new Error('zip method '+m+' not supported');
  out.push({name,text:new TextDecoder().decode(data)});onProg?.(name)}
 if(!out.length)throw new Error('zip has no .xml file');return out}
// ---- record scanner: EDM rows are <CD_TABLE attr="..."/> (attributes) or <CD_TABLE><col>v</col></CD_TABLE> ----
const ent=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
export function scan(text,onProg){const T={},re=/<((?:CD|CM|DP|TU|WP|PK)_[A-Z0-9_]+)\b([^>]*?)(\/?)>/gi;let m,last=0;const at=/([A-Za-z0-9_:.-]+)\s*=\s*"([^"]*)"/g;
 while((m=re.exec(text))){const t=m[1].toUpperCase(),r={};let a;at.lastIndex=0;while((a=at.exec(m[2])))r[a[1].toLowerCase()]=ent(a[2]);
  if(!m[3]){const end=text.indexOf('</'+m[1],re.lastIndex);if(end>0){const body=text.slice(re.lastIndex,end);if(!/<(CD|CM|DP|TU|WP|PK)_/i.test(body)){let c;const cr=/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g;while((c=cr.exec(body)))r[c[1].toLowerCase()]=ent(c[2]);re.lastIndex=end}}}
  (T[t]||(T[t]=[])).push(r);if(onProg&&re.lastIndex-last>2e6){last=re.lastIndex;onProg(re.lastIndex/text.length)}}
 onProg?.(1);return T}
const num=v=>{const x=parseFloat(v);return Number.isFinite(x)?x:null};const pick=(r,...k)=>{for(const x of k)if(r[x]!=null&&r[x]!=='')return r[x];return null};
// ---- build model ----
export function build(tables,{units='ft'}={}){const L=units=='m'?1:FT,len=v=>v==null?null:v*L,T=k=>tables[k]||[];
 const sites=T('CD_SITE').map(s=>({id:s.site_id,name:pick(s,'site_name','site_common_name')||s.site_id,E:num(pick(s,'loc_easting','easting'))??0,N:num(pick(s,'loc_northing','northing'))??0}));
 const wells=T('CD_WELL').map(w=>({id:w.well_id,site:w.site_id,name:pick(w,'well_common_name','well_legal_name','well_name')||w.well_id,dE:len(num(pick(w,'offset_east','loc_offset_east')))??0,dN:len(num(pick(w,'offset_north','loc_offset_north')))??0,slot:pick(w,'slot_name','slot_id'),datum:null}));
 for(const sl of T('CD_SLOT')){const w=wells.find(x=>x.id==sl.well_id||(x.slot&&x.slot==sl.slot_id));if(w){w.slot=sl.slot_name||sl.slot_id;w.dE=len(num(pick(sl,'offset_east','loc_offset_east')))??w.dE;w.dN=len(num(pick(sl,'offset_north','loc_offset_north')))??w.dN}}
 for(const d of T('CD_DATUM')){const w=wells.find(x=>x.id==d.well_id);const el=len(num(pick(d,'datum_elevation','elevation')));if(w&&el!=null&&(d.is_default=='Y'||w.datum==null))w.datum=el}
 const wbs=T('CD_WELLBORE').map(b=>({id:b.wellbore_id,well:b.well_id,name:pick(b,'wellbore_name','wellbore_common_name')||b.wellbore_id}));
 const designs=T('CD_DESIGN').map(d=>({id:d.design_id,wb:d.wellbore_id,name:d.design_name||d.design_id,phase:(d.phase||'').toUpperCase()}));
 const st=(rows,key)=>{const g={};for(const r of rows){const k=r[key];const md=len(num(r.md));if(k==null||md==null)continue;(g[k]||(g[k]=[])).push({md,inc:num(pick(r,'inclination','inc'))??0,azi:num(pick(r,'azimuth','azi'))??0})}for(const k in g)g[k].sort((a,b)=>a.md-b.md);return g};
 const svS=st(T('CD_SURVEY_STATION'),'survey_header_id'),defS=st(T('CD_DEFINITIVE_SURVEY_STATION'),'definitive_survey_id'),plS=st(T('CD_PLAN_STATION').concat(T('CD_WELLPLAN_STATION')),'plan_id');
 const traj=[];const dz=(wb)=>{const d=designs.find(x=>x.id==wb);return d};
 for(const h of T('CD_SURVEY_HEADER'))if(svS[h.survey_header_id])traj.push({id:h.survey_header_id,kind:'survey',name:h.survey_name||h.survey_header_id,wb:h.wellbore_id||dz(h.design_id)?.wb,st:svS[h.survey_header_id]});
 for(const h of T('CD_DEFINITIVE_SURVEY_HEADER'))if(defS[h.definitive_survey_id])traj.push({id:h.definitive_survey_id,kind:'definitive',name:h.name||'Definitive',wb:h.wellbore_id||dz(h.design_id)?.wb,st:defS[h.definitive_survey_id]});
 for(const h of T('CD_PLAN_HEADER').concat(T('CD_WELLPLAN')))if(plS[h.plan_id])traj.push({id:h.plan_id,kind:'plan',name:h.plan_name||h.plan_id,wb:h.wellbore_id||dz(h.design_id)?.wb,st:plS[h.plan_id]});
 for(const t of traj)t.pts=minCurvM(t.st);
 const casing=T('CD_ASSEMBLY').filter(a=>/casing|liner|conductor/i.test(pick(a,'string_type','assembly_type','assembly_name')||'')).map(a=>{const c=T('CD_ASSEMBLY_COMP').filter(x=>x.assembly_id==a.assembly_id);
  return {wb:a.wellbore_id||dz(a.design_id)?.wb,name:a.assembly_name||a.string_type,od:num(pick(a,'od_casing','od'))??num(c[0]?.od_body),top:len(num(pick(a,'md_assembly_top','md_top')))??0,shoe:len(num(pick(a,'md_assembly_base','md_base','md_shoe')))??Math.max(0,...c.map(x=>len(num(x.md_base))||0))}});
 const bha=T('CD_ASSEMBLY').filter(a=>/bha|drill/i.test(pick(a,'string_type','assembly_type','assembly_name')||'')&&!/casing/i.test(a.string_type||'')).map(a=>({wb:a.wellbore_id||dz(a.design_id)?.wb,name:a.assembly_name,comps:T('CD_ASSEMBLY_COMP').filter(x=>x.assembly_id==a.assembly_id).sort((x,y)=>(num(x.sequence_no)||0)-(num(y.sequence_no)||0)).map(x=>({type:pick(x,'comp_type_code','description','catalog_key_desc'),len:len(num(x.length)),od:num(x.od_body)}))}));
 const targets=T('CD_TARGET').concat(T('CD_WP_TARGET')).map(t=>({name:t.target_name||t.target_id,wb:t.wellbore_id,well:t.well_id,tvd:len(num(pick(t,'tvd','target_tvd'))),dN:len(num(pick(t,'offset_north','ns'))),dE:len(num(pick(t,'offset_east','ew'))),r:len(num(pick(t,'radius','target_radius')))}));
 return {tag:'IMPORT',units,sites,wells,wbs,designs,traj,casing,bha,targets}}
// pad/site frame: E/N relative to first site centre + slot offsets; Z = TVD below common site datum (highest well datum)
export function siteFrame(M,{prefer=['definitive','survey','plan']}={}){const s0=M.sites[0]||{E:0,N:0};const ref=Math.max(...M.wells.map(w=>w.datum??-Infinity));const sd=Number.isFinite(ref)?ref:0;
 const out=[];for(const wb of M.wbs){const w=M.wells.find(x=>x.id==wb.well)||{};const s=M.sites.find(x=>x.id==w.site)||s0;const ts=M.traj.filter(t=>t.wb==wb.id);
  const t=prefer.map(k=>ts.find(x=>x.kind==k)).find(Boolean);if(!t)continue;const ox=(s.E-s0.E)+(w.dE||0),oy=(s.N-s0.N)+(w.dN||0),sh=sd-(w.datum??sd);
  out.push({well:w.id,wbId:wb.id,name:(w.name||'')+(M.wbs.filter(x=>x.well==wb.well).length>1?' / '+wb.name:''),kind:t.kind,slot:w.slot,shift:sh,pts:t.pts.map(p=>({md:p.md,E:ox+p.ew,N:oy+p.ns,Z:p.tvd+sh}))})}
 return {datum:sd,wbs:out}}
export function analyse(M,opt){const F=siteFrame(M,opt);return {...F,ac:matrix(F.wbs)}}
export async function parseFile(name,buf,{units='ft',onProg}={}){let texts;if(/\.zip$/i.test(name)||(new Uint8Array(buf.slice?buf.slice(0,2):buf)[0]==0x50&&new Uint8Array(buf)[1]==0x4b))texts=await unzip(buf,n=>onProg?.(0.05,'unzipped '+n));else texts=[{name,text:new TextDecoder().decode(buf)}];
 const all={};for(const [i,f] of texts.entries()){const T=scan(f.text,x=>onProg?.(0.1+0.8*(i+x)/texts.length,'parsing '+f.name));for(const k in T){const a=all[k]||(all[k]=[]);for(const r of T[k])a.push(r)}}
 onProg?.(0.92,'building model');const M=build(all,{units});const A=analyse(M);onProg?.(1,'done');return {M,A,files:texts.map(t=>t.name),tables:Object.fromEntries(Object.entries(all).map(([k,v])=>[k,v.length]))}}
