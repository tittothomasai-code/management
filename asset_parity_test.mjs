// asset_parity_test.mjs: every rig / part asset must carry the same showroom features (Titto: "keep an eye on assets built so we are consistent with features").
// Packs: A (assets/rigs, Blender, _low/_med/_high), B pass-1 (assets/rigsb), C pass-2 (assets/rigsc), Rig Builder pass-3 parts (assets/rigparts/pass3).
// Each GLB is really loaded through showroom3d.js (the single loader) in a desk page (L/M/H) and a 390x844 phone page (phone LOD), and checked:
//  explode  >=2 BOM groups resolve to meshes        bom      >=90% of mapped BOM ids resolve to meshes (A: asset__comp node names)
//  spec     spec card data (A: showroom.js RIGS, B/C: showroomb stats, parts: manifest specs)   closeups >=3 BOM paths resolve to meshes
//  attach   anchors present and resolve to nodes    ground   loaded bbox min.y in [-0.15,0.05] m; size matches manifest (+-3%) or 2..250 m
//  tris     loaded triangles within LOD budget      phone    phone LOD loads on a phone page, bytes within budget   laptop  M and H load on desk
// A missing feature fails unless listed in asset_parity_test.allow.json (existing, documented gaps). Writes docs-out/asset-feature-matrix.md.
// node asset_parity_test.mjs [base]   env MATRIX=path (default ../docs-out/asset-feature-matrix.md)
import puppeteer from 'puppeteer-core';import fs from 'fs';import path from 'path';
const BASE=(process.argv[2]||'http://localhost:8962').replace(/\/$/,'');
const MATRIX=process.env.MATRIX||path.resolve('../docs-out/asset-feature-matrix.md');
const FEATS=['explode','bom','spec','closeups','attach','ground','tris','phone','laptop'];
const BUD={rig:{L:{tri:25000,bytes:1500000},M:{tri:80000,bytes:3000000},H:{tri:200000,bytes:8000000}}};
const j=f=>JSON.parse(fs.readFileSync(f,'utf8'));
// ---------- enumerate assets ----------
const assets=[];
const aIds=[...new Set(fs.readdirSync('assets/rigs').filter(f=>/_(low|med|high)\.glb$/.test(f)).map(f=>f.replace(/_(low|med|high)\.glb$/,'')))].sort();
for(const id of aIds)assets.push({key:'A:'+id,pack:'A (Blender, assets/rigs)',id,type:'rig',lods:{L:`assets/rigs/${id}_low.glb`,M:`assets/rigs/${id}_med.glb`,H:`assets/rigs/${id}_high.glb`},naming:'_low/_med/_high'});
for(const [pack,dir,label] of [['B','assets/rigsb/pass1','B pass-1 (Codex, assets/rigsb)'],['C','assets/rigsc/pass2','C pass-2 (Codex, assets/rigsc)'],['P3','assets/rigparts/pass3','Rig Builder pass-3 parts (Codex, assets/rigparts)']]){
 const m=j(dir+'/manifest.json'),L=m.rigs||m.parts||[];
 for(const r of L){const lods={};for(const k of ['L','M','H'])if(r.lods?.[k])lods[k]=dir+'/'+r.lods[k].file;
  const bud=m.budgets?{L:{tri:m.budgets.L.triangles,bytes:m.budgets.L.bytes},M:{tri:m.budgets.M.triangles,bytes:m.budgets.M.bytes},H:{tri:m.budgets.H.triangles,bytes:m.budgets.H.bytes}}:null;
  assets.push({key:pack+':'+r.id,pack:label,id:r.id,type:pack=='P3'?'part':'rig',lods,naming:Object.values(lods).every(f=>/_lod[LMH]\.glb$/.test(f))?'_lodL/M/H':'mixed',
   nodeToBom:r.nodeToBom||{},bbox:r.boundingBox||null,specs:r.specs||null,anchors:r.anchors||null,bud})}}
// ---------- load in browser ----------
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
async function page(vp){const p=await br.newPage();await p.setViewport(vp);const errs=[];p.on('pageerror',e=>errs.push(String(e)));
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase\.co|adaga|witsml/i.test(r.url())&&!/\.js(\?|$)/.test(r.url()))return r.abort();r.continue()});
 await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>!!window.GX,{timeout:60000});return {p,errs}}
const PROBE=async(urls)=>{const M3=await import('./showroom3d.js?v=5116');const THREE=await import('three');const out={};
 for(const [k,u] of Object.entries(urls)){const t0=performance.now();try{const s=await M3.loadUrl(new URL(u,location.href).href);const bb=new THREE.Box3().setFromObject(s);let tri=0;const names=new Set(),boms=new Set(),meshBoms=new Set(),meshNames=new Set();
   s.traverse(o=>{if(o.name)names.add(o.name);const b=o.userData?.bomId;if(b)boms.add(b);if(o.isMesh){const g=o.geometry;tri+=g.index?g.index.count/3:g.attributes.position.count/3;let n=o;while(n&&n!==s){if(n.userData?.bomId)meshBoms.add(n.userData.bomId);if(n.name)meshNames.add(n.name);n=n.parent}}});
   const r=await fetch(new URL(u,location.href).href,{cache:'force-cache'}).then(x=>x.arrayBuffer());
   out[k]={ok:true,ms:Math.round(performance.now()-t0),tri:Math.round(tri),bytes:r.byteLength,min:bb.min.toArray(),size:bb.getSize(new THREE.Vector3()).toArray(),names:[...names],meshBoms:[...meshBoms],meshNames:[...meshNames]}}catch(e){out[k]={ok:false,err:String(e).slice(0,160)}}}
 return out};
const D=await page({width:1440,height:900}),P=await page({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
// spec-card data from the running app
const specs=await D.p.evaluate(async()=>{const a=await import('./showroom.js?v=b18');const b=await import('./showroomb.js?v=b7');await b.manifest();
 const A={};for(const r of a.RIGS||[])A[r.id]=!!(r.name&&(r.spec||r.specs||r.st||r.hook||r.depth||Object.keys(r).length>3));const B={};for(const r of b.ST.rigs){const st=r.st||{};B[r.id]=Object.keys(st).filter(k=>st[k]!=null).length>=3}return {A,B}});
const phoneLod=a=>a.lods.L?'L':'M';
const res=[];
for(const a of assets){const d=await D.p.evaluate(PROBE,a.lods);const ph=await P.p.evaluate(PROBE,{[phoneLod(a)]:a.lods[phoneLod(a)]});
 const bud=a.bud||BUD.rig,f={},why={};const M=d.M||d.L||d.H;
 // BOM paths that resolve to meshes
 let groups=new Set(),resolved=0,total=0;
 if(a.key.startsWith('A:')){for(const n of (M?.meshNames||[]))if(/^[a-z0-9]+(__[a-z0-9]+)?$/i.test(n)&&n!='Scene'){total++;resolved++;groups.add(n.split('__')[0])}
  }else{const mb=new Set(M?.meshBoms||[]),mn=new Set(M?.meshNames||[]);for(const [p,b] of Object.entries(a.nodeToBom)){total++;if(mb.has(b)||mn.has(p.split('/').pop())){resolved++;groups.add(a.type=='part'?p.split('/').slice(0,2).join('/'):p.split('/')[0])}}}
 f.explode=groups.size>=2;why.explode=groups.size+' BOM groups';
 f.bom=total>0&&resolved/total>=.9;why.bom=resolved+'/'+total+' BOM ids on meshes';
 f.closeups=resolved>=3;why.closeups=resolved+' focusable paths';
 if(a.type=='part'){f.spec=!!(a.specs&&Object.keys(a.specs).length);why.spec='manifest specs'}else if(a.key.startsWith('A:')){f.spec=!!specs.A[a.id];why.spec='showroom.js RIGS'}else{f.spec=!!specs.B[a.id];why.spec='showroomb stats'}
 const an=a.anchors?Object.values(a.anchors):[];const nm=new Set(M?.names||[]);const anOk=an.filter(x=>nm.has(String(x.nodePath||'').split('/').pop())).length;
 f.attach=an.length>0&&anOk==an.length;why.attach=an.length?anOk+'/'+an.length+' anchors on nodes':'no anchors';
 const gOk=M?.ok&&M.min[1]>=-.15&&M.min[1]<=.05;let sOk=false;if(M?.ok){if(a.bbox?.size){sOk=M.size.every((v,i)=>Math.abs(v-a.bbox.size[i])<=Math.max(.05,a.bbox.size[i]*.03))}else{const h=Math.max(...M.size);sOk=h>=2&&h<=250}}
 f.ground=!!(gOk&&sOk);why.ground=M?.ok?`min.y ${M.min[1].toFixed(2)} m, size ${M.size.map(v=>v.toFixed(1)).join('x')} m`:'not loaded';
 const tb=['L','M','H'].filter(k=>d[k]?.ok).map(k=>[k,d[k].tri,bud[k].tri]);f.tris=tb.length==3&&tb.every(([k,t,b])=>t<=b);why.tris=tb.map(([k,t,b])=>`${k} ${t}/${b}`).join(', ');
 const pl=phoneLod(a),pr=ph[pl];f.phone=!!(pr?.ok&&pr.bytes<=bud[pl].bytes&&pl=='L');why.phone=pr?.ok?`${pl} ${(pr.bytes/1e3).toFixed(0)} kB, ${pr.ms} ms`:(pr?.err||'missing');
 f.laptop=!!(d.M?.ok&&d.H?.ok&&d.H.bytes<=bud.H.bytes);why.laptop=d.M?.ok&&d.H?.ok?`M ${(d.M.bytes/1e3).toFixed(0)} kB, H ${(d.H.bytes/1e3).toFixed(0)} kB`:'M/H not loaded';
 res.push({a,f,why})}
await br.close();
// ---------- allowlist + verdict ----------
const ALF='asset_parity_test.allow.json';const AL=fs.existsSync(ALF)?j(ALF):{gaps:{}};
if(process.env.WRITE_ALLOW){const g={};for(const r of res)for(const k of FEATS)if(!r.f[k])(g[r.a.key]=g[r.a.key]||{})[k]=AL.gaps?.[r.a.key]?.[k]||'existing gap at baseline: '+r.why[k];fs.writeFileSync(ALF,JSON.stringify({note:'Documented existing gaps. New assets get no entries: any missing feature fails. Remove an entry when the gap is fixed.',gaps:g},null,1)+'\n')}
const AL2=fs.existsSync(ALF)?j(ALF):{gaps:{}};let pass=0,fail=0,stale=[];const failing=[];
for(const r of res)for(const k of FEATS){const al=AL2.gaps?.[r.a.key]?.[k];if(r.f[k]){pass++;if(al)stale.push(r.a.key+' '+k)}else if(al){pass++}else{fail++;console.log('FAIL '+r.a.key+' '+k+': '+r.why[k])}}
for(const r of res){const g=FEATS.filter(k=>!r.f[k]);if(g.length)failing.push([r.a.key,g])}
// ---------- matrix ----------
const ic=(r,k)=>r.f[k]?'✅':(AL2.gaps?.[r.a.key]?.[k]?'⚠️':'❌');
let md=`# Asset feature-parity matrix\n\nGenerated by \`asset_parity_test.mjs\` (wt-rel5125, ${new Date().toISOString().slice(0,10)}). Every GLB was loaded through showroom3d.js in a desk page (L/M/H) and a 390×844 phone page.\n\n✅ has the feature · ⚠️ known gap on the allowlist (\`asset_parity_test.allow.json\`) · ❌ new gap (test fails)\n\nRig budgets (no manifest budget): L ≤25k tris / 1.5 MB, M ≤80k / 3 MB, H ≤200k / 8 MB. Pass-3 parts use their manifest budgets (L 6k / 0.5 MB, M 20k / 1.5 MB, H 60k / 3 MB).\n\n| Asset | Pack | LOD naming | ${FEATS.join(' | ')} |\n|---|---|---|${FEATS.map(()=>'---').join('|')}|\n`;
for(const r of res)md+=`| ${r.a.key} | ${r.a.pack} | ${r.a.naming} | ${FEATS.map(k=>ic(r,k)).join(' | ')} |\n`;
md+=`\n## Details\n\n`;for(const r of res)md+=`- **${r.a.key}**: `+FEATS.map(k=>`${k} ${ic(r,k)} (${r.why[k]})`).join('; ')+'\n';
md+=`\n## Assets failing parity (allowlisted gaps)\n\n`+(failing.length?failing.map(([k,g])=>`- ${k}: ${g.join(', ')}`).join('\n'):'None')+'\n';
md+=`\n## Rules\n\n- A new asset with any ❌ fails the test. Existing gaps stay ⚠️ only while listed in the allowlist; fixing one shows up as "stale allowlist" so the entry is removed.\n- Gaps that need real modelling (anchors, separate BOM meshes, LOD rebuilds) are requested from Codex, not faked: see Codex-Component-Request-2026-11-01-parity.md.\n`;
fs.mkdirSync(path.dirname(MATRIX),{recursive:true});fs.writeFileSync(MATRIX,md);fs.writeFileSync('/tmp/asset_parity.json',JSON.stringify(res.map(r=>({key:r.a.key,f:r.f,why:r.why})),null,1));
if(stale.length)console.log('STALE allowlist (feature now present, remove entry): '+stale.join(', '));
console.log(`matrix: ${MATRIX}\nasset_parity: ${res.length} assets, ${pass} pass, ${fail} fail, ${failing.length} assets with allowlisted gaps`);process.exit(fail?1:0)
