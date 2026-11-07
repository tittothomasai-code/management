// In-memory best-effort limiter. Not caller authentication.
// Process-local only: each serverless isolate has its own Map, a cold start
// resets it, and other isolates are not counted. The platform rate limit on
// the function is the cross-instance control.
// Keys are whatever the caller passes (an address, "global", or a hash of the
// caller secret). Values are only [windowStart, count]. The raw secret is not a key.
// The map has a hard cap. Fresh keys are not evicted. A new key is denied when
// the cap is full, which does not reset an existing key's count. The platform
// rate limit is a separate control and is not exercised here.

export function createLimiter({ perMin, now = Date.now, windowMs = 60000, maxKeys = 5000 } = {}) {
  if (!Number.isInteger(perMin) || perMin < 1 || !Number.isInteger(maxKeys) || maxKeys < 1) throw new Error("bad limit");
  const hits = new Map();
  const prune = (t) => {
    for (const [kk, v] of hits) if (t - v[0] >= windowMs) hits.delete(kk);
  };
  return {
    size() { return hits.size; },
    limited(key) {
      const k = key || "unknown";
      const t = now();
      let entry = hits.get(k);
      if (entry && t - entry[0] < windowMs) return ++entry[1] > perMin;
      prune(t);
      entry = hits.get(k);
      if (entry && t - entry[0] < windowMs) return ++entry[1] > perMin;
      if (hits.size >= maxKeys) return true;
      entry = [t, 0];
      hits.set(k, entry);
      return ++entry[1] > perMin;
    },
  };
}

// Only the platform client address. A caller-supplied forwarded-for list is not
// a separate bucket (that would let a client reset the limit).
export function clientKey(req) {
  try {
    const raw = req?.headers?.get?.("x-nf-client-connection-ip");
    if (typeof raw !== "string") return "unknown";
    if (!/^[0-9A-Fa-f:.]{1,64}$/.test(raw)) return "unknown";
    return raw;
  } catch {
    return "unknown";
  }
}
