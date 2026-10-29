// WITSML 1.4.1.1 SOAP proxy + SIMULATED test store (Node, no dependencies).
// Why: a browser page (especially https GitHub Pages) cannot call a WITSML SOAP server directly (CORS, SOAP envelopes,
// mixed content). The game posts JSON to this proxy; the proxy makes the SOAP call and returns the XMLout.
//   node witsml_proxy.mjs [port=8796]
//   POST http://localhost:8796/soap  {url, user, pass, op:"WMLS_GetFromStore"|"WMLS_GetVersion"|"WMLS_GetCap", wmlType, query, options}
//        -> {result, xml, supp, ms}
//   SIMULATED store for testing (clearly labelled, NOT real rig data): http://localhost:8796/sim/witsml  (any user/password)
// Security: listens on 127.0.0.1 only; credentials are forwarded per request (HTTP Basic) and never stored or logged.
//   Set WITSML_PROXY_ALLOW="https://witsml.example.com,https://other" to restrict target servers.
import http from 'http';import https from 'https';import fs from 'fs';
const PORT=+process.argv[2]||8796,ALLOW=(process.env.WITSML_PROXY_ALLOW||'').split(',').filter(Boolean);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const unesc=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const tag=(x,t)=>{const m=x.match(new RegExp('<(?:\\w+:)?'+t+'\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:\\w+:)?'+t+'>)'));return m?(m[1]??''):null};
function envelope(op,a){const body=op=='WMLS_GetVersion'?'':op=='WMLS_GetCap'?`<OptionsIn xsi:type="xsd:string">${esc(a.options||'dataVersion=1.4.1.1')}</OptionsIn>`:
 `<WMLtypeIn xsi:type="xsd:string">${esc(a.wmlType)}</WMLtypeIn><QueryIn xsi:type="xsd:string">${esc(a.query)}</QueryIn><OptionsIn xsi:type="xsd:string">${esc(a.options||'')}</OptionsIn><CapabilitiesIn xsi:type="xsd:string"></CapabilitiesIn>`;
 return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><q1:${op} xmlns:q1="http://www.witsml.org/message/120">${body}</q1:${op}></soap:Body></soap:Envelope>`}
function post(url,xml,op,user,pass){return new Promise((res,rej)=>{const u=new URL(url),lib=u.protocol=='https:'?https:http;
 const h={'Content-Type':'text/xml; charset=utf-8','SOAPAction':'"http://www.witsml.org/action/120/Store.'+op+'"','Content-Length':Buffer.byteLength(xml)};if(user)h.Authorization='Basic '+Buffer.from(user+':'+(pass||'')).toString('base64');
 const r=lib.request(u,{method:'POST',headers:h,timeout:30000},s=>{let b='';s.setEncoding('utf8');s.on('data',d=>b+=d);s.on('end',()=>res({status:s.statusCode,body:b}))});r.on('error',rej);r.on('timeout',()=>r.destroy(new Error('timeout')));r.end(xml)})}
// ---------------- SIMULATED store ----------------
const CSV=fs.readFileSync(new URL('./sample_sequence.csv',import.meta.url),'utf8').trim().split(/\r?\n/);const H=CSV[0].split(',');
const ROWS=CSV.slice(1).map(l=>{const c=l.split(','),o={};H.forEach((k,i)=>o[k]=+c[i]||0);return o});const T0=Date.now(),RATE=2;// rows per second
const CURVES=[['SPPA','psi',r=>r.spp_psi],['MFIA','galUS/min',r=>r.flow_gpm],['HKLA','klbf',r=>r.hookload_klbf],['SWOB','klbf',r=>r.wob_klbf],['RPMA','rpm',r=>r.td_rpm],['TQA','ft.lbf',r=>Math.round(r.td_rpm*55+r.wob_klbf*120)],
 ['SPM1','spm',r=>+(r.flow_gpm/4.36/2).toFixed(1)],['SPM2','spm',r=>+(r.flow_gpm/4.36/2).toFixed(1)],['SPM3','spm',()=>0],['SPM4','spm',()=>0],['BPOS','m',r=>r.quill_m],['DMEA','ft',r=>r.md_ft],['TVA','bbl',r=>+(820-r.time_s*0.002).toFixed(1)]];
const iso=ms=>new Date(ms).toISOString().replace(/\.\d+Z$/,'.000Z');
const avail=()=>Math.min(ROWS.length*50,Math.floor((Date.now()-T0)/1000*RATE)+600);// pre-history of 600 rows
const rowAt=k=>{const r=ROWS[k%ROWS.length],lap=Math.floor(k/ROWS.length);return{...r,md_ft:r.md_ft+lap*100}};
const tIdx=k=>T0-600/RATE*1000+k*1000/RATE;
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const W='<nameWell>SIMULATED Test Well 1 (not real data)</nameWell>',WB='<nameWellbore>SIMULATED Wellbore 1</nameWellbore>';
function simStore(wmlType,q,opt){const rete=(opt.match(/returnElements=([\w-]+)/)||[])[1]||'requested',maxN=+((opt.match(/maxReturnNodes=(\d+)/)||[])[1]||1000);
 if(wmlType=='well')return `<wells ${NS}><well uid="SIM-W1"><name>SIMULATED Test Well 1 (not real data)</name><field>Test field (SIMULATED)</field><operator>Drilling World test store</operator></well></wells>`;
 if(wmlType=='wellbore')return `<wellbores ${NS}><wellbore uidWell="SIM-W1" uid="SIM-WB1">${W}<name>SIMULATED Wellbore 1</name></wellbore></wellbores>`;
 if(wmlType!='log')return `<${wmlType}s ${NS}/>`;
 const uid=(q.match(/<log\b[^>]*\buid="([^"]*)"/)||[])[1]||'';const n=avail();const logs=[];
 for(const L of ['SIM-TIME','SIM-DEPTH']){if(uid&&uid!=L)continue;const time=L=='SIM-TIME';
  const ic=time?['TIME','s']:['DEPT','ft'];const cur=[ic,...CURVES.map(c=>[c[0],c[1]])];
  const head=`${W}${WB}<name>${time?'SIMULATED realtime time log (1 s)':'SIMULATED depth log'}</name><indexType>${time?'date time':'measured depth'}</indexType>`+
   (time?`<startDateTimeIndex>${iso(tIdx(0))}</startDateTimeIndex><endDateTimeIndex>${iso(tIdx(n-1))}</endDateTimeIndex>`:`<startIndex uom="ft">${rowAt(0).md_ft}</startIndex><endIndex uom="ft">${rowAt(n-1).md_ft}</endIndex>`)+
   `<indexCurve>${ic[0]}</indexCurve>`+cur.map(c=>`<logCurveInfo uid="${c[0]}"><mnemonic>${c[0]}</mnemonic><unit>${c[1]}</unit></logCurveInfo>`).join('');
  let data='';if(rete=='all'||rete=='data-only'||/<logData/.test(q)){
   const sdt=tag(q,'startDateTimeIndex'),si=tag(q,'startIndex');let k0=0;
   if(time&&sdt){const t=Date.parse(sdt);k0=Math.max(0,Math.ceil((t-tIdx(0))/(1000/RATE)))}
   if(!time&&si){const md=+si;k0=0;while(k0<n&&rowAt(k0).md_ft<md)k0++}
   let rows=[],last=-1e9;for(let k=k0;k<n&&rows.length<maxN;k++){const r=rowAt(k);if(!time){if(r.md_ft<=last)continue;last=r.md_ft}rows.push((time?iso(tIdx(k)):r.md_ft)+','+CURVES.map(c=>c[2](r)).join(','))}
   data=`<logData><mnemonicList>${cur.map(c=>c[0]).join(',')}</mnemonicList><unitList>${cur.map(c=>c[1]).join(',')}</unitList>${rows.map(r=>`<data>${r}</data>`).join('')}</logData>`}
  logs.push(`<log uidWell="SIM-W1" uidWellbore="SIM-WB1" uid="${L}">${rete=='data-only'?'':head}${data}</log>`)}
 return `<logs ${NS}>${logs.join('')}</logs>`}
function simSoap(body){const op=(body.match(/<(?:\w+:)?(WMLS_\w+)/)||[])[1];
 const wrap=(inner)=>`<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><q2:${op}Response xmlns:q2="http://www.witsml.org/message/120">${inner}</q2:${op}Response></soap:Body></soap:Envelope>`;
 if(op=='WMLS_GetVersion')return wrap('<Result>1.4.1.1</Result>');
 if(op=='WMLS_GetCap')return wrap(`<Result>1</Result><CapabilitiesOut>${esc('<capServers xmlns="http://www.witsml.org/api/141" version="1.4.1"><capServer apiVers="1.4.1"><name>Drilling World SIMULATED test store</name><description>SIMULATED data from sample_sequence.csv - not real rig data</description><schemaVersion>1.4.1.1</schemaVersion></capServer></capServers>')}</CapabilitiesOut><SuppMsgOut></SuppMsgOut>`);
 if(op=='WMLS_GetFromStore'){const x=simStore(unesc(tag(body,'WMLtypeIn')||''),unesc(tag(body,'QueryIn')||''),unesc(tag(body,'OptionsIn')||''));return wrap(`<Result>1</Result><XMLout>${esc(x)}</XMLout><SuppMsgOut>SIMULATED test store</SuppMsgOut>`)}
 return wrap('<Result>-424</Result><SuppMsgOut>Not supported by SIMULATED store</SuppMsgOut>')}
// ---------------- server ----------------
const srv=http.createServer(async(q,r)=>{r.setHeader('Access-Control-Allow-Origin','*');r.setHeader('Access-Control-Allow-Headers','Content-Type');r.setHeader('Access-Control-Allow-Private-Network','true');
 if(q.method=='OPTIONS'){r.writeHead(204);return r.end()}let b='';for await(const d of q)b+=d;const u=new URL(q.url,'http://x');
 if(u.pathname=='/sim/witsml'){r.writeHead(200,{'Content-Type':'text/xml; charset=utf-8'});return r.end(simSoap(b))}
 if(u.pathname=='/soap'&&q.method=='POST'){const t0=Date.now();let a;try{a=JSON.parse(b)}catch{r.writeHead(400);return r.end('{"error":"bad json"}')}
  const send=(c,o)=>{r.writeHead(c,{'Content-Type':'application/json'});r.end(JSON.stringify(o))};
  try{const tu=new URL(a.url);if(!/^https?:$/.test(tu.protocol))throw new Error('url must be http(s)');if(ALLOW.length&&!ALLOW.some(x=>a.url.startsWith(x)))throw new Error('target not in WITSML_PROXY_ALLOW')
   const op=a.op||'WMLS_GetFromStore';const resp=await post(a.url,envelope(op,a),op,a.user,a.pass);
   if(resp.status==401||resp.status==403)return send(200,{result:-1,error:'Authentication failed ('+resp.status+')'});
   const fault=tag(resp.body,'faultstring');if(fault)return send(200,{result:-1,error:'SOAP fault: '+unesc(fault)});
   if(resp.status>=400)return send(200,{result:-1,error:'HTTP '+resp.status});
   const res=tag(resp.body,'Result');const xml=unesc(tag(resp.body,'XMLout')||tag(resp.body,'CapabilitiesOut')||'');
   send(200,{result:op=='WMLS_GetVersion'?1:+res,version:op=='WMLS_GetVersion'?res:undefined,xml,supp:unesc(tag(resp.body,'SuppMsgOut')||''),ms:Date.now()-t0})
  }catch(e){send(200,{result:-1,error:/certificate has expired|CERT_HAS_EXPIRED/.test(e.message+e.code)?'Server TLS certificate has expired - ask the WITSML provider to renew it (the proxy will not send credentials over an unverified connection)':e.message})}
  console.log(new Date().toISOString(),'proxy',a.op||'WMLS_GetFromStore',a.wmlType||'',(()=>{try{return new URL(a.url).host}catch{return'?'}})(),Date.now()-t0+'ms');return}// host only; never credentials
 r.writeHead(200,{'Content-Type':'text/plain'});r.end('Drilling World WITSML proxy. POST /soap. SIMULATED test store at /sim/witsml')});
srv.listen(PORT,'127.0.0.1',()=>console.log(`WITSML proxy on http://localhost:${PORT}/soap  |  SIMULATED test store: http://localhost:${PORT}/sim/witsml`));
