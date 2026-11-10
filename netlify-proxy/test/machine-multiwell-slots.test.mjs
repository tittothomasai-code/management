// Multi-well id-only list redaction (PR #23 follow-up). Synthetic data only.
import assert from "node:assert/strict";
import https from "node:https";
import { after, test } from "node:test";
import { createVerifiedDispatch, enforceMachinePolicy } from "../netlify/lib/machine-policy.mjs";
import { adaptMachineResult } from "../netlify/lib/machine-reader-adapter.mjs";
import { redactedRanges, slotsMatchDocument } from "../netlify/lib/redaction-slots.mjs";

const USER = "rig-user-id";
const KEY = "synthetic-not-real-caller-key-0123456789abcd";
let netCalls = 0;
https.request = () => { netCalls += 1; throw new Error("network forbidden"); };
https.get = () => { netCalls += 1; throw new Error("network forbidden"); };
globalThis.fetch = () => { netCalls += 1; throw new Error("network forbidden"); };
after(() => { assert.equal(netCalls, 0); });

function authFor(password) {
  return "Basic " + Buffer.from(USER + ":" + password).toString("base64");
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
let seq = 0;
async function call(innerXml, password) {
  seq += 1;
  const escaped = innerXml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body><q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${escaped}</XMLout></q1:WMLS_GetFromStoreResponse></soap:Body></soap:Envelope>`;
  const res = await enforceMachinePolicy(new Request("https://machine.invalid/witsml-machine", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-witsml-machine-key": KEY,
      "x-witsml-authorization": authFor(password),
      "x-nf-client-connection-ip": "203.0.113." + (seq % 200 + 1),
    },
    body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "well", query: "<wells/>", options: "returnElements=id-only" }),
  }), {
    callerSecret: KEY,
    dispatch: createVerifiedDispatch(fakeHttps(text), { schedule(fn, ms) { return { fn, ms }; }, cancel() {} }),
    now: () => 1,
  });
  const raw = await res.text();
  return { status: res.status, raw, body: JSON.parse(raw) };
}

function hidden(raw, secrets) {
  for (const secret of secrets) assert.equal(raw.includes(secret), false, secret);
}
const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const wellsXml = (n, nameFor, uidFor = (i) => "SYNTH-W" + (i + 1)) => `<wells ${NS}>` + Array.from({ length: n }, (_, i) => `<well uid="${uidFor(i)}"><name>${nameFor(i)}</name></well>`).join("") + `</wells>`;

test("multi-well id-only list: 200 matching well names come back as 200 named slots", async () => {
  const password = "SynthPAD";
  const out = await call(wellsXml(200, (i) => password + "-" + i), password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.result, 1);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.redactionScope, "slots");
  assert.equal(out.body.redactionFailure, undefined);
  assert.deepEqual(out.body.redactedSlots, Array.from({ length: 200 }, (_, i) => "well-name/" + (i + 1)));
  assert.equal(slotsMatchDocument(out.body.xml, out.body.redactedSlots), true);
  assert.equal((out.body.xml.match(/<name>\*\*\*-/g) || []).length, 200);
  assert.equal(out.body.xml.includes('uid="SYNTH-W200"'), true);
  hidden(out.raw, [password]);
  const adapted = adaptMachineResult(out.body, "WMLS_GetFromStore");
  assert.equal(adapted.redactionScope, "slots");
  assert.equal(adapted.redactedSlots.length, 200);
});

test("multi-well list: only the wells that matched are named; others unchanged", async () => {
  const password = "SynthPAD";
  const out = await call(wellsXml(300, (i) => i % 7 === 0 ? password + i : "Other " + i), password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.redactionScope, "slots");
  assert.equal(out.body.redactedSlots.length, Math.ceil(300 / 7));
  assert.equal(out.body.xml.includes("<name>Other 1</name>"), true);
  hidden(out.raw, [password]);
});

test("multi-well list: matching well uids are named well-uid slots (the reader stops on identity)", async () => {
  const password = "a579-77af";
  const out = await call(wellsXml(80, (i) => "W" + i, (i) => "11f2db" + i + "-cc7a-11f1-" + password + "d12a0fe0"), password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.redactionScope, "slots");
  assert.deepEqual(out.body.redactedSlots, Array.from({ length: 80 }, (_, i) => "well-uid/" + (i + 1)));
  hidden(out.raw, [password]);
});

test("exactly 1024 named slots pass; 1025 withhold the document with slot-limit", async () => {
  const password = "SynthPAD";
  const ok = await call(wellsXml(1024, (i) => password + i), password);
  assert.equal(ok.body.redactionScope, "slots", ok.raw.slice(0, 200));
  assert.equal(ok.body.redactedSlots.length, 1024);
  hidden(ok.raw, [password]);
  const over = await call(wellsXml(1025, (i) => password + i), password);
  assert.equal(over.status, 200);
  assert.equal(over.body.result, -1);
  assert.equal(over.body.passwordRedacted, true);
  assert.equal(over.body.redactionScope, "response");
  assert.equal(over.body.redactionFailure, "slot-limit");
  assert.equal(over.body.xml, undefined);
  assert.equal(over.body.redactedSlots, undefined);
  hidden(over.raw, [password]);
  assert.throws(() => adaptMachineResult(over.body, "WMLS_GetFromStore"));
});

test("a structural hit in a multi-well list still withholds the document, reason structural", async () => {
  const password = "wellX";
  const out = await call(`<wells ${NS}><well uid="SYNTH-W1"><name>A</name></well><${password}>v</${password}></wells>`, password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.redactionScope, "response");
  assert.equal(out.body.redactionFailure, "structural");
  assert.equal(out.body.xml, undefined);
  hidden(out.raw, [password]);
});

test("redactionFailure is dropped when the reason word would contain the password", async () => {
  const password = "limit";
  const out = await call(wellsXml(1025, (i) => password + i), password);
  assert.equal(out.body.redactionScope, "response");
  assert.equal(out.body.redactionFailure, undefined);
  hidden(out.raw, [password]);
});
