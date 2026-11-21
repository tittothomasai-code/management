// Reuses saved EDM imports and their location model. Nothing is sent to a server.
import * as store from './edmstore.js?v=5941';
import {fieldReference} from './edm_field_check_core.mjs?v=selected-reference-1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function attachFieldCheck(api){
 const root=document.getElementById('edmmap');if(!root||root.querySelector('[data-field-check]'))return;
 const button=document.createElement('button');button.type='button';button.dataset.fieldCheck='';button.textContent='10 km check';root.querySelector('.bar').append(button);
 const panel=document.createElement('section');panel.hidden=true;panel.style.cssText='position:absolute;inset:68px 8px 12px auto;width:min(540px,calc(100% - 16px));z-index:12;overflow:auto;box-sizing:border-box;padding:12px;background:#0d1620;border:1px solid #58a;border-radius:10px;overflow-wrap:anywhere';root.append(panel);
 let worker=null,lastReport=null,token=0;
 const download=()=>{if(!lastReport)return;const u=URL.createObjectURL(new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='dr101l-field-10km-screen.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 const close=()=>{panel.hidden=true;};
 const controls=()=>{panel.querySelector('[data-close]').onclick=close;panel.querySelector('[data-rerun]').onclick=run;const exp=panel.querySelector('[data-export]');if(exp)exp.onclick=download;};
 async function run(){
  panel.hidden=false;const turn=++token;worker?.terminate();button.disabled=true;
  panel.innerHTML='<button data-close>Close</button><button data-rerun>Run again</button><h3>Field anti-collision · 10 km</h3><p role="status">Reading saved EDM datasets on this device…</p>';controls();
  try{
   const models=[{id:api.W.savedId||'active',W:api.W}],list=await store.list(),unreadable=[];
   for(const m of list){if(m.id===api.W.savedId)continue;try{models.push({id:m.id,W:await store.get(m.id)});}catch{unreadable.push(m.name||m.id);}}
   if(turn!==token||!root.isConnected)return;
   const selected=api.st.sel?.kind==='well'?api.W.wells[api.st.sel.i]?.id:null,reference=fieldReference(api.W,selected),wellName=reference.wellName;
   const job=new Worker(new URL('./edm_field_check_worker.mjs?v=selected-reference-1',import.meta.url),{type:'module'});worker=job;
   job.onerror=()=>{if(turn===token&&root.isConnected)showError('The field calculation could not finish. No clearance was produced.');};
   job.onmessage=e=>{if(turn!==token||!root.isConnected){job.terminate();return;}if(e.data.error)return showError(e.data.error);lastReport=e.data.report;lastReport.unreadableDatasets=unreadable;
    const r=lastReport;button.disabled=false;button.textContent=r.status==='INCOMPLETE'?'10 km · incomplete':'10 km · '+r.results.filter(x=>x.flag!=='NO PROXIMITY FLAG').length+' flags';
    panel.innerHTML='<button data-close>Close</button><button data-rerun>Run again</button><button data-export>Export report</button><h3>'+esc(wellName)+' · 10 km field check</h3><p role="status" style="color:#ffc04d">'+esc(r.status)+' · '+(r.assessedOffsetTrajectories||0)+' offset trajectories · '+(r.assessedPairs||0)+' assessed pairs</p>'+(r.center?'<p>Grid E '+r.center.E.toFixed(2)+' · N '+r.center.N.toFixed(2)+' · '+esc(r.center.crs.datum)+' / zone '+r.center.crs.zone+(r.center.crs.south?'S':'N')+' · '+esc(r.center.crs.vertical)+'</p>':'')+'<p>Source: '+r.referenceTrajectories.map(x=>esc(x.name)+' ('+esc(x.kind)+')').join(', ')+'</p><ul>'+r.limitations.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+(unreadable.length?'<p>Unreadable datasets: '+unreadable.map(esc).join(', ')+'</p>':'')+'<p>'+r.skipped.length+' skipped / incomplete records · '+r.outsideRadius+' outside radius · '+r.sameWellExcluded+' same-well paths excluded.</p>'+ (r.results.length?'<div style="overflow:auto"><table><thead><tr><th>Offset</th><th>Reference</th><th>C-C m</th><th>SF lower bound</th><th>Result</th></tr></thead><tbody>'+r.results.slice(0,60).map(x=>'<tr><td>'+esc(x.offsetWell)+' / '+esc(x.offset)+'</td><td>'+esc(x.reference)+'</td><td>'+x.closestApproachM.toFixed(2)+'</td><td>'+x.sfLowerBound.toFixed(2)+'</td><td>'+esc(x.flag)+'</td></tr>').join('')+'</tbody></table></div><p>Showing '+Math.min(60,r.results.length)+' of '+r.results.length+' pairs; the export contains every result.</p>':'<p>No offset comparison was possible. Load the surrounding well trajectories and run again.</p>');controls();worker.terminate();
   };worker.postMessage({models,options:{...reference,radiusM:10000}});
  }catch(e){if(turn===token&&root.isConnected)showError(e.message);}
 }
 function showError(message){button.disabled=false;panel.innerHTML='<button data-close>Close</button><button data-rerun>Run again</button><p role="alert">'+esc(message)+'</p>';controls();worker?.terminate();}
 button.onclick=()=>panel.hidden?run():close();
 // Opening the supplied DR101L field also runs the requested screening on local saved data.
 if(api.W.wells.length===1)run();
 const observer=new MutationObserver(()=>{if(!root.isConnected){token++;worker?.terminate();observer.disconnect();}});observer.observe(document.body,{childList:true});
 return {run,report:()=>lastReport};
}
