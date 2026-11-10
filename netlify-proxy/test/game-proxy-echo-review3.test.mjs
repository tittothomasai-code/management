// Independent review 3 (#23): P3 one-pass redaction, L3 per-node HTML markup splits, L4 &#x; -> U+FFFD, A2 route cap.
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

const mn = (m) => "<logs " + NS + '><log uidWell="W" uidWellbore="B" uid="L"><name>n</name><logCurveInfo uid="c1"><mnemonic>' + m + "</mnemonic><unit>m</unit></logCurveInfo></log></logs>";
const mn2 = (ms, lname = "n", unit = "m", uid = "L") => "<logs " + NS + '><log uidWell="W" uidWellbore="B" uid="' + uid + '"><name>' + lname + "</name>" + ms.map((m, i) => '<logCurveInfo uid="c' + i + '"><mnemonic>' + m + "</mnemonic><unit>" + unit + "</unit></logCurveInfo>").join("") + "</log></logs>";
const fill = (u, n) => u.repeat(Math.ceil(n / u.length)).slice(0, n);

// Each value below is the inner XML text; the browser later parses the decoded
// mnemonic/unit/name as HTML. "Synth" + markup + "Pw-4821" shows as the password.
const L3 = [
  ["H1", mn('&lt;a ="x&gt;Synth&lt;b&gt;Pw-4821')],
  ["H2", mn('&lt;a b=c=" &gt;Synth&lt;b&gt;Pw-4821')],
  ["H3 xmp", mn("&lt;xmp&gt;&lt;!--&lt;/xmp&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H4 textarea", mn("&lt;textarea&gt;&lt;!--&lt;/textarea&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H5 style", mn("&lt;style&gt;&lt;!--&lt;/style&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H6 script", mn("&lt;script&gt;&lt;!--&lt;/script&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H7 title", mn('&lt;title&gt;&lt;a ="&lt;/title&gt;Synth&lt;!--&gt;Pw-4821')],
  ["H8 noscript", mn("&lt;noscript&gt;&lt;!--&lt;/noscript&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H9 noembed", mn("&lt;noembed&gt;&lt;!--&lt;/noembed&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H10 iframe", mn("&lt;iframe&gt;&lt;!--&lt;/iframe&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H11", mn('&lt;a b="x"="&gt;Synth&lt;b&gt;Pw-4821')],
  ["H12", mn('&lt;a/="&gt;Synth&lt;b&gt;Pw-4821')],
  ["H13 svg CDATA", mn("&lt;svg&gt;&lt;![CDATA[Synth]]&gt;Pw-4821")],
  ["H14", mn("Synth&lt;!----!&gt;Pw-4821")],
  ["H15", mn("Synth&lt;!--x--!&gt;Pw-4821")],
  ["H16", mn("Synth&lt;B&gt;Pw-4821")],
  ["H17 curve poison", mn2(['&lt;x y="', "Synth&lt;!--&gt;Pw-4821"])],
  ["H18 log name poison", mn2(["ROP", "Synth&lt;!--&gt;Pw-4821"], '&lt;x y="')],
  ["H19 unit poison", mn2(["Synth&lt;!--&gt;Pw-4821"], "n", '&lt;x y="')],
  ["H20 uid poison", mn2(["Synth&lt;!--&gt;Pw-4821"], "n", "m", "a&lt;x y=&quot;")],
  ["H21 plaintext", mn("&lt;plaintext&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H22 script escape", mn("&lt;script&gt;&lt;!--&lt;script&gt;&lt;/script&gt;--&gt;&lt;/script&gt;Synth&lt;b&gt;Pw-4821")],
  ["H23", mn("Synth&lt;/1&gt;Pw-4821")],
  ["H24", mn('&lt;a\tb="x&gt;"&gt;Synth&lt;b&gt;Pw-4821')],
  ["H25 unit split", mn2(["ROP"], "n", "Synth&lt;!--&gt;Pw-4821")],
  ["H26 math CDATA", mn("&lt;math&gt;&lt;mi&gt;&lt;![CDATA[x]]&gt;Synth&lt;!--&gt;Pw-4821")],
  ["H27 select", mn("&lt;select&gt;Synth&lt;b&gt;Pw-4821")],
  ["H28", mn('&lt;a b="x""&gt;Synth&lt;b&gt;Pw-4821')],
];

describe("echo guard review 3", () => {
  test("L3: all 28 markup-split cases (raw text, RCDATA, cross-node poison) are refused", async () => {
    assert.equal(L3.length, 28);
    for (const [label, xml] of L3) refused(await ask({ xml }, { password: P }), P, label);
  });

  test("L3: markup elsewhere in the reply does not poison clean nodes", async () => {
    // An unclosed quote in one curve, the password nowhere: kept.
    const clean = mn2(['&lt;x y="', "ROP", "WOB"], '&lt;x y="');
    const r = await ask({ xml: clean }, { password: P });
    assert.equal(r.status, 200, r.text.slice(0, 120));
    assert.equal(r.body.xml, clean);
    assert.equal(r.body.passwordRedacted, undefined);
  });

  test("L3: a plain password next to markup is still redacted in place", async () => {
    const r = await ask({ xml: mn2(["&lt;b&gt;ROP", P]) }, { password: P });
    assert.equal(r.body.redactedSlots.length, 1);
    redacted(r, P, r.body.redactedSlots, "plain hit beside markup");
  });

  test("L4: &#x; and &#X; decode to U+FFFD on the HTML path (Chrome), so FFFD passwords are caught", async () => {
    const pw = "Qz\ufffdZq99";
    const a = await ask({ xml: well("Qz&amp;#x;Zq99") }, { password: pw });
    redacted(a, pw, ["well-name/1"], "&#x; name");
    assert.ok(!a.body.xml.includes("Qz&amp;#x;Zq99"));
    const b = await ask({ xml: mn("Qz&amp;#X;Zq99") }, { password: pw });
    assert.ok(b.status === 422 || b.body.passwordRedacted === true, "&#X; mnemonic " + b.text.slice(0, 120));
    for (const s of secretsOf(pw)) assert.equal(b.text.includes("Qz&amp;#X;Zq99"), false, s);
    // Chrome keeps &#; &#x &#xg; &#a; literal: no FFFD, no redaction for a non-matching password.
    const c = await ask({ xml: well("Qz&amp;#;Zq99 Qz&amp;#xg;Zq99") }, { password: pw });
    assert.equal(c.status, 200);
    assert.equal(c.body.passwordRedacted, undefined);
  });

  test("P3: one text node with 30k+ HTML-encoded hits redacts in under 1 s", () => {
    const unit = "Synth&amp;#80;w-4821 ";
    const xml = "<w><name>" + fill(unit, 700000) + "</name></w>";
    const hits = Math.ceil(700000 / unit.length);
    assert.ok(hits >= 30000, String(hits));
    const t0 = performance.now();
    const g = guardFields({ xml, supp: "", fault: "" }, { password: "SynthPw-4821", blocking: [] }, { mark: GAME_REDACTION_MARK, xmlKeys: ["xml"], slotKeys: { supp: "supp/1", fault: "fault/1" } });
    const ms = performance.now() - t0;
    assert.equal(g.ok, true, JSON.stringify(g).slice(0, 120));
    assert.equal(g.redacted, true);
    assert.equal(g.fields.xml.includes("Synth&amp;#80;w-4821"), false);
    assert.ok(ms < 1000, "took " + Math.round(ms) + " ms");
  });

  test("P3: the same at 1 MiB through the handler stays near 1 s", async () => {
    const unit = "Synth&amp;#80;w-4821 ";
    const name = fill(unit, (1 << 20) - 400);
    const t0 = performance.now();
    const r = await ask({ xml: "<wells " + NS + '><well uid="W"><name>' + name + "</name></well></wells>" }, { password: "SynthPw-4821" });
    const ms = performance.now() - t0;
    assert.equal(r.status, 200, r.text.slice(0, 120));
    assert.equal(r.body.passwordRedacted, true);
    assert.equal(r.text.includes("Synth&amp;amp;#80;w-4821"), false);
    assert.ok(ms < 1500, "took " + Math.round(ms) + " ms");
  });

  test("A2: a route may pass a lower cap, never a higher one", () => {
    const xml = "<w>" + "x".repeat(3 << 20) + "</w>";
    const creds = { password: P, blocking: [] };
    assert.equal(guardFields({ xml }, creds, { xmlKeys: ["xml"], maxFieldChars: 2 << 20 }).reason, "guard-limit");
    assert.equal(guardFields({ xml }, creds, { xmlKeys: ["xml"] }).ok, true);
    assert.equal(guardFields({ xml }, creds, { xmlKeys: ["xml"], maxFieldChars: 64 << 20 }).ok, true);
    const big = "<w>" + "x".repeat(MAX_FIELD_CHARS) + "</w>";
    assert.equal(guardFields({ xml: big }, creds, { xmlKeys: ["xml"], maxFieldChars: 64 << 20 }).reason, "guard-limit");
    assert.equal(guardReason({ a: xml }, [P], { maxFieldChars: 2 << 20 }), "guard-limit");
    assert.equal(guardReason({ a: xml }, [P]), null);
  });

  test("no upstream calls beyond the canned responder", () => {
    assert.ok(upstreamCalls > 0);
    assert.equal(logged.some((line) => line.includes(P)), false);
  });
});
