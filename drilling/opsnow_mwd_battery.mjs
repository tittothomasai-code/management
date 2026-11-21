// Display-only budget clock. Never measured battery life, a telemetry substitute or a rig input.
const MAX_AGE=180000;
export function batteryBudgetState(policy,context,ageMs,selectedId=null){
 const unknown=reason=>({state:'unavailable',reason});
 if(!context?.signed||context.historical||!policy||policy.scope?.well_uid!==context.wellUid||policy.scope?.wellbore_uid!==context.wellboreUid||context.serverId&&policy.scope.server_id!==context.serverId)return unknown('Select the current signed-in well and wellbore.');
 if(!Number.isFinite(ageMs)||ageMs<0||ageMs>=MAX_AGE)return unknown('Battery estimate is stale. Waiting for a fresh tracking record.');
 const t=policy.mwd_battery_tracking;if(t?.mode!=='assumed-powered-budget'||!['running','stopped'].includes(t.status)||!Array.isArray(t.batteries)||!t.batteries.length||t.batteries.length>8)return unknown(t?.reason||'Run-time tracking is not set for this source.');
 if(!Number.isFinite(Date.parse(t.as_of))||!Number.isFinite(Date.parse(t.started_at))||Date.parse(t.started_at)>Date.parse(t.as_of))return unknown('Tracking time needs review.');
 if(!t.batteries.every(b=>typeof b.id==='string'&&typeof b.serial==='string'&&b.rated_hours===100&&Number.isFinite(b.remaining_budget_hours)&&b.remaining_budget_hours>=0&&b.remaining_budget_hours<=100))return unknown('Battery budget needs review.');
 const b=t.batteries.find(b=>b.id===selectedId)||t.batteries[0],extra=t.status==='running'?ageMs/3600000:0,remaining=Math.max(0,b.remaining_budget_hours-extra);
 return {state:remaining<=0?'exhausted':remaining<=20?'low':t.status==='stopped'?'paused':'estimated',id:b.id,serial:b.serial,remainingHours:remaining,percent:remaining,batteries:t.batteries,tracking:t};
}
const shortHours=h=>{const minutes=Math.max(0,Math.floor(h*60));return Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0')+' m';};
export function initBatteryBar({host,now=()=>performance.now(),setTimer=setInterval,clearTimer=clearInterval}){
 const box=document.createElement('details');box.id='onMwdBattery';box.className='on-mwd-battery';box.hidden=true;
 box.innerHTML='<summary><span aria-hidden="true">▰</span><span>MWD</span><progress max="100" aria-label="MWD battery run-time estimate"></progress><span data-battery-summary>Estimate unavailable</span></summary><div class="on-battery-detail"><label>Battery budget<select aria-label="MWD battery budget"></select></label><p data-battery-note></p><p data-battery-start></p><p data-battery-assumption>Run-time estimate: assumes this pack stays powered while tracking runs. Installation and usage before tracking are unknown. Each pack is separate; their runtimes are not added.</p><p>Measured remaining battery life: unknown.</p></div>';
 host.append(box);const summary=box.querySelector('[data-battery-summary]'),progress=box.querySelector('progress'),select=box.querySelector('select'),note=box.querySelector('[data-battery-note]'),start=box.querySelector('[data-battery-start]');let input={},selectedId=null,scope='',options='';
 function paint(){
  const {policy,context,receivedMono}=input;box.hidden=!context?.signed||!context.wellUid||!context.wellboreUid;
  const state=batteryBudgetState(policy,context,now()-receivedMono,selectedId);box.dataset.state=state.state;
  if(state.state==='unavailable'||box.hidden){progress.hidden=true;progress.removeAttribute('value');summary.textContent='Run estimate unavailable';note.textContent=state.reason||'';start.textContent='';select.replaceChildren();select.disabled=true;selectedId=null;options='';return;}
  selectedId=state.id;const key=JSON.stringify(state.batteries.map(b=>[b.id,b.serial]));if(options!==key){options=key;select.replaceChildren(...state.batteries.map(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.serial;return o;}));}select.disabled=false;select.value=selectedId;
  progress.hidden=false;progress.value=state.percent;summary.textContent=shortHours(state.remainingHours)+' · '+(state.state==='paused'?'paused estimate':state.state==='low'?'low estimate':state.state==='exhausted'?'budget exhausted':'run estimate');note.textContent='Battery '+state.serial+' · 100 h rated · '+state.remainingHours.toFixed(2)+' h estimated budget remaining.';
  start.textContent='Tracking started '+new Date(state.tracking.started_at).toLocaleString('en-AU',{timeZone:'Australia/Brisbane'})+' AEST. '+(state.tracking.status==='stopped'?'Tracking is stopped.':'Tracking continues when this page is closed.');
 }
 select.onchange=()=>{selectedId=select.value;paint();};const timer=setTimer(paint,1000);
 return {update(next){const nextScope=JSON.stringify([next.context?.wellUid,next.context?.wellboreUid,next.context?.serverId||null,next.policy?.scope?.account_id||null]);if(nextScope!==scope){scope=nextScope;selectedId=null;options='';box.open=false;}input=next;paint();},dispose(){clearTimer(timer);box.remove();input={};selectedId=null;}};
}
