const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const truncatedWarning = document.getElementById('truncated-warning');
const downloadBtn = document.getElementById('download');
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
  return `screenshot-${host}-${stamp}.png`;
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

  const filename = filenameFor(capture.sourceUrl);

  downloadBtn.disabled = false;
  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
}

main().catch((err) => {
  statusEl.textContent = `Something went wrong: ${err.message}`;
});
