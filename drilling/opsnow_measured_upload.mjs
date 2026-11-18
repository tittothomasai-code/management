// A measured upload is a reference, never a replacement for raw or derived sensor data.
import {inventoryRows} from './opsnow_tally_compare.mjs?v=opsref1118';
const finite=Number.isFinite,KEY='opsnow-measured-uploads:v1',clean=x=>String(x??'').trim(),num=x=>{if(x==null||clean(x)==='')return null;const n=Number(clean(x).replaceAll(',',''));return finite(n)?n:null;};
export const uploadKey=scope=>scope?.well&&scope?.wellbore?JSON.stringify([scope.well,scope.wellbore]):null;
export function parseMeasuredRows(rows){
 const hi=rows.findIndex(r=>r.some(c=>/^(tally\s*)?(length|len\b|lgth)/i.test(clean(c)))&&r.some(c=>/^(jt#?|joint(?:\s*(?:#|number|no\.?))?|#|no\.?|item)$/i.test(clean(c))));
 if(hi<0)throw Error('No joint-number and length columns found. Choose the tally or slide-sheet worksheet.');
 const h=rows[hi].map(clean),col=re=>h.findIndex(x=>re.test(x)),ncol=col(/^(jt#?|joint(?:\s*(?:#|number|no\.?))?|#|no\.?|item)$/i),lcol=col(/^(tally\s*)?(length|len\b|lgth)/i),dcol=col(/^(hd\b|md\b|cum|total depth)/i);
 const unitFactor=(label,fallback)=>/\bft\b|feet/i.test(label)?.3048:/\bm\b|metres?|meters?/i.test(label)?1:fallback;
 const factor=unitFactor(h[lcol],1),depthFactor=unitFactor(h[dcol]||'',factor),absolute=dcol>=0&&/hd|md|depth|rkb/i.test(h[dcol]);
 const metadata=(re,numeric=true)=>{for(const r of rows.slice(0,hi+1)){const i=r.findIndex(c=>re.test(clean(c)));if(i>=0){const next=r.slice(i+1).find(c=>clean(c)!=='');if(next!=null)return numeric?num(next):clean(next);}}return null;};
 const metadataFactor=re=>{const label=rows.slice(0,hi+1).flat().find(c=>re.test(clean(c)));return unitFactor(clean(label),factor);};
 const bha=metadata(/^bha\s*(len|length)/i),declaredWell=metadata(/^well\s*name$/i,false),startExplicit=metadata(/^start\s*(depth|md|hd)(?:\s|\(|$)/i),joints=[];
 for(const r of rows.slice(hi+1)){const n=num(r[ncol]),len=num(r[lcol]);if(n===null||len===null)continue;if(!Number.isInteger(n)||n<1||len<=0)throw Error('Joint numbers must be positive integers and lengths must be positive.');joints.push({n,len:len*factor,sheetEnd:num(r[dcol])==null?null:num(r[dcol])*depthFactor});}
 if(!joints.length)throw Error('No numbered measured joints found.');
 if(new Set(joints.map(j=>j.n)).size!==joints.length)throw Error('Duplicate joint numbers need correction before using the tally.');
 for(let i=1;i<joints.length;i++)if(joints[i].n<=joints[i-1].n)throw Error('Keep joint numbers in the measured running order.');
 return {joints,absolute,declaredWell,startMd:startExplicit==null?(absolute&&joints[0].sheetEnd!==null?joints[0].sheetEnd-joints[0].len:null):startExplicit*metadataFactor(/^start\s*(depth|md|hd)/i),bhaLen:bha===null?null:bha*metadataFactor(/^bha\s*(len|length)/i),unit:'m',sheetName:rows.sheetName||'CSV'};
}
export function referenceFromUpload(candidate,input,context){
 const blank=v=>v==null||clean(v)==='';if(blank(input.startMd)||blank(input.bhaLen)||blank(input.runId))throw Error('Enter the starting MD, BHA length and run ID.');
 const startMd=Number(input.startMd),bhaLen=Number(input.bhaLen);if(!finite(startMd)||!finite(bhaLen)||bhaLen<0||startMd<bhaLen)throw Error('Starting MD must include the non-negative BHA length.');
 const canonical=s=>clean(s).toUpperCase().replace(/^DR0101L/,'DR101L'),tokens=canonical(candidate.declaredWell||'').split(/[^A-Z0-9]+/).filter(Boolean),well=canonical(context.wellName),branch=canonical(context.branchName);
 if(tokens.length&&(!tokens.includes(well)||!tokens.includes(branch)))throw Error('This worksheet identifies another well or wellbore. It was not applied.');
 const issues=[];let cum=0;
 const joints=candidate.joints.map((j,i)=>{cum+=j.len;const expected=candidate.absolute?startMd+cum:cum;if(j.sheetEnd!==null&&Math.abs(j.sheetEnd-expected)>.3)issues.push('Entry '+j.n+': sheet cumulative differs by '+(j.sheetEnd-expected).toFixed(2)+' m');if(i&&j.n!==candidate.joints[i-1].n+1)issues.push('Joint sequence gap '+candidate.joints[i-1].n+' → '+j.n);return {...j};});
 if(context.priorReference&&Math.abs(context.priorReference.bhaLen-bhaLen)>.01)issues.push('BHA differs from the previous reference; confirm the run ID and assembly.');
 const reference={schema:'robotyx-measured-tally/1',unit:'m',startMd,bhaLen,runId:clean(input.runId),source:context.fileName+' · '+candidate.sheetName,sourceSha256:context.sha256,well:context.wellName,wellbore:context.branchName,joints,issues};
 if(!inventoryRows(reference).length)throw Error('Invalid measured reference.');return reference;
}
let cachedRaw,cache={};
function read(storage){const raw=storage.getItem(KEY)||'{}';if(raw!==cachedRaw){const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Saved measured references cannot be read.');cache=parsed;cachedRaw=raw;}return cache;}
export function uploadedReference(scope,storage=globalThis.localStorage){const key=uploadKey(scope);if(!key)return null;const p=read(storage)[key];return p?.revisions?.find(r=>r.id===p.active)?.reference||null;}
export function saveUploadedReference(scope,reference,storage=globalThis.localStorage){
 const key=uploadKey(scope);if(!key||!inventoryRows(reference).length)throw Error('Select an active well and wellbore first.');
 const all=read(storage),old=all[key]||{revisions:[]},revision={id:crypto.randomUUID(),uploadedAt:new Date().toISOString(),reference};
 const next={...all,[key]:{active:revision.id,revisions:[...old.revisions,revision]}};storage.setItem(KEY,JSON.stringify(next));cachedRaw=undefined;
}
export function useBundledReference(scope,storage=globalThis.localStorage){const key=uploadKey(scope),all=read(storage),old=all[key];if(!old)return;storage.setItem(KEY,JSON.stringify({...all,[key]:{...old,active:null}}));cachedRaw=undefined;}
export function renderMeasuredUpload(host,getContext,xlsxRows,onChange,parseCsv){
 if(host._upload){host._upload.getContext=getContext;host._upload.onChange=onChange;return host._upload;}
 const detail=document.createElement('details'),s=document.createElement('summary');s.textContent='Review measured upload';detail.append(s);host.append(detail);host.hidden=true;
 const select=document.createElement('select');select.setAttribute('aria-label','Measured tally worksheet');detail.append(select);const info=document.createElement('p');detail.append(info);
 const form=document.createElement('form');form.style.cssText='display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))';detail.append(form);const fields={};
 for(const [key,label,type] of [['startMd','Starting MD m · includes BHA','number'],['bhaLen','BHA length m','number'],['runId','Run ID','text']]){const l=document.createElement('label');l.style.cssText='display:flex;flex-direction:column;min-width:0';l.textContent=label;const i=document.createElement('input');i.name=key;i.type=type;i.required=true;i.style.cssText='width:100%;box-sizing:border-box;min-height:36px';if(type==='number'){i.min='0';i.step='.01';}l.append(i);form.append(l);fields[key]=i;}
 const button=document.createElement('button');button.type='submit';button.textContent='Track against this measured tally';form.append(button);const error=document.createElement('p');error.setAttribute('role','alert');detail.append(error);
 const reset=document.createElement('button');reset.type='button';reset.textContent='Use supplied reference instead';detail.append(reset);
 const v={getContext,onChange,token:0,candidate:null,scopeAtRead:null};host._upload=v;
 const parse=async(name)=>{const token=v.token;try{let rows;if(v.buffer)rows=await xlsxRows(v.buffer,{prefer:name?new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'):/tally|4\.2\.1\s*ss|slide/i});else rows=parseCsv(v.text);if(token!==v.token)return;
   v.candidate=parseMeasuredRows(rows);select.replaceChildren();for(const n of rows.sheetNames||['CSV']){const o=document.createElement('option');o.value=n;o.textContent=n;o.selected=n===rows.sheetName;select.append(o);}select.hidden=!rows.sheetNames?.length;
   const x=v.getContext(),c=v.candidate;fields.startMd.value=c.startMd??x.baseMeasuredReference?.startMd??'';fields.bhaLen.value=c.bhaLen??x.baseMeasuredReference?.bhaLen??'';fields.runId.value=x.hardpoints?.scope?.run||x.runIdentifier||'';info.textContent=v.fileName+' · '+c.joints.length+' inventory entries · '+c.sheetName+'. Confirm the active well/run and starting reference. Derived BHE values are kept separate.';error.textContent='';
  }catch(e){v.candidate=null;error.textContent=e.message;}};
 v.read=async file=>{host.hidden=false;detail.open=true;const token=++v.token;v.scopeAtRead=uploadKey(v.getContext().uploadScope);v.fileName=file.name;v.candidate=null;error.textContent='';try{if(!scopeKeyLike(v.scopeAtRead))throw Error('Connect to an active wellbore before applying an upload.');if(file.size>8e6)throw Error('Choose a tally under 8 MB.');const buf=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',buf);if(token!==v.token)return;v.sha256=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');if(/\.xlsx$/i.test(file.name)){v.buffer=buf;v.text=null;}else if(/\.(csv|txt|tsv)$/i.test(file.name)){v.buffer=null;v.text=new TextDecoder().decode(buf);}else throw Error('Choose an XLSX or CSV tally.');await parse();}catch(e){if(token===v.token)error.textContent=e.message;}};
 select.onchange=()=>{v.token++;parse(select.value);};
 form.onsubmit=e=>{e.preventDefault();try{const x=v.getContext();if(uploadKey(x.uploadScope)!==v.scopeAtRead)throw Error('The active well changed. Choose the upload again.');if(!v.candidate)throw Error('Choose a valid tally worksheet.');const reference=referenceFromUpload(v.candidate,Object.fromEntries(Object.entries(fields).map(([k,i])=>[k,i.value])),{wellName:x.well,branchName:x.active,priorReference:x.baseMeasuredReference,fileName:v.fileName,sha256:v.sha256});saveUploadedReference(x.uploadScope,reference);error.textContent=reference.issues.length?'Reference saved with '+reference.issues.length+' inconsistencies flagged.':'Measured reference saved. Waiting for independent BHE comparison.';v.onChange();}catch(e){error.textContent=e.message;}};
 reset.onclick=()=>{try{const x=v.getContext();useBundledReference(x.uploadScope);error.textContent='Supplied reference restored; upload history retained.';v.onChange();}catch(e){error.textContent=e.message;}};
 return v;
}
const scopeKeyLike=key=>typeof key==='string'&&key.length>0;
