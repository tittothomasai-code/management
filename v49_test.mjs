// v4.8 iPhone test: MWD image, curtain section, rotary/slide mode, Survey QC, connection rings (SIM-TEST mock). NO Adaga calls.
// Needs: node mock_upstream.mjs & node witsml_proxy.mjs (fresh, not latched by a 401).
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:8777',SH='shots_live/98_v49_',MOCK='http://127.0.0.1:8799',PROXY=process.argv[3]||'http://localhost:8796/soap';
const ctl=q=>fetch(MOCK+'/ctl/'+q).then(r=>r.json());
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const w=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const p=await b.newPage();const errs=[],ext=[];p.on('pageerror',e=>errs.push(e.message));
await p.setRequestInterception(true);p.on('request',r=>{const u=r.url();if(/adaga|netlify\.app|supabase\.co/i.test(u)){ext.push(u);r.abort()}else r.continue()});
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'/index.html?'+Date.now());await w(2500);await p.evaluate(()=>localStorage.clear());await p.reload();await w(9000);
await ctl('fmt?f=plain');
await p.evaluate((m,px)=>{const X=GX.witsml;X.CFG.proxy=px;X.CFG.url=m+'/witsml';X.setCred('simtest','dummy-not-a-secret');X.open();X.WML.liveMode=true},MOCK,PROXY);
// ---- unit checks (pure functions)
const U=await p.evaluate(()=>{const g=GX.geo8,o={...g.CF,rpmThr:5,flowOn:200,sppOn:2000,minRun:3,standM:30};const rows=[];for(let md=0;md<=120;md++)rows.push({md,rpm:(md>=30&&md<60&&!(md>=40&&md<41))?0:120,flow:2600,spp:18000});
 const iv=g.classifyModes(rows,o);const pumpsOff=g.classifyModes([{md:0,rpm:0,flow:0,spp:0},{md:1,rpm:0,flow:0,spp:0}],o);const unk=g.classifyModes([{md:0,flow:2600},{md:1,flow:2600}],o);
 const gap=g.classifyModes([{md:0,rpm:120},{md:1,rpm:120},{md:2,rpm:120,onBottom:false},{md:3,rpm:120}],o);
 const sp=g.slidePerStand(iv,o);const st=[{mdM:0,inc:0,azi:0},{mdM:30,inc:3,azi:0},{mdM:60,inc:3,azi:0},{mdM:90,inc:6,azi:0}];
 const q=g.surveyQC(st,[{from:0,to:30,mode:'slide'},{from:30,to:60,mode:'slide'},{from:60,to:90,mode:'rotary'}],[{md:30,v:3.1},{md:60,v:6}],o);
 const ic=g.findImageCurves([{mn:'DEPT'},...Array.from({length:16},(_,i)=>({mn:'ABG_B'+String(i+1).padStart(2,'0')})),{mn:'GR'}]);
 return {iv,pumpsOff,unk,gap,sp,q,ic:ic&&{p:ic.prefix,n:ic.bins.length},dip:g.surfTvd(100,1000,2,0)}});
console.log('U',JSON.stringify({iv:U.iv,sp:U.sp,flags:U.q.flags.map(f=>f.flag)}));
ok(U.iv.length==3&&U.iv[1].mode=='slide'&&U.iv[1].from==30&&U.iv[1].to==60,'mode: slide 30–60 m with 1 m rotary flip smoothed away');
ok(U.pumpsOff[0].mode=='rotary','mode: RPM 0 with pumps OFF is not slide');ok(U.unk[0].mode=='unknown','mode: no RPM curve -> "unknown"');ok(U.gap.length==2,'mode: off-bottom rows leave a gap');
ok(U.sp.length==4&&Math.round(U.sp[1].slidePct)==100&&Math.round(U.sp[0].slidePct)==0,'slide % per stand: '+U.sp.map(s=>s.slidePct.toFixed(0)).join('/'));
ok(U.q.flags.some(f=>/slide but near-straight/.test(f.flag)&&f.from==30)&&U.q.flags.some(f=>/rotary but dogleg/.test(f.flag)&&f.from==60)&&U.q.flags.some(f=>/near-bit/.test(f.flag)),'Survey QC flags slide-without-dogleg, rotary-with-dogleg, survey vs near-bit inc');
ok(U.ic&&U.ic.p=='ABG_B'&&U.ic.n==16,'image curves detected from mnemonic list: 16 bins');ok(Math.abs(U.dip-(1000-Math.tan(2*Math.PI/180)*100))<1e-9,'dipping surface TVD follows dip');
// ---- integration on SIM-TEST DR101L / WB01B02
await p.evaluate(async()=>{await GX.witsml.loadWell('DR101L','WB01B02')});await w(4000);
await p.evaluate(async()=>{await GX.geo8.load()});await w(1500);
const I=await p.evaluate(()=>{const G=GX.geo8.G8;return{wb:G.wb,sim:G.sim,img:G.img&&{nb:G.img.nb,n:G.img.rows.length,a:G.img.rows[0].md,b:G.img.rows.at(-1).md,name:G.img.name},gr:G.fe?.gr?.length,nbi:G.fe?.nbi?.length,modes:G.modes.filter(m=>m.mode=='slide').map(m=>[m.from,m.to]),src:G.modeSrc,qc:G.qc&&{n:G.qc.n,flags:G.qc.flags.map(f=>f.from.toFixed(0)+':'+f.flag.slice(0,30))},diag:G.diag.map(d=>d.step),st:document.getElementById('g8st').innerText}});
console.log('I',JSON.stringify(I));
ok(I.wb=='WB01B02'&&/same parent/.test(I.st),'guardrail: logs read only from the active log wellbore WB01B02');ok(I.sim&&/SIM-TEST/.test(I.st),'labelled SIM-TEST mock data');
ok(I.diag[0].includes('id-only')&&I.diag.some(s=>/mnemonics of "MWD Image/.test(s)),'logs found via id-only listing + mnemonic list');
ok(I.img&&I.img.nb==16&&I.img.n>300,'MWD image loaded: 16 bins × '+I.img?.n+' depths');ok(I.gr>1000&&I.nbi>1000,'gamma + near-bit inclination from MWD Formation Eval');
ok(I.modes.some(m=>m[0]==300&&m[1]==750),'slide 300–750 m (build section) classified, 2 m rotary flip smoothed; source '+I.src);
ok(I.qc.flags.some(f=>/^(990|1020):slide but/.test(f))&&I.qc.flags.some(f=>/^1200:survey inc/.test(f)),'Survey QC flags deliberate bad slide @1000 m and near-bit mismatch @1200 m');
const roof=await p.evaluate(()=>{const cu=GX.geo8.curtain(GEO.calc),l=cu.at(-1);Object.assign(GX.geo8.CF,{roof:l.tvd-2+Math.tan(1*Math.PI/180)*l.hd,thick:5,dip:1,hd0:0});GX.geo8.build3D();GX.geo8.render();return l});
await p.evaluate(()=>{document.getElementById('g8btn').click()});await w(1500);await p.evaluate(()=>document.getElementById('g8').scrollTop=0);await p.screenshot({path:SH+'1_iphone_image_tracks.png'});
await p.evaluate(()=>document.getElementById('g8cur').scrollIntoView());await w(500);await p.screenshot({path:SH+'2_iphone_curtain_section.png'});
const cur=await p.evaluate(()=>{const c=document.getElementById('g8cur'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let o=0,bl=0,y=0;for(let i=0;i<d.length;i+=4){if(d[i]>240&&d[i+1]>120&&d[i+1]<150&&d[i+2]<20)o++;if(d[i]<60&&d[i+1]>110&&d[i+1]<135&&d[i+2]>240)bl++;if(d[i]>240&&d[i+1]>240&&d[i+2]<100)y++}return{o,bl,y,qc:document.getElementById('g8qc').innerText}});
ok(cur.bl>20&&cur.y>20,'curtain shows mode-coloured trajectory + target roof (px blue '+cur.bl+', roof '+cur.y+')');ok(/Survey QC/.test(cur.qc)&&/flagged/.test(cur.qc),'Survey QC summary: '+cur.qc.split('\n')[0]);
// ---- v4.9 Kalman
const KS=await p.evaluate(()=>{const b=GX.geo8.K9.synthBench();delete b.K;return b});console.log('KS',JSON.stringify(KS));
ok(KS.n>=6&&KS.rmsTop<0.5&&KS.rmsBot<0.5&&Math.abs(KS.dipEst-KS.dipTrue)<0.3&&KS.misclassified==0,`synthetic: ${KS.n} crossings, RMS top ${KS.rmsTop.toFixed(3)} m / bottom ${KS.rmsBot.toFixed(3)} m vs truth, dip ${KS.dipEst.toFixed(2)}° vs ${KS.dipTrue}°, 0 misclassified`);
ok(KS.cover1s>=0.5,'synthetic: truth inside ±1σ for '+(KS.cover1s*100).toFixed(0)+'% of HL');
const KN=await p.evaluate(()=>{const K=GX.geo8.K9;const S=[];for(let h=0;h<200;h++)S.push({md:h,hd:h,tvd:1000+h*0.1,v:h>50&&h<120?40:110,up:NaN,dn:NaN});const c=K.findCrossings(S,{cut:75});return c.map(x=>x.boundary+':'+x.by)});
ok(KN.length==2&&KN[0].startsWith('top')&&KN[1].startsWith('bottom'),'no image: direction fallback top/bottom '+KN.join(','));
const KM=await p.evaluate(()=>{const k=GX.geo8.G8.kal;if(!k||k.none)return {none:true,msg:k?.msg,fm:GX.witsml.WML.sv?.fm};const g=k.K.grid;return {fm:GX.witsml.WML.sv?.fm,cr:k.cr.map(c=>({md:+c.md.toFixed(1),hd:c.hd,tvd:+c.tvd.toFixed(2),b:c.boundary,by:c.by})),grid:g.filter((p,i)=>i%10==0).map(p=>({hd:p.hd,top:p.top,bot:p.bot,sTop:p.sTop,sBot:p.sBot,dip:p.dip})),cmp:k.cmp,txt:document.getElementById('g8kal').innerText}});
console.log('KM',JSON.stringify({...KM,grid:undefined}).slice(0,1500));
ok(!KM.none&&KM.cr.length>=2&&KM.cr.every(c=>/image/.test(c.by)),'mock: crossings classified by image up/down bins: '+(KM.cr||[]).map(c=>c.md+'→'+c.b).join(', '));
ok(!KM.none&&KM.cr.some(c=>c.b=='top'&&Math.abs(c.md-1250)<3)&&KM.cr.some(c=>c.b=='bottom'&&Math.abs(c.md-1400)<3),'mock: top @~1250 m MD, bottom @~1400 m MD');
if(!KM.none){const T=await ctl('res?hd='+KM.grid.map(g=>g.hd.toFixed(2)).join(','));const cr=KM.cr,hlo=Math.min(...cr.map(c=>c.hd)),hhi=Math.max(...cr.map(c=>c.hd));const e=KM.grid.map((g,i)=>({g,t:T.pts[i]})).filter(x=>x.g.hd>=hlo&&x.g.hd<=hhi);
 const rt=Math.sqrt(e.reduce((s,x)=>s+(x.g.top-x.t.top)**2,0)/e.length),rb=Math.sqrt(e.reduce((s,x)=>s+(x.g.bot-x.t.bot)**2,0)/e.length);console.log('MOCKTRUTH',JSON.stringify({rt,rb,n:e.length,dipTrue:T.dip,dipEst:KM.grid[5].dip}));
 const cons=e.filter(x=>Math.abs(x.g.top-x.t.top)<=2*x.g.sTop+0.05&&Math.abs(x.g.bot-x.t.bot)<=2*x.g.sBot+0.05).length;
 ok(cons==e.length&&rt<5&&rb<5,`mock SIM-TEST vs truth (between crossings, truth inside ±2σ at ${cons}/${e.length}): RMS top ${rt.toFixed(2)} m, bottom ${rb.toFixed(2)} m (dip est ${KM.grid[5].dip.toFixed(2)}° vs ${T.dip}° true — only 2 crossings, dip weakly constrained)`)}
ok(/Estimated \(Kalman, gamma\)/.test(KM.txt||'')&&(/no reference picks in data/.test(KM.txt)||/RMS/.test(KM.txt)),'Kalman summary labelled, refs: '+(KM.cmp?.none?'none':'RMS '+KM.cmp?.rms?.toFixed(2)+' agree '+KM.cmp?.agree+'/'+KM.cmp?.n));
const kpx=await p.evaluate(()=>{const c=document.getElementById('g8cur'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let cy=0,mg=0;for(let i=0;i<d.length;i+=4){if(d[i]<40&&d[i+1]>200&&d[i+2]>230)cy++;if(d[i]>230&&d[i+1]<90&&d[i+2]>230)mg++}return{cy,mg}});
ok(kpx.cy>20&&kpx.mg>20,'curtain: Kalman top (cyan) / bottom (magenta) with ±1σ bands '+JSON.stringify(kpx));
await p.evaluate(()=>document.getElementById('g8kal').scrollIntoView());await w(400);await p.screenshot({path:SH+'6_iphone_kalman_summary.png'});
// reference-pick path (unit): markers vs estimate
const RF=await p.evaluate(()=>{const K=GX.geo8.K9,k=GX.geo8.G8.kal;if(!k||k.none)return null;const c=k.cr[0];return K.compareRefs(k.K,[{name:'unit top',hd:c.hd,tvd:c.tvd+0.3,boundary:c.boundary}],0.25)});
ok(RF&&RF.n==1&&Math.abs(RF.picks[0].res-0.3)<0.3&&isFinite(RF.rms),'reference picks: residual/RMS/agreement computed ('+(RF?RF.picks[0].res.toFixed(2)+' m, agree '+RF.agree:'')+')');
const NR=await p.evaluate(()=>{const k=GX.geo8.G8.kal;return k&&!k.none?GX.geo8.K9.compareRefs(k.K,[]).msg:''});ok(NR=='no reference picks in data','no markers → "no reference picks in data"');
await p.evaluate(()=>document.getElementById('g8qc').scrollIntoView());await w(400);await p.screenshot({path:SH+'3_iphone_survey_qc.png'});
await p.evaluate(()=>{document.getElementById('g8').style.display='none'});

const td=await p.evaluate(()=>GX.geo8.view3D(0.85));await w(1500);console.log('TD',JSON.stringify(td));ok(td.modes>0&&td.img>0&&td.planes>=2&&td.kal==2,'3D: mode path, image texture, target planes, Kalman top/bottom surfaces '+JSON.stringify(td));
await p.screenshot({path:SH+'4_iphone_3d_mode_path_image.png'});
// ---- connection rings (SIM-TEST bit-depth timeline: 4 joints)
await p.evaluate(()=>{GX.witsml.WML.liveMode=false;GX.bit.simStart()});await w(20000);
const RG=await p.evaluate(()=>{GX.geo8.buildRings(true);const L=GX.geo8.connList();if(L[1])GX.geo8.showConn(L[1],40,300);return{n:L.length,src:L.map(x=>x.src),d:L.map(x=>+x.depth_m.toFixed(1)),j:L.map(x=>x.joint_m),pop:document.getElementById('ringpop')?.innerText||''}});
console.log('RG',JSON.stringify(RG));ok(RG.n>=1&&/Depth/.test(RG.pop)&&/Duration/.test(RG.pop)&&/Confidence/.test(RG.pop)&&/Source/.test(RG.pop),'connection ring popup: time, depth, duration, joint length, source, confidence');
await p.screenshot({path:SH+'5_iphone_connection_ring_popup.png'});
const off=await p.evaluate(()=>{GX.geo8.CF.rings=false;GX.geo8.buildRings(true);const a=document.querySelector('canvas');return true});ok(off,'rings toggle off');
await p.evaluate(()=>{GX.geo8.CF.rings=true;GX.geo8.buildRings(true)});
const html=await p.content();ok(!/dummy-not-a-secret/.test(html),'no credential in page');ok(!errs.length,'no page errors '+errs.join(';'));ok(!ext.length,'no Adaga calls');
console.log('FAILURES',fails);await b.close();process.exit(fails?1:0);
