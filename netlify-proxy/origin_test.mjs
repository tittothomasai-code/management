import assert from 'node:assert/strict';
import {makeProxy} from './netlify/lib/core.mjs';
const fn=makeProxy({upstream:'https://australia.adagasolutions.com/WMLS',skipHost:'australia.adagasolutions.com',perMin:60});
for(const origin of ['https://drilling.robotyx.systems','https://tittothomasai-code.github.io']){
 const request=method=>new Request('https://proxy/witsml-proxy',{method,headers:{Origin:origin}});
 const r=await fn(request('OPTIONS'));
 assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
 const policy=await (await fn(request('GET'))).json();
 assert.equal(policy.storesCredentials,false);assert.equal(policy.rateLimitPerMin,60);
 assert.deepEqual(policy.ops,['WMLS_GetVersion','WMLS_GetCap','WMLS_GetFromStore']);
}
for(const origin of ['https://evil.example','https://drilling.robotyx.systems.evil.example','null']){
 const r=await fn(new Request('https://proxy/',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(r.status,403);
}
assert.equal((await fn(new Request('https://proxy/',{method:'OPTIONS'}))).status,403);
console.log('PASS exact approved origins; other/missing origins denied; read-only policy unchanged');
