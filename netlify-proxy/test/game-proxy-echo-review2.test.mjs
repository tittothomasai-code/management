// Independent re-review 2 (#23): L1 full WHATWG named references, P1/P2 slot-limit and cost bounds, M1 one placeholder.
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
const ENTITIES = JSON.parse(readFileSync(new URL("./fixtures/whatwg-entities.json", import.meta.url), "utf8"));

describe("echo guard re-review 2", () => {
  test("L1: &fjlig; (ASCII 'fj'), &COPY (legacy, no ';') and &notin; (longest match) are decoded and redacted", async () => {
    const cases = [
      ["Xfjord99", "X&amp;fjlig;ord99", "R24 &fjlig;"],
      ["Synth\u00a9Pw", "Synth&amp;COPYPw", "R25 &COPY legacy"],
      ["Synth\u00a9Pw", "Synth&amp;COPY;Pw", "&COPY;"],
      ["Pw\u2209x99", "Pw&amp;notin;x99", "R26 &notin; longest match"],
      ["Pw\u00acit;99", "Pw&amp;notit;99", "&notit; reads as legacy &not + 'it;'"],
      ["Pw\u00acinx", "Pw&amp;notinx", "&notinx (no ';') reads as legacy &not"],
      ["Q\u2242\u0338Z9", "Q&amp;NotEqualTilde;Z9", "two code points"],
      ["Q\ud835\udd04Z9", "Q&amp;Afr;Z9", "astral"],
    ];
    for (const [pw, text, label] of cases) {
      const r = await ask({ xml: well(text) }, { password: pw });
      redacted(r, pw, ["well-name/1"], label);
      assert.match(r.body.xml, /<name>\[redacted\]<\/name>/, label);
    }
    // Attributes too (the data-mn and option value sinks).
    const attr = await ask({ xml: "<wells " + NS + '><well uid="X&amp;fjlig;ord99"><name>n</name></well></wells>' }, { password: "Xfjord99" });
    redacted(attr, "Xfjord99", ["well-uid/1"], "&fjlig; in a uid");
  });

  test("L1: every WHATWG named reference (2,231 entries) is decoded in the HTML view", () => {
    assert.equal(Object.keys(ENTITIES).length, 2231);
    let checked = 0;
    for (const [ref, { characters }] of Object.entries(ENTITIES)) {
      const secret = "Q" + characters + "Z9";
      assert.equal(anyViewContains("Q" + ref + "Z9", [secret]), true, ref);
      checked += 1;
    }
    assert.equal(checked, 2231);
    // Longest match: the ';' form wins over the legacy prefix, and only legacy names match without ';'.
    assert.equal(anyViewContains("Q&notin;Z9", ["Q\u2209Z9"]), true);
    assert.equal(anyViewContains("Q&notin;Z9", ["Q\u00acin;Z9"]), false);
    assert.equal(anyViewContains("Q&fjligZ9", ["QfjZ9"]), false, "&fjlig needs ';'");
  });

  test("P1: 16k and 32k password hits finish under 1 s and withhold the document as slot-limit", () => {
    for (const n of [16000, 32000]) {
      const s = "<logs><log><logData>" + "<data>1,2,3</data>".repeat(20000) + Array.from({ length: n }, () => "<data>1," + P + ",3</data>").join("") + "</logData></log></logs>";
      const t0 = performance.now();
      const r = guardFields({ xml: s }, CREDS, { mark: GAME_REDACTION_MARK, xmlKeys: ["xml"] });
      const ms = performance.now() - t0;
      assert.ok(ms < 1000, n + " hits took " + ms.toFixed(0) + " ms");
      assert.deepEqual([r.ok, r.withheld, r.redacted, r.slots, r.fields.xml], [true, "slot-limit", true, [], ""], n + " hits");
    }
    for (const n of [16000, 32000]) {
      const s = wellsOf(Array.from({ length: n }, () => "Synth&amp;#80;w-4821"));
      const t0 = performance.now();
      const r = guardFields({ xml: s }, CREDS, { mark: GAME_REDACTION_MARK, xmlKeys: ["xml"] });
      const ms = performance.now() - t0;
      assert.ok(ms < 1000, n + " encoded hits took " + ms.toFixed(0) + " ms");
      assert.equal(r.withheld, "slot-limit", n + " encoded hits");
    }
  });

  test("P1: exactly 1,024 slots are named; 1,025 are withheld (literal and encoded)", async () => {
    assert.equal(MAX_REDACTION_SLOTS, 1024);
    for (const enc of [(i) => P + "-" + i, (i) => "Synth&amp;#x50;w-4821-" + i]) {
      const ok = await ask({ xml: wellsOf(Array.from({ length: 1024 }, (_, i) => enc(i))) }, { password: P });
      redacted(ok, P, Array.from({ length: 1024 }, (_, i) => "well-name/" + (i + 1)), "1024");
      const over = await ask({ xml: wellsOf(Array.from({ length: 1025 }, (_, i) => enc(i))) }, { password: P });
      assert.equal(over.status, 200);
      assert.deepEqual([over.body.result, over.body.passwordRedacted, over.body.redactionScope, over.body.redactionFailure, over.body.xml, over.body.supp], [-1, true, "response", "slot-limit", undefined, undefined]);
      assert.equal(anyViewContains(over.text, secretsOf(P)), false);
    }
    // 32k hits through the deployed route: 200 slot-limit, quickly.
    const t0 = performance.now();
    const big = await ask({ xml: wellsOf(Array.from({ length: 32000 }, (_, i) => P + i)) }, { password: P });
    assert.ok(performance.now() - t0 < 1500, "32k hits on the route");
    assert.deepEqual([big.status, big.body.redactionFailure, big.body.xml], [200, "slot-limit", undefined]);
  });

  test("P2: 4 MiB field cap; decode maps are sparse and charged to the work budget", () => {
    assert.equal(MAX_FIELD_CHARS, 4 * 1024 * 1024);
    const fill = (u, n) => u.repeat(Math.ceil(n / u.length)).slice(0, n);
    // One huge text node with one encoded password (review: 7.5 s / 1,036 MB at 16 MiB).
    const s = "<w><name>" + fill("x&amp;y ", MAX_FIELD_CHARS - 64) + "Synth&amp;#80;w-4821</name></w>";
    const t0 = performance.now();
    const r = guardFields({ xml: s }, CREDS, { mark: GAME_REDACTION_MARK, xmlKeys: ["xml"] });
    const ms = performance.now() - t0;
    assert.ok(ms < 2500, "huge node took " + ms.toFixed(0) + " ms");
    assert.ok(r.ok ? r.fields.xml.endsWith("[redacted]</name></w>") : r.reason === "guard-limit", JSON.stringify(r.reason));
    // A realistic 4 MiB log reply is well inside the budget.
    const row = "<data>2026-11-07T01:55:00Z,12.5,345.2,1800,120.4,22.1,95,210.3,15.2,8.4</data>";
    const log = "<logs><log><logData>" + fill(row, MAX_FIELD_CHARS - 64) + "</logData></log></logs>";
    const real = guardFields({ xml: log }, CREDS, { mark: GAME_REDACTION_MARK, xmlKeys: ["xml"] });
    assert.deepEqual([real.ok, real.redacted], [true, false]);
    assert.deepEqual(guardFields({ xml: "x".repeat(MAX_FIELD_CHARS + 1) }, CREDS, { xmlKeys: ["xml"] }), { ok: false, reason: "guard-limit" });
  });

  test("L2 (proxy side): HTML-only markup splits that the raw renderMap sink would join are refused", async () => {
    const log = (mn) => "<logs " + NS + '><log uid="L1"><logCurveInfo uid="C1"><mnemonic>' + mn + "</mnemonic><unit>m</unit></logCurveInfo></log></logs>";
    for (const [mn, label] of [["Synth&lt;!--&gt;Pw-4821", "R27 <!-->"], ["Synth&lt;?&gt;Pw-4821", "R28 <?>"], ["Synth&lt;!x&gt;Pw-4821", "R30 <!x>"], ["Synth&lt;/ x&gt;Pw-4821", "R31 </ x>"],
      ["Synth&lt;!-- a --!&gt;Pw-4821", "--!> comment end"], ["Synth&lt;i title='&gt;'&gt;Pw-4821", "quoted > in a tag"], ["Synth&lt;/&gt;Pw-4821", "</>"]]) {
      refused(await ask({ xml: log(mn) }, { password: P }), P, label);
    }
    // A "<" that opens no markup is text, and clean text with markup-like content still passes.
    const clean = await ask({ xml: log("a &lt; b &lt;!-- c --&gt; d") }, { password: P });
    assert.equal(clean.status, 200);
  });

  test("M1: one placeholder, \"[redacted]\"", () => {
    assert.equal(GAME_REDACTION_MARK, "[redacted]");
    const r = guardFields({ xml: well(P), supp: "x " + P }, CREDS, { xmlKeys: ["xml"], slotKeys: { supp: "supp/1" } });
    assert.equal(r.fields.xml.includes("<name>[redacted]</name>"), true);
    assert.equal(r.fields.supp, "x [redacted]");
  });

  test("nothing is logged and no other upstream is called", () => {
    assert.equal(logged.length, 0);
    assert.ok(upstreamCalls > 0);
  });
});
