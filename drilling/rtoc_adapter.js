// rtoc_adapter.js — rtoc.js data() bundle (game units: ft, klbf, ft·lbf) -> rtoc_scene_model input (metres, kN, kN·m).
// Source rules: WITSML never receives SIM lithology/plan; store formationMarker tops pass as NEUTRAL tops (no lithology);
// WITSML plan only if the store supplied one (d.plan with planSrc 'store plan'); offsets only if passed explicitly.
export const FT=0.3048,KLBF_KN=4.448222,FTLBF_KNM=0.0013558179;
export function fromGame(d,opt={}){const S=d.S||{},kind=d.src?.kind||'SIM',live=kind=='WITSML';const m=v=>v*FT;
 const sv=(S.surveys||[]).filter(r=>r&&[r[0],r[3],r[4],r[5]].every(Number.isFinite)).map(r=>({md:m(r[0]),n:m(r[3]),e:m(r[4]),tvd:m(r[5]),inc:r[1],azi:r[2]}));
 const L=d.lay||{list:[]},store=L.src=='formationMarker (store)';
 const lay=(!live||store)?(L.list||[]).filter(l=>Number.isFinite(l.top)&&(!live||store)).map(l=>({top:m(l.top),name:l.name,color:live?'#5b5650':l.c,src:live?'store formation tops':L.src,neutral:live||!!l.neutral})):[];
 const plan=(!live||String(d.planSrc||'').startsWith('store plan'))?(d.plan||[]).filter(p=>p&&Number.isFinite(p[5])).map(p=>({md:m(p[0]),n:m(p[3]),e:m(p[4]),tvd:m(p[5])})):[];
 const j=d.j?{n:d.j.n,startMd:m(d.j.startMd),endMd:m(d.j.endMd),open:!!d.j.open}:null;
 const modes=j&&opt.rows?opt.rows.filter(r=>!r.slips&&Number.isFinite(r.md)).map(r=>({md:m(r.md),mode:r.mode=='slide'?'slide':(r.mode=='rotate'||r.mode=='rotary')?'rotary':null,tq:Number.isFinite(r.tq)?r.tq*FTLBF_KNM:undefined,wob:Number.isFinite(r.wob)?r.wob*KLBF_KN:undefined})):[];
 const bd=d.rec?.samples?.at(-1)?.bd??S.md;
 return {source:live?'WITSML':kind=='SIMHIST'?'HIST':'SIM',test:!!d.src?.test,surveys:sv,az:Number.isFinite(d.az)?d.az:0,bitMd:Number.isFinite(bd)?m(bd):undefined,layers:lay,plan,offsets:opt.offsets||[],joint:j,modes,frame:opt.frame||'joint',view:opt.view||'mode',units:{tq:'kN·m',wob:'kN'}}}
