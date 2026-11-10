// /witsml-machine: shared echo guard, redact-in-place policy (8 Nov). Review cases G1-G6, N1-N9, F1, H5.
// Synthetic data only, no network.
import assert from "node:assert/strict";
import https from "node:https";
import { after, test } from "node:test";
import { createVerifiedDispatch, enforceMachinePolicy } from "../netlify/lib/machine-policy.mjs";
import { adaptMachineResult } from "../netlify/lib/machine-reader-adapter.mjs";
import { slotsMatchDocument } from "../netlify/lib/redaction-slots.mjs";
import { anyViewContains } from "../netlify/lib/witsml-echo-guard.mjs";

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
  assert.equal(anyViewContains(out.raw, SECRETS), false, label + " leaks");
  assert.throws(() => adaptMachineResult(out.body, "WMLS_GetFromStore"), (err) => err.code === "MACHINE_REFUSED" && err.reason === reason, label);
}

function redacted(out, slots, label, password = PASSWORD) {
  assert.equal(out.status, 200, label + ": " + out.raw.slice(0, 200));
  assert.equal(out.body.passwordRedacted, true, label);
  assert.equal(out.body.redactionScope, "slots", label);
  assert.deepEqual(out.body.redactedSlots, slots, label);
  assert.equal(slotsMatchDocument(out.body.xml, slots), true, label + " slots resolve");
  const secrets = [password, USER + ":" + password, basic(password).slice(6), KEY];
  assert.equal(anyViewContains(out.raw, secrets), false, label + " leaks in a decoded view");
  const adapted = adaptMachineResult(out.body, "WMLS_GetFromStore");
  assert.equal(adapted.redactionScope, "slots", label);
}
test("G1 / N1-N3: a password split across markup is refused", async () => {
  const cases = {
    "G1 dq": PASSWORD.slice(0, 3) + '<x a=">"/>' + PASSWORD.slice(3),
    "G1 sq": PASSWORD.slice(0, 3) + "<x a='>'/>" + PASSWORD.slice(3),
    "N1": "<![CDATA[<!--]]>" + PASSWORD.slice(0, 3) + "<b/>" + PASSWORD.slice(3) + "<![CDATA[-->]]>",
    "N2": "<![CDATA[<?]]>" + PASSWORD.slice(0, 3) + "<b/>" + PASSWORD.slice(3) + "<![CDATA[?>]]>",
    "N3": "<![CDATA[<x ]]>" + PASSWORD.slice(0, 3) + "<b/>" + PASSWORD.slice(3) + "<![CDATA[>]]>",
    "comment split": PASSWORD.slice(0, 3) + "<!-- c -->" + PASSWORD.slice(3),
  };
  for (const [label, name] of Object.entries(cases)) refused(await call(ok(wells(name))), "credential-reflection", label);
});

test("G2 / CDATA: padded references and a CDATA-joined text node are redacted in place", async () => {
  const dec11 = [...PASSWORD].map((c) => "&#" + String(c.codePointAt(0)).padStart(11, "0") + ";").join("");
  for (const [label, name] of Object.entries({ hex9: refs(PASSWORD, 9), hex16: refs(PASSWORD, 16), dec11, cdata: PASSWORD.slice(0, 3) + "<![CDATA[" + PASSWORD.slice(3) + "]]>-2" })) {
    const out = await call(ok(wells(name)));
    redacted(out, ["well-name/1"], label);
    assert.match(out.body.xml, /<name>\[redacted\](-2)?<\/name>/, label);
  }
  refused(await call(ok(wells("x"), refs(TOKEN, 9))), "credential-reflection", "token in supp is never redacted");
});

test("G3 / F1: declarations are refused as unsafe-xml; escaped declaration text is data", async () => {
  const split = `<!DOCTYPE wells [<!ENTITY a "${PASSWORD.slice(0, 3)}"><!ENTITY b "${PASSWORD.slice(3)}">]>`;
  refused(await call(ok(wells("&a;&b;", split))), "unsafe-xml", "split entities");
  refused(await call(ok(wells("plain", "<!DOCTYPE wells>"))), "unsafe-xml", "bare doctype");
  refused(await call(ok(wells("plain"), "see <!ENTITY x 'y'>")), "unsafe-xml", "entity in supp");
  const f1 = await call(ok(wells("&lt;!DOCTYPE note&gt;"), "&lt;!doctype x&gt;"));
  assert.equal(f1.status, 200, f1.raw.slice(0, 200));
  assert.equal(f1.body.passwordRedacted, undefined);
});

test("G4: the full fault is redacted before the 300-character cut; a split fault is refused", async () => {
  for (const at of [282, 294, 299, 320]) {
    const out = await call(fault("x".repeat(at) + refs(PASSWORD, 4) + " end"));
    assert.equal(out.status, 200, "fault@" + at + " " + out.raw.slice(0, 120));
    assert.equal(out.body.passwordRedacted, true);
    assert.deepEqual(out.body.redactedSlots, ["fault/1"]);
    assert.equal(out.body.error, "SOAP fault: " + ("x".repeat(at) + "[redacted] end").slice(0, 300));
  }
  refused(await call(fault("x".repeat(294) + PASSWORD.slice(0, 4) + "<!-- -->" + PASSWORD.slice(4))), "credential-reflection", "fault split");
});

test("N4-N9: entity text in the password, HTML-rules references and attribute normalisation are redacted", async () => {
  const cases = [
    ["N4", "Pw&amp;4821", wells("Pw&amp;amp;4821"), "well-name/1"],
    ["N5", PASSWORD, wells("Syn&amp;#116hPAD"), "well-name/1"],
    ["N6", "Synth.Pw!4821", wells("Synth&amp;period;Pw&amp;excl;4821"), "well-name/1"],
    ["N7", "Pw&4821x", wells("Pw&amp;amp4821x"), "well-name/1"],
    ["N8", PASSWORD, wells("Syn&amp;#x74hPAD"), "well-name/1"],
    ["N9", "Synth Pw4821", `<wells ${NS}><well uid="Synth\tPw4821"><name>n</name></well></wells>`, "well-uid/1"],
  ];
  for (const [label, password, xml, slot] of cases) redacted(await call(ok(xml), basic(password)), [slot], label, password);
});

test("multi-well id-only list: names with the password (literal or encoded) are slots and every well stays", async () => {
  const names = Array.from({ length: 300 }, (_, i) => i % 3 === 0 ? PASSWORD + "-" + i : i % 3 === 1 ? refs(PASSWORD, 2) + "-" + i : "Other " + i);
  const xml = `<wells ${NS}>` + names.map((n, i) => `<well uid="SYNTH-W${i + 1}"><name>${n}</name></well>`).join("") + "</wells>";
  const out = await call(ok(xml));
  redacted(out, Array.from({ length: 200 }, (_, k) => "well-name/" + (Math.floor(k / 2) * 3 + (k % 2) + 1)), "300 wells");
  assert.equal((out.body.xml.match(/<well uid="SYNTH-W\d+">/g) || []).length, 300);
  assert.match(out.body.xml, /<name>\[redacted\]-1<\/name>/);
  assert.match(out.body.xml, /<name>Other 2<\/name>/);
});

test("G5 / H5: malformed Basic headers never reach the store", async () => {
  for (const auth of ["Basic AAA=" + TOKEN, "Basic " + TOKEN + "=", "Basic " + TOKEN.slice(1), "Basic  " + TOKEN, "Basic AAAAA", "Basic " + Buffer.from(USER + ":").toString("base64")]) {
    const before = dispatched;
    const out = await call(ok(wells("plain")), auth);
    assert.notEqual(out.status, 200, auth.length + " " + out.raw.slice(0, 120));
    assert.equal(dispatched, before, "dispatched with malformed header");
    assert.equal(anyViewContains(out.raw, SECRETS), false);
  }
});

test("G6: 20k unterminated comment/CDATA/PI/quote openers stay linear and correct", async () => {
  for (const [label, flood] of [["comment", "<!--"], ["cdata", "<![CDATA["], ["pi", "<?"], ["quote", '<a b="'], ["cdata+comment", "<![CDATA[<!--]]>"]]) {
    const start = performance.now();
    const out = await call(ok(wells("plain"), flood.repeat(20000)));
    const ms = performance.now() - start;
    assert.ok(ms < 400, label + " took " + ms.toFixed(0) + " ms");
    assert.ok(out.status === 200 || out.status === 502, label + " " + out.status);
    assert.equal(anyViewContains(out.raw, SECRETS), false);
  }
});

test("clean replies and literal-password replies keep their existing shape", async () => {
  const clean = await call(ok(wells("Clean &amp; Co")));
  assert.equal(clean.status, 200, clean.raw.slice(0, 200));
  assert.equal(clean.body.result, 1);
  assert.equal(clean.body.passwordRedacted, undefined);
  const literal = await call(ok(wells(PASSWORD + "-1")));
  redacted(literal, ["well-name/1"], "literal");
  assert.match(literal.body.xml, /<name>\[redacted\]-1<\/name>/);
});
