import {mkdir, writeFile} from 'node:fs/promises';
const host='drilling.robotyx.systems',token=process.env.NETLIFY_AUTH_TOKEN;
if(!token)throw Error('NETLIFY_AUTH_TOKEN repository secret is missing or empty.');
async function api(path){const response=await fetch('https://api.netlify.com/api/v1'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});if(!response.ok)throw Error('Netlify API '+path.split('?')[0]+' returned HTTP '+response.status);return response.json();}
const matches=[];
for(let page=1;page<=20;page++){const sites=await api('/sites?per_page=100&page='+page);for(const site of sites){if(site.custom_domain===host||(site.domain_aliases||[]).includes(host)||[site.url,site.ssl_url].some(url=>{try{return new URL(url).hostname===host;}catch{return false;}}))matches.push(site);}if(sites.length<100)break;}
if(matches.length!==1)throw Error('Expected exactly one Netlify site matching '+host+'; found '+matches.length);
const site=await api('/sites/'+matches[0].id),id=site.published_deploy?.id;if(!id)throw Error('No published deploy found for the target site.');
const deploy=await api('/deploys/'+id),files=await api('/sites/'+site.id+'/files'),functions=await api('/sites/'+site.id+'/functions');
const report={site:{id:site.id,name:site.name,domain:host},rollbackDeploy:{id:deploy.id,state:deploy.state,branch:deploy.branch},files:files.map(f=>({path:f.path,sha:f.sha,size:f.size})),functionInventory: functions.map(f=>({keys:Object.keys(f),names:(f.functions||[]).map(x=>typeof x==='string'?x:x.name),name:f.name,sha:f.sha})),deployRuntimeFields:Object.fromEntries(['functions','functions_config','edge_functions','server','function_schedules'].filter(k=>deploy[k]!=null).map(k=>[k,{type:typeof deploy[k],count:typeof deploy[k]==='object'?Object.keys(deploy[k]).length:0}]))};
await mkdir('release-evidence',{recursive:true});await writeFile('release-evidence/preflight.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({site:report.site,rollbackDeploy:report.rollbackDeploy,fileCount:report.files.length,functionGroups:report.functionInventory,deployRuntimeFields:report.deployRuntimeFields}));
if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,'## Drilling release preflight\nTarget: '+host+'\n\nRollback deploy: `'+id+'`\n\nPublished files: '+files.length+'\n\nNo production changes performed during preflight.\n',{flag:'a'});
