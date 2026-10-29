// ext.js: sequences panel, signal sources (sim / CSV replay / live feed stub), movable line sensors,
// pump parts drill-down, data-driven equipment library (surface + subsurface), layout JSON import/export,
// extra rig-floor geometry. All values SIMULATED unless a CSV or live feed is the selected source.
let C,THREE,S,PH;
const XKEY='dw3-ext-v1',LIBKEY='dw3-lib-user-v1';
const el=(t,css,html)=>{const e=document.createElement(t);if(css)e.style.cssText=css;if(html!=null)e.innerHTML=html;return e};
const BTN='background:#234;color:#def;border:1px solid #567;border-radius:3px;padding:2px 7px;margin:2px 2px 0 0;cursor:pointer';
const PANEL='position:fixed;background:#101820ee;color:#e8eef4;border:1px solid #5a7;border-radius:6px;padding:6px 8px;font:11px system-ui;z-index:20';
export async function init(ctx){C=ctx;THREE=C.THREE;S=C.S;PH=C.PH;S.src=SRC;
 PH.SEQUENCES.smotor={label:'Surface mud motor test (needs motor placed + connected)',build:smotorSteps};
 detailGeometry();seqPanel();signals();sensorsInit();await libInit();
 C.EXT.afterStep=afterStep;C.EXT.frame=frame;C.EXT.actX=actX;
 window.GX={csvData:()=>CSV,circuitAt,startSeq:(k,sm)=>{PH.startSeq(S,k,sm);renderSeq()},stepNext,loadCSVText,useCSV,addSensor,setSensor,placeLib,addBha,exportLayout,importLayout,lib:()=>LIB,ext:X,partSelect,showTree,setSource,feed:FEED};
 try{const m2=await import('./ext2.js?v=55');await m2.init({...C,FEED,SIGS,SRC,sigRender,el,BTN,PANEL,renderSeq})}catch(err){console.error('ext2',err)}
 window.GX_READY=true}

function smotorSteps(){const M=()=>X.lib.find(i=>LIB[i.type]?.physics?.kind=='motor'&&inFlow(i));const keep=S.pumps.map(p=>p.cmd);
 const need=['Check motor placed and connected to flow',s=>{},s=>!!M(),1,null];
 const spm=v=>s=>{s.pumps.forEach(p=>{p.on=true;p.cmd=v})};
 return[need,['Stop drilling: hold block, rotation off',s=>{s.dw.mode='hold';s.td.cmd=0;s.autoSteer=false},s=>s.td.rpm<2,3],
  ['Pumps 40 SPM, brake 0',s=>{spm(40)(s);M().brake=0},s=>true,20],['Pumps 80 SPM',spm(80),s=>true,20],['Pumps 120 SPM',spm(120),s=>true,20],
  ['Brake load 1500 ft-lbf',s=>{M().brake=1500},s=>true,20],['Brake load 3000 ft-lbf',s=>{M().brake=3000},s=>true,20],
  ['Stall test: brake 4000 ft-lbf',s=>{M().brake=4000},s=>!!M()._stall,5],['Release brake, pumps back',s=>{M().brake=0;s.pumps.forEach((p,i)=>p.cmd=keep[i]??100)},s=>true,10]]}
// ---------------- extra geometry (more detailed rig equipment) ----------------
function detailGeometry(){const {box,cyl,mat,M}=C;
 // top drive: motor housing fins, gearbox, bail links, elevator, IBOP, guard
 for(let i=0;i<6;i++){const f=box(0.08,1.2,1.5,mat.dark,-0.85+i*0.34,1.9,0,C.td)}
 box(1.9,0.5,1.6,mat.steel,0,-1.05,0,C.td);cyl(0.22,0.22,0.5,mat.paint,0,-1.55,0,C.td);// gearbox + IBOP
 for(const x of[-0.45,0.45]){const l=cyl(0.05,0.05,2.6,mat.steel,x,-2.7,0.25,C.td)}
 box(1.2,0.3,0.5,mat.yellow,0,-4,0.25,C.td);// elevator
 box(0.25,2.4,0.25,mat.yellow,-1.0,0.2,-0.7,C.td);box(0.25,2.4,0.25,mat.yellow,1.0,0.2,-0.7,C.td);// torque guide
 for(let i=0;i<5;i++){const s=cyl(0.62,0.62,0.12,mat.steel,0,0.5+i*0.4,0,C.blk);s.rotation.x=Math.PI/2}// block sheaves
 // drawworks: motors, chain guard, brake bands, control cabin
 for(const x of[-3.6,3.6]){const mo=cyl(0.8,0.8,1.6,mat.dark,x,1.5,-0.4,C.dwG);mo.rotation.z=Math.PI/2}
 box(6.4,1.6,0.3,mat.yellow,0,2.4,-1.4,C.dwG);for(const x of[-2.2,2.2])box(0.15,1.6,0.6,mat.steel,x,1.6,2.4,C.dwG);
 const cab=box(2.4,2.4,2.2,mat.white,6,1.2,1.5,C.dwG);box(2.3,1,0.05,M(0x335577,0.8,0.1),6,1.8,2.62,C.dwG);
 // slips: bowl + handles + inserts
 cyl(0.9,0.75,0.5,mat.dark,0,-0.25,0,C.slG,24);for(let i=0;i<3;i++){const a=i*2*Math.PI/3;C.box(0.08,0.6,0.08,mat.yellow,Math.sin(a)*0.75,0.45,Math.cos(a)*0.75,C.slG)}
 // roughneck: carriage rails, spinner rollers, torque wrench jaws
 box(2.8,0.15,0.4,mat.steel,-1.2,0.05,0,C.rnG);for(const y of[1.3,1.9]){const j=box(1.3,0.3,1.3,mat.paint,0,y,0,C.rnArm);}
 for(const a of[0.6,-0.6]){cyl(0.15,0.15,0.5,mat.dark,a*0.6,2.6,a,C.rnArm)}
 // catwalk: skate, legs, ramp rails, ladder
 for(let i=0;i<5;i++)box(0.3,0.8,1.4,mat.dark,10+i*4.5,0.4,0,C.cwG);
 const sk=box(0.9,0.4,1.0,mat.yellow,26,1.4,0,C.cwG);C.EXT._skate=sk;
 for(const z of[-0.6,0.6])box(22,0.15,0.1,mat.yellow,18,1.3,z,C.cwG);
}

// ---------------- sequence panel ----------------
let seqEl,listEl,stEl,selEl,stepMode=false;
function seqPanel(){seqEl=el('div',PANEL+';left:8px;bottom:40px;width:330px;max-height:52vh;overflow:auto');seqEl.id='seqpanel';
 seqEl.innerHTML=`<b style="color:#8fd">Sequence</b> <span style="color:#fc6">SIM</span><br>
 <select id="sqsel" style="width:100%;margin:3px 0">${Object.entries(PH.SEQUENCES).map(([k,d])=>`<option value="${k}">${d.label}</option>`).join('')}<option value="csv">CSV replay (load file or sample)</option></select>
 <button id="sqplay" style="${BTN}">▶ Play</button><button id="sqstep" style="${BTN}">⏭ Step</button><button id="sqpause" style="${BTN}">⏸ Pause</button><button id="sqstop" style="${BTN}">■ Stop</button>
 <label><input type=checkbox id="sqsm" style="vertical-align:middle"> step-by-step</label>
 Speed <select id="sqspd">${[1,5,20,60,200].map(v=>`<option ${v==20?'selected':''}>${v}</option>`).join('')}</select>
 <div id="sqst" style="margin:4px 0;color:#fd8"></div><div id="sqlist"></div>`;
 document.body.appendChild(seqEl);listEl=seqEl.querySelector('#sqlist');stEl=seqEl.querySelector('#sqst');selEl=seqEl.querySelector('#sqsel');
 const $=id=>document.getElementById(id);
 $('sqspd').onchange=()=>{C.$?0:0;document.getElementById('spd').value=$('sqspd').value};
 $('sqsm').onchange=()=>{stepMode=$('sqsm').checked;if(S.seq){S.seq.stepMode=stepMode;if(!stepMode)S.seq.wait=false}};
 $('sqplay').onclick=()=>{if(isPaused())document.getElementById('pause').click();
  if(selEl.value=='csv'){if(!CSV)loadSample().then(()=>useCSV(true));else useCSV(true);return}
  if(S.seq){S.seq.wait=false;return}
  if(selEl.value=='conn'&&S.dw.quill>6){PH.ev(S,'Connection needs the stand drilled down first (quill '+S.dw.quill.toFixed(1)+' m)');return}
  PH.startSeq(S,selEl.value,stepMode);renderSeq()};
 $('sqstep').onclick=stepNext;
 $('sqpause').onclick=()=>document.getElementById('pause').click();
 $('sqstop').onclick=()=>{if(S.seq){const t=S.seq.steps[S.seq.i];PH.ev(S,'Sequence stopped at: '+(t?t[0]:''));if(S.seq.tdOverride!=null)S.seq.tdOverride=null;S.seq=null}useCSV(false);renderSeq()}}
function isPaused(){return document.getElementById('pause').textContent=='Play'}
function stepNext(){if(!S.seq){PH.startSeq(S,selEl.value=='csv'?'full':selEl.value,true);stepMode=true;document.getElementById('sqsm').checked=true}else S.seq.wait=false;if(isPaused())document.getElementById('pause').click();renderSeq()}
let lastSig='';
function renderSeq(){const q=S.seq;
 if(REPLAY){const r=csvRow();stEl.textContent='CSV replay '+(r?`t=${r.time_s|0}s ${r.event||''}`:'')+(REPLAY.ended?' (ended)':'');listEl.innerHTML='<small>Signals from CSV: '+Object.keys(SRC).filter(k=>SRC[k]=='csv').join(', ')+'</small>';return}
 if(!q){stEl.textContent='Idle. Pick a sequence and press Play.';if(lastSig!=='idle'){listEl.innerHTML='';lastSig='idle'}return}
 const sig=q.key+q.i+(q.wait?1:0)+(q.blocked||'')+(q.started?1:0);
 const st=q.steps[q.i];stEl.innerHTML=`Step ${q.i+1}/${q.steps.length}: <b>${st?st[0]:''}</b>`+(q.blocked?`<br><span style="color:#f77">INTERLOCK HOLD: ${q.blocked}</span>`:'')+(q.wait?'<br><span style="color:#8cf">Waiting: press Step</span>':'')+(q.started?` <small>${(S.t-q.t0).toFixed(0)} s</small>`:'');
 if(sig==lastSig)return;lastSig=sig;
 listEl.innerHTML=q.steps.map((s,i)=>`<div style="padding:1px 3px;${i==q.i?'background:#2a4a5a;':''}color:${i<q.i?'#7c7':i==q.i?(q.blocked?'#f77':'#fff'):'#9ab'}">${i<q.i?'✓':i==q.i?'▶':'·'} ${i+1}. ${s[0]}${s[5]?` <small style="color:#888">[${s[5]}]</small>`:''}${q.done&&q.done[i]!=null?` <small>${q.done[i].toFixed(0)}s</small>`:''}</div>`).join('')}

// ---------------- signal sources: simulated / CSV replay / live feed (stub) ----------------
const SIGS={spp:['spp_psi',v=>S.spp=v],Q:['flow_gpm',v=>S.Q=v],hook:['hookload_klbf',v=>S.hook=v],wob:['wob_klbf',v=>S.wob=v],rpm:['td_rpm',v=>S.td.rpm=v],md:['md_ft',v=>S.md=v],quill:['quill_m',v=>S.dw.quill=v],slips:['slips',v=>S.slips=!!v]};
const SRC=Object.fromEntries(Object.keys(SIGS).map(k=>[k,'sim']));
let CSV=null,REPLAY=null;
// v3.7: CSV import accepts either unit system; unit from each column header (spp_kpa, flow_lpm, depth_m, hookload_kn, torque_knm, "SPP [bar]", "Flow (L/min)").
// Unitless headers are assumed to be in the currently selected unit system. Values are converted to game-internal units (imperial).
const CSVQ={spp:['spp_psi','psi',['spp','sppa','standpipe','standpipepressure','pressure']],Q:['flow_gpm','gpm',['flow','flowin','q','tflo','flowrate']],hook:['hookload_klbf','klbf',['hookload','hkl','hkla','hook']],wob:['wob_klbf','klbf',['wob','swob']],
 md:['md_ft','ft',['md','depth','holedepth','dmea','dbtm','bitdepth','bde']],quill:['quill_m','m',['quill','block','blockheight','blkpos','bpos','bhe']],tq:['torque_ftlbf','ft·lbf',['torque','tq','tqa']],rop:['rop_fth','ft/h',['rop','ropa']],rpm:['td_rpm','',['rpm','tdrpm','td','rpma']],time:['time_s','',['time','times','t','time_s']]};
function csvCol(h0){const h=h0.trim();let m=h.match(/^(.*?)\s*[\[(]([^\])]+)[\])]\s*$/),base,unit='';if(m){base=m[1];unit=m[2]}else base=h;base=base.toLowerCase().replace(/[\s\-]+/g,'_');
 const key=b=>{b=b.replace(/_/g,'');for(const q in CSVQ)if(CSVQ[q][2].includes(b))return q;return null};let q=key(base);
 if(!q&&!m){const p=base.split('_');for(let i=p.length-1;i>0;i--){const k=key(p.slice(0,i).join('_'));if(k){q=k;unit=p.slice(i).join('/').replace(/^m\/h(r)?$/,'m/h');break}}}
 if(!q)return{from:h,to:h,note:'kept'};const [to,gu]=CSVQ[q];if(q=='time'||!gu)return{from:h,to,note:''};
 if(unit&&!U.dim(unit))unit=unit.replace(/\//g,'');if(unit&&!U.dim(unit))return{from:h,to:h,note:'unknown unit "'+unit+'", column ignored'};
 let assumed=false;if(!unit){unit=U.u(gu);assumed=true}const a=U.dim(unit),b=U.dim(gu);if(!a||!b||a[0]!=b[0])return{from:h,to:h,note:'unit "'+unit+'" does not fit '+q+', ignored'};
 return{from:h,to,unit,gu,note:assumed?'no unit in header, assumed '+unit+' ('+U.sys+')':unit}}
function parseCSV(t){const L=t.trim().split(/\r?\n/),h=L[0].split(',').map(s=>s.trim()),cols=h.map(csvCol);parseCSV.cols=cols;
 return L.slice(1).map(l=>{const c=l.split(','),o={};cols.forEach((col,i)=>{const v=c[i];let x=v===undefined?null:(isNaN(+v)||v===''?v:+v);if(col.gu&&typeof x=='number')x=U.x(x,col.unit,col.gu);if(o[col.to]===undefined||col.gu)o[col.to]=x});return o})}
function loadCSVText(t,name){CSV={rows:parseCSV(t),name:name||'csv'};CSV.cols=parseCSV.cols;PH.ev(S,`CSV loaded: ${CSV.name} (${CSV.rows.length} rows)`);CSV.cols.filter(c=>c.gu||/ignored/.test(c.note)).forEach(c=>PH.ev(S,`CSV column ${c.from} → ${c.to}${c.note?' ['+c.note+']':''}`));sigRender();return CSV.rows.length}
async function loadSample(){const t=await (await fetch('./sample_sequence.csv')).text();loadCSVText(t,'sample_sequence.csv (SIMULATED sample)')}
function useCSV(on){if(on&&!CSV){PH.ev(S,'No CSV loaded');return}
 if(on){REPLAY={t0:S.t,i:0,ended:false};for(const k in SIGS)if(CSV.rows[0][SIGS[k][0]]!=null)SRC[k]='csv';PH.ev(S,'CSV replay started: '+CSV.name)}else{if(REPLAY)PH.ev(S,'CSV replay stopped');REPLAY=null;for(const k in SRC)if(SRC[k]=='csv')SRC[k]='sim'}sigRender()}
function setSource(k,v){SRC[k]=v;if(v=='csv'&&!REPLAY&&CSV)REPLAY={t0:S.t,i:0};sigRender()}
function csvRow(){if(!REPLAY||!CSV)return null;const t=S.t-REPLAY.t0,R=CSV.rows;while(REPLAY.i<R.length-1&&R[REPLAY.i+1].time_s<=t){REPLAY.i++;const ev=R[REPLAY.i].event;if(ev)PH.ev(S,'CSV: '+ev)}
 if(REPLAY.i>=R.length-1&&!REPLAY.ended){REPLAY.ended=true;PH.ev(S,'CSV replay reached end')}
 const a=R[REPLAY.i],b=R[Math.min(REPLAY.i+1,R.length-1)],f=b.time_s>a.time_s?Math.min(1,(t-a.time_s)/(b.time_s-a.time_s)):0;const o={...a};for(const k in a)if(typeof a[k]=='number'&&typeof b[k]=='number'&&k!='slips')o[k]=a[k]+(b[k]-a[k])*f;return o}
// Live feed adapter: STUB. connect(url) opens a WebSocket that must send JSON like {"spp_psi":2900,"flow_gpm":820}.
// Not connected by default. No data leaves the browser.
const FEED={url:null,ws:null,latest:{},status:'not connected (stub)',
 connect(url){try{this.ws=new WebSocket(url);this.url=url;this.status='connecting';this.ws.onopen=()=>{this.status='connected';sigRender()};this.ws.onmessage=m=>{try{Object.assign(this.latest,JSON.parse(m.data))}catch{}};this.ws.onerror=()=>{this.status='error';sigRender()};this.ws.onclose=()=>{this.status='closed';sigRender()}}catch(e){this.status='error: '+e.message}sigRender()},
 disconnect(){this.ws&&this.ws.close();this.ws=null;this.status='not connected (stub)'},
 value(col){return this.latest[col]}};
function afterStep(){
 if(REPLAY){const r=csvRow();if(r)for(const k in SIGS)if(SRC[k]=='csv'&&r[SIGS[k][0]]!=null)SIGS[k][1](r[SIGS[k][0]])}
 for(const k in SIGS)if(SRC[k]=='live'){const v=FEED.value(SIGS[k][0]);if(v!=null)SIGS[k][1](v)}}
let sigEl;function signals(){sigEl=el('div',PANEL+';right:8px;top:44px;width:250px');document.body.appendChild(sigEl);
 const fi=el('input');fi.type='file';fi.accept='.csv';fi.style.display='none';fi.id='csvFile';document.body.appendChild(fi);
 fi.onchange=async()=>{const f=fi.files[0];fi.value='';if(f)loadCSVText(await f.text(),f.name)};sigRender()}
function sigRender(){if(!sigEl)return;sigEl.innerHTML=`<b style="color:#8fd">Signal sources</b> <small style="color:#9ab">(${U.sys=='metric'?'Metric':'Imperial'})</small><br>`+Object.keys(SIGS).map(k=>`<div style="display:flex;justify-content:space-between"><span title="${SIGS[k][0]} (internal)">${k}${(u=>u?' · '+U.u(u):'')(({spp:'psi',Q:'gpm',hook:'klbf',wob:'klbf',md:'ft',quill:'m',rpm:'rpm'})[k]||'')}</span><select data-sig="${k}">${['sim','csv','live'].map(v=>`<option ${SRC[k]==v?'selected':''}>${v}</option>`).join('')}</select></div>`).join('')+
 `<button id="csvload" style="${BTN}">Load CSV file…</button><button id="csvsample" style="${BTN}">Sample CSV</button><br><small>CSV: ${CSV?CSV.name+' '+CSV.rows.length+' rows':'none'}${REPLAY?' · replaying':''}</small><br><small>Live feed: ${FEED.status}</small> <button id="feedc" style="${BTN}">Connect…</button>`;
 sigEl.querySelectorAll('[data-sig]').forEach(s=>s.onchange=()=>setSource(s.dataset.sig,s.value));
 sigEl.querySelector('#csvload').onclick=()=>document.getElementById('csvFile').click();
 sigEl.querySelector('#csvsample').onclick=()=>loadSample();
 sigEl.querySelector('#feedc').onclick=()=>{if(FEED.openConfig)FEED.openConfig();else{const u=prompt('Live feed URL');if(u)FEED.connect(u.trim())}}}

// ---------------- movable sensors on the flow line ----------------
// Circuit position 0..100%: 0-30 surface (pump > manifold > standpipe > hose), 30-65 down the string to the bit, 65-100 annulus back to surface.
const X={sensors:[],lib:[],bha:[],conns:[]};let sensorEnts=[];
function sensorsInit(){}
function circuitAt(f){const p=S.prof||{man:0,surf:0,ds:0,dpm:0,dpb:0,ann:0,xs:0,xb:0};let lost=0,flow=S.Q,where;
 if(f<=0.3){const g=f/0.3;if(g<0.25){lost=p.man*g/0.25;where='pump discharge line'}else{lost=p.man+((p.surf||0)+(p.xs||0))*(g-0.25)/0.75;where=g<0.6?'standpipe':'rotary hose'}}
 else if(f<=0.65){const g=(f-0.3)/0.35;lost=p.man+p.surf+(p.xs||0)+(p.ds+(p.xb||0))*g;if(g>0.93){lost+=p.dpm*Math.min(1,(g-0.93)/0.05);where='mud motor'}else where='drill string @ '+(g*S.md).toFixed(0)+' ft MD';if(g>0.6)flow=S.Qb}
 else{const g=(f-0.65)/0.35;lost=p.man+p.surf+(p.xs||0)+p.ds+(p.xb||0)+p.dpm+p.dpb+p.ann*g;where='annulus @ '+((1-g)*S.md).toFixed(0)+' ft MD'}
 return{psi:Math.max(0,S.spp-lost),flow,where}}
function circuitPos(f,v){const cs=C.allCurves();if(f<=0.3){const surf=[cs[0],...cs.slice(-3)];const g=f/0.3*surf.length,i=Math.min(surf.length-1,Math.floor(g));surf[i].getPoint(Math.min(1,g-i),v);return v}
 const w=C.getWell();if(!w)return v.set(0,0,0);const bf=Math.min(1,PH.bitDepth(S)/S.md);const g=f<=0.65?(f-0.3)/0.35:1-(f-0.65)/0.35;w.getPoint(Math.max(0,Math.min(1,g*bf)),v);if(f>0.65)v.x+=0.35;return v}
function addSensor(pos=0.15,name){const id=(X.sensors.reduce((a,s)=>Math.max(a,s.id),0))+1;const s={id,pos,name:name||'Pressure sensor '+id};X.sensors.push(s);mkSensor(s);save();return s}
function setSensor(id,pos){const s=X.sensors.find(s=>s.id==id);if(s){s.pos=pos;save()}}
function mkSensor(s){const g=new THREE.Group();const m=new THREE.Mesh(new THREE.SphereGeometry(0.45,16,12),new THREE.MeshStandardMaterial({color:0x33ffcc,emissive:0x116655}));g.add(m);
 const e=C.entity(s.name,g,{anchor:new THREE.Vector3(0,1,0),panel:()=>({title:s.name,rows:[['Position %',()=>(s.pos*100).toFixed(0)],['Location',()=>circuitAt(s.pos).where],['Pressure psi',()=>circuitAt(s.pos).psi.toFixed(0)],['Flow gpm',()=>circuitAt(s.pos).flow.toFixed(0)],['Source',()=>SRC.spp]],
  html:`Move along line <input type=range min=0 max=1 step=0.005 data-e="pos" style="width:140px"><br><small>0-30% surface lines · 30-65% string to bit · 65-100% annulus</small><br><button data-x="sdel">Remove sensor</button>`})});
 e.st=s;e.sensor=s;e.noModel=true;sensorEnts.push(e)}
function frame(){const v=new THREE.Vector3();for(const e of sensorEnts){circuitPos(e.st.pos,v);e.obj.position.copy(v);const r=circuitAt(e.st.pos);e.obj.children[0].material.color.setHSL(0.66-0.66*Math.min(1,r.psi/4000),1,0.55)}
 if(C.EXT._skate)C.EXT._skate.position.x=S.catwalk?Math.max(4,C.EXT._skate.position.x-0.05):Math.min(26,C.EXT._skate.position.x+0.1);
 for(const e of libEnts)if(e.rotors.length&&e.lib._rpm){e.rotors.forEach(r=>r.rotation.x+=e.lib._rpm/60*2*Math.PI*0.016)}
 renderSeq();if(treeEl&&treeEl._upd)treeEl._upd()}

// ---------------- pump drill-down (nested parts tree) ----------------
const PUMP_TREE=st=>({name:'Mud pump '+st.id+' ('+(st.ptype||((st.modules||3)==5?'quintuplex':'triplex'))+')',kids:[
 {name:'Power end',part:'Power end',kids:[{name:'Crankshaft',part:'Crankshaft',r:()=>['Crank RPM',st.spm.toFixed(0)]},{name:'Main bearings',r:()=>['Load index',(S.spp*(st.liner_in**2)/1e4).toFixed(1)]},{name:'Crossheads ×3',r:()=>['Speed SPM',st.spm.toFixed(0)]},{name:'Gear reducer',r:()=>['Pinion RPM',(st.spm*4.2).toFixed(0)]}]},
 {name:'Fluid end',part:'Fluid end',kids:Array.from({length:st.modules||3},(_,i)=>i+1).map(k=>({name:'Module '+k,kids:[
   {name:'Liner '+st.liner_in+' in',part:'Piston + liner '+k,r:()=>['Rod load klbf',(S.spp*Math.PI/4*st.liner_in**2/1000).toFixed(1)]},
   {name:'Piston',part:'Piston + liner '+k,r:()=>['Cycles',st.strokes.toFixed(0)]},
   {name:'Suction valve + seat',part:'Suction valve '+k,r:()=>['Cycles',st.strokes.toFixed(0)]},
   {name:'Discharge valve + seat',part:'Discharge valve '+k,r:()=>['ΔP psi',S.spp.toFixed(0)]}]}))},
 {name:'Pulsation dampener',part:'Pulsation dampener',r:()=>['Line psi',S.spp.toFixed(0)]},
 {name:'Pop-off valve',part:'Pop-off valve',r:()=>['Set / now psi',PH.P.pump.popoff_psi+' / '+S.spp.toFixed(0)]},
 {name:'Suction manifold',part:'Suction manifold',r:()=>['Flow gpm (water unlimited)',st.flow.toFixed(0)]}]});
let treeEl=null,hiMesh=[];
function showTree(e){treeEl&&treeEl.remove();const root=e.type=='mudpump'?PUMP_TREE(e.st):libTree(e);treeEl=el('div',PANEL+';left:350px;bottom:40px;width:300px;max-height:50vh;overflow:auto');
 const rs=[];const rec=(n,d)=>{const i=rs.length;rs.push(n);return `<div style="margin-left:${d*12}px"><a href="#" data-n="${i}" style="color:${n.part?'#8fd':'#cde'}">${n.kids?'▾ ':'• '}${n.name}</a> ${n.r?`<small id="tr${i}"></small>`:''}</div>`+(n.kids||[]).map(k=>rec(k,d+1)).join('')};
 treeEl.innerHTML=`<b>Parts tree</b> <button id="trx" style="${BTN}">close</button><br>`+rec(root,0);document.body.appendChild(treeEl);
 treeEl.querySelector('#trx').onclick=()=>{treeEl.remove();treeEl=null;hi([])};
 treeEl.querySelectorAll('[data-n]').forEach(a=>a.onclick=ev=>{ev.preventDefault();const n=rs[+a.dataset.n];if(e.parts&&n.part&&e.parts[n.part]){if(e.type=='mudpump'&&!e.explode)e.dbl();hi([e.parts[n.part]])}});
 treeEl._upd=()=>rs.forEach((n,i)=>{if(n.r){const x=document.getElementById('tr'+i);if(x){const [k,v]=n.r();x.textContent=U.lab(k)+': '+U.val(k,v)}}})}
function partSelect(pumpIdx,part){const e=C.pumps[pumpIdx];showTree(e);if(!e.explode)e.dbl();hi([e.parts[part]])}
function hi(objs){hiMesh.forEach(([m,c])=>m.material=c);hiMesh=[];for(const o of objs)o&&o.traverse(m=>{if(m.isMesh){hiMesh.push([m,m.material]);m.material=m.material.clone();m.material.emissive=new THREE.Color(0x00aaff);m.material.emissiveIntensity=0.8}})}

// ---------------- data-driven equipment library ----------------
let LIB={};
async function libInit(){try{const j=await (await fetch('./equipment.json')).json();j.types.forEach(t=>LIB[t.type]=t)}catch(e){console.warn('equipment.json',e)}
 try{(JSON.parse(localStorage.getItem(LIBKEY)||'[]')).forEach(t=>LIB[t.type]=t)}catch{}
 libMenu();restore()}
function libMenu(){const hud=document.getElementById('hud');const b=el('button');b.textContent='Equipment library ▾';hud.appendChild(b);
 const b2=el('button');b2.textContent='Add sensor';b2.onclick=()=>{const s=addSensor();C.select(sensorEnts.find(e=>e.st===s))};hud.appendChild(b2);
 const b3=el('button');b3.textContent='Export layout';b3.onclick=()=>{const blob=new Blob([JSON.stringify(exportLayout(),null,1)],{type:'application/json'});const a=el('a');a.href=URL.createObjectURL(blob);a.download='rig-layout.json';a.click()};hud.appendChild(b3);
 const b4=el('button');b4.textContent='Import layout';hud.appendChild(b4);const fi=el('input');fi.type='file';fi.accept='.json';fi.style.display='none';document.body.appendChild(fi);b4.onclick=()=>fi.click();fi.onchange=async()=>{const f=fi.files[0];fi.value='';if(f)importLayout(JSON.parse(await f.text()))};
 const m=el('div','display:none;'+PANEL+';top:40px;left:200px;width:280px;max-height:70vh;overflow:auto');m.id='libmenu';document.body.appendChild(m);
 const draw=()=>{const cat=c=>Object.values(LIB).filter(t=>t.category==c).map(t=>`<button data-lib="${t.type}" style="${BTN};display:block;width:100%;text-align:left">${t.label}</button>`).join('');
  m.innerHTML=`<b>Surface</b>${cat('surface')}<button data-core="mudpump" style="${BTN};display:block;width:100%;text-align:left">Mud pump (full physics)</button>`+Object.entries(C.EQ).filter(([k])=>k!='mudpump').map(([k,t])=>`<button data-core="${k}" style="${BTN};display:block;width:100%;text-align:left">${t.label}</button>`).join('')+
  `<b>Subsurface (adds to BHA)</b>${cat('subsurface')}<hr><button id="libimp" style="${BTN}">Import type definitions (JSON)…</button><br><small>Types are data: see equipment.json. New types need no code change.</small>`;
  m.querySelectorAll('[data-lib]').forEach(x=>x.onclick=()=>{m.style.display='none';const t=LIB[x.dataset.lib];if(t.category=='subsurface')addBha(t.type);else{const e=placeLib(t.type);C.select(e)}});
  m.querySelectorAll('[data-core]').forEach(x=>x.onclick=()=>{m.style.display='none';C.select(C.addEquip(x.dataset.core))});
  m.querySelector('#libimp').onclick=()=>tfi.click()};
 const tfi=el('input');tfi.type='file';tfi.accept='.json';tfi.style.display='none';document.body.appendChild(tfi);
 tfi.onchange=async()=>{const f=tfi.files[0];tfi.value='';if(!f)return;const j=JSON.parse(await f.text());const ts=j.types||[j];const user=JSON.parse(localStorage.getItem(LIBKEY)||'[]');ts.forEach(t=>{if(!t.type||!t.label)return;LIB[t.type]=t;user.push(t)});localStorage.setItem(LIBKEY,JSON.stringify(user));PH.ev(S,'Imported '+ts.length+' equipment type(s)');draw()};
 b.onclick=()=>{draw();m.style.display=m.style.display=='none'?'block':'none'}}
function buildGeom(t,g){for(const p of t.geometry||[]){const c=new THREE.Color(p.color||'#888');const mt=new THREE.MeshStandardMaterial({color:c,metalness:0.5,roughness:0.5});let geo;const s=p.size||[1,1,1];
 if(p.shape=='cyl')geo=new THREE.CylinderGeometry(s[0],s[1],s[2],20);else if(p.shape=='sphere')geo=new THREE.SphereGeometry(s[0],20,14);else geo=new THREE.BoxGeometry(s[0],s[1],s[2]);
 const m=new THREE.Mesh(geo,mt);if(p.rotor)m.userData.rotor=1;m.castShadow=m.receiveShadow=true;const q=p.pos||[0,0,0];m.position.set(...q);const r=p.rot||[0,0,0];m.rotation.set(r[0]*Math.PI/180,r[1]*Math.PI/180,r[2]*Math.PI/180);g.add(m)}}
const qLoss=(t,Q,it)=>{const p=t.physics||{};if(p.kind=='line_loss')return p.k*Q*Q;
 if(p.kind=='motor'&&it){// surface mud motor on test stand: driven by pump flow; brake torque from dynamometer
  const bt=it.brake||0,stall=bt>p.stall_torque&&Q>50;it._stall=stall;it._torque=Q>50?Math.min(bt,p.stall_torque):0;
  it._rpm=stall||Q<1?0:Q*p.rev_per_gal*(1-0.3*bt/p.stall_torque);it._dp=Q>50?(stall?p.dp_off+p.stall_torque/p.torque_per_psi*1.3:p.dp_off+bt/p.torque_per_psi):0;return it._dp}
 return 0};
function inFlow(it){// connected (directly or through a chain) to the standpipe or a mud pump
 const seen=new Set([it.uid]),st=[it.uid];while(st.length){const u=st.pop();for(const c of X.conns){const o=c.a==u?c.b:c.b==u?c.a:null;if(o==null)continue;if(o=='standpipe'||String(o).startsWith('pump'))return true;if(!seen.has(o)){seen.add(o);st.push(o)}}}return false}
function physicsHooks(){
 S.extraSurf=Q=>X.lib.reduce((a,it)=>a+(inFlow(it)?qLoss(LIB[it.type]||{},Q,it):(it._rpm=0,it._dp=0,it._torque=0,0)),0);
 S.extraBha=Q=>X.bha.reduce((a,b)=>{const p=(LIB[b.type]||{}).physics||{};return a+(p.kind=='bha'?(p.dp_psi||0)*(Q/600)**2:0)},0);
 S.extraWeight=X.bha.reduce((a,b)=>a+(((LIB[b.type]||{}).physics||{}).weight_klbf||0),0)}
let libEnts=[];
function placeLib(type,saved){const t=LIB[type];if(!t)throw new Error('unknown type '+type);const uid=saved?.uid||('L'+Date.now().toString(36)+Math.floor(Math.random()*1e3));
 const it=saved||{uid,type,x:-20+Math.random()*6,z:26+Math.random()*6,sensors:[]};const g=new THREE.Group();g.position.set(it.x,0.3,it.z);buildGeom(t,g);
 const e=C.entity(t.label+' '+uid.slice(-3),g,{anchor:new THREE.Vector3(0,3,0),panel:()=>({title:t.label,rows:[['Category',()=>t.category],['Connected to flow',()=>inFlow(it)?'yes':'no'],...(t.physics?.kind=='motor'?[['Motor RPM',()=>(it._rpm||0).toFixed(0)+(it._stall?' STALL':'')],['Differential psi',()=>(it._dp||0).toFixed(0)],['Torque ft-lbf',()=>(it._torque||0).toFixed(0)],['Inlet psi',()=>inFlow(it)?(S.spp-(S.prof?.man||0)).toFixed(0):'0']]:[['Loss now psi',()=>inFlow(it)?qLoss(t,S.Q,it).toFixed(0):'0']]),...((t.sensors||[]).includes('pressure')?[['Pressure psi (sensor)',()=>inFlow(it)?(S.spp-(S.prof?.man||0)).toFixed(0):'0']]:[]),['Ports',()=>(t.ports||[]).map(p=>p.name).join(', ')||'-']],
  html:(t.physics?.kind=='motor'?`Brake torque <input type=range min=0 max=${t.physics.max_brake} step=50 data-e="brake"><br>`:'')+`Connect to <select id="connsel">${connTargets(it).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select><button data-x="lconn">Connect</button><button data-x="ldisc">Disconnect all</button><br><button data-x="ltree">Parts tree</button><button data-x="lrem" style="background:#612">Remove</button> <small>Drag to move</small>`})});
 e.lib=it;e.st=it;it.brake??=0;e.type='lib:'+type;e.rotors=[];g.traverse(o=>{if(o.userData.rotor)e.rotors.push(o)});e.movable=true;e.key='lib'+uid;libEnts.push(e);if(!saved){X.lib.push(it);PH.ev(S,'Placed '+t.label)}physicsHooks();drawConns();save();return e}
function connTargets(it){return [['standpipe','Standpipe / main flow line'],...C.pumps.map(p=>['pump'+p.st.id,p.name]),...X.lib.filter(o=>o!==it).map(o=>[o.uid,LIB[o.type].label+' '+o.uid.slice(-3)])]}
let connMeshes=[];
function anchorOf(id){if(id=='standpipe')return new THREE.Vector3(-3.6,1.5,3.6);if(String(id).startsWith('pump')){const p=C.pumps.find(p=>'pump'+p.st.id==id);return p?p.obj.position.clone().add(new THREE.Vector3(3.6,1.5,0)):null}const e=libEnts.find(e=>e.lib.uid==id);return e?e.obj.position.clone().add(new THREE.Vector3(0,0.8,0)):null}
function drawConns(){connMeshes.forEach(m=>{C.scene.remove(m);m.geometry.dispose()});connMeshes=[];for(const c of X.conns){const a=anchorOf(c.a),b=anchorOf(c.b);if(!a||!b)continue;const mid=a.clone().lerp(b,0.5);mid.y=Math.max(a.y,b.y)+0.6;const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a,mid,b]),20,0.14,8),new THREE.MeshStandardMaterial({color:0x222222}));C.scene.add(m);connMeshes.push(m)}}
function libTree(e){const t=LIB[e.lib?e.lib.type:e.bha.type];const conv=n=>({name:n.name,kids:n.parts?n.parts.map(conv):undefined});return{name:t.label,kids:[...(t.parts||[]).map(conv),{name:'Ports: '+((t.ports||[]).map(p=>p.name).join(', ')||'none')},{name:'Physics: '+JSON.stringify(t.physics||{})}]}}
// subsurface: BHA stack above the motor, real physics (pressure loss + weight)
let bhaMeshes=[];
function addBha(type,saved){const t=LIB[type];if(!saved){X.bha.push({uid:'B'+Date.now().toString(36),type});PH.ev(S,'BHA: added '+t.label)}physicsHooks();drawBha();save()}
function drawBha(){bhaMeshes.forEach(o=>o.parent&&o.parent.remove(o));bhaMeshes=[];const bha=C.getWell()?null:null;let y=1.6;const host=C.scene.getObjectByName('bhaGroup')||findBha();
 X.bha.forEach((b,i)=>{const t=LIB[b.type];if(!t)return;const len=Math.max(0.3,(t.physics?.length_ft||10)*0.04);const g=new THREE.Group();buildGeom({geometry:(t.geometry||[]).map(p=>({...p,pos:[0,0,0]}))},g);g.children.forEach(m=>{m.scale.y=len/(m.geometry.parameters.height||1)});g.position.y=y+len/2;y+=len;host&&host.add(g);bhaMeshes.push(g);
  const e={name:t.label+' (BHA '+(i+1)+')',obj:g,update(){},anchor:new THREE.Vector3(0,0,0),noModel:true,bha:b,panel:()=>({title:t.label+' (BHA)',rows:[['Length ft',()=>t.physics?.length_ft||'-'],['ΔP psi now',()=>((t.physics?.dp_psi||0)*(S.Qb/600)**2).toFixed(0)],['Weight klbf',()=>t.physics?.weight_klbf||0],...((t.sensors||[]).includes('inc')?[['Inc / Azi',()=>S.inc.toFixed(1)+' / '+S.azi.toFixed(0)]]:[])],html:`<button data-x="ltree">Parts tree</button><button data-x="brem" style="background:#612">Remove from BHA</button>`})};
  g.traverse(o=>o.userData.ent=e)})}
function findBha(){let h=null;C.UG.traverse(o=>{if(!h&&o.isGroup&&o!==C.UG&&o.children.length>=2)h=o});return h}
function actX(e,x){
 if(x=='tree'||x=='ltree'){showTree(e);return true}
 if(x=='sdel'){X.sensors=X.sensors.filter(s=>s!==e.st);C.scene.remove(e.obj);C.ents.splice(C.ents.indexOf(e),1);sensorEnts=sensorEnts.filter(s=>s!==e);C.select(null);save();return true}
 if(x=='lconn'){const v=document.getElementById('connsel').value;X.conns.push({a:e.lib.uid,b:v});PH.ev(S,'Connected '+e.name+' → '+v);physicsHooks();drawConns();save();C.select(e);return true}
 if(x=='ldisc'){X.conns=X.conns.filter(c=>c.a!=e.lib.uid&&c.b!=e.lib.uid);drawConns();save();C.select(e);return true}
 if(x=='lrem'){X.lib=X.lib.filter(i=>i!==e.lib);X.conns=X.conns.filter(c=>c.a!=e.lib.uid&&c.b!=e.lib.uid);C.scene.remove(e.obj);C.ents.splice(C.ents.indexOf(e),1);libEnts=libEnts.filter(l=>l!==e);C.select(null);physicsHooks();drawConns();PH.ev(S,'Removed '+e.name);save();return true}
 if(x=='brem'){X.bha=X.bha.filter(b=>b!==e.bha);C.select(null);physicsHooks();drawBha();save();return true}
 return false}
// keep lib positions after drag
setInterval(()=>{let ch=0;for(const e of libEnts){if(e.lib.x!=e.obj.position.x||e.lib.z!=e.obj.position.z){e.lib.x=e.obj.position.x;e.lib.z=e.obj.position.z;ch=1}}if(ch){drawConns();save()}},500);
// ---------------- persistence + layout JSON ----------------
function save(){try{localStorage.setItem(XKEY,JSON.stringify(X))}catch{}}
function restore(){let d=null;try{d=JSON.parse(localStorage.getItem(XKEY)||'null')}catch{}if(!d)return;X.sensors=[];X.lib=d.lib||[];X.bha=d.bha||[];X.conns=d.conns||[];
 (d.sensors||[]).forEach(s=>{X.sensors.push(s);mkSensor(s)});X.lib.forEach(it=>{if(LIB[it.type])placeLib(it.type,it)});physicsHooks();drawBha();drawConns()}
function exportLayout(){return{format:'drilling-world-layout',version:1,core:JSON.parse(localStorage.getItem('dw3-layout-v1')||'null'),ext:X,userTypes:JSON.parse(localStorage.getItem(LIBKEY)||'[]')}}
function importLayout(j){if(j.format!='drilling-world-layout'){PH.ev(S,'Not a layout file');return}if(j.core)localStorage.setItem('dw3-layout-v1',JSON.stringify(j.core));localStorage.setItem(XKEY,JSON.stringify(j.ext||{}));if(j.userTypes)localStorage.setItem(LIBKEY,JSON.stringify(j.userTypes));location.reload()}

try{U.on(()=>sigRender())}catch{}
