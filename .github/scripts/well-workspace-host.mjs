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
 if(!/^[0-9a-f]{40}$/.test(plan.sourceHead)||plan.version!=='2.25.19')throw Error('The reviewed release source is missing.');
 const deployments=await api('/sites/'+site.id+'/deploys?per_page=15');
 const existing=deployments.find(d=>d.commit_ref===plan.sourceHead&&d.context==='production'&&!['error','failed','canceled','skipped'].includes(d.state));
 let target=existing?.id,buildId=existing?.build_id;
 if(!target){const build=await api('/sites/'+site.id+'/builds',{method:'POST',body:JSON.stringify({clear_cache:false})});buildId=build.id;target=build.deploy_id||build.deploy?.id;}
 if(!target&&buildId){const build=await api('/builds/'+buildId);target=build.deploy_id||build.deploy?.id;}
 if(!target)throw Error('The hosting build did not return a deployment.');
 const receipt={buildId,deployId:target,sourceHead:plan.sourceHead,rollbackDeploy:plan.rollbackDeploy||deploy.id};
 await writeFile('release-evidence/well-host/build.json',JSON.stringify(receipt,null,2));
 console.log(JSON.stringify({phase:'build-requested',...receipt}));
 for(let i=0;i<200;i++){
  const candidate=await api('/deploys/'+target);
  if(['error','failed','canceled','skipped'].includes(candidate.state))throw Error('The reviewed production build entered '+candidate.state+'.');
  if(candidate.state==='ready'){
   if(candidate.commit_ref!==plan.sourceHead)throw Error('The build source differs from the reviewed release.');
   const current=await api('/sites/'+site.id);
   if(current.published_deploy?.id!==target)throw Error('The reviewed build is ready but is not published. The existing published deploy was preserved.');
   const response=await fetch('https://robotyx.systems/well-folder',{cache:'no-store'});if(!response.ok)throw Error('The published folder route did not answer.');
   await writeFile('release-evidence/well-host/published.json',JSON.stringify({...receipt,published:true,version:plan.version,url:'https://robotyx.systems/well-folder'},null,2));
   console.log(JSON.stringify({phase:'published',...receipt,version:plan.version}));break;
  }
  if(i===199)throw Error('The reviewed production build did not become ready in time.');
  await new Promise(r=>setTimeout(r,3000));
 }
}else if(plan.phase!=='inspect')throw Error('Unsupported release phase.');
