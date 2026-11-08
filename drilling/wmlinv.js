// wmlinv.js v5.9.2.3: whole-well WITSML 1.4.1.1 inventory + use of all the well's data. READ-ONLY (GetCap/GetFromStore only),
// the user's own saved connection, sequential polite queries (header-only / id-only first, small delay, in-memory cache), stop on 401.
// Unsupported object types or errors are recorded per row and are NOT an error state. Server data is tagged LIVE (SIM-TEST on the simulated store).
import * as AC from './ac.js?v=fp-ops-r2-20261108';
export const TYPES=['trajectory','log','mudLog','formationMarker','bhaRun','tubular','rig','wbGeometry','fluidsReport','opsReport','message','risk','cementJob','attachment'];
const GROW={trajectory:1,log:1,mudLog:1};// header-only is defined for growing objects; the rest are listed id-only + a few fields
const FIELDS={formationMarker:'<name/><mdTopSample uom=""/>',bhaRun:'<name/><dTimStart/><dTimStop/><numBitRun/>',tubular:'<name/><typeTubularAssy/>',rig:'<name/><typeRig/><owner/>',
 wbGeometry:'<name/><dTimReport/><mdBottom uom=""/>',fluidsReport:'<name/><dTim/><md uom=""/>',opsReport:'<name/><dTim/><md uom=""/>',message:'<name/><dTim/><typeMessage/><md uom=""/><messageText/><severity/>',
 risk:'<name/><type/><category/><mdBitStart uom=""/><severityLevel/><summary/>',cementJob:'<name/><jobType/><dTimJob/>',attachment:'<name/><fileName/><dTim/><md uom=""/>'};
const M=0.3048,LEN={m:1,ft:M,'ft(us)':1200/3937,usft:1200/3937,km:1000};const L=(e)=>{if(!e)return null;const v=parseFloat(e.textContent);if(!isFinite(v))return null;return v*(LEN[(e.getAttribute('uom')||'m').toLowerCase()]??1)};
export const cache=new Map();const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const X=()=>window.GX.witsml;
export const tagOf=()=>{try{return X().svSimTest()||/\/sim\/|\/\/(127\.0\.0\.1|localhost)[:/]/.test(X().CFG.url)?'SIM-TEST':'LIVE'}catch{return 'LIVE'}};
// GetCap: which data objects does GetFromStore support? null = unknown (treat all as "try")
export function parseCap(xs){if(!xs)return null;const d=new DOMParser().parseFromString(xs,'application/xml');const fns=[...d.getElementsByTagNameNS('*','function')].filter(f=>/GetFromStore/.test(f.getAttribute('name')||''));
 if(!fns.length)return null;const o=new Set([...fns[0].getElementsByTagNameNS('*','dataObject')].map(e=>e.textContent.trim()));return o.size?o:null}
const qOf=(t,w,b)=>{const ns=X().NS,xa=X().xa;if(GROW[t]){const ex=t=='log'?'<name/><indexType/><startIndex uom=""/><endIndex uom=""/><startDateTimeIndex/><endDateTimeIndex/><logCurveInfo uid=""><mnemonic/><unit/></logCurveInfo>':t=='trajectory'?'<name/><mdMn uom=""/><mdMx uom=""/>':'<name/><startMd uom=""/><endMd uom=""/>';
  return [`<${t}s ${ns}><${t} uidWell="${xa(w)}" uidWellbore="${xa(b)}" uid="">${ex}<commonData><dTimLastChange/></commonData></${t}></${t}s>`,'returnElements=requested']}
 return [`<${t}s ${ns}><${t} uidWell="${xa(w)}" uidWellbore="${xa(b)}" uid="">${FIELDS[t]||'<name/>'}<commonData><dTimLastChange/></commonData></${t}></${t}s>`,'returnElements=requested']};
export function summarise(t,d){const k=(n,x)=>[...n.getElementsByTagNameNS('*',x)],one=(n,x)=>k(n,x)[0],tx=(n,x)=>one(n,x)?.textContent.trim()||'';
 const objs=k(d,t).map(o=>{const r={uid:o.getAttribute('uid')||'',name:tx(o,'name'),last:tx(o,'dTimLastChange')||tx(o,'dTim')||tx(o,'dTimReport')||tx(o,'dTimStop')||tx(o,'dTimJob')};
  if(t=='log'){r.indexType=tx(o,'indexType');r.depth=/depth|length/i.test(r.indexType);if(r.depth){r.from=L(one(o,'startIndex'));r.to=L(one(o,'endIndex'))}else{r.from=tx(o,'startDateTimeIndex');r.to=tx(o,'endDateTimeIndex')}r.curves=k(o,'logCurveInfo').length}
  if(t=='trajectory'){r.from=L(one(o,'mdMn'));r.to=L(one(o,'mdMx'))}if(t=='mudLog'){r.from=L(one(o,'startMd'));r.to=L(one(o,'endMd'))}
  if(['fluidsReport','opsReport','message','attachment'].includes(t))r.md=L(one(o,'md'));if(t=='message'){r.text=tx(o,'messageText');r.sev=tx(o,'severity');r.kind=tx(o,'typeMessage')}
  if(t=='risk'){r.text=tx(o,'summary');r.sev=tx(o,'severityLevel');r.kind=tx(o,'category')||tx(o,'type');r.md=L(one(o,'mdBitStart'))}return r});
 const md=objs.flatMap(o=>[o.from,o.to,o.md]).filter(v=>typeof v=='number'&&isFinite(v)),ts=objs.flatMap(o=>[o.last,typeof o.to=='string'?o.to:'']).filter(Boolean).sort();
 return {n:objs.length,objs,mdMin:md.length?Math.min(...md):null,mdMax:md.length?Math.max(...md):null,last:ts.at(-1)||''}}
const unsupported=e=>/-4(05|24|25|60|65)|not support|unsupported|not implemented/i.test((e.result??'')+' '+(e.supp||'')+' '+e.message);
// main: inventory of one well (all wellbores x all types). onRow(row) for progressive UI.
export async function inventory(well,{delayMs=150,onRow,force}={}){const key=X().CFG.url+'|'+well;if(!force&&cache.has(key))return cache.get(key);
 const I={well,tag:tagOf(),started:new Date().toISOString(),cap:null,capNote:'',wellbores:[],rows:[],calls:0,stopped:''};
 try{const g=await X().callRetry('WMLS_GetCap','','','dataVersion=1.4.1.1');I.calls++;I.cap=parseCap(X().normXml(g.xml||''));I.capNote=I.cap?I.cap.size+' object types advertised':'GetCap gave no object list (trying all)'}catch(e){if(e.auth||X().WML.authDead){I.stopped='auth failure (401) — stopped';return I}I.capNote='GetCap failed ('+e.message+') — trying all'}
 try{I.wellbores=await X().listWellbores(well);I.calls++}catch(e){if(e.auth||X().WML.authDead){I.stopped='auth failure (401) — stopped';return I}I.stopped='wellbore list failed: '+e.message;return I}
 for(const b of I.wellbores)for(const t of TYPES){if(X().WML.authDead){I.stopped='auth failure (401) — stopped';return I}
  const row={wb:b.uid,wbName:b.name,type:t,n:0,state:'',tag:I.tag};
  if(I.cap&&!I.cap.has(t)){row.state='not supported by server (GetCap)';I.rows.push(row);onRow?.(row,I);continue}
  const [q,o]=qOf(t,well,b.uid);try{const j=await X().callRetry('WMLS_GetFromStore',t,q,o);I.calls++;const s=summarise(t,X().xml(X().normXml(j.xml||'')));Object.assign(row,s,{state:s.n?'ok':'none'})}
  catch(e){I.calls++;if(e.auth||X().WML.authDead){I.stopped='auth failure (401) — stopped';row.state='stopped';I.rows.push(row);return I}row.state=unsupported(e)?'not supported by server':'skipped ('+String(e.message).slice(0,60)+')'}
  I.rows.push(row);onRow?.(row,I);if(delayMs)await sleep(delayMs)}
 I.done=new Date().toISOString();cache.set(key,I);return I}
// ---- use the data (full fetch of ONE small object, on demand) ----
async function getAll(t,w,b,uid){const ns=X().NS,xa=X().xa;const j=await X().callRetry('WMLS_GetFromStore',t,`<${t}s ${ns}><${t} uidWell="${xa(w)}" uidWellbore="${xa(b)}" uid="${xa(uid)}"/></${t}s>`,'returnElements=all');return X().xml(X().normXml(j.xml||''))}
export function parseCasing(d){const k=(n,x)=>[...n.getElementsByTagNameNS('*',x)],tx=(n,x)=>k(n,x)[0]?.textContent.trim()||'';const len=(n,x)=>L(k(n,x)[0]);
 const IN={in:0.0254,m:1,mm:0.001,cm:0.01,ft:M};const dia=(n,x)=>{const e=k(n,x)[0];if(!e)return null;const v=parseFloat(e.textContent);return isFinite(v)?v*(IN[(e.getAttribute('uom')||'in').toLowerCase()]??0.0254):null};
 return k(d,'wbGeometrySection').map(s=>({type:tx(s,'typeHoleCasing'),top:len(s,'mdTop'),bot:len(s,'mdBottom'),id:dia(s,'idSection'),od:dia(s,'odSection'),grade:tx(s,'grade')})).sort((a,b)=>(a.top??0)-(b.top??0))}
export function parseTubular(d){const k=(n,x)=>[...n.getElementsByTagNameNS('*',x)],tx=(n,x)=>k(n,x)[0]?.textContent.trim()||'';const IN={in:0.0254,m:1,mm:0.001};
 const dia=(n,x)=>{const e=k(n,x)[0];if(!e)return null;const v=parseFloat(e.textContent);return isFinite(v)?v*(IN[(e.getAttribute('uom')||'in').toLowerCase()]??0.0254):null};
 return k(d,'tubularComponent').map(c=>({type:tx(c,'typeTubularComp'),seq:+tx(c,'sequence')||0,len:L(k(c,'len')[0]),od:dia(c,'od'),id:dia(c,'id'),desc:tx(c,'description')})).sort((a,b)=>a.seq-b.seq)}
export function parseReports(t,d){const k=(n,x)=>[...n.getElementsByTagNameNS('*',x)],tx=(n,x)=>k(n,x)[0]?.textContent.trim()||'';
 return k(d,t).map(o=>t=='fluidsReport'?{dTim:tx(o,'dTim'),md:L(k(o,'md')[0]),fluids:k(o,'fluid').map(f=>({type:tx(f,'type'),dens:(()=>{const e=k(f,'density')[0];if(!e)return null;const v=+e.textContent,u=(e.getAttribute('uom')||'').toLowerCase();return u=='ppg'||u=='lbm/galus'?v*119.826:u=='g/cm3'||u=='sg'?v*1000:v})(),pv:+tx(f,'pv')||null}))}
  :{dTim:tx(o,'dTim'),md:L(k(o,'md')[0]),activities:k(o,'activity').map(a=>({start:tx(a,'dTimStart'),end:tx(a,'dTimEnd'),code:tx(a,'phase')||tx(a,'proprietaryCode'),md:L(k(a,'md')[0]),desc:tx(a,'comments')}))}).sort((a,b)=>(a.dTim>b.dTim)-(a.dTim<b.dTim))}
export async function useCasing(I){const r=I.rows.filter(x=>x.type=='wbGeometry'&&x.n);const out=[];for(const x of r)for(const o of x.objs){out.push(...parseCasing(await getAll('wbGeometry',I.well,x.wb,o.uid)).map(s=>({...s,wb:x.wb,tag:I.tag})));await sleep(100)}return out}
export async function useBha(I){const r=I.rows.filter(x=>x.type=='tubular'&&x.n);const out=[];for(const x of r)for(const o of x.objs){out.push({name:o.name,wb:x.wb,tag:I.tag,comps:parseTubular(await getAll('tubular',I.well,x.wb,o.uid))});await sleep(100)}
 const runs=I.rows.filter(x=>x.type=='bhaRun').flatMap(x=>x.objs.map(o=>({...o,wb:x.wb})));return {assemblies:out,runs}}
export async function useReports(I,t){const r=I.rows.filter(x=>x.type==t&&x.n);const out=[];for(const x of r)for(const o of x.objs.slice(-20)){out.push(...parseReports(t,await getAll(t,I.well,x.wb,o.uid)).map(z=>({...z,wb:x.wb,tag:I.tag})));await sleep(100)}return out}
export const messagesRisks=I=>I.rows.filter(x=>(x.type=='message'||x.type=='risk')&&x.n).flatMap(x=>x.objs.map(o=>({...o,type:x.type,wb:x.wb,tag:I.tag}))).sort((a,b)=>(b.last||'').localeCompare(a.last||''));
export const logsByIndex=I=>{const l=I.rows.filter(x=>x.type=='log'&&x.n).flatMap(x=>x.objs.map(o=>({...o,wb:x.wb,tag:I.tag})));return {time:l.filter(o=>!o.depth),depth:l.filter(o=>o.depth)}};
export const trajectories=I=>I.rows.filter(x=>x.type=='trajectory'&&x.n).flatMap(x=>x.objs.map(o=>({...o,wb:x.wb,wbName:x.wbName,tag:I.tag}))).sort((a,b)=>(b.to??0)-(a.to??0));
// ---- site view: all wells under the folder (header-only), well location + datums, then each well's main trajectory, anti-collision ----
export function parseWellLoc(d){const k=(n,x)=>[...n.getElementsByTagNameNS('*',x)],tx=(n,x)=>k(n,x)[0]?.textContent.trim()||'';
 return k(d,'well').map(w=>{const loc=k(w,'wellLocation')[0];const e=loc&&(L(k(loc,'easting')[0])??L(k(loc,'projectedX')[0])),n=loc&&(L(k(loc,'northing')[0])??L(k(loc,'projectedY')[0]));
  const datums=k(w,'wellDatum').map(x=>({uid:x.getAttribute('uid')||'',code:tx(x,'code'),elev:L(k(x,'elevation')[0]),ref:k(x,'elevation')[0]?.getAttribute('datum')||''}));
  const conv=(()=>{const e=k(w,'gridConvergence')[0]||k(loc||w,'gridConvergence')[0];return e?parseFloat(e.textContent)*((e.getAttribute('uom')||'dega').toLowerCase()=='rad'?180/Math.PI:1):null})();
  return {uid:w.getAttribute('uid'),name:tx(w,'name'),E:e,N:n,crs:loc?tx(loc,'wellCRS')||k(loc,'wellCRS')[0]?.getAttribute('uidRef')||'':'',datums,conv}})}
// elevation (m above the common reference, normally MSL) of a well datum uid/code; RKB/KB/DF if no uid given
export function datumElev(datums,uidOrCode){const by=x=>datums.find(d=>d.uid==x||d.code==x);let d=uidOrCode?by(uidOrCode):(by('KB')||by('RKB')||by('DF'));if(!d)return null;
 let e=d.elev??0,g=0;while(d&&d.ref&&d.ref!=d.uid&&g++<5){const r=by(d.ref);if(!r)break;e+=r.elev??0;d=r}return e}
// TVD measured from datum A -> measured from datum B (both elevations above the same reference): tvdB = tvdA + (elevB - elevA)
export const datumShift=(datums,from,to)=>{const a=datumElev(datums,from),b=datumElev(datums,to);return a==null||b==null?0:b-a};
export async function siteView({delayMs=150,onProgress}={}){const ns=X().NS;const tag=tagOf();
 const j=await X().callRetry('WMLS_GetFromStore','well',`<wells ${ns}><well uid=""><name/><wellLocation uid=""/><wellDatum uid=""/><gridConvergence uom=""/></well></wells>`,'returnElements=requested');
 const wells=parseWellLoc(X().xml(X().normXml(j.xml||'')));const out=[];
 for(const w of wells){if(X().WML.authDead)break;onProgress?.(w.name);let wbs=[];try{wbs=await X().listWellbores(w.uid)}catch(e){if(e.auth)break}
  for(const b of wbs){await sleep(delayMs);let st=[];try{const r=await X().callRetry('WMLS_GetFromStore','trajectory',`<trajectorys ${ns}><trajectory uidWell="${X().xa(w.uid)}" uidWellbore="${X().xa(b.uid)}" uid=""/></trajectorys>`,'returnElements=all');st=X().svParse(r.xml||'')}catch(e){if(e.auth)break;continue}
   if(!st.length)continue;out.push({well:w.uid,wellName:w.name,wb:b.uid,wbName:b.name,E:w.E,N:w.N,datums:w.datums,stations:st,tag})}}
 return siteFrame(out)}
// common site frame: E/N from well location (m), TVD below the site datum (highest KB = 0, or MSL when no KB). Stations in feet/deg (svParse) -> min curvature in m.
export function siteFrame(wbs,{siteDatumElev=null}={}){const G=window.GEO_GG;const withE=wbs.filter(x=>isFinite(x.E)&&isFinite(x.N));const E0=withE.length?Math.min(...withE.map(x=>x.E)):0,N0=withE.length?Math.min(...withE.map(x=>x.N)):0;
 const kb=x=>datumElev(x.datums||[],x.stations?.[0]?.datum||null);const ref=siteDatumElev??Math.max(0,...wbs.map(kb).filter(v=>v!=null));
 for(const x of wbs){const c=AC.minCurvM(x.stations.map(s=>({md:s.md*M,inc:s.inc,azi:s.azi})));const dz=(kb(x)??ref)-ref;x.pts=c.map(p=>({md:p.md,E:(x.E??E0)-E0+p.ew,N:(x.N??N0)-N0+p.ns,Z:p.tvd-dz}));x.datumNote=kb(x)==null?'datum not stated (assumed site datum)':'datum '+kb(x).toFixed(2)+' m, shifted '+(-dz).toFixed(2)+' m to site datum'}
 return {wbs,siteDatumElev:ref,ac:AC.matrix(wbs)}}
