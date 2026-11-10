// Credential echo guard for the WITSML proxies (game route, Supabase fallback,
// machine route). Self-contained: no imports, so the same bytes ship in every
// copy and tests pin the sha256.
//
// Policy (8 Nov decision): a password-only match is REDACTED IN PLACE and the
// reply is still returned (HTTP 200) with value-free slot metadata; the reply
// is REFUSED (fail closed) only when it cannot be redacted safely:
//   * the user:password pair, the Basic token or header, or a caller key
//     appears in any decoded view              -> "credential-reflection"
//   * the password is split across markup (tags, comments, PIs, CDATA joined
//     with other nodes) or sits where no slot role exists (PI, version, result)
//                                              -> "credential-reflection"
//   * the password is in an element or attribute NAME -> "structural"
//   * a DOCTYPE / ENTITY / other "<!" declaration at document level
//                                              -> "unsafe-xml"
//   * a field over MAX_FIELD_CHARS             -> "guard-limit"
//   * any internal error                       -> "guard-error"
//
// How text is read: one sequential tokenizer modelled on browser XML parsing
// (comments and PIs skipped, quote-aware tags, CDATA bodies emitted literally
// and never re-read as markup, XML character references decoded). On top of
// that, every decoding round is scanned (never only the last), with two rule
// sets: XML (strict, ';' required) and HTML (numeric refs with optional ';',
// HTML5 named refs for ASCII and Latin-1, legacy names without ';'), because
// the game puts names into innerHTML. Redaction maps a match found at any
// round back to the exact span of the node's decoded text, replaces that span
// with the mark, and re-serializes only that node. Every reply is re-scanned
// after redaction with all views; anything left is refused.
//
// All scanning is linear: comment/CDATA/PI closers use indexOf and an
// unterminated opener disables that construct for the rest of the string;
// a tag attempt never reads past the next '<'. Nothing here logs. Secrets
// never leave this module except as booleans.

const MIN_SECRET = 4;
const MAX_ROUNDS = 8;
export const MAX_FIELD_CHARS = 16 * 1024 * 1024;
export const MAX_REDACTION_SLOTS = 1024;
export const GAME_REDACTION_MARK = "[redacted]";
export const GUARD_REASONS = Object.freeze(["credential-reflection", "structural", "unsafe-xml", "guard-limit", "guard-error"]);

// Work budget per scan: characters decoded or tokenized, as a multiple of the
// input. Real replies use a handful of passes; deeply nested escapes that
// would need more are refused as "guard-limit" instead of burning the
// function's time.
const WORK_FACTOR = 16;
// Node cap per tokenized string. A 15 MB real log reply has about 0.5 M text
// nodes and 0.6 M names; more than this is refused as "guard-limit" so the
// function stays well inside its memory.
const MAX_NODES = 1500000;
let budget = Infinity;
class GuardLimit extends Error {}
const spend = (n) => { budget -= n; if (budget < 0) throw new GuardLimit("guard-limit"); };

const long = (value) => typeof value === "string" && [...value].length >= MIN_SECRET;
const uniq = (list) => [...new Set(list)];

// ---------------------------------------------------------------- references
const XML_NAMED = { lt: "<", gt: ">", amp: "&", quot: "\"", apos: "'" };
const LATIN1 = ("nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest "
  + "Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig "
  + "agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml").split(" ");
const HTML_LEGACY = { amp: "&", AMP: "&", lt: "<", LT: "<", gt: ">", GT: ">", quot: "\"", QUOT: "\"" };
LATIN1.forEach((name, index) => { HTML_LEGACY[name] = String.fromCharCode(0xa0 + index); });
const HTML_SEMI = {
  ...HTML_LEGACY, apos: "'", Tab: "\t", NewLine: "\n", excl: "!", num: "#", dollar: "$", percnt: "%", lpar: "(", rpar: ")",
  ast: "*", midast: "*", plus: "+", comma: ",", period: ".", sol: "/", colon: ":", semi: ";", equals: "=", quest: "?",
  commat: "@", lsqb: "[", lbrack: "[", bsol: "\\", rsqb: "]", rbrack: "]", Hat: "^", lowbar: "_", UnderBar: "_", grave: "`",
  DiacriticalGrave: "`", lcub: "{", lbrace: "{", verbar: "|", vert: "|", VerticalLine: "|", rcub: "}", rbrace: "}",
  NonBreakingSpace: "\u00a0", hyphen: "\u2010", dash: "\u2010", ndash: "\u2013", mdash: "\u2014", lsquo: "\u2018",
  rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d", hellip: "\u2026", euro: "\u20ac", trade: "\u2122",
};
// HTML numeric references in 0x80-0x9F map to Windows-1252.
const C1 = { 0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178 };

const isDec = (c) => c >= 48 && c <= 57;
const isHex = (c) => isDec(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
const isAlnum = (c) => isDec(c) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const own = (table, key) => Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

// One reference at s[at] === "&", or null. html selects HTML rules.
function readRef(s, at, html) {
  if (s.charCodeAt(at + 1) === 35) {
    let j = at + 2;
    let hex = false;
    if (s[j] === "x" || s[j] === "X") { hex = true; j += 1; }
    const digitsStart = j;
    while (j < s.length && (hex ? isHex(s.charCodeAt(j)) : isDec(s.charCodeAt(j)))) j += 1;
    if (j === digitsStart) return null;
    const semi = s[j] === ";";
    if (!semi && !html) return null;
    let k = digitsStart;
    while (k < j - 1 && s[k] === "0") k += 1;
    const n = j - k > 8 ? Infinity : parseInt(s.slice(k, j), hex ? 16 : 10);
    let cp;
    if (html) {
      if (!(n > 0 && n <= 0x10ffff) || (n >= 0xd800 && n <= 0xdfff)) cp = 0xfffd;
      else cp = C1[n] || n;
    } else {
      if (!(n > 0 && n <= 0x10ffff) || (n >= 0xd800 && n <= 0xdfff)) return null;
      cp = n;
    }
    return { ch: String.fromCodePoint(cp), end: semi ? j + 1 : j };
  }
  let j = at + 1;
  while (j < s.length && j - at <= 32 && isAlnum(s.charCodeAt(j))) j += 1;
  const name = s.slice(at + 1, j);
  if (!name) return null;
  if (!html) {
    const ch = s[j] === ";" ? own(XML_NAMED, name) : undefined;
    return ch === undefined ? null : { ch, end: j + 1 };
  }
  for (let k = name.length; k >= 1; k -= 1) {
    const part = name.slice(0, k);
    if (k === name.length && s[j] === ";") {
      const ch = own(HTML_SEMI, part);
      if (ch !== undefined) return { ch, end: j + 1 };
    }
    const legacy = own(HTML_LEGACY, part);
    if (legacy !== undefined) return { ch: legacy, end: at + 1 + k };
  }
  return null;
}

// Decode references once. With map, every output code unit carries the
// [start, end) of the input it came from.
function decodeRefs(s, html, map) {
  spend(s.length);
  let out = "";
  const starts = map ? [] : null;
  const ends = map ? [] : null;
  let i = 0;
  let last = 0;
  const copy = (to) => {
    if (to <= last) return;
    out += s.slice(last, to);
    if (map) for (let k = last; k < to; k += 1) { starts.push(k); ends.push(k + 1); }
  };
  for (;;) {
    const amp = s.indexOf("&", i);
    if (amp < 0) break;
    const ref = readRef(s, amp, html);
    if (!ref) { i = amp + 1; continue; }
    copy(amp);
    out += ref.ch;
    if (map) for (let k = 0; k < ref.ch.length; k += 1) { starts.push(amp); ends.push(ref.end); }
    i = last = ref.end;
  }
  copy(s.length);
  return map ? { out, starts, ends } : out;
}

// ----------------------------------------------------------------- tokenizer
const isWs = (c) => c === 32 || c === 9 || c === 10 || c === 13;
const isNameStart = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 58 || c >= 0x80;
const isNameStop = (c) => isWs(c) || c === 47 || c === 62 || c === 60 || c === 61 || c === 34 || c === 39;

// A quote-aware tag at s[at] === "<". Name spans go to names (flat
// start,end pairs) and attribute value spans to values; returns the end
// index, or -1 (and the arrays are left as they were) when it is not a tag.
// Never reads past the next "<".
function readTag(s, at, names, values) {
  const n = s.length;
  const namesLength = names.length;
  const valuesLength = values.length;
  const fail = () => { names.length = namesLength; values.length = valuesLength; return -1; };
  let j = at + 1;
  const close = s.charCodeAt(j) === 47;
  if (close) j += 1;
  if (j >= n || !isNameStart(s.charCodeAt(j))) return -1;
  const nameStart = j;
  while (j < n && !isNameStop(s.charCodeAt(j))) j += 1;
  names.push(nameStart, j);
  for (;;) {
    const before = j;
    while (j < n && isWs(s.charCodeAt(j))) j += 1;
    if (j >= n) return fail();
    const c = s.charCodeAt(j);
    if (c === 62) return j + 1;
    if (c === 47 && !close && s.charCodeAt(j + 1) === 62) return j + 2;
    if (close || j === before) return fail();
    if (isNameStop(c)) return fail();
    const attrStart = j;
    while (j < n && !isNameStop(s.charCodeAt(j))) j += 1;
    names.push(attrStart, j);
    while (j < n && isWs(s.charCodeAt(j))) j += 1;
    if (s.charCodeAt(j) !== 61) return fail();
    j += 1;
    while (j < n && isWs(s.charCodeAt(j))) j += 1;
    const quote = s[j];
    if (quote !== "\"" && quote !== "'") return fail();
    j += 1;
    const valueStart = j;
    while (j < n && s[j] !== quote && s.charCodeAt(j) !== 60) j += 1;
    if (j >= n || s[j] !== quote) return fail();
    values.push(valueStart, j);
    j += 1;
  }
}

// Browser-like read of one string as XML content. Text nodes join adjacent
// character data, references and CDATA bodies (decoded, XML rules); comments
// and PIs are kept apart; a construct that does not parse is character data.
export function parseXmlText(s) {
  spend(s.length);
  const n = s.length;
  const texts = [];
  const attrs = [];
  const comments = [];
  const pis = [];
  const names = [];
  const values = [];
  let decl = false;
  let cur = null;
  let noComment = false;
  let noCdata = false;
  let noPi = false;
  // Character data copied from the source is kept as one pending range, so a
  // run of literal text costs one slice however it was tokenized.
  const add = (start, end, d, raw) => {
    if (!cur || cur.end !== start) {
      flush();
      cur = { start, end: start, parts: [], rawFrom: start };
    }
    if (!raw) {
      if (cur.rawFrom < start) cur.parts.push(s.slice(cur.rawFrom, start));
      cur.parts.push(d);
      cur.rawFrom = end;
    }
    cur.end = end;
  };
  const flush = () => {
    if (!cur) return;
    if (texts.length + attrs.length > MAX_NODES || names.length > 2 * MAX_NODES) throw new GuardLimit("guard-limit");
    if (cur.rawFrom < cur.end) cur.parts.push(s.slice(cur.rawFrom, cur.end));
    texts.push({ start: cur.start, end: cur.end, d: cur.parts.length === 1 ? cur.parts[0] : cur.parts.join("") });
    cur = null;
  };
  let i = 0;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 60) {
      if (s.startsWith("<!--", i) && !noComment) {
        const e = s.indexOf("-->", i + 4);
        if (e >= 0) { flush(); comments.push({ start: i + 4, end: e }); i = e + 3; continue; }
        noComment = true;
      } else if (s.startsWith("<![CDATA[", i) && !noCdata) {
        const e = s.indexOf("]]>", i + 9);
        if (e >= 0) { add(i, e + 3, s.slice(i + 9, e)); i = e + 3; continue; }
        noCdata = true;
      } else if (s.startsWith("<?", i) && !noPi) {
        const e = s.indexOf("?>", i + 2);
        if (e >= 0) { flush(); pis.push({ start: i + 2, end: e }); i = e + 2; continue; }
        noPi = true;
      } else if (s.charCodeAt(i + 1) === 33 && /[A-Za-z]/.test(s[i + 2] || "")) {
        decl = true;
      } else {
        const valuesFrom = values.length;
        const end = readTag(s, i, names, values);
        if (end > 0) {
          flush();
          for (let k = valuesFrom; k < values.length; k += 2) {
            const start = values[k];
            const stop = values[k + 1];
            const raw = s.slice(start, stop).replace(/[\t\n\r]/g, " ");
            attrs.push({ start, end: stop, quote: s[stop], d: raw.includes("&") ? decodeRefs(raw, false, false) : raw });
          }
          values.length = valuesFrom;
          i = end;
          continue;
        }
      }
      add(i, i + 1, "<", true);
      i += 1;
      continue;
    }
    if (c === 38) {
      const ref = readRef(s, i, false);
      if (ref) { add(i, ref.end, ref.ch); i = ref.end; continue; }
      add(i, i + 1, "&", true);
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < n) { const cc = s.charCodeAt(j); if (cc === 60 || cc === 38) break; j += 1; }
    add(i, j, null, true);
    i = j;
  }
  flush();
  return { texts, attrs, comments, pis, names, decl, textContent: texts.map((t) => t.d).join("") };
}

// ---------------------------------------------------------------- detection
function chainHit(s, secrets, step) {
  let current = s;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const next = step(current);
    if (next === current) return false;
    if (secrets.some((secret) => next.includes(secret))) return true;
    current = next;
  }
  return false;
}
const xmlStep = (s) => (s.includes("&") ? decodeRefs(s, false, false) : s);
const htmlStep = (s) => (s.includes("&") ? decodeRefs(s, true, false) : s);

function valueHit(s, secrets) {
  if (secrets.some((secret) => s.includes(secret))) return true;
  return chainHit(s, secrets, xmlStep) || chainHit(s, secrets, htmlStep);
}

// True when any view a reader could build from s contains a secret: the raw
// string, every round of XML and HTML reference decoding, and every round of
// re-reading the text as XML (text content and attribute values), each of
// those also HTML-decoded. Every round is scanned.
export function anyViewContains(s, secrets) {
  const list = (secrets || []).filter(long);
  if (typeof s !== "string" || s === "" || !list.length) return false;
  const outer = budget === Infinity;
  if (outer) budget = WORK_FACTOR * s.length + (1 << 20);
  try { return viewsContain(s, list); } finally { if (outer) budget = Infinity; }
}

function viewsContain(s, list) {
  if (valueHit(s, list)) return true;
  let current = s;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (!current.includes("<") && !current.includes("&")) return false;
    const parsed = parseXmlText(current);
    for (const attr of parsed.attrs) if (valueHit(attr.d, list)) return true;
    for (const pi of parsed.pis) if (valueHit(current.slice(pi.start, pi.end), list)) return true;
    for (const comment of parsed.comments) if (valueHit(current.slice(comment.start, comment.end), list)) return true;
    const next = parsed.textContent;
    if (next === current) return false;
    if (valueHit(next, list)) return true;
    current = next;
  }
  return false;
}

// ---------------------------------------------------------------- redaction
function spansOf(text, needle) {
  const spans = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) return spans;
    spans.push([at, at + needle.length]);
    from = at + needle.length;
  }
}

// First decoding round (XML rules, then HTML rules) where the password
// appears, mapped back to spans of the input. null when none.
function deepSpans(text, password) {
  for (const html of [false, true]) {
    const levels = [];
    let current = text;
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      if (!current.includes("&")) break;
      const decoded = decodeRefs(current, html, true);
      if (decoded.out === current) break;
      levels.push(decoded);
      current = decoded.out;
      const found = spansOf(current, password);
      if (!found.length) continue;
      const mapped = found.map(([a, b]) => {
        let lo = a;
        let hi = b - 1;
        for (let k = levels.length - 1; k >= 0; k -= 1) {
          lo = levels[k].starts[lo];
          hi = levels[k].ends[hi] - 1;
        }
        return [lo, hi + 1];
      }).sort((x, y) => x[0] - y[0]);
      const merged = [];
      for (const span of mapped) {
        const prev = merged[merged.length - 1];
        if (prev && span[0] <= prev[1]) prev[1] = Math.max(prev[1], span[1]);
        else merged.push(span.slice());
      }
      return merged;
    }
  }
  return null;
}

// Replace every literal or reference-encoded password in one decoded string.
function redactValue(text, password, mark) {
  let current = text;
  let count = 0;
  for (let iteration = 0; iteration < MAX_ROUNDS; iteration += 1) {
    if (current.includes(password)) {
      const parts = current.split(password);
      count += parts.length - 1;
      current = parts.join(mark);
      continue;
    }
    if (!current.includes("&")) return { out: current, count };
    const spans = deepSpans(current, password);
    if (!spans) return { out: current, count };
    for (let k = spans.length - 1; k >= 0; k -= 1) current = current.slice(0, spans[k][0]) + mark + current.slice(spans[k][1]);
    count += spans.length;
  }
  if (current.includes(password) || deepSpans(current, password)) return { fail: true };
  return { out: current, count };
}

const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s, quote) => escText(s).replace(quote === "\"" ? /"/g : /'/g, quote === "\"" ? "&quot;" : "&apos;");

function redactXml(xml, parsed, password, mark) {
  for (let k = 0; k < parsed.names.length; k += 2) {
    if (xml.slice(parsed.names[k], parsed.names[k + 1]).includes(password)) return { ok: false, reason: "structural" };
  }
  for (const pi of parsed.pis) {
    if (anyViewContains(xml.slice(pi.start, pi.end), [password])) return { ok: false, reason: "credential-reflection" };
  }
  const edits = [];
  const consider = (item, value, serialize) => {
    if (!value.includes(password) && (!value.includes("&") || !valueHit(value, [password]))) return true;
    const result = redactValue(value, password, mark);
    if (result.fail) return false;
    if (result.count) edits.push({ start: item.start, end: item.end, text: serialize(result.out) });
    return true;
  };
  for (const text of parsed.texts) if (!consider(text, text.d, escText)) return { ok: false, reason: "credential-reflection" };
  for (const attr of parsed.attrs) if (!consider(attr, attr.d, (out) => escAttr(out, attr.quote))) return { ok: false, reason: "credential-reflection" };
  for (const comment of parsed.comments) {
    const ok = consider(comment, xml.slice(comment.start, comment.end), (out) => out);
    if (!ok) return { ok: false, reason: "credential-reflection" };
  }
  if (!edits.length) return { ok: true, xml, ranges: [] };
  edits.sort((a, b) => a.start - b.start);
  let out = "";
  let last = 0;
  const ranges = [];
  for (const edit of edits) {
    out += xml.slice(last, edit.start);
    ranges.push([out.length, out.length + edit.text.length]);
    out += edit.text;
    last = edit.end;
  }
  out += xml.slice(last);
  for (const comment of parseXmlText(out).comments) {
    const body = out.slice(comment.start, comment.end);
    if (body.endsWith("-") || body.includes("--")) return { ok: false, reason: "credential-reflection" };
  }
  return { ok: true, xml: out, ranges };
}

// ------------------------------------------------- slot roles (redaction-slots.mjs)
// Same algorithm as netlify/lib/redaction-slots.mjs scanRoleSpans, so a slot
// named here resolves in the machine adapter, reader.py and the game bundle.
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
    spans.push({ start, end, role: roleFor(kind, elementLocal, parentLocal, attrName) });
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

function slotIds(xml, ranges) {
  const spans = scanRoleSpans(xml);
  if (!spans) return null;
  const ids = [];
  for (const [start, end] of ranges) {
    const hit = spans.filter((span) => span.start < end && span.end > start && span.role !== "element-name" && span.role !== "attribute-name");
    if (!hit.length) return null;
    for (const span of hit) if (!ids.includes(span.id)) ids.push(span.id);
  }
  return ids;
}

// ---------------------------------------------------------------- credentials
// The Basic header, strictly: canonical base64 of UTF-8 "user:password" with
// a non-empty user and password. null otherwise (callers answer 400).
export function credentialParts(auth) {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(String(auth || ""));
  if (!match) return null;
  const token = match[1];
  if (token.length % 4 !== 0) return null;
  let bytes;
  try {
    if (typeof Buffer !== "undefined") {
      bytes = Buffer.from(token, "base64");
      if (bytes.toString("base64") !== token) return null;
    } else {
      const binary = atob(token);
      if (btoa(binary) !== token) return null;
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    }
  } catch { return null; }
  let raw;
  try { raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
  if (/[\0\r\n]/.test(raw)) return null;
  const colon = raw.indexOf(":");
  if (colon <= 0 || colon === raw.length - 1) return null;
  return { user: raw.slice(0, colon), password: raw.slice(colon + 1), blocking: uniq([raw, token, "Basic " + token]) };
}

// Every credential that must not come back (password first). [] when the
// header is not usable.
export function credentialSecrets(auth) {
  const parts = credentialParts(auth);
  if (!parts) return [];
  return uniq([parts.password, ...parts.blocking]).filter(long);
}

// ---------------------------------------------------------------- entry points
function strings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === "object") for (const key of Object.keys(value)) { strings(key, out); strings(value[key], out); }
  return out;
}

// Redact one reply's string fields.
//   fields: { name: string }   creds: { password, blocking: [..] }
//   opts.mark      replacement text (game "[redacted]", machine "***")
//   opts.xmlKeys   fields read as XML documents (others are plain text)
//   opts.slotKeys  plain-text fields that may be redacted whole, and their slot
// Returns { ok: true, fields, redacted, slots } or { ok: false, reason }.
// Never throws.
export function guardFields(fields, creds, opts = {}) {
  try {
    const mark = typeof opts.mark === "string" && opts.mark ? opts.mark : GAME_REDACTION_MARK;
    const xmlKeys = new Set(opts.xmlKeys || []);
    const slotKeys = opts.slotKeys || {};
    const password = long(creds && creds.password) ? creds.password : "";
    const blocking = uniq(((creds && creds.blocking) || []).filter(long));
    const all = password ? uniq([password, ...blocking]) : blocking;
    const keys = Object.keys(fields || {}).filter((key) => typeof fields[key] === "string" && fields[key] !== "");
    if (keys.some((key) => fields[key].length > MAX_FIELD_CHARS)) return { ok: false, reason: "guard-limit" };
    budget = 24 * keys.reduce((sum, key) => sum + fields[key].length, 0) + (4 << 20);
    if (password && mark.includes(password)) return { ok: false, reason: "credential-reflection" };
    const parsed = {};
    for (const key of keys) {
      parsed[key] = parseXmlText(fields[key]);
      if (parsed[key].decl) return { ok: false, reason: "unsafe-xml" };
    }
    for (const key of keys) if (anyViewContains(fields[key], blocking)) return { ok: false, reason: "credential-reflection" };
    const out = { ...fields };
    const slots = [];
    if (password) {
      for (const key of keys) {
        if (xmlKeys.has(key)) {
          const result = redactXml(fields[key], parsed[key], password, mark);
          if (!result.ok) return { ok: false, reason: result.reason };
          if (!result.ranges.length) continue;
          const ids = slotIds(result.xml, result.ranges);
          if (!ids) return { ok: false, reason: "credential-reflection" };
          out[key] = result.xml;
          for (const id of ids) if (!slots.includes(id)) slots.push(id);
        } else {
          const result = redactValue(fields[key], password, mark);
          if (result.fail) return { ok: false, reason: "credential-reflection" };
          if (!result.count) continue;
          if (!slotKeys[key]) return { ok: false, reason: "credential-reflection" };
          out[key] = result.out;
          if (!slots.includes(slotKeys[key])) slots.push(slotKeys[key]);
        }
      }
    }
    for (const key of keys) parsed[key] = null;
    for (const key of keys) {
      if (anyViewContains(out[key], all)) return { ok: false, reason: "credential-reflection" };
      if (xmlKeys.has(key) && out[key] !== fields[key] && parseXmlText(out[key]).decl) return { ok: false, reason: "unsafe-xml" };
    }
    return { ok: true, fields: out, redacted: slots.length > 0, slots };
  } catch (err) {
    return { ok: false, reason: err instanceof GuardLimit ? "guard-limit" : "guard-error" };
  } finally {
    budget = Infinity;
  }
}

// Value-free redaction metadata on a game reply (same shape as the machine
// route): passwordRedacted, redactionScope "slots" and redactedSlots; over
// MAX_REDACTION_SLOTS the document is withheld (scope "response", failure
// "slot-limit").
export function attachRedactionMeta(reply, guarded) {
  if (!guarded || guarded.redacted !== true) return reply;
  reply.passwordRedacted = true;
  if (guarded.slots.length <= MAX_REDACTION_SLOTS) {
    reply.redactionScope = "slots";
    reply.redactedSlots = guarded.slots.slice();
    return reply;
  }
  delete reply.xml;
  delete reply.supp;
  delete reply.version;
  reply.result = -1;
  reply.redactionScope = "response";
  reply.redactionFailure = "slot-limit";
  return reply;
}

// Detection only: a GUARD_REASONS value, or null. Object keys are scanned
// too. Never throws.
export function guardReason(value, secrets) {
  try {
    const list = uniq((secrets || []).filter(long));
    for (const text of strings(value)) {
      if (text.length > MAX_FIELD_CHARS) return "guard-limit";
      if (parseXmlText(text).decl) return "unsafe-xml";
      if (anyViewContains(text, list)) return "credential-reflection";
    }
    return null;
  } catch (err) {
    return err instanceof GuardLimit ? "guard-limit" : "guard-error";
  } finally {
    budget = Infinity;
  }
}

// True when guardReason() would refuse.
export function echoes(value, secrets) {
  return guardReason(value, secrets) !== null;
}

// The 422 body. Fixed text; any field whose key or value would contain a
// secret is dropped, so the body never carries one.
export function echoRefusal(secrets, reason = "credential-reflection") {
  const body = { result: -1, error: "proxy refusal", code: "proxy-refusal", reason: GUARD_REASONS.includes(reason) ? reason : "credential-reflection" };
  const list = uniq((secrets || []).filter(long));
  for (const key of Object.keys(body)) {
    if (strings({ [key]: body[key] }).some((text) => anyViewContains(text, list))) delete body[key];
  }
  return strings(body).some((text) => anyViewContains(text, list)) ? {} : body;
}
