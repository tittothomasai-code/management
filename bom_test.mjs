// bom_test.mjs: Workshop BOM tab (bom.js + bom_data.js). Desktop 1440x900 and phone 390x844. Offline SIM.
// Checks: all 12 models have rows with SIM tags, row tap -> 3D part highlight, 3D pick -> row highlight, CSV download, phone fit.
import puppeteer from 'puppeteer-core';import fs from 'fs';const BASE=process.argv[2]||'http://localhost:8823',SH=process.env.SHOT||'shots_live/160_bom_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[];
const DL='/tmp/bom_dl_'+process.pid;fs.mkdirSync(DL,{recursive:true});
async function run(vp,tag,mobile){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.setViewport({...vp,isMobile:!!mobile,hasTouch:!!mobile});
 p.on('pageerror',e=>/WebGL/.test(e.message)||errs.push(tag+': '+e.message));await p.setRequestInterception(true);p.on('request',r=>{if(/supabase|adaga|witsml|:8796|:8799/i.test(r.url()))r.abort();else r.continue()});
 const cdp=await b.target().createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:DL,browserContextId:ctx.id,eventsEnabled:true});
 await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.GX?.ws&&window.GX?.bom,{timeout:120000});await w(2500);
 await p.evaluate(()=>GX.ws.open('exp','topdrive'));await w(800);ok(await p.$('#wsBom'),tag+' BOM tab button in workshop');
 await p.click('#wsBom');await w(1200);ok(await p.evaluate(()=>GX.ws.ST.mode=='bom'&&document.getElementById('wsBom').classList.contains('on')),tag+' BOM tab active');
 const keys=await p.evaluate(()=>Object.keys(GX.ws.CAT));ok(keys.length==12,tag+' 12 models ('+keys.length+')');
 for(const k of keys){await p.select('#bomEq',k);await w(250);const r=await p.evaluate(k=>{const tr=[...document.querySelectorAll('#bomT tr.bom')];return {n:tr.length,parts:GX.ws.CAT[k].parts.length,meshes:GX.ws.ST.meshes.length,sim:tr.every(x=>/SIM/.test(x.textContent)),cols:document.querySelectorAll('#bomT thead th').length,qty:tr.every(x=>+x.children[2].textContent>0)}},k);
  ok(r.n>0&&r.n==r.parts&&r.meshes==r.parts&&r.sim&&r.cols==6&&r.qty,`${tag} ${k}: ${r.n} rows = ${r.parts} parts, SIM tagged`)}
 await p.select('#bomEq','motor');await w(600);
 // row -> 3D
 await p.click('#bomT tr.bom[data-i="2"]');await w(400);const h=await p.evaluate(()=>({sel:GX.ws.ST.sel,em:GX.ws.ST.meshes[2].material.emissive.getHexString(),other:GX.ws.ST.meshes[0].material.emissive.getHexString(),row:document.querySelector('#bomT tr.bom[data-i="2"]').classList.contains('on')}));
 ok(h.sel==2&&h.em!='000000'&&h.other=='000000'&&h.row,tag+' row tap highlights 3D part '+JSON.stringify(h));
 // 3D -> row: click on screen projection of mesh 4
 const pt=await p.evaluate(()=>{const W=GX.ws,ST=W.ST;const lbl=ST.labels[4];const r=lbl.getBoundingClientRect();return null});
 const xy=await p.evaluate(()=>{const c=document.querySelector('#wsView canvas'),r=c.getBoundingClientRect();const m=GX.ws.ST.meshes[4];m.updateMatrixWorld();const v=m.getWorldPosition(m.position.clone());// project via camera on label positions
  const l=GX.ws.ST.labels[4];const lr=l.getBoundingClientRect();return {lx:lr.x+lr.width/2,ly:lr.y+lr.height/2}});
 await p.mouse.click(xy.lx,xy.ly);await w(500);let r4=await p.evaluate(()=>({sel:GX.ws.ST.sel,on:document.querySelector('#bomT tr.bom.on')?.dataset.i}));
 ok(r4.sel==4&&r4.on=='4',tag+' part label tap highlights row '+JSON.stringify(r4));
 // true 3D raycast pick: find a pixel that hits mesh 5
 const hit=await p.evaluate(()=>{const c=document.querySelector('#wsView canvas'),r=c.getBoundingClientRect();for(let y=r.top+8;y<r.bottom;y+=10)for(let x=r.left+8;x<r.right;x+=10){const e=document.elementFromPoint(x,y);if(e!==c)continue;
  /* use pick through a synthetic pointer pair */}return [r.left,r.top,r.width,r.height]});
 const picked=await p.evaluate(()=>{const c=document.querySelector('#wsView canvas'),r=c.getBoundingClientRect();for(let y=r.top+6;y<r.bottom;y+=8)for(let x=r.left+6;x<r.right;x+=8){if(document.elementFromPoint(x,y)!==c)continue;GX.ws.ST.sel=-1;
  const o={clientX:x,clientY:y,bubbles:true,pointerId:1,isPrimary:true};c.dispatchEvent(new PointerEvent('pointerdown',o));c.dispatchEvent(new PointerEvent('pointerup',o));if(GX.ws.ST.sel>=0)return GX.ws.ST.sel}return -1});
 const rr=await p.evaluate(()=>document.querySelector('#bomT tr.bom.on')?.dataset.i);ok(picked>=0&&rr==String(picked),tag+' 3D part tap highlights row '+picked+' -> '+rr);
 await p.screenshot({path:SH+tag+'_motor.png'});
 // CSV
 for(const f of fs.readdirSync(DL))fs.unlinkSync(DL+'/'+f);await p.click('#bomCsv');let f=null;for(let i=0;i<30&&!f;i++){await w(300);f=fs.readdirSync(DL).find(x=>/\.csv$/.test(x))}
 const txt=f?fs.readFileSync(DL+'/'+f,'utf8'):(await p.evaluate(()=>window.__bomLast?.text));const lines=(txt||'').trim().split('\n');
 ok(/bom_motor_SIM\.csv/.test(f||'')&&/^Item no\.,Part name,Qty,Material \/ spec,Function,3D part,Source/.test(lines[0])&&lines.filter(l=>/,SIM$/.test(l)).length==7&&!/LIVE/.test(txt),tag+' CSV downloaded '+f+' ('+lines.length+' lines)');
 // layout fit
 const fit=await p.evaluate(()=>{const vw=innerWidth,t=document.getElementById('bomT').getBoundingClientRect(),s=document.getElementById('wsSheet'),top=[...document.querySelectorAll('#wsTop button')].map(e=>e.getBoundingClientRect());return {vw,tr:Math.round(t.right),sheetSW:s.scrollWidth,sheetCW:s.clientWidth,topR:Math.round(Math.max(...top.map(r=>r.right))),minH:Math.min(...[...document.querySelectorAll('#bomT tr.bom')].map(e=>e.getBoundingClientRect().height))}});
 ok(fit.tr<=fit.vw&&fit.sheetSW<=fit.sheetCW+1&&fit.topR<=fit.vw,tag+' layout fits '+JSON.stringify(fit));
 if(mobile)ok(fit.minH>=24,tag+' rows tall enough to tap ('+fit.minH+'px)');
 // back to exploded tab still works
 await p.click('#wsExp');await w(600);ok(await p.evaluate(()=>GX.ws.ST.mode=='exp'&&!!document.getElementById('wsParts')&&!document.getElementById('wsBom').classList.contains('on')),tag+' Exploded tab still works');
 await p.click('#wsBom');await w(600);await p.screenshot({path:SH+tag+'_topdrive.png'});await ctx.close()}
await run({width:1440,height:900},'desk');await run({width:390,height:844},'phone',true);
ok(errs.length==0,'no page errors '+JSON.stringify(errs.slice(0,3)));
await b.close();console.log(`bom: ${pass} pass, ${fails} fail`);process.exit(fails?1:0);
