// ext2.js (v3.2): game visuals + camera modes, live feed adapter (WebSocket / HTTP poll, field + WITSML-style tag mapping),
// rig designer (derived capacities feed the physics), multi mud pumps, sequence editor with nested sub-sequences.
// Everything is SIMULATED unless a CSV or live feed is the selected signal source. All geometry is procedural.
let C,THREE,S,PH,el,BTN,PANEL;
const $=id=>document.getElementById(id);
export async function init(ctx){C=ctx;THREE=C.THREE;S=C.S;PH=C.PH;el=C.el;BTN=C.BTN;PANEL=C.PANEL;
 visuals();camModes();feedInit();designerInit();seqEditorInit();
 const f0=C.EXT.frame;C.EXT.frame=dt=>{f0(dt);frame2(dt)};
 const a0=C.EXT.actX;C.EXT.actX=(e,x,b)=>{if(x=='pvalve'&&e.st){e.st.valve=e.st.valve===false;PH.ev(S,'Pump '+e.st.id+' manifold valve '+(e.st.valve===false?'closed':'open'));if(e.st.valve!==false)e.st.tripped=false;return true}return a0(e,x,b)};
 const s0=C.EXT.afterStep;C.EXT.afterStep=()=>{s0();feedStale()};
 Object.assign(window.GX,{feedStatus:s=>setStatus(s),feedPush:(vals,src)=>{FS.src=src||FS.src;Object.assign(FS.vals,vals);FS.last=performance.now();FS.msgs++;if(FS.status!='live')setStatus('live')},feedState:FS,feedCfg:FCFG,feedConnect,feedDisconnect,design:()=>DES,applyDesign,derive,setDesign,addPumpType,PUMP_TYPES,seqLib:()=>SEQLIB,compileSeq,runUserSeq,saveSeqLib,camMode:setCam,seqTree:renderTree});try{(await import('./ext3.js?v=35')).init(C)}catch(err){console.error('ext3',err)}
}
// ======================= 1. VISUALS =======================
let reeve,fastLine,tdA,bopG,camBtns;
function visuals(){const {box,cyl,beam,mat,M,FLOOR,MH,scene}=C,lp=(...a)=>new THREE.Vector3(...a);
 // environment lighting: PMREM from a procedural sky gradient scene (no external HDRI)
 try{const pm=new THREE.PMREMGenerator(C.ren);const es=new THREE.Scene();const sg=new THREE.SphereGeometry(50,32,16);
  const cols=[];const pos=sg.attributes.position;const c=new THREE.Color();for(let i=0;i<pos.count;i++){const y=pos.getY(i)/50;c.setHSL(0.58,0.5,y>0?0.55+0.35*y:0.35+0.1*y);cols.push(c.r,c.g,c.b)}
  sg.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));es.add(new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
  const sunb=new THREE.Mesh(new THREE.SphereGeometry(4,16,8),new THREE.MeshBasicMaterial({color:0xffffff}));sunb.material.color.multiplyScalar(30);sunb.position.set(25,40,15);es.add(sunb);
  scene.environment=pm.fromScene(es,0.04).texture;C.ren.toneMappingExposure=0.95}catch(e){console.warn('env',e)}
 // procedural ground + pad textures
 const noiseTex=(base,var_,n=256,rep=40)=>{const cv=document.createElement('canvas');cv.width=cv.height=n;const g=cv.getContext('2d');g.fillStyle=base;g.fillRect(0,0,n,n);for(let i=0;i<n*n/6;i++){const v=Math.random();g.fillStyle=`rgba(${var_},${v*0.25})`;g.fillRect(Math.random()*n,Math.random()*n,1+v*2,1+v*2)}const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep,rep);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t};
 C.groundMat.map=noiseTex('#7d8a55','40,50,20',256,90);C.groundMat.color.set(0xffffff);C.groundMat.needsUpdate=true;
 C.pad.material.map=noiseTex('#a89a82','60,50,40',256,12);C.pad.material.color.set(0xffffff);C.pad.material.needsUpdate=true;
 const G=new THREE.Group();G.name='v32visuals';scene.add(G);
 const steelP=M(0xb5a032,0.55,0.45),rail=M(0xd8c020,0.3,0.5),conc=M(0x9a9a96,0,0.9),black=M(0x111111,0.2,0.7),red=M(0xb02a20,0.4,0.45);
 // substructure X-bracing + floor detail
 for(const [a,b] of [[[-5,-5],[5,-5]],[[-5,5],[5,5]],[[-5,-5],[-5,5]],[[5,-5],[5,5]]])for(const lv of[0,1]){const y0=lv*FLOOR/2,y1=y0+FLOOR/2;beam(lp(a[0],y0,a[1]),lp(b[0],y1,b[1]),0.07,steelP,G);beam(lp(b[0],y0,b[1]),lp(a[0],y1,a[1]),0.07,steelP,G);beam(lp(a[0],y1,a[1]),lp(b[0],y1,b[1]),0.09,steelP,G)}
 for(let i=0;i<4;i++){const s=i<2?-6:6,ang=i%2;for(let k=-6;k<=6;k+=1.5){const p=ang?lp(s,FLOOR+1.1,k):lp(k,FLOOR+1.1,s);if(!(ang&&s>0&&Math.abs(k)<2))cyl(0.04,0.04,1.1,rail,p.x,FLOOR+0.65,p.z,G,6)}
  const a=ang?lp(s,FLOOR+1.15,-6):lp(-6,FLOOR+1.15,s),b=ang?lp(s,FLOOR+1.15,6):lp(6,FLOOR+1.15,s);beam(a,b,0.04,rail,G);a.y=b.y=FLOOR+0.65;beam(a,b,0.03,rail,G)}
 box(4,3,3.2,M(0xd8d8d0,0.1,0.6),-8.5,FLOOR+1.5,-3,G);box(1.6,0.9,0.05,M(0x223344,0.9,0.1),-6.48,FLOOR+2,-3,G).rotation.y=Math.PI/2;// doghouse + window
 box(4,0.2,3.2,conc,-8.5,FLOOR-0.1,-3,G);
 // derrick: second diagonal (X-bracing), racking board fingers, ladder
 const mt=FLOOR,legs=[[-3,-3],[3,-3],[-3,3],[3,3]].map(([x,z])=>[lp(x,mt,z),lp(x*0.35,mt+MH,z*0.35)]);const ord=[0,1,3,2];
 for(let y=0;y<MH;y+=4)for(let i=0;i<4;i++){const [a1,b1]=legs[ord[i]],[a2,b2]=legs[ord[(i+1)%4]];if(i==1)continue;beam(a2.clone().lerp(b2,y/MH),a1.clone().lerp(b1,(y+4)/MH),0.05,M(0xe0b020,0.3,0.5),G)}
 for(let k=0;k<8;k++)box(0.08,0.08,1.6,steelP,-0.9+k*0.25,mt+MH-12.05,-3.6,G);
 {const [a,b]=legs[1];for(let y=0;y<MH;y+=0.4){const p=a.clone().lerp(b,y/MH);box(0.5,0.04,0.04,steelP,p.x+0.4,p.y,p.z,G)}}
 // top-drive guide rails (torque tube) + crown sheave cluster + deadline anchor
 for(const z of[-0.45,0.45])box(0.18,MH-3,0.18,M(0x9aa3ab,0.85,0.3),1.55,FLOOR+(MH-3)/2+0.5,z,G);
 for(let i=0;i<6;i++){const s=cyl(0.75,0.75,0.18,M(0x707880,0.9,0.3),0,mt+MH+1.35,-1.25+i*0.5,G,24);s.rotation.x=Math.PI/2}
 box(0.6,0.8,0.6,M(0x2c5d9e,0.4,0.5),-3,FLOOR+0.6,-5.2,G);
 // drill line spooled on drawworks drum (helix) + fast line + reeving to block
 {const pts=[];for(let i=0;i<=400;i++){const a=i/400*Math.PI*2*22;pts.push(lp(-1.5+3*i/400,0.98*Math.cos(a),0.98*Math.sin(a)))}const h=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),800,0.05,5),M(0x30353a,0.9,0.4));h.position.set(0,2.2,1.6);C.dwG.add(h)}
 const wm=new THREE.LineBasicMaterial({color:0x1a1a1a});reeve=new THREE.LineSegments(new THREE.BufferGeometry(),wm);scene.add(reeve);
 fastLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([lp(0,FLOOR+2.2,-6.4),lp(0,mt+MH+1.35,-1.4)]),wm);scene.add(fastLine);
 tdA=C.tdAll;
 // BOP stack in cellar (annular + double ram + mud cross with choke/kill lines) + wellhead
 bopG=new THREE.Group();G.add(bopG);mkBop();const BOP=(y,h,r,m)=>cyl(r,r,h,m,0,y,0,bopG,24);
 BOP(0.6,0.8,0.5,M(0x888c90,0.85,0.35));// wellhead
 box(1.2,0.6,1.2,red,0,1.3,0,bopG);for(const s of[-1,1]){const l=cyl(0.12,0.12,1.8,M(0x888c90,0.85,0.35),s*1.2,1.3,0,bopG);l.rotation.z=Math.PI/2;cyl(0.22,0.22,0.5,red,s*1.9,1.3,0,bopG)}// mud cross + choke/kill valves
 for(const y of[2.2,3.3]){box(2.8,0.9,1.3,red,0,y,0,bopG);for(const s of[-1,1]){const r=cyl(0.35,0.35,0.6,red,s*1.65,y,0,bopG);r.rotation.z=Math.PI/2}}// double ram
 const ann=cyl(1.05,1.15,1.6,red,0,4.6,0,bopG,28);cyl(0.7,1.05,0.5,red,0,5.65,0,bopG,28);// annular
 cyl(0.4,0.4,1.6,M(0x888c90,0.85,0.35),0,6.7,0,bopG);// riser / bell nipple
 bopG.traverse(o=>o.userData&&(o.userData.ent=bopEnt));
 // cellar: concrete rim + dark floor
 for(const [w,d,x,z] of [[5,0.4,0,-2.4],[5,0.4,0,2.4],[0.4,5,-2.4,0],[0.4,5,2.4,0]])box(w,0.5,d,conc,x,0.25,z,G);box(4.4,0.05,4.4,black,0,0.27,0,G);
 // pipe rack (trestles + stacked joints) beside catwalk
 for(const x of[12,18,24]){box(0.25,1,4,M(0x2c5d9e,0.4,0.5),x,0.5,7,G);box(0.4,0.15,4.4,steelP,x,1.05,7,G)}
 for(let r=0;r<3;r++)for(let i=0;i<8-r;i++){const p=cyl(0.12,0.12,14,M(0x6d6f73,0.9,0.3),18,1.25+r*0.22,5.4+i*0.26+r*0.13,G,10);p.rotation.z=Math.PI/2}
 // high-pressure manifold block with valves near standpipe
 {const mx=-12,mz=6;box(1.6,1.2,2.4,M(0x777d84,0.8,0.35),mx,0.9,mz,G);for(let i=0;i<4;i++){cyl(0.18,0.18,0.5,red,mx,1.75,mz-0.9+i*0.6,G);box(0.6,0.06,0.06,M(0x222222),mx,2.05,mz-0.9+i*0.6,G)}}
 // light towers
 for(const [x,z] of[[-20,-20],[25,-15],[-25,25]]){cyl(0.15,0.2,14,M(0x9aa3ab,0.8,0.4),x,7,z,G,8);box(1.6,0.8,0.3,M(0xeeeeee,0.2,0.4,{emissive:0x555544}),x,14.2,z,G)}
 // more trees/hills in distance for depth (low-poly, instanced)
 const tg=new THREE.ConeGeometry(2.5,8,6),tm=M(0x3d5a2c,0,0.9),inst=new THREE.InstancedMesh(tg,tm,120),mm=new THREE.Matrix4();
 for(let i=0;i<120;i++){const a=Math.random()*Math.PI*2,r=110+Math.random()*200,s=0.7+Math.random()*1.2;mm.compose(lp(Math.cos(a)*r,3*s,Math.sin(a)*r),new THREE.Quaternion(),lp(s,s,s));inst.setMatrixAt(i,mm)}inst.castShadow=true;scene.add(inst);
 G.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true}});
 C.ents.push(bopEnt);
}
let bopEnt;const mkBop=()=>bopEnt={name:'BOP stack',noModel:true,obj:bopG,update(){},anchor:new THREE.Vector3(0,6,0),panel:()=>({title:'BOP stack (cellar)',rows:[['Rating psi',()=>DES?DES.bop_psi:'10000'],['Annular',()=>'open'],['Pipe rams / blind rams',()=>'open / open'],['Wellbore pressure psi',()=>(S.prof?S.prof.ann:0).toFixed(0)]]})};
let blockY=0;
function frame2(dt){ // reeving: N lines between crown sheaves and travelling block
 if(reeve&&tdA){const n=DES?DES.lines:10,top=C.FLOOR+C.MH+1.35,b=new THREE.Vector3();C.tdAll.children[0].getWorldPosition(b);const y=b.y+2.2,pts=[];
  for(let i=0;i<n;i++){const z=-1.2+2.4*i/(n-1);pts.push(new THREE.Vector3(i%2?0.35:-0.35,top,z),new THREE.Vector3(i%2?0.35:-0.35,y,z*0.35))}reeve.geometry.setFromPoints(pts)}
 camFrame(dt);feedBadge();if(seqTreeEl&&seqTreeEl.style.display!='none')renderTree()}
// ---------------- camera modes ----------------
let camMode='orbit',keys={},yaw=0,pitch=0,drag=null;
function camModes(){const hud=$('hud');const wrap=el('span','display:inline-flex;gap:2px;align-items:center','<span style="color:#cde">Camera</span>');
 camBtns=['orbit','walk','bit'].map(m=>{const b=el('button','',m=='orbit'?'Orbit':m=='walk'?'Walk floor':'Follow bit');b.id='cam_'+m;b.onclick=()=>setCam(m);wrap.appendChild(b);return b});hud.appendChild(wrap);
 addEventListener('keydown',e=>{if(e.target.tagName=='INPUT'||e.target.tagName=='TEXTAREA')return;keys[e.key.toLowerCase()]=1});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=0);
 const cv=C.ren.domElement;cv.addEventListener('pointerdown',e=>{if(camMode=='walk')drag=[e.clientX,e.clientY]});addEventListener('pointerup',()=>drag=null);
 cv.addEventListener('pointermove',e=>{if(camMode=='walk'&&drag){yaw-=(e.clientX-drag[0])*0.004;pitch=Math.max(-1.3,Math.min(1.3,pitch-(e.clientY-drag[1])*0.004));drag=[e.clientX,e.clientY]}});setCam('orbit')}
function setCam(m){camMode=m;camBtns.forEach(b=>b.classList.toggle('on',b.id=='cam_'+m));const {cam,ctl,FLOOR}=C;
 if(m=='orbit'){ctl.enabled=true;C.setUnder(false)}
 if(m=='walk'){C.setUnder(false);ctl.enabled=false;cam.position.set(6.2,FLOOR+1.7,2.2);yaw=1.75;pitch=0.25;PH.ev(S,'Walk mode: WASD / arrows move, drag to look, Q/E down/up')}
 if(m=='bit'){C.setUnder(true);ctl.enabled=true;PH.ev(S,'Follow-bit camera: wellbore path in green, drilled hole in orange')}}
function camFrame(dt){const {cam,ctl,FLOOR}=C;
 if(camMode=='walk'){const sp=4*Math.min(0.1,dt||0.016),f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(-f.z,0,f.x);
  if(keys.w||keys.arrowup)cam.position.addScaledVector(f,sp);if(keys.s||keys.arrowdown)cam.position.addScaledVector(f,-sp);if(keys.d||keys.arrowright)cam.position.addScaledVector(r,sp);if(keys.a||keys.arrowleft)cam.position.addScaledVector(r,-sp);
  if(keys.e)cam.position.y+=sp;if(keys.q)cam.position.y=Math.max(FLOOR+0.8,cam.position.y-sp);
  const t=cam.position.clone().add(new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)));ctl.target.copy(t);cam.lookAt(t)}
 if(camMode=='bit'){const p=new THREE.Vector3();C.bha.getWorldPosition(p);const q=new THREE.Vector3(0,-1,0).applyQuaternion(C.bha.getWorldQuaternion(new THREE.Quaternion()));
  const want=p.clone().addScaledVector(q,-7).add(new THREE.Vector3(5,3,5));cam.position.lerp(want,0.08);ctl.target.lerp(p,0.2)}}
// ======================= 2. LIVE FEED =======================
const FKEY='dw32-feed-v1';
const WITS={SPPA:'spp',SPP:'spp',MFIA:'Q',TFLO:'Q',FLOWIN:'Q',HKLA:'hook',HKLD:'hook',SWOB:'wob',WOBA:'wob',RPMA:'rpm',TRPM:'rpm',DMEA:'md',DEPTMEAS:'md',DBTM:'md',BPOS:'quill',BLKPOS:'quill',SLIPS:'slips'};
let FCFG={mode:'ws',url:'ws://localhost:8795/ws',interval_ms:1000,stale_s:5,witsml:true,
 map:{spp:'spp_psi',Q:'flow_gpm',hook:'hookload_klbf',wob:'wob_klbf',rpm:'td_rpm',md:'md_ft',quill:'quill_m',slips:'slips'},
 scale:{quill:1}};
try{Object.assign(FCFG,JSON.parse(localStorage.getItem(FKEY)||'{}'))}catch{}
const FS={vals:{},last:0,status:'not connected',ws:null,timer:null,msgs:0,src:null};
function ingest(obj){if(!obj||typeof obj!='object')return;let flat={};
 // WITSML-style: {logData:{mnemonicList:"A,B",data:["1,2"]}} or {mnemonics:[...],data:[[...]]} or {curves:[{mnemonic,value}]}
 const ld=obj.logData||obj.log||obj;if(ld.mnemonicList&&ld.data){const m=ld.mnemonicList.split(',').map(s=>s.trim()),d=String(ld.data.at(-1)).split(',');m.forEach((k,i)=>flat[k]=+d[i])}
 else if(Array.isArray(ld.mnemonics)&&Array.isArray(ld.data)){const d=ld.data.at(-1);ld.mnemonics.forEach((k,i)=>flat[k]=+d[i])}
 else if(Array.isArray(obj.curves)){obj.curves.forEach(c=>flat[c.mnemonic]=+c.value)}else flat=obj;
 FS.raw=flat;if(flat.source)FS.src=flat.source;
 let got=0;for(const [sig,field] of Object.entries(FCFG.map)){if(field&&flat[field]!=null&&flat[field]!==''){FS.vals[sig]=+flat[field]*(FCFG.scale[sig]||1);got++}}
 if(FCFG.witsml)for(const [tag,sig] of Object.entries(WITS))if(flat[tag]!=null){FS.vals[sig]=+flat[tag];got++}
 if(got){FS.last=performance.now();FS.msgs++;if(FS.status!='live')setStatus('live')}}
function setStatus(s){FS.status=s;C.FEED.status=s+(FS.src?' · '+FS.src:'');C.sigRender()}
function feedConnect(cfg){if(cfg)Object.assign(FCFG,cfg);localStorage.setItem(FKEY,JSON.stringify(FCFG));feedDisconnect(true);setStatus('connecting');
 if(FCFG.mode=='ws'){try{const ws=new WebSocket(FCFG.url);FS.ws=ws;ws.onopen=()=>setStatus('connected, waiting for data');ws.onmessage=m=>{try{ingest(JSON.parse(m.data))}catch{}};ws.onerror=()=>setStatus('error, using sim');ws.onclose=()=>{if(FS.ws===ws){FS.ws=null;setStatus('closed, using sim')}}}catch(e){setStatus('error: '+e.message)}}
 else{const poll=async()=>{try{const r=await fetch(FCFG.url,{cache:'no-store'});ingest(await r.json())}catch(e){if(FS.status!='poll error, using sim')setStatus('poll error, using sim')}};poll();FS.timer=setInterval(poll,Math.max(200,FCFG.interval_ms))}
 PH.ev(S,'Live feed connecting: '+FCFG.mode.toUpperCase()+' '+FCFG.url);return true}
function feedDisconnect(quiet){if(FS.ws){const w=FS.ws;FS.ws=null;w.close()}if(FS.timer){clearInterval(FS.timer);FS.timer=null}if(!quiet)setStatus('not connected');FS.vals={}}
function feedStale(){if(window.WML&&window.WML.log&&!FS.ws&&!FS.timer)return;if(FS.status=='live'&&performance.now()-FS.last>FCFG.stale_s*1000){setStatus('stale, fell back to sim');PH.ev(S,'Live feed stale: signals fall back to SIMULATED')}}
function feedInit(){const F=C.FEED,col2sig=()=>Object.fromEntries(Object.entries(C.SIGS).map(([k,v])=>[v[0],k]));
 F.status='not connected';F.connect=url=>feedConnect({url,mode:/^wss?:/.test(url)?'ws':'http'});F.disconnect=()=>feedDisconnect();
 F.value=col=>{if(FS.status!='live')return null;const k=col2sig()[col];return k in FS.vals?FS.vals[k]:null};F.openConfig=openFeedCfg;F.state=FS;
 const b=el('span','display:inline-flex;align-items:center;gap:4px;background:#0009;padding:3px 7px;border-radius:4px;color:#cde;cursor:pointer','<span id="fdot" style="width:9px;height:9px;border-radius:50%;background:#777;display:inline-block"></span><span id="ftxt">Feed: sim</span>');b.title='Live feed settings';b.onclick=openFeedCfg;$('hud').appendChild(b)}
function feedBadge(){const d=$('fdot');if(!d)return;const s=FS.status;d.style.background=s=='live'?'#3d3':/connect/.test(s)?'#fc3':/error|stale|closed/.test(s)?'#e44':'#777';
 const sim=/SIMULATED/i.test(FS.src||'');if(s=='live'&&sim)d.style.background='#fa0';const t=s=='live'&&sim?'Feed: SIMULATED TEST '+Object.keys(FS.vals).length+' sig':s=='live'?'Feed: LIVE '+Object.keys(FS.vals).length+' sig':'Feed: '+s.split(',')[0];if($('ftxt').textContent!=t)$('ftxt').textContent=t}
let fcEl;function openFeedCfg(){if(fcEl){fcEl.remove();fcEl=null;return}fcEl=el('div',PANEL+';left:50%;top:60px;transform:translateX(-50%);width:420px');fcEl.id='feedcfg';
 fcEl.innerHTML=`<b style="color:#8fd">Live feed adapter</b> <small>(any signal with source "live" uses it; stale or failed feed falls back to SIMULATED)</small><br>
 Mode <select id="fmode"><option value="ws">WebSocket (push JSON)</option><option value="http">HTTP polling (GET JSON)</option></select> every <input id="fint" style="width:50px" value="${FCFG.interval_ms}"> ms<br>
 URL <input id="furl" style="width:330px" value="${FCFG.url}"><br>
 <label><input type=checkbox id="fwits" ${FCFG.witsml?'checked':''}> WITSML-style tag mapping (SPPA, MFIA/TFLO, HKLA, SWOB, RPMA, DMEA, BPOS; logData mnemonicList/data accepted)</label><br>
 <b>Field mapping</b> (signal ← JSON field)<div style="display:grid;grid-template-columns:90px 1fr;gap:2px">${Object.keys(C.SIGS).map(k=>`<span>${C.SIGS[k][0]}</span><input data-fm="${k}" value="${FCFG.map[k]||''}">`).join('')}</div>
 <button id="fgo" style="${BTN}">Connect</button><button id="fstop" style="${BTN}">Disconnect</button><button id="flive" style="${BTN}">Set all mapped signals to live</button><button id="fsim" style="${BTN}">All back to sim</button><button id="fx" style="${BTN}">Close</button>
 <div style="margin-top:4px;color:#fd8">Status: <span id="fst">${FS.status}</span> · msgs ${FS.msgs}</div><small>Test: run <code>node feed_server.mjs</code> (streams sample_sequence.csv, SIMULATED) → ws://localhost:8795/ws or http://localhost:8795/latest (add ?fmt=witsml).</small>`;
 document.body.appendChild(fcEl);$('fmode').value=FCFG.mode;
 const read=()=>{FCFG.mode=$('fmode').value;FCFG.url=$('furl').value.trim();FCFG.interval_ms=+$('fint').value||1000;FCFG.witsml=$('fwits').checked;fcEl.querySelectorAll('[data-fm]').forEach(i=>FCFG.map[i.dataset.fm]=i.value.trim())};
 $('fgo').onclick=()=>{read();feedConnect()};$('fstop').onclick=()=>feedDisconnect();$('fx').onclick=openFeedCfg;
 $('flive').onclick=()=>{for(const k in C.SIGS)if(FCFG.map[k]||Object.values(WITS).includes(k))C.SRC[k]='live';C.sigRender()};$('fsim').onclick=()=>{for(const k in C.SRC)C.SRC[k]='sim';C.sigRender()}}
// ======================= 3. RIG DESIGNER + 4. MUD PUMPS =======================
const DKEY='dw32-design-v1';
const PUMP_TYPES={
 'Triplex 1600 HP (12in)':{modules:3,stroke_in:12,max_spm:120,hp:1600,liners:[5,5.5,6,6.5,7],fluid_end_psi:7500},
 'Triplex 1000 HP (10in)':{modules:3,stroke_in:10,max_spm:140,hp:1000,liners:[4.5,5,5.5,6,6.5],fluid_end_psi:5000},
 'Triplex 2200 HP (14in)':{modules:3,stroke_in:14,max_spm:105,hp:2200,liners:[5.5,6,6.5,7,7.5],fluid_end_psi:7500},
 'Quintuplex 2500 HP (11in)':{modules:5,stroke_in:11,max_spm:150,hp:2500,liners:[4.5,5,5.5,6],fluid_end_psi:7500}};
const WIRE={1.25:162,1.375:192,1.5:228,1.625:264};// breaking strength klbf (EIPS IWRC approx)
const DP={'4in 14.0 ppf':{od:4,id:3.34,ppf:15.5},'4-1/2in 16.6 ppf':{od:4.5,id:3.826,ppf:19.5},'5in 19.5 ppf':{od:5,id:4.276,ppf:22.6},'5-1/2in 21.9 ppf':{od:5.5,id:4.778,ppf:25.6}};
const MOTORS={'6-3/4in 4/5 lobe':{rev_per_gal:0.16,stall_torque:3500,dp_off:150,torque_per_psi:5,bur:6,max_gpm:900},'4-3/4in 7/8 lobe':{rev_per_gal:0.5,stall_torque:1800,dp_off:120,torque_per_psi:2.2,bur:8,max_gpm:300},'8in 5/6 lobe':{rev_per_gal:0.12,stall_torque:9000,dp_off:180,torque_per_psi:12,bur:4,max_gpm:1200}};
const DEF={name:'Land rig 1500 HP (default)',derrick_klbf:750,dw_hp:1500,lines:10,wire_in:1.375,td_torque:40000,td_rpm:180,bop_psi:10000,
 pumps:[{type:'Triplex 1600 HP (12in)',liner_in:6},{type:'Triplex 1600 HP (12in)',liner_in:6}],dp:'4-1/2in 16.6 ppf',motor:'6-3/4in 4/5 lobe',mwd_dp600:120,bit_in:8.5,nozzles:6,noz_32:14,mw_ppg:10};
let DES=null;
function derive(d=DES){const sf=3,eff=Math.max(0.7,1-0.0125*d.lines);// sheave efficiency approx
 const wire_hook=WIRE[d.wire_in]*d.lines*eff/sf,hook_rating=Math.min(d.derrick_klbf,wire_hook);
 const pumps=d.pumps.map(p=>{const T=PUMP_TYPES[p.type];const gps=0.000243*p.liner_in**2*T.stroke_in*42*T.modules/3;const qmax=gps*T.max_spm*0.95;const pmax=Math.min(T.fluid_end_psi,T.hp*1714*0.9/qmax);return{...p,T,gps,qmax,pmax}});
 const qmax=pumps.reduce((a,p)=>a+p.qmax,0),pmax=Math.min(...pumps.map(p=>p.pmax),Infinity);
 const D=DP[d.dp],M=MOTORS[d.motor],td_hp=d.td_torque*d.td_rpm/5252,hhp=pumps.reduce((a,p)=>a+p.T.hp,0);
 const string_klbf=PH.PLAN.td_md*D.ppf*(1-d.mw_ppg/65.5)/1000+35;
 const ds_k=1.3e-6*(3.826/D.id)**4.8;
 const tfa=d.nozzles*Math.PI/4*(d.noz_32/32)**2;
 const est=Q=>{const L=PH.P.line,e=1.8;return L.man_k*Q*Q+L.surf_k_ft*Q**e*L.surf_len+ds_k*Q**e*PH.PLAN.td_md+L.ann_k_ft*Q**e*PH.PLAN.td_md+d.mw_ppg*Q*Q/(12032*0.95**2*tfa**2)+M.dp_off+1500/M.torque_per_psi+d.mwd_dp600*(Q/600)**2};
 const qop=Math.min(qmax,M.max_gpm),spp_op=est(qop),hoist_mps=d.dw_hp*550*0.8/(string_klbf*1000)*0.3048;
 const W=[];
 if(wire_hook<d.derrick_klbf)W.push(`Drill line limits hookload to ${wire_hook.toFixed(0)} klbf (< derrick ${d.derrick_klbf}). Add lines or bigger wire.`);
 if(string_klbf>0.9*hook_rating)W.push(`String weight at TD ${string_klbf.toFixed(0)} klbf is over 90% of rated hookload ${hook_rating.toFixed(0)} klbf.`);
 if(d.dw_hp<d.derrick_klbf*1.2)W.push(`Drawworks ${d.dw_hp} HP is light for a ${d.derrick_klbf} klbf derrick (rule of thumb ≥ ${(d.derrick_klbf*1.2).toFixed(0)} HP).`);
 if(pmax>d.bop_psi)W.push(`Pump pressure ${pmax.toFixed(0)} psi exceeds BOP rating ${d.bop_psi} psi.`);
 if(spp_op>pmax)W.push(`Est. SPP ${spp_op.toFixed(0)} psi at ${qop.toFixed(0)} gpm exceeds pump pressure limit ${pmax.toFixed(0)} psi: reduce flow, bigger nozzles or larger DP.`);
 if(qmax<M.max_gpm*0.5)W.push(`Pump capacity ${qmax.toFixed(0)} gpm is under half the motor rating ${M.max_gpm} gpm.`);
 if(qmax>M.max_gpm*1.25)W.push(`Pumps can deliver ${qmax.toFixed(0)} gpm, well over motor max ${M.max_gpm} gpm (run pumps throttled).`);
 if(PH.P.td.max_rpm&&d.td_torque<1500+0.8*PH.PLAN.td_md+M.stall_torque)W.push(`Top drive torque ${d.td_torque} ft-lbf may stall at TD (need ~${(1500+0.8*PH.PLAN.td_md+M.stall_torque).toFixed(0)}).`);
 if(D.od+2>d.bit_in)W.push('Drill pipe too large for the bit / hole size.');
 if(!pumps.length)W.push('No mud pumps: no circulation possible.');
 return{hook_rating,wire_hook,eff,pumps,qmax,pmax,td_hp,hhp,string_klbf,ds_k,tfa,qop,spp_op,hoist_mps,W,D,M}}
function applyDesign(d=DES,quiet){DES=d;const r=derive(d),P=PH.P;
 P.design={hook_rating:r.hook_rating,dw_hp:d.dw_hp};P.td.max_rpm=d.td_rpm;P.td.max_torque=d.td_torque;P.line.ds_k_ft=r.ds_k;P.string.w_ppf=r.D.ppf;
 Object.assign(P.motor,r.M);P.mwd.dp600=d.mwd_dp600;Object.assign(P.bit,{dia_in:d.bit_in,nozzles:d.nozzles,noz_32:d.noz_32});P.mud.mw_ppg=d.mw_ppg;
 // pumps: match count, then set per-pump params
 while(C.pumpsArr.length>d.pumps.length)C.removeEnt(C.pumpsArr[C.pumpsArr.length-1]);
 while(C.pumpsArr.length<d.pumps.length)C.addEquip('mudpump',null,{on:true,cmd:100});
 C.pumpsArr.forEach((e,i)=>{const p=r.pumps[i];Object.assign(e.st,{ptype:p.type,liner_in:p.liner_in,stroke_in:p.T.stroke_in,modules:p.T.modules,max_spm:p.T.max_spm,popoff:Math.min(p.pmax,d.bop_psi)*1.1,hp:p.T.hp})});
 localStorage.setItem(DKEY,JSON.stringify(d));if(!quiet)PH.ev(S,'Rig design applied: '+d.name+(r.W.length?` (${r.W.length} warnings)`:''));if(dEl&&dEl.style.display!='none')renderDesigner();return r}
function setDesign(patch){return applyDesign({...JSON.parse(JSON.stringify(DES)),...patch})}
function addPumpType(type,liner){const T=PUMP_TYPES[type];if(!T)throw new Error('unknown pump type');const d=JSON.parse(JSON.stringify(DES));d.pumps.push({type,liner_in:liner||T.liners[2]});applyDesign(d);return C.pumpsArr.at(-1)}
let dEl;
function designerInit(){let d=DEF;try{const s=JSON.parse(localStorage.getItem(DKEY)||'null');if(s&&s.pumps)d=s}catch{}
 // keep designer pump list in sync with pumps already present (layout restore)
 d=JSON.parse(JSON.stringify(d));while(d.pumps.length<C.pumpsArr.length)d.pumps.push({...d.pumps[0]||DEF.pumps[0]});d.pumps.length=C.pumpsArr.length||d.pumps.length;
 applyDesign(d,true);
 const b=el('button','','Rig designer');b.id='dsgbtn';b.onclick=()=>{dEl.style.display=dEl.style.display=='none'?'block':'none';renderDesigner()};$('hud').appendChild(b);
 dEl=el('div',PANEL+';left:8px;top:84px;width:470px;max-height:78vh;overflow:auto;display:none');dEl.id='designer';document.body.appendChild(dEl);
 // keep design pump list in sync when user adds/removes pumps from the equipment menu
 setInterval(()=>{if(C.pumpsArr.length!=DES.pumps.length){const d=JSON.parse(JSON.stringify(DES));while(d.pumps.length<C.pumpsArr.length)d.pumps.push({type:DEF.pumps[0].type,liner_in:6});d.pumps.length=C.pumpsArr.length;applyDesign(d,true)}},1000)}
function renderDesigner(){const d=DES,r=derive(d);const opt=(o,v)=>Object.keys(o).map(k=>`<option ${k==v?'selected':''}>${k}</option>`).join('');
 const num=(k,lab,step=1)=>`<label>${lab} <input data-d="${k}" type=number step=${step} value="${d[k]}" style="width:70px"></label> `;
 dEl.innerHTML=`<b style="color:#8fd">Rig designer</b> <span style="color:#fc6">engineering estimates, SIMULATED physics</span> <button id="dx" style="${BTN};float:right">×</button><br>
 Name <input data-ds="name" value="${d.name}" style="width:250px"><br>
 <b>Hoisting</b><br>${num('derrick_klbf','Derrick rating klbf',50)}${num('dw_hp','Drawworks HP',100)}<label>Lines <select data-dn="lines">${[6,8,10,12,14].map(v=>`<option ${v==d.lines?'selected':''}>${v}</option>`).join('')}</select></label> <label>Wire in <select data-dn="wire_in">${Object.keys(WIRE).map(v=>`<option ${+v==d.wire_in?'selected':''}>${v}</option>`).join('')}</select></label><br>
 <b>Rotation</b><br>${num('td_torque','Top drive torque ft-lbf',1000)}${num('td_rpm','Max RPM',10)}<br>
 <b>Well control</b><br><label>BOP <select data-dn="bop_psi">${[3000,5000,10000,15000].map(v=>`<option ${v==d.bop_psi?'selected':''}>${v}</option>`).join('')}</select> psi</label><br>
 <b>Mud pumps</b> (${d.pumps.length})<table style="width:100%;font-size:11px">${r.pumps.map((p,i)=>`<tr><td>#${i+1}</td><td><select data-pt="${i}">${opt(PUMP_TYPES,p.type)}</select></td><td>liner <select data-pl="${i}">${p.T.liners.map(l=>`<option ${l==p.liner_in?'selected':''}>${l}</option>`).join('')}</select></td><td>${p.qmax.toFixed(0)} gpm · ${p.pmax.toFixed(0)} psi</td><td><button data-prm="${i}" style="${BTN}">−</button></td></tr>`).join('')}</table>
 <select id="dnewp">${opt(PUMP_TYPES)}</select><button id="daddp" style="${BTN}">+ Add mud pump</button><br>
 <b>Drillstring / BHA</b><br><label>Drill pipe <select data-dsel="dp">${opt(DP,d.dp)}</select></label> <label>Motor <select data-dsel="motor">${opt(MOTORS,d.motor)}</select></label><br>${num('mwd_dp600','MWD ΔP@600gpm psi',10)}${num('bit_in','Bit in',0.25)}${num('nozzles','Nozzles')}${num('noz_32','Nozzle /32')}${num('mw_ppg','Mud ppg',0.1)}<br>
 <b>Derived capacities</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 10px">
 <span>Rated hookload</span><b>${r.hook_rating.toFixed(0)} klbf</b><span>Drill-line limit (${d.lines} lines, eff ${(r.eff*100).toFixed(0)}%)</span><b>${r.wire_hook.toFixed(0)} klbf</b>
 <span>String weight at TD (${PH.PLAN.td_md} ft)</span><b>${r.string_klbf.toFixed(0)} klbf</b><span>Hoist speed at TD weight</span><b>${r.hoist_mps.toFixed(2)} m/s</b>
 <span>Top drive power</span><b>${r.td_hp.toFixed(0)} HP</b><span>Total pump hydraulic HP</span><b>${r.hhp} HP</b>
 <span>Max flow (all pumps)</span><b>${r.qmax.toFixed(0)} gpm</b><span>Max pump pressure</span><b>${r.pmax.toFixed(0)} psi</b>
 <span>Est. SPP at ${r.qop.toFixed(0)} gpm</span><b>${r.spp_op.toFixed(0)} psi</b><span>Bit TFA</span><b>${r.tfa.toFixed(3)} in²</b></div>
 <div style="color:${r.W.length?'#f96':'#8f8'};margin-top:3px">${r.W.length?r.W.map(w=>'⚠ '+w).join('<br>'):'✓ No validation warnings'}</div>
 <button id="dsave" style="${BTN}">Save design JSON</button><button id="dload" style="${BTN}">Load design JSON</button><button id="ddef" style="${BTN}">Reset default</button><button id="dlight" style="${BTN}">Example: light 750 HP rig</button>
 <div style="color:#9ab;margin-top:2px"><small>Changes apply live to the physics: hookload interlock, hoist speed, TD torque/RPM limits, pump flow and pop-off, string losses, motor, MWD, bit.</small></div>`;
 const up=f=>{const n=JSON.parse(JSON.stringify(DES));f(n);applyDesign(n);renderDesigner()};
 dEl.querySelector('#dx').onclick=()=>dEl.style.display='none';
 dEl.querySelectorAll('[data-d]').forEach(i=>i.onchange=()=>up(n=>n[i.dataset.d]=+i.value));
 dEl.querySelectorAll('[data-dn]').forEach(i=>i.onchange=()=>up(n=>n[i.dataset.dn]=+i.value));
 dEl.querySelectorAll('[data-ds],[data-dsel]').forEach(i=>i.onchange=()=>up(n=>n[i.dataset.ds||i.dataset.dsel]=i.value));
 dEl.querySelectorAll('[data-pt]').forEach(i=>i.onchange=()=>up(n=>{const T=PUMP_TYPES[i.value];n.pumps[+i.dataset.pt]={type:i.value,liner_in:T.liners[2]}}));
 dEl.querySelectorAll('[data-pl]').forEach(i=>i.onchange=()=>up(n=>n.pumps[+i.dataset.pl].liner_in=+i.value));
 dEl.querySelectorAll('[data-prm]').forEach(b=>b.onclick=()=>{const k=+b.dataset.prm,e=C.pumpsArr[k];if(e){C.removeEnt(e);const n=JSON.parse(JSON.stringify(DES));n.pumps.splice(k,1);applyDesign(n);renderDesigner()}});
 dEl.querySelector('#daddp').onclick=()=>{addPumpType(dEl.querySelector('#dnewp').value);renderDesigner()};
 dEl.querySelector('#dsave').onclick=()=>dl(JSON.stringify({format:'drilling-world-rig-design',version:1,design:DES,derived:(({W,hook_rating,qmax,pmax,td_hp,string_klbf})=>({hook_rating,qmax,pmax,td_hp,string_klbf,warnings:W}))(derive())},null,1),(DES.name||'rig').replace(/\W+/g,'_')+'.rig.json');
 dEl.querySelector('#dload').onclick=()=>pick('.json',t=>{const j=JSON.parse(t);applyDesign(j.design||j);renderDesigner()});
 dEl.querySelector('#ddef').onclick=()=>{applyDesign(JSON.parse(JSON.stringify(DEF)));renderDesigner()};
 dEl.querySelector('#dlight').onclick=()=>{applyDesign({...JSON.parse(JSON.stringify(DEF)),name:'Light land rig 750 HP',derrick_klbf:365,dw_hp:750,lines:8,wire_in:1.25,td_torque:20000,td_rpm:150,bop_psi:5000,pumps:[{type:'Triplex 1000 HP (10in)',liner_in:5.5}],dp:'4in 14.0 ppf',motor:'4-3/4in 7/8 lobe',bit_in:6.125,noz_32:12});renderDesigner()}}
function dl(text,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;a.click()}
function pick(acc,cb){const i=document.createElement('input');i.type='file';i.accept=acc;i.onchange=async()=>{if(i.files[0])try{cb(await i.files[0].text())}catch(e){alert('Invalid file: '+e.message)}};i.click()}
// ======================= 5. SEQUENCE EDITOR (steps + nested sub-sequences) =======================
// Step types: {t:'action',do:'slipset|sliprel|roughin|roughout|break|make|pumpson|drill'} (interlock-checked)
// {t:'set',path:'dw.mode',value:'hoist'} {t:'pumps',spm:100,on:true} {t:'delay',s:5}
// {t:'wait',signal:'dw.quill',op:'>=',value:20} or {t:'wait',cond:'S.Q<20'} (+ timeout s)  {t:'call',seq:'Set slips',args:{}}
// Any step: label, interlock (guard name), min (s). Values "$name" take sequence params (defaults in params, overridden by call args).
const QKEY='dw32-seqlib-v1';
const BUILTIN={
 'Stop and pick up':{params:{},steps:[{t:'set',path:'dw.mode',value:'hold',label:'Hold block'},{t:'set',path:'autoSteer',value:false},{t:'pumps',on:false,label:'Pumps off'},{t:'wait',signal:'Q',op:'<',value:20},{t:'set',path:'td.cmd',value:0,label:'Stop rotation'},{t:'wait',signal:'td.rpm',op:'<',value:2},
  {t:'set',path:'dw.mode',value:'hoist',label:'Pick up off bottom'},{t:'wait',cond:'S.dw.quill>=Math.min((S.L-S.md)*0.3048+1,30)',label:'Wait: bit 1 m off bottom',timeout:120},{t:'set',path:'dw.mode',value:'hold'}]},
 'Set slips':{steps:[{t:'action',do:'slipset',label:'Set slips (interlock: off bottom, no rotation)'},{t:'delay',s:3}]},
 'Break out':{steps:[{t:'action',do:'roughin',label:'Iron roughneck in'},{t:'delay',s:2},{t:'action',do:'break',label:'Break out connection'},{t:'wait',cond:'!S.rnOp&&!S.connected',label:'Wait: broken out',timeout:30},{t:'action',do:'roughout',label:'Roughneck out'}]},
 'Pick up stand':{steps:[{t:'set',path:'dw.mode',value:'hoist',label:'Hoist top drive'},{t:'wait',cond:'S.dw.quill>=S.stickup+27.6',label:'Wait: top drive at racking height',timeout:180},{t:'set',path:'dw.mode',value:'hold'},
  {t:'set',path:'catwalk',value:1,label:'Catwalk delivers stand'},{t:'delay',s:8},{t:'set',path:'newJoint',value:1,label:'Latch elevators, stab'},{t:'set',path:'catwalk',value:0},{t:'set',path:'dw.mode',value:'lower',label:'Lower into box'},{t:'wait',cond:'S.dw.quill<=S.stickup+27.4',timeout:60},{t:'set',path:'dw.mode',value:'hold'}]},
 'Make up':{steps:[{t:'action',do:'roughin',label:'Iron roughneck in'},{t:'delay',s:2},{t:'action',do:'make',label:'Spin + torque connection'},{t:'wait',cond:'!S.rnOp&&S.connected',label:'Wait: made up',timeout:30},{t:'action',do:'roughout',label:'Roughneck out'}]},
 'Pull slips':{steps:[{t:'action',do:'sliprel',label:'Release slips (interlock: connected, roughneck out)'},{t:'delay',s:2}]},
 'Resume drilling':{params:{spm:100,rpm:60},steps:[{t:'action',do:'pumpson',label:'Pumps on'},{t:'pumps',spm:'$spm',on:true},{t:'wait',signal:'Q',op:'>',value:300,timeout:60},{t:'set',path:'td.cmd',value:'$rpm',label:'Rotate'},{t:'set',path:'dw.mode',value:'auto',label:'Auto-drill to bottom'},{t:'set',path:'autoSteer',value:true},{t:'delay',s:5}]},
 'Make connection':{params:{spm:100,rpm:60},steps:[{t:'call',seq:'Stop and pick up'},{t:'call',seq:'Set slips'},{t:'call',seq:'Break out'},{t:'call',seq:'Pick up stand'},{t:'call',seq:'Make up'},{t:'call',seq:'Pull slips'},{t:'call',seq:'Resume drilling',args:{spm:'$spm',rpm:'$rpm'}}]},
 'Drill stand + connect':{steps:[{t:'set',path:'dw.mode',value:'auto',label:'Auto-drill stand down',interlock:'drill'},{t:'wait',cond:'!!S._sd',label:'Wait: stand drilled down',timeout:20000},{t:'call',seq:'Make connection',args:{spm:110,rpm:70}}]},
 'Pump ramp test':{params:{top:120},steps:[{t:'pumps',spm:40,on:true},{t:'delay',s:15},{t:'pumps',spm:80},{t:'delay',s:15},{t:'pumps',spm:'$top'},{t:'wait',signal:'spp',op:'>',value:500,timeout:60},{t:'delay',s:15}]}};
let SEQLIB={};
function loadSeqLib(){let u={};try{u=JSON.parse(localStorage.getItem(QKEY)||'{}')}catch{}SEQLIB={...JSON.parse(JSON.stringify(BUILTIN)),...u};for(const k in BUILTIN)SEQLIB[k]._builtin=!(k in u)}
function saveSeqLib(){const u={};for(const k in SEQLIB)if(!SEQLIB[k]._builtin)u[k]=SEQLIB[k];localStorage.setItem(QKEY,JSON.stringify(u));registerAll()}
const getP=(path)=>path.split('.').reduce((o,k)=>o==null?o:o[k],S);
const setP=(path,v)=>{const k=path.split('.');let o=S;for(const x of k.slice(0,-1))o=o[x];o[k.at(-1)]=v};
const OPS={'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'==':(a,b)=>a==b,'!=':(a,b)=>a!=b};
function sub(v,P){return typeof v=='string'&&v[0]=='$'?(v.slice(1) in P?P[v.slice(1)]:v):v}
function stepLabel(s,P){if(s.label)return s.label;const v=x=>sub(x,P);switch(s.t){case 'action':return 'Action: '+s.do;case 'set':return `Set ${s.path} = ${v(s.value)}`;case 'pumps':return `Pumps ${s.on===false?'off':'on'}${s.spm!=null?' @ '+v(s.spm)+' SPM':''}`;case 'delay':return `Wait ${v(s.s)} s`;
 case 'wait':return s.cond?'Wait until '+s.cond:`Wait until ${s.signal} ${s.op} ${v(s.value)}`;case 'call':return '▸ '+s.seq}return s.t}
// compile -> {flat:[physics step tuples], tree:{label,kids,leaf index}}
function compileSeq(name,args={},depth=0,flat=[],stack=[]){const D=SEQLIB[name];if(!D)throw new Error('Unknown sequence: '+name);if(stack.includes(name))throw new Error('Recursive call: '+[...stack,name].join(' > '));
 const P={...(D.params||{}),...Object.fromEntries(Object.entries(args).map(([k,v])=>[k,v]))};const node={label:name+(Object.keys(P).length?' ('+Object.entries(P).map(([k,v])=>k+'='+v).join(', ')+')':''),kids:[],from:flat.length};
 for(const s of D.steps){if(s.t=='call'){const a=Object.fromEntries(Object.entries(s.args||{}).map(([k,v])=>[k,sub(v,P)]));node.kids.push(compileSeq(s.seq,a,depth+1,flat,[...stack,name]).tree);continue}
  const lab=stepLabel(s,P),min=+sub(s.min??(s.t=='delay'?s.s:s.t=='action'?1:0),P)||0,to=+sub(s.timeout,P)||0;let start=()=>{},done=()=>true,guard=s.interlock||null;
  if(s.t=='action'){guard=guard||s.do;start=S_=>{PH.doAct(S_,s.do)};done=S_=>!(S_.rnOp)}
  else if(s.t=='set'){const v=sub(s.value,P);start=()=>setP(s.path,v)}
  else if(s.t=='pumps'){const spm=sub(s.spm,P);start=S_=>S_.pumps.forEach(p=>{if(s.on!==undefined)p.on=!!s.on;if(spm!=null)p.cmd=+spm})}
  else if(s.t=='wait'){const f=s.cond?new Function('S','return ('+s.cond+')'):(S_=>OPS[s.op||'>='](getP(s.signal),+sub(s.value,P)));
   done=S_=>{if(f(S_))return true;if(to&&S_.seq&&S_.t-S_.seq.t0>to){PH.ev(S_,'Sequence aborted: timeout on "'+lab+'"');S_.seq=null}return false}}
  node.kids.push({label:lab,leaf:flat.length});flat.push([lab,start,done,min,null,guard])}
 node.to=flat.length;return{flat,tree:node}}
let lastTree=null;
function registerAll(){for(const k in PH.SEQUENCES)if(k.startsWith('u:'))delete PH.SEQUENCES[k];for(const k in SEQLIB)PH.SEQUENCES['u:'+k]={label:'★ '+k,build:()=>{const c=compileSeq(k);lastTree=c.tree;return c.flat}};
 const sel=$('sqsel');if(sel){[...sel.options].filter(o=>o.value.startsWith('u:')).forEach(o=>o.remove());const csv=[...sel.options].find(o=>o.value=='csv');for(const k in SEQLIB){const o=document.createElement('option');o.value='u:'+k;o.textContent='★ '+k;sel.insertBefore(o,csv)}}}
function runUserSeq(name,stepMode=false){if(S.seq){PH.ev(S,'A sequence is already running');return false}const c=compileSeq(name);lastTree=c.tree;const ok=PH.startSeq(S,'u:'+name,stepMode);if(ok)lastTree=c.tree;seqTreeEl.style.display='block';return ok}
let seqEdEl,seqTreeEl,cur=null;
function seqEditorInit(){loadSeqLib();registerAll();
 const b=el('button','','Sequence editor');b.id='seqedbtn';b.onclick=()=>{seqEdEl.style.display=seqEdEl.style.display=='none'?'block':'none';renderEd()};$('hud').appendChild(b);
 seqEdEl=el('div',PANEL+';left:490px;top:84px;width:470px;max-height:80vh;overflow:auto;display:none');seqEdEl.id='seqeditor';document.body.appendChild(seqEdEl);
 seqTreeEl=el('div',PANEL+';left:345px;bottom:40px;width:330px;max-height:45vh;overflow:auto;display:none');seqTreeEl.id='seqtree';document.body.appendChild(seqTreeEl);cur=Object.keys(SEQLIB).find(k=>k=='Make connection')}
function renderTree(){const q=S.seq;if(!lastTree){seqTreeEl.innerHTML='<b style="color:#8fd">Sequence tree</b><br><small>Run a ★ sequence</small>';return}
 const active=q&&q.key&&q.key.startsWith('u:'),i=active?q.i:(lastTree._end??-1);if(active)lastTree._end=undefined;else if(lastTree._end==null&&!q)lastTree._end=lastTree.to;
 const st=n=>n.leaf!=null?(n.leaf<i?'✓':n.leaf==i&&active?(q.blocked?'⛔':q.wait?'⏸':'▶'):'·'):(n.to<=i?'✓':n.from<=i&&i<n.to&&active?'▶':'·');
 const col={'✓':'#7d7','▶':'#fd5','⛔':'#f66','⏸':'#9cf','·':'#889'};
 const rec=(n,d)=>`<div style="padding-left:${d*12}px;color:${col[st(n)]}">${st(n)} ${n.leaf!=null?'':'<b>'}${n.label}${n.leaf!=null?'':'</b>'}${n.leaf!=null&&active&&n.leaf==i&&q.blocked?' <i>(interlock: '+q.blocked+')</i>':''}${n.leaf!=null&&q&&q.done&&q.done[n.leaf]!=null?' <small>'+q.done[n.leaf].toFixed(0)+'s</small>':''}</div>`+(n.kids||[]).map(k=>rec(k,d+1)).join('');
 const h=`<b style="color:#8fd">Sequence tree</b> <span style="color:#fc6">SIM</span> ${active?`step ${q.i+1}/${q.steps.length}`:'idle'} <button data-tc="step" style="${BTN}">⏭</button><button data-tc="pause" style="${BTN}">⏸</button><button data-tc="play" style="${BTN}">▶</button><button data-tc="stop" style="${BTN}">■</button><button data-tc="hide" style="${BTN}">×</button>`+rec(lastTree,0);
 if(seqTreeEl._h!==h){seqTreeEl._h=h;seqTreeEl.innerHTML=h;seqTreeEl.querySelectorAll('[data-tc]').forEach(b=>b.onclick=()=>seqCtl(b.dataset.tc))}}
function seqCtl(c){const q=S.seq;if(c=='hide'){seqTreeEl.style.display='none';return}if(!q)return;if(c=='step'){q.stepMode=true;q.wait=false}else if(c=='pause'){q.wait=true}else if(c=='play'){q.stepMode=false;q.wait=false}else if(c=='stop'){S.seq=null;PH.ev(S,'Sequence stopped by user')}}
function renderEd(){const D=SEQLIB[cur]||{steps:[]};const names=Object.keys(SEQLIB);
 const types=['action','set','pumps','wait','delay','call'];
 const row=(s,i)=>{const f=(k,w=70)=>`<input data-sf="${i}:${k}" value="${s[k]==null?'':(typeof s[k]=='object'?JSON.stringify(s[k]):String(s[k])).replace(/"/g,'&quot;')}" placeholder="${k}" style="width:${w}px">`;let x='';
  if(s.t=='action')x=`<select data-sf="${i}:do">${['slipset','sliprel','roughin','roughout','break','make','pumpson','drill'].map(a=>`<option ${a==s.do?'selected':''}>${a}</option>`).join('')}</select>`;
  else if(s.t=='set')x=f('path',80)+' = '+f('value',60);else if(s.t=='pumps')x='SPM '+f('spm',40)+' on '+f('on',40);else if(s.t=='delay')x=f('s',40)+' s';
  else if(s.t=='wait')x=s.cond!=null?f('cond',190):f('signal',70)+f('op',26)+f('value',50);else if(s.t=='call')x=`<select data-sf="${i}:seq">${names.filter(n=>n!=cur).map(n=>`<option ${n==s.seq?'selected':''}>${n}</option>`).join('')}</select> args ${f('args',80)}`;
  return `<div style="border-bottom:1px solid #345;padding:2px 0">${i+1}. <b>${s.t}</b> ${x}<br>label ${f('label',150)} interlock ${f('interlock',55)} ${s.t=='wait'?'timeout '+f('timeout',35):''} <button data-mv="${i}:-1" style="${BTN}">↑</button><button data-mv="${i}:1" style="${BTN}">↓</button><button data-rm="${i}" style="${BTN}">✕</button></div>`};
 seqEdEl.innerHTML=`<b style="color:#8fd">Sequence editor</b> <small>steps + nested sub-sequences, conditions on signals, interlocks, parameters</small> <button id="qx" style="${BTN};float:right">×</button><br>
 <select id="qsel">${names.map(n=>`<option ${n==cur?'selected':''}>${n}</option>`).join('')}</select> ${D._builtin?'<small style="color:#fc6">built-in (editing saves a copy over it)</small>':''}
 <button id="qnew" style="${BTN}">New</button><button id="qdup" style="${BTN}">Duplicate</button><button id="qdel" style="${BTN}">Delete/reset</button><br>
 Params (JSON) <input id="qpar" value='${JSON.stringify(D.params||{})}' style="width:200px"><br>
 <div id="qsteps">${D.steps.map(row).join('')}</div>
 Add step <select id="qadd">${types.map(t=>`<option>${t}</option>`).join('')}<option value="waitc">wait (expression)</option></select><button id="qaddb" style="${BTN}">+ Add</button><br>
 <button id="qrun" style="${BTN}">▶ Run</button><button id="qstep" style="${BTN}">⏭ Run step-by-step</button><button id="qtree" style="${BTN}">Show tree</button>
 <button id="qexp" style="${BTN}">Export JSON</button><button id="qimp" style="${BTN}">Import JSON</button>
 <div id="qmsg" style="color:#fd8"></div>
 <details><summary>Raw JSON of this sequence</summary><textarea id="qraw" style="width:100%;height:120px;font:10px monospace">${JSON.stringify((({_builtin,...r})=>r)(D),null,1)}</textarea><button id="qrawb" style="${BTN}">Apply raw JSON</button></details>`;
 const E=id=>seqEdEl.querySelector('#'+id),save=()=>{SEQLIB[cur]._builtin=false;saveSeqLib();renderEd()};
 E('qx').onclick=()=>seqEdEl.style.display='none';E('qsel').onchange=()=>{cur=E('qsel').value;renderEd()};
 E('qnew').onclick=()=>{const n=prompt('New sequence name');if(n){SEQLIB[n]={params:{},steps:[]};cur=n;save()}};
 E('qdup').onclick=()=>{const n=prompt('Copy as',cur+' copy');if(n){SEQLIB[n]=JSON.parse(JSON.stringify((({_builtin,...r})=>r)(D)));cur=n;save()}};
 E('qdel').onclick=()=>{if(BUILTIN[cur]){SEQLIB[cur]={...JSON.parse(JSON.stringify(BUILTIN[cur])),_builtin:true}}else{delete SEQLIB[cur];cur=Object.keys(SEQLIB)[0]}saveSeqLib();renderEd()};
 E('qpar').onchange=()=>{try{D.params=JSON.parse(E('qpar').value);save()}catch{E('qmsg').textContent='Params must be JSON'}};
 seqEdEl.querySelectorAll('[data-sf]').forEach(i=>i.onchange=()=>{const [ix,k]=i.dataset.sf.split(':');let v=i.value;if(k=='args'||k=='on'){try{v=JSON.parse(v)}catch{}}else if(v!==''&&!isNaN(+v)&&k!='label'&&k!='path'&&k!='cond')v=+v;if(v==='')delete D.steps[ix][k];else D.steps[ix][k]=v;save()});
 seqEdEl.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{const [i,d]=b.dataset.mv.split(':').map(Number),j=i+d;if(j<0||j>=D.steps.length)return;[D.steps[i],D.steps[j]]=[D.steps[j],D.steps[i]];save()});
 seqEdEl.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{D.steps.splice(+b.dataset.rm,1);save()});
 E('qaddb').onclick=()=>{const t=E('qadd').value;D.steps.push(t=='action'?{t,do:'slipset'}:t=='set'?{t,path:'dw.mode',value:'hold'}:t=='pumps'?{t,spm:100,on:true}:t=='wait'?{t,signal:'Q',op:'<',value:20,timeout:60}:t=='waitc'?{t:'wait',cond:'S.td.rpm<2',timeout:60}:t=='delay'?{t,s:5}:{t:'call',seq:names.find(n=>n!=cur)});save()};
 const run=sm=>{try{compileSeq(cur);if(runUserSeq(cur,sm))E('qmsg').textContent='Running '+cur}catch(e){E('qmsg').textContent='Error: '+e.message}};
 E('qrun').onclick=()=>run(false);E('qstep').onclick=()=>run(true);E('qtree').onclick=()=>{try{lastTree=compileSeq(cur).tree;seqTreeEl.style.display='block';renderTree()}catch(e){E('qmsg').textContent=e.message}};
 E('qexp').onclick=()=>dl(JSON.stringify({format:'drilling-world-sequences',version:1,sequences:Object.fromEntries(Object.entries(SEQLIB).map(([k,v])=>[k,(({_builtin,...r})=>r)(v)]))},null,1),'sequences.json');
 E('qimp').onclick=()=>pick('.json',t=>{importSeqs(t);renderEd()});
 E('qrawb').onclick=()=>{try{SEQLIB[cur]=JSON.parse(E('qraw').value);save()}catch(e){E('qmsg').textContent='JSON error: '+e.message}}}
function importSeqs(t){const j=typeof t=='string'?JSON.parse(t):t;const s=j.sequences||j;let n=0;for(const k in s)if(Array.isArray(s[k].steps)){SEQLIB[k]={...s[k],_builtin:false};n++}saveSeqLib();PH.ev(S,'Imported '+n+' sequences');return n}
window.__importSeqs=importSeqs;
