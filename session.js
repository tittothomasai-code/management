// session.js v5.7.1: shared session (opt-in). Reads ONLY via code-scoped RPCs (get_session/get_players/get_messages/get_decisions/get_leaderboard).
// Chat: poll get_messages(since_id) every 2.5 s; Realtime broadcast 'drill:<code>' + presence is a bonus, de-duplicated by message id.
// Plugs into GX.chat.transport and GX.player.sync. No network at all until a session is created or joined. Public publishable key only.
const URL_='https://kxwuaasuaskfyecjmuwa.supabase.co',KEY='sb_publishable_3aHrusZxmxiDazzTLD7fqQ_aNzifAIe',$=id=>document.getElementById(id);
const es=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S={code:null,since:0,seen:new Set(),subs:[],timer:null,ws:null,online:[],players:[],board:[],status:'off'};
async function rpc(fn,args){const r=await fetch(URL_+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json','Content-Profile':'drill_game','Accept-Profile':'drill_game'},body:JSON.stringify(args)});
 const t=await r.text();if(!r.ok)throw new Error(fn+' '+r.status+' '+(JSON.parse(t||'{}').message||''));return t?JSON.parse(t):null}
const tok=()=>{let t=localStorage.getItem('dw_sess_tok');if(!/^[0-9a-f]{64}$/.test(t||'')){t=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem('dw_sess_tok',t)}return t};
const me=()=>window.GX?.player?.get()||'anon';
function deliver(m){if(m.id==null||S.seen.has(m.id))return;S.seen.add(m.id);if(m.id>S.since)S.since=m.id;
 const mine=m.author_kind=='player'&&m.player_name==me();if(mine)return;
 const steve=m.author_kind!='player';for(const f of S.subs)f({id:m.id,t:Date.parse(m.created_at)||Date.now(),from:steve?'Steve':m.player_name,text:m.body,sim:steve&&!!(m.meta?.sim??true),shared:true})}
async function poll(){if(!S.code)return;try{const rows=await rpc('get_messages',{p_code:S.code,p_since_id:S.since,p_limit:100});for(const m of rows)deliver(m);S.status='on'}catch(e){S.status='error';console.warn('session poll',e.message)}render()}
async function refresh(){if(!S.code)return;try{S.players=await rpc('get_players',{p_code:S.code});S.board=await rpc('get_leaderboard',{p_code:S.code})}catch(e){console.warn('session refresh',e.message)}render()}
function rt(){try{S.ws?.close()}catch(e){}const ws=new WebSocket(URL_.replace('https','wss')+'/realtime/v1/websocket?apikey='+KEY+'&vsn=1.0.0');S.ws=ws;let ref=1,hb;
 const topic='realtime:drill:'+S.code,send=(event,payload,t=topic)=>ws.readyState==1&&ws.send(JSON.stringify({topic:t,event,payload,ref:String(ref++)}));
 ws.onopen=()=>{send('phx_join',{config:{broadcast:{self:false},presence:{key:me()},private:false}});hb=setInterval(()=>send('heartbeat',{},'phoenix'),25000);setTimeout(()=>send('presence',{type:'presence',event:'track',payload:{name:me()}}),500)};
 ws.onmessage=e=>{let x;try{x=JSON.parse(e.data)}catch(_){return}if(x.topic!=topic)return;
  if(x.event=='broadcast'){const p=x.payload||{};if(p.event=='messages_insert')deliver(p.payload);else refresh()}
  else if(x.event=='presence_state'){S.online=Object.keys(x.payload||{});render()}
  else if(x.event=='presence_diff'){const d=x.payload||{};S.online=[...new Set([...S.online,...Object.keys(d.joins||{})])].filter(n=>!(n in (d.leaves||{})));render()}};
 ws.onclose=()=>{clearInterval(hb);if(S.ws===ws&&S.code)setTimeout(()=>S.code&&S.ws===ws&&rt(),5000)}}
async function start(code){S.code=code;S.since=0;S.seen.clear();S.sent=new Set();localStorage.setItem('dw_sess_code',code);clearInterval(S.timer);S.timer=setInterval(poll,2500);
 if(window.GX?.chat)GX.chat.transport=transport;await poll();await refresh();try{rt()}catch(e){}render()}
export async function create(title){const c=await rpc('create_session',{p_title:String(title||'Drill floor').slice(0,80),p_host:me(),p_token:tok(),p_source:'SIM'});await start(c);return c}
export async function join(code){code=String(code).trim().toUpperCase();await rpc('join_session',{p_code:code,p_name:me(),p_token:tok()});await start(code);return code}
export function leave(){S.code=null;clearInterval(S.timer);try{S.ws?.close()}catch(e){}S.ws=null;localStorage.removeItem('dw_sess_code');if(window.GX?.chat)GX.chat.transport=null;render()}
const transport={send:async m=>{if(!S.code)return;const id=await rpc('post_message',{p_code:S.code,p_name:me(),p_token:tok(),p_body:m.text});S.sent.add(id)},subscribe:f=>{S.subs=[f]}};
const sync={push:async(kind,r)=>{if(!S.code)return;const a={p_code:S.code,p_name:me(),p_token:tok()};
 if(kind=='score')await rpc('post_score',{...a,p_well:r.well||'SIM well',p_score:r.score,p_breakdown:r.breakdown||{},p_joints:r.joints||0});
 else if(kind=='decision')await rpc('post_decision',{...a,p_d:{data_tag:'SIM',...r}});refresh()}};
function render(){const b=$('sessBtn');if(b)b.textContent=S.code?'👥 '+S.code:'👥 Session';const P=$('sessPanel');if(!P||P.style.display=='none')return;
 P.querySelector('#sessBody').innerHTML=S.code?`<div>Session <b id=sessCode>${es(S.code)}</b> · ${S.status=='error'?'⚠ offline, retrying':'shared (SIM)'}</div>
  <div style="margin-top:6px"><b>Players</b><ul id=sessPlayers style="margin:2px 0;padding-left:18px">${S.players.map(p=>`<li>${es(p.player_name)}${S.online.includes(p.player_name)?' 🟢':''}</li>`).join('')}</ul></div>
  <div><b>Leaderboard</b><table id=sessBoard style="width:100%;font-size:12px">${S.board.length?S.board.map((r,i)=>`<tr><td>${i+1}</td><td>${es(r.player_name)}</td><td>${es(r.well_name)}</td><td style="text-align:right">${r.best}</td></tr>`).join(''):'<tr><td style="opacity:.6">no scores yet</td></tr>'}</table></div>
  <button id=sessLeave style="margin-top:6px">Leave session</button>`
 :`<input id=sessCodeIn maxlength=8 placeholder="Code" style="width:90px;font-size:16px;text-transform:uppercase"> <button id=sessJoin>Join</button> <button id=sessNew>New session</button><div style="opacity:.6;font-size:11px;margin-top:4px">Name only, no password. Chat shared with players in the session.</div>`;
 const err=e=>alert('Session: '+e.message);$('sessJoin')&&($('sessJoin').onclick=()=>join($('sessCodeIn').value).catch(err));$('sessNew')&&($('sessNew').onclick=()=>create().catch(err));$('sessLeave')&&($('sessLeave').onclick=leave)}
export function open(v){const P=$('sessPanel');if(!P)return;P.style.display=(v??P.style.display=='none')?'block':'none';if(P.style.display=='block'){refresh();render()}}
export function init(){window.GX=window.GX||{};GX.session={S,create,join,leave,open,rpc,poll,refresh};if(GX.player)GX.player.sync=sync;
 const head=$('chatHead');if(head){const b=document.createElement('button');b.id='sessBtn';b.style.cssText='margin-left:8px;font-size:11px;padding:1px 6px';b.onclick=e=>{e.stopPropagation();open()};head.insertBefore(b,head.children[1]||null)}
 const P=document.createElement('div');P.id='sessPanel';P.style.cssText='display:none;padding:6px 10px;border-bottom:1px solid #2a3a50;font-size:12px';P.innerHTML='<div id=sessBody></div>';$('chatBody')?.prepend(P);
 const q=new URLSearchParams(location.search).get('session')||localStorage.getItem('dw_sess_code');if(q)join(q).catch(e=>{console.warn('session',e.message);localStorage.removeItem('dw_sess_code')});render()}
