// node v45_unit.mjs — v4.5 slips inferred from bit depth (no slips, no hookload curve). SIM-TEST synthetic only, no network.
import * as K from './conn.js';import * as SL from './slips.js';
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};const acc=[];
function score(name,rows,truth,opt={}){const r=K.detect(rows,opt);const C=r.connections;let tp=0,ein=[],eout=[],used=new Set();
 for(const tr of truth){const c=C.find((c,k)=>!used.has(k)&&Math.abs(c.tSlipsIn-tr.tSlipsIn)<=90);if(c){used.add(C.indexOf(c));tp++;ein.push(Math.abs(c.tSlipsIn-tr.tSlipsIn));eout.push(Math.abs(c.tSlipsOut-tr.tSlipsOut))}}
 const fp=C.length-tp,mean=a=>a.length?(a.reduce((s,x)=>s+x,0)/a.length).toFixed(0):'-';const lenErr=r.kpi.medianLen_m;
 const line={name,truth:truth.length,detected:C.length,tp,fp,fn:truth.length-tp,slipsIn_err_s:mean(ein),slipsOut_err_s:mean(eout),medianLen_m:lenErr?.toFixed(2),conf:C.map(c=>c.confidence).join('/')};acc.push(line);console.log('  ',JSON.stringify(line));return r}
// 1 singles, full channels minus slips/hookload, noise ±0.05 m
{const s=K.synth({joints:6});const r=score('singles noise±0.05 (block,pumps,rpm)',SL.strip(s.rows,{noise:0.05}),s.truth);
 ok(r.info.slipsFrom==SL.LABEL,'labelled "'+r.info.slipsFrom+'"');ok(r.connections.length==6&&r.connections.every(c=>c.inferred&&c.confidence>=0.5),'6/6 connections, all inferred with confidence ≥0.5');
 ok(Math.abs(r.kpi.medianLen_m-9.4)<0.3,'median joint '+r.kpi.medianLen_m.toFixed(2)+' m');ok(/slips_confidence/.test(K.toCSV(r)),'CSV has confidence + source')}
{const s=K.synth({joints:4,stand:true});const r=score('stands noise±0.05',SL.strip(s.rows,{noise:0.05}),s.truth);ok(r.connections.length==4&&r.kpi.mode=='stand','stands 4/4 '+r.kpi.mode)}
{const s=K.synth({joints:5,noBlock:true});const r=score('no block channel, noise±0.05',SL.strip(s.rows,{noise:0.05}),s.truth);ok(r.connections.length==5,'no block: 5/5')}
{const s=K.synth({joints:5,pumpBlip_at:2,pumpBlip_s:30});const r=score('short 30 s pump-off on bottom',SL.strip(s.rows,{noise:0.05}),s.truth);ok(r.connections.length==5,'short pump-off ignored (5)')}
{const s=K.synth({joints:5,pumpBlip_at:2,pumpBlip_s:120});const r=score('120 s pump-off on bottom',SL.strip(s.rows,{noise:0.05}),s.truth);ok(r.connections.length==5,'120 s pump-off on bottom ignored (5)')}
// bit depth ONLY (plus hole depth): drop every other curve
{const s=K.synth({joints:6});const rows=SL.strip(s.rows,{noise:0.05}).map(x=>({t:x.t,bd:x.bd,hd:x.hd}));const r=score('bit+hole depth ONLY noise±0.05',rows,s.truth);ok(r.connections.length==6,'bit-depth only: 6/6');ok(r.connections.every(c=>c.confidence>=0.5&&c.confidence<0.9),'bit-depth-only confidence lower ('+r.connections.map(c=>c.confidence)+')')}
{const s=K.synth({joints:6});const rows=SL.strip(s.rows,{noise:0.05}).map(x=>({t:x.t,bd:x.bd}));const r=score('bit depth ONLY (hole = deepest bit) noise±0.05',rows,s.truth);ok(r.connections.length==6,'bit depth only, no hole curve: 6/6')}
// tripping: slips set between stands, no drilling -> no connections
{const s=SL.synthTrip({stands:6,noise:0.05});const r=score('tripping out 6 stands',s.rows,[]);ok(r.connections.length==0,'tripping: 0 connections (false positives '+r.connections.length+')');
 const I=SL.infer(s.rows);ok(I.intervals.filter(v=>v.kind=='trip').length>=5,'tripping slips classified as trip ('+I.intervals.map(v=>v.kind).join(',')+')')}
{const s=SL.synthTrip({stands:6,noise:0.05});const rows=s.rows.map(x=>({t:x.t,bd:x.bd,hd:x.hd}));const r=score('tripping, bit+hole depth only',rows,[]);ok(r.connections.length==0,'tripping bit-depth only: 0 connections')}
// off-bottom circulating with pumps+rotation on (reaming/circulating): flat bit but not slips
{const rows=[];for(let t=0;t<600;t+=5)rows.push({t,bd:1500+(t<100?t/100*0:0)-2,hd:1500,flow:2800,rpm:100,bh:10});rows.push(...Array.from({length:40},(_,k)=>({t:600+k*5,bd:1500+k*0.01,hd:1500+k*0.01,flow:2800,rpm:120,bh:10})));
 const I=SL.infer(rows);ok(I.intervals.every(v=>!v.inSlips),'circulating off bottom with pumps+rpm on: not slips (conf '+I.intervals.map(v=>v.conf)+')');const r=K.detect(rows);ok(r.connections.length==0,'circulating: 0 connections')}
// live provisional: cut the log mid-connection
{const s=K.synth({joints:3});const cut=s.truth[1].tSlipsIn+120;const rows=SL.strip(s.rows,{noise:0.05}).filter(x=>x.t<=cut);const I=SL.infer(rows);ok(I.current.inSlips&&I.current.provisional,'live: provisional IN SLIPS mid-connection (conf '+I.current.conf+')')}
{const s=K.synth({joints:3});const cut=s.truth[1].tSlipsIn-200;const I=SL.infer(SL.strip(s.rows,{noise:0.05}).filter(x=>x.t<=cut));ok(!I.current.inSlips,'live: not in slips while drilling')}
// existing behaviour: slips channel still preferred
{const s=K.synth({joints:5,withSlips:true});ok(K.detect(s.rows).info.slipsFrom=='slips channel','slips channel still preferred when present')}
console.log('ACCURACY '+JSON.stringify(acc));console.log(f?'FAILS '+f:'ALL PASS');process.exit(f?1:0)
