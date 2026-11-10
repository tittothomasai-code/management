// Review 3 on the machine route: P3 one-pass redaction cost, L3 markup splits, L4 &#x;.
// Synthetic values only. Sockets are blocked.
import assert from "node:assert/strict";
import https from "node:https";
import { after, test } from "node:test";
import { createVerifiedDispatch, enforceMachinePolicy } from "../netlify/lib/machine-policy.mjs";
import { adaptMachineResult } from "../netlify/lib/machine-reader-adapter.mjs";

const USER = "rig-user-id";
const KEY = "synthetic-not-real-caller-key-0123456789abcd";
const QUERY = "<wells/>";
let netCalls = 0;
https.request = () => { netCalls += 1; throw new Error("network forbidden"); };
https.get = () => { netCalls += 1; throw new Error("network forbidden"); };
globalThis.fetch = () => { netCalls += 1; throw new Error("network forbidden"); };
after(() => {
  assert.equal(netCalls, 0);
});

function authFor(password, user = USER) {
  return "Basic " + Buffer.from(user + ":" + password).toString("base64");
}
function fakeHttps(text) {
  return {
    Agent: class { constructor(opts) { this.opts = { ...opts }; } destroy() {} },
    request(_options, cb) {
      const req = {
        on() { return req; },
        write() { return true; },
        end() {
          const res = {
            statusCode: 200,
            headers: {},
            on(ev, fn) {
              if (ev === "data" && text) fn(Buffer.from(text));
              if (ev === "end") fn();
              return res;
            },
          };
          cb(res);
        },
        destroy() {},
      };
      return req;
    },
  };
}
function deps(impl) {
  return {
    callerSecret: KEY,
    dispatch: createVerifiedDispatch(impl, { schedule(fn, ms) { return { fn, ms }; }, cancel() {} }),
    now: () => 1,
  };
}
let seq = 0;
function post(auth) {
  seq += 1;
  return new Request("https://machine.invalid/witsml-machine", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-witsml-machine-key": KEY,
      "x-witsml-authorization": auth,
      "x-nf-client-connection-ip": "203.0.113." + (seq % 200 + 1),
    },
    body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "well", query: QUERY, options: "returnElements=id-only" }),
  });
}
function soap(inner) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
}
function store(xml) {
  const escaped = xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return soap(`<q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${escaped}</XMLout></q1:WMLS_GetFromStoreResponse>`);
}
async function call(xml, password, user = USER) {
  const res = await enforceMachinePolicy(post(authFor(password, user)), deps(fakeHttps(typeof xml === "string" ? xml : store(xml.xml))));
  const raw = await res.text();
  let body = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  return { status: res.status, raw, body };
}

const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const P = "SynthPw-4821";

test("P3: one node with 30k+ HTML-encoded hits (~1.44 MB) redacts well under 9 s", async () => {
  const unit = "Synth&amp;#80;w-4821 ";
  const n = Math.floor(1900 * 1024 / (unit.length + 12));
  assert.ok(n >= 30000, String(n));
  const xml = `<wells ${NS}><well uid="W"><name>${unit.repeat(n)}</name></well></wells>`;
  const t0 = performance.now();
  const out = await call(store(xml), P);
  const ms = performance.now() - t0;
  assert.equal(out.status, 200, out.raw.slice(0, 160));
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.redactionScope, "slots");
  assert.equal(out.raw.includes("Synth&amp;#80;w-4821"), false);
  assert.ok(ms < 3000, "took " + Math.round(ms) + " ms");
});

test("L3: a password split by markup in a mnemonic is refused, never returned", async () => {
  const mn = (m) => `<logs ${NS}><log uidWell="W" uidWellbore="B" uid="L"><name>n</name><logCurveInfo uid="c1"><mnemonic>${m}</mnemonic><unit>m</unit></logCurveInfo></log></logs>`;
  for (const m of ["&lt;xmp&gt;&lt;!--&lt;/xmp&gt;Synth&lt;!--&gt;Pw-4821", "Synth&lt;B&gt;Pw-4821"]) {
    const out = await call(store(mn(m)), P);
    assert.notEqual(out.status, 200, m);
    assert.equal(out.body.reason, "credential-reflection", m);
    assert.equal(out.raw.includes("Pw-4821"), false, m);
  }
});

test("L4: &#x; is U+FFFD, so an FFFD password is redacted", async () => {
  const pw = "Qz\ufffdZq99";
  const out = await call(store(`<wells ${NS}><well uid="W"><name>Qz&amp;#x;Zq99</name></well></wells>`), pw);
  assert.equal(out.status, 200, out.raw.slice(0, 160));
  assert.equal(out.body.passwordRedacted, true);
  assert.deepEqual(out.body.redactedSlots, ["well-name/1"]);
  assert.equal(out.raw.includes("Qz&amp;#x;Zq99"), false);
});
