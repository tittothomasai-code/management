// Measured hardpoints are local, scoped operational records. Sensor rows stay read-only.
import {inventoryRows} from './opsnow_tally_compare.mjs?v=opsref1118';
export const STORAGE_KEY='opsnow-hardpoints:v1';
const finite=Number.isFinite,DAY=86400000,AEST=36000000;
export const scopeKey=s=>[s?.well,s?.wellbore,s?.run].every(x=>typeof x==='string'&&x.length>0&&x.length<=300)?JSON.stringify([s.well,s.wellbore,s.run]):null;
export function aestInput(at=Date.now()){return new Date(at+AEST).toISOString().slice(0,16);}
export function midnightInput(now=Date.now()){return aestInput(now).slice(0,10)+'T00:00';}
export function parseAest(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||''))throw Error('Enter a valid date and time in AEST.');
 const at=Date.parse(value+':00+10:00');if(!finite(at)||aestInput(at)!==value)throw Error('Enter a valid AEST calendar date.');return at;
}
export function activePoints(events,scope,now=Date.now()){
 const key=scopeKey(scope);if(!key)return [];
 const own=events.filter(e=>scopeKey(e.scope)===key),removed=new Set(own.flatMap(e=>[e.target,e.supersedes].filter(Boolean)));
 return own.filter(e=>e.action==='set'&&!removed.has(e.id)&&Date.parse(e.effectiveAt)<=now).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||Date.parse(a.recordedAt)-Date.parse(b.recordedAt));
}
export function dailyStatus(events,scope,now=Date.now()){
 const midnight=midnightInput(now),point=activePoints(events,scope,now).find(p=>aestInput(Date.parse(p.effectiveAt))===midnight);
 return {due:!point,midnight,point:point||null};
}
export function validateEvent(e,reference,now=Date.now()){
 if(!e||!['set','void'].includes(e.action)||!scopeKey(e.scope)||typeof e.id!=='string'||!e.id||e.id.length>100)throw Error('Invalid hardpoint record.');
 if(!finite(Date.parse(e.recordedAt))||Date.parse(e.recordedAt)>now+60000)throw Error('Invalid recorded time.');
 if(typeof e.operator!=='string'||!e.operator.trim()||e.operator.length>100)throw Error('Enter who measured or confirmed this hardpoint.');
 if(typeof e.source!=='string'||!e.source.trim()||e.source.length>500)throw Error('Enter the measured source or reason.');
 if(e.action==='void'){if(typeof e.target!=='string'||!e.target)throw Error('Choose the hardpoint to retract.');return e;}
 if(!finite(Date.parse(e.effectiveAt))||Date.parse(e.effectiveAt)>now)throw Error('A measured hardpoint cannot be in the future.');
 if(!Number.isInteger(e.joint)||e.joint<1||!finite(e.md)||!finite(e.bhaLen)||e.bhaLen<0||e.md<e.bhaLen)throw Error('Enter a measured joint, MD and BHA length in metres.');
 if(!['joint-end','within-joint'].includes(e.position))throw Error('Choose the measured position within the joint.');
 const j=inventoryRows(reference).find(j=>j.n===e.joint);if(!j)throw Error('The joint is outside this measured inventory.');
 if(e.position==='within-joint'&&(!finite(e.advance)||e.advance<0||e.advance>j.len))throw Error('Advance must be between zero and the measured joint length.');
 return e;
}
export function appendEvent(events,event,reference,now=Date.now()){
 validateEvent(event,reference,now);const prior=events.find(e=>e.id===event.id);
 if(prior){if(JSON.stringify(prior)!==JSON.stringify(event))throw Error('Conflicting hardpoint ID; history was not changed.');return events;}
 for(const target of [event.target,event.supersedes].filter(Boolean))if(!events.some(e=>e.id===target&&e.action==='set'&&scopeKey(e.scope)===scopeKey(event.scope)))throw Error('The referenced hardpoint belongs to another scope or is missing.');
 return [...events,event];
}
export function createPoint(input,scope,reference,events,now=Date.now()){
 const effective=parseAest(input.aest),old=activePoints(events,scope,now).find(p=>Date.parse(p.effectiveAt)===effective);
 const entry=inventoryRows(reference).find(j=>j.n===Number(input.joint)),expected=entry?(input.position==='joint-end'?entry.endMd:entry.startMd+Number(input.advance)):null;
 const e={id:crypto.randomUUID(),action:'set',scope:{...scope},effectiveAt:new Date(effective).toISOString(),recordedAt:new Date(now).toISOString(),joint:Number(input.joint),md:Number(input.md),bhaLen:Number(input.bhaLen),position:input.position,advance:input.position==='within-joint'?Number(input.advance):null,operator:String(input.operator||'').trim(),source:String(input.source||'').trim(),supersedes:old?.id||null,
 correction:{referenceSha256:reference?.sourceSha256||null,referenceStartMd:reference?.startMd??null,referenceBhaLen:reference?.bhaLen??null,expectedMdAtPoint:expected,offsetM:expected===null?null:Number(input.md)-expected}};
 if([input.joint,input.md,input.bhaLen,...(input.position==='within-joint'?[input.advance]:[])].some(x=>x==null||String(x).trim()===''))throw Error('Fill in every measured value. Blank values cannot become zero.');
 validateEvent(e,reference,now);return e;
}
export function anchorReference(reference,point){
 if(!reference||!point)return reference;
 const entry=inventoryRows(reference).find(j=>j.n===point.joint);if(!entry)return reference;
 const expected=point.position==='joint-end'?entry.endMd:entry.startMd+point.advance,offset=point.md-expected;
 return {...reference,uncorrectedReference:reference,startMd:reference.startMd+offset,bhaLen:point.bhaLen,baseCarriedReference:reference.startMd-reference.bhaLen,
  checkpoint:point,checkpointOffset:offset,checkpointDatum:offset-(point.bhaLen-reference.bhaLen),issues:[...(reference.issues||[]),...(Math.abs(point.bhaLen-reference.bhaLen)>.01?['Hardpoint BHA differs from the measured sheet; review the assembly and run ID.']:[])]};
}
let cachedRaw,cachedEvents=[];
export function readEvents(storage=globalThis.localStorage){
 const raw=storage.getItem(STORAGE_KEY)||'[]';if(raw===cachedRaw)return cachedEvents;
 let parsed;try{parsed=JSON.parse(raw);}catch{throw Error('Hardpoint history cannot be read. Export or recover the saved record before changing it.');}
 if(!Array.isArray(parsed))throw Error('Invalid saved hardpoint history.');cachedRaw=raw;cachedEvents=parsed;return parsed;
}
export function writeEvent(event,reference,storage=globalThis.localStorage,now=Date.now()){
 const next=appendEvent(readEvents(storage),event,reference,now);storage.setItem(STORAGE_KEY,JSON.stringify(next));cachedRaw=undefined;return next;
}
export function importHistory(payload,scope,reference,storage=globalThis.localStorage,now=Date.now()){
 if(payload?.schema!=='robotyx-hardpoints/1'||scopeKey(payload.scope)!==scopeKey(scope)||!Array.isArray(payload.events)||payload.events.length>5000)throw Error('Choose a hardpoint export for this exact well, wellbore and run.');
 let next=readEvents(storage);for(const e of payload.events){if(scopeKey(e.scope)!==scopeKey(scope))throw Error('Imported records belong to another well or run.');next=appendEvent(next,e,reference,now);}
 storage.setItem(STORAGE_KEY,JSON.stringify(next));cachedRaw=undefined;return next;
}
export function checkpointState(scope,reference,now=Date.now(),storage=globalThis.localStorage){
 try{const events=readEvents(storage),points=activePoints(events,scope,now),point=points.at(-1)||null;return {scope,events,points,point,reference:anchorReference(reference,point),daily:dailyStatus(events,scope,now),error:''};}
 catch(e){return {scope,events:[],points:[],point:null,reference,daily:{due:true,midnight:midnightInput(now)},error:e.message};}
}
export function exportHistory(scope,events){return {schema:'robotyx-hardpoints/1',scope,events:events.filter(e=>scopeKey(e.scope)===scopeKey(scope))};}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

// Forms survive polling renders: do not replace their DOM or clobber operator input.
export function renderHardpoints(host,getContext,onChange){
 if(!host)return;const x=getContext(),state=x.hardpoints,ready=!!scopeKey(state?.scope)&&!!inventoryRows(x.baseMeasuredReference).length;
 if(!ready){host.hidden=true;return;}host.hidden=false;
 if(!host._hardpoint){
  host.style.cssText='margin:12px 0;padding:10px;border:1px solid #314653;border-radius:8px;font-size:12px;min-width:0;overflow-wrap:anywhere';
  const title=document.createElement('b');title.textContent='Measured hardpoints';host.append(title);
  const status=document.createElement('p');status.setAttribute('role','status');host.append(status);
  const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Add / review hardpoint';detail.append(summary);host.append(detail);
  const note=document.createElement('p');note.textContent='AEST (UTC+10). Confirm measured values, including BHA once. Saved on this device; export/import for handover. Raw BHE readings are retained.';detail.append(note);
  const form=document.createElement('form');form.style.cssText='display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))';detail.append(form);
  const controls={};
  const field=(key,label,type,value)=>{const wrap=document.createElement('label');wrap.style.cssText='display:flex;flex-direction:column;gap:3px;min-width:0';wrap.append(document.createTextNode(label));const input=document.createElement('input');input.name=key;input.type=type;input.value=value??'';input.required=true;input.style.cssText='width:100%;box-sizing:border-box;min-height:36px';if(type==='number'){input.step='0.01';input.min='0';}wrap.append(input);form.append(wrap);controls[key]=input;return wrap;};
  field('aest','Measured at · AEST','datetime-local',midnightInput());
  const choose=document.createElement('label');choose.style.cssText='display:flex;flex-direction:column;min-width:0';choose.textContent='Measured position';const position=document.createElement('select');position.style.cssText='width:100%;box-sizing:border-box;min-height:36px';position.name='position';for(const [v,t]of [['joint-end','End of measured joint'],['within-joint','Within measured joint']]){const o=document.createElement('option');o.value=v;o.textContent=t;position.append(o);}choose.append(position);form.append(choose);controls.position=position;
  field('joint','Measured joint number','number','');controls.joint.step='1';controls.joint.min='1';
  field('md','Measured cumulative MD m · RKB','number','');
  const advanceWrap=field('advance','Advance within joint m','number','');advanceWrap.hidden=true;controls.advance.required=false;
  field('bhaLen','BHA length m · included in MD','number',x.baseMeasuredReference.bhaLen);
  field('operator','Measured / confirmed by','text',x.operator||'');controls.operator.maxLength=100;
  field('source','Measured source / reason','text','');controls.source.maxLength=500;
  const positionNote=document.createElement('p');detail.append(positionNote);
  position.onchange=()=>{advanceWrap.hidden=position.value!=='within-joint';advanceWrap.style.display=advanceWrap.hidden?'none':'flex';controls.advance.required=!advanceWrap.hidden;positionNote.textContent=advanceWrap.hidden?'Enter the measured cumulative MD at the END of this joint, not a partial bit depth. Choose Within measured joint for a partial interval.':'Enter measured bit MD and measured advance within this joint. Neither is filled from an estimate.';};position.onchange();
  const save=document.createElement('button');save.type='submit';save.textContent='Confirm measured hardpoint';form.append(save);
  const error=document.createElement('p');error.setAttribute('role','alert');detail.append(error);
  const history=document.createElement('div');history.style.overflowX='auto';detail.append(history);
  const exp=document.createElement('button');exp.type='button';exp.textContent='Export hardpoint history';detail.append(exp);
  const lab=document.createElement('label');lab.textContent=' Import hardpoints ';const imp=document.createElement('input');imp.type='file';imp.accept='.json';lab.append(imp);detail.append(lab);
  const view={status,detail,form,controls,error,history,exp,imp,key:null,signature:null,getContext,onChange,dirty:false,midnight:midnightInput()};host._hardpoint=view;form.addEventListener('input',()=>view.dirty=true);
  form.onsubmit=e=>{e.preventDefault();try{const ctx=view.getContext(),input=Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v.value])),event=createPoint(input,ctx.hardpoints.scope,ctx.baseMeasuredReference,readEvents());writeEvent(event,ctx.baseMeasuredReference);error.textContent='Measured hardpoint saved. Previous records retained.';view.signature=null;view.dirty=false;for(const k of ['joint','md','advance','source'])controls[k].value='';view.onChange();}catch(e){error.textContent=e.message;}};
  exp.onclick=()=>{const ctx=view.getContext();download('measured-hardpoints.json',exportHistory(ctx.hardpoints.scope,readEvents()));};
  imp.onchange=async()=>{const file=imp.files?.[0];if(!file)return;try{if(file.size>2e6)throw Error('Hardpoint file is too large.');const ctx=view.getContext();importHistory(JSON.parse(await file.text()),ctx.hardpoints.scope,ctx.baseMeasuredReference);error.textContent='Hardpoint history imported.';view.signature=null;view.onChange();}catch(e){error.textContent=e.message;}imp.value='';};
 }
 const v=host._hardpoint;v.getContext=getContext;v.onChange=onChange;
 const key=scopeKey(state.scope);if(v.key!==key){v.key=key;v.form.reset();v.controls.position.onchange();v.controls.aest.value=midnightInput();v.controls.joint.value='';v.controls.md.value='';v.controls.advance.value='';v.controls.bhaLen.value=x.baseMeasuredReference.bhaLen;v.controls.operator.value=x.operator||'';v.controls.source.value='';v.error.textContent='';v.signature=null;v.dirty=false;}
 const midnight=midnightInput();if(v.midnight!==midnight&&!v.dirty)v.controls.aest.value=midnight;v.midnight=midnight;
 v.status.textContent=state.error||(x.historicalRun?'Historical drilling run · midnight reminders paused. Hardpoints here apply to the drilling string, not the liner.':(state.daily.due?'Midnight measured checkpoint due · ':'Midnight measured checkpoint confirmed · ')+state.daily.midnight.slice(0,10)+' 00:00 AEST')+(state.point?' · active anchor #'+state.point.joint+' at '+state.point.md.toFixed(2)+' m · '+aestInput(Date.parse(state.point.effectiveAt)).replace('T',' '):' · no measured anchor recorded.');
 v.status.style.color=x.historicalRun?'#a9c3cf':state.daily.due?'#e6bd70':'#8dd5b0';
 const signature=JSON.stringify(state.events.filter(e=>scopeKey(e.scope)===key));if(v.signature===signature)return;v.signature=signature;v.history.replaceChildren();
 const active=new Set(state.points.map(p=>p.id)),events=state.events.filter(e=>scopeKey(e.scope)===key);
 for(const e of events.slice().reverse()){
  const p=document.createElement('p');p.textContent=e.action==='set'?aestInput(Date.parse(e.effectiveAt)).replace('T',' ')+' AEST · #'+e.joint+' · '+e.md.toFixed(2)+' m · BHA '+e.bhaLen.toFixed(2)+' m · '+e.operator+' · '+e.source+' · '+(active.has(e.id)?'active':'superseded / retracted'):'Retraction · '+e.operator+' · '+e.source;v.history.append(p);
  if(e.action==='set'&&active.has(e.id)){
   const retract=document.createElement('details'),s=document.createElement('summary');s.textContent='Retract this hardpoint';retract.append(s);const reason=document.createElement('input');reason.placeholder='Reason for retraction';reason.setAttribute('aria-label','Retraction reason');retract.append(reason);const b=document.createElement('button');b.type='button';b.textContent='Record retraction';retract.append(b);v.history.append(retract);
   b.onclick=()=>{try{const ctx=v.getContext(),event={id:crypto.randomUUID(),action:'void',scope:ctx.hardpoints.scope,target:e.id,recordedAt:new Date().toISOString(),operator:v.controls.operator.value.trim(),source:reason.value.trim()};writeEvent(event,ctx.baseMeasuredReference);v.signature=null;v.onChange();}catch(e){v.error.textContent=e.message;}};
  }
 }
}
