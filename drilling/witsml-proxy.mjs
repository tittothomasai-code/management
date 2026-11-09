// Game proxy for the drilling page (POST /witsml-proxy).
//
// Before this redaction step, the deployed game route did not look at
// credentials inside a store reply. That code is netlify-proxy/netlify/lib/core.mjs
// makeProxy (sha256 74c687f08f4499bacb89b5d3a394859102e17707a8804c277cf4121589eb7825)
// wrapped by netlify-proxy/netlify/functions/witsml-proxy.mjs
// (sha256 d8c4e95580c2544567fe658d6ae41d1b5cce4b02c47da6a7c0d93eb205736b34).
// Those bytes are the same on gh-pages and on PR #17
// (beecf9d7cce222337fe80722558db9b129faebdf). This drilling branch did not
// contain them. What that route did with a reply that echoes the caller's
// password:
//   * It did not scan the reply. XMLout and SuppMsgOut were unescaped and
//     returned on HTTP 200 as xml and supp, password included.
//   * A SOAP faultstring was copied into error (first 300 characters), also
//     HTTP 200, password included when the fault echoed it.
//   * HTTP 502 was only the upstream socket: TLS verification, timeout, or
//     connection failure. A password match was not a 502 on this route.
// The password-match HTTP 502 is /witsml-machine (machine-policy sealRefusal
// on the gh-pages stack, PRs #15/#16/#17). This game route never shared that
// check.
//
// Allow-list, Basic-header auth, and the read-only operation set below are
// the same checks as that game route. Slot naming is the shared module from
// PR #17 (drilling/witsml-redaction-slots.mjs, sha256
// 66743dbe459e0793a6e307f9a0ccf2ae2926511a18c0d6e9016b5e902447f73b), not a
// second algorithm. A password-only match whose every changed node has a
// slot is HTTP 200 with passwordRedacted, redactionScope "slots", and
// redactedSlots. Anything else that matched is HTTP 422 code "proxy-refusal"
// with no document. 502 stays the transport failure.
//
// No reply body, fault text, or credential is written to the log.

import https from "node:https";
import { locateAndRedact, MAX_REDACTION_SLOTS, REDACTION_SLOT_RE } from "./witsml-redaction-slots.mjs";

export const ORIGIN = "https://tittothomasai-code.github.io";
export const ORIGINS = new Set([ORIGIN, "https://drilling.robotyx.systems"]);
const OPS = new Set(["WMLS_GetVersion", "WMLS_GetCap", "WMLS_GetFromStore"]);
const MAX_BODY = 64 * 1024, MAX_RESP = 16 * 1024 * 1024;
const VALUE_MARK = "***";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = s => String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (x, t) => { const m = String(x || "").match(new RegExp("<(?:\\w+:)?" + t + "\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:\\w+:)?" + t + ">)")); return m ? (m[1] ?? "") : null; };
function envelope(op, a) {
  const body = op == "WMLS_GetVersion" ? "" : op == "WMLS_GetCap"
    ? `<OptionsIn xsi:type="xsd:string">${esc(a.options || "dataVersion=1.4.1.1")}</OptionsIn>`
    : `<WMLtypeIn xsi:type="xsd:string">${esc(a.wmlType)}</WMLtypeIn><QueryIn xsi:type="xsd:string">${esc(a.query)}</QueryIn><OptionsIn xsi:type="xsd:string">${esc(a.options || "")}</OptionsIn><CapabilitiesIn xsi:type="xsd:string"></CapabilitiesIn>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><q1:${op} xmlns:q1="http://www.witsml.org/message/120">${body}</q1:${op}></soap:Body></soap:Envelope>`;
}
function cors(origin) {
  const h = { "Vary": "Origin", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (ORIGINS.has(origin)) Object.assign(h, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Witsml-Authorization", "Access-Control-Max-Age": "600" });
  return h;
}
const json = (status, o, origin, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...cors(origin), "Content-Type": "application/json", ...extra } });

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
const hits = new Map();
export function rateLimited(req, perMin) {
  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "?";
  const now = Date.now(); let e = hits.get(ip);
  if (!e || now - e[0] > 60000) { e = [now, 0]; hits.set(ip, e); }
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[0] > 60000) hits.delete(k);
  return ++e[1] > perMin;
}

const longEnough = (value) => [...String(value ?? "")].length >= 4;

export function credentialParts(auth) {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(String(auth || ""));
  if (!match) return { password: "", blockers: [] };
  const token = match[1];
  let raw = "";
  try { raw = Buffer.from(token, "base64").toString("utf8"); } catch { raw = ""; }
  const colon = raw.indexOf(":");
  const password = colon > 0 ? raw.slice(colon + 1) : "";
  const blockers = [];
  const header = "Basic " + token;
  if (longEnough(header)) blockers.push(header);
  if (longEnough(token)) blockers.push(token);
  if (longEnough(raw)) blockers.push(raw);
  return { password: longEnough(password) ? password : "", blockers };
}

function containsAny(text, secrets) {
  return typeof text === "string" && secrets.some((secret) => secret && text.includes(secret));
}

function sealedRefusal(reason, secrets) {
  const body = { result: -1, error: "proxy refusal", code: "proxy-refusal", reason };
  const drop = ["reason", "code", "error", "result"];
  if (!containsAny(JSON.stringify(body), secrets)) return body;
  for (const key of drop) {
    delete body[key];
    if (!containsAny(JSON.stringify(body), secrets)) return body;
  }
  return {};
}

function refusal(reason, secrets) {
  return { status: 422, body: sealedRefusal(reason, secrets) };
}

function plainSlot(text, password, id) {
  if (typeof text !== "string" || !password || !text.includes(password)) return { text: text || "", redacted: false };
  const next = text.split(password).join(VALUE_MARK);
  if (next.includes(password)) return { failed: true, text: "" };
  return { text: next, redacted: true, id };
}

// Password-only matches are named with the shared slot module.
// A Basic token, the user:password pair, a structural rename, or any match
// that cannot be named becomes a 422 refusal with no document.
export function redactStoreReply({ op, res, xml, supp, fault, password, blockers, ms }) {
  const secrets = [password, ...(blockers || [])].filter(Boolean);
  const surfaces = [res, xml, supp, fault];
  if ((blockers || []).some((secret) => surfaces.some((text) => containsAny(text, [secret])))) {
    return refusal("credential-reflection", secrets);
  }
  const passwordHit = password && surfaces.some((text) => typeof text === "string" && text.includes(password));
  if (!passwordHit) {
    if (fault) return { status: 200, body: { result: -1, error: "SOAP fault: " + String(fault).slice(0, 300) } };
    return { status: 200, body: { result: op === "WMLS_GetVersion" ? 1 : +(res ?? -1), version: op === "WMLS_GetVersion" ? res : undefined, xml: xml || "", supp: supp || "", ms } };
  }
  if (typeof res === "string" && res.includes(password)) return refusal("redaction-incomplete", secrets);
  let xmlOut = typeof xml === "string" ? xml : "";
  let slots = [];
  if (xmlOut.includes(password)) {
    const named = locateAndRedact(xmlOut, password);
    if (named.malformed || named.unclassifiable || named.structural || named.redacted !== true) return refusal("redaction-incomplete", secrets);
    xmlOut = named.xml;
    slots = (named.slots || []).slice();
  }
  const suppNamed = plainSlot(supp, password, "supp/1");
  const faultNamed = plainSlot(fault, password, "fault/1");
  if (suppNamed.failed || faultNamed.failed) return refusal("redaction-incomplete", secrets);
  if (suppNamed.redacted) slots.push(suppNamed.id);
  if (faultNamed.redacted) slots.push(faultNamed.id);
  const words = ["passwordRedacted", "redactionScope", "redactedSlots", "slots", "response"];
  const slotsOk = slots.length > 0
    && slots.length <= MAX_REDACTION_SLOTS
    && words.every((word) => !word.includes(password))
    && slots.every((slot) => REDACTION_SLOT_RE.test(slot) && !slot.includes(password));
  if (!slotsOk || [xmlOut, suppNamed.text, faultNamed.text].some((text) => text.includes(password))) {
    return refusal("redaction-incomplete", secrets);
  }
  const marked = { passwordRedacted: true, redactionScope: "slots", redactedSlots: slots };
  const body = fault
    ? { result: -1, error: "SOAP fault: " + faultNamed.text.slice(0, 300), ...marked }
    : { result: op === "WMLS_GetVersion" ? 1 : +(res ?? -1), version: op === "WMLS_GetVersion" ? res : undefined, xml: xmlOut, supp: suppNamed.text, ms, ...marked };
  if (containsAny(JSON.stringify(body), secrets)) return refusal("redaction-incomplete", secrets);
  return { status: 200, body };
}

export function makeProxy({ upstream, skipHost, perMin = 60, transport = httpsRequest } = {}) {
  const UP = new URL(upstream), UP_HOST = UP.hostname.toLowerCase(), UP_PATH = UP.pathname.replace(/\/+$/, "").toUpperCase();
  const allowedUrl = u => { if (typeof u !== "string") return false; try { const x = new URL(u);
    return x.protocol === "https:" && x.hostname.toLowerCase() === UP_HOST && (x.port === "" || x.port === "443") && x.username === "" && x.password === "" && x.search === "" && x.hash === "" && x.pathname.replace(/\/+$/, "").toUpperCase() === UP_PATH; } catch { return false; } };
  return async req => {
    const origin = req.headers.get("Origin");
    if (req.method === "OPTIONS") return new Response(null, { status: ORIGINS.has(origin) ? 204 : 403, headers: cors(origin) });
    if (!ORIGINS.has(origin)) return json(403, { result: -1, error: "origin not allowed" }, origin);
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
    const creds = credentialParts(auth);
    const t0 = Date.now(); let up;
    try {
      up = await transport(upstream, { method: "POST", skipHost, body: envelope(op, a),
        headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": '"http://www.witsml.org/action/120/Store.' + op + '"', "Authorization": auth } });
    } catch (e) {
      const m = String(e?.code || "") + " " + String(e?.message || e);
      const tls = /CERT|certificate|tls|ssl|handshake|expired/i.test(m);
      return json(502, { result: -1, error: tls ? "Upstream TLS certificate failed verification." : /timeout/i.test(m) ? "upstream timeout" : "upstream connection failed" }, origin);
    }
    if (up.status === 401 || up.status === 403) return json(up.status, { result: -1, error: "Authentication failed (" + up.status + ")" }, origin);
    if (up.status >= 300 && up.status < 400) return json(200, { result: -1, error: "upstream redirect refused" }, origin);
    const body = up.text, fault = tag(body, "faultstring");
    const res = tag(body, "Result"), xml = unesc(tag(body, "XMLout") || tag(body, "CapabilitiesOut") || ""), supp = unesc(tag(body, "SuppMsgOut") || "");
    if (fault) {
      const shaped = redactStoreReply({ op, res, xml: "", supp: "", fault: unesc(fault), password: creds.password, blockers: creds.blockers, ms: Date.now() - t0 });
      return json(shaped.status, shaped.body, origin);
    }
    if (up.status >= 400) return json(200, { result: -1, error: "HTTP " + up.status }, origin);
    const shaped = redactStoreReply({ op, res, xml, supp, fault: "", password: creds.password, blockers: creds.blockers, ms: Date.now() - t0 });
    return json(shaped.status, shaped.body, origin);
  };
}

const UPSTREAM = "https://australia.adagasolutions.com/WMLS";
export default makeProxy({ upstream: UPSTREAM, skipHost: "australia.adagasolutions.com", perMin: 60 });
export const config = { path: "/witsml-proxy" };
