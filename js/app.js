(function () {
  const styleSelect = document.getElementById("style");
  const topicSelect = document.getElementById("topic");
  const ratioSelect = document.getElementById("ratio");
  const seedInput = document.getElementById("seed");
  const randomizeBtn = document.getElementById("randomizeSeed");
  const previewBtn = document.getElementById("previewBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const previewCanvas = document.getElementById("previewCanvas");
  const renderCanvas = document.getElementById("renderCanvas");
  const overlay = document.getElementById("overlay");
  const overlayText = document.getElementById("overlayText");
  const resolutionNote = document.getElementById("resolutionNote");
  const statusText = document.getElementById("statusText");

  const PREVIEW_MAX_EDGE = 1100;

  function populateSelect(select, items, valueKey, labelKey) {
    select.innerHTML = "";
    items.forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item[valueKey];
      opt.textContent = item[labelKey];
      select.appendChild(opt);
    });
  }

  populateSelect(styleSelect, STYLES, "id", "label");
  populateSelect(topicSelect, TOPICS, "id", "label");
  populateSelect(ratioSelect, RATIOS, "id", "label");

  function getStyle() { return STYLES.find((s) => s.id === styleSelect.value); }
  function getTopic() { return TOPICS.find((t) => t.id === topicSelect.value); }
  function getRatio() { return RATIOS.find((r) => r.id === ratioSelect.value); }

  function updateResolutionNote() {
    const ratio = getRatio();
    resolutionNote.textContent = `Export size: ${ratio.w.toLocaleString()} × ${ratio.h.toLocaleString()} px (${(ratio.w * ratio.h / 1e6).toFixed(1)} MP)`;
  }
  ratioSelect.addEventListener("change", updateResolutionNote);
  updateResolutionNote();

  function setBusy(isBusy, message) {
    overlay.classList.toggle("active", isBusy);
    overlayText.textContent = message || "Generating…";
    previewBtn.disabled = isBusy;
    downloadBtn.disabled = isBusy;
  }

  function setStatus(msg) {
    statusText.textContent = msg || "";
  }

  function renderTo(canvas, w, h, style, topic, seed) {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    const rng = mulberry32(seed);
    style.render(ctx, w, h, topic, rng);
  }

  function computePreviewSize(ratio) {
    const scale = PREVIEW_MAX_EDGE / Math.max(ratio.w, ratio.h);
    return {
      w: Math.round(ratio.w * scale),
      h: Math.round(ratio.h * scale),
    };
  }

  function generatePreview() {
    const style = getStyle();
    const topic = getTopic();
    const ratio = getRatio();
    const seed = parseInt(seedInput.value, 10) || 0;

    setBusy(true, "Generating preview…");
    setStatus("");
    // Let the browser paint the spinner before the synchronous render work.
    setTimeout(() => {
      try {
        const { w, h } = computePreviewSize(ratio);
        renderTo(previewCanvas, w, h, style, topic, seed);
        setStatus(`Preview: ${style.label} · ${topic.label} · ${ratio.id} · seed ${seed}`);
      } catch (err) {
        console.error(err);
        setStatus("Preview failed — see console for details.");
      } finally {
        setBusy(false);
      }
    }, 30);
  }

  function downloadWallpaper() {
    const style = getStyle();
    const topic = getTopic();
    const ratio = getRatio();
    const seed = parseInt(seedInput.value, 10) || 0;

    setBusy(true, `Rendering ${ratio.w}×${ratio.h}… this can take a few seconds`);
    setStatus("");
    setTimeout(() => {
      try {
        renderTo(renderCanvas, ratio.w, ratio.h, style, topic, seed);
        renderCanvas.toBlob((blob) => {
          if (!blob) {
            setStatus("Export failed — could not create image blob.");
            setBusy(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const filename = `wallpaper_${style.id}_${topic.id}_${ratio.id.replace(":", "x")}_seed${seed}.png`;
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          setStatus(`Downloaded ${filename}`);
          setBusy(false);
        }, "image/png");
      } catch (err) {
        console.error(err);
        setStatus("Export failed — the resolution may exceed your browser's canvas limits.");
        setBusy(false);
      }
    }, 30);
  }

  randomizeBtn.addEventListener("click", () => {
    seedInput.value = Math.floor(Math.random() * 999999);
  });

  previewBtn.addEventListener("click", generatePreview);
  downloadBtn.addEventListener("click", downloadWallpaper);
  [styleSelect, topicSelect, ratioSelect, seedInput].forEach((el) =>
    el.addEventListener("change", generatePreview)
  );

  // Initial preview on load.
  generatePreview();
})();
