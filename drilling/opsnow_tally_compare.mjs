// Independent BHE results and measured pipe inventory stay separate.
const finite=Number.isFinite, norm=s=>String(s||'').toUpperCase().replace(/[\s_-]/g,'');
export function referenceScope(well,branch){return ['DR101L','DR0101L'].includes(norm(well))&&['WB04B01','DR101LWB04B01','DR0101LWB04B01'].includes(norm(branch));}
export function inventoryRows(reference){
 if(!reference||reference.unit!=='m'||!finite(reference.startMd)||!finite(reference.bhaLen)||reference.bhaLen<0||reference.startMd<reference.bhaLen||!reference.joints?.length)return [];
 let end=reference.startMd;const out=[];
 for(const j of reference.joints){if(!finite(j.n)||!finite(j.len)||j.len<=0)return [];const start=end;end+=j.len;out.push({...j,startMd:start,endMd:end});}return out;
}
export function compareDerivedTally(checks,reference,tolerance=.3){
 const inventory=inventoryRows(reference);if(!inventory.length)return {rows:[],inventory:[],error:'Measured reference is invalid'};
 const endpoints=[reference.startMd,...inventory.map(j=>j.endMd)],nearest=md=>{let at=-1,d=Infinity;endpoints.forEach((m,i)=>{if(Math.abs(m-md)<d){d=Math.abs(m-md);at=i;}});return d<=tolerance?at:-1;};
 let windowStart=null,derivedSum=0,previousEnd=null,continuous=true;
 const rows=[];
 for(const check of checks){
  if(check.startMd<reference.startMd-tolerance||check.endMd>inventory.at(-1).endMd+tolerance)continue;
  const a=nearest(check.startMd),b=nearest(check.endMd),group=a>=0&&b>a?inventory.slice(a,b):[];
  const measured=group.length?group.reduce((s,j)=>s+j.len,0):null;
  const derived=Object.hasOwn(check,'derivedLength')?check.derivedLength:check.estimatedLength;
  if(windowStart===null)windowStart=check.startMd;
  if(previousEnd!==null&&Math.abs(check.startMd-previousEnd)>.001)continuous=false;
  if(!finite(derived))continuous=false;
  if(continuous)derivedSum+=derived;
  const difference=finite(derived)&&finite(measured)?derived-measured:null;
  const label=group.length?(group.length===1?String(group[0].n):group[0].n+'–'+group.at(-1).n):'unaligned';
  const issues=(!finite(derived)?check.issues||['Incomplete BHE evidence']:[]).slice();
  if(!group.length)issues.push('Connection endpoints do not align to measured inventory');
  if(finite(difference)&&Math.abs(difference)>tolerance)issues.push('Derived length differs from measured inventory');
  const derivedEnd=continuous?windowStart+derivedSum:null,measuredEnd=group.at(-1)?.endMd??null;
  if(finite(derivedEnd)&&finite(measuredEnd)&&Math.abs(derivedEnd-measuredEnd)>tolerance)issues.push('Cumulative depth differs from measured inventory');
  rows.push({entries:label,startMd:check.startMd,endMd:check.endMd,derivedLength:finite(derived)?derived:null,measuredLength:measured,difference,
   derivedEndMd:derivedEnd,measuredEndMd:measuredEnd,cumulativeDifference:finite(derivedEnd)&&finite(measuredEnd)?derivedEnd-measuredEnd:null,
   status:issues.length?'review':'match',issues});previousEnd=check.endMd;
 }
 return {rows,inventory,bhaLen:reference.bhaLen,startMd:reference.startMd,carriedReference:reference.startMd-reference.bhaLen,windowStart,
  fullStart:windowStart!==null&&Math.abs(windowStart-reference.startMd)<=tolerance,matched:rows.filter(r=>r.status==='match').length,review:rows.filter(r=>r.status==='review').length};
}
export function comparisonCsv(result){
 const fields=['entries','startMd','endMd','derivedLength','measuredLength','difference','derivedEndMd','measuredEndMd','cumulativeDifference','status','issues'];
 const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';return [fields.join(','),...result.rows.map(r=>fields.map(k=>q(Array.isArray(r[k])?r[k].join('; '):r[k])).join(','))].join('\r\n');
}
export function renderTallyComparison(doc,host,result,reference,context){
 const fmt=n=>finite(n)?n.toFixed(2)+' m':'—';host.replaceChildren();host.style.cssText='margin:12px 0;padding:12px;border:1px solid #314653;border-radius:10px;min-width:0';
 const add=(tag,text,parent=host)=>{const e=doc.createElement(tag);e.textContent=text;parent.append(e);return e;};
 add('h3','Derived vs measured tally');
 add('p','BHA '+fmt(result.bhaLen)+' + carried string reference '+fmt(result.carriedReference)+' = starting MD '+fmt(result.startMd)+'. The start MD already includes the BHA.');
 add('p',reference.source+' · '+result.inventory.length+' inventory entries. Blank drilling details do not mean unused pipe.');
 add('p',result.rows.length?result.matched+' matched cycles · '+result.review+' need review · '+(result.fullStart?'coverage starts at the run reference.':'partial log window; earlier derived lengths remain unverified.'):'Awaiting complete independent BHE cycles for this run. Measured lengths have not been copied into the derived column.');
 if(result.windowStart!==null)add('small','Derived cumulative MD = observed window start '+fmt(result.windowStart)+' + independent BHE lengths. Missing cycles leave cumulative results blank. Comparison tolerance 0.30 m.');
 const table=(headers,body,parent)=>{const scroll=add('div','',parent);scroll.style.overflowX='auto';const t=add('table','',scroll);t.className='on-table';const h=add('tr','',add('thead','',t));headers.forEach(x=>add('th',x,h));const b=add('tbody','',t);body.forEach(row=>{const tr=add('tr','',b);row.forEach(x=>add('td',x,tr));});};
 table(['Measured entry','MD interval','Derived BHE','Measured length','Δ length','Derived end MD','Measured end MD','Δ cumulative','Result'],result.rows.slice(-30).map(r=>[r.entries,fmt(r.startMd)+' → '+fmt(r.endMd),fmt(r.derivedLength),fmt(r.measuredLength),fmt(r.difference),fmt(r.derivedEndMd),fmt(r.measuredEndMd),fmt(r.cumulativeDifference),r.status+(r.issues.length?': '+r.issues.join('; '):'')]),host);
 const button=add('button','Export derived vs measured CSV');button.type='button';button.onclick=()=>{const url=URL.createObjectURL(new Blob([comparisonCsv(result)],{type:'text/csv'})),a=doc.createElement('a');a.href=url;a.download='derived-vs-measured-tally.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const detail=add('details','');add('summary','Measured inventory · '+result.inventory.length+' entries',detail);
 // This is depth coverage only; off-bottom bit and hole MD remain distinct.
 const md=finite(context.bitMd)?context.bitMd:context.holeMd,at=result.inventory.find(j=>j.endMd>=md&&j.startMd<=md);
 if(finite(md))add('p',(finite(context.bitMd)?'Bit MD ('+context.bitKind+')':'Hole MD reference; bit depth unavailable')+' '+fmt(md)+(at?' · covers entry '+at.n+' · '+fmt(at.endMd-md)+' of depth advance to its endpoint.':'. Outside this inventory segment.'),detail);
 table(['Entry','Measured length','Top MD','Endpoint MD'],result.inventory.map(j=>[j.n,fmt(j.len),fmt(j.startMd),fmt(j.endMd)]),detail);
}
