import assert from "node:assert/strict";
import { inspect } from "node:util";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import https from "node:https";
import { after, test } from "node:test";
import { createMachineHandler } from "../netlify/lib/machine-handler.mjs";
import {
  adaptMachineResult,
  createReaderCall,
  machineRequestBody,
  negotiateMachine,
} from "../netlify/lib/machine-reader-adapter.mjs";

// The attached reader imports ./wdash_core.js?v=w2. That module is absent here.
// negotiate, pickVersion, capsFrom, and versionAdapter do not call it. The stub
// throws if one of those paths reaches it. This is not a frontend or game edit.
const stubUrl = new URL("./fixtures/wdash_core.js", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./wdash_core.js?v=w2") return { url: stubUrl.href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const readerUrl = new URL("./fixtures/rtoc_hist.js", import.meta.url);
const reader = await import(readerUrl.href);
const READER_SHA = "c8d57d4eced63728cd28c2c339fc9e82f874fc8c5c8a6476a28592b96d8569c8";

const KEY = "synthetic-not-real-caller-key-0123456789abcd";
const USER = "rig-user-id";
const PASS = "QZJV";
const AUTH = "Basic " + Buffer.from(USER + ":" + PASS).toString("base64");

const originalRequest = https.request;
const originalGet = https.get;
const originalFetch = globalThis.fetch;
https.request = () => { throw new Error("network forbidden"); };
https.get = () => { throw new Error("network forbidden"); };
globalThis.fetch = () => { throw new Error("network forbidden"); };
after(() => {
  https.request = originalRequest;
  https.get = originalGet;
  globalThis.fetch = originalFetch;
});

function envelope(inner) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
}

const ACTIONS = {
  version: '"http://www.witsml.org/action/120/Store.WMLS_GetVersion"',
  cap: '"http://www.witsml.org/action/120/Store.WMLS_GetCap"',
  store: '"http://www.witsml.org/action/120/Store.WMLS_GetFromStore"',
};

function fakeHttps(byAction) {
  const calls = [];
  return {
    calls,
    Agent: class { constructor(opts) { this.opts = { ...opts }; } destroy() {} },
    request(options, cb) {
      calls.push(options.headers.SOAPAction);
      const text = byAction[options.headers.SOAPAction];
      const req = {
        on() { return req; },
        write() { return true; },
        end() {
          const res = {
            statusCode: 200,
            headers: {},
            on(ev, fn) {
              if (ev === "data" && text) fn(Buffer.from(text));
              if (ev === "end") fn();
              return res;
            },
          };
          cb(res);
        },
        destroy() {},
      };
      return req;
    },
  };
}

let ip = 80;
function handlerInvoke(httpsImpl) {
  const handle = createMachineHandler({ httpsImpl, env: { WITSML_MACHINE_CALLER_SECRET: KEY } });
  const seen = [];
  const invoke = async (body, transport) => {
    seen.push(body);
    assert.equal(Object.hasOwn(body, "url"), false);
    assert.equal(JSON.stringify(body).includes(KEY), false);
    ip += 1;
    const req = new Request("https://machine.invalid/witsml-machine", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-witsml-machine-key": KEY,
        "x-witsml-authorization": AUTH,
        "x-nf-client-connection-ip": "203.0.113." + ip,
      },
      body: JSON.stringify(body),
      signal: transport && transport.signal,
    });
    const res = await handle(req);
    return res.json();
  };
  return { invoke, seen, handle };
}

function capXml(version, functions, extra) {
  const fn = functions.map((name) => `<function name="${name}"/>`).join("");
  const body = `<capServers version="${version}">${extra || ""}${fn}</capServers>`;
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return envelope(`<q1:WMLS_GetCapResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><CapabilitiesOut>${escaped}</CapabilitiesOut></q1:WMLS_GetCapResponse>`);
}

function versionXml(list) {
  return envelope(`<q1:WMLS_GetVersionResponse xmlns:q1="http://www.witsml.org/message/120"><Result>${list}</Result></q1:WMLS_GetVersionResponse>`);
}

const LOG13 = `<logs xmlns="http://www.witsml.org/schemas/1series" version="1.3.1.1"><log><indexCurve>DEPT</indexCurve><logCurveInfo><mnemonic>DEPT</mnemonic><unit>m</unit><columnIndex>1</columnIndex></logCurveInfo><logCurveInfo><mnemonic>GR</mnemonic><unit>gAPI</unit><columnIndex>2</columnIndex></logCurveInfo><logData><data>1,2</data></logData></log></logs>`;

function storeXml(xml) {
  const escaped = xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return envelope(`<q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${escaped}</XMLout></q1:WMLS_GetFromStoreResponse>`);
}

async function rejection(promise) {
  try {
    return { settled: "fulfilled", value: await promise };
  } catch (err) {
    let error = err;
    try { void err.message; } catch (inner) { error = inner; }
    return { settled: "rejected", error };
  }
}

function bindSignal(call, signal) {
  return (op, wmlType, query, options, extra) => call(op, wmlType, query, options, extra && extra.signal ? extra : { signal });
}

test("the fixture is the attached reader and its unused core is only a stub", () => {
  const bytes = readFileSync(readerUrl);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), READER_SHA);
  assert.equal(typeof reader.negotiate, "function");
  assert.equal(typeof reader.pickVersion, "function");
  assert.equal(typeof reader.capsFrom, "function");
  assert.equal(typeof reader.versionAdapter, "function");
  assert.deepEqual(reader.pickVersion("<Result>1.3.1.1,1.4.1.1</Result>"), {
    version: "1.4.1.1",
    offered: ["1.3.1.1", "1.4.1.1"],
    supported: true,
  });
});

test("stock negotiate still assumes 1.4.1.1 for an older transport, not for this adapter", async () => {
  const empty = await reader.negotiate(async () => ({ xml: "", supp: "" }));
  assert.equal(empty.version, "1.4.1.1");
  assert.equal(empty.supported, false);
  assert.match(empty.err, /GetVersion empty \(assuming 1\.4\.1\.1, unverified\)/);
  const thrown = await reader.negotiate(async () => { throw new Error("legacy down"); });
  assert.equal(thrown.version, "1.4.1.1");
  assert.match(thrown.err, /GetVersion failed: legacy down \(assuming 1\.4\.1\.1\)/);
  const legacyCap = await reader.negotiate(async (op) => {
    if (op === "WMLS_GetVersion") return "<Result>1.4.1.1</Result>";
    throw new Error("legacy cap down");
  });
  assert.equal(legacyCap.version, "1.4.1.1");
  assert.equal(legacyCap.maxReturnNodes, true);
  assert.equal(legacyCap.capRead, false);

  let calls = 0;
  const refused = createReaderCall(async () => {
    calls += 1;
    return { result: -1, error: "upstream response refused", reason: "credential-reflection", xml: PASS, supp: PASS };
  });
  const throughReader = await rejection(reader.negotiate(refused));
  assert.equal(throughReader.settled, "rejected");
  assert.equal(throughReader.error.code, "MACHINE_REFUSED");
  assert.equal(throughReader.error.reason, "credential-reflection");
  assert.equal(throughReader.error.version, undefined);
  assert.equal(String(throughReader.error.message).includes(PASS), false);
  assert.equal(String(throughReader.error.message).includes("assuming 1.4.1.1"), false);
  assert.equal(calls, 1);
});

test("actual negotiate, caps, and version adapter select 1.4 and 1.3 and keep a matching username", async () => {
  const wells = `<wells xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><well uid="${USER}"><name>${USER}</name><operator>${USER}</operator></well></wells>`;
  const https14 = fakeHttps({
    [ACTIONS.version]: versionXml("1.3.1.1,1.4.1.1"),
    [ACTIONS.cap]: capXml("1.4.1.1", ["WMLS_GetFromStore", "WMLS_GetCap"], "<maxReturnNodes/>"),
    [ACTIONS.store]: storeXml(wells),
  });
  const machine14 = handlerInvoke(https14);
  const call14 = createReaderCall(machine14.invoke);
  const neg14 = await negotiateMachine(reader.negotiate, call14);
  assert.equal(neg14.version, "1.4.1.1");
  assert.deepEqual(neg14.offered, ["1.3.1.1", "1.4.1.1"]);
  assert.equal(neg14.supported, true);
  assert.equal(neg14.maxReturnNodes, true);
  assert.equal(neg14.capRead, true);
  assert.deepEqual(neg14.functions, ["WMLS_GetFromStore", "WMLS_GetCap"]);
  assert.equal(reader.versionAdapter(call14, neg14), call14);
  const wellsOut = await call14("WMLS_GetFromStore", "well", "<wells/>", "returnElements=id-only");
  assert.equal(wellsOut.xml.includes(`uid="${USER}"`), true);
  assert.equal(wellsOut.xml.includes(`<name>${USER}</name>`), true);
  assert.equal(wellsOut.xml.includes(`<operator>${USER}</operator>`), true);
  assert.equal(wellsOut.xml.includes("[redacted]"), false);
  assert.equal(JSON.stringify(neg14).includes(KEY), false);
  assert.equal(JSON.stringify(wellsOut).includes(PASS), false);

  const https13 = fakeHttps({
    [ACTIONS.version]: versionXml("1.3.1.1,1.2.0.0"),
    [ACTIONS.cap]: capXml("1.3.1.1", ["WMLS_GetFromStore"]),
    [ACTIONS.store]: storeXml(LOG13),
  });
  const machine13 = handlerInvoke(https13);
  const call13 = createReaderCall(machine13.invoke);
  const neg13 = await negotiateMachine(reader.negotiate, call13);
  assert.equal(neg13.version, "1.3.1.1");
  assert.deepEqual(neg13.offered, ["1.3.1.1", "1.2.0.0"]);
  assert.equal(neg13.maxReturnNodes, false);
  assert.equal(reader.capsFrom("", "1.3.1.1").maxReturnNodes, false);
  const adapted = reader.versionAdapter(call13, neg13);
  assert.notEqual(adapted, call13);
  const query = `<logs xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><log uid="${USER}"/></logs>`;
  const got = await adapted("WMLS_GetFromStore", "log", query, "returnElements=all;maxReturnNodes=10");
  const sent = machine13.seen.at(-1);
  assert.equal(sent.query.includes('version="1.3.1.1"'), true);
  assert.equal(sent.query.includes('version="1.4.1.1"'), false);
  assert.equal(sent.query.includes(`uid="${USER}"`), true);
  assert.equal(sent.options.includes("maxReturnNodes"), false);
  assert.match(got.xml, /<mnemonicList>DEPT,GR<\/mnemonicList>/);
  assert.equal(https13.calls.length, 3);
});

test("refused and failed version, cap, and store calls do not become an assumed version", async () => {
  const refusedCap = createReaderCall(async (body) => {
    if (body.op === "WMLS_GetVersion") return { result: 1, version: "1.4.1.1" };
    return { result: -1, error: "upstream response refused", reason: "format-character", xml: PASS };
  });
  const capClosed = await rejection(negotiateMachine(reader.negotiate, refusedCap));
  assert.equal(capClosed.settled, "rejected");
  assert.equal(capClosed.error.code, "MACHINE_REFUSED");
  assert.equal(capClosed.error.op, "WMLS_GetCap");
  assert.equal(capClosed.error.reason, "format-character");
  assert.equal(capClosed.error.version, undefined);
  assert.equal(String(capClosed.error.message).includes(PASS), false);
  assert.equal(capClosed.value, undefined);

  const badVersion = createReaderCall(async () => ({ result: -1, error: "upstream response rejected", reason: "version-format" }));
  const versionClosed = await rejection(reader.negotiate(badVersion));
  assert.equal(versionClosed.settled, "rejected");
  assert.equal(versionClosed.error.code, "MACHINE_FAILED");
  assert.equal(versionClosed.error.op, "WMLS_GetVersion");
  assert.equal(versionClosed.error.version, undefined);

  const leaked = fakeHttps({ [ACTIONS.version]: versionXml(PASS) });
  const leakedMachine = handlerInvoke(leaked);
  const leakedCall = createReaderCall(leakedMachine.invoke);
  const leakedClosed = await rejection(reader.negotiate(leakedCall));
  assert.equal(leakedClosed.settled, "rejected");
  assert.equal(leakedClosed.error.code, "MACHINE_REFUSED");
  assert.equal(leakedClosed.error.reason, "credential-reflection");
  assert.equal(String(leakedClosed.error.message).includes(PASS), false);
  assert.equal(leaked.calls.length, 1);

  let storeCalls = 0;
  const store = createReaderCall(async () => {
    storeCalls += 1;
    return { result: -1, error: "upstream response refused", reason: "credential-reflection", xml: PASS };
  });
  const neg = { version: "1.3.1.1", maxReturnNodes: false, supported: true };
  const adapted = reader.versionAdapter(store, neg);
  const storeClosed = await rejection(adapted("WMLS_GetFromStore", "well", "<wells/>", "returnElements=id-only"));
  assert.equal(storeClosed.settled, "rejected");
  assert.equal(storeClosed.error.code, "MACHINE_REFUSED");
  assert.equal(String(storeClosed.error.message).includes(PASS), false);
  assert.equal(storeCalls, 1);
});

test("an already aborted or in-flight reader signal is not swallowed or retried", async () => {
  let calls = 0;
  const invoke = () => {
    calls += 1;
    return new Promise(() => {});
  };
  const call = createReaderCall(invoke);
  const early = new AbortController();
  early.abort();
  const already = await rejection(reader.negotiate(bindSignal(call, early.signal)));
  assert.equal(already.settled, "rejected");
  assert.equal(already.error.code, "ABORTED");
  assert.equal(already.error.version, undefined);
  assert.equal(calls, 0);

  calls = 0;
  const mid = new AbortController();
  const flight = reader.negotiate(bindSignal(createReaderCall(invoke), mid.signal));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  mid.abort();
  const aborted = await rejection(flight);
  assert.equal(aborted.settled, "rejected");
  assert.equal(aborted.error.code, "ABORTED");
  assert.equal(aborted.error.message, "WITSML request aborted");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);

  calls = 0;
  let releaseCap;
  const both = createReaderCall(async (body) => {
    calls += 1;
    if (body.op === "WMLS_GetVersion") return { result: 1, version: "1.4.1.1" };
    return new Promise((resolve, reject) => { releaseCap = { resolve, reject }; });
  });
  const capAbort = new AbortController();
  const pending = negotiateMachine(reader.negotiate, both, { signal: capAbort.signal });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  capAbort.abort();
  const capResult = await rejection(pending);
  assert.equal(capResult.settled, "rejected");
  assert.equal(capResult.error.code, "ABORTED");
  assert.equal(capResult.value, undefined);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  releaseCap.reject(new Error("late failure must not start another call"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
});

test("reader helpers still drop planted secrets and unknown refusal labels", async () => {
  const wells = `<wells><well uid="${USER}"><name>${USER}</name></well></wells>`;
  const planted = adaptMachineResult({
    result: 1,
    xml: wells,
    supp: "ok",
    machineKey: KEY,
    authorization: AUTH,
    version: "1.4.1.1",
  }, "WMLS_GetFromStore");
  assert.deepEqual(Object.keys(planted).sort(), ["result", "supp", "xml"]);
  assert.equal(planted.xml, wells);
  assert.equal(JSON.stringify(planted).includes(KEY), false);
  const failed = await rejection(Promise.resolve().then(() => adaptMachineResult({
    result: -1,
    reason: "username-collision",
    xml: wells,
    error: PASS,
  }, "WMLS_GetFromStore")));
  assert.equal(failed.settled, "rejected");
  assert.equal(failed.error.code, "MACHINE_FAILED");
  assert.equal(String(failed.error.message).includes(PASS), false);
  assert.equal(String(failed.error.message).includes(USER), false);
  const kept = adaptMachineResult({ result: 1, reason: "username-collision", xml: wells }, "WMLS_GetFromStore");
  assert.equal(kept.xml, wells);
  const partial = adaptMachineResult({ result: 2, xml: wells, supp: "" }, "WMLS_GetFromStore");
  assert.equal(partial.result, 2);
  assert.equal(partial.xml, wells);
  assert.deepEqual(machineRequestBody("WMLS_GetVersion", "well", "<x/>", "returnElements=all"), { op: "WMLS_GetVersion" });
  assert.deepEqual(machineRequestBody("WMLS_GetCap", "", "", "dataVersion=1.4.1.1"), { op: "WMLS_GetCap", options: "dataVersion=1.4.1.1" });
});


test("reader exposes only allow-listed refusal diagnostics", () => {
  assert.throws(() => adaptMachineResult({
    result: -1,
    reason: "credential-reflection",
    credentialClass: "password",
    matchSurface: "raw-body+decoded-xml",
    passwordXmlLocation: "well-name",
    xml: "<name>fixture-refused</name>",
  }, "WMLS_GetFromStore"), error => error.closed && error.credentialClass === "password" &&
    error.matchSurface === "raw-body+decoded-xml" && error.passwordXmlLocation === "well-name" &&
    !JSON.stringify(error).includes("fixture-refused"));

  assert.throws(() => adaptMachineResult({
    reason: "credential-reflection",
    credentialClass: "password+unknown-secret",
    matchSurface: "decoded-xml+unknown-secret",
    passwordXmlLocation: "well-name+unknown-secret",
  }, "WMLS_GetFromStore"), error => error.closed && !JSON.stringify(error).includes("unknown-secret") &&
    !error.credentialClass && !error.matchSurface && !error.passwordXmlLocation);
});

test("serialized adapter errors omit diagnostic names, labels, and short key collisions", () => {
  let err;
  assert.throws(() => adaptMachineResult({
    result: -1,
    reason: "credential-reflection",
    credentialClass: "password",
    matchSurface: "raw-body+decoded-xml",
    passwordXmlLocation: "well-name",
    xml: "<name>fixture-refused</name>",
  }, "WMLS_GetFromStore"), (error) => {
    err = error;
    return error.closed === true;
  });
  assert.equal(err.credentialClass, "password");
  assert.equal(err.matchSurface, "raw-body+decoded-xml");
  assert.equal(err.passwordXmlLocation, "well-name");
  assert.equal(err.reason, "credential-reflection");
  const packed = JSON.stringify(err);
  const shown = inspect(err, { showHidden: true, getters: true, depth: null });
  assert.equal(packed, "{}");
  assert.equal(shown, "{}");
  assert.equal(String(err), "");
  for (const secret of ["XmlL", "dXml", "Location", "XmlLocation", "well-name", "fixture-refused", "password", "raw-body"]) {
    assert.equal(packed.includes(secret), false, secret);
    assert.equal(shown.includes(secret), false, secret);
    assert.equal(String(err).includes(secret), false, secret);
    assert.equal(String(err.message).includes(secret), false, secret);
    assert.equal(String(err.stack).includes(secret), false, secret);
  }
});
