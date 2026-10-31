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
