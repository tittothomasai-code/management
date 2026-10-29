// v3.6 display units. Game physics stays imperial internally; this converts for display only.
// Metric (default): m, m/h, L/min, kPa, kN, kN·m, kW.  Imperial: ft, ft/h, gpm, psi, klbf, ft·lbf, hp.
(function(){
const KEY='dw-units';
// dimension -> {si: display metric label, imp: display imperial label, f: {normalized uom: factor to metric display unit}}
const D={
 len:{m:'m',i:'ft',f:{m:1,ft:0.3048,km:1000,in:0.0254}},
 vel:{m:'m/h',i:'ft/h',f:{'m/h':1,'ft/h':0.3048,'m/min':60,'m/s':3600}},
 prs:{m:'kPa',i:'psi',f:{kpa:1,psi:6.894757,bar:100,mpa:1000,pa:0.001}},
 flw:{m:'L/min',i:'gpm',f:{'l/min':1,lpm:1,gpm:3.785412,'galus/min':3.785412,'m3/min':1000,'m3/h':1000/60,'m3/s':60000,'bbl/min':158.9873}},
 frc:{m:'kN',i:'klbf',f:{kn:1,klbf:4.448222,klb:4.448222,klbs:4.448222,kip:4.448222,lbf:0.004448222,n:0.001,t:9.80665,tonne:9.80665,tonf:9.80665,kkgf:9.80665,kdan:10}},
 trq:{m:'kN·m',i:'ft·lbf',f:{'kn.m':1,'n.m':0.001,'ft.lbf':0.0013558179,ftlb:0.0013558179,ftlbf:0.0013558179,'lbf.ft':0.0013558179,'kft.lbf':1.3558179,'kftlb':1.3558179,'kn.m':1}},
 pow:{m:'kW',i:'hp',f:{kw:1,hp:0.7457,w:0.001}},
 den:{m:'kg/m³',i:'ppg',f:{'kg/m3':1,ppg:119.8264,sg:1000,'g/cm3':1000,'lbm/galus':119.8264}}};
const norm=u=>String(u||'').trim().toLowerCase().replace(/·/g,'.').replace(/³/g,'3').replace(/\s+/g,'').replace(/-/g,'.').replace(/hr$/,'h').replace(/^lbf\.ft$/,'lbf.ft').replace(/^m\/hr$/,'m/h');
function dim(u){const n=norm(u);if(!n)return null;for(const k in D){if(n in D[k].f)return[k,D[k].f[n]]}
 const n2=n.replace(/\./g,'');for(const k in D)for(const x in D[k].f)if(x.replace(/\./g,'')==n2)return[k,D[k].f[x]];return null}
let sys=localStorage.getItem(KEY)=='imperial'?'imperial':'metric';const L=[];
// factor from uom u to current display unit (sys)
const impF=k=>D[k].f[norm(D[k].i)];
const fac2=(u,s=sys)=>{const d=dim(u);if(!d)return 1;return s=='metric'?d[1]:d[1]/impF(d[0])};
const u_=(u,s=sys)=>{const d=dim(u);return d?(s=='metric'?D[d[0]].m:D[d[0]].i):(u||'')};
const v_=(u,v)=>v==null||v===''||!isFinite(+v)?v:(+v)*fac2(u);
// convert between any two known units of same dimension (used for WITSML -> game internal units)
const x_=(v,from,to)=>{const a=dim(from),b=dim(to);if(!a||!b||a[0]!=b[0])return v;return v*a[1]/b[1]};
const fmt=(x,dp)=>{if(!isFinite(x))return String(x);const a=Math.abs(x);const d=dp!=null?dp:(a>=100?0:a>=10?1:a>=1?2:3);return x.toFixed(d)};
const TOK=/(ppg|ft·lbf|ft-lbf|ft\.lbf|kft\.lbf|ft\/h|klbf|psi|gpm|hp|ft)\b/;
const RX=/(-?\d[\d,]*(?:\.\d+)?)(\s?)(ppg|ft·lbf|ft-lbf|ft\.lbf|ft\/h|klbf|psi|gpm|hp|ft)\b/g;
function txt(s){if(sys=='imperial'||s==null)return s;return String(s).replace(RX,(m,n,sp,u)=>{const v=+n.replace(/,/g,'');return fmt(v*fac2(u))+(sp||' ')+u_(u)})}
function lab(s){if(sys=='imperial'||s==null)return s;return String(s).replace(RX,m=>txt(m)).replace(new RegExp('(^|[\\s(])'+TOK.source,'g'),(m,p,u)=>p+u_(u))}
function val(label,v){if(sys=='imperial')return v;const m=String(label||'').match(TOK);if(!m)return txt(v);if(typeof v=='number')return fmt(v*fac2(m[1]));
 return String(v).replace(/-?\d[\d,]*(?:\.\d+)?/g,n=>{const x=+n.replace(/,/g,'');const dp=(n.split('.')[1]||'').length;return fmt(x*fac2(m[1]),fac2(m[1])<0.01?null:Math.max(dp,0))})}
function set(s){s=s=='imperial'?'imperial':'metric';if(s==sys)return;const old=sys;sys=s;localStorage.setItem(KEY,s);L.forEach(f=>{try{f(old,s)}catch(e){console.warn(e)}});btn()}
function btn(){const b=document.getElementById('units');if(b)b.textContent='Units: '+(sys=='metric'?'Metric':'Imperial')}
window.U={base:u=>{const d=dim(u);return d?D[d[0]].i:u},get sys(){return sys},set,toggle:()=>set(sys=='metric'?'imperial':'metric'),on:f=>L.push(f),u:u_,v:v_,x:x_,f:fac2,fmt,txt,lab,val,dim,norm};
const mk=()=>{const h=document.getElementById('hud');if(!h||document.getElementById('units'))return;const b=document.createElement('button');b.id='units';b.title='Display units (saved in this browser)';b.onclick=()=>U.toggle();h.appendChild(b);btn()};
if(document.readyState=='loading')document.addEventListener('DOMContentLoaded',mk);else mk();
})();
