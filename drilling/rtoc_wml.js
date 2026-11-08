// rtoc_wml.js: READ-ONLY adapter WITSML well model (wwell.discoverWell result) -> Steve's RTOC data (internal ft / klbf / ft·lbf / psi / gpm,
// same as the simulator). Never writes to a store; never invents values. Joints come ONLY from connection evidence
// (pumps off + rotation stopped + bit lifted off bottom); without the channels for that evidence, no joints are produced and a gap is reported.
const FT=0.3048;
const LEN={m:1/FT,ft:1,'0.1 ft':0.1,'ft(us)':1},ROP={'m/h':1/FT,'m/hr':1/FT,'ft/h':1,'ft/hr':1},FORCE={kn:0.224809,klbf:1,'1000 lbf':1,kkgf:2.20462,tonf:2.20462},
 TQ={'kn.m':737.562,'kn·m':737.562,'kj':737.562,'ft.lbf':1,'kft.lbf':1000,'n.m':0.737562},PRES={kpa:0.145038,psi:1,bar:14.5038,mpa:145.038},FLOW={'l/min':0.264172,gpm:1,'gal/min':1,'m3/min':264.172,'m3/s':15850.3};
const cv=(T,u)=>{const f=T[String(u||'').toLowerCase()];return f==null?null:v=>Number.isFinite(v)?v*f:null};
export const MN={bd:/^(DBTM|BITDEP|BDEP|BIT_DEPTH|BITDEPTH)$/i,hd:/^(DMEA|HDTH|HDEP|DEPTH_HOLE|HOLEDEPTH|DEPT)$/i,rop:/^(ROPA|ROP|ROP5|ROPI)$/i,wob:/^(SWOB|WOBA|WOB)$/i,tq:/^(TQA|STOR|TORQUE|TQ)$/i,rpm:/^(RPMA|SRPM|RPM|TRPM)$/i,spp:/^(SPPA|SPP|PRESSURE)$/i,q:/^(TFLO|FLWI|FLOWIN|MFIA|FLOW)$/i};
const UT={bd:LEN,hd:LEN,rop:ROP,wob:FORCE,tq:TQ,rpm:null,spp:PRES,q:FLOW};
export function channels(set){const o={},miss=[];for(const k in MN){const j=(set?.ml||[]).findIndex((m,i)=>i>0&&MN[k].test(m));if(j<0){miss.push(k);continue}const f=UT[k]?cv(UT[k],set.ul?.[j]):(v=>Number.isFinite(v)?v:null);if(!f){miss.push(k+' (unit '+set.ul?.[j]+' unsupported)');continue}o[k]={j,f,mn:set.ml[j],unit:set.ul?.[j]||''}}return {o,miss}}
const med=a=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?b[b.length>>1]:null};
// time-log rows -> RTOC samples. evidence=false when bit depth, hole depth and flow are not all present.
export function samples(set){const {o,miss}=channels(set);if(!set||!set.time||!set.rows?.length)return {list:[],miss,evidence:false,why:'No time-indexed drilling log in this wellbore'};
 const g=(r,k)=>{if(!o[k])return null;const v=r[o[k].j];return v==null||typeof v==='string'&&!v.trim()?null:o[k].f(Number(v))};const evidence=!!(o.bd&&o.hd&&o.q);const qMed=o.q?med(set.rows.map(r=>g(r,'q')).filter(v=>v>0)):null;
 const list=set.rows.map(r=>{const t=+r[0],bd=g(r,'bd'),hd=g(r,'hd'),q=g(r,'q'),rpm=g(r,'rpm');const md=Number.isFinite(hd)?hd:bd;
  const off=Number.isFinite(bd)&&Number.isFinite(hd)?hd-bd>1.5:null;const slips=evidence?(q!=null&&qMed!=null&&q<0.05*qMed&&(rpm==null||rpm<5)&&off===true):false;
  const mode=rpm==null?null:rpm>10?'rotate':'slide';return {t:t/1000,wall:t,md,bd,mode,slips,rop:g(r,'rop'),wob:g(r,'wob'),rpm,tq:g(r,'tq'),spp:g(r,'spp'),q,seq:false,faults:rpm==null?'LOW CONFIDENCE: rotation unverified (RPM missing)':'',jointConfidence:rpm==null?'low':'normal'}}).filter(s=>Number.isFinite(s.t)&&Number.isFinite(s.md));for(let i=1;i<list.length;i++)if(list[i].t-list[i-1].t>600)list[i].gapBefore=true;/* t in SECONDS like the simulator; >10 min index gap = missing interval, not off-bottom time */
 return {list,miss,evidence,why:evidence?'':'No connection evidence: needs bit depth, hole depth and flow-in channels (missing: '+miss.filter(m=>/^(bd|hd|q)/.test(m)).join(', ')+')'}}
// trajectory rows [md,inc,azi,tvd] (m) -> survey rows [md,inc,azi,N,E,TVD] (ft) by minimum curvature (N/E not stored by the parser)
export function surveyRows(t){const ul=t.ul||[];const k=LEN[String(ul[0]||'m').toLowerCase()]??1/FT,R=Math.PI/180;const out=[];let N=0,E=0,V=0;
 for(const r of (t.rows||[]).filter(r=>Number.isFinite(r[0])&&Number.isFinite(r[1])&&Number.isFinite(r[2]))){const md=r[0]*k;if(out.length){const p=out.at(-1),i1=p[1]*R,i2=r[1]*R,a1=p[2]*R,a2=r[2]*R,dm=md-p[0];
   const b=Math.acos(Math.max(-1,Math.min(1,Math.cos(i2-i1)-Math.sin(i1)*Math.sin(i2)*(1-Math.cos(a2-a1))))),f=b<1e-7?1:2/b*Math.tan(b/2);
   N+=dm/2*(Math.sin(i1)*Math.cos(a1)+Math.sin(i2)*Math.cos(a2))*f;E+=dm/2*(Math.sin(i1)*Math.sin(a1)+Math.sin(i2)*Math.sin(a2))*f;V+=dm/2*(Math.cos(i1)+Math.cos(i2))*f}
  out.push([md,r[1],r[2],N,E,Number.isFinite(r[3])?r[3]*k:V])}return out}
export function datumText(xml,well){let X=String(xml||'');if(well){const i=X.indexOf(`<well uid="${well}"`);if(i<0)return null;X=X.slice(i,X.indexOf('</well>',i)+7)}const m=X.match(/<wellDatum\b[^>]*>([\s\S]*?)<\/wellDatum>/);if(!m)return null;const code=(m[1].match(/<code>([^<]*)/)||[])[1]||'',el=m[1].match(/<elevation\b([^>]*)>([^<]*)/);
 return el?`${code||'datum'} ${(+el[2]).toFixed(1)} ${(el[1].match(/uom="([^"]*)"/)||[])[1]||''} above ${(el[1].match(/datum="([^"]*)"/)||[])[1]||'?'} (wellDatum)`:`${code||'datum'} (no elevation)`}
// R = discoverWell result; extra = {source, current, casing:[{type,top,bot,od}] (m), datumXml}
export function toRtoc(R,extra={}){const wb=extra.wb||R.P?.wb||R.wbs?.[0]?.uid||'';const inWb=R.sets.filter(s=>s.wb==wb);
 const P=(R.P&&R.P.wb==wb)?R.P:(inWb.filter(s=>s.obj=='log'&&s.time&&s.rows?.length).sort((a,b)=>b.rows.length-a.rows.length)[0]||inWb[0]||null);const tr=R.sets.filter(s=>s.obj=='trajectory'&&s.wb==wb);
 const plan=tr.filter(t=>/plan|prop|design/i.test(t.name||'')),def=tr.filter(t=>!plan.includes(t)).sort((a,b)=>(b.rows.at(-1)?.[0]||0)-(a.rows.at(-1)?.[0]||0))[0];
 const tl=(extra.timeLog&&extra.timeLog.wb==wb)?extra.timeLog:P&&P.obj=='log'&&P.time?P:R.sets.find(s=>s.obj=='log'&&s.time&&s.wb==wb&&s.rows?.length);const sm=samples(tl);
 const surveys=def?surveyRows(def):[],planRows=plan[0]?surveyRows(plan[0]):[];
 const bitMd=sm.list.length?(sm.list.at(-1).bd??sm.list.at(-1).md):null;
 const cas=(extra.casing||[]).filter(c=>/casing|liner/i.test(c.type||'')&&Number.isFinite(c.bot)).map(c=>({name:(c.od?(c.od/0.0254).toFixed(3).replace(/\.?0+$/,'')+'" ':'')+(c.type||'casing'),shoeMD:c.bot/FT,topMD:(c.top||0)/FT,src:'wbGeometry'}));
 const gaps=[];if(!sm.list.length)gaps.push(sm.why);else if(!sm.evidence)gaps.push(sm.why);if(sm.list.some(s=>s.jointConfidence==='low'))gaps.push('LOW CONFIDENCE joint history: RPM missing; rotation stopped is unverified');if(sm.miss.length)gaps.push('Channels not in log: '+sm.miss.join(', '));if(!def)gaps.push('No definitive trajectory');if(!planRows.length)gaps.push('No plan trajectory in store');if(!cas.length)gaps.push('No casing (wbGeometry) in store');if(!extra.datumXml||!datumText(extra.datumXml,R.well))gaps.push('Depth reference (wellDatum) not specified');
 (extra.logStatus||[]).forEach(L=>{if(L.status!='complete')gaps.push(`${L.name}: history ${L.status.toUpperCase()} (${L.rows} rows, ${L.pages} pages)`);if(L.gaps.length)gaps.push(`${L.name}: ${L.gaps.length} missing interval(s)`);if(L.sparse.length)gaps.push(`${L.name}: sparse ${L.sparse.join(', ')}`)});
 const lay=layersFrom(extra.markers||[],surveys);if(!lay.list.length)gaps.push('No formation markers in store (neutral geology)');
 const src=extra.source||'WITSML',key=[src,R.well,wb].join('|');
 return {key,source:src,well:R.well,wellName:extra.wellName||R.well,wb,wbName:P?.wbName||wb,current:!!extra.current,samples:sm.list,evidence:sm.evidence,why:sm.why,
  surveys,plan:planRows,td:planRows.length?planRows.at(-1)[0]:null,az:(planRows.at(-1)||surveys.at(-1)||[0,0,0])[2],casing:cas,ref:datumText(extra.datumXml,R.well),
  lay,events:(extra.messages||[]).filter(m=>m.t).map(m=>[m.t/1000,(m.type?'['+m.type+'] ':'')+m.text]),logs:extra.logStatus||[],wbs:(R.wbs||[]).map(b=>({uid:b.uid,name:b.name||b.uid})),fresh:extra.fresh||null,bitMd,logName:tl?.name||null,logRows:tl?.rows?.length||0,trajName:def?.name||null,planName:plan[0]?.name||null,gaps,readOnly:true}}

// formationMarker tops (MD) -> layer tops by TVD along the definitive survey. Neutral greys only: names are store data, colours are NOT lithology.
export function layersFrom(markers,surveys){const tv=md=>{if(!surveys.length)return null;for(let i=1;i<surveys.length;i++){const a=surveys[i-1],b=surveys[i];if(md<=b[0])return a[5]+(b[5]-a[5])*(md-a[0])/((b[0]-a[0])||1)}return null};
 const G=['#5a5c60','#4b4d51','#66686c','#54565a'];const list=markers.map((m,i)=>({name:m.name,top:Number.isFinite(m.tvd)?m.tvd:tv(m.md),md:m.md,c:G[i%4],lith:'',neutral:true})).filter(l=>Number.isFinite(l.top));
 return {src:list.length?'formationMarker (store)':null,list}}
