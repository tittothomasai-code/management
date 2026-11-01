// v5.12.12 WITSML dashboard pure-logic tests (node wdash_unit_test.mjs)
import * as K from './wdash_core.js';import fs from 'fs';let f=0,p=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);c?p++:f++};
const x=`<logs xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><log uidWell="W" uidWellbore="B" uid="L1"><name>Depth &amp; MWD</name><indexType>measured depth</indexType><indexCurve>DEPT</indexCurve>
<logCurveInfo uid="DEPT"><mnemonic>DEPT</mnemonic><unit>m</unit></logCurveInfo><logCurveInfo uid="ROPA"><mnemonic>ROPA</mnemonic><unit>m/h</unit></logCurveInfo><logCurveInfo uid="GR"><mnemonic>GR</mnemonic><unit>gAPI</unit></logCurveInfo>
<logCurveInfo uid="IMG"><mnemonic>IMG</mnemonic><unit>gAPI</unit><axisDefinition uid="a"><order>1</order><count>8</count></axisDefinition></logCurveInfo>
<logData><mnemonicList>DEPT,ROPA,GR,IMG</mnemonicList><unitList>m,m/h,gAPI,gAPI</unitList><data>1000.0,20.5,80,1 2 3 4 5 6 7 8</data><data>1000.1,21,,8 7 6 5 4 3 2 1</data></logData></log></logs>`;
const L=K.parseLogs(x)[0];ok(L.name=='Depth & MWD'&&!L.time&&L.rows.length==2,'parse depth log header + 2 rows');ok(L.curves.find(c=>c.mn=='IMG').array==8,'axisDefinition count = 8');
ok(Array.isArray(L.rows[0][3])&&L.rows[0][3].length==8&&Number.isNaN(L.rows[1][2]),'array cell -> 8 numbers; empty cell -> NaN');
const im=K.findImages(L.ml,L.rows);ok(im.length==1&&im[0].kind=='array'&&im[0].n==8,'array image curve detected');
const t=K.parseLogs(`<logs><log uid="T"><indexType>date time</indexType><logData><mnemonicList>TIME,SPPA</mnemonicList><data>2026-11-01T07:00:00.000Z,2800</data></logData></log></logs>`)[0];
ok(t.time&&t.rows[0][0]==Date.parse('2026-11-01T07:00:00Z'),'time index parsed to ms');
const std=K.findStd(['DEPT','ROPA','SWOB','RPMA','TQA','SPPA','MFIA','GR','RESD']);ok(Object.keys(std).length==8,'all 8 standard curves found: '+Object.keys(std).join(','));
ok(K.findStd(['TIME','HKLA','BPOS']).GR===undefined,'no false GR match');
const s=K.findImages(K.SIM_ML,K.simSeries(1500,1501));ok(s.length==2&&s.every(i=>i.kind=='sectors'&&i.n==16),'SIM: GRIM + RIMG 16-sector families');
ok(K.findImages(['DEPT','ROPA','GR','RESD','SPPA'],[[1,2,3,4,5]]).length==0,'no array curves -> no image (handled)');
const st={};ok(K.appendRows(st,['D','A'],[[1,5],[2,6]])==2&&K.appendRows(st,['D','A','B'],[[2,6,0],[3,7,9]])==1&&st.rows.length==3&&st.ml.length==3&&Number.isNaN(st.rows[0][2]),'append-only merge, new curve column back-filled NaN, duplicate index dropped');
const th=[...Array(16)].map((_,k)=>(k+.5)/16*2*Math.PI),z=th.map(a=>1000+0.1*Math.cos(a-Math.PI/2));const fs1=K.fitSine(th,z,0.216);
ok(Math.abs(fs1.z0-1000)<1e-9&&Math.abs(fs1.amp-0.1)<1e-9&&Math.abs(fs1.az-90)<1e-6&&Math.abs(fs1.dip-Math.atan(0.2/0.216)*180/Math.PI)<1e-6,'sinusoid fit: z0, amplitude, azimuth 90°, dip '+fs1.dip.toFixed(1)+'°');
const r=K.simSeries(1500,1540,0.05),im2=K.findImages(K.SIM_ML,r)[0],sn=K.autoSines(r.map(x=>x[0]),r.map(x=>K.imgRow(x,im2)));ok(sn.length>=3&&sn.every(q=>q.dip>=0&&q.dip<90),'SIM auto sinusoids found: '+sn.length);
ok(K.cmap(0).join()=='20,10,0'&&K.cmap(1).join()=='255,235,170','colour map ends');
ok(K.redact('err for bob with hunter2 Basic Ym9iOmh1bnRlcjI=',['bob','hunter2'])=='err for *** with *** Basic ***','redact user/pass/basic');
const sv=K.soapResult(`<soap:Envelope><soap:Body><r><Result>1</Result><XMLout>&lt;wells/&gt;</XMLout><SuppMsgOut>x</SuppMsgOut></r></soap:Body></soap:Envelope>`);ok(sv.result==1&&sv.xml=='<wells/>','SOAP result parse');
ok(/WMLS_GetFromStore/.test(K.soapEnvelope('WMLS_GetFromStore',{wmlType:'log',query:'<logs/>'}))&&/&lt;logs\/&gt;/.test(K.soapEnvelope('WMLS_GetFromStore',{wmlType:'log',query:'<logs/>'})),'SOAP envelope escapes query');
const src=fs.readFileSync(new URL('./wdash.js',import.meta.url),'utf8')+fs.readFileSync(new URL('./wdash_core.js',import.meta.url),'utf8');
ok(!/sessionStorage|document\.cookie|indexedDB|console\.(log|info|warn|error)/.test(src)&&(src.match(/localStorage\.setItem\([^;]*/g)||[]).every(x=>!/pass|user|CRED/.test(x)),'only non-secret settings go to localStorage; no other storage / console use (credentials cannot persist or be logged)');
ok(!/\bLIVE\b/.test(src.match(/simInit[\s\S]*?simTick/)[0]),'SIM generator never says LIVE');
console.log(`\n${p} passed, ${f} failed`);process.exit(f?1:0)
