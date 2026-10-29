// geo.js v3.8: subsurface layers + survey maths + WITSML/CSV parsers. Pure functions (no DOM) so node can unit-test them.
// Internal units: depth ft, angles deg, DLS deg/100ft, UCS psi, porosity fraction, pore/frac pressure as EMW ppg.
export const R=Math.PI/180,FT_M=0.3048;
const LEN={ft:1,m:1/FT_M,'ft_us':1,usft:1};const ANG={dega:1,deg:1,'°':1,rad:1/R};
const lenToFt=(v,u)=>{u=String(u||'ft').toLowerCase();return v*(LEN[u]??(u.startsWith('m')?1/FT_M:1))};
const angToDeg=(v,u)=>v*(ANG[String(u||'dega').toLowerCase()]??1);
// ---- minimum curvature ----
export function minCurvStations(st,{vsAzi=null,tieIn=null}={}){
 const s=st.filter(x=>isFinite(x.md)&&isFinite(x.inc)&&isFinite(x.azi)).map(x=>({...x})).sort((a,b)=>a.md-b.md);if(!s.length)return[];
 // v5.2: a survey that starts deep (sidetrack / partial trajectory) ties in at the first station's REPORTED TVD (WITSML <tvd>), not md*cos(inc)
 const r0=s[0],hasRep=isFinite(r0.tvd_rep)&&r0.md>0;const t=tieIn||(hasRep?{tvd:r0.tvd_rep,ns:r0.ns_rep??0,ew:r0.ew_rep??0}:{tvd:r0.md*Math.cos(r0.inc*R),ns:0,ew:0});// else: straight hole from surface to first station
 Object.assign(s[0],{tvd:t.tvd,ns:t.ns,ew:t.ew,dls:0});if(!tieIn&&hasRep)s[0].tie='reported TVD';
 for(let k=1;k<s.length;k++){const a=s[k-1],b=s[k],i1=a.inc*R,i2=b.inc*R,a1=a.azi*R,a2=b.azi*R,dm=b.md-a.md;
  const cb=Math.cos(i2-i1)-Math.sin(i1)*Math.sin(i2)*(1-Math.cos(a2-a1)),dl=Math.acos(Math.max(-1,Math.min(1,cb))),rf=dl<1e-9?1:2/dl*Math.tan(dl/2);
  b.ns=a.ns+dm/2*(Math.sin(i1)*Math.cos(a1)+Math.sin(i2)*Math.cos(a2))*rf;b.ew=a.ew+dm/2*(Math.sin(i1)*Math.sin(a1)+Math.sin(i2)*Math.sin(a2))*rf;b.tvd=a.tvd+dm/2*(Math.cos(i1)+Math.cos(i2))*rf;b.dls=dm>0?dl/R/dm*100:0}
 const l=s.at(-1),va=(vsAzi??(Math.atan2(l.ew,l.ns)/R))*R;for(const x of s)x.vs=x.ns*Math.cos(va)+x.ew*Math.sin(va);return s}
export const dlsPer30m=d=>d*30/(100*FT_M);// deg/100ft -> deg/30m
export function interpAt(s,md){if(!s.length)return null;if(md<=s[0].md)return {...s[0],md};for(let k=1;k<s.length;k++)if(md<=s[k].md){const a=s[k-1],b=s[k],f=(md-a.md)/(b.md-a.md||1);const o={md};for(const q of ['inc','tvd','ns','ew','vs','dls'])o[q]=a[q]+f*(b[q]-a[q]);o.azi=a.azi+f*((((b.azi-a.azi)%360)+540)%360-180);o.azi=(o.azi+360)%360;return o}
 const l=s.at(-1),dm=md-l.md;return {...l,md,tvd:l.tvd+dm*Math.cos(l.inc*R),ns:l.ns+dm*Math.sin(l.inc*R)*Math.cos(l.azi*R),ew:l.ew+dm*Math.sin(l.inc*R)*Math.sin(l.azi*R)}}
// path crosses layer tops (by TVD) -> [{name,md,tvd,ns,ew}]
export function crossings(s,layers){const out=[];for(const L of layers){const z=L.top_tvd??L.top_md;if(!isFinite(z))continue;for(let k=1;k<s.length;k++){const a=s[k-1],b=s[k];if((a.tvd-z)*(b.tvd-z)<=0&&a.tvd!==b.tvd){const f=(z-a.tvd)/(b.tvd-a.tvd);out.push({name:L.name,md:a.md+f*(b.md-a.md),tvd:z,ns:a.ns+f*(b.ns-a.ns),ew:a.ew+f*(b.ew-a.ew)});break}}}return out}
export function formationAt(layers,md,tvd){for(const L of layers){if(tvd!=null&&isFinite(L.top_tvd)&&isFinite(L.base_tvd)){if(tvd>=L.top_tvd&&tvd<L.base_tvd)return L}else if(md>=L.top_md&&md<L.base_md)return L}return null}
// ---- SIMULATED example (NOT real formation data) ----
export const SIM_LAYERS=()=>[['SIM-A claystone (SIMULATED)',0,600,'#9c7b52',3000,.30,8.6,13.0],['SIM-B sandstone (SIMULATED)',600,1400,'#d8b46a',6000,.22,8.8,14.0],['SIM-C shale (SIMULATED)',1400,2300,'#6b6458',9000,.10,9.4,15.2],['SIM-D limestone (SIMULATED)',2300,3000,'#b9b5a6',16000,.06,9.6,16.0],['SIM-E sandstone reservoir (SIMULATED)',3000,4000,'#c99a4a',7000,.20,10.2,15.5]]
 .map(([name,a,b,color,ucs,phi,pp,fp])=>({name,top_md:a,base_md:b,top_tvd:a,base_tvd:b,color,lith:name.split(' ')[1],ucs_psi:ucs,porosity:phi,pp_ppg:pp,fp_ppg:fp,src:'SIMULATED'}));
// ---- WITSML 1.4.1.1 parsers (regex based, namespace-agnostic) ----
const tag=(x,t)=>{const m=x.match(new RegExp('<(?:\\w+:)?'+t+'\\b([^>]*)>([\\s\\S]*?)</(?:\\w+:)?'+t+'>'));return m?{v:m[2].trim(),uom:(m[1].match(/uom="([^"]*)"/)||[])[1]}:null};
const blocks=(x,t)=>[...x.matchAll(new RegExp('<(?:\\w+:)?'+t+'\\b[^>]*>[\\s\\S]*?</(?:\\w+:)?'+t+'>','g'))].map(m=>m[0]);
const num=(x,t,conv)=>{const g=tag(x,t);if(!g||g.v===''||!isFinite(+g.v))return undefined;return conv?conv(+g.v,g.uom):+g.v};
export function parseFormationMarkers(xml){const out=[];for(const b of blocks(xml,'formationMarker')){const name=tag(b,'name')?.v||'?';
  const md=num(b,'mdPrognosed',lenToFt)??num(b,'mdTopSample',lenToFt),tvd=num(b,'tvdPrognosed',lenToFt)??num(b,'tvdTopSample',lenToFt),th=num(b,'thicknessBed',lenToFt)??num(b,'thicknessApparent',lenToFt);
  const lith=tag(b,'lithostratigraphic')?.v||tag(b,'chronostratigraphic')?.v||'';out.push({name,top_md:md,top_tvd:tvd,th,lith,src:'WITSML formationMarker'})}
 out.sort((a,b)=>(a.top_md??a.top_tvd)-(b.top_md??b.top_tvd));
 out.forEach((L,i)=>{const n=out[i+1];L.base_md=L.th?L.top_md+L.th:(n?n.top_md:L.top_md+500);L.base_tvd=isFinite(L.top_tvd)?(L.th?L.top_tvd+L.th:(n&&isFinite(n.top_tvd)?n.top_tvd:L.top_tvd+500)):undefined;if(!isFinite(L.top_tvd)){L.top_tvd=L.top_md;L.base_tvd=L.base_md}delete L.th;L.color=colorFor(L.lith||L.name,i)});return out}
export function parseTrajectory(xml){const st=[];for(const b of blocks(xml,'trajectoryStation')){const md=num(b,'md',lenToFt),inc=num(b,'incl',angToDeg),azi=num(b,'azi',angToDeg);if([md,inc,azi].every(isFinite))st.push({md,inc,azi,tvd_rep:num(b,'tvd',lenToFt),_nu:!tag(b,'incl')?.uom&&!tag(b,'azi')?.uom})}
 // v4.6: no uom at all + every angle within radian range (inc<=pi, azi<=2pi, some azi>0.2 and none >6.3) -> values are radians
 let radGuess=false;if(st.length>=3&&st.every(s=>s._nu)&&st.every(s=>Math.abs(s.inc)<=Math.PI+1e-6&&s.azi>=0&&s.azi<=2*Math.PI+1e-6)&&st.some(s=>s.inc>0.05)){radGuess=true;for(const s of st){s.inc*=180/Math.PI;s.azi*=180/Math.PI}}
 st.forEach(s=>delete s._nu);
 const name=tag(xml.replace(/<trajectoryStation[\s\S]*$/,''),'name')?.v||'trajectory';return {name,radGuess,stations:st.sort((a,b)=>a.md-b.md)}}
const PAL={sand:'#d8b46a',clay:'#9c7b52',shale:'#6b6458',lime:'#b9b5a6',carb:'#b9b5a6',dolo:'#a7a39a',salt:'#e8e8f0',coal:'#333',silt:'#a08a6a'};
export function colorFor(s,i=0){s=String(s).toLowerCase();for(const k in PAL)if(s.includes(k))return PAL[k];return ['#8a6f4d','#a58a5c','#7b6a58','#5d5248','#9b8c70'][i%5]}
// ---- CSV (unit in header: top_m / top_ft / "top [m]"; unitless = current system) ----
function hdr(h,sys){const m=h.trim().toLowerCase().match(/^(.*?)\s*(?:\[([^\]]+)\]|\(([^)]+)\))$/);let n=h.trim().toLowerCase(),u=null;if(m){n=m[1];u=m[2]||m[3]}else{const k=n.match(/^(.*)_(m|ft|mpa|psi|kpa|pct|frac|ppg|sg|kgm3|deg|dega|rad)$/);if(k){n=k[1];u=k[2]}}return {n:n.replace(/[\s-]+/g,'_'),u}}
const lenC=(u,sys)=>(u||(sys=='metric'?'m':'ft'))=='m'?1/FT_M:1;
const prsC=u=>({mpa:145.0377,kpa:0.1450377,psi:1}[u]??(u==null?null:NaN));
const emw=(v,u,sys)=>{u=u||(sys=='metric'?'kgm3':'ppg');return u=='ppg'?v:u=='sg'?v*8.3454:u=='kgm3'||u=='kg/m3'?v/119.826:NaN};
const rows=t=>t.trim().split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>l.split(',').map(x=>x.trim()));
export function parseLayersCSV(text,sys='metric'){const [H,...R0]=rows(text);const hs=H.map(h=>hdr(h,sys)),log=[];const out=[];
 for(const r of R0){const L={src:'CSV'};hs.forEach((h,i)=>{const v=r[i];if(v==null||v==='')return;const x=+v,n=h.n;
  if(n=='name'||n=='formation')L.name=v;else if(n=='lith'||n=='lithology')L.lith=v;else if(n=='color'||n=='colour')L.color=v;
  else if(/^(top|top_md|base|base_md|top_tvd|base_tvd)$/.test(n))L[n.includes('_')?n:n+'_md']=x*lenC(h.u,sys);
  else if(n=='ucs'){const c=h.u?prsC(h.u):(sys=='metric'?145.0377:1);L.ucs_psi=x*c}
  else if(n=='porosity'||n=='phi')L.porosity=(h.u=='frac'||(!h.u&&x<=1))?x:x/100;
  else if(/^(pp|pore|pore_pressure)$/.test(n))L.pp_ppg=emw(x,h.u,sys);else if(/^(fp|frac|frac_pressure)$/.test(n))L.fp_ppg=emw(x,h.u,sys)});
  if(L.name&&isFinite(L.top_md)){L.base_md??=L.top_md+500;L.top_tvd??=L.top_md;L.base_tvd??=L.base_md;L.color??=colorFor(L.lith||L.name,out.length);out.push(L)}}
 hs.forEach(h=>log.push(h.n+(h.u?' ['+h.u+']':' [no unit: '+sys+' assumed]')));return {layers:out,log}}
export function parseSurveyCSV(text,sys='metric'){const [H,...R0]=rows(text);const hs=H.map(h=>hdr(h,sys));const im=hs.findIndex(h=>/^(md|depth|measured_depth)$/.test(h.n)),ii=hs.findIndex(h=>/^(inc|incl|inclination)$/.test(h.n)),ia=hs.findIndex(h=>/^(azi|az|azimuth)$/.test(h.n));
 if(im<0||ii<0||ia<0)throw new Error('survey CSV needs md, inc, azi columns');const ac=h=>h.u=='rad'?1/R:1;
 return R0.map(r=>({md:+r[im]*lenC(hs[im].u,sys),inc:+r[ii]*ac(hs[ii]),azi:+r[ia]*ac(hs[ia])})).filter(s=>[s.md,s.inc,s.azi].every(isFinite)).sort((a,b)=>a.md-b.md)}
// SIMULATED physics coupling: ROP and torque factors from formation (1.0 at UCS 8000 psi)
export const rockFactors=L=>{if(!L||!isFinite(L.ucs_psi))return {rop:1,tq:1};const u=Math.max(500,L.ucs_psi);return {rop:Math.max(0.25,Math.min(2.5,Math.sqrt(8000/u)*(1+((L.porosity??0.1)-0.1)))),tq:Math.max(0.7,Math.min(1.5,0.85+0.15*u/8000))}};
// ---- v3.9: exact minimum-curvature position at any MD (arc between stations; straight tangent beyond the last) ----
const tv=(i,a)=>[Math.sin(i*R)*Math.cos(a*R),Math.sin(i*R)*Math.sin(a*R),Math.cos(i*R)];
export function pointAt(s,md){if(!s.length)return null;if(md<=s[0].md){const a=s[0],dm=md-a.md,t=tv(a.inc,a.azi);return {md,inc:a.inc,azi:a.azi,ns:a.ns+dm*t[0],ew:a.ew+dm*t[1],tvd:a.tvd+dm*t[2],projected:false}}
 for(let k=1;k<s.length;k++){const a=s[k-1],b=s[k];if(md>b.md)continue;const dm=b.md-a.md;if(dm<=0)return {...b,md,projected:false};const u=(md-a.md)/dm,t1=tv(a.inc,a.azi),t2=tv(b.inc,b.azi);
  const dl=Math.acos(Math.max(-1,Math.min(1,t1[0]*t2[0]+t1[1]*t2[1]+t1[2]*t2[2])));let t;if(dl<1e-9)t=t1;else{const w1=Math.sin((1-u)*dl)/Math.sin(dl),w2=Math.sin(u*dl)/Math.sin(dl);t=t1.map((x,j)=>w1*x+w2*t2[j])}
  const inc=Math.acos(Math.max(-1,Math.min(1,t[2])))/R,azi=Math.hypot(t[0],t[1])<1e-12?a.azi:((Math.atan2(t[1],t[0])/R)+360)%360;
  const q=minCurvStations([{md:a.md,inc:a.inc,azi:a.azi},{md,inc,azi}],{tieIn:{tvd:a.tvd,ns:a.ns,ew:a.ew}})[1];return {md,inc,azi,ns:q.ns,ew:q.ew,tvd:q.tvd,dls:b.dls,projected:false}}
 const l=s.at(-1),dm=md-l.md,t=tv(l.inc,l.azi);return {md,inc:l.inc,azi:l.azi,ns:l.ns+dm*t[0],ew:l.ew+dm*t[1],tvd:l.tvd+dm*t[2],dls:0,projected:true}}
export function samplePath(s,mdTo,step=20){const out=[];const m0=s[0]?.tie?s[0].md:0;// v5.2: deep tie-in → path starts at the tie-in (upper hole not in the survey, not invented)
 mdTo=Math.max(mdTo,m0+1);const n=Math.max(2,Math.ceil((mdTo-m0)/step));for(let i=0;i<=n;i++)out.push(pointAt(s,m0+(mdTo-m0)*i/n));return out}
// merge stations: dedupe by MD (|ΔMD|<0.05 ft) or uid; returns count of new stations
export function mergeStations(have,add){let n=0;for(const x of add){if(have.some(h=>(x.uid&&h.uid===x.uid)||Math.abs(h.md-x.md)<0.05))continue;have.push(x);n++}have.sort((a,b)=>a.md-b.md);return n}
