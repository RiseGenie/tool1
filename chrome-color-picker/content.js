// Injected into the page via chrome.scripting.executeScript.
// Returns { hex, rgb } on a successful pick, or null if the user cancels.
async function colorSnapPickColor(screenshotDataUrl) {
  // Preferred path: the native browser EyeDropper. It captures the whole
  // screen (not just the tab), so it can sample any pixel the user can see.
  if (typeof EyeDropper !== 'undefined') {
    try {
      const dropper = new EyeDropper();
      const result = await dropper.open();
      const hex = result.sRGBHex;
      const rgb = [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
      return { hex, rgb };
    } catch (err) {
      // AbortError = user pressed Escape / clicked away. Treat as cancel.
      return null;
    }
  }

  // Fallback: build a full-viewport magnifier over a screenshot of the
  // visible tab, and let the user click a pixel to sample it.
  return await new Promise((resolve) => {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483647;
      cursor: none; background: #000;
    `;

    const img = new Image();
    img.src = screenshotDataUrl;

    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = Math.round(cssW * dpr);
    mainCanvas.height = Math.round(cssH * dpr);
    mainCanvas.style.cssText = `position:absolute; top:0; left:0; width:${cssW}px; height:${cssH}px;`;
    const mainCtx = mainCanvas.getContext('2d', { willReadFrequently: true });

    const lensSize = 120;
    const zoom = 6;
    const lens = document.createElement('canvas');
    lens.width = lensSize;
    lens.height = lensSize;
    lens.style.cssText = `
      position: fixed; width: ${lensSize}px; height: ${lensSize}px;
      border-radius: 50%; border: 3px solid #fff;
      box-shadow: 0 2px 12px rgba(0,0,0,.5);
      pointer-events: none; z-index: 2147483647; display: none;
    `;
    const lensCtx = lens.getContext('2d');

    const badge = document.createElement('div');
    badge.style.cssText = `
      position: fixed; padding: 4px 10px; border-radius: 6px;
      background: rgba(20,20,20,.9); color: #fff; font: 12px/1.4 monospace;
      pointer-events: none; z-index: 2147483647; display: none;
      white-space: nowrap;
    `;

    const hint = document.createElement('div');
    hint.textContent = 'Click to pick a color · Esc to cancel';
    hint.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      padding: 8px 16px; border-radius: 20px;
      background: rgba(20,20,20,.85); color: #fff; font: 13px/1.4 -apple-system,sans-serif;
      z-index: 2147483647; pointer-events: none;
    `;

    overlay.appendChild(mainCanvas);
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(lens);
    document.documentElement.appendChild(badge);
    document.documentElement.appendChild(hint);

    function cleanup() {
      overlay.remove();
      lens.remove();
      badge.remove();
      hint.remove();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    }

    function pixelAt(cssX, cssY) {
      const x = Math.min(mainCanvas.width - 1, Math.max(0, Math.round(cssX * dpr)));
      const y = Math.min(mainCanvas.height - 1, Math.max(0, Math.round(cssY * dpr)));
      const data = mainCtx.getImageData(x, y, 1, 1).data;
      return [data[0], data[1], data[2]];
    }

    function toHex([r, g, b]) {
      return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    }

    function onMove(e) {
      const [r, g, b] = pixelAt(e.clientX, e.clientY);
      const hex = toHex([r, g, b]);

      lens.style.display = 'block';
      lens.style.left = e.clientX - lensSize / 2 + 'px';
      lens.style.top = e.clientY - lensSize / 2 + 'px';
      lensCtx.imageSmoothingEnabled = false;
      lensCtx.clearRect(0, 0, lensSize, lensSize);
      const srcSize = lensSize / zoom;
      const sx = Math.round(e.clientX * dpr - (srcSize * dpr) / 2);
      const sy = Math.round(e.clientY * dpr - (srcSize * dpr) / 2);
      lensCtx.drawImage(
        mainCanvas,
        sx, sy, Math.round(srcSize * dpr), Math.round(srcSize * dpr),
        0, 0, lensSize, lensSize
      );
      lensCtx.strokeStyle = 'rgba(255,255,255,.9)';
      lensCtx.lineWidth = 1;
      lensCtx.strokeRect(lensSize / 2 - 6, lensSize / 2 - 6, 12, 12);

      badge.style.display = 'block';
      badge.textContent = `${hex}  rgb(${r}, ${g}, ${b})`;
      badge.style.left = e.clientX + lensSize / 2 + 12 + 'px';
      badge.style.top = e.clientY - 10 + 'px';
    }

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      const [r, g, b] = pixelAt(e.clientX, e.clientY);
      cleanup();
      resolve({ hex: toHex([r, g, b]), rgb: [r, g, b] });
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        resolve(null);
      }
    }

    img.onload = () => {
      mainCtx.drawImage(img, 0, 0, mainCanvas.width, mainCanvas.height);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
    };
    img.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
}
