// wplan.js v5.8 (W1): WELL PLANNING. Basic well proposal -> minimum-curvature trajectory (build / hold / drop / turn) + planned survey table.
// Written fresh for this game (concept only). Metric: m, deg, DLS in deg/30 m. Coordinates: N, E, TVD (down positive) relative to the surface location.
// Every default/assumed input is tagged SIM. Proposals stored on this device in IndexedDB (db 'dw_wplan'). No network calls in this file.
const D2R=Math.PI/180,R2D=180/Math.PI,fin=Number.isFinite,$=id=>document.getElementById(id),es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
export const vec=(inc,azi)=>[Math.sin(inc*D2R)*Math.cos(azi*D2R),Math.sin(inc*D2R)*Math.sin(azi*D2R),Math.cos(inc*D2R)]; // [N,E,V]
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],add=(a,b,k=1)=>[a[0]+k*b[0],a[1]+k*b[1],a[2]+k*b[2]],nrm=a=>{const l=Math.hypot(...a);return l?a.map(x=>x/l):a},len=a=>Math.hypot(...a);
export const incAzi=t=>{const i=Math.acos(Math.max(-1,Math.min(1,t[2])))*R2D;let a=Math.atan2(t[1],t[0])*R2D;if(a<0)a+=360;return [i,i<1e-9?0:a]};
export const radius=dls=>30/(dls*D2R); // m, for DLS in deg/30 m
// dogleg angle (rad) between two survey stations
export function dogleg(i1,a1,i2,a2){const c=Math.cos((i2-i1)*D2R)-Math.sin(i1*D2R)*Math.sin(i2*D2R)*(1-Math.cos((a2-a1)*D2R));return Math.acos(Math.max(-1,Math.min(1,c)))}
// minimum curvature step: returns [dN,dE,dTVD]
export function minCurv(md1,i1,a1,md2,i2,a2){const b=dogleg(i1,a1,i2,a2),rf=b<1e-9?1:2/b*Math.tan(b/2),h=(md2-md1)/2;
 const I1=i1*D2R,I2=i2*D2R,A1=a1*D2R,A2=a2*D2R;
 return [h*(Math.sin(I1)*Math.cos(A1)+Math.sin(I2)*Math.cos(A2))*rf,h*(Math.sin(I1)*Math.sin(A1)+Math.sin(I2)*Math.sin(A2))*rf,h*(Math.cos(I1)+Math.cos(I2))*rf]}
// toolface (deg) for the dogleg from t1 to t2: gravity TF when inc>=3 deg, magnetic (azimuth of the turn) below
export function toolface(i1,a1,i2,a2){const t1=vec(i1,a1),t2=vec(i2,a2),u=add(t2,t1,-dot(t1,t2));if(len(u)<1e-12)return null;const U=nrm(u);
 if(i1<3){let m=Math.atan2(U[1],U[0])*R2D;return (m+360)%360}
 const I=i1*D2R,A=a1*D2R,h=[Math.cos(I)*Math.cos(A),Math.cos(I)*Math.sin(A),-Math.sin(I)],r=[-Math.sin(A),Math.cos(A),0];let tf=Math.atan2(dot(U,r),dot(U,h))*R2D;return (tf+360)%360}
// curve-hold: from point P with unit tangent t, turn at radius R (in the plane of t and P->T) then hold to hit T. Returns dogleg (rad), new tangent, arc len, hold len
export function curveHold(P,t,T,R){const d=add(T,P,-1),a=dot(d,t),pv=add(d,t,-a),b=len(pv);if(b<1e-6)return {beta:0,t2:t,arc:0,hold:Math.max(0,a),ok:a>=0};
 const n=pv.map(x=>x/b),f=th=>b*Math.cos(th)-a*Math.sin(th)-R*Math.cos(th)+R;let lo=0,hi=Math.PI,ok=false;for(let k=1;k<=360;k++){const x=k*Math.PI/360;if(f(lo)*f(x)<=0){hi=x;ok=true;break}lo=x}
 for(let k=0;k<100;k++){const m=(lo+hi)/2;if(f(lo)*f(m)<=0)hi=m;else lo=m}const th=(lo+hi)/2,t2=add(t.map(x=>x*Math.cos(th)),n,Math.sin(th));
 const hold=a-R*Math.sin(th)>=0||b-R*(1-Math.cos(th))>=0?Math.hypot(a-R*Math.sin(th),b-R*(1-Math.cos(th))):-1;return {beta:th,t2:nrm(t2),n,arc:R*th,hold,ok:ok&&hold>=0}}
// ---- proposal -> legs (each leg is an arc + optional hold) ----
export const DEFAULT={name:'SIM proposal A',tag:'SIM',surface:{n:0,e:0,elev:0},kop:500,dls:3,maxDls:5,vsAzi:null,stationStep:30,
 targets:[{name:'T1 top reservoir',tvd:1500,n:600,e:400,tol:30,dls:3},{name:'T2 TD',tvd:1620,n:1300,e:1050,tol:30,dls:4}],
 steps:[],casing:[{name:'Surface 13-3/8"',md:450},{name:'Intermediate 9-5/8"',tvdTarget:'T1 top reservoir'},{name:'Liner 7"',td:true}],tdHold:60,assumed:['surface','kop','dls','maxDls','targets','casing']};
export function plan(P){P={...DEFAULT,...P};const legs=[];let pos=[0,0,0],t=[0,0,1],md=0,warn=[];
 legs.push({kind:'vertical',md0:0,md1:P.kop,t0:t,t1:t,beta:0,len:P.kop,from:pos.slice()});pos=[0,0,P.kop];md=P.kop;
 const seq=[...(P.steps||[]),...P.targets.map(x=>({type:'target',...x}))];if(P.steps?.length)seq.sort((x,y)=>(x.order??0)-(y.order??0));
 for(const s of seq){if(s.type=='target'){const T=[s.n-P.surface.n,s.e-P.surface.e,s.tvd],dls=s.dls||P.dls;if(dls>P.maxDls)warn.push(s.name+': DLS '+dls+' > max '+P.maxDls);
   const c=curveHold(pos,t,T,radius(dls));if(!c.ok){warn.push(s.name+': not reachable at '+dls+'°/30m');continue}
   const kind=c.beta<1e-6?'hold':classify(t,c.t2);legs.push({kind,md0:md,md1:md+c.arc,t0:t,t1:c.t2,beta:c.beta,n:c.n,R:radius(dls),dls,len:c.arc,to:s.name});md+=c.arc;pos=arcEnd(pos,t,c.n,radius(dls),c.beta);t=c.t2;
   if(c.hold>0){legs.push({kind:'hold',md0:md,md1:md+c.hold,t0:t,t1:t,beta:0,len:c.hold,to:s.name});md+=c.hold;pos=add(pos,t,c.hold)}
   legs.at(-1).target=s.name;}
  else if(s.type=='curve'){const t2=vec(s.inc,s.azi),b=Math.acos(Math.max(-1,Math.min(1,dot(t,t2)))),R=radius(s.dls||P.dls);if(b>1e-9){const n=nrm(add(t2,t,-dot(t,t2)));legs.push({kind:classify(t,t2),md0:md,md1:md+R*b,t0:t,t1:t2,beta:b,n,R,dls:s.dls||P.dls,len:R*b});pos=arcEnd(pos,t,n,R,b);md+=R*b;t=t2}}
  else if(s.type=='hold'){legs.push({kind:'hold',md0:md,md1:md+s.len,t0:t,t1:t,beta:0,len:s.len});md+=s.len;pos=add(pos,t,s.len)}}
 if(P.tdHold>0){legs.push({kind:'hold',md0:md,md1:md+P.tdHold,t0:t,t1:t,beta:0,len:P.tdHold,to:'TD'});md+=P.tdHold}
 return {P,legs,td:md,warn}}
const arcEnd=(p,t,n,R,b)=>add(add(p,t,R*Math.sin(b)),n,R*(1-Math.cos(b)));
function classify(t1,t2){const [i1,a1]=incAzi(t1),[i2,a2]=incAzi(t2),di=i2-i1,da=((a2-a1+540)%360)-180;const turn=i1>1&&Math.abs(da)>2;
 return (di>0.5?'build':di<-0.5?'drop':'')+(turn?(di>0.5||di<-0.5?'+turn':'turn'):'')||'hold'}
// direction at MD along the legs (slerp on arcs = exact for circular arcs)
export function dirAt(L,md){const g=L.legs.find(l=>md<=l.md1+1e-9)||L.legs.at(-1);if(!g.beta)return g.t0;const s=Math.min(1,Math.max(0,(md-g.md0)/g.len))*g.beta;return nrm(add(g.t0.map(x=>x*Math.cos(s)),g.n,Math.sin(s)))}
// planned survey table: stations every step m + every leg boundary; positions by minimum curvature
export function survey(L,step){step=step||L.P.stationStep||30;const mds=new Set([0,L.td]);for(let m=step;m<L.td;m+=step)mds.add(+m.toFixed(3));for(const g of L.legs){mds.add(+g.md0.toFixed(3));mds.add(+g.md1.toFixed(3))}
 const M=[...mds].sort((a,b)=>a-b);const tg=L.P.targets[0],vsA=L.P.vsAzi??((Math.atan2(tg.e-L.P.surface.e,tg.n-L.P.surface.n)*R2D+360)%360);
 const out=[];let p=[0,0,0];for(let k=0;k<M.length;k++){const [i,a]=incAzi(dirAt(L,M[k]));let dls=0,tf=null;
  if(k){const q=out[k-1],d=minCurv(q.md,q.inc,q.azi,M[k],i,a);p=[q.n+d[0],q.e+d[1],q.tvd+d[2]];const dm=M[k]-q.md;dls=dm>1e-6?dogleg(q.inc,q.azi,i,a)*R2D*30/dm:0;tf=dls>0.01?toolface(q.inc,q.azi,i,a):null}
  const g=L.legs.find(l=>M[k]<=l.md1+1e-6&&M[k]>=l.md0-1e-6&&l.len>0&&M[k]>l.md0+1e-6)||L.legs.find(l=>Math.abs(M[k]-l.md0)<1e-6)||L.legs.at(-1);
  out.push({md:M[k],inc:i,azi:a,tvd:p[2],n:p[0],e:p[1],vs:p[0]*Math.cos(vsA*D2R)+p[1]*Math.sin(vsA*D2R),dls,tf,sec:g.kind,mark:L.legs.filter(l=>Math.abs(l.md1-M[k])<1e-6&&l.target).map(l=>l.target).join(' ')})}
 return {rows:out,vsAzi:vsA}}
// target check: closest planned point to each target centre vs tolerance
export function targetCheck(L,S){return L.P.targets.map(T=>{const c=[T.n-L.P.surface.n,T.e-L.P.surface.e,T.tvd];let best=1e9,md=null;
 for(let m=0;m<=L.td;m+=1){const r=pointAt(L,S,m),d=len(add(r,c,-1));if(d<best){best=d;md=m}}return {name:T.name,miss:best,md,ok:best<=T.tol,tol:T.tol}})}
export function pointAt(L,S,md){const R=S.rows;let k=R.findIndex(r=>r.md>=md);if(k<=0)return k==0?[R[0].n,R[0].e,R[0].tvd]:[R.at(-1).n,R.at(-1).e,R.at(-1).tvd];const q=R[k-1],[i,a]=incAzi(dirAt(L,md)),d=minCurv(q.md,q.inc,q.azi,md,i,a);return [q.n+d[0],q.e+d[1],q.tvd+d[2]]}
export function casingMD(L,S){return L.P.casing.map(c=>{let md=c.md;if(c.td)md=L.td;if(c.tvdTarget){const T=L.P.targets.find(x=>x.name==c.tvdTarget);const r=S.rows.find(r=>r.tvd>=T.tvd-30)||S.rows.at(-1);md=r.md}
 const r=S.rows.reduce((b,x)=>Math.abs(x.md-md)<Math.abs(b.md-md)?x:b,S.rows[0]);return {name:c.name,md,tvd:r.tvd}})}
export function toCSV(S){return 'MD (m),Inc (deg),Azi (deg),TVD (m),N (m),E (m),VS (m),DLS (deg/30m),Toolface (deg),Section,Target\n'+S.rows.map(r=>[r.md.toFixed(2),r.inc.toFixed(2),r.azi.toFixed(2),r.tvd.toFixed(2),r.n.toFixed(2),r.e.toFixed(2),r.vs.toFixed(2),r.dls.toFixed(2),r.tf==null?'':r.tf.toFixed(1),r.sec,r.mark].join(',')).join('\n')}
// ---- IndexedDB (proposals; offsets added in W2) ----
function idb(){return new Promise((ok,no)=>{const r=indexedDB.open('dw_wplan',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('proposals'))d.createObjectStore('proposals',{keyPath:'name'});if(!d.objectStoreNames.contains('offsets'))d.createObjectStore('offsets',{keyPath:'name'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
export async function dbPut(store,v){const d=await idb();return new Promise((ok,no)=>{const x=d.transaction(store,'readwrite');x.objectStore(store).put(v);x.oncomplete=()=>ok(true);x.onerror=()=>no(x.error)})}
export async function dbAll(store){const d=await idb();return new Promise((ok,no)=>{const q=d.transaction(store).objectStore(store).getAll();q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
// ---- UI ----
export const W={P:null,L:null,S:null,view:'plan',draw3d:()=>draw3d(),ext:{},tabs:[],on3d:[],extraPts:()=>[]};let THREE=null,R3=null;
const sim=k=>W.P.assumed?.includes(k)?' <span class=wpS>SIM</span>':'';
function inputsHTML(){const P=W.P,t=P.targets.map((x,i)=>`<tr><td><input data-t=${i} data-k=name value="${es(x.name)}" style="width:96px"></td>${['tvd','n','e','tol','dls'].map(k=>`<td><input data-t=${i} data-k=${k} type=number value=${x[k]} style="width:58px"></td>`).join('')}</tr>`).join('');
 return `<div class=wpG><label>Surface N/E (m)${sim('surface')}<span><input id=wpSN type=number value=${P.surface.n} style="width:70px"><input id=wpSE type=number value=${P.surface.e} style="width:70px"></span></label>
 <label>KOP MD (m)${sim('kop')}<input id=wpKOP type=number value=${P.kop}></label><label>Build DLS (°/30 m)${sim('dls')}<input id=wpDLS type=number step=0.5 value=${P.dls}></label><label>Max DLS (°/30 m)${sim('maxDls')}<input id=wpMAX type=number step=0.5 value=${P.maxDls}></label><label>Hold past last target (m)<input id=wpTDH type=number value=${P.tdHold}></label></div>
 <div style="margin-top:6px"><b>Targets</b>${sim('targets')}<div style="overflow:auto"><table class=wpT><tr><th>Name</th><th>TVD</th><th>N</th><th>E</th><th>Tol (m)</th><th>DLS</th></tr>${t}</table></div><button id=wpAddT>+ target</button></div>
 <div style="margin-top:6px"><b>Casing points</b>${sim('casing')}: ${P.casing.map(c=>es(c.name)+(c.md?' @ '+c.md+' m MD':c.tvdTarget?' @ '+es(c.tvdTarget):' @ TD')).join(' · ')}</div>
 <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button id=wpCalc style="background:#2f7fd0;color:#fff;border:0;border-radius:6px;padding:6px 12px">Calculate plan</button><button id=wpSave>Save (device)</button><select id=wpLoad><option value="">Load saved…</option></select></div>`}
function read(){const P=W.P,n=id=>+$(id).value;const was=JSON.stringify([P.surface,P.kop,P.dls,P.maxDls]);P.surface={...P.surface,n:n('wpSN'),e:n('wpSE')};P.kop=n('wpKOP');P.dls=n('wpDLS');P.maxDls=n('wpMAX');P.tdHold=n('wpTDH');
 for(const e of document.querySelectorAll('#wp [data-t]')){const T=P.targets[+e.dataset.t];T[e.dataset.k]=e.dataset.k=='name'?e.value:+e.value}
 if(JSON.stringify([P.surface,P.kop,P.dls,P.maxDls])!=was)P.assumed=P.assumed.filter(k=>!['surface','kop','dls','maxDls'].includes(k))}
export function calc(P){W.P=P||W.P;W.L=plan(W.P);W.S=survey(W.L);W.TC=targetCheck(W.L,W.S);W.CS=casingMD(W.L,W.S);return W}
function resultHTML(){const {L,S,TC,CS}=W,R=S.rows,sel=R.filter((r,i)=>i==0||i==R.length-1||r.mark||Math.abs(r.md%30)<1e-6||L.legs.some(l=>Math.abs(l.md1-r.md)<1e-6));
 return `<div style="margin:6px 0">${W.P.tag=='SIM'||W.P.assumed?.length?'<span class=wpS>SIM</span> ':''}<b>${es(W.P.name)}</b> · TD ${L.td.toFixed(1)} m MD / ${R.at(-1).tvd.toFixed(1)} m TVD · VS azi ${S.vsAzi.toFixed(1)}° · max DLS ${Math.max(...R.map(r=>r.dls)).toFixed(2)}°/30 m</div>
 ${L.warn.length?'<div style="color:#ff8a7a">⚠ '+L.warn.map(es).join('<br>⚠ ')+'</div>':''}
 <div id=wpTC>${TC.map(t=>`<span style="display:inline-block;margin:2px;padding:2px 6px;border-radius:8px;background:${t.ok?'#173a24':'#4a1c1c'}">${t.ok?'✔':'✘'} ${es(t.name)}: miss ${t.miss.toFixed(2)} m (tol ${t.tol} m)</span>`).join('')}</div>
 <div style="font-size:11px;opacity:.8">Sections: ${L.legs.filter(l=>l.len>0.01).map(l=>`${l.kind} ${l.md0.toFixed(0)}–${l.md1.toFixed(0)} m${l.dls&&l.beta?' @ '+l.dls+'°/30m':''}`).join(' · ')}<br>Casing: ${CS.map(c=>es(c.name)+' '+c.md.toFixed(0)+' m MD / '+c.tvd.toFixed(0)+' m TVD').join(' · ')}</div>
 <div id=wp3d style="height:min(38vh,300px);margin:6px 0;border-radius:8px;overflow:hidden;background:#08101c;position:relative"></div>
 <div style="display:flex;gap:6px;margin-bottom:4px"><button id=wpCSV>Export CSV</button><span style="font-size:11px;opacity:.7;align-self:center">${R.length} stations (every ${W.P.stationStep} m + section ends); key rows shown</span></div>
 <div style="overflow:auto;max-height:40vh"><table id=wpTbl class=wpT style="font-size:11px"><thead><tr><th>MD</th><th>Inc</th><th>Azi</th><th>TVD</th><th>N</th><th>E</th><th>VS</th><th>DLS</th><th>TF</th><th>Sec</th></tr></thead><tbody>
 ${sel.map(r=>`<tr${r.mark?' style="background:#20324a"':''}><td>${r.md.toFixed(1)}</td><td>${r.inc.toFixed(2)}</td><td>${r.azi.toFixed(2)}</td><td>${r.tvd.toFixed(1)}</td><td>${r.n.toFixed(1)}</td><td>${r.e.toFixed(1)}</td><td>${r.vs.toFixed(1)}</td><td>${r.dls.toFixed(2)}</td><td>${r.tf==null?'':r.tf.toFixed(0)+(r.inc<3?'M':'')}</td><td>${r.sec}${r.mark?' ◎'+es(r.mark):''}</td></tr>`).join('')}</tbody></table></div>`}
async function draw3d(){const host=$('wp3d');if(!host)return;if(!THREE){try{THREE=await import('three');var {OrbitControls}=await import('./vendor/OrbitControls.js');W.OC=OrbitControls}catch(e){host.textContent='3D unavailable';return}}
 const w=host.clientWidth,h=host.clientHeight;if(R3){R3.dispose()}R3=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});R3.setSize(w,h);R3.setPixelRatio(Math.min(2,devicePixelRatio));host.innerHTML='';host.appendChild(R3.domElement);
 const sc=new THREE.Scene(),R=W.S.rows,span=Math.max(...[...R,...W.extraPts()].map(r=>Math.max(Math.abs(r.n),Math.abs(r.e),r.tvd)))||1000,k=100/span,P=r=>new THREE.Vector3(r.e*k,-r.tvd*k,-r.n*k);
 sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(R.map(P)),new THREE.LineBasicMaterial({color:0x4fc3ff})));
 const grid=new THREE.GridHelper(200,20,0x2a4060,0x1a2a40);sc.add(grid);
 for(const T of W.P.targets){const m=new THREE.Mesh(new THREE.SphereGeometry(Math.max(1.2,T.tol*k),16,12),new THREE.MeshBasicMaterial({color:0xe0b050,wireframe:true}));m.position.copy(P({n:T.n-W.P.surface.n,e:T.e-W.P.surface.e,tvd:T.tvd}));sc.add(m)}
 for(const c of W.CS){const r=R.reduce((b,x)=>Math.abs(x.md-c.md)<Math.abs(b.md-c.md)?x:b,R[0]);const m=new THREE.Mesh(new THREE.BoxGeometry(2.5,0.6,2.5),new THREE.MeshBasicMaterial({color:0x9ad07a}));m.position.copy(P(r));sc.add(m)}
 const cam=new THREE.PerspectiveCamera(45,w/h,0.1,2000);cam.position.set(140,40,140);const oc=new W.OC(cam,R3.domElement);oc.target.set(0,-50,0);oc.update();
 const loop=()=>{if(!R3||!host.isConnected)return;R3.render(sc,cam);requestAnimationFrame(loop)};W.three={sc,cam,P,k,THREE,host};for(const f of W.on3d)try{f(W.three)}catch(e){console.error('wplan3d',e)}loop()}
function render(){const B=$('wpBody');if(!B)return;const X=W.ext[W.view];if(X){for(const b of document.querySelectorAll('#wp [data-v]'))b.classList.toggle('on',b.dataset.v==W.view);return X(B)}B.innerHTML=W.view=='inputs'?inputsHTML():resultHTML();
 for(const b of document.querySelectorAll('#wp [data-v]'))b.classList.toggle('on',b.dataset.v==W.view);
 if(W.view=='inputs'){$('wpCalc').onclick=()=>{read();calc();W.view='plan';render()};$('wpAddT').onclick=()=>{read();const l=W.P.targets.at(-1);W.P.targets.push({name:'T'+(W.P.targets.length+1),tvd:l.tvd+50,n:l.n+300,e:l.e+300,tol:30,dls:W.P.dls});render()};
  $('wpSave').onclick=async()=>{read();await dbPut('proposals',JSON.parse(JSON.stringify(W.P)));$('wpSave').textContent='Saved ✔'};
  dbAll('proposals').then(a=>{const s=$('wpLoad');if(!s)return;for(const p of a)s.add(new Option(p.name,p.name));s.onchange=()=>{const p=a.find(x=>x.name==s.value);if(p){W.P=p;calc();W.view='plan';render()}}}).catch(()=>{})}
 else{$('wpCSV').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([toCSV(W.S)],{type:'text/csv'}));a.download=W.P.name.replace(/\W+/g,'_')+'_survey.csv';a.click()};draw3d()}}
function build(){const P=document.createElement('div');P.id='wp';P.style.cssText='display:none;position:fixed;left:0;right:0;bottom:calc(52px + env(safe-area-inset-bottom));max-height:80vh;overflow:auto;z-index:9300;background:rgba(14,22,34,.98);border-top:1px solid #2a3a50;border-radius:14px 14px 0 0;padding:10px 12px;color:#e8eef5;font:13px system-ui';
 P.innerHTML=`<style>#wp .wpS{background:#8a8f98;color:#fff;border-radius:6px;padding:0 4px;font-size:10px}#wp .wpG{display:grid;grid-template-columns:1fr 1fr;gap:6px}#wp .wpG label{display:flex;flex-direction:column;font-size:11px;gap:2px}#wp input{font-size:16px;background:#0b1320;color:#fff;border:1px solid #456;border-radius:6px;padding:3px}#wp .wpT{border-collapse:collapse}#wp .wpT td,#wp .wpT th{padding:2px 4px;border-bottom:1px solid #223;text-align:right;white-space:nowrap}#wp button.on{background:#2f7fd0;color:#fff}@media(min-width:700px){#wp{left:auto!important;right:12px!important;width:620px;border-radius:14px!important;border:1px solid #2a3a50}}</style>
 <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap"><b>🧭 Well planning</b><button data-v=inputs>Proposal</button><button data-v=plan>Trajectory</button>${W.tabs.map(([v,l])=>`<button data-v=${v}>${l}</button>`).join('')}<button id=wpX style="margin-left:auto">✕</button></div><div id=wpBody></div>`;
 document.body.appendChild(P);$('wpX').onclick=close;for(const b of P.querySelectorAll('[data-v]'))b.onclick=()=>{if(W.view=='inputs')read(),calc();W.view=b.dataset.v;render()}}
// v5.10: extension tabs (Offsets…DD program, Casing) register asynchronously; add their buttons whenever they arrive, no reopen needed
export function syncTabs(){const P=$('wp');if(!P)return;const x=$('wpX');for(const [v,l] of W.tabs){if(P.querySelector(`[data-v="${v}"]`))continue;const b=document.createElement('button');b.dataset.v=v;b.textContent=l;b.onclick=()=>{if(W.view=='inputs')read(),calc();W.view=v;render()};x.before(b);b.classList.toggle('on',W.view==v)}}
const reg=m=>{m.register(W);syncTabs()};
export function open(view){if(!$('wp'))build();if(!W.L)calc(JSON.parse(JSON.stringify(DEFAULT)));if(view)W.view=view;const e=$('wp');if(window.GX?.ui?.show)GX.ui.show(e);e.style.display='block';syncTabs();render()}
export function close(){const e=$('wp');if(e)e.style.display='none'}
export const draw3dInto=draw3d;export function init(){if(typeof document=='undefined')return;import('./wac.js?v=592').then(reg).catch(e=>console.error('wac',e));import('./ddp.js?v=592').then(reg).catch(e=>console.error('ddp',e));import('./wpg.js?v=G1').then(reg).catch(e=>console.error('wpg',e));import('./wplanac.js?v=G7').then(reg).catch(e=>console.error('wplanac',e));import('./casing.js?v=510').then(reg).catch(e=>console.error('casing',e));window.GX=window.GX||{};GX.wplan={W,open,close,calc,plan,survey,minCurv,dogleg,toolface,curveHold,targetCheck,toCSV,dbPut,dbAll,DEFAULT};
 const g=(document.getElementById('uig_geo')||document.querySelector('#uiTools .g')),hud=g?null:$('hud');if(g){const b=document.createElement('button');b.id='btnWP';b.textContent='🧭 Well planning';b.onclick=()=>open();g.prepend(b)}if(hud){const b=document.createElement('button');b.id='btnWP';b.textContent='🧭 Well planning';b.onclick=()=>open();hud.appendChild(b)};let k=0;const mv=setInterval(()=>{const g=$('uig_geo'),b=$('btnWP');if(g&&b&&b.parentNode!==g)g.prepend(b);if((g&&b?.parentNode===g)||++k>40)clearInterval(mv)},250)}
