// v5.12.15 resolve(): synthetic models only (made-up positions, not customer data)
import {resolve,fwd,inv} from './edmgeo.js';let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
const E0=612345,N0=7012345,q0=inv(E0,N0,55,true);
const site=(id,E,N,o={})=>({id,name:id,E,N,lat:null,lon:null,mapE:null,mapN:null,...o});
// 1. old save (pre-v5.12.4): geo + origin, no crs
let W={geo:true,origin:{lat:-26.5,lon:150.2},sites:[site('A',0,0)],wells:[{lat:-26.5}],projects:[]};let P=resolve(W);ok(P.ok&&P.kind=='latlon','old save without crs uses lat/long origin');
// 2. site map E/N only + EPSG zone
W={geo:false,sites:[site('A',0,0,{mapE:E0,mapN:N0}),site('B',1000,500,{mapE:E0+1000,mapN:N0+500})],wells:[],projects:[{zone:'EPSG:28355'}]};P=resolve(W);
const [la,lo]=P.ll(1000,500),b=fwd(la,lo,55,true);ok(P.ok&&P.kind=='grid'&&Math.hypot(b.E-E0-1000,b.N-N0-500)<0.01,'site map E/N + EPSG:28355 → exact grid ('+P.label+')');
const [e2,n2]=P.en(la,lo);ok(Math.abs(e2-1000)<0.01&&Math.abs(n2-500)<0.01,'grid en() round trip');
// 3. map E/N, unknown zone → not ok, names fields, user picks zone
W.projects=[{zone:'XYZ'}];P=resolve(W);ok(!P.ok&&P.canZone&&P.missing.some(x=>/geo_zone_id = "XYZ"/.test(x))&&P.have.some(x=>/geo_map_easting/.test(x)),'unknown zone → missing list: '+P.missing.join(' | '));
P=resolve(W,{kind:'zone',zone:55,south:true});ok(P.ok&&P.kind=='grid','user zone 55S placement');
// 4. local only → manual lat/long
W={geo:false,sites:[site('A',0,0),site('B',200,100)],wells:[],projects:[]};P=resolve(W);ok(!P.ok&&!P.canZone&&P.missing.length==4,'local only → 4 missing fields');
P=resolve(W,{kind:'ll',site:'B',lat:-27,lon:151});const [la3,lo3]=P.ll(200,100);ok(P.ok&&Math.abs(la3+27)<1e-9&&Math.abs(lo3-151)<1e-9,'manual: chosen site lands at typed lat/long');
process.exit(f?1:0)
