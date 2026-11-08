// rtoc_input.js — deterministic, DOM-free key mapping + joint/view controller for Steve's RTOC.
// Intended to replace rtoc.js key() at handoff. Preserves: Escape (overlay first, then close), G (bottom layer cycle),
// A (geosteering roof), swallow of game keys while modal open. F1 is NOT bound anywhere in game-v5151 (verified read-only) -> passes through.
// Tab is never consumed (keyboard accessibility). No execution (Hold/Slide/Rotary/Survey) keys until a SIM-only command contract exists.
export const VIEWS=['mode','torque','wob','plan'];// 1..4 -> Slide/Rotary, Torque, WOB, Plan vs Actual
export const SHORTCUTS=[
 ['[ / ]','Previous / next joint'],['Shift+[ / Shift+]','Jump 5 joints'],['\\','Back to current (drilling) joint'],
 ['1–4','View: Slide/Rotary · Torque · WOB · Plan vs Actual'],['C','Frame whole well / selected joint'],
 ['G','Bottom layer: Telemetry ↔ Geosteering'],['A','Geosteering roof on/off'],['?','Shortcut overlay'],['Esc','Close overlay, then RTOC']];
// keys swallowed (not passed to the sim) while RTOC is open — superset of existing list
const OWN=/^(\[|\]|\{|\}|\\|[1-4]|[cCgGaA])$/;
const GAME=new Set(['F8','w','s','d','W','S','D','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','v','V','b','B','n','N','c','C','h','H','l','L','r','R','y','Y']);
export function isTyping(t){if(!t)return false;const n=(t.tagName||'').toLowerCase();return n=='input'||n=='textarea'||n=='select'||!!t.isContentEditable}
/** Pure: event-like {key,code,repeat,ctrlKey,metaKey,altKey,shiftKey,isComposing,target,inButton} + ctx {open,intro,overlay}
 * -> {action, arg?, consume:boolean, prevent:boolean} | null (ignore entirely) */
export function mapKey(e,ctx={}){
 if(!ctx.open)return null;
 if(e.isComposing||e.key=='Process'||e.keyCode===229)return null;
 if(e.ctrlKey||e.metaKey||e.altKey)return null;
 if(isTyping(e.target)||ctx.intro)return null;
 const k=e.key;if(k=='Tab'||k=='F1')return null;
 if(e.repeat)return GAME.has(k)?{action:null,consume:true,prevent:false}:null;// never act on autorepeat, but still block sim
 const A=(action,arg)=>({action,arg,consume:true,prevent:true});
 if(k=='Escape')return A(ctx.overlay?'overlayClose':'close');
 if(ctx.overlay){if(k=='?'||(k=='/'&&e.shiftKey))return A('overlayClose');// overlay open: block only RTOC + sim keys (no action); everything else (Tab, F1, browser keys) passes
  if(OWN.test(k)||GAME.has(k))return {action:null,consume:true,prevent:false};return null}
 if(k=='?')return A('overlayOpen');
 const c=e.code;
 if(k=='['||k=='{'||c=='BracketLeft')return A('joint',e.shiftKey||k=='{'?-5:-1);
 if(k==']'||k=='}'||c=='BracketRight')return A('joint',e.shiftKey||k=='}'?5:1);
 if(k=='\\'||c=='Backslash')return A('jointCurrent');
 if(/^[1-4]$/.test(k))return A('view',VIEWS[+k-1]);
 if(k=='c'||k=='C')return A('frame');
 if(k=='g'||k=='G')return A('layer');
 if(k=='a'||k=='A')return A('roof');
 if(GAME.has(k)&&!(e.inButton&&(k==' '||k=='Enter')))return {action:null,consume:true,prevent:false};
 return null}
/** Joint selection controller. joints: ascending array of {n,open?}. sel=null means "follow current".
 * Loads are serialized: while busy, joint moves are DROPPED (not queued). */
export function createController(o={}){
 const st={sel:null,view:o.view||'mode',frame:o.frame||'joint',layer:o.layer||'tele',roof:!!o.roof,overlay:false,busy:false,dropped:0};
 const emit=o.onChange||(()=>{}),load=o.load||null;
 function idx(J){if(!J.length)return -1;if(st.sel==null){const i=J.findIndex(j=>j.open);return i<0?J.length-1:i}const i=J.findIndex(j=>j.n==st.sel);return i}
 function moveJoint(J,step){if(st.busy){st.dropped++;return false}if(!J.length)return false;let i=idx(J);if(i<0)i=J.length-1;
  const ni=Math.max(0,Math.min(J.length-1,i+step));if(ni===i&&st.sel!=null)return false;const j=J[ni];const cur=J.findIndex(x=>x.open);
  const next=(ni===cur||(cur<0&&ni===J.length-1))?null:j.n;if(next===st.sel)return false;st.sel=next;
  if(load){st.busy=true;emit('busy',st);Promise.resolve().then(()=>load(st.sel)).catch(()=>{}).finally(()=>{st.busy=false;emit('joint',st)})}else emit('joint',st);return true}
 function dispatch(r,J){if(!r||!r.action)return false;switch(r.action){
  case 'joint':return moveJoint(J||o.joints?.()||[],r.arg);
  case 'jointCurrent':if(st.busy){st.dropped++;return false}if(st.sel==null)return false;st.sel=null;emit('joint',st);return true;
  case 'view':if(st.view==r.arg)return false;st.view=r.arg;emit('view',st);return true;
  case 'frame':st.frame=st.frame=='joint'?'well':'joint';emit('frame',st);return true;
  case 'layer':st.layer=st.layer=='tele'?'geo':'tele';emit('layer',st);return true;
  case 'roof':st.roof=!st.roof;emit('roof',st);return true;
  case 'overlayOpen':st.overlay=true;emit('overlay',st);return true;
  case 'overlayClose':st.overlay=false;emit('overlay',st);return true;
  case 'close':emit('close',st);return true}return false}
 return {st,dispatch,moveJoint,setSel(v){st.sel=v},reset(){st.sel=null;st.overlay=false;st.busy=false}}}
/** Optional DOM adapter. Capture-phase so the sim never sees consumed keys. Returns unbind(). */
export function bindKeys(target,ctrl,o={}){
 const h=e=>{const inButton=!!(e.target&&e.target.closest&&o.root&&e.target.closest(o.root+' button'));
  const r=mapKey({key:e.key,code:e.code,repeat:e.repeat,ctrlKey:e.ctrlKey,metaKey:e.metaKey,altKey:e.altKey,shiftKey:e.shiftKey,isComposing:e.isComposing,keyCode:e.keyCode,target:e.target,inButton},
   {open:o.isOpen?o.isOpen():true,intro:o.isIntro?o.isIntro():false,overlay:ctrl.st.overlay});
  if(!r)return;if(r.prevent)e.preventDefault();if(r.consume)e.stopImmediatePropagation();ctrl.dispatch(r,o.joints?o.joints():undefined)};
 target.addEventListener('keydown',h,true);return ()=>target.removeEventListener('keydown',h,true)}
