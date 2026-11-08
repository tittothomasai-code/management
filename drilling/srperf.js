// srperf.js: small shared perf readout for the showrooms (A, B, later C). Off by default; button "⏱" or key P toggles; saved in localStorage 'dw_srperf'.
// API (also GX.srperf): attach({id, el, lod:()=>'M', ready:()=>bool, match:/regex for model URLs/}), detach(id), show(on), isOn(), stats().
// Shows: load time (attach -> ready), live FPS (1 s window), model MB downloaded (Resource Timing for URLs matching `match`), LOD in use. SIM showroom only.
const K='dw_srperf',$=id=>document.getElementById(id);const P={cur:null,raf:0,fr:0,t0:0,fps:0,load:null,on:false};
export const isOn=()=>{try{return localStorage.getItem(K)=='1'}catch(e){return false}};
function mb(re){if(!re)return 0;let b=0;try{for(const e of performance.getEntriesByType('resource'))if(re.test(e.name))b+=e.transferSize||e.encodedBodySize||0}catch(e){}return b/1048576}
export function stats(){const c=P.cur;if(!c)return null;let lod='–';try{lod=c.lod?.()||'–'}catch(e){}return {id:c.id,loadMs:P.load,fps:Math.round(P.fps*10)/10,mb:Math.round(mb(c.match)*100)/100,lod,on:P.on}}
function css(){if($('srpCss'))return;const s=document.createElement('style');s.id='srpCss';s.textContent=`#srpBox{position:absolute;right:10px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:9;min-width:150px;padding:8px 10px;border-radius:6px;background:rgba(14,17,21,.86);border:1px solid #2c333b;color:#e8ebef;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:none}#srpBox b{color:#9aa3ac;font-weight:400;display:inline-block;width:62px}#srpBtn{position:absolute;right:10px;bottom:calc(48px + env(safe-area-inset-bottom));z-index:9;min-width:34px;min-height:30px;border-radius:6px;border:1px solid #2c333b;background:rgba(22,26,31,.82);color:#e8ebef;cursor:pointer;font:13px system-ui}#srpBtn[aria-pressed=true]{border-color:#c9a46a}`;document.head.appendChild(s)}
function paint(){const b=$('srpBox');if(!b)return;const s=stats();if(!s){b.hidden=true;return}b.hidden=!P.on;if(!P.on)return;
 b.innerHTML=`<div><b>Showroom</b>${s.id} <span style="color:#9aa3ac">SIM</span></div><div><b>Load</b>${s.loadMs==null?'…':(s.loadMs/1000).toFixed(1)+' s'}</div><div><b>FPS</b>${s.fps.toFixed(1)}</div><div><b>Models</b>${s.mb.toFixed(2)} MB</div><div><b>LOD</b>${s.lod}</div>`}
function loop(t){const c=P.cur;if(!c)return;P.fr++;if(!P.t0)P.t0=t;if(t-P.t0>=1000){P.fps=P.fr*1000/(t-P.t0);P.fr=0;P.t0=t;paint()}
 if(P.load==null){let r=false;try{r=!!c.ready?.()}catch(e){}if(r)P.load=Math.round(performance.now()-c.at)}P.raf=requestAnimationFrame(loop)}
export function show(on){P.on=!!on;try{localStorage.setItem(K,on?'1':'0')}catch(e){}const b=$('srpBtn');if(b)b.setAttribute('aria-pressed',P.on);paint();return P.on}
function key(e){if(!P.cur||(e.key!='p'&&e.key!='P')||/INPUT|TEXTAREA/.test(e.target?.tagName))return;show(!P.on);e.preventDefault();e.stopPropagation()}
export function attach(o){if(!o?.el)return null;detach();css();P.cur={...o,at:o.at||performance.now()};P.load=null;P.fps=0;P.fr=0;P.t0=0;P.on=isOn();
 const btn=document.createElement('button');btn.id='srpBtn';btn.type='button';btn.textContent='⏱';btn.title='Performance (P)';btn.setAttribute('aria-label','Performance readout (P)');btn.setAttribute('aria-pressed',P.on);btn.onclick=e=>{e.stopPropagation();show(!P.on)};
 const box=document.createElement('div');box.id='srpBox';box.setAttribute('aria-live','off');o.el.append(btn,box);addEventListener('keydown',key,true);paint();P.raf=requestAnimationFrame(loop);return API}
export function detach(id){if(!P.cur||(id&&P.cur.id!=id))return;cancelAnimationFrame(P.raf);removeEventListener('keydown',key,true);$('srpBtn')?.remove();$('srpBox')?.remove();P.cur=null}
const API={attach,detach,show,isOn,stats};if(typeof window!='undefined'){const pin=()=>{window.GX=window.GX||{};if(window.GX.srperf!==API)window.GX.srperf=API};pin();let n=0;const t=setInterval(()=>{pin();if(++n>60)clearInterval(t)},500)}
export default API
