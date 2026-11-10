// Credential echo guard for the WITSML game proxies.
//
// A store reply can carry the caller's password in a form that is not the
// literal text: XML-escaped inside the inner document (&lt; &amp; ...),
// numeric character references (&#70; &#x46;), split across CDATA sections,
// split by comments or child tags, or escaped more than once. The browser
// reader decodes all of these (DOMParser, unesc), so a literal-only scan is
// fail-open. This module builds fully decoded views of a reply field and
// reports whether any of them contains a credential.
//
// Callers refuse with HTTP 422 and no document when echoes() is true.
// Nothing here logs. Secrets never leave this module except as booleans.
//
// The same bytes ship in three places (drilling game proxy, Netlify game
// proxy lib, Supabase fallback); tests pin the sha256.

const MIN_SECRET = 4;
const MAX_ROUNDS = 8;
const NAMED = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: "\u00a0" };
const ENTITY_RE = /&(#[xX][0-9a-fA-F]{1,8}|#[0-9]{1,10}|[A-Za-z][A-Za-z0-9]{1,8});/g;

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

const joinCdata = (text) => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
const stripMarkup = (text) => text
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<\?[\s\S]*?\?>/g, "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<\/?[A-Za-z_][^<>]*>/g, "");

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

// True when any string anywhere in value (object keys included) contains a
// secret in any decoded view.
export function echoes(value, secrets) {
  const list = (secrets || []).filter((secret) => typeof secret === "string" && long(secret));
  if (!list.length) return false;
  for (const text of strings(value)) {
    for (const view of decodedViews(text)) {
      if (list.some((secret) => view.includes(secret))) return true;
    }
  }
  return false;
}

// The 422 body. Fixed text; any field whose key or value would contain a
// secret is dropped, so the body never carries one.
export function echoRefusal(secrets) {
  const body = { result: -1, error: "proxy refusal", code: "proxy-refusal", reason: "credential-reflection" };
  for (const key of Object.keys(body)) {
    if (echoes({ [key]: body[key] }, secrets)) delete body[key];
  }
  return echoes(body, secrets) ? {} : body;
}
