// rigbuilder_core.js (feat/rig-builder): pure data layer for the Rig Builder. No DOM, no three.js (node-testable).
// Catalogue = every top-level component in the B pass-1 manifest (10 rigs), the C pass-2 manifest (detailed land rig)
// and the A workshop BOM (bom_data.js RIG). Specs are GENERIC SIM class values (same classes as Showroom B STATS), never a real rig.
export const VER='rb1';
export const SLOTS=[
 {k:'mast',l:'Mast / derrick',req:1},{k:'sub',l:'Substructure / hull',req:1},{k:'dw',l:'Drawworks / hoist',req:1},
 {k:'td',l:'Top drive / block',req:1},{k:'bop',l:'BOP stack',req:1},{k:'pumps',l:'Mud pumps',req:1,qty:[1,6,2]},
 {k:'tanks',l:'Tanks',req:0},{k:'power',l:'Generators / power',req:1,qty:[1,8,3]},{k:'cabin',l:'Cabin / control',req:0},
 {k:'pipe',l:'Pipe handling',req:0},{k:'extra',l:'Other parts',req:0,multi:1}];
// SIM class values per source rig (hook t, depth m, power kW, BOP psi, drawworks hp, pump hp each).
export const CLS={
 land_1500_ac_double:{hook:340,depth:6100,kw:1119,bop:10000,hp:1500,php:1600},
 land_3000_triple_walking:{hook:680,depth:9100,kw:2237,bop:15000,hp:3000,php:2200},
 workover_truck:{hook:113,depth:4500,kw:410,bop:5000,hp:550,php:1000},
 coiled_tubing:{hook:36,depth:6000,kw:450,bop:10000,hp:300,php:1000},
 jackup:{hook:680,depth:9100,kw:2237,bop:15000,hp:3000,php:2200},
 semi_submersible:{hook:907,depth:10700,kw:3430,bop:15000,hp:4600,php:2200},
 drillship:{hook:1134,depth:12200,kw:3730,bop:15000,hp:5000,php:2200},
 platform_modular:{hook:450,depth:7600,kw:1492,bop:15000,hp:2000,php:1600},
 snubbing_unit:{hook:270,depth:6000,kw:560,bop:10000,hp:750,php:1000},
 frac_spread:{hook:0,depth:7000,kw:37000,bop:15000,hp:400,php:2500},
 land_1500_ac_double_detailed:{hook:340,depth:6100,kw:1119,bop:10000,hp:1500,php:1600},
 A:{hook:340,depth:6100,kw:1119,bop:10000,hp:1500,php:1600}};
const RULES=[['mast',/^(derrick|gin_pole|snubbing_frame|injector_head|drilling_package|mast)$/],
 ['sub',/^(substructure|drill_floor|hull|jacket|legs|pontoons|columns|main_deck|platform_deck|carrier|cantilever|walking_system|support_frame)$/],
 ['dw',/^(drawworks|hydraulic_jacks|reel_trailer)$/],['td',/^(top_drive|topdrive|travelling_block|crown_block|hook)$/],
 ['bop',/^(bop_stack|bop|stripper)$/],['pumps',/^(mud_pump_\d+|mud_system|pump_trucks|mudpumps)$/],
 ['tanks',/^(mud_tanks|fuel_tank|sand_storage|mudtanks)$/],['power',/^(generators|vfd_house|power_pack|hydraulic_power_pack)$/],
 ['cabin',/^(doghouse|control_cabin|control_van)$/],['pipe',/^(catwalk|pipe_rack|iron_roughneck|rod_rack|setback_pipe|pipehandling)$/]];
export const slotOf=n=>{for(const [k,re] of RULES)if(re.test(n))return k;return 'extra'};
export const pretty=s=>{s=String(s).split('/').pop().replace(/_/g,' ');return s.charAt(0).toUpperCase()+s.slice(1)};
const shortRig=id=>({land_1500_ac_double:'1500 AC land',land_3000_triple_walking:'3000 walker',workover_truck:'Workover',coiled_tubing:'Coil unit',jackup:'Jackup',semi_submersible:'Semi',drillship:'Drillship',platform_modular:'Platform',snubbing_unit:'Snubber',frac_spread:'Frac spread',land_1500_ac_double_detailed:'1500 AC detailed'}[id]||id);
function nodes(r){const L=r.lods?.M||r.lods?.H||Object.values(r.lods||{})[0]||{};return L.nodeToBom||r.nodeToBom||{}}
// man1 / man2: Codex manifests ({rigs:[...]}); bomRig: bom_data.js RIG ({assets:[{id,label?,components:[{n,lines}]}]}).
export function buildCatalogue(man1,man2,bomRig){const out=[],seen=new Set();
 const fromMan=(m,src,pack)=>{for(const r of m?.rigs||[]){const n=nodes(r),top={};
  for(const [p,b] of Object.entries(n)){const t=p.split('/')[0];if(/^light/.test(t)||/^(handrails|stairs|vdoor|drill_line|drill_string|cable_trays|service_loop|safety_equipment)$/.test(t)&&src!='C')continue;(top[t]=top[t]||{bom:null,kids:[]});if(p==t)top[t].bom=b;else if(!/\/light/.test(p))top[t].kids.push({path:p,bom:b})}
  for(const [t,v] of Object.entries(top)){const id=src+':'+r.id+':'+t;if(seen.has(id))continue;seen.add(id);
   out.push({id,slot:slotOf(t),node:t,name:pretty(t),src,pack,rig:r.id,rigName:shortRig(r.id),bom:v.bom||(r.id+'/'+t).toUpperCase(),kids:v.kids,cls:CLS[r.id]||CLS.A})}}};
 fromMan(man1,'B','pass1');fromMan(man2,'C','pass2');
 for(const a of bomRig?.assets||[]){if(a.group=='downhole')continue;const id='A:'+a.id;out.push({id,slot:slotOf(a.id),node:a.id,name:a.label||pretty(a.id),src:'A',pack:'blender',rig:'A',rigName:'Classic workshop',bom:'A/'+a.id,kids:(a.components||[]).map((c,i)=>({path:a.id+'/'+(c.n||i),bom:'A/'+a.id+'/'+i,lines:(c.lines||[]).length})),cls:CLS.A})}
 return out}
export function defaults(cat){const s={};for(const S of SLOTS){if(S.multi)continue;const P={td:'top_drive',pipe:'catwalk',tanks:'mud_system'},pick=cat.find(c=>c.slot==S.k&&c.rig=='land_1500_ac_double'&&c.src=='B'&&(!P[S.k]||c.node==P[S.k]))||cat.find(c=>c.slot==S.k&&c.rig=='land_1500_ac_double'&&c.src=='B')||cat.find(c=>c.slot==S.k);if(pick)s[S.k]=pick.id}
 return {v:1,id:'',name:'',tag:'SIM',slots:s,qty:{pumps:2,power:3},extras:[],created:0,updated:0}}
const byId=(cat,id)=>cat.find(c=>c.id==id)||null;
// Key specs (SIM): hook load = weakest of mast, drawworks and top drive; depth = min of mast and drawworks class depth,
// (load = larger of drawworks and pumps, plus 15 % for other users; generator unit = 0.9 x class kW)
// cut in proportion when pump power is under 1 hp per 4 m (hydraulics limit); power = generator class kW x count; BOP = stack rating.
export function specs(rig,cat){const g=k=>byId(cat,rig.slots?.[k]),c=k=>g(k)?.cls,q=rig.qty||{},miss=SLOTS.filter(S=>S.req&&!g(S.k)).map(S=>S.l);
 const hook=Math.min(...['mast','dw','td'].map(k=>c(k)?.hook??0));const pq=Math.max(1,q.pumps||1),gq=Math.max(1,q.power||1);
 const php=(c('pumps')?.php||0)*pq,base=Math.min(c('mast')?.depth??0,c('dw')?.depth??0),need=base/4,depth=Math.round(php>=need||!need?base:base*php/need);
 const kw=Math.round((c('power')?.kw||0)*0.9*gq),bop=c('bop')?.bop||0,load=Math.round(Math.max(c('dw')?.hp||0,php)*0.746*1.15);
 const warn=[...miss.map(m=>'Missing: '+m)];if(kw&&load>kw)warn.push(`Power is low: load ${load.toLocaleString('en-AU')} kW, supply ${kw.toLocaleString('en-AU')} kW`);
 if(php<need)warn.push('Pump power limits depth');return {hook,depth,kw,bop,pumpHp:php,load,warn,tag:'SIM'}}
export function bom(rig,cat){const rows=[];for(const S of SLOTS){const ids=S.multi?(rig.extras||[]):(rig.slots?.[S.k]?[rig.slots[S.k]]:[]);
 for(const id of ids){const it=byId(cat,id);if(!it)continue;const qty=S.qty?Math.max(1,rig.qty?.[S.k]||1):1;rows.push({slot:S.l,name:it.name,src:it.src+' · '+it.rigName,bom:it.bom,qty,lvl:'A'});
  for(const k of it.kids)rows.push({slot:'',name:pretty(k.path),src:'',bom:k.bom,qty:qty*(k.lines||1),lvl:k.path.split('/').length>2?'C':'B'})}}return rows}
export function validName(name,list,selfId){const n=String(name??'').trim().replace(/\s+/g,' ');if(!n)return {ok:false,err:'Type a name.'};if(n.length>60)return {ok:false,err:'Use 60 characters or less.'};
 if((list||[]).some(r=>r.id!=selfId&&r.name.toLowerCase()==n.toLowerCase()))return {ok:false,err:'A rig with this name exists. Use a different name.'};return {ok:true,name:n}}
export const newId=()=>'cr_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
export function clean(r){if(!r||typeof r!='object'||typeof r.name!='string'||typeof r.slots!='object')return null;
 return {v:1,id:String(r.id||newId()),name:r.name,tag:'SIM',slots:Object.fromEntries(Object.entries(r.slots).filter(([k,v])=>SLOTS.some(S=>S.k==k)&&typeof v=='string')),
  qty:{pumps:Math.min(6,Math.max(1,+r.qty?.pumps||2)),power:Math.min(8,Math.max(1,+r.qty?.power||3))},extras:Array.isArray(r.extras)?r.extras.filter(x=>typeof x=='string').slice(0,200):[],created:+r.created||Date.now(),updated:+r.updated||Date.now()}}
export function exportJSON(rigs){return JSON.stringify({format:'drilling-world-custom-rigs',v:1,tag:'SIM',rigs},null,1)}
// Import: names that clash get " (2)", " (3)"... ; ids are new so imports never overwrite.
export function importJSON(text,list){let d;try{d=JSON.parse(text)}catch(e){return {ok:false,err:'The file is not valid JSON.'}}
 const arr=Array.isArray(d)?d:Array.isArray(d?.rigs)?d.rigs:d?.slots?[d]:null;if(!arr)return {ok:false,err:'No rigs found in the file.'};
 const names=(list||[]).map(r=>r.name.toLowerCase()),out=[];for(const x of arr){const r=clean(x);if(!r||!validName(r.name,[]).ok)continue;r.name=r.name.trim();let n=r.name,i=2;while(names.includes(n.toLowerCase()))n=`${r.name} (${i++})`;r.name=n;names.push(n.toLowerCase());r.id=newId();out.push(r)}
 return out.length?{ok:true,rigs:out}:{ok:false,err:'No valid rigs found in the file.'}}
// Base model for showrooms: the pass-1 rig that gave the mast (else the 1500 AC land rig).
export function baseRig(rig,cat){const m=byId(cat,rig.slots?.mast);return m&&m.src=='B'?m.rig:'land_1500_ac_double'}
