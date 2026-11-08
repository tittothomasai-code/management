// intro.js (v5.15.1 + startup intro): plays the approved 8 s silent startup clip once, over the existing start screen.
// Never blocks the game: Skip button, Escape/Enter/Space, dismiss on ended / error / autoplay rejection / load timeout / hard cap.
// Not shown for prefers-reduced-motion, the same deep links that skip the start screen, ?nointro, automated runs (unless ?intro),
// or a second time in the same browser tab session (unless ?intro). Uses <section> (like #start) so mobile.js does not fold it into its panel menu.
const q=new URLSearchParams(location.search);
const SRC='./assets/intro/startup-intro.mp4?v=i1',SK='dw_intro_seen',LOAD_MS=4000,CAP_MS=15000;
export function shouldPlay(){
 if(q.has('nointro'))return false;
 if(['nosplash','s','session','demo','join','player','edm','monitor','workover','safety','wdash','operations'].some(k=>q.has(k)))return false;
 try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return false}catch(e){}
 if(q.has('intro'))return true;
 if(navigator.webdriver)return false;
 try{if(sessionStorage.getItem(SK))return false}catch(e){}
 return true}
const S={el:null,v:null,t:[],prev:null,reason:null};
function trap(e){if(S.el&&!S.el.contains(e.target)){const b=document.getElementById('introSkip');try{b&&b.focus()}catch(x){}}}
function key(e){if(!S.el)return;if(['Escape','Enter',' ','Spacebar'].includes(e.key)){e.preventDefault();dismiss('key')}
 else if(e.key!=='Tab'){e.preventDefault()}e.stopImmediatePropagation()}
export function dismiss(reason){if(!S.el)return;S.reason=reason||'skip';S.t.forEach(clearTimeout);S.t=[];removeEventListener('keydown',key,true);document.removeEventListener('focusin',trap,true);
 const v=S.v;try{v.pause();v.removeAttribute('src');v.load()}catch(e){}S.el.remove();S.el=null;S.v=null;
 try{sessionStorage.setItem(SK,'1')}catch(e){}
 const f=document.querySelector('#start .tile.on')||(S.prev&&document.contains(S.prev)?S.prev:null);try{f&&f.focus()}catch(e){}
 dispatchEvent(new CustomEvent('dw:intro-done',{detail:{reason:S.reason}}))}
export function show(){if(S.el)return;S.prev=document.activeElement;
 const el=document.createElement('section');el.id='intro';el.setAttribute('role','dialog');el.setAttribute('aria-label','Startup intro');
 el.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;align-items:center;justify-content:center';
 const v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.playsInline=true;v.autoplay=true;v.loop=false;v.preload='auto';
 v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('aria-hidden','true');v.disablePictureInPicture=true;
 v.style.cssText='width:100%;height:100%;object-fit:cover;pointer-events:none';
 const b=document.createElement('button');b.id='introSkip';b.type='button';b.textContent='Skip intro';b.setAttribute('aria-label','Skip intro');
 b.style.cssText='position:absolute;right:calc(16px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));min-width:44px;min-height:44px;padding:10px 18px;font:600 14px system-ui,sans-serif;color:#fff;background:#0009;border:1px solid #fff8;border-radius:22px;cursor:pointer';
 b.onclick=e=>{e.stopPropagation();dismiss('skip')};
 el.append(v,b);S.el=el;S.v=v;addEventListener('keydown',key,true);document.addEventListener('focusin',trap,true);
 v.addEventListener('ended',()=>dismiss('ended'));v.addEventListener('error',()=>dismiss('error'));
 S.t.push(setTimeout(()=>{if(S.v&&(S.v.readyState<2||S.v.paused))dismiss('timeout')},LOAD_MS),setTimeout(()=>dismiss('cap'),CAP_MS));
 document.body.appendChild(el);v.src=SRC;
 try{const p=v.play();if(p&&p.catch)p.catch(()=>dismiss('rejected'))}catch(e){dismiss('rejected')}
 try{b.focus()}catch(e){}}
window.dwIntro={show,dismiss,shouldPlay,get reason(){return S.reason},get open(){return !!S.el}};
if(shouldPlay()){if(document.body)show();else addEventListener('DOMContentLoaded',show)}
