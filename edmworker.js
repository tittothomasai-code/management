// edmworker.js v5.9.2.4: parses an EDM file off the main thread. The file never leaves the device.
import {parseFile} from './edm.js?v=5924';
self.onmessage=async e=>{const {name,buf,units}=e.data;try{const r=await parseFile(name,buf,{units,onProg:(p,m)=>self.postMessage({prog:p,msg:m})});self.postMessage({done:r})}catch(err){self.postMessage({error:String(err.message||err)})}};
