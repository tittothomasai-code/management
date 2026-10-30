// workover.js (feat/workover): Workover / Completions / Intervention mode. Own Three.js scene (pulling unit, slickline, e-line, coiled tubing)
// with a cut-away SIM well and a step sequence player (same controls as the rig Sequence panel). Everything is SIM, never LIVE. No network.
import * as E from './woeng.js';
let THREE,OC;const K=0.02;// depth scale in the cut-away: 1 m downhole = 0.02 scene units (surface kit is 1:1 in metres)
const R={el:null,J:null,job:null,TL:null,t:0,play:false,speed:1,stepMode:false,hold:false,ticks:{},raf:0,last:null,view:'auto'};
const $=s=>R.el?.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const CSS=`#wo{position:fixed;inset:0;z-index:100000;background:#0b1422;color:#e8f2ff;font:14px system-ui,-apple-system,Segoe UI,sans-serif}
#wo canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
#wo .wotop{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;align-items:center;padding:calc(6px + env(safe-area-inset-top)) 8px 6px;background:linear-gradient(#0b1422ee,#0b142200);flex-wrap:wrap}
#wo .wotop b{font-size:16px}#wo .wosim{background:#8a8f98;color:#fff;border-radius:6px;padding:1px 7px;font-size:12px;font-weight:700;letter-spacing:.1em}
#wo button,#wo select{background:#17304f;color:#e8f2ff;border:1px solid #3a6a9a;border-radius:8px;padding:6px 10px;font:13px system-ui;min-height:34px;cursor:pointer}
#wo button.on{background:#2a6fb0;border-color:#7fe3ff}#wo .wox{margin-left:auto}
#wo .wohud{position:absolute;right:8px;top:52px;background:#0d1b2ecc;border:1px solid #2b4a6e;border-radius:10px;padding:6px 9px;font:12px ui-monospace,monospace;line-height:1.5;min-width:170px}
#wo .wopanel{position:absolute;left:8px;bottom:8px;width:370px;max-height:calc(100% - 70px);overflow:auto;background:#0d1b2ee6;border:1px solid #2b4a6e;border-radius:12px;padding:8px 10px;box-sizing:border-box}
#wo .wosteps div{padding:3px 4px;border-radius:6px;font-size:13px;cursor:pointer}#wo .wosteps .cur{background:#1d3d63;color:#fff}#wo .wosteps .dn{opacity:.6}
#wo .wocalc{margin:6px 0;padding:6px;border-radius:8px;background:#11283f;color:#ffd98a;font-size:12.5px}
#wo .wochk label{display:block;font-size:13px;padding:3px 0}#wo .wochk input{width:18px;height:18px;vertical-align:middle;margin-right:6px}
#wo .wobar{height:6px;background:#203a58;border-radius:4px;overflow:hidden;margin:4px 0}#wo .wobar i{display:block;height:100%;background:#4fc3ff}
#wo .woctl{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:4px 0}
@media (max-width:700px){#wo .wopanel{left:0;right:0;bottom:0;width:auto;max-height:44%;border-radius:12px 12px 0 0;padding-bottom:calc(8px + env(safe-area-inset-bottom))}#wo .wohud{top:auto;bottom:calc(44% + 6px);right:6px;font-size:11px;min-width:0}#wo .wotop b{font-size:14px}}`;
// ---------- scene ----------
let ren,scene,cam,ctl,G={};
const M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.6,metalness:.3,...o});
function cyl(r,h,m,seg=20){return new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),m)}
function box(x,y,z,m){return new THREE.Mesh(new THREE.BoxGeometry(x,y,z),m)}
function vbar(mesh,y0,y1){const h=Math.max(1e-3,Math.abs(y1-y0));mesh.scale.y=h;mesh.position.y=(y0+y1)/2;mesh.visible=h>2e-3}// unit-height mesh between y0,y1
async function build(cv){THREE=THREE||await import('three');OC=OC||(await import('./vendor/OrbitControls.js')).OrbitControls;
 ren=new THREE.WebGLRenderer({canvas:cv,antialias:true});ren.setPixelRatio(Math.min(2,devicePixelRatio||1));scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1422);
 cam=new THREE.PerspectiveCamera(45,1,.1,2000);cam.position.set(26,18,34);ctl=new OC(cam,cv);ctl.target.set(0,6,0);ctl.enableDamping=true;
 scene.add(new THREE.HemisphereLight(0xcfe6ff,0x3a3020,1.1));const sun=new THREE.DirectionalLight(0xffffff,1.6);sun.position.set(30,50,20);scene.add(sun);
 // ground with a cut-away slot so the well can be seen
 const gm=M(0x3a4a2e,{roughness:1,metalness:0,transparent:true,opacity:.55,depthWrite:false});for(const [x,z,w,d] of [[-45,0,80,120],[45,0,80,120],[0,-33,10,54],[0,33,10,54]]){const g=box(w,.4,d,gm);g.position.set(x*1.0+(x<0?40:-40)*0,-.2,z);scene.add(g)}
 const ce=box(6,.3,6,M(0x777777,{metalness:0}));ce.position.y=-.05;scene.add(ce);
 // formations (D's strat API when present; else simple SIM bands) as a back wall of the cut-away
 G.earth=new THREE.Group();scene.add(G.earth);await earth();
 // casing (transparent), cement sheath, tubing, packer, SSSV, perfs, fluids
 const unit=new THREE.CylinderGeometry(1,1,1,24);const U=(m,r)=>{const o=new THREE.Mesh(unit,m);o.scale.set(r,1,r);scene.add(o);return o};
 G.csg=U(M(0x9aa7b6,{transparent:true,opacity:.28,depthWrite:false}),1.1);vbar(G.csg,0,-E.WELL.csg.shoe*K);
 G.sheath=U(M(0x8d8d86,{transparent:true,opacity:.18,depthWrite:false}),1.45);vbar(G.sheath,0,-E.WELL.csg.shoe*K);
 G.tbg=U(M(0x5f87b4,{metalness:.6}),.42);G.fish=U(M(0x8a6f4a,{metalness:.5}),.42);G.kill=U(M(0x4fc3ff,{transparent:true,opacity:.55}),.34);
 G.sand=U(M(0xc9a96a,{roughness:1}),1.05);G.gp=U(M(0xf3d36b,{roughness:1,transparent:true,opacity:.85}),1.08);G.line=U(M(0xdddddd),.06);
 G.pkr=cyl(1,0.9,M(0xff9a3c));scene.add(G.pkr);G.pkr.position.y=-E.WELL.packer*K;
 G.sssv=cyl(.62,.7,M(0x2ecc71));scene.add(G.sssv);G.sssv.position.y=-E.WELL.sssv*K;
 G.perf=new THREE.Group();scene.add(G.perf);const pm=M(0xff5a2a,{emissive:0x000000});G.perfM=pm;
 for(let d=E.WELL.perf[0];d<=E.WELL.perf[1];d+=2)for(let a=0;a<6;a++){const c=new THREE.Mesh(new THREE.ConeGeometry(.12,1.1,6),pm);const an=a*Math.PI/3+d;c.rotation.z=Math.PI/2;c.rotation.y=an;c.position.set(Math.cos(an)*1.6,-d*K,-Math.sin(an)*1.6);G.perf.add(c)}
 G.cem=new THREE.Group();scene.add(G.cem);G.tool=new THREE.Group();scene.add(G.tool);
 G.flow=new THREE.Group();scene.add(G.flow);for(let k=0;k<40;k++){const p=new THREE.Mesh(new THREE.SphereGeometry(.16,6,4),M(0x6dff9a,{emissive:0x1a6a2a}));p.userData.k=k/40;G.flow.add(p)}
 // wellhead: tubing spool + Xmas tree; BOP; lubricator
 G.head=box(1.6,1.2,1.6,M(0x6b7d8c));G.head.position.y=.6;scene.add(G.head);
 G.tree=new THREE.Group();scene.add(G.tree);{const rm=M(0xc0392b),vm=M(0x8796a5);for(let k=0;k<3;k++){const v=box(1,0.7,1,vm);v.position.y=1.6+k*0.9;G.tree.add(v);const wh=new THREE.Mesh(new THREE.TorusGeometry(.45,.07,8,20),rm);wh.position.set(.9,1.6+k*.9,0);wh.rotation.y=Math.PI/2;G.tree.add(wh)}
  const wing=box(1.8,.45,.45,vm);wing.position.set(1.2,2.5,0);G.tree.add(wing);const cap=cyl(.35,.5,vm);cap.position.y=4.3;G.tree.add(cap)}
 G.bop=new THREE.Group();scene.add(G.bop);{const bm=M(0xd4a017);const an=cyl(1.2,1.6,bm);an.position.y=5.6;G.bop.add(an);for(let k=0;k<3;k++){const r=box(3.2,.8,1.4,bm);r.position.y=1.7+k*1.1;G.bop.add(r)}}
 G.lub=cyl(.32,9,M(0xb8c4d0,{metalness:.7}));G.lub.position.y=4+4.5+.6;scene.add(G.lub);
 // pulling unit (carrier + mast + crown + travelling block + lines) and pipe rack
 G.rig=new THREE.Group();scene.add(G.rig);{const cm=M(0xe0b020),sm=M(0x9aa5b0,{metalness:.7});const car=box(14,2.2,3,cm);car.position.set(-10,1.5,0);G.rig.add(car);
  const cab=box(3,2.6,3,M(0xd0d6dc));cab.position.set(-18.5,1.7,0);G.rig.add(cab);for(const x of [-16,-13,-6,-3])for(const z of [-1.6,1.6]){const wh=cyl(.7,.5,M(0x222222));wh.rotation.x=Math.PI/2;wh.position.set(x,.7,z);G.rig.add(wh)}
  G.mast=new THREE.Group();G.mast.position.set(-2.2,2.6,0);G.rig.add(G.mast);for(const z of [-.7,.7]){const l=box(.35,28,.35,sm);l.position.set(0,14,z);G.mast.add(l)}for(let y=2;y<28;y+=2.4){const r=box(.12,.12,1.4,sm);r.position.set(0,y,0);G.mast.add(r)}
  const crown=box(1.6,.8,1.8,sm);crown.position.set(1.4,28,0);G.mast.add(crown);
  G.blk=box(1.1,1.8,1.1,M(0xffc94a));G.rig.add(G.blk);G.lines=box(.06,1,.06,M(0xcccccc));G.rig.add(G.lines);
  G.elev=box(1.2,.3,.8,M(0x777777));G.rig.add(G.elev);
  const rack=new THREE.Group();rack.position.set(8,0,6);for(const x of [-5,5]){const s=box(.3,1,3.5,sm);s.position.set(x,.5,0);rack.add(s)}G.rack=[];for(let k=0;k<14;k++){const j=cyl(.045*2,11,M(0x5f87b4,{metalness:.6}),8);j.rotation.z=Math.PI/2;j.position.set(0,1.1+Math.floor(k/7)*.2,-1.4+(k%7)*.45);rack.add(j);G.rack.push(j)}G.rig.add(rack)}
 // service truck (slickline / e-line / CT) with drum or reel, A-frame crane, injector + gooseneck
 G.truck=new THREE.Group();scene.add(G.truck);{const tm=M(0x2a7ab8),sm=M(0x9aa5b0,{metalness:.7});const bd=box(10,3,3,tm);bd.position.set(-14,2,6);G.truck.add(bd);
  const cab=box(2.6,2.6,3,M(0xd0d6dc));cab.position.set(-20.4,1.8,6);G.truck.add(cab);for(const x of [-18,-11,-10])for(const z of [4.4,7.6]){const wh=cyl(.7,.5,M(0x222222));wh.rotation.x=Math.PI/2;wh.position.set(x,.7,z);G.truck.add(wh)}
  G.drum=cyl(1.3,2.4,M(0x444b55));G.drum.rotation.x=Math.PI/2;G.drum.position.set(-12,3.2,6);G.truck.add(G.drum);
  G.reel=new THREE.Group();G.reel.position.set(-12,4.2,6);for(const z of [-1.4,1.4]){const f=cyl(3.2,.15,M(0x2a7ab8),32);f.rotation.x=Math.PI/2;f.position.z=z;G.reel.add(f)}{const c=cyl(2.6,2.7,M(0x9aa5b0,{metalness:.7}),32);c.rotation.x=Math.PI/2;G.reel.add(c)}G.truck.add(G.reel);
  G.crane=new THREE.Group();for(const z of [-.9,.9]){const l=box(.25,14,.25,sm);l.position.set(-2,7,z+.0);l.rotation.z=-.08;G.crane.add(l)}const sh=new THREE.Mesh(new THREE.TorusGeometry(.6,.1,8,20),sm);sh.position.set(-1.2,13.8,0);G.crane.add(sh);G.truck.add(G.crane);
  G.inj=box(1.8,2.4,1.8,M(0xd94f2b));G.inj.position.y=14.2;G.truck.add(G.inj);G.goose=new THREE.Mesh(new THREE.TorusGeometry(2.4,.12,8,24,Math.PI),sm);G.goose.position.set(0,15.5,0);G.goose.rotation.y=Math.PI/2;G.truck.add(G.goose);
  G.wire=box(.04,1,.04,M(0xeeeeee));G.truck.add(G.wire)}
 const lbl=(t,y,c='#9fd')=>{const cv=document.createElement('canvas');cv.width=256;cv.height=48;const x=cv.getContext('2d');x.fillStyle=c;x.font='bold 26px system-ui';x.fillText(t,4,34);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false}));s.scale.set(8,1.5,1);s.position.set(6.5,y,0);scene.add(s);return s};
 lbl('SSSV '+E.WELL.sssv+' m',-E.WELL.sssv*K);lbl('Packer '+E.WELL.packer+' m',-E.WELL.packer*K,'#fc9');lbl('Perfs '+E.WELL.perf.join('–')+' m',-E.WELL.perf[0]*K-.4,'#f97');lbl('Shoe '+E.WELL.csg.shoe+' m',-E.WELL.csg.shoe*K-.5,'#ccc');
 for(let d=500;d<E.WELL.td;d+=500)lbl(d+' m',-d*K,'#678');
 addEventListener('resize',fit);fit()}
async function earth(){let F=null;try{const S=await import('./strat.js');const Mdl=S.SIM_STRAT?S.SIM_STRAT():null;F=(Mdl?.formations||[]).map(f=>({name:f.name,top:f.top,col:(S.LITH?.[f.lith]?.color)||null}))}catch(e){}
 if(!F?.length)F=[{name:'Soil/clay',top:0,col:'#6b5a3a'},{name:'Sandstone',top:150,col:'#c9a96a'},{name:'Shale',top:700,col:'#5a6470'},{name:'Limestone',top:1250,col:'#9fa79a'},{name:'Shale',top:1900,col:'#4d5761'},{name:'Reservoir sand',top:2410,col:'#d8b26a'},{name:'Shale',top:2470,col:'#4d5761'}];
 for(let i=0;i<F.length;i++){const a=Math.max(0,F[i].top),b=Math.min(E.WELL.td+60,F[i+1]?.top??E.WELL.td+60);if(b<=a)continue;const m=box(40,(b-a)*K,.4,M(new THREE.Color(F[i].col||'#556'),{roughness:1,metalness:0}));m.position.set(0,-(a+b)/2*K,-6);G.earth.add(m)}}
function fit(){if(!ren||!R.el)return;const c=ren.domElement;const w=c.clientWidth,h=c.clientHeight;ren.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
function mkTool(name){G.tool.clear();if(!name)return;const col={gun:0x3a3a3a,screen:0xc0c0c0,cutter:0xaa3333,overshot:0x8a5a2a,gauge:0x7fa0c0,logtool:0xffd04a,nozzle:0xd94f2b}[name]||0x999999;
 const t=cyl(name=='screen'?.6:.32,name=='screen'?(E.WELL.perf[1]-E.WELL.perf[0]+6)*K:1.4,M(col,{metalness:.6}));t.position.y=-(name=='screen'?t.geometry.parameters.height/2:.7);G.tool.add(t);
 if(name=='overshot'){const g=cyl(.52,.8,M(0x5a3a1a));g.position.y=-1.4;G.tool.add(g)}}
// ---------- apply state ----------
function apply(s,t){const W=E.WELL,rig=s.unit=='rig',truck=!rig;G.rig.visible=rig;G.truck.visible=truck;
 G.mast.rotation.z=rig?(1-s.mast)*Math.PI/2*0.98:0;G.blk.visible=G.lines.visible=G.elev.visible=rig&&s.mast>.95;
 const by=2.6+3+s.blk*22;G.blk.position.set(-2.2+1.4,by,0);vbar(G.lines,by+.9,2.6+28);G.lines.position.x=-.8;G.elev.position.set(-.8,by-1.1,0);
 G.tree.visible=s.tree>.5;G.bop.visible=s.bop>.5&&!G.tree.visible;G.lub.visible=s.lub>.5;G.lub.position.y=(G.tree.visible?4.6:1.2)+4.5;
 G.reel.visible=G.inj.visible=G.goose.visible=s.unit=='ct';G.drum.visible=s.unit!='ct';G.inj.position.y=G.lub.position.y+5.6;G.goose.position.y=G.inj.position.y+1.2;
 G.drum.rotation.y=s.tdep*.05;G.reel.rotation.z=s.tdep*.004;
 // wire from drum/reel over crane sheave (simplified straight run)
 if(truck){const top=G.lub.visible?G.lub.position.y+4.5:5;vbar(G.wire,4,top+2.5);G.wire.position.set(-6,G.wire.position.y,0);G.wire.rotation.z=-0.5}
 // tubing / fish
 const fishTop=s.fishTop||0,str=rig?s.str:(s.str||W.packer);vbar(G.tbg,.6,-Math.max(0.001,str)*K);G.tbg.visible=str>1;
 G.fish.visible=fishTop>0&&str<fishTop+1;if(G.fish.visible)vbar(G.fish,-fishTop*K,-W.packer*K);
 const pkrOn=G.tbg.visible&&Math.abs(str-W.packer)<15||G.fish.visible||(!rig&&true);G.pkr.visible=pkrOn||s.pkr>0;G.pkr.scale.set(s.pkr>0?1:.62,1,s.pkr>0?1:.62);G.pkr.position.y=-(G.tbg.visible&&!G.fish.visible&&rig?Math.min(str,W.packer):W.packer)*K;
 if(rig&&G.tbg.visible&&str<W.packer-15&&!G.fish.visible)G.pkr.position.y=-str*K;
 G.sssv.visible=G.tbg.visible&&str>W.sssv;G.sssv.material.color.set(s.sssv>.5?0x2ecc71:0xe74c3c);
 G.perf.visible=s.perf>0.02;G.perfM.emissive.set(s.perf>0.02&&s.perf<0.98?0xff6a00:0x000000);G.perf.scale.set(1,1,1);
 vbar(G.kill,0,-Math.min(W.perf[0],s.kill*W.perf[0])*K);G.kill.visible=s.kill>0.01;
 G.sand.visible=s.sand>0.01;vbar(G.sand,-W.sandTop*K,-W.packer*K);G.gp.visible=s.gp>0.01;vbar(G.gp,-(W.perf[1]+3)*K,-(W.perf[1]+3-(W.perf[1]-W.perf[0]+12)*s.gp)*K);
 const ck=JSON.stringify(s.cem);if(ck!=G.cemKey){G.cemKey=ck;G.cem.clear();for(const [a,b] of s.cem||[]){const c=cyl(1.05,(b-a)*K,M(0xb8b8b0,{roughness:1}));c.position.y=-(a+b)/2*K;G.cem.add(c)}}
 if(G.toolName!=s.tool){G.toolName=s.tool;mkTool(s.tool)}G.tool.visible=!!s.tool;const td=rig&&s.tool&&s.tool!='cutter'?Math.max(s.tdep,str):s.tdep;G.tool.position.set(s.jar?Math.sin(t*40)*.08:0,-td*K,0);
 G.line.visible=!!s.tool&&(truck||s.tool=='cutter');if(G.line.visible){vbar(G.line,G.lub.visible?G.lub.position.y+4.5:1,-td*K);G.line.scale.x=G.line.scale.z=s.unit=='ct'?.2:.05}
 G.flow.visible=s.flow>0.05;if(G.flow.visible){const bot=Math.min(W.perf[0],str||W.packer)*K;for(const p of G.flow.children){const u=(p.userData.k+t*.15)%1;p.position.set(Math.sin(p.userData.k*40)*.2,-bot*(1-u),0)}}
 if(R.view=='auto'){const foc=s.tool?td:(rig&&s.str>40&&s.str<W.packer-40?s.str:0);const ty=foc>40?-foc*K:6;ctl.target.y+=(ty-ctl.target.y)*.05}}
// ---------- UI ----------
function hud(s){const W=E.WELL,f=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'–';const unit={rig:'Pulling unit',slick:'Slickline unit',wl:'E-line unit',ct:'Coiled tubing unit'}[s.unit];
 return `<b>${unit}</b> <span class=wosim>SIM</span><br>${s.unit=='rig'?'String '+f(s.str,0)+' m':'Tool '+f(s.tdep,0)+' m'}<br>${s.unit=='rig'?'Hookload':s.unit=='ct'?'CT weight':'Line tension'} ${f(s.hook)} kN<br>WHP ${f(s.whp)} MPa · BHP ${f(s.bhp)} MPa<br>Kill SG ${f(E.killSG(),3)}${s.kill>.5?' (in hole)':''}<br>Packer ${s.pkr>.5?'set':'free'} · SSSV ${s.sssv>.5?'open':'closed'}<br>${s.tree>.5?'Tree on':s.bop>.5?'BOP on':'Open wellhead'}${s.flow>.5?' · flowing':''}`}
function renderList(){const J=R.J,TL=R.TL,s=R.last||{i:0};$('#woSteps').innerHTML=TL.steps.map((st,k)=>`<div data-k=${k} class="${k==s.i&&!s.done?'cur':k<s.i||s.done?'dn':''}">${k<s.i||s.done?'✓':k==s.i?'▶':'·'} ${k+1}. ${esc(st.t)}</div>`).join('');
 $('#woSteps').querySelectorAll('[data-k]').forEach(d=>d.onclick=()=>{seek(TL.steps[+d.dataset.k].t0+.001);R.hold=false});const cur=TL.steps[s.i];
 $('#woCalc').innerHTML=cur?.calc?esc(cur.calc):'<i>No calculation for this step</i>';
 $('#woChk').innerHTML=(cur?.chk||[]).map((c,j)=>`<label><input type=checkbox data-j=${j} ${R.ticks[s.i+':'+j]?'checked':''}>${esc(c)}</label>`).join('')||'<small>No checks for this step</small>';
 $('#woChk').querySelectorAll('input').forEach(b=>b.onchange=()=>{R.ticks[s.i+':'+b.dataset.j]=b.checked;status()})}
function checksDone(i){return (R.TL.steps[i]?.chk||[]).every((_,j)=>R.ticks[i+':'+j])}
function status(){const s=R.last;if(!s)return;const TL=R.TL;$('#woBar').style.width=(100*Math.min(1,R.t/TL.T))+'%';
 $('#woSt').textContent=s.done?'Job complete (SIM). Pick another job or press Play to repeat.':R.hold?(checksDone(s.i)?'Step done. Press Step to go on.':'Tick the checks, then press Step.'):R.play?'Running: step '+(s.i+1)+' of '+TL.steps.length:'Paused. Press Play or Step.';
 $('#woStep').disabled=R.hold&&!checksDone(s.i)}
function setJob(key){R.J=E.jobs();for(const k in R.J)R.J[k].key=k;R.job=R.J[key]?key:'workover';R.TL=E.timeline(R.J[R.job]);R.t=0;R.ticks={};R.hold=false;$('#woJob').value=R.job;R.lastI=-1;tick(0,true)}
function seek(t){R.t=Math.max(0,Math.min(R.TL.T,t));tick(0,true)}
let lastT=0;function tick(dt,force){const J=R.J[R.job],TL=R.TL;if(R.play&&!R.hold)R.t=Math.min(TL.T,R.t+dt*R.speed);
 let s=E.stateAt(J,TL,R.t);
 if(R.stepMode&&R.play&&!R.hold&&s.i!=R.lastI&&R.lastI>=0&&s.i>R.lastI){R.t=TL.steps[s.i].t0-1e-6;R.hold=true;s=E.stateAt(J,TL,R.t);s.i=R.lastI}
 if(!R.stepMode&&s.i!=R.lastI)for(let k=0;k<s.i;k++)(TL.steps[k].chk||[]).forEach((_,j)=>R.ticks[k+':'+j]=true);
 if(s.done)R.play=false;
 R.last=s;apply(s,performance.now()/1000);$('#woHud').innerHTML=hud(s);if(s.i!=R.lastI||force||s.done!=R.lastDone){R.lastI=R.hold?R.lastI:s.i;R.lastDone=s.done;renderList()}status();
 $('#woPlay').classList.toggle('on',R.play)}
function clock(){if(!R.el)return;const now=performance.now(),dt=Math.min(.5,(now-(lastT||now))/1000);lastT=now;tick(dt)}// time runs on a timer so slow GPUs do not slow the job clock
function loop(){if(!R.el)return;apply(R.last,performance.now()/1000);ctl.update();ren.render(scene,cam);R.raf=requestAnimationFrame(loop)}
export async function open(jobKey='workover'){if(R.el)close();const st=document.createElement('style');st.id='woCss';st.textContent=CSS;document.head.appendChild(st);
 const d=document.createElement('div');d.id='wo';R.el=d;const J=E.jobs(),cats=[...new Set(Object.values(J).map(j=>j.cat))];
 d.innerHTML=`<canvas></canvas><div class=wotop><b>🔧 Workover &amp; intervention</b><span class=wosim>SIM</span>
 <button data-v=auto class=on>Auto view</button><button data-v=surf>Surface</button><button data-v=well>Whole well</button><button class=wox id=woX aria-label="Close workover">✕ Close</button></div>
 <div class=wohud id=woHud></div>
 <div class=wopanel><b style="color:#8fd">Sequence</b> <span class=wosim>SIM</span>
 <select id=woJob style="width:100%;margin:4px 0">${cats.map(c=>`<optgroup label="${c}">${Object.entries(J).filter(([,j])=>j.cat==c).map(([k,j])=>`<option value=${k}>${esc(j.label)}</option>`).join('')}</optgroup>`).join('')}</select>
 <div class=woctl><button id=woPlay>▶ Play</button><button id=woStep>⏭ Step</button><button id=woPause>⏸ Pause</button><button id=woStop>■ Stop</button>
 <label style="font-size:13px"><input type=checkbox id=woSm> step-by-step</label> Speed <select id=woSpd>${[.5,1,2,5].map(v=>`<option ${v==1?'selected':''}>${v}</option>`).join('')}</select></div>
 <div class=wobar><i id=woBar style="width:0"></i></div><div id=woSt style="color:#fd8;font-size:13px"></div>
 <div class=wocalc id=woCalc></div><div class=wochk id=woChk></div><div class=wosteps id=woSteps></div>
 <small style="opacity:.65">SIM teaching model. Simplified methods: see the guide. Not for real well design.</small></div>`;
 document.body.appendChild(d);await build(d.querySelector('canvas'));
 $('#woX').onclick=close;$('#woJob').onchange=e=>{R.play=false;setJob(e.target.value)};
 $('#woPlay').onclick=()=>{if(R.last?.done)R.t=0;R.play=true;if(R.hold&&checksDone(R.last.i)){step()}};
 $('#woPause').onclick=()=>{R.play=false};$('#woStop').onclick=()=>{R.play=false;R.hold=false;R.t=0;R.ticks={};R.lastI=-1;tick(0,true)};
 $('#woStep').onclick=step;$('#woSm').onchange=e=>{R.stepMode=e.target.checked;if(!R.stepMode)R.hold=false};$('#woSpd').onchange=e=>R.speed=+e.target.value;
 d.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{R.view=b.dataset.v;d.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('on',x==b));
  if(R.view=='surf'){ctl.target.set(0,6,0);cam.position.set(26,18,34)}if(R.view=='well'){ctl.target.set(0,-26,0);cam.position.set(60,-10,70)}});
 addEventListener('keydown',key,true);setJob(jobKey);lastT=0;R.raf=requestAnimationFrame(loop);R.clk=setInterval(clock,100);window.dwWO=api();return api()}
function step(){const s=R.last;if(R.hold){if(!checksDone(s.i))return;R.hold=false;const nx=Math.min(s.i+1,R.TL.steps.length-1);R.lastI=nx;R.t=R.TL.steps[nx].t0+1e-6;R.play=true;tick(0,true);return}
 if(!R.stepMode){R.stepMode=true;$('#woSm').checked=true}R.lastI=s.i;R.play=true}
function key(e){if(!R.el||/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName))return;if(e.key=='Escape'){close();e.stopPropagation()}else if(e.key==' '){R.play=!R.play;e.preventDefault()}else if(e.key=='n'||e.key=='N')step()}
export function close(){if(!R.el)return;cancelAnimationFrame(R.raf);clearInterval(R.clk);removeEventListener('keydown',key,true);removeEventListener('resize',fit);try{ren.dispose()}catch(e){}R.el.remove();document.getElementById('woCss')?.remove();R.el=null;ren=null}
function api(){return {R,E,open,close,setJob,seek,step,tick:t=>{R.t=t;tick(0,true)},tickAll:()=>{for(const st of R.TL.steps)st.chk?.forEach((_,j)=>R.ticks[R.TL.steps.indexOf(st)+':'+j]=true);tick(0,true)},get last(){return R.last}}}
if(typeof location!='undefined'){const q=new URLSearchParams(location.search);if(q.has('workover'))open(q.get('workover')||'workover')}
