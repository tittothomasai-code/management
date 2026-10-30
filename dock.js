// dock.js v5.10.1 — desktop dock additions on top of the v5.8 ui.js dock (Titto request).
// Desktop (>=1024 px): docked side panels can be collapsed to a 40 px strip and expanded again; the collapsed state is saved
// with the rest of the dock layout in localStorage 'dw_desk' (key 'col'). The split subsurface view (window.dwSplitView) and the
// on-screen controls (#vpad / #vpToggle from vpad.js, if loaded) move left so the dock never covers them. Phone layout: no change.
// Hooks in ui.js (minimal): layout() uses 40 px for collapsed keys, dsave/dload keep DK.col, layout() calls GX.dock.after(right,keys).
const $=id=>document.getElementById(id);
const NAME={data:'Data',sheet:'Slide sheet',tools:'Tools',plan:'Well plan',crew:'Crew'};
let lastSplit=null;
function css(){if($('dockCss'))return;const s=document.createElement('style');s.id='dockCss';s.textContent=`
.dkC_btn{position:absolute;top:6px;right:44px;z-index:6;width:30px;height:30px;border-radius:15px;border:1px solid #789;background:#22303f;color:#fff;font:15px system-ui;cursor:pointer}
.dk.dkCol{overflow:hidden!important;padding:0!important}.dk.dkCol>*:not(.dkStrip){display:none!important}
.dkStrip{display:none}.dk.dkCol>.dkStrip{display:flex!important;position:absolute;inset:0;flex-direction:column;align-items:center;gap:10px;padding-top:8px;background:none;border:0;color:#cde;cursor:pointer;font:600 13px system-ui}
.dkStrip span{writing-mode:vertical-rl;white-space:nowrap}.dkStrip:hover{background:#16263a}
body.desk #vpad{right:var(--dkR,0px)!important;left:104px!important;width:auto!important}
body.desk #vpToggle{right:calc(var(--dkR,0px) + 14px)!important}
body.desk #ss56.dk .bar,body.desk #chatSheet.dk #chatHead{padding-right:82px!important}`;document.head.appendChild(s)}
export function collapse(k,on){const D=window.GX?.ui?.DK;if(!D)return;if(D.autoCol)delete D.autoCol[k];D.col=D.col||{};const v=on??!D.col[k];if(v)D.col[k]=1;else delete D.col[k];
 try{const o=JSON.parse(localStorage.getItem('dw_desk')||'{}');o.col=D.col;localStorage.setItem('dw_desk',JSON.stringify(o))}catch(e){}GX.ui.layout()}
function deco(e,k){if(e.querySelector(':scope>.dkC_btn'))return;
 const b=document.createElement('button');b.className='dkC_btn';b.textContent='⇥';b.title='Collapse panel';b.setAttribute('aria-label','Collapse '+NAME[k]);b.onclick=ev=>{ev.stopPropagation();collapse(k,true)};e.appendChild(b);
 const st=document.createElement('button');st.className='dkStrip';st.title='Expand panel';st.setAttribute('aria-label','Expand '+NAME[k]);st.innerHTML=`<b>⇤</b><span>${NAME[k]}</span>`;st.onclick=ev=>{ev.stopPropagation();collapse(k,false)};e.appendChild(st)}
let busy=false;const kick=()=>{if(busy)return;busy=true;try{dispatchEvent(new Event('resize'))}finally{busy=false}};
// dock-split: each split pane keeps at least MIN px. When short: 1) auto-collapse the widest open dock to a strip (restored when the
// split closes), 2) if still short, stack the views (rig top, subsurface bottom). User-drag splitter (#dkSplitH) sets the rig share,
// saved as DK.split in dw_desk. Ref: WCAG 2.2 reflow / min target sizes; Material 3 pane layout guidance (min pane 360 dp).
export const MIN=360;let pend=false;
function dset(){try{const o=JSON.parse(localStorage.getItem('dw_desk')||'{}');const D=GX.ui.DK;o.col=D.col;o.split=D.split;localStorage.setItem('dw_desk',JSON.stringify(o))}catch(e){}}
function unAuto(){const D=window.GX?.ui?.DK;if(!D?.autoCol)return false;let ch=false;for(const k of Object.keys(D.autoCol)){if(D.col?.[k]){delete D.col[k];ch=true}}D.autoCol={};if(ch){dset();setTimeout(()=>GX.ui.layout(),0)}return ch}
function handle(){let h=$('dkSplitH');if(h)return h;h=document.createElement('div');h.id='dkSplitH';h.title='Drag to change the split';h.setAttribute('role','separator');h.setAttribute('aria-label','Split line');
 h.style.cssText='position:fixed;top:0;bottom:0;width:10px;margin-left:-5px;cursor:col-resize;z-index:100001;background:linear-gradient(90deg,transparent 3px,#4a6a8a 3px,#4a6a8a 7px,transparent 7px);display:none;touch-action:none';
 h.addEventListener('pointerdown',ev=>{ev.preventDefault();h.setPointerCapture(ev.pointerId);const mv=m=>{const right=parseInt(getComputedStyle(document.body).getPropertyValue('--dkR'))||0,av=innerWidth-104-right;
   const x=Math.max(MIN,Math.min(av-MIN,m.clientX-104));GX.ui.DK.split=+(x/av).toFixed(3);lastSplit=null;splitFit(right)},up=()=>{h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);dset()};
  h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up)});document.body.appendChild(h);return h}
function clear(ss){const h=$('dkSplitH');if(h)h.style.display='none';if(ss&&ss.dataset.dkSplit){for(const p of['right','left','top'])ss.style.removeProperty(p);ss.classList.remove('dkStack');delete ss.dataset.dkSplit;kick()}lastSplit=null}
function splitFit(right){if(busy)return;const ss=$('subsurf');const on=!!ss&&ss.classList.contains('split')&&getComputedStyle(ss).display!='none';
 const desk=document.body.classList.contains('desk'),D=window.GX?.ui?.DK;
 if(!on||!desk){clear(ss);unAuto();return}
 if(right<=0){clear(ss);return}
 const L=104,av=innerWidth-L-right;
 if(av<2*MIN&&D){// step 1: collapse the widest open, expanded dock
  const ks=(D.open||[]).filter(k=>!D.col?.[k]).map(k=>{const e={data:$('traces'),sheet:$('ss56'),tools:$('uiTools'),crew:$('chatSheet'),plan:$('wp')}[k];return [k,e?e.getBoundingClientRect().width:0]}).filter(x=>x[1]>40).sort((a,b)=>b[1]-a[1]);
  if(pend)return;if(ks.length){const k=ks[0][0];pend=true;D.col=D.col||{};D.col[k]=1;D.autoCol=D.autoCol||{};D.autoCol[k]=1;dset();setTimeout(()=>GX.ui.layout(),0);return}}
 const h=handle();
 if(av<2*MIN){// step 2: stacked
  const key='stack/'+right;ss.classList.add('dkStack');ss.style.setProperty('left',L+'px','important');ss.style.setProperty('right',right+'px','important');ss.style.setProperty('top','50%','important');ss.dataset.dkSplit=key;h.style.display='none';
  if(lastSplit!==key){lastSplit=key;kick()}if(window.__dwSplitW)window.dwSplitView?.(0);return}
 ss.classList.remove('dkStack');ss.style.removeProperty('top');
 let f=D?.split||0.5;const x=Math.max(MIN,Math.min(av-MIN,Math.round(av*f))),mid=L+x,key=mid+'/'+right;
 ss.style.setProperty('left',mid+'px','important');ss.style.setProperty('right',right+'px','important');ss.dataset.dkSplit=key;
 h.style.left=mid+'px';h.style.display='block';
 if(lastSplit!==key){lastSplit=key;kick()}// subsurface.js re-reads its own size on resize
 if(window.__dwSplitW!==mid)window.dwSplitView?.(mid)}
export function after(right,keys){css();pend=false;const D=window.GX?.ui?.DK;if(!D)return;for(const k of keys){const e={data:$('traces'),sheet:$('ss56'),tools:$('uiTools'),crew:$('chatSheet'),plan:$('wp')}[k];if(!e)continue;deco(e,k);e.classList.toggle('dkCol',!!D.col?.[k])}
 for(const e of document.querySelectorAll('.dkCol'))if(!e.classList.contains('dk'))e.classList.remove('dkCol');splitFit(right)}
export function init(){css();window.GX=window.GX||{};GX.dock={after,collapse,splitFit,MIN};const D=GX.ui?.DK;if(D)D.col=D.col||{};
 setInterval(()=>{try{if(document.body.classList.contains('desk'))splitFit(parseInt(getComputedStyle(document.body).getPropertyValue('--dkR'))||0);else splitFit(0)}catch(e){}},400);GX.ui?.layout?.()}
