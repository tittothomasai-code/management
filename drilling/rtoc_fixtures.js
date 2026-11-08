// rtoc_fixtures.js: SYNTHETIC TEST-ONLY WITSML 1.4.1.1 store for Steve's RTOC readiness tests. Loaded only with ?rtocfixture.
// Every well/wellbore/log name carries "TEST FIXTURE". All numbers are generated here; none come from a real well or store.
// Transport shape matches wwell.makeIO: call(op,type,query,options) -> {xml}.
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const T0=Date.parse('2026-11-07T08:00:00Z');
// [md,inc,azi] stations -> tvd by min-curvature (m)
function stations(list){const R=Math.PI/180;let tvd=0,out=[];for(let i=0;i<list.length;i++){const [md,inc,az]=list[i];if(i){const [m0,i0,a0]=list[i-1];const I1=i0*R,I2=inc*R,A1=a0*R,A2=az*R;const cb=Math.cos(I2-I1)-Math.sin(I1)*Math.sin(I2)*(1-Math.cos(A2-A1));const b=Math.acos(Math.max(-1,Math.min(1,cb)));const rf=b<1e-6?1:2/b*Math.tan(b/2);tvd+=(md-m0)/2*(Math.cos(I1)+Math.cos(I2))*rf}out.push([md,inc,az,tvd])}return out}
function prof(td,kop,bur,hold,az,step){const L=[];for(let md=0;md<=td;md+=step){const inc=md<=kop?0:Math.min(hold,(md-kop)*bur/30);L.push([md,inc,az])}return L}
function trajXml(well,wb,uid,name,st){return `<trajectory uidWell="${well}" uidWellbore="${wb}" uid="${uid}"><nameWell>${well}</nameWell><name>${name}</name>`+st.map((s,i)=>`<trajectoryStation uid="s${i}"><md uom="m">${s[0].toFixed(2)}</md><tvd uom="m">${s[3].toFixed(2)}</tvd><incl uom="dega">${s[1].toFixed(2)}</incl><azi uom="dega">${s[2].toFixed(2)}</azi></trajectoryStation>`).join('')+`</trajectory>`}
// time log: drilling with pumps-off connections (evidence: flow≈0, rpm≈0, bit lifted off bottom). Options: drop channels, sparse ROP, a missing interval.
const UN={TIME:'s',DBTM:'m',DMEA:'m',ROPA:'m/h',SWOB:'kN',TQA:'kN.m',RPMA:'rpm',SPPA:'kPa',TFLO:'L/min'};
function timeLog(well,wb,uid,name,{md0,joints,rate,slideEvery=3,drop=[],dt=10,t0=T0,sparseRop=0,gapAfter=-1,gapMs=0}){const mn=['TIME','DBTM','DMEA','ROPA','SWOB','TQA','RPMA','SPPA','TFLO'].filter(m=>!drop.includes(m));
 const rows=[];let t=t0,hole=md0,k=0;for(let j=0;j<joints.length;j++){const len=joints[j],sl=(j%slideEvery)==1;let d=0;if(j==gapAfter)t+=gapMs;
  while(d<len){const slide=sl&&d<len*0.45,rop=slide?rate*0.5:rate;d=Math.min(len,d+rop*dt/3600);hole=md0+joints.slice(0,j).reduce((a,b)=>a+b,0)+d;
   rows.push({t,bd:hole,hd:hole,rop:sparseRop&&(k%10)<sparseRop*10?NaN:rop,wob:slide?60:85+((k*7)%11),tq:slide?0.4:14+((k*3)%5),rpm:slide?0:120,spp:slide?17500:18200+((k*13)%300),q:2950});t+=dt*1000;k++}
  if(j<joints.length-1)for(let c=0;c<24;c++){rows.push({t,bd:hole-(c<4?c*0.6:c>20?(24-c)*0.6:2.4),hd:hole,rop:0,wob:0,tq:0,rpm:0,spp:c<3?9000:200,q:c<3?1200:0});t+=10000}}
 const val={DBTM:r=>r.bd.toFixed(2),DMEA:r=>r.hd.toFixed(2),ROPA:r=>Number.isFinite(r.rop)?r.rop.toFixed(1):'',SWOB:r=>r.wob.toFixed(1),TQA:r=>r.tq.toFixed(2),RPMA:r=>r.rpm.toFixed(0),SPPA:r=>r.spp.toFixed(0),TFLO:r=>r.q.toFixed(0)};
 return {uid,time:true,idx:rows.map(r=>r.t),ser:i=>[new Date(rows[i].t).toISOString(),...mn.slice(1).map(m=>val[m](rows[i]))].join(','),mn,un:mn.map(m=>UN[m]),
  hdr:`<log uidWell="${well}" uidWellbore="${wb}" uid="${uid}"><nameWell>${well}</nameWell><name>${name}</name><indexType>date time</indexType><startDateTimeIndex>${new Date(rows[0].t).toISOString()}</startDateTimeIndex><endDateTimeIndex>${new Date(rows.at(-1).t).toISOString()}</endDateTimeIndex>`+mn.map(m=>`<logCurveInfo uid="${m}"><mnemonic>${m}</mnemonic><unit>${UN[m]}</unit></logCurveInfo>`).join('')}}
// depth log (e.g. FE / gamma): rows every step m, optional missing interval [a,b)
function depthLog(well,wb,uid,name,{from,to,step=0.5,hole=null}){const idx=[];for(let m=from;m<=to+1e-9;m+=step){if(hole&&m>=hole[0]&&m<hole[1])continue;idx.push(+m.toFixed(2))}
 return {uid,time:false,idx,ser:i=>[idx[i],(60+30*Math.sin(idx[i]/7)).toFixed(1)].join(','),mn:['DEPT','GR'],un:['m','gAPI'],
  hdr:`<log uidWell="${well}" uidWellbore="${wb}" uid="${uid}"><nameWell>${well}</nameWell><name>${name}</name><indexType>measured depth</indexType><startIndex uom="m">${idx[0]}</startIndex><endIndex uom="m">${idx.at(-1)}</endIndex><logCurveInfo uid="DEPT"><mnemonic>DEPT</mnemonic><unit>m</unit></logCurveInfo><logCurveInfo uid="GR"><mnemonic>GR</mnemonic><unit>gAPI</unit></logCurveInfo>`}}
function build(){const W={};
 const cur='TEST-CUR-1',ha='TEST-HIST-A',hb='TEST-HIST-B';
 W[cur]={name:'TEST FIXTURE current well 1',datum:'<wellDatum uid="KB"><name>Kelly bushing</name><code>KB</code><elevation uom="m" datum="MSL">27.4</elevation></wellDatum>',wbs:[{uid:'WB1',name:'TEST FIXTURE main bore'}],
  traj:{WB1:[trajXml(cur,'WB1','TRJ1','TEST FIXTURE definitive survey',stations(prof(1812,600,2.5,62,135,30).concat([[1812,62,135]])).filter((s,i,a)=>i==0||s[0]>a[i-1][0])),trajXml(cur,'WB1','PLN1','TEST FIXTURE well plan',stations(prof(2600,600,2.5,62,135,50)))]},
  logs:{WB1:[timeLog(cur,'WB1','RT1','TEST FIXTURE real-time drilling',{md0:1784,joints:[9.6,12.1,10.4,6.2],rate:28})]},
  geo:{WB1:`<wbGeometry uidWell="${cur}" uidWellbore="WB1" uid="G1"><name>TEST FIXTURE geometry</name><wbGeometrySection uid="c1"><typeHoleCasing>casing</typeHoleCasing><mdTop uom="m">0</mdTop><mdBottom uom="m">610</mdBottom><odSection uom="in">13.375</odSection></wbGeometrySection><wbGeometrySection uid="c2"><typeHoleCasing>casing</typeHoleCasing><mdTop uom="m">0</mdTop><mdBottom uom="m">1495</mdBottom><odSection uom="in">9.625</odSection></wbGeometrySection></wbGeometry>`}};
 W[ha]={name:'TEST FIXTURE historic well A',datum:'',wbs:[{uid:'WB1',name:'TEST FIXTURE historic bore A'}],
  traj:{WB1:[trajXml(ha,'WB1','TRJ1','TEST FIXTURE survey A',stations(prof(2205,900,3,40,60,30)))]},
  logs:{WB1:[timeLog(ha,'WB1','TL1','TEST FIXTURE time log A',{md0:2140,joints:[13.1,9.2,11.7,14.0,8.9,9.5],rate:22,drop:['SPPA']})]},geo:{}};
 W[hb]={name:'TEST FIXTURE historic well B (surveys only)',datum:'',wbs:[{uid:'WB1',name:'TEST FIXTURE historic bore B'}],
  traj:{WB1:[trajXml(hb,'WB1','TRJ1','TEST FIXTURE survey B',stations(prof(1650,500,2,25,300,30)))]},logs:{WB1:[]},geo:{}};
 const hc='TEST-HIST-C',J=n=>Array.from({length:n},(_,i)=>9+((i*37)%50)/10);
 W[hc]={name:'TEST FIXTURE historic well C (main + sidetrack)',datum:'<wellDatum uid="RT"><name>Rotary table</name><code>RT</code><elevation uom="m" datum="MSL">31.0</elevation></wellDatum>',
  wbs:[{uid:'WB1',name:'TEST FIXTURE C main bore'},{uid:'ST1',name:'TEST FIXTURE C sidetrack ST1'}],
  traj:{WB1:[trajXml(hc,'WB1','TRJ1','TEST FIXTURE survey C main',stations(prof(2900,700,2,30,200,30)))],ST1:[trajXml(hc,'ST1','TRJ2','TEST FIXTURE survey C ST1',stations(prof(2600,700,3,55,240,30)))]},
  logs:{WB1:[timeLog(hc,'WB1','TLM','TEST FIXTURE C main time log',{md0:2300,joints:J(34),rate:18,dt:5,gapAfter:20,gapMs:3*3600e3,sparseRop:0.7}),depthLog(hc,'WB1','GRM','TEST FIXTURE C main gamma (depth)',{from:1500,to:2700,step:0.25,hole:[2000,2050]})],
   ST1:[timeLog(hc,'ST1','TLS','TEST FIXTURE C ST1 time log',{md0:2100,joints:J(12),rate:25,t0:T0+3*86400e3})]},
  geo:{},markers:{WB1:[['TEST Top Alpha',1450],['TEST Top Bravo',1980],['TEST Top Charlie',2480]]},
  msgs:{WB1:[['2026-11-07T09:10:00Z',2320,'informational','TEST FIXTURE message: tight spot reported (synthetic)'],['2026-11-07T15:00:00Z',2510,'alarm','TEST FIXTURE message: high torque alarm (synthetic)']],ST1:[['2026-11-10T09:00:00Z',2150,'informational','TEST FIXTURE ST1 kickoff (synthetic)']]}};
 return W}
const W=build();
const g=(q,a)=>(q.match(new RegExp(a+'="([^"]*)"'))||[])[1]||'';
export const calls=[];
export async function call(op,type,query,opts=''){calls.push([op,type,opts]);if(op!='WMLS_GetFromStore')return {xml:''};const w=g(query,'uidWell')||(type=='well'?g(query,' uid'):''),b=g(query,'uidWellbore'),uid=g(query,'uid');
 if(type=='well')return {xml:`<wells ${NS}>`+Object.entries(W).filter(([k])=>!w||k==w).map(([k,v])=>`<well uid="${k}"><name>${v.name}</name>${v.datum}</well>`).join('')+`</wells>`};
 const ww=W[w];if(!ww)return {xml:`<${type}s ${NS}/>`};
 if(type=='wellbore')return {xml:`<wellbores ${NS}>`+ww.wbs.map(x=>`<wellbore uidWell="${w}" uid="${x.uid}"><nameWell>${ww.name}</nameWell><name>${x.name}</name></wellbore>`).join('')+`</wellbores>`};
 if(type=='trajectory')return {xml:`<trajectorys ${NS}>${(ww.traj[b]||[]).join('')}</trajectorys>`};
 if(type=='mudLog')return {xml:`<mudLogs ${NS}/>`};
 if(type=='wbGeometry')return {xml:`<wbGeometrys ${NS}>${ww.geo[b]||''}</wbGeometrys>`};
 if(type=='formationMarker')return {xml:`<formationMarkers ${NS}>`+((ww.markers||{})[b]||[]).map((m,i)=>`<formationMarker uidWell="${w}" uidWellbore="${b}" uid="fm${i}"><name>${m[0]}</name><mdTopSample uom="m">${m[1]}</mdTopSample></formationMarker>`).join('')+`</formationMarkers>`};
 if(type=='message')return {xml:`<messages ${NS}>`+((ww.msgs||{})[b]||[]).map((m,i)=>`<message uidWell="${w}" uidWellbore="${b}" uid="m${i}"><name>msg ${i}</name><dTim>${m[0]}</dTim><md uom="m">${m[1]}</md><typeMessage>${m[2]}</typeMessage><messageText>${m[3]}</messageText></message>`).join('')+`</messages>`};
 if(type=='log'){const L=(ww.logs[b]||[]).filter(l=>!uid||l.uid==uid);const data=/data-only/.test(opts);let result=1;
  const cap=+((opts.match(/maxReturnNodes=(\d+)/)||[])[1]||1e9),st=(query.match(/<startDateTimeIndex>([^<]*)/)||[])[1],si=(query.match(/<startIndex[^>]*>([^<]*)/)||[])[1];
  const body=L.map(l=>{if(!data)return l.hdr+'</log>';const from=l.time?(st?Date.parse(st):-Infinity):(si!=null?+si:-Infinity);/* inclusive start, like many stores: boundary row repeats */
   const ix=[];for(let i=0;i<l.idx.length;i++)if(l.idx[i]>=from)ix.push(i);if(ix.length>cap)result=2;const pg=ix.slice(0,cap);
   return l.hdr+`<logData><mnemonicList>${l.mn.join(',')}</mnemonicList><unitList>${l.un.join(',')}</unitList>`+pg.map(i=>`<data>${l.ser(i)}</data>`).join('')+`</logData></log>`}).join('');
  return {xml:`<logs ${NS}>${body}</logs>`,result}}
 return {xml:`<${type}s ${NS}/>`}}
export const WELLS=Object.keys(W);
// SYNTHETIC TEST-ONLY growing log for Follow-live tests: rows appended by grow(); inject(kind) queues one failure ('504'|'timeout'|'401'|'hang').
export function growingStore({rows0=50,dt=10,t0=T0,growing=true}={}){const idx=[];const add=n=>{for(let i=0;i<n;i++)idx.push((idx.at(-1)??t0-dt*1000)+dt*1000)};add(rows0);const fails=[],log=[];
 const ser=i=>[new Date(idx[i]).toISOString(),(1800+i*0.05).toFixed(2),'120'].join(',');
 async function call(op,type,query,opts=''){log.push([op,type,query,opts]);const f=fails.shift();
  if(f=='504')return {xml:'',result:-1,supp:'HTTP 504 Gateway Timeout'};if(f=='401'){const e=new Error('HTTP 401 authentication required');e.status=401;throw e}
  if(f=='timeout'){const e=new Error('WITSML request deadline exceeded');e.code='TIMEOUT';throw e}if(f=='hang')return new Promise(()=>{});
  const cap=+((opts.match(/maxReturnNodes=(\d+)/)||[])[1]||1e9),st=(query.match(/<startDateTimeIndex>([^<]*)/)||[])[1],from=st?Date.parse(st):-Infinity;
  const ix=[];for(let i=0;i<idx.length;i++)if(idx[i]>=from)ix.push(i);/* inclusive start like many stores */const pg=ix.slice(0,cap);
  return {xml:`<logs ${NS}><log uidWell="TEST-LIVE-G" uidWellbore="WB1" uid="GL"><name>TEST FIXTURE growing log</name><objectGrowing>${growing}</objectGrowing><indexType>date time</indexType><logCurveInfo uid="RPMA"><mnemonic>RPMA</mnemonic><unit>rpm</unit></logCurveInfo><logCurveInfo uid="TIME"><mnemonic>TIME</mnemonic><unit>s</unit></logCurveInfo><logCurveInfo uid="DMEA"><mnemonic>DMEA</mnemonic><unit>m</unit></logCurveInfo><logData><mnemonicList>TIME,DMEA,RPMA</mnemonicList><unitList>s,m,rpm</unitList>`+pg.map(i=>`<data>${ser(i)}</data>`).join('')+`</logData></log></logs>`,result:ix.length>cap?2:1}}
 return {call,grow:add,inject:k=>fails.push(k),log,idx,set:()=>({uid:'GL',wb:'WB1',time:true,rows:[],objectGrowing:growing})}}
// SYNTHETIC TEST-ONLY 1.3.1.1 store emulation over the fixture store: GetVersion "1.3.1.1", rejects version="1.4.1.1" queries and maxReturnNodes,
// strips <mnemonicList>/<unitList> and adds <columnIndex>/<indexCurve> like 1.3.1 logs; no dTimLastChange.
export function store13(inner=call){const seen=[];
 async function c13(op,type,query,opts=''){seen.push([op,type,query,opts]);if(op=='WMLS_GetVersion')return {xml:'1.3.1.1'};if(op=='WMLS_GetCap')return {xml:'<capServers><capServer apiVers="1.3.1"><function name="WMLS_GetFromStore"><dataObject>log</dataObject></function></capServer></capServers>'};
  if(/version="1\.4\.1\.1"/.test(query))return {xml:'',result:-468,supp:'version mismatch'};if(/maxReturnNodes/.test(opts))return {xml:'',result:-411,supp:'OptionsIn maxReturnNodes not supported'};
  const r=await inner(op,type,query.replace(/version="1\.3\.1\.1"/g,'version="1.4.1.1"'),opts);let x=(r.xml||'').replace(/version="1\.4\.1\.1"/g,'version="1.3.1.1"').replace(/<dTimLastChange>[^<]*<\/dTimLastChange>/g,'');
  if(type=='log')x=x.replace(/<log ([^>]*)>([\s\S]*?)<\/log>/g,(a,at,b)=>{const ml=((b.match(/<mnemonicList>([^<]*)/)||[])[1]||'').split(',').filter(Boolean);
   b=b.replace(/<mnemonicList>[^<]*<\/mnemonicList><unitList>[^<]*<\/unitList>/,'').replace(/<mnemonic>([^<]*)<\/mnemonic>/g,(m,n)=>m+(ml.includes(n)?`<columnIndex>${ml.indexOf(n)+1}</columnIndex>`:''));
   if(ml.length&&/<logCurveInfo/.test(b))b=b.replace(/<logCurveInfo/,`<indexCurve columnIndex="1">${ml[0]}</indexCurve><logCurveInfo`);return `<log ${at}>${b}</log>`});
  return {...r,xml:x}}
 return {call:c13,seen}}
