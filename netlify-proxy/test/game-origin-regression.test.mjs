import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import https from "node:https";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { ORIGIN, ORIGINS, makeProxy } from "../netlify/lib/core.mjs";
import handler, { DEPLOY_REVISION_EQUIVALENCE } from "../netlify/functions/witsml-machine.mjs";

// DEPLOY REVISION EQUIVALENCE: unverified.
// These hashes lock the canonical in-repo game proxy. The three attached files
// from the local orphan checkout /workspace/mg/netlify-proxy (manual/CLI deploy
// of tryfecta-witsml-proxy, no git remote) matched these hashes when this draft
// was prepared. That match is not evidence the running Netlify site is this
// revision, and a green test is not an Adaga connection.

const CANONICAL = {
  // core.mjs changed on purpose: credential echo guard (PR #22 review B1). The running
  // tryfecta-witsml-proxy deploy is still 74c687f0...eb7825 until this is released.
  "../netlify/lib/core.mjs": "0d036a9d836988a4d90e6b24928556751c41332bc5c188d3251f79f26b04e0e5",
  "../netlify/functions/witsml-proxy.mjs": "d8c4e95580c2544567fe658d6ae41d1b5cce4b02c47da6a7c0d93eb205736b34",
  "../netlify.toml": "ecf28bdecdd81726a880eab4ddf070d74f2d1f011a7c6d2d0c1c247d2484bb39",
};
const DRILLING_ORIGIN = "https://drilling.robotyx.systems";
const BASE = "68115abee8a388d2669f4d96ab4ef2ba44d15fcc";
const PASS = "test-secret-not-real";
const AUTH = "Basic " + Buffer.from("box-user:" + PASS).toString("base64");

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

const proxy = makeProxy({
  upstream: "https://australia.adagasolutions.com/WMLS",
  skipHost: "australia.adagasolutions.com",
  perMin: 60,
});

function sha(rel) {
  return createHash("sha256").update(readFileSync(new URL(rel, import.meta.url))).digest("hex");
}

function gameReq({ method = "POST", origin, headers = {}, body = "{}" } = {}) {
  const h = { "content-type": "application/json", ...headers };
  if (origin !== undefined) h.origin = origin;
  const init = { method, headers: h };
  if (method !== "GET" && method !== "HEAD") init.body = body;
  return new Request("https://game.invalid/witsml-proxy", init);
}

describe("game origin regression", { concurrency: 1 }, () => {
  test("canonical proxy bytes match the pinned revision", () => {
    for (const [rel, hash] of Object.entries(CANONICAL)) assert.equal(sha(rel), hash, rel);
    const core = readFileSync(new URL("../netlify/lib/core.mjs", import.meta.url), "utf8");
    assert.match(core, /rejectUnauthorized:\s*false/);
    assert.match(core, /origin not allowed/);
  });

  test("this change stays inside the proxies (game route only gains the echo guard)", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const run = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const lines = (value) => value ? value.split("\n").filter(Boolean) : [];
    const names = new Set([
      ...lines(run(["diff", "--name-only", BASE])),
      ...lines(run(["ls-files", "--others", "--exclude-standard"])),
    ]);
    assert.deepEqual([...names].sort(), [
      "netlify-proxy/netlify/functions/witsml-machine.mjs",
      "netlify-proxy/netlify/lib/core.mjs",
      "netlify-proxy/netlify/lib/limiter.mjs",
      "netlify-proxy/netlify/lib/machine-auth.mjs",
      "netlify-proxy/netlify/lib/machine-disabled.mjs",
      "netlify-proxy/netlify/lib/machine-handler.mjs",
      "netlify-proxy/netlify/lib/machine-policy.mjs",
      "netlify-proxy/netlify/lib/machine-reader-adapter.mjs",
      "netlify-proxy/netlify/lib/redaction-slots.mjs",
      "netlify-proxy/test/fixtures/rtoc_hist.js",
      "netlify-proxy/test/fixtures/wdash_core.js",
      "netlify-proxy/test/game-origin-regression.test.mjs",
      "netlify-proxy/test/machine-handler.test.mjs",
      "netlify-proxy/test/machine-match-surface.test.mjs",
      "netlify-proxy/test/machine-password-redact.test.mjs",
      "netlify-proxy/test/machine-policy.test.mjs",
      "netlify-proxy/test/machine-reader-adapter.test.mjs",
      "netlify-proxy/test/machine-redaction-slots.test.mjs",
      "netlify-proxy/netlify/lib/witsml-echo-guard.mjs",
      "netlify-proxy/test/game-proxy-echo-gaps.test.mjs",
      "netlify-proxy/test/game-proxy-echo.test.mjs",
      "supabase/functions/witsml-proxy/echo_guard_test.ts",
      "supabase/functions/witsml-proxy/index.ts",
      "supabase/functions/witsml-proxy/witsml-echo-guard.mjs",
    ].sort());
  });

  test("the machine function wires verified TLS and does not import the game proxy", () => {
    const start = new URL("../netlify/functions/witsml-machine.mjs", import.meta.url);
    const seen = new Set();
    const walk = (url) => {
      if (seen.has(url.href)) return;
      seen.add(url.href);
      const src = readFileSync(url, "utf8");
      for (const match of src.matchAll(/from\s+"(\.[^"]+)"/g)) walk(new URL(match[1], url));
      for (const match of src.matchAll(/import\(\s*"(\.[^"]+)"\s*\)/g)) walk(new URL(match[1], url));
    };
    walk(start);
    const hrefs = [...seen];
    const entry = readFileSync(start, "utf8");
    assert.match(entry, /from\s+"node:https"/);
    const configBlock = entry.match(/export const config = \{[\s\S]*?\n\};/);
    assert.ok(configBlock);
    assert.match(configBlock[0], /path:\s*"\/witsml-machine"/);
    assert.doesNotMatch(configBlock[0], /MACHINE_PATH/);
    assert.match(entry, /export const MACHINE_PATH = "\/witsml-machine"/);
    assert.equal(hrefs.some((href) => href.includes("witsml-proxy.mjs")), false);
    assert.equal(hrefs.some((href) => href.includes("core.mjs")), false);
    assert.ok(hrefs.some((href) => href.endsWith("machine-handler.mjs")));
    assert.ok(hrefs.some((href) => href.endsWith("machine-policy.mjs")));
    assert.ok(hrefs.some((href) => href.endsWith("machine-auth.mjs")));
    assert.equal(hrefs.some((href) => href.endsWith("machine-reader-adapter.mjs")), false);
    const names = readdirSync(new URL("../netlify/functions/", import.meta.url)).sort();
    assert.deepEqual(names, ["witsml-machine.mjs", "witsml-proxy.mjs"]);
    for (const rel of [
      "../netlify/functions/witsml-machine.mjs",
      "../netlify/lib/machine-auth.mjs",
      "../netlify/lib/machine-disabled.mjs",
      "../netlify/lib/machine-handler.mjs",
      "../netlify/lib/machine-policy.mjs",
      "../netlify/lib/machine-reader-adapter.mjs",
      "../netlify/lib/redaction-slots.mjs",
      "../netlify/lib/limiter.mjs",
    ]) {
      const src = readFileSync(new URL(rel, import.meta.url), "utf8");
      assert.doesNotMatch(src, /rejectUnauthorized:\s*false/);
      assert.doesNotMatch(src, /skipHost/);
      assert.doesNotMatch(src, /NODE_TLS_REJECT_UNAUTHORIZED/);
      assert.doesNotMatch(src, /\bconsole\./);
      if (!rel.endsWith("machine-policy.mjs")) assert.doesNotMatch(src, /from\(\s*[^)]*base64/);
      assert.doesNotMatch(src, /\batob\s*\(/);
      assert.doesNotMatch(src, /node:http\b|node:net|node:dns|child_process/);
      assert.doesNotMatch(src, /\bfetch\s*\(/);
      if (!rel.endsWith("machine-auth.mjs") && !rel.endsWith("machine-handler.mjs")) {
        assert.doesNotMatch(src, /process\.env/);
      }
    }
    const auth = readFileSync(new URL("../netlify/lib/machine-auth.mjs", import.meta.url), "utf8");
    assert.match(auth, /timingSafeEqual/);
    assert.match(auth, /WITSML_MACHINE_CALLER_SECRET/);
    assert.doesNotMatch(auth, /process\.env\.[A-Za-z]/);
    assert.equal(DEPLOY_REVISION_EQUIVALENCE, "unverified");
  });

  test("missing, wrong, empty, and wildcard origins stay forbidden", async () => {
    const cases = [
      {},
      { origin: "https://evil.example" },
      { origin: "*" },
      { origin: "null" },
      { origin: ORIGIN + ".evil.example" },
      { origin: ORIGIN + "/" },
      { origin: "https://Tittothomasai-code.github.io" },
      { origin: "" },
      { origin: DRILLING_ORIGIN + ".evil.example" },
      { origin: DRILLING_ORIGIN + "/" },
      { origin: "http://drilling.robotyx.systems" },
      { origin: "https://Drilling.robotyx.systems" },
    ];
    for (const item of cases) {
      const res = await proxy(gameReq({
        origin: item.origin,
        headers: { "x-witsml-authorization": AUTH },
        body: JSON.stringify({ op: "WMLS_GetVersion", url: "https://australia.adagasolutions.com/WMLS" }),
      }));
      const raw = await res.text();
      assert.equal(res.status, 403, JSON.stringify(item) + " " + raw);
      assert.deepEqual(JSON.parse(raw), { result: -1, error: "origin not allowed" });
      assert.equal(res.headers.get("access-control-allow-origin"), null);
      assert.equal(raw.includes(PASS), false);
      assert.equal(raw.includes(AUTH), false);
      assert.equal(raw.includes("machine route"), false);
    }
  });

  test("approved origins pass preflight and other origins stay closed", async () => {
    assert.deepEqual([...ORIGINS], [ORIGIN, DRILLING_ORIGIN]);
    for (const origin of [ORIGIN, DRILLING_ORIGIN]) {
      const allowed = await proxy(gameReq({ method: "OPTIONS", origin }));
      assert.equal(allowed.status, 204, origin);
      assert.equal(await allowed.text(), "");
      assert.equal(allowed.headers.get("access-control-allow-origin"), origin);
      assert.equal(allowed.headers.get("access-control-allow-methods"), "POST, GET, OPTIONS");
      assert.equal(allowed.headers.get("access-control-allow-headers"), "Content-Type, X-Witsml-Authorization");
      assert.equal(allowed.headers.get("access-control-allow-origin").includes("*"), false);
      const info = await proxy(gameReq({ method: "GET", origin }));
      const body = await info.json();
      assert.equal(info.status, 200, origin);
      assert.equal(body.storesCredentials, false);
      assert.equal(body.rateLimitPerMin, 60);
      assert.deepEqual(body.ops, ["WMLS_GetVersion", "WMLS_GetCap", "WMLS_GetFromStore"]);
      assert.equal(info.headers.get("access-control-allow-origin"), origin);
    }
    for (const origin of ["https://evil.example", DRILLING_ORIGIN + ".evil.example", "null"]) {
      const denied = await proxy(gameReq({ method: "OPTIONS", origin }));
      assert.equal(denied.status, 403, origin);
      assert.equal(denied.headers.get("access-control-allow-origin"), null);
    }
    const missing = await proxy(gameReq({ method: "OPTIONS" }));
    assert.equal(missing.status, 403);
    assert.equal(missing.headers.get("access-control-allow-origin"), null);
    assert.equal(netCalls, 0);
  });

  test("the game origin still unlocks only the existing CORS preflight and GET metadata", async () => {
    const allowed = await proxy(gameReq({ method: "OPTIONS", origin: ORIGIN }));
    assert.equal(allowed.status, 204);
    assert.equal(await allowed.text(), "");
    assert.equal(allowed.headers.get("access-control-allow-origin"), ORIGIN);
    assert.equal(allowed.headers.get("access-control-allow-methods"), "POST, GET, OPTIONS");
    assert.equal(allowed.headers.get("access-control-allow-headers"), "Content-Type, X-Witsml-Authorization");
    assert.equal(allowed.headers.get("access-control-allow-origin").includes("*"), false);
    const blocked = await proxy(gameReq({ method: "OPTIONS" }));
    assert.equal(blocked.status, 403);
    assert.equal(blocked.headers.get("access-control-allow-origin"), null);
    const info = await proxy(gameReq({ method: "GET", origin: ORIGIN }));
    const body = await info.json();
    assert.equal(info.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, "witsml-proxy");
    assert.equal(body.upstream, "https://australia.adagasolutions.com/WMLS");
    assert.deepEqual(body.ops, ["WMLS_GetVersion", "WMLS_GetCap", "WMLS_GetFromStore"]);
    assert.equal(body.tlsVerify, "enforced except per-request skip for australia.adagasolutions.com");
    assert.equal(body.storesCredentials, false);
    assert.equal(body.rateLimitPerMin, 60);
    assert.equal(info.headers.get("access-control-allow-origin"), ORIGIN);
  });

  test("game write ops and body credentials still stop before any upstream call", async () => {
    const write = await proxy(gameReq({
      origin: ORIGIN,
      body: JSON.stringify({ op: "WMLS_AddToStore", url: "https://evil.example/WMLS" }),
    }));
    assert.equal(write.status, 403);
    assert.match((await write.json()).error, /read-only proxy/);
    const creds = await proxy(gameReq({
      origin: ORIGIN,
      body: JSON.stringify({ user: "box-user", pass: PASS, op: "WMLS_GetVersion" }),
    }));
    const raw = await creds.text();
    assert.equal(creds.status, 400);
    assert.equal(JSON.parse(raw).error, "send credentials in X-Witsml-Authorization, not the body");
    assert.equal(raw.includes(PASS), false);
    const method = await proxy(gameReq({ method: "PUT", origin: ORIGIN, body: "{}" }));
    assert.equal(method.status, 405);
  });

  test("the machine route does not accept the game origin as authentication", async () => {
    for (const origin of [ORIGIN, DRILLING_ORIGIN]) {
    const res = await handler(gameReq({
      origin,
      headers: { "x-witsml-authorization": AUTH },
      body: JSON.stringify({ op: "WMLS_GetVersion" }),
    }));
    const raw = await res.text();
    assert.equal(res.status, 403);
    assert.equal(JSON.parse(raw).error, "machine route denied");
    assert.equal(JSON.parse(raw).authGate, undefined);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    assert.equal(raw.includes(PASS), false);
    }
  });

  test("no real network", () => {
    assert.equal(netCalls, 0);
  });
});
