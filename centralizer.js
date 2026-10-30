// v5.14 Centraliser standoff (SIM). Method per API RP 10D-2 / ISO 10427-2: lateral load at each centraliser, standoff from
// the bow-spring load-deflection curve, sag between centralisers, standoff ratio Rs = 100·S/la, la = (Dhole − Dcasing)/2.
// The load-deflection curve here is a SIM linear spring (not a vendor test curve). Target Rs ≥ 67 % (API 10D test value). No network.
import {well,casingPlan,G} from './ops3d.js';
const IN=0.0254,E=207e9,STEEL=7.85;
export const SPRING={k:3.0e6,e0Frac:1.0};// N/m SIM; bow fully open at zero load = full annular clearance
export const TARGET=67;
// casing body: OD/ID (m), buoyed weight N/m
export function body(P,mudSG=1.25){const D=P.Dp,t=P.e.p.t*IN,d=D-2*t,I=Math.PI/64*(D**4-d**4);return {D,d,I,wb:P.kgm*G*(1-mudSG/STEEL)}}
// sag: continuous string over centralisers ≈ fixed-end beam, w·L⁴/(384·E·I)
// per centraliser at md: lateral load = buoyed weight of one span × sin(inc) + tension × dogleg over the span (N)
export function standoff(w,P,md,span,{mudSG=1.25,k=SPRING.k}={}){const B=body(P,mudSG),la=(P.Dh-P.Dp)/2,i=w.inc(md),i2=w.inc(Math.min(P.s.shoeMD,md+span)),
 below=Math.max(0,P.s.shoeMD-md),T=B.wb*below*Math.max(0,Math.cos(i)),dog=Math.abs(i2-i);
 const F=B.wb*span*Math.sin(i)+T*dog,Sc=Math.max(0,la*SPRING.e0Frac-F/k),sag=B.wb*Math.sin(i)*span**4/(384*E*B.I),Ss=Math.max(0,Sc-sag),S=Math.min(Sc,Ss);
 return {md,inc:i*180/Math.PI,F,la,Sc,sag,Ss,Rs:100*S/la,ok:100*S/la>=TARGET}}
export function profile(w=well(),P=casingPlan(w),{every=1,from}={}){const span=every*12.2,top=from??P.prev.shoeMD,out=[];for(let md=P.s.shoeMD-6;md>=top;md-=span)out.push(standoff(w,P,md,span));return out}
// fewest centralisers that keep min Rs ≥ target across the open hole (1 per joint, per 2, per 3)
export function recommend(w=well(),P=casingPlan(w)){const r=[1,2,3].map(n=>{const p=profile(w,P,{every:n});return {every:n,count:p.length,minRs:Math.min(...p.map(x=>x.Rs)),p}});
 return {options:r,best:[...r].reverse().find(o=>o.minRs>=TARGET)||r[0]}}
export function html(R){const f=x=>x.toFixed(0);const b=R.best;return `<div id=cntz style="margin-top:10px;background:#0d1620;border:1px solid #233;border-radius:10px;padding:10px"><b>Centraliser standoff</b> <span style="background:#c9a227;color:#111;border-radius:5px;padding:0 6px;font-weight:700">SIM</span>
 <div style="opacity:.7;font-size:12px">Open hole · method of API RP 10D-2 · SIM bow-spring curve · target ≥ ${TARGET} %</div>
 <table style="margin-top:6px;border-collapse:collapse">${R.options.map(o=>`<tr${o===b?' style="color:#3ddc84"':''}><td style="padding:2px 8px">1 per ${o.every} joint${o.every>1?'s':''}</td><td style="padding:2px 8px;text-align:right">${o.count} pcs</td><td style="padding:2px 8px;text-align:right">min ${f(o.minRs)} %</td><td>${o.minRs>=TARGET?'✓':'✗'}</td></tr>`).join('')}</table>
 <div style="margin-top:4px">Use: <b>1 per ${b.every} joint${b.every>1?'s':''}</b> (${b.count} centralisers). Low standoff lets mud stay on the low side and gives a poor cement seal.</div></div>`}
