import {readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function patchGameHtml(html){
 const guard='./bha-builder/guard.js',boot='./bha-builder/boot.js';
 if(html.includes(guard)&&html.includes(boot))return html;
 if(html.includes(guard)||html.includes(boot))throw Error('Partial BHA integration: review the existing script tags.');
 const map=/<script\b[^>]*type=["']importmap["'][^>]*>[\s\S]*?<\/script>/i.exec(html);
 if(!map)throw Error('Keep the game import map before the BHA module.');
 const at=map.index+map[0].length;
 return html.slice(0,at)+'\n<script src="'+guard+'?v=1.0.2"></script>\n<script type="module" src="'+boot+'?v=1.0.2"></script>'+html.slice(at);
}
export function patchWorkspaceHtml(html){
 if(html.includes('./bha-builder/context-launcher.js'))return html.replace(/\.\/bha-builder\/context-launcher\.js(?:\?[^"']*)?/g,'./bha-builder/context-launcher.js?v=1.0.3');
 if(!/<\/body>/i.test(html))throw Error('Workspace has no closing body tag.');
 return html.replace(/<\/body>/i,'<script type="module" src="./bha-builder/context-launcher.js?v=1.0.3"></script></body>');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=resolve(process.argv[2]||new URL('../drilling/',import.meta.url).pathname);
 await access(resolve(root,'bha-builder/boot.js'));
 // Validate every change before writing. This patches an existing current release;
 // it never replaces other game scripts, workspaces or Field folders.
 const changes=[];
 for(const name of ['index.html','ops.html','wellplan.html']){
  const file=resolve(root,name),before=await readFile(file,'utf8'),after=name==='index.html'?patchGameHtml(before):patchWorkspaceHtml(before);
  changes.push({file,before,after});
 }
 for(const {file,before,after}of changes)if(before!==after){await writeFile(file+'.before-bha',before,{flag:'wx'});await writeFile(file,after);}
 console.log('BHA entry points added. No merge, publish or deployment performed.');
}
