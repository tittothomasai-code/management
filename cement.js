// v5.12 Primary cementing (SIM): 9-5/8" intermediate. Pure model (plan/stateAt) + 2D schematic view. SIM teaching model, never LIVE.
// Volume-coordinate model: fluid at flow-path position x (m³ from casing top, down casing, up annulus) = fluid pumped at cumulative volume V−x.
import {well,casingPlan,G} from './ops3d.js';
export const FL={mud:{n:'Mud',sg:1.25,c:'#6b5a3a'},spacer:{n:'Spacer',sg:1.40,c:'#3fa7d6'},lead:{n:'Lead slurry',sg:1.50,c:'#b8c4cc'},tail:{n:'Tail slurry',sg:1.90,c:'#eef3f6'},disp:{n:'Displacement mud',sg:1.25,c:'#8a7448'}};
export const FRAC=1.55,PORE=1.20,SHOETRACK=24,EXCESS=0.30,RATE=0.8/60;// m³/s (0.8 m³/min)
const cap=d=>Math.PI/4*d*d;
export function plan(w=well()){const P=casingPlan(w),IN=0.0254,shoe=P.s.shoeMD,prev=P.prev.shoeMD,Dc=P.Dp,Dci=Dc-2*P.e.p.t*IN,Dh=P.Dh,Dpi=(P.prev.od?P.prev.od*IN:13.375*IN)-2*0.48*IN;
 const capC=cap(Dci),capOH=(cap(Dh)-cap(Dc))*(1+EXCESS),capCH=cap(Dpi)-cap(Dc),fc=shoe-SHOETRACK;
 const tailTop=shoe-300,leadTop=prev-200;// tail 300 m above shoe, lead 200 m inside previous casing
 const annVol=(a,b)=>{let v=0;const lo=Math.min(a,b),hi=Math.max(a,b);v+=Math.max(0,Math.min(hi,prev)-lo)*capCH*(lo<prev?1:0);v+=Math.max(0,hi-Math.max(lo,prev))*capOH;return v};
 const Vtail=annVol(tailTop,shoe)+capC*SHOETRACK,Vlead=annVol(leadTop,tailTop),Vsp=8,Vdisp=capC*fc,Vc=capC*shoe;
 const seq=[['spacer',Vsp],['lead',Vlead],['tail',Vtail],['disp',Vdisp]];let c=0;const cum=seq.map(([k,v])=>{c+=v;return [k,c]});
 return {w,P,shoe,prev,fc,capC,capOH,capCH,Vc,annVol,seq,cum,Vend:c,tailTop,leadTop,Dh,Dc,shoeTVD:w.tvd(shoe),T:c/RATE}}
export function fluidAt(C,pumped){if(pumped<0)return 'mud';for(const [k,v] of C.cum)if(pumped<v)return k;return 'disp'}
// path coordinate -> {where, md}
function annX(C,md){return C.Vc+C.annVol(md,C.shoe)}
export function stateAt(C,V){V=Math.max(0,Math.min(C.Vend,V));const N=180,w=C.w;let hC=0,hA=0;const cs=[],an=[];
 for(let i=0;i<N;i++){const m0=C.shoe*i/N,m1=C.shoe*(i+1)/N,mm=(m0+m1)/2,dT=w.tvd(m1)-w.tvd(m0);
  const fc=fluidAt(C,V-C.capC*mm),fa=fluidAt(C,V-annX(C,mm));hC+=FL[fc].sg*dT;hA+=FL[fa].sg*dT;cs.push(fc);an.push(fa)}
 const ph=V<C.cum[0][1]?'spacer':V<C.cum[1][1]?'lead':V<C.cum[2][1]?'tail':V<C.Vend-1e-6?'displace':'bumped';
 const fric=ph=='bumped'?0:1100*(1+C.Vend/200)*0.4;// kPa, simplified annular+pipe friction at 0.8 m³/min
 const dU=(hA-hC)*G;// kPa U-tube: annulus heavier → pump pressure needed
 let pump=Math.max(0,dU+fric);const freefall=dU+fric<0;if(ph=='bumped')pump=Math.max(0,dU)+3500;
 const ecd=(hA*G+fric*0.6)/(G*C.shoeTVD),lift=dU;const cementTop=(()=>{for(let i=0;i<N;i++)if(an[i]=='lead'||an[i]=='tail')return C.shoe*i/N;return null})();
 return {V,ph,pump,dU:lift,freefall,ecd,hydShoe:hA*G,cs,an,cementTop,disp:Math.max(0,V-C.cum[2][1]),pct:V/C.Vend,msg:ph=='bumped'?'Plug bumped: +3.5 MPa over final circulating pressure · floats holding · WOC':freefall?'U-tube / free-fall: heavier fluid in casing, returns exceed pump rate':ph=='displace'?'Top plug released · displacing with mud':(FL[ph]?.n||ph)+' pumping · bottom plug ahead'}}
const f0=x=>Math.round(x).toLocaleString('en-AU');
export async function open(){const C=plan();document.getElementById('cem')?.remove();const S=document.createElement('section');S.id='cem';
 S.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#05080d;color:#e6eef8;font:13px system-ui;overflow:auto';
 S.innerHTML=`<div style="padding:10px 12px"><b style="font-size:17px">Primary cementing · 9-5/8" intermediate</b> <span class=cemtag style="background:#c9a227;color:#111;border-radius:5px;padding:1px 7px;font-weight:700">SIM</span>
 <button id=cem3 style="float:right;margin-left:6px;background:#223;color:#fff;border:1px solid #445;border-radius:6px;padding:4px 10px">3D + drill out + FIT</button><button id=cemx style="float:right;background:#223;color:#fff;border:1px solid #445;border-radius:6px;padding:4px 10px">✕</button><div style="opacity:.7;font-size:12px">SIM proposal A · simplified U-tube hydrostatics + constant friction · teaching model, not a cement job design</div></div>
 <div id=cemwrap style="display:flex;flex-wrap:wrap;gap:10px;padding:0 12px 12px"><canvas id=cemsch width=300 height=560 style="background:#0b1118;border-radius:10px;width:300px;max-width:100%"></canvas>
 <div style="flex:1;min-width:280px"><div id=cemhud style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:#0d1620;border:1px solid #233;border-radius:10px;padding:10px"></div>
 <div id=cemmsg style="margin:8px 0;padding:8px;border-left:3px solid #c9a227;background:#121c26"></div><canvas id=cemp width=560 height=220 style="width:100%;background:#0b1118;border-radius:10px"></canvas>
 <div id=cemleg style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px">${Object.values(FL).map(f=>`<span><i style="display:inline-block;width:12px;height:12px;background:${f.c};border-radius:3px"></i> ${f.n} ${f.sg.toFixed(2)} SG</span>`).join('')}</div>
 <table id=cemvol style="margin-top:8px;border-collapse:collapse">${C.seq.map(([k,v])=>`<tr><td style="padding:2px 8px">${FL[k].n}</td><td style="text-align:right;padding:2px 8px">${v.toFixed(1)} m³</td></tr>`).join('')}<tr><td style="padding:2px 8px;opacity:.7">Open-hole excess</td><td style="text-align:right;padding:2px 8px">${EXCESS*100}%</td></tr></table></div></div>`;
 document.body.appendChild(S);const hist=[];let t0=performance.now(),seekV=null,alive=true;const sp=+new URLSearchParams(location.search).get('speed')||1;
 const api={C,stateAt:V=>stateAt(C,V),get V(){return seekV??Math.min(C.Vend,(performance.now()-t0)/1000*C.Vend/40*sp)},seek(v){seekV=v},close(){alive=false;S.remove()},last:null,hist};window.dwCem=api;S.querySelector('#cemx').onclick=api.close;S.querySelector('#cem3').onclick=()=>{api.close();import('./cem3d.js?v=513').then(m=>m.open())};
 const sch=S.querySelector('#cemsch'),x=sch.getContext('2d'),pc=S.querySelector('#cemp'),y=pc.getContext('2d');
 const frame=()=>{if(!alive)return;const s=stateAt(C,api.V);api.last=s;if(!hist.length||hist.at(-1).V<s.V-0.2||s.V<hist.at(-1).V){if(hist.length&&s.V<hist.at(-1).V)hist.length=0;hist.push({V:s.V,p:s.pump,e:s.ecd})}
  x.clearRect(0,0,300,560);const top=30,H=500,N=s.cs.length,cx=150,wO=C.Dh/C.Dh*90,wC=56,wP=74,ys=i=>top+H*i/N,yP=top+H*C.prev/C.shoe;
  x.fillStyle='#3a2c1c';x.fillRect(cx-wO,yP,wO*2,H-(yP-top));x.fillStyle='#555d66';x.fillRect(cx-wP-4,top,8,yP-top);x.fillRect(cx+wP-4,top,8,yP-top);
  for(let i=0;i<N;i++){const a=FL[s.an[i]].c,c=FL[s.cs[i]].c,y0=ys(i),h=H/N+0.6,ww=(i/N*C.shoe<C.prev?wP-4:wO);x.fillStyle=a;x.fillRect(cx-ww,y0,ww-wC,h);x.fillRect(cx+wC,y0,ww-wC,h);x.fillStyle=c;x.fillRect(cx-wC+5,y0,2*wC-10,h)}
  x.fillStyle='#9aa7b4';x.fillRect(cx-wC,top,5,H);x.fillRect(cx+wC-5,top,5,H);const yfc=top+H*C.fc/C.shoe;x.fillStyle='#ff9f43';x.fillRect(cx-wC+5,yfc-3,2*wC-10,6);x.fillRect(cx-wC-6,top+H-8,2*wC+12,8);
  x.fillStyle='#cfd8e3';x.font='11px system-ui';x.fillText('0 m',4,top+4);x.fillText(f0(C.prev)+' m 13-3/8" shoe',4,yP-3);x.fillText('FC '+f0(C.fc),cx+wC+4,yfc-4);x.fillText(f0(C.shoe)+' m MD',4,top+H+16);
  if(s.cementTop!=null){const yt=top+H*s.cementTop/C.shoe;x.strokeStyle='#ffd54f';x.setLineDash([4,3]);x.beginPath();x.moveTo(cx-100,yt);x.lineTo(cx+100,yt);x.stroke();x.setLineDash([]);x.fillStyle='#ffd54f';x.fillText('TOC '+f0(s.cementTop)+' m',cx+wO-70,yt-3)}
  const ok=s.ecd<FRAC;S.querySelector('#cemhud').innerHTML=[['Pumped',`${s.V.toFixed(1)} / ${C.Vend.toFixed(1)} m³`],['Stage',s.ph],['Pump pressure',`${(s.pump/1000).toFixed(2)} MPa`],['ECD at shoe',`<span style="color:${ok?'#3ddc84':'#ff6b6b'}">${s.ecd.toFixed(2)}</span> / ${FRAC} SG frac`],['Displaced',`${s.disp.toFixed(1)} / ${C.seq[3][1].toFixed(1)} m³`],['Top of cement',s.cementTop==null?'–':f0(s.cementTop)+' m MD'],['Rate','0.8 m³/min'],['Shoe TVD',f0(C.shoeTVD)+' m'],['U-tube Δp',`${(s.dU/1000).toFixed(2)} MPa`]]
   .map(([a,b])=>`<div><div style="opacity:.65;font-size:11px">${a}</div><b>${b}</b></div>`).join('');S.querySelector('#cemmsg').textContent=s.msg;
  y.clearRect(0,0,560,220);const pm=Math.max(8,...hist.map(h=>h.p/1000))*1.1;y.strokeStyle='#2a3a4a';y.strokeRect(40,10,510,180);y.fillStyle='#9ab';y.font='11px system-ui';y.fillText('Pump pressure (MPa) vs volume pumped (m³) · SIM',44,24);y.fillText(pm.toFixed(0),4,16);y.fillText('0',24,190);y.fillText(C.Vend.toFixed(0)+' m³',510,206);
  y.strokeStyle='#ffb74d';y.lineWidth=2;y.beginPath();hist.forEach((h,i)=>{const X=40+510*h.V/C.Vend,Y=190-180*h.p/1000/pm;i?y.lineTo(X,Y):y.moveTo(X,Y)});y.stroke();
  requestAnimationFrame(frame)};frame();return api}
if(typeof location!='undefined'&&new URLSearchParams(location.search).get('demo')=='cement')open();
