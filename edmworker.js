// edmworker.js v5.9.4.1: parses an EDM file off the main thread, streaming from the local File/Blob (no whole-file read). Never uploads.
import {readBlob,world,legacyTables} from './edmstream.js?v=5942';import {build,analyse} from './edm.js?v=5924';
self.onmessage=async e=>{const {name,file,buf,units}=e.data;try{const blob=file||new Blob([buf]);const prog=(p,m)=>self.postMessage({prog:p,msg:m});
 const R=await readBlob(blob,name,{onProg:prog});prog(0.9,'building model');const W=world(R,{units,name});
 let M=null,A=null;if(W.wbs.length<=60){try{M=build(legacyTables(R),{units});A=analyse(M)}catch(err){M=A=null}}
 prog(1,'done');self.postMessage({done:{W,M,A,files:R.files,tables:R.cnt}})}catch(err){self.postMessage({error:String(err.message||err)})}};
