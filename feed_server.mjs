// Local test feed server (no dependencies). Streams sample_sequence.csv (SIMULATED data) to the game:
//   WebSocket: ws://localhost:8795/ws          (push, JSON per row; add ?fmt=witsml for WITSML-style logData)
//   HTTP poll: http://localhost:8795/latest    (GET latest row as JSON; ?fmt=witsml supported)
// Usage: node feed_server.mjs [csv] [port] [rows_per_sec]
import http from 'http';import fs from 'fs';import crypto from 'crypto';
const file=process.argv[2]||new URL('./sample_sequence.csv',import.meta.url).pathname,PORT=+process.argv[3]||8795,RATE=+process.argv[4]||4;
const L=fs.readFileSync(file,'utf8').trim().split(/\r?\n/),H=L[0].split(',');const rows=L.slice(1).map(l=>{const c=l.split(','),o={};H.forEach((k,i)=>o[k]=isNaN(+c[i])||c[i]===''?c[i]:+c[i]);return o});
const TAG={spp_psi:'SPPA',flow_gpm:'MFIA',hookload_klbf:'HKLA',wob_klbf:'SWOB',td_rpm:'RPMA',md_ft:'DMEA',quill_m:'BPOS',slips:'SLIPS'};
let i=0;const cur=()=>({...rows[i%rows.length],source:'SIMULATED test feed',seq:i});
const fmt=(o,w)=>w?{logData:{mnemonicList:['TIME',...Object.values(TAG)].join(','),data:[[o.time_s,...Object.keys(TAG).map(k=>o[k])].join(',')]},source:o.source}:o;
const clients=new Set();
function frame(s){const b=Buffer.from(s);const h=b.length<126?Buffer.from([0x81,b.length]):Buffer.from([0x81,126,b.length>>8,b.length&255]);return Buffer.concat([h,b])}
const srv=http.createServer((q,r)=>{const u=new URL(q.url,'http://x');r.setHeader('Access-Control-Allow-Origin','*');r.setHeader('Access-Control-Allow-Private-Network','true');
 if(q.method=='OPTIONS'){r.writeHead(204,{'Access-Control-Allow-Headers':'*'});return r.end()}
 if(u.pathname=='/latest'){r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(fmt(cur(),u.searchParams.get('fmt')=='witsml')))}
 r.writeHead(200,{'Content-Type':'text/plain'});r.end('Drilling World test feed (SIMULATED). /latest or ws /ws')});
srv.on('upgrade',(q,sock)=>{const k=q.headers['sec-websocket-key'];const acc=crypto.createHash('sha1').update(k+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
 const c={sock,w:new URL(q.url,'http://x').searchParams.get('fmt')=='witsml'};clients.add(c);sock.on('close',()=>clients.delete(c));sock.on('error',()=>clients.delete(c));
 sock.on('data',d=>{if((d[0]&15)==8){clients.delete(c);sock.end()}})});
setInterval(()=>{i++;for(const c of clients)try{c.sock.write(frame(JSON.stringify(fmt(cur(),c.w))))}catch{}},1000/RATE);
srv.listen(PORT,()=>console.log(`Test feed (SIMULATED) on :${PORT}  ws://localhost:${PORT}/ws  http://localhost:${PORT}/latest  rows=${rows.length}`));
