// Publish the reviewed static Sign build while reusing the currently published proxy bundle.
// The hosting token and private runtime settings are never written to disk or output.
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const token=process.env.NETLIFY_AUTH_TOKEN;if(!token)throw Error('Hosting connection unavailable.');
const id='421e57ea-7c3f-45d4-a469-d7ac21ccbdb3';
async function api(path,options={}){const r=await fetch('https://api.netlify.com/api/v1'+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers}});if(!r.ok)throw Error('Hosting operation failed: HTTP '+r.status+' '+path.split('?')[0]);return r.status===204?null:r.json();}
const artifact=JSON.parse(gunzipSync(await readFile('.github/sign-pages-release.json.gz'))),sha=(v,kind='sha256')=>createHash(kind).update(v).digest('hex');
const bridge=await fetch('https://robotyx.systems/go/sign-callback.js',{cache:'no-store'});if(!bridge.ok||sha(Buffer.from(await bridge.arrayBuffer()))!==artifact.callbackSha256)throw Error('The reviewed root callback must be published before Sign.');
const site=await api('/sites/'+id);if(site.custom_domain!=='sign.robotyx.systems')throw Error('Unexpected site.');
if(site.published_deploy.id!==artifact.previousSignDeploy)throw Error('Sign changed since review; recheck before publishing.');
const previous=site.published_deploy.id,metadata=await api('/sites/'+id+'/functions'),funcs=metadata.functions;
if(!Array.isArray(funcs)||funcs.length!==1||funcs[0].n!=='esign-proxy'||!/^[a-f0-9]{64}$/.test(funcs[0].d))throw Error('Unexpected signing proxy inventory.');
const current=await api('/deploys/'+previous),proxy=funcs[0],files={},content=new Map();
for(const [path,encoded] of Object.entries(artifact.files)){if(!path.startsWith('/')||path.includes('..'))throw Error('Invalid artifact path.');const bytes=Buffer.from(encoded,'base64'),hash=sha(bytes,'sha1');files[path]=hash;content.set(hash,{path,bytes});}
const deploy=await api('/sites/'+id+'/deploys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:true,async:true,title:'RBX-2518 Sign PDF pages and field placement '+artifact.source,files,functions:{'esign-proxy':proxy.d},functions_config:{'esign-proxy':{build_data:proxy.bd,memory:proxy.m,priority:proxy.p,region:proxy.rg}},functions_region:current.functions_region})});
console.log(JSON.stringify({phase:'draft-created',id:deploy.id,source:artifact.source,previous,version:artifact.version,proxyBundlePreserved:true}));
let state=deploy;
for(let i=0;i<90;i++){
 state=await api('/deploys/'+deploy.id);if(state.state==='error')throw Error('Hosting rejected the draft deployment.');
 if((state.required_functions||[]).length)throw Error('Existing signing proxy bundle was not reused; refusing publication.');
 if(state.state==='uploading'||(state.required||[]).length){for(const hash of state.required||[]){const file=content.get(hash);if(!file)throw Error('Unexpected requested file.');await api('/deploys/'+deploy.id+'/files'+file.path,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file.bytes});}}
 if(state.state==='ready')break;await new Promise(r=>setTimeout(r,1500));
}
if(state.state!=='ready')throw Error('Draft did not become ready.');
const preview=state.deploy_ssl_url||state.deploy_url,html=await fetch(preview).then(r=>r.text());if(!html.includes('robotyx-build-version')||!html.includes(artifact.version))throw Error('Draft version check failed.');
const check=await fetch(preview+'/.netlify/functions/esign-proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'access'})});if(check.status!==401&&check.status!==403)throw Error('Draft proxy authentication check failed.');
const now=await api('/sites/'+id);if(now.published_deploy.id!==previous)throw Error('Published Sign changed during validation.');
await api('/sites/'+id+'/deploys/'+deploy.id+'/restore',{method:'POST'});
let live;for(let i=0;i<15;i++){live=await api('/sites/'+id);if(live.published_deploy.id===deploy.id)break;await new Promise(r=>setTimeout(r,1000));}const after=await api('/sites/'+id+'/functions');if(live.published_deploy.id!==deploy.id||after.functions?.[0]?.d!==proxy.d){if(live.published_deploy.id===deploy.id)await api('/sites/'+id+'/deploys/'+previous+'/restore',{method:'POST'});throw Error('Published manifest verification failed; the previous signing deployment is retained or restored.');}
console.log(JSON.stringify({phase:'sign-published',id:deploy.id,source:artifact.source,version:artifact.version,previous,proxyBundlePreserved:true,privateRuntimeSettingsUnchanged:true,realSends:0}));
