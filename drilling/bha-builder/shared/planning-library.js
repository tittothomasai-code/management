import {validatePath,atMD,minCurve} from './wp-autotrack-core.js';
export const newId=()=>globalThis.crypto?.randomUUID?.()||'demo-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateAssembly(bha){
 if(!Array.isArray(bha)||!bha.length||bha.length>16||bha[0].type!=='Bit')throw Error('Save a complete bit-first BHA with 1–16 components.');
 for(const c of bha){if(typeof c.name!=='string'||!c.name.trim()||c.name.length>150||!['Bit','Motor','MWD','Collar','Stabilizer','Sub'].includes(c.type))throw Error('Complete each component name and type.');
 for(const [k,min,max] of [['lengthM',.01,100],['odIn',.1,36],['idIn',0,c.odIn-.001],['maxDls',0,30],['rigidSpanM',0,c.lengthM],['odToleranceMm',0,25],['yieldPsi',1,300000]])if(!finite(c[k],min,max))throw Error('Complete valid component '+k+' before saving.');}return bha;
}
export class BhaLibrary{
 constructor(storage,key='robotyx.demo.bha-library.v1'){this.storage=storage;this.key=key;}
 read(){let raw;try{raw=this.storage.getItem(this.key);}catch{throw Error('Browser storage is unavailable. Export BHAs to retain them.');}if(!raw)return {schema:'robotyx.bha-library.v1',records:[]};let doc;try{doc=JSON.parse(raw);}catch{throw Error('Saved BHA library is unreadable; it has not been overwritten.');}if(doc.schema!=='robotyx.bha-library.v1'||!Array.isArray(doc.records))throw Error('Unrecognised saved BHA library; it has not been overwritten.');return doc;}
 list(){return clone(this.read().records);}
 save(name,bha,{id=null,expectedRevision=null,design=null}={}){
 validateAssembly(bha);if(typeof name!=='string'||!name.trim()||name.length>150)throw Error('Give the BHA a name (up to 150 characters).');
 const doc=this.read(),old=id?doc.records.find(r=>r.id===id):null;
 if(id&&!old)throw Error('Saved BHA not found.');if(old&&old.revision!==expectedRevision)throw Error('The saved BHA changed. Reload the library before saving another version.');
 const record=old?clone(old):{id:newId(),versions:[],revision:0};record.revision++;record.name=name.trim();record.updatedAt=new Date().toISOString();
 record.versions.push({revision:record.revision,at:record.updatedAt,bha:clone(bha),design:clone(design),status:'unverified-demo'});
 const index=doc.records.findIndex(r=>r.id===record.id);if(index<0)doc.records.push(record);else doc.records[index]=record;
 if(doc.records.length>100)throw Error('Library limit reached (100 BHAs). Export the library before reorganising it.');
 try{this.storage.setItem(this.key,JSON.stringify(doc));}catch{throw Error('Could not save the BHA. Browser storage may be full. Export it instead.');}return clone(record);
 }
 load(id,revision=null){const r=this.read().records.find(r=>r.id===id);if(!r)throw Error('Saved BHA not found.');const v=r.versions.find(x=>x.revision===(revision??r.revision));if(!v)throw Error('BHA version not found.');validateAssembly(v.bha);return clone({...v,id:r.id,name:r.name});}
 export(){return JSON.stringify(this.read(),null,2);}
 import(text){if(text.length>2*1024*1024)throw Error('BHA library file limit is 2 MiB.');const incoming=JSON.parse(text);if(incoming.schema!=='robotyx.bha-library.v1'||!Array.isArray(incoming.records)||incoming.records.length>100)throw Error('Unrecognised BHA library file.');
 const additions=incoming.records.map(r=>{if(typeof r.name!=='string'||!r.name.trim()||!Array.isArray(r.versions)||!r.versions.length||r.versions.length>100)throw Error('Invalid BHA record.');r.versions.forEach(v=>validateAssembly(v.bha));return {id:newId(),name:r.name,revision:r.versions.length,updatedAt:new Date().toISOString(),versions:r.versions.map((v,i)=>({...clone(v),revision:i+1,status:'unverified-demo'}))};});
 const doc=this.read();if(doc.records.length+additions.length>100)throw Error('Import would exceed 100 saved BHAs.');doc.records.push(...additions);try{this.storage.setItem(this.key,JSON.stringify(doc));}catch{throw Error('Could not save imported BHAs. Existing library was not intentionally replaced.');}return additions.length;
 }
}
export function parseOffsetCsv(text){
 if(typeof text!=='string'||text.length>2*1024*1024)throw Error('Offset CSV limit is 2 MiB.');const lines=text.trim().split(/\r?\n/).filter(x=>x.trim());if(lines.length<3||lines.length>2001)throw Error('Supply 2–2,000 survey stations.');
 const header=lines.shift().replace(/^\uFEFF/,'').split(',').map(x=>x.trim().toLowerCase());if(new Set(header).size!==header.length||!['md','inc','azi','n','e','tvd'].every(k=>header.includes(k)))throw Error('CSV headers must include md,inc,azi,n,e,tvd (metres and degrees).');
 const path=validatePath(lines.map((line,i)=>{const cells=line.split(',');if(cells.length!==header.length)throw Error(`CSV row ${i+2} has the wrong column count.`);return Object.fromEntries(['md','inc','azi','n','e','tvd'].map(k=>{const v=cells[header.indexOf(k)].trim();if(!v||!Number.isFinite(Number(v)))throw Error(`CSV row ${i+2}: invalid ${k}.`);return [k,Number(v)];}));}));
 for(let i=1;i<path.length;i++){const calculated=minCurve(path[i-1],path[i]),actual=path[i];if(Math.hypot(calculated.n-actual.n,calculated.e-actual.e,calculated.tvd-actual.tvd)>.25)throw Error(`CSV row ${i+2}: coordinates disagree with the survey angles/depth by more than 0.25 m. Review the source.`);}
 return path;
}
export function alignedOffset(offset){
 validatePath(offset.path);if(offset.frame!=='local-nev-m'||offset.tieOnConfirmed!==true||!['shiftN','shiftE','shiftTvd'].every(k=>finite(offset[k],-1e7,1e7)))throw Error('Confirm this offset coordinate frame and N/E/TVD alignment first.');
 return offset.path.map(p=>({...p,n:p.n+offset.shiftN,e:p.e+offset.shiftE,tvd:p.tvd+offset.shiftTvd}));
}
export function offsetReference(offset,{fromMD,toMD,deltaN,deltaE,deltaTvd,useStart=false},run){
 const path=alignedOffset(offset);if(!finite(fromMD,path[0].md,path.at(-1).md)||!finite(toMD,fromMD+.001,path.at(-1).md))throw Error('Choose an increasing interval within the offset survey.');
 for(const v of [deltaN,deltaE,deltaTvd])if(!finite(v,-100000,100000))throw Error('Enter the desired N/E/TVD displacement, including explicit zeros.');
 const shift=p=>({...p,n:p.n+deltaN,e:p.e+deltaE,tvd:p.tvd+deltaTvd});const a=shift(atMD(path,fromMD)),b=shift(atMD(path,toMD));
 const guideTargets=Array.from({length:8},(_,i)=>{const p=shift(atMD(path,fromMD+(toMD-fromMD)*(i+1)/8));return {name:`${offset.name} guide ${i+1}`,n:p.n,e:p.e,tvd:p.tvd};});
 return {run:{...clone(run),endMode:'target',target:{name:'Offset-derived target',n:b.n,e:b.e,tvd:b.tvd},guideTargets,referencePlan:{offsetId:offset.id,offsetName:offset.name,offsetSignature:JSON.stringify([offset.path,offset.shiftN,offset.shiftE,offset.shiftTvd]),fromMD,toMD,deltaN,deltaE,deltaTvd,status:'draft',method:'Translated survey interval guides; original offset retained for screening'}},tieOn:useStart?a:null};
}
