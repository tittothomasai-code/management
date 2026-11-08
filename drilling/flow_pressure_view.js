import * as THREE from 'three';
import {rigCircuit, wellControlCircuit, circuitModel} from './flow_pressure_model.js';
import {ATM_PA} from './pressure_core.js';

const FLOW=0x3ce4dc, RETURN=0x73b8ff, AMBER=0xffb34a;
const N=72, SCALE=0.03, FT=0.3048;
const rate=q=>(q*60000).toFixed(0)+' L/min';
const mpa=p=>(p/1e6).toFixed(2)+' MPa';
const guard='input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],#start,#intro,#dwOperations,.dropz-host';
const $=id=>document.getElementById(id);

export function mount(game) {
  if (!game?._scene || !game.S || game.flowPressure) return game?.flowPressure;
  const root=new THREE.Group(), pipes=new THREE.Group();
  root.name='SIMULATED Flow and Pressure';root.visible=false;root.add(pipes);game._scene.add(root);
  const positions=new THREE.Float32BufferAttribute(new Float32Array(N*3),3);
  const points=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',positions),
    new THREE.PointsMaterial({color:FLOW,size:.28,depthTest:false}));
  points.frustumCulled=false;points.renderOrder=11;root.add(points);
  let flow=false,pressure=false,disposed=false,model,route,phase=0,frame=0,last=0,updated=0;
  const control=document.createElement('section');
  control.id='flowPressure';control.setAttribute('aria-label','Simulated circulation controls');
  control.innerHTML=`
    <div class="fp-buttons">
      <button type="button" data-view="flow" aria-pressed="false">F · Flow</button>
      <button type="button" data-view="pressure" aria-pressed="false">P · Pressure</button>
      <button type="button" data-view="both" aria-pressed="false">F+P</button>
    </div>
    <aside class="fp-panel" hidden>
      <header><b>Circulation circuit</b><span class="fp-sim">SIMULATED</span><button type="button" data-close aria-label="Close Flow and Pressure">×</button></header>
      <p data-status></p>
      <section data-flow><h3>Flow · down string and up annulus</h3><div class="fp-grid" data-flow-values></div>
        <p data-direction></p><details><summary>Annular sections</summary><ul data-sections></ul></details>
      </section>
      <section data-pressure><h3>Pressure · connected U-tube</h3><div class="fp-grid" data-pressure-values></div>
        <label>Profile depth <input type="range" min="0" value="0" step="1"> <span data-depth></span></label>
        <canvas aria-label="Simulated drill string and annular pressure by true vertical depth"></canvas>
        <p><span class="fp-dp">Drill string</span> · <span class="fp-ann">Annulus</span> · absolute pressure</p>
      </section>
      <button type="button" data-cutaway>Show underground</button>
      <p>Training simulation. Depth and pressure scales are illustrative in the scene.</p>
    </aside>`;
  const style=document.createElement('link');
  style.rel='stylesheet';style.href=new URL('./flow_pressure_view.css',import.meta.url);
  document.head.append(style);document.body.append(control);
  const find=s=>control.querySelector(s);
  const panel=find('.fp-panel'), slider=find('input'), canvas=find('canvas');
  let selectedDepth=0;
  slider.oninput=()=>{selectedDepth=Number(slider.value);paint()};
  find('[data-close]').onclick=()=>setViews(false,false);
  find('[data-cutaway]').onclick=()=>game.setUnder?.(true);
  for (const b of control.querySelectorAll('[data-view]')) b.onclick=()=>change(b.dataset.view);

  function obstructed() {
    return ['start','intro','dwOperations','rigBuilder','showroom','showroomB','showroomC'].some(id=>{
      const e=$(id);return e && e.getClientRects().length && getComputedStyle(e).visibility!=='hidden';
    });
  }
  function usesFeed() {
    const w=window.GX?.witsml?.WML||window.WML;
    return Boolean(w?.log || w?.liveMode || w?.connected || w?.mode==='replay');
  }
  function key(e) {
    if (e.repeat||e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||
        e.target?.closest?.(guard)||e.target?.isContentEditable||obstructed()) return;
    const k=e.key.toLowerCase();
    if(k!=='f'&&k!=='p')return;
    e.preventDefault();e.stopPropagation();change(k==='f'?'flow':'pressure');
  }
  function change(which) {
    if(which==='both')setViews(!(flow&&pressure),!(flow&&pressure));
    else setViews(which==='flow'?!flow:flow,which==='pressure'?!pressure:pressure);
  }
  function setViews(f,p) {
    flow=f;pressure=p;
    for (const b of control.querySelectorAll('[data-view]')) {
      b.setAttribute('aria-pressed',String(b.dataset.view==='flow'?f:b.dataset.view==='pressure'?p:f&&p));
    }
    panel.hidden=!(f||p);find('[data-flow]').hidden=!f;find('[data-pressure]').hidden=!p;
    if(f||p)refresh();
    else root.visible=false;
  }
  function path() {
    const raw=window.wellPts?.()||[];
    if(raw.length<2)return null;
    const line=new THREE.CatmullRomCurve3(raw.map(v=>new THREE.Vector3(...v)));
    const ratio=THREE.MathUtils.clamp((game.PH?.bitDepth(game.S)??game.S.md)/Math.max(1,game.S.md),0,1);
    return ratio>.0001?line.getSpacedPoints(56).map((_,i)=>line.getPointAt(i*ratio/56)):null;
  }
  function refresh() {
    const feed=usesFeed();
    root.visible=(flow||pressure)&&!feed&&!obstructed();
    find('[data-status]').textContent=feed?'Simulation circuit unavailable while observing a WITSML feed.':'';
    for(const e of [find('[data-flow]'),find('[data-pressure]'),find('[data-cutaway]')]) {
      e.hidden=feed||e.hasAttribute('data-flow')&&!flow||e.hasAttribute('data-pressure')&&!pressure;
    }
    find('[data-cutaway]').hidden=feed||control.dataset.docked==='true';
    if(feed||!(flow||pressure))return;
    const fluid=window.dwFlu?.st;
    const wc=fluid?.alive && ['wc','pit'].includes(fluid.tab)?fluid.wc:null;
    const well=path();
    model=circuitModel(wc?wellControlCircuit(wc):rigCircuit(game.S,fluid?.alive?fluid:null));
    draw(well);paint();
  }
  function clear() {
    for(const mesh of [...pipes.children]){
      mesh.geometry.dispose();mesh.material.dispose();pipes.remove(mesh);
    }
  }
  function tube(a,b,color,width) {
    const delta=b.clone().sub(a);
    if(delta.length()<1e-5)return;
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(width,width,delta.length(),7),
      new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:.92}));
    mesh.position.copy(a).lerp(b,.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    mesh.renderOrder=10;pipes.add(mesh);
  }
  function draw(well) {
    clear();route=null;
    if (!well) return;
    const a=[],b=[];
    for (const [i,p] of well.entries()) {
      const t=well[Math.min(i+1,well.length-1)].clone().sub(well[Math.max(0,i-1)]).normalize();
      const side=t.clone().cross(new THREE.Vector3(0,0,1));
      if (side.lengthSq()<.01) side.copy(t).cross(new THREE.Vector3(0,1,0));
      side.normalize().multiplyScalar(.27);
      a.push(p.clone().sub(side));b.push(p.clone().add(side));
    }
    const depthScale=model.w.tvd/Math.max(.01,-well.at(-1).y*FT/SCALE);
    const maximum=Math.max(1,...model.profile.rows.flatMap(r=>[r.stringGaugePa,r.annulusGaugePa]));
    const pc=(x)=>new THREE.Color().setHSL(.63-.58*THREE.MathUtils.clamp(x/maximum,0,1),.90,.55);
    for(let i=1;i<a.length;i++){
      const z=Math.max(0,-well[i].y*FT/SCALE*depthScale);
      const row=model.profile.rows[Math.min(30,Math.round(z/model.w.tvd*30))];
      tube(a[i-1],a[i],pressure?pc(row.stringGaugePa):FLOW,.073);
      tube(b[i-1],b[i],pressure?pc(row.annulusGaugePa):RETURN,.093);
    }
    tube(a.at(-1),well.at(-1),AMBER,.12);
    tube(well.at(-1),b.at(-1),AMBER,.12);
    route=new THREE.CurvePath();
    const closed=[...a,well.at(-1),...b.reverse()];
    for(let i=1;i<closed.length;i++)route.add(new THREE.LineCurve3(closed[i-1],closed[i]));
  }
  function fill(selector,values) {
    find(selector).replaceChildren(...values.map(([name,value])=>{
      const cell=document.createElement('div'),label=document.createElement('small'),v=document.createElement('strong');
      label.textContent=name;v.textContent=value;cell.append(label,v);return cell;
    }));
  }
  function paint() {
    if(!model)return;
    const {q,pumpRate,returnRate,profile,h,capacity,meanAnnularVelocity,nozzleArea,w,mode,applied}=model;
    find('[data-status]').textContent=mode;
    if(flow){
      fill('[data-flow-values]',[['Pump discharge rate',rate(pumpRate)],['Circulation through bit',rate(q)],
        ['Surface return rate',rate(returnRate)],['Annular capacity',capacity.toFixed(2)+' m³'],
        ['Mean annular velocity',meanAnnularVelocity.toFixed(2)+' m/s'],['Nozzle velocity',h.Vn.toFixed(1)+' m/s'],
        ['Total nozzle area',(nozzleArea*1e6).toFixed(0)+' mm²']]);
      find('[data-direction]').textContent=q?'Pumps → drill string ↓ → bit → annulus ↑ → returns':'Zero circulation through the U-tube';
      find('[data-sections]').replaceChildren(...model.ann.map(s=>{
        const li=document.createElement('li');li.textContent=s.n+' · '+s.from.toFixed(0)+'–'+s.to.toFixed(0)+' m MD · '+s.V.toFixed(2)+' m/s';return li;
      }));
    }
    if(pressure){
      slider.max=Math.floor(w.tvd);slider.value=Math.min(selectedDepth,w.tvd);
      const d=Number(slider.value),row=profile.rows[Math.min(30,Math.round(d/w.tvd*30))];
      find('[data-depth]').textContent=d+' m TVD';
      fill('[data-pressure-values]',[['Pump discharge / SPP · gauge',mpa(profile.pumpDischargeGaugePa)],
        ['Casing / return · gauge',mpa(applied)],['Bottom-hole annulus · gauge',mpa(profile.bottomHoleOuterAbsPa-ATM_PA)],
        ['Drill string at depth · gauge',mpa(row.stringGaugePa)],['Annulus at depth · gauge',mpa(row.annulusGaugePa)],
        ['Nozzle drop',mpa(profile.bitAcrossPa)],['Surface / string losses',mpa(h.surf)+' / '+mpa(h.string)],
        ['Annulus / tools losses',mpa(h.ann)+' / '+mpa(h.motor+h.mwd)]]);
      chart(profile.rows,w.tvd);
    }
  }
  function chart(rows,tvd){
    const width=canvas.clientWidth,height=canvas.clientHeight;
    if(!width||!height)return;
    const dpr=Math.min(2,devicePixelRatio||1);
    canvas.width=width*dpr;canvas.height=height*dpr;
    const c=canvas.getContext('2d');c.scale(dpr,dpr);
    const max=Math.max(1,...rows.flatMap(r=>[r.stringAbsPa,r.annulusAbsPa]));
    c.strokeStyle='#29445a';c.strokeRect(28,8,width-44,height-25);
    for(const [key,color] of [['stringAbsPa','#62dbf7'],['annulusAbsPa','#ffb34a']]){
      c.beginPath();c.strokeStyle=color;c.lineWidth=2;
      rows.forEach((r,i)=>{const x=28+r[key]/max*(width-44),y=8+r.depthM/tvd*(height-25);i?c.lineTo(x,y):c.moveTo(x,y)});
      c.stroke();
    }
    c.fillStyle='#a8c4d8';c.font='10px system-ui';
    c.fillText('0 m',2,15);c.fillText(tvd.toFixed(0)+' m',2,height-7);c.fillText(mpa(max)+' abs',width-78,height-5);
  }
  function tick(now) {
    if(disposed)return;
    const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
    const fluids=$('flu');
    if(fluids && control.parentElement!==fluids){
      control.dataset.docked='true';
      fluids.querySelector('.bar')?.after(control);
    }else if(!fluids && control.parentElement!==document.body){
      control.dataset.docked='false';
      document.body.append(control);
    }
    control.hidden=obstructed();
    if(flow||pressure){
      if(now-updated>400){updated=now;refresh()}
      root.visible=!control.hidden&&!usesFeed();
    }
    points.visible=Boolean(root.visible&&flow&&route&&model?.q>0);
    if(points.visible){
      phase=(phase+dt*Math.min(.8,model.q*4))%1;
      for(let i=0;i<N;i++){const v=route.getPoint((i/N+phase)%1);positions.setXYZ(i,v.x,v.y,v.z)}
      positions.needsUpdate=true;
    }
    frame=requestAnimationFrame(tick);
  }
  window.addEventListener('keydown',key,true);
  frame=requestAnimationFrame(tick);
  const api={setViews,dispose(){
    disposed=true;cancelAnimationFrame(frame);window.removeEventListener('keydown',key,true);
    clear();points.geometry.dispose();points.material.dispose();game._scene.remove(root);control.remove();style.remove();delete game.flowPressure;
  }};
  game.flowPressure=api;return api;
}
