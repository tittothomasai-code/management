// ddtracks.js (feat/dd-tracks): "track select" for the DD cabin steering exercise (ddrun.js), in the style of a kart-game track select.
// Cups (Rookie / Pro / Expert) of SIM well-plan "tracks". Each card: rotating 3D preview of the well path (one shared 2D projection renderer,
// one rAF loop, only the focused card redraws every frame so phones stay smooth), difficulty stars, error set, best score/time (localStorage),
// lock state. Finish a track with score >= its threshold to unlock the next. Keys: arrows/WASD move, Enter/Space pick, Esc/Backspace back, M mute.
// Gamepad: D-pad / left stick move, A (0) pick, B (1) back. Buttons 8 (Home) and 9 (cabin Start) are NOT used. Phone: swipe left/right/up/down.
// Sound: WebAudio synth only (no audio files), mute saved. Everything is SIM. Never LIVE. No network.
import {CUPS,TRACKS,ERR,ALLF} from './ddtracks_data.js?v=t1';
const $=id=>document.getElementById(id),SK='dw_tracks_v1',MK='dw_tracks_mute';
// ---------- progress ----------
export function load(){try{return JSON.parse(localStorage.getItem(SK))||{best:{}}}catch(e){return {best:{}}}}
function save(s){try{localStorage.setItem(SK,JSON.stringify(s))}catch(e){}}
export function unlocked(t,s=load()){if(t.idx==0)return true;const p=TRACKS[t.idx-1],b=s.best[p.id];return !!(b&&b.score>=p.need)}
export function record(id,score,hours){const s=load(),b=s.best[id];const t=TRACKS.find(x=>x.id==id);if(!t)return null;
 if(!b||score>b.score||(score==b.score&&hours<b.hours))s.best[id]={score,hours:+(+hours).toFixed(2),at:Date.now()};save(s);const nx=TRACKS[t.idx+1];return {best:s.best[id],passed:score>=t.need,next:nx&&unlocked(nx,s)?nx.id:null}}
export function errOverride(t){const keep=new Set(t.errs.flatMap(k=>ERR[k].f)),o={};for(const f of ALLF)if(!keep.has(f))o[f]=0;return o}
// ---------- sound ----------
let AC=null,muted=(()=>{try{return localStorage.getItem(MK)=='1'}catch(e){return false}})();
function tone(f,d=0.08,type='square',v=0.06,at=0){if(muted)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const t=AC.currentTime+at,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+d+0.02)}catch(e){}}
export const sfx={move:()=>tone(660,0.05),cup:()=>{tone(440,0.06);tone(660,0.06,'square',0.05,0.06)},pick:()=>{tone(523,0.07);tone(784,0.1,'square',0.06,0.07)},back:()=>tone(330,0.08,'triangle'),
 lock:()=>tone(140,0.18,'sawtooth',0.05),go:()=>{[0,0.35,0.7].forEach(a=>tone(440,0.15,'square',0.06,a));tone(880,0.35,'square',0.07,1.05)},win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,0.12,'square',0.06,i*0.1))};
export function setMute(m){muted=!!m;try{localStorage.setItem(MK,muted?'1':'0')}catch(e){}const b=$('dtMute');if(b)b.textContent=muted?'🔇':'🔊'}
// ---------- UI ----------
const ST={el:null,cup:0,ti:0,focus:'grid',ang:0,raf:0,frame:0,pad:{prev:[],ax:0,t:0},touch:null,busy:false,watch:0};
const CSS=`#ddTracks{position:fixed!important;inset:0!important;z-index:100010!important;width:auto!important;height:auto!important;max-height:none!important;transform:none!important;background:radial-gradient(circle at 50% 20%,#1d3352,#070c14 70%);color:#e8f0ff;font:14px system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden;touch-action:none;user-select:none}
#ddTracks header{display:flex;align-items:center;gap:8px;padding:10px 12px}#ddTracks h1{font:800 20px system-ui;margin:0;flex:1;letter-spacing:.5px;text-shadow:0 2px 0 #c33}
#ddTracks .tag{background:#2a4a2a;color:#bfe9bf;border-radius:4px;padding:1px 6px;font-size:11px}#ddTracks button{font:inherit;color:inherit;background:#22344c;border:1px solid #456;border-radius:8px;padding:6px 10px;cursor:pointer}
#dtCups{display:flex;gap:6px;justify-content:center;padding:0 8px 8px}#dtCups .cp{padding:6px 12px;border-radius:18px;background:#16243a;border:2px solid #2c4060;font-weight:700;transition:transform .2s,background .2s}
#dtCups .cp.on{background:#c8961e;color:#1a1200;border-color:#ffd65a;transform:scale(1.08)}
#dtGrid{flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:6px 18px;align-content:start;transition:transform .28s ease,opacity .28s ease}
#dtGrid.out-l{transform:translateX(-60px);opacity:0}#dtGrid.out-r{transform:translateX(60px);opacity:0}
#ddTracks .card{position:relative;background:linear-gradient(#18283e,#101a2a);border:3px solid #2a3c58;border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:4px;transition:transform .18s,border-color .18s,box-shadow .18s}
#ddTracks .card.sel{border-color:#ffd65a;transform:translateY(-4px) scale(1.03);box-shadow:0 0 22px #ffd65a66}#ddTracks .card canvas{width:100%;aspect-ratio:4/3;background:#060b12;border-radius:8px}
#ddTracks .card h3{margin:0;font:800 16px system-ui}#ddTracks .stars{color:#ffd65a;letter-spacing:2px}#ddTracks .stars i{color:#4a5468;font-style:normal}#ddTracks .errs{font-size:11px;color:#bcd;min-height:28px}
#ddTracks .best{font:12px ui-monospace,monospace;color:#9fe0a8}#ddTracks .card.lock canvas,#ddTracks .card.lock .errs{filter:grayscale(1) brightness(.45)}
#ddTracks .lk{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;font-size:44px;background:#0008;border-radius:11px;pointer-events:none}#ddTracks .lk small{font-size:12px;color:#ddd;padding:0 10px;text-align:center}
#dtFoot{display:flex;gap:10px;align-items:center;justify-content:center;padding:10px 12px 14px}#ddTracks #dtStart{font:900 26px system-ui;padding:12px 44px;border-radius:40px;background:linear-gradient(#ff5a3c,#c62a12);border:3px solid #ffd65a;box-shadow:0 4px 0 #7a1a08;letter-spacing:2px}
#ddTracks #dtStart.f{outline:4px solid #fff;animation:dtP .7s infinite alternate}#dtStart:disabled{filter:grayscale(1);opacity:.6}@keyframes dtP{to{transform:scale(1.06)}}
#dtInfo{font-size:12px;color:#bcd;text-align:center;padding:0 12px}#dtHelp{font-size:11px;color:#89a;text-align:center;padding-bottom:6px}
#dtFx{position:fixed!important;inset:0!important;z-index:100011!important;display:none;align-items:center;justify-content:center;flex-direction:column;background:repeating-conic-gradient(#000 0 25%,#fff 0 50%) 0 0/60px 60px;animation:dtFl 1.4s linear forwards}
#dtFx b{font:900 72px system-ui;color:#ffd65a;text-shadow:0 4px 0 #c33,0 0 30px #000;background:#000a;padding:6px 30px;border-radius:20px}#dtFx small{color:#fff;background:#000a;padding:4px 12px;border-radius:8px;margin-top:8px}
@keyframes dtFl{0%{opacity:0;transform:scale(1.4)}15%{opacity:1;transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:scale(.9)}}
#dtToast{position:fixed!important;left:50%;top:70px;transform:translateX(-50%);z-index:100012!important;background:#163a22;border:2px solid #7ee08a;border-radius:12px;padding:10px 16px;font-weight:700;color:#eaffea;max-width:92vw}
@media(max-width:820px){#dtGrid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding:6px 12%}#ddTracks .card{flex:0 0 76%;scroll-snap-align:center;align-self:flex-start}#ddTracks #dtStart{font-size:22px;padding:12px 34px}#ddTracks h1{font-size:17px}}`;
function css(){if($('ddTracksCss'))return;const s=document.createElement('style');s.id='ddTracksCss';s.textContent=CSS;document.head.appendChild(s)}
const stars=n=>'★'.repeat(n)+'<i>'+'★'.repeat(5-n)+'</i>';
function cur(){return CUPS[ST.cup].tracks[ST.ti]}
function build(){const e=document.createElement('section');e.id='ddTracks'/* section, not div: mobile.js leaves it alone */;e.setAttribute('role','dialog');e.setAttribute('aria-label','Track select');
 e.innerHTML=`<header><button id="dtBack" aria-label="Back">←</button><h1>🏁 Choose your track</h1><span class="tag">SIM</span><button id="dtMute" aria-label="Mute">${muted?'🔇':'🔊'}</button></header>
 <div id="dtCups">${CUPS.map((c,i)=>`<button class="cp" data-c="${i}">${c.icon} ${c.name}</button>`).join('')}</div><div id="dtGrid"></div><div id="dtInfo"></div>
 <div id="dtFoot"><button id="dtStart">START</button></div><div id="dtHelp">←→ track · ↑↓ cup · Enter / A pick · Esc / B back · M mute · swipe on phone</div>`;
 document.body.appendChild(e);ST.el=e;
 e.querySelector('#dtBack').onclick=back;e.querySelector('#dtMute').onclick=()=>setMute(!muted);e.querySelector('#dtStart').onclick=()=>go();
 e.querySelectorAll('.cp').forEach(b=>b.onclick=()=>setCup(+b.dataset.c));
 const sw0=(x,y)=>{ST.touch={x,y}},sw1=(x,y)=>{const s=ST.touch;ST.touch=null;if(!s)return;const dx=x-s.x,dy=y-s.y;if(Math.max(Math.abs(dx),Math.abs(dy))<40)return;ST.swiped=performance.now();if(Math.abs(dx)>Math.abs(dy))move(dx<0?1:-1,0);else move(0,dy<0?1:-1)};
 e.addEventListener('pointerdown',t=>{if(t.pointerType!='touch')sw0(t.clientX,t.clientY)});e.addEventListener('pointerup',t=>{if(t.pointerType!='touch')sw1(t.clientX,t.clientY)});
 e.addEventListener('touchstart',t=>sw0(t.touches[0].clientX,t.touches[0].clientY),{passive:true});e.addEventListener('touchend',t=>sw1(t.changedTouches[0].clientX,t.changedTouches[0].clientY),{passive:true});grid()}
function grid(dir=0){const g=ST.el.querySelector('#dtGrid'),s=load(),c=CUPS[ST.cup];
 const paint=()=>{g.innerHTML=c.tracks.map((t,i)=>{const L=!unlocked(t,s),b=s.best[t.id];return `<div class="card${i==ST.ti?' sel':''}${L?' lock':''}" data-i="${i}" data-id="${t.id}" data-locked="${L}">
  <canvas width="240" height="180"></canvas><h3>${t.name}</h3><div class="stars" aria-label="${t.stars} of 5 stars">${stars(t.stars)}</div>
  <div class="errs">${t.errs.length?t.errs.map(k=>ERR[k].name).join(' · '):'No injected errors'}</div><div class="best">${b?`Best ${b.score}/100 · ${b.hours} h`:'Best —'}</div>
  ${L?`<div class="lk">🔒<small>Score ${TRACKS[t.idx-1].need}+ on ${TRACKS[t.idx-1].name} to unlock</small></div>`:''}</div>`}).join('');
  g.querySelectorAll('.card').forEach(d=>d.onclick=()=>{if(performance.now()-(ST.swiped||0)<300)return;const i=+d.dataset.i;if(i==ST.ti)pick();else{ST.ti=i;ST.focus='grid';sfx.move();sel()}});sel()};
 if(dir){g.classList.add(dir>0?'out-l':'out-r');setTimeout(()=>{paint();g.classList.remove('out-l','out-r')},200)}else paint();
 ST.el.querySelectorAll('.cp').forEach((b,i)=>b.classList.toggle('on',i==ST.cup))}
function sel(){const g=ST.el.querySelector('#dtGrid'),t=cur(),L=!unlocked(t);g.querySelectorAll('.card').forEach((d,i)=>d.classList.toggle('sel',i==ST.ti));
 const c=g.querySelector('.card.sel');if(c&&g.scrollWidth>g.clientWidth)c.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});
 const st=$('dtStart');st.disabled=L;st.classList.toggle('f',ST.focus=='start');
 $('dtInfo').textContent=`${t.name}: ${t.note} TD ${t.td} m · ${t.diff} · pass score ${t.need}${L?' · LOCKED':''} (SIM)`;ST.frame=0}
function setCup(i,dir){i=(i+CUPS.length)%CUPS.length;if(i==ST.cup)return;const d=dir??(i>ST.cup?1:-1);ST.cup=i;ST.ti=Math.min(ST.ti,CUPS[i].tracks.length-1);ST.focus='grid';sfx.cup();grid(d)}
export function move(dx,dy){if(!ST.el||ST.busy)return;if(dy){if(ST.focus=='start'&&dy<0){ST.focus='grid';sfx.move();sel();return}setCup(ST.cup+dy,dy);return}
 if(ST.focus=='start')ST.focus='grid';const n=CUPS[ST.cup].tracks.length,i=ST.ti+dx;if(i<0)setCup(ST.cup-1,-1),ST.ti=CUPS[ST.cup].tracks.length-1,sel();else if(i>=n){setCup(ST.cup+1,1);ST.ti=0;sel()}else{ST.ti=i;sfx.move();sel()}}
export function pick(){if(!ST.el||ST.busy)return;const t=cur();if(!unlocked(t)){sfx.lock();const c=ST.el.querySelector('.card.sel');c?.animate?.([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'none'}],{duration:220});return false}
 if(ST.focus=='start')return go();ST.focus='start';sfx.pick();sel();$('dtStart').focus?.();return true}
export function back(){if(!ST.el||ST.busy)return;if(ST.focus=='start'){ST.focus='grid';sfx.back();sel();return}sfx.back();close()}
// draw the well path of track t into canvas cv, rotated by angle a (simple orthographic 3D, tilted 25°)
export function drawPath(cv,t,a){const x=cv.getContext('2d'),W=cv.width,H=cv.height;x.clearRect(0,0,W,H);const ca=Math.cos(a),sa=Math.sin(a),tl=0.42,
 pr=p=>{const u=p.E*ca-p.N*sa,w=p.E*sa+p.N*ca;return [u,p.tvd*Math.cos(tl)+w*Math.sin(tl)]},pts=t.plan.map(pr),r=t._r||(t._r=Math.max(...t.plan.map(p=>Math.hypot(p.E,p.N)))),
 ys=pts.map(q=>q[1]),y0=Math.min(...ys)-r*Math.sin(tl),y1=Math.max(...ys)+r*Math.sin(tl),k=Math.min((W-24)/(2*r||1),(H-26)/(y1-y0||1)),X=q=>W/2+q[0]*k,Y=q=>12+(q[1]-y0)*k;
 x.strokeStyle='#22364f';x.lineWidth=1;x.beginPath();x.ellipse(W/2,Y([0,0]),r*k,r*k*Math.sin(tl),0,0,7);x.stroke();
 const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#6aa9ff');g.addColorStop(1,'#ffb347');x.strokeStyle=g;x.lineWidth=3;x.lineCap='round';x.beginPath();pts.forEach(q=>x.lineTo(X(q),Y(q)));x.stroke();
 x.font='bold 10px system-ui';for(const m of t.marks){const p=t.plan.find(q=>q.md>=m.md)||t.plan.at(-1),q=pr(p);x.fillStyle='#ffd65a';x.beginPath();x.arc(X(q),Y(q),3.5,0,7);x.fill();x.fillStyle='#dfe9ff';x.fillText(m.label,X(q)+5,Y(q)-4)}
 x.fillStyle='#7f93ad';x.font='10px system-ui';x.fillText('SIM plan',6,H-6)}
function loop(){ST.raf=requestAnimationFrame(loop);if(!ST.el)return;ST.ang+=0.012;ST.frame++;const cs=ST.el.querySelectorAll('.card');
 cs.forEach((d,i)=>{if(i==ST.ti||ST.frame%20==1){const t=CUPS[ST.cup].tracks[i];if(t)drawPath(d.querySelector('canvas'),t,i==ST.ti?ST.ang:0.6+i)}})}
function key(e){if(!ST.el||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;const k=e.key;let h=true;
 if(k=='ArrowLeft'||k=='a'||k=='A')move(-1,0);else if(k=='ArrowRight'||k=='d'||k=='D')move(1,0);else if(k=='ArrowUp'||k=='w'||k=='W')move(0,-1);else if(k=='ArrowDown'||k=='s'||k=='S')move(0,1);
 else if(k=='Enter'||k==' ')pick();else if(k=='Escape'||k=='Backspace')back();else if(k=='m'||k=='M')setMute(!muted);else h=false;if(h){e.preventDefault();e.stopImmediatePropagation()}}
function pollPad(){if(!ST.el)return;const g=(navigator.getGamepads?.()||[]).find(x=>x);if(!g)return;const P=ST.pad,b=i=>!!g.buttons[i]?.pressed,ed=i=>b(i)&&!P.prev[i];
 if(ed(14))move(-1,0);if(ed(15))move(1,0);if(ed(12))move(0,-1);if(ed(13))move(0,1);if(ed(0))pick();if(ed(1))back();
 const ax=g.axes||[],hx=Math.abs(ax[0]||0)>0.6?Math.sign(ax[0]):0,hy=Math.abs(ax[1]||0)>0.6?Math.sign(ax[1]):0,a=hx||hy?(hx?'x'+hx:'y'+hy):0,t=performance.now();
 if(a&&(a!==P.ax||t-P.t>350)){P.t=t;hx?move(hx,0):move(0,hy)}P.ax=a;P.prev=g.buttons.map(x=>x.pressed)}
export function isOpen(){return !!ST.el}
export function open(o={}){css();if(!ST.el){build();addEventListener('keydown',key,true);ST.pad.prev=((navigator.getGamepads?.()||[]).find(x=>x)?.buttons||[]).map(x=>x.pressed)}
 if(o.track){const t=TRACKS.find(x=>x.id==o.track);if(t){ST.cup=t.ci;ST.ti=t.ti}}else{const s=load(),last=[...TRACKS].reverse().find(t=>unlocked(t,s));if(last){ST.cup=last.ci;ST.ti=last.ti}}grid();if(!ST.raf)loop();if(!ST.piv)ST.piv=setInterval(pollPad,40);watch();return API}
export function close(){if(ST.el){ST.el.remove();ST.el=null}removeEventListener('keydown',key,true);cancelAnimationFrame(ST.raf);ST.raf=0;clearInterval(ST.piv);ST.piv=0;ST.focus='grid'}
async function cabin(){if(!globalThis.GX?.ddrun||!document.getElementById('ddc')||document.getElementById('ddc').style.display=='none'){const m=await import('./ddcab.js?v=r1');m.open()}
 const t0=performance.now();while(!globalThis.GX?.ddrun?.mount&&performance.now()-t0<20000)await new Promise(r=>setTimeout(r,100));return globalThis.GX?.ddrun}
// load track t into the cabin steering run (ddrun reset hook: plan / error override / track id)
export async function launch(id,{autostart=true}={}){const t=TRACKS.find(x=>x.id==id)||cur();if(!unlocked(t))return null;const D=await cabin();if(!D)throw new Error('ddrun not ready');
 const r=D.reset({scen:'build',diff:t.diff,seed:100+t.idx*17,plan:t.plan,E:errOverride(t),track:t.id,planName:'Track '+t.name+' (SIM)'});r.log.push(`Track ${t.name}: ${t.errs.map(k=>ERR[k].name).join(', ')||'no errors'} · ${t.diff} (SIM).`);
 if(autostart)D.start();tabBtn();watch();return r}
export async function go(){const t=cur();if(ST.busy||!unlocked(t)){sfx.lock();return}ST.busy=true;sfx.go();let fx=$('dtFx');if(!fx){fx=document.createElement('section');fx.id='dtFx';document.body.appendChild(fx)}
 fx.innerHTML=`<b>3</b><small>${t.name} · ${'★'.repeat(t.stars)} · SIM</small>`;fx.style.display='flex';const B=fx.querySelector('b');[['2',350],['1',700],['GO!',1050]].forEach(([s,ms])=>setTimeout(()=>B.textContent=s,ms));
 await new Promise(r=>setTimeout(r,1400));fx.style.display='none';ST.busy=false;close();return launch(t.id)}
// "🏁 Tracks" button in the cabin run bar (injected; no ddrun edit)
function tabBtn(){const g=$('drGo');if(!g||$('drTracks'))return;const b=document.createElement('button');b.id='drTracks';b.textContent='🏁 Tracks';b.onclick=()=>{GX.ddrun?.pause?.();open({track:GX.ddrun?.run?.track})};g.parentNode.insertBefore(b,g)}
function toast(s){let e=$('dtToast');if(!e){e=document.createElement('section');e.id='dtToast';document.body.appendChild(e)}e.textContent=s;e.hidden=false;clearTimeout(e._t);e._t=setTimeout(()=>e.hidden=true,6000)}
// watch the cabin run: at TD, save best score/time and unlock the next track
export function check(){const D=globalThis.GX?.ddrun,r=D?.run;tabBtn();if(!r?.track||!r.done||r._tk)return null;r._tk=1;const sc=D.score(r),res=record(r.track,sc.score,r.hours);if(!res)return null;
 const t=TRACKS.find(x=>x.id==r.track);r.log.push(`Track ${t.name} done: score ${sc.score} (best ${res.best.score}).`+(res.passed?' Passed.':' Need '+t.need+' to pass.'));
 if(res.passed)sfx.win();toast(`🏁 ${t.name}: score ${sc.score}/100${res.passed?(res.next?' · next track unlocked!':' · passed!'):' · need '+t.need+' to unlock the next track'} (SIM)`);return res}
function watch(){if(!ST.watch)ST.watch=setInterval(check,500)}
const API={open,close,isOpen,move,pick,back,go,launch,check,load,record,unlocked,errOverride,setMute,get muted(){return muted},get state(){return {frame:ST.frame,raf:ST.raf,cup:ST.cup,ti:ST.ti,focus:ST.focus,track:cur().id}},CUPS,TRACKS,drawPath,src:'SIM'};
if(typeof window!='undefined'){window.GX=window.GX||{};GX.ddtracks=API;watch()}
export default API;
