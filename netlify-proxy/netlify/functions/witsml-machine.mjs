import { handleMachineRequest } from "../lib/machine-disabled.mjs";

// DISABLED draft. This file is the only machine entrypoint, and it imports
// only the deny handler. It does not import the review policy.
//
// DEPLOY REVISION EQUIVALENCE: unverified.
// The game proxy files already in this repo are the canonical source. Three
// files attached from a local orphan checkout at /workspace/mg/netlify-proxy
// (manual/CLI deploy of tryfecta-witsml-proxy, no git remote) were byte-identical
// to that canonical copy when this draft was prepared. That match does not show
// that the running Netlify site is this revision. Those game files are unchanged.
// The game route still has its existing per-host certificate skip. This route
// does not inherit that skip.
//
// GATES STILL REQUIRED BEFORE ANY ENABLEMENT (this draft does not grant them):
// 1. Caller authentication. Per-request upstream Basic is approved only as the
//    upstream credential, not as permission to invoke this route. A shared
//    caller-secret is not implemented and was not approved. Do not add one in
//    the host environment as a silent switch; this function does not read one.
// 2. TLS. Certificate verification stays mandatory here. Do not copy the game
//    route's Adaga certificate skip onto this route to force a connection.
//    If the upstream certificate does not verify, this route must fail.
// 3. Production approval. This draft is not permission to merge or deploy.
//    Tests use a fake transport. They do not establish an Adaga connection.
//    A direct Basic 401 from Adaga has an unknown cause and is not evidence of
//    an egress rule or of this proxy working.
// 4. Show this diff before any deploy. No production permission is implied.
//
// Rollback later: remove this function file and redeploy the previous site
// revision. The game function is not modified, so that rollback does not change
// the game route. Leaving this file in place is still deny-only.

export const DEPLOY_REVISION_EQUIVALENCE = "unverified";
export const MACHINE_PATH = "/witsml-machine";

export default function handler(req) {
  return handleMachineRequest(req);
}

export const config = {
  path: MACHINE_PATH,
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
