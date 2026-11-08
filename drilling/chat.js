// chat.js v5.6: session chat UI, LOCAL ONLY (no backend). Messages kept on this device, keyed per player session.
// Plug-in seams for later: GX.chat.transport = {send(msg), subscribe(onMsg)} (shared realtime sync);
//                          GX.chat.agents.Steve = async (msg, ctx) => replyText (computer DD server function). Not wired yet.
const $=id=>document.getElementById(id),es=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const C={open:false,msgs:[],transport:null,agents:{},participants:[{name:'Steve',role:'Head DD / Geosteerer',status:'server offline, coming soon; local rules (SIM)'}]};
const key=()=>window.GX?.player?.key?GX.player.key('chat'):'dw_chat';
function load(){try{C.msgs=JSON.parse(localStorage.getItem(key())||'[]')}catch(e){C.msgs=[]}}
function save(){try{localStorage.setItem(key(),JSON.stringify(C.msgs.slice(-500)))}catch(e){}}
const me=()=>window.GX?.player?.get()||'anon';
export const mentions=t=>[...String(t).matchAll(/@([\w.-]+)/g)].map(m=>m[1]);
function add(m){C.msgs.push(m);save();render()}
export async function send(text){text=String(text||'').trim().slice(0,1000);if(!text)return null;
 const m={t:Date.now(),from:me(),text,mentions:mentions(text),local:true};add(m);try{C.transport?.send?.(m)}catch(e){console.error('chat transport',e)}
 if(m.mentions.some(n=>n.toLowerCase()=='steve')){const f=C.agents.Steve;let r='Steve (Head DD / Geosteerer): server is offline, coming soon. Local rule-based calls (SIM) are posted per joint.';
  if(f){try{r=await f(m,{player:me()})}catch(e){r='Steve is unavailable right now.'}}add({t:Date.now(),from:'Steve',text:r,system:!f})}
 return m}
function render(){const L=$('chatList');if(!L)return;L.innerHTML=C.msgs.map(m=>`<div style="margin:4px 0;${m.system?'opacity:.7;font-style:italic':''}"><b style="color:${m.from=='Steve'?'#e0b050':'#8cf'}">${es(m.from)}</b>${m.from=='Steve'?' <span style="background:#5a4210;color:#ffd98a;border-radius:6px;padding:0 5px;font-size:10px">Head DD / Geosteerer</span>'+(m.sim?' <span style="background:#8a8f98;color:#fff;border-radius:6px;padding:0 4px;font-size:10px">SIM</span>':''):''} <span style="opacity:.5;font-size:10px">${new Date(m.t).toLocaleTimeString('en-AU',{timeZone:'Australia/Brisbane',hour:'2-digit',minute:'2-digit'})}</span><br>${es(m.text).replace(/@([\w.-]+)/g,'<span style="color:#e0b050">@$1</span>')}</div>`).join('');L.scrollTop=1e9;
 const n=$('chatN');if(n)n.textContent=C.msgs.length?' ('+C.msgs.length+')':''}
export function post(text,o={}){add({t:Date.now(),from:'Steve',text,sim:true,...o})}
export function toggle(v){C.open=v??!C.open;const s=$('chatSheet');s.style.height=C.open?'min(46vh,380px)':'34px';$('chatBody').style.display=C.open?'flex':'none';$('chatTab').textContent=(C.open?'▾ Chat':'▴ Chat');render()}
export function init(){window.GX=window.GX||{};GX.chat={C,send,post,toggle,mentions,get transport(){return C.transport},set transport(t){C.transport=t;t?.subscribe?.(m=>add({...m,local:false}))},agents:C.agents};
 load();const s=document.createElement('div');s.id='chatSheet';
 s.style.cssText='position:fixed;left:8px;bottom:calc(64px + env(safe-area-inset-bottom));width:min(360px,calc(100vw - 16px));height:34px;z-index:9000;background:rgba(14,22,34,.94);border:1px solid #2a3a50;border-radius:12px;color:#e8eef5;font:13px system-ui;display:flex;flex-direction:column;overflow:hidden;transition:height .2s';
 s.innerHTML=`<div style="display:flex;align-items:center;height:34px;padding:0 10px;cursor:pointer" id=chatHead><b id=chatTab>▴ Chat</b><span id=chatN></span><span style="margin-left:auto;font-size:11px;opacity:.7">local only · Steve: server offline, coming soon</span></div>
 <div id=chatBody style="display:none;flex:1;flex-direction:column;min-height:0"><div id=chatList style="flex:1;overflow:auto;padding:0 10px"></div>
 <form id=chatForm style="display:flex;gap:6px;padding:6px"><input id=chatIn placeholder="Message… @Steve" style="flex:1;font-size:16px;padding:6px;border-radius:8px;border:1px solid #456;background:#0b1320;color:#fff"><button style="padding:6px 12px">Send</button></form></div>`;
 document.body.appendChild(s);$('chatHead').onclick=()=>toggle();$('chatForm').onsubmit=e=>{e.preventDefault();send($('chatIn').value);$('chatIn').value=''};
 $('chatIn').oninput=e=>{const v=e.target.value;if(/@$/.test(v))e.target.value=v+'Steve '};
 GX.player?.onChange?.(()=>{load();render()});render()}
