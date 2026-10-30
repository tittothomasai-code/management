// ddglue.js (integrator, batch8): wires dd-driller (dddrv.js) into the DD cabin (ddcab.js) and aliases GX.ddmotor for dd-motor. All values SIM.
// Cabin calls GX.ddcab.onInstruction(text, api{sess,core,drill,survey,log,render}); driller exposes handle({text|cmd,state}).
// The driller parses, validates, reads back and decides stall; the cabin core stays the source of truth for the trajectory.
import * as DRV from './dddrv.js?v=b11';
function motorAlias(G){const M=G.ddcab?.motor||window.DDMOTOR;if(M&&!G.ddmotor)G.ddmotor={api:M,state:o=>{try{const q=M.step?.({flow:o.flow,wob:o.wob,rotating:!!o.rotating});return q?{...q,yieldDls:q.yield??q.yieldDls,src:'SIM'}:null}catch(e){return null}}}}
function sync(st,s){const b=s.bit||{};if(b.md!=null)st.md=b.md;if(b.inc!=null)st.inc=b.inc;if(b.azi!=null)st.azi=b.azi;if(b.tvd!=null)st.tvd=b.tvd;if(s.set){st.wob=s.set.wob;st.flow=s.set.flow}}
export function onInstruction(text,api){if(typeof text=='function')return; // dddrv.attach() registration call: ignore, routing is done here
 const G=window.GX;motorAlias(G);const s=api?.sess;if(!s)return DRV.handle({text});
 const st=s.drv||(s.drv=DRV.newState({md:s.bit?.md,inc:s.bit?.inc,azi:s.bit?.azi,tvd:s.bit?.tvd,wob:s.set?.wob,flow:s.set?.flow}));sync(st,s);
 const c=DRV.parse(text),r=DRV.execute(st,c),say=['You: '+text,...(r.say||[])];
 if(r.ok&&c&&(c.cmd=='slide'||c.cmd=='rotate')&&r.drilled>0){api.drill(c.len,{rotate:c.cmd=='rotate',tf:r.tfAct??c.tf??0});sync(st,s)}
 else if(r.ok&&c?.cmd=='survey')api.survey();
 else if(r.ok&&c&&(c.cmd=='wob'||c.cmd=='flow')&&s.set)s.set[c.cmd]=c.v;
 return {say,ok:r.ok,stall:!!r.stall,score:r.score,src:'SIM'}}
export function init(){const G=window.GX=window.GX||{};G.ddcab=G.ddcab||{};G.ddcab.onInstruction=onInstruction;G.ddglue={onInstruction};motorAlias(G)}
