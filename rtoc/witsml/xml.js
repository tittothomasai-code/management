// Namespace-tolerant WITSML XML helpers. Regex parsing matches the flat documents this repo already reads
// (wdash_core.js at e0ae66a). No DOMParser, so the same code runs in Node tests and the isolated demo.

export function unescapeXml(s) {
  return String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export function escapeXml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function tagAll(xml, tag) {
  const re = new RegExp('<(?:\\w+:)?' + tag + '\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?' + tag + '>)', 'g');
  return [...String(xml ?? '').matchAll(re)].map(m => ({ attr: m[1] || '', body: m[2] ?? '' }));
}

export function tagText(xml, tag) {
  const a = tagAll(xml, tag);
  return a.length ? unescapeXml(a[0].body.trim()) : '';
}

export function attr(attrString, name) {
  return (String(attrString ?? '').match(new RegExp('\\b' + name + '="([^"]*)"')) || [])[1] || '';
}

/** A successful empty plural (`<logs .../>` or `<logs ...></logs>`) is not a malformed document. */
export function emptyPlural(xml, plural) {
  const s = String(xml ?? '').trim();
  if (!s) return true;
  const re = new RegExp('<(?:\\w+:)?' + plural + '\\b[^>]*/>\\s*$');
  if (re.test(s)) return true;
  const open = s.match(new RegExp('<(?:\\w+:)?' + plural + '\\b[^>]*>'));
  if (!open) return false;
  const inner = s.slice(open.index + open[0].length).replace(new RegExp('</(?:\\w+:)?' + plural + '>\\s*$'), '');
  return !inner.trim();
}

export function looksTruncated(xml) {
  const s = String(xml ?? '').trim();
  if (!s) return false;
  const open = s.match(/<([\w:.-]+)(\s[^>]*)?>/g) || [];
  const close = s.match(/<\/[\w:.-]+>/g) || [];
  const self = s.match(/<[\w:.-]+\b[^>]*\/>/g) || [];
  return open.length > close.length + self.length;
}
