// choke.js (helper B, choke-test): choke manifold schematic + pressure test sequence per API Std 53 (5th ed.). SIM only. Open with ?demo=choke or window.CHOKESIM.open().
// Uses bop.js API (STACK, CRIT, highTarget, pressureTest, evaluate). No change to bop.js or the bop cutaway.
import * as B from './bop.js';
export const PSI=B.PSI,MPa=p=>p*0.00689476;
// manifold parts (SIM 10k upstream / 5k downstream). Gauges: G1 choke line (upstream), G2 after chokes (downstream).
export const PARTS=[
 {id:'hcr',name:'HCR valve (choke line)',kind:'valve',side:'up',x:60,y:150},
 {id:'cm1',name:'CM valve 1 (choke line inlet)',kind:'manifold',side:'up',x:150,y:150},
 {id:'cm2',name:'CM valve 2 (upstream, choke A)',kind:'manifold',side:'up',x:250,y:70},
 {id:'cm3',name:'CM valve 3 (upstream, choke B)',kind:'manifold',side:'up',x:250,y:230},
 {id:'cm4',name:'CM valve 4 (bypass line)',kind:'manifold',side:'up',x:250,y:150},
 {id:'chA',name:'Hydraulic adjustable choke A',kind:'choke',side:'mid',x:350,y:70},
 {id:'chB',name:'Manual adjustable choke B',kind:'choke',side:'mid',x:350,y:230},
 {id:'cm5',name:'CM valve 5 (downstream, gas buster)',kind:'manifold',side:'down',x:470,y:110},
 {id:'cm6',name:'CM valve 6 (downstream, flare line)',kind:'manifold',side:'down',x:470,y:190}];
export const GAUGES=[{id:'G1',name:'Choke line gauge (upstream)',x:200,y:150},{id:'G2',name:'Gauge after chokes (downstream)',x:420,y:150}];
const S=B.STACK;
export function partHigh(p,initial=false){if(p.kind=='valve')return B.highTarget({kind:'valve'},initial);return B.highTarget({kind:'manifold',side:p.side=='down'?'down':'up'},initial)}
// test sequence: each valve is tested from the upstream side with its downstream side open to a bleed point (direction of flow from the well).
// Adjustable chokes are not full-closing barriers: function test only (API 53: not needed to pressure test unless used as a positive seal).
export function sequence(initial=false){let n=0;const st=[];for(const p of PARTS){if(p.kind=='choke'){st.push({n:++n,id:p.id,name:p.name,kind:'function',note:'Function test only: open, close, check stroke and position read-out'});continue}
 const g=p.side=='down'?'G2':'G1';st.push({n:++n,id:p.id,name:p.name,kind:'pressure',gauge:g,low:300,high:partHigh(p,initial),close:[p.id],open:PARTS.filter(q=>q!==p&&q.kind!='choke').map(q=>q.id)})}return st}
// run one step: low then high, with optional SIM leak (psi/min) per valve. Returns record row.
export function runStep(s,leak={},seed=1){if(s.kind=='function')return {...s,pass:leak[s.id]?false:true,why:leak[s.id]?['choke does not stroke fully']:[],low:null,high:null};
 const lo=B.pressureTest({target:s.low,leak:(leak[s.id]||0)*0.3,seed}),hi=B.pressureTest({target:s.high,leak:leak[s.id]||0,seed:seed+7}),el=B.evaluate(lo,'low'),eh=B.evaluate(hi,'high');
 return {...s,lowT:lo,highT:hi,lowE:el,highE:eh,pass:el.pass&&eh.pass,why:[...el.why.map(x=>'Low: '+x),...eh.why.map(x=>'High: '+x)]}}
export function runAll(leak={},initial=false){return sequence(initial).map((s,i)=>runStep(s,leak,i*13+1))}
// ---- panel ----
const R={el:null,leak:{},initial:false,rec:[],sel:0};const $=i=>document.getElementById(i);
const CSS=`#chP{position:fixed;inset:0;z-index:9850;background:#0d1117f5;color:#ddd;overflow:auto;padding:8px 8px 40px;font:13px system-ui;box-sizing:border-box}#chP button{background:#1f2a36;color:#ddd;border:1px solid #456;border-radius:6px;padding:7px 10px;min-height:36px;font-size:13px}
#chP .sim{background:#a60;color:#fff;border-radius:4px;padding:1px 6px;font-weight:700}#chP .g{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px}#chP .c{background:#111a24;border:1px solid #234;border-radius:8px;padding:8px;min-width:0}
#chP canvas{width:100%;height:auto;background:#081018;border-radius:6px}#chP table{width:100%;border-collapse:collapse;font-size:12px}#chP td,#chP th{border-bottom:1px solid #234;padding:3px;text-align:left}#chP tr.sel{background:#1c3448}.ok{color:#6e6}.bad{color:#f66}`;
function drawSchem(){const c=$('chS'),g=c.getContext('2d'),st=R.rec[R.sel]||sequence(R.initial)[R.sel];g.clearRect(0,0,c.width,c.height);g.save();g.scale(c.width/560,c.height/300);
 const L=(a,b,col='#567')=>{g.strokeStyle=col;g.lineWidth=4;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke()};const P=Object.fromEntries(PARTS.map(p=>[p.id,p]));const isT=id=>st?.close?.includes(id)||st?.id==id;
 L([10,150],[250,150]);L([200,150],[200,70]);L([200,70],[250,70]);L([200,150],[200,230]);L([200,230],[250,230]);L([250,70],[420,70]);L([250,230],[420,230]);L([250,150],[420,150]);L([420,70],[420,230]);L([420,110],[540,110]);L([420,190],[540,190]);
 // pressure zone under test
 if(st?.kind=='pressure'){const p=P[st.id];g.strokeStyle='#f84';g.lineWidth=7;g.globalAlpha=.6;g.beginPath();g.moveTo(10,150);g.lineTo(Math.min(p.x,200),150);if(p.x>200){g.lineTo(200,150);g.lineTo(200,p.y);g.lineTo(p.x,p.y)}g.stroke();g.globalAlpha=1}
 g.fillStyle='#cde';g.font='11px system-ui';g.fillText('From BOP stack',10,140);g.fillText('Gas buster',490,100);g.fillText('Flare',500,180);
 for(const p of PARTS){const t=isT(p.id),rec=R.rec.find(r=>r.id==p.id);g.fillStyle=t?'#f84':rec?(rec.pass?'#3a6':'#c33'):'#9ab';
  if(p.kind=='choke'){g.beginPath();g.moveTo(p.x-14,p.y-12);g.lineTo(p.x+14,p.y);g.lineTo(p.x-14,p.y+12);g.closePath();g.fill()}else{g.beginPath();g.moveTo(p.x-12,p.y-10);g.lineTo(p.x+12,p.y+10);g.lineTo(p.x+12,p.y-10);g.lineTo(p.x-12,p.y+10);g.closePath();g.fill()}
  g.fillStyle='#fff';g.fillText(p.id.toUpperCase(),p.x-14,p.y-15)}
 for(const q of GAUGES){g.fillStyle='#123';g.strokeStyle='#8fd';g.lineWidth=2;g.beginPath();g.arc(q.x,q.y-30,12,0,7);g.fill();g.stroke();g.fillStyle='#8fd';g.fillText(q.id,q.x-7,q.y-26);L([q.x,q.y-18],[q.x,q.y],'#8fd')}
 g.fillStyle='#fd8';g.fillText(st?`Step ${st.n}: ${st.name}${st.kind=='pressure'?' (closed), test from upstream':' (function test)'}`:'',10,290);g.restore()}
function drawChart(){const c=$('chC'),g=c.getContext('2d'),r=R.rec[R.sel];g.clearRect(0,0,c.width,c.height);const W=c.width,H=c.height;g.fillStyle='#cde';g.font='22px system-ui';
 if(!r||r.kind!='pressure'){g.fillText(r?'Function test only (SIM): '+(r.pass?'PASS':'FAIL'):'Run the test to see the chart',20,40);return}
 const T=[...r.lowT.P.map(q=>({t:q.t,p:q.p})),...r.highT.P.map(q=>({t:q.t+r.lowT.P.at(-1).t+60,p:q.p}))],tm=T.at(-1).t,pm=r.high*1.1,X=t=>60+t/tm*(W-80),Y=p=>H-40-p/pm*(H-80);
 for(const [Tt,off,E,tgt] of [[r.lowT,0,r.lowE,r.low],[r.highT,r.lowT.P.at(-1).t+60,r.highE,r.high]]){g.fillStyle=E.pass?'#3a63':'#c333';g.fillRect(X(Tt.t0+off),Y(tgt*1.0),X(Tt.t1+off)-X(Tt.t0+off),Y(tgt*0.95)-Y(tgt));g.strokeStyle='#ffd54a';g.setLineDash([8,6]);g.beginPath();g.moveTo(X(Tt.t0+off),Y(tgt*0.95));g.lineTo(X(Tt.t1+off),Y(tgt*0.95));g.stroke();g.setLineDash([])}
 g.strokeStyle='#4cf';g.lineWidth=3;g.beginPath();T.forEach((q,i)=>i?g.lineTo(X(q.t),Y(q.p)):g.moveTo(X(q.t),Y(q.p)));g.stroke();g.fillStyle='#cde';g.fillText(`${r.name}: pressure vs time (SIM)`,64,28);
 g.font='18px system-ui';g.fillText(`Low ${r.low} psi ${r.lowE.pass?'PASS':'FAIL'} · High ${r.high} psi (${MPa(r.high).toFixed(1)} MPa) ${r.highE.pass?'PASS':'FAIL'} · hold band = 5 min, ≥95 %`,64,H-12);g.fillText('0',40,H-40);g.fillText(Math.round(pm)+' psi',4,50)}
function table(){return `<table id=chRec><tr><th>#</th><th>Part</th><th>Low</th><th>High</th><th>Result</th></tr>${(R.rec.length?R.rec:sequence(R.initial)).map((r,i)=>`<tr data-i=${i} class="${i==R.sel?'sel':''}"><td>${r.n}</td><td>${r.name}</td><td>${r.kind=='pressure'?r.low+' psi':'–'}</td><td>${r.kind=='pressure'?r.high+' psi':'function'}</td><td>${r.pass==null?'–':r.pass?'<b class=ok>PASS</b>':'<b class=bad>FAIL</b> '+r.why.join('; ')}</td></tr>`).join('')}</table>`}
function render(){const p=$('chP');if(!p)return;const all=R.rec.length&&R.rec.every(r=>r.pass);
 p.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px"><b style="font-size:15px">Choke manifold test (API Std 53)</b><span class=sim>SIM</span><button id=chRun>▶ Run test sequence</button>
 <label><input type=checkbox id=chInit ${R.initial?'checked':''}> Initial test (full rated)</label><label>SIM leak on <select id=chLeak><option value="">none</option>${PARTS.map(q=>`<option value=${q.id} ${R.leak[q.id]?'selected':''}>${q.id.toUpperCase()}</option>`).join('')}</select></label><button id=chX style="margin-left:auto">✕ Close</button></div>
 <div class=g><div class=c><b>Schematic</b> <span class=sim>SIM</span><canvas id=chS width=1120 height=600></canvas></div><div class=c><b>Chart</b> <span class=sim>SIM</span><canvas id=chC width=1120 height=600></canvas></div></div>
 <div class=c style="margin-top:10px"><b>Test record</b> <span class=sim>SIM</span> <span id=chSum>${R.rec.length?(all?'<b class=ok>All parts PASS</b>':'<b class=bad>'+R.rec.filter(r=>!r.pass).length+' FAIL: repair and test again</b>'):'Not run'}</span>${table()}
 <small style="opacity:.7">Low test 250–350 psi, high test to rated working pressure (initial) or MASP + 500 psi. Hold 5 min, stable. Downstream of the chokes rated ${S.cmDownRwp} psi. SIM teaching model. Sources: docs/choke.md.</small></div>`;
 $('chRun').onclick=()=>{R.rec=runAll(R.leak,R.initial);R.sel=Math.max(0,R.rec.findIndex(r=>!r.pass));render()};$('chX').onclick=close;$('chInit').onchange=e=>{R.initial=e.target.checked;R.rec=[];render()};
 $('chLeak').onchange=e=>{R.leak=e.target.value?{[e.target.value]:20}:{};R.rec=[];render()};p.querySelectorAll('#chRec tr[data-i]').forEach(t=>t.onclick=()=>{R.sel=+t.dataset.i;render()});drawSchem();drawChart()}
function key(e){if(e.key=='Escape'&&$('chP')){close();e.stopPropagation()}}
export function open(){if(!$('chCss')){const s=document.createElement('style');s.id='chCss';s.textContent=CSS;document.head.appendChild(s)}let p=$('chP');if(!p){p=document.createElement('div');p.id='chP';document.body.appendChild(p)}
 addEventListener('keydown',key,true);render();window.CHOKESIM=api;return api}
export function close(){removeEventListener('keydown',key,true);$('chP')?.remove()}
const api={open,close,R,run:()=>{R.rec=runAll(R.leak,R.initial);render();return R.rec},setLeak:(id,v=20)=>{R.leak=id?{[id]:v}:{};R.rec=[];render()},select:i=>{R.sel=i;render()},sequence,runAll,PARTS};
if(typeof document!='undefined'){window.CHOKESIM_open=open;if(new URLSearchParams(location.search).get('demo')=='choke'){const go=()=>document.getElementById('start')?setTimeout(go,300):open();setTimeout(go,500)}}
