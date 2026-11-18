// BHE is a position. Connection MD spacing is drilled distance, not BHE stroke
// or a measured pipe length. Complete correlated strokes support derived lengths;
// physical measurements from an imported tally always keep their provenance.
const finite=Number.isFinite;
export function blockUnitFactor(unit){return {m:1,metre:1,meter:1,ft:.3048,feet:.3048,usft:.3048,ft_us:.3048,cm:.01,mm:.001}[(unit||'').trim().toLowerCase()]??null;}
function blockValue(row,ch){const raw=row?.[ch.col];if(raw==null||raw==='')return null;const n=Number(raw);return !finite(n)||n===-999.25||(ch.nullValue!==''&&ch.nullValue!=null&&n===Number(ch.nullValue))?null:n;}
export function connectionRows(rows,map){
 const ch=map.bh,f=ch&&blockUnitFactor(ch.unit);if(f==null)return null;
 if(f===1)return {rows,map};
 return {rows:rows.map(row=>{const out=row.slice(),n=blockValue(row,ch);out[ch.col]=n===null?null:n*f;return out;}),map:{...map,bh:{...ch,unit:'m',nullValue:''}}};
}
export function jointMetrics({summary,rows,blockChannel,tally,jointNumber,nominal=13}){
 const joint=jointNumber?.kind==='tally'?tally?.joints?.find(j=>j.n===jointNumber.n):null;
 const trusted=joint?.source==='bhe-derived'||!(/derived|nominal/.test(joint?.source||''));
 const valid=trusted&&finite(joint?.len)&&joint.len>0,length=valid?joint.len:nominal,basis=valid?(joint.source==='bhe-derived'?'derived':'tally'):'nominal';
 const f=blockChannel&&blockUnitFactor(blockChannel.unit),start=summary.current?.start;
 let low=Infinity,high=-Infinity,count=0;
 if(f!=null&&finite(start))for(const row of rows){if(row[0]<start)continue;const raw=blockValue(row,blockChannel);if(raw===null)continue;low=Math.min(low,raw*f);high=Math.max(high,raw*f);count++;}
 return {length,basis,spacing:summary.median,travel:count>=2?high-low:null,drilled:summary.current?.drilled??null,
   overdue:finite(summary.current?.drilled)&&summary.current.drilled>length+.5};
}

export function reconcileDepths({holeMd,bit,tolerance=.3}){
 const issues=[];let bitMd=finite(bit?.v)?bit.v:null;
 if(bit?.clamped){issues.push('Reported bit depth exceeds hole depth');bitMd=null;}
 if(bitMd!==null&&(bitMd<0||(finite(holeMd)&&bitMd>holeMd+tolerance))){issues.push('Bit depth is outside the drilled hole');bitMd=null;}
 if(bitMd===null)issues.push('Bit depth unavailable; tally in-hole count is unconfirmed');
 return {holeMd:finite(holeMd)?holeMd:null,bitMd,basis:bitMd===null?'unavailable':bit.kind,issues};
}

export function depthMetres(value,channel){const factor=channel&&blockUnitFactor(channel.unit);return finite(value)&&factor!=null?value*factor:null;}

export function derivePipeChecks({rows,map,conns,tally,tolerance=.3,nominal=13}){
 const out=[],bh=map.bh,bf=bh&&blockUnitFactor(bh.unit),bd=map.bd,df=bd&&blockUnitFactor(bd.unit);let cursor=0;
 for(let i=0;i<conns.length-1;i++){
  const a=conns[i],b=conns[i+1],advance=b.md-a.md,travel=finite(a.blockTop)&&finite(b.blockBottom)?a.blockTop-b.blockBottom:null;
  let previous=null,firstMd=null,lastMd=null,pairs=0,badPairs=0,offBottom=false,count=0,bitCount=0;
  while(cursor<rows.length&&rows[cursor][0]<a.md)cursor++;
  for(;cursor<rows.length&&rows[cursor][0]<b.md;cursor++){
   const row=rows[cursor],height=bf===null||bf===undefined?null:blockValue(row,bh),bit=df==null?null:blockValue(row,bd);count++;
   if(bit!==null){bitCount++;if(Math.abs(bit*df-row[0])>tolerance)offBottom=true;}
   if(height!==null&&previous){const md=row[0]-previous.md,drop=previous.height-height*bf;if(md>0){if(drop>0&&Math.abs(md-drop)<=tolerance)pairs++;else badPairs++;}}
   if(height!==null){firstMd??=row[0];lastMd=row[0];previous={md:row[0],height:height*bf};}
  }
  const issues=[];
  if(!finite(advance)||advance<=0)issues.push('No positive MD advance');
  if(!finite(travel)||travel<=0)issues.push('No complete positive BHE stroke');
  if(finite(travel)&&Math.abs(advance-travel)>tolerance)issues.push('MD/BHE disagreement '+Math.abs(advance-travel).toFixed(2)+' m');
  if(count<3||pairs<2||firstMd===null||lastMd===null||firstMd-a.md>tolerance||b.md-lastMd>tolerance)issues.push('Insufficient correlated drilling samples');
  if(badPairs)issues.push('Pickup, reaming or inconsistent movement');
  if(offBottom)issues.push('Bit not on bottom or depth readings disagree');
  if(advance>nominal*1.6||travel>nominal*1.6)issues.push('Possible multiple joints or missed connection');
  // Retain the independent result before checking any measured-tally values.
  // A disagreement must not erase it or turn the measured value into the derivation.
  const derivedLength=issues.length?null:travel;
  const next=tally?.joints?.find((j,k)=>Math.abs((k?tally.joints[k-1].cumDepth:(tally.startMd??tally.bhaLen))-a.md)<=tolerance);
  if(next&&finite(travel)&&Math.abs(next.len-travel)>tolerance)issues.push('Tally length disagrees with BHE stroke');
  if(next&&Math.abs(next.cumDepth-b.md)>tolerance)issues.push('Tally cumulative depth disagrees with connection');
  const estimate=issues.length?null:travel;
  out.push({key:a.md.toFixed(3)+':'+b.md.toFixed(3),startMd:a.md,endMd:b.md,mdAdvance:advance,bheTravel:travel,derivedLength,estimatedLength:estimate,
   joint:next?.n??null,tallyLength:next?.len??null,status:issues.length?'review':next?'tally match':'derived estimate',bitBasis:bitCount?'reported':'not reported',issues});
 }
 return out;
}

// Keep depth endpoints and manual/imported measurements intact. Only completed,
// correlated strokes supply derived lengths; unverified MD intervals stay flagged.
export function applyPipeChecks(runs,checks){
 const byKey=new Map(checks.map(c=>[c.key,c]));
 return runs.map(run=>{let cum=0;return {...run,joints:run.joints.map(j=>{
  const check=finite(j.start)&&finite(j.hd)?byKey.get(j.start.toFixed(3)+':'+j.hd.toFixed(3)):null;
  const length=!j.overridden&&!j.current&&finite(check?.estimatedLength)?check.estimatedLength:j.len;
  if(finite(length))cum+=length;
  return {...j,len:length,cum,pipeCheck:check,source:!j.overridden&&!j.current&&finite(check?.estimatedLength)?'bhe-derived':j.source};
 })};});
}

export function renderPipeChecks(doc,checks,depth,target){
 let panel=doc.getElementById('onPipeChecks');if(!panel){panel=doc.createElement('details');panel.id='onPipeChecks';panel.style.cssText='margin-top:10px;font-size:12px;overflow:auto';const summary=doc.createElement('summary');summary.style.cursor='pointer';panel.append(summary);const note=doc.createElement('p');note.dataset.depthCheck='';panel.append(note);const table=doc.createElement('table');table.className='on-table';table.innerHTML='<thead><tr><th>MD interval</th><th>MD advance</th><th>BHE travel</th><th>Pipe estimate</th><th>Tally</th><th>Check</th></tr></thead><tbody></tbody>';panel.append(table);const button=doc.createElement('button');button.type='button';button.textContent='Export pipe-length checks';panel.append(button);target.append(panel);}
 const review=checks.filter(c=>c.status==='review').length;panel.querySelector('summary').textContent='Pipe-length / tally checks · '+checks.length+' cycles'+(review?' · '+review+' need review':'');
 panel.querySelector('[data-depth-check]').textContent=(depth.issues.join('. ')||'Bit depth is within hole depth ('+depth.basis+').')+' Complete BHE strokes are derived estimates (0.30 m comparison tolerance); pickups and incomplete cycles need review. Depth logs cannot prove the timing of off-bottom activity.';
 const body=panel.querySelector('tbody');body.replaceChildren();const fmt=n=>finite(n)?n.toFixed(2)+' m':'—';
 for(const c of checks.slice(-20).reverse()){const tr=doc.createElement('tr');for(const value of [c.startMd.toFixed(2)+'–'+c.endMd.toFixed(2),fmt(c.mdAdvance),fmt(c.bheTravel),fmt(c.estimatedLength),fmt(c.tallyLength),c.status+(c.issues.length?': '+c.issues.join('; '):'')]){const td=doc.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);}
 panel.querySelector('button').onclick=()=>{const fields=['startMd','endMd','mdAdvance','bheTravel','estimatedLength','joint','tallyLength','status','bitBasis','issues'];const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[fields.join(','),...checks.map(c=>fields.map(k=>quote(Array.isArray(c[k])?c[k].join('; '):c[k])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=doc.createElement('a');a.href=url;a.download='pipe-length-checks.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
