import {analyze} from './engineering/analyze.mjs';
self.onmessage=event=>{const {id,payload}=event.data;try{self.postMessage({id,result:analyze(payload)});}catch(e){self.postMessage({id,error:e.message||'The model could not be calculated.'});}};
