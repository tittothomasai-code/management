import assert from "node:assert/strict";
import https from "node:https";
import { after, describe, test } from "node:test";
import { createLimiter } from "../netlify/lib/limiter.mjs";
import { callerBucket, callerKeysMatch, readCallerConfig } from "../netlify/lib/machine-auth.mjs";
import { AUTH_FAILED_BODY, UNCONFIGURED_BODY } from "../netlify/lib/machine-disabled.mjs";
import { RATE_LIMITS, createMachineHandler } from "../netlify/lib/machine-handler.mjs";
import handler, { DEPLOY_REVISION_EQUIVALENCE } from "../netlify/functions/witsml-machine.mjs";

const PASS = "test-secret-not-real";
const AUTH = "Basic " + Buffer.from("box-user:" + PASS).toString("base64");
const KEY = "synthetic-not-real-caller-key-0123456789abcd";
const WRONG = "synthetic-not-real-caller-key-ffffffffffffffff";

let netCalls = 0;
const originalRequest = https.request;
const originalGet = https.get;
const originalFetch = globalThis.fetch;
https.request = () => { netCalls += 1; throw new Error("network forbidden"); };
https.get = () => { netCalls += 1; throw new Error("network forbidden"); };
globalThis.fetch = () => { netCalls += 1; throw new Error("network forbidden"); };
after(() => {
  https.request = originalRequest;
  https.get = originalGet;
  globalThis.fetch = originalFetch;
});

function fakeHttps(text = "") {
  const calls = [];
  return {
    calls,
    Agent: class {
      constructor(opts) { this.opts = { ...opts }; calls.push({ type: "agent", opts: this.opts }); }
      destroy() { calls.push({ type: "destroy" }); }
    },
    request(options, cb) {
      const rec = { type: "request", options, body: "" };
      calls.push(rec);
      const req = {
        on() { return req; },
        write(chunk) { rec.body += chunk; return true; },
        end() {
          const res = {
            statusCode: 200,
            headers: {},
            on(ev, fn) { (res.listeners ||= {})[ev] = fn; return res; },
          };
          cb(res);
          if (text) res.listeners.data?.(Buffer.from(text));
          res.listeners.end?.();
        },
        destroy() { rec.destroyed = true; },
      };
      return req;
    },
  };
}

const VERSION_XML = '<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body><q1:WMLS_GetVersionResponse><Result>1.4.1.1</Result></q1:WMLS_GetVersionResponse></soap:Body></soap:Envelope>';

let seq = 0;
function make({ method = "POST", ip, headers = {}, body = JSON.stringify({ op: "WMLS_GetVersion" }), key = KEY, noIp = false } = {}) {
  seq += 1;
  const h = { "content-type": "application/json", "x-witsml-authorization": AUTH, ...headers };
  if (key) h["x-witsml-machine-key"] = key;
  if (!noIp) h["x-nf-client-connection-ip"] = ip || `203.0.113.${(seq % 200) + 1}`;
  const init = { method, headers: h };
  if (method !== "GET" && method !== "HEAD") init.body = body;
  return new Request("https://machine.invalid/witsml-machine", init);
}

function open(impl, extra = {}) {
  return createMachineHandler({
    httpsImpl: impl,
    env: extra.env || { WITSML_MACHINE_CALLER_SECRET: KEY },
    globalLimiter: extra.globalLimiter || createLimiter({ perMin: 100 }),
    ipLimiter: extra.ipLimiter || createLimiter({ perMin: 100 }),
    failLimiter: extra.failLimiter || createLimiter({ perMin: 100 }),
    callerLimiter: extra.callerLimiter || createLimiter({ perMin: 100 }),
    timers: extra.timers,
  });
}

async function read(res) {
  const raw = await res.text();
  return { status: res.status, raw, body: JSON.parse(raw), headers: res.headers };
}

function assertClean(raw) {
  for (const secret of [PASS, AUTH, KEY, WRONG]) assert.equal(raw.includes(secret), false);
}

describe("configured machine handler", { concurrency: 1 }, () => {
  test("constant-time compare and config bar use the synthetic fixture only", () => {
    assert.equal(callerKeysMatch(KEY, KEY), true);
    assert.equal(callerKeysMatch(WRONG, KEY), false);
    assert.equal(callerKeysMatch("", KEY), false);
    assert.equal(callerKeysMatch(KEY.slice(0, -1) + "q", KEY), false);
    assert.equal(callerKeysMatch("a".repeat(500), "b".repeat(500)), false);
    assert.equal(callerKeysMatch("a".repeat(500), "a".repeat(500)), true);
    assert.equal(callerKeysMatch("a".repeat(5000), KEY), false);
    assert.equal(readCallerConfig({}).configured, false);
    assert.equal(readCallerConfig({ WITSML_MACHINE_CALLER_SECRET: "" }).configured, false);
    assert.equal(readCallerConfig({ WITSML_MACHINE_CALLER_SECRET: "short-secret" }).configured, false);
    assert.equal(readCallerConfig({ WITSML_MACHINE_CALLER_SECRET: "changemechangemechangemechangeme" }).configured, false);
    assert.equal(readCallerConfig({ WITSML_MACHINE_CALLER_SECRET: "a".repeat(32) }).configured, false);
    assert.equal(readCallerConfig({ WITSML_MACHINE_CALLER_SECRET: " " + KEY }).configured, false);
    assert.equal(readCallerConfig({ WITSML_MACHINE_CALLER_SECRET: KEY + "\n" }).configured, false);
    assert.equal(readCallerConfig({ WITSML_MACHINE_CALLER_SECRET: KEY, NODE_TLS_REJECT_UNAUTHORIZED: "0" }).configured, true);
    assert.equal(callerBucket(KEY).includes(KEY), false);
    assert.equal(DEPLOY_REVISION_EQUIVALENCE, "unverified");
    assert.equal(RATE_LIMITS.processLocal, true);
    const bounded = createLimiter({ perMin: 1, maxKeys: 2, now: () => 1000 });
    assert.equal(bounded.limited("a"), false);
    assert.equal(bounded.limited("a"), true);
    assert.equal(bounded.limited("b"), false);
    for (let i = 0; i < 50; i++) assert.equal(bounded.limited("z" + i), true);
    assert.equal(bounded.size(), 2);
    assert.equal(bounded.limited("a"), true);
  });

  test("no config denies every caller, including a valid-looking key and basic", async () => {
    const impl = fakeHttps(VERSION_XML);
    const cases = [{}, { WITSML_MACHINE_ENABLED: "1" }, { WITSML_CALLER_SECRET: KEY }, { WITSML_PROXY_INSECURE_HOSTS: "australia.adagasolutions.com" }, { WITSML_MACHINE_CALLER_SECRET: "short" }];
    for (const env of cases) {
      const handle = open(impl, { env });
      const out = await read(await handle(make({ headers: { origin: "https://tittothomasai-code.github.io" } })));
      assert.equal(out.status, 403);
      assert.deepEqual(out.body, UNCONFIGURED_BODY);
      assert.equal(out.headers.get("access-control-allow-origin"), null);
      assertClean(out.raw);
    }
    assert.equal(impl.calls.some((c) => c.type === "request"), false);
  });

  test("missing, wrong, duplicate, and oversized keys fail closed and basic does not pass caller auth", async () => {
    const impl = fakeHttps(VERSION_XML);
    const handle = open(impl);
    const missing = await read(await handle(make({ key: false })));
    const wrong = await read(await handle(make({ key: WRONG })));
    const basicOnly = await read(await handle(make({ key: false, headers: { "x-witsml-authorization": AUTH } })));
    const duplicate = {
      method: "POST",
      rawHeaders: ["X-Witsml-Machine-Key", KEY, "x-witsml-machine-key", KEY, "content-type", "application/json", "x-witsml-authorization", AUTH],
      headers: { get: (name) => name === "content-type" ? "application/json" : null },
    };
    const dup = await read(await handle(duplicate));
    const oversized = "OVERSIZE" + "a".repeat(300);
    const huge = await read(await handle(make({ key: false, headers: { "x-witsml-machine-key": oversized } })));
    for (const out of [missing, wrong, basicOnly, dup, huge]) {
      assert.equal(out.status, 403);
      assert.deepEqual(out.body, AUTH_FAILED_BODY);
      assertClean(out.raw);
      assert.equal(out.raw.includes("OVERSIZE"), false);
      assert.equal(out.raw.includes(WRONG), false);
    }
    assert.equal(impl.calls.some((c) => c.type === "request"), false);
  });

  test("a matching caller key still needs upstream basic and does not forward the key", async () => {
    const impl = fakeHttps(VERSION_XML);
    const seen = [];
    const handle = open(impl, { callerLimiter: { limited(key) { seen.push(key); return false; } } });
    const noBasic = await read(await handle(make({ headers: { "x-witsml-authorization": "" } })));
    assert.equal(noBasic.status, 400);
    assert.equal(noBasic.body.error, "credentials required");
    const badBasic = await read(await handle(make({ headers: { "x-witsml-authorization": "Basic !!!" } })));
    assert.equal(badBasic.status, 400);
    const ok = await read(await handle(make()));
    assert.equal(ok.status, 200, ok.raw);
    assert.equal(ok.body.version, "1.4.1.1");
    const sent = impl.calls.find((c) => c.type === "request");
    assert.equal(sent.options.rejectUnauthorized, true);
    assert.equal(sent.options.hostname, "australia.adagasolutions.com");
    assert.equal(sent.options.headers.Authorization, AUTH);
    const flat = JSON.stringify(sent.options.headers) + sent.body;
    assert.equal(flat.includes(KEY), false);
    assert.equal(seen.includes(KEY), false);
    assert.equal(seen.at(-1), callerBucket(KEY));
    assertClean(ok.raw);
    assertClean(noBasic.raw);
    assertClean(badBasic.raw);
  });

  test("global, caller, and failed-auth limits are process-local and do not echo secrets", async () => {
    const impl = fakeHttps(VERSION_XML);
    const globalHandle = open(impl, { globalLimiter: createLimiter({ perMin: 1 }) });
    assert.equal((await globalHandle(make({ ip: "198.51.100.1" }))).status, 200);
    const blocked = await read(await globalHandle(make({ ip: "198.51.100.2" })));
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.limiter, undefined);
    assert.equal(blocked.body.error, "rate limit");
    assert.equal(blocked.body.upstreamContact, false);
    assertClean(blocked.raw);
    const failHandle = open(fakeHttps(), { failLimiter: createLimiter({ perMin: 1 }) });
    const ip = "198.51.100.9";
    assert.equal((await failHandle(make({ ip, key: WRONG }))).status, 403);
    assert.equal((await failHandle(make({ ip, key: WRONG }))).status, 429);
    const callerHandle = open(fakeHttps(VERSION_XML), { callerLimiter: createLimiter({ perMin: 1 }) });
    assert.equal((await callerHandle(make({ ip: "198.51.100.10" }))).status, 200);
    assert.equal((await callerHandle(make({ ip: "198.51.100.11" }))).status, 429);
    assert.equal(impl.calls.filter((c) => c.type === "request").length, 1);
  });

  test("duplicate lengths, transfer-encoding, and an aborted caller do not reach upstream", async () => {
    const impl = fakeHttps(VERSION_XML);
    const handle = open(impl);
    const smuggle = {
      method: "POST",
      rawHeaders: ["content-length", "5", "content-length", "80", "content-type", "application/json", "x-witsml-machine-key", KEY, "x-witsml-authorization", AUTH, "transfer-encoding", "chunked"],
    };
    const rejected = await read(await handle(smuggle));
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error, "request rejected");
    assertClean(rejected.raw);
    const payload = JSON.stringify({ op: "WMLS_GetVersion" });
    let readPast = false;
    const mismatch = {
      method: "POST",
      headers: { get(name) {
        const map = { "content-type": "application/json", "content-length": "2", "x-witsml-machine-key": KEY, "x-witsml-authorization": AUTH };
        return map[name] || null;
      } },
      body: {
        getReader() {
          const first = Buffer.from(payload.slice(0, 2));
          const rest = Buffer.from(payload.slice(2));
          let n = 0;
          return {
            async read() {
              n += 1;
              if (n === 1) return { done: false, value: first };
              if (n === 2) { readPast = true; return { done: false, value: rest }; }
              return { done: true, value: undefined };
            },
            async cancel() { this.cancelled = true; },
            releaseLock() {},
          };
        },
      },
    };
    const lied = await read(await handle(mismatch));
    assert.equal(lied.status, 400);
    assert.equal(lied.body.error, "request rejected");
    assert.equal(readPast, true);
    assert.equal(lied.raw.includes("WMLS_GetVersion"), false);
    const ac = new AbortController();
    ac.abort();
    const aborted = new Request("https://machine.invalid/witsml-machine", {
      method: "POST",
      headers: { "content-type": "application/json", "x-witsml-machine-key": KEY, "x-witsml-authorization": AUTH },
      body: JSON.stringify({ op: "WMLS_GetVersion" }),
      signal: ac.signal,
    });
    const stopped = await read(await handle(aborted));
    assert.equal(stopped.status, 502);
    assert.equal(stopped.body.error, "upstream connection failed");
    assert.equal(impl.calls.some((c) => c.type === "request"), false);
    assertClean(stopped.raw);
  });

  test("the default entrypoint stays denied until the host secret exists, then uses node https", async () => {
    const previous = process.env.WITSML_MACHINE_CALLER_SECRET;
    delete process.env.WITSML_MACHINE_CALLER_SECRET;
    try {
      const denied = await read(await handler(make()));
      assert.equal(denied.status, 403);
      assert.equal(denied.body.error, "machine route denied");
      assert.equal(netCalls, 0);
      process.env.WITSML_MACHINE_CALLER_SECRET = KEY;
      const attempted = await handler(make({ ip: "198.51.100.77" }));
      const out = await read(attempted);
      assert.equal(out.status, 502);
      assert.equal(out.body.error, "upstream connection failed");
      assert.equal(netCalls, 1);
      assertClean(out.raw);
    } finally {
      if (previous === undefined) delete process.env.WITSML_MACHINE_CALLER_SECRET;
      else process.env.WITSML_MACHINE_CALLER_SECRET = previous;
    }
  });
});
