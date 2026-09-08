// Minimal, dependency-free PDF writer for turning one tall screenshot image
// into a multi-page PDF. No external library: MV3 extension pages can't load
// remote scripts, and this only needs one feature (paginate a single JPEG),
// so a small hand-built writer is lighter than bundling a general-purpose
// PDF library.
//
// Approach: embed the JPEG once as a single XObject, then give each page its
// own content stream that positions that same image (via a translation in
// the `cm` matrix) so only the relevant vertical slice falls inside that
// page's MediaBox. No image data is duplicated per page.

const PDF_PAGE_WIDTH_PT = 612; // US Letter width, in points (1/72in)
const PDF_PAGE_HEIGHT_PT = 792; // US Letter height

function round2(n) {
  return Math.round(n * 100) / 100;
}

function buildPdfBlob({ jpegBytes, imgWidthPx, imgHeightPx, pageWidthPt = PDF_PAGE_WIDTH_PT, pageHeightPt = PDF_PAGE_HEIGHT_PT }) {
  const scale = pageWidthPt / imgWidthPx;
  const totalHeightPt = imgHeightPx * scale;
  const pageCount = Math.max(1, Math.ceil(totalHeightPt / pageHeightPt));

  const enc = new TextEncoder();
  const parts = [];
  let offset = 0;
  const offsets = {};

  function push(bytesOrStr) {
    const bytes = typeof bytesOrStr === 'string' ? enc.encode(bytesOrStr) : bytesOrStr;
    parts.push(bytes);
    offset += bytes.length;
  }

  function beginObj(num) {
    offsets[num] = offset;
    push(`${num} 0 obj\n`);
  }

  function endObj() {
    push('endobj\n');
  }

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // recommended binary marker comment

  const imageNum = 3;
  const maxObjNum = 4 + (pageCount - 1) * 2 + 1;
  const pageNums = [];
  for (let i = 0; i < pageCount; i++) pageNums.push(5 + i * 2);

  // 1: Catalog
  beginObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObj();

  // 2: Pages
  beginObj(2);
  push(`<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageCount} >>\n`);
  endObj();

  // 3: Image XObject (shared by every page)
  beginObj(imageNum);
  push(`<< /Type /XObject /Subtype /Image /Width ${imgWidthPx} /Height ${imgHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  push(jpegBytes);
  push('\nendstream\n');
  endObj();

  // Per-page content stream + page objects
  for (let i = 0; i < pageCount; i++) {
    const docTopY = totalHeightPt - i * pageHeightPt;
    const docBottomY = Math.max(totalHeightPt - (i + 1) * pageHeightPt, 0);
    const thisPageHeightPt = round2(docTopY - docBottomY);
    const ty = round2(-docBottomY);

    const contentStr = `q\n${round2(pageWidthPt)} 0 0 ${round2(totalHeightPt)} 0 ${ty} cm\n/Im0 Do\nQ\n`;
    const contentBytes = enc.encode(contentStr);
    const contentNum = 4 + i * 2;
    const pageNum = 5 + i * 2;

    beginObj(contentNum);
    push(`<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    push('\nendstream\n');
    endObj();

    beginObj(pageNum);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${round2(pageWidthPt)} ${thisPageHeightPt}] /Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${contentNum} 0 R >>\n`);
    endObj();
  }

  const xrefOffset = offset;
  push(`xref\n0 ${maxObjNum + 1}\n`);
  push('0000000000 65535 f \n');
  for (let n = 1; n <= maxObjNum; n++) {
    push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${maxObjNum + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(parts, { type: 'application/pdf' });
}
