import assert from "node:assert/strict";
import https from "node:https";
import { after, describe, test } from "node:test";
import { createLimiter } from "../netlify/lib/limiter.mjs";
import { DENY_BODY, PER_MIN, handleMachineRequest, internals } from "../netlify/lib/machine-disabled.mjs";
import handler, { DEPLOY_REVISION_EQUIVALENCE, MACHINE_PATH, config } from "../netlify/functions/witsml-machine.mjs";

const PASS = "test-secret-not-real";
const AUTH = "Basic " + Buffer.from("box-user:" + PASS).toString("base64");
const CALLER_SECRET = "not-a-real-secret";
const GAME = "https://tittothomasai-code.github.io";

let netCalls = 0;
https.request = () => { netCalls += 1; throw new Error("network forbidden"); };
https.get = () => { netCalls += 1; throw new Error("network forbidden"); };
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { netCalls += 1; throw new Error("network forbidden"); };
after(() => { globalThis.fetch = originalFetch; });

let seq = 0;
function make({ method = "POST", ip, headers = {}, body = "{}", noIp = false } = {}) {
  seq += 1;
  const h = { "content-type": "application/json", ...headers };
  if (!noIp) h["x-nf-client-connection-ip"] = ip || `203.0.113.${(seq % 200) + 1}`;
  const init = { method, headers: h };
  if (method !== "GET" && method !== "HEAD") init.body = body;
  return new Request("https://machine.invalid/witsml-machine", init);
}

function reset(perMin = PER_MIN) {
  internals.limiter = createLimiter({ perMin });
}

describe("disabled machine route", { concurrency: 1 }, () => {
  test("deploy equivalence stays labelled unverified and the path is separate", () => {
    assert.equal(DEPLOY_REVISION_EQUIVALENCE, "unverified");
    assert.equal(MACHINE_PATH, "/witsml-machine");
    assert.equal(config.path, "/witsml-machine");
    assert.equal(config.rateLimit.windowLimit, 30);
    assert.equal(config.rateLimit.windowSize, 60);
    assert.deepEqual(config.rateLimit.aggregateBy, ["ip", "domain"]);
    assert.equal(PER_MIN, 30);
  });

  test("every method and every caller shape gets the same deny, with no CORS and no echo", async () => {
    reset();
    const samples = [
      make({ method: "GET" }),
      make({ method: "POST", body: "{}" }),
      make({ method: "OPTIONS" }),
      make({ method: "PUT", body: "{}" }),
      make({ method: "DELETE" }),
      make({ method: "POST", body: JSON.stringify({ op: "WMLS_GetVersion", url: "https://URLSECRET:pw@evil.example/w" }), headers: { "x-witsml-authorization": AUTH, origin: GAME, "x-caller-secret": CALLER_SECRET, "x-review-gate": "draft-review-not-production", "x-forwarded-for": "8.8.8.8" } }),
      make({ method: "POST", headers: { origin: "*" } }),
      make({ method: "POST", headers: { origin: "https://evil.example" } }),
      make({ method: "POST", headers: { origin: "null" } }),
      make({ method: "POST", noIp: true }),
    ];
    for (const req of samples) {
      const res = await handleMachineRequest(req);
      const raw = await res.text();
      assert.equal(res.status, 403);
      assert.deepEqual(JSON.parse(raw), DENY_BODY);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(raw.includes(PASS), false);
      assert.equal(raw.includes(AUTH), false);
      assert.equal(raw.includes(CALLER_SECRET), false);
      assert.equal(raw.includes("URLSECRET"), false);
      assert.equal(raw.includes("origin not allowed"), false);
    }
  });

  test("missing, wrong, and extra caller material do not enable the route and need no config", async () => {
    reset();
    const previous = ["WITSML_MACHINE_ENABLED", "WITSML_CALLER_SECRET", "WITSML_PROXY_INSECURE_HOSTS"].map((key) => [key, process.env[key]]);
    process.env.WITSML_MACHINE_ENABLED = "1";
    process.env.WITSML_CALLER_SECRET = CALLER_SECRET;
    process.env.WITSML_PROXY_INSECURE_HOSTS = "australia.adagasolutions.com";
    try {
      const none = await handleMachineRequest(make({ body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "log", query: "<logs/>" }) }));
      const wrong = await handleMachineRequest(make({ body: JSON.stringify({ op: "WMLS_GetVersion" }), headers: { "x-witsml-authorization": "Basic !!!", "x-caller-secret": "wrong" } }));
      const present = await handleMachineRequest(make({ body: JSON.stringify({ op: "WMLS_GetVersion" }), headers: { "x-witsml-authorization": AUTH, "x-caller-secret": CALLER_SECRET } }));
      const raws = [await none.text(), await wrong.text(), await present.text()];
      assert.deepEqual(raws[0], raws[1]);
      assert.deepEqual(raws[1], raws[2]);
      for (const raw of raws) {
        assert.equal(JSON.parse(raw).error, "machine route disabled");
        assert.equal(JSON.parse(raw).callerAuthentication, "not-approved");
        assert.equal(raw.includes(CALLER_SECRET), false);
        assert.equal(raw.includes(AUTH), false);
      }
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  test("a review gate, a branded dispatcher, and an allow-all limiter still cannot enable the handler", async () => {
    let calls = 0;
    const dispatch = () => { calls += 1; return { status: 200, text: "" }; };
    dispatch.verifiedTransport = true;
    internals.limiter = { limited() { return false; } };
    const res = await handleMachineRequest(make({
      body: JSON.stringify({ op: "WMLS_GetVersion" }),
      headers: { "x-witsml-authorization": AUTH },
    }), { reviewGate: "draft-review-not-production", dispatch, enabled: true });
    const raw = await res.text();
    assert.equal(calls, 0);
    assert.equal(res.status, 403);
    assert.equal(JSON.parse(raw).upstreamContact, false);
    assert.equal(raw.includes(PASS), false);
  });

  test("the function entrypoint is the same deny", async () => {
    reset();
    const res = await handler(make({ method: "GET" }));
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), DENY_BODY);
  });

  test("a broken request fails closed", async () => {
    reset();
    const res = await handleMachineRequest({ headers: null, method: "POST" });
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), DENY_BODY);
    const missing = await handleMachineRequest(undefined);
    assert.equal(missing.status, 403);
  });

  test("rate limit trips without contacting upstream or echoing credentials", async () => {
    reset(PER_MIN);
    const ip = "198.51.100.10";
    for (let i = 0; i < PER_MIN; i++) {
      const res = await handleMachineRequest(make({ ip, headers: { "x-witsml-authorization": AUTH } }));
      assert.equal(res.status, 403);
      await res.text();
    }
    const blocked = await handleMachineRequest(make({ ip, headers: { "x-witsml-authorization": AUTH, "x-caller-secret": CALLER_SECRET } }));
    const raw = await blocked.text();
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after"), "30");
    assert.deepEqual(JSON.parse(raw), { result: -1, error: "rate limit", authGate: "unresolved", upstreamContact: false });
    assert.equal(raw.includes(AUTH), false);
    assert.equal(raw.includes(PASS), false);
    assert.equal(raw.includes(CALLER_SECRET), false);
  });

  test("x-forwarded-for does not mint extra rate-limit buckets", async () => {
    reset(1);
    const first = await handleMachineRequest(make({ noIp: true, headers: { "x-forwarded-for": "1.1.1.1" } }));
    const second = await handleMachineRequest(make({ noIp: true, headers: { "x-forwarded-for": "2.2.2.2" } }));
    const other = await handleMachineRequest(make({ ip: "198.51.100.20" }));
    assert.equal(first.status, 403);
    assert.equal(second.status, 429);
    assert.equal(other.status, 403);
    await first.text();
    await second.text();
    await other.text();
  });

  test("limiter window reset and stale-key cleanup stay bounded", () => {
    let now = 0;
    const limiter = createLimiter({ perMin: 1, now: () => now, windowMs: 1000, maxKeys: 2 });
    assert.equal(limiter.limited("a"), false);
    assert.equal(limiter.limited("a"), true);
    now = 1000;
    assert.equal(limiter.limited("a"), false);
    now = 5000;
    assert.equal(limiter.limited("b"), false);
    now = 9000;
    assert.equal(limiter.limited("c"), false);
    assert.equal(limiter.limited(""), false);
    assert.equal(limiter.limited("unknown"), true);
  });

  test("no real network from the disabled route", () => {
    assert.equal(netCalls, 0);
  });
});
