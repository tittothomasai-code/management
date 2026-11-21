// Lazy DD workspace. Operations state stays in its original host while this view is open.
export function initDDWorld({button,getContext}){
 let viewer=null,loading=false,generation=0;
 if(!document.querySelector('link[data-dd-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='./dd-world/style.css?v=1';css.dataset.ddStyle='1';document.head.append(css);}
 button.onclick=async()=>{if(viewer||loading)return;loading=true;button.disabled=true;const token=++generation;try{const {mountDD}=await import('./dd-world/app.mjs?v=1');const next=await mountDD({getContext,onExit:()=>{generation++;viewer=null;}});if(token===generation)viewer=next;else next?.dispose();}finally{loading=false;button.disabled=false;}};
 return {dispose(){viewer?.dispose();viewer=null;},update(){viewer?.update();},stats:()=>viewer?.stats()||null};
}
