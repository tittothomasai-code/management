// Socket-blocked checks for value-free redaction slots. Synthetic data only.
import assert from "node:assert/strict";
import https from "node:https";
import { after, test } from "node:test";
import { createVerifiedDispatch, enforceMachinePolicy } from "../netlify/lib/machine-policy.mjs";
import { adaptMachineResult } from "../netlify/lib/machine-reader-adapter.mjs";
import { redactedRanges, slotsMatchDocument } from "../netlify/lib/redaction-slots.mjs";

const USER = "rig-user-id";
const KEY = "synthetic-not-real-caller-key-0123456789abcd";
let netCalls = 0;
https.request = () => { netCalls += 1; throw new Error("network forbidden"); };
https.get = () => { netCalls += 1; throw new Error("network forbidden"); };
globalThis.fetch = () => { netCalls += 1; throw new Error("network forbidden"); };
after(() => { assert.equal(netCalls, 0); });

function authFor(password) {
  return "Basic " + Buffer.from(USER + ":" + password).toString("base64");
}
function fakeHttps(text) {
  return {
    Agent: class { constructor(opts) { this.opts = { ...opts }; } destroy() {} },
    request(_options, cb) {
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
let seq = 0;
async function call(innerXml, password) {
  seq += 1;
  const escaped = innerXml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body><q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>${escaped}</XMLout></q1:WMLS_GetFromStoreResponse></soap:Body></soap:Envelope>`;
  const res = await enforceMachinePolicy(new Request("https://machine.invalid/witsml-machine", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-witsml-machine-key": KEY,
      "x-witsml-authorization": authFor(password),
      "x-nf-client-connection-ip": "203.0.113." + (seq % 200 + 1),
    },
    body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "well", query: "<wells/>", options: "returnElements=id-only" }),
  }), {
    callerSecret: KEY,
    dispatch: createVerifiedDispatch(fakeHttps(text), { schedule(fn, ms) { return { fn, ms }; }, cancel() {} }),
    now: () => 1,
  });
  const raw = await res.text();
  return { status: res.status, raw, body: JSON.parse(raw) };
}

function hidden(raw, secrets) {
  for (const secret of secrets) assert.equal(raw.includes(secret), false, secret);
}

test("well uid redaction names only that slot and keeps the other fields", async () => {
  const password = "WELL-UID-7";
  const out = await call(`<wells xmlns="http://www.witsml.org/schemas/1series"><well uid="${password}"><name>Synth North</name><num>1500</num></well></wells>`, password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.redactionScope, "slots");
  assert.deepEqual(out.body.redactedSlots, ["well-uid/1"]);
  assert.equal(out.body.xml.includes('uid="***"'), true);
  assert.equal(out.body.xml.includes("<name>Synth North</name>"), true);
  assert.equal(out.body.xml.includes("<num>1500</num>"), true);
  hidden(out.raw, [password]);
  const ranges = redactedRanges(out.body.xml, out.body.redactedSlots);
  assert.equal(ranges.length, 1);
  assert.equal(out.body.xml.slice(ranges[0].start, ranges[0].end), "***");
  assert.equal(out.body.xml.includes("Synth North"), true);
  const adapted = adaptMachineResult(out.body, "WMLS_GetFromStore");
  assert.deepEqual(adapted.redactedSlots, ["well-uid/1"]);
  assert.equal(adapted.xml.includes("1500"), true);
});

test("a redacted log row is the whole data text and the other row stays", async () => {
  const password = "ROWSECRET";
  const out = await call(`<logs><logData><data>10,20</data><data>${password},5</data></logData></logs>`, password);
  assert.equal(out.status, 200, out.raw);
  assert.deepEqual(out.body.redactedSlots, ["log-data/2"]);
  assert.equal(out.body.xml.includes("<data>10,20</data>"), true);
  assert.equal(out.body.xml.includes("<data>***,5</data>"), true);
  assert.equal(out.body.xml.includes(password), false);
  const ranges = redactedRanges(out.body.xml, out.body.redactedSlots);
  assert.equal(out.body.xml.slice(ranges[0].start, ranges[0].end).includes("10,20"), false);
  hidden(out.raw, [password]);
});

test("other text, comments, and attribute values get separate slots", async () => {
  const password = "MARK-77";
  const xml = `<wells><well uid="KEEP"><!-- ${password} --><operator>${password}</operator><note note="${password}">plain</note></well></wells>`;
  const out = await call(xml, password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.redactionScope, "slots");
  assert.deepEqual(out.body.redactedSlots, ["comment/1", "text/1", "attribute-value/1"]);
  assert.equal(out.body.xml.includes('uid="KEEP"'), true);
  assert.equal(out.body.xml.includes(">plain<"), true);
  hidden(out.raw, [password]);
  const ranges = redactedRanges(out.body.xml, out.body.redactedSlots);
  assert.equal(ranges.length, 3);
  assert.equal(ranges.every((range) => out.body.xml.slice(range.start, range.end).includes(password)), false);
});

test("a preexisting star marker is not listed as a redaction", async () => {
  const password = "ONLY-NAME";
  const out = await call(`<wells><well uid="KEEP"><name>${password}</name><num>***</num></well></wells>`, password);
  assert.equal(out.status, 200, out.raw);
  assert.deepEqual(out.body.redactedSlots, ["well-name/1"]);
  assert.equal(out.body.xml.includes("<num>***</num>"), true);
  assert.equal(out.body.xml.includes("<name>***</name>"), true);
  const ranges = redactedRanges(out.body.xml, out.body.redactedSlots);
  assert.equal(ranges.length, 1);
  const nameStart = out.body.xml.indexOf("<name>");
  const nameEnd = out.body.xml.indexOf("</name>");
  const numStart = out.body.xml.indexOf("<num>");
  assert.equal(ranges[0].start > nameStart && ranges[0].end <= nameEnd, true);
  assert.equal(ranges[0].start > numStart, false);
  assert.equal(out.body.xml.slice(numStart, out.body.xml.indexOf("</num>")), "<num>***");
});

test("only the namespace that contained the password is listed", async () => {
  const password = "NS-SECRET";
  const out = await call(`<wells xmlns="http://www.witsml.org/schemas/1series"><well xmlns:g="urn:${password}" uid="KEEP"><name>North</name></well></wells>`, password);
  assert.equal(out.status, 200, out.raw);
  assert.deepEqual(out.body.redactedSlots, ["namespace-uri/2"]);
  assert.equal(out.body.xml.includes('xmlns="http://www.witsml.org/schemas/1series"'), true);
  assert.equal(out.body.xml.includes('uid="KEEP"'), true);
  assert.equal(out.body.xml.includes("<name>North</name>"), true);
  hidden(out.raw, [password]);
});

test("two wells list only the redacted uid", async () => {
  const password = "SECOND-UID";
  const out = await call(`<wells><well uid="KEEP-1"><name>Alpha</name></well><well uid="${password}"><name>Beta</name></well></wells>`, password);
  assert.equal(out.status, 200, out.raw);
  assert.deepEqual(out.body.redactedSlots, ["well-uid/2"]);
  assert.equal(out.body.xml.includes('uid="KEEP-1"'), true);
  assert.equal(out.body.xml.includes("<name>Alpha</name>"), true);
  assert.equal(out.body.xml.includes("<name>Beta</name>"), true);
  assert.equal(out.body.xml.includes(password), false);
  hidden(JSON.stringify(out.body.redactedSlots), [password, "KEEP-1", "Alpha", "Beta"]);
});

test("an attribute name redaction withholds the document", async () => {
  const password = "ATTRNAME";
  const out = await call(`<wells><well ${password}="1" uid="KEEP"><name>North</name></well></wells>`, password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.redactionScope, "response");
  assert.equal(out.body.xml, undefined);
  assert.equal(out.body.redactedSlots, undefined);
  hidden(out.raw, [password, "KEEP", "North"]);
});

test("too many redacted rows withhold the document instead of a partial map", async () => {
  const password = "ROW-MARK";
  const rows = Array.from({ length: 1025 }, () => `<data>${password}</data>`).join("");
  const out = await call(`<logs><logData>${rows}</logData></logs>`, password);
  assert.equal(out.status, 200, out.raw);
  assert.equal(out.body.passwordRedacted, true);
  assert.equal(out.body.redactionScope, "response");
  assert.equal(out.body.redactionFailure, "slot-limit");
  assert.equal(out.body.xml, undefined);
  assert.equal(out.body.redactedSlots, undefined);
  hidden(out.raw, [password]);
});

test("a slot token that would contain the password withholds the document", async () => {
  const password = "supp/1";
  const text = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:q1="http://www.witsml.org/message/120"><soap:Body><q1:WMLS_GetFromStoreResponse xmlns:q1="http://www.witsml.org/message/120"><Result>1</Result><XMLout>&lt;wells&gt;&lt;well uid="KEEP"/&gt;&lt;/wells&gt;</XMLout><SuppMsgOut>${password}</SuppMsgOut></q1:WMLS_GetFromStoreResponse></soap:Body></soap:Envelope>`;
  const res = await enforceMachinePolicy(new Request("https://machine.invalid/witsml-machine", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-witsml-machine-key": KEY,
      "x-witsml-authorization": authFor(password),
      "x-nf-client-connection-ip": "203.0.113.77",
    },
    body: JSON.stringify({ op: "WMLS_GetFromStore", wmlType: "well", query: "<wells/>", options: "returnElements=id-only" }),
  }), {
    callerSecret: KEY,
    dispatch: createVerifiedDispatch(fakeHttps(text), { schedule(fn, ms) { return { fn, ms }; }, cancel() {} }),
    now: () => 1,
  });
  const raw = await res.text();
  const body = JSON.parse(raw);
  assert.equal(res.status, 200, raw);
  assert.equal(body.passwordRedacted, true);
  assert.equal(body.xml, undefined);
  assert.equal(body.redactedSlots, undefined);
  hidden(raw, [password]);
});

test("malformed slot lists and ordinal mismatches do not return the document", () => {
  const xml = `<wells><well uid="KEEP"><name>North</name></well></wells>`;
  assert.equal(slotsMatchDocument(xml, ["well-uid/2"]), false);
  assert.equal(slotsMatchDocument(xml, ["well-uid/1", "well-name/1", "nope"]), false);
  assert.equal(slotsMatchDocument(xml, ["well-uid/1<script>"]), false);
  assert.equal(redactedRanges(xml, ["well-uid/2"]), null);
  assert.throws(() => adaptMachineResult({
    result: 1,
    xml,
    supp: "",
    passwordRedacted: true,
    redactionScope: "slots",
    redactedSlots: ["well-uid/2"],
  }, "WMLS_GetFromStore"), (err) => err.closed === true && err.code === "MACHINE_FAILED" && !JSON.stringify(err).includes("KEEP"));
  const kept = adaptMachineResult({
    result: 1,
    xml,
    supp: "",
    passwordRedacted: true,
    redactionScope: "slots",
    redactedSlots: ["well-uid/1"],
  }, "WMLS_GetFromStore");
  assert.equal(kept.xml, xml);
  assert.deepEqual(kept.redactedSlots, ["well-uid/1"]);
});
