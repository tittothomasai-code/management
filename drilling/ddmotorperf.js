// ddmotorperf.js (helper DD-motor): real-time motor performance pop-up for the driller's view, next to the DD cabin.
// Reuses ddmotor.js (GX.ddcab.motor) model; updates on every step()/render via onStep. Open ?demo=ddmotorperf or GX.ddcab.motorPerf.open().
// Flow regime: reads fluids.js hydraulics() annulus segments (read only). All values SIM.
import * as M from './ddmotor.js?v=b11';import * as F from './fluids.js';
const C=M.C,f1=v=>(+v).toFixed(1);let el=null,off=null,mud='wbm';
export const powerKW=(tqkNm,rpm)=>+(tqkNm*rpm*2*Math.PI/60).toFixed(1);
export const stallMargin=st=>+Math.max(0,(st.dPstall-st.dP)/st.dPstall*100).toFixed(0);
export function flowBand(m,q){const [a,b]=m.flow;return {pct:+((q-a)/(b-a)*100).toFixed(0),zone:q<a?'BELOW RANGE':q>b?'ABOVE RANGE':'IN RANGE'}}
export function annRegime(q,mudId='wbm'){try{const H=F.hydraulics(F.MUDS[mudId],F.defWell(),q/60000);const s=(H.annSegs||[]).map(x=>({n:x.n,reg:x.reg,Re:Math.round(x.Re)}));return {segs:s,src:'fluids.js hydraulics (API RP 13D), SIM well'}}catch(e){return {segs:[],src:'n/a'}}}
export function perf(st,S){const m=S.m;return {dP:st.dP,torque:st.torque,motorRpm:st.motorRpm,bitRpm:st.bitRpm,surfRpm:S.rotating?S.rpm:0,power:powerKW(st.torque,st.motorRpm),margin:stallMargin(st),flow:flowBand(m,S.flow),reg:annRegime(S.flow,mud),stall:st.stall,src:'SIM'}}
const CSS=`#ddmp{position:fixed;right:8px;top:70px;width:340px;max-width:calc(100vw - 16px);max-height:calc(100vh - 140px);overflow:auto;z-index:2147483001;background:#0e1620ee;color:#dde6ee;font:12px system-ui;padding:8px;border:1px solid #3a6;border-radius:8px;box-sizing:border-box}
#ddmp h3{margin:4px 0;font-size:13px}#ddmp .sim{background:#c80;color:#000;border-radius:3px;padding:0 4px;font-size:10px;margin-left:4px}#ddmp .g{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}#ddmp .g div{background:#16222e;padding:3px;border-radius:4px}
#ddmp b{font-size:14px}#ddmp .bad{color:#f55}#ddmp .warn{color:#fc3}#ddmp canvas{width:100%;height:150px;background:#0a1118;border-radius:4px}#ddmp .x{float:right;background:#234;color:#fff;border:1px solid #456;border-radius:4px;min-height:32px}
#ddmp .fb{position:relative;height:12px;background:#234;border-radius:6px;margin:3px 0}#ddmp .fb i{position:absolute;left:25%;width:50%;height:100%;background:#2a5}#ddmp .fb u{position:absolute;top:-2px;width:3px;height:16px;background:#fff}
body.mob #ddmp.msheet,body.mob #ddmp{z-index:2147483001!important}@media(max-width:700px){#ddmp{left:8px;right:8px;width:auto;top:auto;bottom:70px;max-height:45vh}}`;
function html(p,S,st){const g=(n,v,u,c='')=>`<div><small>${n}</small><br><b class="${c}">${v}</b> <small>${u}</small></div>`,m=S.m;
 const x=Math.max(0,Math.min(100,25+p.flow.pct/2));
 return `<button class="x" id="ddmpX">Close</button><h3>Motor performance <span class="sim">SIM</span></h3>
 <canvas id="ddmpC" width="320" height="150"></canvas><div id="ddmpKey"><small><span style="color:#6e6">RPM vs diff P</span> (dashed: rated flow ${m.flow[0]}–${m.flow[1]} L/min) · <span style="color:#e9a">torque vs diff P</span> · <span style="color:#fc3">max recommended</span> · <span style="color:#f55">stall</span></small></div>
 <div class="g" id="ddmpOP">${g('Diff P',f1(p.dP),'bar',p.stall?'bad':'')}${g('Torque',f1(p.torque),'kN·m')}${g('Motor RPM',p.motorRpm,'')}${g('Stall margin',p.margin,'%',p.margin<20?'bad':p.margin<40?'warn':'')}${g('WOB',f1(S.wob),'t')}${g('SPP',f1(st.spp),'bar')}</div>
 <h3>Flow regime <span class="sim">SIM</span></h3><div id="ddmpFlow">${S.flow} L/min · rated ${m.flow[0]}–${m.flow[1]} · <b class="${p.flow.zone=='IN RANGE'?'':'bad'}">${p.flow.zone}</b></div>
 <div class="fb"><i></i><u style="left:${x}%"></u></div>
 <div id="ddmpReg">${p.reg.segs.length?p.reg.segs.map(s=>`${s.n}: <b>${s.reg}</b> (Re ${s.Re})`).join('<br>'):'Annular regime: not available.'}<br><small>${p.reg.src} · read only</small></div>
 <h3>Output <span class="sim">SIM</span></h3><div class="g" id="ddmpOut">${g('Bit RPM',p.bitRpm,'')}${g('= Surface',p.surfRpm,'')}${g('+ Motor',p.motorRpm,'')}${g('Motor torque',f1(p.torque),'kN·m')}${g('Power',f1(p.power),'kW')}${g('Mode',S.rotating?'Rotate':'Slide','')}</div>
 ${p.stall?'<div class="bad" id="ddmpStall">⚠ STALL. Pick up off bottom.</div>':''}`}
// motor performance curves: RPM vs diff P at min, current and max rated flow; torque vs diff P; rated max and stall lines.
export function curves(m,flow,n=30){const st=m.dPmax*m.stallF,rpm=q=>Array.from({length:n+1},(_,i)=>{const d=st*i/n;return [d,C.rpmNoLoad(m,q)*(1-0.25*(d/m.dPmax)**2)]});
 return {dPstall:st,dPmax:m.dPmax,qMin:m.flow[0],qMax:m.flow[1],rpmMin:rpm(m.flow[0]),rpmMax:rpm(m.flow[1]),rpmNow:rpm(flow),tq:[[0,0],[st,st*m.tqPerBar]]}}
export let dot=null;
function draw(S){const c=el?.querySelector('#ddmpC');if(!c)return;const x=c.getContext('2d'),W=c.width,H=c.height,m=S.m,K=curves(m,S.flow);
 const mxP=K.dPstall*1.1,mxR=Math.max(C.rpmNoLoad(m,Math.max(S.flow,m.flow[1])),1)*1.1,mxT=K.dPstall*m.tqPerBar*1.1,L=26,R=W-30,T=8,B=H-16;
 const px=d=>L+d/mxP*(R-L),pr=v=>B-v/mxR*(B-T),pt=v=>B-v/mxT*(B-T);x.clearRect(0,0,W,H);
 const poly=(a,fy,col,dash=[])=>{x.setLineDash(dash);x.strokeStyle=col;x.beginPath();a.forEach((p,k)=>k?x.lineTo(px(p[0]),fy(p[1])):x.moveTo(px(p[0]),fy(p[1])));x.stroke();x.setLineDash([])};
 x.fillStyle='#1d3a2633';x.beginPath();K.rpmMax.forEach((p,k)=>k?x.lineTo(px(p[0]),pr(p[1])):x.moveTo(px(p[0]),pr(p[1])));[...K.rpmMin].reverse().forEach(p=>x.lineTo(px(p[0]),pr(p[1])));x.fill();
 poly(K.rpmMin,pr,'#3a8',[3,3]);poly(K.rpmMax,pr,'#3a8',[3,3]);poly(K.rpmNow,pr,'#6e6');poly(K.tq,pt,'#e9a');
 const vl=(d,col,t)=>{x.strokeStyle=col;x.setLineDash([4,3]);x.beginPath();x.moveTo(px(d),T);x.lineTo(px(d),B);x.stroke();x.setLineDash([]);x.fillStyle=col;x.fillText(t,px(d)-14,T+8)};
 x.font='9px sans-serif';vl(K.dPmax,'#fc3','max');vl(K.dPstall,'#f55','stall');
 const st=last,dx=px(st.dP),dyR=pr(st.motorRpm),dyT=pt(st.torque);x.fillStyle='#6e6';x.beginPath();x.arc(dx,dyR,4.5,0,7);x.fill();x.fillStyle='#e9a';x.beginPath();x.arc(dx,dyT,4.5,0,7);x.fill();
 dot={x:+dx.toFixed(1),yRpm:+dyR.toFixed(1),yTq:+dyT.toFixed(1),dP:st.dP,rpm:st.motorRpm,tq:st.torque,flow:S.flow,wob:S.wob};c.dataset.dot=JSON.stringify(dot);
 x.fillStyle='#9ab';x.fillText('diff P bar →',R-50,H-3);x.fillStyle='#6e6';x.fillText('RPM',2,10);x.fillStyle='#e9a';x.fillText('kN·m',R+2,10);x.fillStyle='#3a8';
 x.fillText(K.qMax+' L/min',L+2,pr(K.rpmMax[0][1])+9);x.fillText(K.qMin+' L/min',L+2,pr(K.rpmMin[0][1])+9)}
let last=null;
function update(st,S){S.st=S.st||st;last=perf(st,S);if(!el)return;el.innerHTML=html(last,S,st);el.querySelector('#ddmpX').onclick=close;draw(S)}
export function open(){close();if(!document.getElementById('ddmpCss')){const s=document.createElement('style');s.id='ddmpCss';s.textContent=CSS;document.head.appendChild(s)}
 el=document.createElement('div');el.id='ddmp';document.body.appendChild(el);off=M.onStep(update);const S=M.sess;update(C.state(S.m,{flow:S.flow,wob:S.wob,bend:S.bend,rpm:S.rpm,rotating:S.rotating,tfSet:S.tf}),S);return el}
export function close(){off?.();off=null;el?.remove();el=null}
export function setMud(id){if(F.MUDS[id])mud=id}
export function init(){}
const API={open,close,perf,curves,get dot(){return dot},powerKW,stallMargin,flowBand,annRegime,setMud,get last(){return last}};
if(typeof window!='undefined'){window.GX=window.GX||{};window.GX.ddcab=window.GX.ddcab||{};window.GX.ddcab.motorPerf=API;
 if(new URLSearchParams(location.search).get('demo')=='ddmotorperf'){const go=()=>document.body?open():setTimeout(go,50);go()}}
