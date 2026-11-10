// Review gaps G1-G6 and N1-N9, R1, H5 (#23 independent reviews), redact-in-place policy, on the DEPLOYED game route (netlify/functions/witsml-proxy.mjs -> lib/core.mjs makeProxy).
// Synthetic only: fake passwords, node:https replaced in-process with a canned responder. No store calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import { EventEmitter } from "node:events";
import { after, describe, test } from "node:test";
import { anyViewContains, guardFields, guardReason, MAX_FIELD_CHARS, scanRoleSpans } from "../netlify/lib/witsml-echo-guard.mjs";
import { scanRoleSpans as libScanRoleSpans } from "../netlify/lib/redaction-slots.mjs";

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
  return { status: res.status, text, body: JSON.parse(text), cors: res.headers.get("access-control-allow-origin") };
}
const secretsOf = (p) => [p, USER + ":" + p, basic(p), basic(p).slice(6)];
function refused(r, p, label, reason = "credential-reflection") {
  assert.equal(r.status, 422, label + " " + r.text.slice(0, 100));
  assert.deepEqual(r.body, { result: -1, error: "proxy refusal", code: "proxy-refusal", reason }, label);
  assert.equal(r.cors, "https://tittothomasai-code.github.io", label + " CORS");
  for (const s of secretsOf(p)) assert.equal(r.text.includes(s), false, label);
}
// A reply the browser may render: no secret in any decoded view, including
// HTML-rules decoding of every text and attribute (the innerHTML sinks).
function redacted(r, p, slots, label) {
  assert.equal(r.status, 200, label + " " + r.text.slice(0, 160));
  assert.equal(r.body.passwordRedacted, true, label);
  assert.equal(r.body.redactionScope, "slots", label);
  assert.deepEqual(r.body.redactedSlots, slots, label);
  const inside = slots.filter((slot) => slot !== "supp/1" && slot !== "fault/1");
  if (inside.length) {
    const ids = new Set(scanRoleSpans(r.body.xml).map((span) => span.id));
    assert.ok(inside.every((slot) => ids.has(slot)), label + " slots resolve");
    assert.deepEqual(scanRoleSpans(r.body.xml), libScanRoleSpans(r.body.xml), label + " same role algorithm as redaction-slots.mjs");
  }
  assert.equal(guardReason(r.body, secretsOf(p)), null, label + " leaks in a decoded view");
  assert.equal(anyViewContains(r.text, secretsOf(p)), false, label + " leaks in the raw body");
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
const P = "SynthPw-4821";
const pad = (s, w) => [...s].map((c) => "&#x" + c.codePointAt(0).toString(16).padStart(w, "0") + ";").join("");
const wells = (names) => "<wells " + NS + ">" + names.map((n, i) => '<well uid="SYNTH-W' + (i + 1) + '"><name>' + n + "</name></well>").join("") + "</wells>";

describe("echo guard review gaps, redact-in-place policy", { concurrency: 1 }, () => {
  test("G1 / N1-N3: a password split across markup cannot be redacted as one span and is refused", async () => {
    const cases = {
      "G1 dq attribute '>'": 'Synth<x a=">"/>Pw-4821',
      "G1 sq attribute '>'": "Synth<x a='>'/>Pw-4821",
      "N1 comment opener inside CDATA": "<![CDATA[<!--]]>Synth<b/>Pw-4821<![CDATA[-->]]>",
      "N2 PI opener inside CDATA": "<![CDATA[<?]]>Synth<b/>Pw-4821<![CDATA[?>]]>",
      "N3 CDATA fake tag wrapper": "<![CDATA[<x ]]>Synth<b/>Pw-4821<![CDATA[>]]>",
      "split by comment": "Synth<!-- c -->Pw-4821",
      "split by PI": "Synth<?pi x?>Pw-4821",
    };
    for (const [label, name] of Object.entries(cases)) refused(await ask({ xml: well(name) }, { password: P }), P, label);
    refused(await ask({ xml: well("x"), supp: "Syn<![CDATA[th]]><!--x-->Pw-4821" }, { password: P }), P, "N10 supp CDATA+comment");
  });

  test("G2: zero-padded references are redacted in place", async () => {
    const dec11 = [...P].map((c) => "&#" + String(c.codePointAt(0)).padStart(11, "0") + ";").join("");
    for (const [label, v] of Object.entries({ hex9: pad(P, 9), hex16: pad(P, 16), dec11 })) {
      const r = await ask({ xml: well(v) }, { password: P });
      redacted(r, P, ["well-name/1"], label);
      assert.match(r.body.xml, /<name>\[redacted\]<\/name>/);
    }
  });

  test("G3 / F1: declarations are refused as unsafe-xml; escaped declaration TEXT is ordinary data", async () => {
    refused(await ask({ xml: '<!DOCTYPE wells [<!ENTITY a "Synth"><!ENTITY b "Pw-4821">]>' + well("&a;&b;") }, { password: P }), P, "G3 split entities", "unsafe-xml");
    refused(await ask({ xml: "<!doctype wells>" + well("plain") }, { password: P }), P, "lowercase doctype", "unsafe-xml");
    refused(await ask({ xml: well("plain"), supp: "see <!ENTITY x 'y'>" }, { password: P }), P, "ENTITY in supp", "unsafe-xml");
    const f1 = await ask({ xml: well("&lt;!DOCTYPE note&gt;") }, { password: P });
    assert.equal(f1.status, 200, f1.text);
    assert.equal(f1.body.passwordRedacted, undefined);
    assert.equal(f1.body.xml, well("&lt;!DOCTYPE note&gt;"));
  });

  test("G4: the full fault is redacted before it is cut to 300 characters", async () => {
    for (const at of [282, 290, 294, 299, 320]) {
      const r = await ask({ fault: "x".repeat(at) + P + " tail" }, { password: P });
      redacted(r, P, ["fault/1"], "fault@" + at);
      assert.equal(r.body.error, ("SOAP fault: " + ("x".repeat(at) + "[redacted] tail").slice(0, 300)));
    }
    refused(await ask({ fault: "x".repeat(294) + "Synth<!-- -->Pw-4821" }, { password: P }), P, "fault split by comment");
    const clean = await ask({ fault: "y".repeat(400) }, { password: P });
    assert.deepEqual([clean.status, clean.body.error, clean.body.passwordRedacted], [200, "SOAP fault: " + "y".repeat(300), undefined]);
  });

  test("N4-N9: entity text in the password, HTML-rules references and attribute normalisation are redacted", async () => {
    const cases = [
      ["N4 password containing entity text", "Pw&amp;4821", well("Pw&amp;amp;4821"), "well-name/1"],
      ["N5 HTML numeric ref without ';'", P, well("Synth&amp;#80w-4821"), "well-name/1"],
      ["N6 HTML5 named refs", "Synth.Pw!4821", well("Synth&amp;period;Pw&amp;excl;4821"), "well-name/1"],
      ["N7 legacy &amp without ';'", "Pw&4821x", well("Pw&amp;amp4821x"), "well-name/1"],
      ["N8 hex ref without ';'", P, well("Synth&amp;#x50w-4821"), "well-name/1"],
      ["N9 tab in attribute normalised to space", "Synth Pw4821", "<wells " + NS + '><well uid="Synth\tPw4821"><name>n</name></well></wells>', "well-uid/1"],
      ["HTML ref in an attribute", P, "<wells " + NS + '><well uid="Synth&amp;#80w-4821"><name>n</name></well></wells>', "well-uid/1"],
    ];
    for (const [label, password, xml, slot] of cases) redacted(await ask({ xml }, { password }), password, [slot], label);
  });

  test("multi-well id-only list with the password in well names: every well is kept, each name is a slot", async () => {
    const r = await ask({ xml: wells(Array.from({ length: 250 }, (_, i) => (i % 2 ? "Pad " : "") + (i % 3 ? P : pad(P, 4)) + "-" + i)) }, { password: P });
    redacted(r, P, Array.from({ length: 250 }, (_, i) => "well-name/" + (i + 1)), "250 wells");
    assert.equal((r.body.xml.match(/<well uid="SYNTH-W\d+">/g) || []).length, 250);
    assert.match(r.body.xml, /<well uid="SYNTH-W2"><name>Pad \[redacted\]-1<\/name><\/well>/);
    const over = await ask({ xml: wells(Array.from({ length: 1025 }, (_, i) => P + i)) }, { password: P });
    assert.equal(over.status, 200);
    assert.deepEqual([over.body.result, over.body.passwordRedacted, over.body.redactionScope, over.body.redactionFailure, over.body.xml], [-1, true, "response", "slot-limit", undefined]);
    assert.equal(over.text.includes(P), false);
  });

  test("structural and credential forms are refused, never redacted", async () => {
    refused(await ask({ xml: "<wells " + NS + "><" + P + "/></wells>" }, { password: P }), P, "element name", "structural");
    refused(await ask({ xml: "<wells " + NS + "><well " + P + '="1"/></wells>' }, { password: P }), P, "attribute name", "structural");
    refused(await ask({ xml: well("synth-user:Synth<b/>Pw-4821") }, { password: P }), P, "N11 pair split by tag");
    refused(await ask({ xml: well(basic(P).slice(6, 14) + "<!--x-->" + basic(P).slice(14)) }, { password: P }), P, "N12 token split by comment");
    refused(await ask({ raw: "<Result>1.4.1.1,Synth&amp;#x50;w-4821</Result>" }, { password: P, op: "WMLS_GetVersion" }), P, "N15 version");
  });

  test("H5 / G5: a Basic header without a usable user:password is 400 and never reaches the store", async () => {
    const token = basic(P).slice(6);
    const headers = {
      "embedded =": "Basic AAA=" + token, "unpadded": "Basic " + token.replace(/=+$/, ""), "AAAAA": "Basic AAAAA",
      "no colon": "Basic " + Buffer.from("nocolonhere").toString("base64"), "empty password": "Basic " + Buffer.from("synth-user:").toString("base64"),
      "empty user": "Basic " + Buffer.from(":" + P).toString("base64"), "latin1 bytes": "Basic " + Buffer.from("synth-user:p\u00e4ssW0rd", "latin1").toString("base64"),
      "non-canonical": "Basic " + token.slice(0, -2) + "x=",
    };
    for (const [label, auth] of Object.entries(headers)) {
      const before = upstreamCalls;
      const r = await askAuth({ xml: well(P) }, auth);
      assert.equal(r.status, 400, label + " " + r.status);
      assert.equal(upstreamCalls, before, label + " reached the store");
    }
    assert.equal((await askAuth({ xml: well("plain") }, basic(P))).status, 200);
  });

  test("R1 / G6: large and adversarial replies never throw; floods stay linear", async () => {
    const big = await ask({ raw: "<Result>1</Result><XMLout>&lt;a" + "x".repeat(4_000_000) + "</XMLout>" }, { password: P });
    assert.equal(big.status, 200, "4 MB '<a' run, under the 4 MiB field cap");
    assert.equal(big.cors, "https://tittothomasai-code.github.io");
    const huge = await ask({ raw: "<Result>1</Result><XMLout>&lt;a" + "x".repeat(10_500_000) + "</XMLout>" }, { password: P });
    refused(huge, P, "10.5 MB '<a' run over the field cap", "guard-limit");
    assert.equal(huge.cors, "https://tittothomasai-code.github.io");
    for (const [label, unit] of [["comment", "<!--"], ["cdata", "<![CDATA["], ["pi", "<?"], ["quote", '<a b="'], ["cdata+comment", "<![CDATA[<!--]]>"]]) {
      const start = performance.now();
      const r = await ask({ xml: well("plain"), supp: unit.repeat(20000) }, { password: P });
      assert.ok(performance.now() - start < 400, label + " took " + (performance.now() - start).toFixed(0) + " ms");
      assert.equal(r.status, 200, label);
    }
    const deep = await ask({ xml: well("&amp;amp;amp;amp;amp;amp;amp;amp;lt;".repeat(120000)) }, { password: P });
    refused(deep, P, "deep escape flood over the work budget", "guard-limit");
    assert.deepEqual(guardFields({ xml: "x".repeat(MAX_FIELD_CHARS + 1) }, { password: P, blocking: [] }, { xmlKeys: ["xml"] }), { ok: false, reason: "guard-limit" });
    const throwing = { get xml() { throw new Error("boom"); } };
    Object.defineProperty(throwing, "xml", { enumerable: true });
    assert.deepEqual(guardFields(throwing, { password: P, blocking: [] }, { xmlKeys: ["xml"] }), { ok: false, reason: "guard-error" });
  });

  test("nothing is logged", () => {
    assert.equal(logged.length, 0);
  });
});
