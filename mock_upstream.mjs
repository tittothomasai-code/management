// SIM-TEST mock WITSML 1.4.1.1 upstream for OFFLINE testing (v3.9 survey feed + per-well replica). NOT real data, never LIVE.
// Binds 127.0.0.1 only. Read-only: GetVersion/GetCap/GetFromStore. Two SIM-TEST wells with DIFFERENT data coverage:
//   DR101L/WB01B02: well+location, rig, growing trajectory, formationMarkers, time log (DMEA,BDE,SPPA,MFIA,HKLA,SWOB,RPMA,TQA); NO wbGeometry
//   DR202X/WB02A01: well (no location), NO rig, different trajectory, NO formationMarkers (unsupported), wbGeometry casing, log (DMEA,SPPA,SPM1,SPM2,HKLA)
// Trajectory honours <mdMn> inclusively (last station re-sent -> client must dedupe).
// v4.7: DR303M (SIM-TEST): log in wellbore WB03A, NO trajectory there; WB03B holds PLAN-1 (3 stations) + ACT-1 (growing). Honours uid/uidWellbore/returnElements=id-only.
//   GET /ctl/fmt?f=plain|prefixed|cdata|double  -> how trajectory XMLout is encoded (prefixed witsml: namespace, CDATA, double-escaped)
//   GET /ctl/stats   GET /ctl/fail401?on=1|0   GET /ctl/grow?k=1   Env: MOCK_PORT (8799) MOCK_GROW_MS (0) MOCK_START (6)
import http from 'http';
const PORT=+process.env.MOCK_PORT||8799,GROW=+process.env.MOCK_GROW_MS||0;let fail401=false,grow=0,FMT='plain';
const stats={calls:0,traj:0,fm:0,mdMn:[],returned:[],auth401:0,afterFail:0,ops:{},types:{}};
const WELLS={DR101L:{wb:'WB01B02',wbs:['TOPHOLE-UID','WB01B01','WB01B01-BUILD','WB01B02','WB01B02-BUILD'],wbNames:{'TOPHOLE-UID':'TOP HOLE','WB01B01-BUILD':'WB01B01 BUILD','WB01B02-BUILD':'WB01B02 BUILD'},name:'DR101L (SIM-TEST)',wbName:'WB01B02 (SIM-TEST)',loc:[-26.571,149.182],field:'SIM-TEST Field A',rig:'SIM-TEST Rig 7',n0:+process.env.MOCK_START||48,
  st:k=>{const md=k*30;return{md,inc:md<=300?0:Math.min(45,(md-300)/30*3),azi:120}},fm:[['SIM-TEST Upper Sand',0],['SIM-TEST Shale',250],['SIM-TEST Lower Sand',520],['SIM-TEST Basement',900]],geo:null,
  curves:[['DMEA','m',t=>1500+t/600],['BDE','m',t=>1499+t/600],['SPPA','kPa',t=>18500+300*Math.sin(t/60)],['MFIA','L/min',()=>2600],['HKLA','kN',()=>620],['SWOB','kN',()=>80],['RPMA','rpm',()=>120],['TQA','kN.m',()=>14]]},
 DR303M:{wb:'WB03A',wbs:['WB03A','WB03B'],name:'DR303M (SIM-TEST)',wbName:'WB03A (SIM-TEST)',loc:null,field:'SIM-TEST Field C',rig:null,n0:0,st:k=>({md:0,inc:0,azi:0}),fm:null,geo:null,
  curves:[['DMEA','m',t=>2842+t/900],['SPPA','kPa',()=>10025],['HKLA','kN',()=>700]]},
 DR202X:{wb:'WB02A01',name:'DR202X (SIM-TEST)',wbName:'WB02A01 (SIM-TEST)',loc:null,field:'SIM-TEST Field B',rig:null,n0:57,
  st:k=>{const md=k*50;return{md,inc:md<=150?0:Math.min(70,(md-150)/30*2.5),azi:300}},fm:null,geo:[['conductor',0,60,20,1],['surface casing',0,400,13.375,1],['intermediate casing',0,1100,9.625,1],['open hole',1100,1650,8.5,0]],
  curves:[['DMEA','m',t=>2900+t/900],['SPPA','kPa',()=>21000],['SPM1','1/min',()=>95],['SPM2','1/min',()=>95],['HKLA','kN',()=>810]]}};
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');const unesc=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
const NSA='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"',T0=Date.now();
const attr=(q,a)=>(q.match(new RegExp(a+'="([^"]*)"'))||[])[1]||'';
function store(typ,q){const uw=attr(q,'uidWell'),W=WELLS[uw];
 if(typ=='well')return `<wells ${NSA}>${Object.entries(WELLS).filter(([u])=>!attr(q,'uid')||attr(q,'uid')==u).map(([u,w])=>`<well uid="${u}"><name>${w.name}</name><field>${w.field}</field><country>SIM-TEST</country>${w.loc?`<wellLocation uid="loc1"><latitude uom="dega">${w.loc[0]}</latitude><longitude uom="dega">${w.loc[1]}</longitude></wellLocation>`:''}</well>`).join('')}</wells>`;
 if(typ=='wellbore')return `<wellbores ${NSA}>${Object.entries(WELLS).filter(([u])=>!uw||u==uw).flatMap(([u,w])=>(w.wbs||[w.wb]).map(b=>`<wellbore uidWell="${u}" uid="${b}"><name>${(w.wbNames||{})[b]||b} (SIM-TEST)</name></wellbore>`)).join('')}</wellbores>`;
 if(!W)return `<${typ}s ${NSA}/>`;
 if(typ=='rig')return `<rigs ${NSA}>${W.rig?`<rig uidWell="${uw}" uidWellbore="${W.wb}" uid="RIG1"><nameWell>${W.name}</nameWell><name>${W.rig}</name><owner>SIM-TEST Drilling</owner></rig>`:''}</rigs>`;
 if(typ=='wbGeometry')return `<wbGeometrys ${NSA}>${W.geo?`<wbGeometry uidWell="${uw}" uidWellbore="${W.wb}" uid="GEO1"><name>SIM-TEST geometry</name>${W.geo.map((g,i)=>`<wbGeometrySection uid="s${i}"><typeHoleCasing>${g[0]}</typeHoleCasing><mdTop uom="m">${g[1]}</mdTop><mdBottom uom="m">${g[2]}</mdBottom><odSection uom="in">${g[3]}</odSection></wbGeometrySection>`).join('')}</wbGeometry>`:''}</wbGeometrys>`;
 if(typ=='log'){const now=Date.now(),t=Math.floor((now-T0)/1000),iso=ms=>new Date(ms).toISOString().replace(/\.\d+Z$/,'.000Z');const hdr=`<nameWell>${W.name}</nameWell><name>SIM-TEST time log</name><indexType>date time</indexType><indexCurve>TIME</indexCurve><startDateTimeIndex>${iso(T0-3600e3)}</startDateTimeIndex><endDateTimeIndex>${iso(now)}</endDateTimeIndex>`;
  if(!/<logData/.test(q))return `<logs ${NSA}><log uidWell="${uw}" uidWellbore="${W.wb}" uid="TLOG">${hdr}<logCurveInfo uid="TIME"><mnemonic>TIME</mnemonic><unit>s</unit></logCurveInfo>${W.curves.map(c=>`<logCurveInfo uid="${c[0]}"><mnemonic>${c[0]}</mnemonic><unit>${c[1]}</unit></logCurveInfo>`).join('')}</log></logs>`;
  const from=Date.parse((q.match(/<startDateTimeIndex>([^<]+)/)||[])[1]||iso(now-60000));const rows=[];for(let ms=Math.max(from+1000,now-120000);ms<=now;ms+=10000){const ts=(ms-T0)/1000;rows.push(`<data>${iso(ms)},${W.curves.map(c=>+c[2](ts).toFixed(2)).join(',')}</data>`)}
  return `<logs ${NSA}><log uidWell="${uw}" uidWellbore="${W.wb}" uid="TLOG"><logData><mnemonicList>TIME,${W.curves.map(c=>c[0]).join(',')}</mnemonicList><unitList>s,${W.curves.map(c=>c[1]).join(',')}</unitList>${rows.join('')}</logData></log></logs>`}
 return null}
function traj(W,uw,mdMn){const n=W.n0+grow;const all=[...Array(n).keys()].map(k=>({uid:'SIMTEST-'+uw+'-'+k,...W.st(k)})).filter(s=>mdMn==null||s.md>=mdMn-1e-9);stats.returned.push(all.length);
 return `<trajectorys ${NSA}><trajectory uidWell="${uw}" uidWellbore="${W.wb}" uid="SIMTEST-TRAJ"><nameWell>${W.name}</nameWell><name>${uw=='DR101L'?'Survey - Directional (SIM-TEST)':'SIM-TEST mock trajectory '+uw}</name>${all.map(s=>`<trajectoryStation uid="${s.uid}"><dTimStn>${new Date(Date.UTC(2026,9,29)+s.md*1000).toISOString()}</dTimStn><md uom="m">${s.md}</md><incl uom="dega">${s.inc.toFixed(3)}</incl><azi uom="dega">${s.azi}</azi></trajectoryStation>`).join('')}</trajectory></trajectorys>`}
const wrap=(op,res,xml)=>`<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${op}Response><Result>${res}</Result>${xml!=null?`<XMLout>${esc(xml)}</XMLout>`:''}<SuppMsgOut>SIM-TEST mock</SuppMsgOut></${op}Response></soap:Body></soap:Envelope>`;
const pref=x=>x.replace(/<(\/?)(?!\?)([A-Za-z]\w*)/g,'<$1witsml:$2').replace(/xmlns="/,'xmlns:witsml="');
const wrapT=(op,x)=>FMT=='prefixed'?wrap(op,1,pref(x)):FMT=='cdata'?wrap(op,1,null).replace('<SuppMsgOut>','<XMLout><![CDATA['+x+']]></XMLout><SuppMsgOut>'):FMT=='double'?wrap(op,1,esc(x)):wrap(op,1,x);
if(GROW)setInterval(()=>grow++,GROW);
http.createServer(async(q,r)=>{const u=new URL(q.url,'http://x');
 if(u.pathname.startsWith('/ctl/')){r.setHeader('Content-Type','application/json');r.setHeader('Access-Control-Allow-Origin','*');
  if(u.pathname=='/ctl/fail401')fail401=u.searchParams.get('on')!=='0';if(u.pathname=='/ctl/fmt')FMT=u.searchParams.get('f')||'plain';if(u.pathname=='/ctl/grow')grow+=+(u.searchParams.get('k')||1);return r.end(JSON.stringify({grow,fail401,fmt:FMT,...stats}))}
 let b='';for await(const d of q)b+=d;stats.calls++;if(fail401)stats.afterFail++;
 const op=(q.headers.soapaction||'').replace(/.*Store\.|"/g,'');stats.ops[op]=(stats.ops[op]||0)+1;
 if(fail401||!q.headers.authorization){stats.auth401++;r.writeHead(401,{'WWW-Authenticate':'Basic realm="SIM-TEST"'});return r.end('Unauthorized')}
 if(!['WMLS_GetFromStore','WMLS_GetVersion','WMLS_GetCap'].includes(op)){r.writeHead(500);return r.end('read-only mock')}
 r.writeHead(200,{'Content-Type':'text/xml; charset=utf-8'});if(op!='WMLS_GetFromStore')return r.end(wrap(op,'1.4.1.1',op=='WMLS_GetCap'?'':null));
 const qx=unesc((b.match(/<QueryIn[^>]*>([\s\S]*?)<\/QueryIn>/)||[])[1]||''),typ=(b.match(/<WMLtypeIn[^>]*>([^<]*)</)||[])[1];stats.types[typ]=(stats.types[typ]||0)+1;const uw=attr(qx,'uidWell'),W=WELLS[uw];
 if(typ=='trajectory'){stats.traj++;if(!W)return r.end(wrapT(op,`<trajectorys ${NSA}/>`));const m=qx.match(/<mdMn uom="([^"]*)">([^<]+)<\/mdMn>/);let mn=null;if(m){mn=+m[2];if(m[1]=='ft')mn*=0.3048}stats.mdMn.push(mn);
  const opt=unesc((b.match(/<OptionsIn[^>]*>([\s\S]*?)<\/OptionsIn>/)||[])[1]||''),idOnly=/returnElements=id-only/.test(opt),qwb=attr(qx,'uidWellbore'),qu=attr(qx,'uid');
  const T=uw=='DR303M'?[{wb:'WB03B',uid:'PLAN-1',name:'SIM-TEST Plan',grow:false,st:[0,500,1500].map((md,k)=>({uid:'p'+k,md,inc:k?10:0,azi:90}))},{wb:'WB03B',uid:'ACT-1',name:'SIM-TEST Actual survey',grow:true,st:[...Array(20).keys()].map(k=>({uid:'a'+k,md:k*150,inc:k<4?0:Math.min(40,(k-3)*3),azi:60}))}]
   :[...(uw=='DR101L'?[{wb:'WB01B01',uid:'TRJ-OLD-01',name:'Survey - Directional (old hole, SIM-TEST)',grow:false,time:'2020-01-01T00:00:00Z',st:[0,300,600,900,1200].map((md,k)=>({uid:'o'+k,md,inc:k*2,azi:200}))}]:[]),{wb:W.wb,uid:'SIMTEST-TRAJ',name:uw=='DR101L'?'Survey - Directional (SIM-TEST)':'SIM-TEST mock trajectory '+uw,grow:true,st:null}];
  const sel=T.filter(t=>(!qwb||qwb==t.wb)&&(!qu||qu==t.uid));stats.trajQ=(stats.trajQ||[]);stats.trajQ.push({qwb,qu,idOnly,n:sel.length});
  const body=sel.map(t=>{const st=idOnly?[]:(t.st?t.st.filter(s=>mn==null||s.md>=mn-1e-9):null);if(!t.st&&!idOnly)return traj(W,uw,mn).replace(/^<trajectorys[^>]*>|<\/trajectorys>$/g,'');
   return `<trajectory uidWell="${uw}" uidWellbore="${t.wb}" uid="${t.uid}"><nameWell>${W.name}</nameWell><name>${t.name}</name>${idOnly?'':`<objectGrowing>${t.grow}</objectGrowing>`+(t.time?`<commonData><dTimLastChange>${t.time}</dTimLastChange></commonData>`:'')+st.map(s=>`<trajectoryStation uid="${s.uid}"><md uom="m">${s.md}</md><tvd uom="m">${s.md}</tvd><incl uom="dega">${s.inc}</incl><azi uom="dega">${s.azi}</azi></trajectoryStation>`).join('')}</trajectory>`}).join('');
  return r.end(wrapT(op,`<trajectorys ${NSA}>${body}</trajectorys>`))}
 if(typ=='formationMarker'){stats.fm++;if(!W||!W.fm)return r.end(wrap(op,-485,null));return r.end(wrap(op,1,`<formationMarkers ${NSA}>${W.fm.map(([nm,a],i)=>`<formationMarker uidWell="${uw}" uidWellbore="${W.wb}" uid="FM${i}"><name>${nm}</name><mdTopSample uom="m">${a}</mdTopSample><tvdTopSample uom="m">${a}</tvdTopSample></formationMarker>`).join('')}</formationMarkers>`))}
 const x=store(typ,qx);return r.end(x==null?wrap(op,-485,null):wrap(op,1,x))}).listen(PORT,'127.0.0.1',()=>console.log('SIM-TEST mock upstream on http://127.0.0.1:'+PORT+'/witsml'));
