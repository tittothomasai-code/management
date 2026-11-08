// geosteer.js (helper B): Geosteering SIM demo at ?demo=geosteer. All data is SYNTHETIC and labelled SIM unless the earth model (strat.js) has a real source. Never LIVE. No network.
// v2: target layer from helper D's earth model (GX.strat.geologyFn / lookAhead / strat:bit), SIM layer as fallback.
// Pure model (model/step) + a phone-first 2D panel: curtain section (target layer top/base, well path, bit), gamma + resistivity logs, steering decisions.
export const VER='geosteer-2';
// ---- synthetic geology (TVD in m, x = horizontal length along the well in m) ----
// target sand: top dips gently, one SIM fault throws the layer down 4 m at x=520, layer thins from 6 m to 4.5 m.
export function simGeology(x){const dip=1.2*Math.PI/180;let top=2000+x*Math.tan(dip)+1.5*Math.sin(x/140);if(x>520)top+=4;const th=6-1.5*Math.min(1,Math.max(0,(x-300)/600));return {top,base:top+th,th}}
// ---- earth model (helper D, strat.js): GX.strat.geologyFn is a drop-in for geology(x). If it is missing or bad, use the SIM layer above. ----
export const EM={on:false,src:'SIM',name:'Target sand',lith:'sand',azi:45,why:'Earth model not loaded: SIM layer used',ahead:[],events:[]};let GEO=simGeology;
export function geology(x){return GEO(x)}
export function useEarthModel(S=(typeof window!='undefined'?window.GX?.strat:null),{azi=EM.azi,E0=0,N0=0,name='reservoir'}={}){GEO=simGeology;Object.assign(EM,{on:false,src:'SIM',name:'Target sand',lith:'sand',why:'Earth model not loaded: SIM layer used'});
 try{if(!S?.geologyFn||!S?.formationIndex)return false;const i=S.formationIndex(name);if(i<0){EM.why=`Earth model has no "${name}" formation: SIM layer used`;return false}
  const tgt=typeof S.targetFn=='function',fn=tgt?S.targetFn(i,azi,E0,N0):S.geologyFn(i,azi,E0,N0);EM.target=tgt;for(const x of [0,250,500,LEN]){const g=fn(x);if(!(isFinite(g.top)&&isFinite(g.base)&&g.base>g.top))throw new Error('bad layer at x='+x)}
  const g0=fn(0),src=tgt?'SIM':(S.model?.()?.src||'SIM');GEO=x=>{const g=fn(x);return {top:g.top,base:g.base,th:g.th??g.base-g.top,name:g.name,lith:g.lith,gross:g.gross}};
  Object.assign(EM,{on:true,src,name:g0.name||name,lith:g0.lith||'',why:''});return true}catch(e){GEO=simGeology;EM.why='Earth model error: SIM layer used ('+e.message+')';return false}}
export const isLiveSrc=s=>/witsml|edm|live/i.test(s||'')&&!/sim/i.test(s||'');// only a real data source removes the SIM label
// gamma (gAPI): low in the sand, high in the shale above and below, smooth change near the boundaries; hot streak at the sand top.
export function gamma(x,tvd){const g=geology(x),d=Math.min(tvd-g.top,g.base-tvd),s=1/(1+Math.exp(-d/0.35));let v=135-(135-35)*s;if(Math.abs(tvd-g.top)<0.6)v+=20;return v+4*Math.sin(x*0.9+tvd*3)}
export function resist(x,tvd){const g=geology(x),inS=tvd>g.top&&tvd<g.base,d=Math.min(Math.abs(tvd-g.top),Math.abs(tvd-g.base));return inS?Math.min(60,8+12*d):2+Math.exp(-d)*4}
// ---- steering simulation: survey every STEP m of x; decision every DEC m; bit lags the decision (build rate limit) ----
export const STEP=5,DEC=30,LEN=1000,MAXB=3;// MAXB: max change in inclination, degrees per 30 m
export function model(){const st=[],dec=[];let x=0,tvd=geology(0).top+geology(0).th*0.58,inc=90,want=90;// start in the layer (SIM layer: 2003.5 m)
 const est=(x,tvd)=>{const gr=gamma(x,tvd),g=geology(x);// interpretation from logs only (what the geosteerer sees): high gamma = outside the sand
  const pos=(tvd-g.top)/g.th;return {gr,pos}};
 for(;x<=LEN;x+=STEP){const e=est(x,tvd);st.push({x,tvd,inc,gr:e.gr,res:resist(x,tvd),pos:e.pos});
  if(x%DEC==0&&x>0){const gr=e.gr,trend=gr-(st[st.length-1-DEC/STEP]?.gr??gr),g=geology(x);let act,why;
   const dipNow=Math.atan2(geology(x+30).top-geology(x).top,30)*180/Math.PI,flat=90-dipNow;// inclination that follows the layer
   if(gr>80&&e.pos<0.5){act='Steer down';want=flat-2;why=`Gamma ${gr.toFixed(0)} gAPI: bit is near or above the TOP of the layer`}
   else if(gr>80){act='Steer up';want=flat+2;why=`Gamma ${gr.toFixed(0)} gAPI: bit is near or below the BASE of the layer`}
   else if(e.pos<0.3){act='Steer down a little';want=flat-0.7;why=`Gamma low, but the bit is in the upper part of the layer`}
   else if(e.pos>0.7){act='Steer up a little';want=flat+0.7;why=`Gamma low, but the bit is in the lower part of the layer`}
   else{act='Rotate, hold';want=flat;why=`Gamma ${gr.toFixed(0)} gAPI: bit is in the layer`}
   dec.push({md:mdAt(st),x,tvd,gr,trend,act,why,inc:+want.toFixed(1),pos:e.pos})}
  const d=want-inc,lim=MAXB*STEP/30;inc+=Math.max(-lim,Math.min(lim,d));tvd+=STEP*Math.cos(inc*Math.PI/180)}
 const inZ=st.filter(s=>s.pos>=0&&s.pos<=1).length/st.length;return {st,dec,inZone:inZ,sim:!isLiveSrc(EM.src),geo:{...EM,events:undefined,ahead:undefined}}}
function mdAt(st){let m=0;for(let i=1;i<st.length;i++)m+=Math.hypot(st[i].x-st[i-1].x,st[i].tvd-st[i-1].tvd);return 3200+m}// SIM kick-off MD 3200 m at heel
// ---- view ----
const $=id=>document.getElementById(id);let M,T=0,play=true,raf,last=0;
function draw(){const c=$('gsCur'),k=$('gsLog');if(!c)return;const n=Math.max(2,Math.floor(T)),S=M.st.slice(0,n),b=S.at(-1);
 for(const cv of [c,k]){const r=cv.getBoundingClientRect();cv.width=Math.round(r.width*devicePixelRatio);cv.height=Math.round(r.height*devicePixelRatio)}
 let g=c.getContext('2d'),W=c.width,H=c.height,s=devicePixelRatio;g.setTransform(1,0,0,1,0,0);g.fillStyle='#0d1117';g.fillRect(0,0,W,H);
 const x0=Math.max(0,b.x-500),x1=x0+600,gb=geology(b.x),t0=gb.top-8,t1=gb.base+8,X=x=>(x-x0)/(x1-x0)*W,Y=t=>(t-t0)/(t1-t0)*(H-18*s);
 // formations: shale above, target sand, shale below
 g.fillStyle='#3a3226';g.fillRect(0,0,W,H);g.fillStyle='#c9a646';g.beginPath();for(let x=x0;x<=x1;x+=5)g.lineTo(X(x),Y(geology(x).top));for(let x=x1;x>=x0;x-=5)g.lineTo(X(x),Y(geology(x).base));g.fill();
 g.lineWidth=2*s;for(const [k2,col] of [['top','#ffe066'],['base','#ff6b6b']]){g.strokeStyle=col;g.beginPath();for(let x=x0;x<=x1;x+=5)g.lineTo(X(x),Y(geology(x)[k2]));g.stroke()}
 g.strokeStyle='#fff';g.setLineDash([4*s,4*s]);g.beginPath();g.moveTo(X(520),0);g.lineTo(X(520),H-18*s);g.stroke();g.setLineDash([]);
 g.font=`${11*s}px system-ui`;g.fillStyle='#ffe066';const tl=EM.on?`TOP ${EM.name} (${isLiveSrc(EM.src)?EM.src:'SIM'} earth model)`:'TARGET TOP (SIM)';g.fillText(tl,4*s,Y(geology(x0).top)-4*s);g.fillStyle='#ff6b6b';g.fillText(EM.on?'BASE '+EM.name:'TARGET BASE (SIM)',4*s,Y(geology(x0).base)+13*s);g.fillStyle='#fff';if(!EM.on&&X(520)>0&&X(520)<W)g.fillText('fault (SIM)',X(520)+3*s,12*s);
 g.strokeStyle='#2f7cff';g.lineWidth=3*s;g.beginPath();S.forEach(p=>g.lineTo(X(p.x),Y(p.tvd)));g.stroke();
 for(const d of M.dec)if(d.x<=b.x){g.fillStyle=/up/.test(d.act)?'#7cf':/down/.test(d.act)?'#f9a':'#7f7';g.beginPath();g.arc(X(d.x),Y(d.tvd),4*s,0,7);g.fill()}
 g.fillStyle='#0f0';g.beginPath();g.arc(X(b.x),Y(b.tvd),6*s,0,7);g.fill();
 g.fillStyle='#ccc';g.fillText('TVD '+t0.toFixed(0)+'–'+t1.toFixed(0)+' m · length along well '+x0.toFixed(0)+'–'+x1.toFixed(0)+' m',4*s,H-4*s);
 // logs: gamma (green) and resistivity (orange, log scale) vs length
 g=k.getContext('2d');W=k.width;H=k.height;g.fillStyle='#10151c';g.fillRect(0,0,W,H);g.lineWidth=2*s;
 g.strokeStyle='#7f7';g.beginPath();S.forEach(p=>p.x>=x0&&g.lineTo(X(p.x),H-(p.gr/160)*H));g.stroke();
 g.strokeStyle='#fb4';g.beginPath();S.forEach(p=>p.x>=x0&&g.lineTo(X(p.x),H-(Math.log10(p.res)/2)*H));g.stroke();
 g.strokeStyle='rgba(255,255,255,.3)';g.setLineDash([3*s,3*s]);g.beginPath();g.moveTo(0,H-80/160*H);g.lineTo(W,H-80/160*H);g.stroke();g.setLineDash([]);
 g.font=`${11*s}px system-ui`;g.fillStyle='#7f7';g.fillText('Gamma (SIM) '+b.gr.toFixed(0)+' gAPI · limit 80',4*s,13*s);g.fillStyle='#fb4';g.fillText('Resistivity (SIM) '+b.res.toFixed(1)+' ohm·m',4*s,27*s);
 const D=M.dec.filter(d=>d.x<=b.x),inl=S.filter(p=>p.pos>=0&&p.pos<=1).length/S.length;
 $('gsStat').innerHTML=`Bit: MD ${(3200+b.x).toFixed(0)} m (SIM) · TVD ${b.tvd.toFixed(1)} m · inc ${b.inc.toFixed(1)}° · <b style="color:${b.pos>=0&&b.pos<=1?'#7f7':'#f66'}">${b.pos>=0&&b.pos<=1?'IN the layer':'OUT of the layer'}</b> · in layer ${(100*inl).toFixed(0)}% of length`;
 $('gsGeo').innerHTML=(EM.on?`Target: <b>${EM.name}</b> ${EM.lith?'('+EM.lith+')':''} from the earth model (${isLiveSrc(EM.src)?EM.src:'SIM'})`:`<span style=color:#fb4>${EM.why}</span>`)+(EM.ahead.length?`<br>Tops ahead of the rig bit (next 150 m): `+EM.ahead.map(t=>`${t.name} in ${t.dmd} m`).join(' · '):'')+(EM.events.length?`<br>Rig bit: `+EM.events.slice(-3).reverse().map(e=>`entered ${e.formation} (${e.lith}) at MD ${(+e.md).toFixed(0)} m`).join(' · '):'');
 const tb=$('gsDec');if(tb.dataset.n!=D.length){tb.dataset.n=D.length;tb.innerHTML=D.slice().reverse().map(d=>`<tr><td>${d.md.toFixed(0)}</td><td>${d.gr.toFixed(0)}</td><td><b>${d.act}</b></td><td>${d.inc}°</td><td style="opacity:.8">${d.why}</td></tr>`).join('')}}
function tick(){const now=performance.now(),dt=Math.min(0.5,(now-(last||now))/1000);last=now;if(play&&T<M.st.length)T=Math.min(M.st.length,T+8*dt);draw();raf=requestAnimationFrame(tick)}// 8 stations (40 m) per second, frame-rate independent
function refreshAhead(){try{EM.ahead=EM.on&&window.GX?.strat?.lookAhead?(window.GX.strat.lookAhead(150)||[]).slice(0,4):[]}catch{EM.ahead=[]}}
let wired=false;function wire(){if(wired||typeof window=='undefined')return;wired=true;window.addEventListener('strat:bit',e=>{const d=e.detail||{};EM.events.push(d);if(EM.events.length>20)EM.events.shift();refreshAhead();if(M)draw()})}
export function open(){wire();useEarthModel();refreshAhead();M=model();if(!EM.on&&!window.GX?.strat){let n=0;const w=()=>{if(window.GX?.strat){if(useEarthModel()){refreshAhead();M=model();T=Math.min(T,M.st.length);$('gsDec').dataset.n='';draw()}}else if(++n<20)setTimeout(w,500)};setTimeout(w,500)}T=2;play=!/still/.test(location.search);let p=$('gsP');if(!p){p=document.createElement('div');p.id='gsP';
 p.style.cssText='position:fixed;inset:0;z-index:9800;background:#0d1117f5;color:#ddd;overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 8px) 8px 40px;font:13px system-ui';
 p.innerHTML=`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="font-size:15px">Geosteering demo</b><span id=gsSim style="background:#8a8f98;color:#fff;border-radius:6px;padding:1px 6px;font-size:11px">SIM</span><span style="flex:1"></span><button id=gsPlay>⏸ Pause</button><button id=gsEnd>⏭ End</button><button id=gsRe>⟲ Restart</button><button id=gsX>✕</button></div>
 <div style="opacity:.75;margin:4px 0">Simulated data for training only. The layers, logs and decisions are not from a real well.</div><div id=gsStat style="margin:4px 0"></div><div id=gsGeo style="margin:4px 0;font-size:12px"></div>
 <canvas id=gsCur style="width:100%;height:230px;display:block;border-radius:4px"></canvas><canvas id=gsLog style="width:100%;height:110px;display:block;margin-top:4px;border-radius:4px"></canvas>
 <div style="margin:6px 0 2px;font-weight:bold">Steering decisions (SIM), newest first</div><div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr style="text-align:left"><th>MD m</th><th>Gamma</th><th>Action</th><th>Inc</th><th>Reason</th></tr></thead><tbody id=gsDec></tbody></table></div>
 <div style="opacity:.7;margin-top:6px;font-size:11px">Rule (SIM): gamma above 80 gAPI means the bit is in shale. Steer back to the layer. Change of inclination is ${MAXB}° per 30 m or less. A decision is made each ${DEC} m.</div>`;
 document.body.appendChild(p);$('gsX').onclick=close;$('gsRe').onclick=()=>{T=2;play=true;$('gsDec').dataset.n='';draw()};$('gsEnd').onclick=()=>{T=M.st.length;draw()};$('gsPlay').onclick=()=>{play=!play;$('gsPlay').textContent=play?'⏸ Pause':'▶ Play'}}
 p.style.display='block';cancelAnimationFrame(raf);last=0;tick();window.GX=window.GX||{};GX.geosteer={get M(){return M},open,close,model,geology,gamma,EM,useEarthModel,simGeology,state:()=>({T,play,n:M.st.length})};return M}
export function close(){const p=$('gsP');if(p)p.style.display='none';cancelAnimationFrame(raf)}
if(typeof document!='undefined'&&new URLSearchParams(location.search).get('demo')=='geosteer'){const go=()=>document.getElementById('start')?setTimeout(go,300):open();setTimeout(go,500)}
