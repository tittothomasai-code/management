// Drilling physics ported from v2 sandbox (first-pass, uncalibrated values). SIMULATED.
export const R=Math.PI/180, FT=0.3048;
export function minCurv(p,m1,i1,a1,m2,i2,a2){i1*=R;a1*=R;i2*=R;a2*=R;const cb=Math.cos(i2-i1)-Math.sin(i1)*Math.sin(i2)*(1-Math.cos(a2-a1));const b=Math.acos(Math.max(-1,Math.min(1,cb)));const rf=b<1e-6?1:2/b*Math.tan(b/2),dm=m2-m1;
 return [p[0]+dm/2*(Math.sin(i1)*Math.cos(a1)+Math.sin(i2)*Math.cos(a2))*rf,p[1]+dm/2*(Math.sin(i1)*Math.sin(a1)+Math.sin(i2)*Math.sin(a2))*rf,p[2]+dm/2*(Math.cos(i1)+Math.cos(i2))*rf]}
export const PLAN={kop_md:1500,bur:3,hold_inc:35,azi:45,td_md:3500};
export function planAt(md){return md<=PLAN.kop_md?[0,PLAN.azi]:[Math.min(PLAN.hold_inc,(md-PLAN.kop_md)*PLAN.bur/100),PLAN.azi]}
export function planPath(){const pts=[[0,0,0,0,0,0]];let p=[0,0,0],md=0,i0=0,a0=PLAN.azi;while(md<PLAN.td_md){const m2=md+20,[i,a]=planAt(m2);p=minCurv(p,md,i0,a0,m2,i,a);pts.push([m2,i,a,...p]);md=m2;i0=i;a0=a}return pts}
export const P={ // parameters (rough, labelled first-pass)
 pump:{liner_in:6,stroke_in:12,max_spm:140,tau_s:3,vol_eff0:0.96,eff_drop_per_kpsi:0.01,popoff_psi:5000},
 mud:{mw_ppg:10},bit:{dia_in:8.5,nozzles:6,noz_32:14,cd:0.95,mu:0.3,rop_k:0.133,rop_a:1,rop_b:0.6,slide_factor:0.5},
 motor:{rev_per_gal:0.16,stall_torque:3500,dp_off:150,torque_per_psi:5,bur:6},
 line:{man_k:3e-5,surf_k_ft:4e-6,surf_len:150,ds_k_ft:1.3e-6,ann_k_ft:0.3e-6},
 td:{tau_s:2,max_rpm:180,max_torque:40000}, dw:{speed_mps:0.6,min_quill:1.2,max_quill:30.5},
 string:{w_ppf:19.5},mwd:{dp600:0},design:null}; // design = rig designer limits (null = defaults)
export function newState(){const md=2100,pre=planPath().filter(q=>q[0]<=md).map(q=>[q[0],q[1],q[2],q[3],q[4],q[5]]),lp=pre[pre.length-1];return{t:0,
 pumps:[0,1].map(i=>({id:i+1,on:true,cmd:100,spm:0,theta:i,strokes:0,tripped:false,flow:0})),_pid:2,
 td:{cmd:60,rpm:0,theta:0,torque:0},mode:'rotate',tf:0,autoSteer:true,
 dw:{mode:'auto',wobSet:25,quill:20,drum:0,fadeLoad:0},wob:0,
 slips:false,connected:true,stickup:1.0,L:md+(20)/FT,
 md,inc:lp[1],azi:45,pos:lp.slice(3),surveys:pre,lastS:md,
 Q:0,Qb:0,spp:0,motorRpm:0,bitRpm:0,dpm:0,dpb:0,tfa:0,rop:0,bitTorque:0,stalled:false,hook:0,
 faults:{},events:[],seq:null,newJoint:0,rough:0,catwalk:0,rnOp:null,envHook:null}}
export function newPump(S,o={}){const p={id:o.id??++S._pid,on:true,cmd:100,spm:0,theta:Math.random()*6,strokes:0,tripped:false,flow:0,...o};S.pumps.push(p);return p}
export function ev(S,m){S.events.push([S.t,m]);if(S.events.length>50)S.events.shift()}
export function bitDepth(S){const top=S.connected&&!S.slips?S.dw.quill:S.stickup;return S.L-top/FT}
export function step(S,dt){const t=S.t,F=S.faults,mw=P.mud.mw_ppg;
 // drawworks / hoisting
 const dw=S.dw;let dq=0;
 const hs=P.design?Math.min(P.dw.speed_mps,P.design.dw_hp*550*0.8/Math.max(1,S.hook*1000)*FT):P.dw.speed_mps;S.hoistSpd=hs;
 if(P.design&&dw.mode=='hoist'&&S.hook>P.design.hook_rating){dq=0;if(!S._ilk4){ev(S,'Interlock: hookload over rig rating, hoist blocked');S._ilk4=1}}else S._ilk4=0;
 if(dw.mode=='hoist'&&!S._ilk4)dq=hs*dt;else if(dw.mode=='lower')dq=-P.dw.speed_mps*dt;
 if(F.brake_fade&&dw.mode!='hoist')dq-=0.12*dt; // brake cannot hold: block creeps down
 if((dw.mode=='hoist'||dw.mode=='lower')&&S.rough&&!S.seq){dq=0;if(!S._ilk3){ev(S,'Interlock: block movement blocked, iron roughneck at well centre');S._ilk3=1}}else S._ilk3=0;
 if(dw.mode=='hoist'&&S.slips&&S.connected){dq=0;if(!S._ilk1){ev(S,'Interlock: cannot hoist, slips set while string connected');S._ilk1=1}}else S._ilk1=0;
 let q=dw.quill+dq;q=Math.min(P.dw.max_quill,q);
 const attached=S.connected&&!S.slips;let onb=false;
 if(attached){const qb=(S.L-S.md)*FT; // quill height when bit on bottom
  if(dw.mode=='auto'&&!F.brake_fade){q=qb;onb=true}
  if(q<=qb+1e-6){ if(q<qb-1e-6&&F.brake_fade)dw.fadeLoad+=(qb-q)/FT*1.5; q=qb;onb=true}}
 else{q=Math.max(q,S.slips?(S.connected?S.stickup:0.3):0.3)}
 dw.drum+=(q-dw.quill)*-6;dw.quill=q;
 let wob=0;if(onb){wob=(dw.mode=='auto'?dw.wobSet:dw.mode=='lower'?dw.wobSet*0.5:0)+dw.fadeLoad;if(F.motor_stall)wob+=30}
 S.wob+=(wob-S.wob)*Math.min(1,dt/1.5);
 // top drive
 let rc=S.td.cmd;if(S.mode=='slide'||!S.connected&&!S.seq)rc=0;if(S.slips&&S.connected){rc=0}
 if(S.rough&&!(S.seq&&S.seq.tdOverride!=null)&&!S.rnOp){if(rc>0&&!S._ilk2){ev(S,'Interlock: rotation blocked, iron roughneck at well centre');S._ilk2=1}rc=0}else S._ilk2=0;
 if(S.rnOp)rc=S.rnOp.kind=='break'?-20:20;
 if(S.seq&&S.seq.tdOverride!=null)rc=S.seq.tdOverride;
 // manual roughneck operation (break-out / make-up)
 if(S.rnOp&&S.t-S.rnOp.t0>=6){if(S.rnOp.kind=='break'){S.connected=false;ev(S,'Roughneck: connection broken out')}else{S.connected=true;if(S.newJoint){S.L+=27.4/FT;S.newJoint=0}ev(S,'Roughneck: connection made up')}S.rnOp=null}
 rc=Math.max(-P.td.max_rpm,Math.min(P.td.max_rpm,rc));if(S.td.torque>P.td.max_torque&&rc>0){rc=0;if(!S._tq){ev(S,'Top drive torque limit: rotation stalled');S._tq=1}}else S._tq=0;
 S.td.rpm+=(rc-S.td.rpm)*dt/P.td.tau_s;S.td.theta+=S.td.rpm/60*dt*2*Math.PI;
 // pumps
 let Q=0;const pp=P.pump;
 for(const p of S.pumps){let cmd=p.on?p.cmd:0;if(p.tripped||!S.connected)cmd=0;p.spm+=(Math.min(cmd,p.max_spm||pp.max_spm)-p.spm)*dt/pp.tau_s;if(p.spm<0.05&&cmd==0)p.spm=0;
  p.theta+=p.spm/60*dt*2*Math.PI;p.strokes+=p.spm/60*dt;const gps=0.000243*(p.liner_in||pp.liner_in)**2*(p.stroke_in||pp.stroke_in)*42*(p.modules||3)/3;const ve=pp.vol_eff0-pp.eff_drop_per_kpsi*S.spp/1000;p.flow=p.spm*gps*ve;if(p.valve===false){if(p.spm>5&&!p.tripped){p.tripped=true;ev(S,'Pump '+p.id+' dead-headed against closed manifold valve: pop-off tripped')}p.flow=0}Q+=p.flow}
 S.Q=Q;let wf=0;if(F.washout)wf=0.3*Math.min(1,(t-F.washout)/120);const Qb=Q*(1-wf);S.Qb=Qb;S.wf=wf;const wpos=0.6*S.md;
 const B=P.bit,n=F.plugged_nozzle?B.nozzles-2:B.nozzles,tfa=n*Math.PI/4*(B.noz_32/32)**2;S.tfa=tfa;
 const dpb=Qb>1?mw*Qb*Qb/(12032*B.cd**2*tfa**2):0;
 const on=S.wob>0.5&&Qb>100,bt=on?B.mu*S.wob*1000*B.dia_in/36:0,M=P.motor,stall=bt>M.stall_torque;
 if(stall&&!S.stalled)ev(S,'Mud motor stalled (SPP jump)');if(!stall&&S.stalled)ev(S,'Motor stall cleared');S.stalled=stall;
 let mr,dpm;if(stall){mr=0;dpm=M.dp_off+M.stall_torque/M.torque_per_psi*1.3}else{mr=Qb*M.rev_per_gal*(1-0.3*bt/M.stall_torque);dpm=Qb>50?M.dp_off+bt/M.torque_per_psi:0}
 const L=P.line,e=1.8,man=L.man_k*Q*Q,surf=L.surf_k_ft*Q**e*L.surf_len,ds=L.ds_k_ft*(Q**e*wpos+Qb**e*(S.md-wpos)),ann=L.ann_k_ft*(Qb**e*(S.md-wpos)+Q**e*wpos);
 const xs=S.extraSurf?S.extraSurf(Q):0,xb=(S.extraBha?S.extraBha(Qb):0)+P.mwd.dp600*(Qb/600)**2; // placed equipment (library): surface line losses + BHA tool losses
 const spp=man+surf+xs+ds+xb+dpm+dpb+ann;S.spp=spp;S.prof={man,surf,xs,ds,xb,dpm,dpb,ann};
 for(const p of S.pumps)if(spp>(p.popoff||pp.popoff_psi)&&!p.tripped){p.tripped=true;ev(S,'Pop-off lifted, pump tripped')}
 S.motorRpm=mr;S.dpm=dpm;S.dpb=dpb;S.bitRpm=mr+S.td.rpm;S.bitTorque=bt;
 S.td.torque=S.td.rpm>2?1500+0.8*S.md+(S.mode=='rotate'?bt:0):0;
 // ROP + steering
 let rop=0;if(on&&!stall&&attached){rop=B.rop_k*S.wob**B.rop_a*Math.max(S.bitRpm,0)**B.rop_b;if(S.mode=='slide')rop*=B.slide_factor}
 S.rop=rop;const dmd=rop/3600*dt;
 if(dmd>0){if(S.autoSteer)steer(S);
  if(S.mode=='slide'){const tf=S.tf*R;S.inc=Math.max(0,S.inc+M.bur*Math.cos(tf)*dmd/100);if(S.inc>0.5)S.azi=(S.azi+M.bur*Math.sin(tf)/Math.sin(S.inc*R)*dmd/100+360)%360}
  else{S.inc=Math.max(0,S.inc-0.15*dmd/100);S.azi=(S.azi+0.1*dmd/100)%360}
  S.md+=dmd;if(S.md-S.lastS>=10)survey(S)}
 if(attached&&S.dw.quill<=P.dw.min_quill+0.01&&dw.mode=='auto'&&!S._sd){S._sd=1;ev(S,'Stand drilled down: run connection')}if(S.dw.quill>P.dw.min_quill+0.5)S._sd=0;
 const tvd=S.pos[2],bf=1-mw/65.5;S.hook=(S.connected&&!S.slips?35+P.string.w_ppf*bf*(tvd+0.5*(S.md-tvd))/1000+(S.extraWeight||0)*bf-S.wob:35);
 if(S.envHook)S.envHook(S,dt); // FUTURE: environment / stress layer hook (not built)
 S.t+=dt}
export function survey(S){const l=S.surveys[S.surveys.length-1];S.pos=minCurv(l.slice(3),l[0],l[1],l[2],S.md,S.inc,S.azi);S.surveys.push([S.md,S.inc,S.azi,...S.pos]);S.lastS=S.md}
const PP=planPath();
function steer(S){const [pi,pa]=planAt(S.md+60);let pp=PP[0];for(const q of PP)if(q[0]<=S.md)pp=q;
 const te=S.md>PLAN.kop_md?S.pos[2]-pp[5]:0;const di=Math.max(0,pi+Math.max(-3,Math.min(3,0.05*te)))-S.inc,da=(((pa-S.azi+540)%360)-180)*Math.sin(Math.max(S.inc,1)*R),err=Math.hypot(di,da);
 if(S.mode=='rotate'&&err>1){S.mode='slide';S.tf=(Math.atan2(da,di)/R+360)%360;ev(S,'Auto-steer: slide, toolface '+S.tf.toFixed(0))}else if(S.mode=='slide'&&err<0.3){S.mode='rotate';ev(S,'Auto-steer: rotate')}else if(S.mode=='slide')S.tf=(Math.atan2(da,di)/R+360)%360}
// Connection sequence: steps with interlocks; each step = [label, start fn, done predicate, min duration s]
export function connectionSteps(S){const keep={spm:new Map(S.pumps.map(p=>[p,p.cmd])),rpm:S.td.cmd};return[
 ['Stop drilling, hold block',s=>{s.dw.mode='hold';s.autoSteer=false},s=>true,3],
 ['Pumps off',s=>{s.pumps.forEach(p=>p.on=false)},s=>s.Q<20,3],
 ['Stop rotation',s=>{s.td.cmd=0},s=>s.td.rpm<2,2],
 ['Pick up off bottom',s=>{s.dw.mode='hoist'},s=>s.dw.quill>=Math.min((s.L-s.md)*FT+1.0,30),0,s=>{s.dw.mode='hold'}],
 ['Set slips',s=>{s.stickup=s.dw.quill;s.slips=true},s=>true,4,null,'slipset'],
 ['Iron roughneck in',s=>{s.rough=1},s=>true,4,null,'roughin'],
 ['Break out',s=>{s.seq.tdOverride=-20},s=>true,6,s=>{s.seq.tdOverride=null;s.connected=false},'break'],
 ['Iron roughneck out',s=>{s.rough=0},s=>true,3],
 ['Hoist top drive to top',s=>{s.dw.mode='hoist'},s=>s.dw.quill>=s.stickup+27.4+0.2,0,s=>{s.dw.mode='hold'}],
 ['Catwalk delivers joint',s=>{s.catwalk=1},s=>true,10],
 ['Stab joint, lower to box',s=>{s.newJoint=1;s.catwalk=0;s.dw.mode='lower'},s=>s.dw.quill<=s.stickup+27.4,0,s=>{s.dw.mode='hold';s.dw.quill=s.stickup+27.4}],
 ['Iron roughneck in, make up',s=>{s.rough=1;s.seq.tdOverride=20},s=>true,6,s=>{s.seq.tdOverride=null;s.connected=true;s.L+=27.4/FT;s.newJoint=0},'roughin'],
 ['Iron roughneck out',s=>{s.rough=0},s=>true,3],
 ['Release slips',s=>{s.slips=false},s=>true,3,null,'sliprel'],
 ['Pumps on',s=>{s.pumps.forEach(p=>{p.on=true;if(keep.spm.has(p))p.cmd=keep.spm.get(p)})},s=>s.Q>0.9*s.pumps.reduce((a,p)=>a+p.cmd*4.2,0)||true,15,null,'pumpson'],
 ['Rotate, back to bottom, drill',s=>{s.td.cmd=keep.rpm;s.dw.mode='auto';s.autoSteer=true},s=>true,2]]}
// Interlock rules for rig-floor actions. Return null if allowed, else the reason.
export function guard(S,a){switch(a){
 case 'slipset':return PH_onBottom(S)?'pick up off bottom before setting slips':S.td.rpm>2?'stop rotation before setting slips':null;
 case 'sliprel':return !S.connected?'string not connected to top drive':S.rough?'move iron roughneck out first':null;
 case 'roughin':return !S.slips?'set slips before roughneck goes to well centre':S.td.rpm>2?'stop rotation first':S.Q>20?'pumps off first':null;
 case 'roughout':return S.rnOp?'roughneck is working':null;
 case 'break':return !S.rough?'roughneck not at well centre':!S.slips?'slips not set':!S.connected?'already broken out':S.Q>20?'pumps off first':null;
 case 'make':return !S.rough?'roughneck not at well centre':!S.slips?'slips not set':S.connected?'already made up':!(S.newJoint||S.dw.quill<=S.stickup+0.5)?'no pin in box: lower top drive or stab joint':null;
 case 'pumpson':return !S.connected?'string not connected':null;
 case 'drill':return S.slips?'release slips first':!S.connected?'string not connected':S.rough?'move roughneck out first':null}
 return null}
function PH_onBottom(S){return bitDepth(S)>=S.md-0.5&&S.wob>1}
export function doAct(S,a){const g=guard(S,a);if(g){ev(S,'Interlock: '+g);return false}
 if(a=='slipset'){S.stickup=S.dw.quill;S.slips=true;ev(S,'Slips set')}else if(a=='sliprel'){S.slips=false;ev(S,'Slips released')}
 else if(a=='roughin'){S.rough=1;ev(S,'Roughneck in')}else if(a=='roughout'){S.rough=0;ev(S,'Roughneck out')}
 else if(a=='break'||a=='make'){S.rnOp={kind:a,t0:S.t};ev(S,'Roughneck: '+(a=='break'?'breaking out':'making up'))}
 else if(a=='pumpson'){S.pumps.forEach(p=>p.on=true)}else if(a=='drill'){S.dw.mode='auto'}
 return true}
// Sequence library. Step = [label, start, done, minDuration s, end, guardAction]
export function drillStandSteps(){return[['Drill stand down (auto-drill)',s=>{s.dw.mode='auto';s.autoSteer=true},s=>!!s._sd,5,null,'drill']]}
export function slideSteps(tf=90,ft=30){return[
 ['Auto-steer off, orient toolface '+tf+'°',s=>{s.autoSteer=false;s.mode='rotate';s.td.cmd=0},s=>s.td.rpm<2,3],
 ['Slide '+ft+' ft (motor only)',s=>{s.mode='slide';s.tf=tf;s._m0=s.md},s=>s.md-s._m0>=ft,0],
 ['Rotate 15 ft',s=>{s.mode='rotate';s.td.cmd=60;s._m0=s.md},s=>s.md-s._m0>=15,0],
 ['Auto-steer back on',s=>{s.autoSteer=true},s=>true,2]]}
export const SEQUENCES={
 full:{label:'Full: drill stand > connection > drill + slide',build:S=>[...drillStandSteps(),...connectionSteps(S),...slideSteps()]},
 conn:{label:'Connection only (needs stand drilled down)',build:S=>connectionSteps(S)},
 stand:{label:'Drill one stand',build:()=>drillStandSteps()},
 slide:{label:'Directional slide 30 ft TF 90°',build:()=>slideSteps()}};
export function startSeq(S,key,stepMode=false){if(S.seq)return false;const d=SEQUENCES[key];S.seq={key,label:d.label,steps:d.build(S),i:0,stepMode,wait:false};ev(S,'Sequence start: '+d.label);return true}
export function seqTick(S){const q=S.seq;if(!q||q.wait)return;const st=q.steps[q.i];
 if(!q.started){if(st[5]){const g=guard(S,st[5]);if(g){if(q.blocked!==g){q.blocked=g;ev(S,'Interlock holds step: '+g)}return}}q.blocked=null;q.started=1;q.t0=S.t;ev(S,'Step '+(q.i+1)+': '+st[0]);st[1](S)}
 if(S.t-q.t0>=st[3]&&st[2](S)){st[4]&&st[4](S);q.done=(q.done||[]);q.done[q.i]=S.t-q.t0;q.i++;q.started=0;if(q.stepMode)q.wait=true;if(q.i>=q.steps.length){ev(S,'Sequence complete');S.seq=null}}}
