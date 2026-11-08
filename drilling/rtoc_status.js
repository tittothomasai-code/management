// rtoc_status.js — honest status models for right column. No green/OK without a supporting channel.
/** Anti-collision polar look-ahead. offsets absent -> ownOnly, sf null, message explicit; never "safe". */
export function antiCollision(o={}){const off=(o.offsets||[]).filter(x=>x&&Array.isArray(x.pts)&&x.pts.length);
 const sf=Number.isFinite(o.minSF)&&off.length?o.minSF:null;
 return {rings:[100,200,300],own:true,offsets:off.map(x=>({name:x.name,pts:x.pts,unc:x.unc??null})),
  minSF:sf,offsetName:sf!=null?(o.minSFOffset||off[0].name):null,
  badge:!off.length?{text:'OFFSET DATA UNAVAILABLE',tone:'muted'}:sf==null?{text:'SF NOT COMPUTED',tone:'muted'}:sf<1?{text:'STOP',tone:'bad'}:sf<1.5?{text:'WATCH',tone:'warn'}:{text:'SF '+sf.toFixed(2),tone:'info'},
  note:!off.length?'Own well only — offset wells not supplied. Clearance not assessed.':null}}
/** Well control rows: status only from supplied channels; absent -> 'n/a' (grey), never ok. */
export function wellControl(ch={}){const row=(name,series,fn)=>{if(!Array.isArray(series)||series.length<2)return {name,state:'na',spark:null,label:'no data'};const r=fn(series);return {name,spark:series,state:r.state,label:r.label}};
 const fb=(ch.flowIn&&ch.flowOut)?ch.flowIn.map((v,i)=>v-(ch.flowOut[i]??NaN)).filter(Number.isFinite):null;
 return [row('Flow balance',fb,s=>{const d=s.at(-1);return Math.abs(d)>ch.flowTol?{state:'warn',label:(d>0?'+':'')+d.toFixed(0)+' L/min'}:{state:Number.isFinite(ch.flowTol)?'ok':'info',label:d.toFixed(0)+' L/min'}}),
  row('Pit volume',ch.pit,s=>{const d=s.at(-1)-s[0];return {state:Number.isFinite(ch.pitTol)?(Math.abs(d)>ch.pitTol?'warn':'ok'):'info',label:(d>=0?'+':'')+d.toFixed(1)+' m³'}}),
  row('Gas trend',ch.gas,s=>({state:'info',label:s.at(-1).toFixed(1)+' %'}))]}
/** Early alerts from recorded events only. */
export function alerts(evts=[]){if(!evts.length)return [{state:'na',title:'No recorded alerts',sub:'Event source: recorded only'}];return evts.slice(-4).reverse().map(e=>({state:e.sev||'info',title:e.title,sub:e.sub||''}))}
