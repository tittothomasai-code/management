// SIM-TEST local fixture (synthetic, never sent to any store): one well, 2 wellbores, real-time + historic time logs, depth MWD/FE/mud logs,
// trajectory and mudLog. Answers the dashboard's proxy JSON {op,wmlType,query,options}. Used only by wall_test.mjs.
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
export const T0=Date.parse('2026-11-01T00:00:00Z');let grow=0;
const iso=ms=>new Date(ms).toISOString();
// hole depth grows 1000 m -> 1300 m over 3 h (bit depth = hole depth while drilling)
const HD=t=>1000+Math.max(0,Math.min(300,(t-T0)/36000));
export const LOGS={
 WB1:[{uid:'RT1',name:'Realtime Time Log (SIM-TEST)',time:true,a:T0,e:()=>T0+3*3600e3+grow*10e3,step:10e3,c:[['DBTM','m',t=>HD(t)],['ROPA','m/h',t=>30+5*Math.sin(t/6e5)],['SPPA','kPa',()=>18000]]},
  {uid:'GT1',name:'General Time 2h (SIM-TEST)',time:true,a:T0,e:()=>T0+2*3600e3,step:60e3,c:[['HKLA','kN',()=>700],['DMEA','m',t=>HD(t)]]},
  {uid:'MWD1',name:'MWD Depth (SIM-TEST)',time:false,a:1000,e:()=>1290,step:0.5,c:[['GR','gAPI',d=>60+40*Math.sin(d/5)],['RESD','ohm.m',()=>12]]},
  {uid:'FE1',name:'FE Wireline (SIM-TEST)',time:false,a:1000,e:()=>1200,step:1,c:[['NPHI','v/v',()=>0.2],['RHOB','g/cm3',()=>2.4]]},
  {uid:'ML1',name:'Mud Log Gas (SIM-TEST)',time:false,a:1000,e:()=>1280,step:2,c:[['GASC1','ppm',d=>500+d%7]]}],
 WB2:[{uid:'ST1',name:'Sidetrack MWD (SIM-TEST)',time:false,a:900,e:()=>1100,step:1,c:[['GR','gAPI',()=>80]]}]};
const at=(q,a)=>(q.match(new RegExp('\\b'+a+'="([^"]*)"'))||[])[1]||'';
export const seen=[];
export function answer(j){seen.push(j);const q=j.query||'',t=j.wmlType;if(j.op=='WMLS_GetVersion')return {result:'1.4.1.1',version:'1.4.1.1'};
 if(t=='well')return {result:1,xml:`<wells ${NS}><well uid="W1"><name>SIM-TEST Well 1</name></well></wells>`};
 if(t=='wellbore')return {result:1,xml:`<wellbores ${NS}><wellbore uidWell="W1" uid="WB1"><name>Main (SIM-TEST)</name></wellbore><wellbore uidWell="W1" uid="WB2"><name>ST01 (SIM-TEST)</name></wellbore></wellbores>`};
 const wb=at(q,'uidWellbore');
 if(t=='trajectory')return {result:1,xml:`<trajectorys ${NS}>${wb=='WB1'?`<trajectory uidWell="W1" uidWellbore="WB1" uid="TR1"><name>Definitive Survey (SIM-TEST)</name>${[0,300,600,900,1200].map((m,i)=>`<trajectoryStation uid="s${i}"><md uom="m">${m}</md><tvd uom="m">${m*0.98}</tvd><incl uom="dega">${i*5}</incl><azi uom="dega">120</azi></trajectoryStation>`).join('')}</trajectory>`:''}</trajectorys>`};
 if(t=='mudLog')return {result:1,xml:`<mudLogs ${NS}>${wb=='WB1'?`<mudLog uidWell="W1" uidWellbore="WB1" uid="MUD1"><name>Mud Log (SIM-TEST)</name>${[1000,1050,1100].map((m,i)=>`<geologyInterval uid="g${i}"><mdTop uom="m">${m}</mdTop><mdBottom uom="m">${m+50}</mdBottom><ropAv uom="m/h">${20+i}</ropAv><lithology uid="l1"><type>Sandstone</type><lithPc uom="%">${60+i*10}</lithPc></lithology></geologyInterval>`).join('')}</mudLog>`:''}</mudLogs>`};
 if(t!='log')return {result:1,xml:''};
 const L=LOGS[wb]||[];const uid=at(q,'uid');
 if(!uid)return {result:1,xml:`<logs ${NS}>${L.map(l=>`<log uidWell="W1" uidWellbore="${wb}" uid="${l.uid}"><name>${l.name}</name><indexType>${l.time?'date time':'measured depth'}</indexType>${l.time?`<startDateTimeIndex>${iso(l.a)}</startDateTimeIndex><endDateTimeIndex>${iso(l.e())}</endDateTimeIndex>`:`<startIndex uom="m">${l.a}</startIndex><endIndex uom="m">${l.e()}</endIndex>`}<indexCurve>${l.time?'TIME':'DEPT'}</indexCurve>${[[l.time?'TIME':'DEPT',l.time?'s':'m'],...l.c].map(c=>`<logCurveInfo uid="${c[0]}"><mnemonic>${c[0]}</mnemonic><unit>${c[1]}</unit></logCurveInfo>`).join('')}</log>`).join('')}</logs>`};
 const l=L.find(x=>x.uid==uid);if(!l)return {result:1,xml:`<logs ${NS}/>`};
 let s=l.a;const sd=(q.match(/<startDateTimeIndex>([^<]+)/)||[])[1],si=(q.match(/<startIndex[^>]*>([^<]+)/)||[])[1];if(l.time&&sd)s=Math.max(l.a,Date.parse(sd));if(!l.time&&si)s=Math.max(l.a,+si);
 const rows=[];for(let x=Math.ceil((s-l.a)/l.step)*l.step+l.a;x<=l.e()&&rows.length<2000;x+=l.step)rows.push(`<data>${l.time?iso(x):x},${l.c.map(c=>+c[2](x).toFixed(3)).join(',')}</data>`);
 return {result:1,xml:`<logs ${NS}><log uidWell="W1" uidWellbore="${wb}" uid="${uid}"><logData><mnemonicList>${[l.time?'TIME':'DEPT',...l.c.map(c=>c[0])]}</mnemonicList><unitList>${[l.time?'s':'m',...l.c.map(c=>c[1])]}</unitList>${rows.join('')}</logData></log></logs>`}}
export const tick=()=>grow++;
