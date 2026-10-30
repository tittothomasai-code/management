// ddmotor.js (helper DD-motor): mud motor management panel for DD Training. Own module.
// Hook: window.GX.ddcab.motor = {C, open, close, mount(el), sess}. The DD cabin can call GX.ddcab.motor.mount(container)
// to show this panel inside its Motor tab, or GX.ddcab.motor.step({flow,wob,rpm,rotating,tvd,inc,tf,hours}) to drive it.
// Standalone: ?demo=ddmotor. All values are SIM.
import * as C from './ddmotor_core.js?v=1';
const f1=v=>(+v).toFixed(1);
const S={m:{...C.MOTORS.m675},bend:1.5,flow:1800,wob:10,rpm:0,rotating:false,tf:0,tvd:2000,inc:30,wear:C.newWear(),st:null,el:null,host:null,log:[]};
function calc(){const t=C.temp(S.tvd,S.st?S.st.dP:0,S.m);S.st=C.state(S.m,{flow:S.flow,wob:S.wob,bend:S.bend,rpm:S.rpm,rotating:S.rotating,inc:S.inc,tfSet:S.tf,temp:t});S.st.temp=t;return S.st}
export function step(o={}){Object.assign(S,Object.fromEntries(Object.entries(o).filter(([k])=>['flow','wob','rpm','rotating','tvd','inc','tf','bend'].includes(k))));const st=calc();
 C.wearStep(S.m,S.wear,st,o.hours??0.5,{temp:st.temp,wob:S.wob});if(st.stall)S.log.push('STALL at WOB '+S.wob+' t. Do the recovery steps.');render();return {...st,health:C.health(S.m,S.wear)}}
const CSS=`#ddm{position:fixed;inset:auto 0 0 0;max-height:88vh;overflow:auto;z-index:9000;background:#0e1620;color:#dde6ee;font:13px system-ui;padding:10px;box-sizing:border-box;border-top:2px solid #3a6}
#ddm.inl{position:static;max-height:none;border:0;padding:0}#ddm h3{margin:6px 0;font-size:14px}#ddm .sim{background:#c80;color:#000;border-radius:3px;padding:0 4px;font-size:11px;margin-left:4px}
#ddm .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:4px}#ddm .g div{background:#16222e;padding:4px;border-radius:4px}#ddm b{font-size:15px}
#ddm .warn{color:#fc3}#ddm .bad{color:#f55}#ddm table{border-collapse:collapse;width:100%}#ddm td{border-bottom:1px solid #234;padding:2px 4px}
#ddm label{display:flex;gap:6px;align-items:center;margin:3px 0}#ddm input[type=range]{flex:1;min-width:0}#ddm button,#ddm select{background:#234;color:#fff;border:1px solid #456;border-radius:4px;padding:6px 8px;min-height:36px}
#ddm canvas{width:100%;height:150px;background:#0a1118;border-radius:4px}#ddm .bar{height:10px;background:#234;border-radius:5px;overflow:hidden}#ddm .bar i{display:block;height:100%;background:#3a6}
#ddm .x{float:right}@media(min-width:900px){#ddm:not(.inl){left:auto;width:460px;top:60px;max-height:none;border-left:2px solid #3a6}}`;
function html(){const st=S.st||calc(),m=S.m,h=C.health(m,S.wear),g=(n,v,u,c='')=>`<div><small>${n}</small><br><b class="${c}">${v}</b> <small>${u}</small></div>`;
 return `${S.host?'':'<button class="x" id="ddmX">Close</button>'}<h3>Mud motor management <span class="sim">SIM</span></h3>
 <label>Motor <select id="ddmM">${Object.values(C.MOTORS).map(x=>`<option value="${x.id}"${x.id==m.id?' selected':''}>${x.name}</option>`).join('')}</select></label>
 <table id="ddmSpec"><tr><td>Lobes / stages</td><td>${m.lobes} / ${m.stages}</td></tr><tr><td>Rev per gal (per L)</td><td>${m.rev_gal} (${C.revPerL(m).toFixed(4)})</td></tr>
 <tr><td>Flow range</td><td>${m.flow[0]}–${m.flow[1]} L/min</td></tr><tr><td>Max diff P / stall P</td><td>${m.dPmax} / ${st.dPstall} bar</td></tr><tr><td>Torque per bar</td><td>${m.tqPerBar} kN·m</td></tr>
 <tr><td>Bit-to-bend / bend-to-stab</td><td>${m.L1} / ${m.L2} m</td></tr><tr><td>Stator rating</td><td>${m.maxTemp} °C, ${m.statorLife} h</td></tr></table>
 <label>Bend <select id="ddmB">${C.BENDS.map(b=>`<option${b==S.bend?' selected':''}>${b}</option>`).join('')}</select> ° · yield <b id="ddmY">${st.yield}</b> °/30m · rotate limit <b>${st.rotLimit}</b> RPM</label>
 <label>Flow <input type="range" id="ddmQ" min="0" max="3600" step="50" value="${S.flow}"> <span>${S.flow} L/min</span></label>
 <label>WOB <input type="range" id="ddmW" min="0" max="40" step="1" value="${S.wob}"> <span>${S.wob} t</span></label>
 <label>Toolface set <input type="range" id="ddmT" min="0" max="355" step="5" value="${S.tf}"> <span>${S.tf}° ${st.tfMode}</span></label>
 <label><select id="ddmR"><option value="0"${S.rotating?'':' selected'}>Slide</option><option value="1"${S.rotating?' selected':''}>Rotate</option></select> Surface RPM <input type="range" id="ddmS" min="0" max="120" step="5" value="${S.rpm}"> <span>${S.rpm}</span></label>
 <div class="g" id="ddmG">${g('Diff P',f1(st.dP),'bar',st.stall?'bad':st.dP>0.8*m.dPmax?'warn':'')}${g('SPP',f1(st.spp),'bar',st.stall?'bad':'')}${g('Motor RPM',st.motorRpm,'')}${g('No-load RPM',st.noLoadRpm,'')}
 ${g('Bit RPM',st.bitRpm,'')}${g('Motor torque',f1(st.torque),'kN·m')}${g('Actual TF',f1(st.tfAct),'° '+st.tfMode)}${g('Reactive TF',f1(st.tfShift),'°')}${g('Temp',f1(st.temp),'°C',st.temp>m.maxTemp?'bad':'')}</div>
 <div id="ddmWarn" class="${st.warn.length?'bad':''}">${st.warn.length?'⚠ '+st.warn.join(' · '):'Motor in limits.'}</div>
 ${st.stall?`<ol id="ddmStall" class="warn">${C.STALL_STEPS.map(x=>`<li>${x}</li>`).join('')}</ol>`:''}
 <h3>Diff pressure vs WOB <span class="sim">SIM</span></h3><canvas id="ddmC" width="440" height="150"></canvas>
 <h3>Motor wear <span class="sim">SIM</span></h3><div>Hours ${f1(S.wear.hours)} h · stalls ${S.wear.stalls}</div>
 <div>Stator ${h.stator} %</div><div class="bar"><i style="width:${h.stator}%;background:${h.stator<30?'#f55':'#3a6'}"></i></div><div>Bearings ${h.bearing} %</div><div class="bar"><i style="width:${h.bearing}%"></i></div>
 <div id="ddmH" class="${h.pull?'bad':h.warn?'warn':''}">${h.pull?'Pull the motor out of the hole. Change it.':h.warn?'Caution: motor wear is high. Plan a trip.':'Motor condition is good.'}</div>
 <button id="ddmRun">Drill 0.5 h</button> <button id="ddmPU">Pick up off bottom</button> <button id="ddmNew">New motor</button>`}
function draw(){const c=S.el?.querySelector('#ddmC');if(!c)return;const x=c.getContext('2d'),W=c.width,H=c.height,m=S.m,mx=m.dPmax*m.stallF*1.1;x.clearRect(0,0,W,H);
 const px=w=>20+w/40*(W-30),py=d=>H-15-d/mx*(H-25);x.strokeStyle='#fc3';x.beginPath();x.moveTo(px(0),py(m.dPmax*0.8));x.lineTo(px(40),py(m.dPmax*0.8));x.stroke();x.strokeStyle='#f55';x.beginPath();x.moveTo(px(0),py(m.dPmax*m.stallF));x.lineTo(px(40),py(m.dPmax*m.stallF));x.stroke();
 x.strokeStyle='#5cf';x.beginPath();for(let w=0;w<=40;w++){const d=Math.min(C.dPfromWob(m,w).dP,m.dPmax*m.stallF);w?x.lineTo(px(w),py(d)):x.moveTo(px(w),py(d))}x.stroke();
 x.fillStyle='#fff';x.beginPath();x.arc(px(S.wob),py(S.st.dP),4,0,7);x.fill();x.fillStyle='#9ab';x.font='10px sans-serif';x.fillText('WOB t →',W-50,H-3);x.fillText('dP bar',2,10);x.fillText('80 % max',px(30),py(m.dPmax*0.8)-2);x.fillText('stall',px(34),py(m.dPmax*m.stallF)-2)}
function render(){if(!S.el)return;calc();S.el.innerHTML=html();const $=i=>S.el.querySelector('#'+i);
 const on=(i,k,f=Number)=>$(i).oninput=e=>{S[k]=f(e.target.value);render()};on('ddmQ','flow');on('ddmW','wob');on('ddmT','tf');on('ddmS','rpm');
 $('ddmR').onchange=e=>{S.rotating=e.target.value=='1';render()};$('ddmB').onchange=e=>{S.bend=+e.target.value;render()};$('ddmM').onchange=e=>{S.m={...C.MOTORS[e.target.value]};S.flow=Math.round((S.m.flow[0]+S.m.flow[1])/2/50)*50;S.wear=C.newWear();render()};
 $('ddmRun').onclick=()=>step({hours:0.5});$('ddmPU').onclick=()=>{S.wob=0;render()};$('ddmNew').onclick=()=>{S.wear=C.newWear();render()};if($('ddmX'))$('ddmX').onclick=close;draw()}
function style(){if(!document.getElementById('ddmCss')){const s=document.createElement('style');s.id='ddmCss';s.textContent=CSS;document.head.appendChild(s)}}
export function mount(host){style();close();S.host=host;S.el=document.createElement('div');S.el.id='ddm';S.el.className='inl';host.appendChild(S.el);render();return S.el}
export function open(){style();close();S.host=null;S.el=document.createElement('div');S.el.id='ddm';document.body.appendChild(S.el);render();return S.el}
export function close(){S.el?.remove();S.el=null;S.host=null}
export function init(){}
const API={C,open,close,mount,step,sess:S,get state(){return calc()},get health(){return C.health(S.m,S.wear)}};
if(typeof window!='undefined'){window.GX=window.GX||{};window.GX.ddcab=window.GX.ddcab||{};window.GX.ddcab.motor=API;window.DDMOTOR=API;
 const q=new URLSearchParams(location.search);if(q.get('demo')=='ddmotor'){const go=()=>document.body?open():setTimeout(go,50);go()}}
