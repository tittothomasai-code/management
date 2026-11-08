// Deterministic, read-only well summary from the selected WITSML time log.
// Every value is derived from source samples. Missing channels remain unavailable.
import * as C from './rtoc_core.js?v=r1';

const finite = xs => xs.filter(Number.isFinite);
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const maxOf = xs => xs.length ? Math.max(...xs) : null;
const minOf = xs => xs.length ? Math.min(...xs) : null;
const one = (n,d=1) => Number.isFinite(n) ? n.toFixed(d) : null;
const stamp = t => Number.isFinite(t) ? new Date(t*1000).toISOString().replace('T',' ').slice(0,16)+' UTC' : null;
const metres = ft => Number.isFinite(ft) ? C.m(ft) : null;

function maxDls(surveys) {
  const R=Math.PI/180, out=[];
  for(let i=1;i<(surveys||[]).length;i++){
    const a=surveys[i-1],b=surveys[i],dm=b[0]-a[0];
    if(!(dm>0)||![a[1],a[2],b[1],b[2]].every(Number.isFinite)) continue;
    const i1=a[1]*R,i2=b[1]*R,a1=a[2]*R,a2=b[2]*R;
    const c=Math.max(-1,Math.min(1,Math.cos(i2-i1)-Math.sin(i1)*Math.sin(i2)*(1-Math.cos(a2-a1))));
    const dog=Math.acos(c)*180/Math.PI;
    out.push({dls:dog*98.42519685/dm,md:b[0]});
  }
  return out.reduce((best,x)=>!best||x.dls>best.dls?x:best,null);
}

export function build(D) {
  const rows=Array.isArray(D?.samples)?D.samples:[];
  const ss=Array.isArray(D?.surveys)?D.surveys:[];
  const times=finite(rows.map(x=>x.t));
  const md=finite(rows.map(x=>x.md));
  const rop=finite(rows.map(x=>x.rop)).filter(x=>x>0);
  const wob=finite(rows.map(x=>x.wob));
  const tq=finite(rows.map(x=>x.tq));
  const spp=finite(rows.map(x=>x.spp));
  const qs=finite(rows.map(x=>x.q));
  const incl=finite(ss.map(x=>x[1]));
  const joints=C.segment(rows);
  const completed=joints.filter(j=>!j.open&&!j.partial);
  const lengths=completed.map(j=>metres(j.endMd-j.startMd)).filter(Number.isFinite);
  const dls=maxDls(ss);
  const firstMd=minOf(md),lastMd=maxOf(md),firstT=minOf(times),lastT=maxOf(times);
  const keys=['rop','wob','tq','rpm','spp','q','bd'];
  const channelCount=keys.filter(k=>rows.some(r=>Number.isFinite(r[k]))).length;
  const unavailable=label=>'No matching channel or source values in the selected time log.';
  const fact=(label,value,detail)=>({label,value:value||'Not available',detail:detail||(value? 'Derived from the selected WITSML source.':unavailable(label))});
  const facts=[
    fact('Measured-depth span',Number.isFinite(firstMd)&&Number.isFinite(lastMd)?one(metres(lastMd-firstMd))+' m':null,'From the time-log hole-depth samples; this is the recorded interval, not a survey-derived stand length.'),
    fact('Logged depth range',Number.isFinite(firstMd)&&Number.isFinite(lastMd)?one(metres(firstMd))+'–'+one(metres(lastMd))+' m MD':null,'Minimum and maximum measured depth in the selected time log.'),
    fact('Time-log coverage',Number.isFinite(firstT)&&Number.isFinite(lastT)?one((lastT-firstT)/3600,1)+' h':null,Number.isFinite(firstT)&&Number.isFinite(lastT)?stamp(firstT)+' to '+stamp(lastT):unavailable('Time-log coverage')),
    fact('Peak recorded ROP',maxOf(rop)!=null?one(maxOf(rop)*C.FT)+' m/h':null,rop.length?'Maximum positive ROP sample in the selected time log.':unavailable('ROP')),
    fact('Average positive ROP',mean(rop)!=null?one(mean(rop)*C.FT)+' m/h':null,rop.length?'Arithmetic mean of positive ROP samples; it is sample-weighted, not time-weighted.':unavailable('ROP')),
    fact('Peak recorded WOB',maxOf(wob)!=null?one(maxOf(wob)*C.KLBF_KN)+' kN':null,wob.length?'Maximum WOB sample in the selected time log.':unavailable('WOB')),
    fact('Peak recorded torque',maxOf(tq)!=null?one(maxOf(tq)*C.FTLBF_KNM)+' kN·m':null,tq.length?'Maximum surface torque sample in the selected time log.':unavailable('Torque')),
    fact('Peak standpipe pressure',maxOf(spp)!=null?one(maxOf(spp)*C.PSI_KPA)+' kPa':null,spp.length?'Maximum standpipe-pressure sample in the selected time log.':unavailable('Standpipe pressure')),
    fact('Connection intervals',D?.evidence?String(completed.length)+' complete intervals'+(lengths.length?' · mean '+one(mean(lengths))+' m':'' ):null,D?.evidence?'Derived from bit depth, hole depth and flow evidence. Check the source-quality notes before operational use.':(D?.why||unavailable('Connection evidence'))),
    fact('Peak survey DLS',dls?one(dls.dls,2)+'°/30 m':null,dls?'Calculated between adjacent definitive survey stations from minimum-curvature dogleg angle; derived from WITSML survey values.':unavailable('Survey DLS')),
  ];
  const factsText=facts.map((x,i)=>(i+1)+'. '+x.label+': '+x.value+' — '+x.detail).join('\n');
  const stats=[
    {label:'Recorded interval',value:Number.isFinite(firstMd)&&Number.isFinite(lastMd)?one(metres(firstMd))+'–'+one(metres(lastMd))+' m MD':'Not available'},
    {label:'Time-log rows',value:String(rows.length)},
    {label:'Time covered',value:Number.isFinite(firstT)&&Number.isFinite(lastT)?one((lastT-firstT)/3600,1)+' h':'Not available'},
    {label:'Complete connection intervals',value:D?.evidence?String(completed.length):'Not available'},
    {label:'Survey stations',value:String(ss.length)},
    {label:'Maximum inclination',value:incl.length?one(maxOf(incl),1)+'°':'Not available'},
    {label:'Peak survey DLS',value:dls?one(dls.dls,2)+'°/30 m':'Not available'},
    {label:'Channels present',value:String(channelCount)+' / '+String(keys.length)},
  ];
  const quality=[...(D?.gaps||[])];
  if(!D?.evidence&&D?.why&&!quality.includes(D.why))quality.push(D.why);
  if(D?.logs?.some(x=>x.status!=='complete'))quality.push('One or more log reads did not complete; summary uses returned rows only.');
  if(D?.logs?.some(x=>(x.gaps||[]).length))quality.push('Time-log quality check found one or more large sampling gaps.');
  if(!quality.length)quality.push('No source-quality warnings were reported by the reader.');
  return {
    wellName:D?.wellName||D?.well||'Selected well',
    wellboreName:D?.wbName||D?.wb||'Selected wellbore',
    current:!!D?.current,
    source:D?.source||'WITSML',
    facts,stats,quality,
    copyText:(D?.wellName||D?.well||'Selected well')+' · '+(D?.wbName||D?.wb||'wellbore')+' · '+(D?.current?'CURRENT SNAPSHOT':'HISTORICAL WITSML SUMMARY')+'\n\nWELL STATS\n'+stats.map(x=>x.label+': '+x.value).join('\n')+'\n\n10 SOURCE-DERIVED FACTS\n'+factsText+'\n\nSOURCE QUALITY\n'+quality.map(x=>'• '+x).join('\n')
  };
}
