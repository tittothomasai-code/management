// Credential echo tests for drilling/witsml-proxy.mjs (PR #22 review B1).
// Synthetic only: SYNTH-* ids, fake passwords, injected transport, node:https stubbed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ask, NS, esc, basic } from './witsml_proxy_fixture.mjs';
import { credentialSecrets, decodedViews, echoes, echoRefusal } from '../drilling/witsml-echo-guard.mjs';

// Same bytes as netlify-proxy/netlify/lib/witsml-echo-guard.mjs and
// supabase/functions/witsml-proxy/witsml-echo-guard.mjs on the deployed-path branch.
export const ECHO_GUARD_SHA256 = '34a4c3ed3fa0e79fdd3a3451b4c30316c779c25082410a314d5089972eeb64a1';
const guardBytes = readFileSync(new URL('../drilling/witsml-echo-guard.mjs', import.meta.url));
assert.equal(createHash('sha256').update(guardBytes).digest('hex'), ECHO_GUARD_SHA256);
assert.equal(/console\./.test(guardBytes.toString()), false, 'guard must not log');
assert.equal(/console\./.test(readFileSync(new URL('../drilling/witsml-proxy.mjs', import.meta.url), 'utf8')), false, 'proxy must not log');

const logged = [];
for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
  const orig = console[method].bind(console);
  console[method] = (...args) => { logged.push(args.map(String).join(' ')); orig(...args); };
}

const PASSWORDS = {
  plain: 'FAKE-PW-123',
  special: 'Synth<&Pw9',
  quotes: `Sy"nth'Pw>9`,
  cdataEnd: 'Pw]]>Synth9',
  unicode: 'Pässwört€9',
  ampOnly: 'a&b&c&d1',
};
const USER = 'synth-user';
const secretsOf = (password) => [password, USER + ':' + password, basic(USER, password), basic(USER, password).slice(6)];
function noLeak(result, password, label) {
  const parsed = JSON.stringify(result.body);
  for (const secret of secretsOf(password)) {
    assert.equal(result.text.includes(secret), false, label + ': raw body leak');
    assert.equal(parsed.includes(secret), false, label + ': parsed leak');
  }
  assert.equal(echoes(result.body, secretsOf(password)), false, label + ': decoded leak');
}
function refused(result, password, label) {
  assert.equal(result.status, 422, label + ': status ' + result.status + ' ' + result.text.slice(0, 120));
  assert.equal(result.body.code, 'proxy-refusal', label);
  assert.equal('xml' in result.body, false, label + ': no document');
  assert.equal('supp' in result.body, false, label + ': no supp');
  noLeak(result, password, label);
}
const entityDec = (s) => [...s].map((c) => '&#' + c.codePointAt(0) + ';').join('');
const entityHex = (s) => [...s].map((c) => '&#x' + c.codePointAt(0).toString(16) + ';').join('');
const well = (name, extra = '') => `<wells ${NS}><well uid="SYNTH-W1"><name>${name}</name>${extra}</well></wells>`;

let cases = 0;
// 1. Controls: no echo stays a 200 with the document, entities in clean data are fine.
for (const [kind, password] of Object.entries(PASSWORDS)) {
  const clean = await ask({ xml: well('Synth &amp; Co &#169; &lt;A&gt;'), supp: 'ok' }, { password });
  assert.equal(clean.status, 200, kind + ' clean');
  assert.match(clean.body.xml, /Synth &amp; Co/);
  assert.equal(clean.body.passwordRedacted, undefined);
  noLeak(clean, password, kind + ' clean'); cases++;
}

// 2. SuppMsgOut echoes.
for (const [kind, password] of Object.entries(PASSWORDS)) {
  const literal = await ask({ xml: well('Synth'), supp: 'bad password ' + password, result: '-1' }, { password });
  assert.equal(literal.status, 200, kind + ' supp literal');
  assert.deepEqual(literal.body.redactedSlots, ['supp/1']);
  assert.equal(literal.body.supp, 'bad password ***');
  noLeak(literal, password, kind + ' supp literal'); cases++;
  for (const [form, encoded] of [['dec', entityDec(password)], ['hex', entityHex(password)], ['double', esc(esc(password))]]) {
    if (encoded === password) continue; // literal form, covered above
    refused(await ask({ xml: well('Synth'), supp: 'bad ' + encoded }, { password }), password, `${kind} supp ${form}`); cases++;
  }
  refused(await ask({ supp: 'pair ' + USER + ':' + password }, { password }), password, kind + ' supp pair'); cases++;
}

// 3. SOAP fault echoes, HTTP 200 and 500.
for (const [kind, password] of Object.entries(PASSWORDS)) {
  for (const status of [200, 500]) {
    const literal = await ask({ fault: 'login ' + password + ' rejected' }, { password, status });
    assert.equal(literal.status, 200, `${kind} fault literal ${status}`);
    assert.deepEqual(literal.body.redactedSlots, ['fault/1']);
    assert.equal(literal.body.error, 'SOAP fault: login *** rejected');
    noLeak(literal, password, `${kind} fault literal ${status}`); cases++;
    for (const [form, encoded] of [['dec', entityDec(password)], ['hex', entityHex(password)], ['double', esc(esc(password))]]) {
      if (encoded === password) continue; // literal form, covered above
      refused(await ask({ fault: 'login ' + encoded }, { password, status }), password, `${kind} fault ${form} ${status}`); cases++;
    }
    refused(await ask({ fault: 'auth ' + basic(USER, password) }, { password, status }), password, `${kind} fault header ${status}`); cases++;
  }
}

// 4. Encoded echoes inside the inner document (XMLout) and CapabilitiesOut.
for (const [kind, password] of Object.entries(PASSWORDS)) {
  const half = Math.max(1, Math.floor([...password].length / 2));
  const head = [...password].slice(0, half).join(''), tail = [...password].slice(half).join('');
  const forms = {
    escaped: esc(password),
    attrEscaped: esc(password).replace(/"/g, '&quot;').replace(/'/g, '&apos;'),
    dec: entityDec(password),
    hex: entityHex(password),
    mixed: [...password].map((c, i) => i % 2 ? '&#' + c.codePointAt(0) + ';' : esc(c)).join(''),
    double: esc(esc(password)),
    cdataSplit: `<![CDATA[${head.replace(/]]>/g, ']]]]><![CDATA[>')}]]><![CDATA[${tail.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`,
    commentSplit: esc(head) + '<!-- SYNTH -->' + esc(tail),
    tagSplit: esc(head) + '<b/>' + esc(tail),
  };
  for (const [form, encoded] of Object.entries(forms)) {
    if (encoded === password) continue; // literal form, see section 5
    refused(await ask({ xml: well(encoded) }, { password }), password, `${kind} xml ${form}`); cases++;
  }
  refused(await ask({ xml: well('Synth', `<field>${entityDec(USER + ':' + password)}</field>`) }, { password }), password, kind + ' xml pair'); cases++;
  refused(await ask({ raw: `<Result>1</Result><CapabilitiesOut>${esc(`<capServers ${NS}><capServer><contact><name>${entityDec(password)}</name></contact></capServer></capServers>`)}</CapabilitiesOut>` }, { password, op: 'WMLS_GetCap' }), password, kind + ' cap dec'); cases++;
  refused(await ask({ raw: `<Result>${entityDec(password)}</Result>` }, { password, op: 'WMLS_GetVersion' }), password, kind + ' version dec'); cases++;
}

// 5. Literal echo of a special-character password inside the inner document.
// A conforming store escapes it, so the proxy sees an encoded form and refuses.
for (const [kind, password] of Object.entries(PASSWORDS)) {
  const result = await ask({ xml: well(esc(password)) }, { password });
  if (password === esc(password)) {
    assert.equal(result.status, 200, kind + ' literal well-name redacts');
    assert.deepEqual(result.body.redactedSlots, ['well-name/1']);
    noLeak(result, password, kind + ' literal well-name');
  } else {
    refused(result, password, kind + ' escaped well-name');
  }
  cases++;
}

// 6. Module-level checks.
const s = credentialSecrets(basic(USER, PASSWORDS.special));
assert.deepEqual(s.slice(0, 2), [PASSWORDS.special, USER + ':' + PASSWORDS.special]);
assert.ok(decodedViews('a&amp;amp;lt;b').includes('a<b'));
assert.equal(echoes({ xml: 'Synth&#xZZ;' }, s), false);
assert.equal(echoes({ xml: '&#1114112;&#99999999999;' }, s), false);
assert.deepEqual(echoRefusal(['proxy refusal']), { result: -1, code: 'proxy-refusal', reason: 'credential-reflection' });
assert.deepEqual(echoRefusal(['proxy-refusal', 'proxy refusal', 'credential-reflection']), { result: -1 });
assert.deepEqual(echoRefusal(['result']), { error: 'proxy refusal', code: 'proxy-refusal', reason: 'credential-reflection' });
assert.equal(credentialSecrets('Bearer x').length, 0);

assert.equal(logged.some((line) => Object.values(PASSWORDS).some((p) => line.includes(p))), false, 'no password in logs');
console.log(`PASS witsml echo guard: ${cases} proxy cases (SuppMsgOut, SOAP fault 200/500, encoded XMLout/Cap/Result, special-character passwords), guard sha256 pinned`);
