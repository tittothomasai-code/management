// wo4 (helper F): squeeze cementing and jar impact tabs for the wo2 panel. Engineering in woeng4.js. SIM.
import * as E4 from './woeng4.js';
export const DEF={sqTop:2380,sqBase:2395,sqRet:2365,sqP:6,sqQ:0.16,sqFG:1.70,sqStage:0.16,sqThick:4,jOP:200,jAcc:1,jDC:90,jStuck:2300};
export function sqz(V,{inp,f,okc,$,chart}){const s={...E4.SQZ,perfTop:+V.sqTop,perfBase:+V.sqBase,retainer:+V.sqRet,injP_MPa:+V.sqP,injQ_m3min:+V.sqQ,fg_sg:+V.sqFG,stageM3:+V.sqStage,thickH:+V.sqThick},J=E4.sqzJob(s),H=J.H;
 return {html:`<div class=g><div class=c><b>Squeeze cement job</b> <span class=sim>SIM</span><br>${inp('sqTop','Perf top m',5)}${inp('sqBase','Perf base m',5)}${inp('sqRet','Retainer m',5)}${inp('sqP','Inj. press. MPa',0.5)}${inp('sqQ','Rate m³/min',0.02)}${inp('sqFG','Frac grad. SG',0.05)}${inp('sqStage','Stage m³',0.04)}${inp('sqThick','Thickening h',0.5)}
 <table><tr><td>Injectivity</td><td>${f(J.T.II,3)} m³/min/MPa</td></tr><tr><td>Bottom-hole inj. pressure</td><td>${f(J.T.bhp,1)} MPa (frac ${f(J.T.pf,1)} MPa) ${okc(J.T.belowFrac)}</td></tr>
 <tr><td>Max surface squeeze pressure</td><td>${f(J.T.maxSurf,1)} MPa</td></tr><tr><td>Cement (incl. 20 % excess)</td><td>${f(J.V.Vc,2)} m³</td></tr><tr><td>Displacement pumped</td><td>${f(J.V.dispPump,2)} m³ (0.16 m³ left in tubing)</td></tr>
 <tr><td>Stages to final pressure</td><td>${H.stages.length} · ${H.final?.final?'<b class=ok>squeeze reached</b>':'<b class=bad>not reached</b>'}</td></tr><tr><td>Job time</td><td>${f(H.totalH,1)} h ${okc(H.thickOK)}</td></tr>
 <tr><td>Result</td><td id=wo4Sq>${J.ok?'<b class=ok>PASS</b>':'<b class=bad>FAIL</b> '+J.fails.join('. ')}</td></tr></table>
 <ol style="margin:6px 0 0 18px;padding:0;font-size:13px">${J.steps.map(t=>`<li>${t}</li>`).join('')}</ol></div>
 <div class=c><b>Hesitation squeeze chart</b> <span class=sim>SIM</span><canvas id=wo4Hc width=1120 height=560></canvas></div></div>`,
 draw:()=>{const P=[[0,0]],Hd=[];for(const q of H.stages){P.push([q.t-s.holdMin,q.pump]);P.push([q.t,q.hold]);}
  chart($('#wo4Hc'),[{n:'surface',c:'#4cf',p:P}],{xl:'time min →',yl:'surface pressure MPa',xmax:Math.max(30,H.final?.t||30),ymin:0,ymax:H.pFinal*1.25,lines:[{y:H.pFinal,c:'#f84',t:'Final squeeze pressure'}]})}}}
export function jar(V,{inp,f,okc,$,chart}){const j={...E4.JAR,dcLen:+V.jDC,stuckAt:+V.jStuck},B=E4.jarBlow(+V.jOP,!!+V.jAcc,j),Wn=E4.jarWindow(+V.jOP,j),C=E4.jarCurve(j);
 return {html:`<div class=g><div class=c><b>Jar blow</b> <span class=sim>SIM</span><br>${inp('jOP','Overpull kN',25)}${inp('jDC','Collars above jar m',10)}${inp('jStuck','Stuck at m',50)}<label>Accelerator <select data-k=jAcc><option value=1 ${+V.jAcc?'selected':''}>Yes</option><option value=0 ${+V.jAcc?'':'selected'}>No</option></select></label>
 <table><tr><td>Hammer speed</td><td>${f(B.v,2)} m/s</td></tr><tr><td>Peak impact at fish</td><td id=wo4F><b>${f(B.F_kN,0)} kN</b> (${f(B.ratio,1)} × overpull)</td></tr><tr><td>Impulse</td><td>${f(B.I_kNs,1)} kN·s over ${f(B.dur_ms,0)} ms</td></tr>
 <tr><td>Collar mass</td><td>${f(B.mass_t,1)} t</td></tr><tr><td>Stored energy</td><td>${f(B.energy_kJ,0)} kJ</td></tr></table></div>
 <div class=c><b>Jar window</b> <span class=sim>SIM</span><table><tr><td>Jar depth</td><td>${f(Wn.jarAt,0)} m ${okc(Wn.okPos)}</td></tr><tr><td>Hook load to fire</td><td>${f(Wn.hook,0)} kN (limit 80 % yield ${f(Wn.lim,0)} kN) ${okc(Wn.okYield)}</td></tr>
 <tr><td>Jar rating</td><td>${E4.JAR.jarMax_kN} kN ${okc(Wn.okJar)}</td></tr><tr><td>Max safe overpull</td><td id=wo4Max>${f(Wn.maxOP,0)} kN</td></tr></table>
 <canvas id=wo4Jc width=1120 height=520></canvas></div></div>`,
 draw:()=>chart($('#wo4Jc'),[{n:'accel.',c:'#5f5',p:C.map(q=>[q.op,q.acc])},{n:'no accel.',c:'#4cf',p:C.map(q=>[q.op,q.no])}],{xl:'overpull kN →',yl:'impact kN',xmax:E4.JAR.jarMax_kN,ymin:0,ymax:Math.max(...C.map(q=>q.acc))*1.1,lines:[{y:+V.jOP,c:'#ffd54a',t:'overpull'}]})}}
