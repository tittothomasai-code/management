// Value-free locations for password redaction.
// A slot is a fixed role plus a document-order ordinal: "well-uid/2".
// It never includes a name, namespace, path, or the removed text.
// Ordinals count every node of that role, so an unlisted ordinal is unchanged.
// element-name and attribute-name hits are structural: the reply must be
// withheld, because a rewritten name is not a stable field.
// "supp/1" and "fault/1" refer to those whole strings, not to XML nodes.
// More than MAX_REDACTION_SLOTS (1024) slots, an ordinal the document does not have, or a slot
// string that contains the password means the map is incomplete: withhold
// the document instead of guessing.

// 1024 so a multi-well id-only list (one well-name or well-uid slot per well) can be
// named instead of withheld. Ordinals stay within the 4-digit REDACTION_SLOT_RE.
export const MAX_REDACTION_SLOTS = 1024;

export const REDACTION_SLOT_RE = /^(?:attribute-value|comment|fault|log-data|namespace-uri|supp|text|well-country|well-field|well-name|well-uid|wellbore-identity)\/[1-9][0-9]{0,3}$/;

const STRUCTURAL = new Set(["attribute-name", "element-name"]);
// One placeholder on every route (game and machine): "[redacted]".
const VALUE_MARK = "[redacted]";
const NAME_MARK = "xx";

function localName(qualified) {
  const colon = String(qualified).lastIndexOf(":");
  return colon < 0 ? qualified : qualified.slice(colon + 1);
}

function roleFor(kind, elementLocal, parentLocal, attrName) {
  if (kind === "comment") return "comment";
  if (kind === "element-name") return "element-name";
  if (kind === "attribute-name") return "attribute-name";
  if (kind === "attribute-value") {
    if (attrName === "xmlns" || String(attrName).startsWith("xmlns:")) return "namespace-uri";
    const attrLocal = localName(attrName);
    if (elementLocal === "well" && attrLocal === "uid") return "well-uid";
    if (elementLocal === "wellbore" && (attrLocal === "uid" || attrLocal === "uidWell")) return "wellbore-identity";
    return "attribute-value";
  }
  if (parentLocal === "well" && elementLocal === "name") return "well-name";
  if (parentLocal === "well" && elementLocal === "field") return "well-field";
  if (parentLocal === "well" && elementLocal === "country") return "well-country";
  if (parentLocal === "logData" && elementLocal === "data") return "log-data";
  return "text";
}

function readStartTag(xml, lt, gt) {
  let i = lt + 1;
  while (i < gt && /\s/.test(xml[i])) i += 1;
  if (i >= gt) return null;
  const nameStart = i;
  while (i < gt && !/[\s/>]/.test(xml[i])) i += 1;
  const qualified = xml.slice(nameStart, i);
  if (!qualified) return null;
  const attrs = [];
  while (i < gt) {
    while (i < gt && /\s/.test(xml[i])) i += 1;
    if (i >= gt || xml[i] === "/") break;
    const attrStart = i;
    while (i < gt && xml[i] !== "=" && !/\s/.test(xml[i])) i += 1;
    if (attrStart === i) return null;
    const attrName = xml.slice(attrStart, i);
    while (i < gt && /\s/.test(xml[i])) i += 1;
    if (xml[i] !== "=") return null;
    i += 1;
    while (i < gt && /\s/.test(xml[i])) i += 1;
    const quote = xml[i];
    if (quote !== "\"" && quote !== "'") return null;
    i += 1;
    const valueStart = i;
    while (i < gt && xml[i] !== quote) i += 1;
    if (i >= gt) return null;
    attrs.push({ nameStart: attrStart, nameEnd: attrStart + attrName.length, attrName, valueStart, valueEnd: i });
    i += 1;
  }
  return { nameStart, nameEnd: nameStart + qualified.length, qualified, attrs };
}

export function scanRoleSpans(xml) {
  if (typeof xml !== "string") return null;
  const spans = [];
  const stack = [];
  let i = 0;
  const add = (start, end, kind, elementLocal, parentLocal, attrName) => {
    if (end <= start) return;
    if (kind === "text" && xml.slice(start, end).trim() === "") return;
    spans.push({
      start,
      end,
      role: roleFor(kind, elementLocal, parentLocal, attrName),
    });
  };
  while (i < xml.length) {
    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i + 4);
      if (end < 0) return null;
      add(i + 4, end, "comment", "", "", "");
      i = end + 3;
      continue;
    }
    if (xml.startsWith("<?", i) || xml.startsWith("<!", i)) {
      const end = xml.startsWith("<?", i) ? xml.indexOf("?>", i + 2) : xml.indexOf(">", i + 2);
      if (end < 0) return null;
      i = end + (xml.startsWith("<?", i) ? 2 : 1);
      continue;
    }
    const lt = xml.indexOf("<", i);
    if (lt < 0) {
      const parent = stack.length > 1 ? stack[stack.length - 2].local : "";
      const current = stack.length ? stack[stack.length - 1].local : "";
      add(i, xml.length, "text", current, parent, "");
      break;
    }
    if (lt > i) {
      const parent = stack.length > 1 ? stack[stack.length - 2].local : "";
      const current = stack.length ? stack[stack.length - 1].local : "";
      add(i, lt, "text", current, parent, "");
    }
    if (xml.startsWith("</", lt)) {
      const gt = xml.indexOf(">", lt + 2);
      if (gt < 0) return null;
      let nameStart = lt + 2;
      while (nameStart < gt && /\s/.test(xml[nameStart])) nameStart += 1;
      let nameEnd = nameStart;
      while (nameEnd < gt && !/\s/.test(xml[nameEnd])) nameEnd += 1;
      add(nameStart, nameEnd, "element-name", "", "", "");
      if (stack.length) stack.pop();
      i = gt + 1;
      continue;
    }
    const gt = xml.indexOf(">", lt + 1);
    if (gt < 0) return null;
    const tag = readStartTag(xml, lt, gt);
    if (!tag) return null;
    const elementLocal = localName(tag.qualified);
    add(tag.nameStart, tag.nameEnd, "element-name", elementLocal, "", "");
    for (const attr of tag.attrs) {
      add(attr.nameStart, attr.nameEnd, "attribute-name", elementLocal, "", attr.attrName);
      add(attr.valueStart, attr.valueEnd, "attribute-value", elementLocal, "", attr.attrName);
    }
    const selfClosing = /\/\s*$/.test(xml.slice(lt + 1, gt));
    if (!selfClosing) stack.push({ local: elementLocal });
    i = gt + 1;
  }
  const seen = Object.create(null);
  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  for (const span of spans) {
    seen[span.role] = (seen[span.role] || 0) + 1;
    span.ordinal = seen[span.role];
    span.id = span.role + "/" + span.ordinal;
  }
  return spans;
}

export function locateAndRedact(xml, password) {
  if (typeof xml !== "string" || !password || !xml.includes(password)) {
    return { xml, redacted: false, slots: [] };
  }
  const spans = scanRoleSpans(xml);
  if (!spans) return { malformed: true };
  const hitIds = new Set();
  let structural = false;
  let from = 0;
  while (from <= xml.length - password.length) {
    const at = xml.indexOf(password, from);
    if (at < 0) break;
    const end = at + password.length;
    const span = spans.find((item) => at >= item.start && end <= item.end);
    if (!span) return { unclassifiable: true };
    if (STRUCTURAL.has(span.role)) structural = true;
    else hitIds.add(span.id);
    from = end;
  }
  if (!hitIds.size && !structural) return { xml, redacted: false, slots: [] };
  let out = xml;
  const ordered = spans.filter((span) => xml.slice(span.start, span.end).includes(password) && (hitIds.has(span.id) || STRUCTURAL.has(span.role)));
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const span = ordered[index];
    const mark = STRUCTURAL.has(span.role) ? NAME_MARK : VALUE_MARK;
    const next = out.slice(0, span.start) + out.slice(span.start, span.end).split(password).join(mark) + out.slice(span.end);
    out = next;
  }
  if (out.includes(password)) return { unclassifiable: true };
  const slots = spans.filter((span) => hitIds.has(span.id)).map((span) => span.id);
  return { xml: out, redacted: true, structural, slots };
}

export function slotsMatchDocument(xml, slots) {
  if (!Array.isArray(slots) || slots.length === 0 || slots.length > MAX_REDACTION_SLOTS) return false;
  if (new Set(slots).size !== slots.length) return false;
  const inside = [];
  for (const slot of slots) {
    if (!REDACTION_SLOT_RE.test(slot)) return false;
    if (slot === "supp/1" || slot === "fault/1") continue;
    inside.push(slot);
  }
  if (!inside.length) return true;
  const spans = scanRoleSpans(typeof xml === "string" ? xml : "");
  if (!spans) return false;
  const found = new Set(spans.map((span) => span.id));
  return inside.every((slot) => found.has(slot));
}

export function redactedRanges(xml, slots) {
  if (!slotsMatchDocument(xml, slots)) return null;
  const want = new Set(slots);
  const spans = scanRoleSpans(xml) || [];
  return spans.filter((span) => want.has(span.id)).map((span) => ({
    role: span.role,
    ordinal: span.ordinal,
    start: span.start,
    end: span.end,
  }));
}
