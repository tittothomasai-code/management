// player.js v5.6: name-only player identity (NO auth, NO password, NO backend). Stored on this device only.
// Sync seam: GX.player.sync = {push(kind, record)} may be plugged in later (e.g. shared leaderboard); default is a no-op local store.
const K='dw_player',$=id=>document.getElementById(id);
const P={name:'',listeners:[],sync:null};
const clean=s=>String(s||'').replace(/[<>"'`]/g,'').trim().slice(0,32);
P.get=()=>P.name;
P.set=n=>{n=clean(n);if(!n)return false;P.name=n;try{setTimeout(()=>dispatchEvent(new CustomEvent('dw:player',{detail:n})),0)}catch(e){}try{localStorage.setItem(K,n);const L=JSON.parse(localStorage.getItem(K+'s')||'[]');if(!L.includes(n))L.push(n);localStorage.setItem(K+'s',JSON.stringify(L.slice(-20)))}catch(e){}badge();for(const f of P.listeners)try{f(n)}catch(e){console.error(e)}return true};
P.list=()=>{try{return JSON.parse(localStorage.getItem(K+'s')||'[]')}catch(e){return[]}};
P.onChange=f=>P.listeners.push(f);
P.key=k=>'dw_p:'+(P.name||'anon')+':'+k;               // per-player storage key
P.stamp=o=>({...o,player:P.name||'anon'});
// record(kind, rec): append a stamped record to this player's local store, then hand to the sync layer if one is plugged in
P.record=(kind,rec)=>{const r=P.stamp({t:Date.now(),...rec});try{const k=P.key('rec:'+kind),A=JSON.parse(localStorage.getItem(k)||'[]');A.push(r);localStorage.setItem(k,JSON.stringify(A.slice(-5000)))}catch(e){}try{P.sync?.push?.(kind,r)}catch(e){console.error('sync',e)}return r};
P.records=kind=>{try{return JSON.parse(localStorage.getItem(P.key('rec:'+kind))||'[]')}catch(e){return[]}};
function badge(){let b=$('plBadge');if(!b){const h=$('hud');if(!h)return;b=document.createElement('span');b.id='plBadge';b.style.cssText='padding:2px 8px;border-radius:10px;background:#20324a;color:#cfe;font:12px system-ui;margin:2px';h.prepend(b)}b.textContent='👤 '+(P.name||'—')}
export const inviteCode=()=>{const q=new URLSearchParams(location.search);return String(q.get('s')||q.get('session')||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)};
export function join(force){const inv=inviteCode();let d=$('plJoin');if(d)d.remove();d=document.createElement('div');d.id='plJoin';
 d.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(5,10,18,.92);display:flex;align-items:center;justify-content:center;font:15px system-ui;color:#eee';
 const prev=P.list().map(n=>`<button data-n="${n}" style="margin:3px;padding:6px 10px">${n}</button>`).join('');
 d.innerHTML=`<form style="background:#111b29;padding:20px;border-radius:12px;width:min(340px,90vw)"><b style="font-size:18px">Join the drill floor</b><p style="opacity:.75;font-size:13px">Player name only, no password. Saved on this device.</p>
 <input id=plName maxlength=32 autocomplete=nickname placeholder="Your name" value="${P.name}" style="width:100%;box-sizing:border-box;font-size:17px;padding:10px;border-radius:8px;border:1px solid #456;background:#0b1320;color:#fff">
 ${inv?`<div id=plInvite style="margin:8px 0;padding:8px;border-radius:8px;background:#0b2a18;border:1px solid #2ecc71;font-size:14px">Invited to session <input id=plCode maxlength=8 value="${inv}" style="width:90px;font-size:16px;text-transform:uppercase;background:#0b1320;color:#fff;border:1px solid #456;border-radius:6px;padding:4px"><br><span style="opacity:.75;font-size:12px">Enter your name and tap Start to join.</span></div>`:''}<div style="margin:8px 0">${prev}</div><button type=submit style="width:100%;padding:10px;font-size:16px;background:#2f7fd0;color:#fff;border:0;border-radius:8px">Start</button></form>`;
 document.body.appendChild(d);d.querySelector('form').onsubmit=e=>{e.preventDefault();const c=$('plCode');if(c)P.invite=String(c.value).trim().toUpperCase();if(P.set($('plName').value))d.remove()};
 for(const b of d.querySelectorAll('[data-n]'))b.onclick=e=>{e.preventDefault();P.set(b.dataset.n);d.remove()}}
export function init(){window.GX=window.GX||{};GX.player=P;let n='';try{n=localStorage.getItem(K)||''}catch(e){}
 const q=new URLSearchParams(location.search);if(q.get('player'))n=clean(q.get('player'));
 if(!n&&navigator.webdriver&&!q.has('join')&&!inviteCode())n='TEST player';  // automated tests: no modal unless ?join
 if(n)P.set(n);badge();const h=$('hud');if(h){const b=document.createElement('button');b.id='btnPlayer';b.textContent='👤 Switch player';b.onclick=()=>join(true);h.appendChild(b)}
 if(!P.name&&!q.has('operations'))join()}
