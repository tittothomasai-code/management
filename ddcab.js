// ddcab.js (helper DD-cabin): Directional driller training cabin. Open with ?demo=ddcab, the home page tile "DD Training", or window.DDCAB.open().
// Interior cabin view with data screens; the trainee gives steering instructions to a scripted driller. All data is SIM. Uses strat.js (formation model,
// gamma, targetFn) through its exports only. Desktop (>=1024 px): docked side panels that collapse to a strip. Phone: tabs.
import * as C from './ddcab_core.js?v=1';
const $=id=>document.getElementById(id),f1=v=>(+v).toFixed(1),f2=v=>(+v).toFixed(2);
const ST={el:null,sess:null,key:'build',tab:'screens',strat:null,M:null,col:{}};
async function strat(){if(ST.strat!==null)return ST.strat;try{ST.strat=await import('./strat.js?v=b6');ST.M=ST.strat.model()}catch(e){ST.strat=false}return ST.strat}
function css(){if($('ddcCss'))return;const s=document.createElement('style');s.id='ddcCss';s.textContent=`
#ddc{position:fixed;inset:0;z-index:100003;background:#0b1118;color:#dfe8f2;font:13px system-ui;display:flex;flex-direction:column}
#ddc .hd{display:flex;gap:8px;align-items:center;padding:6px 10px;background:#18222e;border-bottom:1px solid #2c3d50;flex-wrap:wrap}
#ddc .hd b{font-size:15px}#ddc .sim{background:#7a4b00;color:#fff;border-radius:4px;padding:1px 5px;font:700 11px system-ui}
#ddc button,#ddc select,#ddc input{background:#22303f;color:#fff;border:1px solid #567;border-radius:6px;padding:6px 9px;font:13px system-ui}
#ddc button{cursor:pointer;min-height:36px}#ddc .x{margin-left:auto}
#ddc .bd{flex:1;display:grid;grid-template-columns:1fr;overflow:auto;gap:8px;padding:8px}
#ddc .pn{background:#121b25;border:1px solid #2c3d50;border-radius:8px;padding:8px;min-width:0;position:relative}
#ddc .pn h3{margin:0 0 6px;font:600 13px system-ui;color:#9fc3e6}
#ddc table{border-collapse:collapse;width:100%;font:12px ui-monospace,monospace}#ddc td,#ddc th{padding:2px 4px;text-align:right;border-bottom:1px solid #223}
#ddc canvas{width:100%;display:block;margin:0 auto;background:#081018;border-radius:6px}
#ddc .g{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}#ddc .g div{background:#0d1620;border-radius:6px;padding:4px;text-align:center}#ddc .g small{display:block;color:#8aa}
#ddc .g b{font:600 15px ui-monospace,monospace}#ddc .warn{color:#ffb347}#ddc .bad{color:#ff6b6b}#ddc .ok{color:#7ee08a}
#ddLog{height:170px;overflow:auto;background:#081018;border-radius:6px;padding:6px;font:12px ui-monospace,monospace;white-space:pre-wrap}
#ddc .tabs{display:flex;gap:4px;padding:0 8px 0}#ddc .tabs button.on{background:#2f5a85}
#ddc .row{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0}
#ddc .side{position:relative;display:flex;flex-direction:column;gap:8px;min-width:0}#ddc .colb{position:absolute;z-index:5;top:4px;right:4px;min-height:26px;padding:2px 7px}
@media(max-width:1023px){#ddc [data-t]:not(.on){display:none}#ddc .colb{display:none}}
@media(min-width:1024px){#ddc .tabs{display:none}#ddc .bd{grid-template-columns:var(--l,340px) 1fr var(--r,380px);overflow:hidden}#ddc .side,#ddc .mid{overflow:auto}
 #ddc .side.ddCol>*:not(.colb){display:none}#ddc .side.ddCol{background:#121b25;border-radius:8px}}
`;document.head.appendChild(s)}
function lithAt(b){const S=ST.strat;if(!S||!ST.M)return {rop:1,dP:1,lith:'shale'};try{const r=S.lithAt(ST.M,b.tvd,b.E,b.N);if(!r)return {rop:1,dP:1};const q=S.response(r.lith);return {rop:q.rop,dP:q.tq,lith:r.lith}}catch(e){return {rop:1,dP:1}}}
function gammaAt(b){const S=ST.strat;try{if(S&&ST.M){const g=S.gammaAt(ST.M,b.tvd,b.E,b.N);if(g!=null)return g}}catch(e){}return 60+40*Math.sin(b.tvd/7)}
function zoneFn(){const S=ST.strat;if(!S||!S.targetFn||!ST.M)return null;try{const i=Math.max(0,Math.floor(ST.M.formations.length/2)),fn=S.targetFn(i,45,0,0,ST.M);fn(0);return x=>{const z=fn(x);return {top:z.top,base:z.base,src:'SIM'}}}catch(e){return null}}
export function scenario(key){ST.key=key;ST.sess=C.newSession(key,{zoneFn:C.SCEN[key].zone?zoneFn():null});ST.sess.lith=lithAt;ST.sess.gr=[];grPush();
 const s=ST.sess;s.log.push('Driller: Good day. I am ready. Scenario: '+s.S.name+'. '+s.S.desc,'Driller: Give me an instruction. Example: "Slide 10 m at TF 30" or "Rotate 30 m".');render();return s}
function grPush(){const s=ST.sess;s.gr.push({md:s.bit.md,g:gammaAt(s.bit)})}
export function cmd(t){const s=ST.sess;const md0=s.bit.md;const r=C.command(s,t);if(s.bit.md>md0){for(let m=md0+1;m<=s.bit.md;m+=1){s.gr.push({md:m,g:gammaAt({...s.bit,tvd:s.bit.tvd-(s.bit.md-m)*Math.cos(s.bit.inc*Math.PI/180)})})}}render();return r}
export function open(key){if(typeof document=='undefined')return;css();if(!ST.el){const d=document.createElement('section');d.id='ddc';document.body.appendChild(d);ST.el=d}ST.el.style.display='flex';
 strat().then(()=>{if(!ST.sess||key)scenario(key||ST.key);else render()});if(!ST.sess)scenario(key||ST.key);return API}
export function close(){if(ST.el)ST.el.style.display='none'}
function setTab(t){ST.tab=t;render()}
function tog(side){ST.col[side]=!ST.col[side];render()}
function shell(){const s=ST.sess,sc=C.score(s);const opt=Object.entries(C.SCEN).map(([k,v])=>`<option value="${k}"${k==ST.key?' selected':''}>${v.name}</option>`).join('');
 return `<div class="hd"><b>🧭 DD Training cabin</b><span class="sim">SIM</span><select id="ddScen">${opt}</select><span id="ddScore">Score <b>${sc.score}</b></span><button class="x" id="ddClose">Close</button></div>
 <div class="tabs">${['screens','steer','motor'].map(t=>`<button data-tab="${t}" class="${ST.tab==t?'on':''}">${{screens:'Screens',steer:'Steer',motor:'Motor'}[t]}</button>`).join('')}</div>
 <div class="bd" style="--l:${ST.col.l?'40px':'340px'};--r:${ST.col.r?'40px':'380px'}">
 <div class="side ${ST.col.l?'ddCol':''}" data-t="screens" id="ddL"><button class="colb" data-col="l">${ST.col.l?'▸':'◂'}</button>${survey()}${tc()}</div>
 <div class="mid side" data-t="screens">${gauges()}${dial()}${section()}${gamma()}</div>
 <div class="side ${ST.col.r?'ddCol':''}" id="ddR" data-t="steer"><button class="colb" data-col="r">${ST.col.r?'◂':'▸'}</button>${steerP()}${calc()}${motorP()}${scoreP(sc)}</div></div>`}
function survey(){const s=ST.sess,rows=s.surveys.slice(-12).reverse().map(v=>{const p=C.closest(s.plan,v);return `<tr><td>${f1(v.md)}</td><td>${f2(v.inc)}</td><td>${f2(v.azi)}</td><td>${f1(v.tvd)}</td><td class="${(v.dls||0)>s.S.dlsMax?'bad':''}">${f2(v.dls||0)}</td><td>${f1(p.d)}</td></tr>`}).join('');
 const pb=C.projectToBit(s);return `<div class="pn"><h3>Survey table <span class="sim">SIM</span></h3><table id="ddSurv"><tr><th>MD m</th><th>Inc°</th><th>Azi°</th><th>TVD m</th><th>DLS°/30m</th><th>To plan m</th></tr>${rows}</table>
 <div id="ddProj" class="row">Projection to bit (+${f1(pb.L)} m): Inc ${f2(pb.inc)}° · Azi ${f2(pb.azi)}° · TVD ${f1(pb.tvd)} m</div></div>`}
function tc(){const s=ST.sess;const t=s.offsets.map(o=>C.tcPoint(s.bit,o.P));return `<div class="pn"><h3>Travelling cylinder <span class="sim">SIM</span></h3><canvas id="ddTC" width="300" height="300" style="max-width:300px"></canvas><div id="ddTCt">${t.length?t.map((x,i)=>`${s.offsets[i].name}: ${f1(x.d)} m at ${x.ang.toFixed(0)}° · SF <b class="${x.sf<1.5?'bad':x.sf<2?'warn':'ok'}">${x.sf}</b>`).join('<br>'):'No offset well in this scenario.'}</div></div>`}
function gauges(){const s=ST.sess,m=s.last||C.motorState(s.motor,{flow:s.set.flow,wob:0,offBottom:true});const g=(n,v,u,c='')=>`<div><small>${n}</small><b class="${c}">${v}</b> <small>${u}</small></div>`;
 return `<div class="pn"><h3>Rig data <span class="sim">SIM</span></h3><div class="g" id="ddG">${g('Bit MD',f1(s.bit.md),'m')}${g('ROP',s.stalled?'0.0':f1(s.lastRop||0),'m/h',s.stalled?'bad':'')}${g('WOB',f1(s.set.wob),'t')}${g('Diff P',f1(m.dP),'bar',m.dP>0.8*s.motor.dPmax?'warn':'')}
 ${g('SPP',f1(m.spp),'bar',s.stalled?'bad':'')}${g('Torque',f1(m.torque),'kN·m')}${g('Flow',s.set.flow,'L/min',m.warn.includes('FLOW OUT OF RANGE')?'warn':'')}${g('Motor RPM',m.motorRpm,'')}
 ${g('Surface RPM',s.set.rpm,'')}${g('Bit RPM',m.bitRpm,'')}${g('Bit temp',f1(s.temp||C.bitTemp(s.bit.tvd,0,1)),'°C',(s.temp||0)>s.motor.maxTemp?'bad':'')}${g('Stator h',f1(s.statorH),'h',s.statorH>0.8*s.motor.statorLife?'warn':'')}</div>
 ${s.stalled?`<div id="ddStall" class="pn bad"><b>MOTOR STALL</b>: SPP spike, ROP is zero. Recovery steps:<ol>${C.STALL_STEPS.map(x=>`<li>${x}</li>`).join('')}</ol></div>`:''}</div>`}
function dial(){const s=ST.sess,inc=s.bit.inc;return `<div class="pn"><h3>Toolface (${inc<5?'magnetic, Inc < 5°':'gravity, high side'}) <span class="sim">SIM</span></h3><canvas id="ddTF" width="260" height="260" style="max-width:260px"></canvas></div>`}
function section(){return `<div class="pn"><h3>Vertical section: plan vs actual <span class="sim">SIM</span></h3><canvas id="ddVS" width="600" height="260"></canvas></div>`}
function gamma(){return `<div class="pn"><h3>MWD/LWD gamma <span class="sim">SIM</span></h3><canvas id="ddGR" width="600" height="110"></canvas></div>`}
function steerP(){const s=ST.sess;return `<div class="pn"><h3>Instructions to the driller</h3><div class="row"><input id="ddCmd" placeholder="Slide 10 m at TF 30" style="flex:1;min-width:150px"><button id="ddSend">Send</button></div>
 <div class="row"><button data-q="Take a survey">Survey</button><button data-q="Rotate 30 m">Rotate 30 m</button><button data-q="Pick up off bottom">Pick up</button><button id="ddRec">Use recommendation</button></div>
 <div id="ddLog">${s.log.slice(-40).map(x=>x.replace(/&/g,'&amp;').replace(/</g,'&lt;')).join('\n')}</div></div>`}
function calc(){const s=ST.sess,t=C.planTarget(s,30),r=C.recommend(s,t.inc,t.azi,30);ST.rec=r;return `<div class="pn" id="ddCalc"><h3>Slide / rotate calculator (next 30 m to plan)</h3>
 Plan at +30 m: Inc ${f2(t.inc)}° Azi ${f2(t.azi)}°<br>Required DLS <b>${r.need}</b>°/30m · motor yield <b>${r.yield}</b>°/30m ${r.ok?'':'<span class="bad">(above yield)</span>'}<br>
 Recommendation: <b>slide ${r.slide} m at TF ${r.tf}°, then rotate ${r.rotate} m</b> (slide ${r.ratio} %)</div>`}
function motorP(){const m=ST.sess.motor;return `<div class="pn" id="ddMotor" data-t="motor"><h3>Mud motor spec sheet <span class="sim">SIM</span></h3><table>
 <tr><td>Motor</td><td>${m.name}</td></tr><tr><td>Bend angle</td><td>${m.bend}°</td></tr><tr><td>Lobe config / stages</td><td>${m.lobes} / ${m.stages}</td></tr>
 <tr><td>Rev per gal (per L)</td><td>${m.rev_gal} (${f2(C.motorRevL(m)*10)}/10 L)</td></tr><tr><td>Max diff pressure</td><td>${m.dPmax} bar</td></tr><tr><td>Flow range</td><td>${m.flow[0]}–${m.flow[1]} L/min</td></tr>
 <tr><td>Stall torque</td><td>${m.stallTq} kN·m</td></tr><tr><td>Motor yield (3-point)</td><td>${f2(C.yieldDLS(m))}°/30m</td></tr><tr><td>Rotate-with-bend limit</td><td>bend ≤ ${m.maxRotBend}°, ≤ ${m.maxRotRpm} RPM</td></tr>
 <tr><td>Stator life / max temp</td><td>${m.statorLife} h / ${m.maxTemp} °C</td></tr></table>
 <div class="row">Bend <select id="ddBend">${[0.78,1.15,1.5,1.83,2.12].map(b=>`<option${b==m.bend?' selected':''}>${b}</option>`).join('')}</select> Motor RPM = flow × rev/L = ${ST.sess.set.flow} × ${C.motorRevL(m).toFixed(4)}</div></div>`}
function scoreP(sc){return `<div class="pn" id="ddScoreP"><h3>Score</h3>Average distance from plan ${sc.avgDev} m (max ${sc.maxDev}) · max DLS ${sc.maxDLS}°/30m ${sc.dlsOver?'<span class="bad">over limit</span>':''} · time ${sc.hours} h${sc.zone!=null?` · in zone <b>${sc.zone} %</b>`:''}${sc.minSF!=null?` · min SF ${sc.minSF}`:''}<br>Score <b>${sc.score}</b> / 100 ${sc.done?'<span class="ok">Scenario complete</span>':`· drill to ${ST.sess.S.endMd} m`}</div>`}
function render(){if(!ST.el||!ST.sess)return;const a=document.activeElement?.id,v=$('ddCmd')?.value||'';ST.el.innerHTML=shell();
 ST.el.querySelectorAll('[data-t]').forEach(e=>e.classList.toggle('on',e.dataset.t==ST.tab));if(ST.tab=='motor'){$('ddR').classList.add('on')}
 $('ddClose').onclick=close;$('ddScen').onchange=e=>scenario(e.target.value);ST.el.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
 ST.el.querySelectorAll('[data-col]').forEach(b=>b.onclick=()=>tog(b.dataset.col));ST.el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>cmd(b.dataset.q));
 $('ddSend').onclick=()=>{const t=$('ddCmd').value;if(t)cmd(t)};$('ddCmd').onkeydown=e=>{if(e.key=='Enter'){e.preventDefault();$('ddSend').click()}};if(a=='ddCmd'){$('ddCmd').focus()}
 $('ddRec').onclick=()=>{const r=ST.rec;if(r.slide>0.5)cmd(`Slide ${r.slide} m at TF ${r.tf}`);if(r.rotate>0.5)cmd(`Rotate ${r.rotate} m`);cmd('Take a survey')};
 $('ddBend').onchange=e=>{ST.sess.motor.bend=+e.target.value;render()};const lg=$('ddLog');lg.scrollTop=lg.scrollHeight;draw()}
function draw(){const s=ST.sess;
 {const c=$('ddTF'),x=c.getContext('2d'),W=c.width,cx=W/2,r=W/2-18;x.clearRect(0,0,W,W);x.strokeStyle='#567';x.lineWidth=2;x.beginPath();x.arc(cx,cx,r,0,7);x.stroke();x.fillStyle='#9ab';x.font='11px system-ui';x.textAlign='center';
  for(let a=0;a<360;a+=30){const t=(a-90)*Math.PI/180;x.fillText(a==0?(s.bit.inc<5?'N':'HS'):a,cx+(r+10)*Math.cos(t),cx+(r+10)*Math.sin(t)+4)}
  const tfs=s.log.filter(l=>/^You: Slide/.test(l)).slice(-6).map(l=>+l.match(/toolface (\d+)/)[1]);tfs.forEach((t,i)=>{const q=(t-90)*Math.PI/180,rr=r*(0.35+0.1*i);x.fillStyle=i==tfs.length-1?'#ffb347':'#3d6b9a';x.beginPath();x.arc(cx+rr*Math.cos(q),cx+rr*Math.sin(q),6,0,7);x.fill()});
  const q=((ST.rec?.tf||0)-90)*Math.PI/180;x.strokeStyle='#7ee08a';x.beginPath();x.moveTo(cx,cx);x.lineTo(cx+r*Math.cos(q),cx+r*Math.sin(q));x.stroke();x.fillStyle='#dfe8f2';x.fillText('Rec TF '+(ST.rec?.tf??0)+'°',cx,cx+r/2+20)}
 {const c=$('ddVS'),x=c.getContext('2d'),W=c.width,H=c.height;x.clearRect(0,0,W,H);const az=s.S.plan.azi*Math.PI/180,vs=p=>p.E*Math.sin(az)+p.N*Math.cos(az);
  const pts=[...s.plan,...s.surveys,s.bit],x0=Math.min(...pts.map(vs)),x1=Math.max(...pts.map(vs),x0+50),t0=Math.min(s.bit.tvd,s.surveys[0].tvd)-60,t1=Math.max(...s.plan.filter(p=>p.md<=s.S.endMd+100).map(p=>p.tvd),s.bit.tvd)+20;
  const X=v=>10+(v-x0)/(x1-x0)*(W-20),Y=t=>10+(t-t0)/(t1-t0)*(H-20);
  if(s.S.zone){x.fillStyle='rgba(126,224,138,.18)';x.beginPath();for(let v=x0;v<=x1;v+=5){const z=s.zoneFn(v);x.lineTo(X(v),Y(z.top))}for(let v=x1;v>=x0;v-=5){const z=s.zoneFn(v);x.lineTo(X(v),Y(z.base))}x.fill()}
  for(const o of s.offsets){x.strokeStyle='#ff6b6b';x.setLineDash([4,4]);x.beginPath();o.P.forEach(p=>x.lineTo(X(vs(p)),Y(p.tvd)));x.stroke();x.setLineDash([])}
  x.strokeStyle='#6aa9ff';x.lineWidth=2;x.beginPath();s.plan.forEach(p=>x.lineTo(X(vs(p)),Y(p.tvd)));x.stroke();x.strokeStyle='#ffb347';x.beginPath();[...s.surveys,s.bit].forEach(p=>x.lineTo(X(vs(p)),Y(p.tvd)));x.stroke();
  x.fillStyle='#fff';x.beginPath();x.arc(X(vs(s.bit)),Y(s.bit.tvd),4,0,7);x.fill();x.fillStyle='#9ab';x.font='11px system-ui';x.fillText('Plan (blue) · Actual (orange)'+(s.S.zone?' · target zone (green)':'')+(s.offsets.length?' · offset (red)':''),12,H-6)}
 {const c=$('ddGR'),x=c.getContext('2d'),W=c.width,H=c.height;x.clearRect(0,0,W,H);const g=s.gr.slice(-300);if(g.length>1){const m0=g[0].md,m1=g.at(-1).md||m0+1;x.strokeStyle='#7ee08a';x.beginPath();g.forEach(p=>x.lineTo(5+(p.md-m0)/Math.max(1,m1-m0)*(W-10),H-5-Math.min(150,p.g)/150*(H-10)));x.stroke()}
  x.fillStyle='#9ab';x.font='11px system-ui';x.fillText('Gamma 0–150 gAPI vs MD'+(ST.strat?' (strat model)':''),8,12)}
 {const c=$('ddTC'),x=c.getContext('2d'),W=c.width,cx=W/2,r=W/2-16;x.clearRect(0,0,W,W);x.strokeStyle='#345';for(const k of [1,2,3]){x.beginPath();x.arc(cx,cx,r*k/3,0,7);x.stroke()}x.fillStyle='#9ab';x.font='10px system-ui';x.textAlign='center';x.fillText(s.bit.inc<5?'N':'HS',cx,10);x.fillText('100 m',cx+r-12,cx-4);
  for(const o of s.offsets){x.fillStyle='#ff6b6b';const hist=[...s.surveys,s.bit].map(p=>C.tcPoint(p,o.P));hist.forEach((t,i)=>{const d=Math.min(100,t.d)/100*r,q=(t.ang-90)*Math.PI/180;x.globalAlpha=i==hist.length-1?1:.35;x.beginPath();x.arc(cx+d*Math.cos(q),cx+d*Math.sin(q),i==hist.length-1?6:3,0,7);x.fill()});x.globalAlpha=1}}}
export function init(){if(typeof document=='undefined')return;const add=(n=0)=>{const a=document.getElementById('uig_seq')||document.getElementById('btnLay');if(!a){if(n<40)setTimeout(()=>add(n+1),500);return}if($('btnDDC'))return;const b=document.createElement('button');b.id='btnDDC';b.textContent='DD Training';if(a.id=='btnLay'){b.className=a.className;a.after(b)}else a.appendChild(b);b.onclick=()=>ST.el&&ST.el.style.display!='none'?close():open()};add()}
const API={open,close,cmd,scenario,init,get sess(){return ST.sess},get state(){return ST},core:C};
if(typeof window!='undefined'){window.DDCAB=API;window.DDCAB_open=open;const q=new URLSearchParams(location.search);if(q.get('demo')=='ddcab'||q.has('ddcab')){const go=()=>document.body?open(q.get('scen')||undefined):setTimeout(go,50);go()}}
export default API;
