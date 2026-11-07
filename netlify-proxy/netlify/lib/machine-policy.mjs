// Post-authentication policy for the read-only machine route.
// The handler supplies the host caller secret after its own check. This module
// checks that secret again, then requires a separate per-request upstream Basic
// value. The caller secret is never copied into the upstream request.
// TLS verification is mandatory. Redirects are not followed. Certificate
// failures are fatal. The game route's certificate skip is not used here.
// A direct Basic 401 from Adaga has an unknown cause and is not treated as an
// egress allow-list or as proof the upstream is reachable.

import { authenticateCaller, headerValues, readCallerConfig } from "./machine-auth.mjs";
import { authFailedResponse, deniedResponse, disabledResponse } from "./machine-disabled.mjs";

export const FIXED_UPSTREAM = "https://australia.adagasolutions.com/WMLS";
export const WITSML_NS = "http://www.witsml.org/message/120";
export const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
export const READ_OP_LIST = Object.freeze(["WMLS_GetVersion", "WMLS_GetCap", "WMLS_GetFromStore"]);
const READ_OPS = new Set(READ_OP_LIST);
const PROHIBITED = Object.freeze(["WMLS_AddToStore", "WMLS_UpdateInStore", "WMLS_DeleteFromStore"]);

export const LIMITS = Object.freeze({
  maxBody: 64 * 1024,
  maxResp: 2 * 1024 * 1024,
  timeoutMs: 9000,
  perMin: 30,
  maxQuery: 48 * 1024,
  maxOptions: 2048,
  maxFault: 300,
  maxElements: 10000,
  maxDepth: 64,
});

const SOAP_ACTIONS = Object.freeze({
  WMLS_GetVersion: '"http://www.witsml.org/action/120/Store.WMLS_GetVersion"',
  WMLS_GetCap: '"http://www.witsml.org/action/120/Store.WMLS_GetCap"',
  WMLS_GetFromStore: '"http://www.witsml.org/action/120/Store.WMLS_GetFromStore"',
});

const BASE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};

function coded(code) {
  const messages = {
    EFIXED: "fixed upstream violation",
    EBADXML: "upstream response rejected",
    EMISMATCH: "response mismatch",
    ETIMEDOUT: "timeout",
    ETOOLARGE: "response too large",
    ETLS: "tls",
    ECONN: "upstream connection failed",
  };
  const err = new Error(messages[code] || "upstream connection failed");
  err.code = code;
  return err;
}

function bad(kind) {
  const err = coded("EBADXML");
  err.kind = kind;
  throw err;
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { ...BASE_HEADERS } });
}

function tokenOf(auth) {
  return typeof auth === "string" && auth.startsWith("Basic ") ? auth.slice(6) : "";
}

function pushSecret(secrets, value) {
  if (typeof value === "string" && value.length >= 8) secrets.push(value);
  const token = tokenOf(value);
  if (token.length >= 8) secrets.push(token);
}

function safeJson(status, obj, auth, extra) {
  const secrets = [];
  pushSecret(secrets, auth);
  if (Array.isArray(extra)) extra.forEach((value) => pushSecret(secrets, value));
  else pushSecret(secrets, extra);
  let text = JSON.stringify(obj);
  let outStatus = status;
  if (secrets.some((s) => text.includes(s))) {
    text = JSON.stringify({ result: -1, error: "upstream response refused" });
    outStatus = 502;
  }
  return new Response(text, { status: outStatus, headers: { ...BASE_HEADERS } });
}

function redact(value, auth, extra) {
  let out = String(value);
  const secrets = [];
  pushSecret(secrets, auth);
  if (Array.isArray(extra)) extra.forEach((item) => pushSecret(secrets, item));
  else pushSecret(secrets, extra);
  for (const secret of secrets) out = out.split(secret).join("[redacted]");
  out = out.replace(/Basic\s+[A-Za-z0-9+/=]{8,}/g, "Basic [redacted]");
  return out;
}

function isBasic(auth) {
  return typeof auth === "string" && /^Basic [A-Za-z0-9+/=]{4,1024}$/.test(auth);
}

const esc = (s) => String(s)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function allowedText(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32 || c === 127) return false;
  }
  return true;
}

function boundOptions(options) {
  if (!/^[A-Za-z0-9=.;,_:+/ -]{0,2048}$/.test(options)) return null;
  if (options.length > LIMITS.maxOptions) return null;
  const mentions = options.split("maxReturnNodes=").length - 1;
  const insensitive = options.match(/maxreturnnodes/ig) || [];
  if (insensitive.length !== mentions) return null;
  const found = [...options.matchAll(/(?:^|;)maxReturnNodes=(\d+)(?=;|$)/g)];
  if (mentions !== found.length || mentions > 1) return null;
  if (mentions === 0) {
    const next = options ? options + ";maxReturnNodes=100" : "maxReturnNodes=100";
    if (next.length > LIMITS.maxOptions) return null;
    return next;
  }
  const n = Number(found[0][1]);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return null;
  return options;
}

export function buildEnvelope(op, fields) {
  if (op === "WMLS_GetVersion") {
    return '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><q1:WMLS_GetVersion xmlns:q1="http://www.witsml.org/message/120"></q1:WMLS_GetVersion></soap:Body></soap:Envelope>';
  }
  if (op === "WMLS_GetCap") {
    const options = esc(fields.options);
    return '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><q1:WMLS_GetCap xmlns:q1="http://www.witsml.org/message/120"><OptionsIn xsi:type="xsd:string">' + options + "</OptionsIn></q1:WMLS_GetCap></soap:Body></soap:Envelope>";
  }
  if (op === "WMLS_GetFromStore") {
    const body = '<WMLtypeIn xsi:type="xsd:string">' + esc(fields.wmlType) + '</WMLtypeIn><QueryIn xsi:type="xsd:string">' + esc(fields.query) + '</QueryIn><OptionsIn xsi:type="xsd:string">' + esc(fields.options) + '</OptionsIn><CapabilitiesIn xsi:type="xsd:string"></CapabilitiesIn>';
    return '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><q1:WMLS_GetFromStore xmlns:q1="http://www.witsml.org/message/120">' + body + "</q1:WMLS_GetFromStore></soap:Body></soap:Envelope>";
  }
  throw coded("EFIXED");
}

function stripComments(xml) {
  let out = "";
  let i = 0;
  while (i < xml.length) {
    const start = xml.indexOf("<!--", i);
    if (start < 0) {
      out += xml.slice(i);
      break;
    }
    out += xml.slice(i, start);
    const end = xml.indexOf("-->", start + 4);
    if (end < 0) bad("comment");
    i = end + 3;
  }
  return out;
}

function applyXmlns(attrs, nsMap) {
  const re = /\bxmlns(?::([A-Za-z_][\w.-]*))?\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(attrs))) nsMap.set(m[1] || "", m[3] ?? m[4] ?? "");
}

function walk(xmlText) {
  if (typeof xmlText !== "string" || xmlText.length > LIMITS.maxResp) bad("size");
  if (xmlText.charCodeAt(0) === 0xfeff || xmlText.includes("\0")) bad("markup");
  const xml = stripComments(xmlText);
  if (xml.includes("<!") || xml.includes("\0")) bad("markup");
  const roots = [];
  const stack = [];
  const nsStack = [new Map()];
  let i = 0;
  let seen = 0;
  let sawDecl = false;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) break;
    if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2);
      if (end < 0) bad("pi");
      const pi = xml.slice(lt, end + 2);
      if (sawDecl || xml.slice(0, lt).trim() !== "" || !/^<\?xml(\s[^?]*)?\?>$/.test(pi)) bad("pi");
      sawDecl = true;
      i = end + 2;
      continue;
    }
    const gt = xml.indexOf(">", lt + 1);
    if (gt < 0) bad("tag");
    const raw = xml.slice(lt + 1, gt);
    if ((raw.match(/"/g) || []).length % 2 !== 0) bad("tag");
    const rawTrim = raw.trim();
    if (rawTrim.startsWith("/")) {
      const name = rawTrim.slice(1).trim();
      if (!/^[\w.:-]+$/.test(name)) bad("tag");
      const top = stack.pop();
      nsStack.pop();
      if (!top || top.qualified !== name) bad("nesting");
      top.innerEnd = lt;
      i = gt + 1;
      continue;
    }
    const selfClosing = /\/\s*$/.test(rawTrim);
    const body = (selfClosing ? rawTrim.replace(/\/\s*$/, "") : rawTrim).trim();
    const sp = body.search(/\s/);
    const qualified = sp < 0 ? body : body.slice(0, sp);
    const attrs = sp < 0 ? "" : body.slice(sp + 1);
    if (!/^[\w.:-]+$/.test(qualified)) bad("tag");
    if (++seen > LIMITS.maxElements) bad("size");
    if (stack.length >= LIMITS.maxDepth) bad("depth");
    const ns = new Map(nsStack[nsStack.length - 1]);
    applyXmlns(attrs, ns);
    const colon = qualified.indexOf(":");
    const prefix = colon < 0 ? "" : qualified.slice(0, colon);
    const local = colon < 0 ? qualified : qualified.slice(colon + 1);
    const uri = prefix ? (ns.get(prefix) || "") : (ns.get("") || "");
    const el = { qualified, local, ns: uri, gt, innerEnd: null, selfClosing, children: [] };
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(el);
    else roots.push(el);
    if (!selfClosing) {
      stack.push(el);
      nsStack.push(ns);
    }
    i = gt + 1;
  }
  if (stack.length) bad("nesting");
  if (roots.length === 0) bad("empty");
  return { roots, xml };
}

function flatten(els, out = []) {
  for (const el of els) {
    out.push(el);
    flatten(el.children, out);
  }
  return out;
}

function directText(src, el) {
  if (el.selfClosing) return "";
  if (el.innerEnd == null) bad("nesting");
  const inner = src.slice(el.gt + 1, el.innerEnd);
  if (inner.includes("<")) bad("structure");
  return inner;
}

function numericChar(cp) {
  if (!Number.isInteger(cp) || cp <= 0 || cp > 0x10ffff) bad("entity");
  if (cp >= 0xd800 && cp <= 0xdfff) bad("entity");
  if ((cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) || cp === 127) bad("entity");
  if (cp === 0xfffe || cp === 0xffff) bad("entity");
  return String.fromCodePoint(cp);
}

function unescapeText(s) {
  if (s.includes("\0")) bad("entity");
  const re = /&(#x[0-9A-Fa-f]{1,6}|#\d{1,7}|[A-Za-z]+);/g;
  let last = 0;
  let out = "";
  let m;
  while ((m = re.exec(s))) {
    if (s.slice(last, m.index).includes("&")) bad("entity");
    const body = m[1];
    let ch;
    if (body === "lt") ch = "<";
    else if (body === "gt") ch = ">";
    else if (body === "amp") ch = "&";
    else if (body === "quot") ch = '"';
    else if (body === "apos") ch = "'";
    else if (body.startsWith("#x")) ch = numericChar(parseInt(body.slice(2), 16));
    else if (body.startsWith("#")) ch = numericChar(parseInt(body.slice(1), 10));
    else bad("entity");
    out += s.slice(last, m.index) + ch;
    last = m.index + m[0].length;
  }
  if (s.slice(last).includes("&")) bad("entity");
  out += s.slice(last);
  return out;
}

export function assertOutgoingEnvelope(op, xml) {
  if (!READ_OPS.has(op)) throw coded("EFIXED");
  const { roots } = walk(xml);
  const all = flatten(roots);
  const ops = all.filter((el) => el.local.startsWith("WMLS_"));
  if (ops.length !== 1 || ops[0].local !== op || ops[0].ns !== WITSML_NS) throw coded("EFIXED");
  for (const el of all) if (PROHIBITED.includes(el.local)) throw coded("EFIXED");
}

export function parseUpstreamSoap(op, xmlText) {
  if (!READ_OPS.has(op)) throw coded("EBADXML");
  const { roots, xml } = walk(xmlText);
  const all = flatten(roots);
  const banned = new Set(PROHIBITED.flatMap((name) => [name, name + "Response"]));
  for (const name of READ_OPS) {
    if (name !== op) banned.add(name);
    if (name + "Response" !== op + "Response") banned.add(name + "Response");
  }
  for (const el of all) if (banned.has(el.local)) throw coded("EMISMATCH");
  const faults = all.filter((el) => el.local === "Fault" && el.ns === SOAP_NS);
  if (faults.length > 1) bad("fault");
  if (faults.length === 1) {
    const strings = all.filter((el) => el.local.toLowerCase() === "faultstring");
    let fault = "SOAP fault";
    if (strings.length === 1) {
      try { fault = unescapeText(directText(xml, strings[0])) || "SOAP fault"; }
      catch { fault = "SOAP fault"; }
    }
    return { kind: "fault", fault };
  }
  const responses = all.filter((el) => el.local === op + "Response");
  if (responses.length !== 1) throw coded("EMISMATCH");
  const response = responses[0];
  if (response.ns !== WITSML_NS) throw coded("EMISMATCH");
  const resultEls = response.children.filter((el) => el.local === "Result");
  if (resultEls.length !== 1) bad("result");
  const resultText = unescapeText(directText(xml, resultEls[0])).trim();
  let xmlOut = "";
  if (op === "WMLS_GetFromStore") {
    const outs = response.children.filter((el) => el.local === "XMLout");
    if (outs.length !== 1) bad("xmlout");
    xmlOut = unescapeText(directText(xml, outs[0]));
  } else if (op === "WMLS_GetCap") {
    const outs = response.children.filter((el) => el.local === "CapabilitiesOut");
    if (outs.length !== 1) bad("cap");
    xmlOut = unescapeText(directText(xml, outs[0]));
  }
  const supps = response.children.filter((el) => el.local === "SuppMsgOut");
  if (supps.length > 1) bad("supp");
  const supp = supps.length === 1 ? unescapeText(directText(xml, supps[0])) : "";
  return { kind: "ok", resultText, xml: xmlOut, supp };
}

function validateSpec(spec) {
  if (!spec || spec.url !== FIXED_UPSTREAM || spec.method !== "POST" || typeof spec.body !== "string") {
    throw coded("EFIXED");
  }
  const headers = spec.headers;
  if (!headers || Object.keys(headers).length !== 4) throw coded("EFIXED");
  const contentType = headers["Content-Type"];
  const soapAction = headers.SOAPAction;
  const authorization = headers.Authorization;
  const contentLength = headers["Content-Length"];
  if (contentType !== "text/xml; charset=utf-8") throw coded("EFIXED");
  if (!Object.values(SOAP_ACTIONS).includes(soapAction)) throw coded("EFIXED");
  if (!isBasic(authorization)) throw coded("EFIXED");
  if (!/^\d{1,8}$/.test(contentLength)) throw coded("EFIXED");
  if (Number(contentLength) !== Buffer.byteLength(spec.body)) throw coded("EFIXED");
  for (const value of [contentType, soapAction, authorization, contentLength]) {
    if (typeof value !== "string" || /[\r\n\0]/.test(value)) throw coded("EFIXED");
  }
  if (spec.body.includes("\0")) throw coded("EFIXED");
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (lower === "x-witsml-machine-key" || lower === "cookie" || lower === "proxy-authorization") throw coded("EFIXED");
  }
  if (typeof spec.callerSecret === "string" && spec.callerSecret.length >= 8) {
    const blob = spec.body + "\n" + contentType + "\n" + soapAction + "\n" + authorization + "\n" + contentLength;
    if (blob.includes(spec.callerSecret)) throw coded("EFIXED");
  }
  const op = Object.keys(SOAP_ACTIONS).find((name) => SOAP_ACTIONS[name] === soapAction);
  assertOutgoingEnvelope(op, spec.body);
}

export function createVerifiedDispatch(httpsImpl, timers = {}) {
  if (!httpsImpl || typeof httpsImpl.request !== "function" || typeof httpsImpl.Agent !== "function") {
    throw coded("EFIXED");
  }
  const schedule = typeof timers.schedule === "function" ? timers.schedule : setTimeout;
  const cancel = typeof timers.cancel === "function" ? timers.cancel : clearTimeout;

  async function dispatch(spec) {
    validateSpec(spec);
    const agent = new httpsImpl.Agent({ rejectUnauthorized: true, keepAlive: false, maxSockets: 1 });
    if (agent && agent.opts && agent.opts.rejectUnauthorized !== true) {
      agent.destroy?.();
      throw coded("ETLS");
    }
    const options = Object.freeze({
      protocol: "https:",
      hostname: "australia.adagasolutions.com",
      port: 443,
      path: "/WMLS",
      method: "POST",
      servername: "australia.adagasolutions.com",
      rejectUnauthorized: true,
      agent,
      timeout: LIMITS.timeoutMs,
      headers: Object.freeze({
        "Content-Type": spec.headers["Content-Type"],
        SOAPAction: spec.headers.SOAPAction,
        Authorization: spec.headers.Authorization,
        "Content-Length": spec.headers["Content-Length"],
      }),
    });
    if (options.rejectUnauthorized !== true || options.hostname !== "australia.adagasolutions.com" || options.path !== "/WMLS" || options.servername !== "australia.adagasolutions.com" || options.protocol !== "https:" || options.port !== 443 || options.method !== "POST" || options.timeout !== LIMITS.timeoutMs || options.checkServerIdentity !== undefined || options.lookup !== undefined || options.agent !== agent) {
      agent.destroy?.();
      throw coded("ETLS");
    }
    if (spec.signal?.aborted) {
      try { agent.destroy?.(); } catch { /* already closed */ }
      throw coded("ECONN");
    }
    return await new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      let req;
      let resStream = null;
      const signal = spec.signal;
      let onAbort = null;
      const cleanup = () => {
        if (timer) cancel(timer);
        timer = null;
        if (signal && onAbort) signal.removeEventListener("abort", onAbort);
        try { resStream?.destroy?.(); } catch { /* already closed */ }
        try { req?.destroy?.(); } catch { /* already closed */ }
        try { agent.destroy?.(); } catch { /* already closed */ }
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      try {
        req = httpsImpl.request(options, (res) => {
          resStream = res;
          if (!res || typeof res.on !== "function") {
            finish(reject, coded("ECONN"));
            return;
          }
          const chunks = [];
          let n = 0;
          let failed = false;
          res.on("data", (c) => {
            if (failed || settled) return;
            const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
            n += buf.length;
            if (n > LIMITS.maxResp) {
              failed = true;
              finish(reject, coded("ETOOLARGE"));
              return;
            }
            chunks.push(buf);
          });
          res.on("end", () => {
            if (failed || settled) return;
            const resHeaders = res.headers || {};
            const location = resHeaders.location || resHeaders.Location || "";
            finish(resolve, {
              status: res.statusCode,
              text: Buffer.concat(chunks).toString("utf8"),
              location: typeof location === "string" ? location : "",
            });
          });
          res.on("error", () => finish(reject, coded("ECONN")));
        });
      } catch {
        try { agent.destroy?.(); } catch { /* already closed */ }
        reject(coded("ECONN"));
        return;
      }
      if (!req || typeof req.end !== "function") {
        finish(reject, coded("ECONN"));
        return;
      }
      onAbort = () => finish(reject, coded("ECONN"));
      if (signal) {
        if (signal.aborted) {
          finish(reject, coded("ECONN"));
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
      timer = schedule(() => finish(reject, coded("ETIMEDOUT")), LIMITS.timeoutMs);
      if (settled) return;
      req.on?.("timeout", () => finish(reject, coded("ETIMEDOUT")));
      req.on?.("error", (err) => {
        const code = String(err && err.code || "");
        const fatalTls = /CERT|TLS|SSL|UNABLE_TO_VERIFY|HOSTNAME/i.test(code);
        finish(reject, fatalTls ? coded("ETLS") : coded("ECONN"));
      });
      if (settled) return;
      try {
        if (spec.body) req.write(spec.body);
        req.end();
      } catch {
        finish(reject, coded("ECONN"));
      }
    });
  }

  Object.defineProperty(dispatch, "verifiedTransport", { value: true });
  return dispatch;
}

function mapDispatchError(err) {
  const code = err && err.code;
  if (code === "ETIMEDOUT") return json(504, { result: -1, error: "upstream timeout" });
  if (code === "ETOOLARGE") return json(502, { result: -1, error: "upstream response too large" });
  if (code === "ETLS") return json(502, { result: -1, error: "Upstream TLS certificate failed verification." });
  if (code === "EFIXED") return json(403, { result: -1, error: "upstream not allowed" });
  if (code === "EMISMATCH") return json(502, { result: -1, error: "response mismatch" });
  return json(502, { result: -1, error: "upstream connection failed" });
}

function validateFields(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { error: json(400, { result: -1, error: "bad json" }) }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: json(400, { result: -1, error: "bad json" }) };
  }
  const allowed = new Set(["op", "wmlType", "query", "options"]);
  const clean = Object.create(null);
  for (const key of Object.keys(parsed)) {
    if (!allowed.has(key)) return { error: json(400, { result: -1, error: "unexpected field" }) };
    clean[key] = parsed[key];
  }
  if (typeof clean.op !== "string" || !READ_OPS.has(clean.op)) {
    return { error: json(403, { result: -1, error: "read-only proxy: op not allowed" }) };
  }
  const op = clean.op;
  if (op === "WMLS_GetVersion") {
    if ("wmlType" in clean || "query" in clean || "options" in clean) {
      return { error: json(400, { result: -1, error: "unexpected field" }) };
    }
    return { op, fields: {} };
  }
  if (op === "WMLS_GetCap") {
    if ("wmlType" in clean || "query" in clean) {
      return { error: json(400, { result: -1, error: "unexpected field" }) };
    }
    const options = clean.options == null ? "dataVersion=1.4.1.1" : clean.options;
    if (typeof options !== "string" || !/^[A-Za-z0-9=.;,_:+/ -]{1,2048}$/.test(options)) {
      return { error: json(400, { result: -1, error: "bad options" }) };
    }
    return { op, fields: { options } };
  }
  if (typeof clean.wmlType !== "string" || !/^[A-Za-z]{2,40}$/.test(clean.wmlType)) {
    return { error: json(400, { result: -1, error: "bad wmlType" }) };
  }
  if (typeof clean.query !== "string" || clean.query.length < 1 || clean.query.length > LIMITS.maxQuery) {
    const status = typeof clean.query === "string" && clean.query.length > LIMITS.maxQuery ? 413 : 400;
    const error = status === 413 ? "query too large" : "bad query";
    return { error: json(status, { result: -1, error }) };
  }
  if (!allowedText(clean.query) || /<!/i.test(clean.query)) {
    return { error: json(400, { result: -1, error: "bad query" }) };
  }
  const options = clean.options == null ? "" : clean.options;
  if (typeof options !== "string") return { error: json(400, { result: -1, error: "bad options" }) };
  if (options.length > LIMITS.maxOptions) return { error: json(413, { result: -1, error: "options too large" }) };
  const bounded = boundOptions(options);
  if (bounded == null) return { error: json(400, { result: -1, error: "bad options" }) };
  return { op, fields: { wmlType: clean.wmlType, query: clean.query, options: bounded } };
}

function hasLocation(up) {
  const loc = up && up.location;
  if (typeof loc === "string") return loc.length > 0;
  return Array.isArray(loc) && loc.length > 0;
}

function smuggleProblem(req) {
  if (headerValues(req, "transfer-encoding").length > 0) return "transfer-encoding";
  const lengths = headerValues(req, "content-length");
  if (lengths.length > 1) return "content-length";
  if (lengths.length === 1 && !/^\d{1,8}$/.test(String(lengths[0]).trim())) return "content-length";
  if (headerValues(req, "content-type").length > 1) return "content-type";
  if (headerValues(req, "soapaction").length > 0) return "soapaction";
  return "";
}

export async function enforceMachinePolicy(req, deps) {
  const callerSecret = deps && deps.callerSecret;
  const config = readCallerConfig({ WITSML_MACHINE_CALLER_SECRET: callerSecret });
  if (!config.configured) return disabledResponse();
  if (!req || typeof req.method !== "string") return disabledResponse();
  if (!authenticateCaller(req, config.secret).ok) return authFailedResponse();
  if (!deps.dispatch || deps.dispatch.verifiedTransport !== true) return deniedResponse();
  const seal = (status, obj, auth) => safeJson(status, obj, auth, config.secret);
  if (req.method === "GET") {
    return seal(200, {
      ok: true,
      service: "witsml-machine",
      configured: true,
      upstreamContact: false,
      upstream: FIXED_UPSTREAM,
      acceptsClientUpstream: false,
      ops: READ_OP_LIST,
      tlsVerify: "required",
      certificateSkip: "not-used",
      inheritedGameCertificateSkip: "unchanged-on-game-route-only",
      storesUpstreamCredentials: false,
      callerAuthentication: "host-env-secret",
      callerSecretForwarded: false,
      deployRevisionEquivalence: "unverified",
    });
  }
  if (req.method !== "POST") return json(405, { result: -1, error: "method not allowed" });
  const smuggle = smuggleProblem(req);
  if (smuggle === "soapaction") return json(400, { result: -1, error: "client SOAPAction is not accepted" });
  if (smuggle) return json(400, { result: -1, error: "request rejected" });
  const contentType = headerValues(req, "content-type")[0] || "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(String(contentType).trim())) {
    return json(415, { result: -1, error: "content-type must be application/json" });
  }
  const declared = headerValues(req, "content-length");
  if (declared.length === 1 && Number(declared[0]) > LIMITS.maxBody) {
    return json(413, { result: -1, error: "request too large" });
  }
  const raw = typeof req.text === "function" ? await req.text() : "";
  if (raw.length > LIMITS.maxBody || Buffer.byteLength(raw) > LIMITS.maxBody) {
    return json(413, { result: -1, error: "request too large" });
  }
  if (declared.length === 1 && Number(declared[0]) !== Buffer.byteLength(raw)) {
    return seal(400, { result: -1, error: "request rejected" }, "");
  }
  if (raw.includes(config.secret)) return seal(400, { result: -1, error: "request rejected" }, "");
  const validated = validateFields(raw);
  if (validated.error) return validated.error;
  const authValues = headerValues(req, "x-witsml-authorization");
  if (authValues.length !== 1) return seal(400, { result: -1, error: "credentials required" }, "");
  const auth = String(authValues[0]);
  if (auth.includes(config.secret)) return seal(400, { result: -1, error: "credentials required" }, "");
  if (!isBasic(auth)) return seal(400, { result: -1, error: "credentials required" }, auth);
  let envelope;
  try {
    envelope = buildEnvelope(validated.op, validated.fields);
    assertOutgoingEnvelope(validated.op, envelope);
  } catch (err) {
    return mapDispatchError(err);
  }
  if (envelope.includes(config.secret)) return seal(400, { result: -1, error: "request rejected" }, "");
  const now = typeof deps.now === "function" ? deps.now : Date.now;
  const t0 = now();
  let up;
  try {
    up = await deps.dispatch({
      url: FIXED_UPSTREAM,
      method: "POST",
      body: envelope,
      callerSecret: config.secret,
      signal: req.signal,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: SOAP_ACTIONS[validated.op],
        Authorization: auth,
        "Content-Length": String(Buffer.byteLength(envelope)),
      },
    });
  } catch (err) {
    return seal(mapStatus(err), mapBody(err), auth);
  }
  return finishUpstream(validated.op, auth, up, Math.max(0, now() - t0), config.secret);
}

function mapStatus(err) {
  const res = mapDispatchError(err);
  return res.status;
}

function mapBody(err) {
  const code = err && err.code;
  if (code === "ETIMEDOUT") return { result: -1, error: "upstream timeout" };
  if (code === "ETOOLARGE") return { result: -1, error: "upstream response too large" };
  if (code === "ETLS") return { result: -1, error: "Upstream TLS certificate failed verification." };
  if (code === "EFIXED") return { result: -1, error: "upstream not allowed" };
  if (code === "EMISMATCH") return { result: -1, error: "response mismatch" };
  return { result: -1, error: "upstream connection failed" };
}

function finishUpstream(op, auth, up, ms, callerSecret) {
  const seal = (status, obj) => safeJson(status, obj, auth, callerSecret);
  if (typeof callerSecret === "string" && callerSecret.length >= 8 && typeof up?.text === "string" && up.text.includes(callerSecret)) {
    return seal(502, { result: -1, error: "upstream response refused" });
  }
  if (!up || typeof up.status !== "number") {
    return seal(502, { result: -1, error: "upstream connection failed" });
  }
  if ((up.status >= 300 && up.status < 400) || hasLocation(up)) {
    return seal(502, { result: -1, error: "upstream redirect refused" });
  }
  if (up.status === 401 || up.status === 403) {
    return seal(up.status, { result: -1, error: "Authentication failed (" + up.status + ")" });
  }
  if (up.status !== 200) {
    const code = String(up.status);
    const error = /^\d{3}$/.test(code) ? "HTTP " + code : "upstream connection failed";
    return seal(502, { result: -1, error });
  }
  const text = typeof up.text === "string" ? up.text : "";
  if (text.length > LIMITS.maxResp) {
    return seal(502, { result: -1, error: "upstream response too large" });
  }
  const token = tokenOf(auth);
  if ((auth && text.includes(auth)) || (token.length >= 8 && text.includes(token))) {
    return seal(502, { result: -1, error: "upstream response refused" });
  }
  let parsed;
  try { parsed = parseUpstreamSoap(op, text); }
  catch (err) {
    if (err && err.code === "EMISMATCH") return seal(502, { result: -1, error: "response mismatch" });
    return seal(502, { result: -1, error: "upstream response rejected" });
  }
  if (parsed.kind === "fault") {
    const fault = redact(parsed.fault, auth, callerSecret).slice(0, LIMITS.maxFault);
    return seal(200, { result: -1, error: "SOAP fault: " + fault });
  }
  const supp = redact(parsed.supp, auth, callerSecret).slice(0, LIMITS.maxFault);
  if (typeof parsed.xml === "string" && typeof callerSecret === "string" && parsed.xml.includes(callerSecret)) {
    return seal(502, { result: -1, error: "upstream response refused" });
  }
  if (op === "WMLS_GetVersion") {
    if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,31}$/.test(parsed.resultText)) {
      return seal(502, { result: -1, error: "upstream response rejected" });
    }
    return seal(200, { result: 1, version: parsed.resultText, xml: "", supp, ms });
  }
  if (!/^-?\d{1,9}$/.test(parsed.resultText)) {
    return seal(502, { result: -1, error: "upstream response rejected" });
  }
  return seal(200, { result: Number(parsed.resultText), xml: parsed.xml, supp, ms });
}
