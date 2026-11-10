// Review gaps G1-G6 (#23 independent review) on the DEPLOYED game route (netlify/functions/witsml-proxy.mjs -> lib/core.mjs makeProxy).
// Synthetic only: fake passwords, node:https replaced in-process with a canned responder. No store calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import { EventEmitter } from "node:events";
import { after, describe, test } from "node:test";

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

async function askAuth(reply, auth) {
  next = { status: 200, body: soap(reply) };
  const res = await handler(new Request("https://game.invalid/witsml-proxy", { method: "POST",
    headers: { origin: "https://tittothomasai-code.github.io", "content-type": "application/json", "x-witsml-authorization": auth, "x-nf-client-connection-ip": "10.99." + Math.floor(ip / 250) + "." + (ip++ % 250) },
    body: JSON.stringify({ op: "WMLS_GetFromStore", url: "https://australia.adagasolutions.com/WMLS", wmlType: "well", query: "<wells/>" }) }));
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}
const pad = (s, w, base) => [...s].map((c) => base === 16 ? "&#x" + c.codePointAt(0).toString(16).padStart(w, "0") + ";" : "&#" + String(c.codePointAt(0)).padStart(w, "0") + ";").join("");
function unsafe(r, p, label) {
  assert.equal(r.status, 422, label + " " + r.text.slice(0, 100));
  assert.deepEqual(r.body, { result: -1, error: "proxy refusal", code: "proxy-refusal", reason: "unsafe-markup" }, label);
  for (const s of secretsOf(p)) assert.equal(r.text.includes(s), false, label);
}

describe("echo guard review gaps G1-G6", { concurrency: 1 }, () => {
  test("G1: a tag split whose quoted attribute contains '>' is refused", async () => {
    for (const [kind, p] of Object.entries(PASSWORDS)) {
      const v = esc(p.slice(0, 3)) + '<x a=">"/>' + esc(p.slice(3));
      refused(await ask({ xml: well(v) }, { password: p }), p, kind + " G1 dq");
      refused(await ask({ xml: well(esc(p.slice(0, 3)) + "<x a='>' b=\">\"></x>" + esc(p.slice(3))) }, { password: p }), p, kind + " G1 sq");
    }
  });

  test("G2: numeric references with long zero padding are refused", async () => {
    for (const [kind, p] of Object.entries(PASSWORDS)) {
      refused(await ask({ xml: well(pad(p, 9, 16)) }, { password: p }), p, kind + " G2 hex9");
      refused(await ask({ xml: well(pad(p, 16, 16)) }, { password: p }), p, kind + " G2 hex16");
      refused(await ask({ xml: well(pad(p, 11, 10)) }, { password: p }), p, kind + " G2 dec11");
      refused(await ask({ supp: "x " + pad(p, 12, 10) }, { password: p }), p, kind + " G2 supp");
    }
  });

  test("G3: DOCTYPE or ENTITY declarations are refused as unsafe markup, password or not", async () => {
    const p = PASSWORDS.plain;
    unsafe(await ask({ xml: '<!DOCTYPE wells [<!ENTITY a "FAKE-"><!ENTITY b "PW-123">]>' + well("&a;&b;") }, { password: p }), p, "G3 split entities");
    unsafe(await ask({ xml: '<!DOCTYPE wells [<!ENTITY a "harmless">]>' + well("&a;") }, { password: p }), p, "G3 no password");
    unsafe(await ask({ xml: well("Synth") , supp: "&lt;!ENTITY x 'y'&gt;" }, { password: p }), p, "G3 escaped in supp");
    unsafe(await ask({ raw: "<Result>1</Result><CapabilitiesOut>" + esc("<!doctype capServers><capServers " + NS + "/>") + "</CapabilitiesOut>" }, { password: p, op: "WMLS_GetCap" }), p, "G3 lower-case cap");
  });

  test("G4: the fault is checked before it is cut to 300 characters", async () => {
    for (const [kind, p] of Object.entries(PASSWORDS)) {
      for (const at of [282, 290, 294, 299, 320]) {
        refused(await ask({ fault: "x".repeat(at) + p }, { password: p }), p, kind + " G4 at " + at);
      }
    }
    const ok = await ask({ fault: "y".repeat(400) }, { password: PASSWORDS.plain });
    assert.deepEqual([ok.status, ok.body.error.length], [200, "SOAP fault: ".length + 300]);
  });

  test("G5: a Basic header that passes the shape check but does not decode is refused before any upstream call", async () => {
    const before = upstreamCalls;
    for (const auth of ["Basic AAA=" + basic("FAKE-PW-123").slice(6), "Basic ab=cd", "Basic ====", "Basic a=b=c=d"]) {
      const r = await askAuth({ xml: well("FAKE-PW-123") }, auth);
      assert.equal(r.status, 400, auth + " " + r.text);
      assert.match(r.body.error, /credentials required/);
      assert.equal(r.text.includes("FAKE-PW-123"), false);
    }
    assert.equal(upstreamCalls, before);
    const good = await askAuth({ xml: well("Synth") }, basic("FAKE-PW-123"));
    assert.equal(good.status, 200);
  });

  test("G6: unterminated comment, CDATA, PI and quote floods scan in linear time and stay correct", async () => {
    const p = PASSWORDS.plain;
    for (const [label, flood] of Object.entries({ comment: "<!--a".repeat(20000), cdata: "<![CDATA[a".repeat(20000), pi: "<?a".repeat(20000), quote: '<a "'.repeat(20000) })) {
      const t0 = Date.now();
      const r = await ask({ xml: well("Synth") + flood }, { password: p });
      const ms = Date.now() - t0;
      assert.equal(r.status, 200, label);
      assert.ok(ms < 400, label + " took " + ms + " ms");
      const t1 = Date.now();
      refused(await ask({ xml: well(esc(p)) + flood }, { password: p }), p, "G6 " + label + " with literal");
      assert.ok(Date.now() - t1 < 400, label + " refusal slow");
    }
  });

  test("covered forms from the first pass still refuse", async () => {
    const p = PASSWORDS.special;
    refused(await ask({ xml: well(esc(p.slice(0, 3)) + "<!-- c -->" + esc(p.slice(3))) }, { password: p }), p, "comment split");
    refused(await ask({ xml: well("<![CDATA[" + p.slice(0, 2) + "]]><![CDATA[" + p.slice(2) + "]]>") }, { password: p }), p, "cdata split");
    refused(await ask({ xml: well(esc(esc(p))) }, { password: p }), p, "double escaped");
  });
});
