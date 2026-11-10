// Independent re-review 2 (#26): one placeholder "[redacted]", early slot-limit on encoded hits, full WHATWG references. Synthetic data only.
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
import { anyViewContains } from "../netlify/lib/witsml-echo-guard.mjs";
const P = "SynthPw-4821";

test("M1: the machine route uses the same placeholder as the game route ([redacted]), which reader.py contains_redacted sees", async () => {
  const out = await call(wellsXml(2, (i) => (i ? "Synth&#80;w-4821" : P)), P);
  assert.equal(out.status, 200);
  assert.deepEqual(out.body.redactedSlots, ["well-name/1", "well-name/2"]);
  assert.equal((out.body.xml.match(/<name>\[redacted\]<\/name>/g) || []).length, 2);
  assert.equal(out.raw.includes("***"), false);
  hidden(out.raw, [P]);
  // A password inside the mark is refused, never returned.
  const inMark = await call(wellsXml(1, () => "dact"), "dact");
  assert.equal(inMark.status, 502);
  assert.equal(inMark.body.reason, "credential-reflection");
  assert.equal(inMark.raw.includes("dact"), false);
});

test("P1: 4k-24k encoded hits (review machine-scale-enc) withhold as slot-limit well inside the 9 s timeout", async () => {
  for (const n of [4000, 8000, 16000, 24000]) {
    const t0 = performance.now();
    const out = await call(wellsXml(n, () => "Synth&#80;w-4821", (i) => "W" + i), P);
    const ms = performance.now() - t0;
    assert.ok(ms < 1500, n + " hits took " + ms.toFixed(0) + " ms");
    assert.deepEqual([out.status, out.body.result, out.body.redactionScope, out.body.redactionFailure, out.body.xml], [200, -1, "response", "slot-limit", undefined], n + " hits");
    assert.equal(anyViewContains(out.raw, [P]), false);
  }
});

test("P1: 1,024 encoded slots are named, 1,025 are withheld", async () => {
  const ok = await call(wellsXml(1024, (i) => "Synth&#x50;w-4821-" + i), P);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.redactedSlots.length, 1024);
  assert.equal(slotsMatchDocument(ok.body.xml, ok.body.redactedSlots), true);
  const over = await call(wellsXml(1025, (i) => "Synth&#x50;w-4821-" + i), P);
  assert.deepEqual([over.status, over.body.redactionScope, over.body.redactionFailure, over.body.xml], [200, "response", "slot-limit", undefined]);
});

test("L1: &fjlig;, &COPY and &notin; are decoded on the machine route too", async () => {
  for (const [pw, text] of [["Xfjord99", "X&amp;fjlig;ord99"], ["Synth\u00a9Pw", "Synth&amp;COPYPw"], ["Pw\u2209x99", "Pw&amp;notin;x99"]]) {
    const out = await call(wellsXml(1, () => text), pw);
    assert.equal(out.status, 200, text + " " + out.raw.slice(0, 200));
    assert.deepEqual(out.body.redactedSlots, ["well-name/1"], text);
    assert.equal(anyViewContains(out.raw, [pw]), false, text);
  }
});
