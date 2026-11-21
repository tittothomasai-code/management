// Presentation gates for the existing planner. Never commands equipment.
export const landingScope=x=>JSON.stringify([x.operator||null,x.uploadScope?.well||x.well||null,x.uploadScope?.wellbore||x.active||null]);
export function landingStatus(x,s={},now=Date.now()){
 const surveys=(x.surveys||[]).map(p=>({...p,tvd:Number.isFinite(p.tvdc)?p.tvdc:p.tvd})).filter(p=>['md','inc','azi','n','e','tvd'].every(k=>Number.isFinite(p[k]))).sort((a,b)=>a.md-b.md),survey=surveys.at(-1)||null;
 const base={state:'setup',title:'Set up landing',message:'Choose the target, BHA limits and joint lengths in Settings.',survey,surveys,target:null,candidate:null,next:null,active:false,hard:false};
 if(x.operationReport)return {...base,state:'completed',title:'Previous well completed',message:'Select the next well and wellbore in Ops Settings. Its landing setup is kept separate.'};
 if(s.scope!==landingScope(x)||!s.report)return {...base,...(s.busy?{state:'searching',title:'Searching paths',message:s.message||'Calculating joint-by-joint solutions.'}:s.error?{state:'review',title:'Review settings',message:s.error}:{})};
 const r=s.report,c=r.candidates.find(c=>c.id===s.selected)||r.candidates.find(c=>c.id===r.recommendation),manual=!!r.scope?.manual;
 const withPlan={...base,target:r.target,candidate:c||null,report:r};
 if(s.dirty||!s.current||s.busy||s.error)return {...withPlan,state:s.busy?'searching':'review',title:s.busy?'Updating guidance':'Plan needs review',message:s.error||s.message||'Inputs or survey data changed. Recalculate in Settings.',candidate:null};
 if(!c?.feasible||!c.jointSchedule?.rows?.length||r.difficulty?.hard)return {...withPlan,state:'hard',title:'HARD LANDING',message:r.difficulty?.reason||c?.issues?.join('; ')||'No feasible joint schedule. Review the target or limits.',hard:true,candidate:null};
 const next=c.jointSchedule.rows.find(row=>row.endMd>r.tie.md+1e-6)||null;
 if(manual)return {...withPlan,state:'draft',title:'Manual planning draft',message:'Preview only. Select survey tie-on in Settings to follow the active well.',next};
 if(!survey)return {...withPlan,state:'review',title:'Waiting for a survey',message:'A complete MD, Inc, Azi and N/E/TVD survey is required.'};
 const advanced=x.landingFeed?.advancedAt,fresh=x.landingFeed?.signed&&Number.isFinite(advanced)&&now>=advanced&&now-advanced<120000;
 if(!fresh)return {...withPlan,state:'delayed',title:'Survey plan · feed delayed',message:'No advancing feed in the last 120 seconds. Next-joint guidance is paused.'};
 if(x.bitKind!=='reported'||!Number.isFinite(x.bitMd)||!Number.isFinite(x.holeMd)||Math.abs(x.bitMd-x.holeMd)>.5)return {...withPlan,state:'off-bottom',title:'Waiting for bit on bottom',message:'Confirm reported bit depth at hole depth before using next-joint guidance.'};
 return {...withPlan,state:'guidance',title:'Survey guidance',message:'Calculated joint requirements · advisory. Recalculates as new surveys arrive.',next,active:true};
}

export function wellWorkspaceUrl(href,name){const value=String(name??'').trim();if(!value||value.length>256||/[\x00-\x1f\x7f]/.test(value))throw Error('Enter a well name or UID (1–256 characters).');const url=new URL(href);url.searchParams.set('well',value);url.searchParams.delete('wellUid');url.searchParams.delete('wellboreUid');url.hash='';return url.href;}
