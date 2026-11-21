// One editor and one origin-local library across game, Ops and DD workspaces.
import {watchSnapshot} from '../opsnow_watch_zones.mjs';
let panel=null,frame=null,opener=null;
let lastSource='';
function sourceContext(){if(!frame)return;const s=watchSnapshot(),designs=s?.policy?.bha_designs||[],key=JSON.stringify([s?.policy?.scope,designs]);if(key===lastSource)return;lastSource=key;frame.contentWindow?.postMessage({type:'robotyx-bha-source-designs',designs},location.origin);}
export function openBhaBuilder(button=document.activeElement){
 if(window.G?.bhaBuilder){window.G.bhaBuilder.enter();if(button?.dataset?.bhaContext)window.G.bhaBuilder.view.ui.querySelector('[data-action="exit"]').textContent='Back to '+button.dataset.bhaContext;return;}
 opener=button;
 if(!panel){
  panel=document.createElement('section');panel.id='bha-context-panel';
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','BHA builder');
  Object.assign(panel.style,{position:'fixed',inset:'0',zIndex:'2147483000',background:'#0d1b28'});
  frame=document.createElement('iframe');frame.title='BHA builder';frame.src=new URL('./index.html?embedded=1',import.meta.url);
  frame.addEventListener('load',()=>{lastSource='';sourceContext();});Object.assign(frame.style,{width:'100%',height:'100%',border:'0',display:'block'});panel.append(frame);document.body.append(panel);
 }else{panel.hidden=false;frame.contentWindow.postMessage({type:'robotyx-bha-enter'},location.origin);}
 sourceContext();frame.focus();
}
addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.type!=='robotyx-bha-close')return;
 panel.hidden=true;opener?.focus();
});
function install(){
 for(const [selector,context]of [['#ddc .hd','Directional drilling'],['#dwOperations .ops-header > .ops-flex','Operations'],['.on-views','Operations']]){
  const host=document.querySelector(selector);if(!host||host.querySelector('[data-bha-context]'))continue;
  const button=document.createElement('button');button.type='button';button.dataset.bhaContext=context;button.textContent='BHA builder';button.setAttribute('aria-label','Open BHA builder');
  button.onclick=()=>openBhaBuilder(button);host.append(button);
 }
}
install();new MutationObserver(install).observe(document.body,{subtree:true,childList:true});
setInterval(()=>{if(panel)sourceContext();},1000);
