// home.js v5.11.2.1 hotfix (P0): a way back to the home (start) screen from the game scene.
// 🏠 Home button first in the nav (desktop left rail + phone bottom nav; classic HUD fallback), Esc (first Esc closes open panels),
// gamepad View/Back/Select (button 8), browser Back (pushState on entering the scene, popstate -> home). Confirms when a WITSML feed or session is running.
// Home = the existing start screen overlay (start.js show()); "Continue" returns to the running scene.
const $=id=>document.getElementById(id);
const SKIP=new Set(['uiTop','uiNav','uiX','mdock','sim','clock','log','appVer','bithud','wtoast','panels','plJoin','g8btn','svhud','eqmenu','libmenu','nosurv','vpad','edmmap']);
const H={skip:false,prev:{},inited:false};
const vis=e=>!!e&&getComputedStyle(e).display!='none'&&getComputedStyle(e).visibility!='hidden'&&e.getBoundingClientRect().width>0;
export function inScene(){return !$('start')}
export function busy(){const W=window.GX?.witsml?.WML,S=window.GX?.session?.S;return !!(W&&W.timer)||!!(S&&S.code)}
export function anyOpen(){if($('showroomB'))return true;/* showroom-b hook */if(window.GX?.safety?.isOpen?.())return true;/* safety hook */const DK=window.GX?.ui?.DK;if(DK?.on&&DK.open?.length)return true;
 const o=[...document.body.children].filter(e=>(e.tagName=='DIV'||e.id=='uiTools')&&!SKIP.has(e.id)&&/fixed|absolute/.test(getComputedStyle(e).position));
 document.querySelectorAll('#panels>.panel').forEach(e=>o.push(e));const w=$('wshop');if(w)o.push(w);return o.some(vis)}
function mark(){try{if(!history.state?.dwScene)history.pushState({...(history.state||{}),dwScene:1},'',location.href)}catch(e){}}
export function go(o={}){if(!inScene())return false;
 if(busy()&&!o.yes&&!confirm('A WITSML feed or multiplayer session is running. Go to the home page? It keeps running; choose Continue to come back.'))return false;
 const S=window.GX?.start||window.dwStart;if(!S?.show)return false;S.show();
 if(!o.pop&&history.state?.dwScene){H.skip=true;try{history.back()}catch(e){H.skip=false}}
 try{dispatchEvent(new CustomEvent('dw:home'))}catch(e){}return true}
function btn(){if($('uiTab_home'))return true;const N=$('uiNav'),hud=$('hud');
 const b=document.createElement('button');b.id='uiTab_home';b.dataset.k='home';b.title='Home (Esc)';b.setAttribute('aria-label','Home');b.onclick=e=>{e.preventDefault();e.stopPropagation();go()};
 if(N){b.innerHTML='<b>🏠</b>Home';N.prepend(b);return true}
 if(hud&&window.GX?.ui?.classic){b.textContent='🏠 Home';hud.prepend(b);return true}return false}
function css(){const s=document.createElement('style');s.textContent=`#uiNav #uiTab_home{color:#ffd27a}#uiNav #uiTab_home b{filter:none}body.desk #uiNav #uiTab_home{border-bottom:1px solid #2a3a50}#uiNav{z-index:9600}`;document.head.appendChild(s)}
const wOpen=()=>!!window.GX?.witsml?.isOpen?.();
function key(e){if(e.key!='Escape'||!inScene()||e.defaultPrevented)return;if(wOpen()){window.GX.witsml.close();e.preventDefault();e.stopPropagation();return}// topmost: WITSML pop-up first
if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;
 if(anyOpen()||document.querySelector('#gxLegend:not([style*="none"])'))return;// first Esc: input.js closes the panel/modal
 if(go()){e.preventDefault();e.stopPropagation()}}
function pad(){if(!inScene()){H.prev={};return}const gps=navigator.getGamepads?.()||[];for(const g of gps){if(!g)continue;const p=!!g.buttons[8]?.pressed;if(p&&!H.prev[g.index])go();H.prev[g.index]=p}}
export function init(){if(H.inited||typeof document=='undefined')return;H.inited=true;css();
 let k=0;const t=setInterval(()=>{if(btn()||++k>120)clearInterval(t)},250);
 addEventListener('keydown',key,true);
 addEventListener('pointerdown',e=>{if(!wOpen()||!inScene())return;const t=e.target;if(t?.closest?.('#witsml,#wbtn,#wtoast,#uiTab_home,#start'))return;window.GX.witsml.close()},true);
setInterval(pad,60);
 addEventListener('dw:start',()=>setTimeout(mark,0));if(inScene())mark();
 addEventListener('popstate',()=>{if(H.skip){H.skip=false;return}if(inScene()&&!go({pop:true}))mark()});
 const API={go,busy,anyOpen,inScene},pin=()=>{window.GX=window.GX||{};if(window.GX.home!==API)window.GX.home=API};pin();addEventListener('load',pin);let n=0;const pt=setInterval(()=>{pin();if(++n>60)clearInterval(pt)},500)}
if(document.body)init();else addEventListener('DOMContentLoaded',init);
