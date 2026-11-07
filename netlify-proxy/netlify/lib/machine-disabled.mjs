// Decision-gated machine route. STATUS: DISABLED.
//
// Caller-authentication gate: UNRESOLVED. The route defaults deny.
// The approved credential scope is per-request upstream Basic carried by the
// caller. That credential belongs to the upstream WITSML server. It is not
// authentication of the caller to this proxy, and this file does not read it.
// Origin is not caller authentication. The game origin, any other origin, a
// missing Origin, and "*" do not enable this route.
//
// A server-held shared caller-secret was proposed and was NOT approved.
// It is not read, compared, stored, minted, or accepted. No environment
// variable is consulted. There is no enable flag.
//
// This module does not import the review policy or any network stack.
// Deploying the function that calls handleMachineRequest publishes a route
// that fails closed and does not contact the upstream.

import { clientKey, createLimiter } from "./limiter.mjs";

export const MACHINE_ROUTE_ENABLED = false;
export const AUTH_GATE = "unresolved";
export const PER_MIN = 30;

export const DENY_BODY = Object.freeze({
  result: -1,
  error: "machine route disabled",
  authGate: AUTH_GATE,
  callerAuthentication: "not-approved",
  upstreamContact: false,
  tlsVerify: "required",
  storesCredentials: false,
});

const RATE_BODY = Object.freeze({
  result: -1,
  error: "rate limit",
  authGate: AUTH_GATE,
  upstreamContact: false,
});

const DENY_JSON = JSON.stringify(DENY_BODY);
const RATE_JSON = JSON.stringify(RATE_BODY);

function headers(extra) {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
    ...extra,
  };
}

export function denyResponse() {
  return new Response(DENY_JSON, { status: 403, headers: headers() });
}

export function rateResponse() {
  return new Response(RATE_JSON, { status: 429, headers: headers({ "Retry-After": "30" }) });
}

// Replacing the limiter cannot enable the route. It only affects the 429 path.
export const internals = {
  limiter: createLimiter({ perMin: PER_MIN }),
};

export function handleMachineRequest(req) {
  try {
    if (internals.limiter.limited(clientKey(req))) return rateResponse();
    return denyResponse();
  } catch {
    return denyResponse();
  }
}
