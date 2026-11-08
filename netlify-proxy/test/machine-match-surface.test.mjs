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
const PASSWORD = "secret-pass-99";
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
  return { status: res.status, raw, body: JSON.parse(raw), impl };
}

function hidden(out) {
  for (const secret of [PASSWORD, AUTH, KEY, "schemas", "1.4.1"]) {
    assert.equal(out.raw.includes(secret), false, secret);
  }
  assert.equal(out.body.xml, undefined);
}

test("literal, decoded, supp, fault, result, and comment surfaces stay distinct", async () => {
  const literal = await call({ text: store(well(PASSWORD)) });
  assert.equal(literal.status, 502);
  assert.equal(literal.body.credentialClass, "password");
  assert.equal(literal.body.matchSurface, "raw-body+decoded-xml");
  assert.equal(literal.impl.calls[0].body.includes(PASSWORD), false);
  assert.equal(literal.body.passwordXmlLocation, "well-name");
  hidden(literal);

  const entityXml = "&lt;wells xmlns=&quot;http://www.witsml.org/schemas/1series&quot; version=&quot;1.4.1.1&quot;&gt;&lt;well uid=&quot;SYNTH-WELL-1&quot;&gt;&lt;name&gt;secr&#101;t-pass-99&lt;/name&gt;&lt;/well&gt;&lt;/wells&gt;";
  const decoded = await call({ text: soap(`<q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${entityXml}</XMLout></q1:WMLS_GetFromStoreResponse>`) });
  assert.equal(decoded.status, 502);
  assert.equal(decoded.body.credentialClass, "password");
  assert.equal(decoded.body.matchSurface, "decoded-xml");
  assert.equal(decoded.body.passwordXmlLocation, "well-name");
  hidden(decoded);

  const supp = await call({ text: store(well("Synth North"), "<SuppMsgOut>secr&#101;t-pass-99</SuppMsgOut>") });
  assert.equal(supp.status, 502);
  assert.equal(supp.body.matchSurface, "supp-message");
  hidden(supp);

  const fault = await call({ text: soap('<soap:Fault><faultstring>secr&#101;t-pass-99</faultstring></soap:Fault>') });
  assert.equal(fault.status, 502);
  assert.equal(fault.body.matchSurface, "fault");
  hidden(fault);

  const result = await call({ text: store(well("Synth North")).replace("<Result>1</Result>", "<Result>secr&#101;t-pass-99</Result>") });
  assert.equal(result.status, 502);
  assert.equal(result.body.matchSurface, "result");
  hidden(result);

  const comment = await call({ text: soap("<!-- " + PASSWORD + " --><q1:WMLS_GetFromStoreResponse xmlns:q1=\"http://www.witsml.org/message/120\"><Result>1</Result><XMLout>&lt;logs/&gt;</XMLout></q1:WMLS_GetFromStoreResponse>") });
  assert.equal(comment.status, 502);
  assert.equal(comment.body.matchSurface, "raw-body");
  hidden(comment);
});

test("the scanner does not decode base64, urls, or case, and does not read response headers", async () => {
  const encoded = await call({ text: store(well("secr%65t-pass-99")) });
  assert.equal(encoded.status, 200, encoded.raw);
  assert.equal(encoded.body.xml.includes("secr%65t-pass-99"), true);

  const upper = await call({ text: store(well("Secret-Pass-99")) });
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

  const commentEntity = await call({ text: soap("<!-- secr&#101;t-pass-99 --><q1:WMLS_GetFromStoreResponse xmlns:q1=\"http://www.witsml.org/message/120\"><Result>1</Result><XMLout>&lt;logs/&gt;</XMLout></q1:WMLS_GetFromStoreResponse>") });
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
  assert.equal(out.status, 502);
  assert.equal(out.body.reason, "credential-reflection");
  assert.equal(out.body.credentialClass, "password");
  assert.equal(out.body.matchSurface, "raw-body+decoded-xml");
  assert.equal(QUERY.includes(needle), true);
  assert.equal(out.body.passwordXmlLocation, "namespace-uri");
  assert.equal(out.raw.includes(needle), false);
  assert.equal(out.raw.includes("Synth"), false);
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
  assert.equal(out.status, 502);
  assert.equal(out.body.passwordXmlLocation, "well-uid+credential-element+credential-attribute");
  hidden(out);
});

test("malformed matched XML still refuses without revealing its tags", async () => {
  const out = await call({ text: store(`<wells><unexpected>${PASSWORD}</wells>`) });
  assert.equal(out.status, 502);
  assert.equal(out.body.passwordXmlLocation, "unclassified-xml");
  assert.equal(out.raw.includes("unexpected"), false);
  hidden(out);
});

test("location label cannot reflect an exact password itself", async () => {
  const pass = "well-name";
  const auth = "Basic " + Buffer.from(USER + ":" + pass).toString("base64");
  const out = await call({ text: store(well(pass)) }, auth);
  assert.equal(out.status, 502);
  assert.equal(out.body.passwordXmlLocation, undefined);
  assert.equal(out.body.reason, "credential-reflection");
  assert.equal(out.raw.includes(pass), false);
});

test("refusal keys that contain a short password are removed from the serialized body", async () => {
  for (const pass of ["XmlL", "dXml", "Location", "XmlLocation"]) {
    const auth = "Basic " + Buffer.from(USER + ":" + pass).toString("base64");
    const out = await call({ text: store(well(pass)) }, auth);
    assert.equal(out.status, 502, pass);
    assert.equal(out.body.reason, "credential-reflection", pass);
    assert.equal(out.body.passwordXmlLocation, undefined, pass);
    assert.equal(out.body.xml, undefined, pass);
    assert.equal(out.raw.includes(pass), false, pass + " " + out.raw);
    assert.equal(out.raw.includes(USER + ":" + pass), false, pass);
    let closed;
    assert.throws(() => adaptMachineResult(out.body, "WMLS_GetFromStore"), (err) => {
      closed = err;
      return err.closed === true;
    });
    const packed = JSON.stringify(closed);
    const shown = inspect(closed, { showHidden: true, getters: true, depth: null });
    assert.equal(packed.includes(pass), false, packed);
    assert.equal(shown.includes(pass), false, shown);
    assert.equal(String(closed).includes(pass), false);
    assert.equal(closed.passwordXmlLocation, undefined);
  }
});

test("a password spanning the location delimiter is removed with that field", async () => {
  const pass = "Location\":\"well";
  const auth = "Basic " + Buffer.from(USER + ":" + pass).toString("base64");
  const out = await call({ text: store(well(pass)) }, auth);
  assert.equal(out.status, 502, out.raw);
  assert.equal(out.body.reason, "credential-reflection");
  assert.equal(out.body.passwordXmlLocation, undefined);
  assert.equal(out.raw.includes(pass), false, out.raw);
  assert.equal(out.body.xml, undefined);
});

test("an existing refusal field that equals the password is removed", async () => {
  const pass = "password";
  const auth = "Basic " + Buffer.from(USER + ":" + pass).toString("base64");
  const out = await call({ text: store(well(pass)) }, auth);
  assert.equal(out.status, 502, out.raw);
  assert.equal(out.body.reason, "credential-reflection");
  assert.equal(out.body.credentialClass, undefined);
  assert.equal(out.body.passwordXmlLocation, undefined);
  assert.equal(out.raw.includes(pass), false, out.raw);
  assert.equal(out.body.xml, undefined);
});

test("a password that collides with the static refusal skeleton becomes an empty object", async () => {
  const pass = "result";
  const auth = "Basic " + Buffer.from(USER + ":" + pass).toString("base64");
  const out = await call({ text: store(well(pass)) }, auth);
  assert.equal(out.status, 502);
  assert.equal(out.raw, "{}");
  assert.equal(out.raw.includes(pass), false);
  let closed;
  assert.throws(() => adaptMachineResult(out.body, "WMLS_GetFromStore"), (err) => {
    closed = err;
    return err.closed === true && err.code === "MACHINE_FAILED";
  });
  assert.equal(JSON.stringify(closed).includes(pass), false);
  assert.equal(inspect(closed, { showHidden: true }).includes(pass), false);
});
