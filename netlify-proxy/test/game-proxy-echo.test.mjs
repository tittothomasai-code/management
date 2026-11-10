// Credential echo guard on the DEPLOYED game route (netlify/functions/witsml-proxy.mjs -> lib/core.mjs makeProxy).
// Synthetic only: fake passwords, node:https replaced in-process with a canned responder. No store calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import { EventEmitter } from "node:events";
import { after, describe, test } from "node:test";

const ECHO_GUARD_SHA256 = "a502ce201fa138762ab131da4e54d78842dc66df9fae4fdcd7d94e9389ab48f4";
const originalRequest = https.request;
let next = { status: 200, body: "" }, upstreamCalls = 0;
https.request = (url, opts, cb) => {
  upstreamCalls += 1;
  assert.equal(String(url), "https://australia.adagasolutions.com/WMLS");
  const rq = new EventEmitter();
  rq.write = () => {}; rq.destroy = () => {};
  rq.end = () => queueMicrotask(() => { const rs = new EventEmitter(); rs.statusCode = next.status; cb(rs); rs.emit("data", Buffer.from(next.body, "utf8")); rs.emit("end"); });
  return rq;
};
after(() => { https.request = originalRequest; });

const { default: handler, config } = await import("../netlify/functions/witsml-proxy.mjs");
const logged = [];
for (const m of ["log", "info", "warn", "error", "debug"]) { const o = console[m].bind(console); console[m] = (...a) => { logged.push(a.map(String).join(" ")); o(...a); }; }

const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dec = (s) => [...s].map((c) => "&#" + c.codePointAt(0) + ";").join("");
const hex = (s) => [...s].map((c) => "&#x" + c.codePointAt(0).toString(16) + ";").join("");
const USER = "synth-user";
const basic = (p) => "Basic " + Buffer.from(USER + ":" + p, "utf8").toString("base64");
const soap = ({ xml = "", supp = "", fault = "", result = "1", raw } = {}) => raw ?? ('<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' + (fault
  ? "<soap:Fault><faultcode>soap:Server</faultcode><faultstring>" + esc(fault) + "</faultstring></soap:Fault>"
  : "<Result>" + result + "</Result><XMLout>" + esc(xml) + "</XMLout><SuppMsgOut>" + esc(supp) + "</SuppMsgOut>") + "</soap:Body></soap:Envelope>");
let ip = 0;
async function ask(reply, { password, op = "WMLS_GetFromStore", status = 200 }) {
  next = { status, body: soap(reply) };
  const res = await handler(new Request("https://game.invalid/witsml-proxy", { method: "POST",
    headers: { origin: "https://tittothomasai-code.github.io", "content-type": "application/json", "x-witsml-authorization": basic(password), "x-nf-client-connection-ip": "10.88." + Math.floor(ip / 250) + "." + (ip++ % 250) },
    body: JSON.stringify({ op, url: "https://australia.adagasolutions.com/WMLS", wmlType: "well", query: "<wells/>" }) }));
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}
const secretsOf = (p) => [p, USER + ":" + p, basic(p), basic(p).slice(6)];
function refused(r, p, label) {
  assert.equal(r.status, 422, label + " " + r.text.slice(0, 100));
  assert.deepEqual(r.body, { result: -1, error: "proxy refusal", code: "proxy-refusal", reason: "credential-reflection" }, label);
  for (const s of secretsOf(p)) assert.equal(r.text.includes(s), false, label);
}
const PASSWORDS = { plain: "FAKE-PW-123", special: "Synth<&Pw9", quotes: 'Sy"nth\'Pw>9', unicode: "Pässwört€9" };
const well = (name) => "<wells " + NS + '><well uid="SYNTH-W1"><name>' + name + "</name></well></wells>";

describe("deployed game proxy credential echo guard", { concurrency: 1 }, () => {
  test("guard bytes are pinned and shared with the Supabase fallback", () => {
    const a = readFileSync(new URL("../netlify/lib/witsml-echo-guard.mjs", import.meta.url));
    const b = readFileSync(new URL("../../supabase/functions/witsml-proxy/witsml-echo-guard.mjs", import.meta.url));
    assert.equal(createHash("sha256").update(a).digest("hex"), ECHO_GUARD_SHA256);
    assert.equal(createHash("sha256").update(b).digest("hex"), ECHO_GUARD_SHA256);
    assert.equal(/console\./.test(a.toString()), false);
  });

  test("platform rate limit config is kept on the function", () => {
    assert.deepEqual(config, { path: "/witsml-proxy", rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] } });
  });

  test("clean replies still return the document", async () => {
    for (const [kind, p] of Object.entries(PASSWORDS)) {
      const r = await ask({ xml: well("Synth &amp; Co &#169;"), supp: "ok" }, { password: p });
      assert.equal(r.status, 200, kind);
      assert.match(r.body.xml, /Synth &amp; Co/);
      assert.equal(r.body.supp, "ok");
      const f = await ask({ fault: "store busy" }, { password: p });
      assert.deepEqual([f.status, f.body.error], [200, "SOAP fault: store busy"]);
    }
  });

  test("XMLout, CapabilitiesOut and Result echoes are refused, literal or encoded", async () => {
    for (const [kind, p] of Object.entries(PASSWORDS)) {
      for (const [form, v] of Object.entries({ literal: esc(p), dec: dec(p), hex: hex(p), double: esc(esc(p)), cdata: "<![CDATA[" + p.slice(0, 3) + "]]><![CDATA[" + p.slice(3) + "]]>", comment: esc(p.slice(0, 3)) + "<!-- x -->" + esc(p.slice(3)) })) {
        refused(await ask({ xml: well(v) }, { password: p }), p, kind + " xml " + form);
      }
      refused(await ask({ raw: "<Result>1</Result><CapabilitiesOut>" + esc("<capServers " + NS + "><contact><name>" + dec(p) + "</name></contact></capServers>") + "</CapabilitiesOut>" }, { password: p, op: "WMLS_GetCap" }), p, kind + " cap");
      refused(await ask({ raw: "<Result>" + dec(p) + "</Result>" }, { password: p, op: "WMLS_GetVersion" }), p, kind + " version");
      refused(await ask({ xml: well(dec(USER + ":" + p)) }, { password: p }), p, kind + " pair");
    }
  });

  test("SuppMsgOut echoes are refused, literal or encoded", async () => {
    for (const [kind, p] of Object.entries(PASSWORDS)) {
      for (const [form, v] of Object.entries({ literal: p, dec: dec(p), hex: hex(p), escaped: esc(p) })) {
        refused(await ask({ xml: well("Synth"), supp: "bad password " + v, result: "-401" }, { password: p }), p, kind + " supp " + form);
      }
    }
  });

  test("SOAP fault echoes are refused on HTTP 200 and 500", async () => {
    for (const [kind, p] of Object.entries(PASSWORDS)) {
      for (const status of [200, 500]) {
        for (const [form, v] of Object.entries({ literal: p, dec: dec(p), escaped: esc(p), header: basic(p) })) {
          refused(await ask({ fault: "login " + v + " rejected" }, { password: p, status }), p, kind + " fault " + form + " " + status);
        }
      }
    }
  });

  test("an HTTP error without a fault never returns the body", async () => {
    const r = await ask({ raw: "<html>FAKE-PW-123</html>" }, { password: "FAKE-PW-123", status: 500 });
    assert.deepEqual([r.status, r.body.error], [200, "HTTP 500"]);
  });

  test("nothing is logged and only the stubbed store was called", () => {
    assert.ok(upstreamCalls > 0);
    assert.equal(logged.some((l) => Object.values(PASSWORDS).some((p) => l.includes(p))), false);
    assert.equal(logged.length, 0);
  });
});
