// opsnow_export.js: download helpers. CSV is plain text; XLSX is a minimal SpreadsheetML zip;
// PDF is a one-file writer for text pages plus optional JPEG images. Nothing is sent anywhere.
const enc = s => new TextEncoder().encode(s);
function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
function crc32(buf) {
  let c = ~0; const t = crc32.t || (crc32.t = (() => { const a = new Uint32Array(256); for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; a[n] = x; } return a; })());
  for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8); return (~c) >>> 0;
}
function zip(files) { // files: [{name, data: Uint8Array}] uncompressed
  const loc = [], cen = []; let off = 0;
  for (const f of files) {
    const name = enc(f.name), data = f.data instanceof Uint8Array ? f.data : enc(f.data), crc = crc32(data);
    const lh = [enc('PK\x03\x04'), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data];
    const ls = concat(lh); loc.push(ls);
    cen.push(concat([enc('PK\x01\x02'), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name]));
    off += ls.length;
  }
  const cd = concat(cen), body = concat(loc);
  const end = concat([enc('PK\x05\x06'), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(body.length), u16(0)]);
  return concat([body, cd, end]);
}
function concat(parts) { const n = parts.reduce((a, p) => a + p.length, 0), o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; }
const xmlEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function xlsxBlob(rows, sheet = 'Sheet1') {
  const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  const wb = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const cell = (v, r, c) => {
    const ref = colName(c) + r;
    if (v == null || v === '') return `<c r="${ref}"/>`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" t="n"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(v)}</t></is></c>`;
  };
  const body = (rows || []).map((row, i) => `<row r="${i + 1}">${(row || []).map((v, c) => cell(v, i + 1, c)).join('')}</row>`).join('');
  const ws = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  const data = zip([
    {name: '[Content_Types].xml', data: types}, {name: '_rels/.rels', data: rels},
    {name: 'xl/workbook.xml', data: wb}, {name: 'xl/_rels/workbook.xml.rels', data: wbRels},
    {name: 'xl/worksheets/sheet1.xml', data: ws}]);
  return new Blob([data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function colName(i) { let s = ''; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
export function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function csvBlob(text) { return new Blob([text], {type: 'text/csv;charset=utf-8'}); }
function pdfEsc(s) { return String(s ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
// WinAnsi (cp1252) bytes for the standard Helvetica font: Latin-1 passes through, a few typographic marks map to cp1252, others get ASCII stand-ins.
const WIN = {'\u2013': 0x96, '\u2014': 0x97, '\u2018': 0x91, '\u2019': 0x92, '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2026': 0x85, '\u20AC': 0x80, '\u2030': 0x89};
const ASC = {'\u2212': '-', '\u2264': '<=', '\u2265': '>=', '\u0394': 'd', '\u2192': '->', '\u2190': '<-', '\u2248': '~', '\u2260': '!=', '\u221E': 'inf', '\u2009': ' ', '\u202F': ' ', '\u00A0': ' ', '\u2011': '-', '\u2010': '-'};
export function winAnsi(str) {
  const out = []; for (const ch of String(str)) { const c = ch.codePointAt(0);
    if (c < 0x80 || (c >= 0xA0 && c <= 0xFF && c !== 0xA0)) out.push(c); else if (WIN[ch] != null) out.push(WIN[ch]); else for (const a of (ASC[ch] ?? '?')) out.push(a.charCodeAt(0)); }
  return Uint8Array.from(out);
}
export function pdfBlob(pages) {
  // pages: [{title, lines: string[], jpeg?: Uint8Array, jw, jh}]
  const objs = []; const add = s => { objs.push(s); return objs.length; };
  const kids = []; const info = [];
  add('<< /Type /Catalog /Pages 2 0 R >>'); // 1
  add('placeholder'); // 2 pages — filled later
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // 3
  for (const p of pages || [{title: '', lines: ['(empty)']}]) {
    const landscape = p.landscape, pageW = landscape ? 842 : 595, pageH = landscape ? 595 : 842, margin = p.margin ?? 36;
    const wrapN = p.wrap ?? (landscape ? 130 : 90);
    const lines = [];
    if (p.title) { lines.push({sz: 14, t: p.title, yGap: 20}); lines.push({sz: 10, t: '', yGap: 8}); }
    for (const raw of p.lines || []) {
      const wrap = wrapText(String(raw), wrapN);
      for (const t of wrap.length ? wrap : ['']) lines.push({sz: 10, t, yGap: 13});
    }
    let y = pageH - margin, chunks = [[]];
    for (const ln of lines) { if (y - ln.yGap < 80 + (p.jpeg ? 220 : 0)) { chunks.push([]); y = pageH - margin; } chunks.at(-1).push(ln); y -= ln.yGap; }
    if (!chunks[0].length) chunks = [[{sz: 10, t: '', yGap: 13}]];
    chunks.forEach((ch, ci) => {
      const cmd = []; let yy = pageH - margin;
      cmd.push('BT /F1 14 Tf 0 g');
      for (const ln of ch) { cmd.push(`/F1 ${ln.sz} Tf`); cmd.push(`1 0 0 1 ${margin} ${yy} Tm (${pdfEsc(ln.t)}) Tj`); yy -= ln.yGap; }
      cmd.push('ET');
      let imgId = 0;
      if (p.jpeg && ci === chunks.length - 1) {
        imgId = add(jpegXobj(p.jpeg, p.jw || 480, p.jh || 320));
        const iw = pageW - 2 * margin, ih = Math.round(iw * ((p.jh || 320) / (p.jw || 480)));
        cmd.push(`q ${iw} 0 0 ${Math.min(ih, 280)} ${margin} 40 cm /Im1 Do Q`);
      }
      const stream = winAnsi(cmd.join('\n'));
      const cId = add(concat([enc(`<< /Length ${stream.length} >>\nstream\n`), stream, enc('\nendstream')]));
      const res = imgId ? `<< /Font << /F1 3 0 R >> /XObject << /Im1 ${imgId} 0 R >> >>` : '<< /Font << /F1 3 0 R >> >>';
      const pId = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${cId} 0 R /Resources ${res} >>`);
      kids.push(pId);
    });
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.map(i => i + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  const parts = [enc('%PDF-1.4\n')]; const xref = [0];
  const asBytes = body => body instanceof Uint8Array ? body : enc(body);
  objs.forEach((body, i) => { xref.push(parts.reduce((a, p) => a + p.length, 0)); parts.push(enc(`${i + 1} 0 obj\n`), asBytes(body), enc('\nendobj\n')); });
  const start = parts.reduce((a, p) => a + p.length, 0);
  parts.push(enc(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + xref.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')));
  parts.push(enc(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`));
  return new Blob([concat(parts)], {type: 'application/pdf'});
}
function jpegXobj(bytes, w, h) {
  const head = enc(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
  const tail = enc('\nendstream');
  return concat([head, bytes, tail]);
}
function wrapText(t, n) { if (t.length <= n) return [t]; const out = []; let s = t; while (s.length > n) { let k = s.lastIndexOf(' ', n); if (k < n / 2) k = n; out.push(s.slice(0, k)); s = s.slice(k).trim(); } if (s) out.push(s); return out; }
export function jpegFromCanvas(cv, q = 0.85) {
  if (!cv) return null;
  const url = cv.toDataURL('image/jpeg', q), b64 = url.split(',')[1] || '';
  const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return {jpeg: u8, jw: cv.width, jh: cv.height};
}
export async function copyTextAndPng(text, canvas) {
  try {
    if (canvas && globalThis.ClipboardItem) {
      const png = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({'text/plain': new Blob([text], {type: 'text/plain'}), 'image/png': png})]);
      return 'copied text and plot';
    }
  } catch {}
  try { await navigator.clipboard.writeText(text); return 'copied text'; } catch { return 'copy failed'; }
}

export function zipBlob(files) {
  const list = (files || []).map(f => ({name: f.name, data: f.data instanceof Uint8Array ? f.data : enc(typeof f.data === 'string' ? f.data : String(f.data ?? ''))}));
  return new Blob([zip(list)], {type: 'application/zip'});
}
export async function zipBlobs(files) {
  const list = [];
  for (const f of files || []) {
    const buf = f.data instanceof Uint8Array ? f.data : new Uint8Array(await (f.blob || f.data).arrayBuffer());
    list.push({name: f.name, data: buf});
  }
  return zipBlob(list);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'copy failed'; }
}

// Multi-sheet workbook in a fixed template layout: sheets = [{name, cells: {A1: v, ...}, merges: ['A8:A9'], freeze: 'A10'}].
// Cells keep the template coordinates, so the file opens with the same structure as the supplied EOWR / slide sheet.
const cellRef = r => { const m = /^([A-Z]+)(\d+)$/.exec(r); if (!m) return null; let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return {c, r: +m[2]}; };
const sheetXmlName = s => String(s).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
export function xlsxBookXml(sheets) {
  const list = (sheets || []).filter(s => s && s.cells);
  const files = [];
  const ct = list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  files.push({name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ct}</Types>`});
  files.push({name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
  files.push({name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list.map((s, i) => `<sheet name="${xmlEsc(sheetXmlName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`});
  files.push({name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});
  files.push({name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'});
  list.forEach((s, i) => {
    const byRow = new Map();
    for (const [ref, v] of Object.entries(s.cells)) { const p = cellRef(ref); if (!p || v == null || v === '') continue; if (!byRow.has(p.r)) byRow.set(p.r, []); byRow.get(p.r).push([p.c, ref, v]); }
    const rows = [...byRow.keys()].sort((a, b) => a - b).map(r => `<row r="${r}">${byRow.get(r).sort((a, b) => a[0] - b[0]).map(([, ref, v]) => {
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      if (typeof v === 'number') return `<c r="${ref}"/>`;
      return `<c r="${ref}" t="inlineStr"${s.bold?.includes(ref) ? ' s="1"' : ''}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`; }).join('')}</row>`).join('');
    const fr = s.freeze ? cellRef(s.freeze) : null;
    const views = fr ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${fr.r - 1}" topLeftCell="${s.freeze}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : '';
    const merges = (s.merges || []).length ? `<mergeCells count="${s.merges.length}">${s.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
    files.push({name: `xl/worksheets/sheet${i + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${views}<sheetData>${rows}</sheetData>${merges}</worksheet>`});
  });
  return files;
}
export function xlsxBook(sheets) { return new Blob([zip(xlsxBookXml(sheets).map(f => ({name: f.name, data: enc(f.data)})))], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); }
export function xlsxBookBytes(sheets) { return zip(xlsxBookXml(sheets).map(f => ({name: f.name, data: enc(f.data)}))); }
