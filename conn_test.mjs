// node conn_test.mjs — unit tests for connection/joint detection on SIM-TEST synthetic data (no network)
import * as K from './conn.js';
let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
{const {rows,truth}=K.synth({joints:6});const r=K.detect(rows);ok(r.connections.length==6,'singles: 6 known connections -> '+r.connections.length);
 ok(r.connections.length==6&&r.connections.every((c,i)=>Math.abs(c.depth_m-truth[i].depth_m)<0.5),'connection depths within 0.5 m');
 ok(r.connections.length==6&&r.connections.every((c,i)=>Math.abs(c.tSlipsIn-truth[i].tSlipsIn)<=10&&Math.abs(c.duration_s-240)<=15),'slips-to-slips ≈240 s ('+r.connections.map(c=>c.duration_s).join(',')+')');
 ok(r.kpi.mode=='single'&&Math.abs(r.kpi.medianLen_m-9.4)<0.2,'median length '+r.kpi.medianLen_m?.toFixed(2)+' m -> single');
 ok(r.toolJoints.length>=6&&r.toolJoints.filter(j=>!j.extrapolated).length==6,'tool joints: 6 from connections + extrapolated ('+r.toolJoints.length+')');
 ok(/^# Connections — Estimated from data/.test(K.toCSV(r))&&K.toCSV(r).trim().split('\n').length==8,'CSV export rows')}
{const {rows}=K.synth({joints:4,stand:true});const r=K.detect(rows);ok(r.connections.length==4&&r.kpi.mode=='stand','stands: 4 connections, mode '+r.kpi.mode+' '+r.kpi.medianLen_m?.toFixed(1)+' m')}
{const {rows}=K.synth({joints:5,pumpBlip_at:2,pumpBlip_s:30});const r=K.detect(rows);ok(r.connections.length==5,'short 30 s pump-off on bottom does NOT trigger ('+r.connections.length+')')}
{const {rows}=K.synth({joints:5,pumpBlip_at:2,pumpBlip_s:120});const r=K.detect(rows);ok(r.connections.length==5,'120 s pump-off while drilling (no slips, on bottom) does NOT trigger ('+r.connections.length+')')}
{const {rows}=K.synth({joints:5,noBlock:true});const r=K.detect(rows);ok(r.connections.length==5,'works without block-height channel')}
{const {rows}=K.synth({joints:5,withSlips:true});const r=K.detect(rows);ok(r.connections.length==5&&r.info.slipsFrom=='slips channel','uses slips channel when present')}
{const {rows}=K.synth({joints:5});const r=K.detect(rows,{minSlips_s:400});ok(r.connections.length==0,'threshold configurable (minSlips 400 s -> 0)')}
{const {rows}=K.synth({joints:3});const r=K.detect(rows.filter((x,i)=>i%3==0));ok(r.connections.length==3,'coarser 15 s sampling still 3')}
ok(K.detect([]).connections.length==0,'empty input -> no connections, no crash');
console.log(f?'FAILURES '+f:'ALL PASS');process.exit(f?1:0)
