// RBX-209: George's rig equipment list is in the Equipment library drop-down (equipment.json, ext.js). SIM.
import fs from 'fs';import assert from 'assert';
const d=JSON.parse(fs.readFileSync(new URL('./equipment.json',import.meta.url)));const L=d.types.map(t=>t.label.toLowerCase());
const want=['drawworks','deadline anchor','supply reel','hydraulic power','vfd','travelling block','monkey board','hook','elevator','slips','top drive','paddle flow meter','possum belly','mud tank','mud pit','trip tank','water tank','fuel storage','kill manifold','assembly point','windsock'];
for(const w of want)assert(L.some(l=>l.includes(w)),'missing '+w);
assert(/label:'Pipe rack'/.test(fs.readFileSync(new URL('./main.js',import.meta.url),'utf8')),'pipe rack core item');
const ty=d.types.map(t=>t.type);assert.equal(new Set(ty).size,ty.length,'duplicate type');
for(const t of d.types.filter(t=>t.source==='RBX-209')){assert.equal(t.sim,true);assert.equal(t.category,'surface');assert(t.geometry.length)}
console.log('rbx209 ok',want.length+1,'items');
