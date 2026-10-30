// anim.js v5.9.2.3: what the 3D animation is allowed to show. Pure (node-testable).
// Pumps: LIVE -> running if sum SPM > LIVE_SPM_MIN or flow-in > LIVE_Q_MIN (gpm); SIM -> the pump toggle (p.on, not tripped).
// Speed scales with SPM; when not running the effective SPM is exactly 0 (no drift from a decaying SPM).
// Rotation: LIVE -> surface RPM channel; SIM -> td.rpm only in rotary (not slide). Zero in slips, sliding, or |RPM| < RPM_MIN.
export const LIVE_SPM_MIN=1,LIVE_Q_MIN=20,RPM_MIN=1;
export function pumpAnim(S,live){const P=S.pumps||[],sum=P.reduce((a,p)=>a+Math.max(0,+p.spm||0),0),q=+S.Q||0;
 const run=live?(sum>LIVE_SPM_MIN||q>LIVE_Q_MIN):P.some(p=>p.on&&!p.tripped);
 const per=P.map(p=>{if(!run)return 0;if(live){if(sum>LIVE_SPM_MIN)return Math.max(0,+p.spm||0);return P.length?q/4.2/P.length:0}return p.on&&!p.tripped?Math.max(0,+p.spm||0):0});
 return {run,per,sum:per.reduce((a,b)=>a+b,0),q:run?q:0}}
export function rotAnim(S,live){const r=live?(+(S.td?.rpm??S.rpm)||0):(+S.td?.rpm||0);
 if(S.slips||(!live&&S.mode=='slide')||Math.abs(r)<RPM_MIN)return 0;if(live&&S.mode=='slide')return 0;return r}
// advance a visual angle (rad) by rpm (or spm) over dt seconds of simulated time
export const adv=(th,perMin,dt)=>perMin?th+perMin/60*dt*2*Math.PI:th;
