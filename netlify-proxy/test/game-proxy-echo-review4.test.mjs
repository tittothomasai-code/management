// Independent review 4 (#23): F1 a bare '<' in text never costs a refusal, F2 plain neighbouring values are never joined.
// Synthetic only: fake passwords, node:https replaced in-process with a canned responder. No store calls.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";
import { EventEmitter } from "node:events";
import { after, describe, test } from "node:test";
import { anyViewContains, GAME_REDACTION_MARK, guardFields, guardReason, MAX_FIELD_CHARS, MAX_REDACTION_SLOTS, scanRoleSpans } from "../netlify/lib/witsml-echo-guard.mjs";
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
const P = "SynthPw-4821";
const well = (name) => "<wells " + NS + '><well uid="SYNTH-W1"><name>' + name + "</name></well></wells>";
const CREDS = { password: P, blocking: [USER + ":" + P] };
const wellsOf = (names) => "<wells " + NS + ">" + names.map((name, i) => '<well uid="SYNTH-W' + i + '"><name>' + name + "</name></well>").join("") + "</wells>";

const fill = (n, unit) => unit.repeat(Math.max(0, Math.floor(n / unit.length)));
const ROW = "<data>2026-11-07T01:55:00Z,12.5,345.2,1800,120.4,22.1,95,210.3,15.2,8.4</data>";
const OPTS = { mark: GAME_REDACTION_MARK, xmlKeys: ["xml"], slotKeys: { supp: "supp/1", fault: "fault/1" } };
const B64 = (s) => Buffer.from(s, "utf8").toString("base64");
const credsOf = (p) => ({ password: p, blocking: [USER + ":" + p, B64(USER + ":" + p), "Basic " + B64(USER + ":" + p)] });
// A time log whose description holds a bare "<" (text, not markup).
const ltLog = (bytes, desc = "SPP &lt; 200 bar") => {
  const head = "<logs " + NS + '><log uidWell="W" uidWellbore="B" uid="L"><name>' + desc + '</name><logCurveInfo uid="c"><mnemonic>SPP</mnemonic><curveDescription>' + desc + "</curveDescription></logCurveInfo><logData>";
  return head + fill(bytes - head.length - 40, ROW) + "</logData></log></logs>";
};
// Store-wide log headers shaped like the 7 Nov reply (indented, as the store
// sends it): quotes in wellbore names, itemState "actual" followed by the
// next log's endIndex. (A compact document is also read as its DOM
// textContent, where adjacent leaves do join; that view is unchanged.)
const headerList = (count) => {
  const names = ['12 \u00bc" Surface Hole', 'Drilling_BHA#2_8.5" WB01B01', "TOP HOLE", "WB03B02", "O'Brien 1"];
  const logs = [];
  for (let i = 0; i < count; i += 1) {
    const t = "\n        ";
    logs.push('\n    <log uidWell="w' + i + '" uidWellbore="b' + i + '" uid="l' + i + '">' + t + "<nameWell>PINE CREEK " + (i % 7) + "</nameWell>" + t + "<nameWellbore>" + names[i % names.length].replace(/&/g, "&amp;") +
      "</nameWellbore>" + t + "<name>" + (i % 2 ? "MWD Formation Evaluation" : "Drilling - Depth Based") + "</name>" + t + "<objectGrowing>false</objectGrowing>" + t + "<indexType>measured depth</indexType>" + t + '<startIndex uom="m">' + (i % 50) +
      "</startIndex>" + t + '<endIndex uom="m">' + (2281 + (i % 13)) + ".5</endIndex>" + t + "<commonData>" + t + "    <sourceName>https://store.invalid</sourceName>" + t + "    <dTimCreation>2025-11-06T05:20:26Z</dTimCreation>" + t + "    <itemState>" +
      (i % 3 ? "actual" : "plan") + "</itemState>" + t + "</commonData>\n    </log>");
  }
  return "<logs " + NS + ">" + logs.join("") + "\n</logs>";
};

describe("echo guard review 4", () => {
  test("F1: 'SPP &lt; 200 bar' logs of 1, 2 and 4 MiB pass unredacted, in under 1 s each", () => {
    for (const mib of [1, 2, 4]) {
      const xml = ltLog(mib * 1048576 - 256);
      assert.ok(xml.length <= MAX_FIELD_CHARS && xml.length > (mib - 0.01) * 1048576);
      const t0 = performance.now();
      const g = guardFields({ xml, supp: "", fault: "" }, credsOf(P), OPTS);
      const ms = performance.now() - t0;
      assert.equal(g.ok, true, mib + " MiB " + JSON.stringify(g).slice(0, 100));
      assert.equal(g.redacted, false, mib + " MiB");
      assert.equal(g.fields.xml, xml);
      assert.ok(ms < 1000, mib + " MiB took " + Math.round(ms) + " ms");
    }
    // ROP<5, <1% gas, and a lone "<" at the very end of a description.
    for (const desc of ["ROP&lt;5", "&lt;1% gas", "a &lt;", "x &lt; y &gt; z"]) {
      const g = guardFields({ xml: ltLog(1 << 20, desc), supp: "", fault: "" }, credsOf(P), OPTS);
      assert.equal(g.ok, true, desc + " " + JSON.stringify(g).slice(0, 100));
    }
  });

  test("F1: the same 1 MiB reply through the game handler is 200 with the document", async () => {
    const xml = ltLog(1 << 20);
    const r = await ask({ xml }, { password: P });
    assert.equal(r.status, 200, r.text.slice(0, 120));
    assert.equal(r.body.xml, xml);
    assert.equal(r.body.passwordRedacted, undefined);
  });

  test("F2: word+digits passwords are not assembled from neighbouring plain values", () => {
    const xml = headerList(600);
    assert.ok(/<itemState>actual<\/itemState>\s*<\/commonData>\s*<\/log>\s*<log/.test(xml) && xml.includes("2281.5"));
    const words = ["actual", "plan", "false", "depth", "time", "hole", "surface", "witsml", "drilling", "Hole", "Actual", "Plan", "creek", "PINE", "Based"];
    const suffixes = ["1", "12", "123", "2024", "2025", "2026", "2281", "99", "01", "007", "!", "#1"];
    const refused = [];
    for (const w of words) for (const s of suffixes) {
      const p = w + s;
      const g = guardFields({ xml, supp: "", fault: "" }, credsOf(p), OPTS);
      if (!g.ok || g.withheld || g.redacted) refused.push(p + ":" + (g.reason || g.withheld || "redacted"));
    }
    assert.deepEqual(refused, []);
    assert.equal(guardFields({ xml, supp: "", fault: "" }, credsOf("actual2281"), OPTS).ok, true);
  });

  test("F2: a quote in one value does not arm joining; real markup still does", () => {
    const two = (a, b) => "<logs " + NS + '><log uidWell="W" uidWellbore="B" uid="L"><name>n</name><logCurveInfo uid="c1"><mnemonic>' + a + '</mnemonic><unit>m</unit></logCurveInfo><logCurveInfo uid="c2"><mnemonic>' + b + "</mnemonic><unit>m</unit></logCurveInfo></log></logs>";
    assert.equal(guardFields({ xml: two('a"Synth', "Pw-4821") }, credsOf(P), OPTS).ok, true);
    assert.equal(guardFields({ xml: two("12 \u00bc&quot; Synth", "Pw-4821") }, credsOf(P), OPTS).ok, true);
    // A value that ends inside markup swallows the page markup up to the next value.
    for (const [a, b] of [["Synth&lt;!--", "--&gt;Pw-4821"], ['Synth&lt;a b="', '"&gt;Pw-4821'], ["Synth&lt;style&gt;", "&lt;/style&gt;Pw-4821"], ["Synth&lt;b", "&gt;Pw-4821"]]) {
      const g = guardFields({ xml: two(a, b) }, credsOf(P), OPTS);
      assert.equal(g.reason, "credential-reflection", a + " | " + b + " " + JSON.stringify(g).slice(0, 100));
    }
  });

  test("markup check runs once, on the reply that would be returned", () => {
    // 4 MiB of benign markup-free text with a bare '<' in every row stays far inside the budget.
    const xml = "<logs " + NS + "><log><logData>" + fill(MAX_FIELD_CHARS - 200, "<data>SPP &lt; 200,1,2</data>") + "</logData></log></logs>";
    const t0 = performance.now();
    const g = guardFields({ xml, supp: "", fault: "" }, credsOf(P), OPTS);
    assert.equal(g.ok, true, JSON.stringify(g).slice(0, 100));
    assert.ok(performance.now() - t0 < 1500, "took " + Math.round(performance.now() - t0) + " ms");
  });

  test("no upstream calls beyond the canned responder", () => {
    assert.ok(upstreamCalls > 0);
    assert.equal(logged.some((line) => line.includes(P)), false);
  });
});
