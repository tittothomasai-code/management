// start.js v5.12.22 (game declutter: one start menu, tagline, sound icon); v5.12.21 (s36, RBX-209 rig equipment in Equipment library); v5.12.20 (s35, simulator uses shared whole-well WITSML model); v5.12.19 (s34, settings guide link on phone); v5.12.18: paged menu (Drill / Plan / Monitor / Operations → sub-pages with Back; login + guide in top bar).
// was v5.9.1: game-style start screen (original art, no third-party assets). SIM only.
// Tiles: New simulation | New well | Log in as player | Continue (only if saved state exists).
// Keyboard (arrows/WASD, Enter/Space, Esc), Gamepad API (d-pad/stick, A=select, B=back), touch/click. Sound OFF by default.
// Skipped for ?s=/?session= invite links (straight to join), ?nosplash, ?demo=, ?join, ?player, and automated runs unless ?start.
const q=new URLSearchParams(location.search);
const SK='dw_start_snd',$=id=>document.getElementById(id);
const ST={el:null,items:[],i:0,menu:'main',snd:false,ac:null,raf:0,gp:{t:0,prev:{}},last:null};
export function shouldShow(){if(['nosplash','s','session','demo','join','player','edm','monitor','workover','safety','wdash','operations','field'].some(k=>q.has(k)))return false;if(navigator.webdriver&&!q.has('start'))return false;return true}
export function hasSave(){try{return ['dw_start_save','dw_sess_code'].some(k=>localStorage.getItem(k))}catch(e){return false}}
const ver=()=>($('appVer')?.textContent||document.querySelector('meta[name=app-version]')?.content||'').trim();
const wait=(f,ms=15000)=>new Promise((ok,no)=>{const t0=Date.now();(function p(){let v;try{v=f()}catch(e){}if(v)return ok(v);if(Date.now()-t0>ms)return no(new Error('timeout'));setTimeout(p,60)})()});
function beep(f=520,d=.06){if(!ST.snd)return;try{ST.ac=ST.ac||new (window.AudioContext||window.webkitAudioContext)();const o=ST.ac.createOscillator(),g=ST.ac.createGain();o.type='triangle';o.frequency.value=f;g.gain.value=.05;g.gain.exponentialRampToValueAtTime(1e-4,ST.ac.currentTime+d);o.connect(g).connect(ST.ac.destination);o.start();o.stop(ST.ac.currentTime+d)}catch(e){}}
const CSS=`#start{position:fixed;inset:0;z-index:100001;color:#eaf6ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation}
#start canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#start .ui{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.2vh;padding:calc(16px + env(safe-area-inset-top)) 16px calc(40px + env(safe-area-inset-bottom));box-sizing:border-box}
#start h1{margin:0;font-size:clamp(30px,8vw,64px);font-weight:900;letter-spacing:.04em;text-align:center;line-height:1;background:linear-gradient(180deg,#fff,#7fd3ff 55%,#2a8cff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(60,170,255,.55))}
#start .sub{font-size:clamp(12px,3.2vw,16px);opacity:.8;letter-spacing:.25em;text-transform:uppercase;text-align:center}
#start .sim{display:inline-block;background:#8a8f98;color:#fff;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700;letter-spacing:.1em;margin-left:6px;vertical-align:middle}
#start .tiles{display:grid;grid-template-columns:1fr;gap:12px;width:min(440px,92vw);margin-top:1vh}
@media (min-width:820px){#start .tiles{grid-template-columns:1fr 1fr;width:min(820px,80vw);gap:18px}}
#start .tile{position:relative;display:flex;align-items:center;gap:14px;min-height:64px;padding:14px 18px;border-radius:18px;border:2px solid rgba(120,200,255,.35);background:linear-gradient(135deg,rgba(20,50,90,.82),rgba(8,20,40,.82));color:inherit;font:inherit;text-align:left;cursor:pointer;transition:transform .12s,box-shadow .12s,border-color .12s;backdrop-filter:blur(4px)}
@media (min-width:820px){#start .tile{min-height:110px;padding:20px 24px}}
#start .tile .ic{font-size:30px;width:44px;text-align:center;flex:none}
#start .tile b{display:block;font-size:clamp(18px,4.6vw,24px);font-weight:800}
#start .tile small{display:block;opacity:.75;font-size:13px;margin-top:3px}
@media (max-width:819px) and (max-height:900px){#start .ui{gap:1.4vh}#start .tiles{gap:8px}#start .tile{min-height:50px;padding:8px 14px;gap:10px}#start .tile .ic{font-size:24px;width:34px}#start .tile b{font-size:clamp(16px,4.4vw,20px)}#start .tile small{font-size:12px;margin-top:1px}}
#start .svrow{display:flex;gap:8px;align-items:stretch}#start .svrow .tile{flex:1}#start .svrm{min-width:84px;border-radius:14px;border:2px solid #a55;background:#3a1418cc;color:#fdd;font:inherit;cursor:pointer}#start .svh{grid-column:1/-1;margin:0 0 4px}
#start .tile.on{transform:scale(1.04);border-color:#7fe3ff;box-shadow:0 0 0 2px #7fe3ff,0 0 28px 6px rgba(80,200,255,.6),inset 0 0 24px rgba(80,200,255,.25);background:linear-gradient(135deg,rgba(30,90,150,.92),rgba(10,40,80,.92))}
#start .tile.on::after{content:'';position:absolute;inset:-2px;border-radius:18px;animation:stpulse 1.4s ease-in-out infinite;box-shadow:0 0 22px 4px rgba(127,227,255,.55);pointer-events:none}
@keyframes stpulse{50%{opacity:.25}}
#start .bar{position:absolute;left:0;right:0;bottom:calc(8px + env(safe-area-inset-bottom));display:flex;justify-content:space-between;align-items:center;padding:0 12px;font-size:12px;opacity:.85;gap:8px}
#start .bar button{background:rgba(10,30,60,.8);color:#cfe;border:1px solid #3a6a9a;border-radius:16px;padding:6px 12px;font:12px system-ui;cursor:pointer}
#start .hint{opacity:.6}
@media (max-width:520px){#start .hint{display:none}}
#start .top{position:absolute;top:calc(8px + env(safe-area-inset-top));left:0;right:0;display:flex;justify-content:flex-end;gap:8px;padding:0 12px;z-index:2}
#start .tb{background:rgba(10,30,60,.8);color:#cfe;border:1px solid #3a6a9a;border-radius:16px;padding:6px 12px;font:13px system-ui;cursor:pointer;text-decoration:none}
#start .pghd{font-size:clamp(14px,3.6vw,18px);font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9fdcff;min-height:1em}
#start .tile.grp{min-height:88px}@media (min-width:820px){#start .tile.grp{min-height:150px}#start .tile.grp .ic{font-size:44px;width:60px}#start .tile.grp b{font-size:30px}}
#start .pool{display:none!important}
@media (min-width:820px){#start .tile.fld{grid-column:1/-1;min-height:96px}}
#start.out{opacity:0;transition:opacity .35s}
#start .tagline{font-size:clamp(14px,3.4vw,18px);opacity:.9;font-weight:600;text-align:center;letter-spacing:.01em;max-width:22em;line-height:1.35;color:#cfe8ff;text-shadow:0 1px 12px rgba(0,20,40,.85)}
#start .menuBtn{position:absolute;top:calc(8px + env(safe-area-inset-top));right:12px;z-index:5;width:42px;height:42px;border-radius:21px;background:rgba(10,30,60,.8);color:#eaf6ff;border:1px solid #3a6a9a;font:22px/42px system-ui;cursor:pointer;padding:0}
#start .menuBack{display:none;position:absolute;inset:0;z-index:3;background:rgba(0,8,20,.4)}
#start.menu-on .menuBack{display:block}
#start .menu{position:absolute;top:calc(56px + env(safe-area-inset-top));right:12px;z-index:4;min-width:230px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 72px - env(safe-area-inset-top));overflow:auto;-webkit-overflow-scrolling:touch;background:rgba(8,18,36,.96);border:1px solid #3a6a9a;border-radius:14px;padding:8px;display:none;flex-direction:column;gap:4px;box-shadow:0 8px 28px #0008}
#start .menu.open{display:flex}
#start .menu button,#start .menu a,#start .menu .rbOpen{display:block;width:100%;box-sizing:border-box;text-align:left;background:transparent;color:#eaf6ff;border:0;border-radius:10px;padding:10px 12px;font:15px system-ui;cursor:pointer;text-decoration:none}
#start .menu button:hover,#start .menu a:hover,#start .menu .rbOpen:hover,#start .menu button:focus-visible,#start .menu a:focus-visible{background:rgba(80,160,255,.18);outline:none}
#start .menu .menuVer{margin-top:6px;padding:8px 12px 4px;border-top:1px solid #2a4a6a;font-size:11px;opacity:.7}
#start .menu .hint{display:block;padding:4px 12px 6px;font-size:11px;opacity:.6}
#start .snd{position:absolute;top:calc(8px + env(safe-area-inset-top));left:12px;z-index:3;width:42px;height:42px;border-radius:21px;background:rgba(10,30,60,.8);color:#eaf6ff;border:1px solid #3a6a9a;font:18px system-ui;cursor:pointer;padding:0}
#start .bar{display:none}
#start .top{display:none}`;
function backdrop(cv){const x=cv.getContext('2d');let w,h,dpr;const stars=[...Array(90)].map(()=>[Math.random(),Math.random()*.6,Math.random()*1.5+.3,Math.random()*6]);
 const fit=()=>{dpr=Math.min(2,devicePixelRatio||1);w=cv.clientWidth;h=cv.clientHeight;cv.width=w*dpr;cv.height=h*dpr;x.setTransform(dpr,0,0,dpr,0,0)};fit();addEventListener('resize',fit);
 const t0=performance.now();function frame(now){if(!ST.el)return;const t=(now-t0)/1000;
  const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#03081a');g.addColorStop(.6,'#0b2244');g.addColorStop(1,'#1b2a20');x.fillStyle=g;x.fillRect(0,0,w,h);
  for(const s of stars){x.globalAlpha=.4+.4*Math.sin(t*1.5+s[3]);x.fillStyle='#bfe6ff';x.fillRect(s[0]*w,s[1]*h,s[2],s[2])}x.globalAlpha=1;
  const gy=h*.78;x.fillStyle='#0d1a12';x.fillRect(0,gy,w,h-gy);
  // derrick silhouette (original line art)
  const cx=w>820?w*.82:w*.5,H=Math.min(h*.62,560),bw=H*.32;x.strokeStyle='rgba(120,200,255,.55)';x.lineWidth=2;x.shadowColor='#3cb4ff';x.shadowBlur=12;x.beginPath();
  x.moveTo(cx-bw/2,gy);x.lineTo(cx-bw*.08,gy-H);x.lineTo(cx+bw*.08,gy-H);x.lineTo(cx+bw/2,gy);for(let k=1;k<9;k++){const y=gy-H*k/9,f=1-k/9,a=bw/2*f+bw*.08*(1-f),y2=gy-H*(k+1)/9,f2=1-(k+1)/9,a2=bw/2*f2+bw*.08*(1-f2);x.moveTo(cx-a,y);x.lineTo(cx+a,y);x.moveTo(cx-a,y);x.lineTo(cx+a2,y2);x.moveTo(cx+a,y);x.lineTo(cx-a2,y2)}
  x.moveTo(cx-bw*.7,gy-H*.12);x.lineTo(cx+bw*.7,gy-H*.12);x.stroke();x.shadowBlur=0;
  // travelling block + rotating string
  const by=gy-H*(.55+.25*Math.sin(t*.6));x.fillStyle='#ffc94a';x.fillRect(cx-8,by,16,22);x.strokeStyle='rgba(255,220,120,.6)';x.lineWidth=1;x.beginPath();x.moveTo(cx,gy-H);x.lineTo(cx,by);x.stroke();
  for(let k=0;k<12;k++){const yy=by+22+k*((gy-by-22)/12);x.fillStyle=(k+Math.floor(t*6))%2?'#7d8a99':'#a9b6c4';x.fillRect(cx-3,yy,6,(gy-by-22)/12)}
  // wellbore under ground with glow
  x.strokeStyle='rgba(255,170,60,.7)';x.lineWidth=3;x.beginPath();x.moveTo(cx,gy);x.quadraticCurveTo(cx,h*.95,cx-(w>820?w*.25:w*.3),h*.98);x.stroke();
  const p=(t*.25)%1;x.fillStyle='#ffd27a';x.beginPath();x.arc(cx-(w>820?w*.25:w*.3)*p*p,gy+(h*.98-gy)*(2*p-p*p),4,0,7);x.fill();
  // flare & sparks
  for(let k=0;k<14;k++){const a=(t*1.3+k*.37)%1;x.globalAlpha=1-a;x.fillStyle=k%2?'#ff9a3c':'#ffd27a';x.beginPath();x.arc(cx-bw*.9+Math.sin(k+t)*6,gy-a*60,3*(1-a)+1,0,7);x.fill()}x.globalAlpha=1;
  ST.raf=requestAnimationFrame(frame)}ST.raf=requestAnimationFrame(frame)}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function tile(id,ic,t,s){return `<button class=tile data-go="${id}" id="st_${id}"><span class=ic>${ic}</span><span><b>${t}</b><small>${s}</small></span></button>`}
const GRP={plan:['📐','Plan','Wells and sites · New well, Import EDM, Saved sites'],drill:['🛢','Drill','Simulate, train and steer · Continue, New simulation, DD Training, DD Tracks, Rig showroom'],monitor:['📈','Monitor','Real wells · WITSML dashboard, Monitor a well'],ops:['🔧','Operations','Workover & intervention, Safety World']};
const LEAF=()=>({drill:[hasSave()&&['continue','▶','Continue','Resume your saved SIM rig and well'],['sim','🛢','New simulation','Pick a SIM well and start drilling'],['ddcab','🧭','DD Training','Directional driller cabin · steer the driller, manage the mud motor · SIM'],['ddtracks','🏎','DD Tracks','Select a steering track · cups, stars, best times · SIM'],['rtoc','📡',"Steve's RTOC",'Per-joint RTOC dashboard · tally, 3D joint, geosteering, whole-well context · SIM'],['showroom','🏁','Rig showroom','Browse <span id=st_rigN>all</span> rig types · spin, compare, use · SIM']],
 plan:[['well','📐','New well','Well Planning with a blank proposal'],['edm','📂','Import EDM','All sites & wells from an EDM file · stays on this device'],ST.saved?.length&&['saved','💾','Saved sites',ST.saved.length+' saved on this device · open without importing']],
 monitor:[['operations','◈','Drilling operations','Read-only WITSML · 3D well, joint tally and trends'],['wdash','📊','WITSML dashboard','Vertical depth/time logs + image logs · your WITSML store or SIM'],['monitor','📈','Monitor a well','Track progress · saved WITSML well or SIM']],
 ops:[['workover','🔧','Workover & intervention','Completions, workover, fishing, P&A, slickline, e-line, CT · SIM'],['safety','🦺','Safety World','Close corrective actions · hunt hazards on the rig · SIM']]});/* v5.12.18 paged menu; safety hook */
const PARENT={sim:'drill',saved:'plan'};
export function groupOf(id){const L=LEAF();for(const g in L)if(L[g].some(t=>t&&t[0]==id))return g;return null}
export function reveal(id){const g=groupOf(id);if(!g||!ST.el)return false;if(ST.menu!=g){ST.menu=g;render()}return true}
function render(){const T=ST.el.querySelector('.tiles'),L=LEAF(),hd=ST.el.querySelector('.pghd');let shown=[];
 if(ST.menu=='main'){T.innerHTML=Object.entries(GRP).map(([g,[i,t,s]])=>tile('grp:'+g,i,t,s).replace('class=tile','class="tile grp"')).join('')+tile('field','🏭','Field assets','EDM wells · pads · site assets').replace('class=tile','class="tile grp fld"');/* field-edm-1115: Field assets has its own home button */if(hd)hd.textContent=''}
 else if(GRP[ST.menu]){const ls=L[ST.menu].filter(Boolean);shown=ls.map(t=>t[0]);T.innerHTML=ls.map(t=>tile(...t)).join('')+tile('back','↩','Back','Main menu');if(hd)hd.textContent=GRP[ST.menu][1]}
 else if(ST.menu=='saved'){T.innerHTML=`<h3 class=svh>Saved sites (on this device)</h3>`+(ST.saved||[]).map(m=>`<div class=svrow>${tile('open:'+m.id,'🗺',esc(m.name),m.wells+' wells · '+m.sites+' sites · imported '+new Date(m.date).toLocaleDateString('en-AU')+' · '+(m.size>=1e6?(m.size/1e6).toFixed(1)+' MB':Math.max(1,Math.round(m.size/1e3))+' kB'))}<button class=svrm data-rm="${esc(m.id)}" aria-label="Remove ${esc(m.name)}">Remove</button></div>`).join('')+tile('back','↩','Back','Plan');if(hd)hd.textContent='Plan › Saved sites'}
 else{T.innerHTML=tile('simA','🎯','SIM proposal A','Directional J-curve to T1/T2 · 3 casing points')+tile('simFree','⛏','Free drilling','Vertical SIM well, no plan loaded')+tile('back','↩','Back','Drill');if(hd)hd.textContent='Drill › New simulation'}
 /* hidden pool: every leaf tile stays in the DOM (deep links, tests, showroom/rig-builder hooks click #st_*) */
 const P=ST.el.querySelector('.pool');P.innerHTML=Object.values(L).flat().filter(t=>t&&!shown.includes(t[0])).map(t=>tile(...t)).join('');
 P.querySelectorAll('.tile').forEach(b=>b.onclick=e=>{e.preventDefault();choose(b.dataset.go)});
 T.querySelectorAll('.svrm').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();const id=b.dataset.rm,m=(ST.saved||[]).find(x=>x.id==id);if(!confirm('Remove saved site "'+(m?.name||id)+'" from this device?'))return;const S=await import('./edmstore.js?v=5941');await S.remove(id);ST.saved=await S.list();if(!ST.saved.length)ST.menu='plan';render()});
 ST.items=[...T.querySelectorAll('.tile')];ST.i=0;for(const [k,b] of ST.items.entries()){b.onmouseenter=()=>focus(k);b.onclick=e=>{e.preventDefault();focus(k);choose()}}focus(0)}
function focus(k){if(!ST.items.length)return;k=(k+ST.items.length)%ST.items.length;if(k!=ST.i)beep(620);ST.i=k;ST.items.forEach((b,j)=>b.classList.toggle('on',j==k));ST.items[k].focus({preventScroll:true})}
function cols(){return innerWidth>=820?2:1}
function move(d){const c=cols();if(d=='l')focus(ST.i-1);else if(d=='r')focus(ST.i+1);else if(d=='u')focus(ST.i-c);else focus(ST.i+c)}
function back(){if(ST.menu!='main'){const from=ST.menu;ST.menu=PARENT[from]||'main';beep(300);render();if(ST.menu=='main'){const k=Object.keys(GRP).indexOf(from);if(k>=0)focus(k)}}}
function close(dest){ST.last=dest;const A=api();A.last=dest;if(dest!='join'&&dest!='continue'&&dest!='edm'&&dest!='monitor'&&dest!='wdash'&&dest!='operations'&&dest!='workover'&&dest!='ddcab'&&dest!='ddtracks'&&dest!='safety'&&dest!='field')try{localStorage.setItem('dw_start_save',JSON.stringify({t:Date.now(),dest}))}catch(err){}removeEventListener('keydown',key,true);cancelAnimationFrame(ST.raf);clearInterval(ST.padT);const e=ST.el;ST.el=null;e.classList.add('out');setTimeout(()=>e.remove(),360);try{dispatchEvent(new CustomEvent('dw:start',{detail:dest}))}catch(err){}}
async function choose(g){const go=g||ST.items[ST.i]?.dataset.go;beep(880,.1);
 if(go?.startsWith('grp:')){ST.menu=go.slice(4);return render()}
 if(go=='sim'){ST.menu='sim';return render()}
 if(go=='operations'){close('operations');await openOperations();return}
 if(go=='field'){close('field');const m=await import('./field-world-plus/boot.js?v=fe1');m.openField(null,{home:true}).catch(e=>alert('Could not open Field assets: '+e.message));return}
 if(go=='wdash'){close('wdash');const m=await import('./wdash.js?v=whole-history-r1');m.open();return}
 if(go=='monitor'){close('monitor');const m=await import('./monitor.js?v=b12');m.open();return}
 if(go=='ddtracks'){close('ddtracks');const m=await import('./ddtracks.js?v=t2');m.open();return}
 if(go=='ddcab'){close('ddcab');const m=await import('./ddcab.js?v=r2');m.open();return}
 if(go=='safety'){close('safety');const m=await import('./safety.js?v=s1');m.open();return}/* safety hook */
 if(go=='showroom'){close('showroom');const P=await import('./srpick.js?v=b10').catch(()=>null);if(P){await P.open();return}const m=await import('./showroom.js?v=b18');m.init();m.open();return}
 if(go=='workover'){close('workover');const m=await import('./workover.js?v=b15');m.open();return}
 if(go=='saved'){ST.menu='saved';return render()}
 if(go?.startsWith('open:')){close('edm');const m=await import('./edmui.js?v=dr1115');m.openSaved(go.slice(5)).catch(e=>alert('Could not open saved site: '+e.message));return}
 if(go=='edm'){close('edm');const m=await import('./edmui.js?v=dr1115');m.open();return}if(go=='back')return back();
 if(go=='continue'||go=='simFree')return close(go);
 if(go=='rtoc'){close('rtoc');const m=await import('./rtoc.js?v=u1');m.open();return}
 if(go=='simA'){close('simA');const P=await wait(()=>window.GX?.wplan);P.calc(JSON.parse(JSON.stringify(P.DEFAULT)));return}
 if(go=='well'){close('wplan');const P=await wait(()=>window.GX?.wplan);P.calc({...JSON.parse(JSON.stringify(P.DEFAULT)),name:'New well (SIM)',targets:[{name:'TD',tvd:1000,n:100,e:0,tol:30,dls:3}],casing:[],steps:[],assumed:['targets','surface','kop','dls']});P.open('inputs');return}
 if(go=='login'){close('join');await wait(()=>window.GX?.player);const m=await import('./player.js?v=592');m.join(true);
  addEventListener('dw:player',()=>{wait(()=>window.GX?.session).then(s=>s.open(true)).catch(()=>{})},{once:true})}}
function menuOpen(){return !!ST.el?.querySelector('.menu.open')}
function setMenu(on){const b=$('stMenuBtn'),m=$('stMenu');if(!b||!m)return;m.classList.toggle('open',!!on);ST.el?.classList.toggle('menu-on',!!on);b.setAttribute('aria-expanded',!!on)}
function key(e){if(!ST.el)return;if(document.getElementById('syncP'))return;if(document.getElementById('rigBuilder'))return;/* rig-builder hook */const k=e.key;
 if(k=='Escape'||k=='Backspace'){if(menuOpen()){setMenu(false);e.preventDefault();e.stopPropagation();return}}
 const m={ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d',a:'l',d:'r',w:'u',s:'d'}[k];
 if(menuOpen())return;
 if(m){move(m)}else if(k=='Enter'||k==' '){choose()}else if(k=='Escape'||k=='Backspace'){back()}else return;e.preventDefault();e.stopPropagation()}
function pad(){if(document.getElementById('rigBuilder'))return;/* rig-builder hook */if(!ST.el)return;const gps=navigator.getGamepads?.()||[];for(const g of gps){if(!g)continue;const b=i=>!!g.buttons[i]?.pressed,ax=g.axes||[];
  const s={u:b(12)||ax[1]<-.5,d:b(13)||ax[1]>.5,l:b(14)||ax[0]<-.5,r:b(15)||ax[0]>.5,a:b(0)||b(9),b:b(1)};const P=ST.gp.prev[g.index]||{};
  for(const d of ['u','d','l','r'])if(s[d]&&!P[d])move(d);if(s.a&&!P.a)choose();if(s.b&&!P.b)back();ST.gp.prev[g.index]=s}
 }
export function show(){api();if(ST.el)return;const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
 ST.snd=localStorage.getItem(SK)=='1';const e=document.createElement('section');e.id='start';e.setAttribute('role','dialog');e.setAttribute('aria-label','Start screen');
 e.innerHTML=`<canvas></canvas><div class=menuBack id=stMenuBack></div><button id=stMenuBtn class=menuBtn type=button aria-label="Menu" aria-expanded=false aria-controls=stMenu>☰</button><div id=stMenu class=menu role=menu>
 <button id=stDemo type=button role=menuitem>Watch the demo</button>
 <button id=stSync type=button role=menuitem aria-label="Sync saved sites">Sync sites</button>
 <a id=stGuide role=menuitem href="./user-guide.html" target=_blank rel=noopener>How to play</a>
 <button id=st_login data-go=login type=button role=menuitem aria-label="Log in">Log in</button>
 <div class=hint>Arrows or WASD move · Enter selects · Esc goes back</div>
 <div id=stVer class=menuVer></div></div>
 <button id=stSnd class=snd type=button aria-pressed=false aria-label="Sound off"></button>
 <div class=ui><h1>DRILLING WORLD</h1><div class=tagline>Can you drill the well without losing it?</div><div class=pghd aria-live=polite></div><div class=tiles role=menu></div><div class=pool hidden></div></div>`;
 document.body.appendChild(e);ST.el=e;$('st_login').onclick=ev=>{ev.preventDefault();ev.stopPropagation();setMenu(false);choose('login')};backdrop(e.querySelector('canvas'));
 const sb=$('stSnd'),upd=()=>{sb.textContent=ST.snd?'🔊':'🔇';sb.setAttribute('aria-pressed',ST.snd);sb.setAttribute('aria-label',ST.snd?'Sound on':'Sound off')};upd();sb.onclick=ev=>{ev.stopPropagation();ST.snd=!ST.snd;try{localStorage.setItem(SK,ST.snd?'1':'0')}catch(err){}upd();beep(700)};
 $('stMenuBtn').onclick=ev=>{ev.preventDefault();ev.stopPropagation();setMenu(!menuOpen())};
 $('stMenuBack').onclick=ev=>{ev.preventDefault();ev.stopPropagation();setMenu(false)};
 e.addEventListener('click',ev=>{if(menuOpen()&&!ev.target.closest('#stMenu,#stMenuBtn'))setMenu(false)});
 $('stDemo').onclick=ev=>{ev.preventDefault();ev.stopPropagation();setMenu(false);const go=()=>{if(window.GX?.vla?.demo){GX.vla.demo();return true}const b=$('vlaMain');if(b){b.click();return true}return false};if(!go())import('./vla.js?v=gd20261110').then(m=>m.demo())};
 installGuide();
 const sv=()=>{const e=$('stVer');if(e)e.textContent=ver()};sv();setTimeout(sv,500);
 $('stSync').onclick=async ev=>{ev.stopPropagation();setMenu(false);const m=await import('./sitesync.js?v=y3');await m.open();addEventListener('dw:sites-changed',()=>import('./edmstore.js?v=5941').then(S=>S.list()).then(L=>{ST.saved=L;if(ST.el&&(ST.menu=='main'||ST.menu=='plan'))render()}),{once:true})};/* sync hook */
 addEventListener('keydown',key,true);ST.padT=setInterval(pad,50);ST.menu='main';render();
 import('./edmstore.js?v=5941').then(S=>S.list()).then(L=>{ST.saved=L;if(ST.el&&L.length){const k=ST.i;render();focus(k)}}).catch(()=>{})}
/* v5.12.19: guide link in Settings installed at module load (phones often skip the start screen, so show() never ran) */
function installGuide(){const gl=()=>{const g=document.getElementById('uig_set');if(!g||document.getElementById('setGuide'))return;const a=document.createElement('a');a.id='setGuide';a.href='./user-guide.html';a.target='_blank';a.rel='noopener';a.textContent='User guide (HTML / PDF)';a.style.cssText='display:block;color:#9cf;font-size:12px;margin:6px 0';g.appendChild(a);const b=document.createElement('a');b.id='setWdash';b.href='#';b.textContent='📊 WITSML dashboard (logs + image logs)';b.style.cssText=a.style.cssText;b.onclick=e=>{e.preventDefault();import('./wdash.js?v=whole-history-r1').then(m=>m.open())};g.appendChild(b)};gl();if(!window.__dwGuideMO){window.__dwGuideMO=new MutationObserver(gl);window.__dwGuideMO.observe(document.body,{childList:true,subtree:true})}}
installGuide();
import('./rtoc.js?v=u1').catch(()=>{});/* Steve's RTOC: recorder + HUD button */
const API={ST,show,shouldShow,hasSave,reveal,groupOf,last:null,enter:d=>{if(ST.el)close(d||'simFree');return true}};function api(){window.dwStart=API;window.GX=window.GX||{};if(window.GX.start!==API)window.GX.start=API;return API}api();addEventListener('load',api);setTimeout(api,3000);
if(shouldShow()){if(document.body)show();else addEventListener('DOMContentLoaded',show)}

if(new URLSearchParams(location.search).has('workover'))import('./workover.js?v=b15');

const openOperations = () => import('./operations.js?v=whole-history-r1').then(m => m.open()).catch(e => console.error('Drilling operations',e));
$('opsDashboard').addEventListener('click',()=>{location.href='./ops.html'});/* operator screen (live WITSML); engineering dashboard stays at ?operations */
if(q.has('operations')) openOperations();
