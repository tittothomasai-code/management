// mobile.js v4.0: phone layout. On small/touch screens every floating panel becomes a collapsible
// bottom sheet (right-side drawer in landscape). A dock along the bottom has one chip per open panel; tap a chip
// to expand/collapse it. Only one sheet is expanded at a time so the 3D scene stays visible. Desktop is unchanged.
(function(){
const mq=()=>Math.min(innerWidth,innerHeight)<=600||matchMedia('(pointer:coarse)').matches&&innerWidth<=1024;
const css=`
body.mob #sim{font-size:10px;padding:2px 6px;top:calc(4px + env(safe-area-inset-top));right:4px;z-index:40}
body.mob #clock{top:calc(4px + env(safe-area-inset-top));bottom:auto;left:4px;font-size:10px;padding:2px 6px;max-width:58vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:40}
body.mob .msheet{position:fixed!important;left:0!important;right:0!important;top:auto!important;bottom:calc(52px + env(safe-area-inset-bottom))!important;width:auto!important;min-width:0!important;max-width:none!important;max-height:46vh!important;overflow:auto!important;-webkit-overflow-scrolling:touch;transform:none!important;border-radius:14px 14px 0 0!important;box-sizing:border-box;z-index:35!important;padding-top:18px!important;font-size:13px!important}
body.mob .msheet::before{content:'';position:sticky;display:block;top:-12px;margin:-12px auto 6px;width:44px;height:5px;border-radius:3px;background:#789}
body.mob #hud.msheet:not(.mcol){display:flex!important;flex-wrap:wrap!important;gap:6px}
body.mob .mcol{display:none!important}
body.mob .msheet button,body.mob .msheet select,body.mob .msheet input,body.mob .msheet label,body.mob #mdock button{min-height:40px;min-width:40px;font-size:16px!important;touch-action:manipulation}
body.mob .msheet input,body.mob .msheet select,body.mob .msheet textarea{font-size:16px!important;max-width:100%}
body.mob .msheet input[type=checkbox]{width:22px;height:22px}
body.mob .msheet textarea{width:100%!important;box-sizing:border-box}
body.mob .msheet table{font-size:12px}
#mdock{display:none}
body.mob #mdock{display:flex;position:fixed;left:0;right:0;bottom:0;height:calc(52px + env(safe-area-inset-bottom));padding:6px 6px env(safe-area-inset-bottom);box-sizing:border-box;gap:6px;overflow-x:auto;background:#0b1218f2;border-top:1px solid #456;z-index:45;-webkit-overflow-scrolling:touch}
#mdock button{flex:0 0 auto;background:#1b2430;color:#dde;border:1px solid #456;border-radius:20px;padding:0 14px;white-space:nowrap}
#mdock button.on{background:#2a6f97;border-color:#7cf;color:#fff}
@media (orientation:landscape){body.mob .msheet{left:auto!important;top:calc(30px + env(safe-area-inset-top))!important;width:min(56vw,560px)!important;max-height:none!important;border-radius:14px 0 0 14px!important;padding-right:env(safe-area-inset-right)!important}}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const dock=document.createElement('div');dock.id='mdock';document.body.appendChild(dock);
const SKIP=new Set(['bithud','wtoast','sim','clock','mdock','panels','wshop']);const NAMES={hud:'☰ Tools',witsml:'WITSML',seqpanel:'Sequence',traces:'Traces',geoLay:'Layers',geoSur:'Survey',geoRd:'Formation',log:'Events',designer:'Designer',seqeditor:'Seq editor',seqtree:'Seq tree',eqmenu:'Add equip',libmenu:'Library',wcov:'Coverage',connp:'Connections',bitp:'Bit depth'};
const NOAUTO=new Set(["hud","geoRd","log","seqpanel"]);let t0=0,open=null,seen=new Map(),uid=0,on=false;
function name(e){if(NAMES[e.id])return NAMES[e.id];const t=(e.querySelector('b,h4')||e).textContent.trim().replace(/\s+/g,' ');return t.slice(0,16)||'Panel'}
function cands(){const out=[...document.body.children].filter(e=>e.tagName=='DIV'&&!SKIP.has(e.id)&&getComputedStyle(e).position=='fixed');document.querySelectorAll('#panels>.panel').forEach(e=>out.push(e));return out}
function appVis(e){return e.style.display!=='none'&&!(e.id=='hud'?false:e.childElementCount==0&&!e.textContent.trim())}
function setOpen(e){open=e;render()}
function render(){if(!on)return;const list=cands().filter(e=>e.id=='hud'||appVis(e));
 for(const e of cands()){e.classList.add('msheet');if(!e.dataset.mid)e.dataset.mid=++uid;const was=seen.get(e.dataset.mid),now=e.id=='hud'||appVis(e);
  if(now&&was!==true&&!NOAUTO.has(e.id)&&Date.now()-t0>2500)open=e;seen.set(e.dataset.mid,now)}
 if(open&&!list.includes(open))open=null;
 for(const e of list)e.classList.toggle('mcol',e!==open);
 const sig=list.map(e=>e.dataset.mid+(e===open?'*':'')).join(',');if(dock.dataset.sig===sig)return;dock.dataset.sig=sig;dock.innerHTML='';
 for(const e of list){const b=document.createElement('button');b.textContent=name(e);b.className=e===open?'on':'';b.dataset.for=e.id||e.dataset.mid;b.onclick=()=>setOpen(open===e?null:e);dock.appendChild(b)}}
function apply(){const m=mq();if(m===on)return;on=m;document.body.classList.toggle('mob',m);if(!m){cands().forEach(e=>e.classList.remove('msheet','mcol'));return}
 // first pass: everything starts collapsed, so the scene is visible
 t0=Date.now();open=null;for(const e of cands())seen.set((e.dataset.mid||(e.dataset.mid=++uid)),e.id=='hud'||appVis(e));render()}
addEventListener('resize',apply);addEventListener('orientationchange',()=>setTimeout(apply,200));
setTimeout(()=>{apply();setInterval(render,300)},1500);
window.MOB={apply,render,open:id=>{const e=document.getElementById(id);if(e)setOpen(e)},get on(){return on},get openId(){return open&&(open.id||open.dataset.mid)}};
})();
