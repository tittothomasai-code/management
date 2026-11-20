// Use the existing hosting connection. Never print environment values.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const token=process.env.NETLIFY_AUTH_TOKEN;
if(!token)throw Error('The hosting connection is unavailable.');
const plan=JSON.parse(await readFile('.github/well-workspace-release.json','utf8'));
async function api(path,options={}){const r=await fetch('https://api.netlify.com/api/v1'+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}});if(!r.ok)throw Error('Hosting operation failed with HTTP '+r.status+' at '+path.split('?')[0]);return r.status===204?null:r.json();}
const sites=[];for(let page=1;page<=20;page++){const rows=await api('/sites?per_page=100&page='+page);sites.push(...rows);if(rows.length<100)break;}
const matches=sites.filter(s=>s.custom_domain==='robotyx.systems'||s.domain_aliases?.includes('robotyx.systems'));
if(matches.length!==1)throw Error('Expected one production Robotyx site.');
const site=await api('/sites/'+matches[0].id),deploy=site.published_deploy;
if(!deploy?.id||!site.build_settings?.repo_url?.includes('tittothomasai-code/the-dome')||site.build_settings.repo_branch!=='main')throw Error('The production site is not on the reviewed repository branch.');
const report={phase:plan.phase,siteId:site.id,siteName:site.name,domain:site.custom_domain,rollbackDeploy:deploy.id,rollbackCommit:deploy.commit_ref,previousPublishedAt:deploy.published_at,buildCommand:site.build_settings.cmd,buildDirectory:site.build_settings.dir,stopBuilds:site.build_settings.stop_builds,locked:deploy.locked,sourceHead:plan.sourceHead,expectedVersion:plan.version};
await mkdir('release-evidence/well-host',{recursive:true});
await writeFile('release-evidence/well-host/preflight.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
if(plan.phase==='build'){
 if(!/^[0-9a-f]{40}$/.test(plan.sourceHead)||plan.version!=='2.25.18')throw Error('The reviewed release source is missing.');
 const builds=await api('/sites/'+site.id+'/builds?per_page=10');
 const existing=builds.find(b=>b.deploy?.commit_ref===plan.sourceHead&&!b.done)||null;
 const build=existing||await api('/sites/'+site.id+'/builds',{method:'POST',body:JSON.stringify({clear_cache:false})});
 await writeFile('release-evidence/well-host/build.json',JSON.stringify({buildId:build.id,deployId:build.deploy_id||build.deploy?.id,sourceHead:plan.sourceHead,rollbackDeploy:deploy.id},null,2));
 console.log(JSON.stringify({phase:'build-requested',buildId:build.id,deployId:build.deploy_id||build.deploy?.id}));
}else if(plan.phase!=='inspect')throw Error('Unsupported release phase.');
