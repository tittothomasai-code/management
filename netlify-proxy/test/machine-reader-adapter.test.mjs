import assert from "node:assert/strict";
import https from "node:https";
import { after, test } from "node:test";
import { createMachineHandler } from "../netlify/lib/machine-handler.mjs";
import { adaptMachineResult, createReaderCall, machineRequestBody } from "../netlify/lib/machine-reader-adapter.mjs";

const KEY = "synthetic-not-real-caller-key-0123456789abcd";
const USER = "rig-user-id";
const PASS = "secret-pass-99";
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

function fakeHttps(byAction) {
  return {
    Agent: class { constructor(opts) { this.opts = { ...opts }; } destroy() {} },
    request(options, cb) {
      const action = options.headers.SOAPAction;
      const text = byAction[action];
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

function envelope(inner) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
}

const ACTIONS = {
  version: '"http://www.witsml.org/action/120/Store.WMLS_GetVersion"',
  cap: '"http://www.witsml.org/action/120/Store.WMLS_GetCap"',
  store: '"http://www.witsml.org/action/120/Store.WMLS_GetFromStore"',
};

function pickVersion(getVersionXml) {
  const raw = String(getVersionXml || "");
  const match = raw.match(/<(?:\w+:)?Result[^>]*>([^<]*)</);
  const list = (match ? match[1] : raw).split(/[,\s]+/).map((v) => v.trim()).filter((v) => /^\d+(\.\d+)+$/.test(v));
  const versions = ["1.4.1.1", "1.3.1.1"];
  const version = versions.find((item) => list.includes(item)) || null;
  return { version, offered: list, supported: !!version };
}

test("reader adapter maps machine results onto the negotiate contract without a caller key", async () => {
  const wells = `<wells xmlns="http://www.witsml.org/schemas/1series" version="1.4.1.1"><well uid="${USER}"><name>${USER}</name><operator>${USER}</operator></well></wells>`;
  const httpsImpl = fakeHttps({
    [ACTIONS.version]: envelope('<q1:WMLS_GetVersionResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1.3.1.1,1.4.1.1</Result></q1:WMLS_GetVersionResponse>'),
    [ACTIONS.cap]: envelope('<q1:WMLS_GetCapResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><CapabilitiesOut>&lt;capServers&gt;&lt;function name="WMLS_GetFromStore"/&gt;&lt;/capServers&gt;</CapabilitiesOut></q1:WMLS_GetCapResponse>'),
    [ACTIONS.store]: envelope('<q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>' + wells.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</XMLout></q1:WMLS_GetFromStoreResponse>"),
  });
  const handle = createMachineHandler({ httpsImpl, env: { WITSML_MACHINE_CALLER_SECRET: KEY } });
  const call = createReaderCall(async (body) => {
    assert.equal(Object.hasOwn(body, "url"), false);
    assert.equal(JSON.stringify(body).includes(KEY), false);
    const req = new Request("https://machine.invalid/witsml-machine", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-witsml-machine-key": KEY,
        "x-witsml-authorization": AUTH,
        "x-nf-client-connection-ip": "203.0.113.70",
      },
      body: JSON.stringify(body),
    });
    const res = await handle(req);
    return res.json();
  });
  const version = await call("WMLS_GetVersion", "", "", "");
  const picked = pickVersion(version.xml || version.supp);
  assert.equal(picked.version, "1.4.1.1");
  assert.deepEqual(picked.offered, ["1.3.1.1", "1.4.1.1"]);
  const cap = await call("WMLS_GetCap", "", "", "dataVersion=" + picked.version);
  assert.match(cap.xml, /name="WMLS_GetFromStore"/);
  const wellsOut = await call("WMLS_GetFromStore", "well", "<wells/>", "returnElements=id-only");
  assert.equal(wellsOut.xml.includes(`uid="${USER}"`), true);
  assert.equal(wellsOut.xml.includes(`<name>${USER}</name>`), true);
  assert.equal(wellsOut.xml.includes("[redacted]"), false);
  const packed = JSON.stringify({ version, cap, wellsOut });
  assert.equal(packed.includes(KEY), false);
  assert.equal(packed.includes(PASS), false);
  assert.equal(packed.includes(AUTH), false);
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
  const refused = adaptMachineResult({
    result: -1,
    error: "upstream response refused",
    reason: "credential-reflection",
    xml: PASS,
    supp: PASS,
    machineKey: KEY,
    authorization: AUTH,
  }, "WMLS_GetFromStore");
  assert.deepEqual(refused, { result: -1, xml: "", supp: "", reason: "credential-reflection" });
  assert.equal(JSON.stringify(refused).includes(PASS), false);
  const invented = adaptMachineResult({ result: -1, reason: "username-collision", xml: wells }, "WMLS_GetFromStore");
  assert.equal(Object.hasOwn(invented, "reason"), false);
  assert.equal(invented.xml, wells);
  assert.deepEqual(machineRequestBody("WMLS_GetVersion", "well", "<x/>", "returnElements=all"), { op: "WMLS_GetVersion" });
  assert.deepEqual(machineRequestBody("WMLS_GetCap", "", "", "dataVersion=1.4.1.1"), { op: "WMLS_GetCap", options: "dataVersion=1.4.1.1" });
});
