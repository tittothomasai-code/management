// input.js v5.9.4: gamepad + keyboard. Gamepad: left stick orbit, right stick look (x) / zoom (y), RT/LT WOB +/-, RB/LB RPM +/-,
// D-pad left/right = previous/next panel tab, D-pad up/down = move focus, A = activate, B = close panels, Start = legend, View (8) = Home (home.js).
// Keyboard: arrows orbit, WASD/QE move (existing), +/- zoom, [ ] WOB, PageUp/PageDown RPM, Tab/Shift-Tab focus, Enter activate, Esc close, ? legend.
// Values shown metric (WOB kN); the sim's internal WOB setpoint is klbf.
const KN=4.44822,DZ=0.15,TABS=['rig','data','sheet','tools','crew','plan'];
const ST={pad:null,prev:[],tab:0,legend:false,last:0,log:[],wobStep:0.5,rpmStep:5};
const dz=v=>Math.abs(v)<DZ?0:(v-Math.sign(v)*DZ)/(1-DZ);
const typing=e=>{const t=e?.target||document.activeElement;return t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable)};
const G=()=>window.G;
export function orbit(dAz,dPol){const g=G();if(!g?.cam||!g?.ctl)return;const c=g.cam,t=g.ctl.target,o=c.position.clone().sub(t);const r=o.length();let az=Math.atan2(o.x,o.z),pol=Math.acos(Math.max(-1,Math.min(1,o.y/r)));
 az+=dAz;pol=Math.max(0.05,Math.min(Math.PI-0.05,pol+dPol));c.position.set(t.x+r*Math.sin(pol)*Math.sin(az),t.y+r*Math.cos(pol),t.z+r*Math.sin(pol)*Math.cos(az));c.lookAt(t);g.ctl.update?.()}
export function zoom(f){const g=G();if(!g?.cam||!g?.ctl)return;const c=g.cam,t=g.ctl.target,o=c.position.clone().sub(t);const r=Math.max(2,Math.min(4000,o.length()*f));o.setLength(r);c.position.copy(t).add(o);g.ctl.update?.()}
export function look(d){const g=G();if(!g?.cam||!g?.ctl)return;const c=g.cam,t=g.ctl.target,o=t.clone().sub(c.position),a=Math.atan2(o.x,o.z)+d,r=Math.hypot(o.x,o.z);t.set(c.position.x+r*Math.sin(a),t.y,c.position.z+r*Math.cos(a));g.ctl.update?.()}
export function wob(d){const S=G()?.S;if(!S?.dw)return;S.dw.wobSet=Math.max(0,Math.min(80,+(S.dw.wobSet+d).toFixed(2)));toast('WOB setpoint '+(S.dw.wobSet*KN).toFixed(0)+' kN')}
export function rpm(d){const S=G()?.S;if(!S?.td)return;S.td.cmd=Math.max(0,Math.min(220,Math.round(S.td.cmd+d)));toast('Top drive RPM setpoint '+S.td.cmd)}
export function tab(d){const vis=TABS.filter(k=>{const b=document.getElementById('uiTab_'+k);return b&&b.offsetParent!==null});if(!vis.length){ST.lastTab='none';return moveFocus(d)}ST.tab=(ST.tab+d+vis.length)%vis.length;const b=document.getElementById('uiTab_'+vis[ST.tab]);ST.lastTab=vis[ST.tab];b?.click();b?.focus()}
function focusables(){return [...document.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(e=>!e.disabled&&e.offsetParent!==null)}
export function moveFocus(d){const f=focusables();if(!f.length)return;const i=f.indexOf(document.activeElement);f[(i+d+f.length)%f.length].focus()}
export function closeAll(){if(document.getElementById('start'))return;window.GX?.ui?.closeAll?.();window.GX?.edm?.close?.();window.GX?.wmlinv?.close?.()}
let tT;function toast(m){let e=document.getElementById('inpToast');if(!e){e=document.createElement('div');e.id='inpToast';document.body.appendChild(e)}e.textContent=m;e.style.display='block';clearTimeout(tT);tT=setTimeout(()=>e.style.display='none',1400);ST.log.push(m)}
export function legend(on=!ST.legend){ST.legend=on;let e=document.getElementById('inpLegend');if(!e){e=document.createElement('div');e.id='inpLegend';e.setAttribute('role','dialog');e.setAttribute('aria-label','Controls');document.body.appendChild(e)}
 e.innerHTML=`<b>Controls</b> <small>${ST.pad?'🎮 '+ST.pad.replace(/[<>&]/g,''):'⌨ keyboard'}</small><table>
<tr><th>Gamepad</th><th>Keyboard</th><th>Action</th></tr><tr><td>Left stick</td><td>← → ↑ ↓</td><td>Orbit camera</td></tr><tr><td>Right stick ↔</td><td>W A S D · Q E</td><td>Look / move</td></tr>
<tr><td>Right stick ↕</td><td>+ / −</td><td>Zoom</td></tr><tr><td>RT / LT</td><td>] / [</td><td>WOB + / − (kN)</td></tr><tr><td>RB / LB</td><td>PgUp / PgDn</td><td>Top drive RPM + / −</td></tr>
<tr><td>D-pad ← →</td><td>Tab / Shift-Tab</td><td>Next / previous panel or control</td></tr><tr><td>D-pad ↑ ↓</td><td>Tab</td><td>Move focus</td></tr><tr><td>A</td><td>Enter</td><td>Activate</td></tr><tr><td>B</td><td>Esc</td><td>Close panels</td></tr><tr><td>Start</td><td>?</td><td>Show / hide this legend</td></tr><tr><td>View</td><td>Esc</td><td>🏠 Home (start screen)</td></tr></table>`;e.style.display=on?'block':'none'}
function css(){const s=document.createElement('style');s.textContent=`:focus-visible{outline:3px solid #ffd54f!important;outline-offset:2px!important;box-shadow:0 0 0 5px rgba(255,213,79,.35)!important}
#inpToast{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:90;background:#0d1620ee;color:#fff;border:1px solid #ffd54f;border-radius:8px;padding:6px 12px;font:14px system-ui;display:none;pointer-events:none}
#inpLegend{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:95;background:#0d1620f4;color:#dde;border:2px solid #ffd54f;border-radius:12px;padding:12px 14px;font:13px system-ui;display:none;max-width:94vw;max-height:80vh;overflow:auto}
#inpLegend table{border-collapse:collapse;margin-top:6px}#inpLegend td,#inpLegend th{padding:3px 8px;border-bottom:1px solid #2a3a4a;text-align:left}`;document.head.appendChild(s)}
export function key(e){if(typing(e)||document.getElementById('start'))return;const k=e.key;let h=true;
 if(k=='ArrowLeft')orbit(-0.08,0);else if(k=='ArrowRight')orbit(0.08,0);else if(k=='ArrowUp')orbit(0,-0.06);else if(k=='ArrowDown')orbit(0,0.06);
 else if(k=='+'||k=='=')zoom(0.85);else if(k=='-'||k=='_')zoom(1/0.85);else if(k==']')wob(ST.wobStep);else if(k=='[')wob(-ST.wobStep);
 else if(k=='PageUp')rpm(ST.rpmStep);else if(k=='PageDown')rpm(-ST.rpmStep);else if(k=='Escape'){closeAll();if(ST.legend)legend(false)}else if(k=='?')legend();else h=false;
 if(h){e.preventDefault();e.stopPropagation()}}
export function poll(now=performance.now()){if(window.GX?.ddtracks?.isOpen?.())return;/* ddtracks hook */const pads=navigator.getGamepads?.()||[];const p=[...pads].find(Boolean);if(!p){if(ST.pad){ST.pad=null}return}
 if(!ST.pad){ST.pad=p.id||'gamepad';toast('Gamepad connected — press Start for controls')}
 const dt=Math.min(0.1,(now-(ST.last||now))/1000)||1/60;ST.last=now;const ax=i=>dz(p.axes[i]||0),bt=i=>p.buttons[i]?.pressed?1:0,bv=i=>p.buttons[i]?.value??bt(i),edge=i=>bt(i)&&!ST.prev[i];
 const lx=ax(0),ly=ax(1),rx=ax(2),ry=ax(3);if(!document.getElementById('start')&&!document.getElementById('showroom')&&!document.getElementById('showroomB')&&!document.getElementById('showroomC')/* showroom-c hook */){if(lx||ly)orbit(lx*1.6*dt,ly*1.2*dt);if(rx)look(rx*1.2*dt);if(ry)zoom(1+ry*1.5*dt);
  const rt=bv(7),lt=bv(6);if(rt>0.1)wob(ST.wobStep*rt*10*dt);if(lt>0.1)wob(-ST.wobStep*lt*10*dt);if(edge(5))rpm(ST.rpmStep);if(edge(4))rpm(-ST.rpmStep);
  if(edge(14))tab(-1);if(edge(15))tab(1);if(edge(12))moveFocus(-1);if(edge(13))moveFocus(1);if(edge(0)){const a=document.activeElement;if(a&&a!==document.body)a.click()}if(edge(1)){closeAll();if(ST.legend)legend(false)}}
 if(edge(9)&&!window.GX?.ddrun?.active?.())legend();ST.prev=p.buttons.map(b=>b.pressed)}
let raf;function loop(){poll();raf=requestAnimationFrame(loop)}
export function stop(){cancelAnimationFrame(raf);raf=0}
export function init(){if(typeof document=="undefined"||window.__input)return;css();addEventListener('keydown',key);addEventListener('gamepadconnected',e=>{ST.pad=e.gamepad.id;legend(true);setTimeout(()=>ST.legend&&legend(false),6000)});loop();window.GX=window.GX||{};window.__input=window.GX.input={ST,poll,key,legend,orbit,zoom,look,wob,rpm,tab,stop}}
