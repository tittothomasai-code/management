// Runs the real drilling/witsml-proxy.mjs handler against a synthetic store
// reply and prints {status, body} for each case as JSON. No network: the
// transport is injected and node:https is stubbed to throw.
// Used by operations_observer_browser_test.py (browser path test) and by
// witsml_echo_guard_test.mjs.
import https from 'node:https';
import { makeProxy } from '../drilling/witsml-proxy.mjs';

https.request = () => { throw new Error('live https blocked'); };

export const UPSTREAM = 'https://australia.adagasolutions.com/WMLS';
export const ORIGIN = 'https://tittothomasai-code.github.io';
export const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
export const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const basic = (user, password) => 'Basic ' + Buffer.from(user + ':' + password, 'utf8').toString('base64');
export function soap({ xml = '', supp = '', fault = '', result = '1', raw } = {}) {
  if (raw !== undefined) return raw;
  const inner = fault
    ? `<soap:Fault><faultcode>soap:Server</faultcode><faultstring>${esc(fault)}</faultstring></soap:Fault>`
    : `<Result>${result}</Result><XMLout>${esc(xml)}</XMLout><SuppMsgOut>${esc(supp)}</SuppMsgOut>`;
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
}
let ip = 0;
export async function ask(reply, { user = 'synth-user', password = 'FAKE-PW-123', op = 'WMLS_GetFromStore', status = 200, wmlType = 'well' } = {}) {
  const proxy = makeProxy({ upstream: UPSTREAM, skipHost: 'australia.adagasolutions.com', perMin: 100000,
    transport: async () => ({ status, text: soap(reply) }) });
  const res = await proxy(new Request('https://proxy.test/witsml-proxy', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Witsml-Authorization': basic(user, password), 'x-nf-client-connection-ip': '10.77.' + Math.floor(ip / 250) + '.' + (ip++ % 250) },
    body: JSON.stringify({ op, url: UPSTREAM, wmlType, query: '<wells/>' }),
  }));
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}

// Browser fixtures: one real refusal, one real redacted reply, one clean reply.
export async function browserFixtures(password = 'FAKE-PW-123') {
  const entity = [...password].map((c) => '&#' + c.codePointAt(0) + ';').join('');
  const refusal = await ask({ xml: `<wells ${NS}><well uid="SYNTH-W1"><name>${entity}</name></well></wells>` }, { password });
  const redacted = await ask({ xml: `<wells ${NS}><well uid="SYNTH-W1"><name>Synth ${password}</name><field>SYNTH-FIELD</field></well></wells>` }, { password });
  const clean = await ask({ xml: `<wells ${NS}><well uid="SYNTH-W1"><name>Synth clean</name></well></wells>` }, { password });
  return { refusal: { status: refusal.status, body: refusal.body }, redacted: { status: redacted.status, body: redacted.body }, clean: { status: clean.status, body: clean.body } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(await browserFixtures(process.argv[2] || 'FAKE-PW-123')));
}
