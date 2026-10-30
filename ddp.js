// ddp.js v5.8 W3: survey program per hole section, DD instructions per section and per stand (slide/rotate, toolface, BHA from the
// BHA builder, anti-collision watch points, contingency), CSV + PDF export, plan-at-MD for the slide sheet's plan-vs-actual columns.
// Proposal / simulator data only: everything here is tagged SIM (concept planning aid, not an approved directional program). No network calls.
import * as WP from './wplan.js?v=b8';import * as AC from './wac.js';
const R2D=180/Math.PI,fin=Number.isFinite,$=id=>typeof document!='undefined'?document.getElementById(id):null,es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
export const OPT={stand:28.5,yield:6,rotDls:0.3,surveyHold:30,surveyCurve:10,tag:'SIM'};
const HOLE={'13-3/8':'17-1/2"','9-5/8':'12-1/4"','7"':'8-1/2"','7 ':'8-1/2"'};
const holeFor=n=>{for(const k in HOLE)if(n.includes(k))return HOLE[k];return 'SIM hole'};
export function planAt(L,md){if(!L||!fin(md))return null;md=Math.max(0,Math.min(L.td,md));const [inc,azi]=WP.incAzi(WP.dirAt(L,md));const g=L.legs.find(l=>md>=l.md0-1e-6&&md<=l.md1+1e-6)||L.legs.at(-1);return {md,inc,azi,kind:g.kind,dls:g.dls||0}}
// hole sections from casing points (W.CS = casingMD)
export function sections(L,S,CS){const cps=(CS||WP.casingMD(L,S)).map(c=>({...c,md:Math.min(c.md,L.td)})).sort((a,b)=>a.md-b.md);let md0=0;const out=[];
 for(const c of cps){if(c.md<=md0+1)continue;const R=S.rows.filter(r=>r.md>=md0-1e-6&&r.md<=c.md+1e-6),legs=L.legs.filter(l=>l.md1>md0+1e-6&&l.md0<c.md-1e-6&&l.len>0);
  out.push({name:c.name.replace(/\s*\d.*$/,'')||c.name,casing:c.name,hole:holeFor(c.name),md0,md1:c.md,tvd1:R.at(-1)?.tvd??0,maxInc:Math.max(...R.map(r=>r.inc)),maxDls:Math.max(0,...R.map(r=>r.dls)),kinds:[...new Set(legs.map(l=>l.kind))],legs});md0=c.md}
 return out}
// anti-collision: per-station SF of the plan against each offset (simplified model, concept only)
export function acScan(L,offs,M=AC.MODEL){const ref=AC.planWell(L,M),W=(offs||AC.SIM_OFFSETS).map(o=>AC.well(o.name,o.head,o.rows,o.tag||'SIM',M));return {M,rep:AC.report(ref,W,M),scans:W.map(o=>({name:o.name,S:AC.scan(ref,o,M)}))}}
const sfIn=(A,a,b)=>A?A.scans.map(o=>{const s=o.S.filter(x=>x.md>=a-1e-6&&x.md<=b+1e-6&&fin(x.sf));if(!s.length)return null;const m=s.reduce((p,q)=>q.sf<p.sf?q:p);return {name:o.name,sf:m.sf,md:m.md,dist:m.dist}}).filter(Boolean):[];
export function surveyProgram(L,S,secs,A,o={}){o={...OPT,...o};return secs.map((s,i)=>{const w=sfIn(A,s.md0,s.md1),alert=w.filter(x=>x.sf<A.M.alert),curve=s.maxDls>=1;
 const zones=A?A.scans.map(x=>{const z=x.S.filter(q=>q.md>=s.md0&&q.md<=s.md1&&q.sf<A.M.alert);return z.length?`${x.name} ${z[0].md.toFixed(0)}-${z.at(-1).md.toFixed(0)} m`:null}).filter(Boolean):[];
 return {section:s.name,hole:s.hole,md0:s.md0,md1:s.md1,
  tool:i==0?'Gyro (north-seeking) to clear surface interference + offsets, then MWD':'MWD (magnetic), gyro check survey at casing point',
  interval:curve||alert.length?`${o.surveyCurve} m (curve/AC zone), else ${o.surveyHold} m`:`${o.surveyHold} m (each stand)`,
  stations:Math.ceil((s.md1-s.md0)/(curve?o.surveyCurve:o.surveyHold))+1,
  extra:zones.length?'Every 10 m inside AC alert zone: '+zones.join('; '):'none',
  qc:'MWD QC: G-total, B-total, dip vs field model; non-mag spacing check; tie-in to previous section',
  em:AC.EM_LABEL,maxInc:s.maxInc,maxDls:s.maxDls,minSF:w.length?Math.min(...w.map(x=>x.sf)):null,tag:o.tag}})}
export function bhaInfo(){const ws=typeof window!='undefined'?window.GX?.ws:null,ST=ws?.ST;if(!ws||!ST?.bha?.length)return {name:'BHA builder not loaded (SIM default: motor 1.5° bend)',motor:true,len:null,items:[],tag:'SIM'};
 const T=ws.totals(ST.bha),names=ST.bha.map(x=>x.name||x.type||'item'),motor=names.some(n=>/motor|pdm/i.test(n)),rss=names.some(n=>/rss|rotary steer/i.test(n));
 return {name:(ws.PRESETS?.[ST.preset]?.name||ST.preset||'custom')+` · ${T.n||ST.bha.length} items · ${T.len.toFixed(1)} m`,motor:motor||!rss,rss,len:T.len,items:names,tag:'SIM'}}
// per-stand instructions
export function stands(L,S,A,o={}){o={...OPT,...o};const B=o.bha||bhaInfo(),out=[];let n=1;
 for(let a=0;a<L.td-0.01;a+=o.stand,n++){const b=Math.min(L.td,a+o.stand),len=b-a,p0=planAt(L,a),p1=planAt(L,b);const dl=WP.dogleg(p0.inc,p0.azi,p1.inc,p1.azi)*R2D,dls=dl*30/len;
  let tf=dls>=o.rotDls?WP.toolface(p0.inc,p0.azi,p1.inc,p1.azi):null;tf=tf==null?null:((tf%360)+360)%360;
  const kind=p1.kind,need=dls<o.rotDls?0:B.rss?1:Math.min(1,dls/o.yield),slide=+(len*need).toFixed(1),rot=+(len-slide).toFixed(1);
  const w=sfIn(A,a,b).sort((x,y)=>x.sf-y.sf),wn=w[0],lvl=!wn?'':wn.sf<A.M.stop?'STOP':wn.sf<A.M.alert?'ALERT':wn.sf<A.M.alert*1.5?'WATCH':'';
  const mode=need==0?'Rotate':B.rss?`RSS steer ${Math.round(dls/ o.yield*100)}%`:need>=1?'Slide':'Slide + rotate';
  const cont=[];if(!B.rss&&dls>o.yield)cont.push(`Plan DLS ${dls.toFixed(1)} > motor yield ${o.yield}: slide full stand, plan wiper/POOH for higher bend if behind`);
  if(need>0)cont.push('If BUR behind plan >1°/30m over 2 stands: lengthen slide; ahead: rotate more');else cont.push('If inc/azi drift >1° from plan: correction slide next stand');
  if(lvl=='STOP')cont.unshift(`STOP: SF ${wn.sf.toFixed(2)} vs ${wn.name} below stop ${A.M.stop}. Do not drill without approved AC deviation`);
  else if(lvl=='ALERT')cont.unshift(`ALERT: SF ${wn.sf.toFixed(2)} vs ${wn.name}: survey every 10 m, notify DD + company rep, gyro if magnetic interference`);
  else if(lvl=='WATCH')cont.unshift(`WATCH: SF ${wn.sf.toFixed(2)} vs ${wn.name}: check survey QC each station`);
  out.push({stand:n,md0:a,md1:b,len,inc0:p0.inc,azi0:p0.azi,inc1:p1.inc,azi1:p1.azi,kind,dls,tf,tfRef:tf==null?'':p0.inc<3?'MTF':'GTF',mode,slide,rot,ac:wn?`${wn.name} SF ${wn.sf.toFixed(2)} @ ${wn.md.toFixed(0)} m`:'',acLvl:lvl,cont:cont.join(' | '),tag:o.tag})}
 return out}
export function ddSections(secs,ST,o={}){o={...OPT,...o};const B=o.bha||bhaInfo();return secs.map(s=>{const R=ST.filter(x=>x.md0<s.md1-1e-6&&x.md1>s.md0+1e-6),fr=x=>(Math.min(x.md1,s.md1)-Math.max(x.md0,s.md0))/x.len,sl=R.reduce((p,x)=>p+x.slide*fr(x),0),ro=R.reduce((p,x)=>p+x.rot*fr(x),0);
 return {section:s.name,hole:s.hole,md0:s.md0,md1:s.md1,objective:s.kinds.join(' / ')||'hold',bha:B.name,slideM:sl,rotM:ro,slidePct:sl+ro?sl/(sl+ro)*100:0,tfs:[...new Set(R.filter(x=>x.tf!=null).map(x=>Math.round(x.tf/5)*5))].slice(0,6).join(', '),
  ac:R.filter(x=>x.acLvl&&x.acLvl!='').map(x=>`#${x.stand} ${x.acLvl} ${x.ac}`).slice(0,5).join('; ')||'none',
  contingency:(B.rss?'RSS: if steering ratio >80% for 3 stands review BHA/hole cleaning. ':`Motor yield ${o.yield}°/30m: if achieved BUR < plan, slide more; if still short, POOH for higher bend. `)+'Losses/stuck pipe: follow rig procedures. Tight AC zone: see per-stand watch points.',tag:o.tag}})}
export function program(W,o={}){const L=W.L,S=W.S,A=o.A||acScan(L,o.offs,o.M),secs=sections(L,S,W.CS);const ST=stands(L,S,A,o);return {name:W.P?.name||'plan',td:L.td,secs,survey:surveyProgram(L,S,secs,A,o),stands:ST,dd:ddSections(secs,ST,o),bha:o.bha||bhaInfo(),A,em:AC.EM_LABEL,tag:'SIM'}}
// ---- export ----
const f=(v,d=1)=>v==null||!fin(v)?'':v.toFixed(d),q=s=>/[",\n]/.test(String(s))?'"'+String(s).replace(/"/g,'""')+'"':String(s);
export function toCSV(G){const L=['# DD program (SIM proposal - concept planning aid; not an approved directional program),'+q(G.name),'# '+G.em,'# BHA,'+q(G.bha.name),'','# SURVEY PROGRAM',
 'Section,Hole,From MD (m),To MD (m),Tool,Interval,Stations,Extra surveys,QC,Max Inc (deg),Max DLS (deg/30m),Min SF,Tag',
 ...G.survey.map(s=>[s.section,s.hole,f(s.md0),f(s.md1),s.tool,s.interval,s.stations,s.extra,s.qc,f(s.maxInc),f(s.maxDls,2),f(s.minSF,2),s.tag].map(q).join(',')),'','# DD INSTRUCTIONS PER SECTION',
 'Section,Hole,From MD,To MD,Objective,BHA,Slide (m),Rotate (m),Slide %,Toolfaces (deg),AC watch points,Contingency,Tag',
 ...G.dd.map(s=>[s.section,s.hole,f(s.md0),f(s.md1),s.objective,s.bha,f(s.slideM),f(s.rotM),f(s.slidePct,0),s.tfs,s.ac,s.contingency,s.tag].map(q).join(',')),'','# DD INSTRUCTIONS PER STAND',
 'Stand,From MD (m),To MD (m),Plan Inc in,Plan Azi in,Plan Inc out,Plan Azi out,Leg,DLS (deg/30m),Mode,Slide (m),Rotate (m),Toolface (deg),TF ref (MTF <3 deg inc / GTF high side),AC watch,AC level,Contingency,Tag',
 ...G.stands.map(s=>[s.stand,f(s.md0),f(s.md1),f(s.inc0,2),f(s.azi0,2),f(s.inc1,2),f(s.azi1,2),s.kind,f(s.dls,2),s.mode,f(s.slide),f(s.rot),s.tf==null?'':f(s.tf,0),s.tfRef,s.ac,s.acLvl,s.cont,s.tag].map(q).join(','))];return L.join('\n')+'\n'}
const asc=s=>String(s).replace(/°/g,' deg').replace(/[·•]/g,'-').replace(/[–—]/g,'-').replace(/≥/g,'>=').replace(/≤/g,'<=').replace(/[^\x20-\x7e]/g,'?');
export function toPDF(G){const lines=[`DD PROGRAM - ${G.name}   [SIM proposal: concept planning aid, not an approved directional program]`,G.em,'BHA: '+G.bha.name,'',
 'SURVEY PROGRAM',...G.survey.flatMap(s=>[`${s.section} ${s.hole}  ${f(s.md0,0)}-${f(s.md1,0)} m  max inc ${f(s.maxInc)}  max DLS ${f(s.maxDls,2)}  min SF ${f(s.minSF,2)||'-'}`,`   Tool: ${s.tool}`,`   Interval: ${s.interval}  (${s.stations} stations)  Extra: ${s.extra}`,`   QC: ${s.qc}`]),'',
 'DD INSTRUCTIONS PER SECTION',...G.dd.flatMap(s=>[`${s.section} ${s.hole}  ${f(s.md0,0)}-${f(s.md1,0)} m  objective: ${s.objective}  slide ${f(s.slideM,0)} m / rotate ${f(s.rotM,0)} m (${f(s.slidePct,0)}% slide)  TF: ${s.tfs||'-'}`,`   BHA: ${s.bha}`,`   AC watch: ${s.ac}`,`   Contingency: ${s.contingency}`]),'',
 'DD INSTRUCTIONS PER STAND','Std   MD from-to     Inc/Azi out     DLS  Mode             Slide  Rot   TF   AC',
 ...G.stands.flatMap(s=>{const a=`${String(s.stand).padEnd(4)} ${f(s.md0,0).padStart(5)}-${f(s.md1,0).padEnd(6)} ${f(s.inc1).padStart(5)}/${f(s.azi1).padEnd(6)}  ${f(s.dls,2).padStart(5)} ${s.mode.padEnd(16)} ${f(s.slide).padStart(5)} ${f(s.rot).padStart(5)} ${(s.tf==null?'-':f(s.tf,0)+(s.tfRef=='MTF'?'M':'G')).padStart(4)}  ${s.ac}`;return s.acLvl||/yield/.test(s.cont)?[a,'      '+s.cont]:[a]})].map(asc);
 const W=150,wr=[];for(const l of lines){let s=l;while(s.length>W){wr.push(s.slice(0,W));s='      '+s.slice(W)}wr.push(s)}
 const per=62,pages=[];for(let i=0;i<wr.length;i+=per)pages.push(wr.slice(i,i+per));const esc=s=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 const objs=[];const add=s=>{objs.push(s);return objs.length};const cat=add('<< /Type /Catalog /Pages 2 0 R >>'),pg=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');const kids=[];
 pages.forEach((P,i)=>{const body='BT /F1 7.5 Tf 9 TL 28 568 Td '+P.map(l=>`(${esc(l)}) '`).join(' ')+` ET BT /F1 7 Tf 28 18 Td (SIM - page ${i+1}/${pages.length}) Tj ET`;const c=add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${c} 0 R >>`))});
 objs[pg-1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;let out='%PDF-1.4\n';const off=[];objs.forEach((o,i)=>{off.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const x=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+off.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;return out}
// ---- UI (tab inside Well planning) ----
let G=null,W0=null;const chip='<span style="background:#8a8f98;color:#fff;border-radius:3px;padding:0 4px;font-size:10px">SIM</span>';
function dl(n,t,m){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:m}));a.download=n;document.body.appendChild(a);a.click();a.remove()}
async function offs(){try{const a=await WP.dbAll('offsets');if(a.length)return a}catch{}return AC.SIM_OFFSETS}
export async function compute(W){W=W||W0?.();if(!W?.L)return null;G=program(W,{offs:await offs(),M:window.GX?.wac?.A?.M||AC.MODEL});window.GX.ddp.G=G;return G}
const T='style="border-collapse:collapse;font-size:11px;white-space:nowrap" border=1 cellpadding=3';
function html(G){return `<div id=ddpBody><div style="margin:2px 0 6px">${chip} <b>DD program</b> · ${es(G.name)} · TD ${G.td.toFixed(0)} m · <i style="color:#fc6">concept planning aid, not an approved directional program</i><br><span style="color:#9ab;font-size:11px">${es(G.em)}</span><br>BHA (from builder): <b>${es(G.bha.name)}</b>
 <button id=ddpCsv>⬇ CSV</button> <button id=ddpPdf>⬇ PDF</button></div>
 <h4 style="margin:6px 0 2px">Survey program per section</h4><div style="overflow:auto"><table id=ddpSurvey ${T}><tr><th>Section</th><th>Hole</th><th>MD</th><th>Tool</th><th>Interval</th><th>Stations</th><th>Extra</th><th>Min SF</th></tr>${G.survey.map(s=>`<tr><td>${es(s.section)}</td><td>${s.hole}</td><td>${f(s.md0,0)}–${f(s.md1,0)}</td><td>${es(s.tool)}</td><td>${es(s.interval)}</td><td>${s.stations}</td><td style="white-space:normal;min-width:160px">${es(s.extra)}</td><td>${f(s.minSF,2)}</td></tr>`).join('')}</table></div>
 <h4 style="margin:6px 0 2px">DD instructions per section</h4><div style="overflow:auto"><table id=ddpSec ${T}><tr><th>Section</th><th>MD</th><th>Objective</th><th>Slide / rotate</th><th>TF (°)</th><th>AC watch</th><th>Contingency</th></tr>${G.dd.map(s=>`<tr><td>${es(s.section)} ${s.hole}</td><td>${f(s.md0,0)}–${f(s.md1,0)}</td><td>${es(s.objective)}</td><td>${f(s.slideM,0)} / ${f(s.rotM,0)} m (${f(s.slidePct,0)}%)</td><td>${s.tfs||'–'}</td><td style="white-space:normal;min-width:140px">${es(s.ac)}</td><td style="white-space:normal;min-width:220px">${es(s.contingency)}</td></tr>`).join('')}</table></div>
 <h4 style="margin:6px 0 2px">Per stand (${G.stands.length} × ${OPT.stand} m)</h4><div style="overflow:auto;max-height:46vh"><table id=ddpStands ${T}><tr><th>#</th><th>MD</th><th>Inc/Azi out</th><th>DLS</th><th>Mode</th><th>Slide</th><th>Rot</th><th>TF (°)</th><th>AC</th><th>Contingency</th></tr>${G.stands.map(s=>`<tr style="${s.acLvl=='STOP'?'background:#5a1d1d':s.acLvl=='ALERT'?'background:#5a4a1d':''}"><td>${s.stand}</td><td>${f(s.md0,0)}–${f(s.md1,0)}</td><td>${f(s.inc1)}/${f(s.azi1)}</td><td>${f(s.dls,2)}</td><td>${s.mode}</td><td>${f(s.slide)}</td><td>${f(s.rot)}</td><td>${s.tf==null?'–':f(s.tf,0)+' '+s.tfRef}</td><td>${es(s.acLvl?s.acLvl+' '+s.ac:'')}</td><td style="white-space:normal;min-width:240px">${es(s.cont)}</td></tr>`).join('')}</table></div></div>`}
export function register(W){W0=()=>W;W.tabs.push(['program','DD program']);
 W.ext.program=async B=>{B.innerHTML='Computing…';const g=await compute(W);if(!g){B.innerHTML='No plan';return}B.innerHTML=html(g);const nm=(g.name||'plan').replace(/\W+/g,'_');
  $('ddpCsv').onclick=()=>dl('dd_program_'+nm+'.csv',toCSV(g),'text/csv');$('ddpPdf').onclick=()=>dl('dd_program_'+nm+'.pdf',toPDF(g),'application/pdf')}}
// slide sheet hook: plan at a measured depth + the stand instruction covering it
if(typeof window!='undefined'){window.GX=window.GX||{};window.GX.ddp={OPT,planAt:md=>{const w=window.GX?.wplan;if(!w)return null;if(!w.W.L)w.calc(JSON.parse(JSON.stringify(WP.DEFAULT)));return planAt(w.W.L,md)},
 standAt:md=>{const g=window.GX.ddp.G;return g?g.stands.find(s=>md>=s.md0-1e-6&&md<s.md1+1e-6)||null:null},compute,program,toCSV,toPDF,sections,stands,surveyProgram,acScan}}
