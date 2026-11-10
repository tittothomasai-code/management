// Offline trace of the published password scan. Synthetic values only.
// A match surface names which existing check fired. It does not show that a
// refused well name is harmless, and it does not change what is refused.
import assert from "node:assert/strict";
import https from "node:https";
import { after, test } from "node:test";
import { inspect } from "node:util";
import { createVerifiedDispatch, enforceMachinePolicy } from "../netlify/lib/machine-policy.mjs";
import { adaptMachineResult } from "../netlify/lib/machine-reader-adapter.mjs";

const NS = "http://www.witsml.org/schemas/1series";
const WELL = "SYNTH-WELL-1";
const USER = "rig-user-id";
const PASSWORD = "QZJV";
const KEY = "synthetic-not-real-caller-key-0123456789abcd";
const AUTH = "Basic " + Buffer.from(USER + ":" + PASSWORD).toString("base64");
const QUERY = `<wells xmlns="${NS}" version="1.4.1.1"><well uid="${WELL}"/></wells>`;
const OPTIONS = "returnElements=id-only;maxReturnNodes=1";

const originalRequest = https.request;
const originalGet = https.get;
const originalFetch = globalThis.fetch;
let netCalls = 0;
https.request = () => { netCalls += 1; throw new Error("network forbidden"); };
https.get = () => { netCalls += 1; throw new Error("network forbidden"); };
globalThis.fetch = () => { netCalls += 1; throw new Error("network forbidden"); };
after(() => {
  https.request = originalRequest;
  https.get = originalGet;
  globalThis.fetch = originalFetch;
});

function fakeHttps({ text = "", status = 200, headers = {} } = {}) {
  const calls = [];
  return {
    calls,
    Agent: class {
      constructor(opts) { this.opts = { ...opts }; }
      destroy() {}
    },
    request(options, cb) {
      const rec = { body: "", headers: options.headers };
      calls.push(rec);
      const req = {
        on() { return req; },
        write(chunk) { rec.body += chunk; return true; },
        end() {
          const res = {
            statusCode: status,
            headers,
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
    dispatch: createVerifiedDispatch(impl, {
      schedule(fn, ms) { return { fn, ms }; },
      cancel() {},
    }),
    now: () => 5000,
  };
}

let seq = 0;
function post(auth = AUTH) {
  seq += 1;
  return new Request("https://machine.invalid/witsml-machine", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-witsml-machine-key": KEY,
      "x-witsml-authorization": auth,
      "x-nf-client-connection-ip": "203.0.113." + (40 + seq),
    },
    body: JSON.stringify({
      op: "WMLS_GetFromStore",
      wmlType: "well",
      query: QUERY,
      options: OPTIONS,
    }),
  });
}

function soap(inner) {
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
}

function store(xml, extra = "") {
  const escaped = xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return soap(`<q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${escaped}</XMLout>${extra}</q1:WMLS_GetFromStoreResponse>`);
}

function well(name, uid = WELL) {
  return `<wells xmlns="${NS}" version="1.4.1.1"><well uid="${uid}"><name>${name}</name></well></wells>`;
}

async function call(mode, auth) {
  const impl = fakeHttps(mode);
  const res = await enforceMachinePolicy(post(auth), deps(impl));
  const raw = await res.text();
  return { status: res.status, raw, body: (raw?JSON.parse(raw):{}), impl };
}

function hidden(out) {
  for (const secret of [PASSWORD, AUTH, KEY]) {
    assert.equal(out.raw.includes(secret), false, secret);
  }
}

test("literal, decoded, supp, fault, result, and comment surfaces stay distinct", async () => {
  const literal = await call({ text: store(well(PASSWORD)) });
  assert.equal(literal.status, 200);
  assert.equal(literal.body.passwordRedacted, true);
  assert.equal(literal.body.xml.includes("<name>[redacted]</name>"), true);
  assert.equal(literal.body.xml.includes(`uid="${WELL}"`), true);
  assert.equal(literal.body.xml.includes(PASSWORD), false);
  assert.equal(literal.impl.calls[0].body.includes(PASSWORD), false);
  hidden(literal);

  const entityXml = "&lt;wells xmlns=&quot;http://www.witsml.org/schemas/1series&quot; version=&quot;1.4.1.1&quot;&gt;&lt;well uid=&quot;SYNTH-WELL-1&quot;&gt;&lt;name&gt;Q&#90;JV&lt;/name&gt;&lt;/well&gt;&lt;/wells&gt;";
  const decoded = await call({ text: soap(`<q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${entityXml}</XMLout></q1:WMLS_GetFromStoreResponse>`) });
  assert.equal(decoded.status, 200);
  assert.equal(decoded.body.passwordRedacted, true);
  assert.equal(decoded.body.xml.includes("<name>[redacted]</name>"), true);
  assert.equal(decoded.body.xml.includes(PASSWORD), false);
  hidden(decoded);

  const supp = await call({ text: store(well("Synth North"), "<SuppMsgOut>Q&#90;JV</SuppMsgOut>") });
  assert.equal(supp.status, 200);
  assert.equal(supp.body.passwordRedacted, true);
  assert.equal(supp.body.supp, "[redacted]");
  assert.equal(supp.body.xml.includes("Synth North"), true);
  hidden(supp);

  const fault = await call({ text: soap('<soap:Fault><faultstring>Q&#90;JV</faultstring></soap:Fault>') });
  assert.equal(fault.status, 200);
  assert.equal(fault.body.passwordRedacted, true);
  assert.equal(fault.body.error, "SOAP fault: [redacted]");
  hidden(fault);

  const result = await call({ text: store(well("Synth North")).replace("<Result>1</Result>", "<Result>Q&#90;JV</Result>") });
  assert.equal(result.status, 502);
  assert.equal(result.body.reason, "result-format");
  assert.equal(result.body.xml, undefined);
  hidden(result);

  const comment = await call({ text: soap("<!-- " + PASSWORD + " --><q1:WMLS_GetFromStoreResponse xmlns:q1=\"http://www.witsml.org/message/120\"><Result>1</Result><XMLout>&lt;logs/&gt;</XMLout></q1:WMLS_GetFromStoreResponse>") });
  assert.equal(comment.status, 200);
  assert.equal(comment.body.passwordRedacted, undefined);
  assert.equal(comment.body.xml.includes("logs"), true);
  hidden(comment);
});

test("the scanner does not decode base64, urls, or case, and does not read response headers", async () => {
  const encoded = await call({ text: store(well("Q%5AJV")) });
  assert.equal(encoded.status, 200, encoded.raw);
  assert.equal(encoded.body.xml.includes("Q%5AJV"), true);

  const upper = await call({ text: store(well("qzjv")) });
  assert.equal(upper.status, 200, upper.raw);

  const b64 = Buffer.from(PASSWORD).toString("base64");
  assert.equal(b64.includes(PASSWORD), false);
  const packed = await call({ text: store(well(b64)) });
  assert.equal(packed.status, 200, packed.raw);

  const headed = await call({ text: store(well("Synth North")), headers: { "x-echo": PASSWORD } });
  assert.equal(headed.status, 200, headed.raw);
  assert.equal(headed.body.credentialClass, undefined);

  const located = await call({
    text: store(well("Synth North")),
    headers: { location: "https://upstream.example/" + PASSWORD },
  });
  assert.equal(located.status, 502);
  assert.equal(located.body.error, "upstream redirect refused");
  assert.equal(located.body.credentialClass, undefined);
  assert.equal(located.raw.includes(PASSWORD), false);

  const commentEntity = await call({ text: soap("<!-- Q&#90;JV --><q1:WMLS_GetFromStoreResponse xmlns:q1=\"http://www.witsml.org/message/120\"><Result>1</Result><XMLout>&lt;logs/&gt;</XMLout></q1:WMLS_GetFromStoreResponse>") });
  assert.equal(commentEntity.status, 200, commentEntity.raw);
  assert.equal(netCalls, 0);
});

test("a normal well document can match a password that is only ordinary markup", async () => {
  const needle = "schemas";
  const auth = "Basic " + Buffer.from(USER + ":" + needle).toString("base64");
  const token = auth.slice(6);
  assert.equal(token.includes(needle), false);
  assert.equal(KEY.includes(needle), false);
  const out = await call({ text: store(well("Synth North")) }, auth);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(QUERY.includes(needle), true);
  assert.equal(out.body.xml.includes("http://www.witsml.org/[redacted]/1series"), true);
  assert.equal(out.body.xml.includes("Synth North"), true);
  assert.equal(out.raw.includes(needle), false);
  assert.equal(out.impl.calls[0].headers.Authorization, auth);
});

test("the request password is not inserted into the scanned response", async () => {
  const out = await call({ text: store(well("Synth North")) });
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.xml.includes(`uid="${WELL}"`), true);
  assert.equal(out.body.xml.includes(PASSWORD), false);
  assert.equal(out.impl.calls[0].body.includes(PASSWORD), false);
  assert.equal(out.impl.calls[0].headers.Authorization, AUTH);
  assert.equal(out.impl.calls.length, 1);
  assert.equal(netCalls, 0);
});


test("reports a credential field and well UID without returning any values", async () => {
  const xml = `<wells xmlns="${NS}"><well uid="${PASSWORD}"><credentials Authorization='${PASSWORD}'><password>${PASSWORD}</password></credentials></well></wells>`;
  const out = await call({ text: store(xml) });
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.xml.includes('uid="[redacted]"'), true);
  assert.equal(out.body.xml.includes("<password>[redacted]</password>"), true);
  assert.equal(out.body.xml.includes("Authorization='[redacted]'"), true);
  hidden(out);
});

test("malformed matched XML still refuses without revealing its tags", async () => {
  const out = await call({ text: store(`<wells><unexpected>${PASSWORD}</wells>`) });
  assert.equal(out.status, 502);
  assert.equal(out.body.reason, "parser-format");
  assert.equal(out.body.xml, undefined);
  assert.equal(out.raw.includes("unexpected"), false);
  hidden(out);
});

test("namespace and credential field labels come from a fixed vocabulary", async () => {
  const xml = `<wells xmlns="https://fixture.invalid/${PASSWORD}"><well uid="${WELL}"><untrusted-field>${PASSWORD}</untrusted-field></well></wells>`;
  const out = await call({ text: store(xml) });
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.xml.includes("https://fixture.invalid/[redacted]"), true);
  assert.equal(out.body.xml.includes("<untrusted-field>[redacted]</untrusted-field>"), true);
  assert.equal(out.body.xml.includes(`uid="${WELL}"`), true);
  hidden(out);
});

test("a password that collides with a static response key still returns redacted data", async () => {
  const pass = "result";
  const auth = "Basic " + Buffer.from(USER + ":" + pass).toString("base64");
  const out = await call({ text: store(well(pass)) }, auth);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.result, 1);
  assert.equal(out.body.xml.includes("<name>[redacted]</name>"), true);
  assert.equal(out.body.xml.includes(pass), false);
  const adapted = adaptMachineResult(out.body, "WMLS_GetFromStore");
  assert.equal(adapted.passwordRedacted, true);
  assert.equal(adapted.xml.includes(pass), false);
  assert.equal(inspect(adapted).includes("<name>[redacted]</name>"), true);
});
