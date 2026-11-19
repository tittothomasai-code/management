import {planLanding} from './opsnow_landing_core.mjs?v=landing1119';
self.onmessage=e=>{try{self.postMessage({report:planLanding(e.data)});}catch(error){self.postMessage({error:error.message});}};
