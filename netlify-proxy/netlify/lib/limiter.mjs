// In-memory best-effort limiter. Not caller authentication.
// Keys are whatever the caller passes (the machine route passes a client address
// or the single bucket "unknown"). Values are only [windowStart, count].

export function createLimiter({ perMin, now = Date.now, windowMs = 60000, maxKeys = 5000 } = {}) {
  if (!Number.isInteger(perMin) || perMin < 0) throw new Error("bad limit");
  const hits = new Map();
  return {
    limited(key) {
      const k = key || "unknown";
      const t = now();
      let entry = hits.get(k);
      if (!entry || t - entry[0] >= windowMs) {
        entry = [t, 0];
        hits.set(k, entry);
      }
      if (hits.size > maxKeys) {
        for (const [kk, v] of hits) if (t - v[0] >= windowMs) hits.delete(kk);
      }
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
