// showroom3d.js: loads Blender-built rig models (tools/blender, assets/rigs/<rig>_<lod>.glb, Draco) for the showroom.
// Node names carry BOM ids: empty "<asset>", child meshes "<asset>__<component>". Fallback = procedural model (caller keeps it).
// All files are local (vendor/, assets/). No CDN. Models are GENERIC SIM shapes, not a specific real rig.
import * as THREE from 'three';
export const VER='5115';
export const LODF={low:'low',medium:'med',high:'high'};
const cache=new Map();let LD=null;
async function loader(){if(LD)return LD;LD=(async()=>{const [{GLTFLoader},{DRACOLoader}]=await Promise.all([import('./vendor/loaders/GLTFLoader.js'),import('./vendor/loaders/DRACOLoader.js')]);
 const d=new DRACOLoader();d.setDecoderPath(new URL('./vendor/libs/draco/',import.meta.url).href);d.setDecoderConfig({type:'wasm'});const l=new GLTFLoader();l.setDRACOLoader(d);return l})();return LD}
export const url=(id,lod)=>new URL(`./assets/rigs/${id}_${LODF[lod]||'med'}.glb?v=${VER}`,import.meta.url).href;
export function enabled(){try{const u=new URLSearchParams(location.search).get('sr3d');if(u!=null)return u!='0';return localStorage.getItem('dw_sr3d')!='0'}catch(e){return true}}
// Returns a fresh clone of the scene for rig id at lod (q: low|medium|high).
export async function load(id,lod){const k=id+'_'+lod;if(!cache.has(k))cache.set(k,loader().then(l=>l.loadAsync(url(id,lod))).then(g=>{g.scene.traverse(o=>{if(!o.isMesh)return;const G=o.geometry;G.computeBoundingBox();const c=G.boundingBox.getCenter(new THREE.Vector3());if(c.lengthSq()<1e-8)return;G.translate(-c.x,-c.y,-c.z);o.position.add(c.applyQuaternion(o.quaternion).multiply(o.scale))});return g.scene}).catch(e=>{cache.delete(k);throw e}));
 const s=await cache.get(k);return s.clone(true)}
// Tag meshes: userData.part (showroom key), bom (asset id), comp (component id). inv maps BOM asset id -> showroom key.
export function tag(root,inv,keys){const parts=[];root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;let n=o,nm='';while(n&&n!==root){if(/^[a-z0-9]+(__[a-z0-9]+)?$/i.test(n.name)){nm=n.name;break}n=n.parent}
 const [a,c0]=nm.split('__'),c=c0&&c0.replace(/\.?\d{3}$/,'');const part=inv[a]||a;o.userData.bom=a||null;o.userData.comp=c||null;if(a&&keys.includes(part)){o.userData.part=part;parts.push(o)}});return parts}
// Fewer draw calls (phones): merge meshes per (asset, material). Originals stay as invisible proxies for pick / zoom / BOM ids.
let BGU=null;export async function utils(){return BGU||(BGU=await import('./vendor/utils/BufferGeometryUtils.js'))}
export function merge(root,U){root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),G=new Map(),out=[];
 root.traverse(o=>{if(!o.isMesh||!o.geometry)return;const sig=Object.keys(o.geometry.attributes).sort().join()+(o.geometry.index?'i':'');const k=(o.userData.bom||'_')+'|'+o.material.uuid+'|'+sig;if(!G.has(k))G.set(k,[]);G.get(k).push(o)});
 for(const [k,ms] of G){if(ms.length<2)continue;const gs=ms.map(o=>o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));const mg=U.mergeGeometries(gs,false);gs.forEach(x=>x.dispose());if(!mg)continue;
  const m=new THREE.Mesh(mg,ms[0].material);m.castShadow=m.receiveShadow=true;m.userData.part=ms[0].userData.part;m.userData.bom=ms[0].userData.bom;m.userData.merged=1;m.name=(ms[0].userData.bom||'misc')+'__merged';root.add(m);out.push(m);ms.forEach(o=>{o.visible=false;o.castShadow=false})}
 return out}
