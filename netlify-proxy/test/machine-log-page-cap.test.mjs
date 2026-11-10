import assert from "node:assert/strict";
import https from "node:https";
import { after, describe, test } from "node:test";
import {
  FIXED_UPSTREAM,
  LIMITS,
  READ_OP_LIST,
  WITSML_NS,
  assertOutgoingEnvelope,
  buildEnvelope,
  createVerifiedDispatch,
  enforceMachinePolicy,
  parseUpstreamSoap,
  LOG_MAX_RETURN_NODES,
  DEFAULT_MAX_RETURN_NODES,
  maxReturnNodesFor,
} from "../netlify/lib/machine-policy.mjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const PASS = "QZJV";
const AUTH = "Basic " + Buffer.from("box-user:" + PASS).toString("base64");
const TOKEN = AUTH.slice(6);
const CALLER_KEY = "synthetic-not-real-caller-key-0123456789abcd";
const CALLER_SECRET = "not-a-real-secret";
const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const ACTION = {
  WMLS_GetVersion: '"http://www.witsml.org/action/120/Store.WMLS_GetVersion"',
  WMLS_GetCap: '"http://www.witsml.org/action/120/Store.WMLS_GetCap"',
  WMLS_GetFromStore: '"http://www.witsml.org/action/120/Store.WMLS_GetFromStore"',
};

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

function fakeHttps(mode = {}) {
  const calls = [];
  const impl = {
    calls,
    Agent: class {
      constructor(opts) {
        this.opts = { ...opts };
        calls.push({ type: "agent", opts: this.opts });
      }
      destroy() { calls.push({ type: "destroy" }); }
    },
    request(options, cb) {
      const rec = { type: "request", options, body: "" };
      calls.push(rec);
      const req = {
        on(ev, fn) {
          if (ev === "error") req.onError = fn;
          if (ev === "timeout") req.onTimeout = fn;
          return req;
        },
        write(chunk) { rec.body += chunk; return true; },
        end() {
          if (mode.error) {
            req.onError?.(mode.error);
            return;
          }
          if (mode.hang) return;
          const res = {
            statusCode: mode.status ?? 200,
            headers: mode.responseHeaders || {},
            on(ev, fn) {
              (res.listeners ||= {})[ev] = fn;
              return res;
            },
          };
          cb(res);
          if (mode.text) res.listeners.data?.(Buffer.from(mode.text));
          res.listeners.end?.();
        },
        destroy() { rec.destroyed = true; },
      };
      return req;
    },
  };
  return impl;
}

function timers({ fire = false } = {}) {
  const scheduled = [];
  return {
    scheduled,
    schedule(fn, ms) {
      const handle = { fn, ms, cleared: false };
      scheduled.push(handle);
      if (fire) fn();
      return handle;
    },
    cancel(handle) { if (handle) handle.cleared = true; },
  };
}

function depsFor(impl, extra = {}) {
  const clock = extra.timers || timers();
  return {
    callerSecret: Object.hasOwn(extra, "callerSecret") ? extra.callerSecret : CALLER_KEY,
    dispatch: createVerifiedDispatch(impl, clock),
    now: extra.now || (() => 5000),
    timers: clock,
    impl,
  };
}

let seq = 0;
function makeReq({ method = "POST", ip, headers = {}, body, noIp = false, key = CALLER_KEY } = {}) {
  seq += 1;
  const h = {};
  if (key) h["x-witsml-machine-key"] = key;
  Object.assign(h, headers);
  if (method !== "GET" && method !== "HEAD" && !h["content-type"] && !h["Content-Type"]) h["content-type"] = "application/json";
  if (!noIp) h["x-nf-client-connection-ip"] = ip || `203.0.113.${(seq % 200) + 1}`;
  const init = { method, headers: h };
  if (method !== "GET" && method !== "HEAD") init.body = body ?? "{}";
  return new Request("https://machine.invalid/witsml-machine", init);
}

function bodyStream(text) {
  const data = Buffer.from(text);
  let sent = false;
  return {
    getReader() {
      return {
        async read() {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: data };
        },
        async cancel() { sent = true; },
        releaseLock() {},
      };
    },
  };
}

function soap(op, inner, how = "ancestor") {
  const env = how === "ancestor" ? ` xmlns:q1="${WITSML_NS}"` : "";
  const el = how === "element" ? ` xmlns:q1="${WITSML_NS}"` : "";
  const def = how === "default" ? ` xmlns="${WITSML_NS}"` : "";
  const tag = how === "default" ? `${op}Response` : `q1:${op}Response`;
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="${SOAP_NS}"${env}><soap:Body><${tag}${el}${def}>${inner}</${tag}></soap:Body></soap:Envelope>`;
}

function fixture(op, how = "ancestor") {
  if (op === "WMLS_GetVersion") return soap(op, "<Result>1.4.1.1</Result><SuppMsgOut></SuppMsgOut>", how);
  if (op === "WMLS_GetCap") return soap(op, "<Result>1</Result><CapabilitiesOut>&lt;capServers/&gt;</CapabilitiesOut><SuppMsgOut>ok</SuppMsgOut>", how);
  return soap(op, "<Result>1</Result><XMLout>&lt;logs/&gt;</XMLout><SuppMsgOut>ok</SuppMsgOut>", how);
}

function postBody(op, extra = {}) {
  if (op === "WMLS_GetFromStore") return JSON.stringify({ op, wmlType: "log", query: "<logs/>", ...extra });
  if (op === "WMLS_GetCap") return JSON.stringify({ op, ...extra });
  return JSON.stringify({ op, ...extra });
}

async function read(res) {
  const raw = await res.text();
  let body = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  return { status: res.status, raw, body, headers: res.headers };
}

function assertClean(raw, ...extra) {
  for (const secret of [PASS, AUTH, TOKEN, CALLER_KEY, CALLER_SECRET, ...extra]) {
    if (secret) assert.equal(raw.includes(secret), false, "leaked " + secret.slice(0, 12));
  }
}

// ---- log page cap (ctobox/witsml-machine-log-page-cap) ----
const CHANNELS = ["TIME", "BDE", "BHE", "FLOW", "HKL", "ROP", "RPM", "SPP", "TORQUE", "WOB"];
function isoAt(i) { return new Date(Date.UTC(2026, 10, 6, 15, 55, 7) + i * 1000).toISOString(); }
// Worst-case row: ISO time + 9 values at 16 chars each.
function worstRow(i, value) { return isoAt(i) + "," + Array.from({ length: 9 }, (_, k) => value ?? (k % 2 ? "-1234.5678901234" : "98765.432109876")).join(","); }
function typicalRow(i) { return isoAt(i) + ",2281.09,2280.5,2450.0,182.4,23.1,120,2890.0,15200,22.5"; }
function logXml(rows) {
  const head = '<logs xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><log uidWell="w1" uidWellbore="b1" uid="l1"><logData>' +
    "<mnemonicList>" + CHANNELS.join(",") + "</mnemonicList><unitList>s,m,m,lpm,klbs,m/hr,rpm,psi,ftlb,klbs</unitList>\n";
  return head + rows.map((r) => "      <data>" + r + "</data>\n").join("") + "</logData></log></logs>";
}
const escXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function logSoap(rows) { return soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>" + escXml(logXml(rows)) + "</XMLout><SuppMsgOut></SuppMsgOut>"); }
function logReq(options, wmlType = "log") {
  return makeReq({ body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType, query: '<logs xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><log uidWell="w1" uidWellbore="b1" uid="l1"/></logs>', options }), headers: { "x-witsml-authorization": AUTH } });
}

describe("log page cap", { concurrency: 1 }, () => {
  test("constants: log 7000, everything else 1000; GetCap points respected", () => {
    assert.equal(DEFAULT_MAX_RETURN_NODES, 1000);
    assert.equal(LOG_MAX_RETURN_NODES, 7000);
    assert.equal(maxReturnNodesFor("log"), 7000);
    for (const t of ["well", "wellbore", "trajectory", "Log", "LOG", "logs", "mudLog", "", undefined, null]) assert.equal(maxReturnNodesFor(t), 1000, String(t));
    assert.ok(LOG_MAX_RETURN_NODES * CHANNELS.length <= 100000);
    assert.ok(LOG_MAX_RETURN_NODES + 200 <= LIMITS.maxElements);
    assert.equal(LIMITS.maxResp, 2 * 1024 * 1024);
    assert.equal(LIMITS.timeoutMs, 9000);
    assert.equal(LIMITS.maxElements, 10000);
  });

  test("wmlType=log accepts 1001..7000 and forwards the value unchanged", async () => {
    for (const n of [1001, 5000, 7000]) {
      const impl = fakeHttps({ text: fixture("WMLS_GetFromStore") });
      const out = await read(await enforceMachinePolicy(logReq("returnElements=data-only;maxReturnNodes=" + n), depsFor(impl)));
      assert.equal(out.status, 200, n + " " + out.raw);
      const sent = impl.calls.filter((c) => c.type === "request");
      assert.equal(sent.length, 1);
      assert.match(sent[0].body, new RegExp("maxReturnNodes=" + n + "<"));
      assertClean(out.raw);
    }
  });

  test("wmlType=log rejects above 7000 with 400 and opens no socket", async () => {
    for (const options of ["maxReturnNodes=7001", "maxReturnNodes=10000", "maxReturnNodes=100000", "maxReturnNodes=07001", "returnElements=data-only;maxReturnNodes=7001", "maxReturnNodes=7000;maxReturnNodes=1", "MaxReturnNodes=7000", "maxReturnNodes=7e3", "maxReturnNodes=0"]) {
      const impl = fakeHttps({ text: fixture("WMLS_GetFromStore") });
      const out = await read(await enforceMachinePolicy(logReq(options), depsFor(impl)));
      assert.equal(out.status, 400, options + " " + out.raw);
      assert.equal(out.body.error, "bad options");
      assert.equal(impl.calls.filter((c) => c.type === "request").length, 0);
    }
  });

  test("every other wmlType (and case variants of log) keeps the 1000 cap", async () => {
    for (const wmlType of ["well", "wellbore", "trajectory", "Log", "LOG", "logs", "mudLog"]) {
      for (const n of [1001, 7000]) {
        const impl = fakeHttps({ text: fixture("WMLS_GetFromStore") });
        const out = await read(await enforceMachinePolicy(logReq("maxReturnNodes=" + n, wmlType), depsFor(impl)));
        assert.equal(out.status, 400, wmlType + " " + n);
        assert.equal(impl.calls.filter((c) => c.type === "request").length, 0);
      }
      const impl = fakeHttps({ text: fixture("WMLS_GetFromStore") });
      const ok = await read(await enforceMachinePolicy(logReq("maxReturnNodes=1000", wmlType), depsFor(impl)));
      assert.equal(ok.status, 200, wmlType + " 1000 " + ok.raw);
    }
  });

  test("no maxReturnNodes still defaults to 100 for logs", async () => {
    const impl = fakeHttps({ text: fixture("WMLS_GetFromStore") });
    const out = await read(await enforceMachinePolicy(logReq("returnElements=data-only"), depsFor(impl)));
    assert.equal(out.status, 200);
    assert.match(impl.calls.find((c) => c.type === "request").body, /maxReturnNodes=100</);
  });

  test("a worst-case 7000-row 10-channel page fits maxResp and maxElements and returns every row", async () => {
    const rows = Array.from({ length: 7000 }, (_, i) => worstRow(i));
    const text = logSoap(rows);
    assert.ok(text.length < LIMITS.maxResp * 0.8, "worst-case page " + text.length + " B should leave >=20% headroom");
    const impl = fakeHttps({ text });
    const t0 = Date.now();
    const out = await read(await enforceMachinePolicy(logReq("returnElements=data-only;maxReturnNodes=7000"), depsFor(impl)));
    const ms = Date.now() - t0;
    assert.equal(out.status, 200, out.raw.slice(0, 300));
    assert.equal(out.body.result, 1);
    assert.equal((out.body.xml.match(/<data>/g) || []).length, 7000);
    assert.equal(out.body.passwordRedacted, undefined);
    assert.ok(ms < 4000, "policy+guard took " + ms + " ms");
    assertClean(out.raw);
  });

  test("a typical 7000-row page is well under the limit", async () => {
    const text = logSoap(Array.from({ length: 7000 }, (_, i) => typicalRow(i)));
    assert.ok(text.length < LIMITS.maxResp * 0.6, String(text.length));
    const out = await read(await enforceMachinePolicy(logReq("maxReturnNodes=7000"), depsFor(fakeHttps({ text }))));
    assert.equal(out.status, 200);
    assert.equal((out.body.xml.match(/<data>/g) || []).length, 7000);
  });

  test("an upstream that over-returns past 2 MiB still fails closed with no document", async () => {
    const text = logSoap(Array.from({ length: 11000 }, (_, i) => worstRow(i)));
    assert.ok(text.length > LIMITS.maxResp);
    const out = await read(await enforceMachinePolicy(logReq("maxReturnNodes=7000"), depsFor(fakeHttps({ text }))));
    assert.notEqual(out.status, 200);
    assert.equal(out.body.xml, undefined);
    assertClean(out.raw);
  });

  test("XMLout element count is bounded by maxResp, not maxElements (pre-existing; documented)", async () => {
    // maxElements applies to the SOAP envelope walk. XMLout is only walked when it
    // contains the literal password. So an upstream that ignores maxReturnNodes is
    // bounded by the 2 MiB maxResp, and callers must count the rows they receive.
    const rows = Array.from({ length: 10050 }, (_, i) => isoAt(i) + ",1");
    const out = await read(await enforceMachinePolicy(logReq("maxReturnNodes=7000"), depsFor(fakeHttps({ text: logSoap(rows) }))));
    assert.equal(out.status, 200);
    assert.equal((out.body.xml.match(/<data>/g) || []).length, 10050);
    assertClean(out.raw);
  });

  test("the password in data rows of a 7000-row page is redacted in place, never returned", async () => {
    const rows = Array.from({ length: 7000 }, (_, i) => (i % 997 === 5 ? isoAt(i) + ",1," + PASS + ",3,4,5,6,7,8,9" : typicalRow(i)));
    const out = await read(await enforceMachinePolicy(logReq("maxReturnNodes=7000"), depsFor(fakeHttps({ text: logSoap(rows) }))));
    assertClean(out.raw);
    if (out.status === 200) {
      assert.equal(out.body.passwordRedacted, true);
      assert.equal((out.body.xml.match(/<data>/g) || []).length, 7000);
    }
  });

  test("a timeout on a large page fails closed (no partial body)", async () => {
    const impl = fakeHttps({ hang: true });
    const d = depsFor(impl, { timers: timers({ fire: true }) });
    const out = await read(await enforceMachinePolicy(logReq("maxReturnNodes=7000"), d));
    assert.notEqual(out.status, 200);
    assert.equal(out.body.xml, undefined);
  });

  test("guard is unchanged (sha256 fdd2a8d1)", () => {
    const sha = createHash("sha256").update(readFileSync(new URL("../netlify/lib/witsml-echo-guard.mjs", import.meta.url))).digest("hex");
    assert.equal(sha, "fdd2a8d1c73d70c4c6e67115c34e04dfab939d75690716faaf554df52763c14e");
  });

  test("no real network was used", () => { assert.equal(netCalls, 0); });
});
