// witsml-proxy v4.0 — read-only HTTPS proxy for the Drilling World game (GitHub Pages) -> one WITSML 1.4.1.1 SOAP server.
// Security design:
//  * Stores NO credentials. The browser sends the user's own WITSML username/password per request in the
//    X-Witsml-Authorization header (Basic). This URL alone cannot read any data.
//  * Exactly one upstream: https://australia.adagasolutions.com/WMLS (anything else -> 403, no outbound call).
//  * Only read SOAP actions: WMLS_GetVersion, WMLS_GetCap, WMLS_GetFromStore. The SOAP envelope is built here,
//    so a client cannot smuggle AddToStore/UpdateInStore/DeleteFromStore.
//  * CORS: https://tittothomasai-code.github.io only. Requests from other origins (or without Origin) -> 403.
//  * Upstream 401/403 is passed straight back with the same status; the game hard-stops on it.
//  * TLS certificate verification is ALWAYS on. The Supabase Edge runtime has no per-host way to skip it
//    (no Deno flags; Deno.createHttpClient has no "ignore errors" option), so an expired upstream cert -> 502.
//  * Never logs headers, bodies or credentials (no console output at all).
const ORIGIN = "https://tittothomasai-code.github.io";
const UPSTREAM = "https://australia.adagasolutions.com/WMLS";
const UP_HOST = "australia.adagasolutions.com";
const OPS = new Set(["WMLS_GetVersion", "WMLS_GetCap", "WMLS_GetFromStore"]);
const MAX_BODY = 64 * 1024;
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (s: string) => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (x: string, t: string) => { const m = x.match(new RegExp("<(?:\\w+:)?" + t + "\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:\\w+:)?" + t + ">)")); return m ? (m[1] ?? "") : null; };
function envelope(op: string, a: Record<string, string>) {
  const body = op == "WMLS_GetVersion" ? "" : op == "WMLS_GetCap"
    ? `<OptionsIn xsi:type="xsd:string">${esc(a.options || "dataVersion=1.4.1.1")}</OptionsIn>`
    : `<WMLtypeIn xsi:type="xsd:string">${esc(a.wmlType)}</WMLtypeIn><QueryIn xsi:type="xsd:string">${esc(a.query)}</QueryIn><OptionsIn xsi:type="xsd:string">${esc(a.options || "")}</OptionsIn><CapabilitiesIn xsi:type="xsd:string"></CapabilitiesIn>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><q1:${op} xmlns:q1="http://www.witsml.org/message/120">${body}</q1:${op}></soap:Body></soap:Envelope>`;
}
function cors(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { "Vary": "Origin", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (origin === ORIGIN) {
    h["Access-Control-Allow-Origin"] = ORIGIN;
    h["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type, X-Witsml-Authorization";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}
const json = (status: number, o: unknown, origin: string | null) => new Response(JSON.stringify(o), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
function allowedUrl(u: unknown): boolean {
  if (typeof u !== "string") return false;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname.toLowerCase() === UP_HOST && (x.port === "" || x.port === "443") &&
      x.username === "" && x.password === "" && x.search === "" && x.hash === "" && x.pathname.replace(/\/+$/, "").toUpperCase() === "/WMLS";
  } catch { return false; }
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: origin === ORIGIN ? 204 : 403, headers: cors(origin) });
  if (origin !== ORIGIN) return json(403, { result: -1, error: "origin not allowed" }, origin);
  if (req.method === "GET") return json(200, { ok: true, service: "witsml-proxy", upstream: UPSTREAM, ops: [...OPS], tlsVerify: "enforced", perHostCertSkip: false, storesCredentials: false }, origin);
  if (req.method !== "POST") return json(405, { result: -1, error: "method not allowed" }, origin);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { result: -1, error: "request too large" }, origin);
  let a: Record<string, string>;
  try { a = JSON.parse(raw); } catch { return json(400, { result: -1, error: "bad json" }, origin); }
  if (a && (("user" in a) || ("pass" in a))) return json(400, { result: -1, error: "send credentials in X-Witsml-Authorization, not the body" }, origin);
  const op = a.op || "WMLS_GetFromStore";
  if (!OPS.has(op)) return json(403, { result: -1, error: "read-only proxy: op not allowed (GetVersion, GetCap, GetFromStore only)" }, origin);
  if (!allowedUrl(a.url)) return json(403, { result: -1, error: "upstream not allowed (only " + UPSTREAM + ")" }, origin);
  if (op === "WMLS_GetFromStore" && !/^[A-Za-z]{2,40}$/.test(String(a.wmlType || ""))) return json(400, { result: -1, error: "bad wmlType" }, origin);
  const auth = req.headers.get("X-Witsml-Authorization") || "";
  if (!/^Basic [A-Za-z0-9+/=]{4,1024}$/.test(auth)) return json(400, { result: -1, error: "credentials required (X-Witsml-Authorization: Basic …)" }, origin);
  const t0 = Date.now();
  let up: Response;
  try {
    up = await fetch(UPSTREAM, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(25000),
      headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": '"http://www.witsml.org/action/120/Store.' + op + '"', "Authorization": auth },
      body: envelope(op, a),
    });
  } catch (e) {
    const m = String((e as Error)?.message || e) + " " + String((e as { cause?: unknown })?.cause ?? "");
    const tls = /certificate|cert|tls|ssl|handshake|expired|UnknownIssuer/i.test(m);
    return json(502, { result: -1, error: tls ? "Upstream TLS certificate failed verification (e.g. expired). Verification is enforced; credentials were not sent over an unverified connection." : /timed? ?out|abort/i.test(m) ? "upstream timeout" : "upstream connection failed" }, origin);
  }
  if (up.status === 401 || up.status === 403) { await up.body?.cancel(); return json(up.status, { result: -1, error: "Authentication failed (" + up.status + ")" }, origin); }
  const body = await up.text();
  const fault = tag(body, "faultstring");
  if (fault) return json(200, { result: -1, error: "SOAP fault: " + unesc(fault).slice(0, 300) }, origin);
  if (up.status >= 400) return json(200, { result: -1, error: "HTTP " + up.status }, origin);
  const res = tag(body, "Result");
  const xml = unesc(tag(body, "XMLout") || tag(body, "CapabilitiesOut") || "");
  return json(200, { result: op === "WMLS_GetVersion" ? 1 : +(res ?? -1), version: op === "WMLS_GetVersion" ? res : undefined, xml, supp: unesc(tag(body, "SuppMsgOut") || ""), ms: Date.now() - t0 }, origin);
});
