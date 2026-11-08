// safety_adapter.js v5.12.0: Safety World scenario source seam. SIM data only today.
// Interface: an adapter is {id, source:'SIM'|'ORG', tenantId?, async listMissions(ctx), async listHunts(ctx)}.
// ctx = {tenantId:string|null}. Today ctx.tenantId is always null (no logins yet).
// Rules (enforced in getScenarios, not trusted to adapters):
//  - every scenario carries source 'SIM' or 'ORG'.
//  - an ORG scenario is shown only when scenario.tenantId === ctx.tenantId (never cross-tenant).
//  - when an organisation has no ORG scenarios, SIM scenarios are the fallback.
// No live data, no network calls, no reads from other systems in this file.
export const SIM_MISSIONS=[
 {id:'ca-sim-01',title:'Guard on mud pump drive belt',area:'pumps',control:'guard',due:-2,steps:['inspect','control','verify','close'],
  text:'The drive belt guard on mud pump 1 is missing. Install the guard before you start the pump.'},
 {id:'ca-sim-02',title:'Barrier at open cellar',area:'cellar',control:'barrier',due:3,steps:['inspect','control','verify','close'],
  text:'The cellar is open with no barrier. Put a hard barrier around the cellar.'},
 {id:'ca-sim-03',title:'Permit for work at height',area:'derrick',control:'permit',due:-1,steps:['inspect','control','verify','close'],
  text:'A person must go up the derrick. Get a work-at-height permit before the person climbs.'},
 {id:'ca-sim-04',title:'Gloves and glasses at the rig floor',area:'floor',control:'ppe',due:5,steps:['inspect','control','verify','close'],
  text:'Crew at the rig floor do not use gloves and safety glasses. Supply the correct PPE.'}
].map(m=>({...m,source:'SIM',tenantId:null}));
export const HAZARDS=[
 {id:'dropped',name:'Dropped object',area:'derrick',text:'A loose tool is on the monkey board. It can fall.'},
 {id:'handrail',name:'Missing handrail',area:'floor',text:'A handrail is not installed at the floor edge.'},
 {id:'openhole',name:'Open hole',area:'cellar',text:'The mousehole cover is not installed.'},
 {id:'h2s',name:'H2S zone',area:'shakers',text:'The H2S alarm is on at the shakers. Do not go in without a breathing set.'},
 {id:'lof',name:'Line of fire',area:'catwalk',text:'A person stands in the path of the pipe on the catwalk.'},
 {id:'load',name:'Suspended load',area:'crane',text:'A person walks below a suspended load.'}
];
export const SIM_HUNTS=[
 {id:'hh-sim-easy',title:'Hazard hunt: easy',difficulty:'easy',time:90,hazards:['dropped','handrail','openhole']},
 {id:'hh-sim-med',title:'Hazard hunt: medium',difficulty:'medium',time:75,hazards:['dropped','handrail','openhole','h2s','lof']},
 {id:'hh-sim-hard',title:'Hazard hunt: hard',difficulty:'hard',time:60,hazards:HAZARDS.map(h=>h.id)}
].map(h=>({...h,source:'SIM',tenantId:null}));
export const simAdapter={id:'sim',source:'SIM',async listMissions(){return SIM_MISSIONS.map(x=>({...x}))},async listHunts(){return SIM_HUNTS.map(x=>({...x}))}};
// Stub for an organisation's own incidents and corrective actions. It returns nothing until logins exist.
// A real adapter must map each record to {id,title,area,control,due,steps,text} and set source:'ORG', tenantId.
export function orgAdapterStub(tenantId){return {id:'org-stub',source:'ORG',tenantId,async listMissions(ctx){return []},async listHunts(ctx){return []}}}
const REG=[simAdapter];
export function register(a){if(!a||!a.id||!['SIM','ORG'].includes(a.source))throw new Error('adapter needs id and source SIM or ORG');if(a.source=='ORG'&&!a.tenantId)throw new Error('ORG adapter needs tenantId');REG.push(a);return ()=>{const i=REG.indexOf(a);if(i>=0)REG.splice(i,1)}}
export function adapters(){return REG.slice()}
function scope(list,a,ctx){return (list||[]).map(s=>({...s,source:a.source,tenantId:a.source=='ORG'?a.tenantId:null}))
 .filter(s=>s.source=='SIM'||(ctx.tenantId&&s.tenantId===ctx.tenantId&&a.tenantId===ctx.tenantId))}
export async function getScenarios(ctx={tenantId:null}){const out={missions:[],hunts:[]};const org={missions:[],hunts:[]};
 for(const a of REG){if(a.source=='ORG'&&a.tenantId!==ctx.tenantId)continue;let M=[],H=[];try{M=await a.listMissions(ctx);H=await a.listHunts(ctx)}catch(e){}
  const t=a.source=='ORG'?org:out;t.missions.push(...scope(M,a,ctx));t.hunts.push(...scope(H,a,ctx))}
 return {missions:org.missions.length?org.missions:out.missions,hunts:org.hunts.length?org.hunts:out.hunts}}
