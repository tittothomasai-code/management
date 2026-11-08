// Assemble this dashboard release without replacing unrelated production features.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
const repo=path.dirname(new URL(import.meta.url).pathname);
const [baselineArg,outArg,manifestArg]=process.argv.slice(2);
if(!baselineArg||!outArg||!manifestArg)throw new Error('Usage: node operations_release.mjs VERIFIED_BASELINE EMPTY_OUTPUT BASELINE_MANIFEST');
const baseline=path.resolve(baselineArg),out=path.resolve(outArg);
if(out===repo||out===baseline||out.startsWith(baseline+path.sep))throw new Error('Output must be separate from source and baseline');
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw new Error('Output must be empty');
const manifest=JSON.parse(fs.readFileSync(path.resolve(manifestArg)));
for(const f of manifest.files){
 const bytes=fs.readFileSync(path.join(baseline,f.path));
 if(crypto.createHash('sha1').update(bytes).digest('hex')!==f.sha1)throw new Error('Baseline mismatch: '+f.path);
}
fs.mkdirSync(out,{recursive:true});
for(const f of manifest.files){const p=path.join(out,f.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(baseline,f.path),p)}
const runtime=['intro.js','ext.js','ext2.js','ext3.js','ext4.js','index.html','main.js','operations.css','operations.js','operations_data.js','operations_plots.js','operations_scene.js','physics.js','player.js','start.js','ui.js','wdash.js','wwell.js'];
const base='e0ae66a061d1a6cf5c5cb7da0449ea4c5c1afa82';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'operations-release-'));
function replace(s,a,b){if(!s.includes(a))throw new Error('Integration anchor missing: '+a);return s.replace(a,b)}
try{
 const intro=path.join(out,'intro.js');
 fs.writeFileSync(intro,replace(fs.readFileSync(intro,'utf8'),"'safety','wdash'","'safety','wdash','operations'"));
 for(const f of runtime){
  if(f==='intro.js')continue;
  const target=path.join(out,f),current=fs.readFileSync(path.join(repo,f),'utf8');
  if(!fs.existsSync(target)){fs.writeFileSync(target,current);continue}
  let production=fs.readFileSync(target,'utf8');
  // These small overlapping hooks also carry newer, unrelated production imports.
  if(f==='ext.js')production=replace(production,'./ext2.js?v=c5151','./ext2.js?v=ops2');
  else if(f==='ext2.js')production=replace(production,'./ext3.js?v=c5151','./ext3.js?v=ops2');
  else if(f==='ext3.js'){
   production=replace(production,'./ext4.js?v=h2','./ext4.js?v=ops2');
   production=replace(production,'./ui.js?v=b10','./ui.js?v=ops1');
   production=replace(production,'./player.js?v=592','./player.js?v=ops2');
  }else if(f==='main.js'){
   production=replace(production,'./physics.js?v=b4','./physics.js?v=ops1');
   production=replace(production,'./ext.js?v=c5151','./ext.js?v=ops2');
   production=replace(production,'setUnder,startConn,explode:','setUnder,startConn,act,explode:');
  }else if(f==='index.html'){
   production=replace(production,'./intro.js?v=i1','./intro.js?v=ops1');
   production=replace(production,'./main.js?v=c5151','./main.js?v=ops2');
   production=replace(production,'./start.js?v=s39','./start.js?v=ops2');
   production=replace(production,'<button id="conn">','<button id="opsDashboard" type="button">Drilling operations dashboard</button>\n<button id="conn">');
  }else{
   const original=execFileSync('git',['show',base+':'+f],{cwd:repo});
   const a=path.join(tmp,'production'),b=path.join(tmp,'base'),c=path.join(tmp,'dashboard');
   fs.writeFileSync(a,production);fs.writeFileSync(b,original);fs.writeFileSync(c,current);
   const m=spawnSync('git',['merge-file','-p',a,b,c],{encoding:'utf8'});
   if(m.status!==0)throw new Error('Integration conflict: '+f);
   production=m.stdout;
  }
  fs.writeFileSync(target,production);
 }
 const changed=manifest.files.filter(f=>crypto.createHash('sha1').update(fs.readFileSync(path.join(out,f.path))).digest('hex')!==f.sha1).map(f=>f.path);
 if(changed.some(f=>!runtime.includes(f)))throw new Error('Unexpected change outside dashboard runtime');
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
 fs.writeFileSync(path.join(out,'operations-release.json'),JSON.stringify({dashboard_commit:commit,baseline_deploy:manifest.deploy_id,changed_files:changed,new_files:runtime.filter(f=>!manifest.files.some(x=>x.path===f))},null,2)+'\n');
 console.log('Assembled dashboard '+commit+' on production '+manifest.deploy_id+'; unchanged production files preserved');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
