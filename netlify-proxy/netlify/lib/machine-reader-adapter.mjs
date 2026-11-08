// Server-side mapping from a machine-route JSON result onto the reader contract
// call(op, wmlType, query, options, transport?) -> { xml, result, supp }.
// transport is the optional { signal } argument the frozen reader already passes.
// This module is not an HTTP endpoint. It does not accept, store, or return a
// caller key, an Authorization header, or an upstream URL.
//
// The frozen negotiate() assumes 1.4.1.1 when GetVersion throws or when xml and
// supp are both empty, and it swallows a GetCap failure. Those assumptions stay
// in the reader for an older transport. This adapter does not return that empty
// success shape. A refused or failed GetVersion throws MachineCallClosed with
// escape set, so the reader's GetVersion catch cannot finish the assumption
// string. negotiateMachine() is the cap and store gate: a refused GetCap is
// swallowed by the reader, and this function throws that refusal away instead
// of keeping the assumed capabilities. Store failures throw from call() itself.
// There is no retry.
//
// Wiring gap: negotiate() still lives in the browser reader. This module does
// not import that file. A server caller passes negotiate in. Pointing the page
// at this route would be a frontend change, and that page must not embed the
// machine key.

const VERSION_LIST = /^\d{1,2}(?:\.\d{1,4}){1,3}(?:,\d{1,2}(?:\.\d{1,4}){1,3}){0,7}$/;
const MATCH_SURFACES = new Set([
  "raw-body", "decoded-xml", "supp-message", "fault", "result", "response-json", "ambiguous",
]);
const MATCH_CLASSES = new Set(["basic", "password", "raw-pair", "caller-key", "ambiguous"]);
const MATCH_LOCATIONS = new Set([
  "namespace-uri", "well-uid", "well-name", "well-field", "well-country",
  "wellbore-identity", "credential-element", "credential-attribute", "log-data",
  "other-attribute", "other-text", "unclassified-xml",
]);
function allowLabels(value, allowed) {
  if (typeof value !== "string" || value.length > 240) return "";
  return value.split("+").every(label => allowed.has(label)) ? value : "";
}
const REFUSAL_REASONS = new Set([
  "credential-reflection",
  "format-character",
  "credential-reflection-and-format-character",
]);

export class MachineCallClosed extends Error {
  constructor(op, code, reason, options = {}) {
    const detail = reason ? ": " + reason : "";
    super("machine call closed" + detail);
    this.name = "MachineCallClosed";
    this.code = code;
    this.op = op;
    this.reason = reason || "";
    this.closed = true;
    this.credentialClass = allowLabels(options.credentialClass, MATCH_CLASSES);
    this.matchSurface = allowLabels(options.matchSurface, MATCH_SURFACES);
    this.passwordXmlLocation = allowLabels(options.passwordXmlLocation, MATCH_LOCATIONS);
    if (options.escape) {
      this.escape = true;
      const revealed = new MachineCallClosed(op, code, reason, { ...options, escape: false });
      Object.defineProperty(this, "message", {
        get() { throw revealed; },
      });
    }
  }
}

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function resultCode(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

export function signalFrom(transport) {
  if (!transport || typeof transport !== "object") return undefined;
  if (typeof transport.aborted === "boolean" && typeof transport.addEventListener === "function") return transport;
  const signal = transport.signal;
  if (signal && typeof signal === "object" && typeof signal.aborted === "boolean") return signal;
  return undefined;
}

export function abortError(cause, escape) {
  const err = new Error("WITSML request aborted");
  err.name = "AbortError";
  err.code = "ABORTED";
  if (cause !== undefined) err.cause = cause;
  if (escape) {
    err.escape = true;
    const revealed = abortError(cause, false);
    Object.defineProperty(err, "message", {
      get() { throw revealed; },
    });
  }
  return err;
}

function throwIfAborted(signal, escape) {
  if (signal && signal.aborted) throw abortError(signal.reason, escape);
}

function close(op, code, reason, escape, diagnostic = {}) {
  throw new MachineCallClosed(op, code, reason, { ...diagnostic, escape: !!escape });
}

export function revealClosed(err) {
  if (err && err.escape && err.code === "ABORTED") return abortError(err.cause, false);
  if (err && err.escape) return new MachineCallClosed(err.op, err.code, err.reason, {
    credentialClass: err.credentialClass, matchSurface: err.matchSurface, passwordXmlLocation: err.passwordXmlLocation,
  });
  return err;
}

export function adaptMachineResult(machine, op) {
  const operation = op || "WMLS_GetFromStore";
  const reason = machine && typeof machine.reason === "string" ? machine.reason : "";
  const result = resultCode(machine && machine.result);
  if (REFUSAL_REASONS.has(reason)) close(operation, "MACHINE_REFUSED", reason, operation === "WMLS_GetVersion", {
    credentialClass: machine.credentialClass, matchSurface: machine.matchSurface, passwordXmlLocation: machine.passwordXmlLocation,
  });
  if (operation === "WMLS_GetVersion") {
    const version = text(machine && machine.version);
    if (result !== 1 || !VERSION_LIST.test(version)) close(operation, "MACHINE_FAILED", "", true);
    return { result: 1, xml: "<Result>" + esc(version) + "</Result>", supp: version };
  }
  const xml = text(machine && machine.xml);
  const supp = text(machine && machine.supp);
  if (operation === "WMLS_GetCap") {
    if (result !== 1 || (!xml.trim() && !supp.trim())) close(operation, "MACHINE_FAILED", "", false);
    return { result, xml, supp };
  }
  if (result !== 1 && result !== 2) close(operation, "MACHINE_FAILED", "", false);
  return { result, xml, supp };
}

export function machineRequestBody(op, wmlType, query, options) {
  if (op === "WMLS_GetVersion") return { op };
  if (op === "WMLS_GetCap") {
    const body = { op };
    if (typeof options === "string" && options.length > 0) body.options = options;
    return body;
  }
  if (op === "WMLS_GetFromStore") {
    const body = { op, wmlType, query };
    if (typeof options === "string" && options.length > 0) body.options = options;
    return body;
  }
  return { op };
}

function raceSignal(pending, signal, escape) {
  const guarded = Promise.resolve(pending);
  if (!signal) return guarded;
  const ignored = guarded.then(() => {}, () => {});
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal.reason, escape));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    guarded.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
      return ignored;
    });
  });
}

export function createReaderCall(invoke) {
  if (typeof invoke !== "function") throw new Error("machine invoke required");
  return async function call(op, wmlType, query, options, transport) {
    const signal = signalFrom(transport);
    const escape = op === "WMLS_GetVersion";
    throwIfAborted(signal, escape);
    const body = machineRequestBody(op, wmlType, query, options);
    const machine = await raceSignal(invoke(body, { signal }), signal, escape);
    throwIfAborted(signal, escape);
    return adaptMachineResult(machine, op);
  };
}

export async function negotiateMachine(negotiate, call, transport) {
  if (typeof negotiate !== "function" || typeof call !== "function") {
    throw new MachineCallClosed("WMLS_GetVersion", "MACHINE_FAILED");
  }
  const signal = signalFrom(transport);
  throwIfAborted(signal, false);
  let gv;
  try {
    gv = await call("WMLS_GetVersion", "", "", "", transport);
  } catch (err) {
    throw revealClosed(err);
  }
  let capError = null;
  const delegated = async (op, wmlType, query, options, extra) => {
    const next = signalFrom(extra) ? extra : transport;
    throwIfAborted(signalFrom(next) || signal, false);
    if (op === "WMLS_GetVersion") return gv;
    try {
      return await call(op, wmlType, query, options, next);
    } catch (err) {
      const revealed = revealClosed(err);
      if (op === "WMLS_GetCap" || (revealed && revealed.code === "ABORTED")) capError = revealed;
      throw revealed;
    }
  };
  const neg = await negotiate(delegated);
  throwIfAborted(signal, false);
  if (capError) throw capError;
  if (!neg || neg.supported !== true || typeof neg.version !== "string" || /assuming 1\.4\.1\.1/.test(String(neg.err || ""))) {
    throw new MachineCallClosed("WMLS_GetVersion", "MACHINE_FAILED");
  }
  if (neg.capRead !== true) throw new MachineCallClosed("WMLS_GetCap", "MACHINE_FAILED");
  return neg;
}
