// Server-side mapping from a machine-route JSON result to the reader contract
// call(op, wmlType, query, options) -> { xml, result, supp }.
// The frozen reader negotiates from xml or supp, not from .version/.versions.
// This module is not an HTTP endpoint. It does not accept, store, or return a
// caller key, an Authorization header, or an upstream URL.
//
// Wiring gap: the reader that calls negotiate() lives in the browser. Pointing
// that page at this route would be a frontend change, and that page must not
// embed the machine key. This adapter stops at a server-side caller.

const VERSION_LIST = /^\d{1,2}(?:\.\d{1,4}){1,3}(?:,\d{1,2}(?:\.\d{1,4}){1,3}){0,7}$/;
const REFUSAL_REASONS = new Set([
  "credential-reflection",
  "format-character",
  "credential-reflection-and-format-character",
]);

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function resultCode(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : -1;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function withReason(out, machine) {
  const reason = machine && machine.reason;
  if (typeof reason === "string" && REFUSAL_REASONS.has(reason)) out.reason = reason;
  return out;
}

export function adaptMachineResult(machine, op) {
  const result = resultCode(machine && machine.result);
  const reason = machine && machine.reason;
  if (typeof reason === "string" && REFUSAL_REASONS.has(reason)) {
    return { result, xml: "", supp: "", reason };
  }
  const supp = text(machine && machine.supp);
  const xml = text(machine && machine.xml);
  if (op === "WMLS_GetVersion") {
    const version = text(machine && machine.version);
    if (!VERSION_LIST.test(version)) return withReason({ result, xml: "", supp: "" }, machine);
    return withReason({ result, xml: "<Result>" + esc(version) + "</Result>", supp: supp || version }, machine);
  }
  return withReason({ result, xml, supp }, machine);
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

export function createReaderCall(invoke) {
  return async function call(op, wmlType, query, options) {
    const body = machineRequestBody(op, wmlType, query, options);
    const machine = await invoke(body);
    return adaptMachineResult(machine, op);
  };
}
