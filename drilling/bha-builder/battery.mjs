// Rated life is a user setting, not a telemetry measurement or an energy capacity.
export const MWD_BATTERY_RATED_HOURS=100;
export function newMwdBattery(){return {id:globalThis.crypto.randomUUID(),serial:'',rated_hours:MWD_BATTERY_RATED_HOURS,baseline_capacity_used_pct:null,powered_hours_since_baseline:null,installed_confirmed:false};}
export function validateMwdBatteries(packs){
 if(!Array.isArray(packs)||packs.length>8)throw Error('Use up to eight MWD battery records.');const ids=new Set();
 for(const p of packs){if(!p||typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||typeof p.serial!=='string'||p.serial.length>100||p.rated_hours!==100)throw Error('Each MWD battery needs a unique ID, serial text and a 100-hour rating.');ids.add(p.id);for(const [k,max]of [['baseline_capacity_used_pct',100],['powered_hours_since_baseline',100000]])if(p[k]!==null&&(!Number.isFinite(p[k])||p[k]<0||p[k]>max))throw Error('Enter valid battery usage. A blank value means unknown.');}
 return packs;
}
export function batteryLife(pack){
 validateMwdBatteries([pack]);const pct=pack.baseline_capacity_used_pct,hours=pack.powered_hours_since_baseline,baseline=pct===null?null:pack.rated_hours*(1-pct/100),raw=baseline===null||hours===null?null:baseline-hours;
 return {rated_hours:pack.rated_hours,baseline_remaining_hours:baseline,remaining_hours:raw===null?null:Math.max(0,raw),overrun_hours:raw===null?null:Math.max(0,-raw),status:raw===null?'unknown':raw<=0?'exhausted':raw<=20?'low':'estimated',method:'100-hour rating × unused baseline fraction − recorded powered hours; estimate only'};
}
