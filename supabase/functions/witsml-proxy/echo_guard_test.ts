// Credential echo guard on the Supabase fallback proxy (index.ts).
// Synthetic only: Deno.serve is captured, fetch is replaced with a canned responder. No store calls.
// Run: deno test --allow-read supabase/functions/witsml-proxy/echo_guard_test.ts
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

Deno.test("supabase fallback: echoes in xml, supp, fault and version are 422 with no document", async () => {
  for (const p of PASSWORDS) {
    const cases: [string, () => Promise<{ status: number; text: string; body: Record<string, unknown> }>][] = [
      ["xml literal", () => ask({ xml: well(esc(p)) }, p)],
      ["xml dec", () => ask({ xml: well(dec(p)) }, p)],
      ["xml double", () => ask({ xml: well(esc(esc(p))) }, p)],
      ["xml cdata", () => ask({ xml: well("<![CDATA[" + p.slice(0, 3) + "]]><![CDATA[" + p.slice(3) + "]]>") }, p)],
      ["supp literal", () => ask({ xml: well("x"), supp: "bad " + p }, p)],
      ["supp dec", () => ask({ xml: well("x"), supp: "bad " + dec(p) }, p)],
      ["fault literal", () => ask({ fault: "login " + p }, p)],
      ["fault dec 500", () => ask({ fault: "login " + dec(p) }, p, "WMLS_GetFromStore", 500)],
      ["fault header", () => ask({ fault: "auth " + basic(p) }, p)],
      ["version", () => ask({ raw: "<Result>" + dec(p) + "</Result>" }, p, "WMLS_GetVersion")],
    ];
    for (const [label, pending] of cases) {
      const r = await pending();
      assert(r.status === 422, label + " status " + r.status + " " + r.text.slice(0, 80));
      assert(r.body.code === "proxy-refusal" && !("xml" in r.body) && !("supp" in r.body), label + " body");
      for (const s of [p, USER + ":" + p, basic(p).slice(6)]) assert(!r.text.includes(s), label + " leak");
    }
  }
  assert(upstreamCalls > 0, "stub used");
  globalThis.fetch = originalFetch;
});
