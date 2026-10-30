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
body.desk #vpad{right:var(--dkR,0px)!important}
body.desk #vpToggle{right:calc(var(--dkR,0px) + 14px)!important}
body.desk #ss56.dk .bar,body.desk #chatSheet.dk #chatHead{padding-right:82px!important}`;document.head.appendChild(s)}
export function collapse(k,on){const D=window.GX?.ui?.DK;if(!D)return;D.col=D.col||{};const v=on??!D.col[k];if(v)D.col[k]=1;else delete D.col[k];
 try{const o=JSON.parse(localStorage.getItem('dw_desk')||'{}');o.col=D.col;localStorage.setItem('dw_desk',JSON.stringify(o))}catch(e){}GX.ui.layout()}
function deco(e,k){if(e.querySelector(':scope>.dkC_btn'))return;
 const b=document.createElement('button');b.className='dkC_btn';b.textContent='⇥';b.title='Collapse panel';b.setAttribute('aria-label','Collapse '+NAME[k]);b.onclick=ev=>{ev.stopPropagation();collapse(k,true)};e.appendChild(b);
 const st=document.createElement('button');st.className='dkStrip';st.title='Expand panel';st.setAttribute('aria-label','Expand '+NAME[k]);st.innerHTML=`<b>⇤</b><span>${NAME[k]}</span>`;st.onclick=ev=>{ev.stopPropagation();collapse(k,false)};e.appendChild(st)}
let busy=false;const kick=()=>{if(busy)return;busy=true;try{dispatchEvent(new Event('resize'))}finally{busy=false}};
function splitFit(right){if(busy)return;const ss=$('subsurf');const on=!!ss&&ss.classList.contains('split')&&getComputedStyle(ss).display!='none';
 const desk=document.body.classList.contains('desk');
 if(!on||!desk||right<=0){if(ss&&ss.dataset.dkSplit){ss.style.removeProperty('right');ss.style.removeProperty('left');delete ss.dataset.dkSplit;lastSplit=null;kick()}lastSplit=null;return}
 const L=104,mid=Math.round(L+(innerWidth-L-right)/2),key=mid+'/'+right;
 ss.style.setProperty('left',mid+'px','important');ss.style.setProperty('right',right+'px','important');ss.dataset.dkSplit=key;
 if(lastSplit!==key){lastSplit=key;kick()}// subsurface.js re-reads its own size on resize
 if(window.__dwSplitW!==mid)window.dwSplitView?.(mid)}
export function after(right,keys){css();const D=window.GX?.ui?.DK;if(!D)return;for(const k of keys){const e={data:$('traces'),sheet:$('ss56'),tools:$('uiTools'),crew:$('chatSheet'),plan:$('wp')}[k];if(!e)continue;deco(e,k);e.classList.toggle('dkCol',!!D.col?.[k])}
 for(const e of document.querySelectorAll('.dkCol'))if(!e.classList.contains('dk'))e.classList.remove('dkCol');splitFit(right)}
export function init(){css();window.GX=window.GX||{};GX.dock={after,collapse,splitFit};const D=GX.ui?.DK;if(D)D.col=D.col||{};
 setInterval(()=>{try{if(document.body.classList.contains('desk'))splitFit(parseInt(getComputedStyle(document.body).getPropertyValue('--dkR'))||0);else splitFit(0)}catch(e){}},400);GX.ui?.layout?.()}
