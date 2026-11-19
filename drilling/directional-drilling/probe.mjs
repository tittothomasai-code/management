import {surfaceAt} from './reservoir.mjs';
// Public drilling coordinates, independent of the renderer's display elevation.
export function drillingXYZ(p){if(!p||!['n','e','tvd'].every(k=>Number.isFinite(p[k])))throw Error('A finite 3D point is required.');return {x:p.e,y:p.n,z:p.tvd,n:p.n,e:p.e,tvd:p.tvd,units:'m',frame:'X = East, Y = North, Z = TVD; positive depth downward'};}
export function surveyFromWorld(p,kop){return {n:kop.n+p.z,e:kop.e+p.x,tvd:kop.tvd+380-p.y};}
export function refineSurfaceHit(r,origin,direction,distance,layer){
 if(!['roof','floor'].includes(layer)||!Number.isFinite(distance)||distance<0)return null;let t=distance;
 for(let i=0;i<12;i++){const p={n:origin.n+direction.n*t,e:origin.e+direction.e*t,tvd:origin.tvd+direction.tvd*t},s=surfaceAt(r,p.n,p.e);if(!s)return null;const error=p.tvd-s[layer];if(Math.abs(error)<1e-7)return {...p,tvd:s[layer],distance:t,layer};const derivative=direction.tvd-s.gradientN*direction.n-s.gradientE*direction.e;if(Math.abs(derivative)<1e-8)return null;t-=Math.max(-25,Math.min(25,error/derivative));if(t<0)return null;
 }return null;
}
