// Report guidance is private and bound to exact source IDs. It is never clearance.
const ORIGIN='https://robotyx.systems',MAX_AGE=120000;
const finite=Number.isFinite,key=c=>JSON.stringify([c?.wellUid,c?.wellboreUid,c?.serverId||null]);
const same=(p,c)=>p?.scope?.well_uid===c?.wellUid&&p.scope.wellbore_uid===c?.wellboreUid&&(!c.serverId||p.scope.server_id===c.serverId);
let snapshot=null;
export const watchSnapshot=()=>snapshot;
export function watchState(policy,context,now=Date.now()){
 if(!same(policy,context))return {state:'unavailable',title:'Report watch zones unavailable'};
 const zones=policy.zones||[],bit=context.bit,aligned=policy.depth_reference?.verified===true;
 const active=aligned&&bit?.kind==='reported'&&!bit.clamped&&!bit.depthIndexed&&!context.historical&&finite(bit.v)&&finite(bit.at)&&now-bit.at>=0&&now-bit.at<=MAX_AGE;
 if(!active)return {state:'unverified',title:zones.some(z=>z.classification==='high-risk')?'High-risk interval in report · position unverified':'Report watch points · position unverified',note:!aligned?'Depth reference is not verified.':context.historical?'Historical data.':!finite(bit?.at)||now-bit.at>MAX_AGE?'Current bit depth is unavailable or stale.':'Use a verified reported bit depth.'};
 const depth=z=>z.axis==='tvd'?bit.tvd:bit.v,lo=z=>z.axis==='tvd'?z.from_tvd_m:z.from_md_m,hi=z=>z.axis==='tvd'?z.to_tvd_m:z.to_md_m;
 const within=zones.filter(z=>finite(depth(z))&&depth(z)>=lo(z)&&depth(z)<=hi(z)),ahead=zones.filter(z=>z.axis!=='tvd'&&lo(z)>bit.v&&lo(z)-bit.v<=policy.lookahead_m).sort((a,b)=>lo(a)-lo(b));
 const high=within.find(z=>z.classification==='high-risk');if(high)return {state:'inside',title:'High-risk zone · '+high.label,zone:high};
 if(within.length)return {state:'watch',title:'Report watch point · '+within[0].label,zone:within[0]};
 if(ahead.length)return {state:'approaching',title:'Approaching '+(ahead[0].classification==='high-risk'?'high-risk zone':'report watch point'),zone:ahead[0]};
 if(zones.some(z=>z.axis==='tvd')&&!finite(bit.tvd))return {state:'unverified',title:'TVD watch zones · position unverified',note:'A matching reported TVD is not available. MD is not used as TVD.'};
 return {state:'monitoring',title:'Report watch zones loaded',note:'No current report band is selected. This is not an anti-collision all-clear.'};
}
export function initWatchZones({host,refresh=()=>{}}){
 const box=document.createElement('details');box.id='onWatchZones';box.className='on-watch-zones';box.hidden=true;
 box.innerHTML='<summary><span aria-hidden="true" class="on-watch-dot"></span><span data-watch-title>Report watch zones</span><span data-watch-band></span></summary><div data-watch-detail></div>';
 host.append(box);const title=box.querySelector('[data-watch-title]'),band=box.querySelector('[data-watch-band]'),detail=box.querySelector('[data-watch-detail]');
 let context={},policy=null,frame=null,requestId='',scope='',requestedAt=0,receivedAt=0,status='loading',serial=0;
 const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
 function paint(){
  const usable=policy&&Date.now()-receivedAt<180000,s=usable?watchState(policy,context):{state:'unavailable',title:status==='sign-in-required'?'Report watch zones · sign in to Robotyx':status==='loading'?'Loading report watch zones…':'Report watch zones unavailable'};
  box.dataset.state=s.state;title.textContent=s.title;const h=s.zone||(usable?policy.zones.find(z=>z.classification==='high-risk'):null);band.textContent=h?h.axis==='tvd'?`${h.from_tvd_m}–${h.to_tvd_m} m TVD`:`${h.from_md_m}–${h.to_md_m} m MD`:'';detail.replaceChildren();
  if(s.note)detail.append(text('p',s.note));
  if(!usable){const a=text('a','Open Robotyx');a.href=ORIGIN+'/well-folder';a.target='_blank';a.rel='noopener noreferrer';detail.append(a);}
  else{
   detail.append(text('p','Report plan: '+policy.plan_branch+'. Bands and report values are not live clearance.'));
   for(const c of policy.controls||[])detail.append(text('p',c));if(policy.coverage_note)detail.append(text('p',policy.coverage_note));
   const list=document.createElement('details');list.append(text('summary','Watch points and sources'));const ul=document.createElement('ul');for(const z of policy.zones){const range=z.axis==='tvd'?`${z.from_tvd_m}–${z.to_tvd_m} m TVD`:`${z.from_md_m}–${z.to_md_m} m MD`;const li=text('li',`${z.label}: ${range} · ${z.source.name}`);ul.append(li);}list.append(ul);detail.append(list);
  }
  snapshot=usable?{policy,context,state:s}:null;
 }
 function request(){
  if(!context.signed||!context.wellUid||!context.wellboreUid)return;
  if(!frame){frame=document.createElement('iframe');frame.hidden=true;frame.title='Private Robotyx report context';frame.referrerPolicy='no-referrer';frame.src=ORIGIN+'/ops-watch.html';frame.addEventListener('load',()=>{requestedAt=0;request();});host.append(frame);}
  requestId=String(++serial)+'-'+Date.now();requestedAt=Date.now();frame.contentWindow?.postMessage({type:'robotyx-watch-zones:request',id:requestId,context:{well_uid:context.wellUid,wellbore_uid:context.wellboreUid,...context.serverId?{server_id:context.serverId}:{}}},ORIGIN);
 }
 const message=e=>{
  if(e.origin!==ORIGIN||e.source!==frame?.contentWindow)return;
  if(e.data?.type==='robotyx-watch-zones:clear'){policy=null;snapshot=null;status='sign-in-required';paint();refresh();return;}
  if(e.data?.type!=='robotyx-watch-zones:result'||e.data.id!==requestId)return;
  policy=e.data.status==='ok'&&same(e.data.policy,context)?e.data.policy:null;status=e.data.status;receivedAt=Date.now();paint();refresh();
 };addEventListener('message',message);
 return {update(c){const next=key(c);context=c;box.hidden=!c.signed||!c.wellUid||!c.wellboreUid;if(next!==scope){scope=next;policy=null;snapshot=null;receivedAt=0;requestedAt=0;status='loading';}if(box.hidden){policy=null;snapshot=null;requestId='';}else if(Date.now()-requestedAt>60000)request();paint();},dispose(){removeEventListener('message',message);frame?.remove();box.remove();snapshot=null;}};
}
