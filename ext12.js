// ext12.js v5.4: Workshop — (1) exploded view of ANY rig / downhole equipment with labelled parts + tap-for-description + Reassemble,
// (2) BHA builder (component library, presets, add/remove/reorder, metric length/OD/ID/weight, 3D in the wellbore).
// Own viewer canvas sits ABOVE the control sheet, so the sheet never covers the model (iPhone). Sheet is collapsible.
// HONESTY: every part list / dimension / weight here is a generic SIM library value, NOT from the live feed. Labelled SIM everywhere.
let THREE,C,OC;const $=id=>document.getElementById(id);const es=t=>String(t??'').replace(/&/g,'&amp;').replace(/</g,'&lt;');
// ---------- exploded-view catalogue: [name, shape, size, pos, explodeDir, colour, description] ----------
// box size [w,h,d]; cyl size [r,h] (axis = y). Units: metres (approximate, generic).
const P=(n,s,sz,p,d,c,ds)=>({n,s,sz,p,d,c,ds});
export const CAT={
 topdrive:{label:'Top drive',keys:/top ?drive|^td/i,parts:[
  P('Guide dolly / frame','box',[1.6,3.2,0.3],[0,1.6,-0.7],[0,0,-1.6],'#8a6d1f','Rides the guide rails on the mast and takes the reactive drilling torque so the top drive cannot spin.'),
  P('AC drive motor','cyl',[0.45,1.2],[0,3.0,0],[0,1.6,0],'#2b5f8a','Electric (or hydraulic) motor that turns the main shaft — typically 800–1,500 hp.'),
  P('Gearbox','box',[1.3,0.8,1.1],[0,2.1,0],[1.6,0.4,0],'#5d6670','Reduces motor speed and multiplies torque to the main shaft (rotary speed up to ~250 rpm).'),
  P('Gooseneck / washpipe','cyl',[0.12,0.8],[0.45,3.4,0],[1.4,1.6,0.6],'#c0c4c8','Brings drilling mud from the standpipe and rotary hose into the rotating main shaft through the washpipe packing.'),
  P('Main shaft','cyl',[0.12,1.6],[0,1.0,0],[0,-0.3,1.4],'#a9adb2','Hollow shaft that carries mud and transmits torque to the drill string.'),
  P('IBOP valves (upper/lower)','cyl',[0.14,0.6],[0,0.1,0],[0,-1.0,1.8],'#c1272d','Internal blowout preventer valves: close the bore to stop flow back up the string during a kick.'),
  P('Pipe handler & link tilt','box',[1.0,0.5,0.8],[0,-0.3,0],[-1.6,-0.6,0],'#d38b1a','Rotating head with link tilt and back-up wrench (grabber) used to make up / break out connections.'),
  P('Bails & elevator','box',[0.9,0.25,0.4],[0,-1.4,0],[0,-2.2,0],'#e0b020','Bails (links) hang the elevator that latches the tool joint to lift / lower pipe.')]},
 drawworks:{label:'Drawworks',keys:/drawworks|dw/i,parts:[
  P('Skid / base frame','box',[5,0.4,2.4],[0,0.2,0],[0,-1.2,0],'#3b3f45','Structural skid that carries all drawworks components.'),
  P('Drum (grooved)','cyl',[0.65,2.0],[0,1.3,0],[0,1.6,0],'#b08a2e','Lebus-grooved drum that spools the fast line of the drilling line to raise and lower the travelling block.'),
  P('Main AC motor A','cyl',[0.45,1.0],[-2.0,1.0,0],[-1.8,0,0],'#2b5f8a','Electric motor driving the drum through the gearbox.'),
  P('Main AC motor B','cyl',[0.45,1.0],[2.0,1.0,0],[1.8,0,0],'#2b5f8a','Second drive motor; also provides regenerative (dynamic) braking.'),
  P('Gearbox / chain case','box',[0.8,1.4,1.8],[-1.1,1.1,0],[-0.6,0.6,-1.8],'#5d6670','Speed reduction between the motors and the drum.'),
  P('Disc brake callipers','box',[0.5,1.2,1.6],[1.1,1.2,0],[0.6,0.6,1.8],'#c1272d','Parking/emergency brake that holds the drum (hookload) when stopped.'),
  P('Crown saver / encoder','box',[0.3,0.3,0.3],[0,2.2,1.0],[0,1.6,1.4],'#d38b1a','Drum encoder for block position; the crown saver stops the block before it hits the crown.')]},
 mudpump:{label:'Mud pump (triplex)',keys:/pump/i,parts:[
  P('Power-end frame','box',[2.4,1.4,2.0],[-0.6,0.9,0],[-1.6,0,0],'#2f6f3f','Cast/welded housing for the crankshaft, connecting rods and crossheads.'),
  P('Crankshaft & con-rods','cyl',[0.3,1.8],[-0.6,0.9,0],[0,1.8,0],'#a9adb2','Converts rotation into the reciprocating stroke of the three pistons.'),
  P('Liners & pistons ×3','box',[1.0,0.5,1.4],[1.0,0.9,0],[0.9,0.9,0],'#d8d8d8','Replaceable wear parts; liner size sets the output per stroke (and max pressure).'),
  P('Fluid end (modules)','box',[0.8,1.0,1.6],[1.8,0.9,0],[2.0,0,0],'#c1272d','Valves and seats that move mud from suction to discharge at high pressure.'),
  P('Suction manifold','cyl',[0.18,1.8],[1.8,0.2,0],[1.4,-1.2,0],'#5d6670','Feeds mud from the charge (centrifugal) pump into the fluid end.'),
  P('Pulsation dampener','cyl',[0.3,0.6],[1.8,1.9,0],[1.2,1.6,0],'#e0b020','Nitrogen-charged bladder that smooths pressure pulses on the discharge side.'),
  P('Drive motor','box',[1.2,1.0,1.0],[-0.6,0.9,-1.6],[0,0,-2.0],'#2b5f8a','Electric motor driving the pump via belts or pinion gear.')]},
 bop:{label:'BOP stack',keys:/bop|preventer/i,parts:[
  P('Annular preventer','cyl',[0.7,1.0],[0,4.2,0],[0,2.4,0],'#c1272d','Rubber packing element that closes around any pipe size (or open hole).'),
  P('Upper pipe rams','box',[2.2,0.6,0.9],[0,3.3,0],[1.6,1.4,0],'#2a4d8f','Rams with cut-outs that seal around a specific pipe OD.'),
  P('Blind / shear rams','box',[2.4,0.7,0.9],[0,2.6,0],[-1.6,0.7,0],'#a33','Shear the pipe and seal the open hole in an emergency.'),
  P('Drilling spool + choke/kill','box',[1.8,0.6,0.8],[0,1.9,0],[0,0,1.8],'#5d6670','Outlets for the choke line and kill line used to circulate out a kick.'),
  P('Lower pipe rams','box',[2.2,0.6,0.9],[0,1.2,0],[1.6,-0.7,0],'#2a4d8f','Back-up pipe rams below the spool.'),
  P('Wellhead / casing head','cyl',[0.5,0.8],[0,0.4,0],[0,-1.8,0],'#8a8f96','Connects the stack to the casing and hangs the casing strings.')]},
 swivel:{label:'Swivel (kelly)',keys:/swivel|kelly/i,parts:[
  P('Bail','box',[1.0,0.12,0.12],[0,2.0,0],[0,1.4,0],'#e0b020','Hangs the swivel from the hook of the travelling block.'),
  P('Gooseneck','cyl',[0.1,0.6],[0.3,1.6,0],[1.4,0.8,0],'#c0c4c8','Connects the rotary hose; mud enters here.'),
  P('Washpipe & packing','cyl',[0.08,0.4],[0,1.3,0],[0,0.6,1.4],'#d8d8d8','Seals between the stationary gooseneck and the rotating stem; a common wear item.'),
  P('Housing','cyl',[0.4,0.8],[0,0.8,0],[-1.4,0,0],'#5d6670','Non-rotating body that holds the bearings and oil bath.'),
  P('Main thrust bearing','cyl',[0.32,0.15],[0,0.5,0],[1.4,-0.3,0],'#a9adb2','Carries the full string weight while allowing rotation.'),
  P('Rotating stem','cyl',[0.08,0.8],[0,0.0,0],[0,-1.2,0],'#8a8f96','Turns with the kelly and passes mud down into the string.')]},
 block:{label:'Crown & travelling block',keys:/block|crown|hook/i,parts:[
  P('Crown block sheaves','cyl',[0.6,0.9],[0,3.4,0],[0,1.6,0],'#b08a2e','Fixed sheaves at the top of the mast that the drilling line reeves over.'),
  P('Drilling line (reeving)','box',[0.08,2.2,0.6],[0,2.2,0],[1.4,0,0],'#ccc','Wire rope, typically 8–12 lines strung, from drawworks to deadline anchor.'),
  P('Travelling block sheaves','cyl',[0.5,0.8],[0,1.0,0],[0,-0.6,0],'#d38b1a','Moving sheaves that give the mechanical advantage.'),
  P('Hook','box',[0.4,0.6,0.3],[0,0.2,0],[0,-1.6,0],'#e0b020','Carries the swivel or top-drive load.')]},
 pdcbit:{label:'PDC bit',keys:/pdc|^bit/i,parts:[
  P('Bit body + blades','cyl',[0.11,0.25],[0,0.15,0],[0,0,0],'#555c66','Steel or matrix body; blades hold the cutters.'),
  P('PDC cutters','cyl',[0.12,0.04],[0,0.02,0],[0,-0.35,0],'#e8e8e8','Polycrystalline-diamond compacts that shear the rock.'),
  P('Nozzles','cyl',[0.03,0.05],[0.05,0.08,0.05],[0.35,-0.15,0.2],'#c1272d','Jets that clean the cutters and lift cuttings; TFA sets bit hydraulics.'),
  P('Gauge pads','box',[0.25,0.08,0.03],[0,0.2,0.11],[0,0,0.35],'#8a8f96','Hold hole diameter and stabilise the bit.'),
  P('Shank / API pin','cyl',[0.06,0.15],[0,0.35,0],[0,0.35,0],'#a9adb2','Threaded connection to the motor or BHA.')]},
 tricone:{label:'Tricone bit',keys:/tricone|roller/i,parts:[
  P('Cone 1','cyl',[0.06,0.1],[0.05,0.05,0],[0.3,-0.2,0],'#8a6d1f','Roller cone with milled teeth or TCI inserts that crush the rock.'),
  P('Cone 2','cyl',[0.06,0.1],[-0.03,0.05,0.04],[-0.2,-0.2,0.25],'#8a6d1f','Second roller cone.'),
  P('Cone 3','cyl',[0.06,0.1],[-0.03,0.05,-0.04],[-0.2,-0.2,-0.25],'#8a6d1f','Third roller cone.'),
  P('Journal bearings & seals','cyl',[0.03,0.08],[0,0.12,0],[0.35,0.1,0],'#d8d8d8','Sealed journal or roller bearings that the cones turn on.'),
  P('Legs + nozzles','cyl',[0.1,0.15],[0,0.2,0],[0,0,0],'#5d6670','Three legs welded into the body; nozzles between them.'),
  P('Shank / API pin','cyl',[0.06,0.15],[0,0.35,0],[0,0.35,0],'#a9adb2','Threaded connection to the BHA.')]},
 motor:{label:'Mud motor (PDM)',keys:/motor/i,parts:[
  P('Top sub / dump valve','cyl',[0.09,0.6],[0,7.6,0],[0,1.4,0],'#5d6670','Lets mud fill/drain the string when tripping with pumps off.'),
  P('Power section stator','cyl',[0.1,4.0],[0,5.2,0],[0.6,0.6,0],'#2f6f3f','Elastomer-lined housing; with the rotor it turns flow into rotation (lobe ratio sets speed/torque).'),
  P('Rotor','cyl',[0.05,4.0],[0,5.2,0],[-0.6,0.6,0],'#c0c4c8','Helical steel rotor driven by mud flow.'),
  P('Transmission (CV shaft)','cyl',[0.06,1.0],[0,2.7,0],[0.6,0,0],'#a9adb2','Converts the rotor’s eccentric motion into concentric rotation.'),
  P('Bent housing (0–3°)','cyl',[0.09,0.8],[0,1.8,0],[-0.6,0,0],'#d38b1a','Adjustable bend that points the bit — slide to build/turn, rotate to drill straight.'),
  P('Bearing section','cyl',[0.09,1.2],[0,0.9,0],[0.6,-0.4,0],'#2b5f8a','Carries on/off-bottom thrust and radial loads.'),
  P('Drive shaft / bit box','cyl',[0.08,0.3],[0,0.15,0],[0,-1.2,0],'#8a8f96','Rotating output shaft; the bit screws into the bit box.')]},
 mwd:{label:'MWD / LWD tool',keys:/mwd|lwd/i,parts:[
  P('Non-magnetic collar','cyl',[0.1,9.0],[0,4.5,0],[1.0,0,0],'#a9adb2','Monel collar that houses the tool so the magnetometers are not disturbed.'),
  P('Mud pulser','cyl',[0.05,1.2],[0,8.2,0],[-0.6,1.0,0],'#c1272d','Valve that sends data to surface as pressure pulses in the mud.'),
  P('Turbine / batteries','cyl',[0.04,1.6],[0,6.6,0],[-0.6,0.4,0],'#e0b020','Power supply for the tool string.'),
  P('Directional module','cyl',[0.04,1.2],[0,5.0,0],[-0.6,0,0],'#2b5f8a','Accelerometers + magnetometers: inclination, azimuth, toolface.'),
  P('Gamma module (4-quadrant)','cyl',[0.04,1.0],[0,3.6,0],[-0.6,-0.4,0],'#2f6f3f','Gamma-ray detectors; azimuthal (up/down/left/right) versions image bed boundaries.'),
  P('Electronics / memory','cyl',[0.04,1.0],[0,2.3,0],[-0.6,-0.8,0],'#5d6670','Processing, memory and telemetry control.')]},
 rss:{label:'Rotary steerable (RSS)',keys:/rss|steerable/i,parts:[
  P('Control unit','cyl',[0.08,2.0],[0,3.0,0],[0,1.2,0],'#2b5f8a','Sensors and electronics that hold the commanded toolface / inclination.'),
  P('Bias unit','cyl',[0.1,1.2],[0,1.2,0],[0.7,0,0],'#5d6670','Push-the-bit pads or point-the-bit mechanism that steers while rotating.'),
  P('Steering pads ×3','box',[0.05,0.4,0.12],[0.11,1.2,0],[1.2,0,0],'#c1272d','Hydraulically actuated pads that push against the borehole wall.'),
  P('Bit box','cyl',[0.08,0.3],[0,0.15,0],[0,-1.0,0],'#8a8f96','Connection to the bit.')]},
 jar:{label:'Drilling jar',keys:/jar/i,parts:[
  P('Upper sub','cyl',[0.08,0.6],[0,5.5,0],[0,1.2,0],'#8a8f96','Top connection.'),
  P('Mandrel','cyl',[0.05,4.0],[0,3.0,0],[0.6,0,0],'#c0c4c8','Slides inside the housing to deliver the impact.'),
  P('Hydraulic chamber / metering','cyl',[0.09,1.6],[0,3.6,0],[-0.6,0,0],'#2b5f8a','Delays the release so overpull can build before firing.'),
  P('Latch / hammer & anvil','cyl',[0.09,0.6],[0,2.0,0],[-0.6,-0.4,0],'#c1272d','Hammer strikes the anvil to free stuck pipe (up or down).'),
  P('Housing','cyl',[0.1,2.0],[0,1.0,0],[0,-1.2,0],'#5d6670','Outer barrel.')]}
};
// ---------- BHA library (generic SIM values, metric) ----------
// type, name, len m, OD mm, ID mm, kg/m (null → steel tube estimate), colour
const L=(k,n,len,od,id,kgm,c,ds)=>({k,n,len,od,id,kgm,c,ds});
export const LIB=[
 L('pdc','PDC bit 8½in (216 mm)',0.35,216,0,null,'#555c66','Fixed-cutter bit: shears rock, long runs.'),
 L('tricone','Tricone bit 8½in TCI',0.30,216,0,null,'#8a6d1f','Roller-cone bit: crushes rock, good for hard/broken formations.'),
 L('motor','Mud motor 6¾in 1.5° AKO',8.5,172,0,190,'#2f6f3f','Positive-displacement motor; bent housing for sliding.'),
 L('rss','RSS 6¾in push-the-bit',4.2,172,70,175,'#2b5f8a','Steers while rotating.'),
 L('mwd','MWD (pulser, dir, gamma) 6¾in',9.0,172,82,140,'#c1272d','Directional surveys + gamma, mud-pulse telemetry.'),
 L('lwd','LWD resistivity / azi-gamma 6¾in',7.5,172,82,150,'#a33','Formation evaluation while drilling.'),
 L('nmdc','Non-mag drill collar 6¾in',9.1,172,71,145,'#a9adb2','Monel collar spacing the MWD from magnetic steel.'),
 L('nbstab','Near-bit stabiliser 8⅜in',1.8,213,71,null,'#d38b1a','Blade OD close to hole size; controls bit side force.'),
 L('stab','String stabiliser 8⅜in',1.8,213,71,null,'#e0b020','Centralises the BHA above the bit.'),
 L('dc','Drill collar 6½in',9.1,165,71,140,'#6d737a','Heavy steel collar: puts weight on bit, stiffens BHA.'),
 L('hwdp','HWDP 5in',9.3,127,76,74,'#8a8f96','Heavy-weight drill pipe: transition between collars and drill pipe.'),
 L('jar','Hydraulic drilling jar 6½in',9.8,165,70,135,'#7a3b14','Delivers impacts to free stuck pipe.'),
 L('xo','Crossover sub',0.9,165,71,null,'#999','Changes thread type/size between components.'),
 L('float','Float sub',0.8,172,71,null,'#bbb','Non-return valve: stops back-flow up the string.')];
const byK=k=>LIB.find(x=>x.k==k);
export const PRESETS={
 slick:{label:'Vertical / slick',items:['tricone','float','dc','dc','dc','dc','dc','dc','xo','hwdp','jar','hwdp','hwdp']},
 pendulum:{label:'Packed pendulum',items:['pdc','dc','stab','dc','stab','dc','stab','dc','dc','jar','dc','xo','hwdp','hwdp']},
 motorbuild:{label:'Motor build',items:['pdc','motor','float','stab','nmdc','mwd','nmdc','xo','hwdp','hwdp','jar','hwdp','hwdp']},
 rsslat:{label:'RSS lateral',items:['pdc','rss','lwd','mwd','float','nmdc','xo','hwdp','hwdp','hwdp','jar','hwdp']}};
export function itemFrom(k){const b=byK(k);return b?{...b,src:'SIM'}:null}
export function kgOf(it){if(it.kgm)return it.kgm*it.len;const od=it.od/1000,id=it.id/1000;return Math.PI/4*(od*od-id*id)*it.len*7850}
export function totals(list){let len=0,kg=0,maxOD=0,minID=1e9;for(const it of list){len+=+it.len;kg+=kgOf(it);maxOD=Math.max(maxOD,+it.od);if(+it.id>0)minID=Math.min(minID,+it.id)}return {len,kg,kN:kg*9.80665/1000,maxOD,minID:minID>1e8?0:minID,n:list.length}}
// ---------- state ----------
const ST={mode:'exp',eq:'topdrive',t:0,target:0,sel:-1,bha:[],holeMM:216,coll:false,open:false,meshes:[],labels:[],radX:40};if(typeof window!='undefined')window.WS=ST;
function loadBha(){try{const s=JSON.parse(localStorage.getItem('dw-bha')||'null');if(Array.isArray(s)&&s.length){ST.bha=s.map(x=>({...x,src:'SIM'}));return}}catch(e){}preset('motorbuild',true)}
function saveBha(){try{localStorage.setItem('dw-bha',JSON.stringify(ST.bha))}catch(e){}}
export function preset(k,quiet){ST.bha=PRESETS[k].items.map(itemFrom);ST.preset=k;saveBha();if(!quiet)refresh()}
// ---------- viewer ----------
let ren,scene,cam,ctl,root,raf=0,canvas;
function css(){const s=document.createElement('style');s.textContent=`
#wshop{position:absolute;inset:0;z-index:60;background:#0b1015;display:none;color:#e8eef4;font:13px system-ui,sans-serif}
#wsView{position:absolute;left:0;right:0;top:0;bottom:var(--wsH,46%)}
#wsView canvas{width:100%!important;height:100%!important;display:block;touch-action:none}
#wsLbl{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.wsl{position:absolute;transform:translate(-50%,-50%);background:#0a121ad9;border:1px solid #5a7;color:#dfe;padding:2px 6px;border-radius:9px;font-size:11px;white-space:nowrap;pointer-events:auto;cursor:pointer}
.wsl.R,.wsl.L{font-size:10px;padding:1px 5px}.wsl.on{background:#2a6f97;border-color:#7cf;color:#fff}
#wsTop{position:absolute;top:calc(6px + env(safe-area-inset-top));left:6px;right:6px;display:flex;gap:6px;align-items:center;z-index:2}
#wsTop button{background:#1b2430;color:#dde;border:1px solid #456;border-radius:16px;padding:6px 12px;min-height:36px;font-size:14px}
#wsTop button.on{background:#2a6f97;border-color:#7cf}
.wsSim{background:#b8860b;color:#000;font-weight:700;padding:2px 7px;border-radius:4px;font-size:11px}
#wsInfo{position:absolute;left:8px;right:8px;bottom:calc(var(--wsH,46%) + 8px);background:#101820f0;border:1px solid #7cf;border-radius:8px;padding:8px 10px;display:none;z-index:2;font-size:13px}
#wsSheet{position:absolute;left:0;right:0;bottom:0;height:var(--wsH,46%);background:#101820;border-top:1px solid #5a7;border-radius:14px 14px 0 0;box-sizing:border-box;padding:4px 10px calc(10px + env(safe-area-inset-bottom));overflow:auto;-webkit-overflow-scrolling:touch}
#wsGrip{display:block;margin:0 auto 4px;width:100%;background:none;border:0;color:#9ab;font-size:12px;min-height:30px}
#wsSheet button,#wsSheet select{background:#1b2430;color:#dde;border:1px solid #456;border-radius:6px;padding:4px 8px;min-height:36px;font-size:15px}
#wsSheet input{width:44px;font-size:15px;background:#0b1218;color:#dde;border:1px solid #456;border-radius:4px}
#wsSheet table{width:100%;border-collapse:collapse;font-size:12px}#wsSheet td,#wsSheet th{padding:2px 3px;border-bottom:1px solid #223;text-align:right}#wsSheet td:nth-child(2),#wsSheet th:nth-child(2){text-align:left}
#wsSheet .rb{min-height:32px;min-width:30px;padding:0 4px;font-size:14px}
#wsSheet .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0}
@media (min-width:900px){#wsView{right:420px;bottom:0}#wsSheet{left:auto;width:420px;top:0;height:auto;border-radius:0}#wsInfo{right:430px;bottom:8px}}`;document.head.appendChild(s)}
function build(){const d=document.createElement('div');d.id='wshop';d.innerHTML=`<div id="wsView"><div id="wsLbl"></div></div>
<div id="wsTop"><button id="wsExp">🔩 Exploded</button><button id="wsBha">🧰 BHA</button><span class="wsSim">SIM</span><span style="flex:1"></span><button id="wsClose">✕ Close</button></div>
<div id="wsInfo"></div><div id="wsSheet"><button id="wsGrip">▾ hide panel</button><div id="wsBody"></div></div>`;document.body.appendChild(d);
 canvas=document.createElement('canvas');$('wsView').prepend(canvas);
 ren=new THREE.WebGLRenderer({canvas,antialias:true});ren.setPixelRatio(Math.min(devicePixelRatio,2));scene=new THREE.Scene();scene.background=new THREE.Color('#141c24');
 cam=new THREE.PerspectiveCamera(40,1,0.01,2000);scene.add(new THREE.HemisphereLight('#dde','#223',1.1));const dl=new THREE.DirectionalLight('#fff',1.2);dl.position.set(4,8,6);scene.add(dl);
 ctl=new OC(cam,canvas);ctl.enableDamping=true;root=new THREE.Group();scene.add(root);
 $('wsExp').onclick=()=>setMode('exp');$('wsBha').onclick=()=>setMode('bha');$('wsClose').onclick=close;$('wsGrip').onclick=()=>{ST.coll=!ST.coll;layout()};
 let dn=null;canvas.addEventListener('pointerdown',e=>dn=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{if(dn&&Math.hypot(e.clientX-dn[0],e.clientY-dn[1])<8)pick(e);dn=null});
 addEventListener('resize',()=>{if(ST.open)layout()})}
function layout(){const ph=innerWidth<900;$('wshop').style.setProperty('--wsH',ph?(ST.coll?'64px':'46%'):'0px');$('wsGrip').textContent=ST.coll?'▴ show panel':'▾ hide panel';$('wsBody').style.display=ST.coll?'none':'';
 if(!ph)$('wshop').style.removeProperty('--wsH');const v=$('wsView').getBoundingClientRect();ren.setSize(v.width,v.height,false);cam.aspect=v.width/Math.max(1,v.height);cam.updateProjectionMatrix();frame(true)}
function mk(s,sz,c){const g=s=='box'?new THREE.BoxGeometry(...sz):new THREE.CylinderGeometry(sz[0],sz[0],sz[1],28);return new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c,metalness:0.35,roughness:0.55}))}
function clear(){for(const m of [...root.children]){root.remove(m);m.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.()})}ST.meshes=[];$('wsLbl').innerHTML='';ST.labels=[]}
function addLabel(txt,i,cls){const e=document.createElement('div');e.className='wsl'+(cls?' '+cls:'');e.textContent=txt;e.dataset.i=i;e.onclick=ev=>{ev.stopPropagation();showPart(i)};$('wsLbl').appendChild(e);ST.labels.push(e);return e}
function eqScale(){const ps=CAT[ST.eq].parts;let m=0;for(const p of ps)m=Math.max(m,Math.abs(p.p[1])+(p.s=='box'?p.sz[1]:p.sz[1]));return m}
function buildExp(){clear();const E=CAT[ST.eq];const big=eqScale()>4;
 E.parts.forEach((p,i)=>{const m=mk(p.s,p.sz,p.c);m.userData.i=i;m.userData.p=p;root.add(m);ST.meshes.push(m);addLabel(p.n,i)});
 ST.dirK=big?1.8:(eqScale()<1?0.5:1);place();fit()}
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function place(){const k=ease(ST.t)*ST.dirK;for(const m of ST.meshes){const p=m.userData.p;m.position.set(p.p[0]+p.d[0]*k,p.p[1]+p.d[1]*k,p.p[2]+p.d[2]*k)}}
function fit(){const b=new THREE.Box3();if(ST.mode=='exp'){const t0=ST.t;ST.t=1;place();b.setFromObject(root);ST.t=t0;place()}else b.setFromObject(root);
 const c=b.getCenter(new THREE.Vector3()),sz=b.getSize(new THREE.Vector3());const fov=cam.fov*Math.PI/180;const hf=Math.max(sz.y/2,sz.x/2/Math.max(.3,cam.aspect),sz.z/2/Math.max(.3,cam.aspect))*1.08;const dist=hf/Math.tan(fov/2)+Math.max(sz.x,sz.z)*0.3;
 const dir=ST.mode=='exp'?new THREE.Vector3(0.55,0.35,1).normalize():new THREE.Vector3(0,0.15,1).normalize();cam.position.copy(c).addScaledVector(dir,dist);cam.near=dist/100;cam.far=dist*20;cam.updateProjectionMatrix();ctl.target.copy(c);ctl.update()}
function frame(force){if(!ST.open)return;const now=performance.now(),dt=Math.min(0.2,(now-(ST.last||now))/1000);ST.last=now;if(ST.mode=='exp'&&ST.t!==ST.target){const st=dt/0.9;ST.t+=Math.sign(ST.target-ST.t)*st;if(Math.abs(ST.t-ST.target)<=st)ST.t=ST.target;place()}
 ctl.update();ren.render(scene,cam);const v=$('wsView').getBoundingClientRect(),q=new THREE.Vector3();
 ST.labels.forEach((e,i)=>{const m=ST.meshes[+e.dataset.i];if(!m)return;m.getWorldPosition(q);if(ST.mode=='bha')q.x+=0;q.project(cam);const vis=q.z<1&&Math.abs(q.x)<1.05&&Math.abs(q.y)<1.05&&(ST.mode=='bha'||ST.t>0.6||e.classList.contains('on'));
  e.style.display=vis?'':'none';e.style.left=((q.x+1)/2*v.width+(ST.mode=='bha'?(e.classList.contains('R')?1:-1)*(e.offsetWidth/2+28):0))+'px';e.style.top=((1-q.y)/2*v.height+(ST.mode=='exp'?(i%2?10:-10):0))+'px'});
 if(!force)raf=requestAnimationFrame(()=>frame())}
function pick(e){const r=canvas.getBoundingClientRect(),rc=new THREE.Raycaster();rc.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),cam);const h=rc.intersectObjects(ST.meshes,false)[0];if(h)showPart(h.object.userData.i);else{$('wsInfo').style.display='none';hi(-1)}}
function hi(i){ST.sel=i;ST.meshes.forEach((m,j)=>m.material.emissive?.set(j==i?'#335577':'#000'));ST.labels.forEach(e=>e.classList.toggle('on',+e.dataset.i==i))}
export function showPart(i){hi(i);const box=$('wsInfo');let h;
 if(ST.mode=='exp'){const p=CAT[ST.eq].parts[i];h=`<b>${es(p.n)}</b> <span class="wsSim">SIM</span><br>${es(p.ds)}`}else{const it=ST.bha[i];h=`<b>${i+1}. ${es(it.n)}</b> <span class="wsSim">SIM</span><br>${es(it.ds)}<br>L ${(+it.len).toFixed(2)} m · OD ${it.od} mm · ID ${it.id||'—'} mm · ${kgOf(it).toFixed(0)} kg`}
 box.innerHTML=h+'<div style="text-align:right"><button id="wsInfoX" style="background:#1b2430;color:#dde;border:1px solid #456;border-radius:6px;min-height:32px">OK</button></div>';box.style.display='block';$('wsInfoX').onclick=()=>{box.style.display='none';hi(-1)};ST.info=h}
// ---------- BHA 3D ----------
function buildBha(){clear();const hole=ST.holeMM/1000,X=ST.radX;let y=0;const T=totals(ST.bha);
 const wall=new THREE.Mesh(new THREE.CylinderGeometry(hole/2*X,hole/2*X,T.len+6,32,1,true),new THREE.MeshStandardMaterial({color:'#7a6040',transparent:true,opacity:0.18,side:THREE.DoubleSide,depthWrite:false}));wall.position.y=(T.len+6)/2-1;root.add(wall);
 const rock=new THREE.Mesh(new THREE.CylinderGeometry(hole/2*X*1.02,hole/2*X*1.02,0.6,32),new THREE.MeshStandardMaterial({color:'#5a4630'}));rock.position.y=-1.3;root.add(rock);
 ST.bha.forEach((it,i)=>{const r=it.od/2000*X,len=+it.len;const isBit=/bit/i.test(it.n);const g=isBit?new THREE.CylinderGeometry(r*0.55,r,len,28):new THREE.CylinderGeometry(r,r,len,28);
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:it.c,metalness:0.4,roughness:0.5}));m.position.y=y+len/2;m.userData.i=i;root.add(m);ST.meshes.push(m);
  if(/stab/.test(it.k)){for(let b=0;b<3;b++){const bl=new THREE.Mesh(new THREE.BoxGeometry(0.4*X/15,len*0.6,0.03*X),m.material);bl.position.set(0,y+len/2,0);bl.rotation.y=b*2.094;bl.translateX(r*0.85);m.parent.add(bl)}}
  if(it.k=='motor'){m.rotation.z=0.0}
  y+=len;addLabel((i+1)+'. '+it.n.split(' ').slice(0,2).join(' '),i,i%2?'R':'L')});
 // labels only every Nth if crowded
 const n=ST.labels.length;ST.labels.forEach((e,i)=>{if(n>14&&i%2)e.classList.add('dim')});
 root.position.set(0,0,0);root.updateMatrixWorld(true);fit()}
// ---------- UI ----------
function setMode(m){ST.mode=m;$('wsExp').classList.toggle('on',m=='exp');$('wsBha').classList.toggle('on',m=='bha');$('wsInfo').style.display='none';ST.sel=-1;root.rotation.set(0,0,0);refresh()}
function refresh(){if(!ST.open)return;if(ST.mode=='exp')uiExp();else uiBha();layout()}
function uiExp(){const E=CAT[ST.eq];$('wsBody').innerHTML=`<div class="row"><b>Exploded view</b><span class="wsSim">SIM generic model — not this rig's drawings</span></div>
<div class="row"><select id="wsEq">${Object.entries(CAT).map(([k,v])=>`<option value="${k}"${k==ST.eq?' selected':''}>${es(v.label)}</option>`).join('')}</select>
<button id="wsGo">💥 Explode</button><button id="wsRe">🔧 Reassemble</button></div>
<div style="color:#9ab;font-size:12px">Tap a part or its label for a description. Drag to orbit, pinch to zoom.</div>
<div class="row" id="wsParts">${E.parts.map((p,i)=>`<button class="rb" data-i="${i}" style="font-size:13px">${es(p.n)}</button>`).join('')}</div>`;
 $('wsEq').onchange=e=>{ST.eq=e.target.value;ST.t=0;ST.target=1;buildExp();uiExp();layout()};$('wsGo').onclick=()=>explode();$('wsRe').onclick=()=>reassemble();
 $('wsParts').querySelectorAll('button').forEach(b=>b.onclick=()=>showPart(+b.dataset.i));if(!ST.meshes.length||ST.built!='exp:'+ST.eq){buildExp();ST.built='exp:'+ST.eq}}
export function explode(){ST.target=1}export function reassemble(){ST.target=0;$('wsInfo').style.display='none';hi(-1)}
function uiBha(){const T=totals(ST.bha);$('wsBody').innerHTML=`<div class="row"><b>BHA builder</b><span class="wsSim">SIM — library values, not from live feed</span></div>
<div class="row">Preset <select id="wsPre"><option value="">—</option>${Object.entries(PRESETS).map(([k,v])=>`<option value="${k}"${k==ST.preset?' selected':''}>${v.label}</option>`).join('')}</select>
Hole <input id="wsHole" type="number" value="${ST.holeMM}"> mm</div>
<div class="row"><select id="wsAddK">${LIB.map(x=>`<option value="${x.k}">${es(x.n)}</option>`).join('')}</select><button id="wsAdd">＋ Add above bit…</button></div>
<div id="wsTot" style="background:#0b1218;border:1px solid #345;border-radius:6px;padding:5px 7px;margin:4px 0"><b>Total</b> ${T.n} items · <b>${T.len.toFixed(2)} m</b> · max OD ${T.maxOD} mm · min ID ${T.minID||'—'} mm · <b>${(T.kg/1000).toFixed(2)} t</b> (${T.kN.toFixed(1)} kN in air) <span class="wsSim">SIM</span></div>
<table><tr><th>#</th><th>Component</th><th>L m</th><th>OD mm</th><th>ID mm</th><th>kg</th><th></th></tr>
${ST.bha.map((it,i)=>`<tr data-i="${i}"><td>${i+1}</td><td>${es(it.n)} <span class="wsSim">SIM</span></td><td><input data-f="len" value="${it.len}" inputmode="decimal"></td><td><input data-f="od" value="${it.od}" inputmode="decimal"></td><td><input data-f="id" value="${it.id}" inputmode="decimal"></td><td>${kgOf(it).toFixed(0)}</td>
<td style="white-space:nowrap"><button class="rb" data-a="dn" title="toward bit">▲</button><button class="rb" data-a="up" title="away from bit">▼</button><button class="rb" data-a="rm">✕</button></td></tr>`).join('')}</table>
<div style="color:#9ab;font-size:11px;margin-top:4px">Row 1 = bit (bottom). Weight = catalogue kg/m or steel tube estimate (7,850 kg/m³). 3D: bit at the bottom, radial size ×${ST.radX} so slim tools are visible; lengths true. Tap a component for details.</div>`;
 $('wsPre').onchange=e=>{if(e.target.value){preset(e.target.value)}};$('wsHole').onchange=e=>{ST.holeMM=+e.target.value||216;buildBha()};
 $('wsAdd').onclick=()=>{addItem($('wsAddK').value)};
 $('wsBody').querySelectorAll('tr[data-i]').forEach(tr=>{const i=+tr.dataset.i;tr.querySelectorAll('button').forEach(b=>b.onclick=()=>{const a=b.dataset.a;if(a=='rm')removeItem(i);else move(i,a=='dn'?-1:1)});
  tr.querySelectorAll('input').forEach(inp=>inp.onchange=()=>{const v=parseFloat(inp.value);if(isFinite(v)&&v>=0){ST.bha[i][inp.dataset.f]=v;ST.preset='';saveBha();refresh()}});tr.children[1].onclick=()=>showPart(i)});
 buildBha()}
export function addItem(k,at){const it=itemFrom(k);if(!it)return;const bit=/bit/.test(it.n);if(bit){ST.bha=ST.bha.filter(x=>!/bit/i.test(x.n));ST.bha.unshift(it)}else ST.bha.splice(at??Math.min(1,ST.bha.length),0,it);ST.preset='';saveBha();refresh()}
export function removeItem(i){ST.bha.splice(i,1);ST.preset='';saveBha();refresh()}
export function move(i,d){const j=i+d;if(j<0||j>=ST.bha.length)return;[ST.bha[i],ST.bha[j]]=[ST.bha[j],ST.bha[i]];ST.preset='';saveBha();refresh()}
// map a selected scene entity → catalogue key
export function keyFor(name){name=String(name||'');for(const [k,v] of Object.entries(CAT))if(v.keys.test(name))return k;return null}
export function open(mode,eq){ST.open=true;$('wshop').style.display='block';if(eq&&CAT[eq])ST.eq=eq;else{const s=C.sel?.();const k=s&&keyFor(s.name);if(k)ST.eq=k}
 ST.built='';setMode(mode||ST.mode);if(ST.mode=='exp'){ST.t=0;ST.target=1}cancelAnimationFrame(raf);frame()}
export function close(){ST.open=false;$('wshop').style.display='none';cancelAnimationFrame(raf)}
export async function init(c){C=c;THREE=c.THREE;OC=(await import('./vendor/OrbitControls.js')).OrbitControls;css();build();loadBha();
 const hud=$('hud');for(const [id,t,m] of [['btnExpl','🔩 Exploded view','exp'],['btnBhaB','🧰 BHA builder','bha']]){const b=document.createElement('button');b.id=id;b.textContent=t;b.onclick=()=>open(m);hud.appendChild(b)}
 window.GX=window.GX||{};GX.ws={ST,CAT,LIB,PRESETS,open,close,explode,reassemble,showPart,addItem,removeItem,move,preset,totals,kgOf,keyFor,itemFrom}}
