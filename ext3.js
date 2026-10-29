// ext3.js: Trace recorder (strip chart) - scrolling time-series of any signal, like a drilling data recorder.
let C,S,PH,el,PANEL;const COLORS=['#4fc3f7','#ffb74d','#81c784','#e57373','#ba68c8','#fff176','#4db6ac','#f06292','#90a4ae','#aed581','#ffd54f','#7986cb'];
const TR={on:false,tracks:[],t:[],data:{},marks:[],win:120,paused:false,offset:0,cursor:null,last:-1e9,dt:0.25,max:14400};
const KEY='dw33-traces-v1';
const sigSrc=k=>{const m={spp:'spp',Q:'Q',hook:'hook',wob:'wob',rpm:'rpm',md:'md',quill:'quill'};return m[k]&&C.SRC?C.SRC[m[k]]:'sim'};
// ---- signal catalogue ----
function catalogue(){const L=[];const add=(id,label,unit,get,src)=>L.push({id,label,unit,get,src:src||(()=>'sim'),group:label.split(' · ')[0]});
 add('spp','Rig · Standpipe pressure','psi',()=>S.spp,()=>sigSrc('spp'));add('Q','Rig · Flow in','gpm',()=>S.Q,()=>sigSrc('Q'));
 add('hook','Rig · Hookload','klbf',()=>S.hook,()=>sigSrc('hook'));add('wob','Rig · WOB','klbf',()=>S.wob,()=>sigSrc('wob'));
 add('rpm','Rig · Top drive RPM','rpm',()=>S.td.rpm,()=>sigSrc('rpm'));add('tq','Rig · Top drive torque','ft-lbf',()=>S.td.tq||S.td.torque||0);
 add('md','Rig · Measured depth','ft',()=>S.md,()=>sigSrc('md'));add('quill','Rig · Block height','m',()=>S.dw.quill,()=>sigSrc('quill'));
 add('rop','Rig · ROP','ft/h',()=>S.rop||0);add('Qb','Rig · Flow at bit','gpm',()=>S.Qb||0);
 for(const p of S.pumps){const n='Pump '+p.id,lin=p.liner_in||6,mods=p.modules||3,psi=()=>p.flow>1&&!p.tripped?S.spp:0;
  add('p'+p.id+'.spm',n+' · SPM','spm',()=>p.spm);add('p'+p.id+'.flow',n+' · Flow','gpm',()=>p.flow);
  add('p'+p.id+'.psi',n+' · Discharge pressure','psi',psi);add('p'+p.id+'.hp',n+' · Hydraulic power','hp',()=>psi()*p.flow/1714);
  add('p'+p.id+'.trip',n+' · Tripped','0/1',()=>p.tripped?1:0);
  for(let m=1;m<=mods;m++){const ph=(m-1)/mods*2*Math.PI;
   add(`p${p.id}.m${m}.rod`,`${n} · Module ${m} peak rod load`,'klbf',()=>psi()*Math.PI/4*lin*lin/1000);
   add(`p${p.id}.m${m}.vlv`,`${n} · Module ${m} valve cycles`,'count',()=>p.strokes||0)}}
 const X=GX.ext||{};(X.sensors||[]).forEach(s=>add('sen'+s.id,'Sensor · '+s.name,'psi',()=>GX.circuitAt(s.pos).psi));
 [[0.05,'pump discharge line'],[0.4,'drill string mid'],[0.64,'mud motor inlet'],[0.66,'annulus bottom']].forEach(([f,w])=>add('cir'+f,'Circuit · '+w,'psi',()=>GX.circuitAt(f).psi));
 (X.lib||[]).forEach(it=>{const t=(GX.lib()||{})[it.type];if(t?.physics?.kind=='motor'){const n='Surface motor '+it.uid.slice(-3);add('lm'+it.uid+'.rpm',n+' · RPM','rpm',()=>it._rpm||0);add('lm'+it.uid+'.dp',n+' · ΔP','psi',()=>it._dp||0);add('lm'+it.uid+'.tq',n+' · Torque','ft-lbf',()=>it._tq||0)}});
 return L}
let CAT=[];const byId=id=>CAT.find(c=>c.id==id);
function refreshCat(){CAT=catalogue();for(const tr of TR.tracks){const c=byId(tr.id);if(c){tr.get=c.get;tr.src=c.src}}}
function addTrack(id){refreshCat();if(TR.tracks.find(t=>t.id==id))return;const c=byId(id);if(!c)return;TR.tracks.push({id,label:c.label,unit:c.unit,color:COLORS[TR.tracks.length%COLORS.length],get:c.get,src:c.src});TR.data[id]=new Array(TR.t.length).fill(null);save();open(true);build()}
function rmTrack(id){TR.tracks=TR.tracks.filter(t=>t.id!=id);delete TR.data[id];save();build()}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({ids:TR.tracks.map(t=>t.id),win:TR.win}))}catch{}};
// ---- sampling (sim time) ----
let lastEv=0;
function sample(){const t=S.t;
 for(const e of S.events){if(e[0]>lastEv&&/^Step \d+|Sequence complete|aborted|Interlock/.test(e[1])){TR.marks.push([e[0],e[1]]);}}if(S.events.length)lastEv=Math.max(lastEv,S.events.at(-1)[0]);
 if(t-TR.last<TR.dt)return;TR.last=t;TR.t.push(t);for(const tr of TR.tracks){let v=null;try{v=+tr.get()}catch{}TR.data[tr.id].push(isFinite(v)?v:null);(tr.srcs||(tr.srcs=[])).push(tr.src())}
 if(TR.t.length>TR.max){const k=TR.t.length-TR.max;TR.t.splice(0,k);for(const tr of TR.tracks){TR.data[tr.id].splice(0,k);tr.srcs.splice(0,k)}const t0=TR.t[0];TR.marks=TR.marks.filter(m=>m[0]>=t0)}}
// ---- UI ----
let W,cv,ctx,hdr,picker;const H_T=54;
function open(v){TR.on=v==null?!TR.on:v;W.style.display=TR.on?'':'none';if(TR.on)build()}
function ui(){const b=el('button','background:#0a6;color:#fff;font-weight:700','📈 Traces');b.id='trbtn';b.onclick=()=>open();document.getElementById('hud').appendChild(b);
 W=el('div',PANEL+';left:270px;right:270px;bottom:34px;max-height:66vh;overflow:auto;display:none;padding:6px');W.id='traces';document.body.appendChild(W);
 W.innerHTML=`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="color:#8fd">Trace recorder</b><small>sim time · step markers on axis</small>
 <select id=trwin><option value=30>30 s</option><option value=120>2 min</option><option value=600>10 min</option></select>
 <button id=trpause>⏸ Pause</button><input id=trscroll type=range min=0 max=1000 value=1000 style="width:120px" title="scroll back"><button id=trlive>Live ▶|</button>
 <select id=trpick style="max-width:230px"></select><button id=tradd>+ Add trace</button><button id=trpump>+ All pump traces</button><button id=trcsv>Export CSV</button><button id=trclr>Clear</button><button id=trx>×</button></div>
 <div id=trhdr></div><canvas id=trcv style="width:100%;display:block;cursor:crosshair"></canvas>`;
 cv=W.querySelector('#trcv');ctx=cv.getContext('2d');hdr=W.querySelector('#trhdr');picker=W.querySelector('#trpick');
 const q=s=>W.querySelector(s);q('#trwin').value=TR.win;q('#trwin').onchange=e=>{TR.win=+e.target.value;save()};
 q('#trpause').onclick=()=>{TR.paused=!TR.paused;TR.pauseT=S.t;q('#trpause').textContent=TR.paused?'▶ Resume':'⏸ Pause'};
 q('#trscroll').oninput=e=>{TR.offset=(1000-+e.target.value)/1000;if(TR.offset>0&&!TR.paused)q('#trpause').click()};
 q('#trlive').onclick=()=>{TR.offset=0;q('#trscroll').value=1000;if(TR.paused)q('#trpause').click()};
 q('#tradd').onclick=()=>addTrack(picker.value);q('#trpump').onclick=()=>{refreshCat();S.pumps.forEach(p=>['spm','flow','psi','hp'].forEach(k=>addTrack('p'+p.id+'.'+k)))};
 q('#trcsv').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([toCSV()],{type:'text/csv'}));a.download='trace_'+Math.round(S.t)+'s.csv';a.click()};
 q('#trclr').onclick=()=>{TR.t=[];TR.marks=[];for(const tr of TR.tracks){TR.data[tr.id]=[];tr.srcs=[]}};q('#trx').onclick=()=>open(false);
 cv.onmousemove=e=>{const r=cv.getBoundingClientRect();TR.cursor=(e.clientX-r.left)/r.width};cv.onmouseleave=()=>TR.cursor=null;cv.onclick=e=>{const r=cv.getBoundingClientRect(),X=e.clientX-r.left,Y=e.clientY-r.top;if(X>160&&X<190){const tr=TR.tracks.find(t=>t._y&&Y>=t._y[0]&&Y<t._y[0]+20);if(tr)rmTrack(tr.id)}};
 cv.onwheel=e=>{e.preventDefault();if(!TR.paused)q('#trpause').click();TR.offset=Math.max(0,Math.min(1,TR.offset+e.deltaY*0.0005));q('#trscroll').value=1000-TR.offset*1000}}
function build(){refreshCat();picker.innerHTML=[...new Set(CAT.map(c=>c.group))].map(g=>`<optgroup label="${g}">`+CAT.filter(c=>c.group==g).map(c=>`<option value="${c.id}">${c.label.split(' · ')[1]} (${c.unit})</option>`).join('')+'</optgroup>').join('');
 hdr.innerHTML='';cv.height=Math.max(1,TR.tracks.length)*H_T+18;cv.style.height=cv.height+'px'}
function range(){const end=TR.paused?(TR.pauseT??S.t):S.t,t0=TR.t[0]??end,span=Math.max(0,end-TR.win-t0);const e=end-TR.offset*span;return[e-TR.win,e]}
const fmt=v=>v==null?'—':Math.abs(v)>=1000?v.toFixed(0):Math.abs(v)>=10?v.toFixed(1):v.toFixed(2);
function draw(){if(!TR.on||!cv)return;const w=cv.clientWidth|0;if(cv.width!=w)cv.width=w;const Hh=cv.height,[a,b]=range(),LX=190,PW=w-LX-8,x=t=>LX+(t-a)/(b-a)*PW;
 ctx.fillStyle='#0b1218';ctx.fillRect(0,0,w,Hh);ctx.font='11px sans-serif';
 let i0=TR.t.findIndex(t=>t>=a);if(i0<0)i0=TR.t.length;let i1=i0;while(i1<TR.t.length&&TR.t[i1]<=b)i1++;
 const ct=TR.cursor!=null&&TR.cursor*w>LX?a+(TR.cursor*w-LX)/PW*(b-a):null;let ci=null;if(ct!=null){ci=i0;for(let i=i0;i<i1;i++)if(Math.abs(TR.t[i]-ct)<Math.abs(TR.t[ci]-ct))ci=i}
 // grid + markers
 ctx.strokeStyle='#1e2a33';for(let k=0;k<=6;k++){const xx=LX+k*PW/6;ctx.beginPath();ctx.moveTo(xx,0);ctx.lineTo(xx,Hh-18);ctx.stroke();ctx.fillStyle='#789';ctx.fillText((a+k*(b-a)/6).toFixed(0)+'s',xx-10,Hh-5)}
 for(const m of TR.marks)if(m[0]>=a&&m[0]<=b){const xx=x(m[0]);ctx.strokeStyle='#fc65';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(xx,0);ctx.lineTo(xx,Hh-18);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fc6';ctx.fillRect(xx-2,Hh-18,4,5);
  const sm=m[1].match(/^Step (\d+)/);ctx.save();ctx.translate(xx+2,Hh-20);ctx.rotate(-Math.PI/2);ctx.fillStyle='#fc6a';ctx.fillText(sm?'S'+sm[1]:m[1].slice(0,14),0,0);ctx.restore()}
 TR.tracks.forEach((tr,k)=>{const y0=k*H_T,d=TR.data[tr.id]||[];let mn=Infinity,mx=-Infinity;for(let i=i0;i<i1;i++){const v=d[i];if(v!=null){if(v<mn)mn=v;if(v>mx)mx=v}}
  if(!isFinite(mn)){mn=0;mx=1}{const ms=Math.max(1,Math.abs(mx)*0.05);if(mx-mn<ms){const c=(mx+mn)/2;mx=c+ms/2;mn=c-ms/2}}const pad=(mx-mn)*0.1;mn-=pad;mx+=pad;const y=v=>y0+H_T-4-(v-mn)/(mx-mn)*(H_T-10);
  ctx.strokeStyle='#2a3a46';ctx.beginPath();ctx.moveTo(0,y0+H_T);ctx.lineTo(w,y0+H_T);ctx.stroke();
  ctx.strokeStyle=tr.color;ctx.lineWidth=1.5;ctx.beginPath();let pen=false;for(let i=i0;i<i1;i++){const v=d[i];if(v==null){pen=false;continue}const X=x(TR.t[i]),Y=y(v);pen?ctx.lineTo(X,Y):ctx.moveTo(X,Y);pen=true}ctx.stroke();ctx.lineWidth=1;
  const li=ci??(i1-1),cur=d[li],src=(tr.srcs||[])[li]||tr.src();
  ctx.fillStyle=tr.color;ctx.fillRect(4,y0+6,4,H_T-14);ctx.fillStyle='#dde';ctx.fillText(tr.label.slice(0,30),12,y0+14);
  ctx.font='bold 13px sans-serif';ctx.fillStyle=tr.color;ctx.fillText(fmt(cur)+' '+tr.unit,12,y0+29);ctx.font='11px sans-serif';
  ctx.fillStyle=src=='live'?'#3d3':src=='csv'?'#6cf':'#fc6';ctx.fillText(src.toUpperCase(),12,y0+45);ctx.fillStyle='#678';ctx.fillText('max '+fmt(mx-pad)+' min '+fmt(mn+pad),50,y0+45);
  ctx.fillStyle='#e55';ctx.fillText('✕',LX-14,y0+14);tr._y=[y0,y0+H_T]});
 if(ci!=null&&TR.t[ci]!=null){const xx=x(TR.t[ci]);ctx.strokeStyle='#fff8';ctx.beginPath();ctx.moveTo(xx,0);ctx.lineTo(xx,Hh-18);ctx.stroke();ctx.fillStyle='#fff';ctx.fillText('t='+TR.t[ci].toFixed(1)+'s',Math.min(xx+3,w-60),10);
  const mk=TR.marks.filter(m=>Math.abs(m[0]-TR.t[ci])<(b-a)/150).at(-1);if(mk){ctx.fillStyle='#fc6';ctx.fillText(mk[1].slice(0,60),Math.min(xx+3,w-300),22)}}
 if(!TR.tracks.length){ctx.fillStyle='#9ab';ctx.fillText('No traces yet: pick a signal and "+ Add trace", or click a pump / sensor in 3D and press "Add to trace".',LX,30)}
 ctx.fillStyle=TR.paused?'#fc6':'#3d3';ctx.fillText(TR.paused?(TR.offset>0?'PAUSED · scrolled back':'PAUSED'):'● REC',w-90,Hh-5)}
function toCSV(){const ids=TR.tracks.map(t=>t.id);const head=['time_s',...TR.tracks.map(t=>`${t.label.replace(/,/g,' ')} [${t.unit}]`),...TR.tracks.map(t=>t.id+'_source'),'event'];
 const lines=['# Drilling World trace export. Source column per signal: sim = SIMULATED physics, csv = replayed file, live = live feed',head.join(',')];let mi=0;
 for(let i=0;i<TR.t.length;i++){let ev='';while(mi<TR.marks.length&&TR.marks[mi][0]<=TR.t[i]){ev+=(ev?' | ':'')+TR.marks[mi][1];mi++}
  lines.push([TR.t[i].toFixed(2),...ids.map(id=>{const v=TR.data[id][i];return v==null?'':+v.toFixed(3)}),...TR.tracks.map(t=>(t.srcs||[])[i]||''),'"'+ev.replace(/"/g,"'")+'"'].join(','))}return lines.join('\n')}
// ---- 3D picker: "Add to trace" on selected entity panel ----
function entSignals(e){if(!e)return[];refreshCat();const p=e.st&&S.pumps.includes(e.st)?e.st:null;
 if(p)return CAT.filter(c=>c.id.startsWith('p'+p.id+'.'));const sx=(GX.ext.sensors||[]).find(s=>e.st===s||e.name==s.name);if(sx)return CAT.filter(c=>c.id=='sen'+sx.id);
 if(/Standpipe/.test(e.name))return CAT.filter(c=>['spp','Q'].includes(c.id)||c.id.startsWith('cir'));if(/Top drive/.test(e.name))return CAT.filter(c=>['rpm','tq','hook'].includes(c.id));
 if(/Drawworks|mast|Mast/.test(e.name))return CAT.filter(c=>['hook','quill','wob'].includes(c.id));if(/Well/.test(e.name))return CAT.filter(c=>['md','rop','wob','Qb'].includes(c.id)||c.id.startsWith('cir'));
 const lm=(GX.ext.lib||[]).find(it=>e.name.endsWith(it.uid.slice(-3)));if(lm)return CAT.filter(c=>c.id.startsWith('lm'+lm.uid));
 // generic: numeric panel rows of any entity
 try{return e.panel().rows.filter(r=>typeof r[1]=='function'&&isFinite(parseFloat(r[1]()))).map(r=>{const id='ent:'+e.name+':'+r[0];if(!byId(id))CAT.push({id,label:e.name+' · '+r[0],unit:(r[0].match(/(psi|gpm|klbf|rpm|ft|spm|hp|%|m|s)\b/)||[''])[0],get:()=>parseFloat(r[1]()),src:()=>'sim',group:e.name});return byId(id)})}catch{return[]}}
function panelHook(){const pn=document.querySelector('#panels .panel');const e=C.sel&&C.sel();if(!pn||!e||pn.querySelector('.tradd'))return;const sig=entSignals(e);if(!sig.length)return;
 const d=el('div','margin-top:5px;border-top:1px solid #345;padding-top:4px');d.className='tradd';d.innerHTML=`<select style="max-width:170px">${sig.map(c=>`<option value="${c.id}">${c.label.split(' · ').at(-1)}</option>`).join('')}</select> <button>📈 Add to trace</button> <button>All</button>`;
 const [s,b1,b2]=d.children;b1.onclick=()=>{CAT.push(...sig.filter(c=>!byId(c.id)));addTrack(s.value)};b2.onclick=()=>{sig.forEach(c=>{if(!byId(c.id))CAT.push(c)});sig.forEach(c=>{const keep=CAT;addTrack(c.id)})};pn.appendChild(d)}
export function init(ctx){C=ctx;S=C.S;PH=C.PH;el=C.el;PANEL=C.PANEL;ui();
 try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(d){TR.win=d.win||120;W.querySelector('#trwin').value=TR.win;refreshCat();d.ids.forEach(id=>{if(byId(id))addTrack(id)});open(false)}}catch{}
 const E=window.EXT,o=E.afterStep.bind(E);E.afterStep=()=>{o();sample()};const of=E.frame.bind(E);E.frame=(...a)=>{of(...a);draw()};
 setInterval(panelHook,300);setInterval(()=>{if(TR.on&&document.activeElement!==picker){const n=catalogue().length;if(n!=CAT.length)build()}},2000);
 Object.assign(window.GX,{traces:{TR,addTrack,rmTrack,open,toCSV,catalogue:()=>(refreshCat(),CAT.map(c=>({id:c.id,label:c.label,unit:c.unit}))),entSignals:n=>entSignals(C.ents.find(e=>e.name==n)).map(c=>c.id)}})}
