// Credential echo guard on the Supabase fallback proxy (index.ts).
// Synthetic only: Deno.serve is captured, fetch is replaced with a canned responder. No store calls.
// Run: deno test --allow-read supabase/functions/witsml-proxy/echo_guard_test.ts
import { anyViewContains } from "./witsml-echo-guard.mjs";
let handler: ((req: Request) => Promise<Response>) | null = null;
let next = { status: 200, body: "" };
let upstreamCalls = 0;
const originalServe = Deno.serve;
const originalFetch = globalThis.fetch;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => { handler = h; return { finished: Promise.resolve() }; };
globalThis.fetch = (input: RequestInfo | URL, _init?: RequestInit) => {
  upstreamCalls += 1;
  if (String(input) !== "https://australia.adagasolutions.com/WMLS") throw new Error("unexpected fetch " + String(input));
  return Promise.resolve(new Response(next.body, { status: next.status }));
};
await import("./index.ts");
// deno-lint-ignore no-explicit-any
(Deno as any).serve = originalServe;

const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };
const NS = 'xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"';
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dec = (s: string) => [...s].map((c) => "&#" + c.codePointAt(0) + ";").join("");
const USER = "synth-user";
const basic = (p: string) => "Basic " + btoa(String.fromCharCode(...new TextEncoder().encode(USER + ":" + p)));
const soap = (o: { xml?: string; supp?: string; fault?: string; raw?: string }) => o.raw ?? ('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' + (o.fault
  ? "<soap:Fault><faultstring>" + esc(o.fault) + "</faultstring></soap:Fault>"
  : "<Result>1</Result><XMLout>" + esc(o.xml ?? "") + "</XMLout><SuppMsgOut>" + esc(o.supp ?? "") + "</SuppMsgOut>") + "</soap:Body></soap:Envelope>");
async function ask(o: { xml?: string; supp?: string; fault?: string; raw?: string }, password: string, op = "WMLS_GetFromStore", status = 200) {
  next = { status, body: soap(o) };
  const res = await handler!(new Request("https://fn.invalid/witsml-proxy", { method: "POST",
    headers: { Origin: "https://tittothomasai-code.github.io", "Content-Type": "application/json", "X-Witsml-Authorization": basic(password) },
    body: JSON.stringify({ op, url: "https://australia.adagasolutions.com/WMLS", wmlType: "well", query: "<wells/>" }) }));
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
}
const well = (name: string) => "<wells " + NS + '><well uid="SYNTH-W1"><name>' + name + "</name></well></wells>";
const PASSWORDS = ["FAKE-PW-123", "Synth<&Pw9", 'Sy"nth\'Pw>9', "Pässwört€9"];

Deno.test("supabase fallback: clean reply keeps the document", async () => {
  for (const p of PASSWORDS) {
    const r = await ask({ xml: well("Synth &amp; Co"), supp: "ok" }, p);
    assert(r.status === 200 && r.body.xml.includes("Synth &amp; Co"), "clean " + r.text);
  }
});

type Reply = { status: number; text: string; body: Record<string, unknown> };
const leakFree = (r: Reply, p: string, label: string) => {
  for (const s of [p, USER + ":" + p, basic(p).slice(6), basic(p)]) assert(!anyViewContains(r.text, [s]), label + " leak");
};

Deno.test("supabase fallback: password-only echoes are redacted in place with slots", async () => {
  const pad = (s: string, w: number) => [...s].map((c) => "&#x" + c.codePointAt(0)!.toString(16).padStart(w, "0") + ";").join("");
  for (const p of PASSWORDS) {
    const cases: [string, string[], () => Promise<Reply>][] = [
      ["xml literal", ["well-name/1"], () => ask({ xml: well(esc(p)) }, p)],
      ["xml dec", ["well-name/1"], () => ask({ xml: well(dec(p)) }, p)],
      ["xml hex padded to 9 (G2)", ["well-name/1"], () => ask({ xml: well(pad(p, 9)) }, p)],
      ["xml double", ["well-name/1"], () => ask({ xml: well(esc(esc(p))) }, p)],
      ["xml cdata", ["well-name/1"], () => ask({ xml: well("<![CDATA[" + p.slice(0, 3) + "]]><![CDATA[" + p.slice(3) + "]]>") }, p)],
      ["supp literal", ["supp/1"], () => ask({ xml: well("x"), supp: "bad " + p }, p)],
      ["supp dec", ["supp/1"], () => ask({ xml: well("x"), supp: "bad " + dec(p) }, p)],
      ["fault literal past 300 (G4)", ["fault/1"], () => ask({ fault: "x".repeat(294) + p }, p)],
      ["fault dec 500", ["fault/1"], () => ask({ fault: "login " + dec(p) }, p, "WMLS_GetFromStore", 500)],
    ];
    for (const [label, slots, pending] of cases) {
      const r = await pending();
      assert(r.status === 200 && r.body.passwordRedacted === true && r.body.redactionScope === "slots", label + " " + r.status + " " + r.text.slice(0, 120));
      assert(JSON.stringify(r.body.redactedSlots) === JSON.stringify(slots), label + " slots " + JSON.stringify(r.body.redactedSlots));
      leakFree(r, p, label);
    }
  }
  const html = await ask({ xml: well("Synth&amp;#80w-4821") }, "SynthPw-4821");
  assert(html.status === 200 && html.body.passwordRedacted === true, "N5 html numeric ref " + html.text.slice(0, 120));
  const n4 = await ask({ xml: well("Pw&amp;amp;4821") }, "Pw&amp;4821");
  assert(n4.status === 200 && n4.body.passwordRedacted === true, "N4 " + n4.text.slice(0, 120));
});

Deno.test("supabase fallback: what cannot be redacted is 422 with no document", async () => {
  for (const p of PASSWORDS) {
    const cases: [string, string, () => Promise<Reply>][] = [
      ["G1 tag split with > in attribute", "credential-reflection", () => ask({ xml: well(esc(p.slice(0, 3)) + '<x a=">"/>' + esc(p.slice(3))) }, p)],
      ["N1 comment opener inside CDATA", "credential-reflection", () => ask({ xml: well("<![CDATA[<!--]]>" + esc(p.slice(0, 3)) + "<b/>" + esc(p.slice(3)) + "<![CDATA[-->]]>") }, p)],
      ["G3 DOCTYPE entities", "unsafe-xml", () => ask({ xml: '<!DOCTYPE wells [<!ENTITY a "' + esc(p.slice(0, 3)) + '"><!ENTITY b "' + esc(p.slice(3)) + '">]>' + well("&a;&b;") }, p)],
      ["pair", "credential-reflection", () => ask({ xml: well(dec(USER + ":" + p)) }, p)],
      ["fault header", "credential-reflection", () => ask({ fault: "auth " + basic(p) }, p)],
      ["version", "credential-reflection", () => ask({ raw: "<Result>" + dec(p) + "</Result>" }, p, "WMLS_GetVersion")],
      ["element name", "structural", () => ask({ xml: "<wells " + NS + "><xPwName/></wells>" }, "PwName")],
    ];
    for (const [label, reason, pending] of cases) {
      const r = await pending();
      assert(r.status === 422 && r.body.code === "proxy-refusal" && r.body.reason === reason, label + " " + r.status + " " + r.text.slice(0, 100));
      assert(!("xml" in r.body) && !("supp" in r.body), label + " body");
      leakFree(r, p, label);
    }
  }
  for (const auth of ["Basic AAA=" + basic("FAKE-PW-123").slice(6), "Basic AAAAA", "Basic " + btoa("nocolonhere"), "Basic " + btoa("synth-user:")]) {
    const before = upstreamCalls;
    const res = await handler!(new Request("https://fn.invalid/witsml-proxy", { method: "POST",
      headers: { Origin: "https://tittothomasai-code.github.io", "Content-Type": "application/json", "X-Witsml-Authorization": auth },
      body: JSON.stringify({ op: "WMLS_GetFromStore", url: "https://australia.adagasolutions.com/WMLS", wmlType: "well", query: "<wells/>" }) }));
    assert(res.status === 400, "H5 malformed header " + res.status);
    await res.text();
    assert(upstreamCalls === before, "H5 no upstream call");
  }
  assert(upstreamCalls > 0, "stub used");
});

Deno.test("supabase fallback: full WHATWG named references (&fjlig; &COPY &notin;) and slot-limit (re-review 2)", async () => {
  for (const [p, text] of [["Xfjord99", "X&amp;fjlig;ord99"], ["Synth\u00a9Pw", "Synth&amp;COPYPw"], ["Pw\u2209x99", "Pw&amp;notin;x99"]]) {
    const r = await ask({ xml: well(text) }, p);
    assert(r.status === 200 && r.body.redactionScope === "slots" && String(r.body.xml).includes("<name>[redacted]</name>"), text + " " + r.text.slice(0, 200));
    leakFree(r, p, text);
  }
  const p = "SynthPw-4821";
  const many = "<wells " + NS + ">" + Array.from({ length: 32000 }, (_, i) => '<well uid="W' + i + '"><name>' + p + "</name></well>").join("") + "</wells>";
  const t0 = performance.now();
  const r = await ask({ xml: many }, p);
  assert(performance.now() - t0 < 2000, "32k hits took " + (performance.now() - t0).toFixed(0) + " ms");
  assert(r.status === 200 && r.body.redactionFailure === "slot-limit" && r.body.xml === undefined, "slot-limit " + r.text.slice(0, 200));
  leakFree(r, p, "slot-limit");
  assert(upstreamCalls > 0, "stub used");
  globalThis.fetch = originalFetch;
});
