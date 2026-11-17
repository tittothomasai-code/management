import './context-launcher.js';
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./style.css',import.meta.url);document.head.append(css);
let attempts=0;async function start(){if(window.G?._scene){const {installBhaBuilder}=await import('./bridge.js');installBhaBuilder(window.G);return;}if(++attempts<240)setTimeout(start,250);else console.warn('BHA builder: the game is not ready.');}start();
