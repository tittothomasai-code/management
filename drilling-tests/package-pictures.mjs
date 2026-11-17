const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),output=process.env.PICTURES_OUTPUT||'/workspace/shared/downloads',gallery=resolve(output,'robotyx-pictures');await mkdir(gallery,{recursive:true});
const groups=[
 ['ops-pumps','Ops pump states',resolve(root,'drilling-tests/pump-evidence')],
 ['ops-surveys','Ops survey popup',resolve(root,'drilling-tests/survey-alert-evidence')],
 ['bha-components','All BHA components',resolve(root,'drilling-tests/bha-component-pictures')],
 ['bha-game','BHA in the game and reports',resolve(root,'drilling-tests/bha-evidence')],
 ['field-world','Field world',resolve(root,'../the-dome/docs/field-world/evidence')],
 ['field-assets','Field equipment and component inspection',resolve(root,'../the-dome/docs/field-pumps/evidence')],
];
const records=[];
async function collect(dir,group,title,base=dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())await collect(path,group,title,base);else if(entry.name.endsWith('.png')){const name=relative(base,path).replaceAll('\\','/'),file='pictures/'+group+'/'+name;await mkdir(resolve(gallery,file,'..'),{recursive:true});await cp(path,resolve(gallery,file));records.push({group,category:title,name:name.replace(/\.png$/,'').replaceAll('/',' · ').replaceAll('-',' '),file});}}}
for(const [group,title,dir]of groups)try{await collect(dir,group,title);}catch(error){if(error.code!=='ENOENT')throw error;}
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const figure=record=>`<figure><a href="${esc(record.file)}" target="_blank"><img src="${esc(record.file)}" alt="${esc(record.name)}" loading="lazy"></a><figcaption>${esc(record.name)}</figcaption></figure>`;
const style=`body{margin:0;background:#f0f3f5;color:#172b37;font:16px/1.5 system-ui}main{max-width:1440px;margin:auto;padding:24px}h1{margin:0 0 8px;font-size:28px}h2{margin:28px 0 14px}p{margin:6px 0 18px;color:#405866}nav{display:flex;gap:16px;flex-wrap:wrap}a{color:#176048}section>div,.overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}figure{margin:0;background:white;border-radius:8px;padding:12px;min-width:0}figure>a{height:260px;display:flex;align-items:center;justify-content:center;background:#e1e6e8}img{max-width:100%;max-height:100%;object-fit:contain}figcaption{padding:10px 2px 0;font-weight:500}small{color:#526c7b}footer{margin-top:24px;overflow-wrap:anywhere}.overview figure>a{height:290px}@media(max-width:500px){main{padding:14px}figure>a{height:240px}}`;
const sections=groups.map(([group,title])=>`<section id="${group}"><h2>${title}</h2><div>${records.filter(r=>r.group===group).map(figure).join('')}</div></section>`).join('');
const intro=`<h1>Robotyx picture gallery</h1><p>${records.length} full-resolution pictures. Click a picture to open the original. Ops captures use SIM data; BHA and field pictures are original schematic model renders and earlier stored SIM captures. They are not live equipment photographs.</p>`;
await writeFile(resolve(gallery,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Robotyx pictures</title><style>${style}</style></head><body><main>${intro}<nav>${groups.map(([g,t])=>`<a href="#${g}">${t}</a>`).join('')}</nav>${sections}<footer><small>Game integration source: ${head}. Production release pending hosting access.</small></footer></main></body></html>`);
const choices=[['ops-pumps','card-on-390.png','Pumps ON'],['ops-pumps','card-off-390.png','Pumps OFF'],['ops-pumps','card-stale-390.png','Current state UNKNOWN'],['ops-surveys','survey-green-390.png','Survey received'],['bha-components','pdc-bit.png','PDC bit · full view and detail'],['field-world','desktop-overview.png','Field world']];
const featured=choices.map(([g,file,title])=>{const found=records.find(r=>r.group===g&&r.file.endsWith('/'+file));return found?{...found,name:title}:null;}).filter(Boolean);
await writeFile(resolve(gallery,'overview.html'),`<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body><main><h1>Robotyx · pumps, surveys and asset pictures</h1><p>SIM previews · ${records.length} original full-resolution pictures in the gallery</p><div class="overview">${featured.map(figure).join('')}</div></main></body></html>`);
await writeFile(resolve(gallery,'pictures-manifest.json'),JSON.stringify({head,count:records.length,categories:groups.map(([id,title])=>({id,title,count:records.filter(r=>r.group===id).length})),pictures:records},null,2)+'\n');
await writeFile(resolve(gallery,'README.txt'),'Open index.html for the full picture gallery. Every PNG can also be opened directly.\nSIM test captures and original schematic model renders; not certified drawings or live equipment photos.\nOps graphic states are inferred from current flow; UNKNOWN is used when readings are stale, missing or depth-indexed.\nThe field folders include earlier stored captures.\nSource head: '+head+'\n');
const server=createServer(async(req,res)=>{try{const path=resolve(gallery,'.'+new URL(req.url,'http://local').pathname);if(!path.startsWith(gallery+'/'))return res.writeHead(403).end();const body=await readFile(path);res.writeHead(200,{'Content-Type':extname(path)==='.png'?'image/png':'text/html'}).end(body);}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto('http://127.0.0.1:'+server.address().port+'/overview.html');await page.screenshot({path:resolve(output,'robotyx-pictures-overview.png'),fullPage:true});await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');if(await page.locator('img').count()!==records.length)throw Error('Gallery count mismatch');}finally{await browser.close();await new Promise(r=>server.close(r));}
const archive=resolve(output,'robotyx-all-pictures.zip');execFileSync('python3',['-c',`import sys,zipfile,pathlib
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,compresslevel=3) as z:
 for p in root.rglob('*'):
  if p.is_file():z.write(p,'robotyx-pictures/'+str(p.relative_to(root)))`,gallery,archive]);
console.log(JSON.stringify({head,pictures:records.length,archive,gallery:resolve(gallery,'index.html')}));
