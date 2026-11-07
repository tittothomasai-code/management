// Live /witsml-machine handler.
// Default deny: with no valid WITSML_MACHINE_CALLER_SECRET, every request is
// refused and nothing is sent upstream. A valid host secret plus a matching
// caller header is required before per-request upstream Basic is considered.
// The caller header is never a substitute for upstream Basic, and it is never
// forwarded. Upstream Basic is never accepted as the caller secret.
//
// Rate limits below are process-local. A serverless isolate does not share
// them with other isolates, and a cold start resets them. The function's
// platform rate limit is the cross-instance control.

import { createLimiter, clientKey } from "./limiter.mjs";
import { authenticateCaller, callerBucket, callerKeysMatch, readCallerConfig } from "./machine-auth.mjs";
import { authFailedResponse, deniedResponse, disabledResponse, rateResponse } from "./machine-disabled.mjs";
import { createVerifiedDispatch, enforceMachinePolicy } from "./machine-policy.mjs";

export const RATE_LIMITS = Object.freeze({
  globalPerMin: 120,
  ipPerMin: 30,
  authFailPerMin: 8,
  callerPerMin: 30,
  windowMs: 60000,
  processLocal: true,
});

export function createMachineHandler(options = {}) {
  const httpsImpl = options.httpsImpl;
  if (!httpsImpl) throw new Error("https implementation required");
  const dispatch = createVerifiedDispatch(httpsImpl, options.timers || {});
  const env = options.env || process.env;
  const now = options.now || Date.now;
  const globalLimiter = options.globalLimiter || createLimiter({ perMin: RATE_LIMITS.globalPerMin, now });
  const ipLimiter = options.ipLimiter || createLimiter({ perMin: RATE_LIMITS.ipPerMin, now });
  const failLimiter = options.failLimiter || createLimiter({ perMin: RATE_LIMITS.authFailPerMin, now });
  const callerLimiter = options.callerLimiter || createLimiter({ perMin: RATE_LIMITS.callerPerMin, now });

  return async function handleMachineRequest(req) {
    try {
      if (globalLimiter.limited("global")) return rateResponse();
      const ip = clientKey(req);
      if (ipLimiter.limited(ip)) return rateResponse();
      const config = readCallerConfig(env);
      if (!config.configured) {
        callerKeysMatch("unconfigured", "placeholder-not-a-secret");
        return disabledResponse();
      }
      const decision = authenticateCaller(req, config.secret);
      if (!decision.ok) {
        if (failLimiter.limited(ip)) return rateResponse();
        return authFailedResponse();
      }
      if (callerLimiter.limited(callerBucket(config.secret))) return rateResponse();
      return await enforceMachinePolicy(req, { dispatch, callerSecret: config.secret, now });
    } catch {
      return deniedResponse();
    }
  };
}
