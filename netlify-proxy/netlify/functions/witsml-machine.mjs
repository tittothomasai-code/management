import https from "node:https";
import { createMachineHandler } from "../lib/machine-handler.mjs";

// Default-deny read-only machine route.
// WITSML_MACHINE_CALLER_SECRET is read from the host environment by the handler.
// This file does not set that variable, generate a value, or deploy one.
// No valid secret => every request is denied and Adaga is not contacted.
//
// DEPLOY REVISION EQUIVALENCE: unverified.
// The game proxy files in this repo are unchanged, including the game route's
// existing per-host certificate skip. This route does not inherit that skip.
// Certificate verification here is mandatory. A TLS failure is fatal.
//
// The caller key is a proxy-held secret. It is not forwarded upstream.
// Per-request upstream Basic is still required after the caller key matches,
// and it is not stored. A random or invalid Basic value is not caller auth.
//
// COMPATIBILITY GATES, for review before any use with a real account:
// * Both the decoded upstream user and the decoded upstream password must be
//   at least 4 Unicode code points. Shorter Basic values are refused before
//   any upstream call. This draft does not know whether an existing Adaga
//   user or password meets that minimum, and it does not change those
//   credentials. A short account cannot use this route unless that
//   restriction is separately accepted.
// * Decoded upstream fields that contain a Unicode Format (Cf) character are
//   refused. The substring scan is only an exact-substring check. It is not
//   protection against arbitrary transformations.
//
// GATES BEFORE ROLLOUT (this change does not perform them):
// 1. Operator generates an independent high-entropy secret (at least 32 bytes
//    from a CSPRNG) and stores it only in the host secret store under
//    WITSML_MACHINE_CALLER_SECRET. Do not commit it, log it, or paste it into
//    chat. The synthetic test fixture must not be that value.
// 2. Titto reviews this diff before any rollout. Code preparation is not
//    runtime enablement, merge approval, or deploy approval.
// 3. Do not copy the game route's Adaga certificate skip onto this route.
// 4. Confirm the running Netlify revision separately. It is still unverified.
//    A direct Basic 401 from Adaga has an unknown cause.
//
// Rollback: remove this function and redeploy the previous site revision.
// That does not change the game route. This handler reads the host environment
// on each request, but a warm isolate can keep the environment it booted with.
// Clearing the secret is not an instant deny until the platform has propagated
// the new environment and the runtime is shown to be using it, which can require
// a redeploy or isolate recycle. Verify that before treating the route as denied.
// In-process rate limits are per isolate and reset on cold start. The platform
// rateLimit below is the cross-instance control and is not exercised by unit tests.

export const DEPLOY_REVISION_EQUIVALENCE = "unverified";
export const MACHINE_PATH = "/witsml-machine";

const handle = createMachineHandler({ httpsImpl: https });

export default function handler(req) {
  return handle(req);
}

export const config = {
  path: MACHINE_PATH,
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
