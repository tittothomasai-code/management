// feat/workover frac stage test: engine (stresses from lithology, PKN, ISIP/Pnet, screenout), ?workover=frac UI (spread, chart, wings), SIM only, no writes.
import puppeteer from 'puppeteer-core';import * as F from './fraceng.js';import * as E from './woeng.js';
const BASE=(process.argv[2]||'http://localhost:8816').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'141_frac_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
try{const S=await import('./strat.js');F.useStrat(S);ok(true,'using helper D strat.js lithology')}catch(e){ok(true,'strat.js not in tree: SIM layer fallback')}
const s1=F.stress(2550),sh=F.stress(2460);ok(s1.Pp<s1.sh&&s1.sh<s1.Sv,`Pp ${s1.Pp.toFixed(1)} < Shmin ${s1.sh.toFixed(1)} < Sv ${s1.Sv.toFixed(1)} MPa`);ok(sh.sh>F.stress(2400).sh,'shale barrier has higher Shmin than sand ('+sh.sh.toFixed(1)+' MPa)');
const a=F.pkn({q:8,mu:.15,xf:100,hf:40,E:15,nu:.2}),b=F.pkn({q:16,mu:.15,xf:100,hf:40,E:15,nu:.2});ok(Math.abs(b.wmax/a.wmax-2**.25)<1e-6,'PKN width ∝ q^1/4');ok(a.wmax>1e-3&&a.wmax<2e-2,'PKN w_max '+(a.wmax*1000).toFixed(1)+' mm');
ok(Math.abs(F.slurryRho(5*F.PPA)-1304)<15,'slurry 5 ppa '+F.slurryRho(5*F.PPA).toFixed(0)+' kg/m3');const pf=F.perfFric(8,36);ok(pf>0.5&&pf<8,'perf friction '+pf.toFixed(2)+' MPa');
const D=F.design();ok(D.length==3,'3 plug-and-perf stages');for(const S of D){ok(S.H.every(h=>Object.values(h).every(v=>typeof v!='number'||Number.isFinite(v))),S.name+': history finite');
 ok(S.pnet>0&&S.ISIP>0&&S.fg>1&&S.fg<2.3&&S.xf>20&&S.hf>10,`${S.name}: ISIP ${S.ISIP.toFixed(1)} MPa, Pnet ${S.pnet.toFixed(2)}, FG ${S.fg.toFixed(2)}, xf ${S.xf.toFixed(0)}, hf ${S.hf.toFixed(0)}`);ok(S.maxP<F.FW.maxP,S.name+': below max treating pressure')}
ok(!D[0].so&&!D[1].so&&D[2].so,'screenout only on the aggressive stage 3');
const J=E.jobs();ok(J.frac&&J.frac.cat=='Stimulation','frac job in the sequence library');J.frac.key='frac';const TL=E.timeline(J.frac);let pumped=0;for(let t=0;t<=TL.T;t+=TL.T/200){const s=E.stateAt(J.frac,TL,t);if(s.fr&&s.fr.q>0)pumped++}ok(pumped>40,'stateAt gives live pumping samples ('+pumped+')');
const b0=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],bad=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){const ctx=await b0.createBrowserContext();const p=await ctx.newPage();await p.setViewport(vp);p.on('pageerror',e=>errs.push(String(e)));
 await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(r.method()!='GET'&&!/localhost/.test(u))bad.push(u);if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){bad.push(u);return r.abort()}r.continue()});
 await p.goto(BASE+'/?workover=frac',{waitUntil:'load',timeout:120000});await p.waitForFunction(()=>window.dwWO?.last,{timeout:90000}).catch(()=>{});
 ok(await p.evaluate(()=>document.getElementById('woJob').value=='frac'),nm+': ?workover=frac opens the frac job');const T=await p.evaluate(()=>dwWO.R.TL.T);
 const tx=await p.evaluate(()=>document.getElementById('wo').innerText);ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx),nm+': SIM label, never LIVE');
 let clean=0,chart=0,wing=0,spread=0;for(const [k,fr] of [['rigup',.04],['stage1',.28],['isip1',.33],['stage3',.8],['screenout',.86],['end',1.01]]){await p.evaluate(x=>dwWO.tick(x),T*fr);await w(nm=='desk'?900:500);
  const r=await p.evaluate(()=>({hud:document.getElementById('woHud').innerText,ch:getComputedStyle(document.getElementById('woChart')).display,fr:!!dwWO.last.fr,so:dwWO.last.fr?.so}));if(!/NaN|undefined/.test(r.hud))clean++;if(r.ch=='block')chart++;if(r.fr)wing++;if(/Frac spread/.test(r.hud))spread++;
  if(k=='screenout')ok(/SCREENOUT/.test(r.hud),nm+': stage 3 shows SCREENOUT in HUD');await p.screenshot({path:SH+nm+'_'+k+'.png'})}
 ok(clean==6&&spread==6,nm+': HUD clean at 6 points');ok(chart==6,nm+': pressure/rate/proppant chart shown');ok(wing>=3,nm+': live fracture samples while pumping ('+wing+')');
 if(nm=='phone')ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no horizontal overflow');await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!bad.length,'no external writes '+bad.slice(0,2).join());await b0.close();console.log(`\n${pass} pass, ${fails} fail`);process.exit(fails?1:0)
