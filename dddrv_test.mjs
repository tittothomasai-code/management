// dddrv_test: unit checks in node + module load in the page (no shared files). Run: node dddrv_test.mjs [base]
import * as M from './dddrv.js';import puppeteer from 'puppeteer-core';
let P=0,F=0;const ok=(c,m)=>{c?P++:F++;console.log((c?'PASS ':'FAIL ')+m)};
ok(M.parse('Slide 10 m at TF 30').cmd=='slide'&&M.parse('Slide 10 m at TF 30').tf==30,'parse slide');
ok(Math.abs(M.parse('slide 30 ft high side').len-9.144)<1e-6&&M.parse('slide 30 ft high side').tf==0,'parse ft + high side');
ok(M.parse('rotate 20 m').len==20,'parse rotate');ok(M.parse('take survey').cmd=='survey','parse survey');ok(M.parse('WOB 10').v==10,'parse wob');ok(M.parse('hello')==null,'reject unknown');
ok(!M.validate(M.parse('slide 10 m'),null).ok,'slide needs TF');ok(!M.validate(M.parse('rotate 90 m'),null).ok,'length limit');
ok(M.readback(M.parse('Slide 10 m at TF 30'))=='Copy. Slide 10 m at toolface 30 deg.','read-back STE');
let s=M.newState({inc:10,azi:90});let r=M.execute(s,M.parse('slide 10 m tf 0'));
ok(r.ok&&r.say[0].startsWith('Driller: Copy')&&r.say.length>=3,'driller acknowledges then executes');ok(s.inc>10.8&&s.md==510,'slide high side builds inc '+s.inc.toFixed(2));
ok(r.score.score>=60&&r.src=='SIM'&&r.score.src=='SIM','scored + SIM '+r.score.score);
s=M.newState({inc:10,azi:90});M.execute(s,M.parse('slide 10 m tf 90'));ok(s.azi>91,'TF 90 turns right '+s.azi.toFixed(1));
s=M.newState({inc:30,azi:0});M.execute(s,M.parse('rotate 20 m'));ok(Math.abs(s.inc-30)<1,'rotate holds inc');
const sv=M.execute(s,{cmd:'survey'});ok(sv.survey.md==520&&sv.survey.src=='SIM','survey');
M.execute(s,{cmd:'wob',v:20});r=M.execute(s,M.parse('slide 5 m tf 0'));ok(r.stall&&r.drilled==0,'stall at high WOB');ok(!M.execute(s,M.parse('rotate 5 m')).ok,'blocked while stalled');
M.execute(s,{cmd:'pickup'});M.execute(s,{cmd:'wob',v:8});ok(M.execute(s,M.parse('rotate 5 m')).ok,'recover after pickup');
ok(M.total(s).orders>=1,'total');
// hook into a cabin stub (GX.ddcab.onInstruction)
let got=null;globalThis.GX={ddcab:{onInstruction:f=>got=f},ddmotor:{state:()=>({dP:20,stall:false,yieldDls:3,src:'SIM'})}};ok(M.attach()===true&&typeof got=='function','registers on GX.ddcab.onInstruction');
const st2=M.newState({inc:0});const hr=got({text:'slide 10 m at tf 0',state:st2});ok(hr.ok&&st2.inc>0.5&&st2.inc<1.6,'uses GX.ddmotor yield '+st2.inc.toFixed(2));delete globalThis.GX;
const BASE=(process.argv[2]||'http://localhost:8799').replace(/\/$/,'');
const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await br.newPage();const E=[];p.on('pageerror',e=>E.push(String(e)));await p.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:60000});
 const o=await p.evaluate(async()=>{const m=await import('./dddrv.js');const s=m.newState();return m.execute(s,m.parse('Slide 6 m at TF 45')).say});
 ok(o.length>=3&&o[0].includes('toolface 45'),'loads in page');await new Promise(r=>setTimeout(r,1500));ok(!E.some(e=>/dddrv/.test(e)),'no page errors from dddrv')}finally{await br.close()}
console.log(`dddrv_test ${P}/${F}`);process.exit(F?1:0);
