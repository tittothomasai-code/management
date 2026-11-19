// SIM-only training state. No live context, persistence or transport access.
const AZ=15*Math.PI/180;
export function createLandingSimulation(variant='normal',lengthMode='nominal'){
 if(!['normal','early','deep'].includes(variant))throw Error('Unknown reservoir simulation.');
 const tie={md:0,n:0,e:0,tvd:0,inc:0,azi:15};
 const joints={mode:lengthMode,nominalM:13,anchorMd:0,source:'SIMULATED joint lengths'};
 if(lengthMode==='measured')joints.records=Array.from({length:100},(_,i)=>({id:'SIM pipe '+(i+1),lengthM:[12.42,12.31,12.66,12.18,12.57][i%5]}));
 return {variant,scope:{well:'SIM 500 m well',wellbore:variant,manual:true,draftName:'Isolated reservoir tutorial'},tie,drilled:[tie],executed:[],previous:null,joints,landingMd:500,reservoirTvd:300,changed:false,events:[],report:null};
}
export function landingSimulationInput(s){
 if(!s.changed&&s.variant!=='normal'&&s.tie.md>=260-1e-7){s.reservoirTvd=s.variant==='early'?280:320;s.changed=true;s.events.push({md:s.tie.md,fromTvd:300,toTvd:s.reservoirTvd,type:s.variant,drilledPrefixCount:s.drilled.length});}
 return {scope:s.scope,tie:s.tie,target:{mode:'position',md:s.landingMd,n:330*Math.cos(AZ),e:330*Math.sin(AZ),tvd:s.reservoirTvd,inc:90,azi:15},limits:{maxDls:12,positionTol:.05,angleTol:.1,responseLow:.8,responseHigh:1.2},joints:s.joints,previous:s.previous,surveys:s.drilled,response:{bhaId:'SIM BHA run',runStartMd:0},tieSource:'SIMULATED survey after each executed joint; never a live reading'};
}
export function acceptLandingSimulationPlan(s,report){
 s.report=report;const c=report.candidates.find(c=>c.id===report.recommendation);if(c)s.previous={scope:s.scope,path:c.path};return c||null;
}
export function advanceLandingSimulation(s,candidate){
 if(!candidate?.feasible||!candidate.jointSchedule?.rows.length)throw Error('No feasible joint instruction to execute in the simulation.');
 const row=candidate.jointSchedule.rows[0],next=candidate.path[1];if(Math.abs(row.startMd-s.tie.md)>1e-5)throw Error('Simulation joint does not start at the current survey.');
 s.executed.push({...row});s.tie={...next};s.drilled.push(s.tie);return row;
}
