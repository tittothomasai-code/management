// Password-only matches are redacted. Basic, login pair, and caller key still block.
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

test("redacts a well uid and keeps the unmodified name and number", async () => {
  const password = "WELL-UID-7";
  const xml = `<wells xmlns="http://www.witsml.org/schemas/1series"><well uid="${password}"><name>Synth North</name><num>1500</num></well></wells>`;
  const out = await call(store(xml), password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.xml.includes('uid="***"'), true);
  assert.equal(out.body.xml.includes("<name>Synth North</name>"), true);
  assert.equal(out.body.xml.includes("<num>1500</num>"), true);
  assert.equal(out.body.xml.includes(password), false);
  assert.equal(out.raw.includes(password), false);
  const adapted = adaptMachineResult(out.body, "WMLS_GetFromStore");
  assert.equal(adapted.passwordRedacted, true);
  assert.equal(adapted.xml.includes("1500"), true);
  assert.equal(adapted.xml.includes(password), false);
});

test("redacts a well name attribute without changing the uid", async () => {
  const password = "NorthName";
  const xml = `<wells><well uid="SYNTH-1" name="${password}"><num>42</num></well></wells>`;
  const out = await call(store(xml), password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.xml.includes('uid="SYNTH-1"'), true);
  assert.equal(out.body.xml.includes('name="***"'), true);
  assert.equal(out.body.xml.includes("<num>42</num>"), true);
  assert.equal(out.raw.includes(password), false);
});

test("a numeric overlap is marked and is not the original measurement", async () => {
  const password = "1500";
  const xml = `<logs><logData><data>15000,25</data></logData></logs>`;
  const out = await call(store(xml), password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.xml.includes("<data>***0,25</data>"), true);
  assert.equal(out.body.xml.includes("15000"), false);
  assert.equal(out.body.xml.includes("1500"), false);
});

test("redacts element and attribute names without returning them as original", async () => {
  const password = "QZJV";
  const xml = `<wells><${password} uid="SYNTH-1" ${password}="keep-me">1500</${password}></wells>`;
  const out = await call(store(xml), password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.xml.includes("<xx "), true);
  assert.equal(out.body.xml.includes('uid="SYNTH-1"'), true);
  assert.equal(out.body.xml.includes('xx="keep-me"'), true);
  assert.equal(out.body.xml.includes(">1500<"), true);
  assert.equal(out.raw.includes(password), false);
});

test("redacts a decoded entity and leaves an absent field untouched", async () => {
  const password = "QZJV";
  const present = soap(`<q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>&lt;wells&gt;&lt;well uid="SYNTH-1"&gt;&lt;name&gt;Q&#90;JV&lt;/name&gt;&lt;/well&gt;&lt;/wells&gt;</XMLout></q1:WMLS_GetFromStoreResponse>`);
  const hit = await call(present, password);
  assert.equal(hit.status, 200, hit.raw);
  assert.equal(hit.body.passwordRedacted, true);
  assert.equal(hit.body.xml.includes("<name>***</name>"), true);
  assert.equal(hit.body.xml.includes('uid="SYNTH-1"'), true);
  assert.equal(hit.raw.includes(password), false);

  const clean = `<wells><well uid="SYNTH-1"><name>Synth North</name><num>1500</num></well></wells>`;
  const miss = await call(store(clean), password);
  assert.equal(miss.status, 200, miss.raw);
  assert.equal(miss.body.passwordRedacted, undefined);
  assert.equal(miss.body.xml, clean);
  assert.equal(miss.body.xml.includes("1500"), true);
});

test("malformed and empty replies fail without the password or a document", async () => {
  const password = "QZJV";
  const malformed = await call(store(`<wells><unexpected>${password}</wells>`), password);
  assert.equal(malformed.status, 502);
  assert.equal(malformed.body.reason, "parser-format");
  assert.equal(malformed.body.xml, undefined);
  assert.equal(malformed.body.passwordRedacted, undefined);
  assert.equal(malformed.raw.includes(password), false);
  assert.equal(malformed.raw.includes("unexpected"), false);

  const empty = await call("", password);
  assert.equal(empty.status, 502);
  assert.equal(empty.body.reason, "parser-format");
  assert.equal(empty.body.xml, undefined);
  assert.equal(empty.raw.includes(password), false);

  const straddling = await call(store(`<well uid="${password}"/>`), `uid="${password}"`);
  assert.equal(straddling.status, 502);
  assert.equal(straddling.body.xml, undefined);
  assert.equal(straddling.raw.includes(password), false);
});

test("login pair, basic token, and caller key still block the whole reply", async () => {
  const password = "QZJV";
  const pair = USER + ":" + password;
  const token = authFor(password).slice(6);
  const pairOut = await call(store(`<wells><well uid="SYNTH-1"><name>${pair}</name></well></wells>`), password);
  assert.equal(pairOut.status, 502);
  assert.equal(pairOut.body.reason, "credential-reflection");
  assert.equal(pairOut.body.credentialClass.includes("raw-pair"), true);
  assert.equal(pairOut.body.xml, undefined);
  assert.equal(pairOut.raw.includes(pair), false);
  assert.equal(pairOut.raw.includes(password), false);

  const tokenOut = await call(store(`<wells><well><name>${token}</name></well></wells>`), password);
  assert.equal(tokenOut.status, 502);
  assert.equal(tokenOut.body.reason, "credential-reflection");
  assert.equal(tokenOut.body.credentialClass, "basic");
  assert.equal(tokenOut.body.xml, undefined);
  assert.equal(tokenOut.raw.includes(token), false);

  const keyOut = await call(store(`<wells><well><name>${KEY}</name></well></wells>`), password);
  assert.equal(keyOut.status, 502);
  assert.equal(keyOut.body.reason, "credential-reflection");
  assert.equal(keyOut.body.credentialClass.includes("caller-key"), true);
  assert.equal(keyOut.body.xml, undefined);
  assert.equal(keyOut.raw.includes(KEY), false);
});

test("the adapter copies only a boolean redaction flag", () => {
  const kept = adaptMachineResult({ result: 1, xml: "<num>1500</num>", supp: "", passwordRedacted: true }, "WMLS_GetFromStore");
  assert.equal(kept.passwordRedacted, true);
  assert.equal(kept.xml, "<num>1500</num>");
  const ignored = adaptMachineResult({ result: 1, xml: "<num>1500</num>", supp: "", passwordRedacted: "true" }, "WMLS_GetFromStore");
  assert.equal(ignored.passwordRedacted, undefined);
});
