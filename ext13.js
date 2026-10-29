// ext13.js v5.5: BLIND prediction log + human-pick import + scorecard (auto-pick vs geologist picks).
// Append-only: each entry is the causal (filtered, at-bit) Kalman estimate at the moment the bit reached that MD; never re-written later.
// Labels: LIVE only when the quadrant gamma came from the real WITSML feed (not sim); everything else SIM-TEST. No network calls here.
const $=id=>document.getElementById(id);const es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
const LK='dw_predlog55',HK='dw_human55',TOL=0.5;
const q=()=>window.GX?.q53,G=()=>window.GX?.geo8;
const fnv=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h.toString(16).padStart(8,'0')};
export const ST={log:[],human:null,sc:null};
function loadLS(){try{ST.log=JSON.parse(localStorage.getItem(LK)||'[]')}catch{ST.log=[]}try{ST.human=JSON.parse(localStorage.getItem(HK)||'null')}catch{ST.human=null}}
function saveLog(){try{localStorage.setItem(LK,JSON.stringify(ST.log))}catch(e){console.warn('log save',e)}}
export function verify(log=ST.log){let p='0';for(const e of log){const {h,...b}=e;if(fnv(p+JSON.stringify(b))!==h)return false;p=h}return true}
// append one frozen entry (only if MD is beyond the last logged MD of the same run)
export function append(e,log=ST.log){const last=log.filter(x=>x.run==e.run).at(-1);if(last&&e.md<=last.md+0.25)return null;const b={...e,t:e.t||new Date().toISOString()};const h=fnv((log.at(-1)?.h||'0')+JSON.stringify(b));const r=Object.freeze({...b,h});log.push(r);return r}
// causal estimate at the bit from autoPick on data up to the bit (RTS end point == filtered estimate, no look-ahead)
export function entryFrom(A,S,kb,label,run){const e=A.K.grid.at(-1),s=S.at(-1);return {run,label,md:+s.md.toFixed(2),hd:+e.hd.toFixed(2),roof:+(e.top-kb).toFixed(3),sRoof:+e.sTop.toFixed(3),floor:+(e.bot-kb).toFixed(3),sFloor:+e.sBot.toFixed(3),seenRoof:A.nT>0,seenFloor:A.nB>0,measured:!!A.measured,nObs:A.nT+A.nB}}
// SIM-TEST blind replay: walk the bit through the synthetic run, predicting only from data behind the bit
export async function simReplay(o={}){const Q=q(),g=G();await Q.runSynth(o.thick);const S=Q.ST.S,kb=+g.CF.kb||0;const H=ST.human?.picks?.length?ST.human:parseHuman(await (await fetch('fixtures/westside_roof_floor_2879.json?v=55')).text(),'Doug WestSide BL (SIM-TEST fixture)');if(!ST.human)setHuman(H);
 const m0=Math.min(...H.picks.map(p=>p.md))-(o.pre??60),m1=Math.max(...H.picks.map(p=>p.md)),step=o.step??5,run='SIM-TEST '+new Date().toISOString();let n=0;
 const W=S.filter(s=>s.md>=m0-60&&s.md<=m1+0.01);for(let md=m0;md<=m1+1e-6;md+=step){const P=W.filter(s=>s.md<=md);if(P.length<20)continue;const A=Q.autoPick(P,{L:0.35,thPrior:2,priorSrc:'user prior',K9:g.K9});if(A.none||!A.K)continue;if(append(entryFrom(A,P,kb,'SIM-TEST',run)))n++}
 saveLog();score();draw();return n}
// LIVE/WITSML: called after each live autopick; appends at the current bit MD
export function recordLive(){const Q=q(),g=G();if(!Q?.ST?.A||Q.ST.A.none||!Q.ST.S?.length)return null;const live=/^WITSML/.test(Q.ST.mode||'')&&!g.G8.sim;const label=live?'LIVE':'SIM-TEST';const r=append(entryFrom(Q.ST.A,Q.ST.S,+g.CF.kb||0,label,ST.liveRun||(ST.liveRun=label+' '+new Date().toISOString())));if(r){saveLog();score();draw()}return r}
// ---------- human picks: fixture JSON ({hplToMd, points:[{hpl|md, roof, floor}]}), JSON array, or CSV/whitespace (md|hpl, roof, floor) ----------
export function parseHuman(text,src){text=String(text||'').trim();let picks=[],meta={};
 if(/^[\[{]/.test(text)){const J=JSON.parse(text),P=Array.isArray(J)?J:(J.points||J.picks||[]),off=+(J.hplToMd??288.4);meta={label:J.label,well:J.well,hplToMd:off};
  picks=P.map(p=>({md:isFinite(+p.md)?+p.md:+p.hpl+off,roof:+p.roof,floor:+p.floor,t:p.t||p.time||undefined}))}
 else{const L=text.split(/\r?\n/);let axis='md',off=288.4;const hd=L[0].toLowerCase();if(/[a-z]/.test(hd)&&!/^\s*-?\d/.test(hd)){if(/hpl/.test(hd))axis='hpl';L.shift()}const m=text.match(/hplToMd\s*[=:]\s*(-?\d+(\.\d+)?)/i);if(m)off=+m[1];
  for(const l of L){if(/^\s*#/.test(l))continue;const n=l.split(/[,;\t ]+/).map(x=>x.trim()).filter(x=>/^-?\d+(\.\d+)?$/.test(x)).map(Number);if(n.length<3)continue;picks.push({md:axis=='hpl'?n[0]+off:n[0],roof:n[1],floor:n[2]})}meta={axis,hplToMd:off}}
 picks=picks.filter(p=>isFinite(p.md)&&(isFinite(p.roof)||isFinite(p.floor))).sort((a,b)=>a.md-b.md);return {src:src||meta.label||'pasted picks',meta,picks,loaded:new Date().toISOString()}}
function setHuman(H){ST.human=H;try{localStorage.setItem(HK,JSON.stringify(H))}catch{}}
// ---------- scorecard ----------
const stats=a=>{if(!a.length)return null;const ab=a.map(Math.abs).sort((x,y)=>x-y),n=a.length;return {n,mean:ab.reduce((s,x)=>s+x,0)/n,median:n%2?ab[(n-1)/2]:(ab[n/2-1]+ab[n/2])/2,max:ab.at(-1),bias:a.reduce((s,x)=>s+x,0)/n,within:a.filter(x=>Math.abs(x)<=TOL).length/n}};
export function score(log=ST.log,H=ST.human,o={}){if(!H?.picks?.length||!log.length)return ST.sc=null;const runs=[...new Set(log.map(e=>e.run))],run=o.run||runs.at(-1),L=log.filter(e=>e.run==run),win=o.win??3;
 const rows=[];for(const p of H.picks){let b=null;for(const e of L){const d=Math.abs(e.md-p.md);if(d<=win&&(!b||d<Math.abs(b.md-p.md)))b=e}if(!b)continue;rows.push({md:p.md,predMd:b.md,t:b.t,hRoof:p.roof,hFloor:p.floor,pRoof:b.roof,sRoof:b.sRoof,pFloor:b.floor,sFloor:b.sFloor,eRoof:isFinite(p.roof)?b.roof-p.roof:NaN,eFloor:isFinite(p.floor)?b.floor-p.floor:NaN,seenRoof:b.seenRoof,seenFloor:b.seenFloor})}
 const lead=k=>{const K=k=='roof'?'seenRoof':'seenFloor',e=L.find(x=>x[K]),h=H.picks.find(p=>isFinite(p[k])&&p.md>=L[0].md-0.25);if(!e||!h)return {seen:!!e,firstSeenMd:e?.md??null,humanFirstMd:h?.md??null,leadM:null};
  // per-pick: earliest log entry at/behind the pick MD (≤30 m) already within ±TOL of the human value
  const pp=H.picks.filter(p=>isFinite(p[k])).map(p=>{const c=L.find(x=>x.md<=p.md+0.25&&x.md>=p.md-30&&x[K]&&Math.abs(x[k]-p[k])<=TOL);return c?p.md-c.md:null}).filter(x=>x!=null);
  return {seen:true,firstSeenMd:e.md,humanFirstMd:h.md,leadM:+(h.md-e.md).toFixed(2),perPickLeadMedian:pp.length?pp.sort((a,b)=>a-b)[Math.floor(pp.length/2)]:null,perPickN:pp.length}};
 const label=L.every(e=>e.label=='LIVE')?'LIVE':L.some(e=>e.label=='LIVE')?'MIXED':'SIM-TEST';
 return ST.sc={run,label,human:H.src,rows,roof:stats(rows.map(r=>r.eRoof).filter(isFinite)),floor:stats(rows.map(r=>r.eFloor).filter(isFinite)),lead:{roof:lead('roof'),floor:lead('floor')},verified:verify(log)}}
// ---------- export ----------
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
export function toCSV(log=ST.log){return 'run,label,timestamp,md_m,hd_m,roof_tvdss_m,roof_sigma_m,floor_tvdss_m,floor_sigma_m,roof_seen,floor_seen,measured_thickness,n_obs,hash\n'+log.map(e=>[e.run,e.label,e.t,e.md,e.hd,e.roof,e.sRoof,e.floor,e.sFloor,e.seenRoof,e.seenFloor,e.measured,e.nObs,e.h].join(',')).join('\n')}
export function scoreCSV(sc=ST.sc){if(!sc)return '';return '# '+sc.label+' scorecard vs '+sc.human+'\nmd_m,pred_md_m,pred_time,human_roof,pred_roof,roof_sigma,err_roof,human_floor,pred_floor,floor_sigma,err_floor\n'+sc.rows.map(r=>[r.md,r.predMd,r.t,r.hRoof,r.pRoof,r.sRoof,r.eRoof.toFixed(3),r.hFloor,r.pFloor,r.sFloor,r.eFloor.toFixed(3)].join(',')).join('\n')}
// ---------- UI ----------
const f2=x=>x==null||!isFinite(x)?'–':(+x).toFixed(2);
function stLine(n,s){return s?`<tr><td>${n}</td><td>${s.n}</td><td>${f2(s.mean)}</td><td>${f2(s.median)}</td><td>${f2(s.max)}</td><td>${(s.bias>=0?'+':'')+f2(s.bias)}</td><td>${Math.round(100*s.within)}%</td></tr>`:`<tr><td>${n}</td><td colspan=6>no overlap</td></tr>`}
function draw(){const o=$('p55o');if(!o)return;const L=ST.log,sc=ST.sc,H=ST.human;let h=`<b>Blind log</b>: ${L.length} frozen entries${L.length?' ('+[...new Set(L.map(e=>e.label))].join('/')+', MD '+f2(Math.min(...L.map(e=>e.md)))+'–'+f2(Math.max(...L.map(e=>e.md)))+' m)':''} · chain ${verify()?'<span style=color:#7f7>intact</span>':'<span style=color:#f55>BROKEN — edited?</span>'} · human picks: ${H?.picks?.length?es(H.src)+' ('+H.picks.length+', MD '+f2(H.picks[0].md)+'–'+f2(H.picks.at(-1).md)+')':'<span style=color:#fb4>none loaded</span>'}<br>`;
 if(sc){const lb=sc.label=='LIVE'?'<span style=color:#7f7>LIVE</span>':'<span style=color:#fb4>'+sc.label+(sc.label!='LIVE'?' — not real feed':'')+'</span>';
  h+=`<b>Scorecard</b> ${lb} · ${sc.rows.length} matched MDs · error = predicted − human (TVDSS m, + = we are deeper)<table style="font-size:11px;border-collapse:collapse" border=1 cellpadding=2><tr><th></th><th>n</th><th>mean|e|</th><th>median|e|</th><th>max|e|</th><th>bias</th><th>±${TOL} m</th></tr>${stLine('Roof',sc.roof)}${stLine('Floor',sc.floor)}</table>`;
  for(const k of ['roof','floor']){const d=sc.lead[k];h+=`${k=='roof'?'Roof':'Floor'} lead: ${d.seen?'first seen at MD '+f2(d.firstSeenMd)+' vs first human pick MD '+f2(d.humanFirstMd)+' → <b>'+(d.leadM>=0?d.leadM+' m ahead':(-d.leadM)+' m behind')+'</b>'+(d.perPickN?' · median per-pick lead (within ±'+TOL+' m) '+f2(d.perPickLeadMedian)+' m over '+d.perPickN+' picks':''):'<span style=color:#fb4>never seen by the filter (prior thickness only)</span>'}<br>`}}
 o.innerHTML=h;const t=$('p55tbl');if(t)t.innerHTML=sc?'<table style="font-size:10px;border-collapse:collapse;width:100%" border=1 cellpadding=1><tr><th>MD</th><th>roof H/P</th><th>e</th><th>floor H/P</th><th>e</th></tr>'+sc.rows.map(r=>`<tr><td>${f2(r.md)}</td><td>${f2(r.hRoof)}/${f2(r.pRoof)}</td><td style="color:${Math.abs(r.eRoof)<=TOL?'#7f7':'#f55'}">${f2(r.eRoof)}</td><td>${f2(r.hFloor)}/${f2(r.pFloor)}</td><td style="color:${Math.abs(r.eFloor)<=TOL?'#7f7':'#f55'}">${f2(r.eFloor)}</td></tr>`).join('')+'</table>':'';curtain()}
// curtain overlay: MD vs TVDSS — prediction band (frozen, at-bit values) + human picks (dashed) + error ticks
function curtain(){const cv=$('p55c');if(!cv)return;const w=cv.width=Math.min(900,cv.clientWidth*2||700),h=cv.height=380,g=cv.getContext('2d');g.fillStyle='#1a140c';g.fillRect(0,0,w,h);const sc=ST.sc,L=ST.log.filter(e=>!sc||e.run==sc.run),H=ST.human?.picks||[];if(!L.length&&!H.length){g.fillStyle='#999';g.font='12px system-ui';g.fillText('No log / human picks yet',10,20);return}
 const md=[...L.map(e=>e.md),...H.map(p=>p.md)],tv=[...L.flatMap(e=>[e.roof-e.sRoof,e.floor+e.sFloor]),...H.flatMap(p=>[p.roof,p.floor])].filter(isFinite);const m0=Math.min(...md),m1=Math.max(...md),t0=Math.min(...tv)-0.5,t1=Math.max(...tv)+0.5;const X=m=>40+(m-m0)/((m1-m0)||1)*(w-100),Y=t=>20+(t-t0)/((t1-t0)||1)*(h-60);
 g.fillStyle='rgba(200,170,60,0.18)';if(H.length){g.beginPath();H.forEach((p,i)=>i?g.lineTo(X(p.md),Y(p.roof)):g.moveTo(X(p.md),Y(p.roof)));[...H].reverse().forEach(p=>g.lineTo(X(p.md),Y(p.floor)));g.fill()}
 for(const [k,s,c,f] of [['roof','sRoof','#0ef','rgba(0,230,255,0.22)'],['floor','sFloor','#f4f','rgba(255,64,255,0.2)']]){if(!L.length)break;g.fillStyle=f;g.beginPath();L.forEach((e,i)=>i?g.lineTo(X(e.md),Y(e[k]-e[s])):g.moveTo(X(e.md),Y(e[k]-e[s])));[...L].reverse().forEach(e=>g.lineTo(X(e.md),Y(e[k]+e[s])));g.fill();g.strokeStyle=c;g.lineWidth=2;g.beginPath();L.forEach((e,i)=>i?g.lineTo(X(e.md),Y(e[k])):g.moveTo(X(e.md),Y(e[k])));g.stroke();g.lineWidth=1}
 for(const [k,c] of [['roof','#ff5'],['floor','#f84']]){g.strokeStyle=c;g.setLineDash([6,4]);g.lineWidth=2;g.beginPath();H.filter(p=>isFinite(p[k])).forEach((p,i)=>i?g.lineTo(X(p.md),Y(p[k])):g.moveTo(X(p.md),Y(p[k])));g.stroke();g.setLineDash([]);g.lineWidth=1}
 for(const r of sc?.rows||[])for(const k of ['Roof','Floor']){const e=r['e'+k];if(!isFinite(e))continue;g.strokeStyle=Math.abs(e)<=TOL?'#7f7':'#f55';g.beginPath();g.moveTo(X(r.md),Y(r['h'+k]));g.lineTo(X(r.md),Y(r['p'+k]));g.stroke()}
 g.fillStyle='#ccc';g.font='10px system-ui';const ts=(t1-t0)<=8?1:2;for(let t=Math.ceil(t0/ts)*ts;t<=t1;t+=ts){g.fillText(t.toFixed(0),w-55,Y(t)+3);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(40,Y(t),w-100,1);g.fillStyle='#ccc'}g.fillText('TVDSS m',w-55,12);for(let d=Math.ceil(m0/50)*50;d<=m1;d+=50)g.fillText(d.toFixed(0),X(d)-10,h-28);g.fillText('MD m',40,h-28);
 g.font='bold 11px system-ui';g.fillStyle='#0ef';g.fillText('Blind prediction at bit: roof (cyan) / floor (magenta) ±1σ',40,h-14);g.fillStyle='#ff5';g.fillText('Human picks (dashed) · ticks green = within ±'+TOL+' m',40,h-2);
 const lab=sc?.label||(L.some(e=>e.label=='LIVE')?'LIVE':'SIM-TEST');g.fillStyle=lab=='LIVE'?'#7f7':'#fb4';g.font='bold 13px system-ui';g.fillText(lab=='LIVE'?'LIVE':lab+' — not real feed',44,16)}
function panel(){if($('p55'))return;const host=$('r53');if(!host){setTimeout(panel,600);return}const p=document.createElement('div');p.id='p55';p.style.cssText='margin-top:6px;padding:6px;border-top:1px solid #467';
 p.innerHTML=`<b>📒 Blind prediction log vs human picks</b> <span style="opacity:.7">Each entry = filter estimate at the bit when the bit reached that MD (no look-ahead), frozen + hash-chained, saved on this device.</span><br>
 <label><input type=checkbox id=p55arm> Record while live (auto-pick every 60 s on new WITSML quadrant gamma)</label> <button id=p55sim>SIM-TEST blind replay (Doug fixture)</button><br>
 <label>Human picks (paste JSON/CSV: md,roof,floor or hpl,roof,floor; TVDSS m)</label><textarea id=p55h rows=3 style="width:100%;font:11px monospace" placeholder='md,roof,floor&#10;2900,106.7,109.7   — or paste the fixture JSON {"hplToMd":288.4,"points":[{"hpl":..,"roof":..,"floor":..}]}'></textarea>
 <button id=p55imp>Import pasted</button> <label style="display:inline-block">📎 <input type=file id=p55file accept=".json,.csv,.txt,application/json,text/csv" style="width:170px"></label> <button id=p55doug>Doug fixture</button><br>
 <button id=p55csv>Export log CSV</button> <button id=p55json>Export log JSON</button> <button id=p55scsv>Export scorecard CSV</button> <button id=p55clr>Archive &amp; clear log</button>
 <div id=p55o style="margin-top:4px;font-size:12px"></div><canvas id=p55c style="width:100%;height:190px;background:#1a140c"></canvas><div id=p55tbl style="max-height:160px;overflow:auto"></div>`;
 host.appendChild(p);
 const imp=(t,src)=>{try{const H=parseHuman(t,src);if(!H.picks.length)throw new Error('no picks found (need md|hpl, roof, floor)');setHuman(H);score();draw()}catch(e){$('p55o').innerHTML='<span style=color:#f55>Import failed: '+es(e.message)+'</span>'}};
 $('p55imp').onclick=()=>imp($('p55h').value,'pasted picks '+new Date().toISOString().slice(0,16));
 $('p55file').onchange=async e=>{const f=e.target.files[0];if(f)imp(await f.text(),f.name)};
 $('p55doug').onclick=async()=>imp(await (await fetch('fixtures/westside_roof_floor_2879.json?v=55')).text(),'Doug WestSide BL (SIM-TEST fixture, transcribed from report image)');
 $('p55sim').onclick=async()=>{$('p55o').textContent='Replaying…';await simReplay()};
 const ts=()=>new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
 $('p55csv').onclick=()=>dl('blind_log_'+ts()+'.csv',toCSV(),'text/csv');$('p55json').onclick=()=>dl('blind_log_'+ts()+'.json',JSON.stringify({human:ST.human,log:ST.log,scorecard:ST.sc},null,1),'application/json');$('p55scsv').onclick=()=>dl('scorecard_'+ts()+'.csv',scoreCSV(),'text/csv');
 $('p55clr').onclick=()=>{if(!ST.log.length||!confirm('Download the log, then clear it from this device?'))return;dl('blind_log_archive_'+ts()+'.json',JSON.stringify(ST.log),'application/json');ST.log=[];ST.liveRun=null;saveLog();score();draw()};
 $('p55arm').checked=localStorage.getItem('dw_arm55')=='1';$('p55arm').onchange=()=>localStorage.setItem('dw_arm55',$('p55arm').checked?'1':'0');
 score();draw()}
// live hook: if armed, re-run the WITSML auto-pick when the quadrant log grows (reads data already fetched by the app; no extra requests, no retries)
let lastN=0;if(typeof document!='undefined')setInterval(()=>{try{if(!$('p55arm')?.checked)return;const g=G(),Q=q();const n=g?.G8?.quad?.rows?.length||0;if(!n||n==lastN)return;lastN=n;Q.runLive();recordLive()}catch(e){console.warn('p55',e)}},60000);
export function init(){loadLS();window.GX=window.GX||{};GX.p55={ST,append,verify,entryFrom,simReplay,recordLive,parseHuman,score,toCSV,scoreCSV,setHuman,draw};panel()}
