// /witsml-machine port of the echo-guard review gaps (G1-G6). Synthetic data only, no network.
import assert from "node:assert/strict";
import https from "node:https";
import { after, test } from "node:test";
import { createVerifiedDispatch, enforceMachinePolicy } from "../netlify/lib/machine-policy.mjs";
import { adaptMachineResult } from "../netlify/lib/machine-reader-adapter.mjs";

const USER = "rig-user-id";
const KEY = "synthetic-not-real-caller-key-0123456789abcd";
const PASSWORD = "SynthPAD";
let netCalls = 0;
let dispatched = 0;
https.request = () => { netCalls += 1; throw new Error("network forbidden"); };
https.get = () => { netCalls += 1; throw new Error("network forbidden"); };
globalThis.fetch = () => { netCalls += 1; throw new Error("network forbidden"); };
after(() => { assert.equal(netCalls, 0); });

const basic = (password) => "Basic " + Buffer.from(USER + ":" + password).toString("base64");
const TOKEN = basic(PASSWORD).slice(6);
const SECRETS = [PASSWORD, USER + ":" + PASSWORD, TOKEN, KEY];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const refs = (s, width) => [...s].map((c) => "&#x" + c.codePointAt(0).toString(16).padStart(width, "0") + ";").join("");
const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const wells = (name, prolog = "") => `${prolog}<wells ${NS}><well uid="SYNTH-W1"><name>${name}</name></well></wells>`;

function fakeHttps(text) {
  return {
    Agent: class { constructor(opts) { this.opts = { ...opts }; } destroy() {} },
    request(_options, cb) {
      dispatched += 1;
      const req = {
        on() { return req; },
        write() { return true; },
        end() {
          const res = {
            statusCode: 200, headers: {},
            on(ev, fn) { if (ev === "data") fn(Buffer.from(text)); if (ev === "end") fn(); return res; },
          };
          cb(res);
        },
        destroy() {},
      };
      return req;
    },
  };
}
const ok = (innerXml, supp = "") => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${esc(innerXml)}</XMLout><SuppMsgOut>${esc(supp)}</SuppMsgOut></q1:WMLS_GetFromStoreResponse></soap:Body></soap:Envelope>`;
const fault = (text) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>${esc(text)}</faultstring></soap:Fault></soap:Body></soap:Envelope>`;

let seq = 0;
async function call(soap, auth = basic(PASSWORD)) {
  seq += 1;
  const res = await enforceMachinePolicy(new Request("https://machine.invalid/witsml-machine", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-witsml-machine-key": KEY,
      "x-witsml-authorization": auth,
      "x-nf-client-connection-ip": "198.51.100." + (seq % 200 + 1),
    },
    body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "well", query: "<wells/>", options: "returnElements=id-only" }),
  }), {
    callerSecret: KEY,
    dispatch: createVerifiedDispatch(fakeHttps(soap), { schedule(fn, ms) { return { fn, ms }; }, cancel() {} }),
    now: () => 1,
  });
  const raw = await res.text();
  let body = {};
  try { body = JSON.parse(raw); } catch { /* closed body */ }
  return { status: res.status, raw, body };
}
function refused(out, reason, label) {
  assert.equal(out.status, 502, label + ": " + out.raw.slice(0, 200));
  assert.equal(out.body.reason, reason, label + ": " + out.raw.slice(0, 200));
  for (const secret of SECRETS) assert.equal(out.raw.includes(secret), false, label + " leaks");
  assert.throws(() => adaptMachineResult(out.body, "WMLS_GetFromStore"), (err) => err.code === "MACHINE_REFUSED" && err.reason === reason, label);
}

test("G1: password split by a tag whose attribute holds '>' is refused", async () => {
  refused(await call(ok(wells(PASSWORD.slice(0, 3) + '<x a=">"/>' + PASSWORD.slice(3)))), "credential-reflection", "dq");
  refused(await call(ok(wells(PASSWORD.slice(0, 3) + "<x a='>'/>" + PASSWORD.slice(3)))), "credential-reflection", "sq");
});

test("G2: zero-padded character references (9 and 16 hex, 11 decimal) are refused", async () => {
  refused(await call(ok(wells(refs(PASSWORD, 9)))), "credential-reflection", "hex9");
  refused(await call(ok(wells(refs(PASSWORD, 16)))), "credential-reflection", "hex16");
  const dec11 = [...PASSWORD].map((c) => "&#" + String(c.codePointAt(0)).padStart(11, "0") + ";").join("");
  refused(await call(ok(wells(dec11))), "credential-reflection", "dec11");
  refused(await call(ok(wells("x"), refs(TOKEN, 9))), "credential-reflection", "token in supp");
});

test("G3: DOCTYPE / ENTITY declarations are refused as unsafe-markup, with or without the password", async () => {
  const split = `<!DOCTYPE wells [<!ENTITY a "${PASSWORD.slice(0, 3)}"><!ENTITY b "${PASSWORD.slice(3)}">]>`;
  refused(await call(ok(wells("&a;&b;", split))), "unsafe-markup", "split entities");
  refused(await call(ok(wells("plain", "<!DOCTYPE wells>"))), "unsafe-markup", "bare doctype");
  refused(await call(ok(wells("plain"), "see <!ENTITY x 'y'>")), "unsafe-markup", "entity in supp");
  refused(await call(ok(wells("plain"), "&lt;!doctype x&gt;")), "unsafe-markup", "escaped lowercase doctype in supp");
});

test("G4: a decoded password past the 300-character fault cut is refused", async () => {
  for (const at of [282, 294, 299, 320]) {
    refused(await call(fault("x".repeat(at) + PASSWORD.slice(0, 4) + "<!-- -->" + PASSWORD.slice(4))), "credential-reflection", "fault@" + at);
  }
  const clean = await call(fault("y".repeat(400)));
  assert.equal(clean.status, 200, clean.raw.slice(0, 200));
  assert.equal(clean.body.error, "SOAP fault: " + "y".repeat(300));
});

test("G5: malformed Basic headers never reach the store", async () => {
  for (const auth of ["Basic AAA=" + TOKEN, "Basic " + TOKEN + "=", "Basic " + TOKEN.slice(1), "Basic  " + TOKEN]) {
    const before = dispatched;
    const out = await call(ok(wells("plain")), auth);
    assert.notEqual(out.status, 200, auth.length + " " + out.raw.slice(0, 120));
    assert.equal(dispatched, before, "dispatched with malformed header");
    for (const secret of SECRETS) assert.equal(out.raw.includes(secret), false);
  }
});

test("G6: 20k unterminated comment/CDATA/PI/quote openers stay linear and correct", async () => {
  for (const [label, flood] of [["comment", "<!--"], ["cdata", "<![CDATA["], ["pi", "<?"], ["quote", '<a b="']]) {
    const start = performance.now();
    const out = await call(ok(wells("plain"), flood.repeat(20000)));
    const ms = performance.now() - start;
    assert.ok(ms < 400, label + " took " + ms.toFixed(0) + " ms");
    assert.ok(out.status === 200 || out.status === 502, label + " " + out.status);
    for (const secret of SECRETS) assert.equal(out.raw.includes(secret), false);
  }
});

test("CDATA and comment splits are refused (also open at 22285bf); clean and literal-password replies still 200", async () => {
  const clean = await call(ok(wells("Clean &amp; Co")));
  assert.equal(clean.status, 200, clean.raw.slice(0, 200));
  assert.equal(clean.body.result, 1);
  assert.equal(clean.body.passwordRedacted, undefined);
  const literal = await call(ok(wells(PASSWORD + "-1")));
  assert.equal(literal.status, 200, literal.raw.slice(0, 200));
  assert.equal(literal.body.passwordRedacted, true);
  assert.deepEqual(literal.body.redactedSlots, ["well-name/1"]);
  assert.equal(literal.raw.includes(PASSWORD), false);
  refused(await call(ok(wells(PASSWORD.slice(0, 3) + "<![CDATA[" + PASSWORD.slice(3) + "]]>"))), "credential-reflection", "cdata");
  refused(await call(ok(wells(PASSWORD.slice(0, 3) + "<!-- c -->" + PASSWORD.slice(3)))), "credential-reflection", "comment");
});
