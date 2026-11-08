// rtoc_scene_model.js — pure scene COMPOSITION (no THREE, no DOM). Input is a normalized, metres-only model from an adapter.
// Rules: never invent lithology/plan/offset; SIM is labelled synthetic; unsupported formations -> neutral shaped context.
export const COL={rotary:0x3d8cf0,slide:0xf0a830,survey:0x38d6c8,plan:0xd0d8e6,offset:0xa070e0,bit:0xffb347,hl:0x7fe7ff};
/** model: {source:'SIM'|'WITSML'|'HIST', surveys:[{md,n,e,tvd}], az (deg, section azimuth), bitMd, layers?:[{top,name,color,src}],
 *  plan?:[{md,n,e,tvd}], offsets?:[{name,pts:[{n,e,tvd}]}], joint?:{n,startMd,endMd,open}, modes?:[{md,mode}], target?:{tvd,name}, frame:'joint'|'well', view}
 *  Returns plain description used by rtoc_scene3d.js and testable in node. */
export function vs(n,e,az){const a=az*Math.PI/180;return n*Math.cos(a)+e*Math.sin(a)}
export function lateral(n,e,az){const a=az*Math.PI/180;return -n*Math.sin(a)+e*Math.cos(a)}
export function toXYZ(p,az){return [vs(p.n,p.e,az),-p.tvd,lateral(p.n,p.e,az)]}
export function posAtMd(sv,md){if(!sv.length)return null;if(md<=sv[0].md)return {...sv[0],est:false};
 for(let i=1;i<sv.length;i++){const a=sv[i-1],b=sv[i];if(md<=b.md){const f=(md-a.md)/((b.md-a.md)||1);return {md,n:a.n+(b.n-a.n)*f,e:a.e+(b.e-a.e)*f,tvd:a.tvd+(b.tvd-a.tvd)*f,est:false}}}
 // beyond last survey: straight-line projection along last tangent (flagged estimate)
 const b=sv.at(-1),a=sv.length>1?sv.at(-2):{md:0,n:0,e:0,tvd:0},L=(b.md-a.md)||1,d=md-b.md;
 return {md,n:b.n+(b.n-a.n)/L*d,e:b.e+(b.e-a.e)/L*d,tvd:b.tvd+(b.tvd-a.tvd)/L*d,est:true}}
function bbox(pts){const lo=[1e18,1e18,1e18],hi=[-1e18,-1e18,-1e18];for(const p of pts)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i])}return {lo,hi}}
export function compose(m){
 const az=m.az||0,sv=(m.surveys||[]).filter(s=>[s.md,s.n,s.e,s.tvd].every(Number.isFinite)).sort((a,b)=>a.md-b.md);
 const out={ok:sv.length>1,source:m.source,synthetic:m.source=='SIM',badges:[],strata:[],paths:[],callouts:[],block:null,camera:null,warnings:[]};
 if(!out.ok){out.warnings.push('No trajectory surveys');return out}
 const bitMd=Number.isFinite(m.bitMd)?m.bitMd:sv.at(-1).md;
 const traj=sv.map(s=>toXYZ(s,az));const bit=posAtMd(sv,bitMd);const bitP=toXYZ(bit,az);
 const planPts=(m.plan||[]).filter(p=>Number.isFinite(p.tvd)).map(p=>toXYZ(p,az));
 const bb=bbox([...traj,bitP,...planPts,[0,0,0]]);
 const len=bb.hi[0]-bb.lo[0],depth=-bb.lo[1],W=Math.max(len*1.5,depth*2.9,300),D=Math.max(W*0.32,bb.hi[2]-bb.lo[2]+100);
 const x0=Math.min(bb.lo[0],0)-W*0.12,x1=x0+W,yBot=bb.lo[1]-Math.max(60,depth*0.18);
 const zf=Math.max(0,bb.hi[2])+W/400;// front cut face passes through the well section (cut-away like reference)
 out.block={x0,x1,yTop:0,yBot,z0:zf-D,z1:zf,W,H:-yBot,D};
 // strata: only supplied layers are lithologic; otherwise neutral context bands (equal shaped, explicitly "not lithology")
 const L=(m.layers||[]).filter(l=>Number.isFinite(l.top)).sort((a,b)=>a.top-b.top);
 if(L.length){for(let i=0;i<L.length;i++){const top=Math.max(0,L[i].top),bot=i+1<L.length?L[i+1].top:-yBot;if(bot<=top||top>=-yBot)continue;
   out.strata.push({top,bot:Math.min(bot,-yBot),name:L[i].name||'',color:L[i].color||'#7d6a52',lith:!L[i].neutral,seed:i+1})}
  out.badges.push(L[0].neutral?'Formation tops: '+(L[0].src||m.source)+' (no lithology)':m.source=='SIM'||m.source=='HIST'?'Formations: SIM model (synthetic)':'Formations: '+(L[0].src||m.source))}
 else{const n=6,H=-yBot;for(let i=0;i<n;i++){const t=H*i/n,b=H*(i+1)/n;out.strata.push({top:t,bot:b,name:'',color:['#5b5650','#524d47','#5f5a52','#4d4944','#57524b','#4a4640'][i],lith:false,seed:i+1})}
  out.badges.push('Formations: not supplied — neutral context')}
 // well path segments
 const j=m.joint;out.paths.push({kind:'survey',pts:traj,color:COL.survey,radius:'thin',opacity:j?0.7:1});
 const last=sv.at(-1);if(bitMd>last.md+0.01)out.paths.push({kind:'estimate',pts:[toXYZ(last,az),bitP],color:COL.bit,dash:true,radius:'thin'});
 if(planPts.length>1){out.paths.push({kind:'plan',pts:planPts,color:COL.plan,dash:true,radius:'thin'});out.badges.push('Plan: '+(m.source=='WITSML'?'store plan':'SIM plan'))}else out.badges.push('Plan: not supplied');
 const offs=(m.offsets||[]).filter(o=>o.pts&&o.pts.length>1);for(const o of offs)out.paths.push({kind:'offset',name:o.name,pts:o.pts.map(p=>toXYZ(p,az)),color:COL.offset,dash:true,radius:'thin'});
 if(!offs.length)out.badges.push('Offset wells: not supplied');
 if(j&&Number.isFinite(j.startMd)&&Number.isFinite(j.endMd)){
  const md=(m.modes||[]).filter(r=>r.md>=j.startMd&&r.md<=j.endMd).sort((a,b)=>a.md-b.md);let seg=null;const segs=[];
  const push=(mm,mode)=>{const p=toXYZ(posAtMd(sv,mm),az);if(!seg||seg.mode!==mode){const prev=seg?seg.pts.at(-1):null;seg={mode,pts:prev?[prev]:[]};segs.push(seg)}seg.pts.push(p)};
  if(md.length){push(j.startMd,md[0].mode);for(const r of md)push(r.md,r.mode);push(j.endMd,md.at(-1).mode)}else{const n=12;for(let i=0;i<=n;i++)push(j.startMd+(j.endMd-j.startMd)*i/n,'unknown')}
  const view=m.view||'mode',ch=view=='torque'?'tq':view=='wob'?'wob':null;let vals=ch?md.map(r=>r[ch]).filter(Number.isFinite):[];
  out.view={id:view,available:view=='mode'?md.length>0:view=='plan'?planPts.length>1:vals.length>1,legend:null};
  if(ch&&out.view.available){const lo=Math.min(...vals),hi=Math.max(...vals);out.view.legend={ch,lo,hi,unit:m.units?.[ch]||''};
   for(let i=1;i<md.length;i++){const v=md[i][ch];if(!Number.isFinite(v))continue;const f=hi>lo?(v-lo)/(hi-lo):.5;
    out.paths.push({kind:'joint',mode:view,pts:[toXYZ(posAtMd(sv,md[i-1].md),az),toXYZ(posAtMd(sv,md[i].md),az)],color:ramp(f),radius:'thick'})}}
  else for(const s of segs)if(s.pts.length>1)out.paths.push({kind:'joint',mode:s.mode,pts:s.pts,color:s.mode=='slide'?COL.slide:s.mode=='rotary'?COL.rotary:COL.hl,radius:'thick'});
  if(view=='plan'&&out.view.available)for(const p of out.paths)if(p.kind=='plan'){p.dash=false;p.radius='thin';p.color=0xffffff}
  const a=posAtMd(sv,j.startMd),b=posAtMd(sv,j.endMd);
  out.callouts.push({kind:'jstart',p:toXYZ(a,az),text:`J-${j.n} start ${a.md.toFixed(1)} m`});
  if(j.open)out.callouts.push({kind:'bit',p:bitP,text:`BIT ${bitMd.toFixed(1)} m MD${bit.est?' (est. beyond last survey)':''}`});
  else out.callouts.push({kind:'jend',p:toXYZ(b,az),text:`J-${j.n} end ${b.md.toFixed(1)} m`});
  out.focus={a:toXYZ(a,az),b:toXYZ(b,az)}}
 else out.callouts.push({kind:'bit',p:bitP,text:`BIT ${bitMd.toFixed(1)} m MD${bit.est?' (est.)':''}`});
 if(m.target&&Number.isFinite(m.target.tvd))out.callouts.push({kind:'target',p:[bitP[0]-W*0.12,-m.target.tvd,0],text:(m.target.name||'TARGET').toUpperCase()});
 out.badges.unshift(m.source=='SIM'?'SIM · synthetic data':m.source=='WITSML'?(m.test?'TEST FIXTURE · synthetic':'WITSML · read-only'):'Saved SIM run · read-only');
 out.camera=frameCamera(out,m.frame||'joint',m.aspect||1.8);return out}
/** deterministic 3/4 perspective framing like the reference (looking from front-left-above). */
export function frameCamera(o,frame,aspect=1.8){const B=o.block,fov=38,t=Math.tan(fov*Math.PI/360);let c,w,h;
 if(frame=='joint'&&o.focus){const a=o.focus.a,b=o.focus.b;c=[(a[0]+b[0])/2,(a[1]+b[1])/2,(B.z0+B.z1)/2*0.2];const L=Math.max(Math.hypot(b[0]-a[0],b[1]-a[1])*8,B.W*0.25);w=L;h=L*0.6}
 else{c=[(B.x0+B.x1)/2,-B.H*0.42,(B.z0+B.z1)/2];w=B.W*1.12;h=B.H*1.25+B.D*0.45}
 const dist=Math.max(w/(2*t*aspect),h/(2*t))*1.02+(frame=='joint'?0:B.D*0.5),dir=[0.42,0.58,1],L=Math.hypot(...dir);
 return {target:c,position:c.map((v,i)=>v+dir[i]/L*dist),fov}}
export function ramp(f){f=Math.max(0,Math.min(1,f));const S=[[0x2a,0x6c,0xff],[0x38,0xd6,0xc8],[0xf0,0xd0,0x40],[0xf0,0x50,0x30]];const x=f*3,i=Math.min(2,Math.floor(x)),t=x-i,a=S[i],b=S[i+1];return (Math.round(a[0]+(b[0]-a[0])*t)<<16)|(Math.round(a[1]+(b[1]-a[1])*t)<<8)|Math.round(a[2]+(b[2]-a[2])*t)}
