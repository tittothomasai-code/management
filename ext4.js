// ext4.js: WITSML 1.4.1.1 live-data connection (via witsml_proxy.mjs). Credentials are session-only: held in memory, never stored or logged.
let C,S,el,PANEL,BTN;const $=id=>document.getElementById(id);
const NS='xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const PKEY='dw34-witsml-ui';// stores ONLY proxy URL, server URL, poll interval, mapping. Never username/password.
const SIGNALS={spp:'Standpipe pressure',Q:'Flow in',hook:'Hookload',wob:'WOB',rpm:'Top drive RPM',md:'Measured depth',quill:'Block height',tq:'Top drive torque','p1.spm':'Pump 1 SPM','p2.spm':'Pump 2 SPM','p3.spm':'Pump 3 SPM','p4.spm':'Pump 4 SPM'};
const AUTO=[[/^(SPPA|SPP|STPP|PRES_SP|SPPRESS)/i,'spp'],[/^(MFIA|TFLO|FLOWIN|MFI|FLOW_IN|TFLOW)/i,'Q'],[/^(HKLA|HKLD|HOOKLOAD|HKL)/i,'hook'],[/^(SWOB|WOBA|WOB)/i,'wob'],[/^(RPMA|TDRPM|RPM|SRPM)/i,'rpm'],
 [/^(TQA|STOR|TORQ|TDTQ|TQ)/i,'tq'],[/^(DMEA|DBTM|BITDEP|DEPT?H?_?BIT)/i,'md'],[/^(BPOS|BLKPOS|HKHT)/i,'quill'],[/^SPM ?1|^PUMP1|^SPM_1|^SPMA1/i,'p1.spm'],[/^SPM ?2|^PUMP2|^SPM_2|^SPMA2/i,'p2.spm'],[/^SPM ?3|^PUMP3|^SPM_3/i,'p3.spm'],[/^SPM ?4|^PUMP4|^SPM_4/i,'p4.spm']];
const CFG=Object.assign({proxy:'http://localhost:8796/soap',url:'https://australia.adagasolutions.com/WMLS',interval:2000,map:{}},JSON.parse(localStorage.getItem(PKEY)||'{}'));
let CRED={user:'',pass:''};// memory only
const WML={status:'not connected',channels:{},log:null,last:null,timer:null,rows:0,polls:0,errors:0,simulated:false,fresh:0,
 tag(){return Date.now()-this.fresh<15000?(this.simulated?'live-sim':'live'):'sim'},
 drives(id){const ok=Date.now()-this.fresh<15000;if(!ok)return null;for(const [mn,s] of Object.entries(CFG.map))if(s==id&&this.channels[mn]?.v!=null)return this.simulated?'live-sim':'live';return null}};
window.WML=WML;const saveCfg=()=>localStorage.setItem(PKEY,JSON.stringify({proxy:CFG.proxy,url:CFG.url,interval:CFG.interval,map:CFG.map}));
async function call(op,wmlType,query,options){const r=await fetch(CFG.proxy,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:CFG.url,user:CRED.user,pass:CRED.pass,op,wmlType,query,options})});
 const j=await r.json();if(j.error)throw new Error(j.error);if(op=='WMLS_GetFromStore'&&j.result<1)throw new Error('WITSML result '+j.result+' '+(j.supp||''));return j}
const xml=s=>new DOMParser().parseFromString(s||'<x/>','application/xml');const kids=(n,t)=>[...n.getElementsByTagNameNS('*',t)];const txt=(n,t)=>kids(n,t)[0]?.textContent?.trim()??'';
const setSt=(s,err)=>{WML.status=s;const e=$('wst');if(e){e.textContent=s;e.style.color=err?'#f88':'#fd8'}};
async function listWells(){const j=await call('WMLS_GetFromStore','well',`<wells ${NS}><well uid=""><name/></well></wells>`,'returnElements=id-only');return kids(xml(j.xml),'well').map(w=>({uid:w.getAttribute('uid'),name:txt(w,'name')||w.getAttribute('uid')}))}
async function listWellbores(w){const j=await call('WMLS_GetFromStore','wellbore',`<wellbores ${NS}><wellbore uidWell="${w}" uid=""><name/></wellbore></wellbores>`,'returnElements=id-only');return kids(xml(j.xml),'wellbore').map(b=>({uid:b.getAttribute('uid'),name:txt(b,'name')||b.getAttribute('uid')}))}
async function listLogs(w,b){const j=await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${w}" uidWellbore="${b}" uid=""/></logs>`,'returnElements=header-only');
 return kids(xml(j.xml),'log').map(l=>({uid:l.getAttribute('uid'),name:txt(l,'name'),nameWell:txt(l,'nameWell'),indexType:txt(l,'indexType'),indexCurve:txt(l,'indexCurve'),start:txt(l,'startDateTimeIndex')||txt(l,'startIndex'),end:txt(l,'endDateTimeIndex')||txt(l,'endIndex'),
  curves:kids(l,'logCurveInfo').map(c=>({mn:txt(c,'mnemonic'),unit:txt(c,'unit')}))}))}
function autoMap(curves){for(const c of curves){if(CFG.map[c.mn]!==undefined)continue;const a=AUTO.find(([re])=>re.test(c.mn));CFG.map[c.mn]=a?a[1]:''}}
// ---- polling: get only rows after the last index ----
async function poll(){const L=WML.log;if(!L)return;const time=/time/i.test(L.indexType);let q;
 if(WML.last==null){// first poll: last ~60 s (time) or ~30 ft (depth) before the end index
  const st=time?new Date(Date.parse(L.end)-60000).toISOString():String((+L.end||0)-30);q=time?`<startDateTimeIndex>${st}</startDateTimeIndex>`:`<startIndex uom="ft">${st}</startIndex>`}
 else q=time?`<startDateTimeIndex>${WML.last}</startDateTimeIndex>`:`<startIndex uom="ft">${WML.last}</startIndex>`;
 try{const j=await call('WMLS_GetFromStore','log',`<logs ${NS}><log uidWell="${L.w}" uidWellbore="${L.b}" uid="${L.uid}">${q}<logData><mnemonicList/><data/></logData></log></logs>`,'returnElements=data-only;maxReturnNodes=500');
  WML.polls++;const d=xml(j.xml);const ml=txt(d,'mnemonicList').split(',').map(s=>s.trim()),ul=txt(d,'unitList').split(',');let rows=kids(d,'data').map(n=>n.textContent.split(','));
  const ix=Math.max(0,ml.indexOf(L.indexCurve));const key=r=>time?Date.parse(r[ix]):+r[ix];if(WML.last!=null){const lk=time?Date.parse(WML.last):+WML.last;rows=rows.filter(r=>key(r)>lk)}
  if(rows.length){const r=rows.at(-1);WML.last=r[ix];WML.rows+=rows.length;WML.fresh=Date.now();
   ml.forEach((mn,i)=>{if(i==ix)return;const v=r[i]===''||r[i]==null?null:+r[i];const ch=WML.channels[mn]||(WML.channels[mn]={unit:ul[i]||'',log:L.name});ch.v=isFinite(v)?v:null;ch.map=CFG.map[mn]||''});apply()}
  setSt((WML.simulated?'SIMULATED TEST DATA':'LIVE')+' · '+L.name+' · last index '+WML.last+' · rows '+WML.rows+' · polls '+WML.polls)}
 catch(e){WML.errors++;setSt('poll error: '+e.message+' (game keeps running on sim)',true)}renderMap()}
const FEEDSIG=['spp','Q','hook','wob','rpm','md','quill'];
function apply(){const vals={};for(const [mn,s] of Object.entries(CFG.map)){const v=WML.channels[mn]?.v;if(!s||v==null)continue;if(FEEDSIG.includes(s))vals[s]=v}
 if(Object.keys(vals).length){GX.feedPush(vals,WML.simulated?'SIMULATED WITSML test store':'WITSML '+WML.log.name);for(const k in vals)if(C.SRC[k]!='live'){C.SRC[k]='live'}C.sigRender()}}
function drive(){// every sim step: hold pump SPM and top-drive torque at their mapped live values while the data is fresh
 if(Date.now()-WML.fresh>15000)return;for(const [mn,s] of Object.entries(CFG.map)){const v=WML.channels[mn]?.v;if(v==null||!s)continue;
  const m=s.match(/^p(\d)\.spm$/);if(m){const p=S.pumps.find(p=>p.id==+m[1]);if(p){p.on=v>0;p.cmd=v;p.spm=v}}else if(s=='tq'){S.td.torque=v;S.td.tq=v}}}
async function start(L){stop(true);WML.log=L;WML.last=null;WML.rows=0;WML.polls=0;WML.channels={};WML.simulated=/SIMULATED/i.test(L.nameWell+' '+L.name)||/\/sim\/witsml/.test(CFG.url);autoMap(L.curves);saveCfg();
 S.events.push([S.t,'WITSML connected: '+L.name+(WML.simulated?' (SIMULATED test store)':'')]);await poll();WML.timer=setInterval(poll,Math.max(500,CFG.interval))}
function stop(quiet){if(WML.timer)clearInterval(WML.timer);WML.timer=null;WML.fresh=0;if(!quiet){WML.log=null;setSt('not connected');for(const k of FEEDSIG)if(C.SRC[k]=='live')C.SRC[k]='sim';C.sigRender()}}
// ---- UI ----
let P;function ui(){const b=el('button','background:#2c5d9e;color:#fff;font-weight:700','🛰 WITSML');b.id='wbtn';b.onclick=()=>toggle();$('hud').appendChild(b)}
function toggle(v){if(P&&v!==true){P.remove();P=null;return}if(P)return;P=el('div',PANEL+';left:50%;top:50px;transform:translateX(-50%);width:560px;max-height:80vh;overflow:auto');P.id='witsml';
 P.innerHTML=`<b style="color:#8fd">WITSML live data</b> <small>1.4.1.1 SOAP · WMLS_GetFromStore · well → wellbore → log</small>
 <div style="display:grid;grid-template-columns:110px 1fr;gap:3px;margin-top:4px">
 <span>Protocol</span><select id=wproto><option value=soap>WITSML 1.4.1.1 SOAP (via proxy)</option><option value=etp disabled>WITSML 2.0 ETP 1.2 WebSocket (not in this build)</option></select>
 <span>Proxy</span><input id=wproxy value="${CFG.proxy}"><span>Server URL</span><input id=wurl value="${CFG.url}">
 <span>Username</span><input id=wuser autocomplete=off placeholder="session only, never saved"><span>Password</span><input id=wpass type=password autocomplete=new-password placeholder="session only, never saved">
 <span>Poll every</span><span><input id=wint style="width:60px" value="${CFG.interval}"> ms</span></div>
 <button id=wcon style="${BTN}">Connect + list wells</button><button id=wsim style="${BTN}">Use SIMULATED test store</button><button id=wstop style="${BTN}">Disconnect</button><button id=wx style="${BTN}">Close</button>
 <div style="margin:4px 0">Well <select id=wwell style="max-width:150px"></select> Wellbore <select id=wwb style="max-width:130px"></select> Log <select id=wlog style="max-width:170px"></select> <button id=wgo style="${BTN}">▶ Start live</button></div>
 <div>Status: <span id=wst style="color:#fd8">${WML.status}</span></div><div id=wlinfo style="color:#9ab;font-size:11px"></div>
 <div id=wmap style="margin-top:4px"></div>
 <small style="color:#9ab">Start the proxy on your PC: <code>node witsml_proxy.mjs</code> (needed for CORS/SOAP). Credentials are sent per request to your proxy only, held in this tab's memory and cleared on Disconnect. Every curve is also addable in 📈 Traces → "WITSML channel". ETP 2.0 (Avro binary over WebSocket) is not implemented yet.</small>`;
 document.body.appendChild(P);let logs=[];
 const read=()=>{CFG.proxy=$('wproxy').value.trim();CFG.url=$('wurl').value.trim();CFG.interval=+$('wint').value||2000;CRED.user=$('wuser').value;CRED.pass=$('wpass').value;saveCfg()};
 const fill=(id,arr)=>{$(id).innerHTML=arr.map(o=>`<option value="${o.uid}">${o.name.replace(/</g,'&lt;')}</option>`).join('')};
 const wbs=async()=>{try{fill('wwb',await listWellbores($('wwell').value));await lgs()}catch(e){setSt('error: '+e.message,true)}};
 const lgs=async()=>{try{logs=await listLogs($('wwell').value,$('wwb').value);fill('wlog',logs.map(l=>({uid:l.uid,name:l.name+' ['+(/time/i.test(l.indexType)?'time':'depth')+']'})));info()}catch(e){setSt('error: '+e.message,true)}};
 const info=()=>{const l=logs.find(l=>l.uid==$('wlog').value);$('wlinfo').textContent=l?`${l.indexType} · index ${l.indexCurve} · ${l.start} → ${l.end} · ${l.curves.length} curves: ${l.curves.map(c=>c.mn).join(', ')}`:'';if(l){autoMap(l.curves);WML.preview=l;renderMap()}};
 $('wcon').onclick=async()=>{read();setSt('connecting…');try{const v=await call('WMLS_GetVersion');setSt('connected · server versions '+(v.version||'?'));fill('wwell',await listWells());await wbs()}catch(e){setSt('error: '+e.message+' — is the proxy running?',true)}};
 $('wsim').onclick=()=>{$('wurl').value=CFG.proxy.replace(/\/soap$/,'/sim/witsml');$('wcon').click()};
 $('wwell').onchange=wbs;$('wwb').onchange=lgs;$('wlog').onchange=info;$('wstop').onclick=()=>{stop();CRED={user:'',pass:''};$('wuser').value=$('wpass').value=''};$('wx').onclick=()=>toggle();
 $('wgo').onclick=()=>{read();const l=logs.find(l=>l.uid==$('wlog').value);if(!l)return setSt('pick a log first',true);start({...l,w:$('wwell').value,b:$('wwb').value})};renderMap()}
function renderMap(){const m=$('wmap');if(!m)return;const L=WML.log||WML.preview;if(!L){m.innerHTML='';return}
 m.innerHTML=`<b>Mnemonic → game signal</b> <small>(auto-mapped; change any; unmapped curves are still traceable)</small><table style="font-size:11px;width:100%">`+L.curves.filter(c=>c.mn!=L.indexCurve).map(c=>{const ch=WML.channels[c.mn];
  return `<tr><td>${c.mn}</td><td>${c.unit}</td><td>${ch?.v??'—'}</td><td><select data-mn="${c.mn}"><option value="">(trace only)</option>${Object.entries(SIGNALS).map(([k,n])=>`<option value="${k}" ${CFG.map[c.mn]==k?'selected':''}>${n}</option>`).join('')}</select></td><td><button data-tr="${c.mn}">📈</button></td></tr>`}).join('')+'</table>';
 m.querySelectorAll('[data-mn]').forEach(s=>s.onchange=()=>{CFG.map[s.dataset.mn]=s.value;saveCfg();if(WML.channels[s.dataset.mn])WML.channels[s.dataset.mn].map=s.value});
 m.querySelectorAll('[data-tr]').forEach(b=>b.onclick=()=>GX.traces.addTrack('wml:'+b.dataset.tr))}
export function init(ctx){C=ctx;S=C.S;el=C.el;PANEL=C.PANEL;BTN=C.BTN||'';ui();
 const E=window.EXT,o=E.afterStep.bind(E);E.afterStep=()=>{o();drive()};
 Object.assign(window.GX,{witsml:{WML,CFG,open:()=>toggle(true),start,stop,poll,listWells,listWellbores,listLogs,setCred:(u,p)=>{CRED={user:u,pass:p}}}})}
