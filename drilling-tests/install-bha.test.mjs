import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patchGameHtml,patchWorkspaceHtml} from './install-bha.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('additive installer preserves current game and Field markup, and orders guards before handlers',()=>{
 const html='<head><script type="importmap">{"imports":{"three":"./vendor/three.module.js"}}</script><script src="./field-world/guard.js"></script></head><body><a href="./field-pumps/">Field pumps</a><script src="./home.js"></script></body>';
 const result=patchGameHtml(html);assert.ok(result.indexOf('importmap')<result.indexOf('bha-builder/boot.js'));assert.ok(result.indexOf('bha-builder/guard.js')<result.indexOf('field-world/guard.js'));
 assert.equal(result.replace(/\n<script src="\.\/bha-builder\/guard.js\?v=1.0.2"><\/script>\n<script type="module" src="\.\/bha-builder\/boot.js\?v=1.0.2"><\/script>/,''),html);
 assert.equal(patchGameHtml(result),result);assert.throws(()=>patchGameHtml('<head></head>'));
});
test('Ops and Well Plan integration is additive and repeatable',()=>{
 const html='<body><div id="live-data">preserved</div><script type="module" src="./opsnow.js"></script></body>',result=patchWorkspaceHtml(html);
 assert.equal(patchWorkspaceHtml(result),result);assert.equal(result.replace('<script type="module" src="./bha-builder/context-launcher.js?v=schematic1"></script>',''),html);
});
test('candidate entry files preserve the published source bytes around the added tags',()=>{
 const audit=JSON.parse(readFileSync(new URL('./bha-source-audit.json',import.meta.url),'utf8'));
 for(const name of ['index.html','ops.html','wellplan.html']){
  let html=readFileSync(new URL('../drilling/'+name,import.meta.url),'utf8');
  if(name==='ops.html')html=html.replace('./opsnow.js?v=schematic1','./opsnow.js?v=dr1115').replace('./opsnow.js?v=dd-world1','./opsnow.js?v=dr1115').replace('./opsnow.js?v=team1','./opsnow.js?v=dr1115').replace('<link rel="stylesheet" href="./opsnow_watch_zones.css?v=team1">\n','').replace('./opsnow.js?v=current-well1','./opsnow.js?v=dr1115').replace('<link rel="stylesheet" href="./opsnow_watch_zones.css?v=watch1">\n','').replace('./opsnow.js?v=watch1','./opsnow.js?v=dr1115').replace('./opsnow.js?v=opsref1118','./opsnow.js?v=dr1115').replace('./opsnow.js?v=spp100','./opsnow.js?v=dr1115').replace('./opsnow.js?v=depth1118','./opsnow.js?v=dr1115').replace('./opsnow.js?v=compact1117','./opsnow.js?v=dr1115').replace('./opsnow.js?v=pumps1117','./opsnow.js?v=dr1115').replace('./opsnow.js?v=survey1117','./opsnow.js?v=dr1115');
  html=html.replace('./bha-builder/context-launcher.js?v=schematic1','./bha-builder/context-launcher.js?v=1.0.3').replace('<script src="./bha-builder/guard.js?v=1.0.2"></script>\n<script type="module" src="./bha-builder/boot.js?v=1.0.2"></script>\n','').replace('<script type="module" src="./bha-builder/context-launcher.js?v=1.0.3"></script>','');
  const expected=name==='index.html'?audit.files.find(f=>f.path===name).sha256:audit.newWorkspaceEntries.find(f=>f.path===name).sourceSha256;
  assert.equal(createHash('sha256').update(html).digest('hex'),expected,name+' source preserved');
 }
});
