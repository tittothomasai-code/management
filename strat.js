// strat.js v1 (helper D): lithology + stratigraphic earth model. Pure model API (no DOM) + optional panel.
// Units: metres (TVD positive down, E/N metres from the wellhead), gamma API, UCS MPa.
// Sources in order: WITSML formationMarker / lithology (GEO.layers with a WITSML or file source) > EDM formation rows > SIM default.
// Anything synthetic is labelled SIM. Never LIVE. No network calls.
const FT=0.3048,R=Math.PI/180;
// ---- lithology table: standard-style colours + pattern keys ----
export const LITH={
 sandstone:{c:'#f2d64b',p:'dots',gr:35,ucs:40,phi:.22,label:'Sandstone'},
 siltstone:{c:'#c8b070',p:'dash-dots',gr:75,ucs:50,phi:.14,label:'Siltstone'},
 shale:{c:'#7d8c6a',p:'dashes',gr:115,ucs:45,phi:.08,label:'Shale'},
 claystone:{c:'#a88a62',p:'dashes',gr:95,ucs:20,phi:.30,label:'Claystone'},
 marl:{c:'#9fbf8a',p:'brick-dash',gr:60,ucs:35,phi:.18,label:'Marl'},
 limestone:{c:'#7fb8f0',p:'brick',gr:20,ucs:110,phi:.06,label:'Limestone'},
 chalk:{c:'#d6ecff',p:'brick',gr:12,ucs:15,phi:.30,label:'Chalk'},
 dolomite:{c:'#b48ce0',p:'rhomb',gr:22,ucs:130,phi:.05,label:'Dolomite'},
 anhydrite:{c:'#f08cf0',p:'hatch',gr:12,ucs:90,phi:.01,label:'Anhydrite'},
 salt:{c:'#e8f4ff',p:'cross',gr:8,ucs:25,phi:0,label:'Salt'},
 coal:{c:'#222222',p:'solid',gr:40,ucs:15,phi:.05,label:'Coal'},
 conglomerate:{c:'#f0a840',p:'circles',gr:45,ucs:70,phi:.12,label:'Conglomerate'},
 basement:{c:'#e07070',p:'vee',gr:60,ucs:200,phi:.01,label:'Basement'}};
const KEYS=[['sand','sandstone'],['silt','siltstone'],['shale','shale'],['mud','shale'],['clay','claystone'],['marl','marl'],['lime','limestone'],['carb','limestone'],['chalk','chalk'],['dolo','dolomite'],['anhy','anhydrite'],['salt','salt'],['halite','salt'],['coal','coal'],['congl','conglomerate'],['granit','basement'],['basement','basement']];
export function lithKey(s){s=String(s||'').toLowerCase();for(const [k,v] of KEYS)if(s.includes(k))return v;return null}
// ---- SIM default (synthetic, labelled SIM) ----
// beds: repeating interbeds inside a formation [[lith,fraction]...] with period m.
export function SIM_STRAT(){const F=[
 ['SIM Quaternary sands',0,'sandstone',[['sandstone',.7],['claystone',.3]],18],
 ['SIM Upper clay',180,'claystone',[['claystone',.85],['siltstone',.15]],25],
 ['SIM Chalk group',520,'chalk',[['chalk',.9],['marl',.1]],30],
 ['SIM Marl unit',820,'marl',null,0],
 ['SIM Shale seal',1000,'shale',[['shale',.9],['siltstone',.1]],20],
 ['SIM Coal measures',1350,'shale',[['shale',.55],['sandstone',.3],['coal',.15]],12],
 ['SIM Salt',1600,'salt',[['salt',.9],['anhydrite',.1]],40],
 ['SIM Carbonate platform',1850,'limestone',[['limestone',.8],['dolomite',.2]],25],
 ['SIM Upper reservoir sand',2250,'sandstone',[['sandstone',.8],['shale',.2]],10],
 ['SIM Intra shale',2420,'shale',null,0],
 ['SIM Lower reservoir sand',2520,'sandstone',[['sandstone',.75],['siltstone',.25]],8],
 ['SIM Basal conglomerate',2900,'conglomerate',null,0],
 ['SIM Basement',3150,'basement',null,0]];
 return {src:'SIM',name:'SIM earth model',dip:{deg:3,azi:45},
  fault:{E:600,N:0,strike:0,dipDeg:60,throw:30,name:'SIM fault F1'},
  formations:F.map(([name,top,lith,beds,period],i)=>({name,top,lith,beds:beds?beds.map(([l,f])=>({lith:l,f})):null,period,dipAdd:i>6?1.5:0}))}}
// ---- model building from real sources ----
// markers: GEO.layers-style [{name,top_tvd|top_md (ft),lith}] or parseFormationMarkers output.
export function fromMarkers(ms,src='WITSML'){const f=(ms||[]).map(m=>{const t=m.top_tvd??m.top_md;return {name:String(m.name||'?'),top:+t*FT,lith:lithKey(m.lith)||lithKey(m.name)||'shale',lithGuess:!(lithKey(m.lith)||lithKey(m.name)),beds:null,period:0}}).filter(x=>isFinite(x.top)).sort((a,b)=>a.top-b.top);
 return f.length?{src,name:src+' formation tops',dip:{deg:0,azi:0},fault:null,formations:f}:null}
// rows: EDM CD_WELLBORE_FORMATION rows (attribute names lower-cased). Lengths in ft unless unit given.
export function fromEDM(rows,{unit='ft'}={}){const k=unit=='m'?1:FT,f=(rows||[]).map(r=>{const t=+(r.tvd_top??r.formation_tvd??r.tvd??r.md_top??r.formation_md??r.md);const lt=r.lithology||r.formation_lithology||r.lith||'';
  return {name:r.formation_name||r.name||'?',top:t*k,lith:lithKey(lt)||lithKey(r.formation_name)||'shale',lithGuess:!(lithKey(lt)||lithKey(r.formation_name)),beds:null,period:0,dipAdd:0,dipDeg:isFinite(+r.dip_angle)?+r.dip_angle:undefined,dipAzi:isFinite(+r.dip_direction)?+r.dip_direction:undefined}}).filter(x=>isFinite(x.top)).sort((a,b)=>a.top-b.top);
 return f.length?{src:'EDM',name:'EDM formations',dip:{deg:0,azi:0},fault:null,formations:f}:null}
// ---- geometry ----
// depth of formation i top at map point (E,N) in m.
export function topAt(M,i,E=0,N=0){const F=M.formations[i];if(!F)return Infinity;const dd=(F.dipDeg??M.dip.deg+(F.dipAdd||0)),da=(F.dipAzi??M.dip.azi)*R;
 let z=F.top+Math.tan(dd*R)*(E*Math.sin(da)+N*Math.cos(da));
 const fl=M.fault;if(fl&&i>0){const s=fl.strike*R,nx=Math.cos(s),ny=-Math.sin(s);const d=(E-fl.E)*nx+(N-fl.N)*ny-z/Math.tan(fl.dipDeg*R);if(d>0)z+=fl.throw}
 return z}
export function formationIndexAt(M,tvd,E=0,N=0){let k=-1;for(let i=0;i<M.formations.length;i++){if(topAt(M,i,E,N)<=tvd)k=i}return k}
const hash=x=>{const s=Math.sin(x*12.9898)*43758.5453;return s-Math.floor(s)};
// lithology (bed level) at a point -> {formation,index,lith,props}
export function lithAt(M,tvd,E=0,N=0){const i=formationIndexAt(M,tvd,E,N);if(i<0)return null;const F=M.formations[i];let lith=F.lith;
 if(F.beds&&F.period>0){const t=tvd-topAt(M,i,E,N),ph=((t%F.period)+F.period)%F.period/F.period;let a=0;for(const b of F.beds){a+=b.f;if(ph<a){lith=b.lith;break}}}
 return {formation:F.name,index:i,lith,props:LITH[lith]||LITH.shale,src:M.src}}
// path: [{md,tvd,E,N}] metres, sorted by md
export function pointOnPath(path,md){if(!path?.length)return {md,tvd:md,E:0,N:0};if(md<=path[0].md)return {...path[0],md};for(let k=1;k<path.length;k++)if(md<=path[k].md){const a=path[k-1],b=path[k],f=(md-a.md)/((b.md-a.md)||1);return {md,tvd:a.tvd+f*(b.tvd-a.tvd),E:a.E+f*(b.E-a.E),N:a.N+f*(b.N-a.N)}}
 const l=path.at(-1);return {...l,md,tvd:l.tvd+(md-l.md)}}
export function lithAtMD(M,path,md){const p=pointOnPath(path,md);const r=lithAt(M,p.tvd,p.E,p.N);return r&&{...r,md,tvd:p.tvd,E:p.E,N:p.N}}
export function gammaAt(M,tvd,E=0,N=0){const r=lithAt(M,tvd,E,N);if(!r)return null;return Math.max(0,r.props.gr*(0.88+0.24*hash(Math.round(tvd*2)))+ (hash(tvd*.37)-.5)*6)}
// drilling response factors (1.0 = 40 MPa rock, same scale as geo.js rockFactors)
export function response(lith){const P=LITH[lith]||LITH.shale,u=Math.max(3.5,P.ucs);return {rop:Math.max(0.2,Math.min(2.5,Math.sqrt(55/u)*(1+(P.phi-0.1)))),tq:Math.max(0.7,Math.min(1.6,0.85+0.15*u/55)),ucs_mpa:P.ucs}}
// tops crossed along a path -> [{name,index,md,tvd,E,N,lith}]
export function topsAlongPath(M,path,step=2){const out=[];if(!path?.length)return out;let prev=-2;const md1=path.at(-1).md;for(let md=path[0].md;md<=md1;md+=step){const p=pointOnPath(path,md),i=formationIndexAt(M,p.tvd,p.E,p.N);if(i!==prev&&i>=0){out.push({name:M.formations[i].name,index:i,md:+md.toFixed(1),tvd:+p.tvd.toFixed(1),E:p.E,N:p.N,lith:M.formations[i].lith})}prev=i}return out}
// strip log samples
export function stripLog(M,path,{step=1,baseRop=25}={}){const o=[];if(!path?.length)return o;for(let md=path[0].md;md<=path.at(-1).md;md+=step){const p=pointOnPath(path,md),r=lithAt(M,p.tvd,p.E,p.N);if(!r)continue;const f=response(r.lith);
 o.push({md,tvd:p.tvd,lith:r.lith,formation:r.formation,gr:gammaAt(M,p.tvd,p.E,p.N),rop:baseRop*f.rop*(0.92+0.16*hash(md*.71)),tq:f.tq})}return o}
// surface grid for 3D: formation i over a square of half-size h, n x n
export function surfaceGrid(M,i,h=1500,n=16,cE=0,cN=0){const z=new Float32Array((n+1)*(n+1));for(let a=0;a<=n;a++)for(let b=0;b<=n;b++)z[a*(n+1)+b]=topAt(M,i,cE-h+2*h*b/n,cN-h+2*h*a/n);return {n,h,z}}
// GEO.layers (ft) built from beds along the path, so the existing drilling hook (ROP/torque via UCS + porosity) uses lithology.
export function toGeoLayers(M,path,{minBed=6}={}){const L=[];const lg=stripLog(M,path,{step:1});let cur=null;
 for(const s of lg){const key=s.formation+'|'+s.lith;if(!cur||cur.key!=key){const sameF=cur&&cur.f==s.formation;if(sameF&&cur.b-cur.a<minBed&&L.length>1&&L.at(-2).f==s.formation&&L.at(-2).lith==s.lith){L.pop();cur=L.at(-1)}else{cur={key,a:s.md,ta:s.tvd,b:s.md,tb:s.tvd,lith:s.lith,f:s.formation};L.push(cur)}}cur.b=s.md+1;cur.tb=s.tvd+1}
 return L.map(x=>{const P=LITH[x.lith]||LITH.shale;return {name:x.f+' · '+P.label,top_md:x.a/FT,base_md:x.b/FT,top_tvd:x.ta/FT,base_tvd:x.tb/FT,color:P.c,lith:x.lith,ucs_psi:P.ucs*145.0377,porosity:P.phi,...(()=>{const q=pressureAt(M,(x.ta+x.tb)/2);return {pp_ppg:q.pp_ppg,fp_ppg:q.fg_ppg}})(),src:M.src=='SIM'?'SIMULATED':M.src,strat:true}})}
// ---- patterns (canvas) ----
const PC={};export function pattern(g,lith,s=16){const k=lith+s;if(PC[k])return g.createPattern(PC[k],'repeat');const P=LITH[lith]||LITH.shale;const c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d');x.fillStyle=P.c;x.fillRect(0,0,s,s);
 x.strokeStyle=x.fillStyle=lith=='coal'?'#555':'#0008';x.lineWidth=1;const h=s/2;
 switch(P.p){case'dots':x.fillRect(3,3,2,2);x.fillRect(h+3,h+3,2,2);break;case'dashes':x.beginPath();x.moveTo(1,4);x.lineTo(h-1,4);x.moveTo(h+1,h+4);x.lineTo(s-1,h+4);x.stroke();break;
  case'dash-dots':x.beginPath();x.moveTo(1,4);x.lineTo(h-1,4);x.stroke();x.fillRect(h+3,h+3,2,2);break;case'brick':case'brick-dash':x.beginPath();x.moveTo(0,.5);x.lineTo(s,.5);x.moveTo(0,h+.5);x.lineTo(s,h+.5);x.moveTo(.5,0);x.lineTo(.5,h);x.moveTo(h+.5,h);x.lineTo(h+.5,s);x.stroke();if(P.p=='brick-dash'){x.beginPath();x.moveTo(3,h/2);x.lineTo(h-3,h/2);x.stroke()}break;
  case'rhomb':x.beginPath();x.moveTo(0,.5);x.lineTo(s,.5);x.moveTo(0,h+.5);x.lineTo(s,h+.5);x.moveTo(2,0);x.lineTo(h-2,h);x.moveTo(h+2,h);x.lineTo(s-2,s);x.stroke();break;
  case'hatch':x.beginPath();x.moveTo(0,s);x.lineTo(s,0);x.stroke();break;case'cross':x.beginPath();x.moveTo(h-3,h);x.lineTo(h+3,h);x.moveTo(h,h-3);x.lineTo(h,h+3);x.stroke();break;
  case'circles':x.beginPath();x.arc(h/2+1,h/2+1,2.5,0,7);x.moveTo(s-2,s-4);x.arc(s-4,s-4,2,0,7);x.stroke();break;case'vee':x.beginPath();x.moveTo(3,4);x.lineTo(h/2+3,h+2);x.lineTo(h+3,4);x.stroke();break}
 PC[k]=c;return g.createPattern(c,'repeat')}
// ---- source resolution (browser) ----
const ST={M:null,src:'SIM',use:false,el:null,tab:'section',r3:null};
function geoPath(){const G=window.GEO;try{if(G?.calc?.length>=2)return G.calc.map(s=>({md:s.md*FT,tvd:s.tvd*FT,E:(s.ew||0)*FT,N:(s.ns||0)*FT}))}catch(e){}
 const td=Math.max(3300,(window.S?.md||0)*FT+200),p=[];for(let md=0;md<=td;md+=50){const k=Math.max(0,md-1200),inc=Math.min(60,k/30)*R;const q=p.at(-1)||{md:0,tvd:0,E:0,N:0};if(md==0){p.push({md:0,tvd:0,E:0,N:0});continue}p.push({md,tvd:q.tvd+50*Math.cos(inc),E:q.E+50*Math.sin(inc)*Math.sin(45*R),N:q.N+50*Math.sin(inc)*Math.cos(45*R),sim:true})}return p}
export function resolve(){const G=window.GEO,real=(G?.layers||[]).filter(l=>!l.strat&&l.src&&!/SIMULATED|SIM/.test(l.src));
 if(real.length){const m=fromMarkers(real,/WITSML/.test(real[0].src)?'WITSML':'File');if(m)return m}
 const e=window.GX?.edmFormations;if(Array.isArray(e)&&e.length){const m=fromEDM(e);if(m)return m}
 return SIM_STRAT()}
export function model(){return ST.M||(ST.M=resolve())}
export function setModel(M){ST.M=M;if(ST.el)render();return M}
export function applyToDrilling(on=true){const G=window.GEO;ST.use=!!on;try{localStorage.setItem('dw-strat',JSON.stringify({use:ST.use}))}catch(e){}
 if(!G)return 0;if(on){const L=toGeoLayers(model(),geoPath());if(!G._preStrat)G._preStrat=G.layers.filter(l=>!l.strat);G.layers=L;G._built=null;return L.length}
 if(G._preStrat){G.layers=G._preStrat;G._preStrat=null;G._built=null}return 0}
// ---- panel UI (phone-first bottom sheet) ----
const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function css(){if($('stratCss'))return;const s=document.createElement('style');s.id='stratCss';s.textContent=`#strat{position:fixed;left:0;right:0;bottom:52px;max-height:80vh;z-index:41;background:#0d1620f4;color:#dde;font:13px system-ui;border-top:2px solid #c96;border-radius:14px 14px 0 0;display:flex;flex-direction:column;overflow:hidden}
#strat header{display:flex;gap:6px;align-items:center;padding:8px 10px;flex-wrap:wrap}#strat header b{flex:1;min-width:150px}#strat button{min-height:40px;min-width:40px;padding:4px 10px;border-radius:8px;border:1px solid #c96;background:#231a10;color:#fed}
#strat button.on{background:#c96;color:#000}#strat .tag{background:#8a6d1a;color:#fff;border-radius:3px;padding:0 4px;font-size:11px}#stratBody{overflow:auto;padding:0 10px 10px}#strat canvas{width:100%;display:block;border-radius:8px;background:#000;touch-action:none}
#stratLeg{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px;margin-top:6px}#stratLeg div{display:flex;gap:6px;align-items:center}#stratLeg canvas{width:28px;height:18px;border:1px solid #fff4}`;document.head.appendChild(s)}
export function open(tab){if(typeof document=='undefined')return;css();if(!ST.el){const d=document.createElement('div');d.id='strat';document.body.appendChild(d);ST.el=d}ST.el.style.display='flex';if(tab)ST.tab=tab;ST.M=resolve();render();return API}
export function close(){if(ST.el){ST.el.style.display='none';if(ST.r3){ST.r3.dispose();ST.r3=null}}}
function render(){const M=model(),d=ST.el;if(!d)return;const path=geoPath(),sim=M.src=='SIM',ps=path[0]?.sim;
 const tabs=[['section','Section'],['log','Strip log'],['3d','3D'],['legend','Legend']];
 d.innerHTML=`<header><b>Earth model <span class="tag">${sim?'SIM':esc(M.src)}</span></b>${tabs.map(([k,t])=>`<button data-st="${k}" class="${ST.tab==k?'on':''}">${t}</button>`).join('')}<button id="stratX" aria-label="Close">✕</button></header>
 <div id="stratBody"><div id="stratSrc" style="color:#fc6;margin-bottom:6px">${sim?'SIM: synthetic layers. Not real formation data. Load WITSML formation markers or EDM formations to replace.':'Source: '+esc(M.src)+' formation tops ('+M.formations.length+').'+(M.formations.some(f=>f.lithGuess)?' Some lithology is estimated from the name.':'')}${ps?' Well path: SIM (no survey).':''}</div>
 <div id="stratView"></div><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><button id="stratUse" class="${ST.use?'on':''}">${ST.use?'Drilling uses this model':'Use this model for drilling'}</button><span style="color:#9ab">ROP and torque change with the rock at the bit.</span></div></div>`;
 d.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{ST.tab=b.dataset.st;render()});$('stratX').onclick=close;$('stratUse').onclick=()=>{applyToDrilling(!ST.use);render()};
 if(ST.r3&&ST.tab!='3d'){ST.r3.dispose();ST.r3=null}
 const V=$('stratView');if(ST.tab=='section')drawSection(V,M,path);else if(ST.tab=='log')drawLog(V,M,path);else if(ST.tab=='3d')draw3D(V,M,path);legend(V,M,ST.tab=='legend')}
function cv(V,h){const c=document.createElement('canvas');const w=Math.min(V.clientWidth||360,980),dpr=Math.min(2,devicePixelRatio||1);c.width=w*dpr;c.height=h*dpr;c.style.height=h+'px';V.appendChild(c);const g=c.getContext('2d');g.scale(dpr,dpr);return {c,g,w,h}}
function drawSection(V,M,path){const {c,g,w,h}=cv(V,Math.min(420,innerHeight*.45));c.id='stratSec';const l=path.at(-1),az=Math.atan2(l.E,l.N)||45*R,ux=Math.sin(az),uy=Math.cos(az);
 const hd=p=>p.E*ux+p.N*uy,x0=-300,x1=Math.max(800,hd(l)+400),z1=Math.max(...path.map(p=>p.tvd))+300,nx=Math.round(w/4),nz=Math.round(h/4),sx=w/nx,sz=h/nz;
 for(let a=0;a<nz;a++)for(let b=0;b<nx;b++){const H=x0+(b+.5)/nx*(x1-x0),z=(a+.5)/nz*z1,r=lithAt(M,z,H*ux,H*uy);g.fillStyle=r?pattern(g,r.lith,12):'#123';g.fillRect(b*sx,a*sz,sx+.5,sz+.5)}
 const X=H=>(H-x0)/(x1-x0)*w,Z=z=>z/z1*h;g.lineWidth=1;g.strokeStyle='#000a';for(let i=0;i<M.formations.length;i++){g.beginPath();for(let b=0;b<=60;b++){const H=x0+b/60*(x1-x0),z=topAt(M,i,H*ux,H*uy);b?g.lineTo(X(H),Z(z)):g.moveTo(X(H),Z(z))}g.stroke()}
 if(M.fault){const f=M.fault;g.strokeStyle='#f33';g.lineWidth=2;g.setLineDash([6,4]);g.beginPath();for(let z=0;z<=z1;z+=z1/20){let best=null;for(let b=0;b<=200;b++){const H=x0+b/200*(x1-x0),E=H*ux,N=H*uy,s=f.strike*R,dd=(E-f.E)*Math.cos(s)+(N-f.N)*-Math.sin(s)-z/Math.tan(f.dipDeg*R);if(best==null||Math.abs(dd)<best.d)best={d:Math.abs(dd),H}}z?g.lineTo(X(best.H),Z(z)):g.moveTo(X(best.H),Z(z))}g.stroke();g.setLineDash([])}
 g.strokeStyle='#fff';g.lineWidth=3;g.beginPath();path.forEach((p,i)=>i?g.lineTo(X(hd(p)),Z(p.tvd)):g.moveTo(X(hd(p)),Z(p.tvd)));g.stroke();
 g.font='11px system-ui';for(const t of topsAlongPath(M,path,5)){const x=X(hd(t)),y=Z(t.tvd);g.fillStyle='#fff';g.beginPath();g.arc(x,y,3.5,0,7);g.fill();g.fillStyle='#000c';const s=t.name+' '+t.md.toFixed(0)+' m MD';g.fillRect(x+5,y-8,g.measureText(s).width+6,14);g.fillStyle='#fff';g.fillText(s,x+8,y+3)}
 const bm=(window.S?.md||0)*FT;if(bm>0){const p=pointOnPath(path,bm);g.fillStyle='#f80';g.beginPath();g.arc(X(hd(p)),Z(p.tvd),6,0,7);g.fill()}
 g.fillStyle='#fffc';g.fillText('Cross-section along the well (azimuth '+((az/R+360)%360).toFixed(0)+'°). TVD 0 to '+z1.toFixed(0)+' m',6,h-6)}
function drawLog(V,M,path){const lg=stripLog(M,path,{step:Math.max(1,path.at(-1).md/700)});const {c,g,w,h}=cv(V,Math.min(560,innerHeight*.55));c.id='stratLog';const md1=path.at(-1).md,Y=md=>md/md1*(h-14)+12;
 const cols=[[0,.14,'MD m'],[.14,.36,'Lithology'],[.36,.68,'Gamma API 0-150'],[.68,1,'ROP m/h SIM']];g.font='10px system-ui';
 for(const [a,b,t] of cols){g.fillStyle='#0b1218';g.fillRect(a*w,0,(b-a)*w-1,h);g.fillStyle='#cde';g.fillText(t,a*w+3,10)}
 for(let md=0;md<=md1;md+=500){g.fillStyle='#9ab';g.fillText(md.toFixed(0),3,Y(md)+4);g.fillStyle='#fff2';g.fillRect(.14*w,Y(md),.86*w,1)}
 for(let k=0;k<lg.length;k++){const s=lg[k],n=lg[k+1]?.md??md1;g.fillStyle=pattern(g,s.lith,10);g.fillRect(.14*w,Y(s.md),.22*w-1,Math.max(1,Y(n)-Y(s.md)+.5))}
 const curve=(k,a,b,mx,col)=>{g.strokeStyle=col;g.lineWidth=1.2;g.beginPath();lg.forEach((s,i)=>{const x=a*w+Math.min(1,s[k]/mx)*(b-a)*w;i?g.lineTo(x,Y(s.md)):g.moveTo(x,Y(s.md))});g.stroke()};curve('gr',.36,.68,150,'#3d3');curve('rop',.68,1,60,'#fa3');
 g.strokeStyle='#f55';for(const t of topsAlongPath(M,path,2)){g.beginPath();g.moveTo(0,Y(t.md));g.lineTo(w,Y(t.md));g.stroke();g.fillStyle='#fdd';g.fillText(t.name,.37*w,Y(t.md)-2)}
 const bm=(window.S?.md||0)*FT;if(bm>0){g.fillStyle='#f80';g.fillRect(0,Y(bm)-1,w,2)}}
function legend(V,M,full){const used=new Set();for(const f of M.formations){used.add(f.lith);(f.beds||[]).forEach(b=>used.add(b.lith))}const d=document.createElement('div');d.id='stratLeg';
 for(const k of full?Object.keys(LITH):[...used]){const r=document.createElement('div');const c=document.createElement('canvas');c.width=28;c.height=18;const g=c.getContext('2d');g.fillStyle=pattern(g,k,9);g.fillRect(0,0,28,18);r.appendChild(c);const s=document.createElement('span');s.textContent=LITH[k].label+(full?' · GR '+LITH[k].gr:'');r.appendChild(s);d.appendChild(r)}V.appendChild(d);
 if(full){const t=document.createElement('div');t.style.marginTop='8px';t.innerHTML='<b>Formations</b><br>'+M.formations.map((f,i)=>`${i+1}. ${esc(f.name)} · top ${f.top.toFixed(0)} m TVD · ${LITH[f.lith]?.label||f.lith}${f.beds?' with '+f.beds.filter(b=>b.lith!=f.lith).map(b=>LITH[b.lith].label.toLowerCase()).join(', ')+' beds':''}`).join('<br>')+(M.fault?`<br>${esc(M.fault.name)}: throw ${M.fault.throw} m, dip ${M.fault.dipDeg}°`:'');V.appendChild(t)}}
async function draw3D(V,M,path){const T=await import('three');const {c,w,h}={c:document.createElement('canvas'),w:Math.min(V.clientWidth||360,980),h:Math.min(420,innerHeight*.45)};c.id='strat3d';c.style.height=h+'px';V.prepend(c);
 const ren=new T.WebGLRenderer({canvas:c,antialias:false});ren.setPixelRatio(Math.min(1.5,devicePixelRatio||1));ren.setSize(w,h,false);const sc=new T.Scene();sc.background=new T.Color('#0a1016');
 const cam=new T.PerspectiveCamera(45,w/h,10,40000);const zMax=Math.max(...path.map(p=>p.tvd))+300,H=Math.max(1200,...path.map(p=>Math.hypot(p.E,p.N)+400)),n=window.matchMedia?.('(max-width:700px)').matches?12:20;
 const P=(E,N,z)=>new T.Vector3(E,-z,-N);
 // cutaway block: each formation as a coloured surface; front quarter cut away; side walls show the section
 for(let i=0;i<M.formations.length;i++){const G=surfaceGrid(M,i,H,n),pos=[],idx=[];for(let a=0;a<=n;a++)for(let b=0;b<=n;b++){const E=-H+2*H*b/n,N=-H+2*H*a/n;pos.push(E,-Math.min(G.z[a*(n+1)+b],zMax),-N)}
  for(let a=0;a<n;a++)for(let b=0;b<n;b++){const E=-H+2*H*(b+.5)/n,N=-H+2*H*(a+.5)/n;if(E>0&&N<0)continue;const k=a*(n+1)+b;idx.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  sc.add(new T.Mesh(g,new T.MeshLambertMaterial({color:LITH[M.formations[i].lith]?.c||'#888',side:T.DoubleSide,transparent:true,opacity:.85})))}
 // section walls along the cut (E=0 plane for N<0 and N=0 plane for E>0), textured from lithAt
 const wall=(ax)=>{const tw=128,th=128,cv2=document.createElement('canvas');cv2.width=tw;cv2.height=th;const g2=cv2.getContext('2d');for(let a=0;a<th;a++)for(let b=0;b<tw;b++){const s=(b+.5)/tw*H,z=(a+.5)/th*zMax,r=ax?lithAt(M,z,s,0):lithAt(M,z,0,-s);g2.fillStyle=r?LITH[r.lith].c:'#123';g2.fillRect(b,a,1,1)}
  const m=new T.Mesh(new T.PlaneGeometry(H,zMax),new T.MeshBasicMaterial({map:new T.CanvasTexture(cv2),side:T.DoubleSide}));if(ax){m.position.set(H/2,-zMax/2,0)}else{m.rotation.y=Math.PI/2;m.position.set(0,-zMax/2,H/2)}sc.add(m)};wall(1);wall(0);
 sc.add(new T.Line(new T.BufferGeometry().setFromPoints(path.map(p=>P(p.E,p.N,p.tvd))),new T.LineBasicMaterial({color:'#fff'})));
 for(const t of topsAlongPath(M,path,5)){const s=new T.Mesh(new T.SphereGeometry(H/80,8,6),new T.MeshBasicMaterial({color:'#fff'}));s.position.copy(P(t.E,t.N,t.tvd));sc.add(s)}
 sc.add(new T.HemisphereLight('#fff','#445',1.2));const dl=new T.DirectionalLight('#fff',.8);dl.position.set(1,2,1);sc.add(dl);
 let th=.8,ph=.5,r=H*4.2;const draw=()=>{cam.position.set(r*Math.cos(ph)*Math.sin(th),-zMax/2+r*Math.sin(ph),r*Math.cos(ph)*Math.cos(th));cam.lookAt(0,-zMax/2,0);ren.render(sc,cam)};draw();
 let pd=null;c.onpointerdown=e=>{pd=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId)};c.onpointermove=e=>{if(!pd)return;th-=(e.clientX-pd[0])*.01;ph=Math.max(-.2,Math.min(1.4,ph+(e.clientY-pd[1])*.01));pd=[e.clientX,e.clientY];draw()};c.onpointerup=()=>pd=null;c.onwheel=e=>{e.preventDefault();r*=e.deltaY>0?1.1:.9;draw()};
 ST.r3={dispose:()=>{sc.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose()});ren.dispose()},draw,ren}}
// readout: lithology at the bit (for HUDs / geosteer)
export function atBit(){const md=(window.S?.md||0)*FT;return lithAtMD(model(),geoPath(),md)}
export function init(){if(typeof document=='undefined'||window.__stratInit)return;window.__stratInit=1;try{ST.use=!!JSON.parse(localStorage.getItem('dw-strat')||'{}').use}catch(e){}
 const add=()=>{const a=$('btnLay');if(!a){setTimeout(add,500);return}window.GX=window.GX||{};window.GX.strat=API;setTimeout(()=>{window.GX=window.GX||{};window.GX.strat=API},3000);if(!$('btnStrat')){const b=document.createElement('button');b.id='btnStrat';b.textContent='Earth model';b.className=a.className||'';a.after(b);b.onclick=()=>ST.el&&ST.el.style.display!='none'?close():open()}
  if(ST.use&&window.GEO)applyToDrilling(true);hudStart();hookWplan();if(new URLSearchParams(location.search).has('strat'))open()};add()}

// ---- stage 2b: pore / frac / overburden per lithology (SIM), linked to mud weight ----
// Overburden: integrate bulk density (Gardner-style values per lithology). Pore: hydrostatic 1.03 SG; SIM overpressure
// below the first shale seal (disequilibrium compaction ramp). Frac: Eaton FG = PP + nu/(1-nu)*(OB-PP). Units SG (g/cc EMW).
export const ROCK={sandstone:{rho:2.32,nu:.25},siltstone:{rho:2.40,nu:.27},shale:{rho:2.45,nu:.30},claystone:{rho:2.20,nu:.32},marl:{rho:2.38,nu:.29},limestone:{rho:2.60,nu:.28},chalk:{rho:2.15,nu:.24},dolomite:{rho:2.70,nu:.29},anhydrite:{rho:2.90,nu:.32},salt:{rho:2.16,nu:.45},coal:{rho:1.40,nu:.35},conglomerate:{rho:2.45,nu:.26},basement:{rho:2.75,nu:.25}};
export const PPG=8.345,HYD=1.03;
export function pressureAt(M,tvd,E=0,N=0){tvd=Math.max(1,tvd);const st=10;let ob=0;
 for(let z=0;z<tvd;z+=st){const h=Math.min(st,tvd-z),r=z<30?1.9:(ROCK[lithAt(M,z+h/2,E,N)?.lith]?.rho||2.3);ob+=r*h}
 const ob_sg=ob/tvd;const i=M.formations.findIndex(f=>f.lith=='shale');let pp=HYD;
 if(i>=0){const t=topAt(M,i,E,N);if(tvd>t)pp=HYD+Math.min(.30,(tvd-t)/300*.30)}
 const L=lithAt(M,tvd,E,N),k=L?.lith||'shale';if(k=='salt')pp=Math.min(pp,ob_sg);const nu=(ROCK[k]||ROCK.shale).nu;
 const fg=k=='salt'?ob_sg:pp+nu/(1-nu)*(ob_sg-pp);
 return {tvd,lith:k,ob_sg:+ob_sg.toFixed(3),pp_sg:+pp.toFixed(3),fg_sg:+fg.toFixed(3),pp_ppg:+(pp*PPG).toFixed(2),fg_ppg:+(fg*PPG).toFixed(2),src:M.src}}
export function mudWeight(){const v=window.G?.PH?.P?.mud?.mw_ppg;return typeof v=='number'?v:null}
export function mudWindow(b){b=b||atBit();if(!b)return null;const p=pressureAt(model(),b.tvd,b.E,b.N),mw=mudWeight();if(mw==null)return {...p,mw_sg:null,state:'NO MUD DATA'};
 const sg=mw/PPG;const state=sg<p.pp_sg?'KICK RISK':sg>p.fg_sg?'LOSS RISK':(sg-p.pp_sg<.03||p.fg_sg-sg<.05)?'NARROW':'OK';return {...p,mw_sg:+sg.toFixed(3),state}}
export function pressureProfile(M,path,step=25){M=M||model();path=path||geoPath();const out=[];const md1=path.at(-1)?.md||0;for(let md=path[0]?.md||0;md<=md1;md+=step){const q=pointOnPath(path,md);out.push({md,...pressureAt(M,q.tvd,q.E,q.N)})}return out}

// ---- stage 2c: hooks for geosteer (helper B) and well planning (wplan) ----
// lookAhead: formation tops the bit will cross in the next dist m of the current path (or plan).
export function lookAhead(dist=150,M,path){M=M||model();path=path||geoPath();const md=(window.S?.md||0)*FT,last=path.at(-1)?.md||0;
 return topsAlongPath(M,path,1).filter(t=>t.md>md&&t.md<=Math.min(last,md+dist)).map(t=>({...t,dmd:+(t.md-md).toFixed(1)}))}
// geologyFn: geosteer-compatible geology(x) -> {top,base,th} in TVD m for formation i, x = horizontal length along azimuth azi from (E0,N0).
export function geologyFn(i,azi=45,E0=0,N0=0,M){M=M||model();const a=azi*R;return x=>{const E=E0+x*Math.sin(a),N=N0+x*Math.cos(a),top=topAt(M,i,E,N),base=i+1<M.formations.length?topAt(M,i+1,E,N):top+50;return {top,base,th:base-top,name:M.formations[i].name,lith:M.formations[i].lith}}}
export function formationIndex(name,M){M=M||model();const s=String(name).toLowerCase();return M.formations.findIndex(f=>f.name.toLowerCase().includes(s))}
// wplan: rows {md,n,e,tvd} -> geology prognosis + mud window per formation.
export function planPath(W){const R0=(W||window.GX?.wplan?.W)?.S?.rows;return R0?.length?R0.map(r=>({md:r.md,tvd:r.tvd,E:r.e||0,N:r.n||0})):null}
export function prognosis(path,M){M=M||model();path=path||planPath()||geoPath();const tops=topsAlongPath(M,path,2),td=path.at(-1)?.md||0;
 return tops.map((t,k)=>{const md1=k+1<tops.length?tops[k+1].md:td;let pp=0,fg=9;for(let md=t.md;md<=md1;md+=10){const q=pointOnPath(path,md),r=pressureAt(M,q.tvd,q.E,q.N);pp=Math.max(pp,r.pp_sg);fg=Math.min(fg,r.fg_sg)}
  const mw=Math.min(pp+.06,fg-.06);return {name:t.name,lith:t.lith,top_md:t.md,top_tvd:t.tvd,base_md:md1,pp_max_sg:+pp.toFixed(2),fg_min_sg:+fg.toFixed(2),mw_rec_sg:+mw.toFixed(2),window_sg:+(fg-pp).toFixed(2),narrow:fg-pp<.15,src:M.src}})}
function wplanTab(B){const P=prognosis(planPath()),src=model().src=='SIM'?'SIM':model().src;
 B.innerHTML=`<div style="opacity:.75;margin:4px 0">Geology prognosis along the planned well. Source: ${src}. Pressures are ${src=='SIM'?'SIM (simulated, for training)':'from the model'}. Units: m, SG.</div>
 <div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="text-align:left"><th></th><th>Formation</th><th>Top MD</th><th>Top TVD</th><th>PP max</th><th>FG min</th><th>Mud rec.</th></tr></thead><tbody>${P.map(r=>`<tr${r.narrow?' style="color:#ff8a8a"':''}><td><span style="display:inline-block;width:10px;height:10px;background:${(LITH[r.lith]||LITH.shale).c}"></span></td><td>${r.name}</td><td>${r.top_md.toFixed(0)}</td><td>${r.top_tvd.toFixed(0)}</td><td>${r.pp_max_sg}</td><td>${r.fg_min_sg}</td><td>${r.mw_rec_sg}${r.narrow?' ⚠':''}</td></tr>`).join('')}</tbody></table></div>
 <div style="opacity:.7;margin-top:6px;font-size:11px">Mud rec. = PP max + 0.06 SG, not more than FG min − 0.06 SG. ⚠ = window less than 0.15 SG. <button id=stratWpOpen>Open earth model</button></div>`;
 const b=B.querySelector('#stratWpOpen');if(b)b.onclick=()=>open('section')}
function hookWplan(n=0){const X=window.GX?.wplan?.W;if(!X){if(n<60)setTimeout(()=>hookWplan(n+1),1000);return}if(!X.tabs.some(t=>t[0]=='geology'))X.tabs.push(['geology','Geology']);X.ext=X.ext||{};X.ext.geology=wplanTab}

// ---- stage 2a: lithology at bit on the HUD (chip) + event for the monitor ----
let _hudT=0,_lastF=null;
export function hudText(b){if(!b)return 'Bit: above model';const src=b.src=='SIM'?'SIM':b.src;return `Bit: ${b.props.label} · ${b.formation} · ${b.tvd.toFixed(0)} m TVD · ${src}`}
function hudTick(){try{const b=atBit();let el=document.getElementById('stratBit');
 if(!el){el=document.createElement('aside');el.id='stratBit';el.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 104px);z-index:40;font:12px system-ui;color:#fff;background:rgba(0,0,0,.6);border-radius:12px;padding:3px 10px;pointer-events:auto;max-width:92vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer';el.onclick=()=>open();document.body.appendChild(el)}
 const t=hudText(b)+pressText(b);if(el.textContent!=t)el.textContent=t;el.style.top=`calc(env(safe-area-inset-top,0px) + ${innerWidth<600?104:40}px)`;el.style.borderLeft='8px solid '+(b?b.props.c:'#888');el.style.outline=ST.warn?'2px solid #ff5050':'none';
 const f=b?b.formation+'|'+b.lith:null;if(f!==_lastF){_lastF=f;if(b)window.dispatchEvent(new CustomEvent('strat:bit',{detail:b}))}}catch(e){}}
function pressText(b){const w=b&&mudWindow(b);ST.warn=!!w&&/RISK/.test(w.state);if(!w||w.mw_sg==null)return '';return ` · PP ${w.pp_sg.toFixed(2)} FG ${w.fg_sg.toFixed(2)} MW ${w.mw_sg.toFixed(2)} SG · ${w.state}`}
function hudStart(){if(_hudT)return;_hudT=setInterval(hudTick,1000);hudTick()}

const API={LITH,SIM_STRAT,fromMarkers,fromEDM,resolve,model,setModel,topAt,formationIndexAt,lithAt,lithAtMD,pointOnPath,gammaAt,response,topsAlongPath,stripLog,surfaceGrid,toGeoLayers,applyToDrilling,atBit,hudText,lookAhead,geologyFn,formationIndex,planPath,prognosis,ROCK,pressureAt,mudWeight,mudWindow,pressureProfile,open,close,lithKey,path:()=>geoPath(),ST,ready:true};
if(typeof window!='undefined'){window.GX=window.GX||{};window.GX.strat=API;init()}
export default API;
