// BHE is a position. Connection MD spacing is drilled distance, not BHE stroke
// or a measured pipe length. Only a loaded tally supplies an actual joint length.
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
 const valid=finite(joint?.len)&&joint.len>0,length=valid?joint.len:nominal,basis=valid?'tally':'nominal';
 const f=blockChannel&&blockUnitFactor(blockChannel.unit),start=summary.current?.start;
 let low=Infinity,high=-Infinity,count=0;
 if(f!=null&&finite(start))for(const row of rows){if(row[0]<start)continue;const raw=blockValue(row,blockChannel);if(raw===null)continue;low=Math.min(low,raw*f);high=Math.max(high,raw*f);count++;}
 return {length,basis,spacing:summary.median,travel:count>=2?high-low:null,drilled:summary.current?.drilled??null,
   overdue:finite(summary.current?.drilled)&&summary.current.drilled>length+.5};
}
