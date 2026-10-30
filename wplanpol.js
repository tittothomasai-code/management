// wplanpol.js (helper G, batch6): polish for the well planning panel (#wp). No engine. Loaded by wplanac.js (no shared-file change).
// polish2 (G7): phone sub-tabs fit on one row, AFE inputs in 2 columns, bottom space so the gamepad toggle does not cover fields.
// 1) tab groups (Plan / Safety / Engineering / Cost) in a fixed order, so the phone tab area is 2 rows, not 6;
// 2) the tab bar stays on top when the panel scrolls; 3) wide tables scroll sideways; 4) last tab remembered; 5) ?wplan=<tab> opens a tab.
export const GROUPS=[['plan','Plan',['inputs','plan','wgd','program','geology']],['safe','Safety',['offsets','ac','acedm','wge','acell']],['eng','Engineering',['casing','beam','wgp','wgv']],['cost','Cost',['wga','afe']]];
export function groupOf(v){const g=GROUPS.find(g=>g[2].includes(v));return g?g[0]:'other'}
export function order(views){const all=GROUPS.flatMap(g=>g[2]);return [...views].sort((a,b)=>{const i=all.indexOf(a),j=all.indexOf(b);return (i<0?99:i)-(j<0?99:j)})}
const LS='wp_view';let busy=false;
function css(){if(document.getElementById('wppCss'))return;const s=document.createElement('style');s.id='wppCss';s.textContent=`#wp .wppBar{position:sticky;top:-10px;z-index:3;background:rgba(14,22,34,.98);padding:6px 0 4px;margin-top:-6px;box-shadow:0 -14px 0 rgba(14,22,34,.98)}
#wpGrp{display:flex;gap:4px;flex-wrap:wrap;width:100%}#wpGrp button{border-radius:14px;padding:3px 10px;font-weight:600}#wpGrp button.on{background:#2f7bd8;color:#fff;border-color:#2f7bd8}
#wp [data-v].wppHide{display:none!important}#wpBody table{display:block;max-width:100%;overflow-x:auto}
@media (max-width:600px){#wp .wppBar>[data-v]{font-size:13px;padding:4px 8px;min-height:36px}#wp .wgG{grid-template-columns:1fr 1fr}#wp .wgG input,#wp .wpG input{width:100%;box-sizing:border-box;min-width:0}#wp{padding-bottom:72px!important}#wp input[type=file]{max-width:100%;font-size:13px}}`;document.head.appendChild(s)}
function apply(W){const P=document.getElementById('wp');if(!P||busy)return;busy=true;try{css();const x=document.getElementById('wpX'),bar=x?.parentElement;if(!bar||!x)return;if(!bar.classList.contains('wppBar'))bar.classList.add('wppBar');
 const btns=[...bar.querySelectorAll('[data-v]')],views=order(btns.map(b=>b.dataset.v));if(btns.map(b=>b.dataset.v).join()!=views.join())for(const v of views)x.before(bar.querySelector(`[data-v="${v}"]`));
 let G=document.getElementById('wpGrp');if(!G){G=document.createElement('div');G.id='wpGrp';G.innerHTML=GROUPS.map(([k,l])=>`<button data-g=${k}>${l}</button>`).join('');bar.insertBefore(G,bar.querySelector('[data-v]'));
  G.onclick=e=>{const k=e.target.dataset?.g;if(!k)return;const first=GROUPS.find(g=>g[0]==k)[2].find(v=>bar.querySelector(`[data-v="${v}"]`));if(first)bar.querySelector(`[data-v="${first}"]`).click()}}
 const cur=groupOf(W.view);const tg=(b,c,on)=>{if(b.classList.contains(c)!=on)b.classList.toggle(c,on)};for(const b of G.children)tg(b,'on',b.dataset.g==cur);
 for(const b of bar.querySelectorAll('[data-v]')){const g=groupOf(b.dataset.v);tg(b,'wppHide',g!=cur&&g!='other')}
 try{if(localStorage.getItem(LS)!=W.view)localStorage.setItem(LS,W.view)}catch(e){}}finally{busy=false}}
export function register(W){if(typeof document=='undefined')return;const GXo=globalThis.GX=globalThis.GX||{};GXo.wplanpol={GROUPS,groupOf,order,apply:()=>apply(W)};
 new MutationObserver(()=>{const P=document.getElementById('wp');if(P&&P.style.display!='none')apply(W)}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 const q=new URLSearchParams(location.search).get('wplan');let last=null;try{last=localStorage.getItem(LS)}catch(e){}
 const want=q||null;if(!want&&last&&last!='inputs'&&W.view=='plan')W.view=last;
 if(want)(function go(n=0){if(GXo.wplan?.open&&W.ext[want]||['inputs','plan'].includes(want))GXo.wplan.open(want);else if(n<60)setTimeout(()=>go(n+1),500)})()}
