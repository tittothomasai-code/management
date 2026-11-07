// Proxy-held caller secret for /witsml-machine.
// The value lives only in the host environment (WITSML_MACHINE_CALLER_SECRET).
// This module does not generate, log, or echo it. A missing or weak value
// leaves the route unconfigured. Comparison hashes a fixed-width buffer and
// uses timingSafeEqual so the compare itself does not leak length or bytes.

import { createHash, timingSafeEqual } from "node:crypto";

export const CALLER_SECRET_ENV = "WITSML_MACHINE_CALLER_SECRET";
export const CALLER_HEADER = "x-witsml-machine-key";
export const MIN_SECRET_LENGTH = 32;
export const MAX_SECRET_LENGTH = 256;

const SECRET_RE = /^[A-Za-z0-9+/=_-]{32,256}$/;
const WEAK = new Set([
  "changemechangemechangemechangeme",
  "passwordpasswordpasswordpassword",
  "secretsecretsecretsecretsecretse",
]);

const WIDTH = MAX_SECRET_LENGTH;

function fixedDigest(value) {
  const src = Buffer.from(typeof value === "string" ? value : "", "utf8");
  const buf = Buffer.alloc(4 + WIDTH);
  const tooLong = src.length > WIDTH;
  buf.writeUInt32BE(tooLong ? 0xffffffff : src.length, 0);
  if (!tooLong && src.length > 0) src.copy(buf, 4, 0, src.length);
  return createHash("sha256").update(buf).digest();
}

export function callerKeysMatch(provided, expected) {
  return timingSafeEqual(fixedDigest(provided), fixedDigest(expected));
}

export function callerBucket(secret) {
  return fixedDigest(secret).toString("hex");
}

export function readCallerConfig(env = process.env) {
  if (!env || (typeof env !== "object" && typeof env !== "function")) return { configured: false };
  let raw;
  try { raw = env[CALLER_SECRET_ENV]; }
  catch { return { configured: false }; }
  if (typeof raw !== "string") return { configured: false };
  if (!SECRET_RE.test(raw) || WEAK.has(raw) || /^(.)\1+$/.test(raw)) return { configured: false };
  return { configured: true, secret: raw };
}

export function headerValues(req, name) {
  const lower = String(name || "").toLowerCase();
  try {
    if (Array.isArray(req?.rawHeaders)) {
      const values = [];
      const raw = req.rawHeaders;
      for (let i = 0; i + 1 < raw.length; i += 2) {
        if (String(raw[i]).toLowerCase() === lower) values.push(raw[i + 1]);
      }
      return values;
    }
    const headers = req?.headers;
    if (!headers) return [];
    if (typeof headers.entries === "function") {
      const found = [];
      for (const [key, value] of headers.entries()) {
        if (String(key).toLowerCase() === lower) found.push(value);
      }
      return found;
    }
    if (typeof headers.get === "function") {
      const one = headers.get(lower);
      return one == null ? [] : [one];
    }
    const nodeValue = headers[lower];
    if (Array.isArray(nodeValue)) return nodeValue.slice();
    if (typeof nodeValue === "string") return [nodeValue];
    return [];
  } catch {
    return [];
  }
}

function collapse(values) {
  if (!Array.isArray(values) || values.length !== 1) {
    return { ok: false, reason: values && values.length > 1 ? "duplicate" : "missing" };
  }
  const value = values[0];
  if (typeof value !== "string") return { ok: false, reason: "invalid" };
  if (value.length === 0 || value.length > MAX_SECRET_LENGTH) return { ok: false, reason: "size" };
  if (!SECRET_RE.test(value)) return { ok: false, reason: "invalid" };
  return { ok: true, value };
}

export function extractCallerKey(req) {
  return collapse(headerValues(req, CALLER_HEADER));
}

export function authenticateCaller(req, secret) {
  const extracted = extractCallerKey(req);
  const provided = extracted.ok ? extracted.value : "\u0000";
  const match = callerKeysMatch(provided, secret);
  return { ok: extracted.ok === true && match === true };
}
