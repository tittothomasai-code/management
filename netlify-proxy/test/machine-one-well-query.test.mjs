// Offline evidence only. The published machine route is not modified.
// Synthetic ids stand in for a well already known to Operations. This does not
// show why a global id-only list was refused, and it does not change the
// password or the whole-response credential check.
import assert from "node:assert/strict";
import https from "node:https";
import { after, test } from "node:test";
import { createVerifiedDispatch, enforceMachinePolicy } from "../netlify/lib/machine-policy.mjs";

const NS = "http://www.witsml.org/schemas/1series";
const WELL = "SYNTH-WELL-1";
const OTHER = "SYNTH-OTHER-9";
const WB = "SYNTH-WB-1";
const LOG_UID = "SYNTH-LOG-1";
const TRAJ = "SYNTH-TRAJ-1";
const PASSWORD = "secret-pass-99";
const USER = "rig-user-id";
const KEY = "synthetic-not-real-caller-key-0123456789abcd";
const AUTH = "Basic " + Buffer.from(USER + ":" + PASSWORD).toString("base64");
const TOKEN = AUTH.slice(6);

const QUERIES = {
  wellId: {
    wmlType: "well",
    query: `<wells xmlns="${NS}" version="1.4.1.1"><well uid="${WELL}"/></wells>`,
    options: "returnElements=id-only;maxReturnNodes=1",
  },
  wellHeader: {
    wmlType: "well",
    query: `<wells xmlns="${NS}" version="1.4.1.1"><well uid="${WELL}"><name/><field/><country/></well></wells>`,
    options: "returnElements=requested;maxReturnNodes=1",
  },
  wellbore: {
    wmlType: "wellbore",
    query: `<wellbores xmlns="${NS}" version="1.4.1.1"><wellbore uidWell="${WELL}" uid="${WB}"/></wellbores>`,
    options: "returnElements=id-only;maxReturnNodes=1",
  },
  log: {
    wmlType: "log",
    query: `<logs xmlns="${NS}" version="1.4.1.1"><log uidWell="${WELL}" uidWellbore="${WB}" uid="${LOG_UID}"/></logs>`,
    options: "returnElements=header-only;maxReturnNodes=1",
  },
  trajectory: {
    wmlType: "trajectory",
    query: `<trajectorys xmlns="${NS}" version="1.4.1.1"><trajectory uidWell="${WELL}" uidWellbore="${WB}" uid="${TRAJ}"/></trajectorys>`,
    options: "returnElements=id-only;maxReturnNodes=1",
  },
};

const originalRequest = https.request;
const originalGet = https.get;
const originalFetch = globalThis.fetch;
let netCalls = 0;
https.request = () => { netCalls += 1; throw new Error("network forbidden"); };
https.get = () => { netCalls += 1; throw new Error("network forbidden"); };
globalThis.fetch = () => { netCalls += 1; throw new Error("network forbidden"); };
after(() => {
  https.request = originalRequest;
  https.get = originalGet;
  globalThis.fetch = originalFetch;
});

function fakeHttps(text) {
  const calls = [];
  return {
    calls,
    Agent: class {
      constructor(opts) { this.opts = { ...opts }; }
      destroy() {}
    },
    request(_options, cb) {
      const rec = { body: "" };
      calls.push(rec);
      const req = {
        on() { return req; },
        write(chunk) { rec.body += chunk; return true; },
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

function deps(impl) {
  return {
    callerSecret: KEY,
    dispatch: createVerifiedDispatch(impl, {
      schedule(fn, ms) { return { fn, ms, cleared: false }; },
      cancel(handle) { if (handle) handle.cleared = true; },
    }),
    now: () => 5000,
  };
}

let seq = 0;
function post(body) {
  seq += 1;
  return new Request("https://machine.invalid/witsml-machine", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-witsml-machine-key": KEY,
      "x-witsml-authorization": AUTH,
      "x-nf-client-connection-ip": "203.0.113." + (20 + seq),
    },
    body: JSON.stringify(body),
  });
}

function store(xml) {
  const escaped = xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body><q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${escaped}</XMLout></q1:WMLS_GetFromStoreResponse></soap:Body></soap:Envelope>`;
}

function wellXml(uid, name) {
  return `<wells xmlns="${NS}" version="1.4.1.1"><well uid="${uid}"><name>${name}</name></well></wells>`;
}

async function read(res) {
  const raw = await res.text();
  return { status: res.status, raw, body: JSON.parse(raw) };
}

function sentQuery(impl) {
  const bodies = impl.calls.map((call) => call.body);
  assert.equal(bodies.length, 1);
  return bodies[0];
}

test("the existing validator accepts one exact-uid read and does not ask for another well", async () => {
  const clean = wellXml(WELL, "Synth North");
  for (const [name, query] of Object.entries(QUERIES)) {
    const impl = fakeHttps(store(clean));
    const out = await read(await enforceMachinePolicy(post({ op: "WMLS_GetFromStore", ...query }), deps(impl)));
    const body = sentQuery(impl);
    assert.equal(out.status, 200, name + " " + out.raw);
    assert.equal(body.includes("WMLS_GetFromStore"), true, name);
    assert.equal(body.includes(WELL), true, name);
    assert.equal(body.includes(OTHER), false, name);
    assert.equal(body.includes(query.options), true, name);
    assert.equal(body.includes("maxReturnNodes=100"), false, name);
    assert.equal(body.includes(KEY), false, name);
    assert.equal(body.includes(PASSWORD), false, name);
  }
  const broad = fakeHttps(store(clean));
  const open = {
    op: "WMLS_GetFromStore",
    wmlType: "well",
    query: `<wells xmlns="${NS}" version="1.4.1.1"><well/></wells>`,
    options: "returnElements=id-only;maxReturnNodes=1",
  };
  const accepted = await read(await enforceMachinePolicy(post(open), deps(broad)));
  assert.equal(accepted.status, 200);
  assert.equal(sentQuery(broad).includes(`uid=&quot;${WELL}&quot;`), false);
  assert.equal(netCalls, 0);
});

test("a password in the target well id or name is still refused and not kept", async () => {
  const query = { op: "WMLS_GetFromStore", ...QUERIES.wellId };
  for (const xml of [wellXml(WELL, PASSWORD), wellXml(PASSWORD, "Synth North")]) {
    const impl = fakeHttps(store(xml));
    const out = await read(await enforceMachinePolicy(post(query), deps(impl)));
    assert.equal(out.status, 502);
    assert.equal(out.body.error, "upstream response refused");
    assert.equal(out.body.reason, "credential-reflection");
    assert.equal(out.body.credentialClass, "password");
    assert.equal(out.body.xml, undefined);
    assert.equal(out.raw.includes(PASSWORD), false);
    assert.equal(out.raw.includes(TOKEN), false);
    assert.equal(out.raw.includes(KEY), false);
    assert.equal(sentQuery(impl).includes(WELL), true);
    assert.equal(sentQuery(impl).includes(OTHER), false);
    assert.equal(impl.calls.length, 1);
  }
  const mixed = wellXml(WELL, "Synth North").replace("</wells>", "") + wellXml(OTHER, PASSWORD).replace(`<wells xmlns="${NS}" version="1.4.1.1">`, "");
  const impl = fakeHttps(store(mixed));
  const out = await read(await enforceMachinePolicy(post(query), deps(impl)));
  assert.equal(out.status, 502);
  assert.equal(out.body.credentialClass, "password");
  assert.equal(out.raw.includes(PASSWORD), false);
  assert.equal(out.raw.includes(WELL), false);
  assert.equal(out.raw.includes(OTHER), false);
  assert.equal(impl.calls.length, 1);
});

test("a returned uid the query did not request is not rejected by the current proxy", async () => {
  const query = { op: "WMLS_GetFromStore", ...QUERIES.wellId };
  const xml = wellXml(WELL, "Synth North").replace("</wells>", "") + `<well uid="${OTHER}"><name>Synth East</name></well></wells>`;
  const impl = fakeHttps(store(xml));
  const out = await read(await enforceMachinePolicy(post(query), deps(impl)));
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.xml.includes(`uid="${WELL}"`), true);
  assert.equal(out.body.xml.includes(`uid="${OTHER}"`), true);
  assert.equal(sentQuery(impl).includes(OTHER), false);
  assert.equal(impl.calls.length, 1);
  assert.equal(netCalls, 0);
});
