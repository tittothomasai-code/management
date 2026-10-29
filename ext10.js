// ext10.js v5.2: SIM-TEST reference fixture (hand-transcribed from the WestSide/Ensign 958 geosteering report, NOT live)
// + "Compare to report": paste the report's Last survey / Projection rows → deltas vs our minimum-curvature values.
import * as GG from './geo.js?v=52';
const FT=0.3048,R=Math.PI/180;let C,S;const $=id=>document.getElementById(id);const es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
export const REF_URL='fixtures/westside_dr101l_wb01b02_2879.json';
// parse pasted report rows. Accepts "Last survey 2,851.05 92.34 171.74 171.74 250.52 109.41 1.08" (7 nums incl. magnetic azi), 6 nums (no mag azi), or 5 (no DLS).
export function parseReport(text){const out={};for(const line of String(text).split(/\r?\n/)){const l=line.replace(/(\d),(\d{3})/g,'$1$2');const n=(l.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);if(n.length<5)continue;
  const key=/proj|bit/i.test(l)?'proj':/last|survey/i.test(l)?'last':(out.last?'proj':'last');let r;
  if(n.length>=7)r={md:n[0],inc:n[1],azi:n[2],tvd:n[4],tvdss:n[5],dls:n[6]};else if(n.length==6)r={md:n[0],inc:n[1],azi:n[2],tvd:n[3],tvdss:n[4],dls:n[5]};else r={md:n[0],inc:n[1],azi:n[2],tvd:n[3],tvdss:n[4]};out[key]=r}
 return out}
// our values (metres) for a report row, using GEO.calc (ft internally). elev = RT elevation above datum (TVD − TVDSS).
export function ours(calc,rep,elev){const res={};if(!calc||calc.length<2)return null;const L=calc.at(-1);
 if(rep.last){const m=rep.last.md/FT,p=GG.pointAt(calc,m);let k=calc.findIndex(s=>Math.abs(s.md-m)<0.05/FT);const dls=k>0?calc[k].dls*10/(100*FT):null;
  res.last={md:rep.last.md,inc:p.inc,azi:p.azi,tvd:p.tvd*FT,tvdss:p.tvd*FT-elev,dls,station:k>=0,projected:p.projected}}
 if(rep.proj){const base=rep.last?GG.pointAt(calc,rep.last.md/FT):L,dm=rep.proj.md/FT-base.md;
  // report style: straight line along the last survey's inclination/azimuth (WestSide "Projection")
  const tv=base.tvd+dm*Math.cos(base.inc*R);
  // min-curvature to the report's projected inc/azi (alternative)
  const mc=GG.minCurvStations([{md:base.md,inc:base.inc,azi:base.azi},{md:rep.proj.md/FT,inc:rep.proj.inc,azi:rep.proj.azi}],{tieIn:{tvd:base.tvd,ns:base.ns,ew:base.ew}})[1];
  res.proj={md:rep.proj.md,tvd:tv*FT,tvdss:tv*FT-elev,tvdMC:mc.tvd*FT,tvdssMC:mc.tvd*FT-elev}}
 return res}
export function deltas(rep,o){const d=(a,b)=>(isFinite(a)&&isFinite(b))?b-a:null;const r={};
 if(rep.last&&o.last)r.last={inc:d(rep.last.inc,o.last.inc),azi:o.last?((d(rep.last.azi,o.last.azi)+540)%360)-180:null,tvd:d(rep.last.tvd,o.last.tvd),tvdss:d(rep.last.tvdss,o.last.tvdss),dls:d(rep.last.dls,o.last.dls)};
 if(rep.proj&&o.proj)r.proj={tvd:d(rep.proj.tvd,o.proj.tvd),tvdss:d(rep.proj.tvdss,o.proj.tvdss),tvdMC:d(rep.proj.tvd,o.proj.tvdMC)};return r}
export async function loadReference(){const F=await (await fetch(REF_URL+'?v=52')).json();const st=F.stations.map((r,i)=>({md:r[0]/FT,inc:r[1],azi:r[2],...(i==0?{tvd_rep:(r[3]+F.elevation_m)/FT}:{})}));
 GEO.appendStations(st,{src:'SIM-TEST reference (WestSide report, transcribed)',name:'DR101L WB01B02 · '+F.stations.length+' stations · NOT LIVE',live:false,simTest:true});
 const G=GX.geo8,CF=G.CF;CF.kb=F.elevation_m;CF.thick=F.seam.roof_floor_gap_m;CF.dip=+(F.seam.dip_deg-90).toFixed(2);
 const calc=GEO.calc,l=calc.at(-1),cu=G.curtain(calc);CF.hd0=+cu.at(-1).hd.toFixed(1);CF.roof=+(F.last.tvd-F.seam.roof_floor_gap_m/2).toFixed(2);// user-defined target: bit mid-seam at last survey (report: "slow climb into mid seam")
 S.md=F.proj.md/FT;S.inc=F.proj.inc;S.azi=F.proj.azi;window.REF52=F;try{G.render();G.build3D()}catch(e){console.warn(e)}return F}
function panel(){if($('r52'))return;const p=document.createElement('div');p.id='r52';p.style.cssText='display:none;margin:6px 0;padding:6px;background:#22201a;border:1px solid #654;border-radius:4px';
 p.innerHTML=`<b>Compare to report</b> <span style="opacity:.7">(paste the report's "Last survey" and "Projection" rows: MD, Inc, Azi, [Mag azi], TVD, TVDSS, [DLS])</span><br>
 <textarea id=r52t rows=3 style="width:100%;font:11px monospace" placeholder="Last survey 2,851.05 92.34 171.74 171.74 250.52 109.41 1.08&#10;Projection 2,879.09 91.75 171.74 171.74 249.38 108.27 0.00"></textarea>
 <label>RT elevation m (TVD − TVDSS, blank = from pasted row) <input id=r52e type=number step=any style="width:70px"></label> <button id=r52go>Compare</button> <button id=r52ref>Load SIM-TEST reference (WestSide report)</button><div id=r52o style="margin-top:4px"></div>`;
 const at=$('g8kal');at.parentNode.insertBefore(p,at);const b=document.createElement('button');b.id='r52btn';b.textContent='📋 Compare to report';$('g8load').parentNode.insertBefore(b,$('g8load'));
 b.onclick=()=>{p.style.display=p.style.display=='none'?'block':'none'};$('r52go').onclick=compare;
 $('r52ref').onclick=async()=>{const F=await loadReference();$('r52t').value=`Last survey ${F.last.md} ${F.last.inc} ${F.last.azi} ${F.last.azi} ${F.last.tvd} ${F.last.tvdss} ${F.last.dls}\nProjection ${F.proj.md} ${F.proj.inc} ${F.proj.azi} ${F.proj.azi} ${F.proj.tvd} ${F.proj.tvdss} 0.00`;compare()}}
export function compare(){const rep=parseReport($('r52t').value);const o=$('r52o');if(!rep.last&&!rep.proj){o.innerHTML='<span style=color:#fb4>Could not read a row (need at least MD Inc Azi TVD TVDSS)</span>';return null}
 const ev=$('r52e').value;const r0=rep.last||rep.proj;const elev=ev!==''?+ev:(r0.tvd-r0.tvdss);const calc=GEO.calc;const src=GEO.surv?.src||'?';
 if(!calc||calc.length<2){o.innerHTML='<span style=color:#fb4>No survey loaded in the app — nothing to compare (this is the "trajectory assumed vertical" case)</span>';return null}
 const our=ours(calc,rep,elev),d=deltas(rep,our);const f=(v,n=2)=>v==null||!isFinite(v)?'–':(v>=0?'+':'')+v.toFixed(n);const ok=(v,t)=>v==null?'':Math.abs(v)<=t?'<span style=color:#7f7>✓</span>':'<span style=color:#fb4>✗</span>';
 const v=(x,n=2)=>x==null||!isFinite(x)?'–':x.toFixed(n);let h=`<div>Ours = ${es(src)}${GEO.surv?.live?' (LIVE)':' (<b>not live</b>)'} · minimum curvature · elevation ${elev.toFixed(2)} m · tolerances: TVD ±0.10 m, DLS ±0.15°/10 m, inc/azi ±0.05°</div><table style="border-collapse:collapse;font-size:11px;text-align:right"><tr><th></th><th>MD</th><th>Inc</th><th>Azi</th><th>TVD</th><th>TVDSS</th><th>DLS°/10m</th></tr>`;
 if(rep.last){const a=rep.last,b=our.last,x=d.last;h+=`<tr><td>Report last survey</td><td>${a.md}</td><td>${a.inc}</td><td>${a.azi}</td><td>${a.tvd}</td><td>${a.tvdss}</td><td>${a.dls??'–'}</td></tr><tr><td>Ours${b.station?'':' (interpolated)'}</td><td>${a.md}</td><td>${v(b.inc)}</td><td>${v(b.azi)}</td><td>${v(b.tvd)}</td><td>${v(b.tvdss)}</td><td>${v(b.dls)}</td></tr><tr><td>Δ ours − report</td><td></td><td>${f(x.inc)}${ok(x.inc,.05)}</td><td>${f(x.azi)}${ok(x.azi,.05)}</td><td>${f(x.tvd)}${ok(x.tvd,.1)}</td><td>${f(x.tvdss)}${ok(x.tvdss,.1)}</td><td>${f(x.dls)}${ok(x.dls,.15)}</td></tr>`}
 if(rep.proj){const a=rep.proj,b=our.proj,x=d.proj;h+=`<tr><td>Report projection</td><td>${a.md}</td><td>${a.inc}</td><td>${a.azi}</td><td>${a.tvd}</td><td>${a.tvdss}</td><td></td></tr><tr><td>Ours (straight at last-survey inc)</td><td>${a.md}</td><td></td><td></td><td>${v(b.tvd)}</td><td>${v(b.tvdss)}</td><td></td></tr><tr><td>Δ ours − report</td><td></td><td></td><td></td><td>${f(x.tvd)}${ok(x.tvd,.1)}</td><td>${f(x.tvdss)}${ok(x.tvdss,.1)}</td><td></td></tr><tr style="opacity:.75"><td>alt: min-curv to proj. inc</td><td></td><td></td><td></td><td>${v(b.tvdMC)} (${f(x.tvdMC)})</td><td></td><td></td></tr>`}
 o.innerHTML=h+'</table>';window.CMP52={rep,our,d,elev};return window.CMP52}
export function init(ctx){C=ctx;S=C.S;const t=setInterval(()=>{if($('g8kal')&&window.GEO&&GX.geo8){clearInterval(t);panel()}},300);GX.ref52={loadReference,compare,parseReport,ours,deltas}}
