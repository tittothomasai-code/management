// bom_data.js — generic, industry-standard bill of materials for the 12 workshop exploded views (ext12.js CAT).
// One row per modelled part, same order as CAT[key].parts (row i links to 3D part i). All values are SIM (generic typical
// values from public API / IADC references), not drawings or data from a real rig. Fields: [qty, material / spec, function].
const W={
 topdrive:[
  [1,'Welded steel frame, ASTM A572 Gr 50','Rides the mast guide rails and takes reactive torque'],
  [1,'AC induction motor, 1,150 hp, VFD driven','Turns the main shaft'],
  [1,'Helical gear set, 4140 steel, oil bath','Cuts speed and adds torque (0–250 rpm)'],
  [1,'4140 steel, 7,500 psi WP, API 8C','Brings mud into the rotating shaft'],
  [1,'4340 forged steel, 3 in bore, API 8C','Carries mud and torque to the string'],
  [2,'API 7-1 ball valves, 15,000 psi','Close the bore to stop flow up the string'],
  [1,'Steel castings, hydraulic actuators','Tilts links and grips pipe for make-up / break-out'],
  [1,'350 sh tn bails + centre-latch elevator, API 8C','Lifts and lowers pipe']],
 drawworks:[
  [1,'Welded structural steel skid','Carries all drawworks parts'],
  [1,'Lebus-grooved steel drum, 1-3/8 in line','Spools the drilling line'],
  [1,'AC motor, 1,150 hp, VFD','Main hoist drive (A)'],
  [1,'AC motor, 1,150 hp, VFD','Main hoist drive (B)'],
  [1,'Gear / chain case, oil bath, 2 speed','Sends motor torque to the drum'],
  [2,'Hydraulic disc callipers, fail-safe spring','Hold and stop the load'],
  [1,'Rotary encoder + crown-o-matic switch','Measures block height, stops block before crown']],
 mudpump:[
  [1,'Fabricated steel frame, 1,600 hp class','Holds crankshaft and bearings'],
  [1,'Forged alloy crankshaft + 3 con-rods','Changes rotation to piston stroke'],
  [3,'Bi-metal liners 6-1/2 in, urethane pistons','Push mud on each stroke'],
  [3,'Forged AISI 4130 modules, 7,500 psi','Hold suction / discharge valves and seats'],
  [1,'Carbon steel pipe, 12 in, 150 psi','Feeds mud to the modules'],
  [1,'Bladder dampener, 20 gal, N2 precharge','Smooths pressure pulses'],
  [2,'AC motor, 1,150 hp, VFD','Drives the pump']],
 bop:[
  [1,'13-5/8 in 5,000 psi annular, API 16A','Seals around any pipe or open hole'],
  [1,'13-5/8 in pipe rams, 10,000 psi, API 16A','Seal around drill pipe'],
  [1,'13-5/8 in blind/shear rams, API 16A','Cut pipe and seal the open bore'],
  [1,'Drilling spool, 3-1/16 in side outlets','Connects choke and kill lines'],
  [1,'13-5/8 in pipe rams, 10,000 psi, API 16A','Back-up seal around pipe'],
  [1,'Casing head, API 6A, 13-5/8 in flange','Base of the stack on the casing']],
 swivel:[
  [1,'Forged alloy steel bail, 500 sh tn','Hangs the swivel from the hook'],
  [1,'Alloy steel, 5,000 psi, API 8C','Joins the rotary hose'],
  [1,'Hardened washpipe + packing set','Seals mud between fixed and turning parts'],
  [1,'Cast steel housing','Holds bearings and oil'],
  [1,'Tapered roller thrust bearing','Carries the string weight while turning'],
  [1,'4140 forged stem, 6-5/8 in LH reg pin','Turns with the kelly and string']],
 block:[
  [6,'Steel sheaves, 60 in, API 8C groove','Top fixed sheaves for the line'],
  [1,'1-3/8 in EIPS IWRC wire rope, API 9A','Carries the load between blocks'],
  [5,'Steel sheaves, 60 in, API 8C groove','Moving sheaves that lift the hook'],
  [1,'500 sh tn hook, cast alloy, API 8C','Holds the swivel or top drive links']],
 pdcbit:[
  [1,'Matrix tungsten carbide body, 8-1/2 in, 5 blade','Holds cutters and nozzles'],
  [40,'13 mm PDC cutters, diamond table on WC','Shear the rock'],
  [6,'Tungsten carbide nozzles, 12/32 in','Jet mud to clean and cool cutters'],
  [5,'TSP / carbide inserts on gauge','Hold hole size and stabilise bit'],
  [1,'AISI 4145 steel shank, 4-1/2 in API reg pin','Connects bit to the string']],
 tricone:[
  [1,'Carburised steel cone, TCI inserts','Crushes rock (cone 1)'],
  [1,'Carburised steel cone, TCI inserts','Crushes rock (cone 2)'],
  [1,'Carburised steel cone, TCI inserts','Crushes rock (cone 3)'],
  [3,'Journal bearings + elastomer O-ring seals','Let cones turn, keep grease in'],
  [3,'Forged steel legs + carbide nozzles','Hold cones and jet mud'],
  [1,'AISI 4145 steel, 4-1/2 in API reg pin','Connects bit to the string']],
 motor:[
  [1,'4145H steel sub + dump valve','Joins the string, drains pipe on trips'],
  [1,'Steel tube, 7:8 lobe elastomer lining, 4 stage','Stator: makes torque with the rotor'],
  [1,'Chrome-plated alloy steel rotor','Turns as mud flows through'],
  [1,'Alloy CV shaft / flex shaft','Changes eccentric rotation to concentric'],
  [1,'Adjustable bent housing, 0–3 deg','Sets the toolface bend'],
  [1,'Mud-lubed thrust + radial bearings','Carries WOB and side loads'],
  [1,'4145H drive shaft, API reg box','Turns the bit']],
 mwd:[
  [1,'Non-magnetic stainless collar, 6-3/4 in','Keeps steel away from the magnetometers'],
  [1,'Positive pulser, poppet + servo','Sends data to surface as pressure pulses'],
  [1,'Mud turbine + lithium battery pack','Gives power to the tool'],
  [1,'3-axis accelerometer + magnetometer','Measures inclination and azimuth'],
  [1,'4 NaI scintillation detectors','Measures gamma ray by quadrant'],
  [1,'Electronics board + flash memory','Controls tool and stores data']],
 rss:[
  [1,'Sealed electronics, D&I sensors','Holds the steering instructions'],
  [1,'Hydraulic valve / bias housing','Moves the pads at the set toolface'],
  [3,'Hardfaced steel pads','Push on the borehole wall to steer'],
  [1,'4145H steel, API reg box','Turns the bit']],
 jar:[
  [1,'4145H steel, API NC50 box','Connects jar to the string above'],
  [1,'Hardened alloy mandrel','Slides to give the impact stroke'],
  [1,'Silicone oil chamber + metering orifice','Delays the jar until load builds'],
  [1,'Hardened hammer and anvil faces','Give the up / down impact'],
  [1,'4145H steel housing, 6-1/2 in','Holds oil and guides the mandrel']]};

// ---------- hierarchy for the showroom: rig > asset > component > BOM lines (asset ids = rig sub-assets) ----------
// asset.ws / line.ws = workshop CAT key; line.part = 3D part index in that model (null = no 3D link). Line names for ws lines come from
// ext12 CAT at runtime (see names()); every line has src 'SIM'.
const L=(name,qty,spec,fn,part=null)=>({name,qty,spec,fn,part,src:'SIM'});
const ws=(k,i)=>{const [q,s,f]=W[k][i];return {...L(null,q,s,f,i),ws:k}};
const C=(id,label,lines)=>({id,label,lines:lines.map((l,i)=>({no:i+1,...l}))});
const A=(id,label,wsKey,components)=>({id,label,ws:wsKey,src:'SIM',components});
// group a workshop model's parts into components: [[id,label,[part indices]],...]
const grp=(k,g)=>g.map(([id,label,ix])=>C(id,label,ix.map(i=>ws(k,i))));
const one=k=>W[k].map((_,i)=>[k+'_'+(i+1),null,[i]]);
const G=(id,label,...l)=>C(id,label,l.map(([q,n,s,f])=>L(n,q,s,f)));
export const RIG={id:'rig',label:'Land drilling rig (generic, SIM)',src:'SIM',assets:[
 A('topdrive','Top drive','topdrive',grp('topdrive',[['frame','Guide dolly / frame',[0]],['motor','Drive motor',[1]],['gearbox','Gearbox',[2]],['swivel','Integrated swivel (gooseneck, washpipe, main shaft)',[3,4]],['ibop','IBOP valves',[5]],['pipehandler','Pipe handler (link tilt, bails, elevator)',[6,7]]])),
 A('drawworks','Drawworks','drawworks',grp('drawworks',[['skid','Skid',[0]],['drum','Drum',[1]],['motors','Drive motors',[2,3]],['transmission','Gear / chain case',[4]],['brake','Brake system',[5]],['instr','Crown saver / encoder',[6]]])),
 A('mudpumps','Mud pumps','mudpump',grp('mudpump',[['powerend','Power end',[0,1]],['fluidend','Fluid end',[2,3,4]],['dampener','Pulsation dampener',[5]],['drive','Drive motor',[6]]])),
 A('bop','BOP stack','bop',grp('bop',[['annular','Annular preventer',[0]],['rams','Ram preventers',[1,2,4]],['spool','Drilling spool + choke/kill',[3]],['wellhead','Wellhead / casing head',[5]]])),
 A('mast','Mast / substructure',null,[G('mast','Mast',[1,'Mast','Box mast, 142 ft, 1,000,000 lb, API 4F','Holds crown and hoisting load'],[1,'Racking board','Steel monkey board, 90 ft','Holds stands of pipe']),
  G('substructure','Substructure',[1,'Substructure','Box-on-box, 25 ft floor, API 4F','Holds rig floor and setback'],[1,'Rig floor + doghouse','Steel deck, driller cabin','Crew work area']),
  C('hoisting','Crown & travelling block',W.block.map((_,i)=>ws('block',i)))]),
 A('pipehandling','Pipe handling',null,[G('catwalk','Catwalk',[1,'Catwalk machine','Hydraulic, Range 3 pipe','Moves pipe to the floor']),G('roughneck','Iron roughneck',[1,'Iron roughneck','Spinner + wrench, 100,000 ft-lbf','Makes up / breaks out']),G('slips','Power slips',[1,'Power slips','500 sh tn, API 7K','Hold the string']),G('racker','Pipe racker',[1,'Column racker','Robotic','Moves stands'])]),
 A('mudtanks','Mud tanks / shakers',null,[G('tanks','Tanks',[3,'Mud tanks','Steel, 400 bbl, agitators','Hold and mix mud'],[1,'Trip tank','50 bbl, level sensor','Measures hole fill']),G('solids','Solids control',[3,'Shale shakers','Linear motion, API RP 13C screens','Remove cuttings'],[1,'Desander / desilter','Hydrocyclones 10 in / 4 in','Remove sand and silt']),G('degasser','Degasser',[1,'Vacuum degasser','Vacuum type','Takes gas out of mud'])]),
 A('generators','Generators',null,[G('gensets','Gensets',[4,'Diesel gensets','1,400 kW, 600 V AC','Make rig power']),G('vfd','VFD house',[1,'VFD house','AC drives + switchgear','Controls motor power']),G('fuel','Fuel system',[1,'Fuel tank','20,000 gal steel','Stores diesel'])]),
 A('accumulator','Accumulator (BOP control unit)',null,[G('bottles','Bottle bank',[16,'Bottles','11 gal bladder, 1,000 psi N2 precharge','Store pressured fluid']),G('pumps','Charge pumps',[2,'Pumps','Electric triplex + air','Charge the bottles']),G('manifold','Control manifold',[1,'Control manifold','3,000 psi, API 16D, 4-way valves','Open / close each preventer']),G('remote','Remote panel',[1,'Driller panel','Remote','Operate BOP from rig floor'])]),
 A('choke','Choke manifold',null,[G('manifold','Manifold',[1,'Manifold','3-1/16 in 10,000 psi, API 16C','Routes well control flow'],[10,'Gate valves','3-1/16 in 10,000 psi, API 6A','Isolate flow paths']),G('chokes','Chokes',[1,'Hydraulic choke','Remote adjustable','Holds back-pressure'],[1,'Manual choke','Adjustable','Back-up choke']),G('mgs','Mud gas separator',[1,'Mud gas separator','Poor-boy, 36 in','Separates gas from returns'])]),
 // workshop models that are not rig sub-assets (one component per part)
 ...['swivel','pdcbit','tricone','motor','mwd','rss','jar'].map(k=>({...A(k,null,k,grp(k,one(k))),group:'downhole'}))]};
// fill null labels/names from the workshop catalogue (ext12 CAT) so text stays in one place
export function names(CAT){walk((a,c,l)=>{const E=l.ws&&CAT[l.ws];if(!E)return;if(a.ws)a.label??=CAT[a.ws].label;c.label??=E.parts[c.lines[0].part]?.n;l.name??=E.parts[l.part]?.n});return RIG}
export function walk(f){for(const a of RIG.assets)for(const c of a.components)for(const l of c.lines)f(a,c,l)}
export function asset(id){return RIG.assets.find(a=>a.id==id)||null}
// flat view keyed by workshop CAT key (used by bom.js): [qty, spec, function] rows, row i -> 3D part i
export const BOM=W;
