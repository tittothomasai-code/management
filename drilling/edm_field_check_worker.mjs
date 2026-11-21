import {assessField} from './edm_field_check_core.mjs?v=selected-reference-1';
self.onmessage=e=>{try{self.postMessage({report:assessField(e.data.models,e.data.options)});}catch(error){self.postMessage({error:error.message});}};
