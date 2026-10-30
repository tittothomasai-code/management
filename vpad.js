// vpad.js v5.9.5: optional on-screen virtual controls (two joysticks + WOB/RPM/reset/fly-to-bit buttons).
// OFF by default, never auto-shown on touch. Small always-visible toggle (🎮) + Tools ▸ Settings entry; choice and positions persisted in localStorage.
// Feeds the same functions as keyboard/gamepad (input.js): orbit, look, zoom, wob, rpm.
const K='dw_vpad',KP='dw_vpad_pos';const ST={on:false,sticks:{L:[0,0],R:[0,0]},raf:0,last:0};
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
function I(){return window.GX?.input}
function css(){if(document.getElementById('vpcss'))return;const s=document.createElement('style');s.id='vpcss';s.textContent=`
#vpToggle{position:fixed;right:10px;bottom:calc(62px + env(safe-area-inset-bottom));z-index:9650;width:40px;height:40px;border-radius:50%;border:1px solid #4a6a8a;background:#0a1a2a99;color:#cde;font-size:20px;line-height:38px;padding:0;cursor:pointer;opacity:.75}
#vpToggle[aria-pressed=true]{background:#2a5d8acc;border-color:#9cf;opacity:1}body.desk #vpToggle{bottom:14px;right:14px}
#vpad{position:fixed;inset:0;pointer-events:none;z-index:9640}#vpad .vg{position:absolute;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}
#vpad .stk{width:120px;height:120px;border-radius:50%;background:#0a1a2a55;border:2px solid #8ab4d966}#vpad .thumb{position:absolute;left:38px;top:38px;width:44px;height:44px;border-radius:50%;background:#8ab4d999;border:1px solid #cdeaff}
#vpad .grip{position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:12px;color:#9bd;background:#0a1a2a99;border-radius:6px;padding:0 6px;cursor:move;touch-action:none}
#vpad .btns{display:grid;grid-template-columns:repeat(2,58px);gap:6px;padding:6px;border-radius:12px;background:#0a1a2a44}#vpad .btns button{height:40px;border-radius:10px;border:1px solid #8ab4d988;background:#0a1a2a99;color:#e8f4ff;font:600 12px system-ui;touch-action:manipulation}
#vpad .btns button.dn,#vpad .btns button:active{background:#2a5d8acc}#vpad .lbl{position:absolute;bottom:-16px;left:0;right:0;text-align:center;font:10px system-ui;color:#9bd}`;document.head.appendChild(s)}
const DEF={L:[16,-210],R:[-136,-210],B:[-150,-360]};// px from left/top (negative = from right/bottom)
function pos(){let p={};try{p=JSON.parse(ls.get(KP)||'{}')}catch(e){}return {...DEF,...p}}
function place(el,[x,y]){const W=innerWidth,H=innerHeight,w=el.offsetWidth||120,h=el.offsetHeight||120;let L=x<0?W+x:x,T=y<0?H+y:y;L=Math.max(0,Math.min(W-w,L));T=Math.max(16,Math.min(H-h,T));el.style.left=L+'px';el.style.top=T+'px'}
function grip(g,key){const h=g.querySelector('.grip');h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();h.setPointerCapture(e.pointerId);const r=g.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;
 const mv=ev=>place(g,[ev.clientX-ox,ev.clientY-oy]);const up=()=>{h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);const p=pos();p[key]=[parseFloat(g.style.left),parseFloat(g.style.top)];ls.set(KP,JSON.stringify(p))};
 h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up)})}
function stick(id,label){const g=document.createElement('div');g.className='vg stk';g.id=id;g.innerHTML=`<div class=thumb></div><span class=grip>⠿ move</span><span class=lbl>${label}</span>`;const t=g.querySelector('.thumb'),k=id=='vpL'?'L':'R';let pid=null;
 const set=e=>{const r=g.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=(e.clientX-cx)/48,dy=(e.clientY-cy)/48;const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m}ST.sticks[k]=[dx,dy];t.style.transform=`translate(${dx*40}px,${dy*40}px)`};
 g.addEventListener('pointerdown',e=>{if(e.target.classList.contains('grip'))return;e.preventDefault();pid=e.pointerId;g.setPointerCapture(pid);set(e)});
 g.addEventListener('pointermove',e=>{if(e.pointerId===pid)set(e)});const end=e=>{if(e.pointerId!==pid)return;pid=null;ST.sticks[k]=[0,0];t.style.transform=''};g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);return g}
function act(a){const i=I(),s=i?.ST||{};if(a=='wob+')i?.wob(s.wobStep||1);else if(a=='wob-')i?.wob(-(s.wobStep||1));else if(a=='rpm+')i?.rpm(s.rpmStep||10);else if(a=='rpm-')i?.rpm(-(s.rpmStep||10));
 else if(a=='reset'){document.getElementById('cam_orbit')?.click();window.GX?.resetCam?.()}else if(a=='fly')document.getElementById('cam_bit')?.click();ST.lastAct=a}
function build(){css();let o=document.getElementById('vpad');if(o)return o;o=document.createElement('div');o.id='vpad';o.setAttribute('aria-label','On-screen controls');
 const B=document.createElement('div');B.className='vg btns';B.id='vpB';B.innerHTML='<span class=grip>⠿ move</span>'+[['wob+','WOB +'],['wob-','WOB −'],['rpm+','RPM +'],['rpm-','RPM −'],['reset','Reset view'],['fly','Fly to bit']].map(([a,l])=>`<button data-a="${a}">${l}</button>`).join('');
 B.querySelectorAll('button').forEach(b=>{let pd=null;b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pd=e.pointerId;b.classList.add('dn')});b.addEventListener('pointerup',e=>{if(pd!==e.pointerId)return;pd=null;b.classList.remove('dn');e.preventDefault();e.stopPropagation();act(b.dataset.a)});b.addEventListener('pointercancel',()=>{pd=null;b.classList.remove('dn')});b.onclick=e=>{e.stopPropagation();if(e.detail===0)act(b.dataset.a)}});
 const L=stick('vpL','orbit'),R=stick('vpR','look ↔ · zoom ↕');o.append(L,R,B);document.body.appendChild(o);const P=pos();place(L,P.L);place(R,P.R);place(B,P.B);grip(L,'L');grip(R,'R');grip(B,'B');
 addEventListener('resize',()=>{const P=pos();place(L,P.L);place(R,P.R);place(B,P.B)});return o}
function loop(now){ST.raf=requestAnimationFrame(loop);const dt=Math.min(0.1,(now-(ST.last||now))/1000)||1/60;ST.last=now;const i=I();if(!i||document.getElementById('start'))return;
 const [lx,ly]=ST.sticks.L,[rx,ry]=ST.sticks.R;if(lx||ly)i.orbit(lx*1.6*dt,ly*1.2*dt);if(rx&&i.look)i.look(rx*1.2*dt);if(ry)i.zoom(1+ry*1.5*dt)}
export function set(on){ST.on=!!on;ls.set(K,on?'1':'0');const t=document.getElementById('vpToggle');if(t){t.setAttribute('aria-pressed',on);t.title=on?'Hide on-screen controls':'Show on-screen controls'}
 const m=document.getElementById('vpSet');if(m)m.textContent='On-screen controls: '+(on?'ON':'OFF');
 if(on){build().style.display='';if(!ST.raf)ST.raf=requestAnimationFrame(loop)}else{const o=document.getElementById('vpad');if(o)o.style.display='none';cancelAnimationFrame(ST.raf);ST.raf=0;ST.sticks={L:[0,0],R:[0,0]}}}
function menu(){const g=document.getElementById('uig_set');if(!g){if((ST.tries=(ST.tries||0)+1)<60)setTimeout(menu,500);return}if(document.getElementById('vpSet'))return;const b=document.createElement('button');b.id='vpSet';b.onclick=()=>set(!ST.on);g.appendChild(b);b.textContent='On-screen controls: '+(ST.on?'ON':'OFF')}
export function init(){if(typeof document=='undefined'||window.GX?.vpad)return;css();const t=document.createElement('button');t.id='vpToggle';t.textContent='🎮';t.setAttribute('aria-label','On-screen controls');t.onclick=e=>{e.stopPropagation();set(!ST.on)};document.body.appendChild(t);
 window.GX=window.GX||{};window.GX.vpad={ST,set,act,on:()=>ST.on};set(ls.get(K)=='1');menu()}
