// witsml-proxy (Netlify) — read-only HTTPS proxy for the Drilling World game -> one WITSML 1.4.1.1 SOAP server.
// * Stores NO credentials: user's own Basic creds per request in X-Witsml-Authorization only.
// * Exactly one upstream URL (allowlist); read SOAP ops only (GetVersion/GetCap/GetFromStore); envelope built here.
// * CORS: https://tittothomasai-code.github.io only; other/missing Origin -> 403.
// * Upstream 401/403 passed straight back. No logging at all.
// * TLS: verified everywhere, EXCEPT a per-request https.Agent({rejectUnauthorized:false}) used ONLY when the
//   upstream hostname === cfg.skipHost (australia.adagasolutions.com, whose cert is expired). Never global.
// * Cheap per-instance rate limit per client IP.
import https from "node:https";
export const ORIGIN = "https://tittothomasai-code.github.io";
const OPS = new Set(["WMLS_GetVersion", "WMLS_GetCap", "WMLS_GetFromStore"]);
const MAX_BODY = 64 * 1024, MAX_RESP = 16 * 1024 * 1024;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = s => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (x, t) => { const m = x.match(new RegExp("<(?:\\w+:)?" + t + "\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:\\w+:)?" + t + ">)")); return m ? (m[1] ?? "") : null; };
function envelope(op, a) {
  const body = op == "WMLS_GetVersion" ? "" : op == "WMLS_GetCap"
    ? `<OptionsIn xsi:type="xsd:string">${esc(a.options || "dataVersion=1.4.1.1")}</OptionsIn>`
    : `<WMLtypeIn xsi:type="xsd:string">${esc(a.wmlType)}</WMLtypeIn><QueryIn xsi:type="xsd:string">${esc(a.query)}</QueryIn><OptionsIn xsi:type="xsd:string">${esc(a.options || "")}</OptionsIn><CapabilitiesIn xsi:type="xsd:string"></CapabilitiesIn>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><q1:${op} xmlns:q1="http://www.witsml.org/message/120">${body}</q1:${op}></soap:Body></soap:Envelope>`;
}
function cors(origin) {
  const h = { "Vary": "Origin", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (origin === ORIGIN) Object.assign(h, { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Witsml-Authorization", "Access-Control-Max-Age": "600" });
  return h;
}
const json = (status, o, origin, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...cors(origin), "Content-Type": "application/json", ...extra } });
// Per-request HTTPS call. Cert skip ONLY for cfg.skipHost (exact match); all other hosts use default verified TLS.
export function httpsRequest(urlStr, { method = "GET", headers = {}, body, skipHost, timeoutMs = 9000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return reject(new Error("https only"));
    const skip = typeof skipHost === "string" && skipHost !== "" && u.hostname.toLowerCase() === skipHost;
    const opts = { method, headers, timeout: timeoutMs };
    if (skip) opts.agent = new https.Agent({ rejectUnauthorized: false, keepAlive: false, maxSockets: 1 });
    const rq = https.request(u, opts, rs => {
      const chunks = []; let n = 0;
      rs.on("data", c => { n += c.length; if (n > MAX_RESP) { rq.destroy(new Error("response too large")); return; } chunks.push(c); });
      rs.on("end", () => { resolve({ status: rs.statusCode, text: Buffer.concat(chunks).toString("utf8"), skipped: skip }); if (opts.agent) opts.agent.destroy(); });
      rs.on("error", reject);
    });
    rq.on("timeout", () => rq.destroy(new Error("timeout")));
    rq.on("error", e => { if (opts.agent) opts.agent.destroy(); reject(e); });
    if (body) rq.write(body);
    rq.end();
  });
}
const hits = new Map(); // ip -> [windowStart, count]
export function rateLimited(req, perMin) {
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?";
  const now = Date.now(); let e = hits.get(ip);
  if (!e || now - e[0] > 60000) { e = [now, 0]; hits.set(ip, e); }
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[0] > 60000) hits.delete(k);
  return ++e[1] > perMin;
}
export function makeProxy({ upstream, skipHost, perMin = 60 }) {
  const UP = new URL(upstream), UP_HOST = UP.hostname.toLowerCase(), UP_PATH = UP.pathname.replace(/\/+$/, "").toUpperCase();
  const allowedUrl = u => { if (typeof u !== "string") return false; try { const x = new URL(u);
    return x.protocol === "https:" && x.hostname.toLowerCase() === UP_HOST && (x.port === "" || x.port === "443") && x.username === "" && x.password === "" && x.search === "" && x.hash === "" && x.pathname.replace(/\/+$/, "").toUpperCase() === UP_PATH; } catch { return false; } };
  return async req => {
    const origin = req.headers.get("Origin");
    if (req.method === "OPTIONS") return new Response(null, { status: origin === ORIGIN ? 204 : 403, headers: cors(origin) });
    if (origin !== ORIGIN) return json(403, { result: -1, error: "origin not allowed" }, origin);
    if (rateLimited(req, perMin)) return json(429, { result: -1, error: "rate limit: max " + perMin + " requests/minute" }, origin, { "Retry-After": "30" });
    if (req.method === "GET") return json(200, { ok: true, service: "witsml-proxy", host: "netlify", upstream, ops: [...OPS], tlsVerify: "enforced except per-request skip for " + skipHost, storesCredentials: false, rateLimitPerMin: perMin }, origin);
    if (req.method !== "POST") return json(405, { result: -1, error: "method not allowed" }, origin);
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json(413, { result: -1, error: "request too large" }, origin);
    let a; try { a = JSON.parse(raw); } catch { return json(400, { result: -1, error: "bad json" }, origin); }
    if (!a || typeof a !== "object") return json(400, { result: -1, error: "bad json" }, origin);
    if ("user" in a || "pass" in a) return json(400, { result: -1, error: "send credentials in X-Witsml-Authorization, not the body" }, origin);
    const op = a.op || "WMLS_GetFromStore";
    if (!OPS.has(op)) return json(403, { result: -1, error: "read-only proxy: op not allowed (GetVersion, GetCap, GetFromStore only)" }, origin);
    if (!allowedUrl(a.url)) return json(403, { result: -1, error: "upstream not allowed (only " + upstream + ")" }, origin);
    if (op === "WMLS_GetFromStore" && !/^[A-Za-z]{2,40}$/.test(String(a.wmlType || ""))) return json(400, { result: -1, error: "bad wmlType" }, origin);
    const auth = req.headers.get("X-Witsml-Authorization") || "";
    if (!/^Basic [A-Za-z0-9+/=]{4,1024}$/.test(auth)) return json(400, { result: -1, error: "credentials required (X-Witsml-Authorization: Basic …)" }, origin);
    const t0 = Date.now(); let up;
    try {
      up = await httpsRequest(upstream, { method: "POST", skipHost, body: envelope(op, a),
        headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": '"http://www.witsml.org/action/120/Store.' + op + '"', "Authorization": auth } });
    } catch (e) {
      const m = String(e?.code || "") + " " + String(e?.message || e);
      const tls = /CERT|certificate|tls|ssl|handshake|expired/i.test(m);
      return json(502, { result: -1, error: tls ? "Upstream TLS certificate failed verification." : /timeout/i.test(m) ? "upstream timeout" : "upstream connection failed" }, origin);
    }
    if (up.status === 401 || up.status === 403) return json(up.status, { result: -1, error: "Authentication failed (" + up.status + ")" }, origin);
    if (up.status >= 300 && up.status < 400) return json(200, { result: -1, error: "upstream redirect refused" }, origin);
    const body = up.text, fault = tag(body, "faultstring");
    if (fault) return json(200, { result: -1, error: "SOAP fault: " + unesc(fault).slice(0, 300) }, origin);
    if (up.status >= 400) return json(200, { result: -1, error: "HTTP " + up.status }, origin);
    const res = tag(body, "Result"), xml = unesc(tag(body, "XMLout") || tag(body, "CapabilitiesOut") || "");
    return json(200, { result: op === "WMLS_GetVersion" ? 1 : +(res ?? -1), version: op === "WMLS_GetVersion" ? res : undefined, xml, supp: unesc(tag(body, "SuppMsgOut") || ""), ms: Date.now() - t0 }, origin);
  };
}
