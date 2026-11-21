// Private, source-bound team status. This view never triggers an agent or rig action.
const MAX_SOURCE_AGE=120000,MAX_CHECK_AGE=180000;
const ROLES=[{id:'mwd',name:'MWD',role:'Telemetry and survey quality'},{id:'steve',name:'Steve',role:'DD supervisor'},{id:'geosteering',name:'Geosteering',role:'Geosteering bot'}];
const STATES=new Set(['checking','reviewing','watching','waiting-inputs','stale','error','paused']);
const LABELS={checking:'Checking',reviewing:'Reviewing',watching:'Watching','waiting-inputs':'Needs inputs',stale:'Stale source',error:'Review unavailable',paused:'Paused',unavailable:'Unavailable'};
const stamp=value=>typeof value==='string'&&value.trim()?Date.parse(value):NaN;
const clean=value=>typeof value==='string'?value.slice(0,900):'';
const scopeKeys=['account_id','server_id','well_uid','wellbore_uid'];
const validScope=s=>s&&scopeKeys.every(k=>typeof s[k]==='string'&&s[k].trim());
const recent=(at,now,max)=>Number.isFinite(at)&&now>=at&&now-at<=max;
function matches(team,policy,context){
 const s=team?.scope,p=policy?.scope;
 return validScope(s)&&validScope(p)&&scopeKeys.every(k=>s[k]===p[k])&&s.well_uid===context?.wellUid&&s.wellbore_uid===context?.wellboreUid&&(!context.serverId||s.server_id===context.serverId)&&(!context.accountId||s.account_id===context.accountId);
}
export function agentTeamState(policy,context,now=Date.now()){
 const team=policy?.agent_team;
 const unavailable=reason=>({state:'unavailable',note:reason,roles:ROLES.map(r=>({...r,state:'unavailable',label:LABELS.unavailable,summary:reason,missing:[],source_at:null,last_checked_at:null,last_model_at:null,decision_id:null}))});
 if(!context?.signed)return unavailable('Sign in to see this well’s shadow team.');
 if(team?.version!==1||team.mode!=='read-only-shadow'||team.rig_controls!==false||!matches(team,policy,context))return unavailable('No verified team status for this source and wellbore.');
 const expiry=stamp(team.expires_at),source=stamp(team.source_at);
 if(!Number.isFinite(expiry))return unavailable('Team monitoring expiry is unavailable.');
 const paused=team.enabled!==true||now>=expiry||context.historical===true;
 const raw=Array.isArray(team.roles)?team.roles:[];
 const roles=ROLES.map(def=>{
  const matches=raw.filter(r=>r?.id===def.id),r=matches.length===1?matches[0]:null;
  if(!r)return {...def,state:paused?'paused':'unavailable',label:LABELS[paused?'paused':'unavailable'],summary:'No verified role result in this source context.',missing:[],source_at:null,last_checked_at:null,last_model_at:null,decision_id:null};
  const at=stamp(r.source_at),checked=stamp(r.last_checked_at),model=stamp(r.last_model_at);
  let state=STATES.has(r.state)?r.state:'unavailable';
  if(paused)state='paused';
  else if(!recent(source,now,MAX_SOURCE_AGE)||!recent(at,now,MAX_SOURCE_AGE)||at!==source||!recent(checked,now,MAX_CHECK_AGE))state='stale';
  const summary=clean(r.summary)||'No role finding has been supplied.';
  return {...def,state,label:LABELS[state],summary,missing:(Array.isArray(r.missing)?r.missing:[]).filter(x=>typeof x==='string').slice(0,20).map(clean),source_at:Number.isFinite(at)&&at<=now?r.source_at:null,last_checked_at:Number.isFinite(checked)&&checked<=now?r.last_checked_at:null,last_model_at:Number.isFinite(model)&&model<=now?r.last_model_at:null,decision_id:clean(r.decision_id)||null};
 });
 const state=paused||roles.every(r=>r.state==='paused')?'paused':roles.some(r=>r.state==='stale')?'stale':roles.some(r=>r.state==='error')?'error':roles.some(r=>r.state==='unavailable')?'unavailable':roles.some(r=>['waiting-inputs','paused'].includes(r.state))?'waiting-inputs':roles.some(r=>['checking','reviewing'].includes(r.state))?'reviewing':'watching';
 return {state,roles,source_at:Number.isFinite(source)&&source<=now?team.source_at:null,note:paused?(context.historical?'Historical view · live team status paused.':now>=expiry?'The authorised monitoring period has ended.':'Team monitoring is paused.'):'Steve reviews both specialists. Shadow advice only; no rig controls.'};
}
function age(value,now){const at=stamp(value);if(!Number.isFinite(at)||at>now)return 'unavailable';const secs=Math.floor((now-at)/1000);return secs<60?secs+'s ago':secs<3600?Math.floor(secs/60)+'m ago':Math.floor(secs/3600)+'h ago';}
export function initAgentTeam({host}){
 const box=document.createElement('details');box.id='onAgentTeam';box.className='on-agent-team';box.hidden=true;
 const summary=document.createElement('summary'),title=document.createElement('strong'),chips=document.createElement('span'),detail=document.createElement('div');
 title.textContent='Well team';chips.className='on-team-chips';detail.className='on-team-detail';summary.append(title,chips);box.append(summary,detail);host.append(box);
 let policy=null,context={};
 const el=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
 function paint(){
  box.hidden=!context.signed||!context.wellUid||!context.wellboreUid;
  const now=Date.now(),state=agentTeamState(policy,context,now);box.dataset.state=state.state;chips.replaceChildren();detail.replaceChildren();
  detail.append(el('p',state.note));
  for(const r of state.roles){
   const chip=el('span',r.name+' · '+r.label,'on-team-chip');chip.dataset.teamRole=r.id;chip.dataset.state=r.state;chips.append(chip);
   const row=el('section','');row.dataset.teamDetail=r.id;row.append(el('h4',r.name+' · '+r.role),el('p',r.summary));
   row.append(el('p','Source '+age(r.source_at,now)+' · checked '+age(r.last_checked_at,now),'on-team-meta'));
   row.append(el('p',r.last_model_at?'Last model review '+age(r.last_model_at,now):'Model review has not been verified for this role.','on-team-meta'));
   if(r.missing.length){row.append(el('p','Needed: '+r.missing.join('; ')));}
   if(r.decision_id)row.append(el('p','Decision '+r.decision_id,'on-team-meta'));
   detail.append(row);
  }
 }
 const timer=setInterval(paint,10000);
 return {update(p){policy=p.policy;context=p.context||{};paint();},dispose(){clearInterval(timer);box.remove();}};
}
