// v4.3 Connections / joints panel. Detection is in conn.js (pure, unit-tested). Results are ESTIMATES derived from the time log.
import * as K from './conn.js?v=55';
let C,S,THREE,P,RES=null,SRC='auto',RINGS=null,timer=null,LAST=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const met=()=>!window.U||U.sys=='metric';
const LEN=m=>met()?m:m/0.3048,LU=()=>met()?'m':'ft',FRC=k=>met()?k:k/4.448222,FU=()=>met()?'kN':'klbf';
const KEY='dw-conn-opt';
let OPT=Object.assign({},K.DEFAULTS,JSON.parse(localStorage.getItem(KEY)||'{}'));
const NAMES={bd:['BDE','BITDEP','DBTB','BIT_DEPTH'],hd:['DMEA','DBTM','HOLEDEP','HDTH'],bh:['BHE','BPOS','BLKPOS','HKHT','BLOCK'],hkl:['HKL','HKLA','HOOKLOAD','HKLD'],rpm:['RPM','RPMA','TDRPM','SRPM'],flow:['FLOW','MFIA','TFLO','FLOWIN'],spp:['SPP','SPPA'],wob:['WOB','SWOB'],slips:['SLIPS','SLIPSTAT','INSLIPS','SLIP']};
const TO={bd:'m',hd:'m',bh:'m',hkl:'kN',flow:'L/min',spp:'kPa',wob:'kN'};
function fromWitsml(d){const ml=d.ml.map(m=>String(m).toUpperCase()),col={};
 for(const k in NAMES){const i=ml.findIndex(m=>NAMES[k].includes(m));if(i>=0)col[k]=i}
 const cv=(k,v)=>{v=parseFloat(v);if(!isFinite(v))return NaN;const u=d.ul?.[col[k]];return TO[k]&&u&&window.U?U.x(v,u,TO[k]):v};
 const rows=[];for(const r of d.rows){const x=r.x||r;const t=r.t!=null?(r.t>1e11?r.t/1000:r.t):Date.parse(x[d.ix])/1000;if(!isFinite(t))continue;const o={t};for(const k in col)o[k]=cv(k,x[col[k]]);rows.push(o)}
 return{rows,cols:Object.keys(col),abs:true}}
function fromCSV(c){const rows=[];let t0=0;for(const r of c.rows){const t=r.time_s??r.t;if(!isFinite(t))continue;rows.push({t,bd:r.md_ft*0.3048,hd:r.hd_ft!=null?r.hd_ft*0.3048:undefined,bh:r.quill_m,hkl:r.hookload_klbf*4.448222,rpm:r.td_rpm,flow:r.flow_gpm*3.785412,spp:r.spp_psi*6.894757,wob:r.wob_klbf*4.448222,slips:r.slips})}
 return{rows,cols:['bd','bh','hkl','rpm','flow','spp','wob'].filter(k=>rows.some(r=>isFinite(r[k]))),abs:false}}
function pick(){const w=window.GX?.witsml?.data?.(),c=window.GX?.csvData?.();
 if(SRC=='sim'||(SRC=='auto'&&LAST=='sim'))return{name:'SIM-TEST synthetic time log',tag:'SIM-TEST',...simData()};
 if((SRC=='auto'||SRC=='live')&&w&&w.src!='replay')return{name:(w.name||'WITSML log')+' (live history since Connect)',tag:w.src=='live-sim'?'SIMULATED':'LIVE',...fromWitsml(w)};
 if((SRC=='auto'||SRC=='replay')&&w&&w.src=='replay')return{name:(w.name||'log')+' (replay)',tag:'REPLAY',...fromWitsml(w)};
 if((SRC=='auto'||SRC=='csv')&&c&&c.rows?.length)return{name:c.name||'CSV',tag:'CSV',...fromCSV(c)};
 return null}
let SIM=null;function simData(){if(!SIM){const s=K.synth({joints:8,len:9.4,pumpBlip_at:3,pumpBlip_s:30});SIM={rows:s.rows,truth:s.truth,cols:['bd','hd','bh','hkl','rpm','flow','spp','wob'],abs:false}}return SIM}
const fmtT=(t,abs)=>{if(abs){return new Date(t*1000).toLocaleTimeString('en-AU',{hour12:false})}const s=Math.max(0,Math.round(t)),h=s/3600|0,m=(s%3600)/60|0;return'+'+h+':'+String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const dur=s=>{s=Math.round(s);return(s/60|0)+':'+String(s%60).padStart(2,'0')};
function run(){const d=pick();if(!d){RES=null;render('No time-log data yet. Connect WITSML (history builds while connected), load a CSV in the Data panel, or press “SIM-TEST data”.');return}
 RES=K.detect(d.rows,{...OPT,slips:window.GX?.bit?.slipsOpt?.()||{}});RES.src=d;render();rings()}
function render(msg){if(P.style.display=='none')return;const r=RES,d=r?.src,abs=d?.abs;
 const inp=(k,lab,v,u,f)=>`<label style="display:flex;flex-direction:column;flex:1 1 110px;font-size:12px;color:#9ab">${lab} (${u})<input data-o="${k}" data-f="${f||''}" inputmode="decimal" value="${v}" style="font-size:16px;min-height:40px;background:#0b1218;color:#def;border:1px solid #456;border-radius:6px;padding:4px"></label>`;
 const BB=(id,t,c='#2a4a6a')=>`<button id="${id}" style="${C.BTN};font-size:15px;min-height:44px;padding:6px 10px;background:${c};color:#fff;border-radius:8px">${t}</button>`;
 const k=r?.kpi;
 P.innerHTML=`<b style="color:#9cf">Connections / joints</b> <span style="background:#6b4a00;color:#fd8;padding:1px 6px;border-radius:4px;font-size:12px">Estimated from data</span> ${d?`<span style="background:${d.tag=='SIM-TEST'?'#7a1d1d':'#1b4e2a'};color:#fff;padding:1px 6px;border-radius:4px;font-size:12px">${d.tag}</span>`:''} <button id="cnx" style="${C.BTN};float:right;min-width:40px;min-height:40px">×</button>
 <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;align-items:center"><select id="cnsrc" style="font-size:16px;min-height:44px;background:#0b1218;color:#def;border:1px solid #456;border-radius:6px">${[['auto','Auto source'],['live','Live WITSML'],['replay','Replay'],['csv','CSV import'],['sim','SIM-TEST data']].map(([v,t])=>`<option value="${v}"${SRC==v?' selected':''}>${t}</option>`).join('')}</select>${BB('cnrun','Analyse','#1b5e20')}${BB('cnsim','SIM-TEST data','#7a1d1d')}${BB('cncsv','Export CSV')}</div>
 ${msg?`<div style="color:#fc6;font-size:14px;padding:6px">${esc(msg)}</div>`:''}
 ${r?`<div id="cnkpi" style="font-size:15px;color:#fff;background:#13202c;border-radius:6px;padding:6px">${k.connections} connections · avg ${k.connections?dur(k.avgConn_s):'–'} min slips-to-slips · avg joint ${Number.isFinite(k.avgLen_m)?LEN(k.avgLen_m).toFixed(2):'–'} ${LU()} · ${k.mode||'–'}<br><small style="color:#9ab">${esc(d.name)} · ${r.info.rows} rows · channels ${d.cols.join(', ')} · slips from ${r.info.inferred?'<b style="color:#fd8">'+esc(r.info.slipsFrom)+'</b> (~% = confidence)':esc(r.info.slipsFrom||'')}</small></div>
 <canvas id="cnchart" width="760" height="260" style="width:100%;height:auto;background:#081018;border-radius:6px;margin-top:6px"></canvas>
 <div style="overflow:auto;max-height:30vh"><table id="cntab" style="border-collapse:collapse;width:100%;font-size:14px;text-align:right"><tr style="color:#9cf"><th>#</th><th>Slips in</th><th>Depth ${LU()}</th><th>Slips-slips</th><th>Pumps off</th><th>Joint ${LU()}</th></tr>${r.connections.map(c=>`<tr style="border-top:1px solid #234"><td>${c.n}</td><td>${fmtT(c.tSlipsIn,abs)}</td><td>${LEN(c.depth_m).toFixed(1)}</td><td>${dur(c.slips_s)}${c.inferred?` <small style="color:#fd8">~${Math.round((c.confidence||0)*100)}%</small>`:''}</td><td>${Number.isFinite(c.pumpOff_s)?dur(c.pumpOff_s):'–'}</td><td>${Number.isFinite(c.length_m)?LEN(c.length_m).toFixed(2):'–'}</td></tr>`).join('')}</table></div>
 <details><summary style="font-size:14px;color:#9cf;min-height:30px">Estimated tool-joint depths (${r.toolJoints.length})</summary><div id="cnjoints" style="font:13px monospace;max-height:24vh;overflow:auto">${r.toolJoints.slice(0,200).map(j=>`J${j.joint}: ${LEN(j.depth_m).toFixed(1)} ${LU()}${j.extrapolated?' ~':''}`).join('<br>')}<br><small>Depth below rotary of each tool joint, bit depth ${LEN(r.bitDepthNow_m).toFixed(1)} ${LU()}. “~” = extrapolated at median joint length.</small></div></details>`:''}
 <details><summary style="font-size:14px;color:#9cf;min-height:30px">Detection thresholds</summary><div style="display:flex;flex-wrap:wrap;gap:6px">
 ${inp('flowOffFrac','Pumps off below',Math.round(OPT.flowOffFrac*100),'% of drilling flow','pct')}${inp('rpmOff','Rotation off below',OPT.rpmOff,'rpm')}${inp('minPumpOff_s','Min pumps-off',OPT.minPumpOff_s,'s')}${inp('minSlips_s','Min in-slips',OPT.minSlips_s,'s')}${inp('maxConn_s','Max connection',OPT.maxConn_s,'s')}${inp('blockWeight_kN','Block weight, 0=auto',+FRC(OPT.blockWeight_kN).toFixed(1),FU(),'frc')}${inp('slipsMargin_kN','Slips margin, 0=auto',+FRC(OPT.slipsMargin_kN).toFixed(1),FU(),'frc')}${inp('minBlockTravel_m','Min block travel',+LEN(OPT.minBlockTravel_m).toFixed(1),LU(),'len')}${inp('onBottomTol_m','On-bottom tolerance',+LEN(OPT.onBottomTol_m).toFixed(2),LU(),'len')}</div>${BB('cnrst','Reset thresholds')}</div></details>
 <small>Sequence: off bottom → pumps off → RPM 0 → hookload to block weight (slips) → block travels up → pumps/rotation resume → drilling resumes. Short pump-offs on bottom or without slips are ignored. Joint length = depth difference between connections; median classifies single / double / stand. Estimated, not measured.</small>`;
 $('cnx').onclick=()=>{P.style.display='none';rings()};$('cnsrc').onchange=e=>{SRC=e.target.value;if(SRC!='sim')LAST=null;run()};$('cnrun').onclick=run;$('cnsim').onclick=()=>{SRC='sim';LAST='sim';run()};
 $('cncsv').onclick=()=>{if(!RES)return;const csv='# Estimated from data ('+RES.src.tag+') '+RES.src.name+'\n'+K.toCSV(RES,t=>fmtT(t,RES.src.abs));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='connections_'+RES.src.tag+'.csv';a.click()};
 $('cnrst').onclick=()=>{OPT=Object.assign({},K.DEFAULTS);localStorage.removeItem(KEY);run()};
 P.querySelectorAll('[data-o]').forEach(e=>e.onchange=()=>{let v=parseFloat(e.value);if(!isFinite(v))return;const f=e.dataset.f;if(f=='pct')v/=100;if(f=='frc'&&!met())v*=4.448222;if(f=='len'&&!met())v*=0.3048;OPT[e.dataset.o]=v;localStorage.setItem(KEY,JSON.stringify(OPT));run()});
 if(r)chart()}
function chart(){const cv=$('cnchart');if(!cv)return;const g=cv.getContext('2d'),W=cv.width,H=cv.height,R=RES.src.rows.filter(x=>isFinite(x.bd));if(R.length<2)return;
 const t0=R[0].t,t1=R.at(-1).t,dmin=Math.min(...R.map(x=>x.bd)),dmax=Math.max(...R.map(x=>Math.max(x.bd,x.hd||0))),X=t=>40+(W-50)*(t-t0)/((t1-t0)||1),D0=8,D1=160,Y=d=>D0+(D1-D0)*(d-dmin)/((dmax-dmin)||1);
 g.fillStyle='#081018';g.fillRect(0,0,W,H);
 for(const v of (RESULT().inferred||[])){if(!v.inSlips)continue;g.fillStyle=v.kind=='trip'?'rgba(170,100,255,.25)':'rgba(255,180,70,.18)';g.fillRect(X(v.tIn),0,Math.max(2,X(v.tOut)-X(v.tIn)),12)}
 for(const c of RESULT().connections){g.fillStyle='rgba(255,140,0,.28)';g.fillRect(X(c.tSlipsIn),0,Math.max(2,X(c.tSlipsOut)-X(c.tSlipsIn)),H);g.fillStyle='#fb4';g.font='bold 14px sans-serif';g.fillText(c.n,X(c.tSlipsIn)+2,H-4)}
 const line=(f,y,col)=>{g.strokeStyle=col;g.lineWidth=1.5;g.beginPath();let s=0;for(const x of R){const v=f(x);if(!isFinite(v))continue;const yy=y(v);s++?g.lineTo(X(x.t),yy):g.moveTo(X(x.t),yy)}g.stroke()};
 line(x=>x.hd,Y,'#ddd');line(x=>x.bd,Y,'#4af');
 const lane=(k,y0,y1,col,lab)=>{const v=R.map(x=>x[k]).filter(isFinite);if(!v.length)return;const a=Math.min(...v),b=Math.max(...v);line(x=>x[k],q=>y1-(y1-y0)*(q-a)/((b-a)||1),col);g.fillStyle=col;g.font='12px sans-serif';g.fillText(lab,W-90,y0+12)};
 lane('flow',168,210,'#5d5','Flow');lane('hkl',214,256,'#f8c','Hookload');lane('bh',214,256,'#cc6','Block ht');
 g.fillStyle='#4af';g.font='12px sans-serif';g.fillText('Bit',4,14);g.fillStyle='#ddd';g.fillText('Hole',4,28);g.fillStyle='#9ab';g.fillText(LEN(dmin).toFixed(0)+LU(),4,D0+40);g.fillText(LEN(dmax).toFixed(0)+LU(),4,D1)}
const RESULT=()=>RES;
function rings(){if(RINGS){C.UG.remove(RINGS);RINGS.traverse(o=>{o.geometry?.dispose?.()});RINGS=null}
 if(!RES||P.style.display=='none'||!RES.toolJoints.length)return;const well=C.getWell?.();if(!well||!S.md)return;
 const bdF=C.PH.bitDepth(S),bitNow=RES.bitDepthNow_m;RINGS=new THREE.Group();RINGS.name='toolJoints';const mat=new THREE.MeshBasicMaterial({color:0xffaa22});
 // place joints by distance above the bit so the pattern lines up with the 3D string even when data depth ≠ sim depth
 for(const j of RES.toolJoints.slice(0,400)){const aboveBit=(bitNow-j.depth_m)/0.3048,dF=bdF-aboveBit;if(dF<=0||dF>bdF)continue;const p=well.getPointAt(Math.min(1,dF/S.md));const m=new THREE.Mesh(new THREE.TorusGeometry(0.26,0.08,6,14),mat);m.position.copy(p);const tg=well.getTangentAt(Math.min(1,dF/S.md));m.lookAt(p.clone().add(tg));RINGS.add(m)}
 C.UG.add(RINGS)}
export function init(ctx){C=ctx;S=C.S;THREE=C.THREE;
 P=document.createElement('div');P.id='connp';P.style.cssText=C.PANEL+';left:10px;top:150px;width:680px;max-height:60vh;overflow:auto;display:none;border-color:#69c';document.body.appendChild(P);
 const anchor=$('btnLay')||$('under');const b=document.createElement('button');b.id='btnConn';b.textContent='Connections';b.className=anchor?.className||'';anchor?.after(b);
 b.onclick=()=>{P.style.display=P.style.display=='none'?'':'none';if(P.style.display!='none')run();else rings()};
 window.U?.on?.(()=>render());
 timer=setInterval(()=>{if(P.style.display!='none'&&RES&&(RES.src.tag=='LIVE'||RES.src.tag=='SIMULATED'))run()},15000);
 window.GX=window.GX||{};GX.conn={fromWitsml,synth:K.synth,detect:K.detect,run,result:()=>RES,setSource:s=>{SRC=s;LAST=s=='sim'?'sim':null;run()},opt:()=>OPT}}
