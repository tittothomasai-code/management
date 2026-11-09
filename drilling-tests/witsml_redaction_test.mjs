import assert from 'node:assert/strict';
import https from 'node:https';
import { parseLogs, parseTraj } from '../drilling/wdash_core.js';
import { contractFromListed } from '../drilling/rtoc_summary.js';
import { feedSource } from '../drilling/operations_data.js';
import { makeProxy } from '../drilling/witsml-proxy.mjs';
import { prepareReply, readKnownWell } from '../drilling/wwell.js';

https.request = () => { throw new Error('live https blocked'); };

const PASSWORD = 'FAKE-PW-123';
const USER = 'synth-user';
const UPSTREAM = 'https://australia.adagasolutions.com/WMLS';
const AUTH = 'Basic ' + Buffer.from(USER + ':' + PASSWORD).toString('base64');
const PAIR = USER + ':' + PASSWORD;
const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const leaked = [];
for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
  const orig = console[method].bind(console);
  console[method] = (...args) => {
    const line = args.map((item) => String(item)).join(' ');
    if (line.includes(PASSWORD) || line.includes(PAIR) || line.includes(AUTH)) leaked.push(method);
    orig(...args);
  };
}
const quiet = (body) => {
  const text = JSON.stringify(body);
  assert.equal(text.includes(PASSWORD), false);
  assert.equal(text.includes(PAIR), false);
  assert.equal(text.includes(AUTH), false);
};
const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const soap = (xml, { result = '1', supp = '', fault = '' } = {}) => {
  const inner = fault
    ? `<faultstring>${esc(fault)}</faultstring>`
    : `<Result>${result}</Result><XMLout>${esc(xml)}</XMLout><SuppMsgOut>${esc(supp)}</SuppMsgOut>`;
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
};
let ip = 20;
async function ask(transport, { op = 'WMLS_GetFromStore', wmlType = 'well', query = '<wells/>', url = UPSTREAM, auth = AUTH, extra = {} } = {}) {
  const proxy = makeProxy({ upstream: UPSTREAM, skipHost: 'australia.adagasolutions.com', perMin: 100000, transport });
  const headers = {
    Origin: 'https://drilling.robotyx.systems',
    'Content-Type': 'application/json',
    'x-nf-client-connection-ip': '203.0.113.' + (ip++),
  };
  if (auth) headers['X-Witsml-Authorization'] = auth;
  const res = await proxy(new Request('https://drilling.robotyx.systems/witsml-proxy', {
    method: 'POST', headers, body: JSON.stringify({ url, op, wmlType, query, options: 'returnElements=all', ...extra }),
  }));
  const body = await res.json();
  quiet(body);
  return { status: res.status, body };
}
const reply = (text) => ask(async () => ({ status: 200, text }));

const cleanWell = `<wells ${NS}><well uid="SYNTH-W-01"><name>Synth North</name></well></wells>`;
const none = await reply(soap(cleanWell));
assert.equal(none.status, 200);
assert.equal(none.body.passwordRedacted, undefined);
assert.equal(none.body.xml, cleanWell);
assert.equal(prepareReply(none.body, 200).reply.xml, cleanWell);

const bare = prepareReply({ result: 1, xml: cleanWell, passwordRedacted: true }, 200);
assert.equal(bare.redactionHold, true);
assert.equal(bare.reply, undefined);

const uidXml = `<wells ${NS}><well uid="${PASSWORD}"><name>Synth North</name></well></wells>`;
const uid = await reply(soap(uidXml));
assert.equal(uid.status, 200);
assert.equal(uid.body.passwordRedacted, true);
assert.equal(uid.body.redactionScope, 'slots');
assert.deepEqual(uid.body.redactedSlots, ['well-uid/1']);
const uidDecision = prepareReply(uid.body, 200);
assert.equal(uidDecision.identityStop, true);
assert.equal(uidDecision.reply, undefined);

const logXml = `<logs ${NS}><log uidWell="SYNTH-W-01" uidWellbore="SYNTH-WB-01" uid="SYNTH-LOG-01"><name>Synth time</name><indexType>date time</indexType><logData><mnemonicList>TIME,DMEA</mnemonicList><unitList>s,m</unitList><data>2020-01-01T00:00:00Z,100</data><data>2020-01-01T00:00:01Z,${PASSWORD}</data></logData></log></logs>`;
const logHit = await reply(soap(logXml));
assert.equal(logHit.status, 200);
assert.equal(logHit.body.redactionScope, 'slots');
assert.ok(logHit.body.redactedSlots.includes('log-data/2'));
const logDecision = prepareReply(logHit.body, 200);
assert.equal(logDecision.reply.redactedFields.some((field) => field.field === 'log-data'), true);
const kept = parseLogs(logDecision.reply.xml);
assert.equal(kept.length, 1);
assert.equal(kept[0].rows.length, 1);
assert.equal(kept[0].rows[0][1], 100);
assert.equal(JSON.stringify(kept).includes(PASSWORD), false);
assert.equal(logDecision.reply.xml.includes('***'), false);

const trajXml = `<trajectorys ${NS}><trajectory uidWell="SYNTH-W-01" uidWellbore="SYNTH-WB-01" uid="SYNTH-TR-01"><name>Synth survey</name><trajectoryStation><md>100</md><incl>1</incl><azi>90</azi></trajectoryStation><trajectoryStation><md>${PASSWORD}</md><incl>2</incl><azi>91</azi></trajectoryStation></trajectory></trajectorys>`;
const traj = await reply(soap(trajXml));
assert.equal(traj.status, 200);
assert.equal(traj.body.redactionScope, 'slots');
assert.equal(traj.body.redactedSlots.some((slot) => slot.startsWith('text/')), true);
const trajDecision = prepareReply(traj.body, 200);
assert.equal(trajDecision.reply.redactedFields.some((field) => field.field === 'trajectory'), true);
const stations = parseTraj(trajDecision.reply.xml);
assert.equal(stations.length, 1);
assert.equal(stations[0].rows.length, 1);
assert.equal(stations[0].rows[0][0], 100);
assert.equal(JSON.stringify(stations).includes(PASSWORD), false);
assert.equal(trajDecision.reply.xml.includes('***'), false);

const structural = `<wells ${NS}><well uid="SYNTH-W-01"><${PASSWORD}>1</${PASSWORD}></well></wells>`;
const refused = await reply(soap(structural));
assert.equal(refused.status, 422);
assert.notEqual(refused.status, 502);
assert.equal(refused.body.code, 'proxy-refusal');
assert.equal(refused.body.xml, undefined);
assert.equal(prepareReply(refused.body, refused.status).refusal, true);

const down = await ask(async () => { const error = new Error('timeout'); error.code = 'ETIMEDOUT'; throw error; });
assert.equal(down.status, 502);
assert.equal(down.body.error, 'upstream timeout');
assert.equal(down.body.xml, undefined);
assert.equal(prepareReply(down.body, 502).transport, true);

const blocked = await reply(soap(`<wells ${NS}><well uid="SYNTH-W-01"><name>${PAIR}</name></well></wells>`));
assert.equal(blocked.status, 422);
assert.equal(blocked.body.xml, undefined);
assert.equal(prepareReply(blocked.body, 422).refusal, true);

const write = await ask(async () => { throw new Error('transport should not run'); }, { op: 'WMLS_AddToStore', wmlType: 'well' });
assert.equal(write.status, 403);
const foreign = await ask(async () => { throw new Error('transport should not run'); }, { url: 'https://example.invalid/WMLS' });
assert.equal(foreign.status, 403);
const missing = await ask(async () => { throw new Error('transport should not run'); }, { auth: '' });
assert.equal(missing.status, 400);
const inBody = await ask(async () => { throw new Error('transport should not run'); }, { extra: { user: USER, pass: PASSWORD } });
assert.equal(inBody.status, 400);

await assert.rejects(
  readKnownWell(async () => ({ result: 1, xml: `<wells ${NS}><well uid="SYNTH-OTHER"><name>Synth North</name></well></wells>` }), 'SYNTH-W-01'),
  /exactly the requested well/,
);

const named = contractFromListed({
  well: { uid: 'SYNTH-W-01', name: 'Synth North' },
  wellbores: [{ uid: 'SYNTH-WB-01', name: 'Synth Bore' }],
  redactedFields: ['name'],
});
const nameFact = named.sourceBackedFacts.wellIdentityAndWellbores.find((fact) => fact.provenance.field === 'name');
const uidFact = named.sourceBackedFacts.wellIdentityAndWellbores.find((fact) => fact.fact === 'Selected well UID');
assert.equal(nameFact.value, 'redacted');
assert.equal(nameFact.flags.redacted, true);
assert.equal(uidFact.value, 'SYNTH-W-01');
assert.notEqual(uidFact.value, 'redacted');

const now = 1_700_000_000_000;
const base = { mode: 'off', connected: true, log: { w: 'SYNTH-W-01', b: 'SYNTH-WB-01', uid: 'SYNTH-LOG-01', indexType: 'date time' }, hist: [{ t: now - 1000 }], lastRowMs: now - 1000, healthy: () => true };
const label = (extra) => feedSource({ ...base, ...extra }, now, { url: 'https://example.com/witsml' }, {});
assert.equal(label({ proxyRefusal: true, connected: false }), 'refused by proxy');
assert.equal(label({ redactionHold: true, connected: false }), 'REDACTED - not imported');
assert.equal(label({ transportDead: 'http-502' }), 'WITSML DISCONNECTED');
assert.equal(leaked.length, 0);
console.log('PASS witsml redaction: none, bare flag, slots, refusal, transport');
