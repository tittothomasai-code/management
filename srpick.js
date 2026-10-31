// srpick.js (feat/showroom-b): Showroom selector A/B/C with a registry. A = classic (showroom.js), B = arcade rig select (showroomb.js).
// C (and later ones) register with GX.showroomAB.register('C',{label,aria,open}); an unregistered choice is hidden and falls back to A.
// Default A. Stored in localStorage 'dw_showroom_ab'. URL ?showroom=a|b|c overrides for one load.
// Selector on the start screen (under the tiles) and in Tools > Settings. HUD Showroom button routes to the chosen one.
const K='dw_showroom_ab',$=id=>document.getElementById(id);
const REG={A:{label:'A · Classic',aria:'Showroom A, classic',open:async i=>{const m=await import('./showroom.js?v=b16');m.init();m.open(i)}},
 B:{label:'B · Arcade',aria:'Showroom B, arcade',open:async i=>{const m=await import('./showroomb.js?v=b1');m.open(i)}}};
export const keys=()=>Object.keys(REG).filter(k=>!REG[k].hidden).sort();
export function register(k,o){k=String(k||'').toUpperCase();if(!/^[A-Z]$/.test(k)||typeof o?.open!='function')return false;REG[k]={label:o.label||k,aria:o.aria||'Showroom '+k,open:o.open,hidden:!!o.hidden};render();return true}
export function get(){try{const u=new URLSearchParams(location.search).get('showroom'),v=(u||localStorage.getItem(K)||'A').toUpperCase();return REG[v]&&!REG[v].hidden?v:'A'}catch(e){return 'A'}}
export function set(v){v=String(v||'A').toUpperCase();if(!REG[v]||REG[v].hidden)v='A';try{localStorage.setItem(K,v);const q=new URLSearchParams(location.search);if(q.has('showroom')){q.delete('showroom');history.replaceState(history.state,'',location.pathname+(q.toString()?'?'+q:'')+location.hash)}}catch(e){}sync();try{dispatchEvent(new CustomEvent('dw-showroom-ab',{detail:v}))}catch(e){}return v}
export async function open(i){const v=get();await REG[v].open(i);return v}
const seg=id=>`<span class=srabL>Showroom</span>`+keys().map(k=>`<button type=button data-ab=${k} id=${id}${k} aria-label="${REG[k].aria}">${REG[k].label}</button>`).join('');
function css(){if($('srabCss'))return;const s=document.createElement('style');s.id='srabCss';s.textContent=`.srab{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0 0;font:13px system-ui,sans-serif;color:#cfd6de}.srab .srabL{opacity:.8;margin-right:2px}.srab button{min-height:36px;padding:4px 12px;border-radius:8px;border:1px solid #3a434d;background:rgba(18,22,27,.85);color:#e8ebef;font:inherit;cursor:pointer}.srab button.on{background:#c9a46a;border-color:#c9a46a;color:#111;font-weight:600}#srabSet{margin:4px 0}`;document.head.appendChild(s)}
export function sync(){const v=get();document.querySelectorAll('.srab button[data-ab]').forEach(b=>{const on=b.dataset.ab==v;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}
function wire(el){el.innerHTML=seg(el.id=='srabStart'?'srabS':'srabT');el.dataset.k=keys().join();el.querySelectorAll('button[data-ab]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();set(b.dataset.ab)});sync()}
function render(){document.querySelectorAll('.srab').forEach(el=>{if(el.dataset.k!=keys().join())wire(el)})}
function inject(){css();const t=$('st_showroom');if(t&&!$('srabStart')){const tiles=t.closest('.tiles')||t.parentElement,d=document.createElement('div');d.id='srabStart';d.className='srab';tiles.after(d);wire(d)}
 if(!t&&$('srabStart')&&!$('start'))$('srabStart').remove();
 const g=$('uig_set');if(g&&!$('srabSet')){const d=document.createElement('div');d.id='srabSet';d.className='srab';g.appendChild(d);wire(d)}}
export function init(){if(typeof document=='undefined'||window.__srab)return;window.__srab=1;const A={get,set,open,sync,register,keys},pin=()=>{window.GX=window.GX||{};if(window.GX.showroomAB!==A)window.GX.showroomAB=A};pin();let n=0;const pt=setInterval(()=>{pin();if(++n>120)clearInterval(pt)},500);addEventListener('load',pin);
 let q=0;new MutationObserver(()=>{if(q)return;q=1;requestAnimationFrame(()=>{q=0;inject()})}).observe(document.body,{childList:true,subtree:true});inject();
 // HUD 🏁 Showroom button (made by showroom.js) -> the chosen showroom when not A. Capture phase, so A's handler does not run.
 addEventListener('click',e=>{const b=e.target?.closest?.('#btnShow');if(!b||get()=='A')return;e.preventDefault();e.stopImmediatePropagation();open()},true)}
if(typeof document!='undefined'){if(document.body)init();else addEventListener('DOMContentLoaded',init)}
