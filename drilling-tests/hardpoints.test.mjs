import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {activePoints,appendEvent,createPoint,dailyStatus,parseAest,midnightInput,anchorReference,importHistory,exportHistory,writeEvent,readEvents} from '../drilling/opsnow_hardpoints.mjs';
import {inventoryPosition,compareDerivedTally} from '../drilling/opsnow_tally_compare.mjs';
import {parseMeasuredRows,referenceFromUpload,saveUploadedReference,uploadedReference,useBundledReference} from '../drilling/opsnow_measured_upload.mjs';
const ref=JSON.parse(readFileSync(new URL('../drilling/data/dr101l-wb04-measured-tally.json',import.meta.url),'utf8'));
const scope={well:'well-a',wellbore:'wb-a',run:'run-1'},now=Date.parse('2026-11-18T02:00:00Z');
const values={aest:'2026-11-18T00:00',joint:'208',md:'2623.01',bhaLen:'48.53',position:'joint-end',operator:'SIM DD',source:'SIM measured midnight tally'};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} vs ${b}`);
const memory=()=>{const data=new Map;return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('midnight is AEST and a daily reminder cannot fabricate a measurement',()=>{
 assert.equal(midnightInput(Date.parse('2026-11-18T13:59:00Z')),'2026-11-18T00:00');assert.equal(midnightInput(Date.parse('2026-11-18T14:00:00Z')),'2026-11-19T00:00');
 assert.equal(parseAest(values.aest),Date.parse('2026-11-17T14:00:00Z'));assert.equal(dailyStatus([],scope,now).due,true);
 const p=createPoint(values,scope,ref,[],now);assert.equal(dailyStatus([p],scope,now).due,false);assert.equal(dailyStatus([p],scope,now+86400000).due,true);
 assert.equal(dailyStatus([createPoint({...values,aest:'2026-11-18T11:00'},scope,ref,[],now)],scope,now).due,true);
});
test('measured corrections keep BHA once and never change the original inventory',()=>{
 const before=JSON.stringify(ref),p=createPoint({...values,position:'within-joint',advance:'8.28',md:'2619.90'},scope,ref,[],now),r=anchorReference(ref,p);
 close(p.correction.offsetM,1);close(r.startMd,823.53);close(r.baseCarriedReference+r.bhaLen+r.checkpointDatum,r.startMd);assert.equal(inventoryPosition(r,2619.9).n,208);assert.equal(JSON.stringify(ref),before);
});
test('revisions and retractions append history; another well/run never inherits a point',()=>{
 const p=createPoint(values,scope,ref,[],now),events=appendEvent([],p,ref,now),revision=createPoint({...values,md:'2624.01',source:'SIM corrected measurement'},scope,ref,events,now+1000),next=appendEvent(events,revision,ref,now+1000);
 assert.equal(next.length,2);assert.equal(next[0],p);assert.equal(activePoints(next,scope,now+1000)[0].id,revision.id);
 assert.equal(activePoints(next,{...scope,run:'other'},now+1000).length,0);assert.equal(activePoints(next,{...scope,well:'other'},now+1000).length,0);
 const retracted=appendEvent(next,{id:'void-1',action:'void',scope,target:revision.id,recordedAt:new Date(now+2000).toISOString(),operator:'SIM DD',source:'SIM wrong measurement'},ref,now+2000);assert.equal(retracted.length,3);assert.equal(activePoints(retracted,scope,now+2000).length,0);
});
test('blank, future, invalid, out-of-inventory and impossible partial inputs are rejected',()=>{
 for(const patch of [{md:''},{bhaLen:''},{source:''},{operator:''},{joint:'9999'},{position:'within-joint',advance:'99'},{aest:'2026-11-19T00:00'},{aest:'2026-02-30T00:00'},{md:'20',bhaLen:'48.53'}])assert.throws(()=>createPoint({...values,...patch},scope,ref,[],now));
});
test('export/import is scoped, idempotent, atomic and preserves conflicting histories',()=>{
 const s=memory(),p=createPoint(values,scope,ref,[],now);writeEvent(p,ref,s,now);const payload=exportHistory(scope,readEvents(s)),other=memory();
 importHistory(payload,scope,ref,other,now);importHistory(payload,scope,ref,other,now);assert.equal(readEvents(other).length,1);
 assert.throws(()=>importHistory(payload,{...scope,well:'other'},ref,other,now));assert.throws(()=>importHistory({...payload,events:[{...p,md:1}]},scope,ref,other,now));assert.equal(readEvents(other).length,1);
});
test('a measured joint-end checkpoint resumes anchored cumulative BHE after an unknown prefix',()=>{
 const r={unit:'m',startMd:100,bhaLen:20,joints:[{n:1,len:12.4},{n:2,len:12.4}]},p=createPoint({...values,joint:'1',md:'113.4',bhaLen:'20'},scope,r,[],now),anchored=anchorReference(r,p);
 const raw=[{startMd:100,endMd:112.4,derivedLength:null,issues:['Sparse BHE']},{startMd:113.4,endMd:125.8,derivedLength:12.4,issues:[]}],before=JSON.stringify(raw),result=compareDerivedTally(raw,anchored);
 assert.equal(result.rows[1].derivedEndMd,null);close(result.rows[1].anchoredEndMd,125.8);assert.equal(JSON.stringify(raw),before);
 const gap=compareDerivedTally([{startMd:120,endMd:125.8,derivedLength:5.8,issues:[]}],anchored);assert.equal(gap.rows[0].anchoredEndMd,null);
});
test('uploading a measured reference keeps sensor values separate and flags cumulative/BHA inconsistencies',()=>{
 const candidate=parseMeasuredRows([['Well Name','DR0101L WB04B01 Inseam'],['BHA Len.','','48.53'],['Jt#','Tally Length (m)','HD (RKB)'],['63','3.10','825.63'],['64','9.26','840']]);
 const r=referenceFromUpload(candidate,{startMd:822.53,bhaLen:49,runId:'run-1'},{wellName:'DR101L',branchName:'WB04B01',fileName:'SIM.csv',sha256:'sim',priorReference:ref});
 assert.equal(r.joints.length,2);assert.match(r.issues.join(' '),/cumulative/);assert.match(r.issues.join(' '),/BHA/);assert.equal(r.joints[0].len,3.1);assert.equal(r.joints[0].sheetEnd,825.63);
 assert.throws(()=>referenceFromUpload({...candidate,declaredWell:'OTHER WB04B01'},{startMd:822.53,bhaLen:48.53,runId:'run-1'},{wellName:'DR101L',branchName:'WB04B01'}));
 assert.throws(()=>parseMeasuredRows([['Joint','Length m'],['1','12.4'],['1','12.4']]));
});
test('uploaded sheets persist by exact well/bore and previous uploads are retained when restoring supplied reference',()=>{
 const s=memory();saveUploadedReference(scope,ref,s);assert.equal(uploadedReference(scope,s).joints.length,189);assert.equal(uploadedReference({...scope,wellbore:'other'},s),null);useBundledReference(scope,s);assert.equal(uploadedReference(scope,s),null);
});
test('feet upload lengths convert to metres and generic start/BHA blanks require explicit values',()=>{
 const c=parseMeasuredRows([['Joint','Length (ft)'],['1','10'],['2','10']]);close(c.joints[0].len,3.048);assert.equal(c.startMd,null);
 assert.throws(()=>referenceFromUpload(c,{startMd:'',bhaLen:'',runId:'run-1'},{wellName:'DR101L',branchName:'WB04B01'}));
 const mixed=parseMeasuredRows([['BHA Length (m)','20'],['Joint','Length (ft)','Cumulative MD (m)'],['1','10','100']]);close(mixed.bhaLen,20);close(mixed.startMd,96.952);close(mixed.joints[0].sheetEnd,100);
});
