// ext11.js v5.3: roof/floor AUTO-PICK from 4-quadrant (up/down/left/right) gamma + Kalman/RTS filter, vs Doug's interpretation.
// Up/down quadrant gamma → distance-to-boundary observations (roof AND floor estimated without crossing them; thickness MEASURED).
// Left/right = consistency check. Gamma crossings (bimodal/Otsu cutoff) are hard observations. Pure functions + a small panel.
// HONESTY: no real quadrant gamma has been tested yet; the synthetic run is SIM-TEST, Doug's picks are pixel-digitised from the report image.
const $=id=>document.getElementById(id);const es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
export const ALABEL='Auto-picked (filter)';
// ---------- mnemonic finder ----------
export const QPAT={up:/^(GR_?UP|GRUP|GMUP|GRU|GMUQ|GMHQ|ABG_?(UP|U|HS)|GR_?U|GR_?HS|GRHS)$/i,dn:/^(GR_?(DN|DOWN|DWN)|GRDN|GMDN|GRD|GMDQ|ABG_?(DN|DOWN|D|LS)|GR_?D|GR_?LS|GRLS)$/i,
 lt:/^(GR_?(LT|LEFT)|GRLT|GMLT|GRL|GMLQ|ABG_?(LT|LEFT|L)|GR_?L)$/i,rt:/^(GR_?(RT|RIGHT)|GRRT|GMRT|GRR|GMRQ|ABG_?(RT|RIGHT|R)|GR_?R)$/i,avg:/^(GMAVG|GR_?AVG|GRAVG|MG|GR|GRA|GRC|GAM|GAMMA)$/i};
export function parseMap(t){const m={};String(t||'').split(/[,;\s]+/).forEach(p=>{const [k,v]=p.split('=');if(k&&v&&/^(up|dn|lt|rt|avg)$/i.test(k))m[k.toLowerCase()]=v.trim()});return m}
export function findQuad(mns,manual){const man=typeof manual=='string'?parseMap(manual):(manual||{});const out={notes:[],src:{}};
 for(const k of ['up','dn','lt','rt','avg']){if(man[k]){const hit=mns.find(m=>m.toUpperCase()==man[k].toUpperCase());if(hit){out[k]=hit;out.src[k]='manual'}else out.notes.push('manual '+k+'='+man[k]+' not in this log')}
  if(!out[k]){const c=mns.filter(m=>QPAT[k].test(m.trim()));// prefer explicit U/D quadrant names over high/low-side
   const pref=k=='up'?c.find(m=>/UQ$|UP$|^GRU$/i.test(m))||c[0]:k=='avg'?['GMAVG','GR_AVG','GRAVG','MG','GR','GRA','GRC','GAM','GAMMA'].map(n=>c.find(m=>m.toUpperCase()==n)).find(Boolean):c[0];if(pref){out[k]=pref;out.src[k]='pattern'}}}
 if(out.up&&/HQ$|HS$/i.test(out.up))out.notes.push(out.up+' read as HIGH-side (= up) — confirm with manual mapping');
 if(out.lt&&/^GMLQ$/i.test(out.lt)&&!out.dn)out.notes.push('GMLQ could be LOW-side (= down) — confirm');
 out.ok=!!(out.up&&out.dn);return out}
// ---------- bimodal cutoff (Otsu) ----------
export function otsu(v){v=v.filter(isFinite);if(v.length<10)return null;const lo=Math.min(...v),hi=Math.max(...v),nb=64,h=new Array(nb).fill(0),bw=(hi-lo)/nb||1;v.forEach(x=>h[Math.min(nb-1,Math.floor((x-lo)/bw))]++);
 let best=-1,bk=0,bk2=0;const N=v.length;for(let k=1;k<nb;k++){let w0=0,s0=0,s1=0;for(let i=0;i<nb;i++){const c=lo+(i+.5)*bw;if(i<k){w0+=h[i];s0+=h[i]*c}else s1+=h[i]*c}const w1=N-w0;if(!w0||!w1)continue;const b=w0*w1*(s0/w0-s1/w1)**2;if(b>best*(1+1e-9)){best=b;bk=k;bk2=k}else if(b>=best*(1-1e-9))bk2=k}bk=Math.round((bk+bk2)/2);
 const cut=lo+bk*bw,a=v.filter(x=>x<cut),b=v.filter(x=>x>=cut),m=x=>x.reduce((s,y)=>s+y,0)/x.length,sd=x=>{const mu=m(x);return Math.sqrt(x.reduce((s,y)=>s+(y-mu)**2,0)/Math.max(1,x.length-1))};
 // modes: use medians (robust to approach-response tails)
 const med=x=>{const s=[...x].sort((p,q)=>p-q);return s[Math.floor(s.length/2)]};return {cut,lo:med(a),hi:med(b),sLo:sd(a.filter(x=>x<med(a)+2*sd(a)))||1,nLo:a.length,nHi:b.length}}
// ---------- quadrant gamma → distance-to-boundary observations ----------
// model: inside the low-gamma seam, quadrant reading g = gc + (gs−gc)·exp(−d/L), d = distance to the boundary that quadrant faces.
// outside (above roof / below floor) the quadrant facing the seam reads g = gs − (gs−gc)·exp(−d/L).
// robust noise: median |Δ| of consecutive quadrant readings / (0.6745·√2)
export function noiseEst(S){const d=[];for(const k of ['lt','rt','up','dn'])for(let i=1;i<S.length;i++){const x=S[i][k]-S[i-1][k];if(isFinite(x))d.push(Math.abs(x))}if(d.length<10)return null;d.sort((a,b)=>a-b);return d[Math.floor(d.length/2)]/0.954}
export function quadObs(S,o={}){const L=o.L??0.35,step=o.step??1;const ot=otsu(S.flatMap(s=>[s.avg,s.up,s.dn,s.lt,s.rt]))||{cut:75,lo:40,hi:110,sLo:4};
 const gc=o.gc??ot.lo,gs=o.gs??ot.hi,cut=o.cut??ot.cut,sn=o.sn??Math.max(1.5,noiseEst(S)??ot.sLo),A=gs-gc;const obs=[];const lr={n:0,ok:0,nOut:0,okOut:0};let last=-1e9;
 const dist=f=>-L*Math.log(f),Rof=(dg,d)=>(L*snE/Math.max(1e-6,dg))**2+(0.1*d)**2+0.0025;
 // running mean over ±W samples (≈ ±1 m) before inversion: noise σ → σ/√n; observations every `step` m
 const W=o.win??2,sm=k=>S.map((s,i)=>{let t=0,n=0;for(let j=Math.max(0,i-W);j<=Math.min(S.length-1,i+W);j++)if(isFinite(S[j][k])){t+=S[j][k];n++}return n?t/n:NaN});const U=sm('up'),Dn=sm('dn'),snE=sn/Math.sqrt(2*W+1),k3=o.k??3;
 S=S.map((s,i)=>({...s,up:U[i],dn:Dn[i]}));
 const skip=o.skipMd||[],near=md=>skip.some(m=>Math.abs(m-md)<(o.skipW??1.5));
 for(const s of S){if(!isFinite(s.up)||!isFinite(s.dn)||s.md-last<step||near(s.md))continue;last=s.md;const av=isFinite(s.avg)?s.avg:(isFinite(s.lt)&&isFinite(s.rt)?(s.lt+s.rt)/2:(s.up+s.dn)/2);const lrv=isFinite(s.lt)&&isFinite(s.rt)?(s.lt+s.rt)/2:NaN;
  // inside/outside the seam: left/right quadrants look along the bed at bit level → best indicator; average gamma otherwise. L/R vs average agreement is the check.
  const inn=isFinite(lrv)?lrv<cut:av<cut;if(isFinite(lrv)&&isFinite(s.avg)){if(s.avg<cut){lr.n++;if(lrv<cut)lr.ok++}else{lr.nOut++;if(lrv>=cut)lr.okOut++}}
  if(inn){for(const [g,b,sg] of [[s.up,'top',-1],[s.dn,'bottom',1]]){const dg=g-gc,f=dg/A;if(dg>k3*snE&&f<0.9){const d=dist(f);obs.push({md:s.md,hd:s.hd,tvd:s.tvd+sg*d,boundary:b,R:Rof(dg,d),d,by:'quadrant '+(sg<0?'up':'down')+' (inside)'})}}}
  // outside: only the quadrant that FACES the seam (the clearly lower one) carries information; it also tells which side we are on
  else{const side=s.dn<s.up-k3*snE?'above':s.up<s.dn-k3*snE?'below':null;if(!side)continue;for(const [g,b,sg] of (side=='above'?[[s.dn,'top',1]]:[[s.up,'bottom',-1]])){const dg=gs-g,f=dg/A;if(dg>k3*snE&&f<0.9){const d=dist(f);obs.push({md:s.md,hd:s.hd,tvd:s.tvd+sg*d,boundary:b,R:Rof(dg,d),d,by:'quadrant '+(sg<0?'up':'down')+' (outside)'})}}}}
 return {obs,gc,gs,cut,sn,L,lr,otsu:ot}}
// full auto-pick: crossings (auto cut) + quadrant distance obs → Kalman/RTS
export function autoPick(S,o={}){const K9=o.K9||window.GX?.geo8?.K9;const q0=quadObs(S,o);
 const cr=K9.findCrossings(S.map(s=>({...s,v:isFinite(s.avg)?s.avg:(s.up+s.dn)/2})),{cut:q0.cut,minRun:1,smooth:2}).map(c=>({...c,R:0.04,by:'crossing ('+c.by+')'}));const q=cr.length?quadObs(S,{...o,skipMd:cr.map(c=>c.md)}):q0;
 const all=[...cr,...q.obs];if(!all.length)return {none:true,msg:'no boundary seen: gamma never approaches roof or floor (quadrant readings stay at the seam/host level)',q};
 const nT=all.filter(c=>c.boundary=='top').length,nB=all.filter(c=>c.boundary=='bottom').length,prior=o.thPrior??2;
 const hd=all.map(c=>c.hd),h0=Math.min(...S.map(s=>s.hd)),h1=Math.max(...S.map(s=>s.hd)),grid=[];for(let h=h0;h<=h1+1e-9;h+=(o.dg??2))grid.push(h);
 const K=K9.kalman(all,grid,{Q:o.Q??2e-6,R:0.04,th0:prior,qth:o.qth??2e-4});
 const thickSrc=nT&&nB?`MEASURED (${nT} roof + ${nB} floor observations)`:`PRIOR ${prior} m (${o.priorSrc||'user/offset well'}) — only the ${nT?'roof':'floor'} was seen`;
 return {label:ALABEL,K,cr,q,nT,nB,thickSrc,measured:!!(nT&&nB)}}
// ---------- Doug's picks (reference) ----------
export const DOUG_URL='fixtures/westside_roof_floor_2879.json';
export function parseDoug(text,axis='hpl',hplToMd=288.4){const out=[];for(const line of String(text).split(/\r?\n/)){const n=(line.replace(/(\d),(\d{3})/g,'$1$2').match(/-?\d+(?:\.\d+)?/g)||[]).map(Number);if(n.length<3)continue;out.push({md:axis=='md'?n[0]:n[0]+hplToMd,roof:n[1],floor:n[2]})}return out}
// picks [{md, roof TVDSS, floor TVDSS}] → curtain coords (TVD = TVDSS + kb)
export function dougToCurtain(p,cu,kb,K9){return p.map(x=>{const c=K9.mdToCurtain(cu,x.md);return c?{md:x.md,hd:c.hd,roof:x.roof+kb,floor:x.floor+kb}:null}).filter(Boolean)}
export function compareDoug(K,refs,K9,dsig=0.3){const g=K.grid;if(!g.length)return null;const a=g[0].hd,b=g.at(-1).hd;const r=[];
 for(const p of refs){if(p.hd<a||p.hd>b)continue;const e=K9.estAt(K,p.hd);for(const [bd,v,est,s] of [['roof',p.roof,e.top,e.sTop],['floor',p.floor,e.bot,e.sBot]]){const sig=Math.hypot(s,dsig),res=v-est;r.push({hd:p.hd,md:p.md,boundary:bd,ref:v,est,res,sig,agree:Math.abs(res)<=2*sig})}}
 const st=k=>{const x=r.filter(q=>!k||q.boundary==k);return x.length?{n:x.length,rms:Math.sqrt(x.reduce((s,q)=>s+q.res**2,0)/x.length),bias:x.reduce((s,q)=>s+q.res,0)/x.length,agree:x.filter(q=>q.agree).length/x.length}:null};
 return {r,all:st(),roof:st('roof'),floor:st('floor')}}
// ---------- synthetic 4-quadrant gamma along a curtain (SIM-TEST) ----------
export function synthQuad(cu,seam,o={}){const L=o.L??0.35,gc=o.gc??40,gs=o.gs??115,sn=o.noise??4;let seed=o.seed??11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647},gauss=()=>Math.sqrt(-2*Math.log(rnd()+1e-12))*Math.cos(2*Math.PI*rnd());
 const K9=o.K9||window.GX?.geo8?.K9,S=[],m0=cu[0].md,m1=cu.at(-1).md,E=d=>Math.exp(-Math.max(0,d)/L);
 for(let md=m0;md<=m1;md+=(o.dmd??0.5)){const c=K9.mdToCurtain(cu,md);if(!c)continue;const {top:t,bot:b}=seam(c.hd),z=c.tvd,inn=z>t&&z<b;
  const q=dir=>{if(dir=='lr')return inn?gc:gs;if(inn)return gc+(gs-gc)*E(dir=='up'?z-t:b-z);if(z<=t)return dir=='dn'?gs-(gs-gc)*E(t-z):gs;return dir=='up'?gs-(gs-gc)*E(z-b):gs};
  const s={md,hd:c.hd,tvd:z,up:q('up')+sn*gauss(),dn:q('dn')+sn*gauss(),lt:q('lr')+sn*gauss(),rt:q('lr')+sn*gauss()};s.avg=(s.up+s.dn+s.lt+s.rt)/4;S.push(s)}return S}
// seam from reference picks (linear interpolation in hd), optional thickness override (keeps the roof)
export function seamFrom(refs,thick){const R=[...refs].sort((a,b)=>a.hd-b.hd);return hd=>{let k=R.findIndex(p=>p.hd>=hd);if(k<0)k=R.length-1;if(k==0)k=1;const a=R[k-1],b=R[k],f=(hd-a.hd)/((b.hd-a.hd)||1),t=a.roof+(b.roof-a.roof)*f,fl=a.floor+(b.floor-a.floor)*f;return {top:t,bot:thick?t+thick:fl}}}
// ---------- UI ----------
const ST=(globalThis.window||globalThis).Q53={};
function G(){return window.GX?.geo8}
function curt(){const g=G();const calc=window.GEO?.calc||[];if(calc.length<2)return null;const cu=g.curtain(calc);const S0=window.S||{};return cu}
async function loadDoug(){const F=await (await fetch(DOUG_URL+'?v=55')).json();ST.dougF=F;$('r53t').value=F.points.map(p=>p.hpl+' '+p.roof+' '+p.floor).join('\n');$('r53ax').value='hpl';ST.dougSrc='Doug (transcribed from WestSide report image, SIM-TEST)';return F}
function dougRefs(){const cu=curt();if(!cu)return [];const g=G(),kb=+g.CF.kb||0;const p=parseDoug($('r53t').value,$('r53ax').value,ST.dougF?.hplToMd??288.4);return dougToCurtain(p,cu,kb,g.K9)}
function opts(){return {L:+$('r53L').value||0.35,thPrior:+$('r53th').value||2,priorSrc:'user prior',K9:G().K9}}
export async function runSynth(trueThick){const g=G();if(!(window.GEO?.calc?.length>=2)||!window.REF52)await GX.ref52.loadReference();if(!ST.dougF)await loadDoug();const cu=curt();const refs=dougRefs();
 const th=trueThick??null;const S=synthQuad(cu,seamFrom(refs,th),{K9:g.K9,L:0.35,seed:11});ST.mode='SIM-TEST synthetic 4-quadrant gamma (truth = '+(th?'Doug roof + '+th+' m thickness':'Doug roof/floor')+'; L 0.35 m, noise 4 gAPI)';ST.S=S;ST.truth=th;return run()}
export function runLive(){const g=G(),q=g.G8.quad;if(!q){ST.out={msg:'No quadrant gamma loaded from WITSML (see mnemonics found below). Load from WITSML first, or set the manual mapping.'};draw();return null}
 const cu=curt();if(!cu){ST.out={msg:'no survey'};draw();return null}ST.S=q.rows.map(r=>{const c=g.K9.mdToCurtain(cu,r.md);return c?{...r,hd:c.hd,tvd:c.tvd}:null}).filter(Boolean);ST.mode=(g.G8.sim?'SIM-TEST':'WITSML')+' quadrant gamma "'+q.log+'" ('+['up','dn','lt','rt','avg'].map(k=>k+'='+(q.map[k]||'–')).join(', ')+')';return run()}
export function run(){const o=opts();const A=autoPick(ST.S,o);ST.A=A;const refs=dougRefs();ST.refs=refs;ST.cmp=A.K&&refs.length?compareDoug(A.K,refs,o.K9,ST.dougF?.digitSigma??0.3):null;draw();return {A,cmp:ST.cmp}}
function draw(){const o=$('r53o');if(!o)return;const A=ST.A,g=G();let h='';if(ST.out?.msg&&!A){o.innerHTML='<span style=color:#fb4>'+es(ST.out.msg)+'</span>';ST.out=null;dbg();return}
 if(A){h+=`<b>${ALABEL}</b> · <span style="color:#fb4">${es(ST.mode)}</span><br>`;if(A.none)h+='<span style=color:#fb4>'+es(A.msg)+'</span>';else{const K=A.K,e=K.grid.at(-1),q=A.q;
  h+=`Otsu cutoff ${q.cut.toFixed(0)} gAPI (seam mode ${q.gc.toFixed(0)}, host ${q.gs.toFixed(0)}, noise ${q.sn.toFixed(1)}) · L ${q.L} m · ${A.cr.length} crossings + ${q.obs.length} quadrant distance obs (${A.nT} roof / ${A.nB} floor)<br>`+
  `At ${e.hd.toFixed(0)} m HD: roof ${(e.top-(g.CF.kb||0)).toFixed(2)} ±${e.sTop.toFixed(2)} · floor ${(e.bot-(g.CF.kb||0)).toFixed(2)} ±${e.sBot.toFixed(2)} m TVDSS · thickness ${e.thick.toFixed(2)} m — <b>${es(A.thickSrc)}</b> · dip ${(90+e.dip).toFixed(2)}° ±${e.sDip.toFixed(2)}<br>`+
  `Left/right check: inside seam ${q.lr.n?Math.round(100*q.lr.ok/q.lr.n)+'% L/R low ('+q.lr.ok+'/'+q.lr.n+')':'–'} · outside ${q.lr.nOut?Math.round(100*q.lr.okOut/q.lr.nOut)+'% L/R high':'–'}<br>`;
  const c=ST.cmp;if(c?.all)h+=`<b>vs ${es(ST.dougSrc||'pasted picks')}</b>: roof RMS ${c.roof.rms.toFixed(2)} m (bias ${c.roof.bias.toFixed(2)}), floor RMS ${c.floor.rms.toFixed(2)} m (bias ${c.floor.bias.toFixed(2)}) · agree within 2σ: roof ${Math.round(100*c.roof.agree)}%, floor ${Math.round(100*c.floor.agree)}% (${c.roof.n} pts each)`;else h+='No reference picks overlap the filtered section.'}}
 o.innerHTML=h;curtain53();dbg()}
function dbg(){const g=G(),e=$('r53dbg');if(!e)return;const sc=g.G8.quadScan||[];e.innerHTML='<b>Quadrant gamma mnemonics</b> '+(sc.length?sc.map(s=>`<div>"${es(s.log)}": ${s.f.ok?'<span style=color:#7f7>up='+es(s.f.up)+' dn='+es(s.f.dn)+' lt='+es(s.f.lt||'–')+' rt='+es(s.f.rt||'–')+' avg='+es(s.f.avg||'–')+'</span>':'no up/down pair'} <span style="opacity:.6">[${es(s.mn.join(', '))}]</span>${s.f.notes.length?' <span style=color:#fb4>'+es(s.f.notes.join('; '))+'</span>':''}</div>`).join(''):'(not loaded from WITSML yet)')}
function curtain53(){const cv=$('r53c');if(!cv||!ST.S)return;const w=cv.width=Math.min(900,cv.clientWidth*2||700),h=cv.height=420,g=cv.getContext('2d');g.fillStyle='#1a140c';g.fillRect(0,0,w,h);const kb=+G().CF.kb||0;
 const S=ST.S,A=ST.A,K=A?.K,refs=ST.refs||[];const h0=S[0].hd,h1=S.at(-1).hd;const tv=[...S.map(s=>s.tvd)];if(K)K.grid.forEach(p=>tv.push(p.top-p.sTop,p.bot+p.sBot));refs.filter(r=>r.hd>=h0&&r.hd<=h1).forEach(r=>tv.push(r.roof,r.floor));
 const t0=Math.min(...tv)-1,t1=Math.max(...tv)+1,gx=150,X=hd=>gx+(hd-h0)/((h1-h0)||1)*(w-gx-60),Y=t=>20+(t-t0)/(t1-t0)*(h-60);
 // quadrant tracks (left): up / down
 g.font='10px system-ui';[['up','#0ef',4],['dn','#f4f',76]].forEach(([k,col,x0])=>{g.strokeStyle=col;g.beginPath();S.forEach((s,i)=>{const x=x0+Math.min(1,Math.max(0,s[k]/160))*68;i?g.lineTo(x,Y(s.tvd)):g.moveTo(x,Y(s.tvd))});g.stroke();g.fillStyle=col;g.fillText('GR '+k,x0,12)});
 if(K){for(const [n,s,col,fill] of [['top','sTop','#0ef','rgba(0,230,255,0.22)'],['bot','sBot','#f4f','rgba(255,64,255,0.2)']]){const P=K.grid;g.fillStyle=fill;g.beginPath();P.forEach((p,i)=>i?g.lineTo(X(p.hd),Y(p[n]-p[s])):g.moveTo(X(p.hd),Y(p[n]-p[s])));[...P].reverse().forEach(p=>g.lineTo(X(p.hd),Y(p[n]+p[s])));g.fill();g.strokeStyle=col;g.lineWidth=2;g.beginPath();P.forEach((p,i)=>i?g.lineTo(X(p.hd),Y(p[n])):g.moveTo(X(p.hd),Y(p[n])));g.stroke();g.lineWidth=1}
  for(const c of [...A.cr,...A.q.obs]){g.fillStyle=c.boundary=='top'?'#0ef':'#f4f';g.globalAlpha=c.R>0.1?0.35:0.9;g.fillRect(X(c.hd)-1.5,Y(c.tvd)-1.5,3,3)}g.globalAlpha=1}
 // Doug
 const RV=refs.filter(r=>r.hd>=h0-1&&r.hd<=h1+1);for(const [k,col] of [['roof','#ff5'],['floor','#f84']]){g.strokeStyle=col;g.setLineDash([6,4]);g.lineWidth=2;g.beginPath();RV.forEach((p,i)=>i?g.lineTo(X(p.hd),Y(p[k])):g.moveTo(X(p.hd),Y(p[k])));g.stroke();g.setLineDash([]);g.lineWidth=1}
 for(const r of ST.cmp?.r||[]){g.strokeStyle=r.agree?'#7f7':'#f55';g.beginPath();g.moveTo(X(r.hd),Y(r.ref));g.lineTo(X(r.hd),Y(r.est));g.stroke()}
 // trajectory
 g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();S.forEach((s,i)=>i?g.lineTo(X(s.hd),Y(s.tvd)):g.moveTo(X(s.hd),Y(s.tvd)));g.stroke();g.lineWidth=1;
 g.fillStyle='#ccc';const ts=(t1-t0)<=12?1:2;for(let t=Math.ceil(t0/ts)*ts;t<=t1;t+=ts){g.fillText((t-kb).toFixed(0),w-55,Y(t)+3);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(gx,Y(t),w-gx-60,1);g.fillStyle='#ccc'}g.fillText('TVDSS m',w-55,12);
 for(let d=Math.ceil(h0/25)*25;d<=h1;d+=25)g.fillText(d.toFixed(0),X(d)-8,h-28);g.fillText('HD m along well',gx,h-28);
 g.font='bold 11px system-ui';g.fillStyle='#0ef';g.fillText(ALABEL+' roof (cyan) / floor (magenta) ±1σ',gx,h-14);g.fillStyle='#ff5';g.fillText("Doug's BL ROOF / BL FLOOR (dashed) · residual ticks green=within 2σ",gx,h-2);
 g.fillStyle='#fb4';g.font='bold 12px system-ui';g.fillText(/SIM/.test(ST.mode)?'SIM-TEST — not real gamma':'WITSML',gx+4,16)}
function panel(){if($('r53'))return;if(!$('g8kal')){setTimeout(panel,500);return}const p=document.createElement('div');p.id='r53';p.style.cssText='display:none;margin:6px 0;padding:6px;background:#141c22;border:1px solid #467;border-radius:4px';
 p.innerHTML=`<b>Roof / floor — ${ALABEL} vs Doug</b> <span style="opacity:.7">4-quadrant gamma (up/down = distance to roof/floor; left/right = check) + Kalman/RTS. No real quadrant gamma tested yet.</span><br>
 <button id=r53syn>Run SIM-TEST synthetic (report-shaped)</button> <button id=r53syn2>SIM-TEST: 1.2 m seam (floor in reach)</button> <button id=r53live>Use WITSML quadrant gamma</button> <button id=r53doug>Load Doug's picks (transcribed)</button><br>
 <label>Quadrant mapping <input id=r53map style="width:230px" placeholder="up=GMUQ,dn=GMDQ,lt=GMLQ,rt=GMRQ,avg=GMAVG"></label> <label>L (m) <input id=r53L type=number step=0.05 value=0.35 style="width:50px"></label> <label>thickness prior (m, used only if one boundary seen) <input id=r53th type=number step=0.1 value=2 style="width:50px"></label><br>
 <label>Doug's picks: <select id=r53ax><option value=hpl>HPL</option><option value=md>MD</option></select> roof floor (TVDSS m), one per line</label><textarea id=r53t rows=3 style="width:100%;font:11px monospace" placeholder="2590.7 106.9 109.9"></textarea>
 <button id=r53cmp>Compare</button><div id=r53o style="margin-top:4px"></div><canvas id=r53c style="width:100%;height:210px;background:#1a140c"></canvas><div id=r53dbg style="font-size:11px;margin-top:4px"></div>`;
 const at=$('g8kal');at.parentNode.insertBefore(p,at);const b=document.createElement('button');b.id='r53btn';b.textContent='🎯 Roof/floor';$('g8load').parentNode.insertBefore(b,$('g8load'));
 $('r53map').value=localStorage.getItem('dw_qmap53')||'';$('r53map').onchange=()=>{localStorage.setItem('dw_qmap53',$('r53map').value);const g=G();g.CF.qmap=$('r53map').value};G().CF.qmap=$('r53map').value;
 b.onclick=()=>{p.style.display=p.style.display=='none'?'block':'none';dbg()};$('r53syn').onclick=()=>runSynth();$('r53syn2').onclick=()=>runSynth(1.2);$('r53live').onclick=runLive;$('r53doug').onclick=async()=>{await loadDoug();if(ST.S)run()};$('r53cmp').onclick=()=>{if(ST.S)run();else draw()}}
export function init(){window.GX=window.GX||{};GX.q53={findQuad,parseMap,otsu,quadObs,autoPick,parseDoug,dougToCurtain,compareDoug,synthQuad,seamFrom,runSynth,runLive,run,ST,ALABEL};panel()}
