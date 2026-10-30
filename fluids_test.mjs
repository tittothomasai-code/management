// Fluids, hydraulics, pits and well control (?demo=fluids). Model checks + UI desk/phone. SIM only, no network writes.
import puppeteer from 'puppeteer-core';import * as F from './fluids.js';import * as W from './wellctl.js';
const BASE=(process.argv[2]||'http://localhost:8815').replace(/\/$/,''),SH='shots_live/'+(process.env.SHOT||'140_fluids_');
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0,pass=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?pass++:fails++};
// Stage 1 rheology (API RP 13D)
const m=F.MUDS.wbm,b=F.bingham(m);ok(b.PV==18&&b.YP==16,'Bingham PV/YP from θ600/θ300');const p=F.powerLaw(m);ok(Math.abs(p.np-3.32*Math.log10(52/34))<1e-9&&p.na>0&&p.na<1,'power-law n pipe/annulus');
const h=F.herschel(m);ok(h.tyLB==4&&h.n>0&&h.n<1,'HB τy = 2θ3 − θ6 = 4');ok(Math.abs(F.tauModel(m,511,'hb')-34*F.DEG)<0.05,'HB fits θ300 at 511 1/s');ok(F.mudCheck(m).length>=9,'mud check rows');
const bad=F.clone(m);bad.solids.lgs=9;ok(F.mudCheck(bad).some(c=>/solids/i.test(c.k)&&!c.ok),'mud check flags high LGS');
// Stage 2 hydraulics
const wl=F.defWell(),Q=0.0333,H=F.hydraulics(m,wl,Q);const sum=H.surf+H.string+H.bit+H.ann+H.mwd;ok(Math.abs(sum-H.spp)<1,'SPP = sum of losses');ok(H.spp>8e6&&H.spp<25e6,'SPP plausible '+(H.spp/1e6).toFixed(1)+' MPa @2000 L/min');
ok(H.ecd>m.sg&&H.ecd<m.sg+0.15,'ECD > MW, '+H.ecd.toFixed(3));const An=F.nozzleArea(wl.nozzles);ok(Math.abs(H.bit-1250*Q*Q/(2*0.95**2*An**2))<1,'bit Δp = ρQ²/(2Cd²A²)');
const H2=F.hydraulics(m,wl,Q*1.3);ok(H2.spp>H.spp&&H2.ecd>H.ecd,'more flow → more SPP and ECD');ok(F.pumpOutput(wl.pump,100)*60000>1550&&F.pumpOutput(wl.pump,100)*60000<1700,'triplex 6×12 @100 spm ≈ 1620 L/min (16.7 L/stroke × 97 %)');
const C=F.cuttings(m,wl,H,25),Cl=F.cuttings(m,wl,F.hydraulics(m,wl,0.008),25);ok(C.Ft>Cl.Ft&&C.Ca<Cl.Ca,'lower flow → worse transport');
const s1=F.surgeSwab(m,wl,0.3),s2=F.surgeSwab(m,wl,1);ok(s2.emwSurge>s1.emwSurge&&s2.emwSwab<s1.emwSwab,'faster trip → more surge/swab');ok(F.tripLimits(m,wl,1.2,1.6)>0,'max trip speed found');
const wu=F.weightUp(1.2,1.4,100);ok(Math.abs((1.2*100+wu.kg/1000)/wu.vNew-1.4)<1e-9,'weight-up mass balance '+Math.round(wu.kg)+' kg barite');{const o=F.hydroPT(F.MUDS.obm,2800),wb=F.hydroPT(F.MUDS.wbm,2800);ok(o.esd<F.MUDS.obm.sg&&o.esd>F.MUDS.obm.sg-0.06,'OBM ESD drops with temperature '+o.esd.toFixed(3));ok((F.MUDS.obm.sg-o.esd)>(F.MUDS.wbm.sg-wb.esd),'OBM more T/P sensitive than WBM');const cold=F.mudAt(F.MUDS.obm,40e6,20);ok(cold.sg>F.MUDS.obm.sg,'pressure compresses OBM at low T');ok(o.pvBottom<F.bingham(F.MUDS.obm).PV,'hot OBM PV lower')}const dl=F.dilute(1.4,1.2,100);ok(Math.abs((140+dl.vAdd)/dl.vNew-1.2)<1e-9,'dilution mass balance');
// Stage 3/4 well control
const S=W.newWC();for(let i=0;i<60;i++)W.step(S,1);ok(Math.abs(S.pits.active-60)<0.05&&S.qInf==0,'drilling overbalanced: pit stable');
W.takeKick(S,S.omw+0.15);let t=0;while(!S.flags.kick&&t<3600){W.step(S,1);t++}ok(S.flags.kick&&t<1200,'kick detected by pit gain in '+t+' s');
W.shutIn(S);for(let i=0;i<240;i++)W.step(S,1);ok(S.Pdp>1e6&&S.Pc>S.Pdp,'shut in: SICP > SIDPP (light influx)');const K=W.killSheet(S);ok(K.kmw>=S.pore-0.01&&K.icp>K.fcp,'kill sheet KMW '+K.kmw+' SG, ICP > FCP');
ok(Math.abs(K.fcp-K.scrP*K.kmw/S.omw)<1,'FCP = SCR × KMW/OMW');ok(Math.abs(K.icp-(K.sidpp+K.scrP))<1,'ICP = SIDPP + SCR');
for(const meth of ['dm','ww']){const Z=W.newWC();for(let i=0;i<30;i++)W.step(Z,1);W.takeKick(Z,Z.omw+0.15);let k=0;while(!Z.flags.kick&&k<3600){W.step(Z,1);k++}W.shutIn(Z);for(let i=0;i<240;i++)W.step(Z,1);Z.auto=true;W.startKill(Z,meth);const PP=Z.pore*1000*9.81*Z.w.tvd;let mn=1e12;for(let i=0;i<6*3600&&!Z.done;i++){W.step(Z,1);if(i>300)mn=Math.min(mn,Z.BHP)}
 ok(Z.done,meth+': well killed in '+Math.round(Z.t/60)+' min');ok(mn>PP*0.985,meth+': BHP held near/above pore (min '+(mn/PP*100).toFixed(1)+' %)');ok(!Z.flags.fracExceeded,meth+': no shoe losses')}
const L=W.newWC({shoeFracSG:1.30});L.spm=140;for(let i=0;i<120;i++)W.step(L,1);ok(L.flags.fracExceeded&&L.lossTot>0,'ECD over frac → lost circulation');
{const run=a=>{const S=W.newWC();W.takeKick(S,S.omw+0.15);let k=0;while(!S.flags.kick&&k<3600){W.step(S,1);k++}W.shutIn(S);for(let j=0;j<240;j++)W.step(S,1);S.auto=a=='auto';W.startKill(S,'ww');if(a=='open')S.choke=1;let t=0;while(!S.done&&t<20000){W.step(S,1);t++}return W.score(S)};
 const A=run('auto'),O=run('open');ok(A&&A.score>=90&&A.minMarginMPa>0,'choke score: auto choke holds BHP over pore → '+(A&&A.score));ok(O&&O.score<60&&O.underMPaMin>0,'choke score: open choke under-balanced → '+(O&&O.score)+' '+(O&&O.grade))}
const T=W.newWC();for(let i=0;i<570;i++)W.tripStep(T,1,0.5,{swabSG:0.25});ok(T.flags.swab,'swabbed influx seen on trip tank');
// UI
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const errs=[],badr=[];
for(const [nm,vp] of [['desk',{width:1440,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
 const ctx=await br.createBrowserContext();const pg=await ctx.newPage();await pg.setViewport(vp);pg.on('pageerror',e=>errs.push(String(e)));
 await pg.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});
 await pg.setRequestInterception(true);pg.on('request',r=>{const u=r.url();if(/supabase\.co|adaga|witsml/i.test(u)&&!/\.js(\?|$)/.test(u)){badr.push(u);return r.abort()}if(r.method()!='GET')badr.push(u);r.continue()});
 await pg.goto(BASE+'/?demo=fluids',{waitUntil:'load',timeout:120000});await pg.waitForFunction(()=>window.dwFlu,{timeout:90000}).catch(()=>{});ok(await pg.evaluate(()=>!!window.dwFlu),nm+': ?demo=fluids opens');
 for(const [tab,i] of [['mud',1],['hyd',2],['pit',3],['wc',4]]){await pg.evaluate(t=>dwFlu.show(t),tab);await w(600);if(tab=='pit'){await pg.click('#fsim');await w(300)}
  if(tab=='wc'){await pg.evaluate(()=>{const S=dwFlu.wc;dwFlu.st.speed=60;dwFlu.W.takeKick(S,S.omw+0.15);let k=0;while(!S.flags.kick&&k<3600){dwFlu.W.step(S,1);k++}dwFlu.W.shutIn(S);for(let j=0;j<240;j++)dwFlu.W.step(S,1);S.auto=true;dwFlu.W.startKill(S,'dm');dwFlu.show('wc');for(let j=0;j<1500;j++)dwFlu.W.step(S,1)});await w(1200)}
  const tx=await pg.evaluate(()=>flu.innerText);ok(/\bSIM\b/.test(tx)&&!/\bLIVE\b/.test(tx),nm+' '+tab+': SIM, never LIVE');ok(!/NaN|undefined|Infinity/.test(tx),nm+' '+tab+': no NaN');
  if(tab=='hyd')ok(/MPa/.test(tx)&&/SG/.test(tx)&&/L\/min/.test(tx),nm+': metric units');if(tab=='wc')ok(/Kill mud weight/.test(tx)&&/ICP/.test(tx),nm+': kill sheet shown');
  if(nm=='phone')ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&flu.scrollWidth<=innerWidth+1),nm+' '+tab+': no horizontal overflow');
  await pg.screenshot({path:SH+i+'_'+tab+'_'+nm+'.png'})}
 await ctx.close()}
{const ctx=await br.createBrowserContext();const pg=await ctx.newPage();await pg.setViewport({width:1440,height:900});pg.on('pageerror',e=>errs.push(String(e)));
 await pg.evaluateOnNewDocument(()=>{window.WebSocket=class{constructor(){this.readyState=3}send(){}close(){}}});
 await pg.goto(BASE+'/?nosplash=1&fluids',{waitUntil:'load',timeout:120000});await pg.waitForFunction(()=>window.dwFlu?.d3,{timeout:120000}).catch(()=>{});
 const r=await pg.evaluate(async()=>{const d=dwFlu.d3;if(!d)return null;dwFlu.show('wc');await new Promise(r=>setTimeout(r,500));const a0=d.level.act;dwFlu.st.wc.pits.active=30;await new Promise(r=>setTimeout(r,500));const a1=d.level.act;
  const c0=d.act.m.color.getHex();dwFlu.st.mudK='obm';dwFlu.st.mud=dwFlu.F.clone(dwFlu.F.MUDS.obm);dwFlu.st.wc.mud=dwFlu.st.mud;await new Promise(r=>setTimeout(r,500));return{a0,a1,c0,c1:d.act.m.color.getHex(),inScene:!!G._scene.getObjectByName('SIM mud tanks')}});
 ok(r&&r.inScene,'rig: mud tanks in 3D scene');ok(r&&r.a1<r.a0,'rig: pit level follows active volume '+(r&&r.a0.toFixed(2))+'→'+(r&&r.a1.toFixed(2)));ok(r&&r.c0!=r.c1,'rig: mud colour follows type (WBM→OBM) '+JSON.stringify(r));
 await pg.evaluate(()=>{const d=dwFlu.d3.root.position;G.cam?.position?.set(d.x+12,d.y+8,d.z+12);G.ctl?.target?.copy?.(d);G.ctl?.update?.();const f=document.getElementById('flu');if(f)f.style.display='none'});await w(1500);await pg.screenshot({path:SH+'5_3d_desk.png'});await ctx.close()}
ok(!errs.length,'no page errors '+errs.slice(0,3).join(' | '));ok(!badr.length,'no writes / witsml / supabase');console.log(`\n${pass} pass, ${fails} fail`);await br.close();process.exit(fails?1:0)
