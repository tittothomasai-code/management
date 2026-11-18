// Production XLSX reader snapshot; used unchanged for offline upload tests.
export async function xlsxRows(buf, opt = {}) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); const files = {};
  let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid .xlsx file');
  let p = dv.getUint32(eocd + 16, true); const n = dv.getUint16(eocd + 10, true);
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); files[name] = {method, csize, off}; p += 46 + nl + xl + cl;
  }
  const read = async name => { const f = files[name]; if (!f) return ''; const lnl = dv.getUint16(f.off + 26, true), lxl = dv.getUint16(f.off + 28, true); const data = u8.subarray(f.off + 30 + lnl + lxl, f.off + 30 + lnl + lxl + f.csize);
    if (f.method === 0) return new TextDecoder().decode(data); const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return await new Response(s).text(); };
  const ss = [...(await read('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(t => t[1]).join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  let sheet = Object.keys(files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0])[0]; if (!sheet) throw new Error('No worksheet in the .xlsx');
  let sheetName = '', sheetNames = [];
  try {
    const wbx = await read('xl/workbook.xml'), rel = await read('xl/_rels/workbook.xml.rels');
    const tgt = {}; for (const m of rel.matchAll(/<Relationship\s[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g)) tgt[m[1]] = 'xl/' + m[2].replace(/^\/?xl\//, '');
    for (const m of rel.matchAll(/<Relationship\s[^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"/g)) tgt[m[2]] = 'xl/' + m[1].replace(/^\/?xl\//, '');
    const list = [...wbx.matchAll(/<sheet\s[^>]*?name="([^"]*)"[^>]*?r:id="([^"]+)"/g)].map(m => ({name: m[1].replace(/&amp;/g, '&'), file: tgt[m[2]]})).filter(x => x.file && files[x.file]);
    sheetNames = list.map(x => x.name);
    const pick = opt.prefer ? list.find(x => opt.prefer.test(x.name)) : list[0];
    if (pick) { sheet = pick.file; sheetName = pick.name; }
  } catch {}
  const xml = await read(sheet), rows = [], byRow = {};
  for (const r of xml.matchAll(/<row([^>]*)>([\s\S]*?)<\/row>/g)) {
    const row = [], rn = +((/\br="(\d+)"/.exec(r[1]) || [])[1] || 0); r[1] = r[2];
    for (const c of r[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (/r="([A-Z]+)\d+"/.exec(c[1]) || [])[1] || ''; let ci = 0; for (const ch of ref) ci = ci * 26 + ch.charCodeAt(0) - 64; ci = Math.max(0, ci - 1);
      const t = (/t="([^"]*)"/.exec(c[1]) || [])[1], v = (/<v>([^<]*)<\/v>/.exec(c[2] || '') || [])[1] ?? (/<t[^>]*>([^<]*)<\/t>/.exec(c[2] || '') || [])[1] ?? '';
      row[ci] = t === 's' ? ss[Number(v)] ?? '' : v;
    }
    const clean = Array.from(row, x => (x ?? '').trim()); rows.push(clean); if (rn) byRow[rn] = clean;
  }
  const out = rows.filter(r => r.some(Boolean)); out.sheetName = sheetName; out.sheetNames = sheetNames; out.byRow = byRow;
  return out;
}
