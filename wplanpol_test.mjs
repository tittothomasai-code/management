// feat/wellplan-polish test: tab groups, fixed order, sticky tab bar, wide tables, remembered tab, ?wplan=, one AFE rate set. Pure + browser.
import puppeteer from 'puppeteer-core';import * as P from './wplanpol.js';
const BASE=(process.argv[2]||'http://localhost:8872').replace(/\/$/,''),SH='shots_live/171_wplanpol_';
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
const all=P.GROUPS.flatMap(g=>g[2]);ok(new Set(all).size==all.length&&all.length==16,'16 known tabs, each in one group');
ok(P.groupOf('wga')=='cost'&&P.groupOf('acedm')=='safe'&&P.groupOf('inputs')=='plan'&&P.groupOf('xyz')=='other','groupOf');
ok(P.order(['afe','wga','plan','zzz','inputs']).join()=='inputs,plan,wga,afe,zzz','fixed order, unknown tabs last');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}],['desk',{width:1440,height:900}]]){
 const p=await b.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method())&&!/localhost/.test(r.url()))bad.push(r.url())});
 await p.goto(BASE+'/?nosplash=1&wplan=wga',{waitUntil:'load',timeout:120000});
 try{await p.waitForFunction(()=>document.getElementById('wpGrp')&&document.getElementById('wp')?.style.display!='none'&&document.querySelector('#wp [data-v=wga].on'),{timeout:150000})}catch(e){}
 ok(await p.evaluate(()=>GX.wplan.W.view=='wga'),nm+': ?wplan=wga opens the AFE tab');
 const vis=await p.evaluate(()=>[...document.querySelectorAll('#wp [data-v]')].filter(b=>b.offsetParent).map(b=>b.dataset.v).join());ok(vis=='wga,afe',nm+': only Cost group tabs shown ('+vis+')');
 ok(await p.evaluate(()=>document.querySelector('#wpGrp [data-g=cost]').classList.contains('on')),nm+': Cost group on');
 const hb=await p.evaluate(()=>document.getElementById('wpX').parentElement.offsetHeight);ok(hb<(nm=='phone'?150:90),nm+': tab bar height '+hb+' px');
 await p.screenshot({path:SH+nm+'_cost.png'});
 await p.evaluate(()=>document.querySelector('#wpGrp [data-g=safe]').click());await w(1200);
 const v2=await p.evaluate(()=>({v:GX.wplan.W.view,vis:[...document.querySelectorAll('#wp [data-v]')].filter(b=>b.offsetParent).map(b=>b.dataset.v).join()}));
 ok(v2.v=='offsets'&&v2.vis=='offsets,ac,acedm,wge,acell',nm+': Safety group → first tab, order '+v2.vis);await p.screenshot({path:SH+nm+'_safety.png'});
 await p.evaluate(()=>GX.wplan.open('wga'));await w(1200);await p.evaluate(()=>{let P=document.getElementById('wpX').parentElement.parentElement;while(P&&!(P.scrollHeight>P.clientHeight+4&&/auto|scroll/.test(getComputedStyle(P).overflowY)))P=P.parentElement;window.__sc=P||document.getElementById('wp');window.__sc.scrollTop=window.__sc.scrollHeight});await w(300);
 {const st=await p.evaluate(()=>{const P=window.__sc,r=document.getElementById('wpX').parentElement.getBoundingClientRect(),q=P.getBoundingClientRect();return {st:P.scrollTop,id:P.id||P.className,d:Math.round(r.top-q.top)}});ok(st.st>0&&st.d>=-12&&st.d<44,nm+': tab bar stays on top while scrolling ('+JSON.stringify(st)+')')}
 await p.evaluate(()=>GX.wplan.open('wga'));await w(800);const rs=await p.evaluate(()=>GX.wpg.G.rates.spread);
 await p.evaluate(()=>GX.wplan.open('afe'));await p.waitForSelector('#afeTbl');await w(300);
 ok(await p.evaluate(rs=>+document.getElementById('afeRig').value==rs&&GX.wplanac.S.afe.rig==rs,rs),nm+': AFE by section uses AFE tab rig rate '+rs);
 await p.evaluate(()=>{document.getElementById('afeRig').value=70000;document.getElementById('afeGo').click()});await w(300);
 ok(await p.evaluate(()=>GX.wpg.G.rates.spread==70000),nm+': rate change goes back to the AFE tab (one rate set)');
 const t=await p.evaluate(()=>document.getElementById('wp').innerText);ok(/SIM/.test(t)&&!/\bLIVE\b/.test(t)&&!/NaN/.test(t)&&/same rates/.test(t),nm+': SIM, no LIVE, no NaN, rate note');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#wpBody table')].every(t=>getComputedStyle(t).overflowX=='auto')),nm+': wide tables scroll sideways');
 await p.screenshot({path:SH+nm+'_afe.png'});
 ok(await p.evaluate(()=>localStorage.getItem('wp_view')=='afe'),nm+': last tab saved');
 await p.goto(BASE+'/?nosplash=1',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>GX?.wplan?.open&&GX.wplanpol,{timeout:150000});await p.evaluate(()=>GX.wplan.open());await w(1500);
 ok(await p.evaluate(()=>GX.wplan.W.view=='afe'),nm+': last tab opens again after reload');await p.evaluate(()=>localStorage.removeItem('wp_view'));await p.close()}
ok(!errs.length,'no page errors '+errs.slice(0,2).join(' | '));ok(!bad.length,'no external writes');await b.close();
console.log(`${pass} pass, ${fails} fail`);process.exit(fails?1:0)
