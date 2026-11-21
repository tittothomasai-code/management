// Source dimensions remain separate from render-only illustrations.
export function sourceTools(design){
 if(!design||design.as_run_confirmed!==false||!Array.isArray(design.components)||design.components.length>32||!design.components.length||!/^[a-f0-9]{64}$/.test(design.source?.sha256||''))throw Error('Use a verified source design.');
 let from=0;return design.components.map((c,i)=>{
  if(!Number.isFinite(c.length_m)||c.length_m<=0||c.length_m>100)throw Error('Invalid source length.');
  const name=String(c.name||''),kind=/pdc/i.test(name)?'pdc-bit':/dhm|motor/i.test(name)?'motor':/near.bit/i.test(name)?'near-bit':/ubho/i.test(name)?'ubho':/nmdc|collar/i.test(name)?'nmdc':/gap/i.test(name)?'gap-sub':/safety/i.test(name)?'safety':/x.over|x\/o|crossover/i.test(name)?'crossover':/hwdp/i.test(name)?'hwdp':'drill-pipe';
  const od=Number.isFinite(c.od_in)&&c.od_in>0&&c.od_in<=36?c.od_in:null,id=Number.isFinite(c.id_in)&&c.id_in>=0?c.id_in:null,at=from;from+=c.length_m;
  // No substitute OD is shown when its source cell is blank.
  return {source:c,from_m:at,to_m:from,render:od===null?null:{uid:'source-'+i,name,kind,type:kind==='pdc-bit'?'Bit':kind==='motor'?'Motor':'Sub',lengthM:c.length_m,odIn:od,idIn:id!==null&&id<od?id:0},unknown_bore:id===null};
 });
}
