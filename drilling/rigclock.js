// rigclock.js: Rig time + local time HUD, real-time day/night at the rig, live weather at the rig.
// ===== RIG SITE CONFIG: change these to move the rig =====
// The simulator has no real rig location (all data is SIM). Default site: Perth, Western Australia.
export const RIG_SITE={name:'Default site (SIM)',region:'Perth, Western Australia',lat:-31.95,lon:115.86,tz:'Australia/Perth'};
export const LOCAL_TZ='Australia/Brisbane';
// URL overrides: ?riglat=-26.5&riglon=149.1&rigtz=Australia/Brisbane&rigname=Roma  ·  fake time: ?fakenow=2026-11-03T22:00:00%2B08:00  ·  ?daynight=off
const Q=new URLSearchParams(location.search);
let saved=null;try{saved=JSON.parse(localStorage.dw_rigsite||'null')}catch(e){}
const S={...RIG_SITE,...(saved||{})};if(Q.get('riglat'))S.lat=+Q.get('riglat');if(Q.get('riglon'))S.lon=+Q.get('riglon');if(Q.get('rigtz'))S.tz=Q.get('rigtz');if(Q.get('rigname'))S.name=Q.get('rigname');
const fake=Q.get('fakenow')?Date.parse(Q.get('fakenow')):NaN,off=isNaN(fake)?0:fake-Date.now();
const now=()=>new Date(Date.now()+off);
// NOAA solar position (simplified). Returns sun elevation in degrees.
export function sunElev(d,lat,lon){const r=Math.PI/180,jd=d.getTime()/864e5+2440587.5,T=(jd-2451545)/36525;
 const L0=(280.46646+T*(36000.76983+T*0.0003032))%360,M=357.52911+T*(35999.05029-0.0001537*T),e=0.016708634-T*(0.000042037+0.0000001267*T);
 const C=Math.sin(M*r)*(1.914602-T*(0.004817+0.000014*T))+Math.sin(2*M*r)*(0.019993-0.000101*T)+Math.sin(3*M*r)*0.000289;
 const lam=L0+C-0.00569-0.00478*Math.sin((125.04-1934.136*T)*r),eps=23+(26+(21.448-T*(46.815+T*(0.00059-T*0.001813)))/60)/60+0.00256*Math.cos((125.04-1934.136*T)*r);
 const dec=Math.asin(Math.sin(eps*r)*Math.sin(lam*r)),y=Math.tan(eps*r/2)**2;
 const eqt=4/r*(y*Math.sin(2*L0*r)-2*e*Math.sin(M*r)+4*e*y*Math.sin(M*r)*Math.cos(2*L0*r)-0.5*y*y*Math.sin(4*L0*r)-1.25*e*e*Math.sin(2*M*r));
 const mins=d.getUTCHours()*60+d.getUTCMinutes()+d.getUTCSeconds()/60,ha=((mins+eqt+4*lon)/4-180)*r;
 return Math.asin(Math.sin(lat*r)*Math.sin(dec)+Math.cos(lat*r)*Math.cos(dec)*Math.cos(ha))/r}
// 0 = full day (sun >= +2°), 1 = full night (sun <= -6°, end of civil twilight); smooth between.
export const nightLevel=el=>Math.max(0,Math.min(1,(2-el)/8));
// Environments = site presets: location + time zone + default weather (Live or any wheel option + intensity).
const PRESETS=[['Perth WA','Western Australia, Australia',-31.95,115.86,'Australia/Perth','live',0.7],['Roma QLD','Queensland, Australia',-26.57,148.79,'Australia/Brisbane','live',0.7],['Karratha WA (Pilbara)','Western Australia, Australia',-20.74,116.85,'Australia/Perth','dust',0.5],['Moomba SA (desert land rig)','South Australia, Australia',-28.11,140.20,'Australia/Adelaide','dust',0.7],['Aberdeen North Sea (offshore)','Scotland, UK',57.15,-2.09,'Europe/London','rain',0.8,'semi'],['Gulf of Mexico (Houston)','Texas, USA',29.76,-95.37,'America/Chicago','storm',0.5,'jackup'],['Prudhoe Bay AK (arctic rig)','Alaska, USA',70.25,-148.34,'America/Anchorage','snow',0.7]];
const urlSet=['riglat','riglon','rigtz','rigname'].some(k=>Q.get(k));
// ===== Weather: live data or SIM weather from the Weather wheel =====
// test override: ?fakeweather=clear|cloudy|fog|drizzle|rain|heavy|storm|wind|dust|cyclone (&wxk=0..1 intensity)
const WX={clear:['Clear',{weather_code:0,cloud_cover:0,precipitation:0,wind_speed_10m:8,wind_gusts_10m:15,uv_index:9,temperature_2m:26}],
 cloudy:['Cloudy',{weather_code:3,cloud_cover:100,precipitation:0,wind_speed_10m:14,wind_gusts_10m:25,uv_index:3,temperature_2m:21}],
 fog:['Fog',{weather_code:45,cloud_cover:100,precipitation:0,wind_speed_10m:4,wind_gusts_10m:8,uv_index:2,temperature_2m:12}],
 drizzle:['Drizzle',{weather_code:53,cloud_cover:100,precipitation:0.6,wind_speed_10m:12,wind_gusts_10m:22,uv_index:2,temperature_2m:15}],
 rain:['Rain',{weather_code:63,cloud_cover:100,precipitation:3,wind_speed_10m:20,wind_gusts_10m:38,uv_index:2,temperature_2m:15}],
 heavy:['Heavy rain',{weather_code:65,cloud_cover:100,precipitation:10,wind_speed_10m:28,wind_gusts_10m:50,uv_index:1,temperature_2m:16}],
 storm:['Thunderstorm',{weather_code:95,cloud_cover:100,precipitation:9,wind_speed_10m:40,wind_gusts_10m:80,uv_index:1,temperature_2m:24}],
 wind:['High wind',{weather_code:2,cloud_cover:40,precipitation:0,wind_speed_10m:65,wind_gusts_10m:100,uv_index:7,temperature_2m:22}],
 dust:['Dust storm',{weather_code:2,cloud_cover:30,precipitation:0,wind_speed_10m:55,wind_gusts_10m:90,uv_index:4,temperature_2m:34}],
 snow:['Snow',{weather_code:73,cloud_cover:100,precipitation:1.5,wind_speed_10m:10,wind_gusts_10m:20,uv_index:1,temperature_2m:-3}],
 blizzard:['Blizzard',{weather_code:75,cloud_cover:100,precipitation:4,wind_speed_10m:60,wind_gusts_10m:95,uv_index:0,temperature_2m:-12}],
 sleet:['Sleet / hail',{weather_code:67,cloud_cover:100,precipitation:3,wind_speed_10m:25,wind_gusts_10m:45,uv_index:1,temperature_2m:0}],
 cyclone:['Cyclone',{weather_code:99,cloud_cover:100,precipitation:30,wind_speed_10m:120,wind_gusts_10m:170,uv_index:0,temperature_2m:27}]};
const WXK=['live','clear','cloudy','fog','drizzle','rain','heavy','storm','wind','dust','snow','blizzard','sleet','cyclone'],WXI={live:'📡',clear:'☀',cloudy:'☁',fog:'🌫',drizzle:'🌦',rain:'🌧',heavy:'☔',storm:'⛈',wind:'💨',dust:'🟫',snow:'❄',blizzard:'🌨',sleet:'🧊',cyclone:'🌀'};
const SIMW={type:null,k:+(Q.get('wxk')||0.7),sound:false};{const f=Q.get('fakeweather');const m={showers:'heavy',cloud:'cloudy'};if(f&&f!='live'&&WX[m[f]||f])SIMW.type=m[f]||f}
if(!Q.get('fakeweather')&&S.wx&&S.wx!='live'&&WX[S.wx]){SIMW.type=S.wx;if(!Q.get('wxk')&&S.wxk!=null)SIMW.k=+S.wxk}
const lerp=(a,b,k)=>a+(b-a)*k;
function eff(){if(!SIMW.type)return W;const [,b]=WX[SIMW.type],k=SIMW.k,d=W?.wind_direction_10m??220;
 return {...b,precipitation:b.precipitation*(0.3+k),wind_speed_10m:lerp(b.wind_speed_10m*0.4,b.wind_speed_10m*1.3,k),wind_gusts_10m:lerp(b.wind_gusts_10m*0.4,b.wind_gusts_10m*1.3,k),wind_direction_10m:d,at:Date.now(),sim:true,label:WX[SIMW.type][0]}}
const isSnow=c=>(c>=71&&c<=77)||c==85||c==86,isSleet=c=>c==56||c==57||c==66||c==67;
const rainK=w=>{const c=w.weather_code||0;if(isSnow(c))return 0;const wet=(c>=51&&c<=67)||(c>=80&&c<=82)||c>=95;if(!wet&&!(w.precipitation>0))return 0;let k=Math.min(1,0.12+(w.precipitation||0)/10);if(c>=80)k=Math.max(k,0.6);if(c>=95)k=Math.max(k,0.75);if(c==65||c==82)k=Math.max(k,0.85);return k};
function fxOf(w){if(!w)return {rain:0,fog:0,dust:0,wind:0,bolt:0,cloud:0,snow:0,sleet:0,blz:0};const t=SIMW.type,k=SIMW.k,c=w.weather_code;
 return {rain:rainK(w)*(t?0.4+0.6*k:1),fog:t=='fog'?0.35+0.6*k:(c==45||c==48)?0.6:t=='cyclone'?0.3:0,dust:t=='dust'?0.35+0.6*k:0,
  wind:Math.min(1,Math.max(0,(w.wind_gusts_10m-30)/90)),bolt:c>=95?(t?0.4+0.6*k:0.6):0,cloud:Math.min(1,(w.cloud_cover||0)/100),
  snow:isSnow(c)?(t?0.35+0.65*k:Math.min(1,0.3+(w.precipitation||0)/4)):0,sleet:isSleet(c)?(t?0.4+0.6*k:0.6):0,blz:isSnow(c)&&w.wind_gusts_10m>60?1:0}}
const FX={acc:0,flk:[],ice:[],mats:null,lastT:0,f:fxOf(null),cv:null,drops:[],deb:[],dust:[],raf:0,flash:0,bolt:null,nextBolt:0,C:null,base:null,ac:null};
function applyFx(){const f=FX.f=fxOf(eff());const any=f.snow||f.sleet||FX.acc>0.01||f.rain||f.fog||f.dust||f.wind>0.2||f.bolt;
 if(!FX.cv){const c=document.createElement('canvas');c.id='rcRain';c.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:4';document.body.appendChild(c);FX.cv=c}
 FX.cv.style.display=any?'block':'none';filt();if(!FX.raf)FX.raf=requestAnimationFrame(fxFrame)}
function filt(){const cv=FX.C?.ren?.domElement;if(!cv)return;const f=FX.f,dark=Math.max(f.snow*0.12,f.sleet*0.25,f.cloud*0.08,f.rain*0.3,f.bolt*0.35,f.fog*0.1,f.dust*0.15);
 cv.style.filter=FX.flash>0.05?`brightness(${(1+FX.flash*1.8).toFixed(2)}) saturate(.6)`:dark>0.01?`saturate(${(1-dark*1.2).toFixed(2)}) brightness(${(1-dark).toFixed(2)})${f.dust?` sepia(${(f.dust*0.7).toFixed(2)})`:''}`:''}
function thunder(){if(!SIMW.sound)return;try{const a=FX.ac||(FX.ac=new AudioContext()),n=a.sampleRate*2.5,b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);let l=0;for(let i=0;i<n;i++){l=l*0.98+(Math.random()*2-1)*0.02;d[i]=l*8*Math.pow(1-i/n,2)}
 const s=a.createBufferSource();s.buffer=b;const g=a.createGain();g.gain.value=0.8;s.connect(g).connect(a.destination);s.start(a.currentTime+0.4+Math.random())}catch(e){}}
function boltPath(W2,H2){const p=[];let x=W2*(0.2+Math.random()*0.6),y=0;while(y<H2*0.65){p.push([x,y]);y+=20+Math.random()*40;x+=(Math.random()-0.5)*60}return p}
function fxFrame(now){FX.raf=0;const f=FX.f,c=FX.cv;if(!c)return;const W2=innerWidth,H2=innerHeight;if(c.width!=W2)c.width=W2;if(c.height!=H2)c.height=H2;const g=c.getContext('2d');g.clearRect(0,0,W2,H2);
 const nt=(window.GX?.night?.t?.()||0),wind=f.wind;
 // fog / dust haze
 if(f.fog){const gr=g.createLinearGradient(0,0,0,H2);const col=nt>0.5?'40,48,60':'205,210,215';gr.addColorStop(0,`rgba(${col},${(f.fog*0.55).toFixed(2)})`);gr.addColorStop(1,`rgba(${col},${(f.fog*0.85).toFixed(2)})`);g.fillStyle=gr;g.fillRect(0,0,W2,H2)}
 if(f.dust){g.fillStyle=`rgba(${nt>0.5?'70,48,25':'190,130,70'},${(f.dust*0.6).toFixed(2)})`;g.fillRect(0,0,W2,H2);const n=Math.round(f.dust*500);while(FX.dust.length<n)FX.dust.push({x:Math.random()*W2,y:Math.random()*H2,s:1+Math.random()*2});FX.dust.length=n;g.fillStyle='rgba(120,80,40,0.55)';for(const d of FX.dust){d.x+=6+wind*14*d.s;d.y+=Math.sin(now/300+d.s)*0.6;if(d.x>W2)d.x=-5;g.fillRect(d.x,d.y,d.s,d.s)}}
 // rain streaks, slanted by wind
 if(f.rain){const n=Math.round(120+f.rain*1100),sl=0.15+wind*0.9;while(FX.drops.length<n)FX.drops.push({x:Math.random()*W2,y:Math.random()*H2,v:0.7+Math.random()*0.6,l:0.6+Math.random()*0.8});FX.drops.length=n;
  g.strokeStyle=nt>0.5?'rgba(200,215,240,0.32)':'rgba(195,208,225,0.5)';g.lineWidth=1;g.beginPath();
  for(const d of FX.drops){const sp=(14+f.rain*16)*d.v,L=(10+f.rain*22)*d.l;g.moveTo(d.x,d.y);g.lineTo(d.x+sl*L,d.y+L);d.y+=sp;d.x+=sl*sp;if(d.y>H2){d.y=-L;d.x=Math.random()*(W2+300)-300}if(d.x>W2+50)d.x-=W2+100}g.stroke()}
 // debris in high wind
 if(wind>0.45){const n=Math.round((wind-0.45)*60);while(FX.deb.length<n)FX.deb.push({x:Math.random()*W2,y:H2*(0.4+Math.random()*0.6),r:Math.random()*6,s:2+Math.random()*4});FX.deb.length=n;g.fillStyle=nt>0.5?'rgba(150,150,140,0.6)':'rgba(70,60,45,0.75)';
  for(const d of FX.deb){d.x+=10+wind*20;d.y+=Math.sin(now/200+d.r)*2-0.3;d.r+=0.2;if(d.x>W2+10){d.x=-10;d.y=H2*(0.4+Math.random()*0.6)}g.save();g.translate(d.x,d.y);g.rotate(d.r);g.fillRect(-d.s/2,-d.s/4,d.s,d.s/2);g.restore()}}
 // lightning: flash lights the scene, a bolt is drawn
 if(f.bolt){if(!FX.nextBolt)FX.nextBolt=now+800+Math.random()*2000;if(now>FX.nextBolt){FX.flash=1;FX.bolt=boltPath(W2,H2);FX.boltT=now;FX.nextBolt=now+(1500+Math.random()*6000)/(0.4+f.bolt);thunder()}}
 if(FX.flash>0){g.fillStyle=`rgba(225,232,255,${(FX.flash*(nt>0.5?0.45:0.3)).toFixed(2)})`;g.fillRect(0,0,W2,H2);
  if(FX.bolt&&now-FX.boltT<260){g.strokeStyle='rgba(245,248,255,0.95)';g.lineWidth=3;g.shadowColor='#bcd';g.shadowBlur=18;g.beginPath();FX.bolt.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();g.shadowBlur=0}
  FX.flash=Math.max(0,FX.flash-0.06);if(FX.flash<0.5&&FX.flash>0.44&&Math.random()<0.5)FX.flash=0.9}
 // snow flakes (blizzard: more, faster, sideways, white-out haze)
 if(f.snow){const n=Math.round(150+f.snow*(f.blz?1600:700));while(FX.flk.length<n)FX.flk.push({x:Math.random()*W2,y:Math.random()*H2,r:1+Math.random()*2.5,p:Math.random()*6});FX.flk.length=n;
  if(f.blz){g.fillStyle=`rgba(${nt>0.5?'70,80,95':'225,230,238'},${(0.35+0.3*f.snow).toFixed(2)})`;g.fillRect(0,0,W2,H2)}
  g.fillStyle='rgba(255,255,255,0.85)';g.beginPath();for(const d of FX.flk){const sp=(0.8+d.r*0.5)*(f.blz?3:1);d.y+=sp;d.x+=Math.sin(now/900+d.p)*0.6+wind*(f.blz?14:4);if(d.y>H2){d.y=-4;d.x=Math.random()*W2}if(d.x>W2+5)d.x=-5;g.moveTo(d.x+d.r,d.y);g.arc(d.x,d.y,d.r,0,6.3)}g.fill()}
 // sleet / hail pellets
 if(f.sleet){const n=Math.round(150+f.sleet*600);while(FX.ice.length<n)FX.ice.push({x:Math.random()*W2,y:Math.random()*H2,v:0.8+Math.random()*0.5});FX.ice.length=n;g.strokeStyle='rgba(230,240,255,0.75)';g.lineWidth=2;g.beginPath();
  for(const d of FX.ice){const sp=22*d.v;g.moveTo(d.x,d.y);g.lineTo(d.x+3,d.y+6);d.y+=sp;d.x+=wind*6;if(d.y>H2){d.y=-6;d.x=Math.random()*W2}}g.stroke()}
 // gradual snow buildup on deck/rig surfaces: whiten scene materials (melts when snow stops)
 const dt=FX.lastT?Math.min(0.2,(now-FX.lastT)/1000):0;FX.lastT=now;const tgt=f.snow?Math.min(0.75,0.3+0.45*f.snow):0;FX.acc+=(tgt-FX.acc)*Math.min(1,dt*(f.snow?0.08*(0.5+f.snow):0.05));snowCoat();
 filt();
 // rig sway in high wind (small, visual only)
 const R=FX.C?.rigG;if(R){if(FX.base==null)FX.base=R.rotation.z;R.rotation.z=FX.base+(wind>0.2?Math.sin(now/700)*0.006*wind+Math.sin(now/230)*0.002*wind:0)}
 const live=f.snow||f.sleet||FX.acc>0.002||f.rain||f.fog||f.dust||wind>0.2||f.bolt||FX.flash>0;if(live)FX.raf=requestAnimationFrame(fxFrame)}
function snowCoat(){const sc=FX.C?.scene;if(!sc)return;const a=FX.acc;if(a<0.003&&!FX.mats)return;
 if(!FX.mats||FX.matsN++>300){FX.matsN=0;const M=FX.mats||new Map();sc.traverse(o=>{if(!o.isMesh||/^night/.test(o.name)||(o.parent&&/^night/.test(o.parent.name)))return;const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m&&m.color&&!m.transparent&&!M.has(m))M.set(m,m.color.clone())})});FX.mats=M}
 const Wc=FX.wc||(FX.wc=FX.mats.size?[...FX.mats.values()][0].clone().setRGB(0.93,0.95,0.98):null);if(!Wc)return;
 for(const [m,c0] of FX.mats)m.color.copy(c0).lerp(Wc,a);if(a<0.003){FX.acc=0;for(const [m,c0] of FX.mats)m.color.copy(c0);FX.mats=null}}
function setWx(type,k){SIMW.type=type=='live'?null:type;if(k!=null)SIMW.k=k;render();applyFx();wheelSync()}
// Weather wheel (radial selector). Open: HUD button or W key. Esc closes.
function wheel(open){let d=document.getElementById('rcWheel');if(open===false||(open==null&&d)){d?.remove();return}if(d)return;d=document.createElement('div');d.id='rcWheel';
 d.style.cssText='position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:#0006';const R=200,n=WXK.length;
 d.innerHTML=`<div style="position:relative;width:${R*2+120}px;height:${R*2+120}px;border-radius:50%;background:radial-gradient(circle,#0e1724f0 38%,#0e172499 39%,#0e1724cc 70%,transparent 71%)">
 ${WXK.map((t,i)=>{const a=-Math.PI/2+i*2*Math.PI/n,x=R+60+Math.cos(a)*R,y=R+60+Math.sin(a)*R;return `<button data-wx="${t}" style="position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);width:86px;height:62px;border-radius:12px;border:1px solid #567;background:#1b2430;color:#dde;cursor:pointer;font:11px system-ui"><div style="font-size:22px">${WXI[t]}</div>${t=='live'?'Live':WX[t][0]}</button>`}).join('')}
 <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:200px;text-align:center;color:#dde;font:12px system-ui">
 <div style="color:#8fd;font-weight:700;font-size:14px">Weather wheel</div><div id="rcWhSel" style="margin:4px 0 8px"></div>
 <label>Intensity <span id="rcWhKv"></span><br><input id="rcWhK" type="range" min="0" max="1" step="0.05" value="${SIMW.k}" style="width:170px"></label>
 <div style="margin-top:6px"><label><input id="rcWhS" type="checkbox" ${SIMW.sound?'checked':''}> Thunder sound</label></div><div style="opacity:.6;margin-top:6px">W or Esc to close</div></div></div>`;
 document.body.appendChild(d);d.onclick=e=>{if(e.target===d)wheel(false)};d.querySelectorAll('[data-wx]').forEach(b=>b.onclick=()=>setWx(b.dataset.wx));
 d.querySelector('#rcWhK').oninput=e=>setWx(SIMW.type||'live',+e.target.value);d.querySelector('#rcWhS').onchange=e=>{SIMW.sound=e.target.checked};wheelSync()}
function wheelSync(){const d=document.getElementById('rcWheel');if(!d)return;const t=SIMW.type||'live';d.querySelectorAll('[data-wx]').forEach(b=>{const on=b.dataset.wx==t;b.style.background=on?'#7a3b14':'#1b2430';b.style.borderColor=on?'#fb6':'#567'});
 d.querySelector('#rcWhSel').textContent=t=='live'?'Live weather (real data)':'SIM: '+WX[t][0];d.querySelector('#rcWhKv').textContent=Math.round(SIMW.k*100)+'%'}

function setSite(o,persist=true){Object.assign(S,o);if(persist){try{localStorage.dw_rigsite=JSON.stringify({name:S.name,region:S.region,lat:S.lat,lon:S.lon,tz:S.tz,unit:S.unit||'land',wx:S.wx||'live',wxk:S.wxk??0.7})}catch(e){}}if(o.wx!=null){SIMW.type=o.wx=='live'||!WX[o.wx]?null:o.wx;if(o.wxk!=null)SIMW.k=+o.wxk;wheelSync()}W=null;wErr=null;lastLv=null;tick();weather().then(()=>{tint();render();applyFx()})}
function resetSite(){try{localStorage.removeItem('dw_rigsite')}catch(e){}Object.assign(S,RIG_SITE,{wx:'live',wxk:0.7});SIMW.type=null;wheelSync();W=null;lastLv=null;tick();weather().then(tint)}
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function dialog(){document.getElementById('rcDlg')?.remove();const d=document.createElement('div');d.id='rcDlg';
 d.style.cssText='position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:50;background:#0e1724f2;color:#e8eef4;border:1px solid #5a7;border-radius:8px;padding:12px 14px;width:min(92vw,420px);font:13px system-ui;box-shadow:0 8px 30px #000a';
 const inp='background:#1b2430;color:#dde;border:1px solid #456;border-radius:4px;padding:4px 6px;box-sizing:border-box',btn='background:#234;color:#def;border:1px solid #567;border-radius:4px;padding:4px 8px;cursor:pointer;margin:2px';
 d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#8fd">Rig environment &amp; location</b><button id="rcX" style="${btn}">✕</button></div>
 <div style="margin-top:8px">Search place</div><div style="display:flex;gap:4px"><input id="rcQ" placeholder="e.g. Roma" style="${inp};flex:1"><button id="rcGo" style="${btn}">Search</button></div><div id="rcRes" style="max-height:130px;overflow:auto;font-size:12px"></div>
 <div style="margin-top:8px">Environments</div><div>${PRESETS.map((p,i)=>`<button data-p="${i}" title="${p[5]=='live'?'Live weather':WX[p[5]][0]+' '+Math.round(p[6]*100)+'%'}" style="${btn}">${WXI[p[5]]} ${p[0]}</button>`).join('')}</div>
 <div style="margin-top:8px">Manual</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
 <input id="rcN" placeholder="Site name" value="${esc(S.name)}" style="${inp}"><input id="rcR" placeholder="Region" value="${esc(S.region)}" style="${inp}">
 <input id="rcLa" placeholder="Latitude" inputmode="decimal" value="${S.lat}" style="${inp}"><input id="rcLo" placeholder="Longitude" inputmode="decimal" value="${S.lon}" style="${inp}">
 <input id="rcT" placeholder="Time zone e.g. Australia/Perth" value="${esc(S.tz)}" style="${inp};grid-column:span 2">
 <select id="rcEWx" style="${inp}">${WXK.map(k=>`<option value="${k}" ${(S.wx||'live')==k?'selected':''}>${WXI[k]} ${k=='live'?'Live weather':WX[k][0]}</option>`).join('')}</select><label style="font-size:12px">Intensity <input id="rcWk" type="range" min="0" max="1" step="0.05" value="${S.wxk??0.7}" style="width:90px;vertical-align:middle"></label></div><div style="font-size:11px;opacity:.65">Weather is the environment default; the weather wheel overrides it for this session.</div>
 <div id="rcMsg" style="color:#fb6;font-size:12px;min-height:16px;margin-top:4px">${urlSet?'Note: URL settings override the saved site for this visit.':''}</div>
 <div style="display:flex;justify-content:space-between;margin-top:4px"><button id="rcRst" style="${btn}">Reset to default</button><button id="rcOk" style="${btn};background:#2a5a3a">Save</button></div>`;
 document.body.appendChild(d);const $=id=>d.querySelector('#'+id),fill=o=>{$('rcN').value=o.name;$('rcR').value=o.region;$('rcLa').value=o.lat;$('rcLo').value=o.lon;$('rcT').value=o.tz;d._unit=o.unit||'land';if(o.wx){$('rcEWx').value=o.wx;$('rcWk').value=o.wxk}};
 $('rcX').onclick=()=>d.remove();
 d.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{const p=PRESETS[b.dataset.p];fill({name:p[0],region:p[1],lat:p[2],lon:p[3],tz:p[4],wx:p[5],wxk:p[6],unit:p[7]||'land'})});
 const search=async()=>{const q=$('rcQ').value.trim();if(!q)return;$('rcRes').textContent='Searching…';try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name='+encodeURIComponent(q));if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json(),L=j.results||[];
  $('rcRes').innerHTML=L.length?L.map((x,i)=>`<div data-i="${i}" style="cursor:pointer;padding:3px 4px;border-bottom:1px solid #234">${esc(x.name)} · ${esc([x.admin1,x.country].filter(Boolean).join(', '))} <span style="opacity:.6">${x.latitude.toFixed(2)}, ${x.longitude.toFixed(2)}</span></div>`).join(''):'No places found.';
  $('rcRes').querySelectorAll('[data-i]').forEach(e=>e.onclick=()=>{const x=L[e.dataset.i];fill({name:x.name,region:[x.admin1,x.country].filter(Boolean).join(', '),lat:+x.latitude.toFixed(4),lon:+x.longitude.toFixed(4),tz:x.timezone||S.tz});$('rcRes').innerHTML=''})}catch(e){$('rcRes').textContent='Search not available ('+e.message+'). Use a preset or enter the values.'}};
 $('rcGo').onclick=search;$('rcQ').onkeydown=e=>{if(e.key=='Enter')search()};
 $('rcRst').onclick=()=>{resetSite();d.remove()};
 $('rcOk').onclick=()=>{const la=parseFloat($('rcLa').value),lo=parseFloat($('rcLo').value),tz=$('rcT').value.trim();
  if(!(Math.abs(la)<=90&&Math.abs(lo)<=180))return $('rcMsg').textContent='Enter a latitude (-90 to 90) and longitude (-180 to 180).';
  try{new Intl.DateTimeFormat('en-AU',{timeZone:tz})}catch(e){return $('rcMsg').textContent='Time zone not known. Use a name such as Australia/Perth.'}
  setSite({name:$('rcN').value.trim()||'Rig site',region:$('rcR').value.trim(),lat:la,lon:lo,tz,unit:d._unit||S.unit||'land',wx:$('rcEWx').value,wxk:+$('rcWk').value});d.remove()}}
const fmt=(d,tz)=>d.toLocaleTimeString('en-AU',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false});
const tzs=(d,tz)=>{try{return new Intl.DateTimeFormat('en-AU',{timeZone:tz,timeZoneName:'short'}).formatToParts(d).find(p=>p.type=='timeZoneName').value}catch(e){return tz}};
const WMO={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',56:'Freezing drizzle',57:'Freezing drizzle',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',85:'Snow showers',86:'Heavy snow showers',80:'Showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm',96:'Thunderstorm, hail',99:'Thunderstorm, hail'};
const card=d=>['N','NE','E','SE','S','SW','W','NW'][Math.round(((d%360)+360)%360/45)%8];
let W=null,wErr=null,el,auto=Q.get('daynight')!='off',lastLv=null;
async function weather(){try{const u=`https://api.open-meteo.com/v1/forecast?latitude=${S.lat}&longitude=${S.lon}&current=temperature_2m,weather_code,uv_index,is_day,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation&wind_speed_unit=kmh&timezone=auto`;
 const ac=new AbortController(),to=setTimeout(()=>ac.abort(),8000);const r=await fetch(u,{signal:ac.signal});clearTimeout(to);if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();W={...j.current,at:Date.now()};wErr=null}catch(e){wErr=e.message||'offline'}render()}
// UV index (WHO bands) + sunscreen warning. SIM UV is 0 when the sun is down at the rig.
const UVB=[[11,'Extreme','#8b3fc7','#fff'],[8,'Very high','#d32f2f','#fff'],[6,'High','#f57c00','#000'],[3,'Moderate','#fdd835','#000'],[0,'Low','#43a047','#fff']];
const uvBand=u=>UVB.find(b=>u>=b[0]);
function uvNow(){const w=eff();if(!w||w.uv_index==null)return null;const day=sunElev(now(),S.lat,S.lon)>0;if(!day||(!w.sim&&w.is_day===0))return 0;return Math.max(0,+w.uv_index)}
function uvTag(){const u=uvNow();if(u==null)return '';const b=uvBand(u);return ` · <span id="rcUV" title="UV index (WHO)" style="background:${b[2]};color:${b[3]};border-radius:4px;padding:0 4px;font-weight:700">UV ${Math.round(u)} ${b[1]}</span>`}
let uvSimLast=0;const UV_RE=36e5;
function uvLocKey(){return 'rcUVlast:'+(+S.lat).toFixed(2)+','+(+S.lon).toFixed(2)}
function uvCheck(){const w=eff(),u=uvNow();if(u==null||u<6)return;const t=now().getTime();
 if(w?.sim){if(!uvSimLast||t-uvSimLast>=UV_RE){const again=!!uvSimLast;uvSimLast=t;uvToast(u,again)}return}
 const k=uvLocKey();let last=0;try{last=+localStorage.getItem(k)||0}catch(e){}
 if(!last||t-last>=UV_RE||t<last){const again=!!last&&t-last<6*36e5&&t>=last;try{localStorage.setItem(k,String(t))}catch(e){}uvToast(u,again)}}
function uvToast(u,again){document.getElementById('uvToast')?.remove();const b=uvBand(u||6),t=document.createElement('div');t.id='uvToast';t.setAttribute('role','alert');
 t.style.cssText=`position:fixed;top:48px;left:50%;transform:translateX(-50%);z-index:61;background:${b[2]};color:${b[3]};font:600 15px system-ui;padding:10px 16px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.5);max-width:90vw;text-align:center;cursor:pointer;opacity:1;transition:opacity 1s`;
 const txt=`UV HIGH (${Math.round(u)}): Apply sunscreen${again?' again':''}. Wear a hat and long sleeves.`;
 t.innerHTML=`☀ <b>UV HIGH (${Math.round(u)}):</b> Apply sunscreen${again?' again':''}. Wear a hat and long sleeves.`;t.onclick=()=>t.remove();document.body.appendChild(t);
 setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),1000)},4000);
 pushAlert({type:'uv',severity:u>=8?'high':'warn',text:txt})}
// Generic alerts log: GX.alerts.push({type,severity:'info'|'warn'|'high',text}). Last 50 kept in localStorage.
const AK='rcAlerts',AR='rcAlertsRead',SEV={info:'#4a90d9',warn:'#f57c00',high:'#d32f2f'};
const aLoad=()=>{try{return JSON.parse(localStorage.getItem(AK)||'[]')}catch(e){return []}};
function aSave(l){try{localStorage.setItem(AK,JSON.stringify(l.slice(-50)))}catch(e){}}
function aRead(){try{return +localStorage.getItem(AR)||0}catch(e){return 0}}
function pushAlert({type='info',severity='info',text=''}={}){const l=aLoad();l.push({id:Date.now()+Math.random(),at:now().getTime(),type,severity,text});aSave(l);aStrip();if(document.getElementById('alPanel'))aPanel(true)}
function aStrip(){let h=document.getElementById('alHud');if(!h){h=document.createElement('div');h.id='alHud';h.title='Open alerts (A)';h.style.cssText='position:fixed;right:8px;bottom:8px;z-index:6;color:#dde;background:#0b1320cc;border:1px solid #456;border-radius:6px;padding:3px 8px;font:12px system-ui;cursor:pointer';h.onclick=()=>aPanel();document.body.appendChild(h)}
 const l=aLoad(),r=aRead(),n=l.filter(a=>a.at>r).length;h.innerHTML='🔔 Alerts'+(n?` <span id="alBadge" style="background:#d32f2f;color:#fff;border-radius:8px;padding:0 5px;font-weight:700">${n}</span>`:'')}
const aEsc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function aFmt(ms,tz){try{return new Date(ms).toLocaleString('en-AU',{timeZone:tz,day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})}catch(e){return new Date(ms).toISOString().slice(5,16)}}
function aPanel(refresh){let p=document.getElementById('alPanel');if(p&&!refresh){p.remove();return}
 if(!p){p=document.createElement('div');p.id='alPanel';p.style.cssText='position:fixed;right:8px;bottom:36px;z-index:62;width:min(420px,92vw);max-height:50vh;overflow:auto;color:#dde;background:#0b1320f2;border:1px solid #456;border-radius:8px;padding:8px;font:12px system-ui;box-shadow:0 4px 14px rgba(0,0,0,.5)';document.body.appendChild(p)}
 const l=aLoad().slice().reverse();
 p.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="color:#8fd">🔔 Alerts (${l.length})</b><span><button id="alClr">Clear</button> <button id="alX">✕</button></span></div>`+
 (l.length?l.map(a=>`<div style="border-left:4px solid ${SEV[a.severity]||SEV.info};padding:3px 6px;margin:3px 0;background:#ffffff0d"><div style="opacity:.7">Rig ${aFmt(a.at,S.tz)} · Brisbane ${aFmt(a.at,'Australia/Brisbane')} · ${aEsc(a.type)}</div><div>${aEsc(a.text)}</div></div>`).join(''):'<div style="opacity:.7">No alerts.</div>');
 p.querySelector('#alX').onclick=()=>p.remove();p.querySelector('#alClr').onclick=()=>{aSave([]);aPanel(true);aStrip()};
 try{localStorage.setItem(AR,String(now().getTime()+1))}catch(e){}aStrip()}
addEventListener('keydown',e=>{if((e.key=='a'||e.key=='A')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||'')&&!e.target?.isContentEditable)aPanel()});
function wxText(){return wxT()+uvTag()}
function wxT(){const W=eff();if(W?.sim)return `<span style="background:#b8860b;color:#000;border-radius:4px;padding:0 4px;font-weight:700">SIM</span> ${Math.round(W.temperature_2m)}°C · ${W.label} · Wind ${card(W.wind_direction_10m)} ${Math.round(W.wind_speed_10m)} km/h, gusts ${Math.round(W.wind_gusts_10m)}`;if(!W)return wErr?'Weather: not available':'Weather: loading…';
 const c=WMO[W.weather_code]||'—',age=Math.round((Date.now()-W.at)/60000);
 return `${Math.round(W.temperature_2m)}°C · ${c} · Wind ${card(W.wind_direction_10m)} ${Math.round(W.wind_speed_10m)} km/h, gusts ${Math.round(W.wind_gusts_10m)}`+(wErr?` <span style="opacity:.6">(${age} min old)</span>`:'')}
function render(){if(!el)return;const d=now(),e=sunElev(d,S.lat,S.lon),lv=nightLevel(e),ph=e>2?'Day':e>-6?(lv<0.5?'Dusk/dawn':'Twilight'):'Night';
 el.innerHTML=`<div><b>Rig time</b> ${fmt(d,S.tz)} <span style="opacity:.6">${tzs(d,S.tz)}</span> · <b>Local time</b> ${fmt(d,LOCAL_TZ)} <span style="opacity:.6">${tzs(d,LOCAL_TZ)}</span>${off?' <span style="color:#fb6">(test time)</span>':''}</div>
<div style="opacity:.85">${esc(S.name)}${S.region?' · '+esc(S.region):''} · ${Math.abs(S.lat).toFixed(2)}°${S.lat<0?'S':'N'} ${Math.abs(S.lon).toFixed(2)}°${S.lon<0?'W':'E'}</div>
<div id="rcWx">${wxText()}</div>
<div style="opacity:.8">${ph} at rig (sun ${e.toFixed(0)}°) · <label style="cursor:pointer"><input id="rcAuto" type="checkbox" ${auto?'checked':''} style="vertical-align:middle;margin:0 3px 0 0">Real day/night</label> · <a href="#" id="rcSet" style="color:#9cf">Rig environment</a> · <a href="#" id="rcWx2" style="color:#9cf">🌦 Weather wheel (W)</a></div>`;
 uvCheck();
 el.querySelector('#rcWx2').onclick=ev=>{ev.preventDefault();wheel()};
 el.querySelector('#rcSet').onclick=ev=>{ev.preventDefault();dialog()};
 el.querySelector('#rcAuto').onchange=ev=>{auto=ev.target.checked;lastLv=null;tick()};}
function tint(){applyFx()}
function tick(){render();if(!auto||!window.GX?.night?.level)return;const lv=+nightLevel(sunElev(now(),S.lat,S.lon)).toFixed(3);if(lv!==lastLv){GX.night.level(lv,undefined,lastLv==null?0:4000);lastLv=lv}}
export function init(C){el=document.createElement('div');el.id='rigClock';el.style.cssText='position:fixed;top:64px;left:8px;z-index:6;color:#dde;background:#0b1320cc;border:1px solid #456;border-radius:6px;padding:5px 8px;font:12px system-ui;line-height:1.5;max-width:min(92vw,460px);pointer-events:auto';
 document.body.appendChild(el);FX.C=C;const wb=document.createElement('button');wb.id='wxWheelBtn';wb.title='Weather wheel (W)';wb.textContent='🌦 Weather (W)';wb.onclick=()=>wheel();(document.getElementById('hud')||document.body).appendChild(wb);
 addEventListener('keydown',e=>{const t=e.target;if(t&&(/INPUT|TEXTAREA|SELECT/.test(t.tagName)||t.isContentEditable))return;if((e.key=='w'||e.key=='W')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();wheel()}else if(e.key=='Escape'&&document.getElementById('rcWheel'))wheel(false)});
 // a manual Day/Night click turns the real-time mode off
 document.getElementById('nightBtn')?.addEventListener('click',()=>{auto=false;lastLv=null;render()},true);
 window.GX=window.GX||{};GX.alerts={push:pushAlert,open:()=>aPanel(),list:aLoad};aStrip();GX.rigClock={site:S,setSite,resetSite,dialog,rain:()=>FX.f.rain,snowAcc:()=>FX.acc,fx:()=>({...FX.f}),setWeather:setWx,wheel,get sim(){return SIMW.type},now,sunElev,nightLevel,get weather(){return W},get eff(){return eff()},uv:uvNow,alerts:{push:pushAlert,open:()=>aPanel(),list:aLoad},setAuto:v=>{auto=!!v;lastLv=null;tick()}};
 tick();setInterval(tick,30000);applyFx();weather().then(tint);setInterval(()=>weather().then(tint),12*60000)}
