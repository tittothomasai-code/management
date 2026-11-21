export const rad=Math.PI/180,clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),lerp=(a,b,t)=>a+(b-a)*t;
export function earthPoint(lat,lon,r=1){const p=lat*rad,l=lon*rad;return [r*Math.cos(p)*Math.cos(l),r*Math.sin(p),-r*Math.cos(p)*Math.sin(l)];}
export function sunPosition(lat,lon,date){
 const d=(new Date(date).getTime()-Date.UTC(2000,0,1,12))/86400000;if(!Number.isFinite(d)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('Sun location and UTC time are required.');
 const g=(357.529+.98560028*d)*rad,q=(280.459+.98564736*d)*rad,L=q+1.915*rad*Math.sin(g)+.020*rad*Math.sin(2*g),eps=(23.439-.00000036*d)*rad;
 const ra=Math.atan2(Math.cos(eps)*Math.sin(L),Math.cos(L))/rad,dec=Math.asin(Math.sin(eps)*Math.sin(L)),gmst=(280.1600+360.9856235*d),H=(gmst+lon-ra)*rad,phi=lat*rad;
 const east=-Math.cos(dec)*Math.sin(H),north=Math.cos(phi)*Math.sin(dec)-Math.sin(phi)*Math.cos(dec)*Math.cos(H),up=Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H);
 return {azimuth:(Math.atan2(east,north)/rad+360)%360,elevation:Math.asin(clamp(up,-1,1))/rad,east,north,up};
}
export function sunVector(azimuth=120,elevation=42){const a=azimuth*rad,e=elevation*rad;return [Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)];}
export function worldSun(lat,lon,az=120,el=42){const l=lon*rad,p=lat*rad,[e,u,s]=sunVector(az,el),n=-s;return [-e*Math.sin(l)-n*Math.sin(p)*Math.cos(l)+u*Math.cos(p)*Math.cos(l),n*Math.cos(p)+u*Math.sin(p),-e*Math.cos(l)+n*Math.sin(p)*Math.sin(l)-u*Math.cos(p)*Math.sin(l)];}
export function sameScope(a,b){return ['account_id','server_id','well_uid','wellbore_uid'].every(k=>typeof a?.[k]==='string'&&a[k]===b?.[k]);}
export function fieldFor(p,c){
 if(p?.schema!=='robotyx-dd-field/1'||p.operational_use!==false||p.scope?.well_uid!==c.wellUid||p.scope.wellbore_uid!==c.wellboreUid||c.serverId&&p.scope.server_id!==c.serverId||!p.scope.account_id)throw Error('Field identity does not match this source.');
 if(!['lat','lon','e','n','rkb_elevation_m'].every(k=>Number.isFinite(p.location?.[k]))||Math.abs(p.location.lat)>90||Math.abs(p.location.lon)>180||!/^EPSG:\d+$/.test(p.location.crs))throw Error('The well location is not supported.');
 if(!Array.isArray(p.branches)||p.branches.length>4000||!Array.isArray(p.current?.plans)||p.current.plans.length>8)throw Error('Field geometry exceeds the display budget.');
 if(p.branches.some(b=>!b.key||!b.well_id||![b.e,b.n].every(Number.isFinite)||b.crs!==p.location.crs||!['ACTUAL','PLANNED'].includes(b.phase)||b.live!==false))throw Error('Field sources need review.');
 if(p.current.plans.some(p=>p.kind!=='plan'||p.actual_bore_association!==false||!Array.isArray(p.points)||p.points.length>5000||p.points.some(q=>!['md','tvd','e','n'].every(k=>Number.isFinite(q[k])))))throw Error('The filed reference plan needs review.');
 if(p.detail&&(!Array.isArray(p.detail.points)||p.detail.points.length>20000||p.detail.points.some(q=>!['md','tvd','e','n'].every(k=>Number.isFinite(q[k]))||typeof q.projected_to_bit!=='boolean')))throw Error('The source path needs review.');
 return p;
}
export function groupWells(branches){const by=new Map();for(const b of branches){const key=JSON.stringify([b.well_id,Math.round(b.e*100),Math.round(b.n*100)]);let w=by.get(key);if(!w){w={key,well_id:b.well_id,name:b.well_name||b.name,e:b.e,n:b.n,branches:[]};by.set(key,w);}w.branches.push(b);}return [...by.values()];}
export function pathBounds(plans){const pts=plans.flatMap(p=>p.points||[]),min=[0,0,0],max=[0,0,0];for(const p of pts){const v=[p.e,-p.tvd,-p.n];for(let i=0;i<3;i++){min[i]=Math.min(min[i],v[i]);max[i]=Math.max(max[i],v[i]);}}return {center:min.map((v,i)=>(v+max[i])/2),radius:Math.max(100,Math.hypot(...max.map((v,i)=>v-min[i]))*.55)};}
