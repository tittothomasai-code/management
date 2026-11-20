// Survey-averaged steering response, matched by drilled MD to recorded slide footage.
// No motor power, torque, maximum yield or live control is inferred from surveys.
const fin=Number.isFinite,R=Math.PI/180,D=180/Math.PI,EPS=1e-6;
export const wrap=a=>((a%360)+360)%360;
export const angle=a=>((a+180)%360+360)%360-180;
const number=v=>v===null||v===undefined||String(v).trim()===''?null:fin(Number(v))?Number(v):null;
export function surveyInterval(a,b){
 const length=b.md-a.md;if(![a.md,b.md,a.inc,b.inc,a.azi,b.azi].every(fin)||length<=.1||a.inc<0||b.inc<0||a.inc>180||b.inc>180)return null;
 const v=p=>[Math.sin(p.inc*R)*Math.cos(p.azi*R),Math.sin(p.inc*R)*Math.sin(p.azi*R),Math.cos(p.inc*R)],u=v(a),v2=v(b);
 const cross=[u[1]*v2[2]-u[2]*v2[1],u[2]*v2[0]-u[0]*v2[2],u[0]*v2[1]-u[1]*v2[0]],dogleg=Math.atan2(Math.hypot(...cross),u.reduce((s,x,i)=>s+x*v2[i],0))*D;
 return {fromMd:a.md,toMd:b.md,length,fromTime:a.t||null,toTime:b.t||null,fromInc:a.inc,toInc:b.inc,fromAzi:wrap(a.azi),toAzi:wrap(b.azi),dogleg,dls:dogleg*30/length,build:(b.inc-a.inc)*30/length,turn:Math.min(a.inc,b.inc)>=5?angle(b.azi-a.azi)*Math.sin((a.inc+b.inc)*R/2)*30/length:null};
}
const mode=v=>/^(slide|sliding|s)$/i.test(String(v||''))?'slide':/^(rotate|rotating|rotary|r)$/i.test(String(v||''))?'rotate':null;
export function workbookEvidence(doc){
 const records=[],issues=[];const runId=doc?.runSummary?.title&&doc?.sha256?'workbook:'+doc.sha256.slice(0,16):null;
 for(const row of doc?.joints||[]){
  if(row.drilled!==true)continue;const end=number(row.hd),len=number(row.length);if(end===null||len===null||len<=0){issues.push('Recorded joint lacks a measured MD span');continue;}
  const start=end-len;
  for(const k of [1,2]){const m=mode(row['mode'+k]),n=number(row['len'+k]);if(!m||n===null||n<=0)continue;let stop=number(row['hd'+k]);
   if(stop===null&&n===len&&!mode(row['mode'+(k===1?2:1)]))stop=end;
   if(stop===null||stop-n<start-.05||stop>end+.05){issues.push('Joint '+row.n+' has an unaligned recorded mode span');continue;}
   records.push({fromMd:Math.max(start,stop-n),toMd:Math.min(end,stop),mode:m,bhaId:runId,source:'Recorded run sheet · joint '+row.n,confidence:'recorded',priority:3,joint:row.n});
  }
 }
 const from=records.length?Math.min(...records.map(x=>x.fromMd)):null,to=records.length?Math.max(...records.map(x=>x.toMd)):null;
 return {records,issues:[...new Set(issues)],run:runId?{id:runId,startMd:from,endMd:to,source:'Recorded workbook run grouping; not a verified motor serial'}:null,surveys:(doc?.stations||[]).map((s,i)=>({md:s.md,inc:s.inc,azi:s.azi,uid:'workbook-'+i,type:'recorded'}))};
}
export function parseModeCsv(text){
 const lines=String(text||'').trim().split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return [];
 if(lines[0].trim()!=='fromMd,toMd,mode,bhaId')throw Error('Use CSV columns fromMd,toMd,mode,bhaId. Enter MD in metres.');
 if(lines.length>10001)throw Error('Use at most 10,000 recorded mode intervals.');
 return lines.slice(1).map((line,i)=>{const p=line.split(',').map(x=>x.trim()),fromMd=number(p[0]),toMd=number(p[1]),m=mode(p[2]);if(p.length!==4||fromMd===null||toMd===null||fromMd<0||toMd<=fromMd||!m||!p[3]||p[3].length>100)throw Error('Check recorded mode row '+(i+2)+'.');return {fromMd,toMd,mode:m,bhaId:p[3],source:'Operator-recorded interval · row '+(i+2),confidence:'recorded',priority:3};});
}
function unitValue(value,unit,kind){
 const n=number(value);if(n===null||n===-999.25)return null;const u=String(unit||'').toLowerCase().replace(/\s/g,'');
 if(kind==='depth')return /^(m|metres?|meters?)$/.test(u)?n:/^(ft|usft|ft_us)$/.test(u)?n*.3048:null;
 if(kind==='rpm')return /^(rpm|rev\/min|r\/min|1\/min)$/.test(u)?n:/^(rad\/s)$/.test(u)?n*60/(2*Math.PI):null;
 if(kind==='pressure')return /^(psi|lbf\/in2)$/.test(u)?n:/^kpa$/.test(u)?n*.1450377377:/^bar$/.test(u)?n*14.50377377:/^mpa$/.test(u)?n*145.0377377:null;
 if(kind==='flow')return /^(l\/min|lpm|litre\/min)$/.test(u)?n:/^(m3\/s|m\^3\/s)$/.test(u)?n*60000:/^(m3\/min|m\^3\/min)$/.test(u)?n*1000:/^(galus\/min|usgpm)$/.test(u)?n*3.785411784:null;
 return n;
}
export function telemetryEvidence(data,header={},options={}){
 const records=[],issues=[],ml=data?.ml||[],ul=data?.ul||[],rows=data?.rows||[],curves=header.curves||[];
 const find=re=>{const col=ml.findIndex((s,i)=>i>0&&re.test(s.replace(/\s/g,'')));if(col<0)return null;const c=curves.find(c=>c.mn?.toUpperCase()===ml[col].toUpperCase());return {col,unit:ul[col]||c?.unit||'',nil:c?.nullValue??header.nullValue};};
 const ch={mode:find(/^(DRILLING_MODE|DRILLMODE|SLIDE_ROTATE|STEERING_MODE)$/i),slide:find(/^(SLIDING|SLIDE_FLAG|IS_SLIDING)$/i),rpm:find(/^(RPMA|RPM|TDRPM|SRPM|RPM_SURF)$/i),flow:find(/^(FLOW|FLOW_?IN|MFIA|MFI|FLOWIN)$/i),spp:find(/^(SPP|SPPA|STPP|SPPRESS)$/i),hole:find(/^(HOLEDEP(TH)?|DMEA|HDTH|HOLE_?DEPTH)$/i),bit:find(/^(BDE|BDEP|BITDEP(TH)?|BIT_?DEPTH|DBTM)$/i),rop:find(/^(ROPA|ROP|ROPI|ROP_AVG)$/i),bha:find(/^(BHA_RUN_ID|MOTOR_RUN_ID)$/i)};
 const raw=(r,c)=>!c||String(r[c.col])===String(c.nil)||number(r[c.col])===-999.25?null:r[c.col];
 const value=(r,c,kind)=>unitValue(raw(r,c),c?.unit,kind);
 if(!rows.length)return {records,issues,channels:ch};
 const sensor=options.depthReference==='sensor';if(sensor&&(!fin(options.sensorOffsetM)||options.sensorOffsetM<0)){return {records,issues:['Confirm the sensor-to-bit offset before matching sensor-indexed telemetry.'],channels:ch};}
 if(header.time&&!ch.hole)return {records,issues:['The time log has no hole-MD channel; bit travel alone cannot establish new drilled footage.'],channels:ch};
 const depth=r=>{const md=header.time?value(r,ch.hole,'depth'):unitValue(r[0],header.indexUom||ul[0],'depth');return md===null?null:md+(sensor&&!header.time?options.sensorOffsetM:0);};
 const classify=r=>{
  const rpm=value(r,ch.rpm,'rpm'),flow=value(r,ch.flow,'flow'),spp=value(r,ch.spp,'pressure'),rop=number(raw(r,ch.rop));
  let direct=mode(raw(r,ch.mode));if(!direct&&ch.slide){const s=raw(r,ch.slide);if(s===true||s==='true'||s==='1'||s===1)direct='slide';else if(s===false||s==='false'||s==='0'||s===0)direct='rotate';}
  if(rop!==null&&rop<=0)return {mode:'unknown',reason:'No drilling advance rate'};
  const pumps=flow!==null?flow>20:spp!==null?spp>100:null;
  if(pumps===false)return {mode:'unknown',reason:'Pumps off'};
  if(direct){if(direct==='slide'&&rpm!==null&&rpm>=10)return {mode:'unknown',reason:'Recorded slide conflicts with surface rotation'};return {mode:direct,confidence:'recorded'};}
  if(pumps!==true||rpm===null)return {mode:'unknown',reason:'Missing pumping or RPM evidence'};
  return rpm<=1?{mode:'slide',confidence:'inferred'}:rpm>=10?{mode:'rotate',confidence:'inferred'}:{mode:'unknown',reason:'Low RPM is not confirmed sliding'};
 };
 let previous=null,maxHole=-Infinity;
 for(const row of rows){const md=depth(row);if(md===null||md<0){previous=null;continue;}const state=classify(row),bit=value(row,ch.bit,'depth');
  if(bit!==null&&Math.abs(bit-md)>.5){state.mode='unknown';state.reason='Bit is off bottom or depth references disagree';}
  const item={md,state,at:header.time?row[0]:null,bhaId:String(raw(row,ch.bha)||'')||null};
  if(previous&&md>maxHole+EPS){const from=Math.max(maxHole,previous.md),span=md-from,dt=item.at!==null&&previous.at!==null?(item.at-previous.at)/1000:null;
   const continuous=span>0&&span<=(options.maxSampleGapM??3)&&(!header.time||dt>0&&dt<=(options.maxSampleGapSeconds??60));
   const stable=previous.state.mode===state.mode&&state.mode!=='unknown'&&previous.bhaId===item.bhaId;
   const confidence=state.confidence==='recorded'&&previous.state.confidence==='recorded'?'recorded':'inferred';
   const m=continuous&&stable?state.mode:'unknown',reason=!continuous?'Sparse telemetry gap':!stable?'Mode transition or incomplete telemetry':null;
   if(span>0){const next={fromMd:from,toMd:md,mode:m,bhaId:item.bhaId,source:'WITSML '+(header.name||'drilling log'),confidence:m==='unknown'?'unknown':confidence,priority:confidence==='recorded'?2:1,reason};const tail=records.at(-1);if(tail&&Math.abs(tail.toMd-next.fromMd)<EPS&&['mode','bhaId','confidence','reason'].every(k=>tail[k]===next[k]))tail.toMd=next.toMd;else records.push(next);}
  }
  maxHole=Math.max(maxHole,md);previous=item;
 }
 return {records,issues,channels:ch};
}
function segments(records){
 const events=[];records.forEach((r,i)=>{if(fin(r.fromMd)&&fin(r.toMd)&&r.toMd>r.fromMd){events.push({md:r.fromMd,i,add:true},{md:r.toMd,i,add:false});}});events.sort((a,b)=>a.md-b.md);const active=new Set(),out=[];let at=null,k=0;
 while(k<events.length){const md=events[k].md;if(at!==null&&md>at&&active.size){const candidates=[...active].map(i=>records[i]),priority=Math.max(...candidates.map(x=>x.priority??3)),top=candidates.filter(x=>(x.priority??3)===priority),modes=new Set(top.map(x=>x.mode)),runs=new Set(top.map(x=>x.bhaId).filter(Boolean)),conflict=modes.size>1||runs.size>1;out.push({fromMd:at,toMd:md,mode:conflict?'unknown':top[0].mode,bhaId:runs.size===1?[...runs][0]:null,inferred:top.some(x=>x.confidence==='inferred'),reason:conflict?'Conflicting mode or BHA records':top[0].reason||null,sources:[...new Set(top.map(x=>x.source))]});}
  while(k<events.length&&events[k].md===md){events[k].add?active.add(events[k].i):active.delete(events[k].i);k++;}at=md;
 }return out;
}
export function analyzePerformance({surveys=[],records=[],run=null,baseline=null,maxSurveyGapM=90}={}){
 if(surveys.length>20000||records.length>100000)throw Error('The performance input exceeds its bounded analysis window.');
 const issues=[],points=[],badMd=[],byMd=new Map();for(const s of surveys){if(!s||!['md','inc','azi'].every(k=>fin(s[k]))||s.md<0||s.inc<0||s.inc>180||s.azi<0||s.azi>360||/plan|project|propos/i.test(s.type||'')||s.isPlan===true){if(s&&fin(s.md)&&!/plan|project|propos/i.test(s.type||'')&&s.isPlan!==true)badMd.push(s.md);issues.push('Invalid or projected surveys excluded');continue;}const p={...s,azi:wrap(s.azi)},old=byMd.get(p.md);if(old){if(Math.abs(old.inc-p.inc)>EPS||Math.abs(angle(old.azi-p.azi))>EPS)old.conflict=true;}else byMd.set(p.md,p);}
 points.push(...byMd.values());points.sort((a,b)=>a.md-b.md);const pieces=segments(records),intervals=[];let cursor=0;
 const validRun=run&&String(run.id||'').trim()&&fin(run.startMd)&&run.startMd>=0&&(run.endMd==null||fin(run.endMd)&&run.endMd>run.startMd);
 const validBaseline=baseline&&fin(baseline.build)&&fin(baseline.turn)&&String(baseline.source||'').trim();
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],row=surveyInterval(a,b);if(!row)continue;row.slideM=0;row.rotateM=0;row.unknownM=0;row.inferredM=0;row.evidence=[];row.issues=[];let edge=a.md;
  while(cursor<pieces.length&&pieces[cursor].toMd<=a.md+EPS)cursor++;
  for(let j=cursor;j<pieces.length&&pieces[j].fromMd<b.md-EPS;j++){const p=pieces[j],from=Math.max(a.md,p.fromMd),to=Math.min(b.md,p.toMd);if(to<=from)continue;if(from>edge)row.unknownM+=from-edge;const n=to-from;
   if(p.mode==='slide')row.slideM+=n;else if(p.mode==='rotate')row.rotateM+=n;else row.unknownM+=n;
   if(p.inferred)row.inferredM+=n;if(p.reason)row.issues.push(p.reason);if(validRun&&p.bhaId&&p.bhaId!==run.id)row.issues.push('BHA run mismatch');row.evidence.push({...p,fromMd:from,toMd:to});edge=to;
  }if(edge<b.md)row.unknownM+=b.md-edge;
  row.slideFraction=row.slideM/row.length;row.coverage=(row.slideM+row.rotateM)/row.length;row.slideDls=null;row.slideBuild=null;row.slideTurn=null;row.method='withheld';
  if(a.conflict||b.conflict||badMd.some(md=>md>=a.md&&md<=b.md))row.issues.push('Conflicting or invalid survey stations');if(row.length>maxSurveyGapM)row.issues.push('Sparse survey interval');
  if(!validRun||a.md<run.startMd-EPS||run.endMd!=null&&b.md>run.endMd+EPS)row.issues.push('No single assigned BHA run covers this interval');
  if(row.unknownM>EPS)row.issues.push('Incomplete mode coverage');if(row.inferredM>EPS)row.issues.push('Mode is inferred; confirm recorded slide intervals before motor attribution');
  const blocked=row.issues.some(x=>/Conflicting|Sparse|BHA|coverage|inferred/i.test(x));
  if(!blocked&&row.slideM>EPS){if(row.rotateM<EPS){row.slideDls=row.dls;row.slideBuild=row.build;row.slideTurn=row.turn;row.method='recorded-slide-only';}
   else if(validBaseline&&row.slideM>=1&&row.slideFraction>=.1&&row.turn!==null&&row.dogleg<=10){const f=row.slideFraction;row.slideBuild=(row.build-baseline.build*(1-f))/f;row.slideTurn=(row.turn-baseline.turn*(1-f))/f;row.slideDls=Math.hypot(row.slideBuild,row.slideTurn);row.method='baseline-adjusted-estimate';}
   else row.issues.push('Mixed mode needs a reviewed rotary baseline; small slide fractions and unreliable turn angles are withheld');
  }else if(row.slideM<=EPS)row.issues.push('No recorded sliding in this interval');row.issues=[...new Set(row.issues)];intervals.push(row);
 }
 const stats=method=>{const rows=intervals.filter(r=>r.method===method),metres=rows.reduce((n,r)=>n+r.slideM,0);return {count:rows.length,slideM:metres,dls:metres?rows.reduce((n,r)=>n+r.slideDls*r.slideM,0)/metres:null};};
 return {intervals,issues:[...new Set(issues)],run:validRun?run:null,slideOnly:stats('recorded-slide-only'),adjusted:stats('baseline-adjusted-estimate'),slideM:intervals.reduce((n,r)=>n+r.slideM,0),rotateM:intervals.reduce((n,r)=>n+r.rotateM,0),unknownM:intervals.reduce((n,r)=>n+r.unknownM,0),method:'Survey-averaged net steering response at the same drilled MD. Formation and toolface changes are not isolated. Not motor power or maximum capability.'};
}
