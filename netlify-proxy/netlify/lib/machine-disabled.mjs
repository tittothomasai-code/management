// Static responses for /witsml-machine. No secret is read or written here.
// Unconfigured and failed-auth bodies are distinct so an operator can see
// whether the host secret is loaded. Neither body contains a credential.

export const UNCONFIGURED_BODY = Object.freeze({
  result: -1,
  error: "machine route disabled",
  authGate: "unconfigured",
  callerAuthentication: "host-env-secret",
  upstreamContact: false,
  tlsVerify: "required",
  storesUpstreamCredentials: false,
});

export const AUTH_FAILED_BODY = Object.freeze({
  result: -1,
  error: "caller authentication failed",
  authGate: "configured",
  upstreamContact: false,
  tlsVerify: "required",
  storesUpstreamCredentials: false,
});

export const DENIED_BODY = Object.freeze({
  result: -1,
  error: "machine route denied",
  upstreamContact: false,
  tlsVerify: "required",
});

const RATE_BODY = Object.freeze({
  result: -1,
  error: "rate limit",
  upstreamContact: false,
  limiter: "process-local",
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
