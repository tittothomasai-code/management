// v5.12.4 EDM map + ground: coordinate conversion and free XYZ map tiles for the EDM sites scene.
// Tile layers copied from the-dome src/gis.js initMap() (Satellite = Esri World Imagery, Street = OpenStreetMap). No key, no account, no cost.
// EDM data stays on the device; only tile image requests (z/x/y) leave it.
// UTM: Krueger series (GRS80/WGS84; GDA2020/GDA94 differ from WGS84 by < 2 m).

const a=6378137,f=1/298.257222101,k0=0.9996,n=f/(2-f),A=a/(1+n)*(1+n*n/4+n**4/64);
const al=[n/2-2*n*n/3+5*n**3/16,13*n*n/48-3*n**3/5,61*n**3/240],be=[n/2-2*n*n/3+37*n**3/96,n*n/48+n**3/15,17*n**3/480],de=[2*n-2*n*n/3-2*n**3,7*n*n/3-8*n**3/5,56*n**3/15];
const r=Math.PI/180;
export function fwd(lat,lon,zone,south){const l0=((zone-1)*6-180+3)*r,phi=lat*r,lam=lon*r-l0,e=2*Math.sqrt(n)/(1+n);
 const t=Math.sinh(Math.atanh(Math.sin(phi))-e*Math.atanh(e*Math.sin(phi))),xi=Math.atan(t/Math.cos(lam)),eta=Math.atanh(Math.sin(lam)/Math.sqrt(1+t*t));
 let E=eta,N=xi;for(let j=1;j<=3;j++){E+=al[j-1]*Math.cos(2*j*xi)*Math.sinh(2*j*eta);N+=al[j-1]*Math.sin(2*j*xi)*Math.cosh(2*j*eta)}
 return {E:500000+k0*A*E,N:(south?1e7:0)+k0*A*N}}
export function inv(E,N,zone,south){const xi=(N-(south?1e7:0))/(k0*A),eta=(E-500000)/(k0*A);let x=xi,y=eta;for(let j=1;j<=3;j++){x-=be[j-1]*Math.sin(2*j*xi)*Math.cosh(2*j*eta);y-=be[j-1]*Math.cos(2*j*xi)*Math.sinh(2*j*eta)}
 const chi=Math.asin(Math.sin(x)/Math.cosh(y));let phi=chi;for(let j=1;j<=3;j++)phi+=de[j-1]*Math.sin(2*j*chi);const l0=((zone-1)*6-180+3)*r;
 return {lat:phi/r,lon:(l0+Math.atan(Math.sinh(y)/Math.cos(x)))/r}}
// "UTM-55S", "UTM55S", "MGA2020 Zone 55", "GDA94 / MGA zone 56" → {zone,south}
export function parseZone(z,datum){if(!z)return null;const s=String(z).toUpperCase();let m=s.match(/UTM[^0-9]*(\d{1,2})\s*([NS])?/);if(m)return {zone:+m[1],south:m[2]?m[2]=='S':/SOUTH/.test(s)};
 m=s.match(/MGA[^0-9]*(?:ZONE\s*)?(\d{1,2})\b/)||(/MGA/.test(String(datum||'').toUpperCase())&&s.match(/(\d{1,2})/));if(m)return {zone:+m[1],south:true};return null}
export const LAYERS={sat:{name:'Satellite',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',max:19,attr:'Imagery © Esri, Maxar, Earthstar Geographics'},
 street:{name:'Street',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',max:19,attr:'© OpenStreetMap contributors'}};
/* Esri Satellite: commercial terms. Approved by CTO 31 Oct 2026; set false to switch it off. */
export const SAT_ENABLED=true;
export const ACTIVE=SAT_ENABLED?['sat','street']:['street'];
export const tileUrl=(k,z,x,y)=>LAYERS[k].url.replace('{z}',z).replace('{x}',x).replace('{y}',y);
// Web Mercator world pixel (256 px tiles) at zoom z
export function merc(lat,lon,z){const s=256*2**z,la=Math.max(-85.05,Math.min(85.05,lat))*r;return [(lon+180)/360*s,(1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*s]}
// zoom so that the lat/lon box fits in about maxPx pixels
export function pickZoom(la0,lo0,la1,lo1,maxPx=1536,zmax=18){for(let z=zmax;z>=1;z--){const a=merc(la1,lo0,z),b=merc(la0,lo1,z);if(Math.max(b[0]-a[0],b[1]-a[1])<=maxPx)return z}return 1}
// v5.12.15 EPSG codes too: 28349-28356 (GDA94 / MGA), 7849-7856 (GDA2020 / MGA), 326zz / 327zz (WGS84 UTM N/S), "Zone 55 S", "55S"
export function parseZone2(z,datum){if(z==null||z==='')return null;const s=String(z).toUpperCase();let m=s.match(/(?:EPSG[^0-9]*)?\b(2834[9]|2835[0-6]|78(?:49|5[0-6])|32[67]\d\d)\b/);
 if(m){const c=+m[1];if(c>=28349&&c<=28356)return {zone:c-28300,south:true};if(c>=7849&&c<=7856)return {zone:c-7800,south:true};const zz=c%100;if(zz>=1&&zz<=60)return {zone:zz,south:c>=32700}}
 const p=parseZone(z,datum);if(p)return p;m=s.match(/ZONE\s*(\d{1,2})\s*([NS])?\b/)||s.match(/^\s*(\d{1,2})\s*([NS])\s*$/);if(m&&+m[1]>=1&&+m[1]<=60)return {zone:+m[1],south:m[2]?m[2]=='S':true};return null}
// Where on Earth is this saved/imported model? Returns {ok,kind,label,ll(E,N)->[lat,lon],en(lat,lon)->[E,N]} or {ok:false,missing,have,canZone}.
// ov = user placement saved on the device: {kind:'zone',zone,south} | {kind:'ll',site,lat,lon}
export function resolve(W,ov){const S=W.sites||[],P=W.projects||[],nz=v=>v!=null&&Number.isFinite(+v)&&Math.abs(+v)>0.001;
 const s0=S.find(s=>s.mapE!=null&&s.mapN!=null),zn=P.map(p=>parseZone2(p.zone,p.datum)).find(Boolean)||null;
 const eq=(O,kind,label)=>{const c=Math.cos(O.lat*r);return {ok:true,kind,label,O,ll:(E,N)=>[O.lat+N/110574,O.lon+E/(111320*c)],en:(la,lo)=>[(lo-O.lon)*111320*c,(la-O.lat)*110574]}};
 const grid=(z,label)=>{const E0=s0.mapE,N0=s0.mapN,O=inv(E0,N0,z.zone,z.south);return {ok:true,kind:'grid',label,O,zone:z,ll:(E,N)=>{const q=inv(E0+E,N0+N,z.zone,z.south);return [q.lat,q.lon]},en:(la,lo)=>{const q=fwd(la,lo,z.zone,z.south);return [q.E-E0,q.N-N0]}}};
 const zl=z=>(z.zone>=49&&z.zone<=56&&z.south?'MGA / UTM zone ':'UTM zone ')+z.zone+(z.south?'S':'N');
 const geoOK=!!(W.geo&&W.origin&&nz(W.origin.lat));
 if(ov?.kind=='ll'&&nz(ov.lat)&&Number.isFinite(+ov.lon)){const s=S.find(x=>x.id==ov.site)||S[0]||{E:0,N:0};const la0=+ov.lat-(s.N||0)/110574,c=Math.cos(la0*r);return eq({lat:la0,lon:+ov.lon-(s.E||0)/(111320*c)},'manual','placed by you at '+(+ov.lat).toFixed(5)+', '+(+ov.lon).toFixed(5))}
 if(ov?.kind=='zone'&&s0&&!geoOK&&ov.zone>=1&&ov.zone<=60)return grid({zone:+ov.zone,south:!!ov.south},'map E/N in '+zl({zone:+ov.zone,south:!!ov.south})+' (set by you)');
 if(geoOK)return eq(W.origin,'latlon',W.crs?.fromMap?'map E/N converted from '+(W.crs.zone||'project zone'):'lat/long in file');
 if(s0&&zn)return grid(zn,'map E/N in '+zl(zn)+' (project zone)');
 const have=[],missing=[];const cnt=f=>S.filter(f).length;
 (cnt(s=>nz(s.lat))?have:missing).push('site lat/long (CD_SITE geo_latitude/geo_longitude)');
 ((W.wells||[]).some(w=>nz(w.lat))?have:missing).push('well lat/long (CD_WELL geo_latitude/geo_longitude)');
 (s0?have:missing).push('site map easting/northing (CD_SITE geo_map_easting/geo_map_northing)');
 (zn?have:missing).push('projected zone (CD_PROJECT geo_zone_id'+(P.find(p=>p.zone)?' = "'+P.find(p=>p.zone).zone+'" not recognised':'')+')');
 return {ok:false,missing,have,canZone:!!s0}}
