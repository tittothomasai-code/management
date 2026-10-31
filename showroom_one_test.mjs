// showroom_one_test (v5.12.2.1): ONE showroom (C engine). Feature parity e2e: every A, B and C control is present and works,
// old A/B/C links + settings all open it, no A|B|C switch. Desk + phone. usage: node showroom_one_test.mjs http://localhost:8961
import puppeteer from 'puppeteer-core';
const BASE=(process.argv[2]||'http://localhost:8961').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'197_one_');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};const w=ms=>new Promise(r=>setTimeout(r,ms));
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const VP={desk:{width:1440,height:900},phone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}};
const ready=p=>p.waitForFunction(()=>{const S=GX.showroomC?.ST;return S?.open&&S.root&&document.getElementById('srcMsg')?.hidden&&S.AS},{timeout:300000,polling:250});
const altReady=(p,id)=>p.waitForFunction(id=>{const S=GX.showroomC.ST;return S.alt==id&&S.altObj&&document.getElementById('srcMsg').hidden},{timeout:300000,polling:250},id);
for(const nm of (process.env.ONLY?[process.env.ONLY]:['desk','phone'])){const ctx=await br.createBrowserContext(),p=await ctx.newPage();await p.setViewport(VP[nm]);
 const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.setRequestInterception(true);p.on('request',r=>/supabase|adaga|witsml|netlify\/functions/i.test(r.url())&&!/\.js(\?|$)/.test(r.url())?r.abort():r.continue());
 await p.goto(BASE+'/?nosplash',{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.GX&&window.G&&G._scene&&GX.showroomAB&&GX.showroomC,{timeout:180000});
 // old settings: A, B, C all open the one showroom
 for(const k of ['A','B','C']){await p.evaluate(k=>{localStorage.setItem('dw_showroom_ab',k);localStorage.removeItem('dw_showroom_rig_one')},k);await p.evaluate(()=>GX.showroomAB.open());await ready(p);
  const s=await p.evaluate(()=>({c:!!document.getElementById('showroomC'),a:!!document.getElementById('showroom'),b:!!document.getElementById('showroomB'),sw:document.querySelectorAll('.srabH').length}));
  ok(s.c&&!s.a&&!s.b&&!s.sw,nm+': saved '+k+' opens the single showroom, no A|B|C switch');if(k!='C')await p.evaluate(()=>GX.showroomC.close())}
 ok(await p.evaluate(()=>!document.getElementById('srabStart')&&!document.getElementById('srabSet')),nm+': no showroom picker on start/settings (one entry point)');
 const ids=['srcPrev','srcNext','srcUse','srcNight','srcInfo','srcMute','srcZin','srcZout','srcFleetB','srcBomB','srcExp','srcX','srcAsHdl'];
 const miss=await p.evaluate(ids=>ids.filter(i=>!document.getElementById(i)).concat(document.querySelectorAll('#showroomC [data-pre]').length==5?[]:['presets']),ids);ok(!miss.length,nm+': all controls present '+(miss.join(',')||'(13 + 5 presets)'));
 // layout (390x844 phone + desk): nothing over the header, BOM fits its box, C + B features present
 const hdrHit=()=>p.evaluate(()=>{const h=document.getElementById('srcTop').getBoundingClientRect().bottom,bad=[];for(const id of ['srcStats','srcCard','srcBom','srcFleet','srcAs']){const e=document.getElementById(id);if(!e||e.hidden||getComputedStyle(e).visibility=='hidden'||getComputedStyle(e).display=='none')continue;const r=e.getBoundingClientRect();if(id=='srcAs'&&!e.classList.contains('open'))continue;if(r.width&&r.top<h-1)bad.push(id+'@'+Math.round(r.top)+'<'+Math.round(h))}return bad});
 await w(1200);let hb=await hdrHit();ok(!hb.length,nm+': nothing over header (open) '+hb.join(','));
 ok(await p.evaluate(()=>['srcExp','srcFleetB','srcBomB','srcMute','srcPrev','srcNext'].every(i=>document.getElementById(i))&&['overview','top_drive','bop','pumps','cabin'].every(k=>document.querySelector('#showroomC [data-pre='+k+']'))),nm+': Explode, Rigs, BOM, Sound, rig switcher, close-ups (Top drive/BOP/Pumps/Cabin) present');
 const sb=await p.evaluate(()=>[...document.querySelectorAll('#srcStats .s')].length);ok(sb==4,nm+': B stat bars on show ('+sb+')');
 await p.keyboard.press('i');await w(500);hb=await hdrHit();ok(!hb.length,nm+': parts card does not cover header '+hb.join(','));await p.keyboard.press('c');
 await p.click('#srcBomB');await w(600);const bw=await p.evaluate(()=>{const b=document.getElementById('srcBom'),t=b.querySelector('table');return {box:b.clientWidth,tw:t.getBoundingClientRect().width,sw:b.scrollWidth,txt:b.querySelector('td').innerText}});
 ok(bw.tw<=bw.box+1&&bw.sw<=bw.box+1,nm+': BOM width '+Math.round(bw.tw)+' <= box '+bw.box);ok(/^[ABC] \S/.test(bw.txt.trim()),nm+': level letter spaced ("'+bw.txt.trim().slice(0,16)+'")');hb=await hdrHit();ok(!hb.length,nm+': BOM not over header');
 await p.screenshot({path:SH+nm+'_bom.png'});await p.click('#srcBomB');
 await p.click('#srcFleetB');await w(600);hb=await hdrHit();ok(!hb.length,nm+': Rigs not over header');await p.click('#srcFleetB');
 await p.click('#srcExp');await w(1500);ok(await p.evaluate(()=>GX.showroomC.ST.expT>0),nm+': Explode button');await p.screenshot({path:SH+nm+'_explode.png'});await p.click('#srcExp');
 await p.click('#showroomC [data-pre=bop]');await w(1500);ok(await p.evaluate(()=>GX.showroomC.ST.preset=='bop'),nm+': BOP close-up');await p.click('#showroomC [data-pre=overview]');await w(1200);
 const L=await p.evaluate(()=>GX.showroomC.rigList());ok(L.length==20&&L[0]===''&&L[1].startsWith('b:')&&!L[19].startsWith('b:'),nm+': rig list = C main + 10 B + 9 A ('+L.length+')');
 const lod=await p.evaluate(()=>GX.showroomC.ST.lod);ok(nm=='phone'?lod!='H':lod=='H',nm+': main rig LOD '+lod);
 await w(800);await p.screenshot({path:SH+nm+'_day.png'});
 await p.click('#srcNight');await w(2500);const nt=await p.evaluate(()=>({n:GX.showroomC.ST.night,r:!!window.GX.nightReal}));ok(nt.n&&nt.r,nm+': Day/Night toggle -> realistic night (GX.nightReal)');await p.screenshot({path:SH+nm+'_night.png'});
 await p.keyboard.press('n');await w(800);ok(await p.evaluate(()=>!GX.showroomC.ST.night),nm+': N back to day');
 // Assets slider
 await p.click('#srcAsHdl');await w(600);const n0=await p.evaluate(()=>document.querySelectorAll('#srcAs .srAsList tr.b').length);ok(await p.evaluate(()=>document.getElementById('srcAs').classList.contains('open'))&&n0>0,nm+': Assets slider opens ('+n0+' rows)');
 await p.screenshot({path:SH+nm+'_slider.png'});const d0=await p.evaluate(()=>GX.showroomC.focusInfo().dist);
 await p.evaluate(()=>GX.showroomC.preset('overview',true));await w(800);const d1=await p.evaluate(()=>GX.showroomC.focusInfo().dist);await p.evaluate(()=>{const r=[...document.querySelectorAll('#srcAs .srAsList tr.b')];(r[3]||r[1]||r[0]).click()});await w(2500);const f=await p.evaluate(()=>GX.showroomC.focusInfo());ok(f.k&&f.dist<d1*.6,nm+': tap row zooms in close ('+d1+' -> '+f.dist+')');
 await p.screenshot({path:SH+nm+'_zoom.png'});
 await p.evaluate(()=>document.querySelector('#srcAs .srAsList tr.b.on').click());await w(1200);ok(await p.evaluate(()=>!GX.showroomC.focusInfo().k),nm+': tap again closes the zoom');
 await p.click('#srcBomB');await w(300);ok(await p.evaluate(()=>!document.getElementById('srcAs').classList.contains('open')&&GX.showroomC.ST.bom),nm+': BOM and slider do not overlap');await p.click('#srcBomB');
 // B controls: D/A rig change, mute, info, zoom buttons
 await p.keyboard.press('d');await altReady(p,L[1]);let rows=await p.evaluate(()=>GX.showroomC.ST.AS.render()||(document.getElementById('srcAs').classList.add('x'),document.querySelectorAll('#srcAs .srAsList tr.b').length));
 await p.evaluate(()=>GX.showroomC.ST.AS.drawer(true));await w(300);rows=await p.evaluate(()=>document.querySelectorAll('#srcAs .srAsList tr.b').length);ok(rows>0,nm+': D -> B rig '+L[1]+', slider rows '+rows);
 await p.evaluate(()=>document.querySelector('#srcAs .srAsList tr.b').click());await w(1300);ok(await p.evaluate(()=>!!GX.showroomC.focusInfo().k),nm+': B rig row zoom');await p.keyboard.press('Escape');await p.keyboard.press('Escape');await w(400);
 ok(await p.evaluate(()=>GX.showroomC.ST.open),nm+': Esc backs out of slider first');
 await p.evaluate(()=>GX.showroomC.viewA('b:'+GX.showroomC.ST.B.rigs[0].id));await p.keyboard.press('a');await p.keyboard.press('a');await altReady(p,L[19]);await p.evaluate(()=>GX.showroomC.ST.AS.drawer(true));await w(300);
 rows=await p.evaluate(()=>document.querySelectorAll('#srcAs .srAsList tr.b').length);ok(rows>0,nm+': A -> A rig '+L[19]+', slider rows '+rows);await p.evaluate(()=>GX.showroomC.ST.AS.drawer(false));
 const m0=await p.evaluate(()=>document.getElementById('srcMute').getAttribute('aria-pressed'));await p.keyboard.press('m');await w(300);const m1=await p.evaluate(()=>document.getElementById('srcMute').getAttribute('aria-pressed'));ok(m0!=m1,nm+': M toggles sound');await p.keyboard.press('m');
 const z0=await p.evaluate(()=>GX.showroomC.focusInfo().dist);await p.click('#srcZin');await w(200);ok(await p.evaluate(()=>GX.showroomC.focusInfo().dist)<z0,nm+': zoom-in button');
 await p.keyboard.press('r');await w(600);ok(await p.evaluate(()=>!document.getElementById('srcFleet').hidden&&document.querySelectorAll('#srcFleet [data-arig^="b:"]').length==10),nm+': Rigs list has A + B rigs');await p.keyboard.press('r');
 await p.evaluate(()=>GX.showroomC.viewA(''));await w(800);await p.keyboard.press('i');await w(300);ok(await p.evaluate(()=>!document.getElementById('srcCard').hidden),nm+': I opens parts card');
 await p.keyboard.press('x');await w(300);ok(await p.evaluate(()=>GX.showroomC.ST.expT>0),nm+': X explode');await p.keyboard.press('x');await p.keyboard.press('2');
 ok(await p.evaluate(()=>!/\bLIVE\b/.test(document.getElementById('showroomC').innerText)),nm+': no LIVE label');
 // Use this rig
 await p.evaluate(()=>{window.__rig=null;addEventListener('dw-rig',e=>window.__rig=e.detail,{once:true})});await p.evaluate(()=>GX.showroomC.viewA('b:jackup'));await altReady(p,'b:jackup');await p.click('#srcUse');await w(500);
 const u=await p.evaluate(()=>({d:window.__rig,open:GX.showroomC.ST.open,s:localStorage.getItem('dw_showroom_rig_b')}));ok(u.d?.id=='jackup'&&!u.open&&u.s=='jackup',nm+': Use this rig applies + closes '+JSON.stringify(u.d));
 if(nm=='desk'){for(const k of ['a','b']){await p.goto(BASE+'/?nosplash&showroom='+k,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.GX?.showroomAB&&GX.showroomC&&window.G&&G._scene,{timeout:180000});await p.evaluate(()=>GX.showroomAB.open());await ready(p);ok(await p.evaluate(()=>!!document.getElementById('showroomC')&&!document.getElementById('showroomB')),'desk: ?showroom='+k+' link opens the single showroom')}}
 ok(!errs.length,nm+': no page errors '+errs.slice(0,3).join(' | '));await ctx.close()}
await br.close();console.log(`showroom_one: ${pass} pass, ${fail} fail`);process.exit(fail?1:0)
