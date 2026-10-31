// nolive_ui_test.mjs: rig builder + showroom UI text must never say LIVE (all data there is SIM). Static scan, no network.
// node nolive_ui_test.mjs  -> PASS/FAIL lines, exit 1 on any FAIL.
import fs from 'fs';
const files=fs.readdirSync('.').filter(f=>/^(rigbuilder|showroom|srpick|srassets|srperf)[\w]*\.js$/.test(f));
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`\\])\/\/[^\n]*/g,'$1');
for(const f of files){const s=strip(fs.readFileSync(f,'utf8'));const lits=s.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)||[];
 const bad=lits.filter(l=>/\b(LIVE|Live)\b/.test(l.replace(/<[^>]*>/g,' ')));ok(!bad.length,f+': no LIVE in UI text'+(bad.length?' -> '+bad.map(b=>b.slice(0,60)).join(' | '):''));}
ok(files.includes('rigbuilder.js')&&files.some(f=>f.startsWith('showroom')),'scanned rig builder + showroom files ('+files.length+')');
const rb=fs.readFileSync('rigbuilder.js','utf8');ok(rb.includes('BOM (updates as you edit) · <span id=rbBomN>')&&rb.includes("' LINES'"),'BOM header reads "BOM (updates as you edit) · N LINES"');
// self-check: the scanner catches the old header
ok(/\b(LIVE|Live)\b/.test('<h4>Live BOM · <span id=rbBomN></span></h4>'),'scanner catches the old "Live BOM" header');
process.exit(fail?1:0);
