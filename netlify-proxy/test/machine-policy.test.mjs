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
} from "../netlify/lib/machine-policy.mjs";

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

describe("machine read policy", { concurrency: 1 }, () => {
  test("a caller key and a verified transport are required before any socket", async () => {
    const impl = fakeHttps({ text: fixture("WMLS_GetVersion") });
    const ready = depsFor(impl);
    const noSecret = await enforceMachinePolicy(makeReq({ body: postBody("WMLS_GetVersion"), headers: { "x-witsml-authorization": AUTH } }), { dispatch: ready.dispatch });
    const unbranded = await enforceMachinePolicy(makeReq({ body: postBody("WMLS_GetVersion"), headers: { "x-witsml-authorization": AUTH } }), { ...ready, dispatch: async () => ({ status: 200, text: "" }) });
    const asHttps = await enforceMachinePolicy(makeReq({ body: postBody("WMLS_GetVersion"), headers: { "x-witsml-authorization": AUTH } }), { callerSecret: CALLER_KEY, dispatch: https.request });
    const basicOnly = await enforceMachinePolicy(makeReq({ key: false, body: postBody("WMLS_GetVersion"), headers: { "x-witsml-authorization": AUTH, "x-caller-secret": CALLER_SECRET } }), ready);
    const outNoSecret = await read(noSecret);
    assert.equal(outNoSecret.status, 403);
    assert.equal(outNoSecret.body.error, "machine route denied");
    assert.equal(outNoSecret.body.authGate, undefined);
    for (const res of [unbranded, asHttps]) {
      const out = await read(res);
      assert.equal(out.status, 403);
      assert.equal(out.body.error, "machine route denied");
      assert.equal(out.body.upstreamContact, false);
      assertClean(out.raw);
    }
    const outBasic = await read(basicOnly);
    assert.equal(outBasic.status, 403);
    assert.equal(outBasic.body.error, "machine route denied");
    assert.deepEqual(outBasic.body, outNoSecret.body);
    assertClean(outBasic.raw);
    assertClean(outNoSecret.raw);
    assert.equal(impl.calls.filter((c) => c.type === "request").length, 0);
    assert.equal(netCalls, 0);
  });

  test("other environment names do not arm the policy", async () => {
    const previous = ["WITSML_MACHINE_ENABLED", "WITSML_CALLER_SECRET", "WITSML_MACHINE_CALLER_SECRET"].map((key) => [key, process.env[key]]);
    process.env.WITSML_MACHINE_ENABLED = "true";
    process.env.WITSML_CALLER_SECRET = CALLER_KEY;
    process.env.WITSML_MACHINE_CALLER_SECRET = CALLER_KEY;
    try {
      const res = await enforceMachinePolicy(makeReq({ headers: { "x-witsml-authorization": AUTH } }), {});
      const out = await read(res);
      assert.equal(out.status, 403);
      assert.equal(out.body.error, "machine route denied");
      assert.equal(out.body.authGate, undefined);
      assertClean(out.raw);
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  for (const op of READ_OP_LIST) {
    test("review policy accepts read op " + op + " on the fixed verified destination", async () => {
      const impl = fakeHttps({ text: fixture(op) });
      const d = depsFor(impl);
      const res = await enforceMachinePolicy(makeReq({
        body: postBody(op),
        headers: { "x-witsml-authorization": AUTH, "x-caller-secret": CALLER_SECRET },
      }), d);
      const out = await read(res);
      assert.equal(out.status, 200, out.raw);
      assertClean(out.raw);
      assert.equal(out.headers.get("access-control-allow-origin"), null);
      assert.equal(out.body.ms, 0);
      const requests = impl.calls.filter((c) => c.type === "request");
      assert.equal(requests.length, 1);
      const opt = requests[0].options;
      assert.equal(opt.rejectUnauthorized, true);
      assert.equal(opt.hostname, "australia.adagasolutions.com");
      assert.equal(opt.path, "/WMLS");
      assert.equal(opt.port, 443);
      assert.equal(opt.protocol, "https:");
      assert.equal(opt.servername, opt.hostname);
      assert.equal(opt.method, "POST");
      assert.equal(opt.timeout, 9000);
      assert.equal(opt.checkServerIdentity, undefined);
      assert.equal(opt.lookup, undefined);
      assert.equal(opt.headers.Authorization, AUTH);
      assert.equal(opt.headers.SOAPAction, ACTION[op]);
      assert.equal(opt.headers["Content-Type"], "text/xml; charset=utf-8");
      assert.equal(Object.keys(opt.headers).length, 4);
      assert.equal(JSON.stringify(opt.headers).includes(CALLER_SECRET), false);
      assert.deepEqual(impl.calls.find((c) => c.type === "agent").opts, { rejectUnauthorized: true, keepAlive: false, maxSockets: 1 });
      assert.equal(d.timers.scheduled[0].ms, 9000);
      assert.equal(d.timers.scheduled[0].cleared, true);
      assert.ok(impl.calls.some((c) => c.type === "destroy"));
      assert.doesNotMatch(requests[0].body, /WMLS_AddToStore|WMLS_UpdateInStore|WMLS_DeleteFromStore/);
      assert.match(requests[0].body, new RegExp("<q1:" + op + ' xmlns:q1="' + WITSML_NS + '">'));
      if (op === "WMLS_GetVersion") {
        assert.equal(out.body.result, 1);
        assert.equal(out.body.version, "1.4.1.1");
        assert.equal(out.body.xml, "");
      } else if (op === "WMLS_GetCap") {
        assert.equal(out.body.result, 1);
        assert.equal(out.body.xml, "<capServers/>");
        assert.equal(out.body.version, undefined);
      } else {
        assert.equal(out.body.result, 1);
        assert.equal(out.body.xml, "<logs/>");
        assert.match(requests[0].body, /maxReturnNodes=100/);
      }
    });
  }

  test("namespace can be declared on the element, the ancestor, or as the default", async () => {
    for (const how of ["ancestor", "element", "default"]) {
      const impl = fakeHttps({ text: fixture("WMLS_GetVersion", how) });
      const out = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetVersion"),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(impl)));
      assert.equal(out.status, 200, how + " " + out.raw);
      assert.equal(out.body.version, "1.4.1.1");
    }
    const prefixed = soap("WMLS_GetVersion", "<q1:Result>1.4.1.1</q1:Result>", "ancestor");
    const impl = fakeHttps({ text: prefixed });
    const out = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": AUTH },
    }), depsFor(impl)));
    assert.equal(out.status, 200, out.raw);
    assert.equal(out.body.version, "1.4.1.1");
  });

  test("xml text is escaped and a write element cannot be injected into the query", async () => {
    const query = "a&b<c>d\"e'f</QueryIn><q1:WMLS_DeleteFromStore xmlns:q1=\"" + WITSML_NS + "\"/>";
    const impl = fakeHttps({ text: fixture("WMLS_GetFromStore") });
    const out = await read(await enforceMachinePolicy(makeReq({
      body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "log", query, options: "returnElements=id-only" }),
      headers: { "x-witsml-authorization": AUTH },
    }), depsFor(impl)));
    assert.equal(out.status, 200, out.raw);
    const sent = impl.calls.find((c) => c.type === "request").body;
    const inner = sent.match(/<QueryIn\b[^>]*>([\s\S]*?)<\/QueryIn>/)[1];
    assert.equal(inner.includes("<"), false);
    assert.equal(inner.includes(">"), false);
    assert.match(inner, /a&amp;b&lt;c&gt;d&quot;e&apos;f&lt;\/QueryIn&gt;&lt;q1:WMLS_DeleteFromStore/);
    assert.equal(sent.includes("<q1:WMLS_DeleteFromStore"), false);
    assertOutgoingEnvelope("WMLS_GetFromStore", sent);
  });

  test("client url, user, pass, soap action, and raw xml cannot select an operation", async () => {
    const cases = [
      { body: JSON.stringify({ op: "WMLS_GetVersion", url: "https://URLSECRET:pw@evil.example/WMLS" }), status: 400, error: "unexpected field", secret: "URLSECRET" },
      { body: JSON.stringify({ op: "WMLS_GetVersion", url: FIXED_UPSTREAM }), status: 400, error: "unexpected field" },
      { body: JSON.stringify({ op: "WMLS_GetVersion", user: "u", pass: "PASSSECRET" }), status: 400, error: "unexpected field", secret: "PASSSECRET" },
      { body: JSON.stringify({ op: "WMLS_GetVersion", soapAction: ACTION.WMLS_AddToStore || "WMLS_AddToStore" }), status: 400, error: "unexpected field" },
      { body: JSON.stringify({ op: "WMLS_GetVersion", envelope: "<q1:WMLS_AddToStore xmlns:q1=\"" + WITSML_NS + "\"/>" }), status: 400, error: "unexpected field" },
      { body: "<q1:WMLS_AddToStore xmlns:q1=\"" + WITSML_NS + "\"/>", headers: { "content-type": "text/xml" }, status: 415, error: "content-type must be application/json" },
      { body: postBody("WMLS_GetVersion"), headers: { soapaction: ACTION.WMLS_GetFromStore }, status: 400, error: "client SOAPAction is not accepted" },
      { body: "{", status: 400, error: "bad json" },
      { body: "[]", status: 400, error: "bad json" },
      { body: "null", status: 400, error: "bad json" },
      { body: "{\"__proto__\":{\"op\":\"WMLS_AddToStore\"},\"op\":\"WMLS_GetVersion\"}", status: 400, error: "unexpected field" },
      { body: JSON.stringify({ wmlType: "log", query: "<logs/>" }), status: 403, error: "read-only proxy: op not allowed" },
    ];
    for (const item of cases) {
      const impl = fakeHttps({ text: fixture("WMLS_GetVersion") });
      const out = await read(await enforceMachinePolicy(makeReq({
        body: item.body,
        headers: { "x-witsml-authorization": AUTH, ...item.headers },
      }), depsFor(impl)));
      assert.equal(out.status, item.status, item.error + " " + out.raw);
      assert.equal(out.body.error, item.error);
      assert.equal(impl.calls.some((c) => c.type === "request"), false);
      assertClean(out.raw, item.secret);
    }
  });

  test("prohibited and malformed operations never reach the transport", async () => {
    const ops = ["WMLS_AddToStore", "WMLS_UpdateInStore", "WMLS_DeleteFromStore", "WMLS_GetBaseMsg", "wmls_getversion", "WMLS_GetVersion ", "WMLS_GetVersion\nWMLS_AddToStore", "q1:WMLS_GetVersion", "WMLS_GetVersion</q1:WMLS_GetVersion><q1:WMLS_AddToStore>", ""];
    for (const op of ops) {
      const impl = fakeHttps({ text: fixture("WMLS_GetVersion") });
      const out = await read(await enforceMachinePolicy(makeReq({
        body: JSON.stringify({ op }),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(impl)));
      assert.equal(out.status, 403, op);
      assert.equal(out.body.error, "read-only proxy: op not allowed");
      assert.equal(impl.calls.some((c) => c.type === "request"), false);
      assertClean(out.raw);
    }
    assert.throws(() => buildEnvelope("WMLS_DeleteFromStore", {}), (err) => err.code === "EFIXED");
  });

  test("missing and malformed upstream basic are rejected after the caller key matches", async () => {
    const impl = fakeHttps({ text: fixture("WMLS_GetVersion") });
    const d = depsFor(impl);
    const missing = await read(await enforceMachinePolicy(makeReq({ body: postBody("WMLS_GetVersion") }), d));
    const wrong = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": "Basic !!!", "x-caller-secret": "wrong-" + CALLER_SECRET },
    }), d));
    const injectedReq = {
      method: "POST",
      headers: { get(name) {
        const map = {
          "content-type": "application/json",
          "x-nf-client-connection-ip": "203.0.113.88",
          "x-witsml-machine-key": CALLER_KEY,
          "x-witsml-authorization": "Basic " + TOKEN + "\r\nX-Injected: 1",
        };
        return map[String(name).toLowerCase()] || null;
      } },
      body: bodyStream(postBody("WMLS_GetVersion")),
    };
    const injected = await read(await enforceMachinePolicy(injectedReq, d));
    for (const out of [missing, wrong, injected]) {
      assert.equal(out.status, 400);
      assert.equal(out.body.error, "credentials required");
      assertClean(out.raw);
    }
    assert.equal(impl.calls.some((c) => c.type === "request"), false);
  });

  test("the caller key is required and is not forwarded upstream", async () => {
    const impl = fakeHttps({ text: fixture("WMLS_GetVersion") });
    const sent = await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": AUTH, "x-caller-secret": "wrong-" + CALLER_SECRET },
    }), depsFor(impl));
    const out = await read(sent);
    assert.equal(out.status, 200, out.raw);
    const headers = impl.calls.find((c) => c.type === "request").options.headers;
    const flat = JSON.stringify(headers) + impl.calls.find((c) => c.type === "request").body;
    assert.equal(flat.includes(CALLER_KEY), false);
    assert.equal(flat.includes(CALLER_SECRET), false);
    assert.equal(headers.Authorization, AUTH);
    assert.equal(Object.hasOwn(headers, "X-Witsml-Machine-Key"), false);
    assert.equal(Object.hasOwn(headers, "x-witsml-machine-key"), false);
    assertClean(out.raw);
    const missing = await read(await enforceMachinePolicy(makeReq({
      key: false,
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": AUTH },
    }), depsFor(fakeHttps({ text: fixture("WMLS_GetVersion") }))));
    assert.equal(missing.status, 403);
    assert.equal(missing.body.error, "machine route denied");
  });

  test("bounds reject oversized input and cap maxReturnNodes", async () => {
    const big = "a".repeat(LIMITS.maxBody + 1);
    const impl = fakeHttps({ text: fixture("WMLS_GetFromStore") });
    const d = depsFor(impl);
    const tooBig = await read(await enforceMachinePolicy(makeReq({ body: big, headers: { "x-witsml-authorization": AUTH } }), d));
    assert.equal(tooBig.status, 413);
    const query = "b".repeat(LIMITS.maxQuery + 1);
    const tooQuery = await read(await enforceMachinePolicy(makeReq({
      body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "log", query }),
      headers: { "x-witsml-authorization": AUTH },
    }), d));
    assert.equal(tooQuery.status, 413);
    assert.equal(tooQuery.body.error, "query too large");
    const tooOpt = await read(await enforceMachinePolicy(makeReq({
      body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "log", query: "<logs/>", options: "a".repeat(LIMITS.maxOptions + 1) }),
      headers: { "x-witsml-authorization": AUTH },
    }), d));
    assert.equal(tooOpt.status, 413);
    for (const options of ["maxReturnNodes=1001", "maxReturnNodes=0", "maxReturnNodes=1;maxReturnNodes=2", "MaxReturnNodes=5", "maxReturnNodes=1e2"]) {
      const out = await read(await enforceMachinePolicy(makeReq({
        body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "wellbore", query: "<wellbores/>", options }),
        headers: { "x-witsml-authorization": AUTH },
      }), d));
      assert.equal(out.status, 400, options + " " + out.raw);
      assert.equal(out.body.error, "bad options");
    }
    const declared = {
      method: "POST",
      headers: { get(name) {
        const map = { "content-type": "application/json", "content-length": String(LIMITS.maxBody + 5), "x-nf-client-connection-ip": "203.0.113.77", "x-witsml-machine-key": CALLER_KEY, "x-witsml-authorization": AUTH };
        return map[name] || null;
      } },
      async text() { throw new Error("body should not be read"); },
    };
    const early = await read(await enforceMachinePolicy(declared, d));
    assert.equal(early.status, 413);
    assert.equal(impl.calls.some((c) => c.type === "request"), false);
    for (const wmlType of ["l", "log1", "log-name", "wellbore ", "<log>"]) {
      const out = await read(await enforceMachinePolicy(makeReq({
        body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType, query: "<logs/>" }),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(fakeHttps())));
      assert.equal(out.status, 400, wmlType);
      assert.equal(out.body.error, "bad wmlType");
    }
  });

  test("null bytes, doctype, empty query, and bad content-type are rejected", async () => {
    const d = () => depsFor(fakeHttps());
    const samples = [
      [JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "log", query: "a\u0000b" }), 400, "bad query"],
      [JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "log", query: "<!DOCTYPE foo>" }), 400, "bad query"],
      [JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "log", query: "" }), 400, "bad query"],
      [JSON.stringify({ op: "WMLS_GetVersion", options: "dataVersion=1.4.1.1" }), 400, "unexpected field"],
    ];
    for (const [body, status, error] of samples) {
      const impl = fakeHttps();
      const out = await read(await enforceMachinePolicy(makeReq({ body, headers: { "x-witsml-authorization": AUTH } }), depsFor(impl)));
      assert.equal(out.status, status, error + " " + out.raw);
      assert.equal(out.body.error, error);
      assert.equal(impl.calls.some((c) => c.type === "request"), false);
    }
    const xml = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "content-type": "application/json-patch+json", "x-witsml-authorization": AUTH },
    }), d()));
    assert.equal(xml.status, 415);
    const charset = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "content-type": "application/json; charset=utf-8", "x-witsml-authorization": AUTH },
    }), depsFor(fakeHttps({ text: fixture("WMLS_GetVersion") }))));
    assert.equal(charset.status, 200, charset.raw);
  });

  test("mismatched namespace, operation, doctype, entity, and extra write response are refused", async () => {
    const badResponses = [
      soap("WMLS_GetFromStore", "<Result>1</Result><XMLout></XMLout>", "ancestor").replaceAll(WITSML_NS, "http://evil.example/ns"),
      soap("WMLS_GetFromStore", "<Result>1</Result><XMLout></XMLout>", "ancestor"),
      "<q1:WMLS_GetVersionResponse><Result>1.4.1.1</Result></q1:WMLS_GetVersionResponse>",
      "<!DOCTYPE foo [<!ENTITY x \"y\">]>" + fixture("WMLS_GetVersion"),
      fixture("WMLS_GetVersion").replace("<Result>", "<Result>&SUPERSECRET;"),
      soap("WMLS_AddToStore", "<Result>1</Result>", "element"),
      fixture("WMLS_GetVersion").replace("</soap:Body>", "<q1:WMLS_DeleteFromStoreResponse xmlns:q1=\"" + WITSML_NS + "\"><Result>1</Result></q1:WMLS_DeleteFromStoreResponse></soap:Body>"),
      "<a>".repeat(70) + fixture("WMLS_GetVersion") + "</a>".repeat(70),
      "not xml",
    ];
    const expectMismatch = new Set([0, 1, 2, 5, 6]);
    for (let i = 0; i < badResponses.length; i++) {
      const impl = fakeHttps({ text: badResponses[i] });
      const out = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetVersion"),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(impl)));
      assert.equal(out.status, 502, String(i) + " " + out.raw);
      assert.equal(out.body.error, expectMismatch.has(i) ? "response mismatch" : "upstream response rejected");
      if (!expectMismatch.has(i)) assert.equal(out.body.reason, "parser-format");
      assertClean(out.raw, "SUPERSECRET", "evil.example");
      assert.equal(impl.calls.filter((c) => c.type === "request").length, 1);
    }
  });

  test("redirects are not followed and their location is not reflected", async () => {
    for (const mode of [
      { status: 302, responseHeaders: { location: "https://user:LOCSECRET@evil.example/WMLS" }, text: "gone " + TOKEN },
      { status: 301, responseHeaders: { location: FIXED_UPSTREAM }, text: "" },
      { status: 200, responseHeaders: { location: "https://australia.adagasolutions.com/elsewhere" }, text: fixture("WMLS_GetVersion") },
    ]) {
      const impl = fakeHttps(mode);
      const out = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetVersion"),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(impl)));
      assert.equal(out.status, 502, out.raw);
      assert.equal(out.body.error, "upstream redirect refused");
      assert.equal(impl.calls.filter((c) => c.type === "request").length, 1);
      assertClean(out.raw, "LOCSECRET");
    }
  });

  test("upstream auth failures, http errors, faults, and echoed basic values are not reflected", async () => {
    const logs = [];
    const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
    for (const key of Object.keys(orig)) console[key] = (...args) => logs.push(args.map(String).join(" "));
    try {
      const authFail = fakeHttps({ status: 401, text: "nope " + AUTH + " " + PASS });
      const denied = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetVersion"),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(authFail)));
      assert.equal(denied.status, 401);
      assert.equal(denied.body.error, "Authentication failed (401)");
      assertClean(denied.raw);
      const http = fakeHttps({ status: 500, text: "stack " + TOKEN });
      const failed = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetVersion"),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(http)));
      assert.equal(failed.status, 502);
      assert.equal(failed.body.error, "HTTP 500");
      assertClean(failed.raw);
      const leakedFault = fakeHttps({ text: `<soap:Envelope xmlns:soap="${SOAP_NS}"><soap:Body><soap:Fault><faultstring>bad ${TOKEN}</faultstring></soap:Fault></soap:Body></soap:Envelope>` });
      const hidden = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetVersion"),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(leakedFault)));
      assert.equal(hidden.status, 502);
      assert.equal(hidden.body.error, "upstream response refused");
      assertClean(hidden.raw);
      const faultXml = `<soap:Envelope xmlns:soap="${SOAP_NS}"><soap:Body><soap:Fault><faultstring>bad news\r\nSet-Cookie: x Basic AAAAAAAAAAAA</faultstring></soap:Fault></soap:Body></soap:Envelope>`;
      const faulted = fakeHttps({ text: faultXml });
      const fault = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetVersion"),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(faulted)));
      assert.equal(fault.status, 200);
      assert.match(fault.body.error, /^SOAP fault: /);
      assert.match(fault.body.error, /Basic \[redacted\]/);
      assert.equal(fault.headers.get("set-cookie"), null);
      assert.equal(fault.raw.includes("\r\nSet-Cookie"), false);
      assert.equal(fault.raw.includes("AAAAAAAAAAAA"), false);
      assertClean(fault.raw);
      const echoed = fakeHttps({ text: fixture("WMLS_GetFromStore").replace("&lt;logs/&gt;", TOKEN) });
      const refused = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetFromStore"),
        headers: { "x-witsml-authorization": AUTH },
      }), depsFor(echoed)));
      assert.equal(refused.status, 502);
      assert.equal(refused.body.error, "upstream response refused");
      assertClean(refused.raw);
      const blob = logs.join("\n");
      assert.equal(blob.includes(PASS), false);
      assert.equal(blob.includes(AUTH), false);
      assert.equal(blob.includes(TOKEN), false);
    } finally {
      Object.assign(console, orig);
    }
  });

  test("timeouts and oversized responses stop at one attempt", async () => {
    const hang = fakeHttps({ hang: true });
    const timed = depsFor(hang, { timers: timers({ fire: true }) });
    const timeout = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": AUTH },
    }), timed));
    assert.equal(timeout.status, 504);
    assert.equal(timeout.body.error, "upstream timeout");
    assert.equal(hang.calls.filter((c) => c.type === "request").length, 1);
    assert.equal(timed.timers.scheduled[0].ms, 9000);
    assertClean(timeout.raw);
    const marker = "LEAK-MARKER-END";
    const huge = fakeHttps({ text: "x".repeat(LIMITS.maxResp) + marker });
    const sized = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": AUTH },
    }), depsFor(huge)));
    assert.equal(sized.status, 502);
    assert.equal(sized.body.error, "upstream response too large");
    assert.equal(sized.raw.includes(marker), false);
    assert.equal(huge.calls.filter((c) => c.type === "request").length, 1);
  });

  test("tls failures stay on the verified path and do not copy the socket error", async () => {
    const impl = fakeHttps({ error: { code: "CERT_HAS_EXPIRED", message: "expired " + AUTH + " " + PASS } });
    const out = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": AUTH },
    }), depsFor(impl)));
    assert.equal(out.status, 502);
    assert.equal(out.body.error, "Upstream TLS certificate failed verification.");
    assertClean(out.raw);
    assert.equal(impl.calls.find((c) => c.type === "agent").opts.rejectUnauthorized, true);
    assert.equal(impl.calls.filter((c) => c.type === "request").length, 1);
  });

  test("the dispatcher rejects destination overrides before any socket call", async () => {
    const urls = [
      "http://australia.adagasolutions.com/WMLS",
      "https://user:pw@australia.adagasolutions.com/WMLS",
      "https://australia.adagasolutions.com/WMLS/",
      "https://australia.adagasolutions.com/wmls",
      "https://australia.adagasolutions.com/WMLS?x=1",
      "https://australia.adagasolutions.com/WMLS#a",
      "https://evil.example/WMLS",
      "https://australia.adagasolutions.com.evil.example/WMLS",
      "https://127.0.0.1/WMLS",
      "https://Australia.adagasolutions.com/WMLS",
      "",
    ];
    const body = buildEnvelope("WMLS_GetVersion", {});
    for (const url of urls) {
      const impl = fakeHttps({ text: fixture("WMLS_GetVersion") });
      const dispatch = createVerifiedDispatch(impl, timers());
      await assert.rejects(() => dispatch({
        url,
        method: "POST",
        body,
        rejectUnauthorized: false,
        hostname: "evil.example",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: ACTION.WMLS_GetVersion,
          Authorization: AUTH,
          "Content-Length": String(Buffer.byteLength(body)),
          Cookie: PASS,
        },
      }), (err) => err.code === "EFIXED" && err.message === "fixed upstream violation" && !String(err).includes(PASS) && !String(err).includes(TOKEN));
      assert.equal(impl.calls.some((c) => c.type === "request"), false);
    }
  });

  test("action and body mismatches and extra headers do not reach the socket", async () => {
    const good = buildEnvelope("WMLS_GetVersion", {});
    const other = buildEnvelope("WMLS_GetFromStore", { wmlType: "log", query: "<logs/>", options: "maxReturnNodes=10" });
    const impl = fakeHttps();
    const dispatch = createVerifiedDispatch(impl, timers());
    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: ACTION.WMLS_GetVersion,
      Authorization: AUTH,
      "Content-Length": String(Buffer.byteLength(other)),
    };
    await assert.rejects(() => dispatch({ url: FIXED_UPSTREAM, method: "POST", body: other, headers }), (err) => err.code === "EFIXED");
    const addHeaders = { ...headers, "Content-Length": String(Buffer.byteLength(good)), SOAPAction: '"http://www.witsml.org/action/120/Store.WMLS_AddToStore"' };
    await assert.rejects(() => dispatch({ url: FIXED_UPSTREAM, method: "POST", body: good, headers: addHeaders }), (err) => err.code === "EFIXED" && !String(err).includes(TOKEN));
    const extra = { ...headers, "Content-Length": String(Buffer.byteLength(good)), Cookie: PASS };
    await assert.rejects(() => dispatch({ url: FIXED_UPSTREAM, method: "POST", body: good, headers: extra }), (err) => err.code === "EFIXED" && !String(err).includes(PASS));
    assert.equal(impl.calls.length, 0);
    const hostile = {
      url: FIXED_UPSTREAM,
      method: "POST",
      body: good,
      rejectUnauthorized: false,
      agent: { rejectUnauthorized: false },
      hostname: "evil.example",
      path: "/admin",
      timeoutMs: 1,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: ACTION.WMLS_GetVersion,
        Authorization: AUTH,
        "Content-Length": String(Buffer.byteLength(good)),
      },
    };
    const okImpl = fakeHttps({ text: fixture("WMLS_GetVersion") });
    const ok = createVerifiedDispatch(okImpl, timers());
    const up = await ok(hostile);
    assert.equal(up.status, 200);
    const opt = okImpl.calls.find((c) => c.type === "request").options;
    assert.equal(opt.rejectUnauthorized, true);
    assert.equal(opt.hostname, "australia.adagasolutions.com");
    assert.equal(opt.path, "/WMLS");
    assert.equal(opt.timeout, 9000);
    assert.equal(Object.isFrozen(opt), true);
  });

  test("authenticated metadata names the inherited game TLS skip and does not call upstream", async () => {
    const impl = fakeHttps();
    const out = await read(await enforceMachinePolicy(makeReq({
      method: "GET",
      headers: { "x-witsml-authorization": AUTH },
    }), depsFor(impl)));
    assert.equal(out.status, 200);
    assert.equal(out.body.configured, true);
    assert.equal(out.body.upstreamContact, false);
    assert.equal(out.body.tlsVerify, "required");
    assert.equal(out.body.certificateSkip, "not-used");
    assert.equal(out.body.inheritedGameCertificateSkip, "unchanged-on-game-route-only");
    assert.equal(out.body.callerAuthentication, "host-env-secret");
    assert.equal(out.body.callerSecretForwarded, false);
    assert.equal(out.body.deployRevisionEquivalence, "unverified");
    assert.equal(out.body.upstream, FIXED_UPSTREAM);
    assert.deepEqual(out.body.ops, READ_OP_LIST);
    assert.equal(out.headers.get("access-control-allow-origin"), null);
    assertClean(out.raw);
    assert.equal(impl.calls.length, 0);
    const options = await read(await enforceMachinePolicy(makeReq({ method: "OPTIONS" }), depsFor(fakeHttps())));
    assert.equal(options.status, 405);
    assert.equal(options.headers.get("access-control-allow-origin"), null);
  });

  test("parser accepts a numeric character reference and rejects an unknown entity without echoing it", () => {
    const ok = parseUpstreamSoap("WMLS_GetFromStore", soap("WMLS_GetFromStore", "<Result>2</Result><XMLout>&#60;logs/&#62;</XMLout>", "ancestor"));
    assert.equal(ok.xml, "<logs/>");
    assert.equal(ok.resultText, "2");
    assert.throws(() => parseUpstreamSoap("WMLS_GetVersion", fixture("WMLS_GetVersion").replace("1.4.1.1", "&SUPERSECRET;")), (err) => err.code === "EBADXML" && !String(err).includes("SUPERSECRET"));
  });

  test("encoded caller secret is not forwarded and echoed credentials are not returned", async () => {
    const encoded = "Basic " + Buffer.from("box-user:" + CALLER_KEY).toString("base64");
    assert.equal(encoded.includes(CALLER_KEY), false);
    const impl = fakeHttps({ text: fixture("WMLS_GetVersion") });
    const hidden = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": encoded },
    }), depsFor(impl)));
    assert.equal(hidden.status, 400);
    assert.equal(hidden.body.error, "credentials required");
    assert.equal(impl.calls.some((c) => c.type === "request"), false);
    assertClean(hidden.raw);
    const password = "QZJV";
    const shortToken = Buffer.from("a:b").toString("base64");
    assert.ok(shortToken.length >= 4 && shortToken.length <= 7);
    const echoAuth = "Basic " + Buffer.from("box-user:" + password).toString("base64");
    const xml = soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>" + password + shortToken + "</XMLout><SuppMsgOut>ok</SuppMsgOut>");
    const echoed = fakeHttps({ text: xml });
    const leaked = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": echoAuth },
    }), depsFor(echoed)));
    assert.equal(leaked.status, 502);
    assert.equal(leaked.body.error, "upstream response rejected");
    assert.equal(leaked.body.reason, "parser-format");
    assert.equal(leaked.raw.includes(password), false);
    assert.equal(leaked.raw.includes(shortToken), false);
    assert.equal(leaked.raw.includes(echoAuth), false);
    const faultXml = `<soap:Envelope xmlns:soap="${SOAP_NS}"><soap:Body><soap:Fault><faultstring>${password}</faultstring></soap:Fault></soap:Body></soap:Envelope>`;
    const faulted = fakeHttps({ text: faultXml });
    const fault = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": echoAuth },
    }), depsFor(faulted)));
    assert.equal(fault.status, 200);
    assert.equal(fault.body.passwordRedacted, true);
    assert.equal(fault.body.error, "SOAP fault: [redacted]");
    assert.equal(fault.raw.includes(password), false);
    assert.equal(fault.body.xml, undefined);
  });

  test("real Agent options require verification and a sync abort does not end the request twice", async () => {
    let seen = null;
    let ended = 0;
    let requests = 0;
    const impl = {
      Agent: class extends https.Agent {
        constructor(opts) {
          super(opts);
          seen = this.options;
        }
      },
      request(options, cb) {
        requests += 1;
        assert.equal(options.rejectUnauthorized, true);
        assert.equal(netCalls, 0);
        const req = {
          on() { return req; },
          write() { return true; },
          end() { ended += 1; cb({ statusCode: 200, headers: {}, on(ev, fn) { if (ev === "end") fn(); return this; } }); },
          destroy() {},
        };
        return req;
      },
    };
    const dispatch = createVerifiedDispatch(impl, timers());
    const body = buildEnvelope("WMLS_GetVersion", {});
    const up = await dispatch({
      url: FIXED_UPSTREAM,
      method: "POST",
      body,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: ACTION.WMLS_GetVersion,
        Authorization: AUTH,
        "Content-Length": String(Buffer.byteLength(body)),
      },
    });
    assert.equal(up.status, 200);
    assert.equal(seen.rejectUnauthorized, true);
    assert.equal(requests, 1);
    assert.equal(ended, 1);
    const ac = new AbortController();
    let abortEnded = 0;
    let completions = 0;
    const abortImpl = {
      Agent: class { constructor(opts) { this.opts = { ...opts }; } destroy() {} },
      request(_options, _cb) {
        const req = {
          on() { return req; },
          write() { ac.abort(); return true; },
          end() { abortEnded += 1; },
          destroy() {},
        };
        return req;
      },
    };
    const aborting = createVerifiedDispatch(abortImpl, timers());
    const pending = aborting({
      url: FIXED_UPSTREAM,
      method: "POST",
      body,
      signal: ac.signal,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: ACTION.WMLS_GetVersion,
        Authorization: AUTH,
        "Content-Length": String(Buffer.byteLength(body)),
      },
    });
    pending.then(() => { completions += 1; }, () => { completions += 1; });
    await assert.rejects(pending, (err) => err.code === "ECONN");
    assert.equal(abortEnded, 0);
    assert.equal(completions, 1);
  });

  test("missing, understated, malformed, and chunked bodies stay inside the cap", async () => {
    const payload = postBody("WMLS_GetVersion");
    const missing = fakeHttps({ text: fixture("WMLS_GetVersion") });
    const noLength = {
      method: "POST",
      headers: { get(name) {
        const map = { "content-type": "application/json", "x-witsml-machine-key": CALLER_KEY, "x-witsml-authorization": AUTH };
        return map[name] || null;
      } },
      body: bodyStream(payload),
    };
    const ok = await read(await enforceMachinePolicy(noLength, depsFor(missing)));
    assert.equal(ok.status, 200, ok.raw);
    let reads = 0;
    const chunked = {
      method: "POST",
      rawHeaders: ["transfer-encoding", "chunked", "content-type", "application/json", "x-witsml-machine-key", CALLER_KEY, "x-witsml-authorization", AUTH],
      body: { getReader() { return { async read() { reads += 1; return { done: true, value: undefined }; }, async cancel() {}, releaseLock() {} }; } },
    };
    const chunk = await read(await enforceMachinePolicy(chunked, depsFor(fakeHttps())));
    assert.equal(chunk.status, 400);
    assert.equal(reads, 0);
    const malformed = {
      method: "POST",
      headers: { get(name) {
        const map = { "content-type": "application/json", "content-length": "10abc", "x-witsml-machine-key": CALLER_KEY, "x-witsml-authorization": AUTH };
        return map[name] || null;
      } },
      body: bodyStream(payload),
    };
    const badLen = await read(await enforceMachinePolicy(malformed, depsFor(fakeHttps())));
    assert.equal(badLen.status, 400);
    assert.equal(badLen.raw.includes(CALLER_KEY), false);
    let cancelled = false;
    const huge = Buffer.alloc(1024, 120);
    let sent = 0;
    const over = {
      method: "POST",
      headers: { get(name) {
        const map = { "content-type": "application/json", "x-witsml-machine-key": CALLER_KEY, "x-witsml-authorization": AUTH };
        return map[name] || null;
      } },
      body: {
        getReader() {
          return {
            async read() {
              if (sent > LIMITS.maxBody) return { done: true, value: undefined };
              sent += huge.length;
              return { done: false, value: huge };
            },
            async cancel() { cancelled = true; },
            releaseLock() {},
          };
        },
      },
    };
    const tooBig = await read(await enforceMachinePolicy(over, depsFor(fakeHttps())));
    assert.equal(tooBig.status, 413);
    assert.equal(cancelled, true);
    assert.equal(sent <= LIMITS.maxBody + huge.length, true);
  });

  test("user or password shorter than 4 characters is refused before upstream", async () => {
    const pairs = [
      ["q", "long-pass"],
      ["q7", "long-pass"],
      ["q7z", "long-pass"],
      ["long-user", "q"],
      ["long-user", "q7"],
      ["long-user", "q7z"],
      ["a", "b"],
      ["ab", "long-pass"],
      ["log", "long-pass"],
    ];
    for (const [user, password] of pairs) {
      const rawCred = user + ":" + password;
      const header = "Basic " + Buffer.from(rawCred).toString("base64");
      const impl = fakeHttps({ text: fixture("WMLS_GetVersion") });
      const out = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetVersion"),
        headers: { "x-witsml-authorization": header },
      }), depsFor(impl)));
      assert.equal(impl.calls.filter((c) => c.type === "request").length, 0, rawCred);
      assert.equal(out.status, 400, rawCred);
      assert.equal(out.body.error, "credentials required");
      assert.equal(out.raw.includes(rawCred), false, rawCred);
      if (user.length >= 2) assert.equal(out.raw.includes(user), false, user);
      if (password.length >= 2) assert.equal(out.raw.includes(password), false, password);
    }
  });

  test("format characters in decoded fields are refused before they can split a secret", async () => {
    for (const cp of [0x00ad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]) {
      assert.match(String.fromCodePoint(cp), /\p{Cf}/u);
    }
    const password = "QZJV";
    const header = "Basic " + Buffer.from("box-user:" + password).toString("base64");
    const forms = [
      ["fault-decimal", `<soap:Envelope xmlns:soap="${SOAP_NS}"><soap:Body><soap:Fault><faultstring>QZ&#8203;JV</faultstring></soap:Fault></soap:Body></soap:Envelope>`],
      ["fault-hex", `<soap:Envelope xmlns:soap="${SOAP_NS}"><soap:Body><soap:Fault><faultstring>QZ&#x200B;JV</faultstring></soap:Fault></soap:Body></soap:Envelope>`],
      ["fault-literal", `<soap:Envelope xmlns:soap="${SOAP_NS}"><soap:Body><soap:Fault><faultstring>QZ\u200bJV</faultstring></soap:Fault></soap:Body></soap:Envelope>`],
      ["xml", soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>QZ&#8203;JV</XMLout><SuppMsgOut>ok</SuppMsgOut>")],
      ["supp", soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>logs</XMLout><SuppMsgOut>QZ\u200cJV</SuppMsgOut>")],
      ["version", soap("WMLS_GetVersion", "<Result>1.4\u200d.1.1</Result>")],
      ["numeric", soap("WMLS_GetFromStore", "<Result>1&#8203;</Result><XMLout>logs</XMLout>")],
      ["word-joiner", soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>QZ\u2060JV</XMLout>")],
      ["bom", soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>QZ\ufeffJV</XMLout>")],
    ];
    for (const [name, text] of forms) {
      const impl = fakeHttps({ text });
      const out = await read(await enforceMachinePolicy(makeReq({
        body: name === "version" ? postBody("WMLS_GetVersion") : postBody("WMLS_GetFromStore"),
        headers: { "x-witsml-authorization": header },
      }), depsFor(impl)));
      assert.notEqual(out.status, 200, name);
      assert.equal(out.body.reason, "format-character", name);
      assert.equal(out.body.credentialClass, undefined, name);
      assert.equal(out.raw.includes(password), false, name);
      assert.equal(out.raw.includes("echo"), false, name);
      assert.equal(out.body.xml, undefined, name);
      assert.equal(out.body.version, undefined, name);
    }
  });

  test("a username that matches well identity is returned unchanged, while secret echoes are refused", async () => {
    const user = "rig-user-id";
    const password = "QZJV";
    const header = "Basic " + Buffer.from(user + ":" + password).toString("base64");
    const token = header.slice(6);
    const wells = `<wells xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><well uid="${user}"><name>${user}</name><operator>${user}</operator></well></wells>`;
    const okImpl = fakeHttps({ text: soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>" + wells.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</XMLout>") });
    const ok = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(okImpl)));
    assert.equal(ok.status, 200, ok.raw);
    assert.equal(ok.body.xml.includes(`uid="${user}"`), true);
    assert.equal(ok.body.xml.includes(`<name>${user}</name>`), true);
    assert.equal(ok.body.xml.includes(`<operator>${user}</operator>`), true);
    assert.equal(ok.body.xml.includes("[redacted]"), false);
    assert.equal(ok.raw.includes(password), false);
    assert.equal(ok.raw.includes(token), false);
    const secretXml = soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>&lt;name&gt;" + password + "&lt;/name&gt;</XMLout>");
    const secretImpl = fakeHttps({ text: secretXml });
    const secret = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(secretImpl)));
    assert.equal(secret.status, 200, secret.raw);
    assert.equal(secret.body.passwordRedacted, true);
    assert.equal(secret.body.xml, "<name>[redacted]</name>");
    assert.equal(secret.body.reason, undefined);
    assert.equal(secret.raw.includes(password), false);
    assert.equal(secret.raw.includes(user + ":" + password), false);
    const encodedXml = soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>" + token + "</XMLout>");
    const encodedImpl = fakeHttps({ text: encodedXml });
    const encoded = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(encodedImpl)));
    assert.equal(encoded.status, 502);
    assert.equal(encoded.body.reason, "credential-reflection");
    assert.equal(encoded.body.credentialClass, "basic");
    assert.equal(encoded.raw.includes(token), false);
    assert.equal(encoded.raw.includes("Basic " + token), false);
    const entity = "Q&#90;JV";
    const parsedImpl = fakeHttps({ text: soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>&lt;name&gt;" + entity + "&lt;/name&gt;</XMLout>") });
    const parsedEcho = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(parsedImpl)));
    assert.equal(parsedEcho.status, 200, parsedEcho.raw);
    assert.equal(parsedEcho.body.passwordRedacted, true);
    assert.equal(parsedEcho.body.xml, "<name>[redacted]</name>");
    assert.equal(parsedEcho.raw.includes(password), false);
    const keyImpl = fakeHttps({ text: soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>&lt;name&gt;" + CALLER_KEY + "&lt;/name&gt;</XMLout>") });
    const keyEcho = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(keyImpl)));
    assert.equal(keyEcho.status, 502);
    assert.equal(keyEcho.body.reason, "credential-reflection");
    assert.equal(keyEcho.body.credentialClass, "caller-key");
    assert.equal(keyEcho.raw.includes(CALLER_KEY), false);
    const bothImpl = fakeHttps({ text: soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>&lt;name&gt;" + password + "\u200b&lt;/name&gt;</XMLout>") });
    const both = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(bothImpl)));
    assert.equal(both.status, 502);
    assert.equal(both.body.reason, "format-character");
    assert.equal(both.body.credentialClass, undefined);
    assert.equal(both.body.xml, undefined);
    assert.equal(both.raw.includes(password), false);
    assert.equal(both.raw.includes(user), false);
  });

  test("credential class names overlaps and encoded echoes without changing the refusal", async () => {
    const user = "rig-user-id";
    const password = "QZJV";
    const rawPair = user + ":" + password;
    const header = "Basic " + Buffer.from(rawPair).toString("base64");
    const token = header.slice(6);
    const logs = [];
    const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
    for (const key of Object.keys(orig)) console[key] = (...args) => logs.push(args.map(String).join(" "));
    const forbidden = [password, rawPair, token, header, CALLER_KEY, user];
    try {
    const absent = (out, label) => {
      for (const secret of forbidden) assert.equal(out.raw.includes(secret), false, label + " " + secret);
      assert.equal(out.raw.includes("uid="), false, label);
      assert.equal(out.body.xml, undefined, label);
      assert.equal(out.body.supp, undefined, label);
    };
    const echo = async (inner, label) => {
      const impl = fakeHttps({ text: soap("WMLS_GetFromStore", inner) });
      const out = await read(await enforceMachinePolicy(makeReq({
        body: postBody("WMLS_GetFromStore"),
        headers: { "x-witsml-authorization": header },
      }), depsFor(impl)));
      assert.equal(out.status, 502, label + " " + out.raw);
      assert.equal(out.body.error, "upstream response refused", label);
      assert.equal(out.body.reason, "credential-reflection", label);
      absent(out, label);
      return out;
    };
    const passwordOnly = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(fakeHttps({ text: soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>&lt;name&gt;" + password + "&lt;/name&gt;</XMLout>") }))));
    assert.equal(passwordOnly.status, 200, passwordOnly.raw);
    assert.equal(passwordOnly.body.passwordRedacted, true);
    assert.equal(passwordOnly.body.xml, "<name>[redacted]</name>");
    assert.equal(passwordOnly.raw.includes(password), false);
    const pairOnly = await echo("<Result>1</Result><XMLout>&lt;name&gt;" + rawPair + "&lt;/name&gt;</XMLout>", "raw-pair");
    assert.equal(pairOnly.body.credentialClass, "password+raw-pair");
    const separate = await echo("<Result>1</Result><XMLout>&lt;name&gt;" + password + "&lt;/name&gt;&lt;operator&gt;" + rawPair + "&lt;/operator&gt;</XMLout>", "both");
    assert.equal(separate.body.credentialClass, "password+raw-pair");
    const tokenOnly = await echo("<Result>1</Result><XMLout>" + token + "</XMLout>", "token");
    assert.equal(tokenOnly.body.credentialClass, "basic");
    const headerOnly = await echo("<Result>1</Result><SuppMsgOut>Basic " + token + "</SuppMsgOut><XMLout>logs</XMLout>", "header");
    assert.equal(headerOnly.body.credentialClass, "basic");
    const keyOnly = await echo("<Result>1</Result><XMLout>&lt;name&gt;" + CALLER_KEY + "&lt;/name&gt;</XMLout>", "key");
    assert.equal(keyOnly.body.credentialClass, "caller-key");
    const keyAndPassword = await echo("<Result>1</Result><XMLout>&lt;name&gt;" + password + "&lt;/name&gt;&lt;operator&gt;" + CALLER_KEY + "&lt;/operator&gt;</XMLout>", "key-password");
    assert.equal(keyAndPassword.body.credentialClass, "caller-key+password");
    const all = await echo("<Result>1</Result><XMLout>&lt;name&gt;" + password + " " + rawPair + " " + token + " " + CALLER_KEY + "&lt;/name&gt;</XMLout>", "all");
    assert.equal(all.body.credentialClass, "basic+caller-key+password+raw-pair");
    const entity = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(fakeHttps({ text: soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>&lt;name&gt;Q&#90;JV&lt;/name&gt;</XMLout>") }))));
    assert.equal(entity.status, 200, entity.raw);
    assert.equal(entity.body.passwordRedacted, true);
    assert.equal(entity.body.xml, "<name>[redacted]</name>");
    assert.equal(entity.raw.includes(password), false);
    const tokenChar = token.charCodeAt(4);
    const tokenEncoded = token.slice(0, 4) + "&#" + tokenChar + ";" + token.slice(5);
    const headerEntity = await echo("<Result>1</Result><XMLout>" + tokenEncoded + "</XMLout>", "basic-entity");
    assert.equal(headerEntity.body.credentialClass, "basic");
    const kept = `<wells xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><well uid="${user}"><name>${user}</name><operator>${user}</operator></well></wells>`;
    const okImpl = fakeHttps({ text: soap("WMLS_GetFromStore", "<Result>1</Result><XMLout>" + kept.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</XMLout>") });
    const ok = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetFromStore"),
      headers: { "x-witsml-authorization": header },
    }), depsFor(okImpl)));
    assert.equal(ok.status, 200, ok.raw);
    assert.equal(ok.body.credentialClass, undefined);
    assert.equal(ok.body.xml.includes(`uid="${user}"`), true);
    const blob = logs.join("\n");
    for (const secret of forbidden) assert.equal(blob.includes(secret), false);
    } finally {
      Object.assign(console, orig);
    }
  });

  test("GetVersion accepts a spec version list and labels a bad list without echoing it", async () => {
    const list = "1.2.0.0,1.3.1.0,1.4.1.1";
    const impl = fakeHttps({ text: soap("WMLS_GetVersion", "<Result>" + list + "</Result>") });
    const out = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": AUTH },
    }), depsFor(impl)));
    assert.equal(out.status, 200, out.raw);
    assert.equal(out.body.version, list);
    assert.deepEqual(out.body.versions, ["1.2.0.0", "1.3.1.0", "1.4.1.1"]);
    const spaced = "1.4.1.1, 1.3.1.0";
    const bad = fakeHttps({ text: soap("WMLS_GetVersion", "<Result>" + spaced + "</Result><SuppMsgOut>VERSIONMARKER</SuppMsgOut>") });
    const rejected = await read(await enforceMachinePolicy(makeReq({
      body: postBody("WMLS_GetVersion"),
      headers: { "x-witsml-authorization": AUTH },
    }), depsFor(bad)));
    assert.equal(rejected.status, 502);
    assert.equal(rejected.body.error, "upstream response rejected");
    assert.equal(rejected.body.reason, "version-format");
    assert.equal(rejected.raw.includes(spaced), false);
    assert.equal(rejected.raw.includes("VERSIONMARKER"), false);
    assert.equal(rejected.body.version, undefined);
  });

  test("no real network from the review policy", () => {
    assert.equal(netCalls, 0);
  });
});
