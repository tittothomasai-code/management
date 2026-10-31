// rigbuilder_test.mjs: Rig Builder (build, save with name, reload, load, rename, duplicate, delete, export/import, showroom B), desk + 390x844 phone.
// node rigbuilder_test.mjs [base]   env SHOT prefix, ONLY=desk|phone. No network writes.
import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=(process.argv[2]||'http://localhost:8971').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'200_rb_');
const idle3=async p=>{await p.waitForFunction(()=>{const s=GX.rigBuilder.stage?.();return s&&s.root&&!s.busy&&document.getElementById('rbLoad3')?.hidden},{timeout:300000,polling:500}).catch(()=>{});await new Promise(r=>setTimeout(r,800))};
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[];
const MOCK=()=>{const B=()=>Array.from({length:17},()=>({pressed:false,value:0}));window.__pad={id:'Mock Xbox Controller',index:0,connected:true,axes:[0,0,0,0],buttons:B(),mapping:'standard'};
 navigator.getGamepads=()=>[window.__pad,null,null,null];window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}};
const GL={ns:{}};const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
for(const nm of ['desk','phone']){if(process.env.ONLY&&process.env.ONLY!=nm)continue;
 const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport(VP[nm]);p.on('pageerror',e=>errs.push(nm+': '+e));await p.evaluateOnNewDocument(MOCK);
 await p.setRequestInterception(true);p.on('request',r=>{if(/supabase\.co|adaga|witsml/i.test(r.url())&&!/\.js(\?|$)/.test(r.url()))return r.abort();r.continue()});
 const pad=async i=>{await p.evaluate(i=>{__pad.buttons[i]={pressed:true,value:1}},i);await w(220);await p.evaluate(i=>{__pad.buttons[i]={pressed:false,value:0}},i);await w(220)};
 await p.goto(BASE+'/?start=1',{waitUntil:'load',timeout:120000});await p.waitForSelector('#rbBtnStart',{timeout:60000}).catch(()=>{});
 ok(await p.evaluate(()=>!!document.getElementById('rbBtnStart')),nm+': start screen has Rig builder button');
 await p.evaluate(()=>rbBtnStart.click());await p.waitForSelector('#rigBuilder #rbSvg canvas',{timeout:60000}).catch(()=>{});
 ok(await p.evaluate(()=>!!document.getElementById('rigBuilder')),nm+': builder opens from start screen');
 const cat=await p.evaluate(()=>{const c=GX.rigBuilder.ST.cat,s={};for(const x of c)s[x.src]=(s[x.src]||0)+1;return {n:c.length,s,slots:[...new Set(c.map(x=>x.slot))].length}});
 ok(cat.n>=120&&cat.s.A>0&&cat.s.B>0&&cat.s.C>0&&cat.slots==11,nm+': catalogue from A, B pass-1, C pass-2 ('+JSON.stringify(cat)+')');
 const sp=()=>p.evaluate(()=>{const s=GX.rigBuilder.C.specs(GX.rigBuilder.ST.rig,GX.rigBuilder.ST.cat);return {...s,txt:rbSpecs.textContent,bom:rbBom.querySelectorAll('tr').length-1}});
 let s0=await sp();ok(s0.hook==340&&s0.bop==10000&&/340 t/.test(s0.txt)&&s0.bom>10,nm+': defaults give specs + BOM ('+s0.hook+' t, '+s0.depth+' m, '+s0.kw+' kW, '+s0.bop+' psi, '+s0.bom+' lines)');
 // build: mast from 3000 walker via UI, BOP 15k via keys, top drive from pass-2 via pad, add an extra via click
 if(nm=='phone')await p.evaluate(()=>GX.rigBuilder.tab('build'));
 await p.evaluate(()=>document.querySelector('#rbSlots [data-s=mast]').click());await p.evaluate(()=>[...document.querySelectorAll('#rbItems button')].find(b=>/3000 walker/.test(b.textContent)).click());
 await p.evaluate(()=>GX.rigBuilder.stage().onPick('bop'));
 const idx=await p.evaluate(()=>[...document.querySelectorAll('#rbItems button[data-id]')].findIndex(b=>b.dataset.id=='B:drillship:bop_stack'));
 await p.evaluate(()=>document.activeElement?.blur());for(let i=0;i<idx+1;i++)await p.keyboard.press('ArrowDown');await p.keyboard.press('ArrowUp');await p.keyboard.press('Enter');
 ok(await p.evaluate(()=>GX.rigBuilder.ST.rig.slots.bop=='B:drillship:bop_stack'),nm+': keyboard fits BOP (↑↓ Enter)');
 await pad(5);let sl=await p.evaluate(()=>GX.rigBuilder.ST.slot);ok(sl=='pumps',nm+': pad RB moves to next slot ('+sl+')');await pad(4);await pad(4);
 const tdi=await p.evaluate(()=>GX.rigBuilder.ST.slot=='td'&&[...document.querySelectorAll('#rbItems button[data-id]')].findIndex(b=>b.dataset.id.startsWith('C:')&&/Top drive/.test(b.textContent)));
 await p.evaluate(i=>{GX.rigBuilder.ST.sel=i},tdi);await pad(0);
 ok(await p.evaluate(()=>/^C:.*top_drive$/.test(GX.rigBuilder.ST.rig.slots.td)),nm+': pad Ⓐ fits pass-2 top drive');
 await p.evaluate(()=>{GX.rigBuilder.slot('extra');[...document.querySelectorAll('#rbItems button[data-id]')].find(b=>/Shale shakers/.test(b.textContent)).click()});
 await p.evaluate(()=>{GX.rigBuilder.slot('pumps');document.querySelector('[data-q="pumps:1"]').click()});
 let s1=await sp();ok(s1.bop==15000&&s1.hook==340&&s1.pumpHp>s0.pumpHp&&s1.bom>s0.bom&&/15,000 psi/.test(s1.txt),nm+': specs + BOM update live (BOP '+s1.bop+', pumps '+s1.pumpHp+' hp, '+s1.bom+' lines)');
 ok(await p.evaluate(()=>/SIM/.test(document.getElementById('rigBuilder').textContent)&&!/\bLIVE\b/.test(document.getElementById('rigBuilder').textContent)&&!/openai|codex|claude|anthropic|chatgpt|gpt-|gemini|grok/i.test(document.getElementById('rigBuilder').innerText)),nm+': SIM label, no LIVE, no provider name');
 if(nm=='phone'){const r=await p.evaluate(()=>{const e=document.getElementById('rigBuilder').getBoundingClientRect(),n=rbName.getBoundingClientRect();return {w:e.width,h:e.height,sw:document.documentElement.scrollWidth,ny:n.bottom}});ok(r.w==390&&r.sw<=390,nm+': fits 390 wide ('+JSON.stringify(r)+')')}
 await p.screenshot({path:SH+nm+'_builder.png'});
 if(nm=='phone'){await p.evaluate(()=>GX.rigBuilder.tab('specs'));await w(300);await p.screenshot({path:SH+nm+'_specs.png'});await p.evaluate(()=>GX.rigBuilder.tab('build'))}
 // ---- 3D assembly checks ----
 await idle3(p);
 const d3=await p.evaluate(()=>{const R=GX.rigBuilder,st=R.stage(),r=st.root,u=r.userData,per={};for(const o of u.parts){let n=0;o.traverse(m=>{if(m.isMesh)n++});const k=o.userData.rb.slot;per[k]=(per[k]||0)+n}
  const need=R.C.instances(R.ST.rig).map(x=>x.slot),pos=k=>u.parts.filter(o=>o.userData.rb.slot==k).map(o=>[+o.position.x.toFixed(2),+o.position.y.toFixed(2),+o.position.z.toFixed(2)]);
  const subH=u.parts.find(o=>o.userData.rb.slot=='sub').userData.rb.size[1];return {per,need:[...new Set(need)],miss:u.missing.length,ns:u.nodeSet,exp:R.C.nodeSet(R.ST.rig),subH,mast:pos('mast')[0],td:pos('td')[0],pumps:pos('pumps'),power:pos('power'),gl:!!st.ren.getContext(),qp:R.ST.rig.qty.pumps,qg:R.ST.rig.qty.power,lod:u.lod,
   units:u.parts.filter(o=>/pumps|power/.test(o.userData.rb.slot)).map(o=>o.userData.rb.unit)}});
 ok(d3.gl&&d3.need.every(k=>d3.per[k]>0)&&!d3.miss,nm+': 3D meshes present for every filled slot ('+JSON.stringify(d3.per)+', LOD '+d3.lod+')');
 ok(JSON.stringify(d3.ns)==JSON.stringify(d3.exp),nm+': 3D node set matches the rig ('+d3.ns.length+' instances)');
 ok(Math.abs(d3.mast[1]-d3.subH)<.01&&d3.mast[0]==0&&d3.mast[2]==0&&d3.td[1]>d3.mast[1],nm+': mast snaps to drill floor at well centre, top drive in mast (floor '+d3.subH.toFixed(1)+' m, mast '+d3.mast+', td '+d3.td+')');
 const rowOK=(a,ax)=>a.length>1&&new Set(a.map(x=>x[ax])).size==a.length&&new Set(a.map(x=>x[ax==0?2:0])).size==1;
 ok(d3.pumps.length==d3.qp&&rowOK(d3.pumps,0)&&d3.power.length==d3.qg&&rowOK(d3.power,2),nm+': pump and generator counts instance meshes in rows ('+d3.pumps.length+' pumps, '+d3.power.length+' generators, units '+[...new Set(d3.units)]+')');
 // select highlight: click slot -> that slot's meshes glow
 const hl=await p.evaluate(()=>{GX.rigBuilder.slot('bop');const u=GX.rigBuilder.stage().root.userData;let on=0,off=0;for(const o of u.parts)o.traverse(m=>{if(m.isMesh&&m.material.emissive){const g=m.material.emissive.getHex()>0;if(o.userData.rb.slot=='bop')on+=g;else off+=g}});return {on,off}});
 ok(hl.on>0&&hl.off==0,nm+': selected slot is highlighted in 3D ('+hl.on+' meshes)');
 const cv=await p.evaluate(()=>{const c=document.querySelector('#rbSvg canvas'),r=c.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}});
 const cam0=await p.evaluate(()=>GX.rigBuilder.stage().cam.position.toArray().map(v=>+v.toFixed(1)).join());
 if(nm=='phone'){await p.evaluate(()=>document.querySelector('#rbSvg').scrollIntoView({block:'center'}));await w(200);const c2=await p.evaluate(()=>{const r=document.querySelector('#rbSvg canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});await p.touchscreen.touchStart(c2.x,c2.y);for(let i=1;i<=6;i++){await p.touchscreen.touchMove(c2.x+i*14,c2.y+2);await w(30)}await p.touchscreen.touchEnd()}else{await p.mouse.move(cv.x,cv.y);await p.mouse.down();await p.mouse.move(cv.x+80,cv.y+10,{steps:6});await p.mouse.up();}await w(400);
 const cam1=await p.evaluate(()=>GX.rigBuilder.stage().cam.position.toArray().map(v=>+v.toFixed(1)).join());ok(cam0!=cam1,nm+': drag orbits the camera');
 const fps=await p.evaluate(()=>GX.rigBuilder.stage().bench(3000));if(nm=='phone')ok(fps>=2,nm+': phone FPS sanity floor, LOD L ('+fps+' fps in software GL; floor 2)');else console.log('INFO desk fps in software GL: '+fps);
 if(nm=='phone'){const sr=await p.evaluate(()=>{const s=rbSlots.getBoundingClientRect(),b=[...rbSlots.querySelectorAll('button')].map(x=>x.getBoundingClientRect().height);return {h:s.height,min:Math.min(...b)}});ok(sr.min>=44&&sr.h>=sr.min,nm+': slot row is not clipped (row '+sr.h.toFixed(0)+' px, buttons '+sr.min.toFixed(0)+' px)')}
 GL.ns[nm]=null;
 // name validation + save
 await p.evaluate(()=>{rbName.value='   ';rbSave.click()});await w(300);ok(await p.evaluate(()=>/name/i.test(rbErr.textContent)&&!JSON.parse(localStorage.getItem('dw_custom_rigs_v1')||'[]').length),nm+': empty name rejected');
 await p.click('#rbName',{clickCount:3});await p.type('#rbName','  George special  ');await p.keyboard.press('Enter');await w(500);
 await idle3(p);GL.ns[nm]=await p.evaluate(()=>GX.rigBuilder.stage().root.userData.nodeSet);
 let L=await p.evaluate(()=>JSON.parse(localStorage.getItem('dw_custom_rigs_v1')||'[]'));ok(L.length==1&&L[0].name=='George special'&&L[0].tag=='SIM'&&L[0].slots.bop=='B:drillship:bop_stack',nm+': saved under trimmed name in dw_custom_rigs_v1');
 await p.evaluate(()=>{GX.rigBuilder.newRig();rbName.value='george SPECIAL';rbSave.click()});await w(400);ok(await p.evaluate(()=>/exists/.test(rbErr.textContent)&&JSON.parse(localStorage.getItem('dw_custom_rigs_v1')).length==1),nm+': duplicate name rejected (case-insensitive)');
 await p.evaluate(()=>{rbName.value='Light workover';GX.rigBuilder.slot('mast');[...document.querySelectorAll('#rbItems button')].find(b=>/Workover/.test(b.textContent)).click();rbSave.click()});await w(500);
 // reload page, load
 await p.reload({waitUntil:'load'});await p.waitForFunction(()=>!!window.GX?.rigBuilder,{timeout:60000});await p.evaluate(()=>GX.rigBuilder.open());await p.waitForSelector('#rbSvg canvas',{timeout:60000});
 await p.evaluate(()=>rbOpenSaved.click());await w(500);
 ok(await p.evaluate(()=>rbList.querySelectorAll('.it').length==2&&/George special/.test(rbList.textContent)),nm+': after reload, saved list shows 2 rigs');
 await p.screenshot({path:SH+nm+'_saved.png'});
 await p.evaluate(()=>[...rbList.querySelectorAll('.it')].find(e=>/George special/.test(e.textContent)).querySelector('[data-a=load]').click());await w(500);
 ok(await p.evaluate(()=>{const r=GX.rigBuilder.ST.rig;return r.name=='George special'&&r.slots.bop=='B:drillship:bop_stack'&&/^C:/.test(r.slots.td)&&r.qty.pumps==3&&r.extras.length==1&&rbName.value=='George special'&&rbSaved.hidden}),nm+': load restores parts, counts and name');
 await idle3(p);const ns2=await p.evaluate(()=>GX.rigBuilder.stage().root.userData.nodeSet);ok(GL.ns[nm]&&JSON.stringify(ns2)==JSON.stringify(GL.ns[nm]),nm+': save + reload re-assembles the same 3D node set ('+ns2.length+' instances)');
 // rename (in-app prompt, validation)
 const it=n=>`[...rbList.querySelectorAll('.it')].find(e=>e.querySelector('b').textContent==${JSON.stringify(n)})`;
 await p.evaluate(()=>rbOpenSaved.click());await w(300);await p.evaluate(`${it('George special')}.querySelector('[data-a=ren]').click()`);await w(200);
 await p.evaluate(()=>{rbDlgV.value='Light workover';rbDlgO.click()});await w(200);ok(await p.evaluate(()=>!rbDlg.hidden&&/exists/.test(rbDlgE.textContent)),nm+': rename to a used name is blocked');
 await p.evaluate(()=>{rbDlgV.value='  George rig 1 ';rbDlgO.click()});await w(500);ok(await p.evaluate(()=>{const L=JSON.parse(localStorage.getItem('dw_custom_rigs_v1'));return L.some(r=>r.name=='George rig 1')&&!L.some(r=>r.name=='George special')&&GX.rigBuilder.ST.rig.name=='George rig 1'}),nm+': rename saved');
 await p.evaluate(`${it('George rig 1')}.querySelector('[data-a=dup]').click()`);await w(500);ok(await p.evaluate(()=>{const L=JSON.parse(localStorage.getItem('dw_custom_rigs_v1'));const d=L.find(r=>r.name=='George rig 1 copy'),o=L.find(r=>r.name=='George rig 1');return L.length==3&&d&&d.id!=o.id&&d.slots.bop==o.slots.bop}),nm+': duplicate makes a copy with a new id');
 // delete with confirm: cancel keeps, OK deletes
 await p.evaluate(`${it('George rig 1 copy')}.querySelector('[data-a=del]').click()`);await w(200);ok(await p.evaluate(()=>!rbDlg.hidden&&/Delete/.test(rbDlg.textContent)),nm+': delete asks to confirm');
 await p.evaluate(()=>rbDlgC.click());await w(300);ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('dw_custom_rigs_v1')).length==3),nm+': cancel keeps the rig');
 await p.evaluate(`${it('George rig 1 copy')}.querySelector('[data-a=del]').click()`);await w(200);await p.evaluate(()=>rbDlgO.click());await w(400);ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('dw_custom_rigs_v1')).length==2),nm+': confirm deletes the rig');
 // export / import
 const ex=await p.evaluate(()=>GX.rigBuilder.exportText());let ej=JSON.parse(ex);ok(ej.format=='drilling-world-custom-rigs'&&ej.rigs.length==2&&ej.tag=='SIM',nm+': export JSON has 2 rigs');
 await p.evaluate(()=>{window.__dl=null;const o=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){window.__dl=this.download;return}return o.call(this)}});
 await p.evaluate(()=>rbExpAll.click());await w(200);ok(await p.evaluate(()=>window.__dl=='custom_rigs.json'),nm+': Export all downloads custom_rigs.json');
 fs.writeFileSync('/tmp/rb_'+nm+'.json',ex);const fi=await p.$('#rbFile');await fi.uploadFile('/tmp/rb_'+nm+'.json');await w(800);
 L=await p.evaluate(()=>JSON.parse(localStorage.getItem('dw_custom_rigs_v1')).map(r=>r.name));ok(L.length==4&&L.includes('George rig 1 (2)')&&L.includes('Light workover (2)'),nm+': import file adds rigs, clashing names get (2) ('+L.join(', ')+')');
 ok(await p.evaluate(async()=>{const v=await GX.rigBuilder.importText('not json');return !v.ok}),nm+': bad JSON rejected');
 // storage adapter swap
 ok(await p.evaluate(async()=>{const S=GX.rigBuilder.S,mem=[];const A={name:'test',async list(){return mem.slice()},async put(r){mem.push(r);return r},async remove(){}};const ok1=S.setAdapter(A);await S.put({id:'x',name:'m'});const n=(await S.list()).length;S.setAdapter(S.local);return ok1&&n==1&&(await S.list()).length==4}),nm+': storage adapter can be swapped (for later sync)');
 // keyboard close + reopen, pad B
 await p.evaluate(()=>rbSavedX.click());await p.evaluate(()=>document.activeElement?.blur());await pad(1);ok(await p.evaluate(()=>!document.getElementById('rigBuilder')),nm+': pad Ⓑ closes the builder');
 // showroom B: custom rigs listed and selectable
 await p.evaluate(()=>GX.rigBuilder.open());await p.waitForSelector('#rbSvg canvas');await p.evaluate(()=>{GX.rigBuilder.load(GX.rigBuilder.ST.list.find(r=>r.name=='George rig 1').id)});
 await p.evaluate(()=>rbShow.click());await p.waitForSelector('#showroomB canvas',{timeout:60000}).catch(()=>{});
 await p.waitForFunction(()=>window.GX?.showroomB?.idle?.(),{timeout:240000,polling:500}).catch(()=>{});await w(1500);
 const sb=await p.evaluate(()=>{const T=GX.showroomB.ST;return {n:T.rigs.length,c:T.rigs.filter(r=>r.custom).map(r=>r.name),cur:T.rigs[T.i]?.name,id:T.grp?.userData.id,name:srbName.textContent,bop:document.querySelector('#srbStats .row[data-k=bop] .v')?.textContent}});
 ok(sb.n==14&&sb.c.includes('George rig 1'),nm+': Showroom B lists custom rigs ('+sb.n+' rigs: '+sb.c.join(', ')+')');
 ok(sb.name=='George rig 1'&&/^custom:/.test(sb.id||'')&&/15,000/.test(sb.bop||''),nm+': View in showroom opens it on the podium ('+sb.name+', BOP '+sb.bop+')');
 await p.screenshot({path:SH+nm+'_showroom_custom.png'});
 await p.evaluate(()=>GX.showroomB.close());
 ok(!errs.filter(e=>e.startsWith(nm)).length,nm+': no page errors '+errs.filter(e=>e.startsWith(nm)).slice(0,2).join(' | '));
 await ctx.close()}
await b.close();console.log(`rigbuilder_test: ${pass} passed, ${fails} failed`);process.exit(fails?1:0)
