// ROP vs mud weight/type (SIM). Pure model checks, no browser.
import {ropMudFactor} from './ropmud.js';import * as PH from './physics.js';
let f=0,p=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?p++:f++};
const a=ropMudFactor(9,8000,'WBM',9),b=ropMudFactor(11,8000,'WBM',9),c=ropMudFactor(11,8000,'OBM',9);
ok(Math.abs(a-1)<1e-9,'balanced mud: factor 1');ok(b<a,'heavier mud slows ROP '+b.toFixed(3));ok(c>b,'OBM faster than WBM '+c.toFixed(3));
ok(ropMudFactor(20,20000,'WBM',9)>=0.3,'factor floor 0.3');ok(ropMudFactor(10,0)==1,'surface: factor 1');
ok(ropMudFactor(10,8000,'WBM',undefined,10)==1,'default mud = calibration: factor 1');ok(ropMudFactor(12,8000,'WBM',undefined,10)<1,'mud heavier than default slows ROP');ok(/ropMudFactor/.test(PH.step.toString()),'physics.step uses mud factor');
console.log(`ropmud ${p}/${f}`);process.exit(f?1:0)
