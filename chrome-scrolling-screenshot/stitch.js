const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const truncatedWarning = document.getElementById('truncated-warning');
const downloadBtn = document.getElementById('download');
const downloadPdfBtn = document.getElementById('download-pdf');
const copyBtn = document.getElementById('copy');

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode a captured slice.'));
    img.src = src;
  });
}

function filenameFor(sourceUrl) {
  let host = 'page';
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    // Keep the fallback.
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `screenshot-${host}-${stamp}`;
}

function triggerDownload(objectUrl, filename) {
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function main() {
  const capture = await pcLoadCapture();
  if (!capture || !capture.slices?.length) {
    statusEl.textContent = 'No screenshot found. Try capturing again from the extension popup.';
    return;
  }

  const images = await Promise.all(capture.slices.map((slice) => loadImage(slice.dataUrl)));

  let canvasWidth;
  let canvasHeight;
  if (capture.totalHeight != null) {
    canvasWidth = Math.round(capture.viewportWidth * capture.dpr);
    canvasHeight = Math.round(capture.totalHeight * capture.dpr);
  } else {
    canvasWidth = images[0].naturalWidth;
    canvasHeight = images[0].naturalHeight;
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  // Fill white first so any uncaptured gap (e.g. the last, partial section
  // of a truncated page) reads as blank page rather than transparent black
  // once flattened into a JPEG for the PDF export.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  images.forEach((img, i) => {
    const y = capture.totalHeight != null ? Math.round(capture.slices[i].y * capture.dpr) : 0;
    ctx.drawImage(img, 0, y);
  });

  if (capture.truncated) truncatedWarning.hidden = false;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const objectUrl = URL.createObjectURL(blob);

  previewEl.src = objectUrl;
  previewEl.hidden = false;
  statusEl.textContent = `${canvasWidth} × ${canvasHeight}px${images.length > 1 ? ` · stitched from ${images.length} sections` : ''}`;

  const baseName = filenameFor(capture.sourceUrl);

  downloadBtn.disabled = false;
  downloadBtn.addEventListener('click', () => {
    triggerDownload(objectUrl, `${baseName}.png`);
  });

  copyBtn.disabled = false;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    } catch (err) {
      copyBtn.textContent = 'Copy failed';
      setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 1500);
    }
  });

  downloadPdfBtn.disabled = false;
  downloadPdfBtn.addEventListener('click', async () => {
    const original = downloadPdfBtn.textContent;
    downloadPdfBtn.disabled = true;
    downloadPdfBtn.textContent = 'Building PDF…';
    try {
      const jpegBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      const pdfBlob = buildPdfBlob({
        jpegBytes,
        imgWidthPx: canvasWidth,
        imgHeightPx: canvasHeight,
      });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      triggerDownload(pdfUrl, `${baseName}.pdf`);
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    } catch (err) {
      downloadPdfBtn.textContent = 'PDF failed';
      setTimeout(() => { downloadPdfBtn.textContent = original; }, 1500);
      return;
    } finally {
      downloadPdfBtn.disabled = false;
    }
    downloadPdfBtn.textContent = original;
  });
}

main().catch((err) => {
  statusEl.textContent = `Something went wrong: ${err.message}`;
});
