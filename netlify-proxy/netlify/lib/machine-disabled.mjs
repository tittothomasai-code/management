// Static responses for /witsml-machine. No secret is read or written here.
// Unconfigured and failed-auth requests share one 403 body. Whether a host
// secret is loaded is an operator fact (readCallerConfig), not a public field.
// The in-process limiter is also not described in the response. Its process-local
// limit is documented next to the handler.

export const DENIED_BODY = Object.freeze({
  result: -1,
  error: "machine route denied",
  upstreamContact: false,
  tlsVerify: "required",
  storesUpstreamCredentials: false,
});

export const UNCONFIGURED_BODY = DENIED_BODY;
export const AUTH_FAILED_BODY = DENIED_BODY;

const RATE_BODY = Object.freeze({
  result: -1,
  error: "rate limit",
  upstreamContact: false,
});

function headers(extra) {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    ...extra,
  };
}

function json(body, status, extra) {
  return new Response(JSON.stringify(body), { status, headers: headers(extra) });
}

export function disabledResponse() {
  return json(UNCONFIGURED_BODY, 403);
}

export function authFailedResponse() {
  return json(AUTH_FAILED_BODY, 403);
}

export function deniedResponse() {
  return json(DENIED_BODY, 403);
}

export function rateResponse() {
  return json(RATE_BODY, 429, { "Retry-After": "30" });
}
