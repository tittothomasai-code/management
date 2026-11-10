// Credential echo guard for the WITSML game proxies.
//
// A store reply can carry the caller's password in a form that is not the
// literal text: XML-escaped inside the inner document (&lt; &amp; ...),
// numeric character references (&#70; &#x46;, with any number of leading
// zeros), split across CDATA sections, split by comments or child tags
// (including tags whose quoted attribute values contain ">"), or escaped
// more than once. The browser reader decodes all of these (DOMParser,
// unesc), so a literal-only scan is fail-open. This module builds fully
// decoded views of a reply field and reports whether any of them contains a
// credential.
//
// A DOCTYPE or ENTITY declaration anywhere in a reply is refused outright:
// DOMParser expands internal entities, so no scan of the undeclared text can
// be complete.
//
// All scanning is linear in the input: comments, CDATA and processing
// instructions are removed with indexOf loops, and an unterminated opener
// stops that pass (the raw view is still scanned).
//
// Callers refuse with HTTP 422 and no document when guardReason() is set
// (echoes() is the boolean form). Nothing here logs. Secrets never leave
// this module except as booleans.
//
// The same bytes ship in three places (drilling game proxy, Netlify game
// proxy lib, Supabase fallback); tests pin the sha256.

const MIN_SECRET = 4;
const MAX_ROUNDS = 8;
const NAMED = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: "\u00a0" };
// Leading zeros are unlimited (XML allows them); the significant digits are
// bounded so the code point stays in range.
const ENTITY_RE = /&(#[xX]0*[0-9a-fA-F]{1,6}|#0*[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,8});/g;
// Quote-aware tag. '<' cannot occur inside an XML attribute value, so a
// quoted run stops at '<' and the match stays linear.
const TAG_RE = /<\/?[A-Za-z_](?:[^<>"']|"[^"<]*"|'[^'<]*')*>/g;
const DECLARATION_RE = /<!\s*(?:DOCTYPE|ENTITY)\b/i;

const long = (value) => [...String(value ?? "")].length >= MIN_SECRET;

function codePoint(n) {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return null;
  try { return String.fromCodePoint(n); } catch { return null; }
}

function decodeEntitiesOnce(text) {
  return text.replace(ENTITY_RE, (whole, body) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const ch = codePoint(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10));
      return ch === null ? whole : ch;
    }
    const named = NAMED[body] ?? NAMED[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

// Remove every open...close section in one linear pass. keepInner keeps the
// section body (CDATA) instead of dropping it (comments, PIs). An opener
// with no closer ends the pass and the rest is kept as is.
function cutSections(text, open, close, keepInner) {
  let out = "";
  let i = 0;
  for (;;) {
    const start = text.indexOf(open, i);
    if (start < 0) return out + text.slice(i);
    const end = text.indexOf(close, start + open.length);
    if (end < 0) return out + text.slice(i);
    out += text.slice(i, start) + (keepInner ? text.slice(start + open.length, end) : "");
    i = end + close.length;
  }
}

const joinCdata = (text) => cutSections(text, "<![CDATA[", "]]>", true);
const stripMarkup = (text) => cutSections(joinCdata(cutSections(text, "<!--", "-->", false)), "<?", "?>", false)
  .replace(TAG_RE, "");

function fixpoint(text, step) {
  let current = text;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const next = step(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

// Every view the reader could end up seeing for one string field.
export function decodedViews(value) {
  if (typeof value !== "string" || value === "") return [];
  const decoded = fixpoint(value, (text) => decodeEntitiesOnce(joinCdata(text)));
  const joined = fixpoint(value, (text) => decodeEntitiesOnce(stripMarkup(text)));
  const views = [value, decoded, joined];
  return [...new Set(views)];
}

// Credentials that must never come back to the browser, from the Basic header.
// An empty list means the header could not be decoded; callers must refuse
// the request rather than skip the scan.
export function credentialSecrets(auth) {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(String(auth || ""));
  if (!match) return [];
  const token = match[1];
  let raw = "";
  if (typeof Buffer !== "undefined") { try { raw = Buffer.from(token, "base64").toString("utf8"); } catch { raw = ""; } }
  if (!raw && typeof atob === "function") {
    try { raw = new TextDecoder().decode(Uint8Array.from(atob(token), (c) => c.charCodeAt(0))); } catch { raw = ""; }
  }
  const colon = raw.indexOf(":");
  const password = colon > 0 ? raw.slice(colon + 1) : "";
  const secrets = [];
  for (const secret of [password, raw, token, "Basic " + token]) {
    if (long(secret) && !secrets.includes(secret)) secrets.push(secret);
  }
  return secrets;
}

function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === "object") for (const key of Object.keys(value)) { strings(key, out); strings(value[key], out); }
  return out;
}

// "unsafe-markup" when any string (in any decoded view) declares a DOCTYPE
// or ENTITY; "credential-reflection" when any decoded view contains a
// secret; otherwise null. Object keys are scanned too.
export function guardReason(value, secrets) {
  const list = (secrets || []).filter((secret) => typeof secret === "string" && long(secret));
  for (const text of strings(value)) {
    for (const view of decodedViews(text)) {
      if (DECLARATION_RE.test(view)) return "unsafe-markup";
      if (list.some((secret) => view.includes(secret))) return "credential-reflection";
    }
  }
  return null;
}

// True when guardReason() would refuse.
export function echoes(value, secrets) {
  return guardReason(value, secrets) !== null;
}

// The 422 body. Fixed text; any field whose key or value would contain a
// secret is dropped, so the body never carries one.
export function echoRefusal(secrets, reason = "credential-reflection") {
  const body = { result: -1, error: "proxy refusal", code: "proxy-refusal", reason: reason === "unsafe-markup" ? "unsafe-markup" : "credential-reflection" };
  for (const key of Object.keys(body)) {
    if (guardReason({ [key]: body[key] }, secrets) === "credential-reflection") delete body[key];
  }
  return guardReason(body, secrets) === "credential-reflection" ? {} : body;
}
